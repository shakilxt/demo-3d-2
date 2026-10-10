// Procedural canvas textures: panel seams + service markings for the ceramic
// armour, woven carbon fibre, brushed titanium and corrugated cable sleeves.
// Everything is seeded so every render (and every video frame) is identical.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { srgb = false, repeat = [1, 1], aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Armour surface: returns { map, bump, rough } sharing one layout so seams line
 * up across colour, relief and roughness.
 */
export function armourTextures(seed = 1, { density = 1 } = {}) {
  const W = 2048;
  const H = 1024;
  const rand = rng(seed);
  const [cc, c] = canvas(W, H); // colour
  const [bc, b] = canvas(W, H); // bump (white = high)
  const [rc, r] = canvas(W, H); // roughness

  // Base ceramic: warm white with very low-frequency mottling.
  c.fillStyle = '#f1f0ec';
  c.fillRect(0, 0, W, H);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, W, H);
  r.fillStyle = '#6c6c6c';
  r.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const rad = 40 + rand() * 160;
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.015 + rand() * 0.025;
    g.addColorStop(0, `rgba(170,168,160,${a})`);
    g.addColorStop(1, 'rgba(170,168,160,0)');
    c.fillStyle = g;
    c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    const gr = r.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${rand() > 0.5 ? 255 : 0},${rand() > 0.5 ? 255 : 0},128,0.05)`);
    gr.addColorStop(1, 'rgba(128,128,128,0)');
    r.fillStyle = gr;
    r.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  const seam = (pts, width = 3) => {
    for (const [ctx, col, w] of [
      [c, 'rgba(40,40,42,0.85)', width],
      [b, '#1e1e1e', width + 2],
      [r, '#c8c8c8', width + 2],
    ]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.stroke();
    }
    // Light catch on the upper lip of each seam.
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1] - width);
    for (const p of pts.slice(1)) c.lineTo(p[0], p[1] - width);
    c.stroke();
  };

  // Long panel seams with chamfered, industrial-design style dog-legs.
  const nSeams = Math.round(14 * density);
  for (let i = 0; i < nSeams; i++) {
    const horizontal = rand() > 0.45;
    const pts = [];
    if (horizontal) {
      let x = rand() * W;
      let y = 80 + rand() * (H - 160);
      pts.push([x, y]);
      const len = 300 + rand() * 900;
      const step = 40 + rand() * 60;
      const jx = x + len * (0.3 + rand() * 0.4);
      pts.push([jx, y]);
      y += (rand() > 0.5 ? 1 : -1) * step;
      pts.push([jx + step, y]);
      pts.push([x + len, y]);
    } else {
      let x = 60 + rand() * (W - 120);
      let y = rand() * H * 0.4;
      pts.push([x, y]);
      const len = 200 + rand() * 500;
      const jy = y + len * (0.3 + rand() * 0.4);
      const step = 30 + rand() * 50;
      pts.push([x, jy]);
      x += (rand() > 0.5 ? 1 : -1) * step;
      pts.push([x, jy + step]);
      pts.push([x, y + len]);
    }
    seam(pts, 2.5 + rand() * 1.5);
  }

  // Service markings: barcode-like ticks, small blocks, fastener dots.
  const nMarks = Math.round(70 * density);
  for (let i = 0; i < nMarks; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const kind = rand();
    c.fillStyle = 'rgba(28,28,30,0.9)';
    if (kind < 0.35) {
      // tick cluster
      const n = 3 + Math.floor(rand() * 7);
      for (let k = 0; k < n; k++) {
        const w = rand() > 0.6 ? 4 : 2;
        c.fillRect(x + k * 6, y, w, 10 + rand() * 6);
      }
    } else if (kind < 0.55) {
      // hairline label blocks
      const n = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < n; k++) {
        c.fillRect(x, y + k * 7, 28 + rand() * 70, 3);
      }
    } else if (kind < 0.75) {
      // recessed fastener
      const rad = 4 + rand() * 4;
      c.beginPath();
      c.arc(x, y, rad, 0, Math.PI * 2);
      c.fill();
      b.fillStyle = '#202020';
      b.beginPath();
      b.arc(x, y, rad + 1, 0, Math.PI * 2);
      b.fill();
    } else if (kind < 0.9) {
      // outlined square
      c.strokeStyle = 'rgba(28,28,30,0.85)';
      c.lineWidth = 2;
      const s = 10 + rand() * 14;
      c.strokeRect(x, y, s, s);
    } else {
      // tiny red safety mark (restrained accent)
      c.fillStyle = 'rgba(196,30,30,0.9)';
      c.fillRect(x, y, 10 + rand() * 18, 3);
    }
  }

  return {
    map: tex(cc, { srgb: true }),
    bump: tex(bc),
    rough: tex(rc),
  };
}

/** 2x2 twill carbon weave, tiled. */
export function carbonTextures(repeat = [6, 6]) {
  const S = 256;
  const [cc, c] = canvas(S, S);
  const [bc, b] = canvas(S, S);
  const cell = S / 8;
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const over = (i + j) % 4 < 2;
      const x = i * cell;
      const y = j * cell;
      const g = over
        ? c.createLinearGradient(x, y, x + cell, y)
        : c.createLinearGradient(x, y, x, y + cell);
      g.addColorStop(0, '#0b0b0c');
      g.addColorStop(0.5, over ? '#26272a' : '#1b1c1f');
      g.addColorStop(1, '#0b0b0c');
      c.fillStyle = g;
      c.fillRect(x, y, cell, cell);
      const gb = over
        ? b.createLinearGradient(x, y, x + cell, y)
        : b.createLinearGradient(x, y, x, y + cell);
      gb.addColorStop(0, '#404040');
      gb.addColorStop(0.5, '#c0c0c0');
      gb.addColorStop(1, '#404040');
      b.fillStyle = gb;
      b.fillRect(x, y, cell, cell);
    }
  }
  return { map: tex(cc, { srgb: true, repeat }), bump: tex(bc, { repeat }) };
}

/** Fine directional streaks for brushed titanium roughness. */
export function brushedTexture(seed = 7) {
  const rand = rng(seed);
  const [cc, c] = canvas(512, 512);
  c.fillStyle = '#5a5a5a';
  c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const y = rand() * 512;
    const v = Math.floor(60 + rand() * 90);
    c.strokeStyle = `rgba(${v},${v},${v},0.35)`;
    c.lineWidth = 0.5 + rand();
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(512, y + (rand() - 0.5) * 2);
    c.stroke();
  }
  return tex(cc);
}

/** Ribbed stripes along a tube's length (u) for corrugated cable sleeves. */
export function ribTexture(ribs = 120) {
  const [cc, c] = canvas(1024, 4);
  for (let x = 0; x < 1024; x++) {
    const v = 128 + 110 * Math.sin((x / 1024) * ribs * Math.PI * 2);
    c.fillStyle = `rgb(${v},${v},${v})`;
    c.fillRect(x, 0, 1, 4);
  }
  return tex(cc);
}

/** Robotic iris: concentric aperture blades with a restrained red ring. */
export function irisTexture() {
  const S = 512;
  const [cc, c] = canvas(S, S);
  const cx = S / 2;
  c.fillStyle = '#050506';
  c.fillRect(0, 0, S, S);
  const g = c.createRadialGradient(cx, cx, 30, cx, cx, 250);
  g.addColorStop(0, '#000');
  g.addColorStop(0.32, '#0a0a0c');
  g.addColorStop(0.36, '#5a0b0b');
  g.addColorStop(0.42, '#c41a14');
  g.addColorStop(0.47, '#3a0606');
  g.addColorStop(0.62, '#141417');
  g.addColorStop(0.9, '#2a2b30');
  g.addColorStop(1, '#0d0d0f');
  c.fillStyle = g;
  c.fillRect(0, 0, S, S);
  // aperture blades
  c.strokeStyle = 'rgba(160,160,170,0.25)';
  c.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * 60, cx + Math.sin(a) * 60);
    c.quadraticCurveTo(
      cx + Math.cos(a + 0.5) * 140,
      cx + Math.sin(a + 0.5) * 140,
      cx + Math.cos(a + 0.9) * 230,
      cx + Math.sin(a + 0.9) * 230,
    );
    c.stroke();
  }
  // emissive companion (only the red ring glows)
  const [ec, e] = canvas(S, S);
  e.fillStyle = '#000';
  e.fillRect(0, 0, S, S);
  const ge = e.createRadialGradient(cx, cx, 70, cx, cx, 130);
  ge.addColorStop(0, 'rgba(0,0,0,1)');
  ge.addColorStop(0.45, 'rgba(255,40,30,1)');
  ge.addColorStop(0.75, 'rgba(120,10,8,1)');
  ge.addColorStop(1, 'rgba(0,0,0,1)');
  e.fillStyle = ge;
  e.fillRect(0, 0, S, S);
  return { map: tex(cc, { srgb: true }), emissive: tex(ec, { srgb: true }) };
}
