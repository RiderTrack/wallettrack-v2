// ═══════════════════════════════════════════════════════════
// 🏆 RETOS — WalletTrack V2 (F3 · ANÁLISIS)
// Puerto del view-retos del original (MÓDULOS 11 y 12):
// tarjetas con nombre, descripción, objetivo (monto o días) y
// el toggle "Marcar Listo" / "✓ Completado" del toggleChallenge
// del viejo (wallettrack_challenges). Crear reto nuevo con
// objetivo y descripción, y eliminar con confirmación.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { Trophy, Plus, X, Trash2, CheckCircle2 } from 'lucide-react';
import type { EstadoWallet } from '../types';
import { crearReto, toggleReto, eliminarReto } from '../services/estado';
import { soles, parseMonto } from '../services/dinero';

interface RetosViewProps {
  estado: EstadoWallet;
  onAplicar: (nuevo: EstadoWallet) => void;
  onToast: (mensaje: string) => void;
}

export const RetosView: React.FC<RetosViewProps> = ({ estado, onAplicar, onToast }) => {
  const [creando, setCreando] = useState(false);
  const [rNombre, setRNombre] = useState('');
  const [rDesc, setRDesc] = useState('');
  const [rTarget, setRTarget] = useState('');
  const [rError, setRError] = useState('');
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  useEffect(() => {
    if (!creando) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setCreando(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [creando]);

  const guardaar = () => {
    const target = parseMonto(rTarget);
    if (target === null) { setRError('Ingresa el objetivo (monto en S/ o días)'); return; }
    const r = crearReto(estado, { name: rNombre, desc: rDesc, target });
    if (!r.ok) { setRError(r.error ?? 'No se pudo crear el reto'); return; }
    onAplicar(r.estado);
    setCreando(false);
    setRNombre(''); setRDesc(''); setRTarget(''); setRError('');
    onToast(`🏆 Reto "${rNombre.trim()}" creado`);
  };

  const marcar = (id: string) => {
    const reto = estado.challenges.find((c) => c.id === id);
    onAplicar(toggleReto(estado, id));
    onToast(reto?.status === 'complete' ? 'Reto reabierto' : '🏆 ¡Reto completado!');
  };

  const activos = estado.challenges.filter((c) => c.status !== 'complete');
  const completados = estado.challenges.filter((c) => c.status === 'complete');

  const tarjeta = (ch: EstadoWallet['challenges'][number]) => {
    const completo = ch.status === 'complete';
    const progreso = ch.target > 0 ? Math.min(100, (ch.current / ch.target) * 100) : 0;
    return (
      <div
        key={ch.id}
        data-testid={`reto-${ch.id}`}
        className={`rounded-3xl bg-slate-900 border p-5 flex items-center justify-between gap-3 ${completo ? 'border-emerald-500/30' : 'border-slate-700/80'}`}
      >
        <div className="min-w-0 flex-1">
          <h4 className={`text-sm font-bold ${completo ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{ch.name}</h4>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{ch.desc}</p>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
              <span>Objetivo: {ch.target >= 100 ? soles(ch.target, false) : ch.target}</span>
              <span>{Math.round(progreso)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full ${completo ? 'bg-emerald-400' : 'bg-amber-400'}`}
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={() => marcar(ch.id)}
            data-testid={`boton-marcar-reto-${ch.id}`}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
              completo
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            {completo ? '✓ Completado' : 'Marcar Listo'}
          </button>
          {confirmandoId === ch.id ? (
            <button
              onClick={() => { onAplicar(eliminarReto(estado, ch.id)); setConfirmandoId(null); onToast('🗑 Reto eliminado'); }}
              data-testid={`confirmar-eliminar-reto-${ch.id}`}
              className="px-3 py-1.5 rounded-xl bg-rose-500 border border-rose-400 text-white text-xs font-black transition-all active:scale-95"
            >
              ¿Eliminar?
            </button>
          ) : (
            <button
              onClick={() => setConfirmandoId(ch.id)}
              title="Eliminar reto"
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 transition-all active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5 mx-auto" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5" data-testid="vista-retos">
      {/* ── Encabezado ── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-slate-400">Retos Activos</p>
            <p className="text-2xl font-black text-white leading-tight">
              {activos.length} <span className="text-sm font-normal text-slate-400">de {estado.challenges.length}</span>
            </p>
          </div>
          <button
            onClick={() => setCreando(true)}
            data-testid="boton-nuevo-reto"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-500/20 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>
      </section>

      {/* ── Retos activos ── */}
      {activos.length > 0 && (
        <div className="space-y-3">
          {activos.map(tarjeta)}
        </div>
      )}

      {/* ── Completados ── */}
      {completados.length > 0 && (
        <div className="space-y-3" data-testid="retos-completados">
          <p className="text-[10px] font-black text-emerald-400 tracking-widest px-1">COMPLETADOS</p>
          {completados.map(tarjeta)}
        </div>
      )}

      {estado.challenges.length === 0 && (
        <div className="rounded-3xl bg-slate-900 border border-slate-700/80 p-10 text-center" data-testid="sin-retos">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-sm font-bold text-slate-300">No tienes retos aún</p>
          <p className="text-xs text-slate-500 mt-1.5">Crea tu primer reto: "Ahorrar S/ 100 esta semana", "Cero Delivery"...</p>
        </div>
      )}

      {/* ── Modal crear ── */}
      {creando && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={() => setCreando(false)} data-testid="modal-reto-backdrop">
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-amber-400">🏆 Nuevo Reto</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Un objetivo medible y una buena razón</p>
              </div>
              <button onClick={() => setCreando(false)} className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Nombre del reto</label>
              <input
                type="text" value={rNombre} onChange={(e) => setRNombre(e.target.value)}
                placeholder="Ahorrar S/ 100 esta semana"
                data-testid="reto-nombre"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Objetivo (S/ o días)</label>
              <input
                type="number" step="0.01" inputMode="decimal" value={rTarget} onChange={(e) => setRTarget(e.target.value)}
                placeholder="100"
                data-testid="reto-target"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm font-bold outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Descripción</label>
              <textarea
                value={rDesc} onChange={(e) => setRDesc(e.target.value)}
                placeholder="No realices gastos impulsivos durante 7 días seguidos."
                rows={2}
                data-testid="reto-desc"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm outline-none focus:border-amber-500/60 resize-none"
              />
            </div>
            {rError && <p className="text-xs font-bold text-rose-400" data-testid="reto-error">{rError}</p>}
            <button
              onClick={guardaar}
              data-testid="boton-guardar-reto"
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-white text-sm font-black shadow-lg shadow-amber-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Crear Reto
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
