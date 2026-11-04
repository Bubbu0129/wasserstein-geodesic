"use strict";

// SciPy computes the geodesic once in Pyodide. JavaScript draws the
// precomputed frames and exports those same frames directly to GIF.

const $ = (id) => document.getElementById(id);
const state = {
  pyodide: null,
  catalog: null,
  data: null,
  source: null,
  target: null,
  docCache: new Map(),
  playing: false,
  animationId: null,
  busy: false,
};

function setStatus(message, kind = "loading") {
  $("runtime-status").textContent = message;
  $("status-dot").className = "status-dot" +
    (kind === "ready" ? " ready" : kind === "error" ? " error" : "");
}

function messageFromError(error) {
  const lines = String(error?.message || error).trim().split("\n");
  return lines.filter(Boolean).at(-1) || "Unknown error";
}

function configureGithubLink() {
  // Project Pages: https://USERNAME.github.io/wasserstein-geodesic-visualization/
  const match = window.location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
  const username = match ? match[1] : "YOUR-USERNAME";
  $("github-link").href =
    `https://github.com/${username}/wasserstein-geodesic-visualization`;
}

function docInfo(name) {
  if (!state.catalog || !Object.hasOwn(state.catalog, name)) return null;
  if (!state.docCache.has(name)) {
    state.pyodide.globals.set("help_family_name", name);
    const doc = state.pyodide.runPython("geodesic.distribution_help(help_family_name)");
    state.docCache.set(name, {
      notes: SciPyDoc.extractNotes(doc),
      defaults: SciPyDoc.extractExampleDefaults(doc, state.catalog[name]),
    });
  }
  return state.docCache.get(name);
}

function typesetNotes(side) {
  const node = $(`${side}-help-text`);
  if (window.MathJax?.typesetPromise) {
    MathJax.typesetPromise([node]).catch((error) => console.warn("Math rendering failed:", error));
  }
}

function updateDocumentation(side) {
  const name = $(`${side}-name`).value.trim();
  const valid = state.catalog && Object.hasOwn(state.catalog, name);
  const link = $(`${side}-docs`);
  const details = $(`${side}-help`);
  link.hidden = !valid;
  details.hidden = !valid;
  details.open = false;
  const content = $(`${side}-help-text`);
  content.replaceChildren();
  if (valid) {
    const path = `scipy.stats.${encodeURIComponent(name)}`;
    link.href = `https://docs.scipy.org/doc/scipy/reference/generated/${path}.html#${path}`;
    link.textContent = `${path} documentation ↗`;
    SciPyDoc.renderNotes(content, docInfo(name).notes);
  }
}

function chooseFamily(side) {
  renderFields(side);
  updateDocumentation(side);
}

function fieldsFor(side) {
  return $(`${side}-fields`);
}

function saveFieldState(side) {
  const parent = fieldsFor(side);
  const previousName = parent.dataset.family;
  if (!previousName) return;
  const params = {};
  for (const el of parent.querySelectorAll("input[data-param]")) {
    params[el.dataset.param] = el.value;
  }
  parent._previous = { name: previousName, params };
}

function renderFields(side, explicitParams = null) {
  const name = $(`${side}-name`).value.trim();
  const parent = fieldsFor(side);
  if (!state.catalog) return;
  if (parent.dataset.family === name && explicitParams === null) return;
  if (parent.dataset.family !== name) saveFieldState(side);
  parent.replaceChildren();
  parent.dataset.family = name;

  if (!Object.hasOwn(state.catalog, name)) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "Enter a known continuous scipy.stats family.";
    parent.append(hint);
    return;
  }

  const shapes = state.catalog[name];
  const cached = parent._previous?.name === name ? parent._previous.params : {};
  const values = explicitParams || cached;
  const defaults = docInfo(name).defaults;
  for (const param of [...shapes, "loc", "scale"]) {
    const field = document.createElement("div");
    field.className = "field";
    const label = document.createElement("label");
    const input = document.createElement("input");
    const id = `${side}-${param}`;
    label.htmlFor = id;
    label.textContent = param;
    input.id = id;
    input.dataset.param = param;
    input.type = "number";
    input.step = "any";
    input.required = true;
    const initial = param === "loc" ? 0 : param === "scale" ? 1 : defaults[param] ?? "";
    input.value = Object.hasOwn(values, param) ? values[param] : initial;
    field.append(label, input);
    parent.append(field);
  }
}

function assignDistribution(side, spec) {
  $(`${side}-name`).value = spec.name;
  renderFields(side, spec.params);
  updateDocumentation(side);
}

function readDistribution(side) {
  const name = $(`${side}-name`).value.trim();
  if (!Object.hasOwn(state.catalog, name)) {
    throw new Error(`Unknown distribution ${name || "(empty)"}. Choose a name from the suggestions.`);
  }
  const params = {};
  for (const input of fieldsFor(side).querySelectorAll("input[data-param]")) {
    if (input.value.trim() === "") {
      throw new Error(`Missing ${input.dataset.param} parameter for ${name}`);
    }
    const n = Number(input.value);
    if (!Number.isFinite(n)) {
      throw new Error(`Invalid ${input.dataset.param} parameter for ${name}`);
    }
    params[input.dataset.param] = n;
  }
  if (params.scale <= 0) throw new Error(`${name}: scale must be positive`);
  return { name, params };
}

function stopPlayback() {
  if (state.animationId !== null) cancelAnimationFrame(state.animationId);
  state.animationId = null;
  state.playing = false;
  $("play").innerHTML = "▶ &nbsp; Play";
}

function drawChart(frameOverride = null, canvas = $("plot"), exportWidth = null, exportHeight = null) {
  const box = canvas.getBoundingClientRect();
  const w = exportWidth ?? box.width;
  const h = exportHeight ?? box.height;
  if (!w || !h) return;
  const dpr = exportWidth === null ? Math.max(1, window.devicePixelRatio || 1) : 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (exportWidth !== null) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
  }
  const margin = { top: 16, right: 16, bottom: 36, left: 52 };
  const pw = w - margin.left - margin.right;
  const ph = h - margin.top - margin.bottom;
  if (pw < 20 || ph < 20) return;
  const data = state.data;
  const xmin = data ? data.x[0] : -4;
  const xmax = data ? data.x.at(-1) : 4;
  const ymax = data ? data.ymax : 1;
  const X = (x) => margin.left + (x - xmin) / (xmax - xmin) * pw;
  const Y = (y) => margin.top + ph * (1 - y / ymax);

  ctx.font = "11px ui-sans-serif, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i++) {
    const value = ymax * i / 4;
    const yy = Y(value);
    ctx.beginPath(); ctx.strokeStyle = "#e9eef1"; ctx.lineWidth = 1;
    ctx.moveTo(margin.left, yy); ctx.lineTo(w - margin.right, yy); ctx.stroke();
    ctx.fillStyle = "#9ca7af";
    ctx.fillText(Number(value.toPrecision(2)).toString(), margin.left - 10, yy);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i <= 5; i++) {
    const value = xmin + i / 5 * (xmax - xmin);
    ctx.fillStyle = "#9ca7af";
    ctx.fillText(Number(value.toPrecision(3)).toString(), X(value), h - margin.bottom + 11);
  }
  ctx.beginPath(); ctx.strokeStyle = "#cbd5dc";
  ctx.moveTo(margin.left, Y(0)); ctx.lineTo(w - margin.right, Y(0)); ctx.stroke();

  if (!data) {
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "13px ui-sans-serif, sans-serif";
    ctx.fillStyle = "#8b9ba6";
    ctx.fillText("Geodesic will appear here", margin.left + pw / 2, margin.top + ph / 2);
    return;
  }

  const frameIndex = frameOverride ?? Math.round(Number($("time").value) / 100 * (data.frames.length - 1));
  const current = data.frames[frameIndex];
  const path = (arr, color, dash = [], width = 2) => {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.setLineDash(dash);
    for (let j = 0; j < data.x.length; j++) {
      const px = X(data.x[j]), py = Y(arr[j]);
      if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke(); ctx.setLineDash([]);
  };

  // Fill the moving distribution; draw dashed stationary references above it.
  ctx.beginPath();
  ctx.moveTo(X(data.x[0]), Y(0));
  for (let j = 0; j < data.x.length; j++) ctx.lineTo(X(data.x[j]), Y(current[j]));
  ctx.lineTo(X(data.x.at(-1)), Y(0));
  ctx.closePath();
  ctx.fillStyle = "rgba(34, 93, 117, 0.085)"; ctx.fill();

  path(data.frames[0], "#6582ac", [7, 6], 1.6);
  path(data.frames.at(-1), "#d18c6d", [7, 6], 1.6);
  path(current, "#225d75", [], 2.7);
  if (exportWidth !== null) {
    ctx.font = "bold 14px ui-sans-serif, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#225d75";
    ctx.fillText(`t = ${data.times[frameIndex].toFixed(2)}`, w - margin.right - 2, 6);
  }
}

function seekTime(value) {
  $("time").value = String(value);
  $("time-display").textContent = (Number(value) / 100).toFixed(2);
  drawChart();
}

function startPlayback() {
  if (!state.data) return;
  stopPlayback();
  const duration = Number($("duration").value);
  if (!Number.isFinite(duration) || duration < 1 || duration > 30) {
    setStatus("Duration must be between 1 and 30 seconds", "error");
    return;
  }
  const startValue = Number($("time").value) >= 100 ? 0 : Number($("time").value);
  seekTime(startValue);
  state.playing = true;
  $("play").innerHTML = "Ⅱ &nbsp; Pause";
  const start = performance.now();
  const run = (now) => {
    if (!state.playing) return;
    const value = Math.min(100, startValue + 100 * (now - start) / (duration * 1000));
    seekTime(Math.round(value));
    if (value < 100) state.animationId = requestAnimationFrame(run);
    else stopPlayback();
  };
  state.animationId = requestAnimationFrame(run);
}

async function computeGeodesic() {
  if (!state.pyodide || state.busy) return;
  // An untouched form is a no-op, not a validation error.
  if (!$("source-name").value.trim() || !$("target-name").value.trim()) return;
  let source, target;
  try { source = readDistribution("source"); target = readDistribution("target"); }
  catch (error) { setStatus(messageFromError(error), "error"); return; }
  stopPlayback();
  state.busy = true;
  $("compute").disabled = true;
  $("export").disabled = true;
  setStatus("Computing geodesic…");
  // Yield so the busy state is painted before Python runs synchronously.
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  try {
    state.pyodide.globals.set("source_spec", JSON.stringify(source));
    state.pyodide.globals.set("target_spec", JSON.stringify(target));
    const result = state.pyodide.runPython("geodesic.compute_geodesic_json(source_spec, target_spec)");
    state.data = JSON.parse(result);
    state.source = source;
    state.target = target;
    $("distance").textContent = state.data.w2.toPrecision(5);
    $("time").disabled = false;
    $("play").disabled = false;
    $("export").disabled = false;
    seekTime(0);
    setStatus("Python + SciPy ready", "ready");
  } catch (error) {
    console.error(error);
    setStatus(messageFromError(error), "error");
  } finally {
    state.busy = false;
    $("compute").disabled = false;
  }
}

async function exportGif() {
  if (state.busy || !state.data) return;
  stopPlayback();
  const duration = Number($("duration").value);
  if (!Number.isFinite(duration) || duration < 1 || duration > 30) {
    setStatus("Duration must be between 1 and 30 seconds", "error");
    return;
  }
  state.busy = true;
  $("export").disabled = true;
  $("compute").disabled = true;
  try {
    // Reuse precisely the frames produced when Compute was clicked.
    // No SciPy, Pillow, or Matplotlib work occurs during export.
    const { frames } = state.data;
    const width = 800, height = 440;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const encoder = new GifEncoder(width, height);
    const frameDelay = duration * 100 / (frames.length - 1);

    for (let i = 0; i < frames.length; i++) {
      drawChart(i, canvas, width, height);
      encoder.addFrame(ctx.getImageData(0, 0, width, height), frameDelay);
      if (i % 8 === 0) {
        setStatus(`Encoding GIF in JavaScript… ${i + 1}/${frames.length}`);
        // Give the UI a chance to update between groups of frames.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    const url = URL.createObjectURL(encoder.finish());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wasserstein_geodesic.gif";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setStatus("GIF exported · Python + SciPy ready", "ready");
  } catch (error) {
    console.error(error);
    setStatus("GIF export failed: " + messageFromError(error), "error");
  } finally {
    state.busy = false;
    $("export").disabled = false;
    $("compute").disabled = false;
  }
}

function attachEvents() {
  for (const side of ["source", "target"]) {
    const input = $(`${side}-name`);
    input.addEventListener("input", () => chooseFamily(side));
    input.addEventListener("change", () => chooseFamily(side));
    $(`${side}-help`).addEventListener("toggle", (event) => {
      if (event.target.open) typesetNotes(side);
    });
  }
  $("compute").addEventListener("click", computeGeodesic);
  $("export").addEventListener("click", exportGif);
  $("time").addEventListener("input", (e) => { stopPlayback(); seekTime(e.target.value); });
  $("play").addEventListener("click", () => state.playing ? stopPlayback() : startPlayback());
  $("swap").addEventListener("click", async () => {
    if (!state.catalog) return;
    if (!$("source-name").value.trim() || !$("target-name").value.trim()) return;
    try {
      const source = readDistribution("source");
      const target = readDistribution("target");
      assignDistribution("source", target);
      assignDistribution("target", source);
      await computeGeodesic();
    } catch (error) { setStatus(messageFromError(error), "error"); }
  });
  new ResizeObserver(() => drawChart()).observe($("plot"));
}

async function init() {
  configureGithubLink();
  attachEvents();
  drawChart();
  try {
    if (!window.loadPyodide) throw new Error("Could not load Pyodide from CDN");
    state.pyodide = await loadPyodide();
    setStatus("Loading NumPy and SciPy…");
    await state.pyodide.loadPackage(["numpy", "scipy"]);
    state.pyodide.FS.mkdirTree("/home/pyodide/wasserstein");
    for (const file of ["__init__.py", "geodesic.py"]) {
      const response = await fetch(`wasserstein/${file}`);
      if (!response.ok) throw new Error(`Cannot fetch wasserstein/${file} (HTTP ${response.status})`);
      state.pyodide.FS.writeFile(
        `/home/pyodide/wasserstein/${file}`,
        await response.text(),
        { encoding: "utf8" }
      );
    }
    state.pyodide.runPython(
      "import importlib; importlib.invalidate_caches(); from wasserstein import geodesic"
    );
    state.catalog = JSON.parse(state.pyodide.runPython("geodesic.distribution_catalog_json()"));
    const names = Object.keys(state.catalog).sort();
    const datalist = $("families");
    datalist.replaceChildren(...names.map((name) => {
      const option = document.createElement("option");
      option.value = name;
      return option;
    }));
    $("family-count").textContent = `${names.length} SciPy continuous distributions available`;
    $("compute").disabled = false;
    setStatus("Python + SciPy ready", "ready");
  } catch (error) {
    console.error(error);
    setStatus(messageFromError(error), "error");
    $("family-count").textContent = "Initialization failed. Check network access and the browser console.";
  }
}

init();
