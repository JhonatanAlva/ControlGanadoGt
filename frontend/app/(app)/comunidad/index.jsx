// app/(app)/comunidad/index.jsx
import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, Image,
  TouchableOpacity, ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { comunidadService } from '../../../services/comunidadService';
import { comunidadRepo } from '../../../offline/comunidadRepo';
import { esIdLocal } from '../../../offline/crearRepoOffline';
import { COLORS } from '../../../constants/colors';
import { formatQ } from '../../../utils/format';
import { TIPOS_POST, REGIONES_GUATEMALA } from '../../../constants/enums';
import ScreenHeader from '../../../components/ScreenHeader';
import ChipPicker from '../../../components/ChipPicker';
import SyncBanner from '../../../components/SyncBanner';

export default function ComunidadScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState('');
  const [region, setRegion] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['comunidad', { tipo, region }],
    queryFn: () => comunidadRepo.listar({
      ...(tipo && { tipo }),
      ...(region && { region }),
      limit: 50,
    }),
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['comunidad'] });
    setRefreshing(false);
  }, [queryClient]);

  // Los "me gusta" necesitan señal (cuentan en el servidor al instante)
  const likeMutation = useMutation({
    mutationFn: (id) => comunidadService.toggleLike(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comunidad'] }),
    onError: (err) => Alert.alert('Me gusta', err.mensaje || 'No se pudo registrar el me gusta.'),
  });

  const darLike = (post) => {
    if (esIdLocal(post.id)) {
      Alert.alert('Me gusta', 'Esta publicación aún no se envía al servidor.');
      return;
    }
    likeMutation.mutate(post.id);
  };

  const posts = data || [];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Comunidad"
        rightLabel="+ Nueva"
        onRightPress={() => router.push('/(app)/comunidad/nueva')}
      />
      <SyncBanner />

      <View style={styles.filtros}>
        <ChipPicker options={TIPOS_POST} value={tipo} onChange={setTipo} />
        <ChipPicker options={REGIONES_GUATEMALA} value={region} onChange={setRegion} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {isLoading && <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.primary} />}
        {isError && <Text style={styles.errorText}>No se pudieron cargar las publicaciones.</Text>}
        {!isLoading && posts.length === 0 && (
          <Text style={styles.emptyText}>No hay publicaciones con este filtro.</Text>
        )}

        {posts.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.card}
            onPress={() => router.push(`/(app)/comunidad/${p.id}`)}
          >
            <View style={styles.rowBetween}>
              <Text style={styles.tipo}>{p.tipo}</Text>
              <Text style={styles.region}>{p.region}</Text>
            </View>
            {!!p.foto_url && <Image source={{ uri: p.foto_url }} style={styles.foto} />}
            <Text style={styles.titulo}>{p.titulo}</Text>
            <Text style={styles.contenido} numberOfLines={2}>{p.contenido}</Text>
            {!!p.precio && <Text style={styles.precio}>{formatQ(p.precio)}</Text>}

            <View style={styles.rowBetween}>
              <Text style={styles.autor}>{p.autor_nombre}</Text>
              <TouchableOpacity
                style={styles.likeBtn}
                onPress={() => darLike(p)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.likeIcon, p.yo_di_like && { color: COLORS.danger }]}>
                  {p.yo_di_like ? '♥' : '♡'}
                </Text>
                <Text style={styles.likeCount}>{p.likes}</Text>
              </TouchableOpacity>
            </View>
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
  errorText: { color: COLORS.danger, textAlign: 'center', marginTop: 24, paddingHorizontal: 24 },
  emptyText: { color: COLORS.gray500, textAlign: 'center', marginTop: 32, paddingHorizontal: 32, fontSize: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tipo: { fontSize: 11, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase' },
  region: { fontSize: 11, color: COLORS.gray500 },
  titulo: { fontSize: 16, fontWeight: 'bold', color: COLORS.black, marginTop: 6 },
  foto: { width: '100%', height: 180, borderRadius: 10, marginTop: 10, backgroundColor: COLORS.gray100 },
  contenido: { fontSize: 13, color: COLORS.gray600, marginTop: 4 },
  precio: { fontSize: 14, fontWeight: 'bold', color: COLORS.success, marginTop: 6 },
  autor: { fontSize: 12, color: COLORS.gray500, marginTop: 10 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 },
  likeIcon: { fontSize: 18, color: COLORS.gray500 },
  likeCount: { fontSize: 12, color: COLORS.gray600 },
});
