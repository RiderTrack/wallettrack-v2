// ═══════════════════════════════════════════════════════════
// 📥 IMPORTAR CSV — WalletTrack V2 (F9 · EXTRACTOS BANCARIOS)
// Parser CSV genérico que funciona con cualquier extracto bancario
// (BCP, Interbank, BBVA, Yape, Plin) detectando columnas por
// nombre. Sin dependencias externas — el parser está a mano para
// no engordar el APK ni depender de internet.
//
// FLUJO:
//   1. parsearCsv(texto) → { headers, filas } (maneja comas,
//      punto y coma, comillas y saltos de línea).
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
 */
export function detectarColumnas(headers: string[]): ColumnasDetectadas {
  return {
    fecha: buscarColumna(headers, SINONIMOS_FECHA),
    descripcion: buscarColumna(headers, SINONIMOS_DESC),
    monto: buscarColumna(headers, SINONIMOS_MONTO),
    tipo: buscarColumna(headers, SINONIMOS_TIPO),
  };
}

// ── Normalización de fecha y monto ───────────────────────────

/**
 * Normaliza una fecha a 'YYYY-MM-DD'. Acepta:
 *   - DD/MM/YYYY, DD-MM-YYYY
 *   - YYYY-MM-DD
 *   - DD/MM/YY (asume 20YY)
 */
function normalizarFecha(fecha: string): string {
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
 */
function parsearMonto(raw: string): number {
  let s = (raw || '').replace(/[^\d,.\-]/g, ''); // quitar símbolos y letras
  if (s === '' || s === '-' || s === '.') return 0;
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
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
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
