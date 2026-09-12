// ═══════════════════════════════════════════════════════════
// ☁️ SYNC — WalletTrack V2 (F1 · Respaldo en la nube)
// Patrón del FitTrack V2 (F8) adaptado al WalletTrack: TODO tu
// dinero (transacciones, saldos, sobres, deudas, presupuestos,
// metas, categorías y gastos rápidos) respaldado en Firestore,
// en TU cuenta Google — un solo documento por usuario:
// wallettrack_sync/{uid} (colección propia, sin tocar FitTrack).
//   • CUÁNDO sincroniza: al iniciar sesión (baja+combina+sube),
//     al volver al frente la app, cada 5 min, y 8 s después de
//     cada cambio local (debounce — estado.ts avisa por
//     alPersistir).
//   • CÓMO combina (merge sin borrar): TODAS las listas se unen
//     por id (los ids son anti-colisión), saldos iniciales y
//     tarjetas custom por clave de cuenta (si ambos lados la
//     tienen, gana el más reciente; si un solo lado, sobrevive);
//     la lista de compras activa une items y gana la más nueva.
//     Borrar en un teléfono NO se replica — "Subir todo" manda.
//   • NO se sube: nada — el estado del WalletTrack no tiene
//     claves ni tokens (las preferencias del viejo theme/security
//     ni siquiera forman parte del estado sincronizado).
//   • Si la nube rechaza (reglas Firestore) o no hay internet, la
//     app sigue 100 % local: la tarjeta de Ajustes muestra el
//     error y nada del flujo de dinero se rompe.
// ═══════════════════════════════════════════════════════════

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { versionApp } from './platform';
import { alPersistir, leerEstado, persistirSilencioso } from './estado';
import type { EstadoWallet, ItemCompra, Transaccion } from '../types';

/** Firestore: un doc por usuario con TODO su dinero */
const RUTA_SYNC = 'wallettrack_sync';
/** Clave nueva v2 (no choca con las 19 del viejo) */
const CLAVE_META = 'WT2_SYNC_META';
/** 8 s de debounce tras un cambio (ni cada gasto rápido, ni nunca) */
const RETARDO_SUBIDA_MS = 8_000;
/** Cada 5 min con la app abierta y sesión iniciada */
const INTERVALO_MS = 5 * 60_000;
/** Firestore rechaza docs > 1 MiB — margen de aviso */
const PESO_MAX = 900_000;

// ═══════════════════════════════════════════════════════════
// 📦 PAYLOAD — lo que viaja a la nube
// ═══════════════════════════════════════════════════════════

export interface SyncPayload {
  modificado: number;        // epoch ms del último cambio local
  subidoEn: number;          // epoch ms de la última subida
  versionApp: string;        // fase que escribió la nube
  estado: EstadoWallet;      // las 18 claves de datos del viejo
}

export interface ResultadoSync {
  ok: boolean;
  error?: string;
}

function ls(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/** Arma el payload con lo que hay AHORA en el teléfono */
function armarPayload(modificado: number): SyncPayload {
  return {
    modificado,
    subidoEn: Date.now(),
    versionApp: versionApp(),
    estado: leerEstado(),
  };
}

/** Firestore no acepta undefined en los docs — se limpia con JSON */
function limpiar(payload: SyncPayload): SyncPayload {
  return JSON.parse(JSON.stringify(payload)) as SyncPayload;
}

// ═══════════════════════════════════════════════════════════
// 🧲 MERGE — combinar local + nube SIN borrar nada
// (funciones puras y exportadas: las prueba el smoke F1)
// ═══════════════════════════════════════════════════════════

/** Une dos listas por id: nada se pisa salvo el mismo id */
function unirPorId<T extends { id: string }>(
  local: T[] | undefined,
  remoto: T[] | undefined,
  remotoGana: boolean,
): T[] {
  const mapa = new Map<string, T>();
  for (const item of local ?? []) mapa.set(String(item.id), item);
  for (const item of remoto ?? []) {
    const k = String(item.id);
    if (!mapa.has(k) || remotoGana) mapa.set(k, item);
  }
  return Array.from(mapa.values());
}

/**
 * Saldos iniciales / tarjetas custom (objetos por clave de
 * cuenta): si ambos lados la tienen gana el más reciente; si
 * un solo lado la tiene, sobrevive (ausencia = nunca se
 * configuró, no un borrado).
 */
function combinarObjetos<T>(
  local: Record<string, T> | undefined,
  remoto: Record<string, T> | undefined,
  remotoGana: boolean,
): Record<string, T> {
  const out: Record<string, T> = { ...(local ?? {}) };
  for (const [k, v] of Object.entries(remoto ?? {})) {
    if (!(k in out) || remotoGana) out[k] = v;
  }
  return out;
}

/** Lista de compras activa: une items por id, gana la más nueva (F3: items tipados — misma forma de datos) */
function combinarListaCompras(
  local: EstadoWallet['listaCompras'],
  remoto: EstadoWallet['listaCompras'],
  remotoGana: boolean,
): EstadoWallet['listaCompras'] {
  const items = unirPorId<ItemCompra>(
    local?.items ?? [], remoto?.items ?? [], remotoGana,
  );
  return { items, creada: remotoGana ? (remoto?.creada ?? null) : (local?.creada ?? null) };
}

/**
 * Combina dos estados completos: listas por unión de id y los
 * objetos por clave de cuenta. `remotoMasNuevo` decide quién
 * gana los empates (mismo reloj: gana el local, que ya está
 * en uso).
 */
export function combinarEstados(
  local: EstadoWallet,
  remoto: EstadoWallet,
  remotoMasNuevo: boolean,
): EstadoWallet {
  return {
    transactions: unirPorId<Transaccion>(local.transactions, remoto.transactions, remotoMasNuevo),
    goals: unirPorId(local.goals, remoto.goals, remotoMasNuevo),
    subscriptions: unirPorId(local.subscriptions, remoto.subscriptions, remotoMasNuevo),
    challenges: unirPorId(local.challenges, remoto.challenges, remotoMasNuevo),
    saldosIniciales: combinarObjetos(local.saldosIniciales, remoto.saldosIniciales, remotoMasNuevo),
    cardCustom: combinarObjetos(local.cardCustom, remoto.cardCustom, remotoMasNuevo),
    budgets: unirPorId(local.budgets, remoto.budgets, remotoMasNuevo),
    categoriasGasto: unirPorId(local.categoriasGasto, remoto.categoriasGasto, remotoMasNuevo),
    categoriasIngreso: unirPorId(local.categoriasIngreso, remoto.categoriasIngreso, remotoMasNuevo),
    sobres: unirPorId(local.sobres, remoto.sobres, remotoMasNuevo),
    sobreMovs: unirPorId(local.sobreMovs, remoto.sobreMovs, remotoMasNuevo),
    deudas: unirPorId(local.deudas, remoto.deudas, remotoMasNuevo),
    deudaMovs: unirPorId(local.deudaMovs, remoto.deudaMovs, remotoMasNuevo),
    productos: unirPorId(local.productos, remoto.productos, remotoMasNuevo),
    listaCompras: combinarListaCompras(local.listaCompras, remoto.listaCompras, remotoMasNuevo),
    comprasHist: unirPorId(local.comprasHist, remoto.comprasHist, remotoMasNuevo),
    gastosRapidos: unirPorId(local.gastosRapidos, remoto.gastosRapidos, remotoMasNuevo),
  };
}

// ═══════════════════════════════════════════════════════════
// 🕐 META — reloj local (WT2_SYNC_META, aparte del estado)
// ═══════════════════════════════════════════════════════════

interface MetaSync {
  modificado: number;    // último cambio local
  ultimaSubida: number;  // última subida exitosa
  ultimaBajada: number;  // última bajada exitosa
}

function leerMeta(): MetaSync {
  try {
    const crudo = ls()?.getItem(CLAVE_META);
    if (crudo) {
      const m = JSON.parse(crudo);
      return {
        modificado: Number(m?.modificado ?? 0),
        ultimaSubida: Number(m?.ultimaSubida ?? 0),
        ultimaBajada: Number(m?.ultimaBajada ?? 0),
      };
    }
  } catch { /* meta corrupta → reloj nuevo */ }
  return { modificado: 0, ultimaSubida: 0, ultimaBajada: 0 };
}

function guardarMeta(m: MetaSync) {
  try { ls()?.setItem(CLAVE_META, JSON.stringify(m)); } catch { /* sin espacio */ }
}

// ═══════════════════════════════════════════════════════════
// 📡 ESTADO PARA LA UI (Ajustes se suscribe aquí)
// ═══════════════════════════════════════════════════════════

export interface EstadoSyncUI {
  activo: boolean;             // sesión iniciada (hay uid)
  sincronizando: boolean;      // hay una sync en vuelo
  pendiente: boolean;          // cambios locales sin subir
  ultimaSubida: number | null;
  ultimaBajada: number | null;
  error: string | null;
}

let _uid: string | null = null;
let _enVuelo = false;
let _reintentar = false;
let _error: string | null = null;
let _alCambiarRemoto: (() => void) | null = null;
let _timerSubida: ReturnType<typeof setTimeout> | null = null;
let _timerPeriodico: ReturnType<typeof setInterval> | null = null;

const _oyentes = new Set<(e: EstadoSyncUI) => void>();

export function snapshotSync(): EstadoSyncUI {
  const m = leerMeta();
  return {
    activo: _uid != null,
    sincronizando: _enVuelo,
    pendiente: !!_uid && m.modificado > m.ultimaSubida,
    ultimaSubida: m.ultimaSubida > 0 ? m.ultimaSubida : null,
    ultimaBajada: m.ultimaBajada > 0 ? m.ultimaBajada : null,
    error: _error,
  };
}

/** La tarjeta de Sincronización de Ajustes se entera de todo */
export function suscribirSync(cb: (e: EstadoSyncUI) => void): () => void {
  _oyentes.add(cb);
  cb(snapshotSync()); // estado inmediato
  return () => { _oyentes.delete(cb); };
}

function emitir() {
  const snap = snapshotSync();
  _oyentes.forEach((cb) => { try { cb(snap); } catch { /* oyente desmontado */ } });
}

// ═══════════════════════════════════════════════════════════
// ⚠️ ERRORES — nunca rompen la app, se explican solos
// ═══════════════════════════════════════════════════════════

function mensajeError(e: unknown): string {
  const code = String((e as { code?: unknown })?.code ?? '');
  const msg = e instanceof Error ? e.message : String(e ?? '');
  if (code.includes('permission-denied')) {
    return 'La nube rechazó la conexión — falta la regla wallettrack_sync en Firestore (paso 3 del LEEME)';
  }
  if (code.includes('unavailable') || code.includes('failed-precondition') || /network|offline/i.test(msg)) {
    return 'Sin conexión con la nube — reintenta cuando haya internet';
  }
  if (e instanceof Error && e.message === 'peso') {
    return 'Tus datos pesan más de 1 MB — el respaldo JSON local los cubre';
  }
  return 'No se pudo conectar con la nube — reintenta más tarde';
}

// ═══════════════════════════════════════════════════════════
// 🔄 MOTOR — bajar · combinar · subir (una sola vez en vuelo)
// ═══════════════════════════════════════════════════════════

/** Baja + combina + aplica local + sube el resultado (convergente) */
export async function sincronizarAhora(): Promise<ResultadoSync> {
  const uid = _uid;
  if (!uid) return { ok: false, error: 'sin-sesion' };
  if (_enVuelo) { _reintentar = true; return { ok: true }; }
  _enVuelo = true;
  _error = null;
  emitir();
  try {
    if (!db) throw new Error('Firebase no disponible');
    const refDoc = doc(db, RUTA_SYNC, uid);
    const snap = await getDoc(refDoc);
    const remoto = snap.exists() ? (snap.data() as Partial<SyncPayload>) : null;

    const meta = leerMeta();
    const localP = armarPayload(meta.modificado);
    let payloadFinal: SyncPayload;
    let huboBajada = false;

    if (remoto?.estado) {
      // Combinar: la nube trae cosas → merge sin borrar + aplicar
      const remotoMasNuevo = Number(remoto.modificado ?? 0) > meta.modificado;
      const combinado = combinarEstados(localP.estado, remoto.estado as EstadoWallet, remotoMasNuevo);
      payloadFinal = {
        modificado: Math.max(meta.modificado, Number(remoto.modificado ?? 0)),
        subidoEn: Date.now(),
        versionApp: versionApp(),
        estado: combinado,
      };
      persistirSilencioso(combinado); // silencioso: sin debounce
      guardarMeta({ ...leerMeta(), ultimaBajada: Date.now() });
      huboBajada = true;
      _alCambiarRemoto?.(); // App relee el estado
    } else {
      // Nada en la nube: sube lo local tal cual
      payloadFinal = localP;
    }

    const limpio = limpiar(payloadFinal);
    if (JSON.stringify(limpio).length > PESO_MAX) throw new Error('peso');
    await setDoc(refDoc, limpio);
    guardarMeta({
      modificado: payloadFinal.modificado,
      ultimaSubida: Date.now(),
      ultimaBajada: huboBajada ? leerMeta().ultimaBajada : leerMeta().ultimaBajada,
    });
    if (_timerSubida) { clearTimeout(_timerSubida); _timerSubida = null; }
    return { ok: true };
  } catch (e) {
    _error = mensajeError(e);
    return { ok: false, error: _error };
  } finally {
    _enVuelo = false;
    emitir();
    if (_reintentar) { _reintentar = false; void sincronizarAhora(); }
  }
}

/** Cambio local (avisa estado.ts): marcar el reloj y programar subida */
export function notificarCambioLocal() {
  const m = leerMeta();
  guardarMeta({ ...m, modificado: Date.now() });
  if (!_uid) { emitir(); return; } // sin sesión: solo el reloj
  if (_timerSubida) clearTimeout(_timerSubida);
  _timerSubida = setTimeout(() => {
    _timerSubida = null;
    void sincronizarAhora();
  }, RETARDO_SUBIDA_MS);
  emitir();
}

/** Baja la nube y REEMPLAZA este teléfono (recuperar / nuevo celu) */
export async function restaurarDesdeNube(): Promise<ResultadoSync> {
  const uid = _uid;
  if (!uid) return { ok: false, error: 'sin-sesion' };
  _enVuelo = true;
  _error = null;
  emitir();
  try {
    if (!db) throw new Error('Firebase no disponible');
    const snap = await getDoc(doc(db, RUTA_SYNC, uid));
    if (!snap.exists()) return { ok: false, error: 'Todavía no hay nada en tu nube' };
    const remoto = snap.data() as Partial<SyncPayload>;
    if (!remoto?.estado) return { ok: false, error: 'La nube no tiene datos legibles' };
    persistirSilencioso(remoto.estado as EstadoWallet);
    guardarMeta({ ...leerMeta(), ultimaBajada: Date.now() });
    _alCambiarRemoto?.();
    return { ok: true };
  } catch (e) {
    _error = mensajeError(e);
    return { ok: false, error: _error };
  } finally {
    _enVuelo = false;
    emitir();
  }
}

/** Sube TODO lo de este teléfono y REEMPLAZA la nube (tras un reset) */
export async function subirTodoALaNube(): Promise<ResultadoSync> {
  const uid = _uid;
  if (!uid) return { ok: false, error: 'sin-sesion' };
  _enVuelo = true;
  _error = null;
  emitir();
  try {
    if (!db) throw new Error('Firebase no disponible');
    const payload = limpiar(armarPayload(Date.now()));
    if (JSON.stringify(payload).length > PESO_MAX) throw new Error('peso');
    await setDoc(doc(db, RUTA_SYNC, uid), payload);
    guardarMeta({ modificado: payload.modificado, ultimaSubida: Date.now(), ultimaBajada: leerMeta().ultimaBajada });
    return { ok: true };
  } catch (e) {
    _error = mensajeError(e);
    return { ok: false, error: _error };
  } finally {
    _enVuelo = false;
    emitir();
  }
}

// ═══════════════════════════════════════════════════════════
// 🚀 ARRANQUE — App lo cablea: uid cambia → sync nueva
// ═══════════════════════════════════════════════════════════

export interface OpcionesInitSync {
  uid: string | null;
  alCambiarEstadoRemoto: () => void;
}

function alVolverAlFrente() {
  try {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void sincronizarAhora();
    }
  } catch { /* sin DOM */ }
}

function programar(uid: string | null) {
  if (_uid === uid) return;
  _uid = uid;
  if (_timerSubida) { clearTimeout(_timerSubida); _timerSubida = null; }
  if (_timerPeriodico) { clearInterval(_timerPeriodico); _timerPeriodico = null; }
  if (typeof document !== 'undefined') {
    try { document.removeEventListener('visibilitychange', alVolverAlFrente); } catch { /* sin DOM */ }
  }
  if (uid) {
    void sincronizarAhora();                       // al entrar (login o arranque)
    _timerPeriodico = setInterval(() => void sincronizarAhora(), INTERVALO_MS);
    if (typeof document !== 'undefined') {
      try { document.addEventListener('visibilitychange', alVolverAlFrente); } catch { /* sin DOM */ }
    }
  }
  emitir();
}

/**
 * Inicializa el motor. App pasa el uid (null en modo local/sin
 * sesión) y un callback para re-leer el estado tras aplicar
 * datos de la nube. Devuelve la función de limpieza.
 */
export function initSync(opts: OpcionesInitSync): () => void {
  _alCambiarRemoto = opts.alCambiarEstadoRemoto;
  // estado.ts avisa de CADA persistir()
  alPersistir(() => notificarCambioLocal());
  programar(opts.uid);
  return () => {
    alPersistir(null);
    programar(null);
    _alCambiarRemoto = null;
  };
}
