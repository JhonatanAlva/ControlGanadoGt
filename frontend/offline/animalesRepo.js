// offline/animalesRepo.js
// Capa de datos "offline-first" para Animales: SQLite es la fuente de verdad
// para la UI; este módulo se encarga de mantenerla sincronizada con el servidor.
import NetInfo from '@react-native-community/netinfo';
import { getDb } from '../db/database';
import { animalesService } from '../services/animalesService';
import { encolarMutacion } from './syncManager';
import useAuthStore from '../stores/authStore';

const estaConectado = async () => {
  const estado = await NetInfo.fetch();
  return !!estado.isConnected && estado.isInternetReachable !== false;
};

const usuarioIdActual = () => useAuthStore.getState().usuario?.id || null;

const guardarLocalUno = async (animal, pendiente = 0) => {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO animales (id, usuario_id, datos, pendiente_sync, actualizado_en)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET datos = excluded.datos, pendiente_sync = excluded.pendiente_sync, actualizado_en = excluded.actualizado_en`,
    [animal.id, usuarioIdActual(), JSON.stringify(animal), pendiente, animal.actualizado_en || new Date().toISOString()],
  );
};

// Upsert masivo desde el servidor — no pisa filas con cambios locales aún no sincronizados.
const guardarLocalLote = async (animales) => {
  const db = await getDb();
  const usuarioId = usuarioIdActual();
  await db.withTransactionAsync(async () => {
    for (const a of animales) {
      await db.runAsync(
        `INSERT INTO animales (id, usuario_id, datos, pendiente_sync, actualizado_en)
         VALUES (?, ?, ?, 0, ?)
         ON CONFLICT(id) DO UPDATE SET datos = excluded.datos, actualizado_en = excluded.actualizado_en
         WHERE animales.pendiente_sync = 0`,
        [a.id, usuarioId, JSON.stringify(a), a.actualizado_en || new Date().toISOString()],
      );
    }
  });
};

const leerLocal = async (filtros = {}) => {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT datos FROM animales WHERE usuario_id = ? ORDER BY actualizado_en DESC',
    [usuarioIdActual()],
  );
  let animales = rows.map((r) => JSON.parse(r.datos));

  if (filtros.estado) animales = animales.filter((a) => a.estado === filtros.estado);
  if (filtros.sexo) animales = animales.filter((a) => a.sexo === filtros.sexo);
  if (filtros.finca_id) animales = animales.filter((a) => a.finca_id === filtros.finca_id);
  if (filtros.search) {
    const q = filtros.search.toLowerCase();
    animales = animales.filter((a) =>
      (a.numero_arete || '').toLowerCase().includes(q) || (a.nombre || '').toLowerCase().includes(q));
  }
  return animales;
};

// ── Lectura ──────────────────────────────────────────────────────────────────
export const listarConTotal = async (filtros = {}) => {
  if (await estaConectado()) {
    try {
      const res = await animalesService.listar(filtros);
      const animales = res.data.data;
      await guardarLocalLote(animales);
      return { items: animales, total: res.data.meta?.total ?? animales.length };
    } catch {
      // cae a caché local
    }
  }
  const animales = await leerLocal(filtros);
  return { items: animales, total: animales.length };
};

export const listar = async (filtros = {}) => (await listarConTotal(filtros)).items;

// Mapa id → animal de la caché local, para completar datos de vacunas/partos/gastos sin conexión
export const leerAnimalesLocales = async () => {
  const animales = await leerLocal();
  return new Map(animales.map((a) => [a.id, a]));
};

export const obtener = async (id) => {
  const esLocal = id.startsWith('local_');
  if (!esLocal && (await estaConectado())) {
    try {
      const res = await animalesService.obtener(id);
      const animal = res.data.data.animal;
      await guardarLocalUno(animal, 0);
      return animal;
    } catch {
      // cae a caché local
    }
  }
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT datos FROM animales WHERE id = ?', [id]);
  return row ? JSON.parse(row.datos) : null;
};

// ── Escritura ────────────────────────────────────────────────────────────────
export const crear = async (datos, foto) => {
  if (await estaConectado()) {
    const res = await animalesService.crear(datos, foto);
    const animal = res.data.data.animal;
    await guardarLocalUno(animal, 0);
    return animal;
  }

  const idLocal = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const animalLocal = {
    id: idLocal,
    ...datos,
    estado: datos.estado || 'Activo',
    creado_en: new Date().toISOString(),
    actualizado_en: new Date().toISOString(),
  };
  await guardarLocalUno(animalLocal, 1);
  await encolarMutacion({ entidad: 'animales', accion: 'crear', entidadLocalId: idLocal, payload: { datos, foto } });
  return animalLocal;
};

export const actualizar = async (id, datos, foto) => {
  const esLocal = id.startsWith('local_');
  if (!esLocal && (await estaConectado())) {
    const res = await animalesService.actualizar(id, datos, foto);
    const animal = res.data.data.animal;
    await guardarLocalUno(animal, 0);
    return animal;
  }

  const db = await getDb();
  const row = await db.getFirstAsync('SELECT datos FROM animales WHERE id = ?', [id]);
  const actual = row ? JSON.parse(row.datos) : { id };
  const actualizado = { ...actual, ...datos, actualizado_en: new Date().toISOString() };
  await guardarLocalUno(actualizado, 1);
  await encolarMutacion({ entidad: 'animales', accion: 'actualizar', entidadLocalId: id, payload: { datos, foto } });
  return actualizado;
};

export const cambiarEstado = async (id, datos) => {
  const esLocal = id.startsWith('local_');
  if (!esLocal && (await estaConectado())) {
    const res = await animalesService.cambiarEstado(id, datos);
    const animal = res.data.data.animal;
    await guardarLocalUno(animal, 0);
    return animal;
  }

  const db = await getDb();
  const row = await db.getFirstAsync('SELECT datos FROM animales WHERE id = ?', [id]);
  const actual = row ? JSON.parse(row.datos) : { id };
  const actualizado = { ...actual, ...datos, actualizado_en: new Date().toISOString() };
  await guardarLocalUno(actualizado, 1);
  await encolarMutacion({ entidad: 'animales', accion: 'cambiarEstado', entidadLocalId: id, payload: { datos } });
  return actualizado;
};

export const registrarPeso = async (id, datos) => {
  const esLocal = id.startsWith('local_');
  if (!esLocal && (await estaConectado())) {
    const res = await animalesService.registrarPeso(id, datos);
    // El peso_actual del animal se sincroniza solo vía trigger en el servidor;
    // refrescamos la copia local para reflejarlo.
    const detalle = await animalesService.obtener(id);
    await guardarLocalUno(detalle.data.data.animal, 0);
    return res.data.data.peso;
  }

  const db = await getDb();
  const row = await db.getFirstAsync('SELECT datos FROM animales WHERE id = ?', [id]);
  const actual = row ? JSON.parse(row.datos) : { id };
  const actualizado = { ...actual, peso_actual: datos.peso, actualizado_en: new Date().toISOString() };
  await guardarLocalUno(actualizado, 1);
  await encolarMutacion({ entidad: 'animales', accion: 'registrarPeso', entidadLocalId: id, payload: { datos } });
  return { ...datos, id: `local_peso_${Date.now()}`, pendienteSync: true };
};
