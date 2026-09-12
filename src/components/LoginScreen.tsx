// ═══════════════════════════════════════════════════════════
// 📱 LOGIN SCREEN — WalletTrack V2 (F1 · ACCESO)
// Login Google REAL: popup en web (Firebase signInWithPopup) y
// flujo nativo en el APK (Capacitor GoogleAuth + credential),
// igual que FitTrack V2. Además: modo LOCAL — entrar sin cuenta
// con las mismas claves del WalletTrack original (la app nunca
// se bloquea; con Google el respaldo en la nube se conecta solo).
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Wallet, Loader2 } from 'lucide-react';
import { loginConGoogleWeb, loginConGoogleAPK } from '../services/firebase';

interface LoginScreenProps {
  /** Entrar sin cuenta Google: 100 % local, como el F0 */
  onEntrarLocal?: () => void;
}

// Códigos del plugin GoogleAuth de Android → mensajes claros (patrón FitTrack)
const interpretarError = (code: string, msg: string): string => {
  const m = msg.toLowerCase();
  if (code === '10' || m.includes('developer_error'))
    return 'Falta registrar la app en Firebase (paso del LEEME: SHA-1 + com.wallettrack.app).';
  if (code === '12500') return 'Configuración OAuth rechazada por Google.';
  if (code === '12501' || m.includes('cancel')) return 'Inicio de sesión cancelado.';
  if (code === '7') return 'Sin conexión a internet.';
  if (code === '4') return 'Necesitas una cuenta Google activa en el dispositivo.';
  if (code === '12502') return 'Ya hay un login en progreso. Espera un momento.';
  if (m.includes('something went wrong')) return 'Google rechazó la configuración OAuth.';
  if (m.includes('not implemented')) return 'Plugin nativo no disponible.';
  if (m.includes('popup') && m.includes('closed')) return 'Ventana de Google cerrada antes de terminar.';
  if (m.includes('popup') && m.includes('blocked')) return 'Tu navegador bloqueó la ventana de Google. Permite popups y reintenta.';
  if (m.includes('unauthorized-domain')) return 'Este dominio no está autorizado en Firebase. Entra desde el APK o desde localhost.';
  if (m.includes('network')) return 'Sin conexión a internet.';
  return 'No se pudo iniciar sesión con Google. Intenta de nuevo.';
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ onEntrarLocal }) => {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // Login con Google (web popup o APK nativo) — patrón FitTrack V2
  const handleGoogleLogin = async () => {
    setCargando(true);
    setError('');
    try {
      if (Capacitor.isNativePlatform()) {
        // APK: plugin GoogleAuth → idToken → credential de Firebase
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        try { await GoogleAuth.signOut(); } catch { /* sin sesión previa: fuerza selector */ }
        const googleUser = await GoogleAuth.signIn();
        const result = await loginConGoogleAPK(googleUser);
        if (!result.success) throw new Error(result.error);
      } else {
        // Web: popup de Firebase
        const result = await loginConGoogleWeb();
        if (!result.success) throw new Error(result.error);
      }
      // El shell aparece solo: onAuthStateChanged (en App) detecta la sesión.
    } catch (e: any) {
      const code = e?.code !== undefined && e?.code !== null ? String(e.code) : '—';
      const rawMsg = String(e?.message ?? JSON.stringify(e ?? e));
      setError(interpretarError(code, rawMsg));
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 overflow-y-auto">
      {/* Fondo con gradiente (patrón FitTrack, acento dinero) */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-slate-950 to-teal-900/20" />

      {/* Contenedor del login */}
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-2xl">
            <Wallet className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mb-1">WalletTrack</h1>
          <p className="text-slate-400 text-sm">Tu dinero, ahora modular</p>
        </div>

        {/* Tarjeta */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-white">Bienvenido, jefe</h2>
            <p className="text-xs text-slate-400 mt-1">
              Con tu cuenta Google tus finanzas se respaldan solas en la nube
            </p>
          </div>

          {/* Botón Google (login real F1) */}
          <button
            onClick={handleGoogleLogin}
            disabled={cargando}
            data-testid="boton-google"
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-100 transition-all active:scale-[0.98] shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {cargando ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {cargando ? 'Conectando...' : 'Continuar con Google'}
          </button>

          {/* Error amigable (códigos Google traducidos) */}
          {error && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs leading-relaxed break-words">
              {error}
            </div>
          )}

          {/* Modo local: entrar sin cuenta (como el F0, datos en este dispositivo) */}
          <button
            onClick={onEntrarLocal}
            data-testid="boton-local"
            className="mt-4 w-full text-center text-xs text-slate-400 hover:text-emerald-300 transition-colors"
          >
            Continuar sin cuenta (solo en este dispositivo) →
          </button>

          {/* Pie */}
          <div className="mt-6 pt-4 border-t border-slate-700/50 text-center">
            <span className="text-[10px] font-mono text-emerald-400/70 tracking-wider">
              V2.1 · FASE 1 · ACCESO
            </span>
          </div>
        </div>

        {/* Nota de datos */}
        <p className="text-center text-[11px] text-slate-500 mt-4 leading-relaxed max-w-xs mx-auto">
          Tus datos viven en este dispositivo con las mismas claves del WalletTrack
          original: se conservan al actualizar. Con tu cuenta Google se respaldan
          además en la nube.
        </p>
      </div>
    </div>
  );
};
