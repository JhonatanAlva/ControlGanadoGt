// components/SyncBanner.jsx
// Estado de la conexión y de la cola de cambios sin sincronizar.
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import useNetworkStatus from '../hooks/useNetworkStatus';
import {
  contarPendientes, listarRechazadas, descartarRechazadas, suscribirseASync,
} from '../offline/syncManager';
import { COLORS } from '../constants/colors';

const NOMBRE_ENTIDAD = { animales: 'Animal', vacunas: 'Vacuna', partos: 'Parto', gastos: 'Movimiento' };

export default function SyncBanner() {
  const conectado = useNetworkStatus();
  const [pendientes, setPendientes] = useState(0);
  const [rechazadas, setRechazadas] = useState([]);

  useEffect(() => {
    const cargar = async () => {
      setPendientes(await contarPendientes());
      setRechazadas(await listarRechazadas());
    };
    cargar();
    return suscribirseASync(cargar);
  }, []);

  const verRechazadas = () => {
    const detalle = rechazadas
      .slice(0, 5)
      .map((m) => `• ${NOMBRE_ENTIDAD[m.entidad] || m.entidad}: ${m.error}`)
      .join('\n');
    Alert.alert(
      'Cambios no guardados',
      `El servidor rechazó estos cambios hechos sin conexión:\n\n${detalle}\n\nPuedes descartarlos y volver a registrarlos con los datos corregidos.`,
      [
        { text: 'Cerrar', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: descartarRechazadas },
      ],
    );
  };

  return (
    <>
      {!conectado && (
        <View style={styles.offline}>
          <Text style={styles.offlineText}>
            📡 Sin conexión — mostrando datos guardados{pendientes > 0 ? ` · ${pendientes} cambio(s) por sincronizar` : ''}
          </Text>
        </View>
      )}
      {conectado && pendientes > 0 && (
        <View style={styles.sync}>
          <ActivityIndicator size="small" color={COLORS.secondary} />
          <Text style={styles.syncText}>Sincronizando {pendientes} cambio(s)...</Text>
        </View>
      )}
      {rechazadas.length > 0 && (
        <TouchableOpacity style={styles.rechazo} onPress={verRechazadas}>
          <Text style={styles.rechazoText}>
            ⚠️ {rechazadas.length} cambio(s) no se pudieron guardar. Toca para ver.
          </Text>
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  offline: { backgroundColor: '#fdf2e0', paddingVertical: 8, paddingHorizontal: 16 },
  offlineText: { color: '#a06a12', fontSize: 12, textAlign: 'center' },
  sync: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primaryLight, paddingVertical: 8, paddingHorizontal: 16,
  },
  syncText: { color: COLORS.primaryDark, fontSize: 12 },
  rechazo: { backgroundColor: '#fdecea', paddingHorizontal: 16, paddingVertical: 8 },
  rechazoText: { color: COLORS.danger, fontSize: 12, textAlign: 'center', fontWeight: '600' },
});
