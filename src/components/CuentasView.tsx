// ═══════════════════════════════════════════════════════════
// 🏦 CUENTAS — WalletTrack V2 (F0)
// Patrimonio consolidado + tarjeta por cuenta (con acciones
// rápidas) + saldos iniciales editables + transferencia entre
// cuentas (doble asiento) + reiniciar todo. Porte directo de
// la vista view-cuentas del HTML original.
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { ArrowLeftRight, Send, Save, Trash2, Info } from 'lucide-react';
import type { EstadoWallet } from '../types';
import { CUENTAS_CATALOG } from '../data/catalogos';
import { soles, parseMonto } from '../services/dinero';
import { saldoCuenta, saldoTotal, movimientosDeCuenta, hacerTransferencia } from '../services/estado';

interface CuentasViewProps {
  estado: EstadoWallet;
  onRegistrar: (tipo: 'income' | 'expense', sugerida?: { cuenta?: string }) => void;
  onGuardarSaldos: (saldos: Record<string, number>) => void;
  onTransferencia: (from: string, to: string, monto: number) => string | null; // devuelve error o null
  onReset: () => void;
  onToast: (mensaje: string) => void;
}

export const CuentasView: React.FC<CuentasViewProps> = ({
  estado, onRegistrar, onGuardarSaldos, onTransferencia, onReset, onToast,
}) => {
  const total = saldoTotal(estado);

  // ── Saldos iniciales (borrador local hasta Guardar) ──────────
  const [borradorSaldos, setBorradorSaldos] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    for (const c of CUENTAS_CATALOG) {
      inicial[c.id] = estado.saldosIniciales[c.id] !== undefined ? String(estado.saldosIniciales[c.id]) : '';
    }
    return inicial;
  });
  const [saldosGuardados, setSaldosGuardados] = useState(false);

  // Reactivo si cambia el estado global (ej. importaron respaldo)
  React.useEffect(() => {
    const inicial: Record<string, string> = {};
    for (const c of CUENTAS_CATALOG) {
      inicial[c.id] = estado.saldosIniciales[c.id] !== undefined ? String(estado.saldosIniciales[c.id]) : '';
    }
    setBorradorSaldos(inicial);
  }, [estado.saldosIniciales]);

  const guardarSaldos = () => {
    const finales: Record<string, number> = {};
    for (const c of CUENTAS_CATALOG) {
      const crudo = (borradorSaldos[c.id] ?? '').trim();
      const n = crudo === '' ? 0 : (parseMonto(crudo) ?? 0);
      finales[c.id] = n;
    }
    onGuardarSaldos(finales);
    setSaldosGuardados(true);
    setTimeout(() => setSaldosGuardados(false), 2000);
    onToast('Saldos iniciales guardados');
  };

  // ── Transferencia ────────────────────────────────────────────
  const [tFrom, setTFrom] = useState('bcp');
  const [tTo, setTTo] = useState('yape');
  const [tMonto, setTMonto] = useState('');
  const [tError, setTError] = useState('');

  const confirmarTransferencia = () => {
    const monto = parseMonto(tMonto);
    if (monto === null) { setTError('Ingresa un monto mayor a cero'); return; }
    const error = onTransferencia(tFrom, tTo, monto);
    if (error) { setTError(error); return; }
    setTError('');
    setTMonto('');
    onToast('Transferencia registrada');
  };

  const [confirmandoReset, setConfirmandoReset] = useState(false);

  return (
    <div className="space-y-5 wt-aparece" data-testid="vista-cuentas">

      {/* ── Patrimonio total ───────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-700/80 p-6 shadow-xl">
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Patrimonio Total Consolidado</p>
          <Info className="w-4 h-4 text-slate-600" title="Saldo inicial + ingresos − gastos por cada cuenta" />
        </div>
        <h2 data-testid="patrimonio-total" className="text-4xl font-black tracking-tight text-white mt-1">
          {soles(total)}
        </h2>
        <p className="text-xs text-slate-400 mt-2">Saldo inicial + ingresos − gastos por cada cuenta</p>
      </section>

      {/* ── Tarjetas por cuenta ────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CUENTAS_CATALOG.map((c) => {
          const saldo = saldoCuenta(estado, c.id);
          const movs = movimientosDeCuenta(estado, c.id);
          const ultimos = movs.slice(0, 3);
          return (
            <div
              key={c.id}
              data-testid={`tarjeta-cuenta-${c.id}`}
              className="rounded-3xl border p-5 relative overflow-hidden"
              style={{ background: `linear-gradient(140deg, ${c.color}26, #0f172a66)`, borderColor: `${c.color}66` }}
            >
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-2xl" style={{ background: `${c.color}22` }} />
              <div className="flex items-center justify-between">
                <span className="text-2xl leading-none">{c.icon}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{c.tipo}</span>
              </div>
              <p className="text-sm font-bold text-slate-200 mt-3">{c.name}</p>
              <p className="text-3xl font-black tracking-tight mt-0.5" style={{ color: c.color }}>{soles(saldo)}</p>
              <p className="text-[11px] text-slate-500 mt-1">{movs.length} movimiento{movs.length === 1 ? '' : 's'}</p>

              {ultimos.length > 0 && (
                <div className="mt-3 border-t border-white/5 pt-2.5 space-y-1.5">
                  {ultimos.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 truncate pr-2">{t.description}</span>
                      <span className={`font-bold shrink-0 ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {t.type === 'income' ? '+' : '−'}{soles(Number(t.amount) || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => onRegistrar('income', { cuenta: c.id })}
                  data-testid={`cuenta-ingreso-${c.id}`}
                  className="flex-1 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold transition-all active:scale-95"
                >
                  + Ingreso
                </button>
                <button
                  onClick={() => onRegistrar('expense', { cuenta: c.id })}
                  data-testid={`cuenta-gasto-${c.id}`}
                  className="flex-1 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-600 text-slate-200 text-xs font-bold transition-all active:scale-95"
                >
                  − Gasto
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Saldos iniciales ───────────────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <h3 className="font-bold text-slate-200 text-base mb-1">Ajustar Saldos Iniciales</h3>
        <p className="text-xs text-slate-400 mb-4">
          Ingresa cuánto tenías en cada cuenta cuando empezaste a usar WalletTrack.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CUENTAS_CATALOG.map((c) => (
            <label key={c.id} className="flex items-center gap-3 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5">
              <span className="text-lg leading-none shrink-0">{c.icon}</span>
              <span className="text-xs font-bold text-slate-300 w-20 shrink-0">{c.name}</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={borradorSaldos[c.id] ?? ''}
                onChange={(e) => setBorradorSaldos((s) => ({ ...s, [c.id]: e.target.value }))}
                placeholder="0.00"
                data-testid={`saldo-inicial-${c.id}`}
                className="flex-1 min-w-0 bg-transparent text-sm font-bold text-white text-right focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 shrink-0">S/</span>
            </label>
          ))}
        </div>
        <button
          onClick={guardarSaldos}
          data-testid="boton-guardar-saldos"
          className={`mt-4 w-full py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.99] ${
            saldosGuardados ? 'bg-teal-600' : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <Save className="w-4 h-4" /> {saldosGuardados ? '¡Guardado!' : 'Guardar Saldos'}
          </span>
        </button>

        {/* Reset con confirmación de 2 pasos */}
        {!confirmandoReset ? (
          <button
            onClick={() => setConfirmandoReset(true)}
            className="mt-3 w-full py-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-400 text-sm font-bold transition-all hover:bg-rose-500/20"
          >
            <span className="inline-flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Reiniciar todo a cero
            </span>
          </button>
        ) : (
          <div className="mt-3 bg-rose-500/10 border border-rose-500/40 rounded-xl p-3">
            <p className="text-xs text-rose-300 text-center mb-2.5">
              ¿Seguro? Se borran TODOS los movimientos, saldos y datos. No hay vuelta atrás.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmandoReset(false)}
                className="flex-1 py-2 rounded-xl border border-slate-600 text-xs font-bold text-slate-300 hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => { onReset(); setConfirmandoReset(false); }}
                data-testid="boton-confirmar-reset"
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all"
              >
                Sí, borrar todo
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Transferencia entre cuentas ────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <h3 className="font-bold text-slate-200 text-base mb-1 flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-emerald-400" /> Transferencia entre Cuentas
        </h3>
        <p className="text-xs text-slate-400 mb-4">Mueve dinero entre tus cuentas sin afectar el balance total.</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Desde</label>
              <select
                value={tFrom}
                onChange={(e) => setTFrom(e.target.value)}
                data-testid="transfer-from"
                className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              >
                {CUENTAS_CATALOG.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Hacia</label>
              <select
                value={tTo}
                onChange={(e) => setTTo(e.target.value)}
                data-testid="transfer-to"
                className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              >
                {CUENTAS_CATALOG.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">Monto (S/)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={tMonto}
              onChange={(e) => { setTMonto(e.target.value); setTError(''); }}
              placeholder="0.00"
              data-testid="transfer-monto"
              className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            />
          </div>
          {tError && (
            <p data-testid="error-transferencia" className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
              {tError}
            </p>
          )}
          <button
            onClick={confirmarTransferencia}
            data-testid="boton-transferir"
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm transition-all flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Confirmar Transferencia
          </button>
        </div>
      </section>
    </div>
  );
};
