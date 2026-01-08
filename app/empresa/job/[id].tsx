import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { Mail, MessageSquare, Sparkles, Upload, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import CircularProgress from '../../../components/CircularProgress';
import { auth, db } from '../../../config/firebase';
import {
    getCandidateHistoryForCompany,
    getJobCandidates,
    saveCandidateAnalysis,
    updateCandidateStatus
} from '../../../services/storage';
import { CandidateAnalysis, RecruitmentStatus } from '../../../types';
import { extractTextFromDocument } from '../../../utils/gemini';
import { analyzeCandidateForCompany } from '../../../utils/gemini-company';

const STATUS_OPTIONS: RecruitmentStatus[] = ['screening', 'interview', 'offer', 'hired', 'rejected'];

const getStatusColor = (status: RecruitmentStatus) => {
    switch (status) {
        case 'hired': return '#10b981';
        case 'offer': return '#3b82f6';
        case 'interview': return '#f59e0b';
        case 'screening': return '#94a3b8';
        case 'rejected': return '#ef4444';
        default: return '#64748b';
    }
};

export default function JobDetailScreen() {
    const { id, title, description } = useLocalSearchParams();
    const router = useRouter();

    const [candidates, setCandidates] = useState<CandidateAnalysis[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState<CandidateAnalysis | null>(null);
    const [candidateHistory, setCandidateHistory] = useState<CandidateAnalysis[]>([]);
    const [jobDetails, setJobDetails] = useState({
        title: title as string || '',
        description: description as string || ''
    });

    useEffect(() => {
        loadJobAndCandidates();
    }, [id]);

    const loadJobAndCandidates = async () => {
        setLoading(true);
        try {
            if (!jobDetails.description) {
                const jobDoc = await getDoc(doc(db, 'jobs', id as string));
                if (jobDoc.exists()) {
                    const data = jobDoc.data();
                    setJobDetails({
                        title: data.jobTitle || 'Vacante',
                        description: data.optimizedText || data.originalText || ''
                    });
                } else {
                    showAlert("Error", "No se encontró la información del puesto.");
                }
            }

            const data = await getJobCandidates(id as string);
            setCandidates(data);
        } catch (error) {
            console.error(error);
            showAlert("Error", "Falló la carga de datos.");
        } finally {
            setLoading(false);
        }
    };

    const showAlert = (title: string, msg: string) => {
        if (Platform.OS === 'web') {
            window.alert(`${title}: ${msg}`);
        } else {
            Alert.alert(title, msg);
        }
    };

    const handlePickDocuments = async () => {
        setProcessing(true);
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'],
                multiple: true,
                copyToCacheDirectory: true
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                setProcessing(false);
                return;
            }

            const filesToProcess = result.assets.slice(0, 10);
            let processedCount = 0;
            let errors: string[] = [];

            for (const file of filesToProcess) {
                try {
                    let webFile;
                    if (Platform.OS === 'web') {
                        webFile = (file as any).file || (file as any).output;
                    }

                    // Extraer mimeType como string
                    const mimeType = typeof file.mimeType === 'string' ? file.mimeType : 'application/pdf';

                    const text = await extractTextFromDocument(file.uri, mimeType, webFile);

                    if (!text || text.length < 50) {
                        throw new Error("Texto insuficiente extraído");
                    }

                    const aiResult = await analyzeCandidateForCompany(text, jobDetails.description);

                    const newCandidate: CandidateAnalysis = {
                        id: Math.random().toString(36).substring(7),
                        jobId: id as string,
                        name: aiResult.name || "Candidato",
                        email: aiResult.email,
                        phoneNumber: aiResult.phoneNumber,
                        matchScore: aiResult.matchScore,
                        summary: aiResult.summary,
                        pros: aiResult.pros,
                        cons: aiResult.cons,
                        matchStatus: aiResult.matchScore >= 80 ? 'green' : aiResult.matchScore >= 60 ? 'yellow' : 'red',
                        recruitmentStatus: 'screening',
                        analyzedAt: new Date().toISOString(),
                        originalJobTitle: jobDetails.title
                    };

                    await saveCandidateAnalysis(id as string, newCandidate);
                    processedCount++;

                    if (filesToProcess.indexOf(file) < filesToProcess.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }

                } catch (e: any) {
                    errors.push(`${file.name}: ${e.message}`);
                }
            }

            if (processedCount > 0) {
                showAlert("Éxito", `${processedCount} archivos analizados correctamente.`);
                loadJobAndCandidates();
            } else if (errors.length > 0) {
                showAlert("Error", `Errores:\n${errors.join('\n')}`);
            }

        } catch (error: any) {
            showAlert("Error", error.message);
        } finally {
            setProcessing(false);
        }
    };

    const openCandidateModal = async (candidate: CandidateAnalysis) => {
        setSelectedCandidate(candidate);
        setCandidateHistory([]);

        if (candidate.email && auth.currentUser) {
            const history = await getCandidateHistoryForCompany(auth.currentUser.uid, candidate.email, id as string);
            setCandidateHistory(history);
        }
    };

    const handleStatusChange = async (newStatus: RecruitmentStatus) => {
        if (!selectedCandidate) return;

        setSelectedCandidate({ ...selectedCandidate, recruitmentStatus: newStatus });
        await updateCandidateStatus(id as string, selectedCandidate.id, newStatus);
        setCandidates(prev => prev.map(c => c.id === selectedCandidate.id ? { ...c, recruitmentStatus: newStatus } : c));
    };

    const openWhatsApp = (phone?: string) => {
        if (!phone) {
            return showAlert("Sin teléfono", "La IA no detectó un número en el CV.");
        }
        const cleanPhone = phone.replace(/[^\d]/g, '');
        const whatsappUrl = `https://wa.me/${cleanPhone}`;

        if (Platform.OS === 'web') {
            window.open(whatsappUrl, '_blank');
        } else {
            Linking.openURL(whatsappUrl).catch(() =>
                showAlert("Error", "No se pudo abrir WhatsApp")
            );
        }
    };

    const openEmail = (email?: string) => {
        if (!email) {
            return showAlert("Sin email", "No hay email disponible.");
        }
        Linking.openURL(`mailto:${email}`);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Arrow Left size={24} color="white" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>{jobDetails.title || 'Candidatos'}</Text>
                    <Text style={styles.headerSubtitle}>{candidates.length} análisis realizados</Text>
                </View>
            </View>

            {/* Upload Button */}
            <TouchableOpacity
                style={styles.uploadButton}
                onPress={handlePickDocuments}
                disabled={processing}
            >
                <LinearGradient
                    colors={processing ? ['#64748b', '#64748b'] : ['#3b82f6', '#8b5cf6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.uploadGradient}
                >
                    {processing ? (
                        <>
                            <ActivityIndicator color="white" />
                            <Text style={styles.uploadText}>Analizando con IA...</Text>
                        </>
                    ) : (
                        <>
                            <Upload size={20} color="white" />
                            <Text style={styles.uploadText}>Subir CVs (PDF)</Text>
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>

            {/* Candidates List */}
            <FlatList
                data={candidates}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.candidateCard}
                        onPress={() => openCandidateModal(item)}
                    >
                        <View style={styles.cardContent}>
                            {/* Left: Circular Progress */}
                            <View style={styles.progressContainer}>
                                <CircularProgress percentage={item.matchScore} size={80} strokeWidth={6} />
                            </View>

                            {/* Center: Info */}
                            <View style={styles.cardInfo}>
                                <Text style={styles.candidateName}>{item.name}</Text>
                                <Text style={styles.candidateDate}>
                                    {new Date(item.analyzedAt).toLocaleDateString('es-ES', {
                                        day: 'numeric',
                                        month: 'short'
                                    })}
                                </Text>
                                <View style={[styles.statusPill, { backgroundColor: `${getStatusColor(item.recruitmentStatus)}20` }]}>
                                    <Text style={[styles.statusPillText, { color: getStatusColor(item.recruitmentStatus) }]}>
                                        {item.recruitmentStatus.toUpperCase()}
                                    </Text>
                                </View>
                            </View>

                            {/* Right: Quick Actions */}
                            <View style={styles.quickActions}>
                                {item.phoneNumber && (
                                    <TouchableOpacity
                                        style={styles.iconButton}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            openWhatsApp(item.phoneNumber);
                                        }}
                                    >
                                        <MessageSquare size={18} color="#10b981" />
                                    </TouchableOpacity>
                                )}
                                {item.email && (
                                    <TouchableOpacity
                                        style={styles.iconButton}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            openEmail(item.email);
                                        }}
                                    >
                                        <Mail size={18} color="#3b82f6" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyState}>
                            <Upload size={48} color="#64748b" />
                            <Text style={styles.emptyText}>No hay candidatos analizados</Text>
                            <Text style={styles.emptySubtext}>Sube CVs para comenzar el análisis con IA</Text>
                        </View>
                    ) : null
                }
            />

            {/* MODAL */}
            <Modal visible={!!selectedCandidate} animationType="slide" presentationStyle="pageSheet">
                {selectedCandidate && (
                    <View style={styles.modalContainer}>
                        <StatusBar barStyle="light-content" />
                        <ScrollView style={styles.modalContent}>
                            {/* Modal Header */}
                            <View style={styles.modalHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalName}>{selectedCandidate.name}</Text>
                                    {selectedCandidate.email && (
                                        <Text style={styles.modalEmail}>{selectedCandidate.email}</Text>
                                    )}
                                </View>
                                <TouchableOpacity onPress={() => setSelectedCandidate(null)} style={styles.closeButton}>
                                    <X size={28} color="white" />
                                </TouchableOpacity>
                            </View>

                            {/* Match Score Large */}
                            <View style={styles.matchSection}>
                                <CircularProgress percentage={selectedCandidate.matchScore} size={140} strokeWidth={10} />
                                <Text style={styles.matchLabel}>Coincidencia</Text>
                            </View>

                            {/* AI Analysis Card */}
                            <View style={styles.aiCard}>
                                <View style={styles.aiCardHeader}>
                                    <Sparkles size={24} color="#f59e0b" />
                                    <Text style={styles.aiCardTitle}>Análisis IA</Text>
                                </View>
                                <Text style={styles.aiSummary}>{selectedCandidate.summary}</Text>

                                <Text style={styles.subsectionTitle}>✅ Puntos Fuertes</Text>
                                {selectedCandidate.pros.map((p, i) => (
                                    <Text key={i} style={styles.proText}>• {p}</Text>
                                ))}

                                <Text style={[styles.subsectionTitle, { marginTop: 16 }]}>⚠️ A Considerar</Text>
                                {selectedCandidate.cons.map((c, i) => (
                                    <Text key={i} style={styles.conText}>• {c}</Text>
                                ))}
                            </View>

                            {/* Status Buttons */}
                            <Text style={styles.sectionTitle}>Estado del Proceso</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusScroll}>
                                {STATUS_OPTIONS.map(status => (
                                    <TouchableOpacity
                                        key={status}
                                        style={[
                                            styles.statusButton,
                                            selectedCandidate.recruitmentStatus === status && {
                                                backgroundColor: getStatusColor(status)
                                            }
                                        ]}
                                        onPress={() => handleStatusChange(status)}
                                    >
                                        <Text style={[
                                            styles.statusButtonText,
                                            selectedCandidate.recruitmentStatus === status && styles.statusButtonTextActive
                                        ]}>
                                            {status.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {/* History */}
                            {candidateHistory.length > 0 && (
                                <>
                                    <Text style={styles.sectionTitle}>Historial en la Empresa</Text>
                                    <View style={styles.historyContainer}>
                                        {candidateHistory.map((h, i) => (
                                            <View key={i} style={styles.historyItem}>
                                                <Text style={styles.historyTitle}>{h.originalJobTitle || 'Otro puesto'}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <Text style={styles.historyScore}>{h.matchScore}%</Text>
                                                    <View style={[styles.historyStatus, { backgroundColor: `${getStatusColor(h.recruitmentStatus)}20` }]}>
                                                        <Text style={[styles.historyStatusText, { color: getStatusColor(h.recruitmentStatus) }]}>
                                                            {h.recruitmentStatus}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}

                            {/* Contact Actions */}
                            <View style={styles.contactActions}>
                                <TouchableOpacity
                                    style={styles.contactButton}
                                    onPress={() => openWhatsApp(selectedCandidate.phoneNumber)}
                                >
                                    <MessageSquare size={22} color="white" />
                                    <Text style={styles.contactButtonText}>WhatsApp</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.contactButton, { backgroundColor: '#3b82f6' }]}
                                    onPress={() => openEmail(selectedCandidate.email)}
                                >
                                    <Mail size={22} color="white" />
                                    <Text style={styles.contactButtonText}>Email</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </View>
                )}
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 10 : 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b'
    },
    backButton: {
        marginRight: 15,
        padding: 5
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: 'white',
        letterSpacing: -0.5
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 2
    },
    uploadButton: {
        margin: 20,
        marginTop: 15,
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8
    },
    uploadGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 10
    },
    uploadText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '800'
    },
    candidateCard: {
        backgroundColor: 'rgba(30, 41, 59, 0.6)',
        borderRadius: 16,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: 'rgba(100, 116, 139, 0.3)',
        overflow: 'hidden'
    },
    cardContent: {
        flexDirection: 'row',
        padding: 16,
        alignItems: 'center'
    },
    progressContainer: {
        marginRight: 16
    },
    cardInfo: {
        flex: 1
    },
    candidateName: {
        fontSize: 18,
        fontWeight: '800',
        color: '#F8FAFC',
        marginBottom: 4,
        letterSpacing: -0.3
    },
    candidateDate: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 8
    },
    statusPill: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    statusPillText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5
    },
    quickActions: {
        flexDirection: 'row',
        gap: 8
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(100, 116, 139, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(100, 116, 139, 0.3)'
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '700',
        color: 'white',
        marginTop: 16
    },
    emptySubtext: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 8
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#0F172A'
    },
    modalContent: {
        flex: 1
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b'
    },
    modalName: {
        fontSize: 24,
        fontWeight: '900',
        color: 'white'
    },
    modalEmail: {
        fontSize: 14,
        color: '#3b82f6',
        marginTop: 4
    },
    closeButton: {
        padding: 5
    },
    matchSection: {
        alignItems: 'center',
        paddingVertical: 30
    },
    matchLabel: {
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '600',
        marginTop: 12,
        letterSpacing: 2,
        textTransform: 'uppercase'
    },
    aiCard: {
        margin: 20,
        marginTop: 10,
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 2,
        borderColor: 'rgba(251, 191, 36, 0.3)'
    },
    aiCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16
    },
    aiCardTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#f59e0b'
    },
    aiSummary: {
        fontSize: 15,
        color: '#cbd5e1',
        lineHeight: 24,
        marginBottom: 16
    },
    subsectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#94a3b8',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    proText: {
        fontSize: 14,
        color: '#10b981',
        marginBottom: 4,
        lineHeight: 20
    },
    conText: {
        fontSize: 14,
        color: '#f59e0b',
        marginBottom: 4,
        lineHeight: 20
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: 'white',
        marginHorizontal: 20,
        marginTop: 20,
        marginBottom: 12
    },
    statusScroll: {
        paddingHorizontal: 20,
        marginBottom: 10
    },
    statusButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(100, 116, 139, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(100, 116, 139, 0.3)',
        marginRight: 10
    },
    statusButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94a3b8'
    },
    statusButtonTextActive: {
        color: 'white'
    },
    historyContainer: {
        marginHorizontal: 20,
        marginBottom: 20
    },
    historyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(30, 41, 59, 0.6)',
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(100, 116, 139, 0.2)'
    },
    historyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: 'white'
    },
    historyScore: {
        fontSize: 16,
        fontWeight: '800',
        color: '#38bdf8'
    },
    historyStatus: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    historyStatusText: {
        fontSize: 10,
        fontWeight: '700'
    },
    contactActions: {
        flexDirection: 'row',
        gap: 12,
        margin: 20,
        marginTop: 30
    },
    contactButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#10b981',
        padding: 16,
        borderRadius: 12,
        gap: 10,
        elevation: 5,
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8
    },
    contactButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '800'
    }
});
