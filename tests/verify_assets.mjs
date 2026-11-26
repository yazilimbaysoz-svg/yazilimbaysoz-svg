/*
 * Baysöz Yazılım — Authentic asset and WebGL delivery verification.
 * Contact: baysozlabs@proton.me
 *
 * Pure Node.js checks for the vendored Three.js build, authentic partner
 * artwork, authored fallback SVGs, provenance metadata and static markup.
 * The module is importable by the 100x WebGL harness and runnable standalone.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const EXPECTED = Object.freeze({
  threeSha256: "170c6789f43217c96b3170f4b42fafe135de7f7cd48497a4218f9757ee1d49fa",
  threeSha384Base64: "qOkzR5Ke/XkQxuGVJ9hpFEpDlcoLtWwVYhnJf06cLIZa2vaIptSqaubivErzmD5O",
  threeBytes: 669884,
  licenseSha256: "852e0e8699169bf9f6fdc6bda3e682d078dcbc738b5d33e74df594721bff271d",
  licenseBytes: 1081,
  n2Sha256: "64b4a2604401f8429ff8d414d1dd5a63a7cdb74549ae011fad23afc5881886e5",
  n2Bytes: 2427,
  n2Width: 190,
  n2Height: 45,
  lavoxOriginalSha256: "ff9aadf5ef6da860d3a59c24c697cf1535cadc4d373a024ed90e120e6fecea3a",
  lavoxSha256: "bea431d74bbde1036a203ab6a6c9a34d876451e7f0b23dd5bb0802a20a53de1d",
  lavoxMaxBytes: 96 * 1024,
  lavoxWidth: 640,
  lavoxHeight: 330
});

const LOCAL_PATH = new RegExp(
  "(?:[/]" + "home" + "[/]|[/]" + "Users" + "[/]|[/]" + "root" + "[/]|[/]" + "tmp" + "[/]|[A-Za-z]:\\\\)",
  "i"
);

function readBytes(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function digest(bytes, algorithm) {
  return crypto.createHash(algorithm).update(bytes).digest("hex");
}

function sri(bytes) {
  return "sha384-" + crypto.createHash("sha384").update(bytes).digest("base64");
}

function pngInfo(bytes) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) {
    throw new Error("invalid PNG signature");
  }
  if (bytes.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error("missing PNG IHDR chunk");
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
    compression: bytes[26],
    filter: bytes[27],
    interlace: bytes[28]
  };
}

function stripMarkupNoise(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "");
}

function xmlWellFormed(text) {
  const body = text
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  if (!body.startsWith("<svg") || !body.endsWith("</svg>")) {
    return false;
  }
  const stack = [];
  const tagPattern = /<(\/?)([a-zA-Z][\w:-]*)\b([^>]*?)(\/?)>/g;
  let match;
  while ((match = tagPattern.exec(body)) !== null) {
    const closing = match[1] === "/";
    const name = match[2];
    const selfClosing = match[4] === "/";
    if (selfClosing) {
      continue;
    }
    if (closing) {
      if (stack.pop() !== name) {
        return false;
      }
    } else {
      stack.push(name);
    }
  }
  return stack.length === 0;
}

function extractDivBlocks(markup, className) {
  const needle = '<div class="' + className + '"';
  const blocks = [];
  let cursor = 0;
  while (true) {
    const start = markup.indexOf(needle, cursor);
    if (start === -1) {
      break;
    }
    const openEnd = markup.indexOf(">", start);
    if (openEnd === -1) {
      break;
    }
    const tagPattern = /<\/?div\b[^>]*>/g;
    tagPattern.lastIndex = openEnd + 1;
    let depth = 1;
    let match;
    while ((match = tagPattern.exec(markup)) !== null) {
      depth += match[0].startsWith("</") ? -1 : 1;
      if (depth === 0) {
        blocks.push({
          open: markup.slice(start, openEnd + 1),
          inner: markup.slice(openEnd + 1, match.index),
          full: markup.slice(start, tagPattern.lastIndex)
        });
        cursor = tagPattern.lastIndex;
        break;
      }
    }
    if (cursor === start || cursor <= openEnd) {
      break;
    }
  }
  return blocks;
}

function partnerOrder(block) {
  return Array.from(block.inner.matchAll(/data-partner="([^"]+)"/g), (match) => match[1]);
}

export function verifyAssets() {
  const checks = [];
  const failures = [];
  const add = (name, condition, detail) => {
    checks.push({ name, pass: Boolean(condition), detail });
    if (!condition) {
      failures.push(name + ": " + detail);
    }
  };

  const html = readText("index.html");
  const css = readText("style.css");
  const viewer = readText("webgl-3d-viewer.js");
  const catalog = readText("hizmet-detay.js");
  const three = readBytes("assets/vendor/three.js/three-0.160.0.min.js");
  const license = readBytes("assets/vendor/three.js/LICENSE-r160.txt");
  const n2 = readBytes("img/n2mobil_logo.png");
  const lavox = readBytes("img/lavox_logo.png");
  const n2Svg = readText("img/n2mobil_logo.svg");
  const lavoxSvg = readText("img/lavox_logo.svg");
  const provenance = JSON.parse(readText("img/LOGO_PROVENANCE.json"));

  add(
    "vendor three.js sha256",
    digest(three, "sha256") === EXPECTED.threeSha256 && three.length === EXPECTED.threeBytes,
    "bytes=" + three.length + ", sha256=" + digest(three, "sha256")
  );
  add(
    "vendor three.js SRI",
    sri(three) === "sha384-" + EXPECTED.threeSha384Base64,
    "computed=" + sri(three)
  );
  add(
    "three.js license sha256",
    digest(license, "sha256") === EXPECTED.licenseSha256 && license.length === EXPECTED.licenseBytes,
    "bytes=" + license.length + ", sha256=" + digest(license, "sha256")
  );
  add(
    "three.js license text",
    license.toString("utf8").includes("MIT License") && license.toString("utf8").includes("three.js"),
    "MIT license with three.js copyright present"
  );

  let n2Info = null;
  try {
    n2Info = pngInfo(n2);
  } catch (error) {
    add("N2Mobil PNG signature", false, error.message);
  }
  add(
    "N2Mobil official bytes and dimensions",
    Boolean(n2Info) &&
      digest(n2, "sha256") === EXPECTED.n2Sha256 &&
      n2.length === EXPECTED.n2Bytes &&
      n2Info.width === EXPECTED.n2Width &&
      n2Info.height === EXPECTED.n2Height &&
      n2Info.colorType === 3,
    Boolean(n2Info)
      ? "bytes=" + n2.length + ", " + n2Info.width + "x" + n2Info.height + ", colorType=" + n2Info.colorType
      : "unreadable PNG header"
  );

  let lavoxInfo = null;
  try {
    lavoxInfo = pngInfo(lavox);
  } catch (error) {
    add("Lavox PNG signature", false, error.message);
  }
  add(
    "Lavox derivative bytes and dimensions",
    Boolean(lavoxInfo) &&
      digest(lavox, "sha256") === EXPECTED.lavoxSha256 &&
      lavox.length <= EXPECTED.lavoxMaxBytes &&
      lavoxInfo.width === EXPECTED.lavoxWidth &&
      lavoxInfo.height === EXPECTED.lavoxHeight &&
      lavoxInfo.colorType === 6,
    Boolean(lavoxInfo)
      ? "bytes=" + lavox.length + ", " + lavoxInfo.width + "x" + lavoxInfo.height + ", colorType=" + lavoxInfo.colorType
      : "unreadable PNG header"
  );

  add(
    "authored SVG fallbacks are well formed",
    xmlWellFormed(n2Svg) && xmlWellFormed(lavoxSvg),
    "N2Mobil and Lavox SVG tag stacks closed"
  );
  add(
    "authored SVG fallbacks are identified as non-official",
    /non-official/i.test(n2Svg) && /non-official/i.test(lavoxSvg) &&
      n2Svg.includes("<title") && n2Svg.includes("<desc") &&
      lavoxSvg.includes("<title") && lavoxSvg.includes("<desc"),
    "title and desc present in both fallbacks"
  );
  add(
    "authored SVG fallbacks carry no inline handlers",
    !/\son[a-z]+\s*=/i.test(n2Svg) && !/\son[a-z]+\s*=/i.test(lavoxSvg),
    "count=0"
  );

  add(
    "provenance metadata complete",
    provenance.schema === "naztech.logo-provenance/1.1" &&
      provenance.retrieved_on === "2026-11-22" &&
      provenance.publisher.organization === "Baysöz Yazılım" &&
      provenance.publisher.contact === "baysozlabs@proton.me" &&
      Array.isArray(provenance.entries) && provenance.entries.length === 2,
    "schema=" + provenance.schema + ", entries=" + provenance.entries.length
  );
  const n2Entry = provenance.entries.find((entry) => entry.partner === "N2Mobil");
  const lavoxEntry = provenance.entries.find((entry) => entry.partner === "Lavox Elektronik");
  add(
    "provenance hashes match shipped assets",
    Boolean(n2Entry) && Boolean(lavoxEntry) &&
      n2Entry.original.sha256 === EXPECTED.n2Sha256 &&
      n2Entry.shipped_derivative.sha256 === EXPECTED.n2Sha256 &&
      lavoxEntry.original.sha256 === EXPECTED.lavoxOriginalSha256 &&
      lavoxEntry.shipped_derivative.sha256 === EXPECTED.lavoxSha256,
    "metadata hash chain verified"
  );
  add(
    "provenance source URLs exact",
    Boolean(n2Entry) && Boolean(lavoxEntry) &&
      n2Entry.source_url === "https://n2mobil.com/wp-content/uploads/2023/03/logo.png" &&
      lavoxEntry.source_url === "https://percdn.com/f/754106/bzR6YWFtNG0vcUp3ZUdFOVU1NG5hQT09/l/logo-61901291-sw5120sh2644.png",
    "official HTTPS source URLs recorded"
  );

  const groups = extractDivBlocks(stripMarkupNoise(html), "partner-marquee__group");
  add(
    "two seamless marquee groups",
    groups.length === 2 && partnerOrder(groups[0]).join(",") === "hikvision,n2mobil,lavox" &&
      partnerOrder(groups[1]).join(",") === "hikvision,n2mobil,lavox",
    "groups=" + groups.length + ", order=" + (groups[0] ? partnerOrder(groups[0]).join(",") : "none")
  );
  const normalizedGroups = groups.map((group) => group.inner.replace(/alt="[^"]*"/g, 'alt=""'));
  add(
    "marquee groups identical apart from decorative alt",
    groups.length === 2 && normalizedGroups[0] === normalizedGroups[1],
    groups.length === 2 ? "identical=" + (normalizedGroups[0] === normalizedGroups[1]) : "groups unavailable"
  );
  add(
    "second marquee group aria-hidden",
    groups.length === 2 && groups[1].open.includes('aria-hidden="true"') && !groups[0].open.includes("aria-hidden"),
    "decorative duplicate hidden from assistive technology"
  );

  const logoMatches = Array.from(
    html.matchAll(/<img\s+class="partner-marquee__logo"\s+src="([^"]+)"\s+data-logo-fallback="([^"]+)"\s+width="(\d+)"\s+height="(\d+)"[^>]*alt="([^"]*)"/g),
    (match) => ({ src: match[1], fallback: match[2], width: Number(match[3]), height: Number(match[4]), alt: match[5] })
  );
  add(
    "four real partner logo images",
    logoMatches.length === 4 &&
      logoMatches.filter((image) => image.src === "img/n2mobil_logo.png").length === 2 &&
      logoMatches.filter((image) => image.src === "img/lavox_logo.png").length === 2 &&
      logoMatches.every((image) => image.fallback === image.src.replace(".png", ".svg")) &&
      logoMatches.filter((image) => image.width === 190 && image.height === 45).length === 2 &&
      logoMatches.filter((image) => image.width === 640 && image.height === 330).length === 2,
    "images=" + logoMatches.length
  );
  add(
    "decorative duplicate logo alt text empty",
    logoMatches.filter((image) => image.alt === "").length === 2 &&
      logoMatches.filter((image) => image.alt.length > 0).length === 2,
    "two descriptive and two empty alt attributes"
  );
  add(
    "disclaimer and Baysöz attribution visible",
    html.includes(provenance.disclaimer) && html.includes("Baysöz Yazılım (baysozlabs@proton.me)") &&
      html.includes('class="partner-marquee__disclaimer"'),
    "exact provenance disclaimer rendered"
  );

  const deferredScripts = Array.from(
    html.matchAll(/<script src="([^"]+)" defer><\/script>/g),
    (match) => match[1]
  );
  /* The hardening layer is the final deferred classic script in the delivery chain. */
  const expectedScripts = ["matrix.js", "hizmet-detay.js", "tezweb-3d.js", "webgl-3d-viewer.js", "realistic-3d-models.js", "security-shield.js"];
  add(
    "classic deferred script order",
    JSON.stringify(deferredScripts) === JSON.stringify(expectedScripts),
    "order=" + deferredScripts.join(" -> ")
  );
  add(
    "no page-load Three.js script",
    !html.includes("three-0.160.0.min.js") && !html.includes("three.min.js"),
    "vendor build is injected only on catalog open"
  );
  add(
    "HTML free of inline handlers",
    !/\son[a-z]+\s*=/i.test(stripMarkupNoise(html)),
    "count=0"
  );
  add(
    "CSS provides logo chips and WebGL panel",
    css.includes(".partner-marquee__chip") && css.includes(".partner-marquee__logo") &&
      css.includes(".partner-marquee__disclaimer") && css.includes(".webgl-3d-viewer__stage") &&
      css.includes('.webgl-3d-viewer__status[hidden]') && css.includes("prefers-reduced-motion"),
    "all required style hooks present"
  );

  add(
    "viewer declares both CDN sources with SRI",
    viewer.includes("https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js") &&
      viewer.includes("https://unpkg.com/three@0.160.0/build/three.min.js") &&
      viewer.includes("sha384-" + EXPECTED.threeSha384Base64) &&
      viewer.includes("assets/vendor/three.js/three-0.160.0.min.js") &&
      viewer.includes('THREE.REVISION !== "160"'),
    "cdnjs -> unpkg -> local failover declared"
  );
  add(
    "shipped JavaScript is free of placeholders and console.error",
    !/\b(?:TODO|FIXME|stub|mock|fake)\b/i.test(viewer) &&
      !/\b(?:TODO|FIXME|stub|mock|fake)\b/i.test(catalog) &&
      !viewer.includes("console.error") && !catalog.includes("console.error"),
    "no placeholders and no error-channel writes"
  );
  add(
    "shipped files free of local identity",
    ![html, css, viewer, catalog, provenance.disclaimer].some((text) => LOCAL_PATH.test(text)),
    "no absolute local paths"
  );

  return { checks, failures };
}

function main() {
  const result = verifyAssets();
  for (const check of result.checks) {
    console.log("ASSET " + (check.pass ? "PASS" : "FAIL") + " | " + check.name + " | " + check.detail);
  }
  const passed = result.checks.length - result.failures.length;
  console.log("ASSET_TOTAL=" + result.checks.length + " PASS=" + passed + " FAIL=" + result.failures.length);
  console.log("ASSET_VERDICT: " + passed + "/" + result.checks.length + " PASS");
  if (result.failures.length > 0) {
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
