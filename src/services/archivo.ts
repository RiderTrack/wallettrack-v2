// ═══════════════════════════════════════════════════════════
// 📄 ARCHIVO — WalletTrack V2 (F0)
// Guardar/compartir archivos (respaldo JSON, export CSV):
// en APK usa Filesystem + Share de Capacitor; en web descarga
// directa con <a download>. Mismo flujo que el viejo
// compartirArchivo().
// ═══════════════════════════════════════════════════════════

import { Capacitor } from '@capacitor/core';

export function nombreRespaldo(): string {
  const hoy = new Date().toISOString().split('T')[0];
  return `WalletTrack_Backup_${hoy}.json`;
}

/**
 * Guarda un blob: en APK lo escribe en Documents y abre el
 * sheet de compartir; en web dispara la descarga.
 */
export async function compartirArchivo(blob: Blob, nombre: string): Promise<'apk' | 'web'> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const base64 = await blobABase64(blob);
      const res = await Filesystem.writeFile({
        path: nombre,
        data: base64,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: nombre,
          text: 'WalletTrack V2',
          url: res.uri,
          dialogTitle: 'Compartir respaldo',
        });
      } catch { /* usuario canceló el sheet: el archivo ya quedó guardado */ }
      return 'apk';
    } catch {
      // Fallback: si Filesystem falla, descargar desde el webview
      descargarBlob(blob, nombre);
      return 'apk';
    }
  }
  descargarBlob(blob, nombre);
  return 'web';
}

function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        const resultado = String(reader.result ?? '');
        resolve(resultado.split(',')[1] ?? '');
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** CSV de transacciones (columnas del historial del viejo) */
export function transaccionesACSV(
  filas: { fecha: string; concepto: string; categoria: string; cuenta: string; tipo: string; monto: number }[],
): Blob {
  const cabecera = 'Fecha,Concepto,Categoria,Cuenta,Flujo,Monto';
  const cuerpo = filas.map((f) => {
    const limpio = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    return [f.fecha, limpio(f.concepto), limpio(f.categoria), limpio(f.cuenta), f.tipo, f.monto.toFixed(2)].join(',');
  });
  return new Blob(['\uFEFF' + [cabecera, ...cuerpo].join('\n')], { type: 'text/csv;charset=utf-8' });
}
