import { setStringAsync } from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { ArrowLeft, Check, Copy, FileText, Sparkles, Upload, Link as LinkIcon, DollarSign, Settings, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert as RNAlert, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../../../config/firebase';
import { extractTextFromDocument } from '../../../../utils/gemini';
import { analyzeJobPosting, extractJobData, optimizeJobDescription, validateDocumentType } from '../../../../utils/gemini-company';

const Alert = {
    alert: (title: string, message?: string, buttons?: any) => {
        if (Platform.OS === 'web') {
            if (buttons && buttons.length > 1) {
                const confirmBtn = buttons.find((b: any) => b.style === 'destructive' || b.text === 'Eliminar' || b.text === 'Sincronizar');
                const cancelBtn = buttons.find((b: any) => b.style === 'cancel' || b.text === 'Cancelar');
                const confirmed = window.confirm(`${title}\n\n${message || ''}`);
                if (confirmed) {
                    if (confirmBtn && typeof confirmBtn.onPress === 'function') {
                        confirmBtn.onPress();
                    }
                } else {
                    if (cancelBtn && typeof cancelBtn.onPress === 'function') {
                        cancelBtn.onPress();
                    }
                }
            } else {
                window.alert(`${title}${message ? '\n\n' + message : ''}`);
                if (buttons && buttons.length === 1) {
                    if (typeof buttons[0].onPress === 'function') {
                        buttons[0].onPress();
                    }
                }
            }
        } else {
            RNAlert.alert(title, message, buttons);
        }
    }
};

const LATAM_COUNTRIES = [
    { name: 'Perú', currency: 'S/' },
    { name: 'Colombia', currency: 'COP$' },
    { name: 'México', currency: 'MXN$' },
    { name: 'Chile', currency: 'CLP$' },
    { name: 'Argentina', currency: 'ARS$' },
    { name: 'Ecuador', currency: 'USD$' },
    { name: 'Bolivia', currency: 'Bs' },
    { name: 'Uruguay', currency: 'UYU$' },
    { name: 'Paraguay', currency: 'Gs' },
    { name: 'Panamá', currency: 'USD$' },
    { name: 'Costa Rica', currency: '₡' },
    { name: 'República Dominicana', currency: 'DOP$' },
    { name: 'El Salvador', currency: 'USD$' },
    { name: 'Guatemala', currency: 'Q' },
    { name: 'Honduras', currency: 'L' },
    { name: 'Nicaragua', currency: 'C$' }
];

export default function CreateJob() {
    const router = useRouter();
    const { id } = useLocalSearchParams(); // Si hay ID, es edición
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');

    // INPUTS
    const [rawText, setRawText] = useState('');
    const [fileName, setFileName] = useState('');
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);

    // DATA PROCESADA
    const [jobData, setJobData] = useState<any>({
        salaryBudget: '',
        salaryTolerance: '10', // Default 10%
        salaryToleranceDown: '10', // Default 10%
        isSalaryPublic: false,
        isExternal: false,
        killerQuestions: [],
        allowedCountries: ['Perú'],
        currency: 'S/'
    });
    const [optimizedDescription, setOptimizedDescription] = useState('');

    // SUGERENCIAS DE LA IA
    const [postingSuggestions, setPostingSuggestions] = useState<any>(null);

    // CONTEXTO DE LA EMPRESA
    const [companyContext, setCompanyContext] = useState<{
        nombreComercial: string;
        rubro: string;
        beneficios: string;
    } | null>(null);
    const [userData, setUserData] = useState<any>(null);
    const [isEmailVerified, setIsEmailVerified] = useState(true);
    const [isProfileSkipped, setIsProfileSkipped] = useState(false);

    // Limpiar estado cuando vuelves a "Nuevo Perfil" (sin ID)
    useFocusEffect(
        useCallback(() => {
            if (!id) {
                // Resetear todo el estado para un nuevo perfil
                setStep(1);
                setRawText('');
                setFileName('');
                setJobData(null);
                setOptimizedDescription('');
                setLoading(false);
                console.log("🧽 Estado limpiado - Nuevo Perfil");
            }
        }, [id])
    );

    // Cargar datos si es Edición
    useEffect(() => {
        if (id) {
            loadJobData(id as string);
        }
    }, [id]);

    // Cargar contexto de la empresa al montar
    useEffect(() => {
        const loadCompanyContext = async () => {
            if (!auth.currentUser) return;
            try {
                const docRef = doc(db, 'users_empresas', auth.currentUser.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    let subscription = data.subscription || { plan: 'beta_free' };
                    
                    // [FIX] Query by 'id' field instead of Doc ID
                    try {
                        const planId = (subscription.plan || 'beta_free').toLowerCase().replace(' ', '_');
                        const plansRef = collection(db, 'config_plans');
                        const qPlan = query(plansRef, where('id', '==', planId));
                        const planSnap = await getDocs(qPlan);
                        
                        if (!planSnap.empty) {
                            const planData = planSnap.docs[0].data();
                            subscription = {
                                ...subscription,
                                internalVacanciesLimit: planData.internalVacanciesLimit ?? subscription.internalVacanciesLimit,
                                publicVacanciesLimit: planData.publicVacanciesLimit ?? subscription.publicVacanciesLimit,
                                killerQuestionsLimit: planData.killerQuestionsLimit ?? subscription.killerQuestionsLimit,
                                aiAnalysisLimit: planData.aiAnalysisLimit ?? subscription.aiAnalysisLimit
                            };
                        }
                    } catch (planErr) {
                        console.error("Error syncing plan limits:", planErr);
                    }

                    setUserData({ ...data, subscription });
                    setCompanyContext({
                        nombreComercial: data.company?.name || data.nombreComercial || '', 
                        rubro: data.aiContext?.rubro || '',
                        beneficios: data.aiContext?.beneficios || ''
                    });
                    
                    setIsProfileSkipped(!!data.profileSkipped);
                    if (auth.currentUser) {
                        try {
                            await auth.currentUser.reload();
                            setIsEmailVerified(auth.currentUser.emailVerified);
                        } catch (reloadErr) {
                            console.log("Error reloading user in job creation:", reloadErr);
                            setIsEmailVerified(auth.currentUser.emailVerified);
                        }
                    }
                    console.log("📊 Contexto y Límites de Plan sincronizados");
                }
            } catch (e) {
                console.error("Error cargando contexto empresa:", e);
            }
        };
        loadCompanyContext();
    }, [auth.currentUser]);

    const loadJobData = async (jobId: string | string[]) => {
        setInitializing(true);
        // Safety timeout
        const timer = setTimeout(() => {
            setInitializing(false);
            Alert.alert("Tiempo de espera", "La carga del perfil tardó demasiado. Intenta nuevamente.");
        }, 8000);

        try {
            const actualId = Array.isArray(jobId) ? jobId[0] : jobId;
            console.log("Loading job:", actualId);
            const docRef = doc(db, 'jobs', actualId);
            const docSnap = await getDoc(docRef);

            clearTimeout(timer); // Clear timeout on success/fail

            if (docSnap.exists()) {
                const data = docSnap.data();
                setJobData({
                    ...data,
                    salaryBudget: data.salaryBudget?.toString() || '',
                    salaryTolerance: data.salaryTolerance?.toString() || '10',
                    salaryToleranceDown: data.salaryToleranceDown?.toString() || '10',
                    isSalaryPublic: data.isSalaryPublic || false,
                    isExternal: data.isExternal || false,
                    killerQuestions: data.killerQuestions || [],
                    allowedCountries: data.allowedCountries || ['Perú'],
                    currency: data.currency || 'S/'
                });
                setOptimizedDescription(data.optimizedText || '');
                setRawText(data.originalText || '');
                setStep(2); // Ir directo a edición
            } else {
                Alert.alert("Error", "No se encontró el puesto.");
                router.back();
            }
        } catch (error) {
            console.error("Load error:", error);
            Alert.alert("Error", "No se pudo cargar el puesto.");
        } finally {
            clearTimeout(timer);
            setInitializing(false);
        }
    };

    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
                copyToCacheDirectory: true
            });

            if (result.canceled) return;
            const file = result.assets[0];
            setFileName(file.name);
            console.log("Archivo seleccionado:", file.name, "MIME:", file.mimeType);

            setLoading(true);
            try {
                console.log("Iniciando extracción de texto...");
                // Leemos el texto del PDF/Doc usando la misma utilidad que en Candidatos
                const webFile = Platform.OS === 'web' ? (file as any).file : undefined;
                const text = await extractTextFromDocument(file.uri, file.mimeType || 'application/pdf', webFile);
                console.log("Texto extraído. Longitud:", text?.length);
                setRawText(text); // Llenamos el rawText con lo extraído
                Alert.alert("Archivo Leído", `El contenido se ha cargado (${text?.length} caracteres). Ahora presiona "ANALIZAR CON IA".`);
            } catch (e: any) {
                console.error("Error en extracción:", e);
                Alert.alert("Error Lectura", e.message);
            } finally {
                setLoading(false);
            }
        } catch (e) {
            console.error("Error en selección:", e);
            Alert.alert("Error", "No se pudo seleccionar el archivo");
        }
    };

    const handleProcessAI = async () => {
        console.log("🔵 BOTÓN PRESIONADO - Raw Text Length:", rawText?.length);

        if (!rawText || rawText.length < 20) {
            console.warn("⚠️ Texto insuficiente");
            return Alert.alert("Texto Insuficiente", "Por favor ingresa más detalles o sube un documento válido.");
        }

        setLoading(true);
        setLoadingMessage("Validando tipo de documento...");

        try {
            // 1. VALIDAR TIPO DE DOCUMENTO
            console.log("🔍 Validando tipo de documento...");
            const validation = await validateDocumentType(rawText);
            console.log("📄 Tipo detectado:", validation.detectedType, "Confianza:", validation.confidence);

            if (!validation.isJobProfile) {
                setLoading(false);
                const typeLabels: Record<string, string> = {
                    'cv': 'un CV o Hoja de Vida',
                    'contract': 'un Contrato',
                    'policy': 'una Política de Empresa',
                    'other': 'otro tipo de documento'
                };
                const detectedLabel = typeLabels[validation.detectedType] || 'un documento no reconocido';

                return Alert.alert(
                    "⚠️ Documento Incorrecto",
                    `El documento parece ser ${detectedLabel}, no un Perfil de Puesto.\n\nPor favor sube una descripción de cargo con requisitos, responsabilidades y habilidades.`,
                    [{ text: "Entendido" }]
                );
            }

            // 2. PROCESAR CON IA
            setLoadingMessage("Creando anuncio de trabajo con IA...");
            console.log("📡 Llamando a extractJobData y optimizeJobDescription...");

            const [extracted, optimized] = await Promise.all([
                extractJobData(rawText),
                optimizeJobDescription(rawText, companyContext || undefined)
            ]);

            console.log("✅ Procesamiento completado. Datos extraídos:", extracted);

            if (!extracted) {
                throw new Error("La IA no devolvió datos estructurados.");
            }

            setJobData({
                ...jobData, // Preserve manually set fields if any, or default ones
                ...extracted
            });
            setOptimizedDescription(optimized);
            setStep(2);

            Alert.alert(
                "¡Anuncio Creado!",
                "La IA ha estructurado y formateado tu anuncio de trabajo con éxito. Confirma los datos a continuación."
            );

        } catch (e: any) {
            console.error("❌ Error en handleProcessAI:", e);
            Alert.alert("Error de Proceso", `Ocurrió un error: ${e?.message || JSON.stringify(e)}`);
        } finally {
            setLoading(false);
            setLoadingMessage("");
        }
    };

    const handleSave = async () => {
        if (!auth.currentUser || !jobData) return;
        console.log("💾 Iniciando guardado de puesto...");
        setLoading(true);
        try {
            // Convierte salario y tolerancia a números antes de guardar
            const finalData = {
                ...jobData,
                salaryBudget: Number(jobData.salaryBudget) || 0,
                salaryTolerance: Number(jobData.salaryTolerance) || 0,
                salaryToleranceDown: Number(jobData.salaryToleranceDown) || 0,
                isSalaryPublic: !!jobData.isSalaryPublic,
                killerQuestions: (jobData.killerQuestions || []).filter((q: any) => q.question?.trim().length > 0),
                isExternal: !!jobData.isExternal,
                originalText: rawText,
                optimizedText: optimizedDescription,
                companyId: auth.currentUser.uid,
                updatedAt: new Date().toISOString(),
                // Si es nuevo: createdAt, status, active
                ...(!id && {
                    createdAt: new Date().toISOString(),
                    status: 'Open',
                    active: true
                })
            };

            if (id) {
                // EDITAR
                await updateDoc(doc(db, 'jobs', id as string), finalData);
                Alert.alert("¡Éxito!", "Los cambios han sido guardados correctamente.");
                setTimeout(() => {
                    router.push('/empresa/dashboard/puestos');
                }, 1500);
            } else {
                // CREAR
                // Validar Límite de Vacantes Activas
                const jobsQ = query(
                    collection(db, 'jobs'), 
                    where('companyId', '==', auth.currentUser.uid)
                );
                const jobsSnap = await getDocs(jobsQ);
                
                const userSnap = await getDoc(doc(db, 'users_empresas', auth.currentUser.uid));
                const userData = userSnap.data();
                const limit = userData?.subscription?.internalVacanciesLimit || 10; 

                if (jobsSnap.size >= limit) {
                    throw new Error(`Has alcanzado el límite de vacantes activas para tu plan (${limit}). Pasa a PRO o cierra una vacante existente para publicar más.`);
                }

                const newDoc = await addDoc(collection(db, 'jobs'), finalData);
                Alert.alert("¡Éxito!", "Vacante publicada con éxito.");
                setTimeout(() => {
                    router.push('/empresa/dashboard/puestos');
                }, 1500);
            }
            console.log("✅ Proceso de guardado finalizado con éxito");
        } catch (e: any) {
            console.error("❌ Error al guardar puesto:", e);
            Alert.alert("Error al guardar", e.message || "Ocurrió un error inesperado al guardar la vacante.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => step === 1 ? router.back() : setStep(1)} style={styles.backButton}>
                    <ArrowLeft color="#111827" size={24} />
                </TouchableOpacity>
                <Text style={styles.title}>
                    {step === 1 ? (id ? "Reiniciar Edición" : "Nuevo Perfil") : (id ? "Editar Perfil" : "Confirmar Datos")}
                </Text>
                <View style={{ width: 24 }} />
            </View>

            {initializing ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#38bdf8" />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    {step === 1 ? (
                        <>
                            <Text style={styles.subtitle}>¿Cómo quieres crear el puesto?</Text>

                            {/* OPCIÓN 1: SUBIR DOCUMENTO */}
                            <TouchableOpacity style={styles.uploadCard} onPress={handlePickDocument}>
                                <Upload color="#4F46E5" size={30} />
                                <Text style={{ color: '#111827', marginTop: 10, fontWeight: 'bold' }}>
                                    {fileName ? `Archivo: ${fileName}` : "Subir PDF o Word"}
                                </Text>
                                <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 5 }}>La IA extraerá el texto automáticamente</Text>
                            </TouchableOpacity>

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
                                <View style={{ flex: 1, height: 1, backgroundColor: '#334155' }} />
                                <Text style={{ color: '#64748b', marginHorizontal: 10 }}>O escribe manualmente</Text>
                                <View style={{ flex: 1, height: 1, backgroundColor: '#334155' }} />
                            </View>

                            {/* OPCIÓN 2: PEGAR TEXTO */}
                            <View style={styles.inputCard}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <FileText color="#94a3b8" size={20} />
                                        <Text style={styles.cardTitle}>Descripción del Puesto</Text>
                                    </View>
                                    {rawText && rawText.length > 0 && (
                                        <TouchableOpacity onPress={async () => {
                                            await setStringAsync(rawText);
                                            Alert.alert("Texto copiado", "El contenido se ha copiado al portapapeles.");
                                        }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Copy size={16} color="#38bdf8" />
                                                <Text style={{ color: '#38bdf8', marginLeft: 5, fontSize: 12, fontWeight: 'bold' }}>COPIAR</Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <TextInput
                                    style={styles.textArea}
                                    placeholder="Escribe o pega aquí los requisitos..."
                                    placeholderTextColor="#64748b"
                                    multiline
                                    value={rawText}
                                    onChangeText={setRawText}
                                    textAlignVertical="top"
                                />
                            </View>

                            <TouchableOpacity style={[styles.processButton, loading && { backgroundColor: '#1e293b' }]} onPress={handleProcessAI} disabled={loading}>
                                {loading ? (
                                    <View style={{ alignItems: 'center' }}>
                                        <ActivityIndicator color="#38bdf8" />
                                        <Text style={{ color: '#94a3b8', marginTop: 8, fontSize: 12 }}>{loadingMessage || 'Procesando...'}</Text>
                                    </View>
                                ) : (
                                    <><Text style={styles.buttonText}>CREAR ANUNCIO CON IA</Text><Sparkles color="white" size={20} style={{ marginLeft: 10 }} /></>
                                )}
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            {/* El análisis y feedback lento han sido removidos por solicitud del usuario */}

                            <View style={styles.resultCard}>
                                <Text style={styles.label}>TÍTULO DETECTADO</Text>
                                <TextInput
                                    style={styles.input}
                                    value={jobData?.jobTitle}
                                    onChangeText={(t) => setJobData({ ...jobData, jobTitle: t })}
                                />

                                <Text style={styles.label}>EXPERIENCIA</Text>
                                <TextInput
                                    style={styles.input}
                                    value={jobData?.requiredExperience}
                                    onChangeText={(t) => setJobData({ ...jobData, requiredExperience: t })}
                                />

                                <Text style={styles.label}>H SKILLS (Verifica)</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                                    {jobData?.hardSkills?.map((skill: string, i: number) => (
                                        <View key={i} style={styles.tag}><Text style={styles.tagText}>{skill}</Text></View>
                                    ))}
                                </View>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 }}>
                                    <Text style={styles.label}>DESCRIPCIÓN OPTIMIZADA (Editable)</Text>
                                    <TouchableOpacity onPress={async () => {
                                        await setStringAsync(optimizedDescription);
                                        Alert.alert("Texto copiado", "La descripción optimizada se ha copiado al portapapeles.");
                                    }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Copy size={16} color="#38bdf8" />
                                            <Text style={{ color: '#38bdf8', marginLeft: 5, fontSize: 12, fontWeight: 'bold' }}>COPIAR</Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                                <TextInput
                                    style={styles.optimizedInput}
                                    value={optimizedDescription}
                                    onChangeText={setOptimizedDescription}
                                    multiline
                                    scrollEnabled={false} // Expands with content
                                />

                                {/* --- GESTIÓN DE POSTULACIÓN --- */}
                                <View style={{ marginTop: 30, padding: 20, backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#3b82f6' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                                        <Settings color="#38bdf8" size={20} />
                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16, marginLeft: 10 }}>Configuración de Recepción</Text>
                                    </View>

                                    <TouchableOpacity 
                                        style={[styles.switchContainer, jobData?.isExternal && styles.switchContainerActive]}
                                        onPress={() => {
                                            if ((!isEmailVerified && auth.currentUser?.email !== 'oscar@veritlyapp.com') || isProfileSkipped) {
                                                return Alert.alert(
                                                    "🔐 Acceso Protegido",
                                                    "Para habilitar el enlace público de postulación, por seguridad debes verificar tu correo electrónico y completar tu perfil corporativo."
                                                );
                                            }
                                            setJobData({ ...jobData, isExternal: !jobData?.isExternal });
                                        }}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: 'white', fontWeight: 'bold' }}>Habilitar Link de Postulación</Text>
                                            <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Creará un formulario web para que los candidatos postulen directamente a Veritly.</Text>
                                        </View>
                                        <View style={[styles.switchToggle, jobData?.isExternal ? { backgroundColor: '#3b82f6', alignItems: 'flex-end' } : { backgroundColor: '#334155', alignItems: 'flex-start' }]}>
                                            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'white' }} />
                                        </View>
                                    </TouchableOpacity>

                                    {jobData?.isExternal && (
                                        <View style={{ marginTop: 20, backgroundColor: '#1e293b', padding: 15, borderRadius: 8 }}>
                                            
                                            {/* --- FILTRO POR PAÍSES --- */}
                                            <View style={{ marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 20 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                                    <LinkIcon color="#38bdf8" size={18} />
                                                    <Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 5 }}>Países de Selección</Text>
                                                </View>
                                                <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 15 }}>
                                                    Selecciona uno o más países de residencia válidos para la postulación. Si el candidato vive en otro país, será descartado automáticamente.
                                                </Text>

                                                {/* Selector de Países Desplegable */}
                                                <TouchableOpacity 
                                                    style={{ 
                                                        flexDirection: 'row', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'space-between', 
                                                        backgroundColor: '#0f172a', 
                                                        borderWidth: 1, 
                                                        borderColor: '#334155', 
                                                        padding: 12, 
                                                        borderRadius: 8,
                                                        marginBottom: 10
                                                    }}
                                                    onPress={() => setShowCountryDropdown(!showCountryDropdown)}
                                                >
                                                    <Text style={{ color: '#94a3b8', fontSize: 14 }}>
                                                        {jobData.allowedCountries?.length > 0 
                                                            ? `${jobData.allowedCountries.length} país(es) seleccionado(s)` 
                                                            : 'Seleccionar países...'}
                                                    </Text>
                                                    <Text style={{ color: '#38bdf8', fontSize: 13, fontWeight: 'bold' }}>
                                                        {showCountryDropdown ? '▲ Cerrar' : '▼ Seleccionar'}
                                                    </Text>
                                                </TouchableOpacity>

                                                {/* Desplegable */}
                                                {showCountryDropdown && (
                                                    <View style={{ 
                                                        maxHeight: 200, 
                                                        backgroundColor: '#0f172a', 
                                                        borderWidth: 1, 
                                                        borderColor: '#334155', 
                                                        borderRadius: 8, 
                                                        padding: 8,
                                                        marginBottom: 15
                                                    }}>
                                                        <ScrollView nestedScrollEnabled style={{ flex: 1 }}>
                                                            {LATAM_COUNTRIES.map((c) => {
                                                                const isSelected = jobData.allowedCountries?.includes(c.name);
                                                                return (
                                                                    <TouchableOpacity
                                                                        key={c.name}
                                                                        style={{
                                                                            flexDirection: 'row',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'space-between',
                                                                            paddingVertical: 10,
                                                                            paddingHorizontal: 12,
                                                                            borderRadius: 6,
                                                                            backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'transparent'
                                                                        }}
                                                                        onPress={() => {
                                                                            let countries = [...(jobData.allowedCountries || [])];
                                                                            if (countries.includes(c.name)) {
                                                                                if (countries.length === 1) {
                                                                                    Alert.alert("Requisito", "Debes seleccionar al menos un país.");
                                                                                    return;
                                                                                }
                                                                                countries = countries.filter(name => name !== c.name);
                                                                            } else {
                                                                                countries.push(c.name);
                                                                            }
                                                                            
                                                                            // Calcular moneda
                                                                            let newCurrency = 'S/';
                                                                            if (countries.length === 1) {
                                                                                const found = LATAM_COUNTRIES.find(x => x.name === countries[0]);
                                                                                newCurrency = found ? found.currency : 'S/';
                                                                            } else if (countries.length > 1) {
                                                                                newCurrency = 'USD$';
                                                                            }

                                                                            setJobData({
                                                                                ...jobData,
                                                                                allowedCountries: countries,
                                                                                currency: newCurrency
                                                                            });
                                                                        }}
                                                                    >
                                                                        <Text style={{ color: isSelected ? '#38bdf8' : '#94a3b8', fontSize: 13 }}>
                                                                            {c.name}
                                                                        </Text>
                                                                        {isSelected && <Check size={14} color="#38bdf8" />}
                                                                    </TouchableOpacity>
                                                                );
                                                            })}
                                                        </ScrollView>
                                                    </View>
                                                )}

                                                {/* Chips de Países Seleccionados */}
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                                    {jobData.allowedCountries?.map((countryName: string) => (
                                                        <View 
                                                            key={countryName}
                                                            style={{ 
                                                                flexDirection: 'row', 
                                                                alignItems: 'center', 
                                                                backgroundColor: 'rgba(56, 189, 248, 0.1)', 
                                                                borderWidth: 1, 
                                                                borderColor: '#38bdf8', 
                                                                paddingVertical: 4, 
                                                                paddingHorizontal: 10, 
                                                                borderRadius: 16,
                                                                gap: 6
                                                            }}
                                                        >
                                                            <Text style={{ color: '#38bdf8', fontSize: 12, fontWeight: 'bold' }}>{countryName}</Text>
                                                            <TouchableOpacity 
                                                                onPress={() => {
                                                                    let countries = [...(jobData.allowedCountries || [])];
                                                                    if (countries.length === 1) {
                                                                        Alert.alert("Requisito", "Debes seleccionar al menos un país.");
                                                                        return;
                                                                    }
                                                                    countries = countries.filter(name => name !== countryName);

                                                                    let newCurrency = 'S/';
                                                                    if (countries.length === 1) {
                                                                        const found = LATAM_COUNTRIES.find(x => x.name === countries[0]);
                                                                        newCurrency = found ? found.currency : 'S/';
                                                                    } else if (countries.length > 1) {
                                                                        newCurrency = 'USD$';
                                                                    }

                                                                    setJobData({
                                                                        ...jobData,
                                                                        allowedCountries: countries,
                                                                        currency: newCurrency
                                                                    });
                                                                }}
                                                            >
                                                                <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: 'bold', paddingHorizontal: 2 }}>×</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                                <DollarSign color="#10b981" size={18} />
                                                <Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 5 }}>Filtro Salarial Automático</Text>
                                            </View>
                                            <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 15 }}>
                                                Los candidatos cuya expectativa supere el presupuesto + tolerancia, serán movidos a "Descartados" automáticamente sin consumir créditos de IA.
                                            </Text>

                                            <TouchableOpacity 
                                                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}
                                                onPress={() => setJobData({ ...jobData, isSalaryPublic: !jobData.isSalaryPublic })}
                                            >
                                                <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#3b82f6', backgroundColor: jobData.isSalaryPublic ? '#3b82f6' : 'transparent', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                                                    {jobData.isSalaryPublic && <Check size={14} color="white" />}
                                                </View>
                                                <Text style={{ color: 'white', fontSize: 13 }}>Mostrar rango de sueldo al candidato (Público)</Text>
                                            </TouchableOpacity>

                                            <View style={{ flexDirection: 'row', gap: 15, marginBottom: 15 }}>
                                                <View style={{ flex: 2 }}>
                                                    <Text style={styles.label}>PRESUPUESTO ({jobData.currency || 'S/'})</Text>
                                                    <TextInput
                                                        style={styles.input}
                                                        placeholder="Ej. 3500"
                                                        placeholderTextColor="#475569"
                                                        keyboardType="numeric"
                                                        value={jobData?.salaryBudget}
                                                        onChangeText={(t) => setJobData({ ...jobData, salaryBudget: t })}
                                                    />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.label}>TOLERANCIA ARRIBA (%)</Text>
                                                    <TextInput
                                                        style={styles.input}
                                                        placeholder="10"
                                                        placeholderTextColor="#475569"
                                                        keyboardType="numeric"
                                                        value={jobData?.salaryTolerance}
                                                        onChangeText={(t) => setJobData({ ...jobData, salaryTolerance: t })}
                                                    />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.label}>TOLERANCIA ABAJO (%)</Text>
                                                    <TextInput
                                                        style={styles.input}
                                                        placeholder="10"
                                                        placeholderTextColor="#475569"
                                                        keyboardType="numeric"
                                                        value={jobData?.salaryToleranceDown}
                                                        onChangeText={(t) => setJobData({ ...jobData, salaryToleranceDown: t })}
                                                    />
                                                </View>
                                            </View>
                                            
                                             {Number(jobData?.salaryBudget) > 0 && (
                                                <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 10, borderRadius: 8 }}>
                                                    <Text style={{ color: '#10b981', fontSize: 12, fontWeight: 'bold' }}>
                                                        Rango aceptado: {jobData.currency || 'S/'} {Math.round(Number(jobData.salaryBudget) * (1 - Number(jobData.salaryToleranceDown || 0) / 100)).toLocaleString()} - {jobData.currency || 'S/'} {Math.round(Number(jobData.salaryBudget) * (1 + Number(jobData.salaryTolerance || 0) / 100)).toLocaleString()}
                                                    </Text>
                                                    <Text style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>
                                                        Candidatos fuera de este rango serán descartados automáticamente.
                                                    </Text>
                                                </View>
                                            )}

                                            {/* --- KILLER QUESTIONS --- */}
                                            <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 15 }}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>Preguntas Filtro (Máx {userData?.subscription?.killerQuestionsLimit || 3})</Text>
                                                        <Text style={{ color: '#94a3b8', fontSize: 11 }}>Preguntas Sí/No que descartan automáticamente.</Text>
                                                    </View>
                                                    {(jobData?.killerQuestions?.length || 0) < (userData?.subscription?.killerQuestionsLimit || 3) && (
                                                        <TouchableOpacity 
                                                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#3b82f6' }}
                                                            onPress={() => {
                                                                const newQs = [...(jobData?.killerQuestions || [])];
                                                                newQs.push({ question: '', expectedAnswer: 'si' });
                                                                setJobData({ ...jobData, killerQuestions: newQs });
                                                            }}
                                                        >
                                                            <Plus size={14} color="#3b82f6" />
                                                            <Text style={{ color: '#3b82f6', fontSize: 11, fontWeight: 'bold', marginLeft: 4 }}>AÑADIR</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                                
                                                {jobData?.killerQuestions?.map((q: any, idx: number) => {
                                                    return (
                                                        <View key={idx} style={{ marginBottom: 15, padding: 15, backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#1e293b' }}>
                                                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                                                                <TextInput
                                                                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                                                    placeholder={`Escribe la pregunta filtro...`}
                                                                    placeholderTextColor="#475569"
                                                                    value={q.question}
                                                                    onChangeText={(t) => {
                                                                        const newQs = [...(jobData?.killerQuestions || [])];
                                                                        newQs[idx] = { ...q, question: t };
                                                                        setJobData({ ...jobData, killerQuestions: newQs });
                                                                    }}
                                                                />
                                                                <TouchableOpacity 
                                                                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', width: 45, height: 45, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                                                    onPress={() => {
                                                                        const newQs = (jobData?.killerQuestions || []).filter((_: any, i: number) => i !== idx);
                                                                        setJobData({ ...jobData, killerQuestions: newQs });
                                                                    }}
                                                                >
                                                                    <Trash2 size={18} color="#ef4444" />
                                                                </TouchableOpacity>
                                                            </View>

                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                                <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '500' }}>Respuesta que APRUEBA:</Text>
                                                                <View style={{ flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 20, padding: 3 }}>
                                                                    <TouchableOpacity 
                                                                        style={[styles.answerToggle, q.expectedAnswer === 'si' && styles.answerToggleActive]}
                                                                        onPress={() => {
                                                                            const newQs = [...(jobData?.killerQuestions || [])];
                                                                            newQs[idx] = { ...q, expectedAnswer: 'si' };
                                                                            setJobData({ ...jobData, killerQuestions: newQs });
                                                                        }}
                                                                    >
                                                                        <Text style={[styles.answerToggleText, q.expectedAnswer === 'si' && styles.answerToggleTextActive]}>SÍ</Text>
                                                                    </TouchableOpacity>
                                                                    <TouchableOpacity 
                                                                        style={[styles.answerToggle, q.expectedAnswer === 'no' && styles.answerToggleActive]}
                                                                        onPress={() => {
                                                                            const newQs = [...(jobData?.killerQuestions || [])];
                                                                            newQs[idx] = { ...q, expectedAnswer: 'no' };
                                                                            setJobData({ ...jobData, killerQuestions: newQs });
                                                                        }}
                                                                    >
                                                                        <Text style={[styles.answerToggleText, q.expectedAnswer === 'no' && styles.answerToggleTextActive]}>NO</Text>
                                                                    </TouchableOpacity>
                                                                </View>
                                                            </View>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    )}
                                </View>
                            </View>

                            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
                                {loading ? <ActivityIndicator color="white" /> : (
                                    <><Text style={styles.buttonText}>GUARDAR PERFIL DE BÚSQUEDA</Text><Check color="white" size={20} style={{ marginLeft: 10 }} /></>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
                </ScrollView>
            )
            }
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
    backButton: { padding: 5 },
    title: { color: '#111827', fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20 },
    subtitle: { color: '#6B7280', marginBottom: 20, textAlign: 'center' },
    inputCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#111827', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
    cardTitle: { color: '#111827', fontWeight: 'bold', marginLeft: 10 },
    textArea: { color: '#111827', height: 150, marginTop: 10, fontSize: 15 },
    uploadCard: { height: 120, borderWidth: 2, borderColor: '#4F46E5', borderStyle: 'dashed', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10, backgroundColor: 'rgba(79, 70, 229, 0.05)' },
    processButton: { backgroundColor: '#4F46E5', flexDirection: 'row', padding: 18, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    // Result Styles
    resultCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
    label: { color: '#6B7280', fontSize: 12, fontWeight: 'bold', marginBottom: 5, marginTop: 10 },
    input: { backgroundColor: '#F9FAFB', color: '#111827', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10 },
    tag: { backgroundColor: 'rgba(79, 70, 229, 0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
    tagText: { color: '#4F46E5', fontSize: 12 },
    optimizedInput: { backgroundColor: '#F9FAFB', color: '#374151', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', minHeight: 150, textAlignVertical: 'top', lineHeight: 22 },
    saveButton: { backgroundColor: '#059669', flexDirection: 'row', padding: 18, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 30, marginBottom: 50, elevation: 5, shadowColor: '#059669', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },

    // Styles for Suggestions Section
    suggestionsCard: { backgroundColor: 'rgba(245, 158, 11, 0.05)', borderWidth: 2, borderColor: '#F59E0B', borderRadius: 12, padding: 20, marginBottom: 20 },
    suggestionsTitle: { color: '#B45309', fontWeight: 'bold', fontSize: 16 },
    scoreBadge: { backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    scoreText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
    suggestionSubtitle: { color: '#6B7280', fontWeight: 'bold', fontSize: 13, marginBottom: 5 },
    strengthText: { color: '#059669', fontSize: 12, marginLeft: 10, marginBottom: 3 },
    weaknessText: { color: '#DC2626', fontSize: 12, marginLeft: 10, marginBottom: 3 },
    improvementText: { color: '#4F46E5', fontSize: 12, marginLeft: 10, marginBottom: 3 },
    keywordTag: { backgroundColor: '#4F46E5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
    keywordTagText: { color: 'white', fontSize: 11, fontWeight: 'bold' },
    switchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
    switchContainerActive: { borderColor: '#4F46E5', backgroundColor: 'rgba(79, 70, 229, 0.05)' },
    switchToggle: { width: 50, height: 28, borderRadius: 15, justifyContent: 'center', padding: 2 },
    answerToggle: { paddingHorizontal: 15, paddingVertical: 5, borderRadius: 15 },
    answerToggleActive: { backgroundColor: '#4F46E5' },
    answerToggleText: { color: '#9CA3AF', fontSize: 11, fontWeight: 'bold' },
    answerToggleTextActive: { color: 'white' }
});
