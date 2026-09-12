// ═══════════════════════════════════════════════════════════
// ✉️ SOBRES DE DINERO — WalletTrack V2 (F2 · DINERO)
// El método de sobres del WalletTrack original: cada sobre
// guarda su propio saldo, se recarga (desde tu balance o manual)
// y se gasta con historial por sobre. Formas de datos 1:1 con el
// viejo (wallettrack_sobres + wallettrack_sobre_movs).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { Layers, Plus, X, Trash2, ArrowDownCircle, ArrowUpCircle, History } from 'lucide-react';
import type { EstadoWallet, Sobre } from '../types';
import {
  crearSobre, recargarSobre, gastarDesdeSobre, eliminarSobre,
  sobreDisponible, sobreTotalCargado, sobreGastado, movimientosDeSobre,
} from '../services/estado';
import type { DatosSobre } from '../services/estado';
import { soles, parseMonto, fechaCorta } from '../services/dinero';

const EMOJIS_SOBRE = ['✉️', '🍔', '⛽', '🎬', '🏠', '☕', '🚌', '💊', '🛍', '🔧', '✈️', '🎮', '🎁', '🐶'];
const COLORES_SOBRE = ['#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

interface SobresViewProps {
  estado: EstadoWallet;
  onAplicar: (nuevo: EstadoWallet) => void;
  onToast: (mensaje: string) => void;
}

export const SobresView: React.FC<SobresViewProps> = ({ estado, onAplicar, onToast }) => {
  // Modal nuevo sobre
  const [creando, setCreando] = useState(false);
  const [nNombre, setNNombre] = useState('');
  const [nMonto, setNMonto] = useState('');
  const [nEmoji, setNEmoji] = useState('✉️');
  const [nColor, setNColor] = useState(COLORES_SOBRE[0]);
  const [nOrigen, setNOrigen] = useState<'balance' | 'manual'>('balance');
  const [nError, setNError] = useState('');

  // Modal sobre activo
  const [activoId, setActivoId] = useState<string | null>(null);
  const [tab, setTab] = useState<'gastar' | 'recargar' | 'historial'>('gastar');
  const [gMonto, setGMonto] = useState('');
  const [gDesc, setGDesc] = useState('');
  const [rMonto, setRMonto] = useState('');
  const [rOrigen, setROrigen] = useState<'balance' | 'manual'>('balance');
  const [sError, setSError] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  // ESC cierra modales
  useEffect(() => {
    if (!creando && !activoId) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setCreando(false);
      cerrarSobre();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creando, activoId]);

  const activo = estado.sobres.find((s) => s.id === activoId) ?? null;
  const totalEnSobres = estado.sobres.reduce((acc, s) => acc + sobreDisponible(estado, s.id), 0);

  const cerrarSobre = () => {
    setActivoId(null);
    setTab('gastar');
    setGMonto('');
    setGDesc('');
    setRMonto('');
    setROrigen('balance');
    setSError('');
    setConfirmando(false);
  };

  const abrirSobre = (id: string) => {
    setActivoId(id);
    setTab('gastar');
    setGMonto('');
    setGDesc('');
    setRMonto('');
    setROrigen('balance');
    setSError('');
    setConfirmando(false);
  };

  const guardarNuevo = () => {
    const monto = parseMonto(nMonto);
    if (monto === null) { setNError('Ingresa un monto mayor a cero'); return; }
    const datos: DatosSobre = { nombre: nNombre, emoji: nEmoji, monto, color: nColor, origen: nOrigen };
    const r = crearSobre(estado, datos);
    if (!r.ok) { setNError(r.error ?? 'No se pudo crear el sobre'); return; }
    onAplicar(r.estado);
    setCreando(false);
    setNNombre('');
    setNMonto('');
    setNError('');
    onToast(`✅ Sobre "${datos.nombre.trim()}" creado`);
  };

  const gastar = () => {
    if (!activo) return;
    const monto = parseMonto(gMonto);
    if (monto === null) { setSError('Ingresa un monto mayor a cero'); return; }
    const r = gastarDesdeSobre(estado, activo.id, monto, gDesc);
    if (!r.ok) { setSError(r.error ?? 'No se pudo registrar el gasto'); return; }
    onAplicar(r.estado);
    setGMonto('');
    setGDesc('');
    setSError('');
    onToast(`💸 Gasto registrado en sobre "${activo.nombre}"`);
  };

  const recargar = () => {
    if (!activo) return;
    const monto = parseMonto(rMonto);
    if (monto === null) { setSError('Ingresa un monto mayor a cero'); return; }
    const r = recargarSobre(estado, activo.id, monto, rOrigen);
    if (!r.ok) { setSError(r.error ?? 'No se pudo recargar el sobre'); return; }
    onAplicar(r.estado);
    setRMonto('');
    setSError('');
    onToast(`💰 ${soles(monto)} agregado al sobre`);
  };

  const eliminar = () => {
    if (!activo) return;
    onAplicar(eliminarSobre(estado, activo.id));
    cerrarSobre();
    onToast('🗑 Sobre eliminado');
  };

  // ── Vista de un sobre activo ──
  let barraSobre: React.ReactNode = null;
  if (activo) {
    const disponible = sobreDisponible(estado, activo.id);
    const totalCargado = sobreTotalCargado(estado, activo.id);
    const gastado = sobreGastado(estado, activo.id);
    const pct = totalCargado > 0 ? Math.min(100, Math.round((gastado / totalCargado) * 100)) : 0;
    const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : activo.color;
    barraSobre = (
      <div className="rounded-2xl bg-slate-950/70 border border-slate-700/70 p-4">
        <div className="flex items-end justify-between mb-2">
          <p className="text-sm font-black text-white">{soles(disponible)} <span className="text-[11px] font-normal text-slate-400">disponible</span></p>
          <p className="text-xs font-black text-slate-300">{pct}%</p>
        </div>
        <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
        </div>
        <div className="flex justify-between mt-2 text-[11px] text-slate-400">
          <span>{soles(gastado)} gastado</span>
          <span>{soles(disponible)} queda</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="vista-sobres">
      {/* ── Resumen ── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-slate-400">Total en sobres</p>
            <p className="text-2xl font-black text-white leading-tight">{soles(totalEnSobres)}</p>
          </div>
          <button
            onClick={() => setCreando(true)}
            data-testid="boton-nuevo-sobre"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-500/20 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" /> Nuevo Sobre
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          El dinero de los sobres ya salió de tus cuentas (si lo cargaste desde tu saldo) — el sobre solo lo organiza.
        </p>
      </section>

      {/* ── Grid de sobres ── */}
      {estado.sobres.length === 0 ? (
        <div className="rounded-3xl bg-slate-900 border border-slate-700/80 p-10 text-center" data-testid="sin-sobres">
          <p className="text-4xl mb-3">✉️</p>
          <p className="text-sm font-bold text-slate-300">Todavía no tienes sobres</p>
          <p className="text-xs text-slate-500 mt-1.5">Crea tu primer sobre y aparta dinero para un gasto concreto</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {estado.sobres.map((s) => {
            const disponible = sobreDisponible(estado, s.id);
            const totalCargado = sobreTotalCargado(estado, s.id);
            const gastado = totalCargado - disponible;
            const pct = totalCargado > 0 ? Math.min(100, Math.round((gastado / totalCargado) * 100)) : 0;
            const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : s.color;
            return (
              <button
                key={s.id}
                onClick={() => abrirSobre(s.id)}
                data-testid={`tarjeta-sobre-${s.id}`}
                className="text-left rounded-2xl p-4 border transition-all active:scale-[0.97] hover:brightness-110 relative overflow-hidden"
                style={{ background: `linear-gradient(140deg, ${s.color}1f, #0f172a66)`, borderColor: `${s.color}55` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-2xl leading-none">{s.emoji}</span>
                  <span className="text-[9px] font-bold text-slate-400">{fechaCorta(s.fechaCreacion)}</span>
                </div>
                <p className="text-sm font-black text-white truncate">{s.nombre}</p>
                <p className="text-base font-black mt-1" style={{ color: s.color }}>{soles(disponible, false)}</p>
                <div className="h-1.5 bg-black/30 rounded-full overflow-hidden mt-2.5">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">{pct}% usado</p>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Modal: nuevo sobre ── */}
      {creando && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCreando(false)} />
          <div className="relative w-full sm:max-w-md bg-slate-900 border rounded-t-3xl sm:rounded-3xl border-slate-700 border-t-2 border-t-amber-500 shadow-2xl p-5 max-h-[92vh] overflow-y-auto custom-scrollbar" data-testid="modal-nuevo-sobre">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-white">Nuevo Sobre</h3>
                <p className="text-[11px] text-slate-400">Aparta dinero para un gasto concreto</p>
              </div>
              <button onClick={() => setCreando(false)} className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white flex items-center justify-center transition-all shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-3xl shrink-0" style={{ borderColor: nColor, background: `${nColor}22` }} data-testid="preview-emoji-sobre">
                  {nEmoji}
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Nombre del sobre</label>
                  <input
                    type="text"
                    value={nNombre}
                    onChange={(e) => { setNNombre(e.target.value); setNError(''); }}
                    placeholder="Ej: Comida del mes"
                    data-testid="input-sobre-nombre"
                    className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Emoji</label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJIS_SOBRE.map((e) => (
                    <button
                      key={e}
                      onClick={() => setNEmoji(e)}
                      data-testid={`emoji-sobre-${e}`}
                      className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-all ${
                        nEmoji === e ? 'border-amber-500 bg-amber-500/15' : 'border-slate-700 bg-slate-950/50 hover:border-slate-500'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORES_SOBRE.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNColor(c)}
                      data-testid={`color-sobre-${c.replace('#', '')}`}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${nColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ background: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Monto inicial (S/)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={nMonto}
                  onChange={(e) => { setNMonto(e.target.value); setNError(''); }}
                  placeholder="0.00"
                  data-testid="input-sobre-monto"
                  className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Origen del dinero</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setNOrigen('balance')}
                    data-testid="origen-sobre-balance"
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      nOrigen === 'balance' ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-slate-700 bg-slate-950/50 text-slate-400'
                    }`}
                  >
                    💸 Desde mi saldo
                  </button>
                  <button
                    onClick={() => setNOrigen('manual')}
                    data-testid="origen-sobre-manual"
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      nOrigen === 'manual' ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-slate-700 bg-slate-950/50 text-slate-400'
                    }`}
                  >
                    ✍️ Manual (ya apartado)
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  {nOrigen === 'balance'
                    ? 'Se descuenta de tu saldo total (gasto "✉️ Sobre: nombre" en Efectivo)'
                    : 'Solo suma al sobre, sin tocar el saldo de tus cuentas'}
                </p>
              </div>

              {nError && (
                <p data-testid="error-sobre" className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{nError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setCreando(false)} className="flex-1 py-3 rounded-xl border border-slate-600 text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-all">Cancelar</button>
                <button onClick={guardarNuevo} data-testid="boton-guardar-sobre" className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]">Crear sobre</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: sobre activo (gastar / recargar / historial) ── */}
      {activo && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={cerrarSobre} />
          <div className="relative w-full sm:max-w-md bg-slate-900 border rounded-t-3xl sm:rounded-3xl border-slate-700 border-t-2 shadow-2xl p-5 max-h-[92vh] overflow-y-auto custom-scrollbar" style={{ borderTopColor: activo.color }} data-testid="modal-sobre">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl border flex items-center justify-center text-2xl shrink-0" style={{ borderColor: `${activo.color}66`, background: `${activo.color}22` }}>
                {activo.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-white truncate">{activo.nombre}</h3>
                <p className="text-[11px] text-slate-400">Creado el {fechaCorta(activo.fechaCreacion)}</p>
              </div>
              <button onClick={cerrarSobre} className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white flex items-center justify-center transition-all shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {barraSobre}

            {/* Tabs */}
            <div className="grid grid-cols-3 gap-1.5 mt-4 mb-4">
              {([
                { k: 'gastar', label: 'Gastar', icon: <ArrowDownCircle className="w-3.5 h-3.5" /> },
                { k: 'recargar', label: 'Recargar', icon: <ArrowUpCircle className="w-3.5 h-3.5" /> },
                { k: 'historial', label: 'Historial', icon: <History className="w-3.5 h-3.5" /> },
              ] as const).map(({ k, label, icon }) => (
                <button
                  key={k}
                  onClick={() => { setTab(k); setSError(''); }}
                  data-testid={`tab-sobre-${k}`}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[11px] font-bold transition-all ${
                    tab === k
                      ? k === 'gastar' ? 'border-rose-500/50 bg-rose-500/15 text-rose-300'
                        : k === 'recargar' ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                        : 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                      : 'border-slate-700 bg-slate-950/50 text-slate-400'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            {tab === 'gastar' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Monto a gastar (S/)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={gMonto}
                    onChange={(e) => { setGMonto(e.target.value); setSError(''); }}
                    placeholder="0.00"
                    data-testid="input-gasto-sobre"
                    className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-rose-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Descripción <span className="text-slate-600 font-normal">(opcional)</span></label>
                  <input
                    type="text"
                    value={gDesc}
                    onChange={(e) => setGDesc(e.target.value)}
                    placeholder="Gasto del sobre"
                    data-testid="input-gasto-desc"
                    className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/60"
                  />
                </div>
                {sError && <p data-testid="error-sobre-activo" className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{sError}</p>}
                <button onClick={gastar} data-testid="boton-gastar-sobre" className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-bold text-white shadow-lg shadow-rose-500/20 transition-all active:scale-[0.98]">
                  💸 Gastar desde el sobre
                </button>
              </div>
            )}

            {tab === 'recargar' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Monto a recargar (S/)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={rMonto}
                    onChange={(e) => { setRMonto(e.target.value); setSError(''); }}
                    placeholder="0.00"
                    data-testid="input-recarga-sobre"
                    className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setROrigen('balance')}
                    data-testid="origen-recarga-balance"
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      rOrigen === 'balance' ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-slate-700 bg-slate-950/50 text-slate-400'
                    }`}
                  >
                    💸 Desde mi saldo
                  </button>
                  <button
                    onClick={() => setROrigen('manual')}
                    data-testid="origen-recarga-manual"
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      rOrigen === 'manual' ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-slate-700 bg-slate-950/50 text-slate-400'
                    }`}
                  >
                    ✍️ Manual
                  </button>
                </div>
                {sError && <p data-testid="error-sobre-activo" className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{sError}</p>}
                <button onClick={recargar} data-testid="boton-recargar-sobre" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]">
                  💰 Recargar el sobre
                </button>
              </div>
            )}

            {tab === 'historial' && (
              <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                {movimientosDeSobre(estado, activo.id).length === 0 ? (
                  <div className="text-center py-8" data-testid="sin-movs-sobre">
                    <p className="text-2xl mb-2">📭</p>
                    <p className="text-xs text-slate-500">Sin movimientos en este sobre</p>
                  </div>
                ) : (
                  movimientosDeSobre(estado, activo.id).map((m) => {
                    const esRecarga = m.tipo === 'recarga';
                    return (
                      <div key={m.id} className="flex items-center gap-3 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2.5">
                        <span className="text-base shrink-0">{esRecarga ? '💰' : '💸'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-200 truncate">{m.desc}</p>
                          <p className="text-[10px] text-slate-500">{fechaCorta(m.fecha)}</p>
                        </div>
                        <p className={`text-xs font-black shrink-0 ${esRecarga ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {esRecarga ? '+' : '−'}{soles(Number(m.monto) || 0)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Eliminar (2 pasos, como el resto de la app) */}
            <div className="mt-5 pt-4 border-t border-slate-700/60">
              {confirmando ? (
                <div className="flex gap-2.5">
                  <button onClick={() => setConfirmando(false)} className="flex-1 py-2.5 rounded-xl border border-slate-600 text-xs font-bold text-slate-300 hover:text-white transition-all">Cancelar</button>
                  <button onClick={eliminar} data-testid="boton-confirmar-eliminar-sobre" className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all">Sí, eliminar</button>
                </div>
              ) : (
                <button onClick={() => setConfirmando(true)} data-testid="boton-eliminar-sobre" className="w-full py-2.5 rounded-xl border border-rose-500/30 text-rose-400 text-xs font-bold hover:bg-rose-500/10 transition-all flex items-center justify-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar sobre (con sus movimientos)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
