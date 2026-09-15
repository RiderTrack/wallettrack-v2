// Smoke test F9.1 · Importar multi-formato — verifica que:
// 1. parsearMonto entiende estilo contable: (50.00) y 50.00- = negativos.
// 2. normalizarFecha entiende DD/MM sin año (PDFs).
// 3. detectarColumnas NO confunde "Fecha de operación" ni "N° de
//    operación" del BCP con la columna tipo (y sí sigue encontrando
//    "Tipo Operacion" como antes).
// 4. parsearXlsx: headers en cualquier fila (títulos arriba), celdas
//    Date/número/richText, y fusión Cargo/Abono con signo.
// 5. parsearPdf: reconstruye líneas por coordenadas, múltiples items
//    por línea, montos con S/ · paréntesis · guión final, descripciones
//    envueltas, encabezados/saldos/folios repetidos, 2 páginas.
// 6. leerArchivoBancario despacha por extensión (csv/txt/xlsx/pdf/xls).
// 7. Pipeline completo XLSX → mapearFilas (categorías+dedupe) → importar.
// 8. Errores amigables: XLSX vacío, PDF escaneado, PDF con clave, .xls.
//
// Correr con: npx tsx -r ./scripts/localstorage-shim.cjs scripts/smoke-f91.ts

import {
  parsearCsv, detectarColumnas, mapearFilas, importarTransaccionesMasivas,
  leerArchivoBancario, parsearXlsx, parsearPdf, parsearMonto, normalizarFecha,
} from '../src/services/importarCsv.ts';
import { resetTotal, leerEstado } from '../src/services/estado.ts';
import { CATS_GASTO_DEFAULT, CATS_INGRESO_DEFAULT, DICCIONARIO_CATEGORIAS } from '../src/data/catalogos.ts';

let ok = 0;
let fail = 0;
function check(cond, msg) {
  if (cond) { ok++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
}

// Año esperado para una fecha DD/MM sin año (misma regla del parser:
// si queda a >45 días en el futuro, asume el año anterior)
function anioEsperado(mes, dia) {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const f = new Date(y, mes - 1, dia);
  return f.getTime() - hoy.getTime() > 45 * 86_400_000 ? y - 1 : y;
}

console.log('\n[1] parsearMonto estilo contable');
{
  check(parsearMonto('(50.00)') === -50, '(50.00) → -50');
  check(parsearMonto('(1,234.56)') === -1234.56, '(1,234.56) → -1234.56');
  check(parsearMonto('50.00-') === -50, '50.00- → -50');
  check(parsearMonto('S/ -1,234.56') === -1234.56, 'S/ -1,234.56 → -1234.56');
  check(parsearMonto('-59.90') === -59.9, '-59.90 → -59.90 (sin cambio)');
  check(parsearMonto('S/ 50') === 50, 'S/ 50 → 50 (sin cambio)');
  check(parsearMonto('1.234,56') === 1234.56, '1.234,56 → 1234.56 (europeo sin cambio)');
}

console.log('\n[2] normalizarFecha sin año (PDFs)');
{
  const y = anioEsperado(9, 15);
  check(normalizarFecha('15/09') === `${y}-09-15`, `15/09 → ${y}-09-15`);
  const y2 = anioEsperado(12, 31);
  check(normalizarFecha('31/12') === `${y2}-12-31`, `31/12 → ${y2}-12-31 (cruza el año si es futuro)`);
  check(normalizarFecha('15/09/2026') === '2026-09-15', '15/09/2026 sin regresión');
  check(normalizarFecha('2026-09-15') === '2026-09-15', '2026-09-15 sin regresión');
}

console.log('\n[3] detectarColumnas con headers reales del BCP');
{
  const headers = ['Fecha de operación', 'N° de operación', 'Descripción', 'Importe', 'Moneda', 'Saldo'];
  const c = detectarColumnas(headers);
  check(c.fecha === 0, '"Fecha de operación" → fecha (no tipo)');
  check(c.descripcion === 2, '"Descripción" → descripción');
  check(c.monto === 3, '"Importe" → monto');
  check(c.tipo === null, '"N° de operación" NO se confunde con el tipo');
  // Regresión: el formato del smoke F9 sigue funcionando
  const c2 = detectarColumnas(['Fecha Operacion', 'Descripcion', 'Monto', 'Tipo Operacion']);
  check(c2.tipo === 3, '"Tipo Operacion" sigue siendo la columna tipo');
  const c3 = detectarColumnas(['fecha', 'descripcion', 'monto', 'tipo']);
  check(c3.tipo === 3, '"tipo" exacto sigue funcionando');
}

console.log('\n[4] parsearXlsx básico (headers BCP con títulos arriba)');
{
  // …(se arma en [5] junto al pipeline)
}

console.log('\n[5] XLSX round-trip: exceljs genera → parsearXlsx lee');
{
  // Fechas DINÁMICAS dentro de la ventana de dedupe (últimos 7 días)
  const hace = (dias) => new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - dias));
  const iso = (d) => d.toISOString().split('T')[0];
  const excelMod = await import('exceljs'); const ExcelJS = excelMod.default ?? excelMod;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Movimientos');
  ws.addRow(['Consulta de Movimientos - BCP']);           // título (A1)
  ws.addRow(['Del 01/09/2026 al 15/09/2026']);           // subtítulo
  ws.addRow(['Fecha de operación', 'N° de operación', 'Descripción', 'Importe', 'Moneda']);
  ws.addRow([hace(1), '345678901', 'PAGO*NETFLIX.COM', -59.9, 'PEN']);
  ws.addRow([hace(2), '345678902', 'UBER TRIP LIMA', -25.5, 'PEN']);
  ws.addRow([hace(5), '345678903', 'ABONO SUELDO PLANILLA', 1500, 'PEN']);
  // Celda richText en la descripción
  const richRow = ws.addRow([hace(6), '345678904', '', -45.9, 'PEN']);
  richRow.getCell(3).value = { richText: [{ font: { bold: true }, text: 'FARMACIA ' }, { text: 'INKAFARMA' }] };
  const buf = await wb.xlsx.writeBuffer();

  const r = await parsearXlsx(buf);
  check(r.headers.length === 5, 'headers = fila 3 (títulos descartados)');
  check(r.headers[0] === 'Fecha de operación' && r.headers[3] === 'Importe', 'headers correctos');
  check(r.filas.length === 4, '4 filas de datos');
  check(r.filas[0][0] === `${String(hace(1).getUTCDate()).padStart(2, '0')}/${String(hace(1).getUTCMonth() + 1).padStart(2, '0')}/${hace(1).getUTCFullYear()}`, 'celda Date → DD/MM/YYYY (sin corrimiento UTC-5)');
  check(r.filas[1][2] === 'UBER TRIP LIMA', 'celda string OK');
  check(r.filas[3][2] === 'FARMACIA INKAFARMA', 'celda richText → texto plano');

  const cols = detectarColumnas(r.headers);
  check(cols.fecha === 0 && cols.descripcion === 2 && cols.monto === 3 && cols.tipo === null, 'detección de columnas BCP OK');

  localStorage.clear();
  resetTotal();
  const est = leerEstado();
  const movs = mapearFilas(r, cols, 'bcp', est);
  check(movs.length === 4, '4 movimientos mapeados');
  check(movs[0].categoria === 'Entretenimiento', 'NETFLIX → Entretenimiento');
  check(movs[1].categoria === 'Transporte', 'UBER → Transporte');
  check(movs[2].categoria === 'Trabajo Principal', 'SUELDO/PLANILLA → Trabajo Principal');
  check(movs[3].categoria === 'Salud', 'INKAFARMA → Salud');
  check(movs[0].tipo === 'expense' && movs[1].tipo === 'expense', 'negativos → expense');
  check(movs[2].tipo === 'income' && movs[2].monto === 1500, 'positivo → income 1500');
  check(movs.every((m) => m.seleccionado === true), 'todos chequeados (sin duplicados previos)');

  const sel = movs.map((m) => ({ ...m, seleccionado: true }));
  const { estado: est2, resultado } = importarTransaccionesMasivas(est, sel);
  check(resultado.importados === 4, '4 importados');
  check(Math.abs(resultado.totalGastos - (59.9 + 25.5 + 45.9)) < 0.01, 'total gastos = 131.30');
  check(resultado.totalIngresos === 1500, 'total ingresos = 1500');
  // Re-importar el MISMO xlsx no duplica (dedupe)
  const movs2 = mapearFilas(r, cols, 'bcp', est2).map((m) => ({ ...m, seleccionado: true }));
  const { resultado: r2 } = importarTransaccionesMasivas(est2, movs2);
  check(r2.importados === 0 && r2.salteados === 4, 're-importar el XLSX: 0 importados · 4 salteados (dedupe)');
}

console.log('\n[6] XLSX con Cargo/Abono separados → Monto sintetizado');
{
  const hace6 = (dias) => new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - dias));
  const excelMod = await import('exceljs'); const ExcelJS = excelMod.default ?? excelMod;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('CargoAbono');
  ws.addRow(['Fecha', 'Descripción', 'Cargo', 'Abono']);
  ws.addRow([hace6(1), 'FARMACIA INKAFARMA', 45.9, null]);
  ws.addRow([hace6(2), 'YAPE RECIBIDO DE MAMA', null, 200]);
  ws.addRow([hace6(3), 'SUELDO MENSUAL', null, 3500]);
  const buf = await wb.xlsx.writeBuffer();
  const r = await parsearXlsx(buf);
  check(r.headers.length === 5 && r.headers[4] === 'Monto', 'columna Monto sintetizada');
  const cols = detectarColumnas(r.headers);
  check(cols.monto === 4, 'la columna sintetizada es el monto');
  check(r.filas[0][4] === '-45.9', 'cargo → -45.9');
  check(r.filas[1][4] === '200', 'abono → 200');
  const movs = mapearFilas(r, cols, 'bcp', leerEstado());
  check(movs.length === 3, '3 movimientos');
  check(movs[0].tipo === 'expense' && movs[0].monto === 45.9, 'cargo → expense 45.9');
  check(movs[1].tipo === 'income' && movs[1].monto === 200, 'abono → income 200');
  check(movs[1].categoria === 'Transferencia', 'YAPE → Transferencia');
}

console.log('\n[7] XLSX vacío → error amigable');
{
  const excelMod = await import('exceljs'); const ExcelJS = excelMod.default ?? excelMod;
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Vacia');
  const buf = await wb.xlsx.writeBuffer();
  let msg = '';
  try { await parsearXlsx(buf); } catch (e) { msg = e.message; }
  check(/vacío|no tiene/i.test(msg), `error amigable: "${msg}"`);
}

console.log('\n[8] PDF round-trip: jspdf genera extracto → parsearPdf lee');
{
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setFontSize(10);
  // Página 1 — membrete + encabezado + movimientos
  doc.text('BCP - Extracto de Movimientos', 40, 40);
  doc.text('Cuenta: 191-1234567-0-12', 40, 56);
  doc.text('Fecha', 40, 80); doc.text('Descripción', 150, 80); doc.text('Importe', 480, 80);
  doc.text('01/09/2026', 40, 100); doc.text('PAGO*NETFLIX.COM', 150, 100); doc.text('-59.90', 480, 100);
  doc.text('01/09/2026', 40, 116); doc.text('UBER TRIP LIMA', 150, 116); doc.text('S/ -25.50', 480, 116);
  doc.text('02/09/2026', 40, 132); doc.text('SUPERMERCADO TOTTUS', 150, 132); doc.text('(120.00)', 480, 132);
  // Descripción envuelta: el monto en la 1ra línea, la 2da se une a la desc
  doc.text('03/09/2026', 40, 148); doc.text('COMPRA MERCADO LIBRE ENVIO', 150, 148); doc.text('-99.90', 480, 148);
  doc.text('GRATIS POR PROMO', 150, 162);
  // Descripción envuelta: el monto cae en la 2da línea junto con texto
  doc.text('04/09/2026', 40, 190); doc.text('PAGO SEGURO TODO RIESGO', 150, 190);
  doc.text('PLAN VEHICULAR', 150, 204); doc.text('(350.00)', 480, 204);
  doc.text('Saldo contable: S/ 1,234.56', 300, 300);
  doc.text('Página 1 de 2', 300, 800);
  doc.addPage();
  // Página 2 — encabezado repetido + fecha sin año + guión final
  doc.text('Fecha', 40, 40); doc.text('Descripción', 150, 40); doc.text('Importe', 480, 40);
  doc.text('05/09', 40, 60); doc.text('YAPE ENVIADO A JUAN', 150, 60); doc.text('80.00-', 480, 60);
  doc.text('05/09', 40, 76); doc.text('ABONO HABERES', 150, 76); doc.text('2,800.00', 480, 76);
  doc.text('Página 2 de 2', 300, 800);
  const bytes = doc.output('arraybuffer');

  const r = await parsearPdf(bytes);
  check(r.headers[0] === 'Fecha' && r.headers[1] === 'Descripción' && r.headers[2] === 'Monto', 'headers sintéticos');
  check(r.filas.length === 7, `7 movimientos (got ${r.filas.length})`);
  check(r.filas[0][0] === '01/09/2026' && r.filas[0][2] === '-59.90', 'fila 1: netflix -59.90');
  check(r.filas[1][2] === '-25.50' && r.filas[1][1] === 'UBER TRIP LIMA', 'fila 2: S/ -25.50 sin el S/ en la desc');
  check(r.filas[2][2] === '(120.00)', 'fila 3: (120.00) estilo contable');
  check(/COMPRA MERCADO LIBRE ENVIO GRATIS POR PROMO/.test(r.filas[3][1]), 'desc envuelta unida (1ra línea con monto)');
  check(r.filas[4][2] === '(350.00)' && /SEGURO TODO RIESGO PLAN VEHICULAR/.test(r.filas[4][1]), 'desc envuelta con monto en 2da línea');
  const y5 = anioEsperado(9, 5);
  check(r.filas[5][0] === '05/09' && normalizarFecha(r.filas[5][0]) === `${y5}-09-05`, 'fecha 05/09 sin año normalizada');
  check(r.filas[5][2] === '80.00-', 'monto 80.00- con menos al final');
  check(r.filas[6][2] === '2,800.00' && r.filas[6][0] === '05/09', 'fila 7: 2,800.00 con coma de miles');

  // Pipeline: categorías + tipos + importación
  const cols = detectarColumnas(r.headers);
  localStorage.clear();
  resetTotal();
  const est = leerEstado();
  const movs = mapearFilas(r, cols, 'bcp', est);
  check(movs.length === 7, '7 movimientos mapeados desde PDF');
  check(movs[0].categoria === 'Entretenimiento', 'NETFLIX → Entretenimiento');
  check(movs[1].categoria === 'Transporte', 'UBER → Transporte');
  check(movs[2].categoria === 'Alimentación' && movs[2].tipo === 'expense' && movs[2].monto === 120, 'TOTTUS → Alimentación · (120.00) → expense 120');
  check(movs[5].tipo === 'expense' && movs[5].monto === 80, '80.00- → expense 80');
  check(movs[6].tipo === 'income' && movs[6].monto === 2800, '2,800.00 → income 2800');
  const sel = movs.map((m) => ({ ...m, seleccionado: true }));
  const { resultado } = importarTransaccionesMasivas(est, sel);
  check(resultado.importados === 7, '7 importados desde PDF');
  check(Math.abs(resultado.totalGastos - (59.9 + 25.5 + 120 + 99.9 + 350 + 80)) < 0.01, 'total gastos = 735.30');
  check(resultado.totalIngresos === 2800, 'total ingresos = 2800');
}

console.log('\n[9] PDF sin texto (escaneo) → error amigable');
{
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  doc.rect(20, 20, 100, 100); // solo un dibujo, sin texto
  const bytes = doc.output('arraybuffer');
  let msg = '';
  try { await parsearPdf(bytes); } catch (e) { msg = e.message; }
  check(/no tiene texto|escaneo/i.test(msg), `error amigable: "${msg}"`);
}

console.log('\n[10] PDF con contraseña → error amigable');
{
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ encryption: { userPassword: 'clave123', ownerPassword: 'owner' } });
  doc.text('01/09/2026 SECRETO -10.00', 40, 40);
  const bytes = doc.output('arraybuffer');
  let msg = '';
  try { await parsearPdf(bytes); } catch (e) { msg = e.message; }
  check(/contraseña|protegido/i.test(msg), `error amigable: "${msg}"`);
}

console.log('\n[11] leerArchivoBancario despacha por extensión');
{
  // CSV
  const fCsv = new File(['fecha,descripcion,monto\n2026-09-01,NETFLIX,-59.90\n'], 'bcp.csv', { type: 'text/csv' });
  const rCsv = await leerArchivoBancario(fCsv);
  check(rCsv.formato === 'csv' && rCsv.filas.length === 1, 'csv → formato csv, 1 fila');
  // TXT (mismo parser)
  const fTxt = new File(['fecha;descripcion;monto\n2026-09-01;SUPER;120\n'], 'bcp.txt', { type: 'text/plain' });
  const rTxt = await leerArchivoBancario(fTxt);
  check(rTxt.formato === 'txt' && rTxt.filas.length === 1 && rTxt.filas[0][1] === 'SUPER', 'txt → formato txt, parser punto y coma');
  // XLSX
  const excelMod = await import('exceljs'); const ExcelJS = excelMod.default ?? excelMod;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('M');
  ws.addRow(['Fecha', 'Descripción', 'Importe']);
  ws.addRow(['01/09/2026', 'UBER', -30]);
  const bufX = await wb.xlsx.writeBuffer();
  const fX = new File([new Uint8Array(bufX)], 'bcp.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const rX = await leerArchivoBancario(fX);
  check(rX.formato === 'xlsx' && rX.headers.length === 3 && rX.filas[0][1] === 'UBER', 'xlsx → formato xlsx, leído');
  // PDF
  const { jsPDF } = await import('jspdf');
  const d = new jsPDF({ unit: 'pt' });
  d.text('01/09/2026 NETFLIX -59.90', 40, 60);
  const fP = new File([new Uint8Array(d.output('arraybuffer'))], 'bcp.pdf', { type: 'application/pdf' });
  const rP = await leerArchivoBancario(fP);
  check(rP.formato === 'pdf' && rP.filas.length === 1 && rP.filas[0][2] === '-59.90', 'pdf → formato pdf, 1 fila');
  // .xls viejo → error con instrucción
  const fOld = new File(['x'], 'viejo.xls');
  let msg = '';
  try { await leerArchivoBancario(fOld); } catch (e) { msg = e.message; }
  check(/\.xls/.test(msg) && /xlsx|CSV/i.test(msg), `.xls → error con instrucción: "${msg}"`);
}

console.log('\n[12] Regresión: parser CSV de F9 intacto');
{
  const csv = 'fecha,descripcion,monto,tipo\n2026-09-01,UBER TRIP,25.50,gasto\n2026-09-02,SUELDO,1500,ingreso';
  const r = parsearCsv(csv);
  check(r.headers.length === 4 && r.filas.length === 2, 'CSV con comas OK');
  const c = detectarColumnas(r.headers);
  check(c.fecha === 0 && c.descripcion === 1 && c.monto === 2 && c.tipo === 3, 'detección estándar OK');
}

console.log('\n[13] Guard: toda categoría del diccionario existe en el select del import');
{
  // El select del modal ofrece: gasto+custom, especiales, ingreso+custom.
  // (Bug de F9 cazado en el E2E: YAPE→Transferencia no existía como
  // opción y el select caía silenciosamente a "Hogar".)
  const especiales = ['Transferencia', 'Ahorro'];
  const disponibles = new Set([
    ...CATS_GASTO_DEFAULT.map((c) => c.nombre),
    ...CATS_INGRESO_DEFAULT.map((c) => c.nombre),
    ...especiales,
  ]);
  const faltantes = [...new Set(Object.values(DICCIONARIO_CATEGORIAS))].filter((v) => !disponibles.has(v));
  check(faltantes.length === 0, `todas las sugerencias del diccionario existen en el select (${faltantes.join(', ') || 'ok'})`);
}

// Resumen
console.log(`\n════════════════════════════════════════════════`);
console.log(`SMOKE F9.1: ${ok} OK · ${fail} FAIL`);
console.log(`════════════════════════════════════════════════`);
if (fail > 0) {
  console.error('❌ HAY FALLOS — revisar arriba');
  process.exit(1);
}
console.log('✅ Todos los smoke tests F9.1 pasaron');
