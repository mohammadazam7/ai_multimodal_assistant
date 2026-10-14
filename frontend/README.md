# Vision client

Browser client for the detection service: Vite, React 19 and TypeScript.

```bash
npm install
npm run dev        # http://localhost:5173, proxies /v1 to http://localhost:8000
```

Set `VITE_API_PROXY` to point the dev server at a backend running elsewhere.

Camera access needs a secure context: `localhost` works, but a phone or another machine
on the LAN needs the page served over HTTPS.

## Layout

| Path | Contents |
|---|---|
| `src/api/` | typed HTTP client and `DetectionStream`, one WebSocket per camera |
| `src/camera/` | device listing, `getUserMedia`, JPEG frame encoder |
| `src/overlay/` | box scaling and canvas drawing |
| `src/metrics/` | rolling FPS and latency percentiles over the last 3 s |
| `src/components/` | `CameraTile`, which ties the above together for one camera |

Everything outside `components/` and `App.tsx` is plain TypeScript with no React, so it
is unit-tested directly with fakes for the socket, the canvas and the media devices.

| Script | What it does |
|---|---|
| `npm run typecheck` | `tsc -b` in strict mode |
| `npm run lint` | ESLint with typescript-eslint and the React hooks rules |
| `npm test` | Vitest + Testing Library in jsdom |
| `npm run build` | type-check, then a production build in `dist/` |
