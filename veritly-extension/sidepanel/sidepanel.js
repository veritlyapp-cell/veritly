// Veritly Sourcing IA - Capture & Export Logic v5.4
// Con login por email/password para funcionar dentro de la extensión Chrome.

(function () {
    'use strict';

    const firebaseConfig = {
        apiKey: "AIzaSyBbQwiklf0kWnz5V2_l6PgPeL679NyGEJ8",
        authDomain: "auth.veritlyapp.com",
        projectId: "vinku-3a3af",
        storageBucket: "vinku-3a3af.firebasestorage.app",
        messagingSenderId: "1052083063406",
        appId: "1:1052083063406:web:20b981e0bf896caa7ab47f"
    };

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Usar persistencia LOCAL para que la sesión sobreviva entre aperturas del sidepanel
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    let currentUser = null;
    let currentCandidateData = null;
    let jobsMap = {};

    const elements = {
        loginSection: document.getElementById('login-section'),
        authContent: document.getElementById('auth-content'),
        candName: document.getElementById('cand-name'),
        candRole: document.getElementById('cand-role'),
        jobSelect: document.getElementById('cand-job-select'),
        importBtn: document.getElementById('direct-import-btn'),
        successSection: document.getElementById('success-section'),
        analysisPhase: document.getElementById('analysis-phase'),
        waitingSection: document.getElementById('waiting-section'),
        creditsCount: document.getElementById('user-credits-count'),
        loginEmail: document.getElementById('login-email'),
        loginPassword: document.getElementById('login-password'),
        loginError: document.getElementById('login-error'),
        loginBtn: document.getElementById('login-btn'),
        userEmailDisplay: document.getElementById('user-email-display')
    };

    function init() {
        auth.onAuthStateChanged(user => {
            if (user) {
                currentUser = user;
                elements.loginSection.style.display = 'none';
                elements.authContent.style.display = 'block';
                elements.userEmailDisplay.textContent = user.email;
                fetchJobs();
                fetchCredits();
                console.log("Veritly Sidepanel: Usuario autenticado:", user.email);
            } else {
                currentUser = null;
                elements.loginSection.style.display = 'block';
                elements.authContent.style.display = 'none';
                console.log("Veritly Sidepanel: No hay sesión activa.");
            }
        });

        setupListeners();
    }

    // ========== LOGIN / LOGOUT ==========
    window.handleLogin = async function () {
        const email = elements.loginEmail.value.trim();
        const password = elements.loginPassword.value;
        
        if (!email || !password) {
            showLoginError("Por favor, ingresa tu correo y contraseña.");
            return;
        }

        elements.loginBtn.textContent = 'INGRESANDO...';
        elements.loginBtn.disabled = true;
        hideLoginError();

        try {
            await auth.signInWithEmailAndPassword(email, password);
            // onAuthStateChanged se encargará del resto
        } catch (err) {
            console.error("Error de login:", err);
            let msg = "Error al iniciar sesión.";
            switch (err.code) {
                case 'auth/user-not-found':
                    msg = "No existe una cuenta con este correo.";
                    break;
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    msg = "Contraseña incorrecta.";
                    break;
                case 'auth/too-many-requests':
                    msg = "Demasiados intentos. Intenta de nuevo más tarde.";
                    break;
                case 'auth/invalid-email':
                    msg = "El correo no es válido.";
                    break;
                default:
                    msg = err.message;
            }
            showLoginError(msg);
        } finally {
            elements.loginBtn.textContent = 'INICIAR SESIÓN';
            elements.loginBtn.disabled = false;
        }
    };

    window.handleLogout = async function () {
        try {
            await auth.signOut();
        } catch (err) {
            console.error("Error al cerrar sesión:", err);
        }
    };

    function showLoginError(msg) {
        elements.loginError.textContent = msg;
        elements.loginError.style.display = 'block';
    }

    function hideLoginError() {
        elements.loginError.style.display = 'none';
    }

    // ========== CORE FUNCTIONS ==========
    async function fetchJobs() {
        try {
            const snap = await db.collection('jobs').where('companyId', '==', currentUser.uid).get();
            elements.jobSelect.innerHTML = '<option value="">Selecciona vacante destino...</option>';
            jobsMap = {};
            snap.forEach(doc => {
                const data = doc.data();
                jobsMap[doc.id] = data;
                elements.jobSelect.innerHTML += `<option value="${doc.id}">${data.jobTitle}</option>`;
            });
            if (snap.size === 1) elements.jobSelect.value = snap.docs[0].id;
            console.log("Veritly Sidepanel: Jobs cargados:", snap.size);
        } catch (err) { 
            console.error("Error jobs:", err); 
        }
    }

    async function fetchCredits() {
        try {
            const docSnap = await db.collection('user_credits').doc(currentUser.uid).get();
            if (docSnap.exists) {
                const data = docSnap.data();
                elements.creditsCount.textContent = (data.paidCredits || 0) + 3;
            } else {
                elements.creditsCount.textContent = '∞';
            }
        } catch (err) {
            console.error("Error credits:", err);
            elements.creditsCount.textContent = '∞';
        }
    }

    function setupListeners() {
        elements.importBtn.addEventListener('click', importNow);
        
        // Enter key en password para login rápido
        elements.loginPassword.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') window.handleLogin();
        });
        
        chrome.runtime.onMessage.addListener(m => {
            if(m.type === 'CANDIDATE_DATA') {
                showCandidateData(m.data);
            }
        });

        // Recuperar datos cacheados si el sidepanel se abrió después de que el content script envió datos
        chrome.storage.local.get('lastCandidateData', (result) => {
            if (result.lastCandidateData && !currentCandidateData) {
                showCandidateData(result.lastCandidateData);
                chrome.storage.local.remove('lastCandidateData');
            }
        });
    }

    function showCandidateData(data) {
        if (!data || (!data.name && !data.role)) {
            console.warn("Veritly Sidepanel: Recibidos datos vacíos o corruptos.");
            return;
        }

        currentCandidateData = data;
        const displayName = (data.name && data.name !== "Candidato LinkedIn") ? data.name : "Candidato Detectado";
        
        console.log("Veritly Sidepanel: Mostrando datos para:", displayName);
        
        const inputHtml = `<input type="text" id="cand-name-input" value="${displayName}" placeholder="Nombre del candidato" style="background:transparent; border:1px solid #4245c2; color:white; width:100%; border-radius:4px; padding:6px; font-weight:bold;">`;
        elements.candName.innerHTML = inputHtml;
        elements.candRole.textContent = data.role || "Profesional";
        elements.waitingSection.style.display = 'none';
        elements.analysisPhase.style.display = 'block';
    }

    async function importNow() {
        if (!currentUser) {
            alert("Debes iniciar sesión primero.");
            return;
        }
        if (!elements.jobSelect.value) {
            alert("Por favor, selecciona una vacante de destino.");
            return;
        }
        if (!currentCandidateData) {
            alert("No se ha capturado ningún perfil. Visita un perfil de LinkedIn.");
            return;
        }
        
        const nameVal = document.getElementById('cand-name-input')?.value || currentCandidateData.name;
        elements.importBtn.textContent = 'EXPORTANDO...';
        elements.importBtn.disabled = true;

        try {
            const now = new Date().toISOString();
            await db.collection('jobs').doc(elements.jobSelect.value).collection('candidates').add({
                fullName: nameVal,
                linkedinUrl: currentCandidateData.url,
                role: currentCandidateData.role,
                about: currentCandidateData.about || "",
                experience: currentCandidateData.experience || "",
                status: 'sourcing_pending',
                recruitmentStatus: 'sourcing_pending',
                source: 'veritly_sourcing',
                matchScore: 0,
                createdAt: now,
                analyzedAt: now,
                companyId: currentUser.uid
            });

            console.log("Veritly Sidepanel: ¡Candidato exportado exitosamente!");
            elements.analysisPhase.style.display = 'none';
            elements.successSection.style.display = 'block';
        } catch (err) {
            console.error("Error al exportar:", err);
            alert("Error al exportar: " + err.message);
            elements.importBtn.textContent = 'REINTENTAR EXPORTAR';
            elements.importBtn.disabled = false;
        }
    }

    init();
})();
