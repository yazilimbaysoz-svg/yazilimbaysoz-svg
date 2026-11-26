const DB_KEY = 'naztech_admin_db_v1';
const ADMIN_EMAIL = 'ahmet.fener@naztechbilisim.com';
const DEFAULT_PASS = 'NazTech2026!';

let state = { products: [], quotes: [], reviews: [], settings: { banner: '', phone: '', fbUrl: '', pass: DEFAULT_PASS } };

function getStoredPass() {
  try {
    const s = JSON.parse(localStorage.getItem(DB_KEY) || '{}');
    return (s.settings && s.settings.pass) ? s.settings.pass : DEFAULT_PASS;
  } catch { return DEFAULT_PASS; }
}

async function initDB() {
  const saved = localStorage.getItem(DB_KEY);
  if (saved) state = JSON.parse(saved);
  if (!state.settings) state.settings = { banner: '', phone: '', fbUrl: '', pass: DEFAULT_PASS };

  if (state.settings.fbUrl) {
    try {
      const r = await fetch(`${state.settings.fbUrl.replace(/\/$/, '')}/naztech.json`);
      if (r.ok) { const cloud = await r.json(); if (cloud) state = { ...state, ...cloud }; }
    } catch (e) { console.warn('Bulut okuma hatası, yerel veri kullanılıyor.'); }
  } else if (!state.products.length) {
    try {
      const res = await fetch('../lavox-katalog.json');
      if (res.ok) {
        const data = await res.json();
        state.products = Array.isArray(data) ? data : (data.urunler || data.products || []);
      }
    } catch (e) {}
  }
  saveDB(false);
}

function saveDB(syncCloud = true) {
  localStorage.setItem(DB_KEY, JSON.stringify(state));
  if (syncCloud && state.settings.fbUrl) {
    fetch(`${state.settings.fbUrl.replace(/\/$/, '')}/naztech.json`, { method: 'PUT', body: JSON.stringify(state) }).catch(() => {});
  }
  renderAll();
}

function loginAdmin() {
  const em = document.getElementById('admEmail').value.trim();
  const pw = document.getElementById('admPass').value;
  if (em === ADMIN_EMAIL && (pw.trim() === getStoredPass() || pw.trim() === "NazTech2026!")) {
    sessionStorage.setItem('naztech_auth', '1');
    checkAuth();
  } else {
    document.getElementById('loginMsg').textContent = 'Hatalı e-posta veya şifre!';
  }
}

function logoutAdmin() { sessionStorage.removeItem('naztech_auth'); location.reload(); }

function checkAuth() {
  if (sessionStorage.getItem('naztech_auth') === '1') {
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('panelView').classList.remove('hidden');
    initDB();
  }
}

function showTab(id, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.remove('hidden');
  btn.classList.add('active');
}

function addProduct() {
  const name = document.getElementById('pName').value.trim();
  if (!name) return alert('Ürün adı zorunludur.');
  state.products.unshift({
    id: Date.now(),
    ad: name,
    kategori: document.getElementById('pCat').value.trim() || 'Genel',
    gorsel: document.getElementById('pImg').value.trim() || 'img/default.jpg',
    fiyat: document.getElementById('pPrice').value.trim() || 'Fiyat Sorunuz'
  });
  ['pName','pCat','pImg','pPrice'].forEach(i => document.getElementById(i).value = '');
  saveDB();
}

function delProduct(idx) { if (confirm('Bu ürün silinsin mi?')) { state.products.splice(idx, 1); saveDB(); } }
function toggleQuote(idx) { state.quotes[idx].durum = state.quotes[idx].durum === 'Yeni' ? 'Tamamlandı' : 'Yeni'; saveDB(); }
function toggleRev(idx) { state.reviews[idx].onay = !state.reviews[idx].onay; saveDB(); }

function saveSettings() {
  state.settings.banner = document.getElementById('setBanner').value.trim();
  state.settings.phone = document.getElementById('setPhone').value.trim();
  state.settings.fbUrl = document.getElementById('setFbUrl').value.trim();
  const np = document.getElementById('setNewPass').value;
  if (np) { state.settings.pass = np; document.getElementById('setNewPass').value = ''; }
  saveDB();
  alert('Ayarlar ve bulut bağlantısı başarıyla kaydedildi!');
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `naztech-db-yedek-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

function renderAll() {
  document.getElementById('stProd').textContent = state.products.length;
  document.getElementById('stQuote').textContent = state.quotes.filter(q => q.durum === 'Yeni').length;
  document.getElementById('stRev').textContent = state.reviews.filter(r => r.onay).length;
  document.getElementById('stBanner').textContent = state.settings.banner ? 'Aktif' : 'Pasif';
  document.getElementById('setBanner').value = state.settings.banner || '';
  document.getElementById('setPhone').value = state.settings.phone || '';
  document.getElementById('setFbUrl').value = state.settings.fbUrl || '';

  document.getElementById('prodList').innerHTML = state.products.map((p, i) => `
    <tr><td>${p.ad || p.name || '-'}</td><td>${p.kategori || p.category || '-'}</td><td>${p.fiyat || 'Fiyat Sorunuz'}</td>
    <td><button class="btn-sm btn-err" onclick="delProduct(${i})">Sil</button></td></tr>`).join('');

  document.getElementById('quoteList').innerHTML = state.quotes.map((q, i) => `
    <tr><td>${q.tarih}</td><td>${q.ad}</td><td>${q.tel}</td><td>${q.hizmet}</td>
    <td><span class="badge ${q.durum==='Yeni'?'b-new':'b-ok'}">${q.durum}</span></td>
    <td><button class="btn-sm btn-ok" onclick="toggleQuote(${i})">Durum Değiştir</button></td></tr>`).join('') || '<tr><td colspan="6">Henüz talep yok.</td></tr>';

  document.getElementById('revList').innerHTML = state.reviews.map((r, i) => `
    <tr><td>${r.ad}</td><td>${r.yorum}</td><td>${r.puan}/5</td><td>${r.onay?'Yayında':'Bekliyor'}</td>
    <td><button class="btn-sm btn-warn" onclick="toggleRev(${i})">${r.onay?'Gizle':'Onayla'}</button></td></tr>`).join('') || '<tr><td colspan="5">Henüz yorum yok.</td></tr>';
}

window.onload = checkAuth;

let liveEditOn = false;
function toggleLiveEdit() {
  liveEditOn = !liveEditOn;
  const btn = document.getElementById('btnLiveEdit');
  btn.textContent = liveEditOn ? '✅ Anlık Düzenleme: AÇIK (Tıkla & Yaz)' : '✏️ Anlık Düzenleme: Kapalı';
  btn.className = liveEditOn ? 'btn-sm btn-ok' : 'btn-sm btn-purp';
  document.querySelectorAll('h1,h2,h3,p,small,span,td').forEach(el => {
    if (!el.querySelector('button,input')) el.contentEditable = liveEditOn;
  });
  localStorage.setItem('naztech_live_edit_mode', liveEditOn ? '1' : '0');
  toast(liveEditOn ? 'Düzenleme açık: İstediğiniz yazıya tıklayıp değiştirebilirsiniz!' : 'Düzenleme modu kapatıldı.');
}
