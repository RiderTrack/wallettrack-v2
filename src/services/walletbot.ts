// ═══════════════════════════════════════════════════════════
// 🤖 WALLETBOT — WalletTrack V2 (F4)
// Portado 1:1 del WalletBot 2.0 del wallettrack original
// ("Asesor Financiero Inteligente", Módulo 7): analiza el mes en
// curso con TUS datos reales y devuelve máximo 4 mensajes
// PRIORIZADOS por score:
//   RIESGO > ALERTA > META > TENDENCIA > CONSEJO > LOGRO
// Las 12 reglas del viejo quedaron intactas (dinero libre real,
// proyección fin de mes, gastos hormiga, categoría excesiva,
// presupuesto en riesgo, meta urgente, racha de registro,
// crecimiento de gastos, comparación semanal, tasa de ahorro,
// mes positivo y sin-datos).
// + PREGUNTAS RÁPIDAS: respuestas deterministas offline con los
// mismos cálculos (cero llamadas a internet — en el APK el bot
// funciona 100% sin datos móviles).
// ═══════════════════════════════════════════════════════════

import type { EstadoWallet } from '../types';
import { soles } from './dinero';
import { saldoTotal } from './estado';

// ── Formas ────────────────────────────────────────────────────
export interface MensajeBot {
  score: number;
  icon: string;
  type: 'consejo' | 'alerta' | 'meta' | 'logro' | 'tendencia' | 'riesgo';
  text: string; // HTML con <strong> (mismo markup del viejo)
}

/** Color por tipo — mismo colorMap del render del viejo (1:1) */
export const COLOR_MAP: Record<MensajeBot['type'], { bg: string; border: string; text: string }> = {
  consejo:   { bg: 'rgba(99,102,241,.08)',  border: 'rgba(99,102,241,.2)',  text: '#a5b4fc' },
  alerta:    { bg: 'rgba(251,113,133,.08)', border: 'rgba(251,113,133,.2)', text: '#fda4af' },
  meta:      { bg: 'rgba(251,191,36,.08)',  border: 'rgba(251,191,36,.2)',  text: '#fcd34d' },
  logro:     { bg: 'rgba(52,211,153,.08)',  border: 'rgba(52,211,153,.2)',  text: '#6ee7b7' },
  tendencia: { bg: 'rgba(56,189,248,.08)',  border: 'rgba(56,189,248,.2)',  text: '#7dd3fc' },
  riesgo:    { bg: 'rgba(239,68,68,.1)',    border: 'rgba(239,68,68,.3)',   text: '#fca5a5' },
};

// ── analyzeWallet del viejo (1:1, adaptado a estado tipado) ──
export function analizarWallet(estado: EstadoWallet): MensajeBot[] {
  const ahora     = new Date();
  const hoy       = ahora.toISOString().split('T')[0];
  const anoActual = ahora.getFullYear();
  const mesIdx    = ahora.getMonth();
  const diasMes   = new Date(anoActual, mesIdx + 1, 0).getDate();
  const diaActual = ahora.getDate();

  const mesActual = `${anoActual}-${String(mesIdx + 1).padStart(2, '0')}`;
  const mesPasado = mesIdx === 0
    ? `${anoActual - 1}-12`
    : `${anoActual}-${String(mesIdx).padStart(2, '0')}`;

  // ── Semana actual vs anterior (misma ventana del viejo) ────
  const inicioSemana = new Date(ahora);
  inicioSemana.setDate(ahora.getDate() - ahora.getDay());
  const inicioSemAnt = new Date(inicioSemana);
  inicioSemAnt.setDate(inicioSemAnt.getDate() - 7);
  const finSemAnt = new Date(inicioSemana);
  finSemAnt.setDate(finSemAnt.getDate() - 1);

  // ── Helpers (S y resumen del viejo) ─────────────────────────
  const S = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  function txEnRango(desde: string, hasta: string) {
    return estado.transactions.filter((t) => t.date >= desde && t.date <= hasta);
  }

  function resumen(txs: typeof estado.transactions) {
    let ing = 0, gas = 0;
    const cats: Record<string, number> = {};
    txs.forEach((t) => {
      const a = parseFloat(String(t.amount));
      if (t.type === 'income') ing += a;
      else { gas += a; cats[t.category] = (cats[t.category] || 0) + a; }
    });
    return { ing, gas, cats, ahorro: ing - gas };
  }

  const txMes  = estado.transactions.filter((t) => (t.date || '').startsWith(mesActual));
  const txAnt  = estado.transactions.filter((t) => (t.date || '').startsWith(mesPasado));
  const rMes   = resumen(txMes);
  const rAnt   = resumen(txAnt);

  const isoSem = (d: Date) => d.toISOString().split('T')[0];
  const txSemAct = txEnRango(isoSem(inicioSemana), hoy);
  const txSemAnt = txEnRango(isoSem(inicioSemAnt), isoSem(finSemAnt));
  const rSemAct  = resumen(txSemAct);
  const rSemAnt  = resumen(txSemAnt);

  // ── 1. DINERO LIBRE REAL ────────────────────────────────────
  const totalSubs   = estado.subscriptions.reduce((a, s) => a + parseFloat(String(s.cost || 0)), 0);
  const metasReserv = estado.goals.reduce((a, g) => a + Math.max(0, parseFloat(String(g.target || 0)) - parseFloat(String(g.current || 0))), 0) / 12;
  const elSaldo     = saldoTotal(estado);
  const dineroLibre = elSaldo - totalSubs - metasReserv;

  // ── 2. PROYECCIÓN FIN DE MES ────────────────────────────────
  const ritmoGasto    = diaActual > 0 ? (rMes.gas / diaActual) * diasMes : 0;
  const ritmoIngreso  = diaActual > 0 ? (rMes.ing / diaActual) * diasMes : 0;
  const proyeccionFin = ritmoIngreso - ritmoGasto;

  // ── 3. GASTOS HORMIGA (pequeños repetidos <S/30, ≥3 veces) ──
  const freqPeq: Record<string, { count: number; total: number }> = {};
  txMes.filter((t) => t.type === 'expense' && parseFloat(String(t.amount)) < 30).forEach((t) => {
    const k = t.category;
    freqPeq[k] = freqPeq[k] || { count: 0, total: 0 };
    freqPeq[k].count++;
    freqPeq[k].total += parseFloat(String(t.amount));
  });
  const hormiga = Object.entries(freqPeq)
    .filter(([, v]) => v.count >= 3)
    .sort((a, b) => b[1].total - a[1].total)[0];

  // ── 4. CATEGORÍA EXCESIVA (>35% del total de gastos) ───────
  let catExcesiva: { nombre: string; monto: number; pct: number } | null = null;
  if (rMes.gas > 0) {
    const top = Object.entries(rMes.cats).sort((a, b) => b[1] - a[1])[0];
    if (top && (top[1] / rMes.gas) > 0.35) {
      catExcesiva = { nombre: top[0], monto: top[1], pct: Math.round((top[1] / rMes.gas) * 100) };
    }
  }

  // ── 5. PRESUPUESTOS EN RIESGO ────────────────────────────────
  const presupuestoRiesgo = estado.budgets
    .map((b) => ({ ...b, gastado: rMes.cats[b.category] || 0 }))
    .filter((b) => b.limit > 0 && (b.gastado / b.limit) >= 0.8)
    .sort((a, b) => (b.gastado / b.limit) - (a.gastado / a.limit))[0];

  // ── 6. META MÁS URGENTE ──────────────────────────────────────
  const metaUrgente = [...estado.goals]
    .filter((g) => g.current < g.target)
    .sort((a, b) => (b.current / b.target) - (a.current / a.target))[0];

  // ── 7. RACHA DE REGISTRO ─────────────────────────────────────
  const diasConMovimiento = new Set(estado.transactions.map((t) => t.date)).size;

  // ── 8. RIESGO: gastos creciendo >15% vs mes anterior ────────
  const riesgoGasto = rAnt.gas > 0 && rMes.gas > 0
    ? ((rMes.gas - rAnt.gas) / rAnt.gas) * 100 : 0;

  // ── PRIORIZACIÓN (mismo orden y scores del viejo) ───────────
  const candidatos: MensajeBot[] = [];

  // Sin datos
  if (rMes.ing === 0 && rMes.gas === 0) {
    candidatos.push({ score: 0, icon: '💡', type: 'consejo',
      text: `Registra tu primer movimiento del mes para activar el análisis.` });
  }

  // 🚨 RIESGO — gastos creciendo fuerte
  if (riesgoGasto > 20) {
    candidatos.push({ score: 100, icon: '🚨', type: 'riesgo',
      text: `Tus gastos crecieron <strong>${riesgoGasto.toFixed(0)}%</strong> respecto al mes anterior. De ${S(rAnt.gas)} a ${S(rMes.gas)}. Revisa inmediatamente.` });
  }

  // ⚠️ ALERTA — presupuesto en riesgo
  if (presupuestoRiesgo) {
    const pct = Math.round((presupuestoRiesgo.gastado / presupuestoRiesgo.limit) * 100);
    const over = pct >= 100;
    candidatos.push({ score: over ? 95 : 85, icon: '⚠️', type: 'alerta',
      text: over
        ? `Presupuesto de <strong>${presupuestoRiesgo.category}</strong> <strong>excedido</strong>. Gastaste ${S(presupuestoRiesgo.gastado)} de ${S(presupuestoRiesgo.limit)}.`
        : `Has consumido el <strong>${pct}%</strong> del presupuesto de <strong>${presupuestoRiesgo.category}</strong>. Solo quedan ${S(presupuestoRiesgo.limit - presupuestoRiesgo.gastado)}.`,
    });
  }

  // ⚠️ ALERTA — sin ingresos registrados
  if (rMes.ing === 0 && rMes.gas > 0) {
    candidatos.push({ score: 90, icon: '⚠️', type: 'alerta',
      text: `Sin ingresos registrados este mes. Tienes ${S(rMes.gas)} en gastos sin respaldo. Registra tus ingresos.` });
  }

  // 🚨 RIESGO — tasa de ahorro crítica
  const ratioAhorro = rMes.ing > 0 ? ((rMes.ing - rMes.gas) / rMes.ing) * 100 : 0;
  if (rMes.ing > 0 && ratioAhorro < 5) {
    candidatos.push({ score: 88, icon: '🚨', type: 'riesgo',
      text: `Tasa de ahorro del <strong>${ratioAhorro.toFixed(0)}%</strong>. Casi sin margen. ${catExcesiva ? `Recorta en <strong>${catExcesiva.nombre}</strong> (${catExcesiva.pct}% de tus gastos).` : 'Revisa tus gastos urgente.'}` });
  }

  // 💡 CONSEJO — dinero libre real
  if (elSaldo > 0) {
    candidatos.push({ score: 70, icon: '💡', type: 'consejo',
      text: `Dinero libre real: <strong>${S(Math.max(0, dineroLibre))}</strong>. Saldo ${S(elSaldo)} menos fijos (${S(totalSubs)}) y reservas metas (${S(Math.round(metasReserv))}/mes).` });
  }

  // 📈 TENDENCIA — proyección fin de mes
  if (rMes.ing > 0 && diaActual >= 5) {
    candidatos.push({ score: 65, icon: '📈', type: 'tendencia',
      text: `A este ritmo terminarás el mes con <strong>${proyeccionFin >= 0 ? '+' : ''}${S(proyeccionFin)}</strong>. ${proyeccionFin < 0 ? 'Reduce gastos para cerrar en positivo.' : 'Buen camino.'}` });
  }

  // 🎯 META — la más cercana
  if (metaUrgente) {
    const pct    = Math.round((metaUrgente.current / metaUrgente.target) * 100);
    const faltan = metaUrgente.target - metaUrgente.current;
    candidatos.push({ score: 60, icon: '🎯', type: 'meta',
      text: `<strong>${metaUrgente.name}</strong> — ${pct}% completada. Faltan ${S(faltan)}.${ratioAhorro > 15 ? ` Con tu ahorro actual lo logras en ~${Math.ceil(faltan / (rMes.ing * ratioAhorro / 100))} meses.` : ''}` });
  }

  // 📈 TENDENCIA — comparación semanal
  if (rSemAnt.gas > 0 && rSemAct.gas > 0) {
    const difSem = ((rSemAct.gas - rSemAnt.gas) / rSemAnt.gas) * 100;
    if (Math.abs(difSem) > 10) {
      candidatos.push({ score: difSem > 0 ? 55 : 50, icon: '📈', type: 'tendencia',
        text: difSem > 0
          ? `Gastos esta semana <strong>+${difSem.toFixed(0)}%</strong> vs la anterior (${S(rSemAnt.gas)} → ${S(rSemAct.gas)}).`
          : `Gastaste <strong>${Math.abs(difSem).toFixed(0)}%</strong> menos que la semana pasada. ${S(rSemAnt.gas - rSemAct.gas)} ahorrados.`,
      });
    }
  }

  // 💡 CONSEJO — categoría excesiva
  if (catExcesiva && !candidatos.some((m) => m.type === 'riesgo')) {
    candidatos.push({ score: 45, icon: '💡', type: 'consejo',
      text: `<strong>${catExcesiva.nombre}</strong> representa el <strong>${catExcesiva.pct}%</strong> de tus gastos este mes (${S(catExcesiva.monto)}). Reducirlo un 20% te daría ${S(catExcesiva.monto * 0.2)} extra.` });
  }

  // 💡 CONSEJO — gastos hormiga
  if (hormiga) {
    const [cat, { count, total }] = hormiga;
    candidatos.push({ score: 40, icon: '💡', type: 'consejo',
      text: `Detecté <strong>${count} gastos pequeños</strong> en <strong>${cat}</strong> este mes. Total acumulado: <strong>${S(total)}</strong>. Pequeños montos, gran impacto.` });
  }

  // 🏆 LOGRO — racha de registro
  if (diasConMovimiento >= 14) {
    candidatos.push({ score: 20, icon: '🏆', type: 'logro',
      text: `Llevas <strong>${diasConMovimiento} días</strong> con movimientos registrados. El control constante es la base de las finanzas sanas.` });
  }

  // 🏆 LOGRO — mes positivo
  if (ratioAhorro >= 25 && rMes.ing > 0) {
    candidatos.push({ score: 30, icon: '🏆', type: 'logro',
      text: `Ahorro del mes: <strong>${ratioAhorro.toFixed(0)}%</strong> (${S(rMes.ing - rMes.gas)}). Estás por encima del promedio recomendado del 20%.` });
  }

  // ── Top 4 por score (regla del viejo) ───────────────────────
  return candidatos.sort((a, b) => b.score - a.score).slice(0, 4);
}

// ═══════════════════════════════════════════════════════════
// 💬 PREGUNTAS RÁPIDAS — respuestas offline con datos reales
// (mismos cálculos del bot: dinero libre, proyección, top de
// categoría, deudas y metas — sin internet, sin API, sin keys)
// ═══════════════════════════════════════════════════════════

export interface PreguntaRapida {
  id: string;
  pregunta: string;
  icono: string;
  responder: (estado: EstadoWallet) => { text: string; type: MensajeBot['type'] };
}

export const PREGUNTAS_RAPIDAS: PreguntaRapida[] = [
  {
    id: 'hoy',
    pregunta: '¿Cuánto puedo gastar hoy?',
    icono: '💵',
    responder: (estado) => {
      const ahora = new Date();
      const diasMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
      const diasRestan = Math.max(1, diasMes - ahora.getDate() + 1);
      const mes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
      let ing = 0, gas = 0;
      estado.transactions.filter((t) => (t.date || '').startsWith(mes)).forEach((t) => {
        if (t.type === 'income') ing += t.amount; else gas += t.amount;
      });
      const subs = estado.subscriptions.reduce((a, s) => a + (s.cost || 0), 0);
      const metasReserv = estado.goals.reduce((a, g) => a + Math.max(0, (g.target || 0) - (g.current || 0)), 0) / 12;
      const libre = Math.max(0, saldoTotal(estado) - subs - metasReserv);
      const porDia = Math.floor(libre / diasRestan);
      const ritmo = ahora.getDate() > 0 ? gas / ahora.getDate() : 0;
      return {
        type: ritmo > porDia && porDia > 0 ? 'alerta' : 'consejo',
        text: `Tu dinero libre es <strong>${soles(libre)}</strong> para los <strong>${diasRestan} días</strong> que quedan del mes: <strong>${soles(porDia)} por día</strong>.${gas > 0 ? ` Tu ritmo actual es ${soles(ritmo)}/día${ritmo > porDia ? ' — estás por encima, frena un poco ⚠️' : ' — vas bien ✅'}.` : ''}`,
      };
    },
  },
  {
    id: 'deudas',
    pregunta: '¿Cómo van mis deudas?',
    icono: '💳',
    responder: (estado) => {
      if (estado.deudas.length === 0) {
        return { type: 'logro', text: 'No tienes deudas registradas. Si quieres probar el módulo, crea una desde <strong>Deudas y Apartados</strong> 🎉' };
      }
      const totalDeuda = estado.deudas.reduce((a, d) => a + (d.montoTotal || 0), 0);
      const cuotasPagadas = estado.deudas.reduce((a, d) => a + (d.cuotasPagadas || 0), 0);
      const cuotasTotales = estado.deudas.reduce((a, d) => a + (d.totalCuotas || 0), 0);
      const proxima = [...estado.deudas]
        .filter((d) => d.proximaFecha)
        .sort((a, b) => (a.proximaFecha < b.proximaFecha ? -1 : 1))[0];
      const pagado = cuotasTotales > 0 ? Math.round((cuotasPagadas / cuotasTotales) * 100) : 0;
      return {
        type: pagado >= 50 ? 'logro' : 'meta',
        text: `Tienes <strong>${estado.deudas.length} deuda${estado.deudas.length > 1 ? 's' : ''}</strong> por ${soles(totalDeuda)}: <strong>${cuotasPagadas}/${cuotasTotales} cuotas</strong> pagadas (${pagado}%).${proxima ? ` La próxima cuota vence el <strong>${proxima.proximaFecha}</strong>${(proxima.montoCuota || 0) > 0 ? ` de ${soles(proxima.montoCuota)}` : ''}.` : ''}`,
      };
    },
  },
  {
    id: 'categoria',
    pregunta: '¿Qué categoría me pesa?',
    icono: '📊',
    responder: (estado) => {
      const ahora = new Date();
      const mes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
      const cats: Record<string, number> = {};
      let gas = 0;
      estado.transactions.filter((t) => (t.date || '').startsWith(mes) && t.type === 'expense').forEach((t) => {
        cats[t.category] = (cats[t.category] || 0) + t.amount;
        gas += t.amount;
      });
      const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
      if (!top) return { type: 'consejo', text: 'Aún no hay gastos este mes. Registra movimientos y te digo qué categoría te está pesando.' };
      const pct = Math.round((top[1] / gas) * 100);
      return {
        type: pct > 35 ? 'alerta' : 'tendencia',
        text: `<strong>${top[0]}</strong> es tu categoría más pesada: ${soles(top[1])} (<strong>${pct}%</strong> de tus gastos del mes).${pct > 35 ? ' Pasa del 35% — el mismo umbral que uso para alertarte. Reducirla un 20% te libera ' + soles(top[1] * 0.2) + '.' : ' Está en un rango sano.'}`,
      };
    },
  },
  {
    id: 'ahorro',
    pregunta: '¿Cuánto llevo ahorrado?',
    icono: '🎯',
    responder: (estado) => {
      const ahora = new Date();
      const mes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
      let ing = 0, gas = 0;
      estado.transactions.filter((t) => (t.date || '').startsWith(mes)).forEach((t) => {
        if (t.type === 'income') ing += t.amount; else gas += t.amount;
      });
      const tasa = ing > 0 ? ((ing - gas) / ing) * 100 : 0;
      const enMetas = estado.goals.reduce((a, g) => a + (g.current || 0), 0);
      const enSobres = estado.sobres.reduce((a, s) => {
        const movs = estado.sobreMovs.filter((m) => m.sobreId === s.id);
        const rec = movs.filter((m) => m.tipo === 'recarga').reduce((x, m) => x + m.monto, 0);
        const gas2 = movs.filter((m) => m.tipo === 'gasto').reduce((x, m) => x + m.monto, 0);
        return a + (s.montoInicial || 0) + rec - gas2;
      }, 0);
      return {
        type: tasa >= 25 ? 'logro' : (ing > 0 && tasa < 5 ? 'riesgo' : 'meta'),
        text: `Este mes: ${ing > 0 ? `ingresos ${soles(ing)} − gastos ${soles(gas)} = <strong>${soles(ing - gas)}</strong> (<strong>${tasa.toFixed(0)}%</strong> de ahorro${tasa >= 25 ? ' — encima del 20% recomendado 🏆' : ''}).` : 'aún sin ingresos este mes.'} Además tienes <strong>${soles(enMetas)}</strong> en metas y <strong>${soles(enSobres)}</strong> en sobres.`,
      };
    },
  },
];
