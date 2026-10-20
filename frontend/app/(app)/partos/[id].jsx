// app/(app)/partos/[id].jsx
import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { partosRepo } from '../../../offline/partosRepo';
import { COLORS } from '../../../constants/colors';
import { formatFecha } from '../../../utils/format';
import { TIPOS_PARTO, RESULTADOS_PARTO, SEXOS } from '../../../constants/enums';
import ScreenHeader from '../../../components/ScreenHeader';
import FormInput from '../../../components/FormInput';
import ChipPicker from '../../../components/ChipPicker';
import PrimaryButton from '../../../components/PrimaryButton';
import Badge from '../../../components/Badge';
import { verificarLimitePlan } from '../../../utils/limitesPlan';

export default function DetalleParteScreen() {
  const { id } = useLocalSearchParams();
  const queryClient = useQueryClient();

  const { data: parto, isLoading } = useQuery({
    queryKey: ['partos', id],
    queryFn: () => partosRepo.obtener(id),
  });

  const [form, setForm] = useState({
    fecha_parto: '', tipo_parto: '', resultado: '',
    cria_arete: '', cria_sexo: '', peso_nacimiento: '',
    asistencia_veterinaria: false, costo_veterinario: '', notas: '',
  });
  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const mutation = useMutation({
    mutationFn: () => partosRepo.registrarResultado(id, {
      fecha_parto: form.fecha_parto,
      tipo_parto: form.tipo_parto,
      resultado: form.resultado,
      cria_arete: form.cria_arete.trim() || undefined,
      cria_sexo: form.cria_sexo || undefined,
      peso_nacimiento: form.peso_nacimiento ? parseFloat(form.peso_nacimiento) : undefined,
      asistencia_veterinaria: form.asistencia_veterinaria,
      costo_veterinario: form.costo_veterinario ? parseFloat(form.costo_veterinario) : undefined,
      notas: form.notas.trim() || undefined,
    }),
    onSuccess: async (resultado) => {
      await queryClient.invalidateQueries({ queryKey: ['partos'] });
      await queryClient.invalidateQueries({ queryKey: ['animales'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      let mensaje = 'Parto registrado.';
      if (resultado._local) {
        mensaje = 'Guardado sin conexión. Al volver la señal se enviará y, si nació viva, se creará la cría.';
      } else if (resultado.cria_creada) {
        mensaje = 'Parto registrado. La cría se creó automáticamente como nuevo animal.';
      }
      Alert.alert('Listo', mensaje);
    },
    onError: (err) => Alert.alert('Error', err.mensaje || 'No se pudo registrar el resultado.'),
  });

  const handleGuardar = async () => {
    if (!form.fecha_parto || !form.tipo_parto || !form.resultado) {
      Alert.alert('Campos requeridos', 'Ingresa fecha, tipo de parto y resultado.');
      return;
    }
    if (form.resultado !== 'Aborto' && form.resultado !== 'Muerto' && !form.cria_arete.trim()) {
      Alert.alert('Campo requerido', 'Si la cría nace viva, ingresa su número de arete.');
      return;
    }
    if (form.cria_arete.trim() && !(await verificarLimitePlan('animales'))) return;
    mutation.mutate();
  };

  if (isLoading || !parto) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title={parto.madre_nombre || parto.madre_arete} />

      <View style={styles.section}>
        <Text style={styles.sub}>Tipo de reproducción: {parto.tipo_reproduccion}</Text>
        <Text style={styles.sub}>Fecha de servicio: {formatFecha(parto.fecha_servicio)}</Text>
        <Text style={styles.sub}>Fecha de parto esperada: {formatFecha(parto.fecha_parto_esperada)}</Text>
        {parto.padre_arete_ref || parto.padre_arete ? (
          <Text style={styles.sub}>Padre: {parto.padre_arete_ref || parto.padre_arete}</Text>
        ) : null}
        {parto.notas && <Text style={styles.sub}>Notas: {parto.notas}</Text>}

        {parto.fecha_parto && (
          <View style={{ marginTop: 12 }}>
            <Badge text="Completado" color={COLORS.success} />
            <Text style={[styles.sub, { marginTop: 8 }]}>Fecha de parto: {formatFecha(parto.fecha_parto)}</Text>
            <Text style={styles.sub}>Tipo de parto: {parto.tipo_parto}</Text>
            <Text style={styles.sub}>Resultado: {parto.resultado}</Text>
            {parto.cria_arete_ref || parto.cria_arete ? (
              <Text style={styles.sub}>Cría: {parto.cria_arete_ref || parto.cria_arete} ({parto.cria_sexo})</Text>
            ) : null}
            {parto.peso_nacimiento && <Text style={styles.sub}>Peso al nacer: {parto.peso_nacimiento} lb</Text>}
          </View>
        )}
      </View>

      {!parto.fecha_parto && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registrar resultado del parto</Text>

          <FormInput
            label="Fecha de parto (YYYY-MM-DD) *"
            placeholder="2026-07-16"
            value={form.fecha_parto}
            onChangeText={(v) => set('fecha_parto', v)}
          />
          <ChipPicker label="Tipo de parto *" options={TIPOS_PARTO} value={form.tipo_parto} onChange={(v) => set('tipo_parto', v)} />
          <ChipPicker label="Resultado *" options={RESULTADOS_PARTO} value={form.resultado} onChange={(v) => set('resultado', v)} />

          {form.resultado && form.resultado !== 'Aborto' && form.resultado !== 'Muerto' && (
            <>
              <FormInput
                label="Arete de la cría *"
                value={form.cria_arete}
                onChangeText={(v) => set('cria_arete', v)}
              />
              <ChipPicker label="Sexo de la cría" options={SEXOS} value={form.cria_sexo} onChange={(v) => set('cria_sexo', v)} />
              <FormInput
                label="Peso al nacer (libras)"
                keyboardType="decimal-pad"
                value={form.peso_nacimiento}
                onChangeText={(v) => set('peso_nacimiento', v.replace(/[^0-9.]/g, ''))}
              />
            </>
          )}

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => set('asistencia_veterinaria', !form.asistencia_veterinaria)}
          >
            <View style={[styles.checkbox, form.asistencia_veterinaria && styles.checkboxActive]} />
            <Text style={styles.sub}>Tuvo asistencia veterinaria</Text>
          </TouchableOpacity>

          {form.asistencia_veterinaria && (
            <FormInput
              label="Costo veterinario (Q)"
              keyboardType="decimal-pad"
              value={form.costo_veterinario}
              onChangeText={(v) => set('costo_veterinario', v.replace(/[^0-9.]/g, ''))}
            />
          )}

          <FormInput label="Notas" multiline value={form.notas} onChangeText={(v) => set('notas', v)} />

          <PrimaryButton label="Registrar resultado" onPress={handleGuardar} loading={mutation.isPending} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  section: { padding: 20, borderBottomWidth: 8, borderBottomColor: COLORS.gray50, backgroundColor: '#fff' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.black, marginBottom: 12 },
  sub: { fontSize: 13, color: COLORS.gray600, marginTop: 4 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: COLORS.gray300 },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
});
