const FOLDER_COLORS = ['#ECEFF1', '#F37423', '#7DCFFF', '#8CD493', '#E4A8F2', '#FF5252', '#7C4DFF', '#424242'];

const GIST_FILENAME = 'ivan_helper_backup.json';

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

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 V14.2 Context Menu Injection Fix...");
    try {
        injectContextMenu();
        setupAppEvents();
        setupDocking();
        renderColorPalette(); // <--- ✅ CORRECCIÓN: Usar el nombre real de la función
    } catch (e) { console.error("UI Init Error:", e); }
    loadDataFromStorage();
});

// --- CARGA DE DATOS ---
function loadDataFromStorage() {
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
                color: FOLDER_COLORS[0]
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

function createNodeElement(node, filter, isFav = false) {
    const row = document.createElement('div');
    row.className = `tree-item type-${node.type}`;

    if (appClipboard && appClipboard.action === 'cut' && String(appClipboard.id) === String(node.id)) {
        row.classList.add('cut-state');
    }

    if (!isFav && !filter) attachDragEvents(row, node);

    const header = document.createElement('div');
    header.className = 'item-header';
    header.style.display = 'flex';
    header.style.alignItems = 'center';

    if (node.color && node.type === 'folder') header.style.color = node.color;
    if (node.description) header.title = node.description;

    // --- CIRUGÍA DE ICONOS V3 ---
    const iconSpan = document.createElement('span');
    iconSpan.style.marginRight = '8px';
    iconSpan.style.display = 'flex'; 
    iconSpan.style.alignItems = 'center';

    const collapsed = node.collapsed === true;

    const iconClosed = `<svg class="folder-icon-v3" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    const iconOpen = `<svg class="folder-icon-v3" viewBox="0 0 24 24"><path d="M20 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z"></path><path d="M3 13h19"></path></svg>`;
    const iconCmd = `<svg class="folder-icon-v3" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`;

    if (node.type === 'folder') {
        iconSpan.innerHTML = (collapsed && !filter) ? iconClosed : iconOpen;
    } else {
        iconSpan.innerHTML = node.icon ? node.icon : iconCmd;
    }

// 1. PROCESAMIENTO DEL NOMBRE CON RESALTADO (HIGHLIGHT)
    const nameSpan = document.createElement('span');
    const nameText = node.name || "Untitled";

    if (filter && filter.trim() !== "") {
        try {
            // Escapamos caracteres especiales para evitar errores de Regex
            const escapedFilter = filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedFilter})`, 'gi');
            
            // Inyectamos el span con la clase .search-highlight
            nameSpan.innerHTML = nameText.replace(regex, '<span class="search-highlight">$1</span>');
        } catch (e) {
            nameSpan.textContent = nameText;
        }
    } else {
        nameSpan.textContent = nameText;
    }

    // 2. CONSTRUCCIÓN DEL HEADER
    header.appendChild(iconSpan);
    header.appendChild(nameSpan);

    // 3. PROCESAMIENTO DE TAGS (Manteniendo tu lógica actual)
    if (Array.isArray(node.tags) && node.tags.length > 0) {
        const tagsDiv = document.createElement('div');
        tagsDiv.style.marginLeft = 'auto';
        tagsDiv.style.display = 'flex';
        tagsDiv.style.gap = '4px';

        node.tags.forEach(t => {
            const badge = document.createElement('span');
            badge.className = 'tag-badge';
            badge.textContent = t;
            
            // Si el tag es 'precaution', aplicamos la clase especial
            if (t.toLowerCase().trim() === 'precaution') {
                badge.classList.add('precaution');
            }
            
            tagsDiv.appendChild(badge);
        });
        header.appendChild(tagsDiv);
    }

    header.onclick = () => {
        if (node.type === 'folder' && !isFav) {
            node.collapsed = !node.collapsed;
            saveData();
            refreshAll();
        }
    };

    header.oncontextmenu = (e) => {
        e.preventDefault();
        contextTargetId = node.id;
        openContextMenu(e, node);
    };

    row.appendChild(header);

    if (node.type === 'command') {
        const wrap = document.createElement('div');
        wrap.className = 'cmd-wrapper';
        
        const pre = document.createElement('pre');
        pre.className = node.expanded ? 'cmd-preview expanded' : 'cmd-preview';
        pre.innerHTML = highlightSyntax(String(node.cmd || ""));
        pre.onclick = () => copyToClipboard(node.cmd, node.name);

        const btn = document.createElement('div');
        btn.className = 'cmd-ctrl-btn';

        // Iconos con pointer-events: none para asegurar que el clic llegue al div
        btn.innerHTML = node.expanded
            ? `<svg class="folder-icon-v3" style="width:14px; height:14px; pointer-events: none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`
            : `<svg class="folder-icon-v3" style="width:14px; height:14px; pointer-events: none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

        // MANEJO DE CLIC REFORZADO
        btn.onclick = (e) => {
            e.preventDefault();  // Evita acciones por defecto
            e.stopPropagation(); // DETIENE la propagación hacia el 'pre' (importante)
            
            node.expanded = !node.expanded;
            saveData();
            refreshAll();
        };

        wrap.appendChild(pre);
        wrap.appendChild(btn);
        row.appendChild(wrap);
    }

    const wrapper = document.createElement('div');
    wrapper.appendChild(row);

    if (!isFav && node.children && node.type === 'folder') {
        if (!node.collapsed || filter) {
            const inner = document.createElement('div');
            inner.className = 'folder-content';
            inner.style.borderLeft = "1px solid var(--md-sys-color-outline-variant, rgba(255,255,255,0.1))";
            inner.style.marginLeft = "12px";
            inner.style.paddingLeft = "8px";

            node.children.forEach(child => {
                if (child && isVisible(child, filter)) {
                    inner.appendChild(createNodeElement(child, filter));
                }
            });
            wrapper.appendChild(inner);
        }
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
        const n = prompt("New Root Folder:");
        if (n) {
            addItemToTree(null, { id: genId(), name: n, type: 'folder', children: [], collapsed: false, color: FOLDER_COLORS[0] });
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
                color: FOLDER_COLORS[0]
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
    if (type === 'folder') {
        const n = prompt("Folder Name:");
        // Nota: Aquí ya usa FOLDER_COLORS[0] que acabamos de cambiar a Perla
        if (n) addItemToTree(parentId, { id: genId(), name: n, type: 'folder', children: [], collapsed: false, color: FOLDER_COLORS[0] });
    } else {
        // --- RESTAURACIÓN DE LA SECUENCIA DE PROMPTS DE V1 ---

        // 1. Nombre
        const n = prompt("Name:");
        if (!n) return; // Si cancela el nombre, abortamos igual que en V1

        // 2. Descripción (Faltaba en V2)
        const d = prompt("Description:");

        // 3. Comando
        const c = prompt("Command:");

        // 4. Tags (Faltaba en V2)
        const t = prompt("Tags (comma separated):");

        // Procesamiento de Tags (Lógica exacta de V1 para mantener compatibilidad CSS)
        let tagsArray = [];
        if (t) {
            tagsArray = t.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
        }

        if (c) {
            // Construimos el objeto completo con todas las propiedades
            addItemToTree(parentId, {
                id: genId(),
                name: n,
                description: d || "", // Guardamos descripción
                cmd: c,
                tags: tagsArray,      // Guardamos el array de tags para que se activen los badges
                type: 'command',
                icon: '⌨️',
                expanded: false
            });
        }
    }
}

/* --- FUNCIÓN DE EDICIÓN MEJORADA (V2 FIX) --- */
function execEdit(id) {
    const node = findNode(treeData, id);
    if (!node) return;

    // CASO 1: Si es una CARPETA, solo editamos el nombre
    if (node.type === 'folder') {
        const n = prompt("Edit Folder Name:", node.name);
        // Si el usuario da "Cancelar" (null) o lo deja vacío, no hacemos nada
        if (n !== null && n.trim() !== "") {
            node.name = n;
            saveData();
            refreshAll();
        }
        return;
    }

    // CASO 2: Si es un COMANDO, editamos los 4 campos (Flujo de 4 pasos)

    // 1. Nombre (Obligatorio)
    const n = prompt("Edit Name:", node.name);
    if (n === null) return; // Si cancela, abortamos la edición

    // 2. Descripción
    const d = prompt("Edit Description:", node.description || "");
    if (d === null) return;

    // 3. Comando
    const c = prompt("Edit Command:", node.cmd || "");
    if (c === null) return;

    // 4. Tags (Convertimos el array a texto para mostrarlo)
    const currentTags = (node.tags || []).join(', ');
    const t = prompt("Edit Tags (comma separated):", currentTags);
    if (t === null) return;

    // --- APLICAR CAMBIOS ---

    // Validamos que el nombre no quede vacío
    if (n.trim()) node.name = n;

    node.description = d;
    node.cmd = c;

    // Procesar Tags (String -> Array)
    let tagsArray = [];
    if (t) {
        tagsArray = t.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
    }
    node.tags = tagsArray;

    // Guardar y Refrescar
    saveData();
    refreshAll();
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

// ENTRADA MAESTRA: Redirige al sistema inteligente
function copyToClipboard(text, name = "Command") {
    if (!text) return;

    // En lugar de copiar directo, pasamos por el filtro inteligente.
    // Si tiene variables, abrirá el modal.
    // Si NO tiene variables, el Smart Handler llamará a 'copyToClipboardReal' automáticamente.
    handleSmartCopy(text);
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
        // Nota: Ya no necesitamos ocultar manualmente .icon-selector porque 
        // el contenedor padre (ctx-cmd-section) ya está oculto.
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
function renderColorPalette() {
    const p = document.getElementById('ctx-colors');
    if (!p) return;
    p.innerHTML = '';
    FOLDER_COLORS.forEach(c => {
        const d = document.createElement('div');
        d.className = 'color-dot'; d.style.backgroundColor = c;
        d.onclick = () => { updateItem(contextTargetId, { color: c }); document.getElementById('context-menu').classList.add('hidden'); };
        p.appendChild(d);
    });
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
        commandHistory.slice(0, 5).forEach((item) => {
            const cmd = typeof item === 'string' ? item : item.cmd;
            const name = typeof item === 'string' ? 'Command' : item.name;

            const row = document.createElement('div');
            row.className = 'tree-item';
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

            row.onclick = () => copyToClipboard(cmd, name);
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
function copyToClipboard(text, name = "Command") {
    if (!text) return;

    // Detectar variables {{...}}
    const hasVariables = /{{(.*?)}}/.test(text);

    if (hasVariables) {
        openSmartModal(text);
    } else {
        copyToClipboardReal(text);
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