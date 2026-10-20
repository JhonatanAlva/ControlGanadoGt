// offline/partosRepo.js
import { partosService } from '../services/partosService';
import { crearRepoOffline } from './crearRepoOffline';
import { leerAnimalesLocales } from './animalesRepo';
import { hoyISO, dia, sumarDias, diasEntre } from './fechas';

const DIAS_GESTACION = 280;

// Mismos criterios que el CASE de estado_parto en partos.repository.js del backend
const estadoParto = (p, esperada, hoy) => {
  if (p.fecha_parto) return 'Completado';
  if (!esperada) return 'Programado';
  if (esperada < hoy) return 'Atrasado';
  if (esperada <= sumarDias(hoy, 7)) return 'Esta semana';
  if (esperada <= sumarDias(hoy, 30)) return 'Próximo';
  return 'Programado';
};

const completar = async (partos) => {
  const animales = await leerAnimalesLocales();
  const hoy = hoyISO();
  return partos.map((p) => {
    const madre = animales.get(p.madre_id);
    // El backend la calcula con un trigger; sin conexión se calcula aquí
    const esperada = dia(p.fecha_parto_esperada)
      || (p.fecha_servicio ? sumarDias(dia(p.fecha_servicio), DIAS_GESTACION) : null);
    return {
      ...p,
      fecha_parto_esperada: esperada,
      madre_arete: p.madre_arete ?? madre?.numero_arete,
      madre_nombre: p.madre_nombre ?? madre?.nombre,
      estado_parto: estadoParto(p, esperada, hoy),
      dias_restantes: esperada ? diasEntre(hoy, esperada) : null,
      _finca_id: p.finca_id || madre?.finca_id || null,
    };
  });
};

const filtrar = (partos, f) => {
  const limite = sumarDias(hoyISO(), 30);
  return partos.filter((p) =>
    (!f.madre_id || p.madre_id === f.madre_id)
    && (!f.finca_id || p._finca_id === f.finca_id)
    && (!f.resultado || p.resultado === f.resultado)
    && (f.proximos !== 'true'
      || (!p.fecha_parto && p.fecha_parto_esperada && p.fecha_parto_esperada <= limite)));
};

const repo = crearRepoOffline({
  entidad: 'partos',
  service: { ...partosService, crear: partosService.registrarServicio },
  clave: 'parto',
  completar,
  filtrar,
  // Fecha esperada ascendente, sin fecha al final
  ordenar: (a, b) => (a.fecha_parto_esperada || '9999').localeCompare(b.fecha_parto_esperada || '9999'),
  acciones: {
    resultado: {
      servidor: (id, datos) => partosService.registrarResultado(id, datos),
      fusionar: (actual, datos) => ({ ...actual, ...datos }),
    },
  },
});

export const partosRepo = {
  ...repo,
  registrarServicio: repo.crear,
  // Sin conexión la cría NO se crea todavía: el servidor la crea al sincronizar
  registrarResultado: (id, datos) => repo.ejecutarAccion('resultado', id, datos),
};
