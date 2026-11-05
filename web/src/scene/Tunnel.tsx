import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { frameAt, labelColor } from "../data/derive";
import type { Camera, Session } from "../data/schema";
import { useRoom, type DetectionRef } from "../state/store";

/** World units per second of recording along the tunnel. */
export const DEPTH_PER_SECOND = 1.2;
/** Width of one camera's frame in world units; height follows the camera's aspect. */
export const LANE_WIDTH = 9;
export const LANE_GAP = 3;

export function laneOffset(i: number, n: number): number {
  return (i - (n - 1) / 2) * (LANE_WIDTH + LANE_GAP);
}

interface LaneProps {
  name: string;
  camera: Camera;
  x: number;
  reducedMotion: boolean;
}

const tmp = new THREE.Object3D();
const color = new THREE.Color();

/**
 * One camera as a lane of frames receding along -z: every detection is a slab at its
 * place in the frame and its moment in time, coloured by label.
 */
function Lane({ name, camera, x, reducedMotion }: LaneProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const label = useRoom((s) => s.label);
  const selected = useRoom((s) => s.selected);
  const setHovered = useRoom((s) => s.setHovered);
  const setSelected = useRoom((s) => s.setSelected);
  const h = (LANE_WIDTH * camera.height) / camera.width;

  const refs = useMemo(() => {
    const out: DetectionRef[] = [];
    camera.frames.forEach((f, frame) => f.detections.forEach((_, index) => out.push({ camera: name, frame, index })));
    return out;
  }, [camera, name]);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    let k = 0;
    camera.frames.forEach((f) => {
      for (const d of f.detections) {
        const [x1, y1, x2, y2] = d.box;
        tmp.position.set(x + ((x1 + x2) / 2 - 0.5) * LANE_WIDTH, h - ((y1 + y2) / 2) * h, -f.t * DEPTH_PER_SECOND);
        tmp.scale.set(Math.max(0.05, (x2 - x1) * LANE_WIDTH), Math.max(0.05, (y2 - y1) * h), 0.12);
        tmp.updateMatrix();
        m.setMatrixAt(k, tmp.matrix);
        const dim = label != null && d.label !== label;
        color.set(labelColor(d.label)).multiplyScalar(dim ? 0.12 : 0.35 + 0.65 * d.confidence);
        const isSel = selected?.camera === name && refs[k]?.frame === selected.frame && refs[k]?.index === selected.index;
        if (isSel) color.set("#ffffff");
        m.setColorAt(k, color);
        k += 1;
      }
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [camera, x, h, label, selected, name, refs]);

  // Frame outlines every half second, so the tunnel reads as a stack of video frames.
  const outlines = useMemo(() => {
    const pts: number[] = [];
    const step = Math.max(1, Math.round(camera.frames.length / 60));
    for (let i = 0; i < camera.frames.length; i += step) {
      const z = -(camera.frames[i]?.t ?? 0) * DEPTH_PER_SECOND;
      const l = x - LANE_WIDTH / 2;
      const r = x + LANE_WIDTH / 2;
      pts.push(l, 0, z, r, 0, z, r, 0, z, r, h, z, r, h, z, l, h, z, l, h, z, l, 0, z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [camera, x, h]);

  const count = refs.length;
  return (
    <group>
      <lineSegments geometry={outlines}>
        <lineBasicMaterial color="#2a3550" transparent opacity={0.55} />
      </lineSegments>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, count]}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (e.instanceId != null) setHovered(refs[e.instanceId] ?? null);
        }}
        onPointerOut={() => setHovered(null)}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId != null) setSelected(refs[e.instanceId] ?? null);
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors={false}
          toneMapped={false}
          transparent
          opacity={reducedMotion ? 0.9 : 0.82}
          roughness={0.4}
          metalness={0.1}
        />
      </instancedMesh>
    </group>
  );
}

/** A glowing plane that sweeps through every lane at the playhead time. */
function Playhead({ session, width, height }: { session: Session; width: number; height: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = useRoom.getState().t;
    if (ref.current) ref.current.position.z = -t * DEPTH_PER_SECOND;
  });
  void session;
  return (
    <mesh ref={ref} position={[0, height / 2, 0]}>
      <planeGeometry args={[width, height + 1.2]} />
      <meshBasicMaterial color="#4fa3ff" transparent opacity={0.09} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/** Lights up the detections in the frame under the playhead for each camera. */
function LiveFrame({ name, camera, x }: { name: string; camera: Camera; x: number }) {
  const group = useRef<THREE.Group>(null);
  const h = (LANE_WIDTH * camera.height) / camera.width;
  const last = useRef(-1);
  const boxes = useRef<THREE.LineSegments>(null);
  useFrame(() => {
    const t = useRoom.getState().t;
    const i = frameAt(camera, t);
    if (i === last.current || !boxes.current) return;
    last.current = i;
    const f = camera.frames[i];
    const pts: number[] = [];
    const cols: number[] = [];
    for (const d of f?.detections ?? []) {
      const [x1, y1, x2, y2] = d.box;
      const l = x + (x1 - 0.5) * LANE_WIDTH;
      const r = x + (x2 - 0.5) * LANE_WIDTH;
      const top = h - y1 * h;
      const bot = h - y2 * h;
      pts.push(l, bot, 0, r, bot, 0, r, bot, 0, r, top, 0, r, top, 0, l, top, 0, l, top, 0, l, bot, 0);
      const c = new THREE.Color(labelColor(d.label));
      for (let k = 0; k < 8; k += 1) cols.push(c.r, c.g, c.b);
    }
    const g = boxes.current.geometry;
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    g.computeBoundingSphere();
    if (group.current) group.current.position.z = -(f?.t ?? 0) * DEPTH_PER_SECOND + 0.08;
  });
  void name;
  return (
    <group ref={group}>
      <lineSegments ref={boxes}>
        <bufferGeometry />
        <lineBasicMaterial vertexColors toneMapped={false} linewidth={2} />
      </lineSegments>
    </group>
  );
}

export function Tunnel({ session, reducedMotion }: { session: Session; reducedMotion: boolean }) {
  const names = Object.keys(session.cameras);
  const tallest = Math.max(...names.map((n) => (LANE_WIDTH * session.cameras[n]!.height) / session.cameras[n]!.width));
  const width = names.length * (LANE_WIDTH + LANE_GAP);
  return (
    <group>
      {names.map((n, i) => (
        <group key={n}>
          <Lane name={n} camera={session.cameras[n]!} x={laneOffset(i, names.length)} reducedMotion={reducedMotion} />
          <LiveFrame name={n} camera={session.cameras[n]!} x={laneOffset(i, names.length)} />
        </group>
      ))}
      <Playhead session={session} width={width} height={tallest} />
    </group>
  );
}
