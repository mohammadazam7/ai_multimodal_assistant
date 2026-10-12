# Vision client

Browser client for the detection service: Vite, React 19 and TypeScript.

```bash
npm install
npm run dev        # http://localhost:5173, proxies /v1 to http://localhost:8000
```

Set `VITE_API_PROXY` to point the dev server at a backend running elsewhere.

| Script | What it does |
|---|---|
| `npm run typecheck` | `tsc -b` in strict mode |
| `npm run lint` | ESLint with typescript-eslint and the React hooks rules |
| `npm test` | Vitest + Testing Library in jsdom |
| `npm run build` | type-check, then a production build in `dist/` |
