// ═══════════════════════════════════════════════════════════
// 🛒 LISTA DE COMPRAS — WalletTrack V2 (F3 · ANÁLISIS)
// Puerto completo del view-compras del original: biblioteca de
// productos con precio e historial de precios (tendencia ▲▼),
// lista activa donde el precio se pone EN EL MERCADO (naranja =
// falta poner precio), tachar al meter al carrito, cerrar la
// compra → gasto real 'Alimentación' de la cuenta elegida +
// archivo en el historial (máx 24) y "Repetir última compra".
// Formas exactas: prod_* / item_* / compra_* (wallettrack_*).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { ShoppingCart, Plus, X, Pencil, Trash2, Minus, CheckCircle2 } from 'lucide-react';
import type { EstadoWallet, ItemCompra, ProductoBiblioteca } from '../types';
import {
  crearProducto, editarProducto, eliminarProducto, agregarProductoALista,
  toggleComprado, cambiarCantidad, quitarItemLista, guardarPrecioItem,
  cerrarCompras, repetirUltimaCompra, unidadLabel, UNIDADES,
} from '../services/estado';
import type { DatosProducto, DatosPrecioItem, UnidadProducto } from '../services/estado';
import { soles, parseMonto, fechaCorta } from '../services/dinero';
import { CUENTAS_CATALOG } from '../data/catalogos';

const EMOJIS_PRODUCTO = ['📦', '🍎', '🥛', '🍞', '🐔', '🥩', '🍚', '🧻', '🧼', '☕', '🥑', '🍌'];
const UNIDAD_DEFAULT: UnidadProducto = 'und';

type ModalCompras =
  | null
  | { tipo: 'producto'; desde: 'lista' | 'biblioteca' }
  | { tipo: 'precio'; item: ItemCompra }
  | { tipo: 'editar-producto'; producto: ProductoBiblioteca }
  | { tipo: 'cerrar' };

interface ComprasViewProps {
  estado: EstadoWallet;
  onAplicar: (nuevo: EstadoWallet) => void;
  onToast: (mensaje: string) => void;
}

export const ComprasView: React.FC<ComprasViewProps> = ({ estado, onAplicar, onToast }) => {
  const [tab, setTab] = useState<'lista' | 'biblioteca' | 'historial'>('lista');
  const [modal, setModal] = useState<ModalCompras>(null);
  const [confirmandoProdId, setConfirmandoProdId] = useState<string | null>(null);
  // Form producto (crear/editar)
  const [pEmoji, setPEmoji] = useState('📦');
  const [pNombre, setPNombre] = useState('');
  const [pPrecio, setPPrecio] = useState('');
  const [pUnidad, setPUnidad] = useState<UnidadProducto>(UNIDAD_DEFAULT);
  const [pError, setPError] = useState('');
  // Form precio de item
  const [modoPrecio, setModoPrecio] = useState<'unitario' | 'total'>('unitario');
  const [valorPrecio, setValorPrecio] = useState('');
  const [cantidadPrecio, setCantidadPrecio] = useState('1');
  const [iError, setIError] = useState('');
  // Cuenta para cerrar compras
  const [cuentaCierre, setCuentaCierre] = useState('efectivo');

  useEffect(() => {
    if (!modal) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [modal]);

  const items = estado.listaCompras.items;
  const productos = estado.productos;

  let estimado = 0, comprado = 0, nComprados = 0;
  items.forEach((it) => {
    const sub = it.precio ? (Number(it.precio) || 0) * (Number(it.cantidad) || 0) : 0;
    estimado += sub;
    if (it.comprado) { comprado += sub; nComprados++; }
  });

  // ── Acciones ──
  const abrirProducto = (desde: 'lista' | 'biblioteca') => {
    setPEmoji('📦'); setPNombre(''); setPPrecio(''); setPUnidad(UNIDAD_DEFAULT); setPError('');
    setModal({ tipo: 'producto', desde });
  };

  const abrirEditarProducto = (prod: ProductoBiblioteca) => {
    setPEmoji(prod.emoji || '📦'); setPNombre(prod.nombre);
    setPPrecio(prod.precio != null ? prod.precio.toFixed(2) : '');
    setPUnidad(prod.unidad || UNIDAD_DEFAULT); setPError('');
    setModal({ tipo: 'editar-producto', producto: prod });
  };

  const guardarProducto = () => {
    const precio = pPrecio.trim() === '' ? null : parseMonto(pPrecio);
    if (pPrecio.trim() !== '' && precio === null) { setPError('Precio inválido'); return; }
    const datos: DatosProducto = { emoji: pEmoji, nombre: pNombre, precio, unidad: pUnidad };
    if (modal?.tipo === 'editar-producto') {
      const r = editarProducto(estado, modal.producto.id, datos);
      if (!r.ok) { setPError(r.error ?? 'No se pudo actualizar'); return; }
      onAplicar(r.estado);
      onToast('✅ Producto actualizado');
    } else if (modal?.tipo === 'producto') {
      const r = crearProducto(estado, datos, modal.desde === 'lista');
      if (!r.ok) { setPError(r.error ?? 'No se pudo crear'); return; }
      onAplicar(r.estado);
      onToast(`✅ "${pNombre.trim()}" guardado${modal.desde === 'lista' ? ' y agregado a tu lista' : ''}`);
    }
    setModal(null);
  };

  const eliminarProductoActual = () => {
    if (modal?.tipo !== 'editar-producto') return;
    const prod = modal.producto;
    setModal(null);
    setConfirmandoProdId(prod.id);
  };

  const confirmarEliminarProducto = () => {
    if (!confirmandoProdId) return;
    onAplicar(eliminarProducto(estado, confirmandoProdId));
    setConfirmandoProdId(null);
    setModal(null);
    onToast('🗑 Producto eliminado');
  };

  const abrirPrecio = (item: ItemCompra) => {
    setModoPrecio(item.unidad === 'monto' ? 'total' : 'unitario');
    setValorPrecio(item.precio != null ? item.precio.toFixed(2) : '');
    setCantidadPrecio(String(item.cantidad));
    setIError('');
    setModal({ tipo: 'precio', item });
  };

  const guardarPrecio = () => {
    if (modal?.tipo !== 'precio') return;
    const valor = parseMonto(valorPrecio);
    if (valor === null) { setIError('Ingresa un valor válido'); return; }
    const datos: DatosPrecioItem = {
      itemId: modal.item.id, valor, modo: modoPrecio, cantidad: Number(cantidadPrecio) || 0,
    };
    const r = guardarPrecioItem(estado, datos);
    if (!r.ok) { setIError(r.error ?? 'No se pudo guardar'); return; }
    onAplicar(r.estado);
    setModal(null);
    onToast(`✅ Guardado — ${soles(modal.item.unidad === 'monto' || modoPrecio === 'total' ? valor : valor * (Number(cantidadPrecio) || 0))}`);
  };

  const confirmarCierre = () => {
    const r = cerrarCompras(estado, cuentaCierre);
    if (!r.ok) { onToast(r.error ?? 'No se pudo cerrar'); return; }
    onAplicar(r.estado);
    setModal(null);
    onToast(`💸 ${soles(r.total ?? 0)} descontado de tu cuenta. ¡Lista archivada!`);
  };

  const tabs = [
    { id: 'lista' as const, label: '🛒 Lista' },
    { id: 'biblioteca' as const, label: '📦 Biblioteca' },
    { id: 'historial' as const, label: '📜 Historial' },
  ];

  return (
    <div className="space-y-5" data-testid="vista-compras">
      {/* ── Resumen ── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-emerald-400 tracking-wide uppercase">🛒 Lista de Compras</p>
            <p className="text-2xl font-black text-white mt-0.5" data-testid="compras-total-comprado">{soles(comprado)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5" data-testid="compras-sub">
              de {soles(estimado)} estimado · {items.length} producto{items.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="text-3xl shrink-0">🛒</div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all"
            style={{ width: `${estimado > 0 ? Math.min(100, (comprado / estimado) * 100) : 0}%` }}
            data-testid="compras-barra"
          />
        </div>
      </section>

      {/* ── Tabs ── */}
      <div className="flex gap-1.5 bg-white/5 border border-white/10 rounded-2xl p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`compras-tab-${t.id}`}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === t.id ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 border border-transparent'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB LISTA ── */}
      {tab === 'lista' && (
        <div data-testid="compras-panel-lista">
          {items.length === 0 ? (
            <div className="rounded-3xl bg-slate-900 border border-slate-700/80 p-8 text-center">
              <p className="text-sm text-slate-400 font-bold" data-testid="compras-lista-vacia">🛒 Tu lista está vacía.</p>
              <p className="text-xs text-slate-500 mt-1.5">Agrega productos de tu biblioteca para empezar.</p>
              {estado.comprasHist.length > 0 && (
                <button
                  onClick={() => { onAplicar(repetirUltimaCompra(estado)); onToast('🔁 Lista recreada con precios actualizados'); }}
                  data-testid="boton-repetir-compra"
                  className="mt-4 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-bold"
                >
                  🔁 Repetir última compra
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2" data-testid="compras-lista-items">
              {items.map((it) => {
                const sub = (Number(it.precio) || 0) * (Number(it.cantidad) || 0);
                const esMonto = it.unidad === 'monto';
                const tienePrecio = it.precio != null;
                return (
                  <div
                    key={it.id}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border ${it.comprado ? 'bg-emerald-500/[0.07] border-emerald-500/25' : tienePrecio ? 'bg-white/[0.03] border-white/10' : 'bg-amber-500/[0.05] border-amber-500/25'}`}
                  >
                    <button
                      onClick={() => onAplicar(toggleComprado(estado, it.id))}
                      data-testid={`boton-comprado-${it.id}`}
                      className={`w-7 h-7 rounded-[9px] shrink-0 flex items-center justify-center text-sm transition-all ${it.comprado ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white' : 'bg-white/5 border border-white/15 text-transparent'}`}
                    >
                      ✓
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-bold truncate ${it.comprado ? 'text-emerald-300 line-through opacity-75' : 'text-slate-100'}`}>
                        {it.emoji || '🛒'} {it.nombre}
                      </p>
                      <button onClick={() => abrirPrecio(it)} data-testid={`linea-precio-${it.id}`} className="text-[11px] text-slate-400 mt-0.5 text-left">
                        {!tienePrecio ? (
                          <><span className="text-amber-400 font-bold">Toca para poner el precio</span>
                            {it.precioRef != null && <> · ref: {soles(it.precioRef)}</>}</>
                        ) : esMonto ? (
                          <>{soles(it.precio ?? 0)} (monto directo)</>
                        ) : (
                          <>{soles(it.precio ?? 0)} × {it.cantidad} {unidadLabel(it.unidad)}</>
                        )}
                        <span className="text-slate-600"> ✏️</span>
                      </button>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-[13px] font-black ${it.comprado ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {tienePrecio ? soles(sub) : '—'}
                      </p>
                      <div className="flex gap-1 mt-1 items-center">
                        {!esMonto && (
                          <>
                            <button onClick={() => onAplicar(cambiarCantidad(estado, it.id, -1))} className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 text-slate-400 font-black text-xs">−</button>
                            <button onClick={() => onAplicar(cambiarCantidad(estado, it.id, 1))} className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 text-slate-400 font-black text-xs">+</button>
                          </>
                        )}
                        <button onClick={() => onAplicar(quitarItemLista(estado, it.id))} data-testid={`boton-quitar-item-${it.id}`} className="w-6 h-6 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">🗑</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2.5 mt-4">
            {productos.length > 0 && (
              <div className="flex flex-wrap gap-1.5" data-testid="chips-agregar-rapido">
                {productos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onAplicar(agregarProductoALista(estado, p.id)); onToast(`🛒 ${p.nombre} en la lista`); }}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-200 text-[11px] font-bold"
                  >
                    {p.emoji} {p.nombre} <span className="text-emerald-400">+ Lista</span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => abrirProducto('lista')}
              data-testid="boton-agregar-producto"
              className="w-full py-3.5 rounded-2xl bg-emerald-500/10 border border-dashed border-emerald-500/40 text-emerald-400 text-sm font-black"
            >
              ➕ Nuevo producto para la lista
            </button>
            {items.length === 0 && estado.comprasHist.length > 0 && (
              <button
                onClick={() => { onAplicar(repetirUltimaCompra(estado)); onToast('🔁 Lista recreada con precios actualizados'); }}
                data-testid="boton-repetir-compra-2"
                className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-bold"
              >
                🔁 Repetir última compra
              </button>
            )}
            {nComprados > 0 && (
              <button
                onClick={() => setModal({ tipo: 'cerrar' })}
                data-testid="boton-cerrar-compras"
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-black shadow-lg shadow-emerald-500/25"
              >
                ✅ Terminé mis compras
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── TAB BIBLIOTECA ── */}
      {tab === 'biblioteca' && (
        <div data-testid="compras-panel-biblioteca">
          {productos.length === 0 ? (
            <div className="rounded-3xl bg-slate-900 border border-slate-700/80 p-8 text-center" data-testid="compras-biblioteca-vacia">
              <p className="text-sm text-slate-400 font-bold">📦 Aún no tienes productos.</p>
              <p className="text-xs text-slate-500 mt-1.5">Crea tu primer producto con su precio.</p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="compras-biblioteca-lista">
              {productos.map((p) => {
                const hist = p.historialPrecios || [];
                let tendencia: React.ReactNode = null;
                if (hist.length >= 2) {
                  const prev = Number(hist[hist.length - 2].precio);
                  const act = Number(hist[hist.length - 1].precio);
                  if (act > prev) tendencia = <span className="text-rose-400"> ▲ subió</span>;
                  else if (act < prev) tendencia = <span className="text-emerald-400"> ▼ bajó</span>;
                }
                return (
                  <div key={p.id} className="flex items-center gap-2.5 px-3 py-3 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="text-xl shrink-0">{p.emoji || '📦'}</div>
                    <button onClick={() => abrirEditarProducto(p)} className="flex-1 min-w-0 text-left" data-testid={`editar-producto-${p.id}`}>
                      <p className="text-[13px] font-bold text-slate-100 truncate">{p.nombre}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {p.precio != null ? soles(p.precio) : 'sin precio aún'} / {unidadLabel(p.unidad)}{tendencia}
                        {hist.length ? ` · act. ${fechaCorta(hist[hist.length - 1].fecha)}` : ''}
                      </p>
                    </button>
                    <button
                      onClick={() => { onAplicar(agregarProductoALista(estado, p.id)); onToast(`🛒 ${p.nombre} en la lista`); }}
                      data-testid={`agregar-a-lista-${p.id}`}
                      className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black shrink-0"
                    >
                      + Lista
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <button
            onClick={() => abrirProducto('biblioteca')}
            data-testid="boton-nuevo-producto"
            className="w-full py-3.5 rounded-2xl bg-emerald-500/10 border border-dashed border-emerald-500/40 text-emerald-400 text-sm font-black mt-3"
          >
            ➕ Nuevo producto
          </button>
        </div>
      )}

      {/* ── TAB HISTORIAL ── */}
      {tab === 'historial' && (
        <div data-testid="compras-panel-historial">
          {estado.comprasHist.length === 0 ? (
            <div className="rounded-3xl bg-slate-900 border border-slate-700/80 p-8 text-center" data-testid="compras-historial-vacio">
              <p className="text-sm text-slate-400 font-bold">📜 Aquí verás tus compras cerradas.</p>
            </div>
          ) : (
            <div className="space-y-2.5" data-testid="compras-historial-lista">
              {estado.comprasHist.map((c) => {
                const cuenta = CUENTAS_CATALOG.find((x) => x.id === c.cuenta);
                return (
                  <details key={c.id} className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden" data-testid={`hist-compra-${c.id}`}>
                    <summary className="flex items-center justify-between px-3.5 py-3 cursor-pointer list-none">
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-100">🛒 Compras {fechaCorta(c.fecha)}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {(c.items || []).filter((i) => i.comprado).length} productos · {cuenta ? `${cuenta.icon} ${cuenta.name}` : ''}
                        </p>
                      </div>
                      <p className="text-sm font-black text-emerald-400 shrink-0">{soles(c.total)}</p>
                    </summary>
                    <div className="px-3.5 pb-3 pt-1 border-t border-white/5">
                      {(c.items || []).map((i, idx) => (
                        <div key={`${c.id}-${idx}`} className="flex justify-between text-[11px] py-1">
                          <span className={i.comprado ? 'text-slate-400' : 'text-slate-600'}>
                            {i.comprado ? '✅' : '⬜'} {i.emoji} {i.nombre} · {i.cantidad} {unidadLabel(i.unidad)}
                          </span>
                          <span className={`${i.comprado ? '' : 'line-through'} text-slate-400`}>
                            {soles((Number(i.precio) || 0) * (Number(i.cantidad) || 0))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ MODAL: crear/editar producto ══ */}
      {modal && (modal.tipo === 'producto' || modal.tipo === 'editar-producto') && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={() => setModal(null)} data-testid="modal-producto-backdrop">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-emerald-400">
                  {modal.tipo === 'producto' ? '📦 Producto' : `📦 ${modal.producto.nombre}`}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {modal.tipo === 'producto'
                    ? (modal.desde === 'lista' ? 'Se suma directo a tu lista' : 'Para tu biblioteca')
                    : 'Edita tu producto'}
                </p>
              </div>
              <button onClick={() => setModal(null)} className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Icono</label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS_PRODUCTO.map((em) => (
                  <button key={em} onClick={() => setPEmoji(em)} className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center ${pEmoji === em ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-white/5 border border-white/10'}`}>{em}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Nombre</label>
              <input type="text" value={pNombre} onChange={(e) => setPNombre(e.target.value)} placeholder="Ej. Pollo entero" data-testid="producto-nombre"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm outline-none focus:border-emerald-500/60" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Precio referencia (S/)</label>
                <input type="number" step="0.01" inputMode="decimal" value={pPrecio} onChange={(e) => setPPrecio(e.target.value)} placeholder="Opcional" data-testid="producto-precio"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm outline-none focus:border-emerald-500/60" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Unidad</label>
                <select value={pUnidad} onChange={(e) => setPUnidad(e.target.value as UnidadProducto)} data-testid="producto-unidad"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm outline-none focus:border-emerald-500/60">
                  {UNIDADES.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
              </div>
            </div>

            {pError && <p className="text-xs font-bold text-rose-400" data-testid="producto-error">{pError}</p>}

            <button onClick={guardarProducto} data-testid="boton-guardar-producto"
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-black shadow-lg shadow-emerald-500/25 active:scale-[0.98] flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Guardar Producto
            </button>
            {modal.tipo === 'editar-producto' && (
              <button onClick={eliminarProductoActual} data-testid="boton-eliminar-producto"
                className="w-full py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-bold flex items-center justify-center gap-2">
                <Trash2 className="w-3.5 h-3.5" /> Eliminar producto
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirmación de eliminar producto */}
      {confirmandoProdId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" data-testid="confirmar-eliminar-producto-backdrop">
          <div className="w-full max-w-xs rounded-3xl bg-slate-900 border border-rose-500/30 p-5 text-center space-y-3">
            <p className="text-sm font-bold text-white">🗑 Eliminar producto</p>
            <p className="text-xs text-slate-400">¿Borrar de tu biblioteca? También se quitará de tu lista actual.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmandoProdId(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-bold">Cancelar</button>
              <button onClick={confirmarEliminarProducto} data-testid="confirmar-eliminar-producto" className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold">Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: precio del item ══ */}
      {modal?.tipo === 'precio' && (() => {
        const it = modal.item;
        const esMonto = it.unidad === 'monto';
        const cant = Number(cantidadPrecio) || 0;
        const val = parseMonto(valorPrecio) ?? 0;
        const totalPreview = esMonto || modoPrecio === 'total' ? val : val * cant;
        return (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={() => setModal(null)} data-testid="modal-precio-backdrop">
            <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-amber-400">💰 {it.emoji} {it.nombre}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">El precio se pone en el mercado</p>
                </div>
                <button onClick={() => setModal(null)} className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!esMonto && (
                <div className="flex gap-2" data-testid="modo-precio">
                  <button
                    onClick={() => setModoPrecio('unitario')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border ${modoPrecio === 'unitario' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'text-slate-400 border-white/10'}`}
                  >
                    Precio por {unidadLabel(it.unidad)}
                  </button>
                  <button
                    onClick={() => setModoPrecio('total')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border ${modoPrecio === 'total' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'text-slate-400 border-white/10'}`}
                  >
                    Pagué en total
                  </button>
                </div>
              )}

              {!esMonto && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Cantidad ({unidadLabel(it.unidad)})</label>
                  <input type="number" step="0.5" inputMode="decimal" value={cantidadPrecio} onChange={(e) => setCantidadPrecio(e.target.value)} data-testid="precio-cantidad"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm font-bold outline-none focus:border-amber-500/60" />
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  {esMonto || modoPrecio === 'total' ? '¿Cuánto pagaste en total? (S/)' : `Precio por ${unidadLabel(it.unidad)} (S/)`}
                </label>
                <input type="number" step="0.01" inputMode="decimal" value={valorPrecio} onChange={(e) => setValorPrecio(e.target.value)} placeholder="0.00" data-testid="precio-valor"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm font-bold outline-none focus:border-amber-500/60" />
              </div>

              <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-[11px] text-amber-300/80 font-bold">TOTAL</span>
                <span className="text-lg font-black text-amber-300" data-testid="precio-preview">{soles(totalPreview)}</span>
              </div>

              {iError && <p className="text-xs font-bold text-rose-400">{iError}</p>}

              <button onClick={guardarPrecio} data-testid="boton-guardar-precio"
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-white text-sm font-black shadow-lg shadow-amber-500/25 active:scale-[0.98]">
                Guardar Precio
              </button>
            </div>
          </div>
        );
      })()}

      {/* ══ MODAL: cerrar compras ══ */}
      {modal?.tipo === 'cerrar' && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={() => setModal(null)} data-testid="modal-cerrar-backdrop">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-emerald-400">✅ Cerrar Compras</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Registra el gasto real y archiva la lista</p>
              </div>
              <button onClick={() => setModal(null)} className="w-9 h-9 rounded-xl border border-slate-600 text-slate-400 hover:text-white flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-4 text-center">
              <p className="text-[10px] font-bold text-emerald-300/80 uppercase tracking-wide">Total a descontar</p>
              <p className="text-3xl font-black text-emerald-300 mt-1" data-testid="cerrar-compras-total">{soles(comprado)}</p>
              <p className="text-[11px] text-slate-400 mt-1" data-testid="cerrar-compras-detalle">
                {nComprados} comprados · {items.length - nComprados} quedaron pendientes
              </p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Descontar de</label>
              <select value={cuentaCierre} onChange={(e) => setCuentaCierre(e.target.value)} data-testid="cerrar-compras-cuenta"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm outline-none focus:border-emerald-500/60">
                {CUENTAS_CATALOG.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>

            <button onClick={confirmarCierre} data-testid="boton-confirmar-cierre"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-black shadow-lg shadow-emerald-500/25 active:scale-[0.98]">
              💸 Descontar {soles(comprado)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
