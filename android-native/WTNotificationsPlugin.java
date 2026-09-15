package com.wallettrack.app;

// ═══════════════════════════════════════════════════════════
// 🔔 F10 · WTNotificationsPlugin — WalletTrack V2
// Puente Capacitor del lector de notificaciones bancarias.
//
// El proyecto android/ se genera FRESCO en cada build (cap add),
// así que este archivo vive en el repo (android-native/) y el CI
// lo copia a android/app/src/main/java/com/wallettrack/app/.
// Se registra en MainActivity con registerPlugin().
//
// Métodos que llama el JS (src/services/captura.ts):
//   checkAccess()      → ¿el usuario activó el acceso a notifs?
//   openAccessSettings() → abre Ajustes → Acceso a notificaciones
//   setConfig()        → allowlist de package names (SharedPreferences)
//   getConfig()        → lee la allowlist actual
//   getBuffer(since)   → capturas guardadas desde un timestamp
//   clearBuffer()      → vacía el buffer local
//   addTestCapture()   → simula una notificación (botón Probar)
//   listFinanceApps()  → apps financieras conocidas instaladas
//
// PRIVACÍA: la allowlist se filtra en el lado NATIVO (WTCaptureService
// llama a paquetePermitido ANTES de leer nada). Las notificaciones de
// apps no autorizadas jamás se parsean ni se guardan. El buffer es un
// archivo local en filesDir — nada sale del teléfono.
// ═══════════════════════════════════════════════════════════

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@CapacitorPlugin(name = "WTNotifications")
public class WTNotificationsPlugin extends Plugin {

    static final String PREFS = "wt_notif_prefs";
    static final String KEY_PACKAGES = "allowed_packages";
    private static final String BUFFER = "wt_notif_buffer.jsonl";
    private static final int BUFFER_MAX = 400;

    // Apps financieras peruanas conocidas (para <queries> del manifest
    // y para el picker de Ajustes). Package names verificados en
    // Google Play, setiembre 2026.
    static final String[] APPS_FINANCIERAS = {
        "com.bcp.bank.bcp",                  // Banca Móvil BCP
        "com.bcp.innovacxion.yapeapp",       // Yape
        "pe.com.interbank.mobilebanking",    // Interbank APP
        "com.bbva.nxt_peru",                 // BBVA Perú
        "pe.com.scotiabank.blpm.android.client", // Scotiabank Perú
    };

    // Plugins vivos (uno por WebView) — el service empuja capturas acá
    private static final List<WTNotificationsPlugin> vivos = new ArrayList<>();

    @Override
    public void load() {
        synchronized (vivos) { vivos.add(this); }
    }

    @Override
    protected void handleOnDestroy() {
        synchronized (vivos) { vivos.remove(this); }
        super.handleOnDestroy();
    }

    // ── Estáticos compartidos con WTCaptureService ───────────────

    /**
     * PRIVACÍA: allowlist en SharedPreferences — SOLO estas apps se leen.
     * Por defecto la lista está vacía (nadie se lee hasta que el usuario
     * elige). El JS la llena desde Ajustes (setConfig).
     */
    static boolean paquetePermitido(Context ctx, String pkg) {
        try {
            SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            Set<String> permitidos = sp.getStringSet(KEY_PACKAGES, null);
            if (permitidos == null) return false;
            return permitidos.contains(pkg);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Agrega una línea JSON al buffer local (una captura por línea).
     * Cap BUFFER_MAX líneas: si se pasa, conserva las MÁS RECIENTES.
     * synchronized static: el service y el plugin (addTestCapture)
     * podrían escribir a la vez.
     */
    static synchronized void appendAlBuffer(Context ctx, String json) {
        try {
            File f = new File(ctx.getFilesDir(), BUFFER);
            StringBuilder sb = new StringBuilder();
            if (f.exists()) {
                try (FileInputStream fis = new FileInputStream(f)) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = fis.read(buf)) > 0) {
                        sb.append(new String(buf, 0, n, StandardCharsets.UTF_8));
                    }
                } catch (Exception ignored) { }
            }
            String contenido = sb.toString();
            if (!contenido.isEmpty()) contenido = contenido + "\n";
            contenido = contenido + json;

            String[] lineas = contenido.split("\n");
            if (lineas.length > BUFFER_MAX) {
                StringBuilder recorte = new StringBuilder();
                for (int i = lineas.length - BUFFER_MAX; i < lineas.length; i++) {
                    if (recorte.length() > 0) recorte.append('\n');
                    recorte.append(lineas[i]);
                }
                contenido = recorte.toString();
            }
            try (FileOutputStream fos = new FileOutputStream(f, false)) {
                fos.write(contenido.getBytes(StandardCharsets.UTF_8));
            } catch (Exception ignored) { }
        } catch (Exception ignored) { }
    }

    /** Lee el buffer completo y devuelve las capturas con ts > since */
    static JSONArray leerBuffer(Context ctx, long since) {
        JSONArray arr = new JSONArray();
        try {
            File f = new File(ctx.getFilesDir(), BUFFER);
            if (!f.exists()) return arr;
            StringBuilder sb = new StringBuilder();
            try (FileInputStream fis = new FileInputStream(f)) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = fis.read(buf)) > 0) {
                    sb.append(new String(buf, 0, n, StandardCharsets.UTF_8));
                }
            }
            String[] lineas = sb.toString().split("\n");
            for (String linea : lineas) {
                String l = linea.trim();
                if (l.isEmpty()) continue;
                try {
                    JSONObject o = new JSONObject(l);
                    if (o.optLong("ts", 0) > since) arr.put(o);
                } catch (Exception ignored) { } // línea corrupta → salta
            }
        } catch (Exception ignored) { }
        return arr;
    }

    /** El service avisa a todas las WebViews vivas que llegó una captura */
    static void emitirCaptura(JSONObject obj) {
        List<WTNotificationsPlugin> copia;
        synchronized (vivos) {
            copia = new ArrayList<>(vivos);
        }
        for (WTNotificationsPlugin p : copia) {
            try {
                JSObject data = new JSObject();
                JSONArray claves = obj.names();
                for (int i = 0; claves != null && i < claves.length(); i++) {
                    String k = claves.optString(i);
                    if (k != null && !k.isEmpty()) data.put(k, obj.opt(k));
                }
                p.notifyListeners("wtCapture", data);
            } catch (Exception ignored) { }
        }
    }

    /** ¿El usuario activó el acceso a notificaciones para esta app? */
    static boolean accesoActivo(Context ctx) {
        try {
            String raw = Settings.Secure.getString(
                    ctx.getContentResolver(), "enabled_notification_listeners");
            if (raw == null || raw.isEmpty()) return false;
            // Mismo formato con el que Android guarda la lista:
            // "com.wallettrack.app/com.wallettrack.app.WTCaptureService"
            String yo = new ComponentName(ctx, WTCaptureService.class).flattenToString();
            String[] partes = raw.split(":");
            for (String parte : partes) {
                if (parte.equals(yo)) return true;
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    // ── Métodos que llama el JS ──────────────────────────────────

    @PluginMethod
    public void checkAccess(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", accesoActivo(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo abrir: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setConfig(PluginCall call) {
        try {
            JSArray pkgs = call.getArray("packages");
            Set<String> set = new HashSet<>();
            if (pkgs != null) {
                for (int i = 0; i < pkgs.length(); i++) {
                    String p = pkgs.optString(i, "");
                    if (p != null && !p.trim().isEmpty()) set.add(p.trim());
                }
            }
            SharedPreferences sp = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            sp.edit().putStringSet(KEY_PACKAGES, set).apply();

            JSArray resp = new JSArray();
            for (String p : set) resp.put(p);
            JSObject r = new JSObject();
            r.put("packages", resp);
            r.put("count", set.size());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("setConfig: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getConfig(PluginCall call) {
        try {
            SharedPreferences sp = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            Set<String> set = sp.getStringSet(KEY_PACKAGES, null);
            JSArray arr = new JSArray();
            if (set != null) for (String p : set) arr.put(p);
            JSObject r = new JSObject();
            r.put("packages", arr);
            r.put("count", set == null ? 0 : set.size());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("getConfig: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getBuffer(PluginCall call) {
        try {
            Long sinceL = call.getLong("since");
            long since = sinceL == null ? 0L : sinceL;
            JSObject r = new JSObject();
            r.put("captures", leerBuffer(getContext(), since));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("getBuffer: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearBuffer(PluginCall call) {
        try {
            File f = new File(getContext().getFilesDir(), BUFFER);
            if (f.exists()) {
                try (FileOutputStream fos = new FileOutputStream(f, false)) {
                    fos.write(new byte[0]);
                } catch (Exception ignored) { }
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("clearBuffer: " + e.getMessage());
        }
    }

    /**
     * Simula la captura de una notificación bancaria — el botón
     * "Probar captura" de Ajustes pasa por TODO el pipeline real
     * (buffer + evento + parser JS + transacción).
     */
    @PluginMethod
    public void addTestCapture(PluginCall call) {
        try {
            String pkg = call.getString("pkg");
            String title = call.getString("title");
            String text = call.getString("text");
            if (pkg == null || pkg.isEmpty()) pkg = "com.bcp.bank.bcp";
            if (title == null) title = "BCP";
            if (text == null) text = "Compraste S/ 25.50 en UBER *VIAJE LIMA PE";

            JSONObject o = new JSONObject();
            o.put("pkg", pkg);
            o.put("title", title);
            o.put("text", text);
            o.put("sub", "");
            o.put("ts", System.currentTimeMillis());
            appendAlBuffer(getContext(), o.toString());
            emitirCaptura(o);
            call.resolve();
        } catch (Exception e) {
            call.reject("addTestCapture: " + e.getMessage());
        }
    }

    /** Devuelve las apps financieras conocidas que están instaladas */
    @PluginMethod
    public void listFinanceApps(PluginCall call) {
        try {
            JSArray arr = new JSArray();
            PackageManager pm = getContext().getPackageManager();
            for (String pkg : APPS_FINANCIERAS) {
                try {
                    ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
                    JSObject o = new JSObject();
                    o.put("pkg", pkg);
                    o.put("label", info.loadLabel(pm).toString());
                    arr.put(o);
                } catch (Exception ignored) { } // no instalada → no se lista
            }
            JSObject r = new JSObject();
            r.put("apps", arr);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("listFinanceApps: " + e.getMessage());
        }
    }
}
