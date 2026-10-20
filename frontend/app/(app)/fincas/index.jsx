// app/(app)/fincas/index.jsx
import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fincasService } from '../../../services/fincasService';
import useFincaStore from '../../../stores/fincaStore';
import { COLORS } from '../../../constants/colors';

export default function FincasScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { fincaActivaId, setFincaActiva } = useFincaStore();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['fincas'],
    queryFn: () => fincasService.listar(),
    select: (res) => res.data.data.fincas,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['fincas'] });
    setRefreshing(false);
  }, [queryClient]);

  const fincas = data || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mis Fincas</Text>
        <TouchableOpacity onPress={() => router.push('/(app)/fincas/nueva')}>
          <Text style={styles.addBtn}>+ Nueva</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {isLoading && <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.primary} />}

        {isError && (
          <Text style={styles.errorText}>No se pudieron cargar las fincas. Desliza para reintentar.</Text>
        )}

        {fincas.length > 1 && (
          <Text style={styles.ayuda}>
            Toca una finca para ver solo sus datos en toda la app. Tócala de nuevo para ver todas.
          </Text>
        )}

        {!isLoading && fincas.length === 0 && (
          <Text style={styles.emptyText}>
            Todavía no tienes fincas registradas. Crea la primera con "+ Nueva".
          </Text>
        )}

        {fincas.map((finca) => {
          const activa = finca.id === fincaActivaId;
          return (
            <TouchableOpacity
              key={finca.id}
              style={[styles.card, activa && styles.cardActiva]}
              onPress={() => setFincaActiva(activa ? null : finca.id)}
              onLongPress={() => router.push(`/(app)/fincas/${finca.id}`)}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardNombre}>{finca.nombre}</Text>
                  {activa && <Text style={styles.badgeActiva}>Activa</Text>}
                </View>
                {!!finca.region && <Text style={styles.cardSub}>{finca.region}</Text>}
                <Text style={styles.cardSub}>
                  {finca.total_animales ?? 0} animales activos
                  {finca.hectareas ? ` · ${finca.hectareas} ha` : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push(`/(app)/fincas/${finca.id}`)}
                style={styles.editBtn}
              >
                <Text style={styles.editText}>Editar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  ayuda: { fontSize: 13, color: COLORS.gray500, marginHorizontal: 20, marginTop: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
  },
  backArrow: { color: '#fff', fontSize: 22, width: 30 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  addBtn: { color: '#fff', fontWeight: '600', fontSize: 14 },

  errorText: { color: COLORS.danger, textAlign: 'center', marginTop: 24, paddingHorizontal: 24 },
  emptyText: { color: COLORS.gray500, textAlign: 'center', marginTop: 32, paddingHorizontal: 32, fontSize: 14 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: COLORS.gray200,
  },
  cardActiva: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardNombre: { fontSize: 16, fontWeight: 'bold', color: COLORS.black },
  cardSub: { fontSize: 13, color: COLORS.gray600, marginTop: 2 },
  badgeActiva: {
    fontSize: 10, fontWeight: '700', color: '#fff',
    backgroundColor: COLORS.primary, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  editBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  editText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
});
