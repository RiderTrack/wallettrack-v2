// ═══════════════════════════════════════════════════════════
// 🤖 BOT PROACTIVO — WalletTrack V2 (F7 · AVISOS PUSH DEL BOT)
// El WalletBot de F4 era reactivo: vos abrís el chat y él te
// responde. F7 lo hace PROACTIVO: el bot te empuja avisos
// inteligentes solito, sin que abras el chat, con notificaciones
// locales (las mismas de F5 — @capacitor/local-notifications).
//
// FUNCIONAMIENTO:
//   • Reutiliza las 12 reglas del analizarWallet de F4 (no
//     inventa nada nuevo — solo decide CUÁNDO avisar).
//   • Se ejecuta al cambiar el estado (gasto, ingreso, sync,
//     recurrente) con debounce 3s, y al abrir la app.
//   • Filtra por frecuencia (solo-graves / todos / silencioso).
//   • Respeta horario silencioso (no molesta 22:00–7:00).
//   • DEDUPE POR DÍA: si ya te avisó del presupuesto de
//     Alimentación hoy, no te vuelve a avisar hasta mañana.
//   • Persistencia: localStorage wallettrack_v2_prefs (la misma
//     clave de F5) lleva el registro de qué avisos ya mandó hoy.
//   • IDs de notificación en rango 1_900_000_000–1_999_999_999
//     (no choca con los de F5 que usan hash % 2_000_000_000).
//   • En web no hace nada (no hay notificaciones locales).
// ═══════════════════════════════════════════════════════════

import { LocalNotifications } from '@capacitor/local-notifications';
import type { EstadoWallet, PrefsBotProactivo, FrecuenciaBot } from '../types';
import { analizarWallet, type MensajeBot } from './walletbot';
import { esAPK } from './platform';

const CLAVE_PREFS = 'wallettrack_v2_prefs';
const CLAVE_DEDUPE = 'WT2_BOT_DEDUPE'; // { 'YYYY-MM-DD': Set<tipo+clave> }

// Rango de IDs para no chocar con F5 (que usa hash % 2_000_000_000)
const ID_BASE = 1_900_000_000;
const ID_MAX = 1_999_999_999;

// ═══════════════════════════════════════════════════════════
// ⚙️ PREFS — lectura/escritura (misma clave que F5)
// ═══════════════════════════════════════════════════════════

interface PrefsCompletas {
  recordatorios?: boolean;          // F5
  botProactivo?: PrefsBotProactivo; // F7
}

function leerPrefs(): PrefsCompletas {
  try {
    const crudo = localStorage.getItem(CLAVE_PREFS);
    if (!crudo) return {};
    return JSON.parse(crudo) || {};
  } catch { return {}; }
}

function guardarPrefs(p: PrefsCompletas): void {
  try { localStorage.setItem(CLAVE_PREFS, JSON.stringify(p)); } catch { /* sin storage */ }
}

export function leerPrefsBot(): PrefsBotProactivo {
  const p = leerPrefs();
  return p.botProactivo ?? {
    activo: true,
    frecuencia: 'solo-graves',
    horarioSilencioso: true,
  };
}

export function guardarPrefsBot(bot: PrefsBotProactivo): void {
  guardarPrefs({ ...leerPrefs(), botProactivo: bot });
}

export function botProactivoActivo(): boolean {
  return leerPrefsBot().activo;
}

// ═══════════════════════════════════════════════════════════
// 🕐 HORARIO SILENCIOSO — no molesta 22:00–7:00
// ═══════════════════════════════════════════════════════════

function enHorarioSilencioso(): boolean {
  const h = new Date().getHours();
  return h >= 22 || h < 7;
}

// ═══════════════════════════════════════════════════════════
// 🎯 FILTRO POR FRECUENCIA — qué tipos de aviso pasan
// ═══════════════════════════════════════════════════════════

/**
 * Filtra los mensajes del bot según la frecuencia elegida:
 *   - solo-graves: riesgo (score >= 88) + alerta (score >= 85)
 *   - todos: riesgo + alerta + consejo + tendencia + meta (todo salvo logro)
 *   - silencioso: solo riesgo (score >= 88)
 */
function filtrarPorFrecuencia(mensajes: MensajeBot[], freq: FrecuenciaBot): MensajeBot[] {
  return mensajes.filter((m) => {
    if (freq === 'silencioso') return m.type === 'riesgo' && m.score >= 88;
    if (freq === 'solo-graves') return m.type === 'riesgo' || (m.type === 'alerta' && m.score >= 85);
    // 'todos' — todo salvo logros (que son positivos, no requieren aviso)
    return m.type !== 'logro';
  });
}

// ═══════════════════════════════════════════════════════════
// 📮 DEDUPE POR DÍA — no repetir el mismo aviso el mismo día
// ═══════════════════════════════════════════════════════════

/**
 * Clave estable del aviso: tipo + texto sin HTML.
 * Dos avisos del mismo tipo y mismo texto → misma clave → dedupe.
 */
function claveAviso(m: MensajeBot): string {
  const textoLimpio = m.text.replace(/<[^>]*>/g, '').slice(0, 80);
  return `${m.type}|${textoLimpio}`;
}

interface RegistroDedupe {
  [fechaISO: string]: string[]; // lista de claves ya avisadas ese día
}

function leerDedupe(): RegistroDedupe {
  try {
    const crudo = localStorage.getItem(CLAVE_DEDUPE);
    if (!crudo) return {};
    return JSON.parse(crudo) || {};
  } catch { return {}; }
}

function guardarDedupe(reg: RegistroDedupe): void {
  try {
    // Limpiar fechas viejas (solo guardar hoy y ayer por si el día cambió)
    const hoy = hoyISO();
    const ayer = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    const limpio: RegistroDedupe = {};
    if (reg[hoy]) limpio[hoy] = reg[hoy];
    if (reg[ayer]) limpio[ayer] = reg[ayer];
    localStorage.setItem(CLAVE_DEDUPE, JSON.stringify(limpio));
  } catch { /* sin storage */ }
}

function hoyISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** Devuelve los avisos que aún NO fueron enviados hoy */
function filtrarDedupe(mensajes: MensajeBot[]): MensajeBot[] {
  const hoy = hoyISO();
  const reg = leerDedupe();
  const yaAvisadas = reg[hoy] ?? [];
  return mensajes.filter((m) => !yaAvisadas.includes(claveAviso(m)));
}

/** Marca estos avisos como ya enviados hoy */
function marcarAvisados(mensajes: MensajeBot[]): void {
  if (mensajes.length === 0) return;
  const hoy = hoyISO();
  const reg = leerDedupe();
  reg[hoy] = [...new Set([...(reg[hoy] ?? []), ...mensajes.map(claveAviso)])];
  guardarDedupe(reg);
}

// ═══════════════════════════════════════════════════════════
// 🔔 NOTIFICACIONES LOCALES — canal propio del bot
// ═══════════════════════════════════════════════════════════

/** ID estable para una notificación del bot (hash del texto) */
function idNotifBot(m: MensajeBot): number {
  const s = claveAviso(m);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return ID_BASE + (h % (ID_MAX - ID_BASE));
}

/**
 * Cancela SOLO las notificaciones del bot (rango 1_900_000_000+).
 * No toca las de F5 (recordatorios de vencimientos).
 */
async function cancelarNotifsBot(): Promise<void> {
  try {
    const pend = await LocalNotifications.getPending();
    const delBot = pend?.notifications?.filter((n) => n.id >= ID_BASE) ?? [];
    if (delBot.length > 0) {
      await LocalNotifications.cancel({
        notifications: delBot.map((n) => ({ id: n.id })),
      });
    }
  } catch { /* sin pendientes */ }
}

/** Convierte el HTML del bot a texto plano para la notificación */
function htmlAPlainText(html: string): string {
  return html
    .replace(/<strong>/g, '')
    .replace(/<\/strong>/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dispara notificaciones locales inmediatas para los avisos.
 * Solo APK. Devuelve cuántas mandó.
 */
async function dispararNotifs(mensajes: MensajeBot[]): Promise<number> {
  if (!esAPK() || mensajes.length === 0) return 0;
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm?.display === 'prompt') perm = await LocalNotifications.requestPermissions();
    if (perm?.display !== 'granted') return 0;

    const ahora = Date.now();
    const programadas = mensajes.map((m, i) => ({
      id: idNotifBot(m),
      title: `${m.icon} WalletBot`,
      body: htmlAPlainText(m.text),
      schedule: { at: new Date(ahora + 1000 + i * 500), allowWhileIdle: true }, // stagger 500ms
    }));
    await LocalNotifications.schedule({ notifications: programadas });
    return programadas.length;
  } catch {
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════
// 🧠 MOTOR PRINCIPAL — corre el bot y dispara avisos
// ═══════════════════════════════════════════════════════════

export interface ResultadoBotProactivo {
  disparados: number;        // cuántas notificaciones mandó
  avisos: MensajeBot[];      // los avisos que se generaron (para la UI)
  nuevos: MensajeBot[];      // los que se dispararon ahora (no vistos antes)
}

/**
 * Corre el motor del bot proactivo sobre el estado actual.
 *   1. Reutiliza analizarWallet de F4 (las 12 reglas).
 *   2. Filtra por frecuencia (solo-graves / todos / silencioso).
 *   3. Filtra dedupe por día (no repetir el mismo aviso hoy).
 *   4. Respeta horario silencioso (si está ON y es de noche, no dispara).
 *   5. Dispara notificaciones locales (solo APK).
 *   6. Marca los avisos como enviados en el registro de dedupe.
 *
 * Llamarlo mil veces no duplica nada (dedupe por día + IDs estables).
 */
export async function correrBotProactivo(estado: EstadoWallet): Promise<ResultadoBotProactivo> {
  const prefs = leerPrefsBot();
  const vacio: ResultadoBotProactivo = { disparados: 0, avisos: [], nuevos: [] };

  if (!prefs.activo) return vacio;
  if (esAPK() && prefs.horarioSilencioso && enHorarioSilencioso()) {
    // De noche: no disparar notifs, pero igual devolver avisos para la UI
    const todos = analizarWallet(estado);
    const filtrados = filtrarPorFrecuencia(todos, prefs.frecuencia);
    return { disparados: 0, avisos: filtrados, nuevos: [] };
  }

  const todos = analizarWallet(estado);
  const filtrados = filtrarPorFrecuencia(todos, prefs.frecuencia);
  const nuevos = filtrarDedupe(filtrados);

  if (nuevos.length === 0) {
    return { disparados: 0, avisos: filtrados, nuevos: [] };
  }

  const disparados = await dispararNotifs(nuevos);
  if (disparados > 0) marcarAvisados(nuevos);

  return { disparados, avisos: filtrados, nuevos };
}

// ═══════════════════════════════════════════════════════════
// 🧪 PRUEBA — botón de Ajustes para verificar que funciona
// ═══════════════════════════════════════════════════════════

export async function probarBotProactivo(): Promise<boolean> {
  if (!esAPK()) return false;
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm?.display === 'prompt') perm = await LocalNotifications.requestPermissions();
    if (perm?.display !== 'granted') return false;
    await LocalNotifications.schedule({
      notifications: [{
        id: 999_999_007,
        title: '🤖 WalletBot — avisos ON',
        body: 'Así te va a avisar cuando detecte algo importante en tus gastos',
        schedule: { at: new Date(Date.now() + 6000), allowWhileIdle: true },
      }],
    });
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// 📊 DIAGNÓSTICO — para la tarjeta de Ajustes
// ═══════════════════════════════════════════════════════════

export interface DiagnosticoBot {
  activo: boolean;
  frecuencia: FrecuenciaBot;
  horarioSilencioso: boolean;
  enHorarioSilencioso: boolean;
  avisosHoy: number;          // cuántos mandó hoy (del registro dedupe)
  esAPK: boolean;
}

export function diagnosticarBot(): DiagnosticoBot {
  const prefs = leerPrefsBot();
  const reg = leerDedupe();
  const hoy = hoyISO();
  return {
    activo: prefs.activo,
    frecuencia: prefs.frecuencia,
    horarioSilencioso: prefs.horarioSilencioso,
    enHorarioSilencioso: enHorarioSilencioso(),
    avisosHoy: (reg[hoy] ?? []).length,
    esAPK: esAPK(),
  };
}

/** Limpia el registro de dedupe (para el botón "Reiniciar avisos" de Ajustes) */
export function reiniciarDedupe(): void {
  try { localStorage.removeItem(CLAVE_DEDUPE); } catch { /* sin storage */ }
}
