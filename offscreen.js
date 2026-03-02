// offscreen.js — CmdVault Clipboard Operations
// Handles clipboard write requests from the background service worker.
// Uses document.execCommand('copy') because navigator.clipboard.writeText()
// requires document focus, which offscreen documents cannot have.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only process messages targeted at this offscreen document
    if (message.target !== 'offscreen-doc') {
        return false;
    }

    if (message.type === 'copy-data-to-clipboard') {
        const textEl = document.querySelector('#text');

        try {
            // Write a single space to overwrite clipboard contents.
            // execCommand('copy') requires non-empty selected text to work.
            // An empty string selects nothing, so the clipboard stays unchanged.
            const data = message.data || ' ';
            textEl.value = data.length > 0 ? data : ' ';
            textEl.select();
            document.execCommand('copy');
            sendResponse({ success: true });
        } catch (err) {
            sendResponse({ success: false, error: err.message });
        }

        // Close after a small delay to ensure the response is sent
        setTimeout(() => window.close(), 100);
        return true; // Keep message channel open for async sendResponse
    }
});
