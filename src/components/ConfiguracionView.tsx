// ═══════════════════════════════════════════════════════════
// ⚙️ CONFIGURACIÓN — WalletTrack V2 (F1)
// F1: cuenta Google + sincronización en la nube (wallettrack_sync)
// con estado en vivo, Sincronizar ahora, Restaurar y Subir todo.
// Además: respaldo JSON (mismo formato v3.0 del viejo →
// intercambiable con el HTML original), import de backups del
// viejo Wallet, info de versión/plataforma y roadmap de fases.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import {
  Download, Upload, Wallet, Smartphone, Map, CheckCircle2, AlertTriangle,
  Cloud, CloudDownload, CloudUpload, RefreshCw, LogIn, Loader2,
} from 'lucide-react';
import type { EstadoWallet } from '../types';
import { esAPK, nombrePlataforma, versionApp } from '../services/platform';
import { exportarRespaldo, importarRespaldo } from '../services/estado';
import {
  sincronizarAhora, restaurarDesdeNube, subirTodoALaNube,
  suscribirSync, type EstadoSyncUI,
} from '../services/sync';
import { compartirArchivo, nombreRespaldo } from '../services/archivo';
import type { CuentaUsuario } from '../hooks/useAuth';

interface ConfiguracionViewProps {
  estado: EstadoWallet;
  cuenta: CuentaUsuario | null;   // F1: sesión Google (null = modo local)
  modoLocal: boolean;
  onImportar: (textoJSON: string) => boolean; // true si ok
  onIniciarSesion: () => void;    // F1: salir del modo local → LoginScreen
  onToast: (mensaje: string) => void;
}

export const ConfiguracionView: React.FC<ConfiguracionViewProps> = ({
  estado, cuenta, modoLocal, onImportar, onIniciarSesion, onToast,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmandoImport, setConfirmandoImport] = useState(false);
  const [borrador, setBorrador] = useState<{ nombre: string; contenido: string } | null>(null);

  // ── F1: Sincronización en la nube ──
  const [sync, setSync] = useState<EstadoSyncUI | null>(null);
  useEffect(() => suscribirSync(setSync), []);
  const [syncTrabajando, setSyncTrabajando] = useState(false);
  const [confirmRestaurar, setConfirmRestaurar] = useState(false);
  const [confirmSubir, setConfirmSubir] = useState(false);

  const hace = (epoch: number | null): string => {
    if (!epoch) return 'nunca';
    const seg = Math.max(0, Math.floor((Date.now() - epoch) / 1000));
    if (seg < 60) return 'hace instantes';
    const min = Math.floor(seg / 60);
    if (min < 60) return `hace ${min} min`;
    return `hace ${Math.floor(min / 60)} h`;
  };

  const alSincronizarAhora = async () => {
    if (syncTrabajando) return;
    setSyncTrabajando(true);
    const r = await sincronizarAhora();
    setSyncTrabajando(false);
    if (r.ok) onToast('Sincronizado con la nube ✓');
    else if (r.error === 'sin-sesion') onToast('Iniciá sesión con tu cuenta Google para sincronizar');
    else onToast(r.error ?? 'No se pudo sincronizar');
  };

  const confirmarRestaurar = async () => {
    setConfirmRestaurar(false);
    if (syncTrabajando) return;
    setSyncTrabajando(true);
    const r = await restaurarDesdeNube();
    setSyncTrabajando(false);
    onToast(r.ok ? 'Datos de la nube restaurados ✓' : (r.error ?? 'No se pudo restaurar'));
  };

  const confirmarSubir = async () => {
    setConfirmSubir(false);
    if (syncTrabajando) return;
    setSyncTrabajando(true);
    const r = await subirTodoALaNube();
    setSyncTrabajando(false);
    onToast(r.ok ? 'Todo subido a la nube ✓' : (r.error ?? 'No se pudo subir'));
  };

  const exportar = async () => {
    const json = exportarRespaldo(estado);
    const blob = new Blob([json], { type: 'application/json' });
    await compartirArchivo(blob, nombreRespaldo());
    onToast('Respaldo JSON exportado');
  };

  const elegirArchivo = () => inputRef.current?.click();

  const alLeerArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const contenido = String(ev.target?.result ?? '');
      // Validación rápida antes de pedir confirmación
      try {
        const data = JSON.parse(contenido);
        if (!data || !Array.isArray(data.transactions)) {
          onToast('No parece un respaldo de WalletTrack');
          return;
        }
      } catch {
        onToast('Archivo JSON inválido');
        return;
      }
      setBorrador({ nombre: file.name, contenido });
      setConfirmandoImport(true);
    };
    reader.readAsText(file);
    e.target.value = ''; // permite re-elegir el mismo archivo
  };

  const confirmarImport = () => {
    if (!borrador) return;
    const ok = onImportar(borrador.contenido);
    setConfirmandoImport(false);
    setBorrador(null);
    if (ok) onToast('Backup importado: tus datos fueron reemplazados');
  };

  const nTransacciones = estado.transactions.length;
  const totalRespaldo = estado.goals.length + estado.subscriptions.length + estado.challenges.length
    + estado.sobres.length + estado.deudas.length + estado.productos.length;

  return (
    <div className="space-y-5 wt-aparece" data-testid="vista-config">

      {/* ── Info de la app ─────────────────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-black text-white">WalletTrack V2</h2>
            <p className="text-xs text-slate-400">
              Versión <span data-testid="version-config" className="font-mono text-emerald-400">{versionApp()}</span> ·
              Puerto modular del original
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> Entorno
            </p>
            <p className="text-sm font-bold text-slate-200 mt-0.5">{nombrePlataforma()}</p>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Moneda</p>
            <p className="text-sm font-bold text-slate-200 mt-0.5">Soles (S/) · es-PE</p>
          </div>
        </div>
        <div className="mt-3 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Tus datos</p>
          <p className="text-xs text-slate-300 mt-1">
            {nTransacciones} transacciones · {estado.goals.length} metas · {estado.budgets.length} presupuestos ·
            {' '}{estado.subscriptions.length} suscripciones · {estado.sobres.length + estado.deudas.length} registros de sobres/deudas
            {totalRespaldo > 0 && ' (se conservan al importar/exportar)'}
          </p>
        </div>
      </section>

      {/* ── Cuenta y Sincronización (F1) ─────────────────────── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5" data-testid="tarjeta-sync">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Cloud className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white">Cuenta y Sincronización</h3>
            <p className="text-[11px] text-slate-400 truncate">
              {cuenta ? (cuenta.email || 'Cuenta Google') : 'Sin cuenta — modo local'}
            </p>
          </div>
          {cuenta && (
            <span
              className={`ml-auto text-[9px] font-mono px-2 py-1 rounded-full border shrink-0 ${
                sync?.error
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : sync?.sincronizando
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}
              data-testid="sync-estado"
            >
              {sync?.error ? 'nube rechazada' : sync?.sincronizando ? 'sincronizando…' : sync?.activo ? 'activo' : 'local'}
            </span>
          )}
        </div>

        {cuenta ? (
          <>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              Tus movimientos y saldos se guardan solos en <b className="text-slate-200">wallettrack_sync</b>
              (tu documento privado en la nube): al entrar, cada 5 min, al volver a la app
              y 8 s después de cada cambio.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2">
                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wide">Última subida</p>
                <p className="text-xs font-bold text-slate-300 mt-0.5" data-testid="sync-ultima-subida">
                  {hace(sync?.ultimaSubida ?? null)}
                </p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2">
                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wide">Última bajada</p>
                <p className="text-xs font-bold text-slate-300 mt-0.5">
                  {hace(sync?.ultimaBajada ?? null)}
                </p>
              </div>
            </div>
            {sync?.error && (
              <p className="text-[11px] text-amber-400/90 leading-relaxed mb-3 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2">
                {sync.error}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={alSincronizarAhora}
                disabled={syncTrabajando}
                data-testid="boton-sincronizar"
                className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {syncTrabajando
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
                Sincronizar ahora
              </button>
              <button
                onClick={() => setConfirmRestaurar(true)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <CloudDownload className="w-3.5 h-3.5" /> Restaurar desde la nube
              </button>
              <button
                onClick={() => setConfirmSubir(true)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <CloudUpload className="w-3.5 h-3.5" /> Subir todo
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              Estás en <b className="text-slate-200">modo local</b>: tus datos viven solo en este
              dispositivo (igual que siempre). Iniciá sesión con tu cuenta Google para
              respaldarlos y recuperarlos en cualquier teléfono.
            </p>
            <button
              onClick={onIniciarSesion}
              data-testid="boton-iniciar-sesion"
              className="w-full py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg"
            >
              <LogIn className="w-4 h-4" /> Iniciar sesión con Google
            </button>
          </>
        )}
      </section>

      {/* ── Respaldo ───────────────────────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <h3 className="font-bold text-slate-200 text-base mb-1">Respaldo de Datos</h3>
        <p className="text-xs text-slate-400 mb-4">
          Formato <span className="font-mono text-emerald-400">v3.0</span> — el MISMO del WalletTrack original:
          podés importar acá un backup del viejo y exportar para volver a él.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={exportar}
            data-testid="boton-exportar-respaldo"
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20"
          >
            <Download className="w-4 h-4" /> Exportar respaldo
          </button>
          <button
            onClick={elegirArchivo}
            data-testid="boton-importar-respaldo"
            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Upload className="w-4 h-4" /> Importar backup del viejo
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            onChange={alLeerArchivo}
            className="hidden"
            data-testid="input-respaldo"
          />
        </div>

        {esAPK() && (
          <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
            En el APK el respaldo se guarda en Documentos y se abre el menú de compartir.
          </p>
        )}
      </section>

      {/* ── Roadmap ────────────────────────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <h3 className="font-bold text-slate-200 text-base mb-1 flex items-center gap-2">
          <Map className="w-4 h-4 text-emerald-400" /> Hoja de Ruta
        </h3>
        <p className="text-xs text-slate-400 mb-4">Fases que siguen (mismo ritmo del FitTrack V2):</p>
        <div className="space-y-2.5">
          <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-3">
            <p className="text-xs font-black text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> F1 · Acceso y nube ✓ (instalada)
            </p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Login con Google + respaldo automático en wallettrack_sync y modo local.
            </p>
          </div>
          <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-3">
            <p className="text-xs font-black text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> F2 · El método completo ✓ (instalada)
            </p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Sobres de dinero, deudas y apartados, presupuestos con barras y alertas, metas de ahorro con aportes — con nube desde el día 1.
            </p>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <p className="text-xs font-black text-teal-400">F3 · Análisis y control</p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Estadísticas con gráficas, suscripciones, calendario de pagos, retos, lista de compras y export Excel/PDF.
            </p>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <p className="text-xs font-black text-fuchsia-400">F4 · 🤖 Robots · IA</p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              WalletBot junto a tus otros robots: análisis del mes, consejos de gasto y respuestas con tus datos reales.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-300 leading-relaxed">
            La app ya mantiene <b>todas</b> tus claves de datos originales (sobres, deudas,
            compras, etc.): cuando lleguen sus fases, los datos importados aparecen solos —
            y desde F1 también viajan a tu nube.
          </p>
        </div>
      </section>

      {/* ── Confirmación: restaurar desde la nube (F1) ────────── */}
      {confirmRestaurar && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmRestaurar(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-sm w-full shadow-2xl" data-testid="modal-restaurar-nube">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center shrink-0">
                <CloudDownload className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Restaurar desde la nube</h3>
                <p className="text-[11px] text-slate-400">Reemplaza este teléfono</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Los datos de este teléfono se reemplazan con los de tu nube. Útil para recuperar
              o pasar a un celu nuevo. ¿Continuar?
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setConfirmRestaurar(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-xs font-bold text-slate-300 hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarRestaurar}
                data-testid="boton-confirmar-restaurar"
                className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all"
              >
                Sí, restaurar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmación: subir todo a la nube (F1) ────────────── */}
      {confirmSubir && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmSubir(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-sm w-full shadow-2xl" data-testid="modal-subir-nube">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
                <CloudUpload className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Subir todo a la nube</h3>
                <p className="text-[11px] text-slate-400">Reemplaza la nube</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              TODO lo de este teléfono se sube y reemplaza tu nube (útil después de
              importar un respaldo o de reiniciar). ¿Continuar?
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setConfirmSubir(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-xs font-bold text-slate-300 hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarSubir}
                data-testid="boton-confirmar-subir"
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all"
              >
                Sí, subir todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmación de importación ────────────────────────── */}
      {confirmandoImport && borrador && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmandoImport(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-sm w-full shadow-2xl" data-testid="modal-importar">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Importar backup</h3>
                <p className="text-[11px] text-slate-400 truncate max-w-[180px]">{borrador.nombre}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Esto reemplazará todos tus datos actuales con los del archivo. ¿Continuar?
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => { setConfirmandoImport(false); setBorrador(null); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-xs font-bold text-slate-300 hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarImport}
                data-testid="boton-confirmar-importar"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
              >
                Sí, importar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
