// offline/fincasRepo.js
import { fincasService } from '../services/fincasService';
import { crearRepoOffline } from './crearRepoOffline';

const repo = crearRepoOffline({
  entidad: 'fincas',
  service: fincasService,
  clave: 'finca',
  extraerLista: (res) => res.data.data.fincas,
  // Una finca creada sin conexión todavía no tiene animales contados por el servidor
  completar: async (fincas) => fincas.map((f) => ({ ...f, total_animales: f.total_animales ?? 0 })),
  ordenar: (a, b) => (a.nombre || '').localeCompare(b.nombre || ''),
});

export const fincasRepo = repo;
