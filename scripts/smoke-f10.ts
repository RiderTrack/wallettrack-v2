// Smoke test F10 · Captura automática — verifica que:
// 1. extraerMonto: S/ · S/. · S/25 sin decimales · comas de miles ·
//    USD · $ · sin símbolo → null (no confunde códigos/fechas).
// 2. detectarDireccion: palabras de ingreso PRIMERO ("Pago recibido"
//    es ingreso aunque tenga "pago"), acentos ignorados.
// 3. limpiarDescripcion: quita montos, teléfonos, códigos *XXX.
// 4. parsearCaptura: notificaciones reales de BCP/Yape/Interbank.
// 5. categoriaPara: diccionario F9 + solo categorías válidas del
//    tipo correcto (ingreso con NETFLIX → Ingresos Extra).
// 6. procesarCapturas: modo auto crea transacciones con cuenta
//    correcta (BCP→bcp, Yape→yape), dedupe por id y por contenido
//    (doble notificación), allowlist respetada, apagado no procesa.
// 7. Modo revisión: nada se crea directo, queda en el log con el
//    parse listo; resolverRevisionComoImportada crea la tx;
//    ignorarRevision marca ignora.
// 8. calcularSaldoVivo: inicial + movs de la cuenta desde la fecha,
//    ignora otras cuentas y fechas anteriores.
// 9. Prefs: defaults, round-trip, cap de vistos.
// 10. Guard: toda sugerencia del diccionario existe como categoría
//     válida de su tipo (regla de F9.1).
//
// Correr con: npx tsx -r ./scripts/localstorage-shim.cjs scripts/smoke-f10.ts

import {
  extraerMonto, detectarDireccion, limpiarDescripcion, parsearCaptura,
  categoriaPara, procesarCapturas, resolverRevisionComoImportada, ignorarRevision,
  calcularSaldoVivo, leerPrefsCaptura, guardarPrefsCaptura, leerLogCaptura,
  guardarLogCaptura, mensajeCapturas, cuentaPorDefecto,
  type CapturaNotif, type PrefsCaptura,
} from '../src/services/captura.ts';
import { resetTotal, leerEstado } from '../src/services/estado.ts';
import type { EstadoWallet, Transaccion } from '../src/types.ts';
import { CATS_GASTO_DEFAULT, CATS_INGRESO_DEFAULT, DICCIONARIO_CATEGORIAS } from '../src/data/catalogos.ts';

let ok = 0;
let fail = 0;
function check(cond, msg) {
  if (cond) { ok++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
}

function prefsDePrueba(over: Partial<PrefsCaptura> = {}): PrefsCaptura {
  const p = leerPrefsCaptura();
  return {
    ...p,
    activo: true,
    modo: 'auto',
    packages: ['com.bcp.bank.bcp', 'com.bcp.innovacxion.yapeapp'],
    cuentasMap: {},
    saldoVivo: null,
    ultimaRevisada: 0,
    vistos: {},
    ...over,
  };
}

function limpiar() {
  resetTotal();
  guardarLogCaptura([]);
  localStorage.removeItem('wallettrack_v2_captura');
}

const BCP = 'com.bcp.bank.bcp';
const YAPE = 'com.bcp.innovacxion.yapeapp';
let tsBase = Date.now() - 600_000;

function captura(pkg: string, title: string, text: string, ts?: number): CapturaNotif {
  return { pkg, title, text, sub: '', ts: ts ?? (tsBase += 1000) };
}

console.log('\n[1] extraerMonto (con símbolo, sin falsos positivos)');
{
  check(extraerMonto('Compraste S/ 25.50 en UBER') === 25.5, 'S/ 25.50 → 25.5');
  check(extraerMonto('S/.1,234.56') === 1234.56, 'S/.1,234.56 → 1234.56');
  check(extraerMonto('S/25') === 25, 'S/25 sin decimales → 25');
  check(extraerMonto('USD 10.00') === 10, 'USD 10.00 → 10');
  check(extraerMonto('$ 9.99') === 9.99, '$ 9.99 → 9.99');
  check(extraerMonto('Operación N° 45201 del 12/09') === null, 'códigos sin S/ → null');
  check(extraerMonto('Saldo disponible 8,450.21') === null, 'saldo sin símbolo → null');
  check(extraerMonto('S/ 0.00') === null, 'S/ 0.00 → null (no es movimiento)');
  check(extraerMonto('Recibiste un Yape de S/ 20') === 20, 'monto al final de la frase → 20');
}

console.log('\n[2] detectarDireccion (ingreso primero, acentos ignorados)');
{
  check(detectarDireccion('Compraste S/ 25.50 en UBER') === 'expense', 'compraste → gasto');
  check(detectarDireccion('Yapeaste S/ 10.00 a +51 987') === 'expense', 'yapeaste → gasto');
  check(detectarDireccion('Recibiste un Yape de S/ 20.00') === 'income', 'recibiste → ingreso');
  check(detectarDireccion('Pago recibido S/ 500.00') === 'income', '"pago recibido" → ingreso (no gasto)');
  check(detectarDireccion('Depósito recibido S/ 1,200') === 'income', 'depósito → ingreso');
  check(detectarDireccion('Te yapearon S/ 15.00') === 'income', 'te yapearon → ingreso');
  check(detectarDireccion('Consumo con tarjeta S/ 42.10') === 'expense', 'consumo → gasto');
  check(detectarDireccion('Retiro S/ 200 cajero') === 'expense', 'retiro → gasto');
  check(detectarDireccion('Abono de planilla S/ 3,000') === 'income', 'abono → ingreso');
  check(detectarDireccion('Transferencia enviada S/ 100') === 'expense', 'transferencia enviada → gasto');
  check(detectarDireccion('Operación 45201 registrada') === null, 'sin keywords → null (revisión)');
}

console.log('\n[3] limpiarDescripcion');
{
  const d1 = limpiarDescripcion(captura(BCP, 'BCP', 'Compraste S/ 25.50 en UBER *VIAJE LIMA PE'));
  check(!d1.includes('25.50') && !d1.includes('*'), 'quita monto y códigos *XXX');
  check(d1.toLowerCase().includes('uber'), 'conserva el comercio (UBER)');
  const d2 = limpiarDescripcion(captura(YAPE, 'Yape', 'Yapeaste S/ 10.00 a +51 987 654 321'));
  check(!d2.includes('+51'), 'quita teléfonos');
  const d3 = limpiarDescripcion(captura(BCP, 'BCP', 'Recibiste un Yape de S/ 20.00 de JUAN PEREZ'));
  check(d3.toUpperCase().includes('JUAN'), 'conserva el origen');
  const d4 = limpiarDescripcion(captura(BCP, 'BCP', ''));
  check(d4.length > 0, 'descripción vacía → texto por defecto');
}

console.log('\n[4] parsearCaptura (notificaciones reales)');
{
  const p1 = parsearCaptura(captura(BCP, 'BCP', 'Compraste S/ 25.50 en UBER *VIAJE LIMA PE'));
  check(p1 && p1.monto === 25.5 && p1.direccion === 'expense', 'BCP compra → gasto 25.5');
  const p2 = parsearCaptura(captura(YAPE, 'Yape', 'Recibiste un Yape de S/ 20.00 de MARIA LOPEZ'));
  check(p2 && p2.monto === 20 && p2.direccion === 'income', 'Yape recibido → ingreso 20');
  const p3 = parsearCaptura(captura('pe.com.interbank.mobilebanking', 'Interbank', 'Pagaste S/ 35.90 a MOVISTAR'));
  check(p3 && p3.monto === 35.9 && p3.direccion === 'expense', 'Interbank pago → gasto 35.9');
  check(parsearCaptura(captura(BCP, 'BCP', 'Operación 45201 registrada')) === null, 'sin monto → null (revisión)');
  check(parsearCaptura(captura(BCP, 'BCP', 'Compraste 25.50 en UBER')) === null, 'monto sin S/ → null (revisión)');
  const p6 = parsearCaptura(captura(BCP, 'BCP', 'Tu código BCP es 123456'));
  check(p6 === null, 'código de verificación → null');
}

console.log('\n[5] categoriaPara (diccionario F9 + tipos correctos)');
{
  const est = leerEstado();
  check(categoriaPara('expense', 'NETFLIX.COM 4023', est) === 'Entretenimiento', 'NETFLIX → Entretenimiento');
  check(categoriaPara('expense', 'S/ UBER *VIAJE', est) === 'Transporte', 'UBER → Transporte');
  check(categoriaPara('income', 'SUELNO ABONO PLANILLA', est) === 'Trabajo Principal', 'SUELDO → Trabajo Principal (ingreso)');
  check(categoriaPara('income', 'DEVOLUCION NETFLIX', est) === 'Ingresos Extra', 'ingreso con palabra de gasto → Ingresos Extra');
  check(categoriaPara('expense', 'YAPE A JUAN', est) === 'Transferencia', 'YAPE → Transferencia');
  check(categoriaPara('expense', 'XYZ 123', est) === 'Otros', 'desconocido → Otros');
}

console.log('\n[6] procesarCapturas · modo automático');
limpiar();
{
  const est = leerEstado();
  const prefs = prefsDePrueba();
  const r = procesarCapturas([
    captura(BCP, 'BCP', 'Compraste S/ 25.50 en UBER *VIAJE LIMA PE'),
    captura(YAPE, 'Yape', 'Recibiste un Yape de S/ 20.00 de MARIA LOPEZ'),
  ], est, prefs);

  check(r.creadas.length === 2, 'crea 2 transacciones');
  check(r.estado.transactions.length === 2, 'estado con 2 tx');
  const uber = r.creadas.find((c) => c.captura.title === 'BCP');
  check(uber && uber.tx.type === 'expense' && uber.tx.amount === 25.5, 'UBER: gasto 25.5');
  check(uber && uber.tx.account === 'bcp', 'BCP → cuenta bcp');
  check(uber && uber.tx.category === 'Transporte', 'UBER → Transporte');
  const yape = r.creadas.find((c) => c.captura.pkg === YAPE);
  check(yape && yape.tx.type === 'income' && yape.tx.amount === 20, 'Yape: ingreso 20');
  check(yape && yape.tx.account === 'yape', 'Yape → cuenta yape');
  check(r.log.filter((l) => l.estado === 'importada').length === 2, 'log con 2 importadas');
  check(r.prefs.ultimaRevisada > 0, 'ultimaRevisada avanzó');
}

console.log('\n[7] dedupe · id y contenido');
limpiar();
{
  const est = leerEstado();
  const prefs = prefsDePrueba();
  const c1 = captura(BCP, 'BCP', 'Compraste S/ 42.00 en PEDIDOSYA *CENA LIMA PE', tsBase);
  const r1 = procesarCapturas([c1], est, prefs);
  check(r1.creadas.length === 1, 'primera captura → 1 tx');

  // Mismo id (re-drenaje del buffer) → no duplica
  const r2 = procesarCapturas([c1], r1.estado, r1.prefs);
  check(r2.creadas.length === 0, 'misma captura (mismo id) → 0 nuevas');

  // Mismo contenido, id distinto (doble notificación de Android)
  const c2 = captura(BCP, 'BCP', 'Compraste S/ 42.00 en PEDIDOSYA *CENA LIMA PE', tsBase + 2000);
  const r3 = procesarCapturas([c2], r2.estado, r2.prefs);
  check(r3.creadas.length === 0, 'doble notificación (contenido igual <2min) → 0 nuevas');

  // App fuera de la allowlist → no procesa
  const r4 = procesarCapturas([
    captura('com.otra.app', 'Otro', 'Compraste S/ 99.00 en TIENDA'),
  ], r3.estado, r3.prefs);
  check(r4.creadas.length === 0, 'app fuera de allowlist → 0');

  // Captura apagada → no procesa y no marca vistos
  const prefsOff = prefsDePrueba({ activo: false });
  const r5 = procesarCapturas([captura(BCP, 'BCP', 'Compraste S/ 77.00 en OTRO LUGAR', tsBase + 9000)], r4.estado, prefsOff);
  check(r5.creadas.length === 0 && r5.enRevision === 0, 'captura desactivada → no toca nada');

  // Captura sin monto → cola de revisión
  const r6 = procesarCapturas([captura(BCP, 'BCP', 'Operación 45201 registrada', tsBase + 10000)], r4.estado, r4.prefs);
  check(r6.creadas.length === 0 && r6.enRevision === 1, 'sin monto → 1 en revisión');
  check(leerLogCaptura().some((l) => l.estado === 'revision'), 'log persiste la revisión');
}

console.log('\n[8] modo revisión + resolver/ignorar');
limpiar();
{
  const est = leerEstado();
  const prefs = prefsDePrueba({ modo: 'revision' });
  const r1 = procesarCapturas([
    captura(BCP, 'BCP', 'Compraste S/ 12.90 en TOTTUS LIMA'),
  ], est, prefs);
  check(r1.creadas.length === 0 && r1.enRevision === 1, 'modo revisión → no crea directo');
  const logR = leerLogCaptura().find((l) => l.estado === 'revision');
  check(logR && logR.parse && logR.parse.monto === 12.9 && logR.parse.categoria === 'Alimentación', 'revisión con parse listo (TOTTUS → Alimentación)');

  const r2 = resolverRevisionComoImportada(logR.id, r1.estado);
  check(r2.ok && r2.estado.transactions.length === 1, 'resolver → crea la tx');
  const tx = r2.estado.transactions[0];
  check(tx.account === 'bcp' && tx.amount === 12.9 && tx.category === 'Alimentación', 'tx resuelta con datos correctos');

  const r3 = procesarCapturas([captura(YAPE, 'Yape', 'Recibiste un Yape de S/ 5.00 de PRUEBA', tsBase + 5000)], r2.estado, prefs);
  const logR2 = leerLogCaptura().find((l) => l.estado === 'revision' && l.text.includes('5.00'));
  check(!!logR2, 'segunda captura en revisión');
  if (logR2) {
    ignorarRevision(logR2.id);
    check(leerLogCaptura().find((l) => l.id === logR2.id)?.estado === 'ignorada', 'ignorar → marca ignorada');
  }
  check(leerLogCaptura().find((l) => l.id === logR.id)?.estado === 'importada', 'la primera sigue importada');
}

console.log('\n[9] calcularSaldoVivo');
{
  const est: EstadoWallet = {
    ...leerEstado(),
    transactions: [] as Transaccion[],
  };
  const desde = '2026-09-01';
  const t = (id: string, date: string, type: 'income' | 'expense', amount: number, account: string): Transaccion => ({
    id, date, type, category: 'Otros', amount, description: 'test', account,
  });
  est.transactions = [
    t('1', '2026-08-31', 'income', 9999, 'bcp'),   // antes del corte → no cuenta
    t('2', '2026-09-01', 'income', 500, 'bcp'),    // cuenta
    t('3', '2026-09-02', 'expense', 150.5, 'bcp'), // cuenta
    t('4', '2026-09-03', 'income', 300, 'yape'),   // otra cuenta → no cuenta
    t('5', '2026-09-04', 'expense', 50, 'efectivo'), // otra cuenta → no cuenta
  ];
  const sv = { cuenta: 'bcp', saldoInicial: 1000, desde };
  check(calcularSaldoVivo(est, sv) === 1349.5, '1000 + 500 − 150.5 = 1349.5');
  const sv2 = { cuenta: 'bcp', saldoInicial: 0, desde: '2026-08-01' };
  check(calcularSaldoVivo(est, sv2) === 10348.5, 'desde agosto incluye la del 31 (9999+500-150.5)');
  const sv3 = { cuenta: 'yape', saldoInicial: 100, desde };
  check(calcularSaldoVivo(est, sv3) === 400, 'cuenta yape: 100 + 300 = 400');
  const sv4 = { cuenta: 'bcp', saldoInicial: 100, desde: '2027-01-01' };
  check(calcularSaldoVivo(est, sv4) === 100, 'fecha futura → solo el inicial');
}

console.log('\n[10] prefs · defaults y round-trip');
limpiar();
{
  const d = leerPrefsCaptura();
  check(d.activo === false && d.modo === 'auto' && d.packages.length === 0, 'defaults: off · auto · sin apps');
  const custom = prefsDePrueba({ modo: 'revision', packages: ['com.x.y'], saldoVivo: { activo: true, cuenta: 'bcp', saldoInicial: 250, desde: '2026-09-15' } });
  guardarPrefsCaptura(custom);
  const leido = leerPrefsCaptura();
  check(leido.activo && leido.modo === 'revision' && leido.packages[0] === 'com.x.y', 'round-trip de prefs');
  check(leido.saldoVivo && leido.saldoVivo.saldoInicial === 250 && leido.saldoVivo.cuenta === 'bcp', 'round-trip del saldo vivo');
  // Cap de vistos
  const muchos = {};
  for (let i = 0; i < 500; i++) muchos[`pkg@${i}`] = i;
  guardarPrefsCaptura({ ...leido, vistos: muchos });
  check(Object.keys(leerPrefsCaptura().vistos).length <= 300, 'vistos con cap 300');
}

console.log('\n[11] mensajeCapturas + cuentaPorDefecto');
{
  const t = (type: 'income' | 'expense', amount: number, description: string): Transaccion => ({
    id: 'x', date: '2026-09-15', type, category: 'Otros', amount, description,
  });
  check(mensajeCapturas([{ tx: t('expense', 25.5, 'UBER VIAJE') }], 0).includes('UBER'), 'toast de 1 captura con descripción');
  check(mensajeCapturas([], 2).includes('revisar'), 'toast de revisión');
  check(cuentaPorDefecto(BCP) === 'bcp', 'BCP → bcp');
  check(cuentaPorDefecto(YAPE) === 'yape', 'Yape → yape');
  check(cuentaPorDefecto('com.otra') === 'efectivo', 'desconocida → efectivo');
}

console.log('\n[12] guard · sugerencias del diccionario válidas por tipo');
{
  const gastos = new Set([
    ...CATS_GASTO_DEFAULT.map((c) => c.nombre),
    'Transferencia',
  ]);
  const ingresos = new Set(CATS_INGRESO_DEFAULT.map((c) => c.nombre));
  const faltantesGasto = [...new Set(Object.values(DICCIONARIO_CATEGORIAS))].filter((v) => !gastos.has(v) && !ingresos.has(v));
  check(faltantesGasto.length === 0, `toda sugerencia existe en gasto o ingreso (${faltantesGasto.join(', ') || 'ok'})`);
}

console.log('\n[13] guarda Yape↔banco · doble aviso del mismo pago por 2 apps');
limpiar();
{
  const est = leerEstado();
  const prefs = prefsDePrueba();
  const T = Date.now() - 600_000;

  // Pagaste con Yape: la app Yape avisa primero
  const r1 = procesarCapturas([captura(YAPE, 'Yape', 'Yapeaste S/ 25.00 a TIENDA X', T)], est, prefs);
  check(r1.creadas.length === 1, 'aviso de la app Yape → 1 tx');

  // 40s después la app del banco avisa el MISMO pago (otro texto, otra app)
  const r2 = procesarCapturas([captura(BCP, 'BCP', 'Pago con Yape S/ 25.00', T + 40_000)], r1.estado, r1.prefs);
  check(r2.creadas.length === 0 && r2.enRevision === 1, 'mismo monto+dirección de otra app <3min → a revisión (no duplica)');
  const enRev = leerLogCaptura().find((l) => l.estado === 'revision' && !!l.nota);
  check(!!enRev && enRev.nota.includes('Yape'), 'la revisión trae la nota que nombra a la otra app');

  // ¿Eran pagos distintos? El usuario toca Registrar → crea la 2da tx
  const r3 = enRev ? resolverRevisionComoImportada(enRev.id, r2.estado) : { ok: false, estado: r2.estado };
  check(r3.ok && r3.estado.transactions.length === 2, 'registrar la revisión → 2da tx (pagos distintos)');

  // A más de 3 min de distancia ya NO se sospecha → se registra normal
  const prefs2 = prefsDePrueba();
  const r4 = procesarCapturas([
    captura(YAPE, 'Yape', 'Yapeaste S/ 25.00 a OTRA TIENDA', T + 10 * 60_000),
  ], est, prefs2);
  check(r4.creadas.length === 1, 'aviso de otra app a >3 min → se registra normal');

  // Las dos notificaciones llegan JUNTAS en el mismo drenaje (app cerrada)
  limpiar();
  const r5 = procesarCapturas([
    captura(YAPE, 'Yape', 'Yapeaste S/ 15.00 a CAFETERIA LOCA', T),
    captura(BCP, 'BCP', 'Pago con Yape S/ 15.00', T + 30_000),
  ], leerEstado(), prefsDePrueba());
  check(r5.creadas.length === 1 && r5.enRevision === 1, 'mismo lote: 1 importada + 1 en revisión con nota');
}

// Resumen
console.log(`\n══════════════════════════════════════════════`);
console.log(`SMOKE F10: ${ok} OK · ${fail} FAIL`);
console.log(`══════════════════════════════════════════════`);
if (fail > 0) {
  console.error('❌ HAY FALLOS — revisar arriba');
  process.exit(1);
}
console.log('✅ Todos los smoke tests F10 pasaron');
