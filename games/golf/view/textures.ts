"use client";
/** Procedural canvas textures (no image assets). Cached per key. */
import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();

function canvasTex(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat = true) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

function speckle(g: CanvasRenderingContext2D, s: number, color: string, n: number, r: number, alpha: number) {
  g.fillStyle = color;
  g.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    g.beginPath();
    g.arc(Math.random() * s, Math.random() * s, Math.random() * r + 0.5, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

/** Mowed-grass stripes: two stripes per texture → 1 world unit each with uv = xz/2. */
export function stripeTexture(a: string, b: string, speck = true) {
  return canvasTex(`stripe:${a}:${b}:${speck}`, 256, (g, s) => {
    g.fillStyle = a;
    g.fillRect(0, 0, s, s);
    g.fillStyle = b;
    g.fillRect(0, 0, s, s / 2);
    if (speck) {
      speckle(g, s, "#ffffff", 220, 1.2, 0.06);
      speckle(g, s, "#000000", 220, 1.2, 0.05);
    }
  });
}

/** Neon grid floor: dark base with glowing lines (used as emissive map too). */
export function gridTexture(base: string, line: string) {
  return canvasTex(`grid:${base}:${line}`, 256, (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = line;
    g.lineWidth = 3;
    g.globalAlpha = 0.85;
    g.strokeRect(1.5, 1.5, s - 3, s - 3);
    g.lineWidth = 1;
    g.globalAlpha = 0.35;
    g.beginPath();
    g.moveTo(s / 2, 0);
    g.lineTo(s / 2, s);
    g.moveTo(0, s / 2);
    g.lineTo(s, s / 2);
    g.stroke();
    g.globalAlpha = 1;
  });
}

/** Frosting with sprinkles. */
export function sprinkleTexture(base: string, alt: string) {
  return canvasTex(`sprinkle:${base}:${alt}`, 256, (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    g.fillStyle = alt;
    g.fillRect(0, 0, s, s / 2);
    const cols = ["#ff4f7d", "#7c4dff", "#36c5f0", "#ffd166", "#ffffff", "#06d6a0"];
    for (let i = 0; i < 70; i++) {
      g.save();
      g.translate(Math.random() * s, Math.random() * s);
      g.rotate(Math.random() * Math.PI);
      g.fillStyle = cols[i % cols.length];
      g.fillRect(-5, -1.5, 10, 3);
      g.restore();
    }
  });
}

export function sandTexture(color: string) {
  return canvasTex(`sand:${color}`, 128, (g, s) => {
    g.fillStyle = color;
    g.fillRect(0, 0, s, s);
    speckle(g, s, "#000000", 400, 0.8, 0.08);
    speckle(g, s, "#ffffff", 300, 0.8, 0.15);
  });
}

/** Chevron arrows for boost pads (scrolled along v). */
export function chevronTexture(color: string) {
  return canvasTex(`chev:${color}`, 128, (g, s) => {
    g.fillStyle = "#000000";
    g.fillRect(0, 0, s, s);
    g.strokeStyle = color;
    g.lineWidth = 14;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(s * 0.2, s * 0.75);
    g.lineTo(s * 0.5, s * 0.35);
    g.lineTo(s * 0.8, s * 0.75);
    g.stroke();
  });
}

/** Conveyor belt ribs. */
export function beltTexture() {
  return canvasTex(`belt`, 64, (g, s) => {
    g.fillStyle = "#2b2d36";
    g.fillRect(0, 0, s, s);
    g.fillStyle = "#4a4e5c";
    g.fillRect(0, 0, s, s * 0.3);
    g.fillStyle = "#ffd166";
    g.fillRect(0, s * 0.3, s * 0.08, s * 0.7);
    g.fillRect(s * 0.92, s * 0.3, s * 0.08, s * 0.7);
  });
}

/** Ball texture for skins. */
export function ballTexture(pattern: string, color: string, stripe = "#ff5d73") {
  return canvasTex(`ball:${pattern}:${color}:${stripe}`, 256, (g, s) => {
    g.fillStyle = color;
    g.fillRect(0, 0, s, s);
    if (pattern === "stripe") {
      g.fillStyle = stripe;
      g.fillRect(0, s * 0.42, s, s * 0.16);
    } else if (pattern === "dots") {
      g.fillStyle = stripe;
      for (let i = 0; i < 26; i++) {
        g.beginPath();
        g.arc(Math.random() * s, s * 0.15 + Math.random() * s * 0.7, 7 + Math.random() * 5, 0, Math.PI * 2);
        g.fill();
      }
    } else if (pattern === "rainbow") {
      const cols = ["#ff5d73", "#ff9f43", "#ffd166", "#06d6a0", "#4cc9f0", "#7c4dff"];
      cols.forEach((c, i) => {
        g.fillStyle = c;
        g.fillRect(0, (i * s) / cols.length, s, s / cols.length + 1);
      });
    } else if (pattern === "galaxy") {
      const grd = g.createLinearGradient(0, 0, s, s);
      grd.addColorStop(0, "#1b1446");
      grd.addColorStop(0.5, "#4a1a8a");
      grd.addColorStop(1, "#0d2a6b");
      g.fillStyle = grd;
      g.fillRect(0, 0, s, s);
      speckle(g, s, "#ffffff", 120, 1.4, 0.9);
    }
    // Dimples hint.
    speckle(g, s, "#000000", 260, 1.6, 0.04);
  });
}

export function candyStripeTexture() {
  return canvasTex(`candystripe`, 128, (g, s) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, s, s);
    g.fillStyle = "#ff3b6b";
    for (let i = -s; i < s * 2; i += 32) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 16, 0);
      g.lineTo(i + 16 + s, s);
      g.lineTo(i + s, s);
      g.fill();
    }
  });
}
