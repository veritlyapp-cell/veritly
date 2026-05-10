import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    onAuthStateChanged,
    sendEmailVerification,
    signInWithEmailAndPassword,
    signInWithPopup,
    signInAnonymously
} from 'firebase/auth';
import { addDoc, collection, doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp, deleteField, query, getDocs, where } from 'firebase/firestore';
import { deductCredit } from '../../services/credits-service';
import { saveAnalysisToCloud } from '../../services/storage';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
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
    Sparkles,
    Upload,
    User,
    Zap,
    Share2
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
    View,
    Share
} from 'react-native';
import { showAlert } from '../../utils/ui';
import CircularProgress from '../../components/CircularProgress';
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
    const [submitError, setSubmitError] = useState('');
    const [job, setJob] = useState<any>(null);
    const [applicantCount, setApplicantCount] = useState(0);
    const [companyName, setCompanyName] = useState('');
    const [companyLogo, setCompanyLogo] = useState('');
    const [companyType, setCompanyType] = useState<'empresa' | 'independiente' | ''>('');
    const [user, setUser] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);

    // AI Match Reveal
    const [revealingMatch, setRevealingMatch] = useState(false);
    const [matchResult, setMatchResult] = useState<any>(null);
    const [userCredits, setUserCredits] = useState<number>(5);
    const [candidateRefCode, setCandidateRefCode] = useState('');
    const [lastUploadedCv, setLastUploadedCv] = useState<{ url?: string; base64?: string; mimeType?: string } | null>(null);


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
    const [savedCv, setSavedCv] = useState<{ url: string; name: string } | null>(null);
    const [useSavedCv, setUseSavedCv] = useState(false);
    const [saveToProfile, setSaveToProfile] = useState(true);

    // Listen to auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            if (u) {
                console.log("👤 Usuario detectado en vacante:", u.email);
                setUser(u);
                setAuthLoading(false);
                setFullName(u.displayName || '');
                setAuthEmail(u.email || '');
                loadCandidateProfile(u.uid);
                setStep(prev => prev === 'auth' ? 'apply' : prev);
            } else {
                setUser(null);
                setAuthLoading(false);
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
            console.log("🔍 Cargando perfil completo para:", uid);
            const [snapCandidato, snapUser] = await Promise.all([
                getDoc(doc(db, 'users_candidatos', uid)),
                getDoc(doc(db, 'users', uid))
            ]);

            let foundCv: string | null = null;
            let foundCvName: string | null = null;
            let foundName: string | null = null;
            let foundPhone: string | null = null;

            // 1. Extraer de users_candidatos (Nuevo)
            if (snapCandidato.exists()) {
                const d = snapCandidato.data();
                foundName = d.fullName || d.profile?.fullName || foundName;
                foundPhone = d.phone || d.profile?.phone || foundPhone;
                foundCv = d.profile?.cv || d.profile?.cvUrl || d.cvUrl || d.cvBase64 || foundCv;
                foundCvName = d.profile?.cvName || d.profile?.fileName || d.cvFileName || foundCvName;
            }

            // 2. Extraer de users (Legacy / Perfil principal)
            if (snapUser.exists()) {
                const d = snapUser.data();
                foundName = foundName || d.profile?.fullName || d.fullName;
                foundPhone = foundPhone || d.profile?.phone || d.phone;
                // Buscar CV en todas sus posibles variantes
                foundCv = foundCv || d.profile?.cvUrl || d.profile?.cv || d.profile?.cvBase64 || d.cvUrl || d.cv;
                foundCvName = foundCvName || d.profile?.cvName || d.profile?.fileName || d.cvFileName;
            }

            if (foundName) setFullName(foundName);
            if (foundPhone) setPhone(foundPhone);

            if (foundCv) {
                console.log("✅ CV detectado con éxito");
                setSavedCv({ 
                    url: foundCv, 
                    name: foundCvName || 'Mi CV Guardado.pdf' 
                });
                setUseSavedCv(true);
            } else {
                console.warn("⚠️ No se encontró CV en ninguna colección para este usuario.");
            }

            // Créditos y otros datos (de cualquiera de las dos)
            const globalData = snapCandidato.exists() ? snapCandidato.data() : (snapUser.exists() ? snapUser.data() : null);
            if (globalData) {
                setUserCredits(globalData.aiCredits ?? globalData.profile?.aiCredits ?? 5);
                setCandidateRefCode(globalData.referralId || globalData.profile?.referralId || '');

                // Verificación profunda: ¿Realmente existe la postulación en la vacante?
                if (globalData.lastMatches && id && globalData.lastMatches[id as string]) {
                    const jobCandRef = query(collection(db, 'jobs', id as string, 'candidates'), where('email', '==', (auth.currentUser?.email || '').toLowerCase()));
                    const jobCandSnap = await getDocs(jobCandRef);
                    
                    if (!jobCandSnap.empty) {
                        console.log("✅ Confirmado: Postulación activa detectada.");
                        setMatchResult(globalData.lastMatches[id as string]);
                        setStep('success');
                    } else {
                        console.log("ℹ️ Match antiguo detectado pero candidato ya no existe en vacante. Permitiendo re-postulación.");
                        // Limpiar el match antiguo del perfil para no confundir
                        const userRef = doc(db, 'users', uid);
                        await updateDoc(userRef, { [`profile.lastMatches.${id}`]: deleteField() }).catch(() => {});
                    }
                }
            }
        } catch (e) {
            console.error('Error loading profile:', e);
        }
    };

    const generateRefCode = (nameText: string) => {
        const prefix = nameText.split(' ')[0].toUpperCase().substring(0, 6) || 'VERITLY';
        const random = Math.floor(1000 + Math.random() * 9000);
        return `${prefix}${random}`;
    };

    const ensureCandidateDoc = async (u: any, nameOverride?: string) => {
        const docRef = doc(db, 'users_candidatos', u.uid);
        const snap = await getDoc(docRef);
        
        if (!snap.exists()) {
            const initialName = nameOverride || u.displayName || '';
            const newRefCode = generateRefCode(initialName);
            await setDoc(docRef, {
                uid: u.uid,
                email: u.email,
                role: 'candidato',
                aiCredits: 5,
                referralId: newRefCode,
                referralUsages: 0,
                profile: {
                    fullName: initialName,
                    phone: '',
                },
                applications: [],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                source: 'external_link'
            });
            setUserCredits(5);
            setCandidateRefCode(newRefCode);
        } else {
            const data = snap.data();
            setUserCredits(data.aiCredits ?? 5);
            setCandidateRefCode(data.referralId || '');
        }
    };

    const loadJobDetails = async (jobId: string) => {
        try {
            const jobDoc = await getDoc(doc(db, 'jobs', jobId));
            if (!jobDoc.exists() || !jobDoc.data().isExternal) {
                showAlert('Vacante no disponible', 'Este enlace de postulación ya no está activo.');
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
            setCompanyLogo(data?.company?.logoUrl || data?.logoUrl || '');
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
                showAlert('Error', 'No se pudo iniciar sesión con Google.');
            }
        } finally {
            setAuthSubmitting(false);
        }
    };

    const handleEmailAuth = async () => {
        if (!authEmail || !authPassword) {
            showAlert('Campos vacíos', 'Por favor completa el correo y la contraseña.');
            return;
        }
        setAuthSubmitting(true);
        try {
            if (authMode === 'register') {
                if (!authName) {
                    showAlert('Nombre requerido', 'Por favor ingresa tu nombre completo.');
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
            showAlert('Error', msg);
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
                showAlert('Archivo muy grande', 'Por favor sube un documento que pese menos de 5MB.');
                return;
            }
            setFile(selectedFile);
        } catch {
            showAlert('Error', 'No se pudo cargar el documento.');
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
        if (!file && !useSavedCv) { errors.file = 'Debes subir tu CV o usar el guardado.'; hasErrors = true; }
        if (!acceptedTerms) { errors.terms = 'Debes aceptar la política de privacidad.'; hasErrors = true; }

        setFormErrors(errors);

        if (hasErrors) {
            showAlert('Campos por corregir', 'Por favor revisa los mensajes en texto rojo.');
            return;
        }

        setSubmitting(true);
        setSubmitError('');
        setSubmitStatus('Iniciando sesión segura...');
        
        try {
            console.log('--- Iniciando Postulación ---');
            
            // STEP 0: Ensure we are authenticated (Storage Rules usually require request.auth != null)
            if (!user) {
                try {
                    await signInAnonymously(auth);
                } catch (authErr) {
                    console.error("Auth error:", authErr);
                    // Continue anyway, maybe rules are public
                }
            }

            // Salary filter
            const budget = Number(job.salaryBudget) || 0;
            // ... (rest of filtering logic)
            // ... (I'll keep the actual logic from before)
            const maxBudget = budget > 0 ? budget * (1 + (Number(job.salaryTolerance) || 10) / 100) : Infinity;
            const minBudget = budget > 0 ? budget * (1 - (Number(job.salaryToleranceDown) || 10) / 100) : 0;
            const isSalaryRejected = budget > 0 && (expectationNumber > maxBudget || expectationNumber < minBudget);

            let isKillerRejected = false;
            let failureReason = '';
            const questions = job.killerQuestions || [];
            if (questions.length > 0) {
                questions.forEach((q: any, idx: number) => {
                    const ans = killerAnswers[idx] || 'no';
                    const expected = q.expectedAnswer || 'si';
                    if (ans !== expected) {
                        isKillerRejected = true;
                        failureReason = 'No cumple con requisitos críticos (Killer Questions).';
                    }
                });
            }

            const isRejected = isSalaryRejected || isKillerRejected;

            let cvUrl = useSavedCv ? savedCv?.url : null;
            let cvBase64 = null;

            if (file && !useSavedCv) {
                setSubmitStatus('Procesando archivo...');
                try {
                    const uploadTaskPromise = () => new Promise<{url?: string, base64?: string}>((resolve, reject) => {
                        const reader = new FileReader();
                        const nativeFile = (Platform.OS === 'web' && (file as any).file) ? (file as any).file : null;
                        const safeName = (fullName || 'candidato').replace(/[^a-zA-Z0-9]/g, '_');
                        const companyPath = job.companyId ? `company_${job.companyId}` : 'company_anon';
                        const jobPath = id ? `job_${id}` : 'job_unknown';
                        const fileRef = ref(storage, `cvs/${companyPath}/${jobPath}/${Date.now()}_${safeName}`);

                        reader.onload = async () => {
                            const result = reader.result as string;
                            const base64Data = result.split(',')[1];
                            const isSmallEnough = file.size < 750 * 1024;
                            
                            setSubmitStatus('Subiendo en Alta Velocidad...');
                            
                            const storagePromise = uploadString(fileRef, base64Data, 'base64', {
                                contentType: file.mimeType || 'application/pdf'
                            }).then(snap => getDownloadURL(snap.ref)).then(url => ({ url }));

                            const timeoutPromise = new Promise<{url?: string, base64: string}>((_, reject) => {
                                setTimeout(() => {
                                    if (isSmallEnough) resolve({ base64: base64Data }); // Bypass
                                    else reject(new Error("Timeout y archivo muy grande para bypass"));
                                }, 8000); 
                            });

                            try {
                                const finalRes = await Promise.race([storagePromise, timeoutPromise]);
                                resolve(finalRes);
                            } catch (e) {
                                if (isSmallEnough) resolve({ base64: base64Data });
                                else reject(e);
                            }
                        };

                        reader.onerror = () => reject(new Error("Error al leer archivo"));
                        if (nativeFile) reader.readAsDataURL(nativeFile);
                        else fetch(file.uri).then(res => res.blob()).then(b => reader.readAsDataURL(b)).catch(() => reject(new Error("Error procesando URI")));
                    });

                    const res = await uploadTaskPromise();
                    cvUrl = res.url || null;
                    cvBase64 = res.base64 || null;
                } catch (uploadErr: any) {
                    console.error('CV upload error:', uploadErr);
                    setSubmitError(`Error crítico de carga: El archivo es muy grande o hay un bloqueo de red.`);
                    setSubmitting(false);
                    return;
                }
            }

            // STEP 2: Duplicate Check (Safety Layer)
            setSubmitStatus('Verificando postulación previa...');
            const existingQuery = query(
                collection(db, 'jobs', id as string, 'candidates'),
                where('email', '==', (user?.email || authEmail).toLowerCase().trim())
            );
            const existingSnap = await getDocs(existingQuery);
            if (!existingSnap.empty) {
                setSubmitError('Ya te has postulado a esta vacante anteriormente.');
                setSubmitting(false);
                return;
            }

            // STEP 3: Save to Firestore
            setSubmitStatus('Sincronizando perfiles...');
            try {
                const docRef = await addDoc(collection(db, 'jobs', id as string, 'candidates'), {
                    fullName: fullName.trim(),
                    email: (user?.email || authEmail).toLowerCase().trim(),
                    phone: phone.trim(),
                    salaryExpectation: expectationNumber,
                    cvUrl: cvUrl,
                    cvBase64: cvBase64,
                    originalFileUrl: cvUrl,
                    cvFileName: file?.name || '',
                    appliedAt: serverTimestamp(),
                    status: isRejected ? (isSalaryRejected ? 'rejected_salary' : 'rejected') : 'pending_ai',
                    recruitmentStatus: isRejected ? (isSalaryRejected ? 'rejected_salary' : 'rejected') : 'screening',
                    failureReason: isSalaryRejected ? 'Presupuesto fuera de rango' : failureReason,
                    killerAnswers,
                    source: 'external_link',
                    userId: auth.currentUser?.uid || user?.uid || null,
                    jobId: id,
                    companyId: job.companyId || ''
                });
                setLastUploadedCv({ url: cvUrl, base64: cvBase64, mimeType: file?.mimeType });

                // OPCIONAL: Guardar en el perfil del usuario si marcó el checkbox
                if (saveToProfile && !useSavedCv && cvUrl) {
                    const profileRef = doc(db, 'users_candidatos', user.uid);
                    await updateDoc(profileRef, {
                        'profile.cv': cvUrl,
                        'profile.cvName': file?.name || 'CV_Veritly.pdf',
                        cvUrl: cvUrl, // Por redundancia
                        cvFileName: file?.name || 'CV_Veritly.pdf'
                    });
                }
            } catch (dbErr: any) {
                console.error('Firestore error:', dbErr);
                setSubmitError(`Error en base de datos: ${dbErr.message}`);
                setSubmitting(false);
                return;
            }

            // STEP 3: Show success
            setStep('success');
            setSubmitting(false);
            setSubmitStatus('');
        } catch (err: any) {
            console.error('Submit fatal error:', err);
            setSubmitError(`Error fatal: ${err.message || 'Hubo un error inesperado.'}`);
            setSubmitting(false);
        }
    };

    const handleRevealMatch = async () => {
        if (!user) return showAlert("Inicia Sesión", "Debes estar conectado para revelar tu match.");
        if (userCredits <= 0) return showAlert("Créditos Insuficientes", "Se te agotaron los créditos. Refiere amigos para ganar más.");

        setRevealingMatch(true);
        try {
            const { analyzeWithGemini, extractTextFromDocument } = await import('../../utils/gemini');
            
            let textToAnalyze = "";
            const cvSource = useSavedCv ? savedCv?.url : (lastUploadedCv?.base64 || lastUploadedCv?.url);
            if (cvSource) {
                try {
                    textToAnalyze = await extractTextFromDocument(
                        cvSource, 
                        lastUploadedCv?.mimeType || 'application/pdf'
                    );
                    
                    if (textToAnalyze && textToAnalyze.length < 50) {
                        console.warn("Extracción de CV muy corta, posible PDF escaneado sin OCR o error de lectura.");
                    }
                } catch (extractErr) {
                    console.error("Extract error:", extractErr);
                    // Fallback a info básica si falla la extracción del documento
                    textToAnalyze = `Nombre: ${fullName}. Teléfono: ${phone}. Email: ${user.email}`;
                    showAlert("Aviso", "No pudimos leer el detalle de tu CV (posible formato incompatible o muy corto). El análisis se basará en tu información básica.");
                }
            } else {
                textToAnalyze = `Nombre: ${fullName}. Teléfono: ${phone}. Email: ${user.email}`;
            }

            if (!textToAnalyze || textToAnalyze.length < 10) {
                throw new Error("No hay contenido suficiente para analizar.");
            }

            // Realizar análisis enfocado en candidato
            const result = await analyzeWithGemini(
                textToAnalyze, 
                job?.optimizedText || job?.originalText || job?.jobTitle || "Puesto de trabajo", 
                'text'
            );

            if (!result || !result.match) {
                console.error("Invalid AI result:", result);
                throw new Error("La IA no devolvió un resultado válido.");
            }

            setMatchResult(result);
            
            // 1. Deducir crédito usando el servicio estándar
            const successDeduct = await deductCredit(user.uid);
            if (successDeduct) {
                // Actualizar UI de créditos (aunque en esta pantalla usemos un state local simplificado)
                setUserCredits(prev => Math.max(0, prev - 1));
            }

            // 2. Guardar en el Historial del Scanner (para que salga en el dashboard)
            const analysisItem = {
                id: `match_${id}_${Date.now()}`,
                jobId: id,
                date: new Date().toISOString(),
                match: result.match,
                role: result.role || job.jobTitle,
                company: result.company || companyName,
                reason: result.reason,
                tips: result.tips,
                cvGaps: result.cvGaps,
                cvImprovements: result.cvImprovements,
                suggestedKeywords: result.suggestedKeywords,
                status: 'Postulado',
                link: `${window?.location?.origin || ''}/vacante/${id}`
            };

            await saveAnalysisToCloud(user.uid, analysisItem);

            // 3. También guardar en lastMatches para carga rápida local
            const userRef = doc(db, 'users_candidatos', user.uid);
            await setDoc(userRef, {
                lastMatches: {
                    [id as string]: result
                }
            }, { merge: true });

        } catch (e: any) {
            console.error("Error revealing match:", e);
            showAlert("Análisis Interrumpido", e.message || "No pudimos procesar el match en este momento. Intenta conectando tu cuenta o subiendo el CV de nuevo.");
        } finally {
            setRevealingMatch(false);
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
                <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
                <ScrollView key={`scroll-${step}`} contentContainerStyle={styles.scrollContent}>
                    {/* Company branding */}
                    <View style={styles.brandHeader}>
                        <View style={styles.companyAvatar}>
                            {companyLogo ? (
                                <Image source={{ uri: companyLogo }} style={styles.logoImageSmall} />
                            ) : (
                                <Text style={styles.companyAvatarText}>{companyName.charAt(0).toUpperCase()}</Text>
                            )}
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
                <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
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
        const handleShareReferral = async () => {
             try {
                 await Share.share({
                     message: `¡Hola! Únete a Veritly, la plataforma que me ayudó a mejorar mis postulaciones con IA. Usa mi código ${candidateRefCode} y gana créditos gratis para analizar tu CV: https://veritly.app`,
                 });
             } catch (error: any) {
                 console.error(error.message);
             }
        };

        return (
            <SafeAreaView style={styles.container}>
                <ScrollView key={`scroll-${step}`} contentContainerStyle={[styles.scrollContent]}>
                    <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                        <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(16, 185, 129, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                            <CheckCircle2 size={40} color="#10b981" />
                        </View>
                        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 }}>¡Postulación Enviada!</Text>
                        <Text style={{ color: '#94a3b8', textAlign: 'center', fontSize: 13, lineHeight: 19, marginBottom: 24 }}>
                            Tu perfil fue registrado correctamente para <Text style={{ color: 'white', fontWeight: 'bold' }}>{job.jobTitle}</Text>.
                        </Text>

                        {/* HOOK: AI MATCH REVEAL */}
                        <View style={{ width: '100%', backgroundColor: '#1e293b', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: matchResult ? '#3b82f6' : '#334155', marginBottom: 20 }}>
                            {!matchResult ? (
                                <View style={{ alignItems: 'center' }}>
                                    <Sparkles size={32} color="#f59e0b" style={{ marginBottom: 12 }} />
                                    <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>¿Quieres saber tu Match %?</Text>
                                    <Text style={{ color: '#94a3b8', textAlign: 'center', fontSize: 14, marginBottom: 20, lineHeight: 20 }}>
                                        Nuestra IA puede decirte qué tanto encaja tu CV con este puesto antes que el reclutador te llame.
                                    </Text>
                                    
                                    <TouchableOpacity 
                                        style={[styles.applyBtn, { width: '100%', backgroundColor: '#7c3aed', marginVertical: 0 }]} 
                                        onPress={handleRevealMatch}
                                        disabled={revealingMatch}
                                    >
                                        {revealingMatch ? (
                                            <ActivityIndicator color="white" />
                                        ) : (
                                            <>
                                                <Zap size={18} color="white" />
                                                <Text style={styles.applyBtnText}>REVELAR MI SCORE ✨</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                    <Text style={{ color: '#64748b', fontSize: 11, marginTop: 12 }}>
                                        Costo: 1 crédito (Te quedan {userCredits})
                                    </Text>
                                </View>
                            ) : (
                                <View style={{ alignItems: 'center' }}>
                                    <CircularProgress percentage={matchResult.match} size={100} strokeWidth={8} />
                                    <Text style={{ color: 'white', fontSize: 28, fontWeight: '900', marginTop: 16 }}>{matchResult.match}% Match</Text>
                                    <View style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20, marginTop: 8 }}>
                                        <Text style={{ color: '#38bdf8', fontSize: 12, fontWeight: 'bold' }}>{matchResult.reason || 'Excelente Potencial'}</Text>
                                    </View>
                                    
                                    <View style={{ width: '100%', height: 1, backgroundColor: '#334155', marginVertical: 20 }} />
                                    
                                    <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', fontStyle: 'italic', marginBottom: 20 }}>
                                        "Usaste 1 crédito de análisis. ¡Buen trabajo!"
                                    </Text>

                                    {/* REFERRAL CALLOUT */}
                                    <View style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#f59e0b', width: '100%' }}>
                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>🚀 ¿Quieres más créditos?</Text>
                                        <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 18 }}>
                                            Comparte tu código <Text style={{ color: '#f59e0b', fontWeight: 'bold' }}>{candidateRefCode}</Text> con amigos. Si se registran, ¡ambos ganan +2 créditos gratis!
                                        </Text>
                                        <TouchableOpacity 
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}
                                            onPress={handleShareReferral}
                                        >
                                            <Share2 size={16} color="#3b82f6" />
                                            <Text style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: 13 }}>COMPARTIR CÓDIGO</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>

                        <TouchableOpacity 
                            style={[styles.applyBtn, { width: '100%', backgroundColor: 'transparent', borderWidth: 1, borderColor: '#334155', shadowOpacity: 0, elevation: 0, marginTop: 40 }]} 
                            onPress={() => router.replace('/(tabs)')}
                        >
                            <Text style={{ color: '#94a3b8', fontWeight: 'bold' }}>IR A MI DASHBOARD</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ marginTop: 24, padding: 10 }} onPress={() => setStep('offer')}>
                            <Text style={{ color: '#475569', fontSize: 13, textDecorationLine: 'underline' }}>Volver a ver la descripción del puesto</Text>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        {companyLogo ? (
                            <Image source={{ uri: companyLogo }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                        ) : (
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(59, 130, 246, 0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: '#3b82f6', fontWeight: 'bold' }}>{companyName.charAt(0).toUpperCase()}</Text>
                            </View>
                        )}
                        <View>
                            <Text style={styles.applyTitle}>Tu Postulación</Text>
                            <Text style={styles.applySub}>
                                En {companyName}
                            </Text>
                        </View>
                    </View>
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
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <Text style={styles.sectionTitle}>Tu Currículum</Text>
                        {user && (
                            <View style={{ backgroundColor: '#0f172a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#1e293b' }}>
                                <Text style={{ color: '#38bdf8', fontSize: 10, fontWeight: 'bold' }}>👤 CONECTADO: {fullName.split(' ')[0]}</Text>
                            </View>
                        )}
                    </View>
                    
                    {savedCv && (
                        <TouchableOpacity 
                            style={[styles.savedCvOption, useSavedCv && styles.savedCvOptionActive]}
                            onPress={() => {
                                setUseSavedCv(true);
                                setFile(null); // Deseleccionar archivo manual
                            }}
                        >
                            <View style={[styles.radio, useSavedCv && styles.radioActive]}>
                                {useSavedCv && <View style={styles.radioInner} />}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.savedCvTitle}>Usar mi CV guardado</Text>
                                <Text style={styles.savedCvName}>{savedCv.name}</Text>
                            </View>
                            <FileText size={20} color={useSavedCv ? "#38bdf8" : "#64748b"} />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity 
                        style={[
                            styles.uploadCard, 
                            file && styles.uploadCardDone, 
                            formErrors.file && !useSavedCv && styles.uploadCardError,
                            useSavedCv && { opacity: 0.6, borderColor: '#334155' }
                        ]} 
                        onPress={() => {
                            setUseSavedCv(false);
                            handlePickDocument();
                        }}
                    >
                        {file ? (
                            <>
                                <CheckCircle2 size={28} color="#10b981" />
                                <Text style={[styles.uploadText, { color: '#10b981' }]}>{file.name}</Text>
                                <Text style={styles.uploadHint}>Toca para cambiar el archivo</Text>
                            </>
                        ) : (
                            <>
                                <Upload size={28} color={(formErrors.file && !useSavedCv) ? "#ef4444" : "#38bdf8"} />
                                <Text style={[styles.uploadText, (formErrors.file && !useSavedCv) && { color: "#ef4444" }]}>
                                    {useSavedCv ? 'Subir un CV diferente' : 'Subir CV (PDF o Word)'}
                                </Text>
                                <Text style={styles.uploadHint}>Máximo 5MB</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {file && !useSavedCv && (
                        <TouchableOpacity 
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingHorizontal: 4 }}
                            onPress={() => setSaveToProfile(!saveToProfile)}
                        >
                            <View style={[styles.checkbox, saveToProfile && styles.checkboxActive]}>
                                {saveToProfile && <CheckCircle2 size={12} color="white" />}
                            </View>
                            <Text style={{ color: '#94a3b8', fontSize: 13 }}>Guardar este CV como predeterminado en mi cuenta</Text>
                        </TouchableOpacity>
                    )}

                    {formErrors.file && !useSavedCv && !file && <Text style={[styles.errorText, { marginTop: 8 }]}>{formErrors.file}</Text>}
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

                {submitError ? (
                    <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                        <Text style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', fontWeight: 'bold' }}>{submitError}</Text>
                    </View>
                ) : null}

                {/* Submit */}
                <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={() => { setSubmitError(''); handleSubmit(); }} disabled={submitting}>
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
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    scrollContent: { padding: 20, paddingBottom: 120 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
    loadingText: { color: '#6B7280', marginTop: 12 },

    // Back button
    backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 6 },
    backBtnText: { color: '#6B7280', fontSize: 14 },

    // Brand Header
    brandHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
    companyAvatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#E0E7FF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    companyAvatarText: { color: '#4F46E5', fontWeight: 'bold', fontSize: 22 },
    logoImageSmall: { width: 52, height: 52, borderRadius: 16 },
    brandInfo: { flex: 1, gap: 2 },
    brandName: { color: '#111827', fontWeight: 'bold', fontSize: 16 },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    brandType: { color: '#6B7280', fontSize: 12, fontWeight: '500' },
    brandSeparator: { color: '#D1D5DB', fontSize: 12 },
    brandTag: { color: '#6B7280', fontSize: 12 },

    // Job Card
    jobCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#111827', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
    jobBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    jobBadgeText: { color: '#4F46E5', fontSize: 12, fontWeight: 'bold' },
    jobTitle: { color: '#111827', fontSize: 24, fontWeight: 'bold', marginBottom: 14 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    infoText: { color: '#6B7280', fontSize: 14 },

    errorText: { color: '#DC2626', fontSize: 12, marginTop: -8, marginBottom: 12 },
    inputError: { borderColor: '#DC2626' },

    // Description
    descCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
    descTitle: { color: '#4F46E5', fontWeight: 'bold', fontSize: 14, marginBottom: 12 },
    descText: { color: '#374151', fontSize: 14, lineHeight: 22 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10, marginBottom: 5 },
    skillTag: { backgroundColor: 'rgba(79,70,229,0.08)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(79,70,229,0.15)' },
    skillTagText: { color: '#4F46E5', fontSize: 13, fontWeight: '600' },

    // CTA
    applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#4F46E5', padding: 18, borderRadius: 16, marginVertical: 20, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
    applyBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    // Footer
    footerPowered: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 },
    footerPoweredText: { color: '#9CA3AF', fontSize: 11 },
    
    // Auth card
    authCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 28, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#111827', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
    authTitle: { color: '#111827', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    authSub: { color: '#6B7280', textAlign: 'center', fontSize: 13, marginBottom: 24, lineHeight: 19 },
    googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', padding: 14, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: '#E5E7EB' },
    googleBtnText: { color: '#111827', fontWeight: 'bold', fontSize: 15 },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 18, gap: 10 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
    dividerText: { color: '#9CA3AF', fontSize: 12 },
    inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, height: 50, marginBottom: 12 },
    inputIcon: { marginRight: 10 },
    authInput: { flex: 1, color: '#111827', fontSize: 15 },
    authSubmitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#4F46E5', padding: 16, borderRadius: 12, marginTop: 8 },
    authSubmitText: { color: 'white', fontWeight: 'bold', fontSize: 15 },

    // Apply form
    applyHeader: { marginBottom: 24 },
    applyTitle: { color: '#111827', fontSize: 24, fontWeight: 'bold' },
    applySub: { color: '#6B7280', fontSize: 14, marginTop: 4 },
    userPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(5,150,105,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
    userPillText: { color: '#059669', fontSize: 12, fontWeight: '500' },

    formSection: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
    sectionTitle: { color: '#111827', fontWeight: 'bold', fontSize: 16, marginBottom: 16 },
    label: { color: '#6B7280', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4 },
    input: { backgroundColor: '#F9FAFB', color: '#111827', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12, fontSize: 15 },

    // Salary
    salaryRangeHint: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(79,70,229,0.06)', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(79,70,229,0.15)', marginBottom: 14 },
    salaryRangeText: { color: '#4F46E5', fontSize: 12, fontWeight: '600' },
    salaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    currencyBadge: { backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, height: 50, borderTopLeftRadius: 10, borderBottomLeftRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
    currencyText: { color: '#059669', fontWeight: 'bold', fontSize: 16 },
    salaryInput: { flex: 1, backgroundColor: '#F9FAFB', color: '#111827', padding: 14, borderTopRightRadius: 10, borderBottomRightRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 16 },
    helperText: { color: '#9CA3AF', fontSize: 11, marginTop: 4 },

    // Killer questions
    killerCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
    killerQuestion: { color: '#111827', fontSize: 15, fontWeight: '500', marginBottom: 14, lineHeight: 22 },
    killerBtnsRow: { flexDirection: 'row', gap: 10 },
    killerBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
    killerBtnActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    killerBtnText: { color: '#9CA3AF', fontWeight: 'bold', fontSize: 15 },
    killerBtnTextActive: { color: 'white' },

    // Upload
    uploadCard: { borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', borderRadius: 16, padding: 28, alignItems: 'center', gap: 10, backgroundColor: 'rgba(79,70,229,0.02)' },
    uploadCardDone: { borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.04)', borderStyle: 'solid' },
    uploadCardError: { borderColor: '#DC2626', backgroundColor: 'rgba(220,38,38,0.04)' },
    uploadText: { color: '#111827', fontWeight: 'bold', fontSize: 15, textAlign: 'center' },
    uploadHint: { color: '#9CA3AF', fontSize: 12 },

    // Social Proof
    socialProof: {
        marginBottom: 20,
        backgroundColor: 'rgba(79, 70, 229, 0.06)',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(79, 70, 229, 0.12)',
        alignItems: 'center'
    },
    socialProofText: {
        color: '#4F46E5',
        fontSize: 13,
        fontWeight: '700'
    },

    // Sticky
    stickyCTA: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        padding: 20,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB'
    },
    shadowCTA: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 20
    },

    // AI Perception Overlay
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30
    },
    loadingBox: {
        backgroundColor: '#FFFFFF',
        padding: 32,
        borderRadius: 28,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#111827',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 8,
        width: '100%',
        maxWidth: 400
    },
    loadingTitle: {
        color: '#111827',
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 24
    },
    loadingMsg: {
        color: '#6B7280',
        fontSize: 15,
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 22
    },

    // Terms
    termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20, paddingHorizontal: 4 },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
    checkboxActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    checkboxError: { borderColor: '#DC2626' },
    termsText: { color: '#6B7280', fontSize: 13, lineHeight: 19 },

    // Submit
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#059669', padding: 18, borderRadius: 16, marginBottom: 20, shadowColor: '#059669', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
    submitBtnText: { color: 'white', fontWeight: 'bold', fontSize: 17 },

    // --- RECRUITER BANNER STYLES ---
    recruiterBanner: {
        backgroundColor: '#F9FAFB',
        borderRadius: 20,
        padding: 24,
        marginVertical: 40,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
    },
    recruiterBannerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    recruiterBannerTag: {
        color: '#D97706',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    recruiterBannerTitle: {
        color: '#111827',
        fontSize: 18,
        fontWeight: '900',
        marginBottom: 10,
    },
    recruiterBannerBody: {
        color: '#6B7280',
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
        color: '#4F46E5',
        fontWeight: 'bold',
        fontSize: 14,
    },
    // Saved CV
    savedCvOption: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 15, 
        backgroundColor: '#FFFFFF', 
        padding: 16, 
        borderRadius: 14, 
        borderWidth: 1, 
        borderColor: '#E5E7EB', 
        marginBottom: 16 
    },
    savedCvOptionActive: { 
        borderColor: '#4F46E5', 
        backgroundColor: 'rgba(79, 70, 229, 0.04)' 
    },
    radio: { 
        width: 22, 
        height: 22, 
        borderRadius: 11, 
        borderWidth: 2, 
        borderColor: '#D1D5DB', 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    radioActive: { 
        borderColor: '#4F46E5' 
    },
    radioInner: { 
        width: 10, 
        height: 10, 
        borderRadius: 5, 
        backgroundColor: '#4F46E5' 
    },
    savedCvTitle: { 
        color: '#111827', 
        fontSize: 14, 
        fontWeight: 'bold' 
    },
    savedCvName: { 
        color: '#94a3b8', 
        fontSize: 12, 
        marginTop: 2 
    },
});
