// db/database.js
// Base de datos local SQLite — caché offline. Por ahora solo cubre `animales`
// como prueba de concepto; el patrón se puede replicar a otros módulos.
//
// El archivo está cifrado con SQLCipher (plugin de expo-sqlite en app.json).
// La clave es aleatoria por dispositivo y vive en SecureStore (Keystore/Keychain),
// así que copiar el archivo .db fuera del teléfono no expone los datos.
// Nota: Expo Go no incluye SQLCipher; el cifrado solo aplica en builds propios
// (npx expo run:android o EAS Build).
import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DB_NOMBRE = 'ganaderiagt_cifrada.db';
const DB_VIEJA = 'ganaderiagt.db'; // versión anterior, sin cifrar
const CLAVE_KEY = 'db_clave';
const MIGRADA_KEY = 'db_migrada_v1';

let dbPromise = null;

const obtenerClave = async () => {
  let clave = await SecureStore.getItemAsync(CLAVE_KEY);
  if (!clave) {
    const bytes = Crypto.getRandomBytes(32);
    clave = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(CLAVE_KEY, clave);
  }
  return clave;
};

const abrir = async () => {
  const db = await SQLite.openDatabaseAsync(DB_NOMBRE);
  // Debe ser la primera instrucción sobre la conexión; la clave es hex, sin comillas internas
  await db.execAsync(`PRAGMA key = "x'${await obtenerClave()}'"`);

  const cipher = await db.getFirstAsync('PRAGMA cipher_version').catch(() => null);
  if (!cipher && __DEV__) {
    console.warn('[db] SQLCipher no disponible (Expo Go): la base local NO está cifrada en este entorno.');
  }
  return db;
};

export const getDb = () => {
  if (!dbPromise) dbPromise = abrir();
  return dbPromise;
};

// Copia los datos de la base vieja sin cifrar (incluidos cambios pendientes de
// sincronizar) a la cifrada, y luego borra el archivo viejo.
const migrarBaseVieja = async (db) => {
  if (await SecureStore.getItemAsync(MIGRADA_KEY)) return;

  try {
    const vieja = await SQLite.openDatabaseAsync(DB_VIEJA);
    const tablas = await vieja.getAllAsync(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('animales', 'pending_mutations')",
    );
    const existe = (nombre) => tablas.some((t) => t.name === nombre);

    const animales = existe('animales') ? await vieja.getAllAsync('SELECT * FROM animales') : [];
    const pendientes = existe('pending_mutations') ? await vieja.getAllAsync('SELECT * FROM pending_mutations') : [];
    await vieja.closeAsync();

    await db.withTransactionAsync(async () => {
      for (const a of animales) {
        await db.runAsync(
          'INSERT OR IGNORE INTO animales (id, usuario_id, datos, pendiente_sync, actualizado_en) VALUES (?, ?, ?, ?, ?)',
          [a.id, a.usuario_id, a.datos, a.pendiente_sync, a.actualizado_en],
        );
      }
      for (const m of pendientes) {
        await db.runAsync(
          `INSERT OR IGNORE INTO pending_mutations
             (id, usuario_id, entidad, accion, entidad_local_id, payload, creado_en, intentos, error)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [m.id, m.usuario_id, m.entidad, m.accion, m.entidad_local_id, m.payload, m.creado_en, m.intentos, m.error],
        );
      }
    });

    await SQLite.deleteDatabaseAsync(DB_VIEJA);
    await SecureStore.setItemAsync(MIGRADA_KEY, '1');
  } catch (err) {
    // Se reintenta en el próximo arranque; la base cifrada ya funciona igual
    console.warn('[db] No se pudo migrar la base local anterior:', err?.message);
  }
};

export const initDb = async () => {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS animales (
      id TEXT PRIMARY KEY,
      usuario_id TEXT,
      datos TEXT NOT NULL,
      pendiente_sync INTEGER NOT NULL DEFAULT 0,
      actualizado_en TEXT
    );

    CREATE TABLE IF NOT EXISTS pending_mutations (
      id TEXT PRIMARY KEY,
      usuario_id TEXT,
      entidad TEXT NOT NULL,
      accion TEXT NOT NULL,
      entidad_local_id TEXT,
      payload TEXT NOT NULL,
      creado_en TEXT NOT NULL,
      intentos INTEGER NOT NULL DEFAULT 0,
      error TEXT
    );

    -- Caché genérica para vacunas, partos, gastos y fincas (ver offline/crearRepoOffline.js)
    CREATE TABLE IF NOT EXISTS registros (
      entidad TEXT NOT NULL,
      id TEXT NOT NULL,
      usuario_id TEXT,
      datos TEXT NOT NULL,
      pendiente_sync INTEGER NOT NULL DEFAULT 0,
      eliminado INTEGER NOT NULL DEFAULT 0,
      actualizado_en TEXT,
      PRIMARY KEY (entidad, id)
    );
  `);

  // Mutaciones que el servidor rechazó (4xx): no se reintentan, el usuario decide descartarlas
  const columnas = await db.getAllAsync('PRAGMA table_info(pending_mutations)');
  if (!columnas.some((c) => c.name === 'rechazada')) {
    await db.execAsync('ALTER TABLE pending_mutations ADD COLUMN rechazada INTEGER NOT NULL DEFAULT 0');
  }

  await migrarBaseVieja(db);
  return db;
};

// Utilidad para un futuro "borrar caché" manual. No se llama automáticamente al
// cerrar sesión: a diferencia del caché de React Query, aquí cada fila queda
// asociada a un usuario_id y toda lectura/escritura ya filtra por el usuario
// activo, así que no hay filtrado entre cuentas — y borrar podría tirar
// mutaciones pendientes de sincronizar de otra sesión.
export const limpiarCacheLocal = async () => {
  const db = await getDb();
  await db.execAsync('DELETE FROM animales; DELETE FROM registros; DELETE FROM pending_mutations;');
};
