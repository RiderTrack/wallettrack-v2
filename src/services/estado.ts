// ═══════════════════════════════════════════════════════════
// 🗄️ ESTADO — WalletTrack V2 (F0)
// Capa de datos: usa EXACTAMENTE las mismas 19 claves
// wallettrack_* del HTML original, con las mismas formas.
// El respaldo JSON es el MISMO formato v3.0 → un backup del
// viejo WalletTrack importa sin conversión (y viceversa).
// ═══════════════════════════════════════════════════════════

import type { EstadoWallet, GastoRapido, RespaldoWallet, Transaccion } from '../types';
import { CUENTAS_CATALOG, GASTOS_RAPIDOS_DEFAULT } from '../data/catalogos';
import { hoyISO, mesActualISO, esDelMes } from './dinero';

// ── Claves del viejo (NO cambiar: compatibilidad de datos) ────
const K = {
  transactions:  'wallettrack_transactions',
  goals:         'wallettrack_goals',
  subscriptions: 'wallettrack_subscriptions',
  challenges:    'wallettrack_challenges',
  theme:         'wallettrack_theme',
  saldos:        'wallettrack_saldos',
  budgets:       'wallettrack_budgets',
  catGasto:      'wallettrack_cat_gasto',
  catIngreso:    'wallettrack_cat_ingreso',
  cards:         'wallettrack_cards',
  sobres:        'wallettrack_sobres',
  sobreMovs:     'wallettrack_sobre_movs',
  deudas:        'wallettrack_deudas',
  deudaMovs:     'wallettrack_deuda_movs',
  productos:     'wallettrack_productos',
  listaCompras:  'wallettrack_lista_compras',
  comprasHist:   'wallettrack_compras_hist',
  gastosRapidos: 'wallettrack_gastos_rapidos',
  security:      'wallettrack_security',
} as const;

/** F1: expuestas para el sync en la nube (wallettrack_sync) */
export const CLAVES = K;

// ── Oyentes de persistencia (F1: el sync debouncea con esto) ──
const _oyentes: ((estado: EstadoWallet) => void)[] = [];

/** Se dispara en CADA persistir() — el sync programa su subida */
export function alPersistir(cb: ((estado: EstadoWallet) => void) | null): void {
  if (cb === null) {
    _oyentes.length = 0;
    return;
  }
  if (!_oyentes.includes(cb)) _oyentes.push(cb);
}

function notificarOyentes(estado: EstadoWallet) {
  _oyentes.forEach((cb) => { try { cb(estado); } catch { /* oyente roto */ } });
}

// ── Helpers de lectura/escritura seguros ──────────────────────
function leerJSON<T>(clave: string, fallback: T): T {
  try {
    const crudo = localStorage.getItem(clave);
    if (crudo === null) return fallback;
    const parsed = JSON.parse(crudo);
    return (parsed === null || parsed === undefined) ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

function guardarJSON(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch { /* storage lleno o no disponible */ }
}

// ── Lectura completa del estado ───────────────────────────────
export function leerEstado(): EstadoWallet {
  const gastosRapidosCrudos = leerJSON<GastoRapido[] | null>(K.gastosRapidos, null);
  return {
    transactions:   leerJSON<Transaccion[]>(K.transactions, []),
    goals:          leerJSON<EstadoWallet['goals']>(K.goals, []),
    subscriptions:  leerJSON<EstadoWallet['subscriptions']>(K.subscriptions, []),
    challenges:     leerJSON<EstadoWallet['challenges']>(K.challenges, []),
    saldosIniciales: leerJSON<Record<string, number>>(K.saldos, {}),
    cardCustom:     leerJSON<Record<string, unknown>>(K.cards, {}),
    budgets:        leerJSON<EstadoWallet['budgets']>(K.budgets, []),
    categoriasGasto:  leerJSON<EstadoWallet['categoriasGasto']>(K.catGasto, []),
    categoriasIngreso: leerJSON<EstadoWallet['categoriasIngreso']>(K.catIngreso, []),
    sobres:         leerJSON<EstadoWallet['sobres']>(K.sobres, []),
    sobreMovs:      leerJSON<EstadoWallet['sobreMovs']>(K.sobreMovs, []),
    deudas:         leerJSON<EstadoWallet['deudas']>(K.deudas, []),
    deudaMovs:      leerJSON<EstadoWallet['deudaMovs']>(K.deudaMovs, []),
    productos:      leerJSON<EstadoWallet['productos']>(K.productos, []),
    listaCompras:   leerJSON<EstadoWallet['listaCompras']>(K.listaCompras, { items: [], creada: null }),
    comprasHist:    leerJSON<EstadoWallet['comprasHist']>(K.comprasHist, []),
    gastosRapidos:  gastosRapidosCrudos ?? [...GASTOS_RAPIDOS_DEFAULT],
  };
}

// ── Persistencia (graba las claves del bloque que cambia) ─────
export function persistir(estado: EstadoWallet): void {
  guardarJSON(K.transactions,  estado.transactions);
  guardarJSON(K.goals,         estado.goals);
  guardarJSON(K.subscriptions, estado.subscriptions);
  guardarJSON(K.challenges,    estado.challenges);
  guardarJSON(K.saldos,        estado.saldosIniciales);
  guardarJSON(K.cards,         estado.cardCustom);
  guardarJSON(K.budgets,       estado.budgets);
  guardarJSON(K.catGasto,      estado.categoriasGasto);
  guardarJSON(K.catIngreso,    estado.categoriasIngreso);
  guardarJSON(K.sobres,        estado.sobres);
  guardarJSON(K.sobreMovs,     estado.sobreMovs);
  guardarJSON(K.deudas,        estado.deudas);
  guardarJSON(K.deudaMovs,     estado.deudaMovs);
  guardarJSON(K.productos,     estado.productos);
  guardarJSON(K.listaCompras,  estado.listaCompras);
  guardarJSON(K.comprasHist,   estado.comprasHist);
  guardarJSON(K.gastosRapidos, estado.gastosRapidos);
  notificarOyentes(estado); // F1: avisa al sync (debounce 8 s)
}

/**
 * F1 · Sync: graba las 18 claves SIN avisar a los oyentes
 * (aplicar datos de la nube no debe re-disparar la subida).
 */
export function persistirSilencioso(estado: EstadoWallet): void {
  guardarJSON(K.transactions,  estado.transactions);
  guardarJSON(K.goals,         estado.goals);
  guardarJSON(K.subscriptions, estado.subscriptions);
  guardarJSON(K.challenges,    estado.challenges);
  guardarJSON(K.saldos,        estado.saldosIniciales);
  guardarJSON(K.cards,         estado.cardCustom);
  guardarJSON(K.budgets,       estado.budgets);
  guardarJSON(K.catGasto,      estado.categoriasGasto);
  guardarJSON(K.catIngreso,    estado.categoriasIngreso);
  guardarJSON(K.sobres,        estado.sobres);
  guardarJSON(K.sobreMovs,     estado.sobreMovs);
  guardarJSON(K.deudas,        estado.deudas);
  guardarJSON(K.deudaMovs,     estado.deudaMovs);
  guardarJSON(K.productos,     estado.productos);
  guardarJSON(K.listaCompras,  estado.listaCompras);
  guardarJSON(K.comprasHist,   estado.comprasHist);
  guardarJSON(K.gastosRapidos, estado.gastosRapidos);
}

// ── Transacciones ─────────────────────────────────────────────
export interface DatosTransaccion {
  type: 'income' | 'expense';
  monto: number;
  categoria: string;
  cuenta: string;
  fecha: string;
  descripcion: string;
}

/**
 * Id tipo string (como el viejo: Date.now()) pero ANTI-COLISIÓN:
 * si dos transacciones se crean en el mismo milisegundo, el id
 * lleva un sufijo -1, -2… El viejo nunca parsea los ids, así que
 * el formato extendido es 100% compatible.
 */
function idUnico(existentes: { id: string }[]): string {
  const base = `${Date.now()}`;
  if (!existentes.some((t) => t.id === base)) return base;
  let n = 1;
  while (existentes.some((t) => t.id === `${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function agregarTransaccion(estado: EstadoWallet, datos: DatosTransaccion): EstadoWallet {
  const nueva: Transaccion = {
    id: idUnico(estado.transactions),
    date: datos.fecha || hoyISO(),
    type: datos.type,
    category: datos.categoria,
    amount: datos.monto,
    description: datos.descripcion || `${datos.categoria} General`,
    account: datos.cuenta || 'efectivo',
  };
  return { ...estado, transactions: [nueva, ...estado.transactions] };
}

export function eliminarTransaccion(estado: EstadoWallet, id: string): EstadoWallet {
  return { ...estado, transactions: estado.transactions.filter((t) => t.id !== id) };
}

/** Gasto de 1 toque (los ⚡ del dashboard) */
export function registrarGastoRapido(estado: EstadoWallet, gr: GastoRapido): EstadoWallet {
  return agregarTransaccion(estado, {
    type: 'expense',
    monto: gr.monto,
    categoria: gr.categoria,
    cuenta: gr.cuenta,
    fecha: hoyISO(),
    descripcion: gr.nombre,
  });
}

export function guardarGastosRapidos(estado: EstadoWallet, lista: GastoRapido[]): EstadoWallet {
  return { ...estado, gastosRapidos: lista };
}

// ── Transferencias (doble asiento, como el viejo) ─────────────
export function hacerTransferencia(
  estado: EstadoWallet,
  from: string,
  to: string,
  monto: number,
): { estado: EstadoWallet; ok: boolean; error?: string } {
  if (!from || !to) return { estado, ok: false, error: 'Elige las dos cuentas' };
  if (from === to)  return { estado, ok: false, error: 'Las cuentas deben ser distintas' };
  if (!(monto > 0)) return { estado, ok: false, error: 'Monto inválido' };
  const fromNombre = CUENTAS_CATALOG.find((c) => c.id === from)?.name ?? from;
  const toNombre = CUENTAS_CATALOG.find((c) => c.id === to)?.name ?? to;
  const hoy = hoyISO();
  // Ids anti-colisión: el segundo se valida contra la lista + el primero
  const idSalida = idUnico(estado.transactions);
  const idEntrada = idUnico([{ id: idSalida }, ...estado.transactions]);
  const par: Transaccion[] = [
    { id: idSalida,  date: hoy, type: 'expense', category: 'Transferencia', amount: monto, description: `Transferencia → ${toNombre}`,   account: from },
    { id: idEntrada, date: hoy, type: 'income',  category: 'Transferencia', amount: monto, description: `Transferencia ← ${fromNombre}`, account: to },
  ];
  return { estado: { ...estado, transactions: [...par, ...estado.transactions] }, ok: true };
}

// ── Saldos ────────────────────────────────────────────────────
export function saldoCuenta(estado: EstadoWallet, accountId: string): number {
  const inicial = Number(estado.saldosIniciales[accountId] ?? 0) || 0;
  let movimiento = 0;
  for (const t of estado.transactions) {
    if (t.account !== accountId) continue;
    if (t.category === '__fondo_empresa__') continue; // excluye fondo empresa (regla del viejo)
    const monto = Number(t.amount) || 0;
    movimiento += t.type === 'income' ? monto : -monto;
  }
  return inicial + movimiento;
}

export function saldoTotal(estado: EstadoWallet): number {
  return CUENTAS_CATALOG.reduce((acc, c) => acc + saldoCuenta(estado, c.id), 0);
}

export function movimientosDeCuenta(estado: EstadoWallet, accountId: string): Transaccion[] {
  return estado.transactions.filter((t) => t.account === accountId);
}

// ── Resumen del mes ───────────────────────────────────────────
export function resumenMes(estado: EstadoWallet, mesISO = mesActualISO()): { ingresos: number; gastos: number } {
  let ingresos = 0;
  let gastos = 0;
  for (const t of estado.transactions) {
    if (!esDelMes(t.date, mesISO)) continue;
    const monto = Number(t.amount) || 0;
    if (t.type === 'income') ingresos += monto;
    else gastos += monto;
  }
  return { ingresos, gastos };
}

// ── Respaldo JSON (formato v3.0 del viejo) ────────────────────
export function exportarRespaldo(estado: EstadoWallet): string {
  const respaldo: RespaldoWallet = {
    version: '3.0',
    fecha: new Date().toISOString(),
    transactions: estado.transactions,
    goals: estado.goals,
    subscriptions: estado.subscriptions,
    challenges: estado.challenges,
    saldosIniciales: estado.saldosIniciales,
    cardCustom: estado.cardCustom,
    budgets: estado.budgets,
    categoriasGasto: estado.categoriasGasto,
    categoriasIngreso: estado.categoriasIngreso,
    sobres: estado.sobres,
    sobreMovs: estado.sobreMovs,
    deudas: estado.deudas,
    deudaMovs: estado.deudaMovs,
    productos: estado.productos,
    listaCompras: estado.listaCompras,
    comprasHist: estado.comprasHist,
    gastosRapidos: estado.gastosRapidos,
  };
  return JSON.stringify(respaldo, null, 2);
}

/** Importa un respaldo del viejo o de la V2. Requiere data.transactions. */
export function importarRespaldo(estado: EstadoWallet, textoJSON: string): { estado: EstadoWallet; ok: boolean; error?: string } {
  try {
    const data = JSON.parse(textoJSON) as RespaldoWallet;
    if (!data || !Array.isArray(data.transactions)) {
      return { estado, ok: false, error: 'No parece un respaldo de WalletTrack' };
    }
    const nuevo: EstadoWallet = { ...estado };
    if (data.transactions)      nuevo.transactions = data.transactions;
    if (data.goals)             nuevo.goals = data.goals;
    if (data.subscriptions)     nuevo.subscriptions = data.subscriptions;
    if (data.challenges)        nuevo.challenges = data.challenges;
    if (data.saldosIniciales)   nuevo.saldosIniciales = data.saldosIniciales;
    if (data.cardCustom)        nuevo.cardCustom = data.cardCustom;
    if (data.budgets)           nuevo.budgets = data.budgets;
    if (data.categoriasGasto)   nuevo.categoriasGasto = data.categoriasGasto;
    if (data.categoriasIngreso) nuevo.categoriasIngreso = data.categoriasIngreso;
    if (data.sobres)            nuevo.sobres = data.sobres;
    if (data.sobreMovs)         nuevo.sobreMovs = data.sobreMovs;
    if (data.deudas)            nuevo.deudas = data.deudas;
    if (data.deudaMovs)         nuevo.deudaMovs = data.deudaMovs;
    if (data.productos)         nuevo.productos = data.productos;
    if (data.listaCompras)      nuevo.listaCompras = data.listaCompras;
    if (data.comprasHist)       nuevo.comprasHist = data.comprasHist;
    if (data.gastosRapidos)     nuevo.gastosRapidos = data.gastosRapidos;
    return { estado: nuevo, ok: true };
  } catch {
    return { estado, ok: false, error: 'Archivo JSON inválido' };
  }
}

// ── Saldos iniciales y reset ──────────────────────────────────
export function guardarSaldosIniciales(estado: EstadoWallet, saldos: Record<string, number>): EstadoWallet {
  const limpios: Record<string, number> = {};
  for (const [id, valor] of Object.entries(saldos)) {
    limpios[id] = Number.isFinite(valor) ? valor : 0;
  }
  return { ...estado, saldosIniciales: limpios };
}

/** Reinicia TODO a cero (mismas claves que tocaba el viejo) */
export function resetTotal(): EstadoWallet {
  const vacio: EstadoWallet = {
    transactions: [],
    goals: [],
    subscriptions: [],
    challenges: [],
    saldosIniciales: {},
    cardCustom: {},
    budgets: [],
    categoriasGasto: [],
    categoriasIngreso: [],
    sobres: [],
    sobreMovs: [],
    deudas: [],
    deudaMovs: [],
    productos: [],
    listaCompras: { items: [], creada: null },
    comprasHist: [],
    gastosRapidos: [...GASTOS_RAPIDOS_DEFAULT],
  };
  try {
    Object.values(K).forEach((clave) => {
      if (clave !== K.theme && clave !== K.security) localStorage.removeItem(clave);
    });
  } catch { /* sin storage */ }
  notificarOyentes(vacio); // F1: el reset también marca el reloj del sync
  return vacio;
}

// ── Filtro de historial ───────────────────────────────────────
export interface FiltroHistorial {
  texto: string;
  tipo: 'all' | 'income' | 'expense';
  categoria: string; // 'all' o nombre exacto
}

export function filtrarTransacciones(estado: EstadoWallet, filtro: FiltroHistorial): Transaccion[] {
  const texto = filtro.texto.trim().toLowerCase();
  return estado.transactions.filter((t) => {
    if (filtro.tipo !== 'all' && t.type !== filtro.tipo) return false;
    if (filtro.categoria !== 'all' && t.category !== filtro.categoria) return false;
    if (texto) {
      const enDesc = (t.description ?? '').toLowerCase().includes(texto);
      const enCat = (t.category ?? '').toLowerCase().includes(texto);
      if (!enDesc && !enCat) return false;
    }
    return true;
  });
}
