// ═══════════════════════════════════════════════════════════
// 🔐 HOOK useAuth — WalletTrack V2 (F1 · Acceso)
// Patrón FitTrack/RiderTrack V2: al entrar sesión, cachea la
// cuenta en la clave NUEVA wallettrack_v2_user (no choca con
// las 19 claves del viejo) para que la UI pinte sin esperar a
// Firebase. Modo local: el usuario puede entrar sin cuenta y
// la app funciona 100 % offline con las claves del original.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import type { User as UsuarioFirebase } from 'firebase/auth';
import { onAuthChange } from '../services/firebase';

/** Claves NUEVAS del shell V2 (nunca las toca el reset del viejo) */
const CLAVE_USUARIO = 'wallettrack_v2_user';
const CLAVE_MODO_LOCAL = 'wallettrack_v2_modo_local';

export interface CuentaUsuario {
  uid: string;
  nombre: string;
  email: string;
  foto: string;
}

// ── Caché local de la cuenta (pinta al instante) ──────────────
function guardarUsuarioLocal(datos: CuentaUsuario) {
  try { localStorage.setItem(CLAVE_USUARIO, JSON.stringify(datos)); } catch { /* sin storage */ }
}

function leerUsuarioLocal(): CuentaUsuario | null {
  try {
    const crudo = localStorage.getItem(CLAVE_USUARIO);
    if (!crudo) return null;
    const parsed = JSON.parse(crudo);
    if (!parsed || typeof parsed.uid !== 'string') return null;
    return {
      uid: String(parsed.uid),
      nombre: String(parsed.nombre ?? ''),
      email: String(parsed.email ?? ''),
      foto: String(parsed.foto ?? ''),
    };
  } catch { return null; }
}

function limpiarUsuarioLocal() {
  try { localStorage.removeItem(CLAVE_USUARIO); } catch { /* sin storage */ }
}

// ── Modo local (entrar sin cuenta Google) ─────────────────────
export function esModoLocal(): boolean {
  try { return localStorage.getItem(CLAVE_MODO_LOCAL) === '1'; } catch { return false; }
}

export function marcarModoLocal(activo: boolean) {
  try {
    if (activo) localStorage.setItem(CLAVE_MODO_LOCAL, '1');
    else localStorage.removeItem(CLAVE_MODO_LOCAL);
  } catch { /* sin storage */ }
}

export function useAuth() {
  const [usuario, setUsuario] = useState<UsuarioFirebase | null>(null);
  const [cuenta, setCuenta] = useState<CuentaUsuario | null>(() => leerUsuarioLocal());
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const desuscribir = onAuthChange((u) => {
      setUsuario(u);
      setCargando(false);

      if (u) {
        // Igual que FitTrack: displayName → 'Jefe' si Google no dio nombre
        const datos: CuentaUsuario = {
          uid: u.uid,
          nombre: u.displayName || 'Jefe',
          email: u.email || '',
          foto: u.photoURL || '',
        };
        guardarUsuarioLocal(datos);
        setCuenta(datos);
      } else {
        limpiarUsuarioLocal();
        setCuenta(null);
      }
    });
    return desuscribir;
  }, []);

  return { usuario, cuenta, cargando };
}
