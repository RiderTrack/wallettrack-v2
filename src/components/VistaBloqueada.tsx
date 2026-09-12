// ═══════════════════════════════════════════════════════════
// 🔒 VISTA BLOQUEADA — WalletTrack V2 (F0)
// Placeholder de las vistas que aterrizan en F1-F3 (mismo
// patrón del FitTrack V2): candado + qué traerá la fase +
// regreso al dashboard. El candado se retira fase a fase.
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';

interface VistaBloqueadaProps {
  nombre: string;
  fase: string;
  descripcion: string;
  novedades: string[];
  onVolver: () => void;
}

export const VistaBloqueada: React.FC<VistaBloqueadaProps> = ({ nombre, fase, descripcion, novedades, onVolver }) => (
  <div className="flex items-center justify-center py-12">
    <div className="max-w-sm w-full text-center px-4">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700 mb-4">
        <Lock className="w-7 h-7 text-slate-400" />
      </div>
      <h2 className="text-lg font-black text-white">{nombre}</h2>
      <span
        data-testid="badge-vista-bloqueada"
        className="inline-block mt-2 text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400"
      >
        {fase}
      </span>
      <p className="text-sm text-slate-400 mt-4 leading-relaxed">{descripcion}</p>

      <div className="mt-5 text-left space-y-2">
        {novedades.map((n) => (
          <div key={n} className="flex items-start gap-2.5 text-xs text-slate-300 bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{n}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onVolver}
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-600 text-sm font-bold text-slate-300 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al dashboard
      </button>
    </div>
  </div>
);
