export const SIT_WIDGET_URI = "ui://field-guide/sit/v1.html"
export const SIT_WIDGET_URIS = [SIT_WIDGET_URI] as const
export const SIT_WIDGET_MIME = "text/html;profile=mcp-app"

export function sitWidgetHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    html,body{margin:0;background:#071107;color:#d7ecd7;font-family:Georgia,serif}
    #art{display:block;margin:.8rem auto;width:92px;height:92px}
    #bar{padding:.6rem .75rem}
    p{margin:0 0 .45rem;font-size:.85rem}
    button{padding:.55rem .8rem;background:#0c1a0c;border:1px solid rgba(201,168,76,.55);color:#c9a84c;font:inherit}
    button:disabled{opacity:.45}
  </style>
</head>
<body>
  <img id="art" alt=""/>
  <div id="bar">
    <p id="title">Sit</p>
    <p id="status">Stay on the lawn. Placeholder audio loops until the sit is complete.</p>
    <p id="meter"></p>
    <button type="button" id="done" disabled>Complete sit</button>
  </div>
  <script>
(function () {
  const status = document.getElementById("status");
  const meter = document.getElementById("meter");
  const btn = document.getElementById("done");
  const art = document.getElementById("art");
  const title = document.getElementById("title");
  const pending = new Map();
  let nextId = 1;
  let pin = { id: "sit-still-stone", title: "Still Stone", lat: 51.5728, lon:  -0.09855, radiusM: 45, requiredSeconds: 90, audioUrl: "/audio/day-after-tomorrow-placeholder.wav", imageUrl: "/icons/sit-stone.svg" };
  let busy = false;
  let dwell = 0;
  let played = 0;
  let lastAudio = 0;
  let skip = false;
  let lastTick = Date.now();
  let lastGps = null;
  const audio = new Audio();

  function request(method, params) {
    const id = nextId++;
    window.parent.postMessage({ jsonrpc: "2.0", id: id, method: method, params: params }, "*");
    return new Promise(function (resolve, reject) {
      const timer = setTimeout(function () {
        pending.delete(id);
        reject(new Error("Host did not answer " + method));
      }, 20000);
      pending.set(id, { resolve: function (v) { clearTimeout(timer); resolve(v); }, reject: function (e) { clearTimeout(timer); reject(e); } });
    });
  }

  function walkPin(node, seen) {
    if (!node || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    const pinId = typeof node.pinId === "string" ? node.pinId.trim() : "";
    if (pinId) {
      pin.id = pinId;
      if (typeof node.title === "string" && node.title.trim()) pin.title = node.title;
      if (typeof node.lat === "number") pin.lat = node.lat;
      if (typeof node.lon === "number") pin.lon = node.lon;
      if (typeof node.radiusM === "number") pin.radiusM = node.radiusM;
      if (typeof node.requiredSeconds === "number") pin.requiredSeconds = node.requiredSeconds;
      if (typeof node.audioUrl === "string") pin.audioUrl = node.audioUrl;
      if (typeof node.imageUrl === "string") pin.imageUrl = node.imageUrl;
    }
    const nested = [node.structuredContent, node.toolOutput, node.result, node.params, node._meta];
    for (let i = 0; i < nested.length; i++) walkPin(nested[i], seen);
  }

  function ingest(payload) {
    walkPin(payload, new Set());
    if (window.openai) walkPin(window.openai, new Set());
    title.textContent = pin.title;
    art.src = pin.imageUrl || "/icons/sit-stone.svg";
    if (pin.audioUrl && audio.src.indexOf(pin.audioUrl) < 0) {
      audio.src = pin.audioUrl;
      audio.loop = true;
      audio.play().catch(function () {});
    }
  }

  function dist(a, b) {
    const R = 6371000;
    const p1 = a.lat * Math.PI/180, p2 = b.lat * Math.PI/180;
    const dP = (b.lat-a.lat)*Math.PI/180, dL = (b.lon-a.lon)*Math.PI/180;
    const x = Math.sin(dP/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dL/2)**2;
    return 2*R*Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  }

  function inRadius() {
    if (!lastGps) return false;
    return dist(lastGps, { lat: pin.lat, lon: pin.lon }) <= pin.radiusM;
  }

  function gate() {
    if (skip) return "Do not skip the sit audio.";
    if (dwell + 0.5 < pin.requiredSeconds) return "Sit " + Math.floor(dwell) + "/" + pin.requiredSeconds + "s";
    if (played + 0.5 < pin.requiredSeconds * 0.9) return "Listen " + Math.floor(played) + "s";
    return "";
  }

  setInterval(function () {
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    if (inRadius()) dwell += dt;
    if (audio && !audio.paused) {
      const t = audio.currentTime;
      const d = t - lastAudio;
      if (d > 2.5) skip = true;
      else if (d >= 0) played += d;
      lastAudio = t;
    }
    const blocked = gate();
    meter.textContent = Math.floor(dwell) + "s sit · " + Math.floor(played) + "s audio";
    btn.disabled = busy || Boolean(blocked) || !inRadius();
    if (!busy) status.textContent = !lastGps ? "Need phone GPS on the lawn." : (blocked || "Ready to mint " + pin.title);
  }, 250);

  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(function (pos) {
      lastGps = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracyM: pos.coords.accuracy };
    }, function () {}, { enableHighAccuracy: true, maximumAge: 2000 });
  }

  async function callCheckIn(args) {
    const openai = window.openai;
    if (openai && typeof openai.callTool === "function") return openai.callTool("field_guide_check_in", args);
    return request("tools/call", { name: "field_guide_check_in", arguments: args });
  }

  btn.onclick = async function () {
    if (busy || gate()) return;
    busy = true;
    btn.disabled = true;
    const args = { pinId: pin.id, dwellSeconds: dwell, audioSecondsPlayed: played, skipDetected: skip };
    if (lastGps) { args.lat = lastGps.lat; args.lon = lastGps.lon; args.accuracyM = lastGps.accuracyM; }
    try {
      const res = await callCheckIn(args);
      status.textContent = res && res.message ? String(res.message) : "Sit complete";
    } catch (err) {
      status.textContent = err && err.message ? err.message : "check-in failed";
    } finally {
      busy = false;
    }
  };

  window.addEventListener("message", function (event) {
    const message = event.data;
    if (!message || typeof message !== "object") return;
    if (message.jsonrpc === "2.0" && message.id !== undefined && pending.has(message.id)) {
      const p = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) p.reject(new Error(message.error.message || "rpc error"));
      else p.resolve(message.result);
      return;
    }
    ingest(message);
  });
  ingest(window.openai);
})();
  </script>
</body>
</html>`
}

export const SIT_WIDGET_RESOURCE_META = {
  ui: { prefersBorder: true },
  "openai/widgetPrefersBorder": true,
  "openai/widgetDescription": "Day After Tomorrow sit: stay in radius, listen, then mint the themed token. Companion voice is in field_guide_context.",
  "openai/ui": { availableDisplayModes: ["inline", "fullscreen"] },
} as const
