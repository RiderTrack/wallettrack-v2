// ═══════════════════════════════════════════════════════════
// 🏠 DASHBOARD — WalletTrack V2 (F0)
// Balance consolidado + ingresos/gastos del mes + cuentas +
// gastos rápidos de 1 toque + últimos movimientos + (F4) la
// tarjeta del WalletBot con los 2 avisos más importantes del
// análisis del mes — el bot completo vive en su vista (☰).
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { TrendingUp, TrendingDown, PlusCircle, MinusCircle, ArrowRight, Zap, Wallet, ArrowLeftRight, Bot } from 'lucide-react';
import type { EstadoWallet, VistaApp } from '../types';
import { todasLasCuentas } from '../data/catalogos';
import { soles, fechaCorta, nombreMesActual } from '../services/dinero';
import { saldoCuenta, saldoTotal, resumenMes, movimientosDeCuenta } from '../services/estado';
import { analizarWallet, COLOR_MAP } from '../services/walletbot';

interface DashboardViewProps {
  estado: EstadoWallet;
  onRegistrar: (tipo: 'income' | 'expense', sugerida?: { cuenta?: string }) => void;
  onGastoRapido: (index: number) => void;
  onIr: (v: VistaApp) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ estado, onRegistrar, onGastoRapido, onIr }) => {
  const total = saldoTotal(estado);
  const { ingresos, gastos } = resumenMes(estado);
  const recientes = estado.transactions.slice(0, 8);
  const cuenta = (id?: string) => todasLasCuentas(estado).find((c) => c.id === (id ?? 'efectivo'));
  // F4: los 2 avisos más prioritarios del mes (mismo motor del bot)
  const avisosBot = analizarWallet(estado).slice(0, 2);

  return (
    <div className="space-y-5 wt-aparece" data-testid="vista-dashboard">

      {/* ── Hero: Balance + flujo del mes ─────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-700/80 p-6 shadow-xl">
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-emerald-500/10 blur-3xl" />
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Patrimonio Total Consolidado</p>
        <h2 data-testid="saldo-total" className="text-4xl font-black tracking-tight text-white mt-1">
          {soles(total)}
        </h2>
        <p className="text-xs text-slate-400 mt-2">Saldos iniciales + ingresos − gastos de tus 6 cuentas</p>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
            <p className="text-[11px] text-slate-400">Ingresos · {nombreMesActual()}</p>
            <p data-testid="ingresos-mes" className="text-base font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <TrendingUp className="w-4 h-4" /> {soles(ingresos)}
            </p>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
            <p className="text-[11px] text-slate-400">Gastos · {nombreMesActual()}</p>
            <p data-testid="gastos-mes" className="text-base font-bold text-rose-400 flex items-center gap-1.5 mt-0.5">
              <TrendingDown className="w-4 h-4" /> {soles(gastos)}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => onRegistrar('income')}
            data-testid="boton-registrar-ingreso"
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20"
          >
            <PlusCircle className="w-4 h-4" /> Ingreso
          </button>
          <button
            onClick={() => onRegistrar('expense')}
            data-testid="boton-registrar-gasto"
            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <MinusCircle className="w-4 h-4" /> Gasto
          </button>
          <button
            onClick={() => onIr('cuentas')}
            data-testid="boton-ir-transferencia"
            title="Transferir entre cuentas"
            className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-all active:scale-[0.98]"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ── ⚡ Gastos rápidos de 1 toque ───────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Gastos Rápidos
          </span>
          <span className="text-[10px] text-slate-500">1 toque = gasto registrado</span>
        </div>
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
          {estado.gastosRapidos.map((gr, i) => (
            <button
              key={gr.id}
              onClick={() => onGastoRapido(i)}
              data-testid={`gasto-rapido-${gr.id}`}
              className="shrink-0 flex items-center gap-2.5 bg-slate-900 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800 rounded-2xl px-4 py-3 transition-all active:scale-95"
            >
              <span className="text-xl leading-none">{gr.emoji}</span>
              <span className="text-left">
                <span className="block text-xs font-bold text-slate-200 leading-tight">{gr.nombre}</span>
                <span className="block text-[11px] text-emerald-400 font-semibold">{soles(gr.monto, false)}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Mis Cuentas (strip) ────────────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" /> Mis Cuentas
          </h3>
          <button
            onClick={() => onIr('cuentas')}
            className="text-xs text-emerald-400 font-semibold hover:underline"
          >
            Ver detalle →
          </button>
        </div>
        <div className="flex overflow-x-auto no-scrollbar gap-3 pb-1">
          {todasLasCuentas(estado).map((c) => {
            const saldo = saldoCuenta(estado, c.id);
            const nMovs = movimientosDeCuenta(estado, c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => onRegistrar('expense', { cuenta: c.id })}
                data-testid={`strip-cuenta-${c.id}`}
                title={`Gasto desde ${c.name}`}
                className="shrink-0 w-[150px] text-left rounded-2xl p-3.5 border transition-all active:scale-[0.97] hover:brightness-110"
                style={{ background: `linear-gradient(140deg, ${c.color}22, #0f172a55)`, borderColor: `${c.color}55` }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg leading-none">{c.icon}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{c.tipo}</span>
                </div>
                <p className="text-xs font-bold text-slate-200 mt-2">{c.name}</p>
                <p className="text-sm font-black mt-0.5" style={{ color: c.color }}>{soles(saldo)}</p>
                <p className="text-[10px] text-slate-500 mt-1">{nMovs} movimiento{nMovs === 1 ? '' : 's'}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 🤖 WalletBot (mismos avisos priorizados del viejo) ── */}
      <section
        data-testid="tarjeta-walletbot-dashboard"
        className="rounded-3xl bg-slate-900 border border-indigo-500/20 p-5 relative overflow-hidden"
      >
        <div className="absolute -right-20 -bottom-20 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="flex items-center justify-between mb-3 relative">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 truncate">
                WalletBot
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-500/20 text-indigo-300 font-bold uppercase">IA</span>
              </h3>
              <span className="text-[11px] text-slate-400 block truncate">Análisis del mes en curso</span>
            </div>
          </div>
          <button
            onClick={() => onIr('walletbot')}
            data-testid="boton-ver-walletbot"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 shrink-0"
          >
            Ver bot <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-2 relative">
          {avisosBot.map((m, i) => {
            const c = COLOR_MAP[m.type];
            return (
              <div
                key={i}
                className="flex items-start gap-2.5 p-2.5 rounded-xl border"
                style={{ background: c.bg, borderColor: c.border }}
              >
                <span className="text-sm leading-none mt-0.5 shrink-0">{m.icon}</span>
                <span
                  className="text-[11px] leading-relaxed [&_strong]:font-bold line-clamp-2"
                  style={{ color: c.text }}
                  dangerouslySetInnerHTML={{ __html: m.text }}
                />
              </div>
            );
          })}
          {avisosBot.length === 0 && (
            <p className="text-[11px] text-slate-500 text-center py-2">
              Registra movimientos y el bot te avisa lo más importante del mes.
            </p>
          )}
        </div>
      </section>

      {/* ── Últimos movimientos ───────────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-200 text-sm">Últimos Movimientos</h3>
          <button
            onClick={() => onIr('historial')}
            className="text-xs text-emerald-400 font-semibold hover:underline flex items-center gap-1"
          >
            Ver historial <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recientes.length === 0 ? (
          <div className="text-center py-8" data-testid="sin-movimientos">
            <p className="text-3xl mb-2">🪙</p>
            <p className="text-sm text-slate-400">Todavía no hay movimientos</p>
            <p className="text-xs text-slate-500 mt-1">Registra tu primer ingreso con el botón verde de arriba</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {recientes.map((t) => {
              const cta = cuenta(t.account);
              const esIngreso = t.type === 'income';
              return (
                <div key={t.id} className="flex items-center gap-3 py-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 border ${
                    esIngreso ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'
                  }`}>
                    {cta?.icon ?? '💵'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-200 truncate">{t.description}</p>
                    <p className="text-[11px] text-slate-500">
                      {fechaCorta(t.date)} · {t.category}{cta ? ` · ${cta.name}` : ''}
                    </p>
                  </div>
                  <p className={`text-sm font-black shrink-0 ${esIngreso ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {esIngreso ? '+' : '−'}{soles(Number(t.amount) || 0)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
