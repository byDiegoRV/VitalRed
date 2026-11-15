export class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  get length() {
    return this.store.size;
  }
  key(i) {
    return Array.from(this.store.keys())[i] || null;
  }
}

export function setupBrowserEnvironment() {
  if (!globalThis.localStorage) {
    globalThis.localStorage = new MockStorage();
  }
  if (!globalThis.sessionStorage) {
    globalThis.sessionStorage = new MockStorage();
  }
  if (!globalThis.matchMedia) {
    globalThis.matchMedia = () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
  if (!globalThis.window) {
    globalThis.window = {
      __BOOT: 'test-boot-token',
    };
  }
  if (!globalThis.addEventListener) {
    globalThis.addEventListener = () => {};
  }
  if (!globalThis.removeEventListener) {
    globalThis.removeEventListener = () => {};
  }
  if (!globalThis.dispatchEvent) {
    globalThis.dispatchEvent = () => true;
  }
}
