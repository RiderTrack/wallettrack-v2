// Smoke test F6 · Comprobantes — verifica que:
// 1. Las tx sin comprobante siguen funcionando igual (compat retro).
// 2. Las tx con comprobanteLocal se persisten y leen bien.
// 3. Las tx con comprobanteUrl se persisten y leen bien.
// 4. Respaldo viejo (sin campos F6) sigue importando sin romper.
// 5. La cola offline persiste tras recarga.
// 6. eliminarTransaccion no toca el archivo Storage (eso lo hace App).
// 7. obtenerTransaccion funciona.
// 8. La regla de Storage tiene la forma correcta.
// 9. Respaldo JSON incluye comprobantes.

import { leerEstado, agregarTransaccion, eliminarTransaccion, obtenerTransaccion, exportarRespaldo, importarRespaldo, resetTotal, persistir } from '../src/services/estado.ts';
import { encolarComprobante, desencolar, pendientesCola, REGLA_STORAGE_WALLETTRACK } from '../src/services/comprobantes.ts';

let ok = 0;
let fail = 0;
function check(cond, msg) {
  if (cond) { ok++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
}

// Limpiar estado previo
localStorage.clear();

// ── TEST 1: tx sin comprobante (compat retro) ──
console.log('\n[1] Tx sin comprobante (compatibilidad retro)');
resetTotal();
let est = leerEstado();
const tx1 = agregarTransaccion(est, {
  type: 'expense', monto: 50, categoria: 'Alimentación',
  cuenta: 'efectivo', fecha: '2026-09-14', descripcion: 'Sin foto',
});
check(tx1.transactions[0].comprobanteLocal === undefined, 'tx sin comprobante no tiene comprobanteLocal');
check(tx1.transactions[0].comprobanteUrl === undefined, 'tx sin comprobante no tiene comprobanteUrl');

// ── TEST 2: tx con comprobanteLocal ──
console.log('\n[2] Tx con comprobanteLocal (foto recién capturada, pendiente de subir)');
const dataUrlFake = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////wAA';
const tx2 = agregarTransaccion(tx1, {
  type: 'expense', monto: 100, categoria: 'Transporte',
  cuenta: 'bcp', fecha: '2026-09-14', descripcion: 'Con foto',
  comprobanteLocal: dataUrlFake,
});
check(tx2.transactions[0].comprobanteLocal === dataUrlFake, 'tx con comprobanteLocal lo guarda');
check(tx2.transactions[0].comprobanteUrl === undefined, 'tx nueva no tiene URL todavía');

// ── TEST 3: persistir y releer ──
console.log('\n[3] Persistir + releer (localStorage round-trip)');
persistir(tx2);
const releido = leerEstado();
const tGuardada = releido.transactions.find(t => t.description === 'Con foto');
check(tGuardada?.comprobanteLocal === dataUrlFake, 'comprobanteLocal sobrevive persist/leer');
check(tGuardada?.id === tx2.transactions[0].id, 'id de la tx conservado');

// ── TEST 4: respaldo viejo (sin campos F6) sigue importando ──
console.log('\n[4] Respaldo viejo (sin campos F6) importa sin romper');
const respaldoViejo = {
  version: '3.0',
  fecha: '2026-09-14',
  transactions: [
    { id: '1700000000000', date: '2026-09-13', type: 'expense', category: 'Alimentación', amount: 25, description: 'Pan', account: 'efectivo' },
    { id: '1700000000001', date: '2026-09-13', type: 'income', category: 'Sueldo', amount: 1500, description: 'Sueldo', account: 'bcp' },
  ],
  goals: [], subscriptions: [], challenges: [], saldosIniciales: {}, cardCustom: {}, budgets: [],
  categoriasGasto: [], categoriasIngreso: [], sobres: [], sobreMovs: [], deudas: [], deudaMovs: [],
  productos: [], listaCompras: { items: [], creada: null }, comprasHist: [], gastosRapidos: [],
};
const r = importarRespaldo(leerEstado(), JSON.stringify(respaldoViejo));
check(r.ok, 'respaldo viejo importa OK');
check(r.estado.transactions.length === 2, 'trae las 2 tx del respaldo viejo');
check(r.estado.transactions[0].comprobanteLocal === undefined, 'tx del viejo no tiene comprobanteLocal');
check(r.estado.transactions[0].comprobanteUrl === undefined, 'tx del viejo no tiene comprobanteUrl');

// ── TEST 5: cola offline persiste ──
console.log('\n[5] Cola offline persiste en localStorage');
localStorage.removeItem('WT2_COLA_COMP');
encolarComprobante('uid-test', 'tx-con-foto', dataUrlFake);
encolarComprobante('uid-test', 'tx-otra', dataUrlFake);
check(pendientesCola() === 2, 'cola tiene 2 pendientes tras encolar 2');
// dedupe: encolar mismo txId reemplaza
encolarComprobante('uid-test', 'tx-con-foto', 'data:image/jpeg;base64,OTRA');
check(pendientesCola() === 2, 'cola sigue en 2 tras re-encolar mismo txId (dedupe)');
desencolar('tx-otra');
check(pendientesCola() === 1, 'cola baja a 1 tras desencolar');

// ── TEST 6: eliminar tx no rompe (App llama a limpiar aparte) ──
console.log('\n[6] eliminarTransaccion solo saca del estado (Storage se limpia aparte)');
persistir(tx2);
const antes = leerEstado().transactions.length;
const eliminado = eliminarTransaccion(leerEstado(), tx2.transactions[0].id);
const despues = eliminado.transactions.length;
check(despues === antes - 1, 'eliminarTransaccion reduce la cuenta en 1');

// ── TEST 7: obtenerTransaccion ──
console.log('\n[7] obtenerTransaccion encuentra la tx por id');
const found = obtenerTransaccion(tx2, tx2.transactions[0].id);
check(found?.id === tx2.transactions[0].id, 'obtenerTransaccion devuelve la tx correcta');
const notFound = obtenerTransaccion(tx2, 'id-inexistente');
check(notFound === undefined, 'obtenerTransaccion devuelve undefined si no existe');

// ── TEST 8: regla de Storage tiene la forma correcta ──
console.log('\n[8] Regla de Storage para Firebase Console');
check(REGLA_STORAGE_WALLETTRACK.includes('wallettrack_comprobantes/{uid}/{fileName}'), 'regla menciona el path correcto');
check(REGLA_STORAGE_WALLETTRACK.includes('request.auth != null'), 'regla exige auth');
check(REGLA_STORAGE_WALLETTRACK.includes('request.auth.uid == uid'), 'regla valida uid');

// ── TEST 9: respaldo JSON incluye comprobantes ──
console.log('\n[9] Export de respaldo incluye los campos F6');
const exportado = exportarRespaldo(tx2);
const re = JSON.parse(exportado);
const txExport = re.transactions.find(t => t.description === 'Con foto');
check(txExport?.comprobanteLocal === dataUrlFake, 'comprobanteLocal viaja en el respaldo JSON');

// Resumen
console.log(`\n════════════════════════════════════════════════`);
console.log(`SMOKE F6: ${ok} OK · ${fail} FAIL`);
console.log(`════════════════════════════════════════════════`);
if (fail > 0) {
  console.error('❌ HAY FALLOS — revisar arriba');
  process.exit(1);
}
console.log('✅ Todos los smoke tests F6 pasaron');
