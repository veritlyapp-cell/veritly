// Veritly Sourcing - Content Script v5.4
// Robust LinkedIn Profile Scraper (2026 selectors)

console.log("Veritly Content Script: Activado v5.4");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_CANDIDATE_DATA') {
        try {
            const data = extractCandidateData();
            sendResponse({ success: true, data });
        } catch (err) {
            sendResponse({ success: false, error: err.message });
        }
    }
    return true;
});

function extractCandidateData() {
    console.log("Veritly: Extrayendo datos del perfil...");

    // 1. NOMBRE - Multi-strategy extraction
    let name = "";
    
    const nameSelectors = [
        'h1.text-heading-xlarge',
        '.text-heading-xlarge',
        '.pv-top-card-section__name',
        '.pv-text-details__left-panel h1',
        'main h1',
        'header .artdeco-entity-lockup__title',
        'section .artdeco-entity-lockup__title',
        '.top-card-layout__title',
        '[data-anonymize="person-name"]',
        '#name',
        'h1'
    ];
    
    for (const sel of nameSelectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) { // Ensure it's visible
            let text = el.textContent?.trim() || "";
            // Remove emojis and multiple lines
            text = text.split('\n')[0].replace(/[\u2700-\u27bf]|[\u2600-\u26ff]/g, '').trim();
            if (text && text.length > 1 && text.length < 100 && !text.includes("LinkedIn")) {
                name = text;
                break;
            }
        }
    }
    
    if (!name) name = "Candidato LinkedIn";
    console.log("Veritly: Nombre extraído:", name);

    // 2. CARGO/HEADLINE
    let role = "Profesional";
    const roleSelectors = [
        '.text-body-medium.break-words',
        '.pv-text-details__left-panel .text-body-medium',
        '.text-body-medium',
        '[data-anonymize="headline"]',
        '.pv-top-card-section__headline',
        '.top-card-layout__headline'
    ];
    for (const sel of roleSelectors) {
        const el = document.querySelector(sel);
        if (el) {
            const text = el.textContent?.trim();
            if (text && text.length > 2 && !text.includes("LinkedIn")) {
                role = text;
                break;
            }
        }
    }
    console.log("Veritly: Cargo extraído:", role);

    // 3. ABOUT / ACERCA DE
    let about = "";
    try {
        const aboutSection = document.querySelector('#about');
        if (aboutSection) {
            const section = aboutSection.closest('section');
            if (section) {
                // Try multiple selectors for the about content
                const aboutEl = section.querySelector('.inline-show-more-text') 
                    || section.querySelector('[class*="inline-show-more"]')
                    || section.querySelector('.pv-shared-text-with-see-more span[aria-hidden="true"]')
                    || section.querySelector('.full-width span[aria-hidden="true"]');
                if (aboutEl) {
                    about = aboutEl.textContent?.trim() || "";
                }
                // Fallback: get all text from the section minus the header
                if (!about) {
                    const allText = section.textContent || "";
                    about = allText.replace(/Acerca de/i, '').trim().substring(0, 2000);
                }
            }
        }
    } catch (e) { console.warn("Veritly: Fail about", e); }
    console.log("Veritly: About extraído:", about.substring(0, 80) + "...");

    // 4. EXPERIENCIAS - Robust multi-selector
    let experienceText = "";
    try {
        const expSection = document.querySelector('#experience');
        if (expSection) {
            const section = expSection.closest('section');
            if (section) {
                // Try structured list items first
                const listItems = section.querySelectorAll('li.artdeco-list__item') 
                    || section.querySelectorAll('ul > li');
                
                if (listItems && listItems.length > 0) {
                    listItems.forEach((item, index) => {
                        if (index < 6) {
                            const text = item.textContent?.replace(/\s+/g, ' ').trim();
                            if (text && text.length > 10) {
                                experienceText += `[PUESTO ${index+1}] ${text}\n\n`;
                            }
                        }
                    });
                }
                
                // Fallback: grab all section text
                if (!experienceText) {
                    const sectionText = section.textContent || "";
                    experienceText = sectionText.replace(/Experiencia/i, '').replace(/\s+/g, ' ').trim().substring(0, 3000);
                }
            }
        }
    } catch (e) { console.warn("Veritly: Fail experience", e); }
    console.log("Veritly: Experience length:", experienceText.length);

    const result = {
        name,
        role,
        about,
        experience: experienceText,
        url: window.location.href,
        timestamp: new Date().toISOString()
    };

    console.log("Veritly: Datos completos extraídos:", { name: result.name, role: result.role, aboutLen: result.about.length, expLen: result.experience.length });
    return result;
}

// Inyección de botón flotante
if (!document.getElementById('veritly-floating-btn')) {
    const btn = document.createElement('div');
    btn.id = 'veritly-floating-btn';
    btn.innerHTML = 'V';
    btn.style.cssText = `
        position: fixed; bottom: 30px; right: 30px; z-index: 9999;
        background: #4245c2; color: white; width: 50px; height: 50px;
        border-radius: 50%; display: flex; align-items: center; justify-content: center;
        font-weight: 900; font-size: 24px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        transition: transform 0.2s;
    `;
    btn.onmouseenter = () => btn.style.transform = 'scale(1.1)';
    btn.onmouseleave = () => btn.style.transform = 'scale(1)';
    btn.onclick = () => chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });
    document.body.appendChild(btn);
}

// Auto-envío de datos (cada 3s)
let lastSentUrl = '';
setInterval(() => {
    try {
        // Solo enviar si estamos en un perfil y la URL cambió
        const currentUrl = window.location.href;
        if (currentUrl.includes('/in/') && currentUrl !== lastSentUrl) {
            // Esperar un momento para que la página cargue
            setTimeout(() => {
                const data = extractCandidateData();
                if (data.name && data.name !== "Candidato LinkedIn") {
                    chrome.runtime.sendMessage({ type: 'CANDIDATE_DATA', data });
                    lastSentUrl = currentUrl;
                    console.log("Veritly: Datos enviados para", data.name);
                }
            }, 1500);
        }
    } catch (e) {}
}, 3000);
