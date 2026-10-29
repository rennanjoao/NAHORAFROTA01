import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const GREEN = "#04E8A4";
const ALERT = "#FFC53D";
const LATE = "#FF4D4F";

type V3 = [number, number, number];

const DEPOT: V3 = [-4.2, 0, 2.2];
const ROUTES: { pts: V3[]; color: string; speed: number; offset: number }[] = [
  { pts: [DEPOT, [-2.2, 0, 1.3], [0, 0, 1.9], [2.1, 0, 0.6], [4.4, 0, 1.1]], color: GREEN, speed: 0.045, offset: 0.1 },
  { pts: [DEPOT, [-3.1, 0, 0.1], [-1, 0, -1.1], [1.6, 0, -2.1], [4.3, 0, -2.6]], color: GREEN, speed: 0.038, offset: 0.55 },
  { pts: [DEPOT, [-2.6, 0, 3.1], [0.2, 0, 3.3], [2.6, 0, 2.7], [4.8, 0, 3.2]], color: ALERT, speed: 0.03, offset: 0.3 },
  { pts: [DEPOT, [-4.6, 0, 0.2], [-3.2, 0, -2.4], [-1.2, 0, -3.3], [1.2, 0, -3.6]], color: LATE, speed: 0.034, offset: 0.8 },
  { pts: [DEPOT, [-1.5, 0, 0.4], [0.8, 0, -0.4], [3, 0, -0.9], [5.2, 0, -0.4]], color: GREEN, speed: 0.05, offset: 0.0 },
];

function useCurves() {
  return useMemo(
    () => ROUTES.map((r) => ({ ...r, curve: new THREE.CatmullRomCurve3(r.pts.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.6) })),
    [],
  );
}

function Grid({ dark }: { dark: boolean }) {
  const obj = useMemo(() => {
    const size = 14;
    const step = 0.5;
    const pts: number[] = [];
    for (let i = -size; i <= size; i += step) {
      pts.push(-size, 0, i, size, 0, i);
      pts.push(i, 0, -size, i, 0, size);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({ color: dark ? "#ffffff" : "#080808", transparent: true, opacity: dark ? 0.06 : 0.07 });
    return new THREE.LineSegments(geom, mat);
  }, [dark]);
  return <primitive object={obj} position={[0, -0.02, 0]} />;
}

function RouteLine({ curve, color }: { curve: THREE.CatmullRomCurve3; color: string }) {
  const obj = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints(curve.getPoints(140));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 });
    return new THREE.Line(geom, mat);
  }, [curve, color]);
  return <primitive object={obj} />;
}

function Mover({ curve, color, speed, offset }: { curve: THREE.CatmullRomCurve3; color: string; speed: number; offset: number }) {
  const ref = useRef<THREE.Group>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.getElapsedTime() * speed + offset) % 1;
    curve.getPointAt(t, tmp);
    ref.current.position.set(tmp.x, 0.06, tmp.z);
    const ahead = curve.getPointAt(Math.min(1, t + 0.01));
    ref.current.lookAt(ahead.x, 0.06, ahead.z);
  });
  return (
    <group ref={ref}>
      <mesh>
        <boxGeometry args={[0.26, 0.12, 0.14]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

function Pin({ position, color, phase = 0 }: { position: V3; color: string; phase?: number }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const t = (clock.getElapsedTime() * 0.6 + phase) % 1;
    ring.current.scale.setScalar(0.4 + t * 1.6);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t);
  });
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.08, 20]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[0.16, 0.19, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

function Rig() {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(0.6, 0, 0), []);
  useFrame((state, dt) => {
    const px = state.pointer.x;
    const py = state.pointer.y;
    const goalX = 0.4 + px * 0.9;
    const goalY = 6.4 - py * 0.5;
    const goalZ = 7.6;
    camera.position.x += (goalX - camera.position.x) * Math.min(1, dt * 1.5);
    camera.position.y += (goalY - camera.position.y) * Math.min(1, dt * 1.5);
    camera.position.z += (goalZ - camera.position.z) * Math.min(1, dt * 1.5);
    camera.lookAt(target);
  });
  return null;
}

function Scene({ dark }: { dark: boolean }) {
  const curves = useCurves();
  const bg = dark ? "#080808" : "#ffffff";
  return (
    <group scale={0.78}>
      <fog attach="fog" args={[bg, 7, 15]} />
      <Rig />
      <Grid dark={dark} />
      {curves.map((r, i) => (
        <RouteLine key={i} curve={r.curve} color={r.color} />
      ))}
      {curves.map((r, i) => (
        <Mover key={`m${i}`} curve={r.curve} color={r.color} speed={r.speed} offset={r.offset} />
      ))}
      <Pin position={DEPOT} color={GREEN} />
      {curves.map((r, i) => (
        <Pin key={`p${i}`} position={r.pts[r.pts.length - 1]} color={r.color} phase={i * 0.2} />
      ))}
      {curves.map((r, i) => (
        <Pin key={`q${i}`} position={r.pts[2]} color={r.color} phase={0.5 + i * 0.13} />
      ))}
    </group>
  );
}

/** Mapa 3D de rotas que gira levemente com o ponteiro. Carregado sob demanda. */
export default function Hero3D({ dark, animate }: { dark: boolean; animate: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={animate ? "always" : "demand"}
      camera={{ position: [0.4, 6.4, 7.6], fov: 34, near: 0.1, far: 40 }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      style={{ pointerEvents: "none" }}
      aria-hidden="true"
    >
      <Scene dark={dark} />
    </Canvas>
  );
}
