import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, writeBatch, collection } from 'firebase/firestore';
import { 
    ArrowLeft, Mail, MessageSquare, Sparkles, Upload, X, FileText, Table, 
    Download, Info, LayoutTemplate, List, CheckCircle2, Trash2, 
    ChevronRight, MoreVertical, CheckSquare, Square, UserX, Clock
} from 'lucide-react-native';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import * as XLSX from 'xlsx';

import CircularProgress from '../../../components/CircularProgress';
import { auth, db, storage } from '../../../config/firebase';
import {
    getCandidateHistoryForCompany,
    getJobCandidates,
    saveCandidateAnalysis,
    updateCandidateStatus
} from '../../../services/storage';
import { CandidateAnalysis, RecruitmentStatus } from '../../../types';
import { extractTextFromDocument } from '../../../utils/gemini';
import { analyzeCandidateForCompany, analyzeExcelRowForCompany } from '../../../utils/gemini-company';

const STATUS_OPTIONS: RecruitmentStatus[] = ['new', 'pending_ai', 'screening', 'interview', 'offer', 'hired', 'rejected', 'rejected_salary'];

const STATUS_LABELS: Record<string, string> = {
    new: 'NUEVO',
    pending_ai: 'PENDIENTE IA',
    screening: 'SCREENING',
    interview: 'ENTREVISTA',
    offer: 'OFERTA',
    hired: 'CONTRATADO',
    rejected: 'DESCARTADO',
    rejected_salary: 'DESC. SALARIAL',
    stored: 'ARCHIVADO',
};

const getStatusColor = (status: RecruitmentStatus) => {
    switch (status) {
        case 'hired': return '#10b981';
        case 'offer': return '#3b82f6';
        case 'interview': return '#f59e0b';
        case 'screening': return '#94a3b8';
        case 'rejected': return '#ef4444';
        case 'rejected_salary': return '#f97316';
        case 'pending_ai': return '#8b5cf6';
        case 'new': return '#38bdf8';
        default: return '#64748b';
    }
};

export default function JobDetailScreen() {
    const { id, title, description } = useLocalSearchParams();
    const router = useRouter();

    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
    const [activeTab, setActiveTab] = useState<'ranking' | 'pipeline'>('ranking');
    const [candidates, setCandidates] = useState<CandidateAnalysis[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState('');
    const [selectedCVs, setSelectedCVs] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
    const [selectedCandidate, setSelectedCandidate] = useState<CandidateAnalysis | null>(null);
    const [candidateHistory, setCandidateHistory] = useState<CandidateAnalysis[]>([]);
    const [showExcelModal, setShowExcelModal] = useState(false);
    const [excelKeywords, setExcelKeywords] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [jobDetails, setJobDetails] = useState({
        title: title as string || '',
        description: description as string || '',
        companyId: ''
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
                        description: data.optimizedText || data.originalText || '',
                        companyId: data.companyId || ''
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

    const showAlert = (title: string, message: string) => {
        if (Platform.OS === 'web') {
            alert(`${title}: ${message}`);
        } else {
            Alert.alert(title, message);
        }
    };

    const handleSelectCVs = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'],
                multiple: true,
                copyToCacheDirectory: true
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                return;
            }

            setSelectedCVs(result.assets);
        } catch (error) {
            console.error("Error seleccionando CVs", error);
        }
    };

    const handleAnalyzeCVs = async () => {
        if (selectedCVs.length === 0) return;
        setProcessing(true);
        try {
            const filesToProcess = selectedCVs.slice(0, 10);
            let processedCount = 0;
            let errors: string[] = [];

            for (let i = 0; i < filesToProcess.length; i++) {
                const file = filesToProcess[i];
                setProcessingStatus(`Analizando CV ${i + 1} de ${filesToProcess.length}...`);
                try {
                    let webFile;
                    if (Platform.OS === 'web') {
                        webFile = (file as any).file || (file as any).output;
                    }

                    const mimeType = typeof file.mimeType === 'string' ? file.mimeType : 'application/pdf';
                    const text = await extractTextFromDocument(file.uri, mimeType, webFile);

                    if (!text || text.length < 50) {
                        throw new Error("Texto insuficiente extraído");
                    }

                    let uploadedUrl = null;
                    const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
                    const fileRef = ref(storage, `cvs_realease/${jobDetails.companyId || 'anon'}/${id}/${Date.now()}_${safeFileName}`);
                    
                    try {
                        let blob;
                        if (Platform.OS === 'web' && webFile) {
                            blob = webFile;
                        } else {
                            const resp = await fetch(file.uri);
                            blob = await resp.blob();
                        }
                        await uploadBytes(fileRef, blob);
                        uploadedUrl = await getDownloadURL(fileRef);
                    } catch (uploadErr) {
                        console.error("Storage error:", uploadErr);
                    }                    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
                    const foundEmail = text.match(emailRegex)?.[0]?.toLowerCase();
                    
                    let aiResult;
                    let existingDNASummary = '';
                    
                    if (foundEmail) {
                        setProcessingStatus(`Buscando perfil previo de ${foundEmail}...`);
                        const { query, collection, where, getDocs } = await import('firebase/firestore');
                        const q = query(collection(db, 'users_candidatos'), where('email', '==', foundEmail));
                        const qSnap = await getDocs(q);
                        if (!qSnap.empty) {
                            const gd = qSnap.docs[0].data();
                            if (gd.profileDnaSummary) {
                                existingDNASummary = gd.profileDnaSummary;
                                setProcessingStatus(`Perfil de ADN encontrado. Optimizando análisis...`);
                            }
                        }
                    }

                    // Perform analysis (using existing DNA if available to save tokens)
                    aiResult = await analyzeCandidateForCompany(
                        existingDNASummary || text, 
                        jobDetails.description
                    );

                    const newCandidate: CandidateAnalysis = {
                        id: Math.random().toString(36).substring(7),
                        jobId: id as string,
                        name: aiResult.name || file.name.split('.')[0] || "Candidato",
                        email: aiResult.email || foundEmail || null,
                        phoneNumber: aiResult.phoneNumber,
                        matchScore: aiResult.matchScore,
                        summary: aiResult.summary,
                        profileDnaSummary: aiResult.profileDnaSummary || existingDNASummary,
                        standardizedSkills: aiResult.standardizedSkills,
                        compensationLogic: aiResult.compensationLogic,
                        pros: aiResult.pros,
                        cons: aiResult.cons,
                        matchStatus: aiResult.matchScore >= 80 ? 'green' : aiResult.matchScore >= 60 ? 'yellow' : 'red',
                        recruitmentStatus: 'new',
                        analyzedAt: new Date().toISOString(),
                        originalJobTitle: jobDetails.title,
                        originalFileUrl: uploadedUrl || undefined
                    };

                    // Update Global Talent Graph Profile
                    if (newCandidate.email) {
                        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
                        const candidateRef = doc(db, 'users_candidatos', newCandidate.email); // Usamos email como ID para búsqueda rápida en el marketplace
                        await setDoc(candidateRef, {
                            email: newCandidate.email,
                            name: newCandidate.name,
                            phoneNumber: newCandidate.phoneNumber,
                            profileDnaSummary: newCandidate.profileDnaSummary,
                            standardizedSkills: newCandidate.standardizedSkills,
                            compensationLogic: newCandidate.compensationLogic,
                            lastSeenAt: serverTimestamp(),
                            reliabilityIndex: aiResult.matchScore, // Primer score como base
                            source: 'veritly_ats'
                        }, { merge: true });
                    }

                    await saveCandidateAnalysis(id as string, newCandidate);
                    processedCount++;

                    if (i < filesToProcess.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (e: any) {
                    errors.push(`${file.name}: ${e.message}`);
                }
            }

            if (processedCount > 0) {
                showAlert("Análisis Completado", `${processedCount} candidatos analizados correctamente y añadidos al Ranking.`);
                setSelectedCVs([]);
                await loadJobAndCandidates();
            } else if (errors.length > 0) {
                showAlert("Errores en el proceso", `No se pudo analizar ningun archivo:\n${errors.join('\n')}`);
            }
        } catch (error: any) {
            showAlert("Error fatal", error.message);
        } finally {
            setProcessing(false);
            setProcessingStatus('');
        }
    };


    const downloadTemplate = async () => {
        const ws = XLSX.utils.json_to_sheet([
            { Nombre: 'Juan Pérez', Email: 'juan@email.com', Telefono: '987654321', Experiencia: '5 años como Analista de Datos, dominio de Python, SQL y Tableau.', Habilidades: 'Python, SQL, AWS, Liderazgo, Inglés Avanzado' }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Candidatos");

        if (Platform.OS === 'web') {
            XLSX.writeFile(wb, "Plantilla_Candidatos_Veritly.xlsx");
        } else {
            showAlert("Descarga no disponible", "La descarga de plantilla funciona desde un navegador PC.");
        }
    };

    const handlePickExcel = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'],
                copyToCacheDirectory: true
            });

            if (result.canceled || !result.assets || result.assets.length === 0) return;

            setProcessing(true);
            setShowExcelModal(false);

            const fileUri = result.assets[0].uri;
            let arrayBuffer: ArrayBuffer;

            if (Platform.OS === 'web') {
                const webFile = (result.assets[0] as any).file || (result.assets[0] as any).output;
                arrayBuffer = await (webFile instanceof Blob ? webFile.arrayBuffer() : fetch(fileUri).then(r => r.arrayBuffer()));
            } else {
                const response = await fetch(fileUri);
                arrayBuffer = await response.arrayBuffer();
            }

            const wb = XLSX.read(arrayBuffer, { type: 'buffer' });
            const wsName = wb.SheetNames[0];
            const ws = wb.Sheets[wsName];
            const jsonData = XLSX.utils.sheet_to_json(ws);

            if (jsonData.length === 0) {
                setProcessing(false);
                return showAlert("Error", "El archivo Excel está vacío.");
            }

            let processedCount = 0;
            let errors: string[] = [];
            const rowsToProcess = jsonData.slice(0, 50);

            for (const row of rowsToProcess) {
                try {
                    const rowDataString = JSON.stringify(row);
                    const aiResult = await analyzeExcelRowForCompany(rowDataString, jobDetails.description, excelKeywords);

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
                        keywordsValidation: aiResult.keywordsValidation,
                        matchStatus: aiResult.matchScore >= 80 ? 'green' : aiResult.matchScore >= 60 ? 'yellow' : 'red',
                        recruitmentStatus: 'screening',
                        analyzedAt: new Date().toISOString(),
                        originalJobTitle: jobDetails.title
                    };

                    await saveCandidateAnalysis(id as string, newCandidate);
                    processedCount++;

                    if (rowsToProcess.indexOf(row) < rowsToProcess.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } catch (e: any) {
                    errors.push(`Fila error: ${e.message}`);
                }
            }

            if (processedCount > 0) {
                showAlert("Éxito", `${processedCount} candidatos analizados desde Excel correctamente.`);
                loadJobAndCandidates();
            } else if (errors.length > 0) {
                showAlert("Error", `Errores:\n${errors[0]}`);
            }
        } catch (error: any) {
            showAlert("Error", error.message);
        } finally {
            setProcessing(false);
            setExcelKeywords('');
        }
    };

    const toggleSelection = (candidateId: string) => {
        setIsSelectionMode(true);
        setSelectedIds(prev => 
            prev.includes(candidateId) 
                ? prev.filter(cid => cid !== candidateId) 
                : [...prev, candidateId]
        );
    };

    const handleRankToPipeline = async () => {
        if (selectedIds.length === 0) return;
        setLoading(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(cid => {
                const docRef = doc(db, 'jobs', id as string, 'candidates', cid);
                batch.update(docRef, { recruitmentStatus: 'screening' });
            });
            await batch.commit();

            setCandidates(prev => prev.map(c => 
                selectedIds.includes(c.id) ? { ...c, recruitmentStatus: 'screening' } : c
            ));
            setSelectedIds([]);
            setIsSelectionMode(false);
            showAlert("Éxito", `${selectedIds.length} candidatos movidos al Pipeline.`);
        } catch (err) {
            console.error(err);
            showAlert("Error", "No se pudieron mover los candidatos.");
        } finally {
            setLoading(false);
        }
    };

    const handleBulkMove = async (newStatus: RecruitmentStatus) => {
        if (selectedIds.length === 0) return;
        setLoading(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(cid => {
                const docRef = doc(db, 'jobs', id as string, 'candidates', cid);
                batch.update(docRef, { recruitmentStatus: newStatus });
            });
            await batch.commit();

            setCandidates(prev => prev.map(c => 
                selectedIds.includes(c.id) ? { ...c, recruitmentStatus: newStatus } : c
            ));
            setSelectedIds([]);
            if (selectedIds.length <= 1) setIsSelectionMode(false);
            showAlert("Éxito", `${selectedIds.length} candidatos movidos.`);
        } catch (err) {
            console.error(err);
            showAlert("Error", "No se pudieron mover los candidatos.");
        } finally {
            setLoading(false);
        }
    };

    const handleQuickDiscard = async (candidateId: string) => {
        try {
            setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, recruitmentStatus: 'rejected' } : c));
            await updateCandidateStatus(id as string, candidateId, 'rejected');
        } catch (err) {
            console.error(err);
        }
    };

    const openCandidateModal = async (candidate: CandidateAnalysis) => {
        setSelectedCandidate(candidate);
        setCandidateHistory([]);

        if (candidate.email && auth.currentUser) {
            try {
                const history = await getCandidateHistoryForCompany(auth.currentUser.uid, candidate.email, id as string);
                setCandidateHistory(history);
            } catch (err) {
                console.error("Error loading candidate history:", err);
            }
        }
    };

    const handleStatusChange = async (newStatus: RecruitmentStatus) => {
        if (!selectedCandidate) return;
        setSelectedCandidate({ ...selectedCandidate, recruitmentStatus: newStatus });
        await updateCandidateStatus(id as string, selectedCandidate.id, newStatus);
        setCandidates(prev => prev.map(c => c.id === selectedCandidate.id ? { ...c, recruitmentStatus: newStatus } : c));
    };

    const viewCandidateCV = async (cvUrl?: string) => {
        if (!cvUrl) return showAlert("Sin CV", "Este candidato no tiene un currículum adjunto.");
        try {
            if (Platform.OS === 'web') {
                window.open(cvUrl, '_blank');
            } else {
                await Linking.openURL(cvUrl);
            }
        } catch (err) {
            console.error(err);
            showAlert("Error", "No se pudo abrir el currículum.");
        }
    };

    const openEmail = (email?: string) => {
        if (!email) return showAlert("Sin email", "No hay email disponible.");
        Linking.openURL(`mailto:${email}`);
    };

    const openWhatsApp = (phone?: string) => {
        if (!phone) return showAlert("Sin teléfono", "No hay teléfono disponible.");
        const cleanPhone = phone.replace(/\D/g, '');
        const whatsappUrl = `https://wa.me/${cleanPhone}`;
        if (Platform.OS === 'web') {
            window.open(whatsappUrl, '_blank');
        } else {
            Linking.openURL(whatsappUrl);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

            {/* Header */}
            <View style={styles.header}>
                {isSelectionMode ? (
                    <TouchableOpacity 
                        onPress={() => { setIsSelectionMode(false); setSelectedIds([]); }} 
                        style={styles.backButton}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
                        <X size={24} color="white" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity 
                        onPress={() => router.canGoBack() ? router.back() : router.replace('/empresa/dashboard')} 
                        style={styles.backButton}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
                        <ArrowLeft size={24} color="white" />
                    </TouchableOpacity>
                )}
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>
                        {isSelectionMode ? `${selectedIds.length} seleccionados` : (jobDetails.title || 'Candidatos')}
                    </Text>
                    {!isSelectionMode && (
                        <>
                            <Text style={styles.headerSubtitle}>{candidates.length} análisis realizados</Text>
                            <Text style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>* El Score de IA puede variar +/- 5%</Text>
                        </>
                    )}
                </View>
            </View>

            {/* Tabs & View Switching */}
            <View style={styles.tabsContainer}>
                <View style={styles.mainTabs}>
                    <TouchableOpacity 
                        style={[styles.mainTab, activeTab === 'ranking' && styles.mainTabActive]} 
                        onPress={() => setActiveTab('ranking')}
                    >
                        <Sparkles size={20} color={activeTab === 'ranking' ? '#3b82f6' : '#64748b'} />
                        <Text style={[styles.mainTabText, activeTab === 'ranking' && styles.mainTabTextActive]}>Ranking IA</Text>
                        <View style={[styles.countBadge, activeTab === 'ranking' && { backgroundColor: '#3b82f6' }]}>
                            <Text style={styles.countBadgeText}>{candidates.filter(c => c.recruitmentStatus === 'new').length}</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.mainTab, activeTab === 'pipeline' && styles.mainTabActive]} 
                        onPress={() => {
                            setActiveTab('pipeline');
                            if (viewMode === 'list') setViewMode('list');
                        }}
                    >
                        <LayoutTemplate size={20} color={activeTab === 'pipeline' ? '#3b82f6' : '#64748b'} />
                        <Text style={[styles.mainTabText, activeTab === 'pipeline' && styles.mainTabTextActive]}>Pipeline ATS</Text>
                        <View style={[styles.countBadge, activeTab === 'pipeline' && { backgroundColor: '#10b981' }]}>
                            <Text style={styles.countBadgeText}>{candidates.filter(c => c.recruitmentStatus !== 'new').length}</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {activeTab === 'pipeline' && (
                    <View style={styles.viewToggle}>
                        <TouchableOpacity 
                            onPress={() => setViewMode('list')}
                            style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
                        >
                            <List size={20} color={viewMode === 'list' ? 'white' : '#64748b'} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setViewMode('kanban')}
                            style={[styles.viewToggleBtn, viewMode === 'kanban' && styles.viewToggleBtnActive]}
                        >
                            <LayoutTemplate size={20} color={viewMode === 'kanban' ? 'white' : '#64748b'} />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Quick Actions Bar (Ranking Context) */}
            {activeTab === 'ranking' && (
                <View style={styles.rankingActions}>
                    {selectedCVs.length > 0 ? (
                        <View style={{flexDirection: 'row', gap: 10, flex: 1}}>
                            <TouchableOpacity 
                                onPress={handleAnalyzeCVs} 
                                disabled={processing}
                                style={styles.rankingActionBtn}
                            >
                                <LinearGradient
                                    colors={['#8b5cf6', '#7c3aed']}
                                    style={styles.rankingActionGradient}
                                >
                                    <Sparkles size={18} color="white" />
                                    <Text style={styles.rankingActionText}>Analizar {selectedCVs.length} CV{selectedCVs.length > 1 ? 's' : ''} con IA</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.rankingActionBtnSecondary, {flex: 0, paddingHorizontal: 15}]} onPress={() => setSelectedCVs([])}>
                                <X size={20} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <TouchableOpacity 
                                onPress={handleSelectCVs} 
                                disabled={processing}
                                style={styles.rankingActionBtn}
                            >
                                <LinearGradient
                                    colors={['#3b82f6', '#2563eb']}
                                    style={styles.rankingActionGradient}
                                >
                                    <FileText size={18} color="white" />
                                    <Text style={styles.rankingActionText}>Subir CVs (PDF/Word)</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => setShowExcelModal(true)}
                                style={styles.rankingActionBtnSecondary}
                            >
                                <Table size={18} color="#3b82f6" />
                                <Text style={styles.rankingActionTextSecondary}>Subir Excel</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            )}

            {/* View Switching */}
            {activeTab === 'ranking' ? (
                <FlatList
                    data={candidates.filter(c => c.recruitmentStatus === 'new').sort((a, b) => b.matchScore - a.matchScore)}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => {
                        const isSelected = selectedIds.includes(item.id);
                        return (
                            <TouchableOpacity
                                style={[styles.candidateCard, isSelected && styles.candidateCardSelected]}
                                onPress={() => (isSelectionMode ? toggleSelection(item.id) : openCandidateModal(item))}
                                onLongPress={() => toggleSelection(item.id)}
                            >
                                <View style={styles.cardContent}>
                                    {isSelectionMode && (
                                        <View style={{ marginRight: 12 }}>
                                            {isSelected ? <CheckSquare size={20} color="#3b82f6" /> : <Square size={20} color="#64748b" />}
                                        </View>
                                    )}
                                    <View style={styles.progressContainer}>
                                        <CircularProgress percentage={item.matchScore} size={80} strokeWidth={6} />
                                    </View>

                                    <View style={styles.cardInfo}>
                                        <Text style={styles.candidateName}>{item.name}</Text>
                                        <Text style={styles.candidateSalary}>
                                            Sueldo: {item.salaryExpectation ? `S/ ${item.salaryExpectation}` : 'N/A'}
                                        </Text>
                                        <Text style={styles.candidateDate}>
                                            {new Date(item.analyzedAt).toLocaleDateString('es-ES', {
                                                day: 'numeric',
                                                month: 'short'
                                            })}
                                        </Text>
                                        <View style={[styles.statusPill, { backgroundColor: 'rgba(56, 189, 248, 0.1)' }]}>
                                            <Text style={[styles.statusPillText, { color: '#38bdf8' }]}>
                                                PENDIENTE REVISIÓN
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.quickActions}>
                                        {!isSelectionMode && (
                                            <>
                                                <TouchableOpacity
                                                    style={[styles.iconButton, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        handleQuickDiscard(item.id);
                                                    }}
                                                >
                                                    <UserX size={18} color="#ef4444" />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.iconButton, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        toggleSelection(item.id);
                                                    }}
                                                >
                                                    <CheckSquare size={18} color="#10b981" />
                                                </TouchableOpacity>
                                            </>
                                        )}
                                        <TouchableOpacity
                                            style={styles.iconButton}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                openCandidateModal(item);
                                            }}
                                        >
                                            <ChevronRight size={18} color="#94a3b8" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={
                        !loading ? (
                            <View style={styles.emptyState}>
                                <Sparkles size={48} color="#64748b" />
                                <Text style={styles.emptyText}>No hay candidatos en el Ranking</Text>
                                <Text style={styles.emptySubtext}>Escanea CVs o sube un Excel para comenzar</Text>
                            </View>
                        ) : null
                    }
                    contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                />
            ) : viewMode === 'list' ? (
                <FlatList
                    data={candidates.filter(c => c.recruitmentStatus !== 'new')}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => {
                        const isSelected = selectedIds.includes(item.id);
                        return (
                            <TouchableOpacity
                                style={[styles.candidateCard, isSelected && styles.candidateCardSelected]}
                                onPress={() => (isSelectionMode ? toggleSelection(item.id) : openCandidateModal(item))}
                                onLongPress={() => toggleSelection(item.id)}
                            >
                                <View style={styles.cardContent}>
                                    {isSelectionMode && (
                                        <View style={{ marginRight: 12 }}>
                                            {isSelected ? <CheckSquare size={20} color="#3b82f6" /> : <Square size={20} color="#64748b" />}
                                        </View>
                                    )}
                                    <View style={styles.progressContainer}>
                                        <CircularProgress percentage={item.matchScore} size={80} strokeWidth={6} />
                                    </View>

                                    <View style={styles.cardInfo}>
                                        <Text style={styles.candidateName}>{item.name}</Text>
                                        <Text style={styles.candidateSalary}>
                                            Sueldo: {item.salaryExpectation ? `S/ ${item.salaryExpectation}` : 'N/A'}
                                        </Text>
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

                                    <View style={styles.quickActions}>
                                        {!isSelectionMode && (
                                            <>
                                                <TouchableOpacity
                                                    style={[styles.iconButton, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        handleQuickDiscard(item.id);
                                                    }}
                                                >
                                                    <UserX size={18} color="#ef4444" />
                                                </TouchableOpacity>
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
                                            </>
                                        )}
                                        <TouchableOpacity
                                            style={styles.iconButton}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                openCandidateModal(item);
                                            }}
                                        >
                                            <ChevronRight size={18} color="#94a3b8" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={
                        !loading ? (
                            <View style={styles.emptyState}>
                                <LayoutTemplate size={48} color="#64748b" />
                                <Text style={styles.emptyText}>Pipeline vacío</Text>
                                <Text style={styles.emptySubtext}>Mueve candidatos desde el Ranking para comenzar</Text>
                            </View>
                        ) : null
                    }
                    contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                />
            ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ padding: 20, gap: 15, paddingBottom: 40 }}>
                    {STATUS_OPTIONS.filter(s => s !== 'new' && s !== 'pending_ai').map(status => {
                        const columnCandidates = candidates.filter(c => c.recruitmentStatus === status);
                        return (
                            <View key={status} style={styles.kanbanColumn}>
                                <View style={[styles.kanbanHeader, { borderTopColor: getStatusColor(status) }]}>
                                    <Text style={styles.kanbanTitle}>{STATUS_LABELS[status] || status.toUpperCase()}</Text>
                                    <View style={styles.kanbanBadge}>
                                        <Text style={styles.kanbanBadgeText}>{columnCandidates.length}</Text>
                                    </View>
                                </View>
                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 20 }}>
                                    {columnCandidates.map(candidate => (
                                        <TouchableOpacity key={candidate.id} style={styles.kanbanCard} onPress={() => openCandidateModal(candidate)}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                                <CircularProgress percentage={candidate.matchScore} size={40} strokeWidth={4} />
                                                <View style={{ marginLeft: 10, flex: 1 }}>
                                                    <Text style={styles.kanbanCardName} numberOfLines={1}>{candidate.name}</Text>
                                                    <Text style={styles.kanbanCardSalary}>
                                                        {candidate.salaryExpectation ? `S/ ${candidate.salaryExpectation}` : 'S/ N/A'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={styles.kanbanCardDate}>{new Date(candidate.analyzedAt).toLocaleDateString()}</Text>
                                        </TouchableOpacity>
                                    ))}
                                    {columnCandidates.length === 0 && (
                                        <View style={styles.kanbanEmpty}>
                                            <Text style={styles.kanbanEmptyText}>Arrastra o mueve{'\n'}candidatos aquí</Text>
                                        </View>
                                    )}
                                </ScrollView>
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            {/* Bulk Actions Floating Bar */}
            {isSelectionMode && selectedIds.length > 0 && (
                <View style={styles.bulkBar}>
                    <Text style={styles.bulkBarText}>{selectedIds.length} seleccionados</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {activeTab === 'ranking' ? (
                            <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#10b981' }]} onPress={handleRankToPipeline}>
                                <Sparkles size={16} color="white" />
                                <Text style={styles.bulkBtnText}>Mover al Pipeline</Text>
                            </TouchableOpacity>
                        ) : (
                            <>
                                <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#ef4444' }]} onPress={() => handleBulkMove('rejected')}>
                                    <UserX size={16} color="white" />
                                    <Text style={styles.bulkBtnText}>Descartar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#f59e0b' }]} onPress={() => handleBulkMove('interview')}>
                                    <Clock size={16} color="white" />
                                    <Text style={styles.bulkBtnText}>Entrevista</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#10b981' }]} onPress={() => handleBulkMove('offer')}>
                                    <CheckCircle2 size={16} color="white" />
                                    <Text style={styles.bulkBtnText}>Oferta</Text>
                                </TouchableOpacity>
                            </>
                        )}
                        <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#64748b' }]} onPress={() => { setIsSelectionMode(false); setSelectedIds([]); }}>
                            <X size={16} color="white" />
                            <Text style={styles.bulkBtnText}>Cancelar</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            )}
            {/* Loading/Processing Overlay */}
            {processing && (
                <View style={styles.processingOverlay}>
                    <View style={styles.processingCard}>
                        <ActivityIndicator size="large" color="#3b82f6" />
                        <Text style={styles.processingTitle}>Procesando Candidatos</Text>
                        <Text style={styles.processingText}>{processingStatus || 'Analizando con IA...'}</Text>
                        <Text style={styles.processingWarning}>Por favor no cierres esta ventana</Text>
                    </View>
                </View>
            )}

            {/* MODAL */}
            <Modal visible={!!selectedCandidate} animationType="slide" presentationStyle="pageSheet">
                {selectedCandidate && (
                    <View style={styles.modalContainer}>
                        <StatusBar barStyle="light-content" />
                        <ScrollView style={styles.modalContent}>
                            {/* Modal Header */}
                            <View style={styles.modalHeader}>
                                <TouchableOpacity onPress={() => setSelectedCandidate(null)} style={styles.modalBackButton}>
                                    <ArrowLeft size={24} color="white" />
                                </TouchableOpacity>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalName}>{selectedCandidate.name}</Text>
                                    {selectedCandidate.email && (
                                        <Text style={styles.modalEmail}>{selectedCandidate.email}</Text>
                                    )}
                                </View>
                                {selectedCandidate.matchScore !== undefined && (
                                    <CircularProgress percentage={selectedCandidate.matchScore} size={50} strokeWidth={4} />
                                )}
                            </View>

                            {/* Match Score Large */}
                            <View style={styles.matchSection}>
                                <CircularProgress percentage={selectedCandidate.matchScore} size={140} strokeWidth={10} />
                                <Text style={styles.matchLabel}>
                                    {selectedCandidate.matchScore === undefined ? 'Análisis Pendiente' : 'Coincidencia'}
                                </Text>
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

                                {selectedCandidate.keywordsValidation && (
                                    <>
                                        <Text style={[styles.subsectionTitle, { marginTop: 16, color: '#38bdf8' }]}>🔍 Keywords Esenciales</Text>
                                        <Text style={styles.kywrdText}>{selectedCandidate.keywordsValidation}</Text>
                                    </>
                                )}
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
                                            {STATUS_LABELS[status] || status.toUpperCase()}
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
                            <View style={styles.cvSection}>
                                <TouchableOpacity
                                    style={styles.cvBigButton}
                                    onPress={() => {
                                        const url = selectedCandidate.originalFileUrl;
                                        if (!url) return showAlert("CV no disponible", "Este candidato fue cargado vía Excel o el archivo no se guardó correctamente.");
                                        if (Platform.OS === 'web') {
                                            window.open(url, '_blank');
                                        } else {
                                            Linking.openURL(url);
                                        }
                                    }}
                                >
                                    <FileText size={40} color="white" />
                                    <View>
                                        <Text style={styles.cvBigTitle}>Ver Currículum Original</Text>
                                        <Text style={styles.cvBigSub}>{selectedCandidate.originalFileUrl ? 'Haga clic para abrir el documento' : 'No disponible para este registro'}</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>

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
                                    onPress={() => openEmail(selectedCandidate.email || undefined)}
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

            {/* EXCEL UPLOAD MODAL */}
            <Modal visible={showExcelModal} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.excelModalContent}>
                        <View style={styles.excelModalHeader}>
                            <Text style={styles.excelModalTitle}>Cargar Base de Datos (Excel)</Text>
                            <TouchableOpacity onPress={() => setShowExcelModal(false)}>
                                <X size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.infoBox}>
                            <Info size={20} color="#38bdf8" style={{ marginTop: 2 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.infoTextTitle}>¿Cómo funciona?</Text>
                                <Text style={styles.infoText}>Veritly lee cualquier formato de Excel (.xlsx, .csv). Nuestra IA mapeará automáticamente columnas como Nombre, Email, Experiencia o Habilidades.</Text>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.downloadTemplateBtn} onPress={downloadTemplate}>
                            <Download size={18} color="#3b82f6" />
                            <Text style={styles.downloadTemplateText}>Descargar Plantilla Sugerida (Opcional)</Text>
                        </TouchableOpacity>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Palabras clave a auditar (Opcional):</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Ej: Inglés Avanzado, Python, SAP"
                                placeholderTextColor="#64748b"
                                value={excelKeywords}
                                onChangeText={setExcelKeywords}
                            />
                            <Text style={styles.inputHint}>Revisaremos estrictamente que el candidato posea estos requisitos.</Text>
                        </View>

                        <TouchableOpacity style={styles.dropzone} onPress={handlePickExcel} disabled={processing}>
                            <Upload size={32} color="#10b981" style={{ marginBottom: 10 }} />
                            <Text style={styles.dropzoneTitle}>Haz clic para seleccionar tu Base de Datos</Text>
                            <Text style={styles.dropzoneSubtitle}>Soporta .xlsx y .csv</Text>
                        </TouchableOpacity>
                    </View>
                </View>
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
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingHorizontal: 20,
        paddingBottom: 15,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
        backgroundColor: '#0F172A'
    },
    backButton: {
        marginRight: 15,
        padding: 5,
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white'
    },
    tabsContainer: {
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0F172A'
    },
    mainTabs: {
        flexDirection: 'row',
        gap: 20
    },
    mainTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent'
    },
    mainTabActive: {
        borderBottomColor: '#3b82f6'
    },
    mainTabText: {
        color: '#64748b',
        fontSize: 16,
        fontWeight: '600'
    },
    mainTabTextActive: {
        color: 'white'
    },
    countBadge: {
        backgroundColor: '#1e293b',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 20,
        alignItems: 'center'
    },
    countBadgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold'
    },
    rankingActions: {
        flexDirection: 'row',
        padding: 20,
        gap: 12,
        alignItems: 'center'
    },
    rankingActionBtn: {
        flex: 1
    },
    rankingActionGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 12
    },
    rankingActionText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14
    },
    rankingActionBtnSecondary: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.2)'
    },
    rankingActionTextSecondary: {
        color: '#3b82f6',
        fontWeight: 'bold',
        fontSize: 14
    },
    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    processingCard: {
        backgroundColor: '#1E293B',
        padding: 30,
        borderRadius: 20,
        alignItems: 'center',
        width: '100%',
        maxWidth: 320,
        borderWidth: 1,
        borderColor: '#334155',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10
    },
    processingTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 15,
        marginBottom: 8
    },
    processingText: {
        color: '#38bdf8',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 15
    },
    processingWarning: {
        color: '#64748b',
        fontSize: 12,
        textAlign: 'center'
    },
    filterContainer: {
        paddingHorizontal: 20,
        paddingVertical: 10
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 2
    },
    actionButtonsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: 15,
        gap: 12
    },
    viewToggleContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        borderRadius: 8,
        padding: 4,
        gap: 4
    },
    viewToggleButton: {
        padding: 6,
        borderRadius: 6
    },
    viewToggleButtonActive: {
        backgroundColor: '#3b82f6'
    },
    buttonHalf: {
        flex: 1
    },
    uploadButtonAction: {
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8
    },
    uploadGradientAction: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        gap: 8
    },
    uploadTextAction: {
        color: 'white',
        fontSize: 14,
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
    candidateCardSelected: {
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)'
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
    candidateSalary: {
        fontSize: 13,
        color: '#10b981',
        fontWeight: 'bold',
        marginBottom: 4
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
        textAlign: 'center'
    },
    kanbanColumn: {
        width: 280,
        backgroundColor: 'rgba(30, 41, 59, 0.4)',
        borderRadius: 16,
        padding: 12,
        height: '100%',
        borderWidth: 1,
        borderColor: 'rgba(100, 116, 139, 0.2)'
    },
    kanbanHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 12,
        marginBottom: 12,
        borderTopWidth: 3,
        borderTopColor: '#3b82f6',
        paddingTop: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(100, 116, 139, 0.2)'
    },
    kanbanTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: 'white'
    },
    kanbanBadge: {
        backgroundColor: 'rgba(100, 116, 139, 0.3)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12
    },
    kanbanBadgeText: {
        color: '#cbd5e1',
        fontSize: 12,
        fontWeight: 'bold'
    },
    kanbanCard: {
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(100, 116, 139, 0.3)',
        elevation: 2,
        shadowColor: 'black',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    kanbanCardName: {
        fontSize: 14,
        fontWeight: '700',
        color: 'white'
    },
    kanbanCardName: {
        fontSize: 14,
        fontWeight: '800',
        color: 'white',
        marginBottom: 2
    },
    kanbanCardSalary: {
        fontSize: 11,
        color: '#10b981',
        fontWeight: '700'
    },
    kanbanCardDate: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 4,
        textAlign: 'right'
    },
    kanbanEmpty: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(100, 116, 139, 0.3)',
        borderRadius: 12,
        height: 80
    },
    kanbanEmptyText: {
        color: '#64748b',
        fontSize: 12,
        textAlign: 'center'
    },
    bulkBar: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        backgroundColor: '#1E293B',
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        borderWidth: 1,
        borderColor: '#3b82f6'
    },
    bulkBarText: {
        color: 'white',
        fontWeight: '800',
        marginRight: 15,
        fontSize: 14
    },
    bulkBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 6
    },
    bulkBtnText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '700'
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
    modalBackButton: {
        marginRight: 15,
        padding: 5
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
    cvSection: {
        paddingHorizontal: 20,
        marginTop: 20
    },
    cvBigButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
        gap: 15
    },
    cvBigTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: '800'
    },
    cvBigSub: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 2
    },
    contactActions: {
        flexDirection: 'row',
        gap: 12,
        margin: 20,
        marginTop: 20
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
    },
    kywrdText: {
        fontSize: 14,
        color: '#e2e8f0',
        lineHeight: 20
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    excelModalContent: {
        backgroundColor: '#1E293B',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 500,
        borderWidth: 1,
        borderColor: '#334155'
    },
    excelModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    excelModalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: 'white'
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        padding: 16,
        borderRadius: 12,
        gap: 12,
        marginBottom: 16
    },
    infoTextTitle: {
        color: '#38bdf8',
        fontWeight: '700',
        fontSize: 14,
        marginBottom: 4
    },
    infoText: {
        color: '#cbd5e1',
        fontSize: 13,
        lineHeight: 20
    },
    downloadTemplateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: 8,
        gap: 8,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)'
    },
    downloadTemplateText: {
        color: '#3b82f6',
        fontWeight: '600',
        fontSize: 14
    },
    inputGroup: {
        marginBottom: 24
    },
    inputLabel: {
        color: '#f8fafc',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8
    },
    textInput: {
        backgroundColor: '#0F172A',
        borderWidth: 1,
        borderColor: '#334155',
        borderRadius: 8,
        padding: 12,
        color: 'white',
        fontSize: 14
    },
    inputHint: {
        color: '#64748b',
        fontSize: 12,
        marginTop: 6
    },
    dropzone: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: 12,
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center'
    },
    dropzoneTitle: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16,
        marginBottom: 4,
        textAlign: 'center'
    },
    dropzoneSubtitle: {
        color: '#94a3b8',
        fontSize: 13,
        textAlign: 'center'
    }
});
