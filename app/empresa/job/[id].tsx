import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert,
    FlatList,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

// Lógica
import { auth } from '../../../config/firebase';
import {
    getCandidateHistoryForCompany,
    getJobCandidates,
    saveCandidateAnalysis,
    updateCandidateStatus
} from '../../../services/storage';
import { CandidateAnalysis, MatchStatus, RecruitmentStatus } from '../../../types';
import { analyzeCandidateForCompany, extractTextFromPDF } from '../../../utils/gemini';

// Colores del semáforo
const getStatusColor = (status: MatchStatus) => {
    switch (status) {
        case 'green': return '#4CAF50';
        case 'yellow': return '#FFC107';
        case 'red': return '#F44336';
        default: return '#ccc';
    }
};

const STATUS_OPTIONS: RecruitmentStatus[] = ['screening', 'interview', 'offer', 'hired', 'rejected'];

export default function JobDetailScreen() {
    const { id, title, description } = useLocalSearchParams(); // Recibimos datos de la vacante
    const router = useRouter();

    const [candidates, setCandidates] = useState<CandidateAnalysis[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Estado para el Modal
    const [selectedCandidate, setSelectedCandidate] = useState<CandidateAnalysis | null>(null);
    const [candidateHistory, setCandidateHistory] = useState<CandidateAnalysis[]>([]);

    // 1. Cargar candidatos existentes al entrar
    useEffect(() => {
        loadCandidates();
    }, [id]);

    const loadCandidates = async () => {
        setLoading(true);
        const data = await getJobCandidates(id as string);
        setCandidates(data);
        setLoading(false);
    };

    // 2. Subir y Procesar CVs
    const handlePickDocuments = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                multiple: true,
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            // Limitar a 10 archivos por lote
            const filesToProcess = result.assets.slice(0, 10);
            setProcessing(true);

            let processedCount = 0;

            // Procesamos uno por uno para no saturar la API
            for (const file of filesToProcess) {
                try {
                    // A. Extraer Texto
                    const text = await extractTextFromPDF(file.uri);

                    // B. Analizar con IA (Comparar con description)
                    // Nota: description puede venir como string o array, aseguramos string
                    const descString = Array.isArray(description) ? description[0] : description;
                    const aiResult = await analyzeCandidateForCompany(text, descString || "");

                    if (aiResult) {
                        // C. Crear Objeto
                        const newCandidate: CandidateAnalysis = {
                            id: Math.random().toString(36).substring(7), // ID temporal único
                            jobId: id as string,
                            name: aiResult.name || "Candidato Desconocido",
                            email: aiResult.email || null,
                            phoneNumber: aiResult.phoneNumber,
                            matchScore: aiResult.score,
                            matchStatus: aiResult.score >= 80 ? 'green' : aiResult.score >= 50 ? 'yellow' : 'red',
                            summary: aiResult.summary,
                            pros: aiResult.pros || [],
                            cons: aiResult.cons || [],
                            recruitmentStatus: 'new',
                            analyzedAt: new Date().toISOString(),
                            originalJobTitle: Array.isArray(title) ? title[0] : title // Para historial
                        };

                        // D. Guardar en Firestore
                        await saveCandidateAnalysis(id as string, newCandidate);
                        processedCount++;
                    }
                } catch (e) {
                    console.error(`Error procesando ${file.name}:`, e);
                }
            }

            Alert.alert("Proceso Terminado", `${processedCount} CVs analizados correctamente.`);
            loadCandidates(); // Recargar lista
        } catch (error) {
            Alert.alert("Error", "Ocurrió un error al seleccionar archivos.");
        } finally {
            setProcessing(false);
        }
    };

    // 3. Lógica del Modal (Historial y Estatus)
    const openCandidateModal = async (candidate: CandidateAnalysis) => {
        setSelectedCandidate(candidate);
        setCandidateHistory([]); // Limpiar previo

        // Buscar historial si tiene email
        if (candidate.email && auth.currentUser) {
            const history = await getCandidateHistoryForCompany(auth.currentUser.uid, candidate.email, id as string);
            setCandidateHistory(history);
        }
    };

    const handleStatusChange = async (newStatus: RecruitmentStatus) => {
        if (!selectedCandidate) return;

        // Actualizar local visualmente
        setSelectedCandidate({ ...selectedCandidate, recruitmentStatus: newStatus });

        // Actualizar en BD
        await updateCandidateStatus(id as string, selectedCandidate.id, newStatus);

        // Actualizar lista de fondo
        setCandidates(prev => prev.map(c => c.id === selectedCandidate.id ? { ...c, recruitmentStatus: newStatus } : c));
    };

    const openWhatsApp = (phone?: string) => {
        if (!phone) return Alert.alert("Sin teléfono", "La IA no detectó un número en el CV.");
        const cleanPhone = phone.replace(/[^\d]/g, '');
        Linking.openURL(`https://wa.me/${cleanPhone}`);
    };

    // --- RENDER ---
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
            </View>

            {/* Botón de Acción Principal */}
            <TouchableOpacity
                style={[styles.uploadBtn, processing && styles.btnDisabled]}
                onPress={handlePickDocuments}
                disabled={processing}
            >
                {processing ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator color="white" style={{ marginRight: 10 }} />
                        <Text style={styles.uploadText}>Analizando con IA...</Text>
                    </View>
                ) : (
                    <Text style={styles.uploadText}>+ Subir Carpeta de CVs (PDF)</Text>
                )}
            </TouchableOpacity>

            {/* Lista de Candidatos */}
            <FlatList
                data={candidates}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: 50 }}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.card, { borderLeftColor: getStatusColor(item.matchStatus), borderLeftWidth: 6 }]}
                        onPress={() => openCandidateModal(item)}
                    >
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.name}>{item.name}</Text>
                                <Text style={styles.subText}>
                                    Match: <Text style={{ fontWeight: 'bold', color: getStatusColor(item.matchStatus) }}>{item.matchScore}%</Text>
                                    {' • '}{new Date(item.analyzedAt).toLocaleDateString()}
                                </Text>
                            </View>
                            <View style={styles.statusBadge}>
                                <Text style={styles.statusBadgeText}>{item.recruitmentStatus.toUpperCase()}</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={!loading && <Text style={styles.emptyText}>No hay candidatos analizados aún.</Text>}
            />

            {/* MODAL DE DETALLE */}
            <Modal visible={!!selectedCandidate} animationType="slide" presentationStyle="pageSheet">
                {selectedCandidate && (
                    <ScrollView style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{selectedCandidate.name}</Text>
                            <TouchableOpacity onPress={() => setSelectedCandidate(null)}>
                                <Ionicons name="close-circle" size={30} color="#ccc" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.matchScoreBig}><Text style={{ color: getStatusColor(selectedCandidate.matchStatus) }}>{selectedCandidate.matchScore}%</Text> Coincidencia</Text>
                        {selectedCandidate.email && <Text style={styles.email}>{selectedCandidate.email}</Text>}

                        {/* Botones de Estatus */}
                        <Text style={styles.sectionTitle}>Estatus del Proceso:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusScroll}>
                            {STATUS_OPTIONS.map(status => (
                                <TouchableOpacity
                                    key={status}
                                    style={[
                                        styles.statusBtn,
                                        selectedCandidate.recruitmentStatus === status && styles.statusBtnActive
                                    ]}
                                    onPress={() => handleStatusChange(status)}
                                >
                                    <Text style={[styles.statusText, selectedCandidate.recruitmentStatus === status && { color: 'white' }]}>
                                        {status.toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Historial */}
                        <Text style={styles.sectionTitle}>Historial en la Empresa:</Text>
                        <View style={styles.historyBox}>
                            {candidateHistory.length > 0 ? (
                                candidateHistory.map((h, i) => (
                                    <View key={i} style={styles.historyRow}>
                                        <Text style={{ fontWeight: 'bold' }}>{h.originalJobTitle || 'Otro puesto'}</Text>
                                        <Text style={{ color: getStatusColor(h.matchStatus) }}>{h.matchScore}% ({h.recruitmentStatus})</Text>
                                    </View>
                                ))
                            ) : (
                                <Text style={{ color: '#999', fontStyle: 'italic' }}>No hay postulaciones previas registradas.</Text>
                            )}
                        </View>

                        {/* Resumen IA */}
                        <View style={styles.aiBox}>
                            <Text style={styles.sectionTitle}>🧠 Análisis de IA:</Text>
                            <Text style={styles.bodyText}>{selectedCandidate.summary}</Text>

                            <Text style={[styles.sectionTitle, { marginTop: 15 }]}>✅ Puntos Fuertes:</Text>
                            {selectedCandidate.pros.map((p, i) => <Text key={i} style={styles.bullet}>• {p}</Text>)}

                            <Text style={[styles.sectionTitle, { marginTop: 15 }]}>⚠️ A Considerar:</Text>
                            {selectedCandidate.cons.map((c, i) => <Text key={i} style={styles.bullet}>• {c}</Text>)}
                        </View>

                        {/* Acciones Finales */}
                        <TouchableOpacity
                            style={styles.whatsappBtn}
                            onPress={() => openWhatsApp(selectedCandidate.phoneNumber)}
                        >
                            <Ionicons name="logo-whatsapp" size={24} color="white" />
                            <Text style={styles.whatsappText}> Contactar por WhatsApp</Text>
                        </TouchableOpacity>

                        <View style={{ height: 50 }} />
                    </ScrollView>
                )}
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F4F6F8', padding: 20 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 40 },
    title: { fontSize: 22, fontWeight: 'bold', marginLeft: 10, flex: 1, color: '#1A1A1A' },

    uploadBtn: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 20, elevation: 3 },
    btnDisabled: { backgroundColor: '#A0A0A0' },
    uploadText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    card: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 10, elevation: 2, flexDirection: 'row', alignItems: 'center' },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 },
    name: { fontWeight: 'bold', fontSize: 16, color: '#333' },
    subText: { color: '#666', fontSize: 12, marginTop: 4 },
    statusBadge: { backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
    statusBadgeText: { fontSize: 10, color: '#555', fontWeight: 'bold' },
    emptyText: { textAlign: 'center', marginTop: 30, color: '#999' },

    // Modal Styles
    modalContent: { flex: 1, padding: 20, backgroundColor: 'white' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    modalTitle: { fontSize: 24, fontWeight: 'bold', flex: 1 },
    matchScoreBig: { fontSize: 18, color: '#555', marginBottom: 5 },
    email: { color: '#007AFF', marginBottom: 20 },

    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 8, color: '#333' },

    statusScroll: { flexDirection: 'row', marginBottom: 10, height: 50 },
    statusBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#DDD', marginRight: 10, height: 36, justifyContent: 'center' },
    statusBtnActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
    statusText: { fontSize: 12, fontWeight: '600', color: '#666' },

    historyBox: { backgroundColor: '#F9F9F9', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#EEE' },
    historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#EEE' },

    aiBox: { marginTop: 20, backgroundColor: '#F0F7FF', padding: 15, borderRadius: 10 },
    bodyText: { fontSize: 14, lineHeight: 20, color: '#444' },
    bullet: { fontSize: 14, color: '#555', marginLeft: 10, marginBottom: 2 },

    whatsappBtn: { flexDirection: 'row', backgroundColor: '#25D366', padding: 15, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
    whatsappText: { color: 'white', fontWeight: 'bold', fontSize: 16, marginLeft: 10 }
});
