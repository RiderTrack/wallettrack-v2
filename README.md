# WalletTrack V2 🪙

Finanzas personales — **versión modular** de tu WalletTrack original (`wallettrack.github.io`).
Arquitectura gemela de FitTrack V2: React 19 + Vite 6 + TypeScript + Tailwind CSS 4 + Capacitor 6 (APK Android).

## 📱 Qué es

Puerto profesional del monolito HTML original a componentes modulares, **manteniendo compatibilidad total de datos**:
usa las mismas 19 claves `wallettrack_*` de localStorage y el mismo formato de respaldo JSON v3.0 —
un backup hecho en la app vieja importa sin conversión.

## 🗺️ Hoja de ruta

| Fase | Estado | Contenido |
|------|--------|-----------|
| F0 | ✅ | Base modular: Dashboard (patrimonio, flujo del mes, gastos rápidos, cuentas, últimos movimientos), Cuentas (saldos iniciales, transferencias, tarjetas), Historial (filtros + CSV + eliminar), Configuración (respaldo JSON v3.0), ☰ menú hamburguesa, barra inferior de 4 destinos, CI con APK firmado |
| F1 | ✅ | Acceso: login con Google (Firebase), modo local 100 % offline, respaldo en la nube wallettrack_sync/{uid} con merge sin borrar |
| F2 | ✅ | El método completo: Sobres de dinero (recargar/gastar/historial), Deudas y apartados (cuotas + apartar semanal), Presupuestos por categoría con alertas 80 %/100 %, Metas de ahorro con aportes |
| F3 | ✅ | Análisis y control: Estadísticas con gráficas SVG (evolución + ahorro %), Gastos Fijos con botón Pagar (+1 mes), Calendario de pagos mensual, Retos financieros, Lista de compras con biblioteca de productos e historial, Export Excel (5 hojas) y PDF |
| F4 | 🔒 | 🤖 WalletBot — robot IA de finanzas con tus datos reales |

## 🏗️ Desarrollo local

```bash
npm install
npm run dev      # http://localhost:3200
npm run lint     # tsc --noEmit
npm run build    # vite build → dist/
```

## 📦 APK

Cada push a `main` dispara GitHub Actions → artifact `WalletTrack-V2-APK` (firmado).

> Para que la V2 **actualice sobre la app ya instalada** (conservando tus datos):
> copiá el secret `KEYSTORE_BASE64` del repo `wallettrack.github.io` a este repo
> (mismo appId `com.wallettrack.app` + misma firma = instalación en lugar de app nueva).

## 🧠 Estructura

```
src/
  App.tsx               # Shell: header + ☰ drawer + nav inferior + modales
  types.ts              # Contrato de datos 1:1 con el viejo
  components/
    NavDrawer.tsx        # Menú hamburguesa (todas las secciones)
    DashboardView.tsx    # Patrimonio + flujo del mes + gastos rápidos
    CuentasView.tsx      # Tarjetas por cuenta + saldos + transferencias
    HistorialView.tsx    # Tabla con filtros + export CSV
    ConfiguracionView.tsx# Respaldo JSON v3.0 + roadmap
    ModalTransaccion.tsx # Form de ingreso/gasto
    VistaBloqueada.tsx   # Placeholder de F4
  services/
    estado.ts            # 19 claves wallettrack_* + respaldo v3.0
    dinero.ts            # Formato S/ es-PE + fechas
    archivo.ts           # Export/compartir (APK y web)
    exportar.ts          # F3: Excel (5 hojas) + PDF con import dinámico
    platform.ts          # Entorno + versión
  data/catalogos.ts     # Cuentas y categorías del original
```

> F3 añade: SobresView · DeudasView · PresupuestosView · MetasView (F2) y
> ComprasView · SuscripcionesView · CalendarioView · RetosView ·
> EstadisticasView + GraficasStats (F3). El Excel/PDF usa exceljs + jspdf
> como dependencias con import dinámico (chunks separados, offline en APK).
