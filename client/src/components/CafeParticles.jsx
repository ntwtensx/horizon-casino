import React, { useEffect, useRef } from 'react';

const MAX_PARTICLES = 34;

function buildPalette(mood, landmarks) {
  const ownedIds = new Set((landmarks || []).filter((l) => l.owned).map((l) => l.id));
  const items = [
    { kind: 'bokeh', color: 'rgba(227, 167, 59, 0.22)' },
    { kind: 'bokeh', color: 'rgba(209, 152, 122, 0.22)' },
    { kind: 'bokeh', color: 'rgba(255, 253, 249, 0.55)' }
  ];

  if (ownedIds.has('SAKURA')) items.push({ kind: 'emoji', char: '🌸' });
  if (ownedIds.has('GARDEN')) items.push({ kind: 'emoji', char: '🍃' });
  if (ownedIds.has('MEADOW')) items.push({ kind: 'emoji', char: '✨' });
  if (ownedIds.has('BEACH')) items.push({ kind: 'bokeh', color: 'rgba(130, 192, 214, 0.26)' });
  if (ownedIds.has('RIVER')) items.push({ kind: 'bokeh', color: 'rgba(146, 196, 174, 0.25)' });

  if (mood === 'miracle') {
    items.push({ kind: 'bokeh', color: 'rgba(165, 130, 209, 0.30)' });
    items.push({ kind: 'emoji', char: '✦' });
  } else if (mood === 'win') {
    items.push({ kind: 'bokeh', color: 'rgba(235, 184, 72, 0.34)' });
  } else if (mood === 'bad') {
    items.push({ kind: 'bokeh', color: 'rgba(207, 99, 114, 0.20)' });
  }

  return items;
}

export default function CafeParticles({ mood = 'idle', landmarks = [] }) {
  const canvasRef = useRef(null);
  const configRef = useRef({ mood, landmarks });

  useEffect(() => {
    configRef.current = { mood, landmarks };
  }, [mood, landmarks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const spawnParticle = (randomY = false) => {
      const palette = buildPalette(configRef.current.mood, configRef.current.landmarks);
      const spec = palette[Math.floor(Math.random() * palette.length)];
      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : height + 20,
        size: spec.kind === 'emoji' ? 11 + Math.random() * 6 : 3 + Math.random() * 9,
        vx: (Math.random() - 0.5) * 0.32,
        vy: spec.kind === 'emoji' ? 0.25 + Math.random() * 0.35 : -(0.18 + Math.random() * 0.32),
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.01 + Math.random() * 0.015,
        alpha: 0.35 + Math.random() * 0.45,
        spec
      };
    };

    const particles = Array.from({ length: MAX_PARTICLES }, () => spawnParticle(true));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const speedBoost = configRef.current.mood === 'spinning' ? 2.1 : 1;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.wobble += p.wobbleSpeed * speedBoost;
        p.x += (p.vx + Math.sin(p.wobble) * 0.25) * speedBoost;
        p.y += p.vy * speedBoost;

        if (p.spec.kind === 'emoji') {
          ctx.save();
          ctx.globalAlpha = p.alpha * 0.65;
          ctx.font = `${p.size}px Prompt, sans-serif`;
          ctx.fillText(p.spec.char, p.x, p.y);
          ctx.restore();
          if (p.y > height + 30) {
            particles[i] = spawnParticle(false);
            particles[i].y = -20;
          }
        } else {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.spec.color;
          ctx.fill();
          ctx.restore();
          if (p.y < -30) {
            particles[i] = spawnParticle(false);
          }
        }

        if (p.x < -40) p.x = width + 30;
        if (p.x > width + 40) p.x = -30;
      }

      animId = window.requestAnimationFrame(draw);
    };

    animId = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="cafe-particles-canvas" aria-hidden="true" />;
}