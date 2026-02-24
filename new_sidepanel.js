const FOLDER_COLORS = ['#F37423', '#7DCFFF', '#8CD493', '#E4A8F2', '#FF5252', '#7C4DFF', '#CFD8DC', '#424242'];

const GIST_FILENAME = 'ivan_helper_backup.json';
const BACKUP_MAX_VERSIONS = 3; // Keep last N versioned backups in Gist

// --- SMART CLOUD TAGS ---
const CLOUD_TAG_CONFIG = {
    'aws': {
        cssClass: 'cloud-aws',
        icon: `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path><path d="M8 16c1.5 1 3.5 1 5 0" stroke-width="1.5"></path></svg>`
    },
    'azure': {
        cssClass: 'cloud-azure',
        icon: `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path><line x1="13" y1="11" x2="11" y2="17"></line><polyline points="9 14 11 17 13 14" stroke-width="1.5"></polyline></svg>`
    },
    'gcp': {
        cssClass: 'cloud-gcp',
        icon: `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path><polyline points="10 16 12 13 14 16" stroke-width="1.5"></polyline><line x1="12" y1="13" x2="12" y2="17" stroke-width="1.5"></line></svg>`
    },
    'all clouds': {
        cssClass: 'cloud-all',
        icon: `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>`
    }
};

// --- ICON SVG MAP (Resolves short icon IDs to SVG strings at render time) ---
const ICON_SVG_MAP = {
    'cmd': `<svg class="folder-icon-v3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`,
    'txt': `<svg class="folder-icon-v3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>`
};

/**
 * Resolves an icon value to its SVG string or returns the original value.
 * Handles: SVG IDs ('cmd', 'txt'), legacy emoji ('⌨️'), null/undefined, and plain emojis.
 */
function resolveIcon(iconValue) {
    if (!iconValue || iconValue === '⌨️') return ICON_SVG_MAP['cmd'];
    if (ICON_SVG_MAP[iconValue]) return ICON_SVG_MAP[iconValue];
    return iconValue; // emoji or other value, returned as-is
}

// --- THEME-AWARE FOLDER COLOR ADAPTATION ---
// Computes relative luminance per WCAG 2.1 (0 = black, 1 = white)
function hexToLuminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// WCAG contrast ratio between two luminance values (1:1 = identical, 21:1 = max)
function contrastRatio(l1, l2) {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

// Maps each theme to its --md-sys-color-surface value (the background behind folder items)
// IMPORTANT: When adding a new theme, add its surface color here
const THEME_SURFACE_COLORS = {
    'theme-dark':        '#1D1B20',
    'theme-light':       '#FFFFFF',
    'theme-hacker':      '#0a0a0a',
    'theme-ocean':       '#1e293b',
    'theme-teradata':    '#2d3741',
    'theme-turquoise':   '#162225',
    'theme-github-dark': '#161B22',
    'theme-catppuccin':  '#24243E',
    'theme-nord':        '#3B4252'
};

/**
 * Returns the display color for a folder, adapting for contrast against the current theme.
 * If contrast is sufficient (≥ 2.5:1), returns the original color.
 * If contrast is insufficient, returns null → CSS handles it via --md-sys-color-on-surface.
 * Never modifies stored node.color data.
 */
function getDisplayColor(color, themeName) {
    if (!color) return null;
    const surfaceHex = THEME_SURFACE_COLORS[themeName];
    if (!surfaceHex) return color; // Unknown theme, don't adapt
    const colorLum = hexToLuminance(color);
    const surfaceLum = hexToLuminance(surfaceHex);
    const ratio = contrastRatio(colorLum, surfaceLum);
    // 2.5:1 threshold — lower than WCAG AA (4.5:1) since folder labels are decorative/navigational
    return ratio < 2.5 ? null : color;
}

// --- ESTADO GLOBAL ---
let treeData = [];
let commandHistory = [];
let qaCollapsed = false;
let historyCollapsed = false;
let commandsCollapsed = false;
let tagCloudCollapsed = false;
let contextTargetId = null;
let lastSelectedFolderId = null;
let draggedId = null;
let appClipboard = null;
let ghToken = "";
let currentTheme = "theme-github-dark";
let toastTimeout = null;
let isDataLoaded = false;
let inlineEditState = null; // { id, mode: 'edit'|'add', type, parentId, originalNode, formElement }
let helpPageState = null; // { nodeId, isEditing }
let allExpanded = false; // toggle state for expand/collapse all
let selectedNodeId = null; // Currently keyboard-selected tree item ID (primary/last-clicked)
let selectedNodeIds = new Set(); // Multi-select: all currently selected node IDs
let selectionAnchorId = null; // Shift+Click range anchor
let staggerAnimationEnabled = false; // Controls stagger entry animation (only on initial load)

// --- COMMAND TOOLTIP ---
let activeTooltip = null;   // Currently visible tooltip DOM element
let tooltipTimer = null;    // Delay timer before showing tooltip
const TOOLTIP_DELAY = 400;  // ms before tooltip appears

/**
 * Shows a custom tooltip near the given header element with command info.
 * @param {HTMLElement} headerEl - The .item-header element to anchor the tooltip to
 * @param {Object} node - The command node (expects .description and/or .cmd)
 */
function showCmdTooltip(headerEl, node) {
    hideCmdTooltip(); // Remove any existing tooltip first

    const hasDesc = node.description && node.description.trim();
    const hasCmd = node.cmd && node.cmd.trim();
    if (!hasDesc && !hasCmd) return;

    const tip = document.createElement('div');
    tip.className = 'cmd-tooltip';

    if (hasDesc) {
        const descEl = document.createElement('div');
        descEl.className = 'cmd-tooltip-label';
        descEl.textContent = node.description.trim();
        tip.appendChild(descEl);
    }

    if (hasCmd) {
        const cmdEl = document.createElement('div');
        cmdEl.className = 'cmd-tooltip-cmd';
        // 🔑 Masked: don't reveal command in tooltip
        if (node.icon === '🔑') {
            cmdEl.textContent = '🔑 ••••••••••••';
        } else if (node.chain && node.chain.steps) {
            cmdEl.textContent = `⛓️ ${node.chain.steps.length} steps (${node.chain.connector})`;
        } else {
            // Truncate: show first line only if multiline, cap at 120 chars
            let preview = node.cmd.trim();
            const firstNewline = preview.indexOf('\n');
            if (firstNewline > 0) {
                preview = preview.substring(0, firstNewline) + ' …(multiline)';
            }
            if (preview.length > 120) {
                preview = preview.substring(0, 117) + '…';
            }
            cmdEl.textContent = '$ ' + preview;
        }
        tip.appendChild(cmdEl);
    }

    document.body.appendChild(tip);
    activeTooltip = tip;

    // Position: below the header, or above if near viewport bottom
    const rect = headerEl.getBoundingClientRect();
    const tipHeight = tip.offsetHeight;
    const tipWidth = tip.offsetWidth;
    const GAP = 6;

    let top = rect.bottom + GAP;
    let left = rect.left;

    // Flip above if too close to bottom
    if (top + tipHeight > window.innerHeight - 10) {
        top = rect.top - tipHeight - GAP;
    }
    // Keep within horizontal bounds
    if (left + tipWidth > window.innerWidth - 10) {
        left = window.innerWidth - tipWidth - 10;
    }
    if (left < 10) left = 10;

    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;

    // Trigger fade-in on next frame
    requestAnimationFrame(() => {
        if (activeTooltip === tip) tip.classList.add('visible');
    });
}

/**
 * Removes the active tooltip immediately.
 */
function hideCmdTooltip() {
    if (tooltipTimer) {
        clearTimeout(tooltipTimer);
        tooltipTimer = null;
    }
    if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
    }
}

// --- UNDO/REDO ---
const undoStack = []; // Array of { snapshot: string (JSON), description: string }
const redoStack = []; // Array of { snapshot: string (JSON), description: string }
const MAX_UNDO = 50;  // Max history entries

/**
 * Saves a snapshot of current treeData before a destructive operation.
 * Call this BEFORE mutating treeData.
 * @param {string} description - Human-readable description for toast (e.g. "Delete: My Folder")
 */
function pushUndoState(description) {
    undoStack.push({
        snapshot: JSON.stringify(treeData),
        description: description || 'Action'
    });
    // Trim oldest entries if over limit
    while (undoStack.length > MAX_UNDO) undoStack.shift();
    // Any new action invalidates the redo stack
    redoStack.length = 0;
}

/**
 * Undo: restores treeData to the previous snapshot.
 */
function performUndo() {
    if (undoStack.length === 0) {
        showToast("Nothing to undo");
        return;
    }
    const entry = undoStack.pop();
    // Save current state to redo stack
    redoStack.push({
        snapshot: JSON.stringify(treeData),
        description: entry.description
    });
    // Restore snapshot
    treeData = JSON.parse(entry.snapshot);
    saveData();
    setSelectedNode(null);
    refreshAll();
    showToast(`\u21a9 Undo: ${entry.description}`);
}

/**
 * Redo: re-applies the last undone action.
 */
function performRedo() {
    if (redoStack.length === 0) {
        showToast("Nothing to redo");
        return;
    }
    const entry = redoStack.pop();
    // Save current state to undo stack (without clearing redo)
    undoStack.push({
        snapshot: JSON.stringify(treeData),
        description: entry.description
    });
    // Restore redo snapshot
    treeData = JSON.parse(entry.snapshot);
    saveData();
    setSelectedNode(null);
    refreshAll();
    showToast(`\u21aa Redo: ${entry.description}`);
}

// --- URL DETECTION ---
const URL_REGEX = /https?:\/\/[^\s"'<>]+/gi;

/**
 * Detects URLs in a command string.
 * @param {string} text - The command text to analyze.
 * @returns {{ isPureUrl: boolean, urls: string[] }}
 */
function detectUrls(text) {
    if (!text || typeof text !== 'string') return { isPureUrl: false, urls: [] };
    const trimmed = text.trim();
    const matches = trimmed.match(URL_REGEX);
    if (!matches || matches.length === 0) return { isPureUrl: false, urls: [] };
    const isPureUrl = matches.length === 1 && trimmed === matches[0];
    return { isPureUrl, urls: matches };
}

// --- AUTO-UPDATE CHECKER ---
const UPDATE_CHECK_URL = 'https://raw.githubusercontent.com/ivan-cedeno/CmdVault/main/version.json';
const UPDATE_CHECK_INTERVAL = 48 * 60 * 60 * 1000; // 48 hours in ms

/**
 * Compares two semver strings (e.g. "1.0.0" vs "1.1.0").
 * Returns: -1 if a < b, 0 if equal, 1 if a > b.
 */
function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na < nb) return -1;
        if (na > nb) return 1;
    }
    return 0;
}

/**
 * Updates the Settings → Updates section UI with current state.
 * @param {object|null} remote - The remote version.json data, or null.
 * @param {'checking'|'up-to-date'|'update-available'|'error'} status
 * @param {string} [errorMsg] - Optional error message.
 */
function updateSettingsUpdateUI(remote, status, errorMsg) {
    const statusText = document.getElementById('update-status-text');
    const infoDiv = document.getElementById('update-info');
    const changelogDiv = document.getElementById('update-changelog');
    const versionSpan = document.getElementById('current-version');

    // Always show current version from manifest
    const localVersion = chrome.runtime.getManifest().version;
    if (versionSpan) versionSpan.textContent = `v${localVersion}`;

    if (!statusText) return;

    switch (status) {
        case 'checking':
            statusText.textContent = '🔄 Checking...';
            statusText.style.color = '';
            if (infoDiv) infoDiv.classList.add('hidden');
            break;
        case 'up-to-date':
            statusText.textContent = '✅ Up to date';
            statusText.style.color = '#4caf50';
            if (infoDiv) infoDiv.classList.add('hidden');
            break;
        case 'update-available':
            statusText.textContent = `🆕 v${remote.version} available`;
            statusText.style.color = 'var(--md-sys-color-primary)';
            if (infoDiv) infoDiv.classList.remove('hidden');
            if (changelogDiv) changelogDiv.textContent = remote.changelog || 'No changelog provided.';
            break;
        case 'error':
            statusText.textContent = `⚠️ ${errorMsg || 'Check failed'}`;
            statusText.style.color = '#ff9800';
            if (infoDiv) infoDiv.classList.add('hidden');
            break;
    }
}

/**
 * Shows or hides the red pulsing badge on the overflow button.
 * @param {boolean} show
 */
function showUpdateBadge(show) {
    const badge = document.getElementById('update-badge');
    if (!badge) return;
    if (show) {
        badge.classList.remove('hidden');
        badge.setAttribute('aria-hidden', 'false');
    } else {
        badge.classList.add('hidden');
        badge.setAttribute('aria-hidden', 'true');
    }
}

/**
 * Fetches version.json from GitHub and compares with the local manifest version.
 * Respects the 48-hour check interval unless force=true.
 * @param {boolean} [force=false] - Skip the interval check (for manual "Check Now" clicks).
 */
async function checkForUpdates(force = false) {
    try {
        // Check if enough time has passed since last check
        if (!force) {
            const stored = await new Promise(resolve => {
                chrome.storage.local.get(['lastUpdateCheck'], resolve);
            });
            const lastCheck = stored.lastUpdateCheck || 0;
            if (Date.now() - lastCheck < UPDATE_CHECK_INTERVAL) {
                // Not time yet — but still show cached result if available
                const cached = await new Promise(resolve => {
                    chrome.storage.local.get(['cachedUpdateResult'], resolve);
                });
                if (cached.cachedUpdateResult) {
                    const c = cached.cachedUpdateResult;
                    const localVersion = chrome.runtime.getManifest().version;
                    if (compareVersions(localVersion, c.version) < 0) {
                        updateSettingsUpdateUI(c, 'update-available');
                        showUpdateBadge(true);
                    } else {
                        updateSettingsUpdateUI(null, 'up-to-date');
                        showUpdateBadge(false);
                    }
                }
                return;
            }
        }

        updateSettingsUpdateUI(null, 'checking');

        const response = await fetch(UPDATE_CHECK_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const remote = await response.json();
        const localVersion = chrome.runtime.getManifest().version;

        // Save check timestamp and result
        chrome.storage.local.set({
            lastUpdateCheck: Date.now(),
            cachedUpdateResult: remote
        });

        if (compareVersions(localVersion, remote.version) < 0) {
            // New version available
            updateSettingsUpdateUI(remote, 'update-available');
            showUpdateBadge(true);
            console.log(`🆕 CmdVault update available: v${remote.version}`);
        } else {
            updateSettingsUpdateUI(null, 'up-to-date');
            showUpdateBadge(false);
            console.log('✅ CmdVault is up to date');
        }
    } catch (err) {
        console.warn('Update check failed:', err.message);
        updateSettingsUpdateUI(null, 'error', 'Network error');
    }
}

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 V14.2 Context Menu Injection Fix...");
    try {
        injectContextMenu();
        setupAppEvents();
        setupDocking();
        renderColorPalette(); // <--- ✅ CORRECCIÓN: Usar el nombre real de la función
        setupHelpPageEvents();
    } catch (e) { console.error("UI Init Error:", e); }
    loadDataFromStorage();

    // Hide tooltip on scroll to prevent detached floating tooltip
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.addEventListener('scroll', hideCmdTooltip, { passive: true });
});

// --- CARGA DE DATOS ---
function loadDataFromStorage() {
    if (typeof cancelInlineEdit === 'function') cancelInlineEdit();
    chrome.storage.local.get(null, (items) => {
        if (chrome.runtime.lastError) {
            console.error("Storage Error:", chrome.runtime.lastError);
            showToast("❌ Storage Load Error");
            return;
        }

        try {
            if (Array.isArray(items.linuxTree)) {
                treeData = cleanNodes(items.linuxTree);
            } else {
                treeData = [];
            }
        } catch (e) {
            treeData = [];
        }

        if (treeData.length === 0) {
            treeData.push({
                id: genId(),
                name: "My Commands",
                type: "folder",
                children: [],
                collapsed: false,
                color: null
            });
            isDataLoaded = true;
            saveData();
        }

        commandHistory = Array.isArray(items.linuxHistory) ? items.linuxHistory : [];
        qaCollapsed = items.qaCollapsed || false;
        historyCollapsed = items.historyCollapsed || false;
        commandsCollapsed = items.commandsCollapsed || false;

        ghToken = items.ghToken || "";

        if (items.savedTheme) changeTheme(items.savedTheme);

        const tokenInput = document.getElementById('gh-token-input');
        if (tokenInput) tokenInput.value = ghToken;

        const userInput = document.getElementById('username-input');
        if (userInput) userInput.value = items.username || 'user';

        const title = document.querySelector('.app-title');
        if (title) title.textContent = `${items.username || 'user'}@CmdVault:~$`;

        isDataLoaded = true;
        staggerAnimationEnabled = true; // Enable stagger animation for initial load

        // Trigger auto-update check (non-blocking, respects 48h interval)
        checkForUpdates(false);

        refreshAll();
    });
}

function cleanNodes(nodes) {
    if (!Array.isArray(nodes)) return [];
    return nodes.map(n => {
        if (!n || typeof n !== 'object') return null;
        if (!n.id) n.id = genId();
        if (n.type === 'folder') {
            if (!Array.isArray(n.children)) n.children = [];
            n.children = cleanNodes(n.children);
        }
        n.name = n.name || "Untitled";
        return n;
    }).filter(n => n !== null);
}

function saveData() {
    if (!isDataLoaded) return;
    chrome.storage.local.set({ linuxTree: treeData }, () => {
        if (chrome.runtime.lastError) showToast("❌ Save Failed");
        else if (ghToken) autoSyncToCloud();
    });
}

function saveGlobalState() {
    chrome.storage.local.set({ qaCollapsed, historyCollapsed, commandsCollapsed });
}

function refreshAll() {
    const search = document.getElementById('search-input');
    const filter = search ? search.value.toLowerCase() : '';
    renderTree(filter);
    renderHistory();
    renderFavorites();
    updateHeaderIcons();
    restoreSelection();
    updateSearchUI(filter);
}

/**
 * Updates the search UI: result counter badge and clear button visibility.
 * @param {string} filter - The current search filter string.
 */
function updateSearchUI(filter) {
    const countEl = document.getElementById('search-result-count');
    const clearBtn = document.getElementById('btn-search-clear');

    if (!filter) {
        if (countEl) { countEl.classList.add('hidden'); countEl.textContent = ''; }
        if (clearBtn) clearBtn.classList.add('hidden');
        return;
    }

    // Show clear button
    if (clearBtn) clearBtn.classList.remove('hidden');

    // Count visible leaf nodes (commands only, not folders)
    const count = countVisibleNodes(treeData, filter);
    if (countEl) {
        countEl.classList.remove('hidden');
        countEl.textContent = count === 0 ? 'No results' : `${count}`;
    }
}

/**
 * Counts the number of visible leaf nodes (commands) matching the filter.
 */
function countVisibleNodes(nodes, filter) {
    let count = 0;
    for (const n of nodes) {
        if (!n) continue;
        if (n.children) {
            count += countVisibleNodes(n.children, filter);
        } else if (isVisible(n, filter)) {
            count++;
        }
    }
    return count;
}

function updateHeaderIcons() {
    const setChevron = (id, collapsed) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('collapsed', collapsed);
    };
    setChevron('cmd-arrow', commandsCollapsed);
    setChevron('hist-arrow', historyCollapsed);
    setChevron('qa-arrow', qaCollapsed);

    // Sync section header aria-expanded with collapse state
    const syncAria = (headerId, collapsed) => {
        const el = document.getElementById(headerId);
        if (el) el.setAttribute('aria-expanded', String(!collapsed));
    };
    syncAria('commands-header', commandsCollapsed);
    syncAria('history-header', historyCollapsed);
    syncAria('qa-header', qaCollapsed);
    syncAria('tagcloud-header', tagCloudCollapsed);
}

// --- RENDERIZADO ÁRBOL ---
function renderTree(filter) {
    if (inlineEditState) return; // Preserve inline editor during re-renders
    const container = document.getElementById('tree-container');
    if (!container) return;

    container.innerHTML = '';
    container.style.display = (commandsCollapsed && !filter) ? 'none' : 'block';

    if (treeData.length === 0) {
        container.innerHTML = '<div style="padding:20px; color:#666; text-align:center;">No items found.</div>';
        return;
    }

    const shouldAnimate = staggerAnimationEnabled;
    let staggerIndex = 0;

    treeData.forEach(node => {
        if (node && isVisible(node, filter)) {
            const el = createNodeElement(node, filter);
            if (shouldAnimate) {
                applyStaggerAnimation(el, staggerIndex);
                staggerIndex++;
            }
            container.appendChild(el);
        }
    });

    // Disable stagger after first render so subsequent refreshes are instant
    if (shouldAnimate) staggerAnimationEnabled = false;

    // Re-attach breadcrumb scroll observer after tree re-render
    setupBreadcrumbObserver();
}

// ==========================================================================
//  BREADCRUMB — Folder path indicator on deep scroll
// ==========================================================================

let breadcrumbObserver = null;
let currentBreadcrumbFolderId = null;

/**
 * Sets up an IntersectionObserver on all folder tree-items inside #tree-container.
 * As the user scrolls, detects the topmost visible folder and updates the breadcrumb.
 */
function setupBreadcrumbObserver() {
    // Disconnect previous observer
    if (breadcrumbObserver) {
        breadcrumbObserver.disconnect();
        breadcrumbObserver = null;
    }

    const scrollRoot = document.querySelector('.main-content');
    const breadcrumb = document.getElementById('breadcrumb-bar');
    if (!scrollRoot || !breadcrumb) return;

    // Collect all folder tree-item elements (they have type-folder class)
    const folderItems = document.querySelectorAll('#tree-container .tree-item.type-folder');
    if (folderItems.length === 0) {
        breadcrumb.classList.add('hidden');
        return;
    }

    // Use scroll event for precise top-folder detection
    // (IntersectionObserver can be imprecise with nested sticky elements)
    scrollRoot.removeEventListener('scroll', handleBreadcrumbScroll);
    scrollRoot.addEventListener('scroll', handleBreadcrumbScroll, { passive: true });

    // Initial check
    handleBreadcrumbScroll();
}

/**
 * Scroll handler: finds the topmost visible folder in the scroll viewport
 * and updates the breadcrumb bar with its ancestor path.
 */
function handleBreadcrumbScroll() {
    const scrollRoot = document.querySelector('.main-content');
    const breadcrumb = document.getElementById('breadcrumb-bar');
    const treeContainer = document.getElementById('tree-container');
    if (!scrollRoot || !breadcrumb || !treeContainer) return;

    const scrollTop = scrollRoot.scrollTop;
    const scrollRect = scrollRoot.getBoundingClientRect();

    // Get the commands-wrapper position to know if tree is even visible
    const wrapper = document.getElementById('commands-wrapper');
    if (!wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();

    // If the commands section isn't scrolled into view (i.e., user is above it), hide breadcrumb
    if (wrapperRect.top > scrollRect.top + 60) {
        breadcrumb.classList.add('hidden');
        currentBreadcrumbFolderId = null;
        return;
    }

    // Find ALL folder items and their positions
    const folderItems = treeContainer.querySelectorAll('.tree-item.type-folder');
    if (folderItems.length === 0) {
        breadcrumb.classList.add('hidden');
        currentBreadcrumbFolderId = null;
        return;
    }

    // Find the topmost folder that is at or above the scroll viewport top
    // (i.e., has been scrolled past or is right at the top)
    let topFolder = null;
    const refLine = scrollRect.top + 80; // reference line slightly below top (accounts for top-bar + breadcrumb)

    for (const item of folderItems) {
        // Skip folders inside collapsed parents (they have zero height and misleading positions)
        if (item.closest('.folder-content.collapsed')) continue;
        if (item.offsetHeight === 0) continue;

        const rect = item.getBoundingClientRect();
        // Folder is considered "current" if its top edge is at or above the reference line
        if (rect.top <= refLine) {
            topFolder = item;
        } else {
            break; // Folders are in DOM order (top to bottom), so once past, stop
        }
    }

    if (!topFolder) {
        breadcrumb.classList.add('hidden');
        currentBreadcrumbFolderId = null;
        return;
    }

    const folderId = topFolder.dataset.nodeId;

    // Only update if the folder changed (performance optimization)
    if (folderId === currentBreadcrumbFolderId) return;
    currentBreadcrumbFolderId = folderId;

    // Build the ancestor path
    const path = getAncestorPath(treeData, folderId);
    if (path.length === 0) {
        breadcrumb.classList.add('hidden');
        return;
    }

    // Only show breadcrumb when we're scrolled deep enough (at least 1 folder depth)
    // or when the top folder is scrolled past the header
    const commandsHeader = document.getElementById('commands-header');
    const headerRect = commandsHeader ? commandsHeader.getBoundingClientRect() : null;
    if (headerRect && headerRect.bottom > scrollRect.top) {
        // Header is still visible, no need for breadcrumb
        breadcrumb.classList.add('hidden');
        return;
    }

    renderBreadcrumb(breadcrumb, path);
    breadcrumb.classList.remove('hidden');
}

/**
 * Renders breadcrumb content with clickable folder segments.
 * @param {HTMLElement} container - The breadcrumb bar element
 * @param {Array} path - Array of folder nodes from root to current
 */
function renderBreadcrumb(container, path) {
    container.innerHTML = '';

    // Root icon
    const rootIcon = document.createElement('span');
    rootIcon.className = 'breadcrumb-root';
    rootIcon.innerHTML = '📂';
    rootIcon.title = 'All Commands';
    rootIcon.onclick = () => {
        const treeContainer = document.getElementById('tree-container');
        if (treeContainer) treeContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    container.appendChild(rootIcon);

    path.forEach((node, i) => {
        // Separator
        const sep = document.createElement('span');
        sep.className = 'breadcrumb-sep';
        sep.textContent = '›';
        container.appendChild(sep);

        // Folder name segment
        const segment = document.createElement('span');
        segment.className = 'breadcrumb-segment';
        if (i === path.length - 1) segment.classList.add('active');
        segment.textContent = node.name || 'Untitled';
        segment.title = node.name || 'Untitled';

        // Apply folder color if present
        const displayColor = getDisplayColor(node.color, currentTheme);
        if (displayColor) segment.style.color = displayColor;

        // Click to scroll to that folder
        segment.onclick = () => {
            const el = document.querySelector(`#tree-container [data-node-id="${node.id}"] > .item-header`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setSelectedNode(node.id);
            }
        };
        container.appendChild(segment);
    });
}

/**
 * Applies stagger fade-in animation to a tree node element and its visible children.
 * Each item gets an incremental delay for a cascading effect.
 * @param {HTMLElement} el - The wrapper element from createNodeElement
 * @param {number} startIndex - Starting stagger index for delay calculation
 * @returns {number} The next stagger index after processing this element
 */
function applyStaggerAnimation(el, startIndex) {
    const STAGGER_DELAY = 30; // ms between each item
    const MAX_DELAY = 600; // cap max delay so large trees don't feel slow

    // Animate the tree-item row itself
    const row = el.querySelector('.tree-item');
    if (row) {
        const delay = Math.min(startIndex * STAGGER_DELAY, MAX_DELAY);
        row.classList.add('stagger-in');
        row.style.animationDelay = `${delay}ms`;

        // Clean up animation class after it finishes
        row.addEventListener('animationend', () => {
            row.classList.remove('stagger-in');
            row.style.animationDelay = '';
        }, { once: true });
    }

    // Recurse into visible children (folder-content)
    let idx = startIndex + 1;
    const folderContent = el.querySelector(':scope > .folder-content:not(.collapsed)');
    if (folderContent) {
        const childWrappers = folderContent.querySelectorAll(':scope > [data-node-id]');
        childWrappers.forEach(child => {
            idx = applyStaggerAnimation(child, idx);
        });
    }

    return idx;
}

// PUNTO 1: Añadimos 'inheritedColor' como cuarto parámetro (neutro por defecto)
function createNodeElement(node, filter, isFav = false, inheritedColor = null) {
    const row = document.createElement('div');
    row.className = `tree-item type-${node.type}`;
    row.dataset.nodeId = node.id;

    // --- ARIA: Tree item semantics ---
    row.setAttribute('role', 'treeitem');
    row.setAttribute('aria-selected', selectedNodeIds.has(String(node.id)) ? 'true' : 'false');
    row.setAttribute('aria-label', node.name || 'Untitled');
    if (node.type === 'folder') {
        const isExpanded = !node.collapsed || !!filter;
        row.setAttribute('aria-expanded', String(isExpanded));
    }
    // Make focusable for keyboard navigation (roving tabindex)
    row.tabIndex = (String(node.id) === String(selectedNodeId)) ? 0 : -1;

    if (appClipboard && appClipboard.action === 'cut' && String(appClipboard.id) === String(node.id)) {
        row.classList.add('cut-state');
    }

    if (!isFav && !filter) attachDragEvents(row, node);

    const header = document.createElement('div');
    header.className = 'item-header';
    header.style.display = 'flex';
    header.style.alignItems = 'center';

    // PUNTO 2: Lógica de Prioridad de Color
    // 1. Color propio del nodo (node.color)
    // 2. Si no tiene, usa el del padre (inheritedColor)
    const activeColor = node.color || inheritedColor;

    // Adapt color for current theme contrast (never modifies stored data)
    const displayColor = getDisplayColor(activeColor, currentTheme);

    if (displayColor && node.type === 'folder') {
        header.style.color = displayColor;
    }
    
    // --- CUSTOM TOOLTIP (commands only) ---
    // Replaces native title with a styled tooltip showing description + cmd preview
    if (node.type === 'command') {
        header.addEventListener('mouseenter', () => {
            if (inlineEditState && String(inlineEditState.id) === String(node.id)) return;
            tooltipTimer = setTimeout(() => showCmdTooltip(header, node), TOOLTIP_DELAY);
        });
        header.addEventListener('mouseleave', () => hideCmdTooltip());
        header.addEventListener('mousedown', () => hideCmdTooltip());
    } else if (node.description) {
        // Folders still use native title for simplicity
        header.title = node.description;
    }

    // --- ICONOS V3 --- (Se mantienen tus variables actuales)
    const iconSpan = document.createElement('span');
    iconSpan.style.marginRight = '8px';
    iconSpan.style.display = 'flex';
    iconSpan.style.alignItems = 'center';

    // --- ICONOS V3: VERSIÓN PERSPECTIVA PREMIUM ---
    const collapsed = node.collapsed === true;

    // Carpeta Cerrada: Diseño más redondeado y robusto
    const iconClosed = `<svg class="folder-icon-v3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path></svg>`;

    // Carpeta Abierta: Efecto de profundidad (la tapa se abre hacia el usuario)
    const iconOpen = `<svg class="folder-icon-v3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"></path></svg>`;

    // Icono de Comando: Se mantiene el estilo de terminal alineado con los nuevos folders
    const iconCmd = `<svg class="folder-icon-v3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`;

    // Drag handle (grip dots) — only for draggable items (not favorites or filtered)
    if (!isFav && !filter) {
        const grip = document.createElement('span');
        grip.className = 'drag-handle';
        grip.setAttribute('aria-hidden', 'true');
        grip.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="none"><circle cx="9" cy="5" r="1.5"></circle><circle cx="15" cy="5" r="1.5"></circle><circle cx="9" cy="12" r="1.5"></circle><circle cx="15" cy="12" r="1.5"></circle><circle cx="9" cy="19" r="1.5"></circle><circle cx="15" cy="19" r="1.5"></circle></svg>`;
        header.appendChild(grip);
    }

    // Chevron indicator for folders (> rotates to v when expanded)
    let chevronSpan = null;
    if (node.type === 'folder') {
        chevronSpan = document.createElement('span');
        chevronSpan.className = 'tree-chevron';
        if (!collapsed || filter) chevronSpan.classList.add('expanded');
        chevronSpan.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
        header.appendChild(chevronSpan);
    }

    if (node.type === 'folder') {
        iconSpan.innerHTML = (collapsed && !filter) ? iconClosed : iconOpen;
    } else {
        // Auto-detect pure URLs: show 🔗 icon when cmd is a URL and no custom icon is set
        const isDefaultIcon = !node.icon || node.icon === 'cmd' || node.icon === '⌨️';
        if (isDefaultIcon && detectUrls(node.cmd).isPureUrl) {
            iconSpan.innerHTML = '🔗';
        } else {
            iconSpan.innerHTML = resolveIcon(node.icon);
            // Add accent class to default command icon (terminal >_)
            if (isDefaultIcon) iconSpan.classList.add('cmd-icon');
        }
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'node-name';
    const nameText = node.name || "Untitled";

    if (filter && filter.trim() !== "") {
        try {
            const escapedFilter = filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedFilter})`, 'gi');
            nameSpan.innerHTML = nameText.replace(regex, '<span class="search-highlight">$1</span>');
        } catch (e) {
            nameSpan.textContent = nameText;
        }
    } else {
        nameSpan.textContent = nameText;
    }

    header.appendChild(iconSpan);
    header.appendChild(nameSpan);

    // Counter badge for folders
    if (node.type === 'folder') {
        const cmdCount = countCommands(node.children || []);
        if (cmdCount > 0) {
            const countBadge = document.createElement('span');
            countBadge.className = 'folder-count-badge';
            countBadge.textContent = cmdCount;
            countBadge.title = `${cmdCount} command${cmdCount !== 1 ? 's' : ''}`;
            header.appendChild(countBadge);
        }
    }

    if (Array.isArray(node.tags) && node.tags.length > 0) {
        const tagsDiv = document.createElement('div');
        tagsDiv.className = 'tags-container';
        node.tags.forEach(t => {
            const badge = document.createElement('span');
            badge.className = 'tag-badge';

            const normalizedTag = t.toLowerCase().trim();
            const cloudConfig = CLOUD_TAG_CONFIG[normalizedTag];

            if (cloudConfig) {
                // Smart Cloud Tag: colored badge with SVG icon
                badge.classList.add(cloudConfig.cssClass);
                badge.innerHTML = `<span class="tag-icon">${cloudConfig.icon}</span>${t}`;
            } else if (normalizedTag === 'precaution') {
                badge.classList.add('precaution');
                badge.textContent = t;
            } else {
                badge.textContent = t;
            }

            // Clickable tag → filter by #tag
            badge.onclick = (e) => {
                e.stopPropagation();
                const searchInput = document.getElementById('search-input');
                if (searchInput) {
                    searchInput.value = '#' + normalizedTag;
                    searchInput.focus();
                    refreshAll();
                }
            };

            tagsDiv.appendChild(badge);
        });
        header.appendChild(tagsDiv);
    }

    // Chain steps badge
    if (node.type === 'command' && node.chain && node.chain.steps) {
        const chainBadge = document.createElement('span');
        chainBadge.className = 'chain-steps-badge';
        chainBadge.textContent = `${node.chain.steps.length} steps`;
        chainBadge.title = `Chain: ${node.chain.steps.length} step${node.chain.steps.length !== 1 ? 's' : ''} joined by ${node.chain.connector}`;
        header.appendChild(chainBadge);
    }

    header.onclick = (e) => {
        if (inlineEditState && String(inlineEditState.id) === String(node.id)) return;

        // Multi-select: Ctrl+Click toggles, Shift+Click selects range
        const isCtrl = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;

        if (isCtrl) {
            // Ctrl+Click: toggle this node in the selection set
            toggleNodeSelection(node.id);
            if (node.type === 'folder') lastSelectedFolderId = node.id;
            return; // Don't toggle folder collapse on Ctrl+Click
        } else if (isShift) {
            // Shift+Click: select range from anchor to this node
            e.preventDefault();
            selectNodeRange(node.id);
            if (node.type === 'folder') lastSelectedFolderId = node.id;
            return; // Don't toggle folder collapse on Shift+Click
        }

        // Plain click: single select
        setSelectedNode(node.id);

        if (node.type === 'folder' && !isFav) {
            lastSelectedFolderId = node.id;
            node.collapsed = !node.collapsed;
            saveData();
            const content = wrapper.querySelector('.folder-content');
            if (content) {
                if (node.collapsed) {
                    // COLLAPSE: animate from current height to 0
                    content.style.maxHeight = content.scrollHeight + 'px';
                    content.style.overflow = 'hidden';
                    content.offsetHeight; // trigger reflow
                    content.style.transition = 'max-height 0.25s ease-in-out, opacity 0.25s ease-in-out';
                    content.style.maxHeight = '0';
                    content.style.opacity = '0';
                    content.style.pointerEvents = 'none';
                    content.classList.add('collapsed');
                } else {
                    // EXPAND: animate from 0 to actual height, then remove max-height
                    content.classList.remove('collapsed');
                    content.style.overflow = 'hidden';
                    content.style.maxHeight = '0';
                    content.style.opacity = '1';
                    content.style.pointerEvents = '';
                    content.offsetHeight; // trigger reflow
                    content.style.transition = 'max-height 0.3s ease-in-out, opacity 0.25s ease-in-out';
                    content.style.maxHeight = content.scrollHeight + 'px';
                    // After animation completes, remove max-height so content can grow freely
                    const onEnd = () => {
                        content.style.maxHeight = '';
                        content.style.overflow = '';
                        content.style.transition = '';
                        content.removeEventListener('transitionend', onEnd);
                    };
                    content.addEventListener('transitionend', onEnd);
                }
                iconSpan.innerHTML = node.collapsed ? iconClosed : iconOpen;
                if (chevronSpan) chevronSpan.classList.toggle('expanded', !node.collapsed);
                // Update ARIA expanded state
                row.setAttribute('aria-expanded', String(!node.collapsed));
            }
        }
    };

    header.oncontextmenu = (e) => {
        e.preventDefault();
        if (inlineEditState && String(inlineEditState.id) === String(node.id)) return;
        contextTargetId = node.id;
        // If right-clicking a node that's already in the multi-selection, keep the multi-selection
        if (!selectedNodeIds.has(String(node.id))) {
            setSelectedNode(node.id);
        } else {
            selectedNodeId = String(node.id);
        }
        if (node.type === 'folder') lastSelectedFolderId = node.id;
        openContextMenu(e, node);
    };

    row.appendChild(header);

    if (node.type === 'command') {
        const wrap = document.createElement('div');
        wrap.className = 'cmd-wrapper copy-flash';
        const pre = document.createElement('pre');
        pre.className = node.expanded ? 'cmd-preview expanded' : 'cmd-preview';

        // 🔑 Masked mode: hide command text behind dots when icon is key
        const isMasked = node.icon === '🔑';
        if (isMasked) {
            pre.textContent = '••••••••••••';
            pre.classList.add('cmd-masked');
            pre.dataset.revealed = 'false';

            // Toggle reveal on click
            pre.onclick = (e) => {
                if (pre.dataset.revealed === 'false') {
                    // Reveal the command
                    pre.innerHTML = highlightSyntax(String(node.cmd || ""));
                    pre.dataset.revealed = 'true';
                    pre.classList.remove('cmd-masked');
                    pre.classList.add('cmd-revealed');
                } else {
                    // Copy on second click (when revealed)
                    copyToClipboard(node.cmd, node.name, wrap);
                }
            };

            // Auto-hide after 5 seconds
            let hideTimer = null;
            const autoHide = () => {
                clearTimeout(hideTimer);
                hideTimer = setTimeout(() => {
                    if (pre.dataset.revealed === 'true') {
                        pre.textContent = '••••••••••••';
                        pre.dataset.revealed = 'false';
                        pre.classList.add('cmd-masked');
                        pre.classList.remove('cmd-revealed');
                    }
                }, 5000);
            };
            pre.addEventListener('click', autoHide);
        } else if (node.chain && node.chain.steps && node.expanded) {
            // Chain expanded view: show numbered steps
            node.chain.steps.forEach((step, i) => {
                const stepLine = document.createElement('div');
                stepLine.className = 'chain-step-display';
                const stepNum = document.createElement('span');
                stepNum.className = 'chain-step-display-num';
                stepNum.textContent = `${i + 1}.`;
                stepLine.appendChild(stepNum);
                const stepCmd = document.createElement('span');
                stepCmd.innerHTML = highlightSyntax(step);
                stepLine.appendChild(stepCmd);
                if (i < node.chain.steps.length - 1) {
                    const conn = document.createElement('span');
                    conn.className = 'chain-connector-display';
                    conn.textContent = ` ${node.chain.connector}`;
                    stepLine.appendChild(conn);
                }
                pre.appendChild(stepLine);
            });
            pre.onclick = () => copyToClipboard(node.cmd, node.name, wrap);
        } else {
            pre.innerHTML = highlightSyntax(String(node.cmd || ""));
            pre.onclick = () => copyToClipboard(node.cmd, node.name, wrap);
        }

        // URL Detection: Add "Open URL" button if URLs are found
        const urlInfo = detectUrls(node.cmd);
        if (urlInfo.urls.length > 0) {
            const openBtn = document.createElement('div');
            openBtn.className = 'cmd-open-url-btn';
            openBtn.title = urlInfo.isPureUrl
                ? 'Open URL in new tab'
                : `Open URL in new tab (${urlInfo.urls.length} link${urlInfo.urls.length > 1 ? 's' : ''})`;
            openBtn.innerHTML = `<svg class="folder-icon-v3" style="width:14px; height:14px; pointer-events:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
            openBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                openUrlFromCommand(urlInfo.urls);
            };
            wrap.appendChild(openBtn);
        }

        const btn = document.createElement('div');
        btn.className = 'cmd-ctrl-btn';
        btn.innerHTML = `<svg class="cmd-expand-icon${node.expanded ? ' expanded' : ''}" style="width:14px; height:14px; pointer-events:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            node.expanded = !node.expanded;
            saveData();
            refreshAll();
        };
        wrap.appendChild(pre);
        wrap.appendChild(btn);
        row.appendChild(wrap);
    }

    const wrapper = document.createElement('div');
    wrapper.dataset.nodeId = node.id;
    wrapper.appendChild(row);

    if (!isFav && node.children && node.type === 'folder') {
        const inner = document.createElement('div');
        inner.className = 'folder-content';
        inner.setAttribute('role', 'group');

        if (node.collapsed && !filter) {
            inner.classList.add('collapsed');
        }

        inner.style.borderLeft = "1px solid var(--md-sys-color-outline-variant, rgba(255,255,255,0.1))";
        inner.style.marginLeft = "10px";
        inner.style.paddingLeft = "6px";

        // PUNTO 3: Propagación del ADN de color hacia los hijos
        node.children.forEach(child => {
            if (child && isVisible(child, filter)) {
                // Pasamos el 'activeColor' de este nodo como el 'inheritedColor' del hijo
                inner.appendChild(createNodeElement(child, filter, false, activeColor));
            }
        });
        wrapper.appendChild(inner);
    }
    return wrapper;
}

// ==========================================================================
//  KEYBOARD SELECTION STATE
// ==========================================================================

/**
 * Sets a single selected node (clears multi-select).
 * Used for plain clicks and keyboard navigation.
 */
function setSelectedNode(id) {
    clearSelectionStyles();
    selectedNodeIds.clear();

    selectedNodeId = id;
    if (id === null) {
        selectionAnchorId = null;
        updateSelectionBadge();
        return;
    }

    selectedNodeIds.add(String(id));
    selectionAnchorId = String(id);

    const el = document.querySelector(`.main-content .tree-item[data-node-id="${id}"]`);
    if (el) {
        el.classList.add('selected');
        el.setAttribute('aria-selected', 'true');
        el.tabIndex = 0;
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    updateSelectionBadge();
}

/**
 * Toggles a node in/out of multi-selection (Ctrl+Click).
 */
function toggleNodeSelection(id) {
    const strId = String(id);
    if (selectedNodeIds.has(strId)) {
        selectedNodeIds.delete(strId);
        const el = document.querySelector(`.main-content .tree-item[data-node-id="${id}"]`);
        if (el) {
            el.classList.remove('selected');
            el.setAttribute('aria-selected', 'false');
        }
        // Update primary selectedNodeId
        if (selectedNodeIds.size > 0) {
            selectedNodeId = [...selectedNodeIds][selectedNodeIds.size - 1];
        } else {
            selectedNodeId = null;
            selectionAnchorId = null;
        }
    } else {
        selectedNodeIds.add(strId);
        selectedNodeId = strId;
        selectionAnchorId = strId;
        const el = document.querySelector(`.main-content .tree-item[data-node-id="${id}"]`);
        if (el) {
            el.classList.add('selected');
            el.setAttribute('aria-selected', 'true');
            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }
    updateSelectionBadge();
}

/**
 * Selects a range of nodes from anchor to target (Shift+Click).
 */
function selectNodeRange(targetId) {
    const items = getVisibleTreeItems();
    if (items.length === 0) return;

    const anchorId = selectionAnchorId || selectedNodeId;
    if (!anchorId) {
        setSelectedNode(targetId);
        return;
    }

    const anchorIdx = items.findIndex(el => String(el.dataset.nodeId) === String(anchorId));
    const targetIdx = items.findIndex(el => String(el.dataset.nodeId) === String(targetId));

    if (anchorIdx === -1 || targetIdx === -1) {
        setSelectedNode(targetId);
        return;
    }

    const start = Math.min(anchorIdx, targetIdx);
    const end = Math.max(anchorIdx, targetIdx);

    clearSelectionStyles();
    selectedNodeIds.clear();

    for (let i = start; i <= end; i++) {
        const nodeId = items[i].dataset.nodeId;
        selectedNodeIds.add(String(nodeId));
        items[i].classList.add('selected');
        items[i].setAttribute('aria-selected', 'true');
    }

    selectedNodeId = String(targetId);
    // Keep selectionAnchorId unchanged (stays at original anchor)
    updateSelectionBadge();
}

/**
 * Select all visible tree items (Ctrl+A).
 */
function selectAllNodes() {
    const items = getVisibleTreeItems();
    if (items.length === 0) return;

    clearSelectionStyles();
    selectedNodeIds.clear();

    items.forEach(el => {
        const nodeId = el.dataset.nodeId;
        selectedNodeIds.add(String(nodeId));
        el.classList.add('selected');
        el.setAttribute('aria-selected', 'true');
    });

    selectedNodeId = [...selectedNodeIds][selectedNodeIds.size - 1];
    updateSelectionBadge();
}

/**
 * Clear all selection visual styles from DOM.
 */
function clearSelectionStyles() {
    document.querySelectorAll('.tree-item.selected').forEach(el => {
        el.classList.remove('selected');
        el.setAttribute('aria-selected', 'false');
    });
}

/**
 * Updates the floating selection count badge.
 */
function updateSelectionBadge() {
    let badge = document.getElementById('multi-select-badge');
    if (selectedNodeIds.size <= 1) {
        if (badge) badge.classList.add('hidden');
        return;
    }
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'multi-select-badge';
        badge.className = 'multi-select-badge';
        badge.setAttribute('role', 'status');
        badge.setAttribute('aria-live', 'polite');
        badge.setAttribute('aria-atomic', 'true');
        document.body.appendChild(badge);
    }
    badge.textContent = `${selectedNodeIds.size} selected`;
    badge.classList.remove('hidden');
}

/**
 * Check if there is an active multi-selection (more than 1 item).
 */
function isMultiSelect() {
    return selectedNodeIds.size > 1;
}

function getVisibleTreeItems() {
    const items = [];

    // 1. Favorites section
    const qaList = document.getElementById('qa-list');
    if (qaList && qaList.style.display !== 'none') {
        qaList.querySelectorAll('.tree-item').forEach(el => {
            if (el.offsetParent !== null && !el.closest('.folder-content.collapsed')) items.push(el);
        });
    }

    // 2. Main tree container
    const treeContainer = document.getElementById('tree-container');
    if (treeContainer && treeContainer.style.display !== 'none') {
        treeContainer.querySelectorAll('.tree-item').forEach(el => {
            if (el.offsetParent !== null && !el.closest('.folder-content.collapsed')) items.push(el);
        });
    }

    return items;
}

function restoreSelection() {
    if (selectedNodeIds.size === 0 && selectedNodeId === null) return;

    // Restore multi-select state
    if (selectedNodeIds.size > 0) {
        const validIds = new Set();
        selectedNodeIds.forEach(id => {
            const el = document.querySelector(`.main-content .tree-item[data-node-id="${id}"]`);
            if (el) {
                el.classList.add('selected');
                el.setAttribute('aria-selected', 'true');
                validIds.add(id);
            }
        });
        selectedNodeIds = validIds;
        if (selectedNodeIds.size === 0) {
            selectedNodeId = null;
            selectionAnchorId = null;
        } else if (!selectedNodeIds.has(String(selectedNodeId))) {
            selectedNodeId = [...selectedNodeIds][selectedNodeIds.size - 1];
        }
    } else if (selectedNodeId !== null) {
        const el = document.querySelector(`.main-content .tree-item[data-node-id="${selectedNodeId}"]`);
        if (el) {
            el.classList.add('selected');
            el.setAttribute('aria-selected', 'true');
            selectedNodeIds.add(String(selectedNodeId));
        } else {
            selectedNodeId = null;
        }
    }
    updateSelectionBadge();
}

// --- SETUP EVENTOS ---
function setupAppEvents() {
    bindClick('qa-header', () => {
        qaCollapsed = !qaCollapsed;
        const qaH = document.getElementById('qa-header');
        if (qaH) qaH.setAttribute('aria-expanded', String(!qaCollapsed));
        saveGlobalState(); refreshAll();
    });
    bindClick('history-header', () => {
        historyCollapsed = !historyCollapsed;
        const hH = document.getElementById('history-header');
        if (hH) hH.setAttribute('aria-expanded', String(!historyCollapsed));
        saveGlobalState(); refreshAll();
    });
    bindClick('commands-header', () => {
        commandsCollapsed = !commandsCollapsed;
        const cH = document.getElementById('commands-header');
        if (cH) cH.setAttribute('aria-expanded', String(!commandsCollapsed));
        saveGlobalState();
        refreshAll();
    });

    bindClick('btn-add-root', () => {
        cancelInlineEdit();

        const newId = genId();
        const tempNode = { id: newId, name: '', type: 'folder', children: [], collapsed: false, color: null };

        treeData.push(tempNode);
        inlineEditState = null;
        refreshAll();

        const domElement = findNodeDomElement(newId);
        if (domElement) {
            openInlineEditor(domElement, tempNode, 'add', null);
        }
    });

    // Add Command shortcut (header button)
    bindClick('btn-add-cmd', () => {
        if (!lastSelectedFolderId) {
            showToast("📁 Select a folder first");
            return;
        }
        const folder = findNode(treeData, lastSelectedFolderId);
        if (!folder || folder.type !== 'folder') {
            showToast("📁 Select a folder first");
            lastSelectedFolderId = null;
            return;
        }
        execAdd(lastSelectedFolderId, 'command');
    });

    // Global Expand/Collapse All — single toggle button
    const toggleAllBtn = document.getElementById('btn-toggle-all');
    const toggleAllIcon = document.getElementById('toggle-all-icon');
    const updateToggleIcon = () => {
        if (!toggleAllIcon) return;
        if (allExpanded) {
            // Show "collapse" icon (fold-vertical)
            toggleAllIcon.innerHTML = `
                <path d="M12 7v6l3-3m-3 3-3-3" stroke="currentColor" fill="none"></path>
                <path d="M12 17v-6l3 3m-3-3-3 3" stroke="currentColor" fill="none"></path>
                <line x1="4" y1="3" x2="20" y2="3" stroke="currentColor"></line>
                <line x1="4" y1="21" x2="20" y2="21" stroke="currentColor"></line>`;
            if (toggleAllBtn) toggleAllBtn.title = 'Collapse All';
        } else {
            // Show "expand" icon (unfold-vertical)
            toggleAllIcon.innerHTML = `
                <path d="M12 3v6l3-3m-3 3-3-3" stroke="currentColor" fill="none"></path>
                <path d="M12 21v-6l3 3m-3-3-3 3" stroke="currentColor" fill="none"></path>
                <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor"></line>`;
            if (toggleAllBtn) toggleAllBtn.title = 'Expand All';
        }
    };
    bindClick('btn-toggle-all', () => {
        allExpanded = !allExpanded;
        toggleAllFolders(!allExpanded); // allExpanded=true → shouldCollapse=false (expand)
        updateToggleIcon();
    });

    // Overflow menu toggle
    const overflowBtn = document.getElementById('btn-overflow');
    const overflowMenu = document.getElementById('overflow-menu');
    if (overflowBtn && overflowMenu) {
        overflowBtn.onclick = (e) => {
            e.stopPropagation();
            overflowMenu.classList.toggle('hidden');
            const isOpen = !overflowMenu.classList.contains('hidden');
            overflowBtn.setAttribute('aria-expanded', String(isOpen));
        };
        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.overflow-menu-wrapper')) {
                overflowMenu.classList.add('hidden');
                overflowBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    bindClick('overflow-clear-clipboard', () => {
        navigator.clipboard.writeText('');
        appClipboard = null;
        refreshAll();
        if (overflowMenu) overflowMenu.classList.add('hidden');
        showToast("🧹 Clipboard Cleared");
    });

    const sOverlay = document.getElementById('settings-overlay');
    bindClick('overflow-settings', () => {
        if (sOverlay) sOverlay.classList.remove('hidden');
        if (overflowMenu) overflowMenu.classList.add('hidden');
    });
    bindClick('btn-close-settings', () => { if (sOverlay) sOverlay.classList.add('hidden'); });
    if (sOverlay) sOverlay.onclick = (e) => { if (e.target === sOverlay) sOverlay.classList.add('hidden'); };

    bindClick('btn-save-username', () => {
        const val = document.getElementById('username-input').value.trim();
        chrome.storage.local.set({ username: val }, () => {
            const t = document.querySelector('.app-title');
            if (t) t.textContent = `${val || 'user'}@CmdVault:~$`;
            showToast("✅ Saved");
        });
    });

    bindClick('btn-save-token', () => {
        const t = document.getElementById('gh-token-input').value.trim();
        // Agregamos updateSettingsUI() para habilitar los botones visualmente tras guardar
        if (t) { ghToken = t; chrome.storage.local.set({ ghToken: t }, () => { showToast("💾 Saved"); updateSettingsUI(); }); }
    });
    bindClick('btn-sync-upload', () => uploadToGist());
    bindClick('btn-sync-download', () => downloadFromGist());

    // --- Update Checker buttons ---
    bindClick('btn-check-update', () => checkForUpdates(true));
    bindClick('btn-download-update', () => {
        // Download ZIP with custom filename (CmdVault-v{version}.zip)
        chrome.storage.local.get(['cachedUpdateResult'], async (items) => {
            const remote = items.cachedUpdateResult;
            if (remote && remote.download_url) {
                try {
                    showToast('⬇️ Downloading...');
                    const resp = await fetch(remote.download_url);
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const blob = await resp.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `CmdVault-v${remote.version}.zip`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showToast('✅ Download complete');
                } catch (err) {
                    console.warn('Download failed:', err.message);
                    // Fallback: open URL directly
                    window.open(remote.download_url, '_blank');
                }
            } else {
                showToast('⚠️ No download URL available');
            }
        });
    });

    const search = document.getElementById('search-input');
    if (search) search.oninput = (e) => refreshAll();

    // Clear search button
    const clearBtn = document.getElementById('btn-search-clear');
    if (clearBtn && search) {
        clearBtn.onclick = (e) => {
            e.stopPropagation();
            search.value = '';
            search.focus();
            refreshAll();
        };
    }

    // Ctrl+Space → focus search box (global shortcut)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === ' ') {
            // Don't activate during inline edit or help page
            if (inlineEditState || helpPageState) return;
            e.preventDefault();
            if (search) {
                search.focus();
                search.select();
            }
        }
    });

    // ==========================================================================
    //  GLOBAL KEYBOARD SHORTCUTS (↑↓←→ navigation, Delete, F2, Enter, Escape, Ctrl+A)
    // ==========================================================================
    document.addEventListener('keydown', (e) => {
        // Guard: block during inline edit, help page, or modals
        if (inlineEditState) return;
        if (helpPageState) return;

        const confirmModal = document.getElementById('confirm-modal-overlay');
        if (confirmModal && !confirmModal.classList.contains('hidden')) return;
        const settingsOvl = document.getElementById('settings-overlay');
        if (settingsOvl && !settingsOvl.classList.contains('hidden')) return;
        const dynamicModal = document.getElementById('dynamic-modal');
        if (dynamicModal && !dynamicModal.classList.contains('hidden')) return;
        const modalOvl = document.getElementById('modal-overlay');
        if (modalOvl && !modalOvl.classList.contains('hidden')) return;

        // Guard: don't intercept when focused on input/textarea/select
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        // --- CTRL+A: Select all visible items ---
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            selectAllNodes();
            return;
        }

        // --- CTRL+Z: Undo ---
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
            e.preventDefault();
            performUndo();
            return;
        }

        // --- CTRL+Y / CTRL+SHIFT+Z: Redo ---
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
            e.preventDefault();
            performRedo();
            return;
        }

        // --- ARROW UP / ARROW DOWN ---
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const items = getVisibleTreeItems();
            if (items.length === 0) return;

            if (selectedNodeId === null) {
                const target = e.key === 'ArrowDown' ? items[0] : items[items.length - 1];
                setSelectedNode(target.dataset.nodeId);
                return;
            }

            const currentIdx = items.findIndex(el => String(el.dataset.nodeId) === String(selectedNodeId));
            if (currentIdx === -1) {
                setSelectedNode(items[0].dataset.nodeId);
                return;
            }

            let nextIdx;
            if (e.key === 'ArrowDown') {
                nextIdx = Math.min(currentIdx + 1, items.length - 1);
            } else {
                nextIdx = Math.max(currentIdx - 1, 0);
            }

            if (e.shiftKey) {
                // Shift+Arrow: extend selection range
                selectNodeRange(items[nextIdx].dataset.nodeId);
            } else {
                // Plain arrow: single select (clears multi-select)
                setSelectedNode(items[nextIdx].dataset.nodeId);
            }
            return;
        }

        // --- ARROW RIGHT: Expand folder / move into first child ---
        if (e.key === 'ArrowRight') {
            if (selectedNodeId === null || isMultiSelect()) return;
            e.preventDefault();
            const node = findNode(treeData, selectedNodeId);
            if (!node || node.type !== 'folder') return;

            if (node.collapsed) {
                // Expand the folder
                node.collapsed = false;
                saveData();
                refreshAll();
            } else if (node.children && node.children.length > 0) {
                // Already expanded — move selection to first child
                const items = getVisibleTreeItems();
                const currentIdx = items.findIndex(el => String(el.dataset.nodeId) === String(selectedNodeId));
                if (currentIdx !== -1 && currentIdx + 1 < items.length) {
                    setSelectedNode(items[currentIdx + 1].dataset.nodeId);
                }
            }
            return;
        }

        // --- ARROW LEFT: Collapse folder / move to parent ---
        if (e.key === 'ArrowLeft') {
            if (selectedNodeId === null || isMultiSelect()) return;
            e.preventDefault();
            const node = findNode(treeData, selectedNodeId);
            if (!node) return;

            if (node.type === 'folder' && !node.collapsed) {
                // Collapse the folder
                node.collapsed = true;
                saveData();
                refreshAll();
            } else {
                // Already collapsed or is a command — navigate to parent folder
                const parentList = findParentList(treeData, selectedNodeId);
                if (parentList && parentList !== treeData) {
                    // Find the parent folder node
                    const parentId = findParentFolderId(treeData, selectedNodeId);
                    if (parentId) {
                        setSelectedNode(parentId);
                    }
                }
            }
            return;
        }

        // --- DELETE KEY ---
        if (e.key === 'Delete') {
            if (selectedNodeId === null && selectedNodeIds.size === 0) return;
            e.preventDefault();

            if (isMultiSelect()) {
                // Multi-delete
                execDeleteMultiple();
            } else {
                // Single delete (legacy behavior)
                const node = findNode(treeData, selectedNodeId);
                if (!node) return;

                const items = getVisibleTreeItems();
                const currentIdx = items.findIndex(el => String(el.dataset.nodeId) === String(selectedNodeId));

                const title = node.type === 'folder' ? 'Delete Folder?' : 'Delete Command?';
                let message = `"${node.name || 'Untitled'}" will be permanently deleted.`;
                if (node.type === 'folder' && node.children && node.children.length > 0) {
                    const childCount = countCommands(node.children);
                    const folderCount = countFolders(node.children);
                    const parts = [];
                    if (childCount > 0) parts.push(`${childCount} command${childCount !== 1 ? 's' : ''}`);
                    if (folderCount > 0) parts.push(`${folderCount} sub-folder${folderCount !== 1 ? 's' : ''}`);
                    if (parts.length > 0) message += ` This folder contains ${parts.join(' and ')}.`;
                }

                const deleteTargetId = selectedNodeId;
                showConfirmModal({ title, message, icon: 'delete' }).then(confirmed => {
                    if (confirmed) {
                        execDelete(deleteTargetId);
                        const newItems = getVisibleTreeItems();
                        if (newItems.length > 0 && currentIdx >= 0) {
                            setSelectedNode(newItems[Math.min(currentIdx, newItems.length - 1)].dataset.nodeId);
                        } else {
                            selectedNodeId = null;
                            selectedNodeIds.clear();
                            updateSelectionBadge();
                        }
                    }
                });
            }
            return;
        }

        // --- F2 KEY: Rename/Edit (only with single selection) ---
        if (e.key === 'F2') {
            if (selectedNodeId === null || isMultiSelect()) return;
            e.preventDefault();
            execEdit(selectedNodeId);
            return;
        }

        // --- ENTER KEY: Toggle folder or copy command (only with single selection) ---
        if (e.key === 'Enter') {
            if (selectedNodeId === null || isMultiSelect()) return;
            e.preventDefault();

            const node = findNode(treeData, selectedNodeId);
            if (!node) return;

            if (node.type === 'folder') {
                node.collapsed = !node.collapsed;
                saveData();
                refreshAll();
            } else if (node.type === 'command') {
                const el = document.querySelector(`.main-content .tree-item[data-node-id="${selectedNodeId}"]`);
                const wrap = el ? el.querySelector('.cmd-wrapper') : null;
                copyToClipboard(node.cmd, node.name, wrap);
            }
            return;
        }

        // --- ESCAPE KEY: Clear selection ---
        if (e.key === 'Escape') {
            if (selectedNodeId !== null || selectedNodeIds.size > 0) {
                e.preventDefault();
                setSelectedNode(null);
            }
            return;
        }
    });

    const themeSel = document.getElementById('theme-selector');
    if (themeSel) themeSel.onchange = (e) => {
        changeTheme(e.target.value);
        chrome.storage.local.set({ savedTheme: e.target.value });
    };

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu')) {
            const cm = document.getElementById('context-menu');
            if (cm) {
                cm.classList.add('hidden');
                cm.setAttribute('aria-hidden', 'true');
            }
        }

        // Deselect all when clicking on empty area (not on a tree item, context menu, modal, or dynamic-modal)
        if (!e.target.closest('.tree-item') &&
            !e.target.closest('.context-menu') &&
            !e.target.closest('.modal-overlay') &&
            !e.target.closest('#dynamic-modal') &&
            !e.target.closest('#confirm-modal-overlay') &&
            !e.target.closest('.section-header') &&
            !e.target.closest('#settings-overlay') &&
            (selectedNodeId !== null || selectedNodeIds.size > 0)) {
            setSelectedNode(null);
        }
    });

    const ctxMenu = document.getElementById('context-menu');
    if (ctxMenu) {
        ctxMenu.onclick = (e) => {
            e.stopPropagation();
            const target = e.target.closest('.ctx-item, .icon-option');
            if (!target) return;

            const id = target.id;
            const close = () => {
                ctxMenu.classList.add('hidden');
                ctxMenu.setAttribute('aria-hidden', 'true');
            };

            if (id === 'ctx-copy') { execCopy(); close(); }
            else if (id === 'ctx-cut') { execCut(); close(); }
            else if (id === 'ctx-paste') { execPaste(); close(); }
            // NEW ACTIONS
            else if (id === 'ctx-expand-all') { toggleFolderRecursively(contextTargetId, false); close(); }
            else if (id === 'ctx-collapse-all') { toggleFolderRecursively(contextTargetId, true); close(); }
            else if (id === 'ctx-export-folder') { exportFolder(contextTargetId); close(); }

            else if (id === 'ctx-pin-toggle') { togglePin(contextTargetId); close(); }
            else if (id === 'ctx-open-url') {
                const node = findNode(treeData, contextTargetId);
                if (node) {
                    const urlInfo = detectUrls(node.cmd);
                    openUrlFromCommand(urlInfo.urls);
                }
                close();
            }
            else if (id === 'ctx-help-page') { openHelpPage(contextTargetId); close(); }
            else if (id === 'ctx-delete') {
                close();
                if (isMultiSelect()) {
                    // Multi-select batch delete
                    execDeleteMultiple();
                } else {
                    const targetId = contextTargetId;
                    const node = findNode(treeData, targetId);
                    if (!node) return;
                    const title = node.type === 'folder' ? 'Delete Folder?' : 'Delete Command?';
                    let message = `"${node.name || 'Untitled'}" will be permanently deleted.`;
                    if (node.type === 'folder' && node.children && node.children.length > 0) {
                        const childCount = countCommands(node.children);
                        const folderCount = countFolders(node.children);
                        const parts = [];
                        if (childCount > 0) parts.push(`${childCount} command${childCount !== 1 ? 's' : ''}`);
                        if (folderCount > 0) parts.push(`${folderCount} sub-folder${folderCount !== 1 ? 's' : ''}`);
                        if (parts.length > 0) message += ` This folder contains ${parts.join(' and ')}.`;
                    }
                    showConfirmModal({ title, message, icon: 'delete' }).then(confirmed => {
                        if (confirmed) {
                            if (selectedNodeIds.has(String(targetId))) {
                                const items = getVisibleTreeItems();
                                const currentIdx = items.findIndex(el => String(el.dataset.nodeId) === String(targetId));
                                execDelete(targetId);
                                const newItems = getVisibleTreeItems();
                                if (newItems.length > 0 && currentIdx >= 0) {
                                    setSelectedNode(newItems[Math.min(currentIdx, newItems.length - 1)].dataset.nodeId);
                                } else {
                                    selectedNodeId = null;
                                    selectedNodeIds.clear();
                                    updateSelectionBadge();
                                }
                            } else {
                                execDelete(targetId);
                            }
                        }
                    });
                }
            }
            else if (id === 'ctx-move-to-folder') {
                close();
                showMoveToFolderModal();
            }
            else if (id === 'ctx-edit') { execEdit(contextTargetId); close(); }
            else if (id === 'ctx-duplicate') { execDuplicate(contextTargetId); close(); }
            else if (id === 'ctx-add-folder') { execAdd(contextTargetId, 'folder'); close(); }
            else if (id === 'ctx-add-cmd') { execAdd(contextTargetId, 'command'); close(); }
            else if (target.classList.contains('icon-option')) {
                const newIcon = target.dataset.icon;
                const node = findNode(treeData, contextTargetId);
                if (node) {
                    const updates = { icon: newIcon };

                    // Converting TO chain mode: initialize chain from existing cmd
                    if (newIcon === '⛓️' && !node.chain) {
                        const existingCmd = (node.cmd || '').trim();
                        updates.chain = {
                            connector: '&&',
                            steps: existingCmd ? [existingCmd] : ['']
                        };
                    }

                    updateItem(contextTargetId, updates);

                    // Converting FROM chain mode: keep concatenated cmd, remove chain
                    if (newIcon !== '⛓️' && node.chain) {
                        delete node.chain;
                        saveData();
                    }
                }
                close();
            }
        };
    }

    // --- DATA MANAGEMENT (Backup/Restore/Reset) [MIGRADO] ---

    // 1. Exportar (Backup Local)
    bindClick('btn-export', () => {
        if (!treeData || treeData.length === 0) return showToast("⚠️ Nothing to backup");

        const dataStr = JSON.stringify(treeData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        // Agregamos fecha al nombre para mejor organización
        const date = new Date().toISOString().slice(0, 10);
        a.download = `cmdvault_backup_${date}.json`;
        document.body.appendChild(a); // Requerido en algunos contextos de navegador
        a.click();

        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("💾 Backup Downloaded");
    });

    // 2. Importar (Restaurar Local)
    const fileInput = document.getElementById('file-input');
    bindClick('btn-import', () => {
        if (fileInput) fileInput.click();
    });

    if (fileInput) {
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const importedData = JSON.parse(ev.target.result);

                    // Validación básica para asegurar que es un formato válido
                    if (Array.isArray(importedData)) {
                        pushUndoState('Import (replace)');
                        treeData = importedData;
                        saveData();     // Guardar en Storage
                        refreshAll();   // Actualizar UI V2
                        showToast("✅ Import Successful");
                    } else {
                        alert("Error: Invalid JSON format (Expected an Array)");
                    }
                } catch (ex) {
                    console.error(ex);
                    alert("Error parsing JSON file. Please check the file.");
                }
                // Limpiar input para permitir importar el mismo archivo nuevamente si es necesario
                fileInput.value = '';
            };
            reader.readAsText(file);
        };
    }

    // 2b. Merge Import (agrega sin reemplazar)
    const mergeFileInput = document.getElementById('file-input-merge');
    bindClick('btn-merge-import', () => {
        if (mergeFileInput) mergeFileInput.click();
    });

    if (mergeFileInput) {
        mergeFileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const importedData = JSON.parse(ev.target.result);
                    if (!Array.isArray(importedData)) {
                        alert("Error: Invalid JSON format (Expected an Array)");
                        return;
                    }

                    // Sanitize imported nodes (assign missing IDs, default names)
                    const cleanedData = cleanNodes(importedData);

                    // Derive folder name from filename (strip .json extension)
                    const folderName = file.name.replace(/\.json$/i, '');

                    // Wrap imported data in a new root folder
                    const wrapperFolder = {
                        id: genId(),
                        name: folderName,
                        type: 'folder',
                        children: cleanedData,
                        collapsed: false,
                        color: null
                    };

                    // Append to existing data (never overwrites)
                    pushUndoState('Import (merge)');
                    treeData.push(wrapperFolder);
                    saveData();
                    refreshAll();

                    const cmdCount = countCommands(cleanedData);
                    showToast(`📥 Merged: ${cmdCount} commands as "${folderName}"`);

                } catch (ex) {
                    console.error(ex);
                    alert("Error parsing JSON file. Please check the file.");
                }
                mergeFileInput.value = '';
            };
            reader.readAsText(file);
        };
    }

    // 3. Factory Reset
    bindClick('btn-reset', () => {
        showConfirmModal({
            title: 'Factory Reset?',
            message: 'All commands, folders, and history will be permanently deleted. This action cannot be undone.',
            confirmText: 'Reset Everything',
            cancelText: 'Cancel',
            icon: 'danger'
        }).then(confirmed => {
            if (confirmed) {
                pushUndoState('Factory Reset');
                treeData = [{
                    id: genId(),
                    name: "My Commands",
                    type: "folder",
                    children: [],
                    collapsed: false,
                    color: null
                }];
                commandHistory = [];
                selectedNodeId = null;
                selectedNodeIds.clear();
                selectionAnchorId = null;
                updateSelectionBadge();
                chrome.storage.local.set({ linuxTree: treeData, linuxHistory: [] }, () => {
                    refreshAll();
                    showToast("🗑️ Factory Reset Complete");
                    const settingsOverlay = document.getElementById('settings-overlay');
                    if (settingsOverlay) settingsOverlay.classList.add('hidden');
                });
            }
        });
    });





}

function bindClick(id, fn) {
    const el = document.getElementById(id);
    if (el) {
        el.onclick = (e) => { e.stopPropagation(); fn(); };
    }
}

// --- DRAG & DROP ---
function attachDragEvents(row, node) {
    row.draggable = true;

    row.ondragstart = (e) => {
        if (inlineEditState && String(inlineEditState.id) === String(node.id)) { e.preventDefault(); return; }
        draggedId = node.id;
        e.dataTransfer.effectAllowed = 'copyMove';

        // If dragging a selected item in multi-select, drag all selected items
        if (isMultiSelect() && selectedNodeIds.has(String(node.id))) {
            e.dataTransfer.setData('text/plain', [...selectedNodeIds].join(','));
            // Add dragging class to all selected items
            selectedNodeIds.forEach(id => {
                const el = document.querySelector(`.main-content .tree-item[data-node-id="${id}"]`);
                if (el) el.classList.add('dragging');
            });
        } else {
            e.dataTransfer.setData('text/plain', String(node.id));
            row.classList.add('dragging');
        }
    };

    row.ondragend = () => {
        // Remove dragging class from all items (handles multi-select case)
        document.querySelectorAll('.tree-item.dragging').forEach(el => el.classList.remove('dragging'));
        draggedId = null;
        clearDragStyles();
    };

    row.ondragover = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (draggedId === node.id) return;
        const isFolderEmpty = (node.type === 'folder') && (!node.children || node.children.length === 0);
        row.style.borderTop = ''; row.style.borderBottom = ''; row.classList.remove('drop-inside');
        if (isFolderEmpty) {
            row.classList.add('drop-inside');
            e.dataTransfer.dropEffect = 'copy';
            return;
        }
        const rect = row.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const h = rect.height;
        const isCommand = node.type === 'command';
        const threshold = isCommand ? h * 0.5 : h * 0.25;
        if (offsetY < threshold) {
            row.style.borderTop = '2px solid var(--md-sys-color-primary)';
            e.dataTransfer.dropEffect = 'move';
        } else if (isCommand || offsetY > (h - threshold)) {
            row.style.borderBottom = '2px solid var(--md-sys-color-primary)';
            e.dataTransfer.dropEffect = 'move';
        } else {
            row.classList.add('drop-inside');
            e.dataTransfer.dropEffect = 'copy';
        }
    };

    row.ondragleave = (e) => {
        if (!row.contains(e.relatedTarget)) {
            row.style.borderTop = ''; row.style.borderBottom = ''; row.classList.remove('drop-inside');
        }
    };

    row.ondrop = (e) => {
        e.preventDefault(); e.stopPropagation();
        clearDragStyles();
        const sourceId = draggedId;
        if (sourceId && String(sourceId) !== String(node.id)) {
            let action = 'inside';
            const isFolderEmpty = (node.type === 'folder') && (!node.children || node.children.length === 0);
            if (!isFolderEmpty) {
                const rect = row.getBoundingClientRect();
                const offsetY = e.clientY - rect.top;
                const h = rect.height;
                const isCommand = node.type === 'command';
                const threshold = isCommand ? h * 0.5 : h * 0.25;
                if (offsetY < threshold) action = 'before';
                else if (isCommand || offsetY > (h - threshold)) action = 'after';
                else action = 'inside';
            }

            // Multi-select drag: move all selected items if the dragged item was selected
            if (isMultiSelect() && selectedNodeIds.has(String(sourceId)) && !selectedNodeIds.has(String(node.id))) {
                performMoveMultiple(node.id, action);
            } else {
                performMove(sourceId, node.id, action);
            }
        }
    };
}

function performMove(sourceId, targetId, action) {
    if (String(sourceId) === String(targetId)) return;
    const sourceList = findParentList(treeData, sourceId);
    if (!sourceList) return;
    const sIdx = sourceList.findIndex(n => String(n.id) === String(sourceId));
    if (sIdx === -1) return;
    pushUndoState(`Move: ${sourceList[sIdx].name || 'Untitled'}`);
    const item = sourceList.splice(sIdx, 1)[0];
    if (action === 'inside') {
        const target = findNode(treeData, targetId);
        if (target && target.type === 'folder') {
            if (!target.children) target.children = [];
            target.children.push(item);
            target.collapsed = false;
        } else {
            treeData.push(item);
        }
    } else {
        const targetList = findParentList(treeData, targetId);
        if (targetList) {
            const targetIdx = targetList.findIndex(n => String(n.id) === String(targetId));
            const insertIdx = action === 'after' ? targetIdx + 1 : targetIdx;
            targetList.splice(insertIdx, 0, item);
        } else {
            treeData.push(item);
        }
    }
    saveData();
    refreshAll();
}

function clearDragStyles() {
    document.querySelectorAll('.tree-item').forEach(el => {
        el.style.borderTop = ''; el.style.borderBottom = ''; el.classList.remove('drop-inside');
    });
}

// --- ACTIONS ---
function execCopy() {
    const node = findNode(treeData, contextTargetId);
    if (node) {
        appClipboard = { action: 'copy', data: JSON.parse(JSON.stringify(node)) };
        showToast("📋 Copied");
        refreshAll();
    }
}

function execCut() {
    appClipboard = { action: 'cut', id: contextTargetId };
    showToast("✂️ Cut");
    refreshAll();
}

function execPaste() {
    if (!appClipboard || !contextTargetId) return;
    const target = findNode(treeData, contextTargetId);
    if (!target || target.type !== 'folder') return showToast("⚠️ Folders only");

    if (appClipboard.action === 'cut') {
        const sourceId = appClipboard.id;
        const targetId = contextTargetId;
        if (isDescendant(sourceId, targetId)) return showToast("❌ Recursion Error");

        appClipboard = null; // Clean before move to clear visuals
        performMove(sourceId, targetId, 'inside');
        showToast("✅ Moved");
    }
    else {
        pushUndoState(`Paste: ${appClipboard.data.name || 'Untitled'}`);
        const copy = cloneNode(appClipboard.data);
        if (!target.children) target.children = [];
        target.children.push(copy);
        target.collapsed = false;
        saveData();
        refreshAll();
        showToast("✅ Pasted");
    }
}

/**
 * Duplicates a node (command or folder) and inserts the copy right after the original.
 */
function execDuplicate(id) {
    const node = findNode(treeData, id);
    if (!node) return;

    const parentList = findParentList(treeData, id);
    if (!parentList) return;

    pushUndoState(`Duplicate: ${node.name || 'Untitled'}`);

    const copy = cloneNode(node);
    copy.name = `${node.name || 'Untitled'} (copy)`;
    if (copy.pinned) copy.pinned = false; // Don't duplicate pin status

    // Insert right after original
    const idx = parentList.findIndex(n => String(n.id) === String(id));
    parentList.splice(idx + 1, 0, copy);

    saveData();
    refreshAll();
    setSelectedNode(copy.id);
    showToast(`📄 Duplicated: ${node.name || 'Untitled'}`);
}

function execDelete(id) {
    const list = findParentList(treeData, id);
    if (list) {
        const idx = list.findIndex(n => String(n.id) === String(id));
        if (idx !== -1) {
            const node = list[idx];
            pushUndoState(`Delete: ${node.name || 'Untitled'}`);
            list.splice(idx, 1);
            saveData();
            refreshAll();
        }
    }
}

/**
 * Batch delete all items in selectedNodeIds.
 * Shows a confirmation modal, then deletes all in one pass.
 */
function execDeleteMultiple() {
    const count = selectedNodeIds.size;
    if (count === 0) return;
    if (count === 1) {
        // Fallback to single delete flow
        const singleId = [...selectedNodeIds][0];
        const node = findNode(treeData, singleId);
        if (!node) return;
        const title = node.type === 'folder' ? 'Delete Folder?' : 'Delete Command?';
        let message = `"${node.name || 'Untitled'}" will be permanently deleted.`;
        showConfirmModal({ title, message, icon: 'delete' }).then(confirmed => {
            if (confirmed) {
                execDelete(singleId);
                setSelectedNode(null);
            }
        });
        return;
    }

    // Build summary for confirmation
    let folderCount = 0, cmdCount = 0;
    selectedNodeIds.forEach(id => {
        const n = findNode(treeData, id);
        if (n) {
            if (n.type === 'folder') folderCount++;
            else cmdCount++;
        }
    });

    const parts = [];
    if (cmdCount > 0) parts.push(`${cmdCount} command${cmdCount !== 1 ? 's' : ''}`);
    if (folderCount > 0) parts.push(`${folderCount} folder${folderCount !== 1 ? 's' : ''}`);

    const title = `Delete ${count} items?`;
    const message = `${parts.join(' and ')} will be permanently deleted.`;

    const idsToDelete = new Set(selectedNodeIds);

    showConfirmModal({ title, message, icon: 'delete' }).then(confirmed => {
        if (confirmed) {
            pushUndoState(`Delete ${count} items`);
            // Delete from leaves up — use recursive removal to avoid parent-child conflicts
            deleteNodesFromTree(treeData, idsToDelete);
            saveData();
            setSelectedNode(null);
            refreshAll();
            showToast(`🗑️ Deleted ${count} items`);
        }
    });
}

/**
 * Recursively removes all nodes with IDs in the idsSet from the tree.
 * Handles nested structures correctly (if a parent is deleted, children go with it).
 */
function deleteNodesFromTree(nodes, idsSet) {
    for (let i = nodes.length - 1; i >= 0; i--) {
        if (idsSet.has(String(nodes[i].id))) {
            nodes.splice(i, 1);
        } else if (nodes[i].children && nodes[i].type === 'folder') {
            deleteNodesFromTree(nodes[i].children, idsSet);
        }
    }
}

/**
 * Batch move: moves all selected nodes into a target folder.
 */
function performMoveMultiple(targetId, action) {
    const idsToMove = [...selectedNodeIds].filter(id => String(id) !== String(targetId));
    if (idsToMove.length === 0) return;

    pushUndoState(`Move ${idsToMove.length} items`);

    // Collect nodes first, then remove, then insert
    const nodesToMove = [];
    idsToMove.forEach(id => {
        const node = findNode(treeData, id);
        if (node) nodesToMove.push({ id, node: JSON.parse(JSON.stringify(node)) });
    });

    // Remove originals (reverse to avoid index shifts)
    const idsSet = new Set(idsToMove.map(String));
    deleteNodesFromTree(treeData, idsSet);

    // Insert at target
    if (action === 'inside') {
        const target = findNode(treeData, targetId);
        if (target && target.type === 'folder') {
            if (!target.children) target.children = [];
            nodesToMove.forEach(item => target.children.push(item.node));
            target.collapsed = false;
        } else {
            nodesToMove.forEach(item => treeData.push(item.node));
        }
    } else {
        const targetList = findParentList(treeData, targetId);
        if (targetList) {
            const targetIdx = targetList.findIndex(n => String(n.id) === String(targetId));
            const insertIdx = action === 'after' ? targetIdx + 1 : targetIdx;
            // Insert in order
            for (let i = 0; i < nodesToMove.length; i++) {
                targetList.splice(insertIdx + i, 0, nodesToMove[i].node);
            }
        } else {
            nodesToMove.forEach(item => treeData.push(item.node));
        }
    }

    saveData();
    setSelectedNode(null);
    refreshAll();
    showToast(`📦 Moved ${nodesToMove.length} items`);
}

/**
 * Shows a modal to pick a destination folder for batch move.
 * Lists all folders in the tree (excluding selected items).
 */
function showMoveToFolderModal() {
    const folders = [];
    const selectedIds = new Set(selectedNodeIds);

    function collectFolders(nodes, path = '') {
        nodes.forEach(n => {
            if (n.type === 'folder' && !selectedIds.has(String(n.id))) {
                folders.push({ id: n.id, name: path + n.name });
                if (n.children) collectFolders(n.children, path + n.name + ' / ');
            }
        });
    }
    collectFolders(treeData);

    if (folders.length === 0) {
        showToast("⚠️ No destination folders available");
        return;
    }

    // Build a simple selection list using the dynamic modal
    const modal = document.getElementById('dynamic-modal');
    if (!modal) return;

    let html = `<div style="padding: 16px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--md-sys-color-on-surface);">
            Move ${selectedNodeIds.size} items to:
        </h3>
        <div class="move-folder-list" style="max-height: 300px; overflow-y: auto;">`;

    folders.forEach(f => {
        html += `<div class="move-folder-option ctx-item" data-folder-id="${f.id}" style="padding: 8px 12px; cursor: pointer; border-radius: var(--radius-sm); margin: 2px 0;">
            📁 ${f.name}
        </div>`;
    });

    html += `</div>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
            <button class="btn-cancel-move" style="padding: 6px 16px; border: 1px solid var(--md-sys-color-outline); background: transparent; color: var(--md-sys-color-on-surface); border-radius: var(--radius-sm); cursor: pointer;">Cancel</button>
        </div>
    </div>`;

    modal.innerHTML = html;
    modal.classList.remove('hidden');

    // Event listeners
    modal.querySelectorAll('.move-folder-option').forEach(opt => {
        opt.onclick = () => {
            const folderId = opt.dataset.folderId;
            modal.classList.add('hidden');
            performMoveMultiple(folderId, 'inside');
        };
    });

    const cancelBtn = modal.querySelector('.btn-cancel-move');
    if (cancelBtn) cancelBtn.onclick = () => modal.classList.add('hidden');
}

function execAdd(parentId, type) {
    cancelInlineEdit();

    const newId = genId();
    const tempNode = type === 'folder'
        ? { id: newId, name: '', type: 'folder', children: [], collapsed: false, color: null }
        : { id: newId, name: '', description: '', cmd: '', tags: [], type: 'command', icon: 'cmd', expanded: false };

    // Insert silently, then render to place it in the DOM
    addItemToTreeSilent(parentId, tempNode);
    // Temporarily clear state so refreshAll renders the tree
    inlineEditState = null;
    refreshAll();

    // Find the newly rendered DOM element and open the editor
    const domElement = findNodeDomElement(newId);
    if (!domElement) return;

    openInlineEditor(domElement, tempNode, 'add', parentId);
}

/* --- FUNCIÓN DE EDICIÓN INLINE (Modo Edicion Rapida) --- */
function execEdit(id) {
    const node = findNode(treeData, id);
    if (!node) return;

    cancelInlineEdit();

    const domElement = findNodeDomElement(id);
    if (!domElement) return;

    openInlineEditor(domElement, node, 'edit', null);
}

// --- NEW RECURSIVE ACTIONS ---
function toggleFolderRecursively(id, shouldCollapse) {
    const targetNode = findNode(treeData, id);
    if (!targetNode) return;

    // Función recursiva interna
    const traverse = (node) => {
        if (node.type === 'folder') {
            node.collapsed = shouldCollapse;
            if (node.children && Array.isArray(node.children)) {
                node.children.forEach(traverse);
            }
        }
    };

    traverse(targetNode);
    saveData();
    refreshAll();
}

// Global expand/collapse: traverses entire treeData in one pass
function toggleAllFolders(shouldCollapse) {
    const traverse = (nodes) => {
        for (const n of nodes) {
            if (n.type === 'folder') {
                n.collapsed = shouldCollapse;
                if (n.children) traverse(n.children);
            }
        }
    };
    traverse(treeData);
    saveData();
    refreshAll();
}

function addItemToTree(parentId, item) {
    if (!parentId) {
        treeData.push(item);
    } else {
        const parent = findNode(treeData, parentId);
        if (parent) {
            if (!parent.children) parent.children = [];
            parent.children.push(item);
            parent.collapsed = false;
        }
    }
    saveData();
    refreshAll();
}

function updateItem(id, updates) {
    const node = findNode(treeData, id);
    if (node) {
        pushUndoState(`Update: ${node.name || 'Untitled'}`);
        Object.assign(node, updates);
        saveData();
        refreshAll();
    }
}

const MAX_FAVORITES = 10;

function togglePin(id) {
    const node = findNode(treeData, id);
    if (!node) return;

    // Enforce max favorites limit when pinning (not when unpinning)
    if (!node.pinned) {
        const currentPinned = getAllPinnedItems(treeData);
        if (currentPinned.length >= MAX_FAVORITES) {
            showToast(`⚠️ Maximum ${MAX_FAVORITES} favorites allowed. Unpin one first.`);
            return;
        }
    }

    node.pinned = !node.pinned;
    saveData();
    refreshAll();
}

// --- UTILS ---
function genId() { return 'n-' + Date.now() + Math.random().toString(36).substr(2, 4); }

function exportFolder(id) {
    const node = findNode(treeData, id);
    if (!node || node.type !== 'folder') return showToast("⚠️ Folder not found");

    const dataStr = JSON.stringify(node.children || [], null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const safeName = (node.name || 'folder').replace(/[^a-zA-Z0-9_-]/g, '_');
    const date = new Date().toISOString().slice(0, 10);
    a.download = `cmdvault_${safeName}_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const cmdCount = countCommands(node.children || []);
    showToast(`💾 Exported "${node.name}" (${cmdCount} commands)`);
}

function countCommands(nodes) {
    let count = 0;
    for (const n of nodes) {
        if (n.type === 'command') count++;
        if (n.children) count += countCommands(n.children);
    }
    return count;
}

function countFolders(nodes) {
    let count = 0;
    for (const n of nodes) {
        if (n.type === 'folder') {
            count++;
            if (n.children) count += countFolders(n.children);
        }
    }
    return count;
}

function findNode(nodes, id) {
    for (let n of nodes) {
        if (String(n.id) === String(id)) return n;
        if (n.children) {
            const f = findNode(n.children, id);
            if (f) return f;
        }
    }
    return null;
}

function findParentList(nodes, id) {
    for (let n of nodes) {
        if (String(n.id) === String(id)) return nodes;
        if (n.children) {
            const l = findParentList(n.children, id);
            if (l) return l;
        }
    }
    return null;
}

/**
 * Finds the ID of the parent folder that contains the node with the given id.
 * Returns null if the node is at root level.
 */
function findParentFolderId(nodes, id, parentId = null) {
    for (let n of nodes) {
        if (String(n.id) === String(id)) return parentId;
        if (n.children && n.type === 'folder') {
            const found = findParentFolderId(n.children, id, n.id);
            if (found !== undefined) return found;
        }
    }
    return undefined;
}

/**
 * Builds the ancestor path (array of folder nodes) from root to the given nodeId.
 * Returns array like [grandparent, parent, node] for breadcrumb display.
 */
function getAncestorPath(nodes, nodeId) {
    const path = [];
    function walk(list) {
        for (const n of list) {
            if (String(n.id) === String(nodeId)) {
                path.push(n);
                return true;
            }
            if (n.children && n.type === 'folder') {
                if (walk(n.children)) {
                    path.unshift(n);
                    return true;
                }
            }
        }
        return false;
    }
    walk(nodes);
    return path;
}

function isDescendant(parentId, childId) {
    const parent = findNode(treeData, parentId);
    if (!parent || !parent.children) return false;
    const check = (list) => list.some(n => String(n.id) === String(childId) || (n.children && check(n.children)));
    return check(parent.children);
}

function cloneNode(node) {
    const copy = { ...node, id: genId() };
    if (copy.children) copy.children = copy.children.map(c => cloneNode(c));
    // Deep-copy chain to avoid shared references
    if (copy.chain) {
        copy.chain = { connector: copy.chain.connector, steps: [...copy.chain.steps] };
    }
    return copy;
}

function changeTheme(themeName) {
    document.body.className = themeName;
    currentTheme = themeName;
    // Re-render tree so folder colors adapt to the new theme's contrast
    if (isDataLoaded) refreshAll();
}

// ==========================================================================
/**
 * Collects all unique tags from the entire tree.
 * Traverses treeData recursively, deduplicates, and returns sorted lowercase array.
 * Used to power the tag suggestion chips in the inline editor.
 */
function collectAllTags(nodes) {
    const tagSet = new Set();
    function walk(list) {
        for (const n of list) {
            if (Array.isArray(n.tags)) n.tags.forEach(t => tagSet.add(t.toLowerCase()));
            if (n.children) walk(n.children);
        }
    }
    walk(nodes);
    return [...tagSet].sort();
}

//  INLINE EDITING SYSTEM (Modo Edicion Rapida)
// ==========================================================================

function findNodeDomElement(id) {
    return document.querySelector(`#tree-container [data-node-id="${id}"]`);
}

function addItemToTreeSilent(parentId, item) {
    if (!parentId) {
        treeData.push(item);
    } else {
        const parent = findNode(treeData, parentId);
        if (parent) {
            if (!parent.children) parent.children = [];
            parent.children.push(item);
            parent.collapsed = false;
        }
    }
}

function removeNodeById(id) {
    const list = findParentList(treeData, id);
    if (list) {
        const idx = list.findIndex(n => String(n.id) === String(id));
        if (idx !== -1) list.splice(idx, 1);
    }
}

function createFieldGroup(label, tagName, className, value, placeholder) {
    const group = document.createElement('div');
    group.className = 'inline-edit-field-group';

    const lbl = document.createElement('label');
    lbl.className = 'inline-edit-label';
    lbl.textContent = label;
    group.appendChild(lbl);

    const input = document.createElement(tagName);
    input.className = `inline-edit-input ${className}`;
    input.placeholder = placeholder;
    input.value = value;

    if (tagName === 'textarea') {
        input.rows = 3;
        input.style.fontFamily = 'var(--font-code)';
    }

    group.appendChild(input);
    return group;
}

/**
 * Builds the chain editor UI for Command Chaining (⛓️ mode).
 * Renders: connector selector, ordered step inputs with drag/reorder, add/remove, live preview.
 */
function buildChainEditor(node) {
    // Initialize chain if not present
    if (!node.chain) {
        node.chain = {
            connector: '&&',
            steps: (node.cmd || '').trim() ? [(node.cmd || '').trim()] : ['']
        };
    }

    const container = document.createElement('div');
    container.className = 'chain-editor';

    // --- CONNECTOR SELECTOR ---
    const connectorGroup = document.createElement('div');
    connectorGroup.className = 'inline-edit-field-group';
    const connectorLabel = document.createElement('label');
    connectorLabel.className = 'inline-edit-label';
    connectorLabel.textContent = 'Connector';
    connectorGroup.appendChild(connectorLabel);

    const connectorSelect = document.createElement('select');
    connectorSelect.className = 'inline-edit-input chain-connector-select';
    [
        { val: '&&', label: '&& (stop on fail)' },
        { val: ';',  label: ';  (run all)' },
        { val: '|',  label: '|  (pipe output)' }
    ].forEach(op => {
        const opt = document.createElement('option');
        opt.value = op.val;
        opt.textContent = op.label;
        if (op.val === node.chain.connector) opt.selected = true;
        connectorSelect.appendChild(opt);
    });
    connectorGroup.appendChild(connectorSelect);
    container.appendChild(connectorGroup);

    // --- STEPS LABEL ---
    const stepsLabel = document.createElement('label');
    stepsLabel.className = 'inline-edit-label';
    stepsLabel.textContent = 'Steps';
    container.appendChild(stepsLabel);

    // --- STEPS LIST ---
    const stepsList = document.createElement('div');
    stepsList.className = 'chain-steps-list';

    const renderSteps = () => {
        stepsList.innerHTML = '';
        node.chain.steps.forEach((step, i) => {
            const row = document.createElement('div');
            row.className = 'chain-step-row';

            // Step number
            const num = document.createElement('span');
            num.className = 'chain-step-num';
            num.textContent = `${i + 1}.`;
            row.appendChild(num);

            // Step input
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'inline-edit-input chain-step-input';
            input.value = step;
            input.placeholder = `Step ${i + 1} command...`;
            input.dataset.stepIndex = i;
            input.addEventListener('input', () => {
                node.chain.steps[i] = input.value;
                updatePreview();
            });
            // Enter on step input: add new step after this one
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    node.chain.steps.splice(i + 1, 0, '');
                    renderSteps();
                    const inputs = stepsList.querySelectorAll('.chain-step-input');
                    if (inputs[i + 1]) inputs[i + 1].focus();
                }
                // Backspace on empty step: remove it and focus previous
                if (e.key === 'Backspace' && input.value === '' && node.chain.steps.length > 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    node.chain.steps.splice(i, 1);
                    renderSteps();
                    const inputs = stepsList.querySelectorAll('.chain-step-input');
                    const focusIdx = Math.max(0, i - 1);
                    if (inputs[focusIdx]) inputs[focusIdx].focus();
                }
            });
            row.appendChild(input);

            // Move up button
            const upBtn = document.createElement('button');
            upBtn.className = 'chain-step-move';
            upBtn.innerHTML = '▲';
            upBtn.title = 'Move up';
            upBtn.disabled = i === 0;
            upBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (i > 0) {
                    [node.chain.steps[i - 1], node.chain.steps[i]] = [node.chain.steps[i], node.chain.steps[i - 1]];
                    renderSteps();
                    updatePreview();
                }
            };
            row.appendChild(upBtn);

            // Move down button
            const downBtn = document.createElement('button');
            downBtn.className = 'chain-step-move';
            downBtn.innerHTML = '▼';
            downBtn.title = 'Move down';
            downBtn.disabled = i === node.chain.steps.length - 1;
            downBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (i < node.chain.steps.length - 1) {
                    [node.chain.steps[i], node.chain.steps[i + 1]] = [node.chain.steps[i + 1], node.chain.steps[i]];
                    renderSteps();
                    updatePreview();
                }
            };
            row.appendChild(downBtn);

            // Delete button
            const delBtn = document.createElement('button');
            delBtn.className = 'chain-step-delete';
            delBtn.innerHTML = '✕';
            delBtn.title = 'Remove step';
            delBtn.disabled = node.chain.steps.length <= 1;
            delBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (node.chain.steps.length <= 1) return;
                node.chain.steps.splice(i, 1);
                renderSteps();
                updatePreview();
            };
            row.appendChild(delBtn);

            stepsList.appendChild(row);
        });
    };

    renderSteps();
    container.appendChild(stepsList);

    // --- ADD STEP BUTTON ---
    const addBtn = document.createElement('button');
    addBtn.className = 'chain-add-step-btn';
    addBtn.innerHTML = '+ Add Step';
    addBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        node.chain.steps.push('');
        renderSteps();
        const inputs = stepsList.querySelectorAll('.chain-step-input');
        if (inputs.length > 0) inputs[inputs.length - 1].focus();
        updatePreview();
    };
    container.appendChild(addBtn);

    // --- PREVIEW ---
    const previewGroup = document.createElement('div');
    previewGroup.className = 'chain-preview-group';
    const previewLabel = document.createElement('label');
    previewLabel.className = 'inline-edit-label';
    previewLabel.textContent = 'Preview';
    previewGroup.appendChild(previewLabel);

    const previewPre = document.createElement('pre');
    previewPre.className = 'chain-preview';

    const updatePreview = () => {
        const connector = connectorSelect.value;
        const sep = connector === '|' ? ' | ' : ` ${connector} `;
        const fullCmd = node.chain.steps.filter(s => s.trim()).join(sep);
        previewPre.textContent = fullCmd || '(empty)';
    };

    connectorSelect.addEventListener('change', () => {
        node.chain.connector = connectorSelect.value;
        updatePreview();
    });

    updatePreview();
    previewGroup.appendChild(previewPre);
    container.appendChild(previewGroup);

    return container;
}

function buildInlineForm(node) {
    const form = document.createElement('div');
    form.className = 'inline-edit-form';

    // NAME (always)
    const nameGroup = createFieldGroup('Name', 'input', 'inline-edit-name', node.name || '', 'Enter name...');
    form.appendChild(nameGroup);

    if (node.type === 'command') {
        // DESCRIPTION
        const descGroup = createFieldGroup('Description', 'input', 'inline-edit-desc', node.description || '', 'Enter description...');
        form.appendChild(descGroup);

        // COMMAND — Chain editor OR single textarea
        const isChain = node.icon === '⛓️' || node.chain;
        if (isChain) {
            const chainEditor = buildChainEditor(node);
            form.appendChild(chainEditor);
        } else {
            const cmdGroup = createFieldGroup('Command', 'textarea', 'inline-edit-cmd', node.cmd || '', 'Enter command...');
            form.appendChild(cmdGroup);
        }

        // TAGS
        const tagsValue = Array.isArray(node.tags) ? node.tags.join(', ') : '';
        const tagsGroup = createFieldGroup('Tags', 'input', 'inline-edit-tags', tagsValue, 'tag1, tag2, tag3...');
        form.appendChild(tagsGroup);

        // TAG SUGGESTIONS — clickable chips from existing tags
        const allTags = collectAllTags(treeData);
        if (allTags.length > 0) {
            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.className = 'tag-suggestions';

            const tagsInput = tagsGroup.querySelector('.inline-edit-tags');

            /** Parses the input value into an array of current tag strings */
            const getCurrentTags = () => (tagsInput.value || '')
                .split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0);

            /** Renders/refreshes the suggestion chips based on current input */
            const refreshChips = () => {
                suggestionsDiv.innerHTML = '';
                const currentTags = getCurrentTags();
                const available = allTags.filter(t => !currentTags.includes(t));

                if (available.length === 0) {
                    suggestionsDiv.style.display = 'none';
                    return;
                }
                suggestionsDiv.style.display = '';

                available.forEach(tag => {
                    const chip = document.createElement('span');
                    chip.className = 'tag-chip';

                    // Apply cloud/precaution styling
                    const cloudConfig = CLOUD_TAG_CONFIG[tag];
                    if (cloudConfig) {
                        chip.classList.add(cloudConfig.cssClass);
                        chip.innerHTML = `<span class="tag-icon">${cloudConfig.icon}</span>${tag}`;
                    } else if (tag === 'precaution') {
                        chip.classList.add('precaution');
                        chip.textContent = tag;
                    } else {
                        chip.textContent = tag;
                    }

                    chip.onclick = (e) => {
                        e.stopPropagation();
                        // Enforce max 5 tags
                        if (getCurrentTags().length >= 5) {
                            showToast('⚠️ Max 5 tags allowed');
                            return;
                        }
                        // Append tag to input
                        const current = tagsInput.value.trim();
                        tagsInput.value = current ? `${current}, ${tag}` : tag;
                        refreshChips();
                    };

                    suggestionsDiv.appendChild(chip);
                });
            };

            // Live sync: refresh chips when user types in the tag input
            if (tagsInput) tagsInput.addEventListener('input', refreshChips);

            refreshChips();
            form.appendChild(suggestionsDiv);
        }
    }

    // ACTION BUTTONS
    const actions = document.createElement('div');
    actions.className = 'inline-edit-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'inline-edit-btn inline-edit-save';
    saveBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Save`;
    saveBtn.onclick = (e) => { e.stopPropagation(); saveInlineEdit(); };

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'inline-edit-btn inline-edit-cancel';
    cancelBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Cancel`;
    cancelBtn.onclick = (e) => { e.stopPropagation(); cancelInlineEdit(); };

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    form.appendChild(actions);

    // KEYBOARD HANDLING
    form.addEventListener('keydown', (e) => {
        e.stopPropagation();

        if (e.key === 'Escape') {
            e.preventDefault();
            cancelInlineEdit();
            return;
        }

        if (e.key === 'Enter') {
            // Textarea: Enter = newline, Ctrl+Enter = save
            if (e.target.tagName === 'TEXTAREA' && !e.ctrlKey) return;

            const inputs = form.querySelectorAll('input, textarea');
            const lastInput = inputs[inputs.length - 1];

            if (e.target === lastInput || e.ctrlKey) {
                e.preventDefault();
                saveInlineEdit();
                return;
            }

            // Move to next field
            e.preventDefault();
            const idx = Array.from(inputs).indexOf(e.target);
            if (idx >= 0 && idx < inputs.length - 1) {
                inputs[idx + 1].focus();
            }
        }
    });

    // Prevent event propagation to tree
    form.addEventListener('click', (e) => e.stopPropagation());
    form.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); });

    return form;
}

function openInlineEditor(domElement, node, mode, parentId) {
    const originalSnapshot = JSON.parse(JSON.stringify(node));

    const form = buildInlineForm(node);

    inlineEditState = {
        id: node.id,
        mode: mode,
        type: node.type,
        parentId: parentId,
        originalNode: mode === 'edit' ? originalSnapshot : null,
        formElement: form
    };

    // Find the .tree-item row inside the wrapper
    const treeItemRow = domElement.querySelector('.tree-item') || domElement;

    // Hide existing content
    const header = treeItemRow.querySelector('.item-header');
    const cmdWrapper = treeItemRow.querySelector('.cmd-wrapper');
    if (header) header.style.display = 'none';
    if (cmdWrapper) cmdWrapper.style.display = 'none';

    // Insert the form
    treeItemRow.insertBefore(form, treeItemRow.firstChild);
    treeItemRow.classList.add('inline-editing');
    treeItemRow.draggable = false;

    // Focus first input
    const firstInput = form.querySelector('input, textarea');
    if (firstInput) {
        firstInput.focus();
        if (mode === 'edit') firstInput.select();
    }

    // Scroll into view
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function saveInlineEdit() {
    if (!inlineEditState) return;

    const form = inlineEditState.formElement;
    const node = findNode(treeData, inlineEditState.id);
    if (!node) { cancelInlineEdit(); return; }

    // Read name
    const nameInput = form.querySelector('.inline-edit-name');
    const name = nameInput ? nameInput.value.trim() : '';

    // Validate: name required
    if (!name) {
        if (nameInput) {
            nameInput.classList.add('inline-edit-error');
            nameInput.focus();
            setTimeout(() => nameInput.classList.remove('inline-edit-error'), 2000);
        }
        showToast('⚠️ Name is required');
        return;
    }

    // Save undo state before applying edits
    if (inlineEditState.mode === 'edit') {
        pushUndoState(`Edit: ${node.name || 'Untitled'}`);
    } else if (inlineEditState.mode === 'add') {
        pushUndoState(`Add: ${name}`);
    }

    node.name = name;

    if (node.type === 'command') {
        const descInput = form.querySelector('.inline-edit-desc');
        const tagsInput = form.querySelector('.inline-edit-tags');

        node.description = descInput ? descInput.value : '';

        // CHAIN MODE: read from chain editor
        const isChain = node.icon === '⛓️' || node.chain;
        if (isChain && node.chain) {
            const connectorSelect = form.querySelector('.chain-connector-select');
            node.chain.connector = connectorSelect ? connectorSelect.value : '&&';

            // Read step values from inputs
            const stepInputs = form.querySelectorAll('.chain-step-input');
            if (stepInputs.length > 0) {
                node.chain.steps = Array.from(stepInputs).map(inp => inp.value);
            }

            // Remove empty steps
            node.chain.steps = node.chain.steps.filter(s => s.trim().length > 0);

            if (node.chain.steps.length === 0) {
                showToast('⚠️ At least one step is required');
                return;
            }

            // Auto-generate node.cmd from chain
            const sep = node.chain.connector === '|' ? ' | ' : ` ${node.chain.connector} `;
            node.cmd = node.chain.steps.join(sep);
        } else {
            // NORMAL MODE: read from textarea
            const cmdInput = form.querySelector('.inline-edit-cmd');
            node.cmd = cmdInput ? cmdInput.value : '';

            // For new commands, validate command field
            if (inlineEditState.mode === 'add' && !node.cmd.trim()) {
                if (cmdInput) {
                    cmdInput.classList.add('inline-edit-error');
                    cmdInput.focus();
                    setTimeout(() => cmdInput.classList.remove('inline-edit-error'), 2000);
                }
                showToast('⚠️ Command is required');
                return;
            }
        }

        // Process tags (max 5 tags, 15 chars each)
        const tagsStr = tagsInput ? tagsInput.value : '';
        let parsedTags = tagsStr
            ? tagsStr.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0)
            : [];

        // Enforce limits
        parsedTags = parsedTags.map(t => t.length > 15 ? t.substring(0, 15) : t);
        if (parsedTags.length > 5) {
            parsedTags = parsedTags.slice(0, 5);
            showToast('⚠️ Max 5 tags allowed');
        }
        node.tags = parsedTags;
    }

    const wasAdd = inlineEditState.mode === 'add';
    inlineEditState = null;

    saveData();
    refreshAll();
    showToast(wasAdd ? '✅ Created' : '✅ Saved');
}

function cancelInlineEdit() {
    if (!inlineEditState) return;

    const { id, mode, originalNode } = inlineEditState;

    if (mode === 'add') {
        removeNodeById(id);
    } else if (mode === 'edit' && originalNode) {
        const node = findNode(treeData, id);
        if (node) {
            Object.assign(node, originalNode);
        }
    }

    inlineEditState = null;
    refreshAll();
}

// ENTRADA MAESTRA: Redirige al sistema inteligente
/* --- REEMPLAZA TU FUNCIÓN ACTUAL POR ESTA --- */

/* --- BLOQUE DE SEGURIDAD CONSOLIDADO (new_sidepanel.js) --- */

/**
 * Ejecuta el copiado de comandos con feedback visual (Flash + Checkmark)
 * y gestiona la apertura de modales para variables dinámicas.
 */
/**
 * Procesa el copiado al portapapeles con feedback visual doble (Flash + Icono)
 * @param {string} text - El comando a copiar.
 * @param {string} name - Nombre del comando para logs.
 * @param {HTMLElement} element - El contenedor 'wrap' que recibirá el flash.
 */
/**
 * Versión Final Consolidada: Feedback Visual (Flash + Checkmark) y Copiado Inteligente.
 */
/**
 * Versión de Producción: Feedback visual y copiado inteligente.
 * Consolida el flash de fondo y el cambio de icono sin logs de depuración.
 */
/**
 * Procesa el copiado con feedback visual dual:
 * 1. Flash temático (Dorado/Azul) en el contenedor.
 * 2. Checkmark verde (✅) en el botón de acción.
 */
/**
 * Versión de Producción V3.1: Feedback visual, Copiado y Registro en Historial.
 */
/**
 * Versión Final: Feedback Visual + Gestión de Historial (Restaurada de V1)
 */
/**
 * Versión de Producción Final: Feedback Visual + Persistencia de Historial.
 */
/**
 * Versión V3.3: Restauración Forzada de Historial y Feedback Visual.
 */
/**
 * Versión V3.3: Restauración Forzada de Historial y Feedback Visual.
 */
/**
 * Opens detected URLs in a new browser tab.
 * @param {string[]} urls - Array of detected URLs.
 */
function openUrlFromCommand(urls) {
    if (!urls || urls.length === 0) return;
    if (urls.length === 1) {
        chrome.tabs.create({ url: urls[0], active: true });
        showToast('🔗 Opened in new tab');
    } else {
        chrome.tabs.create({ url: urls[0], active: true });
        showToast(`🔗 Opened first URL (${urls.length} found)`);
    }
}

function showToast(m) {
    const e = document.getElementById('status-msg');
    if (e) {
        e.textContent = m;
        e.classList.remove('hidden');
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => e.classList.add('hidden'), 3000);
    }
}

// --- CUSTOM CONFIRM MODAL (Replaces native confirm()) ---

function showConfirmModal(options) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('confirm-modal-overlay');
        const titleEl = document.getElementById('confirm-modal-title');
        const messageEl = document.getElementById('confirm-modal-message');
        const iconEl = document.getElementById('confirm-modal-icon');
        const confirmBtn = document.getElementById('confirm-modal-confirm');
        const cancelBtn = document.getElementById('confirm-modal-cancel');

        if (!overlay) { resolve(false); return; }

        // Populate content
        titleEl.textContent = options.title || 'Are you sure?';
        messageEl.textContent = options.message || '';
        confirmBtn.textContent = options.confirmText || 'Delete';
        cancelBtn.textContent = options.cancelText || 'Cancel';

        // Icon SVGs
        const deleteIcon = `<svg viewBox="0 0 24 24"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
        const dangerIcon = `<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        iconEl.innerHTML = options.icon === 'danger' ? dangerIcon : deleteIcon;

        let resolved = false;
        function cleanup(result) {
            if (resolved) return;
            resolved = true;
            overlay.classList.add('hidden');
            document.removeEventListener('keydown', onKeydown);
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            overlay.removeEventListener('click', onOverlayClick);
            resolve(result);
        }

        function onConfirm() { cleanup(true); }
        function onCancel() { cleanup(false); }
        function onOverlayClick(e) { if (e.target === overlay) cleanup(false); }
        function onKeydown(e) {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cleanup(false); }
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                cleanup(document.activeElement === confirmBtn);
            }
        }

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        overlay.addEventListener('click', onOverlayClick);
        document.addEventListener('keydown', onKeydown);

        // Show modal and auto-focus Cancel for safety
        overlay.classList.remove('hidden');
        cancelBtn.focus();
    });
}

// --- INYECCIÓN DE CONTEXT MENU (FIX) ---
function injectContextMenu() {
    const menu = document.getElementById('context-menu');
    if (!menu) return;

    // Verificar si ya existe expand-all para no duplicar
    if (document.getElementById('ctx-expand-all')) return;

    // HTML de los botones nuevos
    const newItems = `
    <div class="ctx-item" id="ctx-expand-all" role="menuitem" style="display:none">🔽 Expand All</div>
    <div class="ctx-item" id="ctx-collapse-all" role="menuitem" style="display:none">▶️ Collapse All</div>

    <hr class="ctx-hr" id="ctx-hr-collapse" style="display:none">
`;

    // Insertar ANTES de las opciones de portapapeles si existen, o antes de Editar
    const ref = document.getElementById('ctx-copy') || document.getElementById('ctx-edit');
    if (ref) {
        ref.insertAdjacentHTML('beforebegin', newItems);
    }
}

/* --- FUNCIÓN CONTEXT MENU CORREGIDA (FIX ICONOS/PIN) --- */
function openContextMenu(e, node) {
    hideCmdTooltip(); // Dismiss tooltip when context menu opens
    const menu = document.getElementById('context-menu');
    const isFolder = node.type === 'folder';
    const multiSelect = isMultiSelect();

    // Helper para manejar visibilidad
    const setVisibility = (id, show, displayStyle = 'block') => {
        const el = document.getElementById(id);
        if (!el) return null;
        if (show) {
            el.classList.remove('hidden');
            el.style.display = displayStyle;
        } else {
            el.classList.add('hidden');
            el.style.display = 'none';
        }
        return el;
    };

    // --- MULTI-SELECT CONTEXT MENU ---
    // When multiple items are selected, show a simplified menu with batch actions
    const multiHeader = document.getElementById('ctx-multi-header');
    if (multiSelect) {
        // Hide single-item sections
        setVisibility('ctx-folder-section', false);
        setVisibility('ctx-hr-collapse', false);
        setVisibility('ctx-cmd-section', false);
        setVisibility('ctx-expand-all', false, 'flex');
        setVisibility('ctx-collapse-all', false, 'flex');
        setVisibility('ctx-copy', false, 'flex');
        setVisibility('ctx-cut', false, 'flex');
        setVisibility('ctx-paste', false, 'flex');
        setVisibility('ctx-edit', false, 'flex');
        setVisibility('ctx-duplicate', false, 'flex');
        setVisibility('ctx-help-page', false, 'flex');

        // Show multi-select header
        if (multiHeader) {
            multiHeader.textContent = `${selectedNodeIds.size} items selected`;
            multiHeader.style.display = 'block';
        }

        // Show delete with count
        const deleteBtn = document.getElementById('ctx-delete');
        if (deleteBtn) {
            deleteBtn.textContent = `🗑️ Delete ${selectedNodeIds.size} items`;
            deleteBtn.style.display = 'flex';
        }

        // Show "Move to folder" if applicable
        setVisibility('ctx-move-to-folder', true, 'flex');
    } else {
        // --- SINGLE-ITEM CONTEXT MENU (original behavior) ---
        if (multiHeader) multiHeader.style.display = 'none';
        setVisibility('ctx-move-to-folder', false, 'flex');

        // Restore single delete text
        const deleteBtn = document.getElementById('ctx-delete');
        if (deleteBtn) deleteBtn.textContent = '🗑️ Delete';

        // Restore visibility of single-item options
        setVisibility('ctx-copy', true, 'flex');
        setVisibility('ctx-cut', true, 'flex');
        setVisibility('ctx-edit', true, 'flex');
        setVisibility('ctx-duplicate', true, 'flex');

        // A. Sección de CARPETAS: Visible solo si es carpeta
        setVisibility('ctx-folder-section', isFolder, 'block');
        setVisibility('ctx-hr-collapse', isFolder, 'block');
        // B. Sección de COMANDOS: Visible solo si NO es carpeta
        const cmdSection = setVisibility('ctx-cmd-section', !isFolder, 'block');

        // C. Configuración específica de Comandos (Solo si es visible)
        if (!isFolder && cmdSection) {
            // Configurar texto del PIN
            const pinBtn = document.getElementById('ctx-pin-toggle');
            if (pinBtn) {
                pinBtn.textContent = node.pinned ? "⭐ Unpin" : "📌 Pin";
                pinBtn.style.display = 'flex';
            }

            // Configurar botón "Open URL" (solo si el comando contiene URLs)
            const openUrlBtn = document.getElementById('ctx-open-url');
            if (openUrlBtn) {
                const urlInfo = detectUrls(node.cmd);
                if (urlInfo.urls.length > 0) {
                    openUrlBtn.style.display = 'flex';
                    openUrlBtn.textContent = urlInfo.isPureUrl
                        ? '🔗 Open URL'
                        : `🔗 Open URL (${urlInfo.urls.length})`;
                } else {
                    openUrlBtn.style.display = 'none';
                }
            }
        }

        // D. Opciones de Expandir/Colapsar (Solo carpetas)
        setVisibility('ctx-expand-all', isFolder, 'flex');
        setVisibility('ctx-collapse-all', isFolder, 'flex');

        // E. Botón Paste (Solo si hay algo en portapapeles y es carpeta)
        const pasteBtn = document.getElementById('ctx-paste');
        if (pasteBtn) {
            if (appClipboard && isFolder) {
                pasteBtn.style.display = 'flex';
                pasteBtn.textContent = appClipboard.action === 'cut' ? '📋 Paste (Move)' : '📋 Paste (Copy)';
            } else {
                pasteBtn.style.display = 'none';
            }
        }
    }

    // --- 2. POSICIONAMIENTO INTELIGENTE ---

    // Paso A: Hacer visible pero transparente para medir dimensiones
    menu.style.visibility = 'hidden';
    menu.classList.remove('hidden');
    menu.style.display = 'block';
    menu.setAttribute('aria-hidden', 'false');

    // Paso B: Obtener dimensiones exactas
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    // Coordenadas iniciales del mouse
    let x = e.clientX;
    let y = e.clientY;

    // Paso C: Detección de Colisiones
    // 1. Ajuste Horizontal
    if (x + menuWidth > winWidth) {
        x = x - menuWidth;
    }

    // 2. Ajuste Vertical
    if (y + menuHeight > winHeight) {
        y = y - menuHeight;
    }

    // 3. Márgenes de seguridad
    if (y < 10) y = 10;
    if (x < 10) x = 10;

    // Paso D: Aplicar coordenadas y revelar
    menu.style.top = `${y}px`;
    menu.style.left = `${x}px`;
    menu.style.visibility = 'visible';
}
/**
 * Opción B: Renderiza los puntos de color en el menú contextual.
 * Ajuste V3: Integra refreshAll() para actualización inmediata.
 */
function renderColorPalette() {
    const p = document.getElementById('ctx-colors');
    if (!p) return;

    p.innerHTML = '';

    // Reset/clear color option (restores folder to theme-default color)
    const resetDot = document.createElement('div');
    resetDot.className = 'color-dot color-dot-reset';
    resetDot.title = 'Reset to default';
    resetDot.innerHTML = '<svg viewBox="0 0 20 20" width="14" height="14"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" stroke-width="1.5"/></svg>';
    resetDot.onclick = () => {
        const updated = updateItemProperty(treeData, contextTargetId, { color: null });
        if (updated) {
            saveData();
            if (typeof refreshAll === 'function') refreshAll();
            const menu = document.getElementById('context-menu');
            if (menu) { menu.classList.add('hidden'); menu.setAttribute('aria-hidden', 'true'); }
        }
    };
    p.appendChild(resetDot);

    FOLDER_COLORS.forEach(c => {
        const d = document.createElement('div');
        d.className = 'color-dot';
        d.style.backgroundColor = c;

        d.onclick = () => {
            // 1. Aplicar cambio (usando la función que acabamos de agregar)
            const updated = updateItemProperty(treeData, contextTargetId, { color: c });

            if (updated) {
                // 2. Persistencia y Renderizado
                saveData();
                if (typeof refreshAll === 'function') refreshAll();

                // 3. UI: Cerrar menú
                const menu = document.getElementById('context-menu');
                if (menu) { menu.classList.add('hidden'); menu.setAttribute('aria-hidden', 'true'); }
                console.log("🎨 Color aplicado exitosamente:", c);
            } else {
                console.error("❌ Error: No se encontró el folder con ID:", contextTargetId);
            }
        };
        p.appendChild(d);
    });
}

function updateItemProperty(list, id, properties) {
    for (let node of list) {
        // Normalizamos IDs a String para asegurar que la comparación sea exitosa
        if (String(node.id) === String(id)) {
            Object.assign(node, properties);
            return true;
        }
        if (node.children && updateItemProperty(node.children, id, properties)) {
            return true;
        }
    }
    return false;
}

function setupDocking() {
    const btn = document.getElementById('overflow-undock');
    if (btn) btn.onclick = async () => {
        try {
            const overflowMenu = document.getElementById('overflow-menu');
            if (overflowMenu) overflowMenu.classList.add('hidden');
            const w = await chrome.windows.getCurrent();
            if (w.type === 'popup') {
                const m = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
                if (m) { await chrome.sidePanel.open({ windowId: m.id }); window.close(); }
            } else {
                await chrome.windows.create({ url: 'sidepanel.html', type: 'popup', width: 400, height: 600 });
            }
        } catch (e) { console.error("Dock error", e); }
    };
}

// Helpers Varios
function isVisible(n, f) {
    if (!f) return true;
    const query = f.trim().toLowerCase();

    // 1. Tag search: #tagname
    if (query.startsWith('#')) {
        const tagToSearch = query.substring(1);
        const tagMatch = Array.isArray(n.tags) && n.tags.some(t => t.toLowerCase().includes(tagToSearch));
        return n.children ? (tagMatch || n.children.some(c => isVisible(c, f))) : tagMatch;
    }

    // 2. Description search: d:keyword
    if (query.startsWith('d:')) {
        const descQuery = query.substring(2).trim();
        if (!descQuery) return true;
        const descMatch = (n.description || '').toLowerCase().includes(descQuery);
        return n.children ? (descMatch || n.children.some(c => isVisible(c, f))) : descMatch;
    }

    // 3. Folder search: f:keyword
    if (query.startsWith('f:')) {
        const folderQuery = query.substring(2).trim();
        if (!folderQuery) return true;
        if (n.type === 'folder') {
            const nameMatch = (n.name || '').toLowerCase().includes(folderQuery);
            // Show folder if name matches, or if children folders match
            return nameMatch || (n.children && n.children.some(c => isVisible(c, f)));
        }
        // Commands: show only if inside a matching parent (handled by parent rendering)
        return n.children ? n.children.some(c => isVisible(c, f)) : false;
    }

    // 4. Command-only search: c:keyword
    if (query.startsWith('c:')) {
        const cmdQuery = query.substring(2).trim();
        if (!cmdQuery) return true;
        const cmdMatch = (n.cmd || '').toLowerCase().includes(cmdQuery);
        return n.children ? (cmdMatch || n.children.some(c => isVisible(c, f))) : cmdMatch;
    }

    // 5. General search: name, command, description, and tags
    const nameMatch = (n.name || '').toLowerCase().includes(query);
    const cmdMatch = (n.cmd || '').toLowerCase().includes(query);
    const descMatch = (n.description || '').toLowerCase().includes(query);
    const tagMatch = Array.isArray(n.tags) && n.tags.some(t => t.toLowerCase().includes(query));

    const selfMatch = nameMatch || cmdMatch || descMatch || tagMatch;

    return n.children ? (selfMatch || n.children.some(c => isVisible(c, f))) : selfMatch;
}

function highlightSyntax(c) {
    // HTML escape first to prevent XSS
    let text = c
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Token-based: replace matches with safe Unicode placeholders, then restore
    // Using \uFDD0/\uFDD1 (Unicode noncharacters) — safe for innerHTML unlike \x00 which browsers strip
    const tokens = [];
    const S = '\uFDD0', E = '\uFDD1';
    const ph = (s, cls) => { const i = tokens.length; tokens.push(`<span class="${cls}">${s}</span>`); return S + i + E; };

    // 0. Protect HTML entities from being broken by subsequent regex
    text = text.replace(/&amp;|&lt;|&gt;/g, m => { const i = tokens.length; tokens.push(m); return S + i + E; });

    // 1. Strings (double and single quoted)
    text = text.replace(/"[^"]*"|'[^']*'/g, m => ph(m, 'sh-string'));
    // 2. Comments (# to end of line, only when preceded by whitespace or at line start)
    text = text.replace(/(^|\s)(#.*)/gm, (m, sp, comment) => sp + ph(comment, 'sh-comment'));
    // 3. Variables ($VAR, ${VAR})
    text = text.replace(/\$\{[^}]+\}|\$\w+/g, m => ph(m, 'sh-variable'));
    // 4. Keywords (shell builtins, common commands, devops tools)
    text = text.replace(/\b(if|then|else|elif|fi|for|do|done|while|case|esac|function|return|exit|echo|printf|export|source|alias|unalias|sudo|cd|ls|grep|egrep|awk|sed|cat|mkdir|rm|rmdir|cp|mv|chmod|chown|curl|wget|ssh|scp|rsync|docker|kubectl|az|aws|gcloud|apt|yum|dnf|pip|pip3|npm|npx|yarn|git|systemctl|journalctl|tar|zip|unzip|find|xargs|sort|uniq|wc|head|tail|tee|nohup|cron|crontab|set|unset|eval|exec|trap|wait|read|test|true|false|shift|local|declare|typeset|readonly|select|until|break|continue|bteq|mload|fastload|tpt|tdput|python|python3|node|java|go|make|cmake|gcc|npm|which|whereis|whoami|hostname|uname|df|du|ps|top|htop|kill|killall|ping|traceroute|netstat|ss|iptables|mount|umount|ln|touch|nano|vi|vim|less|more|env|printenv)\b/g, m => ph(m, 'sh-keyword'));
    // 5. Flags (-flag, --long-flag)
    text = text.replace(/(\s)(-[\w-]+)/g, (m, sp, flag) => sp + ph(flag, 'sh-flag'));
    // 6. Operators and pipes (|, ||, &&, ;) — HTML entities are already protected as tokens
    text = text.replace(/\|\||&&|\||;/g, m => ph(m, 'sh-operator'));

    // Restore tokens (recursive for nested tokens — e.g. HTML entities inside quoted strings)
    let maxIter = 10;
    while (maxIter-- > 0) {
        const restored = text.replace(new RegExp(S + '(\\d+)' + E, 'g'), (_, i) => tokens[i]);
        if (restored === text) break;
        text = restored;
    }
    return text;
}

function getAllPinnedItems(nodes) {
    let acc = [];
    nodes.forEach(n => {
        if (n.pinned) acc.push(n);
        if (n.children) acc = acc.concat(getAllPinnedItems(n.children));
    });
    return acc;
}

function renderFavorites() {
    const list = document.getElementById('qa-list');
    if (!list) return;

    // 1. Control de Visibilidad (La corrección del Bug)
    // Si está colapsado, ocultamos la lista. Si no, la mostramos en bloque.
    if (qaCollapsed) {
        list.style.display = 'none';
    } else {
        list.style.display = 'block';
    }

    // 2. Renderizado de Items
    list.innerHTML = '';
    const items = getAllPinnedItems(treeData);

    if (items.length > 0) {
        document.getElementById('quick-access-container').classList.remove('hidden');
        items.forEach((n, i) => {
            const el = createNodeElement(n, '', true);
            // Add discrete numeric index badge
            const row = el.querySelector('.tree-item');
            if (row) {
                const idx = document.createElement('span');
                idx.className = 'fav-index';
                idx.textContent = i + 1;
                row.insertBefore(idx, row.firstChild);
            }
            list.appendChild(el);
        });
    } else {
        document.getElementById('quick-access-container').classList.add('hidden');
    }
}

function renderHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;
    list.innerHTML = '';

    if (historyCollapsed) {
        list.style.display = 'none';
    } else {
        list.style.display = 'block';
    }

    if (!historyCollapsed && Array.isArray(commandHistory)) {
        commandHistory.slice(0, 10).forEach((item) => {
            const cmd = typeof item === 'string' ? item : item.cmd;
            const name = typeof item === 'string' ? 'Command' : item.name;

            const row = document.createElement('div');
            row.className = 'history-item copy-flash';

            const titleSpan = document.createElement('span');
            titleSpan.className = 'history-item-name';
            titleSpan.textContent = name;

            const cmdSpan = document.createElement('span');
            cmdSpan.className = 'history-item-cmd';
            cmdSpan.textContent = `🕒 ${cmd.length > 40 ? cmd.substring(0, 37) + '...' : cmd}`;

            row.appendChild(titleSpan);
            row.appendChild(cmdSpan);
            row.onclick = () => copyToClipboard(cmd, name, row);
            list.appendChild(row);
        });
    }
}

function updateSettingsUI() {
    // 1. Actualizar Input
    const tInput = document.getElementById('gh-token-input');
    if (tInput) tInput.value = ghToken || "";

    // 2. Controlar estado de los botones (Habilitar/Deshabilitar)
    const btnUp = document.getElementById('btn-sync-upload');
    const btnDown = document.getElementById('btn-sync-download');

    if (ghToken) {
        if (btnUp) { btnUp.disabled = false; btnUp.style.opacity = "1"; btnUp.style.cursor = "pointer"; }
        if (btnDown) { btnDown.disabled = false; btnDown.style.opacity = "1"; btnDown.style.cursor = "pointer"; }
    } else {
        if (btnUp) { btnUp.disabled = true; btnUp.style.opacity = "0.5"; btnUp.style.cursor = "not-allowed"; }
        if (btnDown) { btnDown.disabled = true; btnDown.style.opacity = "0.5"; btnDown.style.cursor = "not-allowed"; }
    }
}
// En new_sidepanel.js (Reemplazar la función placeholder autoSyncToCloud y agregar el resto)

// --- GITHUB SYNC ENGINE (MIGRADO DE V1) ---

function updateSyncIcon(state) {
    const icon = document.getElementById('sync-indicator');
    if (!icon) return; // Protección por si el elemento no existe en el HTML V2
    if (state === 'working') {
        icon.classList.add('sync-working');
        icon.classList.remove('sync-success');
    } else if (state === 'success') {
        icon.classList.remove('sync-working');
        icon.classList.add('sync-success');
        setTimeout(() => icon.classList.remove('sync-success'), 3000);
    }
}

async function uploadToGist(isRetry = false) {
    if (!ghToken) return showToast("❌ Save GitHub Token first");

    if (!isRetry) showToast("☁️ Syncing with GitHub...");

    // Build versioned filename with timestamp (e.g. backup_2026-02-23_15-30.json)
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}`;
    const versionedName = `backup_${ts}.json`;
    const content = JSON.stringify(treeData, null, 2);

    // Files object: current backup + new versioned snapshot
    const files = {
        [GIST_FILENAME]: { content },
        [versionedName]: { content }
    };

    let gistId = localStorage.getItem('gistId');
    let url = 'https://api.github.com/gists';
    let method = 'POST';

    if (gistId) {
        url = `https://api.github.com/gists/${gistId}`;
        method = 'PATCH';
    }

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${ghToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                description: "CmdVault Backup (Versioned)",
                public: false,
                files
            })
        });

        if (response.status === 403 || response.status === 429) {
            throw new Error(`⏳ GitHub Rate Limit. Try later.`);
        }

        if (response.status === 404 && gistId) {
            if (isRetry) throw new Error("Check token permissions.");
            console.warn("⚠️ Gist missing. Creating new...");
            localStorage.removeItem('gistId');
            return await uploadToGist(true);
        }

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || `Error ${response.status}`);
        }

        const data = await response.json();
        if (data.id) localStorage.setItem('gistId', data.id);

        // Prune old versioned backups — keep only the last N
        await pruneOldBackups(data);

        showToast("✅ Backup uploaded");
        updateSyncIcon('success');

    } catch (e) {
        console.error("Gist Error:", e);
        showToast(e.message.includes("Rate Limit") ? e.message : `❌ Error: ${e.message}`);
    }
}

/**
 * Removes old versioned backups from the Gist, keeping only the latest N.
 * Versioned files match pattern: backup_YYYY-MM-DD_HH-MM.json
 * @param {object} gistData - The Gist response object with files.
 */
async function pruneOldBackups(gistData) {
    const fileNames = Object.keys(gistData.files || {});
    const versionedFiles = fileNames
        .filter(f => /^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.json$/.test(f))
        .sort(); // Alphabetical = chronological for this format

    if (versionedFiles.length <= BACKUP_MAX_VERSIONS) return; // Nothing to prune

    // Files to delete (oldest first)
    const toDelete = versionedFiles.slice(0, versionedFiles.length - BACKUP_MAX_VERSIONS);
    const deleteFiles = {};
    toDelete.forEach(f => { deleteFiles[f] = null; }); // null = delete in GitHub API

    try {
        await fetch(`https://api.github.com/gists/${gistData.id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${ghToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ files: deleteFiles })
        });
        console.log(`🗑️ Pruned ${toDelete.length} old backup(s):`, toDelete);
    } catch (e) {
        console.warn('Prune failed (non-critical):', e.message);
    }
}

async function downloadFromGist() {
    cancelInlineEdit();
    if (!ghToken) return showToast("❌ Save GitHub Token first");
    showToast("📥 Fetching backups...");

    try {
        const responseGists = await fetch('https://api.github.com/gists', {
            headers: { 'Authorization': `token ${ghToken}` }
        });
        const gists = await responseGists.json();
        const remoteGist = gists.find(g => g.files && g.files[GIST_FILENAME]);

        if (!remoteGist) return showToast("❓ No backup found");

        // Save Gist ID for future syncs
        localStorage.setItem('gistId', remoteGist.id);

        // Collect all available versions
        const fileNames = Object.keys(remoteGist.files);
        const versionedFiles = fileNames
            .filter(f => /^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.json$/.test(f))
            .sort()
            .reverse(); // Newest first

        // Build version list: current + versioned snapshots
        const versions = [];

        // Always add the main/current backup first
        if (remoteGist.files[GIST_FILENAME]) {
            versions.push({
                label: '📌 Latest (current)',
                filename: GIST_FILENAME,
                raw_url: remoteGist.files[GIST_FILENAME].raw_url
            });
        }

        // Add versioned snapshots
        versionedFiles.forEach(f => {
            // Parse timestamp from filename: backup_2026-02-23_15-30.json
            const match = f.match(/backup_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})\.json/);
            if (match) {
                const [, y, mo, d, h, mi] = match;
                const dateStr = `${y}-${mo}-${d} ${h}:${mi}`;
                versions.push({
                    label: `🕒 ${dateStr}`,
                    filename: f,
                    raw_url: remoteGist.files[f].raw_url
                });
            }
        });

        // If only 1 version, restore directly without picker
        if (versions.length <= 1) {
            await restoreFromGistFile(versions[0].raw_url, versions[0].label);
            return;
        }

        // Show version picker modal
        showVersionPicker(versions);

    } catch (e) {
        console.error(e);
        showToast("❌ Download error");
    }
}

/**
 * Restores treeData from a specific Gist file URL.
 * @param {string} rawUrl - The raw URL of the Gist file.
 * @param {string} label - Label for the toast message.
 */
async function restoreFromGistFile(rawUrl, label) {
    try {
        showToast("📥 Restoring...");
        const rawData = await fetch(rawUrl);
        const data = await rawData.json();

        if (data) {
            treeData = data;
            chrome.storage.local.set({ linuxTree: treeData }, () => {
                refreshAll();
            });
            showToast(`✅ Restored: ${label}`);
        }
    } catch (e) {
        console.error(e);
        showToast("❌ Restore error");
    }
}

/**
 * Shows a modal with available backup versions to choose from.
 * @param {Array} versions - Array of { label, filename, raw_url }.
 */
function showVersionPicker(versions) {
    // Remove existing picker if any
    const existing = document.getElementById('version-picker-overlay');
    if (existing) existing.remove();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'version-picker-overlay';
    overlay.className = 'version-picker-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Select Backup Version');

    // Create modal box
    const box = document.createElement('div');
    box.className = 'version-picker-box';

    // Header
    const header = document.createElement('div');
    header.className = 'version-picker-header';
    header.innerHTML = '<h3 style="margin:0; color:var(--md-sys-color-primary);">📦 Select Backup Version</h3><p style="margin:4px 0 0 0; font-size:12px; opacity:0.7;">Choose which version to restore</p>';
    box.appendChild(header);

    // Version list
    const list = document.createElement('div');
    list.className = 'version-picker-list';

    versions.forEach((v, i) => {
        const item = document.createElement('button');
        item.className = 'version-picker-item';
        if (i === 0) item.classList.add('latest');
        item.textContent = v.label;
        item.onclick = async () => {
            overlay.remove();
            await restoreFromGistFile(v.raw_url, v.label);
        };
        list.appendChild(item);
    });

    box.appendChild(list);

    // Cancel button
    const actions = document.createElement('div');
    actions.className = 'version-picker-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-secondary-modal';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => overlay.remove();
    actions.appendChild(cancelBtn);
    box.appendChild(actions);

    overlay.appendChild(box);

    // Close on overlay click
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    document.body.appendChild(overlay);
}

async function autoSyncToCloud() {
    if (!ghToken) return;
    updateSyncIcon('working');
    try {
        // Lógica simplificada para auto-guardado: solo actualiza si ya existe un ID conocido
        // para evitar crear Gists infinitos accidentalmente.
        let gistId = localStorage.getItem('gistId');
        if (!gistId) return;

        const body = {
            files: { [GIST_FILENAME]: { content: JSON.stringify(treeData, null, 2) } }
        };

        const finalResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: { 'Authorization': `token ${ghToken}` },
            body: JSON.stringify(body)
        });

        if (finalResponse.ok) {
            updateSyncIcon('success');
        }
    } catch (e) {
        console.error("Auto-sync failed", e);
    }
}

/* =================================================================================
   SISTEMA DE COPIADO INTELIGENTE (ARQUITECTURA GLOBAL)
   ================================================================================= */

// Estado Global
let globalPendingCommand = "";

// 1. INICIALIZACIÓN (Se ejecuta al cargar la extensión)
document.addEventListener('DOMContentLoaded', () => {
    console.log("Inicializando Eventos del Modal...");

    const btnConfirm = document.getElementById('btn-confirm-dynamic');
    const btnCancel = document.getElementById('btn-cancel-dynamic');

    if (btnConfirm) {
        // Asignamos el evento CLICK una sola vez, para siempre.
        btnConfirm.addEventListener('click', executeSmartCopy);
        console.log("✅ Botón Copy conectado correctamente.");
    } else {
        console.error("❌ ERROR CRÍTICO: No se encontró el botón 'btn-confirm-dynamic' en el HTML.");
    }

    if (btnCancel) {
        btnCancel.addEventListener('click', closeDynamicModal);
    }
});

/**
 * 2. FUNCIÓN DE ENTRADA (Llama a esto desde tus botones de comando)
 */
/**
 * Versión Consolidada V4.0: Feedback Visual + Historial Compatible V1.
 */
function copyToClipboard(text, name = "Command", element = null) {
    if (!text) return;

    // 1. FEEDBACK VISUAL — Green Flash + SVG Animated Checkmark
    if (element) {
        try {
            // Flash verde en el comando
            element.classList.add('active');
            setTimeout(() => element.classList.remove('active'), 200);

            // SVG Animated Checkmark en el botón
            const btn = element.querySelector('.cmd-ctrl-btn');
            if (btn && !btn.querySelector('.copy-check-svg')) {
                const oldHTML = btn.innerHTML;
                btn.innerHTML = `<svg class="copy-check-svg" viewBox="0 0 24 24" width="18" height="18">
                    <circle class="copy-check-circle" cx="12" cy="12" r="10"
                        fill="none" stroke="var(--md-sys-color-primary)" stroke-width="2"/>
                    <polyline class="copy-check-mark" points="7 12 10.5 15.5 17 9"
                        fill="none" stroke="#22c55e" stroke-width="2.5"
                        stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`;

                setTimeout(() => {
                    btn.innerHTML = oldHTML;
                }, 1200);
            }
        } catch (e) { /* Error visual silencioso */ }
    }

    // 2. LÓGICA DE HISTORIAL (Límite subido a 10)
    if (typeof commandHistory !== 'undefined') {
        commandHistory = commandHistory.filter(item => {
            const cmdText = typeof item === 'string' ? item : item.cmd;
            return cmdText !== text;
        });

        commandHistory.unshift({ cmd: text, name: name });

        if (commandHistory.length > 10) {
            commandHistory.pop();
        }

        chrome.storage.local.set({ linuxHistory: commandHistory }, () => {
            if (typeof renderHistory === 'function') {
                renderHistory();
            }
        });
    }

    // 3. COPIADO REAL AL PORTAPAPELES
    const hasVariables = /{{(.*?)}}/.test(text);
    if (hasVariables && typeof openSmartModal === 'function') {
        openSmartModal(text);
    } else {
        navigator.clipboard.writeText(text);
    }
}

/**
 * 3. ABRIR MODAL (Actualizado con Vista Previa)
 */
function openSmartModal(text) {
    globalPendingCommand = text;

    const modal = document.getElementById('dynamic-modal');
    const container = document.getElementById('dynamic-form-container');
    const previewBox = document.getElementById('command-preview'); // <--- NUEVO REFERENCIA

    // 1. Mostrar el comando original como referencia
    if (previewBox) {
        previewBox.textContent = text;
        // Opcional: Si quieres resaltar las variables, podrías usar innerHTML con un replace, 
        // pero textContent es más seguro y limpio por ahora.
    }

    // 2. Extraer variables únicas
    const matches = [...text.matchAll(/{{(.*?)}}/g)];
    const detectedVars = [...new Set(matches.map(m => m[1]))];

    // 3. Limpiar y generar inputs
    container.innerHTML = '';
    detectedVars.forEach(varName => {
        const div = document.createElement('div');
        div.style.marginBottom = "10px";

        // Etiqueta más limpia
        div.innerHTML = `
            <label style="display:block; font-size:11px; font-weight:bold; margin-bottom:4px; color:#666;">${varName.toUpperCase()}</label>
            <input type="text" class="dynamic-input-field" 
                   data-varname="${varName}" 
                   placeholder="Value for ${varName}..." 
                   style="width:100%; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;">
        `;
        container.appendChild(div);
    });

    // 4. Mostrar
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    // Focus
    setTimeout(() => {
        const first = container.querySelector('input');
        if (first) first.focus();
    }, 100);
}

/**
 * 4. EJECUTAR COPIA (Se dispara al hacer clic en el botón Copy)
 */
function executeSmartCopy() {
    // DEBUG: Si ves esta alerta, el botón funciona y el problema es la lógica de reemplazo.
    console.log("🖱️ Click detectado en botón Copy");

    let finalCmd = globalPendingCommand;
    const inputs = document.querySelectorAll('.dynamic-input-field');

    // Reemplazar valores
    inputs.forEach(input => {
        const varName = input.getAttribute('data-varname');
        const val = input.value;
        // Reemplazo Global
        finalCmd = finalCmd.split(`{{${varName}}}`).join(val);
    });

    console.log("Comando Final:", finalCmd);

    // Ejecutar copia
    copyToClipboardReal(finalCmd);

    // Cerrar
    closeDynamicModal();
}

/**
 * 5. CERRAR MODAL
 */
function closeDynamicModal() {
    const modal = document.getElementById('dynamic-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
    globalPendingCommand = "";
}

/**
 * 6. FUNCIÓN DE COPIADO FÍSICO (No tocar si ya funciona)
 */
async function copyToClipboardReal(text) {
    try {
        await navigator.clipboard.writeText(text);
        if (typeof showToast === 'function') showToast("📋 Copied!");

        // Historial (Simplificado para evitar errores)
        if (typeof commandHistory !== 'undefined') {
            // Tu lógica de historial aquí si la necesitas...
        }
    } catch (err) {
        alert("Error al copiar: " + err);
    }
}

// ==========================================================================
// HELP PAGE SYSTEM (Man Page / Documentation per Command)
// ==========================================================================

function openHelpPage(nodeId) {
    const node = findNode(treeData, nodeId);
    if (!node || node.type !== 'command') return;

    // Initialize fields if they don't exist
    if (typeof node.helpContent === 'undefined') node.helpContent = '';
    if (typeof node.helpLang === 'undefined') node.helpLang = 'shell';

    helpPageState = { nodeId, isEditing: false };

    const overlay = document.getElementById('help-page-overlay');
    const title = document.getElementById('help-page-title');
    const langSel = document.getElementById('help-lang-selector');
    const editArea = document.getElementById('help-content-edit');
    const viewArea = document.getElementById('help-content-view');
    const btnSave = document.getElementById('help-btn-save');
    const btnEdit = document.getElementById('help-btn-edit');

    title.textContent = `Help Page — ${node.name}`;
    langSel.value = node.helpLang;

    // Start in view mode
    editArea.classList.add('hidden');
    viewArea.classList.remove('hidden');
    btnSave.classList.add('hidden');
    btnEdit.textContent = '✏️ Edit';

    renderHelpView();
    overlay.classList.remove('hidden');
}

function closeHelpPage() {
    const overlay = document.getElementById('help-page-overlay');
    overlay.classList.add('hidden');
    helpPageState = null;
}

function toggleHelpEdit() {
    if (!helpPageState) return;
    const node = findNode(treeData, helpPageState.nodeId);
    if (!node) return;

    const editArea = document.getElementById('help-content-edit');
    const viewArea = document.getElementById('help-content-view');
    const btnSave = document.getElementById('help-btn-save');
    const btnEdit = document.getElementById('help-btn-edit');

    if (!helpPageState.isEditing) {
        // Switch to edit mode
        helpPageState.isEditing = true;
        editArea.value = node.helpContent || '';
        editArea.classList.remove('hidden');
        viewArea.classList.add('hidden');
        btnSave.classList.remove('hidden');
        btnEdit.textContent = '👁 View';
        updateHelpLineNumbers(editArea.value);
        editArea.focus();
        updateHelpPositionIndicator();
    } else {
        // Switch to view mode
        helpPageState.isEditing = false;
        editArea.classList.add('hidden');
        viewArea.classList.remove('hidden');
        btnSave.classList.add('hidden');
        btnEdit.textContent = '✏️ Edit';
        renderHelpView();
    }
}

function saveHelpPage() {
    if (!helpPageState) return;
    const node = findNode(treeData, helpPageState.nodeId);
    if (!node) return;

    const editArea = document.getElementById('help-content-edit');
    const langSel = document.getElementById('help-lang-selector');

    node.helpContent = editArea.value;
    node.helpLang = langSel.value;
    saveData();

    showToast('💾 Help page saved');

    // Switch to view mode after saving
    helpPageState.isEditing = false;
    editArea.classList.add('hidden');
    document.getElementById('help-content-view').classList.remove('hidden');
    document.getElementById('help-btn-save').classList.add('hidden');
    document.getElementById('help-btn-edit').textContent = '✏️ Edit';
    renderHelpView();
}

function renderHelpView() {
    if (!helpPageState) return;
    const node = findNode(treeData, helpPageState.nodeId);
    if (!node) return;

    const viewArea = document.getElementById('help-content-view');
    const content = node.helpContent || '';
    const lang = node.helpLang || 'shell';

    if (!content.trim()) {
        viewArea.innerHTML = '<span style="opacity:0.4; font-style:italic;">No help page content. Click "Edit" to add documentation.</span>';
    } else {
        viewArea.innerHTML = highlightHelpContent(content, lang);
    }

    updateHelpLineNumbers(content);
    updateHelpPositionIndicator();
}

function updateHelpLineNumbers(text) {
    const lineNumEl = document.getElementById('help-line-numbers');
    if (!lineNumEl) return;

    const lines = (text || '').split('\n');
    const count = Math.max(lines.length, 1);
    let html = '';
    for (let i = 1; i <= count; i++) {
        html += `<div>${i}</div>`;
    }
    lineNumEl.innerHTML = html;
}

function updateHelpPositionIndicator() {
    const indicator = document.getElementById('help-position-indicator');
    if (!indicator) return;

    if (helpPageState && helpPageState.isEditing) {
        const editArea = document.getElementById('help-content-edit');
        if (editArea) {
            const pos = editArea.selectionStart || 0;
            const textBefore = editArea.value.substring(0, pos);
            const line = textBefore.split('\n').length;
            const col = pos - textBefore.lastIndexOf('\n');
            indicator.textContent = `Ln ${line} / Col ${col}`;
        }
    } else {
        const node = helpPageState ? findNode(treeData, helpPageState.nodeId) : null;
        const content = node ? (node.helpContent || '') : '';
        const totalLines = content ? content.split('\n').length : 0;
        indicator.textContent = totalLines > 0 ? `${totalLines} lines` : 'Empty';
    }
}

function toggleHelpWordWrap() {
    const editorArea = document.querySelector('.help-page-editor-area');
    const btn = document.getElementById('help-wrap-toggle');
    if (!editorArea) return;

    editorArea.classList.toggle('word-wrap');
    const isWrapped = editorArea.classList.contains('word-wrap');
    btn.classList.toggle('active', isWrapped);
}

// --- SYNTAX HIGHLIGHTING PER LANGUAGE ---

function highlightHelpContent(text, lang) {
    // Escape HTML first
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    switch (lang) {
        case 'shell': return highlightShell(escaped);
        case 'python': return highlightPython(escaped);
        case 'sql': return highlightSQL(escaped);
        case 'markdown': return highlightMarkdown(escaped);
        default: return escaped;
    }
}

function highlightShell(text) {
    // Token-based approach: replace with placeholders, then restore
    const tokens = [];
    const ph = (s, cls) => { const i = tokens.length; tokens.push(`<span class="${cls}">${s}</span>`); return `\x00${i}\x00`; };

    // 1. Strings
    let result = text.replace(/"[^"]*"|'[^']*'/g, m => ph(m, 'hp-string'));
    // 2. Comments
    result = result.replace(/#.*/g, m => ph(m, 'hp-comment'));
    // 3. Variables
    result = result.replace(/\$\{[^}]+\}|\$\w+/g, m => ph(m, 'hp-variable'));
    // 4. Keywords
    result = result.replace(/\b(if|then|else|fi|for|do|done|while|case|esac|function|return|exit|echo|export|source|alias|sudo|cd|ls|grep|awk|sed|cat|mkdir|rm|cp|mv|chmod|chown|curl|wget|ssh|docker|kubectl|az|aws|gcloud|apt|yum|pip|npm|git|systemctl|journalctl|tar|zip|unzip|find|xargs|sort|uniq|wc|head|tail|tee|nohup|cron|crontab)\b/g, m => ph(m, 'hp-keyword'));
    // 5. Flags
    result = result.replace(/(\s)(-[\w-]+)/g, (m, sp, flag) => sp + ph(flag, 'hp-flag'));
    // 6. Pipes/redirects
    result = result.replace(/[|&]{1,2}|[><]+|;/g, m => ph(m, 'hp-operator'));

    // Restore tokens
    result = result.replace(/\x00(\d+)\x00/g, (_, i) => tokens[i]);
    return result;
}

function highlightPython(text) {
    const tokens = [];
    const ph = (s, cls) => { const i = tokens.length; tokens.push(`<span class="${cls}">${s}</span>`); return `\x00${i}\x00`; };

    // 1. Triple-quoted strings
    let result = text.replace(/"""[\s\S]*?"""|'''[\s\S]*?'''/g, m => ph(m, 'hp-string'));
    // 2. Regular strings
    result = result.replace(/"[^"]*"|'[^']*'/g, m => ph(m, 'hp-string'));
    // 3. Comments
    result = result.replace(/#.*/g, m => ph(m, 'hp-comment'));
    // 4. Decorators
    result = result.replace(/@\w+/g, m => ph(m, 'hp-decorator'));
    // 5. Keywords
    result = result.replace(/\b(def|class|if|elif|else|for|while|try|except|finally|with|as|import|from|return|yield|lambda|and|or|not|in|is|True|False|None|print|range|len|self|pass|break|continue|raise|global|nonlocal|del|assert)\b/g, m => ph(m, 'hp-keyword'));
    // 6. Numbers
    result = result.replace(/\b\d+\.?\d*\b/g, m => ph(m, 'hp-number'));

    result = result.replace(/\x00(\d+)\x00/g, (_, i) => tokens[i]);
    return result;
}

function highlightSQL(text) {
    const tokens = [];
    const ph = (s, cls) => { const i = tokens.length; tokens.push(`<span class="${cls}">${s}</span>`); return `\x00${i}\x00`; };

    // 1. Strings
    let result = text.replace(/'[^']*'/g, m => ph(m, 'hp-string'));
    // 2. Block comments
    result = result.replace(/\/\*[\s\S]*?\*\//g, m => ph(m, 'hp-comment'));
    // 3. Line comments
    result = result.replace(/--.*$/gm, m => ph(m, 'hp-comment'));
    // 4. Keywords (case-insensitive)
    result = result.replace(/\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|DATABASE|SCHEMA|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|FULL|ON|AND|OR|NOT|IN|IS|NULL|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|ALL|SET|VALUES|INTO|DISTINCT|COUNT|SUM|AVG|MAX|MIN|BETWEEN|LIKE|EXISTS|CASE|WHEN|THEN|ELSE|END|BEGIN|COMMIT|ROLLBACK|GRANT|REVOKE|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|DEFAULT|CHECK|UNIQUE|TRUNCATE|EXEC|EXECUTE|DECLARE|FETCH|CURSOR|OPEN|CLOSE|IF|WHILE|RETURN|TOP|ASC|DESC|WITH|RECURSIVE|OVER|PARTITION|ROW_NUMBER|RANK|DENSE_RANK|LEAD|LAG|COALESCE|CAST|CONVERT|DATEADD|DATEDIFF|GETDATE|NOW|CURRENT_TIMESTAMP)\b/gi, m => ph(m, 'hp-keyword'));
    // 5. Numbers
    result = result.replace(/\b\d+\.?\d*\b/g, m => ph(m, 'hp-number'));

    result = result.replace(/\x00(\d+)\x00/g, (_, i) => tokens[i]);
    return result;
}

function highlightMarkdown(text) {
    const tokens = [];
    const ph = (s, cls) => { const i = tokens.length; tokens.push(`<span class="${cls}">${s}</span>`); return `\x00${i}\x00`; };

    // 1. Code blocks (fenced)
    let result = text.replace(/```[\s\S]*?```/g, m => ph(m, 'hp-codeblock'));
    // 2. Inline code
    result = result.replace(/`[^`]+`/g, m => ph(m, 'hp-code'));
    // 3. Headers
    result = result.replace(/^#{1,6}\s.*/gm, m => ph(m, 'hp-heading'));
    // 4. Bold
    result = result.replace(/\*\*[^*]+\*\*/g, m => ph(m, 'hp-bold'));
    // 5. Italic
    result = result.replace(/\*[^*]+\*/g, m => ph(m, 'hp-italic'));
    // 6. Links
    result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, m => ph(m, 'hp-link'));
    // 7. List markers
    result = result.replace(/^(\s*[-*+]\s)/gm, m => ph(m, 'hp-list'));

    result = result.replace(/\x00(\d+)\x00/g, (_, i) => tokens[i]);
    return result;
}

// --- HELP PAGE EVENT SETUP ---

function setupHelpPageEvents() {
    const btnEdit = document.getElementById('help-btn-edit');
    const btnSave = document.getElementById('help-btn-save');
    const btnClose = document.getElementById('help-btn-close');
    const langSel = document.getElementById('help-lang-selector');
    const wrapBtn = document.getElementById('help-wrap-toggle');
    const editArea = document.getElementById('help-content-edit');
    const viewArea = document.getElementById('help-content-view');
    const lineNums = document.getElementById('help-line-numbers');
    const overlay = document.getElementById('help-page-overlay');

    if (btnEdit) btnEdit.onclick = () => toggleHelpEdit();
    if (btnSave) btnSave.onclick = () => saveHelpPage();
    if (btnClose) btnClose.onclick = () => closeHelpPage();
    if (wrapBtn) wrapBtn.onclick = () => toggleHelpWordWrap();

    // Zoom In / Out — adjusts font size of editor and view areas
    let helpFontSize = 13; // Default font size in px
    const MIN_FONT = 9;
    const MAX_FONT = 24;
    const ZOOM_STEP = 2;

    const applyHelpZoom = () => {
        if (viewArea) viewArea.style.fontSize = `${helpFontSize}px`;
        if (editArea) editArea.style.fontSize = `${helpFontSize}px`;
        if (lineNums) lineNums.style.fontSize = `${helpFontSize}px`;
    };

    const btnZoomIn = document.getElementById('help-zoom-in');
    const btnZoomOut = document.getElementById('help-zoom-out');

    if (btnZoomIn) btnZoomIn.onclick = () => {
        if (helpFontSize < MAX_FONT) { helpFontSize += ZOOM_STEP; applyHelpZoom(); }
    };
    if (btnZoomOut) btnZoomOut.onclick = () => {
        if (helpFontSize > MIN_FONT) { helpFontSize -= ZOOM_STEP; applyHelpZoom(); }
    };

    // Copy All — copies the full help page content to clipboard
    const btnCopyAll = document.getElementById('help-copy-all');
    if (btnCopyAll) btnCopyAll.onclick = () => {
        if (!helpPageState) return;
        const node = findNode(treeData, helpPageState.nodeId);
        const content = node && node.helpContent ? node.helpContent : '';
        if (!content) { showToast('📋 No content to copy'); return; }
        navigator.clipboard.writeText(content).then(() => {
            showToast('📋 Help page copied to clipboard');
            btnCopyAll.textContent = '✅ Copied';
            setTimeout(() => { btnCopyAll.textContent = '📋 Copy'; }, 1500);
        });
    };

    if (langSel) langSel.onchange = () => {
        if (!helpPageState) return;
        const node = findNode(treeData, helpPageState.nodeId);
        if (node) {
            node.helpLang = langSel.value;
            if (!helpPageState.isEditing) renderHelpView();
        }
    };

    // Scroll sync: editor ↔ line numbers
    if (editArea) {
        editArea.onscroll = () => {
            if (lineNums) lineNums.scrollTop = editArea.scrollTop;
        };
        editArea.oninput = () => {
            updateHelpLineNumbers(editArea.value);
            updateHelpPositionIndicator();
        };
        editArea.onkeyup = () => updateHelpPositionIndicator();
        editArea.onclick = () => updateHelpPositionIndicator();
        // Support Tab key in textarea
        editArea.onkeydown = (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = editArea.selectionStart;
                const end = editArea.selectionEnd;
                editArea.value = editArea.value.substring(0, start) + '    ' + editArea.value.substring(end);
                editArea.selectionStart = editArea.selectionEnd = start + 4;
                updateHelpLineNumbers(editArea.value);
            }
        };
    }

    // Scroll sync: view ↔ line numbers
    if (viewArea) {
        viewArea.onscroll = () => {
            if (lineNums) lineNums.scrollTop = viewArea.scrollTop;
        };
    }

    // Escape to close
    if (overlay) {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && helpPageState) {
                closeHelpPage();
            }
        });
    }
}

