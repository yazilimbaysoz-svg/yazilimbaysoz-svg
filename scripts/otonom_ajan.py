import re

with open("webgl-3d-viewer.js", "r", encoding="utf-8") as f:
    js = f.read()

target_js = "  scene.add(group);"
studio_addon = """  scene.add(group);
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
  })(THREE, scene, group, id);"""

assert target_js in js, "target_js bulunamadi"
js = js.replace(target_js, studio_addon, 1)
with open("webgl-3d-viewer.js", "w", encoding="utf-8") as f:
    f.write(js)
print("AJAN_1_3D_OK")

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

if "frame-src" not in html and "Content-Security-Policy" in html:
    html = html.replace("object-src 'none'", "frame-src https://google.com https://google.com; object-src 'none'")

form_and_map = """
<section id="kurumsal-talep" class="max-w-5xl mx-auto px-4 py-14">
  <div class="rounded-2xl border border-amber-500/30 bg-zinc-950/90 p-6 md:p-10 shadow-2xl">
    <h2 class="text-2xl md:text-3xl font-extrabold text-amber-400 tracking-wide mb-2">KURUMSAL TEKLİF &amp; KEŞİF TALEBİ</h2>
    <p class="text-zinc-400 text-sm mb-6">Ad-Soyad ve Telefon bilgilerinizi doldurun; sistem doğrudan WhatsApp (0553 034 18 94) ve kurumsal e-posta hattımıza resmi iş emri açar.</p>
    <form id="naztechWorkOrderForm" class="grid grid-cols-1 md:grid-cols-2 gap-4" novalidate>
      <div>
        <label for="nzFullName" class="block text-xs uppercase tracking-wider text-amber-300 mb-1">Ad-Soyad *</label>
        <input id="nzFullName" type="text" required placeholder="Örn: Mehmet Demir" class="w-full rounded-xl bg-black/70 border border-zinc-700 focus:border-amber-400 px-4 py-3 text-white outline-none">
      </div>
      <div>
        <label for="nzPhone" class="block text-xs uppercase tracking-wider text-amber-300 mb-1">Telefon Numarası *</label>
        <input id="nzPhone" type="tel" required placeholder="05XX XXX XX XX" class="w-full rounded-xl bg-black/70 border border-zinc-700 focus:border-amber-400 px-4 py-3 text-white outline-none">
      </div>
      <div>
        <label for="nzSystem" class="block text-xs uppercase tracking-wider text-amber-300 mb-1">Talep Edilen Sistem</label>
        <select id="nzSystem" class="w-full rounded-xl bg-black/70 border border-zinc-700 focus:border-amber-400 px-4 py-3 text-white outline-none">
          <option value="HIKVISION Güvenlik &amp; Kamera Sistemleri">HIKVISION Güvenlik &amp; Kamera Sistemleri</option>
          <option value="N2MOBİL Araç Takip &amp; Telemetri">N2MOBİL Araç Takip &amp; Telemetri</option>
          <option value="LAVOX Adresli Yangın Algılama Sistemleri">LAVOX Adresli Yangın Algılama Sistemleri</option>
          <option value="ERP Yazılım &amp; Endüstriyel Kompanzasyon Panosu">ERP Yazılım &amp; Endüstriyel Kompanzasyon Panosu</option>
        </select>
      </div>
      <div>
        <label for="nzNote" class="block text-xs uppercase tracking-wider text-amber-300 mb-1">Keşif Adresi / Not</label>
        <input id="nzNote" type="text" placeholder="İlçe / Mahalle veya kısa talep notu" class="w-full rounded-xl bg-black/70 border border-zinc-700 focus:border-amber-400 px-4 py-3 text-white outline-none">
      </div>
      <div class="md:col-span-2">
        <p id="nzFormError" class="text-red-400 text-sm font-medium mb-2" role="alert"></p>
        <button type="submit" class="w-full md:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-extrabold tracking-wide hover:brightness-110 transition">Resmi İş Emri Oluştur (WhatsApp &amp; E-Posta)</button>
      </div>
    </form>
  </div>
</section>

<footer id="canli-konum" class="border-t border-amber-500/25 bg-black/95 mt-8">
  <div class="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-2 text-sm text-zinc-300">
    <div><strong class="text-amber-400">NAZTECH BİLİŞİM</strong> — Karaköprü / Şanlıurfa</div>
    <div>Kurucu: <strong class="text-white">Muhammet Fatih Doğan</strong> | Tel / WA: <a href="tel:+905530341894" class="text-amber-400 font-semibold">0553 034 18 94</a></div>
  </div>
  <div class="w-full h-80 border-t border-zinc-800">
    <iframe title="NAZTECH Bilişim Karaköprü Şanlıurfa Canlı Konum" src="https://google.com/maps?q=Karak%C3%B6pr%C3%BC,%20%C5%9Eanl%C4%B1urfa&output=embed" class="w-full h-full border-0" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
  </div>
</footer>

<script>
(function () {
  var form = document.getElementById("naztechWorkOrderForm");
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var err = document.getElementById("nzFormError");
    var nameVal = (document.getElementById("nzFullName").value || "").trim();
    var phoneDigits = (document.getElementById("nzPhone").value || "").replace(/\D/g, "");
    var sysVal = document.getElementById("nzSystem").value;
    var noteVal = (document.getElementById("nzNote").value || "").trim() || "Belirtilmedi";

    if (nameVal.length < 3 || nameVal.indexOf(" ") === -1) {
      err.textContent = "Lütfen geçerli bir Ad ve Soyad giriniz.";
      return;
    }
    if (!/^(05\d{9}|5\d{9}|905\d{9})$/.test(phoneDigits)) {
      err.textContent = "Lütfen geçerli bir cep telefonu numarası giriniz (Örn: 05530341894).";
      return;
    }
    err.textContent = "";
    var orderNo = "NZT-" + String(Date.now()).slice(-6);
    var msg = "NAZTECH BİLİŞİM - KURUMSAL İŞ EMRİ (" + orderNo + ")\n"
      + "Ad-Soyad: " + nameVal + "\n"
      + "Telefon: " + phoneDigits + "\n"
      + "Sistem: " + sysVal + "\n"
      + "Not: " + noteVal + "\n"
      + "Konum: Karaköprü / Şanlıurfa";
    var waLink = "https://wa.me" + encodeURIComponent(msg);
    var mailLink = "mailto:info@://naztechbilisim.com" + encodeURIComponent("İş Emri " + orderNo + " - " + nameVal) + "&body=" + encodeURIComponent(msg);
    window.open(waLink, "_blank", "noopener,noreferrer");
    setTimeout(function () { window.location.href = mailLink; }, 350);
  });
})();
</script>
"""

assert '<div class="modal"' in html, "modal bulunamadi"
html = html.replace('<div class="modal"', form_and_map + '\n<div class="modal"', 1)
with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)
print("AJAN_2_HTML_OK")
