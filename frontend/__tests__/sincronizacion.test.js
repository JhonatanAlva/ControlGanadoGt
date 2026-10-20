// __tests__/sincronizacion.test.js
// Flujo completo sin conexión → con conexión, contra un mockServidor falso en memoria
// que rechaza referencias a ids inexistentes (detecta ids locales sin remapear).

// ── Servidor falso ───────────────────────────────────────────────────────────
const mockServidor = { animales: new Map(), vacunas: new Map(), partos: new Map(), gastos: new Map(), fincas: new Map() };
let mockContador = 0;
const mockUuid = () => `srv-${++mockContador}`;

const mockErrorHttp = (status, message) => {
  const err = new Error(message);
  err.response = { status, data: { message } };
  err.mensaje = message;
  return err;
};
const mockSinRed = () => {
  const err = new Error('Network Error');
  err.code = 'ERR_NETWORK';
  return err;
};
const mockRespuesta = (data, meta) => ({ data: { data, ...(meta && { meta }) } });

const mockExigirRed = () => { if (!global.conectado) throw mockSinRed(); };
const mockExigirAnimal = (id) => {
  if (id && !mockServidor.animales.has(id)) throw mockErrorHttp(404, `Animal ${id} no encontrado.`);
};

const mockCrud = (tabla, clave, validar = () => {}) => ({
  listar: jest.fn(async () => {
    mockExigirRed();
    const items = [...mockServidor[tabla].values()];
    return mockRespuesta(items, { total: items.length });
  }),
  obtener: jest.fn(async (id) => {
    mockExigirRed();
    if (!mockServidor[tabla].has(id)) throw mockErrorHttp(404, 'No encontrado.');
    return mockRespuesta({ [clave]: mockServidor[tabla].get(id) });
  }),
  crear: jest.fn(async (datos) => {
    mockExigirRed();
    validar(datos);
    const item = { ...datos, id: mockUuid() };
    mockServidor[tabla].set(item.id, item);
    return mockRespuesta({ [clave]: item });
  }),
  actualizar: jest.fn(async (id, datos) => {
    mockExigirRed();
    if (!mockServidor[tabla].has(id)) throw mockErrorHttp(404, 'No encontrado.');
    validar(datos);
    const item = { ...mockServidor[tabla].get(id), ...datos };
    mockServidor[tabla].set(id, item);
    return mockRespuesta({ [clave]: item });
  }),
  eliminar: jest.fn(async (id) => {
    mockExigirRed();
    if (!mockServidor[tabla].delete(id)) throw mockErrorHttp(404, 'No encontrado.');
    return { data: {} };
  }),
});

jest.mock('../services/animalesService', () => {
  const base = mockCrud('animales', 'animal');
  return { animalesService: { ...base, crear: jest.fn((datos) => base.crear(datos)) } };
});
jest.mock('../services/vacunasService', () => {
  const base = mockCrud('vacunas', 'vacuna', (d) => mockExigirAnimal(d.animal_id));
  return { vacunasService: { ...base, registrar: base.crear } };
});
jest.mock('../services/partosService', () => {
  const base = mockCrud('partos', 'parto', (d) => mockExigirAnimal(d.madre_id));
  return {
    partosService: {
      ...base,
      registrarServicio: base.crear,
      registrarResultado: jest.fn(async (id, datos) => {
        mockExigirRed();
        const parto = { ...mockServidor.partos.get(id), ...datos };
        mockServidor.partos.set(id, parto);
        return mockRespuesta({ parto, cria_creada: false });
      }),
    },
  };
});
jest.mock('../services/gastosService', () => {
  const base = mockCrud('gastos', 'gasto', (d) => {
    mockExigirAnimal(d.animal_id);
    if (d.monto <= 0) throw mockErrorHttp(422, 'El monto debe ser positivo.');
  });
  return { gastosService: { ...base, resumenMensual: jest.fn(), resumenCategoria: jest.fn() } };
});
jest.mock('../services/fincasService', () => {
  const base = mockCrud('fincas', 'finca');
  return {
    fincasService: {
      ...base,
      listar: jest.fn(async () => {
        mockExigirRed();
        return { data: { data: { fincas: [...mockServidor.fincas.values()] } } };
      }),
    },
  };
});

// ── Módulos bajo prueba ──────────────────────────────────────────────────────
const { initDb, getDb } = require('../db/database');
const animalesRepo = require('../offline/animalesRepo');
const { vacunasRepo } = require('../offline/vacunasRepo');
const { partosRepo } = require('../offline/partosRepo');
const { gastosRepo } = require('../offline/gastosRepo');
const { fincasRepo } = require('../offline/fincasRepo');
const {
  procesarCola, contarPendientes, listarRechazadas, descartarRechazadas,
} = require('../offline/syncManager');
const { hoyISO, sumarDias } = require('../offline/fechas');
const useFincaStore = require('../stores/fincaStore').default;

const sinIdsLocales = (obj) => !JSON.stringify(obj).includes('local_');

beforeAll(async () => {
  global.conectado = true;
  await initDb();
  mockServidor.fincas.set('finca-a', { id: 'finca-a', nombre: 'El Roble' });
  mockServidor.fincas.set('finca-b', { id: 'finca-b', nombre: 'La Ceiba' });
  await fincasRepo.listar(); // queda en caché para usarse offline
});

describe('sin conexión → con conexión', () => {
  let vaca;
  let vacuna;
  let parto;
  let gasto;

  test('se puede registrar todo sin señal, con campos calculados en el teléfono', async () => {
    global.conectado = false;

    vaca = await animalesRepo.crear({
      numero_arete: 'V-100', nombre: 'Lucera', raza: 'Brahman', sexo: 'Hembra', tipo: 'Vaca', finca_id: 'finca-a',
    });
    expect(vaca.id).toMatch(/^local_/);

    const proxima = sumarDias(hoyISO(), 3);
    vacuna = await vacunasRepo.crear({
      animal_id: vaca.id, tipo_vacuna: 'Aftosa', fecha_aplicacion: hoyISO(), proxima_dosis: proxima,
    });
    expect(vacuna._local).toBe(true);
    expect(vacuna.urgencia).toBe('Esta semana');
    expect(vacuna.numero_arete).toBe('V-100');

    parto = await partosRepo.registrarServicio({
      madre_id: vaca.id, tipo_reproduccion: 'Monta natural', fecha_servicio: '2026-01-15',
    });
    expect(parto.fecha_parto_esperada).toBe('2026-10-22');
    expect(parto.madre_nombre).toBe('Lucera');

    gasto = await gastosRepo.crear({ tipo: 'Gasto', categoria: 'Veterinario', monto: 150, fecha: hoyISO(), animal_id: vaca.id });

    expect(await contarPendientes()).toBe(4);
  });

  test('sin señal se filtra por la finca del animal y se calcula el balance', async () => {
    expect(await vacunasRepo.listar({ finca_id: 'finca-a' })).toHaveLength(1);
    expect(await vacunasRepo.listar({ finca_id: 'finca-b' })).toHaveLength(0);
    expect(await vacunasRepo.listar({ pendientes: 'true' })).toHaveLength(1);
    expect(await gastosRepo.listar({ finca_id: 'finca-a' })).toHaveLength(1);

    const resumen = await gastosRepo.resumenMensual(new Date().getFullYear(), 'finca-a');
    expect(resumen.totales.total_gastos).toBe(150);
    expect(resumen.totales.balance).toBe(-150);

    const { total } = await partosRepo.listarConTotal({ finca_id: 'finca-a' });
    expect(total).toBe(1);
  });

  test('al volver la señal todo llega al mockServidor con los ids reales', async () => {
    global.conectado = true;
    await procesarCola();

    expect(await contarPendientes()).toBe(0);
    expect(mockServidor.animales.size).toBe(1);
    const [idVacaReal] = mockServidor.animales.keys();

    expect([...mockServidor.vacunas.values()][0].animal_id).toBe(idVacaReal);
    expect([...mockServidor.partos.values()][0].madre_id).toBe(idVacaReal);
    expect([...mockServidor.gastos.values()][0].animal_id).toBe(idVacaReal);

    // Caché local sin rastros de ids temporales ni pendientes
    const db = await getDb();
    const registros = await db.getAllAsync('SELECT * FROM registros');
    const animales = await db.getAllAsync('SELECT * FROM animales');
    expect(sinIdsLocales(registros)).toBe(true);
    expect(sinIdsLocales(animales)).toBe(true);
    expect(registros.every((r) => r.pendiente_sync === 0)).toBe(true);
  });

  test('editar y eliminar sin señal se aplica al reconectar', async () => {
    const [idVacuna] = mockServidor.vacunas.keys();
    const [idGasto] = mockServidor.gastos.keys();
    const [idParto] = mockServidor.partos.keys();

    global.conectado = false;
    const editada = await vacunasRepo.actualizar(idVacuna, { nombre_producto: 'Aftogan' });
    expect(editada._local).toBe(true);
    expect((await vacunasRepo.obtener(idVacuna)).nombre_producto).toBe('Aftogan');

    await gastosRepo.eliminar(idGasto);
    expect(await gastosRepo.listar()).toHaveLength(0);

    const res = await partosRepo.registrarResultado(idParto, { fecha_parto: hoyISO(), tipo_parto: 'Normal', resultado: 'Vivo' });
    expect(res._local).toBe(true);
    expect(res.parto.estado_parto).toBe('Completado');

    global.conectado = true;
    await procesarCola();
    expect(mockServidor.vacunas.get(idVacuna).nombre_producto).toBe('Aftogan');
    expect(mockServidor.gastos.has(idGasto)).toBe(false);
    expect(mockServidor.partos.get(idParto).resultado).toBe('Vivo');
    expect(await contarPendientes()).toBe(0);
  });

  test('borrar algo creado sin señal que nunca se envió no manda nada al mockServidor', async () => {
    global.conectado = false;
    const g = await gastosRepo.crear({ tipo: 'Ingreso', categoria: 'Otros', monto: 50, fecha: hoyISO() });
    await gastosRepo.eliminar(g.id);
    expect(await contarPendientes()).toBe(0);

    global.conectado = true;
    const { gastosService } = require('../services/gastosService');
    gastosService.crear.mockClear();
    await procesarCola();
    expect(gastosService.crear).not.toHaveBeenCalled();
  });
});

describe('cambios rechazados por el mockServidor', () => {
  test('no bloquean la cola, quedan marcados y se pueden descartar', async () => {
    global.conectado = false;
    const malo = await gastosRepo.crear({ tipo: 'Gasto', categoria: 'Otros', monto: -5, fecha: hoyISO() });
    await gastosRepo.crear({ tipo: 'Gasto', categoria: 'Transporte', monto: 80, fecha: hoyISO() });

    global.conectado = true;
    await procesarCola();

    // El bueno pasó aunque el anterior fue rechazado
    expect([...mockServidor.gastos.values()].some((g) => g.categoria === 'Transporte')).toBe(true);
    const rechazadas = await listarRechazadas();
    expect(rechazadas).toHaveLength(1);
    expect(rechazadas[0].error).toBe('El monto debe ser positivo.');
    expect(await contarPendientes()).toBe(0);

    // Reintentar no lo vuelve a enviar
    const { gastosService } = require('../services/gastosService');
    gastosService.crear.mockClear();
    await procesarCola();
    expect(gastosService.crear).not.toHaveBeenCalled();

    await descartarRechazadas();
    expect(await listarRechazadas()).toHaveLength(0);
    global.conectado = false;
    expect((await gastosRepo.listar()).some((g) => g.id === malo.id)).toBe(false);
  });
});

describe('caché', () => {
  test('un listado completo con señal borra lo eliminado desde otro dispositivo', async () => {
    global.conectado = true;
    await vacunasRepo.listar();
    const [idVacuna] = mockServidor.vacunas.keys();
    mockServidor.vacunas.delete(idVacuna); // otro dispositivo la eliminó
    await vacunasRepo.listar();

    global.conectado = false;
    expect((await vacunasRepo.listar()).some((v) => v.id === idVacuna)).toBe(false);
  });

  test('una finca creada sin señal se sincroniza con sus animales y sigue activa', async () => {
    global.conectado = false;
    const finca = await fincasRepo.crear({ nombre: 'Finca El Patrón', hectareas: 11 });
    expect(finca.id).toMatch(/^local_/);
    expect(finca.total_animales).toBe(0);
    await useFincaStore.getState().setFincaActiva(finca.id);
    await animalesRepo.crear({ numero_arete: 'P-1', raza: 'Angus', sexo: 'Macho', tipo: 'Toro', finca_id: finca.id });

    global.conectado = true;
    await procesarCola();

    const fincaReal = [...mockServidor.fincas.values()].find((f) => f.nombre === 'Finca El Patrón');
    const toro = [...mockServidor.animales.values()].find((a) => a.numero_arete === 'P-1');
    expect(toro.finca_id).toBe(fincaReal.id);
    expect(useFincaStore.getState().fincaActivaId).toBe(fincaReal.id);
    mockServidor.fincas.delete(fincaReal.id); // dejar el servidor como estaba para la siguiente prueba
    await fincasRepo.listar();
  });

  test('las fincas están disponibles sin señal', async () => {
    global.conectado = false;
    expect((await fincasRepo.listar()).map((f) => f.nombre)).toEqual(['El Roble', 'La Ceiba']);
  });
});
