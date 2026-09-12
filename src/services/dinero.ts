// ═══════════════════════════════════════════════════════════
// 💰 DINERO — WalletTrack V2 (F0)
// Formateo en soles (es-PE) y helpers de fecha. Mismo formato
// que usaba el HTML original en toda la app.
// ═══════════════════════════════════════════════════════════

/** S/ 1,234.56 — mismo formato del viejo (es-PE, 2 decimales) */
export function soles(monto: number, conDecimales = true): string {
  const n = Number.isFinite(monto) ? monto : 0;
  return `S/ ${n.toLocaleString('es-PE', {
    minimumFractionDigits: conDecimales ? 2 : 0,
    maximumFractionDigits: conDecimales ? 2 : 0,
  })}`;
}

/** '123.45' | '123,45' | 'S/ 123' → 123.45 (null si inválido) */
export function parseMonto(texto: string): number | null {
  const limpio = String(texto ?? '')
    .replace(/[S/\s]/g, '')
    .replace(',', '.');
  const n = parseFloat(limpio);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Fecha de hoy en 'YYYY-MM-DD' (local, no UTC — como el viejo) */
export function hoyISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** '2026-09-13' → '13 sep' */
export function fechaCorta(iso: string): string {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  if (!a || !m || !d) return iso;
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${String(d).padStart(2, '0')} ${meses[m - 1]}`;
}

/** '2026-09-13' → '13 de septiembre de 2026' */
export function fechaLarga(iso: string): string {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  if (!a || !m || !d) return iso;
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${d} de ${meses[m - 1]} de ${a}`;
}

/** '2026-09' del mes actual */
export function mesActualISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** ¿La transacción pertenece al mes indicado ('YYYY-MM')? */
export function esDelMes(fecha: string, mesISO: string): boolean {
  return Boolean(fecha) && fecha.startsWith(mesISO);
}

/** Nombre del mes actual: 'septiembre 2026' */
export function nombreMesActual(): string {
  const d = new Date();
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${meses[d.getMonth()]} ${d.getFullYear()}`;
}
