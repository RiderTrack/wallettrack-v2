// ═══════════════════════════════════════════════════════════
// 🔔 TARJETA CAPTURA — WalletTrack V2 (F10 · Ajustes)
// Configuración completa de la captura automática:
//   • Permiso de acceso a notificaciones (Ajustes de Android)
//   • Elección de apps a escuchar (BCP, Yape, Interbank, BBVA,
//     Scotiabank + custom por package name)
//   • Cuenta destino por app (BCP → cuenta BCP, etc.)
//   • Modo automático o de revisión
//   • Saldo vivo (espejo de la cuenta con fecha de corte)
//   • Log de capturas con botones para las que quedaron en revisión
//   • Botón "Probar captura" (pasa por TODO el pipeline real)
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { BellRing, BellOff, ShieldCheck, Play, Trash2, Check, X, CreditCard } from 'lucide-react';
import type { EstadoWallet } from '../types';
import { todasLasCuentas } from '../data/catalogos';
import { esAPK } from '../services/platform';
import { soles } from '../services/dinero';
import {
  type PrefsCaptura, type LogCaptura,
  leerPrefsCaptura, guardarPrefsCaptura, leerLogCaptura, guardarLogCaptura,
  PRESETS_APPS, labelApp,
  checkAccesoNotificaciones, abrirAjustesNotificaciones, guardarAllowlistNativo,
  appsFinancierasInstaladas, probarCaptura, limpiarBufferNativo,
  resolverRevisionComoImportada, ignorarRevision, calcularSaldoVivo,
} from '../services/captura';

interface CapturaAutoCardProps {
  estado: EstadoWallet;
  onAplicar: (e: EstadoWallet) => void;
  onToast: (mensaje: string) => void;
}

export const CapturaAutoCard: React.FC<CapturaAutoCardProps> = ({ estado, onAplicar, onToast }) => {
  const [prefs, setPrefs] = useState<PrefsCaptura>(() => leerPrefsCaptura());
  const [log, setLog] = useState<LogCaptura[]>(() => leerLogCaptura());
  const [permiso, setPermiso] = useState<boolean | null>(null);
  const [customPkg, setCustomPkg] = useState('');
  const [instaladas, setInstaladas] = useState<string[]>([]);
  const [probando, setProbando] = useState(false);
  const [svMonto, setSvMonto] = useState<string>('');

  // ── Permiso: al montar y al volver de los ajustes de Android ──
  useEffect(() => {
    if (!esAPK()) return;
    const revisar = () => { void checkAccesoNotificaciones().then(setPermiso); };
    revisar();
    window.addEventListener('focus', revisar);
    return () => window.removeEventListener('focus', revisar);
  }, []);

  // Apps financieras instaladas (para marcar las disponibles)
  useEffect(() => {
    if (!esAPK()) return;
    void appsFinancierasInstaladas().then((apps) => setInstaladas(apps.map((a) => a.pkg)));
  }, []);

  // ── Helpers ──────────────────────────────────────────────────
  const persistirPrefs = (nuevas: PrefsCaptura) => {
    guardarPrefsCaptura(nuevas);
    setPrefs({ ...nuevas });
    void guardarAllowlistNativo(nuevas.packages);
  };

  const toggleApp = (pkg: string) => {
    const nuevas = { ...prefs };
    nuevas.packages = nuevas.packages.includes(pkg)
      ? nuevas.packages.filter((p) => p !== pkg)
      : [...nuevas.packages, pkg];
    persistirPrefs(nuevas);
  };

  const agregarCustom = () => {
    const pkg = customPkg.trim();
    if (!pkg || !/^[a-z0-9_.]+$/i.test(pkg)) {
      onToast('Package name inválido (ej: com.bcp.bank.bcp)');
      return;
    }
    if (!prefs.packages.includes(pkg)) {
      const nuevas = { ...prefs, packages: [...prefs.packages, pkg] };
      persistirPrefs(nuevas);
    }
    setCustomPkg('');
    onToast(`App ${pkg} agregada`);
  };

  /** Activa la captura: guarda prefs + abre el ajuste de Android.
   *  Primer uso: BCP y Yape vienen pre-elegidos. */
  const activar = async () => {
    let nuevas = { ...prefs, activo: true };
    if (nuevas.packages.length === 0) {
      nuevas.packages = ['com.bcp.bank.bcp', 'com.bcp.innovacxion.yapeapp'];
      if (!nuevas.cuentasMap['com.bcp.bank.bcp']) {
        nuevas.cuentasMap = { ...nuevas.cuentasMap, 'com.bcp.bank.bcp': 'bcp' };
      }
      if (!nuevas.cuentasMap['com.bcp.innovacxion.yapeapp']) {
        nuevas.cuentasMap = { ...nuevas.cuentasMap, 'com.bcp.innovacxion.yapeapp': 'yape' };
      }
    }
    persistirPrefs(nuevas);
    onToast('Ahora activa "WalletTrack" en Acceso a notificaciones');
    await abrirAjustesNotificaciones();
  };

  const desactivar = () => {
    persistirPrefs({ ...prefs, activo: false });
    onToast('Captura automática desactivada');
  };

  const cambiarModo = (modo: 'auto' | 'revision') => {
    persistirPrefs({ ...prefs, modo });
  };

  const cambiarCuentaApp = (pkg: string, cuenta: string) => {
    persistirPrefs({ ...prefs, cuentasMap: { ...prefs.cuentasMap, [pkg]: cuenta } });
  };

  // ── Saldo vivo ────────────────────────────────────────────────
  const sv = prefs.saldoVivo;
  const guardarSaldoVivo = (activo: boolean) => {
    const nuevo = activo
      ? (sv ?? { activo: true, cuenta: 'bcp', saldoInicial: Number(svMonto) || 0, desde: new Date().toISOString().slice(0, 10) })
      : null;
    if (nuevo) nuevo.activo = true;
    persistirPrefs({ ...prefs, saldoVivo: nuevo });
    onToast(activo ? '💳 Saldo vivo activado' : 'Saldo vivo desactivado');
  };

  // ── Log de capturas ───────────────────────────────────────────
  const resolver = (idLog: string) => {
    const r = resolverRevisionComoImportada(idLog, estado);
    if (r.ok) {
      onAplicar(r.estado);
      setLog(leerLogCaptura());
      onToast('🔔 Movimiento registrado');
    } else {
      onToast(r.error ?? 'No se pudo registrar');
    }
  };

  const ignorar = (idLog: string) => {
    ignorarRevision(idLog);
    setLog(leerLogCaptura());
  };

  const probar = async () => {
    if (probando) return;
    setProbando(true);
    try {
      await probarCaptura('com.bcp.bank.bcp', 'BCP', 'Compraste S/ 25.50 en UBER *VIAJE LIMA PE');
      onToast('🔔 Captura de prueba enviada — mira el Historial');
      setTimeout(() => setLog(leerLogCaptura()), 900);
    } finally {
      setProbando(false);
    }
  };

  const limpiarTodo = async () => {
    await limpiarBufferNativo();
    guardarLogCaptura([]);
    setLog([]);
    onToast('Buffer y log vaciados');
  };

  const horaCorta = (ts: number): string => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const cuentas = todasLasCuentas(estado);
  const activoYPagado = prefs.activo && permiso !== false;

  // ── Render ────────────────────────────────────────────────────
  return (
    <section className="rounded-3xl bg-slate-900 border border-emerald-500/20 p-5" data-testid="tarjeta-captura">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
          activoYPagado ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-slate-800 border-slate-700'
        }`}>
          {activoYPagado
            ? <BellRing className="w-4 h-4 text-emerald-400" />
            : <BellOff className="w-4 h-4 text-slate-400" />}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-white">Captura Automática</h3>
          <p className="text-[11px] text-slate-400">
            {esAPK()
              ? 'Tus gastos del banco caen solos, leyendo las notificaciones'
              : 'Solo en el APK — en web no hay notificaciones'}
          </p>
        </div>
        {esAPK() && (
          <button
            onClick={prefs.activo ? desactivar : activar}
            data-testid="toggle-captura"
            className={`ml-auto px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all shrink-0 ${
              prefs.activo
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'border-slate-600 text-slate-400'
            }`}
          >
            {prefs.activo ? 'ON' : 'OFF'}
          </button>
        )}
      </div>

      {!esAPK() ? (
        <p className="text-xs text-slate-400 leading-relaxed">
          Instalá el APK para activar la captura: cada aviso de compra o abono de tus apps bancarias
          se convierte en transacción automáticamente, en segundos. Mientras tanto, seguí usando
          <strong className="text-slate-300"> 📥 Importar Extracto</strong> del Historial.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Elige de qué apps leer los avisos. <strong className="text-slate-300">Solo esas apps</strong> se
            leen (el filtro es en el lado nativo: las demás notificaciones de tu teléfono jamás se tocan).
            Nada sale del celular.
          </p>

          {/* Estado del permiso */}
          {prefs.activo && (
            <div className={`flex items-center gap-2.5 mb-4 p-2.5 rounded-xl border ${
              permiso === false
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-slate-950/60 border-slate-800'
            }`}>
              <ShieldCheck className={`w-4 h-4 shrink-0 ${permiso === false ? 'text-amber-400' : 'text-emerald-400'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-200">
                  {permiso === false ? 'Falta el acceso a notificaciones' : 'Acceso a notificaciones OK'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {permiso === false
                    ? 'Toca "Dar acceso" y activa WalletTrack en la lista'
                    : 'Capturando los avisos de tus apps elegidas'}
                </p>
              </div>
              {permiso === false && (
                <button
                  onClick={() => { void abrirAjustesNotificaciones(); }}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300 shrink-0"
                >
                  Dar acceso
                </button>
              )}
            </div>
          )}

          {/* Apps a escuchar */}
          <div className="mb-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Apps a escuchar</p>
            <div className="space-y-2">
              {PRESETS_APPS.map((app) => {
                const elegida = prefs.packages.includes(app.pkg);
                const instalada = instaladas.length === 0 || instaladas.includes(app.pkg);
                return (
                  <div key={app.pkg} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <button
                      onClick={() => toggleApp(app.pkg)}
                      disabled={!prefs.activo}
                      data-testid={`captura-app-${app.pkg}`}
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all disabled:opacity-40 ${
                        elegida ? 'bg-emerald-500/20 border-emerald-500/50' : 'border-slate-600'
                      }`}
                    >
                      {elegida && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-200 truncate">
                        {app.emoji} {app.label}
                        {!instalada && <span className="text-[9px] text-slate-500 ml-1.5">(no instalada)</span>}
                      </p>
                      {elegida && (
                        <select
                          value={prefs.cuentasMap[app.pkg] || ''}
                          onChange={(e) => cambiarCuentaApp(app.pkg, e.target.value)}
                          className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg text-[10px] text-slate-300 px-1.5 py-1"
                        >
                          <option value="">Cuenta: automática</option>
                          {cuentas.map((c) => (
                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom por package name */}
            {prefs.activo && (
              <div className="flex gap-2 mt-2">
                <input
                  value={customPkg}
                  onChange={(e) => setCustomPkg(e.target.value)}
                  placeholder="Otra app: package name (com.mi.banco)"
                  className="flex-1 min-w-0 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-200 placeholder:text-slate-600"
                />
                <button
                  onClick={agregarCustom}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold shrink-0"
                >
                  + Agregar
                </button>
              </div>
            )}
          </div>

          {/* Modo */}
          <div className="mb-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Cómo registrar</p>
            <div className="grid grid-cols-2 gap-2" data-testid="selector-modo-captura">
              <button
                onClick={() => cambiarModo('auto')}
                disabled={!prefs.activo}
                data-testid="modo-captura-auto"
                className={`py-2 px-2 rounded-xl border text-center transition-all disabled:opacity-40 ${
                  prefs.modo === 'auto'
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-600'
                }`}
              >
                <p className="text-[11px] font-bold">⚡ Automático</p>
                <p className="text-[9px] opacity-70 mt-0.5">Registra al instante</p>
              </button>
              <button
                onClick={() => cambiarModo('revision')}
                disabled={!prefs.activo}
                data-testid="modo-captura-revision"
                className={`py-2 px-2 rounded-xl border text-center transition-all disabled:opacity-40 ${
                  prefs.modo === 'revision'
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-600'
                }`}
              >
                <p className="text-[11px] font-bold">👀 Revisar antes</p>
                <p className="text-[9px] opacity-70 mt-0.5">Tú apruebas cada una</p>
              </button>
            </div>
          </div>

          {/* Saldo vivo */}
          <div className="mb-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-4 h-4 text-sky-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-200">Saldo vivo</p>
                <p className="text-[10px] text-slate-500">Espejo de tu cuenta: inicial + todo lo registrado</p>
              </div>
              <button
                onClick={() => guardarSaldoVivo(!(sv?.activo))}
                data-testid="toggle-saldo-vivo"
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all shrink-0 ${
                  sv?.activo
                    ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                    : 'border-slate-600 text-slate-400'
                }`}
              >
                {sv?.activo ? 'ON' : 'OFF'}
              </button>
            </div>
            {sv?.activo && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">Cuenta</p>
                    <select
                      value={sv.cuenta}
                      onChange={(e) => persistirPrefs({ ...prefs, saldoVivo: { ...sv, cuenta: e.target.value } })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg text-[11px] text-slate-200 px-2 py-1.5"
                    >
                      {cuentas.map((c) => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">Desde</p>
                    <input
                      type="date"
                      value={sv.desde}
                      onChange={(e) => persistirPrefs({ ...prefs, saldoVivo: { ...sv, desde: e.target.value } })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg text-[11px] text-slate-200 px-2 py-1.5"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 items-end">
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">Saldo inicial (S/)</p>
                    <input
                      type="number"
                      value={svMonto !== '' ? svMonto : String(sv.saldoInicial)}
                      onChange={(e) => setSvMonto(e.target.value)}
                      onBlur={() => {
                        const n = Number(svMonto);
                        if (Number.isFinite(n)) {
                          persistirPrefs({ ...prefs, saldoVivo: { ...sv, saldoInicial: n } });
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg text-[11px] text-slate-200 px-2 py-1.5"
                    />
                  </div>
                  <div className="text-right pb-1">
                    <p className="text-[10px] text-slate-500">Saldo ahora</p>
                    <p data-testid="saldo-vivo-valor" className="text-base font-black text-sky-300">
                      {soles(calcularSaldoVivo(estado, sv))}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Log de capturas */}
          <div className="mb-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
              Últimas capturas {log.length > 0 && <span className="text-slate-600 normal-case">({log.length})</span>}
            </p>
            {log.length === 0 ? (
              <p className="text-[11px] text-slate-500 p-2.5 rounded-xl bg-slate-950/40 border border-slate-800">
                Aún no hay capturas. Toca "Probar" para simular una notificación del BCP.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                {log.slice(0, 20).map((l) => (
                  <div key={l.id} className={`p-2.5 rounded-xl border ${
                    l.estado === 'importada' ? 'bg-emerald-500/5 border-emerald-500/20'
                      : l.estado === 'revision' ? 'bg-amber-500/5 border-amber-500/25'
                      : 'bg-slate-950/40 border-slate-800'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">{horaCorta(l.ts)}</span>
                      <span className="text-[9px] font-bold text-slate-500 truncate">{labelApp(l.pkg)}</span>
                      <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        l.estado === 'importada' ? 'bg-emerald-500/15 text-emerald-400'
                          : l.estado === 'revision' ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-slate-800 text-slate-500'
                      }`}>
                        {l.estado === 'importada' ? 'registrada' : l.estado === 'revision' ? 'revisar' : 'ignorada'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug mt-1 line-clamp-2">{l.text || l.title}</p>
                    {l.parse && l.estado === 'revision' && (
                      <p className="text-[10px] text-amber-300/80 mt-1">
                        {l.parse.direccion === 'income' ? 'Ingreso' : 'Gasto'} de {soles(l.parse.monto)} → {l.parse.categoria}
                      </p>
                    )}
                    {l.nota && (
                      <p className="text-[10px] text-amber-400/90 mt-1 leading-snug">Posible doble aviso — {l.nota}</p>
                    )}
                    {l.estado === 'revision' && (
                      <div className="flex gap-1.5 mt-2">
                        <button
                          onClick={() => resolver(l.id)}
                          data-testid="revision-crear"
                          className="flex-1 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Registrar {l.parse ? soles(l.parse.monto) : ''}
                        </button>
                        <button
                          onClick={() => ignorar(l.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400"
                          title="Ignorar esta captura"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex gap-2">
            <button
              onClick={probar}
              disabled={!prefs.activo || !permiso}
              data-testid="boton-probar-captura"
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {probando ? <Play className="w-3.5 h-3.5 animate-pulse" /> : <Play className="w-3.5 h-3.5" />} Probar captura
            </button>
            <button
              onClick={() => { void limpiarTodo(); }}
              title="Vaciar buffer y log de capturas"
              className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-2 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Limpiar
            </button>
          </div>
        </>
      )}
    </section>
  );
};
