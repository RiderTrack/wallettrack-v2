// ═══════════════════════════════════════════════════════════
// ⚙️ CONFIGURACIÓN — WalletTrack V2 (F5)
// F1: cuenta Google + sincronización en la nube (wallettrack_sync)
// con estado en vivo, Sincronizar ahora, Restaurar y Subir todo.
// F5: 🩺 Diagnóstico del sync (detecta la causa exacta cuando
// "no sincroniza" y da la regla de Firestore para copiar),
// 🔒 Candado local (PIN + huella) y 🔔 Recordatorios de
// vencimientos. Además: respaldo JSON v3.0, import de backups
// del viejo Wallet, info de versión y hoja de ruta.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import {
  Download, Upload, Wallet, Smartphone, Map, CheckCircle2, AlertTriangle,
  Cloud, CloudDownload, CloudUpload, RefreshCw, LogIn, Loader2, Palette,
  Lock, Fingerprint, Bell, Stethoscope, Copy, XCircle, Plus,
  Bot, Volume2, VolumeX, RotateCcw,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import type { EstadoWallet } from '../types';
import { esAPK, nombrePlataforma, versionApp } from '../services/platform';
import { exportarRespaldo, importarRespaldo } from '../services/estado';
import {
  sincronizarAhora, restaurarDesdeNube, subirTodoALaNube,
  suscribirSync, type EstadoSyncUI,
} from '../services/sync';
import { db, auth } from '../services/firebase';
import {
  activarPin, cambiarPin, quitarPin, pinActivo, leerSeguridad,
  alternarHuella, huellaDisponible,
} from '../services/seguridad';
import {
  recordatoriosActivos, alternarRecordatorios, probarNotificacion,
} from '../services/recordatorios';
import {
  leerPrefsBot, guardarPrefsBot, probarBotProactivo, diagnosticarBot, reiniciarDedupe,
} from '../services/botproactivo';
import type { FrecuenciaBot } from '../types';
import { compartirArchivo, nombreRespaldo } from '../services/archivo';
import { leerTema } from '../services/tema';
import type { CuentaUsuario } from '../hooks/useAuth';

interface ConfiguracionViewProps {
  estado: EstadoWallet;
  cuenta: CuentaUsuario | null;   // F1: sesión Google (null = modo local)
  modoLocal: boolean;
  onImportar: (textoJSON: string) => boolean; // true si ok
  onIniciarSesion: () => void;    // F1: salir del modo local → LoginScreen
  onAbrirStudio?: () => void;     // F4: abrir el Theme Studio (🎨 del header)
  onToast: (mensaje: string) => void;
}

export const ConfiguracionView: React.FC<ConfiguracionViewProps> = ({
  estado, cuenta, modoLocal, onImportar, onIniciarSesion, onAbrirStudio, onToast,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmandoImport, setConfirmandoImport] = useState(false);
  const [borrador, setBorrador] = useState<{ nombre: string; contenido: string } | null>(null);

  // ── F1: Sincronización en la nube ──
  const [sync, setSync] = useState<EstadoSyncUI | null>(null);
  useEffect(() => suscribirSync(setSync), []);
  const [syncTrabajando, setSyncTrabajando] = useState(false);
  const [confirmRestaurar, setConfirmRestaurar] = useState(false);
  const [confirmSubir, setConfirmSubir] = useState(false);

  // F4: resumen del tema activo (se lee al montar la vista)
  const temaActual = useRef(leerTema()).current;

  const hace = (epoch: number | null): string => {
    if (!epoch) return 'nunca';
    const seg = Math.max(0, Math.floor((Date.now() - epoch) / 1000));
    if (seg < 60) return 'hace instantes';
    const min = Math.floor(seg / 60);
    if (min < 60) return `hace ${min} min`;
    return `hace ${Math.floor(min / 60)} h`;
  };

  const alSincronizarAhora = async () => {
    if (syncTrabajando) return;
    setSyncTrabajando(true);
    const r = await sincronizarAhora();
    setSyncTrabajando(false);
    if (r.ok) onToast('Sincronizado con la nube ✓');
    else if (r.error === 'sin-sesion') onToast('Iniciá sesión con tu cuenta Google para sincronizar');
    else onToast(r.error ?? 'No se pudo sincronizar');
  };

  // ── F5 · 🩺 Diagnóstico del sync ──
  interface PasoDiag { paso: string; ok: boolean; detalle: string; }
  const [diagnostico, setDiagnostico] = useState<PasoDiag[] | null>(null);
  const [diagCorriendo, setDiagCorriendo] = useState(false);
  const [reglasCopiadas, setReglasCopiadas] = useState(false);

  const REGLA_FIRESTORE = `match /wallettrack_sync/{uid} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}`;

  const diagnosticar = async () => {
    if (diagCorriendo) return;
    setDiagCorriendo(true);
    setDiagnostico(null);
    const pasos: PasoDiag[] = [];

    // 1 · Sesión
    const u = auth?.currentUser;
    pasos.push({
      paso: 'Sesión Google',
      ok: !!u,
      detalle: u ? `${u.email || 'cuenta'} · uid ${String(u.uid).slice(0, 8)}…` : 'Sin sesión (modo local) — el sync necesita cuenta',
    });

    // 2 · Red
    pasos.push({
      paso: 'Conexión a internet',
      ok: navigator.onLine,
      detalle: navigator.onLine ? 'en línea ✓' : 'sin red — reconectate y reintenta',
    });

    // 3 · Firebase inicializado
    pasos.push({
      paso: 'Firebase iniciado',
      ok: !!db,
      detalle: db ? 'proyecto fittrack-e06be conectado' : 'Firebase no arrancó (reinstalá la app)',
    });

    // 4 · Lectura del documento privado
    if (u && db) {
      try {
        const snap = await getDoc(doc(db, 'wallettrack_sync', u.uid));
        pasos.push({
          paso: 'Lectura de wallettrack_sync',
          ok: true,
          detalle: snap.exists() ? 'tu documento existe en la nube ✓' : 'todavía vacío (se crea al sincronizar) — normal la primera vez',
        });
      } catch (e) {
        const code = String((e as { code?: unknown })?.code ?? '');
        pasos.push({
          paso: 'Lectura de wallettrack_sync',
          ok: false,
          detalle: code.includes('permission-denied')
            ? '❌ permission-denied — FALTA LA REGLA en Firestore (está abajo para copiar)'
            : `❌ ${code || 'error de lectura'} — revisá tu conexión`,
        });
      }
    }

    // 5 · Ronda completa (el motor real: baja + combina + sube)
    const r = await sincronizarAhora();
    pasos.push({
      paso: 'Sincronización completa',
      ok: r.ok,
      detalle: r.ok
        ? '✓ bajó, combinó y subió — todo en orden'
        : (r.error === 'sin-sesion' ? 'sin sesión' : (r.error ?? 'falló')),
    });

    setDiagnostico(pasos);
    setDiagCorriendo(false);
  };

  const copiarRegla = async () => {
    try {
      await navigator.clipboard.writeText(REGLA_FIRESTORE);
      setReglasCopiadas(true);
      setTimeout(() => setReglasCopiadas(false), 2200);
      onToast('Regla copiada — pégala en Firebase Console → Firestore → Reglas');
    } catch {
      onToast('No pude copiar — copiala a mano del cuadro');
    }
  };

  // ── F5 · 🔒 Candado (PIN + huella) ──
  const [candadoTrabajando, setCandadoTrabajando] = useState(false);
  const [pinViejo, setPinViejo] = useState('');
  const [pinNuevo, setPinNuevo] = useState('');
  const [pinConfirma, setPinConfirma] = useState('');
  const [pinError, setPinError] = useState('');
  const [modoPin, setModoPin] = useState<'crear' | 'cambiar' | 'quitar' | null>(null);
  const [huellaEstado, setHuellaEstado] = useState<{ ok: boolean; detalle: string } | null>(null);
  const [huellaOn, setHuellaOn] = useState(leerSeguridad().huella);

  useEffect(() => {
    void huellaDisponible().then(setHuellaEstado);
  }, []);

  const guardarPin = () => {
    setCandadoTrabajando(true);
    try {
      if (modoPin === 'crear') {
        if (pinNuevo !== pinConfirma) { setPinError('Los dos PIN no coinciden'); return; }
        const r = activarPin(pinNuevo);
        if (!r.ok) { setPinError(r.error ?? 'PIN inválido'); return; }
        onToast('🔒 Candado activado — la app se bloquea al cerrarse');
      } else if (modoPin === 'cambiar') {
        if (pinNuevo !== pinConfirma) { setPinError('Los dos PIN no coinciden'); return; }
        const r = cambiarPin(pinViejo, pinNuevo);
        if (!r.ok) { setPinError(r.error ?? 'No se pudo cambiar'); return; }
        onToast('PIN cambiado ✓');
      } else if (modoPin === 'quitar') {
        const r = quitarPin(pinViejo);
        if (!r.ok) { setPinError(r.error ?? 'No se pudo quitar'); return; }
        onToast('Candado quitado');
      }
      setModoPin(null); setPinViejo(''); setPinNuevo(''); setPinConfirma(''); setPinError('');
    } finally {
      setCandadoTrabajando(false);
    }
  };

  // ── F5 · 🔔 Recordatorios ──
  const [recordatoriosOn, setRecordatoriosOn] = useState(recordatoriosActivos());
  const alternarAvisos = () => {
    const nuevo = !recordatoriosOn;
    alternarRecordatorios(nuevo);
    setRecordatoriosOn(nuevo);
    onToast(nuevo ? '🔔 Recordatorios activados' : 'Recordatorios apagados');
  };

  const probar = async () => {
    const ok = await probarNotificacion();
    onToast(ok ? '🔔 Sale en 6 segundos…' : 'El equipo no permitió las notificaciones');
  };

  // ── F7 · 🤖 Bot Proactivo ──
  const [prefsBot, setPrefsBot] = useState(leerPrefsBot());
  const [diagBot, setDiagBot] = useState(diagnosticarBot());

  const recargarDiag = () => setDiagBot(diagnosticarBot());

  const alternarBot = () => {
    const nuevo = { ...prefsBot, activo: !prefsBot.activo };
    guardarPrefsBot(nuevo);
    setPrefsBot(nuevo);
    onToast(nuevo.activo ? '🤖 Bot proactivo activado' : 'Bot proactivo apagado');
  };

  const cambiarFrecuencia = (freq: FrecuenciaBot) => {
    const nuevo = { ...prefsBot, frecuencia: freq };
    guardarPrefsBot(nuevo);
    setPrefsBot(nuevo);
    const labels: Record<FrecuenciaBot, string> = {
      'solo-graves': 'Solo graves (riesgo + alerta)',
      'todos': 'Todos (riesgo + alerta + consejo)',
      'silencioso': 'Silencioso (solo riesgo)',
    };
    onToast(`Frecuencia: ${labels[freq]}`);
  };

  const alternarHorario = () => {
    const nuevo = { ...prefsBot, horarioSilencioso: !prefsBot.horarioSilencioso };
    guardarPrefsBot(nuevo);
    setPrefsBot(nuevo);
    onToast(nuevo.horarioSilencioso ? 'Horario silencioso ON (22:00–7:00)' : 'Horario silencioso OFF');
  };

  const probarBot = async () => {
    const ok = await probarBotProactivo();
    onToast(ok ? '🤖 Sale en 6 segundos…' : 'El equipo no permitió las notificaciones');
  };

  const reiniciarAvisosBot = () => {
    reiniciarDedupe();
    recargarDiag();
    onToast('🤖 Registro de avisos reiniciado — el bot puede volver a avisarte hoy');
  };

  const confirmarRestaurar = async () => {
    setConfirmRestaurar(false);
    if (syncTrabajando) return;
    setSyncTrabajando(true);
    const r = await restaurarDesdeNube();
    setSyncTrabajando(false);
    onToast(r.ok ? 'Datos de la nube restaurados ✓' : (r.error ?? 'No se pudo restaurar'));
  };

  const confirmarSubir = async () => {
    setConfirmSubir(false);
    if (syncTrabajando) return;
    setSyncTrabajando(true);
    const r = await subirTodoALaNube();
    setSyncTrabajando(false);
    onToast(r.ok ? 'Todo subido a la nube ✓' : (r.error ?? 'No se pudo subir'));
  };

  const exportar = async () => {
    const json = exportarRespaldo(estado);
    const blob = new Blob([json], { type: 'application/json' });
    await compartirArchivo(blob, nombreRespaldo());
    onToast('Respaldo JSON exportado');
  };

  const elegirArchivo = () => inputRef.current?.click();

  const alLeerArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const contenido = String(ev.target?.result ?? '');
      // Validación rápida antes de pedir confirmación
      try {
        const data = JSON.parse(contenido);
        if (!data || !Array.isArray(data.transactions)) {
          onToast('No parece un respaldo de WalletTrack');
          return;
        }
      } catch {
        onToast('Archivo JSON inválido');
        return;
      }
      setBorrador({ nombre: file.name, contenido });
      setConfirmandoImport(true);
    };
    reader.readAsText(file);
    e.target.value = ''; // permite re-elegir el mismo archivo
  };

  const confirmarImport = () => {
    if (!borrador) return;
    const ok = onImportar(borrador.contenido);
    setConfirmandoImport(false);
    setBorrador(null);
    if (ok) onToast('Backup importado: tus datos fueron reemplazados');
  };

  const nTransacciones = estado.transactions.length;
  const totalRespaldo = estado.goals.length + estado.subscriptions.length + estado.challenges.length
    + estado.sobres.length + estado.deudas.length + estado.productos.length;

  return (
    <div className="space-y-5 wt-aparece" data-testid="vista-config">

      {/* ── Info de la app ─────────────────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-black text-white">WalletTrack V2</h2>
            <p className="text-xs text-slate-400">
              Versión <span data-testid="version-config" className="font-mono text-emerald-400">{versionApp()}</span> ·
              Puerto modular del original
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> Entorno
            </p>
            <p className="text-sm font-bold text-slate-200 mt-0.5">{nombrePlataforma()}</p>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Moneda</p>
            <p className="text-sm font-bold text-slate-200 mt-0.5">Soles (S/) · es-PE</p>
          </div>
        </div>
        <div className="mt-3 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Tus datos</p>
          <p className="text-xs text-slate-300 mt-1">
            {nTransacciones} transacciones · {estado.goals.length} metas · {estado.budgets.length} presupuestos ·
            {' '}{estado.subscriptions.length} suscripciones · {estado.sobres.length + estado.deudas.length} registros de sobres/deudas
            {totalRespaldo > 0 && ' (se conservan al importar/exportar)'}
          </p>
        </div>
      </section>

      {/* ── Cuenta y Sincronización (F1) ─────────────────────── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5" data-testid="tarjeta-sync">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Cloud className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white">Cuenta y Sincronización</h3>
            <p className="text-[11px] text-slate-400 truncate">
              {cuenta ? (cuenta.email || 'Cuenta Google') : 'Sin cuenta — modo local'}
            </p>
          </div>
          {cuenta && (
            <span
              className={`ml-auto text-[9px] font-mono px-2 py-1 rounded-full border shrink-0 ${
                sync?.error
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : sync?.sincronizando
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}
              data-testid="sync-estado"
            >
              {sync?.error ? 'nube rechazada' : sync?.sincronizando ? 'sincronizando…' : sync?.activo ? 'activo' : 'local'}
            </span>
          )}
        </div>

        {cuenta ? (
          <>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              Tus movimientos y saldos se guardan solos en <b className="text-slate-200">wallettrack_sync</b>
              (tu documento privado en la nube): al entrar, cada 5 min, al volver a la app
              y 8 s después de cada cambio.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2">
                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wide">Última subida</p>
                <p className="text-xs font-bold text-slate-300 mt-0.5" data-testid="sync-ultima-subida">
                  {hace(sync?.ultimaSubida ?? null)}
                </p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2">
                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wide">Última bajada</p>
                <p className="text-xs font-bold text-slate-300 mt-0.5">
                  {hace(sync?.ultimaBajada ?? null)}
                </p>
              </div>
            </div>
            {sync?.error && (
              <p className="text-[11px] text-amber-400/90 leading-relaxed mb-3 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2">
                {sync.error}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={alSincronizarAhora}
                disabled={syncTrabajando}
                data-testid="boton-sincronizar"
                className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {syncTrabajando
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
                Sincronizar ahora
              </button>
              <button
                onClick={() => setConfirmRestaurar(true)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <CloudDownload className="w-3.5 h-3.5" /> Restaurar desde la nube
              </button>
              <button
                onClick={() => setConfirmSubir(true)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <CloudUpload className="w-3.5 h-3.5" /> Subir todo
              </button>
            </div>

          </>
        ) : (
          <>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              Estás en <b className="text-slate-200">modo local</b>: tus datos viven solo en este
              dispositivo (igual que siempre). Iniciá sesión con tu cuenta Google para
              respaldarlos y recuperarlos en cualquier teléfono.
            </p>
            <button
              onClick={onIniciarSesion}
              data-testid="boton-iniciar-sesion"
              className="w-full py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg"
            >
              <LogIn className="w-4 h-4" /> Iniciar sesión con Google
            </button>
          </>
        )}

        {/* F5 · 🩺 Diagnóstico: la causa exacta de "no me sincroniza" —
            también en modo local (te dice que falta iniciar sesión) */}          {/* F5 · 🩺 Diagnóstico: la causa exacta de "no me sincroniza" */}
          <div className="mt-3">
            <button
              onClick={diagnosticar}
              disabled={diagCorriendo}
              data-testid="boton-diagnosticar"
              className="w-full py-2.5 rounded-xl border border-cyan-500/40 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-300 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {diagCorriendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Stethoscope className="w-3.5 h-3.5" />}
              Diagnosticar sincronización
            </button>

            {diagnostico && (
              <div className="mt-2.5 space-y-1.5" data-testid="resultado-diagnostico">
                {diagnostico.map((p) => (
                  <div
                    key={p.paso}
                    className={`flex items-start gap-2 rounded-xl px-3 py-2 border ${
                      p.ok ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/30'
                    }`}
                  >
                    {p.ok
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      : <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-slate-200">{p.paso}</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{p.detalle}</p>
                    </div>
                  </div>
                ))}

                {/* Si la causa son las reglas → la regla exacta para copiar */}
                {diagnostico.some((p) => p.detalle.includes('permission-denied')) && (
                  <div className="rounded-xl bg-slate-950/80 border border-amber-500/30 p-3 space-y-2" data-testid="regla-firestore">
                    <p className="text-[11px] font-black text-amber-300">
                      👉 La causa: falta esta regla en Firestore. Copiala, pegala en Firebase Console
                      (fittrack-e06be → Firestore Database → Reglas, DENTRO de
                      match /databases/…/documents junto a las demás) y apretá Publicar:
                    </p>
                    <pre className="text-[10px] font-mono text-emerald-300 bg-black/40 rounded-lg p-2.5 overflow-x-auto leading-relaxed">
{REGLA_FIRESTORE}
                    </pre>
                    <button
                      onClick={copiarRegla}
                      className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-2"
                    >
                      {reglasCopiadas ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {reglasCopiadas ? 'Copiada ✓' : 'Copiar regla'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
      </section>

      {/* ── 🔒 Candado local (F5) ───────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5" data-testid="tarjeta-candado">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
            pinActivo() ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-slate-800 border-slate-700'
          }`}>
            <Lock className={`w-4 h-4 ${pinActivo() ? 'text-emerald-400' : 'text-slate-400'}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white">Candado de la app</h3>
            <p className="text-[11px] text-slate-400">
              {pinActivo()
                ? '🔒 Activo — se bloquea al abrir y al ir al fondo'
                : 'Sin PIN — cualquiera que tome tu celu ve tu dinero'}
            </p>
          </div>
          {pinActivo() && (
            <span className="ml-auto text-[9px] font-mono px-2 py-1 rounded-full border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shrink-0">
              ON
            </span>
          )}
        </div>

        <p className="text-xs text-slate-400 leading-relaxed mb-3">
          PIN de 4 dígitos + huella (si tu equipo la tiene). Local de este aparato: no viaja a la
          nube y no lo borra el reset de datos — como la clave de tu teléfono.
        </p>

        {/* Huella (solo con PIN activo y disponible) */}
        {pinActivo() && (
          <div className="mb-3 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2.5">
            <div className="flex items-center gap-3">
              <Fingerprint className={`w-4 h-4 shrink-0 ${huellaOn ? 'text-emerald-400' : 'text-slate-500'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-200">Desbloqueo con huella</p>
                <p className="text-[10px] text-slate-500 truncate">
                  {huellaEstado ? huellaEstado.detalle : 'consultando el equipo…'}
                </p>
              </div>
              <button
                onClick={() => {
                  const nuevo = !huellaOn;
                  alternarHuella(nuevo);
                  setHuellaOn(nuevo);
                  onToast(nuevo ? 'Huella activada 🔓' : 'Huella desactivada — queda el PIN');
                }}
                disabled={!esAPK() || !huellaEstado?.ok}
                title={!esAPK() ? 'Solo en el APK' : (huellaEstado?.ok ? '' : 'Este equipo no tiene huella')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all disabled:opacity-40 ${
                  huellaOn
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'border-slate-600 text-slate-400'
                }`}
                data-testid="toggle-huella"
              >
                {huellaOn ? 'ON' : 'OFF'}
              </button>
            </div>
            {!esAPK() && (
              <p className="text-[10px] text-slate-500 mt-1.5">(Disponible solo en el APK instalado)</p>
            )}
          </div>
        )}

        {/* Botones según estado */}
        {!pinActivo() && modoPin === null && (
          <button
            onClick={() => setModoPin('crear')}
            data-testid="boton-activar-pin"
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Lock className="w-3.5 h-3.5" /> Activar candado
          </button>
        )}
        {pinActivo() && modoPin === null && (
          <div className="flex gap-2">
            <button
              onClick={() => setModoPin('cambiar')}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all active:scale-[0.98]"
            >
              Cambiar PIN
            </button>
            <button
              onClick={() => setModoPin('quitar')}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-600/80 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-[0.98]"
              data-testid="boton-quitar-pin"
            >
              Quitar candado
            </button>
          </div>
        )}

        {/* Formulario según modo */}
        {modoPin !== null && (
          <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 space-y-2.5" data-testid="form-pin">
            <p className="text-[11px] font-black text-slate-300">
              {modoPin === 'crear' ? 'Elegí tu PIN de 4 dígitos' : modoPin === 'cambiar' ? 'PIN actual + nuevo' : 'Confirmá tu PIN para quitar el candado'}
            </p>
            {modoPin === 'cambiar' || modoPin === 'quitar' ? (
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinViejo}
                onChange={(e) => { setPinViejo(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                placeholder="PIN actual"
                data-testid="input-pin-actual"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-center text-lg font-black tracking-[0.5em] text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            ) : null}
            {modoPin !== 'quitar' && (
              <>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinNuevo}
                  onChange={(e) => { setPinNuevo(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                  placeholder={modoPin === 'crear' ? 'PIN (4 dígitos)' : 'PIN nuevo'}
                  data-testid="input-pin-nuevo"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-center text-lg font-black tracking-[0.5em] text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinConfirma}
                  onChange={(e) => { setPinConfirma(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                  placeholder="Repetir PIN"
                  data-testid="input-pin-confirma"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-center text-lg font-black tracking-[0.5em] text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </>
            )}
            {pinError && (
              <p className="text-xs font-bold text-rose-400" data-testid="error-pin">{pinError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setModoPin(null); setPinError(''); setPinViejo(''); setPinNuevo(''); setPinConfirma(''); }}
                className="flex-1 py-2 rounded-xl border border-slate-600 text-xs font-bold text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={guardarPin}
                disabled={candadoTrabajando}
                data-testid="boton-confirmar-pin"
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-60"
              >
                {modoPin === 'quitar' ? 'Quitar' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── 🔔 Recordatorios (F5) ─────────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5" data-testid="tarjeta-recordatorios">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
            recordatoriosOn ? 'bg-amber-500/15 border-amber-500/30' : 'bg-slate-800 border-slate-700'
          }`}>
            <Bell className={`w-4 h-4 ${recordatoriosOn ? 'text-amber-400' : 'text-slate-400'}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white">Recordatorios de vencimientos</h3>
            <p className="text-[11px] text-slate-400">
              {esAPK() ? 'Suena 3 días antes y el día del pago, 9:00 a.m.' : 'Solo en el APK — en web no hay notificaciones'}
            </p>
          </div>
          <button
            onClick={alternarAvisos}
            className={`ml-auto px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all shrink-0 ${
              recordatoriosOn
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'border-slate-600 text-slate-400'
            }`}
            data-testid="toggle-recordatorios"
          >
            {recordatoriosOn ? 'ON' : 'OFF'}
          </button>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-3">
          Gastos fijos y cuotas de deudas: la app te avisa en la campanita del teléfono aunque
          esté cerrada. Revisa la tarjeta de Gastos Fijos para ver qué está programado.
        </p>
        <div className="flex gap-2">
          <button
            onClick={probar}
            disabled={!esAPK()}
            data-testid="boton-probar-notificacion"
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Bell className="w-3.5 h-3.5" /> Probar notificación
          </button>
          <div className="flex-1 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-center">
            <p className="text-[11px] text-slate-400">
              {estado.subscriptions.length} fijo(s) · {estado.deudas.filter((d) => d.cuotasPagadas < d.totalCuotas).length} deuda(s) con cuotas
            </p>
          </div>
        </div>
      </section>

      {/* ── 🤖 Bot Proactivo (F7) ──────────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 border border-indigo-500/20 p-5" data-testid="tarjeta-bot-proactivo">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
            prefsBot.activo ? 'bg-indigo-500/15 border-indigo-500/30' : 'bg-slate-800 border-slate-700'
          }`}>
            <Bot className={`w-4 h-4 ${prefsBot.activo ? 'text-indigo-400' : 'text-slate-400'}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white">WalletBot Proactivo</h3>
            <p className="text-[11px] text-slate-400">
              {esAPK() ? 'El bot te avisa cuando detecta algo importante' : 'Solo en el APK — en web no hay notificaciones'}
            </p>
          </div>
          <button
            onClick={alternarBot}
            className={`ml-auto px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all shrink-0 ${
              prefsBot.activo
                ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                : 'border-slate-600 text-slate-400'
            }`}
            data-testid="toggle-bot-proactivo"
          >
            {prefsBot.activo ? 'ON' : 'OFF'}
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          El bot analiza tus gastos con las mismas 12 reglas del chat y te empuja avisos cuando detecta
          algo: presupuesto en riesgo, categoría excesiva, tasa de ahorro crítica, gastos creciendo.
          No te aburre: <strong className="text-slate-300">un aviso por día</strong> como máximo, y respeta tu descanso.
        </p>

        {/* Frecuencia */}
        <div className="mb-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Frecuencia</p>
          <div className="grid grid-cols-3 gap-2" data-testid="selector-frecuencia-bot">
            {([
              { id: 'solo-graves', label: 'Solo graves', desc: 'Riesgo + alerta' },
              { id: 'todos',       label: 'Todos',       desc: 'Riesgo + alerta + consejo' },
              { id: 'silencioso',  label: 'Silencioso',  desc: 'Solo riesgo' },
            ] as { id: FrecuenciaBot; label: string; desc: string }[]).map((opt) => (
              <button
                key={opt.id}
                onClick={() => cambiarFrecuencia(opt.id)}
                data-testid={`freq-bot-${opt.id}`}
                disabled={!prefsBot.activo}
                className={`py-2 px-2 rounded-xl border text-center transition-all disabled:opacity-40 ${
                  prefsBot.frecuencia === opt.id
                    ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-600'
                }`}
              >
                <p className="text-[11px] font-bold">{opt.label}</p>
                <p className="text-[9px] opacity-70 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Horario silencioso */}
        <div className="flex items-center gap-2.5 mb-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
          {prefsBot.horarioSilencioso ? (
            <VolumeX className="w-4 h-4 text-indigo-400 shrink-0" />
          ) : (
            <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-200">Horario silencioso</p>
            <p className="text-[10px] text-slate-500">No molesta de 22:00 a 7:00</p>
          </div>
          <button
            onClick={alternarHorario}
            disabled={!prefsBot.activo}
            data-testid="toggle-horario-silencioso"
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all disabled:opacity-40 shrink-0 ${
              prefsBot.horarioSilencioso
                ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                : 'border-slate-600 text-slate-400'
            }`}
          >
            {prefsBot.horarioSilencioso ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Diagnóstico */}
        {esAPK() && (
          <div className="mb-3 p-2.5 rounded-xl bg-slate-950/40 border border-slate-800 text-[11px]">
            <p className="text-slate-400">
              <span className="text-slate-300 font-bold">Avisos hoy:</span> {diagBot.avisosHoy}
              {diagBot.enHorarioSilencioso && prefsBot.horarioSilencioso && (
                <span className="text-amber-400 ml-2">· en horario silencioso ahora</span>
              )}
            </p>
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-2">
          <button
            onClick={probarBot}
            disabled={!esAPK() || !prefsBot.activo}
            data-testid="boton-probar-bot"
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Bot className="w-3.5 h-3.5" /> Probar aviso
          </button>
          <button
            onClick={reiniciarAvisosBot}
            data-testid="boton-reiniciar-avisos"
            title="Reiniciar registro de avisos (el bot puede volver a avisarte hoy)"
            className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-2 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reiniciar
          </button>
        </div>
      </section>

      {/* ── Respaldo ───────────────────────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <h3 className="font-bold text-slate-200 text-base mb-1">Respaldo de Datos</h3>
        <p className="text-xs text-slate-400 mb-4">
          Formato <span className="font-mono text-emerald-400">v3.0</span> — el MISMO del WalletTrack original:
          podés importar acá un backup del viejo y exportar para volver a él.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={exportar}
            data-testid="boton-exportar-respaldo"
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20"
          >
            <Download className="w-4 h-4" /> Exportar respaldo
          </button>
          <button
            onClick={elegirArchivo}
            data-testid="boton-importar-respaldo"
            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Upload className="w-4 h-4" /> Importar backup del viejo
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            onChange={alLeerArchivo}
            className="hidden"
            data-testid="input-respaldo"
          />
        </div>

        {esAPK() && (
          <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
            En el APK el respaldo se guarda en Documentos y se abre el menú de compartir.
          </p>
        )}
      </section>

      {/* ── Apariencia (F4 · Theme Studio) ─────────────────────── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <h3 className="font-bold text-slate-200 text-base mb-1 flex items-center gap-2">
          <Palette className="w-4 h-4 text-emerald-400" /> Apariencia · Theme Studio
        </h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          9 temas de color, 5 niveles de luminosidad, 5 estilos de componentes, fondos animados,
          tipografía y modo compacto — todo se aplica en vivo y se guarda en este aparato.
        </p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0" data-testid="resumen-tema">
            <span
              className="w-6 h-6 rounded-full border border-slate-600 shrink-0"
              style={{ background: temaActual.accent }}
            />
            <p className="text-xs text-slate-300 font-semibold truncate">
              {temaActual.name === 'custom' ? 'Custom' : temaActual.name} · {temaActual.brightness} · {temaActual.font}
            </p>
          </div>
          <button
            onClick={() => onAbrirStudio?.()}
            data-testid="boton-abrir-studio"
            className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all active:scale-95 shrink-0"
          >
            🎨 Personalizar
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          También lo abrís con el 🎨 del header (y el ↺ del studio vuelve al tema Emerald Deep).
        </p>
      </section>

      {/* ── Roadmap ────────────────────────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 border border-slate-700/80 p-5">
        <h3 className="font-bold text-slate-200 text-base mb-1 flex items-center gap-2">
          <Map className="w-4 h-4 text-emerald-400" /> Hoja de Ruta
        </h3>
        <p className="text-xs text-slate-400 mb-4">Fases que siguen (mismo ritmo del FitTrack V2):</p>
        <div className="space-y-2.5">
          <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-3">
            <p className="text-xs font-black text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> F1 · Acceso y nube ✓ (instalada)
            </p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Login con Google + respaldo automático en wallettrack_sync y modo local.
            </p>
          </div>
          <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-3">
            <p className="text-xs font-black text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> F2 · El método completo ✓ (instalada)
            </p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Sobres de dinero, deudas y apartados, presupuestos con barras y alertas, metas de ahorro con aportes — con nube desde el día 1.
            </p>
          </div>
          <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-3">
            <p className="text-xs font-black text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> F3 · Análisis y control ✓ (instalada)
            </p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Estadísticas con gráficas, gastos fijos (suscripciones) con botón Pagar, calendario de pagos, retos financieros, lista de compras con biblioteca de productos y export Excel/PDF.
            </p>
          </div>
          <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-3">
            <p className="text-xs font-black text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> F4 · 🤖 WalletBot + Theme Studio ✓ (instalada)
            </p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              WalletBot 2.0: análisis priorizado del mes y preguntas rápidas con tus datos reales (offline). Theme Studio: 9 temas, luminosidad, estilos, fondos animados y tipografía.
            </p>
          </div>
          <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-3">
            <p className="text-xs font-black text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> F5 · 🔒 Seguridad + Conveniencia ✓ (instalada)
            </p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Candado local (PIN + huella, se re-bloquea al fondo), recordatorios de vencimientos con notificaciones, sueldos y fijos programados que se registran solos, categorías y cuentas propias, y diagnóstico del sync con la regla de Firestore lista para copiar.
            </p>
          </div>
          <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-3">
            <p className="text-xs font-black text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> F6 · 📎 Comprobantes ✓ (instalada)
            </p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Foto de boleta en cada transacción (cámara o galería), subida a Firebase Storage con cola offline persistente, thumbnail en historial con puntito naranja si pendiente, y viewer pantalla completa con zoom.
            </p>
          </div>
          <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-3">
            <p className="text-xs font-black text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> F7 · 🤖 Bot Proactivo ✓ (instalada)
            </p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              El bot te empuja avisos inteligentes con notificaciones locales cuando detecta algo: presupuesto en riesgo, categoría excesiva, tasa de ahorro crítica, gastos creciendo. Reutiliza las 12 reglas del chat con dedupe por día y horario silencioso 22:00–7:00.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-300 leading-relaxed">
            La app ya mantiene <b>todas</b> tus claves de datos originales (sobres, deudas,
            compras, etc.): cuando lleguen sus fases, los datos importados aparecen solos —
            y desde F1 también viajan a tu nube.
          </p>
        </div>
      </section>

      {/* ── Confirmación: restaurar desde la nube (F1) ────────── */}
      {confirmRestaurar && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmRestaurar(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-sm w-full shadow-2xl" data-testid="modal-restaurar-nube">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center shrink-0">
                <CloudDownload className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Restaurar desde la nube</h3>
                <p className="text-[11px] text-slate-400">Reemplaza este teléfono</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Los datos de este teléfono se reemplazan con los de tu nube. Útil para recuperar
              o pasar a un celu nuevo. ¿Continuar?
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setConfirmRestaurar(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-xs font-bold text-slate-300 hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarRestaurar}
                data-testid="boton-confirmar-restaurar"
                className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all"
              >
                Sí, restaurar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmación: subir todo a la nube (F1) ────────────── */}
      {confirmSubir && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmSubir(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-sm w-full shadow-2xl" data-testid="modal-subir-nube">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
                <CloudUpload className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Subir todo a la nube</h3>
                <p className="text-[11px] text-slate-400">Reemplaza la nube</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              TODO lo de este teléfono se sube y reemplaza tu nube (útil después de
              importar un respaldo o de reiniciar). ¿Continuar?
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setConfirmSubir(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-xs font-bold text-slate-300 hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarSubir}
                data-testid="boton-confirmar-subir"
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all"
              >
                Sí, subir todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmación de importación ────────────────────────── */}
      {confirmandoImport && borrador && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmandoImport(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-sm w-full shadow-2xl" data-testid="modal-importar">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Importar backup</h3>
                <p className="text-[11px] text-slate-400 truncate max-w-[180px]">{borrador.nombre}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Esto reemplazará todos tus datos actuales con los del archivo. ¿Continuar?
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => { setConfirmandoImport(false); setBorrador(null); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-xs font-bold text-slate-300 hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarImport}
                data-testid="boton-confirmar-importar"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
              >
                Sí, importar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
