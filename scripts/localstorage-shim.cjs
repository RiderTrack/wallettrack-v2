// ─────────────────────────────────────────────────────────────
// Shim de localStorage para correr los smoke tests con tsx en
// node 24 (localStorage nativo llega en node 25; con esto los
// smokes corren en cualquier versión). Uso:
//   npx tsx -r ./scripts/localstorage-shim.cjs scripts/smoke-fX.ts
// ─────────────────────────────────────────────────────────────
const store = new Map();
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
      clear: () => { store.clear(); },
      key: (i) => [...store.keys()][i] ?? null,
      get length() { return store.size; },
    },
    configurable: true,
    writable: true,
  });
}
