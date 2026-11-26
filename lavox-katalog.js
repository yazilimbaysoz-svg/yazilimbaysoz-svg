(async function(){
  let data = [];
  try {
    const r = await fetch("lavox-katalog.json?v=" + Date.now());
    data = await r.json();
  } catch(e) { return; }
  if (!Array.isArray(data) || !data.length) return;

  // Ust menuye "Urun Katalogu" butonu ekle
  const teklifBtn = Array.from(document.querySelectorAll("header a, nav a, header button")).find(el => el.textContent && el.textContent.includes("Hızlı Teklif Al"));
  if (teklifBtn && !document.getElementById("openLavoxCatalogBtn")) {
    const btn = document.createElement("button");
    btn.id = "openLavoxCatalogBtn";
    btn.type = "button";
    btn.textContent = "Ürün Kataloğu";
    btn.style.cssText = "padding:8px 16px;border-radius:10px;border:1px solid rgba(25,167,184,.55);background:rgba(25,167,184,.12);color:#19A7B8;font-size:13px;font-weight:700;cursor:pointer;margin-right:10px;transition:all .2s;";
    btn.onmouseover = () => btn.style.background = "rgba(25,167,184,.24)";
    btn.onmouseout = () => btn.style.background = "rgba(25,167,184,.12)";
    teklifBtn.parentNode.insertBefore(btn, teklifBtn);
  }


  const heroCta = Array.from(document.querySelectorAll("main a, section:first-of-type a")).find(el => el.textContent && (el.textContent.includes("Çözümlerimizi") || el.textContent.includes("Hizmetler") || el.textContent.includes("İletişim")));
  if (heroCta && !document.getElementById("openLavoxHeroBtn")) {
    const hbtn = document.createElement("button");
    hbtn.id = "openLavoxHeroBtn";
    hbtn.type = "button";
    hbtn.textContent = "LAVOX Ürün Kataloğu";
    hbtn.style.cssText = "padding:14px 26px;border-radius:12px;border:1px solid rgba(25,167,184,.65);background:rgba(25,167,184,.15);color:#19A7B8;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s;";
    hbtn.onclick = () => { modal.style.display = "flex"; document.body.style.overflow = "hidden"; render(); };
    heroCta.parentNode.appendChild(hbtn);
  }

  // Tam ekran kurumsal katalog penceresi
  document.body.insertAdjacentHTML("beforeend", `
    <div id="lavoxCatalogModal" role="dialog" aria-modal="true" style="position:fixed;inset:0;background:rgba(4,6,10,.92);z-index:9997;display:none;flex-direction:column;backdrop-filter:blur(10px)">
      <div style="max-width:1280px;width:100%;margin:0 auto;padding:18px 20px;border-bottom:1px solid rgba(212,175,55,.25);display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px">
        <div>
          <span style="font-size:11px;font-weight:800;letter-spacing:.12em;color:#19A7B8">LAVOX ŞANLIURFA ANA BAYİ · RESMİ ÜRÜN KATALOĞU</span>
          <h2 style="margin:2px 0 0;font-size:1.35rem;font-weight:800;color:#fff">Stoklu Donanım &amp; Teknoloji Vitrini</h2>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex:1 1 320px;justify-content:flex-end">
          <input id="lvxSearchInput" type="search" placeholder="Model veya ürün ara (örn. kamera, NVR, barkod)..." style="flex:1;max-width:340px;padding:9px 14px;border-radius:10px;background:#0b0e14;border:1px solid rgba(212,175,55,.35);color:#fff;font-size:13px">
          <button id="closeLavoxCatalogBtn" type="button" style="padding:8px 14px;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:13px;font-weight:700;cursor:pointer">Kapat &times;</button>
        </div>
      </div>
      <div style="max-width:1280px;width:100%;margin:0 auto;padding:12px 20px 0">
        <div id="lvxTabs" style="display:flex;flex-wrap:wrap;gap:8px"></div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:16px 20px 32px">
        <div id="lvxGrid" style="max-width:1280px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px"></div>
      </div>
    </div>
  `);

  const modal = document.getElementById("lavoxCatalogModal");
  const tabsEl = document.getElementById("lvxTabs");
  const gridEl = document.getElementById("lvxGrid");
  const searchEl = document.getElementById("lvxSearchInput");
  const cats = ["Tümü", ...Array.from(new Set(data.map(x => x.cat)))];
  let currentCat = "Tümü";

  function render() {
    const q = (searchEl.value || "").toLowerCase().trim();
    tabsEl.innerHTML = cats.map(c => `<button type="button" data-lvx-cat="${c}" style="padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid ${c===currentCat?'#D4AF37':'rgba(212,175,55,.28)'};background:${c===currentCat?'#D4AF37':'#0b0e14'};color:${c===currentCat?'#080a0f':'#e5e7eb'}">${c}</button>`).join("");
    const list = data.filter(x => (currentCat === "Tümü" || x.cat === currentCat) && (!q || x.title.toLowerCase().includes(q) || x.cat.toLowerCase().includes(q)));
    gridEl.innerHTML = list.length ? list.map(item => {
      const wa = "https://wa.me" + encodeURIComponent("Merhaba NAZTECH BİLİŞİM / LAVOX Şanlıurfa Ana Bayi, şu ürün için teklif almak istiyorum: " + item.title);
      return `<div style="background:#0b0e14;border:1px solid rgba(212,175,55,.25);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <div style="position:relative;aspect-ratio:16/10;background:#fff;overflow:hidden">
            <img src="${item.img}" alt="${item.title}" loading="lazy" style="width:100%;height:100%;object-fit:contain;padding:10px">
            <span style="position:absolute;top:8px;left:8px;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:800;background:#0b0e14;color:#19A7B8">LAVOX</span>
            <span style="position:absolute;top:8px;right:8px;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:600;background:rgba(11,14,20,.88);color:#D4AF37">${item.cat}</span>
          </div>
          <div style="padding:12px 14px 6px;font-size:13px;font-weight:700;color:#f9fafb;line-height:1.45">${item.title}</div>
        </div>
        <div style="padding:8px 14px 14px;display:flex;gap:8px">
          <a href="${wa}" target="_blank" rel="noopener noreferrer" style="flex:1;text-align:center;padding:8px;border-radius:8px;background:#D4AF37;color:#080a0f;font-size:12px;font-weight:800;text-decoration:none">WhatsApp Teklif</a>
          <a href="${item.url}" target="_blank" rel="noopener noreferrer" style="padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(212,175,55,.3);color:#D4AF37;font-size:12px;font-weight:700;text-decoration:none">Detay ↗</a>
        </div>
      </div>`;
    }).join("") : '<p style="color:#9ca3af;grid-column:1/-1;text-align:center;padding:40px">Aramanıza uygun ürün bulunamadı.</p>';
  }

  document.addEventListener("click", e => {
    if (e.target.id === "openLavoxCatalogBtn") { modal.style.display = "flex"; document.body.style.overflow = "hidden"; render(); }
    if (e.target.id === "closeLavoxCatalogBtn" || e.target === modal) { modal.style.display = "none"; document.body.style.overflow = ""; }
    const tab = e.target.closest("[data-lvx-cat]");
    if (tab) { currentCat = tab.dataset.lvxCat; render(); }
  });
  searchEl.addEventListener("input", render);
})();
