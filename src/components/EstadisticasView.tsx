// ═══════════════════════════════════════════════════════════
// 📊 ESTADÍSTICAS — WalletTrack V2 (F3 · ANÁLISIS)
// Puerto del view-estadisticas del original (FASE 4 del viejo):
// 6 KPIs (mejor/peor mes, mayor ingreso/gasto, promedios), Top
// categorías de gasto con barras, resumen por mes con tasa de
// ahorro, gráfica de evolución (ingresos vs gastos) y tendencia
// de ahorro % — ambas en SVG puro (ADN FitTrack, sin Chart.js)
// — y los botones de Export Excel (5 hojas con colores) y PDF
// (reporte financiero del mes) del exportExcel/exportPDF.
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TrendingUp, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import type { EstadoWallet } from '../types';
import { resumenMeses, resumenMes, saldoTotal } from '../services/estado';
import { exportarExcel, exportarPDF } from '../services/exportar';
import { soles } from '../services/dinero';
import { GraficaEvolucion, GraficaAhorro } from './GraficasStats';
import { SankeyFlujo, COLORES_CATS as COLORES_CATS_SANKEY, COLOR_OTROS, COLOR_SOBRES, COLOR_METAS, COLOR_SALDO, type DatosSankey, type NodoFlujo } from './SankeyFlujo';

interface EstadisticasViewProps {
  estado: EstadoWallet;
  onToast: (mensaje: string) => void;
}

const COLORES_CATS = ['#fb7185', '#fbbf24', '#818cf8', '#34d399', '#0ea5e9', '#f97316'];

export const EstadisticasView: React.FC<EstadisticasViewProps> = ({ estado, onToast }) => {
  const [exportando, setExportando] = useState<null | 'excel' | 'pdf'>(null);

  const meses = resumenMeses(estado);
  const allTx = estado.transactions;

  // ── KPIs (mismas 6 del renderEstadisticas del viejo) ──
  const mejorMes = meses.length ? meses.reduce((a, b) => (b.ahorro > a.ahorro ? b : a)) : null;
  const peorMes = meses.length ? meses.reduce((a, b) => (b.ahorro < a.ahorro ? b : a)) : null;
  const mayorIng = [...allTx.filter((t) => t.type === 'income')].sort((a, b) => b.amount - a.amount)[0] || null;
  const mayorGasto = [...allTx.filter((t) => t.type === 'expense' && t.category !== '__fondo_empresa__' && !t.esSobre)]
    .sort((a, b) => b.amount - a.amount)[0] || null;
  const totalMeses = meses.length || 1;
  const promIngMes = meses.reduce((a, b) => a + b.ingresos, 0) / totalMeses;
  const promGasMes = meses.reduce((a, b) => a + b.gastos, 0) / totalMeses;

  const kpis = [
    { icon: '🏆', label: 'Mejor Mes', val: mejorMes ? mejorMes.label : '—', sub: mejorMes ? `+${soles(mejorMes.ahorro, false)} ahorro` : '', color: 'text-emerald-400' },
    { icon: '📉', label: 'Peor Mes', val: peorMes ? peorMes.label : '—', sub: peorMes ? `${soles(peorMes.gastos, false)} gastado` : '', color: 'text-rose-400' },
    { icon: '💸', label: 'Mayor Ingreso', val: mayorIng ? soles(mayorIng.amount, false) : '—', sub: mayorIng ? (mayorIng.description || '').slice(0, 18) : '', color: 'text-emerald-400' },
    { icon: '🛒', label: 'Mayor Gasto', val: mayorGasto ? soles(mayorGasto.amount, false) : '—', sub: mayorGasto ? (mayorGasto.description || '').slice(0, 18) : '', color: 'text-rose-400' },
    { icon: '📊', label: 'Prom. Ing/Mes', val: soles(promIngMes, false), sub: 'promedio mensual', color: 'text-indigo-400' },
    { icon: '📊', label: 'Prom. Gasto/Mes', val: soles(promGasMes, false), sub: 'promedio mensual', color: 'text-amber-400' },
  ];

  // ── Top categorías (excluye fondo empresa y ✉️ sobres, regla del viejo) ──
  const catMap: Record<string, number> = {};
  allTx.forEach((t) => {
    if (t.type === 'expense' && t.category !== '__fondo_empresa__' && !t.esSobre) {
      catMap[t.category] = (catMap[t.category] || 0) + (Number(t.amount) || 0);
    }
  });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCat = topCats[0]?.[1] || 1;

  // ── F8 · 🌊 Sankey: cálculo de flujos del mes actual ──
  const { ingresos: ingMes, gastos: gasMes } = resumenMes(estado);
  // Top 5 categorías de gasto del MES + "Otros"
  const catMapMes: Record<string, number> = {};
  allTx.forEach((t) => {
    const mesISO = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    if (t.type === 'expense' && t.category !== '__fondo_empresa__' && !t.esSobre && (t.date || '').startsWith(mesISO)) {
      catMapMes[t.category] = (catMapMes[t.category] || 0) + (Number(t.amount) || 0);
    }
  });
  const topCatsMes = Object.entries(catMapMes).sort((a, b) => b[1] - a[1]);
  const top5CatsMes = topCatsMes.slice(0, 5);
  const otrosCatsMonto = topCatsMes.slice(5).reduce((a, [, v]) => a + v, 0);
  // Sobres: recargas del mes (sobreMovs tipo recarga en el mes actual)
  const mesISOActual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const sobresRecargadosMes = estado.sobreMovs
    .filter((m) => m.tipo === 'recarga' && (m.fecha || '').startsWith(mesISOActual))
    .reduce((a, m) => a + (Number(m.monto) || 0), 0);
  // Metas: abonos del mes (transacciones de tipo expense con categoría 'Ahorro' en el mes)
  const metasAbonadasMes = allTx
    .filter((t) => t.type === 'expense' && t.category === 'Ahorro' && (t.date || '').startsWith(mesISOActual))
    .reduce((a, t) => a + (Number(t.amount) || 0), 0);
  // Saldo restante: ingresos - (gastos + sobres + metas). Si es negativo, 0.
  const gastosParaSaldo = gasMes + sobresRecargadosMes + metasAbonadasMes;
  const saldoRestante = Math.max(0, ingMes - gastosParaSaldo);

  const destinosSankey: NodoFlujo[] = [
    ...top5CatsMes.map(([cat, monto], i) => ({
      id: `cat_${i}`,
      label: cat,
      monto,
      color: COLORES_CATS_SANKEY[i] ?? COLOR_OTROS,
    })),
    ...(otrosCatsMonto > 0 ? [{
      id: 'otros',
      label: 'Otros',
      monto: otrosCatsMonto,
      color: COLOR_OTROS,
    }] : []),
    ...(sobresRecargadosMes > 0 ? [{
      id: 'sobres',
      label: '✉️ Sobres',
      monto: sobresRecargadosMes,
      color: COLOR_SOBRES,
    }] : []),
    ...(metasAbonadasMes > 0 ? [{
      id: 'metas',
      label: '🎯 Metas',
      monto: metasAbonadasMes,
      color: COLOR_METAS,
    }] : []),
    ...(saldoRestante > 0 ? [{
      id: 'saldo',
      label: '💰 Saldo',
      monto: saldoRestante,
      color: COLOR_SALDO,
    }] : []),
  ];

  const datosSankey: DatosSankey = {
    totalIngresos: ingMes,
    destinos: destinosSankey,
  };

  const ultimos6 = meses.slice(-6);

  const lanzarExcel = async () => {
    setExportando('excel');
    try {
      await exportarExcel(estado);
      onToast('✅ Excel generado, abriendo...');
    } catch (e) {
      onToast('Error generando Excel: ' + (e instanceof Error ? e.message : 'desconocido'));
    } finally {
      setExportando(null);
    }
  };

  const lanzarPDF = async () => {
    setExportando('pdf');
    try {
      await exportarPDF(estado);
      onToast('✅ PDF listo para compartir');
    } catch (e) {
      onToast('Error generando PDF: ' + (e instanceof Error ? e.message : 'desconocido'));
    } finally {
      setExportando(null);
    }
  };

  return (
    <div className="space-y-5" data-testid="vista-estadisticas">
      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-3" data-testid="stats-kpis">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl bg-slate-900 border border-slate-700/80 p-3.5 relative overflow-hidden">
            <div className="text-lg mb-1.5">{k.icon}</div>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">{k.label}</p>
            <p className={`text-lg font-black ${k.color} leading-tight`}>{k.val}</p>
            <p className="text-[9px] text-slate-500 mt-0.5 truncate">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── F8 · 🌊 Sankey de flujo del mes ── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5" data-testid="tarjeta-sankey">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">🌊 Flujo del Mes</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">A dónde fue cada sol de tus ingresos</p>
          </div>
          <span className="text-[10px] text-slate-400">
            Ingresos: <span className="font-bold text-emerald-400">S/ {Math.round(ingMes)}</span>
          </span>
        </div>
        <SankeyFlujo datos={datosSankey} />
        <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
          Tocá un flujo para ver el detalle. El verde del final es lo que te queda sin gastar, apartar ni abonar a metas.
        </p>
      </section>

      {/* ── Gráfica evolución (líneas ingresos vs gastos) ── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-200">📈 Evolución Financiera</h3>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" /> Ingresos</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-400" /> Gastos</span>
          </div>
        </div>
        {ultimos6.length >= 2 ? (
          <GraficaEvolucion meses={ultimos6} />
        ) : (
          <p className="text-center text-xs text-slate-500 py-10" data-testid="sin-grafica-evolucion">
            Necesitas al menos 2 meses con movimientos para ver la evolución.
          </p>
        )}
      </section>

      {/* ── Gráfica tendencia de ahorro (barras %) ── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-200">💰 Tendencia de Ahorro %</h3>
          <span className="text-[10px] text-slate-500">Tasa mensual</span>
        </div>
        {ultimos6.length > 0 ? (
          <GraficaAhorro meses={ultimos6} />
        ) : (
          <p className="text-center text-xs text-slate-500 py-10">Sin datos de ahorro aún.</p>
        )}
      </section>

      {/* ── Top categorías ── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <h3 className="text-sm font-bold text-slate-200 mb-4">🏆 Top Categorías de Gasto</h3>
        {topCats.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-4">Sin datos de gastos aún.</p>
        ) : (
          <div className="space-y-2" data-testid="stats-top-cats">
            {topCats.map(([cat, amt], i) => (
              <div key={cat} className="flex items-center gap-2.5">
                <span className="text-[11px] text-slate-400 min-w-[80px] truncate">{cat}</span>
                <div className="flex-1 bg-white/5 rounded-full h-[7px] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(amt / maxCat) * 100}%`, background: COLORES_CATS[i] }}
                  />
                </div>
                <span className="text-[11px] font-bold min-w-[56px] text-right" style={{ color: COLORES_CATS[i] }}>
                  {soles(amt, false)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Resumen por mes ── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <h3 className="text-sm font-bold text-slate-200 mb-4">📅 Resumen por Mes</h3>
        {meses.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-4">Sin datos históricos aún.</p>
        ) : (
          <div className="space-y-1.5" data-testid="stats-meses">
            {[...meses].slice(-6).reverse().map((m) => {
              const pct = Math.max(0, Math.min(100, m.pctAhorro));
              const color = m.pctAhorro >= 20 ? 'bg-emerald-400' : m.pctAhorro >= 0 ? 'bg-amber-400' : 'bg-rose-400';
              const colorTxt = m.pctAhorro >= 20 ? 'text-emerald-400' : m.pctAhorro >= 0 ? 'text-amber-400' : 'text-rose-400';
              return (
                <div key={m.mes} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-xs font-bold text-slate-200 min-w-[48px]">{m.label}</span>
                  <div className="flex-1 mx-3 bg-white/5 rounded-full h-[5px] overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-right min-w-[90px]">
                    <span className={`text-[11px] font-bold ${colorTxt}`}>{m.pctAhorro.toFixed(0)}%</span>
                    <span className="text-[9px] text-slate-500 ml-1.5">{soles(m.ahorro, false)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Exportar ── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <h3 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" /> 📤 Exportar Datos
        </h3>
        <p className="text-[11px] text-slate-400 mb-4">
          Descarga tus finanzas en Excel con colores y 5 hojas (transacciones, presupuestos, metas, resumen y saldos), o el reporte PDF del mes.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={lanzarExcel}
            disabled={exportando !== null}
            data-testid="boton-export-excel"
            className="py-3.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white text-[13px] font-black shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {exportando === 'excel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            {exportando === 'excel' ? 'Generando...' : '📊 Excel'}
          </button>
          <button
            onClick={lanzarPDF}
            disabled={exportando !== null}
            data-testid="boton-export-pdf"
            className="py-3.5 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 text-white text-[13px] font-black shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {exportando === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {exportando === 'pdf' ? 'Generando...' : '📄 PDF'}
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mt-2.5 leading-relaxed">
          El respaldo JSON v3.0 (completo, restaurable) sigue en Ajustes — el Excel/PDF son para compartir y revisar.
        </p>
      </section>
    </div>
  );
};
