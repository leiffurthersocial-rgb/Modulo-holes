"use client";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ToneMapping, SMAA } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, type ReactNode } from "react";
import * as THREE from "three";
import { useEffectiveQuality, useSettings } from "@/engine/save/settings";
import { ParticleSystem } from "@/engine/juice/ParticleSystem";

export const QUALITY_PRESETS = {
  low: { dpr: [0.75, 1] as [number, number], shadows: false, post: false, shadowMapSize: 512 },
  medium: { dpr: [1, 1.5] as [number, number], shadows: true, post: true, shadowMapSize: 1024 },
  high: { dpr: [1, 2] as [number, number], shadows: true, post: true, shadowMapSize: 2048 },
};

interface Props {
  children: ReactNode;
  bloom?: { intensity?: number; threshold?: number };
  vignette?: number;
  background?: string;
  onPointerMissed?: () => void;
}

/**
 * Shared canvas: adaptive quality (auto mode reacts to measured FPS), soft shadows,
 * bloom + vignette post-processing, and the global particle system.
 */
export function GameCanvas({ children, bloom, vignette = 0.35, background }: Props) {
  const quality = useEffectiveQuality();
  const auto = useSettings((s) => s.quality === "auto");
  const setAutoQuality = useSettings((s) => s.setAutoQuality);
  const preset = QUALITY_PRESETS[quality];

  return (
    <Canvas
      shadows={preset.shadows ? "soft" : false}
      dpr={preset.dpr}
      gl={{ antialias: !preset.post, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 50, near: 0.05, far: 400, position: [0, 8, 10] }}
      onCreated={({ gl }) => {
        gl.toneMapping = preset.post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
      }}
      style={{ touchAction: "none" }}
    >
      {background && <color attach="background" args={[background]} />}
      {auto && (
        <PerformanceMonitor
          bounds={() => [44, 58]}
          flipflops={3}
          onDecline={() => setAutoQuality(quality === "high" ? "medium" : "low")}
          onIncline={() => setAutoQuality(quality === "low" ? "medium" : "high")}
        />
      )}
      <Suspense fallback={null}>{children}</Suspense>
      <ParticleSystem />
      {preset.post && (
        <EffectComposer multisampling={quality === "high" ? 4 : 0} enableNormalPass={false}>
          <Bloom mipmapBlur intensity={bloom?.intensity ?? 0.7} luminanceThreshold={bloom?.threshold ?? 0.9} luminanceSmoothing={0.2} />
          <Vignette offset={0.25} darkness={vignette} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          {quality === "medium" ? <SMAA /> : <></>}
        </EffectComposer>
      )}
    </Canvas>
  );
}
