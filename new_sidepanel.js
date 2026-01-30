const FOLDER_COLORS = ['#F37423', '#7DCFFF', '#8CD493', '#E4A8F2', '#FF5252', '#7C4DFF','#CFD8DC','#424242'];
const GIST_FILENAME = 'ivan_helper_backup.json';

// --- DATA VARIABLES ---
let treeData = []; 
let commandHistory = []; 
let qaCollapsed = false; 
let historyCollapsed = false; 
let commandsCollapsed = false; 
let pendingCommand = ""; 
let contextTargetId = null; 
let draggedId = null; 
let ghToken = ""; 
let currentTheme = "theme-dark"; 

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEvents();
    renderColorPalette();
    try { setupViewLogic(); } catch(e) { console.error("Dock logic error", e); }
});

// --- DOCK / UNDOCK LOGIC ---
async function setupViewLogic() {
    const btn = document.getElementById('btn-dock-toggle');
    if (!btn) return;
    btn.onclick = async () => {
        try {
            const currentWindow = await chrome.windows.getCurrent();
            if (currentWindow.type === 'popup') {
                const mainWindow = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
                if (mainWindow && mainWindow.id) {
                    await chrome.sidePanel.open({ windowId: mainWindow.id });
                    window.close();
                }
            } else {
                await chrome.windows.create({
                    url: 'sidepanel.html', type: 'popup', width: 400, height: 650
                });
            }
        } catch (e) { console.error("Error changing view:", e); }
    };
}

// --- CORE FUNCTIONS ---
function loadData() { 
    // AGREGADO: 'username' a la lista de recuperación
    chrome.storage.local.get(['linuxTree', 'linuxHistory', 'qaCollapsed', 'historyCollapsed', 'commandsCollapsed', 'ghToken', 'savedTheme', 'username'], r => { 
        treeData = r.linuxTree || []; 
        commandHistory = r.linuxHistory || [];
        qaCollapsed = r.qaCollapsed || false; 
        historyCollapsed = r.historyCollapsed || false;
        commandsCollapsed = r.commandsCollapsed || false; 
        ghToken = r.ghToken || "";
        currentTheme = r.savedTheme || "theme-dark"; 
        
        applyTheme(currentTheme);

        const tokenInput = document.getElementById('gh-token-input');
        if (tokenInput && ghToken) tokenInput.value = ghToken;

        // --- LÓGICA DE USUARIO (NUEVO) ---
        const savedUser = r.username || 'user';
        const titleEl = document.querySelector('.app-title');
        if (titleEl) titleEl.textContent = `${savedUser}@CmdVault:~$`;
        
        const userInput = document.getElementById('username-input');
        if (userInput) userInput.value = savedUser;
        // ---------------------------------

        render(); 
        renderHistory(); 
        updateSettingsUI(); 
    }); 
}

function saveData() { 
    chrome.storage.local.set({linuxTree: treeData}, () => {
        render(document.getElementById('search-input').value.toLowerCase());
        if (ghToken) autoSyncToCloud();
    }); 
}

function saveGlobalState() { 
    chrome.storage.local.set({ qaCollapsed, historyCollapsed, commandsCollapsed }); 
}

// --- THEME LOGIC ---
function applyTheme(themeName) {
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-hacker', 'theme-ocean','theme-teradata');
    document.body.classList.add(themeName);
    currentTheme = themeName;
}

// --- RENDERING ---
function highlightSyntax(code) {
    if (!code) return '';
    let html = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html.replace(/(#.*$)/gm, '<span class="sh-comment">$1</span>');
    html = html.replace(/(".*?"|'.*?')/g, '<span class="sh-string">$1</span>');
    html = html.replace(/(\s-[\w-]+)/g, '<span class="sh-flag">$1</span>');
    const keywords = /\b(sudo|root|su|apt|yum|dnf|pacman|docker|kubectl|systemctl|git|npm|yarn|pip|ssh|scp|echo|cd|ls|grep|cat|nano|vim|rm|mv|cp|mkdir|tar|chmod|chown)\b/g;
    html = html.replace(keywords, '<span class="sh-keyword">$1</span>');
    return html;
}

function render(f = '') {
    const treeCont = document.getElementById('tree-container');
    const qaCont = document.getElementById('quick-access-container');
    const qaList = document.getElementById('qa-list');
    const cmdArrow = document.getElementById('cmd-arrow');
    
    if (!treeCont) return;
    treeCont.innerHTML = ''; qaList.innerHTML = '';

    if(cmdArrow) cmdArrow.textContent = commandsCollapsed ? '►' : '▼';
    
    if(commandsCollapsed && !f) {
        treeCont.classList.add('hidden'); 
        treeCont.style.display = 'none'; 
    } else {
        treeCont.classList.remove('hidden');
        treeCont.style.display = 'block';
        treeData.forEach(n => { if(isVisible(n, f)) treeCont.appendChild(createNode(n, f)); });
    }

    const pinnedItems = getAllPinnedItems(treeData);
    if (pinnedItems.length > 0 && !f) {
        qaCont.classList.remove('hidden');
        document.getElementById('qa-arrow').textContent = qaCollapsed ? '►' : '▼';
        qaList.classList.toggle('collapsed', qaCollapsed);
        if (!qaCollapsed) pinnedItems.forEach(n => qaList.appendChild(createNode(n, '', true)));
    } else { qaCont.classList.add('hidden'); }
}

function createNode(node, filter, isQuickAccess = false) {
    const wrapper = document.createElement('div');
    const row = document.createElement('div');
    row.className = `tree-item type-${node.type}`;
    
    // --- LÓGICA DE DRAG & DROP INTELIGENTE ---
    if (!isQuickAccess && !filter) {
        row.draggable = true;
        
        // 1. Empezar arrastre
        row.ondragstart = (e) => { 
            draggedId = node.id; 
            e.dataTransfer.effectAllowed = 'move'; 
            e.target.style.opacity = '0.5'; 
        };
        
        // 2. Terminar arrastre (limpiar estilos)
        row.ondragend = (e) => { 
            e.target.style.opacity = '1'; 
            draggedId = null;
            // Limpiar cualquier borde visual que haya quedado
            document.querySelectorAll('.tree-item').forEach(el => {
                el.style.borderTop = '';
                el.style.borderBottom = '';
                el.style.background = '';
            });
        };

        // 3. Moverse sobre un objetivo (CALCULAR ZONA)
        row.ondragover = (e) => { 
            e.preventDefault(); // Permitir drop
            e.stopPropagation();
            
            if (!draggedId || draggedId === node.id) return;

            const rect = row.getBoundingClientRect();
            const offsetY = e.clientY - rect.top;     // Posición del mouse en el item
            const height = rect.height;
            const threshold = height * 0.25;          // 25% del borde define la zona

            // Limpiar estilos previos
            row.style.borderTop = '';
            row.style.borderBottom = '';
            row.style.background = '';

            // -- ZONA SUPERIOR (Insertar Antes) --
            if (offsetY < threshold) {
                row.style.borderTop = '2px solid var(--md-sys-color-primary)';
                e.dataTransfer.dropEffect = 'move';
            } 
            // -- ZONA INFERIOR (Insertar Después) --
            else if (offsetY > (height - threshold)) {
                row.style.borderBottom = '2px solid var(--md-sys-color-primary)';
                e.dataTransfer.dropEffect = 'move';
            } 
            // -- ZONA CENTRAL (Anidar) --
            else {
                // Solo permitimos anidar si es carpeta
                if (node.type === 'folder') {
                    row.style.background = 'var(--selection-bg)';
                    e.dataTransfer.dropEffect = 'copy';
                } else {
                    // Si es comando, zona central actúa como "Insertar Después" por defecto
                    row.style.borderBottom = '2px solid var(--md-sys-color-primary)';
                }
            }
        };

        // 4. Salir del objetivo (Limpiar)
        row.ondragleave = () => {
            row.style.borderTop = '';
            row.style.borderBottom = '';
            row.style.background = '';
        };

        // 5. SOLTAR (Ejecutar acción según zona)
        row.ondrop = (e) => { 
            e.preventDefault(); 
            e.stopPropagation();
            
            // Limpiar estilos
            row.style.borderTop = '';
            row.style.borderBottom = '';
            row.style.background = '';

            if (draggedId && draggedId !== node.id) {
                const rect = row.getBoundingClientRect();
                const offsetY = e.clientY - rect.top;
                const height = rect.height;
                const threshold = height * 0.25;

                let action = '';

                if (offsetY < threshold) {
                    action = 'before';  // Insertar arriba
                } else if (offsetY > (height - threshold)) {
                    action = 'after';   // Insertar abajo
                } else {
                    // En el centro: si es folder -> anidar, si es comando -> abajo
                    action = (node.type === 'folder') ? 'inside' : 'after';
                }

                handleDropItem(draggedId, node.id, action);
            }
        };
    }
    // -----------------------------------------

    const header = document.createElement('div');
    header.className = 'item-header';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.width = '100%'; 

    if (node.type === 'command' && node.description) header.title = node.description; 
    if(node.color && node.type === 'folder') header.style.color = node.color;
    
    // Icono y Nombre
    const icon = node.type === 'folder' ? (node.collapsed && !filter && !isQuickAccess ? '📁' : '📂') : (node.icon || '⚡');
    
    const leftContent = document.createElement('div');
    leftContent.style.display = 'flex';
    leftContent.style.alignItems = 'center';
    leftContent.innerHTML = `<span style="margin-right:8px">${icon}</span> <span>${node.name}</span>`;
    header.appendChild(leftContent);

    // Tags (Tu código anterior de tags ya integrado)
    if(node.tags && node.tags.length > 0) {
        const tagsContainer = document.createElement('div');
        tagsContainer.style.marginLeft = 'auto'; 
        tagsContainer.style.display = 'flex';
        tagsContainer.style.gap = '6px';
        tagsContainer.style.paddingLeft = '10px'; 

        node.tags.forEach(tag => { 
            const span = document.createElement('span');
            span.className = 'tag-badge';
            span.textContent = tag;
            span.style.fontSize = '0.75em';
            span.style.padding = '2px 8px';
            span.style.borderRadius = '12px';
            span.style.backgroundColor = 'var(--md-sys-color-surface-container-high)';
            span.style.color = 'var(--md-sys-color-on-surface-variant)';
            span.style.whiteSpace = 'nowrap';
            span.style.opacity = '0.9';
            tagsContainer.appendChild(span);
        });
        header.appendChild(tagsContainer);
    }

    header.onclick = () => { if(node.type === 'folder' && !isQuickAccess) { node.collapsed = !node.collapsed; saveData(); } };
    header.oncontextmenu = (e) => { e.preventDefault(); contextTargetId = node.id; showContextMenu(e, node); };
    row.appendChild(header);

    if(node.type === 'command') {
        const wrap = document.createElement('div'); wrap.className = 'cmd-wrapper';
        const pre = document.createElement('pre'); pre.className = 'cmd-preview';
        if(node.expanded) pre.classList.add('expanded');
        pre.innerHTML = highlightSyntax(node.cmd);
        pre.onclick = () => handleCopyAction(node.cmd);
        
        const toggleBtn = document.createElement('div'); toggleBtn.className = 'cmd-ctrl-btn';
        toggleBtn.textContent = node.expanded ? '▲' : '▼';
        toggleBtn.onclick = (e) => { e.stopPropagation(); node.expanded = !node.expanded; saveData(); };
        
        wrap.appendChild(pre); wrap.appendChild(toggleBtn); row.appendChild(wrap);
    }
    wrapper.appendChild(row);

    if(!isQuickAccess && node.children && (!node.collapsed || filter)) {
        const childCont = document.createElement('div'); childCont.className = 'folder-content';
        node.children.forEach(c => { if(isVisible(c, filter)) childCont.appendChild(createNode(c, filter)); });
        wrapper.appendChild(childCont);
    }
    return wrapper;
}

// --- HISTORIAL MEJORADO ---
function renderHistory() {
    const list = document.getElementById('history-list');
    const histArrow = document.getElementById('hist-arrow');
    
    if(histArrow) histArrow.textContent = historyCollapsed ? '►' : '▼';
    
    list.classList.toggle('collapsed', historyCollapsed);
    list.innerHTML = '';
    
    if(!historyCollapsed) {
        commandHistory.forEach((cmdStr, index) => {
            const tempNode = {
                id: `history-item-${index}`,
                type: 'command',
                name: cmdStr.length > 30 ? cmdStr.substring(0, 27) + '...' : cmdStr,
                cmd: cmdStr,
                icon: '🕒',
                description: 'Last used command',
                expanded: false,
                tags: []
            };
            const nodeElement = createNode(tempNode, '', true);
            list.appendChild(nodeElement);
        });
    }
}

// --- CONTEXT MENU (SMART POSITIONING FIXED) ---
function showContextMenu(e, item) {
    const menu = document.getElementById('context-menu');
    
    // 1. CONFIGURAR CONTENIDO (Qué opciones se muestran)
    const setDisplay = (elementOrId, show, style = 'block') => {
        const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
        if (!el) return;
        if (show) {
            el.classList.remove('hidden');
            el.style.display = style;
        } else {
            el.classList.add('hidden');
            el.style.display = 'none';
        }
    };

    const isFolder = item.type === 'folder';
    const isCommand = item.type === 'command';

    // Opciones de Carpetas
    setDisplay('ctx-add-folder', isFolder, 'flex');
    setDisplay('ctx-add-cmd', isFolder, 'flex');
    setDisplay('ctx-sep-1', isFolder, 'block');
    
    // Colores (SOLO FOLDER)
    const colorCont = document.getElementById('ctx-colors');
    setDisplay(colorCont, isFolder, 'flex');
    
    // Ocultar etiquetas de "Color" si no es folder
    Array.from(menu.children).forEach(child => {
        if(child.textContent && child.textContent.toLowerCase().includes('color') && !child.classList.contains('ctx-item')) {
            setDisplay(child, isFolder, 'block');
        }
    });

    // Sección de Comandos
    const cmdSection = document.getElementById('ctx-cmd-section');
    setDisplay(cmdSection, true, 'block'); 

    if (cmdSection) {
        const iconSelector = cmdSection.querySelector('.icon-selector');
        setDisplay(iconSelector, isCommand, 'flex');
        const hr = cmdSection.querySelector('hr');
        if(hr) setDisplay(hr, isCommand, 'block');
    }

    // Texto del Pin
    const pinBtn = document.getElementById('ctx-pin-toggle');
    if (pinBtn) {
        pinBtn.textContent = item.pinned ? "⭐ Unpin" : "📌 Pin";
    }

    // 2. POZICIONAMIENTO INTELIGENTE (LA MAGIA ✨)
    
    // Paso A: Hacer el menú "visible" pero transparente para medir su tamaño real actual
    menu.style.visibility = 'hidden'; 
    menu.classList.remove('hidden');
    menu.style.display = 'block';

    // Paso B: Obtener dimensiones
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;
    
    // Coordenadas iniciales del mouse
    let x = e.clientX;
    let y = e.clientY;
    
    // Paso C: Lógica de Colisión (Evitar que se salga)
    
    // 1. Ajuste Horizontal (Derecha -> Izquierda)
    if (x + menuWidth > winWidth) {
        x = x - menuWidth; // Si no cabe a la derecha, muéstralo a la izquierda del mouse
    }
    
    // 2. Ajuste Vertical (Abajo -> Arriba)
    // Si la posición del mouse + la altura del menú es mayor al alto de la ventana...
    if (y + menuHeight > winHeight) {
        y = y - menuHeight; // ...muéstralo ARRIBA del mouse
    }
    
    // 3. Seguridad Final (Para que no se salga por arriba o izquierda en pantallas muy chicas)
    if (y < 0) y = 10; // Mínimo 10px del borde superior
    if (x < 0) x = 10;
    
    // Paso D: Aplicar coordenadas y hacer visible
    menu.style.top = `${y}px`;
    menu.style.left = `${x}px`;
    menu.style.visibility = 'visible'; // Ahora sí lo mostramos
}

// --- EVENTS ---
function setupEvents() {
    const searchInput = document.getElementById('search-input');
    if(searchInput) searchInput.oninput = (e) => render(e.target.value.toLowerCase());
    
    const qaHeader = document.getElementById('qa-header');
    if(qaHeader) qaHeader.onclick = () => { qaCollapsed = !qaCollapsed; saveGlobalState(); render(); };
    
    const histHeader = document.getElementById('history-header');
    if(histHeader) histHeader.onclick = () => { historyCollapsed = !historyCollapsed; saveGlobalState(); renderHistory(); };
    
    const cmdHeader = document.getElementById('commands-header');
    if(cmdHeader) cmdHeader.onclick = () => { commandsCollapsed = !commandsCollapsed; saveGlobalState(); render(); };

    const themeSelect = document.getElementById('theme-selector');
    if (themeSelect) {
        themeSelect.onchange = (e) => {
            const newTheme = e.target.value;
            applyTheme(newTheme);
            chrome.storage.local.set({ savedTheme: newTheme });
        };
    }

    // --- LÓGICA BOTÓN SAVE USERNAME (NUEVO) ---
    const btnSaveUser = document.getElementById('btn-save-username');
    if(btnSaveUser) {
        btnSaveUser.onclick = () => {
            const input = document.getElementById('username-input');
            const newName = input.value.trim() || 'user';
            
            chrome.storage.local.set({ username: newName }, () => {
                const titleEl = document.querySelector('.app-title');
                if(titleEl) titleEl.textContent = `${newName}@CmdVault:~$`;
                showToast("✅ Username Saved");
            });
        };
    }
    // -------------------------------------------

    const btnAddRoot = document.getElementById('btn-add-root');
    if(btnAddRoot) btnAddRoot.onclick = () => { 
        const n = prompt("Folder Name:"); 
        if(n) { treeData.push({id: Date.now().toString(), name:n, type:'folder', children:[], collapsed:false}); saveData(); } 
    };
    
    const btnClearClip = document.getElementById('btn-clear-clipboard');
    if(btnClearClip) btnClearClip.onclick = () => { navigator.clipboard.writeText('').then(() => showToast("🧹 Clipboard Cleared")); };

    const sOverlay = document.getElementById('settings-overlay');
    const btnSettings = document.getElementById('btn-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');

    if(btnSettings && sOverlay) {
        btnSettings.onclick = () => { updateSettingsUI(); sOverlay.classList.remove('hidden'); };
    }
    if(btnCloseSettings && sOverlay) {
        btnCloseSettings.onclick = () => sOverlay.classList.add('hidden');
    }
    if(sOverlay) {
        sOverlay.onclick = (e) => { if (e.target === sOverlay) sOverlay.classList.add('hidden'); };
    }
    
    const btnSaveToken = document.getElementById('btn-save-token');
    if(btnSaveToken) {
        btnSaveToken.onclick = () => {
            const t = document.getElementById('gh-token-input').value.trim();
            if(t) { ghToken = t; chrome.storage.local.set({ghToken: t}, () => { showToast("💾 Token Saved"); updateSettingsUI(); }); }
        };
    }

    const btnUpload = document.getElementById('btn-sync-upload');
    if(btnUpload) btnUpload.onclick = uploadToGist;

    const btnDownload = document.getElementById('btn-sync-download');
    if(btnDownload) btnDownload.onclick = downloadFromGist;

    const btnReset = document.getElementById('btn-reset');
    if(btnReset) {
        btnReset.onclick = () => { if(confirm("Delete EVERYTHING?")) { treeData=[]; commandHistory=[]; saveData(); chrome.storage.local.set({linuxHistory:[]}); renderHistory(); } };
    }
    
    const btnExport = document.getElementById('btn-export');
    if(btnExport) {
        btnExport.onclick = () => {
            const b = new Blob([JSON.stringify(treeData,null,2)],{type:'application/json'});
            const a = document.createElement('a'); a.href=URL.createObjectURL(b); a.download='backup.json'; a.click();
        };
    }

    const btnImport = document.getElementById('btn-import');
    const fileInput = document.getElementById('file-input');
    if(btnImport && fileInput) {
        btnImport.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            const r = new FileReader(); 
            r.onload = (ev) => { try { treeData=JSON.parse(ev.target.result); saveData(); showToast("✅ Import Successful"); } catch(e){ alert("Invalid JSON File"); } };
            r.readAsText(e.target.files[0]);
        };
    }

    document.querySelectorAll('.icon-option').forEach(opt => opt.onclick = () => { 
        updateItemProperty(treeData, contextTargetId, { icon: opt.dataset.icon }); saveData(); document.getElementById('context-menu').classList.add('hidden'); 
    });
    
    const ctxPin = document.getElementById('ctx-pin-toggle');
    if(ctxPin) ctxPin.onclick = () => { togglePin(contextTargetId); document.getElementById('context-menu').classList.add('hidden'); };
    
    const ctxAddFolder = document.getElementById('ctx-add-folder');
    if(ctxAddFolder) ctxAddFolder.onclick = () => { 
        const n = prompt("Sub-folder Name:"); 
        if(n) findAndAdd(treeData, contextTargetId, {id: Date.now().toString(), name:n, type:'folder', children:[], color: FOLDER_COLORS[0]}); 
    };
    
    const ctxAddCmd = document.getElementById('ctx-add-cmd');
    if(ctxAddCmd) ctxAddCmd.onclick = () => {
        const n = prompt("Name:"); if(!n) return;
        const d = prompt("Description:"); 
        const c = prompt("Command:"); 
        const t = prompt("Tags (comma separated):"); 
        let tagsArray = []; if(t) tagsArray = t.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
        if(c) findAndAdd(treeData, contextTargetId, { id: Date.now().toString(), name: n, description: d||"", cmd: c, tags: tagsArray, type: 'command', icon: '⚡', expanded: false });
    };
    
    const ctxDelete = document.getElementById('ctx-delete');
    if(ctxDelete) ctxDelete.onclick = () => { 
        if(confirm("Delete item?")) deleteItem(treeData, contextTargetId); document.getElementById('context-menu').classList.add('hidden'); 
    };
    
    const ctxEdit = document.getElementById('ctx-edit');
    if(ctxEdit) ctxEdit.onclick = () => {
        const item = findItemById(treeData, contextTargetId); if(!item) return;
        const newName = prompt("Name:", item.name); if(newName === null) return; 
        item.name = newName;
        if(item.type === 'command') {
            const newDesc = prompt("Description:", item.description || ""); 
            const newCmd = prompt("Command:", item.cmd);
            const currentTags = item.tags ? item.tags.join(", ") : ""; 
            const newTags = prompt("Tags (comma separated):", currentTags);
            if(newDesc !== null) item.description = newDesc; 
            if(newCmd !== null && newCmd.trim() !== "") item.cmd = newCmd;
            if(newTags !== null) item.tags = newTags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
        }
        saveData(); document.getElementById('context-menu').classList.add('hidden');
    };
    
    document.addEventListener('click', (e) => { 
        if(!e.target.closest('.context-menu')) {
            const ctxMenu = document.getElementById('context-menu');
            if(ctxMenu) ctxMenu.classList.add('hidden'); 
        }
    });
    
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    if(btnModalCancel) btnModalCancel.onclick = () => document.getElementById('modal-overlay').classList.add('hidden');
    
    const btnModalCopy = document.getElementById('btn-modal-copy');
    if(btnModalCopy) btnModalCopy.onclick = processAndCopy;
}

// --- UTILS ---
function isVisible(n, f) {
    if(!f) return true;
    const query = f.trim().toLowerCase();
    if (query.startsWith('#')) {
        const tagToSearch = query.substring(1);
        const tagMatch = n.tags && n.tags.some(t => t.toLowerCase().includes(tagToSearch));
        return n.children ? (tagMatch || n.children.some(c => isVisible(c, f))) : tagMatch;
    }
    const nameMatch = n.name.toLowerCase().includes(query);
    const cmdMatch = n.cmd ? n.cmd.toLowerCase().includes(query) : false;
    const tagMatch = n.tags ? n.tags.some(t => t.toLowerCase().includes(query)) : false;
    const selfMatch = nameMatch || cmdMatch || tagMatch;
    return n.children ? (selfMatch || n.children.some(c => isVisible(c, f))) : selfMatch;
}

function handleCopyAction(cmd) {
    const r = /\{\{(.*?)\}\}/g; const m = [...cmd.matchAll(r)];
    if(m.length===0) { copyText(cmd); } else {
        pendingCommand = cmd; const c = document.getElementById('variable-fields'); c.innerHTML='';
        [...new Set(m.map(x=>x[1]))].forEach(v=>{
            const d=document.createElement('div'); d.className='var-input-group';
            d.innerHTML=`<label style="display:block;margin-bottom:4px;color:#ccc;">${v}</label><input type="text" class="v-input" data-v="${v}">`; 
            c.appendChild(d);
        });
        document.getElementById('modal-overlay').classList.remove('hidden');
    }
}

function processAndCopy() {
    let f = pendingCommand; document.querySelectorAll('.v-input').forEach(i=>{ f=f.split(`{{${i.dataset.v}}}`).join(i.value||`{{${i.dataset.v}}}`); });
    copyText(f); document.getElementById('modal-overlay').classList.add('hidden');
}

function copyText(t) { 
    navigator.clipboard.writeText(t).then(() => { 
        addToHistory(t); 
        showToast("📋 Copied to Clipboard"); 
    }); 
}

function addToHistory(cmd) {
    commandHistory = commandHistory.filter(c => c !== cmd); commandHistory.unshift(cmd);
    if(commandHistory.length > 15) commandHistory.pop();
    chrome.storage.local.set({linuxHistory: commandHistory}); renderHistory();
}

function showToast(m) { 
    const e = document.getElementById('status-msg'); 
    e.textContent=m; 
    e.classList.remove('hidden'); 
    setTimeout(()=>e.classList.add('hidden'), 2000); 
}

function renderColorPalette() {
    const p = document.getElementById('ctx-colors'); 
    if(!p) return;
    p.innerHTML = '';
    FOLDER_COLORS.forEach(c => {
        const d = document.createElement('div'); d.className='color-dot'; d.style.backgroundColor=c;
        d.onclick = () => { updateItemProperty(treeData, contextTargetId, {color:c}); saveData(); document.getElementById('context-menu').classList.add('hidden'); };
        p.appendChild(d);
    });
}

function updateSettingsUI() {
    const btnUp = document.getElementById('btn-sync-upload');
    const btnDown = document.getElementById('btn-sync-download');
    const inputToken = document.getElementById('gh-token-input');
    const themeSelector = document.getElementById('theme-selector');

    if(ghToken) {
        if(btnUp) btnUp.disabled = false;
        if(btnDown) btnDown.disabled = false;
        if(inputToken) inputToken.value = ghToken;
    }
    if(themeSelector && currentTheme) {
        themeSelector.value = currentTheme;
    }
}

function updateSyncIcon(state) {
    const icon = document.getElementById('sync-indicator'); if (!icon) return;
    if (state === 'working') { icon.classList.add('sync-working'); icon.classList.remove('sync-success'); } 
    else if (state === 'success') { icon.classList.remove('sync-working'); icon.classList.add('sync-success'); setTimeout(() => icon.classList.remove('sync-success'), 3000); }
}

// --- GITHUB SYNC ENGINE ---
// ==========================================
// GIST SYNC (CON PROTECCIÓN DE RATE LIMIT)
// ==========================================

// Agregamos un parámetro 'isRetry' para saber si ya es el segundo intento
async function uploadToGist(isRetry = false) {
    if (!ghToken) return showToast("❌ Please save your GitHub Token first.");
    
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
                'Authorization': `Bearer ${ghToken}`, // Usamos Bearer estándar
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(body)
        });

        // --- MANEJO DE RATE LIMIT (ERROR 403 / 429) ---
        if (response.status === 403 || response.status === 429) {
            // Verificamos si es por límite de velocidad
            const limitReset = response.headers.get('x-ratelimit-reset');
            const resetTime = limitReset ? new Date(limitReset * 1000).toLocaleTimeString() : 'un rato';
            
            console.error("Rate Limit Hit:", response);
            throw new Error(`⏳ GitHub is resting. Try again at… ${resetTime}`);
        }

        // --- MANEJO DE ERROR 404 (GIST BORRADO) ---
        if (response.status === 404 && gistId) {
            if (isRetry) {
                // SI YA REINTENTAMOS Y SIGUE FALLANDO, PARAMOS AQUI (EVITA EL BUCLE INFINITO)
                throw new Error("A new Gist couldn’t be created. Check your permissions.");
            }
            
            console.warn("⚠️ Gist ID not found. Creating a new one....");
            localStorage.removeItem('gistId');
            
            // Llamamos a la función de nuevo, pero marcamos isRetry = true
            return await uploadToGist(true); 
        }

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || `Error ${response.status}`);
        }

        // --- ÉXITO ---
        const data = await response.json();
        if (data.id) {
            localStorage.setItem('gistId', data.id);
        }

        showToast("✅ Backup uploaded successfully");

    } catch (e) {
        console.error("Gist Error:", e);
        // Mostramos el mensaje limpio al usuario
        showToast(e.message.includes("GitHub is resting") ? e.message : `❌ Error: ${e.message}`);
    }
}

async function downloadFromGist() {
    if (!ghToken) return alert("Please save your GitHub Token first.");
    showToast("📥 Downloading from GitHub...");

    try {
        const responseGists = await fetch('https://api.github.com/gists', {
            headers: { 'Authorization': `token ${ghToken}` }
        });
        const gists = await responseGists.json();
        const remoteGist = gists.find(g => g.files && g.files[GIST_FILENAME]);

        if (!remoteGist) return showToast("❓ No backup found in your account");

        const rawData = await fetch(remoteGist.files[GIST_FILENAME].raw_url);
        const data = await rawData.json();

        if (data) {
            treeData = data;
            chrome.storage.local.set({linuxTree: treeData}, () => {
                render(document.getElementById('search-input').value.toLowerCase());
            });
            showToast("✅ Data restored from cloud");
        }
    } catch (e) {
        console.error(e);
        showToast("❌ Error downloading");
    }
}

async function autoSyncToCloud() {
    updateSyncIcon('working');
    try {
        const responseGists = await fetch('https://api.github.com/gists', {
            headers: { 'Authorization': `token ${ghToken}` }
        });
        const gists = await responseGists.json();
        const existingGist = gists.find(g => g.files && g.files[GIST_FILENAME]);
        
        if(!existingGist) return; 

        const body = {
            files: { [GIST_FILENAME]: { content: JSON.stringify(treeData, null, 2) } }
        };

        const finalResponse = await fetch(`https://api.github.com/gists/${existingGist.id}`, {
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

// --- DATA HELPERS ---
function findAndAdd(l, id, it) {
    for (let n of l) {
        if (n.id === id) {
            if (!n.children) n.children = [];
            n.children.push(it);
            n.collapsed = false;
            saveData();
            return true;
        }
        if (n.children && findAndAdd(n.children, id, it)) return true;
    }
}

function deleteItem(l, id) {
    for (let i = 0; i < l.length; i++) {
        if (l[i].id === id) {
            l.splice(i, 1);
            saveData();
            return true;
        }
        if (l[i].children && deleteItem(l[i].children, id)) return true;
    }
}

function updateItemProperty(l, id, p) {
    for (let n of l) {
        if (n.id === id) {
            Object.assign(n, p);
            return true;
        }
        if (n.children && updateItemProperty(n.children, id, p)) return true;
    }
}

function findAndModify(l, id, cb) {
    for (let n of l) {
        if (n.id === id) {
            cb(n);
            return true;
        }
        if (n.children && findAndModify(n.children, id, cb)) return true;
    }
}

function findItemById(l, id) {
    for (let n of l) {
        if (n.id === id) return n;
        if (n.children) {
            const f = findItemById(n.children, id);
            if (f) return f;
        }
    }
    return null;
}

function findAndRemove(l, id) {
    for (let i = 0; i < l.length; i++) {
        if (l[i].id === id) return l.splice(i, 1)[0];
        if (l[i].children) {
            const f = findAndRemove(l[i].children, id);
            if (f) return f;
        }
    }
    return null;
}

function insertAsSibling(l, tId, it) {
    for (let i = 0; i < l.length; i++) {
        if (l[i].id === tId) {
            l.splice(i, 0, it);
            return true;
        }
        if (l[i].children && insertAsSibling(l[i].children, tId, it)) return true;
    }
    return false;
}

function handleDropItem(dId, tId, tType) {
    const item = findAndRemove(treeData, dId); 
    if(!item) return;
    if(tType === 'folder') { 
        const tf = findItemById(treeData, tId); 
        if(tf) { 
            if(!tf.children) tf.children=[]; 
            tf.children.push(item); 
            tf.collapsed=false; 
        } 
    } else { 
        insertAsSibling(treeData, tId, item); 
    }
    saveData();
}

function getAllPinnedItems(l) {
    let acc = [];
    l.forEach(n => {
        if(n.pinned) acc.push(n);
        if(n.children) acc = acc.concat(getAllPinnedItems(n.children));
    });
    return acc;
}

function togglePin(id) {
    const item = findItemById(treeData, id);
    if(item) { 
        item.pinned = !item.pinned; 
        saveData(); 
        render(); 
    }
}

// --- FUNCIONES DE ARRASTRAR Y SOLTAR MEJORADAS ---

// Busca el arreglo padre donde vive el item con ID 'targetId'
function findParentArray(list, targetId) {
    for (let i = 0; i < list.length; i++) {
        if (list[i].id === targetId) return list;
        if (list[i].children) {
            const res = findParentArray(list[i].children, targetId);
            if (res) return res;
        }
    }
    return null;
}

// Lógica principal de Drop
function handleDropItem(dId, tId, position) {
    if (dId === tId) return; // No soltar sobre sí mismo

    // 1. Sacamos el item de su lugar original
    const item = findAndRemove(treeData, dId);
    if (!item) return;

    // 2. Si es "INSIDE" (Anidar dentro de carpeta)
    if (position === 'inside') {
        const targetFolder = findItemById(treeData, tId);
        if (targetFolder) {
            if (!targetFolder.children) targetFolder.children = [];
            targetFolder.children.push(item);
            targetFolder.collapsed = false; // Abrir carpeta para ver el cambio
        } else {
            // Si falló, lo devolvemos al final (fallback)
            treeData.push(item);
        }
    } 
    // 3. Si es "BEFORE" o "AFTER" (Reordenar)
    else {
        const parentArr = findParentArray(treeData, tId);
        if (parentArr) {
            // Encontrar índice del objetivo
            const index = parentArr.findIndex(x => x.id === tId);
            if (index !== -1) {
                // Calcular nueva posición
                const newIndex = position === 'after' ? index + 1 : index;
                parentArr.splice(newIndex, 0, item);
            }
        } else {
            // Caso raro: soltar en nivel raíz si no encuentra padre
            treeData.push(item);
        }
    }

    saveData();
    renderTree();
}