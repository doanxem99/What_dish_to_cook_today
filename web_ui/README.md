# web_ui

Vue 3 client for "What dish to cook today?". It talks to the Express API in `../server`.

```bash
npm install
npm run dev     # http://localhost:5173, API at http://localhost:3000
npm run build   # dist/
```

The API base URL defaults to `http://localhost:3000/`; override it with `VITE_SERVER_URL`.

Architecture, endpoints and data model: `../docs/ARCHITECTURE.md`.
