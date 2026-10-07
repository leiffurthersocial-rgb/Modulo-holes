/**
 * Unified pointer gestures for mouse + touch: single-pointer drags, two-finger pinch,
 * wheel zoom. Games attach this to their canvas container and interpret drags themselves
 * (e.g. golf: drag from ball = aim, elsewhere = orbit).
 */
export interface DragInfo {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  button: number;
  pointerType: string;
}

export interface GestureHandlers {
  onDragStart?: (d: DragInfo) => void;
  onDragMove?: (d: DragInfo) => void;
  onDragEnd?: (d: DragInfo, cancelled: boolean) => void;
  onPinch?: (scale: number) => void;
  onWheel?: (deltaY: number) => void;
  onHover?: (x: number, y: number) => void;
}

export function attachGestures(el: HTMLElement, h: GestureHandlers) {
  const pts = new Map<number, { x: number; y: number }>();
  let drag: DragInfo | null = null;
  let pinchDist = 0;

  const rel = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: PointerEvent) => {
    const p = rel(e);
    pts.set(e.pointerId, p);
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (pts.size === 1) {
      drag = { id: e.pointerId, x: p.x, y: p.y, startX: p.x, startY: p.y, dx: 0, dy: 0, button: e.button, pointerType: e.pointerType };
      h.onDragStart?.(drag);
    } else if (pts.size === 2) {
      // Second finger: cancel drag and begin pinch.
      if (drag) h.onDragEnd?.(drag, true);
      drag = null;
      const [a, b] = [...pts.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  const move = (e: PointerEvent) => {
    const p = rel(e);
    if (!pts.has(e.pointerId)) {
      h.onHover?.(p.x, p.y);
      return;
    }
    const prev = pts.get(e.pointerId)!;
    pts.set(e.pointerId, p);
    if (drag && drag.id === e.pointerId) {
      drag.dx = p.x - prev.x;
      drag.dy = p.y - prev.y;
      drag.x = p.x;
      drag.y = p.y;
      h.onDragMove?.(drag);
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0) h.onPinch?.(d / pinchDist);
      pinchDist = d;
    }
  };

  const up = (e: PointerEvent) => {
    pts.delete(e.pointerId);
    if (drag && drag.id === e.pointerId) {
      h.onDragEnd?.(drag, e.type === "pointercancel");
      drag = null;
    }
    if (pts.size < 2) pinchDist = 0;
  };

  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    h.onWheel?.(e.deltaY);
  };
  const ctx = (e: Event) => e.preventDefault();

  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("wheel", wheel, { passive: false });
  el.addEventListener("contextmenu", ctx);
  return () => {
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
    el.removeEventListener("wheel", wheel);
    el.removeEventListener("contextmenu", ctx);
  };
}
