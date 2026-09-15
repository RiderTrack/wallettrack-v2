// ═══════════════════════════════════════════════════════════
// 🚀 APP — WalletTrack V2 (F9.1 · IMPORTAR MULTI-FORMATO)
// Arquitectura gemela de FitTrack V2:
//   • Navegación por vista activa (activeView) — sin router
//   • ☰ Menú hamburguesa (NavDrawer) con TODAS las secciones
//   • Barra inferior reducida a los 4 destinos de uso diario
//   • Estado global en services/estado.ts (mismas claves del
//     wallettrack original — un respaldo viejo importa directo)
//   • F1: LoginScreen con Google REAL (Firebase) + modo local;
//     con sesión, TODO se respalda en wallettrack_sync/{uid}.
//   • F2 DINERO + F3 ANÁLISIS + F4 WALLETBOT instaladas.
//   • F5: 🔒 candado local (PIN + huella, se re-bloquea al ir al
//     fondo), 🔔 recordatorios de vencimientos (APK), 🔁 sueldos
//     y fijos programados con catch-up idempotente, categorías
//     y cuentas propias, y 🩺 diagnóstico del sync en Ajustes.
//   • F6: 📎 comprobantes (foto de boleta) en cada transacción —
//     subida a Firebase Storage con cola offline persistente,
//     thumbnail en historial y viewer pantalla completa con zoom.
//   • F7: 🤖 WalletBot proactivo — el bot te empuja avisos
//     inteligentes con notificaciones locales cuando detecta algo
//     importante. Reutiliza las 12 reglas del bot de F4, con
//     dedupe por día y horario silencioso 22:00–7:00.
//   • F8: 🌊 Sankey de flujo de dinero en Estadísticas —
//     visualización SVG pura que muestra a dónde va cada sol de
//     los ingresos del mes. Paths Bézier con grosor proporcional,
//     hover para resaltar. Mismo ADN de las gráficas de F3.
//   • F9: 📥 Importar CSV del banco — modal de 3 pasos (elegir
//     archivo+cuenta → mapear columnas → revisar+categorizar+
//     importar) con detección automática de columnas y
//     categorías, dedupe por fecha+monto+descripción. Parser
//     CSV a mano (sin deps externas) que funciona con cualquier
//     banco (BCP, Interbank, BBVA, Yape, Plin).
//   • F9.1: 📦 multi-formato — ahora también XLSX (exceljs, lazy,
//     mismo chunk del export de F3), PDF (pdfjs-dist, lazy, con
//     worker inline offline) y TXT. Detección endurecida para los
//     headers reales del BCP ("Fecha de operación" y "N° de
//     operación" ya no se confunden con el tipo) y soporte para
//     Cargo/Abono separados. Montos contables (50.00-) y fechas
//     sin año (PDFs).
//   • F10: 🔔 captura automática — el lector de notificaciones
//     bancarias (BCP, Yape, Interbank, BBVA, Scotiabank…).
//     Cada aviso de compra o abono se convierte en transacción
//     en segundos, con la categoría del diccionario de F9 y el
//     dedupe anti-doble. PRIVACÍA: filtro de apps en el lado
//     nativo (solo las elegidas se leen) y buffer 100% local.
//     Además 💳 Saldo Vivo: espejo de la cuenta con fecha de
//     corte, y modo automático o de revisión.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  LayoutDashboard, Wallet, History, Settings, Menu, Palette,
} from 'lucide-react';
import type { EstadoWallet, TemaWallet, VistaApp } from './types';
import { nombrePlataforma, versionApp, esAPK } from './services/platform';
import {
  leerEstado, persistir, agregarTransaccion, eliminarTransaccion, obtenerTransaccion,
  registrarGastoRapido, guardarSaldosIniciales, hacerTransferencia,
  importarRespaldo, resetTotal, aplicarRecurrentesPendientes, crearCategoria,
} from './services/estado';
import { cerrarSesion } from './services/firebase';
import { initSync } from './services/sync';
import { useAuth, esModoLocal, marcarModoLocal } from './hooks/useAuth';
import { soles } from './services/dinero';
import { pinActivo } from './services/seguridad';
import { reprogramarRecordatorios } from './services/recordatorios';
import {
  encolarComprobante, procesarCola, limpiarComprobanteTx, pendientesCola,
} from './services/comprobantes';
import { correrBotProactivo } from './services/botproactivo';
import { NavDrawer } from './components/NavDrawer';
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
import { WalletBotView } from './components/WalletBotView';
import { ThemeStudioModal } from './components/ThemeStudioModal';
import { FondoCanvas } from './components/FondoCanvas';
import { leerTema } from './services/tema';
import { BloqueoScreen } from './components/BloqueoScreen';

// F4 instaló WalletBot: TODAS las vistas del roadmap están
// activas — no queda ninguna bloqueada.
const VISTAS_FUTURAS: Partial<Record<VistaApp, { fase: string; nombre: string; descripcion: string; novedades: string[] }>> = {};

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
  estadisticas: 'Estadísticas', walletbot: 'WalletBot 2.0',
  historial: 'Historial', config: 'Configuración',
};

export default function App() {
  const { usuario, cuenta, cargando } = useAuth();
  const [modoLocal, setModoLocal] = useState<boolean>(() => esModoLocal());
  const [vista, setVista] = useState<VistaApp>('dashboard');
  const [estado, setEstado] = useState<EstadoWallet>(() => leerEstado());
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [toast, setToast] = useState('');

  // F5 · 🔒 Candado: al abrir con PIN → pantalla de bloqueo;
  // al ir al fondo la app se vuelve a cerrar sola.
  const [bloqueado, setBloqueado] = useState(false);

  // F4 · Theme Studio: tema vivo (para el canvas de fondo) +
  // apertura del modal desde el 🎨 del header o Ajustes.
  const [tema, setTemaApp] = useState<TemaWallet>(() => leerTema());
  const [studioAbierto, setStudioAbierto] = useState(false);

  // Modal de transacción
  const [modalTipo, setModalTipo] = useState<'income' | 'expense'>('expense');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [sugerida, setSugerida] = useState<{ cuenta?: string; categoria?: string; monto?: number; descripcion?: string } | undefined>(undefined);

  // F1: sync en la nube — con sesión baja+combina+sube al entrar,
  // cada 5 min, al volver al frente y 8 s tras cada cambio local.
  // En modo local (sin cuenta) no hay nube: 100 % offline.
  // F5: tras aplicar datos de la nube también corre el catch-up
  // de recurrentes (por si el otro teléfono no lo hizo aún).
  useEffect(() => {
    const pararSync = initSync({
      uid: modoLocal ? null : (usuario?.uid ?? null),
      alCambiarEstadoRemoto: () => {
        const r = aplicarRecurrentesPendientes(leerEstado());
        if (r.nuevas.length > 0) persistir(r.estado);
        setEstado(r.estado);
      },
    });
    return pararSync;
  }, [usuario?.uid, modoLocal]);

  // F5 · 🔁 Catch-up de recurrentes: una sola vez por arranque
  // de la app (ids deterministas → re-cargar no duplica nada).
  const catchUpHecho = useRef(false);
  useEffect(() => {
    if (cargando || catchUpHecho.current) return;
    if (!usuario && !modoLocal) return; // aún en login
    catchUpHecho.current = true;
    const r = aplicarRecurrentesPendientes(leerEstado());
    if (r.nuevas.length > 0) {
      persistir(r.estado);
      setEstado(r.estado);
      setToast(`🔁 ${r.nuevas.length} programado${r.nuevas.length === 1 ? '' : 's'} registrado${r.nuevas.length === 1 ? '' : 's'}`);
      const t = setTimeout(() => setToast(''), 3200);
      return () => clearTimeout(t);
    }
  }, [cargando, usuario, modoLocal]);

  // F5 · 🔒 Re-bloqueo: al abrir la app (arranque) y al mandarla
  // al fondo el candado vuelve a cerrarse — como las apps de banco.
  useEffect(() => {
    // Arranque con candado configurado → arranca bloqueada
    if (pinActivo()) setBloqueado(true);
    let limpiar: (() => void) | undefined;
    const setup = async () => {
      try {
        const { App } = await import('@capacitor/app');
        const escucha = await App.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
          if (!isActive && pinActivo()) setBloqueado(true);
        });
        limpiar = () => { void escucha.remove(); };
      } catch { /* web: sin ciclo de vida nativo */ }
    };
    void setup();
    return () => limpiar?.();
  }, []);

  // F5 · 🔔 Recordatorios: se re-agenda solo cuando cambian los
  // fijos o las deudas (crear/pagar/baja/sync) — cancela y vuelve
  // a programar. En web no hace nada.
  useEffect(() => {
    if (!esAPK()) return;
    void reprogramarRecordatorios(estado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.subscriptions, estado.deudas]);

  // F6 · 📎 Cola de comprobantes: procesa pendientes al arrancar
  // (si hay sesión) y al volver al frente. Cuando sube OK, reemplaza
  // comprobanteLocal por comprobanteUrl y el sync normal propaga.
  useEffect(() => {
    if (!usuario?.uid) return;
    // Arranque: procesar tras 2s (dar tiempo al init de Firebase)
    const t = setTimeout(() => { void procesarCola().then(() => setEstado(leerEstado())); }, 2000);
    const alVisible = () => {
      if (document.visibilityState === 'visible' && pendientesCola() > 0) {
        void procesarCola().then(() => setEstado(leerEstado()));
      }
    };
    document.addEventListener('visibilitychange', alVisible);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', alVisible);
    };
  }, [usuario?.uid]);

  // F7 · 🤖 Bot proactivo: corre el motor 3s después de cada cambio
  // de estado (debounce — no correr en cada gasto rápido). Dispara
  // notificaciones locales si hay avisos nuevos que cumplen el filtro
  // de frecuencia y horario. Dedupe por día → no repite avisos.
  const debounceBot = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (debounceBot.current) clearTimeout(debounceBot.current);
    debounceBot.current = setTimeout(() => {
      void correrBotProactivo(estado).then((r) => {
        if (r.disparados > 0) {
          mostrarToast(`🤖 ${r.disparados} ${r.disparados === 1 ? 'aviso nuevo' : 'avisos nuevos'} del bot`);
        }
      });
    }, 3000);
    return () => { if (debounceBot.current) clearTimeout(debounceBot.current); };
  }, [estado]);

  // F10 · 🔔 Captura automática (solo APK): drena el buffer nativo
  // (capturas que llegaron con la app cerrada) y escucha el evento
  // en vivo wtCapture → cada notificación bancaria se convierte en
  // transacción. Si la app estaba cerrada, al abrirla se ponen al
  // día todas. El estado nuevo se aplica igual que un cambio manual
  // (persiste + sincroniza + bot re-analiza).
  useEffect(() => {
    if (!esAPK()) return;
    let limpiar: (() => void) | undefined;
    let cancelado = false;
    void (async () => {
      try {
        const { iniciarCaptura } = await import('./services/captura');
        if (cancelado) return;
        limpiar = await iniciarCaptura(aplicar, mostrarToast);
      } catch { /* plugin nativo no disponible (web) */ }
    })();
    return () => { cancelado = true; limpiar?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setBloqueado(false);
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
    const nuevoEstado = agregarTransaccion(estado, datos);
    aplicar(nuevoEstado);
    setModalAbierto(false);
    mostrarToast(datos.type === 'income'
      ? `Ingreso de ${soles(datos.monto)} registrado`
      : `Gasto de ${soles(datos.monto)} registrado`);
    // F6 · Comprobante: si trae foto local, encolar para subir a Storage
    if (datos.comprobanteLocal && usuario?.uid) {
      const nuevaTx = nuevoEstado.transactions[0];
      if (nuevaTx?.id) {
        encolarComprobante(usuario.uid, nuevaTx.id, datos.comprobanteLocal);
        void procesarCola().then(() => setEstado(leerEstado()));
      }
    }
  };

  // F6 · Eliminar tx → limpiar comprobante (cola + Storage) antes de sacar del estado
  const eliminarTransaccionConComprobante = (id: string) => {
    const tx = obtenerTransaccion(estado, id);
    if (tx) {
      void limpiarComprobanteTx(usuario?.uid ?? null, tx);
    }
    aplicar(eliminarTransaccion(estado, id));
    mostrarToast('Movimiento eliminado');
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

  // F5 · categorías propias desde el modal de transacción
  const crearCategoriaDesdeModal = (flujo: 'income' | 'expense', nombre: string, emoji: string): boolean => {
    const r = crearCategoria(estado, flujo === 'income' ? 'ingreso' : 'gasto', nombre, emoji);
    if (!r.ok) { mostrarToast(r.error ?? 'No se pudo crear'); return false; }
    aplicar(r.estado);
    return true;
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
        <p className="text-slate-400 text-sm font-mono">WalletTrack V2 · F10</p>
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

  // ── F5 · 🔒 Candado activo: NADA de la app se pinta detrás ──
  if (bloqueado && pinActivo()) {
    return <BloqueoScreen onDesbloquear={() => setBloqueado(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 custom-scrollbar wt-root">
      {/* F4 · Fondo animado del Theme Studio (canvas detrás del contenido) */}
      <FondoCanvas tipo={tema.background} accent={tema.accent} />

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
            F10 · CAPTURA AUTO
          </span>
          <button
            onClick={() => setStudioAbierto(true)}
            data-testid="boton-theme-studio"
            title="Theme Studio"
            className="w-9 h-9 rounded-xl border border-slate-600 text-slate-300 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 flex items-center justify-center transition-all shrink-0"
          >
            <Palette className="w-4 h-4" />
          </button>
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
            onAplicar={aplicar}
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

        {/* F4 · WALLETBOT: el robot de finanzas con tus datos reales */}
        {vista === 'walletbot' && (
          <WalletBotView estado={estado} onToast={mostrarToast} />
        )}

        {vista === 'historial' && (
          <HistorialView
            estado={estado}
            onEliminar={eliminarTransaccionConComprobante}
            onAplicar={aplicar}
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
            onAbrirStudio={() => setStudioAbierto(true)}
            onAplicar={aplicar}
            onToast={mostrarToast}
          />
        )}

        {/* (F4 completó el roadmap: ya no hay vistas bloqueadas) */}
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
        onCrearCategoria={crearCategoriaDesdeModal}
      />

      {/* F4 · Theme Studio (🎨 del header o botón de Ajustes) */}
      <ThemeStudioModal
        abierto={studioAbierto}
        onCerrar={() => setStudioAbierto(false)}
        onCambio={(t) => setTemaApp(t)}
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
