// ═══════════════════════════════════════════════════════════
// 📥 MODAL IMPORTAR EXTRACTO — WalletTrack V2 (F9.1 · MULTI-FORMATO)
// Modal de 3 pasos para importar movimientos desde un extracto
// del banco (CSV · TXT · XLSX · PDF):
//   Paso 1: Elegir archivo + cuenta destino
//   Paso 2: Mapear columnas (detección automática + editable)
//   Paso 3: Revisar, categorizar y importar
// ═══════════════════════════════════════════════════════════

import React, { useState, useRef } from 'react';
import { X, Upload, FileText, AlertTriangle, CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import type { EstadoWallet } from '../types';
import { todasLasCuentas, CATS_GASTO_DEFAULT, CATS_INGRESO_DEFAULT } from '../data/catalogos';
import { soles } from '../services/dinero';
import {
  leerArchivoBancario, detectarColumnas, mapearFilas, importarTransaccionesMasivas,
  type CsvCrudo, ColumnasDetectadas, MovimientoCsv, ResultadoImportacion,
} from '../services/importarCsv';

interface ImportarCsvModalProps {
  abierto: boolean;
  estado: EstadoWallet;
  onCerrar: () => void;
  onImportar: (nuevoEstado: EstadoWallet, resultado: ResultadoImportacion) => void;
}

type Paso = 1 | 2 | 3;

export const ImportarCsvModal: React.FC<ImportarCsvModalProps> = ({
  abierto, estado, onCerrar, onImportar,
}) => {
  const [paso, setPaso] = useState<Paso>(1);
  const [nombreArchivo, setNombreArchivo] = useState<string>('');
  const [leyendo, setLeyendo] = useState(false);
  const [cuentaId, setCuentaId] = useState<string>('bcp');
  const [csv, setCsv] = useState<CsvCrudo | null>(null);
  const [columnas, setColumnas] = useState<ColumnasDetectadas | null>(null);
  const [movs, setMovs] = useState<MovimientoCsv[]>([]);
  const [error, setError] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  const cuentas = todasLasCuentas(estado);
  // F9.1 · FIX categoría sugerida: el diccionario puede devolver
  // 'Transferencia' (YAPE/PLIN) que NO vive en las listas de gasto/
  // ingreso — sin esa opción en el select, el navegador caía
  // silenciosamente a "Hogar" y el movimiento se importaba mal.
  // También se suman las categorías propias del usuario (F5).
  const CATS_ESPECIALES_IMPORT = [
    { id: 'transferencia', emoji: '💸', nombre: 'Transferencia' },
    { id: 'ahorro', emoji: '🎯', nombre: 'Ahorro' },
  ];
  const todasCategorias = [
    ...CATS_GASTO_DEFAULT, ...estado.categoriasGasto,
    ...CATS_ESPECIALES_IMPORT,
    ...CATS_INGRESO_DEFAULT, ...estado.categoriasIngreso,
  ];

  const reset = () => {
    setPaso(1);
    setNombreArchivo('');
    setLeyendo(false);
    setCsv(null);
    setColumnas(null);
    setMovs([]);
    setError('');
    setCuentaId('bcp');
  };

  const cerrar = () => {
    reset();
    onCerrar();
  };

  // ── Paso 1 → 2: leer archivo (CSV/TXT/XLSX/PDF) y parsear ──
  const alElegirArchivo = async (file: File) => {
    setNombreArchivo(file.name);
    setLeyendo(true);
    setError('');
    try {
      const leido = await leerArchivoBancario(file);
      if (leido.headers.length === 0) throw new Error('El archivo está vacío o no se pudo leer');
      setCsv(leido);
      setColumnas(detectarColumnas(leido.headers));
      setPaso(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo');
    } finally {
      setLeyendo(false);
    }
  };

  // ── Paso 2 → 3: mapear filas con las columnas detectadas ──
  const irAPaso3 = () => {
    if (!csv || !columnas) return;
    const movimientos = mapearFilas(csv, columnas, cuentaId, estado);
    if (movimientos.length === 0) {
      setError('No se encontraron movimientos válidos. Revisa el mapeo de columnas.');
      return;
    }
    setMovs(movimientos);
    setError('');
    setPaso(3);
  };

  // ── Paso 3: importar los seleccionados ──
  const confirmarImportacion = () => {
    const { estado: nuevoEstado, resultado } = importarTransaccionesMasivas(estado, movs);
    onImportar(nuevoEstado, resultado);
    reset();
  };

  const toggleSeleccion = (i: number) => {
    setMovs((prev) => prev.map((m, idx) => idx === i ? { ...m, seleccionado: !m.seleccionado } : m));
  };

  const cambiarCategoria = (i: number, cat: string) => {
    setMovs((prev) => prev.map((m, idx) => idx === i ? { ...m, categoria: cat } : m));
  };

  const seleccionarTodos = () => setMovs((prev) => prev.map((m) => ({ ...m, seleccionado: true })));
  const deseleccionarTodos = () => setMovs((prev) => prev.map((m) => ({ ...m, seleccionado: false })));
  const deseleccionarDuplicados = () => setMovs((prev) => prev.map((m) => ({ ...m, seleccionado: !m.posibleDuplicado })));

  const seleccionados = movs.filter((m) => m.seleccionado).length;
  const duplicados = movs.filter((m) => m.posibleDuplicado).length;

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={cerrar} />
      <div className="relative w-full sm:max-w-2xl bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 max-h-[92vh] overflow-y-auto custom-scrollbar">
        {/* Cabecera */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-black text-white">Importar extracto del banco</h3>
            <p className="text-[11px] text-slate-400">
              Paso {paso} de 3 · {paso === 1 ? 'Elegir archivo y cuenta' : paso === 2 ? 'Mapear columnas' : 'Revisar e importar'}
            </p>
          </div>
          <button onClick={cerrar} title="Cerrar" className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white flex items-center justify-center shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Indicador de pasos */}
        <div className="flex items-center gap-2 mb-5">
          {[1, 2, 3].map((p) => (
            <div key={p} className={`flex-1 h-1.5 rounded-full transition-all ${p <= paso ? 'bg-emerald-500' : 'bg-slate-700'}`} />
          ))}
        </div>

        {/* ── PASO 1: Elegir archivo + cuenta ── */}
        {paso === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Cuenta destino</label>
              <select
                value={cuentaId}
                onChange={(e) => setCuentaId(e.target.value)}
                data-testid="select-cuenta-csv"
                className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              >
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1.5">
                Todos los movimientos del CSV se asociarán a esta cuenta.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Archivo del banco</label>
              <button
                onClick={() => inputRef.current?.click()}
                disabled={leyendo}
                data-testid="boton-elegir-csv"
                className="w-full py-6 rounded-xl border-2 border-dashed border-slate-600 hover:border-emerald-500/60 hover:bg-emerald-500/5 text-slate-400 hover:text-emerald-400 text-xs font-bold flex flex-col items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {leyendo ? <Loader2 className="w-7 h-7 animate-spin" /> : <FileText className="w-7 h-7" />}
                {leyendo ? (
                  <span className="text-emerald-400">Leyendo archivo…</span>
                ) : nombreArchivo ? (
                  <span className="text-emerald-400">{nombreArchivo}</span>
                ) : (
                  <span>Tocá para elegir el extracto del banco</span>
                )}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.txt,.xlsx,.pdf,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void alElegirArchivo(f);
                }}
                className="hidden"
              />
              <p className="text-[10px] text-slate-500 mt-1.5">Formatos: CSV · TXT · XLSX · PDF</p>
            </div>

            <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-3">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                💡 <strong className="text-slate-300">Cómo bajar el extracto (BCP):</strong> entrá a la app o web BCP →
                Movimientos / Consulta de movimientos → elegí el período → <strong className="text-slate-300">Descargar XLSX o CSV</strong>.
                También sirve el PDF del estado de cuenta (sin contraseña y que no sea un escaneo).
                Las columnas se detectan automáticamente.
              </p>
            </div>

            {error && <p className="text-xs font-bold text-rose-400">{error}</p>}
          </div>
        )}

        {/* ── PASO 2: Mapear columnas ── */}
        {paso === 2 && csv && columnas && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Detectamos <strong className="text-slate-200">{csv.filas.length} filas</strong> con{' '}
              <strong className="text-slate-200">{csv.headers.length} columnas</strong>.
              Revisá que el mapeo sea correcto:
            </p>

            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'fecha', label: 'Fecha', sinonimos: 'fecha, date' },
                { key: 'descripcion', label: 'Descripción', sinonimos: 'descripcion, concepto, detalle' },
                { key: 'monto', label: 'Monto', sinonimos: 'monto, importe, amount, valor' },
                { key: 'tipo', label: 'Tipo (opcional)', sinonimos: 'tipo, cargo/abono' },
              ] as { key: keyof ColumnasDetectadas; label: string; sinonimos: string }[]).map(({ key, label, sinonimos }) => (
                <div key={key}>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">{label}</label>
                  <select
                    value={columnas[key] ?? -1}
                    onChange={(e) => {
                      const v = e.target.value === '-1' ? null : parseInt(e.target.value, 10);
                      setColumnas({ ...columnas, [key]: v });
                    }}
                    data-testid={`select-col-${key}`}
                    className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  >
                    <option value={-1}>— Sin mapear —</option>
                    {csv.headers.map((h, i) => (
                      <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>
                    ))}
                  </select>
                  <p className="text-[9px] text-slate-500 mt-0.5">Busca: {sinonimos}</p>
                </div>
              ))}
            </div>

            {/* Vista previa de las primeras 5 filas */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 mb-1.5">Vista previa (primeras 5 filas)</p>
              <div className="rounded-xl bg-slate-950/50 border border-slate-800 overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-slate-900/80 text-slate-400">
                      <th className="p-2 text-left">Fecha</th>
                      <th className="p-2 text-left">Descripción</th>
                      <th className="p-2 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {csv.filas.slice(0, 5).map((fila, i) => (
                      <tr key={i} className="border-t border-slate-800/50">
                        <td className="p-2 whitespace-nowrap">
                          {columnas.fecha !== null ? (fila[columnas.fecha] ?? '—') : '—'}
                        </td>
                        <td className="p-2 max-w-[200px] truncate">
                          {columnas.descripcion !== null ? (fila[columnas.descripcion] ?? '—') : '—'}
                        </td>
                        <td className="p-2 text-right whitespace-nowrap">
                          {columnas.monto !== null ? (fila[columnas.monto] ?? '—') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {error && <p className="text-xs font-bold text-rose-400">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => { setPaso(1); setError(''); }}
                className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-300 text-sm font-bold hover:text-white hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" /> Atrás
              </button>
              <button
                onClick={irAPaso3}
                data-testid="boton-ir-paso3"
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all flex items-center justify-center gap-1.5"
              >
                Continuar <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 3: Revisar y importar ── */}
        {paso === 3 && movs.length > 0 && (
          <div className="space-y-3">
            {/* Resumen + acciones rápidas */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-slate-400">
                <span className="font-bold text-emerald-400">{seleccionados}</span> de{' '}
                <span className="font-bold text-slate-200">{movs.length}</span> movimientos seleccionados
                {duplicados > 0 && (
                  <span className="text-amber-400 ml-2 flex items-center gap-1 inline-flex">
                    <AlertTriangle className="w-3 h-3" /> {duplicados} posibles duplicados
                  </span>
                )}
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button onClick={seleccionarTodos} className="text-[10px] font-bold text-emerald-400 hover:underline px-2 py-1 rounded border border-emerald-500/30">
                Seleccionar todos
              </button>
              <button onClick={deseleccionarTodos} className="text-[10px] font-bold text-slate-400 hover:underline px-2 py-1 rounded border border-slate-600">
                Quitar todos
              </button>
              <button onClick={deseleccionarDuplicados} className="text-[10px] font-bold text-amber-400 hover:underline px-2 py-1 rounded border border-amber-500/30">
                Quitar duplicados
              </button>
            </div>

            {/* Tabla de movimientos */}
            <div className="rounded-xl bg-slate-950/50 border border-slate-800 overflow-y-auto max-h-[40vh]">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-slate-900/95 text-slate-400">
                  <tr>
                    <th className="p-2 w-8"></th>
                    <th className="p-2 text-left">Fecha</th>
                    <th className="p-2 text-left">Descripción</th>
                    <th className="p-2 text-right">Monto</th>
                    <th className="p-2 text-left">Categoría</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {movs.map((m, i) => (
                    <tr key={i} className={`border-t border-slate-800/50 ${m.posibleDuplicado ? 'bg-amber-500/5' : ''}`}>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={m.seleccionado}
                          onChange={() => toggleSeleccion(i)}
                          data-testid={`check-mov-${i}`}
                          className="w-3.5 h-3.5 accent-emerald-500"
                        />
                      </td>
                      <td className="p-2 whitespace-nowrap text-slate-400">{m.fecha}</td>
                      <td className="p-2 max-w-[160px]">
                        <div className="truncate" title={m.descripcion}>{m.descripcion}</div>
                        {m.posibleDuplicado && (
                          <span className="text-amber-400 text-[9px] flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> duplicado
                          </span>
                        )}
                      </td>
                      <td className={`p-2 text-right font-bold whitespace-nowrap ${m.tipo === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {m.tipo === 'income' ? '+' : '−'}{soles(m.monto, false)}
                      </td>
                      <td className="p-2">
                        <select
                          value={m.categoria}
                          onChange={(e) => cambiarCategoria(i, e.target.value)}
                          data-testid={`select-cat-${i}`}
                          className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 max-w-[100px]"
                        >
                          {todasCategorias.map((c) => (
                            <option key={c.id} value={c.nombre}>{c.emoji} {c.nombre}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && <p className="text-xs font-bold text-rose-400">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => { setPaso(2); setError(''); }}
                className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-300 text-sm font-bold hover:text-white hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" /> Atrás
              </button>
              <button
                onClick={confirmarImportacion}
                disabled={seleccionados === 0}
                data-testid="boton-importar-csv"
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                  seleccionados > 0
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" /> Importar {seleccionados} movimiento{seleccionados === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
