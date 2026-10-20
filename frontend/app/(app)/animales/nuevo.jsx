// app/(app)/animales/nuevo.jsx
import { useState } from 'react';
import { ScrollView, Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as animalesRepo from '../../../offline/animalesRepo';
import { fincasRepo } from '../../../offline/fincasRepo';
import useFincaStore from '../../../stores/fincaStore';
import { RAZAS, SEXOS, TIPOS_ANIMAL, PROPOSITOS } from '../../../constants/enums';
import ScreenHeader from '../../../components/ScreenHeader';
import FormInput from '../../../components/FormInput';
import ChipPicker from '../../../components/ChipPicker';
import AnimalPicker from '../../../components/AnimalPicker';
import PrimaryButton from '../../../components/PrimaryButton';
import PhotoPicker from '../../../components/PhotoPicker';
import { verificarLimitePlan } from '../../../utils/limitesPlan';

export default function NuevoAnimalScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { fincaActivaId } = useFincaStore();
  const [foto, setFoto] = useState(null);

  const { data: fincas } = useQuery({
    queryKey: ['fincas'],
    queryFn: () => fincasRepo.listar(),
  });

  const { data: hembras } = useQuery({
    queryKey: ['animales', { estado: 'Activo', sexo: 'Hembra' }],
    queryFn: () => animalesRepo.listar({ estado: 'Activo', sexo: 'Hembra', limit: 100 }),
  });

  const { data: machos } = useQuery({
    queryKey: ['animales', { estado: 'Activo', sexo: 'Macho' }],
    queryFn: () => animalesRepo.listar({ estado: 'Activo', sexo: 'Macho', limit: 100 }),
  });

  const [form, setForm] = useState({
    numero_arete: '', nombre: '', raza: '', sexo: '', tipo: '', proposito: '',
    finca_id: fincaActivaId || '', fecha_nacimiento: '',
    peso_actual: '', peso_compra: '', precio_compra: '',
    madre_id: '', padre_id: '', madre_arete: '', padre_arete: '', procedencia: '', notas: '',
  });
  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const mutation = useMutation({
    mutationFn: () => animalesRepo.crear({
      numero_arete: form.numero_arete.trim(),
      nombre: form.nombre.trim() || undefined,
      raza: form.raza,
      sexo: form.sexo,
      tipo: form.tipo,
      proposito: form.proposito || undefined,
      finca_id: form.finca_id || undefined,
      fecha_nacimiento: form.fecha_nacimiento || undefined,
      peso_actual: form.peso_actual ? parseFloat(form.peso_actual) : undefined,
      peso_compra: form.peso_compra ? parseFloat(form.peso_compra) : undefined,
      precio_compra: form.precio_compra ? parseFloat(form.precio_compra) : undefined,
      madre_id: form.madre_id || undefined,
      padre_id: form.padre_id || undefined,
      madre_arete: form.madre_arete.trim() || undefined,
      padre_arete: form.padre_arete.trim() || undefined,
      procedencia: form.procedencia.trim() || undefined,
      notas: form.notas.trim() || undefined,
    }, foto),
    onSuccess: async (animal) => {
      await queryClient.invalidateQueries({ queryKey: ['animales'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const enCola = animal.id.startsWith('local_');
      Alert.alert(
        'Listo',
        enCola
          ? 'Sin conexión: el animal se guardó en el celular y se enviará al servidor cuando vuelva la señal.'
          : 'Animal registrado.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    },
    onError: (err) => Alert.alert('Error', err.mensaje || 'No se pudo registrar el animal.'),
  });

  const handleGuardar = async () => {
    if (!form.numero_arete.trim()) return Alert.alert('Campo requerido', 'El número de arete es obligatorio.');
    if (!form.raza) return Alert.alert('Campo requerido', 'Selecciona la raza.');
    if (!form.sexo) return Alert.alert('Campo requerido', 'Selecciona el sexo.');
    if (!form.tipo) return Alert.alert('Campo requerido', 'Selecciona el tipo.');
    if (!(await verificarLimitePlan('animales'))) return;
    mutation.mutate();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title="Nuevo Animal" />

      <View style={{ padding: 24 }}>
        <PhotoPicker asset={foto} onChange={setFoto} />

        <FormInput
          label="Número de arete *"
          placeholder="A-102"
          value={form.numero_arete}
          onChangeText={(v) => set('numero_arete', v)}
        />
        <FormInput
          label="Nombre"
          placeholder="Bella"
          value={form.nombre}
          onChangeText={(v) => set('nombre', v)}
        />

        <ChipPicker label="Raza *" options={RAZAS} value={form.raza} onChange={(v) => set('raza', v)} />
        <ChipPicker label="Sexo *" options={SEXOS} value={form.sexo} onChange={(v) => set('sexo', v)} />
        <ChipPicker label="Tipo *" options={TIPOS_ANIMAL} value={form.tipo} onChange={(v) => set('tipo', v)} />
        <ChipPicker label="Propósito" options={PROPOSITOS} value={form.proposito} onChange={(v) => set('proposito', v)} />

        {fincas?.length > 0 && (
          <ChipPicker
            label="Finca"
            options={fincas.map((f) => f.nombre)}
            value={fincas.find((f) => f.id === form.finca_id)?.nombre || ''}
            onChange={(nombre) => {
              const f = fincas.find((x) => x.nombre === nombre);
              set('finca_id', f ? f.id : '');
            }}
          />
        )}

        <FormInput
          label="Fecha de nacimiento (YYYY-MM-DD)"
          placeholder="2024-03-15"
          value={form.fecha_nacimiento}
          onChangeText={(v) => set('fecha_nacimiento', v)}
        />
        <FormInput
          label="Peso actual (libras)"
          placeholder="450"
          keyboardType="decimal-pad"
          value={form.peso_actual}
          onChangeText={(v) => set('peso_actual', v.replace(/[^0-9.]/g, ''))}
        />
        <FormInput
          label="Peso de compra (libras)"
          placeholder="380"
          keyboardType="decimal-pad"
          value={form.peso_compra}
          onChangeText={(v) => set('peso_compra', v.replace(/[^0-9.]/g, ''))}
        />
        <FormInput
          label="Precio de compra (Q)"
          placeholder="4500"
          keyboardType="decimal-pad"
          value={form.precio_compra}
          onChangeText={(v) => set('precio_compra', v.replace(/[^0-9.]/g, ''))}
        />
        {hembras?.length > 0 && (
          <AnimalPicker
            label="Madre (si está en el sistema)"
            animales={hembras}
            value={form.madre_id}
            onChange={(id) => set('madre_id', id)}
          />
        )}
        <FormInput
          label="Arete de la madre (si no está en el sistema)"
          value={form.madre_arete}
          onChangeText={(v) => set('madre_arete', v)}
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
        <FormInput
          label="Procedencia"
          placeholder="Comprado en feria de..."
          value={form.procedencia}
          onChangeText={(v) => set('procedencia', v)}
        />
        <FormInput
          label="Notas"
          multiline
          value={form.notas}
          onChangeText={(v) => set('notas', v)}
        />

        <PrimaryButton label="Guardar animal" onPress={handleGuardar} loading={mutation.isPending} />
      </View>
    </ScrollView>
  );
}
