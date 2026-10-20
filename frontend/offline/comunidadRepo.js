// offline/comunidadRepo.js
// Sin señal: se leen las últimas publicaciones vistas y se pueden publicar, editar o
// borrar las propias (se envían al volver la señal). Los likes necesitan conexión.
import { comunidadService } from '../services/comunidadService';
import { crearRepoOffline } from './crearRepoOffline';
import useAuthStore from '../stores/authStore';

// Una publicación hecha sin conexión aún no trae del servidor los datos del autor
const completar = async (posts) => {
  const usuario = useAuthStore.getState().usuario;
  return posts.map((p) => ({
    ...p,
    autor_id: p.autor_id ?? usuario?.id,
    autor_nombre: p.autor_nombre ?? usuario?.nombre,
    likes: p.likes ?? 0,
    yo_di_like: p.yo_di_like ?? false,
  }));
};

const filtrar = (posts, f) => {
  const q = f.search?.toLowerCase();
  return posts.filter((p) =>
    (!f.tipo || p.tipo === f.tipo)
    && (!f.region || p.region === f.region)
    && (!q || `${p.titulo} ${p.contenido}`.toLowerCase().includes(q)));
};

export const comunidadRepo = crearRepoOffline({
  entidad: 'comunidad',
  service: comunidadService,
  clave: 'post',
  completar,
  filtrar,
  ordenar: (a, b) => String(b.creado_en).localeCompare(String(a.creado_en)),
});
