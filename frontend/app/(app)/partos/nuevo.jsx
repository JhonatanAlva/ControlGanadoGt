// app/(app)/partos/nuevo.jsx
import { useState } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { partosRepo } from '../../../offline/partosRepo';
import * as animalesRepo from '../../../offline/animalesRepo';
import { TIPOS_REPRODUCCION } from '../../../constants/enums';
import ScreenHeader from '../../../components/ScreenHeader';
import FormInput from '../../../components/FormInput';
import ChipPicker from '../../../components/ChipPicker';
import AnimalPicker from '../../../components/AnimalPicker';
import PrimaryButton from '../../../components/PrimaryButton';

export default function NuevoPartoScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: hembras } = useQuery({
    queryKey: ['animales', { estado: 'Activo', sexo: 'Hembra' }],
    queryFn: () => animalesRepo.listar({ estado: 'Activo', sexo: 'Hembra', limit: 100 }),
  });

  const { data: machos } = useQuery({
    queryKey: ['animales', { estado: 'Activo', sexo: 'Macho' }],
    queryFn: () => animalesRepo.listar({ estado: 'Activo', sexo: 'Macho', limit: 100 }),
  });

  const [form, setForm] = useState({
    madre_id: '', padre_id: '', padre_arete: '', tipo_reproduccion: '', fecha_servicio: '', notas: '',
  });
  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const mutation = useMutation({
    mutationFn: () => partosRepo.registrarServicio({
      madre_id: form.madre_id,
      padre_id: form.padre_id || undefined,
      padre_arete: form.padre_arete.trim() || undefined,
      tipo_reproduccion: form.tipo_reproduccion,
      fecha_servicio: form.fecha_servicio,
      notas: form.notas.trim() || undefined,
    }),
    onSuccess: async (parto) => {
      await queryClient.invalidateQueries({ queryKey: ['partos'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      Alert.alert('Listo', parto._local
        ? 'Guardado sin conexión. Se enviará al servidor cuando vuelva la señal.'
        : 'Servicio registrado. La fecha de parto esperada se calculó automáticamente.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err) => Alert.alert('Error', err.mensaje || 'No se pudo registrar el servicio.'),
  });

  const handleGuardar = () => {
    if (!form.madre_id) return Alert.alert('Campo requerido', 'Selecciona la madre.');
    if (!form.tipo_reproduccion) return Alert.alert('Campo requerido', 'Selecciona el tipo de reproducción.');
    if (!form.fecha_servicio) return Alert.alert('Campo requerido', 'Ingresa la fecha de servicio.');
    mutation.mutate();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title="Nuevo Servicio" />

      <View style={{ padding: 24 }}>
        {hembras?.length > 0 ? (
          <AnimalPicker
            label="Madre *"
            animales={hembras}
            value={form.madre_id}
            onChange={(id) => set('madre_id', id)}
          />
        ) : (
          <FormInput label="Madre" editable={false} value="No tienes hembras activas registradas" />
        )}

        <ChipPicker
          label="Tipo de reproducción *"
          options={TIPOS_REPRODUCCION}
          value={form.tipo_reproduccion}
          onChange={(v) => set('tipo_reproduccion', v)}
        />

        <FormInput
          label="Fecha de servicio (YYYY-MM-DD) *"
          placeholder="2026-07-16"
          value={form.fecha_servicio}
          onChangeText={(v) => set('fecha_servicio', v)}
        />
        {machos?.length > 0 && (
          <AnimalPicker
            label="Padre (si está en el sistema)"
            animales={machos}
            value={form.padre_id}
            onChange={(id) => set('padre_id', id)}
          />
        )}
        <FormInput
          label="Arete del padre (si no está en el sistema)"
          value={form.padre_arete}
          onChangeText={(v) => set('padre_arete', v)}
        />
        <FormInput label="Notas" multiline value={form.notas} onChangeText={(v) => set('notas', v)} />

        <PrimaryButton label="Registrar servicio" onPress={handleGuardar} loading={mutation.isPending} />
      </View>
    </ScrollView>
  );
}
