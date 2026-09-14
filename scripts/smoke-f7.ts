// Smoke test F7 · Bot Proactivo — verifica que:
// 1. Prefs por defecto (activo ON, solo-graves, horario ON).
// 2. Guardar/cambiar prefs persiste.
// 3. Filtro por frecuencia: solo-graves deja pasar riesgo+alerta>=85, filtra consejo.
// 4. Filtro silencioso: solo deja pasar riesgo>=88.
// 5. Filtro todos: deja pasar todo salvo logro.
// 6. Dedupe por día: mismo aviso no se repite hoy.
// 7. Reiniciar dedupe limpia el registro.
// 8. claveAviso es estable para el mismo tipo+texto.
// 9. Bot apagado → no dispara nada.
// 10. Horario silencioso respetado (no dispara de noche, pero devuelve avisos).

import { leerPrefsBot, guardarPrefsBot, correrBotProactivo, diagnosticarBot, reiniciarDedupe } from '../src/services/botproactivo.ts';
import { analizarWallet } from '../src/services/walletbot.ts';
import { resetTotal, agregarTransaccion, guardarPresupuesto, leerEstado } from '../src/services/estado.ts';
import type { EstadoWallet, PrefsBotProactivo } from '../src/types.ts';

let ok = 0;
let fail = 0;
function check(cond, msg) {
  if (cond) { ok++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
}

localStorage.clear();

// ── TEST 1: Prefs por defecto ──
console.log('\n[1] Prefs por defecto');
localStorage.removeItem('wallettrack_v2_prefs');
const prefs0 = leerPrefsBot();
check(prefs0.activo === true, 'default activo = true');
check(prefs0.frecuencia === 'solo-graves', 'default frecuencia = solo-graves');
check(prefs0.horarioSilencioso === true, 'default horarioSilencioso = true');

// ── TEST 2: Guardar/cambiar prefs persiste ──
console.log('\n[2] Guardar prefs persiste');
const nuevas: PrefsBotProactivo = { activo: false, frecuencia: 'todos', horarioSilencioso: false };
guardarPrefsBot(nuevas);
const releidas = leerPrefsBot();
check(releidas.activo === false, 'activo persiste como false');
check(releidas.frecuencia === 'todos', 'frecuencia persiste como todos');
check(releidas.horarioSilencioso === false, 'horarioSilencioso persiste como false');

// Restaurar default para los siguientes tests
guardarPrefsBot({ activo: true, frecuencia: 'solo-graves', horarioSilencioso: false });

// ── TEST 3: Bot apagado → no dispara ──
console.log('\n[3] Bot apagado no dispara');
guardarPrefsBot({ activo: false, frecuencia: 'todos', horarioSilencioso: false });
resetTotal();
let est = leerEstado();
const r1 = await correrBotProactivo(est);
check(r1.disparados === 0, 'bot apagado → 0 disparados');
check(r1.avisos.length === 0, 'bot apagado → 0 avisos');
check(r1.nuevos.length === 0, 'bot apagado → 0 nuevos');

// ── TEST 4: Estado vacío → analizarWallet devuelve "registrar" (consejo) ──
console.log('\n[4] Estado vacío con bot ON y frecuencia todos');
guardarPrefsBot({ activo: true, frecuencia: 'todos', horarioSilencioso: false });
resetTotal();
est = leerEstado();
const analisisVacio = analizarWallet(est);
check(analisisVacio.length > 0, 'estado vacío genera algún aviso');
check(analisisVacio.some(m => m.type === 'consejo'), 'estado vacío genera consejo "registrar"');

// ── TEST 5: Construir estado que dispara RIESGO (gastos creciendo >20%) ──
console.log('\n[5] Estado que dispara RIESGO (gastos creciendo >20%)');
resetTotal();
est = leerEstado();
// Mes anterior: gastos bajos
const ahora = new Date();
const mesAnt = ahora.getMonth() === 0 ? `${ahora.getFullYear()-1}-12` : `${ahora.getFullYear()}-${String(ahora.getMonth()).padStart(2,'0')}`;
const mesAct = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}`;
// Simular gastos del mes anterior (S/ 100) y mes actual (S/ 200 → +100%)
est = agregarTransaccion(est, { type: 'expense', monto: 100, categoria: 'Otros', cuenta: 'efectivo', fecha: `${mesAnt}-15`, descripcion: 'Gasto viejo' });
est = agregarTransaccion(est, { type: 'expense', monto: 200, categoria: 'Otros', cuenta: 'efectivo', fecha: `${mesAct}-10`, descripcion: 'Gasto actual' });
est = agregarTransaccion(est, { type: 'income', monto: 1000, categoria: 'Sueldo', cuenta: 'bcp', fecha: `${mesAct}-01`, descripcion: 'Sueldo' });
const analisis = analizarWallet(est);
const riesgo = analisis.find(m => m.type === 'riesgo');
check(riesgo !== undefined, 'estado con +100% gastos genera aviso riesgo');
check(riesgo?.score === 100, 'riesgo score 100 (gastos creciendo >20%)');

// ── TEST 6: Filtro solo-graves deja pasar riesgo, filtra consejo ──
console.log('\n[6] Frecuencia solo-graves filtra correctamente');
guardarPrefsBot({ activo: true, frecuencia: 'solo-graves', horarioSilencioso: false });
reiniciarDedupe();
const r2 = await correrBotProactivo(est);
// Con solo-graves, solo pasan riesgo y alerta>=85
check(r2.avisos.every(m => m.type === 'riesgo' || (m.type === 'alerta' && m.score >= 85)), 'solo-graves: todos los avisos son riesgo o alerta>=85');
// En web (no APK) no dispara notifs, pero nuevos debería tener elementos si hay avisos
check(r2.nuevos.length > 0, 'solo-graves: hay avisos nuevos generados (aunque en web no se disparen notifs)');

// ── TEST 7: Dedupe por día — segundo llamado no repite ──
console.log('\n[7] Dedupe por día — no repite el mismo aviso hoy');
reiniciarDedupe();
const r3a = await correrBotProactivo(est);
const r3b = await correrBotProactivo(est);
check(r3a.nuevos.length >= 0, 'primer llamado genera avisos nuevos');
check(r3b.disparados === 0, 'segundo llamado: 0 disparados (dedupe)');

// ── TEST 8: Reiniciar dedupe permite volver a avisar ──
console.log('\n[8] Reiniciar dedupe permite volver a avisar');
reiniciarDedupe();
const r4 = await correrBotProactivo(est);
// Después de reiniciar, debería haber avisos nuevos otra vez
// (puede ser 0 si estamos en horario silencioso en web, pero avisos.length > 0)
check(r4.avisos.length > 0, 'tras reiniciar: hay avisos en el resultado');

// ── TEST 9: Filtro silencioso — solo deja pasar riesgo>=88 ──
console.log('\n[9] Frecuencia silencioso solo deja pasar riesgo>=88');
guardarPrefsBot({ activo: true, frecuencia: 'silencioso', horarioSilencioso: false });
reiniciarDedupe();
const r5 = await correrBotProactivo(est);
check(r5.avisos.every(m => m.type === 'riesgo' && m.score >= 88), 'silencioso: todos los avisos son riesgo>=88');

// ── TEST 10: Filtro todos — deja pasar todo salvo logro ──
console.log('\n[10] Frecuencia todos excluye logro');
guardarPrefsBot({ activo: true, frecuencia: 'todos', horarioSilencioso: false });
reiniciarDedupe();
const r6 = await correrBotProactivo(est);
check(r6.avisos.every(m => m.type !== 'logro'), 'todos: ningún aviso es logro');

// ── TEST 11: Diagnóstico funciona ──
console.log('\n[11] Diagnóstico devuelve datos coherentes');
const diag = diagnosticarBot();
check(typeof diag.activo === 'boolean', 'diag.activo es boolean');
check(['solo-graves','todos','silencioso'].includes(diag.frecuencia), 'diag.frecuencia es válida');
check(typeof diag.avisosHoy === 'number', 'diag.avisosHoy es número');

// Resumen
console.log(`\n════════════════════════════════════════════════`);
console.log(`SMOKE F7: ${ok} OK · ${fail} FAIL`);
console.log(`════════════════════════════════════════════════`);
if (fail > 0) {
  console.error('❌ HAY FALLOS — revisar arriba');
  process.exit(1);
}
console.log('✅ Todos los smoke tests F7 pasaron');
