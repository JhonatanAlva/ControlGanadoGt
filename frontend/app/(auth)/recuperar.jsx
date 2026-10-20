// app/(auth)/recuperar.jsx
// Paso 1: pedir el código al correo. Paso 2: ingresar código + nueva contraseña.
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert, StyleSheet,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { authService } from '../../services/authService';
import { COLORS } from '../../constants/colors';
import { validarPassword } from '../../utils/password';

export default function RecuperarScreen() {
  const router = useRouter();
  const [paso,     setPaso]     = useState(1);
  const [email,    setEmail]    = useState('');
  const [codigo,   setCodigo]   = useState('');
  const [nueva,    setNueva]    = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading,  setLoading]  = useState(false);

  const emailLimpio = email.trim().toLowerCase();

  const handleSolicitar = async () => {
    if (!emailLimpio) {
      Alert.alert('Campo requerido', 'Ingresa el email de tu cuenta.');
      return;
    }
    setLoading(true);
    try {
      const res = await authService.solicitarRecuperacion(emailLimpio);
      // El mensaje es el mismo exista o no la cuenta
      Alert.alert('Revisa tu correo', res.data.message);
      setPaso(2);
    } catch (err) {
      Alert.alert('Error', err.mensaje || 'No se pudo enviar el código.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestablecer = async () => {
    if (!/^\d{6}$/.test(codigo)) {
      Alert.alert('Código inválido', 'El código tiene 6 dígitos.');
      return;
    }
    const errorPassword = validarPassword(nueva);
    if (errorPassword) {
      Alert.alert('Contraseña insegura', errorPassword);
      return;
    }
    if (nueva !== confirmar) {
      Alert.alert('No coinciden', 'La confirmación no coincide con la nueva contraseña.');
      return;
    }
    setLoading(true);
    try {
      const res = await authService.restablecerPassword({ email: emailLimpio, codigo, passwordNueva: nueva });
      Alert.alert('Listo', res.data.message, [
        { text: 'Iniciar sesión', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err) {
      Alert.alert('Error', err.mensaje || 'No se pudo restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <Text style={styles.emoji}>🔑</Text>
          <Text style={styles.appName}>Recuperar contraseña</Text>
          <Text style={styles.appSub}>GanaderíaGT</Text>
        </View>

        <View style={styles.form}>
          {paso === 1 ? (
            <>
              <Text style={styles.ayuda}>
                Escribe el email de tu cuenta y te enviaremos un código de 6 dígitos.
              </Text>

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="tu@email.com"
                placeholderTextColor={COLORS.gray500}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.btn, loading && { opacity: 0.7 }]}
                onPress={handleSolicitar}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Enviar código</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.ayuda}>
                Ingresa el código que llegó a <Text style={{ fontWeight: '600' }}>{emailLimpio}</Text>. Vence en 15 minutos.
              </Text>

              <Text style={styles.label}>Código</Text>
              <TextInput
                style={[styles.input, styles.inputCodigo]}
                placeholder="000000"
                placeholderTextColor={COLORS.gray300}
                value={codigo}
                onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
              />

              <Text style={styles.label}>Nueva contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 8, con letras y números"
                placeholderTextColor={COLORS.gray500}
                value={nueva}
                onChangeText={setNueva}
                secureTextEntry
              />

              <Text style={styles.label}>Confirmar nueva contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={COLORS.gray500}
                value={confirmar}
                onChangeText={setConfirmar}
                secureTextEntry
              />

              <TouchableOpacity
                style={[styles.btn, loading && { opacity: 0.7 }]}
                onPress={handleRestablecer}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Cambiar contraseña</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { setCodigo(''); setPaso(1); }} style={styles.reenviar}>
                <Text style={styles.link}>¿No te llegó? Enviar otro código</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.row}>
            <Link href="/(auth)/login">
              <Text style={styles.link}>Volver a iniciar sesión</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
  },
  emoji:   { fontSize: 40, marginBottom: 4 },
  appName: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  appSub:  { color: '#a7d7b0', fontSize: 14, marginTop: 2 },
  form:    { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  ayuda:   { fontSize: 14, color: COLORS.gray600, lineHeight: 20, marginBottom: 24 },
  label:   { fontSize: 13, color: COLORS.gray600, fontWeight: '500', marginBottom: 6 },
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
  inputCodigo: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: 'bold' },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText:  { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  reenviar: { alignItems: 'center', marginTop: 16 },
  row:      { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  link:     { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
});
