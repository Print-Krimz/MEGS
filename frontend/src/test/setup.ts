import "@testing-library/jest-dom";

// Node 24+ experimental webstorage can expose a broken or missing localStorage/sessionStorage
// when --localstorage-file is not supplied. Install a compliant in-memory Storage shim that
// still routes through Storage.prototype so tests spying on Storage.prototype work.
const memoryStores = new WeakMap<object, Map<string, string>>();
const STORAGE_PATCHED = Symbol.for("megs.storage.prototype.patched");

const isValidStorage = (candidate: unknown): candidate is Storage => {
  if (!candidate || typeof candidate !== "object") return false;
  const s = candidate as Partial<Storage>;
  return (
    typeof s.getItem === "function" &&
    typeof s.setItem === "function" &&
    typeof s.removeItem === "function" &&
    typeof s.clear === "function"
  );
};

const ensureStoragePrototypePatched = () => {
  if (typeof Storage === "undefined") return;
  const proto = Storage.prototype as Storage & { [STORAGE_PATCHED]?: boolean };
  if (proto[STORAGE_PATCHED]) return;
  proto[STORAGE_PATCHED] = true;

  const orig = {
    getItem: proto.getItem,
    setItem: proto.setItem,
    removeItem: proto.removeItem,
    clear: proto.clear,
    key: proto.key,
    lengthDesc: Object.getOwnPropertyDescriptor(proto, "length"),
  };

  Object.defineProperties(proto, {
    length: {
      configurable: true,
      get() {
        const store = this && typeof this === "object" ? memoryStores.get(this) : undefined;
        if (store) return store.size;
        return orig.lengthDesc?.get ? orig.lengthDesc.get.call(this) : 0;
      },
    },
    getItem: {
      configurable: true,
      writable: true,
      value(key: string) {
        const store = this && typeof this === "object" ? memoryStores.get(this) : undefined;
        if (store) {
          const k = String(key);
          return store.has(k) ? (store.get(k) ?? null) : null;
        }
        return orig.getItem.call(this, key);
      },
    },
    setItem: {
      configurable: true,
      writable: true,
      value(key: string, value: string) {
        const store = this && typeof this === "object" ? memoryStores.get(this) : undefined;
        if (store) {
          store.set(String(key), String(value));
          return;
        }
        return orig.setItem.call(this, key, value);
      },
    },
    removeItem: {
      configurable: true,
      writable: true,
      value(key: string) {
        const store = this && typeof this === "object" ? memoryStores.get(this) : undefined;
        if (store) {
          store.delete(String(key));
          return;
        }
        return orig.removeItem.call(this, key);
      },
    },
    clear: {
      configurable: true,
      writable: true,
      value() {
        const store = this && typeof this === "object" ? memoryStores.get(this) : undefined;
        if (store) {
          store.clear();
          return;
        }
        return orig.clear.call(this);
      },
    },
    key: {
      configurable: true,
      writable: true,
      value(index: number) {
        const store = this && typeof this === "object" ? memoryStores.get(this) : undefined;
        if (store) return Array.from(store.keys())[index] ?? null;
        return orig.key.call(this, index);
      },
    },
  });
};

const createMemoryStorage = (): Storage => {
  if (typeof Storage !== "undefined") {
    ensureStoragePrototypePatched();
    const instance = Object.create(Storage.prototype) as Storage;
    memoryStores.set(instance, new Map<string, string>());
    return instance;
  }

  const store = new Map<string, string>();
  const fallback: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => {
      const k = String(key);
      return store.has(k) ? (store.get(k) ?? null) : null;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(String(key));
    },
    setItem: (key: string, value: string) => {
      store.set(String(key), String(value));
    },
  };
  return fallback;
};

const installStorageIfMissing = (key: "localStorage" | "sessionStorage") => {
  const winVal = typeof window !== "undefined" ? window[key] : undefined;
  const globalVal = globalThis[key];
  const resolved = isValidStorage(winVal)
    ? winVal
    : isValidStorage(globalVal)
      ? globalVal
      : createMemoryStorage();

  if (typeof window !== "undefined" && !isValidStorage(winVal)) {
    Object.defineProperty(window, key, { value: resolved, configurable: true, writable: true });
  }
  if (!isValidStorage(globalVal)) {
    Object.defineProperty(globalThis, key, { value: resolved, configurable: true, writable: true });
  }
};

installStorageIfMissing("localStorage");
installStorageIfMissing("sessionStorage");

// jsdom does not implement elementFromPoint, which input-otp calls for its password-manager badge check.
if (typeof document !== "undefined" && typeof document.elementFromPoint !== "function") {
  document.elementFromPoint = () => null;
}

// jsdom does not implement matchMedia. Evaluate min/max-width queries against window.innerWidth
// and default other queries (e.g. pointer: coarse, prefers-reduced-motion) to false.
const evaluateMediaQuery = (query: string): boolean => {
  if (typeof window === "undefined") return false;
  const minMatch = query.match(/^\(\s*min-width:\s*(\d+(?:\.\d+)?)px\s*\)$/);
  if (minMatch) return window.innerWidth >= Number(minMatch[1]);
  const maxMatch = query.match(/^\(\s*max-width:\s*(\d+(?:\.\d+)?)px\s*\)$/);
  if (maxMatch) return window.innerWidth <= Number(maxMatch[1]);
  return false;
};

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      get matches() {
        return evaluateMediaQuery(query);
      },
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
