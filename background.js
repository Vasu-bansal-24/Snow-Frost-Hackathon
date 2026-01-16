// Consent Tracker - Background Service Worker
// Manages consent data storage, daily batch collection, and blockchain anchoring

// Import dependencies
importScripts('lib/merkleTree.js');
importScripts('blockchain.js');

// ============ Storage Initialization ============

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        consents: [],
        pendingBatch: { consents: [], dayTimestamp: null },
        anchoredBatches: []
    });
    console.log('🔒 Consent Tracker installed with batch anchoring!');
});

// ============ Message Handling ============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'CONSENT_DETECTED':
            saveConsent(message.data);
            sendResponse({ success: true });
            break;

        case 'GET_CONSENTS':
            getConsents().then(consents => sendResponse({ consents }));
            return true;

        case 'CLEAR_CONSENTS':
            clearConsents().then(() => sendResponse({ success: true }));
            return true;

        case 'DELETE_CONSENT':
            deleteConsent(message.id).then(() => sendResponse({ success: true }));
            return true;

        case 'VERIFY_CONSENT':
            BlockchainService.verifyConsent(message.hash).then(result => sendResponse(result));
            return true;

        case 'ANCHOR_BATCH':
            anchorDailyBatch().then(result => sendResponse(result));
            return true;

        case 'GET_BATCH_INFO':
            sendResponse(BlockchainService.getPendingBatchInfo());
            break;

        case 'GET_BLOCKCHAIN_STATS':
            sendResponse(BlockchainService.getStats());
            break;

        case 'GET_ALL_BATCHES':
            sendResponse(BlockchainService.getAllBatches());
            break;
    }
});

// ============ Consent Management ============

/**
 * Save consent with batch collection
 */
async function saveConsent(consentData) {
    try {
        // Generate consent hash and add to batch
        const consentHash = await BlockchainService.addConsentToBatch(consentData);

        // Attach hash to consent record
        consentData.proofHash = consentHash;
        consentData.batchStatus = 'pending'; // Will be 'anchored' after daily batch

        // Store consent locally
        const result = await chrome.storage.local.get(['consents']);
        const consents = result.consents || [];

        consents.unshift(consentData);

        // Keep only last 1000 consents
        if (consents.length > 1000) {
            consents.pop();
        }

        await chrome.storage.local.set({ consents });
        updateBadge(consents.length);

        // Check if we should auto-anchor (day changed)
        await checkDayChange();

        console.log('✅ Consent saved to batch:', BlockchainService.formatHashForDisplay(consentHash));
    } catch (error) {
        console.error('Error saving consent:', error);
    }
}

/**
 * Check if day changed and auto-anchor previous day's batch
 */
async function checkDayChange() {
    const batchInfo = BlockchainService.getPendingBatchInfo();
    const currentDay = BlockchainService.getDayTimestamp();

    if (batchInfo.dayTimestamp && batchInfo.dayTimestamp < currentDay) {
        console.log('📅 Day changed, auto-anchoring previous batch...');
        await anchorDailyBatch();
    }
}

/**
 * Anchor the daily batch manually or on day change
 */
async function anchorDailyBatch() {
    const batchInfo = BlockchainService.getPendingBatchInfo();

    if (batchInfo.count === 0) {
        return { success: false, message: 'No consents to anchor' };
    }

    const result = await BlockchainService.anchorPendingBatch();

    if (result && result.success) {
        // Update all pending consents to anchored status
        await updateConsentBatchStatus(result.txHash);

        console.log('🔗 Daily batch anchored:', result.txHash);
        return result;
    }

    return { success: false, message: 'Anchoring failed' };
}

/**
 * Update consent records with batch status
 */
async function updateConsentBatchStatus(txHash) {
    const result = await chrome.storage.local.get(['consents']);
    const consents = result.consents || [];

    consents.forEach(consent => {
        if (consent.batchStatus === 'pending') {
            consent.batchStatus = 'anchored';
            consent.txHash = txHash;
        }
    });

    await chrome.storage.local.set({ consents });
}

/**
 * Get all consents from storage
 */
async function getConsents() {
    try {
        const result = await chrome.storage.local.get(['consents']);
        return result.consents || [];
    } catch (error) {
        console.error('Error getting consents:', error);
        return [];
    }
}

/**
 * Clear all consents
 */
async function clearConsents() {
    try {
        await chrome.storage.local.set({ consents: [] });
        updateBadge(0);
        console.log('🗑️ All consents cleared');
    } catch (error) {
        console.error('Error clearing consents:', error);
    }
}

/**
 * Delete a specific consent
 */
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

// ============ Badge Management ============

function updateBadge(count) {
    const text = count > 0 ? (count > 99 ? '99+' : count.toString()) : '';
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: '#2F4550' });
}

// ============ Scheduled Anchoring ============

// Set up daily anchoring alarm
chrome.alarms.create('dailyAnchor', {
    periodInMinutes: 60 * 24 // Every 24 hours
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'dailyAnchor') {
        console.log('⏰ Daily anchor alarm triggered');
        anchorDailyBatch();
    }
});

// ============ Initialization ============

// Initialize badge and blockchain service on startup
chrome.storage.local.get(['consents']).then(result => {
    const count = (result.consents || []).length;
    updateBadge(count);
});

console.log('🚀 Background service started with batch anchoring support');