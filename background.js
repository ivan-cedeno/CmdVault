// background.js — CmdVault Service Worker

// --- Side Panel Behavior Setup ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
});

// --- Offscreen Document Management ---
// Global promise to prevent concurrent offscreen document creation.
// Chrome allows only ONE offscreen document per extension at a time.
let creatingOffscreen = null;

async function setupOffscreenDocument() {
    const offscreenUrl = chrome.runtime.getURL('offscreen.html');

    // Check for existing offscreen documents (Chrome 116+)
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return; // Offscreen document already exists
    }

    // Guard against concurrent creation attempts
    if (creatingOffscreen) {
        await creatingOffscreen;
    } else {
        creatingOffscreen = chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: [chrome.offscreen.Reason.CLIPBOARD],
            justification: 'Clear the system clipboard after auto-clear timer expires.'
        });
        await creatingOffscreen;
        creatingOffscreen = null;
    }
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'clear-clipboard') {
        handleClipboardClear()
            .then((result) => sendResponse({ success: true }))
            .catch((error) => {
                console.error('Clipboard clear failed:', error);
                sendResponse({ success: false, error: error.message });
            });

        // Return true to indicate async response
        return true;
    }
});

async function handleClipboardClear() {
    // 1. Ensure the offscreen document exists
    await setupOffscreenDocument();

    // 2. Send the clear command to the offscreen document and wait for response
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            type: 'copy-data-to-clipboard',
            target: 'offscreen-doc',
            data: ' '
        }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.success) {
                resolve(response);
            } else {
                reject(new Error(response?.error || 'Unknown clipboard error'));
            }
        });
    });
}
