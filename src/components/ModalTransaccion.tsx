// ═══════════════════════════════════════════════════════════
// ➕➖ MODAL TRANSACCIÓN — WalletTrack V2 (F0)
// Formulario de ingreso/gasto: monto, categoría (con emoji),
// cuenta, fecha y descripción. Mismos campos y defaults que
// el formulario del viejo (fecha de hoy, 'X General').
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { PlusCircle, MinusCircle, X } from 'lucide-react';
import type { EstadoWallet } from '../types';
import { CATS_GASTO_DEFAULT, CATS_INGRESO_DEFAULT, CUENTAS_CATALOG } from '../data/catalogos';
import { hoyISO, parseMonto } from '../services/dinero';
import type { DatosTransaccion } from '../services/estado';

interface ModalTransaccionProps {
  abierto: boolean;
  tipo: 'income' | 'expense';
  estado: EstadoWallet;
  /** Cuenta/categoría sugerida al abrir (desde tarjeta de cuenta o gasto rápido) */
  sugerida?: { cuenta?: string; categoria?: string; monto?: number; descripcion?: string };
  onCerrar: () => void;
  onGuardar: (datos: DatosTransaccion) => void;
}

export const ModalTransaccion: React.FC<ModalTransaccionProps> = ({
  abierto, tipo, estado, sugerida, onCerrar, onGuardar,
}) => {
  const esIngreso = tipo === 'income';
  const cats = esIngreso
    ? [...CATS_INGRESO_DEFAULT, ...estado.categoriasIngreso]
    : [...CATS_GASTO_DEFAULT, ...estado.categoriasGasto];

  const [montoTxt, setMontoTxt] = useState('');
  const [categoria, setCategoria] = useState(cats[0]?.nombre ?? 'Otros');
  const [cuenta, setCuenta] = useState('efectivo');
  const [fecha, setFecha] = useState(hoyISO());
  const [desc, setDesc] = useState('');
  const [error, setError] = useState('');

  // Al abrir: reset + sugerencias (cuenta de la tarjeta, etc.)
  useEffect(() => {
    if (!abierto) return;
    setMontoTxt(sugerida?.monto ? String(sugerida.monto) : '');
    setCategoria(sugerida?.categoria ?? cats[0]?.nombre ?? 'Otros');
    setCuenta(sugerida?.cuenta ?? 'efectivo');
    setFecha(hoyISO());
    setDesc(sugerida?.descripcion ?? '');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, tipo, sugerida?.cuenta, sugerida?.categoria, sugerida?.monto]);

  // ESC cierra
  useEffect(() => {
    if (!abierto) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  const guardar = () => {
    const monto = parseMonto(montoTxt);
    if (monto === null) {
      setError('Ingresa un monto mayor a cero');
      return;
    }
    if (!categoria) {
      setError('Elige una categoría');
      return;
    }
    onGuardar({
      type: tipo,
      monto,
      categoria,
      cuenta,
      fecha: fecha || hoyISO(),
      descripcion: desc.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCerrar}
        data-testid="modal-transaccion-backdrop"
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`relative w-full sm:max-w-md bg-slate-900 border rounded-t-3xl sm:rounded-3xl border-slate-700 shadow-2xl p-5 max-h-[92vh] overflow-y-auto custom-scrollbar ${
          esIngreso ? 'border-t-2 border-t-emerald-500' : 'border-t-2 border-t-rose-500'
        }`}
        data-testid="modal-transaccion"
      >
        {/* Cabecera */}
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
            esIngreso ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400' : 'bg-rose-500/15 border border-rose-500/40 text-rose-400'
          }`}>
            {esIngreso ? <PlusCircle className="w-5 h-5" /> : <MinusCircle className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <h3 className="text-base font-black text-white">
              {esIngreso ? 'Registrar Ingreso' : 'Registrar Gasto'}
            </h3>
            <p className="text-[11px] text-slate-400">Queda guardado al instante en tu historial</p>
          </div>
          <button
            onClick={onCerrar}
            title="Cerrar"
            className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white flex items-center justify-center transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">Monto (S/)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={montoTxt}
              onChange={(e) => { setMontoTxt(e.target.value); setError(''); }}
              placeholder="0.00"
              autoFocus
              data-testid="input-monto"
              className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">Categoría</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              data-testid="select-categoria"
              className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            >
              {cats.map((c) => (
                <option key={c.id} value={c.nombre}>{c.emoji} {c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Cuenta</label>
              <select
                value={cuenta}
                onChange={(e) => setCuenta(e.target.value)}
                data-testid="select-cuenta"
                className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              >
                {CUENTAS_CATALOG.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                data-testid="input-fecha"
                className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">
              Descripción <span className="text-slate-600 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={`${categoria} General`}
              data-testid="input-desc"
              className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            />
          </div>

          {error && (
            <p data-testid="error-transaccion" className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onCerrar}
              className="flex-1 py-3 rounded-xl border border-slate-600 text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              data-testid="boton-guardar-transaccion"
              className={`flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] ${
                esIngreso
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-500/20'
              }`}
            >
              {esIngreso ? 'Guardar ingreso' : 'Guardar gasto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
