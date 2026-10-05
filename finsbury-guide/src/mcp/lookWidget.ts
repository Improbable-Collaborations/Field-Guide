export const LOOK_WIDGET_URI = "ui://field-guide/look/v3.html"
export const LOOK_WIDGET_URIS = [
  "ui://field-guide/look/v1.html",
  "ui://field-guide/look/v2.html",
  LOOK_WIDGET_URI,
] as const
export const LOOK_WIDGET_MIME = "text/html;profile=mcp-app"

export function lookWidgetHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    html,body{margin:0;background:#071107;color:#d7ecd7;font-family:Georgia,serif}
    #stage{position:relative;height:220px;overflow:hidden;background:#041004}
    #beacon{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:88px;height:88px;border-radius:50%;border:3px solid #c9a84c;background:rgba(12,26,12,.7);display:flex;align-items:center;justify-content:center;font-size:.75rem;letter-spacing:.08em;text-align:center;padding:.4rem}
    #bar{padding:.6rem .75rem}
    #status{font-size:.85rem;margin:0 0 .5rem}
    button{padding:.55rem .8rem;background:#0c1a0c;border:1px solid rgba(201,168,76,.55);color:#c9a84c;font:inherit}
    button:disabled{opacity:.45}
  </style>
</head>
<body>
  <div id="stage"><div id="beacon">LOOK</div></div>
  <div id="bar">
    <p id="status">Tap I'm here.</p>
    <button type="button" id="here">I'm here</button>
  </div>
  <script>
(function () {
  const status = document.getElementById("status");
  const btn = document.getElementById("here");
  const beacon = document.getElementById("beacon");
  const pending = new Map();
  let nextId = 1;
  let pin = { id: "hitchhiker-stoop", title: "Hitchhiker House stoop", lat: 51.563743, lon: -0.105181, radiusM: 40 };
  let busy = false;

  function request(method, params) {
    const id = nextId++;
    window.parent.postMessage({ jsonrpc: "2.0", id: id, method: method, params: params }, "*");
    return new Promise(function (resolve, reject) {
      const timer = setTimeout(function () {
        pending.delete(id);
        reject(new Error("Host did not answer " + method));
      }, 20000);
      pending.set(id, {
        resolve: function (v) { clearTimeout(timer); resolve(v); },
        reject: function (e) { clearTimeout(timer); reject(e); },
      });
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
    }
    const nested = [node.structuredContent, node.toolOutput, node.result, node.params, node._meta];
    for (let i = 0; i < nested.length; i++) walkPin(nested[i], seen);
    if (Array.isArray(node.content)) {
      for (let i = 0; i < node.content.length; i++) {
        const item = node.content[i];
        if (item && typeof item.text === "string" && item.text.trim().startsWith("{")) {
          try { walkPin(JSON.parse(item.text), seen); } catch (e) {}
        }
      }
    }
  }

  function ingest(payload) {
    walkPin(payload, new Set());
    if (window.openai) walkPin(window.openai, new Set());
    beacon.textContent = pin.title;
    if (!busy) status.textContent = pin.title + " · tap I'm here";
  }

  function readGps() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) {
        reject(new Error("no-geo"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracyM: pos.coords.accuracy });
        },
        function () { reject(new Error("no-geo")); },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 }
      );
    });
  }

  function resultText(res) {
    if (!res) return "checked in";
    if (typeof res === "string") return res.slice(0, 220);
    if (res.message) return String(res.message).slice(0, 220);
    if (Array.isArray(res.content) && res.content[0] && res.content[0].text) return String(res.content[0].text).slice(0, 220);
    try { return JSON.stringify(res).slice(0, 220); } catch (e) { return "checked in"; }
  }

  async function callCheckIn(args) {
    const openai = window.openai;
    if (openai && typeof openai.callTool === "function") {
      return openai.callTool("field_guide_check_in", args);
    }
    return request("tools/call", { name: "field_guide_check_in", arguments: args });
  }

  async function tellChat(text) {
    const openai = window.openai;
    if (openai && typeof openai.sendFollowUpMessage === "function") {
      await openai.sendFollowUpMessage({ prompt: text });
      return;
    }
    await request("ui/message", { role: "user", content: [{ type: "text", text: text }] }).catch(function () {});
  }

  btn.onclick = async function () {
    if (busy) return;
    busy = true;
    btn.disabled = true;
    status.textContent = "Checking in…";
    const args = { pinId: pin.id };
    try {
      try {
        const gps = await readGps();
        args.lat = gps.lat;
        args.lon = gps.lon;
        args.accuracyM = gps.accuracyM;
      } catch (geoErr) {}
      const res = await callCheckIn(args);
      status.textContent = resultText(res);
    } catch (err) {
      const msg = err && err.message ? err.message : "check-in failed";
      try {
        await tellChat("Call field_guide_check_in now with pinId " + pin.id + " only. Do not invent coordinates.");
        status.textContent = "Asked ChatGPT to check in " + pin.id + ". " + msg;
      } catch (e2) {
        status.textContent = msg;
      }
    } finally {
      busy = false;
      btn.disabled = false;
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
    if (message.method === "ui/notifications/tool-result" || message.method === "ui/notifications/tool-input") {
      ingest(message.params || message);
      return;
    }
    ingest(message);
  });
  window.addEventListener("openai:set_globals", function () { ingest(window.openai); });
  ingest(window.openai);
  let tries = 0;
  const tick = setInterval(function () {
    tries += 1;
    ingest(window.openai);
    if (tries > 40) clearInterval(tick);
  }, 250);
})();
  </script>
</body>
</html>`
}

export const LOOK_WIDGET_RESOURCE_META = {
  ui: { prefersBorder: true },
  "openai/widgetPrefersBorder": true,
  "openai/widgetDescription": "Field Guide Look: tap I'm here to check in with phone GPS.",
  "openai/ui": { availableDisplayModes: ["inline", "fullscreen"] },
} as const
