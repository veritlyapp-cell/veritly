import { useFocusEffect, useRouter } from 'expo-router';
import { Ban, CheckCircle2, History, Lightbulb, Link as LinkIcon, MessageCircleQuestion, Clock, Sparkles, Trash2, X, XCircle, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { generateCareerAdvice } from '../../utils/gemini';

// --- IMPORTACIONES DE NUBE (CRUCIAL PARA SINCRONIZAR) ---
import AppHeader from '../../components/AppHeader';
import { auth } from '../../config/firebase';
import { getHistoryFromCloud, updateHistoryInCloud } from '../../services/storage';

export default function MyApplications() {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [careerAdvice, setCareerAdvice] = useState<string>('');

  // Estado de autenticación
  const [authChecking, setAuthChecking] = useState(true);
  const [user, setUser] = useState<any>(null);

  const router = useRouter();

  // MONITOR DE AUTENTICACIÓN
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);

      if (currentUser) {
        loadHistoryAndAdvice();
      }
    });

    return () => unsubscribe();
  }, []);

  // CARGAR HISTORIAL DE LA NUBE AL ENTRAR
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadHistoryAndAdvice();
      }
    }, [user])
  );

  // --- LÓGICA DE NUBE ---
  const loadHistoryAndAdvice = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setLoading(true);
    try {
      const cloudHistory = await getHistoryFromCloud(currentUser.uid);
      setHistory(cloudHistory);
      updateCoachAdvice(cloudHistory);
    } catch (e) {
      console.error("❌ Error cargando historial nube", e);
    } finally {
      setLoading(false);
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

  const openLink = (url: string) => {
    if (url) Linking.openURL(url).catch(err => showAlert("Error", "No se pudo abrir el link"));
  };

  const openRacso = () => Linking.openURL('https://racso.app/ingreso');

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

  // MOSTRAR LOADING MIENTRAS VERIFICA AUTENTICACIÓN
  if (authChecking) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={{ color: '#94a3b8', marginTop: 20, fontSize: 16 }}>Verificando sesión...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // REDIRIGIR SI NO HAY USUARIO
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Sparkles size={60} color="#38bdf8" />
          <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginTop: 20, textAlign: 'center' }}>
            Inicia Sesión
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 16, marginTop: 10, textAlign: 'center', lineHeight: 24 }}>
            Para ver tus postulaciones necesitas iniciar sesión primero.
          </Text>
          <TouchableOpacity
            style={[styles.button, { marginTop: 30, backgroundColor: '#3b82f6' }]}
            onPress={() => router.push('/signin')}
          >
            <Text style={styles.buttonText}>Ir a Iniciar Sesión</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* HEADER CON BOTONES DE CERRAR SESIÓN Y COMPARTIR */}
        <AppHeader />

        {/* TITULO */}
        <Text style={styles.hero}>Mis Postulaciones</Text>

        {/* --- HISTORIAL / POSTULACIONES --- */}
        <View style={{ paddingBottom: 20 }}>
          {careerAdvice !== '' && (
            <View style={styles.adviceBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                <Lightbulb color="#8b5cf6" size={18} style={{ marginRight: 8 }} />
                <Text style={styles.adviceTitle}>Coach de Carrera</Text>
              </View>
              <Text style={styles.adviceText}>{careerAdvice}</Text>
            </View>
          )}

          {loading && history.length === 0 ? (
            <ActivityIndicator size="large" color="#38bdf8" style={{ marginVertical: 30 }} />
          ) : history.length === 0 ? (
            <View style={styles.emptyBox}>
              <History size={32} color="#334155" style={{ marginBottom: 10 }} />
              <Text style={{ color: '#64748b', textAlign: 'center' }}>
                Todavía no tienes postulaciones. Cuando postules a una vacante en Veritly, aparecerá aquí junto a tu % de match.
              </Text>
            </View>
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
                    {typeof item.match === 'number' && (
                      <Text style={[styles.historyMatch, { color: item.match >= 70 ? '#16a34a' : '#eab308', marginRight: 0 }]}>{item.match}%</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={() => deleteHistoryItem(item.id)} style={{ paddingLeft: 10 }}>
                  <Trash2 size={18} color="#ef4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}

          {/* PUBLICIDAD RACSO: PRACTICAR */}
          <TouchableOpacity style={styles.racsoCard} onPress={openRacso}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Image source={require('../../assets/images/racso-logo.png')} style={{ width: 22, height: 22, borderRadius: 11 }} />
              <Text style={styles.racsoTitle}>¿Quieres practicar para tu próxima entrevista?</Text>
            </View>
            <Text style={styles.racsoText}>
              Usa Racso para simular entrevistas, mejorar tu CV y aumentar tu % de match. Regístrate con el código{' '}
              <Text style={{ color: '#4F46E5', fontWeight: 'bold' }}>VERITLY</Text> y obtén 7 días premium gratis.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
              <Zap size={16} color="#4F46E5" />
              <Text style={{ color: '#4F46E5', fontWeight: 'bold', fontSize: 13 }}>IR A RACSO</Text>
            </View>
          </TouchableOpacity>
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
  hero: { fontSize: 32, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#4f46e5', padding: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
  companyTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  companyName: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 10 },
  reasonBox: { backgroundColor: 'rgba(0,0,0,0.05)', padding: 15, borderRadius: 10, marginBottom: 20, width: '100%' },
  reasonText: { color: '#334155', fontStyle: 'italic', textAlign: 'center', lineHeight: 20 },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#334155', justifyContent: 'space-between' },
  historyRole: { color: 'white', fontWeight: 'bold', fontSize: 14, flex: 1 },
  historyCompany: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  historyMatch: { fontSize: 18, fontWeight: 'bold', marginRight: 10 },
  emptyBox: { backgroundColor: '#1e293b', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#334155', marginBottom: 10 },
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
  questionsContainer: { width: '100%', marginTop: 20, backgroundColor: 'rgba(255,255,255,0.6)', padding: 15, borderRadius: 16 },
  questionsTitle: { fontSize: 16, fontWeight: 'bold', color: '#4338ca', marginBottom: 15, textAlign: 'center' },

  // RACSO CTA
  racsoCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#4F46E5', marginTop: 10 },
  racsoTitle: { color: 'white', fontWeight: 'bold', fontSize: 14, flex: 1 },
  racsoText: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
});
