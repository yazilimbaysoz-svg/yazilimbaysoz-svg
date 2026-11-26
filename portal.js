/*
 * Baysöz Yazılım — NAZTECH Corporate Customer, Partner & Admin Portal.
 * Contact: baysozlabs@proton.me
 *
 * Dependency-free classic script. Every DOM node is created explicitly so the
 * module is testable in a minimal DOM and safe against untrusted input.
 *
 * SECURITY MODEL — LOCAL DEMO BY DEFAULT:
 * Role tabs, demo logins and the admin panel operate on local demo records.
 * They are NOT authentication or authorization. No identity is verified and
 * no privilege is enforced by this file. A production deployment must use
 * Supabase Auth, row level security and server-side role checks; see
 * SECURITY.md. The optional Supabase REST adapter is dormant until a valid
 * window.NAZTECH_SUPABASE_CONFIG is supplied by the operator.
 */

(function (global, doc) {
  'use strict';

  var VERSION = '1.0.0';
  var WA_PHONE = '905530341894';
  var PREFIX = 'nzp.v1.';
  var KEYS = {
    quotes: PREFIX + 'quotes',
    devices: PREFIX + 'devices',
    tickets: PREFIX + 'tickets',
    discoveries: PREFIX + 'discoveries',
    users: PREFIX + 'users',
    session: PREFIX + 'session',
    seq: PREFIX + 'seq'
  };

  var ROLES = ['customer', 'dealer', 'admin'];
  var ROLE_LABELS = { customer: 'Müşteri', dealer: 'Bayi', admin: 'Yönetici' };
  var QUOTE_STATUSES = ['Taslak', 'Gönderildi', 'Onaylandı', 'Reddedildi'];
  var TICKET_STATUSES = ['Açık', 'Devam ediyor', 'Kapandı'];
  var PRIORITIES = ['Düşük', 'Normal', 'Yüksek', 'Kritik'];
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var SUPABASE_RE = new RegExp('^https://[a-z0-9-]+[.]supabase[.]co/?$', 'i');

  var DEMO_USERS = [
    { id: 'DEMO-C', role: 'customer', name: 'Demo Müşteri', email: 'demo@naztech.local', company: 'Naztech Demo A.Ş.' },
    { id: 'DEMO-B', role: 'dealer', name: 'Demo Bayi', email: 'bayi@naztech.local', company: 'Naztech Yetkili Bayi' },
    { id: 'DEMO-A', role: 'admin', name: 'Demo Yönetici', email: 'admin@naztech.local', company: 'Naztech Operasyon' }
  ];

  /* Deterministic seed records. No randomness, no clock reads at module load. */
  var SEED = {
    quotes: [
      { id: 'Q-000101', title: 'HIKVISION IP Kamera Altyapısı', status: 'Gönderildi', date: '2026-10-14', amount: 185000, reference: 'KEŞİF-014' },
      { id: 'Q-000102', title: 'Yangın İhbar Sistemi Kurulumu', status: 'Onaylandı', date: '2026-10-28', amount: 96400, reference: 'KEŞİF-021' },
      { id: 'Q-000103', title: 'Filo GPS Takip Çözümü', status: 'Taslak', date: '2026-11-06', amount: 42750, reference: 'KEŞİF-027' },
      { id: 'Q-000104', title: 'Endüstriyel Pano ve Enerji Hattı', status: 'Reddedildi', date: '2026-09-19', amount: 312800, reference: 'KEŞİF-009' }
    ],
    devices: [
      { id: 'D-000201', name: 'HIKVISION DS-7608NXI K Kayıt Cihazı', serial: 'NZ-HIK-7608-014', warrantyEnd: '2027-06-30', status: 'Aktif', location: 'Merkez Tesis · Kat 1' },
      { id: 'D-000202', name: 'HIKVISION AcuSense IP Kamera (8 MP)', serial: 'NZ-HIK-8MP-042', warrantyEnd: '2027-03-18', status: 'Aktif', location: 'Merkez Tesis · Giriş' },
      { id: 'D-000203', name: 'LAVOX Yangın İhbar Paneli', serial: 'NZ-LVX-PNL-007', warrantyEnd: '2026-09-15', status: 'Bakımda', location: 'Depo B Blok' },
      { id: 'D-000204', name: 'N2MOBİL GPS Takip Cihazı', serial: 'NZ-N2M-FLEET-31', warrantyEnd: '2026-12-20', status: 'Aktif', location: 'Araç Filo · 31 No' }
    ],
    tickets: [
      { id: 'T-000301', type: 'ticket', title: 'Kayıt cihazında görüntü kaybı', description: 'Kamera 3 ve 4 numaralı kanallarda kesintili görüntü alınıyor.', status: 'Devam ediyor', priority: 'Yüksek', createdAt: '2026-11-18T09:20:00.000Z', customer: 'Demo Müşteri', role: 'customer', device: 'HIKVISION DS-7608NXI K Kayıt Cihazı', serial: 'NZ-HIK-7608-014', address: 'Karaköprü / Şanlıurfa', phone: '05530341894', reference: '' },
      { id: 'T-000302', type: 'ticket', title: 'Alarm paneli periyodik bakım', description: 'Aylık kontrol ve yedek batarya değişimi talebi.', status: 'Açık', priority: 'Normal', createdAt: '2026-11-21T11:05:00.000Z', customer: 'Demo Bayi', role: 'dealer', device: 'LAVOX Yangın İhbar Paneli', serial: 'NZ-LVX-PNL-007', address: 'Merkez / Şanlıurfa', phone: '05530341894', reference: '' }
    ],
    discoveries: [
      { id: 'K-000401', type: 'discovery', title: 'Keşif Talebi · Yeni Üretim Hattı', description: 'Yeni hat için kamera ve enerji altyapısı yerinde keşif talebi.', status: 'Açık', priority: 'Normal', createdAt: '2026-11-15T08:40:00.000Z', customer: 'Demo Müşteri', role: 'customer', device: '', serial: '', address: 'Organize Sanayi / Şanlıurfa', phone: '05530341894', reference: 'Q-000101' }
    ]
  };

  function noop() {}
  function text(value) {
    return value === null || value === undefined ? '' : String(value);
  }
  function trim(value) {
    return text(value).trim();
  }
  function stop(event) {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
  }
  function prevent(event) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
  }
  function checkedOf(node) {
    if (!node) {
      return false;
    }
    return typeof node.checked === 'boolean'
      ? node.checked
      : node.getAttribute('checked') !== null;
  }
  function valueOf(node) {
    if (!node) {
      return '';
    }
    if (typeof node.value === 'string') {
      return node.value;
    }
    return text(node.getAttribute('value'));
  }
  function setNodeValue(node, value) {
    if (!node) {
      return;
    }
    if ('value' in node) {
      node.value = text(value);
    } else {
      node.setAttribute('value', text(value));
    }
  }
  function formatAmount(value) {
    var digits = text(Math.round(Number(value) || 0));
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' TL';
  }
  function roleLabel(role) {
    return ROLE_LABELS[role] || ROLE_LABELS.customer;
  }
  function passwordDigest(value) {
    var hash = 2166136261;
    var source = text(value);
    for (var index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = (hash * 16777619) >>> 0;
    }
    return 'demo-' + hash.toString(16);
  }

  function h(tag, attributes, children) {
    var node = doc.createElement(tag);
    if (attributes) {
      Object.keys(attributes).forEach(function (key) {
        var value = attributes[key];
        if (value === null || value === undefined || value === false) {
          return;
        }
        if (key === 'text') {
          node.textContent = text(value);
        } else if (key === 'class') {
          node.className = text(value);
        } else if (key === 'checked') {
          if (value) {
            node.setAttribute('checked', '');
          }
        } else {
          node.setAttribute(key, text(value));
        }
      });
    }
    (children || []).forEach(function (child) {
      if (child === null || child === undefined || child === false) {
        return;
      }
      node.appendChild(typeof child === 'string' ? doc.createTextNode(child) : child);
    });
    return node;
  }

  function clear(node) {
    if (node && typeof node.replaceChildren === 'function') {
      node.replaceChildren();
    }
  }

  function field(config) {
    var input = h(config.tag || 'input', {
      id: config.id,
      class: config.className || 'nzp-input',
      type: config.type || 'text',
      name: config.name || config.id,
      value: config.value || '',
      placeholder: config.placeholder || '',
      autocomplete: config.autocomplete || 'off',
      'aria-label': config.label
    });
    var wrap = h('div', { id: 'nzpField' + config.id.slice(3), class: 'nzp-field' + (config.full ? ' nzp-field--full' : '') }, [
      h('label', { for: config.id, text: config.label }),
      input
    ]);
    if (config.options) {
      config.options.forEach(function (option) {
        input.appendChild(h('option', { value: option, text: option }));
      });
    }
    return { wrap: wrap, input: input };
  }

  /* Storage: native localStorage when usable, private memory otherwise. */
  function createStorage(win) {
    var memory = Object.create(null);
    var native = null;
    try {
      if (win && win.localStorage) {
        native = win.localStorage;
        var probe = PREFIX + 'probe';
        native.setItem(probe, '1');
        native.removeItem(probe);
      }
    } catch (_error) {
      native = null;
    }
    return {
      get: function (key) {
        var stored = null;
        try {
          if (native) {
            stored = native.getItem(key);
          }
        } catch (_error) {
          stored = null;
        }
        if (stored === null && Object.prototype.hasOwnProperty.call(memory, key)) {
          stored = memory[key];
        }
        return stored;
      },
      set: function (key, value) {
        var serialized = text(value);
        memory[key] = serialized;
        try {
          if (native) {
            native.setItem(key, serialized);
          }
        } catch (_error) {
          /* Local demo continues from memory when storage is unavailable. */
        }
      },
      remove: function (key) {
        delete memory[key];
        try {
          if (native) {
            native.removeItem(key);
          }
        } catch (_error) {
          /* No-op by design. */
        }
      }
    };
  }

  function readConfig(win) {
    var raw = win ? win.NAZTECH_SUPABASE_CONFIG : null;
    if (!raw || typeof raw !== 'object') {
      return { valid: false, url: '', anonKey: '' };
    }
    var url = trim(raw.url);
    var anonKey = trim(raw.anonKey);
    var valid = SUPABASE_RE.test(url) && anonKey.length > 12 && !/placeholder|your[-_ ]?key|example/i.test(anonKey);
    return { valid: valid, url: valid ? url : '', anonKey: valid ? anonKey : '' };
  }

  function createClock(win) {
    var fixed = win && typeof win.NZP_TEST_CLOCK === 'string' ? win.NZP_TEST_CLOCK : null;
    return function () {
      return fixed || new Date().toISOString();
    };
  }

  function createIdFactory(win, storage) {
    if (win && typeof win.NZP_TEST_ID_FACTORY === 'function') {
      return win.NZP_TEST_ID_FACTORY;
    }
    return function (prefix) {
      var next = 1;
      var stored = storage.get(KEYS.seq);
      if (stored !== null) {
        var parsed = parseInt(stored, 10);
        if (isFinite(parsed) && parsed >= 0) {
          next = parsed + 1;
        }
      }
      storage.set(KEYS.seq, String(next));
      return prefix + '-' + String(next).padStart(6, '0');
    };
  }

  function createStore(options) {
    var storage = options.storage;
    var clock = options.clock;
    var idFactory = options.idFactory;
    var collections = ['quotes', 'devices', 'tickets', 'discoveries', 'users'];
    var seeders = {
      quotes: function () { return SEED.quotes.map(function (row) { return Object.assign({}, row); }); },
      devices: function () { return SEED.devices.map(function (row) { return Object.assign({}, row); }); },
      tickets: function () { return SEED.tickets.map(function (row) { return Object.assign({}, row); }); },
      discoveries: function () { return SEED.discoveries.map(function (row) { return Object.assign({}, row); }); },
      users: function () { return []; }
    };

    function read(collection) {
      if (!KEYS[collection]) {
        return [];
      }
      var stored = storage.get(KEYS[collection]);
      if (stored !== null) {
        try {
          var parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        } catch (_error) {
          /* Corrupted demo data is replaced with the deterministic seed. */
        }
      }
      var fresh = seeders[collection] ? seeders[collection]() : [];
      storage.set(KEYS[collection], JSON.stringify(fresh));
      return fresh;
    }

    function write(collection, rows) {
      storage.set(KEYS[collection], JSON.stringify(rows));
    }

    function insert(collection, record) {
      var rows = read(collection);
      rows.push(record);
      write(collection, rows);
      return record;
    }

    function update(collection, id, patch) {
      var rows = read(collection);
      for (var index = 0; index < rows.length; index += 1) {
        if (rows[index] && rows[index].id === id) {
          Object.keys(patch).forEach(function (key) {
            rows[index][key] = patch[key];
          });
          write(collection, rows);
          return rows[index];
        }
      }
      return null;
    }

    function reset() {
      collections.forEach(function (collection) {
        storage.remove(KEYS[collection]);
      });
      storage.remove(KEYS.seq);
      collections.forEach(function (collection) {
        read(collection);
      });
    }

    function snapshot() {
      var result = {};
      collections.forEach(function (collection) {
        result[collection] = read(collection);
      });
      result.seq = storage.get(KEYS.seq);
      return JSON.stringify(result);
    }

    function hydrate(config) {
      if (!config.valid || typeof global.fetch !== 'function') {
        return Promise.resolve(false);
      }
      var base = config.url.replace(/\/+$/, '') + '/rest/v1/';
      var headers = {
        apikey: config.anonKey,
        Authorization: 'Bearer ' + config.anonKey,
        Accept: 'application/json'
      };
      var tasks = ['quotes', 'devices', 'tickets', 'discoveries'].map(function (collection) {
        return global.fetch(base + collection + '?select=*', { method: 'GET', headers: headers })
          .then(function (response) {
            if (!response || response.ok === false) {
              throw new Error('Supabase sync refused');
            }
            return response.json();
          })
          .then(function (rows) {
            if (Array.isArray(rows)) {
              write(collection, rows);
            }
            return true;
          });
      });
      return Promise.all(tasks).then(function () {
        return true;
      }).catch(function () {
        return false;
      });
    }

    function nextId(prefix) {
      return idFactory(prefix);
    }

    return {
      read: read,
      write: write,
      insert: insert,
      update: update,
      reset: reset,
      snapshot: snapshot,
      hydrate: hydrate,
      nextId: nextId,
      now: clock
    };
  }

  function createSession(options) {
    var storage = options.storage;
    var clock = options.clock;
    var current = null;

    function get() {
      if (current) {
        return current;
      }
      var stored = storage.get(KEYS.session);
      if (stored) {
        try {
          var parsed = JSON.parse(stored);
          if (parsed && ROLES.indexOf(parsed.role) !== -1) {
            current = parsed;
            return current;
          }
        } catch (_error) {
          /* Invalid demo session is discarded. */
        }
      }
      return null;
    }

    function set(profile) {
      current = {
        role: ROLES.indexOf(profile.role) !== -1 ? profile.role : 'customer',
        name: trim(profile.name) || roleLabel(profile.role),
        email: trim(profile.email),
        issuedAt: clock()
      };
      storage.set(KEYS.session, JSON.stringify(current));
      return current;
    }

    function clear() {
      current = null;
      storage.remove(KEYS.session);
    }

    return {
      get: get,
      set: set,
      clear: clear,
      isAdmin: function () {
        var profile = get();
        return Boolean(profile && profile.role === 'admin');
      }
    };
  }

  function createFocusManager(docRef, roots) {
    var previous = null;
    var container = null;

    function insideHiddenRoot(node) {
      for (var index = 0; index < roots.length; index += 1) {
        var root = roots[index];
        if (root && root.hidden && typeof root.contains === 'function' && root.contains(node)) {
          return true;
        }
      }
      return false;
    }

    return {
      remember: function (node) {
        previous = node || docRef.activeElement || null;
      },
      setContainer: function (node) {
        container = node || null;
      },
      getContainer: function () {
        return container;
      },
      restore: function () {
        if (
          previous &&
          typeof previous.focus === 'function' &&
          !insideHiddenRoot(previous) &&
          (!docRef.contains || docRef.contains(previous))
        ) {
          previous.focus();
        }
        previous = null;
        container = null;
      }
    };
  }

  function buildWorkOrder(payload, phone) {
    var lines = [
      '*naztech Bilişim — İş Emri #' + text(payload.id) + '*',
      'Kayıt Tipi: ' + (payload.type === 'discovery' ? 'Keşif Talebi' : 'Arıza / Servis'),
      'Rol: ' + text(payload.role),
      'Müşteri: ' + text(payload.customer),
      'Cihaz: ' + text(payload.device || 'Belirtilmedi') + (payload.serial ? ' (' + text(payload.serial) + ')' : ''),
      'Açıklama: ' + text(payload.description),
      'Öncelik: ' + text(payload.priority),
      'Adres: ' + text(payload.address || 'Belirtilmedi'),
      'Telefon: ' + text(payload.phone || 'Belirtilmedi'),
      'Durum: ' + text(payload.status)
    ];
    if (payload.reference) {
      lines.push('Referans: ' + text(payload.reference));
    }
    lines.push('Kaynak: NAZTECH Kurumsal Portal · LOCAL DEMO');
    var body = lines.join('\n');
    var digits = text(phone).replace(/\D/g, '');
    return {
      text: body,
      href: 'https://wa.me/' + digits + '?text=' + encodeURIComponent(body)
    };
  }

  function buildAuthDom() {
    var closeButton = h('button', { type: 'button', class: 'nzp-close', 'data-nzp-action': 'close-overlay', 'aria-label': 'Pencereyi kapat', text: '\u00d7' });

    var modeButtons = [
      h('button', { type: 'button', class: 'nzp-tab is-active', id: 'nzpModeLogin', 'data-nzp-action': 'auth-mode', 'data-nzp-mode': 'login', 'aria-selected': 'true', text: 'Giriş' }),
      h('button', { type: 'button', class: 'nzp-tab', id: 'nzpModeRegister', 'data-nzp-action': 'auth-mode', 'data-nzp-mode': 'register', 'aria-selected': 'false', text: 'Kayıt' }),
      h('button', { type: 'button', class: 'nzp-tab', id: 'nzpModeForgot', 'data-nzp-action': 'auth-mode', 'data-nzp-mode': 'forgot', 'aria-selected': 'false', text: 'Şifremi Unuttum' })
    ];

    var roleButtons = ROLES.map(function (role) {
      return h('button', {
        type: 'button',
        class: 'nzp-tab' + (role === 'customer' ? ' is-active' : ''),
        id: 'nzpRole' + role.charAt(0).toUpperCase() + role.slice(1),
        'data-nzp-action': 'auth-role',
        'data-nzp-role': role,
        'aria-selected': role === 'customer' ? 'true' : 'false',
        text: ROLE_LABELS[role]
      });
    });

    var name = field({ id: 'nzpName', label: 'Ad Soyad / Ünvan', placeholder: 'Adınız ve soyadınız', autocomplete: 'name', full: true });
    var email = field({ id: 'nzpEmail', label: 'E-posta', type: 'email', placeholder: 'ornek@firma.com', autocomplete: 'email', full: true });
    var password = field({ id: 'nzpPassword', label: 'Şifre', type: 'password', placeholder: 'En az 6 karakter', autocomplete: 'current-password', full: true });
    var password2 = field({ id: 'nzpPassword2', label: 'Şifre (Tekrar)', type: 'password', placeholder: 'Şifreyi yeniden girin', autocomplete: 'new-password', full: true });

    var kvkkInput = h('input', { type: 'checkbox', id: 'nzpKvkk', name: 'kvkk' });
    var kvkk = h('label', { class: 'nzp-check', for: 'nzpKvkk' }, [
      kvkkInput,
      h('span', {
        text: 'Kişisel verilerimin kimlik doğrulama, iletişim ve hizmet kayıtları amacıyla işlenmesine ilişkin KVKK Aydınlatma Metni\'ni okudum, açık rıza veriyorum. Rızamı dilediğim zaman baysozlabs@proton.me adresinden geri alabilirim. (LOCAL DEMO)'
      })
    ]);
    kvkk.wrap = h('div', { id: 'nzpFieldKvkk' }, [kvkk]);

    var error = h('p', { id: 'nzpAuthError', class: 'nzp-error', role: 'alert', 'aria-live': 'polite', text: '' });
    var info = h('p', { id: 'nzpAuthInfo', class: 'nzp-notice', 'aria-live': 'polite', text: '', hidden: true });

    var submit = h('button', { type: 'submit', id: 'nzpAuthSubmit', class: 'nzp-btn', 'data-nzp-action': 'auth-submit', text: 'Giriş Yap' });

    var form = h('form', { id: 'nzpAuthForm', novalidate: 'novalidate' }, [
      name.wrap, email.wrap, password.wrap, password2.wrap, kvkk.wrap, error, info, submit
    ]);

    var demoButtons = [
      { role: 'customer', label: 'Müşteri Girişi' },
      { role: 'dealer', label: 'Bayi Girişi' },
      { role: 'admin', label: 'Yönetici Girişi' }
    ].map(function (demo) {
      return h('button', { type: 'button', class: 'nzp-demo-btn', 'data-nzp-action': 'demo-login', 'data-nzp-role': demo.role }, [
        h('span', { text: demo.label }),
        h('small', { text: 'LOCAL DEMO' })
      ]);
    });

    var panel = h('section', {
      id: 'nzpAuthPanel',
      class: 'nzp-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'nzpAuthTitle',
      tabindex: '-1'
    }, [
      h('div', { class: 'nzp-head' }, [
        h('span', { class: 'nzp-eyebrow', text: 'NAZTECH Kurumsal Portal' }),
        h('h2', { id: 'nzpAuthTitle', text: 'Müşteri, Bayi & Yönetici Girişi' }),
        h('p', { class: 'nzp-subtitle', text: 'Teklifler, cihaz garantileri ve servis kayıtları tek panelde.' }),
        closeButton
      ]),
      h('div', { class: 'nzp-body' }, [
        h('div', { class: 'nzp-tablist', role: 'tablist', 'aria-label': 'İşlem türü' }, modeButtons),
        h('div', { class: 'nzp-tablist', role: 'tablist', 'aria-label': 'Hesap türü' }, roleButtons),
        form,
        h('div', { class: 'nzp-divider', text: 'Hızlı Erişim' }),
        h('div', { class: 'nzp-demo-grid' }, demoButtons)
      ]),
      h('p', {
        class: 'nzp-foot',
        text: 'LOCAL DEMO: Bu ekran gerçek kimlik doğrulaması yapmaz; tüm kayıtlar tarayıcınızda tutulur. Üretim ortamı için sunucu tarafı yetkilendirme zorunludur. Baysöz Yazılım · baysozlabs@proton.me'
      })
    ]);

    var root = h('div', {
      id: 'nzpAuthOverlay',
      class: 'nzp-overlay',
      hidden: true,
      'aria-hidden': 'true'
    }, [
      h('div', { class: 'nzp-backdrop', 'data-nzp-action': 'close-overlay', 'aria-hidden': 'true' }),
      panel
    ]);

    return {
      root: root,
      panel: panel,
      closeButton: closeButton,
      modeButtons: modeButtons,
      roleButtons: roleButtons,
      form: form,
      name: name.input,
      email: email.input,
      password: password.input,
      password2: password2.input,
      kvkk: kvkkInput,
      error: error,
      info: info,
      submit: submit,
      demoButtons: demoButtons
    };
  }

  function buildDashboardDom() {
    var closeButton = h('button', { type: 'button', class: 'nzp-close', 'data-nzp-action': 'close-overlay', 'aria-label': 'Paneli kapat', text: '\u00d7' });
    var roleChip = h('span', { id: 'nzpRoleChip', class: 'nzp-chip', text: 'Müşteri · LOCAL DEMO' });
    var welcome = h('p', { id: 'nzpWelcome', class: 'nzp-subtitle', text: '' });
    var logoutButton = h('button', { type: 'button', id: 'nzpLogoutBtn', class: 'nzp-logout', 'data-nzp-action': 'logout', text: 'Çıkış' });

    var tabs = [
      { key: 'quotes', label: 'Tekliflerim & Keşif', id: 'nzpTabQuotes' },
      { key: 'devices', label: 'Cihazlarım & Garanti', id: 'nzpTabDevices' },
      { key: 'requests', label: 'Arıza / Servis Kaydı', id: 'nzpTabRequests' },
      { key: 'admin', label: 'Yönetici Paneli', id: 'nzpTabAdmin' }
    ].map(function (tab) {
      return h('button', {
        type: 'button',
        class: 'nzp-tab' + (tab.key === 'quotes' ? ' is-active' : ''),
        id: tab.id,
        'data-nzp-action': 'dash-tab',
        'data-nzp-tab': tab.key,
        'aria-selected': tab.key === 'quotes' ? 'true' : 'false',
        text: tab.label
      });
    });

    var quoteStats = h('div', { id: 'nzpQuoteStats', class: 'nzp-stats' });
    var quoteList = h('div', { id: 'nzpQuoteList', class: 'nzp-list' });
    var quotesPane = h('div', { id: 'nzpPane-quotes', class: 'nzp-pane' }, [
      quoteStats,
      h('button', { type: 'button', class: 'nzp-btn nzp-btn--ghost nzp-btn--small', 'data-nzp-action': 'create-discovery', text: '+ Yeni Keşif Talebi Oluştur' }),
      h('h3', { class: 'nzp-section-title', text: 'Teklifler' }),
      quoteList
    ]);

    var deviceStats = h('div', { id: 'nzpDeviceStats', class: 'nzp-stats' });
    var deviceList = h('div', { id: 'nzpDeviceList', class: 'nzp-list' });
    var devicesPane = h('div', { id: 'nzpPane-devices', class: 'nzp-pane', hidden: true }, [
      deviceStats,
      h('h3', { class: 'nzp-section-title', text: 'Cihazlar ve Garanti Durumu' }),
      deviceList
    ]);

    var deviceSelect = h('select', { id: 'nzpRequestDevice', class: 'nzp-select', 'aria-label': 'Cihaz' });
    var subject = field({ id: 'nzpRequestTitle', label: 'Konu', placeholder: 'Örn. Kamera görüntüsü gelmiyor', full: true });
    var description = field({ id: 'nzpRequestDescription', tag: 'textarea', label: 'Arıza Açıklaması', placeholder: 'Sorunu ayrıntılı yazın', full: true });
    var priority = field({ id: 'nzpRequestPriority', tag: 'select', label: 'Öncelik', options: PRIORITIES });
    var address = field({ id: 'nzpRequestAddress', label: 'Adres', placeholder: 'Mahalle, cadde, no / şehir' });
    var phone = field({ id: 'nzpRequestPhone', label: 'Telefon', type: 'tel', placeholder: '05xx xxx xx xx' });
    var waInput = h('input', { type: 'checkbox', id: 'nzpWaOpt', name: 'whatsapp', checked: true });
    var waLabel = h('label', { class: 'nzp-check', for: 'nzpWaOpt' }, [
      waInput,
      h('span', { text: 'Oluşturulan iş emrini WhatsApp üzerinden 0553 034 18 94 numarasına gönder (LOCAL DEMO)' })
    ]);
    var requestError = h('p', { id: 'nzpRequestError', class: 'nzp-error', role: 'alert', 'aria-live': 'polite', text: '' });
    var requestSubmit = h('button', { type: 'submit', class: 'nzp-btn', text: 'Servis Kaydı Oluştur' });
    var resultTitle = h('strong', { id: 'nzpResultTitle', text: '' });
    var resultWa = h('a', {
      id: 'nzpResultWhatsApp',
      class: 'nzp-btn',
      href: 'https://wa.me/' + WA_PHONE,
      target: '_blank',
      rel: 'noopener noreferrer',
      text: "WhatsApp'a İş Emri Gönder",
      hidden: true
    });
    var result = h('div', { id: 'nzpTicketResult', class: 'nzp-result', hidden: true }, [resultTitle, resultWa]);
    var ticketList = h('div', { id: 'nzpTicketList', class: 'nzp-list' });
    var discoveryList = h('div', { id: 'nzpDiscoveryList', class: 'nzp-list' });
    var requestForm = h('form', { id: 'nzpRequestForm', novalidate: 'novalidate' }, [
      h('div', { class: 'nzp-field nzp-field--full' }, [h('label', { for: 'nzpRequestDevice', text: 'Cihaz' }), deviceSelect]),
      subject.wrap,
      description.wrap,
      h('div', { class: 'nzp-form-grid' }, [priority.wrap, phone.wrap, address.wrap]),
      waLabel,
      requestError,
      requestSubmit,
      result
    ]);
    var requestsPane = h('div', { id: 'nzpPane-requests', class: 'nzp-pane', hidden: true }, [
      requestForm,
      h('h3', { class: 'nzp-section-title', text: 'Servis Kayıtları' }),
      ticketList,
      h('h3', { class: 'nzp-section-title', text: 'Keşif Talepleri' }),
      discoveryList
    ]);

    var adminStats = h('div', { id: 'nzpAdminStats', class: 'nzp-stats' });
    var adminList = h('div', { id: 'nzpAdminList', class: 'nzp-list' });
    var adminPane = h('div', { id: 'nzpPane-admin', class: 'nzp-pane', hidden: true }, [
      h('p', { class: 'nzp-notice', text: 'LOCAL DEMO: Durum değişiklikleri yalnızca bu tarayıcıda tutulur. Üretimde yetkilendirme sunucuda doğrulanmalıdır.' }),
      adminStats,
      h('h3', { class: 'nzp-section-title', text: 'Tüm Kayıtlar' }),
      adminList
    ]);

    var panel = h('aside', {
      id: 'nzpDashboardPanel',
      class: 'nzp-drawer',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'nzpDashTitle',
      tabindex: '-1'
    }, [
      h('div', { class: 'nzp-head nzp-dash-head' }, [
        h('span', { class: 'nzp-eyebrow', text: 'NAZTECH · Kurumsal Portal' }),
        h('h2', { id: 'nzpDashTitle', text: 'Hesabım' }),
        welcome,
        h('div', { class: 'nzp-dash-meta' }, [roleChip, logoutButton]),
        closeButton
      ]),
      h('div', { class: 'nzp-body' }, [
        h('div', { class: 'nzp-tablist', role: 'tablist', 'aria-label': 'Panel bölümleri' }, tabs),
        quotesPane,
        devicesPane,
        requestsPane,
        adminPane
      ]),
      h('p', { class: 'nzp-foot', text: 'Baysöz Yazılım · baysozlabs@proton.me · Yerel demo verileri' })
    ]);

    var root = h('div', {
      id: 'nzpDashboardOverlay',
      class: 'nzp-overlay nzp-overlay--drawer',
      hidden: true,
      'aria-hidden': 'true'
    }, [
      h('div', { class: 'nzp-backdrop', 'data-nzp-action': 'close-overlay', 'aria-hidden': 'true' }),
      panel
    ]);

    return {
      root: root,
      panel: panel,
      closeButton: closeButton,
      roleChip: roleChip,
      welcome: welcome,
      logoutButton: logoutButton,
      tabs: tabs,
      panes: { quotes: quotesPane, devices: devicesPane, requests: requestsPane, admin: adminPane },
      quoteStats: quoteStats,
      quoteList: quoteList,
      deviceStats: deviceStats,
      deviceList: deviceList,
      deviceSelect: deviceSelect,
      requestForm: requestForm,
      requestTitle: subject.input,
      requestDescription: description.input,
      requestPriority: priority.input,
      requestAddress: address.input,
      requestPhone: phone.input,
      waOpt: waInput,
      requestError: requestError,
      result: result,
      resultTitle: resultTitle,
      resultWa: resultWa,
      ticketList: ticketList,
      discoveryList: discoveryList,
      adminStats: adminStats,
      adminList: adminList
    };
  }

  function bootstrap(win, docRef) {
    if (!win || !docRef || !docRef.body || typeof docRef.createElement !== 'function') {
      return null;
    }

    var storage = createStorage(win);
    var clock = createClock(win);
    var idFactory = createIdFactory(win, storage);
    var config = readConfig(win);
    var store = createStore({ storage: storage, clock: clock, idFactory: idFactory });
    var session = createSession({ storage: storage, clock: clock });
    var auth = buildAuthDom();
    var dashboard = buildDashboardDom();

    docRef.body.appendChild(auth.root);
    docRef.body.appendChild(dashboard.root);

    var focus = createFocusManager(docRef, [auth.root, dashboard.root]);
    var authState = { mode: 'login', role: 'customer' };
    var dashboardState = { tab: 'quotes' };

    function anyOpen() {
      return !auth.root.hidden || !dashboard.root.hidden;
    }

    function syncScrollLock() {
      if (anyOpen()) {
        docRef.body.classList.add('nzp-scroll-locked');
      } else {
        docRef.body.classList.remove('nzp-scroll-locked');
      }
    }

    function hideAll() {
      [auth.root, dashboard.root].forEach(function (root) {
        root.hidden = true;
        root.setAttribute('aria-hidden', 'true');
      });
      syncScrollLock();
    }

    function focusableNodes(container) {
      if (!container || typeof container.querySelectorAll !== 'function') {
        return [];
      }
      var nodes = container.querySelectorAll('button, [href], input, select, textarea');
      var result = [];
      for (var index = 0; index < nodes.length; index += 1) {
        var node = nodes[index];
        if (node.hidden || (node.getAttribute && node.getAttribute('disabled') !== null)) {
          continue;
        }
        if (typeof node.closest === 'function' && node.closest('[hidden]')) {
          continue;
        }
        result.push(node);
      }
      return result;
    }

    function showOnly(root, panel, preferred) {
      var trigger = docRef.activeElement;
      hideAll();
      focus.remember(trigger);
      root.hidden = false;
      root.setAttribute('aria-hidden', 'false');
      syncScrollLock();
      focus.setContainer(panel);
      var nodes = focusableNodes(panel);
      var target = preferred || nodes[0] || panel;
      if (target && typeof target.focus === 'function') {
        target.focus();
      }
    }

    function closeAll() {
      var wasOpen = anyOpen();
      hideAll();
      focus.restore();
      return wasOpen;
    }

    function updateNav() {
      var button = docRef.getElementById('nzpNavButton');
      if (!button) {
        return;
      }
      var full = docRef.getElementById('nzpNavLabel');
      var short = docRef.getElementById('nzpNavLabelShort');
      var badge = docRef.getElementById('nzpRoleBadge');
      var profile = session.get();
      if (profile) {
        button.classList.add('is-authenticated');
        if (full) { full.textContent = 'Hesabım'; }
        if (short) { short.textContent = 'Hesabım'; }
        if (badge) {
          badge.textContent = roleLabel(profile.role);
          badge.hidden = false;
        }
        button.setAttribute('aria-label', 'Hesabım — ' + roleLabel(profile.role) + ' panelini aç');
      } else {
        button.classList.remove('is-authenticated');
        if (full) { full.textContent = 'Müşteri Girişi'; }
        if (short) { short.textContent = 'Giriş'; }
        if (badge) {
          badge.textContent = '';
          badge.hidden = true;
        }
        button.setAttribute('aria-label', 'Müşteri Girişi portal penceresini aç');
      }
    }

    function setAuthMode(mode) {
      authState.mode = mode === 'register' || mode === 'forgot' ? mode : 'login';
      var showName = authState.mode === 'register';
      var showPassword = authState.mode !== 'forgot';
      var showConfirm = authState.mode === 'register';
      docRef.getElementById('nzpFieldName').hidden = !showName;
      docRef.getElementById('nzpFieldKvkk').hidden = !showName;
      docRef.getElementById('nzpFieldPassword').hidden = !showPassword;
      docRef.getElementById('nzpFieldPassword2').hidden = !showConfirm;
      docRef.getElementById('nzpFieldEmail').hidden = false;
      auth.submit.textContent = authState.mode === 'register'
        ? 'Kayıt Ol ve Giriş Yap'
        : authState.mode === 'forgot' ? 'Şifre Sıfırlama Bilgisi' : 'Giriş Yap';
      auth.modeButtons.forEach(function (button) {
        var active = button.getAttribute('data-nzp-mode') === authState.mode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      auth.error.textContent = '';
      auth.info.hidden = true;
      auth.info.textContent = '';
    }

    function setAuthRole(role) {
      if (ROLES.indexOf(role) === -1) {
        return;
      }
      authState.role = role;
      auth.roleButtons.forEach(function (button) {
        var active = button.getAttribute('data-nzp-role') === role;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      auth.error.textContent = '';
    }

    function openAuth(mode) {
      setAuthMode(mode);
      showOnly(auth.root, auth.panel, auth.email);
    }

    function record(type, values) {
      var profile = session.get() || DEMO_USERS[0];
      var isTicket = type === 'ticket';
      var entry = {
        id: store.nextId(isTicket ? 'T' : 'K'),
        type: type,
        title: trim(values.title) || (isTicket ? 'Servis Talebi' : 'Keşif Talebi'),
        description: trim(values.description),
        status: 'Açık',
        priority: PRIORITIES.indexOf(values.priority) !== -1 ? values.priority : 'Normal',
        createdAt: clock(),
        customer: profile.name,
        role: profile.role,
        device: trim(values.device),
        serial: trim(values.serial),
        address: trim(values.address),
        phone: trim(values.phone),
        reference: trim(values.reference)
      };
      store.insert(isTicket ? 'tickets' : 'discoveries', entry);
      return entry;
    }

    function card(title, subtitle, status, controls) {
      var main = h('div', { class: 'nzp-card__main' }, [
        h('strong', { text: title }),
        h('span', { text: subtitle })
      ]);
      var side = h('div', { class: 'nzp-card__side' }, []);
      if (status) {
        var tone = status === 'Kapandı' || status === 'Onaylandı' || status === 'Aktif'
          ? ' nzp-status--ok'
          : status === 'Reddedildi' || status === 'Bakımda' ? ' nzp-status--warn' : '';
        side.appendChild(h('span', { class: 'nzp-status' + tone, text: status }));
      }
      (controls || []).forEach(function (control) {
        side.appendChild(control);
      });
      return h('div', { class: 'nzp-card' }, [main, side]);
    }

    function stat(value, label) {
      return h('div', { class: 'nzp-stat' }, [h('strong', { text: value }), h('span', { text: label })]);
    }

    function warrantyInfo(endDate) {
      var end = Date.parse(endDate + 'T00:00:00Z');
      var today = Date.parse(clock().slice(0, 10) + 'T00:00:00Z');
      if (!isFinite(end) || !isFinite(today)) {
        return { label: 'Garanti bilgisi yok', expired: false };
      }
      var days = Math.floor((end - today) / 86400000);
      if (days < 0) {
        return { label: 'Garanti süresi doldu', expired: true };
      }
      return { label: 'Garanti aktif · ' + days + ' gün kaldı', expired: false };
    }

    function renderQuotes() {
      var quotes = store.read('quotes');
      clear(dashboard.quoteStats);
      dashboard.quoteStats.appendChild(stat(String(quotes.length), 'Teklif'));
      dashboard.quoteStats.appendChild(stat(String(quotes.filter(function (row) { return row.status === 'Onaylandı'; }).length), 'Onaylanan'));
      dashboard.quoteStats.appendChild(stat(formatAmount(quotes.reduce(function (sum, row) { return sum + (Number(row.amount) || 0); }, 0)), 'Toplam Tutar'));
      clear(dashboard.quoteList);
      if (quotes.length === 0) {
        dashboard.quoteList.appendChild(h('p', { class: 'nzp-empty', text: 'Henüz teklif kaydı yok.' }));
        return;
      }
      quotes.forEach(function (quote) {
        var button = h('button', {
          type: 'button',
          class: 'nzp-btn nzp-btn--ghost nzp-btn--small',
          'data-nzp-action': 'create-discovery',
          'data-nzp-id': quote.id,
          text: 'Keşif İste'
        });
        dashboard.quoteList.appendChild(card(
          quote.title,
          quote.id + ' · ' + quote.date + ' · ' + formatAmount(quote.amount) + (quote.reference ? ' · ' + quote.reference : ''),
          quote.status,
          [button]
        ));
      });
    }

    function renderDevices() {
      var devices = store.read('devices');
      clear(dashboard.deviceStats);
      dashboard.deviceStats.appendChild(stat(String(devices.length), 'Cihaz'));
      dashboard.deviceStats.appendChild(stat(String(devices.filter(function (row) { return row.status === 'Aktif'; }).length), 'Aktif'));
      dashboard.deviceStats.appendChild(stat(String(devices.filter(function (row) { return warrantyInfo(row.warrantyEnd).expired; }).length), 'Garantisi Biten'));
      clear(dashboard.deviceList);
      clear(dashboard.deviceSelect);
      if (devices.length === 0) {
        dashboard.deviceList.appendChild(h('p', { class: 'nzp-empty', text: 'Kayıtlı cihaz yok.' }));
      }
      devices.forEach(function (device) {
        var warranty = warrantyInfo(device.warrantyEnd);
        dashboard.deviceList.appendChild(card(
          device.name,
          device.serial + ' · ' + device.location + ' · ' + warranty.label + ' · ' + device.warrantyEnd,
          device.status
        ));
        dashboard.deviceSelect.appendChild(h('option', { value: device.name, text: device.name }));
      });
    }

    function renderRecordList(container, rows) {
      clear(container);
      if (rows.length === 0) {
        container.appendChild(h('p', { class: 'nzp-empty', text: 'Kayıt bulunamadı.' }));
        return;
      }
      rows.forEach(function (row) {
        container.appendChild(card(
          row.title,
          row.id + ' · ' + row.priority + ' · ' + row.createdAt.slice(0, 10) + (row.reference ? ' · ' + row.reference : ''),
          row.status
        ));
      });
    }

    function renderRequests() {
      renderRecordList(dashboard.ticketList, store.read('tickets'));
      renderRecordList(dashboard.discoveryList, store.read('discoveries'));
    }

    function statusSelect(kind, record) {
      var options = kind === 'quote' ? QUOTE_STATUSES : TICKET_STATUSES;
      var select = h('select', {
        class: 'nzp-select nzp-select--status',
        'data-nzp-action': 'update-status',
        'data-nzp-kind': kind,
        'data-nzp-id': record.id,
        'aria-label': record.id + ' durumunu güncelle'
      });
      options.forEach(function (option) {
        select.appendChild(h('option', { value: option, text: option }));
      });
      select.value = record.status;
      return select;
    }

    function renderAdmin() {
      var quotes = store.read('quotes');
      var tickets = store.read('tickets');
      var discoveries = store.read('discoveries');
      clear(dashboard.adminStats);
      dashboard.adminStats.appendChild(stat(String(tickets.length + discoveries.length), 'Açık Kayıt'));
      dashboard.adminStats.appendChild(stat(String(quotes.filter(function (row) { return row.status === 'Onaylandı'; }).length), 'Onaylanan Teklif'));
      dashboard.adminStats.appendChild(stat(String(discoveries.length), 'Keşif Talebi'));
      clear(dashboard.adminList);
      var all = [].concat(
        quotes.map(function (row) { return { row: row, kind: 'quote' }; }),
        tickets.map(function (row) { return { row: row, kind: 'ticket' }; }),
        discoveries.map(function (row) { return { row: row, kind: 'discovery' }; })
      );
      if (all.length === 0) {
        dashboard.adminList.appendChild(h('p', { class: 'nzp-empty', text: 'Yönetilecek kayıt yok.' }));
        return;
      }
      all.forEach(function (item) {
        dashboard.adminList.appendChild(card(
          item.row.title,
          item.row.id + ' · ' + (item.kind === 'quote' ? 'Teklif' : item.kind === 'ticket' ? 'Servis' : 'Keşif'),
          null,
          [statusSelect(item.kind, item.row)]
        ));
      });
    }

    function renderDashboard() {
      var profile = session.get();
      if (!profile) {
        return;
      }
      dashboard.welcome.textContent = 'Hoş geldiniz, ' + profile.name + '.';
      dashboard.roleChip.textContent = roleLabel(profile.role) + ' · LOCAL DEMO';
      var isAdmin = session.isAdmin();
      dashboard.tabs.forEach(function (button) {
        var key = button.getAttribute('data-nzp-tab');
        if (key === 'admin') {
          button.hidden = !isAdmin;
        }
      });
      dashboard.panes.admin.hidden = !isAdmin;
      if (!isAdmin && dashboardState.tab === 'admin') {
        dashboardState.tab = 'quotes';
      }
      dashboard.tabs.forEach(function (button) {
        var active = button.getAttribute('data-nzp-tab') === dashboardState.tab;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      Object.keys(dashboard.panes).forEach(function (key) {
        dashboard.panes[key].hidden = key !== dashboardState.tab;
      });
      renderQuotes();
      renderDevices();
      renderRequests();
      if (isAdmin) {
        renderAdmin();
      }
    }

    function openDashboard() {
      if (!session.get()) {
        openAuth('login');
        return;
      }
      renderDashboard();
      showOnly(dashboard.root, dashboard.panel, dashboard.logoutButton);
    }

    function showResult(entry) {
      dashboard.result.hidden = false;
      dashboard.resultTitle.textContent = entry.id + ' numaralı kayıt oluşturuldu · ' + entry.status;
      if (checkedOf(dashboard.waOpt)) {
        var workOrder = buildWorkOrder(entry, WA_PHONE);
        dashboard.resultWa.setAttribute('href', workOrder.href);
        dashboard.resultWa.hidden = false;
      } else {
        dashboard.resultWa.hidden = true;
      }
    }

    function completeLogin(profile) {
      session.set(profile);
      updateNav();
      closeAll();
      openDashboard();
    }

    function submitAuth(event) {
      prevent(event);
      var mode = authState.mode;
      auth.error.textContent = '';
      auth.info.hidden = true;
      auth.info.textContent = '';

      if (mode === 'forgot') {
        auth.info.textContent = 'LOCAL DEMO: Şifre sıfırlama bağlantısı gönderilmez. Kayıtlı bir hesabınız yoksa demo giriş düğmelerini kullanabilirsiniz.';
        auth.info.hidden = false;
        return;
      }

      var email = trim(valueOf(auth.email)).toLowerCase();
      var password = valueOf(auth.password);
      if (!EMAIL_RE.test(email)) {
        auth.error.textContent = 'Geçerli bir e-posta adresi girin.';
        return;
      }
      if (password.length < 6) {
        auth.error.textContent = 'Şifre en az 6 karakter olmalıdır.';
        return;
      }

      if (mode === 'register') {
        var name = trim(valueOf(auth.name));
        if (name.length < 2) {
          auth.error.textContent = 'Ad soyad en az 2 karakter olmalıdır.';
          return;
        }
        if (password !== valueOf(auth.password2)) {
          auth.error.textContent = 'Şifreler eşleşmiyor.';
          return;
        }
        if (!checkedOf(auth.kvkk)) {
          auth.error.textContent = 'Devam etmek için KVKK aydınlatma metnini onaylayın.';
          return;
        }
        var users = store.read('users');
        var duplicate = users.some(function (user) {
          return trim(user.email).toLowerCase() === email;
        });
        if (duplicate) {
          auth.error.textContent = 'Bu e-posta adresi yerel demoya zaten kayıtlı.';
          return;
        }
        var registered = {
          id: store.nextId('U'),
          role: authState.role,
          name: name,
          email: email,
          passwordHash: passwordDigest(password),
          kvkkAt: clock()
        };
        store.insert('users', registered);
        completeLogin(registered);
        return;
      }

      var existing = null;
      store.read('users').forEach(function (user) {
        if (!existing && trim(user.email).toLowerCase() === email) {
          existing = user;
        }
      });
      if (!existing || existing.passwordHash !== passwordDigest(password)) {
        auth.error.textContent = 'Yerel demo kaydı bulunamadı veya şifre hatalı. 1-click demo girişini kullanabilirsiniz.';
        return;
      }
      completeLogin(existing);
    }

    function submitRequest(event) {
      prevent(event);
      dashboard.requestError.textContent = '';
      var profile = session.get();
      if (!profile) {
        dashboard.requestError.textContent = 'Önce portal girişi yapın.';
        return;
      }
      var devices = store.read('devices');
      var deviceName = valueOf(dashboard.deviceSelect);
      var device = devices.filter(function (row) { return row.name === deviceName; })[0];
      var title = trim(valueOf(dashboard.requestTitle));
      var description = trim(valueOf(dashboard.requestDescription));
      if (title.length < 3) {
        dashboard.requestError.textContent = 'Konu en az 3 karakter olmalıdır.';
        return;
      }
      if (description.length < 5) {
        dashboard.requestError.textContent = 'Arıza açıklaması en az 5 karakter olmalıdır.';
        return;
      }
      var entry = record('ticket', {
        title: title,
        description: description,
        priority: valueOf(dashboard.requestPriority),
        device: device ? device.name : deviceName,
        serial: device ? device.serial : '',
        address: valueOf(dashboard.requestAddress),
        phone: valueOf(dashboard.requestPhone)
      });
      showResult(entry);
      setNodeValue(dashboard.requestTitle, '');
      setNodeValue(dashboard.requestDescription, '');
      setNodeValue(dashboard.requestAddress, '');
      setNodeValue(dashboard.requestPhone, '');
      setNodeValue(dashboard.requestPriority, 'Normal');
      renderRequests();
      if (session.isAdmin()) {
        renderAdmin();
      }
    }

    function createDiscovery(quoteId) {
      var quotes = store.read('quotes');
      var quote = quotes.filter(function (row) { return row.id === quoteId; })[0] || quotes[0];
      var entry = record('discovery', {
        title: 'Keşif Talebi' + (quote ? ' · ' + quote.title : ''),
        description: 'Yerinde keşif ve maliyet analizi talebi.',
        priority: 'Normal',
        reference: quote ? quote.id : ''
      });
      dashboardState.tab = 'requests';
      renderDashboard();
      showResult(entry);
    }

    function setTab(key) {
      if (key === 'admin' && !session.isAdmin()) {
        return;
      }
      if (!dashboard.panes[key]) {
        return;
      }
      dashboardState.tab = key;
      dashboard.tabs.forEach(function (button) {
        var active = button.getAttribute('data-nzp-tab') === key;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      Object.keys(dashboard.panes).forEach(function (paneKey) {
        dashboard.panes[paneKey].hidden = paneKey !== key;
      });
    }

    function onKeydown(event) {
      if (!anyOpen()) {
        return;
      }
      if (event && (event.key === 'Escape' || event.key === 'Esc')) {
        prevent(event);
        stop(event);
        closeAll();
        return;
      }
      if (!event || event.key !== 'Tab') {
        return;
      }
      var nodes = focusableNodes(focus.getContainer());
      if (nodes.length === 0) {
        prevent(event);
        var panel = focus.getContainer();
        if (panel && typeof panel.focus === 'function') {
          panel.focus();
        }
        return;
      }
      var first = nodes[0];
      var last = nodes[nodes.length - 1];
      var active = docRef.activeElement;
      var index = nodes.indexOf(active);
      if (event.shiftKey && (index === 0 || index === -1)) {
        prevent(event);
        last.focus();
      } else if (!event.shiftKey && (index === nodes.length - 1 || index === -1)) {
        prevent(event);
        first.focus();
      }
    }

    function onClick(event) {
      var target = event && event.target;
      if (!target || typeof target.closest !== 'function') {
        return;
      }
      var trigger = target.closest('[data-nzp-action]');
      if (!trigger) {
        return;
      }
      var action = trigger.getAttribute('data-nzp-action');
      if (action === 'open-auth') {
        prevent(event);
        openAuth('login');
      } else if (action === 'close-overlay') {
        prevent(event);
        closeAll();
      } else if (action === 'auth-mode') {
        setAuthMode(trigger.getAttribute('data-nzp-mode'));
      } else if (action === 'auth-role') {
        setAuthRole(trigger.getAttribute('data-nzp-role'));
      } else if (action === 'demo-login') {
        var role = trigger.getAttribute('data-nzp-role');
        var demo = DEMO_USERS.filter(function (user) { return user.role === role; })[0] || DEMO_USERS[0];
        completeLogin(demo);
      } else if (action === 'logout') {
        session.clear();
        updateNav();
        closeAll();
      } else if (action === 'dash-tab') {
        setTab(trigger.getAttribute('data-nzp-tab'));
      } else if (action === 'create-discovery') {
        createDiscovery(trigger.getAttribute('data-nzp-id'));
      }
    }

    function onChange(event) {
      var target = event && event.target;
      if (!target || typeof target.getAttribute !== 'function') {
        return;
      }
      if (target.getAttribute('data-nzp-action') !== 'update-status') {
        return;
      }
      var kind = target.getAttribute('data-nzp-kind');
      var id = target.getAttribute('data-nzp-id');
      var collection = kind === 'quote' ? 'quotes' : kind === 'ticket' ? 'tickets' : 'discoveries';
      if (id && valueOf(target)) {
        store.update(collection, id, { status: valueOf(target) });
        renderDashboard();
      }
    }

    if (typeof docRef.addEventListener === 'function') {
      docRef.addEventListener('click', onClick);
      docRef.addEventListener('change', onChange);
      docRef.addEventListener('keydown', onKeydown, true);
    }
    auth.form.addEventListener('submit', submitAuth);
    dashboard.requestForm.addEventListener('submit', submitRequest);

    updateNav();
    if (config.valid) {
      store.hydrate(config);
    }

    return {
      version: VERSION,
      configState: config.valid ? 'supabase' : 'local',
      openAuth: openAuth,
      openDashboard: openDashboard,
      closeAll: closeAll,
      setTab: setTab,
      resetDemoData: function () {
        store.reset();
        session.clear();
        updateNav();
        renderDashboard();
      },
      getSession: function () {
        return session.get();
      },
      snapshot: function () {
        return store.snapshot();
      },
      buildWorkOrder: function (payload) {
        return buildWorkOrder(payload || {}, WA_PHONE);
      },
      syncCloud: function () {
        return store.hydrate(config);
      }
    };
  }

  var controller = bootstrap(global, doc);
  var api = controller ? Object.freeze(controller) : Object.freeze({
    version: VERSION,
    configState: 'unavailable',
    openAuth: noop,
    openDashboard: noop,
    closeAll: noop,
    setTab: noop,
    resetDemoData: noop,
    getSession: function () { return null; },
    snapshot: function () { return ''; },
    buildWorkOrder: function () { return { text: '', href: '' }; },
    syncCloud: function () { return Promise.resolve(false); }
  });
  global.NaztechPortal = api;
}(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : null));
