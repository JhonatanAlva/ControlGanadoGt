// app/(app)/fincas/nueva.jsx
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  ScrollView, Alert, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fincasRepo } from '../../../offline/fincasRepo';
import useFincaStore from '../../../stores/fincaStore';
import { COLORS } from '../../../constants/colors';
import { REGIONES_GUATEMALA } from '../../../constants/enums';
import { verificarLimitePlan } from '../../../utils/limitesPlan';

export default function NuevaFincaScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setFincaActiva } = useFincaStore();

  const [form, setForm] = useState({
    nombre: '', ubicacion: '', region: '', hectareas: '', notas: '',
  });

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const mutation = useMutation({
    mutationFn: () => fincasRepo.crear({
      nombre: form.nombre.trim(),
      ubicacion: form.ubicacion.trim() || undefined,
      region: form.region || undefined,
      hectareas: form.hectareas ? parseFloat(form.hectareas) : undefined,
      notas: form.notas.trim() || undefined,
    }),
    onSuccess: async (finca) => {
      await queryClient.invalidateQueries({ queryKey: ['fincas'] });
      await setFincaActiva(finca.id);
      Alert.alert('Listo', finca._local ? 'Guardado sin conexión. Se enviará al servidor cuando vuelva la señal.' : 'Finca registrada.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err) => {
      Alert.alert('Error', err.mensaje || 'No se pudo crear la finca.');
    },
  });

  const handleGuardar = async () => {
    if (!form.nombre.trim()) {
      Alert.alert('Campo requerido', 'El nombre de la finca es obligatorio.');
      return;
    }
    if (!(await verificarLimitePlan('fincas'))) return;
    mutation.mutate();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Nueva Finca</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Nombre *</Text>
        <TextInput
          style={styles.input}
          placeholder="Finca El Rosario"
          placeholderTextColor={COLORS.gray500}
          value={form.nombre}
          onChangeText={(v) => set('nombre', v)}
        />

        <Text style={styles.label}>Ubicación</Text>
        <TextInput
          style={styles.input}
          placeholder="Km 45 carretera a..."
          placeholderTextColor={COLORS.gray500}
          value={form.ubicacion}
          onChangeText={(v) => set('ubicacion', v)}
        />

        <Text style={styles.label}>Hectáreas</Text>
        <TextInput
          style={styles.input}
          placeholder="10.5"
          placeholderTextColor={COLORS.gray500}
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
          placeholder="Notas adicionales..."
          placeholderTextColor={COLORS.gray500}
          value={form.notas}
          onChangeText={(v) => set('notas', v)}
          multiline
        />

        <TouchableOpacity
          style={[styles.btn, mutation.isPending && { opacity: 0.7 }]}
          onPress={handleGuardar}
          disabled={mutation.isPending}
        >
          {mutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Guardar finca</Text>}
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
});
