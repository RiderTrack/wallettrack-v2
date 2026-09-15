// ═══════════════════════════════════════════════════════════
// 📜 HISTORIAL — WalletTrack V2 (F0)
// Registro general de movimientos: búsqueda, filtro por flujo y
// categoría, tabla con eliminar y export CSV + respaldo JSON.
// (Excel y PDF con formato pro aterrizan en F2.)
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { Search, Trash2, FileSpreadsheet, FileJson, Paperclip, Upload } from 'lucide-react';
import type { EstadoWallet, Transaccion } from '../types';
import { todasLasCuentas, CATS_GASTO_DEFAULT, CATS_INGRESO_DEFAULT } from '../data/catalogos';
import { soles, fechaCorta } from '../services/dinero';
import { filtrarTransacciones } from '../services/estado';
import { transaccionesACSV } from '../services/archivo';
import { RecurrentesCard } from './RecurrentesCard';
import { ComprobanteViewer } from './ComprobanteViewer';
import { ImportarCsvModal } from './ImportarCsvModal';
import type { ResultadoImportacion } from '../services/importarCsv';

interface HistorialViewProps {
  estado: EstadoWallet;
  onEliminar: (id: string) => void;
  onAplicar: (nuevo: EstadoWallet) => void;   // F5: recurrentes
  onToast: (mensaje: string) => void;
}

export const HistorialView: React.FC<HistorialViewProps> = ({ estado, onEliminar, onAplicar, onToast }) => {
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<'all' | 'income' | 'expense'>('all');
  const [categoria, setCategoria] = useState('all');
  const [aConfirmar, setAConfirmar] = useState<string | null>(null);
  // F6 · viewer de comprobante
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [viewerDesc, setViewerDesc] = useState<string>('');
  // F9 · modal de importar CSV
  const [modalCsvAbierto, setModalCsvAbierto] = useState(false);

  const todasCategorias = useMemo(
    () => [...CATS_GASTO_DEFAULT, ...CATS_INGRESO_DEFAULT, ...estado.categoriasGasto, ...estado.categoriasIngreso],
    [estado.categoriasGasto, estado.categoriasIngreso],
  );

  const filtradas = useMemo(
    () => filtrarTransacciones(estado, { texto, tipo, categoria }),
    [estado, texto, tipo, categoria],
  );

  const totalIngresos = filtradas.filter((t) => t.type === 'income').reduce((a, t) => a + (Number(t.amount) || 0), 0);
  const totalGastos = filtradas.filter((t) => t.type === 'expense').reduce((a, t) => a + (Number(t.amount) || 0), 0);

  const cuenta = (id?: string) => todasLasCuentas(estado).find((c) => c.id === (id ?? 'efectivo'));

  const exportarCSV = () => {
    if (filtradas.length === 0) { onToast('No hay movimientos que exportar'); return; }
    const blob = transaccionesACSV(filtradas.map((t) => ({
      fecha: t.date,
      concepto: t.description,
      categoria: t.category,
      cuenta: cuenta(t.account)?.name ?? 'Efectivo',
      tipo: t.type === 'income' ? 'Ingreso' : 'Gasto',
      monto: Number(t.amount) || 0,
    })));
    const hoy = new Date().toISOString().split('T')[0];
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WalletTrack_Movimientos_${hoy}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    onToast(`CSV con ${filtradas.length} movimientos descargado`);
  };

  return (
    <div className="space-y-4 wt-aparece" data-testid="vista-historial">

      {/* F5 · 🔁 Sueldos y fijos programados (se registran solos) */}
      <RecurrentesCard estado={estado} onAplicar={onAplicar} onToast={onToast} />
      <div className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">

        {/* Título + export */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl font-black text-white">Registro de Movimientos</h2>
            <p className="text-slate-400 text-xs mt-0.5">Gestiona, filtra y exporta tus ingresos y egresos.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalCsvAbierto(true)}
              data-testid="boton-importar-csv"
              title="Importar extracto del banco (CSV, XLSX, PDF o TXT)"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-amber-400 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-all"
            >
              <Upload className="w-4 h-4" /> Importar Extracto
            </button>
            <button
              onClick={exportarCSV}
              data-testid="boton-exportar-csv"
              title="Exportar CSV"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" /> CSV
            </button>
            <button
              onClick={() => onToast('El respaldo completo se exporta desde Configuración')}
              title="Respaldo JSON (en Configuración)"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sky-400 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-all"
            >
              <FileJson className="w-4 h-4" /> JSON
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar descripción..."
              data-testid="filtro-texto"
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            />
          </div>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as 'all' | 'income' | 'expense')}
            data-testid="filtro-tipo"
            className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
          >
            <option value="all">Todos los flujos</option>
            <option value="income">Solo Ingresos</option>
            <option value="expense">Solo Gastos</option>
          </select>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            data-testid="filtro-categoria"
            className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
          >
            <option value="all">Todas las Categorías</option>
            {todasCategorias.map((c) => (
              <option key={`${c.id}-${c.nombre}`} value={c.nombre}>{c.emoji} {c.nombre}</option>
            ))}
          </select>
        </div>

        {/* Resumen del filtro */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl py-2">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Movimientos</p>
            <p data-testid="resumen-cantidad" className="text-sm font-black text-white">{filtradas.length}</p>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl py-2">
            <p className="text-[10px] text-emerald-500/80 uppercase font-bold tracking-wide">Ingresos</p>
            <p data-testid="resumen-ingresos" className="text-sm font-black text-emerald-400">{soles(totalIngresos)}</p>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl py-2">
            <p className="text-[10px] text-rose-500/80 uppercase font-bold tracking-wide">Gastos</p>
            <p data-testid="resumen-gastos" className="text-sm font-black text-rose-400">{soles(totalGastos)}</p>
          </div>
        </div>

        {/* Tabla */}
        {filtradas.length === 0 ? (
          <div className="text-center py-10" data-testid="historial-vacio">
            <p className="text-3xl mb-2">🔍</p>
            <p className="text-sm text-slate-400">
              {estado.transactions.length === 0 ? 'Sin movimientos todavía' : 'Ningún movimiento coincide con el filtro'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-slate-900/90 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Concepto</th>
                  <th className="p-3">Categoría</th>
                  <th className="p-3">Cuenta</th>
                  <th className="p-3 text-right">Monto</th>
                  <th className="p-3 text-center w-16">Comp.</th>
                  <th className="p-3 text-center w-16"></th>
                </tr>
              </thead>
              <tbody className="text-slate-300 text-sm divide-y divide-slate-800/50">
                {filtradas.map((t: Transaccion) => {
                  const cta = cuenta(t.account);
                  const esIngreso = t.type === 'income';
                  const srcComprob = t.comprobanteUrl ?? t.comprobanteLocal ?? null;
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 whitespace-nowrap text-slate-400 text-xs">{fechaCorta(t.date)}</td>
                      <td className="p-3 font-semibold text-slate-200">{t.description}</td>
                      <td className="p-3 text-xs">{t.category}</td>
                      <td className="p-3 text-xs whitespace-nowrap">{cta?.icon} {cta?.name ?? 'Efectivo'}</td>
                      <td className={`p-3 text-right font-black whitespace-nowrap ${esIngreso ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {esIngreso ? '+' : '−'}{soles(Number(t.amount) || 0)}
                      </td>
                      <td className="p-3 text-center">
                        {srcComprob ? (
                          <button
                            onClick={() => { setViewerSrc(srcComprob); setViewerDesc(t.description); }}
                            data-testid={`comprobante-${t.id}`}
                            title="Ver comprobante"
                            className="relative w-9 h-9 rounded-lg overflow-hidden border border-slate-700 hover:border-emerald-500/60 mx-auto block transition-all"
                          >
                            <img
                              src={srcComprob}
                              alt="Comprobante"
                              className="w-full h-full object-cover"
                            />
                            {!t.comprobanteUrl && t.comprobanteLocal && (
                              <span
                                title="Pendiente de subir a la nube"
                                className="absolute top-0 right-0 w-2.5 h-2.5 bg-amber-500 rounded-full border border-slate-900"
                              />
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-700 inline-flex" title="Sin comprobante">
                            <Paperclip className="w-4 h-4 opacity-30" />
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {aConfirmar === t.id ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => { onEliminar(t.id); setAConfirmar(null); }}
                              data-testid={`confirmar-eliminar-${t.id}`}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-all"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setAConfirmar(null)}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-600 text-slate-400 hover:text-white transition-all"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAConfirmar(t.id)}
                            data-testid={`eliminar-${t.id}`}
                            title="Eliminar movimiento"
                            className="w-8 h-8 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center mx-auto transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Volver a ver todos */}
        {(texto || tipo !== 'all' || categoria !== 'all') && (
          <button
            onClick={() => { setTexto(''); setTipo('all'); setCategoria('all'); }}
            className="mt-3 text-xs font-bold text-emerald-400 hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* F6 · Viewer de comprobante (pantalla completa con zoom) */}
      <ComprobanteViewer
        abierto={viewerSrc !== null}
        src={viewerSrc}
        descripcion={viewerDesc}
        onCerrar={() => { setViewerSrc(null); setViewerDesc(''); }}
      />

      {/* F9 · Modal de importar CSV */}
      <ImportarCsvModal
        abierto={modalCsvAbierto}
        estado={estado}
        onCerrar={() => setModalCsvAbierto(false)}
        onImportar={(nuevoEstado, resultado) => {
          onAplicar(nuevoEstado);
          setModalCsvAbierto(false);
          const { importados, salteados, totalGastos, totalIngresos } = resultado;
          let msg = `✅ ${importados} movimiento${importados === 1 ? '' : 's'} importado${importados === 1 ? '' : 's'}`;
          if (totalGastos > 0 || totalIngresos > 0) {
            msg += ` · S/ ${totalGastos.toFixed(0)} gastos · S/ ${totalIngresos.toFixed(0)} ingresos`;
          }
          if (salteados > 0) {
            msg += ` · ⚠️ ${salteados} salteado${salteados === 1 ? '' : 's'} (duplicado${salteados === 1 ? '' : 's'})`;
          }
          onToast(msg);
        }}
      />
    </div>
  );
};
