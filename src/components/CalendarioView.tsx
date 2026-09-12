// ═══════════════════════════════════════════════════════════
// 📅 CALENDARIO — WalletTrack V2 (F3 · ANÁLISIS)
// Puerto del view-calendario del original (FASE 3 del viejo):
// grid mensual con ‹ › para navegar meses, puntitos de color
// por día (verde ingreso · rosa gasto · índigo suscripción ·
// acento el día de HOY) y la lista de eventos del mes con
// importes. Los eventos salen de las transacciones del mes +
// los vencimientos de suscripciones (mismas reglas).
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { EstadoWallet } from '../types';
import { fechaCorta } from '../services/dinero';

interface CalendarioViewProps {
  estado: EstadoWallet;
}

type EventoCal = {
  date: string;
  tipo: 'income' | 'expense' | 'sub';
  label: string;
  amount: number;
};

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const ESTILO_EVENTO: Record<EventoCal['tipo'], { dot: string; label: string; bg: string; border: string; signo: string; monto: string }> = {
  income:  { dot: 'bg-emerald-400', label: 'Ingreso',     bg: 'bg-emerald-400/[0.08]', border: 'border-emerald-400/20',  signo: '+', monto: 'text-emerald-400' },
  expense: { dot: 'bg-rose-400',    label: 'Gasto',       bg: 'bg-rose-400/[0.08]',    border: 'border-rose-400/20',    signo: '-', monto: 'text-rose-400' },
  sub:     { dot: 'bg-indigo-400',  label: 'Suscripción', bg: 'bg-indigo-400/[0.08]',  border: 'border-indigo-400/20',  signo: '-', monto: 'text-indigo-400' },
};

export const CalendarioView: React.FC<CalendarioViewProps> = ({ estado }) => {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth());
  const [anio, setAnio] = useState(hoy.getFullYear());

  const nav = (delta: number) => {
    let m = mes + delta, a = anio;
    if (m > 11) { m = 0; a++; }
    if (m < 0) { m = 11; a--; }
    setMes(m); setAnio(a);
  };

  const mesStr = `${anio}-${String(mes + 1).padStart(2, '0')}`;

  const { eventos, txPorDia, subsPorDia } = useMemo(() => {
    const txPorDia: Record<string, { income: boolean; expense: boolean }> = {};
    const eventos: EventoCal[] = [];
    for (const t of estado.transactions) {
      if (!(t.date || '').startsWith(mesStr)) continue;
      const d = txPorDia[t.date] || { income: false, expense: false };
      if (t.type === 'income') d.income = true; else d.expense = true;
      txPorDia[t.date] = d;
      eventos.push({ date: t.date, tipo: t.type === 'income' ? 'income' : 'expense', label: t.description, amount: Number(t.amount) || 0 });
    }
    const subsPorDia: Record<string, number> = {};
    for (const s of estado.subscriptions) {
      if (!s.due || !s.due.startsWith(mesStr)) continue;
      subsPorDia[s.due] = (subsPorDia[s.due] || 0) + 1;
      eventos.push({ date: s.due, tipo: 'sub', label: s.name, amount: Number(s.cost) || 0 });
    }
    eventos.sort((a, b) => a.date.localeCompare(b.date));
    return { eventos, txPorDia, subsPorDia };
  }, [estado.transactions, estado.subscriptions, mesStr]);

  const primerDia = new Date(anio, mes, 1).getDay();      // 0 = domingo
  const diasMes = new Date(anio, mes + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array.from({ length: primerDia }, () => null),
    ...Array.from({ length: diasMes }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-5" data-testid="vista-calendario">
      {/* ── Grid del mes ── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-base font-black text-white capitalize" data-testid="cal-mes-label">
              {MESES_LARGOS[mes]} {anio}
            </h3>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => nav(-1)} data-testid="boton-cal-anterior" className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white hover:border-cyan-500/60 flex items-center justify-center transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => nav(1)} data-testid="boton-cal-siguiente" className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white hover:border-cyan-500/60 flex items-center justify-center transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1.5">
          {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((d) => (
            <div key={d} className="text-center text-[10px] font-bold text-slate-500 py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1" data-testid="cal-grid">
          {celdas.map((d, i) => {
            if (d === null) return <div key={`vacia-${i}`} className="min-h-[42px]" />;
            const dateStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const esHoy = hoy.getFullYear() === anio && hoy.getMonth() === mes && hoy.getDate() === d;
            const info = txPorDia[dateStr];
            const tieneSub = (subsPorDia[dateStr] || 0) > 0;
            const tieneAlgo = info?.income || info?.expense || tieneSub;
            return (
              <div
                key={dateStr}
                className={`min-h-[42px] rounded-xl flex flex-col items-center justify-center py-1 ${esHoy ? 'bg-emerald-500 text-white font-black' : tieneAlgo ? 'bg-white/5 border border-white/10' : ''}`}
              >
                <span className={`text-xs ${esHoy ? 'font-black' : 'font-medium'} ${esHoy ? 'text-white' : 'text-slate-200'}`}>{d}</span>
                <div className="flex justify-center gap-0.5 mt-0.5 h-[5px]">
                  {info?.income  && <div className="w-[5px] h-[5px] rounded-full bg-emerald-400" />}
                  {info?.expense && <div className="w-[5px] h-[5px] rounded-full bg-rose-400" />}
                  {tieneSub      && <div className="w-[5px] h-[5px] rounded-full bg-indigo-400" />}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Leyenda ── */}
      <div className="flex gap-4 flex-wrap px-1">
        {[
          { c: 'bg-emerald-400', t: 'Ingreso' },
          { c: 'bg-rose-400', t: 'Gasto' },
          { c: 'bg-indigo-400', t: 'Suscripción' },
          { c: 'bg-emerald-500', t: 'Hoy' },
        ].map((l) => (
          <div key={l.t} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-[3px] ${l.c}`} />
            <span className="text-[11px] text-slate-400">{l.t}</span>
          </div>
        ))}
      </div>

      {/* ── Eventos del mes ── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">📋 Eventos del Mes</h3>
        {eventos.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-6" data-testid="cal-sin-eventos">Sin eventos registrados este mes.</p>
        ) : (
          <div className="space-y-2" data-testid="cal-eventos">
            {eventos.map((ev, i) => {
              const st = ESTILO_EVENTO[ev.tipo];
              return (
                <div key={`${ev.date}-${i}`} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border ${st.bg} ${st.border}`}>
                  <div className={`w-2 h-2 rounded-full ${st.dot} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate">{ev.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{fechaCorta(ev.date)} · {st.label}</p>
                  </div>
                  <span className={`text-sm font-bold ${st.monto} shrink-0`}>{st.signo}S/{ev.amount.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
