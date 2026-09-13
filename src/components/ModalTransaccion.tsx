// ═══════════════════════════════════════════════════════════
// ➕➖ MODAL TRANSACCIÓN — WalletTrack V2 (F0)
// Formulario de ingreso/gasto: monto, categoría (con emoji),
// cuenta, fecha y descripción. Mismos campos y defaults que
// el formulario del viejo (fecha de hoy, 'X General').
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { PlusCircle, MinusCircle, X, Plus, Paperclip, Trash2, Camera, Image as ImageIcon } from 'lucide-react';
import type { EstadoWallet } from '../types';
import { CATS_GASTO_DEFAULT, CATS_INGRESO_DEFAULT, todasLasCuentas, EMOJIS_NUEVA } from '../data/catalogos';
import { hoyISO, parseMonto } from '../services/dinero';
import type { DatosTransaccion } from '../services/estado';
import { capturarComprobante } from '../services/comprobantes';

interface ModalTransaccionProps {
  abierto: boolean;
  tipo: 'income' | 'expense';
  estado: EstadoWallet;
  /** Cuenta/categoría sugerida al abrir (desde tarjeta de cuenta o gasto rápido) */
  sugerida?: { cuenta?: string; categoria?: string; monto?: number; descripcion?: string };
  onCerrar: () => void;
  onGuardar: (datos: DatosTransaccion) => void;
  /** F5: crea una categoría propia (la persiste y avisa al sync) */
  onCrearCategoria?: (flujo: 'income' | 'expense', nombre: string, emoji: string) => boolean;
}

export const ModalTransaccion: React.FC<ModalTransaccionProps> = ({
  abierto, tipo, estado, sugerida, onCerrar, onGuardar, onCrearCategoria,
}) => {
  const esIngreso = tipo === 'income';
  const cats = esIngreso
    ? [...CATS_INGRESO_DEFAULT, ...estado.categoriasIngreso]
    : [...CATS_GASTO_DEFAULT, ...estado.categoriasGasto];
  const cuentas = todasLasCuentas(estado);

  const [montoTxt, setMontoTxt] = useState('');
  const [categoria, setCategoria] = useState(cats[0]?.nombre ?? 'Otros');
  const [cuenta, setCuenta] = useState('efectivo');
  const [fecha, setFecha] = useState(hoyISO());
  const [desc, setDesc] = useState('');
  const [error, setError] = useState('');

  // F5 · mini-form de categoría propia
  const [creandoCat, setCreandoCat] = useState(false);
  const [nuevoEmoji, setNuevoEmoji] = useState('🏷️');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [errorCat, setErrorCat] = useState('');

  // F6 · comprobante (foto de boleta) — dataURL pendiente de subir
  const [comprobante, setComprobante] = useState<string | null>(null);
  const [subiendoComprob, setSubiendoComprob] = useState(false);
  const [errorComprob, setErrorComprob] = useState('');

  // Al abrir: reset + sugerencias (cuenta de la tarjeta, etc.)
  useEffect(() => {
    if (!abierto) return;
    setMontoTxt(sugerida?.monto ? String(sugerida.monto) : '');
    setCategoria(sugerida?.categoria ?? cats[0]?.nombre ?? 'Otros');
    setCuenta(sugerida?.cuenta ?? 'efectivo');
    setFecha(hoyISO());
    setDesc(sugerida?.descripcion ?? '');
    setError('');
    setCreandoCat(false);
    setNuevoNombre('');
    setNuevoEmoji('🏷️');
    setErrorCat('');
    setComprobante(null);
    setSubiendoComprob(false);
    setErrorComprob('');
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
      comprobanteLocal: comprobante ?? undefined,
    });
  };

  // F6 · Capturar comprobante (cámara o galería)
  const tomarComprobante = async (usarCamara: boolean) => {
    setSubiendoComprob(true);
    setErrorComprob('');
    const r = await capturarComprobante(usarCamara);
    setSubiendoComprob(false);
    if (r.ok && r.dataUrl) {
      setComprobante(r.dataUrl);
    } else if (r.error) {
      setErrorComprob(r.error);
    }
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

            {/* F5 · crear categoría propia (se guarda para siempre y viaja a la nube) */}
            {!creandoCat ? (
              <button
                onClick={() => { setCreandoCat(true); setErrorCat(''); }}
                data-testid="boton-nueva-categoria"
                className="mt-1.5 text-[11px] font-bold text-emerald-400/90 hover:text-emerald-300 flex items-center gap-1 transition-all"
              >
                <Plus className="w-3 h-3" /> Nueva categoría
              </button>
            ) : (
              <div className="mt-1.5 rounded-xl bg-slate-950/70 border border-emerald-500/30 p-2.5 space-y-2" data-testid="form-nueva-categoria">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nuevoNombre}
                    onChange={(e) => { setNuevoNombre(e.target.value); setErrorCat(''); }}
                    placeholder="Nombre (ej: Delivery)"
                    maxLength={24}
                    data-testid="input-nueva-cat-nombre"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <button
                    onClick={() => {
                      if (!onCrearCategoria) return;
                      const ok = onCrearCategoria(tipo, nuevoNombre, nuevoEmoji);
                      if (ok) {
                        setCategoria(nuevoNombre.trim());
                        setCreandoCat(false);
                        setNuevoNombre('');
                      } else {
                        setErrorCat('No se pudo crear (¿ya existe?)');
                      }
                    }}
                    data-testid="boton-guardar-categoria"
                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                  >
                    Crear
                  </button>
                  <button
                    onClick={() => setCreandoCat(false)}
                    className="px-2.5 py-2 rounded-lg border border-slate-600 text-slate-400 text-xs font-bold"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {EMOJIS_NUEVA.slice(0, 12).map((e) => (
                    <button
                      key={e}
                      onClick={() => setNuevoEmoji(e)}
                      className={`w-7 h-7 rounded-lg text-sm leading-none flex items-center justify-center border transition-all ${
                        nuevoEmoji === e ? 'border-emerald-500 bg-emerald-500/15' : 'border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                {errorCat && <p className="text-[10px] font-bold text-rose-400">{errorCat}</p>}
              </div>
            )}
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
                {cuentas.map((c) => (
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

          {/* F6 · 📎 Comprobante (foto de boleta) */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">
              Comprobante <span className="text-slate-600 font-normal">(opcional)</span>
            </label>
            {comprobante ? (
              <div className="rounded-xl bg-slate-950/70 border border-emerald-500/30 p-2.5" data-testid="comprobante-preview">
                <div className="flex gap-2.5">
                  <img
                    src={comprobante}
                    alt="Comprobante"
                    className="w-16 h-16 rounded-lg object-cover border border-slate-700"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-[11px] font-bold text-emerald-400 truncate">Comprobante adjunto</p>
                    <p className="text-[10px] text-slate-500">Se sube a la nube cuando guardes</p>
                  </div>
                  <button
                    onClick={() => setComprobante(null)}
                    title="Quitar comprobante"
                    data-testid="boton-quitar-comprobante"
                    className="w-8 h-8 rounded-lg border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 flex items-center justify-center self-center transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : subiendoComprob ? (
              <div className="rounded-xl bg-slate-950/70 border border-slate-700 p-3 flex items-center gap-2.5" data-testid="comprobante-cargando">
                <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-[11px] text-slate-400">Procesando imagen…</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2" data-testid="comprobante-acciones">
                <button
                  onClick={() => tomarComprobante(true)}
                  data-testid="boton-comprobante-camara"
                  disabled={subiendoComprob}
                  className="py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 hover:border-emerald-500/50 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" /> Cámara
                </button>
                <button
                  onClick={() => tomarComprobante(false)}
                  data-testid="boton-comprobante-galeria"
                  disabled={subiendoComprob}
                  className="py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 hover:border-emerald-500/50 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <ImageIcon className="w-4 h-4" /> Galería
                </button>
              </div>
            )}
            {errorComprob && (
              <p className="text-[10px] font-bold text-rose-400 mt-1.5">{errorComprob}</p>
            )}
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
