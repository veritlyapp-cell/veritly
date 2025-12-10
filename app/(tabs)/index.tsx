import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { AlertTriangle, Ban, CheckCircle2, ChevronDown, ChevronUp, Clock, FileType2, History, Image as ImageIcon, Info, Lightbulb, Link as LinkIcon, MessageCircleQuestion, Save, Sparkles, Trash2, X, XCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppConfig } from '../../constants/Config';
import { analyzeWithGemini, generateCareerAdvice, generateInterviewQuestions } from '../../utils/gemini';

// --- IMPORTACIONES DE NUBE (CRUCIAL PARA SINCRONIZAR) ---
import { auth } from '../../config/firebase';
import { getHistoryFromCloud, getUserProfileFromCloud, saveAnalysisToCloud, updateHistoryInCloud } from '../../services/storage';

// --- LOGO LOCAL ---
const LocalLogo = require('../../assets/images/veritly3.png');

export default function VinkuScanner() {
  const [mode, setMode] = useState<'text' | 'image'>('text');

  const [textValue, setTextValue] = useState('');
  const [imageValue, setImageValue] = useState<any>(null);
  const [optionalLink, setOptionalLink] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | any>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [interviewQuestions, setInterviewQuestions] = useState<string[] | null>(null);

  const [history, setHistory] = useState<any[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [careerAdvice, setCareerAdvice] = useState<string>('');
  const [logoError, setLogoError] = useState(false);

  // Estado para instrucciones
  const [showInstructions, setShowInstructions] = useState(true);

  const router = useRouter();

  // CARGAR HISTORIAL DE LA NUBE AL ENTRAR
  useFocusEffect(
    useCallback(() => {
      loadHistoryAndAdvice();
    }, [])
  );

  // --- MAGIA WEB (Pegar Imagen) ---
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handlePaste = (e: any) => {
        if (mode !== 'image') return;
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              setImageValue({ uri: URL.createObjectURL(file), webFile: file });
              e.preventDefault();
            }
          }
        }
      };
      window.addEventListener('paste', handlePaste);
      return () => window.removeEventListener('paste', handlePaste);
    }
  }, [mode]);

  const webDropProps = Platform.OS === 'web' ? {
    onDragOver: (e: any) => { e.preventDefault(); },
    onDragEnter: (e: any) => { e.preventDefault(); },
    onDrop: (e: any) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          setImageValue({ uri: URL.createObjectURL(file), webFile: file });
        } else {
          window.alert("Por favor suelta un archivo de imagen.");
        }
      }
    }
  } : {};

  // --- LÓGICA DE NUBE ---
  const loadHistoryAndAdvice = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const cloudHistory = await getHistoryFromCloud(user.uid);
      setHistory(cloudHistory);
      updateCoachAdvice(cloudHistory);
    } catch (e) {
      console.log("Error cargando historial nube", e);
    }
  };

  const updateCoachAdvice = async (currentHistory: any[]) => {
    if (currentHistory.length >= 1) {
      const summaryForAI = JSON.stringify(currentHistory.slice(0, 5).map((h: any) => ({
        role: h.role,
        match: h.match,
        status: h.status || 'Guardado'
      })));

      generateCareerAdvice(summaryForAI).then(advice => {
        if (advice && advice.advice) setCareerAdvice(advice.advice);
      }).catch(err => console.log("Error coach:", err));
    }
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
    else Alert.alert(title, message);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.8,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setImageValue({ uri: asset.uri, webFile: Platform.OS === 'web' ? (asset as any).file : undefined });
    }
  };

  const clearImage = () => setImageValue(null);

  // --- ACTUALIZAR ESTATUS EN NUBE ---
  const updateStatus = async (id: string, newStatus: string) => {
    const user = auth.currentUser;
    if (!user) return;

    const updatedHistory = history.map(item =>
      item.id === id ? { ...item, status: newStatus } : item
    );
    setHistory(updatedHistory);

    if (selectedHistory && selectedHistory.id === id) {
      setSelectedHistory({ ...selectedHistory, status: newStatus });
    }

    await updateHistoryInCloud(user.uid, [...updatedHistory].reverse());
    updateCoachAdvice(updatedHistory);
  };

  // --- GUARDAR EN NUBE ---
  const saveAnalysis = async () => {
    if (!result) return;
    const user = auth.currentUser;
    if (!user) return showAlert("Error", "Inicia sesión para guardar.");

    if (history.length >= 10) {
      showAlert("Límite Alcanzado", "Máximo 10 análisis. Borra algunos.");
      return;
    }

    try {
      const newItem = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        match: result.match,
        role: result.role && result.role !== "NN" ? result.role : "Puesto Detectado",
        company: result.company && result.company !== "NN" ? result.company : "Empresa Detectada",
        reason: result.reason,
        tips: result.tips,
        questions: interviewQuestions,
        link: optionalLink,
        status: 'Guardado'
      };

      const newHistory = [newItem, ...history];
      setHistory(newHistory);

      await saveAnalysisToCloud(user.uid, newItem);

      showAlert("✅ Guardado", "Sincronizado en la nube.");
      updateCoachAdvice(newHistory);
    } catch (e) {
      showAlert("Error", "No se pudo guardar.");
    }
  };

  // --- BORRAR DE NUBE ---
  const deleteHistoryItem = async (id: string) => {
    const user = auth.currentUser;
    if (!user) return;

    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);

    if (selectedHistory && selectedHistory.id === id) setSelectedHistory(null);

    await updateHistoryInCloud(user.uid, [...newHistory].reverse());
    updateCoachAdvice(newHistory);
  };

  // --- ANALIZAR CON VALIDACIÓN ESTRICTA ---
  const handleAnalyze = async () => {
    let dataToAnalyze: any = null;
    if (mode === 'text') {
      if (!textValue || textValue.length < 20) return showAlert("Error", "Texto muy corto.");
      dataToAnalyze = textValue;
    } else if (mode === 'image') {
      if (!imageValue) return showAlert("Falta Imagen", "Sube una captura.");
      dataToAnalyze = imageValue;
    }

    setLoading(true);
    setInterviewQuestions(null);

    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return showAlert("Error", "Inicia sesión.");
    }

    try {
      // LEER PERFIL DE NUBE
      const profileData = await getUserProfileFromCloud(user.uid);

      // VALIDACIÓN: ¿Tiene los datos obligatorios?
      if (!profileData || !profileData.fullName || !profileData.birthDate || !profileData.district || !profileData.bio) {
        setLoading(false);
        Alert.alert(
          "⚠️ Perfil Incompleto",
          "Para usar la IA, necesitamos que completes tu perfil:\n- Nombre\n- Fecha de Nacimiento\n- Ubicación\n- CV",
          [
            { text: "Ir a Completar", onPress: () => router.push('/(tabs)/profile') },
            { text: "Cancelar", style: "cancel" }
          ]
        );
        return;
      }

      const userProfileText = profileData.contextForAI || "";
      const userAspirations = profileData.interests || "";

      if (!userProfileText || userProfileText.length < 20) {
        setLoading(false);
        showAlert("Error", "Perfil vacío en la nube. Ve a 'Mi CV' y guarda de nuevo.");
        return;
      }

      const aiResponse = await analyzeWithGemini(userProfileText, dataToAnalyze, mode === 'text' ? 'text' : 'image', userAspirations);

      if (aiResponse) {
        setResult(aiResponse);
        setShowInstructions(false); // Ocultar instrucciones al tener resultado
      } else {
        throw new Error("Error IA");
      }
    } catch (e: any) {
      console.error(e);
      showAlert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuestions = async (dataOverride?: any, profileOverride?: any) => {
    setLoadingQuestions(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      let userProfileText = profileOverride;
      if (!userProfileText) {
        const profileData = await getUserProfileFromCloud(user.uid);
        userProfileText = profileData?.contextForAI || "";
      }

      let dataToAnalyze = dataOverride;
      if (!dataToAnalyze) {
        if (mode === 'text') dataToAnalyze = textValue;
        else if (mode === 'image') dataToAnalyze = imageValue;
      }

      if (!userProfileText) return;

      console.log("Generando preguntas...");
      const response = await generateInterviewQuestions(userProfileText, dataToAnalyze, mode === 'text' ? 'text' : 'image');
      console.log("Respuesta preguntas:", response);

      if (response && response.questions && response.questions.length > 0) {
        setInterviewQuestions(response.questions);
      } else {
        showAlert("Aviso", "La IA no generó preguntas esta vez. Intenta de nuevo.");
        setInterviewQuestions(null);
      }

    } catch (e: any) {
      console.log("Error preguntas:", e);
      showAlert("Error Generando Preguntas", `Hubo un problema: ${e.message || "Desconocido"}. Intenta de nuevo.`);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const reset = () => {
    setResult(null); setInterviewQuestions(null);
    setTextValue(''); setImageValue(null); setOptionalLink('');
    setShowInstructions(true);
  }

  const openLink = (url: string) => {
    if (url) Linking.openURL(url).catch(err => showAlert("Error", "No se pudo abrir el link"));
  };

  const renderStatusBadge = (status: string) => {
    let color = '#94a3b8';
    let icon = <Clock size={12} color="white" />;
    switch (status) {
      case 'Postulado': color = '#3b82f6'; icon = <Sparkles size={12} color="white" />; break;
      case 'Entrevista': color = '#8b5cf6'; icon = <MessageCircleQuestion size={12} color="white" />; break;
      case 'Contratado': color = '#10b981'; icon = <CheckCircle2 size={12} color="white" />; break;
      case 'Rechazado': color = '#ef4444'; icon = <XCircle size={12} color="white" />; break;
      case 'No Postulé': color = '#64748b'; icon = <Ban size={12} color="white" />; break;
    }
    return (
      <View style={[styles.statusBadge, { backgroundColor: color }]}>
        {icon}
        <Text style={styles.statusText}>{status}</Text>
      </View>
    );
  };

  // --- RENDER RESULTADOS ---
  if (result) {
    const isGood = result.match >= 70;
    const color = isGood ? '#16a34a' : '#eab308';
    const reasonLower = result.reason ? result.reason.toLowerCase() : "";
    const isOverqualified = reasonLower.includes("sobrecalificado") || reasonLower.includes("excede");

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isGood ? '#f0fdf4' : '#fefce8' }]}>
        <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center', flexGrow: 1, justifyContent: 'center' }}>
          <Text style={[styles.companyTitle, { color: color }]}>{result.role && result.role !== "NN" ? result.role : "Puesto Detectado"}</Text>
          <Text style={styles.companyName}>{result.company && result.company !== "NN" ? result.company : "Empresa Detectada"}</Text>
          <Text style={[styles.title, { color: color, fontSize: 50 }]}>{result.match}%</Text>
          {isOverqualified && (
            <View style={styles.overqualifiedBox}>
              <AlertTriangle size={24} color="#c2410c" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.overqualifiedTitle}>ALERTA DE RIESGO</Text>
                <Text style={styles.overqualifiedText}>Posible sobrecalificación detectada.</Text>
              </View>
            </View>
          )}
          <View style={styles.reasonBox}><Text style={styles.reasonText}>{result.reason}</Text></View>
          <View style={{ width: '100%', gap: 10, marginBottom: 20 }}>
            {result.tips.map((t: string, i: number) => (
              <View key={i} style={[styles.tipCard, { borderLeftColor: color }]}>
                <Text style={{ color: '#1e293b' }}>{t}</Text>
              </View>
            ))}
          </View>
          <View style={{ width: '100%', marginBottom: 20 }}>
            <Text style={styles.label}>LINK DE REFERENCIA (Opcional)</Text>
            <TextInput style={[styles.input, { borderColor: color, borderWidth: 1, backgroundColor: 'white', color: '#334155' }]} placeholder="Pega aquí el link..." placeholderTextColor="#94a3b8" value={optionalLink} onChangeText={setOptionalLink} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, width: '100%', justifyContent: 'center', marginBottom: 20 }}>
            {!interviewQuestions && (
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#4f46e5', flex: 1 }]} onPress={() => handleGenerateQuestions()} disabled={loadingQuestions}>
                {loadingQuestions ? <ActivityIndicator color="white" /> : <MessageCircleQuestion size={20} color="white" />}
                <Text style={styles.smallButtonText}>{loadingQuestions ? "Generando..." : "Ver Preguntas"}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#0f172a', flex: 1 }]} onPress={saveAnalysis}>
              <Save size={20} color="white" />
              <Text style={styles.smallButtonText}>Guardar</Text>
            </TouchableOpacity>
          </View>
          {interviewQuestions && (
            <View style={styles.questionsContainer}>
              <Text style={styles.questionsTitle}>🔮 Preguntas Predictivas</Text>
              {interviewQuestions.map((q, idx) => (
                <View key={idx} style={styles.questionCard}>
                  <Text style={{ marginRight: 8 }}>❓</Text>
                  <Text style={styles.questionText}>{q}</Text>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity style={[styles.button, { backgroundColor: color, marginTop: 10, width: '100%' }]} onPress={reset}>
            <Text style={styles.buttonText}>OTRO ANÁLISIS</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* HEADER CON LOGO LOCAL */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {!logoError ? (
              <Image
                source={LocalLogo}
                style={styles.logoImage}
                resizeMode="contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <CheckCircle2 size={45} color="#38bdf8" style={{ marginRight: 10 }} />
            )}
            <Text style={styles.logo}>{AppConfig.name.toUpperCase()}</Text>
          </View>
          <View style={styles.badge}><Text style={styles.badgeText}>IA 2.5</Text></View>
        </View>

        {/* TITULO */}
        <Text style={styles.hero}>Match Profile</Text>

        {/* INSTRUCCIONES DESPLEGABLES */}
        <TouchableOpacity style={styles.instructionsContainer} onPress={() => setShowInstructions(!showInstructions)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Info size={16} color="#38bdf8" style={{ marginRight: 8 }} />
              <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>¿Cómo funciona?</Text>
            </View>
            {showInstructions ? <ChevronUp size={16} color="#38bdf8" /> : <ChevronDown size={16} color="#38bdf8" />}
          </View>

          {showInstructions && (
            <View style={{ marginTop: 10 }}>
              <View style={styles.stepRow}>
                <Text style={styles.stepNum}>1</Text>
                <Text style={styles.stepText}>Elige Texto o Foto y pega la vacante.</Text>
              </View>
              <View style={styles.stepRow}>
                <Text style={styles.stepNum}>2</Text>
                <Text style={styles.stepText}>Dale a Analizar para ver tu % de Match.</Text>
              </View>
              <View style={styles.stepRow}>
                <Text style={styles.stepNum}>3</Text>
                <Text style={styles.stepText}>Obtén consejos clave y preguntas de entrevista.</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.card}>
          <View style={styles.tabContainer}>
            <TouchableOpacity style={[styles.tab, mode === 'text' && styles.activeTab]} onPress={() => setMode('text')}><FileType2 size={18} color={mode === 'text' ? 'white' : '#64748b'} /><Text style={[styles.tabText, mode === 'text' && { color: 'white' }]}> Pegar Texto</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tab, mode === 'image' && styles.activeTab]} onPress={() => setMode('image')}><ImageIcon size={18} color={mode === 'image' ? 'white' : '#64748b'} /><Text style={[styles.tabText, mode === 'image' && { color: 'white' }]}> Subir Foto</Text></TouchableOpacity>
          </View>
          {mode === 'text' && <TextInput style={[styles.input, { minHeight: 120 }]} placeholder="Pega descripción..." placeholderTextColor="#64748b" value={textValue} onChangeText={setTextValue} multiline />}
          {mode === 'image' && (
            <View style={{ position: 'relative' }}>
              <TouchableOpacity style={styles.imageUpload} onPress={pickImage} {...(Platform.OS === 'web' ? (webDropProps as any) : {})}>
                {imageValue ? <Image source={{ uri: imageValue.uri }} style={{ width: '100%', height: 150, borderRadius: 8 }} resizeMode="cover" /> : <View style={{ alignItems: 'center' }}><ImageIcon size={40} color="#3b82f6" /><Text style={{ color: '#64748b', marginTop: 10, fontSize: 12, textAlign: 'center' }}>Toca para subir{'\n'}o <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>Pega (Ctrl+V)</Text></Text></View>}
              </TouchableOpacity>
              {imageValue && <TouchableOpacity style={styles.deleteImageBtn} onPress={clearImage}><Trash2 size={18} color="white" /></TouchableOpacity>}
            </View>
          )}
          <Text style={[styles.label, { marginTop: 10 }]}>LINK DE REFERENCIA (Opcional)</Text>
          <TextInput style={[styles.input, { height: 50, marginBottom: 20 }]} placeholder="Pega el link aquí..." placeholderTextColor="#64748b" value={optionalLink} onChangeText={setOptionalLink} />
          <TouchableOpacity style={styles.button} onPress={handleAnalyze} disabled={loading}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>ANALIZAR</Text>}
          </TouchableOpacity>
        </View>

        {/* --- HISTORIAL --- */}
        <View style={{ marginTop: 30, paddingBottom: 20 }}>
          {careerAdvice !== '' && (
            <View style={styles.adviceBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                <Lightbulb color="#8b5cf6" size={18} style={{ marginRight: 8 }} />
                <Text style={styles.adviceTitle}>Coach de Carrera</Text>
              </View>
              <Text style={styles.adviceText}>{careerAdvice}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <History size={20} color="#94a3b8" style={{ marginRight: 10 }} />
            <Text style={{ color: '#94a3b8', fontWeight: 'bold' }}>HISTORIAL RECIENTE</Text>
          </View>
          {history.length === 0 ? (
            <Text style={{ color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>No hay análisis guardados.</Text>
          ) : (
            history.map((item, index) => (
              <TouchableOpacity key={index} style={styles.historyItem} onPress={() => setSelectedHistory(item)}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.historyRole} numberOfLines={1}>{item.role}</Text>
                  </View>
                  <Text style={styles.historyCompany} numberOfLines={1}>{item.company}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {renderStatusBadge(item.status || 'Guardado')}
                    <Text style={[styles.historyMatch, { color: item.match >= 70 ? '#16a34a' : '#eab308', marginRight: 0 }]}>{item.match}%</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => deleteHistoryItem(item.id)} style={{ paddingLeft: 10 }}>
                  <Trash2 size={18} color="#ef4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* MODAL DETALLE */}
      {selectedHistory && (
        <Modal animationType="slide" transparent={true} visible={!!selectedHistory} onRequestClose={() => setSelectedHistory(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Detalle</Text>
                <TouchableOpacity onPress={() => setSelectedHistory(null)}><X size={24} color="#334155" /></TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={[styles.companyTitle, { color: '#0f172a', fontSize: 22, textAlign: 'left' }]}>{selectedHistory.role}</Text>
                <Text style={[styles.companyName, { textAlign: 'left', fontSize: 18, marginBottom: 10 }]}>{selectedHistory.company}</Text>

                <View style={{ marginVertical: 15 }}>
                  <Text style={{ fontWeight: 'bold', color: '#64748b', marginBottom: 8 }}>ESTATUS ACTUAL:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {['Postulado', 'Entrevista', 'Contratado', 'Rechazado', 'No Postulé'].map(status => (
                      <TouchableOpacity
                        key={status}
                        onPress={() => updateStatus(selectedHistory.id, status)}
                        style={[
                          styles.statusButton,
                          selectedHistory.status === status && styles.statusButtonActive
                        ]}
                      >
                        <Text style={[styles.statusButtonText, selectedHistory.status === status && { color: 'white' }]}>{status}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                {selectedHistory.link ? (
                  <TouchableOpacity style={styles.linkButton} onPress={() => openLink(selectedHistory.link)}>
                    <LinkIcon size={16} color="white" />
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>ABRIR OFERTA</Text>
                  </TouchableOpacity>
                ) : null}
                <View style={[styles.reasonBox, { marginTop: 10 }]}>
                  <Text style={styles.reasonText}>{selectedHistory.reason}</Text>
                </View>
                {selectedHistory.questions && (
                  <View style={styles.questionsContainer}>
                    <Text style={styles.questionsTitle}>Preguntas Guardadas</Text>
                    {selectedHistory.questions.map((q: string, i: number) => (
                      <Text key={i} style={{ marginBottom: 8, color: '#334155' }}>• {q}</Text>
                    ))}
                  </View>
                )}
                <TouchableOpacity onPress={() => deleteHistoryItem(selectedHistory.id)} style={styles.deleteButton}>
                  <Trash2 size={20} color="#ef4444" />
                  <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Eliminar del Historial</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scrollContent: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 30, marginTop: 20 },
  logo: { fontSize: 24, fontWeight: '900', color: 'white', letterSpacing: 2 },
  logoImage: { width: 50, height: 50, marginRight: 10 },
  badge: { backgroundColor: '#3b82f6', paddingHorizontal: 8, borderRadius: 4, marginLeft: 10 },
  badgeText: { color: 'white', fontWeight: 'bold', fontSize: 10 },
  hero: { fontSize: 32, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 20 },
  card: { backgroundColor: '#1e293b', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#334155' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#0f172a', borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8 },
  activeTab: { backgroundColor: '#334155' },
  tabText: { color: '#64748b', fontWeight: 'bold', fontSize: 12 },
  label: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold', marginBottom: 10 },
  input: { backgroundColor: '#0f172a', color: 'white', padding: 16, borderRadius: 12, fontSize: 14, borderWidth: 1, borderColor: '#334155', marginBottom: 10 },
  button: { backgroundColor: '#4f46e5', padding: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
  tipCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, width: '100%', borderLeftWidth: 5, shadowColor: '#000', elevation: 2 },
  title: { fontSize: 28, fontWeight: 'bold' },
  imageUpload: { height: 150, backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#334155', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  deleteImageBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(239, 68, 68, 0.9)', padding: 8, borderRadius: 20, zIndex: 10 },
  reasonBox: { backgroundColor: 'rgba(0,0,0,0.05)', padding: 15, borderRadius: 10, marginBottom: 20, width: '100%' },
  reasonText: { color: '#334155', fontStyle: 'italic', textAlign: 'center', lineHeight: 20 },
  overqualifiedBox: { flexDirection: 'row', backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fdba74', borderRadius: 12, padding: 15, marginBottom: 20, alignItems: 'center', width: '100%' },
  overqualifiedTitle: { color: '#c2410c', fontWeight: 'bold', fontSize: 14, marginBottom: 2 },
  overqualifiedText: { color: '#9a3412', fontSize: 12 },
  actionButton: { flexDirection: 'row', padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 2 },
  smallButtonText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  questionsContainer: { width: '100%', marginTop: 20, backgroundColor: 'rgba(255,255,255,0.6)', padding: 15, borderRadius: 16 },
  questionsTitle: { fontSize: 16, fontWeight: 'bold', color: '#4338ca', marginBottom: 15, textAlign: 'center' },
  questionCard: { flexDirection: 'row', marginBottom: 12, backgroundColor: 'white', padding: 12, borderRadius: 8 },
  questionIcon: { fontSize: 18, marginRight: 10 },
  questionText: { flex: 1, color: '#334155', fontStyle: 'italic', fontSize: 14 },
  companyTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  companyName: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 10 },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#334155', justifyContent: 'space-between' },
  historyRole: { color: 'white', fontWeight: 'bold', fontSize: 14, flex: 1 },
  historyCompany: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  historyMatch: { fontSize: 18, fontWeight: 'bold', marginRight: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  statusBadge: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignItems: 'center', gap: 4 },
  statusText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  statusButton: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f1f5f9' },
  statusButtonActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  statusButtonText: { color: '#64748b', fontSize: 12, fontWeight: 'bold' },
  linkButton: { flexDirection: 'row', backgroundColor: '#0f172a', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 15 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, gap: 8, padding: 10, backgroundColor: '#fef2f2', borderRadius: 8 },
  adviceBox: { backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#8b5cf6', borderRadius: 12, padding: 15, marginBottom: 20 },
  adviceTitle: { color: '#7c3aed', fontWeight: 'bold', fontSize: 14 },
  adviceText: { color: '#4c1d95', fontStyle: 'italic', lineHeight: 20 },

  // ESTILOS INSTRUCCIONES
  instructionsContainer: { backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.3)' },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stepNum: { width: 20, height: 20, backgroundColor: '#38bdf8', borderRadius: 10, textAlign: 'center', color: 'black', fontSize: 12, fontWeight: 'bold', lineHeight: 20, marginRight: 10 },
  stepText: { color: '#bae6fd', fontSize: 12 }
});
