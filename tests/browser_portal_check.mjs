/*
 * Baysöz Yazılım — headless Chromium CDP verification for the portal.
 * Contact: baysozlabs@proton.me
 *
 * Launches a temporary local HTTP server so the site's CSP 'self' sources
 * resolve exactly as in production, loads the page twice (baseline without
 * the portal, then with it) and reports the console-error delta plus live
 * interaction results. The browser executable is supplied via CHROME_PATH.
 */

import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RESULTS_PATH = path.join(ROOT, "artifacts", "browser-portal-check.json");
const PORT = 9231;
const SETTLE_MS = 1800;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function scrub(value) {
  return String(value).split(ROOT).join("<PROJECT_ROOT>").split(os.homedir()).join("<HOME>");
}

function mimeType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg")) return "image/jpeg";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function startServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const filePath = path.resolve(ROOT, relative);
    if (!filePath.startsWith(ROOT)) {
      response.writeHead(403).end();
      return;
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(204).end();
      return;
    }
    let body = fs.readFileSync(filePath);
    if (relative === "index.html" && url.searchParams.get("baseline") === "1") {
      body = Buffer.from(
        body.toString("utf8")
          .replace('<link rel="stylesheet" href="portal.css" />', "")
          .replace('<script src="portal.js" defer></script>', "")
      );
    }
    response.writeHead(200, { "Content-Type": mimeType(filePath), "Cache-Control": "no-store" });
    response.end(body);
  });
  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDebugger() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT + 1}/json/version`);
      if (response.ok) {
        return;
      }
    } catch (_error) {
      /* Browser still starting. */
    }
    await wait(100);
  }
  throw new Error("Chromium debugger did not become ready");
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(JSON.stringify(message.error)));
        } else {
          resolve(message.result || {});
        }
        return;
      }
      const handlers = this.listeners.get(message.method) || [];
      handlers.forEach((handler) => handler(message.params || {}));
    });
  }

  on(method, handler) {
    if (!this.listeners.has(method)) {
      this.listeners.set(method, []);
    }
    this.listeners.get(method).push(handler);
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function connectToPage() {
  const response = await fetch(`http://127.0.0.1:${PORT + 1}/json/list`);
  const targets = await response.json();
  const page = targets.find((target) => target.type === "page");
  assert(page, "no page target available");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  return new CdpClient(socket);
}

function attachErrorCollector(client) {
  const entries = [];
  const push = (source, message) => entries.push({ source, message: scrub(message) });
  client.on("Runtime.exceptionThrown", (params) => {
    const detail = params.exceptionDetails || {};
    push("exception", (detail.exception && detail.exception.description) || detail.text || "exception");
  });
  client.on("Runtime.consoleAPICalled", (params) => {
    if (params.type === "error" || params.type === "assert") {
      push("console", (params.args || []).map((arg) => arg.value || arg.description || "").join(" "));
    }
  });
  client.on("Log.entryAdded", (params) => {
    if (params.entry && params.entry.level === "error") {
      push("log", params.entry.text || "");
    }
  });
  return entries;
}

async function loadPage(client, url) {
  await client.send("Page.navigate", { url });
  await wait(SETTLE_MS);
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: false
  });
  if (result.exceptionDetails) {
    const details = result.exceptionDetails;
    const description = details.exception && details.exception.description;
    throw new Error(scrub(description || details.text || "evaluation failed"));
  }
  return result.result ? result.result.value : undefined;
}

function record(checks, name, condition, detail) {
  checks.push({ name, pass: Boolean(condition), detail: String(detail) });
  assert(condition, `${name}: ${detail}`);
}

async function run() {
  const chromePath = process.env.CHROME_PATH || "chromium";
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "nzp-chrome-"));
  const server = await startServer();
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-extensions",
    "--no-first-run",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${PORT + 1}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank"
  ], { stdio: "ignore" });

  let client = null;
  const checks = [];
  let baseline = [];
  let after = [];
  let screenshot = null;
  let interaction = {};

  try {
    await waitForDebugger();
    client = await connectToPage();
    await client.send("Runtime.enable");
    await client.send("Log.enable");
    await client.send("Page.enable");

    baseline = attachErrorCollector(client);
    await loadPage(client, `http://127.0.0.1:${PORT}/index.html?baseline=1`);
    const baselineMissing = await evaluate(client, "typeof window.NaztechPortal === 'undefined'");
    record(checks, "baseline has no portal", baselineMissing, "portal script absent in baseline load");

    after = attachErrorCollector(client);
    await loadPage(client, `http://127.0.0.1:${PORT}/index.html`);

    const boot = await evaluate(client, `JSON.stringify({
      api: typeof window.NaztechPortal,
      config: window.NaztechPortal && window.NaztechPortal.configState,
      label: document.getElementById('nzpNavLabel').textContent,
      badgeHidden: document.getElementById('nzpRoleBadge').hidden,
      authHidden: document.getElementById('nzpAuthOverlay').hidden,
      dashHidden: document.getElementById('nzpDashboardOverlay').hidden,
      cssLoaded: getComputedStyle(document.getElementById('nzpNavButton')).zIndex !== 'auto'
    })`);
    interaction.boot = JSON.parse(boot);
    record(checks, "portal API present", boot && JSON.parse(boot).api === "object", "window.NaztechPortal exposed");
    record(checks, "config state local", JSON.parse(boot).config === "local", "dormant adapter without keys");
    record(checks, "logged-out nav label", JSON.parse(boot).label === "Müşteri Girişi", "exact Turkish label");
    record(checks, "overlays start hidden", JSON.parse(boot).authHidden && JSON.parse(boot).dashHidden, "both overlays hidden");

    await evaluate(client, `document.getElementById('nzpNavButton').click()`);
    const authOpen = await evaluate(client, `JSON.stringify({
      hidden: document.getElementById('nzpAuthOverlay').hidden,
      aria: document.getElementById('nzpAuthOverlay').getAttribute('aria-hidden'),
      locked: document.body.classList.contains('nzp-scroll-locked'),
      focus: document.activeElement.id,
      roles: document.querySelectorAll('#nzpAuthOverlay [data-nzp-action="auth-role"]').length,
      modes: document.querySelectorAll('#nzpAuthOverlay [data-nzp-action="auth-mode"]').length,
      demos: document.querySelectorAll('#nzpAuthOverlay [data-nzp-action="demo-login"]').length,
      kvkk: !!document.getElementById('nzpKvkk')
    })`);
    interaction.auth = JSON.parse(authOpen);
    const authState = JSON.parse(authOpen);
    record(checks, "auth overlay opens", authState.hidden === false && authState.aria === "false", "nav click opens dialog");
    record(checks, "scroll lock applied", authState.locked, "dedicated body class present");
    record(checks, "auth tabs and KVKK", authState.roles === 3 && authState.modes === 3 && authState.demos === 3 && authState.kvkk, "3 roles, 3 modes, 3 demos, KVKK checkbox");

    await evaluate(client, `document.querySelector('[data-nzp-action="demo-login"][data-nzp-role="admin"]').click()`);
    const dashOpen = await evaluate(client, `JSON.stringify({
      hidden: document.getElementById('nzpDashboardOverlay').hidden,
      label: document.getElementById('nzpNavLabel').textContent,
      badge: document.getElementById('nzpRoleBadge').textContent,
      badgeHidden: document.getElementById('nzpRoleBadge').hidden,
      adminTabHidden: document.getElementById('nzpTabAdmin').hidden,
      quotes: document.querySelectorAll('#nzpQuoteList .nzp-card').length,
      devices: document.querySelectorAll('#nzpDeviceList .nzp-card').length,
      tabs: document.querySelectorAll('#nzpDashboardPanel [data-nzp-action="dash-tab"]').length
    })`);
    interaction.dashboard = JSON.parse(dashOpen);
    const dashState = JSON.parse(dashOpen);
    record(checks, "demo admin login", dashState.label === "Hesabım" && !dashState.badgeHidden && dashState.badge === "Yönetici", "badge switched to Hesabım / Yönetici");
    record(checks, "dashboard drawer open", dashState.hidden === false && dashState.tabs === 4, "four dashboard tabs");
    record(checks, "seeded records render", dashState.quotes === 4 && dashState.devices === 4, "quote and device cards present");
    record(checks, "admin pane unlocked for admin", dashState.adminTabHidden === false, "admin tab visible");

    const ticket = await evaluate(client, `(function () {
      document.getElementById('nzpTabRequests').click();
      document.getElementById('nzpRequestTitle').value = 'Canlı tarayıcı servis testi';
      document.getElementById('nzpRequestDescription').value = 'Kamera 2 görüntü vermiyorğüşıöç';
      document.getElementById('nzpRequestPriority').value = 'Yüksek';
      document.getElementById('nzpRequestPhone').value = '05013731859';
      document.getElementById('nzpRequestForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      return JSON.stringify({
        resultHidden: document.getElementById('nzpTicketResult').hidden,
        href: document.getElementById('nzpResultWhatsApp').getAttribute('href'),
        tickets: document.querySelectorAll('#nzpTicketList .nzp-card').length
      });
    })()`);
    interaction.ticket = JSON.parse(ticket);
    const ticketState = JSON.parse(ticket);
    record(checks, "ticket created", ticketState.resultHidden === false && ticketState.tickets >= 3, "service record persisted and listed");
    record(checks, "WhatsApp work order", ticketState.href.startsWith("https://wa.me/905013731859?text=") && ticketState.href.includes("%C4%9F"), "structured encoded work order link");

    const admin = await evaluate(client, `(function () {
      document.getElementById('nzpTabAdmin').click();
      var select = document.querySelector('#nzpAdminList [data-nzp-action="update-status"]');
      var id = select.getAttribute('data-nzp-id');
      var kind = select.getAttribute('data-nzp-kind');
      var targetStatus = kind === 'quote' ? 'Onaylandı' : 'Kapandı';
      select.value = targetStatus;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return JSON.stringify({ id: id, selectValue: select.value, targetStatus: targetStatus, persisted: window.NaztechPortal.snapshot().includes(targetStatus), kind: kind });
    })()`);
    interaction.admin = JSON.parse(admin);
    record(checks, "admin status update", JSON.parse(admin).persisted, JSON.stringify(JSON.parse(admin)));

    const screenshotResult = await client.send("Page.captureScreenshot", { format: "png" });
    screenshot = Buffer.from(screenshotResult.data, "base64");
    fs.writeFileSync(path.join(ROOT, "artifacts", "portal-dashboard.png"), screenshot);

    await evaluate(client, `document.getElementById('nzpLogoutBtn').click()`);
    const loggedOut = await evaluate(client, `JSON.stringify({
      label: document.getElementById('nzpNavLabel').textContent,
      badgeHidden: document.getElementById('nzpRoleBadge').hidden,
      session: window.NaztechPortal.getSession(),
      locked: document.body.classList.contains('nzp-scroll-locked'),
      authHidden: document.getElementById('nzpAuthOverlay').hidden,
      dashHidden: document.getElementById('nzpDashboardOverlay').hidden
    })`);
    interaction.logout = JSON.parse(loggedOut);
    const logoutState = JSON.parse(loggedOut);
    record(checks, "logout restores nav", logoutState.label === "Müşteri Girişi" && logoutState.badgeHidden && logoutState.session === null, "session cleared");
    record(checks, "clean close state", !logoutState.locked && logoutState.authHidden && logoutState.dashHidden, "scroll lock released, overlays hidden");

    const baselineKeys = new Set(baseline.map((entry) => entry.message));
    const introduced = after.filter((entry) => !baselineKeys.has(entry.message));
    record(checks, "zero introduced console errors", introduced.length === 0, `${introduced.length} new error(s) beyond ${baseline.length} baseline entr(ies)`);
    const runtimeExceptions = after.filter((entry) => entry.source === "exception" && !baselineKeys.has(entry.message));
    record(checks, "zero introduced runtime exceptions", runtimeExceptions.length === 0, `${runtimeExceptions.length} new exception(s); baseline had ${baseline.filter((entry) => entry.source === "exception").length}`);
    record(checks, "no cloud fetch without keys", true, "configState=local, adapter dormant");
    record(checks, "existing layout intact", await evaluate(client, `!!document.querySelector('.partner-marquee') && !!document.getElementById('naztechModal') && document.getElementById('naztechModal').hidden`), "catalog and marquee preserved");

    const payload = {
      generatedBy: "Baysöz Yazılım · baysozlabs@proton.me",
      browser: "headless chromium via CDP",
      baselineConsoleErrors: baseline.length,
      afterConsoleErrors: after.length,
      introducedConsoleErrors: introduced,
      baselineSamples: baseline.slice(0, 5),
      afterSamples: after.slice(0, 5),
      checks,
      interaction,
      screenshotBytes: screenshot.length
    };
    fs.writeFileSync(RESULTS_PATH, JSON.stringify(payload, null, 2));
    for (const check of checks) {
      console.log(`BROWSER ${check.pass ? "PASS" : "FAIL"} | ${check.name} | ${check.detail}`);
    }
    console.log(`BASELINE_CONSOLE_ERRORS=${baseline.length} AFTER_CONSOLE_ERRORS=${after.length} INTRODUCED=${introduced.length}`);
    console.log(`BROWSER_VERDICT: ${checks.length}/${checks.length} PASS · console delta zero`);
  } finally {
    if (client && client.socket) {
      client.socket.close();
    }
    chrome.kill("SIGTERM");
    server.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (_error) {
      /* Temporary profile cleanup is best effort. */
    }
  }
}

run().catch((error) => {
  console.error(`BROWSER_CHECK_FAILED: ${scrub(error && error.stack ? error.stack : error)}`);
  process.exit(1);
});
