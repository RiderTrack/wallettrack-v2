# 📦 LEEME — FASE 6 · COMPROBANTES (FOTO DE BOLETA)
## WalletTrack V2 · versionCode 8 · versionName 1.6.0 · APK `WalletTrack-V2-F6.apk`

---

## ⚡ LO MÁS IMPORTANTE PRIMERO: reglas de Storage

Para que los comprobantes suban a la nube, falta **AGREGAR UN BLOQUE** a las reglas de **Firebase Storage** (no Firestore — Storage). Es una sola vez, igual que hiciste con `wallettrack_sync` en F5.

### El arreglo (5 minutos, una sola vez):

1. Entrá a **https://console.firebase.google.com** → proyecto **fittrack-e06be**
2. Menú lateral: **Storage** → pestaña **Reglas**
3. Si Storage todavía NO está inicializado en este proyecto:
   - Te va a salir **"Get started"** → hacé click → elegí **Production mode** → **Done**.
   - Después volvé a la pestaña Reglas.
4. Vas a ver algo como `match /b/{bucket}/o { ... }` con reglas existentes (o vacío). **NO borres nada** — solo AGREGÁ este bloque adentro, junto a los demás `match` si los hay:

```
    match /wallettrack_comprobantes/{uid}/{fileName} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
```

5. Apretá **Publicar**. Listo.

> Ejemplo de cómo queda (si Storage estaba vacío):
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /wallettrack_comprobantes/{uid}/{fileName} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

> Si ya tenías reglas de Storage del FitTrack o del bot, **AGREGÁ el bloque nuevo sin borrar las existentes**.

### ¿Qué pasa si no publicás la regla?
- La app funciona igual: la foto se guarda local y se ve en el historial.
- El thumbnail tiene un **puntito naranja** indicando que está pendiente de subir.
- La cola reintenta cada vez que abrís la app o volvés al frente.
- Cuando publiques la regla, la próxima vez que abras la app sube todo lo pendiente y los puntitos naranjas desaparecen.

---

## 🆕 Qué trae la FASE 6

### 📎 Comprobantes en cada transacción
- En el modal de gasto/ingreso → botón **"📎 Comprobante"** con dos opciones:
  - **📷 Cámara**: abre la cámara del celular (APK) o pide foto en web.
  - **🖼️ Galería**: elegí una imagen del carrete (APK) o del disco (web).
- La foto se **comprime automáticamente** a máx 1280px / calidad 80% antes de subirla — evita que una foto de 5 MB del celular te llene el Storage.
- Se guarda en **Firebase Storage** del proyecto `fittrack-e06be`, en la carpeta propia de tu cuenta: `wallettrack_comprobantes/{tuUid}/{txId}.jpg`. **Solo vos** podés leer y escribir tus comprobantes (la regla de arriba lo garantiza).

### 🖼️ Thumbnail en el historial
- En el historial, cada fila con comprobante muestra un **thumbnail cuadrado** de la foto.
- Si el comprobante todavía no subió a la nube (cola offline), el thumbnail tiene un **puntito naranja** en la esquina.
- Tocá el thumbnail → se abre el **viewer pantalla completa** con zoom (botones +/−, descarga y cerrar).

### 📮 Cola offline (sube solo cuando hay internet)
- Si cargás un gasto con foto **sin conexión**, la foto se guarda local y se ve en el historial al instante.
- Una cola persistente en localStorage lleva el registro de pendientes.
- Cuando vuelva la conexión y abras la app (o vuelvas al frente), la cola **procesa todo pendiente** automáticamente.
- Si la subida falla por la regla de Storage, ese comprobante se descarta de la cola (no reintenta infinitamente) — publicá la regla y volvé a adjuntar la foto.
- La cola sobrevive a recargas y restarts del navegador/APK.

### 🔄 Sync de comprobantes entre teléfonos
- El `comprobanteUrl` (la URL pública del Storage) viaja con la transacción en el sync Firestore normal (`wallettrack_sync`).
- Si cargás un gasto con foto en el teléfono A, el teléfono B lo ve con su thumbnail al sincronizar.
- **El archivo físico NO viaja por Firestore** — vive en Storage. Firestore solo guarda la URL.
- Si borrás una transacción, el archivo del Storage también se borra automáticamente (limpieza completa).

### 🧹 Lo que sigue igual (NO se rompe nada de F0–F5)
- Las transacciones **sin comprobante** funcionan exactamente igual.
- Los respaldos JSON viejos (sin campos F6) importan sin conversión.
- Los respaldos nuevos incluyen los comprobantes automáticamente.
- Sobres, deudas, presupuestos, metas, compras, estadísticas, WalletBot, Theme Studio, candado, recordatorios, recurrentes, categorías y cuentas propias — todo intacto.

---

## 🔢 Changelog técnico (archivo → qué cambió)

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `src/types.ts` | `Transaccion` +`comprobanteUrl?: string` +`comprobanteLocal?: string` |
| 2 | `src/services/firebase.ts` | +`getStorage` de firebase/storage · export `storage` |
| 3 | `src/services/comprobantes.ts` **(NUEVO)** | Captura (web input file / APK @capacitor/camera) · compresión JPEG máx 1280px/0.8 vía canvas · `subirComprobante` (uploadString a `wallettrack_comprobantes/{uid}/{txId}.jpg`) · `borrarComprobante` (deleteObject) · cola offline persistente (`WT2_COLA_COMP`) con backoff · `procesarCola` (procesa pendientes, reemplaza `comprobanteLocal` por `comprobanteUrl`) · `limpiarComprobanteTx` (cola + Storage al borrar) · `REGLA_STORAGE_WALLETTRACK` para diagnóstico |
| 4 | `src/services/estado.ts` | `DatosTransaccion` +`comprobanteLocal?` +`comprobanteUrl?` · `agregarTransaccion` los copia a la nueva tx · +`obtenerTransaccion` (helper para limpiar comprobante al eliminar) |
| 5 | `src/components/ComprobanteViewer.tsx` **(NUEVO)** | Pantalla completa con zoom (1x–4x), botones +/−/descarga/cerrar, ESC cierra, click fuera cierra |
| 6 | `src/components/ModalTransaccion.tsx` | Bloque "📎 Comprobante" con botones 📷 Cámara / 🖼️ Galería · preview con thumbnail + quitar · estado "procesando imagen" · pasa `comprobanteLocal` en `onGuardar` |
| 7 | `src/components/HistorialView.tsx` | Columna "Comp." en la tabla · thumbnail clickable → abre viewer · puntito naranja si pendiente de subir · icono gris claro si no tiene comprobante · `<ComprobanteViewer>` cableado al final |
| 8 | `src/App.tsx` | `guardarTransaccion` encola comprobante (si hay `comprobanteLocal` y sesión) y dispara `procesarCola` · +`eliminarTransaccionConComprobante` (limpia Storage+cola antes de sacar del estado) · useEffect procesa cola al arrancar (con 2s de gracia) y al volver al frente · badge `F6 · COMPROBANTES` · splash `F6` |
| 9 | `src/services/platform.ts` | `versionApp() → 'F6 · Comprobantes'` |
| 10 | `firestore.rules` (borrador) | +nota con la regla de Storage para referencia |
| 11 | `storage.rules` **(NUEVO, borrador)** | Documentación de la regla de Storage a pegar en la Console |
| 12 | `package.json` | +`@capacitor/camera@^6.1.0` (plugin oficial Capacitor 6 para cámara nativa APK) |
| 13 | `.github/workflows/build.yml` | versionCode 8 · versionName 1.6.0 · `WalletTrack-V2-F6.apk` · +permiso `CAMERA` en AndroidManifest (junto a INTERNET/VIBRATE/POST_NOTIFICATIONS/STORAGE ya existentes) |

**Nuevo plugin**: `@capacitor/camera` (oficial Capacitor 6). El CI corre `cap sync` → se registra solo.

---

## 📲 Instalación

1. Cuando el CI termine de armar la APK, bajá el artifact `WalletTrack-V2-APK` del último run verde.
2. Descomprimilo → instalá `WalletTrack-V2-F6.apk` (versionCode 8 — **instala encima de F5, tus datos quedan intactos**).
3. Android te va a pedir permiso de cámara la primera vez que toques "📷 Cámara" en el modal — aceptalo (sin ese permiso no abre la cámara).
4. Hacé la **REGLA DE STORAGE** de arriba (una sola vez).
5. Probá según la lista de abajo.

---

## ✅ Qué verificar después de instalar (en orden)

1. **Badge**: header dice `F6 · COMPROBANTES` y Ajustes → versión `F6 · Comprobantes`.
2. **Sin comprobante (compat)**: registrá un gasto **sin** adjuntar foto → guardá → aparece en el historial como siempre (sin thumbnail, sin romper).
3. **Con comprobante (cámara APK)**: + Gasto → "📷 Cámara" → aceptá el permiso → sacá una foto → vista previa con thumbnail → guardá → en el historial aparece el thumbnail en esa fila.
4. **Con comprobante (galería)**: + Gasto → "🖼️ Galería" → elegí una imagen → thumbnail → guardá → historial muestra thumbnail.
5. **Viewer pantalla completa**: tocá el thumbnail del historial → se abre el viewer con la imagen grande → probá zoom +/− → botón descarga → cerrar (X o ESC o click afuera).
6. **Quitar comprobante del modal**: + Gasto → adjuntá foto → tocá el tacho rojo al lado del thumbnail → la foto se quita → guardá → no queda comprobante.
7. **Cola offline (modo avión)**:
   - Activá modo avión en el celular.
   - Cargá un gasto con foto → guardá.
   - Mirá el thumbnail: tiene un **puntito naranja** en la esquina (pendiente de subir).
   - Desactivá modo avión → salí de la app y volvé a entrar → a los 2 segundos el puntito naranja desaparece (subió a la nube).
8. **Sync entre teléfonos** (si tenés otro equipo con sesión Google):
   - En el teléfono A cargá un gasto con foto y esperá que suba (sin puntito naranja).
   - En el teléfono B abrí la app → sincroniza → el gasto aparece con su thumbnail (la foto viene del Storage, no de Firestore).
9. **Borrar tx con comprobante**: en el historial, eliminá una tx que tenía foto → confirmá → la tx desaparece y el archivo del Storage también se borra (no queda basura).
10. **Regla de Storage sin publicar (opcional, diagnóstico)**:
    - Antes de publicar la regla, cargá un gasto con foto → el thumbnail queda con puntito naranja por siempre.
    - Andá a la Console → Storage → Reglas → pegá el bloque de arriba → Publicar.
    - Volvé a abrir la app → a los 2 segundos sube y el puntito desaparece.
11. **Todo lo anterior sigue igual**: sobres, deudas, presupuestos, metas, compras, estadísticas, WalletBot, Theme Studio, candado, recordatorios, recurrentes, categorías y cuentas propias, export Excel/PDF, sync Firestore.

---

## 🧪 Validación hecha antes de entregar

- `tsc --noEmit`: **0 errores** · `vite build`: **OK 9.93s** (mismos chunks lazy de Excel/PDF — no engorda el bundle principal).
- **Smoke F6: 20/20 OK** (tx sin comprobante compat, tx con comprobanteLocal persiste, localStorage round-trip, respaldo viejo sin campos F6 importa sin romper, cola offline con dedupe, eliminarTransaccion no toca Storage, obtenerTransaccion, regla Storage con forma correcta, export incluye comprobantes).
- **Dev server** arranca en `vite --port 3299` y responde 200.
- **Sin errores de consola** en el bundle de producción.
- **Compatibilidad 1:1**: un respaldo de F5 (o del viejo) importa sin tocar los comprobantes — las tx viejas quedan sin comprobante y funcionan igual.

---

## 🔐 Seguridad

- Cero secretos en los archivos (la API key de Firebase es la pública de siempre, ya estaba en F1).
- Las reglas de Storage garantizan que **solo el dueño** del uid puede leer/escribir sus comprobantes — ni siquiera el admin del proyecto puede verlos sin auth.
- Las fotos se comprimen antes de subirse (no se manda la foto original de 5 MB).
- La cola offline vive en localStorage del navegador/APK — no viaja a ningún lado hasta que se sube al Storage.
- **Rotá tu token de GitHub** cuando terminemos la ronda (ya viajó por el chat).

---

## 📌 Notas técnicas

- **`@capacitor/camera` vs input file**: en APK se usa el plugin nativo (`Camera.getPhoto`) que abre la app de cámara del sistema. En web se usa un `<input type="file" accept="image/*" capture="environment">` que en móviles sugiere la cámara trasera y en desktop abre el selector de archivos.
- **Compresión**: el canvas re-encodea a JPEG máx 1280px / calidad 0.8 sin importar el formato de origen. Una foto de 4 MB queda en ~150 KB. Esto mantiene el Storage liviano y la subida rápida incluso con datos móviles.
- **Path canónico**: `wallettrack_comprobantes/{uid}/{txId}.jpg` — el `txId` es el `Date.now()` de la transacción. Si subís dos fotos para la misma tx (no es posible desde la UI, pero por robustez), la segunda sobreescribe la primera (mismo path).
- **Borrado de Storage**: `deleteObject` no falla si el archivo no existe (caso: tx vieja con `comprobanteUrl` pero el archivo fue borrado manualmente en la Console).
- **Firestore no guarda el archivo**: solo guarda `comprobanteUrl` (URL pública) dentro de la transacción. El peso del documento no cambia — la foto vive en Storage.
