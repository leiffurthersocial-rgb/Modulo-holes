"use client";
import type { PlayProps } from "@/games/types";

export default function BilliardsPlay({ onExit }: PlayProps) {
  return (
    <div className="grid h-full place-items-center text-white">
      <button onClick={onExit}>Billiards coming up — back</button>
    </div>
  );
}
