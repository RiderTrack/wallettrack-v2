// ═══════════════════════════════════════════════════════════
// 📥 IMPORTAR EXTRACTO — WalletTrack V2 (F9.1 · MULTI-FORMATO)
// Importador de extractos bancarios que acepta CSV, TXT, XLSX y
// PDF (BCP, Interbank, BBVA, Yape, Plin) detectando columnas
// por nombre.
//
// FLUJO:
//   1. leerArchivoBancario(file) → { headers, filas, formato }
//      despachando por extensión:
//      · CSV/TXT → parsearCsv (parser a mano, sin deps)
//      · XLSX    → parsearXlsx (exceljs, lazy — mismo chunk
//                  del exportar Excel de F3)
//      · PDF     → parsearPdf (pdfjs-dist, lazy — reconstruye
//                  líneas con las coordenadas del texto)
//   2. detectarColumnas(headers) → { fecha, descripcion, monto,
//      tipo } mapeando por nombre (insensible a mayúsculas).
//   3. mapearFilas(filas, columnas, cuentaId) → MovimientoCsv[]
//      con tipo (income/expense), categoría autodetectada por
//      diccionario y flag de posible duplicado.
//   4. El usuario revisa y edita categorías en el modal.
//   5. importarTransaccionesMasivas(estado, movs) inserta las
//      elegidas con dedupe real (fecha+monto+descripción en los
//      últimos 7 días).
// ═══════════════════════════════════════════════════════════

import type { EstadoWallet, Transaccion } from '../types';
import { detectarCategoria } from '../data/catalogos';

// ── Tipos ────────────────────────────────────────────────────

export interface CsvCrudo {
  headers: string[];
  filas: string[][];
}

/** F9.1 · Resultado de leer un archivo bancario de cualquier formato. */
export interface ArchivoLeido extends CsvCrudo {
  formato: 'csv' | 'txt' | 'xlsx' | 'pdf';
}

export interface ColumnasDetectadas {
  fecha: number | null;
  descripcion: number | null;
  monto: number | null;
  tipo: number | null;
}

export interface MovimientoCsv {
  fecha: string;            // 'YYYY-MM-DD' (normalizada)
  descripcion: string;
  monto: number;
  tipo: 'income' | 'expense';
  categoria: string;        // autodetectada, editable
  cuenta: string;           // id de cuenta
  posibleDuplicado: boolean;
  seleccionado: boolean;    // checkbox del usuario
}

export interface ResultadoImportacion {
  importados: number;
  salteados: number;
  totalGastos: number;
  totalIngresos: number;
}

// ── Parser CSV ───────────────────────────────────────────────

/**
 * Parsea un CSV completo. Detecta el separador (coma o punto y
 * coma) y maneja campos entre comillas (con saltos de línea
 * internos). Devuelve headers (primera fila) y filas (resto).
 */
export function parsearCsv(texto: string): CsvCrudo {
  const limpio = texto.replace(/^\uFEFF/, ''); // quitar BOM si existe
  // Detectar separador: contar comas vs punto y coma en la primera línea
  const primeraLinea = limpio.split(/\r?\n/)[0] || '';
  const comas = (primeraLinea.match(/,/g) || []).length;
  const puntoComa = (primeraLinea.match(/;/g) || []).length;
  const sep = puntoComa > comas ? ';' : ',';

  // Parsear con manejo de comillas
  const filas: string[][] = [];
  let filaActual: string[] = [];
  let campoActual = '';
  let dentroComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (dentroComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') {
          campoActual += '"';
          i++;
        } else {
          dentroComillas = false;
        }
      } else {
        campoActual += c;
      }
    } else {
      if (c === '"') {
        dentroComillas = true;
      } else if (c === sep) {
        filaActual.push(campoActual.trim());
        campoActual = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && limpio[i + 1] === '\n') i++;
        filaActual.push(campoActual.trim());
        if (filaActual.some((f) => f !== '')) filas.push(filaActual);
        filaActual = [];
        campoActual = '';
      } else {
        campoActual += c;
      }
    }
  }
  // Último campo
  if (campoActual !== '' || filaActual.length > 0) {
    filaActual.push(campoActual.trim());
    if (filaActual.some((f) => f !== '')) filas.push(filaActual);
  }

  if (filas.length === 0) return { headers: [], filas: [] };

  const headers = filas[0].map((h) => h.trim());
  const filasDatos = filas.slice(1);
  return { headers, filas: filasDatos };
}

// ── Detección de columnas ───────────────────────────────────

const SINONIMOS_FECHA = ['fecha', 'date', 'fecha operacion', 'f. operacion', 'fecha movimiento', 'f. movimiento', 'fecha transaccion'];
const SINONIMOS_DESC = ['descripcion', 'concepto', 'detalle', 'descripcion operacion', 'detalle operacion', 'descripcion movimiento', 'descripcion transaccion', 'glosa'];
const SINONIMOS_MONTO = ['monto', 'importe', 'amount', 'valor', 'monto total', 'importe total', 'cargo abono'];
const SINONIMOS_TIPO = ['tipo', 'operacion', 'cargo/abono', 'cargo abono', 'naturaleza', 'signo'];

// F9.1 · Headers que NUNCA son columna "tipo" aunque contengan un
// sinónimo como 'operacion'. Motivo BCP: el extracto trae
// "Fecha de operación" (es FECHA) y "N° de operación" (es el
// número de referencia) — el F9 viejo podía confundirlos con el
// tipo y convertir todo en ingreso/gasto según el signo.
const EXCLUIR_TIPO = /(fecha|hora|numero|n[ºo°]|nro|codigo|importe|monto|amount|valor|saldo|moneda|divisa|cambio|descripci|concepto|detalle|glosa)/;

function normalizar(s: string): string {
  return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function buscarColumna(headers: string[], sinonimos: string[]): number | null {
  for (const sinonimo of sinonimos) {
    const n = normalizar(sinonimo);
    const idx = headers.findIndex((h) => normalizar(h) === n);
    if (idx !== -1) return idx;
  }
  // Búsqueda parcial: si el header incluye el sinónimo
  for (const sinonimo of sinonimos) {
    const n = normalizar(sinonimo);
    const idx = headers.findIndex((h) => normalizar(h).includes(n));
    if (idx !== -1) return idx;
  }
  return null;
}

/**
 * Detecta qué columna es fecha, descripción, monto y tipo.
 * Busca por nombre (insensible a mayúsculas y acentos).
 * F9.1: la búsqueda de "tipo" descarta headers que son de otra
 * cosa ("Fecha de operación", "N° de operación", "Tipo de cambio"…).
 */
export function detectarColumnas(headers: string[]): ColumnasDetectadas {
  return {
    fecha: buscarColumna(headers, SINONIMOS_FECHA),
    descripcion: buscarColumna(headers, SINONIMOS_DESC),
    monto: buscarColumna(headers, SINONIMOS_MONTO),
    tipo: buscarColumnaTipo(headers),
  };
}

/**
 * Búsqueda de la columna tipo con doble pasada: primero exacta
 * ("Tipo", "Naturaleza", "Cargo/Abono") y después parcial,
 * descartando los headers de la lista de exclusión.
 */
function buscarColumnaTipo(headers: string[]): number | null {
  // 1) Exacta — un header que ES el sinónimo completo
  for (const sinonimo of SINONIMOS_TIPO) {
    const n = normalizar(sinonimo);
    const idx = headers.findIndex((h) => normalizar(h) === n);
    if (idx !== -1) return idx;
  }
  // 2) Parcial — el header CONTIENE el sinónimo pero no es otra cosa
  for (const sinonimo of SINONIMOS_TIPO) {
    const n = normalizar(sinonimo);
    const idx = headers.findIndex((h) => {
      const hn = normalizar(h);
      return hn.includes(n) && !EXCLUIR_TIPO.test(hn);
    });
    if (idx !== -1) return idx;
  }
  return null;
}

// ── Normalización de fecha y monto ───────────────────────────

/**
 * Normaliza una fecha a 'YYYY-MM-DD'. Acepta:
 *   - DD/MM/YYYY, DD-MM-YYYY
 *   - YYYY-MM-DD
 *   - DD/MM/YY (asume 20YY)
 *   - DD/MM sin año (F9.1, PDFs — año actual o anterior)
 */
export function normalizarFecha(fecha: string): string {
  const limpia = (fecha || '').trim();
  // YYYY-MM-DD
  let m = limpia.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // DD/MM/YYYY o DD-MM-YYYY
  m = limpia.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // DD/MM/YY o DD-MM-YY
  m = limpia.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})/);
  if (m) {
    const [, d, mo, y] = m;
    return `20${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // F9.1 · DD/MM sin año (PDFs de extracto): usa el año actual; si
  // la fecha queda a más de 45 días en el futuro, asume el año
  // anterior (extractos que cruzan el cambio de año).
  m = limpia.match(/^(\d{1,2})[/\-.](\d{1,2})$/);
  if (m) {
    const [, d, mo] = m;
    const hoy = new Date();
    let y = hoy.getFullYear();
    const f = new Date(y, parseInt(mo, 10) - 1, parseInt(d, 10));
    if (f.getTime() - hoy.getTime() > 45 * 86_400_000) y -= 1;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Fallback: fecha actual
  return new Date().toISOString().split('T')[0];
}

/**
 * Parsea un monto. Acepta:
 *   - "1,234.56" (formato US)
 *   - "1.234,56" (formato europeo)
 *   - "1234.56" (sin separador de miles)
 *   - "-50.00" (negativo)
 *   - "S/ 50" (con símbolo)
 *   - "(50.00)" y "50.00-" (F9.1 · estilo contable = negativo)
 */
export function parsearMonto(raw: string): number {
  const entrada = (raw || '').trim();
  // F9.1 · estilo contable: (1,234.56) = negativo · 50.00- = negativo
  const entreParentesis = /^\(.*\)$/.test(entrada);
  const menosAlFinal = /-$/.test(entrada);
  let s = entrada.replace(/[^\d,.\-]/g, ''); // quitar símbolos y letras
  if (s === '' || s === '-' || s === '.') return 0;
  // F9.1 · "50.00-" → "-50.00" (el menos pisado adelante)
  if (s.length > 1 && /-$/.test(s)) s = `-${s.slice(0, -1)}`;
  // Si tiene coma y punto: el último es el decimal
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // Formato europeo: 1.234,56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato US: 1,234.56
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // Solo coma: podría ser 1.234 (europeo) o 1234,56 (europeo) o 1,234 (US)
    const partes = s.split(',');
    if (partes.length === 2 && partes[1].length <= 2) {
      // 1234,56 → europeo decimal
      s = s.replace(',', '.');
    } else {
      // 1,234 → US miles
      s = s.replace(/,/g, '');
    }
  }
  let n = parseFloat(s);
  if (isNaN(n)) return 0;
  // F9.1 · estilo contable: (50.00) y 50.00- son negativos
  if ((entreParentesis || menosAlFinal) && n > 0) n = -n;
  return n;
}

/**
 * Determina el tipo (income/expense) de un movimiento.
 *   1. Si hay columna tipo: busca "ingreso", "abono", "cargo", "gasto", "expense", "income"
 *   2. Si no, infiere por el signo del monto: positivo=ingreso, negativo=gasto
 */
function detectarTipo(valorTipo: string | undefined, monto: number): 'income' | 'expense' {
  if (valorTipo) {
    const t = normalizar(valorTipo);
    if (/(ingreso|abono|haber|deposit|credit|income|entrada)/.test(t)) return 'income';
    if (/(gasto|cargo|debit|expense|salida|retiro)/.test(t)) return 'expense';
  }
  return monto >= 0 ? 'income' : 'expense';
}

// ── Dedupe contra transacciones existentes ───────────────────

/**
 * Verifica si una transacción ya existe en el estado: busca tx
 * con la misma fecha + mismo monto (absoluto) + misma descripción
 * (o descripción que incluya la del CSV) en los últimos 7 días.
 */
function esDuplicado(estado: EstadoWallet, fecha: string, monto: number, descripcion: string): boolean {
  const montoAbs = Math.abs(monto);
  const desc = descripcion.trim().toLowerCase();
  if (!desc) return false;
  const hace7dias = Date.now() - 7 * 86_400_000;
  return estado.transactions.some((t) => {
    const tFecha = new Date(`${t.date}T00:00:00`).getTime();
    if (isNaN(tFecha) || tFecha < hace7dias) return false;
    if (Math.abs(Math.abs(Number(t.amount) || 0) - montoAbs) > 0.01) return false;
    const tDesc = (t.description || '').toLowerCase();
    return tDesc.includes(desc) || desc.includes(tDesc);
  });
}

// ── Mapeo de filas a MovimientoCsv ───────────────────────────

/**
 * Convierte las filas del CSV en MovimientoCsv listos para revisar.
 * Detecta categoría con el diccionario, tipo por signo o columna,
 * y marca posibles duplicados contra las tx existentes.
 */
export function mapearFilas(
  csv: CsvCrudo,
  columnas: ColumnasDetectadas,
  cuentaId: string,
  estado: EstadoWallet,
): MovimientoCsv[] {
  const out: MovimientoCsv[] = [];
  for (const fila of csv.filas) {
    if (!columnas.fecha && !columnas.descripcion && !columnas.monto) continue;
    const fechaRaw = columnas.fecha !== null ? fila[columnas.fecha] ?? '' : '';
    const descRaw = columnas.descripcion !== null ? fila[columnas.descripcion] ?? '' : '';
    const montoRaw = columnas.monto !== null ? fila[columnas.monto] ?? '' : '0';
    const tipoRaw = columnas.tipo !== null ? fila[columnas.tipo] ?? '' : undefined;

    const fecha = normalizarFecha(fechaRaw);
    const descripcion = descRaw.trim() || 'Sin descripción';
    const monto = parsearMonto(montoRaw);
    if (monto === 0) continue; // saltar filas con monto 0 (suelen ser encabezados o totales)
    const tipo = detectarTipo(tipoRaw, monto);
    const montoAbs = Math.abs(monto);
    const categoria = detectarCategoria(descripcion);
    const posibleDuplicado = esDuplicado(estado, fecha, montoAbs, descripcion);

    out.push({
      fecha,
      descripcion,
      monto: montoAbs,
      tipo,
      categoria,
      cuenta: cuentaId,
      posibleDuplicado,
      seleccionado: !posibleDuplicado, // duplicados deschequeados por defecto
    });
  }
  return out;
}

// ── Importación masiva ───────────────────────────────────────

/**
 * Inserta los movimientos seleccionados en el estado. Genera ids
 * anti-colisión (Date.now con sufijo). Devuelve el estado nuevo
 * + un resumen de cuántos se importaron y cuántos se saltearon.
 */
export function importarTransaccionesMasivas(
  estado: EstadoWallet,
  movs: MovimientoCsv[],
): { estado: EstadoWallet; resultado: ResultadoImportacion } {
  let transactions = estado.transactions;
  let importados = 0;
  let salteados = 0;
  let totalGastos = 0;
  let totalIngresos = 0;

  for (const m of movs) {
    if (!m.seleccionado) {
      salteados++;
      continue;
    }
    // Dedupe final (por si cambió el estado desde el mapeo)
    if (esDuplicado({ ...estado, transactions }, m.fecha, m.monto, m.descripcion)) {
      salteados++;
      continue;
    }
    const id = `${Date.now()}-${importados}`;
    const nueva: Transaccion = {
      id,
      date: m.fecha,
      type: m.tipo,
      category: m.categoria,
      amount: m.monto,
      description: m.descripcion,
      account: m.cuenta,
    };
    transactions = [nueva, ...transactions];
    if (m.tipo === 'income') totalIngresos += m.monto;
    else totalGastos += m.monto;
    importados++;
  }

  return {
    estado: { ...estado, transactions },
    resultado: { importados, salteados, totalGastos, totalIngresos },
  };
}

// ═══════════════════════════════════════════════════════════
// 📦 F9.1 · LECTURA MULTI-FORMATO (XLSX · PDF · TXT)
// ═══════════════════════════════════════════════════════════

/**
 * Punto de entrada del modal: recibe el File que eligió el
 * usuario y devuelve headers+filas según la extensión.
 *   .csv/.txt → parser a mano · .xlsx → exceljs (lazy) ·
 *   .pdf → pdfjs (lazy) · .xls → error con instrucción
 */
export async function leerArchivoBancario(file: File): Promise<ArchivoLeido> {
  const nombre = (file.name || '').toLowerCase();
  if (nombre.endsWith('.xlsx')) {
    const r = await parsearXlsx(await file.arrayBuffer());
    return { ...r, formato: 'xlsx' };
  }
  if (nombre.endsWith('.pdf')) {
    const r = await parsearPdf(await file.arrayBuffer());
    return { ...r, formato: 'pdf' };
  }
  if (nombre.endsWith('.xls')) {
    throw new Error('El formato .xls (Excel 2003) no se puede leer. Abrilo en Excel o Google Sheets y guardalo como .xlsx o CSV.');
  }
  if (nombre.endsWith('.txt')) {
    const r = parsearCsv(await file.text());
    if (r.headers.length === 0) throw new Error('El TXT está vacío o no se pudo leer');
    return { ...r, formato: 'txt' };
  }
  const r = parsearCsv(await file.text());
  if (r.headers.length === 0) throw new Error('El CSV está vacío o no se pudo leer');
  return { ...r, formato: 'csv' };
}

// ── XLSX (exceljs — mismo paquete lazy del export de F3) ───────

/** Convierte el valor de una celda exceljs a texto plano. */
function celdaATexto(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    // exceljs parseea los seriales de Excel como fechas UTC —
    // usar getUTC* evita que en UTC-5 se corran un día atrás.
    const p2 = (n: number) => String(n).padStart(2, '0');
    return `${p2(v.getUTCDate())}/${p2(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  }
  if (typeof v === 'number') return String(Math.round(v * 1e10) / 1e10); // sin notación científica
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) {
      return (o.richText as { text?: string }[]).map((r) => r.text || '').join('').trim();
    }
    if ('result' in o) return celdaATexto(o.result);             // fórmula → resultado
    if ('text' in o && typeof o.text === 'string') return o.text.trim(); // hipervínculo
    if ('error' in o) return '';
  }
  return String(v);
}

/**
 * Busca el par de columnas Cargo/Abono (formato BCP con montos
 * separados): devuelven índices o null si no hay par. No aplica
 * si ya existe una columna de monto única.
 */
function buscarParCargoAbono(headers: string[]): { iCargo: number; iAbono: number } | null {
  const norm = headers.map(normalizar);
  const iCargo = norm.findIndex((h) => /^(importe[\s-]*)?cargo\b/.test(h));
  const iAbono = norm.findIndex((h) => /^(importe[\s-]*)?(abono|haber|deposito|ingreso)\b/.test(h));
  if (iCargo === -1 || iAbono === -1 || iCargo === iAbono) return null;
  if (buscarColumna(headers, SINONIMOS_MONTO) !== null) return null; // ya hay Importe/Monto
  return { iCargo, iAbono };
}

/**
 * Lee un XLSX y lo convierte a CsvCrudo. Busca la fila de
 * encabezados en las primeras 15 filas (los extractos suelen
 * traer títulos arriba) y sintetiza la columna Monto cuando el
 * banco trae Cargo y Abono separados.
 */
export async function parsearXlsx(buffer: ArrayBuffer): Promise<CsvCrudo> {
  // Interop dual: en Vite (browser) el namespace trae Workbook como
  // export con nombre; en node/tsx (smoke) vive en .default (CJS).
  const modulo = await import('exceljs');
  const ExcelJS = (modulo as unknown as { default?: typeof modulo }).default ?? modulo;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as Buffer); // acepta ArrayBuffer en browser y node
  const hoja = wb.worksheets[0];
  if (!hoja || hoja.rowCount === 0) throw new Error('El XLSX no tiene hojas con datos');

  const filasCrudas: string[][] = [];
  hoja.eachRow({ includeEmpty: false }, (row) => {
    const fila: string[] = [];
    for (let c = 1; c <= row.cellCount; c++) fila.push(celdaATexto(row.getCell(c).value));
    while (fila.length > 0 && fila[fila.length - 1].trim() === '') fila.pop();
    if (fila.some((c) => c.trim() !== '')) filasCrudas.push(fila);
  });
  if (filasCrudas.length === 0) throw new Error('El XLSX está vacío');

  // Fila de encabezados: la primera (de hasta 15) que parezca header
  let idxHeaders = 0;
  const limite = Math.min(15, filasCrudas.length);
  for (let i = 0; i < limite; i++) {
    const cols = detectarColumnas(filasCrudas[i]);
    const par = buscarParCargoAbono(filasCrudas[i]);
    if (cols.fecha !== null && (cols.monto !== null || par !== null) && (cols.descripcion !== null || cols.tipo !== null)) {
      idxHeaders = i;
      break;
    }
  }
  let headers = filasCrudas[idxHeaders].map((h) => h.trim());
  let filas = filasCrudas.slice(idxHeaders + 1);

  // F9.1 · Filas parejas: exceljs corta las celdas vacías del final
  // (cellCount no cuenta las null) — se rellenan hasta el ancho de
  // los headers para que los índices de columna coincidan siempre.
  const ancho = filas.length > 0 ? Math.max(headers.length, ...filas.map((f) => f.length)) : headers.length;
  filas = filas.map((f) => (f.length >= ancho ? f : [...f, ...Array(ancho - f.length).fill('')]));

  // Cargo/Abono separados → sintetizar "Monto" con signo
  const par = buscarParCargoAbono(headers);
  if (par) {
    headers = [...headers, 'Monto'];
    filas = filas.map((f) => {
      const cargo = parsearMonto(f[par.iCargo] ?? '0');
      const abono = parsearMonto(f[par.iAbono] ?? '0');
      let monto = 0;
      if (abono > 0) monto = abono;
      else if (cargo > 0) monto = -cargo;
      return [...f, monto === 0 ? '0' : String(monto)];
    });
  }
  return { headers, filas };
}

// ── PDF (pdfjs-dist v6, lazy — reconstruye líneas por coordenadas) ──

type ItemTexto = { str: string; x: number; y: number; w: number };

let pdfjsPromesa: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;

/** Carga pdfjs una sola vez. En el navegador usa un Worker real
 *  (bundled offline); en node/smoke sin Worker, pdf.js cae a su
 *  fake worker en el hilo principal — para extractos chicos va
 *  sobrado. */
function cargarPdfjs() {
  if (!pdfjsPromesa) {
    pdfjsPromesa = (async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      if (typeof Worker !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerPort) {
        try {
          const WorkerCls = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker&inline')).default;
          pdfjs.GlobalWorkerOptions.workerPort = new WorkerCls();
        } catch {
          // Sin worker: pdf.js usa su fake worker (hilo principal)
        }
      }
      return pdfjs;
    })();
  }
  return pdfjsPromesa;
}

/** Extrae el monto del FINAL de un texto ("PAGO X -59.90").
 *  Devuelve el monto crudo y el resto (descripción). */
function extraerMontoFinal(s: string): { monto: string; resto: string } | null {
  if (!s) return null;
  const m = s.match(/(?:^|\s)(?:S\/|US\$|PEN)?\s*(-?\(?\d[\d.,]*\)?-?)$/);
  if (!m) return null;
  const monto = m[1].trim();
  if (!/^-?\(?\d[\d.,]*\)?-?$/.test(monto)) return null;
  const n = parsearMonto(monto);
  if (isNaN(n) || n === 0 || Math.abs(n) > 9_999_999) return null; // nº de operación gigante ≠ monto
  let resto = s.slice(0, s.length - m[0].length);
  // La moneda (S/, US$, PEN) ya la consume el regex — acá solo
  // sobran espacios y guiones de relleno al final.
  resto = resto.replace(/[\s\u2013\u2014\-\u2013\u2014]+$/, '').trim();
  return { monto, resto };
}

/** ¿El monto suelto parece monto y no un número de página? */
function esMontoPlausible(m: string): boolean {
  if (/[.,]/.test(m)) return true;
  const n = Math.abs(parsearMonto(m));
  return n >= 100 && n <= 99_999;
}

/** Líneas que no son movimientos: títulos, saldos, folios. */
function esLineaRuido(t: string): boolean {
  if (/^p[áa]gina\s*\d*/i.test(t)) return true;
  if (/^(totales?|saldo|balance)\b/i.test(t)) return true;
  if (/^\d{1,4}$/.test(t)) return true; // nº de página suelto
  if (/fecha/i.test(t) && /(descripci|importe|monto|cargo|abono|concepto|detalle|operaci)/i.test(t)) return true; // encabezado repetido
  if (!/\d/.test(t) && t.length < 45 && /^(bcp|banco)/i.test(t)) return true; // membrete
  if (/^(s\/|us\$|pen)\s*[\d.,()-]+$/i.test(t)) return true; // cifra suelta con moneda (saldos)
  return false;
}

/**
 * Lee un PDF de extracto y reconstruye las filas. Estrategia:
 * pdfjs extrae cada trozo de texto con sus coordenadas → se
 * agrupan por línea (misma y) y se ordenan por x → cada línea que
 * arranca con fecha y termina en monto es un movimiento. Las
 * descripciones que se envuelven en 2 líneas se unen, y los
 * encabezados/saldos/folios repetidos se descartan.
 */
export async function parsearPdf(buffer: ArrayBuffer): Promise<CsvCrudo> {
  const pdfjs = await cargarPdfjs();
  const tarea = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  let doc;
  try {
    doc = await tarea.promise;
  } catch (e: unknown) {
    const nombre = (e as { name?: string })?.name ?? '';
    if (nombre === 'PasswordException') {
      throw new Error('El PDF está protegido con contraseña. Exportalo sin clave desde la web del banco.');
    }
    throw new Error('No se pudo abrir el PDF (¿es un estado de cuenta válido?)');
  }

  const textos: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const items: ItemTexto[] = (tc.items as unknown[]).flatMap((raw) => {
        const it = raw as { str?: string; transform?: number[]; width?: number };
        if (!it.transform || typeof it.str !== 'string' || it.str.trim() === '') return [];
        return [{ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width ?? 0 }];
      });

      // De arriba hacia abajo (y decrece), izquierda→derecha
      items.sort((a, b) => (b.y - a.y) || (a.x - b.x));

      // Agrupar por línea: misma y con tolerancia ±3
      let actual: ItemTexto[] = [];
      let yAncla = Number.NaN;
      const lineas: ItemTexto[][] = [];
      for (const it of items) {
        if (actual.length === 0) {
          actual = [it];
          yAncla = it.y;
        } else if (Math.abs(it.y - yAncla) <= 3) {
          actual.push(it);
        } else {
          lineas.push(actual);
          actual = [it];
          yAncla = it.y;
        }
      }
      if (actual.length) lineas.push(actual);

      // Armar el texto de cada línea (espacio solo si hay hueco real)
      for (const linea of lineas) {
        const orden = [...linea].sort((a, b) => a.x - b.x);
        let texto = '';
        for (let i = 0; i < orden.length; i++) {
          const it = orden[i];
          if (i > 0) {
            const prev = orden[i - 1];
            const anchoChar = prev.w > 0 && prev.str.length > 0 ? prev.w / prev.str.length : 4;
            const hueco = it.x - (prev.x + (prev.w > 0 ? prev.w : 0));
            if (hueco > Math.max(0.3 * anchoChar, 0.8)) texto += ' ';
          }
          texto += it.str;
        }
        const limpio = texto.replace(/\s+/g, ' ').trim();
        if (limpio) textos.push(limpio);
      }
    }
  } finally {
    void tarea.destroy().catch(() => undefined);
  }

  if (textos.length === 0) {
    throw new Error('El PDF no tiene texto extraíble (parece un escaneo o foto). Usá el XLSX o CSV del banco.');
  }

  // ── Heurística por línea: [fecha] descripción [monto al final] ──
  const RE_FECHA_INI = /^(\d{1,2}[/.\-]\d{1,2}(?:[/.\-]\d{2,4})?)(?:\s+|$)/;
  const filas: string[][] = [];
  let pendiente: { fecha: string; desc: string } | null = null;

  for (const t of textos) {
    if (esLineaRuido(t)) continue;
    const mf = t.match(RE_FECHA_INI);
    if (mf) {
      const resto = t.slice(mf[0].length).trim();
      const ext = extraerMontoFinal(resto);
      if (ext) {
        filas.push([mf[1], ext.resto || '(Sin descripción)', ext.monto]);
        pendiente = null;
      } else {
        // Fecha + texto sin monto: descripción que puede continuar abajo
        pendiente = { fecha: mf[1], desc: resto };
      }
    } else if (pendiente) {
      // La 2da línea completa el movimiento: trae el monto al final
      // (solo el monto en la columna derecha, o texto envuelto + monto)
      const ext = extraerMontoFinal(t);
      if (ext && esMontoPlausible(ext.monto)) {
        const desc = `${pendiente.desc} ${ext.resto}`.replace(/\s+/g, ' ').trim();
        filas.push([pendiente.fecha, desc || '(Sin descripción)', ext.monto]);
        pendiente = null;
      } else if (pendiente.desc.length + t.length < 140) {
        pendiente.desc = `${pendiente.desc} ${t}`.replace(/\s+/g, ' ').trim();
      }
    } else if (filas.length > 0 && t.length <= 120 && !extraerMontoFinal(t)) {
      // Continuación de la descripción de la fila anterior
      const prev = filas[filas.length - 1];
      if (prev[1].length + t.length < 160) prev[1] = `${prev[1]} ${t}`.replace(/\s+/g, ' ').trim();
    }
  }

  return { headers: ['Fecha', 'Descripción', 'Monto'], filas };
}
