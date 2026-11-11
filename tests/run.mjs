// Uso: node tests/run.mjs [escenario...]   Requiere Edge o Chrome instalado. Sin dependencias.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const browser = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe"
].find(existsSync);
if (!browser) throw new Error("No se encontró Edge ni Chrome");

const server = createServer(async (req, res) => {
  try {
    const path = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
    if (!path.startsWith(root)) throw new Error("fuera de la raíz");
    const body = await readFile(path);
    res.writeHead(200, { "content-type": types[extname(path)] || "text/plain" });
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const { SCENARIOS } = await import("node:vm").then(async (vm) => {
  const sandbox = { window: {} };
  vm.runInNewContext((await readFile(join(root, "tests/scenarios.js"), "utf8")).replace(/^const /gm, "var "), sandbox);
  return { SCENARIOS: sandbox.window.SCENARIOS };
});
const wanted = process.argv.slice(2);
const names = Object.keys(SCENARIOS).filter((name) => !wanted.length || wanted.some((w) => name.startsWith(w)));
let failures = 0;
for (const name of names) {
  const dir = join(process.env.TEMP || "/tmp", `venturea-test-${name}`);
  const html = await new Promise((resolve) => execFile(browser, [
    "--headless=new", "--disable-gpu", `--user-data-dir=${dir}`, "--window-size=1280,900", "--virtual-time-budget=15000",
    "--dump-dom", `http://127.0.0.1:${port}/tests/harness.html?s=${name}`
  ], { maxBuffer: 1e8 }, (_e, out) => resolve(out)));
  const match = /RESULT:(.*?):END/s.exec(html || "");
  if (!match) { console.log(`✗ ${name}: sin resultado`); failures++; continue; }
  const results = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
  console.log(`\n${name}`);
  for (const r of results) { console.log(`  ${r.ok ? "✓" : "✗"} ${r.label}`); if (!r.ok) failures++; }
  if (!results.length) failures++;
}
server.close();
console.log(failures ? `\n${failures} fallo(s)` : "\nTodo en verde");
process.exit(failures ? 1 : 0);
