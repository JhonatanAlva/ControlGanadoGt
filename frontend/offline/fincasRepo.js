// offline/fincasRepo.js
// Solo lectura sin conexión: las fincas se crean y editan con señal (es poco frecuente),
// pero la lista hace falta offline para los formularios y el filtro de finca activa.
import { fincasService } from '../services/fincasService';
import { crearRepoOffline } from './crearRepoOffline';

const repo = crearRepoOffline({
  entidad: 'fincas',
  service: fincasService,
  clave: 'finca',
  extraerLista: (res) => res.data.data.fincas,
  ordenar: (a, b) => (a.nombre || '').localeCompare(b.nombre || ''),
});

export const fincasRepo = { listar: () => repo.listar() };
