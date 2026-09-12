// ═══════════════════════════════════════════════════════════
// 🤖 WALLETBOT VIEW — WalletTrack V2 (F4)
// El robot de finanzas del original, ahora con vista propia:
//   • Análisis automático del mes (analyzeWallet 1:1: máximo 4
//     mensajes PRIORIZADOS — riesgo > alerta > meta > tendencia
//     > consejo > logro), con los mismos colores por tipo.
//   • Botón Actualizar (mismo "refresh" del dashboard viejo).
//   • Preguntas rápidas: respuestas offline con tus datos
//     reales (sin internet, sin API, sin claves — funciona en
//     el APK sin datos móviles).
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { Bot, RefreshCw, Sparkles } from 'lucide-react';
import type { EstadoWallet } from '../types';
import { analizarWallet, COLOR_MAP, PREGUNTAS_RAPIDAS } from '../services/walletbot';
import { nombreMesActual } from '../services/dinero';

interface WalletBotProps {
  estado: EstadoWallet;
  onToast?: (msg: string) => void;
}

interface MensajeChat {
  icon: string;
  type: keyof typeof COLOR_MAP;
  html: string;
}

export const WalletBotView: React.FC<WalletBotProps> = ({ estado, onToast }) => {
  const [refrescos, setRefrescos] = useState(0);
  const [preguntaActiva, setPreguntaActiva] = useState<string | null>(null);
  const [respuestas, setRespuestas] = useState<Record<string, MensajeChat>>({});

  // Análisis del mes — se recalcula al montar, al cambiar datos
  // o al apretar Actualizar (refrescos).
  const analisis = useMemo<MensajeChat[]>(
    () => analizarWallet(estado).map((m) => ({ icon: m.icon, type: m.type, html: m.text })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [estado, refrescos],
  );

  const actualizar = () => {
    setRefrescos((n) => n + 1);
    setPreguntaActiva(null);
    onToast?.('🤖 Análisis actualizado');
  };

  const preguntar = (id: string) => {
    const p = PREGUNTAS_RAPIDAS.find((x) => x.id === id);
    if (!p) return;
    const { text, type } = p.responder(estado);
    setRespuestas((prev) => ({ ...prev, [id]: { icon: p.icono, type, html: text } }));
    setPreguntaActiva(id);
  };

  return (
    <div className="space-y-4 wt-aparece" data-testid="vista-walletbot">

      {/* ── Tarjeta del robot (mismo look del módulo 7 del viejo) ── */}
      <section
        data-testid="tarjeta-walletbot"
        className="rounded-3xl bg-slate-900 border border-indigo-500/20 p-5 relative overflow-hidden"
      >
        <div className="absolute -right-20 -bottom-20 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="flex items-center justify-between mb-4 relative">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-3 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                WalletBot 2.0
                <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-bold uppercase">
                  IA
                </span>
              </h3>
              <span className="text-xs text-slate-400 block truncate">
                Análisis automático · {nombreMesActual()}
              </span>
            </div>
          </div>
          <button
            onClick={actualizar}
            data-testid="boton-actualizar-bot"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center font-semibold bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20 transition-all shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualizar
          </button>
        </div>

        {/* Mensajes priorizados (colorMap 1:1 del viejo) */}
        <div data-testid="bot-mensajes" className="space-y-2.5 max-h-[26rem] overflow-y-auto no-scrollbar">
          {analisis.length === 0 && (
            <div className="p-4 text-center text-slate-500 text-xs">
              Registra movimientos para activar el análisis.
            </div>
          )}
          {analisis.map((m, i) => {
            const c = COLOR_MAP[m.type];
            return (
              <div
                key={i}
                className="flex items-start gap-2.5 p-3 rounded-2xl border"
                style={{ background: c.bg, borderColor: c.border }}
              >
                <span className="text-lg leading-none mt-0.5 shrink-0">{m.icon}</span>
                <span
                  data-testid={`bot-mensaje-${i}`}
                  className="text-xs leading-relaxed [&_strong]:font-bold"
                  style={{ color: c.text }}
                  dangerouslySetInnerHTML={{ __html: m.html }}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Preguntas rápidas (chat offline con tus datos) ── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <h3 className="font-bold text-slate-200 text-base mb-1 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" /> Preguntale al bot
        </h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Respuestas al instante con tus números reales — sin internet, tus datos nunca salen del aparato.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {PREGUNTAS_RAPIDAS.map((p) => (
            <button
              key={p.id}
              onClick={() => preguntar(p.id)}
              data-testid={`chip-pregunta-${p.id}`}
              className={`text-xs font-bold px-3 py-2 rounded-xl border transition-all active:scale-95 ${
                preguntaActiva === p.id
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-emerald-500/40 hover:text-white'
              }`}
            >
              {p.icono} {p.pregunta}
            </button>
          ))}
        </div>

        {(Object.entries(respuestas) as [string, MensajeChat][]).map(([id, m]) => {
          if (preguntaActiva !== id) return null;
          const c = COLOR_MAP[m.type];
          return (
            <div
              key={id}
              data-testid={`respuesta-${id}`}
              className="flex items-start gap-2.5 p-3 rounded-2xl border wt-aparece"
              style={{ background: c.bg, borderColor: c.border }}
            >
              <span className="text-lg leading-none mt-0.5 shrink-0">{m.icon}</span>
              <span
                className="text-xs leading-relaxed [&_strong]:font-bold"
                style={{ color: c.text }}
                dangerouslySetInnerHTML={{ __html: m.html }}
              />
            </div>
          );
        })}

        {preguntaActiva === null && (
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Tocá una pregunta y el bot responde con el mismo motor del análisis (dinero libre real,
            deudas, categorías y ahorro del mes).
          </p>
        )}
      </section>
    </div>
  );
};
