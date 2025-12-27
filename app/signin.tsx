import { useRouter } from 'expo-router';

import { ArrowRight, Lock, Mail } from 'lucide-react-native';

import React, { useState } from 'react';

import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';



export default function LoginScreen() {

  const router = useRouter();

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');



  // Simulación de Login (Luego conectamos Firebase real)

  const handleLogin = () => {

    // Aquí iría la lógica: await signInWithEmailAndPassword(auth, email, password);

    router.replace('/(tabs)'); // Te lleva directo a la App principal

  };



  return (

    <SafeAreaView style={styles.container}>

      <View style={styles.content}>



        {/* Header / Logo */}

        <View style={styles.header}>

          <View style={styles.logoCircle}>

            <Text style={{ fontSize: 40 }}>🪐</Text>

          </View>

          <Text style={styles.title}>VERITLY</Text>

          <Text style={styles.subtitle}>Tu Copiloto de Carrera con IA</Text>

        </View>



        {/* Formulario */}

        <View style={styles.form}>

          <View style={styles.inputContainer}>

            <Mail color="#64748b" size={20} style={{ marginRight: 10 }} />

            <TextInput

              style={styles.input}

              placeholder="Correo electrónico"

              placeholderTextColor="#64748b"

              value={email}

              onChangeText={setEmail}

            />

          </View>



          <View style={styles.inputContainer}>

            <Lock color="#64748b" size={20} style={{ marginRight: 10 }} />

            <TextInput

              style={styles.input}

              placeholder="Contraseña"

              placeholderTextColor="#64748b"

              secureTextEntry

              value={password}

              onChangeText={setPassword}

            />

          </View>



          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>

            <Text style={styles.loginText}>INICIAR SESIÓN</Text>

            <ArrowRight color="white" size={20} />

          </TouchableOpacity>



          {/* Separador */}

          <View style={styles.divider}>

            <View style={styles.line} />

            <Text style={styles.orText}>O continúa con</Text>

            <View style={styles.line} />

          </View>



          {/* Botón Google (Visual) */}

          <TouchableOpacity style={styles.googleButton} onPress={handleLogin}>

            {/* Usamos texto G por ahora, luego ponemos el logo real */}

            <Text style={styles.googleText}>🔵  Google</Text>

          </TouchableOpacity>

        </View>



        <Text style={styles.footerText}>¿Eres empresa? <Text onPress={() => router.push('/empresa/signin')} style={{ color: '#38bdf8', fontWeight: 'bold' }}>Entrar aquí</Text></Text>

      </View>

    </SafeAreaView>

  );

}



const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: '#0f172a' },

  content: { flex: 1, padding: 30, justifyContent: 'center' },

  header: { alignItems: 'center', marginBottom: 50 },

  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(56, 189, 248, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },

  title: { fontSize: 32, fontWeight: '900', color: 'white', letterSpacing: 4 },

  subtitle: { fontSize: 16, color: '#94a3b8', marginTop: 5 },

  form: { width: '100%' },

  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 15, height: 55, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },

  input: { flex: 1, color: 'white', fontSize: 16 },

  loginButton: { backgroundColor: '#3b82f6', flexDirection: 'row', height: 55, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 30, gap: 10 },

  loginText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },

  line: { flex: 1, height: 1, backgroundColor: '#334155' },

  orText: { color: '#64748b', marginHorizontal: 10, fontSize: 12 },

  googleButton: { backgroundColor: 'white', height: 55, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  googleText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },

  footerText: { textAlign: 'center', color: '#64748b', marginTop: 40, fontSize: 14 }

});