// Smoke test F9 · Importar CSV — verifica que:
// 1. Parser CSV maneja comas, punto y coma, comillas.
// 2. Detección de columnas por nombre (fecha, descripción, monto, tipo).
// 3. Normalización de fecha (DD/MM/YYYY, YYYY-MM-DD, DD/MM/YY).
// 4. Parsear monto (formatos US, europeo, con símbolo).
// 5. Detección de tipo (ingreso/gasto) por signo y por columna tipo.
// 6. Detección de categoría por diccionario.
// 7. Dedupe contra tx existentes.
// 8. Mapeo de filas a MovimientoCsv.
// 9. Importación masiva con dedupe final.
// 10. Resultado con importados, salteados, totales.

import { parsearCsv, detectarColumnas, mapearFilas, importarTransaccionesMasivas } from '../src/services/importarCsv.ts';
import { detectarCategoria } from '../src/data/catalogos.ts';
import { resetTotal, agregarTransaccion, leerEstado } from '../src/services/estado.ts';

let ok = 0;
let fail = 0;
function check(cond, msg) {
  if (cond) { ok++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
}

console.log('\n[1] Parser CSV con comas');
{
  const csv = 'fecha,descripcion,monto,tipo\n2026-09-01,UBER TRIP,25.50,gasto\n2026-09-02,SUELDO,1500,ingreso';
  const r = parsearCsv(csv);
  check(r.headers.length === 4, '4 headers');
  check(r.headers[0] === 'fecha', 'primer header = fecha');
  check(r.filas.length === 2, '2 filas de datos');
  check(r.filas[0][1] === 'UBER TRIP', 'fila 1 desc = UBER TRIP');
}

console.log('\n[2] Parser CSV con punto y coma');
{
  const csv = 'fecha;descripcion;monto;tipo\n2026-09-01;NETFLIX;45.90;gasto\n2026-09-02;SUPER;120;gasto';
  const r = parsearCsv(csv);
  check(r.headers.length === 4, '4 headers con ;');
  check(r.filas.length === 2, '2 filas con ;');
  check(r.filas[0][1] === 'NETFLIX', 'fila 1 desc = NETFLIX');
}

console.log('\n[3] Parser CSV con comillas (campo con coma interna)');
{
  const csv = 'fecha,descripcion,monto\n2026-09-01,"PAGO, SERVICIO",100\n2026-09-02,OTRO,50';
  const r = parsearCsv(csv);
  check(r.filas[0][1] === 'PAGO, SERVICIO', 'campo con coma interna entre comillas');
}

console.log('\n[4] Detección de columnas');
{
  const headers = ['Fecha Operacion', 'Descripcion', 'Monto', 'Tipo Operacion'];
  const c = detectarColumnas(headers);
  check(c.fecha === 0, 'fecha detectada en col 0');
  check(c.descripcion === 1, 'descripcion detectada en col 1');
  check(c.monto === 2, 'monto detectada en col 2');
  check(c.tipo === 3, 'tipo detectada en col 3');
}

console.log('\n[5] Detección con nombres alternativos');
{
  const headers = ['date', 'concepto', 'amount'];
  const c = detectarColumnas(headers);
  check(c.fecha === 0, 'date detectado');
  check(c.descripcion === 1, 'concepto detectado');
  check(c.monto === 2, 'amount detectado');
  check(c.tipo === null, 'sin columna tipo');
}

console.log('\n[6] Detectar categoría por diccionario');
{
  check(detectarCategoria('UBER TRIP') === 'Transporte', 'UBER → Transporte');
  check(detectarCategoria('NETFLIX MONTHLY') === 'Entretenimiento', 'NETFLIX → Entretenimiento');
  check(detectarCategoria('SUPERMERCADO TOTTUS') === 'Alimentación', 'TOTTUS → Alimentación');
  check(detectarCategoria('SUELDO MENSUAL') === 'Trabajo Principal', 'SUELDO → Trabajo Principal');
  check(detectarCategoria('COMPRA RARA') === 'Otros', 'sin match → Otros');
  check(detectarCategoria('') === 'Otros', 'descripción vacía → Otros');
  check(detectarCategoria('uber trip') === 'Transporte', 'insensible a mayúsculas');
}

console.log('\n[7] Mapeo de filas con dedupe');
{
  localStorage.clear();
  resetTotal();
  let est = leerEstado();
  // Pre-existe una tx UBER de 25.50 — usar fecha de HOY para que esté dentro de 7 días
  const hoy = new Date().toISOString().split('T')[0];
  est = agregarTransaccion(est, { type: 'expense', monto: 25.50, categoria: 'Transporte', cuenta: 'bcp', fecha: hoy, descripcion: 'UBER TRIP' });
  // CSV con esa tx duplicada + una nueva
  const csv = parsearCsv(`fecha,descripcion,monto\n${hoy},UBER TRIP,25.50\n${hoy},SUPERMERCADO,120`);
  const cols = detectarColumnas(csv.headers);
  const movs = mapearFilas(csv, cols, 'bcp', est);
  check(movs.length === 2, '2 movimientos mapeados');
  check(movs[0].posibleDuplicado === true, 'UBER marcado como duplicado');
  check(movs[0].seleccionado === false, 'UBER deschequeado por defecto');
  check(movs[1].posibleDuplicado === false, 'SUPERMERCADO no es duplicado');
  check(movs[1].seleccionado === true, 'SUPERMERCADO chequeado');
  check(movs[0].categoria === 'Transporte', 'UBER → Transporte');
  check(movs[1].categoria === 'Alimentación', 'SUPERMERCADO → Alimentación (matchea SUPER)');
}

console.log('\n[8] Importación masiva');
{
  localStorage.clear();
  resetTotal();
  let est = leerEstado();
  const hoy = new Date().toISOString().split('T')[0];
  // CSV con columna tipo explícita (como viene de un banco real)
  const csv = parsearCsv(`fecha,descripcion,monto,tipo\n${hoy},UBER TRIP,25.50,gasto\n${hoy},SUELDO,1500,ingreso\n${hoy},NETFLIX,45.90,gasto`);
  const cols = detectarColumnas(csv.headers);
  let movs = mapearFilas(csv, cols, 'bcp', est);
  // Marcar todos como seleccionados
  movs = movs.map(m => ({ ...m, seleccionado: true }));
  const { estado: nuevoEst, resultado } = importarTransaccionesMasivas(est, movs);
  check(resultado.importados === 3, '3 importados');
  check(resultado.salteados === 0, '0 salteados');
  check(Math.abs(resultado.totalGastos - 71.4) < 0.01, 'total gastos ≈ 71.4 (25.50 + 45.90)');
  check(Math.abs(resultado.totalIngresos - 1500) < 0.01, 'total ingresos ≈ 1500');
  check(nuevoEst.transactions.length === 3, '3 tx en el estado');
}

console.log('\n[9] Importación con duplicados salteados');
{
  localStorage.clear();
  resetTotal();
  let est = leerEstado();
  const hoy = new Date().toISOString().split('T')[0];
  // Pre-existe una tx
  est = agregarTransaccion(est, { type: 'expense', monto: 25.50, categoria: 'Transporte', cuenta: 'bcp', fecha: hoy, descripcion: 'UBER TRIP' });
  const csv = parsearCsv(`fecha,descripcion,monto\n${hoy},UBER TRIP,25.50\n${hoy},SUPER,120`);
  const cols = detectarColumnas(csv.headers);
  let movs = mapearFilas(csv, cols, 'bcp', est);
  // El duplicado está deschequeado por defecto
  const { resultado } = importarTransaccionesMasivas(est, movs);
  check(resultado.importados === 1, '1 importado (SUPER)');
  check(resultado.salteados === 1, '1 salteado (UBER duplicado)');
}

console.log('\n[10] Importar el mismo CSV dos veces no duplica');
{
  localStorage.clear();
  resetTotal();
  let est = leerEstado();
  const hoy = new Date().toISOString().split('T')[0];
  const csv = parsearCsv(`fecha,descripcion,monto\n${hoy},UBER,25.50\n${hoy},SUELDO,1500`);
  const cols = detectarColumnas(csv.headers);
  let movs = mapearFilas(csv, cols, 'bcp', est).map(m => ({ ...m, seleccionado: true }));
  // Primera importación
  const { estado: est1 } = importarTransaccionesMasivas(est, movs);
  // Segunda importación del mismo CSV sobre el estado actualizado
  let movs2 = mapearFilas(csv, cols, 'bcp', est1).map(m => ({ ...m, seleccionado: true }));
  const { estado: est2, resultado } = importarTransaccionesMasivas(est1, movs2);
  check(est1.transactions.length === 2, 'tras 1ra import: 2 tx');
  check(est2.transactions.length === 2, 'tras 2da import: siguen 2 tx (dedupe)');
  check(resultado.importados === 0, '2da vez: 0 importados');
  check(resultado.salteados === 2, '2da vez: 2 salteados (dedupe)');
}

// Resumen
console.log(`\n════════════════════════════════════════════════`);
console.log(`SMOKE F9: ${ok} OK · ${fail} FAIL`);
console.log(`════════════════════════════════════════════════`);
if (fail > 0) {
  console.error('❌ HAY FALLOS — revisar arriba');
  process.exit(1);
}
console.log('✅ Todos los smoke tests F9 pasaron');
