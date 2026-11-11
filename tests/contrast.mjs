// Comprueba que los pares texto/fondo declarados en styles.css cumplen AA (4,5:1) y que no hay letra menor a 12 px.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const token = (name) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1];
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [texto, fondo, uso]
const pairs = [
  ["primary", "surface", "botones y enlaces"], ["navy", "surface", "títulos"], ["emerald-text", "surface", "texto esmeralda"],
  ["violet", "surface", "rol Empresa"], ["alert", "surface", "notificaciones"], ["ink", "surface", "texto principal"],
  ["muted", "surface", "texto secundario"], ["muted", "bg", "texto secundario sobre fondo"], ["surface", "primary", "texto sobre botón"],
  ["navy", "amber", "insignia Pro"], ["primary", "primary-soft", "etiquetas"], ["emerald-text", "emerald-soft", "etiqueta esmeralda"],
  ["violet", "violet-soft", "etiqueta violeta"], ["surface", "alert", "contador de notificaciones"], ["muted", "primary-soft", "texto sobre aviso"]
];
let failures = 0;
for (const [fg, bg, use] of pairs) {
  const value = ratio(token(fg), token(bg));
  const ok = value >= 4.5;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${value.toFixed(1)}:1  ${fg} sobre ${bg} (${use})`);
}
const small = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].filter((m) => Number(m[1]) < 12);
const smallFont = [...css.matchAll(/font:\s*[\d ]*?(\d+)px/g)].filter((m) => Number(m[1]) < 12);
console.log(`${small.length + smallFont.length ? "✗" : "✓"} letra menor a 12 px: ${small.length + smallFont.length}`);
failures += small.length + smallFont.length;
const afterRoot = css.slice(css.indexOf(":root {")); const hardcoded = afterRoot.slice(afterRoot.indexOf("}")).match(/#[0-9a-fA-F]{3,8}\b/g) || [];
console.log(`ℹ colores hex fuera de :root: ${hardcoded.length} (sombras con transparencia)`);
process.exit(failures ? 1 : 0);
