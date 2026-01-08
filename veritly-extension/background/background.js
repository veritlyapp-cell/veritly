// Veritly Matcher - Background Service Worker
// Handles side panel opening and message passing

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_SIDEPANEL') {
        chrome.sidePanel.open({ tabId: sender.tab.id });
        sendResponse({ success: true });
    }

    if (message.type === 'ANALYZE_JOB') {
        // Forward job data to side panel
        chrome.runtime.sendMessage({
            type: 'JOB_DATA',
            data: message.data
        });
        sendResponse({ success: true });
    }

    if (message.type === 'GET_CREDITS') {
        chrome.storage.local.get(['credits', 'freeUsesRemaining'], (result) => {
            sendResponse({
                credits: result.credits || 0,
                freeUsesRemaining: result.freeUsesRemaining ?? 3
            });
        });
        return true; // Keep channel open for async response
    }

    if (message.type === 'USE_CREDIT') {
        chrome.storage.local.get(['credits', 'freeUsesRemaining'], (result) => {
            let freeUses = result.freeUsesRemaining ?? 3;
            let credits = result.credits || 0;

            if (freeUses > 0) {
                freeUses--;
                chrome.storage.local.set({ freeUsesRemaining: freeUses });
                sendResponse({ success: true, freeUsesRemaining: freeUses, credits });
            } else if (credits > 0) {
                credits--;
                chrome.storage.local.set({ credits });
                sendResponse({ success: true, freeUsesRemaining: 0, credits });
            } else {
                sendResponse({ success: false, error: 'NO_CREDITS' });
            }
        });
        return true;
    }

    if (message.type === 'ADD_CREDITS') {
        chrome.storage.local.get(['credits'], (result) => {
            const newCredits = (result.credits || 0) + message.amount;
            chrome.storage.local.set({ credits: newCredits });
            sendResponse({ success: true, credits: newCredits });
        });
        return true;
    }

    return true;
});

// Initialize default values on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        freeUsesRemaining: 3,
        credits: 0,
        userCV: null,
        analysisHistory: []
    });
    console.log('Veritly Matcher installed successfully');
});
