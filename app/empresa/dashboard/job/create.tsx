import { setStringAsync } from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Check, Copy, FileText, Sparkles, Upload } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../../../config/firebase';
import { extractTextFromDocument } from '../../../../utils/gemini';
import { extractJobData, optimizeJobDescription } from '../../../../utils/gemini-company';

export default function CreateJob() {
    const router = useRouter();
    const { id } = useLocalSearchParams(); // Si hay ID, es edición
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(false);

    // INPUTS
    const [rawText, setRawText] = useState('');
    const [fileName, setFileName] = useState('');

    // DATA PROCESADA
    const [jobData, setJobData] = useState<any>(null);
    const [optimizedDescription, setOptimizedDescription] = useState('');

    // SUGERENCIAS DE LA IA
    const [postingSuggestions, setPostingSuggestions] = useState<any>(null);

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
                setJobData(data);
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
        // DEBUG: Verificar texto
        console.log("🔵 BOTÓN PRESIONADO - Raw Text Length:", rawText?.length);

        if (!rawText || rawText.length < 20) {
            console.warn("⚠️ Texto insuficiente");
            return Alert.alert("Texto Insuficiente", "Por favor ingresa más detalles o sube un documento válido.");
        }

        console.log("✅ Texto válido, iniciando análisis...");
        Alert.alert("Procesando", "Analizando con IA, por favor espera...");
        setLoading(true);

        try {
            console.log("📡 Llamando a extractJobData, optimizeJobDescription y analyzeJobPosting...");
            const [extracted, optimized, suggestions] = await Promise.all([
                extractJobData(rawText),
                optimizeJobDescription(rawText),
                analyzeJobPosting(rawText)
            ]);

            console.log("✅ Análisis completado. Datos extraídos:", extracted);
            console.log("📝 Descripción optimizada length:", optimized?.length);
            console.log("💡 Sugerencias:", suggestions);

            if (!extracted) {
                throw new Error("La IA no devolvió datos estructurados.");
            }

            console.log("💾 Guardando datos en state...");
            setJobData(extracted);
            setOptimizedDescription(optimized);
            setPostingSuggestions(suggestions);

            console.log("🎯 Ejecutando setStep(2)...");
            setStep(2);
            console.log("✅ Step cambiado a 2");

            // Mostrar resumen de sugerencias
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
        }
    };

    const handleSave = async () => {
        if (!auth.currentUser || !jobData) return;
        setLoading(true);

        try {
            const finalData = {
                ...jobData,
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

                            <TouchableOpacity style={styles.processButton} onPress={handleProcessAI} disabled={loading}>
                                {loading ? <ActivityIndicator color="white" /> : (
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
    keywordTagText: { color: 'white', fontSize: 11, fontWeight: 'bold' }
});
