# F10 · 🔔 Captura Automática — LEEME

> **WalletTrack V2 · versionCode 13 · versionName 1.10.0 · APK: `WalletTrack-V2-F10.apk`**
>
> El lector de notificaciones bancarias: cada aviso de compra o abono del BCP / Yape /
> Interbank / BBVA / Scotiabank se convierte en transacción en segundos, solo.

---

## ¿Qué hace?

1. **Activás la Captura Automática** en Ajustes (una sola vez): elegís de qué apps leer
   los avisos (BCP y Yape vienen pre-elegidos) y le das el permiso especial de Android
   *Acceso a notificaciones* a WalletTrack.
2. **Cada vez que el banco te avisa algo** ("Compraste S/ 25.50 en UBER…"), la app:
   - Extrae el **monto** (solo si tiene S/ o USD — los códigos y fechas no se confunden).
   - Detecta si es **gasto o ingreso** (compraste/recibiste/abonaste…).
   - Limpia la **descripción** (sin montos, sin teléfonos, sin códigos *XXX).
   - Le pone **categoría** con el mismo diccionario de F9 (UBER→Transporte, TOTTUS→Alimentación…).
   - La registra en la **cuenta correcta** (BCP→cuenta BCP, Yape→cuenta Yape) — todo configurable.
3. **Si la app estaba cerrada** no perdés nada: las capturas quedan en un buffer local y
   se procesan al abrirla.
4. **💳 Saldo Vivo** (opcional): configurás un saldo inicial y una fecha, y el Dashboard
   te muestra el espejo "en vivo" de esa cuenta: saldo inicial + todo lo registrado desde
   esa fecha (manual, importado y capturado).
5. **Dos modos**: ⚡ Automático (registra al instante) o 👀 Revisar antes (cada captura
   queda en cola y vos apruebas con 1 toque en Ajustes).

## Privacidad (importante)

- **El filtro es en el lado nativo**: las notificaciones de apps que NO elegiste jamás
  se leen, ni se guardan, ni cruzan al WebView. WhatsApp, Gmail, nada.
- **Buffer 100% local** (archivo interno del teléfono). Nada sale del dispositivo.
- Sin Firebase, sin red nueva, sin permisos de ubicación/ contactos/ SMS.
- El permiso que se activa es el especial de Android *"Acceso a notificaciones"* — el
  mismo que usan las apps de gastos del mundo. NO es un permiso nuevo de instalación:
  la app se instala igual que siempre y lo activás vos desde Ajustes.

---

## Cambio 1 · Tabla archivo → cambio

| Archivo | Cambio |
|---|---|
| `android-native/WTCaptureService.java` | **NUEVO** · `NotificationListenerService` que escucha las notificaciones. Filtra por allowlist ANTES de leer nada (privacidad en la fuente), extrae título/texto/bigText, dedupe de ráfaga (<2.5s), guarda en buffer local jsonl (cap 400) y avisa a la WebView si está viva. |
| `android-native/WTNotificationsPlugin.java` | **NUEVO** · Puente Capacitor con los métodos que llama el JS: `checkAccess`, `openAccessSettings`, `setConfig`/`getConfig` (allowlist en SharedPreferences), `getBuffer(since)`, `clearBuffer`, `addTestCapture` (botón Probar) y `listFinanceApps` (apps instaladas de una lista conocida, con `<queries>` del manifest). |
| `src/services/captura.ts` | **NUEVO** · El cerebro TS: parser de capturas (monto con símbolo S///USD/$, dirección gasto/ingreso con keywords, descripción limpia), pipeline captura→transacción reutilizando `agregarTransaccion` + diccionario de F9, dedupe doble (id pkg@ts + contenido en 2 min), modo auto/revisión, log persistente de capturas, saldo vivo, prefs. Puente al plugin nativo lazy (en web nunca se carga). |
| `src/components/CapturaAutoCard.tsx` | **NUEVO** · Tarjeta de Ajustes: permiso con estado en vivo, picker de apps (5 presets + custom por package), cuenta destino por app, modo automático/revisión, saldo vivo (cuenta/fecha/monto inicial), log con últimas capturas y botones Registrar/Ignorar para las que quedaron en revisión, Probar captura y Limpiar. |
| `src/components/ConfiguracionView.tsx` | Parche · Import de la tarjeta nueva + prop `onAplicar` + render de `CapturaAutoCard` después de la del bot proactivo. |
| `src/components/DashboardView.tsx` | Parche · Tarjeta 💳 **Saldo Vivo** arriba de Mis Cuentas (solo APK y si está activado): monto vivo, desde qué fecha, hace cuánto la última captura, botón a Ajustes. |
| `src/App.tsx` | Parche · `useEffect` F10 (solo APK): drena el buffer al arrancar + evento en vivo `wtCapture` + re-drenaje al volver al frente; pasa `onAplicar` a Configuración; badge `F10 · CAPTURA AUTO`; comentarios. |
| `src/services/platform.ts` | Parche · `versionApp()` → F10. |
| `.github/workflows/build.yml` | Parche · 3 pasos nuevos después de los permisos del manifest: (1) copia los 2 `.java` de `android-native/` al proyecto generado, (2) reescribe `MainActivity.java` registrando el plugin `WTNotifications`, (3) inyecta en el `AndroidManifest` el `<service>` con `BIND_NOTIFICATION_LISTENER_SERVICE` + el bloque `<queries>` con las 5 apps bancarias. Versión → versionCode 13 · 1.10.0. APK → `WalletTrack-V2-F10.apk`. |
| `scripts/smoke-f10.ts` | **NUEVO** · 74 checks del parser, dirección, descripción, pipeline, dedupe, revisión, saldo vivo, prefs y guards. |
| `LEEME-FASE-10.md` | Este archivo. |

**Sin dependencias npm nuevas. Sin tocar Firebase. Sin tocar las 19 claves del viejo
WalletTrack** (las prefs de F10 usan claves propias: `wallettrack_v2_captura` y
`wallettrack_v2_captura_log`).

## Cambio 2 · Qué verificar después de instalar

- [ ] **Instala encima** de la 1.9.1 (misma firma → tus datos sobreviven).
- [ ] Ajustes → nueva tarjeta **🔔 Captura Automática** entre el bot y Respaldo.
- [ ] Tocá **ON** → te lleva a *Acceso a notificaciones* de Android → activá
      **WalletTrack** → volvé a la app → tiene que decir "Acceso a notificaciones OK".
- [ ] En **Apps a escuchar** dejá BCP (y las que uses). Probá cambiar la cuenta destino.
- [ ] Tocá **Probar captura** → toast "🔔 −S/ 25.50 · …" y el movimiento aparece en el
      Historial con cuenta BCP y categoría Transporte (es una simulación de notificación
      del BCP que pasa por TODO el pipeline real — después podés borrarla).
- [ ] Pagá algo real con la tarjeta (un menu, la gasolina) → en segundos/minutos tiene
      que caer solo. Mirá también el **log de capturas** en Ajustes.
- [ ] Modo **👀 Revisar antes**: las capturas NO se registran solas — quedan con badge
      "revisar" y botones **Registrar / Ignorar**.
- [ ] **💳 Saldo Vivo**: activá, poné tu saldo real de hoy → la tarjeta aparece en el
      Dashboard y descuenta con cada movimiento/captura.
- [ ] Cerrá la app del todo, hacé un gasto real, abrí de nuevo → la captura llega igual
      (buffer).
- [ ] Web: todo sigue igual — la tarjeta avisa "Solo en el APK".
- [ ] Regresión rápida: importá un extracto (F9.1), mirá Sankey (F8), avisos del bot (F7).

## Limitaciones honestas

- **Solo captura hacia adelante**: no lee historial — eso lo cubre 📥 Importar Extracto.
- Si BCP/Yape cambian el texto de sus avisos, el parser puede necesitar un ajuste
  (las capturas crudas quedan en el log para diagnosticar; las que no entiende van a
  la cola de revisión — nunca se pierden).
- Algunos fabricantes (Xiaomi, Huawei) matan servicios en segundo plano: si dejara de
  capturar, verificá que el acceso a notificaciones siga activo y que la batería no
  esté "optimizando" a WalletTrack.
- Las notificaciones que el banco envía sin monto (p.ej. "Ingreso a la app desde un
  nuevo dispositivo") van a la cola de revisión para que vos decidas.

## Validación completa (Candado 2)

- `tsc --noEmit` → **0 errores**
- `vite build` → **14.01s** (bundle principal SIN cambios — F10 no agrega deps)
- **Smoke F10 nuevo: 74/74**
- Regresiones: F9 **41/41** · F9.1 **74/74** · F6 **20/20** · F7 **23/23** · F8 **25/25**
- CI: run en GitHub Actions → APK firmada `WalletTrack-V2-F10.apk`
  (login Google, google-services, SHA-1 y keystore estables · versión 13/1.10.0)
