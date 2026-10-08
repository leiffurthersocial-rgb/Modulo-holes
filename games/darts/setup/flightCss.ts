import type { FlightDesign } from "../themes";

/** CSS preview of a flight design (menus). */
export function flightCss(f: FlightDesign, color = "#ff5d5d") {
  switch (f.pattern) {
    case "flame":
      return "linear-gradient(0deg, #ffd166, #ff6b2d 55%, #b0121b)";
    case "galaxy":
      return "radial-gradient(#fff 6%, transparent 8%) 0 0/8px 8px, #170f3d";
    case "chequer":
      return `repeating-conic-gradient(#111 0 25%, ${color} 0 50%) 0 0/12px 12px`;
    case "gold":
      return "linear-gradient(135deg, #fff3b0, #ffc83d 50%, #a86f00)";
    default:
      return `linear-gradient(180deg, ${color} 42%, #fff 42%, #fff 58%, ${color} 58%)`;
  }
}
