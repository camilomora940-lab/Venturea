// Funciones puras para videos pitch e imágenes (se prueban en tests/unit.mjs).
(function () {
  const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
  // Foto 1:1 (400×400, máx. 2 MB) y banner 4:1 (1584×396, máx. 5 MB).
  const IMAGE_RULES = {
    avatar: { width: 400, height: 400, maxBytes: 2 * 1024 * 1024, noun: "una foto" },
    banner: { width: 1584, height: 396, maxBytes: 5 * 1024 * 1024, noun: "un banner" }
  };

  // Solo YouTube, Vimeo y Loom; el iframe se construye siempre desde la URL de inserción, nunca desde el texto del usuario.
  function toEmbedUrl(raw) {
    let url;
    try { url = new URL(String(raw).trim()); } catch { return null; }
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.replace(/^(www|m)\./, "");
    if (host === "youtube.com") {
      const id = url.pathname === "/watch" ? url.searchParams.get("v") : /^\/(?:shorts|embed|live)\/([\w-]{11})/.exec(url.pathname)?.[1];
      return /^[\w-]{11}$/.test(id || "") ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "youtu.be") {
      const id = url.pathname.slice(1);
      return /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "vimeo.com") {
      const match = /^\/(\d+)(?:\/([0-9a-f]+))?\/?$/.exec(url.pathname);
      return match ? `https://player.vimeo.com/video/${match[1]}${match[2] ? `?h=${match[2]}` : ""}` : null;
    }
    if (host === "loom.com") {
      const match = /^\/(?:share|embed)\/([0-9a-f]{32})/.exec(url.pathname);
      return match ? `https://www.loom.com/embed/${match[1]}` : null;
    }
    return null;
  }

  // Devuelve un mensaje de error o "" si el archivo sirve.
  function validateImageFile(file, kind) {
    const rule = IMAGE_RULES[kind];
    if (!file) return "Selecciona una imagen.";
    if (!IMAGE_TYPES.includes(file.type)) return "Formato no permitido: usa una imagen JPG, PNG o WebP.";
    if (!file.size) return "El archivo está vacío.";
    if (file.size > rule.maxBytes) {
      return `La imagen pesa ${(file.size / 1048576).toFixed(1)} MB; el máximo para ${rule.noun} es ${rule.maxBytes / 1048576} MB.`;
    }
    return "";
  }

  // Video propio (plan Pro): MP4 o WebM, hasta 100 MB.
  const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
  function validateVideoFile(file) {
    if (!file) return "Selecciona un video.";
    if (!["video/mp4", "video/webm"].includes(file.type)) return "Formato no permitido: usa un video MP4 o WebM.";
    if (!file.size) return "El archivo está vacío.";
    if (file.size > MAX_VIDEO_BYTES) return `El video pesa ${(file.size / 1048576).toFixed(0)} MB; el máximo es ${MAX_VIDEO_BYTES / 1048576} MB.`;
    return "";
  }

  // CSV para exportar listas. Las celdas que empiezan con = + - @ se neutralizan para que Excel no las ejecute como fórmula.
  function toCsv(rows) {
    return rows.map((row) => row.map((cell) => {
      let text = String(cell ?? "");
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(",")).join("\r\n");
  }

  // Rectángulo de la imagen original que llena la salida; zoom ≥ 1; pan en píxeles de la imagen original.
  function coverRect(imgW, imgH, outW, outH, zoom = 1, panX = 0, panY = 0) {
    const scale = Math.max(outW / imgW, outH / imgH) * Math.max(1, zoom);
    const sw = outW / scale;
    const sh = outH / scale;
    const clamp = (value, max) => Math.min(Math.max(value, 0), max);
    return { sx: clamp((imgW - sw) / 2 + panX, imgW - sw), sy: clamp((imgH - sh) / 2 + panY, imgH - sh), sw, sh };
  }

  window.VentureaMedia = { IMAGE_TYPES, IMAGE_RULES, toEmbedUrl, validateImageFile, validateVideoFile, toCsv, coverRect };
})();
