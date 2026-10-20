// components/PhotoPicker.jsx
// Selector de foto (animales, publicaciones) — permite tomar una foto o elegirla de la galería.
import { View, Image, TouchableOpacity, Text, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../constants/colors';

export default function PhotoPicker({ asset, existingUrl, onChange, titulo = 'Foto del animal' }) {
  const uri = asset?.uri || existingUrl;

  const pedirPermiso = async (esCamara) => {
    const { status } = esCamara
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitas dar permiso para continuar.');
      return false;
    }
    return true;
  };

  const tomarFoto = async () => {
    if (!(await pedirPermiso(true))) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true, aspect: [1, 1] });
    if (!res.canceled) onChange(res.assets[0]);
  };

  const elegirGaleria = async () => {
    if (!(await pedirPermiso(false))) return;
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: true, aspect: [1, 1] });
    if (!res.canceled) onChange(res.assets[0]);
  };

  const elegir = () => {
    Alert.alert(titulo, '¿Cómo quieres agregarla?', [
      { text: 'Tomar foto', onPress: tomarFoto },
      { text: 'Elegir de galería', onPress: elegirGaleria },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <TouchableOpacity style={styles.container} onPress={elegir}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>📷</Text>
        </View>
      )}
      <Text style={styles.label}>{uri ? 'Cambiar foto' : 'Agregar foto'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginBottom: 20 },
  image: { width: 110, height: 110, borderRadius: 55, backgroundColor: COLORS.gray100 },
  placeholder: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: COLORS.gray100,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.gray300, borderStyle: 'dashed',
  },
  placeholderIcon: { fontSize: 30 },
  label: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 8 },
});
