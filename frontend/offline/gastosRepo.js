// offline/gastosRepo.js
import { gastosService } from '../services/gastosService';
import { crearRepoOffline, estaConectado } from './crearRepoOffline';
import { leerAnimalesLocales } from './animalesRepo';
import { hoyISO, dia } from './fechas';

const completar = async (gastos) => {
  const animales = await leerAnimalesLocales();
  return gastos.map((g) => {
    const animal = g.animal_id ? animales.get(g.animal_id) : null;
    return {
      ...g,
      numero_arete: g.numero_arete ?? animal?.numero_arete,
      animal_nombre: g.animal_nombre ?? animal?.nombre,
      // Igual que el backend: la finca del movimiento o, si no tiene, la del animal
      _finca_id: g.finca_id || animal?.finca_id || null,
    };
  });
};

const filtrar = (gastos, f) => gastos.filter((g) =>
  (!f.finca_id || g._finca_id === f.finca_id)
  && (!f.animal_id || g.animal_id === f.animal_id)
  && (!f.tipo || g.tipo === f.tipo)
  && (!f.categoria || g.categoria === f.categoria)
  && (!f.fecha_desde || dia(g.fecha) >= f.fecha_desde)
  && (!f.fecha_hasta || dia(g.fecha) <= f.fecha_hasta));

const repo = crearRepoOffline({
  entidad: 'gastos',
  service: gastosService,
  clave: 'gasto',
  completar,
  filtrar,
  ordenar: (a, b) => (dia(b.fecha) || '').localeCompare(dia(a.fecha) || ''),
});

// Con señal el resumen viene del servidor; sin señal se calcula con los movimientos
// guardados en el teléfono (los que ya se vieron alguna vez más los registrados offline).
const conRespaldoLocal = async (enServidor, calcularLocal) => {
  if (await estaConectado()) {
    try {
      return await enServidor();
    } catch (err) {
      if (err?.response && err.response.status < 500) throw err;
    }
  }
  return calcularLocal();
};

const monto = (g) => parseFloat(g.monto) || 0;

const resumenMensual = (anio, fincaId) => conRespaldoLocal(
  async () => (await gastosService.resumenMensual(anio, fincaId)).data.data,
  async () => {
    const gastos = filtrar(await repo.leerLocal(), { finca_id: fincaId })
      .filter((g) => dia(g.fecha)?.startsWith(`${anio}-`));

    const porMes = {};
    for (const g of gastos) {
      const mes = dia(g.fecha).slice(0, 7);
      porMes[mes] ??= { mes, total_ingresos: 0, total_gastos: 0, balance: 0, total_movimientos: 0 };
      const m = porMes[mes];
      if (g.tipo === 'Ingreso') m.total_ingresos += monto(g);
      else m.total_gastos += monto(g);
      m.balance = m.total_ingresos - m.total_gastos;
      m.total_movimientos++;
    }
    const meses = Object.values(porMes).sort((a, b) => a.mes.localeCompare(b.mes));
    const totales = meses.reduce(
      (t, m) => ({
        total_ingresos: t.total_ingresos + m.total_ingresos,
        total_gastos: t.total_gastos + m.total_gastos,
        balance: t.balance + m.balance,
      }),
      { total_ingresos: 0, total_gastos: 0, balance: 0 },
    );
    return { anio, meses, totales };
  },
);

const resumenCategoria = (params = {}) => conRespaldoLocal(
  async () => (await gastosService.resumenCategoria(params)).data.data,
  async () => {
    const fechaDesde = params.fecha_desde || `${new Date().getFullYear()}-01-01`;
    const fechaHasta = params.fecha_hasta || hoyISO();
    const gastos = filtrar(await repo.leerLocal(), {
      finca_id: params.finca_id, fecha_desde: fechaDesde, fecha_hasta: fechaHasta,
    });

    const grupos = {};
    for (const g of gastos) {
      const k = `${g.categoria}|${g.tipo}`;
      grupos[k] ??= { categoria: g.categoria, tipo: g.tipo, total: 0, cantidad: 0 };
      grupos[k].total += monto(g);
      grupos[k].cantidad++;
    }
    const categorias = Object.values(grupos).sort((a, b) => b.total - a.total);
    return { fecha_desde: fechaDesde, fecha_hasta: fechaHasta, categorias };
  },
);

export const gastosRepo = { ...repo, resumenMensual, resumenCategoria };
