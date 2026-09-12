// ═══════════════════════════════════════════════════════════
// 🎨 THEME STUDIO — WalletTrack V2 (F4)
// El Theme Studio 2.0 del wallettrack original, portado a la
// V2 con las MISMAS 9 secciones y los mismos controles:
//   1. Luminosidad Base (5 niveles 🌑🌒🌓🌔☀️)
//   2. Temas Alpha (9 presets con sus colores exactos)
//   3. Estilo de Componentes (minimal/premium/gaming/neón/elegante)
//   4. Personalización Avanzada (color custom + hex + opacidad glass)
//   5. Fondo Animado (6: partículas, gradiente, aurora, pulso, matrix)
//   6. Tipografía (Inter/Outfit/Roboto/Poppins/Nunito/mono)
//   7. Radio de Tarjetas (cuadrado/redondeado/píldora)
//   8. Velocidad de Animaciones (rápida/normal/lenta/ninguna)
//   9. Legibilidad (modo compacto + tamaño de fuente 80–120%)
// Cada cambio se aplica EN VIVO (setTema guarda + aplica vars
// CSS → toda la app cambia al instante) y queda guardado en
// wallettrack_theme (misma clave del viejo).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { X, Palette, RotateCcw } from 'lucide-react';
import type { TemaWallet } from '../types';
import {
  leerTema, setTema, resetTema,
  LUMINOSIDADES, PRESETS, ESTILOS, FUENTES, FONDOS, RADIOS, ANIMS,
} from '../services/tema';

interface ThemeStudioProps {
  abierto: boolean;
  onCerrar: () => void;
  onCambio?: (tema: TemaWallet) => void;  // App lo usa para refrescar el canvas de fondo
}

const SECCION = 'text-[10px] font-bold text-emerald-400 tracking-[1.5px] uppercase mb-2.5';

export const ThemeStudioModal: React.FC<ThemeStudioProps> = ({ abierto, onCerrar, onCambio }) => {
  const [tema, setTemaEstado] = useState<TemaWallet>(() => leerTema());

  // ESC cierra (mismo patrón del NavDrawer)
  useEffect(() => {
    if (!abierto) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [abierto, onCerrar]);

  // Cambiar = aplicar en vivo + guardar (clave del viejo)
  const cambiar = (parcial: Partial<TemaWallet>) => {
    const nuevo = setTema(parcial);
    setTemaEstado(nuevo);
    onCambio?.(nuevo);
  };

  if (!abierto) return null;

  const activo = (cond: boolean) =>
    `border-2 rounded-xl text-center cursor-pointer transition-all active:scale-95 ${
      cond
        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
        : 'border-transparent bg-white/[.04] text-slate-200 hover:bg-white/[.08]'
    }`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
        onClick={onCerrar}
      />

      {/* Hoja del studio */}
      <div
        data-testid="modal-theme-studio"
        className="fixed z-[70] inset-x-0 bottom-0 top-10 sm:top-16 mx-auto max-w-lg rounded-t-3xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 shrink-0">
              <Palette className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-slate-100">Theme Studio</h3>
              <span className="text-[10px] text-slate-500 tracking-[.5px] uppercase">WalletTrack V2</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { const t = resetTema(); setTemaEstado(t); onCambio?.(t); }}
              data-testid="boton-reset-tema"
              title="Volver al tema original"
              className="w-9 h-9 rounded-xl bg-white/[.06] border border-white/[.08] text-slate-400 hover:text-white flex items-center justify-center transition-all"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onCerrar}
              data-testid="boton-cerrar-studio"
              className="w-9 h-9 rounded-xl bg-white/[.06] border border-white/[.08] text-slate-400 hover:text-white flex items-center justify-center transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div className="overflow-y-auto custom-scrollbar px-5 py-5 space-y-6 flex-1">

          {/* 1 · LUMINOSIDAD BASE */}
          <div data-testid="seccion-luminosidad">
            <p className={SECCION}>Luminosidad Base</p>
            <div className="grid grid-cols-5 gap-1.5">
              {LUMINOSIDADES.map((l) => (
                <button
                  key={l.id}
                  onClick={() => cambiar({ brightness: l.id as TemaWallet['brightness'] })}
                  data-testid={`br-${l.id}`}
                  className={`${activo(tema.brightness === l.id)} p-2`}
                >
                  <div className="text-lg leading-none">{l.icono}</div>
                  <div className="text-[9px] text-slate-400 mt-1 font-semibold">{l.nombre}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 2 · TEMAS ALPHA */}
          <div data-testid="seccion-preset">
            <p className={SECCION}>Temas Alpha</p>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => cambiar({ accent: p.color, name: p.id })}
                  data-testid={`pr-${p.id}`}
                  className={`${activo(tema.name === p.id)} flex items-center gap-2 px-2 py-2.5`}
                >
                  {p.icono
                    ? <span className="text-xs shrink-0">{p.icono}</span>
                    : <span className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color }} />}
                  <span className="text-[11px] font-semibold truncate">{p.nombre}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3 · ESTILO DE COMPONENTES */}
          <div data-testid="seccion-estilo">
            <p className={SECCION}>Estilo de Componentes</p>
            <div className="grid grid-cols-3 gap-1.5">
              {ESTILOS.map((s) => (
                <button
                  key={s}
                  onClick={() => cambiar({ style: s as TemaWallet['style'] })}
                  data-testid={`st-${s}`}
                  className={`${activo(tema.style === s)} py-2.5 px-1 text-[11px] font-semibold capitalize`}
                >
                  {s === 'neon' ? 'Neón' : s}
                </button>
              ))}
            </div>
          </div>

          {/* 4 · PERSONALIZACIÓN AVANZADA */}
          <div data-testid="seccion-avanzada" className="bg-white/[.03] border border-white/[.06] rounded-2xl p-4">
            <p className={SECCION}>Personalización Avanzada</p>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-200">Color Custom:</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={tema.accent}
                  onChange={(e) => cambiar({ accent: e.target.value, name: 'custom' })}
                  data-testid="input-color-custom"
                  className="w-10 h-8 rounded-lg border border-slate-600 cursor-pointer p-0.5 bg-slate-900"
                />
                <input
                  type="text"
                  placeholder="#10b981"
                  maxLength={7}
                  defaultValue={tema.accent}
                  key={tema.accent}
                  onChange={(e) => {
                    if (e.target.value.match(/^#[0-9a-fA-F]{6}$/)) {
                      cambiar({ accent: e.target.value.toLowerCase(), name: 'custom' });
                    }
                  }}
                  data-testid="input-hex-custom"
                  className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-100 text-xs font-mono"
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-200">Opacidad del Cristal (Glass)</span>
                <span className="text-xs font-bold text-emerald-400" data-testid="valor-glass">
                  {tema.glassOpacity.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.3}
                max={0.95}
                step={0.05}
                value={tema.glassOpacity}
                onChange={(e) => cambiar({ glassOpacity: parseFloat(e.target.value), glass: true })}
                data-testid="slider-glass"
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          {/* 5 · FONDO ANIMADO */}
          <div data-testid="seccion-fondo">
            <p className={SECCION}>Fondo Animado</p>
            <div className="grid grid-cols-3 gap-1.5">
              {FONDOS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => cambiar({ background: f.id as TemaWallet['background'] })}
                  data-testid={`bg-${f.id}`}
                  className={`${activo(tema.background === f.id)} flex items-center gap-2 px-2 py-2.5`}
                >
                  <span className="text-sm shrink-0">{f.icono}</span>
                  <span className="text-[11px] font-semibold truncate">{f.nombre}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 6 · TIPOGRAFÍA */}
          <div data-testid="seccion-tipografia">
            <p className={SECCION}>Tipografía</p>
            <div className="grid grid-cols-3 gap-1.5">
              {FUENTES.map((f) => (
                <button
                  key={f}
                  onClick={() => cambiar({ font: f as TemaWallet['font'] })}
                  data-testid={`fn-${f}`}
                  className={`${activo(tema.font === f)} py-2.5 px-1 text-[11px] font-semibold`}
                  style={{ fontFamily: f === 'mono' ? 'ui-monospace, monospace' : `'${f}', sans-serif` }}
                >
                  {f === 'mono' ? 'Mono' : f}
                </button>
              ))}
            </div>
          </div>

          {/* 7 · RADIO DE TARJETAS */}
          <div data-testid="seccion-radio">
            <p className={SECCION}>Radio de Tarjetas</p>
            <div className="grid grid-cols-3 gap-1.5">
              {RADIOS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => cambiar({ cardRadius: r.id as TemaWallet['cardRadius'] })}
                  data-testid={`rd-${r.id}`}
                  className={`${activo(tema.cardRadius === r.id)} py-2.5 px-1 text-[11px] font-semibold`}
                >
                  {r.nombre}
                </button>
              ))}
            </div>
          </div>

          {/* 8 · VELOCIDAD DE ANIMACIONES */}
          <div data-testid="seccion-anim">
            <p className={SECCION}>Velocidad de Animaciones</p>
            <div className="grid grid-cols-4 gap-1.5">
              {ANIMS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => cambiar({ animSpeed: a.id as TemaWallet['animSpeed'] })}
                  data-testid={`an-${a.id}`}
                  className={`${activo(tema.animSpeed === a.id)} py-2.5 px-1 text-[11px] font-semibold`}
                >
                  {a.nombre}
                </button>
              ))}
            </div>
          </div>

          {/* 9 · LEGIBILIDAD */}
          <div data-testid="seccion-legibilidad" className="bg-white/[.03] border border-white/[.06] rounded-2xl p-4">
            <p className={SECCION}>Legibilidad</p>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-200">Modo Compacto</span>
              <button
                onClick={() => cambiar({ compact: !tema.compact })}
                data-testid="toggle-compacto"
                className={`relative w-11 h-6 rounded-full transition-colors ${tema.compact ? 'bg-emerald-500' : 'bg-slate-600'}`}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                  style={{ left: tema.compact ? '22px' : '2px' }}
                />
              </button>
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-200">Tamaño de Fuente</span>
                <span className="text-xs font-bold text-emerald-400" data-testid="valor-fuente">
                  {tema.fontSize}%
                </span>
              </div>
              <input
                type="range"
                min={80}
                max={120}
                step={5}
                value={tema.fontSize}
                onChange={(e) => cambiar({ fontSize: parseInt(e.target.value, 10) })}
                data-testid="slider-fuente"
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed pb-2">
            El tema se guarda en este aparato (clave wallettrack_theme, igual que el original) y no
            sube a la nube: cada teléfono tiene su propio look. El botón ↺ vuelve al tema Emerald Deep.
          </p>
        </div>
      </div>
    </>
  );
};
