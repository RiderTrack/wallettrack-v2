// ═══════════════════════════════════════════════════════════
// 🔒 SEGURIDAD — WalletTrack V2 (F5 · Candado local)
// Activa la clave reservada del viejo wallettrack_security:
//   • PIN de 4 dígitos → bloquea la app al abrirla y al volver
//     del fondo (teclado propio, vibración al fallar).
//   • Huella (APK): usa el BiometricPrompt nativo vía
//     @capgo/capacitor-native-biometric; si no está disponible
//     o falla, SIEMPRE queda el PIN — la app nunca se traba.
//   • Local por aparato: como el theme del viejo, NO viaja a la
//     nube ni se borra con el reset de datos (cada celu tiene
//     su candado, igual que la clave de bloqueo del teléfono).
// ═══════════════════════════════════════════════════════════

import type { SeguridadWallet } from '../types';
import { CLAVES } from './estado';
import { esAPK } from './platform';

const CLAVE = CLAVES.security; // 'wallettrack_security'

// ── Hash del PIN (djb2 con sal — suficiente para un candado de privacidad de 4 dígitos) ──
const SAL = 'wt2·f5·lock';

function hashPin(pin: string): string {
  let h = 5381;
  const s = `${SAL}${pin}${SAL}`;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return `djb2_${h.toString(16).padStart(8, '0')}`;
}

// ── Lectura/escritura ────────────────────────────────────────
export function leerSeguridad(): SeguridadWallet {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) {
      const s = JSON.parse(crudo);
      return {
        pin: typeof s?.pin === 'string' && s.pin ? s.pin : null,
        huella: s?.huella === true,
      };
    }
  } catch { /* storage corrupto → sin candado */ }
  return { pin: null, huella: false };
}

function guardarSeguridad(seg: SeguridadWallet): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ pin: seg.pin, huella: seg.huella }));
  } catch { /* sin storage */ }
}

// ── PIN ──────────────────────────────────────────────────────
export function pinActivo(): boolean {
  return leerSeguridad().pin != null;
}

export function activarPin(pin: string): { ok: boolean; error?: string } {
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'El PIN son exactamente 4 dígitos' };
  const seg = leerSeguridad();
  guardarSeguridad({ ...seg, pin: hashPin(pin) });
  return { ok: true };
}

export function verificarPin(pin: string): boolean {
  const seg = leerSeguridad();
  return seg.pin != null && hashPin(pin) === seg.pin;
}

/** Pide el PIN actual para poder cambiarlo o quitarlo (nunca sin verificación) */
export function cambiarPin(actual: string, nuevo: string): { ok: boolean; error?: string } {
  if (!verificarPin(actual)) return { ok: false, error: 'PIN actual incorrecto' };
  return activarPin(nuevo);
}

export function quitarPin(actual: string): { ok: boolean; error?: string } {
  if (!verificarPin(actual)) return { ok: false, error: 'PIN incorrecto — el candado se queda' };
  const seg = leerSeguridad();
  guardarSeguridad({ pin: null, huella: false }); // sin PIN tampoco tiene sentido la huella
  void seg;
  return { ok: true };
}

// ── Huella (solo APK) ────────────────────────────────────────
export function huellaHabilitada(): boolean {
  return leerSeguridad().huella && pinActivo();
}

export function alternarHuella(on: boolean): void {
  const seg = leerSeguridad();
  // Solo se puede activar si hay PIN (la huella es atajo del candado, no reemplazo)
  guardarSeguridad({ ...seg, huella: on ? seg.pin != null : false });
}

/** ¿Hay hardware biométrico disponible? (APK únicamente) */
export async function huellaDisponible(): Promise<{ ok: boolean; detalle: string }> {
  if (!esAPK()) return { ok: false, detalle: 'Solo disponible en el APK' };
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
    const res = await NativeBiometric.isAvailable({ useFallback: false });
    if (res?.isAvailable) {
      const tipo = res.biometryType === 2 || res.biometryType === 4
        ? 'huella dactilar' : (res.biometryType === 3 ? 'huella dactilar' : 'biometría');
      return { ok: true, detalle: tipo };
    }
    return { ok: false, detalle: 'Este equipo no tiene huella configurada' };
  } catch {
    return { ok: false, detalle: 'No pude consultar la huella de este equipo' };
  }
}

/** Muestra el diálogo nativo de huella → true si autenticó */
export async function pedirHuella(motivo: string): Promise<boolean> {
  if (!esAPK() || !huellaHabilitada()) return false;
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
    await NativeBiometric.verifyIdentity({
      reason: motivo,
      title: 'WalletTrack bloqueado',
      subtitle: 'Confirma que eres tú',
      description: motivo,
      negativeButtonText: 'Usar PIN',
      maxAttempts: 1,
      useFallback: false,
    });
    return true;
  } catch {
    return false; // canceló o falló → el PIN sigue disponible
  }
}

/** Vibración corta (teclado del candado) — solo APK */
export async function vibrarCorto(): Promise<void> {
  if (!esAPK()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch { /* sin vibración */ }
}
