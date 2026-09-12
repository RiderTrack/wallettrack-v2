// ═══════════════════════════════════════════════════════════
// 🚀 APP — WalletTrack V2 (F1 · ACCESO)
// Arquitectura gemela de FitTrack V2:
//   • Navegación por vista activa (activeView) — sin router
//   • ☰ Menú hamburguesa (NavDrawer) con TODAS las secciones
//   • Barra inferior reducida a los 4 destinos de uso diario
//   • Estado global en services/estado.ts (mismas claves del
//     wallettrack original — un respaldo viejo importa directo)
//   • F1: LoginScreen con Google REAL (Firebase) + modo local;
//     con sesión, TODO se respalda en wallettrack_sync/{uid}
//     (baja+combina+sube al entrar, cada 5 min, al volver al
//     frente y 8 s tras cada cambio — debounce).
//   • F2 DINERO + F3 ANÁLISIS instaladas; queda F4 WalletBot.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  LayoutDashboard, Wallet, History, Settings, Menu,
} from 'lucide-react';
import type { EstadoWallet, VistaApp } from './types';
import { nombrePlataforma, versionApp } from './services/platform';
import {
  leerEstado, persistir, agregarTransaccion, eliminarTransaccion,
  registrarGastoRapido, guardarSaldosIniciales, hacerTransferencia,
  importarRespaldo, resetTotal,
} from './services/estado';
import { cerrarSesion } from './services/firebase';
import { initSync } from './services/sync';
import { useAuth, esModoLocal, marcarModoLocal } from './hooks/useAuth';
import { soles } from './services/dinero';
import { NavDrawer } from './components/NavDrawer';
import { VistaBloqueada } from './components/VistaBloqueada';
import { DashboardView } from './components/DashboardView';
import { CuentasView } from './components/CuentasView';
import { SobresView } from './components/SobresView';
import { DeudasView } from './components/DeudasView';
import { PresupuestosView } from './components/PresupuestosView';
import { MetasView } from './components/MetasView';
import { HistorialView } from './components/HistorialView';
import { ConfiguracionView } from './components/ConfiguracionView';
import { ModalTransaccion } from './components/ModalTransaccion';
import { LoginScreen } from './components/LoginScreen';
import { ComprasView } from './components/ComprasView';
import { SuscripcionesView } from './components/SuscripcionesView';
import { CalendarioView } from './components/CalendarioView';
import { RetosView } from './components/RetosView';
import { EstadisticasView } from './components/EstadisticasView';

// Vistas bloqueadas hasta su fase (F2 fue DINERO y F3 fue
// ANÁLISIS: compras, suscripciones, calendario, retos y
// estadísticas ya están INSTALADAS — solo queda F4)
const VISTAS_FUTURAS: Partial<Record<VistaApp, { fase: string; nombre: string; descripcion: string; novedades: string[] }>> = {
  walletbot: {
    fase: 'F4', nombre: 'WalletBot · Robot de Finanzas',
    descripcion: 'El robot IA del WalletTrack junto a tus otros robots: analiza tu mes y aconseja con tus datos reales.',
    novedades: ['Análisis automático del mes', 'Consejos anti-gasto hormiga', 'Chat con contexto de tus finanzas'],
  },
};

// Nav inferior: los 4 destinos diarios (el resto vive en ☰)
const NAV: { vista: VistaApp; nombre: string; icono: React.ReactNode }[] = [
  { vista: 'dashboard', nombre: 'Inicio',   icono: <LayoutDashboard className="w-5 h-5" /> },
  { vista: 'cuentas',   nombre: 'Cuentas',  icono: <Wallet className="w-5 h-5" /> },
  { vista: 'historial', nombre: 'Historial',icono: <History className="w-5 h-5" /> },
  { vista: 'config',    nombre: 'Ajustes',  icono: <Settings className="w-5 h-5" /> },
];

const TITULOS: Partial<Record<VistaApp, string>> = {
  dashboard: 'Dashboard', cuentas: 'Mis Cuentas',
  sobres: 'Sobres de Dinero', deudas: 'Deudas y Apartados',
  presupuestos: 'Presupuestos', metas: 'Metas de Ahorro',
  compras: 'Lista de Compras', suscripciones: 'Gastos Fijos',
  calendario: 'Calendario de Pagos', retos: 'Retos Financieros',
  estadisticas: 'Estadísticas',
  historial: 'Historial', config: 'Configuración',
};

export default function App() {
  const { usuario, cuenta, cargando } = useAuth();
  const [modoLocal, setModoLocal] = useState<boolean>(() => esModoLocal());
  const [vista, setVista] = useState<VistaApp>('dashboard');
  const [estado, setEstado] = useState<EstadoWallet>(() => leerEstado());
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [toast, setToast] = useState('');

  // Modal de transacción
  const [modalTipo, setModalTipo] = useState<'income' | 'expense'>('expense');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [sugerida, setSugerida] = useState<{ cuenta?: string; categoria?: string; monto?: number; descripcion?: string } | undefined>(undefined);

  // F1: sync en la nube — con sesión baja+combina+sube al entrar,
  // cada 5 min, al volver al frente y 8 s tras cada cambio local.
  // En modo local (sin cuenta) no hay nube: 100 % offline.
  useEffect(() => {
    const pararSync = initSync({
      uid: modoLocal ? null : (usuario?.uid ?? null),
      alCambiarEstadoRemoto: () => setEstado(leerEstado()),
    });
    return pararSync;
  }, [usuario?.uid, modoLocal]);

  // F1: salir — cierra sesión Firebase (y Google nativo en APK) o
  // vuelve del modo local; siempre regresa al LoginScreen.
  const salir = async () => {
    if (modoLocal) {
      marcarModoLocal(false);
      setModoLocal(false);
      setVista('dashboard');
      return;
    }
    try {
      if (Capacitor.isNativePlatform()) {
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        try { await GoogleAuth.signOut(); } catch { /* ya estaba fuera */ }
      }
    } catch { /* plugin no disponible en web */ }
    await cerrarSesion();
    setVista('dashboard');
  };

  // Toast auto-ocultable
  const timerToast = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mostrarToast = (mensaje: string) => {
    setToast(mensaje);
    if (timerToast.current) clearTimeout(timerToast.current);
    timerToast.current = setTimeout(() => setToast(''), 2600);
  };

  // Persistir cada cambio de estado
  const aplicar = (nuevo: EstadoWallet) => {
    setEstado(nuevo);
    persistir(nuevo);
  };

  // ── Acciones del modal ───────────────────────────────────────
  const abrirModal = (tipo: 'income' | 'expense', sug?: { cuenta?: string }) => {
    setModalTipo(tipo);
    setSugerida(sug);
    setModalAbierto(true);
  };

  const guardarTransaccion = (datos: Parameters<typeof agregarTransaccion>[1]) => {
    aplicar(agregarTransaccion(estado, datos));
    setModalAbierto(false);
    mostrarToast(datos.type === 'income'
      ? `Ingreso de ${soles(datos.monto)} registrado`
      : `Gasto de ${soles(datos.monto)} registrado`);
  };

  const gastoRapido = (index: number) => {
    const gr = estado.gastosRapidos[index];
    if (!gr) return;
    aplicar(registrarGastoRapido(estado, gr));
    mostrarToast(`${gr.emoji} ${gr.nombre}: ${soles(gr.monto)} registrado`);
  };

  const transferir = (from: string, to: string, monto: number): string | null => {
    const { estado: nuevo, ok, error } = hacerTransferencia(estado, from, to, monto);
    if (!ok) return error ?? 'Transferencia inválida';
    aplicar(nuevo);
    return null;
  };

  const importar = (textoJSON: string): boolean => {
    const { estado: nuevo, ok, error } = importarRespaldo(estado, textoJSON);
    if (!ok) { mostrarToast(error ?? 'Error al importar'); return false; }
    aplicar(nuevo);
    return true;
  };

  const infoFutura = VISTAS_FUTURAS[vista];
  const tituloVista = TITULOS[vista] ?? infoFutura?.nombre ?? '';

  // ── Cargando: mini splash ──
  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl animate-pulse">
          <Wallet className="w-8 h-8 text-white" />
        </div>
        <p className="text-slate-400 text-sm font-mono">WalletTrack V2 · F3</p>
      </div>
    );
  }

  // ── Sin sesión (y sin modo local): login Google ──
  if (!usuario && !modoLocal) {
    return (
      <LoginScreen
        onEntrarLocal={() => {
          marcarModoLocal(true);
          setModoLocal(true);
          setVista('dashboard');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 custom-scrollbar">
      {/* ☰ Menú hamburguesa — TODAS las opciones agrupadas */}
      <NavDrawer
        abierto={drawerAbierto}
        vista={vista}
        cuenta={cuenta}
        modoLocal={modoLocal}
        onCerrar={() => setDrawerAbierto(false)}
        onIr={(v) => setVista(v)}
        onSalir={salir}
      />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setDrawerAbierto(true)}
            data-testid="boton-hamburguesa"
            title="Menú"
            className="w-10 h-10 rounded-2xl border border-slate-600 text-slate-300 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 flex items-center justify-center transition-all shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black text-white leading-tight">WalletTrack V2</h1>
            <p className="text-[11px] text-slate-400 leading-tight truncate">
              {tituloVista} · {modoLocal ? 'Modo local' : (cuenta?.nombre?.split(' ')[0] || nombrePlataforma())}
            </p>
          </div>
          <span
            data-testid="badge-fase"
            className="ml-auto text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shrink-0"
          >
            F3 · ANÁLISIS
          </span>
          <button
            onClick={() => setVista('config')}
            data-testid="boton-ajustes"
            title="Ajustes"
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
              vista === 'config'
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-600 text-slate-300 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-5xl mx-auto px-4 py-5 pb-28">
        {vista === 'dashboard' && (
          <DashboardView
            estado={estado}
            onRegistrar={abrirModal}
            onGastoRapido={gastoRapido}
            onIr={(v) => setVista(v)}
          />
        )}

        {vista === 'cuentas' && (
          <CuentasView
            estado={estado}
            onRegistrar={abrirModal}
            onGuardarSaldos={(saldos) => aplicar(guardarSaldosIniciales(estado, saldos))}
            onTransferencia={transferir}
            onReset={() => { setEstado(resetTotal()); mostrarToast('Todo reiniciado a cero'); }}
            onToast={mostrarToast}
          />
        )}

        {/* F2 · DINERO: sobres, deudas, presupuestos y metas */}
        {vista === 'sobres' && (
          <SobresView estado={estado} onAplicar={aplicar} onToast={mostrarToast} />
        )}

        {vista === 'deudas' && (
          <DeudasView estado={estado} onAplicar={aplicar} onToast={mostrarToast} />
        )}

        {vista === 'presupuestos' && (
          <PresupuestosView estado={estado} onAplicar={aplicar} onToast={mostrarToast} />
        )}

        {vista === 'metas' && (
          <MetasView estado={estado} onAplicar={aplicar} onToast={mostrarToast} />
        )}

        {/* F3 · ANÁLISIS: compras, suscripciones, calendario, retos y estadísticas */}
        {vista === 'compras' && (
          <ComprasView estado={estado} onAplicar={aplicar} onToast={mostrarToast} />
        )}

        {vista === 'suscripciones' && (
          <SuscripcionesView estado={estado} onAplicar={aplicar} onToast={mostrarToast} />
        )}

        {vista === 'calendario' && (
          <CalendarioView estado={estado} />
        )}

        {vista === 'retos' && (
          <RetosView estado={estado} onAplicar={aplicar} onToast={mostrarToast} />
        )}

        {vista === 'estadisticas' && (
          <EstadisticasView estado={estado} onToast={mostrarToast} />
        )}

        {vista === 'historial' && (
          <HistorialView
            estado={estado}
            onEliminar={(id) => { aplicar(eliminarTransaccion(estado, id)); mostrarToast('Movimiento eliminado'); }}
            onToast={mostrarToast}
          />
        )}

        {vista === 'config' && (
          <ConfiguracionView
            estado={estado}
            cuenta={cuenta}
            modoLocal={modoLocal}
            onImportar={importar}
            onIniciarSesion={() => { marcarModoLocal(false); setModoLocal(false); }}
            onToast={mostrarToast}
          />
        )}

        {/* Vistas F4+: candado + qué traerán */}
        {infoFutura && (
          <VistaBloqueada
            nombre={infoFutura.nombre}
            fase={infoFutura.fase}
            descripcion={infoFutura.descripcion}
            novedades={infoFutura.novedades}
            onVolver={() => setVista('dashboard')}
          />
        )}
      </main>

      {/* Barra inferior (4 destinos diarios) */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 bg-slate-900/90 backdrop-blur-xl border-t border-slate-700/60 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-5xl mx-auto flex items-stretch justify-around px-2 py-1.5">
          {NAV.map(({ vista: v, nombre, icono }) => {
            const activa = v === vista;
            return (
              <button
                key={v}
                onClick={() => setVista(v)}
                data-testid={`nav-${v}`}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-4 rounded-xl text-[10px] font-bold transition-all active:scale-95 ${
                  activa ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {icono}
                <span>{nombre}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modal de ingreso/gasto */}
      <ModalTransaccion
        abierto={modalAbierto}
        tipo={modalTipo}
        estado={estado}
        sugerida={sugerida}
        onCerrar={() => setModalAbierto(false)}
        onGuardar={guardarTransaccion}
      />

      {/* Toast */}
      {toast && (
        <div
          data-testid="toast"
          className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[80] bg-slate-800 border border-slate-600 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-2xl max-w-[90vw] text-center"
        >
          {toast}
        </div>
      )}

      {/* Pie de versión (info visual, como el badge del FitTrack) */}
      <p className="text-center text-[10px] text-slate-600 pb-2">{versionApp()}</p>
    </div>
  );
}
