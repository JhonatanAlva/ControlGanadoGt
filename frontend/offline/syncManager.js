// offline/syncManager.js
// Procesa la cola de cambios hechos sin conexión, en orden, cuando vuelve la señal.
// Política de conflictos: "gana el último cambio que se sincroniza" (sin merge manual) —
// el backend no tiene control de versiones por registro, así que no se puede detectar
// un conflicto real; esto es una limitación conocida y aceptada para la v1 offline.
import NetInfo from '@react-native-community/netinfo';
import { getDb } from '../db/database';
import { animalesService } from '../services/animalesService';
import useAuthStore from '../stores/authStore';

let sincronizando = false;
const listeners = new Set();

export const suscribirseASync = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const notificar = (evento) => listeners.forEach((fn) => fn(evento));

const usuarioIdActual = () => useAuthStore.getState().usuario?.id || null;

export const encolarMutacion = async ({ entidad, accion, entidadLocalId, payload }) => {
  const db = await getDb();
  const id = `mut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db.runAsync(
    `INSERT INTO pending_mutations (id, usuario_id, entidad, accion, entidad_local_id, payload, creado_en, intentos)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, usuarioIdActual(), entidad, accion, entidadLocalId, JSON.stringify(payload), new Date().toISOString()],
  );
  notificar({ tipo: 'encolado' });
};

export const contarPendientes = async () => {
  const db = await getDb();
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) as total FROM pending_mutations WHERE usuario_id = ? AND rechazada = 0',
    [usuarioIdActual()],
  );
  return row?.total || 0;
};

export const listarRechazadas = async () => {
  const db = await getDb();
  return db.getAllAsync(
    'SELECT * FROM pending_mutations WHERE usuario_id = ? AND rechazada = 1 ORDER BY creado_en ASC',
    [usuarioIdActual()],
  );
};

// Quita de la cola los cambios de un registro que nunca llegó al servidor
export const descartarMutacionesDe = async (entidadLocalId) => {
  const db = await getDb();
  await db.runAsync('DELETE FROM pending_mutations WHERE entidad_local_id = ?', [entidadLocalId]);
  notificar({ tipo: 'encolado' });
};

// El usuario acepta perder los cambios que el servidor rechazó.
// Lo creado sin conexión se borra; lo editado vuelve a mostrarse como esté en el servidor.
export const descartarRechazadas = async () => {
  const db = await getDb();
  const rechazadas = await listarRechazadas();
  await db.withTransactionAsync(async () => {
    for (const m of rechazadas) {
      const tabla = m.entidad === 'animales' ? 'animales' : 'registros';
      if (m.accion === 'crear') {
        await db.runAsync(`DELETE FROM ${tabla} WHERE id = ?`, [m.entidad_local_id]);
        await db.runAsync('DELETE FROM pending_mutations WHERE entidad_local_id = ?', [m.entidad_local_id]);
      } else {
        await db.runAsync(`UPDATE ${tabla} SET pendiente_sync = 0 WHERE id = ?`, [m.entidad_local_id]);
        if (tabla === 'registros') {
          await db.runAsync('UPDATE registros SET eliminado = 0 WHERE id = ?', [m.entidad_local_id]);
        }
      }
      await db.runAsync('DELETE FROM pending_mutations WHERE id = ?', [m.id]);
    }
  });
  notificar({ tipo: 'terminado', procesadas: rechazadas.length });
};

// Reasigna el id local temporal ("local_...") por el id real que asignó el servidor:
// en la fila cacheada, en la cola, y en cualquier registro que lo referencie
// (p. ej. una vacuna creada sin conexión para un animal también creado sin conexión).
export const remapearId = async (entidad, idLocal, idReal) => {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    if (entidad === 'animales') {
      const row = await db.getFirstAsync('SELECT * FROM animales WHERE id = ?', [idLocal]);
      if (row) {
        const datos = { ...JSON.parse(row.datos), id: idReal };
        await db.runAsync('DELETE FROM animales WHERE id = ?', [idLocal]);
        await db.runAsync(
          'INSERT INTO animales (id, usuario_id, datos, pendiente_sync, actualizado_en) VALUES (?, ?, ?, 0, ?)',
          [idReal, row.usuario_id, JSON.stringify(datos), datos.actualizado_en || new Date().toISOString()],
        );
      }
    } else {
      const row = await db.getFirstAsync('SELECT * FROM registros WHERE entidad = ? AND id = ?', [entidad, idLocal]);
      if (row) {
        const datos = { ...JSON.parse(row.datos), id: idReal };
        await db.runAsync('DELETE FROM registros WHERE entidad = ? AND id = ?', [entidad, idLocal]);
        await db.runAsync(
          `INSERT OR REPLACE INTO registros (entidad, id, usuario_id, datos, pendiente_sync, eliminado, actualizado_en)
           VALUES (?, ?, ?, ?, ?, 0, ?)`,
          [entidad, idReal, row.usuario_id, JSON.stringify(datos), row.pendiente_sync, row.actualizado_en],
        );
      }
    }

    await db.runAsync(
      'UPDATE pending_mutations SET entidad_local_id = ? WHERE entidad_local_id = ?',
      [idReal, idLocal],
    );
    // Los ids locales son únicos ("local_<timestamp>_<aleatorio>"), así que REPLACE es seguro
    await db.runAsync(
      'UPDATE pending_mutations SET payload = REPLACE(payload, ?, ?) WHERE instr(payload, ?) > 0',
      [idLocal, idReal, idLocal],
    );
    await db.runAsync(
      'UPDATE registros SET datos = REPLACE(datos, ?, ?) WHERE instr(datos, ?) > 0',
      [idLocal, idReal, idLocal],
    );
    await db.runAsync(
      'UPDATE animales SET datos = REPLACE(datos, ?, ?) WHERE instr(datos, ?) > 0',
      [idLocal, idReal, idLocal],
    );
  });
};

// Cuando ya no quedan cambios en cola para un registro, deja de estar "pendiente"
const marcarSincronizado = async (id) => {
  const db = await getDb();
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) AS total FROM pending_mutations WHERE entidad_local_id = ? AND rechazada = 0',
    [id],
  );
  if ((row?.total || 0) === 0) {
    await db.runAsync('UPDATE animales SET pendiente_sync = 0 WHERE id = ?', [id]);
    await db.runAsync('UPDATE registros SET pendiente_sync = 0 WHERE id = ?', [id]);
  }
};

const ejecutarAnimal = async (mut, payload) => {
  if (mut.accion === 'crear') {
    const res = await animalesService.crear(payload.datos, payload.foto);
    const idReal = res.data.data.animal.id;
    await remapearId('animales', mut.entidad_local_id, idReal);
    return idReal;
  }
  if (mut.accion === 'actualizar') {
    await animalesService.actualizar(mut.entidad_local_id, payload.datos, payload.foto);
  } else if (mut.accion === 'cambiarEstado') {
    await animalesService.cambiarEstado(mut.entidad_local_id, payload.datos);
  } else if (mut.accion === 'registrarPeso') {
    await animalesService.registrarPeso(mut.entidad_local_id, payload.datos);
  }
  return mut.entidad_local_id;
};

// Cada entidad registra cómo enviar sus cambios al servidor (ver crearRepoOffline.js).
// Un ejecutor devuelve el id final del registro (cambia al crear).
const ejecutores = { animales: ejecutarAnimal };
export const registrarEjecutor = (entidad, fn) => { ejecutores[entidad] = fn; };

// 4xx = el servidor rechazó los datos: reintentar no sirve.
// Excepto 401 (sesión vencida), 408 y 429 (temporales).
const esRechazo = (status) => status >= 400 && status < 500 && ![401, 408, 429].includes(status);

export const procesarCola = async () => {
  if (sincronizando) return;
  const estadoRed = await NetInfo.fetch();
  if (!estadoRed.isConnected || estadoRed.isInternetReachable === false) return;

  sincronizando = true;
  notificar({ tipo: 'iniciando' });
  let procesadas = 0;

  try {
    const db = await getDb();
    const pendientes = await db.getAllAsync(
      'SELECT * FROM pending_mutations WHERE usuario_id = ? AND rechazada = 0 ORDER BY creado_en ASC',
      [usuarioIdActual()],
    );

    for (const mut of pendientes) {
      const ejecutor = ejecutores[mut.entidad];
      if (!ejecutor) continue;
      try {
        // Releer: un remapeo anterior en esta misma pasada pudo cambiar ids dentro del payload
        const actual = await db.getFirstAsync('SELECT * FROM pending_mutations WHERE id = ?', [mut.id]);
        if (!actual) continue;
        const idFinal = await ejecutor(actual, JSON.parse(actual.payload));
        await db.runAsync('DELETE FROM pending_mutations WHERE id = ?', [mut.id]);
        await marcarSincronizado(idFinal || actual.entidad_local_id);
        procesadas++;
      } catch (err) {
        const status = err?.response?.status;
        await db.runAsync(
          'UPDATE pending_mutations SET intentos = intentos + 1, error = ?, rechazada = ? WHERE id = ?',
          [err?.mensaje || err?.message || 'Error desconocido', esRechazo(status) ? 1 : 0, mut.id],
        );
        // Rechazo → se salta y queda marcada para que el usuario decida.
        // Error de red/servidor → se detiene la cola, se reintenta completa la próxima vez.
        if (!esRechazo(status)) break;
      }
    }
  } finally {
    sincronizando = false;
    notificar({ tipo: 'terminado', procesadas });
  }
};

let unsubscribeNetInfo = null;
export const iniciarSyncAutomatico = () => {
  if (unsubscribeNetInfo) return;
  unsubscribeNetInfo = NetInfo.addEventListener((estado) => {
    if (estado.isConnected && estado.isInternetReachable !== false) {
      procesarCola();
    }
  });
};
