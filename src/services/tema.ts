// ═══════════════════════════════════════════════════════════
// 🎨 TEMA — WalletTrack V2 (F4 · Theme Studio)
// Portado 1:1 del Theme Studio 2.0 del wallettrack original:
// MISMA forma guardada en la MISMA clave wallettrack_theme (un
// tema guardado en el viejo WalletTrack carga acá sin conversión
// y viceversa). NO viaja a la nube: es preferencia del aparato,
// igual que en el original (sync.ts nunca la tocó).
//
// EL TRUCO QUIRÚRGICO: Tailwind v4 compila cada utilidad de
// color como variable CSS (text-emerald-400 → var(--color-
// emerald-400), bg-slate-950 → var(--color-slate-950), hasta
// text-white → var(--color-white)). Al sobreescribir esas vars
// en :root se re-pinta TODA la app al instante SIN tocar ni una
// vista: el acento cambia emerald→lo que elijas, la luminosidad
// cambia el fondo slate, y "light" voltea texto claro→oscuro.
// ═══════════════════════════════════════════════════════════

import type { TemaWallet } from '../types';

// ── Clave del viejo (NO cambiar: compatibilidad de datos) ────
const CLAVE_TEMA = 'wallettrack_theme';

// ── Forma exacta del viejo (AppState.theme) ───────────────────
export const TEMA_POR_DEFECTO: TemaWallet = {
  accent:      '#10b981',
  name:        'emerald',
  glass:       true,
  glassOpacity: 0.7,
  brightness:  'deep',
  style:       'premium',
  background:  'none',
  compact:     false,
  fontSize:    100,
  font:        'Inter',
  cardRadius:  'rounded',
  animSpeed:   'normal',
};

// ── BRIGHTNESS_CONFIGS del viejo (1:1) ────────────────────────
// bg → var slate-950 · cardBg → base de slate-800 (con el alpha
// del slider Glass) · text se resuelve volteando la rampa slate.
export const BRIGHTNESS_CONFIGS: Record<string, { bg: string; card: string }> = {
  'deep':       { bg: '#090d16', card: '#162031' },  // cardBg rgba(22,30,49) del viejo
  'soft-dark':  { bg: '#0f1623', card: '#1e2a41' },  // rgba(30,42,65)
  'neutro':     { bg: '#141b2d', card: '#233048' },  // rgba(35,48,72)
  'soft-light': { bg: '#1a2235', card: '#2a3450' },  // rgba(240,244,255,.08) sobre bg
  'light':      { bg: '#f0f4ff', card: '#ffffff' },
};

// Mapa de luminosidad → overrides de la rampa slate (900 = header
// /nav, 800 = tarjetas, 700 = bordes). En 'light' se voltea toda
// la rampa + --color-white para que el texto claro se vuelva
// oscuro (mismo efecto del body.theme-light del viejo).
const SLATE_POR_LUMINOSIDAD: Record<string, Record<string, string>> = {
  'deep':       { 950: '#090d16', 900: '#10192a', 800: '#162031', 700: '#243046' },
  'soft-dark':  { 950: '#0f1623', 900: '#151f31', 800: '#1e2a41', 700: '#2e3a52' },
  'neutro':     { 950: '#141b2d', 900: '#1a2438', 800: '#233048', 700: '#333f58' },
  'soft-light': { 950: '#1a2235', 900: '#202b41', 800: '#2a3450', 700: '#3a455f' },
  'light':      {
    950: '#f0f4ff', 900: '#e3eaf8', 800: '#ffffff', 700: '#c3cde2',
    600: '#94a3b8', 500: '#64748b', 400: '#52607a', 300: '#334155',
    200: '#1e293b', 100: '#0f172a',
  },
};

// ── Presets Alpha del viejo (1:1, 9 temas) ────────────────────
export const PRESETS: { id: string; nombre: string; color: string; icono?: string }[] = [
  { id: 'emerald',   nombre: 'Emerald',   color: '#10b981' },
  { id: 'blue',      nombre: 'Blue',      color: '#3b82f6' },
  { id: 'titan-red', nombre: 'Titan Red', color: '#ef4444' },
  { id: 'purple',    nombre: 'Purple',    color: '#a855f7' },
  { id: 'carbon',    nombre: 'Carbon',    color: '#64748b' },
  { id: 'sunset',    nombre: 'Sunset',    color: '#f59e0b' },
  { id: 'galaxy',    nombre: 'Galaxy',    color: '#6366f1', icono: '🚀' },
  { id: 'inferno',   nombre: 'Inferno',   color: '#f97316', icono: '🔥' },
  { id: 'pink',      nombre: 'Pink',      color: '#ec4899' },
];

// ── STYLE_CONFIGS del viejo (1:1) → vars CSS ─────────────────
export const STYLE_CONFIGS: Record<string, { radius: string; shadow: string; border: string }> = {
  'minimal':  { radius: '8px',    shadow: 'none',                                      border: '1px solid rgba(255,255,255,.05)' },
  'premium':  { radius: '24px',   shadow: '0 8px 32px rgba(0,0,0,.37)',                border: '1px solid rgba(255,255,255,.06)' },
  'gaming':   { radius: '6px',    shadow: '0 0 20px rgba(var(--wt-accent-rgb),.2)',    border: '2px solid var(--wt-accent)' },
  'neon':     { radius: '16px',   shadow: '0 0 30px rgba(var(--wt-accent-rgb),.15)',   border: '1px solid var(--wt-accent)' },
  'elegante': { radius: '20px',   shadow: '0 4px 24px rgba(0,0,0,.5)',                 border: '1px solid rgba(255,255,255,.04)' },
};

// ── FONT_MAP del viejo (1:1; las fuentes se cargan en index.html) ──
export const FONT_MAP: Record<string, string> = {
  'Inter':   "'Inter', -apple-system, sans-serif",
  'Outfit':  "'Outfit', sans-serif",
  'Roboto':  "'Roboto', sans-serif",
  'Poppins': "'Poppins', sans-serif",
  'Nunito':  "'Nunito', sans-serif",
  'mono':    "ui-monospace, 'Courier New', monospace",
};

// ── RADIUS_MAP / ANIM_MAP del viejo (1:1) ─────────────────────
export const RADIUS_MAP: Record<string, string> = { square: '8px', rounded: '1.5rem', pill: '2rem' };
export const ANIM_MAP: Record<string, string>   = { fast: '0.4', normal: '1', slow: '2.5', none: '0' };

export const LUMINOSIDADES: { id: string; nombre: string; icono: string }[] = [
  { id: 'deep',       nombre: 'Deep',    icono: '🌑' },
  { id: 'soft-dark',  nombre: 'Soft D.', icono: '🌒' },
  { id: 'neutro',     nombre: 'Neutro',  icono: '🌓' },
  { id: 'soft-light', nombre: 'Soft L.', icono: '🌔' },
  { id: 'light',      nombre: 'Light',   icono: '☀️' },
];

export const ESTILOS = ['minimal', 'premium', 'gaming', 'neon', 'elegante'] as const;
export const FUENTES = ['Inter', 'Outfit', 'Roboto', 'Poppins', 'Nunito', 'mono'] as const;
export const RADIOS: { id: string; nombre: string }[] = [
  { id: 'square',  nombre: 'Cuadrado' },
  { id: 'rounded', nombre: 'Redondeado' },
  { id: 'pill',    nombre: 'Píldora' },
];
export const ANIMS: { id: string; nombre: string }[] = [
  { id: 'fast',   nombre: 'Rápida' },
  { id: 'normal', nombre: 'Normal' },
  { id: 'slow',   nombre: 'Lenta' },
  { id: 'none',   nombre: 'Ninguna' },
];
export const FONDOS: { id: string; nombre: string; icono: string }[] = [
  { id: 'none',      nombre: 'Ninguno',    icono: '⬛' },
  { id: 'particles', nombre: 'Partículas', icono: '✨' },
  { id: 'gradient',  nombre: 'Gradiente',  icono: '🌈' },
  { id: 'aurora',    nombre: 'Aurora',     icono: '🌌' },
  { id: 'pulse',     nombre: 'Pulso',      icono: '💓' },
  { id: 'matrix',    nombre: 'Matrix',     icono: '🟩' },
];

// ── Helpers de color (derivados de un hex) ────────────────────
function hexRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** aclara un hex (ratio 0-1 hacia blanco) */
function aclarar(hex: string, ratio: number): string {
  const [r, g, b] = hexRGB(hex);
  const m = (c: number) => Math.round(c + (255 - c) * ratio);
  return '#' + [m(r), m(g), m(b)].map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** oscurece un hex (ratio 0-1 hacia negro) */
function oscurecer(hex: string, ratio: number): string {
  const [r, g, b] = hexRGB(hex);
  const m = (c: number) => Math.round(c * (1 - ratio));
  return '#' + [m(r), m(g), m(b)].map((c) => c.toString(16).padStart(2, '0')).join('');
}

// ── Lectura / escritura (clave del viejo, misma forma) ────────
export function leerTema(): TemaWallet {
  try {
    const crudo = localStorage.getItem(CLAVE_TEMA);
    if (!crudo) return { ...TEMA_POR_DEFECTO };
    const parsed = JSON.parse(crudo);
    if (!parsed || typeof parsed !== 'object') return { ...TEMA_POR_DEFECTO };
    // merge defensivo: el viejo guardaba subsets viejos (línea
    // 6614 del original guardaba solo {accent,name,glass})
    return { ...TEMA_POR_DEFECTO, ...(parsed as Partial<TemaWallet>) };
  } catch {
    return { ...TEMA_POR_DEFECTO };
  }
}

export function guardarTema(tema: TemaWallet): void {
  try { localStorage.setItem(CLAVE_TEMA, JSON.stringify(tema)); } catch { /* storage lleno */ }
}

// ── Aplicación del tema (vars CSS — el truco Tailwind v4) ────
export function aplicarTema(tema: TemaWallet): void {
  const root = document.documentElement;
  const body = document.body;

  // 1 · ACENTO: sobreescribir la rampa emerald (la identidad de
  // marca de V2) con derivados del acento elegido + teal del
  // gradiente del logo → TODA la app cambia de color de golpe.
  const a = tema.accent || TEMA_POR_DEFECTO.accent;
  root.style.setProperty('--color-emerald-300', aclarar(a, 0.25));
  root.style.setProperty('--color-emerald-400', aclarar(a, 0.12));
  root.style.setProperty('--color-emerald-500', a);
  root.style.setProperty('--color-emerald-600', oscurecer(a, 0.14));
  root.style.setProperty('--color-teal-500', oscurecer(a, 0.06));
  root.style.setProperty('--color-teal-600', oscurecer(a, 0.20));
  root.style.setProperty('--wt-accent', a);
  root.style.setProperty('--wt-accent-rgb', hexRGB(a).join(','));
  root.style.setProperty('--accent', a);              // vars del viejo, por si acaso
  root.style.setProperty('--accent-glow', a + '26');

  // 2 · LUMINOSIDAD: rampa slate (950 fondo · 900 header/nav ·
  // 800 tarjetas · 700 bordes). En light se voltea + white.
  const br = tema.brightness || 'deep';
  const slate = SLATE_POR_LUMINOSIDAD[br] ?? SLATE_POR_LUMINOSIDAD.deep;
  (['950', '900', '800', '700', '600', '500', '400', '300', '200', '100'] as const).forEach((n) => {
    if (slate[n]) root.style.setProperty(`--color-slate-${n}`, slate[n]);
  });
  root.style.setProperty('--color-white', br === 'light' ? '#0f172a' : '#fff');
  body.classList.toggle('theme-light', br === 'light');

  // 3 · GLASS: slate-800 (tarjetas) con el alpha del slider —
  // las tarjetas se vuelven cristal sobre el fondo animado.
  const cfgBr = BRIGHTNESS_CONFIGS[br] ?? BRIGHTNESS_CONFIGS.deep;
  const opacidad = typeof tema.glassOpacity === 'number' ? tema.glassOpacity : 0.7;
  const [r, g, b] = hexRGB(cfgBr.card);
  const esLight = br === 'light';
  root.style.setProperty('--color-slate-800',
    `rgba(${r},${g},${b},${esLight ? Math.min(1, opacidad + 0.15) : opacidad})`);

  // 4 · ESTILO DE COMPONENTES: vars del CSS de index.css
  const est = STYLE_CONFIGS[tema.style || 'premium'] ?? STYLE_CONFIGS.premium;
  body.dataset.estilo = tema.style || 'premium';
  root.style.setProperty('--wt-radius', est.radius);
  root.style.setProperty('--wt-sombra', est.shadow);
  root.style.setProperty('--wt-borde', est.border);
  // Radio de tarjetas elegido (RADIUS_MAP del viejo)
  root.style.setProperty('--wt-card-radius', RADIUS_MAP[tema.cardRadius || 'rounded'] ?? RADIUS_MAP.rounded);

  // 5 · FUENTE + TAMAÑO
  const font = FONT_MAP[tema.font || 'Inter'] ?? FONT_MAP.Inter;
  root.style.setProperty('--app-font', font);
  root.style.fontFamily = font;
  root.style.fontSize = `${tema.fontSize || 100}%`;

  // 6 · COMPACTO
  body.classList.toggle('wt-compact', Boolean(tema.compact));

  // 7 · VELOCIDAD DE ANIMACIONES (none = kill-switch total)
  root.style.setProperty('--anim-speed', ANIM_MAP[tema.animSpeed || 'normal'] ?? '1');
  const noAnim = document.getElementById('wt-no-anim-style');
  if (tema.animSpeed === 'none') {
    if (!noAnim) {
      const s = document.createElement('style');
      s.id = 'wt-no-anim-style';
      s.innerText = '*, *::before, *::after { transition: none !important; animation: none !important; }';
      document.head.appendChild(s);
    }
  } else if (noAnim) noAnim.remove();

  // 8 · FONDO: el <body> pinta el color de luminosidad + (en
  // 'none') los mismos gradientes radiales sutiles del viejo;
  // con animación, el canvas (FondoCanvas.tsx) pasa por debajo
  // (wt-root se vuelve transparente con la clase wt-tema-activo).
  body.classList.add('wt-tema-activo');
  body.classList.toggle('wt-fondo-anim', (tema.background || 'none') !== 'none');
  body.style.backgroundColor = cfgBr.bg;
  const colorTexto = esLight ? '#0f172a' : '#f1f5f9';
  body.style.color = colorTexto;
  if ((tema.background || 'none') === 'none') {
    // gradientes sutiles del 'none' del viejo (acento 5% + indigo 5%)
    body.style.backgroundImage =
      `radial-gradient(at 0% 0%, ${a}0d 0px, transparent 50%), radial-gradient(at 100% 100%, #6366f10d 0px, transparent 50%)`;
  } else {
    body.style.backgroundImage = 'none';
  }
}

/** Guarda Y aplica (lo que hacía cada set* del viejo + saveState) */
export function setTema(parcial: Partial<TemaWallet>): TemaWallet {
  const tema = { ...leerTema(), ...parcial };
  guardarTema(tema);
  aplicarTema(tema);
  return tema;
}

/** Al arrancar (main.tsx, antes del render → sin flash) */
export function inicializarTema(): TemaWallet {
  const tema = leerTema();
  aplicarTema(tema);
  return tema;
}

/** Resetea al tema por defecto del viejo */
export function resetTema(): TemaWallet {
  guardarTema({ ...TEMA_POR_DEFECTO });
  aplicarTema(TEMA_POR_DEFECTO);
  return { ...TEMA_POR_DEFECTO };
}
