// offline/crearRepoOffline.js
// Fábrica de repositorios "offline-first" (mismo patrón que animalesRepo.js, generalizado).
// Con señal: lee/escribe en el servidor y guarda copia en SQLite (tabla `registros`).
// Sin señal: lee de SQLite y encola los cambios; syncManager los envía al volver la señal.
import NetInfo from '@react-native-community/netinfo';
import { getDb } from '../db/database';
import { encolarMutacion, registrarEjecutor, remapearId, descartarMutacionesDe } from './syncManager';
import { guardarFotoPendiente, borrarFotoPendiente } from './fotosPendientes';
import useAuthStore from '../stores/authStore';

export const estaConectado = async () => {
  const estado = await NetInfo.fetch();
  return !!estado.isConnected && estado.isInternetReachable !== false;
};

export const esIdLocal = (id) => String(id).startsWith('local_');

const usuarioIdActual = () => useAuthStore.getState().usuario?.id || null;
const nuevoIdLocal = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ahora = () => new Date().toISOString();

// Sin respuesta por falta de red. Un timeout NO cuenta: el servidor pudo haber guardado
// y reenviarlo después crearía un duplicado.
const esErrorDeRed = (err) => !err?.response && err?.code === 'ERR_NETWORK';

// Con respuesta del servidor y no es un fallo suyo (5xx): el error es real, no de conexión
const esErrorDefinitivo = (err) => err?.response && err.response.status < 500;

const PARAMS_PAGINACION = ['page', 'limit'];
const sinFiltros = (filtros) => Object.keys(filtros).every((k) => PARAMS_PAGINACION.includes(k));

/**
 * @param {object}   cfg
 * @param {string}   cfg.entidad      - nombre en la tabla registros y en la cola ('vacunas'...)
 * @param {object}   cfg.service      - servicio HTTP con listar/obtener/crear/actualizar/eliminar
 *                                      (crear y actualizar reciben una foto opcional al final)
 * @param {string}   cfg.clave        - clave del objeto en las respuestas (res.data.data[clave])
 * @param {Function} [cfg.extraerLista] - (res) => array del listado
 * @param {Function} [cfg.completar]  - async (items) => items con campos calculados localmente
 * @param {Function} [cfg.filtrar]    - (items, filtros) => items que cumplen los filtros
 * @param {Function} [cfg.ordenar]    - comparador para Array.sort
 * @param {object}   [cfg.acciones]   - acciones extra: { nombre: { servidor(id, datos), fusionar(actual, datos) } }
 */
export const crearRepoOffline = ({
  entidad,
  service,
  clave,
  extraerLista = (res) => res.data.data,
  completar = async (items) => items,
  filtrar = (items) => items,
  ordenar,
  acciones = {},
}) => {
  // ── Caché local ────────────────────────────────────────────────────────────
  const guardarUno = async (item, pendiente = 0) => {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO registros (entidad, id, usuario_id, datos, pendiente_sync, eliminado, actualizado_en)
       VALUES (?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT(entidad, id) DO UPDATE SET
         datos = excluded.datos, pendiente_sync = excluded.pendiente_sync,
         eliminado = 0, actualizado_en = excluded.actualizado_en`,
      [entidad, item.id, usuarioIdActual(), JSON.stringify(item), pendiente, item.actualizado_en || ahora()],
    );
  };

  // Desde el servidor. No pisa filas con cambios locales sin sincronizar.
  // Si el listado está completo (sin filtros ni paginación cortada), además borra
  // lo que ya no existe en el servidor (eliminado desde otro dispositivo).
  const guardarLote = async (items, completo) => {
    const db = await getDb();
    const usuarioId = usuarioIdActual();
    await db.withTransactionAsync(async () => {
      for (const item of items) {
        await db.runAsync(
          `INSERT INTO registros (entidad, id, usuario_id, datos, pendiente_sync, eliminado, actualizado_en)
           VALUES (?, ?, ?, ?, 0, 0, ?)
           ON CONFLICT(entidad, id) DO UPDATE SET datos = excluded.datos, actualizado_en = excluded.actualizado_en
           WHERE registros.pendiente_sync = 0`,
          [entidad, item.id, usuarioId, JSON.stringify(item), item.actualizado_en || ahora()],
        );
      }
      if (completo) {
        const marcas = items.map(() => '?').join(', ');
        await db.runAsync(
          `DELETE FROM registros WHERE entidad = ? AND usuario_id = ? AND pendiente_sync = 0
           ${items.length ? `AND id NOT IN (${marcas})` : ''}`,
          [entidad, usuarioId, ...items.map((i) => i.id)],
        );
      }
    });
  };

  const leerTodos = async () => {
    const db = await getDb();
    const rows = await db.getAllAsync(
      'SELECT datos FROM registros WHERE entidad = ? AND usuario_id = ? AND eliminado = 0',
      [entidad, usuarioIdActual()],
    );
    return rows.map((r) => JSON.parse(r.datos));
  };

  const leerFila = async (id) => {
    const db = await getDb();
    return db.getFirstAsync('SELECT * FROM registros WHERE entidad = ? AND id = ?', [entidad, id]);
  };

  const borrarLocal = async (id) => {
    const db = await getDb();
    await db.runAsync('DELETE FROM registros WHERE entidad = ? AND id = ?', [entidad, id]);
  };

  const aplicarFiltros = async (items, filtros) => {
    let resultado = filtrar(await completar(items), filtros);
    if (ordenar) resultado = [...resultado].sort(ordenar);
    const limit = parseInt(filtros.limit, 10) || resultado.length;
    return { items: resultado.slice(0, limit), total: resultado.length };
  };

  // ── Lectura ────────────────────────────────────────────────────────────────
  const listarConTotal = async (filtros = {}) => {
    if (await estaConectado()) {
      try {
        const res = await service.listar(filtros);
        const items = extraerLista(res);
        const total = res.data.meta?.total ?? items.length;
        await guardarLote(items, sinFiltros(filtros) && items.length >= total);

        // Lo creado sin conexión que aún no se envía también debe verse
        const locales = (await leerTodos()).filter((x) => esIdLocal(x.id));
        const extra = locales.length ? (await aplicarFiltros(locales, filtros)).items : [];
        return { items: [...extra, ...items], total: total + extra.length };
      } catch (err) {
        if (esErrorDefinitivo(err)) throw err;
      }
    }
    return aplicarFiltros(await leerTodos(), filtros);
  };

  const listar = async (filtros = {}) => (await listarConTotal(filtros)).items;

  const obtener = async (id) => {
    if (!esIdLocal(id) && (await estaConectado())) {
      try {
        const res = await service.obtener(id);
        const item = res.data.data[clave];
        const fila = await leerFila(id);
        // Si hay cambios locales sin enviar, se muestra la versión local
        if (!fila?.pendiente_sync) {
          await guardarUno(item, 0);
          return item;
        }
      } catch (err) {
        if (esErrorDefinitivo(err)) throw err;
      }
    }
    const fila = await leerFila(id);
    if (!fila || fila.eliminado) throw new Error('Este registro no está disponible sin conexión.');
    return (await completar([JSON.parse(fila.datos)]))[0];
  };

  // ── Escritura ──────────────────────────────────────────────────────────────
  // Intenta en el servidor; si no hay red, aplica el cambio local y lo encola.
  const escribir = async (id, enServidor, enLocal) => {
    if (!(id && esIdLocal(id)) && (await estaConectado())) {
      try {
        return await enServidor();
      } catch (err) {
        if (!esErrorDeRed(err)) throw err;
      }
    }
    return enLocal();
  };

  // Sin señal, la foto se copia a almacenamiento permanente y se muestra desde ahí
  // hasta que el servidor devuelva su URL definitiva
  const crear = (datos, foto) => escribir(
    null,
    async () => {
      const res = await service.crear(datos, foto);
      const item = res.data.data[clave];
      await guardarUno(item, 0);
      return item;
    },
    async () => {
      const id = nuevoIdLocal();
      const fotoGuardada = await guardarFotoPendiente(foto);
      const item = {
        id, ...datos, ...(fotoGuardada && { foto_url: fotoGuardada.uri }), creado_en: ahora(), actualizado_en: ahora(),
      };
      await guardarUno(item, 1);
      await encolarMutacion({ entidad, accion: 'crear', entidadLocalId: id, payload: { datos, foto: fotoGuardada } });
      return { ...(await completar([item]))[0], _local: true };
    },
  );

  const actualizar = (id, datos, foto) => escribir(
    id,
    async () => {
      const res = await service.actualizar(id, datos, foto);
      const item = res.data.data[clave];
      await guardarUno(item, 0);
      return item;
    },
    async () => {
      const fila = await leerFila(id);
      const fotoGuardada = await guardarFotoPendiente(foto);
      const item = {
        ...(fila ? JSON.parse(fila.datos) : { id }), ...datos,
        ...(fotoGuardada && { foto_url: fotoGuardada.uri }), actualizado_en: ahora(),
      };
      await guardarUno(item, 1);
      await encolarMutacion({ entidad, accion: 'actualizar', entidadLocalId: id, payload: { datos, foto: fotoGuardada } });
      return { ...item, _local: true };
    },
  );

  const eliminar = async (id) => {
    // Nunca llegó al servidor: basta con olvidarlo
    if (esIdLocal(id)) {
      await borrarLocal(id);
      await descartarMutacionesDe(id);
      return { _local: true };
    }
    return escribir(
      id,
      async () => {
        await service.eliminar(id);
        await borrarLocal(id);
        return {};
      },
      async () => {
        const db = await getDb();
        await db.runAsync(
          'UPDATE registros SET eliminado = 1, pendiente_sync = 1 WHERE entidad = ? AND id = ?',
          [entidad, id],
        );
        await encolarMutacion({ entidad, accion: 'eliminar', entidadLocalId: id, payload: {} });
        return { _local: true };
      },
    );
  };

  // Acción propia de la entidad (p. ej. registrar el resultado de un parto)
  const ejecutarAccion = (nombre, id, datos) => {
    const { servidor, fusionar } = acciones[nombre];
    return escribir(
      id,
      async () => {
        const res = await servidor(id, datos);
        const item = res.data.data[clave];
        if (item) await guardarUno(item, 0);
        return res.data.data;
      },
      async () => {
        const fila = await leerFila(id);
        const item = { ...fusionar(fila ? JSON.parse(fila.datos) : { id }, datos), actualizado_en: ahora() };
        await guardarUno(item, 1);
        await encolarMutacion({ entidad, accion: nombre, entidadLocalId: id, payload: { datos } });
        return { [clave]: (await completar([item]))[0], _local: true };
      },
    );
  };

  // ── Envío de la cola al servidor ───────────────────────────────────────────
  registrarEjecutor(entidad, async (mut, { datos, foto }) => {
    const id = mut.entidad_local_id;
    if (mut.accion === 'crear') {
      const res = await service.crear(datos, foto);
      borrarFotoPendiente(foto);
      const idReal = res.data.data[clave].id;
      await remapearId(entidad, id, idReal);
      return idReal;
    }
    if (mut.accion === 'actualizar') {
      await service.actualizar(id, datos, foto);
      borrarFotoPendiente(foto);
    } else if (mut.accion === 'eliminar') {
      try {
        await service.eliminar(id);
      } catch (err) {
        if (err?.response?.status !== 404) throw err; // ya no existía: objetivo cumplido
      }
      await borrarLocal(id);
    } else if (acciones[mut.accion]) {
      await acciones[mut.accion].servidor(id, datos);
    } else {
      throw new Error(`Acción desconocida: ${mut.accion}`);
    }
    return id;
  });

  return {
    listar,
    listarConTotal,
    obtener,
    crear,
    actualizar,
    eliminar,
    ejecutarAccion,
    // Para cálculos locales (p. ej. resúmenes de gastos sin conexión)
    leerLocal: async () => completar(await leerTodos()),
  };
};
