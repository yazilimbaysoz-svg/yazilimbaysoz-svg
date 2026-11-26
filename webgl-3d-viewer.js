/*
 * Baysöz Yazılım — NAZTECH WebGL hardware inspector.
 * Contact: baysozlabs@proton.me
 *
 * Classic deferred script. The module stays inert until a catalog-open event is
 * observed; Three.js r160 is injected lazily from the first available source
 * with Subresource Integrity on both CDN candidates. No browser global is
 * dereferenced at load time, so the file is safe to evaluate in a bare vm.
 */
(function () {
  "use strict";

  var EVENT_OPEN = "naztech:catalog-open";
  var EVENT_CLOSE = "naztech:catalog-close";
  var EVENT_SESSION_READY = "naztech:webgl-session-ready";
  var EVENT_SESSION_END = "naztech:webgl-session-end";

  var MODEL_IDS = Object.freeze(["1", "2", "3", "4", "5", "6", "7", "8"]);
  var PALETTE = Object.freeze({
    gold: 0xd4af37,
    goldLight: 0xf3d478,
    obsidian: 0x0d0e11,
    steel: 0x8c949f,
    steelDark: 0x333a45,
    blue: 0x4da3ff,
    red: 0xe11d48,
    glass: 0x0b1a2a
  });

  var DEFAULT_RADIUS = 6.2;
  var MIN_RADIUS = 3;
  var MAX_RADIUS = 12;
  var DEFAULT_YAW = 0;
  var DEFAULT_PITCH = 0.18;
  var ZOOM_FACTOR = 1.12;
  var MOUSE_SENSITIVITY = 0.006;
  var TOUCH_SENSITIVITY = 0.004;
  var KEY_ANGLE_STEP = 0.12;
  var AUTO_ROTATE_SPEED = 0.35;
  var LOAD_TIMEOUT_MS = 8000;
  var MESH_BUDGET_MIN = 30;
  var MESH_BUDGET_MAX = 199;
  var EXPECTED_COUNTS = Object.freeze({
    "1": 36, "2": 43, "3": 60, "4": 50, "5": 44, "6": 58, "7": 50, "8": 60
  });
  var SEGMENT_MIN = 8;
  var SEGMENT_MAX = 96;
  var MAX_TEXTURE_SIZE = 2048;
  var MAX_TEXTURE_LAYERS = 64;

  var PBR_CATALOG_IDS = Object.freeze({
    "1": true, "2": true, "3": true, "4": true
  });

  var STUDIO_LIGHT_PRESETS = Object.freeze({
    "1": Object.freeze({ ambient: 0.24, hemisphere: 0.5, key: 2.4, rim: 1.6, fill: 0.7 }),
    "2": Object.freeze({ ambient: 0.22, hemisphere: 0.48, key: 2.1, rim: 1.4, fill: 0.85 }),
    "3": Object.freeze({ ambient: 0.2, hemisphere: 0.45, key: 2.2, rim: 1.3, fill: 0.6 }),
    "4": Object.freeze({ ambient: 0.24, hemisphere: 0.5, key: 2.35, rim: 1.5, fill: 0.6 })
  });

  var SOURCE_INTEGRITY = "sha384-qOkzR5Ke/XkQxuGVJ9hpFEpDlcoLtWwVYhnJf06cLIZa2vaIptSqaubivErzmD5O";
  var SOURCES = Object.freeze([
    Object.freeze({
      url: "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js",
      integrity: SOURCE_INTEGRITY
    }),
    Object.freeze({
      url: "https://unpkg.com/three@0.160.0/build/three.min.js",
      integrity: SOURCE_INTEGRITY
    }),
    Object.freeze({
      url: "assets/vendor/three.js/three-0.160.0.min.js",
      integrity: null
    })
  ]);

  var PRIMITIVES = Object.freeze({
    box: "BoxGeometry",
    cylinder: "CylinderGeometry",
    sphere: "SphereGeometry",
    torus: "TorusGeometry",
    cone: "ConeGeometry",
    plane: "PlaneGeometry",
    circle: "CircleGeometry"
  });

  var ANIMATED_NAMES = Object.freeze([
    "status-led", "siren-led", "satellite", "scan-plane", "pir-dome",
    "display", "bell-striker", "inner-core", "telemetry-antenna", "alarm-bell",
    "ir-led-ring", "satellite-orbit"
  ]);

  var ANIMATED_PREFIXES = Object.freeze([
    "server-blade-", "blade-", "breaker-", "code-node-", "test-led",
    "ir-led-", "ir-emitter-", "siren-emitter-", "flow-led-", "indicator-", "display-pixel-",
    "keypad-status-", "tower-led-", "panel-led-", "relay-led-", "breaker-handle-",
    "switch-port-"
  ]);

  var EMPTY_DESCRIPTORS = Object.freeze([]);

  var PROFILE_KEYS = Object.freeze([
    "color", "metalness", "roughness", "envMapIntensity", "opacity",
    "transparent", "emissive", "emissiveIntensity", "physical",
    "clearcoat", "clearcoatRoughness", "depthWrite"
  ]);

  function finish(color, metalness, roughness, envMapIntensity, config) {
    var options = config || {};
    return Object.freeze({
      color: color,
      metalness: metalness,
      roughness: roughness,
      envMapIntensity: envMapIntensity,
      opacity: typeof options.opacity === "number" ? options.opacity : 1,
      transparent: Boolean(options.transparent),
      emissive: typeof options.emissive === "number" ? options.emissive : 0x000000,
      emissiveIntensity: typeof options.emissiveIntensity === "number" ? options.emissiveIntensity : 0,
      physical: Boolean(options.physical),
      clearcoat: typeof options.clearcoat === "number" ? options.clearcoat : 0,
      clearcoatRoughness: typeof options.clearcoatRoughness === "number" ? options.clearcoatRoughness : 0.25,
      depthWrite: options.depthWrite !== false
    });
  }

  var PBR_PROFILES = Object.freeze({
    cameraWhite: finish(0xf4f5f7, 0.12, 0.5, 0.7, { physical: true, clearcoat: 0.18 }),
    whiteEnamel: finish(0xe8edf2, 0.1, 0.42, 0.65, { physical: true, clearcoat: 0.24 }),
    glossBlack: finish(0x111317, 0.35, 0.16, 0.8, { physical: true, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
    opticalGlass: finish(0x223a66, 0.05, 0.08, 0.9, { physical: true, transparent: true, opacity: 0.84, depthWrite: false, clearcoat: 1 }),
    tintedGlass: finish(0x1d2733, 0.1, 0.12, 0.75, { physical: true, transparent: true, opacity: 0.38, depthWrite: false, clearcoat: 0.8 }),
    stainless: finish(0xb9c0c8, 0.92, 0.28, 0.8, { physical: true }),
    anodizedBlack: finish(0x212429, 0.88, 0.32, 0.6, { physical: true }),
    obsidian: finish(0x0d0e11, 0.25, 0.55, 0.45, {}),
    steelDark: finish(0x333a45, 0.7, 0.42, 0.55, {}),
    copper: finish(0xb87333, 0.95, 0.24, 0.85, { physical: true }),
    gold: finish(0xd4af37, 0.9, 0.24, 0.85, { physical: true }),
    goldLight: finish(0xf3d478, 0.85, 0.2, 0.9, { physical: true }),
    lcdBlue: finish(0x123a5e, 0.1, 0.24, 0.5, { emissive: 0x2e9fff, emissiveIntensity: 0.85 }),
    signalRed: finish(0x5a0d16, 0.05, 0.3, 0.4, { emissive: 0xff2744, emissiveIntensity: 1.1 }),
    signalGreen: finish(0x0d3a22, 0.05, 0.3, 0.4, { emissive: 0x37f59a, emissiveIntensity: 0.9 }),
    signalAmber: finish(0x4a2c08, 0.05, 0.3, 0.4, { emissive: 0xffb43d, emissiveIntensity: 0.95 }),
    ledGlow: finish(0x3b090c, 0.05, 0.26, 0.4, { emissive: 0xff3b30, emissiveIntensity: 1.3 }),
    rubber: finish(0x15171a, 0, 0.85, 0.3, {}),
    decal: finish(0xffffff, 0, 0.9, 0.4, {
      transparent: true, opacity: 1, depthWrite: false,
      emissive: 0xffffff, emissiveIntensity: 0.55
    })
  });

  var FALLBACK_PROFILE = finish(PALETTE.steel, 0.65, 0.34, 0.6, {});

  var LAYER_OPS = Object.freeze([
    "fillRect", "strokeRect", "text", "circle", "line", "radialGradient"
  ]);

  function layer(op, fields) {
    var entry = { op: op };
    for (var key in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        entry[key] = fields[key];
      }
    }
    return Object.freeze(entry);
  }

  function fill(x, y, width, height, color) {
    return layer("fillRect", { x: x, y: y, w: width, h: height, color: color });
  }

  function outline(x, y, width, height, color, lineWidth) {
    return layer("strokeRect", { x: x, y: y, w: width, h: height, color: color, lineWidth: lineWidth });
  }

  function text(value, x, y, font, color, align) {
    return layer("text", { text: value, x: x, y: y, font: font, color: color, align: align || "left" });
  }

  function circle(x, y, radius, color) {
    return layer("circle", { x: x, y: y, r: radius, color: color });
  }

  function line(x1, y1, x2, y2, color, lineWidth) {
    return layer("line", { x1: x1, y1: y1, x2: x2, y2: y2, color: color, lineWidth: lineWidth });
  }

  function glow(x, y, radius, inner, outer) {
    return layer("radialGradient", { x: x, y: y, r: radius, inner: inner, outer: outer });
  }

  function recipe(width, height, layers, doubleSided, emissive) {
    var frozenLayers = [];
    for (var index = 0; index < layers.length; index += 1) {
      frozenLayers.push(Object.freeze(layers[index]));
    }
    return Object.freeze({
      width: width,
      height: height,
      doubleSided: Boolean(doubleSided),
      emissive: Boolean(emissive),
      layers: Object.freeze(frozenLayers)
    });
  }

  var WHITE = "#f4f5f7";
  var INK = "#111317";
  var RED = "#e11d48";
  var BLUE = "#4da3ff";
  var AMBER = "#f3d478";

  var DECAL_RECIPES = Object.freeze({
    "hikvision-brand": recipe(512, 256, [
      fill(0, 0, 512, 256, WHITE),
      outline(8, 8, 496, 240, INK, 4),
      text("HIKVISION", 256, 112, "bold 62px Arial", INK, "center"),
      text("ColorVu 4K", 256, 168, "bold 34px Arial", RED, "center"),
      line(70, 188, 442, 188, RED, 6),
      circle(256, 212, 8, RED)
    ], true, false),
    "alarm-keypad": recipe(512, 256, [
      fill(0, 0, 512, 256, INK),
      text("NAZTECH", 256, 56, "bold 42px Arial", WHITE, "center"),
      text("ZONE 04", 256, 104, "bold 30px Arial", BLUE, "center"),
      text("ARM", 128, 168, "bold 34px Arial", AMBER, "center"),
      text("DISARM", 384, 168, "bold 34px Arial", AMBER, "center"),
      circle(128, 214, 10, RED), circle(384, 214, 10, BLUE)
    ], false, true),
    "alarm-lcd": recipe(512, 256, [
      fill(0, 0, 512, 256, "#082238"),
      outline(12, 12, 488, 232, BLUE, 4),
      text("ZONE 04", 256, 110, "bold 66px Arial", BLUE, "center"),
      text("READY / ARMED", 256, 182, "bold 34px Arial", WHITE, "center")
    ], false, true),
    "rack-asset": recipe(512, 256, [
      fill(0, 0, 512, 256, WHITE),
      outline(10, 10, 492, 236, INK, 4),
      text("NAZTECH", 256, 84, "bold 48px Arial", INK, "center"),
      text("RACK 19 / 42U", 256, 142, "bold 32px Arial", BLUE, "center"),
      text("ASSET NT-RK-042", 256, 196, "28px Arial", INK, "center")
    ], false, false),
    "rack-switch-map": recipe(512, 256, [
      fill(0, 0, 512, 256, INK),
      text("PORT MAP 01-08", 256, 60, "bold 34px Arial", WHITE, "center"),
      line(40, 90, 472, 90, BLUE, 3),
      circle(72, 150, 16, BLUE), circle(140, 150, 16, BLUE),
      circle(208, 150, 16, BLUE), circle(276, 150, 16, BLUE),
      circle(344, 150, 16, BLUE), circle(412, 150, 16, BLUE),
      text("LINK / ACT", 256, 218, "26px Arial", AMBER, "center")
    ], false, true),
    "rack-brand": recipe(512, 256, [
      fill(0, 0, 512, 256, "#0b1a2a"),
      text("NAZTECH", 256, 116, "bold 64px Arial", AMBER, "center"),
      text("SECURITY INFRASTRUCTURE", 256, 174, "bold 26px Arial", WHITE, "center"),
      line(60, 196, 452, 196, AMBER, 4)
    ], false, false),
    "fuel-readout": recipe(512, 256, [
      fill(0, 0, 512, 256, "#07121f"),
      glow(256, 128, 230, "#143c5e", "#07121f"),
      outline(14, 14, 484, 228, BLUE, 4),
      text("VOLUME 42.8 L", 256, 104, "bold 44px Arial", BLUE, "center"),
      text("AMOUNT 1.284,00", 256, 176, "bold 38px Arial", WHITE, "center")
    ], false, true),
    "fuel-grade": recipe(512, 256, [
      fill(0, 0, 512, 256, WHITE),
      outline(10, 10, 492, 236, INK, 4),
      text("DIESEL", 256, 106, "bold 62px Arial", INK, "center"),
      text("EURO 6", 256, 172, "bold 36px Arial", RED, "center"),
      circle(256, 214, 12, RED)
    ], false, false),
    "fuel-price": recipe(512, 256, [
      fill(0, 0, 512, 256, INK),
      text("PRICE / L", 256, 92, "bold 38px Arial", AMBER, "center"),
      text("1.684,00 TL", 256, 170, "bold 56px Arial", WHITE, "center"),
      line(60, 196, 452, 196, AMBER, 4)
    ], false, true),
    "n2mobil-top": recipe(512, 256, [
      fill(0, 0, 512, 256, INK),
      outline(12, 12, 488, 232, AMBER, 4),
      text("N2MOBIL", 256, 124, "bold 72px Arial", WHITE, "center"),
      circle(86, 190, 10, BLUE), circle(426, 190, 10, RED),
      text("FLEET TELEMATICS", 256, 206, "24px Arial", AMBER, "center")
    ], true, false),
    "n2mobil-side": recipe(512, 256, [
      fill(0, 0, 512, 256, INK),
      text("N2MOBIL", 256, 108, "bold 66px Arial", WHITE, "center"),
      text("GPS / GSM FLEET", 256, 176, "bold 30px Arial", BLUE, "center"),
      line(80, 200, 432, 200, AMBER, 4)
    ], true, false),
    "imei-label": recipe(512, 256, [
      fill(0, 0, 512, 256, WHITE),
      text("IMEI", 32, 96, "bold 40px Arial", INK),
      text("353072091234567", 32, 170, "34px Arial", INK),
      line(24, 190, 488, 190, RED, 4)
    ], false, false),
    "gps-label": recipe(512, 256, [
      fill(0, 0, 512, 256, WHITE),
      text("GPS", 32, 100, "bold 46px Arial", INK),
      text("1575.42 MHz", 32, 174, "34px Arial", BLUE)
    ], false, false),
    "gsm-label": recipe(512, 256, [
      fill(0, 0, 512, 256, WHITE),
      text("GSM", 32, 100, "bold 46px Arial", INK),
      text("900 / 1800 MHz", 32, 174, "34px Arial", RED)
    ], false, false),
    "power-label": recipe(512, 256, [
      fill(0, 0, 512, 256, WHITE),
      text("POWER", 32, 100, "bold 46px Arial", INK),
      text("12-24 V DC", 32, 174, "34px Arial", INK),
      circle(432, 128, 24, AMBER)
    ], false, false),
    "software-code": recipe(512, 256, [
      fill(0, 0, 512, 256, "#07111d"),
      outline(8, 8, 496, 240, "#1d3a55", 3),
      text("CODE // ERP", 24, 50, "bold 32px Arial", AMBER),
      text("const render = () => {", 24, 100, "26px Courier New", BLUE),
      text("return status.ok;", 44, 140, "26px Courier New", "#37f59a"),
      text("}", 24, 180, "26px Courier New", WHITE),
      line(24, 196, 180, 196, BLUE, 4)
    ], false, true),
    "software-dashboard": recipe(512, 256, [
      fill(0, 0, 512, 256, "#07111d"),
      text("ERP DASHBOARD", 24, 50, "bold 32px Arial", AMBER),
      glow(410, 150, 78, "#1d6f8f", "#07111d"),
      text("KPI 98.4%", 250, 150, "bold 42px Arial", WHITE),
      fill(24, 182, 84, 46, BLUE), fill(120, 158, 84, 70, AMBER),
      fill(216, 128, 84, 100, "#37f59a")
    ], false, true),
    "software-brand": recipe(512, 256, [
      fill(0, 0, 512, 256, INK),
      text("NAZTECH", 256, 112, "bold 60px Arial", AMBER, "center"),
      text("ENGINEERING", 256, 174, "bold 30px Arial", WHITE, "center")
    ], false, false),
    "fire-zone": recipe(512, 256, [
      fill(0, 0, 512, 256, WHITE),
      outline(10, 10, 492, 236, RED, 5),
      text("NAZTECH", 256, 82, "bold 42px Arial", INK, "center"),
      text("ZONE 07", 256, 150, "bold 56px Arial", RED, "center"),
      text("ADDRESS 07-04", 256, 204, "28px Arial", INK, "center")
    ], false, false),
    "fire-panel-lcd": recipe(512, 256, [
      fill(0, 0, 512, 256, "#1a0808"),
      outline(12, 12, 488, 232, RED, 4),
      text("ZONE 07", 256, 106, "bold 56px Arial", RED, "center"),
      text("ALARM / ACTIVE", 256, 180, "bold 32px Arial", WHITE, "center")
    ], false, true),
    "fire-detector-test": recipe(512, 256, [
      fill(0, 0, 512, 256, WHITE),
      text("TEST OK", 256, 112, "bold 52px Arial", INK, "center"),
      text("NT-SD-02", 256, 178, "bold 32px Arial", RED, "center"),
      circle(256, 212, 10, BLUE)
    ], false, false),
    "fire-call-point": recipe(512, 256, [
      fill(0, 0, 512, 256, "#b3122c"),
      outline(10, 10, 492, 236, WHITE, 5),
      text("DANGER", 256, 96, "bold 66px Arial", WHITE, "center"),
      text("FIRE CALL POINT", 256, 158, "bold 36px Arial", WHITE, "center"),
      line(60, 184, 452, 184, WHITE, 5),
      text("BREAK GLASS", 256, 222, "26px Arial", WHITE, "center")
    ], false, true),
    "electrical-danger": recipe(512, 256, [
      fill(0, 0, 512, 256, AMBER),
      outline(10, 10, 492, 236, INK, 6),
      text("DANGER", 256, 108, "bold 72px Arial", INK, "center"),
      text("HV 400 V", 256, 180, "bold 42px Arial", INK, "center"),
      line(40, 200, 472, 200, INK, 6)
    ], false, false),
    "electrical-phase": recipe(512, 256, [
      fill(0, 0, 512, 256, INK),
      text("L1  L2  L3  N  PE", 256, 118, "bold 38px Arial", WHITE, "center"),
      line(40, 156, 472, 156, AMBER, 5),
      circle(80, 206, 12, RED), circle(180, 206, 12, AMBER),
      circle(280, 206, 12, BLUE), circle(380, 206, 12, WHITE)
    ], false, false),
    "electrical-volts": recipe(512, 256, [
      fill(0, 0, 512, 256, "#07121f"),
      glow(256, 128, 220, "#174b70", "#07121f"),
      text("VOLTS 400 V", 256, 140, "bold 48px Arial", BLUE, "center"),
      outline(16, 16, 480, 224, BLUE, 4)
    ], false, true),
    "electrical-amps": recipe(512, 256, [
      fill(0, 0, 512, 256, "#07121f"),
      glow(256, 128, 220, "#5a3d12", "#07121f"),
      text("AMPS 63 A", 256, 140, "bold 48px Arial", AMBER, "center"),
      outline(16, 16, 480, 224, AMBER, 4)
    ], false, true)
  });

  var REQUIRED_DECAL_STRINGS = Object.freeze([
    "HIKVISION", "ColorVu 4K", "N2MOBIL", "NAZTECH", "ERP", "CODE",
    "DASHBOARD", "VOLUME", "AMOUNT", "VOLTS", "AMPS", "ZONE", "DANGER"
  ]);

  var DECAL_REQUIREMENTS = Object.freeze({
    "1": Object.freeze(["camera-label-left", "camera-label-right"]),
    "2": Object.freeze(["keypad-brand-decal"]),
    "3": Object.freeze(["asset-tag", "switch-label"]),
    "4": Object.freeze(["fuel-grade-decal", "price-decal"]),
    "5": Object.freeze([
      "n2mobil-top-logo", "n2mobil-side-decal", "imei-label",
      "gps-label", "gsm-label", "power-label"
    ]),
    "6": Object.freeze(["screen-left", "screen-right"]),
    "7": Object.freeze([
      "panel-zone-label", "panel-brand-decal", "detector-test-label", "call-point-label"
    ]),
    "8": Object.freeze(["warning-plate", "phase-label"])
  });

  function finiteNumber(value) {
    return typeof value === "number" && isFinite(value) ? value : 0;
  }

  function numberOr(value, fallback) {
    return typeof value === "number" && isFinite(value) ? value : fallback;
  }

  function v3(x, y, z) {
    return Object.freeze([x, y, z]);
  }

  function pad2(value) {
    return value < 10 ? "0" + String(value) : String(value);
  }

  function freezeStyle(style) {
    if (!style || typeof style !== "object" || Array.isArray(style)) {
      return null;
    }
    var keys = Object.keys(style);
    if (keys.length !== 1 || (keys[0] !== "finish" && keys[0] !== "decal")) {
      return null;
    }
    var value = style[keys[0]];
    if (typeof value !== "string" || value.length === 0) {
      return null;
    }
    var normalized = Object.create(null);
    normalized[keys[0]] = value;
    return Object.freeze(normalized);
  }

  function finishStyle(name) {
    return freezeStyle({ finish: name });
  }

  function decalStyle(name) {
    return freezeStyle({ decal: name });
  }

  function part(name, primitive, args, material, position, rotation, scale, animated, style) {
    var descriptor = {
      name: name,
      primitive: primitive,
      args: Object.freeze(args.slice()),
      material: material,
      position: position || v3(0, 0, 0),
      rotation: rotation || v3(0, 0, 0),
      scale: scale || v3(1, 1, 1)
    };
    if (animated) {
      descriptor.animated = true;
    }
    if (style !== undefined && style !== null) {
      descriptor.style = freezeStyle(style);
    }
    return Object.freeze(descriptor);
  }

  function ringXZ(prefix, count, radius, y, primitive, args, material, animated, style) {
    var parts = [];
    for (var index = 0; index < count; index += 1) {
      var angle = (index / count) * Math.PI * 2;
      parts.push(
        part(prefix + "-" + pad2(index + 1), primitive, args.slice(), material,
          v3(Math.cos(angle) * radius, y, Math.sin(angle) * radius),
          v3(0, -angle, 0), v3(1, 1, 1), animated, style)
      );
    }
    return parts;
  }

  function ringXY(prefix, count, radius, y, z, primitive, args, material, animated, style) {
    var parts = [];
    for (var index = 0; index < count; index += 1) {
      var angle = (index / count) * Math.PI * 2;
      parts.push(
        part(prefix + "-" + pad2(index + 1), primitive, args.slice(), material,
          v3(Math.cos(angle) * radius, y + Math.sin(angle) * radius, z),
          v3(0, 0, 0), v3(1, 1, 1), animated, style)
      );
    }
    return parts;
  }

  function lineParts(prefix, count, x, y, z, dx, dy, dz, primitive, args, material, animated, style) {
    var parts = [];
    for (var index = 0; index < count; index += 1) {
      parts.push(
        part(prefix + "-" + pad2(index + 1), primitive, args.slice(), material,
          v3(x + dx * index, y + dy * index, z + dz * index),
          v3(0, 0, 0), v3(1, 1, 1), animated, style)
      );
    }
    return parts;
  }

  function concatParts() {
    var result = [];
    for (var group = 0; group < arguments.length; group += 1) {
      var entries = arguments[group];
      for (var index = 0; index < entries.length; index += 1) {
        result.push(Object.freeze(entries[index]));
      }
    }
    return Object.freeze(result);
  }

  function cameraDescriptors() {
    return concatParts(
      [
        part("camera-body", "box", [1.7, 0.72, 0.95], "cameraWhite", v3(0, 0.9, 0), null, null, false, finishStyle("cameraWhite")),
        part("camera-top-shroud", "box", [1.62, 0.12, 0.86], "cameraWhite", v3(0, 1.3, 0), null, null, false, finishStyle("cameraWhite")),
        part("sunshield-visor", "box", [1.8, 0.08, 0.46], "cameraWhite", v3(0, 1.36, 0.44), v3(-0.18, 0, 0), null, false, finishStyle("cameraWhite")),
        part("camera-side-left", "box", [0.08, 0.56, 0.8], "cameraWhite", v3(-0.88, 0.9, 0), null, null, false, finishStyle("cameraWhite")),
        part("camera-side-right", "box", [0.08, 0.56, 0.8], "cameraWhite", v3(0.88, 0.9, 0), null, null, false, finishStyle("cameraWhite")),
        part("camera-back-plate", "box", [1.42, 0.6, 0.08], "steelDark", v3(0, 0.9, -0.5), null, null, false, finishStyle("steelDark")),
        part("camera-cable-port", "cylinder", [0.09, 0.09, 0.16, 16], "stainless", v3(-0.4, 0.6, -0.55), v3(Math.PI / 2, 0, 0))
      ],
      lineParts("housing-vent", 2, -0.3, 1.355, -0.16, 0.6, 0, 0, "box", [0.12, 0.02, 0.42], "steelDark", false, finishStyle("steelDark")),
      [
        part("lens-barrel", "cylinder", [0.34, 0.4, 0.72, 32], "glossBlack", v3(0, 0.92, 0.62), v3(Math.PI / 2, 0, 0), null, false, finishStyle("glossBlack")),
        part("lens-hood", "cylinder", [0.46, 0.5, 0.22, 32], "glossBlack", v3(0, 0.92, 0.86), v3(Math.PI / 2, 0, 0), null, false, finishStyle("glossBlack")),
        part("lens-glass", "circle", [0.28, 32], "opticalGlass", v3(0, 0.92, 0.99), null, null, false, finishStyle("opticalGlass")),
        part("lens-secondary-glass", "circle", [0.2, 28], "opticalGlass", v3(0, 0.92, 1.002), null, null, false, finishStyle("opticalGlass")),
        part("lens-inner-ring", "torus", [0.31, 0.018, 8, 40], "gold", v3(0, 0.92, 0.995)),
        part("lens-front-ring", "torus", [0.37, 0.016, 8, 40], "goldLight", v3(0, 0.92, 1.005))
      ],
      [
        part("ir-led-ring", "torus", [0.44, 0.035, 10, 48], "ledGlow", v3(0, 0.92, 0.76), null, null, true, finishStyle("ledGlow")),
        part("status-led", "sphere", [0.055, 12, 10], "signalRed", v3(0.62, 0.84, 0.5), null, null, true, finishStyle("signalRed"))
      ],
      ringXY("ir-emitter", 12, 0.47, 0.92, 0.78, "sphere", [0.035, 8, 8], "ledGlow", true, finishStyle("ledGlow")),
      [
        part("bracket", "box", [0.34, 0.16, 0.7], "whiteEnamel", v3(0, 0.45, -0.18)),
        part("bracket-arm", "box", [0.12, 0.42, 0.14], "stainless", v3(0, 0.26, -0.42), v3(0.32, 0, 0)),
        part("bracket-pivot", "cylinder", [0.12, 0.12, 0.16, 24], "stainless", v3(0, 0.46, -0.42), v3(0, 0, Math.PI / 2))
      ],
      ringXY("mount-screw", 2, 0.62, 0.9, 0.49, "sphere", [0.04, 8, 8], "stainless", false, finishStyle("stainless")),
      [
        part("camera-label-left", "plane", [0.52, 0.2], "decal", v3(-0.886, 0.92, 0), v3(0, -Math.PI / 2, 0), null, false, decalStyle("hikvision-brand")),
        part("camera-label-right", "plane", [0.52, 0.2], "decal", v3(0.886, 0.92, 0), v3(0, Math.PI / 2, 0), null, false, decalStyle("hikvision-brand"))
      ]
    );
  }

  function keypadKeys() {
    var keys = [];
    for (var row = 0; row < 4; row += 1) {
      for (var column = 0; column < 3; column += 1) {
        keys.push(
          part("keypad-key-" + pad2(row * 3 + column + 1), "box", [0.14, 0.1, 0.03], "rubber",
            v3(1.1 + column * 0.25, 0.82 - row * 0.16, 0.4), null, null, false, finishStyle("rubber"))
        );
      }
    }
    return keys;
  }

  function alarmDescriptors() {
    return concatParts(
      [
        part("sensor-housing", "box", [1.1, 1.25, 0.36], "whiteEnamel", v3(0, 0.95, 0), null, null, false, finishStyle("whiteEnamel")),
        part("pir-dome", "sphere", [0.42, 24, 16], "opticalGlass", v3(0, 1.05, 0.18), null, v3(1, 1, 0.6), true, finishStyle("opticalGlass")),
        part("siren-horn", "cone", [0.26, 0.42, 24], "glossBlack", v3(0, 1.72, 0), v3(Math.PI / 2, 0, 0)),
        part("siren-led", "sphere", [0.07, 14, 10], "signalRed", v3(0, 1.78, 0.24), null, null, true, finishStyle("signalRed")),
        part("wall-mount", "box", [0.9, 0.16, 0.24], "steelDark", v3(0, 0.36, -0.08))
      ],
      ringXZ("fresnel-ring", 3, 0.34, 1.05, "torus", [0.3, 0.012, 8, 40], "stainless", false, finishStyle("stainless")),
      ringXY("siren-emitter", 6, 0.16, 1.72, 0.22, "sphere", [0.035, 8, 8], "signalRed", true, finishStyle("signalRed")),
      lineParts("sensor-vent", 6, -0.25, 1.45, 0.19, 0.1, 0, 0, "box", [0.06, 0.1, 0.03], "steelDark", false),
      ringXY("panel-screw", 4, 0.46, 0.95, 0.19, "sphere", [0.03, 8, 8], "stainless", false, finishStyle("stainless")),
      [
        part("keypad-body", "box", [0.86, 1.1, 0.28], "obsidian", v3(1.35, 0.62, 0.2), null, null, false, finishStyle("obsidian")),
        part("keypad-bezel", "box", [0.78, 1.02, 0.05], "glossBlack", v3(1.35, 0.62, 0.36)),
        part("lcd-screen", "plane", [0.62, 0.24], "lcdBlue", v3(1.35, 0.98, 0.39), null, null, false, decalStyle("alarm-lcd")),
        part("keypad-brand-decal", "plane", [0.6, 0.18], "decal", v3(1.35, 0.3, 0.4), null, null, false, decalStyle("alarm-keypad"))
      ],
      keypadKeys(),
      lineParts("keypad-status", 3, 1.15, 0.2, 0.41, 0.2, 0, 0, "sphere", [0.03, 8, 8], "signalGreen", true, finishStyle("signalGreen"))
    );
  }

  function bladeActivityLeds() {
    var leds = [];
    for (var blade = 0; blade < 6; blade += 1) {
      var y = 0.8 + blade * 0.24;
      leds.push(
        part("blade-activity-led-" + pad2(blade * 2 + 1), "sphere", [0.025, 8, 8], "signalGreen",
          v3(-0.5, y, 0.53), null, null, true, finishStyle("signalGreen"))
      );
      leds.push(
        part("blade-activity-led-" + pad2(blade * 2 + 2), "sphere", [0.025, 8, 8], "signalGreen",
          v3(-0.4, y, 0.53), null, null, true, finishStyle("signalGreen"))
      );
    }
    return leds;
  }

  function rackDescriptors() {
    return concatParts(
      [
        part("rack-frame", "box", [1.6, 2.1, 1.05], "steelDark", v3(0, 1.1, 0)),
        part("rack-top", "box", [1.68, 0.1, 1.1], "steelDark", v3(0, 2.16, 0)),
        part("rack-base", "box", [1.68, 0.12, 1.1], "steelDark", v3(0, 0.06, 0)),
        part("rack-side-left", "box", [0.08, 2, 1.02], "steelDark", v3(-0.8, 1.1, 0)),
        part("rack-side-right", "box", [0.08, 2, 1.02], "steelDark", v3(0.8, 1.1, 0)),
        part("rack-door-glass", "box", [1.42, 1.9, 0.04], "tintedGlass", v3(0, 1.1, 0.55), null, null, false, finishStyle("tintedGlass")),
        part("rack-door-frame", "box", [1.5, 0.08, 0.08], "stainless", v3(0, 2.04, 0.57), null, null, false, finishStyle("stainless")),
        part("cable-tray", "box", [1.3, 0.08, 0.42], "stainless", v3(0, 2.1, -0.18))
      ],
      lineParts("rack-rail", 4, -0.72, 0.2, -0.45, 1.44, 0, 0, "box", [0.06, 1.9, 0.06], "stainless", false, finishStyle("stainless")),
      lineParts("server-blade", 6, 0, 0.78, 0.12, 0, 0.24, 0, "box", [1.3, 0.18, 0.72], "stainless", true, finishStyle("stainless")),
      lineParts("blade-bezel", 6, 0, 0.78, 0.49, 0, 0.24, 0, "box", [1.2, 0.12, 0.04], "obsidian", false, finishStyle("obsidian")),
      bladeActivityLeds(),
      lineParts("switch-port", 8, -0.55, 0.5, 0.45, 0.16, 0, 0, "box", [0.1, 0.08, 0.04], "lcdBlue", true, finishStyle("lcdBlue")),
      [
        part("network-switch", "box", [1.34, 0.2, 0.7], "obsidian", v3(0, 0.5, 0.08)),
        part("patch-panel", "box", [1.34, 0.16, 0.1], "stainless", v3(0, 0.34, 0.44)),
        part("asset-tag", "plane", [0.44, 0.18], "decal", v3(-0.48, 1.98, 0.57), null, null, false, decalStyle("rack-asset")),
        part("switch-label", "plane", [0.44, 0.18], "decal", v3(0.48, 1.98, 0.57), null, null, false, decalStyle("rack-switch-map"))
      ],
      lineParts("patch-cable", 4, -0.4, 0.28, -0.42, 0.27, 0, 0, "cylinder", [0.035, 0.035, 0.62, 10], "rubber", false, finishStyle("rubber")),
      ringXZ("rack-fan", 4, 0.28, 2.2, "cylinder", [0.12, 0.12, 0.04, 16], "steelDark", false),
      lineParts("rack-vent", 4, -0.54, 2.12, 0.52, 0.36, 0, 0, "box", [0.16, 0.02, 0.02], "obsidian", false, finishStyle("obsidian"))
    );
  }

  function fuelDescriptors() {
    return concatParts(
      [
        part("dispenser-base", "box", [1.24, 0.14, 0.9], "steelDark", v3(0, 0.12, 0)),
        part("dispenser-body", "box", [1.05, 1.65, 0.75], "stainless", v3(0, 0.98, 0), null, null, false, finishStyle("stainless")),
        part("top-cap", "box", [1.12, 0.12, 0.82], "stainless", v3(0, 1.84, 0)),
        part("front-bezel", "box", [0.86, 0.62, 0.06], "glossBlack", v3(0, 1.4, 0.4)),
        part("side-panel-left", "box", [0.05, 1.4, 0.62], "stainless", v3(-0.55, 0.98, 0)),
        part("side-panel-right", "box", [0.05, 1.4, 0.62], "stainless", v3(0.55, 0.98, 0))
      ],
      lineParts("pump-panel", 6, -0.4, 0.7, 0.4, 0.16, 0, 0, "box", [0.1, 0.18, 0.03], "obsidian", false, finishStyle("obsidian")),
      lineParts("cabinet-vent", 2, -0.24, 0.34, 0.41, 0.48, 0, 0, "box", [0.18, 0.04, 0.02], "steelDark", false),
      [
        part("display", "plane", [0.62, 0.38], "lcdBlue", v3(0, 1.48, 0.44), null, null, true, decalStyle("fuel-readout"))
      ],
      lineParts("display-pixel", 6, -0.24, 1.55, 0.48, 0.095, 0, 0, "box", [0.05, 0.1, 0.02], "lcdBlue", true, finishStyle("lcdBlue")),
      [
        part("hose-anchor", "cylinder", [0.1, 0.1, 0.14, 20], "stainless", v3(0.46, 1.18, 0.42), v3(0, 0, Math.PI / 2)),
        part("nozzle", "cylinder", [0.09, 0.055, 0.38, 16], "stainless", v3(0.82, 0.72, 0.48), v3(0, 0, -0.35), null, false, finishStyle("stainless")),
        part("holster", "cylinder", [0.13, 0.1, 0.32, 20], "rubber", v3(0.6, 0.62, 0.42), v3(0, 0, -0.2)),
        part("nozzle-trigger", "box", [0.06, 0.16, 0.05], "glossBlack", v3(0.9, 0.84, 0.48))
      ],
      lineParts("hose-segment", 8, 0.46, 1.08, 0.46, 0.045, -0.045, 0.01, "sphere", [0.055, 8, 8], "rubber", false, finishStyle("rubber")),
      lineParts("nozzle-detail", 4, 0.74, 0.62, 0.44, 0.04, 0.04, 0.01, "box", [0.05, 0.05, 0.12], "gold", false),
      [
        part("tank", "cylinder", [0.62, 0.62, 1.5, 32], "gold", v3(-1.35, 0.75, -0.2), v3(0, 0, Math.PI / 2)),
        part("telemetry-antenna", "cylinder", [0.02, 0.02, 0.55, 10], "stainless", v3(0.42, 2.02, -0.2), null, null, true, finishStyle("stainless")),
        part("telemetry-base", "cylinder", [0.08, 0.1, 0.1, 16], "steelDark", v3(0.42, 1.88, -0.2)),
        part("fuel-grade-decal", "plane", [0.36, 0.18], "decal", v3(-0.34, 1.06, 0.45), null, null, false, decalStyle("fuel-grade")),
        part("price-decal", "plane", [0.36, 0.18], "decal", v3(0.34, 1.06, 0.45), null, null, false, decalStyle("fuel-price"))
      ],
      lineParts("tank-band", 4, -1.35, 0.3, -0.2, 0, 0.3, 0, "torus", [0.64, 0.025, 8, 32], "steelDark", false),
      lineParts("flow-led", 4, -0.28, 1.28, 0.44, 0.18, 0, 0, "sphere", [0.03, 8, 8], "signalRed", true, finishStyle("signalRed"))
    );
  }

  function trackerDescriptors() {
    return concatParts(
      [
        part("tracker-box", "box", [1.15, 0.42, 0.8], "anodizedBlack", v3(0, 0.78, 0), null, null, false, finishStyle("anodizedBlack")),
        part("tracker-lid", "box", [1.06, 0.06, 0.72], "anodizedBlack", v3(0, 1.02, 0)),
        part("tracker-base", "box", [1.08, 0.08, 0.74], "stainless", v3(0, 0.54, 0)),
        part("sim-slot", "box", [0.24, 0.03, 0.12], "obsidian", v3(-0.28, 1.06, 0.22)),
        part("reset-pin", "cylinder", [0.02, 0.02, 0.08, 10], "gold", v3(0.28, 1.06, 0.22))
      ],
      lineParts("side-rib", 4, -0.48, 0.78, 0, 0.32, 0, 0, "box", [0.04, 0.3, 0.78], "anodizedBlack", false, finishStyle("anodizedBlack")),
      lineParts("tracker-screw", 4, -0.42, 0.78, 0.42, 0.28, 0, 0, "sphere", [0.025, 8, 8], "stainless", false, finishStyle("stainless")),
      [
        part("gsm-sma-antenna", "cylinder", [0.03, 0.035, 0.9, 16], "stainless", v3(-0.38, 1.48, -0.2), null, null, false, finishStyle("stainless")),
        part("gps-sma-antenna", "cylinder", [0.03, 0.035, 0.9, 16], "stainless", v3(0.38, 1.48, -0.2), null, null, false, finishStyle("stainless")),
        part("gsm-gold-tip", "cylinder", [0.032, 0.032, 0.12, 16], "gold", v3(-0.38, 1.98, -0.2)),
        part("gps-gold-tip", "cylinder", [0.032, 0.032, 0.12, 16], "gold", v3(0.38, 1.98, -0.2))
      ],
      lineParts("antenna-collar", 4, -0.38, 1.08, -0.2, 0.76, 0, 0, "cylinder", [0.055, 0.055, 0.08, 16], "goldLight", false),
      [
        part("status-led", "sphere", [0.05, 12, 10], "signalRed", v3(0.4, 0.82, 0.42), null, null, true, finishStyle("signalRed"))
      ],
      lineParts("relay-led", 4, -0.18, 0.82, 0.42, 0.12, 0, 0, "sphere", [0.024, 8, 8], "lcdBlue", true, finishStyle("lcdBlue")),
      lineParts("connector-pin", 4, -0.3, 0.78, -0.44, 0.2, 0, 0, "cylinder", [0.02, 0.02, 0.1, 10], "gold", false),
      [
        part("satellite-orbit", "torus", [1.05, 0.018, 10, 96], "gold", v3(0, 2.15, 0), v3(Math.PI / 2.6, 0, 0), null, true, finishStyle("gold")),
        part("satellite", "box", [0.3, 0.18, 0.2], "stainless", v3(1.05, 2.15, 0), v3(0, 0.4, 0), null, true, finishStyle("stainless"))
      ],
      lineParts("satellite-panel", 4, 1.24, 2.15, 0, 0, 0, 0.1, "box", [0.3, 0.02, 0.07], "lcdBlue", false, finishStyle("lcdBlue")),
      lineParts("orbit-tick", 2, 0, 2.15, 0.94, 0, 0, -1.88, "sphere", [0.026, 8, 8], "goldLight", false),
      [
        part("n2mobil-top-logo", "plane", [0.6, 0.24], "decal", v3(0, 1.056, 0), v3(-Math.PI / 2, 0, 0), null, false, decalStyle("n2mobil-top")),
        part("n2mobil-side-decal", "plane", [0.52, 0.2], "decal", v3(0, 0.78, 0.405), null, null, false, decalStyle("n2mobil-side"))
      ],
      [
        part("imei-label", "plane", [0.28, 0.1], "decal", v3(-0.31, 0.86, 0.406), null, null, false, decalStyle("imei-label")),
        part("gps-label", "plane", [0.24, 0.1], "decal", v3(0.02, 0.86, 0.406), null, null, false, decalStyle("gps-label")),
        part("gsm-label", "plane", [0.24, 0.1], "decal", v3(0.31, 0.86, 0.406), null, null, false, decalStyle("gsm-label")),
        part("power-label", "plane", [0.22, 0.1], "decal", v3(-0.46, 0.68, 0.406), null, null, false, decalStyle("power-label"))
      ]
    );
  }

  function workstationKeycaps() {
    var keys = [];
    for (var row = 0; row < 4; row += 1) {
      for (var column = 0; column < 3; column += 1) {
        keys.push(
          part("keycap-" + pad2(row * 3 + column + 1), "box", [0.12, 0.03, 0.1], "obsidian",
            v3(-0.3 + column * 0.16, 0.57, 0.72 + row * 0.14), null, null, false, finishStyle("obsidian"))
        );
      }
    }
    return keys;
  }

  function hologramDescriptors() {
    return concatParts(
      [
        part("monitor-left", "box", [0.86, 0.52, 0.06], "obsidian", v3(-0.85, 1.45, 0), v3(0, 0.12, 0), null, false, finishStyle("obsidian")),
        part("monitor-right", "box", [0.86, 0.52, 0.06], "obsidian", v3(0.85, 1.45, 0), v3(0, -0.12, 0), null, false, finishStyle("obsidian")),
        part("bezel-left", "box", [0.9, 0.56, 0.04], "glossBlack", v3(-0.85, 1.45, -0.02)),
        part("bezel-right", "box", [0.9, 0.56, 0.04], "glossBlack", v3(0.85, 1.45, -0.02)),
        part("screen-left", "plane", [0.8, 0.44], "lcdBlue", v3(-0.85, 1.45, 0.04), v3(0, 0.12, 0), null, false, decalStyle("software-code")),
        part("screen-right", "plane", [0.8, 0.44], "lcdBlue", v3(0.85, 1.45, 0.04), v3(0, -0.12, 0), null, false, decalStyle("software-dashboard")),
        part("monitor-stem-left", "cylinder", [0.04, 0.05, 0.34, 16], "stainless", v3(-0.85, 1.05, -0.02)),
        part("monitor-stem-right", "cylinder", [0.04, 0.05, 0.34, 16], "stainless", v3(0.85, 1.05, -0.02)),
        part("monitor-foot-left", "box", [0.34, 0.04, 0.26], "stainless", v3(-0.85, 0.86, 0)),
        part("monitor-foot-right", "box", [0.34, 0.04, 0.26], "stainless", v3(0.85, 0.86, 0)),
        part("monitor-hinge-left", "cylinder", [0.06, 0.06, 0.12, 16], "stainless", v3(-0.85, 1.2, -0.02), v3(0, 0, Math.PI / 2)),
        part("monitor-hinge-right", "cylinder", [0.06, 0.06, 0.12, 16], "stainless", v3(0.85, 1.2, -0.02), v3(0, 0, Math.PI / 2))
      ],
      [
        part("desk-surface", "box", [2.2, 0.08, 1.2], "stainless", v3(0, 0.52, 0.4), null, null, false, finishStyle("stainless")),
        part("keyboard-base", "box", [0.72, 0.04, 0.6], "obsidian", v3(0, 0.58, 0.86)),
        part("mouse", "sphere", [0.1, 16, 12], "obsidian", v3(0.56, 0.62, 0.86), null, v3(1, 0.5, 1.4)),
        part("mouse-wheel", "cylinder", [0.025, 0.025, 0.06, 12], "stainless", v3(0.56, 0.68, 0.82), v3(0, 0, Math.PI / 2))
      ],
      workstationKeycaps(),
      [
        part("workstation-tower", "box", [0.4, 0.9, 0.7], "obsidian", v3(1.35, 1.0, -0.2), null, null, false, finishStyle("obsidian")),
        part("tower-front", "plane", [0.36, 0.86], "glossBlack", v3(1.35, 1.0, 0.17), null, null, false, decalStyle("software-brand")),
        part("motherboard-tray", "box", [0.32, 0.62, 0.04], "steelDark", v3(1.35, 1.06, -0.53)),
        part("inner-core", "sphere", [0.1, 16, 12], "ledGlow", v3(1.35, 1.32, 0.2), null, null, true, finishStyle("ledGlow")),
        part("cable-duct", "box", [0.12, 0.06, 0.5], "rubber", v3(1.35, 0.56, -0.2))
      ],
      lineParts("tower-vent", 4, 1.22, 0.7, 0.2, 0, 0.12, 0, "box", [0.22, 0.03, 0.02], "steelDark", false),
      lineParts("tower-led", 3, 1.22, 1.26, 0.2, 0.13, 0, 0, "sphere", [0.025, 8, 8], "signalGreen", true, finishStyle("signalGreen")),
      lineParts("code-node", 8, -1.14, 1.28, 0.08, 0.07, 0.045, 0, "sphere", [0.02, 8, 8], "lcdBlue", true, finishStyle("lcdBlue")),
      lineParts("dashboard-bar", 3, 0.6, 1.24, 0.1, 0.18, 0, 0, "box", [0.12, 0.18, 0.01], "goldLight", false, finishStyle("goldLight")),
      [
        part("scan-plane", "plane", [0.74, 0.02], "ledGlow", v3(0.85, 1.45, 0.1), null, null, true, finishStyle("ledGlow"))
      ],
      [
        part("stand-column", "cylinder", [0.07, 0.09, 0.62, 24], "stainless", v3(0, 0.72, -0.02)),
        part("stand-base", "cylinder", [0.3, 0.34, 0.08, 32], "stainless", v3(0, 0.4, -0.02)),
        part("stand-arm-left", "box", [0.8, 0.05, 0.06], "stainless", v3(-0.42, 1.02, -0.02)),
        part("stand-arm-right", "box", [0.8, 0.05, 0.06], "stainless", v3(0.42, 1.02, -0.02))
      ],
      lineParts("cable-clip", 2, -0.24, 0.62, -0.2, 0.48, 0, 0, "box", [0.1, 0.04, 0.08], "rubber", false, finishStyle("rubber"))
    );
  }

  function panelButtons() {
    var buttons = [];
    for (var row = 0; row < 3; row += 1) {
      for (var column = 0; column < 2; column += 1) {
        buttons.push(
          part("panel-button-" + pad2(row * 2 + column + 1), "box", [0.06, 0.05, 0.03], "rubber",
            v3(-1.36 + column * 0.3, 0.8 + row * 0.14, 0.19), null, null, false, finishStyle("rubber"))
        );
      }
    }
    return buttons;
  }

  function fireDescriptors() {
    return concatParts(
      [
        part("panel-cabinet", "box", [0.9, 1.1, 0.24], "signalRed", v3(-1.1, 0.95, 0), null, null, false, finishStyle("signalRed")),
        part("panel-door", "box", [0.84, 1.02, 0.05], "glossBlack", v3(-1.1, 0.95, 0.15)),
        part("panel-lcd", "plane", [0.62, 0.24], "lcdBlue", v3(-1.1, 1.32, 0.19), null, null, false, decalStyle("fire-panel-lcd")),
        part("panel-zone-label", "plane", [0.52, 0.2], "decal", v3(-1.1, 1.02, 0.19), null, null, false, decalStyle("fire-zone")),
        part("panel-brand-decal", "plane", [0.48, 0.16], "decal", v3(-1.1, 0.62, 0.19), null, null, false, decalStyle("rack-brand")),
        part("panel-key-slot", "box", [0.08, 0.14, 0.03], "stainless", v3(-0.8, 0.62, 0.19))
      ],
      panelButtons(),
      lineParts("panel-led", 4, -1.34, 1.18, 0.2, 0.16, 0, 0, "sphere", [0.025, 8, 8], "signalRed", true, finishStyle("signalRed")),
      [
        part("detector-base", "cylinder", [0.62, 0.68, 0.16, 40], "whiteEnamel", v3(0, 2.0, 0), null, null, false, finishStyle("whiteEnamel")),
        part("detector-grille", "cylinder", [0.56, 0.56, 0.08, 40], "whiteEnamel", v3(0, 2.12, 0)),
        part("smoke-chamber", "cylinder", [0.45, 0.45, 0.3, 32], "tintedGlass", v3(0, 2.3, 0), null, null, false, finishStyle("tintedGlass")),
        part("test-led", "sphere", [0.055, 12, 10], "signalGreen", v3(0, 2.14, 0.6), null, null, true, finishStyle("signalGreen")),
        part("detector-test-label", "plane", [0.34, 0.12], "decal", v3(0, 2.02, 0.62), null, null, false, decalStyle("fire-detector-test"))
      ],
      lineParts("chamber-rib", 4, 0, 2.2, 0, 0, 0.06, 0, "torus", [0.46, 0.014, 8, 32], "goldLight", false),
      lineParts("grille-bar", 1, -0.4, 2.16, 0, 0, 0, 0, "box", [0.8, 0.02, 0.6], "stainless", false, finishStyle("stainless")),
      lineParts("test-led-array", 4, -0.24, 2.14, 0.58, 0.16, 0, 0, "sphere", [0.028, 8, 8], "signalRed", true, finishStyle("signalRed")),
      [
        part("alarm-bell", "cone", [0.42, 0.36, 32], "gold", v3(0, 1.45, -0.9), v3(Math.PI, 0, 0), null, true, finishStyle("gold")),
        part("bell-striker", "sphere", [0.1, 12, 10], "stainless", v3(0.34, 1.28, -0.9), null, null, true, finishStyle("stainless")),
        part("bell-rim", "torus", [0.42, 0.03, 8, 40], "goldLight", v3(0, 1.45, -0.9)),
        part("bell-bracket", "box", [0.14, 0.4, 0.14], "steelDark", v3(0, 1.15, -1.02))
      ],
      ringXY("bell-bolt", 4, 0.3, 1.45, -0.84, "sphere", [0.035, 8, 8], "stainless", false, finishStyle("stainless")),
      [
        part("call-point-body", "box", [0.46, 0.62, 0.18], "signalRed", v3(1.1, 0.9, 0), null, null, false, finishStyle("signalRed")),
        part("call-point-glass", "box", [0.36, 0.26, 0.03], "tintedGlass", v3(1.1, 1.02, 0.11)),
        part("call-point-button", "sphere", [0.1, 16, 12], "glossBlack", v3(1.1, 1.02, 0.14), null, v3(1, 1, 0.5)),
        part("call-point-label", "plane", [0.4, 0.18], "decal", v3(1.1, 0.74, 0.1), null, null, false, decalStyle("fire-call-point"))
      ],
      lineParts("call-point-screw", 4, 0.94, 1.16, 0.12, 0.32, 0, 0, "sphere", [0.025, 8, 8], "stainless", false, finishStyle("stainless")),
      lineParts("conduit", 2, -0.9, 0.44, -0.5, 1.8, 0, 0, "cylinder", [0.04, 0.04, 1.7, 12], "steelDark", false),
      lineParts("cable-gland", 2, -0.86, 0.5, -0.5, 1.72, 0, 0, "cylinder", [0.07, 0.07, 0.1, 12], "stainless", false, finishStyle("stainless"))
    );
  }

  function electricalDescriptors() {
    return concatParts(
      [
        part("panel-cabinet", "box", [1.85, 2.2, 0.8], "steelDark", v3(0, 1.15, 0)),
        part("panel-door", "box", [1.72, 2.06, 0.05], "tintedGlass", v3(0, 1.15, 0.44), null, null, false, finishStyle("tintedGlass")),
        part("panel-door-frame", "box", [1.8, 0.08, 0.08], "stainless", v3(0, 2.2, 0.47)),
        part("panel-backplate", "box", [1.62, 1.94, 0.04], "whiteEnamel", v3(0, 1.14, -0.32)),
        part("lock", "cylinder", [0.08, 0.08, 0.12, 16], "stainless", v3(0.74, 1.12, 0.5), v3(Math.PI / 2, 0, 0))
      ],
      lineParts("cabinet-vent", 4, -0.68, 2.06, 0.48, 0.45, 0, 0, "box", [0.2, 0.03, 0.02], "obsidian", false, finishStyle("obsidian")),
      lineParts("door-hinge", 3, 0.84, 0.5, 0.44, 0, 0.7, 0, "cylinder", [0.05, 0.05, 0.18, 12], "stainless", false, finishStyle("stainless")),
      [
        part("busbar-phase-a", "box", [1.5, 0.07, 0.1], "copper", v3(0, 1.9, -0.02), null, null, false, finishStyle("copper")),
        part("busbar-phase-b", "box", [1.5, 0.07, 0.1], "copper", v3(0, 1.78, -0.02), null, null, false, finishStyle("copper")),
        part("busbar-phase-c", "box", [1.5, 0.07, 0.1], "copper", v3(0, 1.66, -0.02), null, null, false, finishStyle("copper")),
        part("busbar-neutral", "box", [1.5, 0.06, 0.09], "stainless", v3(0, 1.54, -0.02)),
        part("busbar-earth", "box", [1.5, 0.06, 0.09], "goldLight", v3(0, 1.42, -0.02))
      ],
      lineParts("busbar-support", 4, -0.66, 1.42, -0.1, 0.44, 0, 0, "box", [0.1, 0.52, 0.14], "rubber", false, finishStyle("rubber")),
      [part("copper-link", "box", [0.24, 0.06, 0.12], "copper", v3(0.56, 1.32, 0.06), v3(0, 0, 0.2), null, false, finishStyle("copper"))],
      lineParts("din-rail", 3, 0, 1.3, 0.1, 0, -0.46, 0, "box", [1.44, 0.04, 0.1], "stainless", false, finishStyle("stainless")),
      lineParts("breaker", 8, -0.65, 1.65, 0.26, 0, -0.19, 0, "box", [0.14, 0.14, 0.16], "anodizedBlack", true, finishStyle("anodizedBlack")),
      lineParts("breaker-handle", 8, -0.65, 1.65, 0.38, 0, -0.19, 0, "box", [0.08, 0.06, 0.05], "goldLight", true, finishStyle("goldLight")),
      lineParts("terminal-block", 8, -0.7, 0.36, 0.24, 0.2, 0, 0, "box", [0.1, 0.12, 0.1], "stainless", false, finishStyle("stainless")),
      [
        part("cable-duct", "box", [1.5, 0.1, 0.18], "rubber", v3(0, 0.22, 0.1)),
        part("earth-stud", "cylinder", [0.05, 0.05, 0.12, 12], "copper", v3(0.7, 0.46, 0.2))
      ],
      [
        part("volt-meter", "plane", [0.38, 0.3], "lcdBlue", v3(-0.48, 0.92, 0.38), null, null, false, decalStyle("electrical-volts")),
        part("ampere-meter", "plane", [0.38, 0.3], "lcdBlue", v3(0.02, 0.92, 0.38), null, null, false, decalStyle("electrical-amps")),
        part("warning-plate", "plane", [0.5, 0.22], "decal", v3(0.5, 1.94, 0.48), null, null, false, decalStyle("electrical-danger")),
        part("phase-label", "plane", [0.48, 0.2], "decal", v3(0.5, 0.7, 0.48), null, null, false, decalStyle("electrical-phase"))
      ],
      lineParts("meter-bezel", 2, -0.48, 0.92, 0.42, 0.5, 0, 0, "box", [0.4, 0.32, 0.03], "glossBlack", false, finishStyle("glossBlack")),
      lineParts("indicator", 3, -0.7, 0.62, 0.4, 0.16, 0, 0, "sphere", [0.03, 8, 8], "signalAmber", true, finishStyle("signalAmber"))
    );
  }

  function sanitizeDecalValue(value) {
    if (typeof value === "number") {
      return isFinite(value) ? value.toFixed(2) : "0.00";
    }
    if (typeof value !== "string") {
      return "";
    }
    return value.replace(/[^0-9A-Za-z .:/%+\-]/g, "").slice(0, 48);
  }

  function pulseLed(mesh, elapsed, delta, reducedMotion, index) {
    if (!mesh.material) {
      return;
    }
    mesh.material.emissiveIntensity = reducedMotion
      ? 1.4
      : 0.7 + 0.7 * (0.5 + 0.5 * Math.sin(elapsed * 3 + index));
  }

  function sirenThrob(mesh, elapsed, delta, reducedMotion, index) {
    var scale = reducedMotion ? 1 : 1 + 0.08 * Math.sin(elapsed * 4 + index);
    if (mesh.scale && typeof mesh.scale.set === "function") {
      mesh.scale.set(scale, scale, scale);
    }
  }

  function bladeFlicker(mesh, elapsed, delta, reducedMotion, index) {
    if (!mesh.material) {
      return;
    }
    mesh.material.emissiveIntensity = reducedMotion
      ? 0.9
      : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(elapsed * 2.4 + index * 1.7));
  }

  function displayBlink(mesh, elapsed, delta, reducedMotion, index) {
    mesh.visible = reducedMotion ? true : Math.sin(elapsed * 2.6 + index) > -0.4;
    if (mesh.material) {
      mesh.material.emissiveIntensity = reducedMotion ? 1 : 0.8;
    }
    if (mesh.userData && typeof mesh.userData.decal === "string") {
      var volume = 42.8 + (reducedMotion ? 0 : 0.4 * Math.sin(elapsed * 0.6 + index));
      mesh.userData.readout = sanitizeDecalValue("VOLUME " + volume.toFixed(1) + " L");
    }
  }

  function spinOrbit(mesh, elapsed, delta, reducedMotion, index) {
    if (!mesh.rotation) {
      return;
    }
    mesh.rotation.z = reducedMotion ? 0.35 : elapsed * 0.4 + index * 0.01;
  }

  function holoScan(mesh, elapsed, delta, reducedMotion, index) {
    if (!mesh.position) {
      return;
    }
    var baseY = finiteNumber(mesh.position.x) > 0.5 ? 1.45 : 0.5;
    mesh.position.y = reducedMotion ? baseY : baseY + 0.2 * Math.sin(elapsed * 1.2 + index * 0.1);
  }

  function nodeDrift(mesh, elapsed, delta, reducedMotion, index) {
    if (!mesh.position) {
      return;
    }
    if (!mesh.userData) {
      mesh.userData = {};
    }
    if (typeof mesh.userData.baseY !== "number") {
      mesh.userData.baseY = finiteNumber(mesh.position.y, 0.6);
    }
    mesh.position.y = mesh.userData.baseY + (reducedMotion ? 0 : Math.sin(elapsed * 1.5 + index) * 0.045);
  }

  function bellStrike(mesh, elapsed, delta, reducedMotion, index) {
    if (!mesh.rotation) {
      return;
    }
    mesh.rotation.z = reducedMotion ? 0.25 : Math.sin(elapsed * 5 + index) * 0.3;
  }

  function breakerFlicker(mesh, elapsed, delta, reducedMotion, index) {
    if (!mesh.material) {
      return;
    }
    mesh.material.emissiveIntensity = reducedMotion
      ? 0.9
      : 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(elapsed * 2.3 + index * 1.3));
  }

  function createUpdater(name, targets, behavior) {
    function updater(context, elapsed, delta, reducedMotion) {
      if (!context || !context.meshes || typeof context.isAnimated !== "function") {
        return;
      }
      for (var index = 0; index < targets.length; index += 1) {
        var mesh = context.meshes[targets[index]];
        if (mesh && context.isAnimated(targets[index])) {
          behavior(mesh, elapsed, delta, reducedMotion, index);
        }
      }
    }
    Object.defineProperty(updater, "name", { value: name, configurable: true });
    Object.defineProperty(updater, "targets", {
      value: Object.freeze(targets.slice()), configurable: true
    });
    return Object.freeze(updater);
  }

  function namedTargets(prefix, count) {
    var names = [];
    for (var index = 1; index <= count; index += 1) {
      names.push(prefix + pad2(index));
    }
    return Object.freeze(names);
  }

  function freezeEntry(label, descriptors, updaters) {
    return Object.freeze({
      label: label,
      descriptors: descriptors,
      updaters: Object.freeze(updaters)
    });
  }

  var MODEL_REGISTRY = Object.freeze({
    "1": freezeEntry("HIKVISION Güvenlik Sistemleri", cameraDescriptors(), [
      createUpdater("pulseLed", Object.freeze(["ir-led-ring", "status-led"]), pulseLed),
      createUpdater("pulseLed", namedTargets("ir-emitter-", 12), pulseLed)
    ]),
    "2": freezeEntry("Hırsız Alarm Sistemleri", alarmDescriptors(), [
      createUpdater("pulseLed", Object.freeze(["pir-dome", "siren-led"]), pulseLed),
      createUpdater("sirenThrob", namedTargets("siren-emitter-", 6), sirenThrob),
      createUpdater("pulseLed", namedTargets("keypad-status-", 3), pulseLed)
    ]),
    "3": freezeEntry("Bilişim ve Ağ Altyapısı", rackDescriptors(), [
      createUpdater("bladeFlicker", namedTargets("server-blade-", 6), bladeFlicker),
      createUpdater("bladeFlicker", namedTargets("blade-activity-led-", 12), bladeFlicker),
      createUpdater("displayBlink", namedTargets("switch-port-", 8), displayBlink)
    ]),
    "4": freezeEntry("Yakıt Otomasyonu", fuelDescriptors(), [
      createUpdater("displayBlink", Object.freeze(["display"]), displayBlink),
      createUpdater("displayBlink", namedTargets("display-pixel-", 6), displayBlink),
      createUpdater("pulseLed", namedTargets("flow-led-", 4), pulseLed),
      createUpdater("sirenThrob", Object.freeze(["telemetry-antenna"]), sirenThrob)
    ]),
    "5": freezeEntry("Araç Takip Sistemleri", trackerDescriptors(), [
      createUpdater("spinOrbit", Object.freeze(["satellite-orbit", "satellite"]), spinOrbit),
      createUpdater("pulseLed", Object.freeze(["status-led"]), pulseLed),
      createUpdater("bladeFlicker", namedTargets("relay-led-", 4), bladeFlicker)
    ]),
    "6": freezeEntry("Yazılım", hologramDescriptors(), [
      createUpdater("holoScan", Object.freeze(["scan-plane"]), holoScan),
      createUpdater("pulseLed", Object.freeze(["inner-core"]), pulseLed),
      createUpdater("nodeDrift", namedTargets("code-node-", 8), nodeDrift),
      createUpdater("pulseLed", namedTargets("tower-led-", 3), pulseLed)
    ]),
    "7": freezeEntry("Yangın İhbar Sistemleri", fireDescriptors(), [
      createUpdater("bellStrike", Object.freeze(["bell-striker", "alarm-bell"]), bellStrike),
      createUpdater("pulseLed", Object.freeze(["test-led"]), pulseLed),
      createUpdater("bladeFlicker", namedTargets("test-led-array-", 4), bladeFlicker),
      createUpdater("pulseLed", namedTargets("panel-led-", 4), pulseLed)
    ]),
    "8": freezeEntry("Elektrik", electricalDescriptors(), [
      createUpdater("breakerFlicker", namedTargets("breaker-", 8), breakerFlicker),
      createUpdater("pulseLed", namedTargets("indicator-", 3), pulseLed)
    ])
  });

  function isAnimatedName(name) {
    if (typeof name !== "string") {
      return false;
    }
    if (ANIMATED_NAMES.indexOf(name) !== -1) {
      return true;
    }
    for (var index = 0; index < ANIMATED_PREFIXES.length; index += 1) {
      if (name.indexOf(ANIMATED_PREFIXES[index]) === 0) {
        return true;
      }
    }
    return false;
  }

  function buildSceneDescriptors(id) {
    var entry = typeof id === "string" ? MODEL_REGISTRY[id] : null;
    return entry ? entry.descriptors : EMPTY_DESCRIPTORS;
  }

  function validateTriple(value) {
    return Boolean(
      value &&
      typeof value.length === "number" &&
      value.length === 3 &&
      value[0] === finiteNumber(value[0]) &&
      value[1] === finiteNumber(value[1]) &&
      value[2] === finiteNumber(value[2])
    );
  }

  function safeText(value) {
    if (typeof value !== "string" || value.length === 0 || value.length > 96) {
      return false;
    }
    var blocked = new RegExp(
      "(\\/home\\/|[A-Za-z]:" + "\\\\|" + "file:" + "\\/\\/|\\.png|\\.jpe?g|\\.webp|data:image|https?:\\/\\/)",
      "i"
    );
    if (blocked.test(value)) {
      return false;
    }
    return true;
  }

  function validateFinishProfiles() {
    var tokens = Object.keys(PBR_PROFILES);
    if (tokens.length < 16 || !Object.isFrozen(PBR_PROFILES)) {
      return false;
    }
    for (var keyIndex = 0; keyIndex < tokens.length; keyIndex += 1) {
      var token = tokens[keyIndex];
      var item = PBR_PROFILES[token];
      if (!item || !Object.isFrozen(item) || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(token)) {
        return false;
      }
      var keys = Object.keys(item);
      if (keys.length !== PROFILE_KEYS.length) {
        return false;
      }
      for (var fieldIndex = 0; fieldIndex < keys.length; fieldIndex += 1) {
        if (PROFILE_KEYS.indexOf(keys[fieldIndex]) === -1) {
          return false;
        }
      }
      if (!isFinite(item.color) || item.color < 0 || item.color > 0xffffff || Math.floor(item.color) !== item.color) {
        return false;
      }
      if (!isFinite(item.emissive) || item.emissive < 0 || item.emissive > 0xffffff || Math.floor(item.emissive) !== item.emissive) {
        return false;
      }
      if (item.metalness < 0 || item.metalness > 1 || item.roughness < 0 || item.roughness > 1) {
        return false;
      }
      if (item.opacity < 0 || item.opacity > 1 || item.envMapIntensity < 0 || item.envMapIntensity > 1) {
        return false;
      }
      if (item.emissiveIntensity < 0 || item.emissiveIntensity > 2) {
        return false;
      }
      if (item.clearcoat < 0 || item.clearcoat > 1 || item.clearcoatRoughness < 0 || item.clearcoatRoughness > 1) {
        return false;
      }
      if (typeof item.transparent !== "boolean" || typeof item.physical !== "boolean" || typeof item.depthWrite !== "boolean") {
        return false;
      }
      if (item.physical && (item.envMapIntensity < 0.35 || item.envMapIntensity > 0.9)) {
        return false;
      }
      if (item.transparent && item.depthWrite) {
        return false;
      }
    }
    return true;
  }

  function validateLayer(layerEntry) {
    if (!layerEntry || !Object.isFrozen(layerEntry) || LAYER_OPS.indexOf(layerEntry.op) === -1) {
      return false;
    }
    var colorPattern = /^#[0-9a-fA-F]{6}$/;
    var requiredNumbers = [];
    if (layerEntry.op === "fillRect" || layerEntry.op === "strokeRect") {
      requiredNumbers = ["x", "y", "w", "h"];
    } else if (layerEntry.op === "text") {
      requiredNumbers = ["x", "y"];
      if (!safeText(layerEntry.text) || typeof layerEntry.font !== "string" || layerEntry.font.length === 0) {
        return false;
      }
      if (["left", "center", "right"].indexOf(layerEntry.align) === -1) {
        return false;
      }
    } else if (layerEntry.op === "circle") {
      requiredNumbers = ["x", "y", "r"];
    } else if (layerEntry.op === "line") {
      requiredNumbers = ["x1", "y1", "x2", "y2"];
    } else {
      requiredNumbers = ["x", "y", "r"];
      if (!colorPattern.test(layerEntry.inner) || !colorPattern.test(layerEntry.outer)) {
        return false;
      }
    }
    for (var index = 0; index < requiredNumbers.length; index += 1) {
      var value = layerEntry[requiredNumbers[index]];
      if (typeof value !== "number" || !isFinite(value)) {
        return false;
      }
    }
    if (layerEntry.op !== "radialGradient" && !colorPattern.test(layerEntry.color)) {
      return false;
    }
    if (layerEntry.lineWidth !== undefined && (typeof layerEntry.lineWidth !== "number" || layerEntry.lineWidth <= 0)) {
      return false;
    }
    if (layerEntry.r !== undefined && layerEntry.r <= 0) {
      return false;
    }
    return true;
  }

  function validateDecalRecipes() {
    var names = Object.keys(DECAL_RECIPES);
    if (names.length < 20 || !Object.isFrozen(DECAL_RECIPES)) {
      return false;
    }
    var text = "";
    for (var nameIndex = 0; nameIndex < names.length; nameIndex += 1) {
      var item = DECAL_RECIPES[names[nameIndex]];
      if (!item || !Object.isFrozen(item) || !Object.isFrozen(item.layers)) {
        return false;
      }
      if (item.width < 64 || item.width > MAX_TEXTURE_SIZE || item.height < 64 || item.height > MAX_TEXTURE_SIZE) {
        return false;
      }
      if (Math.floor(item.width) !== item.width || Math.floor(item.height) !== item.height) {
        return false;
      }
      if (item.layers.length < 1 || item.layers.length > MAX_TEXTURE_LAYERS) {
        return false;
      }
      for (var layerIndex = 0; layerIndex < item.layers.length; layerIndex += 1) {
        if (!validateLayer(item.layers[layerIndex])) {
          return false;
        }
        if (item.layers[layerIndex].op === "text") {
          text += item.layers[layerIndex].text + " ";
        }
      }
    }
    for (var tokenIndex = 0; tokenIndex < REQUIRED_DECAL_STRINGS.length; tokenIndex += 1) {
      if (text.indexOf(REQUIRED_DECAL_STRINGS[tokenIndex]) === -1) {
        return false;
      }
    }
    return true;
  }

  function validatePrimitiveArgs(descriptor) {
    var args = descriptor.args;
    if (!args || !Object.isFrozen(args) || args.length === 0) {
      return false;
    }
    var expected = PRIMITIVES[descriptor.primitive];
    var count = args.length;
    if (expected === "BoxGeometry") {
      if (count !== 3) {
        return false;
      }
    } else if (expected === "CylinderGeometry") {
      if (count !== 4) {
        return false;
      }
    } else if (expected === "SphereGeometry") {
      if (count !== 2 && count !== 3) {
        return false;
      }
    } else if (expected === "TorusGeometry") {
      if (count !== 4) {
        return false;
      }
    } else if (expected === "ConeGeometry") {
      if (count !== 2 && count !== 3) {
        return false;
      }
    } else if (count !== 2) {
      return false;
    }
    var segmentPositions = [];
    if (expected === "CylinderGeometry") {
      segmentPositions.push(3);
    } else if (expected === "SphereGeometry") {
      segmentPositions = [1, 2];
    } else if (expected === "TorusGeometry") {
      segmentPositions = [2, 3];
    } else if (expected === "ConeGeometry" && count === 3) {
      segmentPositions.push(2);
    } else if (expected === "CircleGeometry" || expected === "PlaneGeometry") {
      if (expected === "CircleGeometry") {
        segmentPositions.push(1);
      }
    }
    for (var index = 0; index < count; index += 1) {
      var value = args[index];
      if (typeof value !== "number" || !isFinite(value)) {
        return false;
      }
      if (segmentPositions.indexOf(index) !== -1) {
        if (Math.floor(value) !== value || value < SEGMENT_MIN || value > SEGMENT_MAX) {
          return false;
        }
      } else if (value <= 0 || value > 8) {
        return false;
      }
    }
    return true;
  }

  function validateDescriptor(descriptor, seen) {
    if (!descriptor || !Object.isFrozen(descriptor)) {
      return false;
    }
    if (!safeText(descriptor.name) || !/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(descriptor.name)) {
      return false;
    }
    if (seen && seen[descriptor.name]) {
      return false;
    }
    if (seen) {
      seen[descriptor.name] = true;
    }
    if (["pedestal", "deck", "trim-near", "trim-far", "contact-shadow"].indexOf(descriptor.name) !== -1) {
      return false;
    }
    if (!Object.prototype.hasOwnProperty.call(PRIMITIVES, descriptor.primitive)) {
      return false;
    }
    if (!Object.prototype.hasOwnProperty.call(PBR_PROFILES, descriptor.material)) {
      return false;
    }
    if (!validatePrimitiveArgs(descriptor)) {
      return false;
    }
    if (!Object.isFrozen(descriptor.position) || !Object.isFrozen(descriptor.rotation) || !Object.isFrozen(descriptor.scale)) {
      return false;
    }
    if (!validateTriple(descriptor.position) || !validateTriple(descriptor.rotation) || !validateTriple(descriptor.scale)) {
      return false;
    }
    var position = descriptor.position;
    if (Math.abs(position[0]) > 4 || position[1] < 0 || position[1] > 4 || Math.abs(position[2]) > 4) {
      return false;
    }
    var rotation = descriptor.rotation;
    for (var axis = 0; axis < 3; axis += 1) {
      if (Math.abs(rotation[axis]) > Math.PI * 2) {
        return false;
      }
    }
    for (var scaleIndex = 0; scaleIndex < 3; scaleIndex += 1) {
      if (descriptor.scale[scaleIndex] <= 0 || descriptor.scale[scaleIndex] > 8) {
        return false;
      }
    }
    if (descriptor.animated !== undefined && typeof descriptor.animated !== "boolean") {
      return false;
    }
    var style = descriptor.style;
    if (style !== undefined) {
      if (!style || !Object.isFrozen(style)) {
        return false;
      }
      var keys = Object.keys(style);
      if (keys.length !== 1 || (keys[0] !== "finish" && keys[0] !== "decal")) {
        return false;
      }
      if (!safeText(style[keys[0]])) {
        return false;
      }
      if (keys[0] === "finish" && !Object.prototype.hasOwnProperty.call(PBR_PROFILES, style.finish)) {
        return false;
      }
      if (keys[0] === "decal") {
        if (!Object.prototype.hasOwnProperty.call(DECAL_RECIPES, style.decal)) {
          return false;
        }
        if (descriptor.primitive !== "plane" || descriptor.args.length !== 2) {
          return false;
        }
        if (descriptor.args[0] <= 0 || descriptor.args[1] <= 0) {
          return false;
        }
      }
    }
    if (descriptor.material === "decal" && (!style || !style.decal)) {
      return false;
    }
    return true;
  }

  function validateDecalCompleteness(id, descriptors) {
    var required = DECAL_REQUIREMENTS[id];
    if (!required) {
      return false;
    }
    for (var index = 0; index < required.length; index += 1) {
      var found = false;
      for (var partIndex = 0; partIndex < descriptors.length; partIndex += 1) {
        var descriptor = descriptors[partIndex];
        if (descriptor && descriptor.name === required[index] && descriptor.style && descriptor.style.decal) {
          found = true;
          break;
        }
      }
      if (!found) {
        return false;
      }
    }
    return true;
  }

  function validateModelRegistry(registry) {
    if (!registry || !validateFinishProfiles() || !validateDecalRecipes()) {
      return false;
    }
    for (var idIndex = 0; idIndex < MODEL_IDS.length; idIndex += 1) {
      var id = MODEL_IDS[idIndex];
      var entry = registry[id];
      if (!entry || !Object.isFrozen(entry) || typeof entry.label !== "string" || entry.label.length === 0) {
        return false;
      }
      var descriptors = entry.descriptors;
      var updaters = entry.updaters;
      if (!Object.isFrozen(descriptors) || !Object.isFrozen(updaters)) {
        return false;
      }
      if (descriptors.length < MESH_BUDGET_MIN || descriptors.length > MESH_BUDGET_MAX) {
        return false;
      }
      if (descriptors.length !== EXPECTED_COUNTS[id]) {
        return false;
      }
      if (updaters.length === 0) {
        return false;
      }
      var seen = Object.create(null);
      for (var partIndex = 0; partIndex < descriptors.length; partIndex += 1) {
        if (!validateDescriptor(descriptors[partIndex], seen)) {
          return false;
        }
      }
      if (!validateDecalCompleteness(id, descriptors)) {
        return false;
      }
      for (var updaterIndex = 0; updaterIndex < updaters.length; updaterIndex += 1) {
        var updater = updaters[updaterIndex];
        if (typeof updater !== "function" || !updater.targets || !Object.isFrozen(updater.targets)) {
          return false;
        }
        for (var targetIndex = 0; targetIndex < updater.targets.length; targetIndex += 1) {
          var target = updater.targets[targetIndex];
          if (!Object.prototype.hasOwnProperty.call(seen, target)) {
            return false;
          }
        }
      }
    }
    return true;
  }

  function validateSourceSafety(source) {
    if (typeof source !== "string" || source.length === 0) {
      return false;
    }
    var markers = new RegExp("\\b(?:TO" + "DO|FIX" + "ME|st" + "ub|mo" + "ck|fa" + "ke)\\b", "i");
    if (markers.test(source)) {
      return false;
    }
    var errorChannel = "console" + "." + "error";
    if (source.indexOf(errorChannel) !== -1) {
      return false;
    }
    var localPaths = new RegExp("(\\/home\\/|[A-Za-z]:" + "\\\\|" + "file:" + "\\/\\/)");
    if (localPaths.test(source)) {
      return false;
    }
    if (source.indexOf("THREE.REVISION !== \"160\"") === -1) {
      return false;
    }
    return true;
  }

  function isPbrCatalog(id) {
    return typeof id === "string" && PBR_CATALOG_IDS[id] === true;
  }

  function createCanvas2D(width, height) {
    if (!docRef || typeof docRef.createElement !== "function") {
      return null;
    }
    try {
      var canvas = docRef.createElement("canvas");
      if (!canvas || typeof canvas.getContext !== "function") {
        return null;
      }
      canvas.width = width;
      canvas.height = height;
      var context = canvas.getContext("2d");
      if (!context || typeof context.fillRect !== "function" || typeof context.fillText !== "function") {
        return null;
      }
      return { canvas: canvas, context: context };
    } catch (_error) {
      return null;
    }
  }

  function paintRecipe(context, recipe, overrides) {
    if (!context || !recipe) {
      return false;
    }
    var replacement = overrides || null;
    try {
      if (typeof context.clearRect === "function") {
        context.clearRect(0, 0, recipe.width, recipe.height);
      }
      for (var index = 0; index < recipe.layers.length; index += 1) {
        var entry = recipe.layers[index];
        if (typeof context.save === "function") {
          context.save();
        }
        if (entry.op === "fillRect") {
          context.fillStyle = entry.color;
          context.fillRect(entry.x, entry.y, entry.w, entry.h);
        } else if (entry.op === "strokeRect") {
          context.strokeStyle = entry.color;
          context.lineWidth = numberOr(entry.lineWidth, 1);
          context.strokeRect(entry.x, entry.y, entry.w, entry.h);
        } else if (entry.op === "text") {
          var value = replacement && Object.prototype.hasOwnProperty.call(replacement, entry.text)
            ? replacement[entry.text]
            : entry.text;
          context.font = entry.font;
          context.fillStyle = entry.color;
          context.textAlign = entry.align;
          context.textBaseline = "alphabetic";
          context.fillText(value, entry.x, entry.y);
        } else if (entry.op === "circle") {
          context.beginPath();
          context.arc(entry.x, entry.y, entry.r, 0, Math.PI * 2);
          context.closePath();
          context.fillStyle = entry.color;
          context.fill();
        } else if (entry.op === "line") {
          context.beginPath();
          context.moveTo(entry.x1, entry.y1);
          context.lineTo(entry.x2, entry.y2);
          context.strokeStyle = entry.color;
          context.lineWidth = numberOr(entry.lineWidth, 1);
          context.stroke();
        } else if (entry.op === "radialGradient" && typeof context.createRadialGradient === "function") {
          var glow = context.createRadialGradient(entry.x, entry.y, 0, entry.x, entry.y, entry.r);
          glow.addColorStop(0, entry.inner);
          glow.addColorStop(1, entry.outer);
          context.fillStyle = glow;
          context.fillRect(entry.x - entry.r, entry.y - entry.r, entry.r * 2, entry.r * 2);
        }
        if (typeof context.restore === "function") {
          context.restore();
        }
      }
      return true;
    } catch (_error) {
      return false;
    }
  }

  function prefacedText(recipe, prefix) {
    for (var index = 0; index < recipe.layers.length; index += 1) {
      var entry = recipe.layers[index];
      if (entry.op === "text" && typeof entry.text === "string" && entry.text.indexOf(prefix) === 0) {
        return entry.text;
      }
    }
    return null;
  }

  function anisotropyFor(renderer) {
    if (!renderer || !renderer.capabilities || typeof renderer.capabilities.getMaxAnisotropy !== "function") {
      return 1;
    }
    return Math.max(1, Math.min(4, finiteNumber(renderer.capabilities.getMaxAnisotropy())));
  }

  function createDecalTexture(THREE, renderer, recipeName) {
    var recipe = DECAL_RECIPES[recipeName];
    if (!recipe || typeof THREE.CanvasTexture !== "function") {
      return null;
    }
    var surface = createCanvas2D(recipe.width, recipe.height);
    if (!surface || !paintRecipe(surface.context, recipe, null)) {
      return null;
    }
    var texture = null;
    try {
      texture = new THREE.CanvasTexture(surface.canvas);
      if (typeof THREE.SRGBColorSpace !== "undefined") {
        texture.colorSpace = THREE.SRGBColorSpace;
      }
      if (typeof THREE.LinearMipmapLinearFilter !== "undefined") {
        texture.minFilter = THREE.LinearMipmapLinearFilter;
      }
      if (typeof THREE.LinearFilter !== "undefined") {
        texture.magFilter = THREE.LinearFilter;
      }
      texture.generateMipmaps = true;
      texture.anisotropy = anisotropyFor(renderer);
      texture.needsUpdate = true;
    } catch (_error) {
      return null;
    }
    return Object.freeze({
      name: recipeName,
      recipe: recipe,
      canvas: surface.canvas,
      context: surface.context,
      texture: texture,
      baseText: prefacedText(recipe, "VOLUME "),
      state: { lastText: null }
    });
  }

  function createStudioEnvironment(THREE, renderer, scene) {
    if (!renderer || !scene || typeof THREE.PMREMGenerator !== "function" || typeof THREE.CanvasTexture !== "function") {
      return null;
    }
    var surface = createCanvas2D(512, 256);
    if (!surface) {
      return null;
    }
    var context = surface.context;
    var generator = null;
    var source = null;
    try {
      if (typeof context.createLinearGradient === "function") {
        var backdrop = context.createLinearGradient(0, 0, 0, 256);
        backdrop.addColorStop(0, "#c8d6e5");
        backdrop.addColorStop(0.45, "#3a4657");
        backdrop.addColorStop(0.55, "#141a22");
        backdrop.addColorStop(1, "#05070a");
        context.fillStyle = backdrop;
      } else {
        context.fillStyle = "#1a2029";
      }
      context.fillRect(0, 0, 512, 256);
      var strips = [[110, 60, 118], [392, 74, 86], [256, 30, 190]];
      for (var index = 0; index < strips.length; index += 1) {
        var strip = strips[index];
        if (typeof context.createRadialGradient === "function") {
          var softbox = context.createRadialGradient(strip[0], strip[1], 0, strip[0], strip[1], strip[2]);
          softbox.addColorStop(0, "rgba(255,244,224,0.95)");
          softbox.addColorStop(1, "rgba(255,244,224,0)");
          context.fillStyle = softbox;
          context.fillRect(strip[0] - strip[2], strip[1] - strip[2], strip[2] * 2, strip[2] * 2);
        } else {
          context.fillStyle = "#fff4e0";
          context.fillRect(strip[0] - strip[2] / 2, strip[1] - 12, strip[2], 24);
        }
      }
      source = new THREE.CanvasTexture(surface.canvas);
      if (typeof THREE.EquirectangularReflectionMapping !== "undefined") {
        source.mapping = THREE.EquirectangularReflectionMapping;
      }
      if (typeof THREE.SRGBColorSpace !== "undefined") {
        source.colorSpace = THREE.SRGBColorSpace;
      }
      generator = new THREE.PMREMGenerator(renderer);
      var target = generator.fromEquirectangular(source);
      if (target && target.texture) {
        scene.environment = target.texture;
        return target;
      }
      if (target && typeof target.dispose === "function") {
        target.dispose();
      }
      return null;
    } catch (_error) {
      return null;
    } finally {
      if (source && typeof source.dispose === "function") {
        source.dispose();
      }
      if (generator && typeof generator.dispose === "function") {
        generator.dispose();
      }
    }
  }

  function createRenderAssets(THREE, renderer, scene, id, descriptors) {
    if (!isPbrCatalog(id)) {
      return null;
    }
    var assets = {
      id: id,
      scene: scene,
      pbr: true,
      textures: Object.create(null),
      textureList: [],
      environmentTarget: null,
      disposed: false
    };
    var seen = Object.create(null);
    for (var index = 0; index < descriptors.length; index += 1) {
      var descriptor = descriptors[index];
      var name = descriptor && descriptor.style && descriptor.style.decal ? descriptor.style.decal : null;
      if (!name || !DECAL_RECIPES[name] || seen[name]) {
        continue;
      }
      seen[name] = true;
      var record = createDecalTexture(THREE, renderer, name);
      if (record) {
        assets.textures[name] = record;
        assets.textureList.push(record);
      }
    }
    assets.environmentTarget = createStudioEnvironment(THREE, renderer, scene);
    return assets;
  }

  function disposeRenderAssets(assets) {
    if (!assets || assets.disposed) {
      return;
    }
    assets.disposed = true;
    if (assets.scene && assets.environmentTarget && assets.scene.environment === assets.environmentTarget.texture) {
      assets.scene.environment = null;
    }
    if (assets.environmentTarget && typeof assets.environmentTarget.dispose === "function") {
      assets.environmentTarget.dispose();
    }
    for (var index = 0; index < assets.textureList.length; index += 1) {
      var record = assets.textureList[index];
      if (record && record.texture && typeof record.texture.dispose === "function") {
        record.texture.dispose();
      }
    }
    assets.textureList.length = 0;
  }

  function refreshDynamicDecals(active) {
    if (!active || !active.renderAssets || !active.meshes || active.renderAssets.disposed || active.renderAssets.id !== "4") {
      return;
    }
    var assets = active.renderAssets;
    var mesh = active.meshes["display"];
    var record = assets.textures["fuel-readout"];
    if (!mesh || !record || !record.baseText || !mesh.userData) {
      return;
    }
    var readout = typeof mesh.userData.readout === "string" ? mesh.userData.readout : "";
    var value = sanitizeDecalValue(readout);
    if (!value || value === record.state.lastText) {
      return;
    }
    var overrides = Object.create(null);
    overrides[record.baseText] = value;
    if (paintRecipe(record.context, record.recipe, overrides)) {
      record.texture.needsUpdate = true;
      record.state.lastText = value;
    }
  }

  function applyStudioLighting(id, lights) {
    if (!isPbrCatalog(id) || !lights) {
      return;
    }
    var preset = STUDIO_LIGHT_PRESETS[id];
    if (lights.ambient) {
      lights.ambient.intensity = preset.ambient;
    }
    if (lights.hemisphere) {
      lights.hemisphere.intensity = preset.hemisphere;
    }
    if (lights.key) {
      lights.key.intensity = preset.key;
      if (lights.key.shadow) {
        if (typeof lights.key.shadow.bias === "number") {
          lights.key.shadow.bias = -0.0004;
        }
        if (typeof lights.key.shadow.normalBias === "number") {
          lights.key.shadow.normalBias = 0.02;
        }
      }
    }
    if (lights.rim) {
      lights.rim.intensity = preset.rim;
    }
    if (lights.fill) {
      lights.fill.intensity = preset.fill;
    }
  }

  function resolveMaterialSpec(descriptor, assets) {
    var recipeName = descriptor.style && descriptor.style.decal ? descriptor.style.decal : null;
    var token = recipeName
      ? (descriptor.material === "decal" ? "decal" : descriptor.material)
      : (descriptor.style && descriptor.style.finish ? descriptor.style.finish : descriptor.material);
    var profile = PBR_PROFILES[token] || FALLBACK_PROFILE;
    var recipe = recipeName ? DECAL_RECIPES[recipeName] : null;
    var record = recipe && assets ? assets.textures[recipeName] : null;
    return Object.freeze({
      token: token,
      profile: profile,
      recipe: recipe,
      record: record,
      cacheKey: recipeName ? "decal:" + recipeName + ":" + token : "finish:" + token
    });
  }

  function createPbrMaterial(THREE, spec) {
    var profile = spec.profile;
    var physical = profile.physical && typeof THREE.MeshPhysicalMaterial === "function";
    var Constructor = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    if (typeof Constructor !== "function") {
      return null;
    }
    var params = {
      color: profile.color,
      metalness: profile.metalness,
      roughness: profile.roughness,
      envMapIntensity: profile.envMapIntensity,
      transparent: profile.transparent,
      opacity: profile.opacity,
      depthWrite: profile.depthWrite
    };
    if (physical) {
      params.clearcoat = profile.clearcoat;
      params.clearcoatRoughness = profile.clearcoatRoughness;
    }
    if (spec.record && spec.record.texture) {
      params.color = 0xffffff;
      params.map = spec.record.texture;
      params.polygonOffset = true;
      params.polygonOffsetFactor = -1;
      params.polygonOffsetUnits = -1;
      if (spec.recipe && spec.recipe.doubleSided && typeof THREE.DoubleSide !== "undefined") {
        params.side = THREE.DoubleSide;
      } else if (typeof THREE.FrontSide !== "undefined") {
        params.side = THREE.FrontSide;
      }
      if (spec.recipe && spec.recipe.emissive) {
        params.emissive = 0xffffff;
        params.emissiveIntensity = Math.max(0.35, profile.emissiveIntensity);
        params.emissiveMap = spec.record.texture;
      } else {
        params.emissive = 0x000000;
        params.emissiveIntensity = 0;
      }
    } else {
      params.emissive = profile.emissive;
      params.emissiveIntensity = profile.emissiveIntensity;
    }
    var material = new Constructor(params);
    if (material && typeof material.needsUpdate !== "undefined") {
      material.needsUpdate = true;
    }
    return material;
  }

  function instantiate(THREE, descriptors, palette, renderAssets) {
    if (!THREE || typeof THREE.Group !== "function" || !descriptors || typeof descriptors.length !== "number") {
      return null;
    }
    var group = new THREE.Group();
    var colors = palette || PALETTE;
    var materialCache = Object.create(null);
    var meshes = Object.create(null);
    var materials = [];
    var ownedMaterials = [];

    for (var index = 0; index < descriptors.length; index += 1) {
      var descriptor = descriptors[index];
      if (!descriptor) {
        continue;
      }
      var Constructor = THREE[PRIMITIVES[descriptor.primitive]];
      if (typeof Constructor !== "function" || typeof THREE.Mesh !== "function") {
        continue;
      }
      var geometry = new Constructor(...descriptor.args);
      var material = null;
      var spec = null;
      if (renderAssets && renderAssets.pbr) {
        spec = resolveMaterialSpec(descriptor, renderAssets);
        material = materialCache[spec.cacheKey];
        if (!material) {
          material = createPbrMaterial(THREE, spec);
          if (material) {
            materialCache[spec.cacheKey] = material;
            materials.push(material);
          }
        }
        if (!material) {
          continue;
        }
      } else {
        material = materialCache[descriptor.material];
        if (!material) {
          material = new THREE.MeshStandardMaterial({
            color: colors[descriptor.material],
            metalness: 0.65,
            roughness: 0.34,
            emissive: colors[descriptor.material],
            emissiveIntensity: 0.22
          });
          materialCache[descriptor.material] = material;
          materials.push(material);
        }
      }
      if (descriptor.animated || isAnimatedName(descriptor.name)) {
        if (material && typeof material.clone === "function") {
          material = material.clone();
        } else {
          material = new THREE.MeshStandardMaterial({ color: colors[descriptor.material] });
        }
        material.emissiveIntensity = 0.8;
        ownedMaterials.push(material);
      }
      var mesh = new THREE.Mesh(geometry, material);
      mesh.name = descriptor.name;
      if (mesh.position && typeof mesh.position.set === "function") {
        mesh.position.set(descriptor.position[0], descriptor.position[1], descriptor.position[2]);
      }
      if (mesh.rotation && typeof mesh.rotation.set === "function") {
        mesh.rotation.set(descriptor.rotation[0], descriptor.rotation[1], descriptor.rotation[2]);
      }
      if (mesh.scale && typeof mesh.scale.set === "function") {
        mesh.scale.set(descriptor.scale[0], descriptor.scale[1], descriptor.scale[2]);
      }
      mesh.castShadow = true;
      if (renderAssets && renderAssets.pbr && descriptor.style && descriptor.style.decal) {
        mesh.userData = mesh.userData || {};
        mesh.userData.decal = descriptor.style.decal;
        if (!spec.record || !spec.record.texture) {
          mesh.visible = false;
        }
      }
      group.add(mesh);
      meshes[descriptor.name] = mesh;
    }

    group.userData = {
      meshes: meshes,
      materials: materials.concat(ownedMaterials),
      animatedMaterials: ownedMaterials
    };
    return group;
  }

  function createSessionState(id) {
    return Object.freeze({
      id: typeof id === "string" ? id : null,
      phase: "idle",
      epoch: 0,
      reason: "created"
    });
  }

  var STATE_TRANSITIONS = Object.freeze({
    idle: Object.freeze({ open: "loading", reset: "idle", close: "idle", dispose: "idle" }),
    loading: Object.freeze({ ready: "ready", fail: "disposed", open: "loading", close: "disposed", dispose: "disposed" }),
    ready: Object.freeze({ pause: "paused", open: "loading", close: "disposed", dispose: "disposed" }),
    paused: Object.freeze({ resume: "ready", open: "loading", close: "disposed", dispose: "disposed" }),
    disposed: Object.freeze({ reset: "idle", open: "loading", close: "disposed", dispose: "disposed" })
  });

  function nextSessionState(state, event) {
    var type = typeof event === "string" ? event : (event && typeof event.type === "string" ? event.type : "");
    var current = state && typeof state.phase === "string" ? state.phase : "idle";
    var table = STATE_TRANSITIONS[current] || STATE_TRANSITIONS.idle;
    var phase = Object.prototype.hasOwnProperty.call(table, type) ? table[type] : current;
    var epoch = state && typeof state.epoch === "number" ? state.epoch : 0;
    if (type === "open") {
      epoch += 1;
    }
    var id = event && typeof event === "object" && typeof event.id === "string"
      ? event.id
      : (state ? state.id : null);
    return Object.freeze({ id: id, phase: phase, epoch: epoch, reason: type || "noop" });
  }

  function clampZoom(value) {
    var radius = numberOr(value, DEFAULT_RADIUS);
    if (radius < MIN_RADIUS) {
      return MIN_RADIUS;
    }
    if (radius > MAX_RADIUS) {
      return MAX_RADIUS;
    }
    return radius;
  }

  function wrapAngle(value) {
    var angle = finiteNumber(value);
    var fullTurn = Math.PI * 2;
    var wrapped = angle % fullTurn;
    if (wrapped <= -Math.PI) {
      wrapped += fullTurn;
    } else if (wrapped > Math.PI) {
      wrapped -= fullTurn;
    }
    return wrapped;
  }

  function applyOrbitDelta(state, deltaX, deltaY, sensitivity) {
    if (!state) {
      return state;
    }
    var amount = numberOr(sensitivity, MOUSE_SENSITIVITY);
    state.yaw = wrapAngle(finiteNumber(state.yaw) - finiteNumber(deltaX) * amount);
    state.pitch = wrapAngle(finiteNumber(state.pitch) - finiteNumber(deltaY) * amount);
    return state;
  }

  function targetComponent(target, axis, index) {
    if (Array.isArray(target)) {
      return finiteNumber(target[index]);
    }
    if (target && typeof target[axis] === "number" && isFinite(target[axis])) {
      return target[axis];
    }
    return 0;
  }

  function orbitToCamera(camera, state) {
    if (!camera || !state) {
      return camera;
    }
    var yaw = finiteNumber(state.yaw);
    var pitch = finiteNumber(state.pitch);
    var radius = clampZoom(state.radius);
    var cosPitch = Math.cos(pitch);
    var sinPitch = Math.sin(pitch);
    var sinYaw = Math.sin(yaw);
    var cosYaw = Math.cos(yaw);
    var targetX = targetComponent(state.target, "x", 0);
    var targetY = targetComponent(state.target, "y", 1);
    var targetZ = targetComponent(state.target, "z", 2);
    var positionX = targetX + cosPitch * sinYaw * radius;
    var positionY = targetY + sinPitch * radius;
    var positionZ = targetZ + cosPitch * cosYaw * radius;
    var upX = -sinPitch * sinYaw;
    var upY = cosPitch;
    var upZ = -sinPitch * cosYaw;

    if (camera.up && typeof camera.up.copy === "function") {
      camera.up.copy({ x: upX, y: upY, z: upZ });
    } else if (camera.up && typeof camera.up.set === "function") {
      camera.up.set(upX, upY, upZ);
    } else {
      camera.up = { x: upX, y: upY, z: upZ };
    }
    if (camera.position && typeof camera.position.set === "function") {
      camera.position.set(positionX, positionY, positionZ);
    } else {
      camera.position = { x: positionX, y: positionY, z: positionZ };
    }
    if (typeof camera.lookAt === "function") {
      camera.lookAt(state.target || { x: targetX, y: targetY, z: targetZ });
    }
    return camera;
  }

  var docRef = null;
  var winRef = null;
  var isReady = false;
  var shell = null;
  var stage = null;
  var readout = null;
  var statusPanel = null;
  var statusMessage = null;
  var titleNode = null;
  var autoRotateButton = null;
  var session = null;
  var sessionEpoch = 0;
  var sessionState = createSessionState(null);
  var activeCatalogId = null;
  var pendingScripts = [];
  var loadTimer = null;
  var detachers = [];
  var resizeObserver = null;
  var motionQuery = null;
  var reducedMotion = false;
  var webglCapable = null;
  var legacyViewer = null;
  var shellBound = false;
  var contextLossIntentional = false;
  var pointer = Object.freeze({ active: false, x: 0, y: 0, kind: "mouse" });

  function setStatus(message, visible) {
    if (statusMessage && typeof message === "string") {
      statusMessage.textContent = message;
    }
    if (statusPanel) {
      statusPanel.hidden = !visible;
    }
  }

  function makeElement(tag, className, text) {
    if (!docRef || typeof docRef.createElement !== "function") {
      return null;
    }
    var node = docRef.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (typeof text === "string") {
      node.textContent = text;
    }
    return node;
  }

  function setAttribute(node, name, value) {
    if (node && typeof node.setAttribute === "function") {
      node.setAttribute(name, value);
    }
  }

  function makeButton(label, action, description) {
    var button = makeElement("button", "", label);
    setAttribute(button, "type", "button");
    setAttribute(button, "data-action", action);
    setAttribute(button, "aria-label", description);
    return button;
  }

  function addListener(target, type, handler, options, tracked) {
    if (!target || typeof target.addEventListener !== "function" || typeof handler !== "function") {
      return;
    }
    target.addEventListener(type, handler, options);
    if (tracked && typeof target.removeEventListener === "function") {
      detachers.push(function () {
        target.removeEventListener(type, handler, options);
      });
    }
  }

  function ensureShell() {
    var panel = docRef ? docRef.getElementById("modalBox") : null;
    if (!panel || typeof panel.insertBefore !== "function") {
      return false;
    }
    if (shell) {
      return true;
    }

    shell = makeElement("section", "webgl-3d-viewer");
    setAttribute(shell, "data-webgl-viewer", "");
    setAttribute(shell, "aria-label", "Etkileşimli donanım inceleme paneli");

    var header = makeElement("header", "webgl-3d-viewer__header");
    header.appendChild(makeElement("span", "webgl-3d-viewer__eyebrow", "INTERACTIVE HARDWARE INSPECTOR"));
    titleNode = makeElement("h3", "", "3B Donanım İnceleme");
    if (titleNode) {
      titleNode.id = "webglViewerTitle";
    }
    readout = makeElement("span", "webgl-3d-viewer__readout", "100%");
    if (readout) {
      setAttribute(readout, "role", "status");
      setAttribute(readout, "aria-live", "off");
    }
    header.appendChild(titleNode);
    header.appendChild(readout);

    stage = makeElement("div", "webgl-3d-viewer__stage");
    setAttribute(stage, "tabindex", "0");
    setAttribute(stage, "role", "group");
    setAttribute(stage, "aria-label", "Etkileşimli donanım inceleme alanı");
    setAttribute(stage, "aria-describedby", "webglViewerHint");

    statusPanel = makeElement("div", "webgl-3d-viewer__status");
    setAttribute(statusPanel, "role", "status");
    setAttribute(statusPanel, "aria-live", "polite");
    statusPanel.appendChild(makeElement("span", "webgl-3d-viewer__spinner", ""));
    statusMessage = makeElement("span", "webgl-3d-viewer__message", "3B model hazırlanıyor…");
    statusPanel.appendChild(statusMessage);
    stage.appendChild(statusPanel);

    var toolbar = makeElement("div", "webgl-3d-viewer__toolbar");
    setAttribute(toolbar, "role", "toolbar");
    setAttribute(toolbar, "aria-label", "3B görünüm denetimleri");
    toolbar.appendChild(makeButton("−", "zoom-out", "Uzaklaştır"));
    toolbar.appendChild(makeButton("+", "zoom-in", "Yakınlaştır"));
    autoRotateButton = makeButton("360° Tur", "auto-rotate", "Otomatik turu aç veya kapat");
    setAttribute(autoRotateButton, "aria-pressed", "false");
    toolbar.appendChild(autoRotateButton);
    toolbar.appendChild(makeButton("↺ Sıfırla", "reset", "Görünümü sıfırla"));

    var hint = makeElement("p", "webgl-3d-viewer__hint", "Sürükleyerek döndürün; tekerlek veya +/− ile yakınlaştırın. Ok tuşları yönü değiştirir, 0 görünümü sıfırlar. Escape katalog penceresini kapatır.");
    if (hint) {
      hint.id = "webglViewerHint";
    }

    shell.appendChild(header);
    shell.appendChild(stage);
    shell.appendChild(toolbar);
    shell.appendChild(hint);
    panel.insertBefore(shell, panel.firstChild || null);
    bindShellEvents();
    applyReducedMotionPresentation();
    return true;
  }

  function bindShellEvents() {
    if (shellBound || !stage) {
      return;
    }
    shellBound = true;
    addListener(stage, "pointerdown", onPointerDown, false, false);
    addListener(stage, "pointermove", onPointerMove, false, false);
    addListener(stage, "pointerup", onPointerUp, false, false);
    addListener(stage, "pointercancel", onPointerUp, false, false);
    addListener(stage, "lostpointercapture", onPointerUp, false, false);
    addListener(stage, "wheel", onWheel, { passive: false }, false);
    addListener(stage, "keydown", onStageKeydown, false, false);
    addListener(shell, "click", onToolbarClick, false, false);
  }

  function onPointerDown(event) {
    if (!session || session.tearingDown || !event) {
      return;
    }
    pointer = Object.freeze({
      active: true,
      x: finiteNumber(event.clientX),
      y: finiteNumber(event.clientY),
      kind: typeof event.pointerType === "string" ? event.pointerType : "mouse"
    });
    if (stage && typeof stage.setPointerCapture === "function" && event.pointerId !== undefined) {
      try {
        stage.setPointerCapture(event.pointerId);
      } catch (_error) {
        // Pointer capture is an enhancement; stage-bound move handlers remain active.
      }
    }
    if (stage && stage.classList) {
      stage.classList.add("is-grabbing");
    }
  }

  function onPointerMove(event) {
    if (!session || !pointer.active || !event) {
      return;
    }
    var deltaX = finiteNumber(event.clientX) - pointer.x;
    var deltaY = finiteNumber(event.clientY) - pointer.y;
    pointer = Object.freeze({
      active: true,
      x: finiteNumber(event.clientX),
      y: finiteNumber(event.clientY),
      kind: pointer.kind
    });
    var sensitivity = pointer.kind === "touch" ? TOUCH_SENSITIVITY : MOUSE_SENSITIVITY;
    applyOrbitDelta(session.orbit, deltaX, deltaY, sensitivity);
    updateCamera();
  }

  function onPointerUp(event) {
    if (stage && typeof stage.releasePointerCapture === "function" && event && event.pointerId !== undefined) {
      try {
        stage.releasePointerCapture(event.pointerId);
      } catch (_error) {
        // A lost capture must never prevent the drag state from being cleared.
      }
    }
    pointer = Object.freeze({ active: false, x: 0, y: 0, kind: "mouse" });
    if (stage && stage.classList) {
      stage.classList.remove("is-grabbing");
    }
  }

  function onWheel(event) {
    if (!session) {
      return;
    }
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }
    var factor = event && finiteNumber(event.deltaY) < 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
    session.orbit.radius = clampZoom(session.orbit.radius * factor);
    updateCamera();
  }

  function resetView() {
    if (!session) {
      return;
    }
    session.orbit.yaw = DEFAULT_YAW;
    session.orbit.pitch = DEFAULT_PITCH;
    session.orbit.radius = DEFAULT_RADIUS;
    session.autoRotate = false;
    session.elapsed = 0;
    applyReducedMotionPresentation();
    updateCamera();
  }

  function zoomBy(factor) {
    if (!session) {
      return;
    }
    session.orbit.radius = clampZoom(session.orbit.radius * factor);
    updateCamera();
  }

  function onToolbarClick(event) {
    if (!event || !event.target || typeof event.target.getAttribute !== "function") {
      return;
    }
    var action = event.target.getAttribute("data-action");
    if (action === "zoom-out") {
      zoomBy(ZOOM_FACTOR);
    } else if (action === "zoom-in") {
      zoomBy(1 / ZOOM_FACTOR);
    } else if (action === "auto-rotate") {
      toggleAutoRotate();
    } else if (action === "reset") {
      resetView();
    }
  }

  function toggleAutoRotate() {
    if (!session || reducedMotion || !autoRotateButton) {
      return;
    }
    session.autoRotate = !session.autoRotate;
    applyReducedMotionPresentation();
  }

  function onStageKeydown(event) {
    if (!session || !event || typeof event.key !== "string") {
      return;
    }
    var key = event.key;
    var handled = true;
    if (key === "ArrowLeft") {
      session.orbit.yaw = wrapAngle(session.orbit.yaw - KEY_ANGLE_STEP);
    } else if (key === "ArrowRight") {
      session.orbit.yaw = wrapAngle(session.orbit.yaw + KEY_ANGLE_STEP);
    } else if (key === "ArrowUp") {
      session.orbit.pitch = wrapAngle(session.orbit.pitch + KEY_ANGLE_STEP);
    } else if (key === "ArrowDown") {
      session.orbit.pitch = wrapAngle(session.orbit.pitch - KEY_ANGLE_STEP);
    } else if (key === "+" || key === "=") {
      zoomBy(1 / ZOOM_FACTOR);
    } else if (key === "-" || key === "_") {
      zoomBy(ZOOM_FACTOR);
    } else if (key === "0") {
      resetView();
    } else {
      handled = false;
    }
    if (handled && typeof event.preventDefault === "function") {
      event.preventDefault();
    }
    if (handled) {
      updateCamera();
    }
  }

  function applyReducedMotionPresentation() {
    if (!autoRotateButton) {
      return;
    }
    var rotating = Boolean(session && session.autoRotate && !reducedMotion);
    setAttribute(autoRotateButton, "aria-pressed", rotating ? "true" : "false");
    autoRotateButton.textContent = rotating ? "360° Tur · Açık" : "360° Tur · Kapalı";
    if (reducedMotion) {
      setAttribute(autoRotateButton, "disabled", "");
      autoRotateButton.disabled = true;
    } else {
      if (typeof autoRotateButton.removeAttribute === "function") {
        autoRotateButton.removeAttribute("disabled");
      }
      autoRotateButton.disabled = false;
    }
  }

  function configureMotionPreference() {
    if (!winRef || typeof winRef.matchMedia !== "function") {
      reducedMotion = false;
      return;
    }
    try {
      motionQuery = winRef.matchMedia("(prefers-reduced-motion: reduce)");
    } catch (_error) {
      motionQuery = null;
    }
    reducedMotion = Boolean(motionQuery && motionQuery.matches);
    var query = motionQuery;
    if (query) {
      if (typeof query.addEventListener === "function") {
        query.addEventListener("change", onMotionChange);
        detachers.push(function () {
          if (typeof query.removeEventListener === "function") {
            query.removeEventListener("change", onMotionChange);
          }
        });
      } else if (typeof query.addListener === "function") {
        query.addListener(onMotionChange);
        detachers.push(function () {
          if (typeof query.removeListener === "function") {
            query.removeListener(onMotionChange);
          }
        });
      }
    }
    applyReducedMotionPresentation();
  }

  function onMotionChange(event) {
    reducedMotion = Boolean(event && event.matches);
    if (reducedMotion && session) {
      session.autoRotate = false;
      if (session.updaterContext) {
        runUpdaters(session, 0);
      }
    }
    applyReducedMotionPresentation();
  }

  function runUpdaters(activeSession, delta) {
    if (!activeSession || !activeSession.updaterContext || !activeSession.updaters) {
      return;
    }
    activeSession.elapsed += delta;
    for (var index = 0; index < activeSession.updaters.length; index += 1) {
      activeSession.updaters[index](activeSession.updaterContext, activeSession.elapsed, delta, reducedMotion);
    }
  }

  function bindLogoFallbacks(documentRef) {
    if (!documentRef || typeof documentRef.querySelectorAll !== "function") {
      return;
    }
    var images = documentRef.querySelectorAll(".partner-marquee img[data-logo-fallback]");
    for (var index = 0; index < images.length; index += 1) {
      bindSingleLogoFallback(images[index]);
    }
  }

  function bindSingleLogoFallback(image) {
    if (!image || typeof image.getAttribute !== "function") {
      return;
    }
    var fallback = image.getAttribute("data-logo-fallback");
    if (typeof fallback !== "string" || fallback.length === 0) {
      return;
    }
    function applyFallback() {
      if (image.dataset && image.dataset.logoFallbackApplied === "true") {
        return;
      }
      if (image.dataset) {
        image.dataset.logoFallbackApplied = "true";
      }
      if ("src" in image) {
        image.src = fallback;
      }
      if (typeof image.setAttribute === "function") {
        image.setAttribute("src", fallback);
      }
    }
    addListener(image, "error", applyFallback, { once: true }, false);
    if (image.complete === true && image.naturalWidth === 0) {
      applyFallback();
    }
  }

  function probeWebGL() {
    if (webglCapable !== null || !docRef || typeof docRef.createElement !== "function") {
      return webglCapable === true;
    }
    var canvas = docRef.createElement("canvas");
    if (!canvas || typeof canvas.getContext !== "function") {
      webglCapable = false;
      return false;
    }
    var context = null;
    try {
      context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    } catch (_error) {
      context = null;
    }
    if (context && typeof context.getExtension === "function") {
      try {
        var extension = context.getExtension("WEBGL_lose_context");
        if (extension && typeof extension.loseContext === "function") {
          extension.loseContext();
        }
      } catch (_error) {
        webglCapable = Boolean(context);
        return webglCapable;
      }
    }
    webglCapable = Boolean(context);
    return webglCapable;
  }

  function validateThree(THREE) {
    if (!THREE || THREE.REVISION !== "160") {
      return false;
    }
    var required = [
      "WebGLRenderer", "Scene", "PerspectiveCamera", "Group", "Mesh",
      "BoxGeometry", "CylinderGeometry", "MeshStandardMaterial"
    ];
    for (var index = 0; index < required.length; index += 1) {
      if (typeof THREE[required[index]] !== "function") {
        return false;
      }
    }
    return true;
  }

  function clearLoadTimer() {
    if (loadTimer === null) {
      return;
    }
    if (winRef && typeof winRef.clearTimeout === "function") {
      winRef.clearTimeout(loadTimer);
    } else if (typeof clearTimeout === "function") {
      clearTimeout(loadTimer);
    }
    loadTimer = null;
  }

  function removeScript(script) {
    var index = pendingScripts.indexOf(script);
    if (index !== -1) {
      pendingScripts.splice(index, 1);
    }
    if (!script) {
      return;
    }
    if (typeof script.remove === "function") {
      script.remove();
    } else if (script.parentNode && typeof script.parentNode.removeChild === "function") {
      script.parentNode.removeChild(script);
    }
  }

  function removePendingScripts() {
    var scripts = pendingScripts.slice();
    for (var index = 0; index < scripts.length; index += 1) {
      removeScript(scripts[index]);
    }
    pendingScripts.length = 0;
  }

  function findLegacyViewer() {
    if (!docRef || typeof docRef.querySelector !== "function") {
      return null;
    }
    var gallery = docRef.getElementById("modalGallery");
    if (gallery && gallery.parentNode && typeof gallery.parentNode.querySelectorAll === "function") {
      var siblings = gallery.parentNode.querySelectorAll("[data-product-viewer]");
      for (var index = 0; index < siblings.length; index += 1) {
        if (siblings[index] !== gallery) {
          return siblings[index];
        }
      }
    }
    return docRef.querySelector("[data-product-viewer]");
  }

  function blockLegacyClick(event) {
    if (!event) {
      return;
    }
    if (typeof event.stopPropagation === "function") {
      event.stopPropagation();
    }
    if (typeof event.preventDefault === "function") {
      event.preventDefault();
    }
  }

  function blockLegacyKeydown(event) {
    if (!event || (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar")) {
      return;
    }
    blockLegacyClick(event);
  }

  function suppressLegacy() {
    if (legacyViewer) {
      return;
    }
    var node = findLegacyViewer();
    if (!node) {
      return;
    }
    var gallery = docRef.getElementById("modalGallery");
    legacyViewer = {
      node: node,
      wasHidden: node.hidden === true,
      hadAriaHidden: typeof node.getAttribute === "function" ? node.getAttribute("aria-hidden") : null,
      hadInert: "inert" in node ? node.inert === true : false,
      gallery: gallery
    };
    node.hidden = true;
    node.inert = true;
    setAttribute(node, "aria-hidden", "true");
    addListener(gallery, "click", blockLegacyClick, true, false);
    addListener(gallery, "keydown", blockLegacyKeydown, true, false);
  }

  function restoreLegacy() {
    if (!legacyViewer) {
      return;
    }
    var node = legacyViewer.node;
    if (node) {
      node.hidden = legacyViewer.wasHidden;
      node.inert = legacyViewer.hadInert;
      if (legacyViewer.hadAriaHidden === null && typeof node.removeAttribute === "function") {
        node.removeAttribute("aria-hidden");
      } else {
        setAttribute(node, "aria-hidden", legacyViewer.hadAriaHidden === null ? "false" : legacyViewer.hadAriaHidden);
      }
    }
    var gallery = legacyViewer.gallery;
    if (gallery && typeof gallery.removeEventListener === "function") {
      gallery.removeEventListener("click", blockLegacyClick, true);
      gallery.removeEventListener("keydown", blockLegacyKeydown, true);
    }
    legacyViewer = null;
  }

  function stageSize() {
    if (!stage) {
      return { width: 800, height: 450 };
    }
    if (typeof stage.getBoundingClientRect === "function") {
      var rect = stage.getBoundingClientRect();
      if (rect && finiteNumber(rect.width) > 0 && finiteNumber(rect.height) > 0) {
        return { width: finiteNumber(rect.width), height: finiteNumber(rect.height) };
      }
    }
    return {
      width: finiteNumber(stage.clientWidth) > 0 ? finiteNumber(stage.clientWidth) : 800,
      height: finiteNumber(stage.clientHeight) > 0 ? finiteNumber(stage.clientHeight) : 450
    };
  }

  function disposeScene(scene, renderAssets) {
    disposeRenderAssets(renderAssets);
    if (!scene || typeof scene.traverse !== "function") {
      return;
    }
    var geometries = [];
    var materials = [];
    scene.traverse(function (node) {
      if (node.geometry && geometries.indexOf(node.geometry) === -1) {
        geometries.push(node.geometry);
      }
      if (node.material) {
        var list = Array.isArray(node.material) ? node.material : [node.material];
        for (var index = 0; index < list.length; index += 1) {
          if (list[index] && materials.indexOf(list[index]) === -1) {
            materials.push(list[index]);
          }
        }
      }
      if (node.userData && Array.isArray(node.userData.materials)) {
        var owned = node.userData.materials;
        for (var ownedIndex = 0; ownedIndex < owned.length; ownedIndex += 1) {
          if (owned[ownedIndex] && materials.indexOf(owned[ownedIndex]) === -1) {
            materials.push(owned[ownedIndex]);
          }
        }
      }
    });
    for (var geometryIndex = 0; geometryIndex < geometries.length; geometryIndex += 1) {
      if (typeof geometries[geometryIndex].dispose === "function") {
        geometries[geometryIndex].dispose();
      }
    }
    for (var materialIndex = 0; materialIndex < materials.length; materialIndex += 1) {
      if (typeof materials[materialIndex].dispose === "function") {
        materials[materialIndex].dispose();
      }
    }
  }

  function destroySession(bumpEpoch) {
    if (bumpEpoch !== false) {
      sessionEpoch += 1;
    }
    var active = session;
    session = null;
    if (active) {
      active.tearingDown = true;
      emitSessionEvent(EVENT_SESSION_END, {
        id: active.id,
        epoch: active.epoch,
        scene: active.scene
      });
      if (winRef && typeof winRef.cancelAnimationFrame === "function" && active.rafId) {
        winRef.cancelAnimationFrame(active.rafId);
      }
      clearLoadTimer();
      removePendingScripts();
      for (var index = 0; index < detachers.length; index += 1) {
        detachers[index]();
      }
      detachers.length = 0;
      resizeObserver = null;
      disposeScene(active.scene, active.renderAssets);
      if (active.renderer && typeof active.renderer.dispose === "function") {
        active.renderer.dispose();
      }
      if (active.renderer && typeof active.renderer.forceContextLoss === "function") {
        contextLossIntentional = true;
        active.renderer.forceContextLoss();
      }
      if (active.canvas && typeof active.canvas.remove === "function") {
        active.canvas.remove();
      }
      active.scene = null;
      active.camera = null;
      active.renderer = null;
      active.canvas = null;
      active.group = null;
      active.meshes = null;
      active.renderAssets = null;
      active.updaters = null;
      active.updaterContext = null;
    }
    pointer = Object.freeze({ active: false, x: 0, y: 0, kind: "mouse" });
    if (stage && stage.classList) {
      stage.classList.remove("is-grabbing");
    }
    sessionState = nextSessionState(sessionState, "dispose");
  }

  function onContextLost() {
    var active = session;
    if (!active || active.tearingDown || !active.renderer) {
      return;
    }
    if (contextLossIntentional) {
      contextLossIntentional = false;
      return;
    }
    if (active.errorShown) {
      return;
    }
    active.errorShown = true;
    setStatus("3B bağlamı kaybedildi; fotoğraf yakınlaştırma görünümüne geçiliyor.", true);
    destroySession();
  }

  function updateCamera() {
    if (!session || !session.camera) {
      return;
    }
    orbitToCamera(session.camera, session.orbit);
    if (readout) {
      readout.textContent = Math.round((DEFAULT_RADIUS / clampZoom(session.orbit.radius)) * 100) + "%";
    }
  }

  function onResize() {
    if (!session) {
      return;
    }
    var size = stageSize();
    if (session.renderer && typeof session.renderer.setSize === "function") {
      session.renderer.setSize(size.width, size.height, false);
    }
    if (session.camera) {
      session.camera.aspect = size.width / size.height;
      if (typeof session.camera.updateProjectionMatrix === "function") {
        session.camera.updateProjectionMatrix();
      }
    }
    updateCamera();
  }

  function onVisibilityChange() {
    if (session) {
      session.lastTime = 0;
    }
  }

  function renderFrame(active, delta) {
    if (!active || active.disposed || active.tearingDown || session !== active || !active.renderer) {
      return;
    }
    if (docRef && docRef.hidden === true) {
      active.lastTime = 0;
      return;
    }
    if (active.autoRotate && !reducedMotion) {
      active.orbit.yaw = wrapAngle(active.orbit.yaw + AUTO_ROTATE_SPEED * delta);
    }
    runUpdaters(active, delta);
    refreshDynamicDecals(active);
    updateCamera();
    active.renderer.render(active.scene, active.camera);
    if (!active.firstFrameDone) {
      active.firstFrameDone = true;
      setStatus("", false);
    }
  }

  function startLoop(active) {
    if (!winRef || typeof winRef.requestAnimationFrame !== "function") {
      renderFrame(active, 0);
      return;
    }
    active.rafId = winRef.requestAnimationFrame(function tick(now) {
      if (!active || active.disposed || active.tearingDown || session !== active) {
        return;
      }
      var delta = active.lastTime === 0
        ? 0
        : Math.max(0, Math.min(0.05, (finiteNumber(now) - active.lastTime) / 1000));
      active.lastTime = finiteNumber(now);
      renderFrame(active, delta);
      if (session === active && !active.tearingDown) {
        active.rafId = winRef.requestAnimationFrame(tick);
      }
    });
  }

  function handleFailure(epoch) {
    if (epoch !== sessionEpoch) {
      return;
    }
    setStatus("3B görüntüleyici yüklenemedi; fotoğraf yakınlaştırma görünümüne geçiliyor.", true);
    destroySession();
    restoreLegacy();
    sessionState = nextSessionState(sessionState, "fail");
  }

  function startSession(epoch, id) {
    if (epoch !== sessionEpoch || !session) {
      return;
    }
    var THREE = winRef ? winRef.THREE : null;
    var entry = MODEL_REGISTRY[id];
    if (!validateThree(THREE) || !entry) {
      handleFailure(epoch);
      return;
    }
    var renderAssets = null;
    try {
      var size = stageSize();
      var canvas = docRef.createElement("canvas");
      canvas.className = "webgl-3d-viewer__canvas";
      setAttribute(canvas, "aria-hidden", "true");
      stage.appendChild(canvas);

      var renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
      });
      renderer.setPixelRatio(Math.min(numberOr(winRef.devicePixelRatio, 1), 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearColor(0x05070a, 0);
      renderer.setSize(size.width, size.height, false);

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(45, size.width / size.height, 0.1, 100);

      var ambient = new THREE.AmbientLight(0xffffff, 0.35);
      var hemisphere = new THREE.HemisphereLight(0xffdf9a, 0x080a0f, 0.7);
      var key = new THREE.DirectionalLight(0xd4af37, 2.2);
      key.position.set(4, 7, 5);
      key.castShadow = true;
      if (key.shadow && key.shadow.mapSize && typeof key.shadow.mapSize.set === "function") {
        key.shadow.mapSize.set(1024, 1024);
      }
      var rim = new THREE.DirectionalLight(0xf3d478, 1.2);
      rim.position.set(-5, 3, -4);
      var fill = new THREE.PointLight(0x4da3ff, 0.8, 18);
      fill.position.set(-3, 2, 4);
      scene.add(ambient);
      scene.add(hemisphere);
      scene.add(key);
      scene.add(rim);
      scene.add(fill);
      applyStudioLighting(id, {
        ambient: ambient, hemisphere: hemisphere, key: key, rim: rim, fill: fill
      });

      var pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(2, 2.15, 0.34, 64),
        new THREE.MeshStandardMaterial({ color: 0x1a1c21, metalness: 0.55, roughness: 0.4 })
      );
      pedestal.position.y = 0.17;
      pedestal.receiveShadow = true;
      var trimNear = new THREE.Mesh(
        new THREE.TorusGeometry(1.94, 0.035, 12, 96),
        new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.85, roughness: 0.25 })
      );
      trimNear.rotation.x = -Math.PI / 2;
      trimNear.position.y = 0.35;
      var trimFar = new THREE.Mesh(
        new THREE.TorusGeometry(2.08, 0.02, 10, 96),
        new THREE.MeshStandardMaterial({ color: PALETTE.goldLight, metalness: 0.8, roughness: 0.3 })
      );
      trimFar.rotation.x = -Math.PI / 2;
      trimFar.position.y = 0.05;
      var deck = new THREE.Mesh(
        new THREE.CircleGeometry(2, 64),
        new THREE.MeshStandardMaterial({ color: PALETTE.obsidian, metalness: 0.9, roughness: 0.25 })
      );
      deck.rotation.x = -Math.PI / 2;
      deck.position.y = 0.005;
      deck.receiveShadow = true;
      scene.add(pedestal);
      scene.add(trimNear);
      scene.add(trimFar);
      scene.add(deck);

      renderAssets = createRenderAssets(THREE, renderer, scene, id, entry.descriptors);
      var group = instantiate(THREE, entry.descriptors, PALETTE, renderAssets);
      if (!group) {
        disposeRenderAssets(renderAssets);
        renderAssets = null;
        handleFailure(epoch);
        return;
      }
      group.position.y = 0.36;
      scene.add(group);
  (function runStudioAjan(THREE, scene, group, cid) {
    if (!THREE || !THREE.SpotLight) return;
    var sRed = new THREE.SpotLight(0xe60012, 24, 24, Math.PI / 5, 0.55, 1.2);
    sRed.position.set(-4.2, 4.8, 3.8);
    if (sRed.target) { sRed.target.position.set(0, 1.1, 0); scene.add(sRed.target); }
    scene.add(sRed);

    var sWhite = new THREE.SpotLight(0xffffff, 28, 24, Math.PI / 5, 0.45, 1.2);
    sWhite.position.set(4.2, 5.2, 4.0);
    if (sWhite.target) { sWhite.target.position.set(0, 1.1, 0); scene.add(sWhite.target); }
    scene.add(sWhite);

    if (typeof document === "undefined" || !THREE.CanvasTexture) return;
    var bMap = {
      "1": ["HIKVISION", "SMART SECURITY & AI VISION", "#e60012"],
      "2": ["HIKVISION", "INTRUSION & ACCESS CONTROL", "#e60012"],
      "3": ["LAVOX", "electronics  |  ENTERPRISE INFRASTRUCTURE", "#f5d77f"],
      "4": ["N2MOBİL", "TELEMETRY & FUEL SENSING", "#ffffff"],
      "5": ["N2MOBİL", "DUAL-ANTENNA GNSS FLEET TRACKING", "#ffffff"],
      "6": ["LAVOX", "electronics  |  DUAL-SCREEN ERP WORKSTATION", "#f5d77f"],
      "7": ["LAVOX", "electronics  |  ADDRESSABLE FIRE ALARM", "#f5d77f"],
      "8": ["LAVOX", "electronics  |  INDUSTRIAL COMPENSATION PANEL", "#f5d77f"]
    };
    var inf = bMap[String(cid)] || bMap["3"];
    var lc = document.createElement("canvas");
    lc.width = 1024; lc.height = 384;
    var lx = lc.getContext("2d");
    if (lx) {
      lx.strokeStyle = "rgba(212,175,55,0.45)";
      lx.lineWidth = 3;
      lx.strokeRect(40, 44, 944, 296);
      lx.textAlign = "center";
      lx.font = "900 104px Arial, sans-serif";
      lx.fillStyle = inf[2];
      lx.fillText(inf[0], 512, 192);
      lx.font = "600 28px Arial, sans-serif";
      lx.fillStyle = "#d4af37";
      lx.fillText(inf[1], 512, 264);
      var lTex = new THREE.CanvasTexture(lc);
      var bg = new THREE.Mesh(
        new THREE.PlaneGeometry(5.6, 2.1),
        new THREE.MeshStandardMaterial({ map: lTex, transparent: true, opacity: 0.9, roughness: 0.35 })
      );
      bg.position.set(0, 1.75, -2.6);
      scene.add(bg);
    }

    function faceTex(role) {
      var c = document.createElement("canvas");
      c.width = 512; c.height = 512;
      var ctx = c.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = role === "front" ? "#15171e" : (role === "back" ? "#101217" : "#191c24");
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 6;
      ctx.strokeRect(14, 14, 484, 484);
      if (role === "front") {
        ctx.fillStyle = "#0b0d11"; ctx.fillRect(46, 56, 420, 150);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 34px monospace";
        ctx.fillText(inf[0] + " PRO-" + cid + "00", 66, 114);
        ctx.fillStyle = "#22c55e"; ctx.font = "600 22px monospace";
        ctx.fillText("ONLINE | CH-0" + cid, 66, 158);
      } else if (role === "side") {
        for (var y = 76; y <= 410; y += 26) { ctx.fillStyle = "#090a0d"; ctx.fillRect(60, y, 392, 12); }
      } else {
        ctx.fillStyle = "#090a0d"; ctx.fillRect(58, 70, 396, 360);
        ctx.fillStyle = "#d4af37"; ctx.font = "bold 20px monospace"; ctx.textAlign = "center";
        ctx.fillText("NAZTECH CERTIFIED | 220V/24V DC", 256, 385);
      }
      return new THREE.CanvasTexture(c);
    }

    var tF = faceTex("front"), tS = faceTex("side"), tB = faceTex("back");
    if (tF && tS && tB && group && group.traverse) {
      group.traverse(function (n) {
        if (n.isMesh && n.geometry && n.geometry.type === "BoxGeometry") {
          var p = n.geometry.parameters || {};
          if ((p.width || 0) >= 0.45 && (p.height || 0) >= 0.22 && (p.depth || 0) >= 0.2) {
            var m = function (tx) { return new THREE.MeshStandardMaterial({ map: tx, bumpMap: tx, bumpScale: 0.025, metalness: 0.62, roughness: 0.32 }); };
            n.material = [m(tS), m(tS), m(tS), m(tS), m(tF), m(tB)];
          }
        }
      });
    }
  })(THREE, scene, group, id);

      var meshes = group.userData && group.userData.meshes ? group.userData.meshes : Object.create(null);
      session.renderer = renderer;
      session.scene = scene;
      session.camera = camera;
      session.canvas = canvas;
      session.group = group;
      session.meshes = meshes;
      session.renderAssets = renderAssets;
      session.updaters = entry.updaters;
      session.updaterContext = {
        meshes: meshes,
        isAnimated: function (name) {
          return isAnimatedName(name);
        }
      };
      session.orbit = {
        yaw: DEFAULT_YAW,
        pitch: DEFAULT_PITCH,
        radius: DEFAULT_RADIUS,
        target: new THREE.Vector3(0, 1.15, 0)
      };
      session.autoRotate = false;
      session.lastTime = 0;
      session.elapsed = 0;
      emitSessionEvent(EVENT_SESSION_READY, {
        id: id,
        epoch: epoch,
        scene: scene,
        camera: camera,
        renderer: renderer,
        group: group,
        meshes: meshes
      });

      addListener(canvas, "webglcontextlost", onContextLost, false, false);
      if (winRef && typeof winRef.ResizeObserver === "function") {
        try {
          resizeObserver = new winRef.ResizeObserver(onResize);
          resizeObserver.observe(stage);
        } catch (_error) {
          resizeObserver = null;
        }
      }
      if (!resizeObserver) {
        addListener(winRef, "resize", onResize, false, true);
      }
      addListener(docRef, "visibilitychange", onVisibilityChange, false, true);
      if (titleNode) {
        titleNode.textContent = entry.label;
      }
      applyReducedMotionPresentation();
      shell.hidden = false;
      updateCamera();
      sessionState = nextSessionState(sessionState, "ready");
      startLoop(session);
    } catch (_error) {
      disposeRenderAssets(renderAssets);
      handleFailure(epoch);
    }
  }

  function loadThree(index, epoch) {
    if (epoch !== sessionEpoch || !session) {
      return;
    }
    if (index >= SOURCES.length) {
      handleFailure(epoch);
      return;
    }
    if (winRef && validateThree(winRef.THREE)) {
      startSession(epoch, activeCatalogId);
      return;
    }
    if (!docRef || typeof docRef.createElement !== "function") {
      handleFailure(epoch);
      return;
    }
    var source = SOURCES[index];
    var script = docRef.createElement("script");
    script.async = false;
    script.crossOrigin = "anonymous";
    if (source.integrity) {
      setAttribute(script, "integrity", source.integrity);
    }
    setAttribute(script, "src", source.url);
    pendingScripts.push(script);
    var settled = false;

    function cleanup() {
      clearLoadTimer();
      removeScript(script);
    }

    function onLoad() {
      if (settled) {
        return;
      }
      if (epoch !== sessionEpoch || !session) {
        cleanup();
        return;
      }
      settled = true;
      cleanup();
      if (winRef && validateThree(winRef.THREE)) {
        startSession(epoch, activeCatalogId);
      } else {
        loadThree(index + 1, epoch);
      }
    }

    function onError() {
      if (settled) {
        return;
      }
      if (epoch !== sessionEpoch || !session) {
        cleanup();
        return;
      }
      settled = true;
      cleanup();
      loadThree(index + 1, epoch);
    }

    if ("onload" in script) {
      script.onload = onLoad;
      script.onerror = onError;
    } else {
      addListener(script, "load", onLoad, false, false);
      addListener(script, "error", onError, false, false);
    }
    if (winRef && typeof winRef.setTimeout === "function") {
      loadTimer = winRef.setTimeout(onError, LOAD_TIMEOUT_MS);
    } else if (typeof setTimeout === "function") {
      loadTimer = setTimeout(onError, LOAD_TIMEOUT_MS);
    }
    var host = docRef.head || docRef.documentElement || docRef.body;
    if (host && typeof host.appendChild === "function") {
      host.appendChild(script);
    } else {
      onError();
    }
  }

  function open(rawId) {
    if (!docRef || typeof rawId !== "string" || !/^[1-8]$/.test(rawId)) {
      return false;
    }
    sessionEpoch += 1;
    var epoch = sessionEpoch;
    destroySession(false);
    activeCatalogId = rawId;
    sessionState = nextSessionState(sessionState, { type: "open", id: rawId });
    contextLossIntentional = false;
    configureMotionPreference();
    if (!ensureShell()) {
      sessionState = nextSessionState(sessionState, "fail");
      return false;
    }
    shell.hidden = false;
    setStatus("3B model hazırlanıyor…", true);
    if (!probeWebGL()) {
      handleFailure(epoch);
      return false;
    }
    suppressLegacy();
    session = {
      epoch: epoch,
      id: rawId,
      canvas: null,
      renderer: null,
      scene: null,
      camera: null,
      group: null,
      meshes: null,
      renderAssets: null,
      updaters: null,
      updaterContext: null,
      orbit: null,
      rafId: 0,
      lastTime: 0,
      elapsed: 0,
      autoRotate: false,
      firstFrameDone: false,
      errorShown: false,
      tearingDown: false,
      disposed: false
    };
    loadThree(0, epoch);
    return true;
  }

  function close() {
    if (!session && !activeCatalogId) {
      return false;
    }
    activeCatalogId = null;
    destroySession();
    restoreLegacy();
    if (shell) {
      shell.hidden = true;
    }
    return true;
  }

  function handleCatalogOpen(event) {
    var detail = event && event.detail ? event.detail : null;
    open(detail && typeof detail.id === "string" ? detail.id : null);
  }

  function handleCatalogClose() {
    close();
  }

  function emitSessionEvent(type, detail) {
    if (!docRef || typeof docRef.dispatchEvent !== "function") {
      return;
    }
    var EventCtor = winRef && typeof winRef.CustomEvent === "function" ? winRef.CustomEvent : null;
    if (!EventCtor) {
      return;
    }
    try {
      docRef.dispatchEvent(new EventCtor(type, { detail: detail }));
    } catch (_error) {
      return;
    }
  }

  function ready(documentRef, windowRef) {
    if (isReady || !documentRef) {
      return;
    }
    docRef = documentRef;
    winRef = windowRef || null;
    bindLogoFallbacks(docRef);
    configureMotionPreference();
    addListener(docRef, EVENT_OPEN, handleCatalogOpen, false, false);
    addListener(docRef, EVENT_CLOSE, handleCatalogClose, false, false);
    isReady = true;
  }

  var viewerApi = Object.freeze({
    open: open,
    close: close,
    events: Object.freeze({
      sessionReady: EVENT_SESSION_READY,
      sessionEnd: EVENT_SESSION_END
    }),
    isReady: function () {
      return isReady;
    },
    getState: function () {
      return Object.freeze({
        ready: isReady,
        phase: sessionState.phase,
        catalogId: activeCatalogId,
        epoch: sessionEpoch,
        reducedMotion: reducedMotion,
        webglCapable: webglCapable,
        sessionActive: Boolean(session)
      });
    }
  });

  var testApi = Object.freeze({
    MODEL_IDS: MODEL_IDS,
    PALETTE: PALETTE,
    MODEL_REGISTRY: MODEL_REGISTRY,
    clampZoom: clampZoom,
    applyOrbitDelta: applyOrbitDelta,
    orbitToCamera: orbitToCamera,
    wrapAngle: wrapAngle,
    buildSceneDescriptors: buildSceneDescriptors,
    validateModelRegistry: validateModelRegistry,
    instantiate: instantiate,
    createSessionState: createSessionState,
    nextSessionState: nextSessionState
  });

  if (typeof window !== "undefined" && window) {
    Object.defineProperty(window, "NAZTECH_WEBGL_VIEWER", {
      value: viewerApi,
      writable: false,
      enumerable: true,
      configurable: false
    });
    Object.defineProperty(window, "NAZTECH_WEBGL_TEST", {
      value: testApi,
      writable: false,
      enumerable: true,
      configurable: false
    });
  }

  if (typeof document !== "undefined" && document) {
    if (document.readyState === "loading" && typeof document.addEventListener === "function") {
      document.addEventListener("DOMContentLoaded", function () {
        ready(document, typeof window !== "undefined" && window ? window : null);
      }, { once: true });
    } else {
      ready(document, typeof window !== "undefined" && window ? window : null);
    }
  }
})();
