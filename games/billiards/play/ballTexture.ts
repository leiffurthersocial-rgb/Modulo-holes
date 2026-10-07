"use client";
import * as THREE from "three";
import { ballColor, isStripe } from "../sim/racks";

const cache = new Map<number, THREE.Texture>();

/** Equirectangular numbered-ball texture: solid or stripe band, number on two white spots. */
export function ballTexture(id: number) {
  const hit = cache.get(id);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  const col = ballColor(id);
  if (id === 0) {
    g.fillStyle = "#f8f6ee";
    g.fillRect(0, 0, 512, 256);
    // Small red dot (training cue ball) so spin is visible.
    for (const x of [128, 384]) {
      g.fillStyle = "#e0262f";
      g.beginPath();
      g.arc(x, 128, 10, 0, Math.PI * 2);
      g.fill();
    }
  } else if (isStripe(id)) {
    g.fillStyle = "#f8f6ee";
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = col;
    g.fillRect(0, 70, 512, 116);
  } else {
    g.fillStyle = col;
    g.fillRect(0, 0, 512, 256);
  }
  if (id !== 0) {
    for (const x of [128, 384]) {
      g.fillStyle = "#fbfaf4";
      g.beginPath();
      g.ellipse(x, 128, 34, 40, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#111";
      g.font = "bold 44px Nunito Variable, Arial, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(id), x, 131);
      if (id === 6 || id === 9) g.fillRect(x - 12, 152, 24, 3);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(id, t);
  return t;
}
