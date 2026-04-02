// ---------- 全局状态 ----------
let tabs = [];
let activeTabId = null;

let currentPath = '';
let historyBack = [];
let historyForward = [];
let currentFiles = [];
let selectedPaths = new Set();
let focusedPath = null;
let anchorPath = null;

let viewMode = 'list';
let clipboardStatus = { operation: null, count: 0 };
let animationsEnabled = true;

let isDragging = false;
let ignoreNextBlankClick = false;

let dragStartX = 0, dragStartY = 0;
let selectionBox = null;
const dragThreshold = 5;

let isNavigating = false;
let isCreatingFolder = false;
let isCreatingFile = false;
let animationTimeouts = [];

// 分片渲染相关
let renderingChunkTimer = null;
let renderingChunkIndex = 0;
let renderingChunkFiles = [];
let renderingChunkViewMode = 'list';
const CHUNK_SIZE = 10;
const CHUNK_DELAY = 5;

// 搜索模式标志
let isSearchMode = false;
let currentSearchQuery = '';

// DOM 元素
const tabBar = document.getElementById('tabBar');
const addTabBtn = document.getElementById('addTabBtn');
const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const upBtn = document.getElementById('upBtn');
const refreshBtn = document.getElementById('refreshBtn');
const newFolderBtn = document.getElementById('newFolderBtn');
const addressInput = document.getElementById('addressInput');
const fileListBody = document.getElementById('fileListBody');
const gridView = document.getElementById('gridView');
const listView = document.getElementById('listView');
const driveList = document.getElementById('driveList');
const quickAccessList = document.getElementById('quickAccessList');
const thisPcBtn = document.getElementById('thisPcBtn');
const settingsBtn = document.getElementById('settingsBtn');
const statusBar = document.getElementById('statusBar');
const errorToast = document.getElementById('errorToast');
const contextMenu = document.getElementById('contextMenu');
const contextMenuList = document.getElementById('contextMenuList');
const propCard = document.getElementById('propCard');
const fileListContainer = document.getElementById('fileListContainer');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const closeSettingsFooterBtn = document.getElementById('closeSettingsFooterBtn');
const dialogOverlay = document.getElementById('dialogOverlay');
const dialogMessage = document.getElementById('dialogMessage');
const dialogInput = document.getElementById('dialogInput');
const dialogCancel = document.getElementById('dialogCancel');
const dialogConfirm = document.getElementById('dialogConfirm');
const loadingOverlay = document.getElementById('loadingOverlay');
const searchIframeContainer = document.getElementById('searchIframeContainer');
const bingFrame = document.getElementById('bingSearchFrame');

// 壁纸相关
let wallpaperRadios = document.querySelectorAll('input[name="wallpaper"]');
let chooseWallpaperBtn = document.getElementById('chooseWallpaperBtn');
let animationToggle = document.getElementById('animationToggle');

window._lastCustomWallpaperPath = '';

// ---------- 状态栏动态时钟 ----------
let statusClockInterval = null;
let statusTimeout = null;

function startDynamicClock() {
    if (statusClockInterval) clearInterval(statusClockInterval);
    const updateTime = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const timeStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        statusBar.innerText = `🕒 ${timeStr}`;
    };
    updateTime();
    statusClockInterval = setInterval(updateTime, 1000);
}

function stopDynamicClock() {
    if (statusClockInterval) {
        clearInterval(statusClockInterval);
        statusClockInterval = null;
    }
}

function updateStatusBar(text, isTemporary = true) {
    statusBar.innerText = text;
    if (isTemporary) {
        if (statusTimeout) clearTimeout(statusTimeout);
        stopDynamicClock();
        statusTimeout = setTimeout(() => {
            startDynamicClock();
        }, 3000);
    } else {
        if (statusTimeout) clearTimeout(statusTimeout);
        stopDynamicClock();
    }
}

// ---------- 标签页管理函数 ----------
function generateTabId() { return 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9); }

function createTab(title = '此电脑') {
    const id = generateTabId();
    const tab = { id, title, currentPath: '', historyBack: [], historyForward: [], currentFiles: [], selectedPaths: new Set(), focusedPath: null, anchorPath: null, isSearchMode: false, searchQuery: '' };
    tabs.push(tab);
    renderTabs();
    return id;
}

function switchTab(tabId) {
    if (tabId === activeTabId) return;
    if (activeTabId) {
        const oldTab = tabs.find(t => t.id === activeTabId);
        if (oldTab) {
            oldTab.currentPath = currentPath;
            oldTab.historyBack = [...historyBack];
            oldTab.historyForward = [...historyForward];
            oldTab.currentFiles = [...currentFiles];
            oldTab.selectedPaths = new Set(selectedPaths);
            oldTab.focusedPath = focusedPath;
            oldTab.anchorPath = anchorPath;
            oldTab.isSearchMode = isSearchMode;
            oldTab.searchQuery = currentSearchQuery;
        }
    }
    activeTabId = tabId;
    const newTab = tabs.find(t => t.id === tabId);
    if (newTab) {
        currentPath = newTab.currentPath;
        historyBack = [...newTab.historyBack];
        historyForward = [...newTab.historyForward];
        currentFiles = [...newTab.currentFiles];
        selectedPaths = new Set(newTab.selectedPaths);
        focusedPath = newTab.focusedPath;
        anchorPath = newTab.anchorPath;
        isSearchMode = newTab.isSearchMode || false;
        currentSearchQuery = newTab.searchQuery || '';
    } else {
        currentPath = '';
        historyBack = [];
        historyForward = [];
        currentFiles = [];
        selectedPaths.clear();
        focusedPath = null;
        anchorPath = null;
        isSearchMode = false;
        currentSearchQuery = '';
    }
    renderTabs();
    if (isSearchMode) {
        showSearchView(currentSearchQuery);
    } else {
        hideSearchView();
        refreshView(false);
    }
    updateNavButtons();
    updateAddressBar();
}

function closeTab(tabId) {
    if (tabs.length <= 1) return;
    const index = tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;
    tabs.splice(index, 1);
    if (tabId === activeTabId) { const newActive = tabs[Math.min(index, tabs.length - 1)]; switchTab(newActive.id); } else renderTabs();
}

function renderTabs() {
    let html = '';
    tabs.forEach(tab => { const activeClass = tab.id === activeTabId ? 'active' : ''; html += `<div class="tab ${activeClass}" data-tab-id="${tab.id}"><span class="tab-title">${tab.title}</span><span class="close-tab" data-tab-id="${tab.id}" title="关闭标签"><i class="fas fa-times"></i></span></div>`; });
    tabBar.innerHTML = html + '<div class="add-tab" id="addTabBtn" title="新建标签页 (Ctrl+T)"><i class="fas fa-plus"></i></div>';
    document.querySelectorAll('.tab').forEach(tabDiv => { tabDiv.addEventListener('click', (e) => { if (e.target.classList.contains('close-tab') || e.target.closest('.close-tab')) return; const tid = tabDiv.dataset.tabId; switchTab(tid); }); });
    document.querySelectorAll('.close-tab').forEach(closeSpan => { closeSpan.addEventListener('click', (e) => { e.stopPropagation(); const tid = closeSpan.dataset.tabId; closeTab(tid); }); });
    document.getElementById('addTabBtn').addEventListener('click', () => { const newId = createTab('此电脑'); switchTab(newId); navigateTo(''); });
}

function updateTabTitle(path) {
    if (!activeTabId) return;
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) { let title = path ? path.split('\\').pop() || path : '此电脑'; if (title.length > 20) title = title.substring(0, 17) + '...'; tab.title = title; renderTabs(); }
}

function saveCurrentTabState() {
    if (!activeTabId) return;
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) {
        tab.currentPath = currentPath;
        tab.historyBack = [...historyBack];
        tab.historyForward = [...historyForward];
        tab.currentFiles = [...currentFiles];
        tab.selectedPaths = new Set(selectedPaths);
        tab.focusedPath = focusedPath;
        tab.anchorPath = anchorPath;
        tab.isSearchMode = isSearchMode;
        tab.searchQuery = currentSearchQuery;
    }
}

// ---------- 搜索视图 ----------
function showSearchView(query) {
    isSearchMode = true;
    currentSearchQuery = query;
    listView.style.display = 'none';
    gridView.style.display = 'none';
    searchIframeContainer.style.display = 'block';
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&form=QBLH&sp=-1&lq=0&pq=${encodeURIComponent(query)}&sc=0-0&qs=n&sk=&cvid=`;
    bingFrame.src = searchUrl;
    updateStatusBar(`正在搜索: ${query}`, true);
    saveCurrentTabState();
}

function hideSearchView() {
    isSearchMode = false;
    searchIframeContainer.style.display = 'none';
    if (viewMode === 'list') listView.style.display = 'block';
    else gridView.style.display = 'grid';
}

// ---------- 工具函数 ----------
function showError(msg) { errorToast.style.display = 'block'; errorToast.innerText = msg; setTimeout(() => { errorToast.style.display = 'none'; }, 3000); updateStatusBar('错误', true); }
function setStatus(text) { updateStatusBar(text, true); }
function formatSize(bytes) { if (bytes === 0) return '-'; const units = ['B', 'KB', 'MB', 'GB', 'TB']; const k = 1024; const i = Math.floor(Math.log(bytes) / Math.log(k)); return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + units[i]; }
function getParentPath(path) { if (!path) return null; if (/^[A-Za-z]:\\$/.test(path) || path === '\\' || path === '/') return path; let cleaned = path.replace(/\\$/, ''); let lastSep = cleaned.lastIndexOf('\\'); if (lastSep === -1) return null; let parent = cleaned.substring(0, lastSep); if (/^[A-Za-z]:$/.test(parent)) parent += '\\'; return parent; }
function getFileIconInfo(filename, isDir) { if (isDir) return { icon: 'fa-folder', color: 'var(--folder-icon)' }; const ext = filename.split('.').pop().toLowerCase(); if (['jpg','jpeg','png','gif','bmp','svg','webp','ico'].includes(ext)) return { icon: 'fa-file-image', color: '#64b5f6' }; if (['mp4','avi','mkv','mov','wmv','flv','webm','m4v'].includes(ext)) return { icon: 'fa-file-video', color: '#ba68c8' }; if (['mp3','wav','flac','aac','ogg','m4a'].includes(ext)) return { icon: 'fa-file-audio', color: '#f06292' }; if (['pdf'].includes(ext)) return { icon: 'fa-file-pdf', color: '#81c784' }; if (['doc','docx'].includes(ext)) return { icon: 'fa-file-word', color: '#81c784' }; if (['txt','md','rtf','odt'].includes(ext)) return { icon: 'fa-file-lines', color: '#81c784' }; if (['xls','xlsx','csv','ods'].includes(ext)) return { icon: 'fa-file-excel', color: '#4caf50' }; if (['ppt','pptx','odp'].includes(ext)) return { icon: 'fa-file-powerpoint', color: '#ff8a65' }; if (['zip','rar','7z','tar','gz','bz2'].includes(ext)) return { icon: 'fa-file-zipper', color: '#ffb74d' }; if (['exe','msi','bat','cmd','ps1'].includes(ext)) return { icon: 'fa-file', color: '#e57373' }; if (['html','css','js','py','cpp','c','java','php','rb','go','rs'].includes(ext)) return { icon: 'fa-file-code', color: '#4dd0e1' }; return { icon: 'fa-file', color: 'var(--icon-color)' }; }
function updateNavButtons() { backBtn.disabled = historyBack.length === 0; forwardBtn.disabled = historyForward.length === 0; upBtn.disabled = !currentPath; }
function updateAddressBar() { addressInput.value = currentPath || '此电脑'; }
function getVisiblePathsInOrder() { const items = document.querySelectorAll('#listView tbody tr, #gridView .grid-item'); return Array.from(items).map(el => decodeURIComponent(el.dataset.path)); }
function getItemElementByPath(path) { return document.querySelector(`[data-path="${encodeURIComponent(path)}"]`); }
function clearSelection() { selectedPaths.clear(); document.querySelectorAll('.list-view tr.selected, .grid-item.selected').forEach(el => el.classList.remove('selected')); }
function clearFocus() { document.querySelectorAll('.list-view tr.focused, .grid-item.focused').forEach(el => el.classList.remove('focused')); focusedPath = null; }
function setFocus(path) { clearFocus(); focusedPath = path; const element = getItemElementByPath(path); if (element) { element.classList.add('focused'); element.scrollIntoView({ block: 'nearest', behavior: 'auto' }); } }
function selectRange(fromPath, toPath) { const paths = getVisiblePathsInOrder(); const fromIdx = paths.indexOf(fromPath); const toIdx = paths.indexOf(toPath); if (fromIdx === -1 || toIdx === -1) return; const start = Math.min(fromIdx, toIdx); const end = Math.max(fromIdx, toIdx); clearSelection(); for (let i = start; i <= end; i++) { const path = paths[i]; selectedPaths.add(path); const el = getItemElementByPath(path); if (el) el.classList.add('selected'); } }
function handleItemClick(event, path, element) { if (isDragging) return; const isCtrl = event.ctrlKey || event.metaKey; const isShift = event.shiftKey; if (isShift) { if (anchorPath) selectRange(anchorPath, path); else if (focusedPath) selectRange(focusedPath, path); else { clearSelection(); selectedPaths.add(path); element.classList.add('selected'); anchorPath = path; } setFocus(path); } else if (isCtrl) { if (selectedPaths.has(path)) { selectedPaths.delete(path); element.classList.remove('selected'); } else { selectedPaths.add(path); element.classList.add('selected'); } setFocus(path); anchorPath = path; } else { clearSelection(); selectedPaths.add(path); element.classList.add('selected'); setFocus(path); anchorPath = path; } setStatus(selectedPaths.size ? `已选中 ${selectedPaths.size} 个项目` : ''); saveCurrentTabState(); }

// ---------- 渲染相关 ----------
function cancelChunkRendering() { if (renderingChunkTimer) { clearTimeout(renderingChunkTimer); renderingChunkTimer = null; } renderingChunkFiles = []; loadingOverlay.style.display = 'none'; }
function createFileElement(file, viewMode) {
    let iconInfo = !currentPath ? { icon: 'fa-hdd', color: 'var(--icon-color)' } : getFileIconInfo(file.name, file.is_dir);
    const { icon, color } = iconInfo;
    const encodedPath = encodeURIComponent(file.path);
    const isDir = file.is_dir;
    const animClass = animationsEnabled ? 'faa faa-bounce' : '';
    if (viewMode === 'list') {
        const tr = document.createElement('tr');
        tr.dataset.path = encodedPath;
        tr.dataset.isDir = isDir;
        tr.draggable = true;
        const sizeStr = isDir ? '-' : formatSize(file.size);
        tr.innerHTML = `<td class="file-icon"><i class="fas ${icon} ${animClass}" style="color: ${color};"></i></td>
                        <td class="file-name" title="${file.name}">${file.name}</td>
                        <td class="file-modified">${file.modified}</td>
                        <td class="file-type">${file.type}</td>
                        <td class="file-size">${sizeStr}</td>`;
        return tr;
    } else {
        const div = document.createElement('div');
        div.className = 'grid-item';
        div.dataset.path = encodedPath;
        div.dataset.isDir = isDir;
        div.draggable = true;
        div.innerHTML = `<div class="icon"><i class="fas ${icon} ${animClass}" style="color: ${color};"></i></div><div class="name" title="${file.name}">${file.name}</div>`;
        return div;
    }
}
function applySelectionToElements(elements) { elements.forEach(el => { const path = decodeURIComponent(el.dataset.path); if (selectedPaths.has(path)) el.classList.add('selected'); if (focusedPath === path) el.classList.add('focused'); }); }
function renderChunk() { if (renderingChunkIndex >= renderingChunkFiles.length) { cancelChunkRendering(); bindItemEvents(); setStatus(`已加载 ${renderingChunkFiles.length} 个项目`); return; } const fragment = document.createDocumentFragment(); const end = Math.min(renderingChunkIndex + CHUNK_SIZE, renderingChunkFiles.length); const elements = []; for (let i = renderingChunkIndex; i < end; i++) { const file = renderingChunkFiles[i]; const el = createFileElement(file, renderingChunkViewMode); fragment.appendChild(el); elements.push(el); } if (renderingChunkViewMode === 'list') fileListBody.appendChild(fragment); else gridView.appendChild(fragment); applySelectionToElements(elements); renderingChunkIndex = end; renderingChunkTimer = setTimeout(renderChunk, CHUNK_DELAY); }
function startChunkRendering(files, viewMode) { cancelChunkRendering(); renderingChunkFiles = files; renderingChunkViewMode = viewMode; renderingChunkIndex = 0; if (viewMode === 'list') { listView.style.display = 'block'; gridView.style.display = 'none'; fileListBody.innerHTML = ''; } else { listView.style.display = 'none'; gridView.style.display = 'grid'; gridView.innerHTML = ''; } if (files.length > CHUNK_SIZE * 2) loadingOverlay.style.display = 'flex'; renderChunk(); }
function refreshView(animateItems = false) {
    if (isSearchMode) return;
    animationTimeouts.forEach(id => clearTimeout(id));
    animationTimeouts = [];
    document.querySelectorAll('.item-enter').forEach(el => el.classList.remove('item-enter'));
    if (!animationsEnabled) animateItems = false;
    const files = currentFiles;
    if (files.length > 200) startChunkRendering(files, viewMode);
    else {
        cancelChunkRendering();
        const animClass = animationsEnabled ? 'faa faa-bounce' : '';
        if (viewMode === 'list') {
            listView.style.display = 'block';
            gridView.style.display = 'none';
            let html = '';
            for (let f of files) {
                let iconInfo = !currentPath ? { icon: 'fa-hdd', color: 'var(--icon-color)' } : getFileIconInfo(f.name, f.is_dir);
                const { icon, color } = iconInfo;
                const sizeStr = f.is_dir ? '-' : formatSize(f.size);
                const animateClass = animateItems ? ' item-enter' : '';
                const encodedPath = encodeURIComponent(f.path);
                html += `<tr class="${animateClass}" data-path="${encodedPath}" data-is-dir="${f.is_dir}" draggable="true">
                            <td class="file-icon"><i class="fas ${icon} ${animClass}" style="color: ${color};"></i></td>
                            <td class="file-name" title="${f.name}">${f.name}</td>
                            <td class="file-modified">${f.modified}</td>
                            <td class="file-type">${f.type}</td>
                            <td class="file-size">${sizeStr}</td>
                          </tr>`;
            }
            fileListBody.innerHTML = html;
        } else {
            listView.style.display = 'none';
            gridView.style.display = 'grid';
            let html = '';
            for (let f of files) {
                let iconInfo = !currentPath ? { icon: 'fa-hdd', color: 'var(--icon-color)' } : getFileIconInfo(f.name, f.is_dir);
                const { icon, color } = iconInfo;
                const animateClass = animateItems ? ' item-enter' : '';
                const encodedPath = encodeURIComponent(f.path);
                html += `<div class="grid-item${animateClass}" data-path="${encodedPath}" data-is-dir="${f.is_dir}" draggable="true">
                            <div class="icon"><i class="fas ${icon} ${animClass}" style="color: ${color};"></i></div>
                            <div class="name" title="${f.name}">${f.name}</div>
                         </div>`;
            }
            gridView.innerHTML = html;
        }
        bindItemEvents();
        document.querySelectorAll('.list-view tr, .grid-item').forEach(el => {
            const path = decodeURIComponent(el.dataset.path);
            if (selectedPaths.has(path)) el.classList.add('selected');
            if (focusedPath === path) el.classList.add('focused');
        });
        if (animateItems) {
            const items = document.querySelectorAll('#listView tbody tr.item-enter, #gridView .grid-item.item-enter');
            items.forEach((item, index) => {
                const tid = setTimeout(() => { item.classList.remove('item-enter'); }, index * 30);
                animationTimeouts.push(tid);
            });
        }
    }
    saveCurrentTabState();
}
function setViewMode(mode) { if (mode === viewMode) return; viewMode = mode; fileListContainer.classList.add('fade-out'); setTimeout(() => { if (!isSearchMode) refreshView(false); fileListContainer.classList.remove('fade-out'); }, 200); setStatus(`视图已切换为 ${mode === 'list' ? '列表' : '图标'}`); }
function bindItemEvents() { document.querySelectorAll('#listView tbody tr, #gridView .grid-item').forEach(item => { item.removeEventListener('click', onItemClick); item.removeEventListener('dblclick', onItemDoubleClick); item.removeEventListener('contextmenu', onItemContextMenu); item.removeEventListener('dragstart', handleDragStart); item.removeEventListener('dragend', handleDragEnd); item.addEventListener('click', onItemClick); item.addEventListener('dblclick', onItemDoubleClick); item.addEventListener('contextmenu', onItemContextMenu); item.addEventListener('dragstart', handleDragStart); item.addEventListener('dragend', handleDragEnd); }); document.querySelectorAll('#listView tbody tr[data-is-dir="true"], #gridView .grid-item[data-is-dir="true"]').forEach(folder => { folder.removeEventListener('dragover', handleDragOver); folder.removeEventListener('drop', handleDrop); folder.addEventListener('dragover', handleDragOver); folder.addEventListener('drop', handleDrop); }); document.querySelectorAll('.drive-item').forEach(drive => { drive.removeEventListener('dragover', handleDragOver); drive.removeEventListener('drop', handleDropOnDrive); drive.addEventListener('dragover', handleDragOver); drive.addEventListener('drop', handleDropOnDrive); }); }
function handleDragStart(e) { const item = e.target.closest('tr, .grid-item'); if (!item) return; const path = decodeURIComponent(item.dataset.path); if (!selectedPaths.has(path)) { clearSelection(); selectedPaths.add(path); item.classList.add('selected'); setFocus(path); anchorPath = path; } const pathsList = Array.from(selectedPaths); e.dataTransfer.setData('text/plain', JSON.stringify(pathsList)); e.dataTransfer.effectAllowed = 'move'; setStatus(`正在拖拽 ${pathsList.length} 个项目`); }
function handleDragEnd(e) { setStatus('就绪'); }
function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
async function handleDrop(e) { e.preventDefault(); const target = e.target.closest('tr, .grid-item'); if (!target) return; const destPath = decodeURIComponent(target.dataset.path); const isDir = target.dataset.isDir === 'true'; if (!isDir) return; const data = e.dataTransfer.getData('text/plain'); if (!data) return; const paths = JSON.parse(data); const operation = e.ctrlKey ? 'copy' : 'cut'; try { if (operation === 'copy') await pywebview.api.copy_items(paths); else await pywebview.api.cut_items(paths); const result = await pywebview.api.paste_items(destPath); setStatus(result[result.length-1] || '操作完成'); navigateTo(currentPath); } catch (err) { showError('拖拽操作失败: ' + err.message); } }
async function handleDropOnDrive(e) { e.preventDefault(); const driveItem = e.target.closest('.drive-item'); if (!driveItem) return; const destPath = driveItem.dataset.path; const data = e.dataTransfer.getData('text/plain'); if (!data) return; const paths = JSON.parse(data); const operation = e.ctrlKey ? 'copy' : 'cut'; try { if (operation === 'copy') await pywebview.api.copy_items(paths); else await pywebview.api.cut_items(paths); const result = await pywebview.api.paste_items(destPath); setStatus(result[result.length-1] || '操作完成'); navigateTo(currentPath); } catch (err) { showError('拖拽操作失败: ' + err.message); } }
function onItemClick(e) { const target = e.currentTarget; const path = decodeURIComponent(target.dataset.path); handleItemClick(e, path, target); }
async function onItemDoubleClick(e) { const target = e.currentTarget; const path = decodeURIComponent(target.dataset.path); const isDir = target.dataset.isDir === 'true'; if (isDir) navigateTo(path); else { try { await pywebview.api.open_file(path); } catch (err) { showError('打开失败: ' + err.message); } } }
function onItemContextMenu(e) { e.preventDefault(); const target = e.currentTarget; const path = decodeURIComponent(target.dataset.path); const isDir = target.dataset.isDir === 'true'; if (!selectedPaths.has(path)) { clearSelection(); selectedPaths.add(path); target.classList.add('selected'); setFocus(path); anchorPath = path; } contextTargetPath = path; contextTargetIsDir = isDir; contextMenuType = 'file'; buildContextMenu(); showContextMenu(e.pageX, e.pageY); }
fileListContainer.addEventListener('contextmenu', (e) => { if (e.target.closest('tr, .grid-item')) return; e.preventDefault(); contextMenuType = 'blank'; buildContextMenu(); showContextMenu(e.pageX, e.pageY); });
fileListContainer.addEventListener('click', (e) => { if (!e.target.closest('tr, .grid-item')) { if (ignoreNextBlankClick) { ignoreNextBlankClick = false; return; } clearSelection(); clearFocus(); anchorPath = null; saveCurrentTabState(); } });
let contextTargetPath = '', contextTargetIsDir = false, contextMenuType = 'file';
function showContextMenu(x, y) { contextMenu.style.display = 'block'; contextMenu.style.left = x + 'px'; contextMenu.style.top = y + 'px'; const menuWidth = contextMenu.offsetWidth; const menuHeight = contextMenu.offsetHeight; const winWidth = window.innerWidth; const winHeight = window.innerHeight; if (x + menuWidth > winWidth) contextMenu.style.left = (winWidth - menuWidth - 5) + 'px'; if (y + menuHeight > winHeight) contextMenu.style.top = (winHeight - menuHeight - 5) + 'px'; if (parseInt(contextMenu.style.left) < 0) contextMenu.style.left = '5px'; if (parseInt(contextMenu.style.top) < 0) contextMenu.style.top = '5px'; }
async function buildContextMenu() {
    let items = [];
    if (contextMenuType === 'file') {
        items = [
            { icon: 'fa-play', label: '打开', action: 'open' },
            { type: 'separator' },
            { icon: 'fa-copy', label: '复制', action: 'copy' },
            { icon: 'fa-cut', label: '剪切', action: 'cut' },
            { icon: 'fa-trash-alt', label: '删除', action: 'delete' },
            { icon: 'fa-pencil-alt', label: '重命名', action: 'rename' },
            { type: 'separator' },
            { icon: 'fa-info-circle', label: '属性', action: 'properties' }
        ];
        if (contextTargetIsDir) items.splice(1, 0, { icon: 'fa-folder-open', label: '在新标签页中打开', action: 'newTab' });
    } else {
        items = [
            {
                type: 'submenu',
                label: '新建',
                items: [
                    { icon: 'fa-folder', label: '文件夹', action: 'newfolder' },
                    { icon: 'fa-file-alt', label: '文本文档', action: 'newtext' },
                    { icon: 'fa-file-code', label: 'Python文件', action: 'newpython' },
                    { icon: 'fa-file', label: '自定义文件...', action: 'newcustom' }
                ]
            },
            { type: 'separator' },
            { icon: 'fa-sync-alt', label: '刷新', action: 'refresh' }
        ];
        try {
            const status = await pywebview.api.get_clipboard_status();
            clipboardStatus = status;
            if (status.operation && status.count > 0 && currentPath) items.push({ icon: 'fa-paste', label: '粘贴', action: 'paste' });
        } catch (err) { console.warn(err); }
    }
    let html = '';
    for (let item of items) {
        if (item.type === 'separator') { html += '<li class="separator"></li>'; }
        else if (item.type === 'submenu') {
            html += '<li class="submenu"><a><i class="fas fa-plus"></i> ' + item.label + '</a><ul>';
            for (let sub of item.items) { html += `<li data-action="${sub.action}"><i class="fas ${sub.icon}"></i> ${sub.label}</li>`; }
            html += '</ul></li>';
        } else { html += `<li data-action="${item.action}"><i class="fas ${item.icon}"></i> ${item.label}</li>`; }
    }
    contextMenuList.innerHTML = html;
    document.querySelectorAll('#contextMenuList li').forEach(li => { li.removeEventListener('click', handleContextMenuClick); li.addEventListener('click', handleContextMenuClick); });
}
async function handleContextMenuClick(e) {
    const action = e.currentTarget.dataset.action;
    hideContextMenu();
    if (contextMenuType === 'file') {
        let targetPaths = Array.from(selectedPaths);
        if (targetPaths.length === 0) targetPaths = [contextTargetPath];
        switch (action) {
            case 'open':
                const firstPath = targetPaths[0];
                const firstIsDir = contextTargetIsDir;
                if (firstIsDir) navigateTo(firstPath);
                else { try { await pywebview.api.open_file(firstPath); } catch (err) { showError('打开失败: ' + err.message); } }
                break;
            case 'newTab':
                if (!contextTargetIsDir) break;
                const newId = createTab('新标签');
                switchTab(newId);
                navigateTo(contextTargetPath);
                break;
            case 'copy':
                try { await pywebview.api.copy_items(targetPaths); setStatus(`已复制 ${targetPaths.length} 个项目`); } catch (err) { showError('复制失败: ' + err.message); }
                break;
            case 'cut':
                try { await pywebview.api.cut_items(targetPaths); setStatus(`已剪切 ${targetPaths.length} 个项目`); } catch (err) { showError('剪切失败: ' + err.message); }
                break;
            case 'delete':
                if (targetPaths.length === 0) { showError('没有选中任何项目'); return; }
                const first = targetPaths[0];
                const name = first.split('\\').pop();
                const confirm = await showCustomConfirm(`确定要删除 "${name}" 等 ${targetPaths.length} 个项目吗？`);
                if (confirm) {
                    try {
                        for (let p of targetPaths) { await pywebview.api.delete_path(p); }
                        navigateTo(currentPath);
                    } catch (err) { showError('删除失败: ' + err.message); }
                }
                break;
            case 'rename':
                if (targetPaths.length !== 1) { showError('请选中单个项目进行重命名'); return; }
                const oldName = targetPaths[0].split('\\').pop();
                const newName = await showCustomPrompt('请输入新名称:', oldName);
                if (newName && newName !== oldName) {
                    try { await pywebview.api.rename_path(targetPaths[0], newName); navigateTo(currentPath); } catch (err) { showError('重命名失败: ' + err.message); }
                }
                break;
            case 'properties':
                if (targetPaths.length !== 1) { showError('请选中单个项目查看属性'); return; }
                try {
                    const props = await pywebview.api.get_properties(targetPaths[0]);
                    document.getElementById('propName').innerText = props.name;
                    document.getElementById('propPath').innerText = props.path;
                    document.getElementById('propType').innerText = props.is_dir ? '文件夹' : '文件';
                    document.getElementById('propSize').innerText = props.is_dir ? '-' : formatSize(props.size);
                    document.getElementById('propCreated').innerText = props.created;
                    document.getElementById('propModified').innerText = props.modified;
                    document.getElementById('propAccessed').innerText = props.accessed;
                    propCard.style.display = 'block';
                } catch (err) { showError('获取属性失败: ' + err.message); }
                break;
        }
    } else {
        switch (action) {
            case 'refresh':
                if (currentPath) navigateTo(currentPath); else navigateTo('');
                break;
            case 'newfolder':
                if (!currentPath) { showError('请在文件夹内创建'); return; }
                const folderName = await showCustomPrompt('请输入新文件夹名称:', '新建文件夹');
                if (!folderName) return;
                if (isCreatingFolder) return;
                isCreatingFolder = true;
                try { await pywebview.api.create_folder(currentPath, folderName); await navigateTo(currentPath); }
                catch (err) { showError('创建失败: ' + err.message); }
                finally { isCreatingFolder = false; }
                break;
            case 'newtext':
            case 'newpython':
                if (!currentPath) { showError('请在文件夹内创建'); return; }
                let ext = action === 'newtext' ? '.txt' : '.py';
                let defaultName = action === 'newtext' ? '新建文本文档' : '新建Python文件';
                let fileName = await showCustomPrompt('请输入文件名:', defaultName + ext);
                if (!fileName) return;
                if (!fileName.toLowerCase().endsWith(ext)) { fileName += ext; }
                try { await pywebview.api.create_file(currentPath, fileName); await navigateTo(currentPath); }
                catch (err) { showError('创建失败: ' + err.message); }
                break;
            case 'newcustom':
                if (!currentPath) { showError('请在文件夹内创建'); return; }
                if (isCreatingFile) return;
                isCreatingFile = true;
                const customFileName = await showCustomPrompt('请输入文件名（包含扩展名）:', '新文件.txt');
                isCreatingFile = false;
                if (!customFileName) return;
                try { await pywebview.api.create_file(currentPath, customFileName); await navigateTo(currentPath); } catch (err) { showError('创建文件失败: ' + err.message); }
                break;
            case 'paste':
                if (!currentPath) { showError('不能在“此电脑”粘贴'); return; }
                try { const result = await pywebview.api.paste_items(currentPath); if (result.length > 0) setStatus(result[result.length-1]); navigateTo(currentPath); }
                catch (err) { showError('粘贴失败: ' + err.message); }
                break;
        }
    }
}
function hideContextMenu() { contextMenu.style.display = 'none'; }
document.getElementById('closePropCard').addEventListener('click', () => { propCard.style.display = 'none'; });
window.addEventListener('click', (e) => { if (!contextMenu.contains(e.target) && !propCard.contains(e.target) && !settingsPanel.contains(e.target)) { hideContextMenu(); if (propCard.style.display === 'block' && e.target.id !== 'menuProperties') propCard.style.display = 'none'; } });

// ---------- 壁纸 ----------
function setDefaultWallpaper() { document.body.style.backgroundImage = ''; document.body.classList.remove('wallpaper-bing', 'wallpaper-custom'); document.body.classList.add('wallpaper-default'); }
async function setBingWallpaper() { try { const imageUrl = await pywebview.api.get_bing_wallpaper(); document.body.style.backgroundImage = `url('${imageUrl}')`; document.body.style.backgroundSize = 'cover'; document.body.style.backgroundPosition = 'center'; document.body.style.backgroundRepeat = 'no-repeat'; document.body.classList.remove('wallpaper-default', 'wallpaper-custom'); document.body.classList.add('wallpaper-bing'); } catch (err) { showError('获取必应壁纸失败: ' + err.message); document.querySelector('input[value="default"]').checked = true; setDefaultWallpaper(); } }

// ---------- 设置持久化 ----------
async function saveCurrentSettings() {
    const animations = animationsEnabled;
    let wallpaper = 'default';
    const checkedRadio = document.querySelector('input[name="wallpaper"]:checked');
    if (checkedRadio) wallpaper = checkedRadio.value;
    const animSpeed = document.getElementById('animSpeedSlider').value;
    const easing = document.getElementById('easingSelect').value;
    const listAnim = document.getElementById('listAnimToggle').checked;
    const gridAnim = document.getElementById('gridAnimToggle').checked;
    const navAnim = document.getElementById('navAnimToggle').checked;
    const bgAnim = document.getElementById('bgAnimToggle').checked;
    const settings = { animations, translucent: document.getElementById('translucentToggle').checked, wallpaper, wallpaper_custom_path: window._lastCustomWallpaperPath || '', anim_speed: animSpeed, anim_easing: easing, anim_list: listAnim, anim_grid: gridAnim, anim_nav: navAnim, anim_bg: bgAnim };
    try { await pywebview.api.save_settings(settings); } catch (err) { console.error(err); }
}
async function applySettings(settings) {
    const translucentToggle = document.getElementById('translucentToggle');
    if (settings.translucent) { document.body.classList.add('translucent-mode'); if (translucentToggle) translucentToggle.checked = true; } else { document.body.classList.remove('translucent-mode'); if (translucentToggle) translucentToggle.checked = false; }
    animationsEnabled = settings.animations;
    animationToggle.checked = animationsEnabled;
    if (animationsEnabled) document.body.classList.add('animations-enabled');
    else document.body.classList.remove('animations-enabled');
    syncDetailedControlsState(animationsEnabled);
    const speed = settings.anim_speed !== undefined ? settings.anim_speed : 50;
    const easing = settings.anim_easing || 'ease';
    const listAnim = settings.anim_list !== undefined ? settings.anim_list : true;
    const gridAnim = settings.anim_grid !== undefined ? settings.anim_grid : true;
    const navAnim = settings.anim_nav !== undefined ? settings.anim_nav : true;
    const bgAnim = settings.anim_bg !== undefined ? settings.anim_bg : true;
    document.getElementById('animSpeedSlider').value = speed;
    document.getElementById('easingSelect').value = easing;
    document.getElementById('listAnimToggle').checked = listAnim;
    document.getElementById('gridAnimToggle').checked = gridAnim;
    document.getElementById('navAnimToggle').checked = navAnim;
    document.getElementById('bgAnimToggle').checked = bgAnim;
    updateAnimationCSS(speed, easing, listAnim, gridAnim, navAnim, bgAnim);
    const wallpaper = settings.wallpaper;
    document.querySelectorAll('input[name="wallpaper"]').forEach(radio => { if (radio.value === wallpaper) radio.checked = true; });
    if (wallpaper === 'default') { setDefaultWallpaper(); chooseWallpaperBtn.style.display = 'none'; }
    else if (wallpaper === 'bing') { setBingWallpaper(); chooseWallpaperBtn.style.display = 'none'; }
    else if (wallpaper === 'custom') {
        if (settings.wallpaper_custom_path) {
            window._lastCustomWallpaperPath = settings.wallpaper_custom_path;
            const fileUrl = 'file:///' + settings.wallpaper_custom_path.replace(/\\/g, '/');
            document.body.style.backgroundImage = `url('${fileUrl}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.classList.remove('wallpaper-default', 'wallpaper-bing');
            document.body.classList.add('wallpaper-custom');
        } else { setDefaultWallpaper(); }
        chooseWallpaperBtn.style.display = 'inline-block';
    }
}
function updateAnimationCSS(speed, easing, listAnim, gridAnim, navAnim, bgAnim) {
    const root = document.documentElement;
    let duration;
    if (speed == 0) duration = 0.01;
    else if (speed <= 25) duration = 0.1;
    else if (speed <= 50) duration = 0.3;
    else if (speed <= 75) duration = 0.6;
    else duration = 1.0;
    root.style.setProperty('--anim-duration', duration + 's');
    root.style.setProperty('--anim-easing', easing);
    root.style.setProperty('--list-anim-enabled', listAnim ? '1' : '0');
    root.style.setProperty('--grid-anim-enabled', gridAnim ? '1' : '0');
    root.style.setProperty('--nav-anim-enabled', navAnim ? '1' : '0');
    root.style.setProperty('--bg-anim-enabled', bgAnim ? '1' : '0');
}
function getDetailedAnimControls() { return { speedSlider: document.getElementById('animSpeedSlider'), easingSelect: document.getElementById('easingSelect'), listAnim: document.getElementById('listAnimToggle'), gridAnim: document.getElementById('gridAnimToggle'), navAnim: document.getElementById('navAnimToggle'), bgAnim: document.getElementById('bgAnimToggle'), previewBtn: document.getElementById('previewBtn') }; }
function syncDetailedControlsState(enabled) { const controls = getDetailedAnimControls(); if (controls.speedSlider) controls.speedSlider.disabled = !enabled; if (controls.easingSelect) controls.easingSelect.disabled = !enabled; if (controls.listAnim) controls.listAnim.disabled = !enabled; if (controls.gridAnim) controls.gridAnim.disabled = !enabled; if (controls.navAnim) controls.navAnim.disabled = !enabled; if (controls.bgAnim) controls.bgAnim.disabled = !enabled; if (controls.previewBtn) controls.previewBtn.disabled = !enabled; }
function playAnimationPreview() {
    const previewItem = document.getElementById('previewItem');
    const speed = document.getElementById('animSpeedSlider').value;
    const easing = document.getElementById('easingSelect').value;
    let duration;
    if (speed == 0) duration = 0.01;
    else if (speed <= 25) duration = 0.1;
    else if (speed <= 50) duration = 0.3;
    else if (speed <= 75) duration = 0.6;
    else duration = 1.0;
    previewItem.style.transition = 'none';
    previewItem.style.transform = 'translateX(0)';
    previewItem.style.opacity = '1';
    void previewItem.offsetWidth;
    previewItem.style.transition = `transform ${duration}${easing}, opacity ${duration}${easing}`;
    previewItem.style.transform = 'translateX(200px)';
    previewItem.style.opacity = '0.5';
    setTimeout(() => { previewItem.style.transform = 'translateX(0)'; previewItem.style.opacity = '1'; }, duration * 1000 + 100);
}
function wallpaperChangeHandler(e) {
    const val = e.target.value;
    if (val === 'default') { setDefaultWallpaper(); chooseWallpaperBtn.style.display = 'none'; window._lastCustomWallpaperPath = ''; saveCurrentSettings(); }
    else if (val === 'bing') { chooseWallpaperBtn.style.display = 'none'; setBingWallpaper().then(() => { window._lastCustomWallpaperPath = ''; saveCurrentSettings(); }); }
    else if (val === 'custom') { chooseWallpaperBtn.style.display = 'inline-block'; if (window._lastCustomWallpaperPath) { const fileUrl = 'file:///' + window._lastCustomWallpaperPath.replace(/\\/g, '/'); document.body.style.backgroundImage = `url('${fileUrl}')`; document.body.style.backgroundSize = 'cover'; document.body.style.backgroundPosition = 'center'; document.body.classList.remove('wallpaper-default', 'wallpaper-bing'); document.body.classList.add('wallpaper-custom'); } saveCurrentSettings(); }
}
async function chooseWallpaperHandler() {
    try {
        const filePath = await pywebview.api.choose_wallpaper_file();
        if (filePath) {
            const base64Data = await pywebview.api.read_file_as_base64(filePath);
            if (base64Data) {
                document.body.style.backgroundImage = `url('${base64Data}')`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundRepeat = 'no-repeat';
                document.body.classList.remove('wallpaper-default', 'wallpaper-bing');
                document.body.classList.add('wallpaper-custom');
                window._lastCustomWallpaperPath = filePath;
                document.querySelector('input[value="custom"]').checked = true;
                await saveCurrentSettings();
                setStatus('壁纸已应用');
            } else { showError('无法读取图片文件'); document.querySelector('input[value="default"]').checked = true; setDefaultWallpaper(); }
        }
    } catch (err) { showError('选择壁纸失败: ' + err.message); }
}
function initWallpaperOptions() { wallpaperRadios = document.querySelectorAll('input[name="wallpaper"]'); chooseWallpaperBtn = document.getElementById('chooseWallpaperBtn'); wallpaperRadios.forEach(radio => { radio.removeEventListener('change', wallpaperChangeHandler); radio.addEventListener('change', wallpaperChangeHandler); }); if (chooseWallpaperBtn) { chooseWallpaperBtn.removeEventListener('click', chooseWallpaperHandler); chooseWallpaperBtn.addEventListener('click', chooseWallpaperHandler); } }
function initTranslucentControls() { const translucentToggle = document.getElementById('translucentToggle'); if (translucentToggle) { translucentToggle.addEventListener('change', (e) => { if (e.target.checked) document.body.classList.add('translucent-mode'); else document.body.classList.remove('translucent-mode'); saveCurrentSettings(); }); } }
function initAnimationControls() {
    const speedSlider = document.getElementById('animSpeedSlider');
    const easingSelect = document.getElementById('easingSelect');
    const listToggle = document.getElementById('listAnimToggle');
    const gridToggle = document.getElementById('gridAnimToggle');
    const navToggle = document.getElementById('navAnimToggle');
    const bgToggle = document.getElementById('bgAnimToggle');
    const previewBtn = document.getElementById('previewBtn');
    const animationToggle = document.getElementById('animationToggle');
    if (animationToggle) {
        animationToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            animationsEnabled = enabled;
            if (enabled) {
                document.body.classList.add('animations-enabled');
                // 为所有已有图标添加动画类（仅限文件列表）
                document.querySelectorAll('#listView tbody .file-icon i, #gridView .icon i').forEach(icon => {
                    if (!icon.classList.contains('faa')) icon.classList.add('faa', 'faa-bounce');
                });
            } else {
                document.body.classList.remove('animations-enabled');
                // 移除动画类（仅限文件列表）
                document.querySelectorAll('#listView tbody .file-icon i, #gridView .icon i').forEach(icon => {
                    icon.classList.remove('faa', 'faa-bounce');
                });
            }
            syncDetailedControlsState(enabled);
            saveCurrentSettings();
        });
    }
    if (speedSlider) { speedSlider.addEventListener('input', (e) => { const speed = e.target.value; const easing = easingSelect.value; const listAnim = listToggle.checked; const gridAnim = gridToggle.checked; const navAnim = navToggle.checked; const bgAnim = bgToggle.checked; updateAnimationCSS(speed, easing, listAnim, gridAnim, navAnim, bgAnim); saveCurrentSettings(); }); }
    if (easingSelect) { easingSelect.addEventListener('change', (e) => { const speed = speedSlider.value; const easing = e.target.value; const listAnim = listToggle.checked; const gridAnim = gridToggle.checked; const navAnim = navToggle.checked; const bgAnim = bgToggle.checked; updateAnimationCSS(speed, easing, listAnim, gridAnim, navAnim, bgAnim); saveCurrentSettings(); }); }
    [listToggle, gridToggle, navToggle, bgToggle].forEach(toggle => { if (toggle) { toggle.addEventListener('change', () => { const speed = speedSlider.value; const easing = easingSelect.value; const listAnim = listToggle.checked; const gridAnim = gridToggle.checked; const navAnim = navToggle.checked; const bgAnim = bgToggle.checked; updateAnimationCSS(speed, easing, listAnim, gridAnim, navAnim, bgAnim); saveCurrentSettings(); }); } });
    if (previewBtn) previewBtn.addEventListener('click', playAnimationPreview);
}
settingsBtn.addEventListener('click', () => { settingsPanel.style.display = 'flex'; updateSettingsPanelState(); });
function closeSettingsPanel() { settingsPanel.style.display = 'none'; }
closeSettingsBtn.addEventListener('click', closeSettingsPanel);
closeSettingsFooterBtn.addEventListener('click', closeSettingsPanel);
function updateSettingsPanelState() { animationToggle.checked = animationsEnabled; const bodyClass = document.body.classList; if (bodyClass.contains('wallpaper-bing')) document.querySelector('input[value="bing"]').checked = true; else if (bodyClass.contains('wallpaper-custom')) document.querySelector('input[value="custom"]').checked = true; else document.querySelector('input[value="default"]').checked = true; chooseWallpaperBtn.style.display = document.querySelector('input[value="custom"]').checked ? 'inline-block' : 'none'; syncDetailedControlsState(animationsEnabled); }
document.querySelectorAll('.settings-sidebar li').forEach(li => { li.addEventListener('click', (e) => { document.querySelectorAll('.settings-sidebar li').forEach(l => l.classList.remove('active')); li.classList.add('active'); const tabId = li.dataset.tab; document.querySelectorAll('.settings-tab').forEach(tab => tab.classList.remove('active')); document.getElementById(tabId + '-tab').classList.add('active'); }); });

// ---------- 对话框函数 ----------
function showCustomConfirm(message) { return new Promise((resolve) => { dialogMessage.innerText = message; dialogInput.style.display = 'none'; dialogCancel.style.display = 'inline-block'; dialogConfirm.innerText = '确定'; dialogOverlay.style.display = 'flex'; const onConfirm = () => { cleanup(); resolve(true); }; const onCancel = () => { cleanup(); resolve(false); }; const cleanup = () => { dialogOverlay.style.display = 'none'; dialogConfirm.removeEventListener('click', onConfirm); dialogCancel.removeEventListener('click', onCancel); }; dialogConfirm.addEventListener('click', onConfirm, { once: true }); dialogCancel.addEventListener('click', onCancel, { once: true }); }); }
function showCustomPrompt(message, defaultValue = '') { return new Promise((resolve) => { dialogMessage.innerText = message; dialogInput.style.display = 'block'; dialogInput.value = defaultValue; dialogCancel.style.display = 'inline-block'; dialogConfirm.innerText = '确定'; dialogOverlay.style.display = 'flex'; dialogInput.focus(); const onConfirm = () => { cleanup(); resolve(dialogInput.value); }; const onCancel = () => { cleanup(); resolve(null); }; const cleanup = () => { dialogOverlay.style.display = 'none'; dialogConfirm.removeEventListener('click', onConfirm); dialogCancel.removeEventListener('click', onCancel); }; dialogConfirm.addEventListener('click', onConfirm, { once: true }); dialogCancel.addEventListener('click', onCancel, { once: true }); }); }
dialogOverlay.addEventListener('click', (e) => { if (e.target === dialogOverlay && dialogCancel.style.display !== 'none') { dialogOverlay.style.display = 'none'; } });

// Ctrl + 滚轮切换视图
window.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); setViewMode(e.deltaY < 0 ? 'grid' : 'list'); } }, { passive: false });

// 地址栏输入处理：路径或搜索
addressInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        let input = addressInput.value.trim();
        if (!input) return;
        const isPath = input.includes('\\') || input.includes(':') || input.includes('/') || input === '此电脑';
        if (isPath) {
            if (input === '此电脑') navigateTo('');
            else navigateTo(input);
        } else {
            showSearchView(input);
            saveCurrentTabState();
        }
    }
});

// 键盘快捷键
window.addEventListener('keydown', async (e) => {
    if (dialogOverlay.style.display === 'flex' || contextMenu.style.display === 'block') return;
    const key = e.key;
    const ctrl = e.ctrlKey;
    const shift = e.shiftKey;
    const alt = e.altKey;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    if (ctrl && key === 't') { e.preventDefault(); const newId = createTab('此电脑'); switchTab(newId); navigateTo(''); }
    else if (ctrl && key === 'w') { e.preventDefault(); if (tabs.length > 1) closeTab(activeTabId); }
    else if (alt && key === 'ArrowLeft' || key === 'Backspace') { e.preventDefault(); if (historyBack.length > 0) { const prev = historyBack.pop(); historyForward.push(currentPath); navigateTo(prev); } }
    else if (alt && key === 'ArrowRight') { e.preventDefault(); if (historyForward.length > 0) { const next = historyForward.pop(); historyBack.push(currentPath); navigateTo(next); } }
    else if (alt && key === 'ArrowUp') { e.preventDefault(); if (!currentPath) return; if (/^[A-Za-z]:\\$/.test(currentPath)) { navigateTo(''); } else { let parent = getParentPath(currentPath); if (parent && parent !== currentPath) navigateTo(parent); } }
    else if (key === 'F5') { e.preventDefault(); if (currentPath) navigateTo(currentPath); else navigateTo(''); }
    else if (ctrl && key === 'l' || alt && key === 'd') { e.preventDefault(); addressInput.focus(); addressInput.select(); }
    else if (key === 'Enter') { e.preventDefault(); let targetPath = null; if (selectedPaths.size > 0) { targetPath = Array.from(selectedPaths)[0]; } else if (focusedPath) { targetPath = focusedPath; } if (targetPath) { const element = getItemElementByPath(targetPath); const isDir = element ? element.dataset.isDir === 'true' : false; if (isDir) { navigateTo(targetPath); } else { try { await pywebview.api.open_file(targetPath); } catch (err) { showError('打开失败: ' + err.message); } } } }
    else if (key === 'Delete') { e.preventDefault(); if (selectedPaths.size === 0) { showError('没有选中任何项目'); return; } const first = Array.from(selectedPaths)[0]; const name = first.split('\\').pop(); const confirm = await showCustomConfirm(`确定要删除 "${name}" 吗？`); if (confirm) { try { await pywebview.api.delete_path(first); navigateTo(currentPath); } catch (err) { showError('删除失败: ' + err.message); } } }
    else if (key === 'F2') { e.preventDefault(); if (selectedPaths.size !== 1) { showError('请选中单个项目进行重命名'); return; } const path = Array.from(selectedPaths)[0]; const oldName = path.split('\\').pop(); const newName = await showCustomPrompt('请输入新名称:', oldName); if (newName && newName !== oldName) { try { await pywebview.api.rename_path(path, newName); navigateTo(currentPath); } catch (err) { showError('重命名失败: ' + err.message); } } }
    else if (ctrl && shift && key === 'N') { e.preventDefault(); if (!currentPath) { showError('请在文件夹内创建'); return; } const folderName = await showCustomPrompt('请输入新文件夹名称:', '新建文件夹'); if (!folderName) return; if (isCreatingFolder) return; isCreatingFolder = true; try { await pywebview.api.create_folder(currentPath, folderName); await navigateTo(currentPath); } catch (err) { showError('创建失败: ' + err.message); } finally { isCreatingFolder = false; } }
    else if (alt && key === 'Enter') { e.preventDefault(); if (selectedPaths.size === 0) return; const path = Array.from(selectedPaths)[0]; try { const props = await pywebview.api.get_properties(path); document.getElementById('propName').innerText = props.name; document.getElementById('propPath').innerText = props.path; document.getElementById('propType').innerText = props.is_dir ? '文件夹' : '文件'; document.getElementById('propSize').innerText = props.is_dir ? '-' : formatSize(props.size); document.getElementById('propCreated').innerText = props.created; document.getElementById('propModified').innerText = props.modified; document.getElementById('propAccessed').innerText = props.accessed; propCard.style.display = 'block'; } catch (err) { showError('获取属性失败: ' + err.message); } }
    else if (ctrl && key === 'a') { e.preventDefault(); if (currentFiles.length === 0) { clearSelection(); setStatus(''); return; } clearSelection(); currentFiles.forEach(file => { selectedPaths.add(file.path); const el = getItemElementByPath(file.path); if (el) el.classList.add('selected'); }); setStatus(`已选中 ${selectedPaths.size} 个项目`); saveCurrentTabState(); }
    else if (ctrl && key === 'c') { e.preventDefault(); if (selectedPaths.size === 0) { showError('没有选中任何项目'); return; } try { await pywebview.api.copy_items(Array.from(selectedPaths)); setStatus(`已复制 ${selectedPaths.size} 个项目`); } catch (err) { showError('复制失败: ' + err.message); } }
    else if (ctrl && key === 'x') { e.preventDefault(); if (selectedPaths.size === 0) { showError('没有选中任何项目'); return; } try { await pywebview.api.cut_items(Array.from(selectedPaths)); setStatus(`已剪切 ${selectedPaths.size} 个项目`); } catch (err) { showError('剪切失败: ' + err.message); } }
    else if (ctrl && key === 'v') { e.preventDefault(); if (!currentPath) { showError('不能在“此电脑”粘贴'); return; } try { const result = await pywebview.api.paste_items(currentPath); if (result.length > 0) setStatus(result[result.length-1]); navigateTo(currentPath); } catch (err) { showError('粘贴失败: ' + err.message); } }
    else if (key === 'Escape') { if (isDragging) cancelSelectionDrag(); else { clearSelection(); setStatus(''); saveCurrentTabState(); } }
});

// ---------- 框选功能 ----------
function initDragSelection() { fileListContainer.addEventListener('mousedown', onMouseDown); document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); }
function onMouseDown(e) { if (e.target.closest('tr, .grid-item')) return; if (isDragging) cancelSelectionDrag(); dragStartX = e.clientX; dragStartY = e.clientY; isDragging = true; if (!selectionBox) { selectionBox = document.createElement('div'); selectionBox.className = 'selection-box'; document.body.appendChild(selectionBox); } selectionBox.style.left = dragStartX + 'px'; selectionBox.style.top = dragStartY + 'px'; selectionBox.style.width = '0'; selectionBox.style.height = '0'; selectionBox.style.display = 'block'; e.preventDefault(); }
function onMouseMove(e) { if (!isDragging) return; const dx = e.clientX - dragStartX; const dy = e.clientY - dragStartY; if (Math.abs(dx) < dragThreshold && Math.abs(dy) < dragThreshold) return; const left = Math.min(dragStartX, e.clientX); const top = Math.min(dragStartY, e.clientY); const width = Math.abs(dx); const height = Math.abs(dy); selectionBox.style.left = left + 'px'; selectionBox.style.top = top + 'px'; selectionBox.style.width = width + 'px'; selectionBox.style.height = height + 'px'; const selectionRect = { left, top, right: left+width, bottom: top+height }; document.querySelectorAll('.selection-candidate').forEach(el => el.classList.remove('selection-candidate')); const items = document.querySelectorAll('#listView tbody tr, #gridView .grid-item'); items.forEach(item => { const rect = item.getBoundingClientRect(); if (rect.left < selectionRect.right && rect.right > selectionRect.left && rect.top < selectionRect.bottom && rect.bottom > selectionRect.top) { item.classList.add('selection-candidate'); } }); }
function onMouseUp(e) { if (!isDragging) return; if (selectionBox && (parseInt(selectionBox.style.width) > 0 || parseInt(selectionBox.style.height) > 0)) { const left = parseInt(selectionBox.style.left); const top = parseInt(selectionBox.style.top); const width = parseInt(selectionBox.style.width); const height = parseInt(selectionBox.style.height); const selectionRect = { left, top, right: left+width, bottom: top+height }; const items = document.querySelectorAll('#listView tbody tr, #gridView .grid-item'); const newlySelected = []; items.forEach(item => { const rect = item.getBoundingClientRect(); if (rect.left < selectionRect.right && rect.right > selectionRect.left && rect.top < selectionRect.bottom && rect.bottom > selectionRect.top) { newlySelected.push(item); } }); if (newlySelected.length > 0) { clearSelection(); newlySelected.forEach(item => { item.classList.add('selected'); const path = decodeURIComponent(item.dataset.path); selectedPaths.add(path); }); setStatus(`已选中 ${selectedPaths.size} 个项目`); ignoreNextBlankClick = true; setTimeout(() => { ignoreNextBlankClick = false; }, 200); } else { clearSelection(); setStatus(''); } } else { document.querySelectorAll('.selection-candidate').forEach(el => el.classList.remove('selection-candidate')); } if (selectionBox) selectionBox.style.display = 'none'; isDragging = false; saveCurrentTabState(); }
function cancelSelectionDrag() { if (selectionBox) selectionBox.style.display = 'none'; document.querySelectorAll('.selection-candidate').forEach(el => el.classList.remove('selection-candidate')); isDragging = false; }

// ---------- 导航函数 ----------
async function navigateTo(path) {
    if (isNavigating) return;
    isNavigating = true;
    setStatus(`正在加载 ${path || '此电脑'} ...`);
    cancelChunkRendering();
    if (isSearchMode) hideSearchView();
    try {
        let files;
        if (path === '' || path === '此电脑') {
            files = await pywebview.api.get_drives();
            if (currentPath !== '') { if (currentPath) historyBack.push(currentPath); historyForward = []; }
            currentPath = '';
        } else {
            files = await pywebview.api.list_directory(path);
            if (currentPath !== path) { if (currentPath) historyBack.push(currentPath); historyForward = []; }
            currentPath = path;
        }
        currentFiles = files;
        if (files.length === 0) { refreshView(true); setStatus('文件夹为空'); }
        else { refreshView(true); }
        addressInput.value = currentPath || '此电脑';
        fileListContainer.scrollTop = 0;
        updateNavButtons();
        updateTabTitle(currentPath || '此电脑');
        saveCurrentTabState();
    } catch (err) {
        showError('加载失败: ' + err.message);
        setStatus('错误');
        refreshView(false);
    } finally { isNavigating = false; }
}

async function loadDrives() { try { const drives = await pywebview.api.get_drives(); let html = ''; for (let d of drives) { html += `<li class="drive-item" data-path="${d.path}"><i class="fas fa-hdd"></i> ${d.label}</li>`; } driveList.innerHTML = html; document.querySelectorAll('.drive-item').forEach(item => { item.addEventListener('click', () => { navigateTo(item.dataset.path); }); }); } catch (err) { showError('无法加载驱动器: ' + err.message); } }

quickAccessList.querySelectorAll('.quick-item').forEach(item => { if (item.id === 'settingsBtn') { item.addEventListener('click', () => { settingsPanel.style.display = 'flex'; updateSettingsPanelState(); }); return; } item.addEventListener('click', () => { let rawPath = item.dataset.path; if (rawPath.includes('%USERPROFILE%')) { (async () => { try { const home = await pywebview.api.get_home(); navigateTo(rawPath.replace('%USERPROFILE%', home)); } catch (err) { showError('无法解析路径'); } })(); } else { navigateTo(rawPath); } }); });
thisPcBtn.addEventListener('click', () => { navigateTo(''); });
backBtn.addEventListener('click', () => { if (historyBack.length > 0) { const prev = historyBack.pop(); historyForward.push(currentPath); navigateTo(prev); } });
forwardBtn.addEventListener('click', () => { if (historyForward.length > 0) { const next = historyForward.pop(); historyBack.push(currentPath); navigateTo(next); } });
upBtn.addEventListener('click', () => { if (!currentPath) return; if (/^[A-Za-z]:\\$/.test(currentPath)) { navigateTo(''); } else { let parent = getParentPath(currentPath); if (parent && parent !== currentPath) navigateTo(parent); } });
refreshBtn.addEventListener('click', () => {
    const icon = refreshBtn.querySelector('i');
    if (icon && animationsEnabled) {
        icon.classList.add('fa-spin');
        setTimeout(() => {
            icon.classList.remove('fa-spin');
        }, 500);
    }
    if (currentPath) navigateTo(currentPath);
    else navigateTo('');
});
newFolderBtn.addEventListener('click', async () => { if (isCreatingFolder) return; if (!currentPath) { showError('请在文件夹内创建'); return; } const folderName = await showCustomPrompt('请输入新文件夹名称:', '新建文件夹'); if (!folderName) return; isCreatingFolder = true; try { await pywebview.api.create_folder(currentPath, folderName); await navigateTo(currentPath); } catch (err) { showError('创建失败: ' + err.message); } finally { isCreatingFolder = false; } });

// 启动
window.addEventListener('pywebviewready', async () => {
    await loadAppIcon();
    const firstTabId = createTab('此电脑');
    switchTab(firstTabId);
    await loadDrives();
    navigateTo('');
    initDragSelection();
    initWallpaperOptions();
    initAnimationControls();
    initTranslucentControls();
    try {
        const settings = await pywebview.api.load_settings();
        await applySettings(settings);
    } catch (err) { console.error(err); }
    setStatus('就绪');
});

async function loadAppIcon() {
    try {
        const iconDataUrl = await pywebview.api.get_app_icon();
        if (iconDataUrl) {
            const container = document.getElementById('appIconContainer');
            if (container) { container.innerHTML = `<img src="${iconDataUrl}" alt="App Icon" style="width:100%; height:100%; object-fit: cover; border-radius: 24px;">`; }
        }
    } catch (err) { console.warn(err); }
}
