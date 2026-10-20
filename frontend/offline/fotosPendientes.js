// offline/fotosPendientes.js
// La cámara y la galería entregan la foto en la caché temporal, que Android puede
// limpiar antes de que vuelva la señal. Las fotos que esperan sincronizarse se copian
// a una carpeta permanente de la app y se borran después de subirlas.
import { File, Directory, Paths } from 'expo-file-system';

const carpeta = () => {
  const dir = new Directory(Paths.document, 'fotos-pendientes');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
};

/**
 * Copia la foto a almacenamiento permanente.
 * @param {{ uri: string, fileName?: string, mimeType?: string }} foto
 * @returns {object} misma foto apuntando a la copia permanente
 */
export const guardarFotoPendiente = (foto) => {
  if (!foto?.uri) return foto;
  const extension = (foto.fileName?.split('.').pop() || 'jpg').toLowerCase();
  const nombre = `foto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const destino = new File(carpeta(), nombre);
  new File(foto.uri).copy(destino);
  return { uri: destino.uri, fileName: nombre, mimeType: foto.mimeType || 'image/jpeg' };
};

// Borra la copia una vez subida (o si el cambio se descartó). Nunca falla.
export const borrarFotoPendiente = (foto) => {
  try {
    if (!foto?.uri?.includes('fotos-pendientes')) return;
    const archivo = new File(foto.uri);
    if (archivo.exists) archivo.delete();
  } catch {
    // Si no se pudo borrar, solo ocupa espacio; no afecta los datos
  }
};
