import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where, orderBy, setDoc, serverTimestamp, increment, writeBatch, deleteDoc } from 'firebase/firestore';
import { 
    ArrowLeft, Mail, MessageSquare, Sparkles, Upload, X, FileText, Table, 
    Download, Info, LayoutTemplate, List, CheckCircle2, Trash2, 
    ChevronRight, MoreVertical, CheckSquare, Square, UserX, Clock,
    Briefcase, Target
} from 'lucide-react-native';
import { ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
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
    View,
    useWindowDimensions
} from 'react-native';

import CircularProgress from '../../../components/CircularProgress';
import { auth, db, storage } from '../../../config/firebase';
import {
    getCandidateHistoryForCompany,
    getJobCandidates,
    saveCandidateAnalysis,
    updateCandidateStatus
} from '../../../services/storage';
import { getEffectiveCompanyId } from '../../../services/auth-service';
import { CandidateAnalysis, MatchStatus, RecruitmentStatus } from '../../../types';
import { extractTextFromDocument } from '../../../utils/gemini';
import { analyzeCandidateForCompany, analyzeExcelRowForCompany, analyzeScrapedProfile } from '../../../utils/gemini-company';

const TooltipWrapper = Platform.OS === 'web' 
  ? ({ title, children, style }: any) => <div title={title} style={{ display: 'flex', flexDirection: 'column', ...style }}>{children}</div>
  : ({ children, style }: any) => <View style={style}>{children}</View>;

const STATUS_OPTIONS: RecruitmentStatus[] = ['new', 'pending_ai', 'screening', 'interview', 'offer', 'hired', 'rejected', 'rejected_salary'];

const STATUS_LABELS: Record<string, string> = {
    new: 'NUEVO',
    sourcing_pending: 'IMPORTADO LI',
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
        case 'sourcing_pending': return '#4245c2';
        case 'new': return '#38bdf8';
        default: return '#64748b';
    }
};

export default function JobDetailScreen() {
    const { id, title, description } = useLocalSearchParams();
    const router = useRouter();
    const { width } = useWindowDimensions();

    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
    const [activeTab, setActiveTab] = useState<'ranking' | 'pipeline'>('pipeline');
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
    const [isActionModalVisible, setIsActionModalVisible] = useState(false);
    const [wordPreviewHtml, setWordPreviewHtml] = useState<string | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [jobDetails, setJobDetails] = useState({
        title: title as string || '',
        description: description as string || '',
        companyId: ''
    });
    const [companyFeatures, setCompanyFeatures] = useState<string[]>([]);
    const [isEmailVerified, setIsEmailVerified] = useState(true);
    const [isProfileSkipped, setIsProfileSkipped] = useState(false);

    // Edit Candidate State
    const [isEditingCandidate, setIsEditingCandidate] = useState(false);
    const [editForm, setEditForm] = useState({
        email: '',
        phoneNumber: '',
        salaryExpectation: '',
        notes: ''
    });
    const [savingEdit, setSavingEdit] = useState(false);
    const [quotaInfo, setQuotaInfo] = useState<{ limit: number; used: number }>({ limit: 200, used: 0 });

    useEffect(() => {
        loadJobAndCandidates();
    }, [id]);

    // Consulta cuantos analisis IA ya se hicieron este mes calendario, en todas
    // las vacantes de la empresa (mismo criterio que el dashboard de inicio).
    const loadMonthlyQuotaUsage = async (companyId: string, limit: number) => {
        try {
            const jobsSnap = await getDocs(query(collection(db, 'jobs'), where('companyId', '==', companyId)));
            const now = new Date();
            const isThisMonth = (raw: any): boolean => {
                if (!raw) return false;
                const d = raw?.toDate ? raw.toDate() : new Date(raw);
                if (isNaN(d.getTime())) return false;
                return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
            };

            let used = 0;
            await Promise.all(jobsSnap.docs.map(async (jobDoc) => {
                const candSnap = await getDocs(collection(db, 'jobs', jobDoc.id, 'candidates'));
                candSnap.forEach(c => {
                    const data = c.data();
                    if (data.matchScore > 0 && isThisMonth(data.analyzedAt)) used++;
                });
            }));
            setQuotaInfo({ limit, used });
        } catch (e) {
            console.error("Error calculando uso de cuota IA:", e);
        }
    };

    // Devuelve true si hay cupo para analizar; si no, avisa y devuelve false.
    const checkQuotaOrWarn = (): boolean => {
        if (quotaInfo.used >= quotaInfo.limit) {
            Alert.alert(
                "Límite de análisis alcanzado",
                `Ya usaste tus ${quotaInfo.limit} análisis de IA de este mes. Sube de plan para seguir analizando candidatos.`
            );
            return false;
        }
        return true;
    };

    // Carga features del plan del usuario autenticado — mismo patrón que index.tsx
    const loadCurrentUserFeatures = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        try {
            const companyId = await getEffectiveCompanyId(currentUser.uid);
            let userDoc = await getDoc(doc(db, 'users_empresas', companyId));
            if (!userDoc.exists()) {
                userDoc = await getDoc(doc(db, 'companies', companyId));
            }
            if (!userDoc.exists()) return;

            const userData = userDoc.data();
            setIsProfileSkipped(!!userData.profileSkipped);
            loadMonthlyQuotaUsage(companyId, userData.subscription?.aiAnalysisLimit || 200);
            try {
                await currentUser.reload();
                setIsEmailVerified(currentUser.emailVerified);
            } catch (reloadErr) {
                console.log("Error reloading user info in job details:", reloadErr);
                setIsEmailVerified(currentUser.emailVerified);
            }
            let planId = (userData.subscription?.plan || 'beta_free').toLowerCase().replace(/\s+/g, '_');

            // Aliases: normalizar IDs cortos a los IDs completos del plan
            const PLAN_ALIASES: Record<string, string> = {
                'free': 'beta_free',
                'basic': 'beta_free',
                'basico': 'beta_free',
                'beta': 'beta_free',
                'pro': 'plan_pro',
                'gold': 'plan_gold',
            };
            planId = PLAN_ALIASES[planId] || planId;

            // Mismo patrón que index.tsx: buscar por campo 'id' en config_plans
            const plansRef = collection(db, 'config_plans');
            const qPlan = query(plansRef, where('id', '==', planId));
            const planSnap = await getDocs(qPlan);

            if (!planSnap.empty) {
                const planData = planSnap.docs[0].data();
                const globalFeatures: string[] = planData.features || [];
                const localFeatures: string[] = userData.subscription?.features || [];
                const mergedFeatures = Array.from(new Set([...globalFeatures, ...localFeatures]));
                setCompanyFeatures(mergedFeatures);
            } else {
                // Fallback: usar features locales del usuario si no hay plan global
                const localFeatures: string[] = userData.subscription?.features || [];
                setCompanyFeatures(localFeatures);
            }
        } catch (err) {
            console.error("Error cargando features del usuario actual:", err);
        }
    };

    const loadJobAndCandidates = async () => {
        setLoading(true);
        // Cargar features del usuario autenticado de inmediato (no depende del job)
        await loadCurrentUserFeatures();
        try {
            // Siempre cargamos el job doc para obtener companyId
            const jobDoc = await getDoc(doc(db, 'jobs', id as string));
            if (jobDoc.exists()) {
                const data = jobDoc.data();
                const compId = data.companyId || '';

                if (!jobDetails.description) {
                    setJobDetails({
                        title: data.jobTitle || 'Vacante',
                        description: data.optimizedText || data.originalText || '',
                        companyId: compId
                    });
                }
            } else if (!jobDetails.description) {
                showAlert("Error", "No se encontró la información del puesto.");
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

    const handleUploadCVs = async () => {
        if (selectedCVs.length === 0) return;
        if (!auth.currentUser) return;

        setProcessing(true);
        setProcessingStatus('Leyendo archivos...');

        try {
            const filesToProcess = selectedCVs.slice(0, 10);

            // PASO 1: Leer todos los archivos a base64 AHORA (antes de que expiren los blob URIs)
            const readFileAsBase64 = (blob: Blob): Promise<string> =>
                new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const r = reader.result as string;
                        resolve(r.includes(',') ? r.split(',')[1] : r);
                    };
                    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
                    reader.readAsDataURL(blob);
                });

            type PreparedFile = {
                file: any;
                base64: string;
                mimeType: string;
                candidateId: string;
            };

            setProcessingStatus('Procesando archivos...');
            const prepared: PreparedFile[] = [];
            for (const file of filesToProcess) {
                try {
                    const nativeFile: File | Blob | null = (file as any).file || (file as any).output || null;
                    let blob: Blob;
                    if (nativeFile) {
                        blob = nativeFile;
                    } else {
                        const res = await fetch(file.uri);
                        blob = await res.blob();
                    }
                    const base64 = await readFileAsBase64(blob);
                    
                    // Detección agresiva: Ignoramos mimeType genérico (octet-stream)
                    let mimeType = file.mimeType;
                    if (!mimeType || mimeType === 'application/octet-stream') {
                        mimeType = (file.name.match(/\.docx?$/i) 
                            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
                            : 'application/pdf');
                    }
                    
                    prepared.push({
                        file,
                        base64,
                        mimeType,
                        candidateId: crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`
                    });
                } catch (readErr: any) {
                    console.error(`No se pudo leer ${file.name}:`, readErr.message);
                }
            }

            if (prepared.length === 0) {
                showAlert('Error', 'No se pudieron leer los archivos seleccionados.');
                setProcessing(false);
                setProcessingStatus('');
                return;
            }

            // PASO 2: Crear candidatos con base64 y guardarlos en Firestore YA (garantizado)
            setProcessingStatus('Guardando candidatos...');
            const newCandidatesList: CandidateAnalysis[] = prepared.map(p => ({
                id: p.candidateId,
                jobId: id as string,
                name: p.file.name.split('.')[0] || 'Candidato',
                email: null,
                matchScore: 0,
                summary: 'Pendiente de análisis con IA',
                recruitmentStatus: 'new' as RecruitmentStatus,
                matchStatus: 'red' as MatchStatus, // Placeholder hasta que la IA analice
                analyzedAt: new Date().toISOString() as any,
                originalJobTitle: jobDetails.title,
                originalFileUrl: undefined,
                pros: [],
                cons: [],
                cvBase64: p.base64,
                cvMimeType: p.mimeType,
            }));

            // Guardar en Firestore de inmediato
            await Promise.all(newCandidatesList.map(c => saveCandidateAnalysis(id as string, c)));

            // PASO 3: Actualizar UI
            setCandidates(prev => [...newCandidatesList, ...(prev || [])]);
            setSelectedCVs([]);
            setProcessing(false);
            setProcessingStatus('');
            showAlert('✅ Candidatos Guardados', `${prepared.length} candidato(s) guardados. Subiendo archivos a la nube en segundo plano...`);

            // PASO 4: Intentar subir a Firebase Storage en background (mejora opcional)
            prepared.forEach(async (p, i) => {
                const candidateData = newCandidatesList[i];
                try {
                    const safeFileName = p.file.name.replace(/[^a-zA-Z0-9.]/g, '_');
                    const fileRef = ref(storage, `cvs/${jobDetails.companyId || 'anon'}/${id}/${Date.now()}_${safeFileName}`);
                    const snap = await uploadString(fileRef, p.base64, 'base64', { contentType: p.mimeType });
                    const storageUrl = await getDownloadURL(snap.ref);

                    // Actualizar Firestore con la URL real
                    const docRef = doc(db, 'jobs', id as string, 'candidates', candidateData.id);
                    await setDoc(docRef, { originalFileUrl: storageUrl }, { merge: true });

                    // Actualizar UI
                    setCandidates(prev => (prev || []).map(c =>
                        c.id === candidateData.id ? { ...c, originalFileUrl: storageUrl } : c
                    ));
                } catch (storageErr: any) {
                    // Storage no disponible - OK, el candidato ya está guardado con base64
                    console.warn(`Storage no disponible para ${p.file.name}:`, storageErr.message);
                }
            });

        } catch (error: any) {
            console.error('Upload fatal:', error);
            showAlert('Error', error.message);
            setProcessing(false);
            setProcessingStatus('');
        }
    };


    const downloadTemplate = async () => {
        const XLSX = await import('xlsx');
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

    const handleUploadExcel = async () => {
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

            const XLSX = await import('xlsx');
            const wb = XLSX.read(arrayBuffer, { type: 'buffer' });
            const wsName = wb.SheetNames[0];
            const ws = wb.Sheets[wsName];
            const jsonData = XLSX.utils.sheet_to_json(ws);

            if (jsonData.length === 0) {
                setProcessing(false);
                return showAlert("Error", "El archivo Excel está vacío.");
            }

            let processedCount = 0;
            const rowsToProcess = jsonData.slice(0, 100); // More rows allowed for simple upload

            for (const row of rowsToProcess) {
                try {
                    const r = row as any;
                    const newCandidate: CandidateAnalysis = {
                        id: Math.random().toString(36).substring(7),
                        jobId: id as string,
                        name: r.Nombre || r.Name || "Candidato Excel",
                        email: r.Email || r.Correo || null,
                        phoneNumber: r.Telefono || r.Phone || null,
                        matchScore: 0,
                        matchStatus: 'red' as MatchStatus, // Placeholder hasta que la IA analice
                        summary: r.Resumen || r.Summary || "Importado de Excel - Sin analizar",
                        pros: [],
                        cons: [],
                        experience: r.Experiencia || r.Experience || undefined,
                        skills: r.Habilidades || r.Skills || undefined,
                        recruitmentStatus: 'new',
                        analyzedAt: null as any,
                        originalJobTitle: jobDetails.title
                    };

                    await saveCandidateAnalysis(id as string, newCandidate);
                    processedCount++;
                } catch (e: any) {
                    console.error("Row error:", e);
                }
            }

            if (processedCount > 0) {
                showAlert("Éxito", `${processedCount} candidatos subidos desde Excel. Ahora puedes analizarlos con IA.`);
                loadJobAndCandidates();
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
                batch.set(docRef, { recruitmentStatus: 'screening' }, { merge: true });
            });
            await batch.commit();

            setCandidates(prev => (prev || []).map(c => 
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

    const handleBulkMove = async (newStatus: RecruitmentStatus, targetIds?: string[]) => {
        const idsToMove = targetIds || selectedIds;
        if (idsToMove.length === 0) return;
        setLoading(true);
        try {
            const batch = writeBatch(db);
            idsToMove.forEach(cid => {
                const docRef = doc(db, 'jobs', id as string, 'candidates', cid);
                batch.set(docRef, { recruitmentStatus: newStatus }, { merge: true });
            });
            await batch.commit();

            setCandidates(prev => (prev || []).map(c => 
                idsToMove.includes(c.id) ? { ...c, recruitmentStatus: newStatus } : c
            ));
            if (!targetIds) {
                setSelectedIds([]);
                if (isSelectionMode) setIsSelectionMode(false);
            }
            showAlert("Éxito", `${idsToMove.length} candidatos movidos.`);
        } catch (err) {
            console.error(err);
            showAlert("Error", "No se pudieron mover los candidatos.");
        } finally {
            setLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        const executeBulkDelete = async () => {
            setLoading(true);
            try {
                const batch = writeBatch(db);
                selectedIds.forEach(cid => {
                    const docRef = doc(db, 'jobs', id as string, 'candidates', cid);
                    batch.delete(docRef);
                });
                await batch.commit();
                setCandidates(prev => (prev || []).filter(c => !selectedIds.includes(c.id)));
                setSelectedIds([]);
                setIsSelectionMode(false);
                showAlert("Eliminados", "Los candidatos han sido eliminados satisfactoriamente.");
            } catch (err) {
                console.error(err);
                showAlert("Error", "No se pudieron eliminar los candidatos.");
            } finally {
                setLoading(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`¿Estás seguro de eliminar permanentemente a ${selectedIds.length} candidatos? Esta acción no se puede deshacer.`)) {
                executeBulkDelete();
            }
        } else {
            Alert.alert(
                "Eliminar Candidatos",
                `¿Estás seguro de eliminar permanentemente a ${selectedIds.length} candidatos? Esta acción no se puede deshacer.`,
                [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Eliminar", style: "destructive", onPress: executeBulkDelete }
                ]
            );
        }
    };

    const handleCleanupPipeline = async () => {
        if (!auth.currentUser) return;
        
        Alert.alert(
            "Limpieza de Pipeline",
            "¿Estás seguro de que deseas ELIMINAR TODOS los candidatos de esta vacante? Esta acción no se puede deshacer.",
            [
                { text: "Cancelar", style: "cancel" },
                { 
                    text: "ELIMINAR TODO", 
                    style: "destructive",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const q = query(collection(db, 'jobs', id as string, 'candidates'));
                            const snap = await getDocs(q);
                            const batch = writeBatch(db);
                            
                            snap.docs.forEach((docSnap) => {
                                batch.delete(docSnap.ref);
                            });
                            
                            await batch.commit();
                            setCandidates([]);
                            showAlert("Éxito", "El pipeline ha sido vaciado completamente.");
                        } catch (err) {
                            console.error(err);
                            showAlert("Error", "No se pudo limpiar el pipeline.");
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };


    const handleAnalyzeIndividualCandidate = async (candidate: CandidateAnalysis) => {
        if (!auth.currentUser || processing) return;
        if (!checkQuotaOrWarn()) return;
        setProcessing(true);
        setProcessingStatus(`Analizando perfil para ${candidate.name}...`);
        
        try {
            let textToAnalyze = "";
            const cvBase64 = (candidate as any).cvBase64;
            
            // Case 1: LinkedIn Sourced (captured text)
            if ((candidate as any).about || candidate.role) {
                textToAnalyze = `CARGO EN LINKEDIN: ${candidate.role || 'No especificado'}
                RESUMEN/ABOUT: ${(candidate as any).about || 'No hay descripción disponible.'}
                EXPERIENCIA DETALLADA: ${(candidate as any).experience || 'No se capturó historial detallado.'}`;
            } 
            // Case 2: External Applicant (CV PDF/Word)
            else if (candidate.originalFileUrl || cvBase64) {
                setProcessingStatus(`Extrayendo texto del Currículum...`);
                
                const fileSource = candidate.originalFileUrl || cvBase64;
                let mimeType = (candidate as any).cvMimeType || (candidate as any).cv_mime_type || 'application/pdf';
                
                // Si es base64 y el mimeType parece ser PDF, verificamos si realmente es un Word por su header
                if (fileSource && !fileSource.startsWith('http') && (fileSource.includes('UEsDBBQ') || fileSource.includes('AQAAIAQAABMAA'))) {
                    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                } else if (fileSource && fileSource.startsWith('http')) {
                    // Si es URL, inferimos por extensión si no hay mimeType
                    if (fileSource.toLowerCase().includes('.docx') || fileSource.toLowerCase().includes('.doc')) {
                        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                    }
                }
                
                // Passing base64 if URL is not available, with correct mimeType for Word detection
                textToAnalyze = await extractTextFromDocument(fileSource, mimeType);
            }
            // Case 3: Excel or manual with some summary/experience
            else if (candidate.summary || (candidate as any).experience || (candidate as any).skills) {
                 textToAnalyze = `CANDIDATO: ${candidate.name}\nRESUMEN: ${candidate.summary || ''}\nEXPERIENCIA: ${(candidate as any).experience || ''}\nHABILIDADES: ${(candidate as any).skills || ''}`;
            }

            if (!textToAnalyze) throw new Error("No hay contenido suficiente para analizar automáticamente. Verifica que el candidato tenga un CV adjunto o perfil de LinkedIn capturado.");

            setProcessingStatus(`Ejecutando IA Veritly DNA...`);
            
            let aiResult;
            const isExcelCandidate = (candidate as any).experience || (candidate as any).skills;
            
            if (isExcelCandidate && !candidate.originalFileUrl && !cvBase64) {
                // Limpiar el summary si es el default de Excel
                const cleanSummary = (candidate.summary || '').includes('Importado de Excel') ? '' : candidate.summary;
                const structuredData = `CANDIDATO: ${candidate.name}\nRESUMEN: ${cleanSummary}\nEXPERIENCIA: ${(candidate as any).experience || ''}\nHABILIDADES: ${(candidate as any).skills || ''}`;
                aiResult = await analyzeExcelRowForCompany(structuredData, jobDetails.description, excelKeywords);
            } else {
                aiResult = await analyzeCandidateForCompany(textToAnalyze, jobDetails.description);
            }
            
            const updatedCandidate = {
                ...candidate,
                matchScore: Number(aiResult.matchScore) || 0,
                summary: aiResult.summary || "Sin resumen",
                profileDnaSummary: aiResult.profileDnaSummary || "",
                standardizedSkills: aiResult.standardizedSkills || [],
                phoneNumber: aiResult.phoneNumber || candidate.phoneNumber || null,
                email: aiResult.email || candidate.email || null,
                pros: aiResult.pros || [],
                cons: aiResult.cons || [],
                keywordsValidation: aiResult.keywordsValidation || null,
                matchStatus: Number(aiResult.matchScore) >= 80 ? 'green' : Number(aiResult.matchScore) >= 60 ? 'yellow' : 'red',
                recruitmentStatus: candidate.recruitmentStatus === 'sourcing_pending' ? 'screening' : candidate.recruitmentStatus,
                analyzedAt: new Date().toISOString()
            };

            const docRef = doc(db, 'jobs', id as string, 'candidates', candidate.id);
            // Sanitize to avoid undefined errors in Firebase
            const sanitizedData = Object.fromEntries(
                Object.entries(updatedCandidate).filter(([_, v]) => v !== undefined)
            );
            await setDoc(docRef, sanitizedData, { merge: true });
            setQuotaInfo(prev => ({ ...prev, used: prev.used + 1 }));

            setCandidates(prev => (prev || []).map(c => c.id === candidate.id ? (updatedCandidate as any) : c));
            setSelectedCandidate(updatedCandidate as any);
            showAlert("Éxito", "Análisis completado satisfactoriamente.");
        } catch (err: any) {
            console.error("Error en análisis individual:", err);
            showAlert("Error de Análisis", err.message);
        } finally {
            setProcessing(false);
            setProcessingStatus('');
        }
    };

    useEffect(() => {
        const convertWordToHtml = async () => {
            if (!selectedCandidate) {
                setWordPreviewHtml(null);
                return;
            }
            
            const base64 = (selectedCandidate as any).cvBase64;
            // Detección de Word por header
            const isWord = base64 && (base64.includes('UEsDBBQ') || base64.includes('AQAAIAQAABMAA') || base64.includes('0M8R4KGx'));
            
            if (isWord) {
                setIsPreviewLoading(true);
                try {
                    const rawBase64 = base64.startsWith('data:') ? base64.split(',')[1] : base64;
                    const byteCharacters = atob(rawBase64);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    
                    const mammothModule = await import('mammoth');
                    const mammothInstance = mammothModule.default || mammothModule;
                    const result = await mammothInstance.convertToHtml({ arrayBuffer: byteArray.buffer });
                    setWordPreviewHtml(result.value);
                } catch (e) {
                    console.error("Error previsualizando Word:", e);
                    setWordPreviewHtml("<p style='color: #64748b; text-align: center; padding: 20px;'>No se pudo generar la vista previa visual de este documento Word. Puedes descargarlo para verlo completo.</p>");
                } finally {
                    setIsPreviewLoading(false);
                }
            } else {
                setWordPreviewHtml(null);
            }
        };
        convertWordToHtml();
    }, [selectedCandidate]);

    useEffect(() => {
        if (selectedCandidate) {
            const updatedCandidate = candidates.find(c => c.id === selectedCandidate.id);
            if (updatedCandidate) {
                // Sincronizar si hay cambios importantes (como la URL del CV que llega en segundo plano o el status)
                if (updatedCandidate.originalFileUrl !== selectedCandidate.originalFileUrl || 
                    updatedCandidate.recruitmentStatus !== selectedCandidate.recruitmentStatus ||
                    updatedCandidate.matchScore !== selectedCandidate.matchScore ||
                    (updatedCandidate as any).isUploading !== (selectedCandidate as any).isUploading) {
                    setSelectedCandidate(updatedCandidate);
                }
            }
        }
    }, [candidates, selectedCandidate?.id]);

    const handleQuickDiscard = async (candidateId: string) => {
        try {
            setCandidates(prev => (prev || []).map(c => c.id === candidateId ? { ...c, recruitmentStatus: 'rejected' } : c));
            await updateCandidateStatus(id as string, candidateId, 'rejected');
        } catch (err) {
            console.error(err);
        }
    };

    const handleIndividualDelete = async (candidateId: string) => {
        const executeDelete = async () => {
            setLoading(true);
            try {
                const docRef = doc(db, 'jobs', id as string, 'candidates', candidateId);
                await deleteDoc(docRef);
                setCandidates(prev => (prev || []).filter(c => c.id !== candidateId));
                showAlert("Éxito", "Candidato eliminado permanentemente.");
            } catch (err) {
                console.error(err);
                showAlert("Error", "No se pudo eliminar el candidato.");
            } finally {
                setLoading(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('¿Estás seguro de que quieres eliminar a este candidato de forma permanente?')) {
                executeDelete();
            }
        } else {
            Alert.alert(
                "Eliminar Candidato",
                "¿Estás seguro de que quieres eliminar a este candidato de forma permanente?",
                [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Eliminar", style: "destructive", onPress: executeDelete }
                ]
            );
        }
    };

    const openCandidateModal = async (candidate: CandidateAnalysis) => {
        // SEGURIDAD PROGRESIVA: Si no está verificado o el perfil está omitido, bloqueamos el acceso a datos sensibles del candidato
        if ((!isEmailVerified && auth.currentUser?.email !== 'oscar@veritlyapp.com') || isProfileSkipped) {
            showAlert(
                "🔐 Acceso Protegido", 
                "Por motivos de seguridad y protección de datos, debes verificar tu correo electrónico y completar tu perfil de empresa para acceder a los detalles del candidato, descargar su CV y ver su análisis de IA."
            );
            return;
        }

        setSelectedCandidate(candidate);
        setCandidateHistory([]);
        setIsEditingCandidate(false);
        setEditForm({
            email: candidate.email || '',
            phoneNumber: candidate.phoneNumber || '',
            salaryExpectation: candidate.salaryExpectation?.toString() || '',
            notes: (candidate as any).notes || ''
        });

        if (candidate.email && auth.currentUser) {
            try {
                const history = await getCandidateHistoryForCompany(jobDetails.companyId || auth.currentUser.uid, candidate.email, id as string);
                setCandidateHistory(history);
            } catch (err) {
                console.error("Error loading candidate history:", err);
            }
        }
    };

    const handleSaveCandidateEdit = async () => {
        if (!selectedCandidate) return;
        setSavingEdit(true);
        try {
            const updatedData = {
                email: editForm.email,
                phoneNumber: editForm.phoneNumber,
                salaryExpectation: editForm.salaryExpectation ? Number(editForm.salaryExpectation) : null,
                notes: editForm.notes,
                updatedAt: serverTimestamp()
            };

            const docRef = doc(db, 'jobs', id as string, 'candidates', selectedCandidate.id);
            await setDoc(docRef, updatedData, { merge: true });

            // Update local state
            setCandidates(prev => (prev || []).map(c => 
                c.id === selectedCandidate.id ? { ...c, ...updatedData, salaryExpectation: updatedData.salaryExpectation || undefined } : c
            ));
            setSelectedCandidate({ 
                ...selectedCandidate, 
                ...updatedData, 
                salaryExpectation: updatedData.salaryExpectation || undefined,
                notes: updatedData.notes
            } as any);
            
            setIsEditingCandidate(false);
            showAlert("Éxito", "Perfil del candidato actualizado.");
        } catch (err) {
            console.error(err);
            showAlert("Error", "No se pudieron guardar los cambios.");
        } finally {
            setSavingEdit(false);
        }
    };

    const handleStatusChange = async (newStatus: RecruitmentStatus) => {
        if (!selectedCandidate) return;
        setSelectedCandidate({ ...selectedCandidate, recruitmentStatus: newStatus });
        await updateCandidateStatus(id as string, selectedCandidate.id, newStatus);
        setCandidates(prev => (prev || []).map(c => c.id === selectedCandidate.id ? { ...c, recruitmentStatus: newStatus } : c));
    };

    const handleBulkAnalyze = async () => {

        if (selectedIds.length === 0) return;
        
        const toAnalyze = candidates.filter(c => selectedIds.includes(c.id) && (c.recruitmentStatus === 'sourcing_pending' || !c.matchScore));
        
        if (toAnalyze.length === 0) {
            return showAlert("Información", "Los candidatos seleccionados ya han sido analizados o no tienen datos suficientes.");
        }

        if (!checkQuotaOrWarn()) return;

        try {
            setProcessing(true);
            let count = 0;
            let remainingQuota = quotaInfo.limit - quotaInfo.used;
            for (const cand of toAnalyze) {
                if (remainingQuota <= 0) {
                    showAlert("Límite de análisis alcanzado", `Se analizaron ${count} de ${toAnalyze.length} candidatos antes de llegar al límite mensual de tu plan.`);
                    break;
                }
                setProcessingStatus(`Analizando ${++count}/${toAnalyze.length}: ${cand.name}`);

                let textToAnalyze = "";
                const cvBase64 = (cand as any).cvBase64;

                // 1. LinkedIn Sourced
                if ((cand as any).about || cand.role) {
                    textToAnalyze = `CARGO EN LINKEDIN: ${cand.role || 'No especificado'}
                    RESUMEN/ABOUT: ${(cand as any).about || 'No hay descripción disponible.'}
                    EXPERIENCIA DETALLADA: ${(cand as any).experience || 'No se capturó historial detallado.'}`;
                } 
                // 2. CV Document
                else if (cand.originalFileUrl || cvBase64) {
                    try {
                        textToAnalyze = await extractTextFromDocument(cand.originalFileUrl || cvBase64);
                    } catch (e) {
                        console.error("Text extraction failed for bulk candidate:", cand.id, e);
                    }
                }
                // 3. Fallback to summary
                if (!textToAnalyze && cand.summary) {
                    textToAnalyze = cand.summary;
                }

                if (!textToAnalyze) {
                    console.log(`Skipping ${cand.name} - no content to analyze`);
                    continue;
                }

                const analysis = await analyzeCandidateForCompany(textToAnalyze, jobDetails.description);

                const docRef = doc(db, 'jobs', id as string, 'candidates', cand.id);
                
                // Prioritize existing data to avoid overwriting with AI defaults
                const finalName = (cand.name && cand.name !== 'Candidato' && cand.name !== 'Candidato Externo') 
                    ? cand.name 
                    : (analysis.name || cand.name);

                const bulkUpdateData = {
                    ...analysis,
                    name: finalName,
                    phoneNumber: cand.phoneNumber || analysis.phoneNumber || null,
                    email: cand.email || analysis.email || null,
                    matchScore: Number(analysis.matchScore) || 0,
                    keywordsValidation: analysis.keywordsValidation || null,
                    matchStatus: Number(analysis.matchScore) >= 80 ? 'green' : Number(analysis.matchScore) >= 60 ? 'yellow' : 'red',
                    recruitmentStatus: cand.recruitmentStatus === 'sourcing_pending' ? 'screening' : cand.recruitmentStatus,
                    analyzedAt: new Date().toISOString()
                };

                const sanitizedBulkData = Object.fromEntries(
                    Object.entries(bulkUpdateData).filter(([_, v]) => v !== undefined)
                );

                await setDoc(docRef, sanitizedBulkData, { merge: true });
                remainingQuota--;
                setQuotaInfo(prev => ({ ...prev, used: prev.used + 1 }));

                // Update local state for each processed candidate
                setCandidates(prev => (prev || []).map(c =>
                    c.id === cand.id ? { ...c, ...sanitizedBulkData } : c
                ));

                // Rate limit safety
                if (toAnalyze.length > 1) await new Promise(r => setTimeout(r, 1000));
            }
            
            setIsSelectionMode(false);
            setSelectedIds([]);
            loadJobAndCandidates();
            showAlert("Proceso Terminado", `${count} candidatos analizados con éxito.`);
        } catch (err: any) {
            showAlert("Error en análisis masivo", err.message);
        } finally {
            setProcessing(false);
            setProcessingStatus('');
        }
    }

    const viewCandidateCV = async (cvUrl?: string, cvBase64?: string, candidateName?: string, cvMimeType?: string) => {
        const url = cvUrl;
        const base64 = cvBase64;
        let mimeType = cvMimeType || 'application/pdf';

        if (!url && !base64) return showAlert("Sin CV", "Este candidato no tiene un currículum adjunto.");

        // Auto-sanación para base64
        if (base64 && (base64.includes('UEsDBBQ') || base64.includes('AQAAIAQAABMAA') || base64.includes('0M8R4KGx'))) {
            if (mimeType === 'application/pdf' || mimeType === 'application/octet-stream') {
                mimeType = base64.includes('0M8R4KGx') ? 'application/msword' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            }
        }

        try {
            if (url) {
                if (Platform.OS === 'web') {
                    window.open(url, '_blank');
                } else {
                    await Linking.openURL(url);
                }
            } else if (base64) {
                const rawBase64 = base64.startsWith('data:') ? base64.split(',')[1] : base64;
                const dataUri = `data:${mimeType};base64,${rawBase64}`;

                if (Platform.OS === 'web') {
                    if (mimeType.includes('word') || mimeType.includes('officedocument') || mimeType.includes('msword')) {
                        const link = document.createElement('a');
                        link.href = dataUri;
                        link.download = `${candidateName || 'CV'}${mimeType.includes('wordprocessingml') ? '.docx' : '.doc'}`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    } else {
                        window.open(dataUri, '_blank');
                    }
                } else {
                    await Linking.openURL(dataUri);
                }
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
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Header */}
            <View style={styles.header}>
                {isSelectionMode ? (
                    <TouchableOpacity 
                        onPress={() => { setIsSelectionMode(false); setSelectedIds([]); }} 
                        style={styles.backButton}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
                        <X size={24} color="#111827" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity 
                        onPress={() => router.canGoBack() ? router.back() : router.replace('/empresa/dashboard')} 
                        style={styles.backButton}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
                        <ArrowLeft size={24} color="#111827" />
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
            <View style={[styles.tabsContainer, width < 480 && { flexDirection: 'column', alignItems: 'stretch', gap: 10, paddingBottom: 10 }]}>
                <View style={[styles.mainTabs, width < 480 && { gap: 12, justifyContent: 'space-around' }]}>
                    <TouchableOpacity 
                        style={[styles.mainTab, activeTab === 'ranking' && styles.mainTabActive]} 
                        onPress={() => setActiveTab('ranking')}
                    >
                        <Sparkles size={20} color={activeTab === 'ranking' ? '#3b82f6' : '#64748b'} />
                        <Text style={[styles.mainTabText, activeTab === 'ranking' && styles.mainTabTextActive, width < 450 && { fontSize: 13 }]}>Ranking IA</Text>
                        <View style={[styles.countBadge, activeTab === 'ranking' && { backgroundColor: '#3b82f6' }]}>
                            <Text style={styles.countBadgeText}>{candidates.filter(c => ['new', 'sourcing_pending', 'pending_ai'].includes(c.recruitmentStatus)).length}</Text>
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
                        <Text style={[styles.mainTabText, activeTab === 'pipeline' && styles.mainTabTextActive, width < 450 && { fontSize: 13 }]}>Pipeline ATS</Text>
                        <View style={[styles.countBadge, activeTab === 'pipeline' && { backgroundColor: '#10b981' }]}>
                            <Text style={styles.countBadgeText}>
                                {candidates.filter(c => ['screening', 'interview', 'offer', 'hired', 'rejected', 'rejected_salary'].includes(c.recruitmentStatus)).length}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {activeTab === 'pipeline' && (
                    <View style={[styles.viewToggleContainer, width < 480 && { alignSelf: 'center', marginTop: 4, width: '100%', justifyContent: 'center' }]}>
                        <TouchableOpacity
                            onPress={() => setViewMode('list')}
                            style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleButtonActive, width < 480 && { flex: 1, alignItems: 'center' }]}
                        >
                            <List size={20} color={viewMode === 'list' ? 'white' : '#64748b'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setViewMode('kanban')}
                            style={[styles.viewToggleButton, viewMode === 'kanban' && styles.viewToggleButtonActive, width < 480 && { flex: 1, alignItems: 'center' }]}
                        >
                            <LayoutTemplate size={20} color={viewMode === 'kanban' ? 'white' : '#64748b'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                if (isSelectionMode) {
                                    setIsSelectionMode(false);
                                    setSelectedIds([]);
                                } else {
                                    setIsSelectionMode(true);
                                }
                            }}
                            style={[styles.viewToggleButton, isSelectionMode && { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3b82f6' }, width < 480 && { flex: 1, alignItems: 'center' }]}
                        >
                            <CheckSquare size={20} color={isSelectionMode ? '#3b82f6' : '#64748b'} />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Quick Actions Bar (Ranking Context) */}
            {activeTab === 'ranking' && (
                <View style={[styles.rankingActions, width < 480 && { flexDirection: 'column', alignItems: 'stretch', gap: 10, padding: 15 }]}>
                    {selectedCVs.length > 0 ? (
                        <View style={{flexDirection: 'row', gap: 10, flex: 1}}>
                            <TouchableOpacity 
                                onPress={handleUploadCVs} 
                                disabled={processing}
                                style={styles.rankingActionBtn}
                            >
                                <LinearGradient
                                    colors={['#10b981', '#059669']}
                                    style={styles.rankingActionGradient}
                                >
                                    <Upload size={18} color="white" />
                                    <Text style={styles.rankingActionText}>Subir {selectedCVs.length} Candidato{selectedCVs.length > 1 ? 's' : ''}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.rankingActionBtnSecondary, {flex: 0, paddingHorizontal: 15}]} onPress={() => setSelectedCVs([])}>
                                <X size={20} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={{ flexDirection: width < 480 ? 'column' : 'row', gap: 10, flex: 1, width: '100%' }}>
                            {companyFeatures.includes("Subida CVs (PDF/Word)") && (
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
                            )}
                            {companyFeatures.includes("Subida masiva por Excel") && (
                                <TouchableOpacity 
                                    onPress={() => setShowExcelModal(true)}
                                    style={styles.rankingActionBtnSecondary}
                                >
                                    <Table size={18} color="#3b82f6" />
                                    <Text style={styles.rankingActionTextSecondary}>Subir Excel</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                    <TouchableOpacity 
                        style={[
                            { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
                            width >= 480 ? { marginLeft: 10 } : { marginTop: 5, justifyContent: 'center', paddingVertical: 12, width: '100%' }
                        ]} 
                        onPress={handleCleanupPipeline}
                    >
                        <Trash2 size={14} color="#ef4444" />
                        <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold' }}>LIMPIAR PIPELINE</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* View Switching */}
            {activeTab === 'ranking' ? (
                <FlatList
                    data={candidates.filter(c => (c.recruitmentStatus === 'new' || c.recruitmentStatus === 'sourcing_pending')).sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))}
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
                                    <View style={styles.cardTopRow}>
                                        {isSelectionMode && (
                                            <View style={{ marginRight: 12 }}>
                                                {isSelected ? <CheckSquare size={20} color="#3b82f6" /> : <Square size={20} color="#64748b" />}
                                            </View>
                                        )}
                                        <View style={styles.progressContainer} {...({ title: "Ranking validado bajo criterios de selección inteligente de Veritly." } as any)}>
                                            <CircularProgress percentage={item.matchScore} size={80} strokeWidth={6} />
                                            <View style={styles.validationSeal}>
                                                <CheckCircle2 color="#2563EB" size={18} fill="white" />
                                            </View>
                                        </View>

                                        <View style={styles.cardInfo}>
                                            <Text style={styles.candidateName} numberOfLines={2}>{item.name}</Text>
                                            <Text style={styles.candidateSalary}>
                                                Sueldo: {item.salaryExpectation ? `S/ ${item.salaryExpectation}` : 'N/A'}
                                            </Text>
                                            <Text style={styles.candidateDate}>
                                                {new Date(item.analyzedAt).toLocaleDateString('es-ES', {
                                                    day: 'numeric',
                                                    month: 'short'
                                                })}
                                            </Text>
                                            <View style={[styles.statusPill, { backgroundColor: item.recruitmentStatus === 'sourcing_pending' ? 'rgba(66, 69, 194, 0.15)' : 'rgba(56, 189, 248, 0.1)' }]}>
                                                <Text style={[styles.statusPillText, { color: item.recruitmentStatus === 'sourcing_pending' ? '#38bdf8' : '#38bdf8' }]}>
                                                    {item.recruitmentStatus === 'sourcing_pending' ? 'IMPORTADO LINKEDIN' : 'PENDIENTE REVISIÓN'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                        <View style={styles.quickActions}>
                                        {!isSelectionMode && (
                                            <>
                                                {(item.matchScore === 0 || !item.matchScore) && (
                                                    <TooltipWrapper title="Analizar con IA (Consume créditos)">
                                                        <TouchableOpacity
                                                            style={[styles.iconButton, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139, 92, 246, 0.1)', width: 100, borderRadius: 8 }]}
                                                            onPress={(e) => {
                                                                e.stopPropagation();
                                                                handleAnalyzeIndividualCandidate(item);
                                                            }}
                                                        >
                                                            <Sparkles size={14} color="#8b5cf6" />
                                                            <Text style={{ color: '#8b5cf6', fontSize: 10, fontWeight: 'bold', marginLeft: 5 }}>ANALIZAR</Text>
                                                        </TouchableOpacity>
                                                    </TooltipWrapper>
                                                )}
                                                <TooltipWrapper title="Mover al Pipeline ATS">
                                                    <TouchableOpacity
                                                        style={[styles.iconButton, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', width: 80, borderRadius: 8 }]}
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            handleBulkMove('screening', [item.id]);
                                                        }}
                                                    >
                                                        <FileText size={14} color="#10b981" />
                                                        <Text style={{ color: '#10b981', fontSize: 10, fontWeight: 'bold', marginLeft: 5 }}>MOVER</Text>
                                                    </TouchableOpacity>
                                                </TooltipWrapper>
                                                <TooltipWrapper title="Descartar Candidato">
                                                    <TouchableOpacity
                                                        style={[styles.iconButton, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            handleQuickDiscard(item.id);
                                                        }}
                                                    >
                                                        <UserX size={18} color="#ef4444" />
                                                    </TouchableOpacity>
                                                </TooltipWrapper>
                                                <TooltipWrapper title="Eliminar Permanentemente">
                                                    <TouchableOpacity
                                                        style={[styles.iconButton, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            handleIndividualDelete(item.id);
                                                        }}
                                                    >
                                                        <Trash2 size={18} color="#ef4444" />
                                                    </TouchableOpacity>
                                                </TooltipWrapper>
                                                <TooltipWrapper title="Seleccionar para acciones masivas">
                                                    <TouchableOpacity
                                                        style={[styles.iconButton, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            toggleSelection(item.id);
                                                        }}
                                                    >
                                                        <CheckSquare size={18} color="#10b981" />
                                                    </TouchableOpacity>
                                                </TooltipWrapper>
                                            </>
                                        )}
                                        <TouchableOpacity
                                            style={styles.iconButton}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                openCandidateModal(item);
                                            }}
                                        >
                                            <ChevronRight size={18} color="#64748B" />
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
                                    <View style={styles.cardTopRow}>
                                        {isSelectionMode && (
                                            <View style={{ marginRight: 12 }}>
                                                {isSelected ? <CheckSquare size={20} color="#3b82f6" /> : <Square size={20} color="#64748b" />}
                                            </View>
                                        )}
                                        <View style={styles.progressContainer} {...({ title: "Ranking validado bajo criterios de selección inteligente de Veritly." } as any)}>
                                            <CircularProgress percentage={item.matchScore} size={80} strokeWidth={6} />
                                            <View style={styles.validationSeal}>
                                                <CheckCircle2 color="#2563EB" size={18} fill="white" />
                                            </View>
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
                                    </View>

                                    <View style={styles.quickActions}>
                                        {!isSelectionMode && (
                                            <>
                                                <TooltipWrapper title="Descartar Candidato">
                                                    <TouchableOpacity
                                                        style={[styles.iconButton, { backgroundColor: 'rgba(239, 68, 68, 0.1)', alignItems: 'center', minWidth: 50 }]}
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            handleQuickDiscard(item.id);
                                                        }}
                                                    >
                                                        <UserX size={16} color="#ef4444" />
                                                        <Text style={{ color: '#ef4444', fontSize: 8, fontWeight: 'bold', marginTop: 2 }}>DESCARTAR</Text>
                                                    </TouchableOpacity>
                                                </TooltipWrapper>
                                                <TooltipWrapper title="Eliminar Permanentemente">
                                                    <TouchableOpacity
                                                        style={[styles.iconButton, { backgroundColor: 'rgba(239, 68, 68, 0.1)', alignItems: 'center', minWidth: 50 }]}
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            handleIndividualDelete(item.id);
                                                        }}
                                                    >
                                                        <Trash2 size={16} color="#ef4444" />
                                                        <Text style={{ color: '#ef4444', fontSize: 8, fontWeight: 'bold', marginTop: 2 }}>ELIMINAR</Text>
                                                    </TouchableOpacity>
                                                </TooltipWrapper>
                                                {item.phoneNumber && (
                                                    <TooltipWrapper title="Contactar por WhatsApp">
                                                        <TouchableOpacity
                                                            style={[styles.iconButton, { alignItems: 'center', minWidth: 50 }]}
                                                            onPress={(e) => {
                                                                e.stopPropagation();
                                                                openWhatsApp(item.phoneNumber);
                                                            }}
                                                        >
                                                            <MessageSquare size={16} color="#10b981" />
                                                            <Text style={{ color: '#10b981', fontSize: 8, fontWeight: 'bold', marginTop: 2 }}>WHATSAPP</Text>
                                                        </TouchableOpacity>
                                                    </TooltipWrapper>
                                                )}
                                            </>
                                        )}
                                        <TouchableOpacity
                                            style={[styles.iconButton, { alignItems: 'center', minWidth: 60 }]}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                openCandidateModal(item);
                                            }}
                                        >
                                            <ChevronRight size={18} color="#94a3b8" />
                                            <Text style={{ color: '#94a3b8', fontSize: 9, fontWeight: 'bold', marginTop: 2 }}>VER MÁS</Text>
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
                                <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 20 }}>
                                    {columnCandidates.map(candidate => {
                                        const isSelected = selectedIds.includes(candidate.id);
                                        return (
                                            <TouchableOpacity 
                                                key={candidate.id} 
                                                style={[styles.kanbanCard, isSelected && styles.candidateCardSelected]} 
                                                onPress={() => (isSelectionMode ? toggleSelection(candidate.id) : openCandidateModal(candidate))}
                                                onLongPress={() => toggleSelection(candidate.id)}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                                    {isSelectionMode && (
                                                        <View style={{ marginRight: 8 }}>
                                                            {isSelected ? <CheckSquare size={18} color="#3b82f6" /> : <Square size={18} color="#64748b" />}
                                                        </View>
                                                    )}
                                                    <CircularProgress percentage={candidate.matchScore} size={36} strokeWidth={3} />
                                                    <View style={{ marginLeft: 10, flex: 1 }}>
                                                        <Text style={styles.kanbanCardName} numberOfLines={1}>{candidate.name}</Text>
                                                        <Text style={styles.kanbanCardSalary}>
                                                            {candidate.salaryExpectation ? `S/ ${candidate.salaryExpectation}` : 'S/ N/A'}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.kanbanCardDate}>{new Date(candidate.analyzedAt).toLocaleDateString()}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                    {columnCandidates.length === 0 && (
                                        <View style={styles.kanbanEmpty}>
                                            <Text style={styles.kanbanEmptyText}>Sin candidatos{'\n'}en esta etapa</Text>
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
                        <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#8b5cf6' }]} onPress={handleBulkAnalyze}>
                            <Sparkles size={16} color="white" />
                            <Text style={styles.bulkBtnText}>Analizar IA</Text>
                        </TouchableOpacity>

                        {activeTab === 'ranking' ? (
                            <>
                                <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#10b981' }]} onPress={handleRankToPipeline}>
                                    <FileText size={16} color="white" />
                                    <Text style={styles.bulkBtnText}>Mover al Pipeline</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#ef4444' }]} onPress={handleBulkDelete}>
                                    <Trash2 size={16} color="white" />
                                    <Text style={styles.bulkBtnText}>Eliminar</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#ef4444' }]} onPress={handleBulkDelete}>
                                    <Trash2 size={16} color="white" />
                                    <Text style={styles.bulkBtnText}>Eliminar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#94a3b8' }]} onPress={() => handleBulkMove('rejected')}>
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
                        <StatusBar barStyle="dark-content" />
                        <ScrollView style={styles.modalContent}>
                            {/* Modal Header */}
                            <View style={styles.modalHeader}>
                                <TouchableOpacity onPress={() => setSelectedCandidate(null)} style={styles.modalBackButton}>
                                    <ArrowLeft size={24} color="#1E293B" />
                                </TouchableOpacity>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalName}>{selectedCandidate.name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={styles.modalEmail}>{selectedCandidate.email || 'Sin email'}</Text>
                                        <TouchableOpacity onPress={() => setIsEditingCandidate(!isEditingCandidate)}>
                                            <Text style={{ color: '#3b82f6', fontSize: 12, fontWeight: 'bold' }}>
                                                {isEditingCandidate ? '[ CANCELAR ]' : '[ EDITAR PERFIL ]'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                {selectedCandidate.matchScore !== undefined && (
                                    <CircularProgress percentage={selectedCandidate.matchScore} size={50} strokeWidth={4} />
                                )}
                            </View>

                            {/* EDIT FORM (Conditionally Shown) */}
                            {isEditingCandidate && (
                                <View style={styles.editSection}>
                                    <Text style={styles.editSectionTitle}>Editar Datos del Candidato</Text>
                                    
                                    <Text style={styles.modalLabel}>Correo Electrónico</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        value={editForm.email}
                                        onChangeText={(t) => setEditForm({ ...editForm, email: t })}
                                        placeholder="email@ejemplo.com"
                                        placeholderTextColor="#64748b"
                                    />

                                    <Text style={styles.modalLabel}>Teléfono / WhatsApp</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        value={editForm.phoneNumber}
                                        onChangeText={(t) => setEditForm({ ...editForm, phoneNumber: t })}
                                        placeholder="+51 900..."
                                        placeholderTextColor="#64748b"
                                    />

                                    <Text style={styles.modalLabel}>Expectativa Salarial (S/.)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        value={editForm.salaryExpectation}
                                        onChangeText={(t) => setEditForm({ ...editForm, salaryExpectation: t })}
                                        placeholder="3500"
                                        keyboardType="numeric"
                                        placeholderTextColor="#64748b"
                                    />

                                    <Text style={styles.modalLabel}>Notas del Reclutador</Text>
                                    <TextInput
                                        style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
                                        value={editForm.notes}
                                        onChangeText={(t) => setEditForm({ ...editForm, notes: t })}
                                        placeholder="Escribe tus observaciones aquí..."
                                        multiline
                                        placeholderTextColor="#64748b"
                                    />

                                    <TouchableOpacity 
                                        style={styles.saveEditBtn} 
                                        onPress={handleSaveCandidateEdit}
                                        disabled={savingEdit}
                                    >
                                        {savingEdit ? <ActivityIndicator color="white" /> : <Text style={styles.saveEditBtnText}>Guardar Cambios</Text>}
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Match Score Large */}
                            <View style={styles.matchSection}>
                                <CircularProgress percentage={selectedCandidate.matchScore || 0} size={140} strokeWidth={10} />
                                <Text style={styles.matchLabel}>
                                    {selectedCandidate.matchScore === undefined || selectedCandidate.matchScore === 0 ? 'Análisis Pendiente' : 'Coincidencia'}
                                </Text>
                                
                                {(!selectedCandidate.matchScore || selectedCandidate.matchScore === 0) && (
                                    <TouchableOpacity 
                                        style={{ marginTop: 20, backgroundColor: '#8b5cf6', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#8b5cf6', shadowOpacity: 0.4, shadowRadius: 10, elevation: 5 }} 
                                        onPress={() => handleAnalyzeIndividualCandidate(selectedCandidate)}
                                        disabled={processing}
                                    >
                                        <Sparkles size={20} color="white" />
                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>RE-ANALIZAR CON IA ✨</Text>
                                    </TouchableOpacity>
                                )}

                            </View>

                            {/* Excel Sourced Info */}
                            {((selectedCandidate as any).experience || (selectedCandidate as any).skills) && (
                                <View style={{ marginHorizontal: 20, marginBottom: 20, padding: 15, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#10b981' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <Table size={16} color="#10b981" />
                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>Datos Importados de Excel</Text>
                                    </View>
                                    {(selectedCandidate as any).experience && (
                                        <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                                            <Text style={{ fontWeight: 'bold', color: '#cbd5e1' }}>Experiencia: </Text>
                                            {(selectedCandidate as any).experience}
                                        </Text>
                                    )}
                                    {(selectedCandidate as any).skills && (
                                        <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                                            <Text style={{ fontWeight: 'bold', color: '#cbd5e1' }}>Habilidades: </Text>
                                            {(selectedCandidate as any).skills}
                                        </Text>
                                    )}
                                </View>
                            )}

                            {/* LinkedIn Sourced Info */}
                            {((selectedCandidate as any).about || selectedCandidate.role) && (
                                <View style={{ marginHorizontal: 20, marginBottom: 20, padding: 15, backgroundColor: 'rgba(66, 69, 194, 0.1)', borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#4245c2' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <Briefcase size={16} color="#38bdf8" />
                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>Perfil Capturado de LinkedIn</Text>
                                    </View>
                                    <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '600', marginBottom: 4 }}>{selectedCandidate.role}</Text>
                                    <Text style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }} numberOfLines={5}>
                                        "{(selectedCandidate as any).about || 'Sin descripción adicional.'}"
                                    </Text>
                                    
                                    {(selectedCandidate as any).experience && (
                                        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
                                            <Text style={{ color: '#38bdf8', fontSize: 11, fontWeight: '800', marginBottom: 6, letterSpacing: 1 }}>EXPERIENCIA CAPTURADA</Text>
                                            <Text style={{ color: '#94a3b8', fontSize: 11 }} numberOfLines={8}>{(selectedCandidate as any).experience}</Text>
                                        </View>
                                    )}

                                    <TouchableOpacity 
                                        style={{ marginTop: 15, backgroundColor: 'rgba(66, 69, 194, 0.2)', padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#4245c2' }}
                                        onPress={() => (selectedCandidate as any).linkedinUrl ? Linking.openURL((selectedCandidate as any).linkedinUrl) : null}
                                    >
                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>Ver Perfil Completo en LinkedIn 🔗</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* AI Analysis Card */}
                            <View style={styles.aiCard}>
                                <View style={styles.aiCardHeader}>
                                    <Sparkles size={24} color="#f59e0b" />
                                    <Text style={styles.aiCardTitle}>Análisis IA</Text>
                                </View>
                                <Text style={styles.aiSummary}>{selectedCandidate.summary}</Text>

                                <Text style={styles.subsectionTitle}>✅ Puntos Fuertes</Text>
                                {(selectedCandidate.pros || []).map((p, i) => (
                                    <Text key={i} style={styles.proText}>• {p}</Text>
                                ))}

                                <Text style={[styles.subsectionTitle, { marginTop: 16 }]}>⚠️ A Considerar</Text>
                                {(selectedCandidate.cons || []).map((c, i) => (
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

                            {/* CV Preview OR Profile Text (Web Only) */}
                            {Platform.OS === 'web' && (
                                <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
                                    {(selectedCandidate as any).isUploading ? (
                                        <View style={{ padding: 40, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed' }}>
                                            <ActivityIndicator size="large" color="#3b82f6" />
                                            <Text style={{ marginTop: 15, color: '#475569', fontSize: 14, fontWeight: '500' }}>El documento se está asegurando en la nube...</Text>
                                            <Text style={{ marginTop: 5, color: '#94a3b8', fontSize: 12 }}>Esto puede tomar unos segundos dependiendo del tamaño.</Text>
                                        </View>
                                    ) : (selectedCandidate.originalFileUrl || (selectedCandidate as any).cvUrl || (selectedCandidate as any).cvBase64) ? (
                                        <>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                                <FileText size={18} color="#38bdf8" />
                                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Vista Previa del CV</Text>
                                            </View>
                                            <View style={{ height: 600, backgroundColor: '#F8FAFC', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
                                                {(() => {
                                                    const url = selectedCandidate.originalFileUrl || (selectedCandidate as any).cvUrl || (selectedCandidate as any).cv_url || '';
                                                    const base64 = (selectedCandidate as any).cvBase64 || '';
                                                    
                                                    if (!url && !base64) return null;
                                                    
                                                    if (isPreviewLoading) {
                                                        return (
                                                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                                                <ActivityIndicator size="large" color="#3b82f6" />
                                                                <Text style={{ marginTop: 10, color: '#64748b' }}>Cargando vista previa...</Text>
                                                            </View>
                                                        );
                                                    }

                                                    if (wordPreviewHtml) {
                                                        return (
                                                            <ScrollView style={{ flex: 1, padding: 30 }}>
                                                                <div 
                                                                    style={{ color: '#1e293b', fontSize: '14px', lineHeight: '1.6', fontFamily: 'serif' }}
                                                                    dangerouslySetInnerHTML={{ __html: wordPreviewHtml }} 
                                                                />
                                                            </ScrollView>
                                                        );
                                                    }

                                                    let iframeSrc = '';
                                                    if (url) {
                                                        const isWord = url.toLowerCase().includes('.doc') || url.toLowerCase().includes('.docx');
                                                        // Usar Google Docs Viewer para Word URLs
                                                        iframeSrc = isWord 
                                                            ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true` 
                                                            : url;
                                                    } else if (base64) {
                                                        // Para base64, si no es Word (manejado arriba), asumimos PDF
                                                        iframeSrc = base64.startsWith('data:') ? base64 : `data:application/pdf;base64,${base64}`;
                                                    }
                                                    
                                                    return (
                                                        <iframe 
                                                            key={selectedCandidate.id} 
                                                            src={iframeSrc}
                                                            style={{ width: '100%', height: '100%', border: 'none' }}
                                                        />
                                                    );
                                                })()}
                                            </View>
                                        </>
                                    ) : ((selectedCandidate as any).experience || (selectedCandidate as any).about) ? (
                                        <View style={{ padding: 15, backgroundColor: 'rgba(56, 189, 248, 0.05)', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.2)' }}>
                                             <Text style={{ color: '#38bdf8', fontSize: 12, fontWeight: 'bold', marginBottom: 10 }}>TEXTO CAPTURADO (VIRTUAL CV)</Text>
                                             <Text style={{ color: '#94a3b8', fontSize: 12 }}>{((selectedCandidate as any).experience || '').substring(0, 1000)}...</Text>
                                        </View>
                                    ) : (
                                        <View style={{ padding: 20, backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', alignItems: 'center' }}>
                                            <Info size={24} color="#ef4444" style={{ marginBottom: 10 }} />
                                            <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: 'bold', textAlign: 'center' }}>CV NO DETECTADO EN EL REGISTRO</Text>
                                            <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 4 }}>Si el candidato dice haberlo subido, es posible que la carga fallara por conexión.</Text>
                                        </View>
                                    )}
                                </View>
                            )}


                            {/* Contact Actions */}
                            <View style={styles.cvSection}>

                                <TouchableOpacity
                                    style={styles.cvBigButton}
                                    onPress={() => {
                                        const url = selectedCandidate.originalFileUrl || (selectedCandidate as any).cvUrl || (selectedCandidate as any).cv_url;
                                        const base64 = (selectedCandidate as any).cvBase64;
                                        let mimeType = (selectedCandidate as any).cvMimeType || (selectedCandidate as any).cv_mime_type;
                                        
                                        // Auto-sanación: Si el base64 tiene el header de un DOCX o DOC
                                        if (base64 && (base64.includes('UEsDBBQ') || base64.includes('AQAAIAQAABMAA') || base64.includes('0M8R4KGx'))) {
                                            if (!mimeType || mimeType === 'application/pdf' || mimeType === 'application/octet-stream') {
                                                mimeType = base64.includes('0M8R4KGx') ? 'application/msword' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                                            }
                                        } else if (!mimeType) {
                                            mimeType = 'application/pdf';
                                        }

                                        if (!url && !base64) {
                                            return showAlert("CV no disponible", "Este candidato no tiene un archivo adjunto. Puede ser de LinkedIn, Excel, o el archivo aún no terminó de sincronizarse.");
                                        }

                                        if (url) {
                                            if (Platform.OS === 'web') {
                                                window.open(url, '_blank');
                                            } else {
                                                Linking.openURL(url);
                                            }
                                        } else if (base64) {
                                            const rawBase64 = base64.startsWith('data:') ? base64.split(',')[1] : base64;
                                            const dataUri = `data:${mimeType};base64,${rawBase64}`;
                                            
                                            if (Platform.OS === 'web') {
                                                // Para Word, forzamos descarga ya que el navegador no puede previsualizarlo nativamente
                                                if (mimeType.includes('word') || mimeType.includes('officedocument') || mimeType.includes('msword')) {
                                                    const link = document.createElement('a');
                                                    link.href = dataUri;
                                                    link.download = `${selectedCandidate.name || 'CV'}${mimeType.includes('wordprocessingml') ? '.docx' : '.doc'}`;
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                } else {
                                                    window.open(dataUri, '_blank');
                                                }
                                            } else {
                                                Linking.openURL(dataUri);
                                            }
                                        }
                                    }}
                                >
                                    <FileText size={40} color="white" />
                                    <View>
                                        <Text style={styles.cvBigTitle}>Ver Documento Original</Text>
                                        <Text style={styles.cvBigSub}>{(selectedCandidate.originalFileUrl || (selectedCandidate as any).cvUrl || (selectedCandidate as any).cv_url) ? 'Haga clic para descargar/abrir' : 'Solo datos capturados (LinkedIn/Excel)'}</Text>

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

                        <TouchableOpacity style={styles.dropzone} onPress={handleUploadExcel} disabled={processing}>
                            <Upload size={32} color="#10b981" style={{ marginBottom: 10 }} />
                            <Text style={styles.dropzoneTitle}>Haz clic para seleccionar tu Base de Datos</Text>
                            <Text style={styles.dropzoneSubtitle}>Soporta .xlsx y .csv</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* PROCESSING OVERLAY (Modal to show above other modals) */}
            <Modal transparent visible={processing} animationType="fade">
                <View style={[styles.processingOverlay, { backgroundColor: 'rgba(255, 255, 255, 0.8)' }]}>
                    <View style={styles.processingCard}>
                        <ActivityIndicator size="large" color="#3b82f6" />
                        <Text style={styles.processingTitle}>Procesando Candidatos</Text>
                        <Text style={styles.processingText}>{processingStatus}</Text>
                        <Text style={{ color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 10 }}>
                            Por favor espera unos segundos...
                        </Text>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF'
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingHorizontal: 20,
        paddingBottom: 15,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#FFFFFF'
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
        color: '#111827'
    },
    tabsContainer: {
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF'
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
        borderBottomColor: '#4F46E5'
    },
    mainTabText: {
        color: '#6B7280',
        fontSize: 16,
        fontWeight: '600'
    },
    mainTabTextActive: {
        color: '#111827'
    },
    countBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 20,
        alignItems: 'center'
    },
    countBadgeText: {
        color: '#111827',
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
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    processingCard: {
        backgroundColor: '#FFFFFF',
        padding: 30,
        borderRadius: 24,
        alignItems: 'center',
        width: '100%',
        maxWidth: 320,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10
    },
    processingTitle: {
        color: '#1E293B',
        fontSize: 18,
        fontWeight: '900',
        marginTop: 15,
        marginBottom: 8
    },
    processingText: {
        color: '#3b82f6',
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 15
    },
    processingWarning: {
        color: '#94a3b8',
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
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
        shadowColor: '#111827',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    candidateCardSelected: {
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79, 70, 229, 0.05)'
    },
    cardContent: {
        padding: 16,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    progressContainer: {
        marginRight: 12,
        position: 'relative'
    },
    validationSeal: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 2,
    },
    cardInfo: {
        flex: 1,
    },
    candidateName: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 4,
        letterSpacing: -0.3
    },
    candidateSalary: {
        fontSize: 13,
        color: '#059669',
        fontWeight: '600',
        marginBottom: 2
    },
    candidateDate: {
        fontSize: 12,
        color: '#6B7280',
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
        gap: 8,
        flexWrap: 'wrap',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
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
        color: '#111827',
        marginTop: 16
    },
    emptySubtext: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center'
    },
    kanbanColumn: {
        width: 300,
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        padding: 12,
        height: '100%',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginRight: 16
    },
    kanbanHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 12,
        marginBottom: 12,
        borderTopWidth: 4,
        borderTopColor: '#4F46E5',
        paddingTop: 10,
    },
    kanbanTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: 0.5
    },
    kanbanBadge: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB'
    },
    kanbanBadgeText: {
        color: '#6B7280',
        fontSize: 12,
        fontWeight: 'bold'
    },
    kanbanCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        elevation: 2,
        shadowColor: '#111827',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        marginBottom: 10
    },
    kanbanCardName: {
        fontSize: 14,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 4
    },
    kanbanCardSalary: {
        fontSize: 11,
        color: '#059669',
        fontWeight: '700'
    },
    kanbanCardDate: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 4,
        textAlign: 'right'
    },
    kanbanEmpty: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#E5E7EB',
        borderRadius: 12,
        height: 80,
        backgroundColor: 'rgba(255,255,255,0.3)'
    },
    kanbanEmptyText: {
        color: '#9CA3AF',
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
        backgroundColor: '#F8FAFC'
    },
    modalContent: {
        flex: 1
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0'
    },
    modalBackButton: {
        marginRight: 15,
        padding: 5
    },
    modalName: {
        fontSize: 24,
        fontWeight: '900',
        color: '#1E293B'
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
        paddingVertical: 30,
        backgroundColor: 'white'
    },
    matchLabel: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '600',
        marginTop: 12,
        letterSpacing: 2,
        textTransform: 'uppercase'
    },
    aiCard: {
        margin: 20,
        marginTop: 10,
        backgroundColor: 'rgba(251, 191, 36, 0.05)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.2)'
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
        color: '#475569',
        lineHeight: 24,
        marginBottom: 16
    },
    subsectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748B',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    proText: {
        fontSize: 14,
        color: '#059669',
        marginBottom: 4,
        lineHeight: 20
    },
    conText: {
        fontSize: 14,
        color: '#D97706',
        marginBottom: 4,
        lineHeight: 20
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E293B',
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
        backgroundColor: 'white',
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    historyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B'
    },
    historyScore: {
        fontSize: 16,
        fontWeight: '800',
        color: '#4F46E5'
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
        color: '#1E293B',
        fontSize: 16,
        fontWeight: '800'
    },
    cvBigSub: {
        color: '#64748B',
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
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 24,
        width: '90%',
        maxWidth: 500,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10
    },
    excelModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    excelModalTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1E293B'
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
        color: '#0369A1',
        fontWeight: '700',
        fontSize: 14,
        marginBottom: 4
    },
    infoText: {
        color: '#475569',
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
        color: '#475569',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8
    },
    textInput: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        padding: 12,
        color: '#1E293B',
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
        color: '#1E293B',
        fontWeight: '700',
        fontSize: 16,
        marginBottom: 4,
        textAlign: 'center'
    },
    dropzoneSubtitle: {
        color: '#94a3b8',
        fontSize: 13,
        textAlign: 'center'
    },
    // Candidate Edit Form Styles
    editSection: {
        backgroundColor: 'white',
        padding: 20,
        marginHorizontal: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginTop: 10,
        marginBottom: 20
    },
    editSectionTitle: {
        color: '#1E293B',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 15
    },
    modalLabel: {
        color: '#64748B',
        fontSize: 13,
        fontWeight: 'bold',
        marginBottom: 6,
        marginTop: 10
    },
    modalInput: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        padding: 12,
        color: '#1E293B',
        fontSize: 14
    },
    saveEditBtn: {
        backgroundColor: '#3b82f6',
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 20
    },
    saveEditBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14
    }
});
