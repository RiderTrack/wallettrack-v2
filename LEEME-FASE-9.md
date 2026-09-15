# 📦 LEEME — FASE 9 · IMPORTAR CSV DEL BANCO
## WalletTrack V2 · versionCode 11 · versionName 1.9.0 · APK `WalletTrack-V2-F9.apk`

---

## 🆕 Qué trae la FASE 9

### 📥 Importador de CSV en Historial
Para usuarios con muchos movimientos, cargar todo a mano es la fricción #1 que hace abandonar la app. F9 te permite importar el extracto bancario (CSV) y categorizar cada movimiento sin tipear nada.

**Botón "📥 Importar CSV"** en el Historial (junto a los de export CSV/JSON) que abre un modal de 3 pasos:

### Paso 1 — Elegir archivo y cuenta
- Botón "Tocá para elegir el CSV del banco" → abre el selector de archivos
- Selector de cuenta destino: BCP / Interbank / BBVA / Yape / Plin / Efectivo / cuentas propias
- Todos los movimientos del CSV se asociarán a esa cuenta

### Paso 2 — Mapear columnas (detección automática + editable)
- El importador **detecta automáticamente** las columnas buscando por nombre:
  - Fecha (busca: `fecha`, `date`, `fecha operacion`, `f. operacion`, `fecha movimiento`)
  - Descripción (busca: `descripcion`, `concepto`, `detalle`, `glosa`)
  - Monto (busca: `monto`, `importe`, `amount`, `valor`)
  - Tipo (busca: `tipo`, `operacion`, `cargo/abono`, `naturaleza`)
- Si la detección falla, te muestra los headers del CSV y te deja elegir qué columna es cada cosa con selects
- Vista previa de las primeras 5 filas para confirmar que el mapeo quedó bien

### Paso 3 — Revisar, categorizar e importar
- Tabla con TODOS los movimientos del CSV:
  - Checkbox por fila (para importar solo algunos)
  - Fecha, descripción, monto, tipo (ingreso/gasto)
  - **Selector de categoría** por fila (con autodetección por palabras clave)
  - Cuenta ya elegida en el paso 1
- Acciones rápidas: "Seleccionar todos" / "Quitar todos" / "Quitar duplicados"
- Botón **"Importar N movimientos"** → los mete al historial
- Toast con resumen: "✅ N importados · S/ X gastos · S/ Y ingresos · ⚠️ M salteados (duplicados)"

### 🔍 Detección automática de categorías
Diccionario de ~50 palabras clave que mapea descripciones a categorías:
```
UBER, CABIFY, BEAT → Transporte
NETFLIX, SPOTIFY, DISNEY, HBO → Entretenimiento
SUPER, PLAZA VEA, TOTTUS, VIVANDA, WONG, MAKRO → Alimentación
RAPPY, PEDIDOSYA, UBEREATS → Alimentación (delivery)
PRIMAX, REPSOL, PECSA, GASOLINA → Combustible
CLARO, MOVISTAR, ENTEL, BITEL → Tecnología
LUZ, AGUA, GAS, ALQUILER → Hogar
FARMACIA, INKAFARMA, MIFARMA, CLINICA → Salud
MERCADO LIBRE, ALIEXPRESS, AMAZON, RIPLEY → Compras
SUELDO, HABERES, PLANILLA → Trabajo Principal
YAPE, PLIN, TRANSFERENCIA → Transferencia
...
```
- Si no matchea nada → "Otros" (después podés cambiarla a mano)
- Insensible a mayúsculas y acentos

### 🚫 Dedupe anti-duplicados
- Antes de importar cada movimiento, verifica si ya existe una tx con **la misma fecha + mismo monto (absoluto) + misma descripción** (o descripción que incluya la del CSV) en los **últimos 7 días**
- Si ya existe → lo marca con ícono amarillo ⚠️ y lo deja **deschequeado por defecto**
- Así podés importar el CSV del banco dos veces sin llenar el historial de duplicados
- Podés forzar importar un duplicado chequiándolo a mano

### 📊 Formato del monto flexible
El parser acepta cualquier formato:
- `1,234.56` (formato US)
- `1.234,56` (formato europeo)
- `1234.56` (sin separador de miles)
- `-50.00` (negativo = gasto)
- `S/ 50` (con símbolo)
- Detecta automáticamente si el separador es coma o punto y coma

### 📅 Formato de fecha flexible
- `DD/MM/YYYY`, `DD-MM-YYYY`
- `YYYY-MM-DD`
- `DD/MM/YY` (asume 20YY)

---

## 🔢 Changelog técnico (archivo → qué cambió)

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `src/data/catalogos.ts` | +`DICCIONARIO_CATEGORIAS` (~50 palabras clave → categoría) · +`detectarCategoria(descripcion)` que recorre el diccionario insensible a mayúsculas |
| 2 | `src/services/importarCsv.ts` **(NUEVO)** | Parser CSV a mano (maneja comas, punto y coma, comillas, BOM) · `detectarColumnas` por nombre (insensible a mayúsculas y acentos) · `normalizarFecha` (DD/MM/YYYY, YYYY-MM-DD, DD/MM/YY) · `parsearMonto` (formatos US, europeo, con símbolo) · `detectarTipo` (por columna tipo o por signo) · `mapearFilas` con dedupe contra tx existentes (7 días) · `importarTransaccionesMasivas` con dedupe final |
| 3 | `src/components/ImportarCsvModal.tsx` **(NUEVO)** | Modal de 3 pasos: elegir archivo+cuenta → mapear columnas (con vista previa) → revisar+categorizar+importar · checkboxes por fila · acciones rápidas (seleccionar todos / quitar todos / quitar duplicados) · toast con resumen |
| 4 | `src/components/HistorialView.tsx` | +botón "📥 Importar CSV" junto a los de CSV/JSON · cablea el modal con `onImportar` que aplica el estado nuevo + toast de resumen |
| 5 | `src/App.tsx` | badge `F9 · IMPORT CSV` + splash `F9` |
| 6 | `src/services/platform.ts` | `versionApp() → 'F9 · Importar CSV'` |
| 7 | `.github/workflows/build.yml` | versionCode 11 · versionName 1.9.0 · `WalletTrack-V2-F9.apk` |

**Sin dependencias nuevas**: parser CSV a mano (sin `papaparse` ni libs externas). En web usa `<input type="file">` nativo.

---

## 📲 Instalación

1. Cuando el CI termine, bajá el artifact `WalletTrack-V2-APK` del último run verde.
2. Descomprimilo → instalá `WalletTrack-V2-F9.apk` (versionCode 11 — **instala encima de F8, tus datos quedan intactos**).
3. No hace falta ninguna regla nueva en Firebase (F9 es 100% local).
4. Probá según la lista de abajo.

---

## ✅ Qué verificar después de instalar (en orden)

1. **Badge**: header dice `F9 · IMPORT CSV` y Ajustes → versión `F9 · Importar CSV`.
2. **Botón Importar CSV**: Historial → arriba de la tabla, buscá el botón naranja **"📥 Importar CSV"** junto a los de CSV/JSON.
3. **Paso 1 — elegir archivo y cuenta**:
   - Tocá el botón → elegí un CSV del banco (o creá uno de prueba)
   - Elegí la cuenta destino (ej: BCP)
   - Tocá "Continuar"
4. **Paso 2 — mapear columnas**:
   - Confirmá que las columnas se detectaron automáticamente (fecha, descripción, monto, tipo)
   - Si alguna quedó mal, cambiala con el select
   - Revisá la vista previa de las primeras 5 filas
   - Tocá "Continuar"
5. **Paso 3 — revisar y categorizar**:
   - Vas a ver todos los movimientos del CSV en una tabla
   - Cada uno con checkbox, fecha, descripción, monto, tipo y categoría
   - Las categorías se autodetectaron (UBER → Transporte, NETFLIX → Entretenimiento, etc.)
   - Si una quedó mal, cambiala con el select de categoría
   - Si hay posibles duplicados, los vas a ver marcados con ⚠️ y deschequeados
6. **Importar**:
   - Tocá "Importar N movimientos"
   - Vas a ver un toast: "✅ N importados · S/ X gastos · S/ Y ingresos · ⚠️ M salteados (duplicados)"
   - Los movimientos aparecen en el historial
7. **Dedupe**:
   - Importá el mismo CSV otra vez
   - Todos los movimientos deberían marcarse como ⚠️ posibles duplicados
   - Al confirmar, no se duplican en el historial
8. **Acciones rápidas**:
   - "Seleccionar todos" → marca todos los checkboxes
   - "Quitar todos" → los desmarca
   - "Quitar duplicados" → desmarca solo los marcados como ⚠️
9. **Todo lo anterior sigue igual**: F0–F8 intacto (sobres, deudas, presupuestos, metas, compras, estadísticas, Sankey, WalletBot, comprobantes, bot proactivo, candado, recordatorios).

---

## 🧪 Validación hecha antes de entregar

- `tsc --noEmit`: **0 errores** · `vite build`: **OK 10.37s** (sin deps nuevas).
- **Smoke F9: 41/41 OK** (parser con comas/punto y coma/comillas, detección de columnas, nombres alternativos, diccionario de categorías insensible, mapeo de filas con dedupe, importación masiva, dedupe al re-importar el mismo CSV, totales correctos).
- **Sin errores de consola** en el bundle de producción.
- **Compatibilidad 1:1**: un respaldo de F8 (o del viejo) importa sin tocar el importador CSV — este es 100% funcional, no persiste nada nuevo.

---

## 🔐 Seguridad y privacidad

- Cero secretos en los archivos (sin API keys nuevas).
- El CSV se procesa **100% local** en el dispositivo — no se manda a ningún servidor.
- No toca Firebase — no requiere reglas nuevas en Firestore ni Storage.
- **Rotá tu token de GitHub** cuando terminemos la ronda (ya viajó por el chat).

---

## 📌 Notas técnicas

- **Parser CSV a mano**: sin `papaparse` ni libs externas. Maneja comas, punto y coma, comillas (con saltos de línea internos) y BOM.
- **Detección de separador**: cuenta comas vs punto y coma en la primera línea y elige el más frecuente.
- **Dedupe de 7 días**: busca tx con misma fecha + mismo monto (absoluto) + misma descripción (o descripción que incluya la del CSV) en los últimos 7 días. Ventana corta para no marcar como duplicados movimientos legítimamente repetidos (ej: super todos los lunes).
- **Tipo por signo**: si el CSV no tiene columna tipo, los montos positivos se marcan como ingreso y los negativos como gasto. Si tiene columna tipo, se respeta la columna.
- **Diccionario ampliable**: si hay palabras clave que no matchean, se agregan fácilmente a `DICCIONARIO_CATEGORIAS` en `catalogos.ts`.
- **Sin selector de banco**: el parser es genérico y detecta columnas por nombre, así funciona con cualquier banco (BCP, Interbank, BBVA, Yape, Plin) sin configuración específica.
- **IDs anti-colisión**: las tx importadas usan `Date.now()-N` como id (con sufijo numérico) para no chocar entre ellas ni con las existentes.
