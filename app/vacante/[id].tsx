import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    onAuthStateChanged,
    sendEmailVerification,
    signInWithEmailAndPassword,
    signInWithPopup
} from 'firebase/auth';
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
    ArrowLeft,
    ArrowRight,
    Briefcase,
    CheckCircle2,
    ChevronRight,
    Clock,
    DollarSign,
    FileText,
    LogIn,
    Mail,
    MapPin,
    Send,
    Upload,
    User,
    Zap
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
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
import { auth, db, storage } from '../../config/firebase';

type PageStep = 'offer' | 'auth' | 'apply' | 'success';
type AuthMode = 'login' | 'register';

export default function ExternalApplication() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    // Page state
    const [step, setStep] = useState<PageStep>('offer');
    const [authMode, setAuthMode] = useState<AuthMode>('login');

    // Data
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState('');
    const [job, setJob] = useState<any>(null);
    const [applicantCount, setApplicantCount] = useState(0);
    const [companyName, setCompanyName] = useState('');
    const [companyType, setCompanyType] = useState<'empresa' | 'independiente' | ''>('');
    const [user, setUser] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);

    // Auth form state
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authName, setAuthName] = useState('');
    const [authSubmitting, setAuthSubmitting] = useState(false);

    // Application form state
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [salaryExpectation, setSalaryExpectation] = useState('');
    const [file, setFile] = useState<any>(null);
    const [killerAnswers, setKillerAnswers] = useState<Record<number, string>>({});
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Listen to auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthLoading(false);
            if (u) {
                setFullName(u.displayName || '');
                setAuthEmail(u.email || '');
                loadCandidateProfile(u.uid);
                // If user just authenticated and was going to apply, advance them
                setStep(prev => prev === 'auth' ? 'apply' : prev);
            }
        });
        return unsubscribe;
    }, []);

    // Load job on mount
    useEffect(() => {
        if (id) loadJobDetails(id as string);
    }, [id]);

    const loadCandidateProfile = async (uid: string) => {
        try {
            const snap = await getDoc(doc(db, 'users_candidatos', uid));
            if (snap.exists()) {
                const data = snap.data();
                if (data.profile?.fullName) setFullName(data.profile.fullName);
                else if (data.fullName) setFullName(data.fullName);
                
                if (data.profile?.phone) setPhone(data.profile.phone);
                else if (data.phone) setPhone(data.phone);
            }
        } catch (e) {
            console.error('Error loading profile:', e);
        }
    };

    const ensureCandidateDoc = async (u: any, nameOverride?: string) => {
        const docRef = doc(db, 'users_candidatos', u.uid);
        const snap = await getDoc(docRef);
        
        if (!snap.exists()) {
            await setDoc(docRef, {
                uid: u.uid,
                email: u.email,
                role: 'candidato',
                profile: {
                    fullName: nameOverride || u.displayName || '',
                    phone: '',
                },
                applications: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                source: 'external_link'
            });
        }
    };

    const loadJobDetails = async (jobId: string) => {
        try {
            const jobDoc = await getDoc(doc(db, 'jobs', jobId));
            if (!jobDoc.exists() || !jobDoc.data().isExternal) {
                Alert.alert('Vacante no disponible', 'Este enlace de postulación ya no está activo.');
                return;
            }
            const jobData = jobDoc.data();
            setJob(jobData);

            // Load company info for branding
            const empSnap = await getDoc(doc(db, 'users_empresas', jobData.companyId));
            const data = empSnap.exists() ? empSnap.data() : null;
            setCompanyName(
                data?.company?.name ||
                data?.nombreComercial ||
                data?.aiContext?.nombre ||
                'Empresa'
            );
            setCompanyType(data?.company?.type || 'empresa');

            // Load applicant count
            const { getDocs, query, collection } = await import('firebase/firestore');
            const q = query(collection(db, 'jobs', jobId, 'candidates'));
            const countSnap = await getDocs(q);
            setApplicantCount(countSnap.size);
        } catch (e) {
            console.error('Error loading job:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleClickApply = () => {
        if (user) {
            setStep('apply');
        } else {
            setStep('auth');
        }
    };

    // ─── AUTH HANDLERS ──────────────────────────────────────────────────────────

    const handleGoogleAuth = async () => {
        setAuthSubmitting(true);
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            if (result.user) {
                await ensureCandidateDoc(result.user);
            }
        } catch (err: any) {
            if (err.code !== 'auth/popup-closed-by-user') {
                Alert.alert('Error', 'No se pudo iniciar sesión con Google.');
            }
        } finally {
            setAuthSubmitting(false);
        }
    };

    const handleEmailAuth = async () => {
        if (!authEmail || !authPassword) {
            Alert.alert('Campos vacíos', 'Por favor completa el correo y la contraseña.');
            return;
        }
        setAuthSubmitting(true);
        try {
            if (authMode === 'register') {
                if (!authName) {
                    Alert.alert('Nombre requerido', 'Por favor ingresa tu nombre completo.');
                    setAuthSubmitting(false);
                    return;
                }
                const cred = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
                setFullName(authName);
                await ensureCandidateDoc(cred.user, authName);
                setStep('apply');
            } else {
                const cred = await signInWithEmailAndPassword(auth, authEmail, authPassword);
                await ensureCandidateDoc(cred.user);
            }
        } catch (err: any) {
            const msg =
                err.code === 'auth/email-already-in-use' ? 'Este correo ya está registrado. ¿Quieres iniciar sesión?' :
                err.code === 'auth/invalid-credential' ? 'Correo o contraseña incorrectos.' :
                err.code === 'auth/weak-password' ? 'La contraseña debe tener al menos 6 caracteres.' :
                'Ocurrió un error inesperado.';
            Alert.alert('Error', msg);
        } finally {
            setAuthSubmitting(false);
        }
    };

    // ─── FILE HANDLER ────────────────────────────────────────────────────────────

    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                copyToCacheDirectory: true
            });
            if (result.canceled) return;
            const selectedFile = result.assets[0];
            if (selectedFile.size && selectedFile.size > 5 * 1024 * 1024) {
                Alert.alert('Archivo muy grande', 'Por favor sube un documento que pese menos de 5MB.');
                return;
            }
            setFile(selectedFile);
        } catch {
            Alert.alert('Error', 'No se pudo cargar el documento.');
        }
    };

    // ─── SUBMIT HANDLER ──────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        let hasErrors = false;
        const errors: Record<string, string> = {};

        if (!fullName.trim()) { errors.fullName = 'Tu nombre completo es obligatorio.'; hasErrors = true; }
        if (!phone.trim()) { errors.phone = 'Tu teléfono es obligatorio.'; hasErrors = true; }
        
        const expectationNumber = Number(salaryExpectation);
        if (!salaryExpectation.trim()) { 
            errors.salary = 'La expectativa salarial es obligatoria.'; 
            hasErrors = true; 
        } else if (isNaN(expectationNumber) || expectationNumber < 1130) {
            errors.salary = 'La expectativa mínima es S/ 1,130 (Sueldo Mínimo Vital).';
            hasErrors = true;
        }

        const questions = job.killerQuestions || [];
        const activeQs = questions.filter((q: any) => q.question?.trim());
        if (activeQs.length > 0) {
            const allAnswered = activeQs.every((_: any, idx: number) => killerAnswers[idx] !== undefined);
            if (!allAnswered) {
                errors.killer = 'Por favor responde todas las preguntas de la oferta.';
                hasErrors = true;
            }
        }

        if (!file) { errors.file = 'Debes subir tu CV.'; hasErrors = true; }
        if (!acceptedTerms) { errors.terms = 'Debes aceptar la política de privacidad.'; hasErrors = true; }

        setFormErrors(errors);

        if (hasErrors) {
            Alert.alert('Campos por corregir', 'Por favor revisa los mensajes en texto rojo.');
            return;
        }

        setSubmitting(true);
        setSubmitStatus('Registrando postulación...');
        try {
            console.log('--- Iniciando Postulación ---');
            // Salary filter
            const budget = Number(job.salaryBudget) || 0;
            const tolUp = Number(job.salaryTolerance) || 10;
            const tolDown = Number(job.salaryToleranceDown) || 10;
            const maxBudget = budget > 0 ? budget * (1 + tolUp / 100) : Infinity;
            const minBudget = budget > 0 ? budget * (1 - tolDown / 100) : 0;
            const isSalaryRejected = budget > 0 && (expectationNumber > maxBudget || expectationNumber < minBudget);

            // Killer questions filter
            let isKillerRejected = false;
            let failureReason = '';
            const questions = job.killerQuestions || [];
            if (questions.length > 0) {
                questions.forEach((q: any, idx: number) => {
                    if (!q.question?.trim()) return;
                    const ans = killerAnswers[idx] || 'no';
                    const expected = q.expectedAnswer || 'si';
                    if (ans !== expected) {
                        isKillerRejected = true;
                        failureReason = 'No cumple con requisitos críticos (Killer Questions).';
                    }
                });
            }

            const isRejected = isSalaryRejected || isKillerRejected;

            // STEP 1: Save to Firestore immediately (no waiting for CV upload)
            // This ensures the candidate is registered even if the file upload fails
            let docRef;
            try {
                docRef = await addDoc(collection(db, 'jobs', id as string, 'candidates'), {
                    fullName: fullName.trim(),
                    email: (user?.email || authEmail).toLowerCase().trim(),
                    phone: phone.trim(),
                    salaryExpectation: expectationNumber,
                    cvUrl: null, // Will be updated after upload
                    cvFileName: file?.name || '',
                    appliedAt: serverTimestamp(),
                    status: isRejected ? (isSalaryRejected ? 'rejected_salary' : 'rejected') : 'pending_ai',
                    recruitmentStatus: isRejected ? (isSalaryRejected ? 'rejected_salary' : 'rejected') : 'screening',
                    failureReason: isSalaryRejected ? 'Presupuesto fuera de rango' : failureReason,
                    killerAnswers,
                    source: 'external_link',
                    userId: user?.uid || null,
                    jobId: id,
                    companyId: job.companyId || ''
                });
            } catch (dbErr: any) {
                console.error('Firestore error:', dbErr);
                throw new Error('No se pudo conectar con el servidor. Verifica tu internet.');
            }

            // STEP 2: Show success immediately to the candidate
            console.log('✅ Postulación guardada, mostrando éxito');
            setStep('success');
            setSubmitting(false);
            setSubmitStatus('');

            // STEP 3: Upload CV in background (non-blocking)
            if (file && docRef) {
                console.log('📎 Subiendo CV en segundo plano...');
                try {
                    let blob;
                    if (Platform.OS === 'web' && file.file) {
                        blob = file.file;
                    } else {
                        const response = await fetch(file.uri);
                        blob = await response.blob();
                    }
                    const safeName = (fullName || 'candidato').replace(/[^a-zA-Z0-9]/g, '_');
                    const fileRef = ref(storage, `cvs_externos/${job.companyId || 'anon'}/${id}/${Date.now()}_${safeName}`);
                    await uploadBytes(fileRef, blob);
                    const cvUrl = await getDownloadURL(fileRef);
                    // Update the document with the CV URL
                    const { updateDoc } = await import('firebase/firestore');
                    await updateDoc(docRef, { cvUrl });
                    console.log('✅ CV subido y vinculado correctamente');
                } catch (uploadErr) {
                    console.error('Background CV upload failed:', uploadErr);
                    // Silent fail - candidate is already registered
                }
            }
        } catch (err: any) {
            console.error('Submit fatal error:', err);
            Alert.alert('Error en la postulación', err.message || 'Hubo un problema. Intenta de nuevo.');
            setSubmitting(false);
            setSubmitStatus('');
        }
    };

    // ─── LOADING ─────────────────────────────────────────────────────────────────

    if (loading || authLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.loadingText}>Cargando oferta...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!job) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: 'bold' }}>Vacante no disponible</Text>
                    <Text style={{ color: '#94a3b8', marginTop: 10 }}>Este enlace ya no está activo.</Text>
                </View>
            </SafeAreaView>
        );
    }

    // ─── STEP: OFFER VIEW ────────────────────────────────────────────────────────

    if (step === 'offer') {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
                <ScrollView key={`scroll-${step}`} contentContainerStyle={styles.scrollContent}>
                    {/* Company branding */}
                    <View style={styles.brandHeader}>
                        <View style={styles.companyAvatar}>
                            <Text style={styles.companyAvatarText}>{companyName.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.brandInfo}>
                            <Text style={styles.brandName}>{companyName}</Text>
                            <View style={styles.brandRow}>
                                <Text style={styles.brandType}>{companyType === 'independiente' ? 'Independiente' : 'Empresa'}</Text>
                                <Text style={styles.brandSeparator}>•</Text>
                                <Text style={styles.brandTag}>Publica con <Text style={{ color: '#f59e0b', fontWeight: 'bold' }}>Veritly</Text></Text>
                            </View>
                        </View>
                    </View>

                    {/* Job Card */}
                    <View style={styles.jobCard}>
                        <View style={styles.jobBadge}>
                            <Briefcase size={14} color="#3b82f6" />
                            <Text style={styles.jobBadgeText}>Vacante Activa</Text>
                        </View>
                        <Text style={styles.jobTitle}>{job.jobTitle || 'Puesto'}</Text>

                        {job.requiredExperience && (
                            <View style={styles.infoRow}>
                                <Clock size={16} color="#94a3b8" />
                                <Text style={styles.infoText}>Experiencia: {job.requiredExperience}</Text>
                            </View>
                        )}
                        {job.isSalaryPublic && job.salaryBudget > 0 && (
                            <View style={styles.infoRow}>
                                <DollarSign size={16} color="#10b981" />
                                <Text style={[styles.infoText, { color: '#10b981' }]}>
                                    Rango salarial: S/ {Math.round(job.salaryBudget * (1 - (job.salaryToleranceDown || 10) / 100)).toLocaleString()} – S/ {Math.round(job.salaryBudget * (1 + (job.salaryTolerance || 10) / 100)).toLocaleString()}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Social Proof Counter */}
                    <View style={styles.socialProof}>
                        {applicantCount < 5 ? (
                            <Text style={styles.socialProofText}>✨ ¡Sé uno de los primeros en postular!</Text>
                        ) : applicantCount <= 20 ? (
                            <Text style={styles.socialProofText}>🔥 {applicantCount} personas ya postularon a esta posición.</Text>
                        ) : (
                            <Text style={styles.socialProofText}>🚀 Más de {applicantCount} candidatos interesados. ¡No te quedes fuera!</Text>
                        )}
                    </View>


                    {/* Job Description */}
                    {(job.optimizedText || job.originalText) && (
                        <View style={styles.descCard}>
                            <Text style={styles.descTitle}>Descripción del Puesto</Text>
                            <Text style={styles.descText}>{job.optimizedText || job.originalText}</Text>
                        </View>
                    )}

                    {/* Hard Skills */}
                    {job.hardSkills && job.hardSkills.length > 0 && (
                        <View style={styles.descCard}>
                            <Text style={styles.descTitle}>Habilidades Requeridas</Text>
                            <View style={styles.tagsRow}>
                                {job.hardSkills.map((skill: string, i: number) => (
                                    <View key={i} style={styles.skillTag}>
                                        <Text style={styles.skillTagText}>{skill}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Removed static CTA, now sticky below */}

                    {user && (
                        <Text style={{ color: '#64748b', textAlign: 'center', fontSize: 12, marginTop: -10, marginBottom: 20 }}>
                            Conectado como {user.email}
                        </Text>
                    )}

                    <View style={styles.footerPowered}>
                        <Zap size={12} color="#f59e0b" />
                        <Text style={styles.footerPoweredText}>Powered by <Text style={{ color: '#f59e0b', fontWeight: 'bold' }}>Veritly IA</Text> · Selección Inteligente</Text>
                    </View>
                    <View style={{ height: Platform.OS === 'web' ? 20 : 100 }} />
                </ScrollView>

                {/* Sticky CTA for Mobile */}
                <View style={[styles.stickyCTA, Platform.OS !== 'web' && styles.shadowCTA]}>
                    <TouchableOpacity style={styles.applyBtn} onPress={handleClickApply}>
                        <Send size={20} color="white" />
                        <Text style={styles.applyBtnText}>POSTULAR AHORA</Text>
                        <ChevronRight size={20} color="white" />
                    </TouchableOpacity>
                    {user && (
                        <Text style={{ color: '#64748b', textAlign: 'center', fontSize: 10, marginTop: 4 }}>
                            Conectado como {user.email}
                        </Text>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    // ─── STEP: AUTH ──────────────────────────────────────────────────────────────

    if (step === 'auth') {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
                <ScrollView key={`scroll-${step}`} contentContainerStyle={styles.scrollContent}>
                    {/* Back to offer */}
                    <TouchableOpacity onPress={() => setStep('offer')} style={styles.backBtn}>
                        <ArrowLeft size={20} color="#94a3b8" />
                        <Text style={styles.backBtnText}>Ver oferta de {job.jobTitle || 'trabajo'}</Text>
                    </TouchableOpacity>

                    <View style={styles.authCard}>
                        <Image
                            source={require('../../assets/images/veritly3.png')}
                            style={{ width: 60, height: 60, alignSelf: 'center', marginBottom: 16 }}
                            resizeMode="contain"
                        />
                        <Text style={styles.authTitle}>
                            {authMode === 'login' ? 'Ingresa para Postular' : 'Crea tu Cuenta y Postula'}
                        </Text>
                        <Text style={styles.authSub}>
                            {authMode === 'login'
                                ? 'Ingresa con tu cuenta Veritly para continuar con la postulación.'
                                : 'Crea tu cuenta en segundos. Con ella podrás postular a esta y otras vacantes.'}
                        </Text>

                        {/* Google */}
                        <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleAuth} disabled={authSubmitting}>
                            <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' }} style={{ width: 20, height: 20, marginRight: 10 }} />
                            <Text style={styles.googleBtnText}>Continuar con Google</Text>
                        </TouchableOpacity>

                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>o con correo</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Email form */}
                        {authMode === 'register' && (
                            <View style={styles.inputWrap}>
                                <User size={18} color="#64748b" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.authInput}
                                    placeholder="Nombre completo"
                                    placeholderTextColor="#475569"
                                    value={authName}
                                    onChangeText={setAuthName}
                                />
                            </View>
                        )}
                        <View style={styles.inputWrap}>
                            <Mail size={18} color="#64748b" style={styles.inputIcon} />
                            <TextInput
                                style={styles.authInput}
                                placeholder="Correo electrónico"
                                placeholderTextColor="#475569"
                                autoCapitalize="none"
                                keyboardType="email-address"
                                value={authEmail}
                                onChangeText={setAuthEmail}
                            />
                        </View>
                        <View style={styles.inputWrap}>
                            <LogIn size={18} color="#64748b" style={styles.inputIcon} />
                            <TextInput
                                style={styles.authInput}
                                placeholder="Contraseña (mínimo 6 caracteres)"
                                placeholderTextColor="#475569"
                                secureTextEntry
                                value={authPassword}
                                onChangeText={setAuthPassword}
                            />
                        </View>

                        <TouchableOpacity style={styles.authSubmitBtn} onPress={handleEmailAuth} disabled={authSubmitting}>
                            {authSubmitting
                                ? <ActivityIndicator color="white" />
                                : <>
                                    <Text style={styles.authSubmitText}>
                                        {authMode === 'login' ? 'Ingresar y Postular' : 'Crear Cuenta y Postular'}
                                    </Text>
                                    <ArrowRight size={18} color="white" />
                                </>
                            }
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} style={{ marginTop: 16, alignSelf: 'center' }}>
                            <Text style={{ color: '#94a3b8', fontSize: 13 }}>
                                {authMode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
                                <Text style={{ color: '#3b82f6', fontWeight: 'bold' }}>
                                    {authMode === 'login' ? 'Regístrate gratis' : 'Inicia sesión'}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // ─── STEP: SUCCESS ───────────────────────────────────────────────────────────

    if (step === 'success') {
        return (
            <SafeAreaView style={styles.container}>
                <ScrollView key={`scroll-${step}`} contentContainerStyle={[styles.scrollContent, styles.centered]}>
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(16, 185, 129, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                            <CheckCircle2 size={48} color="#10b981" />
                        </View>
                        <Text style={{ color: 'white', fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }}>¡Postulación Enviada!</Text>
                        <Text style={{ color: '#94a3b8', textAlign: 'center', lineHeight: 22, marginBottom: 30, paddingHorizontal: 20 }}>
                            Tu perfil fue registrado correctamente para <Text style={{ color: 'white', fontWeight: 'bold' }}>{job.jobTitle}</Text> en {companyName}. El equipo de selección revisará tu CV y se contactará contigo.
                        </Text>

                        <View style={{ backgroundColor: '#1e293b', padding: 20, borderRadius: 16, width: '100%', marginBottom: 30, borderWidth: 1, borderColor: '#334155' }}>
                            <Text style={{ color: '#f59e0b', fontWeight: 'bold', marginBottom: 8, fontSize: 14 }}>💡 Mientras esperas...</Text>
                            <Text style={{ color: '#94a3b8', fontSize: 13, lineHeight: 20 }}>
                                Con tu cuenta Veritly puedes optimizar tu CV, practicar entrevistas con IA y prepararte para destacar en el proceso de selección.
                            </Text>
                        </View>

                        <TouchableOpacity style={[styles.applyBtn, { backgroundColor: '#7c3aed' }]} onPress={() => router.replace('/(tabs)')}>
                            <Zap size={18} color="white" />
                            <Text style={styles.applyBtnText}>Explorar Veritly</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ marginTop: 12 }} onPress={() => setStep('offer')}>
                            <Text style={{ color: '#64748b', fontSize: 13 }}>Volver a la oferta</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // ─── STEP: APPLY FORM ────────────────────────────────────────────────────────

    const activeKillerQuestions = (job.killerQuestions || []).filter((q: any) => q.question?.trim());

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <ScrollView key={`scroll-${step}`} contentContainerStyle={styles.scrollContent}>

                {/* Header */}
                <TouchableOpacity onPress={() => setStep('offer')} style={styles.backBtn}>
                    <ArrowLeft size={20} color="#94a3b8" />
                    <Text style={styles.backBtnText}>Volver a la oferta</Text>
                </TouchableOpacity>

                <View style={styles.applyHeader}>
                    <Text style={styles.applyTitle}>Tu Postulación</Text>
                    <Text style={styles.applySub}>
                        Postulando a <Text style={{ color: 'white', fontWeight: 'bold' }}>{job.jobTitle}</Text> en {companyName}
                    </Text>
                    {user && (
                        <View style={styles.userPill}>
                            <CheckCircle2 size={14} color="#10b981" />
                            <Text style={styles.userPillText}>Conectado: {user.email}</Text>
                        </View>
                    )}
                </View>

                {/* Personal info */}
                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Información Personal</Text>

                    <Text style={styles.label}>Nombre completo *</Text>
                    <TextInput
                        style={[styles.input, formErrors.fullName && styles.inputError]}
                        placeholder="Tu nombre y apellidos"
                        placeholderTextColor="#475569"
                        value={fullName}
                        onChangeText={(txt) => { setFullName(txt); if (formErrors.fullName) setFormErrors({ ...formErrors, fullName: '' }); }}
                    />
                    {formErrors.fullName && <Text style={styles.errorText}>{formErrors.fullName}</Text>}

                    <Text style={styles.label}>Teléfono / WhatsApp *</Text>
                    <TextInput
                        style={[styles.input, formErrors.phone && styles.inputError]}
                        placeholder="Ej. +51 999 000 111"
                        placeholderTextColor="#475569"
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={(txt) => { setPhone(txt); if (formErrors.phone) setFormErrors({ ...formErrors, phone: '' }); }}
                    />
                    {formErrors.phone && <Text style={styles.errorText}>{formErrors.phone}</Text>}
                </View>

                {/* Salary */}
                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Expectativa Salarial</Text>

                    {job.isSalaryPublic && job.salaryBudget > 0 && (
                        <View style={styles.salaryRangeHint}>
                            <DollarSign size={14} color="#38bdf8" />
                            <Text style={styles.salaryRangeText}>
                                Rango esperado: S/ {Math.round(job.salaryBudget * (1 - (job.salaryToleranceDown || 10) / 100)).toLocaleString()} – S/ {Math.round(job.salaryBudget * (1 + (job.salaryTolerance || 10) / 100)).toLocaleString()}
                            </Text>
                        </View>
                    )}

                    <Text style={styles.label}>Expectativa mensual bruta (PEN) *</Text>
                    <View style={styles.salaryRow}>
                        <View style={styles.currencyBadge}><Text style={styles.currencyText}>S/</Text></View>
                        <TextInput
                            style={[styles.salaryInput, formErrors.salary && styles.inputError]}
                            placeholder="Ej. 3000"
                            placeholderTextColor="#475569"
                            keyboardType="numeric"
                            value={salaryExpectation}
                            onChangeText={(txt) => { setSalaryExpectation(txt); if (formErrors.salary) setFormErrors({ ...formErrors, salary: '' }); }}
                        />
                    </View>
                    {formErrors.salary ? (
                        <Text style={styles.errorText}>{formErrors.salary}</Text>
                    ) : (
                        <Text style={styles.helperText}>Mínimo S/ 1,130 (Sueldo Mínimo Vital en Perú).</Text>
                    )}
                </View>

                {/* Killer Questions */}
                {activeKillerQuestions.length > 0 && (
                    <View style={styles.formSection}>
                        <Text style={styles.sectionTitle}>Preguntas de la Oferta</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 15 }}>Estas preguntas son parte del proceso de selección.</Text>
                        {activeKillerQuestions.map((q: any, idx: number) => (
                            <View key={idx} style={styles.killerCard}>
                                <Text style={styles.killerQuestion}>{q.question}</Text>
                                <View style={styles.killerBtnsRow}>
                                    <TouchableOpacity
                                        style={[styles.killerBtn, killerAnswers[idx] === 'si' && styles.killerBtnActive]}
                                        onPress={() => setKillerAnswers({ ...killerAnswers, [idx]: 'si' })}
                                    >
                                        <Text style={[styles.killerBtnText, killerAnswers[idx] === 'si' && styles.killerBtnTextActive]}>SÍ</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.killerBtn, killerAnswers[idx] === 'no' && styles.killerBtnActive]}
                                        onPress={() => setKillerAnswers({ ...killerAnswers, [idx]: 'no' })}
                                    >
                                        <Text style={[styles.killerBtnText, killerAnswers[idx] === 'no' && styles.killerBtnTextActive]}>NO</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* CV Upload */}
                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Tu Currículum</Text>
                    <TouchableOpacity style={[styles.uploadCard, file && styles.uploadCardDone, formErrors.file && styles.uploadCardError]} onPress={handlePickDocument}>
                        {file ? (
                            <>
                                <CheckCircle2 size={28} color="#10b981" />
                                <Text style={[styles.uploadText, { color: '#10b981' }]}>{file.name}</Text>
                                <Text style={styles.uploadHint}>Toca para cambiar el archivo</Text>
                            </>
                        ) : (
                            <>
                                <Upload size={28} color={formErrors.file ? "#ef4444" : "#38bdf8"} />
                                <Text style={[styles.uploadText, formErrors.file && { color: "#ef4444" }]}>
                                    Subir CV (PDF o Word)
                                </Text>
                                <Text style={styles.uploadHint}>Máximo 5MB</Text>
                            </>
                        )}
                    </TouchableOpacity>
                    {formErrors.file && <Text style={[styles.errorText, { marginTop: 8 }]}>{formErrors.file}</Text>}
                </View>

                {/* Terms */}
                <TouchableOpacity style={styles.termsRow} onPress={() => { setAcceptedTerms(!acceptedTerms); if (formErrors.terms) setFormErrors({ ...formErrors, terms: '' }); }}>
                    <View style={[styles.checkbox, acceptedTerms && styles.checkboxActive, formErrors.terms && !acceptedTerms && styles.checkboxError]}>
                        {acceptedTerms && <CheckCircle2 size={14} color="white" />}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.termsText}>
                            Acepto que mis datos sean utilizados para este proceso de selección y la{' '}
                            <Text style={{ color: '#38bdf8' }}>Política de Privacidad</Text>.
                        </Text>
                        {formErrors.terms && <Text style={[styles.errorText, { marginTop: 4, marginBottom: 0 }]}>{formErrors.terms}</Text>}
                    </View>
                </TouchableOpacity>

                {/* Submit */}
                <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting}>
                    {submitting ? (
                        <>
                            <ActivityIndicator color="white" />
                            <Text style={styles.submitBtnText}>{submitStatus || 'PROCESANDO...'}</Text>
                        </>
                    ) : (
                        <>
                            <Send size={20} color="white" />
                            <Text style={styles.submitBtnText}>ENVIAR POSTULACIÓN</Text>
                        </>
                    )}
                </TouchableOpacity>

                {/* --- FOR RECRUITERS BANNER --- */}
                <View style={styles.recruiterBanner}>
                    <View style={styles.recruiterBannerHeader}>
                        <Zap size={14} color="#f59e0b" />
                        <Text style={styles.recruiterBannerTag}>¿Eres Reclutador o Empresa?</Text>
                    </View>
                    <Text style={styles.recruiterBannerTitle}>Sube CVs y analízalos en segundos con IA</Text>
                    <Text style={styles.recruiterBannerBody}>
                        No somos una bolsa de trabajo. Somos tu <Text style={{ fontWeight: 'bold', color: 'white' }}>Mini ATS Inteligente</Text> para validar perfiles antes de contratar. Sube PDFs, Excels y elige con datos.
                    </Text>
                    <TouchableOpacity 
                        style={styles.recruiterBannerBtn}
                        onPress={() => router.push('/')}
                    >
                        <Text style={styles.recruiterBannerBtnText}>Saber más de Veritly</Text>
                        <ChevronRight size={16} color="#3b82f6" />
                    </TouchableOpacity>
                </View>

                <View style={styles.footerPowered}>
                    <Zap size={12} color="#f59e0b" />
                    <Text style={styles.footerPoweredText}>Powered by <Text style={{ color: '#f59e0b', fontWeight: 'bold' }}>Veritly IA</Text></Text>
                </View>
             </ScrollView>

             {/* AI Perception Loading Overlay (Global) */}
             {submitting && (
                 <View style={styles.loadingOverlay}>
                     <View style={styles.loadingBox}>
                         <ActivityIndicator size="large" color="#3b82f6" />
                         <Text style={styles.loadingTitle}>Veritly IA</Text>
                         <Text style={styles.loadingMsg}>Veritly está procesando tu perfil para el reclutador...</Text>
                         {submitStatus && <Text style={{ color: '#3b82f6', fontSize: 10, marginTop: 15, fontWeight: 'bold' }}>{submitStatus.toUpperCase()}</Text>}
                     </View>
                 </View>
             )}
         </SafeAreaView>
     );
 }

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    scrollContent: { padding: 20, paddingBottom: 120 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#94a3b8', marginTop: 12 },

    // Back button
    backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 6 },
    backBtnText: { color: '#94a3b8', fontSize: 14 },

    // Brand Header
    brandHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
    companyAvatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', justifyContent: 'center', alignItems: 'center' },
    companyAvatarText: { color: '#38bdf8', fontWeight: 'bold', fontSize: 22 },
    brandInfo: { flex: 1, gap: 2 },
    brandName: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    brandType: { color: '#94a3b8', fontSize: 12, fontWeight: '500' },
    brandSeparator: { color: '#475569', fontSize: 12 },
    brandTag: { color: '#94a3b8', fontSize: 12 },

    // Job Card
    jobCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
    jobBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    jobBadgeText: { color: '#3b82f6', fontSize: 12, fontWeight: 'bold' },
    jobTitle: { color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 14 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    infoText: { color: '#94a3b8', fontSize: 14 },

    errorText: { color: '#ef4444', fontSize: 12, marginTop: -8, marginBottom: 12 },
    inputError: { borderColor: '#ef4444' },

    // Description
    descCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
    descTitle: { color: '#38bdf8', fontWeight: 'bold', fontSize: 14, marginBottom: 12 },
    descText: { color: '#cbd5e1', fontSize: 14, lineHeight: 22 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10, marginBottom: 5 },
    skillTag: { backgroundColor: 'rgba(56,189,248,0.08)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(56,189,248,0.15)' },
    skillTagText: { color: '#38bdf8', fontSize: 13, fontWeight: '600' },

    // CTA
    applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#3b82f6', padding: 18, borderRadius: 16, marginVertical: 20, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
    applyBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    // Footer
    footerPowered: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 },
    footerPoweredText: { color: '#64748b', fontSize: 11 },

    // Auth card
    authCard: { backgroundColor: '#1e293b', borderRadius: 20, padding: 28, borderWidth: 1, borderColor: '#334155' },
    authTitle: { color: 'white', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    authSub: { color: '#94a3b8', textAlign: 'center', fontSize: 13, marginBottom: 24, lineHeight: 19 },
    googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', padding: 14, borderRadius: 12, marginBottom: 6 },
    googleBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 15 },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 18, gap: 10 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#334155' },
    dividerText: { color: '#64748b', fontSize: 12 },
    inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 14, height: 50, marginBottom: 12 },
    inputIcon: { marginRight: 10 },
    authInput: { flex: 1, color: 'white', fontSize: 15 },
    authSubmitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, marginTop: 8 },
    authSubmitText: { color: 'white', fontWeight: 'bold', fontSize: 15 },

    // Apply form
    applyHeader: { marginBottom: 24 },
    applyTitle: { color: 'white', fontSize: 24, fontWeight: 'bold' },
    applySub: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
    userPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
    userPillText: { color: '#10b981', fontSize: 12, fontWeight: '500' },

    formSection: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
    sectionTitle: { color: 'white', fontWeight: 'bold', fontSize: 16, marginBottom: 16 },
    label: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4 },
    input: { backgroundColor: '#0f172a', color: 'white', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#334155', marginBottom: 12, fontSize: 15 },

    // Salary
    salaryRangeHint: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(56,189,248,0.08)', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(56,189,248,0.2)', marginBottom: 14 },
    salaryRangeText: { color: '#38bdf8', fontSize: 12, fontWeight: '600' },
    salaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    currencyBadge: { backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, height: 50, borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
    currencyText: { color: '#10b981', fontWeight: 'bold', fontSize: 16 },
    salaryInput: { flex: 1, backgroundColor: '#0f172a', color: 'white', padding: 14, borderTopRightRadius: 10, borderBottomRightRadius: 10, borderWidth: 1, borderColor: '#334155', fontSize: 16 },
    helperText: { color: '#64748b', fontSize: 11, marginTop: 4 },

    // Killer questions
    killerCard: { backgroundColor: '#0f172a', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
    killerQuestion: { color: 'white', fontSize: 15, fontWeight: '500', marginBottom: 14, lineHeight: 22 },
    killerBtnsRow: { flexDirection: 'row', gap: 10 },
    killerBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
    killerBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    killerBtnText: { color: '#94a3b8', fontWeight: 'bold', fontSize: 15 },
    killerBtnTextActive: { color: 'white' },

    // Upload
    uploadCard: { borderWidth: 2, borderColor: '#334155', borderStyle: 'dashed', borderRadius: 16, padding: 28, alignItems: 'center', gap: 10, backgroundColor: 'rgba(56,189,248,0.03)' },
    uploadCardDone: { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.05)', borderStyle: 'solid' },
    uploadCardError: { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.05)' },
    uploadText: { color: 'white', fontWeight: 'bold', fontSize: 15, textAlign: 'center' },
    uploadHint: { color: '#64748b', fontSize: 12 },

    // Social Proof
    socialProof: {
        marginBottom: 20,
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.15)',
        alignItems: 'center'
    },
    socialProofText: {
        color: '#3b82f6',
        fontSize: 13,
        fontWeight: '700'
    },

    // Sticky
    stickyCTA: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#0f172a',
        padding: 20,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        borderTopWidth: 1,
        borderTopColor: '#1e293b'
    },
    shadowCTA: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 20
    },

    // AI Perception Overlay
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30
    },
    loadingBox: {
        backgroundColor: '#1e293b',
        padding: 32,
        borderRadius: 28,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#334155',
        width: '100%',
        maxWidth: 400
    },
    loadingTitle: {
        color: 'white',
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 24
    },
    loadingMsg: {
        color: '#94a3b8',
        fontSize: 15,
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 22
    },

    // Terms
    termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20, paddingHorizontal: 4 },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#475569', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
    checkboxActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    checkboxError: { borderColor: '#ef4444' },
    termsText: { color: '#94a3b8', fontSize: 13, lineHeight: 19 },

    // Submit
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#10b981', padding: 18, borderRadius: 16, marginBottom: 20, shadowColor: '#10b981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
    submitBtnText: { color: 'white', fontWeight: 'bold', fontSize: 17 },

    // --- RECRUITER BANNER STYLES ---
    recruiterBanner: {
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderRadius: 20,
        padding: 24,
        marginVertical: 40,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.2)',
        borderStyle: 'dashed',
    },
    recruiterBannerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    recruiterBannerTag: {
        color: '#f59e0b',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    recruiterBannerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '900',
        marginBottom: 10,
    },
    recruiterBannerBody: {
        color: '#94a3b8',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 20,
    },
    recruiterBannerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
    },
    recruiterBannerBtnText: {
        color: '#3b82f6',
        fontWeight: 'bold',
        fontSize: 14,
    },
});
