import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Misma configuración base que FitTrack V2 (arquitectura gemela).
// El alias '@' apunta a src/ y el puerto 3200 evita chocar con
// RiderTrack (3000) y FitTrack (3100) cuando los tres corren en
// dev al mismo tiempo.
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
