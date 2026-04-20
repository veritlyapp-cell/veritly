// Veritly Sourcing - Background Service Worker v5.4
// Side Panel Manager + Message Relay

chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setOptions({ path: 'sidepanel/sidepanel.html', enabled: true });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Abrir Sidepanel desde el botón flotante en LinkedIn
    if (message.type === 'OPEN_SIDEPANEL') {
        if (sender.tab) {
            chrome.sidePanel.open({ windowId: sender.tab.windowId });
        }
        sendResponse({ success: true });
    }

    // Escuchar datos del candidato desde content.js y pasarlos al panel si está abierto
    if (message.type === 'CANDIDATE_DATA') {
        // Envolver en try-catch y usar .catch() para evitar el error
        // "Could not establish connection" cuando el sidepanel no está abierto
        chrome.runtime.sendMessage(message).catch(() => {
            // Sidepanel no está abierto, guardar datos temporalmente
            chrome.storage.local.set({ lastCandidateData: message.data });
        });
    }
});
