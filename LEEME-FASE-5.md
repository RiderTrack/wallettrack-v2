# 📦 LEEME — FASE 5 · SEGURIDAD + CONVENIENCIA
## WalletTrack V2 · versionCode 7 · versionName 1.5.0 · APK `WalletTrack-V2-F5.apk`

---

## ⚡ LO MÁS IMPORTANTE PRIMERO: por qué "no salía" tu sincronización

Tu app y tu login Google están BIEN (el fix F1.1 funciona). El problema está en la
**Firebase Console del proyecto `fittrack-e06be`**: las reglas de Firestore cubren
`fittrack_sync`, `fittrack_usuarios` y `gymchats`… pero **NO tienen la colección
`wallettrack_sync`** → Firestore la rechaza en silencio (default deny) y la nube
nunca baja ni sube.

### El arreglo (5 minutos, una sola vez):

1. Entrá a **https://console.firebase.google.com** → proyecto **fittrack-e06be**
2. Menú lateral: **Firestore Database** → pestaña **Reglas**
3. Vas a ver algo como `match /databases/{database}/documents { ... }` con tus reglas
   del FitTrack adentro. **NO borres nada** — solo AGREGÁ este bloque adentro, junto a
   los demás `match`:

```
    match /wallettrack_sync/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
```

4. Apretá **Publicar**. Listo — ya podés abrir WalletTrack → Ajustes → Sincronizar ahora.

> Ejemplo de cómo queda (si tus reglas actuales son las del borrador del FitTrack):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /fittrack_usuarios/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /gymchats/{codigo}/mensajes/{mensajeId} {
      allow read, create: if request.auth != null;
    }
    match /fittrack_sync/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    // 👇 EL BLOQUE NUEVO (WalletTrack V2)
    match /wallettrack_sync/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

### Y para que nunca más adivines: 🩺 Diagnosticar
En **Ajustes → Cuenta y Sincronización** ahora hay un botón **"Diagnosticar
sincronización"**: revisa sesión, internet, Firebase, lectura de tu documento y la
ronda completa — y si el problema son las reglas, **te muestra el bloque exacto con
botón de copiar** para pegarlo en la consola.

---

## 🆕 Qué trae la FASE 5

### 🔒 A · Candado local (PIN + huella)
- **Ajustes → Candado de la app → Activar candado**: PIN de 4 dígitos.
- La app **arranca bloqueada** y **se vuelve a bloquear sola** cuando la mandás al
  fondo (como las apps de banco). Nada se ve detrás de la pantalla de bloqueo.
- **Huella**: con PIN activo, el toggle "Desbloqueo con huella" (solo APK, si tu
  equipo tiene huella configurada). Si la huella falla o la cancelás, el PIN siempre
  queda de respaldo — nunca te quedás afuera.
- Teclado con vibración, mensaje de intentos fallidos.
- El PIN es **local de cada aparato** (como el theme del viejo): NO viaja a la nube y
  el "Reiniciar todo a cero" NO lo borra. Si lo olvidás… borrá datos de la app o
  reinstalá (tus datos vuelven solos de la nube si tenés sesión).

### 🔔 B · Recordatorios de vencimientos
- **Gastos fijos y cuotas de deudas ahora suenan**: notificación 3 días antes y el
  mismo día del pago, 9:00 a.m., aunque la app esté cerrada (solo APK).
- Se re-agendan solos cada vez que creás/pagás/borrás un fijo o deuda (o baja la nube).
- **Ajustes → Recordatorios**: ON/OFF + botón **Probar notificación** (suena en 6 s).
- La primera vez que abrás la APK, Android te va a preguntar si permitís
  notificaciones (Android 13+) — aceptalas para que funcione. En web no hay notificaciones.

### 🔁 C1 · Sueldos y fijos programados (¡se registran solos!)
- **Historial → arriba: "Movimientos Programados" → Programar sueldo o gasto fijo**.
- Ej: `Sueldo RiderTrack · S/ 300 · cada semana · RiderTrack · Efectivo`.
- La app registra **sola** cada ocurrencia al abrir (incluidas las atrasadas, con su
  fecha real). Las transacciones salen marcadas `🔁 nombre (programado)`.
- **Nunca se duplican**: ids deterministas — recargar mil veces o sincronizar dos
  teléfonos no repite nada (el sync las deduplica entre equipos).
- Pausar ▷/⏸, "Registrar" manual y eliminar con confirmación.

### 🎨 C2 · Categorías y cuentas propias
- **Categorías**: en el modal de ingreso/gasto → **"+ Nueva categoría"** (nombre +
  emoji). Quedan para siempre, aparecen en presupuestos e historial, y viajan a tu
  nube. (Se guardan en las claves que el viejo ya traía reservadas.)
- **Cuentas**: en Mis Cuentas → tarjeta punteada **"+ Nueva cuenta"** (nombre, banco/
  billetera/efectivo, emoji, color). Cuenta en el patrimonio, strips, selects de
  transferencias, suscripciones, deudas, compras y export Excel/PDF. Se quitan con el
  tacho (los movimientos quedan en el historial).

### 🧹 Extras de robustez
- Errores del sync ahora muestran el **código real** (permission-denied, etc.).
- Mensaje específico si Firestore no está inicializado en el proyecto.
- `importarRespaldo`/respaldo JSON v3.0 ahora incluyen cuentas propias y recurrentes
  (los backups F4 anteriores siguen importando igual, sin tocar tus custom).

---

## 🔢 Changelog técnico (archivo → qué cambió)

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `src/types.ts` | +`SeguridadWallet`, +`Recurrente`, EstadoWallet +`cuentasCustom`/`recurrentes`, RespaldoWallet ídem |
| 2 | `src/data/catalogos.ts` | +`todasLasCuentas()`, +`nombreCuenta()`, +`EMOJIS_NUEVA`, +`COLORES_CUENTA` |
| 3 | `src/services/estado.ts` | +claves `wallettrack_cuentas_custom`/`wallettrack_recurrentes` · leer/persistir/reset/export/import con los 2 campos · +`crearCategoria` · +`crearCuentaCustom`/`eliminarCuentaCustom` · +`crearRecurrente`/`eliminarRecurrente`/`toggleRecurrente`/`siguienteOcurrenciaISO` (mensual clampea fin de mes)/`proximaFechaRecurrente`/`aplicarRecurrentesPendientes` (ids `autorec_` deterministas) · `saldoTotal`/transferencias usan todas las cuentas |
| 4 | `src/services/sync.ts` | `combinarEstados` +union de cuentasCustom y recurrentes (payloads F4 sin campos → sin riesgo) · errores con código crudo (`codigoError`) + mensajes causa-exacta |
| 5 | `src/services/seguridad.ts` **(NUEVO)** | PIN (hash djb2+sal, clave `wallettrack_security` del viejo), huella vía `@capgo/capacitor-native-biometric` con fallback total a PIN, vibración |
| 6 | `src/services/recordatorios.ts` **(NUEVO)** | `@capacitor/local-notifications`: agenda 3-días-antes + día-del-vencimiento 9:00, re-programación idempotente, probar notificación, prefs ON/OFF (`wallettrack_v2_prefs`) |
| 7 | `src/components/BloqueoScreen.tsx` **(NUEVO)** | Teclado 4 dígitos con puntos/vibración/intentos, huella automática al abrir, cero render detrás |
| 8 | `src/components/RecurrentesCard.tsx` **(NUEVO)** | Tarjeta colapsable en Historial: lista + form + pausar + registrar ahora + eliminar |
| 9 | `src/App.tsx` | Gate `BloqueoScreen` al arrancar y al ir al fondo (appStateChange) · catch-up de recurrentes al abrir y tras bajar la nube · re-agenda de recordatorios al cambiar fijos/deudas · `onAplicar` a Historial/Cuentas · `onCrearCategoria` al modal · badge F5 |
| 10 | `src/components/ModalTransaccion.tsx` | "+ Nueva categoría" (nombre+emoji, autoselección) · cuentas custom en el select |
| 11 | `src/components/ConfiguracionView.tsx` | 🩺 Diagnóstico del sync con regla Firestore copiable · tarjeta Candado (activar/cambiar/quitar PIN + huella) · tarjeta Recordatorios (ON/OFF + probar) · roadmap F5 ✓ |
| 12 | `src/components/HistorialView.tsx` | +`RecurrentesCard` arriba · cuentas custom en nombres |
| 13 | `src/components/CuentasView.tsx` | todas las vistas de cuentas usan custom · "+ Nueva cuenta" (form completo) · tacho de borrado con confirmación · saldos iniciales incluyen custom |
| 14 | `src/components/DashboardView.tsx` | Strip Mis Cuentas incluye custom |
| 15 | `src/components/SuscripcionesView.tsx` | Cuenta del fijo resuelve custom · select con custom |
| 16 | `src/components/DeudasView.tsx` | Ídem deudas/cuotas |
| 17 | `src/components/ComprasView.tsx` | Ídem cierre de compras |
| 18 | `src/services/exportar.ts` | Excel (nombres + hoja de saldos) y PDF con cuentas custom |
| 19 | `src/services/platform.ts` | `versionApp() → 'F5 · Candado + Recordatorios'` |
| 20 | `package.json` | +`@capacitor/local-notifications@^6.1.0` +`@capgo/capacitor-native-biometric@^6.0.4` |
| 21 | `.github/workflows/build.yml` | versionCode 7 · versionName 1.5.0 · `WalletTrack-V2-F5.apk` (login Google, google-services y SHA-1 intactos) |

**Nuevos deps**: 2 plugins oficiales/Cap-6. El CI ya corre `cap sync` → se registran solos.

---

## 📲 Instalación

1. **Subí a GitHub** los 22 archivos (18 modificados + 4 nuevos: `BloqueoScreen.tsx`,
   `RecurrentesCard.tsx`, `seguridad.ts`, `recordatorios.ts`) — misma estructura de
   carpetas. (El zip ya viene armado así: descomprimilo DENTRO del repo y subí todo.)
2. Dejá que el CI arme la **WalletTrack-V2-F5.apk** (versionCode 7 — instala encima,
   tus datos quedan intactos).
3. Instalá la APK y hacé **LA REGLA DE FIRESTORE** de arriba (una sola vez).
4. Probá según la lista de abajo.

---

## ✅ Qué verificar después de instalar (en orden)

1. **Badge**: header dice `F5 · SEGURIDAD` y Ajustes → versión `F5 · Candado + Recordatorios`.
2. **Candado**: Ajustes → Candado de la app → Activar → PIN `1234` dos veces → Guardar.
   Cerrá la app y abrila de nuevo → **tiene que pedir el PIN**. Probá mal una vez
   (dice "intento fallido") y bien → entra.
3. **Huella** (si tu equipo tiene): Candado activo → toggle ON → al reabrir aparece
   el diálogo de huella → cancelalo y entrá con PIN (nunca te bloquea).
4. **Sync** 🩺: entrá con tu Google → Ajustes → Sincronizar ahora → si falla,
   **Diagnosticar sincronización** → te va a decir la causa y (si son las reglas) el
   bloque para copiar → pégalo en Firebase Console → Publicar → Sincronizar ahora →
   **"Sincronizado con la nube ✓"** y subida/bajada con fecha.
5. **Recordatorios**: Ajustes → Recordatorios → Probar notificación → aceptá el
   permiso la primera vez → a los 6 segundos suena la campanita.
6. **Sueldo programado**: Historial → Movimientos Programados → Programar →
   "Sueldo RiderTrack", S/ 300, cada semana, hoy → Programar → toast "creado y 1
   registro automático" y aparece la transacción `🔁 Sueldo RiderTrack (programado)`.
   Cerrá y abrila la app → NO se duplica.
7. **Categoría propia**: + Gasto → "+ Nueva categoría" → "Delivery" → Crear → queda
   seleccionada → guardá el gasto → en Historial el filtro la muestra.
8. **Cuenta propia**: Mis Cuentas → + Nueva cuenta → "Caja Chica", efectivo → Crear
   → aparece su tarjeta → ponele saldo inicial → suma al patrimonio.
9. **Todo lo anterior sigue igual**: sobres, deudas, presupuestos, metas, compras,
   estadísticas, WalletBot, Theme Studio, export Excel/PDF.

---

## 🧪 Validación hecha antes de entregar

- `tsc --noEmit`: **0 errores** · `vite build`: **OK 10.8s** (mismos chunks lazy de Excel/PDF).
- **Smoke F5: 84/84 ×3 corridas** (PIN hash/verificación/cambio/quite, reset no borra
  candado, categorías duplicadas, cuentas en patrimonio, fechas semanal/quincenal/
  mensual-con-fin-de-mes, catch-up idempotente, dedupe entre teléfonos, respaldo
  round-trip, F4-import conserva custom, cableado de test-ids, CI 7/1.5.0).
- **E2E real en navegador**: modo local → candado activado → recarga → bloqueo con
  PIN → PIN mal rechazado → PIN bien entra → recurrente creado con transacción de
  HOY automática → categoría Delivery creada y autoseleccionada → cuenta Caja Chica
  con tarjeta → diagnóstico corre → **0 errores de consola**.

---

## 🔐 Seguridad
- Cero secretos en los archivos (la API key de Firebase es la pública de siempre, ya estaba en F1).
- El PIN se guarda hasheado (djb2 con sal) en la clave local del viejo.
- **Rotá tu token de GitHub** cuando terminemos la ronda (ya viajó por el chat).
