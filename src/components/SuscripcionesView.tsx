// ═══════════════════════════════════════════════════════════
// 🔄 SUSCRIPCIONES — WalletTrack V2 (F3 · ANÁLISIS)
// Gastos fijos recurrentes (wallettrack_subscriptions), puerto
// del MÓDULO 14 del original: tarjeta por fijo con el estado de
// vencimiento (⚠️ Vencido · 🔴 Vence HOY · ⏰ En N días · 📅 En N
// días), botones ✅ Pagar (gasto real desde su cuenta + próxima
// fecha +1 mes), ✏️ Editar y 🗑 Baja. El Pagar usa las reglas
// literales del viejo: categoría "emoji nombre", descripción
// "emoji Pago fijo: nombre".
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { Repeat, Plus, X, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import type { EstadoWallet, Suscripcion } from '../types';
import {
  crearSuscripcion, editarSuscripcion, eliminarSuscripcion, pagarSuscripcion, diasHasta,
} from '../services/estado';
import type { DatosSuscripcion } from '../services/estado';
import { soles, parseMonto, fechaCorta } from '../services/dinero';
import { CUENTAS_CATALOG } from '../data/catalogos';

const EMOJIS_FIJOS = ['🔄', '📺', '🎵', '🌐', '💡', '💧', '🏠', '📱', '🎮', '💪', '🚗', '📦'];

interface SuscripcionesViewProps {
  estado: EstadoWallet;
  onAplicar: (nuevo: EstadoWallet) => void;
  onToast: (mensaje: string) => void;
}

export const SuscripcionesView: React.FC<SuscripcionesViewProps> = ({ estado, onAplicar, onToast }) => {
  const [modal, setModal] = useState<null | 'nuevo' | { editar: Suscripcion }>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  // Campos del form
  const [fNombre, setFNombre] = useState('');
  const [fCosto, setFCosto] = useState('');
  const [fDue, setFDue] = useState('');
  const [fEmoji, setFEmoji] = useState('🔄');
  const [fCuenta, setFCuenta] = useState('efectivo');
  const [fError, setFError] = useState('');

  useEffect(() => {
    if (!modal) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [modal]);

  const abrirNuevo = () => {
    setFNombre(''); setFCosto(''); setFDue(''); setFEmoji('🔄'); setFCuenta('efectivo'); setFError('');
    setModal('nuevo');
  };

  const abrirEditar = (sub: Suscripcion) => {
    setFNombre(sub.name); setFCosto(sub.cost.toFixed(2)); setFDue(sub.due);
    setFEmoji(sub.emoji || '🔄'); setFCuenta(sub.cuenta || 'efectivo'); setFError('');
    setModal({ editar: sub });
  };

  const guardar = () => {
    const costo = parseMonto(fCosto);
    const datos: DatosSuscripcion = {
      name: fNombre, cost: costo ?? 0, due: fDue, emoji: fEmoji, cuenta: fCuenta,
    };
    if (modal === 'nuevo') {
      const r = crearSuscripcion(estado, datos);
      if (!r.ok) { setFError(r.error ?? 'No se pudo guardar'); return; }
      onAplicar(r.estado);
      onToast(`✅ Gasto fijo "${fNombre.trim()}" guardado`);
    } else if (modal && 'editar' in modal) {
      const r = editarSuscripcion(estado, modal.editar.id, datos);
      if (!r.ok) { setFError(r.error ?? 'No se pudo actualizar'); return; }
      onAplicar(r.estado);
      onToast('✅ Gasto fijo actualizado');
    }
    setModal(null);
  };

  const pagar = (id: string) => {
    const r = pagarSuscripcion(estado, id);
    if (!r.ok || !r.sub) { onToast(r.error ?? 'No se pudo pagar'); return; }
    onAplicar(r.estado);
    onToast(`✅ ${soles(r.sub.cost)} pagado · próx. ${r.sub.due}`);
  };

  const darBaja = (id: string) => {
    onAplicar(eliminarSuscripcion(estado, id));
    setConfirmandoId(null);
    onToast('🗑 Gasto fijo cancelado');
  };

  const total = estado.subscriptions.reduce((a, s) => a + (Number(s.cost) || 0), 0);
  const vencen = estado.subscriptions.some((s) => diasHasta(s.due) <= 3);
  const ordenadas = [...estado.subscriptions].sort((a, b) => new Date(`${a.due}T00:00:00`).getTime() - new Date(`${b.due}T00:00:00`).getTime());

  return (
    <div className="space-y-5" data-testid="vista-suscripciones">
      {/* ── Resumen ── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center shrink-0">
            <Repeat className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-slate-400">Gastos fijos mensuales</p>
            <p className="text-2xl font-black text-white leading-tight" data-testid="fijos-total-mensual">{soles(total)}</p>
          </div>
          {vencen && (
            <span data-testid="fijos-badge-vencen" className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 shrink-0">
              ⏰ Vencen pronto
            </span>
          )}
          <button
            onClick={abrirNuevo}
            data-testid="boton-nuevo-fijo"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          El total de tus fijos se descuenta del disponible del mes. Pagar registra el gasto real desde la cuenta elegida y corre el vencimiento un mes.
        </p>
      </section>

      {/* ── Grid de fijos ── */}
      {ordenadas.length === 0 ? (
        <div className="rounded-3xl bg-slate-900 border border-slate-700/80 p-10 text-center" data-testid="sin-fijos">
          <p className="text-4xl mb-3">🔄</p>
          <p className="text-sm font-bold text-slate-300">Sin gastos fijos</p>
          <p className="text-xs text-slate-500 mt-1.5">Agrega internet, luz, renta, posPago...</p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="lista-fijos">
          {ordenadas.map((sub) => {
            const dias = diasHasta(sub.due);
            const vencido = dias < 0;
            const hoy = dias === 0;
            const proximo = dias >= 0 && dias <= 3;
            const cuenta = CUENTAS_CATALOG.find((c) => c.id === (sub.cuenta || 'efectivo'));
            const lbl = vencido ? '⚠️ Vencido' : hoy ? '🔴 Vence HOY' : proximo ? `⏰ En ${dias} día${dias !== 1 ? 's' : ''}` : `📅 En ${dias} días`;
            const col = vencido ? 'text-rose-400 bg-rose-500/15 border-rose-500/30' : hoy ? 'text-orange-400 bg-orange-500/15 border-orange-500/30' : proximo ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' : 'text-slate-400 bg-white/5 border-white/10';
            const borde = vencido ? 'border-rose-500/40' : hoy ? 'border-orange-500/40' : proximo ? 'border-amber-500/30' : 'border-slate-700/80';
            return (
              <div key={sub.id} className={`rounded-3xl bg-slate-900 border ${borde} p-4`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shrink-0">{sub.emoji || '🔄'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-100 truncate">{sub.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      <span style={{ color: cuenta?.color }}>{cuenta?.icon} {cuenta?.name}</span> · próx. <b className="text-slate-300">{fechaCorta(sub.due)}</b>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black text-slate-100">{soles(sub.cost)}</p>
                    <p className="text-[9px] text-slate-500">mensual</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${col}`} data-testid={`fijo-estado-${sub.id}`}>{lbl}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => pagar(sub.id)}
                      data-testid={`boton-pagar-fijo-${sub.id}`}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black transition-all active:scale-95"
                    >
                      ✅ Pagar
                    </button>
                    <button
                      onClick={() => abrirEditar(sub)}
                      title="Editar"
                      className="px-2.5 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-400 transition-all active:scale-95"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {confirmandoId === sub.id ? (
                      <button
                        onClick={() => darBaja(sub.id)}
                        data-testid={`confirmar-baja-${sub.id}`}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-500 border border-rose-400 text-white text-xs font-black transition-all active:scale-95"
                      >
                        ¿Seguro?
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmandoId(sub.id)}
                        title="Dar de baja"
                        className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 transition-all active:scale-95"
                      >
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

      {/* ── Modal nuevo / editar ── */}
      {modal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={() => setModal(null)} data-testid="modal-fijo-backdrop">
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 p-5 space-y-3 max-h-[92vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-indigo-400">{modal === 'nuevo' ? '🔄 Nuevo Gasto Fijo' : '✏️ Editar Gasto Fijo'}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Suscripción o recurrencia mensual</p>
              </div>
              <button onClick={() => setModal(null)} className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Nombre</label>
              <input
                type="text" value={fNombre} onChange={(e) => setFNombre(e.target.value)}
                placeholder="Internet, Luz, Renta..."
                data-testid="fijo-nombre"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm outline-none focus:border-indigo-500/60"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Costo mensual (S/)</label>
                <input
                  type="number" step="0.01" inputMode="decimal" value={fCosto} onChange={(e) => setFCosto(e.target.value)}
                  placeholder="44.90"
                  data-testid="fijo-costo"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm font-bold outline-none focus:border-indigo-500/60"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Próximo pago</label>
                <input
                  type="date" value={fDue} onChange={(e) => setFDue(e.target.value)}
                  data-testid="fijo-due"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm outline-none focus:border-indigo-500/60"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Icono</label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS_FIJOS.map((em) => (
                  <button
                    key={em} onClick={() => setFEmoji(em)}
                    className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all ${fEmoji === em ? 'bg-indigo-500/20 border border-indigo-500/50' : 'bg-white/5 border border-white/10'}`}
                  >{em}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Cuenta desde donde pagas</label>
              <select
                value={fCuenta} onChange={(e) => setFCuenta(e.target.value)}
                data-testid="fijo-cuenta"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm outline-none focus:border-indigo-500/60"
              >
                {CUENTAS_CATALOG.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>

            {fError && <p className="text-xs font-bold text-rose-400" data-testid="fijo-error">{fError}</p>}

            <button
              onClick={guardar}
              data-testid="boton-guardar-fijo"
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-black shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {modal === 'nuevo' ? <><Plus className="w-4 h-4" /> Guardar Gasto Fijo</> : <><CheckCircle2 className="w-4 h-4" /> Guardar Cambios</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
