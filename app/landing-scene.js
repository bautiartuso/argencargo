"use client";
// Escena 3D del hero de la landing (Three.js vía React Three Fiber).
// Cielo: fotografía HDRI real (Poly Haven, CC0). Avión: fotografía real de un Boeing 747F
// recortada (Pexels). Nubes volumétricas y cámara que vuela con el scroll (progressRef 0→1).
// Cargado solo en cliente (dynamic import con ssr:false desde page.js).
import { Suspense, useRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Clouds, Cloud, useTexture, useProgress } from "@react-three/drei";

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

/* El 747 real: billboard con la foto recortada. Viene de lejos y pasa cerca de la cámara. */
function Plane({ progressRef, mobile }) {
  const tex = useTexture(mobile ? "/landing/plane_cut_m.png" : "/landing/plane_cut.png");
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const ref = useRef();
  const aspect = tex.image && tex.image.width ? tex.image.width / tex.image.height : 1.9;
  const w = mobile ? 7.5 : 9.5;
  const h = w / aspect;
  useFrame((state) => {
    if (!ref.current) return;
    const p = Math.min(1, Math.max(0, progressRef.current || 0));
    const t = state.clock.elapsedTime;
    const e = easeInOut(p);
    const z = THREE.MathUtils.lerp(-38, 6, e);
    const x = THREE.MathUtils.lerp(mobile ? 0.8 : 3.2, mobile ? -2.6 : -4.4, e) + Math.sin(t * 0.55) * 0.12;
    const y = THREE.MathUtils.lerp(mobile ? 3.2 : 2.4, -1.0, e) + Math.sin(t * 0.85) * 0.09;
    ref.current.position.set(x, y, z);
    ref.current.rotation.z = -0.05 + Math.sin(t * 0.5) * 0.025 + p * 0.06;
    ref.current.rotation.y = 0.18 - p * 0.3;
  });
  return (
    <mesh ref={ref} renderOrder={10}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} alphaTest={0.02} />
    </mesh>
  );
}

/* Nubes volumétricas que la cámara atraviesa al scrollear. */
const CLOUD_SET = [
  { p: [-9, -3, -8], b: [16, 3, 6], v: 10, o: 0.85, c: "#ffffff" },
  { p: [11, -2.5, -22], b: [18, 4, 7], v: 12, o: 0.8, c: "#f4f8ff" },
  { p: [-12, 2, -40], b: [22, 4, 8], v: 14, o: 0.7, c: "#ffffff" },
  { p: [14, -1, -60], b: [24, 5, 9], v: 14, o: 0.65, c: "#eef4ff" },
];

function Sky({ progressRef, mobile }) {
  const group = useRef();
  useFrame(() => {
    if (!group.current) return;
    const p = Math.min(1, Math.max(0, progressRef.current || 0));
    // la cámara "avanza": las nubes vienen hacia nosotros
    group.current.position.z = easeInOut(p) * 44;
  });
  const clouds = mobile ? CLOUD_SET.slice(0, 3) : CLOUD_SET;
  return (
    <group ref={group}>
      <Clouds material={THREE.MeshBasicMaterial} limit={mobile ? 60 : 110} range={mobile ? 60 : 110}>
        {clouds.map((c, i) => (
          <Cloud
            key={i}
            seed={i + 3}
            segments={mobile ? 10 : 16}
            bounds={c.b}
            volume={c.v}
            color={c.c}
            opacity={c.o}
            speed={0.12}
            growth={5}
            fade={mobile ? 40 : 70}
            position={c.p}
          />
        ))}
      </Clouds>
    </group>
  );
}

/* Parallax suave con el mouse (desktop) y un leve dolly con el scroll. */
function CameraRig({ progressRef, mobile }) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 0, -30), []);
  useFrame((state, dt) => {
    const p = Math.min(1, Math.max(0, progressRef.current || 0));
    const px = mobile ? 0 : state.pointer.x;
    const py = mobile ? 0 : state.pointer.y;
    const k = 1 - Math.pow(0.001, dt);
    camera.position.x += (px * 0.7 - camera.position.x) * k;
    camera.position.y += (py * 0.35 + 0.2 - camera.position.y) * k;
    camera.position.z += (10 - p * 1.5 - camera.position.z) * k;
    camera.lookAt(target);
  });
  return null;
}

/* Montado dentro del Suspense: cuando corre su efecto, HDRI + textura ya están listos. */
function Ready() {
  useEffect(() => {
    const id = requestAnimationFrame(() => { try { window.dispatchEvent(new Event("acg-scene-ready")); } catch (e) {} });
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}

function Effects() { return null; }

export default function HeroScene({ progressRef, mobile }) {
  return (
    <Canvas
      dpr={[1, mobile ? 1.15 : 1.35]}
      camera={{ fov: mobile ? 62 : 52, position: [0, 0.2, 10], near: 0.1, far: 400 }}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false, depth: true }}
      style={{ position: "absolute", inset: 0 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.9;
      }}
    >
      <color attach="background" args={["#8fb6e6"]} />
      <Suspense fallback={null}>
        <Environment files={mobile ? "/landing/sky_1k.hdr" : "/landing/sky_2k.hdr"} background backgroundBlurriness={0} backgroundRotation={[0, Math.PI * 1.15, 0]} environmentIntensity={1} />
        <CameraRig progressRef={progressRef} mobile={mobile} />
        <Sky progressRef={progressRef} mobile={mobile} />
        <Plane progressRef={progressRef} mobile={mobile} />
        <Effects mobile={mobile} />
        <Ready />
      </Suspense>
    </Canvas>
  );
}

/* Pantalla de carga estilo Solais: porcentaje real de los assets (HDRI + avión). */
export function SceneLoader({ logo }) {
  const { progress } = useProgress();
  // Se va cuando la escena avisa que renderizó (evento acg-scene-ready). Red de seguridad a 14s
  // para que la pantalla de carga nunca quede pegada si algo falla.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const on = () => setReady(true);
    window.addEventListener("acg-scene-ready", on);
    const t = setTimeout(on, 14000);
    return () => { window.removeEventListener("acg-scene-ready", on); clearTimeout(t); };
  }, []);
  const done = ready;
  return (
    <div
      aria-hidden={done}
      style={{
        position: "fixed", inset: 0, zIndex: 400, background: "#070d1a",
        display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 22,
        opacity: done ? 0 : 1, pointerEvents: done ? "none" : "auto", transition: "opacity .7s ease .25s",
      }}
    >
      <img src={logo} alt="Argencargo" style={{ height: 46, opacity: 0.9 }} />
      <div style={{ width: 220, height: 2, background: "rgba(255,255,255,.1)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.round(progress)}%`, background: "#3B7DD8", transition: "width .25s ease" }} />
      </div>
      <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, letterSpacing: "0.22em", color: "rgba(255,255,255,.55)" }}>
        CARGANDO {String(Math.round(progress)).padStart(2, "0")}%
      </div>
    </div>
  );
}
