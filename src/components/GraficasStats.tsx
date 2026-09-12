// ═══════════════════════════════════════════════════════════
// 📈 GRÁFICAS DE ESTADÍSTICAS — WalletTrack V2 (F3 · ANÁLISIS)
// SVG puro sin librerías — mismo ADN del GraficaLinea del
// FitTrack V2 (F4 · Progreso): los charts del original usaban
// Chart.js por CDN; acá la geometría se calcula a mano para no
// engordar el APK ni depender de internet. Dos gráficas del
// renderEstadisticas() del viejo:
//   • Evolución: líneas Ingresos vs Gastos (últimos 6 meses)
//   • Ahorro: barras del % de ahorro mensual (verde/ámbar/rojo)
// ═══════════════════════════════════════════════════════════

import React from 'react';
import type { ResumenMesCalculado } from '../services/estado';

/** 12345 → "12.3k" · 850 → "850" (mismo fmtV del FitTrack) */
function fmtV(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v * 10) / 10);
}

interface PropsEvolucion {
  meses: ResumenMesCalculado[];
}

/** Línea doble Ingresos (esmeralda) vs Gastos (rosa) con área suave — 320×140 */
export const GraficaEvolucion: React.FC<PropsEvolucion> = ({ meses }) => {
  if (meses.length < 2) return null;
  const W = 320, H = 140, padL = 34, padR = 8, padT = 10, padB = 20;
  const valores = [...meses.map((m) => m.ingresos), ...meses.map((m) => m.gastos)];
  const max = Math.max(...valores, 1);
  const min = 0;

  const px = (i: number) => padL + (i / (meses.length - 1)) * (W - padL - padR);
  const py = (v: number) => padT + (1 - (v - min) / ((max - min) || 1)) * (H - padT - padB);

  const linea = (sel: (m: ResumenMesCalculado) => number) => {
    let path = '';
    meses.forEach((m, i) => { path += `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(sel(m)).toFixed(1)}`; });
    return path;
  };
  const area = (sel: (m: ResumenMesCalculado) => number) =>
    `${linea(sel)}L${px(meses.length - 1).toFixed(1)},${(H - padB).toFixed(1)}L${padL},${(H - padB).toFixed(1)}Z`;

  // Máximo 5 etiquetas en el eje X (regla del FitTrack)
  const paso = Math.ceil(meses.length / 5);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Evolución financiera">
      <text x="2" y={padT + 6} fontSize="8" className="fill-slate-500">{fmtV(max)}</text>
      <text x="2" y={H - padB} fontSize="8" className="fill-slate-500">{fmtV(min)}</text>
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} strokeWidth="1" className="stroke-slate-600" />
      {/* Gastos (rosa) debajo */}
      <path d={area((m) => m.gastos)} className="fill-rose-400/10" />
      <path d={linea((m) => m.gastos)} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="stroke-rose-400" />
      {/* Ingresos (esmeralda) encima */}
      <path d={area((m) => m.ingresos)} className="fill-emerald-400/10" />
      <path d={linea((m) => m.ingresos)} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="stroke-emerald-400" />
      {meses.map((m, i) => (
        <g key={m.mes}>
          <circle cx={px(i)} cy={py(m.ingresos)} r="3" className="fill-emerald-400" />
          <circle cx={px(i)} cy={py(m.gastos)} r="3" className="fill-rose-400" />
          {(meses.length <= 5 || i % paso === 0 || i === meses.length - 1) && (
            <text x={px(i)} y={H - 6} fontSize="8" textAnchor="middle" className="fill-slate-500">{m.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
};

interface PropsAhorro {
  meses: ResumenMesCalculado[];
}

/** Barras del % de ahorro: ≥20% esmeralda · ≥0 ámbar · <0 rosa — 320×110 */
export const GraficaAhorro: React.FC<PropsAhorro> = ({ meses }) => {
  if (meses.length === 0) return null;
  const W = 320, H = 110, padL = 30, padR = 8, padT = 10, padB = 20;
  const maxAbs = Math.max(...meses.map((m) => Math.abs(m.pctAhorro)), 10);
  const ceroY = padT + (maxAbs / (2 * maxAbs)) * (H - padT - padB); // eje en el 0%
  const escala = (v: number) => (Math.abs(v) / (2 * maxAbs)) * (H - padT - padB);

  const ancho = (W - padL - padR) / meses.length;
  const paso = Math.ceil(meses.length / 5);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Tendencia de ahorro">
      <text x="2" y={padT + 6} fontSize="8" className="fill-slate-500">{Math.round(maxAbs)}%</text>
      <text x="2" y={ceroY + 3} fontSize="8" className="fill-slate-500">0%</text>
      <line x1={padL} y1={ceroY} x2={W - padR} y2={ceroY} strokeWidth="1" className="stroke-slate-600" />
      {meses.map((m, i) => {
        const h = escala(m.pctAhorro);
        const color = m.pctAhorro >= 20 ? 'fill-emerald-400' : m.pctAhorro >= 0 ? 'fill-amber-400' : 'fill-rose-400';
        const y = m.pctAhorro >= 0 ? ceroY - h : ceroY;
        return (
          <g key={m.mes}>
            <rect x={padL + i * ancho + ancho * 0.18} y={y} width={ancho * 0.64} height={Math.max(h, 1)} rx="3" className={color} />
            {(meses.length <= 5 || i % paso === 0 || i === meses.length - 1) && (
              <text x={padL + i * ancho + ancho / 2} y={H - 6} fontSize="8" textAnchor="middle" className="fill-slate-500">{m.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
};
