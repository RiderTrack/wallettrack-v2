package com.wallettrack.app;

// ═══════════════════════════════════════════════════════════
// 🔔 F10 · WTCaptureService — WalletTrack V2
// NotificationListenerService que captura SOLO las notificaciones
// de las apps financieras que el usuario eligió (BCP, Yape,
// Interbank, BBVA, Scotiabank…). Se registra en el
// AndroidManifest con BIND_NOTIFICATION_LISTENER_SERVICE y el
// usuario lo activa desde Ajustes → Acceso a notificaciones.
//
// FUNCIONAMIENTO (por cada notificación del teléfono):
//   1. Mira el package name → si NO está en la allowlist del
//      usuario (SharedPreferences), la descarta ACÁ MISMO.
//      PRIVACÍA: las notificaciones de WhatsApp, Gmail, etc.
//      jamás se leen, ni se guardan, ni cruzan al WebView.
//   2. Extrae title + texto (bigText expandido si hay).
//   3. La guarda en el buffer local (jsonl con cap 400) para que
//      la app la procese aunque esté cerrada.
//   4. Si la WebView está viva → le empuja el evento wtCapture
//      (tiempo real); si no, quedará en el buffer para el
//      próximo arranque.
//
// NADA sale del teléfono. Sin permisos de red extra. Sin Firebase.
// ═══════════════════════════════════════════════════════════

import android.app.Notification;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONObject;

public class WTCaptureService extends NotificationListenerService {

    // Dedupe de ráfaga: Android a veces entrega la misma notificación
    // dos veces seguidas (update de progreso, re-post del sistema).
    private static String ultimaJson = "";
    private static long ultimaTs = 0;

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String pkg = sbn.getPackageName();
            if (pkg == null || pkg.isEmpty()) return;
            if (pkg.equals("com.wallettrack.app")) return; // las propias no

            // PRIVACÍA: allowlist ANTES de procesar absolutamente nada
            if (!WTNotificationsPlugin.paquetePermitido(this, pkg)) return;

            Notification n = sbn.getNotification();
            if (n == null || n.extras == null) return;

            CharSequence titleCs = n.extras.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence bigCs = n.extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            CharSequence textCs = n.extras.getCharSequence(Notification.EXTRA_TEXT);
            CharSequence subCs = n.extras.getCharSequence(Notification.EXTRA_SUB_TEXT);

            String title = titleCs == null ? "" : titleCs.toString().trim();
            String big = bigCs == null ? "" : bigCs.toString().trim();
            String text = textCs == null ? "" : textCs.toString().trim();
            String sub = subCs == null ? "" : subCs.toString().trim();

            // bigText = texto completo cuando está expandido; si no, text
            String cuerpo = big.length() > 0 ? big : text;

            if (title.isEmpty() && cuerpo.isEmpty() && sub.isEmpty()) return;

            long ts = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();

            JSONObject obj = new JSONObject();
            obj.put("pkg", pkg);
            obj.put("title", title);
            obj.put("text", cuerpo);
            obj.put("sub", sub);
            obj.put("ts", ts);
            String json = obj.toString();

            // Dedupe de ráfaga: contenido idéntico en <2.5 s → una sola vez
            if (json.equals(ultimaJson) && Math.abs(ts - ultimaTs) < 2500) return;
            ultimaJson = json;
            ultimaTs = ts;

            // Buffer SIEMPRE (la app puede estar cerrada) + push si está viva
            WTNotificationsPlugin.appendAlBuffer(this, json);
            WTNotificationsPlugin.emitirCaptura(obj);
        } catch (Throwable t) {
            // El listener NUNCA puede crashear por una notificación —
            // si lo hiciera, Android lo desactiva y deja de capturar.
        }
    }
}
