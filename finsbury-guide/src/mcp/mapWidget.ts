export const MAP_WIDGET_URI = "ui://field-guide/map/v5.html"
export const MAP_WIDGET_URIS = [
  "ui://field-guide/map.html",
  "ui://field-guide/map/v2.html",
  "ui://field-guide/map/v3.html",
  "ui://field-guide/map/v4.html",
  MAP_WIDGET_URI,
] as const
export const MAP_WIDGET_MIME = "text/html;profile=mcp-app"

const SOURCE_COLOR: Record<string, string> = {
  ra: "#c9a84c",
  gig: "#7ec8e3",
  nearby: "#9d7cff",
  trail: "#e07a5f",
  place: "#6fbf73",
  personal: "#f0c8c8",
}

/**
 * Self-contained ChatGPT widget. No CDN, no map tiles: ChatGPT's iframe CSP
 * blocks Carto/MapLibre fetches, so points are drawn on a canvas from GeoJSON.
 */
export function mapWidgetHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    html,body{margin:0;background:#071107;color:#d7ecd7;font-family:Georgia,serif}
    #wrap{display:flex;flex-direction:column;min-height:320px}
    #bar{display:flex;gap:.35rem;flex-wrap:wrap;align-items:center;padding:.45rem .5rem;border-bottom:1px solid rgba(74,155,74,.35)}
    #status{padding:.25rem .55rem;font-size:.8rem;letter-spacing:.04em}
    #bar button{padding:.3rem .5rem;background:#0c1a0c;border:1px solid rgba(201,168,76,.45);color:#c9a84c;font:inherit;font-size:.75rem;cursor:pointer}
    #stage{position:relative;flex:1;min-height:280px}
    canvas{display:block;width:100%;height:100%;background:#071107}
    #pop{display:none;position:absolute;max-width:16rem;padding:.65rem .8rem;background:#0c1a0c;border:1px solid rgba(74,155,74,.4);pointer-events:auto;font-size:.85rem}
    #dbg{margin:0;padding:.45rem .6rem;font:11px/1.35 ui-monospace,Menlo,monospace;white-space:pre-wrap;background:#041004;border-top:1px solid rgba(74,155,74,.35);max-height:9rem;overflow:auto;color:#9bb89b}
  </style>
</head>
<body>
  <div id="wrap">
    <div id="bar"><span id="status">Waiting for GeoJSON from the tool result</span></div>
    <div id="stage">
      <canvas id="map"></canvas>
      <div id="pop"></div>
    </div>
    <pre id="dbg">Field Guide debug\nwaiting…</pre>
  </div>
  <script>
(function () {
  const COLORS = ${JSON.stringify(SOURCE_COLOR)};
  const LAYERS = ["ra", "gig", "nearby", "trail", "place", "personal"];
  const canvas = document.getElementById("map");
  const ctx = canvas.getContext("2d");
  const pop = document.getElementById("pop");
  const pending = new Map();
  let nextId = 1;
  let features = [];
  let lines = [];
  let view = { x: 0.5, y: 0.35, scale: 18 };
  let drag = null;

  function geojsonFromToolResult(payload, openai) {
    const seen = new Set();
    function asCollection(node) {
      if (!node || typeof node !== "object") return null;
      if (node.type === "FeatureCollection" && Array.isArray(node.features)) return node;
      return null;
    }
    function walk(node) {
      const direct = asCollection(node);
      if (direct) return direct;
      if (!node || typeof node !== "object") return null;
      if (seen.has(node)) return null;
      seen.add(node);
      const nested = [node.geojson, node.structuredContent, node.result, node.params, node._meta, node.mcp_tool_result, node.call_tool_result];
      for (const child of nested) {
        const found = walk(child);
        if (found) return found;
      }
      if (Array.isArray(node.content)) {
        for (const item of node.content) {
          if (!item || typeof item !== "object" || typeof item.text !== "string") continue;
          const trimmed = item.text.trim();
          if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) continue;
          try {
            const found = walk(JSON.parse(trimmed));
            if (found) return found;
          } catch (e) {}
        }
      }
      return null;
    }
    return walk(payload) || walk(openai && openai.toolOutput) || walk(openai && openai.toolResponseMetadata);
  }

  function request(method, params) {
    const id = nextId++;
    window.parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*");
    return new Promise(function (resolve, reject) {
      pending.set(id, { resolve, reject });
    });
  }

  function keysOf(v) {
    if (!v || typeof v !== "object") return String(v);
    return Object.keys(v).slice(0, 24).join(",");
  }

  function debugDump(note) {
    const openai = window.openai;
    const out = openai && openai.toolOutput;
    const sc = out && out.structuredContent ? out.structuredContent : out;
    const gj = sc && sc.geojson ? sc.geojson : sc && sc.type === "FeatureCollection" ? sc : null;
    const parsed = geojsonFromToolResult(null, openai);
    const lines = [
      "Field Guide debug",
      "note: " + (note || ""),
      "openai: " + (openai ? "YES keys=" + keysOf(openai) : "NO"),
      "tool result received: " + (out ? "YES" : "NO"),
      "structuredContent: " + (out && out.structuredContent ? "YES" : sc && sc.layer ? "as toolOutput" : "NO"),
      "layer: " + String(sc && sc.layer || parsed && parsed.layerCounts && Object.keys(parsed.layerCounts)[0] || "undefined"),
      "geojson: " + (gj && gj.type === "FeatureCollection" ? "YES" : parsed ? "parsed YES" : "NO"),
      "featureCount: " + String(sc && sc.featureCount || "undefined"),
      "features.length: " + String((gj && gj.features && gj.features.length) || (parsed && parsed.features && parsed.features.length) || "undefined"),
      "map canvas 2d: " + (ctx ? "YES" : "NO"),
      "drawn points: " + String(features.length),
    ];
    document.getElementById("dbg").textContent = lines.join("\\n");
  }

  function onResult(payload) {
    debugDump(payload && payload.method ? payload.method : "poll");
    const fc = geojsonFromToolResult(payload, window.openai);
    if (fc) loadFc(fc);
    return Boolean(fc);
  }

  function mercator(lon, lat) {
    const x = (Number(lon) + 180) / 360;
    const s = Math.sin((Number(lat) * Math.PI) / 180);
    const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
    return { x: x, y: y };
  }

  function layout() {
    const openai = window.openai || {};
    const maxH = Number(openai.maxHeight);
    const h = Math.max(320, Math.min(Number.isFinite(maxH) && maxH > 0 ? maxH : 520, 720));
    document.getElementById("wrap").style.height = h + "px";
    const stage = document.getElementById("stage");
    const rect = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.height = rect.height + "px";
    if (openai.notifyIntrinsicHeight) openai.notifyIntrinsicHeight({ height: h });
    draw();
  }

  function fit() {
    if (!features.length && !lines.length) {
      view = { x: mercator(-0.0998, 51.5714).x, y: mercator(-0.0998, 51.5714).y, scale: 22000 };
      return;
    }
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const p of features) {
      minX = Math.min(minX, p.mx); maxX = Math.max(maxX, p.mx);
      minY = Math.min(minY, p.my); maxY = Math.max(maxY, p.my);
    }
    for (const line of lines) {
      for (const p of line.pts) {
        minX = Math.min(minX, p.mx); maxX = Math.max(maxX, p.mx);
        minY = Math.min(minY, p.my); maxY = Math.max(maxY, p.my);
      }
    }
    view.x = (minX + maxX) / 2;
    view.y = (minY + maxY) / 2;
    const dx = Math.max(maxX - minX, 0.0002);
    const dy = Math.max(maxY - minY, 0.0002);
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 280;
    view.scale = 0.82 * Math.min(w / dx, h / dy);
  }

  function toScreen(p) {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    return {
      x: (p.mx - view.x) * view.scale + w / 2,
      y: (p.my - view.y) * view.scale + h / 2,
    };
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#071107";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(74,155,74,.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo((i / 8) * (w / dpr), 0);
      ctx.lineTo((i / 8) * (w / dpr), h / dpr);
      ctx.stroke();
    }
    for (const line of lines) {
      if (!line.pts.length) continue;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(201,168,76,.85)";
      ctx.lineWidth = 2.5;
      line.pts.forEach(function (p, i) {
        const s = toScreen(p);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.stroke();
    }
    for (const p of features) {
      const s = toScreen(p);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = "#071107";
      ctx.stroke();
    }
  }

  function showPop(p, sx, sy) {
    const bits = [p.venue, p.when, p.subtitle, p.trail].filter(Boolean);
    const link = p.url ? '<br/><a href="' + String(p.url) + '" target="_blank" rel="noreferrer">Open listing</a>' : "";
    pop.innerHTML = "<strong></strong>" + (bits.length ? "<br/>" : "") + bits.map(String).join(" · ") + link;
    pop.querySelector("strong").textContent = p.title;
    pop.style.display = "block";
    pop.style.left = Math.max(8, sx + 10) + "px";
    pop.style.top = Math.max(8, sy + 10) + "px";
  }

  function loadFc(fc) {
    if (!fc || !Array.isArray(fc.features)) return;
    features = [];
    lines = [];
    for (const f of fc.features) {
      const geom = f.geometry || {};
      const prop = f.properties || {};
      if (geom.type === "LineString" && Array.isArray(geom.coordinates)) {
        const pts = [];
        for (const pair of geom.coordinates) {
          if (!pair || pair.length < 2) continue;
          const m = mercator(pair[0], pair[1]);
          pts.push({ mx: m.x, my: m.y });
        }
        if (pts.length >= 2) {
          lines.push({ pts: pts, title: String(prop.title || prop.id || "walk") });
        }
        continue;
      }
      const c = geom.coordinates;
      if (!c || c.length < 2 || Array.isArray(c[0])) continue;
      const m = mercator(c[0], c[1]);
      features.push({
        mx: m.x,
        my: m.y,
        color: COLORS[prop.source] || "#d7ecd7",
        title: String(prop.title || prop.id || "pin"),
        venue: prop.venue,
        when: prop.when,
        subtitle: prop.subtitle,
        trail: prop.trail,
        url: prop.url,
      });
    }
    const layer = (fc.layerCounts && Object.keys(fc.layerCounts)[0]) || "layer";
    document.getElementById("status").textContent = "Field Guide · " + layer + " · " + features.length + " points";
    pop.style.display = "none";
    layout();
    fit();
    draw();
    debugDump("rendered");
  }

  canvas.addEventListener("pointerdown", function (e) {
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!drag) return;
    view.x = drag.vx - (e.clientX - drag.x) / view.scale;
    view.y = drag.vy - (e.clientY - drag.y) / view.scale;
    draw();
  });
  canvas.addEventListener("pointerup", function (e) {
    const moved = drag && (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 6);
    drag = null;
    if (moved) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let best = null;
    let bestD = 14;
    for (const p of features) {
      const s = toScreen(p);
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (best) showPop(best, x, y);
    else pop.style.display = "none";
  });
  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    view.scale = Math.max(80, Math.min(120000, view.scale * factor));
    draw();
  }, { passive: false });

  const bar = document.getElementById("bar");
  for (const layer of LAYERS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = layer;
    btn.onclick = async function () {
      document.getElementById("status").textContent = "Loading " + layer + "…";
      const openai = window.openai;
      try {
        if (openai && typeof openai.callTool === "function") {
          const next = await openai.callTool("field_guide_render_map", { layer: layer });
          if (!onResult(next)) onResult(openai);
          return;
        }
        const next = await request("tools/call", {
          name: "field_guide_render_map",
          arguments: { layer: layer },
        });
        onResult(next);
      } catch (err) {
        const msg = err && err.message ? err.message : "call failed";
        document.getElementById("status").textContent = "Keeping current points. Layer call: " + String(msg).slice(0, 72);
        onResult(openai);
      }
    };
    bar.appendChild(btn);
  }

  window.addEventListener("message", function (event) {
    const message = event.data;
    if (!message || typeof message !== "object") {
      onResult(message);
      return;
    }
    if (message.jsonrpc === "2.0" && message.id !== undefined && pending.has(message.id)) {
      const p = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) p.reject(message.error);
      else p.resolve(message.result);
      onResult(message.result);
      return;
    }
    onResult(message);
    if (message.params) onResult(message.params);
  });
  window.addEventListener("resize", layout);
  window.addEventListener("openai:set_globals", function () {
    layout();
    onResult(window.openai);
  });
  layout();
  onResult(window.openai);
  let tries = 0;
  const tick = setInterval(function () {
    tries += 1;
    if (onResult(window.openai) || tries > 40) {
      clearInterval(tick);
      if (tries > 40 && !features.length) {
        document.getElementById("status").textContent = "Tool result had no GeoJSON";
      }
    }
  }, 250);
})();
  </script>
</body>
</html>`
}

export const MAP_WIDGET_RESOURCE_META = {
  ui: {
    prefersBorder: true,
  },
  "openai/widgetPrefersBorder": true,
  "openai/widgetDescription": "Interactive Field Guide map of the requested layer. Drawn from GeoJSON in the tool result. No external map tiles.",
  "openai/ui": { availableDisplayModes: ["inline", "fullscreen"] },
} as const
