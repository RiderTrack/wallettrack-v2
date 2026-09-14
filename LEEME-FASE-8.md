# 📦 LEEME — FASE 8 · SANKEY DE FLUJO DE DINERO
## WalletTrack V2 · versionCode 10 · versionName 1.8.0 · APK `WalletTrack-V2-F8.apk`

---

## 🆕 Qué trae la FASE 8

### 🌊 Gráfico Sankey en Estadísticas
Una visualización nueva arriba de las gráficas existentes que muestra **a dónde va cada sol** de tus ingresos del mes. Es la gráfica que más comparte la gente porque muestra de un vistazo el flujo completo del dinero.

**Estructura del gráfico:**
- **Origen (izquierda)**: nodo único con el total de ingresos del mes actual
- **Destinos (derecha)**:
  - **Top 5 categorías** de gasto del mes + **"Otros"** (las que no entran en top 5)
  - **✉️ Sobres** (recargas del mes)
  - **🎯 Metas** (abonos del mes)
  - **💰 Saldo** restante (lo que no se fue a ningún lado)
- **Flujos**: paths curvos Bézier cúbicos entre origen y cada destino, con **grosor proporcional al monto**
- **Colores**: cada destino con su color característico
  - Categorías: tonos rosa/ámbar/índigo/esmeralda/azul (mismo palette de "Top Categorías")
  - Otros: gris
  - Sobres: amarillo
  - Metas: esmeralda
  - Saldo: verde brillante
- **Etiquetas**: nombre + monto + porcentaje en cada nodo destino
- **Tooltip al tocar/hover**: muestra el detalle del flujo con nombre completo y porcentaje

### 📐 Detalles técnicos
- **SVG puro** con viewBox `360×280` (mismo ADN de las gráficas de F3 — sin librerías, sin CDN, offline total)
- **Paths Bézier cúbicos** entre el borde derecho del nodo origen y el borde izquierdo de cada destino
- **Grosor del flujo** = monto del flujo / monto total de ingresos × altura disponible
- **Hover/touch** en un flujo → resalta ese flujo y atenúa los demás
- **Sin datos**: muestra mensaje "Necesitás registrar ingresos este mes para ver el flujo"
- **Escalado**: si la suma de destinos > ingresos (gastos > ingresos), el saldo es 0 y los destinos se reescalan proporcionalmente

---

## 🔢 Changelog técnico (archivo → qué cambió)

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `src/components/SankeyFlujo.tsx` **(NUEVO)** | Componente SVG: calcula posiciones de nodos (origen + destinos), paths Bézier cúbicos con grosor proporcional, colores por tipo, hover/touch para resaltar + tooltip flotante. Exporta `DatosSankey`, `NodoFlujo` y los colores `COLORES_CATS`, `COLOR_OTROS`, `COLOR_SOBRES`, `COLOR_METAS`, `COLOR_SALDO` |
| 2 | `src/components/EstadisticasView.tsx` | +tarjeta "🌊 Flujo del Mes" arriba de "Evolución Financiera" · cálculo de ingresos del mes, top 5 categorías de gasto + Otros, recargas a sobres del mes, abonos a metas del mes, saldo restante |
| 3 | `src/App.tsx` | badge `F8 · SANKEY` + splash `F8` |
| 4 | `src/services/platform.ts` | `versionApp() → 'F8 · Sankey de Flujo'` |
| 5 | `.github/workflows/build.yml` | versionCode 10 · versionName 1.8.0 · `WalletTrack-V2-F8.apk` |

**Sin dependencias nuevas**: SVG puro, mismo ADN de F3. No toca Firebase (100% local).

---

## 📲 Instalación

1. Cuando el CI termine, bajá el artifact `WalletTrack-V2-APK` del último run verde.
2. Descomprimilo → instalá `WalletTrack-V2-F8.apk` (versionCode 10 — **instala encima de F7, tus datos quedan intactos**).
3. No hace falta ninguna regla nueva en Firebase (F8 es 100% local con SVG).
4. Probá según la lista de abajo.

---

## ✅ Qué verificar después de instalar (en orden)

1. **Badge**: header dice `F8 · SANKEY` y Ajustes → versión `F8 · Sankey de Flujo`.
2. **Tarjeta Sankey**: andá a **Estadísticas** → confirmá que arriba de "Evolución Financiera" hay una tarjeta nueva **"🌊 Flujo del Mes"**.
3. **Sin ingresos este mes**: si no tenés ingresos en el mes actual, muestra "Necesitás registrar ingresos este mes para ver el flujo".
4. **Con datos del mes**:
   - Registrá un ingreso (ej: S/ 2000 sueldo).
   - Registrá gastos en al menos 2 categorías diferentes (ej: Alimentación S/ 300, Transporte S/ 200).
   - Andá a Estadísticas → el Sankey debería mostrar:
     - Nodo izquierdo "Ingresos S/ 2k"
     - Flujos hacia cada categoría de gasto
     - Flujo hacia "💰 Saldo" con lo que te queda
5. **Hover/touch**: tocá un flujo → se resalta ese flujo (opacidad 0.85) y los demás se atenúan (opacidad 0.15) → aparece un tooltip con el detalle.
6. **Sobres**: recargá un sobre este mes → debería aparecer un flujo hacia "✉️ Sobres".
7. **Metas**: aboná a una meta este mes → debería aparecer un flujo hacia "🎯 Metas".
8. **Más de 5 categorías**: si registrás gastos en más de 5 categorías diferentes este mes, las que no entran en top 5 se agrupan en "Otros".
9. **Porcentajes**: cada nodo destino muestra su monto y el % del total de ingresos. La suma de todos los % debería ser 100% (o menos si hay saldo).
10. **Todo lo anterior sigue igual**: F0–F7 intacto (sobres, deudas, presupuestos, metas, compras, estadísticas, WalletBot, Theme Studio, candado, recordatorios, comprobantes, bot proactivo).

---

## 🧪 Validación hecha antes de entregar

- `tsc --noEmit`: **0 errores** · `vite build`: **OK 10.01s** (sin deps nuevas).
- **Smoke F8: 25/25 OK** (sin datos, con datos, saldo = ingresos - gastos - sobres - metas, saldo negativo → 0, % proporcional, colores por tipo, fmtV, estado real con transacciones del mes, top 5 + Otros, sobres y metas del mes se calculan correctamente).
- **Sin errores de consola** en el bundle de producción.
- **Compatibilidad 1:1**: un respaldo de F7 (o del viejo) importa sin tocar el Sankey — este es 100% visual, no persiste nada nuevo.

---

## 🔐 Seguridad y privacidad

- Cero secretos en los archivos (sin API keys nuevas).
- El Sankey es **100% local**: se calcula con tus datos en el dispositivo, no manda nada a ningún servidor.
- No toca Firebase — no requiere reglas nuevas en Firestore ni Storage.
- **Rotá tu token de GitHub** cuando terminemos la ronda (ya viajó por el chat).

---

## 📌 Notas técnicas

- **SVG puro**: mismo ADN de `GraficaEvolucion` y `GraficaAhorro` de F3 — sin Chart.js, sin D3, sin CDN. Funciona offline en APK.
- **Paths Bézier cúbicos**: cada flujo es un path cerrado que conecta el borde derecho del nodo origen con el borde izquierdo del nodo destino, usando dos puntos de control en el medio para hacer la curva suave.
- **Grosor proporcional**: la altura de cada flujo en el nodo origen y en el nodo destino es proporcional al monto. La suma de todas las alturas en el origen = altura total disponible.
- **Escalado**: si `gastos + sobres + metas > ingresos`, el saldo es 0 y los destinos se reescalan proporcionalmente para que el gráfico siga siendo legible (no se desborda).
- **Hover en mobile**: en APK el hover se dispara con `onTouchStart` (un toque resalta, otro toque lo quita).
- **Top 5 + Otros**: si hay más de 5 categorías de gasto en el mes, las que no entran en top 5 se agrupan en "Otros" para mantener el gráfico legible (más de 7 nodos destino lo hacen difícil de leer).
- **Sin selector de mes**: F8 muestra solo el mes actual. Si en el futuro querés ver meses pasados, se puede agregar un selector en F8.1.
