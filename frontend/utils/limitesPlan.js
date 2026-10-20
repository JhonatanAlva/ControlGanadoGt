// utils/limitesPlan.js
// Revisa el límite del plan Free ANTES de crear, con o sin conexión.
// El servidor vuelve a validarlo, pero así el usuario no llena un formulario
// (o trabaja sin señal) para que luego le rechacen el cambio al sincronizar.
import { Alert } from 'react-native';
import { router } from 'expo-router';
import useAuthStore from '../stores/authStore';
import { LIMITES_FREE } from '../constants/enums';
import { fincasRepo } from '../offline/fincasRepo';
import * as animalesRepo from '../offline/animalesRepo';

const contar = {
  fincas: async () => (await fincasRepo.listar()).length,
  animales: async () => (await animalesRepo.listarConTotal({ estado: 'Activo', limit: 1 })).total,
};

const NOMBRE = {
  fincas: { uno: 'finca', varios: 'fincas' },
  animales: { uno: 'animal activo', varios: 'animales activos' },
};

/**
 * @param {'fincas'|'animales'} tipo
 * @returns {Promise<boolean>} true si se puede crear; si no, muestra el aviso
 */
export const verificarLimitePlan = async (tipo) => {
  if (useAuthStore.getState().usuario?.plan === 'pro') return true;

  let total;
  try {
    total = await contar[tipo]();
  } catch {
    return true; // si no se puede contar, que decida el servidor
  }

  const limite = LIMITES_FREE[tipo];
  if (total < limite) return true;

  const nombre = limite === 1 ? NOMBRE[tipo].uno : NOMBRE[tipo].varios;
  Alert.alert(
    'Límite del plan gratuito',
    `El plan gratuito permite máximo ${limite} ${nombre}. Actualiza a Pro para agregar más.`,
    [
      { text: 'Cerrar', style: 'cancel' },
      { text: 'Ver planes', onPress: () => router.push('/(app)/planes') },
    ],
  );
  return false;
};
