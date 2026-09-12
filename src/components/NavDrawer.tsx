// ═══════════════════════════════════════════════════════════
// ☰ NAV DRAWER (MENÚ HAMBURGUESA) — WalletTrack V2 (F1)
// Como pediste: navegación en cajón lateral (mismo patrón del
// FitTrack V2). Agrupa TODO el WalletTrack en secciones:
//   Inicio · Dinero · Planificar · Análisis · 🤖 Robots · IA ·
//   Ajustes
// F1: al pie, tu cuenta Google (o modo local) con cerrar sesión.
// F2 instaló Sobres, Deudas, Presupuestos y Metas (sin candado).
// F3 instaló Compras, Suscripciones, Calendario, Retos y
// Estadísticas (sin candado). Solo queda F4 (WalletBot) 🔒.
// Se abre con el ☰ del header, se cierra con backdrop, X o ESC.
// ═══════════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import {
  LayoutDashboard, Wallet, Layers, HandCoins, ShoppingCart, PiggyBank, Target,
  CalendarDays, Repeat, Trophy, History, TrendingUp, Bot, Settings, Lock, X,
  LogOut, CloudOff,
} from 'lucide-react';
import type { VistaApp } from '../types';
import { versionApp } from '../services/platform';
import type { CuentaUsuario } from '../hooks/useAuth';

interface ItemNav {
  vista: VistaApp;
  nombre: string;
  icono: React.ReactNode;
  fase?: string; // presente = vista bloqueada hasta esa fase
}

interface GrupoNav {
  titulo: string;
  acento: string;
  items: ItemNav[];
}

const GRUPOS: GrupoNav[] = [
  {
    titulo: 'INICIO',
    acento: 'text-slate-400',
    items: [
      { vista: 'dashboard', nombre: 'Dashboard', icono: <LayoutDashboard className="w-4 h-4" /> },
    ],
  },
  {
    titulo: 'DINERO',
    acento: 'text-emerald-400',
    items: [
      { vista: 'cuentas',    nombre: 'Mis Cuentas',        icono: <Wallet className="w-4 h-4" /> },
      { vista: 'sobres',     nombre: 'Sobres de Dinero',   icono: <Layers className="w-4 h-4" /> },
      { vista: 'deudas',     nombre: 'Deudas y Apartados', icono: <HandCoins className="w-4 h-4" /> },
      { vista: 'compras',    nombre: 'Lista de Compras',   icono: <ShoppingCart className="w-4 h-4" /> },
    ],
  },
  {
    titulo: 'PLANIFICAR',
    acento: 'text-cyan-400',
    items: [
      { vista: 'presupuestos',   nombre: 'Presupuestos',        icono: <PiggyBank className="w-4 h-4" /> },
      { vista: 'metas',          nombre: 'Metas de Ahorro',     icono: <Target className="w-4 h-4" /> },
      { vista: 'suscripciones',  nombre: 'Gastos Fijos',        icono: <Repeat className="w-4 h-4" /> },
      { vista: 'calendario',     nombre: 'Calendario de Pagos', icono: <CalendarDays className="w-4 h-4" /> },
      { vista: 'retos',          nombre: 'Retos Financieros',   icono: <Trophy className="w-4 h-4" /> },
    ],
  },
  {
    titulo: 'ANÁLISIS',
    acento: 'text-teal-400',
    items: [
      { vista: 'historial',    nombre: 'Historial',    icono: <History className="w-4 h-4" /> },
      { vista: 'estadisticas', nombre: 'Estadísticas', icono: <TrendingUp className="w-4 h-4" /> },
    ],
  },
  {
    titulo: '🤖 ROBOTS · IA',
    acento: 'text-fuchsia-400',
    items: [
      { vista: 'walletbot', nombre: 'WalletBot · Robot de Finanzas', icono: <Bot className="w-4 h-4" />, fase: 'F4' },
    ],
  },
  {
    titulo: 'AJUSTES',
    acento: 'text-slate-400',
    items: [
      { vista: 'config', nombre: 'Configuración', icono: <Settings className="w-4 h-4" /> },
    ],
  },
];

interface NavDrawerProps {
  abierto: boolean;
  vista: VistaApp;
  cuenta: CuentaUsuario | null;   // F1: sesión Google (null = modo local)
  modoLocal: boolean;
  onCerrar: () => void;
  onIr: (v: VistaApp) => void;
  onSalir: () => void;            // F1: cerrar sesión / salir del modo local
}

export const NavDrawer: React.FC<NavDrawerProps> = ({
  abierto, vista, cuenta, modoLocal, onCerrar, onIr, onSalir,
}) => {
  // ESC cierra el cajón
  useEffect(() => {
    if (!abierto) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [abierto, onCerrar]);

  const ir = (v: VistaApp) => {
    onIr(v);
    onCerrar();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          abierto ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onCerrar}
        data-testid="drawer-backdrop"
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-[280px] max-w-[85vw] bg-slate-900 border-r border-slate-700 shadow-2xl flex flex-col transition-transform duration-300 ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
        data-testid="nav-drawer"
        role="dialog"
        aria-label="Menú principal"
      >
        {/* Cabecera del cajón */}
        <div className="p-4 border-b border-slate-700/60 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black text-white leading-tight">WalletTrack V2</p>
            <p className="text-[10px] font-mono text-emerald-400">{versionApp()}</p>
          </div>
          <button
            onClick={onCerrar}
            data-testid="boton-cerrar-drawer"
            title="Cerrar menú"
            className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white hover:border-emerald-500/60 flex items-center justify-center transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grupos */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
          {GRUPOS.map((g) => (
            <div key={g.titulo}>
              <p className={`text-[9px] font-black tracking-[0.18em] px-2 mb-1.5 ${g.acento}`}>{g.titulo}</p>
              <div className="space-y-0.5">
                {g.items.map(({ vista: v, nombre, icono, fase }) => {
                  const activa = v === vista;
                  const bloqueada = Boolean(fase);
                  return (
                    <button
                      key={v}
                      onClick={() => ir(v)}
                      data-testid={`drawer-${v}`}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${
                        activa
                          ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                          : 'border border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span className="shrink-0">{icono}</span>
                      <span className={`flex-1 text-left truncate ${bloqueada ? 'text-slate-400' : ''}`}>{nombre}</span>
                      {bloqueada && (
                        <span className="flex items-center gap-1 shrink-0 text-[8px] font-mono px-1.5 py-0.5 rounded bg-slate-700/60 border border-slate-600 text-slate-400">
                          <Lock className="w-2.5 h-2.5" />
                          {fase}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Pie: sesión (F1) + branding */}
        <div className="p-4 border-t border-slate-700/60 space-y-3">
          {/* Tarjeta de sesión: Google o modo local */}
          <div className="flex items-center gap-3 bg-slate-950/60 border border-slate-700/60 rounded-2xl p-3">
            {cuenta?.foto ? (
              <img
                src={cuenta.foto}
                alt=""
                className="w-9 h-9 rounded-full border border-slate-600 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-sm font-black text-white shrink-0">
                {(cuenta?.nombre || 'W').trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">
                {cuenta?.nombre || 'Modo local'}
              </p>
              <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                {cuenta ? (cuenta.email || 'Cuenta Google') : (
                  <><CloudOff className="w-3 h-3" /> sin nube — datos solo aquí</>
                )}
              </p>
            </div>
            <button
              onClick={onSalir}
              data-testid="boton-cerrar-sesion"
              title={modoLocal ? 'Salir del modo local' : 'Cerrar sesión'}
              className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-red-300 hover:border-red-500/50 hover:bg-red-500/10 flex items-center justify-center transition-all shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-slate-500 text-center leading-relaxed">
            Todo tu dinero en un solo lugar 💰 — datos compatibles con tu WalletTrack original
          </p>
        </div>
      </aside>
    </>
  );
};
