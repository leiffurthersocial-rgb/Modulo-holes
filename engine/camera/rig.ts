/**
 * Camera rig state shared between game logic (which sets `desired`) and <CameraRig/> (which
 * smooths `current` toward it and applies shake/punch). Spherical coordinates around a target:
 * the camera looks horizontally along `yaw` and sits `distance` away at elevation `pitch`.
 */
import * as THREE from "three";

export interface RigPose {
  target: THREE.Vector3;
  yaw: number;
  pitch: number;
  distance: number;
  fov: number;
}

export class CameraRigState {
  desired: RigPose;
  current: RigPose;
  /** Per-property smoothing rates (1/s). Higher = snappier. */
  rates = { target: 6, yaw: 4, pitch: 4, distance: 4, fov: 5 };

  constructor(init: Partial<RigPose> = {}) {
    const base: RigPose = {
      target: new THREE.Vector3(),
      yaw: 0,
      pitch: 0.6,
      distance: 8,
      fov: 50,
      ...init,
    };
    this.desired = { ...base, target: base.target.clone() };
    this.current = { ...base, target: base.target.clone() };
  }

  snap() {
    this.current.target.copy(this.desired.target);
    this.current.yaw = this.desired.yaw;
    this.current.pitch = this.desired.pitch;
    this.current.distance = this.desired.distance;
    this.current.fov = this.desired.fov;
  }

  update(dt: number) {
    const k = (r: number) => 1 - Math.exp(-r * dt);
    const c = this.current;
    const d = this.desired;
    c.target.lerp(d.target, k(this.rates.target));
    c.yaw += shortestAngle(c.yaw, d.yaw) * k(this.rates.yaw);
    c.pitch += (d.pitch - c.pitch) * k(this.rates.pitch);
    c.distance += (d.distance - c.distance) * k(this.rates.distance);
    c.fov += (d.fov - c.fov) * k(this.rates.fov);
  }

  /** World position of the camera for a pose. */
  static positionFor(p: RigPose, out = new THREE.Vector3()) {
    const h = Math.cos(p.pitch) * p.distance;
    return out.set(p.target.x - Math.sin(p.yaw) * h, p.target.y + Math.sin(p.pitch) * p.distance, p.target.z - Math.cos(p.yaw) * h);
  }
}

export function shortestAngle(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
