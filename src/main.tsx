import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { inicializarTema } from './services/tema.ts';

// F4: aplicar el tema guardado (wallettrack_theme, misma clave del
// viejo) ANTES del primer render → sin flash de color al abrir.
inicializarTema();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
