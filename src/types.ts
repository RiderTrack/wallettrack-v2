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
  due: string;
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

/** Forma mínima de los módulos F1+ — se conservan crudos */
export interface RegistroSensible {
  id: string;
  [clave: string]: unknown;
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
  sobres: RegistroSensible[];
  sobreMovs: RegistroSensible[];
  deudas: RegistroSensible[];
  deudaMovs: RegistroSensible[];
  productos: RegistroSensible[];
  listaCompras: { items: RegistroSensible[]; creada: string | null };
  comprasHist: RegistroSensible[];
  gastosRapidos: GastoRapido[];
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
  sobres?: RegistroSensible[];
  sobreMovs?: RegistroSensible[];
  deudas?: RegistroSensible[];
  deudaMovs?: RegistroSensible[];
  productos?: RegistroSensible[];
  listaCompras?: { items: RegistroSensible[]; creada: string | null };
  comprasHist?: RegistroSensible[];
  gastosRapidos?: GastoRapido[];
}
