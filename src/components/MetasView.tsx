// ═══════════════════════════════════════════════════════════
// 🎯 METAS DE AHORRO — WalletTrack V2 (F2 · DINERO)
// Metas con objetivo, fecha y aportes: cada abono sube el
// progreso y queda en tu historial como gasto "Ahorro" —
// exactamente el flujo del original (wallettrack_goals).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { Target, Plus, X, Trash2, TrendingUp, Flag } from 'lucide-react';
import type { EstadoWallet, Meta } from '../types';
import { crearMeta, abonarMeta, eliminarMeta } from '../services/estado';
import type { DatosMeta } from '../services/estado';
import { soles, parseMonto, fechaCorta } from '../services/dinero';

interface MetasViewProps {
  estado: EstadoWallet;
  onAplicar: (nuevo: EstadoWallet) => void;
  onToast: (mensaje: string) => void;
}

export const MetasView: React.FC<MetasViewProps> = ({ estado, onAplicar, onToast }) => {
  // Modal nueva meta
  const [creando, setCreando] = useState(false);
  const [nNombre, setNNombre] = useState('');
  const [nTarget, setNTarget] = useState('');
  const [nCurrent, setNCurrent] = useState('');
  const [nFecha, setNFecha] = useState('');
  const [nError, setNError] = useState('');

  // Modal abono
  const [abonandoId, setAbonandoId] = useState<string | null>(null);
  const [aMonto, setAMonto] = useState('');
  const [aError, setAError] = useState('');

  // Confirmaciones de borrado (por meta)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  useEffect(() => {
    if (!creando && !abonandoId) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setCreando(false);
      setAbonandoId(null);
      setAError('');
      setAMonto('');
      setNError('');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [creando, abonandoId]);

  const totalAhorrado = estado.goals.reduce((acc, g) => acc + (Number(g.current) || 0), 0);
  const totalObjetivo = estado.goals.reduce((acc, g) => acc + (Number(g.target) || 0), 0);
  const abonandoMeta = estado.goals.find((g) => g.id === abonandoId) ?? null;

  const guardarNueva = () => {
    const target = parseMonto(nTarget);
    if (target === null) { setNError('Ingresa un objetivo mayor a cero'); return; }
    const datos: DatosMeta = {
      name: nNombre,
      target,
      current: parseMonto(nCurrent) ?? 0,
      date: nFecha,
    };
    const r = crearMeta(estado, datos);
    if (!r.ok) { setNError(r.error ?? 'No se pudo crear la meta'); return; }
    onAplicar(r.estado);
    setCreando(false);
    setNNombre(''); setNTarget(''); setNCurrent(''); setNFecha(''); setNError('');
    onToast(`🎯 Meta "${datos.name.trim()}" creada`);
  };

  const confirmarAbono = () => {
    if (!abonandoMeta) return;
    const extra = parseMonto(aMonto);
    if (extra === null) { setAError('Ingresa un monto mayor a cero'); return; }
    const r = abonarMeta(estado, abonandoMeta.id, extra);
    if (!r.ok) { setAError(r.error ?? 'No se pudo abonar'); return; }
    onAplicar(r.estado);
    setAbonandoId(null);
    setAMonto('');
    setAError('');
    onToast(`🎯 ${soles(extra)} a "${abonandoMeta.name}"`);
  };

  const eliminar = (id: string) => {
    onAplicar(eliminarMeta(estado, id));
    setConfirmandoId(null);
    onToast('🗑 Meta eliminada');
  };

  const hoy = new Date();
  const diasRestantes = (m: Meta): number | null => {
    if (!m.date) return null;
    const f = new Date(`${m.date}T00:00:00`);
    if (Number.isNaN(f.getTime())) return null;
    return Math.ceil((f.getTime() - hoy.getTime()) / 86_400_000);
  };

  return (
    <div className="space-y-5" data-testid="vista-metas">
      {/* ── Resumen ── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-slate-400">Ahorrado de tus {estado.goals.length} meta{estado.goals.length === 1 ? '' : 's'}</p>
            <p className="text-2xl font-black text-white leading-tight">
              {soles(totalAhorrado)} <span className="text-sm font-normal text-slate-400">de {soles(totalObjetivo)}</span>
            </p>
          </div>
          <button
            onClick={() => setCreando(true)}
            data-testid="boton-nueva-meta"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" /> Nueva Meta
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          Cada aporte queda en tu historial como gasto "Ahorro" — así ves en el mes cuánto guardaste.
        </p>
      </section>

      {/* ── Grid de metas ── */}
      {estado.goals.length === 0 ? (
        <div className="rounded-3xl bg-slate-900 border border-slate-700/80 p-10 text-center" data-testid="sin-metas">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-sm font-bold text-slate-300">Todavía no tienes metas</p>
          <p className="text-xs text-slate-500 mt-1.5">Fijo un objetivo (fondo de emergencia, un viaje, la moto) y aporta semana a semana</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {estado.goals.map((m) => {
            const target = Number(m.target) || 0;
            const current = Number(m.current) || 0;
            const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            const completa = pct >= 100;
            const dias = diasRestantes(m);
            return (
              <div key={m.id} className="rounded-2xl bg-slate-900 border border-slate-700/80 p-4 relative overflow-hidden" data-testid={`tarjeta-meta-${m.id}`}>
                <div className="absolute left-0 top-0 h-full pointer-events-none transition-all duration-500" style={{ width: `${pct}%`, background: '#10b981', opacity: 0.06 }} />
                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white truncate">{m.name}</p>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Flag className="w-3 h-3" /> {m.date ? fechaCorta(m.date) : 'sin fecha'}
                        {dias !== null && !completa && (
                          <span className={dias < 0 ? 'text-rose-400' : dias < 30 ? 'text-amber-300' : ''}>
                            {dias < 0 ? ` · vencida hace ${Math.abs(dias)}d` : ` · faltan ${dias}d`}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className={`text-sm font-black shrink-0 ${completa ? 'text-emerald-400' : 'text-emerald-300'}`}>
                      {completa ? '🎉' : ''}{pct}%
                    </span>
                  </div>

                  <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60 mb-2.5">
                    <div className={`h-full rounded-full transition-all duration-500 ${completa ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                  </div>

                  <div className="flex justify-between items-center text-[11px] mb-3">
                    <span className="text-slate-300 font-bold">{soles(current)} <span className="text-slate-500 font-normal">de {soles(target)}</span></span>
                    <span className="text-slate-400 font-bold">{completa ? '¡completada!' : `faltan ${soles(target - current)}`}</span>
                  </div>

                  <div className="flex gap-2">
                    {!completa && (
                      <button
                        onClick={() => { setAbonandoId(m.id); setAMonto(''); setAError(''); }}
                        data-testid={`boton-abonar-meta-${m.id}`}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all active:scale-[0.97] flex items-center justify-center gap-1.5"
                      >
                        <TrendingUp className="w-3.5 h-3.5" /> Aportar
                      </button>
                    )}
                    {confirmandoId === m.id ? (
                      <div className="flex gap-1.5 flex-1">
                        <button onClick={() => setConfirmandoId(null)} className="flex-1 text-[10px] py-2 rounded-xl border border-slate-600 text-slate-400 font-bold">No</button>
                        <button onClick={() => eliminar(m.id)} data-testid="boton-confirmar-eliminar-meta" className="flex-1 text-[10px] py-2 rounded-xl bg-rose-600 text-white font-bold">Sí, eliminar</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmandoId(m.id)} data-testid={`boton-eliminar-meta-${m.id}`} className="px-3 py-2 rounded-xl bg-slate-800 text-rose-400 border border-slate-700 hover:bg-rose-500/10 transition-all" title="Eliminar meta">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: nueva meta ── */}
      {creando && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCreando(false)} />
          <div className="relative w-full sm:max-w-md bg-slate-900 border rounded-t-3xl sm:rounded-3xl border-slate-700 border-t-2 border-t-emerald-500 shadow-2xl p-5 max-h-[92vh] overflow-y-auto custom-scrollbar" data-testid="modal-nueva-meta">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <Target className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-white">Nueva Meta</h3>
                <p className="text-[11px] text-slate-400">¿Para qué estás ahorrando?</p>
              </div>
              <button onClick={() => setCreando(false)} className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white flex items-center justify-center transition-all shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Nombre de la meta</label>
                <input type="text" value={nNombre} onChange={(e) => { setNNombre(e.target.value); setNError(''); }} placeholder="Ej: Fondo de Emergencia" data-testid="input-meta-nombre"
                  className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Objetivo (S/)</label>
                  <input type="number" inputMode="decimal" step="0.01" min="0" value={nTarget} onChange={(e) => { setNTarget(e.target.value); setNError(''); }} placeholder="5000" data-testid="input-meta-target"
                    className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Ya ahorrado <span className="text-slate-600 font-normal">(opcional)</span></label>
                  <input type="number" inputMode="decimal" step="0.01" min="0" value={nCurrent} onChange={(e) => setNCurrent(e.target.value)} placeholder="0" data-testid="input-meta-current"
                    className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Fecha objetivo <span className="text-slate-600 font-normal">(opcional)</span></label>
                <input type="date" value={nFecha} onChange={(e) => setNFecha(e.target.value)} data-testid="input-meta-fecha"
                  className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60" />
              </div>

              {nError && <p data-testid="error-meta" className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{nError}</p>}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setCreando(false)} className="flex-1 py-3 rounded-xl border border-slate-600 text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-all">Cancelar</button>
                <button onClick={guardarNueva} data-testid="boton-guardar-meta" className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]">Crear meta</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: abono rápido ── */}
      {abonandoMeta && (() => {
        const m = abonandoMeta;
        const restante = Math.max(0, (Number(m.target) || 0) - (Number(m.current) || 0));
        return (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setAbonandoId(null); setAError(''); }} />
            <div className="relative w-full sm:max-w-sm bg-slate-900 border rounded-t-3xl sm:rounded-3xl border-slate-700 border-t-2 border-t-emerald-500 shadow-2xl p-5" data-testid="modal-abono">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-black text-white truncate">{m.name}</h3>
                  <p className="text-[11px] text-slate-400">{soles(restante)} restantes</p>
                </div>
                <button onClick={() => setAbonandoId(null)} className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white flex items-center justify-center transition-all shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Monto a aportar (S/)</label>
                  <input type="number" inputMode="decimal" step="0.01" min="0" value={aMonto} onChange={(e) => { setAMonto(e.target.value); setAError(''); }} placeholder="0.00" autoFocus data-testid="input-abono-monto"
                    className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60" />
                </div>
                {aError && <p data-testid="error-abono" className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{aError}</p>}
                <button onClick={confirmarAbono} data-testid="boton-confirmar-abono" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]">
                  🎯 Aportar a la meta
                </button>
                <p className="text-[10px] text-slate-500 text-center">Se registra como gasto "Ahorro" en tu historial del mes</p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
