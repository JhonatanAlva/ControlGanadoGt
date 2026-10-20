// __tests__/fotosPesosComunidad.test.js
// Fotos tomadas sin señal, historial de pesos y Comunidad sin conexión.

jest.mock('../stores/authStore', () => ({
  __esModule: true,
  default: { getState: () => ({ usuario: { id: 'usuario-1', nombre: 'Jhonatan' } }) },
}));

const mockServidor = { animales: new Map(), pesos: [], posts: new Map() };
let mockContador = 0;
const mockRespuesta = (data, meta) => ({ data: { data, ...(meta && { meta }) } });
const mockExigirRed = () => {
  if (!global.conectado) {
    const err = new Error('Network Error');
    err.code = 'ERR_NETWORK';
    throw err;
  }
};

jest.mock('../services/animalesService', () => ({
  animalesService: {
    listar: jest.fn(async () => {
      mockExigirRed();
      const items = [...mockServidor.animales.values()];
      return mockRespuesta(items, { total: items.length });
    }),
    obtener: jest.fn(async (id) => {
      mockExigirRed();
      return mockRespuesta({ animal: mockServidor.animales.get(id) });
    }),
    crear: jest.fn(async (datos, foto) => {
      mockExigirRed();
      const animal = { ...datos, id: `srv-${++mockContador}`, foto_url: foto ? 'https://cdn/animal.jpg' : null };
      mockServidor.animales.set(animal.id, animal);
      return mockRespuesta({ animal });
    }),
    registrarPeso: jest.fn(async (id, datos) => {
      mockExigirRed();
      const peso = { ...datos, id: `peso-${++mockContador}`, animal_id: id, gdp: 1.2 };
      mockServidor.pesos.push(peso);
      return mockRespuesta({ peso });
    }),
    historialPesos: jest.fn(async (id) => {
      mockExigirRed();
      return mockRespuesta({ pesos: mockServidor.pesos.filter((p) => p.animal_id === id) });
    }),
  },
}));

jest.mock('../services/comunidadService', () => ({
  comunidadService: {
    listar: jest.fn(async () => {
      mockExigirRed();
      const items = [...mockServidor.posts.values()];
      return mockRespuesta(items, { total: items.length });
    }),
    obtener: jest.fn(async (id) => {
      mockExigirRed();
      return mockRespuesta({ post: mockServidor.posts.get(id) });
    }),
    crear: jest.fn(async (datos, foto) => {
      mockExigirRed();
      const post = {
        ...datos, id: `post-${++mockContador}`, autor_id: 'usuario-1', autor_nombre: 'Jhonatan',
        likes: 0, foto_url: foto ? 'https://cdn/post.jpg' : null,
      };
      mockServidor.posts.set(post.id, post);
      return mockRespuesta({ post });
    }),
    actualizar: jest.fn(async (id, datos) => {
      mockExigirRed();
      const post = { ...mockServidor.posts.get(id), ...datos };
      mockServidor.posts.set(id, post);
      return mockRespuesta({ post });
    }),
    eliminar: jest.fn(async (id) => {
      mockExigirRed();
      mockServidor.posts.delete(id);
      return { data: {} };
    }),
  },
}));

const { initDb } = require('../db/database');
const animalesRepo = require('../offline/animalesRepo');
const { comunidadRepo } = require('../offline/comunidadRepo');
const { procesarCola, contarPendientes } = require('../offline/syncManager');
const { animalesService } = require('../services/animalesService');
const { comunidadService } = require('../services/comunidadService');

const FOTO_CAMARA = { uri: 'file:///cache/ImagePicker/IMG_1.jpg', fileName: 'IMG_1.jpg', mimeType: 'image/jpeg' };
const pendientes = () => [...global.archivos].filter((a) => a.includes('fotos-pendientes'));

beforeAll(async () => {
  global.conectado = true;
  await initDb();
});

describe('fotos tomadas sin señal', () => {
  test('sobreviven a que Android limpie la caché y se suben al reconectar', async () => {
    global.archivos.add(FOTO_CAMARA.uri);
    global.conectado = false;

    const animal = await animalesRepo.crear(
      { numero_arete: 'F-1', raza: 'Gyr', sexo: 'Hembra', tipo: 'Vaca' },
      FOTO_CAMARA,
    );
    // Se muestra desde la copia permanente
    expect(animal.foto_url).toContain('fotos-pendientes');
    expect(pendientes()).toHaveLength(1);

    global.archivos.delete(FOTO_CAMARA.uri); // Android limpió la caché

    global.conectado = true;
    await procesarCola();

    const fotoEnviada = animalesService.crear.mock.calls.at(-1)[1];
    expect(fotoEnviada.uri).toContain('fotos-pendientes');
    expect(pendientes()).toHaveLength(0); // se borra después de subirla
  });
});

describe('historial de pesos', () => {
  let idVaca;

  test('se guarda para verse sin señal', async () => {
    global.conectado = true;
    idVaca = [...mockServidor.animales.keys()][0];
    await animalesRepo.registrarPeso(idVaca, { peso: 400, fecha: '2026-09-01' });
    expect(await animalesRepo.historialPesos(idVaca)).toHaveLength(1);

    global.conectado = false;
    const offline = await animalesRepo.historialPesos(idVaca);
    expect(offline.map((p) => p.peso)).toEqual([400]);
  });

  test('un pesaje sin señal aparece al instante y se envía al reconectar', async () => {
    global.conectado = false;
    await animalesRepo.registrarPeso(idVaca, { peso: 430, fecha: '2026-10-01' });

    const offline = await animalesRepo.historialPesos(idVaca);
    expect(offline[0]).toMatchObject({ peso: 430, _local: true });
    expect(offline).toHaveLength(2);

    global.conectado = true;
    await procesarCola();
    const online = await animalesRepo.historialPesos(idVaca);
    expect(online).toHaveLength(2); // sin duplicar el pesaje local
    expect(online.some((p) => p._local)).toBe(false);
    expect(online[0].gdp).toBe(1.2);
  });

  test('un animal creado sin señal conserva su historial al sincronizar', async () => {
    global.conectado = false;
    const ternero = await animalesRepo.crear({ numero_arete: 'T-1', raza: 'Gyr', sexo: 'Macho', tipo: 'Ternero' });
    await animalesRepo.registrarPeso(ternero.id, { peso: 80, fecha: '2026-10-10' });

    global.conectado = true;
    await procesarCola();
    const idReal = [...mockServidor.animales.values()].find((a) => a.numero_arete === 'T-1').id;
    expect(mockServidor.pesos.some((p) => p.animal_id === idReal && p.peso === 80)).toBe(true);
  });
});

describe('Comunidad sin conexión', () => {
  let post;

  test('se puede publicar con foto y aparece con el autor', async () => {
    global.archivos.add(FOTO_CAMARA.uri);
    global.conectado = false;

    post = await comunidadRepo.crear(
      { tipo: 'Venta de animal', titulo: 'Vendo novilla', contenido: 'Novilla Brahman de 2 años', region: 'Jalapa', precio: 8000 },
      FOTO_CAMARA,
    );
    expect(post.autor_nombre).toBe('Jhonatan');
    expect(post.foto_url).toContain('fotos-pendientes');

    const lista = await comunidadRepo.listar({ region: 'Jalapa' });
    expect(lista.map((p) => p.titulo)).toEqual(['Vendo novilla']);
  });

  test('se puede editar antes de enviarla, y al reconectar se publica con foto', async () => {
    await comunidadRepo.actualizar(post.id, { precio: 7500 });

    global.conectado = true;
    await procesarCola();

    const enServidor = [...mockServidor.posts.values()][0];
    expect(enServidor.precio).toBe(7500);
    expect(enServidor.foto_url).toBe('https://cdn/post.jpg');
    expect(comunidadService.crear.mock.calls[0][1].uri).toContain('fotos-pendientes');
    expect(await contarPendientes()).toBe(0);
  });

  test('las publicaciones vistas con señal se pueden leer sin señal', async () => {
    global.conectado = true;
    await comunidadRepo.listar();
    global.conectado = false;
    const detalle = await comunidadRepo.obtener([...mockServidor.posts.keys()][0]);
    expect(detalle.titulo).toBe('Vendo novilla');
  });
});
