// Pruebas de funciones puras (sin navegador): node tests/unit.mjs
import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const load = (file) => {
  const window = {};
  new Function("window", readFileSync(new URL(`../${file}`, import.meta.url), "utf8"))(window);
  return window;
};
const { VentureaMedia: media } = load("media.js");
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };

console.log("media.js");
const youtube = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";
test("YouTube: watch, youtu.be, shorts y embed se convierten a la URL de inserción", () => {
  for (const url of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ", "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=3", "https://www.youtube.com/embed/dQw4w9WgXcQ"]) {
    assert.equal(media.toEmbedUrl(url), youtube, url);
  }
});
test("Vimeo y Loom se convierten", () => {
  assert.equal(media.toEmbedUrl("https://vimeo.com/123456789"), "https://player.vimeo.com/video/123456789");
  assert.equal(media.toEmbedUrl("https://vimeo.com/123456789/abcdef0123"), "https://player.vimeo.com/video/123456789?h=abcdef0123");
  assert.equal(media.toEmbedUrl("https://www.loom.com/share/0123456789abcdef0123456789abcdef"), "https://www.loom.com/embed/0123456789abcdef0123456789abcdef");
});
test("otros dominios y trucos de URL se rechazan", () => {
  for (const url of [
    "https://evil.example.com/watch?v=dQw4w9WgXcQ", "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", "https://youtube.com@evil.com/watch?v=dQw4w9WgXcQ",
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ", "javascript:alert(1)", "https://www.youtube.com/watch?v=corto", "https://vimeo.com/abc", "https://loom.com/share/zzz", "", "no es url"
  ]) assert.equal(media.toEmbedUrl(url), null, url);
});
test("la URL de inserción nunca incluye texto del usuario fuera del id", () => {
  assert.equal(media.toEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ"onload="x'), null);
});
test("validación de imágenes: formato, vacío y tamaño máximo (2 MB foto, 5 MB banner)", () => {
  const file = (type, size) => ({ type, size });
  assert.equal(media.validateImageFile(file("image/png", 1000), "avatar"), "");
  assert.match(media.validateImageFile(file("image/gif", 1000), "avatar"), /JPG, PNG o WebP/);
  assert.match(media.validateImageFile(file("application/pdf", 1000), "banner"), /Formato/);
  assert.match(media.validateImageFile(file("image/jpeg", 0), "avatar"), /vacío/);
  assert.match(media.validateImageFile(file("image/jpeg", 2 * 1048576 + 1), "avatar"), /máximo para una foto es 2 MB/);
  assert.equal(media.validateImageFile(file("image/jpeg", 2 * 1048576 + 1), "banner"), "");
  assert.match(media.validateImageFile(file("image/webp", 5 * 1048576 + 1), "banner"), /máximo para un banner es 5 MB/);
  assert.match(media.validateImageFile(null, "avatar"), /Selecciona/);
});
test("recorte: llena la salida, mantiene la proporción y nunca se sale de la imagen", () => {
  for (const [w, h, ow, oh] of [[1000, 500, 400, 400], [300, 900, 1584, 396], [4000, 3000, 1584, 396]]) {
    for (const zoom of [1, 2.5]) for (const pan of [-5000, 0, 5000]) {
      const r = media.coverRect(w, h, ow, oh, zoom, pan, pan);
      assert.ok(r.sx >= 0 && r.sy >= 0 && r.sx + r.sw <= w + 1e-6 && r.sy + r.sh <= h + 1e-6, `dentro de la imagen ${w}x${h} z${zoom} p${pan}`);
      assert.ok(Math.abs(r.sw / r.sh - ow / oh) < 1e-6, "proporción de salida");
    }
  }
});

console.log(`\n${passed} pruebas pasaron`);
