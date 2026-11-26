/*
 * Baysöz Yazılım — Deterministic 100-run VM verification for the realistic hardware layer.
 * Contact: baysozlabs@proton.me
 *
 * Each iteration loads realistic-3d-models.js in a fresh vm context with an
 * in-memory 2D canvas and a deterministic Three.js surface. The harness
 * verifies every catalog build, texture and bump-map generation, brand colors,
 * dual spotlights, backdrop replacement, lifecycle teardown, malformed input,
 * boundary values, and mutation resistance.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = fs.readFileSync(path.join(ROOT, "realistic-3d-models.js"), "utf8");
const RESULTS_PATH = path.join(ROOT, "artifacts", "realistic-stress-results.jsonl");
const TOTAL_ITERATIONS = 100;
const MODEL_IDS = ["1", "2", "3", "4", "5", "6", "7", "8"];
const EXPECTED_COUNTS = { 1: 60, 2: 48, 3: 80, 4: 44, 5: 62, 6: 68, 7: 81, 8: 75 };

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildPlan() {
  const classes = ["valid", "empty", "malformed", "boundary", "mutation"];
  const allocation = { valid: 40, empty: 12, malformed: 18, boundary: 20, mutation: 10 };
  const scenarios = [];
  for (const scenarioClass of classes) {
    for (let variant = 0; variant < allocation[scenarioClass]; variant += 1) {
      scenarios.push({ iteration: scenarios.length + 1, scenarioClass, variant });
    }
  }
  let seed = 20261123 >>> 0;
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

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
}

class Color {
  constructor(value) {
    this.value = value >>> 0;
  }

  getHex() {
    return this.value;
  }
}

class Geometry {
  constructor(type, parameters) {
    this.type = type;
    this.parameters = parameters;
    this.disposed = false;
  }

  dispose() {
    this.disposed = true;
  }
}

class BoxGeometry extends Geometry {
  constructor(width, height, depth) {
    super("BoxGeometry", { width, height, depth });
  }
}

class CylinderGeometry extends Geometry {
  constructor(radiusTop, radiusBottom, height, radialSegments) {
    super("CylinderGeometry", { radiusTop, radiusBottom, height, radialSegments });
  }
}

class SphereGeometry extends Geometry {
  constructor(radius, widthSegments, heightSegments) {
    super("SphereGeometry", { radius, widthSegments, heightSegments });
  }
}

class TorusGeometry extends Geometry {
  constructor(radius, tube, radialSegments, tubularSegments) {
    super("TorusGeometry", { radius, tube, radialSegments, tubularSegments });
  }
}

class ConeGeometry extends Geometry {
  constructor(radius, height, radialSegments) {
    super("ConeGeometry", { radius, height, radialSegments });
  }
}

class PlaneGeometry extends Geometry {
  constructor(width, height) {
    super("PlaneGeometry", { width, height });
  }
}

class CircleGeometry extends Geometry {
  constructor(radius, segments) {
    super("CircleGeometry", { radius, segments });
  }
}

class Material {
  constructor(parameters = {}) {
    Object.assign(this, parameters);
    this.disposed = false;
  }

  clone() {
    const parameters = {};
    for (const key of Object.keys(this)) {
      if (key !== "disposed") {
        parameters[key] = this[key];
      }
    }
    return new this.constructor(parameters);
  }

  dispose() {
    this.disposed = true;
  }
}

class MeshStandardMaterial extends Material {}
class MeshPhysicalMaterial extends Material {}

class Object3D {
  constructor() {
    this.position = new Vector3();
    this.rotation = new Vector3();
    this.scale = new Vector3(1, 1, 1);
    this.children = [];
    this.parent = null;
    this.userData = {};
    this.visible = true;
    this.name = "";
  }

  add(child) {
    if (!child) {
      return;
    }
    if (child.parent) {
      child.parent.remove(child);
    }
    child.parent = this;
    this.children.push(child);
  }

  remove(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
    }
  }

  traverse(visitor) {
    visitor(this);
    for (const child of this.children.slice()) {
      child.traverse(visitor);
    }
  }
}

class Group extends Object3D {}
class Scene extends Object3D {}

class Mesh extends Object3D {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
    this.isMesh = true;
  }
}

class SpotLight extends Object3D {
  constructor(color, intensity, distance, angle, penumbra, decay) {
    super();
    this.color = new Color(color);
    this.intensity = intensity;
    this.distance = distance;
    this.angle = angle;
    this.penumbra = penumbra;
    this.decay = decay;
    this.target = null;
    this.isSpotLight = true;
    this.type = "SpotLight";
  }
}

class CanvasTexture {
  constructor(canvas) {
    this.canvas = canvas;
    this.disposed = false;
  }

  dispose() {
    this.disposed = true;
  }
}

function createThreeSurface() {
  return {
    Vector3,
    Object3D,
    Group,
    Scene,
    Mesh,
    SpotLight,
    MeshStandardMaterial,
    MeshPhysicalMaterial,
    CanvasTexture,
    BoxGeometry,
    CylinderGeometry,
    SphereGeometry,
    TorusGeometry,
    ConeGeometry,
    PlaneGeometry,
    CircleGeometry,
    SRGBColorSpace: "srgb",
    LinearMipmapLinearFilter: 1008,
    LinearFilter: 1006,
    RepeatWrapping: 1000,
    DoubleSide: 2,
    FrontSide: 0
  };
}

function createCanvasFactory(records, allowCanvas) {
  return (tagName) => {
    if (String(tagName).toLowerCase() !== "canvas") {
      return { tagName: String(tagName) };
    }
    if (!allowCanvas) {
      return { width: 0, height: 0, getContext: () => null };
    }
    const canvas = { width: 0, height: 0 };
    canvas.getContext = (kind) => {
      if (kind !== "2d") {
        return null;
      }
      const context = {
        ops: [],
        fillStyle: "#000000",
        strokeStyle: "#000000",
        lineWidth: 1,
        font: "",
        textAlign: "left",
        textBaseline: "alphabetic"
      };
      context.fillRect = (x, y, width, height) => {
        context.ops.push({ op: "fill", color: context.fillStyle, x, y, width, height });
      };
      context.strokeRect = (x, y, width, height) => {
        context.ops.push({ op: "strokeRect", color: context.strokeStyle, x, y, width, height });
      };
      context.fillText = (text, x, y) => {
        context.ops.push({ op: "text", color: context.fillStyle, text: String(text), x, y });
      };
      context.beginPath = () => {
        context.ops.push({ op: "beginPath" });
      };
      context.closePath = () => {};
      context.arc = (x, y, radius) => {
        context.ops.push({ op: "arc", x, y, radius });
      };
      context.fill = () => {
        context.ops.push({ op: "fillPath", color: context.fillStyle });
      };
      context.moveTo = (x, y) => {
        context.ops.push({ op: "moveTo", x, y });
      };
      context.lineTo = (x, y) => {
        context.ops.push({ op: "lineTo", x, y });
      };
      context.stroke = () => {
        context.ops.push({ op: "stroke", color: context.strokeStyle });
      };
      context.save = () => {};
      context.restore = () => {};
      context.clearRect = () => {};
      records.contexts.push(context);
      return context;
    };
    return canvas;
  };
}

function createFixture(options = {}) {
  const records = { contexts: [] };
  const frames = [];
  const cancelled = [];
  const listeners = Object.create(null);
  const THREE = createThreeSurface();
  const documentRef = {
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    createElement: createCanvasFactory(records, options.allowCanvas !== false)
  };
  const windowRef = {
    THREE,
    document: documentRef,
    devicePixelRatio: 1,
    requestAnimationFrame(callback) {
      frames.push(callback);
      return frames.length;
    },
    cancelAnimationFrame(id) {
      cancelled.push(id);
    }
  };
  const sandbox = { window: windowRef, document: documentRef, console, Math, JSON, Object, Array, String, Number,
    Boolean, Date, RegExp, Error, TypeError, Function, isFinite, parseInt, parseFloat };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: "realistic-3d-models.js", timeout: 5000 });
  const test = windowRef.NAZTECH_REALISTIC_TEST;
  assert(test && typeof test.validate === "function", "test surface must be published");
  return { records, frames, cancelled, listeners, THREE, documentRef, windowRef, test };
}

function createSessionDetail(fixture, id, epoch = 1) {
  const scene = new fixture.THREE.Scene();
  const baseGroup = new fixture.THREE.Group();
  baseGroup.visible = true;
  baseGroup.name = "viewer-base-model-" + id;
  scene.add(baseGroup);
  const viewerBackdrop = new fixture.THREE.Mesh(
    new fixture.THREE.PlaneGeometry(5.6, 2.1),
    new fixture.THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  viewerBackdrop.position.set(0, 1.75, -2.6);
  scene.add(viewerBackdrop);
  const renderer = { capabilities: { getMaxAnisotropy: () => 4 } };
  return { id: String(id), epoch, scene, renderer, group: baseGroup, camera: {}, meshes: {} };
}

function collectText(fixture) {
  return fixture.records.contexts
    .flatMap((context) => context.ops)
    .filter((operation) => operation.op === "text")
    .map((operation) => operation.text)
    .join("|");
}

function collectFillColors(fixture) {
  return fixture.records.contexts
    .flatMap((context) => context.ops)
    .filter((operation) => operation.op === "fill" || operation.op === "fillPath")
    .map((operation) => String(operation.color).toUpperCase());
}

function findLayer(scene) {
  return scene.children.find((child) => child.name === "naztech-realistic-layer") || null;
}

function verifyStructure(fixture, detail, id) {
  const test = fixture.test;
  assert(test.validate() === true, "descriptor registry must validate");
  assert(JSON.stringify(test.modelIds) === JSON.stringify(MODEL_IDS), "model ids must be complete");
  for (const modelId of MODEL_IDS) {
    assert(test.expectedCounts[modelId] === EXPECTED_COUNTS[modelId], "count contract for id " + modelId);
  }
  assert(typeof fixture.listeners["naztech:webgl-session-ready"] === "function", "ready listener required");
  assert(typeof fixture.listeners["naztech:webgl-session-end"] === "function", "end listener required");

  const attached = fixture.listeners["naztech:webgl-session-ready"]({ detail });
  assert(attached !== false, "session attachment must succeed");
  const snapshot = test.snapshot();
  assert(snapshot.attached === true, "snapshot must report an attached session");
  assert(snapshot.id === String(id), "snapshot id must match catalog id");
  assert(snapshot.epoch === detail.epoch, "snapshot epoch must match event detail");
  assert(snapshot.layerName === "naztech-realistic-layer", "layer name must be stable");
  assert(snapshot.descriptorCount === EXPECTED_COUNTS[id], "descriptor count must match contract");
  assert(snapshot.meshCount === EXPECTED_COUNTS[id], "instantiated mesh count must match contract");
  assert(snapshot.textureCount >= 13, "all texture recipes must be produced");
  assert(snapshot.bumpTextureCount >= 13, "all non-backdrop textures must carry bump data");
  assert(snapshot.spotlightCount === 2, "exactly two studio spotlights must be active");
  assert(snapshot.backdropCount === 1, "high-resolution backdrop must be present");
  assert(snapshot.baseHidden === true, "base viewer model must be hidden");
  assert(detail.group.visible === false, "base group visibility must be suppressed");

  const layer = findLayer(detail.scene);
  assert(layer !== null, "realistic layer must be attached to the scene");
  let texturedMeshes = 0;
  let bumpedMeshes = 0;
  let transparentMeshes = 0;
  layer.traverse((node) => {
    if (!node.isMesh || !node.material) {
      return;
    }
    if (node.material.map) {
      texturedMeshes += 1;
    }
    if (node.material.bumpMap) {
      bumpedMeshes += 1;
    }
    if (node.material.transparent === true) {
      transparentMeshes += 1;
    }
  });
  assert(texturedMeshes >= 4, "multiple PBR maps must be bound to meshes; got " + texturedMeshes);
  assert(bumpedMeshes >= 4, "bump maps must be bound to meshes; got " + bumpedMeshes);
  assert(transparentMeshes >= 2, "acrylic and glass surfaces must remain transparent; got " + transparentMeshes);

  const text = collectText(fixture);
  for (const brand of ["HIKVISION", "N2MOBİL", "LAVOX electronics"]) {
    assert(text.includes(brand), "brand text missing: " + brand);
  }
  const fills = collectFillColors(fixture);
  for (const color of ["#E60012", "#E93B77", "#19A7B8"]) {
    assert(fills.includes(color), "brand color missing: " + color);
  }

  const spotlights = [];
  detail.scene.traverse((node) => {
    if (node.isSpotLight) {
      spotlights.push(node);
    }
  });
  assert(spotlights.length === 2, "spotlight count in scene");
  assert(spotlights.some((light) => light.color.getHex() === 0xe60012), "red spotlight required");
  assert(spotlights.some((light) => light.color.getHex() === 0xffffff), "white spotlight required");

  const viewerBackdrop = detail.scene.children.find((child) => child.name === "" && child.geometry &&
    child.geometry.type === "PlaneGeometry" && child.position.z === -2.6);
  assert(viewerBackdrop && viewerBackdrop.visible === false, "legacy backdrop must be hidden");

  const before = layer.userData.model.userData.meshes
    .filter((mesh) => mesh.userData.animators.includes("ledPulse"))
    .map((mesh) => mesh.material.emissiveIntensity);
  assert(before.length > 0, "animated emitters must exist");
  assert(test.applyAnimators(1234) === true, "animator pass must succeed");
  const after = layer.userData.model.userData.meshes
    .filter((mesh) => mesh.userData.animators.includes("ledPulse"))
    .map((mesh) => mesh.material.emissiveIntensity);
  assert(after.some((value, index) => value !== before[index]), "animator pass must mutate emitters");

  return { layer, baseGroup: detail.group, viewerBackdrop };
}

function verifyEmptyScenario(scenario, fixture) {
  const test = fixture.test;
  const payloads = [null, undefined, {}, { detail: null }, { detail: {} }, "catalog", 0, true, [], NaN];
  const payload = payloads[scenario.variant % payloads.length];
  const result = fixture.listeners["naztech:webgl-session-ready"]({ detail: payload });
  assert(result === false, "empty payload must be rejected");
  assert(test.snapshot().attached === false, "empty payload must not attach a session");
  return "empty=" + typeof payload;
}

function verifyMalformedScenario(scenario, fixture) {
  const test = fixture.test;
  const id = MODEL_IDS[scenario.variant % MODEL_IDS.length];
  const detail = createSessionDetail(fixture, id, scenario.variant);
  const mutations = [
    () => { detail.id = "99"; },
    () => { delete detail.scene; },
    () => { delete detail.renderer; },
    () => { detail.scene = { add() { throw new Error("scene-add-failed"); } }; },
    () => { detail.group = null; },
    () => { detail.epoch = "invalid"; },
    () => { detail.id = 1; },
    () => { detail.scene.traverse = null; },
    () => { detail.renderer.capabilities.getMaxAnisotropy = () => Number.NaN; }
  ];
  const mutationIndex = scenario.variant % mutations.length;
  mutations[mutationIndex]();
  const result = fixture.listeners["naztech:webgl-session-ready"]({ detail });
  const snapshot = test.snapshot();
  if (result === false) {
    assert(snapshot.attached === false, "rejected payload must not leave an active session");
  } else {
    assert(snapshot.attached === true, "tolerated payload must remain observable");
    assert(test.detach(detail) === true, "tolerated payload must detach cleanly");
    assert(test.snapshot().attached === false, "tolerated payload must tear down fully");
  }
  return "malformed=mode" + mutationIndex + ";result=" + result;
}

function verifyBoundaryScenario(scenario, fixture) {
  const test = fixture.test;
  const id = MODEL_IDS[scenario.variant % MODEL_IDS.length];
  const epoch = scenario.variant === 0 ? 0 : scenario.variant * 1000000;
  const detail = createSessionDetail(fixture, id, epoch);
  const artifacts = verifyStructure(fixture, detail, id);

  if (scenario.variant % 4 === 0) {
    assert(test.attach(detail) === true, "duplicate attach must be idempotent");
    assert(detail.scene.children.filter((child) => child.name === "naztech-realistic-layer").length === 1,
      "duplicate attach must not duplicate the layer");
  } else if (scenario.variant % 4 === 1) {
    assert(fixture.listeners["naztech:webgl-session-end"]({ detail: { id, epoch: epoch + 1, scene: detail.scene } }) === false,
      "stale epoch must not detach the active session");
    assert(test.snapshot().attached === true, "stale epoch detachment must be ignored");
  } else if (scenario.variant % 4 === 2) {
    assert(test.detach(detail) === true, "boundary detachment must succeed");
    assert(test.attach(detail) === true, "reattachment must succeed");
    assert(test.snapshot().attached === true, "reattached snapshot required");
  } else {
    detail.renderer.capabilities.getMaxAnisotropy = () => 1;
    assert(test.detach(detail) === true, "boundary detachment must succeed");
    assert(test.attach(detail) === true, "minimum anisotropy attachment must succeed");
    assert(test.snapshot().textureCount >= 13, "minimum anisotropy must retain textures");
  }

  assert(test.detach(detail) === true, "final detachment must succeed");
  assert(test.snapshot().attached === false, "final snapshot must be detached");
  assert(artifacts.baseGroup.visible === true, "base group visibility must be restored");
  assert(artifacts.viewerBackdrop.visible === true, "legacy backdrop visibility must be restored");
  assert(detail.scene.children.indexOf(artifacts.layer) === -1, "layer must be removed from the scene");
  return "boundary=mode" + (scenario.variant % 4) + ";epoch=" + epoch;
}

function verifyMutationScenario(scenario, fixture) {
  const test = fixture.test;
  const id = MODEL_IDS[scenario.variant % MODEL_IDS.length];
  const detail = createSessionDetail(fixture, id, scenario.variant + 1);
  const artifacts = verifyStructure(fixture, detail, id);
  const frozenIds = test.modelIds;
  assert(Object.isFrozen(frozenIds), "published model ids must be immutable");
  try {
    frozenIds.push("99");
  } catch (_error) {
    // Immutable arrays reject mutation in strict mode.
  }
  assert(frozenIds.length === MODEL_IDS.length, "published model ids must not be mutated");
  const counts = test.expectedCounts;
  assert(Object.isFrozen(counts), "published counts must be immutable");
  const originalCount = counts[id];
  try {
    counts[id] = 999;
  } catch (_error) {
    // Immutable records reject mutation in strict mode.
  }
  assert(counts[id] === originalCount, "published counts must not be mutated");
  assert(test.detach({ id: "99", epoch: detail.epoch, scene: detail.scene }) === false,
    "detachment with mutated id must be ignored");
  assert(test.snapshot().attached === true, "mutated detachment must preserve the session");
  assert(test.detach(detail) === true, "valid detachment must still succeed");
  assert(artifacts.layer.parent === null, "detached layer must have no parent");
  return "mutation=immutable;id=" + id;
}

function runScenario(scenario) {
  const allowCanvas = scenario.scenarioClass !== "empty" || scenario.variant % 2 === 0;
  const fixture = createFixture({ allowCanvas });
  const test = fixture.test;

  if (scenario.scenarioClass === "empty") {
    return verifyEmptyScenario(scenario, fixture);
  }
  if (scenario.scenarioClass === "malformed") {
    return verifyMalformedScenario(scenario, fixture);
  }

  const id = MODEL_IDS[scenario.variant % MODEL_IDS.length];
  const detail = createSessionDetail(fixture, id, scenario.variant + 1);
  const artifacts = verifyStructure(fixture, detail, id);

  if (scenario.scenarioClass === "boundary") {
    return verifyBoundaryScenario(scenario, fixture);
  }
  if (scenario.scenarioClass === "mutation") {
    return verifyMutationScenario(scenario, fixture);
  }

  assert(test.attach(detail) === true, "valid attach must be idempotent");
  assert(test.detach(detail) === true, "valid detach must succeed");
  assert(test.snapshot().attached === false, "valid run must finish detached");
  assert(artifacts.baseGroup.visible === true, "base group must be restored");
  assert(fixture.cancelled.length >= 1, "detachment must cancel the animation frame");
  return "valid=id" + id + ";meshes=" + EXPECTED_COUNTS[id];
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
    if (pass) {
      passed += 1;
    } else {
      failed += 1;
    }
    console.log(
      "RUN " + String(scenario.iteration).padStart(3, "0") +
      " " + (pass ? "PASS" : "FAIL") +
      " | class=" + scenario.scenarioClass +
      " | " + detail
    );
  }

  console.log("TOTAL_RUNS=" + TOTAL_ITERATIONS + " PASS=" + passed + " FAIL=" + failed);
  console.log("STRESS_VERDICT_REALISTIC: " + passed + "/" + TOTAL_ITERATIONS + " PASS");
  if (passed !== TOTAL_ITERATIONS || failed !== 0) {
    process.exit(1);
  }
}

main();
