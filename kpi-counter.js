document.addEventListener("DOMContentLoaded", function () {
  var targets = [
    { match: "0+", end: 150, format: function (v) { return Math.round(v) + "+"; } },
    { match: "0", end: 8, format: function (v) { return String(Math.round(v)); } },
    { match: "%0", end: 100, format: function (v) { return "%" + Math.round(v); } },
    { match: "7/0", end: 24, format: function (v) { return "7/" + Math.round(v); } }
  ];
  var els = Array.from(document.querySelectorAll("div, span, p, h2, h3")).filter(function (el) {
    return el.children.length === 0 && targets.some(function (t) { return t.match === el.textContent.trim(); });
  });
  function runCounter(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = "1";
    var txt = el.textContent.trim();
    var cfg = targets.find(function (t) { return t.match === txt; });
    if (!cfg) return;
    var start = null, duration = 1600;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = cfg.format(cfg.end * eased);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = cfg.format(cfg.end);
    }
    requestAnimationFrame(step);
  }
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        runCounter(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  els.forEach(function (el) { obs.observe(el); });
});
