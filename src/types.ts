// ═══════════════════════════════════════════════════════════
// 🧩 TYPES — WalletTrack V2 (F0)
// Contrato de datos 1:1 con la app original (wallettrack.github.io):
// mismas formas, mismos nombres de campo, para que un respaldo
// JSON v3.0 del viejo WalletTrack importe SIN conversión.
// ═══════════════════════════════════════════════════════════

// ── Navegación ────────────────────────────────────────────────
export type VistaApp =
  | 'dashboard'
  | 'cuentas'
  | 'sobres'
  | 'deudas'
  | 'compras'
  | 'presupuestos'
  | 'metas'
  | 'calendario'
  | 'suscripciones'
  | 'retos'
  | 'historial'
  | 'estadisticas'
  | 'walletbot'
  | 'config';

// ── Catálogos ─────────────────────────────────────────────────
export interface Cuenta {
  id: string;          // 'bcp' | 'interbank' | 'bbva' | 'yape' | 'plin' | 'efectivo'
  name: string;
  icon: string;        // emoji
  color: string;       // hex
  tipo: 'banco' | 'billetera' | 'efectivo';
}

export interface Categoria {
  id: string;
  emoji: string;
  nombre: string;
}

// ── Transacciones (forma exacta del viejo) ────────────────────
export interface Transaccion {
  id: string;                    // Date.now().toString()
  date: string;                  // 'YYYY-MM-DD'
  type: 'income' | 'expense';
  category: string;              // nombre de la categoría
  amount: number;
  description: string;
  account?: string;              // id de cuenta ('efectivo' si falta)
  esSobre?: boolean;             // F2: recargas de sobres desde balance (viejo)
}
// ── Módulos de fases futuras (se leen del storage ya en F0) ──
export interface Meta {
  id: string;
  name: string;
  target: number;
  current: number;
  date: string;
}

export interface Presupuesto {
  id: string;
  category: string;
  icon: string;
  limit: number;
  color: string;
}

export interface Suscripcion {
  id: string;
  name: string;
  cost: number;
  due: string;               // 'YYYY-MM-DD' próximo pago (+1 mes al pagar)
  emoji?: string;            // F3: icono del fijo (original lo guardaba si lo elegías)
  cuenta?: string;           // F3: id de cuenta desde donde se paga (default efectivo)
}

export interface Reto {
  id: string;
  name: string;
  desc: string;
  target: number;
  current: number;
  status: 'active' | 'complete' | 'failed';
}

export interface GastoRapido {
  id: string;
  emoji: string;
  nombre: string;
  monto: number;
  categoria: string;
  cuenta: string;
}

// ── F2 · DINERO: formas EXACTAS del viejo (sobres y deudas) ──
export interface Sobre {
  id: string;            // 'sobre_' + Date.now() (formato del viejo)
  nombre: string;
  emoji: string;
  montoInicial: number;
  color: string;         // hex del picker del viejo
  fechaCreacion: string; // 'YYYY-MM-DD'
}

export interface SobreMov {
  id: string;
  sobreId: string;
  tipo: 'gasto' | 'recarga';
  monto: number;
  desc: string;
  fecha: string;         // 'YYYY-MM-DD'
}

export interface Deuda {
  id: string;            // 'deuda_' + Date.now() (formato del viejo)
  nombre: string;
  montoTotal: number;
  totalCuotas: number;
  montoCuota: number;
  semanalSugerido: number; // montoCuota / 4 (sugerencia del viejo)
  cuotasPagadas: number;
  cuotaActual: number;
  proximaFecha: string;    // 'YYYY-MM-DD' (+1 mes al pagar cuota)
  cuenta: string;          // id de cuenta de dónde sale el pago
  fechaCreacion: string;   // 'YYYY-MM-DD'
}

export interface DeudaMov {
  id: string;
  deudaId: string;
  tipo: 'aportar' | 'pagar';
  cuotaNum: number;
  monto: number;
  fecha: string;         // 'YYYY-MM-DD'
  desc: string;
}

/** Forma mínima de los módulos F1+ — se conservan crudos */
export interface RegistroSensible {
  id: string;
  [clave: string]: unknown;
}

// ── F3 · ANÁLISIS: formas EXACTAS del viejo (compras) ────────
/** Producto de la biblioteca (wallettrack_productos) */
export interface ProductoBiblioteca {
  id: string;                     // 'prod_' + Date.now() (formato del viejo)
  emoji: string;
  nombre: string;
  precio: number | null;          // null = sin precio de referencia aún
  unidad: 'kg' | 'und' | 'paq' | 'lt' | 'monto';
  historialPrecios: { fecha: string; precio: number }[];  // máx 30 (regla del viejo)
}

/** Item de la lista activa (wallettrack_lista_compras.items) */
export interface ItemCompra {
  id: string;                     // 'item_' + ts + '_rand' (formato del viejo)
  productoId: string;
  nombre: string;
  emoji: string;
  unidad: ProductoBiblioteca['unidad'];
  precio: number | null;          // null = se llena en el mercado (regla del viejo)
  precioRef?: number | null;      // solo referencia visual de la biblioteca
  cantidad: number;               // pasos de 0.5 en kg/lt, 1 en el resto
  comprado: boolean;
}

/** Compra cerrada del historial (wallettrack_compras_hist, máx 24) */
export interface CompraHistorial {
  id: string;                     // 'compra_' + Date.now() (formato del viejo)
  fecha: string;                  // 'YYYY-MM-DD'
  total: number;
  cuenta: string;
  items: ItemCompra[];            // snapshot de la lista al cerrar
}

// ── F4 · Theme Studio (forma EXACTA del viejo: wallettrack_theme) ──
export interface TemaWallet {
  accent: string;          // '#10b981' por defecto (emerald del original)
  name: string;            // 'emerald' | 'blue' | ... | 'custom'
  glass: boolean;          // legacy del viejo (mantenido por compatibilidad)
  glassOpacity: number;    // 0.3–0.95 · alpha de las tarjetas
  brightness: 'deep' | 'soft-dark' | 'neutro' | 'soft-light' | 'light';
  style: 'minimal' | 'premium' | 'gaming' | 'neon' | 'elegante';
  background: 'none' | 'particles' | 'gradient' | 'aurora' | 'pulse' | 'matrix';
  compact: boolean;        // modo compacto
  fontSize: number;        // 80–120 (%)
  font: 'Inter' | 'Outfit' | 'Roboto' | 'Poppins' | 'Nunito' | 'mono';
  cardRadius: 'square' | 'rounded' | 'pill';
  animSpeed: 'fast' | 'normal' | 'slow' | 'none';
}

// ── F5 · SEGURIDAD + RECORDATORIOS + RECURRENTES ────────────
/** Config del candado local (wallettrack_security — clave del viejo, local: NO viaja a la nube) */
export interface SeguridadWallet {
  pin: string | null;      // hash del PIN de 4 dígitos (null = sin candado)
  huella: boolean;         // usar huella/distractor biométrico cuando esté disponible
}

/** Movimiento programado (sueldo semanal, alquiler, etc.) — wallettrack_recurrentes (F5) */
export interface Recurrente {
  id: string;                  // 'rec_' + Date.now()
  nombre: string;
  monto: number;
  tipo: 'income' | 'expense';
  categoria: string;           // nombre de la categoría
  cuenta: string;              // id de cuenta
  frecuencia: 'semanal' | 'quincenal' | 'mensual';
  inicio: string;              // 'YYYY-MM-DD' primera ocurrencia
  ultimaAplicacion: string | null; // última ocurrencia YA registrada (avanza sola)
  activo: boolean;
}

// ── Estado global (espejo del AppState del viejo) ─────────────
export interface EstadoWallet {
  transactions: Transaccion[];
  goals: Meta[];
  subscriptions: Suscripcion[];
  challenges: Reto[];
  saldosIniciales: Record<string, number>;
  cardCustom: Record<string, unknown>;
  budgets: Presupuesto[];
  categoriasGasto: Categoria[];    // personalizadas (las default viven aparte)
  categoriasIngreso: Categoria[];
  sobres: Sobre[];               // F2 · formas reales del viejo
  sobreMovs: SobreMov[];
  deudas: Deuda[];
  deudaMovs: DeudaMov[];
  productos: ProductoBiblioteca[];       // F3 · formas reales del viejo
  listaCompras: { items: ItemCompra[]; creada: string | null };
  comprasHist: CompraHistorial[];
  gastosRapidos: GastoRapido[];
  cuentasCustom: Cuenta[];        // F5 · cuentas propias del usuario (id 'cc_*')
  recurrentes: Recurrente[];      // F5 · movimientos programados
}

// ── Respaldo JSON (formato v3.0 del viejo) ────────────────────
export interface RespaldoWallet {
  version: string;
  fecha: string;
  transactions?: Transaccion[];
  goals?: Meta[];
  subscriptions?: Suscripcion[];
  challenges?: Reto[];
  saldosIniciales?: Record<string, number>;
  cardCustom?: Record<string, unknown>;
  budgets?: Presupuesto[];
  categoriasGasto?: Categoria[];
  categoriasIngreso?: Categoria[];
  sobres?: Sobre[];
  sobreMovs?: SobreMov[];
  deudas?: Deuda[];
  deudaMovs?: DeudaMov[];
  productos?: ProductoBiblioteca[];
  listaCompras?: { items: ItemCompra[]; creada: string | null };
  comprasHist?: CompraHistorial[];
  gastosRapidos?: GastoRapido[];
  cuentasCustom?: Cuenta[];        // F5 · viaja también en el respaldo JSON
  recurrentes?: Recurrente[];
}
