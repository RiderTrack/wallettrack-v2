// ═══════════════════════════════════════════════════════════
// 🖼️ COMPROBANTE VIEWER — WalletTrack V2 (F6)
// Pantalla completa con zoom para ver la foto del comprobante.
// Soporta dataURL (pendiente de subir) y URL de Storage.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';

interface ComprobanteViewerProps {
  abierto: boolean;
  src: string | null;        // dataURL o URL
  descripcion?: string;      // descripción de la tx (título)
  onCerrar: () => void;
}

export const ComprobanteViewer: React.FC<ComprobanteViewerProps> = ({
  abierto, src, descripcion, onCerrar,
}) => {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (abierto) setZoom(1);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [abierto, onCerrar]);

  if (!abierto || !src) return null;

  const descargar = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = `comprobante_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center"
      onClick={onCerrar}
      data-testid="comprobante-viewer"
    >
      {/* Barra superior */}
      <div
        className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1">
          <p className="text-white font-bold text-sm truncate">{descripcion || 'Comprobante'}</p>
          <p className="text-slate-400 text-[11px]">Tocá afuera para cerrar</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
            disabled={zoom <= 1}
            title="Alejar"
            className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-slate-300 text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            disabled={zoom >= 4}
            title="Acercar"
            className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={descargar}
            title="Descargar"
            className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-600 text-white flex items-center justify-center transition-all"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={onCerrar}
            title="Cerrar"
            className="w-10 h-10 rounded-xl bg-rose-600/80 border border-rose-500 text-white flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Imagen con zoom */}
      <div
        className="flex-1 w-full flex items-center justify-center overflow-hidden p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={descripcion || 'Comprobante'}
          onClick={onCerrar}
          style={{ transform: `scale(${zoom})` }}
          className="max-w-full max-h-full object-contain transition-transform duration-150 select-none"
          data-testid="comprobante-img"
        />
      </div>
    </div>
  );
};
