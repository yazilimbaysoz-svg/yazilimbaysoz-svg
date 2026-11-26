/*
 * Baysöz Yazılım — 100x deterministic stress harness for tezweb-3d.js.
 * Contact: baysozlabs@proton.me
 *
 * The 3D layer is executed in a fresh vm context per iteration against a
 * dependency-free DOM shim. Rendering is intentionally unavailable in the
 * sandbox; controller logic, DOM effects and error paths are verified.
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createConsoleSpy, createDocument } from "./dom-shim.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = fs.readFileSync(path.join(ROOT, "tezweb-3d.js"), "utf8");
const RESULTS_PATH = path.join(ROOT, "artifacts", "3d-stress-results.jsonl");
const TOTAL_ITERATIONS = 100;
const SEED = 20261122;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function styleStub(element) {
  const values = new Map();
  element.style = {
    transform: "",
    setProperty(name, value) {
      values.set(name, value);
    },
    getPropertyValue(name) {
      return values.get(name) || "";
    }
  };
  element.styleValues = values;
  return element;
}

function geometryStub(element, width, height) {
  element.getBoundingClientRect = () => ({ left: 0, top: 0, width, height });
  return element;
}

function addElement(doc, tag, options = {}) {
  const element = doc.createElement(tag);
  if (options.id) element.id = options.id;
  if (options.className) element.className = options.className;
  for (const [name, value] of Object.entries(options.attributes || {})) {
    element.setAttribute(name, value);
  }
  (options.parent || doc.body).appendChild(element);
  return styleStub(element);
}

function buildFixture(scenario) {
  const doc = createDocument();
  const { scenarioClass, variant } = scenario;

  if (!(scenarioClass === "empty" && variant % 3 === 0)) {
    addElement(doc, "div", { className: "nzt-preloader", id: "nztPreloader" });
  }
  if (!(scenarioClass === "empty" && variant % 3 === 1)) {
    const hero = addElement(doc, "section", { id: "anasayfa" });
    if (!(scenarioClass === "empty" && variant % 3 === 2)) {
      addElement(doc, "canvas", { id: "nztSceneCanvas", parent: hero });
    }
  }

  const cardCount = scenarioClass === "empty" ? 0 : scenarioClass === "valid" ? 8 : 3;
  const services = addElement(doc, "section", { id: "hizmetler" });
  const cards = [];
  for (let index = 0; index < cardCount; index += 1) {
    cards.push(
      geometryStub(
        addElement(doc, "div", {
          className: "card-hover",
          attributes: { "data-catalog": String(index + 1) },
          parent: services
        }),
        320,
        220
      )
    );
  }

  const kpiTargets =
    scenarioClass === "valid"
      ? ["500", "8", "100", "24"]
      : scenarioClass === "malformed"
        ? ["abc", "NaN", "", "-1", "1e309"]
        : scenarioClass === "boundary"
          ? ["0", "-5", "999999999", "Infinity", "1.5"]
          : [];
  const kpiPrefixes = ["", "", "%", "7/", "", ""];
  const kpiSuffixes = ["+", "", "", "", "!", "x"];
  const counters = [];
  for (let index = 0; index < kpiTargets.length; index += 1) {
    counters.push(
      addElement(doc, "span", {
        className: "nzt-kpi__value",
        attributes: {
          "data-kpi-value": "",
          "data-kpi-target": kpiTargets[index],
          "data-kpi-prefix": kpiPrefixes[index],
          "data-kpi-suffix": kpiSuffixes[index]
        }
      })
    );
  }

  let modal = null;
  let gallery = null;
  let figure = null;
  let figureImage = null;
  const hasModal = scenarioClass !== "empty";
  if (hasModal) {
    modal = addElement(doc, "div", { id: "naztechModal", className: "modal" });
    gallery = addElement(doc, "div", { id: "modalGallery", parent: modal });
    const imageCount =
      scenarioClass === "boundary" ? 3 : scenarioClass === "malformed" && variant % 2 === 0 ? 0 : 1;
    for (let index = 0; index < imageCount; index += 1) {
      figure = addElement(doc, "figure", { className: "modal__figure", parent: gallery });
      figure.tabIndex = 0;
      figureImage = addElement(doc, "img", {
        attributes: {
          src: scenarioClass === "malformed" && variant % 3 === 0 ? "" : "img/arac_takip.jpg",
          alt: "N2MOBİL GPS & filo yönetimi gösterimi"
        },
        parent: figure
      });
      const caption = addElement(doc, "span", { className: "modal__caption-title", parent: figure });
      caption.textContent = "N2MOBİL filo paneli";
      addElement(doc, "a", {
        attributes: { href: "https://example.invalid/license", rel: "noopener noreferrer" },
        parent: figure
      });
    }
  }

  return { doc, cards, counters, modal, gallery, figure, figureImage };
}

function expectedCounter(node) {
  const target = Number(node.getAttribute("data-kpi-target"));
  const value = Number.isFinite(target) ? target : 0;
  const prefix = node.getAttribute("data-kpi-prefix") || "";
  const suffix = node.getAttribute("data-kpi-suffix") || "";
  return prefix + String(Math.round(value)) + suffix;
}

function flushTimers(timers) {
  for (let index = 0; index < timers.length && index < 8; index += 1) {
    timers[index].callback();
  }
}

function verifyScenario(scenario, fixture, timers, consoleSpy) {
  const { doc, counters, modal, figure, figureImage } = fixture;

  assert(consoleSpy.errorCount === 0, "console.error must stay silent");
  assert(doc.querySelector(".nzt-preloader") === null, "preloader must be removed after 800ms");

  for (const counter of counters) {
    assert(counter.textContent === expectedCounter(counter), "KPI final value must be exact");
  }

  const viewer = doc.querySelector("[data-product-viewer]");
  if (!modal) {
    assert(viewer === null, "viewer must not be created without a modal");
    return "viewer-skipped; preloader=removed; kpi=" + counters.length;
  }

  assert(viewer !== null, "viewer must be attached inside the modal");
  assert(viewer.parentNode === modal, "viewer must be a direct modal child");
  assert(viewer.hidden === true, "viewer must start hidden");
  assert(doc.querySelectorAll("[data-product-viewer]").length === 1, "exactly one viewer instance");

  if (!figure || !figureImage || !figureImage.getAttribute("src")) {
    assert(viewer.hidden === true, "invalid product photo must not open the viewer");
    return "viewer-inert; preloader=removed; kpi=" + counters.length;
  }

  const creditLink = figure.querySelector("a");
  if (creditLink) {
    creditLink.dispatchEvent({ type: "click" });
    assert(viewer.hidden === true, "credit link clicks must not open the viewer");
  }

  figure.dispatchEvent({ type: "click" });
  assert(viewer.hidden === false, "product photo click must open the viewer");
  const viewerImage = viewer.querySelector("img");
  assert(viewerImage.getAttribute("src") === figureImage.getAttribute("src"), "viewer source must match");
  assert(viewerImage.getAttribute("alt") === figureImage.getAttribute("alt"), "viewer alt must match");

  const buttons = viewer.querySelectorAll("button");
  assert(buttons.length === 4, "viewer must expose close, zoom out, zoom in and reset");
  doc.dispatchEvent({ type: "keydown", key: "Tab" });
  assert(doc.activeElement === buttons[1], "Tab must move focus inside the viewer");
  doc.dispatchEvent({ type: "keydown", key: "Tab", shiftKey: true });
  assert(doc.activeElement === buttons[0], "Shift+Tab must cycle focus inside the viewer");
  const zoomLevel = viewer.querySelector(".product-viewer__level");
  assert(zoomLevel.textContent === "100%", "viewer must start at 100% zoom");

  buttons[2].dispatchEvent({ type: "click" });
  assert(zoomLevel.textContent === "112%", "zoom in must increase the level");
  buttons[1].dispatchEvent({ type: "click" });
  assert(zoomLevel.textContent === "100%", "zoom out must decrease the level");

  const stage = viewer.querySelector(".product-viewer__stage");
  stage.dispatchEvent({ type: "wheel", deltaY: -100 });
  assert(zoomLevel.textContent === "112%", "wheel up must increase the level");
  stage.dispatchEvent({ type: "wheel", deltaY: 100 });
  assert(zoomLevel.textContent === "100%", "wheel down must decrease the level");
  stage.dispatchEvent({ type: "pointermove", clientX: 300, clientY: 90 });
  assert(viewerImage.style.transform.includes("rotateX"), "pointer move must tilt the product");
  buttons[3].dispatchEvent({ type: "click" });
  assert(zoomLevel.textContent === "100%", "reset must restore the initial zoom");

  doc.dispatchEvent({ type: "keydown", key: "Escape" });
  assert(viewer.hidden === true, "Escape must close the viewer");
  assert(timers.length >= 2, "preloader must schedule both lifecycle phases");
  return "viewer=open/zoom/tilt/escape; kpi=" + counters.length;
}

function buildPlan() {
  const scenarios = [];
  for (let variant = 0; variant < TOTAL_ITERATIONS; variant += 1) {
    const scenarioClass =
      variant < 50 ? "valid" : variant < 68 ? "empty" : variant < 85 ? "malformed" : variant < 96 ? "boundary" : "mutation";
    scenarios.push({ iteration: variant + 1, scenarioClass, variant });
  }
  let seed = SEED >>> 0;
  const random = () => {
    seed = (Math.imul(1103515245, seed) + 12345) >>> 0;
    return seed / 4294967296;
  };
  for (let index = scenarios.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const temporary = scenarios[index];
    scenarios[index] = scenarios[swapIndex];
    scenarios[swapIndex] = temporary;
  }
  return scenarios;
}

function main() {
  const plan = buildPlan();
  fs.writeFileSync(RESULTS_PATH, "");
  let passed = 0;
  let failed = 0;

  for (const scenario of plan) {
    const fixture = buildFixture(scenario);
    const consoleSpy = createConsoleSpy();
    const timers = [];
    const sandbox = {
      window: {
        addEventListener() {},
        removeEventListener() {},
        setTimeout(callback, delay) {
          timers.push({ callback, delay });
          return timers.length;
        },
        matchMedia() {
          return { matches: true };
        },
        innerWidth: 1280,
        innerHeight: 800,
        devicePixelRatio: 1
      },
      document: fixture.doc,
      console: consoleSpy
    };

    let detail = "";
    let pass = false;
    try {
      vm.runInNewContext(SOURCE, sandbox, { filename: "tezweb-3d.js", timeout: 5000 });
      const viewer = fixture.doc.querySelector("[data-product-viewer]");
      if (viewer) {
        styleStub(viewer.querySelector("img"));
        geometryStub(viewer.querySelector(".product-viewer__stage"), 400, 300);
      }
      flushTimers(timers);
      detail = verifyScenario(scenario, fixture, timers, consoleSpy);
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
        console_errors: consoleSpy.errorCount,
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
      " | errors=" + consoleSpy.errorCount +
      " | " + detail
    );
  }

  console.log("TOTAL_RUNS=" + TOTAL_ITERATIONS + " PASS=" + passed + " FAIL=" + failed);
  console.log("STRESS_VERDICT_3D: " + passed + "/" + TOTAL_ITERATIONS + " PASS");
  if (passed !== TOTAL_ITERATIONS || failed !== 0) {
    process.exit(1);
  }
}

main();
