// services/comunidadService.js
import api from './api';
import { cuerpoConFoto } from './multipart';

export const comunidadService = {
  listar: (params = {}) => api.get('/comunidad', { params }),
  obtener: (id) => api.get(`/comunidad/${id}`),
  misPosts: () => api.get('/comunidad/mis-posts'),
  crear: (datos, foto) => api.post('/comunidad', ...cuerpoConFoto(datos, foto)),
  actualizar: (id, datos, foto) => api.put(`/comunidad/${id}`, ...cuerpoConFoto(datos, foto)),
  eliminar: (id) => api.delete(`/comunidad/${id}`),
  toggleLike: (id) => api.post(`/comunidad/${id}/like`),
};
