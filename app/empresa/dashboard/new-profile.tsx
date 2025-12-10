import { DrawerActions } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useRouter } from 'expo-router';
import { ArrowRight, Briefcase, Copy, Menu, Phone, Upload, Users, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { analyzeCVMatchBatch, analyzeJobProfile } from '../../../utils/gemini';

export default function NewProfileScreen() {
    const router = useRouter();
    const navigation = useNavigation();

    // --- ESTADOS ---
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [loading, setLoading] = useState(false);
    const [processingStatus, setProcessingStatus] = useState("");

    // Data del Puesto
    const [jobFile, setJobFile] = useState<any>(null);
    const [jobData, setJobData] = useState<any>(null); // JSON estructurado de la IA

    // Data de Candidatos
    const [candidates, setCandidates] = useState<any[]>([]);
    const [selectedCandidate, setSelectedCandidate] = useState<any>(null); // Para el modal de detalle

    // --- FUNCIONES ---

    // 1. SUBIR PERFIL DE PUESTO
    // --- HELPER ALERT ---
    const showAlert = (title: string, msg: string) => {
        if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
        else Alert.alert(title, msg);
    };

    // 1. SUBIR PERFIL DE PUESTO
    const handlePickDocument = async () => {
        try {
            console.log("Abriendo Document Picker...");
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            const file = result.assets ? result.assets[0] : null;
            if (!file) return showAlert("Error", "No se pudo obtener el archivo.");

            console.log("Archivo seleccionado:", file.uri, file.name);
            setJobFile(file);
            processJobProfile(file);

        } catch (error) {
            console.error("Upload Error:", error);
            showAlert("Error", "No se pudo cargar el archivo.");
        }
    };

    // 2. PROCESAR CON GEMINI
    const processJobProfile = async (file: any) => {
        setLoading(true);
        setProcessingStatus("Leyendo archivo y analizando...");
        try {
            console.log("Procesando:", file.name);
            const webFile = Platform.OS === 'web' ? file.file : undefined;

            const analysis = await analyzeJobProfile(file.uri, webFile, file.mimeType);

            console.log("Análisis OK:", analysis);
            setJobData(analysis);
            setStep(2);
            showAlert("¡Éxito!", "Perfil analizado correctamente.");

        } catch (error: any) {
            console.error("Gemini Error:", error);
            showAlert("Error IA", "No pudimos analizar el perfil.\n" + (error.message || "Intenta de nuevo."));
        } finally {
            setLoading(false);
            setProcessingStatus("");
        }
    };

    // 3. SUBIR Y PROCESAR CVS
    const handlePickCVs = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true, multiple: true });
            if (result.canceled) return;
            const files = result.assets || [];
            if (files.length === 0) return;
            if (files.length > 10) return showAlert("Límite excedido", "Máximo 10 CVs.");

            processCVBatch(files);
        } catch (error) { showAlert("Error", "Error seleccionando archivos."); }
    };

    const processCVBatch = async (files: any[]) => {
        setLoading(true);
        setProcessingStatus(`Analizando ${files.length} Candidatos con IA...`);
        try {
            const context = `
                TÍTULO: ${jobData.jobTitle}
                RESUMEN: ${jobData.summary}
                RESPONSABILIDADES: ${jobData.structuredData?.responsibilities?.join(". ")}
                REQUISITOS: ${jobData.structuredData?.requirements?.join(". ")}
            `;

            const fileObjs = files.map(f => ({ uri: f.uri, webFile: f, name: f.name, mimeType: f.mimeType }));

            const results = await analyzeCVMatchBatch(fileObjs, context);
            setCandidates(results);

        } catch (error: any) {
            Alert.alert("Error IA", "Hubo un problema analizando los CVs.\n" + error.message);
        } finally {
            setLoading(false);
            setProcessingStatus("");
        }
    };

    // Copiar
    const copyToClipboard = async () => {
        if (!jobData?.jobPostContent) return;
        await Clipboard.setStringAsync(jobData.jobPostContent);
        Alert.alert("¡Copiado!", "El perfil está listo para compartir.");
    };

    // WhatsApp
    const openWhatsApp = (phone: string) => {
        if (!phone) return Alert.alert("Sin número", "No se detectó teléfono en el CV.");
        const cleanPhone = phone.replace(/[^\d+]/g, '');
        const url = `whatsapp://send?phone=${cleanPhone}&text=Hola, te contactamos por tu perfil para: ${jobData.jobTitle}`;

        Linking.canOpenURL(url).then(supported => {
            if (supported) Linking.openURL(url);
            else Alert.alert("Error", "WhatsApp no está instalado.");
        });
    };

    // --- RENDERIZADO ---

    // MERGED STEP 1 & 2: UPLOAD & REVIEW
    const renderUploadAndReview = () => (
        <ScrollView style={styles.scrollContainer}>
            <View style={styles.stepContainer}>
                <View style={styles.heroIcon}><Briefcase size={40} color="#38bdf8" /></View>
                <Text style={styles.title}>Nuevo Puesto</Text>
                <Text style={styles.subtitle}>Sube el PDF/Word para que la IA lo analice.</Text>

                <TouchableOpacity style={styles.uploadBox} onPress={handlePickDocument} disabled={loading}>
                    {loading ? (
                        <View style={{ alignItems: 'center' }}>
                            <ActivityIndicator size="large" color="#3b82f6" />
                            <Text style={{ color: '#94a3b8', marginTop: 10, textAlign: 'center' }}>{processingStatus}</Text>
                        </View>
                    ) : (
                        <>
                            <Upload size={40} color="#94a3b8" />
                            <Text style={styles.uploadText}>Subir Archivo</Text>
                            <Text style={styles.uploadSubtext}>Analizar con IA (PDF, DOCX)</Text>
                        </>
                    )}
                </TouchableOpacity>


            </View>

            {jobData && (
                <View style={[styles.card, { marginTop: 20 }]}>
                    <View style={[styles.rowBetween, { marginBottom: 10 }]}>
                        <Text style={styles.cardHeader}>✨ Descripción Generada por IA</Text>
                        <TouchableOpacity onPress={copyToClipboard} style={styles.iconButton}>
                            <Copy size={18} color="#38bdf8" />
                            <Text style={styles.iconButtonText}>Copiar</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>Título Detectado:</Text>
                    <TextInput
                        style={styles.inputField}
                        value={jobData.jobTitle}
                        onChangeText={(t) => setJobData({ ...jobData, jobTitle: t })}
                        placeholder="Título del Puesto"
                        placeholderTextColor="#64748b"
                    />

                    <Text style={[styles.label, { marginTop: 15 }]}>Contenido del Post:</Text>
                    <TextInput
                        multiline
                        style={styles.textArea}
                        value={jobData.jobPostContent}
                        onChangeText={(t) => setJobData({ ...jobData, jobPostContent: t })}
                        placeholder="Aquí aparecerá la descripción generada..."
                        placeholderTextColor="#64748b"
                    />

                    <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(3)}>
                        <Text style={styles.primaryButtonText}>Buscar Candidatos (Match)</Text>
                        <ArrowRight size={20} color="white" />
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );

    // STEP 3: CANDIDATES
    const renderCandidateCard = ({ item, index }: any) => (
        <TouchableOpacity style={styles.candidateCard} onPress={() => setSelectedCandidate(item)}>
            <View style={styles.rankCircle}>
                <Text style={styles.rankNumber}>#{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.candidateName}>{item.candidateName}</Text>
                <Text style={styles.candidateSummary} numberOfLines={2}>{item.summary}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
                <Text style={{ color: item.matchPercentage > 80 ? '#4ade80' : '#facc15', fontWeight: 'bold', fontSize: 18 }}>
                    {item.matchPercentage}%
                </Text>
                <Text style={{ color: '#64748b', fontSize: 10 }}>MATCH</Text>
            </View>
        </TouchableOpacity>
    );

    const renderStep3 = () => (
        <View style={{ flex: 1 }}>
            <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Ranking de Candidatos</Text>
                <TouchableOpacity onPress={() => setStep(2)}><Text style={{ color: '#38bdf8' }}>Ver Puesto</Text></TouchableOpacity>
            </View>
            <Text style={{ color: '#94a3b8', marginBottom: 15 }}>Para: {jobData?.jobTitle}</Text>

            {candidates.length === 0 ? (
                <View style={styles.placeholderBox}>
                    <Users size={40} color="#64748b" style={{ marginBottom: 15 }} />
                    <Text style={{ color: '#94a3b8', textAlign: 'center', marginBottom: 20 }}>
                        Sube una carpeta de CVs (PDFs) para encontrar los mejores perfiles.
                    </Text>
                    <TouchableOpacity style={styles.smallButton} onPress={handlePickCVs} disabled={loading}>
                        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.smallButtonText}>+ Subir Candidatos</Text>}
                    </TouchableOpacity>
                    {loading && <Text style={{ color: '#94a3b8', marginTop: 10 }}>{processingStatus}</Text>}
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <TouchableOpacity style={[styles.smallButton, { marginBottom: 15, alignSelf: 'flex-start' }]} onPress={handlePickCVs} disabled={loading}>
                        <Text style={styles.smallButtonText}>+ Analizar más</Text>
                    </TouchableOpacity>
                    {loading && <Text style={{ color: '#94a3b8', marginBottom: 10 }}>{processingStatus}</Text>}
                    <FlatList
                        data={candidates}
                        keyExtractor={(item) => item.fileName || Math.random().toString()}
                        renderItem={renderCandidateCard}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                </View>
            )}
        </View>
    );

    // MODAL
    const renderCandidateModal = () => (
        <Modal visible={!!selectedCandidate} animationType="slide" transparent={true} onRequestClose={() => setSelectedCandidate(null)}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.modalTitle}>Análisis de Match</Text>
                        <TouchableOpacity onPress={() => setSelectedCandidate(null)}><X size={24} color="#94a3b8" /></TouchableOpacity>
                    </View>

                    <ScrollView style={{ marginTop: 20 }}>
                        <View style={{ alignItems: 'center', marginBottom: 20 }}>
                            <View style={styles.bigScoreCircle}>
                                <Text style={styles.bigScoreText}>{selectedCandidate?.matchPercentage}%</Text>
                                <Text style={{ color: '#94a3b8', fontSize: 12 }}>MATCH</Text>
                            </View>
                            <Text style={styles.bigName}>{selectedCandidate?.candidateName}</Text>
                        </View>

                        <Text style={styles.modalLabel}>ANÁLISIS DE IA:</Text>
                        <Text style={styles.modalText}>{selectedCandidate?.reason}</Text>

                        <Text style={[styles.modalLabel, { marginTop: 15 }]}>PUNTOS FUERTES:</Text>
                        {selectedCandidate?.pros?.map((pro: string, i: number) => (
                            <Text key={i} style={styles.proText}>✅ {pro}</Text>
                        ))}

                        <Text style={[styles.modalLabel, { marginTop: 15 }]}>A CONSIDERAR:</Text>
                        {selectedCandidate?.cons?.map((con: string, i: number) => (
                            <Text key={i} style={styles.conText}>⚠️ {con}</Text>
                        ))}

                        <Text style={[styles.modalLabel, { marginTop: 15 }]}>CONTACTO:</Text>
                        <Text style={styles.modalText}>📧 {selectedCandidate?.contact?.email || "No detectado"}</Text>
                        <Text style={styles.modalText}>📱 {selectedCandidate?.contact?.phone || "No detectado"}</Text>
                    </ScrollView>

                    <View style={{ marginTop: 20 }}>
                        <TouchableOpacity style={styles.whatsappButton} onPress={() => openWhatsApp(selectedCandidate?.contact?.phone)}>
                            <Phone size={20} color="white" />
                            <Text style={styles.whatsappText}>Contactar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={{ marginRight: 15 }}>
                    <Menu size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Veritly - Análisis</Text>
            </View>

            <View style={styles.content}>
                {(step === 1 || step === 2) && renderUploadAndReview()}
                {step === 3 && renderStep3()}
            </View>

            {renderCandidateModal()}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { padding: 20, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#1e293b', alignItems: 'center', flexDirection: 'row' },
    headerTitle: { color: 'white', fontWeight: 'bold', fontSize: 18, letterSpacing: 1 },
    content: { flex: 1, padding: 20 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    stepContainer: { alignItems: 'center', marginBottom: 20 },
    heroIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(56, 189, 248, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 20, paddingHorizontal: 20 },
    uploadBox: { width: '100%', height: 180, borderWidth: 2, borderColor: '#334155', borderStyle: 'dashed', borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b' },
    uploadText: { color: 'white', fontWeight: 'bold', marginTop: 15, fontSize: 16 },
    uploadSubtext: { color: '#64748b', fontSize: 12, marginTop: 5 },

    scrollContainer: { flex: 1 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: 'white', marginBottom: 15 },
    card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
    label: { color: '#64748b', fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold' },
    value: { color: 'white', fontSize: 16, marginTop: 5 },
    cardHeader: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    iconButton: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 5, backgroundColor: 'rgba(56, 189, 248, 0.1)', borderRadius: 8 },
    iconButtonText: { color: '#38bdf8', fontWeight: 'bold', fontSize: 12 },
    textArea: { color: '#cbd5e1', fontSize: 14, lineHeight: 22, textAlignVertical: 'top', marginTop: 10, minHeight: 150, padding: 10, backgroundColor: '#0f172a', borderRadius: 10 },
    inputField: { color: 'white', fontSize: 16, marginTop: 5, backgroundColor: '#0f172a', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
    primaryButton: { backgroundColor: '#3b82f6', flexDirection: 'row', height: 55, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', marginTop: 20 },
    primaryButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    placeholderBox: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', borderRadius: 16, padding: 20 },
    smallButton: { backgroundColor: '#3b82f6', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
    smallButtonText: { color: 'white', fontWeight: 'bold' },
    candidateCard: { flexDirection: 'row', backgroundColor: '#1e293b', padding: 15, borderRadius: 12, marginBottom: 10, alignItems: 'center', gap: 15, borderWidth: 1, borderColor: '#334155' },
    rankCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
    rankNumber: { color: 'white', fontWeight: 'bold' },
    candidateName: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    candidateSummary: { color: '#94a3b8', fontSize: 12, marginTop: 2 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.9)', justifyContent: 'flex-end' },
    modalContent: { height: '85%', backgroundColor: '#1e293b', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },
    modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
    modalLabel: { color: '#64748b', fontSize: 12, fontWeight: 'bold', marginTop: 10 },
    modalText: { color: '#cbd5e1', fontSize: 14, marginTop: 5, lineHeight: 20 },
    bigScoreCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#3b82f6', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    bigScoreText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
    bigName: { color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 5 },
    proText: { color: '#4ade80', marginTop: 2, fontSize: 14 },
    conText: { color: '#facc15', marginTop: 2, fontSize: 14 },
    whatsappButton: { backgroundColor: '#22c55e', flexDirection: 'row', height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10 },
    whatsappText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
