import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { sessionDuration } from "../data/derive";
import type { Session } from "../data/schema";
import { useRoom, type CameraPreset } from "../state/store";
import { DEPTH_PER_SECOND, LANE_WIDTH, Tunnel, laneOffset } from "./Tunnel";

type View = { position: [number, number, number]; target: [number, number, number] };

function presetView(preset: CameraPreset, depth: number, lanes: number): View {
  const mid = -depth / 2;
  const span = lanes * (LANE_WIDTH + 3);
  switch (preset) {
    case "front":
      return { position: [0, 4, 16], target: [0, 3.5, -4] };
    case "side":
      return { position: [span + 18, 12, mid + 4], target: [0, 3, mid] };
    default:
      return { position: [-span * 0.9, 16, 18], target: [0, 2.5, mid * 0.6] };
  }
}

function CameraRig({ session, reducedMotion }: { session: Session; reducedMotion: boolean }) {
  const camera = useThree((s) => s.camera);
  const controls = useRef<OrbitControlsImpl>(null);
  const preset = useRoom((s) => s.preset);
  const selected = useRoom((s) => s.selected);
  const playing = useRoom((s) => s.playing);
  const names = Object.keys(session.cameras);
  const depth = sessionDuration(session) * DEPTH_PER_SECOND;

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    let view = presetView(preset, depth, names.length);
    if (selected) {
      const cam = session.cameras[selected.camera];
      const f = cam?.frames[selected.frame];
      const d = f?.detections[selected.index];
      if (cam && f && d) {
        const x = laneOffset(names.indexOf(selected.camera), names.length) + ((d.box[0] + d.box[2]) / 2 - 0.5) * LANE_WIDTH;
        const h = (LANE_WIDTH * cam.height) / cam.width;
        const y = h - ((d.box[1] + d.box[3]) / 2) * h;
        const z = -f.t * DEPTH_PER_SECOND;
        view = { position: [x - 4, y + 2.5, z + 7], target: [x, y, z] };
      }
    }
    const dur = reducedMotion ? 0 : 1.3;
    const tl = gsap.timeline();
    tl.to(camera.position, { x: view.position[0], y: view.position[1], z: view.position[2], duration: dur, ease: "power3.inOut" }, 0);
    tl.to(c.target, { x: view.target[0], y: view.target[1], z: view.target[2], duration: dur, ease: "power3.inOut", onUpdate: () => c.update() }, 0);
    return () => {
      tl.kill();
    };
  }, [preset, selected, camera, reducedMotion, depth, names, session]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={90}
      autoRotate={false}
      enablePan
      screenSpacePanning
      // Orbiting is paused while the timeline plays so the sweep stays readable.
      enableRotate={!playing}
    />
  );
}

interface Props { session: Session; reducedMotion: boolean; label: string }

/** The WebGL canvas. Loaded lazily so the page paints before three.js arrives. */
export default function Scene({ session, reducedMotion, label }: Props) {
  const names = Object.keys(session.cameras);
  const start = presetView("tunnel", sessionDuration(session) * DEPTH_PER_SECOND, names.length);
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: start.position, fov: 42, near: 0.1, far: 300 }}
      frameloop="always"
      aria-label={label}
      role="img"
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => useRoom.getState().setSelected(null)}
    >
      <color attach="background" args={["#0b0f18"]} />
      <fog attach="fog" args={["#0b0f18", 30, 95]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#9cc4ff", "#1a1206", 0.5]} />
      <directionalLight position={[-10, 20, 12]} intensity={1.2} />
      <pointLight position={[0, 8, 6]} intensity={30} color="#4fa3ff" distance={40} />
      <gridHelper args={[160, 80, "#1c2436", "#121826"]} position={[0, -0.02, -20]} />
      <Tunnel session={session} reducedMotion={reducedMotion} />
      <CameraRig session={session} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
