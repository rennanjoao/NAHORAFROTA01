import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import type { MotionValue } from "framer-motion";

/* Cena: uma cidade em miniatura vista de cima, com o patio da transportadora,
   rotas de entrega luminosas e veiculos em movimento. Carregada sob demanda,
   so em telas largas com WebGL. Tudo decorativo (aria-hidden no canvas). */

const GREEN = "#04E8A4";
const ALERT = "#FFC53D";
const LATE = "#FF4D4F";

type V3 = [number, number, number];
const DEPOT: V3 = [-6, 0, 4];

/* Rotas seguem as ruas (grade de 2 em 2) e so cortam esquinas de leve. */
const ROUTES: { pts: V3[]; color: string; speed: number; offset: number }[] = [
  { pts: [DEPOT, [-6, 0, 0], [-2, 0, 0], [-2, 0, -2], [2, 0, -2], [2, 0, -4], [6, 0, -4]], color: GREEN, speed: 0.04, offset: 0.12 },
  { pts: [DEPOT, [-2, 0, 4], [-2, 0, 2], [4, 0, 2], [4, 0, 0], [8, 0, 0]], color: GREEN, speed: 0.035, offset: 0.6 },
  { pts: [DEPOT, [-6, 0, 6], [0, 0, 6], [0, 0, 4], [6, 0, 4], [6, 0, 6]], color: ALERT, speed: 0.028, offset: 0.33 },
  { pts: [DEPOT, [-8, 0, 4], [-8, 0, -2], [-4, 0, -2], [-4, 0, -6], [0, 0, -6]], color: LATE, speed: 0.03, offset: 0.8 },
  { pts: [DEPOT, [-4, 0, 4], [-4, 0, 2], [0, 0, 2], [0, 0, 0], [8, 0, 0], [8, 0, -6]], color: GREEN, speed: 0.045, offset: 0.0 },
];

function useCurves() {
  return useMemo(
    () =>
      ROUTES.map((r) => ({
        ...r,
        curve: new THREE.CatmullRomCurve3(r.pts.map((p) => new THREE.Vector3(p[0], 0.02, p[2])), false, "catmullrom", 0.12),
      })),
    [],
  );
}

/* Gerador deterministico (a cidade e sempre a mesma). */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function City({ dark }: { dark: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const blocks = useMemo(() => {
    const rand = rng(7);
    const out: { x: number; z: number; w: number; d: number; h: number }[] = [];
    for (let cx = -9; cx < 9; cx += 2) {
      for (let cz = -9; cz < 9; cz += 2) {
        // quarteirao entre ruas: cada celula tem 1 a 3 predios, sem invadir a rua
        const n = 1 + Math.floor(rand() * 3);
        const dist = Math.hypot(cx + 1, cz + 1);
        for (let k = 0; k < n; k++) {
          const w = 0.35 + rand() * 0.6;
          const d = 0.35 + rand() * 0.6;
          const x = cx + 0.4 + rand() * (1.2 - w) + w / 2;
          const z = cz + 0.4 + rand() * (1.2 - d) + d / 2;
          // perto do patio e do centro, mais baixo; longe, alguns mais altos
          const h = 0.08 + rand() * (dist < 3 ? 0.25 : 0.55) + (rand() > 0.85 ? 0.5 : 0);
          out.push({ x, z, w, d, h });
        }
      }
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    blocks.forEach((b, i) => {
      o.position.set(b.x, b.h / 2, b.z);
      o.scale.set(b.w, b.h, b.d);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [blocks]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, blocks.length]} castShadow={false} receiveShadow={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={dark ? "#15181b" : "#d8dde2"} roughness={0.95} metalness={0.05} />
    </instancedMesh>
  );
}

function Streets({ dark }: { dark: boolean }) {
  const obj = useMemo(() => {
    const pts: number[] = [];
    for (let i = -10; i <= 10; i += 2) {
      pts.push(-10, 0.005, i, 10, 0.005, i);
      pts.push(i, 0.005, -10, i, 0.005, 10);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({ color: dark ? "#ffffff" : "#080808", transparent: true, opacity: dark ? 0.09 : 0.16 });
    return new THREE.LineSegments(geom, mat);
  }, [dark]);
  return <primitive object={obj} />;
}

function Ground({ dark }: { dark: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color={dark ? "#0b0d0e" : "#f1f3f5"} roughness={1} />
    </mesh>
  );
}

function RouteTube({ curve, color, glow }: { curve: THREE.CatmullRomCurve3; color: string; glow: number }) {
  const geom = useMemo(() => new THREE.TubeGeometry(curve, 220, 0.028, 8, false), [curve]);
  const c = useMemo(() => new THREE.Color(color).multiplyScalar(glow), [color, glow]);
  return (
    <mesh geometry={geom}>
      <meshBasicMaterial color={c} toneMapped={false} />
    </mesh>
  );
}

/* Veiculo: caixa escura com farois (dois pontos luminosos) e um pulso que corre a frente. */
function Vehicle({ curve, color, speed, offset, glow }: { curve: THREE.CatmullRomCurve3; color: string; speed: number; offset: number; glow: number }) {
  const g = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const p = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Vector3(), []);
  const hot = useMemo(() => new THREE.Color(color).multiplyScalar(glow), [color, glow]);
  useFrame(({ clock }) => {
    const t = (clock.getElapsedTime() * speed + offset) % 1;
    if (g.current) {
      curve.getPointAt(t, p);
      curve.getPointAt(Math.min(1, t + 0.012), q);
      g.current.position.set(p.x, 0.07, p.z);
      g.current.lookAt(q.x, 0.07, q.z);
    }
    if (pulse.current) {
      const tp = (clock.getElapsedTime() * speed * 2.6 + offset) % 1;
      curve.getPointAt(tp, p);
      pulse.current.position.set(p.x, 0.05, p.z);
    }
  });
  return (
    <>
      <group ref={g}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.24, 0.11, 0.13]} />
          <meshStandardMaterial color="#1c2023" roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh position={[0.13, 0, 0.045]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshBasicMaterial color={hot} toneMapped={false} />
        </mesh>
        <mesh position={[0.13, 0, -0.045]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshBasicMaterial color={hot} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[0.1, 0.03, 0.08]} />
          <meshBasicMaterial color={hot} toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={pulse}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshBasicMaterial color={hot} toneMapped={false} transparent opacity={0.9} />
      </mesh>
    </>
  );
}

function Pin({ position, color, phase = 0, beam = 0.9, glow }: { position: V3; color: string; phase?: number; beam?: number; glow: number }) {
  const ring = useRef<THREE.Mesh>(null);
  const hot = useMemo(() => new THREE.Color(color).multiplyScalar(glow), [color, glow]);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const t = (clock.getElapsedTime() * 0.55 + phase) % 1;
    ring.current.scale.setScalar(0.5 + t * 2.2);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t);
  });
  return (
    <group position={[position[0], 0, position[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[0.09, 24]} />
        <meshBasicMaterial color={hot} toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.16, 0.19, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      {/* feixe de luz vertical */}
      <mesh position={[0, beam / 2, 0]}>
        <cylinderGeometry args={[0.012, 0.05, beam, 12, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Rig({ scroll }: { scroll?: MotionValue<number> }) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(0.6, 0, -0.4), []);
  const base = useMemo(() => new THREE.Vector3(0.5, 8.6, 10.8), []);
  useFrame((state, dt) => {
    const t = state.clock.getElapsedTime();
    const s = scroll ? scroll.get() : 0; // 0 no topo → 1 quando a capa saiu
    const orbit = Math.sin(t * 0.07) * 0.22;
    const px = state.pointer.x;
    const py = state.pointer.y;
    const goalX = base.x + Math.sin(orbit) * 4 + px * 1.1;
    const goalZ = base.z - (1 - Math.cos(orbit)) * 4 + s * 2.5;
    const goalY = base.y - py * 0.6 + s * 4.5;
    const k = Math.min(1, dt * 1.6);
    camera.position.x += (goalX - camera.position.x) * k;
    camera.position.y += (goalY - camera.position.y) * k;
    camera.position.z += (goalZ - camera.position.z) * k;
    camera.lookAt(target.x, target.y - s * 1.5, target.z);
  });
  return null;
}

function Scene({ dark, scroll }: { dark: boolean; scroll?: MotionValue<number> }) {
  const curves = useCurves();
  const fogColor = dark ? "#080808" : "#f9fafb";
  const glow = dark ? 1.9 : 1.15;
  return (
    <>
      <fog attach="fog" args={[fogColor, 9, 22]} />
      <ambientLight intensity={dark ? 0.55 : 1.1} />
      <hemisphereLight args={[dark ? "#3a4a48" : "#ffffff", dark ? "#05070a" : "#c9ced3", dark ? 0.6 : 0.5]} />
      <directionalLight position={[6, 10, 4]} intensity={dark ? 0.9 : 1.2} color={dark ? "#cfe8df" : "#ffffff"} />
      <pointLight position={[DEPOT[0], 1.2, DEPOT[2]]} intensity={dark ? 6 : 2} distance={7} color={GREEN} />
      <Rig scroll={scroll} />
      <Ground dark={dark} />
      <Streets dark={dark} />
      <City dark={dark} />
      {curves.map((r, i) => (
        <RouteTube key={i} curve={r.curve} color={r.color} glow={glow * 0.8} />
      ))}
      {curves.map((r, i) => (
        <Vehicle key={`v${i}`} curve={r.curve} color={r.color} speed={r.speed} offset={r.offset} glow={glow} />
      ))}
      <Pin position={DEPOT} color={GREEN} beam={1.8} glow={glow} />
      {curves.map((r, i) => (
        <Pin key={`p${i}`} position={r.pts[r.pts.length - 1]} color={r.color} phase={i * 0.2} glow={glow} />
      ))}
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom mipmapBlur intensity={dark ? 1.15 : 0.6} luminanceThreshold={dark ? 0.32 : 0.7} luminanceSmoothing={0.25} radius={0.7} />
        <Vignette offset={0.25} darkness={dark ? 0.6 : 0.15} />
      </EffectComposer>
    </>
  );
}

export default function Hero3D({ dark, animate, scroll }: { dark: boolean; animate: boolean; scroll?: MotionValue<number> }) {
  return (
    <Canvas
      dpr={[1, 1.6]}
      frameloop={animate ? "always" : "demand"}
      camera={{ position: [0.5, 8.6, 10.8], fov: 32, near: 0.1, far: 60 }}
      gl={{ alpha: true, antialias: false, powerPreference: "high-performance", stencil: false, depth: true }}
      style={{ pointerEvents: "none" }}
      aria-hidden="true"
    >
      <Scene dark={dark} scroll={scroll} />
    </Canvas>
  );
}
