// ═══════════════════════════════════════════════════════════
// 💳 DEUDAS Y APARTADOS — WalletTrack V2 (F2 · DINERO)
// Deudas con cuotas como el original: apartas dinero cada
// semana (sin tocar el balance) y al pagar la cuota sale el
// gasto real de la cuenta elegida. Formas 1:1 con el viejo
// (wallettrack_deudas + wallettrack_deuda_movs).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { HandCoins, Plus, X, Trash2, PiggyBank, CreditCard, History } from 'lucide-react';
import type { EstadoWallet } from '../types';
import {
  crearDeuda, apartarParaDeuda, pagarCuotaDeuda, eliminarDeuda,
  movimientosDeDeuda, juntadoActual, montoPendienteDeuda,
} from '../services/estado';
import type { DatosDeuda } from '../services/estado';
import { soles, parseMonto, fechaCorta, hoyISO } from '../services/dinero';
import { todasLasCuentas } from '../data/catalogos';

interface DeudasViewProps {
  estado: EstadoWallet;
  onAplicar: (nuevo: EstadoWallet) => void;
  onToast: (mensaje: string) => void;
}

export const DeudasView: React.FC<DeudasViewProps> = ({ estado, onAplicar, onToast }) => {
  // Modal nueva deuda
  const [creando, setCreando] = useState(false);
  const [nNombre, setNNombre] = useState('');
  const [nTotal, setNTotal] = useState('');
  const [nCuotas, setNCuotas] = useState('');
  const [nMontoCuota, setNMontoCuota] = useState('');
  const [nPagadas, setNPagadas] = useState('0');
  const [nProxima, setNProxima] = useState('');
  const [nCuenta, setNCuenta] = useState('efectivo');
  const [nError, setNError] = useState('');

  // Modal detalle
  const [activoId, setActivoId] = useState<string | null>(null);
  const [tab, setTab] = useState<'apartar' | 'pagar' | 'historial'>('apartar');
  const [aMonto, setAMonto] = useState('');
  const [pMonto, setPMonto] = useState('');
  const [sError, setSError] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (!creando && !activoId) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setCreando(false);
      cerrarDeuda();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creando, activoId]);

  const activo = estado.deudas.find((d) => d.id === activoId) ?? null;
  const pendienteTotal = estado.deudas.reduce((acc, d) => acc + montoPendienteDeuda(estado, d.id), 0);

  const cerrarDeuda = () => {
    setActivoId(null);
    setTab('apartar');
    setAMonto('');
    setPMonto('');
    setSError('');
    setConfirmando(false);
  };

  const abrirDeuda = (id: string) => {
    const d = estado.deudas.find((x) => x.id === id);
    if (!d) return;
    setActivoId(id);
    setTab('apartar');
    setAMonto(d.semanalSugerido ? d.semanalSugerido.toFixed(2) : '');
    setPMonto((Number(d.montoCuota) || 0).toFixed(2));
    setSError('');
    setConfirmando(false);
  };

  const guardarNueva = () => {
    const total = parseMonto(nTotal);
    const cuotas = parseInt(nCuotas, 10);
    if (total === null) { setNError('Ingresa el monto total'); return; }
    if (!(cuotas > 0)) { setNError('Ingresa el número de cuotas'); return; }
    if (!nProxima) { setNError('Ingresa la fecha de la próxima cuota'); return; }
    const mCuota = parseMonto(nMontoCuota) ?? (total / cuotas);
    const datos: DatosDeuda = {
      nombre: nNombre,
      montoTotal: total,
      totalCuotas: cuotas,
      montoCuota: mCuota,
      cuotasPagadas: parseInt(nPagadas, 10) || 0,
      proximaFecha: nProxima,
      cuenta: nCuenta,
    };
    const r = crearDeuda(estado, datos);
    if (!r.ok) { setNError(r.error ?? 'No se pudo registrar la deuda'); return; }
    onAplicar(r.estado);
    setCreando(false);
    setNNombre(''); setNTotal(''); setNCuotas(''); setNMontoCuota(''); setNPagadas('0'); setNProxima(''); setNError('');
    onToast('💳 Deuda registrada');
  };

  const apartar = () => {
    if (!activo) return;
    const monto = parseMonto(aMonto);
    if (monto === null) { setSError('Ingresa un monto mayor a cero'); return; }
    const r = apartarParaDeuda(estado, activo.id, monto);
    if (!r.ok) { setSError(r.error ?? 'No se pudo apartar'); return; }
    onAplicar(r.estado);
    setAMonto(activo.semanalSugerido ? activo.semanalSugerido.toFixed(2) : '');
    setSError('');
    onToast(`🪙 ${soles(monto)} apartado para la cuota ${activo.cuotaActual}`);
  };

  const pagar = () => {
    if (!activo) return;
    const monto = parseMonto(pMonto);
    if (monto === null) { setSError('Ingresa un monto mayor a cero'); return; }
    const r = pagarCuotaDeuda(estado, activo.id, monto);
    if (!r.ok) { setSError(r.error ?? 'No se pudo pagar la cuota'); return; }
    onAplicar(r.estado);
    setSError('');
    if (r.terminada) {
      onToast(`🎉 ¡Deuda "${activo.nombre}" completamente pagada!`);
      cerrarDeuda();
    } else {
      const avanzada = r.estado.deudas.find((d) => d.id === activo.id);
      setPMonto(avanzada ? (Number(avanzada.montoCuota) || 0).toFixed(2) : '');
      onToast(`✅ Cuota pagada · próxima: ${avanzada?.proximaFecha ?? ''}`);
    }
  };

  const eliminar = () => {
    if (!activo) return;
    onAplicar(eliminarDeuda(estado, activo.id));
    cerrarDeuda();
    onToast('🗑 Deuda eliminada');
  };

  // Sugerencia en vivo del modal nueva deuda (como el viejo)
  const totalN = parseMonto(nTotal);
  const cuotasN = parseInt(nCuotas, 10);
  const sugerencia = totalN && cuotasN > 0 ? totalN / cuotasN : null;

  return (
    <div className="space-y-5" data-testid="vista-deudas">
      {/* ── Resumen ── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center shrink-0">
            <HandCoins className="w-5 h-5 text-rose-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-slate-400">Total pendiente de tus deudas</p>
            <p className="text-2xl font-black text-white leading-tight">{soles(pendienteTotal)}</p>
          </div>
          <button
            onClick={() => setCreando(true)}
            data-testid="boton-nueva-deuda"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-500/20 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" /> Nueva Deuda
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          Aparta semana a semana (sin tocar tus cuentas) y al pagar la cuota el gasto sale de la cuenta elegida.
        </p>
      </section>

      {/* ── Grid de deudas ── */}
      {estado.deudas.length === 0 ? (
        <div className="rounded-3xl bg-slate-900 border border-slate-700/80 p-10 text-center" data-testid="sin-deudas">
          <p className="text-4xl mb-3">💳</p>
          <p className="text-sm font-bold text-slate-300">Sin deudas registradas</p>
          <p className="text-xs text-slate-500 mt-1.5">Registra una deuda con cuotas y ve juntando el dinero de cada pago</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {estado.deudas.map((d) => {
            const pendiente = montoPendienteDeuda(estado, d.id);
            const pct = d.totalCuotas > 0 ? Math.min(100, Math.round((d.cuotasPagadas / d.totalCuotas) * 100)) : 0;
            const cuenta = todasLasCuentas(estado).find((c) => c.id === d.cuenta);
            return (
              <button
                key={d.id}
                onClick={() => abrirDeuda(d.id)}
                data-testid={`tarjeta-deuda-${d.id}`}
                className="text-left rounded-2xl bg-slate-900 border border-slate-700/80 p-4 hover:border-rose-500/40 hover:bg-slate-800/60 transition-all active:scale-[0.98]"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white truncate">{d.nombre}</p>
                    <p className="text-[10px] text-slate-500">Cuota {soles(d.montoCuota, false)} · {cuenta?.icon ?? '💵'} {cuenta?.name ?? d.cuenta}</p>
                  </div>
                  <p className="text-sm font-black text-rose-400 shrink-0">{soles(pendiente, false)}</p>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
                  <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-slate-500">
                  <span>{d.cuotasPagadas}/{d.totalCuotas} cuotas · {pct}%</span>
                  <span>próx. {fechaCorta(d.proximaFecha)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Modal: nueva deuda ── */}
      {creando && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCreando(false)} />
          <div className="relative w-full sm:max-w-md bg-slate-900 border rounded-t-3xl sm:rounded-3xl border-slate-700 border-t-2 border-t-rose-500 shadow-2xl p-5 max-h-[92vh] overflow-y-auto custom-scrollbar" data-testid="modal-nueva-deuda">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center shrink-0">
                <HandCoins className="w-5 h-5 text-rose-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-white">Nueva Deuda</h3>
                <p className="text-[11px] text-slate-400">Con cuotas y apartados semanales</p>
              </div>
              <button onClick={() => setCreando(false)} className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white flex items-center justify-center transition-all shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Nombre de la deuda</label>
                <input type="text" value={nNombre} onChange={(e) => { setNNombre(e.target.value); setNError(''); }} placeholder="Ej: Tarjeta BBVA" data-testid="input-deuda-nombre"
                  className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/60" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Monto total (S/)</label>
                  <input type="number" inputMode="decimal" step="0.01" min="0" value={nTotal} onChange={(e) => { setNTotal(e.target.value); setNError(''); }} placeholder="0.00" data-testid="input-deuda-total"
                    className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-rose-500/60" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">N° de cuotas</label>
                  <input type="number" inputMode="numeric" step="1" min="1" value={nCuotas} onChange={(e) => { setNCuotas(e.target.value); setNError(''); }} placeholder="12" data-testid="input-deuda-cuotas"
                    className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-rose-500/60" />
                </div>
              </div>

              {sugerencia && (
                <p className="text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2" data-testid="sugerencia-cuota">
                  💡 {soles(sugerencia)} por cuota · {soles(sugerencia / 4)} / semana
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Monto por cuota <span className="text-slate-600 font-normal">(opcional)</span></label>
                  <input type="number" inputMode="decimal" step="0.01" min="0" value={nMontoCuota} onChange={(e) => setNMontoCuota(e.target.value)} placeholder={sugerencia ? sugerencia.toFixed(2) : '0.00'} data-testid="input-deuda-monto-cuota"
                    className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/60" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Cuotas ya pagadas</label>
                  <input type="number" inputMode="numeric" step="1" min="0" value={nPagadas} onChange={(e) => setNPagadas(e.target.value)} placeholder="0" data-testid="input-deuda-pagadas"
                    className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/60" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Próxima cuota</label>
                  <input type="date" value={nProxima} onChange={(e) => { setNProxima(e.target.value); setNError(''); }} data-testid="input-deuda-proxima"
                    className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/60" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Cuenta de pago</label>
                  <select value={nCuenta} onChange={(e) => setNCuenta(e.target.value)} data-testid="select-deuda-cuenta"
                    className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/60">
                    {todasLasCuentas(estado).map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {nError && <p data-testid="error-deuda" className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{nError}</p>}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setCreando(false)} className="flex-1 py-3 rounded-xl border border-slate-600 text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-all">Cancelar</button>
                <button onClick={guardarNueva} data-testid="boton-guardar-deuda" className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-bold text-white shadow-lg shadow-rose-500/20 transition-all active:scale-[0.98]">Registrar deuda</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: detalle de deuda ── */}
      {activo && (() => {
        const d = activo;
        const pendiente = montoPendienteDeuda(estado, d.id);
        const pctCuotas = d.totalCuotas > 0 ? Math.min(100, Math.round((d.cuotasPagadas / d.totalCuotas) * 100)) : 0;
        const juntado = juntadoActual(estado, d.id);
        const necesita = Number(d.montoCuota) || 0;
        const ahorPct = necesita > 0 ? Math.min(100, Math.round((juntado / necesita) * 100)) : 0;
        const falta = Math.max(0, necesita - juntado);
        const cuenta = todasLasCuentas(estado).find((c) => c.id === d.cuenta);
        const barColor = ahorPct >= 100 ? '#34d399' : ahorPct >= 60 ? '#fbbf24' : '#fb7185';
        return (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={cerrarDeuda} />
            <div className="relative w-full sm:max-w-md bg-slate-900 border rounded-t-3xl sm:rounded-3xl border-slate-700 border-t-2 border-t-rose-500 shadow-2xl p-5 max-h-[92vh] overflow-y-auto custom-scrollbar" data-testid="modal-deuda">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center shrink-0">
                  <HandCoins className="w-5 h-5 text-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-white truncate">{d.nombre}</h3>
                  <p className="text-[11px] text-slate-400">{soles(pendiente)} pendiente · próx. {d.proximaFecha}</p>
                </div>
                <button onClick={cerrarDeuda} className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white flex items-center justify-center transition-all shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Cuotas */}
              <div className="rounded-2xl bg-slate-950/70 border border-slate-700/70 p-4 mb-3">
                <div className="flex items-end justify-between mb-2">
                  <p className="text-xs font-bold text-slate-300">Cuota {d.cuotaActual}/{d.totalCuotas} · {soles(necesita)}</p>
                  <p className="text-xs font-black text-slate-300">{pctCuotas}%</p>
                </div>
                <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
                  <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-500" style={{ width: `${pctCuotas}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  {d.cuotasPagadas} pagadas · {d.totalCuotas - d.cuotasPagadas} restan · paga con {cuenta?.icon ?? '💵'} {cuenta?.name ?? d.cuenta}
                </p>
              </div>

              {/* Juntado para la cuota actual */}
              <div className="rounded-2xl bg-slate-950/70 border border-slate-700/70 p-4">
                <div className="flex items-end justify-between mb-2">
                  <p className="text-xs font-bold text-slate-300">🪙 Juntado: {soles(juntado)} de {soles(necesita)}</p>
                  <p className="text-xs font-black" style={{ color: barColor }}>{ahorPct}%</p>
                </div>
                <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ahorPct}%`, background: barColor }} />
                </div>
                <p className="text-[10px] text-slate-500 mt-2">Falta {soles(falta)} para la cuota {d.cuotaActual} · sugerido {soles(d.semanalSugerido)}/semana</p>
              </div>

              {/* Tabs */}
              <div className="grid grid-cols-3 gap-1.5 mt-4 mb-4">
                {([
                  { k: 'apartar', label: 'Apartar', icon: <PiggyBank className="w-3.5 h-3.5" /> },
                  { k: 'pagar', label: 'Pagar', icon: <CreditCard className="w-3.5 h-3.5" /> },
                  { k: 'historial', label: 'Historial', icon: <History className="w-3.5 h-3.5" /> },
                ] as const).map(({ k, label, icon }) => (
                  <button
                    key={k}
                    onClick={() => { setTab(k); setSError(''); }}
                    data-testid={`tab-deuda-${k}`}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[11px] font-bold transition-all ${
                      tab === k
                        ? k === 'apartar' ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                          : k === 'pagar' ? 'border-rose-500/50 bg-rose-500/15 text-rose-300'
                          : 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                        : 'border-slate-700 bg-slate-950/50 text-slate-400'
                    }`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>

              {tab === 'apartar' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">Monto a apartar (S/)</label>
                    <input type="number" inputMode="decimal" step="0.01" min="0" value={aMonto} onChange={(e) => { setAMonto(e.target.value); setSError(''); }} placeholder="0.00" data-testid="input-apartar-deuda"
                      className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500/60" />
                    <p className="text-[10px] text-slate-500 mt-1.5">No toca el saldo de tus cuentas — solo junta el dinero para la cuota {d.cuotaActual}</p>
                  </div>
                  {sError && <p data-testid="error-deuda-activa" className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{sError}</p>}
                  <button onClick={apartar} data-testid="boton-apartar-deuda" className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]">
                    🪙 Apartar para la cuota {d.cuotaActual}
                  </button>
                </div>
              )}

              {tab === 'pagar' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">Monto a pagar (S/)</label>
                    <input type="number" inputMode="decimal" step="0.01" min="0" value={pMonto} onChange={(e) => { setPMonto(e.target.value); setSError(''); }} placeholder="0.00" data-testid="input-pagar-deuda"
                      className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-rose-500/60" />
                    <p className="text-[10px] text-slate-500 mt-1.5">
                      Se registra como gasto real "💳 Cuota deuda" desde {cuenta?.icon ?? '💵'} {cuenta?.name ?? d.cuenta} · la próxima fecha avanza un mes
                    </p>
                  </div>
                  {sError && <p data-testid="error-deuda-activa" className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{sError}</p>}
                  <button onClick={pagar} data-testid="boton-pagar-deuda" className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-bold text-white shadow-lg shadow-rose-500/20 transition-all active:scale-[0.98]">
                    💳 Pagar cuota {d.cuotaActual}/{d.totalCuotas}
                  </button>
                </div>
              )}

              {tab === 'historial' && (
                <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                  {movimientosDeDeuda(estado, d.id).length === 0 ? (
                    <div className="text-center py-8" data-testid="sin-movs-deuda">
                      <p className="text-2xl mb-2">📭</p>
                      <p className="text-xs text-slate-500">Sin movimientos en esta deuda</p>
                    </div>
                  ) : (
                    movimientosDeDeuda(estado, d.id).map((m) => {
                      const esPago = m.tipo === 'pagar';
                      return (
                        <div key={m.id} className="flex items-center gap-3 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2.5">
                          <span className="text-base shrink-0">{esPago ? '💳' : '🪙'}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-200 truncate">{m.desc}</p>
                            <p className="text-[10px] text-slate-500">{fechaCorta(m.fecha)}</p>
                          </div>
                          <p className={`text-xs font-black shrink-0 ${esPago ? 'text-rose-400' : 'text-amber-400'}`}>
                            {soles(Number(m.monto) || 0)}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Eliminar (2 pasos) */}
              <div className="mt-5 pt-4 border-t border-slate-700/60">
                {confirmando ? (
                  <div className="flex gap-2.5">
                    <button onClick={() => setConfirmando(false)} className="flex-1 py-2.5 rounded-xl border border-slate-600 text-xs font-bold text-slate-300 hover:text-white transition-all">Cancelar</button>
                    <button onClick={eliminar} data-testid="boton-confirmar-eliminar-deuda" className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all">Sí, eliminar</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmando(true)} data-testid="boton-eliminar-deuda" className="w-full py-2.5 rounded-xl border border-rose-500/30 text-rose-400 text-xs font-bold hover:bg-rose-500/10 transition-all flex items-center justify-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar deuda
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
