import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { ArrowLeft, CheckCircle2, ChevronRight, FileText, Upload, DollarSign, HeartHandshake } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, Image } from 'react-native';
import { db, storage } from '../../config/firebase';

export default function ExternalApplication() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [job, setJob] = useState<any>(null);
    const [companyInfo, setCompanyInfo] = useState<any>(null);

    // Form State
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [salaryExpectation, setSalaryExpectation] = useState('');
    const [file, setFile] = useState<any>(null);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    useEffect(() => {
        if (id) loadJobDetails(id as string);
    }, [id]);

    const loadJobDetails = async (jobId: string) => {
        try {
            const jobDoc = await getDoc(doc(db, 'jobs', jobId));
            if (!jobDoc.exists() || !jobDoc.data().isExternal) {
                Alert.alert("Link no válido", "Esta vacante no está disponible para postulación externa.");
                return; // Optionally redirect to homepage
            }

            const jobData = jobDoc.data();
            setJob(jobData);

            // Fetch company details for branding
            const empDoc = await getDoc(doc(db, 'users_empresas', jobData.companyId));
            if (!empDoc.exists()) {
                const compDoc = await getDoc(doc(db, 'companies', jobData.companyId));
                if (compDoc.exists()) setCompanyInfo(compDoc.data());
            } else {
                setCompanyInfo(empDoc.data());
            }
        } catch (error) {
            console.error("Error loading job:", error);
            Alert.alert("Error", "No pudimos cargar los detalles de la vacante.");
        } finally {
            setLoading(false);
        }
    };

    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                copyToCacheDirectory: true
            });

            if (result.canceled) return;
            
            const selectedFile = result.assets[0];
            
            // Check file size (5MB = 5 * 1024 * 1024 bytes)
            if (selectedFile.size && selectedFile.size > 5 * 1024 * 1024) {
                Alert.alert("Archivo muy grande", "Por favor sube un documento que pese menos de 5MB.");
                return;
            }

            setFile(selectedFile);
        } catch (error) {
            Alert.alert("Error", "No se pudo cargar el documento.");
        }
    };

    const handleSubmit = async () => {
        if (!fullName || !email || !phone || !salaryExpectation || !file) {
            Alert.alert("Campos incompletos", "Por favor completa todos los campos y sube tu CV.");
            return;
        }

        if (!acceptedTerms) {
            Alert.alert("Términos y Condiciones", "Debes aceptar los términos de privacidad para postular.");
            return;
        }

        const expectationNumber = Number(salaryExpectation);
        if (isNaN(expectationNumber) || expectationNumber <= 0) {
            Alert.alert("Salario inválido", "Por favor ingresa un monto salarial válido en números.");
            return;
        }

        setSubmitting(true);
        try {
            // 1. Check Salary Filter
            const budget = Number(job.salaryBudget) || 0;
            const tolerance = Number(job.salaryTolerance) || 0;
            const maxBudget = budget > 0 ? budget * (1 + tolerance / 100) : Infinity;

            // Auto-reject flag
            const isAutoRejected = budget > 0 && expectationNumber > maxBudget;

            // 2. Upload CV to Storage
            const response = await fetch(file.uri);
            const blob = await response.blob();
            const storagePath = `cvs_externos/${job.companyId}/${id}/${Date.now()}_${fullName.replace(/\s+/g, '_')}`;
            const fileRef = ref(storage, storagePath);
            await uploadBytes(fileRef, blob);
            const cvUrl = await getDownloadURL(fileRef);

            // 3. Save Candidate Record
            const candidateData = {
                fullName,
                email: email.toLowerCase(),
                phone,
                salaryExpectation: expectationNumber,
                cvUrl,
                appliedAt: serverTimestamp(),
                status: isAutoRejected ? 'rejected_salary' : 'pending_ai',
                source: 'external_link',
                jobId: id,
                companyId: job.companyId
            };

            await addDoc(collection(db, 'jobs', id as string, 'candidates'), candidateData);

            // Show success screen or message
            Alert.alert(
                "¡Postulación Exitosa!",
                "Tu perfil ha sido registrado correctamente. Te contactaremos pronto.",
                [{ text: "Entendido" }]
            );

            // Optionally clear form or navigate away
            setFullName('');
            setEmail('');
            setPhone('');
            setSalaryExpectation('');
            setFile(null);
            setAcceptedTerms(false);

        } catch (error) {
            console.error("Error submitting:", error);
            Alert.alert("Error", "Hubo un problema procesando tu postulación. Por favor intenta de nuevo.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.loadingText}>Cargando vacante...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!job) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={{ color: 'white', fontSize: 18 }}>Vacante no encontrada.</Text>
                </View>
            </SafeAreaView>
        );
    }

    const companyName = companyInfo?.company?.name || companyInfo?.nombreComercial || 'Empresa Confidencial';

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header Branding */}
                <View style={styles.brandingHeader}>
                    <View style={styles.companyBadge}>
                        <Text style={styles.companyBadgeText}>{companyName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.companyName}>{companyName}</Text>
                    <Text style={styles.jobTitle}>{job.jobTitle}</Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaText}>{job.employmentType || "Tiempo Completo"}</Text>
                        <Text style={styles.metaDot}>•</Text>
                        <Text style={styles.metaText}>{job.location || "Remoto"}</Text>
                    </View>
                </View>

                {/* Form Section */}
                <View style={styles.formContainer}>
                    <Text style={styles.sectionHeader}>Información Personal</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nombre Completo *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej. Juan Pérez"
                            placeholderTextColor="#475569"
                            value={fullName}
                            onChangeText={setFullName}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Correo Electrónico *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="juan@email.com"
                            placeholderTextColor="#475569"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={email}
                            onChangeText={setEmail}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Teléfono / Celular *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="+51 999 888 777"
                            placeholderTextColor="#475569"
                            keyboardType="phone-pad"
                            value={phone}
                            onChangeText={setPhone}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Expectativa Salarial Bruta (PEN) *</Text>
                        <View style={styles.salaryInputContainer}>
                            <View style={styles.currencyBadge}>
                                <Text style={styles.currencyText}>S/</Text>
                            </View>
                            <TextInput
                                style={styles.salaryInput}
                                placeholder="Ej. 3000"
                                placeholderTextColor="#475569"
                                keyboardType="numeric"
                                value={salaryExpectation}
                                onChangeText={setSalaryExpectation}
                            />
                        </View>
                        <Text style={styles.helperText}>Ingresa tu pretensión salarial en Soles.</Text>
                    </View>

                    <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Tu Currículum</Text>
                    <TouchableOpacity 
                        style={[styles.uploadBox, file && styles.uploadBoxSuccess]} 
                        onPress={handlePickDocument}
                    >
                        {file ? (
                            <>
                                <FileText color="#10b981" size={32} />
                                <Text style={styles.uploadTextSuccess}>{file.name}</Text>
                                <Text style={styles.uploadSubTextSuccess}>Toca para cambiar de archivo</Text>
                            </>
                        ) : (
                            <>
                                <Upload color="#3b82f6" size={32} />
                                <Text style={styles.uploadText}>Sube tu CV (PDF o Word)</Text>
                                <Text style={styles.uploadSubText}>Tamaño máximo: 5MB</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Terms & Privacy */}
                    <TouchableOpacity 
                        style={styles.termsContainer} 
                        onPress={() => setAcceptedTerms(!acceptedTerms)}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}>
                            {acceptedTerms && <CheckCircle2 color="white" size={16} />}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.termsText}>
                                Acepto que mis datos sean gestionados y procesados por Veritly (Relié Labs S.A.C.) y compartidos con la empresa contratante para este y futuros procesos de selección.
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.submitButton, (!fullName || !email || !phone || !salaryExpectation || !file || !acceptedTerms || submitting) && styles.submitButtonDisabled]}
                        disabled={submitting}
                        onPress={handleSubmit}
                    >
                        {submitting ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.submitButtonText}>ENVIAR MI POSTULACIÓN</Text>
                        )}
                    </TouchableOpacity>
                </View>
                
                <View style={styles.poweredBy}>
                    <Text style={styles.poweredText}>Procesos potenciados por</Text>
                    <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4}}>
                        <Zap color="#f59e0b" size={14} style={{marginRight: 4}}/>
                        <Text style={styles.brandText}>Veritly IA</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#94a3b8', marginTop: 10 },
    scrollContent: { padding: 20, paddingBottom: 50 },
    
    // Header Branding
    brandingHeader: { alignItems: 'center', marginBottom: 30, marginTop: 20 },
    companyBadge: { width: 60, height: 60, borderRadius: 16, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155', marginBottom: 15 },
    companyBadgeText: { color: '#38bdf8', fontSize: 24, fontWeight: 'bold' },
    companyName: { color: '#94a3b8', fontSize: 14, fontWeight: '600', marginBottom: 5 },
    jobTitle: { color: 'white', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    metaText: { color: '#cbd5e1', fontSize: 13 },
    metaDot: { color: '#64748b', marginHorizontal: 8 },

    // Form
    formContainer: { backgroundColor: '#1e293b', borderRadius: 16, padding: 25, borderWidth: 1, borderColor: '#334155' },
    sectionHeader: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 10 },
    inputGroup: { marginBottom: 20 },
    label: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
    input: { backgroundColor: '#0f172a', color: 'white', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#334155', fontSize: 15 },
    helperText: { color: '#64748b', fontSize: 11, marginTop: 5 },

    // Salary Input Custom
    salaryInputContainer: { flexDirection: 'row', alignItems: 'center' },
    currencyBadge: { backgroundColor: '#0f172a', paddingHorizontal: 15, height: 52, justifyContent: 'center', borderTopLeftRadius: 10, borderBottomLeftRadius: 10, borderWidth: 1, borderColor: '#334155', borderRightWidth: 0 },
    currencyText: { color: '#10b981', fontWeight: 'bold', fontSize: 16 },
    salaryInput: { flex: 1, backgroundColor: '#0f172a', color: 'white', height: 52, paddingHorizontal: 15, borderTopRightRadius: 10, borderBottomRightRadius: 10, borderWidth: 1, borderColor: '#334155', fontSize: 16, fontWeight: 'bold' },

    // Upload Box
    uploadBox: { backgroundColor: '#0f172a', borderWidth: 2, borderColor: '#3b82f6', borderStyle: 'dashed', borderRadius: 12, padding: 30, alignItems: 'center', marginBottom: 25 },
    uploadBoxSuccess: { borderColor: '#10b981', borderStyle: 'solid', backgroundColor: 'rgba(16, 185, 129, 0.05)' },
    uploadText: { color: '#3b82f6', fontWeight: 'bold', marginTop: 10, fontSize: 15 },
    uploadSubText: { color: '#64748b', fontSize: 12, marginTop: 5 },
    uploadTextSuccess: { color: '#10b981', fontWeight: 'bold', marginTop: 10, fontSize: 15, textAlign: 'center' },
    uploadSubTextSuccess: { color: '#047857', fontSize: 12, marginTop: 5 },

    // Terms
    termsContainer: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 30, gap: 10 },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#475569', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
    checkboxActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    termsText: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },

    // Submit
    submitButton: { backgroundColor: '#3b82f6', padding: 18, borderRadius: 12, alignItems: 'center', elevation: 2 },
    submitButtonDisabled: { backgroundColor: '#334155', opacity: 0.7 },
    submitButtonText: { color: 'white', fontWeight: 'bold', fontSize: 15 },

    // Footer
    poweredBy: { alignItems: 'center', marginTop: 30 },
    poweredText: { color: '#64748b', fontSize: 11 },
    brandText: { color: '#f59e0b', fontSize: 14, fontWeight: '900', letterSpacing: 1 }
});
