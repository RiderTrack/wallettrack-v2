// ═══════════════════════════════════════════════════════════
// 🗄️ ESTADO — WalletTrack V2 (F0)
// Capa de datos: usa EXACTAMENTE las mismas 19 claves
// wallettrack_* del HTML original, con las mismas formas.
// El respaldo JSON es el MISMO formato v3.0 → un backup del
// viejo WalletTrack importa sin conversión (y viceversa).
// ═══════════════════════════════════════════════════════════

import type {
  Categoria, CompraHistorial, Cuenta, Deuda, DeudaMov, EstadoWallet, GastoRapido, ItemCompra, Meta,
  Presupuesto, ProductoBiblioteca, Recurrente, RespaldoWallet, Reto, Sobre, SobreMov,
  Suscripcion, Transaccion,
} from '../types';
import { CUENTAS_CATALOG, CATS_GASTO_DEFAULT, CATS_INGRESO_DEFAULT, GASTOS_RAPIDOS_DEFAULT, todasLasCuentas, nombreCuenta } from '../data/catalogos';
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
  // F5 · claves nuevas (no existen en el viejo — no chocan)
  cuentasCustom: 'wallettrack_cuentas_custom',
  recurrentes:   'wallettrack_recurrentes',
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
    cuentasCustom:  leerJSON<EstadoWallet['cuentasCustom']>(K.cuentasCustom, []),
    recurrentes:    leerJSON<EstadoWallet['recurrentes']>(K.recurrentes, []),
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
  guardarJSON(K.cuentasCustom, estado.cuentasCustom);
  guardarJSON(K.recurrentes,   estado.recurrentes);
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
  guardarJSON(K.cuentasCustom, estado.cuentasCustom);
  guardarJSON(K.recurrentes,   estado.recurrentes);
}

// ── Transacciones ─────────────────────────────────
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

/**
 * Id con prefijo (sobre_/deuda_) y ANTI-COLISIÓN: compara contra
 * los ids CON prefijo reales de la lista (idUnico pelado no
 * detectaría colisiones contra ids prefijados del mismo ms).
 */
function idConPrefijo(prefijo: string, existentes: { id: string }[]): string {
  const base = `${prefijo}_${Date.now()}`;
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
  const fromNombre = nombreCuenta(estado, from);
  const toNombre = nombreCuenta(estado, to);
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

// ═══════════════════════════════════════════════════════════
// ✉️ F2 · SOBRES — método de sobres del viejo, formas exactas
// (wallettrack_sobres + wallettrack_sobre_movs)
// ═══════════════════════════════════════════════════════════

export interface DatosSobre {
  nombre: string;
  emoji: string;
  monto: number;
  color: string;
  /** 'balance' descuenta del saldo (gasto especial) · 'manual' solo suma al sobre */
  origen: 'balance' | 'manual';
}

export function movimientosDeSobre(estado: EstadoWallet, sobreId: string): SobreMov[] {
  return estado.sobreMovs.filter((m) => m.sobreId === sobreId);
}

export function sobreGastado(estado: EstadoWallet, sobreId: string): number {
  return estado.sobreMovs
    .filter((m) => m.sobreId === sobreId && m.tipo === 'gasto')
    .reduce((acc, m) => acc + (Number(m.monto) || 0), 0);
}

function sobreRecargas(estado: EstadoWallet, sobreId: string): number {
  return estado.sobreMovs
    .filter((m) => m.sobreId === sobreId && m.tipo === 'recarga')
    .reduce((acc, m) => acc + (Number(m.monto) || 0), 0);
}

/** montoInicial + recargas (todo lo que pasó por el sobre) */
export function sobreTotalCargado(estado: EstadoWallet, sobreId: string): number {
  const sobre = estado.sobres.find((s) => s.id === sobreId);
  if (!sobre) return 0;
  return (Number(sobre.montoInicial) || 0) + sobreRecargas(estado, sobreId);
}

/** Lo que queda disponible para gastar */
export function sobreDisponible(estado: EstadoWallet, sobreId: string): number {
  const sobre = estado.sobres.find((s) => s.id === sobreId);
  if (!sobre) return 0;
  return (Number(sobre.montoInicial) || 0) + sobreRecargas(estado, sobreId) - sobreGastado(estado, sobreId);
}

/** Transacción especial del viejo: aparta dinero del balance a un sobre */
function transaccionSobre(nombre: string, monto: number, esRecarga: boolean): Transaccion {
  return {
    id: '', // el llamador asigna el id único
    date: hoyISO(),
    type: 'expense',
    category: `✉️ Sobre: ${nombre}`,
    amount: monto,
    description: esRecarga ? `✉️ Recarga al sobre "${nombre}"` : `✉️ Apartado al sobre "${nombre}"`,
    account: 'efectivo',
    esSobre: true,
  };
}

export function crearSobre(estado: EstadoWallet, datos: DatosSobre): { estado: EstadoWallet; ok: boolean; error?: string } {
  if (!datos.nombre.trim()) return { estado, ok: false, error: 'Ingresa un nombre para el sobre' };
  if (!(datos.monto > 0)) return { estado, ok: false, error: 'Ingresa un monto válido' };
  let nuevo: EstadoWallet = estado;
  if (datos.origen === 'balance') {
    if (datos.monto > saldoTotal(estado) + 0.01) {
      return { estado, ok: false, error: `Saldo insuficiente. Tienes S/ ${saldoTotal(estado).toFixed(2)}` };
    }
    const t = transaccionSobre(datos.nombre, datos.monto, false);
    t.id = idUnico(nuevo.transactions);
    nuevo = { ...nuevo, transactions: [t, ...nuevo.transactions] };
  }
  const sobre: Sobre = {
    id: idConPrefijo('sobre', nuevo.sobres),
    nombre: datos.nombre.trim(),
    emoji: datos.emoji || '✉️',
    montoInicial: datos.monto,
    color: datos.color || '#f59e0b',
    fechaCreacion: hoyISO(),
  };
  return { estado: { ...nuevo, sobres: [...nuevo.sobres, sobre] }, ok: true };
}

export function recargarSobre(
  estado: EstadoWallet, sobreId: string, monto: number, origen: 'balance' | 'manual',
): { estado: EstadoWallet; ok: boolean; error?: string } {
  const sobre = estado.sobres.find((s) => s.id === sobreId);
  if (!sobre) return { estado, ok: false, error: 'Sobre no encontrado' };
  if (!(monto > 0)) return { estado, ok: false, error: 'Ingresa un monto' };
  let nuevo: EstadoWallet = estado;
  if (origen === 'balance') {
    if (monto > saldoTotal(estado) + 0.01) {
      return { estado, ok: false, error: `Saldo insuficiente. Tienes S/ ${saldoTotal(estado).toFixed(2)}` };
    }
    const t = transaccionSobre(sobre.nombre, monto, true);
    t.id = idUnico(nuevo.transactions);
    nuevo = { ...nuevo, transactions: [t, ...nuevo.transactions] };
  }
  const mov: SobreMov = {
    id: idUnico(nuevo.sobreMovs),
    sobreId,
    tipo: 'recarga',
    monto,
    desc: origen === 'balance' ? 'Recarga desde saldo' : 'Recarga manual',
    fecha: hoyISO(),
  };
  return { estado: { ...nuevo, sobreMovs: [mov, ...nuevo.sobreMovs] }, ok: true };
}

export function gastarDesdeSobre(
  estado: EstadoWallet, sobreId: string, monto: number, desc: string,
): { estado: EstadoWallet; ok: boolean; error?: string } {
  const sobre = estado.sobres.find((s) => s.id === sobreId);
  if (!sobre) return { estado, ok: false, error: 'Sobre no encontrado' };
  if (!(monto > 0)) return { estado, ok: false, error: 'Ingresa un monto' };
  const disponible = sobreDisponible(estado, sobreId);
  if (monto > disponible + 0.01) {
    return { estado, ok: false, error: `El sobre solo tiene S/ ${disponible.toFixed(2)}` };
  }
  const mov: SobreMov = {
    id: idUnico(estado.sobreMovs),
    sobreId,
    tipo: 'gasto',
    monto,
    desc: desc.trim() || 'Gasto del sobre',
    fecha: hoyISO(),
  };
  return { estado: { ...estado, sobreMovs: [mov, ...estado.sobreMovs] }, ok: true };
}

export function eliminarSobre(estado: EstadoWallet, sobreId: string): EstadoWallet {
  return {
    ...estado,
    sobres: estado.sobres.filter((s) => s.id !== sobreId),
    sobreMovs: estado.sobreMovs.filter((m) => m.sobreId !== sobreId),
  };
}

// ═══════════════════════════════════════════════════════════
// 💳 F2 · DEUDAS — cuotas + apartados, formas exactas del viejo
// (wallettrack_deudas + wallettrack_deuda_movs)
// ═══════════════════════════════════════════════════════════

export interface DatosDeuda {
  nombre: string;
  montoTotal: number;
  totalCuotas: number;
  montoCuota: number;   // ≤ 0 → total / cuotas (como el viejo)
  cuotasPagadas: number;
  proximaFecha: string;
  cuenta: string;
}

export function movimientosDeDeuda(estado: EstadoWallet, deudaId: string): DeudaMov[] {
  return estado.deudaMovs.filter((m) => m.deudaId === deudaId);
}

/** Aportes juntados para la cuota ACTUAL (se resetea al pagar cada cuota) */
export function juntadoActual(estado: EstadoWallet, deudaId: string): number {
  const d = estado.deudas.find((x) => x.id === deudaId);
  if (!d) return 0;
  return estado.deudaMovs
    .filter((m) => m.deudaId === deudaId && m.tipo === 'aportar' && m.cuotaNum === d.cuotaActual)
    .reduce((a, m) => a + (Number(m.monto) || 0), 0);
}

/** (totalCuotas − cuotasPagadas) × montoCuota */
export function montoPendienteDeuda(estado: EstadoWallet, deudaId: string): number {
  const d = estado.deudas.find((x) => x.id === deudaId);
  if (!d) return 0;
  return (d.totalCuotas - d.cuotasPagadas) * (Number(d.montoCuota) || 0);
}

export function crearDeuda(estado: EstadoWallet, datos: DatosDeuda): { estado: EstadoWallet; ok: boolean; error?: string } {
  if (!datos.nombre.trim()) return { estado, ok: false, error: 'Ingresa el nombre de la deuda' };
  if (!(datos.montoTotal > 0)) return { estado, ok: false, error: 'Ingresa el monto total' };
  if (!(datos.totalCuotas > 0)) return { estado, ok: false, error: 'Ingresa el número de cuotas' };
  if (!datos.proximaFecha) return { estado, ok: false, error: 'Ingresa la fecha de la próxima cuota' };
  const montoCuota = !(datos.montoCuota > 0) ? datos.montoTotal / datos.totalCuotas : datos.montoCuota;
  const deuda: Deuda = {
    id: idConPrefijo('deuda', estado.deudas),
    nombre: datos.nombre.trim(),
    montoTotal: datos.montoTotal,
    totalCuotas: Math.round(datos.totalCuotas),
    montoCuota,
    semanalSugerido: montoCuota / 4,
    cuotasPagadas: Math.max(0, Math.round(datos.cuotasPagadas || 0)),
    cuotaActual: Math.max(0, Math.round(datos.cuotasPagadas || 0)) + 1,
    proximaFecha: datos.proximaFecha,
    cuenta: datos.cuenta || 'efectivo',
    fechaCreacion: hoyISO(),
  };
  return { estado: { ...estado, deudas: [...estado.deudas, deuda] }, ok: true };
}

/** Apartar SIN tocar el balance: solo junta dinero para la cuota (como el viejo) */
export function apartarParaDeuda(
  estado: EstadoWallet, deudaId: string, monto: number,
): { estado: EstadoWallet; ok: boolean; error?: string } {
  const d = estado.deudas.find((x) => x.id === deudaId);
  if (!d) return { estado, ok: false, error: 'Deuda no encontrada' };
  if (!(monto > 0)) return { estado, ok: false, error: 'Ingresa un monto' };
  const mov: DeudaMov = {
    id: idUnico(estado.deudaMovs),
    deudaId,
    tipo: 'aportar',
    cuotaNum: d.cuotaActual,
    monto,
    fecha: hoyISO(),
    desc: `🪙 Aporte semanal cuota ${d.cuotaActual}`,
  };
  return { estado: { ...estado, deudaMovs: [mov, ...estado.deudaMovs] }, ok: true };
}

/** Próximo mes, mismo día (regla del viejo) */
function mesSiguiente(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Paga la cuota: gasto REAL de la cuenta + avanza cuotas (como el viejo) */
export function pagarCuotaDeuda(
  estado: EstadoWallet, deudaId: string, monto: number,
): { estado: EstadoWallet; ok: boolean; error?: string; terminada?: boolean } {
  const d = estado.deudas.find((x) => x.id === deudaId);
  if (!d) return { estado, ok: false, error: 'Deuda no encontrada' };
  if (!(monto > 0)) return { estado, ok: false, error: 'Ingresa el monto' };
  if (d.cuotasPagadas >= d.totalCuotas) return { estado, ok: false, error: '¡Deuda completamente pagada!' };
  const hoy = hoyISO();
  const t: Transaccion = {
    id: idUnico(estado.transactions),
    date: hoy,
    type: 'expense',
    category: '💳 Cuota deuda',
    amount: monto,
    description: `💳 Cuota ${d.cuotaActual}/${d.totalCuotas} — ${d.nombre}`,
    account: d.cuenta,
  };
  const mov: DeudaMov = {
    id: idUnico([{ id: t.id }, ...estado.deudaMovs]),
    deudaId,
    tipo: 'pagar',
    cuotaNum: d.cuotaActual,
    monto,
    fecha: hoy,
    desc: `💳 Cuota ${d.cuotaActual} pagada`,
  };
  const avanzada: Deuda = {
    ...d,
    cuotasPagadas: d.cuotasPagadas + 1,
    cuotaActual: d.cuotaActual + 1,
    proximaFecha: mesSiguiente(d.proximaFecha),
  };
  return {
    estado: {
      ...estado,
      transactions: [t, ...estado.transactions],
      deudaMovs: [mov, ...estado.deudaMovs],
      deudas: estado.deudas.map((x) => (x.id === deudaId ? avanzada : x)),
    },
    ok: true,
    terminada: avanzada.cuotasPagadas >= avanzada.totalCuotas,
  };
}

export function eliminarDeuda(estado: EstadoWallet, deudaId: string): EstadoWallet {
  return {
    ...estado,
    deudas: estado.deudas.filter((x) => x.id !== deudaId),
    deudaMovs: estado.deudaMovs.filter((m) => m.deudaId !== deudaId),
  };
}

// ═══════════════════════════════════════════════════════════
// 🐷 F2 · PRESUPUESTOS — límite por categoría del mes actual
// (wallettrack_budgets)
// ═══════════════════════════════════════════════════════════

export interface DatosPresupuesto {
  categoria: string;
  limit: number;
  color: string;
}

/** Gastos del mes por categoría (expense + mes en curso) */
export function gastosDelMesPorCategoria(
  estado: EstadoWallet, mesISO = mesActualISO(),
): Record<string, number> {
  const gastos: Record<string, number> = {};
  for (const t of estado.transactions) {
    if (t.type !== 'expense') continue;
    if (!esDelMes(t.date, mesISO)) continue;
    gastos[t.category] = (gastos[t.category] || 0) + (Number(t.amount) || 0);
  }
  return gastos;
}

/** Emoji de la categoría (defaults + personalizadas, fallback 📦) */
function iconoCategoria(estado: EstadoWallet, nombre: string): string {
  const cat = [...CATS_GASTO_DEFAULT, ...estado.categoriasGasto].find((c) => c.nombre === nombre);
  return cat?.emoji ?? '📦';
}

/** Upsert: si la categoría ya tiene presupuesto, actualiza límite/color (como el viejo) */
export function guardarPresupuesto(
  estado: EstadoWallet, datos: DatosPresupuesto,
): { estado: EstadoWallet; ok: boolean; error?: string } {
  if (!datos.categoria) return { estado, ok: false, error: 'Elige una categoría' };
  if (!(datos.limit > 0)) return { estado, ok: false, error: 'Ingresa un límite válido' };
  const existing = estado.budgets.find((b) => b.category === datos.categoria);
  if (existing) {
    return {
      estado: {
        ...estado,
        budgets: estado.budgets.map((b) =>
          b.category === datos.categoria ? { ...b, limit: datos.limit, color: datos.color } : b),
      },
      ok: true,
    };
  }
  const nuevo: Presupuesto = {
    id: idUnico(estado.budgets),
    category: datos.categoria,
    icon: iconoCategoria(estado, datos.categoria),
    limit: datos.limit,
    color: datos.color || '#10b981',
  };
  return { estado: { ...estado, budgets: [...estado.budgets, nuevo] }, ok: true };
}

export function eliminarPresupuesto(estado: EstadoWallet, id: string): EstadoWallet {
  return { ...estado, budgets: estado.budgets.filter((b) => b.id !== id) };
}

// ═══════════════════════════════════════════════════════════
// 🎯 F2 · METAS — objetivos con aportes (wallettrack_goals)
// ═══════════════════════════════════════════════════════════

export interface DatosMeta {
  name: string;
  target: number;
  current: number;
  date: string;
}

export function crearMeta(estado: EstadoWallet, datos: DatosMeta): { estado: EstadoWallet; ok: boolean; error?: string } {
  if (!datos.name.trim()) return { estado, ok: false, error: 'Ingresa el nombre de la meta' };
  if (!(datos.target > 0)) return { estado, ok: false, error: 'Ingresa un objetivo válido' };
  const meta: Meta = {
    id: idUnico(estado.goals),
    name: datos.name.trim(),
    target: datos.target,
    current: Math.max(0, Number(datos.current) || 0),
    date: datos.date || '',
  };
  return { estado: { ...estado, goals: [...estado.goals, meta] }, ok: true };
}

/** Abona a la meta + registra el gasto 'Ahorro' SIN cuenta (forma exacta del viejo) */
export function abonarMeta(
  estado: EstadoWallet, id: string, extra: number,
): { estado: EstadoWallet; ok: boolean; error?: string } {
  const meta = estado.goals.find((g) => g.id === id);
  if (!meta) return { estado, ok: false, error: 'Meta no encontrada' };
  if (!(extra > 0)) return { estado, ok: false, error: 'Ingresa un monto' };
  const t: Transaccion = {
    id: idUnico(estado.transactions),
    date: hoyISO(),
    type: 'expense',
    category: 'Ahorro',
    amount: extra,
    description: `Aporte a: ${meta.name}`,
    // sin account — exactamente como el viejo (no descuenta de ninguna cuenta)
  };
  return {
    estado: {
      ...estado,
      goals: estado.goals.map((g) =>
        g.id === id ? { ...g, current: Math.min(g.target, g.current + extra) } : g),
      transactions: [t, ...estado.transactions],
    },
    ok: true,
  };
}

export function eliminarMeta(estado: EstadoWallet, id: string): EstadoWallet {
  return { ...estado, goals: estado.goals.filter((g) => g.id !== id) };
}

// ═══════════════════════════════════════════════════════════
// 🔄 F3 · SUSCRIPCIONES — gastos fijos con cuenta + emoji,
// formas exactas del viejo (wallettrack_subscriptions)
// ═══════════════════════════════════════════════════════════

export interface DatosSuscripcion {
  name: string;
  cost: number;
  due: string;
  emoji: string;
  cuenta: string;
}

export function crearSuscripcion(
  estado: EstadoWallet, datos: DatosSuscripcion,
): { estado: EstadoWallet; ok: boolean; error?: string } {
  if (!datos.name.trim()) return { estado, ok: false, error: 'Ingresa el nombre del gasto fijo' };
  if (!(datos.cost > 0)) return { estado, ok: false, error: 'Ingresa un monto válido' };
  if (!datos.due) return { estado, ok: false, error: 'Ingresa la fecha de vencimiento' };
  const sub: Suscripcion = {
    id: idUnico(estado.subscriptions),          // Date.now() estilo del viejo
    name: datos.name.trim(),
    cost: datos.cost,
    due: datos.due,
    emoji: datos.emoji || '🔄',
    cuenta: datos.cuenta || 'efectivo',
  };
  return { estado: { ...estado, subscriptions: [...estado.subscriptions, sub] }, ok: true };
}

export function editarSuscripcion(
  estado: EstadoWallet, id: string, datos: DatosSuscripcion,
): { estado: EstadoWallet; ok: boolean; error?: string } {
  if (!estado.subscriptions.some((s) => s.id === id)) return { estado, ok: false, error: 'Suscripción no encontrada' };
  if (!datos.name.trim()) return { estado, ok: false, error: 'El nombre no puede quedar vacío' };
  if (!(datos.cost > 0)) return { estado, ok: false, error: 'Ingresa un monto válido' };
  if (!datos.due) return { estado, ok: false, error: 'Ingresa la fecha de vencimiento' };
  return {
    estado: {
      ...estado,
      subscriptions: estado.subscriptions.map((s) => s.id === id ? {
        ...s, name: datos.name.trim(), cost: datos.cost, due: datos.due,
        emoji: datos.emoji || '🔄', cuenta: datos.cuenta || 'efectivo',
      } : s),
    },
    ok: true,
  };
}

export function eliminarSuscripcion(estado: EstadoWallet, id: string): EstadoWallet {
  return { ...estado, subscriptions: estado.subscriptions.filter((s) => s.id !== id) };
}

/** Paga el fijo: gasto REAL desde su cuenta + próxima fecha +1 mes (regla del viejo) */
export function pagarSuscripcion(
  estado: EstadoWallet, id: string,
): { estado: EstadoWallet; ok: boolean; error?: string; sub?: Suscripcion } {
  const sub = estado.subscriptions.find((s) => s.id === id);
  if (!sub) return { estado, ok: false, error: 'Suscripción no encontrada' };
  const emoji = sub.emoji || '🔄';
  const t: Transaccion = {
    id: idUnico(estado.transactions),
    date: hoyISO(),
    type: 'expense',
    category: `${emoji} ${sub.name}`,                 // categoría literal del viejo
    amount: sub.cost,
    description: `${emoji} Pago fijo: ${sub.name}`,   // descripción literal del viejo
    account: sub.cuenta || 'efectivo',
  };
  const pagada: Suscripcion = { ...sub, due: mesSiguiente(sub.due) };
  return {
    estado: {
      ...estado,
      transactions: [t, ...estado.transactions],
      subscriptions: estado.subscriptions.map((s) => (s.id === id ? pagada : s)),
    },
    ok: true,
    sub: pagada,
  };
}

/** Días hasta el vencimiento (negativo = vencido) — reglas de color del viejo */
export function diasHasta(due: string): number {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(`${due}T00:00:00`);
  return Math.round((fecha.getTime() - hoy.getTime()) / 86_400_000);
}

// ═══════════════════════════════════════════════════════════
// 🏆 F3 · RETOS — toggle completo/activo del viejo
// (wallettrack_challenges)
// ═══════════════════════════════════════════════════════════

export interface DatosReto {
  name: string;
  desc: string;
  target: number;   // monto o días según el reto
}

export function crearReto(
  estado: EstadoWallet, datos: DatosReto,
): { estado: EstadoWallet; ok: boolean; error?: string } {
  if (!datos.name.trim()) return { estado, ok: false, error: 'Ingresa el nombre del reto' };
  if (!(datos.target > 0)) return { estado, ok: false, error: 'Ingresa el objetivo del reto' };
  const reto: Reto = {
    id: idUnico(estado.challenges),
    name: datos.name.trim(),
    desc: datos.desc.trim() || 'Reto personalizado',
    target: datos.target,
    current: 0,
    status: 'active',
  };
  return { estado: { ...estado, challenges: [...estado.challenges, reto] }, ok: true };
}

/** Marca/desmarca el reto (toggleChallenge del viejo) */
export function toggleReto(estado: EstadoWallet, id: string): EstadoWallet {
  return {
    ...estado,
    challenges: estado.challenges.map((c) => c.id === id
      ? { ...c, status: c.status === 'complete' ? 'active' : 'complete', current: c.status === 'complete' ? c.current : c.target }
      : c),
  };
}

export function eliminarReto(estado: EstadoWallet, id: string): EstadoWallet {
  return { ...estado, challenges: estado.challenges.filter((c) => c.id !== id) };
}

// ═══════════════════════════════════════════════════════════
// 🛒 F3 · LISTA DE COMPRAS — biblioteca + lista + historial,
// formas exactas del viejo (productos / lista_compras / compras_hist)
// ═══════════════════════════════════════════════════════════

export type UnidadProducto = ProductoBiblioteca['unidad'];

export const UNIDADES: { id: UnidadProducto; label: string }[] = [
  { id: 'und', label: 'und' }, { id: 'kg', label: 'kg' }, { id: 'paq', label: 'paq' },
  { id: 'lt', label: 'L' }, { id: 'monto', label: 'monto' },
];

export function unidadLabel(u: string): string {
  return ({ kg: 'kg', und: 'und', paq: 'paq', lt: 'L', monto: 'monto' } as Record<string, string>)[u] || u;
}

/** Paso de cantidad del viejo: 0.5 en kg/lt, 1 en el resto */
export function pasoUnidad(u: string): number {
  return (u === 'kg' || u === 'lt') ? 0.5 : 1;
}

export interface DatosProducto {
  emoji: string;
  nombre: string;
  precio: number | null;
  unidad: UnidadProducto;
}

function itemCompraId(existentes: { id: string }[]): string {
  // 'item_' + ts + '_' + rand — formato del viejo
  let id = `item_${Date.now()}_${Math.floor(Math.random() * 999)}`;
  while (existentes.some((i) => i.id === id)) {
    id = `item_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
  }
  return id;
}

function productoId(existentes: { id: string }[]): string {
  // 'prod_' + ts — formato del viejo, con anti-colisión
  const base = `prod_${Date.now()}`;
  if (!existentes.some((p) => p.id === base)) return base;
  let n = 1;
  while (existentes.some((p) => p.id === `${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Registra el precio en el historial del producto (máx 30 entradas, regla del viejo) */
function registrarPrecioHistorial(prod: ProductoBiblioteca, precio: number): ProductoBiblioteca {
  const historial = [...(prod.historialPrecios || [])];
  const hoy = hoyISO();
  const ult = historial[historial.length - 1];
  if (ult && ult.fecha === hoy) historial[historial.length - 1] = { fecha: hoy, precio };
  else historial.push({ fecha: hoy, precio });
  return { ...prod, precio, historialPrecios: historial.slice(-30) };
}

export function crearProducto(
  estado: EstadoWallet, datos: DatosProducto, agregarALista: boolean,
): { estado: EstadoWallet; ok: boolean; error?: string } {
  if (!datos.nombre.trim()) return { estado, ok: false, error: 'Ponle un nombre al producto' };
  if (estado.productos.some((p) => p.nombre.toLowerCase() === datos.nombre.trim().toLowerCase())) {
    return { estado, ok: false, error: `Ya tienes "${datos.nombre.trim()}" en tu biblioteca` };
  }
  if (datos.precio !== null && !(datos.precio >= 0)) return { estado, ok: false, error: 'Precio inválido' };
  const prod: ProductoBiblioteca = {
    id: productoId(estado.productos),
    emoji: datos.emoji || '📦',
    nombre: datos.nombre.trim(),
    precio: datos.precio,
    unidad: datos.unidad,
    historialPrecios: datos.precio !== null ? [{ fecha: hoyISO(), precio: datos.precio }] : [],
  };
  let nuevo: EstadoWallet = { ...estado, productos: [...estado.productos, prod] };
  if (agregarALista) nuevo = _agregarItemDeProducto(nuevo, prod);
  return { estado: nuevo, ok: true };
}

export function editarProducto(
  estado: EstadoWallet, id: string, datos: DatosProducto,
): { estado: EstadoWallet; ok: boolean; error?: string } {
  const prod = estado.productos.find((p) => p.id === id);
  if (!prod) return { estado, ok: false, error: 'Producto no encontrado' };
  if (!datos.nombre.trim()) return { estado, ok: false, error: 'El nombre no puede quedar vacío' };
  if (datos.precio !== null && !(datos.precio >= 0)) return { estado, ok: false, error: 'Precio inválido' };
  let actualizado = { ...prod, emoji: datos.emoji || '📦', nombre: datos.nombre.trim(), unidad: datos.unidad };
  if (datos.precio !== null && prod.precio !== datos.precio) {
    actualizado = registrarPrecioHistorial(actualizado, datos.precio);
  } else if (datos.precio === null) {
    actualizado = { ...actualizado, precio: null };
  }
  // Sincroniza nombre/emoji/unidad/referencia en items de la lista — NO pisa
  // el precio ya puesto en el mercado (regla textual del viejo)
  const items = estado.listaCompras.items.map((it) => it.productoId === id
    ? { ...it, nombre: actualizado.nombre, emoji: actualizado.emoji, unidad: actualizado.unidad, precioRef: actualizado.precio }
    : it);
  return {
    estado: {
      ...estado,
      productos: estado.productos.map((p) => (p.id === id ? actualizado : p)),
      listaCompras: { ...estado.listaCompras, items },
    },
    ok: true,
  };
}

export function eliminarProducto(estado: EstadoWallet, id: string): EstadoWallet {
  return {
    ...estado,
    productos: estado.productos.filter((p) => p.id !== id),
    listaCompras: { ...estado.listaCompras, items: estado.listaCompras.items.filter((i) => i.productoId !== id) },
  };
}

/** Suma un producto de la biblioteca a la lista (o sube cantidad si ya está) */
function _agregarItemDeProducto(estado: EstadoWallet, prod: ProductoBiblioteca): EstadoWallet {
  const items = [...estado.listaCompras.items];
  const existente = items.find((it) => it.productoId === prod.id);
  if (existente) {
    if (prod.unidad !== 'monto') {
      existente.cantidad = parseFloat((existente.cantidad + pasoUnidad(prod.unidad)).toFixed(2));
    }
  } else {
    items.push({
      id: itemCompraId(items),
      productoId: prod.id,
      nombre: prod.nombre,
      emoji: prod.emoji,
      unidad: prod.unidad,
      precio: null,               // se llena en el mercado — no lo dictamos
      precioRef: prod.precio,     // solo como referencia visual
      cantidad: 1,
      comprado: false,
    });
  }
  return { ...estado, listaCompras: { ...estado.listaCompras, items } };
}

export function agregarProductoALista(estado: EstadoWallet, productoId: string): EstadoWallet {
  const prod = estado.productos.find((p) => p.id === productoId);
  if (!prod) return estado;
  return _agregarItemDeProducto(estado, prod);
}

export function toggleComprado(estado: EstadoWallet, itemId: string): EstadoWallet {
  return {
    ...estado,
    listaCompras: {
      ...estado.listaCompras,
      items: estado.listaCompras.items.map((i) => i.id === itemId ? { ...i, comprado: !i.comprado } : i),
    },
  };
}

export function cambiarCantidad(estado: EstadoWallet, itemId: string, dir: 1 | -1): EstadoWallet {
  return {
    ...estado,
    listaCompras: {
      ...estado.listaCompras,
      items: estado.listaCompras.items.map((i) => {
        if (i.id !== itemId || i.unidad === 'monto') return i;
        const paso = pasoUnidad(i.unidad);
        let nueva = parseFloat((i.cantidad + dir * paso).toFixed(2));
        if (nueva < paso) nueva = paso;
        return { ...i, cantidad: nueva };
      }),
    },
  };
}

export function quitarItemLista(estado: EstadoWallet, itemId: string): EstadoWallet {
  return {
    ...estado,
    listaCompras: { ...estado.listaCompras, items: estado.listaCompras.items.filter((i) => i.id !== itemId) },
  };
}

export interface DatosPrecioItem {
  itemId: string;
  valor: number;        // lo que se ingresó (unitario o total)
  modo: 'unitario' | 'total';
  cantidad: number;     // usada si modo = total
}

/**
 * Pone el precio del item EN EL MERCADO: si fue total lo divide,
 * actualiza la biblioteca y su historial de precios (como el viejo).
 */
export function guardarPrecioItem(
  estado: EstadoWallet, datos: DatosPrecioItem,
): { estado: EstadoWallet; ok: boolean; error?: string } {
  const it = estado.listaCompras.items.find((i) => i.id === datos.itemId);
  if (!it) return { estado, ok: false, error: 'Item no encontrado' };
  if (!(datos.valor >= 0)) return { estado, ok: false, error: 'Ingresa un valor válido' };
  let precioUnitario: number;
  let cantidadFinal: number;
  if (it.unidad === 'monto') {
    cantidadFinal = 1;
    precioUnitario = datos.valor;   // el "precio" ES el monto total
  } else {
    cantidadFinal = datos.cantidad;
    if (!(cantidadFinal > 0)) return { estado, ok: false, error: 'Ingresa una cantidad válida' };
    precioUnitario = datos.modo === 'total' ? datos.valor / cantidadFinal : datos.valor;
  }
  const items = estado.listaCompras.items.map((i) => i.id === datos.itemId
    ? { ...i, cantidad: parseFloat(cantidadFinal.toFixed(2)), precio: parseFloat(precioUnitario.toFixed(4)) }
    : i);
  let productos = estado.productos;
  const prod = estado.productos.find((p) => p.id === it.productoId);
  if (prod) {
    const actualizado = registrarPrecioHistorial(prod, parseFloat(precioUnitario.toFixed(2)));
    productos = estado.productos.map((p) => (p.id === prod.id ? actualizado : p));
  }
  return {
    estado: { ...estado, productos, listaCompras: { ...estado.listaCompras, items } },
    ok: true,
  };
}

export interface ResultadoCierreCompras {
  estado: EstadoWallet;
  ok: boolean;
  error?: string;
  total?: number;
  cuenta?: string;
  nComprados?: number;
}

/** Cierra la compra: gasto real 'Alimentación' + archiva historial (máx 24, regla del viejo) */
export function cerrarCompras(estado: EstadoWallet, cuenta: string): ResultadoCierreCompras {
  const comprados = estado.listaCompras.items.filter((i) => i.comprado);
  if (comprados.length === 0) return { estado, ok: false, error: 'Marca al menos un producto como comprado' };
  const total = comprados.reduce((a, i) => a + (Number(i.precio) || 0) * (Number(i.cantidad) || 0), 0);
  const t: Transaccion = {
    id: idUnico(estado.transactions),
    date: hoyISO(),
    type: 'expense',
    category: 'Alimentación',
    amount: parseFloat(total.toFixed(2)),
    description: `🛒 Compras — ${comprados.length} productos`,   // descripción literal del viejo
    account: cuenta || 'efectivo',
  };
  const hist: CompraHistorial = {
    id: `compra_${Date.now()}`,
    fecha: hoyISO(),
    total: parseFloat(total.toFixed(2)),
    cuenta: cuenta || 'efectivo',
    items: JSON.parse(JSON.stringify(estado.listaCompras.items)) as ItemCompra[],
  };
  const comprasHist = [hist, ...estado.comprasHist].slice(0, 24);
  return {
    estado: {
      ...estado,
      transactions: [t, ...estado.transactions],
      comprasHist,
      listaCompras: { items: [], creada: hoyISO() },
    },
    ok: true,
    total: parseFloat(total.toFixed(2)),
    cuenta: cuenta || 'efectivo',
    nComprados: comprados.length,
  };
}

/** Recrea la lista desde la última compra archivada (repetirUltimaCompra del viejo) */
export function repetirUltimaCompra(estado: EstadoWallet): EstadoWallet {
  const hist = estado.comprasHist[0];
  if (!hist) return estado;
  const items = [...estado.listaCompras.items];
  for (const vi of hist.items) {
    const prod = estado.productos.find((p) => p.id === vi.productoId);
    items.push({
      id: itemCompraId(items),
      productoId: vi.productoId,
      nombre: prod ? prod.nombre : vi.nombre,
      emoji: prod ? prod.emoji : vi.emoji,
      unidad: prod ? prod.unidad : vi.unidad,
      precio: prod ? prod.precio : vi.precio,
      cantidad: vi.cantidad,
      comprado: false,
    });
  }
  return { ...estado, listaCompras: { ...estado.listaCompras, items } };
}

// ═══════════════════════════════════════════════════════════
// 🎨 F5 · CATEGORÍAS PROPIAS — activa las claves reservadas del
// viejo (wallettrack_cat_gasto / _ingreso): se suman a los
// defaults en TODOS los selects (modal, presupuestos, historial).
// ═══════════════════════════════════════════════════════════

export function crearCategoria(
  estado: EstadoWallet, flujo: 'gasto' | 'ingreso', nombre: string, emoji: string,
): { estado: EstadoWallet; ok: boolean; error?: string } {
  const limpio = nombre.trim();
  if (limpio.length < 2) return { estado, ok: false, error: 'Ponle al menos 2 letras' };
  if (limpio.length > 24) return { estado, ok: false, error: 'Nombre muy largo (máx 24)' };
  const existentes = flujo === 'gasto'
    ? [...CATS_GASTO_DEFAULT, ...estado.categoriasGasto]
    : [...CATS_INGRESO_DEFAULT, ...estado.categoriasIngreso];
  if (existentes.some((c) => c.nombre.toLowerCase() === limpio.toLowerCase())) {
    return { estado, ok: false, error: `"${limpio}" ya existe` };
  }
  const cat: Categoria = { id: `cat_${Date.now()}`, emoji: emoji || '📦', nombre: limpio };
  return flujo === 'gasto'
    ? { estado: { ...estado, categoriasGasto: [...estado.categoriasGasto, cat] }, ok: true }
    : { estado: { ...estado, categoriasIngreso: [...estado.categoriasIngreso, cat] }, ok: true };
}

// ═══════════════════════════════════════════════════════════
// 🏦 F5 · CUENTAS PROPIAS — se agregan al catálogo en toda la
// app (id 'cc_*' → viajan en sync y respaldo, no chocan nunca
// con las 6 de fábrica).
// ═══════════════════════════════════════════════════════════

export interface DatosCuentaCustom {
  nombre: string;
  emoji: string;
  color: string;
  tipo: 'banco' | 'billetera' | 'efectivo';
}

export function crearCuentaCustom(
  estado: EstadoWallet, datos: DatosCuentaCustom,
): { estado: EstadoWallet; ok: boolean; error?: string; id?: string } {
  const limpio = datos.nombre.trim();
  if (limpio.length < 2) return { estado, ok: false, error: 'Ponle al menos 2 letras' };
  if (todasLasCuentas(estado).some((c) => c.name.toLowerCase() === limpio.toLowerCase())) {
    return { estado, ok: false, error: `Ya tienes la cuenta "${limpio}"` };
  }
  const cuenta: Cuenta = {
    id: `cc_${Date.now()}`,
    name: limpio,
    icon: datos.emoji || '💳',
    color: datos.color || '#64748b',
    tipo: datos.tipo || 'billetera',
  };
  return { estado: { ...estado, cuentasCustom: [...estado.cuentasCustom, cuenta] }, ok: true, id: cuenta.id };
}

/** Quita la cuenta propia (los movimientos quedan en el historial; el saldo deja de contar) */
export function eliminarCuentaCustom(estado: EstadoWallet, id: string): EstadoWallet {
  const saldos = { ...estado.saldosIniciales };
  delete saldos[id];
  return { ...estado, cuentasCustom: estado.cuentasCustom.filter((c) => c.id !== id), saldosIniciales: saldos };
}

// ═══════════════════════════════════════════════════════════
// 🔁 F5 · RECURRENTES — sueldo semanal, alquiler, etc.: la app
// los registra SOLA (catch-up al abrir) con ids deterministas
// `autorec_{recId}_{fecha}` → jamás se duplican ni acá ni tras
// el merge del sync (unirPorId los deduplica entre teléfonos).
// ═══════════════════════════════════════════════════════════

export interface DatosRecurrente {
  nombre: string;
  monto: number;
  tipo: 'income' | 'expense';
  categoria: string;
  cuenta: string;
  frecuencia: Recurrente['frecuencia'];
  inicio: string;
}

export function crearRecurrente(
  estado: EstadoWallet, datos: DatosRecurrente,
): { estado: EstadoWallet; ok: boolean; error?: string } {
  if (!datos.nombre.trim()) return { estado, ok: false, error: 'Ingresa el nombre (ej: Sueldo RiderTrack)' };
  if (!(datos.monto > 0)) return { estado, ok: false, error: 'Ingresa un monto válido' };
  if (!datos.categoria) return { estado, ok: false, error: 'Elige una categoría' };
  if (!datos.inicio) return { estado, ok: false, error: 'Elige la fecha de inicio' };
  const rec: Recurrente = {
    id: idConPrefijo('rec', estado.recurrentes),
    nombre: datos.nombre.trim(),
    monto: datos.monto,
    tipo: datos.tipo,
    categoria: datos.categoria,
    cuenta: datos.cuenta || 'efectivo',
    frecuencia: datos.frecuencia || 'semanal',
    inicio: datos.inicio,
    ultimaAplicacion: null,
    activo: true,
  };
  return { estado: { ...estado, recurrentes: [...estado.recurrentes, rec] }, ok: true };
}

export function eliminarRecurrente(estado: EstadoWallet, id: string): EstadoWallet {
  return { ...estado, recurrentes: estado.recurrentes.filter((r) => r.id !== id) };
}

export function toggleRecurrente(estado: EstadoWallet, id: string): EstadoWallet {
  return { ...estado, recurrentes: estado.recurrentes.map((r) => r.id === id ? { ...r, activo: !r.activo } : r) };
}

/** Próxima fecha de un recurrente a partir de la última aplicada (o su inicio) */
export function siguienteOcurrenciaISO(rec: Recurrente, desdeISO: string): string {
  const d = new Date(`${desdeISO}T00:00:00`);
  if (rec.frecuencia === 'mensual') {
    const diaOriginal = d.getDate();
    d.setMonth(d.getMonth() + 1);
    // fin de mes: 31→feb rueda a marzo → se clampea al último día del mes objetivo
    if (d.getDate() < diaOriginal) d.setDate(0);
  } else if (rec.frecuencia === 'quincenal') {
    d.setDate(d.getDate() + 15);
  } else {
    d.setDate(d.getDate() + 7);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Fecha de la PRÓXIMA ocurrencia pendiente (para mostrar en la tarjeta) */
export function proximaFechaRecurrente(rec: Recurrente): string {
  const base = rec.ultimaAplicacion ?? null;
  return base ? siguienteOcurrenciaISO(rec, base) : rec.inicio;
}

export interface ResultadoRecurrentes {
  estado: EstadoWallet;
  nuevas: Transaccion[];   // las que se registraron ahora (para el toast)
}

/**
 * Registra TODAS las ocurrencias vencidas de los recurrentes
 * activos (catch-up): desde la última aplicada (o inicio) hasta
 * hoy. Ids deterministas → llamarlo mil veces no duplica nada.
 */
export function aplicarRecurrentesPendientes(estado: EstadoWallet): ResultadoRecurrentes {
  const hoy = hoyISO();
  let transactions = estado.transactions;
  const recurrentes: Recurrente[] = [];
  const nuevas: Transaccion[] = [];
  for (const rec of estado.recurrentes) {
    let r: Recurrente = { ...rec };
    if (r.activo) {
      let fecha: string = r.ultimaAplicacion ? siguienteOcurrenciaISO(r, r.ultimaAplicacion) : r.inicio;
      let guardas = 0; // tope anti-bucle (300 semanas ≈ 5.7 años de catch-up)
      while (fecha <= hoy && guardas < 300) {
        const id = `autorec_${r.id}_${fecha}`;
        if (!transactions.some((t) => t.id === id)) {
          const t: Transaccion = {
            id, date: fecha, type: r.tipo, category: r.categoria,
            amount: r.monto, description: `🔁 ${r.nombre} (programado)`, account: r.cuenta,
          };
          transactions = [t, ...transactions];
          nuevas.push(t);
        }
        r = { ...r, ultimaAplicacion: fecha };
        fecha = siguienteOcurrenciaISO(r, fecha);
        guardas++;
      }
    }
    recurrentes.push(r);
  }
  if (nuevas.length === 0) return { estado, nuevas };
  return { estado: { ...estado, transactions, recurrentes }, nuevas };
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
  return todasLasCuentas(estado).reduce((acc, c) => acc + saldoCuenta(estado, c.id), 0);
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

// ── F3 · Resumen de TODOS los meses (getResumenMeses del viejo) ─
export interface ResumenMesCalculado {
  mes: string;        // 'YYYY-MM'
  label: string;      // 'sep 26' (mes corto es-PE)
  ingresos: number;
  gastos: number;
  ahorro: number;
  pctAhorro: number;  // ahorro / ingresos × 100 (0 si no hubo ingresos)
}

/** Todos los meses con data, orden ascendente — excluye fondo empresa y ✉️ sobres (reglas del viejo) */
export function resumenMeses(estado: EstadoWallet): ResumenMesCalculado[] {
  const mapa: Record<string, { ingresos: number; gastos: number }> = {};
  for (const t of estado.transactions) {
    if (t.category === '__fondo_empresa__' || t.esSobre) continue;  // excluir fondo empresa y apartados
    const m = (t.date || '').substring(0, 7);
    if (!m) continue;
    if (!mapa[m]) mapa[m] = { ingresos: 0, gastos: 0 };
    const monto = Number(t.amount) || 0;
    if (t.type === 'income') mapa[m].ingresos += monto;
    else mapa[m].gastos += monto;
  }
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return Object.entries(mapa)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => {
      const [y, m] = mes.split('-');
      const ahorro = v.ingresos - v.gastos;
      const pctAhorro = v.ingresos > 0 ? (ahorro / v.ingresos) * 100 : 0;
      return { mes, label: `${MESES[+m - 1]} ${String(y).slice(2)}`, ingresos: v.ingresos, gastos: v.gastos, ahorro, pctAhorro };
    });
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
    cuentasCustom: estado.cuentasCustom,
    recurrentes:   estado.recurrentes,
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
    if (data.cuentasCustom)    nuevo.cuentasCustom = data.cuentasCustom;
    if (data.recurrentes)      nuevo.recurrentes = data.recurrentes;
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
    cuentasCustom: [],
    recurrentes: [],
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
