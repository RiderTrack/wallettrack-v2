// ═══════════════════════════════════════════════════════════
// 📎 COMPROBANTES — WalletTrack V2 (F6 · FOTO DE BOLETA)
// Sube fotos de los comprobantes a Firebase Storage del proyecto
// fittrack-e06be, en la carpeta propia del usuario:
//   wallettrack_comprobantes/{uid}/{txId}.jpg
// Reglas de Storage (las publica el usuario en la Console, igual
// que con wallettrack_sync): solo el dueño lee/escribe sus archivos.
//
// FUNCIONAMIENTO OFFLINE PRIMERO:
//   • Captura (web: input file · APK: @capacitor/camera) → JPEG.
//   • Compresión a máx 1280px / calidad 0.8 vía canvas (evita
//     subir fotos de 5 MB del celular).
//   • Se guarda como `comprobanteLocal` (dataURL) en la tx → el
//     historial muestra el thumbnail al instante, sin internet.
//   • Una cola persistente en localStorage (`WT2_COLA_COMP`) lleva
//     el registro de tx con `comprobanteLocal` pendientes de subir.
//   • Al subir OK → se reemplaza `comprobanteLocal` por
//     `comprobanteUrl` (URL pública del Storage) y se quita de la
//     cola. El sync normal propaga el cambio a la nube.
//   • Si no hay sesión (modo local) o no hay internet, la cola
//     espera. Nunca se pierde: sobrevive a recargas y restarts.
//   • Borrar la tx → borrar el archivo del Storage (si subió) y
//     sacar de la cola.
// ═══════════════════════════════════════════════════════════

import { Capacitor } from '@capacitor/core';
import {
  ref, uploadString, getDownloadURL, deleteObject, uploadBytes,
} from 'firebase/storage';
import { storage } from './firebase';
import { leerEstado, persistirSilencioso } from './estado';
import type { Transaccion } from '../types';

const CLAVE_COLA = 'WT2_COLA_COMP';
const MAX_DIM = 1280;            // máx 1280px (largo o ancho)
const CALIDAD_JPEG = 0.8;
const MIME = 'image/jpeg';

// ═══════════════════════════════════════════════════════════
// 📸 CAPTURA — web (input file) y APK (Cámara)
// ═══════════════════════════════════════════════════════════

export interface ResultadoCaptura {
  ok: boolean;
  dataUrl?: string;     // JPEG comprimido, listo para subir
  error?: string;
}

/**
 * Captura una imagen desde la cámara (APK) o el input file (web),
 * la comprime a JPEG máx 1280px / 0.8 calidad y devuelve un dataURL.
 * En APK pide cámara; en web abre el selector de archivos.
 */
export async function capturarComprobante(usarCamara: boolean): Promise<ResultadoCaptura> {
  try {
    if (Capacitor.isNativePlatform()) {
      // APK → @capacitor/camera (plugin nativo)
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const foto = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: usarCamara ? CameraSource.Camera : CameraSource.Photos,
        saveToGallery: false,
        correctOrientation: true,
      });
      if (!foto.dataUrl) return { ok: false, error: 'No se pudo capturar la imagen' };
      // Re-comprimir siempre (el quality del plugin varía por dispositivo)
      const comprimido = await comprimirDataURL(foto.dataUrl);
      return { ok: true, dataUrl: comprimido };
    }
    // Web → input file
    const dataUrl = await elegirArchivoWeb();
    if (!dataUrl) return { ok: false, error: 'No se seleccionó ninguna imagen' };
    const comprimido = await comprimirDataURL(dataUrl);
    return { ok: true, dataUrl: comprimido };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al capturar' };
  }
}

/** En web: abre el selector de archivos y devuelve un dataURL */
function elegirArchivoWeb(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // sugerir cámara trasera en móviles
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

/**
 * Comprime un dataURL (cualquier formato) a JPEG máx 1280px / 0.8.
 * Devuelve un dataURL JPEG. Si falla el canvas, devuelve el original.
 */
async function comprimirDataURL(dataUrl: string): Promise<string> {
  try {
    const img = await cargarImagen(dataUrl);
    let { width, height } = img;
    if (width > MAX_DIM || height > MAX_DIM) {
      const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL(MIME, CALIDAD_JPEG);
  } catch {
    return dataUrl; // sin canvas (¿SSR?): devolver original
  }
}

function cargarImagen(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Imagen inválida'));
    img.src = dataUrl;
  });
}

// ═══════════════════════════════════════════════════════════
// ☁️ SUBIDA — Firebase Storage
// ═══════════════════════════════════════════════════════════

/** Path canónico del comprobante de una tx para un uid */
function pathComprobante(uid: string, txId: string): string {
  return `wallettrack_comprobantes/${uid}/${txId}.jpg`;
}

/**
 * Sube el comprobante de una tx al Storage y devuelve la URL pública.
 * Reemplaza el archivo si ya existía (mismo path → overwrite).
 */
export async function subirComprobante(
  uid: string, txId: string, dataUrl: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!storage) return { ok: false, error: 'Firebase Storage no disponible' };
  try {
    const r = ref(storage, pathComprobante(uid, txId));
    // dataURL → uploadString (formato data_url)
    await uploadString(r, dataUrl, 'data_url', { contentType: MIME });
    const url = await getDownloadURL(r);
    return { ok: true, url };
  } catch (e: unknown) {
    const code = String((e as { code?: unknown })?.code ?? '');
    if (code.includes('storage/unauthorized')) {
      return { ok: false, error: 'storage-unauthorized' };
    }
    return { ok: false, error: e instanceof Error ? e.message : 'Error al subir' };
  }
}

/**
 * Sube un Blob/File (para web cuando el usuario arrastra un archivo).
 * Mantenido por simetría con subirComprobante.
 */
export async function subirComprobanteBlob(
  uid: string, txId: string, file: Blob,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!storage) return { ok: false, error: 'Firebase Storage no disponible' };
  try {
    const r = ref(storage, pathComprobante(uid, txId));
    await uploadBytes(r, file, { contentType: MIME });
    const url = await getDownloadURL(r);
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al subir' };
  }
}

/** Borra el comprobante del Storage (si subió). No falla si no existe. */
export async function borrarComprobante(uid: string, txId: string): Promise<void> {
  if (!storage) return;
  try {
    await deleteObject(ref(storage, pathComprobante(uid, txId)));
  } catch {
    /* archivo ya borrado o nunca subió — ok */
  }
}

// ═══════════════════════════════════════════════════════════
// 📮 COLA OFFLINE — persistente en localStorage
// ═══════════════════════════════════════════════════════════

interface ItemCola {
  txId: string;
  uid: string;
  dataUrl: string;        // el JPEG comprimido pendiente
  intentos: number;       // para backoff suave
  ultimoIntento: number;  // epoch ms
}

function leerCola(): ItemCola[] {
  try {
    const crudo = localStorage.getItem(CLAVE_COLA);
    if (!crudo) return [];
    const arr = JSON.parse(crudo);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function guardarCola(cola: ItemCola[]): void {
  try {
    localStorage.setItem(CLAVE_COLA, JSON.stringify(cola));
  } catch { /* sin espacio */ }
}

/** Encola un comprobante para subir cuando haya conexión */
export function encolarComprobante(uid: string, txId: string, dataUrl: string): void {
  const cola = leerCola().filter((i) => i.txId !== txId); // dedupe
  cola.push({ txId, uid, dataUrl, intentos: 0, ultimoIntento: 0 });
  guardarCola(cola);
}

/** Quita una tx de la cola (porque ya subió o se borró la tx) */
export function desencolar(txId: string): void {
  guardarCola(leerCola().filter((i) => i.txId !== txId));
}

/** Cantidad pendiente (para mostrar en la UI, ej: Ajustes) */
export function pendientesCola(): number {
  return leerCola().length;
}

let _procesando = false;

/**
 * Recorre la cola y sube todo lo pendiente. Actualiza el estado
 * (reemplaza comprobanteLocal por comprobanteUrl en la tx) y
 * persiste en silencio (el sync normal propaga el cambio).
 * Devuelve cuántos subió OK.
 */
export async function procesarCola(): Promise<{ subidos: number; fallidos: number }> {
  if (_procesando) return { subidos: 0, fallidos: 0 };
  _procesando = true;
  let subidos = 0;
  let fallidos = 0;
  try {
    const cola = leerCola();
    if (cola.length === 0) return { subidos: 0, fallidos: 0 };
    let estado = leerEstado();
    let cambio = false;
    const nuevosPendientes: ItemCola[] = [];

    for (const item of cola) {
      // Si la tx ya no existe (la borraron), sacar de la cola
      const tx = estado.transactions.find((t) => t.id === item.txId);
      if (!tx) continue;

      // Si ya tiene URL, sacar de la cola (ya subió por otro lado)
      if (tx.comprobanteUrl) continue;

      const r = await subirComprobante(item.uid, item.txId, item.dataUrl);
      if (r.ok && r.url) {
        estado = {
          ...estado,
          transactions: estado.transactions.map((t) =>
            t.id === item.txId
              ? { ...t, comprobanteUrl: r.url, comprobanteLocal: undefined }
              : t),
        };
        cambio = true;
        subidos++;
      } else {
        // Si fue unauthorized, no reintentar (reglas de Storage faltan)
        if (r.error === 'storage-unauthorized') {
          fallidos++;
          continue; // descartar de la cola (no reintentar)
        }
        // Otro error (offline?) → dejar en cola con backoff
        item.intentos += 1;
        item.ultimoIntento = Date.now();
        if (item.intentos < 10) nuevosPendientes.push(item);
        else fallidos++; // demasiado intentos → descartar
      }
    }

    if (cambio) persistirSilencioso(estado);
    guardarCola(nuevosPendientes);
    return { subidos, fallidos };
  } finally {
    _procesando = false;
  }
}

// ═══════════════════════════════════════════════════════════
// 🗑️ BORRADO — tx eliminada → borrar archivo y sacar de cola
// ═══════════════════════════════════════════════════════════

/** Limpia todo rastro del comprobante de una tx (cola + Storage) */
export async function limpiarComprobanteTx(uid: string | null, tx: Transaccion): Promise<void> {
  desencolar(tx.id);
  if (uid && tx.comprobanteUrl) {
    await borrarComprobante(uid, tx.id);
  }
}

// ═══════════════════════════════════════════════════════════
// 🩺 DIAGNÓSTICO — para la tarjeta de Ajustes
// ═══════════════════════════════════════════════════════════

export interface DiagnosticoComprobantes {
  storageDisponible: boolean;
  pendientes: number;
  totalConComprobante: number;
}

export function diagnosticarComprobantes(): DiagnosticoComprobantes {
  const estado = leerEstado();
  return {
    storageDisponible: !!storage,
    pendientes: pendientesCola(),
    totalConComprobante: estado.transactions.filter(
      (t) => t.comprobanteUrl || t.comprobanteLocal).length,
  };
}

/** Reglas de Storage para pegar en la Firebase Console (como el doctor del sync) */
export const REGLA_STORAGE_WALLETTRACK = `match /wallettrack_comprobantes/{uid}/{fileName} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}`;
