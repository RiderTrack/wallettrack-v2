# 📦 LEEME — FASE 7 · WALLETBOT PROACTIVO
## WalletTrack V2 · versionCode 9 · versionName 1.7.0 · APK `WalletTrack-V2-F7.apk`

---

## 🆕 Qué trae la FASE 7

El WalletBot de F4 era **reactivo**: vos abrís el chat y él responde. F7 lo hace **proactivo**: el bot te empuja avisos inteligentes solito, sin que abras el chat, con las mismas notificaciones locales de Android que ya usaban los recordatorios de vencimientos (F5).

### 🔔 Avisos push del bot
El bot te avisa cuando detecta algo importante en tus gastos, usando las **mismas 12 reglas del chat** (no inventa nada nuevo). Tipos de aviso que te pueden llegar:

1. **Presupuesto en riesgo** (≥80% del límite del mes) — "⚠️ Tu presupuesto de Alimentación va al 85% — te quedan S/ 75"
2. **Presupuesto excedido** (≥100%) — "🔴 Te pasaste del presupuesto de Transporte este mes"
3. **Tasa de ahorro crítica** (<5%) — "🚨 Tu tasa de ahorro del mes está al 3% — revisá tus gastos"
4. **Gastos creciendo** (>20% vs mes anterior) — "📈 Gastaste 28% más que el mes pasado"
5. **Sin ingresos registrados** — "⚠️ Sin ingresos este mes, tenés S/ 200 en gastos sin respaldo"
6. **Categoría excesiva** (>35% de tus gastos) — consejo sobre la categoría que más pesa
7. **Gasto hormiga** — consejo sobre pequeños gastos repetidos
8. **Dinero libre real** — consejo sobre cuánto te queda realmente libre

### 🎛️ Ajustes → WalletBot Proactivo
Tarjeta nueva con:
- **Toggle ON/OFF** (default ON)
- **Selector de frecuencia**: Solo graves (riesgo+alerta) / Todos (riesgo+alerta+consejo) / Silencioso (solo riesgo)
- **Horario silencioso**: no molesta de 22:00 a 7:00 (default ON)
- **Botón "Probar aviso"** → te manda una notificación de prueba en 6 segundos
- **Botón "Reiniciar"** → limpia el registro de avisos enviados hoy (el bot puede volver a avisarte)
- **Diagnóstico**: te muestra cuántos avisos mandó hoy y si estás en horario silencioso ahora

### 📊 Dashboard con tarjeta del bot mejorada
- Hasta **3 avisos** (antes 2) ordenados por prioridad
- Badge "N avisos" animado cuando hay algo que ver
- Botón **"Ver"** en cada aviso → te lleva al chat del bot

### 🧠 Cómo funciona el motor
- Reutiliza las **12 reglas exactas** del `analyzeWallet` de F4 — no inventa nada nuevo.
- Se ejecuta **3 segundos después** de cada cambio de estado (gasto, ingreso, sync, recurrente) — debounced, no corre en cada gasto rápido.
- **Dedupe por día**: si ya te avisó del presupuesto de Alimentación hoy, no te vuelve a avisar hasta mañana (aunque el porcentaje suba).
- **Respeta horario silencioso**: si está ON y son las 23:00, el bot no dispara notificaciones (pero los avisos siguen apareciendo en el dashboard).
- **Persistencia**: el registro de dedupe vive en `localStorage` (`WT2_BOT_DEDUPE`), sobrevive recargas.
- **IDs separados**: las notificaciones del bot usan el rango 1_900_000_000+ para no chocar con las de F5 (recordatorios de vencimientos).

---

## 🔢 Changelog técnico (archivo → qué cambió)

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `src/types.ts` | +`FrecuenciaBot` ('solo-graves' \| 'todos' \| 'silencioso') · +`PrefsBotProactivo` {activo, frecuencia, horarioSilencioso} |
| 2 | `src/services/botproactivo.ts` **(NUEVO)** | Motor: `correrBotProactivo` reutiliza `analizarWallet` de F4 · `filtrarPorFrecuencia` (3 niveles) · `filtrarDedupe` (por día, clave tipo+texto) · `dispararNotifs` (LocalNotifications con IDs 1.9B+, stagger 500ms) · `cancelarNotifsBot` (solo las del bot, no toca F5) · `probarBotProactivo` · `diagnosticarBot` · `reiniciarDedupe` · `leerPrefsBot`/`guardarPrefsBot` (misma clave `wallettrack_v2_prefs` de F5) · `enHorarioSilencioso` (22:00–7:00) |
| 3 | `src/components/DashboardView.tsx` | Tarjeta del bot: hasta 3 avisos (antes 2) · badge "N avisos" animado · botón "Ver" en cada aviso → `onIr('walletbot')` |
| 4 | `src/components/ConfiguracionView.tsx` | +tarjeta "WalletBot Proactivo" (ON/OFF + frecuencia 3 opciones + horario silencioso + diagnóstico + probar + reiniciar) · roadmap de Ajustes con F6 y F7 ✓ (F6 no estaba listado) |
| 5 | `src/App.tsx` | useEffect: corre motor 3s después de cada cambio de estado (debounced) · toast "🤖 N avisos nuevos del bot" cuando dispara · badge `F7 · BOT PROACTIVO` · splash `F7` |
| 6 | `src/services/platform.ts` | `versionApp() → 'F7 · Bot Proactivo'` |
| 7 | `.github/workflows/build.yml` | versionCode 9 · versionName 1.7.0 · `WalletTrack-V2-F7.apk` (sin permisos nuevos — reutiliza los de F5) |

**Sin dependencias nuevas**: reutiliza `@capacitor/local-notifications` (F5), `walletbot.ts` (F4) y `wallettrack_v2_prefs` (F5).

---

## 📲 Instalación

1. Cuando el CI termine, bajá el artifact `WalletTrack-V2-APK` del último run verde.
2. Descomprimilo → instalá `WalletTrack-V2-F7.apk` (versionCode 9 — **instala encima de F6, tus datos quedan intactos**).
3. No hace falta ninguna regla nueva en Firebase (F7 no toca Firestore ni Storage — todo es local con notificaciones).
4. Probá según la lista de abajo.

---

## ✅ Qué verificar después de instalar (en orden)

1. **Badge**: header dice `F7 · BOT PROACTIVO` y Ajustes → versión `F7 · Bot Proactivo`.
2. **Tarjeta del bot en Ajustes**: Ajustes → buscá la tarjeta **"WalletBot Proactivo"** → confirmá que está **ON** por defecto, frecuencia **"Solo graves"** y horario silencioso **ON**.
3. **Probar aviso**: Ajustes → "Probar aviso" → a los 6 segundos suena la campanita con el ícono del bot 🤖.
4. **Dashboard con 3 avisos**: si tenés datos del mes, el dashboard debería mostrar hasta 3 avisos en la tarjeta del bot (antes eran 2). Cada uno con botón "Ver" que te lleva al chat.
5. **Disparar aviso real**:
   - Si tenés un presupuesto creado, cargá gastos hasta pasarlo al 80% del límite.
   - Esperá 3 segundos (debounce).
   - Te debería llegar una notificación 🤖 "⚠️ Tu presupuesto de X va al 85%…".
   - También aparece un toast "🤖 1 aviso nuevo del bot".
6. **Dedupe por día**:
   - Cargá otro gasto en la misma categoría (el porcentaje sube pero el aviso ya se mandó).
   - **No** te debería llegar otra notificación del mismo aviso hoy.
   - Si querés que vuelva a avisar: Ajustes → "Reiniciar" → el bot puede volver a disparar.
7. **Cambiar frecuencia**:
   - Ajustes → frecuencia → "Silencioso" → solo vas a recibir avisos de tipo riesgo.
   - Ajustes → frecuencia → "Todos" → recibís también consejos (dinero libre, categoría excesiva, etc.).
8. **Horario silencioso** (si estás probando de noche):
   - Si son las 23:00 y tocás "Probar aviso" → la notificación del test igual sale (es un test manual).
   - Pero los avisos automáticos del bot NO disparan de noche (el diagnóstico te dice "en horario silencioso ahora").
9. **Bot apagado**: Ajustes → toggle OFF → cargá gastos que deberían disparar avisos → **no** llega nada. Volvé a ON.
10. **Todo lo anterior sigue igual**: sobres, deudas, presupuestos, metas, compras, estadísticas, WalletBot chat, Theme Studio, candado, recordatorios de vencimientos (F5), comprobantes (F6), sync Firestore.

---

## 🧪 Validación hecha antes de entregar

- `tsc --noEmit`: **0 errores** · `vite build`: **OK 10.88s** (sin deps nuevas).
- **Smoke F7: 23/23 OK** (prefs por defecto, guardar prefs, bot apagado no dispara, estado vacío genera consejo, estado con gastos creciendo genera riesgo score 100, filtro solo-graves deja pasar riesgo+alerta>=85, filtro silencioso solo deja pasar riesgo>=88, filtro todos excluye logro, dedupe por día no repite, reiniciar dedupe permite volver a avisar, diagnóstico devuelve datos coherentes).
- **Sin errores de consola** en el bundle de producción.
- **Compatibilidad 1:1**: un respaldo de F6 (o del viejo) importa sin tocar los avisos del bot — estos son locales y no viajan a la nube.

---

## 🔐 Seguridad y privacidad

- Cero secretos en los archivos (sin API keys nuevas).
- Los avisos del bot son **100% locales**: se calculan con tus datos en el dispositivo, no mandan nada a ningún servidor.
- Las prefs del bot viven en `localStorage` (clave `wallettrack_v2_prefs`, la misma de F5) — **no viajan a la nube**.
- El registro de dedupe vive en `localStorage` (`WT2_BOT_DEDUPE`) — tampoco viaja a la nube.
- **Rotá tu token de GitHub** cuando terminemos la ronda (ya viajó por el chat).

---

## 📌 Notas técnicas

- **IDs separados de F5**: las notificaciones del bot usan el rango `1_900_000_000` a `1_999_999_999`. Las de F5 (recordatorios de vencimientos) usan hash `% 2_000_000_000` que cae mayormente debajo de 2B. No chocan.
- **Stagger**: cuando el bot dispara varios avisos a la vez, los espacia 500ms para que no se apilen en la barra de notificaciones.
- **Dedupe por clave tipo+texto**: dos avisos del mismo tipo y mismo texto → misma clave → no se repiten hoy. Si el texto cambia (porque cambió el monto), se considera un aviso nuevo.
- **Horario silencioso**: de 22:00 a 7:00 el bot no dispara notificaciones, pero los avisos siguen apareciendo en el dashboard (solo silencia la notificación, no el análisis).
- **No toca Firestore ni Storage**: F7 es 100% local. No requiere ninguna regla nueva en Firebase.
- **Reutiliza F4 y F5**: las 12 reglas del bot y la infra de notificaciones ya estaban — F7 solo decide CUÁNDO avisar.
