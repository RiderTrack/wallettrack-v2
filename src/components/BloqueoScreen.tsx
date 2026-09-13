// ═══════════════════════════════════════════════════════════
// 🔒 PANTALLA DE BLOQUEO — WalletTrack V2 (F5)
// Teclado de 4 dígitos + huella (APK). Pinta SOLO el candado:
// nada de la app se renderiza detrás hasta desbloquear.
// La huella se intenta sola al abrir; si falla o la cancelan,
// el PIN siempre queda de respaldo (nunca te deja afuera).
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import { Delete, Fingerprint, Lock } from 'lucide-react';
import { Wallet } from 'lucide-react';
import { huellaHabilitada, pedirHuella, verificarPin, vibrarCorto } from '../services/seguridad';

interface BloqueoScreenProps {
  onDesbloquear: () => void;
}

export const BloqueoScreen: React.FC<BloqueoScreenProps> = ({ onDesbloquear }) => {
  const [intento, setIntento] = useState('');
  const [fallo, setFallo] = useState(false);
  const [intentos, setIntentos] = useState(0);
  const usaHuella = huellaHabilitada();

  // Intento automático de huella al mostrar el candado
  useEffect(() => {
    let vivo = true;
    if (usaHuella) {
      void pedirHuella('Desbloquea WalletTrack').then((ok) => {
        if (vivo && ok) onDesbloquear();
      });
    }
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const desbloquear = useCallback(() => {
    onDesbloquear();
  }, [onDesbloquear]);

  const marcar = (d: string) => {
    if (intento.length >= 4 || fallo) return;
    void vibrarCorto();
    const nuevo = intento + d;
    setIntento(nuevo);
    if (nuevo.length === 4) {
      // pequeña pausa para que se vea el último punto
      setTimeout(() => {
        if (verificarPin(nuevo)) {
          desbloquear();
        } else {
          setFallo(true);
          setIntentos((n) => n + 1);
          void vibrarCorto();
          setTimeout(() => { setFallo(false); setIntento(''); }, 550);
        }
      }, 120);
    }
  };

  const conHuella = async () => {
    const ok = await pedirHuella('Desbloquea WalletTrack');
    if (ok) desbloquear();
  };

  const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div
      className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 px-6 custom-scrollbar"
      data-testid="pantalla-bloqueo"
    >
      {/* Logo + candado */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl">
          <Wallet className="w-8 h-8 text-white" />
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Lock className="w-4 h-4" />
          <p className="text-sm font-bold">WalletTrack está bloqueado</p>
        </div>
      </div>

      {/* Puntos del PIN */}
      <div className={`flex gap-4 ${fallo ? 'animate-pulse' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            data-testid={`punto-pin-${i}`}
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              fallo
                ? 'bg-rose-500 border-rose-500'
                : intento.length > i
                  ? 'bg-emerald-400 border-emerald-400 scale-110'
                  : 'border-slate-600 bg-transparent'
            }`}
          />
        ))}
      </div>

      {/* Mensaje de estado */}
      <p
        data-testid="mensaje-bloqueo"
        className={`text-xs font-bold h-4 ${fallo ? 'text-rose-400' : 'text-slate-500'}`}
      >
        {fallo
          ? 'PIN incorrecto — intenta de nuevo'
          : intentos > 0
            ? `${intentos} ${intentos === 1 ? 'intento fallido' : 'intentos fallidos'}`
            : 'Ingresa tu PIN de 4 dígitos'}
      </p>

      {/* Teclado */}
      <div className="grid grid-cols-3 gap-3.5">
        {TECLAS.map((t) => (
          <button
            key={t}
            onClick={() => marcar(t)}
            data-testid={`tecla-${t}`}
            className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 hover:border-emerald-500/60 hover:bg-slate-800 active:scale-95 text-2xl font-black text-white transition-all"
          >
            {t}
          </button>
        ))}
        {/* Fila inferior: huella · 0 · borrar */}
        <button
          onClick={conHuella}
          disabled={!usaHuella}
          data-testid="tecla-huella"
          title={usaHuella ? 'Desbloquear con huella' : 'Huella no activada'}
          className={`w-16 h-16 rounded-2xl border flex items-center justify-center transition-all active:scale-95 ${
            usaHuella
              ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-slate-900/50 border-slate-800 text-slate-700'
          }`}
        >
          <Fingerprint className="w-6 h-6" />
        </button>
        <button
          onClick={() => marcar('0')}
          data-testid="tecla-0"
          className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 hover:border-emerald-500/60 hover:bg-slate-800 active:scale-95 text-2xl font-black text-white transition-all"
        >
          0
        </button>
        <button
          onClick={() => { setIntento((v) => v.slice(0, -1)); setFallo(false); }}
          data-testid="tecla-borrar"
          title="Borrar"
          className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 hover:border-rose-500/60 hover:bg-slate-800 active:scale-95 text-slate-400 flex items-center justify-center transition-all"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      <p className="text-[10px] text-slate-600 text-center max-w-xs leading-relaxed">
        Candado local de este aparato — el PIN se configura en Ajustes → Candado
      </p>
    </div>
  );
};
