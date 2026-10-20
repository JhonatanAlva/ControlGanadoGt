// components/FormPublicacion.jsx
// Formulario de publicación de Comunidad, compartido por "Nueva" y "Editar".
import { useState } from 'react';
import { View, Alert } from 'react-native';
import { TIPOS_POST, REGIONES_GUATEMALA } from '../constants/enums';
import FormInput from './FormInput';
import ChipPicker from './ChipPicker';
import PrimaryButton from './PrimaryButton';
import PhotoPicker from './PhotoPicker';

const TIPOS_CON_ANIMAL = ['Venta de animal', 'Compra de animal'];

const texto = (v) => (v == null ? '' : String(v));

/**
 * @param {object}   props
 * @param {object}   [props.inicial]   - publicación existente (al editar)
 * @param {string}   props.boton       - texto del botón
 * @param {boolean}  props.guardando
 * @param {Function} props.onGuardar   - (datos, foto) => void
 */
export default function FormPublicacion({ inicial, boton, guardando, onGuardar }) {
  const [form, setForm] = useState({
    tipo: inicial?.tipo || '',
    titulo: inicial?.titulo || '',
    contenido: inicial?.contenido || '',
    region: inicial?.region || '',
    precio: texto(inicial?.precio),
    raza_animal: inicial?.raza_animal || '',
    peso_animal: texto(inicial?.peso_animal),
    contacto_whatsapp: inicial?.contacto_whatsapp || '',
  });
  const [foto, setFoto] = useState(null);
  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const handleGuardar = () => {
    if (!form.tipo) return Alert.alert('Campo requerido', 'Selecciona el tipo de publicación.');
    if (form.titulo.trim().length < 3) return Alert.alert('Campo requerido', 'El título debe tener al menos 3 caracteres.');
    if (form.contenido.trim().length < 10) return Alert.alert('Campo requerido', 'El contenido debe tener al menos 10 caracteres.');
    if (!form.region) return Alert.alert('Campo requerido', 'Selecciona el departamento.');

    onGuardar({
      tipo: form.tipo,
      titulo: form.titulo.trim(),
      contenido: form.contenido.trim(),
      region: form.region,
      precio: form.precio ? parseFloat(form.precio) : undefined,
      raza_animal: form.raza_animal.trim() || undefined,
      peso_animal: form.peso_animal ? parseFloat(form.peso_animal) : undefined,
      contacto_whatsapp: form.contacto_whatsapp.trim() || undefined,
    }, foto);
  };

  const mostrarCamposAnimal = TIPOS_CON_ANIMAL.includes(form.tipo);

  return (
    <View style={{ padding: 24 }}>
      <PhotoPicker
        titulo="Foto de la publicación"
        asset={foto}
        existingUrl={inicial?.foto_url}
        onChange={setFoto}
      />
      <ChipPicker label="Tipo *" options={TIPOS_POST} value={form.tipo} onChange={(v) => set('tipo', v)} />
      <FormInput label="Título *" value={form.titulo} onChangeText={(v) => set('titulo', v)} />
      <FormInput label="Contenido *" multiline value={form.contenido} onChangeText={(v) => set('contenido', v)} />
      <ChipPicker label="Departamento *" options={REGIONES_GUATEMALA} value={form.region} onChange={(v) => set('region', v)} />

      {mostrarCamposAnimal && (
        <>
          <FormInput
            label="Precio (Q)"
            keyboardType="decimal-pad"
            value={form.precio}
            onChangeText={(v) => set('precio', v.replace(/[^0-9.]/g, ''))}
          />
          <FormInput label="Raza del animal" value={form.raza_animal} onChangeText={(v) => set('raza_animal', v)} />
          <FormInput
            label="Peso del animal (lb)"
            keyboardType="decimal-pad"
            value={form.peso_animal}
            onChangeText={(v) => set('peso_animal', v.replace(/[^0-9.]/g, ''))}
          />
        </>
      )}

      <FormInput
        label="WhatsApp de contacto"
        placeholder="502..."
        keyboardType="phone-pad"
        value={form.contacto_whatsapp}
        onChangeText={(v) => set('contacto_whatsapp', v)}
      />

      <PrimaryButton label={boton} onPress={handleGuardar} loading={guardando} />
    </View>
  );
}
