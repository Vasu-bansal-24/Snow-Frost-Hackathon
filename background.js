// Consent Tracker - Background Service Worker
// Manages consent data storage and badge updates

// Initialize storage on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ consents: [] });
    console.log('🔒 Consent Tracker installed!');
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CONSENT_DETECTED') {
        saveConsent(message.data);
        sendResponse({ success: true });
    } else if (message.type === 'GET_CONSENTS') {
        getConsents().then(consents => sendResponse({ consents }));
        return true; // Keep message channel open for async response
    } else if (message.type === 'CLEAR_CONSENTS') {
        clearConsents().then(() => sendResponse({ success: true }));
        return true;
    } else if (message.type === 'DELETE_CONSENT') {
        deleteConsent(message.id).then(() => sendResponse({ success: true }));
        return true;
    }
});

// Save consent to storage
async function saveConsent(consentData) {
    try {
        const result = await chrome.storage.local.get(['consents']);
        const consents = result.consents || [];

        // Add new consent at the beginning
        consents.unshift(consentData);

        // Keep only last 1000 consents to prevent storage bloat
        if (consents.length > 1000) {
            consents.pop();
        }

        await chrome.storage.local.set({ consents });

        // Update badge
        updateBadge(consents.length);

        console.log('✅ Consent saved:', consentData.buttonText, 'on', consentData.domain);
    } catch (error) {
        console.error('Error saving consent:', error);
    }
}

// Get all consents from storage
async function getConsents() {
    try {
        const result = await chrome.storage.local.get(['consents']);
        return result.consents || [];
    } catch (error) {
        console.error('Error getting consents:', error);
        return [];
    }
}

// Clear all consents
async function clearConsents() {
    try {
        await chrome.storage.local.set({ consents: [] });
        updateBadge(0);
        console.log('🗑️ All consents cleared');
    } catch (error) {
        console.error('Error clearing consents:', error);
    }
}

// Delete a specific consent
async function deleteConsent(id) {
    try {
        const result = await chrome.storage.local.get(['consents']);
        const consents = (result.consents || []).filter(c => c.id !== id);
        await chrome.storage.local.set({ consents });
        updateBadge(consents.length);
        console.log('🗑️ Consent deleted:', id);
    } catch (error) {
        console.error('Error deleting consent:', error);
    }
}

// Update extension badge
function updateBadge(count) {
    const text = count > 0 ? (count > 99 ? '99+' : count.toString()) : '';
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: '#2F4550' });
}

// Initialize badge on startup
chrome.storage.local.get(['consents']).then(result => {
    const count = (result.consents || []).length;
    updateBadge(count);
});