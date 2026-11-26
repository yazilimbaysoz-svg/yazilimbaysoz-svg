/*
 * Baysöz Yazılım — NAZTECH Bilişim catalog controller.
 * Classic script: no modules, no globals other than the frozen test surface.
 * All DOM construction uses createElement, textContent and replaceChildren.
 */
(function () {
  "use strict";

  var WHATSAPP_NUMBER = "905530341894";
  var CATALOG_ID_PATTERN = /^[1-8]$/;
  var GREETING_TEXT =
    "Merhaba Naztech Bilişim, hizmetleriniz hakkında bilgi almak ve ücretsiz keşif/teklif talebi oluşturmak istiyorum. Görüşme talebimi iletir misiniz?";
  var EVENT_OPEN = "naztech:catalog-open";
  var EVENT_CLOSE = "naztech:catalog-close";

  function emitCatalogEvent(doc, type, detail) {
    try {
      if (
        typeof window === "undefined" ||
        !window ||
        typeof window.CustomEvent !== "function" ||
        !doc ||
        typeof doc.dispatchEvent !== "function"
      ) {
        return;
      }
      doc.dispatchEvent(new window.CustomEvent(type, { detail: detail }));
    } catch (_error) {
      return;
    }
  }

  function freezeCatalog(value) {
    value.photos.forEach(function (photo) {
      Object.freeze(photo);
    });
    Object.freeze(value.photos);
    Object.freeze(value.specs);
    return Object.freeze(value);
  }

  function photo(path, caption, credit, license, licenseUrl) {
    return Object.freeze({
      path: path,
      caption: caption,
      credit: credit,
      license: license,
      licenseUrl: licenseUrl
    });
  }

  var catalogs = Object.freeze(
    new Map([
      [
        "1",
        freezeCatalog({
          id: "1",
          title: "HIKVISION Güvenlik Sistemleri",
          badge: "HIKVISION SPONSORLU",
          sponsor: true,
          sponsorAccent: "hikvision-red",
          sponsorBannerLogo: "HIKVISION",
          sponsorBannerText: "Resmî Partner & Sponsor",
          description:
            "Naztech Bilişim, HIKVISION resmî çözüm ortağı olarak kurumsal güvenlik kamerası altyapılarını uçtan uca tasarlar ve kurar. ColorVu düşük ışıkta tam renkli gece görüşü, AcuSense insan ve araç sınıflandırması ile ANPR plaka tanıma teknolojilerini tek bir mimaride birleştiririz. NVR kayıt cihazları ve Hik-Connect uzaktan erişim sayesinde tesisiniz 7/24 izlenebilir, kayıtlar güvenle saklanır.",
          photos: [
            photo("img/hikvision_bullet.jpg", "Dış mekân bullet güvenlik kamerası", "NAZTECH Bilişim", "2026–2027 Kurumsal Çözüm", "#iletisim"),
            photo("img/hikvision_dome.jpg", "İç mekân dome güvenlik kamerası", "NAZTECH Bilişim", "2026–2027 Kurumsal Çözüm", "#iletisim"),
            photo("img/hikvision_nvr.jpg", "Ağ kayıt cihazı ve izleme merkezi", "NAZTECH Bilişim", "2026–2027 Kurumsal Çözüm", "#iletisim")
          ],
          specs: [
            "ColorVu düşük ışıkta 7/24 tam renkli gece görüşü ve Ultra HD görüntü kalitesi",
            "AcuSense yapay zekâ ile insan, araç ve plaka (ANPR) sınıflandırması",
            "NVR ağ kayıt cihazları ile kesintisiz kayıt ve Hik-Connect mobil uzaktan erişim",
            "IP67 derecesinde dış mekân koruması ve geniş dinamik aralık (WDR)",
            "Otopark bariyeri, turnike ve erişim kontrol sistemleriyle entegrasyon"
          ]
        })
      ],
      [
        "2",
        freezeCatalog({
          id: "2",
          title: "Hırsız Alarm Sistemleri",
          badge: "NAZTECH BİLİŞİM UZMANLIK ALANI",
          sponsor: false,
          sponsorAccent: "",
          sponsorBannerLogo: "",
          sponsorBannerText: "",
          description:
            "İş yeri, fabrika ve konutlar için izinsiz girişi anında algılayan akıllı hırsız alarm sistemleri kuruyoruz. Kablosuz PIR hareket dedektörleri, manyetik kapı-pencere kontakları, cam kırılma sensörleri ve yüksek desibelli sirenler tek bir panelde yönetilir. Elektrik kesintilerinde devreye giren yedek akü ve mobil bildirim altyapısı ile güvenliğiniz süreklilik kazanır.",
          photos: [photo("img/alarm.png", "Akıllı hareket sensörlü hırsız alarm sistemi", "NAZTECH Bilişim", "2026–2027 Kurumsal Çözüm", "#iletisim")],
          specs: [
            "Kablolu ve kablosuz hibrit alarm panelleri ile uzaktan kontrol",
            "PIR hareket, kapı-pencere ve cam kırılma dedektörleri",
            "Anlık SMS, mobil uygulama ve çağrı merkezi bildirimi",
            "Elektrik kesintisine karşı yedek akü ve sabotaj koruması",
            "Mevcut kamera ve erişim kontrol sistemleriyle entegrasyon"
          ]
        })
      ],
      [
        "3",
        freezeCatalog({
          id: "3",
          title: "Bilişim ve Ağ Altyapısı",
          badge: "NAZTECH BİLİŞİM UZMANLIK ALANI",
          sponsor: false,
          sponsorAccent: "",
          sponsorBannerLogo: "",
          sponsorBannerText: "",
          description:
            "Kurumsal ağ altyapınızı sunucu odasından son kullanıcı noktasına kadar planlıyor ve hayata geçiriyoruz. Fiber optik yapısal kablolama, rack kabinet kurulumu, yönetilebilir switch ve güvenlik duvarı yapılandırması ile kesintisiz bağlantı sağlıyoruz. Düzenli bakım, yedekleme ve yerinde teknik destek hizmetleriyle sistemlerinizin performansını koruyoruz.",
          photos: [photo("img/bilisim.jpg", "Kurumsal sunucu ve fiber ağ altyapısı", "NAZTECH Bilişim", "2026–2027 Kurumsal Çözüm", "#iletisim")],
          specs: [
            "Fiber optik yapısal kablolama ve kategori 6/6A veri hatları",
            "Rack kabinet, sunucu, NAS ve sanallaştırma altyapısı",
            "Yönetilebilir switch, güvenlik duvarı ve kurumsal Wi-Fi",
            "Veri yedekleme, felaket kurtarma ve periyodik bakım",
            "Yerinde teknik destek ve hızlı müdahale hizmeti"
          ]
        })
      ],
      [
        "4",
        freezeCatalog({
          id: "4",
          title: "Yakıt Otomasyonu",
          badge: "NAZTECH BİLİŞİM UZMANLIK ALANI",
          sponsor: false,
          sponsorAccent: "",
          sponsorBannerLogo: "",
          sponsorBannerText: "",
          description:
            "Akaryakıt istasyonları ve kurumsal filolar için yakıt otomasyon çözümleri sunuyoruz. Pompa kontrol üniteleri, elektronik tank seviye ölçüm sensörleri ve araç tanıma sistemleri sayesinde dolum süreçleri şeffaf hale gelir. Anlık stok, tüketim ve kaçak analiz raporları operasyonel kararlarınızı hızlandırır.",
          photos: [photo("img/yakit.jpg", "Akaryakıt pompası ve yakıt otomasyon sistemi", "NAZTECH Bilişim", "2026–2027 Kurumsal Çözüm", "#iletisim")],
    specs: [
            "Pompa ve tank seviye ölçüm otomasyonu ile anlık stok takibi",
            "Araç tanıma sistemi (TTS) ve RFID yetkilendirme ile kaçak önleme",
            "Filo bazlı yakıt tüketimi, rota ve maliyet raporlaması",
            "Muhasebe ve ERP sistemleriyle entegre dijital kayıt akışı",
            "Uzaktan izleme, eşik alarmı ve mobil bildirim desteği"
          ]
        })
      ],
      [
        "5",
        freezeCatalog({
          id: "5",
          title: "Araç Takip Sistemleri",
          badge: "N2MOBİL · YETKİLİ BAYİ & FİLO ÇÖZÜMLERİ",
          sponsor: false,
          sponsorAccent: "",
          sponsorBannerLogo: "",
          sponsorBannerText: "",
          description:
            "N2MOBİL yetkili bayisi olarak kurumsal filolara GPS ve filo takip çözümleri sunuyoruz. N2MOBİL cihazları ve yönetim paneliyle araçlarınızın canlı konumu, hızı, rotası, kontak durumu ve yakıt tüketimi tek ekranda izlenir; bölge ihlali, hız aşımı ve rölanti uyarıları anında bildirilir. Yetkili bayi desteğimizle cihaz kurulumu, bakım hatırlatmaları, sürücü performans raporları ve 7/24 teknik servis uçtan uca yönetilir.",
          photos: [photo("img/arac_takip.jpg", "N2MOBİL GPS & filo yönetimi gösterimi", "NAZTECH Bilişim", "2026–2027 Kurumsal Çözüm", "#iletisim")],
    specs: [
            "N2MOBİL GPS cihazlarıyla 7/24 canlı konum, hız ve geçmiş rota izleme",
            "Harita üzerinde araç durumu, kontak, rölanti ve uzaktan motor blokaj kontrolü",
            "N2MOBİL mobil uygulama ve web paneliyle anlık konum ve olay bildirimleri",
            "Geofence bölge ihlali, hız aşımı ve uzun duraklama alarmı",
            "Yakıt tüketimi, sürücü davranışı ve bakım hatırlatma raporları",
            "Filo bazlı maliyet, rota verimliliği ve PDF/Excel dışa aktarım",
            "Yetkili bayi desteğiyle kurulum, cihaz değişimi ve 7/24 teknik servis"
          ]
        })
      ],
      [
        "6",
        freezeCatalog({
          id: "6",
          title: "Yazılım",
          badge: "NAZTECH BİLİŞİM UZMANLIK ALANI",
          sponsor: false,
          sponsorAccent: "",
          sponsorBannerLogo: "",
          sponsorBannerText: "",
          description:
            "İşletmenize özel yazılımlar tasarlayıp geliştirerek manuel süreçleri dijitalleştiriyoruz. ERP, stok, cari takip ve saha otomasyonu uygulamaları mevcut donanımlarınızla sorunsuz çalışır. Web ve mobil arayüzler, bulut altyapısı ve düzenli güncellemelerle çözümleriniz uzun vadede sürdürülebilir kalır.",
          photos: [photo("img/yazilim.jpg", "Kurumsal yazılım ve otomasyon arayüzü", "NAZTECH Bilişim", "2026–2027 Kurumsal Çözüm", "#iletisim")],
    specs: [
            "İşletmeye özel ERP, stok, cari ve sipariş yönetimi yazılımları",
            "Web ve mobil uygulama geliştirme, kullanıcı bazlı yetkilendirme",
            "Barkod, terazi, kamera ve bariyer cihaz entegrasyonları",
            "Bulut barındırma, yedekleme ve veri güvenliği önlemleri",
            "Sürekli bakım, hata giderme ve sürüm güncellemeleri"
          ]
        })
      ],
      [
        "7",
        freezeCatalog({
          id: "7",
          title: "Yangın İhbar Sistemleri",
          badge: "NAZTECH BİLİŞİM UZMANLIK ALANI",
          sponsor: false,
          sponsorAccent: "",
          sponsorBannerLogo: "",
          sponsorBannerText: "",
          description:
            "Binaların Yangından Korunması Hakkında Yönetmeliğe uyumlu yangın ihbar sistemleri tasarlıyoruz. Adresli ve konvansiyonel paneller, optik duman, ısı ve gaz dedektörleri yangını erken aşamada algılar. Acil anons, itfaiye bildirimi ve kaçış aydınlatması entegrasyonlarıyla bina güvenliği bütüncül biçimde yönetilir.",
          photos: [photo("img/yangin.jpg", "Yangın ihbar paneli ve duman dedektörü", "NAZTECH Bilişim", "2026–2027 Kurumsal Çözüm", "#iletisim")],
    specs: [
            "Adresli ve konvansiyonel yangın kontrol panelleri",
            "Optik duman, ısı artışı ve gaz kaçağı dedektörleri",
            "Manuel yangın butonu, siren ve acil anons entegrasyonu",
            "İtfaiye bildirim hattı ve kaçış aydınlatma sistemleri",
            "Periyodik test, bakım ve yönetmelik uyumluluk raporları"
          ]
        })
      ],
      [
        "8",
        freezeCatalog({
          id: "8",
          title: "Elektrik",
          badge: "NAZTECH BİLİŞİM UZMANLIK ALANI",
          sponsor: false,
          sponsorAccent: "",
          sponsorBannerLogo: "",
          sponsorBannerText: "",
          description:
            "Endüstriyel tesisler, ticari yapılar ve akıllı binalar için elektrik altyapısı hizmeti veriyoruz. Alçak ve orta gerilim panoları, kompanzasyon, topraklama ve paratoner uygulamaları uzman ekiplerimizce kurulur. UPS ve jeneratör çözümleriyle enerji sürekliliği sağlanır, LED aydınlatma yatırımlarıyla işletme maliyetleri düşürülür.",
          photos: [photo("img/elektrik.jpg", "Endüstriyel elektrik pano ve enerji altyapısı", "NAZTECH Bilişim", "2026–2027 Kurumsal Çözüm", "#iletisim")],
    specs: [
            "Alçak ve orta gerilim pano imalatı, montajı ve kompanzasyon",
            "Topraklama, paratoner ve yıldırımdan korunma sistemleri",
            "UPS ve jeneratör ile kesintisiz enerji altyapısı",
            "LED aydınlatma, kablolama ve enerji verimliliği uygulamaları",
            "Enerji ölçümü, arıza tespiti ve periyodik bakım hizmetleri"
          ]
        })
      ]
    ])
  );

  function normalizeCatalogId(raw) {
    if (typeof raw !== "string") {
      return null;
    }
    var value = raw.trim();
    return CATALOG_ID_PATTERN.test(value) ? value : null;
  }

  function getCatalog(raw) {
    var id = normalizeCatalogId(raw);
    if (id === null) {
      return null;
    }
    return catalogs.get(id) || null;
  }

  function buildQuoteMessage(catalog) {
    var title = catalog && typeof catalog.title === "string" ? catalog.title : "Hizmetlerimiz";
    return (
      "Merhaba Naztech Bilişim, " +
      title +
      " hakkında detaylı katalog bilgisi, ücretsiz keşif ve teklif almak istiyorum. Talebimi değerlendirip benimle iletişime geçebilir misiniz?"
    );
  }

  function buildWhatsAppUrl(message) {
    return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(message);
  }

  function buildQuoteUrl(catalog) {
    return buildWhatsAppUrl(buildQuoteMessage(catalog));
  }

  function buildGreetingUrl() {
    return buildWhatsAppUrl(GREETING_TEXT);
  }

  function elementById(doc, id) {
    if (!doc || typeof doc.getElementById !== "function") {
      return null;
    }
    return doc.getElementById(id);
  }

  function setText(node, value) {
    if (node && typeof value === "string") {
      node.textContent = value;
    }
  }

  function forEachCard(cards, callback) {
    if (!cards || typeof cards.length !== "number") {
      return;
    }
    for (var index = 0; index < cards.length; index += 1) {
      if (cards[index]) {
        callback(cards[index]);
      }
    }
  }

  function createModalController(root, doc) {
    var documentRef = doc || (typeof document !== "undefined" ? document : null);

    if (!root || !documentRef) {
      return Object.freeze({
        open: function () {
          return false;
        },
        close: function () {
          return false;
        },
        isOpen: function () {
          return false;
        },
        destroy: function () {
          return true;
        }
      });
    }

    var refs = {
      panel: elementById(documentRef, "modalBox"),
      closeButton: elementById(documentRef, "closeModal"),
      gallery: elementById(documentRef, "modalGallery"),
      badge: elementById(documentRef, "modalBadge"),
      title: elementById(documentRef, "modalTitle"),
      description: elementById(documentRef, "modalDescription"),
      specs: elementById(documentRef, "modalSpecs"),
      whatsapp: elementById(documentRef, "modalWhatsApp"),
      banner: elementById(documentRef, "mBanner")
    };

    var isOpen = false;
    var isDestroyed = false;
    var previouslyFocused = null;
    var activeId = null;

    function focusableNodes() {
      if (!refs.panel || typeof refs.panel.querySelectorAll !== "function") {
        return [];
      }
      var matches = refs.panel.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      var result = [];
      for (var index = 0; index < matches.length; index += 1) {
        if (!matches[index].hasAttribute("hidden")) {
          result.push(matches[index]);
        }
      }
      return result;
    }

    function focusInsidePanel(node) {
      return !!(
        refs.panel &&
        node &&
        typeof refs.panel.contains === "function" &&
        refs.panel.contains(node)
      );
    }

    function buildFigure(photoData) {
      var figure = documentRef.createElement("figure");
      figure.className = "modal__figure";
      figure.setAttribute("aria-label", photoData.caption + " - kurumsal donanım görseli");

      var image = documentRef.createElement("img");
      image.src = photoData.path;
      image.alt = photoData.caption;
      image.loading = "lazy";
      image.decoding = "async";
      figure.appendChild(image);

      var caption = documentRef.createElement("figcaption");
      caption.className = "modal__caption";

      var headline = documentRef.createElement("span");
      headline.className = "modal__caption-title";
      headline.textContent = photoData.caption;
      caption.appendChild(headline);

      var attribution = documentRef.createElement("span");
      attribution.className = "modal__credit";
      attribution.appendChild(documentRef.createTextNode(photoData.credit + " · "));

      var licenseLink = documentRef.createElement("a");
      licenseLink.href = photoData.licenseUrl;
      licenseLink.textContent = photoData.license;
      licenseLink.target = "_blank";
      licenseLink.rel = "noopener noreferrer";
      attribution.appendChild(licenseLink);
      caption.appendChild(attribution);

      figure.appendChild(caption);
      return figure;
    }

    function renderGallery(photos) {
      if (!refs.gallery || typeof refs.gallery.replaceChildren !== "function") {
        return;
      }
      var figures = [];
      for (var index = 0; index < photos.length; index += 1) {
        figures.push(buildFigure(photos[index]));
      }
      refs.gallery.replaceChildren.apply(refs.gallery, figures);
    }

    function renderSpecs(specs) {
      if (!refs.specs || typeof refs.specs.replaceChildren !== "function") {
        return;
      }
      var items = [];
      for (var index = 0; index < specs.length; index += 1) {
        var item = documentRef.createElement("li");
        item.className = "modal__spec";
        item.textContent = specs[index];
        items.push(item);
      }
      refs.specs.replaceChildren.apply(refs.specs, items);
    }

    function renderBanner(catalog) {
      if (!refs.banner) {
        return;
      }
      refs.banner.hidden = !catalog.sponsor;
      if (!catalog.sponsor) {
        return;
      }
      setText(refs.banner.querySelector(".sponsor-banner__logo"), catalog.sponsorBannerLogo);
      setText(refs.banner.querySelector(".sponsor-banner__text"), catalog.sponsorBannerText);
    }

    function open(rawId) {
      if (isDestroyed) {
        return false;
      }
      var catalog = getCatalog(rawId);
      if (!catalog) {
        return false;
      }

      previouslyFocused = documentRef.activeElement || null;

      setText(refs.badge, catalog.badge);
      setText(refs.title, catalog.title);
      setText(refs.description, catalog.description);
      renderGallery(catalog.photos);
      renderSpecs(catalog.specs);
      renderBanner(catalog);

      root.classList.toggle("modal--sponsor", !!catalog.sponsor);
      if (refs.whatsapp) {
        refs.whatsapp.href = buildQuoteUrl(catalog);
      }

      root.hidden = false; root.classList.remove("hidden"); root.style.display = "flex";
      root.setAttribute("aria-hidden", "false");
      if (documentRef.body && documentRef.body.classList) {
        documentRef.body.classList.add("is-modal-open");
      }
      isOpen = true;
      activeId = catalog.id;
      emitCatalogEvent(documentRef, EVENT_OPEN, { id: catalog.id, catalog: catalog });

      var initialFocus = refs.closeButton || focusableNodes()[0] || null;
      if (initialFocus && typeof initialFocus.focus === "function") {
        initialFocus.focus();
      }
      return true;
    }

    function close() {
      if (isDestroyed || !isOpen) {
        return false;
      }
      root.hidden = true; root.classList.add("hidden"); root.style.display = "none";
      root.setAttribute("aria-hidden", "true");
      if (documentRef.body && documentRef.body.classList) {
        documentRef.body.classList.remove("is-modal-open");
      }
      isOpen = false;
      emitCatalogEvent(documentRef, EVENT_CLOSE, { id: activeId });
      activeId = null;

      if (
        previouslyFocused &&
        typeof previouslyFocused.focus === "function" &&
        (typeof documentRef.contains !== "function" || documentRef.contains(previouslyFocused))
      ) {
        previouslyFocused.focus();
      }
      previouslyFocused = null;
      return true;
    }

    function handleKeydown(event) {
      if (isDestroyed || !isOpen || !event) {
        return;
      }
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }

      var nodes = focusableNodes();
      if (nodes.length === 0) {
        event.preventDefault();
        if (refs.panel && typeof refs.panel.focus === "function") {
          refs.panel.focus();
        }
        return;
      }

      var first = nodes[0];
      var last = nodes[nodes.length - 1];
      var active = documentRef.activeElement;
      if (event.shiftKey && (active === first || !focusInsidePanel(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !focusInsidePanel(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    function handleBackdropClick(event) {
      if (isDestroyed || !isOpen || !event || !event.target) {
        return;
      }
      if (
        typeof event.target.closest === "function" &&
        event.target.closest("[data-modal-close]")
      ) {
        close();
      }
    }

    if (typeof documentRef.addEventListener === "function") {
      documentRef.addEventListener("keydown", handleKeydown);
    }
    if (typeof root.addEventListener === "function") {
      root.addEventListener("click", handleBackdropClick);
    }

    function destroy() {
      if (isDestroyed) {
        return true;
      }
      close();
      if (typeof documentRef.removeEventListener === "function") {
        documentRef.removeEventListener("keydown", handleKeydown);
      }
      if (typeof root.removeEventListener === "function") {
        root.removeEventListener("click", handleBackdropClick);
      }
      isDestroyed = true;
      return true;
    }

    return Object.freeze({
      open: open,
      close: close,
      isOpen: function () {
        return isOpen && !isDestroyed;
      },
      destroy: destroy
    });
  }

  function bindCatalogCards(cards, controller, doc) {
    var documentRef = doc || (typeof document !== "undefined" ? document : null);
    if (!documentRef || !controller || typeof controller.open !== "function") {
      return;
    }

    forEachCard(cards, function (card) {
      var raw = card.dataset ? card.dataset.catalog : null;
      var id = normalizeCatalogId(raw);
      if (id === null || typeof card.addEventListener !== "function") {
        return;
      }

      card.addEventListener("click", function () {
        if (controller && card.dataset) controller.open(card.dataset.catalog);
      });
      card.addEventListener("keydown", function (event) {
        if (!event) {
          return;
        }
        if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
          event.preventDefault();
          if (controller && card.dataset) controller.open(card.dataset.catalog);
        }
      });
    });
  }

  function applyCardSponsorAccents(cards) {
    forEachCard(cards, function (card) {
      if (
        card.dataset &&
        normalizeCatalogId(card.dataset.catalog) === "1" &&
        card.classList
      ) {
        card.classList.add("service-card--sponsor-hikvision");
      }
    });
  }

  function updateGreetingLinks(doc) {
    var documentRef = doc || (typeof document !== "undefined" ? document : null);
    if (!documentRef || typeof documentRef.querySelectorAll !== "function") {
      return;
    }
    var links = documentRef.querySelectorAll("[data-whatsapp-greeting]");
    for (var index = 0; index < links.length; index += 1) {
      links[index].href = buildGreetingUrl();
    }
  }

  function bootstrap(doc) {
    var documentRef = doc || (typeof document !== "undefined" ? document : null);
    if (!documentRef) {
      return null;
    }

    var root =
      elementById(documentRef, "hizmetModal") ||
      elementById(documentRef, "naztechModal");
    var controller = createModalController(root, documentRef);
    var cards =
      typeof documentRef.querySelectorAll === "function"
        ? documentRef.querySelectorAll("[data-catalog]")
        : [];

    applyCardSponsorAccents(cards);
    bindCatalogCards(cards, controller, documentRef);
    updateGreetingLinks(documentRef);
    return controller;
  }

  var api = Object.freeze({
    EVENT_OPEN: EVENT_OPEN,
    EVENT_CLOSE: EVENT_CLOSE,
    MODAL_ID: "hizmetModal",
    WHATSAPP_NUMBER: WHATSAPP_NUMBER,
    catalogs: catalogs,
    normalizeCatalogId: normalizeCatalogId,
    getCatalog: getCatalog,
    buildQuoteMessage: buildQuoteMessage,
    buildQuoteUrl: buildQuoteUrl,
    buildGreetingUrl: buildGreetingUrl,
    createModalController: createModalController,
    bindCatalogCards: bindCatalogCards,
    applyCardSponsorAccents: applyCardSponsorAccents,
    updateGreetingLinks: updateGreetingLinks,
    bootstrap: bootstrap
  });

  if (typeof window !== "undefined" && window) {
    Object.defineProperty(window, "NAZTECH_CATALOG", {
      value: api,
      writable: false,
      enumerable: true,
      configurable: false
    });
  }

  if (typeof document !== "undefined" && document) {
    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        function () {
          bootstrap(document);
        },
        { once: true }
      );
    } else {
      bootstrap(document);
    }
  }
})();
