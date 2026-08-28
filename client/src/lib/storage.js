// Guardado local en el navegador (localStorage).
// Mantiene una interfaz async (get/set) para que el resto del código no cambie
// si algún día lo mueves a un backend o IndexedDB.
const PREFIX = 'menu-semana:';

export const storage = {
  async get(key) {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? null : { key, value: v };
  },
  async set(key, value) {
    localStorage.setItem(PREFIX + key, value);
    return { key, value };
  },
};
