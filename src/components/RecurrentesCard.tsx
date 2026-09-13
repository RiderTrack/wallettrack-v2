// ═══════════════════════════════════════════════════════════
// 🔁 RECURRENTES — WalletTrack V2 (F5 · Movimientos programados)
// El sueldo RiderTrack semanal, el alquiler mensual… se crean
// UNA vez y la app los registra SOLA (catch-up al abrir + tras
// bajar la nube). Vive arriba del Historial porque SON
// transacciones: cada una que se registra aparece ahí abajo
// con la marca 🔁 y la descripción "(programado)".
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Repeat, Plus, Trash2, Pause, Play, ChevronDown, ChevronUp } from 'lucide-react';
import type { EstadoWallet, Recurrente } from '../types';
import { CATS_GASTO_DEFAULT, CATS_INGRESO_DEFAULT, todasLasCuentas } from '../data/catalogos';
import { soles, parseMonto, hoyISO, fechaCorta } from '../services/dinero';
import {
  aplicarRecurrentesPendientes, crearRecurrente, eliminarRecurrente,
  toggleRecurrente, proximaFechaRecurrente, siguienteOcurrenciaISO,
} from '../services/estado';

interface RecurrentesCardProps {
  estado: EstadoWallet;
  onAplicar: (nuevo: EstadoWallet) => void;
  onToast: (mensaje: string) => void;
}

const FREQ_LABEL: Record<Recurrente['frecuencia'], string> = {
  semanal: 'cada semana',
  quincenal: 'cada 15 días',
  mensual: 'cada mes',
};

export const RecurrentesCard: React.FC<RecurrentesCardProps> = ({ estado, onAplicar, onToast }) => {
  const [abierto, setAbierto] = useState(false);
  const [creando, setCreando] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  // Formulario
  const [nombre, setNombre] = useState('');
  const [montoTxt, setMontoTxt] = useState('');
  const [tipo, setTipo] = useState<'income' | 'expense'>('income');
  const [categoria, setCategoria] = useState('RiderTrack');
  const [cuenta, setCuenta] = useState('efectivo');
  const [frecuencia, setFrecuencia] = useState<Recurrente['frecuencia']>('semanal');
  const [inicio, setInicio] = useState(hoyISO());
  const [error, setError] = useState('');

  const cats = tipo === 'income'
    ? [...CATS_INGRESO_DEFAULT, ...estado.categoriasIngreso]
    : [...CATS_GASTO_DEFAULT, ...estado.categoriasGasto];
  const cuentas = todasLasCuentas(estado);

  const guardar = () => {
    const monto = parseMonto(montoTxt);
    const r = crearRecurrente(estado, {
      nombre, monto: monto ?? 0, tipo, categoria, cuenta, frecuencia, inicio,
    });
    if (!r.ok) { setError(r.error ?? 'Revisa los datos'); return; }
    // Aplica al toque las ocurrencias ya vencidas (hoy inclusive)
    const aplicado = aplicarRecurrentesPendientes(r.estado);
    onAplicar(aplicado.estado);
    setError('');
    setCreando(false);
    setNombre(''); setMontoTxt(''); setInicio(hoyISO());
    onToast(
      aplicado.nuevas.length > 0
        ? `🔁 "${nombre.trim()}" creado y ${aplicadasStr(aplicado.nuevas.length)}`
        : `🔁 "${nombre.trim()}" creado — próxima: ${fechaCorta(proximaFechaRecurrente(aplicado.estado.recurrentes[aplicado.estado.recurrentes.length - 1]))}`,
    );
  };

  const aplicadasStr = (n: number) => `${n} registro${n === 1 ? '' : 's'} automático${n === 1 ? '' : 's'}`;

  const registrarAhora = (rec: Recurrente) => {
    const aplicado = aplicarRecurrentesPendientes(estado);
    if (aplicado.nuevas.length === 0) {
      const prox = proximaFechaRecurrente(rec);
      onToast(`Nada pendiente de "${rec.nombre}" — la próxima es ${fechaCorta(prox)}`);
      return;
    }
    onAplicar(aplicado.estado);
    onToast(`🔁 ${aplicadasStr(aplicado.nuevas.length)}: ${aplicado.nuevas.map((t) => `${soles(t.amount, false)}`).join(', ')}`);
  };

  return (
    <section
      className="rounded-3xl bg-slate-900 border border-slate-700/80 overflow-hidden"
      data-testid="tarjeta-recurrentes"
    >
      {/* Cabecera colapsable */}
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center gap-3 p-4 hover:bg-slate-800/50 transition-all"
        data-testid="header-recurrentes"
      >
        <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
          <Repeat className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <h3 className="text-sm font-black text-white">Movimientos Programados</h3>
          <p className="text-[11px] text-slate-400">
            {estado.recurrentes.length === 0
              ? 'Sueldo semanal, alquiler… se registran solos'
              : `${estado.recurrentes.filter((r) => r.activo).length} activo(s) · ${estado.recurrentes.filter((r) => !r.activo).length} pausado(s)`}
          </p>
        </div>
        {abierto
          ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-3 wt-aparece">
          {/* Lista */}
          {estado.recurrentes.length > 0 && (
            <div className="space-y-2">
              {estado.recurrentes.map((rec) => {
                const prox = proximaFechaRecurrente(rec);
                const vencida = rec.activo && prox <= hoyISO();
                return (
                  <div
                    key={rec.id}
                    data-testid={`recurrente-${rec.id}`}
                    className={`rounded-2xl border p-3 ${
                      rec.activo
                        ? vencida
                          ? 'bg-violet-500/10 border-violet-500/40'
                          : 'bg-slate-950/60 border-slate-800'
                        : 'bg-slate-950/40 border-slate-800/60 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-100 truncate">
                          {rec.tipo === 'income' ? '📈' : '📉'} {rec.nombre}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          <span className={rec.tipo === 'income' ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                            {rec.tipo === 'income' ? '+' : '−'}{soles(rec.monto, false)}
                          </span>{' '}
                          · {FREQ_LABEL[rec.frecuencia]} · {rec.categoria}
                          {rec.activo && (
                            <> · <span className={vencida ? 'text-violet-300 font-semibold' : ''}>
                              {vencida ? 'pendiente de hoy' : `próx. ${fechaCorta(prox)}`}
                            </span></>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => registrarAhora(rec)}
                          disabled={!rec.activo}
                          title="Registrar lo pendiente ahora"
                          className="px-2.5 py-1.5 rounded-lg bg-violet-600/80 hover:bg-violet-500 disabled:opacity-40 text-white text-[10px] font-bold transition-all active:scale-95"
                        >
                          Registrar
                        </button>
                        <button
                          onClick={() => { onAplicar(toggleRecurrente(estado, rec.id)); }}
                          title={rec.activo ? 'Pausar' : 'Reanudar'}
                          className="w-8 h-8 rounded-lg border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
                        >
                          {rec.activo ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setConfirmando(rec.id)}
                          title="Eliminar"
                          className="w-8 h-8 rounded-lg border border-slate-700 text-slate-500 hover:text-rose-400 hover:border-rose-500/50 flex items-center justify-center transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {confirmando === rec.id && (
                      <div className="mt-2.5 flex items-center gap-2 bg-rose-500/5 border border-rose-500/20 rounded-xl px-3 py-2">
                        <p className="text-[11px] text-slate-300 flex-1">
                          ¿Eliminar "{rec.nombre}"? Los ya registrados quedan en el historial.
                        </p>
                        <button
                          onClick={() => { setConfirmando(null); onAplicar(eliminarRecurrente(estado, rec.id)); onToast('Programado eliminado'); }}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold"
                        >
                          Eliminar
                        </button>
                        <button
                          onClick={() => setConfirmando(null)}
                          className="px-2.5 py-1 rounded-lg border border-slate-600 text-[10px] font-bold text-slate-300"
                        >
                          No
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Alta de recurrente */}
          {!creando ? (
            <button
              onClick={() => {
                setCreando(true);
                setTipo('income');
                setCategoria('RiderTrack');
                setCuenta('efectivo');
                setFrecuencia('semanal');
                setInicio(hoyISO());
                setError('');
              }}
              data-testid="boton-nuevo-recurrente"
              className="w-full py-2.5 rounded-xl border border-dashed border-violet-500/40 text-violet-300 hover:bg-violet-500/10 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" /> Programar sueldo o gasto fijo
            </button>
          ) : (
            <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4 space-y-3" data-testid="form-recurrente">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-white">Nuevo movimiento programado</p>
                <button onClick={() => setCreando(false)} className="text-[11px] text-slate-400 hover:text-white">
                  Cancelar
                </button>
              </div>

              {/* Tipo */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setTipo('income'); setCategoria('RiderTrack'); }}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    tipo === 'income' ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300' : 'border-slate-700 text-slate-400'
                  }`}
                >
                  📈 Ingreso (sueldo)
                </button>
                <button
                  onClick={() => { setTipo('expense'); setCategoria(cats[0]?.nombre ?? 'Otros'); }}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    tipo === 'expense' ? 'bg-rose-500/15 border-rose-500/50 text-rose-300' : 'border-slate-700 text-slate-400'
                  }`}
                >
                  📉 Gasto (fijo)
                </button>
              </div>

              <input
                type="text"
                value={nombre}
                onChange={(e) => { setNombre(e.target.value); setError(''); }}
                placeholder="Nombre (ej: Sueldo RiderTrack)"
                data-testid="input-rec-nombre"
                className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={montoTxt}
                  onChange={(e) => { setMontoTxt(e.target.value); setError(''); }}
                  placeholder="Monto S/"
                  data-testid="input-rec-monto"
                  className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
                <select
                  value={frecuencia}
                  onChange={(e) => setFrecuencia(e.target.value as Recurrente['frecuencia'])}
                  data-testid="select-rec-frecuencia"
                  className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="semanal">Cada semana</option>
                  <option value="quincenal">Cada 15 días</option>
                  <option value="mensual">Cada mes</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  data-testid="select-rec-categoria"
                  className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  {cats.map((c) => (
                    <option key={c.id} value={c.nombre}>{c.emoji} {c.nombre}</option>
                  ))}
                </select>
                <select
                  value={cuenta}
                  onChange={(e) => setCuenta(e.target.value)}
                  data-testid="select-rec-cuenta"
                  className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  {cuentas.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Primera ocurrencia (desde ahí se repite solo)
                </label>
                <input
                  type="date"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  data-testid="input-rec-inicio"
                  className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
              </div>

              {error && (
                <p className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <button
                onClick={guardar}
                data-testid="boton-guardar-recurrente"
                className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-all active:scale-[0.98]"
              >
                Programar
              </button>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                La app registra cada ocurrencia sola (hoy y las atrasadas). Ejemplo con fecha de hoy:
                {' '}próxima semana sería {fechaCorta(siguienteOcurrenciaISO({ frecuencia } as Recurrente, inicio))}.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
