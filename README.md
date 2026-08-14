# Case Review Dashboard

A local-first React dashboard for reviewing insurance-claim adjudication pipeline outputs. Point it at a folder of case subfolders and it parses the JSON artifacts, renders one filterable/sortable row per case, and surfaces pass-rate and confidence insights. No backend, no network calls — everything is read directly from your local filesystem via the browser's File System Access API.

## Quick start

```bash
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`) in a **Chromium-based browser** (see below) and click "Select Case Folder" to choose a root directory containing your case subfolders.

## Browser requirement

The File System Access API (`window.showDirectoryPicker()`) that this app depends on is **Chromium-only**. Use one of:

- Google Chrome (86+)
- Microsoft Edge (86+)
- Arc, Brave, or any other Chromium-based browser

**Firefox and Safari do not support this API** and will not be able to load a folder.

### Fallback for Firefox/Safari

If you need to support Firefox or Safari, run a small local static file server that exposes your case folder over HTTP, and adapt the dashboard's ingestion to `fetch()` the files instead of using `showDirectoryPicker()`. A minimal Node example:

```js
// server.js — serves ./case-data over http://localhost:3001
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'case-data');

http.createServer((req, res) => {
  const filePath = path.join(ROOT, decodeURIComponent(req.url));
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(data);
  });
}).listen(3001, () => console.log('Serving case-data on http://localhost:3001'));
```

Run it with `node server.js`. This is not wired into the app by default — it's provided as a starting point if you need a non-Chromium-compatible ingestion path.

## Other commands

```bash
npm run build     # type-check + production build to dist/
npm run preview    # preview the production build locally
npm run lint       # oxlint
npx vitest run     # run the test suite
```

## Data format expected

For each case subfolder inside your selected root folder:

- `consolidated_final.json` — the final verdict document (key path configurable in Settings; default `bill_summary.case_verdict`)
- `stage_confidence/*.json` — one file per pipeline stage, each exposing a `stage` label and a `score` (0–1 confidence), both key paths configurable in Settings

Adding a new `*.json` file to any case's `stage_confidence/` folder automatically appears as a new column on the next folder load — no code changes required. Use the Settings panel (gear icon in the sidebar) to adjust key paths, thresholds, and excluded stage filenames as your upstream schema evolves.
