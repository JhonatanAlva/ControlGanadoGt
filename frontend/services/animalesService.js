// services/animalesService.js
import api from './api';
import { cuerpoConFoto } from './multipart';

export const animalesService = {
  listar: (params = {}) => api.get('/animales', { params }),
  obtener: (id) => api.get(`/animales/${id}`),
  crear: (datos, foto) => api.post('/animales', ...cuerpoConFoto(datos, foto)),
  actualizar: (id, datos, foto) => api.put(`/animales/${id}`, ...cuerpoConFoto(datos, foto)),
  cambiarEstado: (id, datos) => api.patch(`/animales/${id}/estado`, datos),
  eliminar: (id) => api.delete(`/animales/${id}`),
  registrarPeso: (id, datos) => api.post(`/animales/${id}/pesos`, datos),
  historialPesos: (id) => api.get(`/animales/${id}/pesos`),
};
