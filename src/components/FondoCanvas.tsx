// ═══════════════════════════════════════════════════════════
// 🌌 FONDO CANVAS — WalletTrack V2 (F4 · Theme Studio)
// Los 6 fondos animados del Theme Studio 2.0 del viejo,
// portados 1:1 (particles / gradient / aurora / pulse / matrix):
// mismos parámetros, mismos colores (acento + indigo + pink),
// mismo requestAnimationFrame con cancelación al desmontar.
// Canvas fijo DETRÁS del contenido (z -1, pointer-events none):
// el fondo del root se vuelve transparente vía body.wt-fondo-anim
// (regla de index.css) y el canvas se ve a través de las
// tarjetas glass. Se pausa cuando la app pasa a segundo plano
// (visibilitychange) para no gastar batería en el APK.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';

interface FondoCanvasProps {
  tipo: string;   // 'none' | 'particles' | 'gradient' | 'aurora' | 'pulse' | 'matrix'
  accent: string; // color de acento del tema
}

export const FondoCanvas: React.FC<FondoCanvasProps> = ({ tipo, accent }) => {
  const refCanvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (tipo === 'none' || !refCanvas.current) return;
    const canvas = refCanvas.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number | null = null;
    const escalar = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    escalar();
    window.addEventListener('resize', escalar);

    // Pausa en segundo plano (batería del APK)
    let pausado = false;
    const onVis = () => {
      pausado = document.hidden;
      if (!pausado && animId === null) programar();
    };
    document.addEventListener('visibilitychange', onVis);

    let rafId: number | null = null;
    const programar = () => { rafId = requestAnimationFrame(paso); };

    // ── PARTÍCULAS (60, drift ±0.4, alpha .1-.6) — 1:1 ────────
    let particulas: { x: number; y: number; r: number; vx: number; vy: number; alpha: number }[] = [];
    if (tipo === 'particles') {
      particulas = Array.from({ length: 60 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        alpha: Math.random() * 0.5 + 0.1,
      }));
    }

    // ── MATRIX (columnas de 14px, monedas) — 1:1 ──────────────
    let columnas = 0;
    let gotas: number[] = [];
    const caracteres = '₡$€£¥₩₪₱₿01';
    if (tipo === 'matrix') {
      columnas = Math.floor(canvas.width / 14);
      gotas = Array(columnas).fill(1);
    }

    let t = 0;

    const paso = () => {
      if (pausado) { rafId = null; return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (tipo === 'particles') {
        particulas.forEach((p) => {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0) p.x = canvas.width;
          if (p.x > canvas.width) p.x = 0;
          if (p.y < 0) p.y = canvas.height;
          if (p.y > canvas.height) p.y = 0;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = accent + Math.floor(p.alpha * 255).toString(16).padStart(2, '0');
          ctx.fill();
        });

      } else if (tipo === 'gradient') {
        t += 0.003;
        const grd = ctx.createLinearGradient(
          canvas.width * (0.5 + 0.5 * Math.sin(t)), 0,
          canvas.width * (0.5 + 0.5 * Math.cos(t * 0.7)), canvas.height,
        );
        grd.addColorStop(0, accent + '18');
        grd.addColorStop(0.5, '#6366f118');
        grd.addColorStop(1, '#09131600');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

      } else if (tipo === 'aurora') {
        t += 0.005;
        for (let i = 0; i < 3; i++) {
          const grd = ctx.createRadialGradient(
            canvas.width * (0.3 + 0.4 * Math.sin(t + i * 2.1)),
            canvas.height * (0.4 + 0.3 * Math.cos(t * 0.8 + i * 1.7)),
            0,
            canvas.width * 0.5, canvas.height * 0.5,
            canvas.width * 0.6,
          );
          const cols = [accent, '#6366f1', '#ec4899'];
          grd.addColorStop(0, cols[i] + '22');
          grd.addColorStop(1, 'transparent');
          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

      } else if (tipo === 'pulse') {
        t += 0.02;
        const cx = canvas.width / 2, cy = canvas.height / 2;
        for (let i = 3; i >= 0; i--) {
          const r = (100 + i * 80) + Math.sin(t + i) * 30;
          const alpha = 0.06 - i * 0.012;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = accent + Math.max(0, Math.floor(alpha * 255)).toString(16).padStart(2, '0');
          ctx.fill();
        }

      } else if (tipo === 'matrix') {
        ctx.fillStyle = 'rgba(9,13,22,.12)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = accent + '99';
        ctx.font = '11px monospace';
        gotas.forEach((y, i) => {
          ctx.fillText(caracteres[Math.floor(Math.random() * caracteres.length)], i * 14, y * 14);
          if (y * 14 > canvas.height && Math.random() > 0.975) gotas[i] = 0;
          gotas[i]++;
        });
      }

      rafId = requestAnimationFrame(paso);
    };
    programar();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      animId = null;
      window.removeEventListener('resize', escalar);
      document.removeEventListener('visibilitychange', onVis);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [tipo, accent]);

  if (tipo === 'none') return null;

  return (
    <canvas
      ref={refCanvas}
      data-testid="fondo-canvas"
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: -1 }}
    />
  );
};
