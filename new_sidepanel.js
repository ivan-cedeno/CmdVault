const FOLDER_COLORS = ['#F37423', '#7DCFFF', '#8CD493', '#E4A8F2', '#FF5252', '#7C4DFF', '#CFD8DC', '#424242'];

const GIST_FILENAME = 'ivan_helper_backup.json';

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

// --- ESTADO GLOBAL ---
let treeData = [];
let commandHistory = [];
let qaCollapsed = false;
let historyCollapsed = false;
let commandsCollapsed = false;
let contextTargetId = null;
let draggedId = null;
let appClipboard = null;
let ghToken = "";
let currentTheme = "theme-dark";
let toastTimeout = null;
let isDataLoaded = false;
let inlineEditState = null; // { id, mode: 'edit'|'add', type, parentId, originalNode, formElement }
let helpPageState = null; // { nodeId, isEditing }

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
        commandsCollapsed = false;

        ghToken = items.ghToken || "";

        if (items.savedTheme) changeTheme(items.savedTheme);

        const tokenInput = document.getElementById('gh-token-input');
        if (tokenInput) tokenInput.value = ghToken;

        const userInput = document.getElementById('username-input');
        if (userInput) userInput.value = items.username || 'user';

        const title = document.querySelector('.app-title');
        if (title) title.textContent = `${items.username || 'user'}@CmdVault:~$`;

        isDataLoaded = true;
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
}

function updateHeaderIcons() {
    const setArrow = (id, state) => {
        const el = document.getElementById(id);
        if (el) el.textContent = state ? '►' : '▼';
    };
    setArrow('cmd-arrow', commandsCollapsed);
    setArrow('hist-arrow', historyCollapsed);
    setArrow('qa-arrow', qaCollapsed);
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

    treeData.forEach(node => {
        if (node && isVisible(node, filter)) {
            const el = createNodeElement(node, filter);
            container.appendChild(el);
        }
    });
}

// PUNTO 1: Añadimos 'inheritedColor' como cuarto parámetro (neutro por defecto)
function createNodeElement(node, filter, isFav = false, inheritedColor = null) {
    const row = document.createElement('div');
    row.className = `tree-item type-${node.type}`;
    row.dataset.nodeId = node.id;

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

    if (activeColor && node.type === 'folder') {
        header.style.color = activeColor;
    }
    
    if (node.description) header.title = node.description;

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
        }
    }

    const nameSpan = document.createElement('span');
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

    if (Array.isArray(node.tags) && node.tags.length > 0) {
        const tagsDiv = document.createElement('div');
        tagsDiv.style.marginLeft = 'auto';
        tagsDiv.style.display = 'flex';
        tagsDiv.style.gap = '4px';
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

            tagsDiv.appendChild(badge);
        });
        header.appendChild(tagsDiv);
    }

    header.onclick = () => {
        if (inlineEditState && String(inlineEditState.id) === String(node.id)) return;
        if (node.type === 'folder' && !isFav) {
            node.collapsed = !node.collapsed;
            saveData();
            const content = wrapper.querySelector('.folder-content');
            if (content) {
                content.classList.toggle('collapsed', node.collapsed);
                iconSpan.innerHTML = node.collapsed ? iconClosed : iconOpen;
                if (chevronSpan) chevronSpan.classList.toggle('expanded', !node.collapsed);
            }
        }
    };

    header.oncontextmenu = (e) => {
        e.preventDefault();
        if (inlineEditState && String(inlineEditState.id) === String(node.id)) return;
        contextTargetId = node.id;
        openContextMenu(e, node);
    };

    row.appendChild(header);

    if (node.type === 'command') {
        const wrap = document.createElement('div');
        wrap.className = 'cmd-wrapper copy-flash';
        const pre = document.createElement('pre');
        pre.className = node.expanded ? 'cmd-preview expanded' : 'cmd-preview';
        pre.innerHTML = highlightSyntax(String(node.cmd || ""));
        pre.onclick = () => copyToClipboard(node.cmd, node.name, wrap);

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
        btn.innerHTML = node.expanded
            ? `<svg class="folder-icon-v3" style="width:14px; height:14px; pointer-events:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`
            : `<svg class="folder-icon-v3" style="width:14px; height:14px; pointer-events:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

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

        if (node.collapsed && !filter) {
            inner.classList.add('collapsed');
        }

        inner.style.borderLeft = "1px solid var(--md-sys-color-outline-variant, rgba(255,255,255,0.1))";
        inner.style.marginLeft = "12px";
        inner.style.paddingLeft = "8px";

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

// --- SETUP EVENTOS ---
function setupAppEvents() {
    bindClick('qa-header', () => { qaCollapsed = !qaCollapsed; saveGlobalState(); refreshAll(); });
    bindClick('history-header', () => { historyCollapsed = !historyCollapsed; saveGlobalState(); refreshAll(); });
    bindClick('commands-header', () => {
        commandsCollapsed = !commandsCollapsed;
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

    bindClick('btn-clear-clipboard', () => {
        navigator.clipboard.writeText('');
        appClipboard = null;
        refreshAll();
        showToast("🧹 Clipboard Cleared");
    });

    const sOverlay = document.getElementById('settings-overlay');
    bindClick('btn-settings', () => { if (sOverlay) sOverlay.classList.remove('hidden'); });
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



    const search = document.getElementById('search-input');
    if (search) search.oninput = (e) => refreshAll();

    const themeSel = document.getElementById('theme-selector');
    if (themeSel) themeSel.onchange = (e) => {
        changeTheme(e.target.value);
        chrome.storage.local.set({ savedTheme: e.target.value });
    };

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu')) {
            const cm = document.getElementById('context-menu');
            if (cm) cm.classList.add('hidden');
        }
    });

    const ctxMenu = document.getElementById('context-menu');
    if (ctxMenu) {
        ctxMenu.onclick = (e) => {
            e.stopPropagation();
            const target = e.target.closest('.ctx-item, .icon-option');
            if (!target) return;

            const id = target.id;
            const close = () => ctxMenu.classList.add('hidden');

            if (id === 'ctx-copy') { execCopy(); close(); }
            else if (id === 'ctx-cut') { execCut(); close(); }
            else if (id === 'ctx-paste') { execPaste(); close(); }
            // NEW ACTIONS
            else if (id === 'ctx-expand-all') { toggleFolderRecursively(contextTargetId, false); close(); }
            else if (id === 'ctx-collapse-all') { toggleFolderRecursively(contextTargetId, true); close(); }

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
            else if (id === 'ctx-delete') { if (confirm("Delete?")) execDelete(contextTargetId); close(); }
            else if (id === 'ctx-edit') { execEdit(contextTargetId); close(); }
            else if (id === 'ctx-add-folder') { execAdd(contextTargetId, 'folder'); close(); }
            else if (id === 'ctx-add-cmd') { execAdd(contextTargetId, 'command'); close(); }
            else if (target.classList.contains('icon-option')) {
                updateItem(contextTargetId, { icon: target.dataset.icon });
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

    // 3. Factory Reset
    bindClick('btn-reset', () => {
        if (confirm("⚠️ DANGER ZONE \n\nAre you sure you want to delete ALL commands and history? This action cannot be undone.")) {
            // Reiniciamos a estado limpio pero funcional (con una carpeta raíz)
            treeData = [{
                id: genId(),
                name: "My Commands",
                type: "folder",
                children: [],
                collapsed: false,
                color: null
            }];
            commandHistory = [];

            // Limpiamos storage y variables
            chrome.storage.local.set({ linuxTree: treeData, linuxHistory: [] }, () => {
                refreshAll();
                showToast("🗑️ Factory Reset Complete");
                // Opcional: Cerrar el panel de settings para ver el resultado
                const settingsOverlay = document.getElementById('settings-overlay');
                if (settingsOverlay) settingsOverlay.classList.add('hidden');
            });
        }
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
        e.dataTransfer.setData('text/plain', String(node.id));
        row.classList.add('dragging');
    };

    row.ondragend = () => {
        row.classList.remove('dragging');
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
            performMove(sourceId, node.id, action);
        }
    };
}

function performMove(sourceId, targetId, action) {
    if (String(sourceId) === String(targetId)) return;
    const sourceList = findParentList(treeData, sourceId);
    if (!sourceList) return;
    const sIdx = sourceList.findIndex(n => String(n.id) === String(sourceId));
    if (sIdx === -1) return;
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
        const copy = cloneNode(appClipboard.data);
        if (!target.children) target.children = [];
        target.children.push(copy);
        target.collapsed = false;
        saveData();
        refreshAll();
        showToast("✅ Pasted");
    }
}

function execDelete(id) {
    const list = findParentList(treeData, id);
    if (list) {
        const idx = list.findIndex(n => String(n.id) === String(id));
        if (idx !== -1) {
            list.splice(idx, 1);
            saveData();
            refreshAll();
        }
    }
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
        Object.assign(node, updates);
        saveData();
        refreshAll();
    }
}

function togglePin(id) {
    const node = findNode(treeData, id);
    if (node) {
        node.pinned = !node.pinned;
        saveData();
        refreshAll();
    }
}

// --- UTILS ---
function genId() { return 'n-' + Date.now() + Math.random().toString(36).substr(2, 4); }

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

function isDescendant(parentId, childId) {
    const parent = findNode(treeData, parentId);
    if (!parent || !parent.children) return false;
    const check = (list) => list.some(n => String(n.id) === String(childId) || (n.children && check(n.children)));
    return check(parent.children);
}

function cloneNode(node) {
    const copy = { ...node, id: genId() };
    if (copy.children) copy.children = copy.children.map(c => cloneNode(c));
    return copy;
}

function changeTheme(themeName) {
    document.body.className = themeName;
    currentTheme = themeName;
}

// ==========================================================================
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

        // COMMAND (textarea)
        const cmdGroup = createFieldGroup('Command', 'textarea', 'inline-edit-cmd', node.cmd || '', 'Enter command...');
        form.appendChild(cmdGroup);

        // TAGS
        const tagsValue = Array.isArray(node.tags) ? node.tags.join(', ') : '';
        const tagsGroup = createFieldGroup('Tags', 'input', 'inline-edit-tags', tagsValue, 'tag1, tag2, tag3...');
        form.appendChild(tagsGroup);
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

    node.name = name;

    if (node.type === 'command') {
        const descInput = form.querySelector('.inline-edit-desc');
        const cmdInput = form.querySelector('.inline-edit-cmd');
        const tagsInput = form.querySelector('.inline-edit-tags');

        node.description = descInput ? descInput.value : '';
        node.cmd = cmdInput ? cmdInput.value : '';

        // Process tags
        const tagsStr = tagsInput ? tagsInput.value : '';
        node.tags = tagsStr
            ? tagsStr.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0)
            : [];

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

// --- INYECCIÓN DE CONTEXT MENU (FIX) ---
function injectContextMenu() {
    const menu = document.getElementById('context-menu');
    if (!menu) return;

    // Verificar si ya existe expand-all para no duplicar
    if (document.getElementById('ctx-expand-all')) return;

    // HTML de los botones nuevos
    const newItems = `
    <div class="ctx-item" id="ctx-expand-all" style="display:none">🔽 Expand All</div>
    <div class="ctx-item" id="ctx-collapse-all" style="display:none">▶️ Collapse All</div>
    
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
    const menu = document.getElementById('context-menu');
    const isFolder = node.type === 'folder';

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

    // --- 1. CONFIGURACIÓN DE CONTENIDO ---

    // A. Sección de CARPETAS: Visible solo si es carpeta
    setVisibility('ctx-folder-section', isFolder, 'block');
    setVisibility('ctx-hr-collapse', isFolder, 'block');
    // B. Sección de COMANDOS: Visible solo si NO es carpeta (¡Aquí estaba el bug!)
    // Esto oculta automáticamente Iconos, Pin, Etiquetas y todo lo que esté dentro de 'ctx-cmd-section'
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

    // --- 2. POSICIONAMIENTO INTELIGENTE ---

    // Paso A: Hacer visible pero transparente para medir dimensiones
    menu.style.visibility = 'hidden';
    menu.classList.remove('hidden');
    menu.style.display = 'block';

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
                if (menu) menu.classList.add('hidden');
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
    const btn = document.getElementById('btn-dock-toggle');
    if (btn) btn.onclick = async () => {
        try {
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

    // 1. Lógica V1: Búsqueda específica por Tags usando "#" (ej: #redes)
    if (query.startsWith('#')) {
        const tagToSearch = query.substring(1);
        // Validamos que n.tags exista y sea un array antes de buscar
        const tagMatch = Array.isArray(n.tags) && n.tags.some(t => t.toLowerCase().includes(tagToSearch));

        // Si el nodo cumple, es visible. Si no, revisamos si algún hijo cumple (para mostrar la carpeta padre)
        return n.children ? (tagMatch || n.children.some(c => isVisible(c, f))) : tagMatch;
    }

    // 2. Lógica V1: Búsqueda General (Nombre, Comando o Tags)
    const nameMatch = (n.name || '').toLowerCase().includes(query);
    const cmdMatch = (n.cmd || '').toLowerCase().includes(query);
    const tagMatch = Array.isArray(n.tags) && n.tags.some(t => t.toLowerCase().includes(query));

    const selfMatch = nameMatch || cmdMatch || tagMatch;

    // Retorna true si el nodo coincide O si alguno de sus hijos coincide (recursividad)
    return n.children ? (selfMatch || n.children.some(c => isVisible(c, f))) : selfMatch;
}

function highlightSyntax(c) {
    return c.replace(/(".*?"|'.*?')/g, '<span class="sh-string">$1</span>').replace(/(\s-[\w-]+)/g, '<span class="sh-flag">$1</span>');
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
        items.forEach(n => list.appendChild(createNodeElement(n, '', true)));
    } else {
        document.getElementById('quick-access-container').classList.add('hidden');
    }
}

function renderHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;
    list.innerHTML = '';
    const container = document.getElementById('history-container');
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
            row.className = 'history-item copy-flash'; // <--- Etiqueta necesaria para el CSS
            row.style.display = 'flex';
            row.style.flexDirection = 'column';
            row.style.alignItems = 'flex-start';
            row.style.padding = '8px';

            const titleSpan = document.createElement('span');
            titleSpan.style.fontWeight = 'bold';
            titleSpan.style.fontSize = '0.85em';
            titleSpan.style.color = 'var(--md-sys-color-primary)';
            titleSpan.style.marginBottom = '2px';
            titleSpan.textContent = name;

            const cmdSpan = document.createElement('span');
            cmdSpan.style.fontFamily = 'var(--font-code)';
            cmdSpan.style.fontSize = '0.75em';
            cmdSpan.style.opacity = '0.8';
            cmdSpan.innerHTML = `🕒 ${cmd.length > 40 ? cmd.substring(0, 37) + '...' : cmd}`;

            row.appendChild(titleSpan);
            row.appendChild(cmdSpan);

            row.onclick = () => copyToClipboard(cmd, name, row); // <--- Pasamos 'row'
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

    const body = {
        description: "Ivan's Helper Backup (CmdVault)",
        public: false,
        files: { [GIST_FILENAME]: { content: JSON.stringify(treeData, null, 2) } }
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
            body: JSON.stringify(body)
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

        showToast("✅ Backup uploaded");
        updateSyncIcon('success');

    } catch (e) {
        console.error("Gist Error:", e);
        showToast(e.message.includes("Rate Limit") ? e.message : `❌ Error: ${e.message}`);
    }
}

async function downloadFromGist() {
    cancelInlineEdit();
    if (!ghToken) return showToast("❌ Save GitHub Token first");
    showToast("📥 Downloading...");

    try {
        const responseGists = await fetch('https://api.github.com/gists', {
            headers: { 'Authorization': `token ${ghToken}` }
        });
        const gists = await responseGists.json();
        const remoteGist = gists.find(g => g.files && g.files[GIST_FILENAME]);

        if (!remoteGist) return showToast("❓ No backup found");

        // Guardamos el ID para futuras sincronizaciones
        localStorage.setItem('gistId', remoteGist.id);

        const rawData = await fetch(remoteGist.files[GIST_FILENAME].raw_url);
        const data = await rawData.json();

        if (data) {
            treeData = data;
            // IMPORTANTE: Aquí adaptamos a la V2 usando refreshAll()
            chrome.storage.local.set({ linuxTree: treeData }, () => {
                refreshAll();
            });
            showToast("✅ Data restored");
        }
    } catch (e) {
        console.error(e);
        showToast("❌ Download error");
    }
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

