// ═══════════════════════════════════════════════════════════
// 📱 PLATAFORMA — WalletTrack V2 (F0)
// Helper central para saber dónde corre la app (web dev, APK).
// Mismo patrón que FitTrack V2: todas las vistas preguntan aquí.
// ═══════════════════════════════════════════════════════════

import { Capacitor } from '@capacitor/core';

export function esAPK(): boolean {
  return Capacitor.isNativePlatform();
}

export function esWeb(): boolean {
  return !Capacitor.isNativePlatform();
}

export function nombrePlataforma(): string {
  const p = Capacitor.getPlatform();
  if (p === 'android') return 'Android (APK)';
  if (p === 'ios') return 'iOS';
  return 'Web';
}

export function versionApp(): string {
  return 'F7 · Bot Proactivo';
}
