// __tests__/limitesPlan.test.js
jest.mock('react-native', () => ({ Alert: { alert: jest.fn() } }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockUsuario = { id: 'usuario-1', plan: 'free' };
jest.mock('../stores/authStore', () => ({
  __esModule: true,
  default: { getState: () => ({ usuario: mockUsuario }) },
}));
jest.mock('../services/fincasService', () => ({ fincasService: {} }));
jest.mock('../services/animalesService', () => ({ animalesService: {} }));

const { Alert } = require('react-native');
const { initDb } = require('../db/database');
const { fincasRepo } = require('../offline/fincasRepo');
const animalesRepo = require('../offline/animalesRepo');
const { verificarLimitePlan } = require('../utils/limitesPlan');

beforeAll(async () => {
  global.conectado = false; // todo sin señal: el conteo sale de la base local
  await initDb();
});

beforeEach(() => Alert.alert.mockClear());

test('plan free: permite la primera finca y bloquea la segunda con aviso', async () => {
  expect(await verificarLimitePlan('fincas')).toBe(true);
  await fincasRepo.crear({ nombre: 'El Patrón' });

  expect(await verificarLimitePlan('fincas')).toBe(false);
  expect(Alert.alert).toHaveBeenCalledWith(
    'Límite del plan gratuito',
    expect.stringContaining('máximo 1 finca'),
    expect.any(Array),
  );
});

test('plan free: cuenta los animales activos creados sin conexión', async () => {
  for (let i = 0; i < 9; i++) {
    await animalesRepo.crear({ numero_arete: `A-${i}`, raza: 'Brahman', sexo: 'Hembra', tipo: 'Vaca', estado: 'Activo' });
  }
  expect(await verificarLimitePlan('animales')).toBe(true);

  await animalesRepo.crear({ numero_arete: 'A-9', raza: 'Brahman', sexo: 'Hembra', tipo: 'Vaca', estado: 'Activo' });
  expect(await verificarLimitePlan('animales')).toBe(false);
});

test('plan pro: sin límite', async () => {
  mockUsuario.plan = 'pro';
  expect(await verificarLimitePlan('fincas')).toBe(true);
  expect(await verificarLimitePlan('animales')).toBe(true);
  expect(Alert.alert).not.toHaveBeenCalled();
});
