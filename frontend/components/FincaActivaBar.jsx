// components/FincaActivaBar.jsx
// Muestra qué finca está filtrando la pantalla y permite cambiarla.
import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fincasService } from '../services/fincasService';
import useFincaStore from '../stores/fincaStore';
import { COLORS } from '../constants/colors';

export default function FincaActivaBar() {
  const router = useRouter();
  const { fincaActivaId, setFincaActiva } = useFincaStore();

  const { data: fincas, isSuccess } = useQuery({
    queryKey: ['fincas'],
    queryFn: () => fincasService.listar(),
    select: (res) => res.data.data.fincas,
  });

  const finca = fincas?.find((f) => f.id === fincaActivaId);

  // La finca guardada ya no existe (se eliminó desde otro dispositivo): volver a "todas"
  useEffect(() => {
    if (isSuccess && fincaActivaId && !finca) setFincaActiva(null);
  }, [isSuccess, fincaActivaId, finca]);

  // Con una sola finca no hay nada que elegir
  if (!fincas || fincas.length < 2) return null;

  return (
    <TouchableOpacity style={styles.bar} onPress={() => router.push('/(app)/fincas')}>
      <Text style={styles.texto} numberOfLines={1}>
        📍 {finca ? finca.nombre : 'Todas las fincas'}
      </Text>
      <View style={styles.boton}>
        <Text style={styles.botonTexto}>Cambiar</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  texto: { flex: 1, color: COLORS.primaryDark, fontWeight: '600', fontSize: 14 },
  boton: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  botonTexto: { color: COLORS.primary, fontWeight: '600', fontSize: 12 },
});
