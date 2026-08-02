// Führt alle E2E-Skripte in diesem Ordner aus und startet dafür bei Bedarf selbst einen
// Dev-Server.
//
//   npm run e2e                  # alle Skripte, eigener Dev-Server auf Port 5180
//   npm run e2e -- flow          # nur Skripte, deren Name den Filter enthält
//   NOTENTABELLE_URL=http://localhost:5173/ npm run e2e   # gegen laufenden Server
//
// Läuft auf WSL, Windows nativ und macOS: Vite wird über den Node-Interpreter dieses
// Prozesses und den plattformneutralen JS-Einstiegspunkt gestartet — keine .cmd-Shims.
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const e2eDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(e2eDir);
const PORT = 5180;
/** Bibliotheken, keine Prüfskripte — sie würden als „bestanden" gelten, ohne zu prüfen. */
const HELPERS = ['run-all.mjs', 'harness.mjs'];
const STARTUP_TIMEOUT_MS = 60_000;

const filters = process.argv.slice(2);
const scripts = readdirSync(e2eDir)
  .filter((f) => f.endsWith('.mjs') && !HELPERS.includes(f))
  .filter((f) => filters.length === 0 || filters.some((needle) => f.includes(needle)))
  .sort();

if (scripts.length === 0) {
  console.error(`Kein E2E-Skript gefunden${filters.length ? ` für Filter: ${filters.join(', ')}` : ''}.`);
  process.exit(1);
}

function startDevServer() {
  const viteBin = join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(process.execPath, [viteBin, '--port', String(PORT), '--strictPort'], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', () => {}); // Stream leeren, Ausgabe verwerfen
  return child;
}

async function waitForServer(url) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server noch nicht bereit
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Dev-Server unter ${url} war nach ${STARTUP_TIMEOUT_MS / 1000}s nicht erreichbar.`);
}

function runScript(file, url) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(e2eDir, file)], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env, NOTENTABELLE_URL: url },
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

const externalUrl = process.env.NOTENTABELLE_URL;
const url = externalUrl ?? `http://localhost:${PORT}/`;
let server = null;

if (externalUrl) {
  console.log(`↪ Nutze laufenden Dev-Server: ${url}`);
} else {
  console.log(`▶ Starte Dev-Server auf Port ${PORT} …`);
  server = startDevServer();
  server.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Dev-Server unerwartet beendet (Code ${code}) — Port ${PORT} belegt?`);
      process.exit(1);
    }
  });
}

const stopServer = () => server?.kill();
process.on('SIGINT', () => {
  stopServer();
  process.exit(130);
});

const results = [];
try {
  await waitForServer(url);
  for (const file of scripts) {
    console.log(`\n${'─'.repeat(70)}\n▶ ${file}\n${'─'.repeat(70)}`);
    results.push({ file, code: await runScript(file, url) });
  }
} finally {
  stopServer();
}

console.log(`\n${'═'.repeat(70)}\nErgebnis`);
for (const { file, code } of results) {
  console.log(`  ${code === 0 ? '✅' : '❌'} ${file}${code === 0 ? '' : ` (Exit-Code ${code})`}`);
}
const failed = results.filter((r) => r.code !== 0);
console.log(`${results.length - failed.length}/${results.length} Skripte erfolgreich.`);
console.log('Screenshots: e2e/screenshots/');
process.exit(failed.length === 0 ? 0 : 1);
