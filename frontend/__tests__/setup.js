// __tests__/setup.js
// Reemplaza los módulos nativos de Expo por equivalentes en Node para probar
// la lógica offline (SQLite real en memoria vía node:sqlite).
global.__DEV__ = false;

jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = require('node:sqlite');
  const bases = new Map();
  const params = (p = []) => p.map((v) => (v === undefined ? null : v));

  const envolver = (db) => ({
    execAsync: async (sql) => db.exec(sql),
    runAsync: async (sql, p) => db.prepare(sql).run(...params(p)),
    getAllAsync: async (sql, p) => db.prepare(sql).all(...params(p)),
    getFirstAsync: async (sql, p) => db.prepare(sql).get(...params(p)) ?? null,
    withTransactionAsync: async (fn) => {
      db.exec('BEGIN');
      try {
        await fn();
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    closeAsync: async () => {},
  });

  return {
    openDatabaseAsync: async (nombre) => {
      if (!bases.has(nombre)) bases.set(nombre, envolver(new DatabaseSync(':memory:')));
      return bases.get(nombre);
    },
    deleteDatabaseAsync: async (nombre) => { bases.delete(nombre); },
  };
});

jest.mock('expo-secure-store', () => {
  const datos = new Map();
  return {
    getItemAsync: async (k) => datos.get(k) ?? null,
    setItemAsync: async (k, v) => { datos.set(k, v); },
    deleteItemAsync: async (k) => { datos.delete(k); },
  };
});

jest.mock('expo-crypto', () => ({
  getRandomBytes: (n) => new Uint8Array(require('crypto').randomBytes(n)),
}));

// Sistema de archivos en memoria: global.archivos guarda las rutas que existen
jest.mock('expo-file-system', () => {
  global.archivos = new Set();
  const unir = (base, nombre) => `${String(base).replace(/\/$/, '')}/${nombre}`;
  class Directory {
    constructor(base, nombre) { this.uri = nombre ? unir(base.uri ?? base, nombre) : String(base); }
    get exists() { return true; }
    create() {}
  }
  class File {
    constructor(base, nombre) { this.uri = nombre ? unir(base.uri ?? base, nombre) : String(base); }
    get exists() { return global.archivos.has(this.uri); }
    copy(destino) {
      if (!this.exists) throw new Error(`No existe ${this.uri}`);
      global.archivos.add(destino.uri);
    }
    delete() { global.archivos.delete(this.uri); }
  }
  return { File, Directory, Paths: { document: new Directory('file:///documentos') } };
});

// Conexión controlada desde cada prueba con global.conectado
jest.mock('@react-native-community/netinfo', () => ({
  fetch: async () => ({ isConnected: global.conectado, isInternetReachable: global.conectado }),
  addEventListener: () => () => {},
}));

jest.mock('../stores/authStore', () => ({
  __esModule: true,
  default: { getState: () => ({ usuario: { id: 'usuario-1' } }) },
}));
