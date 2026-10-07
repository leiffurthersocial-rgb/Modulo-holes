import type { BallSkin } from "../skins";

/** CSS approximation of a ball skin for menus. */
export function ballTextureCss(s: BallSkin) {
  const shade = "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.85), rgba(255,255,255,0) 38%), radial-gradient(circle at 70% 75%, rgba(0,0,0,0.25), rgba(0,0,0,0) 60%)";
  switch (s.pattern) {
    case "stripe":
      return `${shade}, linear-gradient(180deg, ${s.color} 40%, ${s.stripe} 40%, ${s.stripe} 58%, ${s.color} 58%)`;
    case "dots":
      return `${shade}, radial-gradient(${s.stripe} 18%, transparent 20%) 0 0/12px 12px, ${s.color}`;
    case "rainbow":
      return `${shade}, linear-gradient(180deg, #ff5d73, #ff9f43, #ffd166, #06d6a0, #4cc9f0, #7c4dff)`;
    case "galaxy":
      return `${shade}, radial-gradient(#fff 8%, transparent 10%) 0 0/9px 9px, linear-gradient(135deg, #1b1446, #4a1a8a, #0d2a6b)`;
    default:
      return `${shade}, ${s.color}`;
  }
}
