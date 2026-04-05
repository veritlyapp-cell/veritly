import { setStringAsync } from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Check, Copy, FileText, Sparkles, Upload, Link as LinkIcon, DollarSign, Settings } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../../../config/firebase';
import { extractTextFromDocument } from '../../../../utils/gemini';
import { analyzeJobPosting, extractJobData, optimizeJobDescription, validateDocumentType } from '../../../../utils/gemini-company';

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

    // DATA PROCESADA
    const [jobData, setJobData] = useState<any>({
        salaryBudget: '',
        salaryTolerance: '10', // Default 10%
        isExternal: false
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
                    setCompanyContext({
                        nombreComercial: data.company?.name || data.nombreComercial || '', // [FIX] Read from nested company.name
                        rubro: data.aiContext?.rubro || '',
                        beneficios: data.aiContext?.beneficios || ''
                    });
                    console.log("📊 Contexto empresa cargado:", data.nombreComercial, data.aiContext?.rubro);
                }
            } catch (e) {
                console.error("Error cargando contexto empresa:", e);
            }
        };
        loadCompanyContext();
    }, []);

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
                    isExternal: data.isExternal || false
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
            setLoadingMessage("Analizando perfil con IA...");
            console.log("📡 Llamando a extractJobData, optimizeJobDescription y analyzeJobPosting...");

            const [extracted, optimized, suggestions] = await Promise.all([
                extractJobData(rawText),
                optimizeJobDescription(rawText, companyContext || undefined),
                analyzeJobPosting(rawText)
            ]);

            console.log("✅ Análisis completado. Datos extraídos:", extracted);

            if (!extracted) {
                throw new Error("La IA no devolvió datos estructurados.");
            }

            setJobData({
                ...jobData, // Preserve manually set fields if any, or default ones
                ...extracted
            });
            setOptimizedDescription(optimized);
            setPostingSuggestions(suggestions);
            setStep(2);

            const scoreColor = suggestions.qualityScore >= 70 ? "✅" : suggestions.qualityScore >= 50 ? "⚠️" : "❌";
            Alert.alert(
                "¡Análisis Completado!",
                `${scoreColor} Score de Calidad: ${suggestions.qualityScore}/100\n\n💡 ${suggestions.mainAdvice}\n\nRevisa las sugerencias detalladas en pantalla.`
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
        setLoading(true);

        try {
            // Convierte salario y tolerancia a números antes de guardar
            const finalData = {
                ...jobData,
                salaryBudget: Number(jobData.salaryBudget) || 0,
                salaryTolerance: Number(jobData.salaryTolerance) || 0,
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
                Alert.alert("¡Actualizado!", "Los cambios han sido guardados.");
            } else {
                // CREAR
                await addDoc(collection(db, 'jobs'), finalData);
                Alert.alert("¡Perfil Guardado!", "Ahora puedes subir CVs para analizarlos contra este perfil.");
            }
            router.replace('/empresa/dashboard');
        } catch (e: any) {
            Alert.alert("Error al guardar", e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => step === 1 ? router.back() : setStep(1)} style={styles.backButton}>
                    <ArrowLeft color="white" size={24} />
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
                                <Upload color="#38bdf8" size={30} />
                                <Text style={{ color: 'white', marginTop: 10, fontWeight: 'bold' }}>
                                    {fileName ? `Archivo: ${fileName}` : "Subir PDF o Word"}
                                </Text>
                                <Text style={{ color: '#64748b', fontSize: 12, marginTop: 5 }}>La IA extraerá el texto automáticamente</Text>
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
                                            Alert.alert("¡Copiado!", "El texto se ha copiado al portapapeles.");
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
                                    <><Text style={styles.buttonText}>ANALIZAR CON IA</Text><Sparkles color="white" size={20} style={{ marginLeft: 10 }} /></>
                                )}
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            {/* SUGERENCIAS DE LA IA */}
                            {postingSuggestions && (
                                <View style={styles.suggestionsCard}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                        <Text style={styles.suggestionsTitle}>💡 Análisis de tu Publicación</Text>
                                        <View style={styles.scoreBadge}>
                                            <Text style={styles.scoreText}>{postingSuggestions.qualityScore}/100</Text>
                                        </View>
                                    </View>

                                    <Text style={{ color: '#38bdf8', fontStyle: 'italic', marginBottom: 15 }}>"{postingSuggestions.mainAdvice}"</Text>

                                    {postingSuggestions.strengths && postingSuggestions.strengths.length > 0 && (
                                        <View style={{ marginBottom: 12 }}>
                                            <Text style={styles.suggestionSubtitle}>✅ Puntos Fuertes:</Text>
                                            {postingSuggestions.strengths.map((strength: string, i: number) => (
                                                <Text key={i} style={styles.strengthText}>• {strength}</Text>
                                            ))}
                                        </View>
                                    )}

                                    {postingSuggestions.weaknesses && postingSuggestions.weaknesses.length > 0 && (
                                        <View style={{ marginBottom: 12 }}>
                                            <Text style={styles.suggestionSubtitle}>⚠️ Para Mejorar:</Text>
                                            {postingSuggestions.weaknesses.map((weakness: string, i: number) => (
                                                <Text key={i} style={styles.weaknessText}>• {weakness}</Text>
                                            ))}
                                        </View>
                                    )}

                                    {postingSuggestions.improvements && postingSuggestions.improvements.length > 0 && (
                                        <View style={{ marginBottom: 12 }}>
                                            <Text style={styles.suggestionSubtitle}>💡 Sugerencias:</Text>
                                            {postingSuggestions.improvements.map((improvement: string, i: number) => (
                                                <Text key={i} style={styles.improvementText}>• {improvement}</Text>
                                            ))}
                                        </View>
                                    )}

                                    {postingSuggestions.missingKeywords && postingSuggestions.missingKeywords.length > 0 && (
                                        <View>
                                            <Text style={styles.suggestionSubtitle}>🔑 Keywords Recomendadas:</Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                                                {postingSuggestions.missingKeywords.map((keyword: string, i: number) => (
                                                    <View key={i} style={styles.keywordTag}>
                                                        <Text style={styles.keywordTagText}>{keyword}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                </View>
                            )}

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
                                        Alert.alert("¡Copiado!", "La descripción se ha copiado al portapapeles.");
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
                                        onPress={() => setJobData({ ...jobData, isExternal: !jobData?.isExternal })}
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
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                                <DollarSign color="#10b981" size={18} />
                                                <Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 5 }}>Filtro Salarial Automático</Text>
                                            </View>
                                            <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 15 }}>
                                                Los candidatos cuya expectativa supere el presupuesto + tolerancia, serán movidos a "Descartados" automáticamente sin consumir créditos de IA.
                                            </Text>

                                            <View style={{ flexDirection: 'row', gap: 15 }}>
                                                <View style={{ flex: 2 }}>
                                                    <Text style={styles.label}>PRESUPUESTO MAX (S/)</Text>
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
                                                    <Text style={styles.label}>TOLERANCIA (%)</Text>
                                                    <TextInput
                                                        style={styles.input}
                                                        placeholder="10"
                                                        placeholderTextColor="#475569"
                                                        keyboardType="numeric"
                                                        value={jobData?.salaryTolerance}
                                                        onChangeText={(t) => setJobData({ ...jobData, salaryTolerance: t })}
                                                    />
                                                </View>
                                            </View>
                                            
                                             {Number(jobData?.salaryBudget) > 0 && (
                                                <Text style={{ color: '#10b981', fontSize: 12, marginTop: 5 }}>
                                                    El sistema aceptará expectativas hasta S/ {Math.round(Number(jobData.salaryBudget) * (1 + Number(jobData.salaryTolerance) / 100))}
                                                </Text>
                                            )}
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
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    backButton: { padding: 5 },
    title: { color: 'white', fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20 },
    subtitle: { color: '#94a3b8', marginBottom: 20, textAlign: 'center' },
    inputCard: { backgroundColor: '#1e293b', padding: 15, borderRadius: 12, marginBottom: 20 },
    cardTitle: { color: 'white', fontWeight: 'bold', marginLeft: 10 },
    textArea: { color: 'white', height: 150, marginTop: 10, fontSize: 15 },
    uploadCard: { height: 120, borderWidth: 2, borderColor: '#38bdf8', borderStyle: 'dashed', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10, backgroundColor: 'rgba(56, 189, 248, 0.1)' },
    processButton: { backgroundColor: '#3b82f6', flexDirection: 'row', padding: 18, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    // Result Styles
    resultCard: { backgroundColor: '#1e293b', padding: 20, borderRadius: 12, marginBottom: 20 },
    label: { color: '#64748b', fontSize: 12, fontWeight: 'bold', marginBottom: 5, marginTop: 10 },
    input: { backgroundColor: '#0f172a', color: 'white', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#334155', marginBottom: 10 },
    tag: { backgroundColor: 'rgba(56, 189, 248, 0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
    tagText: { color: '#38bdf8', fontSize: 12 },
    // Changed optimizedBox to optimizedInput, removed fixed height
    optimizedInput: { backgroundColor: '#0f172a', color: '#cbd5e1', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#334155', minHeight: 150, textAlignVertical: 'top', lineHeight: 22 },
    saveButton: { backgroundColor: '#10b981', flexDirection: 'row', padding: 18, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 30, marginBottom: 50, elevation: 5, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },

    // Styles for Suggestions Section
    suggestionsCard: { backgroundColor: 'rgba(251, 191, 36, 0.1)', borderWidth: 2, borderColor: '#f59e0b', borderRadius: 12, padding: 20, marginBottom: 20 },
    suggestionsTitle: { color: '#f59e0b', fontWeight: 'bold', fontSize: 16 },
    scoreBadge: { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    scoreText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
    suggestionSubtitle: { color: '#94a3b8', fontWeight: 'bold', fontSize: 13, marginBottom: 5 },
    strengthText: { color: '#10b981', fontSize: 12, marginLeft: 10, marginBottom: 3 },
    weaknessText: { color: '#ef4444', fontSize: 12, marginLeft: 10, marginBottom: 3 },
    improvementText: { color: '#38bdf8', fontSize: 12, marginLeft: 10, marginBottom: 3 },
    keywordTag: { backgroundColor: '#3b82f6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
    keywordTagText: { color: 'white', fontSize: 11, fontWeight: 'bold' },
    switchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
    switchContainerActive: { borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)' },
    switchToggle: { width: 50, height: 28, borderRadius: 15, justifyContent: 'center', padding: 2 }
});
