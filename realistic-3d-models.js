/*
 * Baysöz Yazılım — NAZTECH realistic catalog hardware layer.
 * Contact: baysozlabs@proton.me
 *
 * Classic deferred script. It attaches to the active WebGL inspector session
 * through the session events published by the viewer and never allocates a
 * second renderer. All geometry, surface, texture, and animation data is
 * deterministic and free of external network requests.
 */
(function () {
  "use strict";

  var EVENT_SESSION_READY = "naztech:webgl-session-ready";
  var EVENT_SESSION_END = "naztech:webgl-session-end";

  var MODEL_IDS = Object.freeze(["1", "2", "3", "4", "5", "6", "7", "8"]);
  var LAYER_NAME = "naztech-realistic-layer";
  var MESH_BUDGET = Object.freeze({ min: 30, max: 199 });
  var MAX_TEXTURE_SIZE = 2048;
  var MAX_ANISOTROPY = 4;
  var PEDESTAL_OFFSET = 0.36;

  var BRAND = Object.freeze({
    hikvision: Object.freeze({
      key: "hikvision",
      name: "HIKVISION",
      tagline: "SMART SECURITY SYSTEMS",
      color: "#E60012",
      secondary: "#FFFFFF",
      hex: 0xe60012
    }),
    n2mobil: Object.freeze({
      key: "n2mobil",
      name: "N2MOBİL",
      tagline: "GNSS FLEET TELEMATICS",
      color: "#E93B77",
      secondary: "#FFFFFF",
      hex: 0xe93b77
    }),
    lavox: Object.freeze({
      key: "lavox",
      name: "LAVOX electronics",
      tagline: "INDUSTRIAL ELECTRONICS",
      color: "#19A7B8",
      secondary: "#FFFFFF",
      hex: 0x19a7b8
    })
  });

  var BRAND_BY_ID = Object.freeze({
    "1": "hikvision",
    "2": "hikvision",
    "3": "lavox",
    "4": "n2mobil",
    "5": "n2mobil",
    "6": "lavox",
    "7": "lavox",
    "8": "lavox"
  });

  var PRODUCT_LABEL = Object.freeze({
    "1": "COLORVU BULLET CAMERA",
    "2": "SMOKED DOME CAMERA",
    "3": "19-INCH RACK SERVER",
    "4": "FUEL TELEMETRY PROBE",
    "5": "DUAL ANTENNA GPS TRACKER",
    "6": "DUAL SCREEN ERP STATION",
    "7": "ADDRESSABLE FIRE PANEL",
    "8": "COMPENSATION CABINET"
  });

  function surface(color, metalness, roughness, envMapIntensity, options) {
    var config = options || {};
    return Object.freeze({
      color: color,
      metalness: metalness,
      roughness: roughness,
      envMapIntensity: envMapIntensity,
      physical: Boolean(config.physical),
      clearcoat: typeof config.clearcoat === "number" ? config.clearcoat : 0,
      clearcoatRoughness: typeof config.clearcoatRoughness === "number" ? config.clearcoatRoughness : 0.22,
      opacity: typeof config.opacity === "number" ? config.opacity : 1,
      transparent: Boolean(config.transparent),
      emissive: typeof config.emissive === "number" ? config.emissive : 0x000000,
      emissiveIntensity: typeof config.emissiveIntensity === "number" ? config.emissiveIntensity : 0,
      depthWrite: config.depthWrite !== false
    });
  }

  var SURFACES = Object.freeze({
    aluminum: surface(0xb9c2cc, 0.86, 0.3, 0.8, { physical: true, clearcoat: 0.18 }),
    brushed: surface(0xc8d0d8, 0.9, 0.24, 0.85, { physical: true, clearcoat: 0.12 }),
    powderWhite: surface(0xeef1f4, 0.16, 0.44, 0.7, { physical: true, clearcoat: 0.24 }),
    stainless: surface(0xaeb8c2, 0.94, 0.26, 0.8, { physical: true }),
    darkSteel: surface(0x333a45, 0.72, 0.42, 0.6, { physical: true }),
    anodized: surface(0x22262d, 0.9, 0.3, 0.68, { physical: true }),
    polymer: surface(0x15181e, 0.14, 0.62, 0.45, {}),
    rubber: surface(0x101216, 0.02, 0.88, 0.28, {}),
    copper: surface(0xb87333, 0.95, 0.24, 0.85, { physical: true }),
    gold: surface(0xd4af37, 0.9, 0.22, 0.9, { physical: true }),
    smokedAcrylic: surface(0x253342, 0.08, 0.1, 0.85, {
      physical: true, transparent: true, opacity: 0.42, depthWrite: false, clearcoat: 1
    }),
    opticalGlass: surface(0x1b3557, 0.04, 0.06, 0.95, {
      physical: true, transparent: true, opacity: 0.86, depthWrite: false, clearcoat: 1
    }),
    rackGlass: surface(0x14202c, 0.12, 0.14, 0.8, {
      physical: true, transparent: true, opacity: 0.34, depthWrite: false, clearcoat: 0.85
    }),
    redEnamel: surface(0xb3122c, 0.32, 0.38, 0.7, { physical: true, clearcoat: 0.4 }),
    ledRed: surface(0x4a0a10, 0.05, 0.28, 0.4, {
      emissive: 0xff2744, emissiveIntensity: 1.2, physical: true
    }),
    ledGreen: surface(0x0d3a22, 0.05, 0.28, 0.4, {
      emissive: 0x37f59a, emissiveIntensity: 1.0, physical: true
    }),
    ledAmber: surface(0x4a2c08, 0.05, 0.28, 0.4, {
      emissive: 0xffb43d, emissiveIntensity: 1.05, physical: true
    }),
    ledBlue: surface(0x0b2740, 0.05, 0.28, 0.4, {
      emissive: 0x4da3ff, emissiveIntensity: 1.0, physical: true
    }),
    screen: surface(0x0b1a2a, 0.08, 0.18, 0.6, {
      emissive: 0x2e9fff, emissiveIntensity: 0.7, physical: true
    }),
    decal: surface(0xffffff, 0, 0.72, 0.5, {
      physical: true, transparent: true, depthWrite: false, emissive: 0xffffff, emissiveIntensity: 0.35
    })
  });

  var TEXTURE_SPECS = Object.freeze({
    "plate-front": Object.freeze({ width: 1024, height: 512, recipe: "plate", bump: 0.018 }),
    "plate-side": Object.freeze({ width: 1024, height: 512, recipe: "plate", bump: 0.016 }),
    "plate-back": Object.freeze({ width: 1024, height: 512, recipe: "plate", bump: 0.014 }),
    "brand-hikvision": Object.freeze({ width: 1024, height: 384, recipe: "brand", bump: 0.006 }),
    "brand-n2mobil": Object.freeze({ width: 1024, height: 384, recipe: "brand", bump: 0.006 }),
    "brand-lavox": Object.freeze({ width: 1024, height: 384, recipe: "brand", bump: 0.006 }),
    "brand-primary": Object.freeze({ width: 1024, height: 384, recipe: "brand", bump: 0.006 }),
    "erp-dashboard": Object.freeze({ width: 1024, height: 640, recipe: "dashboard", bump: 0.004 }),
    "lcd-zone": Object.freeze({ width: 768, height: 384, recipe: "zone", bump: 0.004 }),
    "meter-volts": Object.freeze({ width: 640, height: 384, recipe: "meter-volts", bump: 0.004 }),
    "meter-amps": Object.freeze({ width: 640, height: 384, recipe: "meter-amps", bump: 0.004 }),
    "warning-hv": Object.freeze({ width: 640, height: 384, recipe: "warning", bump: 0.006 }),
    "telemetry-readout": Object.freeze({ width: 768, height: 384, recipe: "telemetry", bump: 0.004 }),
    "backdrop": Object.freeze({ width: 1536, height: 512, recipe: "backdrop", bump: 0 })
  });

  var PRIMITIVE_CTORS = Object.freeze({
    box: "BoxGeometry",
    cylinder: "CylinderGeometry",
    sphere: "SphereGeometry",
    torus: "TorusGeometry",
    cone: "ConeGeometry",
    plane: "PlaneGeometry",
    circle: "CircleGeometry"
  });

  function finiteNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function numberOr(value, fallback) {
    return finiteNumber(value) ? value : fallback;
  }

  function pad2(value) {
    return (value < 10 ? "0" : "") + value;
  }

  function part(name, primitive, args, material, position, rotation, scale, options) {
    return Object.freeze({
      name: name,
      primitive: primitive,
      args: Object.freeze(args.slice()),
      material: material,
      position: Object.freeze(position.slice()),
      rotation: Object.freeze(rotation.slice()),
      scale: Object.freeze(scale.slice()),
      options: Object.freeze(options || {})
    });
  }

  function finalize(label, parts, animators) {
    return Object.freeze({
      label: label,
      parts: Object.freeze(parts.slice()),
      animators: Object.freeze(animators.slice()),
      count: parts.length
    });
  }

  function ringXY(prefix, count, radius, x, y, z, primitive, args, material, options) {
    var result = [];
    for (var index = 0; index < count; index += 1) {
      var angle = index / count * Math.PI * 2;
      result.push(part(
        prefix + "-" + pad2(index + 1),
        primitive,
        args,
        material,
        [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, z],
        [0, 0, 0],
        [1, 1, 1],
        options || {}
      ));
    }
    return result;
  }

  function ringXZ(prefix, count, radius, x, y, z, primitive, args, material, options) {
    var result = [];
    for (var index = 0; index < count; index += 1) {
      var angle = index / count * Math.PI * 2;
      result.push(part(
        prefix + "-" + pad2(index + 1),
        primitive,
        args,
        material,
        [x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius],
        [0, 0, 0],
        [1, 1, 1],
        options || {}
      ));
    }
    return result;
  }

  function gridParts(prefix, columns, rows, dx, dy, origin, primitive, args, material, options) {
    var result = [];
    for (var row = 0; row < rows; row += 1) {
      for (var column = 0; column < columns; column += 1) {
        result.push(part(
          prefix + "-" + pad2(row * columns + column + 1),
          primitive,
          args,
          material,
          [origin[0] + column * dx, origin[1] - row * dy, origin[2]],
          [0, 0, 0],
          [1, 1, 1],
          options || {}
        ));
      }
    }
    return result;
  }

  function pushAll(target, source) {
    for (var index = 0; index < source.length; index += 1) {
      target.push(source[index]);
    }
  }

  function buildBulletCamera() {
    var parts = [];
    var ledOptions = { animator: "ledPulse" };

    parts.push(part("bullet-body", "cylinder", [0.42, 0.42, 1.5, 40], "aluminum",
      [0, 1.2, 0], [Math.PI / 2, 0, 0], [1, 1, 1], { texture: "plate-side" }));
    parts.push(part("bullet-rear-cap", "cylinder", [0.44, 0.4, 0.14, 32], "powderWhite",
      [0, 1.2, -0.78], [Math.PI / 2, 0, 0], [1, 1, 1], { texture: "plate-back" }));
    parts.push(part("bullet-front-collar", "cylinder", [0.45, 0.44, 0.12, 32], "darkSteel",
      [0, 1.2, 0.78], [Math.PI / 2, 0, 0], [1, 1, 1], {}));

    parts.push(part("sunshield-visor", "box", [1.18, 0.06, 0.92], "powderWhite",
      [0, 1.63, 0.2], [0, 0, 0], [1, 1, 1], { texture: "plate-front" }));
    parts.push(part("sunshield-lip", "box", [1.18, 0.14, 0.05], "powderWhite",
      [0, 1.56, 0.64], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("visor-wing-left", "box", [0.05, 0.05, 0.86], "powderWhite",
      [-0.58, 1.6, 0.2], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("visor-wing-right", "box", [0.05, 0.05, 0.86], "powderWhite",
      [0.58, 1.6, 0.2], [0, 0, 0], [1, 1, 1], {}));

    parts.push(part("optical-barrel", "cylinder", [0.26, 0.3, 0.24, 32], "anodized",
      [0, 1.2, 0.9], [Math.PI / 2, 0, 0], [1, 1, 1], {}));
    parts.push(part("lens-hood", "cylinder", [0.3, 0.27, 0.12, 32], "darkSteel",
      [0, 1.2, 1.06], [Math.PI / 2, 0, 0], [1, 1, 1], {}));
    for (var element = 0; element < 4; element += 1) {
      parts.push(part("lens-element-" + pad2(element + 1), "sphere", [0.2 - element * 0.025, 20, 16], "opticalGlass",
        [0, 1.2, 1.0 + element * 0.022], [0, 0, 0], [1, 1, 0.35], {}));
    }
    parts.push(part("lens-front-ring", "torus", [0.25, 0.025, 12, 40], "gold",
      [0, 1.2, 1.13], [0, 0, 0], [1, 1, 1], {}));

    parts.push(part("ir-led-ring", "torus", [0.35, 0.035, 12, 48], "polymer",
      [0, 1.2, 0.92], [0, 0, 0], [1, 1, 1], {}));
    pushAll(parts, ringXY("ir-led", 24, 0.35, 0, 1.2, 0.94, "sphere", [0.032, 10, 8], "ledRed", ledOptions));
    parts.push(part("status-led", "sphere", [0.04, 12, 10], "ledGreen",
      [0.34, 0.93, 0.6], [0, 0, 0], [1, 1, 1], { animator: "ledPulse", phase: 5 }));

    parts.push(part("wall-mount-plate", "box", [0.6, 0.62, 0.09], "powderWhite",
      [0, 1.2, -1.02], [0, 0, 0], [1, 1, 1], { texture: "plate-front" }));
    parts.push(part("bracket-arm", "box", [0.16, 0.16, 0.42], "brushed",
      [0, 1.2, -0.85], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("bracket-yaw-joint", "sphere", [0.13, 16, 12], "stainless",
      [0, 1.2, -0.7], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("bracket-pitch-joint", "sphere", [0.11, 16, 12], "stainless",
      [0, 1.2, -0.58], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("bracket-roll-joint", "sphere", [0.09, 16, 12], "stainless",
      [0, 1.2, -0.48], [0, 0, 0], [1, 1, 1], {}));
    pushAll(parts, ringXY("bracket-bolt", 4, 0.24, 0, 1.2, -1.08, "cylinder", [0.035, 0.035, 0.04, 12], "stainless", {}));

    parts.push(part("cable-gland", "cylinder", [0.11, 0.11, 0.18, 20], "anodized",
      [0, 0.98, -0.88], [Math.PI / 2, 0, 0], [1, 1, 1], {}));
    parts.push(part("cable-seal", "torus", [0.1, 0.018, 10, 24], "rubber",
      [0, 0.98, -0.98], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("cable-tail", "cylinder", [0.045, 0.045, 0.36, 12], "rubber",
      [0, 0.9, -1.08], [Math.PI / 2.4, 0, 0], [1, 1, 1], {}));
    pushAll(parts, gridParts("housing-vent", 6, 1, 0.14, 0, [-0.35, 1.48, 0.02],
      "box", [0.06, 0.02, 0.5], "anodized", {}));

    parts.push(part("hikvision-side-left", "plane", [0.62, 0.3], "decal",
      [-0.425, 1.2, 0.05], [0, -Math.PI / 2, 0], [1, 1, 1], { texture: "brand-hikvision" }));
    parts.push(part("hikvision-side-right", "plane", [0.62, 0.3], "decal",
      [0.425, 1.2, 0.05], [0, Math.PI / 2, 0], [1, 1, 1], { texture: "brand-hikvision" }));

    return finalize("HIKVISION ColorVu bullet camera", parts, ["ledPulse"]);
  }

  function buildDomeCamera() {
    var parts = [];

    parts.push(part("dome-base-plate", "cylinder", [0.8, 0.82, 0.12, 48], "brushed",
      [0, 0.08, 0], [0, 0, 0], [1, 1, 1], { texture: "plate-back" }));
    parts.push(part("dome-base-ring", "torus", [0.72, 0.035, 12, 48], "stainless",
      [0, 0.16, 0], [Math.PI / 2, 0, 0], [1, 1, 1], {}));
    pushAll(parts, ringXZ("dome-mount-screw", 6, 0.66, 0, 0.16, 0,
      "cylinder", [0.035, 0.035, 0.04, 12], "stainless", {}));

    parts.push(part("smoked-acrylic-dome", "sphere", [0.78, 48, 32], "smokedAcrylic",
      [0, 0.62, 0], [0, 0, 0], [1, 0.74, 1], {}));
    parts.push(part("dome-inner-shell", "sphere", [0.66, 40, 28], "anodized",
      [0, 0.6, 0], [0, 0, 0], [1, 0.62, 1], { texture: "plate-side" }));

    parts.push(part("gimbal-yaw-ring", "torus", [0.4, 0.045, 12, 40], "brushed",
      [0, 0.62, 0], [Math.PI / 2, 0, 0], [1, 1, 1], { animator: "gimbalYaw" }));
    parts.push(part("gimbal-pitch-yoke", "torus", [0.3, 0.04, 12, 36], "stainless",
      [0, 0.62, 0.06], [0, Math.PI / 2, 0], [1, 1, 1], { animator: "gimbalPitch" }));
    parts.push(part("gimbal-hub", "sphere", [0.2, 24, 18], "darkSteel",
      [0, 0.62, 0.14], [0, 0, 0], [1, 1, 1], { texture: "plate-front" }));
    parts.push(part("gimbal-motor-left", "cylinder", [0.11, 0.11, 0.16, 20], "stainless",
      [-0.32, 0.62, 0], [0, 0, Math.PI / 2], [1, 1, 1], {}));
    parts.push(part("gimbal-motor-right", "cylinder", [0.11, 0.11, 0.16, 20], "stainless",
      [0.32, 0.62, 0], [0, 0, Math.PI / 2], [1, 1, 1], {}));

    parts.push(part("internal-lens-barrel", "cylinder", [0.17, 0.19, 0.22, 28], "anodized",
      [0, 0.62, 0.26], [Math.PI / 2, 0, 0], [1, 1, 1], {}));
    for (var glass = 0; glass < 3; glass += 1) {
      parts.push(part("internal-glass-" + pad2(glass + 1), "circle", [0.14 - glass * 0.015, 28], "opticalGlass",
        [0, 0.62, 0.38 + glass * 0.012], [0, 0, 0], [1, 1, 1], {}));
    }
    pushAll(parts, ringXY("internal-ir-led", 12, 0.28, 0, 0.62, 0.4,
      "sphere", [0.026, 10, 8], "ledRed", { animator: "ledPulse" }));
    parts.push(part("thermal-sensor", "box", [0.16, 0.12, 0.08], "darkSteel",
      [0.2, 0.44, 0.3], [0, 0.2, 0], [1, 1, 1], {}));
    parts.push(part("dome-status-led", "sphere", [0.035, 12, 10], "ledGreen",
      [0, 0.2, 0.7], [0, 0, 0], [1, 1, 1], { animator: "ledPulse", phase: 3 }));

    for (var baffle = 0; baffle < 4; baffle += 1) {
      var baffleAngle = baffle * Math.PI / 2;
      parts.push(part("dome-baffle-" + pad2(baffle + 1), "box", [0.26, 0.05, 0.1], "polymer",
        [Math.cos(baffleAngle) * 0.42, 0.3, Math.sin(baffleAngle) * 0.42],
        [0, -baffleAngle, 0], [1, 1, 1], {}));
    }
    pushAll(parts, ringXZ("dome-vent-slot", 6, 0.6, 0, 0.12, 0,
      "box", [0.1, 0.02, 0.16], "anodized", {}));

    parts.push(part("dome-cable-gland", "cylinder", [0.09, 0.09, 0.14, 18], "anodized",
      [0, 0.14, -0.72], [Math.PI / 2, 0, 0], [1, 1, 1], {}));
    parts.push(part("dome-conduit-01", "cylinder", [0.04, 0.04, 0.3, 12], "darkSteel",
      [0, 0.14, -0.9], [Math.PI / 2, 0, 0], [1, 1, 1], {}));
    parts.push(part("dome-conduit-02", "cylinder", [0.04, 0.04, 0.3, 12], "darkSteel",
      [0.2, 0.14, -0.88], [Math.PI / 2, 0, 0], [1, 1, 1], {}));

    parts.push(part("hikvision-base-label", "plane", [0.5, 0.22], "decal",
      [0, 0.09, 0.79], [0, 0, 0], [1, 1, 1], { texture: "brand-hikvision" }));
    parts.push(part("dome-rating-plate", "plane", [0.36, 0.16], "decal",
      [-0.4, 0.09, 0.66], [0, 0.2, 0], [1, 1, 1], { texture: "plate-back" }));

    return finalize("HIKVISION smoked dome camera", parts, ["gimbalYaw", "gimbalPitch", "ledPulse"]);
  }

  function buildRackServer() {
    var parts = [];

    parts.push(part("rack-frame", "box", [1.7, 2.2, 1.1], "darkSteel",
      [0, 1.2, 0], [0, 0, 0], [1, 1, 1], { texture: "plate-back" }));
    parts.push(part("rack-top", "box", [1.76, 0.08, 1.16], "brushed",
      [0, 2.32, 0], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("rack-base", "box", [1.76, 0.1, 1.16], "brushed",
      [0, 0.08, 0], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("rack-side-left", "box", [0.06, 2.2, 1.1], "darkSteel",
      [-0.85, 1.2, 0], [0, 0, 0], [1, 1, 1], { texture: "plate-side" }));
    parts.push(part("rack-side-right", "box", [0.06, 2.2, 1.1], "darkSteel",
      [0.85, 1.2, 0], [0, 0, 0], [1, 1, 1], { texture: "plate-side" }));

    parts.push(part("glass-front-door", "plane", [1.5, 2.05], "rackGlass",
      [0, 1.2, 0.58], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("door-frame-top", "box", [1.62, 0.06, 0.05], "stainless",
      [0, 2.24, 0.6], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("door-frame-bottom", "box", [1.62, 0.06, 0.05], "stainless",
      [0, 0.16, 0.6], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("door-frame-left", "box", [0.06, 2.1, 0.05], "stainless",
      [-0.78, 1.2, 0.6], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("door-frame-right", "box", [0.06, 2.1, 0.05], "stainless",
      [0.78, 1.2, 0.6], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("door-handle", "cylinder", [0.03, 0.03, 0.24, 14], "brushed",
      [0.68, 1.2, 0.66], [0, 0, 0], [1, 1, 1], {}));
    for (var hinge = 0; hinge < 3; hinge += 1) {
      parts.push(part("door-hinge-" + pad2(hinge + 1), "cylinder", [0.035, 0.035, 0.14, 12], "stainless",
        [-0.84, 0.5 + hinge * 0.7, 0.58], [0, 0, 0], [1, 1, 1], {}));
    }

    for (var unit = 0; unit < 12; unit += 1) {
      var unitY = 0.45 + unit * 0.14;
      parts.push(part("rack-unit-" + pad2(unit + 1), "box", [1.42, 0.11, 0.9], "stainless",
        [0, unitY, 0.12], [0, 0, 0], [1, 1, 1], { texture: "plate-front" }));
      parts.push(part("ventilated-grille-" + pad2(unit + 1), "box", [0.62, 0.06, 0.02], "anodized",
        [-0.28, unitY, 0.58], [0, 0, 0], [1, 1, 1], {}));
      parts.push(part("status-led-green-" + pad2(unit + 1), "sphere", [0.022, 10, 8], "ledGreen",
        [0.52, unitY, 0.6], [0, 0, 0], [1, 1, 1], { animator: "ledPulse", phase: unit }));
    }
    pushAll(parts, gridParts("status-led-amber", 2, 3, 0.1, 0.1, [-0.5, 2.0, 0.6],
      "sphere", [0.024, 10, 8], "ledAmber", { animator: "ledPulse" }));
    pushAll(parts, gridParts("rj45-port", 8, 2, 0.14, 0.12, [-0.5, 0.62, 0.6],
      "box", [0.1, 0.08, 0.04], "anodized", {}));

    parts.push(part("network-switch", "box", [1.42, 0.16, 0.85], "anodized",
      [0, 0.38, 0.12], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("patch-panel", "box", [1.42, 0.12, 0.8], "brushed",
      [0, 0.24, 0.1], [0, 0, 0], [1, 1, 1], {}));
    pushAll(parts, ringXZ("rack-fan", 4, 0.28, 0, 2.2, 0,
      "cylinder", [0.14, 0.14, 0.04, 20], "polymer", {}));
    parts.push(part("cable-tray", "box", [1.3, 0.04, 0.5], "darkSteel",
      [0, 2.06, -0.22], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("rack-asset-decal", "plane", [0.5, 0.22], "decal",
      [0, 0.16, 0.62], [0, 0, 0], [1, 1, 1], { texture: "plate-back" }));

    return finalize("Enterprise 19-inch rack server", parts, ["ledPulse"]);
  }

  function buildFuelTelemetrySensor() {
    var parts = [];

    parts.push(part("stainless-immersion-probe", "cylinder", [0.09, 0.09, 1.2, 28], "stainless",
      [0, 0.72, 0], [0, 0, 0], [1, 1, 1], { texture: "plate-side" }));
    parts.push(part("probe-tip", "cone", [0.09, 0.2, 24], "stainless",
      [0, 0.04, 0], [Math.PI, 0, 0], [1, 1, 1], {}));
    for (var windowIndex = 0; windowIndex < 4; windowIndex += 1) {
      parts.push(part("probe-sensor-window-" + pad2(windowIndex + 1), "cylinder",
        [0.095, 0.095, 0.06, 20], "opticalGlass",
        [0, 0.34 + windowIndex * 0.18, 0], [0, 0, 0], [1, 1, 1], {}));
    }
    for (var band = 0; band < 6; band += 1) {
      parts.push(part("probe-band-" + pad2(band + 1), "torus", [0.094, 0.008, 8, 20], "gold",
        [0, 0.26 + band * 0.16, 0], [Math.PI / 2, 0, 0], [1, 1, 1], {}));
    }

    parts.push(part("flanged-head", "cylinder", [0.42, 0.42, 0.12, 40], "stainless",
      [0, 1.42, 0], [0, 0, 0], [1, 1, 1], { texture: "plate-front" }));
    pushAll(parts, ringXZ("flange-bolt", 6, 0.33, 0, 1.5, 0,
      "cylinder", [0.035, 0.035, 0.06, 12], "stainless", {}));
    parts.push(part("flange-gasket", "torus", [0.36, 0.025, 10, 40], "rubber",
      [0, 1.35, 0], [Math.PI / 2, 0, 0], [1, 1, 1], {}));

    parts.push(part("sealed-electronics-cap", "cylinder", [0.3, 0.3, 0.3, 36], "anodized",
      [0, 1.63, 0], [0, 0, 0], [1, 1, 1], { texture: "plate-back" }));
    parts.push(part("cap-seal-ring", "torus", [0.28, 0.02, 10, 36], "stainless",
      [0, 1.79, 0], [Math.PI / 2, 0, 0], [1, 1, 1], {}));
    pushAll(parts, ringXZ("cap-vent", 4, 0.2, 0, 1.8, 0,
      "box", [0.07, 0.02, 0.1], "polymer", {}));

    parts.push(part("telemetry-antenna", "cylinder", [0.025, 0.03, 0.4, 16], "anodized",
      [0, 2.02, 0], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("antenna-tip", "sphere", [0.04, 12, 10], "gold",
      [0, 2.23, 0], [0, 0, 0], [1, 1, 1], {}));
    pushAll(parts, gridParts("signal-led", 2, 2, 0.12, 0.1, [-0.06, 1.66, 0.31],
      "sphere", [0.028, 10, 8], "ledGreen", { animator: "ledPulse" }));

    pushAll(parts, gridParts("terminal-block", 3, 2, 0.16, 0.14, [-0.16, 1.58, 0.3],
      "box", [0.1, 0.08, 0.06], "copper", {}));
    parts.push(part("cable-gland-01", "cylinder", [0.06, 0.06, 0.12, 16], "anodized",
      [-0.3, 1.4, 0], [0, 0, Math.PI / 2], [1, 1, 1], {}));
    parts.push(part("cable-gland-02", "cylinder", [0.06, 0.06, 0.12, 16], "anodized",
      [0.3, 1.4, 0], [0, 0, Math.PI / 2], [1, 1, 1], {}));
    parts.push(part("mounting-bracket-01", "box", [0.1, 0.3, 0.4], "brushed",
      [-0.4, 1.2, 0], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("mounting-bracket-02", "box", [0.1, 0.3, 0.4], "brushed",
      [0.4, 1.2, 0], [0, 0, 0], [1, 1, 1], {}));

    parts.push(part("sensor-serial-plate", "plane", [0.34, 0.16], "decal",
      [0, 1.63, 0.305], [0, 0, 0], [1, 1, 1], { texture: "telemetry-readout" }));
    parts.push(part("n2-telemetry-label", "plane", [0.42, 0.18], "decal",
      [0, 1.44, 0.43], [0, 0, 0], [1, 1, 1], { texture: "brand-n2mobil" }));

    return finalize("Fuel and telemetry immersion sensor", parts, ["ledPulse"]);
  }

  function buildGpsTracker() {
    var parts = [];

    parts.push(part("gps-body", "box", [1.3, 0.44, 0.85], "anodized",
      [0, 0.72, 0], [0, 0, 0], [1, 1, 1], { texture: "plate-side" }));
    parts.push(part("tracker-lid", "box", [1.32, 0.06, 0.87], "aluminum",
      [0, 0.97, 0], [0, 0, 0], [1, 1, 1], { texture: "plate-front" }));
    parts.push(part("tracker-base", "box", [1.34, 0.06, 0.89], "darkSteel",
      [0, 0.46, 0], [0, 0, 0], [1, 1, 1], { texture: "plate-back" }));
    pushAll(parts, ringXY("tracker-screw", 4, 0.3, 0, 0.99, 0,
      "cylinder", [0.03, 0.03, 0.03, 12], "stainless", {}));

    for (var fin = 0; fin < 12; fin += 1) {
      parts.push(part("cooling-fin-" + pad2(fin + 1), "box", [0.035, 0.1, 0.7], "aluminum",
        [-0.55 + fin * 0.1, 1.04, 0], [0, 0, 0], [1, 1, 1], {}));
    }
    for (var vent = 0; vent < 6; vent += 1) {
      parts.push(part("vent-slot-" + pad2(vent + 1), "box", [0.08, 0.02, 0.22], "polymer",
        [-0.4 + vent * 0.16, 0.49, 0], [0, 0, 0], [1, 1, 1], {}));
    }

    parts.push(part("gnss-sma-body", "cylinder", [0.07, 0.07, 0.18, 20], "stainless",
      [-0.42, 1.14, -0.24], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("gsm-sma-body", "cylinder", [0.07, 0.07, 0.18, 20], "stainless",
      [0.42, 1.14, -0.24], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("gnss-antenna-rod", "cylinder", [0.035, 0.04, 0.5, 16], "anodized",
      [-0.42, 1.46, -0.24], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("gsm-antenna-rod", "cylinder", [0.035, 0.04, 0.5, 16], "anodized",
      [0.42, 1.46, -0.24], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("gnss-gold-tip", "sphere", [0.045, 14, 12], "gold",
      [-0.42, 1.72, -0.24], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("gsm-gold-tip", "sphere", [0.045, 14, 12], "gold",
      [0.42, 1.72, -0.24], [0, 0, 0], [1, 1, 1], {}));
    for (var collar = 0; collar < 4; collar += 1) {
      parts.push(part("antenna-collar-" + pad2(collar + 1), "torus", [0.055, 0.012, 8, 20], "gold",
        [collar < 2 ? -0.42 : 0.42, 1.2 + (collar % 2) * 0.16, -0.24],
        [Math.PI / 2, 0, 0], [1, 1, 1], {}));
    }

    parts.push(part("sim-slot", "box", [0.3, 0.06, 0.12], "polymer",
      [-0.35, 0.72, 0.44], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("sim-card", "box", [0.22, 0.02, 0.09], "gold",
      [-0.35, 0.76, 0.44], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("can-bus-connector", "box", [0.36, 0.14, 0.12], "darkSteel",
      [0.38, 0.72, 0.44], [0, 0, 0], [1, 1, 1], {}));
    for (var pin = 0; pin < 4; pin += 1) {
      parts.push(part("can-pin-" + pad2(pin + 1), "cylinder", [0.012, 0.012, 0.06, 10], "gold",
        [0.26 + pin * 0.08, 0.72, 0.51], [Math.PI / 2, 0, 0], [1, 1, 1], {}));
    }
    parts.push(part("power-jack", "cylinder", [0.06, 0.06, 0.08, 16], "stainless",
      [-0.6, 0.72, 0.44], [Math.PI / 2, 0, 0], [1, 1, 1], {}));
    pushAll(parts, gridParts("status-led", 4, 1, 0.1, 0, [-0.12, 0.88, 0.44],
      "sphere", [0.026, 10, 8], "ledGreen", { animator: "ledPulse" }));
    parts.push(part("gps-fix-led", "sphere", [0.028, 10, 8], "ledBlue",
      [0.04, 0.56, 0.44], [0, 0, 0], [1, 1, 1], { animator: "ledPulse", phase: 2 }));
    parts.push(part("gsm-link-led", "sphere", [0.028, 10, 8], "ledAmber",
      [0.16, 0.56, 0.44], [0, 0, 0], [1, 1, 1], { animator: "ledPulse", phase: 4 }));

    parts.push(part("satellite-orbit", "torus", [1.05, 0.012, 8, 64], "gold",
      [0, 1.05, 0], [1.1, 0, 0], [1, 1, 1], { animator: "orbitSpin" }));
    parts.push(part("satellite", "box", [0.18, 0.14, 0.14], "stainless",
      [0, 1.75, 0], [0, 0, 0], [1, 1, 1], { animator: "orbitBob" }));
    for (var panel = 0; panel < 4; panel += 1) {
      parts.push(part("satellite-panel-" + pad2(panel + 1), "box", [0.22, 0.02, 0.12], "darkSteel",
        [panel < 2 ? -0.24 : 0.24, 1.75, panel % 2 === 0 ? -0.14 : 0.14],
        [0, 0, 0], [1, 1, 1], {}));
    }
    parts.push(part("orbit-tick-01", "sphere", [0.025, 10, 8], "ledRed",
      [0, 1.05, 1.05], [0, 0, 0], [1, 1, 1], { animator: "ledPulse", phase: 1 }));
    parts.push(part("orbit-tick-02", "sphere", [0.025, 10, 8], "ledRed",
      [0, 1.05, -1.05], [0, 0, 0], [1, 1, 1], { animator: "ledPulse", phase: 6 }));

    parts.push(part("n2mobil-top-logo", "plane", [0.62, 0.24], "decal",
      [0, 1.006, 0.1], [0, 0, 0], [1, 1, 1], { texture: "brand-n2mobil" }));
    parts.push(part("n2mobil-side-decal", "plane", [0.7, 0.28], "decal",
      [0, 0.72, 0.432], [0, 0, 0], [1, 1, 1], { texture: "brand-n2mobil" }));
    parts.push(part("imei-label", "plane", [0.3, 0.14], "decal",
      [-0.4, 0.58, 0.432], [0, 0, 0], [1, 1, 1], { texture: "plate-back" }));
    parts.push(part("gnss-label", "plane", [0.22, 0.1], "decal",
      [-0.42, 1.14, -0.15], [0, 0, 0], [1, 1, 1], { texture: "telemetry-readout" }));
    parts.push(part("gsm-label", "plane", [0.22, 0.1], "decal",
      [0.42, 1.14, -0.15], [0, 0, 0], [1, 1, 1], { texture: "telemetry-readout" }));

    return finalize("N2MOBİL dual antenna GPS tracker", parts, ["ledPulse", "orbitSpin", "orbitBob"]);
  }

  function buildErpWorkstation() {
    var parts = [];

    parts.push(part("stand-column", "cylinder", [0.07, 0.09, 0.62, 20], "brushed",
      [0, 0.62, -0.1], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("stand-base", "cylinder", [0.46, 0.5, 0.06, 36], "aluminum",
      [0, 0.32, -0.1], [0, 0, 0], [1, 1, 1], { texture: "plate-front" }));
    parts.push(part("stand-arm-left", "box", [0.5, 0.05, 0.08], "brushed",
      [-0.42, 0.94, -0.1], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("stand-arm-right", "box", [0.5, 0.05, 0.08], "brushed",
      [0.42, 0.94, -0.1], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("cable-clip-01", "torus", [0.05, 0.012, 8, 18], "rubber",
      [0, 0.7, 0.02], [Math.PI / 2, 0, 0], [1, 1, 1], {}));
    parts.push(part("cable-clip-02", "torus", [0.05, 0.012, 8, 18], "rubber",
      [0, 0.55, 0.02], [Math.PI / 2, 0, 0], [1, 1, 1], {}));

    var sides = [
      { key: "left", x: -0.85, yaw: 0.12 },
      { key: "right", x: 0.85, yaw: -0.12 }
    ];
    for (var sideIndex = 0; sideIndex < sides.length; sideIndex += 1) {
      var side = sides[sideIndex];
      for (var segment = 0; segment < 3; segment += 1) {
        var segmentX = side.x + (segment - 1) * 0.46;
        var segmentYaw = side.yaw + (segment - 1) * 0.09;
        parts.push(part("monitor-frame-" + side.key + "-" + pad2(segment + 1), "box",
          [0.48, 1.02, 0.05], "polymer",
          [segmentX, 1.56, 0.04], [0, segmentYaw, 0], [1, 1, 1], {}));
        parts.push(part("erp-dashboard-" + side.key + "-" + pad2(segment + 1), "plane",
          [0.44, 0.92], "screen",
          [segmentX, 1.56, 0.075], [0, segmentYaw, 0], [1, 1, 1],
          { texture: "erp-dashboard", animator: "screenGlow" }));
      }
      parts.push(part("monitor-neck-" + side.key, "cylinder", [0.06, 0.08, 0.3, 16], "brushed",
        [side.x, 0.98, -0.04], [0, 0, 0], [1, 1, 1], {}));
      parts.push(part("monitor-hinge-" + side.key, "sphere", [0.09, 16, 12], "aluminum",
        [side.x, 1.0, 0.02], [0, 0, 0], [1, 1, 1], {}));
    }

    parts.push(part("desk-surface", "box", [2.6, 0.08, 1.0], "aluminum",
      [0, 0.28, 0.42], [0, 0, 0], [1, 1, 1], { texture: "plate-front" }));
    parts.push(part("desk-leg-01", "box", [0.08, 0.5, 0.08], "darkSteel",
      [-1.18, 0.02, 0.42], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("desk-leg-02", "box", [0.08, 0.5, 0.08], "darkSteel",
      [1.18, 0.02, 0.42], [0, 0, 0], [1, 1, 1], {}));

    parts.push(part("keyboard-base", "box", [1.05, 0.04, 0.36], "anodized",
      [-0.1, 0.35, 0.62], [0, 0, 0], [1, 1, 1], {}));
    pushAll(parts, gridParts("keycap", 8, 3, 0.115, 0.1, [-0.48, 0.39, 0.53],
      "box", [0.09, 0.025, 0.08], "polymer", {}));
    parts.push(part("mouse", "sphere", [0.09, 18, 14], "polymer",
      [0.58, 0.37, 0.62], [0, 0, 0], [1, 0.5, 1.4], {}));
    parts.push(part("mouse-wheel", "cylinder", [0.018, 0.018, 0.05, 12], "brushed",
      [0.58, 0.42, 0.58], [0, 0, 0], [1, 1, 1], {}));

    parts.push(part("workstation-tower", "box", [0.42, 0.9, 0.7], "darkSteel",
      [1.5, 0.72, 0.2], [0, 0, 0], [1, 1, 1], { texture: "plate-side" }));
    parts.push(part("tower-front", "box", [0.4, 0.86, 0.04], "anodized",
      [1.5, 0.72, 0.57], [0, 0, 0], [1, 1, 1], { texture: "plate-front" }));
    for (var ventIndex = 0; ventIndex < 6; ventIndex += 1) {
      parts.push(part("tower-vent-" + pad2(ventIndex + 1), "box", [0.26, 0.025, 0.02], "polymer",
        [1.5, 1.02 - ventIndex * 0.06, 0.6], [0, 0, 0], [1, 1, 1], {}));
    }
    pushAll(parts, gridParts("tower-led", 3, 1, 0.08, 0, [1.39, 0.42, 0.6],
      "sphere", [0.022, 10, 8], "ledGreen", { animator: "ledPulse" }));
    parts.push(part("tower-drive-01", "box", [0.3, 0.06, 0.02], "stainless",
      [1.5, 0.66, 0.6], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("tower-drive-02", "box", [0.3, 0.06, 0.02], "stainless",
      [1.5, 0.56, 0.6], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("left-monitor-glass", "plane", [1.42, 0.94], "rackGlass",
      [-0.85, 1.56, 0.09], [0, 0.12, 0], [1, 1, 1], {}));
    parts.push(part("right-monitor-glass", "plane", [1.42, 0.94], "rackGlass",
      [0.85, 1.56, 0.09], [0, -0.12, 0], [1, 1, 1], {}));
    parts.push(part("lavox-workstation-decal", "plane", [0.42, 0.18], "decal",
      [1.5, 0.8, 0.62], [0, 0, 0], [1, 1, 1], { texture: "brand-lavox" }));

    return finalize("Dual screen ERP workstation", parts, ["ledPulse", "screenGlow"]);
  }

  function buildFireAlarmSystem() {
    var parts = [];

    parts.push(part("panel-cabinet", "box", [1.15, 1.45, 0.42], "redEnamel",
      [-0.62, 0.86, 0], [0, 0, 0], [1, 1, 1], { texture: "plate-side" }));
    parts.push(part("panel-door", "box", [1.05, 1.3, 0.04], "rackGlass",
      [-0.62, 0.88, 0.24], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("door-edge-top", "box", [1.12, 0.05, 0.06], "stainless",
      [-0.62, 1.54, 0.26], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("door-edge-bottom", "box", [1.12, 0.05, 0.06], "stainless",
      [-0.62, 0.2, 0.26], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("door-edge-left", "box", [0.05, 1.36, 0.06], "stainless",
      [-1.18, 0.88, 0.26], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("door-edge-right", "box", [0.05, 1.36, 0.06], "stainless",
      [-0.06, 0.88, 0.26], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("panel-lcd", "plane", [0.62, 0.32], "screen",
      [-0.92, 1.3, 0.28], [0, 0, 0], [1, 1, 1],
      { texture: "lcd-zone", animator: "screenGlow" }));
    parts.push(part("panel-speaker", "cylinder", [0.11, 0.11, 0.03, 20], "polymer",
      [-0.3, 1.3, 0.28], [Math.PI / 2, 0, 0], [1, 1, 1], {}));
    parts.push(part("panel-key-slot", "box", [0.04, 0.1, 0.02], "stainless",
      [-0.12, 0.92, 0.28], [0, 0, 0], [1, 1, 1], {}));

    pushAll(parts, gridParts("zone-led-matrix", 4, 4, 0.13, 0.13, [-1.11, 1.0, 0.28],
      "sphere", [0.028, 10, 8], "ledRed", { animator: "ledPulse" }));
    pushAll(parts, gridParts("control-keypad", 4, 3, 0.15, 0.14, [-1.1, 0.78, 0.29],
      "box", [0.11, 0.08, 0.04], "polymer", {}));
    pushAll(parts, gridParts("panel-button", 2, 2, 0.18, 0.14, [-0.98, 0.38, 0.29],
      "cylinder", [0.05, 0.05, 0.04, 16], "stainless", {}));
    pushAll(parts, gridParts("panel-led", 4, 1, 0.16, 0, [-1.08, 0.26, 0.29],
      "sphere", [0.026, 10, 8], "ledGreen", { animator: "ledPulse" }));

    parts.push(part("detector-base", "cylinder", [0.34, 0.34, 0.1, 36], "powderWhite",
      [0.95, 1.95, 0], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("optical-smoke-chamber", "cylinder", [0.3, 0.3, 0.16, 36], "smokedAcrylic",
      [0.95, 1.82, 0], [0, 0, 0], [1, 1, 1], {}));
    for (var labyrinth = 0; labyrinth < 8; labyrinth += 1) {
      var labyrinthAngle = labyrinth * Math.PI / 4;
      parts.push(part("smoke-labyrinth-" + pad2(labyrinth + 1), "box", [0.16, 0.04, 0.04], "polymer",
        [0.95 + Math.cos(labyrinthAngle) * 0.16, 1.84, Math.sin(labyrinthAngle) * 0.16],
        [0, -labyrinthAngle, 0], [1, 1, 1], {}));
    }
    for (var grille = 0; grille < 8; grille += 1) {
      parts.push(part("detector-grille-" + pad2(grille + 1), "box", [0.3, 0.02, 0.03], "powderWhite",
        [0.95, 1.73, -0.12 + grille * 0.035], [0, 0, 0], [1, 1, 1], {}));
    }
    parts.push(part("detector-red-alarm-led", "sphere", [0.04, 12, 10], "ledRed",
      [0.95, 1.7, 0.26], [0, 0, 0], [1, 1, 1], { animator: "alarmBlink" }));
    parts.push(part("detector-photodiode", "sphere", [0.03, 10, 8], "opticalGlass",
      [0.85, 1.84, 0], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("detector-ir-emitter", "sphere", [0.03, 10, 8], "ledRed",
      [1.05, 1.84, 0], [0, 0, 0], [1, 1, 1], { animator: "ledPulse", phase: 7 }));

    parts.push(part("alarm-bell", "sphere", [0.26, 28, 18], "gold",
      [1.55, 1.28, 0], [0, 0, 0], [1, 0.45, 1], {}));
    parts.push(part("bell-rim", "torus", [0.26, 0.025, 10, 36], "brushed",
      [1.55, 1.24, 0], [Math.PI / 2, 0, 0], [1, 1, 1], {}));
    parts.push(part("bell-striker", "sphere", [0.05, 12, 10], "stainless",
      [1.55, 1.02, 0], [0, 0, 0], [1, 1, 1], { animator: "bellStrike" }));
    parts.push(part("bell-bracket", "box", [0.16, 0.2, 0.1], "darkSteel",
      [1.55, 1.48, -0.18], [0, 0, 0], [1, 1, 1], {}));

    parts.push(part("call-point-body", "box", [0.34, 0.46, 0.12], "redEnamel",
      [1.55, 0.62, 0.34], [0, 0, 0], [1, 1, 1], { texture: "warning-hv" }));
    parts.push(part("call-point-glass", "plane", [0.24, 0.24], "rackGlass",
      [1.55, 0.68, 0.41], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("call-point-button", "cylinder", [0.07, 0.07, 0.04, 18], "powderWhite",
      [1.55, 0.52, 0.43], [Math.PI / 2, 0, 0], [1, 1, 1], {}));

    parts.push(part("conduit-01", "cylinder", [0.035, 0.035, 0.7, 12], "darkSteel",
      [-0.06, 1.95, -0.2], [0, 0, Math.PI / 2], [1, 1, 1], {}));
    parts.push(part("conduit-02", "cylinder", [0.035, 0.035, 0.6, 12], "darkSteel",
      [1.25, 1.95, -0.2], [0, 0, Math.PI / 2], [1, 1, 1], {}));
    parts.push(part("cable-gland-01", "cylinder", [0.06, 0.06, 0.12, 14], "anodized",
      [-0.06, 1.95, -0.05], [Math.PI / 2, 0, 0], [1, 1, 1], {}));
    parts.push(part("cable-gland-02", "cylinder", [0.06, 0.06, 0.12, 14], "anodized",
      [1.25, 1.95, -0.05], [Math.PI / 2, 0, 0], [1, 1, 1], {}));

    parts.push(part("lavox-panel-brand", "plane", [0.44, 0.18], "decal",
      [-0.62, 1.47, 0.28], [0, 0, 0], [1, 1, 1], { texture: "brand-lavox" }));
    parts.push(part("panel-zone-label", "plane", [0.36, 0.16], "decal",
      [-0.32, 1.3, 0.29], [0, 0, 0], [1, 1, 1], { texture: "lcd-zone" }));
    parts.push(part("detector-test-label", "plane", [0.22, 0.1], "decal",
      [0.95, 1.78, 0.31], [0, 0, 0], [1, 1, 1], { texture: "plate-back" }));
    parts.push(part("call-point-label", "plane", [0.26, 0.12], "decal",
      [1.55, 0.42, 0.41], [0, 0, 0], [1, 1, 1], { texture: "warning-hv" }));

    return finalize("LAVOX addressable fire alarm system", parts, ["ledPulse", "alarmBlink", "bellStrike", "screenGlow"]);
  }

  function buildElectricalCabinet() {
    var parts = [];

    parts.push(part("cabinet-body", "box", [1.9, 2.25, 0.85], "darkSteel",
      [0, 1.2, 0], [0, 0, 0], [1, 1, 1], { texture: "plate-back" }));
    parts.push(part("glass-window", "plane", [1.35, 1.72], "rackGlass",
      [0, 1.25, 0.45], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("door-frame-01", "box", [1.75, 0.07, 0.06], "stainless",
      [0, 2.29, 0.46], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("door-frame-02", "box", [1.75, 0.07, 0.06], "stainless",
      [0, 0.12, 0.46], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("door-frame-03", "box", [0.07, 2.2, 0.06], "stainless",
      [-0.9, 1.2, 0.46], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("door-frame-04", "box", [0.07, 2.2, 0.06], "stainless",
      [0.9, 1.2, 0.46], [0, 0, 0], [1, 1, 1], {}));
    for (var hinge = 0; hinge < 3; hinge += 1) {
      parts.push(part("door-hinge-" + pad2(hinge + 1), "cylinder", [0.04, 0.04, 0.16, 12], "stainless",
        [-0.97, 0.55 + hinge * 0.65, 0.44], [0, 0, 0], [1, 1, 1], {}));
    }
    parts.push(part("door-lock", "cylinder", [0.06, 0.06, 0.06, 16], "brushed",
      [0.82, 1.2, 0.5], [Math.PI / 2, 0, 0], [1, 1, 1], {}));

    parts.push(part("mounting-backplate", "box", [1.6, 1.95, 0.05], "brushed",
      [0, 1.2, -0.32], [0, 0, 0], [1, 1, 1], { texture: "plate-front" }));
    for (var rail = 0; rail < 3; rail += 1) {
      parts.push(part("din-rail-" + pad2(rail + 1), "box", [1.5, 0.05, 0.08], "stainless",
        [0, 0.62 + rail * 0.44, -0.24], [0, 0, 0], [1, 1, 1], {}));
    }

    parts.push(part("main-breaker-L1", "box", [0.3, 0.38, 0.2], "anodized",
      [-0.52, 1.78, -0.12], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("main-breaker-L2", "box", [0.3, 0.38, 0.2], "anodized",
      [-0.12, 1.78, -0.12], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("main-breaker-L3", "box", [0.3, 0.38, 0.2], "anodized",
      [0.28, 1.78, -0.12], [0, 0, 0], [1, 1, 1], {}));
    for (var contactor = 0; contactor < 4; contactor += 1) {
      parts.push(part("contactor-" + pad2(contactor + 1), "box", [0.26, 0.3, 0.18], "darkSteel",
        [-0.56 + contactor * 0.36, 1.3, -0.12], [0, 0, 0], [1, 1, 1], {}));
      parts.push(part("contactor-coil-" + pad2(contactor + 1), "cylinder", [0.06, 0.06, 0.06, 14], "copper",
        [-0.56 + contactor * 0.36, 1.3, 0.0], [Math.PI / 2, 0, 0], [1, 1, 1], {}));
    }
    parts.push(part("reactive-power-relay", "box", [0.42, 0.26, 0.16], "anodized",
      [0.56, 1.3, -0.1], [0, 0, 0], [1, 1, 1], { texture: "meter-volts" }));
    pushAll(parts, gridParts("relay-led", 4, 1, 0.1, 0, [0.42, 1.46, 0.0],
      "sphere", [0.024, 10, 8], "ledAmber", { animator: "ledPulse" }));

    for (var bank = 0; bank < 6; bank += 1) {
      var bankX = -0.58 + bank * 0.23;
      parts.push(part("capacitor-bank-" + pad2(bank + 1), "cylinder", [0.09, 0.09, 0.34, 22], "aluminum",
        [bankX, 0.82, -0.1], [0, 0, 0], [1, 1, 1], { texture: "plate-side" }));
      parts.push(part("capacitor-terminal-" + pad2(bank + 1), "cylinder", [0.03, 0.03, 0.05, 12], "copper",
        [bankX, 1.0, -0.1], [0, 0, 0], [1, 1, 1], {}));
    }

    var phases = ["L1", "L2", "L3", "N", "PE"];
    for (var phase = 0; phase < phases.length; phase += 1) {
      parts.push(part("busbar-" + phases[phase], "box", [0.1, 0.04, 0.5], "copper",
        [-0.52 + phase * 0.26, 2.08, -0.12], [0, 0, 0], [1, 1, 1], {}));
    }
    for (var support = 0; support < 4; support += 1) {
      parts.push(part("busbar-support-" + pad2(support + 1), "box", [0.08, 0.1, 0.12], "polymer",
        [-0.62 + support * 0.42, 2.0, -0.12], [0, 0, 0], [1, 1, 1], {}));
    }

    pushAll(parts, gridParts("terminal-block", 4, 2, 0.16, 0.14, [-0.3, 0.42, -0.12],
      "box", [0.12, 0.08, 0.08], "copper", {}));
    parts.push(part("volt-meter", "box", [0.4, 0.28, 0.08], "anodized",
      [-0.42, 1.86, 0.02], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("ampere-meter", "box", [0.4, 0.28, 0.08], "anodized",
      [0.12, 1.86, 0.02], [0, 0, 0], [1, 1, 1], {}));
    parts.push(part("volt-meter-screen", "plane", [0.32, 0.2], "screen",
      [-0.42, 1.86, 0.07], [0, 0, 0], [1, 1, 1],
      { texture: "meter-volts", animator: "screenGlow" }));
    parts.push(part("ampere-meter-screen", "plane", [0.32, 0.2], "screen",
      [0.12, 1.86, 0.07], [0, 0, 0], [1, 1, 1],
      { texture: "meter-amps", animator: "screenGlow" }));
    pushAll(parts, gridParts("meter-led", 3, 1, 0.1, 0, [-0.46, 1.62, 0.04],
      "sphere", [0.022, 10, 8], "ledGreen", { animator: "ledPulse" }));

    for (var ventIndex = 0; ventIndex < 6; ventIndex += 1) {
      parts.push(part("cabinet-vent-" + pad2(ventIndex + 1), "box", [0.1, 0.04, 0.02], "polymer",
        [0.62, 2.0 - ventIndex * 0.08, 0.47], [0, 0, 0], [1, 1, 1], {}));
    }

    parts.push(part("warning-plate", "plane", [0.34, 0.18], "decal",
      [-0.5, 0.5, 0.47], [0, 0, 0], [1, 1, 1], { texture: "warning-hv" }));
    parts.push(part("phase-label", "plane", [0.38, 0.16], "decal",
      [0.42, 2.05, 0.47], [0, 0, 0], [1, 1, 1], { texture: "plate-front" }));
    parts.push(part("lavox-cabinet-label", "plane", [0.42, 0.18], "decal",
      [0.5, 0.5, 0.47], [0, 0, 0], [1, 1, 1], { texture: "brand-lavox" }));

    return finalize("LAVOX industrial compensation cabinet", parts, ["ledPulse", "screenGlow"]);
  }

  var MODELS = Object.freeze({
    "1": buildBulletCamera(),
    "2": buildDomeCamera(),
    "3": buildRackServer(),
    "4": buildFuelTelemetrySensor(),
    "5": buildGpsTracker(),
    "6": buildErpWorkstation(),
    "7": buildFireAlarmSystem(),
    "8": buildElectricalCabinet()
  });

  var EXPECTED_COUNTS = Object.freeze({
    "1": MODELS["1"].count,
    "2": MODELS["2"].count,
    "3": MODELS["3"].count,
    "4": MODELS["4"].count,
    "5": MODELS["5"].count,
    "6": MODELS["6"].count,
    "7": MODELS["7"].count,
    "8": MODELS["8"].count
  });

  function isCatalogId(value) {
    return typeof value === "string" && MODEL_IDS.indexOf(value) !== -1;
  }

  function validateModels(registry) {
    if (!registry || typeof registry !== "object") {
      return false;
    }
    var keys = Object.keys(registry);
    if (keys.length !== MODEL_IDS.length) {
      return false;
    }
    for (var modelIndex = 0; modelIndex < MODEL_IDS.length; modelIndex += 1) {
      var id = MODEL_IDS[modelIndex];
      var entry = registry[id];
      if (!entry || typeof entry !== "object" || typeof entry.label !== "string" || !entry.label.length) {
        return false;
      }
      if (!Array.isArray(entry.parts) || entry.count !== entry.parts.length) {
        return false;
      }
      if (entry.count < MESH_BUDGET.min || entry.count > MESH_BUDGET.max) {
        return false;
      }
      var seen = Object.create(null);
      for (var partIndex = 0; partIndex < entry.parts.length; partIndex += 1) {
        var descriptor = entry.parts[partIndex];
        if (!descriptor || typeof descriptor.name !== "string" || !descriptor.name.length) {
          return false;
        }
        if (seen[descriptor.name]) {
          return false;
        }
        seen[descriptor.name] = true;
        if (!PRIMITIVE_CTORS[descriptor.primitive] || !SURFACES[descriptor.material]) {
          return false;
        }
        if (!Array.isArray(descriptor.args) || !Array.isArray(descriptor.position) ||
          !Array.isArray(descriptor.rotation) || !Array.isArray(descriptor.scale)) {
          return false;
        }
        for (var argIndex = 0; argIndex < descriptor.args.length; argIndex += 1) {
          if (!finiteNumber(descriptor.args[argIndex]) || descriptor.args[argIndex] <= 0) {
            return false;
          }
        }
        for (var vectorIndex = 0; vectorIndex < 3; vectorIndex += 1) {
          if (!finiteNumber(descriptor.position[vectorIndex]) || !finiteNumber(descriptor.rotation[vectorIndex]) ||
            !finiteNumber(descriptor.scale[vectorIndex]) || descriptor.scale[vectorIndex] <= 0) {
            return false;
          }
        }
      }
    }
    return true;
  }

  function createCanvas2D(docRef, width, height) {
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
      if (!context || typeof context.fillRect !== "function") {
        return null;
      }
      return { canvas: canvas, context: context };
    } catch (_error) {
      return null;
    }
  }

  function fillRect(context, color, x, y, width, height) {
    if (context && typeof context.fillRect === "function") {
      context.fillStyle = color;
      context.fillRect(x, y, width, height);
    }
  }

  function strokeRect(context, color, lineWidth, x, y, width, height) {
    if (context && typeof context.strokeRect === "function") {
      context.strokeStyle = color;
      if (typeof context.lineWidth === "number") {
        context.lineWidth = lineWidth;
      }
      context.strokeRect(x, y, width, height);
    }
  }

  function drawText(context, value, color, font, x, y, align) {
    if (context && typeof context.fillText === "function") {
      context.fillStyle = color;
      if (font && typeof context.font === "string") {
        context.font = font;
      }
      context.textAlign = align || "left";
      context.fillText(String(value), x, y);
    }
  }

  function drawLine(context, color, lineWidth, x1, y1, x2, y2) {
    if (!context || typeof context.beginPath !== "function" || typeof context.moveTo !== "function" ||
      typeof context.lineTo !== "function" || typeof context.stroke !== "function") {
      return;
    }
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.strokeStyle = color;
    if (typeof context.lineWidth === "number") {
      context.lineWidth = lineWidth;
    }
    context.stroke();
  }

  function drawCircle(context, color, x, y, radius) {
    if (!context || typeof context.beginPath !== "function" || typeof context.arc !== "function" ||
      typeof context.fill !== "function") {
      return;
    }
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
  }

  function seedFor(name) {
    var seed = 2166136261;
    for (var index = 0; index < name.length; index += 1) {
      seed = (seed ^ name.charCodeAt(index)) * 16777619;
    }
    return seed >>> 0;
  }

  function nextRandom(state) {
    state.value = (Math.imul(state.value, 1664525) + 1013904223) >>> 0;
    return state.value / 4294967296;
  }

  function brandForTexture(name, id) {
    if (name.indexOf("hikvision") !== -1) {
      return BRAND.hikvision;
    }
    if (name.indexOf("n2mobil") !== -1) {
      return BRAND.n2mobil;
    }
    if (name.indexOf("lavox") !== -1) {
      return BRAND.lavox;
    }
    return BRAND[BRAND_BY_ID[id] || "lavox"];
  }

  function paintPlate(context, spec, name, id) {
    var width = spec.width;
    var height = spec.height;
    fillRect(context, "#101318", 0, 0, width, height);
    fillRect(context, "#1a2029", 16, 16, width - 32, height - 32);
    strokeRect(context, "#d4af37", 4, 10, 10, width - 20, height - 20);

    var random = { value: seedFor(name + id) };
    var streakCount = Math.floor(width / 18);
    for (var streak = 0; streak < streakCount; streak += 1) {
      var shade = 26 + Math.floor(nextRandom(random) * 26);
      fillRect(context, "rgb(" + shade + "," + (shade + 4) + "," + (shade + 10) + ")",
        24, 24 + streak * Math.max(3, Math.floor((height - 48) / streakCount)), width - 48, 2);
    }

    var brand = brandForTexture(name, id);
    fillRect(context, brand.color, 24, 24, Math.floor(width * 0.2), 34);
    drawText(context, brand.name, brand.secondary, "700 24px Arial, sans-serif", 38, 49, "left");
    drawText(context, PRODUCT_LABEL[id] || "NAZTECH HARDWARE", "#e8edf3", "700 30px Arial, sans-serif",
      24, height - 76, "left");
    drawText(context, "BAYSÖZ YAZILIM  |  PROJECT " + id + "00  |  INDUSTRIAL GRADE",
      "#8fa0b4", "600 18px monospace", 24, height - 42, "left");
    drawText(context, "NAZTECH CERTIFIED", brand.color, "700 20px Arial, sans-serif",
      width - 24, 50, "right");

    for (var notch = 0; notch < 8; notch += 1) {
      fillRect(context, "#0b0d11", width - 190 + notch * 20, height - 40, 10, 18);
    }
  }

  function paintBrand(context, spec, name, id) {
    var brand = brandForTexture(name, id);
    var width = spec.width;
    var height = spec.height;
    fillRect(context, "#ffffff", 0, 0, width, height);
    fillRect(context, brand.color, 0, 0, 22, height);
    fillRect(context, brand.color, 0, height - 14, width, 14);
    drawText(context, brand.name, brand.color, "900 82px Arial, sans-serif", width / 2, height * 0.55, "center");
    drawText(context, brand.tagline, "#26313f", "600 26px Arial, sans-serif", width / 2, height * 0.76, "center");
    drawCircle(context, brand.color, 60, height * 0.28, 16);
    drawCircle(context, "#ffffff", 60, height * 0.28, 7);
  }

  function paintDashboard(context, spec) {
    var width = spec.width;
    var height = spec.height;
    fillRect(context, "#08111d", 0, 0, width, height);
    fillRect(context, "#0f2034", 0, 0, 190, height);
    fillRect(context, "#19a7b8", 0, 0, 190, 12);
    drawText(context, "ERP", "#ffffff", "900 38px Arial, sans-serif", 28, 76, "left");
    drawText(context, "OPERATIONS", "#9fdbe4", "600 18px Arial, sans-serif", 28, 106, "left");
    var menu = ["DASHBOARD", "STOCK", "ORDERS", "FLEET", "FINANCE", "REPORTS"];
    for (var row = 0; row < menu.length; row += 1) {
      fillRect(context, row === 0 ? "#19a7b8" : "#132a42", 16, 140 + row * 58, 158, 42);
      drawText(context, menu[row], row === 0 ? "#041019" : "#c7d8e8",
        "700 17px Arial, sans-serif", 30, 168 + row * 58, "left");
    }
    drawText(context, "LIVE ENTERPRISE METRICS", "#e8f5f8", "800 30px Arial, sans-serif", 222, 62, "left");
    var cards = [
      { label: "REVENUE", value: "₺ 4.82M", color: "#37f59a" },
      { label: "OPEN ORDERS", value: "1.284", color: "#4da3ff" },
      { label: "FLEET ONLINE", value: "96.4%", color: "#ffb43d" }
    ];
    for (var card = 0; card < cards.length; card += 1) {
      var cardX = 222 + card * 258;
      fillRect(context, "#132a42", cardX, 92, 236, 112);
      strokeRect(context, cards[card].color, 3, cardX, 92, 236, 112);
      drawText(context, cards[card].label, "#9fb4c9", "600 17px Arial, sans-serif", cardX + 16, 126, "left");
      drawText(context, cards[card].value, cards[card].color, "800 34px Arial, sans-serif", cardX + 16, 174, "left");
    }
    fillRect(context, "#0d1c2d", 222, 226, 752, 246);
    strokeRect(context, "#1d3b59", 2, 222, 226, 752, 246);
    var points = [[254, 416], [350, 372], [446, 392], [542, 314], [638, 342], [734, 268], [862, 300], [944, 252]];
    for (var point = 0; point < points.length - 1; point += 1) {
      drawLine(context, "#4da3ff", 4, points[point][0], points[point][1],
        points[point + 1][0], points[point + 1][1]);
      drawCircle(context, "#37f59a", points[point][0], points[point][1], 5);
    }
    for (var rule = 0; rule < 5; rule += 1) {
      drawLine(context, "#173047", 1, 238, 258 + rule * 46, 958, 258 + rule * 46);
    }
    drawText(context, "SERVICE REGION: MARMARA  |  SYNC: ONLINE  |  SECURITY: PASS",
      "#7fb3c6", "600 16px monospace", 240, 458, "left");
  }

  function paintZoneLcd(context, spec) {
    var width = spec.width;
    var height = spec.height;
    fillRect(context, "#071a12", 0, 0, width, height);
    strokeRect(context, "#37f59a", 4, 10, 10, width - 20, height - 20);
    drawText(context, "ZONE STATUS", "#37f59a", "800 38px monospace", 30, 64, "left");
    drawText(context, "ADDRESSABLE LOOP 01", "#b7ffdc", "600 22px monospace", 30, 100, "left");
    for (var row = 0; row < 5; row += 1) {
      var y = 132 + row * 44;
      fillRect(context, row === 2 ? "#3b1220" : "#0c2a1d", 28, y - 26, width - 56, 34);
      drawText(context, "Z" + pad2(row + 1) + "  " + (row === 2 ? "ALARM" : "NORMAL"),
        row === 2 ? "#ff5b70" : "#7dffc0", "700 24px monospace", 44, y - 2, "left");
    }
    drawText(context, "LAVOX FIRE PROTOCOL", "#37f59a", "600 18px monospace", width - 30, height - 24, "right");
  }

  function paintMeter(context, spec, name) {
    var width = spec.width;
    var height = spec.height;
    var isVolts = name.indexOf("volts") !== -1;
    fillRect(context, "#080b10", 0, 0, width, height);
    strokeRect(context, "#d4af37", 4, 8, 8, width - 16, height - 16);
    drawText(context, isVolts ? "VOLTAGE" : "CURRENT", "#d4af37", "700 30px Arial, sans-serif",
      width / 2, 56, "center");
    drawCircle(context, "#101722", width / 2, height * 0.58, Math.min(width, height) * 0.34);
    drawCircle(context, "#05070a", width / 2, height * 0.58, Math.min(width, height) * 0.28);
    for (var tick = 0; tick <= 10; tick += 1) {
      var angle = Math.PI * (0.82 + tick * 0.036);
      var radius = Math.min(width, height) * 0.27;
      var inner = radius - (tick % 5 === 0 ? 22 : 12);
      var cx = width / 2;
      var cy = height * 0.58;
      drawLine(context, "#e8edf3", tick % 5 === 0 ? 4 : 2,
        cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner,
        cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    drawLine(context, "#ff3b4e", 5, width / 2, height * 0.58, width * 0.68, height * 0.36);
    drawText(context, isVolts ? "400 V" : "32 A", "#37f59a", "800 44px monospace",
      width / 2, height - 34, "center");
  }

  function paintWarning(context, spec) {
    var width = spec.width;
    var height = spec.height;
    fillRect(context, "#f5c518", 0, 0, width, height);
    for (var stripe = -height; stripe < width; stripe += 84) {
      drawLine(context, "#0b0d11", 26, stripe, height, stripe + height, 0);
    }
    fillRect(context, "#0b0d11", 70, 66, width - 140, height - 132);
    drawText(context, "HIGH VOLTAGE", "#f5c518", "900 52px Arial, sans-serif", width / 2, height * 0.5, "center");
    drawText(context, "AUTHORISED PERSONNEL ONLY", "#ffffff", "600 20px Arial, sans-serif",
      width / 2, height * 0.68, "center");
  }

  function paintTelemetry(context, spec) {
    var width = spec.width;
    var height = spec.height;
    fillRect(context, "#071019", 0, 0, width, height);
    strokeRect(context, "#e93b77", 4, 8, 8, width - 16, height - 16);
    drawText(context, "N2MOBİL TELEMETRY", "#ffffff", "800 30px Arial, sans-serif", 28, 58, "left");
    drawText(context, "FUEL LEVEL", "#8fa8bf", "600 20px Arial, sans-serif", 28, 108, "left");
    drawText(context, "78.4%", "#37f59a", "800 46px monospace", 28, 158, "left");
    drawText(context, "GPS FIX", "#8fa8bf", "600 20px Arial, sans-serif", 28, 216, "left");
    drawText(context, "12 SAT / RTK", "#4da3ff", "800 32px monospace", 28, 258, "left");
    fillRect(context, "#e93b77", width - 170, 34, 142, 40);
    drawText(context, "ONLINE", "#ffffff", "700 20px Arial, sans-serif", width - 99, 61, "center");
    for (var bar = 0; bar < 12; bar += 1) {
      var barHeight = 18 + (bar % 4) * 14;
      fillRect(context, bar % 3 === 0 ? "#e93b77" : "#19a7b8",
        28 + bar * 44, height - 36 - barHeight, 28, barHeight);
    }
  }

  function paintBackdrop(context, spec) {
    var width = spec.width;
    var height = spec.height;
    fillRect(context, "#05070b", 0, 0, width, height);
    fillRect(context, "#0d1420", 0, height * 0.22, width, height * 0.6);
    for (var grid = 0; grid < 16; grid += 1) {
      drawLine(context, grid % 4 === 0 ? "#29415c" : "#152334", 2,
        grid * (width / 15), height * 0.16, grid * (width / 15), height * 0.86);
    }
    for (var rule = 0; rule < 6; rule += 1) {
      drawLine(context, "#1d3148", 2, 0, height * (0.22 + rule * 0.12), width, height * (0.22 + rule * 0.12));
    }
    var brands = [BRAND.hikvision, BRAND.n2mobil, BRAND.lavox];
    for (var index = 0; index < brands.length; index += 1) {
      var x = 42 + index * (width / 3);
      fillRect(context, "#ffffff", x, height * 0.3, width / 3 - 84, height * 0.4);
      fillRect(context, brands[index].color, x, height * 0.3, width / 3 - 84, 16);
      drawText(context, brands[index].name, brands[index].color, "900 46px Arial, sans-serif",
        x + (width / 3 - 84) / 2, height * 0.48, "center");
      drawText(context, brands[index].tagline, "#2b3644", "600 18px Arial, sans-serif",
        x + (width / 3 - 84) / 2, height * 0.6, "center");
    }
    drawText(context, "BAYSÖZ YAZILIM  |  NAZTECH BİLİŞİM  |  STUDIO GRADE HARDWARE VISUALISATION",
      "#d4af37", "600 18px Arial, sans-serif", width / 2, height - 22, "center");
  }

  function paintTexture(context, spec, name, id) {
    switch (spec.recipe) {
      case "plate":
        paintPlate(context, spec, name, id);
        break;
      case "brand":
        paintBrand(context, spec, name, id);
        break;
      case "dashboard":
        paintDashboard(context, spec);
        break;
      case "zone":
        paintZoneLcd(context, spec);
        break;
      case "meter-volts":
      case "meter-amps":
        paintMeter(context, spec, name);
        break;
      case "warning":
        paintWarning(context, spec);
        break;
      case "telemetry":
        paintTelemetry(context, spec);
        break;
      case "backdrop":
        paintBackdrop(context, spec);
        break;
      default:
        return false;
    }
    return true;
  }

  function createBumpTexture(THREE, docRef, name, spec, renderer) {
    if (!spec.bump || typeof THREE.CanvasTexture !== "function") {
      return null;
    }
    var width = Math.max(64, Math.floor(spec.width / 2));
    var height = Math.max(64, Math.floor(spec.height / 2));
    var surface = createCanvas2D(docRef, width, height);
    if (!surface) {
      return null;
    }
    var random = { value: seedFor("bump-" + name) };
    fillRect(surface.context, "#808080", 0, 0, width, height);
    for (var line = 0; line < height; line += 3) {
      var shade = 96 + Math.floor(nextRandom(random) * 70);
      fillRect(surface.context, "rgb(" + shade + "," + shade + "," + shade + ")", 0, line, width, 1);
    }
    for (var scratch = 0; scratch < 28; scratch += 1) {
      var y = Math.floor(nextRandom(random) * height);
      drawLine(surface.context, "#a8a8a8", 1, 0, y, width, y);
    }
    try {
      var texture = new THREE.CanvasTexture(surface.canvas);
      configureTexture(texture, renderer, false);
      return texture;
    } catch (_error) {
      return null;
    }
  }

  function configureTexture(texture, renderer, srgb) {
    if (!texture) {
      return;
    }
    if (srgb && THREE_SRGB_COLOR_SPACE !== null) {
      texture.colorSpace = THREE_SRGB_COLOR_SPACE;
    }
    if (THREE_LINEAR_MIPMAP !== null) {
      texture.minFilter = THREE_LINEAR_MIPMAP;
    }
    if (THREE_LINEAR_FILTER !== null) {
      texture.magFilter = THREE_LINEAR_FILTER;
    }
    texture.generateMipmaps = true;
    var anisotropy = 1;
    if (renderer && renderer.capabilities && typeof renderer.capabilities.getMaxAnisotropy === "function") {
      anisotropy = numberOr(renderer.capabilities.getMaxAnisotropy(), 1);
    }
    texture.anisotropy = Math.max(1, Math.min(MAX_ANISOTROPY, anisotropy));
    if (typeof THREE_REPEAT_WRAP !== "undefined") {
      texture.wrapS = THREE_REPEAT_WRAP;
      texture.wrapT = THREE_REPEAT_WRAP;
    }
    texture.needsUpdate = true;
  }

  var THREE_SRGB_COLOR_SPACE = null;
  var THREE_LINEAR_MIPMAP = null;
  var THREE_LINEAR_FILTER = null;
  var THREE_REPEAT_WRAP = null;

  function readThreeConstants(THREE) {
    THREE_SRGB_COLOR_SPACE = typeof THREE.SRGBColorSpace !== "undefined" ? THREE.SRGBColorSpace : null;
    THREE_LINEAR_MIPMAP = typeof THREE.LinearMipmapLinearFilter !== "undefined" ? THREE.LinearMipmapLinearFilter : null;
    THREE_LINEAR_FILTER = typeof THREE.LinearFilter !== "undefined" ? THREE.LinearFilter : null;
    THREE_REPEAT_WRAP = typeof THREE.RepeatWrapping !== "undefined" ? THREE.RepeatWrapping : null;
  }

  function createTextureSet(THREE, docRef, renderer, id) {
    if (typeof THREE.CanvasTexture !== "function") {
      return Object.create(null);
    }
    readThreeConstants(THREE);
    var result = Object.create(null);
    var names = Object.keys(TEXTURE_SPECS);
    for (var index = 0; index < names.length; index += 1) {
      var name = names[index];
      var spec = TEXTURE_SPECS[name];
      if (spec.width > MAX_TEXTURE_SIZE || spec.height > MAX_TEXTURE_SIZE) {
        continue;
      }
      var surface = createCanvas2D(docRef, spec.width, spec.height);
      if (!surface || !paintTexture(surface.context, spec, name, id)) {
        continue;
      }
      try {
        var texture = new THREE.CanvasTexture(surface.canvas);
        configureTexture(texture, renderer, true);
        result[name] = Object.freeze({
          name: name,
          recipe: spec.recipe,
          texture: texture,
          bumpTexture: createBumpTexture(THREE, docRef, name, spec, renderer),
          bumpScale: spec.bump,
          width: spec.width,
          height: spec.height
        });
      } catch (_error) {
        continue;
      }
    }
    return result;
  }

  function createMaterial(THREE, base, record) {
    var Constructor = null;
    if (base.physical && typeof THREE.MeshPhysicalMaterial === "function") {
      Constructor = THREE.MeshPhysicalMaterial;
    } else if (typeof THREE.MeshStandardMaterial === "function") {
      Constructor = THREE.MeshStandardMaterial;
    }
    if (typeof Constructor !== "function") {
      return null;
    }
    var params = {
      color: base.color,
      metalness: base.metalness,
      roughness: base.roughness,
      envMapIntensity: base.envMapIntensity,
      transparent: base.transparent,
      opacity: base.opacity,
      depthWrite: base.depthWrite
    };
    if (base.emissive !== 0x000000) {
      params.emissive = base.emissive;
      params.emissiveIntensity = base.emissiveIntensity;
    }
    if (base.physical && typeof THREE.MeshPhysicalMaterial === "function") {
      params.clearcoat = base.clearcoat;
      params.clearcoatRoughness = base.clearcoatRoughness;
    }
    if (record && record.texture) {
      params.map = record.texture;
      if (record.bumpTexture) {
        params.bumpMap = record.bumpTexture;
        params.bumpScale = record.bumpScale;
      }
      if (record.recipe === "dashboard" || record.recipe === "zone" ||
        record.recipe === "meter-volts" || record.recipe === "meter-amps" ||
        record.recipe === "telemetry" || record.recipe === "brand") {
        params.emissive = 0xffffff;
        params.emissiveIntensity = 0.28;
        params.emissiveMap = record.texture;
      }
      if (typeof THREE.DoubleSide !== "undefined" &&
        (base.transparent || record.recipe === "brand" || record.recipe === "dashboard")) {
        params.side = THREE.DoubleSide;
      }
    }
    var material = null;
    try {
      material = new Constructor(params);
    } catch (_error) {
      return null;
    }
    if (material && typeof material.needsUpdate !== "undefined") {
      material.needsUpdate = true;
    }
    return material;
  }

  function instantiateModel(THREE, id, descriptor, textures) {
    if (!descriptor || typeof THREE.Group !== "function" || typeof THREE.Mesh !== "function") {
      return null;
    }
    var container = new THREE.Group();
    container.name = "realistic-model-" + id;
    var parts = Object.create(null);
    var meshList = [];
    var materials = [];
    var materialCache = Object.create(null);

    for (var index = 0; index < descriptor.parts.length; index += 1) {
      var entry = descriptor.parts[index];
      var Constructor = THREE[PRIMITIVE_CTORS[entry.primitive]];
      if (typeof Constructor !== "function") {
        continue;
      }
      var geometry = null;
      try {
        geometry = new (Function.prototype.bind.apply(Constructor, [null].concat(entry.args)))();
      } catch (_error) {
        continue;
      }
      if (!geometry) {
        continue;
      }
      var textureName = entry.options.texture || "";
      var record = textures[textureName] || null;
      var cacheKey = entry.material + "|" + textureName;
      var material = materialCache[cacheKey];
      if (!material) {
        material = createMaterial(THREE, SURFACES[entry.material], record);
        if (!material) {
          continue;
        }
        materialCache[cacheKey] = material;
        materials.push(material);
      }
      if (entry.options.animator && typeof material.clone === "function") {
        material = material.clone();
        materials.push(material);
      }
      var mesh = new THREE.Mesh(geometry, material);
      mesh.name = entry.name;
      if (mesh.position && typeof mesh.position.set === "function") {
        mesh.position.set(entry.position[0], entry.position[1], entry.position[2]);
      }
      if (mesh.rotation && typeof mesh.rotation.set === "function") {
        mesh.rotation.set(entry.rotation[0], entry.rotation[1], entry.rotation[2]);
      }
      if (mesh.scale && typeof mesh.scale.set === "function") {
        mesh.scale.set(entry.scale[0], entry.scale[1], entry.scale[2]);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      var animators = entry.options.animator ? [entry.options.animator] : [];
      mesh.userData = {
        catalogId: id,
        animators: animators,
        phase: numberOr(entry.options.phase, index),
        base: {
          position: entry.position.slice(),
          rotation: entry.rotation.slice(),
          emissiveIntensity: typeof material.emissiveIntensity === "number" ? material.emissiveIntensity : 0
        }
      };
      container.add(mesh);
      parts[entry.name] = mesh;
      meshList.push(mesh);
    }
    container.userData = {
      id: id,
      descriptor: descriptor,
      parts: parts,
      meshes: meshList,
      materials: materials
    };
    return container;
  }

  function disposeObject3D(object) {
    if (!object || typeof object.traverse !== "function") {
      return;
    }
    var disposed = [];
    object.traverse(function (node) {
      if (node.geometry && typeof node.geometry.dispose === "function" && disposed.indexOf(node.geometry) === -1) {
        disposed.push(node.geometry);
        node.geometry.dispose();
      }
      var nodeMaterials = node.material
        ? (Array.isArray(node.material) ? node.material : [node.material])
        : [];
      for (var index = 0; index < nodeMaterials.length; index += 1) {
        var material = nodeMaterials[index];
        if (!material || disposed.indexOf(material) !== -1) {
          continue;
        }
        disposed.push(material);
        var maps = [material.map, material.bumpMap, material.emissiveMap, material.alphaMap];
        for (var mapIndex = 0; mapIndex < maps.length; mapIndex += 1) {
          var texture = maps[mapIndex];
          if (texture && typeof texture.dispose === "function" && disposed.indexOf(texture) === -1) {
            disposed.push(texture);
            texture.dispose();
          }
        }
        if (typeof material.dispose === "function") {
          material.dispose();
        }
      }
    });
    if (object.parent && typeof object.parent.remove === "function") {
      object.parent.remove(object);
    }
  }

  function colorToHex(color) {
    if (typeof color === "number") {
      return color >>> 0;
    }
    if (color && typeof color.getHex === "function") {
      return color.getHex() >>> 0;
    }
    if (typeof color === "string") {
      var match = /^#?([0-9a-f]{6})$/i.exec(color.trim());
      if (match) {
        return parseInt(match[1], 16);
      }
    }
    return null;
  }

  function isSpotLightNode(THREE, node) {
    if (!node) {
      return false;
    }
    if (node.isSpotLight === true || node.type === "SpotLight") {
      return true;
    }
    return Boolean(THREE.SpotLight && node instanceof THREE.SpotLight);
  }

  function collectSpotlights(THREE, scene) {
    var found = [];
    if (!scene || typeof scene.traverse !== "function") {
      return found;
    }
    scene.traverse(function (node) {
      if (isSpotLightNode(THREE, node)) {
        found.push(node);
      }
    });
    return found;
  }

  function addSpotlight(THREE, layer, options) {
    if (typeof THREE.SpotLight !== "function") {
      return null;
    }
    var light = null;
    try {
      light = new THREE.SpotLight(options.color, options.intensity, options.distance,
        options.angle, options.penumbra, options.decay);
    } catch (_error) {
      return null;
    }
    light.name = options.name;
    if (light.position && typeof light.position.set === "function") {
      light.position.set(options.x, options.y, options.z);
    }
    var target = null;
    if (typeof THREE.Object3D === "function") {
      try {
        target = new THREE.Object3D();
      } catch (_error) {
        target = null;
      }
    }
    if (target) {
      target.name = options.name + "-target";
      if (target.position && typeof target.position.set === "function") {
        target.position.set(0, 1.1, 0);
      }
      light.target = target;
      if (layer && typeof layer.add === "function") {
        layer.add(target);
      }
    }
    if (layer && typeof layer.add === "function") {
      layer.add(light);
    }
    return light;
  }

  function ensureStudioSpotlights(THREE, scene, layer) {
    var result = { red: null, white: null, reused: [] };
    var existing = collectSpotlights(THREE, scene);
    for (var index = 0; index < existing.length; index += 1) {
      var existingHex = colorToHex(existing[index].color);
      if (existingHex === 0xe60012 && !result.red) {
        result.red = existing[index];
        result.reused.push(existing[index].name || "red-spotlight");
      } else if (existingHex === 0xffffff && !result.white) {
        result.white = existing[index];
        result.reused.push(existing[index].name || "white-spotlight");
      }
    }
    if (!result.red) {
      result.red = addSpotlight(THREE, layer, {
        name: "naztech-realistic-red-spotlight",
        color: 0xe60012, intensity: 22, distance: 26, angle: Math.PI / 5,
        penumbra: 0.5, decay: 1.2, x: -4.2, y: 4.8, z: 3.8
      });
    }
    if (!result.white) {
      result.white = addSpotlight(THREE, layer, {
        name: "naztech-realistic-white-spotlight",
        color: 0xffffff, intensity: 26, distance: 26, angle: Math.PI / 5,
        penumbra: 0.45, decay: 1.2, x: 4.2, y: 5.2, z: 4.0
      });
    }
    return result;
  }

  function hideViewerBackdrop(scene) {
    var hidden = [];
    if (!scene || typeof scene.traverse !== "function") {
      return hidden;
    }
    scene.traverse(function (node) {
      if (!node || node === scene || node.isMesh !== true || !node.geometry || !node.position) {
        return;
      }
      if (node.geometry.type !== "PlaneGeometry") {
        return;
      }
      var params = node.geometry.parameters || {};
      var width = numberOr(params.width, 0);
      var height = numberOr(params.height, 0);
      if (Math.abs(width - 5.6) < 0.02 && Math.abs(height - 2.1) < 0.02 && Math.abs(node.position.z + 2.6) < 0.02) {
        if (node.visible !== false) {
          node.visible = false;
          hidden.push(node);
        }
      }
    });
    return hidden;
  }

  function addStudioBackdrop(THREE, layer, textures) {
    var record = textures.backdrop;
    if (!record || !record.texture || typeof THREE.Mesh !== "function" ||
      typeof THREE.PlaneGeometry !== "function" || typeof THREE.MeshStandardMaterial !== "function") {
      return null;
    }
    var mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 2.1),
      new THREE.MeshStandardMaterial({
        map: record.texture,
        transparent: true,
        opacity: 0.94,
        roughness: 0.38,
        metalness: 0.08,
        emissive: 0xffffff,
        emissiveIntensity: 0.16
      })
    );
    mesh.name = "naztech-realistic-backdrop";
    if (mesh.position && typeof mesh.position.set === "function") {
      mesh.position.set(0, 1.75, -2.57);
    }
    if (layer && typeof layer.add === "function") {
      layer.add(mesh);
    }
    return mesh;
  }

  function applyAnimators(session, timestamp) {
    if (!session || !session.layer || !session.layer.userData) {
      return false;
    }
    var meshes = session.layer.userData.meshes || [];
    var time = numberOr(timestamp, 0) / 1000;
    for (var index = 0; index < meshes.length; index += 1) {
      var mesh = meshes[index];
      var userData = mesh.userData || {};
      var animators = userData.animators || [];
      if (!animators.length) {
        continue;
      }
      var base = userData.base || {};
      var phase = numberOr(userData.phase, index);
      var material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      for (var animatorIndex = 0; animatorIndex < animators.length; animatorIndex += 1) {
        var animator = animators[animatorIndex];
        if ((animator === "ledPulse" || animator === "screenGlow") && material &&
          typeof material.emissiveIntensity === "number") {
          var baseIntensity = numberOr(base.emissiveIntensity, 0.7);
          var speed = animator === "screenGlow" ? 1.1 : 3.1;
          material.emissiveIntensity = baseIntensity * (0.68 + 0.32 * (0.5 + 0.5 * Math.sin(time * speed + phase)));
        } else if (animator === "alarmBlink" && material && typeof material.emissiveIntensity === "number") {
          material.emissiveIntensity = Math.sin(time * 8.4 + phase) > 0 ? 2.6 : 0.12;
        } else if (animator === "bellStrike" && mesh.position && Array.isArray(base.position)) {
          mesh.position.x = base.position[0] + Math.sin(time * 14 + phase) * 0.045;
        } else if (animator === "gimbalYaw" && mesh.rotation && Array.isArray(base.rotation)) {
          mesh.rotation.y = base.rotation[1] + Math.sin(time * 0.8 + phase) * 0.16;
        } else if (animator === "gimbalPitch" && mesh.rotation && Array.isArray(base.rotation)) {
          mesh.rotation.z = base.rotation[2] + Math.sin(time * 0.62 + phase) * 0.1;
        } else if (animator === "orbitSpin" && mesh.rotation && Array.isArray(base.rotation)) {
          mesh.rotation.z = base.rotation[2] + time * 0.18;
        } else if (animator === "orbitBob" && mesh.position && Array.isArray(base.position)) {
          mesh.position.y = base.position[1] + Math.sin(time * 1.4 + phase) * 0.06;
        }
      }
    }
    return true;
  }

  var winRef = typeof window !== "undefined" ? window : null;
  var docRef = typeof document !== "undefined"
    ? document
    : (winRef && winRef.document ? winRef.document : null);
  var activeSession = null;
  var animation = { running: false, rafId: 0 };

  function animationTick(timestamp) {
    if (!animation.running || !activeSession) {
      animation.rafId = 0;
      return;
    }
    applyAnimators(activeSession, timestamp);
    if (winRef && typeof winRef.requestAnimationFrame === "function") {
      animation.rafId = winRef.requestAnimationFrame(animationTick);
    } else {
      animation.rafId = 0;
    }
  }

  function startAnimation() {
    if (!winRef || typeof winRef.requestAnimationFrame !== "function") {
      return false;
    }
    animation.running = true;
    if (!animation.rafId) {
      animation.rafId = winRef.requestAnimationFrame(animationTick);
    }
    return true;
  }

  function stopAnimation() {
    animation.running = false;
    if (animation.rafId && winRef && typeof winRef.cancelAnimationFrame === "function") {
      winRef.cancelAnimationFrame(animation.rafId);
    }
    animation.rafId = 0;
    return true;
  }

  function restoreSessionVisuals(session) {
    if (!session) {
      return;
    }
    if (session.baseGroup && session.hadBaseVisibility) {
      session.baseGroup.visible = session.previousVisibility;
    }
    for (var index = 0; index < session.hiddenBackdrops.length; index += 1) {
      session.hiddenBackdrops[index].visible = true;
    }
  }

  function detachSession(detail) {
    var session = activeSession;
    if (!session) {
      return false;
    }
    if (detail && typeof detail === "object") {
      if (detail.scene && detail.scene !== session.scene) {
        return false;
      }
      if (typeof detail.epoch === "number" && detail.epoch !== session.epoch) {
        return false;
      }
      if (typeof detail.id === "string" && detail.id !== session.id) {
        return false;
      }
    }
    activeSession = null;
    stopAnimation();
    restoreSessionVisuals(session);
    disposeObject3D(session.layer);
    return true;
  }

  function attachSession(detail) {
    if (!detail || typeof detail !== "object" || !detail.scene || !isCatalogId(detail.id)) {
      return false;
    }
    var THREE = winRef && winRef.THREE ? winRef.THREE : null;
    if (!THREE || typeof THREE.Group !== "function" || typeof THREE.Mesh !== "function" ||
      typeof THREE.MeshStandardMaterial !== "function" || typeof detail.scene.add !== "function") {
      return false;
    }
    var epoch = numberOr(detail.epoch, 0);
    if (activeSession && activeSession.id === detail.id && activeSession.epoch === epoch &&
      activeSession.scene === detail.scene) {
      return true;
    }
    if (activeSession) {
      detachSession(activeSession.detail);
    }

    var textures = createTextureSet(THREE, docRef, detail.renderer, detail.id);
    var layer = new THREE.Group();
    layer.name = LAYER_NAME;
    if (layer.position && typeof layer.position.set === "function") {
      layer.position.set(0, PEDESTAL_OFFSET, 0);
    }
    layer.userData = { id: detail.id, epoch: epoch, textureNames: Object.keys(textures) };

    var baseGroup = detail.group && typeof detail.group === "object" ? detail.group : null;
    var hadBaseVisibility = Boolean(baseGroup && typeof baseGroup.visible === "boolean");
    var previousVisibility = hadBaseVisibility ? baseGroup.visible : null;
    if (hadBaseVisibility) {
      baseGroup.visible = false;
    }
    var hiddenBackdrops = hideViewerBackdrop(detail.scene);
    var lights = ensureStudioSpotlights(THREE, detail.scene, layer);
    var backdrop = addStudioBackdrop(THREE, layer, textures);
    var model = instantiateModel(THREE, detail.id, MODELS[detail.id], textures);
    if (model && typeof layer.add === "function") {
      layer.add(model);
    }
    layer.userData.model = model;
    layer.userData.meshes = model && model.userData ? model.userData.meshes : [];
    layer.userData.backdrop = backdrop;
    layer.userData.lights = lights;

    try {
      detail.scene.add(layer);
    } catch (_error) {
      disposeObject3D(layer);
      if (hadBaseVisibility) {
        baseGroup.visible = previousVisibility;
      }
      for (var restoreIndex = 0; restoreIndex < hiddenBackdrops.length; restoreIndex += 1) {
        hiddenBackdrops[restoreIndex].visible = true;
      }
      return false;
    }

    activeSession = {
      detail: detail,
      id: detail.id,
      epoch: epoch,
      scene: detail.scene,
      renderer: detail.renderer || null,
      baseGroup: baseGroup,
      hadBaseVisibility: hadBaseVisibility,
      previousVisibility: previousVisibility,
      hiddenBackdrops: hiddenBackdrops,
      layer: layer,
      textures: textures,
      lights: lights,
      model: model
    };
    startAnimation();
    return true;
  }

  function handleSessionReady(event) {
    return attachSession(event && event.detail);
  }

  function handleSessionEnd(event) {
    return detachSession(event && event.detail);
  }

  function describeModels() {
    var summary = Object.create(null);
    for (var index = 0; index < MODEL_IDS.length; index += 1) {
      var id = MODEL_IDS[index];
      var entry = MODELS[id];
      summary[id] = {
        label: entry.label,
        count: entry.count,
        animators: entry.animators.slice(),
        parts: entry.parts.map(function (descriptor) {
          return descriptor.name;
        })
      };
    }
    return summary;
  }

  function snapshot() {
    if (!activeSession) {
      return { attached: false };
    }
    var THREE = winRef && winRef.THREE ? winRef.THREE : null;
    var spots = collectSpotlights(THREE, activeSession.scene);
    var model = activeSession.layer.userData.model;
    return {
      attached: true,
      id: activeSession.id,
      epoch: activeSession.epoch,
      layerName: activeSession.layer.name,
      descriptorCount: MODELS[activeSession.id].count,
      meshCount: model && model.userData ? model.userData.meshes.length : 0,
      textureCount: Object.keys(activeSession.textures).length,
      bumpTextureCount: Object.keys(activeSession.textures).filter(function (name) {
        return Boolean(activeSession.textures[name].bumpTexture);
      }).length,
      spotlightCount: spots.length,
      backdropCount: activeSession.layer.userData.backdrop ? 1 : 0,
      baseHidden: Boolean(activeSession.baseGroup && activeSession.baseGroup.visible === false)
    };
  }

  var testApi = Object.freeze({
    modelIds: MODEL_IDS,
    expectedCounts: EXPECTED_COUNTS,
    meshBudget: MESH_BUDGET,
    brand: BRAND,
    validate: function () {
      return validateModels(MODELS);
    },
    describeModels: describeModels,
    snapshot: snapshot,
    attach: attachSession,
    detach: detachSession,
    applyAnimators: function (timestamp) {
      return applyAnimators(activeSession, timestamp);
    },
    countSpotlights: function () {
      var THREE = winRef && winRef.THREE ? winRef.THREE : null;
      return collectSpotlights(THREE, activeSession ? activeSession.scene : null).length;
    }
  });

  var publicApi = Object.freeze({
    version: "1.0.0",
    organization: "Baysöz Yazılım",
    contact: "baysozlabs@proton.me",
    modelIds: MODEL_IDS,
    expectedCounts: EXPECTED_COUNTS,
    events: Object.freeze({
      sessionReady: EVENT_SESSION_READY,
      sessionEnd: EVENT_SESSION_END
    }),
    test: testApi
  });

  if (winRef) {
    winRef.NAZTECH_REALISTIC_MODELS = publicApi;
    winRef.NAZTECH_REALISTIC_TEST = testApi;
  }
  if (docRef && typeof docRef.addEventListener === "function") {
    docRef.addEventListener(EVENT_SESSION_READY, handleSessionReady);
    docRef.addEventListener(EVENT_SESSION_END, handleSessionEnd);
  }
}());
