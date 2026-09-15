# 📦 LEEME — FASE 9.1 · IMPORTAR MULTI-FORMATO (XLSX · PDF · TXT)
## WalletTrack V2 · versionCode 12 · versionName 1.9.1 · APK `WalletTrack-V2-F9.1.apk`

---

## 🆕 Qué trae la FASE 9.1

### ¿Por qué? (el caso real)
La banca móvil BCP descarga los movimientos en **XLSX** (y el estado de cuenta en **PDF**), no en CSV — F9 solo aceptaba CSV y te obligaba a convertir el archivo en una PC antes de importarlo. F9.1 cierra ese hueco: ahora importás **directo desde el teléfono** el archivo que te dé el banco.

### Formatos soportados

| Formato | Cómo se lee | Nota |
|---|---|---|
| **CSV** | Parser a mano de F9 (sin cambios) | Igual que antes |
| **TXT** | Mismo parser de texto de F9 | Algunos bancos lo ofrecen |
| **XLSX** | **exceljs** (lazy — el MISMO paquete que usa el export de F3, cero dependencias nuevas) | Lo que descarga la app BCP |
| **PDF** | **pdfjs-dist** (nueva dependencia, carga lazy — solo se descarga al importar un PDF) | Estado de cuenta con texto (no escaneado) |

### 📥 Cómo importar desde el BCP (tu caso)
1. **BCP app** → tu cuenta → "Movimientos" (o la web → "Consulta de movimientos") → período → **Descargar XLSX**.
2. WalletTrack → **Historial** → botón naranja **"📥 Importar Extracto"** (antes decía "Importar CSV").
3. Elegí el archivo + la cuenta destino → el resto es igual que F9 (detectar columnas → revisar/categorizar → importar).

El PDF del estado de cuenta también sirve si **no tiene contraseña** y **no es un escaneo/foto** (si lo es, la app te avisa con un error claro). El `.xls` viejo (Excel 2003) no se puede leer — si algún día te lo da el banco, hay que abrirlo en Excel/Sheets y guardarlo como `.xlsx`.

### 🧠 Qué hace solo la app (nuevo)

**XLSX:**
- **Encabezados en cualquier fila**: los extractos traen títulos arriba ("Consulta de Movimientos — BCP") — busca la fila de headers reales en las primeras 15 filas y descarta los títulos.
- **Celdas de verdad**: fechas de Excel → `DD/MM/YYYY` sin corrimiento por zona horaria (usando UTC — en UTC-5 no se atrasan un día), números sin notación científica, celdas con formato rico (richText) y fórmulas → texto plano.
- **Cargo/Abono separados**: si el extracto trae el gasto y el abono en dos columnas (formato típico BCP), **sintetiza la columna Monto con signos** (cargo → negativo, abono → positivo) y la detección automática la toma.
- **Filas parejas**: exceljs corta las celdas vacías del final de cada fila — se rellenan para que los índices de columna coincidan siempre.

**PDF:**
- Reconstruye las **líneas por coordenadas** (pdfjs extrae cada trozo de texto con su posición X/Y): agrupa por fila, ordena por columna y decide dónde van los espacios de verdad.
- **Heurística de movimiento**: cada línea que arranca con fecha y termina en monto es un movimiento. Soporta montos `-59.90`, `S/ -25.50`, `(120.00)` estilo contable y `80.00-` con menos al final.
- **Descripciones envueltas**: las descripciones largas que ocupan 2 líneas se unen (con el monto en la primera o en la segunda línea).
- **Ruido filtrado**: encabezados de tabla repetidos por página, "Página 1 de 2", "Saldo contable", membrete del banco, números de folio sueltos — todo descartado.
- **Fechas sin año**: los extractos en PDF suelen mostrar `05/09` — asume el año actual (y si queda a más de 45 días en el futuro, el año anterior: extractos que cruzan enero).
- **Multi-página**: procesa todas las páginas.

**Detección endurecida para headers reales del BCP:**
- **"Fecha de operación"** → es la FECHA (antes el F9 podía confundirla con el tipo porque contiene "operación").
- **"N° de operación"** → es el número de referencia — **ya no se confunde con la columna tipo** (ese bug convertía todo en ingreso según el signo).
- **"Tipo de cambio" / "Moneda" / "Saldo"** → excluidos de la detección de tipo.

**FIX de bug de F9 (cazado en el E2E):** el diccionario sugiere `YAPE → Transferencia`, pero "Transferencia" **no estaba en las opciones del select** de categoría del paso 3 → el navegador caía silenciosamente a la primera opción ("Hogar") y el movimiento se importaba con categoría incorrecta. Ahora el select incluye **Transferencia 💸 y Ahorro 🎯** (categorías reales de tx en la app) + **las categorías propias que hayas creado en F5**. Hay un guard en el smoke que verifica que TODA sugerencia del diccionario exista en el select.

---

## 🔢 Changelog técnico (archivo → qué cambió)

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `package.json` + `package-lock.json` | +`pdfjs-dist@^6.3` (única dependencia nueva — carga lazy, chunk separado de 541KB + worker inline que solo se baja al importar un PDF) |
| 2 | `src/services/importarCsv.ts` | +`leerArchivoBancario(file)` dispatcher por extensión (csv/txt/xlsx/pdf/xls con error amigable) · +`parsearXlsx` con exceljs (interop dual browser/node, headers en primeras 15 filas, `celdaATexto` para Date UTC/números/richText/fórmulas, padding de filas cortas, fusión Cargo/Abono) · +`parsearPdf` con pdfjs (extracción por coordenadas, agrupado por Y con tolerancia ±3, espacios por hueco real, heurística fecha+descripción+monto, descripciones envueltas, filtro de ruido, destrucción del loadingTask) · +`cargarPdfjs` singleton con Worker real inline en browser (fake worker en node/smoke) · `detectarColumnas` endurecida: `buscarColumnaTipo` con doble pasada (exacta + parcial con `EXCLUIR_TIPO`) · `parsearMonto` entiende `(50.00)` y `50.00-` contables · `normalizarFecha` entiende `DD/MM` sin año (año actual o anterior si cruza año) · `normalizarFecha`/`parsearMonto` ahora exportadas (para el smoke) |
| 3 | `src/components/ImportarCsvModal.tsx` | `accept` acepta `.csv,.txt,.xlsx,.pdf` (+ mimes) · lectura async con `leerArchivoBancario` + estado `leyendo` (spinner "Leyendo archivo…") + try/catch con errores amigables · **FIX select de categorías**: +Transferencia/Ahorro/categorías propias F5 · textos multi-formato (título, tip de BCP) · saca el estado muerto `csvTexto` |
| 4 | `src/components/HistorialView.tsx` | Botón "📥 Importar CSV" → **"📥 Importar Extracto"** (data-testid sin cambio) |
| 5 | `src/App.tsx` | badge `F9.1 · MULTI-FORMATO` + splash `F9.1` + comentario de fase |
| 6 | `src/services/platform.ts` | `versionApp() → 'F9.1 · Importar Extracto (CSV/XLSX/PDF)'` |
| 7 | `src/vite-env.d.ts` **(NUEVO)** | tipos para el import `?worker&inline` del worker de pdfjs (vite/client) |
| 8 | `.github/workflows/build.yml` | versionCode 12 · versionName 1.9.1 · `WalletTrack-V2-F9.1.apk` |
| 9 | `scripts/smoke-f91.ts` **(NUEVO)** | 74 checks (ver abajo) |
| 10 | `scripts/localstorage-shim.cjs` **(NUEVO)** | shim para correr los smokes en node 24 (`npx tsx -r ./scripts/localstorage-shim.cjs scripts/smoke-fX.ts`) |
| 11 | `scripts/e2e-wt-f91-*.png` **(NUEVO)** | evidencia del E2E real en navegador (modal, pasos, importaciones XLSX y PDF) |

**Dependencias nuevas: 1** (`pdfjs-dist`). El bundle principal NO cambia — pdfjs va en chunk lazy aparte (igual que exceljs/jspdf desde F3) y el worker queda embebido como blob inline (offline total en el APK).

---

## 📲 Instalación

1. Cuando el CI termine, bajá el artifact `WalletTrack-V2-APK` del último run verde.
2. Descomprimilo → instalá `WalletTrack-V2-F9.1.apk` (versionCode 12 — **instala encima de F9, tus datos quedan intactos**).
3. No hace falta ninguna regla nueva en Firebase (F9.1 es 100% local — no toca Firestore ni Storage).

---

## ✅ Qué verificar después de instalar (en orden)

1. **Badge**: header dice `F9.1 · MULTI-FORMATO` y Ajustes → versión `F9.1 · Importar Extracto (CSV/XLSX/PDF)`.
2. **Botón**: Historial → el botón naranja ahora dice **"📥 Importar Extracto"** (antes "Importar CSV").
3. **Paso 1**: el modal se titula "Importar extracto del banco", el selector de archivo dice "Tocá para elegir el extracto del banco" y debajo de los botones figura "Formatos: CSV · TXT · XLSX · PDF".
4. **Importar XLSX real del BCP** (el caso que motivó todo esto):
   - BCP app → Movimientos → descargá el XLSX al teléfono
   - Importar Extracto → elegí ese `.xlsx` + tu cuenta BCP
   - **Paso 2**: las columnas deberían autodetectarse (`Fecha de operación` → Fecha, `Descripción` → Descripción, `Importe` → Monto, **Tipo sin mapear** aunque el archivo tenga "N° de operación")
   - Si trae filas de título arriba, el paso 2 debería mostrar las filas de datos igual (sin las de título)
   - **Paso 3**: revisar categorías — ⚠️ si hay un YAPE/PLIN debería sugerir **💸 Transferencia** (antes caía en Hogar)
   - Importar → toast con resumen → movimientos en el historial
5. **Importar el mismo XLSX otra vez** → todo marcado ⚠️ duplicado y deschequeado (dedupe intacto).
6. **Importar un PDF** (estado de cuenta):
   - "Leyendo archivo…" un par de segundos → paso 2 con Fecha/Descripción/Monto ya mapeados
   - Paso 3 con los movimientos detectados (sin encabezados ni saldos ni "Página N")
   - Importar → resumen
7. **Errores amigables** (probalos si querés): PDF con contraseña → "protegido con contraseña…"; PDF escaneado → "no tiene texto extraíble…"; un `.xls` → instrucción de convertirlo.
8. **Todo lo anterior sigue igual**: F0–F9 intacto (el CSV de F9 sigue funcionando exactamente igual — smoke de regresión 41/41).

---

## 🧪 Validación hecha antes de entregar

- `tsc --noEmit`: **0 errores** · `vite build`: **OK 14.38s** (pdfjs como chunk lazy de 541KB + worker inline 1.2MB — el bundle principal no engorda).
- **Smoke F9.1: 74/74 OK** — montos contables `(50.00)`/`50.00-`, fechas sin año con cruce de año, headers BCP reales ("Fecha de operación"/"N° de operación" no confunden el tipo), XLSX round-trip con exceljs (Date UTC, richText, headers en fila 3, cargo/abono → Monto con signo, re-import no duplica), PDF round-trip con jspdf (2 páginas, S/, paréntesis, guión final, descripciones envueltas en 2 modalidades, ruido excluido), dispatch por extensión, PDF escaneado, PDF con clave, .xls, guard del diccionario-select.
- **Regresión**: smoke F9 41/41 · F6 20/20 · F7 23/23 · F8 25/25 — todo OK.
- **E2E REAL en navegador (build de producción, `vite preview`)**: modal multi-formato → upload de un XLSX con la forma del BCP real → detección perfecta (fecha=0, desc=2, importe=3, tipo sin mapear) → 4 categorías autodetectadas → importar → 4 filas en el historial → upload de un PDF de 2 páginas → 4 movimientos con ruido excluido → importar → 8 filas totales. **0 errores de consola.** Evidencia: `scripts/e2e-wt-f91-*.png`.

---

## 🔐 Seguridad y privacidad

- Cero secretos nuevos en los archivos.
- El XLSX/PDF se procesa **100% local** en el dispositivo — no se manda a ningún servidor.
- No toca Firebase — no requiere reglas nuevas en Firestore ni Storage.
- **Rotá tu token de GitHub** cuando terminemos la ronda (ya viajó por el chat).

---

## 📌 Notas técnicas

- **pdfjs v6**: se usa el build `legacy` (compatible WebView del APK y node) + Worker inline (`?worker&inline` de Vite — el worker queda embebido como blob, sin archivo externo ni problema de origen). En node (smoke) sin Worker, pdf.js cae a su fake worker en el hilo principal — para extractos de unas páginas es instantáneo.
- **Advertencia cosmética**: pdfjs tira un `Warning: UnknownErrorException ... standardFontDataUrl` al extraer texto — es solo sobre renderizado de fuentes para PINTAR el PDF (acá jamás se pinta, solo se lee el texto). No afecta nada.
- **PDFs con contraseña**: los estados de cuenta del BCP suelen venir con clave — la app lo detecta y te pide exportar sin clave. Los "movimientos" descargables de la app no traen clave.
- **Moneda**: si el extracto mezcla soles y dólares, todo entra como si fuera soles (multi-moneda es la mejora #6, todavía no está).
- **Cómo correr los smokes**: `npx tsx -r ./scripts/localstorage-shim.cjs scripts/smoke-f91.ts` (el shim da el `localStorage` que node 24 no expone; en node 25+ no haría falta).
- **Diccionario ampliable**: si una descripción del BCP no matchea, se agrega la palabra a `DICCIONARIO_CATEGORIAS` en `catalogos.ts` — el guard del smoke avisa si alguien sugiere una categoría que no existe en el select.
