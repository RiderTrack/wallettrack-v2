// ═══════════════════════════════════════════════════════════
// 🔔 RECORDATORIOS — WalletTrack V2 (F5 · Notificaciones locales)
// Los gastos fijos (suscripciones) y las cuotas de deudas YA
// conocen su vencimiento — F5 los saca de la app: notificación
// local 3 días antes y el mismo día, a las 09:00.
//   • Solo APK (@capacitor/local-notifications); en web no-op.
//   • Se re-agenda solo cada vez que cambian fijos/deudas (o al
//     bajar la nube) — cancela todo y programa de nuevo.
//   • Prefiere avisar HOY+adelante; los vencidos pasados no
//     suenan (el calendario de la app ya los muestra).
//   • On/off por aparato: clave NUEVA wallettrack_v2_prefs (no
//     toca las 19 del viejo ni viaja a la nube).
// ═══════════════════════════════════════════════════════════

import { LocalNotifications } from '@capacitor/local-notifications';
import type { EstadoWallet } from '../types';
import { diasHasta } from './estado';
import { esAPK } from './platform';
import { soles, fechaLarga } from './dinero';

const CLAVE_PREFS = 'wallettrack_v2_prefs';

interface PrefsWallet {
  recordatorios: boolean;   // default ON
}

export function recordatoriosActivos(): boolean {
  try {
    const crudo = localStorage.getItem(CLAVE_PREFS);
    if (!crudo) return true; // default: sí avisar
    const p = JSON.parse(crudo);
    return p?.recordatorios !== false;
  } catch { return true; }
}

export function alternarRecordatorios(on: boolean): void {
  try {
    localStorage.setItem(CLAVE_PREFS, JSON.stringify({ recordatorios: on }));
  } catch { /* sin storage */ }
}

/** Hora a la que suenan: 09:00 del día del aviso */
function aLas9AM(iso: string): Date {
  const d = new Date(`${iso}T00:00:00`);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** Id numérico estable (max 2^31) derivado de la referencia + la fecha */
function idNotif(refId: string, iso: string): number {
  const s = `${refId}|${iso}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 2_000_000_000;
}

interface NotificacionProgramable {
  refId: string;
  titulo: string;
  cuerpo: string;
  fechaISO: string;   // día del vencimiento (la notificación sale 3 días antes o el mismo día)
}

/** Vencimientos de suscripciones (los que vienen, no los ya muertos) */
function avisosSuscripciones(estado: EstadoWallet): NotificacionProgramable[] {
  const out: NotificacionProgramable[] = [];
  for (const sub of estado.subscriptions) {
    const dias = diasHasta(sub.due);
    if (dias < 0 || dias > 62) continue; // vencido hace rato o muy lejano → no molestar
    const emoji = sub.emoji || '🔄';
    out.push({
      refId: `sub_${sub.id}`,
      titulo: `${emoji} ${sub.name} vence`,
      cuerpo: `${fechaLarga(sub.due)} — ${soles(sub.cost)} desde ${sub.cuenta || 'efectivo'}`,
      fechaISO: sub.due,
    });
  }
  return out;
}

/** Próxima cuota de cada deuda viva */
function avisosDeudas(estado: EstadoWallet): NotificacionProgramable[] {
  const out: NotificacionProgramable[] = [];
  for (const d of estado.deudas) {
    if (d.cuotasPagadas >= d.totalCuotas) continue; // ya está pagada
    const dias = diasHasta(d.proximaFecha);
    if (dias < 0 || dias > 62) continue;
    out.push({
      refId: `deu_${d.id}`,
      titulo: `💳 Cuota ${d.cuotaActual}/${d.totalCuotas} — ${d.nombre}`,
      cuerpo: `${fechaLarga(d.proximaFecha)} — ${soles(d.montoCuota)}`,
      fechaISO: d.proximaFecha,
    });
  }
  return out;
}

/**
 * Re-agenda TODOS los recordatorios (cancela lo pendiente y
 * programa de nuevo). Idempotente: llamarlo mil veces lo deja
 * igual. Devuelve cuántos quedaron programados.
 */
export async function reprogramarRecordatorios(estado: EstadoWallet): Promise<number> {
  if (!esAPK() || !recordatoriosActivos()) {
    // apagado o web: cancela lo pendiente para no dejar fantasmas
    if (esAPK()) { try { await cancelarPendientes(); } catch { /* sin permiso */ } }
    return 0;
  }
  try {
    // Permiso (Android 13+ pide una sola vez; si ya lo negó, no molesta)
    let perm = await LocalNotifications.checkPermissions();
    if (perm?.display === 'prompt') {
      perm = await LocalNotifications.requestPermissions();
    }
    if (perm?.display !== 'granted') return 0;

    await cancelarPendientes();

    const notifs = [...avisosSuscripciones(estado), ...avisosDeudas(estado)];
    const ahora = Date.now();
    const programadas: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];
    for (const n of notifs) {
      // Aviso A: 3 días antes · Aviso B: el mismo día
      for (const offset of [3, 0]) {
        const dia = new Date(`${n.fechaISO}T00:00:00`);
        dia.setDate(dia.getDate() - offset);
        const aLas9 = aLas9AM(n.fechaISO);
        const cuando = new Date(aLas9.getTime());
        cuando.setDate(cuando.getDate() - offset);
        if (cuando.getTime() <= ahora) continue; // ya pasó: no suena
        programadas.push({
          id: idNotif(n.refId, `${n.fechaISO}_-${offset}`),
          title: offset === 3 ? `${n.titulo} en 3 días` : n.titulo,
          body: n.cuerpo,
          schedule: { at: cuando, allowWhileIdle: true },
          extra: { refId: n.refId, fecha: n.fechaISO },
        } as typeof programadas[number]);
        void dia;
      }
    }
    if (programadas.length > 0) {
      await LocalNotifications.schedule({ notifications: programadas });
    }
    return programadas.length;
  } catch {
    return 0; // sin permiso o plugin no listo: la app sigue normal
  }
}

/** Botón 🔔 Probar de Ajustes: suena en 6 segundos */
export async function probarNotificacion(): Promise<boolean> {
  if (!esAPK()) return false;
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm?.display === 'prompt') perm = await LocalNotifications.requestPermissions();
    if (perm?.display !== 'granted') return false;
    await LocalNotifications.schedule({
      notifications: [{
        id: 999_999_001,
        title: '🔔 WalletTrack — notificaciones ON',
        body: 'Así te va a avisar cuando un gasto fijo o una cuota venza',
        schedule: { at: new Date(Date.now() + 6000), allowWhileIdle: true },
      }],
    });
    return true;
  } catch {
    return false;
  }
}

async function cancelarPendientes(): Promise<void> {
  try {
    const pend = await LocalNotifications.getPending();
    if (pend?.notifications?.length) {
      await LocalNotifications.cancel({
        notifications: pend.notifications.map((n) => ({ id: n.id })),
      });
    }
  } catch { /* sin pendientes o sin permiso */ }
}
