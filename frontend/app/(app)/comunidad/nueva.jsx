// app/(app)/comunidad/nueva.jsx
import { ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { comunidadRepo } from '../../../offline/comunidadRepo';
import ScreenHeader from '../../../components/ScreenHeader';
import FormPublicacion from '../../../components/FormPublicacion';

export default function NuevaPublicacionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ datos, foto }) => comunidadRepo.crear(datos, foto),
    onSuccess: async (post) => {
      await queryClient.invalidateQueries({ queryKey: ['comunidad'] });
      Alert.alert(
        'Listo',
        post._local
          ? 'Guardada sin conexión. Se publicará cuando vuelva la señal.'
          : 'Publicación creada.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    },
    onError: (err) => Alert.alert('Error', err.mensaje || 'No se pudo crear la publicación.'),
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title="Nueva Publicación" />
      <FormPublicacion
        boton="Publicar"
        guardando={mutation.isPending}
        onGuardar={(datos, foto) => mutation.mutate({ datos, foto })}
      />
    </ScrollView>
  );
}
