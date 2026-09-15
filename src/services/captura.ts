// ═══════════════════════════════════════════════════════════
// 🔔 CAPTURA — WalletTrack V2 (F10 · CAPTURA AUTOMÁTICA)
// Lee las notificaciones de las apps bancarias (BCP, Yape,
// Interbank, BBVA, Scotiabank — las que el usuario elija) y las
// convierte en transacciones automáticamente, en segundos.
//
// ARQUITECTURA:
//   • NATIVO (APK): WTNotificationsPlugin.java + WTCaptureService.java
//     (android-native/ en el repo; el CI los copia al proyecto
//     Android que genera con cap add). El service filtra por
//     allowlist EN EL LADO NATIVO — las demás notificaciones del
//     teléfono jamás se leen. Guarda en un buffer local jsonl.
//   • ESTE ARCHIVO: puente + parser + pipeline.
//       - parsearCaptura(): extrae monto (S/, S/., USD, $),
//         dirección (compraste/recibiste/…) y descripción limpia.
//       - procesarCapturas(): convierte capturas en transacciones
//         usando el diccionario de categorías de F9. Modo 'auto'
//         registra directo; modo 'revision' deja en cola para
//         aprobar a mano.
//       - Saldo vivo: saldo inicial + movimientos de esa cuenta
//         desde la fecha que el usuario elija (espejo "en vivo").
//   • PERSISTENCIA: localStorage wallettrack_v2_captura (prefs) y
//     wallettrack_v2_captura_log (log de capturas). NO viaja a la
//     nube (igual que las prefs del bot de F7).
//
// PRIVACÍA: nada sale del teléfono. Sin Firebase. Sin red.
// ═══════════════════════════════════════════════════════════

import type { EstadoWallet, Transaccion } from '../types';
import { CATS_GASTO_DEFAULT, CATS_INGRESO_DEFAULT, detectarCategoria } from '../data/catalogos';
import { leerEstado, persistir, agregarTransaccion } from './estado';
import { esAPK } from './platform';
import { hoyISO, soles } from './dinero';

// ── Tipos ─────────────────────────────────────────────────────

/** Notificación cruda tal como la entrega el lado nativo */
export interface CapturaNotif {
  pkg: string;
  title: string;
  text: string;
  sub?: string;
  ts: number;
}

/** Config del usuario (localStorage, no viaja a la nube) */
export interface PrefsCaptura {
  activo: boolean;                    // master switch
  modo: 'auto' | 'revision';          // registrar directo o pedir revisión
  packages: string[];                 // espejo del allowlist nativo
  cuentasMap: Record<string, string>; // pkg → id de cuenta destino
  saldoVivo: { activo: boolean; cuenta: string; saldoInicial: number; desde: string } | null;
  ultimaRevisada: number;             // ts de la última captura procesada del buffer
  vistos: Record<string, number>;     // id captura → ts (dedupe, cap 300)
}

/** Entrada del log que ve el usuario en Ajustes */
export interface LogCaptura {
  id: string;              // pkg@ts
  ts: number;
  pkg: string;
  title: string;
  text: string;
  estado: 'importada' | 'revision' | 'ignorada';
  parse?: { monto: number; direccion: 'income' | 'expense'; descripcion: string; categoria: string };
  txId?: string;          // id de la transacción creada
}

/** Resultado de parsear una notificación */
export interface ParseCaptura {
  monto: number;
  direccion: 'income' | 'expense';
  descripcion: string;
}

// ── Presets de apps financieras (labels bonitos) ───────────────

export const PRESETS_APPS: { pkg: string; label: string; emoji: string }[] = [
  { pkg: 'com.bcp.bank.bcp', label: 'BCP (Banca Móvil)', emoji: '🏦' },
  { pkg: 'com.bcp.innovacxion.yapeapp', label: 'Yape', emoji: '📲' },
  { pkg: 'pe.com.interbank.mobilebanking', label: 'Interbank', emoji: '🏦' },
  { pkg: 'com.bbva.nxt_peru', label: 'BBVA Perú', emoji: '🏦' },
  { pkg: 'pe.com.scotiabank.blpm.android.client', label: 'Scotiabank Perú', emoji: '🏦' },
];

/** Cuenta destino sugerida según la app que emitió la notificación */
export function cuentaPorDefecto(pkg: string): string {
  switch (pkg) {
    case 'com.bcp.bank.bcp': return 'bcp';
    case 'com.bcp.innovacxion.yapeapp': return 'yape';
    case 'pe.com.interbank.mobilebanking': return 'interbank';
    case 'com.bbva.nxt_peru': return 'bbva';
    default: return 'efectivo';
  }
}

export function labelApp(pkg: string): string {
  return PRESETS_APPS.find((a) => a.pkg === pkg)?.label ?? pkg;
}

// ── Prefs (localStorage, claves NUEVAS — no chocan con nada) ──

const CLAVE_PREFS = 'wallettrack_v2_captura';
const CLAVE_LOG = 'wallettrack_v2_captura_log';

const PREFS_DEFAULT: PrefsCaptura = {
  activo: false,
  modo: 'auto',
  packages: [],
  cuentasMap: {},
  saldoVivo: null,
  ultimaRevisada: 0,
  vistos: {},
};

export function leerPrefsCaptura(): PrefsCaptura {
  try {
    const crudo = localStorage.getItem(CLAVE_PREFS);
    if (!crudo) return { ...PREFS_DEFAULT };
    const p = JSON.parse(crudo) as Partial<PrefsCaptura>;
    return {
      activo: !!p.activo,
      modo: p.modo === 'revision' ? 'revision' : 'auto',
      packages: Array.isArray(p.packages) ? p.packages : [],
      cuentasMap: (p.cuentasMap && typeof p.cuentasMap === 'object') ? p.cuentasMap : {},
      saldoVivo: (p.saldoVivo && typeof p.saldoVivo === 'object')
        ? {
            activo: !!p.saldoVivo.activo,
            cuenta: String(p.saldoVivo.cuenta || 'bcp'),
            saldoInicial: Number(p.saldoVivo.saldoInicial) || 0,
            desde: String(p.saldoVivo.desde || hoyISO()),
          }
        : null,
      ultimaRevisada: Number(p.ultimaRevisada) || 0,
      vistos: (p.vistos && typeof p.vistos === 'object') ? p.vistos : {},
    };
  } catch {
    return { ...PREFS_DEFAULT };
  }
}

export function guardarPrefsCaptura(p: PrefsCaptura): void {
  try {
    // Cap de vistos: conserva los 300 más recientes
    const entradas = Object.entries(p.vistos).sort((a, b) => b[1] - a[1]).slice(0, 300);
    p.vistos = Object.fromEntries(entradas);
    localStorage.setItem(CLAVE_PREFS, JSON.stringify(p));
  } catch { /* storage lleno o no disponible */ }
}

export function leerLogCaptura(): LogCaptura[] {
  try {
    const crudo = localStorage.getItem(CLAVE_LOG);
    if (!crudo) return [];
    const arr = JSON.parse(crudo);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function guardarLogCaptura(log: LogCaptura[]): void {
  try {
    localStorage.setItem(CLAVE_LOG, JSON.stringify(log.slice(0, 60)));
  } catch { /* storage lleno */ }
}

// ── Parser (puro, testeable en node sin Android) ──────────────

/**
 * Monto CON símbolo de moneda — evita falsos positivos con
 * códigos de operación, fechas o teléfonos que las notificaciones
 * suelen traer. Los bancos peruanos siempre usan S/ o USD.
 * Acepta: "S/ 25.50", "S/.25.50", "S/ 1,234.56", "USD 10.00",
 * "$ 9.99", "S/25" (sin decimales).
 */
const RE_MONTO = /(?:S\s*\/\s*\.?\s*|USD\s*|\$\s*)(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i;

export function extraerMonto(texto: string): number | null {
  const m = `${texto}`.match(RE_MONTO);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return n > 0 ? n : null; // monto 0 o negativo no es movimiento
}

/**
 * Palabras de INGRESO (se buscan primero — son más específicas):
 * "Pago recibido" empieza con "pago" pero es ingreso.
 */
const K_INGRESO = [
  'recibiste', 'te yapearon', 'yape recibido', 'abono', 'abonamos', 'abonado',
  'acreditado', 'acreditamos', 'acreditacion', 'acrédito',
  'deposito', 'depósito', 'depositamos', 'depositada',
  'te transfirieron', 'transferencia recibida', 'recarga recibida',
  'reembolso', 'devolucion', 'devolución', 'pago recibido', 'cobraste', 'te pagaron',
];

/** Palabras de GASTO (después de las de ingreso) */
const K_GASTO = [
  'compra', 'compraste', 'compró', 'consumo', 'consumiste', 'consumo con',
  'pago', 'pagaste', 'pagó', 'pagamos', 'gastaste', 'gasto',
  'cargo', 'cargamos', 'retiro', 'retiraste', 'retiramos',
  'yapeaste', 'enviaste', 'enviamos', 'transferiste', 'transferencia enviada',
  'realizaste', 'débito', 'debitamos', 'recarga', 'recargaste',
  'pagar', 'cobra', 'cobramos',
];

export function detectarDireccion(texto: string): 'income' | 'expense' | null {
  const t = `${texto}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Primero ingreso: "Pago recibido S/ 20" → ingreso aunque tenga "pago"
  for (const k of K_INGRESO) {
    if (t.includes(k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) return 'income';
  }
  for (const k of K_GASTO) {
    if (t.includes(k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) return 'expense';
  }
  return null;
}

/** Quita montos, teléfonos, códigos de operación y ruido del texto */
export function limpiarDescripcion(c: CapturaNotif): string {
  let d = `${c.text || ''} ${c.title || ''}`.replace(/\s+/g, ' ').trim();
  d = d.replace(RE_MONTO, ' ');
  d = d.replace(/S\s*\/\s*\.?|USD|(?<!\w)\$(?!\w)/gi, ' ');
  d = d.replace(/\+51[\s\d]{6,}|\b9\d{8}\b/g, ' ');            // teléfonos
  d = d.replace(/\*+[A-Z0-9][A-Z0-9]{2,}/g, ' ');               // códigos *PD8F2
  d = d.replace(/\bPE\b|\bLima\b/gi, ' ');                      // ruido típico
  d = d.replace(/[,;:\-–—·|]+/g, ' ');
  d = d.replace(/\s{2,}/g, ' ').trim();
  d = d.replace(/^[\s.,;:\-]+|[\s.,;:\-]+$/g, '');
  if (d.length > 60) d = `${d.slice(0, 57)}...`;
  return d || `Movimiento ${labelApp(c.pkg)}`;
}

/** Parse completo de una notificación → monto + dirección + descripción */
export function parsearCaptura(c: CapturaNotif): (ParseCaptura & { direccion: 'income' | 'expense' }) | null {
  const bruto = `${c.title || ''} ${c.text || ''} ${c.sub || ''}`.replace(/\s+/g, ' ').trim();
  if (!bruto) return null;
  const monto = extraerMonto(bruto);
  if (monto === null) return null;
  const direccion = detectarDireccion(bruto);
  if (!direccion) return null; // sin dirección clara → revisión
  const descripcion = limpiarDescripcion(c);
  return { monto, direccion, descripcion };
}

/**
 * Categoría para una captura — reutiliza el diccionario de F9.
 * La sugerencia solo vale si es una categoría REAL del tipo
 * correcto (gasto→cats de gasto + Transferencia; ingreso→cats de
 * ingreso). Si no, 'Otros' / 'Ingresos Extra'.
 */
export function categoriaPara(
  direccion: 'income' | 'expense',
  descripcion: string,
  estado: EstadoWallet,
): string {
  const sugerida = detectarCategoria(descripcion);
  const gastos = new Set<string>([
    ...CATS_GASTO_DEFAULT.map((c) => c.nombre),
    ...(estado.categoriasGasto ?? []).map((c) => c.nombre),
    'Transferencia',
  ]);
  const ingresos = new Set<string>([
    ...CATS_INGRESO_DEFAULT.map((c) => c.nombre),
    ...(estado.categoriasIngreso ?? []).map((c) => c.nombre),
  ]);
  if (direccion === 'expense') return gastos.has(sugerida) ? sugerida : 'Otros';
  return ingresos.has(sugerida) ? sugerida : 'Ingresos Extra';
}

// ── Pipeline (puro: capturas → transacciones + log) ───────────

export function idCaptura(c: CapturaNotif): string {
  return `${c.pkg}@${c.ts}`;
}

// Hash de contenido para dedupe de notificaciones duplicadas de
// Android (mismo texto a los pocos segundos). Solo en memoria.
const recientes = new Map<string, number>();
const RECIENTES_MAX = 25;

function esDuplicadaReciente(c: CapturaNotif, parse: { monto: number; direccion: string; descripcion: string }): boolean {
  const clave = `${c.pkg}|${parse.direccion}|${parse.monto}|${parse.descripcion}`;
  const ahora = Date.now();
  const prev = recientes.get(clave);
  if (prev !== undefined && ahora - prev < 120_000) return true; // 2 min
  recientes.set(clave, ahora);
  if (recientes.size > RECIENTES_MAX) {
    const viejas = [...recientes.entries()].sort((a, b) => a[1] - b[1]);
    for (const [k] of viejas.slice(0, recientes.size - RECIENTES_MAX)) recientes.delete(k);
  }
  return false;
}

export interface ResultadoProceso {
  estado: EstadoWallet;
  prefs: PrefsCaptura;
  log: LogCaptura[];
  creadas: { tx: Transaccion; captura: CapturaNotif }[];
  enRevision: number;
}

/**
 * Núcleo del F10: convierte una tanda de capturas en transacciones.
 * - Solo procesa las de packages en la allowlist (por si el
 *   allowlist cambió después de que el nativo guardó el buffer).
 * - Dedupe por id (pkg@ts) y por contenido reciente (2 min).
 * - Modo 'auto' + parse OK → transacción inmediata.
 * - Sin monto/dirección o modo 'revision' → queda en el log con
 *   estado 'revision' para aprobar a mano desde Ajustes.
 * - SIEMPRE avanza prefs.ultimaRevisada (lo procesado no se
 *   re-procesa en el próximo arranque — vive en el log).
 */
export function procesarCapturas(
  capturas: CapturaNotif[],
  estado: EstadoWallet,
  prefs: PrefsCaptura,
): ResultadoProceso {
  const log = leerLogCaptura();
  const logPorId = new Map(log.map((l) => [l.id, l]));
  let est = estado;
  const creadas: { tx: Transaccion; captura: CapturaNotif }[] = [];
  let enRevision = 0;
  let maxTs = prefs.ultimaRevisada;

  const ordenadas = [...capturas].sort((a, b) => a.ts - b.ts);
  for (const c of ordenadas) {
    if (!prefs.activo) break; // apagado → no toca nada (se queda en buffer)
    if (!prefs.packages.includes(c.pkg)) continue; // allowlist cambió
    const id = idCaptura(c);
    if (prefs.vistos[id]) continue;
    if (logPorId.has(id)) continue; // ya la tratamos en su momento

    maxTs = Math.max(maxTs, c.ts);
    prefs.vistos[id] = c.ts;

    const parse = parsearCaptura(c);
    const yaEnLog = logPorId.has(id);

    if (!parse) {
      // Sin monto o sin dirección → cola de revisión con texto crudo
      if (!yaEnLog) {
        log.unshift({ id, ts: c.ts, pkg: c.pkg, title: c.title, text: c.text, estado: 'revision' });
        enRevision++;
      }
      continue;
    }

    if (esDuplicadaReciente(c, parse)) continue; // doble notificación

    const cuenta = prefs.cuentasMap[c.pkg] || cuentaPorDefecto(c.pkg);
    const categoria = categoriaPara(parse.direccion, parse.descripcion, est);

    if (prefs.modo === 'revision') {
      if (!yaEnLog) {
        log.unshift({
          id, ts: c.ts, pkg: c.pkg, title: c.title, text: c.text,
          estado: 'revision',
          parse: { monto: parse.monto, direccion: parse.direccion, descripcion: parse.descripcion, categoria },
        });
        enRevision++;
      }
      continue;
    }

    // Modo auto → transacción directa (id vía agregarTransaccion)
    const nuevoEstado = agregarTransaccion(est, {
      type: parse.direccion,
      monto: parse.monto,
      categoria,
      cuenta,
      fecha: hoyISO(),
      descripcion: parse.descripcion,
    });
    const tx = nuevoEstado.transactions[0];
    est = nuevoEstado;
    creadas.push({ tx, captura: c });
    log.unshift({
      id, ts: c.ts, pkg: c.pkg, title: c.title, text: c.text,
      estado: 'importada',
      parse: { monto: parse.monto, direccion: parse.direccion, descripcion: parse.descripcion, categoria },
      txId: tx.id,
    });
    logPorId.set(id, log[0]);
  }

  prefs.ultimaRevisada = Math.max(prefs.ultimaRevisada, maxTs);
  guardarLogCaptura(log);
  guardarPrefsCaptura(prefs);
  return { estado: est, prefs, log: leerLogCaptura(), creadas, enRevision };
}

/**
 * Procesa una tanda contra el estado ACTUAL de localStorage
 * (para el drenaje del buffer y el evento en vivo). Aplica y
 * devuelve el estado nuevo — null si no cambió nada.
 */
export function procesarYAplicar(
  capturas: CapturaNotif[],
): { estado: EstadoWallet | null; prefs: PrefsCaptura; creadas: { tx: Transaccion; captura: CapturaNotif }[]; enRevision: number } {
  const prefs = leerPrefsCaptura();
  if (!prefs.activo || capturas.length === 0) {
    return { estado: null, prefs, creadas: [], enRevision: 0 };
  }
  const r = procesarCapturas(capturas, leerEstado(), prefs);
  if (r.creadas.length === 0 && r.enRevision === 0) {
    return { estado: null, prefs: r.prefs, creadas: [], enRevision: 0 };
  }
  persistir(r.estado);
  return { estado: r.estado, prefs: r.prefs, creadas: r.creadas, enRevision: r.enRevision };
}

/** Toast amigable con lo que acaba de capturar */
export function mensajeCapturas(creadas: { tx: Transaccion }[], enRevision: number): string {
  const partes: string[] = [];
  if (creadas.length === 1) {
    const t = creadas[0].tx;
    partes.push(`🔔 ${t.type === 'income' ? '+' : '−'}${soles(t.amount)} · ${t.description}`);
  } else if (creadas.length > 1) {
    partes.push(`🔔 ${creadas.length} movimientos capturados`);
  }
  if (enRevision > 0) {
    partes.push(`${enRevision} para revisar (Ajustes)`);
  }
  return partes.join(' · ') || '🔔 Captura procesada';
}

// ── Revisión manual (botones de la tarjeta de Ajustes) ────────

/** Crea la transacción de una captura que quedó en revisión */
export function resolverRevisionComoImportada(
  idLog: string,
  estado: EstadoWallet,
  cambios?: { categoria?: string; monto?: number },
): { estado: EstadoWallet; ok: boolean; error?: string } {
  const log = leerLogCaptura();
  const idx = log.findIndex((l) => l.id === idLog);
  if (idx < 0) return { estado, ok: false, error: 'Captura no encontrada' };
  const l = log[idx];
  const prefs = leerPrefsCaptura();
  const parse = l.parse ?? { monto: extraerMonto(`${l.title} ${l.text}`) ?? 0, direccion: 'expense' as const, descripcion: limpiarDescripcion(l) };
  const monto = cambios?.monto ?? parse.monto;
  const categoria = cambios?.categoria ?? (l.parse?.categoria ?? categoriaPara(parse.direccion, parse.descripcion, estado));
  const cuenta = prefs.cuentasMap[l.pkg] || cuentaPorDefecto(l.pkg);
  const nuevoEstado = agregarTransaccion(estado, {
    type: parse.direccion,
    monto,
    categoria,
    cuenta,
    fecha: hoyISO(),
    descripcion: parse.descripcion,
  });
  const tx = nuevoEstado.transactions[0];
  log[idx] = { ...l, estado: 'importada', parse: { ...parse, monto, categoria }, txId: tx.id };
  guardarLogCaptura(log);
  return { estado: nuevoEstado, ok: true };
}

/** Marca una captura en revisión como ignorada */
export function ignorarRevision(idLog: string): void {
  const log = leerLogCaptura().map((l) => (l.id === idLog ? { ...l, estado: 'ignorada' as const } : l));
  guardarLogCaptura(log);
}

// ── Saldo vivo ─────────────────────────────────────────────────

/**
 * Espejo del saldo de una cuenta: saldo inicial + TODOS los
 * movimientos de esa cuenta desde la fecha que el usuario marcó
 * (manuales, importados del banco y capturados por notificaciones).
 */
export function calcularSaldoVivo(estado: EstadoWallet, sv: { cuenta: string; saldoInicial: number; desde: string }): number {
  let saldo = sv.saldoInicial;
  for (const t of estado.transactions) {
    if (t.account !== sv.cuenta) continue;
    if (!t.date || t.date < sv.desde) continue;
    const monto = Number(t.amount) || 0;
    saldo += t.type === 'income' ? monto : -monto;
  }
  return saldo;
}

// ── Puente nativo (lazy — en web nunca se carga) ──────────────

interface PluginWTNotifications {
  checkAccess(): Promise<{ granted: boolean }>;
  openAccessSettings(): Promise<void>;
  setConfig(options: { packages: string[] }): Promise<unknown>;
  getConfig(): Promise<{ packages: string[] }>;
  getBuffer(options: { since: number }): Promise<{ captures: CapturaNotif[] }>;
  clearBuffer(): Promise<void>;
  addTestCapture(options: { pkg?: string; title?: string; text?: string }): Promise<void>;
  listFinanceApps(): Promise<{ apps: { pkg: string; label: string }[] }>;
  addListener(eventName: 'wtCapture', listenerFunc: (captura: CapturaNotif) => void): Promise<{ remove: () => Promise<void> }>;
}

let pluginCache: PluginWTNotifications | null = null;
async function getPlugin(): Promise<PluginWTNotifications> {
  if (pluginCache) return pluginCache;
  const { registerPlugin } = await import('@capacitor/core');
  pluginCache = registerPlugin<PluginWTNotifications>('WTNotifications');
  return pluginCache;
}

export async function checkAccesoNotificaciones(): Promise<boolean> {
  if (!esAPK()) return false;
  try {
    return (await (await getPlugin()).checkAccess()).granted;
  } catch {
    return false;
  }
}

export async function abrirAjustesNotificaciones(): Promise<void> {
  if (!esAPK()) return;
  await (await getPlugin()).openAccessSettings();
}

export async function guardarAllowlistNativo(packages: string[]): Promise<void> {
  if (!esAPK()) return;
  await (await getPlugin()).setConfig({ packages });
}

export async function leerBufferNativo(since: number): Promise<CapturaNotif[]> {
  if (!esAPK()) return [];
  try {
    const r = await (await getPlugin()).getBuffer({ since });
    return Array.isArray(r.captures) ? r.captures : [];
  } catch {
    return [];
  }
}

export async function limpiarBufferNativo(): Promise<void> {
  if (!esAPK()) return;
  try {
    await (await getPlugin()).clearBuffer();
  } catch { /* sin acceso */ }
}

export async function probarCaptura(pkg: string, title: string, text: string): Promise<void> {
  if (!esAPK()) return;
  await (await getPlugin()).addTestCapture({ pkg, title, text });
}

export async function appsFinancierasInstaladas(): Promise<{ pkg: string; label: string }[]> {
  if (!esAPK()) return [];
  try {
    const r = await (await getPlugin()).listFinanceApps();
    return Array.isArray(r.apps) ? r.apps : [];
  } catch {
    return [];
  }
}

// ── Arranque del F10 (App.tsx, solo APK) ───────────────────────

/**
 * Drena el buffer nativo (capturas que llegaron con la app
 * cerrada) y se suscribe al evento en vivo wtCapture. Devuelve
 * el cleanup para React.
 */
export async function iniciarCaptura(
  alAplicar: (e: EstadoWallet) => void,
  alToast: (msg: string) => void,
): Promise<() => void> {
  if (!esAPK()) return () => undefined;

  const prefs = leerPrefsCaptura();
  if (!prefs.activo) return () => undefined;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let ocupado = false;

  const procesar = (capturas: CapturaNotif[]) => {
    if (ocupado || capturas.length === 0) return;
    ocupado = true;
    try {
      const r = procesarYAplicar(capturas);
      if (r.estado) alAplicar(r.estado);
      if (r.creadas.length > 0 || r.enRevision > 0) {
        alToast(mensajeCapturas(r.creadas, r.enRevision));
      }
    } catch { /* nunca rompe la app por una captura */ }
    finally { ocupado = false; }
  };

  const drenar = async () => {
    const p = leerPrefsCaptura();
    if (!p.activo) return;
    const capturas = await leerBufferNativo(p.ultimaRevisada);
    procesar(capturas);
  };

  // 1) Drenaje inicial (capturas de cuando la app estaba cerrada)
  timer = setTimeout(() => { void drenar(); }, 1200);

  // 2) Evento en vivo (notificación → transacción en segundos)
  let handle: { remove: () => Promise<void> } | null = null;
  try {
    const plugin = await getPlugin();
    const h = await plugin.addListener('wtCapture', (c: CapturaNotif) => procesar([c]));
    handle = { remove: () => h.remove() };
  } catch { /* sin listener — queda el drenaje */ }

  // 3) Al volver al frente: re-drenar (por si se perdió un evento)
  const alVisible = () => {
    if (document.visibilityState === 'visible') void drenar();
  };
  document.addEventListener('visibilitychange', alVisible);

  return () => {
    if (timer) clearTimeout(timer);
    document.removeEventListener('visibilitychange', alVisible);
    if (handle) void handle.remove().catch(() => undefined);
  };
}
