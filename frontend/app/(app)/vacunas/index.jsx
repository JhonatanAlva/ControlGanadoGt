// app/(app)/vacunas/index.jsx
import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { vacunasService } from '../../../services/vacunasService';
import { COLORS } from '../../../constants/colors';
import { formatFecha } from '../../../utils/format';
import ScreenHeader from '../../../components/ScreenHeader';
import useFincaStore from '../../../stores/fincaStore';
import FincaActivaBar from '../../../components/FincaActivaBar';
import Badge from '../../../components/Badge';

const URGENCIA_COLOR = {
  Vencida: COLORS.danger,
  'Esta semana': COLORS.warning,
  Próxima: COLORS.secondary,
  'Al día': COLORS.success,
};

export default function VacunasScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [soloPendientes, setSoloPendientes] = useState(false);
  const fincaActivaId = useFincaStore((s) => s.fincaActivaId);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['vacunas', { soloPendientes, fincaActivaId }],
    queryFn: () => vacunasService.listar({
      ...(soloPendientes && { pendientes: 'true' }),
      ...(fincaActivaId && { finca_id: fincaActivaId }),
      limit: 100,
    }),
    select: (res) => res.data.data,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['vacunas'] });
    setRefreshing(false);
  }, [queryClient]);

  const vacunas = data || [];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Vacunas"
        rightLabel="+ Nueva"
        onRightPress={() => router.push('/(app)/vacunas/nueva')}
      />
      <FincaActivaBar />

      <View style={styles.filtros}>
        <TouchableOpacity
          style={[styles.toggle, soloPendientes && styles.toggleActive]}
          onPress={() => setSoloPendientes((v) => !v)}
        >
          <Text style={[styles.toggleText, soloPendientes && styles.toggleTextActive]}>
            Solo pendientes (30 días)
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {isLoading && <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.primary} />}
        {isError && <Text style={styles.errorText}>No se pudieron cargar las vacunas.</Text>}
        {!isLoading && vacunas.length === 0 && (
          <Text style={styles.emptyText}>No hay vacunas registradas con este filtro.</Text>
        )}

        {vacunas.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={styles.card}
            onPress={() => router.push(`/(app)/vacunas/${v.id}`)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{v.tipo_vacuna} — {v.animal_nombre || v.numero_arete}</Text>
              <Text style={styles.cardSub}>Aplicada: {formatFecha(v.fecha_aplicacion)}</Text>
              {v.proxima_dosis && (
                <Text style={styles.cardSub}>Próxima dosis: {formatFecha(v.proxima_dosis)}</Text>
              )}
            </View>
            {v.urgencia && <Badge text={v.urgencia} color={URGENCIA_COLOR[v.urgencia] || COLORS.gray500} />}
          </TouchableOpacity>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  filtros: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.gray200 },
  toggle: {
    borderWidth: 1, borderColor: COLORS.gray300, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start',
  },
  toggleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  toggleText: { fontSize: 12, color: COLORS.gray600 },
  toggleTextActive: { color: '#fff', fontWeight: '600' },
  errorText: { color: COLORS.danger, textAlign: 'center', marginTop: 24, paddingHorizontal: 24 },
  emptyText: { color: COLORS.gray500, textAlign: 'center', marginTop: 32, paddingHorizontal: 32, fontSize: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.black },
  cardSub: { fontSize: 12, color: COLORS.gray600, marginTop: 2 },
});
