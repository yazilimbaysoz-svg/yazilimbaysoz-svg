/*
 * Baysöz Yazılım — 100x deterministic stress and fuzz harness for the
 * NAZTECH corporate portal controller. Contact: baysozlabs@proton.me
 *
 * Every run executes portal.js in a fresh vm context with a minimal DOM,
 * a frozen clock, a monotonic ID factory and a private localStorage stub.
 * No timers, no randomness, no network. Interactions go through dispatched
 * events so the same sequence is replayed byte-for-byte 100 times.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createConsoleSpy, createDocument } from "./dom-shim.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATH = path.join(ROOT, "portal.js");
const RESULTS_PATH = path.join(ROOT, "artifacts", "portal-stress-results.jsonl");
const TOTAL_ITERATIONS = 100;
const FIXED_CLOCK = "2026-11-24T09:00:00.000Z";
const LCG_SEED = 20261124;
const CATEGORIES = ["valid", "empty", "malformed", "boundary"];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function addCheck(checks, failures, name, condition, detail) {
  checks.push({ name, pass: Boolean(condition), detail });
  if (!condition) {
    failures.push(`${name}: ${detail}`);
  }
}

function nextRandom(state) {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

function privacyPatterns() {
  const localPath = /(?:[/]home[/]|[/]Users[/]|[/]root[/]|[/]tmp[/]|[A-Za-z]:\\)/i;
  const username = process.env.USER || process.env.USERNAME || os.userInfo().username;
  const usernamePattern = username && username.length >= 3
    ? new RegExp("\\b" + username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i")
    : null;
  return { localPath, usernamePattern };
}

function runStaticPreflight() {
  const checks = [];
  const failures = [];
  const scriptSource = read("portal.js");
  const styleSource = read("portal.css");
  const html = read("index.html");

  const syntax = spawnSync(process.execPath, ["--check", "portal.js"], { cwd: ROOT, encoding: "utf8" });
  addCheck(checks, failures, "node --check portal.js", syntax.status === 0, syntax.stderr.trim() || "clean");

  const { localPath, usernamePattern } = privacyPatterns();
  const newFiles = { "portal.js": scriptSource, "portal.css": styleSource };
  for (const [name, source] of Object.entries(newFiles)) {
    addCheck(checks, failures, `${name}: branding`, source.includes("Baysöz Yazılım") && source.includes("baysozlabs@proton.me"), "publisher header present");
    addCheck(checks, failures, `${name}: no local path`, !localPath.test(source), "absolute path absent");
    addCheck(checks, failures, `${name}: no OS username`, !usernamePattern || !usernamePattern.test(source), "username absent");
  }
  addCheck(checks, failures, "portal.js: no console calls", !/console\s*\./.test(scriptSource), "zero console output");
  addCheck(checks, failures, "portal.js: no innerHTML", !/innerHTML/.test(scriptSource), "createElement only");
  addCheck(checks, failures, "portal.js: no Math.random", !/Math\.random/.test(scriptSource), "deterministic state");
  addCheck(checks, failures, "portal.js: no Date.now", !/Date\.now/.test(scriptSource), "injected clock only");
  addCheck(checks, failures, "portal.css: scoped selectors", !/\n(?::root|\*|body|html|button|input|a)\s*\{/.test(styleSource), "no global selectors");
  addCheck(checks, failures, "portal.css: catalog overlay dominance", /z-index:\s*10000\s*!important/.test(styleSource), "10000 !important present");

  addCheck(checks, failures, "index.html: CSP unchanged", html.includes("connect-src 'self'") && html.includes("default-src 'self'"), "original CSP meta intact");
  addCheck(checks, failures, "index.html: stylesheet once", (html.match(/href="portal\.css"/g) || []).length === 1, "single stylesheet link");
  addCheck(checks, failures, "index.html: script once", (html.match(/src="portal\.js"/g) || []).length === 1, "single deferred script");
  addCheck(checks, failures, "index.html: nav trigger", html.includes('id="nzpNavButton"') && html.includes('data-nzp-action="open-auth"'), "gold trigger wired");
  addCheck(checks, failures, "index.html: existing CTA intact", html.includes("Hızlı Teklif Al") && html.includes("data-whatsapp-greeting"), "layout preserved");
  for (const [name, source] of Object.entries({ "index.html": html })) {
    addCheck(checks, failures, `${name}: no local path`, !localPath.test(source), "absolute path absent");
    addCheck(checks, failures, `${name}: no OS username`, !usernamePattern || !usernamePattern.test(source), "username absent");
  }

  return { checks, failures };
}

function addElement(documentRef, tagName, options) {
  const node = documentRef.createElement(tagName);
  if (options.id) node.id = options.id;
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  for (const [name, value] of Object.entries(options.attributes || {})) {
    node.setAttribute(name, value);
  }
  (options.parent || documentRef.body).appendChild(node);
  return node;
}

function createLocalStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(String(key)) ? map.get(String(key)) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(String(key)); }
  };
}

function buildFixture(scenario) {
  const doc = createDocument();
  const nav = addElement(doc, "button", {
    id: "nzpNavButton",
    attributes: { type: "button", "data-nzp-action": "open-auth" }
  });
  addElement(doc, "span", { id: "nzpNavLabel", parent: nav, text: "Müşteri Girişi" });
  addElement(doc, "span", { id: "nzpNavLabelShort", parent: nav, text: "Giriş" });
  addElement(doc, "span", { id: "nzpRoleBadge", parent: nav, attributes: { hidden: "" } });

  const storage = createLocalStorage();
  if (scenario.corruptStorage) {
    storage.setItem("nzp.v1.quotes", "{not-json");
    storage.setItem("nzp.v1.session", "null");
    storage.setItem("nzp.v1.tickets", '"array?"');
  }

  let fetchCount = 0;
  let sequence = 5000;
  const win = {
    localStorage: storage,
    NAZTECH_SUPABASE_CONFIG: scenario.config,
    NZP_TEST_CLOCK: FIXED_CLOCK,
    NZP_TEST_ID_FACTORY(prefix) {
      const number = sequence;
      sequence += 1;
      return `${prefix}-${String(number).padStart(6, "0")}`;
    },
    fetch(url, init) {
      fetchCount += 1;
      assert(url.includes("/rest/v1/"), "fetch target must be the REST endpoint");
      assert(init && init.headers && init.headers.apikey, "fetch must carry apikey");
      return Promise.resolve({ ok: false, status: 403 });
    }
  };
  doc.activeElement = nav;
  return { doc, nav, win, storage, getFetchCount: () => fetchCount };
}

function dispatch(node, type, extra) {
  const event = Object.assign(
    { type, target: node, preventDefault() {}, stopPropagation() {} },
    extra || {}
  );
  node.dispatchEvent(event);
  return event;
}

function setChecked(node, useAttribute) {
  if (useAttribute) {
    node.setAttribute("checked", "");
  } else {
    node.checked = true;
  }
}

function buildScenarioPlan() {
  const plan = [];
  const random = { seed: LCG_SEED };
  for (let index = 0; index < TOTAL_ITERATIONS; index += 1) {
    const category = CATEGORIES[Math.floor(index / 25)];
    const role = ["customer", "dealer", "admin"][Math.floor(nextRandom(random) * 3)];
    const config = category === "boundary"
      ? { url: "https://demo-project.supabase.co", anonKey: "sb_publishable_demo_key_1234567890" }
      : category === "malformed"
        ? { url: "http://not-supabase.example", anonKey: "" }
        : category === "empty" ? {} : undefined;
    plan.push({
      index: index + 1,
      category,
      role,
      config,
      corruptStorage: category === "malformed" && index % 2 === 0,
      useAttributeCheckbox: index % 2 === 0,
      useEscape: index % 3 === 0,
      useBackdrop: index % 3 === 1,
      payload: index % 7 === 0
        ? `<img src=x onerror="alert(1)"> <script>alert('x')</script> ğüşıöç`
        : `Kayıt ${index} · detay açıklaması`,
      expectedFetchCount: category === "boundary" ? 8 : 0
    });
  }
  return plan;
}

function verifyApi(api, scenario) {
  assert(api, "window.NaztechPortal must exist");
  assert(Object.isFrozen(api), "public API must be frozen");
  assert(api.version === "1.0.0", "version must be exact");
  assert(api.configState === (scenario.category === "boundary" ? "supabase" : "local"), "config state must reflect adapter");
  for (const name of ["openAuth", "openDashboard", "closeAll", "setTab", "resetDemoData", "getSession", "snapshot", "buildWorkOrder", "syncCloud"]) {
    assert(typeof api[name] === "function", `API member ${name} must be a function`);
  }
  assert(Object.keys(api).length === 11, "API surface must contain exactly 11 members");
}

function clickNode(node) {
  assert(node, "missing click target");
  dispatch(node, "click");
  return node;
}

function clickById(doc, id) {
  return clickNode(doc.getElementById(id));
}

function submitForm(doc, id) {
  const form = doc.getElementById(id);
  assert(form, `missing form #${id}`);
  dispatch(form, "submit");
}

function runScenario(scenario, scriptSource, baselineSnapshot) {
  const fixture = buildFixture(scenario);
  const { doc, nav, win } = fixture;
  const consoleSpy = createConsoleSpy();
  const sandbox = { window: win, document: doc, console: consoleSpy, encodeURIComponent };
  vm.runInNewContext(scriptSource, sandbox, { filename: "portal.js", timeout: 5000 });
  const api = win.NaztechPortal;
  verifyApi(api, scenario);

  const firstSnapshot = api.snapshot();
  assert(firstSnapshot === baselineSnapshot, "initial snapshot must be byte-identical across runs");

  const authRoot = doc.getElementById("nzpAuthOverlay");
  const dashRoot = doc.getElementById("nzpDashboardOverlay");
  assert(authRoot && dashRoot, "both overlays must be mounted");
  assert(authRoot.hidden && dashRoot.hidden, "overlays start hidden");
  assert(authRoot.getAttribute("aria-hidden") === "true", "auth overlay starts aria-hidden");
  assert(doc.getElementById("nzpNavLabel").textContent === "Müşteri Girişi", "logged-out nav label");

  dispatch(nav, "click");
  assert(!authRoot.hidden, "nav click must open auth overlay");
  assert(authRoot.getAttribute("aria-hidden") === "false", "open overlay must expose aria-hidden=false");
  assert(doc.body.classList.contains("nzp-scroll-locked"), "scroll lock must be applied");
  assert(doc.activeElement === doc.getElementById("nzpEmail"), "email field must receive focus");

  // Mode tabs and role tabs.
  clickById(doc, "nzpModeRegister");
  assert(!doc.getElementById("nzpFieldName").hidden, "register mode must show name field");
  assert(!doc.getElementById("nzpFieldKvkk").hidden, "register mode must show KVKK field");
  clickById(doc, "nzpModeForgot");
  assert(doc.getElementById("nzpFieldName").hidden, "forgot mode must hide name field");
  assert(doc.getElementById("nzpFieldPassword").hidden, "forgot mode must hide password field");
  setNodeValue(doc.getElementById("nzpEmail"), "forgot@naztech.local");
  submitForm(doc, "nzpAuthForm");
  assert(!doc.getElementById("nzpAuthInfo").hidden, "forgot mode must show local-only info");
  assert(doc.getElementById("nzpAuthError").textContent === "", "forgot mode must not raise an error");
  clickById(doc, "nzpModeLogin");

  // Validation path: KVKK unchecked in register mode must block submission.
  if (scenario.category === "valid" || scenario.category === "empty") {
    clickById(doc, "nzpModeRegister");
    clickById(doc, `nzpRole${scenario.role.charAt(0).toUpperCase()}${scenario.role.slice(1)}`);
    setNodeValue(doc.getElementById("nzpName"), "Test Kullanıcı");
    setNodeValue(doc.getElementById("nzpEmail"), `user${scenario.index}@naztech.local`);
    setNodeValue(doc.getElementById("nzpPassword"), "demo12345");
    setNodeValue(doc.getElementById("nzpPassword2"), "demo12345");
    submitForm(doc, "nzpAuthForm");
    assert(/KVKK/.test(doc.getElementById("nzpAuthError").textContent), "KVKK consent must be required");
    setChecked(doc.getElementById("nzpKvkk"), scenario.useAttributeCheckbox);
    submitForm(doc, "nzpAuthForm");
    assert(api.getSession(), "register must create a local demo session");
  } else {
    // Demo login is role-driven and never claims real authentication.
    const demoButton = doc.querySelector(`[data-nzp-action="demo-login"][data-nzp-role="${scenario.role}"]`);
    assert(demoButton, "demo login button must exist for each role");
    dispatch(demoButton, "click");
    assert(api.getSession().role === scenario.role, "demo login must set selected role");
  }

  assert(doc.getElementById("nzpNavLabel").textContent === "Hesabım", "authenticated nav label must be Hesabım");
  assert(doc.getElementById("nzpNavLabelShort").textContent === "Hesabım", "short nav label must switch");
  assert(doc.getElementById("nzpRoleBadge").hidden === false, "role badge must be visible");
  assert(doc.getElementById("nzpRoleBadge").textContent.length > 0, "role badge must carry role label");
  assert(!dashRoot.hidden, "login must open dashboard drawer");
  assert(authRoot.hidden, "login must close auth overlay");
  assert(doc.body.classList.contains("nzp-scroll-locked"), "dashboard must hold scroll lock");

  const isAdmin = api.getSession().role === "admin";
  assert(doc.getElementById("nzpTabAdmin").hidden === !isAdmin, "admin tab visibility must follow role");
  if (isAdmin) {
    clickById(doc, "nzpTabAdmin");
    assert(!doc.getElementById("nzpPane-admin").hidden, "admin pane must open for admin role");
    clickById(doc, "nzpTabQuotes");
  } else {
    assert(doc.getElementById("nzpPane-admin").hidden, "admin pane must stay hidden for non-admin role");
  }

  clickById(doc, "nzpTabDevices");
  assert(!doc.getElementById("nzpPane-devices").hidden, "devices tab must open");
  assert(doc.getElementById("nzpDeviceList").querySelectorAll(".nzp-card").length === 4, "four seeded devices must render");
  clickById(doc, "nzpTabQuotes");
  assert(doc.getElementById("nzpQuoteList").querySelectorAll(".nzp-card").length === 4, "four seeded quotes must render");

  // Keşif request from a quote.
  clickNode(doc.querySelector("[data-nzp-id]"));
  assert(!doc.getElementById("nzpPane-requests").hidden, "discovery must switch to requests tab");
  assert(!doc.getElementById("nzpTicketResult").hidden, "discovery must render a result");

  // Service ticket with hostile input and optional WhatsApp work order.
  setNodeValue(doc.getElementById("nzpRequestTitle"), `Arıza ${scenario.index}`);
  setNodeValue(doc.getElementById("nzpRequestDescription"), scenario.payload);
  setNodeValue(doc.getElementById("nzpRequestPriority"), "Kritik");
  setNodeValue(doc.getElementById("nzpRequestAddress"), "Karaköprü / Şanlıurfa");
  setNodeValue(doc.getElementById("nzpRequestPhone"), "05013731859");
  dispatch(doc.getElementById("nzpRequestForm"), "submit");
  assert(doc.getElementById("nzpRequestError").textContent === "", "valid ticket must not raise validation error");
  const resultHref = doc.getElementById("nzpResultWhatsApp").getAttribute("href");
  assert(resultHref.startsWith("https://wa.me/905013731859?text="), "WhatsApp link must target the exact number");
  assert(resultHref.includes(encodeURIComponent("Kritik")), "work order must be URI-encoded");
  assert(resultHref.includes(encodeURIComponent("05013731859")), "work order must carry phone");
  assert(doc.getElementById("nzpTicketList").querySelectorAll(".nzp-card").length >= 3, "new ticket must be listed");

  if (isAdmin) {
    clickById(doc, "nzpTabAdmin");
    const statusSelect = doc.getElementById("nzpAdminList").querySelector('[data-nzp-action="update-status"]');
    assert(statusSelect, "admin pane must expose status controls");
    setNodeValue(statusSelect, "Kapandı");
    dispatch(statusSelect, "change");
    assert(api.snapshot().includes("Kapandı"), "admin status update must persist");
  }

  // Cloud adapter failure fallback must never throw or log.
  assert(typeof api.syncCloud().then === "function", "syncCloud must return a thenable");
  assert(fixture.getFetchCount() === scenario.expectedFetchCount, "fetch count must match config state");

  // Close paths, scroll-lock release and focus restoration.
  if (scenario.useEscape) {
    dispatch(doc, "keydown", { key: "Escape" });
  } else if (scenario.useBackdrop) {
    dispatch(dashRoot.querySelector(".nzp-backdrop"), "click");
  } else {
    clickNode(dashRoot.querySelector(".nzp-close"));
  }
  assert(dashRoot.hidden, "dashboard must be hidden after close");
  assert(!doc.body.classList.contains("nzp-scroll-locked"), "scroll lock must be released");
  assert(doc.activeElement === nav, "focus must return to nav trigger");

  // Logout path.
  api.openDashboard();
  clickById(doc, "nzpLogoutBtn");
  assert(api.getSession() === null, "logout must clear the local session");
  assert(doc.getElementById("nzpNavLabel").textContent === "Müşteri Girişi", "logout must restore nav label");
  assert(doc.getElementById("nzpRoleBadge").hidden === true, "logout must hide role badge");

  // Hostile events must be inert.
  const hostile = doc.createElement("div");
  doc.body.appendChild(hostile);
  dispatch(hostile, "click");
  dispatch(hostile, "change");
  api.closeAll();
  api.setTab("admin");
  assert(doc.getElementById("nzpAuthOverlay").hidden, "hostile events must not open overlays");

  assert(consoleSpy.errorCount === 0, `console errors: ${consoleSpy.errors.join(" | ")}`);
  return `role=${scenario.role}; category=${scenario.category}; payload=${scenario.payload.slice(0, 12)}; console=0; fetch=${fixture.getFetchCount()}`;
}

function setNodeValue(node, value) {
  if (!node) {
    throw new Error("missing node for setNodeValue");
  }
  node.value = String(value);
}

function main() {
  const preflight = runStaticPreflight();
  for (const check of preflight.checks) {
    console.log(`PREFLIGHT ${check.pass ? "PASS" : "FAIL"} | ${check.name} | ${check.detail}`);
  }
  if (preflight.failures.length > 0) {
    fs.writeFileSync(RESULTS_PATH, "");
    console.log(`PREFLIGHT_ABORT=${preflight.failures.length}`);
    console.log("TOTAL_RUNS=100 PASS=0 FAIL=100");
    console.log("PORTAL_STRESS_VERDICT: 0/100 PASS (preflight aborted)");
    process.exit(1);
  }

  const scriptSource = read("portal.js");
  const plan = buildScenarioPlan();
  const firstFixture = buildFixture(plan[0]);
  const bootSandbox = {
    window: firstFixture.win,
    document: firstFixture.doc,
    console: createConsoleSpy(),
    encodeURIComponent
  };
  vm.runInNewContext(scriptSource, bootSandbox, { filename: "portal.js", timeout: 5000 });
  const baselineSnapshot = firstFixture.win.NaztechPortal.snapshot();

  fs.writeFileSync(RESULTS_PATH, "");
  let passed = 0;
  let failed = 0;
  for (const scenario of plan) {
    const started = Date.now();
    try {
      const detail = runScenario(scenario, scriptSource, baselineSnapshot);
      passed += 1;
      fs.appendFileSync(RESULTS_PATH, JSON.stringify({
        run: scenario.index,
        category: scenario.category,
        role: scenario.role,
        result: "PASS",
        detail,
        elapsedMs: Date.now() - started
      }) + "\n");
    } catch (error) {
      failed += 1;
      fs.appendFileSync(RESULTS_PATH, JSON.stringify({
        run: scenario.index,
        category: scenario.category,
        role: scenario.role,
        result: "FAIL",
        error: String(error && error.stack ? error.stack : error),
        elapsedMs: Date.now() - started
      }) + "\n");
    }
  }

  console.log(`BASELINE_SNAPSHOT_LENGTH=${baselineSnapshot.length}`);
  console.log(`TOTAL_RUNS=${TOTAL_ITERATIONS} PASS=${passed} FAIL=${failed}`);
  console.log(`PORTAL_STRESS_VERDICT: ${passed}/100 PASS`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
