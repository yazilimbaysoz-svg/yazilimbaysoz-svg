/*
 * Baysöz Yazılım — NAZTECH Bilişim 3D interaction layer.
 * Contact: baysozlabs@proton.me
 *
 * Classic script with no external dependencies. The hero scene uses a compact
 * software 3D pipeline on Canvas 2D so the site remains build-free and offline.
 * Every optional browser surface is feature-detected before use.
 */
(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var GOLD = "212, 175, 55";
  var GOLD_LIGHT = "245, 208, 111";
  var PRELOADER_VISIBLE_MS = 800;
  var PRELOADER_FADE_MS = 380;
  var ZOOM_MIN = 1;
  var ZOOM_MAX = 3.2;
  var ZOOM_STEP = 0.12;

  function scheduler(win) {
    if (win && typeof win.setTimeout === "function") {
      var winTimer = win.setTimeout;
      return function (callback, delay) {
        return winTimer.call(win, callback, delay);
      };
    }
    if (typeof setTimeout === "function") {
      return function (callback, delay) {
        return setTimeout(callback, delay);
      };
    }
    return null;
  }

  function frameScheduler(win) {
    if (win && typeof win.requestAnimationFrame === "function") {
      var winFrame = win.requestAnimationFrame;
      return function (callback) {
        return winFrame.call(win, callback);
      };
    }
    if (typeof requestAnimationFrame === "function") {
      return function (callback) {
        return requestAnimationFrame(callback);
      };
    }
    return null;
  }

  function frameCanceller(win) {
    if (win && typeof win.cancelAnimationFrame === "function") {
      var winCancel = win.cancelAnimationFrame;
      return function (handle) {
        winCancel.call(win, handle);
      };
    }
    if (typeof cancelAnimationFrame === "function") {
      return function (handle) {
        cancelAnimationFrame(handle);
      };
    }
    return null;
  }

  function now() {
    if (typeof performance !== "undefined" && performance && typeof performance.now === "function") {
      return performance.now();
    }
    if (typeof Date !== "undefined" && Date && typeof Date.now === "function") {
      return Date.now();
    }
    return 0;
  }

  function reducedMotion(win) {
    if (!win || typeof win.matchMedia !== "function") {
      return false;
    }
    var query = win.matchMedia("(prefers-reduced-motion: reduce)");
    return Boolean(query && query.matches);
  }

  function setProperty(node, name, value) {
    if (node && node.style && typeof node.style.setProperty === "function") {
      node.style.setProperty(name, value);
    }
  }

  function setStyle(node, name, value) {
    if (node && node.style) {
      node.style[name] = value;
    }
  }

  function rectOf(node) {
    if (!node || typeof node.getBoundingClientRect !== "function") {
      return null;
    }
    var rect = node.getBoundingClientRect();
    if (!rect || typeof rect.width !== "number" || typeof rect.height !== "number") {
      return null;
    }
    return rect;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  /* ------------------------------------------------------------------ *
   * Circuit preloader: the markup is present before first paint and the
   * controller keeps it visible for exactly 0.8s, then fades it smoothly.
   * ------------------------------------------------------------------ */
  function initPreloader(doc, win) {
    var overlay = doc.querySelector(".nzt-preloader");
    if (!overlay) {
      return;
    }
    var timer = scheduler(win);
    if (!timer) {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      return;
    }
    timer(function () {
      overlay.classList.add("is-complete");
      overlay.setAttribute("aria-hidden", "true");
      timer(function () {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, PRELOADER_FADE_MS);
    }, PRELOADER_VISIBLE_MS);
  }

  /* ------------------------------------------------------------------ *
   * Hero scene: rotating golden wireframe sphere and a depth particle
   * field, projected in software. Composition stays behind the headline
   * and beside the existing matrix and energy-ring layers.
   * ------------------------------------------------------------------ */
  function spherePoint(latitudeDegrees, longitudeDegrees, radius) {
    var latitude = (latitudeDegrees * Math.PI) / 180;
    var longitude = (longitudeDegrees * Math.PI) / 180;
    var ring = Math.cos(latitude) * radius;
    return {
      x: ring * Math.sin(longitude),
      y: Math.sin(latitude) * radius,
      z: ring * Math.cos(longitude)
    };
  }

  function buildWireframe(radius) {
    var segments = [];
    var latitudes = [-60, -30, 0, 30, 60];
    var longitudeIndex;
    var latitudeIndex;
    var angle;

    for (latitudeIndex = 0; latitudeIndex < latitudes.length; latitudeIndex += 1) {
      var parallel = [];
      for (angle = 0; angle <= 360; angle += 8) {
        parallel.push(spherePoint(latitudes[latitudeIndex], angle, radius));
      }
      segments.push({ points: parallel, kind: "parallel" });
    }

    for (longitudeIndex = 0; longitudeIndex < 360; longitudeIndex += 30) {
      var meridian = [];
      for (angle = -84; angle <= 84; angle += 7) {
        meridian.push(spherePoint(angle, longitudeIndex, radius));
      }
      segments.push({ points: meridian, kind: "meridian" });
    }
    return segments;
  }

  function rotatePoint(point, yaw, pitch) {
    var cosYaw = Math.cos(yaw);
    var sinYaw = Math.sin(yaw);
    var x1 = point.x * cosYaw + point.z * sinYaw;
    var z1 = -point.x * sinYaw + point.z * cosYaw;
    var cosPitch = Math.cos(pitch);
    var sinPitch = Math.sin(pitch);
    return {
      x: x1,
      y: point.y * cosPitch - z1 * sinPitch,
      z: point.y * sinPitch + z1 * cosPitch
    };
  }

  function initHeroScene(doc, win) {
    var hero = doc.getElementById("anasayfa");
    var canvas = doc.getElementById("nztSceneCanvas");
    if (!hero || !canvas || typeof canvas.getContext !== "function") {
      return;
    }
    var context = canvas.getContext("2d");
    if (!context || typeof context.clearRect !== "function") {
      return;
    }

    var requestFrame = frameScheduler(win);
    var cancelFrame = frameCanceller(win);
    var staticOnly = reducedMotion(win) || !requestFrame;
    var width = 0;
    var height = 0;
    var centerX = 0;
    var centerY = 0;
    var focal = 1;
    var radius = 1;
    var wireframe = [];
    var particles = [];
    var pointerX = 0;
    var pointerY = 0;
    var targetX = 0;
    var targetY = 0;
    var yaw = 0;
    var lastTime = 0;
    var handle = 0;
    var running = false;
    var inView = true;

    function buildParticles() {
      var count = clamp(Math.round((width * height) / 14000), 48, 110);
      particles = [];
      for (var index = 0; index < count; index += 1) {
        particles.push({
          x: (Math.random() * 2 - 1) * width * 0.72,
          y: (Math.random() * 2 - 1) * height * 0.68,
          z: -focal * 0.55 + Math.random() * focal * 1.1,
          speed: 9 + Math.random() * 24,
          size: 0.6 + Math.random() * 1.5
        });
      }
    }

    function resize() {
      width = Math.max(1, hero.clientWidth || (win && win.innerWidth) || 1);
      height = Math.max(1, hero.clientHeight || (win && win.innerHeight) || 1);
      var pixelRatio = clamp((win && win.devicePixelRatio) || 1, 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      if (typeof context.setTransform === "function") {
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      }
      centerX = width / 2;
      centerY = height / 2;
      var span = Math.min(width, height);
      radius = span * 0.24;
      focal = span * 1.6;
      wireframe = buildWireframe(radius);
      buildParticles();
      if (staticOnly) {
        render(0);
      }
    }

    function project(point) {
      var scale = focal / (focal + point.z);
      return {
        x: centerX + point.x * scale,
        y: centerY + point.y * scale,
        scale: scale,
        z: point.z
      };
    }

    function renderParticles(deltaSeconds) {
      var index;
      for (index = 0; index < particles.length; index += 1) {
        var particle = particles[index];
        if (deltaSeconds > 0) {
          particle.z -= particle.speed * deltaSeconds;
          if (particle.z < -focal * 0.55) {
            particle.z = focal * 0.55;
            particle.x = (Math.random() * 2 - 1) * width * 0.72;
            particle.y = (Math.random() * 2 - 1) * height * 0.68;
          }
        }
        var projected = project({
          x: particle.x + pointerX * 26,
          y: particle.y + pointerY * 18,
          z: particle.z
        });
        var depthRatio = clamp((particle.z / (focal * 0.55) + 1) / 2, 0, 1);
        var alpha = clamp(0.62 - depthRatio * 0.5, 0.08, 0.62);
        context.beginPath();
        context.arc(projected.x, projected.y, particle.size * projected.scale, 0, TAU);
        context.fillStyle = "rgba(" + GOLD_LIGHT + ", " + alpha.toFixed(3) + ")";
        context.fill();
      }
    }

    function renderSphere() {
      var pitch = -0.16 + pointerY * 0.3;
      var index;
      for (index = 0; index < wireframe.length; index += 1) {
        var segment = wireframe[index];
        var depthSum = 0;
        var pointIndex;
        context.beginPath();
        for (pointIndex = 0; pointIndex < segment.points.length; pointIndex += 1) {
          var rotated = rotatePoint(segment.points[pointIndex], yaw, pitch);
          var projected = project(rotated);
          depthSum += rotated.z;
          if (pointIndex === 0) {
            context.moveTo(projected.x, projected.y);
          } else {
            context.lineTo(projected.x, projected.y);
          }
        }
        var front = depthSum / segment.points.length < 0;
        context.lineWidth = front ? 1.25 : 0.65;
        context.strokeStyle = "rgba(" + (front ? GOLD_LIGHT : GOLD) + ", " + (front ? "0.52" : "0.16") + ")";
        if (front && typeof context.shadowBlur === "number") {
          context.shadowBlur = 8;
          context.shadowColor = "rgba(" + GOLD + ", 0.55)";
        }
        context.stroke();
        if (front && typeof context.shadowBlur === "number") {
          context.shadowBlur = 0;
        }

        if (front && segment.kind === "meridian" && index % 2 === 0) {
          var node = rotatePoint(segment.points[Math.floor(segment.points.length / 2)], yaw, pitch);
          var nodeProjected = project(node);
          context.beginPath();
          context.arc(nodeProjected.x, nodeProjected.y, 1.7 * nodeProjected.scale, 0, TAU);
          context.fillStyle = "rgba(" + GOLD_LIGHT + ", 0.85)";
          context.fill();
        }
      }
    }

    function render(deltaSeconds) {
      context.clearRect(0, 0, width, height);
      renderParticles(deltaSeconds);
      renderSphere();
    }

    function tick(timestamp) {
      if (!running) {
        return;
      }
      var elapsed = lastTime ? (timestamp - lastTime) / 1000 : 0.016;
      lastTime = timestamp;
      var deltaSeconds = clamp(elapsed, 0, 0.05);
      yaw += deltaSeconds * 0.3;
      pointerX += (targetX - pointerX) * 0.06;
      pointerY += (targetY - pointerY) * 0.06;
      render(deltaSeconds);
      handle = requestFrame(tick);
    }

    function start() {
      if (staticOnly || running || !inView || doc.hidden) {
        return;
      }
      running = true;
      lastTime = 0;
      handle = requestFrame(tick);
    }

    function stop() {
      if (!running) {
        return;
      }
      running = false;
      if (handle && cancelFrame) {
        cancelFrame(handle);
      }
      handle = 0;
    }

    if (win && typeof win.addEventListener === "function") {
      win.addEventListener("resize", resize);
      win.addEventListener("orientationchange", resize);
    }
    if (typeof doc.addEventListener === "function") {
      doc.addEventListener("visibilitychange", function () {
        if (doc.hidden) {
          stop();
        } else {
          start();
        }
      });
    }
    if (typeof hero.addEventListener === "function") {
      hero.addEventListener("pointermove", function (event) {
        if (!event || typeof event.clientX !== "number" || typeof event.clientY !== "number") {
          return;
        }
        var bounds = rectOf(hero);
        if (!bounds || !bounds.width || !bounds.height) {
          return;
        }
        targetX = clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1);
        targetY = clamp((event.clientY - bounds.top) / bounds.height * 2 - 1, -1, 1);
      });
      hero.addEventListener("pointerleave", function () {
        targetX = 0;
        targetY = 0;
      });
    }
    if (win && !staticOnly && typeof win.IntersectionObserver === "function") {
      var observer = new win.IntersectionObserver(
        function (entries) {
          if (!entries || !entries.length) {
            return;
          }
          inView = entries[0].isIntersecting !== false;
          if (inView) {
            start();
          } else {
            stop();
          }
        },
        { threshold: 0.02 }
      );
      observer.observe(hero);
    }

    resize();
    start();
  }

  /* ------------------------------------------------------------------ *
   * Service cards: pointer-driven perspective tilt and a radial gold
   * spotlight derived from the cursor position.
   * ------------------------------------------------------------------ */
  function initCardTilt(doc) {
    var cards = doc.querySelectorAll(".card-hover");
    for (var index = 0; index < cards.length; index += 1) {
      bindCard(cards[index]);
    }
  }

  function bindCard(card) {
    if (!card || typeof card.addEventListener !== "function") {
      return;
    }
    card.addEventListener("pointermove", function (event) {
      if (!event || typeof event.clientX !== "number" || typeof event.clientY !== "number") {
        return;
      }
      var bounds = rectOf(card);
      if (!bounds || !bounds.width || !bounds.height) {
        return;
      }
      var relativeX = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
      var relativeY = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
      setProperty(card, "--nzt-tilt-x", ((0.5 - relativeY) * 9).toFixed(2) + "deg");
      setProperty(card, "--nzt-tilt-y", ((relativeX - 0.5) * 11).toFixed(2) + "deg");
      setProperty(card, "--nzt-spot-x", (relativeX * 100).toFixed(1) + "%");
      setProperty(card, "--nzt-spot-y", (relativeY * 100).toFixed(1) + "%");
    });
    card.addEventListener("pointerleave", function () {
      setProperty(card, "--nzt-tilt-x", "0deg");
      setProperty(card, "--nzt-tilt-y", "0deg");
      setProperty(card, "--nzt-spot-x", "50%");
      setProperty(card, "--nzt-spot-y", "50%");
    });
  }

  /* ------------------------------------------------------------------ *
   * KPI counters: scroll-triggered easing with exact final values.
   * ------------------------------------------------------------------ */
  function initCounters(doc, win) {
    var nodes = doc.querySelectorAll("[data-kpi-value]");
    if (!nodes.length) {
      return;
    }

    function render(node, value) {
      var prefix = node.getAttribute("data-kpi-prefix") || "";
      var suffix = node.getAttribute("data-kpi-suffix") || "";
      node.textContent = prefix + String(Math.round(value)) + suffix;
    }

    function animate(node) {
      if (node.getAttribute("data-kpi-running") === "true") {
        return;
      }
      node.setAttribute("data-kpi-running", "true");
      var target = Number(node.getAttribute("data-kpi-target"));
      if (!isFinite(target)) {
        render(node, 0);
        return;
      }
      if (reducedMotion(win)) {
        render(node, target);
        return;
      }
      var requestFrame = frameScheduler(win);
      if (!requestFrame) {
        render(node, target);
        return;
      }
      var start = now();
      var duration = 1500;
      function step(timestamp) {
        var progress = clamp((timestamp - start) / duration, 0, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        render(node, target * eased);
        if (progress < 1) {
          requestFrame(step);
        } else {
          render(node, target);
        }
      }
      requestFrame(step);
    }

    if (reducedMotion(win) || !win || typeof win.IntersectionObserver !== "function") {
      for (var index = 0; index < nodes.length; index += 1) {
        animate(nodes[index]);
      }
      return;
    }

    var observer = new win.IntersectionObserver(
      function (entries) {
        for (var index = 0; index < entries.length; index += 1) {
          if (entries[index].isIntersecting !== false) {
            animate(entries[index].target);
            observer.unobserve(entries[index].target);
          }
        }
      },
      { threshold: 0.35 }
    );
    for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
      observer.observe(nodes[nodeIndex]);
    }
  }

  /* ------------------------------------------------------------------ *
   * Product viewer: a modal-local 3D inspection surface with pointer
   * tilt, +/- controls, wheel zoom and a readable zoom readout.
   * ------------------------------------------------------------------ */
  function createViewerButton(doc, label, className, description) {
    var button = doc.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.setAttribute("aria-label", description);
    return button;
  }

  function initProductViewer(doc, win) {
    var modal = doc.getElementById("naztechModal");
    var gallery = doc.getElementById("modalGallery");
    if (!modal || !gallery || typeof modal.appendChild !== "function") {
      return;
    }

    var viewer = doc.createElement("div");
    viewer.className = "product-viewer";
    viewer.hidden = true;
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");
    viewer.setAttribute("aria-label", "Ürün üç boyutlu inceleme görünümü");
    viewer.setAttribute("data-product-viewer", "");

    var bar = doc.createElement("div");
    bar.className = "product-viewer__bar";
    var heading = doc.createElement("span");
    heading.className = "product-viewer__title";
    heading.textContent = "3D Ürün İnceleme";
    var hint = doc.createElement("span");
    hint.className = "product-viewer__hint";
    hint.textContent = "Fareyle döndür · Tekerlekle yakınlaştır";
    var closeButton = createViewerButton(doc, "×", "product-viewer__close", "İncelemeyi kapat");
    bar.appendChild(heading);
    bar.appendChild(hint);
    bar.appendChild(closeButton);

    var stage = doc.createElement("div");
    stage.className = "product-viewer__stage";
    var grid = doc.createElement("div");
    grid.className = "product-viewer__grid";
    grid.setAttribute("aria-hidden", "true");
    var image = doc.createElement("img");
    image.className = "product-viewer__image";
    image.alt = "";
    var reticle = doc.createElement("div");
    reticle.className = "product-viewer__reticle";
    reticle.setAttribute("aria-hidden", "true");
    stage.appendChild(grid);
    stage.appendChild(image);
    stage.appendChild(reticle);

    var controls = doc.createElement("div");
    controls.className = "product-viewer__controls";
    var zoomOutButton = createViewerButton(doc, "−", "product-viewer__control", "Uzaklaştır");
    var zoomLevel = doc.createElement("span");
    zoomLevel.className = "product-viewer__level";
    zoomLevel.textContent = "100%";
    var zoomInButton = createViewerButton(doc, "+", "product-viewer__control", "Yakınlaştır");
    var resetButton = createViewerButton(doc, "↺", "product-viewer__control", "Görünümü sıfırla");
    controls.appendChild(zoomOutButton);
    controls.appendChild(zoomLevel);
    controls.appendChild(zoomInButton);
    controls.appendChild(resetButton);

    viewer.appendChild(bar);
    viewer.appendChild(stage);
    viewer.appendChild(controls);
    modal.appendChild(viewer);

    var isOpen = false;
    var zoom = ZOOM_MIN;
    var tiltX = 0;
    var tiltY = 0;
    var panX = 0;
    var panY = 0;
    var opener = null;
    var viewerButtons = [closeButton, zoomOutButton, zoomInButton, resetButton];

    function apply() {
      setStyle(
        image,
        "transform",
        "perspective(900px) translate3d(" + panX.toFixed(1) + "px, " + panY.toFixed(1) + "px, 0) " +
          "rotateX(" + tiltX.toFixed(2) + "deg) rotateY(" + tiltY.toFixed(2) + "deg) " +
          "scale(" + zoom.toFixed(2) + ")"
      );
      zoomLevel.textContent = Math.round(zoom * 100) + "%";
    }

    function setZoom(value) {
      zoom = Math.round(clamp(value, ZOOM_MIN, ZOOM_MAX) * 100) / 100;
      apply();
    }

    function resetView() {
      setZoom(ZOOM_MIN);
      tiltX = 0;
      tiltY = 0;
      panX = 0;
      panY = 0;
      apply();
    }

    function open(source) {
      if (!source) {
        return;
      }
      var sourcePath = source.getAttribute("src") || source.src || "";
      if (!sourcePath) {
        return;
      }
      opener = typeof source.closest === "function" ? source.closest("figure") : source.parentNode;
      image.setAttribute("src", sourcePath);
      image.setAttribute("alt", source.getAttribute("alt") || "Ürün görünümü");
      var caption = opener && typeof opener.querySelector === "function"
        ? opener.querySelector(".modal__caption-title")
        : null;
      heading.textContent = caption && caption.textContent ? caption.textContent : "3D Ürün İnceleme";
      resetView();
      viewer.hidden = false;
      isOpen = true;
      if (typeof closeButton.focus === "function") {
        closeButton.focus();
      }
    }

    function close() {
      if (!isOpen) {
        return false;
      }
      viewer.hidden = true;
      isOpen = false;
      if (opener && typeof opener.focus === "function") {
        opener.focus();
      }
      opener = null;
      return true;
    }

    if (typeof gallery.addEventListener === "function") {
      gallery.addEventListener("click", function (event) {
        if (!event || !event.target || typeof event.target.closest !== "function") {
          return;
        }
        if (event.target.closest("a")) {
          return;
        }
        var figure = event.target.closest("figure");
        if (!figure || !gallery.contains(figure)) {
          return;
        }
        var source = figure.querySelector("img");
        if (!source) {
          return;
        }
        if (typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        open(source);
      });
      gallery.addEventListener("keydown", function (event) {
        if (!event || (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar")) {
          return;
        }
        if (!event.target || typeof event.target.closest !== "function") {
          return;
        }
        var figure = event.target.closest("figure");
        if (!figure) {
          return;
        }
        var source = figure.querySelector("img");
        if (!source) {
          return;
        }
        if (typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        open(source);
      });
    }

    if (typeof stage.addEventListener === "function") {
      stage.addEventListener("pointermove", function (event) {
        if (!event || typeof event.clientX !== "number" || typeof event.clientY !== "number") {
          return;
        }
        var bounds = rectOf(stage);
        if (!bounds || !bounds.width || !bounds.height) {
          return;
        }
        var relativeX = clamp((event.clientX - bounds.left) / bounds.width - 0.5, -0.5, 0.5);
        var relativeY = clamp((event.clientY - bounds.top) / bounds.height - 0.5, -0.5, 0.5);
        tiltX = -relativeY * 24;
        tiltY = relativeX * 32;
        panX = relativeX * 16;
        panY = relativeY * 12;
        apply();
      });
      stage.addEventListener("pointerleave", function () {
        tiltX = 0;
        tiltY = 0;
        panX = 0;
        panY = 0;
        apply();
      });
      stage.addEventListener(
        "wheel",
        function (event) {
          if (!event || typeof event.deltaY !== "number" || event.deltaY === 0) {
            return;
          }
          if (typeof event.preventDefault === "function") {
            event.preventDefault();
          }
          setZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
        },
        { passive: false }
      );
      stage.addEventListener("dblclick", function () {
        resetView();
      });
    }

    if (typeof closeButton.addEventListener === "function") {
      closeButton.addEventListener("click", close);
    }
    if (typeof zoomInButton.addEventListener === "function") {
      zoomInButton.addEventListener("click", function () {
        setZoom(zoom + ZOOM_STEP);
      });
    }
    if (typeof zoomOutButton.addEventListener === "function") {
      zoomOutButton.addEventListener("click", function () {
        setZoom(zoom - ZOOM_STEP);
      });
    }
    if (typeof resetButton.addEventListener === "function") {
      resetButton.addEventListener("click", resetView);
    }
    if (typeof modal.addEventListener === "function") {
      modal.addEventListener("click", function (event) {
        if (!isOpen || !event || !event.target || typeof event.target.closest !== "function") {
          return;
        }
        if (event.target.closest("[data-modal-close]")) {
          close();
        }
      });
    }
    if (typeof doc.addEventListener === "function") {
      doc.addEventListener(
        "keydown",
        function (event) {
          if (!isOpen || !event) {
            return;
          }
          var key = event.key;
          if (key === "Escape" || key === "Esc") {
            if (typeof event.preventDefault === "function") {
              event.preventDefault();
            }
            if (typeof event.stopPropagation === "function") {
              event.stopPropagation();
            }
            close();
            return;
          }
          if (key === "Tab") {
            var activeIndex = -1;
            var buttonIndex;
            for (buttonIndex = 0; buttonIndex < viewerButtons.length; buttonIndex += 1) {
              if (viewerButtons[buttonIndex] === doc.activeElement) {
                activeIndex = buttonIndex;
                break;
              }
            }
            var nextIndex = event.shiftKey
              ? (activeIndex <= 0 ? viewerButtons.length - 1 : activeIndex - 1)
              : (activeIndex === -1 || activeIndex === viewerButtons.length - 1 ? 0 : activeIndex + 1);
            if (typeof event.preventDefault === "function") {
              event.preventDefault();
            }
            if (typeof event.stopPropagation === "function") {
              event.stopPropagation();
            }
            if (typeof viewerButtons[nextIndex].focus === "function") {
              viewerButtons[nextIndex].focus();
            }
            return;
          }
          if (key === "+" || key === "=" || key === "ArrowUp") {
            if (typeof event.preventDefault === "function") {
              event.preventDefault();
            }
            setZoom(zoom + ZOOM_STEP);
          } else if (key === "-" || key === "_" || key === "ArrowDown") {
            if (typeof event.preventDefault === "function") {
              event.preventDefault();
            }
            setZoom(zoom - ZOOM_STEP);
          } else if (key === "0") {
            resetView();
          }
        },
        true
      );
    }

    apply();
  }

  function ready(callback) {
    if (typeof document === "undefined" || !document) {
      return;
    }
    if (document.readyState === "loading" && typeof document.addEventListener === "function") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  ready(function () {
    var doc = document;
    var win = typeof window !== "undefined" && window ? window : null;
    initPreloader(doc, win);
    initHeroScene(doc, win);
    initCardTilt(doc);
    initCounters(doc, win);
    initProductViewer(doc, win);
  });
})();
