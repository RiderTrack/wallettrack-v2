// ═══════════════════════════════════════════════════════════
// 🐷 PRESUPUESTOS — WalletTrack V2 (F2 · DINERO)
// Límite por categoría para el mes en curso, con barra de
// avance y alertas al 80% (⚡ CASI LLENO) y 100% (⚠️ EXCEDIDO)
// — exactamente las reglas del original. La barra se llena con
// los gastos reales del mes (wallettrack_budgets).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { PiggyBank, Plus, X, Trash2 } from 'lucide-react';
import type { EstadoWallet } from '../types';
import { guardarPresupuesto, eliminarPresupuesto, gastosDelMesPorCategoria } from '../services/estado';
import type { DatosPresupuesto } from '../services/estado';
import { soles, parseMonto, nombreMesActual } from '../services/dinero';
import { CATS_GASTO_DEFAULT } from '../data/catalogos';

const COLORES_PRESUPUESTO = ['#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

interface PresupuestosViewProps {
  estado: EstadoWallet;
  onAplicar: (nuevo: EstadoWallet) => void;
  onToast: (mensaje: string) => void;
}

export const PresupuestosView: React.FC<PresupuestosViewProps> = ({ estado, onAplicar, onToast }) => {
  const [creando, setCreando] = useState(false);
  const [nCategoria, setNCategoria] = useState(CATS_GASTO_DEFAULT[0]?.nombre ?? 'Otros');
  const [nLimite, setNLimite] = useState('');
  const [nColor, setNColor] = useState(COLORES_PRESUPUESTO[0]);
  const [nError, setNError] = useState('');
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  useEffect(() => {
    if (!creando) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setCreando(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [creando]);

  const gastosCat = gastosDelMesPorCategoria(estado);
  const totalLimit = estado.budgets.reduce((acc, b) => acc + (Number(b.limit) || 0), 0);
  const totalSpent = estado.budgets.reduce((acc, b) => acc + (gastosCat[b.category] || 0), 0);
  const totalLeft = totalLimit - totalSpent;

  const mesLabel = nombreMesActual();
  const mesCapital = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);

  const categorias = [...CATS_GASTO_DEFAULT, ...estado.categoriasGasto]
    .map((c) => c.nombre)
    .filter((n, i, arr) => arr.indexOf(n) === i);
  const yaPresupuestadas = new Set(estado.budgets.map((b) => b.category));

  const guardar = () => {
    const limite = parseMonto(nLimite);
    if (limite === null) { setNError('Ingresa un límite mayor a cero'); return; }
    const datos: DatosPresupuesto = { categoria: nCategoria, limit: limite, color: nColor };
    const r = guardarPresupuesto(estado, datos);
    if (!r.ok) { setNError(r.error ?? 'No se pudo guardar el presupuesto'); return; }
    const esUpdate = yaPresupuestadas.has(nCategoria);
    onAplicar(r.estado);
    setCreando(false);
    setNLimite('');
    setNError('');
    onToast(esUpdate ? `Presupuesto de ${nCategoria} actualizado` : `🐷 Presupuesto de ${nCategoria} creado`);
  };

  const eliminar = (id: string) => {
    onAplicar(eliminarPresupuesto(estado, id));
    setConfirmandoId(null);
    onToast('🗑 Presupuesto eliminado');
  };

  return (
    <div className="space-y-5" data-testid="vista-presupuestos">
      {/* ── Resumen del mes ── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center shrink-0">
            <PiggyBank className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-slate-400" data-testid="presupuesto-mes">{mesCapital}</p>
            <p className="text-2xl font-black text-white leading-tight">
              {soles(totalSpent)} <span className="text-sm font-normal text-slate-400">de {soles(totalLimit)}</span>
            </p>
          </div>
          <button
            onClick={() => setCreando(true)}
            data-testid="boton-nuevo-presupuesto"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-950/60 border border-slate-700/60 p-2.5 text-center">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Límite total</p>
            <p className="text-sm font-black text-cyan-300">{soles(totalLimit, false)}</p>
          </div>
          <div className="rounded-xl bg-slate-950/60 border border-slate-700/60 p-2.5 text-center">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Gastado</p>
            <p className="text-sm font-black text-rose-300">{soles(totalSpent, false)}</p>
          </div>
          <div className="rounded-xl bg-slate-950/60 border border-slate-700/60 p-2.5 text-center">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Disponible</p>
            <p className={`text-sm font-black ${totalLeft < 0 ? 'text-rose-400' : 'text-emerald-300'}`} data-testid="presupuesto-disponible">
              {soles(Math.abs(totalLeft), false)}{totalLeft < 0 ? ' ⚠️' : ''}
            </p>
          </div>
        </div>
      </section>

      {/* ── Grid de presupuestos ── */}
      {estado.budgets.length === 0 ? (
        <div className="rounded-3xl bg-slate-900 border border-slate-700/80 p-10 text-center" data-testid="sin-presupuestos">
          <p className="text-4xl mb-3">🐷</p>
          <p className="text-sm font-bold text-slate-300">No tienes presupuestos aún</p>
          <p className="text-xs text-slate-500 mt-1.5">Ponle un límite a tus categorías y la barra te avisa antes de pasarte</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {estado.budgets.map((b) => {
            const spent = gastosCat[b.category] || 0;
            const left = (Number(b.limit) || 0) - spent;
            const pct = b.limit > 0 ? Math.min(100, Math.round((spent / b.limit) * 100)) : 0;
            const over = pct >= 100;
            const warning = pct >= 80 && !over;
            const barColor = over ? '#fb7185' : warning ? '#fbbf24' : b.color;
            return (
              <div key={b.id} className="rounded-2xl bg-slate-900 border border-slate-700/80 p-4 relative overflow-hidden" data-testid={`tarjeta-presupuesto-${b.id}`}>
                <div className="absolute left-0 top-0 h-full pointer-events-none transition-all duration-500" style={{ width: `${pct}%`, background: barColor, opacity: 0.07 }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl shrink-0">{b.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-100 truncate">{b.category}</p>
                        <p className="text-[10px] text-slate-500">Límite: {soles(Number(b.limit) || 0, false)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {over && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">⚠️ EXCEDIDO</span>}
                      {warning && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/12 text-amber-300 border border-amber-500/25">⚡ CASI LLENO</span>}
                      {confirmandoId === b.id ? (
                        <div className="flex gap-1.5">
                          <button onClick={() => setConfirmandoId(null)} className="text-[10px] px-2 py-1 rounded-lg border border-slate-600 text-slate-400 font-bold">No</button>
                          <button onClick={() => eliminar(b.id)} data-testid="boton-confirmar-eliminar-presupuesto" className="text-[10px] px-2 py-1 rounded-lg bg-rose-600 text-white font-bold">Sí</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmandoId(b.id)} data-testid="boton-eliminar-presupuesto" className="text-[10px] px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold hover:bg-rose-500/20 transition-all">✕</button>
                      )}
                    </div>
                  </div>
                  <div className={`h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60 mb-2.5 ${over ? 'animate-pulse' : ''}`}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-rose-300 font-bold">{soles(spent)} gastado</span>
                    <span className={left < 0 ? 'text-rose-400 font-bold' : 'text-slate-400 font-bold'}>
                      {left < 0 ? `excedido ${soles(Math.abs(left))}` : `queda ${soles(left)}`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: nuevo presupuesto ── */}
      {creando && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCreando(false)} />
          <div className="relative w-full sm:max-w-md bg-slate-900 border rounded-t-3xl sm:rounded-3xl border-slate-700 border-t-2 border-t-cyan-500 shadow-2xl p-5 max-h-[92vh] overflow-y-auto custom-scrollbar" data-testid="modal-nuevo-presupuesto">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center shrink-0">
                <PiggyBank className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-white">Nuevo Presupuesto</h3>
                <p className="text-[11px] text-slate-400">Límite mensual por categoría · {mesCapital}</p>
              </div>
              <button onClick={() => setCreando(false)} className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white flex items-center justify-center transition-all shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Categoría</label>
                <select value={nCategoria} onChange={(e) => setNCategoria(e.target.value)} data-testid="select-presupuesto-categoria"
                  className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/60">
                  {categorias.map((n) => (
                    <option key={n} value={n}>{yaPresupuestadas.has(n) ? `${n} (ya tiene — se actualiza)` : n}</option>
                  ))}
                </select>
                {yaPresupuestadas.has(nCategoria) && (
                  <p className="text-[10px] text-amber-300 mt-1.5">💡 "{nCategoria}" ya tiene presupuesto: guardar actualiza su límite y color</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Límite del mes (S/)</label>
                <input type="number" inputMode="decimal" step="0.01" min="0" value={nLimite} onChange={(e) => { setNLimite(e.target.value); setNError(''); }} placeholder="0.00" data-testid="input-presupuesto-limite"
                  className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/60" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORES_PRESUPUESTO.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNColor(c)}
                      data-testid={`color-presupuesto-${c.replace('#', '')}`}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${nColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ background: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </div>

              {nError && <p data-testid="error-presupuesto" className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{nError}</p>}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setCreando(false)} className="flex-1 py-3 rounded-xl border border-slate-600 text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-all">Cancelar</button>
                <button onClick={guardar} data-testid="boton-guardar-presupuesto" className="flex-1 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98]">Guardar presupuesto</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
