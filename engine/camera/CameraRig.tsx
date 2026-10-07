"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { CameraRigState } from "./rig";
import { shakeOffset, updateShake } from "@/engine/juice/shake";

/** Drives the default camera from a CameraRigState, adding trauma shake and punch. */
export function CameraRig({ rig }: { rig: CameraRigState }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3() }), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    updateShake(dt);
    rig.update(dt);
    const s = shakeOffset();
    const pose = rig.current;
    // Punch dollies the camera in toward the target and narrows the FOV briefly.
    const punched = { ...pose, distance: pose.distance * (1 - 0.12 * s.punch) };
    CameraRigState.positionFor(punched, tmp.pos);
    tmp.pos.x += s.x;
    tmp.pos.y += s.y;
    tmp.pos.z += s.z;
    camera.position.copy(tmp.pos);
    tmp.look.copy(pose.target);
    tmp.look.x += s.x * 0.4;
    tmp.look.z += s.z * 0.4;
    camera.lookAt(tmp.look);
    camera.rotateZ(s.roll);
    const fov = pose.fov - 6 * s.punch;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
