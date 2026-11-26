# NAZTECH Bilişim — Yönetici Kılavuzu

Baysöz Yazılım · baysozlabs@proton.me

Bu kılavuz, `naztech-bilisim` klasöründeki tanıtım sitesini teknik bilgi gerektirmeden güncellemek için kullanılır. Tüm dosyalar proje klasörünün içinde göreli yollarla gösterilmiştir.

## 1. Hızlı başlatma

Proje klasöründe terminal açın ve şunu çalıştırın:

```bash
python3 -m http.server 8787
```

Tarayıcıdan `http://127.0.0.1:8787` adresini açın. Dosyaları doğrudan çift tıklayarak açmayın; 3D görüntüleyici ve bağlantılar HTTP üzerinden çalışır.

## 2. Metinleri değiştirme

| Değiştirmek istediğiniz şey | Dosya | Ne aramanız gerekiyor |
| --- | --- | --- |
| Ana sayfa başlığı ve açıklama | `index.html` | `NAZTECH`, `ENERGY - TEKNOLOGY - SOFTWARE` |
| Hizmet kartlarının başlık/açıklamaları | `index.html` | `data-catalog="1"` … `data-catalog="8"` |
| Katalog penceresindeki uzun açıklamalar | `hizmet-detay.js` | `catalogs` listesi içindeki `title`, `description`, `specs` alanları |
| İletişim bilgileri | `index.html` | `AHMET BARIŞ FENER`, `Tel:`, `E-Posta:`, `Adres:` |
| İndirme merkezi metinleri | `index.html` | `id="indirme-merkezi"` bölümü |

Metinleri değiştirdikten sonra özel karakterleri (<, >, &) HTML içinde `&lt;`, `&gt;`, `&amp;` olarak yazın.

## 3. Telefon ve WhatsApp numarasını değiştirme

1. `index.html` içinde `tel:+905013731859` ve `https://wa.me/905013731859` ifadelerini arayın.
2. `hizmet-detay.js` içinde `WHATSAPP_NUMBER` sabitini yeni numarayla (ülke kodu dahil, `+` olmadan) güncelleyin.
3. `index.html` içindeki `data-whatsapp-greeting` bağlantılarındaki `text=` parametresini isterseniz değiştirin.

## 4. Görselleri değiştirme

- Ürün/katalog fotoğrafları `img/` klasöründedir. `hizmet-detay.js` içindeki `photos` dizilerindeki dosya adlarını yeni görselle değiştirin.
- N2MOBİL ve Lavox kurumsal logoları `img/n2mobil_logo.svg`, `img/lavox_logo.svg` ve PNG karşılıklarıdır.
- Sponsor şeridindeki logolar `index.html` içinde `partner-marquee__svg` sınıfıyla gömülü SVG olarak yer alır. Marka görselini değiştirecekseniz SVG'nin `viewBox` değerini koruyun.
- Yeni görsel ekledikten sonra dosya adının büyük/küçük harflerine dikkat edin; sunucu dosya adlarına duyarlıdır.

## 5. Katalogları düzenleme

Sekiz hizmet kartı `index.html` içinde `data-catalog="1"` … `"8"` sırasıyla tanımlıdır. Bir kart eklemek veya çıkarmak için:

1. `index.html` içinde ilgili `data-catalog` kartını düzenleyin.
2. `hizmet-detay.js` içindeki `catalogs` kaydında aynı `id` değerini koruyun; `badge`, `title`, `description`, `specs` ve `photos` alanlarını güncelleyin.
3. `webgl-3d-viewer.js` içinde `catalog id` eşlemesini kontrol edin; 1–8 arası her kimlik için bir 3D modeli tanımı bulunmalıdır.

Kart tıklandığında `naztechModal` açılır; 3D model, fotoğraflar ve teknik özellikler aynı pencerede gösterilir. Fare ile sürükleyerek 360° döndürme, tekerlek veya `+` / `−` düğmeleriyle yakınlaştırma yapılır.

## 6. Sponsor şeridi

`index.html` içindeki `class="partner-marquee"` bölümü HIKVISION, N2MOBİL ve LAVOX ELEKTRONİK'i gösterir. Şerit soldan sağa sonsuz döner; `style.css` içindeki `@keyframes nzt-marquee` hızı belirler (varsayılan `28s`). N2MOBİL kartındaki `data-partner-showcase="5"` düğmesi Katalog 5'i doğrudan açar.

## 7. Resmi İndirme Merkezi

`index.html` içindeki `id="indirme-merkezi"` bölümü Android, Windows ve Linux kartlarını içerir. Her `data-download-trigger` düğmesinin `data-download-url` özelliği resmî kaynak adresidir. Adres değiştirilecekse yalnızca `https://` ile başlayan üretici/mağaza bağlantıları kullanın.

İndirme düğmesine basıldığında `security-shield.js`, `id="downloadScanModal"` penceresinde 1,5 saniyelik altın devre taraması çalıştırır ve ardından bağlantıyı yeni sekmede açar. Süreyi değiştirmek için `security-shield.js` içindeki `SCAN_DURATION_MS` sabitini ve `style.css` içindeki `nztScanSweep` / `nztScanProgress` animasyon sürelerini birlikte güncelleyin.

## 8. Güvenlik katmanı

`security-shield.js` şunları engeller: sağ tık, `F12`, `Ctrl+Shift+I`, `Ctrl+U`, `Ctrl+S` ve görsellerin sürüklenmesi. Ayrıca sayfa yüklenirken HTML yorum düğümleri arasında makine/yapay zekâ imzası taşıyanları temizler. Bu koruma yalnızca caydırıcıdır; sunucu tarafı güvenliğin yerine geçmez.

## 9. Hata ayıklama ve doğrulama

```bash
node --check hizmet-detay.js
node --check tezweb-3d.js
node --check webgl-3d-viewer.js
node --check security-shield.js
node tests/run_verification.mjs
node tests/run_3d_verification.mjs
node tests/run_shield_verification.mjs
```

Her test 100 tur çalıştırır ve `artifacts/` klasörüne sonuç kaydeder. `KANIT_RAPORU.md` son doğrulama kanıtlarını içerir. Bir test başarısız olursa ilgili dosyayı düzeltin ve testi baştan çalıştırın.

## 10. Yayın öncesi kontrol listesi

- [ ] Telefon, e-posta ve adres güncel.
- [ ] Sekiz katalog kartı ve `hizmet-detay.js` kayıtları eşleşiyor.
- [ ] Yeni görseller `img/` içinde ve yollar doğru.
- [ ] İndirme bağlantıları resmî `https://` adreslerini gösteriyor.
- [ ] Tüm doğrulama komutları `100/100 PASS` veriyor.
- [ ] Sayfa `http://127.0.0.1:8787` üzerinden sorunsuz açılıyor.

Baysöz Yazılım · baysozlabs@proton.me
