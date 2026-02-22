// Veritly Matcher - Side Panel Logic
// Handles CV sync, analysis, credits, and results display

(function () {
    'use strict';

    // Configuration
    const API_BASE = 'https://veritlyapp.com/api'; // Or local: http://localhost:8888/api

    // State
    let currentJobData = null;
    let userProfile = null; // { uid, email, cvUrl, etc }
    let isAnalyzing = false;

    // DOM Elements - Updated for new UI components
    const elements = {
        // Sections
        authSection: document.getElementById('auth-section'),
        cvSection: document.getElementById('cv-section'),
        jobSection: document.getElementById('job-section'),
        loadingSection: document.getElementById('loading-section'),
        resultsSection: document.getElementById('results-section'),
        paywallSection: document.getElementById('paywall-section'),
        syncStatus: document.getElementById('sync-status'),
        userStatus: document.getElementById('user-status'),

        // Auth
        loginEmail: document.getElementById('login-email'),
        loginPass: document.getElementById('login-password'),
        loginBtn: document.getElementById('login-btn'),
        userEmailDisplay: document.getElementById('user-email'),
        logoutBtn: document.getElementById('logout-btn'),
        googleLoginBtn: document.getElementById('google-login-btn'),

        // Credits / CV
        creditsCount: document.getElementById('credits-count'),
        creditsBadge: document.getElementById('credits-badge'),
        cvUploadZone: document.getElementById('cv-upload-zone'),
        cvInput: document.getElementById('cv-input'),
        cvLoaded: document.getElementById('cv-loaded'),
        cvFilename: document.getElementById('cv-filename'),
        removeCV: document.getElementById('remove-cv'),

        // Job
        jobTitle: document.getElementById('job-title'),
        jobCompany: document.getElementById('job-company'),
        analyzeBtn: document.getElementById('analyze-btn'),

        // Results
        circleProgress: document.getElementById('circle-progress'),
        scoreNumber: document.getElementById('score-number'),
        matchLabel: document.getElementById('match-label'),
        keywordsList: document.getElementById('keywords-list'),
        tipsList: document.getElementById('tips-list'),
        newAnalysisBtn: document.getElementById('new-analysis-btn'),

        // Payment
        subscribePremium: document.getElementById('subscribe-premium'),
        syncWebBtn: document.getElementById('sync-web-btn'),

        // New synced UI
        cvSyncedBanner: document.getElementById('cv-synced-banner'),
        waitingJob: document.getElementById('waiting-job')
    };

    // Initialize
    async function init() {
        await loadUserState();
        await syncWithWeb(); // Try to sync on startup
        setupEventListeners();
        setupMessageListener();
        updateCreditsDisplay();
    }

    // Load persistent user state
    async function loadUserState() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['userProfile', 'credits'], (result) => {
                if (result.userProfile) {
                    userProfile = result.userProfile;
                    showLoggedInState(userProfile.email);
                    syncUserProfile(userProfile.uid);
                } else {
                    showLoggedOutState();
                }
                resolve();
            });
        });
    }

    // Show Logged In State
    function showLoggedInState(email) {
        elements.authSection.style.display = 'none';
        elements.userStatus.style.display = 'flex';
        elements.userEmailDisplay.textContent = email;
        elements.cvSection.style.display = 'block';
        // Show synced banner, hide upload zone
        if (elements.cvSyncedBanner) elements.cvSyncedBanner.style.display = 'flex';
        if (elements.cvUploadZone) elements.cvUploadZone.style.display = 'none';
        // Show waiting for job if no job detected yet
        if (elements.waitingJob) elements.waitingJob.style.display = currentJobData ? 'none' : 'flex';
    }

    // Show Logged Out State
    function showLoggedOutState() {
        elements.authSection.style.display = 'block';
        elements.userStatus.style.display = 'none';
        elements.cvSection.style.display = 'none';
        elements.jobSection.style.display = 'none';
    }

    // Sync User Profile (and CV) from Firestore
    async function syncUserProfile(uid) {
        if (!uid) return;

        elements.syncStatus.style.display = 'flex';

        try {
            // We use a dedicated endpoint or directly fetch via Firestore REST API
            // For simplicity, we'll assume the sync happens when they login and we store their basic info
            // In a more robust version, we'd fetch the latest CV URL here
            console.log('Syncing data for user...', uid);

            // Re-fetch credits and profile info if needed
            // await updateCreditsDisplay();

        } catch (error) {
            console.error('Sync failed:', error);
        } finally {
            setTimeout(() => {
                elements.syncStatus.style.display = 'none';
            }, 1500);
        }
    }

    // Sync with Veritly Web Tab
    async function syncWithWeb() {
        if (userProfile) return; // Already logged in

        try {
            // Find Veritly tabs
            const tabs = await chrome.tabs.query({ url: "*://*.veritlyapp.com/*" });
            if (tabs.length === 0) return;

            for (const tab of tabs) {
                const result = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        // The API Key is still needed in the frontend for the cookie/localStorage key identification
                        // but it's not "secret" in the context of Firebase Web SDK, just better to avoid hardcoding 
                        // when possible. Here we use it to find the local session.
                        const key = `firebase:authUser:AIzaSyBbQwiklf0kWnz5V2_l6PgPeL679NyGEJ8:[DEFAULT]`;
                        return localStorage.getItem(key);
                    }
                });

                const authData = result[0]?.result;
                if (authData) {
                    const parsed = JSON.parse(authData);
                    if (parsed && parsed.uid) {
                        userProfile = {
                            uid: parsed.uid,
                            email: parsed.email,
                            displayName: parsed.displayName,
                            token: parsed.stsTokenManager?.accessToken,
                            lastLogin: new Date().toISOString()
                        };
                        await chrome.storage.local.set({ userProfile });
                        showLoggedInState(userProfile.email);
                        syncUserProfile(userProfile.uid);
                        return true;
                    }
                }
            }
        } catch (error) {
            console.error('Session sync error:', error);
        }
        return false;
    }

    // Setup event listeners
    function setupEventListeners() {
        // Auth
        elements.loginBtn.addEventListener('click', handleLogin);
        elements.logoutBtn.addEventListener('click', handleLogout);
        elements.googleLoginBtn.addEventListener('click', handleGoogleLogin);
        if (elements.syncWebBtn) elements.syncWebBtn.addEventListener('click', syncWithWeb);

        // CV Upload (with null checks for hidden elements)
        if (elements.cvUploadZone) elements.cvUploadZone.addEventListener('click', () => elements.cvInput.click());
        if (elements.cvInput) elements.cvInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleCVUpload(file);
        });
        if (elements.removeCV) elements.removeCV.addEventListener('click', removeCVLocal);

        // Analyze
        elements.analyzeBtn.addEventListener('click', performAnalysis);
        elements.newAnalysisBtn.addEventListener('click', resetToInitialState);

        // Payment (with null checks)
        const buy10 = document.getElementById('buy-10-credits');
        if (buy10) buy10.addEventListener('click', () => openExternal('checkout?product=10_credits'));
        if (elements.subscribePremium) elements.subscribePremium.addEventListener('click', () => openExternal('checkout?product=premium'));
    }

    // Handle Login (using Firebase REST API)
    async function handleLogin() {
        const email = elements.loginEmail.value;
        const password = elements.loginPass.value;

        if (!email || !password) return alert('Por favor ingresa tus datos');

        elements.loginBtn.disabled = true;
        elements.loginBtn.textContent = 'Entrando...';

        try {
            const response = await fetch(`${API_BASE}/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const dataText = await response.text();
            let data;
            try {
                data = JSON.parse(dataText);
            } catch (e) {
                console.error('Invalid JSON response from auth:', dataText);
                throw new Error('Error al conectar con el servidor de autenticación.');
            }

            if (!response.ok) throw new Error(data.error || 'Error de autenticación');

            userProfile = {
                uid: data.localId,
                email: data.email,
                token: data.idToken,
                lastLogin: new Date().toISOString()
            };

            await chrome.storage.local.set({ userProfile });
            showLoggedInState(userProfile.email);
            syncUserProfile(userProfile.uid);

        } catch (error) {
            console.error('Login error:', error);
            alert('Error al iniciar sesión: ' + (error.message === 'INVALID_LOGIN_CREDENTIALS' ? 'Credenciales incorrectas' : error.message));
        } finally {
            elements.loginBtn.disabled = false;
            elements.loginBtn.textContent = 'Entrar';
        }
    }

    // Handle Google Login
    function handleGoogleLogin() {
        // Since we don't have a Client ID for the extension, we redirect to the main site
        // The main site handles Google Auth and the user can then sync back
        openExternal('signin?source=extension');

        // Inform the user
        const originalText = elements.googleLoginBtn.innerHTML;
        elements.googleLoginBtn.innerHTML = 'Abriendo Veritly...';
        elements.googleLoginBtn.disabled = true;

        // Start polling for login
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            const synced = await syncWithWeb();
            if (synced || attempts > 30) {
                clearInterval(interval);
                elements.googleLoginBtn.innerHTML = originalText;
                elements.googleLoginBtn.disabled = false;
            }
        }, 2000);
    }

    // Handle Logout
    async function handleLogout() {
        userProfile = null;
        await chrome.storage.local.remove('userProfile');
        showLoggedOutState();
    }

    // Handle incoming job data from content script
    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'JOB_DATA') {
                handleJobData(message.data);
            }
        });
    }

    function handleJobData(data) {
        currentJobData = data;
        elements.jobTitle.textContent = data.title || 'Sin título';
        elements.jobCompany.textContent = data.company || 'Empresa no detectada';

        if (userProfile) {
            // Hide waiting prompt, show job section
            if (elements.waitingJob) elements.waitingJob.style.display = 'none';
            elements.jobSection.style.display = 'block';
            elements.resultsSection.style.display = 'none';
        }
    }

    // Perform real AI Analysis
    async function performAnalysis() {
        if (!userProfile) return alert('Debes iniciar sesión');
        if (!currentJobData) return alert('No se detectó vacante');
        if (isAnalyzing) return;

        isAnalyzing = true;
        elements.jobSection.style.display = 'none';
        elements.loadingSection.style.display = 'block';

        try {
            // Call the REAL backend function
            const response = await fetch(`${API_BASE}/save-match`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uid: userProfile.uid,
                    jobData: {
                        title: currentJobData.title,
                        company: currentJobData.company,
                        description: currentJobData.description,
                        url: currentJobData.url
                    }
                })
            });

            const dataText = await response.text();
            let result;
            try {
                result = JSON.parse(dataText);
            } catch (e) {
                console.error('Invalid JSON response from analysis:', dataText);
                throw new Error('Respuesta del servidor no válida (posible error de configuración/redirección).');
            }

            if (!response.ok) {
                throw new Error(result.error || `Error del servidor: ${response.status}`);
            }

            showResults(result);

        } catch (error) {
            console.error('Analysis failed:', error);
            alert('Error al analizar: ' + error.message);
            elements.loadingSection.style.display = 'none';
            elements.jobSection.style.display = 'block';
        } finally {
            isAnalyzing = false;
            updateCreditsDisplay();
        }
    }

    // UI Helpers
    function showResults(result) {
        elements.loadingSection.style.display = 'none';
        elements.resultsSection.style.display = 'block';

        animateScore(result.matchScore || 0);

        elements.matchLabel.textContent = (result.matchScore >= 70) ? '¡Buen match!' : 'Match regular';
        elements.matchLabel.style.color = (result.matchScore >= 70) ? '#22c55e' : '#f59e0b';

        // Keywords
        elements.keywordsList.innerHTML = (result.missingKeywords || []).map(k =>
            `<span class="keyword-tag">${k}</span>`
        ).join('') || '<p style="color:#d1d5db; font-size:12px;">¡Tienes todas las claves!</p>';

        // Tips
        elements.tipsList.innerHTML = (result.tips || []).map(t => `
            <div class="tip-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"/>
                </svg>
                <span>${t}</span>
            </div>
        `).join('');
    }

    function animateScore(targetScore) {
        const circumference = 2 * Math.PI * 45;
        elements.circleProgress.style.strokeDasharray = circumference;

        let start = 0;
        const duration = 1000;
        const startTime = performance.now();

        function step(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const current = Math.floor(progress * targetScore);
            elements.scoreNumber.textContent = current;

            const offset = circumference - (current / 100) * circumference;
            elements.circleProgress.style.strokeDashoffset = offset;

            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    async function updateCreditsDisplay() {
        // In a real scenario, this would fetch from the user_credits collection
        // For now, we'll keep the UI stable
        chrome.storage.local.get(['credits'], (res) => {
            elements.creditsCount.textContent = res.credits || 3;
        });
    }

    function resetToInitialState() {
        elements.resultsSection.style.display = 'none';
        elements.jobSection.style.display = 'block';
    }

    function openExternal(path) {
        chrome.tabs.create({ url: `https://veritlyapp.com/${path}` });
    }

    // Local CV Upload (Fallback)
    async function handleCVUpload(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const localCV = { name: file.name, data: e.target.result };
            await chrome.storage.local.set({ localCV });
            elements.cvUploadZone.style.display = 'none';
            elements.cvLoaded.style.display = 'flex';
            elements.cvFilename.textContent = file.name;
        };
        reader.readAsDataURL(file);
    }

    async function removeCVLocal() {
        await chrome.storage.local.remove('localCV');
        elements.cvUploadZone.style.display = 'flex';
        elements.cvLoaded.style.display = 'none';
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
