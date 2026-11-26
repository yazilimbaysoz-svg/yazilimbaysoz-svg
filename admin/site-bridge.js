(async function() {
  try {
    const DB_KEY = 'naztech_admin_db_v1';
    const getDB = () => JSON.parse(localStorage.getItem(DB_KEY) || '{"products":[],"quotes":[],"reviews":[],"settings":{}}');
    const setDB = (d) => localStorage.setItem(DB_KEY, JSON.stringify(d));

    let db = getDB();
    const fbUrl = (db.settings && db.settings.fbUrl) ? db.settings.fbUrl.replace(/\/$/, '') : '';

    // Bulut bağlantısı varsa en güncel duyuru ve verileri çek
    if (fbUrl) {
      try {
        const r = await fetch(`${fbUrl}/naztech.json`);
        if (r.ok) { const cloud = await r.json(); if (cloud) { db = { ...db, ...cloud }; setDB(db); } }
      } catch (e) {}
    }

    // 1. Üst Duyuru Bandı
    if (db.settings && db.settings.banner) {
      const bar = document.createElement('div');
      bar.style.cssText = 'background:linear-gradient(90deg,#0284c7,#0ea5e9);color:#fff;text-align:center;padding:9px 14px;font-size:14px;font-weight:600;position:relative;z-index:99999;letter-spacing:.3px;';
      bar.textContent = db.settings.banner;
      document.body.insertBefore(bar, document.body.firstChild);
    }

    // 2. Global Teklif & Yorum Kayıt Fonksiyonları (Hem Yerel Hem Bulut)
    window.naztechSaveQuote = async function(ad, tel, hizmet) {
      const current = getDB();
      const item = { tarih: new Date().toLocaleDateString('tr-TR'), ad: ad || 'Belirtilmedi', tel: tel || '-', hizmet: hizmet || 'Genel Teklif', durum: 'Yeni' };
      current.quotes.unshift(item);
      setDB(current);
      if (fbUrl) await fetch(`${fbUrl}/naztech/quotes.json`, { method: 'PUT', body: JSON.stringify(current.quotes) }).catch(() => {});
    };

    window.naztechSaveReview = async function(ad, yorum, puan) {
      const current = getDB();
      current.reviews.unshift({ ad: ad || 'Müşteri', yorum: yorum || '', puan: Number(puan) || 5, onay: false });
      setDB(current);
      if (fbUrl) await fetch(`${fbUrl}/naztech/reviews.json`, { method: 'PUT', body: JSON.stringify(current.reviews) }).catch(() => {});
    };

    // 3. Mevcut Site Formlarını Otomatik Dinleme
    document.addEventListener('submit', function(e) {
      const vals = Array.from(e.target.querySelectorAll('input, textarea, select')).map(i => i.value.trim()).filter(Boolean);
      if (vals.length >= 2) window.naztechSaveQuote(vals[0], vals[1], vals.slice(2).join(' - ') || 'Web Form Talebi');
    }, true);
  } catch (err) {
    console.warn('NazTech Bridge pasif:', err);
  }
})();

// 4. Canlı Site Görsel Metin Düzenleyici (Yalnızca Admin Modu Açıkken Aktif Olur)
window.addEventListener('DOMContentLoaded', () => {
  try {
    const edits = JSON.parse(localStorage.getItem('naztech_site_text_edits') || '{}');
    const nodes = Array.from(document.querySelectorAll('h1,h2,h3,h4,p,span,a,button,li'));
    nodes.forEach((el, idx) => {
      if (el.closest('#nzBox') || el.id === 'nzToggle') return;
      if (edits[idx] && el.children.length === 0) el.textContent = edits[idx];
      if (localStorage.getItem('naztech_live_edit_mode') === '1' && el.children.length === 0 && el.textContent.trim()) {
        el.contentEditable = true;
        el.style.outline = '1px dashed #38bdf866';
        el.addEventListener('blur', () => {
          const cur = JSON.parse(localStorage.getItem('naztech_site_text_edits') || '{}');
          cur[idx] = el.textContent;
          localStorage.setItem('naztech_site_text_edits', JSON.stringify(cur));
        });
      }
    });
  } catch {}
});
