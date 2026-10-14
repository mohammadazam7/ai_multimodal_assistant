import { useCallback, useEffect, useState } from "react";

import { fetchHealth } from "./api/http";
import type { Health } from "./api/types";
import { listCameras, type CameraInfo } from "./camera/capture";
import { CameraTile } from "./components/CameraTile";

interface Tile {
  key: number;
  deviceId: string | undefined;
  label: string;
}

const DEFAULT_CAMERA = "";

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [selected, setSelected] = useState(DEFAULT_CAMERA);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [nextKey, setNextKey] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then(setHealth)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setHealthError(e instanceof Error ? e.message : String(e));
      });
    return () => controller.abort();
  }, []);

  const refreshCameras = useCallback(() => {
    if (!navigator.mediaDevices) return;
    listCameras()
      .then(setCameras)
      .catch(() => setCameras([]));
  }, []);

  // Device labels only appear after the first permission grant, so re-list whenever
  // the set of devices (or their visibility) changes.
  useEffect(() => {
    refreshCameras();
    navigator.mediaDevices?.addEventListener("devicechange", refreshCameras);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", refreshCameras);
  }, [refreshCameras]);

  const addTile = () => {
    const camera = cameras.find((c) => c.deviceId === selected);
    setTiles((current) => [
      ...current,
      {
        key: nextKey,
        deviceId: camera?.deviceId,
        label: camera?.label ?? "Default camera",
      },
    ]);
    setNextKey((k) => k + 1);
  };

  const removeTile = (key: number) => {
    setTiles((current) => current.filter((t) => t.key !== key));
    refreshCameras();
  };

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <h1>Vision client</h1>
          <p className="muted">Live object detection on camera streams.</p>
        </div>
        <p className="server" aria-live="polite">
          {health && (
            <>
              Server: <strong>{health.model}</strong> on <strong>{health.device}</strong>
              {!health.ready && " (warming up)"}
            </>
          )}
          {healthError && <span className="error">Server unreachable: {healthError}</span>}
        </p>
      </header>

      <section className="controls" aria-label="Cameras">
        <label>
          Camera{" "}
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value={DEFAULT_CAMERA}>Default camera</option>
            {cameras.map((c) => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={addTile}>
          Add camera
        </button>
        <span className="muted">
          {tiles.length} stream{tiles.length === 1 ? "" : "s"}
        </span>
      </section>

      {tiles.length === 0 ? (
        <p className="empty muted">
          Add a camera to start streaming. Each camera opens its own WebSocket, and the server
          batches frames from all of them into shared forward passes.
        </p>
      ) : (
        <section className="grid">
          {tiles.map((t) => (
            <CameraTile
              key={t.key}
              deviceId={t.deviceId}
              label={t.label}
              onRemove={() => removeTile(t.key)}
            />
          ))}
        </section>
      )}
    </main>
  );
}
