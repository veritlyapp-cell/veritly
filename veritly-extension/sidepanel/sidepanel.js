// Veritly Matcher - Side Panel Logic
// Handles CV upload, analysis, credits, and results display

(function () {
    'use strict';

    // API Configuration
    const API_BASE = 'https://veritlyapp.com/api';

    // State
    let currentJobData = null;
    let userCV = null;

    // DOM Elements
    const elements = {
        creditsCount: document.getElementById('credits-count'),
        creditsBadge: document.getElementById('credits-badge'),
        cvSection: document.getElementById('cv-section'),
        cvUploadZone: document.getElementById('cv-upload-zone'),
        cvInput: document.getElementById('cv-input'),
        cvLoaded: document.getElementById('cv-loaded'),
        cvFilename: document.getElementById('cv-filename'),
        removeCV: document.getElementById('remove-cv'),
        jobSection: document.getElementById('job-section'),
        jobTitle: document.getElementById('job-title'),
        jobCompany: document.getElementById('job-company'),
        analyzeBtn: document.getElementById('analyze-btn'),
        loadingSection: document.getElementById('loading-section'),
        resultsSection: document.getElementById('results-section'),
        circleProgress: document.getElementById('circle-progress'),
        scoreNumber: document.getElementById('score-number'),
        matchLabel: document.getElementById('match-label'),
        keywordsList: document.getElementById('keywords-list'),
        tipsList: document.getElementById('tips-list'),
        newAnalysisBtn: document.getElementById('new-analysis-btn'),
        paywallSection: document.getElementById('paywall-section'),
        buy10Credits: document.getElementById('buy-10-credits'),
        subscribePremium: document.getElementById('subscribe-premium')
    };

    // Initialize
    async function init() {
        await loadUserData();
        setupEventListeners();
        setupMessageListener();
        updateCreditsDisplay();
    }

    // Load user data from storage
    async function loadUserData() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['userCV', 'freeUsesRemaining', 'credits'], (result) => {
                if (result.userCV) {
                    userCV = result.userCV;
                    showCVLoaded(result.userCV.name);
                }
                resolve();
            });
        });
    }

    // Setup event listeners
    function setupEventListeners() {
        // CV Upload - Drag & Drop
        elements.cvUploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.cvUploadZone.classList.add('dragover');
        });

        elements.cvUploadZone.addEventListener('dragleave', () => {
            elements.cvUploadZone.classList.remove('dragover');
        });

        elements.cvUploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.cvUploadZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/pdf') {
                handleCVUpload(file);
            }
        });

        // CV Upload - Click
        elements.cvUploadZone.addEventListener('click', () => {
            elements.cvInput.click();
        });

        elements.cvInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleCVUpload(file);
            }
        });

        // Remove CV
        elements.removeCV.addEventListener('click', () => {
            removeCVData();
        });

        // Analyze button
        elements.analyzeBtn.addEventListener('click', () => {
            performAnalysis();
        });

        // New analysis button
        elements.newAnalysisBtn.addEventListener('click', () => {
            resetToInitialState();
        });

        // Payment buttons
        elements.buy10Credits.addEventListener('click', () => {
            handlePurchase('10_credits');
        });

        elements.subscribePremium.addEventListener('click', () => {
            handlePurchase('premium');
        });
    }

    // Listen for messages from content script
    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'JOB_DATA') {
                handleJobData(message.data);
            }
        });
    }

    // Handle CV upload
    async function handleCVUpload(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            userCV = {
                name: file.name,
                data: e.target.result,
                uploadedAt: new Date().toISOString()
            };

            // Save to storage
            await chrome.storage.local.set({ userCV });

            showCVLoaded(file.name);
        };
        reader.readAsDataURL(file);
    }

    // Show CV loaded state
    function showCVLoaded(filename) {
        elements.cvUploadZone.style.display = 'none';
        elements.cvLoaded.style.display = 'flex';
        elements.cvFilename.textContent = filename;
    }

    // Remove CV data
    async function removeCVData() {
        userCV = null;
        await chrome.storage.local.remove('userCV');
        elements.cvUploadZone.style.display = 'flex';
        elements.cvLoaded.style.display = 'none';
    }

    // Handle incoming job data
    function handleJobData(data) {
        currentJobData = data;
        elements.jobTitle.textContent = data.title || 'Sin título';
        elements.jobCompany.textContent = data.company || 'Empresa no detectada';
        elements.jobSection.style.display = 'block';
        elements.resultsSection.style.display = 'none';
        elements.paywallSection.style.display = 'none';
    }

    // Update credits display
    async function updateCreditsDisplay() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['freeUsesRemaining', 'credits'], (result) => {
                const freeUses = result.freeUsesRemaining ?? 3;
                const credits = result.credits || 0;
                const total = freeUses + credits;

                elements.creditsCount.textContent = total;

                if (total === 0) {
                    elements.creditsBadge.classList.add('empty');
                } else {
                    elements.creditsBadge.classList.remove('empty');
                }

                resolve({ freeUses, credits });
            });
        });
    }

    // Perform analysis
    async function performAnalysis() {
        if (!userCV) {
            alert('Por favor sube tu CV primero');
            return;
        }

        if (!currentJobData) {
            alert('No se ha detectado ninguna vacante');
            return;
        }

        // Check credits
        const { freeUses, credits } = await updateCreditsDisplay();

        if (freeUses === 0 && credits === 0) {
            showPaywall();
            return;
        }

        // Show loading
        elements.jobSection.style.display = 'none';
        elements.loadingSection.style.display = 'block';

        try {
            // Use credit
            await chrome.runtime.sendMessage({ type: 'USE_CREDIT' });

            // Simulate AI analysis (replace with actual API call)
            const analysisResult = await simulateAnalysis(currentJobData);

            // Save to backend
            await saveMatchToBackend(analysisResult);

            // Show results
            showResults(analysisResult);

        } catch (error) {
            console.error('Analysis error:', error);
            alert('Error al analizar. Por favor intenta de nuevo.');
            elements.loadingSection.style.display = 'none';
            elements.jobSection.style.display = 'block';
        }

        await updateCreditsDisplay();
    }

    // Simulate AI analysis (replace with actual Gemini API call)
    async function simulateAnalysis(jobData) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Mock analysis results
        const matchScore = Math.floor(Math.random() * 40) + 60; // 60-100

        const missingKeywords = [
            'Python',
            'Machine Learning',
            'SQL',
            'Experiencia en startups'
        ].slice(0, Math.floor(Math.random() * 3) + 1);

        const tips = [
            'Destaca tus proyectos relacionados con análisis de datos',
            'Menciona experiencia específica con las herramientas requeridas',
            'Incluye métricas cuantificables de tus logros anteriores'
        ];

        return {
            jobData,
            matchScore,
            missingKeywords,
            tips,
            analyzedAt: new Date().toISOString()
        };
    }

    // Save match to backend
    async function saveMatchToBackend(analysisResult) {
        try {
            const response = await fetch(`${API_BASE}/save-match`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    jobUrl: analysisResult.jobData.url,
                    jobTitle: analysisResult.jobData.title,
                    company: analysisResult.jobData.company,
                    matchScore: analysisResult.matchScore,
                    missingKeywords: analysisResult.missingKeywords,
                    tips: analysisResult.tips,
                    analyzedAt: analysisResult.analyzedAt
                })
            });

            if (!response.ok) {
                console.warn('Failed to save match to backend');
            }
        } catch (error) {
            console.warn('Backend save error:', error);
        }
    }

    // Show results
    function showResults(result) {
        elements.loadingSection.style.display = 'none';
        elements.resultsSection.style.display = 'block';

        // Animate score
        animateScore(result.matchScore);

        // Set match label
        if (result.matchScore >= 80) {
            elements.matchLabel.textContent = '¡Excelente match!';
            elements.matchLabel.style.color = '#22c55e';
        } else if (result.matchScore >= 60) {
            elements.matchLabel.textContent = 'Buen match';
            elements.matchLabel.style.color = '#38bdf8';
        } else {
            elements.matchLabel.textContent = 'Match bajo';
            elements.matchLabel.style.color = '#f59e0b';
        }

        // Render keywords
        elements.keywordsList.innerHTML = result.missingKeywords.map(keyword => `
      <span class="keyword-tag">${keyword}</span>
    `).join('');

        // Render tips
        elements.tipsList.innerHTML = result.tips.map(tip => `
      <div class="tip-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20,6 9,17 4,12"/>
        </svg>
        <span>${tip}</span>
      </div>
    `).join('');
    }

    // Animate score circle
    function animateScore(targetScore) {
        const circumference = 2 * Math.PI * 45;
        elements.circleProgress.style.strokeDasharray = circumference;

        let currentScore = 0;
        const duration = 1500;
        const startTime = performance.now();

        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            currentScore = Math.floor(progress * targetScore);
            elements.scoreNumber.textContent = currentScore;

            const offset = circumference - (progress * targetScore / 100) * circumference;
            elements.circleProgress.style.strokeDashoffset = offset;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }

        requestAnimationFrame(animate);
    }

    // Show paywall
    function showPaywall() {
        elements.jobSection.style.display = 'none';
        elements.resultsSection.style.display = 'none';
        elements.paywallSection.style.display = 'block';
    }

    // Handle purchase
    function handlePurchase(type) {
        // Open Veritly payment page
        const paymentUrl = `https://veritlyapp.com/checkout?product=${type}&source=extension`;
        chrome.tabs.create({ url: paymentUrl });
    }

    // Reset to initial state
    function resetToInitialState() {
        currentJobData = null;
        elements.resultsSection.style.display = 'none';
        elements.paywallSection.style.display = 'none';
        elements.jobSection.style.display = 'none';
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
