// ═══════════════════════════════════════════════════════════
// 🚀 APP — WalletTrack V2 (F0 · BASE)
// Arquitectura gemela de FitTrack V2:
//   • Navegación por vista activa (activeView) — sin router
//   • ☰ Menú hamburguesa (NavDrawer) con TODAS las secciones
//   • Barra inferior reducida a los 4 destinos de uso diario
//   • Estado global en services/estado.ts (mismas claves del
//     wallettrack original — un respaldo viejo importa directo)
//   • F0: Dashboard + Cuentas + Historial + Configuración reales;
//     el resto llega en F1-F3 (VistaBloqueada con candado)
// ═══════════════════════════════════════════════════════════

import React, { useRef, useState } from 'react';
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
import { soles } from './services/dinero';
import { NavDrawer } from './components/NavDrawer';
import { VistaBloqueada } from './components/VistaBloqueada';
import { DashboardView } from './components/DashboardView';
import { CuentasView } from './components/CuentasView';
import { HistorialView } from './components/HistorialView';
import { ConfiguracionView } from './components/ConfiguracionView';
import { ModalTransaccion } from './components/ModalTransaccion';

// Vistas bloqueadas hasta su fase (el candado se retira fase a fase)
const VISTAS_FUTURAS: Partial<Record<VistaApp, { fase: string; nombre: string; descripcion: string; novedades: string[] }>> = {
  sobres: {
    fase: 'F1', nombre: 'Sobres de Dinero',
    descripcion: 'El método de sobres del WalletTrack original, con recargar, gastar e historial por sobre.',
    novedades: ['Sobres con emoji, color y saldo propio', 'Recargar y gastar desde cada sobre', 'Historial de movimientos por sobre'],
  },
  deudas: {
    fase: 'F1', nombre: 'Deudas y Apartados',
    descripcion: 'Deudas con abonos, historial de pagos y dinero apartado (apartar / pagar / ver de qué cuenta sale).',
    novedades: ['Registrar deudas con monto y abonos', 'Pestañas pagar / historial / apartar', 'Alertas de deuda pendiente'],
  },
  presupuestos: {
    fase: 'F1', nombre: 'Presupuestos',
    descripcion: 'Límite por categoría con barra de avance y alertas cuando te acercás al tope.',
    novedades: ['Presupuestos por categoría con color', 'Barra de avance del mes en curso', 'Alertas al 80% y 100% del límite'],
  },
  metas: {
    fase: 'F1', nombre: 'Metas de Ahorro',
    descripcion: 'Metas con monto objetivo, aportes y progreso — con abonos que quedan en el historial.',
    novedades: ['Metas con objetivo y fecha', 'Botón de aporte rápido', 'Progreso y restante en vivo'],
  },
  compras: {
    fase: 'F2', nombre: 'Lista de Compras',
    descripcion: 'Lista de compras con biblioteca de productos, precios y comparación en tienda.',
    novedades: ['Biblioteca de productos con precio', 'Tachar al meter al carrito', 'Historial de compras completadas'],
  },
  suscripciones: {
    fase: 'F2', nombre: 'Suscripciones',
    descripcion: 'Suscripciones con costo y próxima fecha de pago.',
    novedades: ['Netflix, Spotify y más con costo mensual', 'Próximo pago destacado', 'Total fijo mensual'],
  },
  calendario: {
    fase: 'F2', nombre: 'Calendario de Pagos',
    descripcion: 'Calendario mensual con pagos recurrentes y vencimientos.',
    novedades: ['Vista mensual con marcadores', 'Gastos fijos programados', 'Recordatorios de vencimiento'],
  },
  retos: {
    fase: 'F2', nombre: 'Retos Financieros',
    descripcion: 'Retos de ahorro con progreso y logros desbloqueados.',
    novedades: ['Retos activos con progreso', 'Logros desbloqueados', 'Rachas de días sin gastos hormiga'],
  },
  estadisticas: {
    fase: 'F2', nombre: 'Estadísticas',
    descripcion: 'Gráficas de distribución, evolución del balance y ahorro mensual.',
    novedades: ['Dona de gastos por categoría', 'Evolución del patrimonio', 'Export Excel y PDF profesional'],
  },
  walletbot: {
    fase: 'F3', nombre: 'WalletBot · Robot de Finanzas',
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
  dashboard: 'Dashboard', cuentas: 'Mis Cuentas', historial: 'Historial', config: 'Configuración',
};

export default function App() {
  const [vista, setVista] = useState<VistaApp>('dashboard');
  const [estado, setEstado] = useState<EstadoWallet>(() => leerEstado());
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [toast, setToast] = useState('');

  // Modal de transacción
  const [modalTipo, setModalTipo] = useState<'income' | 'expense'>('expense');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [sugerida, setSugerida] = useState<{ cuenta?: string; categoria?: string; monto?: number; descripcion?: string } | undefined>(undefined);

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

  return (
    <div className="min-h-screen bg-slate-950 custom-scrollbar">
      {/* ☰ Menú hamburguesa — TODAS las opciones agrupadas */}
      <NavDrawer
        abierto={drawerAbierto}
        vista={vista}
        onCerrar={() => setDrawerAbierto(false)}
        onIr={(v) => setVista(v)}
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
              {tituloVista} · {nombrePlataforma()}
            </p>
          </div>
          <span
            data-testid="badge-fase-0"
            className="ml-auto text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shrink-0"
          >
            F0 · BASE
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
            onImportar={importar}
            onToast={mostrarToast}
          />
        )}

        {/* Vistas F1-F3: candado + qué traerán */}
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
