// offline/vacunasRepo.js
import { vacunasService } from '../services/vacunasService';
import { crearRepoOffline } from './crearRepoOffline';
import { leerAnimalesLocales } from './animalesRepo';
import { hoyISO, dia, sumarDias } from './fechas';

// Mismos criterios que el CASE de urgencia en vacunas.repository.js del backend
const urgencia = (proxima, hoy) => {
  if (!proxima || proxima > sumarDias(hoy, 30)) return 'Al día';
  if (proxima < hoy) return 'Vencida';
  if (proxima <= sumarDias(hoy, 7)) return 'Esta semana';
  return 'Próxima';
};

const completar = async (vacunas) => {
  const animales = await leerAnimalesLocales();
  const hoy = hoyISO();
  return vacunas.map((v) => {
    const animal = animales.get(v.animal_id);
    return {
      ...v,
      numero_arete: v.numero_arete ?? animal?.numero_arete,
      animal_nombre: v.animal_nombre ?? animal?.nombre,
      urgencia: urgencia(dia(v.proxima_dosis), hoy),
      // Igual que el backend: la finca de la vacuna o, si no tiene, la del animal
      _finca_id: v.finca_id || animal?.finca_id || null,
    };
  });
};

const filtrar = (vacunas, f) => {
  const limite = sumarDias(hoyISO(), 30);
  return vacunas.filter((v) =>
    (!f.animal_id || v.animal_id === f.animal_id)
    && (!f.finca_id || v._finca_id === f.finca_id)
    && (!f.tipo_vacuna || v.tipo_vacuna === f.tipo_vacuna)
    && (f.pendientes !== 'true' || (dia(v.proxima_dosis) && dia(v.proxima_dosis) <= limite)));
};

export const vacunasRepo = crearRepoOffline({
  entidad: 'vacunas',
  service: { ...vacunasService, crear: vacunasService.registrar },
  clave: 'vacuna',
  completar,
  filtrar,
  ordenar: (a, b) => (dia(b.fecha_aplicacion) || '').localeCompare(dia(a.fecha_aplicacion) || ''),
});
