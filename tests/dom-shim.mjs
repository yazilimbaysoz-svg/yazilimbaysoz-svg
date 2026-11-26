/*
 * Baysöz Yazılım — Minimal dependency-free DOM for catalog controller tests.
 * Contact: baysozlabs@proton.me
 *
 * Scope: this shim implements only the surface exercised by hizmet-detay.js.
 * It deliberately exposes no canvas and no requestAnimationFrame so that
 * matrix.js can never be executed inside the verification sandbox.
 */

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
  "meta", "param", "source", "track", "wbr"
]);

const REFLECTED_ATTRIBUTES = [
  "href", "src", "alt", "title", "target", "rel", "loading", "decoding",
  "role", "type", "value", "aria-label", "aria-hidden", "aria-haspopup",
  "aria-controls", "aria-modal", "aria-describedby", "aria-labelledby"
];

function toDataAttribute(key) {
  return "data-" + String(key).replace(/([A-Z])/g, "-$1").toLowerCase();
}

function fromDataAttribute(attribute) {
  return attribute.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function toNode(value, ownerDocument) {
  if (value instanceof TextNode || value instanceof Element) {
    return value;
  }
  return new TextNode(String(value), ownerDocument);
}

export class TextNode {
  constructor(data, ownerDocument = null) {
    this.nodeType = 3;
    this.nodeName = "#text";
    this.data = String(data);
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
  }

  get textContent() {
    return this.data;
  }

  set textContent(value) {
    this.data = String(value);
  }
}

export class Element {
  constructor(tagName, ownerDocument = null) {
    this.nodeType = 1;
    this.nodeName = String(tagName).toUpperCase();
    this.tagName = this.nodeName;
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this._listeners = new Map();

    const self = this;
    this.classList = Object.freeze({
      add(...names) {
        const values = self._classSet();
        names.forEach((name) => {
          if (name) values.add(String(name));
        });
        self._writeClassSet(values);
      },
      remove(...names) {
        const values = self._classSet();
        names.forEach((name) => values.delete(String(name)));
        self._writeClassSet(values);
      },
      contains(name) {
        return self._classSet().has(String(name));
      },
      toggle(name, force) {
        const values = self._classSet();
        const shouldExist = force === undefined ? !values.has(String(name)) : Boolean(force);
        if (shouldExist) {
          values.add(String(name));
        } else {
          values.delete(String(name));
        }
        self._writeClassSet(values);
        return shouldExist;
      },
      get length() {
        return self._classSet().size;
      },
      toString() {
        return Array.from(self._classSet()).join(" ");
      }
    });

    this.dataset = new Proxy(
      {},
      {
        get(_target, property) {
          if (typeof property !== "string") {
            return undefined;
          }
          return self.getAttribute(toDataAttribute(property));
        },
        set(_target, property, value) {
          self.setAttribute(toDataAttribute(property), String(value));
          return true;
        },
        has(_target, property) {
          return typeof property === "string" && self.hasAttribute(toDataAttribute(property));
        },
        deleteProperty(_target, property) {
          self.removeAttribute(toDataAttribute(property));
          return true;
        },
        ownKeys() {
          return Array.from(self.attributes.keys())
            .filter((name) => name.startsWith("data-"))
            .map(fromDataAttribute);
        },
        getOwnPropertyDescriptor(_target, property) {
          if (typeof property === "string" && self.hasAttribute(toDataAttribute(property))) {
            return {
              value: self.getAttribute(toDataAttribute(property)),
              writable: true,
              enumerable: true,
              configurable: true
            };
          }
          return undefined;
        }
      }
    );

    for (const attribute of REFLECTED_ATTRIBUTES) {
      Object.defineProperty(this, attribute, {
        enumerable: true,
        configurable: true,
        get() {
          return self.getAttribute(attribute);
        },
        set(value) {
          if (value === null || value === undefined) {
            self.removeAttribute(attribute);
          } else {
            self.setAttribute(attribute, String(value));
          }
        }
      });
    }

    Object.defineProperty(this, "hidden", {
      enumerable: true,
      configurable: true,
      get() {
        return self.hasAttribute("hidden");
      },
      set(value) {
        if (value) {
          self.setAttribute("hidden", "");
        } else {
          self.removeAttribute("hidden");
        }
      }
    });
  }

  _classSet() {
    const raw = this.getAttribute("class") || "";
    return new Set(raw.split(/\s+/).filter(Boolean));
  }

  _writeClassSet(values) {
    this.setAttribute("class", Array.from(values).join(" "));
  }

  get id() {
    return this.getAttribute("id") || "";
  }

  set id(value) {
    this.setAttribute("id", String(value));
  }

  get className() {
    return this.getAttribute("class") || "";
  }

  set className(value) {
    this.setAttribute("class", String(value));
  }

  hasAttribute(name) {
    return this.attributes.has(String(name).toLowerCase());
  }

  getAttribute(name) {
    const found = this.attributes.get(String(name).toLowerCase());
    return found === undefined ? null : found;
  }

  setAttribute(name, value) {
    this.attributes.set(String(name).toLowerCase(), String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(String(name).toLowerCase());
  }

  get textContent() {
    return this.children.map((child) => child.textContent).join("");
  }

  set textContent(value) {
    this.replaceChildren(new TextNode(String(value), this.ownerDocument));
  }

  appendChild(child) {
    const node = toNode(child, this.ownerDocument);
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
    if (!node.ownerDocument && this.ownerDocument) {
      node.ownerDocument = this.ownerDocument;
    }
    node.parentNode = this;
    this.children.push(node);
    return node;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index === -1) {
      return child;
    }
    this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  replaceChildren(...nodes) {
    for (const child of this.children.slice()) {
      child.parentNode = null;
    }
    this.children = [];
    for (const node of nodes) {
      this.appendChild(node);
    }
  }

  contains(node) {
    let cursor = node;
    while (cursor) {
      if (cursor === this) {
        return true;
      }
      cursor = cursor.parentNode;
    }
    return false;
  }

  focus() {
    if (this.ownerDocument) {
      this.ownerDocument.activeElement = this;
    }
  }

  addEventListener(type, listener, options) {
    const key = String(type);
    if (!this._listeners.has(key)) {
      this._listeners.set(key, []);
    }
    this._listeners.get(key).push({
      listener,
      once: Boolean(options && options.once)
    });
  }

  removeEventListener(type, listener) {
    const key = String(type);
    const entries = this._listeners.get(key);
    if (!entries) {
      return;
    }
    this._listeners.set(
      key,
      entries.filter((entry) => entry.listener !== listener)
    );
  }

  dispatchEvent(event) {
    return dispatchThroughTree(this, event);
  }

  matches(selector) {
    return matchesSelector(this, selector);
  }

  closest(selector) {
    let cursor = this;
    while (cursor && cursor.nodeType === 1) {
      if (matchesSelector(cursor, selector)) {
        return cursor;
      }
      cursor = cursor.parentNode;
    }
    return null;
  }

  querySelector(selector) {
    return queryAll(this, selector)[0] || null;
  }

  querySelectorAll(selector) {
    return queryAll(this, selector);
  }
}

export class Document {
  constructor() {
    this.nodeType = 9;
    this.nodeName = "#document";
    this.ownerDocument = null;
    this.parentNode = null;
    this.children = [];
    this.readyState = "complete";
    this.activeElement = null;
    this.body = null;
    this.documentElement = null;
    this._listeners = new Map();
  }

  createElement(tagName) {
    return new Element(tagName, this);
  }

  createTextNode(data) {
    return new TextNode(data, this);
  }

  appendChild(child) {
    const node = toNode(child, this);
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
    node.ownerDocument = this;
    node.parentNode = this;
    this.children.push(node);
    return node;
  }

  contains(node) {
    let cursor = node;
    while (cursor) {
      if (cursor === this) {
        return true;
      }
      cursor = cursor.parentNode;
    }
    return false;
  }

  getElementById(id) {
    const wanted = String(id);
    for (const element of queryAll(this, "[id]")) {
      if (element.getAttribute("id") === wanted) {
        return element;
      }
    }
    return null;
  }

  querySelector(selector) {
    return queryAll(this, selector)[0] || null;
  }

  querySelectorAll(selector) {
    return queryAll(this, selector);
  }

  addEventListener(type, listener, options) {
    const key = String(type);
    if (!this._listeners.has(key)) {
      this._listeners.set(key, []);
    }
    this._listeners.get(key).push({
      listener,
      once: Boolean(options && options.once)
    });
  }

  removeEventListener(type, listener) {
    const key = String(type);
    const entries = this._listeners.get(key);
    if (!entries) {
      return;
    }
    this._listeners.set(
      key,
      entries.filter((entry) => entry.listener !== listener)
    );
  }

  dispatchEvent(event) {
    return dispatchThroughTree(this, event);
  }
}

export function createDocument() {
  const documentRef = new Document();
  const html = documentRef.createElement("html");
  const head = documentRef.createElement("head");
  const body = documentRef.createElement("body");
  html.appendChild(head);
  html.appendChild(body);
  documentRef.appendChild(html);
  documentRef.documentElement = html;
  documentRef.body = body;
  documentRef.activeElement = body;
  return documentRef;
}

export function createConsoleSpy() {
  const errors = [];
  const format = (value) => {
    if (typeof value === "string") {
      return value;
    }
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  };

  return {
    errors,
    get errorCount() {
      return errors.length;
    },
    log() {},
    info() {},
    debug() {},
    warn() {},
    error(...args) {
      errors.push(args.map(format).join(" "));
    },
    assert(condition, ...args) {
      if (!condition) {
        this.error("console.assert failed", ...args);
      }
    }
  };
}

function dispatchThroughTree(origin, event) {
  const normalized = event || {};
  normalized.type = normalized.type || "event";
  if (!normalized.target) {
    normalized.target = origin;
  }
  if (typeof normalized.preventDefault !== "function") {
    let prevented = false;
    normalized.preventDefault = () => {
      prevented = true;
    };
    Object.defineProperty(normalized, "defaultPrevented", {
      configurable: true,
      get() {
        return prevented;
      }
    });
  }

  let node = origin;
  while (node) {
    const entries = node._listeners ? node._listeners.get(normalized.type) : null;
    if (entries) {
      for (const entry of entries.slice()) {
        if (entry.once) {
          node.removeEventListener(normalized.type, entry.listener);
        }
        entry.listener.call(node, normalized);
      }
    }
    if (normalized._stopPropagation) {
      break;
    }
    if (node.parentNode) {
      node = node.parentNode;
    } else if (node.nodeType === 1 && node.ownerDocument) {
      node = node.ownerDocument;
    } else {
      node = null;
    }
  }
  return !normalized.defaultPrevented;
}

function splitTopLevel(input, separator) {
  const parts = [];
  let buffer = "";
  let depth = 0;
  let quote = null;
  for (const character of input) {
    if (quote) {
      buffer += character;
      if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      buffer += character;
    } else if (character === "(" || character === "[") {
      depth += 1;
      buffer += character;
    } else if (character === ")" || character === "]") {
      depth -= 1;
      buffer += character;
    } else if (character === separator && depth === 0) {
      parts.push(buffer.trim());
      buffer = "";
    } else {
      buffer += character;
    }
  }
  parts.push(buffer.trim());
  return parts.filter(Boolean);
}

function parseAttribute(token) {
  const match = /^\[\s*([^\s=~|^$*]+)\s*(?:(=|~=|\|=|\^=|\$=|\*=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\s*\]$/.exec(
    token.trim()
  );
  if (!match) {
    return null;
  }
  return {
    name: match[1].toLowerCase(),
    operator: match[2] || null,
    value: match[3] !== undefined ? match[3] : match[4] !== undefined ? match[4] : match[5] !== undefined ? match[5] : null
  };
}

function parseCompound(text) {
  let remainder = text;
  const nots = [];
  remainder = remainder.replace(/:not\(([^()]*)\)/g, (_match, inner) => {
    const spec = parseAttribute(inner);
    if (spec) {
      nots.push(spec);
    }
    return " ";
  });

  const tagMatch = /^[a-zA-Z][\w-]*/.exec(remainder);
  const tag = tagMatch ? tagMatch[0].toUpperCase() : null;
  if (tagMatch) {
    remainder = remainder.slice(tagMatch[0].length);
  }

  const attributes = [];
  remainder = remainder.replace(/\[[^\]]*\]/g, (token) => {
    const spec = parseAttribute(token);
    if (spec) {
      attributes.push(spec);
    }
    return " ";
  });

  const ids = [];
  remainder = remainder.replace(/#([\w-]+)/g, (_match, id) => {
    ids.push(id);
    return " ";
  });

  const classes = [];
  remainder = remainder.replace(/\.([\w-]+)/g, (_match, className) => {
    classes.push(className);
    return " ";
  });

  return { tag, ids, classes, attributes, nots };
}

function matchesAttribute(element, spec) {
  const value = element.getAttribute(spec.name);
  if (spec.operator === null) {
    return value !== null;
  }
  if (value === null) {
    return false;
  }
  switch (spec.operator) {
    case "=":
      return value === spec.value;
    case "~=":
      return value.split(/\s+/).includes(spec.value);
    case "|=":
      return value === spec.value || value.startsWith(spec.value + "-");
    case "^=":
      return value.startsWith(spec.value);
    case "$=":
      return value.endsWith(spec.value);
    case "*=":
      return value.includes(spec.value);
    default:
      return false;
  }
}

function matchesCompound(element, compound) {
  if (compound.tag && element.tagName !== compound.tag) {
    return false;
  }
  if (compound.ids.some((id) => element.getAttribute("id") !== id)) {
    return false;
  }
  if (compound.classes.some((name) => !element.classList.contains(name))) {
    return false;
  }
  if (compound.attributes.some((spec) => !matchesAttribute(element, spec))) {
    return false;
  }
  return !compound.nots.some((spec) => matchesAttribute(element, spec));
}

function matchesSelector(element, selector) {
  const groups = splitTopLevel(String(selector), ",");
  for (const group of groups) {
    const chain = splitTopLevel(group.replace(/>/g, " "), " ").map(parseCompound);
    if (chain.length === 0 || !matchesCompound(element, chain[chain.length - 1])) {
      continue;
    }
    let ancestor = element.parentNode;
    let matched = true;
    for (let index = chain.length - 2; index >= 0; index -= 1) {
      let found = false;
      while (ancestor && ancestor.nodeType === 1) {
        if (matchesCompound(ancestor, chain[index])) {
          found = true;
          ancestor = ancestor.parentNode;
          break;
        }
        ancestor = ancestor.parentNode;
      }
      if (!found) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return true;
    }
  }
  return false;
}

function collectElements(root) {
  const result = [];
  const walk = (node) => {
    for (const child of node.children || []) {
      if (child.nodeType === 1) {
        result.push(child);
      }
      walk(child);
    }
  };
  walk(root);
  return result;
}

function queryAll(root, selector) {
  const groups = splitTopLevel(String(selector), ",");
  if (groups.length === 0) {
    return [];
  }
  return collectElements(root).filter((element) =>
    groups.some((group) => {
      const chain = splitTopLevel(group.replace(/>/g, " "), " ").map(parseCompound);
      if (chain.length === 0 || !matchesCompound(element, chain[chain.length - 1])) {
        return false;
      }
      let ancestor = element.parentNode;
      for (let index = chain.length - 2; index >= 0; index -= 1) {
        let found = false;
        while (ancestor && ancestor.nodeType === 1) {
          if (matchesCompound(ancestor, chain[index])) {
            found = true;
            ancestor = ancestor.parentNode;
            break;
          }
          ancestor = ancestor.parentNode;
        }
        if (!found) {
          return false;
        }
      }
      return true;
    })
  );
}

export { matchesSelector, VOID_ELEMENTS };
