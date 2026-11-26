/*
 * Baysöz Yazılım — Deterministic 100-run VM verification for the WebGL inspector.
 * Contact: baysozlabs@proton.me
 *
 * The harness loads webgl-3d-viewer.js in a fresh vm context per iteration. A
 * dependency-free DOM shim with an in-memory 2D canvas and a deterministic
 * Three.js r160 stub exercise material creation, texture painting, studio
 * assets, controls, updaters, and teardown without a GPU or network access.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createDocument, createConsoleSpy } from "./dom-shim.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = fs.readFileSync(path.join(ROOT, "webgl-3d-viewer.js"), "utf8");
const RESULTS_PATH = path.join(ROOT, "artifacts", "webgl-stress-results.jsonl");
const TOTAL_ITERATIONS = 100;
const SEED = 20261122;
const EXPECTED_COUNTS = { 1: 36, 2: 43, 3: 60, 4: 50, 5: 44, 6: 58, 7: 50, 8: 60 };
const PBR_IDS = new Set(["1", "2", "3", "4"]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildPlan() {
  const scenarios = [];
  const classes = ["valid", "empty", "malformed", "boundary", "mutation"];
  const allocation = { valid: 40, empty: 12, malformed: 18, boundary: 20, mutation: 10 };
  for (const scenarioClass of classes) {
    for (let index = 0; index < allocation[scenarioClass]; index += 1) {
      scenarios.push({ iteration: scenarios.length + 1, scenarioClass, variant: index });
    }
  }
  let seed = SEED >>> 0;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let index = scenarios.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const temporary = scenarios[index];
    scenarios[index] = scenarios[swap];
    scenarios[swap] = temporary;
  }
  return scenarios;
}

function installCanvasFactory(doc, stats) {
  const nativeCreate = doc.createElement.bind(doc);
  doc.createElement = (tagName) => {
    const element = nativeCreate(tagName);
    if (String(tagName).toLowerCase() !== "canvas") {
      return element;
    }
    element.width = 0;
    element.height = 0;
    element.getContext = (kind) => {
      if (kind === "webgl" || kind === "webgl2") {
        return {
          getExtension() {
            return { loseContext() {} };
          }
        };
      }
      if (kind !== "2d") {
        return null;
      }
      const context = {
        ops: [],
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        font: "",
        textAlign: "left",
        textBaseline: "alphabetic",
        clearRect(...args) { this.ops.push(["clearRect", ...args]); },
        fillRect(...args) { this.ops.push(["fillRect", ...args]); },
        strokeRect(...args) { this.ops.push(["strokeRect", ...args]); },
        fillText(...args) { this.ops.push(["fillText", ...args]); },
        beginPath() { this.ops.push(["beginPath"]); },
        closePath() { this.ops.push(["closePath"]); },
        arc(...args) { this.ops.push(["arc", ...args]); },
        fill() { this.ops.push(["fill"]); },
        moveTo(...args) { this.ops.push(["moveTo", ...args]); },
        lineTo(...args) { this.ops.push(["lineTo", ...args]); },
        stroke() { this.ops.push(["stroke"]); },
        save() { this.ops.push(["save"]); },
        restore() { this.ops.push(["restore"]); },
        createRadialGradient(...args) {
          this.ops.push(["radialGradient", ...args]);
          return { addColorStop() {} };
        },
        createLinearGradient(...args) {
          this.ops.push(["linearGradient", ...args]);
          return { addColorStop() {} };
        }
      };
      stats.canvasContexts.push(context);
      return context;
    };
    return element;
  };
}

function createThreeStub(stats) {
  class Vec3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(value) { this.x = value.x; this.y = value.y; this.z = value.z; return this; }
  }

  class Object3D {
    constructor() {
      this.position = new Vec3();
      this.rotation = new Vec3();
      this.scale = new Vec3(1, 1, 1);
      this.up = new Vec3(0, 1, 0);
      this.userData = {};
      this.children = [];
      this.visible = true;
    }
    add(child) { this.children.push(child); return this; }
    remove(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      return this;
    }
    traverse(callback) {
      callback(this);
      for (const child of this.children) {
        if (typeof child.traverse === "function") child.traverse(callback);
        else callback(child);
      }
    }
    lookAt() {}
    updateProjectionMatrix() {}
  }

  class Geometry {
    constructor(...args) { this.args = args; this.disposed = false; stats.geometries.push(this); }
    dispose() { if (!this.disposed) { this.disposed = true; stats.geometryDisposals += 1; } }
  }

  class Material {
    constructor(params = {}) {
      Object.assign(this, params);
      this.disposed = false;
      this.emissive = params.emissive ?? 0;
      this.emissiveIntensity = params.emissiveIntensity ?? 0;
      stats.materials.push(this);
    }
    clone() {
      const copy = new this.constructor({});
      Object.assign(copy, this);
      copy.disposed = false;
      return copy;
    }
    dispose() { if (!this.disposed) { this.disposed = true; stats.materialDisposals += 1; } }
  }

  class PhysicalMaterial extends Material {
    constructor(params = {}) { super(params); this.isPhysical = true; stats.physicalMaterials += 1; }
  }

  class Texture {
    constructor(image) {
      this.image = image;
      this.disposed = false;
      this.needsUpdate = false;
      stats.textures.push(this);
    }
    dispose() { if (!this.disposed) { this.disposed = true; stats.textureDisposals += 1; } }
  }

  class Renderer {
    constructor(params) {
      this.domElement = params.canvas;
      this.shadowMap = { enabled: false, type: 0 };
      this.capabilities = { getMaxAnisotropy: () => 8 };
      stats.renderers += 1;
    }
    setPixelRatio() {}
    setSize() {}
    setClearColor() {}
    render() { stats.renderCalls += 1; }
    dispose() { stats.rendererDisposals += 1; }
    forceContextLoss() {}
  }

  class Light extends Object3D {
    constructor(color, intensity) {
      super();
      this.color = color;
      this.intensity = intensity;
      this.shadow = { mapSize: { set() {} }, bias: 0, normalBias: 0 };
      this.castShadow = false;
    }
  }

  class PMREMGenerator {
    constructor() {}
    fromEquirectangular() {
      stats.pmremConversions += 1;
      const targetTexture = new Texture(null);
      return {
        texture: targetTexture,
        dispose() { targetTexture.dispose(); }
      };
    }
    dispose() { stats.pmremDisposals += 1; }
  }

  return {
    REVISION: "160",
    SRGBColorSpace: "srgb",
    ACESFilmicToneMapping: 1,
    PCFSoftShadowMap: 2,
    DoubleSide: 2,
    FrontSide: 0,
    EquirectangularReflectionMapping: 303,
    LinearMipmapLinearFilter: 1008,
    LinearFilter: 1006,
    WebGLRenderer: Renderer,
    Scene: class Scene extends Object3D { constructor() { super(); this.environment = null; } },
    PerspectiveCamera: class PerspectiveCamera extends Object3D {
      constructor(fov, aspect, near, far) { super(); Object.assign(this, { fov, aspect, near, far }); }
    },
    Group: class Group extends Object3D {},
    Mesh: class Mesh extends Object3D {
      constructor(geometry, material) {
        super();
        this.geometry = geometry;
        this.material = material;
        stats.createdMeshes.push(this);
      }
    },
    Vector3: Vec3,
    BoxGeometry: Geometry,
    CylinderGeometry: Geometry,
    SphereGeometry: Geometry,
    TorusGeometry: Geometry,
    ConeGeometry: Geometry,
    PlaneGeometry: Geometry,
    CircleGeometry: Geometry,
    MeshStandardMaterial: Material,
    MeshPhysicalMaterial: PhysicalMaterial,
    CanvasTexture: Texture,
    PMREMGenerator,
    AmbientLight: Light,
    HemisphereLight: Light,
    DirectionalLight: Light,
    PointLight: Light
  };
}

function createFixture(scenario, stats) {
  const doc = createDocument();
  doc.hidden = false;
  doc.readyState = "complete";
  installCanvasFactory(doc, stats);

  const modal = doc.createElement("div");
  modal.id = "modalBox";
  modal.insertBefore = (child) => {
    modal.children.unshift(child);
    child.parentNode = modal;
    return child;
  };
  const gallery = doc.createElement("div");
  gallery.id = "modalGallery";
  modal.appendChild(gallery);
  const legacy = doc.createElement("div");
  legacy.setAttribute("data-product-viewer", "");
  modal.appendChild(legacy);
  doc.body.appendChild(modal);

  return { doc, modal, gallery, legacy };
}

function createWindow(stats, THREE, reducedMotion) {
  const frames = [];
  const timers = [];
  let frameId = 0;
  const listeners = new Map();
  const win = {
    THREE,
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    removeEventListener(type, handler) {
      const entries = listeners.get(type) || [];
      const index = entries.indexOf(handler);
      if (index >= 0) entries.splice(index, 1);
    },
    emit(type, event) {
      for (const handler of (listeners.get(type) || []).slice()) handler(event);
    },
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },
    clearTimeout() {},
    matchMedia() {
      return {
        matches: reducedMotion,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {}
      };
    },
    requestAnimationFrame(callback) {
      frameId += 1;
      frames.push({ id: frameId, callback });
      return frameId;
    },
    cancelAnimationFrame(id) {
      const index = frames.findIndex((entry) => entry.id === id);
      if (index >= 0) frames.splice(index, 1);
    },
    ResizeObserver: class ResizeObserver {
      observe() {}
      disconnect() {}
    }
  };
  return { win, frames, timers };
}

function driveFrame(frames, timestamp) {
  if (frames.length === 0) {
    return false;
  }
  const pending = frames.shift();
  pending.callback(timestamp);
  return true;
}

function verifyValidRun(scenario, id, api, test, fixture, stats, frames) {
  const opened = api.open(id);
  assert(opened === true, "open must accept a valid catalog id");
  const stateAfterOpen = api.getState();
  assert(stateAfterOpen.phase === "ready", "session must reach ready phase");
  assert(stateAfterOpen.sessionActive === true, "session must be active after open");
  assert(stats.renderers === 1, "exactly one renderer must be created");

  const descriptors = test.MODEL_REGISTRY[id].descriptors;
  assert(descriptors.length === EXPECTED_COUNTS[id], "mesh count must match the registry contract");
  assert(test.validateModelRegistry(test.MODEL_REGISTRY) === true, "registry must validate");

  const group = Object.create(null);
  for (const mesh of stats.createdMeshes) {
    if (mesh.name) group[mesh.name] = mesh;
  }
  assert(Object.keys(group).length === descriptors.length, "all meshes must be instantiated");

  if (PBR_IDS.has(id)) {
    assert(stats.physicalMaterials > 0, "enhanced catalog must use physical PBR materials");
    assert(stats.textures.length > 0, "enhanced catalog must create canvas textures");
    assert(stats.pmremConversions > 0, "enhanced catalog must build a studio environment");
    assert(stats.canvasContexts.every((context) => context.ops.length > 0), "canvas recipes must paint real draw operations");
    const decals = descriptors.filter((entry) => entry.style && entry.style.decal);
    assert(decals.length > 0, "enhanced catalog must contain brand decals");
    for (const entry of decals) {
      const mesh = group[entry.name];
      assert(mesh && mesh.userData.decal === entry.style.decal, "decal mesh must bind its canvas recipe");
      assert(mesh.material.map instanceof stats.textureClass, "decal material must carry a canvas map");
    }
  } else {
    assert(stats.physicalMaterials === 0, "untouched catalog must keep the standard material path");
    assert(stats.textures.length === 0, "untouched catalog must not create canvas textures");
    assert(stats.pmremConversions === 0, "untouched catalog must not build an environment");
  }

  assert(driveFrame(frames, 1000), "first animation frame must be scheduled");
  assert(stats.renderCalls === 1, "first frame must render once");
  assert(driveFrame(frames, 1016), "second animation frame must be scheduled");

  const stage = fixture.modal.querySelector(".webgl-3d-viewer__stage");
  assert(stage !== null, "viewer stage must exist");
  stage.dispatchEvent({ type: "pointerdown", clientX: 100, clientY: 100, pointerId: 1, pointerType: "mouse" });
  stage.dispatchEvent({ type: "pointermove", clientX: 180, clientY: 130, pointerId: 1, pointerType: "mouse" });
  stage.dispatchEvent({ type: "pointerup", clientX: 180, clientY: 130, pointerId: 1, pointerType: "mouse" });
  stage.dispatchEvent({ type: "wheel", deltaY: -120 });
  stage.dispatchEvent({ type: "wheel", deltaY: 240 });
  stage.dispatchEvent({ type: "keydown", key: "ArrowLeft" });
  stage.dispatchEvent({ type: "keydown", key: "+" });
  stage.dispatchEvent({ type: "keydown", key: "-" });
  stage.dispatchEvent({ type: "keydown", key: "0" });
  const readout = fixture.modal.querySelector(".webgl-3d-viewer__readout");
  assert(readout && readout.textContent === "100%", "reset must restore the 100 percent readout");

  api.close();
  assert(api.getState().sessionActive === false, "close must deactivate the session");
  assert(frames.length === 0, "close must cancel all scheduled frames");
  assert(stats.geometryDisposals === stats.geometries.length, "all geometries must be disposed");
  assert(stats.materialDisposals === stats.materials.length, "all materials must be disposed");
  assert(stats.textureDisposals === stats.textures.length, "all textures must be disposed");
  assert(stats.rendererDisposals === 1, "renderer must be disposed");
  return "id=" + id + ";meshes=" + descriptors.length + ";pbr=" + PBR_IDS.has(id) +
    ";textures=" + stats.textures.length + ";frames=" + stats.renderCalls;
}

function runScenario(scenario) {
  const stats = {
    geometries: [],
    geometryDisposals: 0,
    materials: [],
    materialDisposals: 0,
    physicalMaterials: 0,
    textures: [],
    textureDisposals: 0,
    textureClass: null,
    renderers: 0,
    rendererDisposals: 0,
    renderCalls: 0,
    canvasContexts: [],
    pmremConversions: 0,
    pmremDisposals: 0,
    createdMeshes: []
  };
  const consoleSpy = createConsoleSpy();
  const fixture = createFixture(scenario, stats);
  const THREE = createThreeStub(stats);
  stats.textureClass = THREE.CanvasTexture;
  const reducedMotion = scenario.scenarioClass === "boundary" && scenario.variant % 5 === 0;
  const { win, frames } = createWindow(stats, THREE, reducedMotion);
  const sandbox = { window: win, document: fixture.doc, console: consoleSpy };

  vm.runInNewContext(SOURCE, sandbox, { filename: "webgl-3d-viewer.js", timeout: 5000 });
  const api = win.NAZTECH_WEBGL_VIEWER;
  const test = win.NAZTECH_WEBGL_TEST;
  assert(api && test, "viewer APIs must be installed");
  assert(consoleSpy.errorCount === 0, "console error channel must stay silent");

  if (scenario.scenarioClass === "empty") {
    for (const invalid of [null, undefined, "", "0", "9", "abc", {}, 1]) {
      assert(api.open(invalid) === false, "invalid catalog id must be rejected");
    }
    assert(test.validateModelRegistry(test.MODEL_REGISTRY) === true, "registry must remain valid");
    return "empty-inputs=rejected;registry=valid";
  }

  if (scenario.scenarioClass === "malformed") {
    const registry = test.MODEL_REGISTRY;
    const source = JSON.stringify(registry);
    assert(typeof source === "string" && source.length > 0, "registry must be serialisable for review");
    assert(test.validateModelRegistry(registry) === true, "unmodified registry must validate");
    assert(test.validateModelRegistry(null) === false, "null registry must be rejected");
    assert(test.validateModelRegistry({}) === false, "empty registry must be rejected");
    assert(test.clampZoom(NaN) === 6.2, "non-finite zoom must use the default radius");
    return "malformed=rejected;registry=valid";
  }

  if (scenario.scenarioClass === "boundary") {
    assert(test.clampZoom(-100) === 3, "zoom lower clamp must hold");
    assert(test.clampZoom(100) === 12, "zoom upper clamp must hold");
    assert(Math.abs(test.wrapAngle(Math.PI * 3)) <= Math.PI, "angle wrap must stay in range");
    for (let index = 0; index < 4; index += 1) {
      const id = String((scenario.variant + index) % 8 + 1);
      api.open(id);
      api.close();
    }
    assert(stats.rendererDisposals === stats.renderers, "rapid churn must dispose every renderer");
    return "clamps=ok;churn=" + stats.renderers + ";motion=" + reducedMotion;
  }

  if (scenario.scenarioClass === "mutation") {
    const id = String(scenario.variant % 4 + 1);
    api.open(id);
    const canvas = fixture.modal.querySelector("canvas.webgl-3d-viewer__canvas");
    assert(canvas !== null, "renderer canvas must be attached");
    canvas.dispatchEvent({ type: "webglcontextlost" });
    assert(api.getState().sessionActive === false, "context loss must tear down the stale session");
    assert(frames.length === 0, "context loss must cancel pending frames");
    return "context-loss=recovered;id=" + id;
  }

  const id = String(scenario.variant % 8 + 1);
  const detail = verifyValidRun(scenario, id, api, test, fixture, stats, frames);
  return detail;
}

function main() {
  const plan = buildPlan();
  fs.writeFileSync(RESULTS_PATH, "");
  let passed = 0;
  let failed = 0;

  for (const scenario of plan) {
    let detail = "";
    let pass = false;
    try {
      detail = runScenario(scenario);
      pass = true;
    } catch (error) {
      detail = "FAIL: " + (error && error.message ? error.message : String(error));
    }
    fs.appendFileSync(
      RESULTS_PATH,
      JSON.stringify({
        iteration: scenario.iteration,
        scenario_class: scenario.scenarioClass,
        pass,
        detail
      }) + "\n"
    );
    if (pass) passed += 1;
    else failed += 1;
    console.log(
      "RUN " + String(scenario.iteration).padStart(3, "0") +
      " " + (pass ? "PASS" : "FAIL") +
      " | class=" + scenario.scenarioClass +
      " | " + detail
    );
  }

  console.log("TOTAL_RUNS=" + TOTAL_ITERATIONS + " PASS=" + passed + " FAIL=" + failed);
  console.log("STRESS_VERDICT_WEBGL: " + passed + "/" + TOTAL_ITERATIONS + " PASS");
  if (passed !== TOTAL_ITERATIONS || failed !== 0) {
    process.exit(1);
  }
}

main();
