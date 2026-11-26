/*
 * Baysöz Yazılım — 100x deterministic stress and fuzz harness.
 * Contact: baysozlabs@proton.me
 *
 * The site under test is loaded as a classic script in a fresh vm context for
 * every iteration. matrix.js is syntax-checked only and is never executed.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createConsoleSpy, createDocument } from "./dom-shim.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RESULTS_PATH = path.join(ROOT, "artifacts", "stress-results.jsonl");
const SITE_PATH = path.join(ROOT, "hizmet-detay.js");
const TOTAL_ITERATIONS = 100;
const LCG_SEED = 20261122;
const CLOSE_PATHS = ["controller", "escape", "backdrop"];

const MODAL_IDS = [
  "naztechModal", "modalBox", "closeModal", "mBanner", "modalGallery",
  "modalBadge", "modalTitle", "modalDescription", "modalSpecs", "modalWhatsApp"
];

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
  "meta", "param", "source", "track", "wbr"
]);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function privacyPatterns() {
  const localPath = new RegExp(
    "(?:[/]" + "home" + "[/]|[/]" + "Users" + "[/]|[/]" + "root" + "[/]|[/]" + "tmp" + "[/]|[A-Za-z]:\\\\)",
    "i"
  );
  const username = process.env.USER || process.env.USERNAME || os.userInfo().username;
  const usernamePattern = username && username.length >= 3
    ? new RegExp("\\b" + username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i")
    : null;
  return { localPath, usernamePattern };
}

function checkNoLocalIdentity(text, label, failures) {
  const { localPath, usernamePattern } = privacyPatterns();
  if (localPath.test(text)) {
    failures.push(label + ": absolute local path detected");
  }
  if (usernamePattern && usernamePattern.test(text)) {
    failures.push(label + ": OS username detected");
  }
}

function addCheck(checks, failures, name, condition, detail) {
  checks.push({ name, pass: Boolean(condition), detail });
  if (!condition) {
    failures.push(name + ": " + detail);
  }
}

function stripMarkupNoise(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "");
}

function htmlTagBalance(markup) {
  const stack = [];
  const tagPattern = /<(\/?)([a-zA-Z][\w-]*)\b([^>]*?)(\/?)>/g;
  let match;
  while ((match = tagPattern.exec(markup)) !== null) {
    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    const selfClosing = match[4] === "/";
    if (VOID_TAGS.has(tag) || selfClosing) {
      continue;
    }
    if (closing) {
      if (stack.pop() !== tag) {
        return false;
      }
    } else {
      stack.push(tag);
    }
  }
  return stack.length === 0;
}

function runStaticPreflight() {
  const checks = [];
  const failures = [];
  const html = read("index.html");
  const css = read("style.css");
  const siteSource = read("hizmet-detay.js");
  const matrixSource = read("matrix.js");
  const threeSource = read("tezweb-3d.js");

  for (const relative of ["hizmet-detay.js", "matrix.js", "tezweb-3d.js"]) {
    const result = spawnSync(process.execPath, ["--check", relative], {
      cwd: ROOT,
      encoding: "utf8"
    });
    addCheck(
      checks,
      failures,
      "node --check " + relative,
      result.status === 0,
      result.status === 0 ? "syntax OK" : (result.stderr || "syntax failure").trim()
    );
  }

  const testFiles = fs.readdirSync(path.join(ROOT, "tests"))
    .filter((name) => name.endsWith(".mjs"))
    .sort();
  for (const name of testFiles) {
    const result = spawnSync(process.execPath, ["--check", path.join("tests", name)], {
      cwd: ROOT,
      encoding: "utf8"
    });
    addCheck(
      checks,
      failures,
      "node --check tests/" + name,
      result.status === 0,
      result.status === 0 ? "syntax OK" : (result.stderr || "syntax failure").trim()
    );
  }
  addCheck(checks, failures, "test module count", testFiles.length >= 2, "found " + testFiles.length);

  const markup = stripMarkupNoise(html);
  addCheck(checks, failures, "HTML balanced tags", htmlTagBalance(markup), "tag stack closed");
  const bodyClosings = (html.match(/<\/body\s*>/gi) || []).length;
  addCheck(checks, failures, "HTML exactly one </body>", bodyClosings === 1, "count=" + bodyClosings);

  const cardIds = Array.from(html.matchAll(/data-catalog="([^"]*)"/g), (match) => match[1]);
  const expectedCardIds = Array.from({ length: 8 }, (_unused, index) => String(index + 1));
  addCheck(
    checks,
    failures,
    "HTML eight ordered catalog cards",
    JSON.stringify(cardIds) === JSON.stringify(expectedCardIds),
    "ids=" + cardIds.join(",")
  );

  const missingIds = MODAL_IDS.filter((id) => !html.includes('id="' + id + '"'));
  addCheck(
    checks,
    failures,
    "HTML ten modal ids",
    missingIds.length === 0,
    missingIds.length === 0 ? "all present" : "missing " + missingIds.join(",")
  );

  const inlineHandlers = markup.match(/\son[a-z]+\s*=/gi) || [];
  addCheck(checks, failures, "HTML no inline on*= handlers", inlineHandlers.length === 0, "count=" + inlineHandlers.length);

  for (const [label, text] of [
    ["index.html", html],
    ["style.css", css],
    ["hizmet-detay.js", siteSource],
    ["matrix.js", matrixSource],
    ["tezweb-3d.js", threeSource]
  ]) {
    const before = failures.length;
    checkNoLocalIdentity(text, label, failures);
    addCheck(
      checks,
      failures,
      label + " privacy",
      failures.length === before,
      failures.length === before ? "no local identity" : "local identity found"
    );
  }

  const cssBody = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const openBraces = (cssBody.match(/\{/g) || []).length;
  const closeBraces = (cssBody.match(/\}/g) || []).length;
  addCheck(checks, failures, "CSS balanced braces", openBraces === closeBraces, openBraces + "/" + closeBraces);

  const energyRules = (cssBody.match(/\.energy-ring\s*\{/g) || []).length;
  addCheck(checks, failures, "CSS exactly one .energy-ring rule", energyRules === 1, "count=" + energyRules);
  addCheck(
    checks,
    failures,
    "CSS @keyframes pulseRing",
    /@keyframes\s+pulseRing\b/.test(cssBody),
    "animation keyframes present"
  );
  addCheck(checks, failures, "CSS no ringPulse", !/\bringPulse\b/i.test(cssBody), "legacy token absent");
  addCheck(checks, failures, "CSS no !important", !/!important/i.test(cssBody), "declaration absent");

  const logoRules = Array.from(cssBody.matchAll(/\.brand__logo\s*\{([^}]*)\}/g), (match) => match[1]);
  const logoMaxima = [];
  for (const rule of logoRules) {
    for (const sizeMatch of rule.matchAll(/(?:max-inline-size|max-block-size|max-width|max-height)\s*:\s*(\d+(?:\.\d+)?)px/g)) {
      logoMaxima.push(Number(sizeMatch[1]));
    }
  }
  addCheck(
    checks,
    failures,
    "CSS one .brand__logo with max <= 40px",
    logoRules.length === 1 && logoMaxima.length > 0 && logoMaxima.every((size) => size <= 40),
    "rules=" + logoRules.length + ", maxima=[" + logoMaxima.join(",") + "]"
  );

  addCheck(
    checks,
    failures,
    "HTML 3D module and preloader linked",
    html.includes('<script src="tezweb-3d.js" defer></script>') &&
      html.includes('id="nztPreloader"') && html.includes("nzt-preloader__circuit"),
    "classic deferred module and circuit markup present"
  );
  addCheck(
    checks,
    failures,
    "HTML hero scene canvas",
    html.includes('id="nztSceneCanvas"'),
    "3D scene canvas present in hero"
  );
  const kpiNodes = (html.match(/data-kpi-value/g) || []).length;
  addCheck(
    checks,
    failures,
    "HTML four KPI counters",
    kpiNodes === 4 &&
      html.includes("Tamamlanan Proje") && html.includes("Uzmanlık Alanı") &&
      html.includes("Müşteri Memnuniyeti") && html.includes("Kesintisiz Destek"),
    "nodes=" + kpiNodes
  );
  const partnersPresent = ["hikvision", "n2mobil", "lavox"].every(
    (name) => html.includes('data-partner="' + name + '"')
  );
  addCheck(
    checks,
    failures,
    "HTML luxury partner marquee",
    partnersPresent && html.includes("partner-marquee__track") &&
      html.includes("partner-marquee__svg") && html.includes("LAVOX"),
    "three partners with duplicated seamless track"
  );
  addCheck(
    checks,
    failures,
    "CSS 3D component rules",
    /@keyframes\s+nzt-marquee\b/.test(cssBody) && cssBody.includes(".nzt-kpi__inner") &&
      cssBody.includes(".product-viewer__stage") && /\.card-hover::before/.test(cssBody),
    "marquee, counters, viewer and card spotlight styles present"
  );
  addCheck(
    checks,
    failures,
    "JS 0.8s circuit preloader",
    /PRELOADER_VISIBLE_MS\s*=\s*800\b/.test(threeSource) && threeSource.includes("is-complete"),
    "800ms lifecycle with smooth completion class"
  );
  addCheck(
    checks,
    failures,
    "JS hero wireframe and depth particles",
    threeSource.includes("buildWireframe") && threeSource.includes("renderParticles") &&
      threeSource.includes("pointermove"),
    "projected sphere, particle depth and pointer reactivity"
  );
  addCheck(
    checks,
    failures,
    "JS scroll-triggered counters",
    threeSource.includes("data-kpi-value") && threeSource.includes("IntersectionObserver"),
    "counter controller and viewport trigger present"
  );
  addCheck(
    checks,
    failures,
    "JS 3D product viewer",
    threeSource.includes("data-product-viewer") && threeSource.includes("ZOOM_STEP") &&
      threeSource.includes('"wheel"') && threeSource.includes("aria-label"),
    "modal-local viewer with wheel and plus/minus zoom"
  );
  addCheck(
    checks,
    failures,
    "Catalog 5 N2MOBIL showcase",
    siteSource.includes("N2MOBİL GPS cihazları") &&
      siteSource.includes("Yetkili bayi desteğiyle kurulum") &&
      siteSource.includes("figure.tabIndex = 0"),
    "fleet tracking details and keyboard-accessible product photos"
  );

  return { checks, failures };
}

function addElement(documentRef, tagName, options) {
  const element = documentRef.createElement(tagName);
  if (options.id) {
    element.id = options.id;
  }
  if (options.className) {
    element.className = options.className;
  }
  for (const [name, value] of Object.entries(options.attributes || {})) {
    element.setAttribute(name, value);
  }
  (options.parent || documentRef.body).appendChild(element);
  return element;
}

function buildFixture() {
  const documentRef = createDocument();
  const services = addElement(documentRef, "section", { id: "hizmetler", parent: documentRef.body });
  const grid = addElement(documentRef, "div", { className: "grid", parent: services });
  const cards = [];
  for (let id = 1; id <= 8; id += 1) {
    cards.push(
      addElement(documentRef, "div", {
        className: "card-hover reveal",
        parent: grid,
        attributes: {
          "data-catalog": String(id),
          tabindex: "0",
          role: "button",
          "aria-haspopup": "dialog"
        }
      })
    );
  }

  const greetingLinks = [
    addElement(documentRef, "a", {
      className: "greeting",
      parent: documentRef.body,
      attributes: { "data-whatsapp-greeting": "", href: "https://wa.me/905013731859?text=initial" }
    })
  ];

  const root = addElement(documentRef, "div", {
    id: "naztechModal",
    className: "modal",
    parent: documentRef.body,
    attributes: { hidden: "", "aria-hidden": "true", role: "dialog" }
  });
  const backdrop = addElement(documentRef, "div", {
    className: "modal__backdrop",
    parent: root,
    attributes: { "data-modal-close": "", "aria-hidden": "true" }
  });
  const panel = addElement(documentRef, "div", {
    id: "modalBox",
    className: "modal__panel",
    parent: root,
    attributes: { role: "document", tabindex: "-1" }
  });
  const closeButton = addElement(documentRef, "button", {
    id: "closeModal",
    className: "modal__close",
    parent: panel,
    attributes: { type: "button", "data-modal-close": "" }
  });
  const banner = addElement(documentRef, "div", {
    id: "mBanner",
    className: "sponsor-banner",
    parent: panel,
    attributes: { hidden: "" }
  });
  const bannerLogo = addElement(documentRef, "span", {
    className: "sponsor-banner__logo",
    parent: banner
  });
  const bannerText = addElement(documentRef, "span", {
    className: "sponsor-banner__text",
    parent: banner
  });
  const gallery = addElement(documentRef, "div", { id: "modalGallery", className: "modal__gallery", parent: panel });
  const content = addElement(documentRef, "div", { className: "modal__content", parent: panel });
  const badge = addElement(documentRef, "span", { id: "modalBadge", className: "modal__badge", parent: content });
  const title = addElement(documentRef, "h2", { id: "modalTitle", className: "modal__title", parent: content });
  const description = addElement(documentRef, "p", { id: "modalDescription", className: "modal__description", parent: content });
  const specs = addElement(documentRef, "ul", { id: "modalSpecs", className: "modal__specs", parent: content });
  const whatsapp = addElement(documentRef, "a", {
    id: "modalWhatsApp",
    className: "btn--whatsapp",
    parent: content,
    attributes: { href: "https://wa.me/905013731859?text=initial" }
  });

  return {
    doc: documentRef,
    cards,
    greetingLinks,
    root,
    backdrop,
    panel,
    closeButton,
    banner,
    bannerLogo,
    bannerText,
    gallery,
    badge,
    title,
    description,
    specs,
    whatsapp
  };
}

function snapshot(context) {
  return {
    rootHidden: context.root.hidden,
    rootAria: context.root.getAttribute("aria-hidden"),
    rootClass: context.root.className,
    bodyClass: context.doc.body.className,
    activeElement: context.doc.activeElement
      ? context.doc.activeElement.id || context.doc.activeElement.tagName
      : null,
    figures: context.gallery.querySelectorAll("figure").length,
    specs: context.specs.querySelectorAll("li").length,
    bannerHidden: context.banner.hidden,
    whatsappHref: context.whatsapp.getAttribute("href"),
    badge: context.badge.textContent,
    title: context.title.textContent,
    description: context.description.textContent,
    bannerLogo: context.bannerLogo.textContent,
    bannerText: context.bannerText.textContent,
    greetingHrefs: context.greetingLinks.map((link) => link.getAttribute("href")),
    cards: context.cards.map((card) => ({ dataset: card.dataset.catalog, className: card.className }))
  };
}

function describeInput(value) {
  if (value === null) {
    return "null";
  }
  const type = typeof value;
  if (value === undefined) {
    return "undefined";
  }
  if (type === "string") {
    const length = value.length;
    const preview = length > 64 ? value.slice(0, 48) + "…(+" + (length - 48) + ")" : value;
    return "string(len=" + length + ") " + JSON.stringify(preview);
  }
  if (type === "number") {
    const rendered = Number.isNaN(value) ? "NaN" : value === Infinity ? "Infinity" : value === -Infinity ? "-Infinity" : String(value);
    return "number(" + rendered + ")";
  }
  if (type === "boolean" || type === "bigint") {
    return type + "(" + String(value) + ")";
  }
  if (type === "symbol") {
    return "symbol(" + String(value) + ")";
  }
  if (type === "function") {
    return "function(" + (value.name || "anonymous") + ")";
  }
  try {
    return "object(" + Object.prototype.toString.call(value) + ")";
  } catch (_error) {
    return "object(<hostile-proxy>)";
  }
}

const MALFORMED_INPUTS = [
  null,
  undefined,
  0,
  9,
  "01",
  "abc",
  "<script>alert(1)</script>",
  "' OR '1'='1' --",
  -1,
  true,
  false,
  {},
  [],
  NaN,
  Infinity,
  "9"
];

const PROTOTYPE_PROBES = [
  Object.create(null),
  new String("1"),
  { toString: () => "1" },
  { valueOf: () => "1" },
  new Number(1),
  ["1"],
  Symbol("1"),
  1n,
  Object.create({ catalog: "1" }),
  { __proto__: { catalog: "1" }, catalog: undefined },
  new Proxy({}, { get() { throw new Error("hostile get"); }, set() { throw new Error("hostile set"); } }),
  { catalog: "1", toString: "not-a-function" }
];

const BOUNDARY_INPUTS = [
  "\u0000",
  "1\u0000",
  "\u00001",
  "\uFF11",
  "\uFF11\uFF11",
  "1".repeat(10000),
  " ".repeat(10000) + "9",
  "\u202E1\u202C",
  "9\n",
  "\r9\t",
  "\u01311",
  "\uD800"
];

const WHITESPACE_INPUTS = [" ", "\t", "\n", "   "];

const MUTATIONS = [
  (context) => { context.cards[0].dataset.catalog = "9"; },
  (context) => { context.cards[0].setAttribute("aria-label", "mutated"); },
  (context) => { context.gallery.appendChild(context.doc.createElement("figure")); },
  (context) => { context.specs.replaceChildren(); },
  (context) => { context.banner.hidden = false; },
  (context) => { context.bannerLogo.textContent = "MUTATED"; },
  (context) => { context.root.setAttribute("aria-hidden", "true"); },
  (context) => { context.root.classList.remove("modal--sponsor"); },
  (context) => { context.whatsapp.href = "https://example.invalid/"; },
  (context) => { context.doc.body.classList.remove("is-modal-open"); },
  (context) => { context.badge.textContent = "MUTATED"; },
  (context) => { context.title.textContent = "MUTATED"; }
];

function buildScenarioPlan() {
  const scenarios = [];
  for (let id = 1; id <= 8; id += 1) {
    for (let repetition = 0; repetition < 5; repetition += 1) {
      scenarios.push({
        scenario_class: "valid",
        input: String(id),
        expectedId: String(id),
        mutationIndex: null
      });
    }
  }
  for (const input of ["", "", "", ""]) {
    scenarios.push({ scenario_class: "empty", input, expectedId: null, mutationIndex: null });
  }
  for (const input of WHITESPACE_INPUTS) {
    scenarios.push({ scenario_class: "whitespace", input, expectedId: null, mutationIndex: null });
  }
  for (const input of MALFORMED_INPUTS) {
    scenarios.push({ scenario_class: "malformed", input, expectedId: null, mutationIndex: null });
  }
  for (const input of PROTOTYPE_PROBES) {
    scenarios.push({ scenario_class: "prototype", input, expectedId: null, mutationIndex: null });
  }
  for (const input of BOUNDARY_INPUTS) {
    scenarios.push({ scenario_class: "boundary", input, expectedId: null, mutationIndex: null });
  }
  for (let index = 0; index < 12; index += 1) {
    scenarios.push({
      scenario_class: "mutation-after-open",
      input: String((index % 8) + 1),
      expectedId: String((index % 8) + 1),
      mutationIndex: index
    });
  }
  assert(scenarios.length === TOTAL_ITERATIONS, "plan length must be 100");

  let seed = LCG_SEED >>> 0;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let index = scenarios.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const temporary = scenarios[index];
    scenarios[index] = scenarios[swapIndex];
    scenarios[swapIndex] = temporary;
  }
  scenarios.forEach((scenario, index) => {
    scenario.iteration = index + 1;
    scenario.closePath = CLOSE_PATHS[index % CLOSE_PATHS.length];
  });
  return scenarios;
}

function closeVia(closePath, context, controller) {
  if (closePath === "controller") {
    return controller.close();
  }
  if (closePath === "escape") {
    context.doc.dispatchEvent({ type: "keydown", key: "Escape" });
    return true;
  }
  context.backdrop.dispatchEvent({ type: "click" });
  return true;
}

function assertClosedAndRestored(context, expectedFocus) {
  assert(context.root.hidden === true, "root.hidden must be true after close");
  assert(context.root.getAttribute("aria-hidden") === "true", "aria-hidden must be true after close");
  assert(!context.doc.body.classList.contains("is-modal-open"), "body.is-modal-open must be removed");
  assert(context.doc.activeElement === expectedFocus, "focus must return to the invoking card");
}

function executeValid(scenario, context, api, controller) {
  const id = scenario.expectedId;
  const card = context.cards[Number(id) - 1];
  assert(api.normalizeCatalogId(" \t" + id + "\r\n") === id, "valid id must survive surrounding whitespace");

  context.doc.activeElement = card;
  card.dispatchEvent({ type: "click" });
  assert(context.root.hidden === false, "bound card click must open the modal");
  context.closeButton.dispatchEvent({ type: "click" });
  assert(context.root.hidden === true, "close button click must close the modal");
  assert(!context.doc.body.classList.contains("is-modal-open"), "close button must clear body class");
  assert(context.doc.activeElement === card, "close button must restore focus");

  context.doc.activeElement = card;
  assert(controller.open(id) === true, "controller.open must accept a valid id");
  const catalog = api.getCatalog(id);
  assert(catalog && catalog.id === id, "catalog lookup must return the requested entry");
  assert(context.root.hidden === false, "open modal must be visible");
  assert(context.root.getAttribute("aria-hidden") === "false", "open modal aria-hidden must be false");

  const figureCount = context.gallery.querySelectorAll("figure").length;
  const specCount = context.specs.querySelectorAll("li").length;
  assert(figureCount === catalog.photos.length, "gallery figure count must equal photo count");
  assert(specCount === catalog.specs.length, "spec list count must equal spec count");
  assert(context.banner.hidden === !catalog.sponsor, "banner visibility must follow sponsor flag");
  assert(
    context.root.classList.contains("modal--sponsor") === Boolean(catalog.sponsor),
    "modal--sponsor class must follow sponsor flag"
  );
  assert(context.title.textContent === catalog.title, "title text must match catalog");
  assert(context.description.textContent === catalog.description, "description text must match catalog");
  assert(context.badge.textContent === catalog.badge, "badge text must match catalog");

  const expectedHref = "https://wa.me/" + api.WHATSAPP_NUMBER + "?text=" + encodeURIComponent(api.buildQuoteMessage(catalog));
  assert(context.whatsapp.getAttribute("href") === expectedHref, "WhatsApp quote URL must be exact");
  assert(context.doc.activeElement === context.closeButton, "close button must receive initial focus");
  assert(context.doc.body.classList.contains("is-modal-open"), "body must carry is-modal-open while open");
  assert(controller.isOpen() === true, "controller.isOpen must be true while open");

  closeVia(scenario.closePath, context, controller);
  assertClosedAndRestored(context, card);
  assert(controller.isOpen() === false, "controller.isOpen must be false after close");
  return (
    "card-binding=ok; open=true; gallery=" + figureCount + "/" + catalog.photos.length +
    "; specs=" + specCount + "/" + catalog.specs.length + "; sponsor=" + Boolean(catalog.sponsor) +
    "; close=" + scenario.closePath + "; restored=true"
  );
}

function executeInvalid(scenario, context, api, controller) {
  const before = JSON.stringify(snapshot(context));
  assert(api.normalizeCatalogId(scenario.input) === null, "normalizeCatalogId must reject invalid input");
  assert(api.getCatalog(scenario.input) === null, "getCatalog must reject invalid input");
  assert(controller.open(scenario.input) === false, "controller.open must reject invalid input");
  assert(controller.isOpen() === false, "invalid open must not change controller state");
  assert(JSON.stringify(snapshot(context)) === before, "invalid open must not mutate the DOM or body");

  const hostileCard = context.doc.createElement("div");
  hostileCard.className = "card-hover";
  hostileCard.setAttribute("data-catalog", typeof scenario.input === "string" ? scenario.input : "x");
  api.bindCatalogCards([hostileCard], controller, context.doc);
  hostileCard.dispatchEvent({ type: "click" });
  assert(JSON.stringify(snapshot(context)) === before, "invalid bound card must stay inert");
  return "rejected; dom-unchanged; hostile-card-inert";
}

function executeMutation(scenario, context, api, controller) {
  const id = scenario.expectedId;
  const card = context.cards[Number(id) - 1];
  context.doc.activeElement = card;
  assert(controller.open(id) === true, "mutation scenario must start from an open modal");
  MUTATIONS[scenario.mutationIndex % MUTATIONS.length](context, api);
  assert(controller.isOpen() === true, "external DOM mutation must not corrupt controller state");
  closeVia(scenario.closePath, context, controller);
  assertClosedAndRestored(context, card);
  return (
    "open=true; mutation=" + scenario.mutationIndex + "; close=" + scenario.closePath +
    "; restored=true"
  );
}

function verifyApi(api) {
  assert(api, "window.NAZTECH_CATALOG must exist");
  const members = Object.keys(api);
  const expectedMembers = [
    "EVENT_OPEN", "EVENT_CLOSE", "WHATSAPP_NUMBER", "catalogs",
    "normalizeCatalogId", "getCatalog", "buildQuoteMessage", "buildQuoteUrl",
    "buildGreetingUrl", "createModalController", "bindCatalogCards",
    "applyCardSponsorAccents", "updateGreetingLinks", "bootstrap"
  ];
  assert(
    JSON.stringify(members.slice().sort()) === JSON.stringify(expectedMembers.slice().sort()),
    "public API must expose the expected 14 members, found " + members.length + ": " + members.join(",")
  );
  assert(Object.isFrozen(api), "public API must be frozen");
  assert(Object.isFrozen(api.catalogs), "catalog registry must be frozen");
  assert(api.catalogs instanceof Map, "catalog registry must be a Map");
  assert(api.catalogs.size === 8, "catalog registry must contain eight entries");
  assert(api.WHATSAPP_NUMBER === "905013731859", "WhatsApp number must be exact");
}

function main() {
  const siteSource = read("hizmet-detay.js");
  const preflight = runStaticPreflight();
  for (const check of preflight.checks) {
    console.log("PREFLIGHT " + (check.pass ? "PASS" : "FAIL") + " | " + check.name + " | " + check.detail);
  }
  if (preflight.failures.length > 0) {
    fs.writeFileSync(RESULTS_PATH, "");
    console.log("PREFLIGHT_ABORT=" + preflight.failures.length);
    console.log("TOTAL_RUNS=100 PASS=0 FAIL=100");
    console.log("STRESS_VERDICT: 0/100 PASS (preflight aborted)");
    process.exit(1);
  }

  const plan = buildScenarioPlan();
  fs.writeFileSync(RESULTS_PATH, "");
  let passed = 0;
  let failed = 0;
  let consoleErrors = 0;

  for (const scenario of plan) {
    const context = buildFixture();
    const consoleSpy = createConsoleSpy();
    const sandbox = {
      window: { addEventListener() {}, removeEventListener() {} },
      document: context.doc,
      console: consoleSpy,
      encodeURIComponent,
      Map,
      Object,
      String,
      Number,
      Math,
      JSON
    };

    let pass = false;
    let detail = "";
    try {
      vm.runInNewContext(siteSource, sandbox, {
        filename: "hizmet-detay.js",
        timeout: 5000
      });
      const api = sandbox.window.NAZTECH_CATALOG;
      verifyApi(api);
      const controller = api.createModalController(context.root, context.doc);
      assert(controller && typeof controller.open === "function", "controller creation failed");

      if (scenario.scenario_class === "valid") {
        detail = executeValid(scenario, context, api, controller);
      } else if (scenario.scenario_class === "mutation-after-open") {
        detail = executeMutation(scenario, context, api, controller);
      } else {
        detail = executeInvalid(scenario, context, api, controller);
      }
      pass = true;
    } catch (error) {
      detail = "FAIL: " + (error && error.message ? error.message : String(error));
    }

    const iterationErrors = consoleSpy.errorCount;
    consoleErrors += iterationErrors;
    if (iterationErrors > 0) {
      pass = false;
      detail += " | console.error=" + iterationErrors;
    }

    const row = {
      iteration: scenario.iteration,
      scenario_class: scenario.scenario_class,
      input: describeInput(scenario.input),
      pass,
      console_errors: iterationErrors,
      detail
    };
    fs.appendFileSync(RESULTS_PATH, JSON.stringify(row) + "\n");

    if (pass) {
      passed += 1;
    } else {
      failed += 1;
    }
    const progressInput = row.input.length > 72 ? row.input.slice(0, 69) + "..." : row.input;
    console.log(
      "RUN " + String(scenario.iteration).padStart(3, "0") +
      " " + (pass ? "PASS" : "FAIL") +
      " | class=" + scenario.scenario_class +
      " | input=" + progressInput +
      " | close=" + scenario.closePath +
      " | errors=" + iterationErrors +
      " | " + detail
    );
  }

  console.log("TOTAL_RUNS=" + TOTAL_ITERATIONS + " PASS=" + passed + " FAIL=" + failed);
  console.log("CONSOLE_ERRORS=" + consoleErrors);
  console.log("STRESS_VERDICT: " + passed + "/" + TOTAL_ITERATIONS + " PASS");
  if (passed !== TOTAL_ITERATIONS || failed !== 0 || consoleErrors !== 0) {
    process.exit(1);
  }
}

main();
