// ═══════════════════════════════════════════════════════════
// 🌊 SANKEY DE FLUJO — WalletTrack V2 (F8 · ANÁLISIS)
// Visualización SVG pura del flujo de dinero del mes:
//   Ingresos del mes → Gastos por categoría (top 5 + Otros)
//                   → Sobres (recargas del mes)
//                   → Metas (abonos del mes)
//                   → Saldo restante (lo que no se fue)
//
// Mismo ADN de las gráficas de F3 (GraficasStats.tsx): SVG puro,
// sin librerías, sin CDN, offline total. Paths Bézier cúbicos
// entre origen y cada destino, grosor proporcional al monto.
// Hover/touch resalta el flujo y atenúa los demás.
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';

// ── Tipos ────────────────────────────────────────────────────
export interface NodoFlujo {
  id: string;
  label: string;
  monto: number;
  color: string;
}

export interface DatosSankey {
  totalIngresos: number;
  destinos: NodoFlujo[];      // gastos por cat + sobres + metas + saldo
}

interface PropsSankey {
  datos: DatosSankey;
}

// ── Constantes de layout ─────────────────────────────────────
const W = 360;
const H = 280;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 12;
const NODO_ORIGEN_X = 60;          // borde derecho del nodo origen
const NODO_DESTINO_X = W - 110;   // borde izquierdo de los nodos destino
const NODO_ANCHO = 18;
const GAP_NODOS = 6;               // separación vertical entre nodos destino
const RADIO_NODO = 3;              // esquinas redondeadas

// Colores por tipo de destino (mismo palette de EstadisticasView)
const COLORES_CATS = ['#fb7185', '#fbbf24', '#818cf8', '#34d399', '#0ea5e9', '#f97316'];
const COLOR_OTROS = '#94a3b8';      // slate-400
const COLOR_SOBRES = '#fcd34d';     // amber-300
const COLOR_METAS = '#34d399';      // emerald-400
const COLOR_SALDO = '#10b981';      // emerald-500
const COLOR_ORIGEN = '#10b981';     // emerald-500 (ingresos)

/** 12345 → "12.3k" · 850 → "850" (mismo fmtV de GraficasStats) */
function fmtV(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v * 10) / 10);
}

/** Trunca texto a N caracteres con ellipsis */
function truncar(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  return `${texto.slice(0, max - 1)}…`;
}

/** Path Bézier cúbico entre el borde derecho del origen y el borde izquierdo del destino */
function pathFlujo(
  yOrigenInicio: number,
  yOrigenFin: number,
  yDestinoInicio: number,
  yDestinoFin: number,
): string {
  const x0 = NODO_ORIGEN_X;
  const x1 = NODO_DESTINO_X;
  const cx = (x0 + x1) / 2; // punto de control horizontal en el medio
  // Path con 4 puntos: inicio origen, control1, control2, fin destino
  // Llena el área entre los dos nodos
  return [
    `M ${x0},${yOrigenInicio}`,
    `C ${cx},${yOrigenInicio} ${cx},${yDestinoInicio} ${x1},${yDestinoInicio}`,
    `L ${x1},${yDestinoFin}`,
    `C ${cx},${yDestinoFin} ${cx},${yOrigenFin} ${x0},${yOrigenFin}`,
    'Z',
  ].join(' ');
}

export const SankeyFlujo: React.FC<PropsSankey> = ({ datos }) => {
  const [hover, setHover] = useState<string | null>(null);

  if (datos.totalIngresos <= 0 || datos.destinos.length === 0) {
    return (
      <div className="text-center py-10" data-testid="sankey-vacio">
        <p className="text-3xl mb-2">🌊</p>
        <p className="text-xs text-slate-500">
          Necesitás registrar ingresos este mes para ver el flujo.
        </p>
      </div>
    );
  }

  const total = datos.totalIngresos;
  const alturaDisponible = H - PAD_T - PAD_B;

  // ── Calcular altura y posición de cada nodo destino ──
  // Suma de montos para distribuir proporcionalmente (usamos total de ingresos como referencia)
  // Si la suma de destinos > total (gastos > ingresos), el saldo es 0 y reescalamos los destinos
  const sumaDestinos = datos.destinos.reduce((a, d) => a + d.monto, 0);
  const escala = sumaDestinos > total ? total / sumaDestinos : 1;

  let yAcumulada = PAD_T;
  const destinosConPos = datos.destinos.map((d) => {
    const altura = Math.max(2, (d.monto * escala / total) * alturaDisponible);
    const pos = { ...d, y: yAcumulada, altura };
    yAcumulada += altura + GAP_NODOS;
    return pos;
  });

  // ── Nodo origen (ocupa toda la altura disponible) ──
  const alturaOrigen = alturaDisponible;
  const yOrigenInicio = PAD_T;
  const yOrigenFin = PAD_T + alturaOrigen;

  // ── Para el origen, cada flujo ocupa una porción vertical proporcional a su monto ──
  // Ordenamos los destinos igual que aparecen para mapearlos a porciones del origen
  let yCursorOrigen = yOrigenInicio;
  const flujosConOrigen = destinosConPos.map((d) => {
    const alturaFlujoOrigen = (d.monto * escala / total) * alturaOrigen;
    const yFlujoOrigenInicio = yCursorOrigen;
    const yFlujoOrigenFin = yCursorOrigen + alturaFlujoOrigen;
    yCursorOrigen = yFlujoOrigenFin;
    return {
      ...d,
      yOrigenInicio: yFlujoOrigenInicio,
      yOrigenFin: yFlujoOrigenFin,
    };
  });

  return (
    <div data-testid="sankey-flujo" className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Flujo de dinero del mes"
      >
        {/* ── Flujos (paths Bézier) — van primero para que los nodos queden encima ── */}
        {flujosConOrigen.map((f) => {
          const path = pathFlujo(f.yOrigenInicio, f.yOrigenFin, f.y, f.y + f.altura);
          const esHover = hover === f.id;
          const esAtenuado = hover !== null && !esHover;
          return (
            <path
              key={f.id}
              d={path}
              fill={f.color}
              opacity={esHover ? 0.85 : esAtenuado ? 0.15 : 0.5}
              className="transition-opacity duration-150 cursor-pointer"
              onMouseEnter={() => setHover(f.id)}
              onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover(hover === f.id ? null : f.id)}
              data-testid={`flujo-${f.id}`}
            />
          );
        })}

        {/* ── Nodo origen (Ingresos) ── */}
        <g>
          <rect
            x={NODO_ORIGEN_X - NODO_ANCHO}
            y={yOrigenInicio}
            width={NODO_ANCHO}
            height={alturaOrigen}
            rx={RADIO_NODO}
            fill={COLOR_ORIGEN}
            className="transition-opacity duration-150"
            opacity={hover !== null ? 0.4 : 1}
          />
          <text
            x={NODO_ORIGEN_X - NODO_ANCHO - 4}
            y={yOrigenInicio + alturaOrigen / 2}
            fontSize="9"
            fontWeight="bold"
            textAnchor="end"
            className="fill-emerald-400"
          >
            <tspan x={NODO_ORIGEN_X - NODO_ANCHO - 4} dy="-6">Ingresos</tspan>
            <tspan x={NODO_ORIGEN_X - NODO_ANCHO - 4} dy="12" className="fill-slate-300">
              S/ {fmtV(total)}
            </tspan>
          </text>
        </g>

        {/* ── Nodos destino ── */}
        {destinosConPos.map((d) => {
          const esHover = hover === d.id;
          const esAtenuado = hover !== null && !esHover;
          const pct = Math.round((d.monto / total) * 100);
          return (
            <g
              key={d.id}
              className="cursor-pointer"
              onMouseEnter={() => setHover(d.id)}
              onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover(hover === d.id ? null : d.id)}
              data-testid={`nodo-${d.id}`}
            >
              <rect
                x={NODO_DESTINO_X}
                y={d.y}
                width={NODO_ANCHO}
                height={d.altura}
                rx={RADIO_NODO}
                fill={d.color}
                opacity={esAtenuado ? 0.3 : 1}
                className="transition-opacity duration-150"
              />
              {/* Etiqueta a la derecha del nodo */}
              <text
                x={NODO_DESTINO_X + NODO_ANCHO + 4}
                y={d.y + d.altura / 2 + 3}
                fontSize="9"
                fontWeight={esHover ? 'bold' : 'normal'}
                className={esHover ? 'fill-white' : 'fill-slate-300'}
              >
                {truncar(d.label, 14)}
              </text>
              <text
                x={NODO_DESTINO_X + NODO_ANCHO + 4}
                y={d.y + d.altura / 2 + 14}
                fontSize="8"
                className={esHover ? d.color : 'fill-slate-500'}
                style={{ fill: esHover ? d.color : undefined }}
              >
                S/ {fmtV(d.monto)} · {pct}%
              </text>
            </g>
          );
        })}

        {/* ── Tooltip flotante cuando hay hover ── */}
        {hover && (() => {
          const d = destinosConPos.find((x) => x.id === hover);
          if (!d) return null;
          const pct = Math.round((d.monto / total) * 100);
          const tooltipX = NODO_DESTINO_X - 130;
          const tooltipY = Math.max(PAD_T, Math.min(H - 40, d.y + d.altura / 2 - 10));
          return (
            <g data-testid={`tooltip-${d.id}`}>
              <rect
                x={tooltipX}
                y={tooltipY}
                width="120"
                height="32"
                rx="6"
                fill="#0f172a"
                stroke={d.color}
                strokeWidth="1"
                opacity="0.95"
              />
              <text x={tooltipX + 6} y={tooltipY + 12} fontSize="9" fontWeight="bold" className="fill-white">
                {truncar(d.label, 18)}
              </text>
              <text x={tooltipX + 6} y={tooltipY + 24} fontSize="8" className="fill-slate-300">
                S/ {fmtV(d.monto)} · {pct}% del total
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
};

// ── Colores exportados para que EstadisticasView los use al armar los datos ──
export {
  COLORES_CATS,
  COLOR_OTROS,
  COLOR_SOBRES,
  COLOR_METAS,
  COLOR_SALDO,
};
