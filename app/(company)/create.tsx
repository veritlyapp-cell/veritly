import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

// Imports de nuestra lógica
import { analyzeJobDescription } from '../../utils/gemini';
import { createJobPosting } from '../../services/storage';
import { auth } from '../../config/firebase';

export default function CreateJobScreen() {
  const router = useRouter();
  
  // Estados del formulario
  const [title, setTitle] = useState('');
  const [rawDescription, setRawDescription] = useState('');
  const [location, setLocation] = useState('');
  
  // Estados de carga e IA
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ structuredProfile: string, jobPostDraft: string } | null>(null);

  // 1. ANÁLISIS CON IA
  const handleAnalyze = async () => {
    if (!title.trim() || !rawDescription.trim()) {
      Alert.alert("Faltan datos", "Por favor ingresa un título y una descripción base.");
      return;
    }

    setLoading(true);
    try {
      const result = await analyzeJobDescription(rawDescription);
      if (result) {
        setAiResult(result);
      } else {
        Alert.alert("Error", "La IA no pudo procesar la descripción. Intenta de nuevo.");
      }
    } catch (e) {
      Alert.alert("Error", "Falló la conexión con la IA.");
    } finally {
      setLoading(false);
    }
  };

  // 2. GUARDAR EN FIREBASE
  const handleSave = async () => {
    if (!auth.currentUser || !aiResult) return;

    setLoading(true);
    try {
      // Guardamos en Firestore
      const newJobId = await createJobPosting({
        companyId: auth.currentUser.uid,
        title: title,
        location: location || "Remoto / Híbrido",
        description: aiResult.structuredProfile, // Guardamos la versión bonita
        rawDescription: rawDescription,          // Guardamos el original por si acaso
        jobPostDraft: aiResult.jobPostDraft,     // Guardamos el borrador para LinkedIn
        createdAt: Date.now(),
        isActive: true
      });

      // Redirigir al Dashboard de la Vacante (Etapa 3)
      Alert.alert("¡Éxito!", "Vacante creada correctamente.");
      // Pasamos título y descripción como params opcionales para carga rápida visual
      router.replace({
        pathname: `/(company)/job/${newJobId}`,
        params: { title: title }
      });

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo guardar la vacante.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("Copiado", "Texto copiado al portapapeles.");
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
        
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nueva Vacante</Text>
        </View>

        {/* Formulario Inicial */}
        <Text style={styles.label}>Título del Puesto</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Ej. UX Designer Senior" 
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Ubicación (Opcional)</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Ej. Lima, Perú (Híbrido)" 
          value={location}
          onChangeText={setLocation}
        />

        <Text style={styles.label}>Descripción o Requerimientos (Raw)</Text>
        <Text style={styles.helperText}>Pega aquí la descripción "sucia" o punteada. La IA la ordenará.</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          placeholder="Pegar descripción aquí..." 
          value={rawDescription}
          onChangeText={setRawDescription}
          multiline
          textAlignVertical="top"
        />

        {/* Botón de Acción IA */}
        {!aiResult && (
          <TouchableOpacity 
            style={[styles.mainBtn, loading && styles.disabledBtn]} 
            onPress={handleAnalyze}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.btnText}>✨ Generar Perfil con IA</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Resultados de la IA */}
        {aiResult && (
          <View style={styles.resultContainer}>
            <View style={styles.divider} />
            <Text style={styles.sectionHeader}>Resultados Generados</Text>
            
            {/* Tab 1: Perfil Estructurado */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📄 Perfil Interno (Estructurado)</Text>
              <Text style={styles.previewText} numberOfLines={6}>
                {aiResult.structuredProfile}
              </Text>
              <Text style={styles.moreText}>... (Se guardará completo)</Text>
            </View>

            {/* Tab 2: Post para Redes */}
            <View style={[styles.card, styles.linkedinCard]}>
              <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                <Text style={styles.cardTitle}>📢 Post para LinkedIn</Text>
                <TouchableOpacity onPress={() => copyToClipboard(aiResult.jobPostDraft)}>
                  <Ionicons name="copy-outline" size={20} color="#0077B5" />
                </TouchableOpacity>
              </View>
              <Text style={styles.previewText}>
                {aiResult.jobPostDraft}
              </Text>
            </View>

            {/* Botones Finales */}
            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={styles.secondaryBtn} 
                onPress={() => setAiResult(null)} // Resetear para editar
              >
                <Text style={styles.secondaryBtnText}>Editar Datos</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.saveBtn} 
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Guardar y Continuar ➝</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA', padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  backBtn: { padding: 5, marginRight: 10 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A' },
  
  label: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 10 },
  helperText: { fontSize: 12, color: '#666', marginBottom: 8 },
  input: { backgroundColor: 'white', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 16 },
  textArea: { height: 120 },

  mainBtn: { backgroundColor: '#6200EE', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 20, shadowColor: '#6200EE', shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
  disabledBtn: { backgroundColor: '#A0A0A0' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  resultContainer: { marginTop: 10 },
  divider: { height: 1, backgroundColor: '#DDD', marginVertical: 20 },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#444' },
  
  card: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#EEE' },
  linkedinCard: { backgroundColor: '#F3F9FC', borderColor: '#C8E4F5' },
  cardTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: '#555' },
  previewText: { fontSize: 14, color: '#333', lineHeight: 20 },
  moreText: { fontSize: 12, color: '#999', marginTop: 5, fontStyle: 'italic' },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 10 },
  secondaryBtn: { flex: 1, padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#666', alignItems: 'center' },
  secondaryBtnText: { color: '#666', fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: '#00C853', padding: 15, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: 'white', fontWeight: 'bold' },
});