"use client";
import { Fragment, type ReactNode } from "react";

/**
 * Remount a 3D subtree whenever `id` changes (new hole, restart, re-rack).
 *
 * Use this instead of putting `key` directly on a scene component that has siblings: in
 * react-three-fiber 9 a keyed replacement that gets inserted *between siblings* can leave the
 * old subtree attached to the scene (we saw two golf courses rendered on top of each other).
 * Giving the keyed node a stable parent group of its own makes the swap a plain
 * remove-then-append, which tears down correctly.
 */
export function Remount({ id, children, name }: { id: string | number; children: ReactNode; name?: string }) {
  return (
    <group name={name}>
      <Fragment key={id}>{children}</Fragment>
    </group>
  );
}
