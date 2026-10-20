// app/(app)/fincas/[id].jsx
import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  ScrollView, Alert, StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fincasRepo } from '../../../offline/fincasRepo';
import useFincaStore from '../../../stores/fincaStore';
import { COLORS } from '../../../constants/colors';
import { REGIONES_GUATEMALA } from '../../../constants/enums';

export default function EditarFincaScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const queryClient = useQueryClient();
  const { fincaActivaId, setFincaActiva } = useFincaStore();

  const { data: finca, isLoading } = useQuery({
    queryKey: ['fincas', id],
    queryFn: () => fincasRepo.obtener(id),
  });

  const [form, setForm] = useState(null);
  useEffect(() => {
    if (finca && !form) {
      setForm({
        nombre: finca.nombre || '',
        ubicacion: finca.ubicacion || '',
        region: finca.region || '',
        hectareas: finca.hectareas ? String(finca.hectareas) : '',
        notas: finca.notas || '',
      });
    }
  }, [finca]);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const actualizarMutation = useMutation({
    mutationFn: () => fincasRepo.actualizar(id, {
      nombre: form.nombre.trim(),
      ubicacion: form.ubicacion.trim() || undefined,
      region: form.region || undefined,
      hectareas: form.hectareas ? parseFloat(form.hectareas) : undefined,
      notas: form.notas.trim() || undefined,
    }),
    onSuccess: async (actualizada) => {
      await queryClient.invalidateQueries({ queryKey: ['fincas'] });
      Alert.alert('Listo', actualizada._local ? 'Guardado sin conexión. Se enviará al servidor cuando vuelva la señal.' : 'Finca actualizada.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err) => Alert.alert('Error', err.mensaje || 'No se pudo actualizar la finca.'),
  });

  const eliminarMutation = useMutation({
    mutationFn: () => fincasRepo.eliminar(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['fincas'] });
      if (fincaActivaId === id) await setFincaActiva(null);
      router.back();
    },
    onError: (err) => Alert.alert('No se puede eliminar', err.mensaje || 'Intenta de nuevo.'),
  });

  const confirmarEliminar = () => {
    Alert.alert(
      'Eliminar finca',
      `¿Seguro que quieres eliminar "${finca?.nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => eliminarMutation.mutate() },
      ],
    );
  };

  if (isLoading || !form) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Editar Finca</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Nombre *</Text>
        <TextInput
          style={styles.input}
          value={form.nombre}
          onChangeText={(v) => set('nombre', v)}
        />

        <Text style={styles.label}>Ubicación</Text>
        <TextInput
          style={styles.input}
          value={form.ubicacion}
          onChangeText={(v) => set('ubicacion', v)}
        />

        <Text style={styles.label}>Hectáreas</Text>
        <TextInput
          style={styles.input}
          value={form.hectareas}
          onChangeText={(v) => set('hectareas', v.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Departamento</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {REGIONES_GUATEMALA.map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => set('region', form.region === r ? '' : r)}
              style={[styles.chip, form.region === r && styles.chipActive]}
            >
              <Text style={[styles.chipText, form.region === r && styles.chipTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Notas</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          value={form.notas}
          onChangeText={(v) => set('notas', v)}
          multiline
        />

        <TouchableOpacity
          style={[styles.btn, actualizarMutation.isPending && { opacity: 0.7 }]}
          onPress={() => actualizarMutation.mutate()}
          disabled={actualizarMutation.isPending}
        >
          {actualizarMutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Guardar cambios</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnDanger, eliminarMutation.isPending && { opacity: 0.7 }]}
          onPress={confirmarEliminar}
          disabled={eliminarMutation.isPending}
        >
          {eliminarMutation.isPending
            ? <ActivityIndicator color={COLORS.danger} />
            : <Text style={styles.btnDangerText}>Eliminar finca</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
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

  form: { padding: 24 },
  label: { fontSize: 13, color: COLORS.gray600, fontWeight: '500', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.black,
    backgroundColor: COLORS.gray50,
    marginBottom: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.gray600 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnDanger: {
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  btnDangerText: { color: COLORS.danger, fontWeight: 'bold', fontSize: 15 },
});
