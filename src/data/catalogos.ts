// ═══════════════════════════════════════════════════════════
// 📚 CATÁLOGOS — WalletTrack V2 (F0)
// Copiados 1:1 del HTML original para que las categorías y
// cuentas coincidan con tus datos ya registrados.
// ═══════════════════════════════════════════════════════════

import type { Cuenta, Categoria, EstadoWallet, GastoRapido } from '../types';

export const CUENTAS_CATALOG: Cuenta[] = [
  { id: 'bcp',       name: 'BCP',       icon: '🏦', color: '#f59e0b', tipo: 'banco'     },
  { id: 'interbank', name: 'Interbank', icon: '🏦', color: '#10b981', tipo: 'banco'     },
  { id: 'bbva',      name: 'BBVA',      icon: '🏦', color: '#3b82f6', tipo: 'banco'     },
  { id: 'yape',      name: 'Yape',      icon: '📲', color: '#a855f7', tipo: 'billetera' },
  { id: 'plin',      name: 'Plin',      icon: '📲', color: '#ec4899', tipo: 'billetera' },
  { id: 'efectivo',  name: 'Efectivo',  icon: '💵', color: '#84cc16', tipo: 'efectivo'  },
];

export function cuentaPorId(id?: string): Cuenta | undefined {
  if (!id) return undefined;
  return CUENTAS_CATALOG.find((c) => c.id === id);
}

// ═══════════════════════════════════════════════════════════
// F5 · CUENTAS PROPIAS — las custom (estado.cuentasCustom, id
// 'cc_*') se suman a las 6 de fábrica en TODA la app: strips,
// selects, transferencias, patrimonio y export. Mismo shape
// Cuenta → viajan solas en sync y respaldo JSON.
// ═══════════════════════════════════════════════════════════

/** Catálogo de fábrica + las cuentas propias del usuario */
export function todasLasCuentas(estado: EstadoWallet): Cuenta[] {
  return [...CUENTAS_CATALOG, ...(estado.cuentasCustom ?? [])];
}

/** Nombre bonito de una cuenta (custom incluidas) para descripciones */
export function nombreCuenta(estado: EstadoWallet, id?: string): string {
  const c = todasLasCuentas(estado).find((x) => x.id === (id ?? 'efectivo'));
  return c?.name ?? (id ?? 'efectivo');
}

/** Emojis para crear cuentas y categorías propias (F5) */
export const EMOJIS_NUEVA = [
  '🏦', '📲', '💵', '💳', '🪙', '💼', '🏠', '🍔', '🚚', '⛽', '🚌', '📱',
  '🎮', '🛍️', '💊', '🐶', '🐱', '✂️', '💈', '☕', '🎧', '⚽', '🎸', '📦',
];

/** Colores para cuentas propias (paleta del picker de sobres del viejo) */
export const COLORES_CUENTA = [
  '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ec4899', '#ef4444',
  '#14b8a6', '#f97316', '#8b5cf6', '#84cc16', '#06b6d4', '#64748b',
];

export const CATS_GASTO_DEFAULT: Categoria[] = [
  { id: 'hogar',            emoji: '🏠', nombre: 'Hogar' },
  { id: 'alimentacion',     emoji: '🍔', nombre: 'Alimentación' },
  { id: 'transporte',       emoji: '🚚', nombre: 'Transporte' },
  { id: 'combustible',      emoji: '⛽', nombre: 'Combustible' },
  { id: 'gimnasio',         emoji: '💪', nombre: 'Gimnasio' },
  { id: 'nutricion',        emoji: '🥗', nombre: 'Nutrición' },
  { id: 'salud',            emoji: '💊', nombre: 'Salud' },
  { id: 'tecnologia',       emoji: '📱', nombre: 'Tecnología' },
  { id: 'entretenimiento',  emoji: '🎮', nombre: 'Entretenimiento' },
  { id: 'compras',          emoji: '🛍', nombre: 'Compras' },
  { id: 'ahorro',           emoji: '💰', nombre: 'Ahorro/Inversión' },
  { id: 'moto',             emoji: '🏍', nombre: 'Moto/Combustible' },
  { id: 'mantenimiento',    emoji: '🔧', nombre: 'Mantenimiento Moto' },
  { id: 'aceite',           emoji: '🛢', nombre: 'Cambio de Aceite' },
  { id: 'otros',            emoji: '📦', nombre: 'Otros' },
];

export const CATS_INGRESO_DEFAULT: Categoria[] = [
  { id: 'ridertrack', emoji: '🚚', nombre: 'RiderTrack' },
  { id: 'trabajo',    emoji: '💼', nombre: 'Trabajo Principal' },
  { id: 'ventas',     emoji: '🛍', nombre: 'Ventas' },
  { id: 'freelance',  emoji: '💻', nombre: 'Freelance' },
  { id: 'comisiones', emoji: '📈', nombre: 'Comisiones' },
  { id: 'extra',      emoji: '💵', nombre: 'Ingresos Extra' },
  { id: 'otros_ing',  emoji: '📦', nombre: 'Otros' },
];

/** Gastos rápidos de fábrica (mismos defaults del viejo) */
export const GASTOS_RAPIDOS_DEFAULT: GastoRapido[] = [
  { id: 'gr_gasolina', emoji: '⛽', nombre: 'Gasolina', monto: 20, categoria: 'Combustible',  cuenta: 'efectivo' },
  { id: 'gr_menu',     emoji: '🍔', nombre: 'Menú',     monto: 12, categoria: 'Alimentación', cuenta: 'efectivo' },
];
