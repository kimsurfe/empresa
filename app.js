// app.js

// Estado da Aplicação
let currentDate = new Date();
let currentBrandDate = new Date(); // Estado para o calendário da aba de marcas
let activeDateStr = null;
let isFirebaseConnected = !!window.db;
let daysWithTasks = new Set();
let localTasks = [];
let editingTaskRefPath = null;
let currentViewBrand = null;
let showCompleted = true; // Estado de exibição das tarefas concluídas
let currentAssigneeFilter = "Todos"; // Estado do filtro de responsável

// Estado das Configurações
let brands = [];
let assignees = [];
window.userEmailToName = {};

// Constantes e Utilidades de Marcas
const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const brandDomains = {
    "EVOKE": "evoke.com.br",
    "MCD": "mcdbrasil.net",
    "MORMAII": "mormaii.com.br",
    "NEW ERA": "neweracap.com.br",
    "STANCE": "stancesocks.com.br",
    "STEP DEFEND": "stepdefend.com.br",
    "VANS": "vans.com.br"
};

let brandCustomLogos = {
    "MORMAII": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y+mAAAARVBMVEVHcEwAAAANDg4PEBAODw8KCwwHCAkNDg4PDw8ICQkFBQUMDAwLDQ0MDQ0KCgoHBwcJCQkNDg4ODg4GBgYBAQEODg4NDg7OL+TmAAAAF3RSTlMAAy9SRAoROGrM8qEaJa7XvWCC5P55jAsXFrMAAADKSURBVHgB1RHFgQQxKB4Cceu/1GNeowXcRnBH/JsjlTb2Q+yU9g4CUnyqbIJcautjzvXwlGmFOTMQTqR017lWJ0uBYVmPoGkjS/vhXNujHE+V08EeE3fb94yKVnK+cboArRZzj9nY1tSJWfeB++poV5PCtjJH1xlnvZWqlxOxj1m14XqCvzWxPSdFJCU0J9Xi5kiR0xVwQgAGI+9KgIL5EJqavXz2P0ZPx4yI0UNHGEC5pHd/LwoGmZV3B+PE65gWnTHKyc+9i185f81WCtv3c3ikAAAAAElFTkSuQmCC",
    "STEP DEFEND": "https://raichu-uploads.s3.amazonaws.com/logo_step-defend_u3MTde.png",
    "VANS": "https://assets.vans.eu/image/upload/v1755503693/default.svg",
    "BAW": "https://bawclothing.fbitsstatic.net/sf/img/header/logoBawAlta.svg?theme=main&v=202605111448"
};

function getBrandLogoHTML(brandName, size = 18) {
    const custom = brandCustomLogos[brandName.toUpperCase()];
    if (custom) {
        return `<img src="${custom}" style="width:${size}px; height:${size}px; border-radius:4px; object-fit:contain; background:#fff; padding:1px; flex-shrink:0; vertical-align: middle;">`;
    }
    const domain = brandDomains[brandName.toUpperCase()];
    if (domain) {
        return `<img src="https://icon.horse/icon/${domain}" style="width:${size}px; height:${size}px; border-radius:4px; object-fit:contain; background:#fff; padding:1px; flex-shrink:0; vertical-align: middle;">`;
    }
    return `<i class='bx bx-purchase-tag'></i>`;
}

// Elementos da DOM - Calendário & Layout
const calendarPanel = document.getElementById('calendar-panel');
const togglePanelBtn = document.getElementById('toggle-panel-btn');
const monthYearDisplay = document.getElementById('month-year-display');
const calendarGrid = document.getElementById('calendar-grid');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');
const todayBtn = document.getElementById('today-btn');

// Elementos da DOM - Sidebar Brands
const toggleSidebarBrandsBtn = document.getElementById('toggle-sidebar-brands');
const sidebarBrandsList = document.getElementById('sidebar-brands-list');

// Elementos da DOM - Tabs & Views
const tabDashboard = document.getElementById('tab-dashboard');
const tabDay = document.getElementById('tab-day');
const tabKanban = document.getElementById('tab-kanban');
const tabClients = document.getElementById('tab-clients');
const tabIndicators = document.getElementById('tab-indicators');
const viewDashboard = document.getElementById('view-dashboard');
const viewDay = document.getElementById('view-day');
const viewKanban = document.getElementById('view-kanban');
const viewBrand = document.getElementById('view-brand');
const viewClients = document.getElementById('view-clients');
const viewIndicators = document.getElementById('view-indicators');

// Elementos da DOM - Tarefas e Header
const currentDayTitleEl = document.getElementById('current-day-title');
const currentDaySubtitleEl = document.getElementById('current-day-subtitle');
const tasksListEl = document.getElementById('tasks-list');
const openTaskModalBtn = document.getElementById('open-task-modal-btn');
const connectionStatusEl = document.getElementById('connection-status');
const settingsBtn = document.getElementById('settings-btn');
const kanbanBoard = document.getElementById('kanban-board');

// Elementos da DOM - Modais
const taskModal = document.getElementById('task-modal');
const settingsModal = document.getElementById('settings-modal');

const taskTitleInput = document.getElementById('task-title');
const taskStartDateInput = document.getElementById('task-start-date');
const taskDateInput = document.getElementById('task-date');
const taskPriorityInput = document.getElementById('task-priority');
const taskBrandSelect = document.getElementById('task-brand');
const taskAssigneesContainer = document.getElementById('task-assignees');
const taskCommentsInput = document.getElementById('task-comments');

window.handleSimpleLogin = async function() {
    const identifier = document.getElementById('login-email-input').value.trim();
    const password = document.getElementById('login-password-input').value.trim();
    const errorMsg = document.getElementById('login-error-msg');
    
    errorMsg.textContent = '';
    
    if (!identifier || !password) {
        errorMsg.textContent = 'Por favor, preencha todos os campos.';
        return;
    }
    
    try {
        const btn = document.querySelector('#simple-login-modal .btn-primary');
        const originalText = btn.textContent;
        btn.textContent = 'Autenticando...';
        btn.disabled = true;

        let userData = null;
        let userEmail = null;

        // Tenta buscar primeiro pelo e-mail exato (ID do documento)
        const docById = await window.db.collection('users').doc(identifier).get();
        if (docById.exists) {
            userData = docById.data();
            userEmail = docById.id;
        } else {
            // Se não encontrou por e-mail, busca pelo username
            const querySnapshot = await window.db.collection('users').where('username', '==', identifier).get();
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                userData = doc.data();
                userEmail = doc.id;
            }
        }
        
        if (!userData) {
            // Se for o master, cria automaticamente no primeiro acesso
            if (identifier === 'kimsurfe@gmail.com' && password === '010869') {
                await window.db.collection('users').doc(identifier).set({
                    email: identifier,
                    username: 'kimsurfe',
                    password: password,
                    role: 'admin',
                    createdAt: Date.now()
                });
                finalizeLogin(identifier, 'admin', 'kimsurfe');
            } else {
                errorMsg.textContent = 'Usuário não encontrado ou credenciais incorretas.';
            }
        } else {
            if (userData.password !== password) {
                errorMsg.textContent = 'Senha incorreta.';
            } else {
                finalizeLogin(userEmail, userData.role || 'user', userData.username);
            }
        }
        
        btn.textContent = originalText;
        btn.disabled = false;
    } catch (err) {
        console.error("Erro no login:", err);
        errorMsg.textContent = 'Erro ao conectar ao servidor. Tente novamente.';
    }
}

function finalizeLogin(email, role, username) {
    localStorage.setItem('empresa_auth_user', email.toLowerCase().trim());
    localStorage.setItem('empresa_auth_role', role);
    if(username) {
        localStorage.setItem('empresa_auth_username', username);
    } else {
        localStorage.setItem('empresa_auth_username', email.split('@')[0]);
    }
    location.reload();
}

window.addSystemUser = async function() {
    const username = document.getElementById('new-user-username').value.trim();
    const email = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-password').value.trim();
    const role = document.getElementById('new-user-role').value;
    const errorMsg = document.getElementById('user-management-error');
    
    errorMsg.textContent = '';
    
    if (!username || !email || !password) {
        errorMsg.textContent = 'Preencha o Nome/Login, E-mail e a Senha.';
        return;
    }
    
    try {
        await window.db.collection('users').doc(email).set({
            email: email,
            username: username,
            password: password,
            role: role,
            createdAt: Date.now()
        }, { merge: true });
        
        cancelEditUser();
    } catch (err) {
        console.error("Erro ao cadastrar usuário:", err);
        errorMsg.textContent = 'Erro ao salvar usuário no banco de dados.';
    }
}

window.prepareEditUser = function(email, username, role) {
    document.getElementById('new-user-email').value = email;
    document.getElementById('new-user-email').readOnly = true;
    document.getElementById('new-user-email').style.background = 'rgba(0,0,0,0.1)';
    document.getElementById('new-user-email').style.cursor = 'not-allowed';
    
    document.getElementById('new-user-username').value = username || '';
    document.getElementById('new-user-role').value = role;
    document.getElementById('new-user-password').value = '';
    document.getElementById('new-user-password').focus();
    
    document.getElementById('add-system-user-btn').innerHTML = "<i class='bx bx-check'></i> Salvar";
    document.getElementById('cancel-edit-user-btn').classList.remove('hidden');
}

window.cancelEditUser = function() {
    document.getElementById('new-user-email').value = '';
    document.getElementById('new-user-email').readOnly = false;
    document.getElementById('new-user-email').style.background = 'var(--bg-page)';
    document.getElementById('new-user-email').style.cursor = 'text';
    
    document.getElementById('new-user-username').value = '';
    document.getElementById('new-user-password').value = '';
    document.getElementById('new-user-role').value = 'user';
    
    document.getElementById('add-system-user-btn').innerHTML = "<i class='bx bx-check'></i> Salvar";
    document.getElementById('cancel-edit-user-btn').classList.add('hidden');
}

window.deleteSystemUser = async function(email) {
    if (email === 'kimsurfe@gmail.com') {
        alert("O usuário Master não pode ser deletado.");
        return;
    }
    if (confirm(`Tem certeza que deseja remover o acesso de ${email}?`)) {
        await window.db.collection('users').doc(email).delete();
    }
}

function renderSettingsUsers(usersList) {
    const listEl = document.getElementById('settings-users-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    usersList.forEach(u => {
        const li = document.createElement('li');
        const badgeClass = u.role === 'admin' ? 'badge-admin' : 'badge-user';
        const roleName = u.role === 'admin' ? 'Admin' : 'User';
        const displayUsername = u.username || u.email.split('@')[0];
        
        li.innerHTML = `
            <div style="display:flex; flex-direction:column;">
                <div style="display:flex; align-items:baseline; gap:0.5rem;">
                    <span style="font-weight: 500;">${displayUsername}</span>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">${u.email}</span>
                </div>
                <span class="${badgeClass}" style="width: fit-content; margin-top: 0.25rem;">${roleName}</span>
            </div>
            <div style="display:flex; gap:0.25rem;">
                <button class="btn-delete-item" onclick="prepareEditUser('${u.email}', '${u.username || ''}', '${u.role}')"><i class='bx bx-edit-alt'></i></button>
                ${u.email !== 'kimsurfe@gmail.com' ? `<button class="btn-delete-item" onclick="deleteSystemUser('${u.email}')"><i class='bx bx-trash'></i></button>` : ''}
            </div>
        `;
        listEl.appendChild(li);
    });
}

window.logUserAccess = async function(areaName) {
    const rawEmail = localStorage.getItem('empresa_auth_user') || '';
    const loggedInEmail = rawEmail.toLowerCase().trim();
    if (!loggedInEmail) return;

    try {
        await window.db.collection('access_logs').add({
            userEmail: loggedInEmail,
            area: `Acessou: ${areaName}`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.warn("Failed to log access", e);
    }
}

window.logUserAction = async function(actionDesc) {
    const rawEmail = localStorage.getItem('empresa_auth_user') || '';
    const loggedInEmail = rawEmail.toLowerCase().trim();
    if (!loggedInEmail) return;

    const userName = window.userEmailToName && window.userEmailToName[loggedInEmail] ? window.userEmailToName[loggedInEmail] : loggedInEmail.split('@')[0];
    
    try {
        await window.db.collection('access_logs').add({
            userEmail: loggedInEmail,
            area: `${userName} ${actionDesc}`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.warn("Failed to log action", e);
    }
};

function checkUserRole() {
    const role = localStorage.getItem('empresa_auth_role');
    if (role === 'admin') {
        document.body.classList.add('is-admin');
    } else {
        document.body.classList.remove('is-admin');
    }
    
    const rawEmail = localStorage.getItem('empresa_auth_user') || '';
    const loggedInEmail = rawEmail.toLowerCase().trim();
    const settingsLogsSection = document.getElementById('settings-logs-section');
    if(settingsLogsSection) {
        if(loggedInEmail === 'kimsurfe@gmail.com') {
            settingsLogsSection.style.display = 'block';
        } else {
            settingsLogsSection.style.display = 'none';
            settingsLogsSection.remove(); // Remove completamente do HTML por segurança
        }
    }
    
    updateUserHeader();
}

window.updateUserHeader = function() {
    const email = localStorage.getItem('empresa_auth_user') || 'Visitante';
    const username = localStorage.getItem('empresa_auth_username') || email.split('@')[0];
    const nameEl = document.getElementById('header-user-name');
    const avatarEl = document.getElementById('header-user-avatar');
    if(nameEl && avatarEl) {
        nameEl.textContent = username;
        avatarEl.textContent = username.charAt(0).toUpperCase();
    }
}

window.logout = function() {
    localStorage.removeItem('empresa_auth_user');
    localStorage.removeItem('empresa_auth_role');
    location.reload();
}

// User dropdown toggle
document.addEventListener('click', (e) => {
    const btn = document.getElementById('user-dropdown-btn');
    const menu = document.getElementById('user-dropdown-menu');
    if(btn && menu) {
        if(btn.contains(e.target)) {
            menu.classList.toggle('show');
        } else if (!menu.contains(e.target)) {
            menu.classList.remove('show');
        }
    }
});

// Inicialização
async function init() {
    const userEmail = localStorage.getItem('empresa_auth_user');
    if (!userEmail) {
        document.getElementById('simple-login-modal').classList.remove('hidden');
    } else {
        checkUserRole();
    }
    
    // Toggle Painel Principal
    togglePanelBtn.addEventListener('click', () => {
        calendarPanel.classList.toggle('collapsed');
        const icon = togglePanelBtn.querySelector('i');
        if (calendarPanel.classList.contains('collapsed')) {
            icon.classList.replace('bx-chevron-left', 'bx-chevron-right');
        } else {
            icon.classList.replace('bx-chevron-right', 'bx-chevron-left');
        }
    });

    // Toggle Sidebar Brands List foi substituído por window.toggleSidebarBrandsBtnClick()

    // Tabs
    if (tabDashboard) tabDashboard.addEventListener('click', () => switchTab('dashboard'));
    tabDay.addEventListener('click', () => switchTab('day'));
    tabKanban.addEventListener('click', () => switchTab('kanban'));
    if (tabClients) tabClients.addEventListener('click', () => switchTab('clients'));
    if (tabIndicators) tabIndicators.addEventListener('click', () => switchTab('indicators'));

    // Calendário Navegação (Global)
    prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    nextMonthBtn.addEventListener('click', () => changeMonth(1));
    todayBtn.addEventListener('click', () => {
        currentDate = new Date();
        selectDate(formatDate(currentDate));
        switchTab('day'); // Garantir que vai pro diário ao clicar hoje
    });

    // Calendário Navegação (Marca)
    document.getElementById('brand-prev-month-btn').addEventListener('click', () => changeBrandMonth(-1));
    document.getElementById('brand-next-month-btn').addEventListener('click', () => changeBrandMonth(1));

    // Modais
    openTaskModalBtn.addEventListener('click', () => { openTaskModal(); });
    document.getElementById('close-task-modal-btn').addEventListener('click', closeTaskModal);
    document.getElementById('cancel-task-btn').addEventListener('click', closeTaskModal);
    document.getElementById('save-task-btn').addEventListener('click', saveTask);
    
    // Atualizado: Botão de Settings do header e não mais do rodapé lateral
    const settingsBtnHeader = document.getElementById('settings-btn-header');
    if (settingsBtnHeader) {
        settingsBtnHeader.addEventListener('click', openSettingsModal);
    }
    
    document.getElementById('close-settings-modal-btn').addEventListener('click', closeSettingsModal);
    document.getElementById('close-settings-footer-btn').addEventListener('click', closeSettingsModal);

    // Settings Add Buttons
    document.getElementById('add-brand-btn').addEventListener('click', addBrand);

    if (isFirebaseConnected) {
        await initializeDefaultSettings();
        setupGlobalListeners();
    }
    const lastDate = sessionStorage.getItem('last_active_date') || formatDate(new Date());
    selectDate(lastDate);

    if (window.initClientsModule) window.initClientsModule();
    if (window.initIndicatorsModule) window.initIndicatorsModule();

    const lastTab = sessionStorage.getItem('last_active_tab') || 'dashboard';
    if (lastTab === 'brand') {
        const lastBrand = sessionStorage.getItem('last_active_brand');
        if (lastBrand) {
            selectBrandView(lastBrand);
        } else {
            switchTab('dashboard');
        }
    } else {
        switchTab(lastTab);
    }

    // Limpar campo de busca global contra autofill de credenciais do navegador
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    setTimeout(() => {
        const si = document.getElementById('global-search-input');
        if (si && (si.value.includes('@') || si.value === localStorage.getItem('empresa_auth_user'))) {
            si.value = '';
            if (window.handleGlobalSearch) window.handleGlobalSearch();
        }
    }, 350);
}

// Toggle do calendário no sidebar
window.toggleSidebarCalendar = function() {
    const body = document.getElementById('sidebar-calendar-body');
    const chevron = document.getElementById('sidebar-calendar-chevron');
    body.classList.toggle('collapsed');
    if(body.classList.contains('collapsed')) {
        chevron.classList.replace('bx-chevron-up', 'bx-chevron-down');
    } else {
        chevron.classList.replace('bx-chevron-down', 'bx-chevron-up');
    }
}

// Toggle da lista de marcas no sidebar
window.toggleSidebarBrandsBtnClick = function() {
    const body = document.getElementById('sidebar-brands-body');
    const chevron = document.getElementById('sidebar-brands-chevron');
    body.classList.toggle('collapsed');
    if(body.classList.contains('collapsed')) {
        chevron.classList.replace('bx-chevron-up', 'bx-chevron-down');
    } else {
        chevron.classList.replace('bx-chevron-down', 'bx-chevron-up');
    }
}

// Toggle de ocultar/exibir concluídas (apenas na view-brand)
window.toggleCompletedVisibility = function() {
    showCompleted = !showCompleted;
    document.querySelectorAll('.toggle-completed-icon-class').forEach(icon => {
        icon.className = showCompleted ? 'bx bx-hide toggle-completed-icon-class' : 'bx bx-show toggle-completed-icon-class';
    });
    document.querySelectorAll('.toggle-completed-label-class').forEach(label => {
        label.textContent = showCompleted ? 'Ocultar concluídas' : 'Exibir concluídas';
    });
    try { renderBrandCalendar(); } catch(e) {}
    try { renderBrandTasks(); } catch(e) {}
    try { renderKanban(); } catch(e) {}
}

window.filterByAssignee = function(val) {
    currentAssigneeFilter = val;
    document.querySelectorAll('.assignee-filter-select').forEach(select => {
        select.value = val;
    });
    renderBrandTasks();
    renderKanban();
}

function updateConnectionStatus() {
    if (isFirebaseConnected) {
        connectionStatusEl.textContent = "Online (Firebase)";
        connectionStatusEl.className = "status-badge online";
    } else {
        connectionStatusEl.textContent = "Erro na Conexão";
        connectionStatusEl.className = "status-badge offline";
    }
}

function switchTab(tab) {
    sessionStorage.setItem('last_active_tab', tab);
    if (tabDashboard) tabDashboard.classList.remove('active');
    tabDay.classList.remove('active');
    tabKanban.classList.remove('active');
    if (tabClients) tabClients.classList.remove('active');
    if (tabIndicators) tabIndicators.classList.remove('active');
    
    const navDashboardBtn = document.getElementById('nav-dashboard-btn');
    const navDayBtn = document.getElementById('nav-day-btn');
    const navBrandsBtn = document.getElementById('nav-brands-btn');
    const navClientsBtn = document.getElementById('nav-clients-btn');
    const navIndicatorsBtn = document.getElementById('nav-indicators-btn');
    if(navDashboardBtn) navDashboardBtn.classList.remove('active');
    if(navDayBtn) navDayBtn.classList.remove('active');
    if(navBrandsBtn) navBrandsBtn.classList.remove('active');
    if(navClientsBtn) navClientsBtn.classList.remove('active');
    if(navIndicatorsBtn) navIndicatorsBtn.classList.remove('active');
    
    if (viewDashboard) viewDashboard.classList.remove('active');
    viewDay.classList.remove('active');
    viewKanban.classList.remove('active');
    viewBrand.classList.remove('active');
    if (viewClients) viewClients.classList.remove('active');
    if (viewIndicators) viewIndicators.classList.remove('active');
    
    // Remover a classe active de todas as marcas do sidebar
    document.querySelectorAll('.sidebar-brand-item').forEach(el => el.classList.remove('active'));

    if (tab === 'dashboard') {
        if (window.logUserAccess) window.logUserAccess('Dashboard (Painel de Operações)');
        if (tabDashboard) tabDashboard.classList.add('active');
        if (navDashboardBtn) navDashboardBtn.classList.add('active');
        if (viewDashboard) viewDashboard.classList.add('active');
        currentViewBrand = null;
        renderDashboard();
    } else if(tab === 'day') {
        if (window.logUserAccess) window.logUserAccess('Calendário Diário');
        tabDay.classList.add('active');
        if(navDayBtn) navDayBtn.classList.add('active');
        viewDay.classList.add('active');
        currentViewBrand = null;
    } else if (tab === 'kanban') {
        if (window.logUserAccess) window.logUserAccess('Visão Geral de Marcas (Kanban)');
        tabKanban.classList.add('active');
        if(navBrandsBtn) navBrandsBtn.classList.add('active');
        viewKanban.classList.add('active');
        currentViewBrand = null;
        
        // Resetar e sincronizar filtros da Visão Geral (Kanban) ao abrir
        const kanbanBrandSelect = document.getElementById('kanban-filter-brand');
        if (kanbanBrandSelect) kanbanBrandSelect.value = 'Todos';
        const kanbanPrioritySelect = document.getElementById('kanban-filter-priority');
        if (kanbanPrioritySelect) kanbanPrioritySelect.value = 'Todos';
        const kanbanPeriodSelect = document.getElementById('kanban-filter-period');
        if (kanbanPeriodSelect) kanbanPeriodSelect.value = 'all';
        
        renderKanban();
    } else if (tab === 'brand') {
        if (window.logUserAccess && currentViewBrand) window.logUserAccess(`Marca: ${currentViewBrand}`);
        viewBrand.classList.add('active');
        if(navBrandsBtn) navBrandsBtn.classList.add('active');
    } else if (tab === 'clients') {
        if (window.logUserAccess) window.logUserAccess('Base de Clientes');
        if (tabClients) tabClients.classList.add('active');
        if (navClientsBtn) navClientsBtn.classList.add('active');
        if (viewClients) viewClients.classList.add('active');
        currentViewBrand = null;
        if (window.renderClientsView) window.renderClientsView();
    } else if (tab === 'indicators') {
        if (window.logUserAccess) window.logUserAccess('Painel de Indicadores (BI)');
        if (tabIndicators) tabIndicators.classList.add('active');
        if (navIndicatorsBtn) navIndicatorsBtn.classList.add('active');
        if (viewIndicators) viewIndicators.classList.add('active');
        currentViewBrand = null;
        if (window.renderIndicatorsView) window.renderIndicatorsView();
    }
}

// ----------------------------------------------------
// SETTINGS LOGIC E MARCAS DO SIDEBAR
// ----------------------------------------------------
async function initializeDefaultSettings() {
    const brandsSnap = await window.db.collection('settings').doc('brands').get();
    if (!brandsSnap.exists) {
        const defaultBrands = ["EVOKE", "MCD", "MORMAII", "NEW ERA", "STANCE", "STEP DEFEND", "VANS"].sort();
        await window.db.collection('settings').doc('brands').set({ list: defaultBrands });
    }

    // Carregar favicon customizado, se houver
    const generalSnap = await window.db.collection('settings').doc('general').get();
    if (generalSnap.exists && generalSnap.data().faviconBase64) {
        applyFavicon(generalSnap.data().faviconBase64);
    }

    // Inicializar clientes no Firestore se ainda não existir
    try {
        const clientsSnap = await window.db.collection('settings').doc('clients').get();
        if (!clientsSnap.exists) {
            const initialList = (window.INITIAL_CLIENTS_DATA && window.INITIAL_CLIENTS_DATA.length > 0)
                ? window.INITIAL_CLIENTS_DATA
                : [];
            await window.db.collection('settings').doc('clients').set({
                list: initialList,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: 'Sistema'
            });
        }
    } catch (e) {
        console.warn('Erro ao inicializar settings/clients no Firestore:', e);
    }
}

window.applyFavicon = function(base64Str) {
    let linkIcon = document.querySelector("link[rel~='icon']");
    if (!linkIcon) {
        linkIcon = document.createElement('link');
        linkIcon.rel = 'icon';
        document.head.appendChild(linkIcon);
    }
    linkIcon.href = base64Str;

    let linkApple = document.querySelector("link[rel='apple-touch-icon']");
    if (!linkApple) {
        linkApple = document.createElement('link');
        linkApple.rel = 'apple-touch-icon';
        document.head.appendChild(linkApple);
    }
    linkApple.href = base64Str;
}

function setupGlobalListeners() {
    window.db.collection("days").onSnapshot((snapshot) => {
        daysWithTasks.clear();
        snapshot.forEach((doc) => daysWithTasks.add(doc.id));
        renderCalendar();
    });

    window.db.collection('settings').doc('brands').onSnapshot((doc) => {
        if(doc.exists) {
            brands = doc.data().list.sort();
            const remoteLogos = doc.data().logos || {};
            brandCustomLogos = Object.assign(brandCustomLogos, remoteLogos);
            renderSettingsBrands();
            renderSidebarBrands();
            renderKanban(); 
            updateDashboardFilterBrands();
            if(currentViewBrand) renderBrandTasks();
            renderDashboard();
        }
    });

    window.db.collection('settings').doc('clients').onSnapshot((doc) => {
        if (doc.exists && doc.data().list && Array.isArray(doc.data().list)) {
            let remoteList = doc.data().list;
            if (remoteList.length > 0) {
                // Mesclagem com INITIAL_CLIENTS_DATA para preservar códigos NEW ERA e novos clientes cadastrados
                let needsSyncBack = false;
                if (window.INITIAL_CLIENTS_DATA && Array.isArray(window.INITIAL_CLIENTS_DATA)) {
                    const mapByCnpj = new Map();
                    remoteList.forEach(c => {
                        const cleanC = cleanDigits(c['CNPJ']);
                        if (cleanC) mapByCnpj.set(cleanC, c);
                    });
                    window.INITIAL_CLIENTS_DATA.forEach(initC => {
                        const cleanC = cleanDigits(initC['CNPJ']);
                        if (cleanC && mapByCnpj.has(cleanC)) {
                            const existing = mapByCnpj.get(cleanC);
                            if (initC['VANS'] && (!existing['VANS'] || existing['VANS'] === 'SIM')) {
                                existing['VANS'] = initC['VANS'];
                                needsSyncBack = true;
                            }
                            if (initC['NEW ERA'] && (!existing['NEW ERA'] || existing['NEW ERA'] === 'SIM')) {
                                existing['NEW ERA'] = initC['NEW ERA'];
                                needsSyncBack = true;
                            }
                            if ('CODIGO AREZZO' in existing) {
                                if (!existing['VANS'] && existing['CODIGO AREZZO']) existing['VANS'] = String(existing['CODIGO AREZZO']);
                                delete existing['CODIGO AREZZO'];
                                needsSyncBack = true;
                            }
                            if ('CODIGO NEW ERA' in existing) {
                                if (!existing['NEW ERA'] && existing['CODIGO NEW ERA']) existing['NEW ERA'] = String(existing['CODIGO NEW ERA']);
                                delete existing['CODIGO NEW ERA'];
                                needsSyncBack = true;
                            }
                        } else if (cleanC) {
                            remoteList.push(initC);
                            mapByCnpj.set(cleanC, initC);
                            needsSyncBack = true;
                        }
                    });
                }

                clientsMasterData = remoteList;
                window.clientsMasterData = clientsMasterData;
                localStorage.setItem('empresa_clients_custom_data', JSON.stringify(clientsMasterData));

                // Se houve mesclagem de novos dados da base mestre, atualizar o Firestore para que todos os usuários recebam
                if (needsSyncBack && window.db) {
                    try {
                        window.db.collection('settings').doc('clients').set({
                            list: clientsMasterData,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true }).catch(err => console.warn('Erro ao sincronizar clientes mestre no Firestore:', err));
                    } catch (e) {
                        console.warn('Erro ao atualizar Firestore de clientes:', e);
                    }
                }

                const sidebarBadge = document.getElementById('sidebar-clients-count');
                if (sidebarBadge) sidebarBadge.textContent = clientsMasterData.length;
                populateClientsDatalists();
                if (typeof window.applyIndicatorsFilter === 'function') {
                    try { window.applyIndicatorsFilter(); } catch (e) {}
                }
                if (sessionStorage.getItem('last_active_tab') === 'clients') {
                    applyClientsFilter();
                }
            }
        }
    });
    window.db.collectionGroup('tasks').onSnapshot((snapshot) => {
        const rawEmail = localStorage.getItem('empresa_auth_user') || '';
        const loggedInEmail = rawEmail.toLowerCase().trim();
        const isAdmin = loggedInEmail === 'kimsurfe@gmail.com';

        const allTasks = [];
        snapshot.forEach(doc => {
            const taskData = doc.data();
            
            // Tratamento retroativo para tarefas que não tinham assignees
            let taskAssignees = taskData.assignees || [];
            if (!Array.isArray(taskAssignees) && typeof taskAssignees === 'string') {
                taskAssignees = [taskAssignees];
            }
            if (taskData.assignee && !taskAssignees.includes(taskData.assignee)) {
                taskAssignees.push(taskData.assignee);
            }
            
            const pathSegments = doc.ref.path.split('/');
            const dayId = pathSegments[1];
            allTasks.push({ id: doc.id, dayId: dayId, refPath: doc.ref.path, ...taskData });
        });
        window.allGlobalTasks = allTasks;
        renderKanban();
        renderCalendar(); // Re-renderiza para atualizar os ícones de prazos
        renderDashboard(); // Atualiza o Dashboard em tempo real!
        if(currentViewBrand) {
            renderBrandCalendar(); // Atualiza o calendário da marca (concluídas, riscadas, etc.)
            renderBrandTasks();    // Atualiza a lista de tarefas do dia selecionado
        }
    });

    window.db.collection('users').onSnapshot((snapshot) => {
        const usersList = [];
        snapshot.forEach(doc => {
            usersList.push(doc.data());
        });
        window.userEmailToName = {};
        usersList.forEach(u => {
            window.userEmailToName[u.email] = u.username || u.email.split('@')[0];
        });
        // Ordena para manter o admin principal kimsurfe sempre no topo, e o resto por email
        usersList.sort((a, b) => {
            if (a.email === 'kimsurfe@gmail.com') return -1;
            if (b.email === 'kimsurfe@gmail.com') return 1;
            return a.email.localeCompare(b.email);
        });
        renderSettingsUsers(usersList);

        // O novo sistema usa a lista de usuários como responsáveis das tarefas (unificado)
        assignees = usersList.map(u => u.email).sort();
        updateAssigneeFilters();
        renderAssigneesCheckboxes();
        updateDashboardFilterAssignees();
        
        // Atualiza o header automaticamente se o usuário logado for modificado
        const loggedInEmail = localStorage.getItem('empresa_auth_user');
        if (loggedInEmail) {
            const currentUserData = usersList.find(u => u.email === loggedInEmail);
            if (currentUserData && currentUserData.username) {
                localStorage.setItem('empresa_auth_username', currentUserData.username);
                updateUserHeader();
            }
        }
        renderDashboard();
    });
}

function renderSidebarBrands() {
    sidebarBrandsList.innerHTML = '';
    
    const groupKR = ["EVOKE", "MORMAII", "NEW ERA", "VANS"];
    const groupMKR = ["MCD", "STANCE", "STEP DEFEND", "BAW"];
    
    const krBrands = brands.filter(b => groupKR.includes(b));
    const mkrBrands = brands.filter(b => groupMKR.includes(b));
    const otherBrands = brands.filter(b => !groupKR.includes(b) && !groupMKR.includes(b));
    
    const createLi = (b) => {
        const li = document.createElement('li');
        li.className = 'sidebar-brand-item';
        if(currentViewBrand === b && viewBrand.classList.contains('active')) {
            li.classList.add('active');
        }
        li.innerHTML = `<div style="display:flex; align-items:center; gap:0.5rem;">${getBrandLogoHTML(b, 18)} <span>${b}</span></div>`;
        li.onclick = () => selectBrandView(b);
        return li;
    };

    const createGroup = (title, id, list) => {
        if(list.length === 0) return;
        
        const headerLi = document.createElement('li');
        headerLi.className = 'sidebar-brands-header';
        headerLi.style.padding = '0.8rem 0.75rem 0.2rem 1.5rem';
        headerLi.style.fontSize = '0.75rem';
        headerLi.style.listStyle = 'none';
        headerLi.onclick = () => window.toggleBrandSubGroup(id);
        headerLi.innerHTML = `
            <span>${title}</span>
            <i class='bx bx-chevron-up' id="${id}-icon" style="font-size:1.2rem;"></i>
        `;
        sidebarBrandsList.appendChild(headerLi);
        
        const bodyLi = document.createElement('li');
        bodyLi.style.listStyle = 'none';
        bodyLi.id = id;
        bodyLi.className = 'subgroup-body';
        
        const ul = document.createElement('ul');
        ul.className = 'sidebar-brands-list';
        ul.style.marginTop = '0';
        ul.style.paddingLeft = '0';
        
        list.forEach(b => ul.appendChild(createLi(b)));
        bodyLi.appendChild(ul);
        sidebarBrandsList.appendChild(bodyLi);
    };

    createGroup('KR', 'grp-kr', krBrands);
    createGroup('MKR', 'grp-mkr', mkrBrands);
    createGroup('OFFICE', 'grp-outras', otherBrands);
}

function renderSettingsBrands() {
    const listEl = document.getElementById('settings-brands-list');
    listEl.innerHTML = '';
    brands.forEach(b => {
        const li = document.createElement('li');
        li.style.flexDirection = 'column';
        li.style.alignItems = 'stretch';
        li.style.gap = '0';
        
        const logoUrl = brandCustomLogos[b] || '';
        
        li.innerHTML = `
            <div class="brand-view-mode" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    ${getBrandLogoHTML(b, 20)}
                    <span>${b}</span>
                </div>
                <div style="display:flex; gap: 0.5rem;">
                    <button class="btn-edit-item" onclick="toggleEditBrandMode(this, true)" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer;"><i class='bx bx-pencil'></i></button>
                    <button class="btn-delete-item" onclick="deleteBrand('${b}')"><i class='bx bx-trash'></i></button>
                </div>
            </div>
            <div class="brand-edit-mode hidden" style="display:none; flex-direction:column; gap:0.5rem; width:100%; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed rgba(255,255,255,0.1);">
                <label style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:-0.25rem;">Nome da Marca</label>
                <input type="text" class="edit-brand-name" value="${b}" style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: var(--text-primary); padding: 0.4rem; border-radius: 4px; font-size: 0.85rem;">
                <label style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:-0.25rem;">URL do Logo</label>
                <input type="text" class="edit-brand-logo" value="${logoUrl}" placeholder="https://..." style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: var(--text-primary); padding: 0.4rem; border-radius: 4px; font-size: 0.85rem;">
                <div style="display:flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.25rem;">
                    <button onclick="toggleEditBrandMode(this, false)" style="background:transparent; border:1px solid var(--border-color); color:var(--text-secondary); cursor:pointer; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.8rem;">Cancelar</button>
                    <button onclick="saveEditedBrand(this, '${b}')" style="background:var(--accent-color); border:none; color:#fff; cursor:pointer; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.8rem;">Salvar</button>
                </div>
            </div>
        `;
        listEl.appendChild(li);
    });
}

window.toggleEditBrandMode = function(btn, showEdit) {
    const li = btn.closest('li');
    const viewMode = li.querySelector('.brand-view-mode');
    const editMode = li.querySelector('.brand-edit-mode');
    if (showEdit) {
        viewMode.style.display = 'none';
        editMode.style.display = 'flex';
        editMode.classList.remove('hidden');
    } else {
        viewMode.style.display = 'flex';
        editMode.style.display = 'none';
        editMode.classList.add('hidden');
    }
}

window.saveEditedBrand = async function(btn, oldName) {
    const li = btn.closest('li');
    let newName = li.querySelector('.edit-brand-name').value.trim().toUpperCase();
    const newLogo = li.querySelector('.edit-brand-logo').value.trim();
    
    if (!newName) {
        alert("O nome da marca não pode ser vazio.");
        return;
    }
    
    if (newName !== oldName && brands.includes(newName)) {
        alert("Já existe uma marca com este nome.");
        return;
    }
    
    // Disable inputs and buttons while saving
    const inputs = li.querySelectorAll('input');
    const buttons = li.querySelectorAll('button');
    inputs.forEach(i => i.disabled = true);
    buttons.forEach(b => b.disabled = true);
    btn.innerHTML = 'Salvando...';

    try {
        // Update brands array
        if (newName !== oldName) {
            brands = brands.filter(b => b !== oldName);
            brands.push(newName);
        }
        
        // Update logos object
        let updatedLogos = Object.assign({}, brandCustomLogos);
        if (newName !== oldName) {
            delete updatedLogos[oldName];
        }
        if (newLogo) {
            updatedLogos[newName] = newLogo;
        } else {
            delete updatedLogos[newName];
        }
        
        // Batch update tasks if name changed
        if (newName !== oldName) {
            const batch = window.db.batch();
            let tasksToUpdate = window.allGlobalTasks.filter(t => t.brand === oldName);
            tasksToUpdate.forEach(t => {
                const ref = window.db.collection('tasks').doc(t.id);
                batch.update(ref, { brand: newName });
            });
            await batch.commit();
            
            // Update currentViewBrand if active
            if (currentViewBrand === oldName) {
                currentViewBrand = newName;
                document.getElementById('brand-view-title').innerText = currentViewBrand;
            }
        }
        
        // Save settings/brands
        await window.db.collection('settings').doc('brands').set({ 
            list: brands.sort(),
            logos: updatedLogos
        });
        
    } catch (e) {
        console.error("Erro ao salvar marca: ", e);
        alert("Erro ao salvar marca. Veja o console.");
    }
}

async function addBrand() {
    const input = document.getElementById('new-brand-input');
    const val = input.value.trim().toUpperCase();
    if(val && !brands.includes(val)) {
        brands.push(val);
        // Do not overwrite logos
        let currentLogos = Object.assign({}, brandCustomLogos);
        await window.db.collection('settings').doc('brands').set({ 
            list: brands.sort(),
            logos: currentLogos
        });
        input.value = '';
    }
}


window.renderAssigneesCheckboxes = function() {
    const container = document.getElementById('task-assignees');
    if(!container) return;
    container.innerHTML = '';
    assignees.forEach(a => {
        const id = `assignee-${a.replace(/[@.\s]+/g, '-')}`;
        const displayName = window.userEmailToName[a] || a;
        const lbl = document.createElement('label');
        lbl.className = 'checkbox-label';
        lbl.innerHTML = `<input type="checkbox" value="${a}" id="${id}"> ${displayName}`;
        container.appendChild(lbl);
    });
}

function updateAssigneeFilters() {
    const loggedInEmail = localStorage.getItem('empresa_auth_user');
    
    // 1. Filtro do Dashboard: Padrão é o usuário logado
    const cmsAssigneeList = document.getElementById('cms-assignee-list');
    if (cmsAssigneeList) {
        const checkedVals = window.getCMSValues('cms-assignee');
        cmsAssigneeList.innerHTML = '';
        assignees.forEach(a => {
            let isChecked = checkedVals.includes(a) ? 'checked' : '';
            if (checkedVals.length === 0 && !window.hasInitializedAssigneeFilterDB) {
                if (a === loggedInEmail) isChecked = 'checked';
            }
            cmsAssigneeList.innerHTML += `<label class="cms-option"><input type="checkbox" value="${a}" onchange="updateCMSLabel('cms-assignee'); renderDashboard();" ${isChecked}> ${window.userEmailToName[a] || a}</label>`;
        });
        window.hasInitializedAssigneeFilterDB = true;
        window.updateCMSLabel('cms-assignee');
    }

    const dbSelect = document.getElementById('db-filter-assignee');
    if (dbSelect) {
        const currentVal = dbSelect.value;
        dbSelect.innerHTML = '<option value="Todos">Todos Responsáveis</option>';
        assignees.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a;
            opt.textContent = window.userEmailToName[a] || a;
            dbSelect.appendChild(opt);
        });
        
        if (!window.hasInitializedAssigneeFilterGeneral && loggedInEmail && assignees.includes(loggedInEmail)) {
            dbSelect.value = loggedInEmail;
        } else if (currentVal && (assignees.includes(currentVal) || currentVal === "Todos")) {
            dbSelect.value = currentVal;
        } else {
            dbSelect.value = "Todos";
        }
    }

    // 2. Filtros de Kanban e Marcas: Padrão é "Todos Responsáveis" para evitar telas em branco
    document.querySelectorAll('.assignee-filter-select').forEach(select => {
        if (select.id === 'db-filter-assignee') return; // Pula o do dashboard
        
        const currentVal = select.value;
        select.innerHTML = '<option value="Todos">Todos Responsáveis</option>';
        assignees.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a;
            opt.textContent = window.userEmailToName[a] || a;
            select.appendChild(opt);
        });
        
        if (currentVal && (assignees.includes(currentVal) || currentVal === "Todos")) {
            select.value = currentVal;
        } else {
            select.value = "Todos";
        }
    });

    // Inicializa a variável de filtro global de responsável
    if (!window.hasInitializedAssigneeFilterGeneral) {
        currentAssigneeFilter = "Todos"; // Kanban/Marcas iniciam exibindo todas as tarefas do time por padrão
    }
    
    window.hasInitializedAssigneeFilterGeneral = true;
}

window.deleteBrand = async function(val) {
    brands = brands.filter(b => b !== val);
    let updatedLogos = Object.assign({}, brandCustomLogos);
    delete updatedLogos[val];
    await window.db.collection('settings').doc('brands').set({ list: brands, logos: updatedLogos });
    if(currentViewBrand === val) {
        switchTab('day'); // reset se deletar a marca atual
    }
}

function openSettingsModal() { 
    settingsModal.classList.remove('hidden'); 
    if (window.renderAccessLogs) window.renderAccessLogs();
}
function closeSettingsModal() { settingsModal.classList.add('hidden'); }

// ----------------------------------------------------
// TASK MODAL LOGIC (Criar e Editar)
// ----------------------------------------------------
function populateTaskFormOptions() {
    taskBrandSelect.innerHTML = '<option value="">Selecione uma marca...</option>';
    brands.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        taskBrandSelect.appendChild(opt);
    });

    window.renderAssigneesCheckboxes();
}

function openTaskModal(taskData = null, refPath = null) {
    if(!activeDateStr && !taskData) return;
    if(taskData) {
        activeDateStr = taskData.startDate || taskData.dayId || activeDateStr;
    }
    populateTaskFormOptions();
    
    const completionSection = document.getElementById('task-completion-section');
    const toggleBtn = document.getElementById('task-toggle-complete-btn');
    const toggleLabel = document.getElementById('task-toggle-complete-label');
    const completedAtLabel = document.getElementById('task-completed-at-label');
    const feedbackInput = document.getElementById('task-completion-feedback');
    const notice = document.getElementById('recurrence-notice');

    if (taskData) {
        editingTaskRefPath = refPath;
        document.querySelector('#task-modal h2').textContent = "Editar Tarefa";
        document.getElementById('delete-task-modal-btn').style.display = 'flex';
        
        taskTitleInput.value = taskData.text || '';
        document.getElementById('task-subtitle').value = taskData.subtitle || '';
        taskStartDateInput.value = taskData.startDate || taskData.dayId || '';
        taskDateInput.value = taskData.deadline || '';
        taskPriorityInput.value = taskData.priority || 'medium';
        if (document.getElementById('task-status')) document.getElementById('task-status').value = taskData.status || 'pending';
        taskBrandSelect.value = taskData.brand && taskData.brand !== "Sem Marca" ? taskData.brand : '';
        taskCommentsInput.value = taskData.comments || '';
        
        const rec = document.getElementById('task-recurrence');
        if(rec) {
            rec.value = taskData.recurrenceRule || 'none';
            rec.disabled = false;
        }
        
        document.querySelectorAll('.recurrence-day-cb').forEach(cb => cb.checked = false);
        if(taskData.recurrenceRule === 'custom_days' && taskData.recurrenceDays) {
            document.querySelectorAll('.recurrence-day-cb').forEach(cb => {
                if(taskData.recurrenceDays.includes(parseInt(cb.value))) cb.checked = true;
            });
            document.getElementById('task-recurrence-custom-days').style.display = 'block';
        } else {
            document.getElementById('task-recurrence-custom-days').style.display = 'none';
        }

        if(notice) {
            notice.style.display = taskData.seriesId ? 'flex' : 'none';
        }

        if (taskData.assignees) {
            document.querySelectorAll('#task-assignees input[type="checkbox"]').forEach(cb => {
                if (taskData.assignees.includes(cb.value)) cb.checked = true;
            });
        }

        // Seção de conclusão
        completionSection.style.display = 'block';
        feedbackInput.value = taskData.completionFeedback || '';

        const isCompleted = taskData.status === 'completed';
        if(isCompleted) {
            toggleLabel.textContent = 'Reabrir Tarefa';
            toggleBtn.style.color = 'var(--success-color)';
            toggleBtn.querySelector('i').className = 'bx bx-undo';
            if(taskData.completedAt) {
                const dt = new Date(taskData.completedAt);
                completedAtLabel.textContent = `— ${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}`;
            } else {
                completedAtLabel.textContent = '';
            }
        } else {
            toggleLabel.textContent = 'Marcar como Concluída';
            toggleBtn.style.color = '';
            toggleBtn.querySelector('i').className = 'bx bx-check';
            completedAtLabel.textContent = '';
        }
        toggleBtn.dataset.refPath = refPath;
        toggleBtn.dataset.status = taskData.status;
    } else {
        editingTaskRefPath = null;
        document.querySelector('#task-modal h2').textContent = "Criar Nova Tarefa";
        document.getElementById('delete-task-modal-btn').style.display = 'none';
        completionSection.style.display = 'none';
        
        taskTitleInput.value = '';
        document.getElementById('task-subtitle').value = '';
        taskStartDateInput.value = activeDateStr || '';
        taskDateInput.value = activeDateStr || ''; 
        taskPriorityInput.value = 'medium';
        if (document.getElementById('task-status')) document.getElementById('task-status').value = 'pending';
        taskCommentsInput.value = '';
        feedbackInput.value = '';
        
        const rec = document.getElementById('task-recurrence');
        if(rec) {
            rec.value = 'none';
            rec.disabled = false;
        }
        document.querySelectorAll('.recurrence-day-cb').forEach(cb => cb.checked = false);
        document.getElementById('task-recurrence-custom-days').style.display = 'none';
        
        if(notice) notice.style.display = 'none';
    }
    
    taskModal.classList.remove('hidden');
    taskTitleInput.focus();
}

function closeTaskModal() {
    taskModal.classList.add('hidden');
    editingTaskRefPath = null;
}

document.getElementById('delete-task-modal-btn').addEventListener('click', async () => {
    if(!editingTaskRefPath) return;

    const doc = await window.db.doc(editingTaskRefPath).get();
    const taskData = doc.data();

    if (taskData && taskData.seriesId) {
        // Tarefa é de uma série. Abrir modal customizado direto.
        document.getElementById('delete-series-modal').classList.remove('hidden');
    } else {
        // Tarefa normal. Pergunta simples do navegador.
        if(confirm('Tem certeza que deseja excluir esta tarefa?')) {
            await window.db.doc(editingTaskRefPath).delete();
            if(window.logUserAction && taskData) window.logUserAction(`deletou a tarefa "${taskData.text}" da marca ${taskData.brand || 'Sem Marca'}`);
            window.showNotification('Tarefa excluída com sucesso!');
            closeTaskModal();
        }
    }
});

document.getElementById('cancel-delete-series').addEventListener('click', () => {
    document.getElementById('delete-series-modal').classList.add('hidden');
});

document.getElementById('confirm-delete-only-this').addEventListener('click', async () => {
    if(!editingTaskRefPath) return;
    const doc = await window.db.doc(editingTaskRefPath).get();
    const taskData = doc.data();
    await window.db.doc(editingTaskRefPath).delete();
    if(window.logUserAction && taskData) window.logUserAction(`deletou a ocorrência da tarefa "${taskData.text}" da marca ${taskData.brand || 'Sem Marca'}`);
    window.showNotification('Tarefa excluída com sucesso!');
    document.getElementById('delete-series-modal').classList.add('hidden');
    closeTaskModal();
});

document.getElementById('confirm-delete-all-series').addEventListener('click', async () => {
    if(!editingTaskRefPath) return;
    const doc = await window.db.doc(editingTaskRefPath).get();
    const taskData = doc.data();

    if(taskData && taskData.seriesId) {
        const baseDayId = editingTaskRefPath.split('/')[1];
        const futureTasks = window.allGlobalTasks.filter(t => 
            t.seriesId === taskData.seriesId && 
            t.status === 'pending' && 
            t.dayId >= baseDayId
        );
        for (const ft of futureTasks) {
            await window.db.doc(ft.refPath).delete();
        }
        await window.db.doc(editingTaskRefPath).delete();
    }
    
    if(window.logUserAction && taskData) window.logUserAction(`deletou a série da tarefa "${taskData.text}" da marca ${taskData.brand || 'Sem Marca'}`);
    window.showNotification('Série de tarefas excluída com sucesso!');
    document.getElementById('delete-series-modal').classList.add('hidden');
    closeTaskModal();
});

// Toggle status dentro do modal
document.getElementById('task-toggle-complete-btn').addEventListener('click', async () => {
    const refPath = document.getElementById('task-toggle-complete-btn').dataset.refPath;
    const currentStatus = document.getElementById('task-toggle-complete-btn').dataset.status;
    if(!refPath) return;
    await toggleTaskStatusGlobal(refPath, currentStatus);
    // Recarregar dados do modal para atualizar o botão
    const doc = await window.db.doc(refPath).get();
    if(doc.exists) openTaskModal(doc.data(), refPath);
});

// Salvar feedback dentro do modal
document.getElementById('save-feedback-btn').addEventListener('click', async () => {
    if(!editingTaskRefPath) return;
    const feedback = document.getElementById('task-completion-feedback').value.trim();
    await window.db.doc(editingTaskRefPath).update({ completionFeedback: feedback });
    const btn = document.getElementById('save-feedback-btn');
    btn.textContent = '✓ Salvo!';
    setTimeout(() => { btn.innerHTML = "<i class='bx bx-save'></i> Salvar Feedback"; }, 1500);
});

window.editTask = async function(refPath) {
    try {
        const cachedTask = window.allGlobalTasks ? window.allGlobalTasks.find(t => (t.refPath || `days/${t.dayId}/tasks/${t.id}`) === refPath) : null;
        if (cachedTask) {
            openTaskModal(cachedTask, refPath);
            return;
        }
        
        const doc = await window.db.doc(refPath).get();
        if(doc.exists) {
            openTaskModal(doc.data(), refPath);
        } else {
            alert("Erro: Tarefa não encontrada no banco de dados.");
        }
    } catch (e) {
        console.error("Erro ao abrir tarefa para edição: ", e);
        alert("Erro ao abrir a tarefa. Verifique sua conexão.");
    }
}

let pendingTaskUpdateData = null;
let pendingOldTaskData = null;

async function updateSingleTaskPath(refPath, oldDate, newDate, updateData) {
    const pathSegments = refPath ? refPath.split('/') : [];
    const actualOldDate = oldDate || (pathSegments.length >= 2 ? pathSegments[1] : null);
    const taskId = pathSegments.length >= 4 ? pathSegments[3] : ('task_' + Date.now());

    // Limpar FieldValue.delete() de payloads destinados a .set()
    const cleanDataForSet = { ...updateData };
    if (cleanDataForSet.completedAt === firebase.firestore.FieldValue.delete() || typeof cleanDataForSet.completedAt === 'undefined') {
        delete cleanDataForSet.completedAt;
    }
    if (cleanDataForSet.seriesId === firebase.firestore.FieldValue.delete()) {
        delete cleanDataForSet.seriesId;
    }

    if (actualOldDate && actualOldDate === newDate && refPath) {
        // Mesma data: atualizar in-place
        try {
            await window.db.doc(refPath).update(updateData);
        } catch(updErr) {
            console.warn("Update in-place falhou, usando set com merge:", updErr);
            await window.db.doc(refPath).set(cleanDataForSet, { merge: true });
        }
    } else {
        // Data diferente (mudança de data no formulário) ou documento novo/movido:
        // 1. Gravar com segurança na nova data PRIMEIRO
        await window.db.collection(`days/${newDate}/tasks`).doc(taskId).set(cleanDataForSet);
        
        // 2. Registrar atividade no novo dia
        if (!daysWithTasks.has(newDate)) {
            await window.db.collection("days").doc(newDate).set({ active: true }, { merge: true });
            daysWithTasks.add(newDate);
        }

        // 3. Somente após gravar com sucesso, remover do dia anterior se o caminho existir e for diferente
        if (refPath && actualOldDate && actualOldDate !== newDate) {
            try {
                await window.db.doc(refPath).delete();
            } catch(delErr) {
                console.warn("Aviso ao remover da data anterior:", delErr);
            }
        }
    }
}

async function saveTask() {
    const title = taskTitleInput.value.trim();
    if(!title) {
        alert("O título da tarefa é obrigatório!");
        return;
    }

    const brandValue = taskBrandSelect.value;
    if(!brandValue || brandValue === "Sem Marca") {
        alert("A marca da tarefa é obrigatória!");
        return;
    }

    const startDate = taskStartDateInput.value;
    const deadline = taskDateInput.value;
    if(!startDate) {
        alert("A data de início é obrigatória!");
        return;
    }
    if (deadline && deadline < startDate) {
        alert("A data de término não pode ser anterior à data de início!");
        return;
    }

    const selectedAssignees = [];
    document.querySelectorAll('#task-assignees input[type="checkbox"]:checked').forEach(cb => {
        selectedAssignees.push(cb.value);
    });

    if (selectedAssignees.length === 0) {
        alert("A atribuição da tarefa é obrigatória (selecione pelo menos um responsável)!");
        return;
    }

    const recurrence = document.getElementById('task-recurrence').value;
    const selectedDays = [];
    if (recurrence === 'custom_days') {
        document.querySelectorAll('.recurrence-day-cb:checked').forEach(cb => {
            selectedDays.push(parseInt(cb.value));
        });
        if(selectedDays.length === 0) {
            alert("Selecione pelo menos um dia da semana para a recorrência!");
            return;
        }
    }

    const isEditing = Boolean(editingTaskRefPath);
    const saveBtn = document.getElementById('save-task-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';
    }

    try {
        const statusVal = document.getElementById('task-status') ? document.getElementById('task-status').value : 'pending';

        const updateData = {
            text: title,
            subtitle: document.getElementById('task-subtitle').value.trim(),
            priority: taskPriorityInput.value,
            status: statusVal,
            brand: taskBrandSelect.value,
            assignees: selectedAssignees,
            comments: taskCommentsInput.value.trim(),
            startDate: startDate,
            deadline: deadline || startDate,
            recurrenceRule: recurrence,
            recurrenceDays: selectedDays
        };

        if (editingTaskRefPath) {
            let doc = null;
            let oldData = {};
            try {
                doc = await window.db.doc(editingTaskRefPath).get();
                if (doc && doc.exists) {
                    oldData = doc.data() || {};
                }
            } catch(fetchErr) {
                console.warn("Aviso ao buscar documento para edição:", fetchErr);
            }
            
            if (statusVal === 'completed') {
                if (!oldData.completedAt) {
                    updateData.completedAt = Date.now();
                } else {
                    updateData.completedAt = oldData.completedAt;
                }
            } else {
                if (oldData.completedAt) {
                    updateData.completedAt = firebase.firestore.FieldValue.delete();
                }
            }

            // Se a tarefa pertencer a uma recorrência (seriesId ativo) E a recorrência continua ativa
            if (oldData.seriesId && recurrence !== 'none') {
                pendingTaskUpdateData = updateData;
                pendingOldTaskData = { ...oldData, refPath: editingTaskRefPath };
                document.getElementById('save-series-modal').classList.remove('hidden');
                return;
            }

            // Se o usuário mudou a recorrência para "none", desvincula da série
            if (recurrence === 'none' && oldData.seriesId) {
                updateData.seriesId = firebase.firestore.FieldValue.delete();
            }

            // Caso contrário, é uma tarefa comum de data única
            const pathSegments = editingTaskRefPath.split('/');
            const oldDate = (pathSegments.length >= 2 ? pathSegments[1] : null) || oldData.startDate;
            await updateSingleTaskPath(editingTaskRefPath, oldDate, startDate, updateData);

        } else {
            // Criando nova tarefa
            const seriesId = 'series_' + Date.now();
            await generateRecurringTasks(
                startDate, 
                recurrence, 
                selectedDays, 
                seriesId, 
                title, 
                document.getElementById('task-subtitle').value.trim(),
                taskPriorityInput.value,
                taskBrandSelect.value,
                selectedAssignees,
                taskCommentsInput.value.trim(),
                deadline || startDate,
                false,
                statusVal
            );
        }

        if (isEditing) {
            if(window.logUserAction) window.logUserAction(`editou a tarefa "${title}" da marca ${taskBrandSelect.value}`);
            window.showNotification('Tarefa atualizada com sucesso!');
        } else {
            if(window.logUserAction) window.logUserAction(`criou a tarefa "${title}" da marca ${taskBrandSelect.value}`);
            window.showNotification('Tarefa criada com sucesso!');
        }

        closeTaskModal();
    } catch(err) {
        console.error("Erro ao salvar tarefa:", err);
        window.showNotification('Erro ao salvar tarefa: ' + (err.message || 'Verifique sua conexão.'), 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar Tarefa';
        }
    }
}

// Confirmadores de Salvamento de Série Recorrente
document.getElementById('cancel-save-series').addEventListener('click', () => {
    document.getElementById('save-series-modal').classList.add('hidden');
    pendingTaskUpdateData = null;
    pendingOldTaskData = null;
});

document.getElementById('confirm-save-only-this').addEventListener('click', async () => {
    if (!pendingTaskUpdateData || !pendingOldTaskData) return;
    
    try {
        const pathSegments = pendingOldTaskData.refPath ? pendingOldTaskData.refPath.split('/') : [];
        const oldStartDate = (pathSegments.length >= 2 ? pathSegments[1] : null) || pendingOldTaskData.startDate || pendingOldTaskData.dayId;
        const newStartDate = pendingTaskUpdateData.startDate;
        const updateData = { ...pendingTaskUpdateData, seriesId: pendingOldTaskData.seriesId };
        
        await updateSingleTaskPath(pendingOldTaskData.refPath, oldStartDate, newStartDate, updateData);
        if(window.logUserAction) window.logUserAction(`editou a tarefa "${updateData.text}" da marca ${updateData.brand}`);
        window.showNotification('Tarefa atualizada com sucesso!');
        
        document.getElementById('save-series-modal').classList.add('hidden');
        closeTaskModal();
    } catch(err) {
        console.error("Erro ao salvar ocorrência:", err);
        window.showNotification('Erro ao salvar tarefa: ' + (err.message || 'Verifique sua conexão.'), 'error');
    }
});

document.getElementById('confirm-save-future-series').addEventListener('click', async () => {
    if (!pendingTaskUpdateData || !pendingOldTaskData) return;
    
    try {
        const pathSegments = pendingOldTaskData.refPath ? pendingOldTaskData.refPath.split('/') : [];
        const oldStartDate = (pathSegments.length >= 2 ? pathSegments[1] : null) || pendingOldTaskData.startDate || pendingOldTaskData.dayId;
        const newStartDate = pendingTaskUpdateData.startDate;
        const seriesId = pendingOldTaskData.seriesId;
        
        // 1. Deletar tarefas pendentes futuras (incluindo a atual, para recriar se o dia mudou)
        const futureTasks = window.allGlobalTasks.filter(t => 
            t.seriesId === seriesId && 
            t.status === 'pending' && 
            t.dayId >= oldStartDate
        );
        for (const ft of futureTasks) {
            await window.db.doc(ft.refPath).delete();
        }
        
        // Se a atual já estava concluída, a gente não deleta ela no loop acima
        // Mas a gente precisa atualizá-la
        if (pendingOldTaskData.status === 'completed') {
            const updateData = { ...pendingTaskUpdateData, seriesId };
            await updateSingleTaskPath(pendingOldTaskData.refPath, oldStartDate, newStartDate, updateData);
        }
        
        // 2. Gerar as novas futuras a partir da nova data de início
        const skipFirst = (pendingOldTaskData.status === 'completed');
        
        await generateRecurringTasks(
            newStartDate,
            pendingTaskUpdateData.recurrenceRule,
            pendingTaskUpdateData.recurrenceDays,
            seriesId,
            pendingTaskUpdateData.text,
            pendingTaskUpdateData.subtitle,
            pendingTaskUpdateData.priority,
            pendingTaskUpdateData.brand,
            pendingTaskUpdateData.assignees,
            pendingTaskUpdateData.comments,
            pendingTaskUpdateData.deadline,
            skipFirst,
            pendingTaskUpdateData.status
        );
        
        if(window.logUserAction) window.logUserAction(`editou a série da tarefa "${pendingTaskUpdateData.text}" da marca ${pendingTaskUpdateData.brand}`);
        window.showNotification('Tarefas futuras atualizadas com sucesso!');
        document.getElementById('save-series-modal').classList.add('hidden');
        closeTaskModal();
    } catch(err) {
        console.error("Erro ao salvar série futura:", err);
        window.showNotification('Erro ao salvar tarefas: ' + (err.message || 'Verifique sua conexão.'), 'error');
    }
});

document.getElementById('confirm-save-all-series').addEventListener('click', async () => {
    if (!pendingTaskUpdateData || !pendingOldTaskData) return;
    
    try {
        const seriesId = pendingOldTaskData.seriesId;
        const newStartDate = pendingTaskUpdateData.startDate;
        
        // 1. Deletar todas as tarefas pendentes da série
        const pendingTasks = window.allGlobalTasks.filter(t => 
            t.seriesId === seriesId && 
            t.status === 'pending'
        );
        for (const pt of pendingTasks) {
            await window.db.doc(pt.refPath).delete();
        }
        
        // 2. Atualizar metadados das tarefas concluídas da série
        const completedTasks = window.allGlobalTasks.filter(t => 
            t.seriesId === seriesId && 
            t.status === 'completed'
        );
        for (const ct of completedTasks) {
            await window.db.doc(ct.refPath).update({
                text: pendingTaskUpdateData.text,
                subtitle: pendingTaskUpdateData.subtitle,
                priority: pendingTaskUpdateData.priority,
                brand: pendingTaskUpdateData.brand,
                assignees: pendingTaskUpdateData.assignees,
                comments: pendingTaskUpdateData.comments
            });
        }
        
        // 3. Regenerar as tarefas pendentes a partir da nova data
        await generateRecurringTasks(
            newStartDate,
            pendingTaskUpdateData.recurrenceRule,
            pendingTaskUpdateData.recurrenceDays,
            seriesId,
            pendingTaskUpdateData.text,
            pendingTaskUpdateData.subtitle,
            pendingTaskUpdateData.priority,
            pendingTaskUpdateData.brand,
            pendingTaskUpdateData.assignees,
            pendingTaskUpdateData.comments,
            pendingTaskUpdateData.deadline,
            false,
            pendingTaskUpdateData.status
        );
        
        if(window.logUserAction) window.logUserAction(`editou toda a série da tarefa "${pendingTaskUpdateData.text}" da marca ${pendingTaskUpdateData.brand}`);
        window.showNotification('Toda a série foi atualizada com sucesso!');
        document.getElementById('save-series-modal').classList.add('hidden');
        closeTaskModal();
    } catch(err) {
        console.error("Erro ao salvar toda série:", err);
        window.showNotification('Erro ao salvar tarefas: ' + (err.message || 'Verifique sua conexão.'), 'error');
    }
});

async function generateRecurringTasks(baseDateStr, recurrence, selectedDays, seriesId, text, subtitle, priority, brand, assignees, comments, deadline, skipFirst = false, statusVal = 'pending') {
    let datesToCreate = [];
    if (!skipFirst) datesToCreate.push(baseDateStr);

    if (recurrence !== 'none') {
        let [y, m, d] = baseDateStr.split('-').map(Number);
        let baseDate = new Date(y, m - 1, d);
        
        if (recurrence === 'daily') {
            for(let i=1; i<=30; i++) {
                let next = new Date(baseDate);
                next.setDate(baseDate.getDate() + i);
                datesToCreate.push(formatDate(next));
            }
        } else if (recurrence === 'weekly') {
            for(let i=1; i<=12; i++) {
                let next = new Date(baseDate);
                next.setDate(baseDate.getDate() + (i * 7));
                datesToCreate.push(formatDate(next));
            }
        } else if (recurrence === 'monthly') {
            for(let i=1; i<=12; i++) {
                let next = new Date(baseDate);
                next.setMonth(baseDate.getMonth() + i);
                datesToCreate.push(formatDate(next));
            }
        } else if (recurrence === 'custom_days') {
            // Avança até 12 semanas (84 dias) procurando pelos dias selecionados
            for(let i=1; i<=84; i++) { 
                let next = new Date(baseDate);
                next.setDate(baseDate.getDate() + i);
                if (selectedDays.includes(next.getDay())) {
                    datesToCreate.push(formatDate(next));
                }
            }
        }
    }

    // Calcular a duração original em milissegundos
    let durationMs = 0;
    const [sy, sm, sd] = baseDateStr.split('-').map(Number);
    const startObj = new Date(sy, sm - 1, sd);
    if (deadline) {
        const [ey, em, ed] = deadline.split('-').map(Number);
        const endObj = new Date(ey, em - 1, ed);
        durationMs = endObj.getTime() - startObj.getTime();
        if (durationMs < 0) durationMs = 0;
    }

    for (const dateStr of datesToCreate) {
        const currentStatus = (dateStr === baseDateStr) ? statusVal : 'pending';
        
        // Calcular o término específico para esta ocorrência preservando a duração
        let occurrenceDeadline = deadline || dateStr;
        if (dateStr !== baseDateStr && deadline) {
            const [oy, om, od] = dateStr.split('-').map(Number);
            const occurrenceStart = new Date(oy, om - 1, od);
            const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
            occurrenceDeadline = formatDate(occurrenceEnd);
        }
        const loggedInUserEmail = (localStorage.getItem('empresa_auth_user') || '').toLowerCase().trim();
        const newTask = {
            text, subtitle, status: currentStatus, priority, brand, assignees, comments, 
            startDate: dateStr,
            deadline: occurrenceDeadline, 
            createdAt: new Date().getTime(),
            createdBy: loggedInUserEmail,
            recurrenceRule: recurrence, recurrenceDays: selectedDays
        };
        if (recurrence !== 'none') {
            newTask.seriesId = seriesId;
        }
        
        if (currentStatus === 'completed') {
            newTask.completedAt = Date.now();
        }
        
        await window.db.collection(`days/${dateStr}/tasks`).add(newTask);
        if (!daysWithTasks.has(dateStr)) {
            await window.db.collection("days").doc(dateStr).set({ active: true }, { merge: true });
            daysWithTasks.add(dateStr);
        }
    }
}

// ----------------------------------------------------
// LOGIC: DATAS & CALENDÁRIO VISUAL
// ----------------------------------------------------
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function getFriendlyDateString(dateStr) {
    if(!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const date = new Date(y, parseInt(m) - 1, d);
    
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);

    if (dateStr === formatDate(today)) return "Hoje";
    if (dateStr === formatDate(yesterday)) return "Ontem";
    if (dateStr === formatDate(tomorrow)) return "Amanhã";

    const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    return `${days[date.getDay()]}`;
}

function changeMonth(offset) {
    currentDate.setMonth(currentDate.getMonth() + offset);
    renderCalendar();
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    monthYearDisplay.textContent = `${monthNames[month]} ${year}`;
    calendarGrid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    // Preparar conjunto de prazos (deadlines) pendentes para marcar no calendário
    const pendingDeadlines = new Set();
    if(window.allGlobalTasks) {
        window.allGlobalTasks.forEach(t => {
            if(t.deadline && t.status === 'pending') {
                pendingDeadlines.add(t.deadline);
            }
        });
    }

    for (let i = firstDay - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i;
        calendarGrid.appendChild(createCalendarDay(new Date(year, month - 1, d), true, pendingDeadlines));
    }

    for (let i = 1; i <= daysInMonth; i++) {
        calendarGrid.appendChild(createCalendarDay(new Date(year, month, i), false, pendingDeadlines));
    }

    const totalCells = calendarGrid.children.length;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
        calendarGrid.appendChild(createCalendarDay(new Date(year, month + 1, i), true, pendingDeadlines));
    }
}

function createCalendarDay(dateObj, isOtherMonth, pendingDeadlines) {
    const dateStr = formatDate(dateObj);
    const todayStr = formatDate(new Date());

    const div = document.createElement('div');
    div.className = 'calendar-day';
    if (isOtherMonth) div.classList.add('other-month');
    if (dateStr === todayStr) div.classList.add('today');
    if (dateStr === activeDateStr) div.classList.add('active');

    div.textContent = dateObj.getDate();

    if (daysWithTasks.has(dateStr)) {
        const marker = document.createElement('div');
        marker.className = 'task-marker';
        div.appendChild(marker);
    }
    
    if (pendingDeadlines && pendingDeadlines.has(dateStr)) {
        const deadlineMarker = document.createElement('div');
        deadlineMarker.className = 'deadline-marker';
        deadlineMarker.innerHTML = "<i class='bx bxs-bell-ring'></i>";
        div.appendChild(deadlineMarker);
    }

    div.addEventListener('click', () => {
        selectDate(dateStr);
        switchTab('day'); // Garantir que mostre o dia ao clicar no calendário
    });
    return div;
}

// ----------------------------------------------------
// CALENDÁRIO DA MARCA ESPECÍFICA
// ----------------------------------------------------
let brandActiveDateStr = null;

function changeBrandMonth(offset) {
    currentBrandDate.setMonth(currentBrandDate.getMonth() + offset);
    renderBrandCalendar();
}

function renderBrandCalendar() {
    const year = currentBrandDate.getFullYear();
    const month = currentBrandDate.getMonth();
    
    document.getElementById('brand-month-year-display').textContent = `${monthNames[month]} ${year}`;
    const grid = document.getElementById('brand-calendar-grid');
    grid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const brandTasks = window.allGlobalTasks ? window.allGlobalTasks.filter(t => t.brand === currentViewBrand) : [];
    
    const brandDays = new Set();
    const brandDeadlines = new Set();
    brandTasks.forEach(t => {
        if(t.dayId && t.status === 'pending') brandDays.add(t.dayId);
        if(t.deadline && t.status === 'pending') brandDeadlines.add(t.deadline);
    });

    for (let i = firstDay - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i;
        grid.appendChild(createBrandCalendarDay(new Date(year, month - 1, d), true, brandDays, brandDeadlines));
    }

    for (let i = 1; i <= daysInMonth; i++) {
        grid.appendChild(createBrandCalendarDay(new Date(year, month, i), false, brandDays, brandDeadlines));
    }

    const totalCells = grid.children.length;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
        grid.appendChild(createBrandCalendarDay(new Date(year, month + 1, i), true, brandDays, brandDeadlines));
    }

    // Calcula o total de semanas (linhas) após inserir todas as células
    const finalTotalCells = grid.children.length;
    const weeks = finalTotalCells / 7;
    grid.style.gridTemplateRows = `repeat(${weeks}, 1fr)`;
}

function createBrandCalendarDay(dateObj, isOtherMonth, brandDays, brandDeadlines) {
    const dateStr = formatDate(dateObj);
    const todayStr = formatDate(new Date());

    const div = document.createElement('div');
    div.className = 'brand-calendar-day-large'; 
    if (isOtherMonth) div.classList.add('other-month');
    if (dateStr === todayStr) div.classList.add('today');
    if (dateStr === brandActiveDateStr) div.classList.add('active');

    const dayNum = document.createElement('div');
    dayNum.className = 'day-number';
    dayNum.textContent = dateObj.getDate();
    div.appendChild(dayNum);

    const brandTasks = window.allGlobalTasks ? window.allGlobalTasks.filter(t => {
        if(t.brand !== currentViewBrand) return false;
        if(!showCompleted && t.status === 'completed') return false;
        return true;
    }) : [];
    const tasksForDay = brandTasks.filter(t => t.dayId === dateStr || t.deadline === dateStr);
    
    // Sort tasks to put completed ones at the bottom, newest completed first
    tasksForDay.sort((a, b) => {
        if(a.status === 'completed' && b.status !== 'completed') return 1;
        if(a.status !== 'completed' && b.status === 'completed') return -1;
        if(a.status === 'completed' && b.status === 'completed') {
            return (b.completedAt || 0) - (a.completedAt || 0);
        }
        return a.createdAt - b.createdAt;
    });
    
    const limit = 4;
    tasksForDay.slice(0, limit).forEach(t => {
        const tDiv = document.createElement('div');
        tDiv.className = `cal-task-item ${t.status === 'completed' ? 'completed' : ''}`;
        if(t.deadline === dateStr && t.dayId !== dateStr) tDiv.classList.add('deadline');

        const refPath = t.refPath || `days/${t.dayId}/tasks/${t.id}`;
        const isCompleted = t.status === 'completed';

        // Botão de concluir/reabrir
        const checkBtn = document.createElement('button');
        checkBtn.className = 'cal-task-check-btn';
        checkBtn.title = isCompleted ? 'Reabrir tarefa' : 'Concluir tarefa';
        checkBtn.innerHTML = isCompleted
            ? "<i class='bx bx-check-circle' style='color:var(--success-color);'></i>"
            : "<i class='bx bx-circle'></i>";
        checkBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if(isCompleted) {
                // Reabrir diretamente
                toggleTaskStatusGlobal(refPath, t.status);
            } else {
                // Concluir: abrir modal de feedback
                completingTaskRefPath = refPath;
                document.getElementById('completion-modal-title').textContent = 'Concluir Tarefa';
                document.getElementById('completion-feedback').value = '';
                document.getElementById('completion-modal').classList.remove('hidden');
                document.getElementById('completion-feedback').focus();
            }
        });

        // Conteúdo texto (título + subtítulo)
        const textWrap = document.createElement('div');
        textWrap.className = 'cal-task-text';
        textWrap.style.overflow = 'hidden';
        textWrap.style.flex = '1';
        textWrap.style.cursor = 'pointer';

        const titleEl = document.createElement('div');
        titleEl.className = 'cal-task-title';
        titleEl.style.cssText = `font-size:0.78rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; ${isCompleted ? 'text-decoration:line-through; opacity:0.55;' : ''}`;
        titleEl.textContent = t.text;

        textWrap.appendChild(titleEl);

        if(t.subtitle) {
            const subEl = document.createElement('div');
            subEl.className = 'cal-task-subtitle';
            subEl.style.cssText = `font-size:0.7rem; opacity:0.6; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; ${isCompleted ? 'text-decoration:line-through;' : ''}`;
            subEl.textContent = t.subtitle;
            textWrap.appendChild(subEl);
        }

        textWrap.addEventListener('click', (e) => {
            e.stopPropagation();
            editTask(refPath);
        });

        tDiv.style.display = 'flex';
        tDiv.style.alignItems = 'flex-start';
        tDiv.style.gap = '4px';
        tDiv.style.padding = '3px 5px';
        tDiv.appendChild(checkBtn);
        tDiv.appendChild(textWrap);

        div.appendChild(tDiv);
    });

    if (tasksForDay.length > limit) {
        const moreDiv = document.createElement('div');
        moreDiv.className = 'cal-task-item';
        moreDiv.style.background = 'transparent';
        moreDiv.style.fontWeight = 'bold';
        moreDiv.innerHTML = `Mais ${tasksForDay.length - limit}`;
        div.appendChild(moreDiv);
    }

    div.addEventListener('click', () => {
        brandActiveDateStr = dateStr;
        renderBrandCalendar();
        renderBrandTasks();
    });

    return div;
}

window.selectBrandView = function(brand) {
    sessionStorage.setItem('last_active_brand', brand);
    currentViewBrand = brand;
    currentBrandDate = new Date();
    brandActiveDateStr = formatDate(new Date());
    switchTab('brand');
    renderSidebarBrands();
    document.getElementById('brand-view-title').innerHTML = `<div style="display:flex; align-items:center; gap:0.5rem;">${getBrandLogoHTML(brand, 28)} <span>${brand}</span></div>`;
    
    // Resetar e sincronizar filtros ao trocar de marca
    const brandFilterSelect = document.getElementById('brand-filter-brand');
    if (brandFilterSelect) {
        brandFilterSelect.value = brand;
    }
    const prioritySelect = document.getElementById('brand-filter-priority');
    if (prioritySelect) {
        prioritySelect.value = 'Todos';
    }
    const periodSelect = document.getElementById('brand-filter-period');
    if (periodSelect) {
        periodSelect.value = 'today';
    }
    
    renderBrandCalendar();
    renderBrandTasks();
}

function renderBrandTasks() {
    const listEl = document.getElementById('brand-tasks-list');
    listEl.innerHTML = '';
    
    if(!window.allGlobalTasks) return;
    
    // Obter filtros ativos da Brand View
    const priorityFilters = window.getCMSValues('cms-brandview-priority');
    const assigneeFilters = window.getCMSValues('cms-brandview-assignee');
    const brandFilters = window.getCMSValues('cms-brandview-brand');
    const periodFilter = window.getCMSValueSingle('cms-brandview-period');
    const todayStr = formatDate(new Date());
    
    const tomorrowObj = new Date(); tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = formatDate(tomorrowObj);
    
    const brandTasks = window.allGlobalTasks.filter(t => {
        // Marca
        if(brandFilters.length > 0 && !brandFilters.includes(t.brand)) return false;
        if(brandFilters.length === 0 && t.brand !== currentViewBrand) return false;
        
        // Exibir/Ocultar concluídas
        if(!showCompleted && t.status === 'completed') return false;
        
        // Responsável
        if(assigneeFilters.length > 0) {
            const hasAssignee = t.assignees && t.assignees.some(a => assigneeFilters.includes(a));
            const isCreator = t.createdBy && assigneeFilters.includes(t.createdBy);
            if(!hasAssignee && !isCreator) return false;
        }
        
        if(!window.applyGlobalSearchFilter(t)) return false;
        
        // Prioridade
        if(priorityFilters.length > 0 && !priorityFilters.includes(t.priority)) return false;
        
        // Período
        if (periodFilter === 'today') {
            if (t.dayId !== brandActiveDateStr && t.deadline !== brandActiveDateStr) return false;
        } else if (periodFilter === 'week') {
            if (!isCurrentWeekGlobal(t.dayId) && !isCurrentWeekGlobal(t.deadline)) return false;
        } else if (periodFilter === 'month') {
            if (!isCurrentMonthGlobal(t.dayId) && !isCurrentMonthGlobal(t.deadline)) return false;
        } else if (periodFilter === 'overdue') {
            if (!isOverdueGlobal(t, todayStr)) return false;
        }
        
        return true;
    });
    
    // Sort tasks to put completed ones at the bottom, newest completed first
    brandTasks.sort((a, b) => {
        if(a.status === 'completed' && b.status !== 'completed') return 1;
        if(a.status !== 'completed' && b.status === 'completed') return -1;
        if(a.status === 'completed' && b.status === 'completed') {
            return (b.completedAt || 0) - (a.completedAt || 0);
        }
        return a.createdAt - b.createdAt;
    });
    
    // Atualizar título conforme o período selecionado
    let titleHTML = `<i class='bx bx-list-ul'></i> Anotações`;
    if (periodFilter === 'today') {
        titleHTML = `<i class='bx bx-list-ul'></i> Anotações para ${formatDateBR(brandActiveDateStr)}`;
    } else if (periodFilter === 'week') {
        titleHTML = `<i class='bx bx-list-ul'></i> Anotações desta Semana`;
    } else if (periodFilter === 'month') {
        titleHTML = `<i class='bx bx-list-ul'></i> Anotações deste Mês`;
    } else if (periodFilter === 'overdue') {
        titleHTML = `<i class='bx bx-alarm-exclamation' style='color: var(--danger-color);'></i> Anotações Atrasadas`;
    } else {
        titleHTML = `<i class='bx bx-list-ul'></i> Todas as Anotações`;
    }
    document.getElementById('brand-tasks-list-title').innerHTML = titleHTML;

    if(brandTasks.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state" style="padding: 2rem 1rem; min-height: auto;">
                <i class='bx bx-check-double'></i>
                <p>Nenhuma anotação encontrada para os filtros aplicados.</p>
            </div>
        `;
        return;
    }
    
    brandTasks.forEach(task => {
        listEl.appendChild(createTaskDOM(task, task.dayId, false));
    });
}

window.openTaskModalForBrand = function(brand) {
    if (viewBrand.classList.contains('active') && brandActiveDateStr) {
        activeDateStr = brandActiveDateStr; 
    } else if (!activeDateStr) {
        activeDateStr = formatDate(new Date());
    }
    openTaskModal();
    setTimeout(() => {
        if(brand && brand !== "Sem Marca") {
            taskBrandSelect.value = brand;
        }
    }, 10);
}

// ----------------------------------------------------
// VISÃO DIÁRIA
// ----------------------------------------------------
let unsubscribeDayTasks = null;

function selectDate(dateStr) {
    sessionStorage.setItem('last_active_date', dateStr);
    activeDateStr = dateStr;
    
    const [y, m, d] = dateStr.split('-');
    const activeDateObj = new Date(y, parseInt(m) - 1, d);
    if (currentDate.getMonth() !== activeDateObj.getMonth() || currentDate.getFullYear() !== activeDateObj.getFullYear()) {
        currentDate = new Date(y, parseInt(m) - 1, 1);
    }
    
    renderCalendar();

    const formattedTitle = `${d} de ${monthNames[parseInt(m) - 1]} de ${y}`;
    const formattedSubtitle = getFriendlyDateString(dateStr);

    currentDayTitleEl.textContent = formattedTitle;
    currentDaySubtitleEl.textContent = formattedSubtitle;

    const dbTitleEl = document.getElementById('db-current-day-title');
    const dbSubtitleEl = document.getElementById('db-current-day-subtitle');
    if(dbTitleEl && dbSubtitleEl) {
        dbTitleEl.textContent = formattedTitle;
        dbSubtitleEl.textContent = formattedSubtitle;
    }
    
    openTaskModalBtn.disabled = false;

    listenToActiveDateTasks(dateStr);
}

function listenToActiveDateTasks(dateStr) {
    if (unsubscribeDayTasks) unsubscribeDayTasks();
    if (!isFirebaseConnected) return;

    unsubscribeDayTasks = window.db.collection(`days/${dateStr}/tasks`)
        .orderBy("createdAt")
        .onSnapshot((snapshot) => {
            const rawEmail = localStorage.getItem('empresa_auth_user') || '';
            const loggedInEmail = rawEmail.toLowerCase().trim();
            const isAdmin = loggedInEmail === 'kimsurfe@gmail.com';

            localTasks = [];
            snapshot.forEach((doc) => {
                const taskData = doc.data();
                
                // Tratamento retroativo para tarefas que não tinham assignees
                let taskAssignees = taskData.assignees || [];
                if (!Array.isArray(taskAssignees) && typeof taskAssignees === 'string') {
                    taskAssignees = [taskAssignees];
                }
                if (taskData.assignee && !taskAssignees.includes(taskData.assignee)) {
                    taskAssignees.push(taskData.assignee);
                }
                
                localTasks.push({ 
                    id: doc.id, 
                    refPath: `days/${dateStr}/tasks/${doc.id}`,
                    ...taskData 
                });
            });
            handleDayDocumentLifecycle(dateStr, localTasks.length);
            renderTasks();
        });
}

async function handleDayDocumentLifecycle(dateStr, taskCount) {
    if (taskCount > 0 && !daysWithTasks.has(dateStr)) {
        await window.db.collection("days").doc(dateStr).set({ active: true }, { merge: true });
    } else if (taskCount === 0 && daysWithTasks.has(dateStr)) {
        await window.db.collection("days").doc(dateStr).delete();
    }
}

function renderTasks() {
    tasksListEl.innerHTML = '';

    const priorityFilter = window.getCMSValues ? window.getCMSValues('cms-dayview-priority') : [];
    const assigneeFilter = window.getCMSValues ? window.getCMSValues('cms-dayview-assignee') : [];
    const brandFilter = window.getCMSValues ? window.getCMSValues('cms-dayview-brand') : [];
    const periodFilterRadio = document.querySelector('input[name="dayview-period-filter"]:checked');
    const periodFilter = periodFilterRadio ? periodFilterRadio.value : 'today';

    const filterFn = (t) => {
        if(priorityFilter.length > 0 && !priorityFilter.includes(t.priority || 'medium')) return false;
        if(brandFilter.length > 0 && !brandFilter.includes(t.brand || 'Sem Marca')) return false;
        if(assigneeFilter.length > 0) {
            let tAssignees = t.assignees || [];
            if(typeof tAssignees === 'string') tAssignees = [tAssignees];
            if(t.assignee && !tAssignees.includes(t.assignee)) tAssignees.push(t.assignee);
            const hasAssignee = tAssignees.some(a => assigneeFilter.includes(a));
            const isCreator = t.createdBy && assigneeFilter.includes(t.createdBy);
            if(tAssignees.length === 0 && assigneeFilter.includes('Sem Responsável')) return true;
            if(!hasAssignee && !isCreator) return false;
        }
        if(window.applyGlobalSearchFilter && !window.applyGlobalSearchFilter(t)) return false;
        return true;
    };

    let currentDayTasks = [];
    let deadlineTasks = [];
    let delayedTasks = [];
    let monthTasks = [];

    const todayStr = formatDate(new Date());

    if (periodFilter === 'today') {
        currentDayTasks = [...localTasks].filter(filterFn);
        if(window.allGlobalTasks) {
            window.allGlobalTasks.forEach(t => {
                if(t.deadline === activeDateStr && t.dayId !== activeDateStr && t.status === 'pending') {
                    if (filterFn(t)) deadlineTasks.push(t);
                }
            });
        }
        if(window.allGlobalTasks && activeDateStr) {
            const [y, m] = activeDateStr.split('-');
            const prefix = `${y}-${m}-`;
            const uniqueMonthMap = new Map();
            const uniqueDelayedMap = new Map();
            window.allGlobalTasks.forEach(t => {
                if(t.status !== 'completed' && filterFn(t)) {
                    if (t.dayId < todayStr || (t.deadline && t.deadline < todayStr)) {
                        if(!uniqueDelayedMap.has(t.id)) uniqueDelayedMap.set(t.id, t);
                    }
                    if(t.dayId.startsWith(prefix) || (t.deadline && t.deadline.startsWith(prefix))) {
                        if (t.dayId !== activeDateStr && t.deadline !== activeDateStr) {
                            if(!uniqueDelayedMap.has(t.id)) {
                                if(!uniqueMonthMap.has(t.id)) uniqueMonthMap.set(t.id, t);
                            }
                        }
                    }
                }
            });
            delayedTasks = Array.from(uniqueDelayedMap.values());
            monthTasks = Array.from(uniqueMonthMap.values());
        }
    } else {
        if(window.allGlobalTasks) {
            let baseTasks = window.allGlobalTasks.filter(filterFn);
            if(window.filterTasksByPeriod) {
                baseTasks = window.filterTasksByPeriod(baseTasks, periodFilter);
            }
            currentDayTasks = baseTasks;
        }
    }

    const priorityValue = { high: 3, medium: 2, low: 1 };
    const sortFn = (a, b) => {
        if(a.status === 'completed' && b.status !== 'completed') return 1;
        if(a.status !== 'completed' && b.status === 'completed') return -1;
        if(a.status === 'completed' && b.status === 'completed') {
            return (b.completedAt || 0) - (a.completedAt || 0);
        }
        const pA = priorityValue[a.priority || 'medium'] || 2;
        const pB = priorityValue[b.priority || 'medium'] || 2;
        if (pA !== pB) return pB - pA;
        return a.createdAt - b.createdAt;
    };

    currentDayTasks.sort(sortFn);
    deadlineTasks.sort(sortFn);
    delayedTasks.sort(sortFn);
    monthTasks.sort(sortFn);

    if (delayedTasks.length > 0) {
        const h = document.createElement('h3');
        h.style.cssText = "font-size: 0.95rem; color: var(--danger-color); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;";
        h.innerHTML = "<i class='bx bx-alarm-exclamation'></i> Tarefas Atrasadas";
        tasksListEl.appendChild(h);
        
        delayedTasks.forEach(task => {
            tasksListEl.appendChild(createTaskDOM(task, task.dayId, false));
        });
    }

    if (deadlineTasks.length > 0 || currentDayTasks.length > 0) {
        const h = document.createElement('h3');
        h.style.cssText = "font-size: 0.95rem; color: var(--primary-color); margin-top: 1.5rem; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;";
        h.innerHTML = "<i class='bx bx-calendar-star'></i> Tarefas do Dia Selecionado";
        tasksListEl.appendChild(h);

        deadlineTasks.forEach(task => {
            tasksListEl.appendChild(createTaskDOM(task, task.dayId, false));
        });
        currentDayTasks.forEach(task => {
            if(!deadlineTasks.find(d => d.id === task.id)) {
                tasksListEl.appendChild(createTaskDOM(task, activeDateStr, false));
            }
        });
    } else {
        const div = document.createElement('div');
        div.className = 'empty-state';
        div.innerHTML = "<i class='bx bx-check-double'></i><p>Nenhuma anotação ou prazo para este dia.</p>";
        tasksListEl.appendChild(div);
    }

    if (monthTasks.length > 0) {
        const h = document.createElement('h3');
        h.style.cssText = "font-size: 0.95rem; color: var(--accent-color); margin-top: 1.5rem; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;";
        h.innerHTML = "<i class='bx bx-calendar'></i> Restante do Mês";
        tasksListEl.appendChild(h);
        
        monthTasks.forEach(task => {
            tasksListEl.appendChild(createTaskDOM(task, task.dayId, false));
        });
    }
}

// ----------------------------------------------------
// VISÃO KANBAN GERAL
// ----------------------------------------------------
window.allGlobalTasks = [];

function renderKanban() {
    if(!window.allGlobalTasks) return;

    kanbanBoard.innerHTML = '';
    
    // Obter filtros ativos da Kanban View
    const priorityFilters = window.getCMSValues('cms-kanban-priority');
    const periodFilter = window.getCMSValueSingle('cms-kanban-period');
    const brandFilters = window.getCMSValues('cms-kanban-brand');
    const assigneeFilters = window.getCMSValues('cms-kanban-assignee');
    const todayStr = formatDate(new Date());
    
    const tomorrowObj = new Date(); tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = formatDate(tomorrowObj);
    
    // Filtrar para mostrar apenas a próxima tarefa pendente de cada série recorrente
    const pendingSeriesMap = {};
    window.allGlobalTasks.forEach(t => {
        if (t.seriesId && t.status === 'pending') {
            if (!pendingSeriesMap[t.seriesId] || t.dayId < pendingSeriesMap[t.seriesId].dayId) {
                pendingSeriesMap[t.seriesId] = t;
            }
        }
    });

    const allKanbanTasks = window.allGlobalTasks.filter(t => {
        // Série recorrente
        if (t.seriesId && t.status === 'pending') {
            if (pendingSeriesMap[t.seriesId].id !== t.id) return false;
        }
        
        // Prioridade
        if(priorityFilters.length > 0 && !priorityFilters.includes(t.priority)) return false;
        
        // Brand Filter (Adicionado no Kanban geral)
        if(brandFilters.length > 0 && !brandFilters.includes(t.brand)) return false;

        // Assignee Filter
        if(assigneeFilters.length > 0) {
            const hasAssignee = t.assignees && t.assignees.some(a => assigneeFilters.includes(a));
            const isCreator = t.createdBy && assigneeFilters.includes(t.createdBy);
            if(!hasAssignee && !isCreator) return false;
        }
        
        if(!window.applyGlobalSearchFilter(t)) return false;
        
        // Período
        if (periodFilter === 'today') {
            if (t.dayId !== todayStr && t.deadline !== todayStr) return false;
        } else if (periodFilter === 'tomorrow') {
            if (t.dayId !== tomorrowStr && t.deadline !== tomorrowStr) return false;
        } else if (periodFilter === 'week') {
            if (!isCurrentWeekGlobal(t.dayId) && !isCurrentWeekGlobal(t.deadline)) return false;
        } else if (periodFilter === 'month') {
            if (!isCurrentMonthGlobal(t.dayId) && !isCurrentMonthGlobal(t.deadline)) return false;
        } else if (periodFilter === 'overdue') {
            if (!isOverdueGlobal(t, todayStr)) return false;
        }
        
        return true;
    });
    
    // Ordenar: tarefas pendentes primeiro (por criação), concluídas depois
    allKanbanTasks.sort((a, b) => {
        if(a.status === 'completed' && b.status !== 'completed') return 1;
        if(a.status !== 'completed' && b.status === 'completed') return -1;
        if(a.status === 'completed' && b.status === 'completed') {
            return (b.completedAt || 0) - (a.completedAt || 0);
        }
        return a.createdAt - b.createdAt;
    });
    
    const grouped = {};
    brands.forEach(b => grouped[b] = []); 
    grouped["Sem Marca"] = [];

    allKanbanTasks.forEach(task => {
        const b = task.brand || "Sem Marca";
        if(!grouped[b]) grouped[b] = []; 
        grouped[b].push(task);
    });

    let orderedKeys = [...brands, "Sem Marca"];
    if (brandFilters.length > 0) {
        orderedKeys = orderedKeys.filter(b => brandFilters.includes(b));
    }
    
    orderedKeys.forEach(brand => {
        const columnTasks = grouped[brand];
        if(brand === "Sem Marca" && columnTasks.length === 0) return;

        // Contagem APENAS das tarefas pendentes, independentemente de estarem sendo exibidas ou não
        let countTasks = columnTasks.filter(t => t.status !== 'completed');
        if (assigneeFilters.length > 0) {
            countTasks = countTasks.filter(t => t.assignees && t.assignees.some(a => assigneeFilters.includes(a)));
        }
        const pendingCount = countTasks.length;

        let displayTasks = columnTasks;
        if (assigneeFilters.length > 0) {
            displayTasks = displayTasks.filter(t => t.assignees && t.assignees.some(a => assigneeFilters.includes(a)));
        }
        if (!showCompleted) {
            displayTasks = displayTasks.filter(t => t.status !== 'completed');
        }

        const colDiv = document.createElement('div');
        colDiv.className = 'kanban-column';
        
        colDiv.innerHTML = `
            <div class="kanban-col-header">
                <div style="display:flex; align-items:center; gap:0.5rem;">${brand !== "Sem Marca" ? getBrandLogoHTML(brand, 20) : ""} <span>${brand}</span></div>
                <span class="count">${pendingCount}</span>
            </div>
            <div class="kanban-col-body" id="kanban-col-${brand.replace(/\s+/g, '-')}">
            </div>
        `;
        
        kanbanBoard.appendChild(colDiv);
        const colBody = colDiv.querySelector('.kanban-col-body');

        if(displayTasks.length === 0) {
            colBody.innerHTML = `<span style="color:var(--text-secondary); font-size:0.8rem; text-align:center; padding:1rem;">Nenhuma tarefa</span>`;
        } else {
            displayTasks.forEach(task => {
                colBody.appendChild(createTaskDOM(task, task.dayId, true));
            });
        }
    });
}

window.openTaskModalForBrand = function(brand) {
    if (!activeDateStr) {
        activeDateStr = formatDate(new Date());
    }
    openTaskModal();
    setTimeout(() => {
        if(brand && brand !== "Sem Marca") {
            taskBrandSelect.value = brand;
        }
    }, 10);
}

// ----------------------------------------------------
// FACTORY DE CARD DE TAREFA
// ----------------------------------------------------
function createTaskDOM(task, dayIdContext, isKanban = false) {
    const div = document.createElement('div');
    div.className = `task-item ${task.status === 'completed' ? 'completed' : ''} ${isKanban ? 'kanban-card' : ''}`;
    
    const isCompleted = task.status === 'completed';
    const icon = isCompleted ? "<i class='bx bx-check-circle'></i>" : "<i class='bx bx-circle'></i>";
    
    const refPath = task.refPath || `days/${dayIdContext}/tasks/${task.id}`;

    let badgesHtml = '';
    if(task.priority) {
        let pIcon = task.priority === 'high' ? '<span style="color:#ef4444;font-weight:900;">!!!</span>' 
                  : task.priority === 'medium' ? '<span style="color:#f59e0b;font-weight:900;">!!</span>' 
                  : '<span style="color:#10b981;font-weight:900;">!</span>';
        let pText = task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa';
        
        badgesHtml += `<span class="badge priority-${task.priority}">${pIcon} &nbsp;${pText}</span>`;
    }
    
    // Novo formato de data: Data de criação globalmente visível
    let creationDateStr = task.dayId || dayIdContext;
    badgesHtml += `<span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text-secondary);"><i class='bx bx-calendar-plus'></i> Criado: ${formatDateBR(creationDateStr)}</span>`;

    if(!isKanban && task.brand && task.brand !== "Sem Marca") {
        badgesHtml += `<span class="badge brand"><i class='bx bx-tag'></i> ${task.brand}</span>`;
    }

    if(task.status !== 'completed') {
        const refDateStr = task.deadline || task.dayId || dayIdContext;
        if(refDateStr) {
            const todayStr = window.formatDate ? window.formatDate(new Date()) : new Date().toISOString().split('T')[0];
            if(refDateStr < todayStr) {
                const [y, m, d] = refDateStr.split('-').map(Number);
                const refDateObj = new Date(y, m - 1, d);
                const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
                const diffTime = todayMidnight - refDateObj;
                const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                badgesHtml += `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: var(--danger-color); font-weight: 600;"><i class='bx bx-alarm'></i> Vencida há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}</span>`;
            }
        }
    }

    let assigneesHtml = '';
    if(task.assignees && task.assignees.length > 0) {
        const assigneeNames = task.assignees.map(email => window.userEmailToName[email] || email);
        assigneesHtml = `<div class="task-assignees"><i class='bx bx-user'></i> ${assigneeNames.join(', ')}</div>`;
    }

    let commentsHtml = '';
    if(task.comments) {
        commentsHtml = `<div class="task-comments">${task.comments}</div>`;
    }

    let deadlineHtml = '';
    if(task.deadline) {
        deadlineHtml = `<div style="font-size: 0.8rem; color: var(--warning-color); margin-top: 4px;"><i class='bx bx-time'></i> Prazo: ${formatDateBR(task.deadline)}</div>`;
    }

    let feedbackHtml = '';
    if(isCompleted) {
        const refPathEncoded = (task.refPath || `days/${dayIdContext}/tasks/${task.id}`).replace(/'/g, "\\'" );
        let completedAtStr = '';
        if(task.completedAt) {
            const dt = new Date(task.completedAt);
            completedAtStr = `<span style="opacity:0.6; font-size:0.75rem; margin-left:0.5rem;">${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>`;
        }
        feedbackHtml = `
            <div class="task-completion-feedback">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.3rem;">
                    <strong><i class='bx bx-check-circle'></i> Resumo da Conclusão ${completedAtStr}</strong>
                    <button onclick="event.stopPropagation(); openFeedbackModal('${refPathEncoded}', this)" title="Editar feedback" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer; font-size:0.9rem; padding:0.2rem;"><i class='bx bx-edit-alt'></i></button>
                </div>
                <span class="feedback-text">${task.completionFeedback || '<em style="opacity:0.5;">Sem anotação. Clique no lápis para adicionar.</em>'}</span>
            </div>
        `;
    }

    if(isKanban) {
        div.innerHTML = `
            <div class="task-content-wrapper">
                <div class="task-title-row">
                    <div style="display: flex; flex-direction: column;">
                        <span class="task-title">${task.text}</span>
                        ${task.subtitle ? `<span class="task-subtitle" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">${task.subtitle}</span>` : ''}
                    </div>
                </div>
                <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                    ${badgesHtml ? `<div class="task-badges" style="margin-top: 0;">${badgesHtml}</div>` : ''}
                    ${assigneesHtml}
                    ${deadlineHtml ? deadlineHtml.replace('margin-top: 4px;', 'margin-top: 0;') : ''}
                </div>
                ${feedbackHtml}
            </div>
            <div class="kanban-actions">
                <button class="kanban-action-btn edit-btn" onclick="editTask('${refPath}')" title="Editar"><i class='bx bx-edit-alt'></i></button>
                <button class="kanban-action-btn finish-btn" onclick="promptCompleteTask('${refPath}', '${task.status}')">${isCompleted ? 'Desfazer ↺' : 'Concluir ✅'}</button>
            </div>
        `;
    } else {
        div.innerHTML = `
            <div class="task-content-wrapper" style="width: 100%;">
                <div class="task-title-row">
                    <div style="display: flex; flex-direction: column;">
                        <span class="task-title">${task.text}</span>
                        ${task.subtitle ? `<span class="task-subtitle" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">${task.subtitle}</span>` : ''}
                    </div>
                </div>
                <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.8rem; margin-top: 0.5rem;">
                    ${badgesHtml ? `<div class="task-badges" style="margin-top: 0;">${badgesHtml}</div>` : ''}
                    ${assigneesHtml}
                    ${deadlineHtml ? deadlineHtml.replace('margin-top: 4px;', 'margin-top: 0;') : ''}
                </div>
                ${commentsHtml}
                ${feedbackHtml}
                <div class="kanban-actions" style="margin-top: 1rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.05);">
                    <button class="kanban-action-btn edit-btn" onclick="editTask('${refPath}')" title="Editar"><i class='bx bx-edit-alt'></i></button>
                    <button class="kanban-action-btn delete-btn" onclick="deleteTaskGlobal('${refPath}')" title="Excluir"><i class='bx bx-trash'></i></button>
                    <button class="kanban-action-btn finish-btn" onclick="promptCompleteTask('${refPath}', '${task.status}')">${isCompleted ? 'Desfazer ↩️' : 'Concluir ✅'}</button>
                </div>
            </div>
        `;
    }

    return div;
}

// ----------------------------------------------------
// ACTIONS GLOBAIS DE DELEÇÃO/STATUS E FEEDBACK DE CONCLUSÃO
// ----------------------------------------------------
var completingTaskRefPath = null;

window.toggleTaskStatus = async function(taskId, currentStatus) {
    if (currentStatus === 'completed') {
        await window.db.doc(`days/${activeDateStr}/tasks/${taskId}`).update({ status: 'pending' });
    } else {
        completingTaskRefPath = `days/${activeDateStr}/tasks/${taskId}`;
        openCompletionModal();
    }
}

window.promptCompleteTask = function(refPath, currentStatus) {
    if (currentStatus === 'completed') {
        // Se já está concluída, reabrir diretamente (desfazer)
        toggleTaskStatusGlobal(refPath, currentStatus);
    } else {
        // Se está pendente e vamos concluir, abrir pop-up de feedback
        completingTaskRefPath = refPath;
        document.getElementById('completion-modal-title').textContent = 'Concluir Tarefa';
        document.getElementById('completion-feedback').value = '';
        document.getElementById('completion-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('completion-feedback').focus(), 100);
    }
}

window.toggleTaskStatusGlobal = async function(refPath, currentStatus) {
    const task = window.allGlobalTasks ? window.allGlobalTasks.find(t => (t.refPath || `days/${t.dayId}/tasks/${t.id}`) === refPath) : null;
    if(currentStatus === 'completed') {
        await window.db.doc(refPath).update({ status: 'pending', completedAt: firebase.firestore.FieldValue.delete() });
        if(task && window.logUserAction) window.logUserAction(`reabriu a tarefa "${task.text}" da marca ${task.brand || 'Sem Marca'}`);
    } else {
        await window.db.doc(refPath).update({ status: 'completed', completedAt: Date.now() });
        if(task && window.logUserAction) window.logUserAction(`concluiu a tarefa "${task.text}" da marca ${task.brand || 'Sem Marca'}`);
    }
}

window.openFeedbackModal = function(refPath, btnEl) {
    // Pegar o texto atual do feedback
    const feedbackSpan = btnEl.closest('.task-completion-feedback').querySelector('.feedback-text');
    const currentFeedback = feedbackSpan ? (feedbackSpan.querySelector('em') ? '' : feedbackSpan.textContent.trim()) : '';
    
    completingTaskRefPath = refPath;
    document.getElementById('completion-feedback').value = currentFeedback;
    document.getElementById('completion-modal-title').textContent = 'Editar Anotação de Conclusão';
    document.getElementById('completion-modal').classList.remove('hidden');
    document.getElementById('completion-feedback').focus();
}

function openCompletionModal() {
    document.getElementById('completion-feedback').value = '';
    document.getElementById('completion-modal-title').textContent = 'Concluir Tarefa';
    document.getElementById('completion-modal').classList.remove('hidden');
    document.getElementById('completion-feedback').focus();
}

window.closeCompletionModal = function() {
    document.getElementById('completion-modal').classList.add('hidden');
    completingTaskRefPath = null;
}

window.confirmTaskCompletion = async function() {
    if(!completingTaskRefPath) return;
    const feedback = document.getElementById('completion-feedback').value.trim();
    
    // Verifica se já está concluída (edição de feedback) ou se está concluindo agora
    const taskDoc = await window.db.doc(completingTaskRefPath).get();
    const isAlreadyCompleted = taskDoc.exists && taskDoc.data().status === 'completed';
    
    const updateData = { completionFeedback: feedback };
    if(!isAlreadyCompleted) {
        updateData.status = 'completed';
        updateData.completedAt = Date.now();
    }
    
    await window.db.doc(completingTaskRefPath).update(updateData);
    closeCompletionModal();
    window.showNotification(isAlreadyCompleted ? 'Anotação atualizada com sucesso!' : 'Tarefa concluída com sucesso!');
}

window.deleteTask = async function(taskId) {
    if(confirm("Tem certeza que deseja excluir esta tarefa?")) {
        await window.db.doc(`days/${activeDateStr}/tasks/${taskId}`).delete();
        window.showNotification('Tarefa excluída com sucesso!');
    }
}

window.deleteTaskGlobal = async function(refPath) {
    if(confirm("Tem certeza que deseja excluir esta tarefa?")) {
        const task = window.allGlobalTasks ? window.allGlobalTasks.find(t => (t.refPath || `days/${t.dayId}/tasks/${t.id}`) === refPath) : null;
        await window.db.doc(refPath).delete();
        if(task && window.logUserAction) window.logUserAction(`deletou a tarefa "${task.text}" da marca ${task.brand || 'Sem Marca'}`);
        window.showNotification('Tarefa excluída com sucesso!');
    }
}

window.navigateDay = function(offset) {
    if(!activeDateStr) return;
    
    // Parse YYYY-MM-DD
    const parts = activeDateStr.split('-');
    if(parts.length !== 3) return;
    
    // Create date object at noon to avoid timezone shift issues
    const currentDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    currentDate.setDate(currentDate.getDate() + offset);
    
    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getDate()).padStart(2, '0');
    const newDateStr = `${yyyy}-${mm}-${dd}`;
    
    // Load the new day
    selectDate(newDateStr);
    
    // Highlight the new day in the calendar grid if visible
    const cell = document.querySelector(`.calendar-day[data-date="${newDateStr}"]`);
    if(cell) {
        document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
        cell.classList.add('selected');
    }
}

window.navigateDashboardDay = function(offset) {
    window.navigateDay(offset);
}

window.openTaskModalForDashboardDay = function() {
    if(!activeDateStr) {
        activeDateStr = formatDate(new Date());
    }
    openTaskModal();
}

// ----------------------------------------------------
// USER PROFILE LOGIC
// ----------------------------------------------------
window.openProfileModal = async function() {
    const email = localStorage.getItem('empresa_auth_user');
    if(!email) return;

    try {
        const doc = await window.db.collection('users').doc(email).get();
        if(doc.exists) {
            const data = doc.data();
            document.getElementById('profile-email').value = data.email || email;
            document.getElementById('profile-username').value = data.username || '';
            document.getElementById('profile-password').value = data.password || '';
            document.getElementById('profile-error').textContent = '';
            document.getElementById('profile-modal').classList.remove('hidden');
        }
    } catch (err) {
        console.error("Erro ao carregar perfil:", err);
    }
}

window.closeProfileModal = function() {
    document.getElementById('profile-modal').classList.add('hidden');
}

window.saveProfileChanges = async function() {
    const email = document.getElementById('profile-email').value;
    const username = document.getElementById('profile-username').value.trim();
    const password = document.getElementById('profile-password').value.trim();
    const errorMsg = document.getElementById('profile-error');

    errorMsg.textContent = '';

    if(!username || !password) {
        errorMsg.textContent = "Nome/Login e Senha não podem ficar em branco.";
        return;
    }

    try {
        await window.db.collection('users').doc(email).set({
            username: username,
            password: password
        }, { merge: true });

        localStorage.setItem('empresa_auth_username', username);
        updateUserHeader();

        closeProfileModal();
        alert("Perfil atualizado com sucesso!");
    } catch (err) {
        console.error("Erro ao salvar perfil:", err);
        errorMsg.textContent = "Erro ao salvar alterações.";
    }
}

// ----------------------------------------------------
/* ====================================================
   DASHBOARD VISUAL SYSTEM CONTROLLER
   ==================================================== */
// ----------------------------------------------------
window.updateDashboardFilterBrands = function() {
    // Dashboard Filter
    const list = document.getElementById('cms-brand-list');
    if(list) {
        const checkedVals = window.getCMSValues('cms-brand');
        list.innerHTML = '';
        brands.forEach(b => {
            const isChecked = checkedVals.includes(b) ? 'checked' : '';
            list.innerHTML += `<label class="cms-option"><input type="checkbox" value="${b}" onchange="updateCMSLabel('cms-brand'); renderDashboard();" ${isChecked}> ${b}</label>`;
        });
        window.updateCMSLabel('cms-brand');
    }

    // Brand View Filter
    const brandSelect = document.getElementById('brand-filter-brand');
    if(brandSelect) {
        const currentBrandVal = brandSelect.value || currentViewBrand;
        brandSelect.innerHTML = '<option value="Todas">Todas Marcas</option>';
        brands.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            brandSelect.appendChild(opt);
        });
        if(brands.includes(currentBrandVal) || currentBrandVal === 'Todas') {
            brandSelect.value = currentBrandVal;
        } else if(currentViewBrand && brands.includes(currentViewBrand)) {
            brandSelect.value = currentViewBrand;
        } else {
            brandSelect.value = 'Todas';
        }
    }

    // Kanban View Filter
    const kanbanList = document.getElementById('cms-kanban-brand-list');
    if(kanbanList) {
        const checkedVals = window.getCMSValues('cms-kanban-brand');
        kanbanList.innerHTML = '';
        brands.forEach(b => {
            const isChecked = checkedVals.includes(b) ? 'checked' : '';
            kanbanList.innerHTML += `<label class="cms-option"><input type="checkbox" value="${b}" onchange="updateCMSLabel('cms-kanban-brand'); renderKanban();" ${isChecked}> ${b}</label>`;
        });
        window.updateCMSLabel('cms-kanban-brand');
    }

    // Brand View Filter
    const brandViewList = document.getElementById('cms-brandview-brand-list');
    if(brandViewList) {
        const checkedVals = window.getCMSValues('cms-brandview-brand');
        brandViewList.innerHTML = '';
        brands.forEach(b => {
            const isChecked = checkedVals.includes(b) || (checkedVals.length === 0 && b === currentViewBrand) ? 'checked' : '';
            brandViewList.innerHTML += `<label class="cms-option"><input type="checkbox" value="${b}" onchange="updateCMSLabel('cms-brandview-brand'); renderBrandTasks();" ${isChecked}> ${b}</label>`;
        });
        window.updateCMSLabel('cms-brandview-brand');
    }

    // Day View Filter
    const dayViewList = document.getElementById('cms-dayview-brand-list');
    if(dayViewList) {
        const checkedVals = window.getCMSValues('cms-dayview-brand');
        dayViewList.innerHTML = '';
        brands.forEach(b => {
            const isChecked = checkedVals.includes(b) ? 'checked' : '';
            dayViewList.innerHTML += `<label class="cms-option"><input type="checkbox" value="${b}" onchange="updateCMSLabel('cms-dayview-brand'); renderTasks();" ${isChecked}> ${b}</label>`;
        });
        window.updateCMSLabel('cms-dayview-brand');
    }
}

window.filterByBrandViewBrand = function(val) {
    if(val === 'Todas') {
        switchTab('dashboard');
    } else {
        selectBrandView(val);
    }
}

window.filterByKanbanBrand = function(val) {
    renderKanban();
}

// ----------------------------------------------------
// UTILITÁRIOS GLOBAIS DE DATA PARA FILTROS
// ----------------------------------------------------
function getWeekBoundaries() {
    const now = new Date();
    // Obtém o Domingo da semana atual de forma segura sem sofrer mutações indesejadas
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay(), 0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
    return { start, end };
}

function isOverdueGlobal(t, todayStr) {
    if(t.status === 'completed') return false;
    const refDate = t.deadline || t.dayId;
    return refDate < todayStr;
}

function isCurrentWeekGlobal(dateStr) {
    if(!dateStr) return false;
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setHours(12, 0, 0, 0); // Evita qualquer variação de DST ou fuso
    const { start, end } = getWeekBoundaries();
    return date >= start && date <= end;
}

function isCurrentMonthGlobal(dateStr) {
    if(!dateStr) return false;
    const [y, m] = dateStr.split('-');
    const now = new Date();
    return parseInt(y) === now.getFullYear() && parseInt(m) === (now.getMonth() + 1);
}

window.updateDashboardFilterAssignees = function() {
    const list = document.getElementById('cms-assignee-list');
    if(list) {
        const checkedVals = window.getCMSValues('cms-assignee');
        list.innerHTML = '';
        assignees.forEach(a => {
            const isChecked = checkedVals.includes(a) ? 'checked' : '';
            list.innerHTML += `<label class="cms-option"><input type="checkbox" value="${a}" onchange="updateCMSLabel('cms-assignee'); renderDashboard();" ${isChecked}> ${window.userEmailToName[a] || a}</label>`;
        });
        window.updateCMSLabel('cms-assignee');
    }

    const kanbanList = document.getElementById('cms-kanban-assignee-list');
    if(kanbanList) {
        const checkedVals = window.getCMSValues('cms-kanban-assignee');
        kanbanList.innerHTML = '';
        assignees.forEach(a => {
            const isChecked = checkedVals.includes(a) ? 'checked' : '';
            kanbanList.innerHTML += `<label class="cms-option"><input type="checkbox" value="${a}" onchange="updateCMSLabel('cms-kanban-assignee'); renderKanban();" ${isChecked}> ${window.userEmailToName[a] || a}</label>`;
        });
        window.updateCMSLabel('cms-kanban-assignee');
    }

    const brandViewList = document.getElementById('cms-brandview-assignee-list');
    if(brandViewList) {
        const checkedVals = window.getCMSValues('cms-brandview-assignee');
        brandViewList.innerHTML = '';
        assignees.forEach(a => {
            const isChecked = checkedVals.includes(a) ? 'checked' : '';
            brandViewList.innerHTML += `<label class="cms-option"><input type="checkbox" value="${a}" onchange="updateCMSLabel('cms-brandview-assignee'); renderBrandTasks();" ${isChecked}> ${window.userEmailToName[a] || a}</label>`;
        });
        window.updateCMSLabel('cms-brandview-assignee');
    }

    // Day View Filter
    const dayViewList = document.getElementById('cms-dayview-assignee-list');
    if(dayViewList) {
        const checkedVals = window.getCMSValues('cms-dayview-assignee');
        dayViewList.innerHTML = '';
        assignees.forEach(a => {
            const isChecked = checkedVals.includes(a) ? 'checked' : '';
            dayViewList.innerHTML += `<label class="cms-option"><input type="checkbox" value="${a}" onchange="updateCMSLabel('cms-dayview-assignee'); renderTasks();" ${isChecked}> ${window.userEmailToName[a] || a}</label>`;
        });
        window.updateCMSLabel('cms-dayview-assignee');
    }
}

window.quickUpdateTaskStatus = async function(refPath, nextStatus) {
    try {
        const updateData = { status: nextStatus };
        if (nextStatus === 'completed') {
            updateData.completedAt = Date.now();
        } else {
            updateData.completedAt = firebase.firestore.FieldValue.delete();
        }
        await window.db.doc(refPath).update(updateData);
    } catch(err) {
        console.error("Erro ao atualizar status do card:", err);
    }
}

window.toggleTimelineExtraTasks = function(btn) {
    const parent = btn.closest('.db-timeline-node');
    if(!parent) return;
    const extraTasks = parent.querySelectorAll('.timeline-task-item');
    let isShowingAll = false;
    extraTasks.forEach((task, index) => {
        if(index >= 4) {
            if(task.style.display === 'none') {
                task.style.display = 'flex';
                isShowingAll = true;
            } else {
                task.style.display = 'none';
            }
        }
    });
    
    if(isShowingAll) {
        btn.innerHTML = `<i class='bx bx-minus-circle' style='font-size: 0.95rem; vertical-align: middle;'></i> Ocultar tarefas extras`;
    } else {
        const count = extraTasks.length - 4;
        btn.innerHTML = `<i class='bx bx-plus-circle' style='font-size: 0.95rem; vertical-align: middle;'></i> + ${count} outras tarefas...`;
    }
}

window.renderDashboard = function() {
    if(!window.allGlobalTasks || !viewDashboard.classList.contains('active')) return;

    const todayStr = formatDate(new Date());
    // 1. Obter filtros ativos do Dashboard
    const priorityFilters = window.getCMSValues('cms-priority');
    const assigneeFilters = window.getCMSValues('cms-assignee');
    const brandFilters = window.getCMSValues('cms-brand');
    const periodFilter = window.getCMSValueSingle('cms-period');

    // Utilitários de data
    const isOverdue = (t) => {
        return isOverdueGlobal(t, todayStr);
    };

    const isCurrentWeek = (dateStr) => {
        return isCurrentWeekGlobal(dateStr);
    };

    const isCurrentMonth = (dateStr) => {
        return isCurrentMonthGlobal(dateStr);
    };

    // 2. Filtrar base de tarefas pelas marcas, responsáveis e prioridade (para estatísticas e grids)
    const baseFilteredTasks = window.allGlobalTasks.filter(t => {
        if (priorityFilters.length > 0 && !priorityFilters.includes(t.priority)) return false;
        if (brandFilters.length > 0 && !brandFilters.includes(t.brand)) return false;
        if (assigneeFilters.length > 0) {
            const hasAssignee = t.assignees && t.assignees.some(a => assigneeFilters.includes(a));
            const isCreator = t.createdBy && assigneeFilters.includes(t.createdBy);
            if (!hasAssignee && !isCreator) return false;
        }
        if(!window.applyGlobalSearchFilter(t)) return false;
        return true;
    });

    // 3. Calcular métricas para os cards de estatísticas superiores
    let countToday = 0;
    let countWeek = 0;
    let countMonth = 0;
    let countOverdue = 0;
    let countCompleted = 0;
    let countTotal = baseFilteredTasks.length;

    const tomorrowObj = new Date(); tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = formatDate(tomorrowObj);

    baseFilteredTasks.forEach(t => {
        if (t.dayId === todayStr || t.deadline === todayStr) countToday++;
        if (isCurrentWeek(t.dayId) || isCurrentWeek(t.deadline)) countWeek++;
        if (isCurrentMonth(t.dayId) || isCurrentMonth(t.deadline)) countMonth++;
        if (isOverdue(t)) countOverdue++;
        if (t.status === 'completed') countCompleted++;
    });

    // Injetar valores nos cards
    if(document.getElementById('db-stat-today')) document.getElementById('db-stat-today').textContent = countToday;
    if(document.getElementById('db-stat-week')) document.getElementById('db-stat-week').textContent = countWeek;
    if(document.getElementById('db-stat-month')) document.getElementById('db-stat-month').textContent = countMonth;
    if(document.getElementById('db-stat-overdue')) document.getElementById('db-stat-overdue').textContent = countOverdue;
    if(document.getElementById('db-stat-completed')) document.getElementById('db-stat-completed').textContent = countCompleted;
    if(document.getElementById('db-stat-total')) document.getElementById('db-stat-total').textContent = countTotal;

    // 4. Filtrar tarefas específicas do período selecionado
    const periodTasks = baseFilteredTasks.filter(t => {
        if (periodFilter === 'today') return t.dayId === todayStr || t.deadline === todayStr;
        if (periodFilter === 'tomorrow') return t.dayId === tomorrowStr || t.deadline === tomorrowStr;
        if (periodFilter === 'week') return isCurrentWeek(t.dayId) || isCurrentWeek(t.deadline);
        if (periodFilter === 'month') return isCurrentMonth(t.dayId) || isCurrentMonth(t.deadline);
        if (periodFilter === 'overdue') return isOverdue(t);
        return true; // 'all'
    });

    // 5. Atualizar Quadro: Operação e Destaques (Progresso + Lista de tarefas ordenada)
    const totalPeriodCount = periodTasks.length;
    const completedPeriodCount = periodTasks.filter(t => t.status === 'completed').length;
    const pendingPeriodTasks = periodTasks.filter(t => t.status !== 'completed');
    const percentPeriod = totalPeriodCount > 0 ? Math.round((completedPeriodCount / totalPeriodCount) * 100) : 0;

    if (document.getElementById('db-progress-text')) {
        document.getElementById('db-progress-text').textContent = `Progresso de Conclusão: ${percentPeriod}%`;
    }
    if (document.getElementById('db-progress-fraction')) {
        document.getElementById('db-progress-fraction').textContent = `${completedPeriodCount} / ${totalPeriodCount} Concluídas`;
    }
    if (document.getElementById('db-progress-fill')) {
        document.getElementById('db-progress-fill').style.width = `${percentPeriod}%`;
    }

    // Contagem de prioridades pendentes no período
    let highCount = 0, mediumCount = 0, lowCount = 0;
    pendingPeriodTasks.forEach(t => {
        if(t.priority === 'high') highCount++;
        else if(t.priority === 'medium') mediumCount++;
        else lowCount++;
    });

    if(document.getElementById('db-today-high')) document.getElementById('db-today-high').textContent = `${highCount} Alta`;
    if(document.getElementById('db-today-medium')) document.getElementById('db-today-medium').textContent = `${mediumCount} Média`;
    if(document.getElementById('db-today-low')) document.getElementById('db-today-low').textContent = `${lowCount} Baixa`;

    // Ordenar e renderizar lista prioritária
    const priorityValue = { high: 3, medium: 2, low: 1 };
    const sortFn = (a, b) => {
        if(a.status === 'completed' && b.status !== 'completed') return 1;
        if(a.status !== 'completed' && b.status === 'completed') return -1;
        const pA = priorityValue[a.priority || 'medium'] || 2;
        const pB = priorityValue[b.priority || 'medium'] || 2;
        if (pA !== pB) return pB - pA;
        return (a.deadline || a.dayId || '').localeCompare(b.deadline || b.dayId || '');
    };

    const sortedPeriodTasks = [...periodTasks].sort(sortFn);
    const todayTasksListEl = document.getElementById('db-today-tasks-list');
    if (todayTasksListEl) {
        todayTasksListEl.innerHTML = '';
        if(sortedPeriodTasks.length === 0) {
            todayTasksListEl.innerHTML = '<div class="empty-state" style="padding:1.5rem;"><i class="bx bx-check-double"></i><p>Nenhuma tarefa no período selecionado.</p></div>';
        } else {
            sortedPeriodTasks.forEach(task => {
                const cardEl = createTaskDOM(task, task.dayId, false);
                // Permite clicar na tarefa para abrir detalhes/editar
                cardEl.style.cursor = 'pointer';
                cardEl.addEventListener('click', (e) => {
                    // Evita disparar ao clicar em botões internos de deletar/concluir
                    if(!e.target.closest('button')) {
                        editTask(task.refPath);
                    }
                });
                todayTasksListEl.appendChild(cardEl);
            });
        }
    }

    // 6. Atualizar Quadro: Tarefas Atrasadas
    const overdueTasks = baseFilteredTasks.filter(isOverdue).sort((a,b) => {
        const pA = priorityValue[a.priority || 'medium'] || 2;
        const pB = priorityValue[b.priority || 'medium'] || 2;
        if (pA !== pB) return pB - pA;
        return (a.deadline || a.dayId || '').localeCompare(b.deadline || b.dayId || '');
    });

    if (document.getElementById('db-overdue-count-badge')) {
        document.getElementById('db-overdue-count-badge').textContent = `${overdueTasks.length} Vencidas`;
    }

    const overdueListEl = document.getElementById('db-overdue-tasks-list');
    if (overdueListEl) {
        overdueListEl.innerHTML = '';
        if(overdueTasks.length === 0) {
            overdueListEl.innerHTML = '<div class="empty-state" style="padding:1.5rem;"><i class="bx bx-smile"></i><p>Tudo em dia! Sem pendências atrasadas.</p></div>';
        } else {
            overdueTasks.forEach(task => {
                const cardEl = createTaskDOM(task, task.dayId, false);
                cardEl.style.cursor = 'pointer';
                cardEl.addEventListener('click', (e) => {
                    if(!e.target.closest('button')) editTask(task.refPath);
                });

                overdueListEl.appendChild(cardEl);
            });
        }
    }

    // 7. Atualizar Quadro: Timeline Rápida (HOJE, SEMANA, PRÓXIMA SEMANA, ESTE MÊS, FUTURO)
    const timelineListEl = document.getElementById('db-timeline-list');
    if(timelineListEl) {
        timelineListEl.innerHTML = '';
        
        const { end: endOfWeekObj } = getWeekBoundaries();
        const endOfWeekStr = formatDate(endOfWeekObj);

        const endOfNextWeekObj = new Date(endOfWeekObj);
        endOfNextWeekObj.setDate(endOfNextWeekObj.getDate() + 7);
        const endOfNextWeekStr = formatDate(endOfNextWeekObj);

        const now = new Date();
        const endOfMonthObj = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const endOfMonthStr = formatDate(endOfMonthObj);

        const timelineToday = periodTasks.filter(t => 
            t.status !== 'completed' && 
            (t.dayId === todayStr || t.deadline === todayStr)
        );
        const timelineWeek = periodTasks.filter(t => {
            if(t.status === 'completed') return false;
            const dateStr = t.deadline || t.dayId;
            return dateStr > todayStr && dateStr <= endOfWeekStr;
        });
        const timelineMonth = periodTasks.filter(t => {
            if(t.status === 'completed') return false;
            const dateStr = t.deadline || t.dayId;
            return dateStr > endOfWeekStr && dateStr <= endOfMonthStr;
        });
        const timelineNextWeek = periodTasks.filter(t => {
            if(t.status === 'completed') return false;
            const dateStr = t.deadline || t.dayId;
            return dateStr > endOfMonthStr && dateStr <= endOfNextWeekStr;
        });
        const timelineFuture = periodTasks.filter(t => {
            if(t.status === 'completed') return false;
            const dateStr = t.deadline || t.dayId;
            return dateStr > endOfNextWeekStr && dateStr > endOfMonthStr;
        });

        const sortTimelineFn = (a, b) => {
            return (a.deadline || a.dayId || '').localeCompare(b.deadline || b.dayId || '');
        };
        timelineToday.sort(sortTimelineFn);
        timelineWeek.sort(sortTimelineFn);
        timelineMonth.sort(sortTimelineFn);
        timelineNextWeek.sort(sortTimelineFn);
        timelineFuture.sort(sortTimelineFn);

        const renderTimelineNode = (title, list, typeClass, icon) => {
            if(list.length === 0) return;
            const node = document.createElement('div');
            node.className = `db-timeline-node ${typeClass}`;
            
            let tasksList = '';
            list.forEach((t, index) => {
                let badgeColor = t.priority === 'high' ? 'red' : t.priority === 'medium' ? 'orange' : 'green';
                let priorityLabel = t.priority === 'high' ? 'Alta' : t.priority === 'medium' ? 'Média' : 'Baixa';
                const isExtra = index >= 4;
                const safeRefPath = (t.refPath || `days/${t.dayId}/tasks/${t.id}`).replace(/'/g, "\\'");
                tasksList += `
                    <div class="timeline-task-item" style="font-size:0.78rem; display:${isExtra ? 'none' : 'flex'}; flex-direction:column; gap:4px; background:rgba(255,255,255,0.02); padding:0.45rem 0.6rem; border-radius:8px; border:1px solid rgba(255,255,255,0.04); cursor:pointer; margin-bottom: 0.4rem; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'" onclick="editTask('${safeRefPath}')">
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem;">
                            <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:0;">
                                <button onclick="event.stopPropagation(); promptCompleteTask('${safeRefPath}', '${t.status}')" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer; font-size:1.15rem; padding:0; display:flex; align-items:center; transition: color 0.2s;" onmouseover="this.style.color='var(--accent-color)'" onmouseout="this.style.color='var(--text-secondary)'" title="Concluir Tarefa">
                                    <i class='bx bx-circle'></i>
                                </button>
                                <span style="font-weight:600; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.text}</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:0.4rem; flex-shrink:0;">
                                <span style="font-size:0.65rem; color:${badgeColor}; font-weight:700; text-transform:uppercase;">${priorityLabel}</span>
                                <button onclick="event.stopPropagation(); editTask('${safeRefPath}')" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); color:var(--text-secondary); cursor:pointer; font-size:0.95rem; padding:2px 6px; border-radius:4px; display:flex; align-items:center; transition: all 0.2s;" onmouseover="this.style.color='var(--accent-color)'; this.style.borderColor='var(--accent-color)'" onmouseout="this.style.color='var(--text-secondary)'; this.style.borderColor='rgba(255,255,255,0.08)'" title="Editar Tarefa">
                                    <i class='bx bx-edit-alt'></i>
                                </button>
                            </div>
                        </div>
                        ${t.subtitle ? `<span style="font-size:0.72rem; color:var(--text-secondary); margin-left:1.65rem;">${t.subtitle}</span>` : ''}
                    </div>
                `;
            });
            if(list.length > 4) {
                tasksList += `
                    <button class="btn-show-more-tasks" onclick="event.stopPropagation(); toggleTimelineExtraTasks(this)" style="background:transparent; border:none; color:var(--accent-color); font-size:0.75rem; font-weight:600; text-align:left; cursor:pointer; padding:0.25rem 0; display:flex; align-items:center; gap:0.25rem; transition:color 0.2s; margin-left:0.25rem; outline:none;">
                        <i class='bx bx-plus-circle' style='font-size: 0.95rem; vertical-align: middle;'></i> + ${list.length - 4} outras tarefas...
                    </button>
                `;
            }

            node.innerHTML = `
                <div class="db-timeline-circle"></div>
                <div class="node-title">${icon} ${title} (${list.length})</div>
                <div class="db-timeline-tasks">${tasksList}</div>
            `;
            timelineListEl.appendChild(node);
        };

        renderTimelineNode('HOJE', timelineToday, 'today', "<i class='bx bx-calendar-star'></i>");
        renderTimelineNode('SEMANA', timelineWeek, 'future', "<i class='bx bx-calendar'></i>");
        renderTimelineNode('ESTE MÊS', timelineMonth, 'future', "<i class='bx bx-calendar-event'></i>");
        renderTimelineNode('PRÓXIMA SEMANA', timelineNextWeek, 'future', "<i class='bx bx-calendar-check'></i>");
        renderTimelineNode('FUTURO', timelineFuture, 'future', "<i class='bx bx-rocket'></i>");

        if(timelineListEl.children.length === 0) {
            timelineListEl.innerHTML = '<div class="empty-state" style="padding:1.5rem;"><i class="bx bx-check-double"></i><p>Tudo limpo! Nenhuma atividade pendente.</p></div>';
        }
    }

    // 9. Atualizar Quadro: Carga de Responsáveis (Workload Team Analyzer)
    const teamListEl = document.getElementById('db-team-list');
    if(teamListEl) {
        teamListEl.innerHTML = '';
        if(assignees.length === 0) {
            teamListEl.innerHTML = '<div style="opacity:0.4; font-size:0.8rem; text-align:center; padding:1.5rem;">Nenhum responsável cadastrado.</div>';
        } else {
            assignees.forEach(memberEmail => {
                const memberTasks = window.allGlobalTasks.filter(t => t.assignees && t.assignees.includes(memberEmail) && t.status !== 'completed');
                const memberOverdue = memberTasks.filter(isOverdue);
                const pendingCount = memberTasks.length;
                const overdueCount = memberOverdue.length;

                let workloadPill = '';
                if(pendingCount === 0) {
                    workloadPill = `<span class="stat-pill pill-status-ok"><i class='bx bx-check'></i> Ok</span>`;
                } else if (pendingCount <= 3) {
                    workloadPill = `<span class="stat-pill pill-pending">${pendingCount} Pendente${pendingCount > 1 ? 's' : ''}</span>`;
                } else if (pendingCount <= 6) {
                    workloadPill = `<span class="stat-pill pill-status-heavy">${pendingCount} Carga</span>`;
                } else {
                    workloadPill = `<span class="stat-pill pill-status-critical">${pendingCount} Crítico</span>`;
                }

                let overduePill = '';
                if(overdueCount > 0) {
                    overduePill = `<span class="stat-pill pill-overdue" style="margin-left:0.25rem;"><i class='bx bx-time'></i> ${overdueCount} Atrasada${overdueCount > 1 ? 's' : ''}</span>`;
                }

                const displayName = memberEmail.split('@')[0];
                const avatarChar = displayName.charAt(0).toUpperCase();

                const item = document.createElement('div');
                item.className = 'team-member-item';
                item.innerHTML = `
                    <div class="member-info">
                        <div class="member-avatar">${avatarChar}</div>
                        <div style="display:flex; flex-direction:column;">
                            <span class="member-name">${displayName}</span>
                            <span class="member-role" style="font-size:0.7rem; color:var(--text-secondary);">${memberEmail}</span>
                        </div>
                    </div>
                    <div class="member-stats">
                        ${workloadPill}
                        ${overduePill}
                    </div>
                `;
                teamListEl.appendChild(item);
            });
        }
    }

    // 10. Atualizar Quadro: Ranking de Prioridades (Críticos & Urgentes)
    const rankingListEl = document.getElementById('db-ranking-list');
    if(rankingListEl) {
        rankingListEl.innerHTML = '';
        
        const criticalTasks = baseFilteredTasks.filter(t => t.status !== 'completed').sort((a, b) => {
            const pA = priorityValue[a.priority || 'medium'] || 2;
            const pB = priorityValue[b.priority || 'medium'] || 2;
            if(pA !== pB) return pB - pA;
            
            const isAOverdue = isOverdue(a) ? 1 : 0;
            const isBOverdue = isOverdue(b) ? 1 : 0;
            if(isAOverdue !== isBOverdue) return isBOverdue - isAOverdue;
            
            return (a.deadline || a.dayId || '').localeCompare(b.deadline || b.dayId || '');
        }).slice(0, 5);

        if(criticalTasks.length === 0) {
            rankingListEl.innerHTML = '<div class="empty-state" style="padding:1rem;"><i class="bx bx-check-double"></i><p>Nenhuma tarefa crítica pendente!</p></div>';
        } else {
            criticalTasks.forEach(task => {
                const cardEl = createTaskDOM(task, task.dayId, false);
                cardEl.style.cursor = 'pointer';
                cardEl.addEventListener('click', (e) => {
                    if(!e.target.closest('button')) editTask(task.refPath);
                });
                rankingListEl.appendChild(cardEl);
            });
        }
    }
}

// Start
init();

// Custom Multi-Select Helper Functions
window.toggleCustomSelect = function(id, event) {
    if(event) event.stopPropagation();
    const dropdown = document.querySelector(`#${id} .cms-dropdown`);
    document.querySelectorAll('.cms-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.add('hidden');
    });
    if (dropdown) dropdown.classList.toggle('hidden');
};

window.addEventListener('click', function(e) {
    if(!e.target.closest('.custom-multi-select')) {
        document.querySelectorAll('.cms-dropdown').forEach(d => {
            d.classList.add('hidden');
        });
    }
});

window.handleGlobalSearch = function() {
    const viewDashboard = document.getElementById('view-dashboard');
    const viewKanban = document.getElementById('view-kanban');
    const viewBrand = document.getElementById('view-brand');
    
    if (viewDashboard && viewDashboard.classList.contains('active')) {
        if (window.renderDashboard) window.renderDashboard();
    }
    if (viewKanban && viewKanban.classList.contains('active')) {
        if (window.renderKanban) window.renderKanban();
    }
    if (viewBrand && viewBrand.classList.contains('active')) {
        if (window.renderBrandTasks && window.currentViewBrand) window.renderBrandTasks();
    }
    const viewDay = document.getElementById('view-day');
    if (viewDay && viewDay.classList.contains('active')) {
        if (window.renderTasks) window.renderTasks();
    }
}

window.applyGlobalSearchFilter = function(t) {
    const searchInput = document.getElementById('global-search-input');
    if (!searchInput) return true;
    const searchQ = searchInput.value.toLowerCase().trim();
    if (!searchQ) return true;
    
    const titleMatch = t.text && t.text.toLowerCase().includes(searchQ);
    const subMatch = t.subtitle && t.subtitle.toLowerCase().includes(searchQ);
    const brandMatch = t.brand && t.brand.toLowerCase().includes(searchQ);
    return titleMatch || subMatch || brandMatch;
}

window.updateCMSLabel = function(id) {
    const container = document.getElementById(id);
    if(!container) return;
    const checked = container.querySelectorAll('input[type="checkbox"]:checked');
    const label = container.querySelector('.cms-label');
    if (checked.length === 0) {
        if(id === 'cms-priority') label.textContent = 'Todas Prioridades';
        if(id === 'cms-assignee') label.textContent = 'Todos Responsáveis';
        if(id === 'cms-brand') label.textContent = 'Todas Marcas';
    } else if (checked.length === 1) {
        label.textContent = checked[0].parentElement.textContent.trim();
    } else {
        label.textContent = `${checked.length} Selecionados`;
    }
};

window.updateCMSLabelSingle = function(id) {
    const container = document.getElementById(id);
    if(!container) return;
    const checked = container.querySelector('input[type="radio"]:checked');
    const label = container.querySelector('.cms-label');
    if (checked) {
        label.textContent = checked.parentElement.textContent.trim();
    }
};

window.getCMSValues = function(id) {
    const container = document.getElementById(id);
    if(!container) return [];
    const checked = Array.from(container.querySelectorAll('input[type="checkbox"]:checked'));
    return checked.map(c => c.value);
};

window.getCMSValueSingle = function(id) {
    const container = document.getElementById(id);
    if(!container) return 'week';
    const checked = container.querySelector('input[type="radio"]:checked');
    return checked ? checked.value : 'week';
};

window.toggleBrandSubGroup = function(id) { const body = document.getElementById(id); const icon = document.getElementById(id + '-icon'); if (body) body.classList.toggle('collapsed'); if (icon) { icon.className = body.classList.contains('collapsed') ? 'bx bx-chevron-down' : 'bx bx-chevron-up'; } };

// Pull to Refresh
function setupPullToRefresh() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    const ptr = document.createElement('div');
    ptr.className = 'ptr-container';
    ptr.innerHTML = `
        <i class='bx bx-down-arrow-alt ptr-icon'></i>
        <span class="ptr-text">Puxe para atualizar</span>
    `;
    document.body.appendChild(ptr);

    const ptrIcon = ptr.querySelector('.ptr-icon');
    const ptrText = ptr.querySelector('.ptr-text');

    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    let isRefreshing = false;
    const threshold = 80;

    const getScrollContainer = (target) => {
        let el = target;
        while (el && el !== document.body) {
            const style = window.getComputedStyle(el);
            if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
                return el;
            }
            el = el.parentElement;
        }
        return mainContent;
    };

    let activeScrollContainer = mainContent;

    document.addEventListener('touchstart', (e) => {
        activeScrollContainer = getScrollContainer(e.target);
        if (activeScrollContainer.scrollTop <= 0 && !isRefreshing) {
            startY = e.touches[0].clientY;
            isPulling = true;
            ptr.style.transition = 'none';
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isPulling || isRefreshing) return;

        currentY = e.touches[0].clientY;
        const pullDistance = currentY - startY;

        if (pullDistance > 0 && activeScrollContainer.scrollTop <= 0) {
            // Prevent default scroll behavior to avoid rubber-banding
            if(e.cancelable) e.preventDefault();

            const translateY = Math.min(pullDistance * 0.4, threshold * 1.5);
            ptr.style.transform = `translateX(-50%) translateY(${translateY - 50}px)`;

            if (translateY >= threshold) {
                ptrIcon.className = 'bx bx-up-arrow-alt ptr-icon';
                ptrText.innerText = 'Solte para atualizar';
            } else {
                ptrIcon.className = 'bx bx-down-arrow-alt ptr-icon';
                ptrText.innerText = 'Puxe para atualizar';
            }
        } else if (pullDistance < 0) {
            isPulling = false;
        }
    }, { passive: false });

    document.addEventListener('touchend', () => {
        if (!isPulling || isRefreshing) return;
        isPulling = false;
        ptr.style.transition = 'transform 0.3s ease';

        const pullDistance = currentY - startY;
        const translateY = Math.min(pullDistance * 0.4, threshold * 1.5);

        if (translateY >= threshold) {
            isRefreshing = true;
            ptr.classList.add('refreshing');
            ptr.style.transform = '';
            ptrIcon.className = 'bx bx-loader-alt ptr-icon spinning';
            ptrText.innerText = 'Atualizando...';

            setTimeout(() => {
                window.location.reload();
            }, 500);
        } else {
            ptr.style.transform = `translateX(-50%) translateY(-100%)`;
        }
        
        startY = 0;
        currentY = 0;
    });
}

// Initialization
setupPullToRefresh();

// ----------------------------------------------------
// LOGS DE ACESSO (BACKLOG) - SOMENTE ADMIN
// ----------------------------------------------------
window.renderAccessLogs = async function() {
    const container = document.getElementById('access-logs-container');
    if (!container) return;

    container.innerHTML = `<div class="empty-state" style="padding: 3rem;"><i class='bx bx-loader-alt bx-spin'></i><p>Carregando logs...</p></div>`;

    try {
        const snapshot = await window.db.collection('access_logs')
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();

        if (snapshot.empty) {
            container.innerHTML = `<div class="empty-state" style="padding: 3rem;"><i class='bx bx-history'></i><p>Nenhum log de acesso registrado ainda.</p></div>`;
            return;
        }

        let html = `<table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <th style="padding: 1rem; color: var(--text-secondary); font-weight: 500;">Data e Hora</th>
                    <th style="padding: 1rem; color: var(--text-secondary); font-weight: 500;">Usuário</th>
                    <th style="padding: 1rem; color: var(--text-secondary); font-weight: 500;">Área / Ação</th>
                </tr>
            </thead>
            <tbody>`;

        snapshot.forEach(doc => {
            const data = doc.data();
            const dateObj = data.timestamp ? data.timestamp.toDate() : new Date();
            const dateStr = dateObj.toLocaleDateString('pt-BR');
            const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const email = data.userEmail || 'Desconhecido';
            const area = data.area || '-';
            
            // Format username
            let displayUser = email;
            if (window.userEmailToName && window.userEmailToName[email]) {
                displayUser = `${window.userEmailToName[email]} <span style="font-size:0.8rem; color:var(--text-secondary);">(${email})</span>`;
            }

            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">
                    <td style="padding: 1rem; white-space: nowrap;">
                        <div style="font-weight: 500;">${dateStr}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);"><i class='bx bx-time-five'></i> ${timeStr}</div>
                    </td>
                    <td style="padding: 1rem;">
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <i class='bx bxs-user-circle' style="color:var(--primary-color); font-size:1.2rem;"></i>
                            <span>${displayUser}</span>
                        </div>
                    </td>
                    <td style="padding: 1rem;">
                        <span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.1);"><i class='bx bx-link-external'></i> ${area}</span>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

    } catch (err) {
        console.error("Erro ao carregar logs:", err);
        container.innerHTML = `<div class="empty-state" style="padding: 3rem; color: var(--danger-color);"><i class='bx bx-error-circle'></i><p>Erro ao carregar os logs. Verifique o console.</p></div>`;
    }
};

window.saveSystemFavicon = async function() {
    const fileInput = document.getElementById('system-favicon-upload');
    const statusEl = document.getElementById('favicon-upload-status');
    if (!fileInput.files || fileInput.files.length === 0) {
        statusEl.textContent = 'Por favor, selecione uma imagem.';
        statusEl.style.color = 'var(--warning-color)';
        return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Str = e.target.result;
        try {
            statusEl.textContent = 'Salvando...';
            statusEl.style.color = 'var(--text-secondary)';
            await window.db.collection('settings').doc('general').set({ faviconBase64: base64Str }, { merge: true });
            applyFavicon(base64Str);
            statusEl.textContent = ' cone salvo com sucesso!';
            statusEl.style.color = 'var(--accent-color)';
            if(window.logUserAction) window.logUserAction('alterou o  cone do sistema (favicon)');
        } catch(err) {
            console.error('Erro ao salvar favicon', err);
            statusEl.textContent = 'Erro ao salvar  cone.';
            statusEl.style.color = 'var(--danger-color)';
        }
    };
    reader.readAsDataURL(file);
};

window.showNotification = function(message, type = 'success') {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        document.body.appendChild(toast);
    }
    const iconClass = type === 'success' ? 'bx bx-check-circle' : 'bx bx-error-circle';
    toast.className = `app-toast ${type} show`;
    toast.innerHTML = `<i class='${iconClass} toast-icon'></i><span>${message}</span>`;
    
    if (window._toastTimeout) clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3200);
};

// ==========================================================================
// MÓDULO DE CLIENTES (Consulta, Filtros, Ficha, Importação e Exportação)
// ==========================================================================

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const CLIENT_BRAND_COLS = ['BAW', 'EVOKE', 'NEW ERA', 'LOST', 'MCD', 'MORMAII', 'STANCE', 'STEP DEFEND', 'VANS'];

window.isClientBrandActive = function(client, brand) {
    if (!client) return false;
    const val = client[brand];
    if (val !== null && val !== undefined && val !== '' && val !== '0' && val !== 0 && val !== false) {
        const sVal = String(val).trim().toUpperCase();
        if (sVal !== 'NAO' && sVal !== 'NÃO' && sVal !== 'NULL' && sVal !== 'UNDEFINED' && sVal !== 'INATIVO') {
            return true; // Contém 'SIM', '1', 'ATIVO' ou o código do cliente (ex: '10311')
        }
    }
    // Caso especial: para NEW ERA, se houver 'CODIGO NEW ERA' preenchido, o cliente fica ativo na marca
    if (brand === 'NEW ERA' && client['CODIGO NEW ERA']) {
        const ne = String(client['CODIGO NEW ERA']).trim();
        if (ne && ne !== '0' && ne.toLowerCase() !== 'null' && ne.toLowerCase() !== 'undefined') {
            return true;
        }
    }
    // Caso especial: para VANS, se houver 'CODIGO AREZZO' preenchido, o cliente fica ativo na marca
    if (brand === 'VANS' && client['CODIGO AREZZO']) {
        const ar = String(client['CODIGO AREZZO']).trim();
        if (ar && ar !== '0' && ar.toLowerCase() !== 'null' && ar.toLowerCase() !== 'undefined') {
            return true;
        }
    }
    return false;
};
const isClientBrandActive = window.isClientBrandActive;

window.getClientGeneralStatus = function(client) {
    if (!client) return 'INATIVO';

    // 1. Campo explícito 'CLIENTE ATIVO?' ou 'STATUS'
    const ativoField = client['CLIENTE ATIVO?'];
    if (ativoField !== undefined && ativoField !== null && ativoField !== '') {
        const s = String(ativoField).trim().toUpperCase();
        if (s === 'NAO' || s === 'NÃO' || s === '0' || s === 'INATIVO' || s.includes('FECHAD')) {
            return 'INATIVO';
        }
        if (s === 'SIM' || s === '1' || s === 'ATIVO') {
            return 'ATIVO';
        }
    }

    const rawStatus = client['STATUS'];
    if (rawStatus !== undefined && rawStatus !== null && rawStatus !== '') {
        const s = String(rawStatus).trim().toUpperCase();
        if (s === 'LOJA_FECHADA' || s === 'LOJA FECHADA' || s === 'FECHADA' || s === 'VERMELHO' || s === 'INATIVO' || s === 'NAO' || s === 'NÃO') {
            return 'INATIVO';
        }
        if (s === 'ATIVO' || s === 'SIM' || s === '1' || s === 'VERDE') {
            return 'ATIVO';
        }
    }

    // 2. Verificar marcas
    let hasActive = false;

    CLIENT_BRAND_COLS.forEach(b => {
        const st = window.getClientBrandStatus(client, b);
        if (st === 'ATIVO' || st === 'NAO_FIDELIZADO') hasActive = true;
    });

    if (hasActive) return 'ATIVO';

    return 'INATIVO';
};

window.getClientBrandStatus = function(client, brand) {
    if (!client) return 'INATIVO';

    const specificStatus = client[brand + '_STATUS'];
    if (specificStatus) {
        const s = String(specificStatus).trim().toUpperCase();
        if (s.includes('FIDELIZAD') || s === 'LARANJA') return 'NAO_FIDELIZADO';
        if (s === 'ATIVO' || s === 'SIM' || s === '1') return 'ATIVO';
        if (s.includes('FECHAD') || s === 'VERMELHO' || s === 'INATIVO' || s === 'NAO' || s === 'NÃO' || s === '0') return 'INATIVO';
    }

    const val = client[brand];
    if (val !== undefined && val !== null && val !== '') {
        const sv = String(val).trim().toUpperCase();
        if (sv.includes('FIDELIZAD') || sv === 'LARANJA') return 'NAO_FIDELIZADO';
        if (sv.includes('FECHAD') || sv === 'VERMELHO' || sv === 'INATIVO' || sv === 'NAO' || sv === 'NÃO' || sv === '0' || sv === 'NULL' || sv === 'UNDEFINED') return 'INATIVO';
    }

    if (window.isClientBrandActive(client, brand)) {
        return 'ATIVO';
    }

    return 'INATIVO';
};

window.renderClientStatusBadge = function(status) {
    if (status === 'INATIVO' || status === 'LOJA_FECHADA' || status === 'NAO') {
        return '<span class="client-status-badge status-loja-fechada" title="Inativa"><i class="bx bx-store-alt"></i> Inativa</span>';
    }
    return '<span class="client-status-badge status-ativo" title="Ativa"><i class="bx bx-check-circle"></i> Ativa</span>';
};

let clientsMasterData = [];
window.clientsMasterData = clientsMasterData;
let clientsFilteredData = [];
let clientsCurrentPage = 1;
let clientsPageSize = 25;
let clientsActiveStatus = 'all';
let clientsActiveBrand = 'all';
let currentModalClient = null;

window.initClientsModule = function() {
    try {
        const savedCustom = localStorage.getItem('empresa_clients_custom_data');
        if (savedCustom) {
            clientsMasterData = JSON.parse(savedCustom);
            // Sincroniza/Mescla com INITIAL_CLIENTS_DATA para carregar novos clientes e códigos inseridos
            if (window.INITIAL_CLIENTS_DATA && Array.isArray(window.INITIAL_CLIENTS_DATA)) {
                const mapByCnpj = new Map();
                clientsMasterData.forEach(c => {
                    const cleanC = cleanDigits(c['CNPJ']);
                    if (cleanC) {
                        // Migra códigos legados que possam estar em cache
                        if (c['CODIGO AREZZO'] && (!c['VANS'] || c['VANS'] === 'SIM' || c['VANS'] === '1')) {
                            c['VANS'] = c['CODIGO AREZZO'];
                        }
                        if (c['CODIGO NEW ERA'] && (!c['NEW ERA'] || c['NEW ERA'] === 'SIM' || c['NEW ERA'] === '1')) {
                            c['NEW ERA'] = c['CODIGO NEW ERA'];
                        }
                        delete c['CODIGO AREZZO'];
                        delete c['CODIGO NEW ERA'];
                        CLIENT_BRAND_COLS.forEach(b => {
                            if (c[b] === 1 || c[b] === '1') c[b] = 'SIM';
                        });
                        mapByCnpj.set(cleanC, c);
                    }
                });
                window.INITIAL_CLIENTS_DATA.forEach(initC => {
                    const cleanC = cleanDigits(initC['CNPJ']);
                    if (cleanC && mapByCnpj.has(cleanC)) {
                        const existing = mapByCnpj.get(cleanC);
                        if (initC['VANS'] && (!existing['VANS'] || existing['VANS'] === 'SIM' || existing['VANS'] === '1')) {
                            existing['VANS'] = initC['VANS'];
                        }
                        if (initC['NEW ERA'] && (!existing['NEW ERA'] || existing['NEW ERA'] === 'SIM' || existing['NEW ERA'] === '1')) {
                            existing['NEW ERA'] = initC['NEW ERA'];
                        }
                        CLIENT_BRAND_COLS.forEach(b => {
                            if (existing[b] === 1 || existing[b] === '1') existing[b] = 'SIM';
                        });
                    } else if (cleanC) {
                        clientsMasterData.push(initC);
                        mapByCnpj.set(cleanC, initC);
                    }
                });
                localStorage.setItem('empresa_clients_custom_data', JSON.stringify(clientsMasterData));
            }
        } else if (window.INITIAL_CLIENTS_DATA && Array.isArray(window.INITIAL_CLIENTS_DATA)) {
            clientsMasterData = [...window.INITIAL_CLIENTS_DATA];
        } else {
            clientsMasterData = [];
        }
    } catch (e) {
        console.error('Erro ao carregar dados de clientes:', e);
        clientsMasterData = window.INITIAL_CLIENTS_DATA || [];
    }
    window.clientsMasterData = clientsMasterData;

    const sidebarBadge = document.getElementById('sidebar-clients-count');
    if (sidebarBadge) {
        sidebarBadge.textContent = clientsMasterData.length;
    }

    populateClientsDatalists();
    renderClientsBrandPills();
};

function populateClientsDatalists() {
    const grupoDatalist = document.getElementById('clients-grupo-datalist');
    const grupoRealDatalist = document.getElementById('clients-grupo-real-datalist');
    if (!grupoDatalist || !grupoRealDatalist) return;

    const grupos = new Set();
    const gruposReais = new Set();

    clientsMasterData.forEach(c => {
        if (c['GRUPO'] && typeof c['GRUPO'] === 'string' && c['GRUPO'].trim()) {
            grupos.add(c['GRUPO'].trim());
        }
        if (c['GRUPO REAL'] && typeof c['GRUPO REAL'] === 'string' && c['GRUPO REAL'].trim()) {
            gruposReais.add(c['GRUPO REAL'].trim());
        }
    });

    grupoDatalist.innerHTML = Array.from(grupos).sort().map(g => `<option value="${escapeHTML(g)}">`).join('');
    grupoRealDatalist.innerHTML = Array.from(gruposReais).sort().map(g => `<option value="${escapeHTML(g)}">`).join('');
}

function renderClientsBrandPills() {
    const container = document.getElementById('clients-brand-pills-list');
    if (!container) return;

    let html = `<button type="button" class="client-brand-pill ${clientsActiveBrand === 'all' ? 'active' : ''}" data-brand-val="all" onclick="setClientBrandFilter('all')">Todas</button>`;
    
    CLIENT_BRAND_COLS.forEach(brand => {
        const isActive = clientsActiveBrand === brand ? 'active' : '';
        html += `<button type="button" class="client-brand-pill ${isActive}" data-brand-val="${escapeHTML(brand)}" onclick="setClientBrandFilter('${escapeHTML(brand)}')">${escapeHTML(brand)}</button>`;
    });

    container.innerHTML = html;
}

window.renderClientsView = function() {
    if (!clientsMasterData || clientsMasterData.length === 0) {
        window.initClientsModule();
    }
    applyClientsFilter();
};

window.setClientStatusFilter = function(statusVal) {
    clientsActiveStatus = statusVal;
    document.querySelectorAll('.client-pill-btn').forEach(btn => {
        if (btn.getAttribute('data-status-val') === statusVal) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    applyClientsFilter();
};

window.setClientBrandFilter = function(brandVal) {
    clientsActiveBrand = brandVal;
    document.querySelectorAll('.client-brand-pill').forEach(btn => {
        if (btn.getAttribute('data-brand-val') === brandVal) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    applyClientsFilter();
};

function normalizeString(str) {
    if (!str) return '';
    return str.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function cleanDigits(str) {
    if (!str) return '';
    return str.toString().replace(/\D/g, '');
}

window.applyClientsFilter = function() {
    const cnpjVal = cleanDigits(document.getElementById('filter-client-cnpj')?.value || '');
    const razaoVal = normalizeString(document.getElementById('filter-client-razao')?.value || '');
    const fantasiaVal = normalizeString(document.getElementById('filter-client-fantasia')?.value || '');
    const grupoVal = normalizeString(document.getElementById('filter-client-grupo')?.value || '');
    const grupoRealVal = normalizeString(document.getElementById('filter-client-grupo-real')?.value || '');

    clientsFilteredData = clientsMasterData.filter(client => {
        // Filtro CNPJ (busca por dígitos limpos)
        if (cnpjVal) {
            const clientCnpjDigits = cleanDigits(client['CNPJ']);
            if (!clientCnpjDigits.includes(cnpjVal)) {
                return false;
            }
        }

        // Filtro Razão Social
        if (razaoVal) {
            const clientRazao = normalizeString(client['RAZAO SOCIAL']);
            if (!clientRazao.includes(razaoVal)) {
                return false;
            }
        }

        // Filtro Nome Fantasia
        if (fantasiaVal) {
            const clientFantasia = normalizeString(client['FANTASIA']);
            if (!clientFantasia.includes(fantasiaVal)) {
                return false;
            }
        }

        // Filtro Grupo
        if (grupoVal) {
            const clientGrupo = normalizeString(client['GRUPO']);
            if (!clientGrupo.includes(grupoVal)) {
                return false;
            }
        }

        // Filtro Grupo Real
        if (grupoRealVal) {
            const clientGrupoReal = normalizeString(client['GRUPO REAL']);
            if (!clientGrupoReal.includes(grupoRealVal)) {
                return false;
            }
        }

        // Filtro de Status Geral (Ativo, NÃ£o Fidelizado, Inativo, Loja Fechada)
        if (clientsActiveStatus !== 'all') {
            const clientStatus = window.getClientGeneralStatus(client);
            if (clientStatus !== clientsActiveStatus) {
                // Compatibilidade com legado SIM/NAO
                if (clientsActiveStatus === 'SIM' && clientStatus !== 'ATIVO') return false;
                if (clientsActiveStatus === 'NAO' && clientStatus === 'ATIVO') return false;
                if (clientsActiveStatus !== 'SIM' && clientsActiveStatus !== 'NAO') return false;
            }
        }

        // Filtro de Marca
        if (clientsActiveBrand !== 'all') {
            const bStatus = window.getClientBrandStatus(client, clientsActiveBrand);
            if (bStatus === 'INATIVO') {
                return false;
            }
        }

        return true;
    });

    clientsCurrentPage = 1;
    renderClientsTable();
};

window.clearClientsFilter = function() {
    const fields = [
        'filter-client-cnpj',
        'filter-client-razao',
        'filter-client-fantasia',
        'filter-client-grupo',
        'filter-client-grupo-real'
    ];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    clientsActiveStatus = 'all';
    document.querySelectorAll('.client-pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-status-val') === 'all');
    });

    clientsActiveBrand = 'all';
    document.querySelectorAll('.client-brand-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-brand-val') === 'all');
    });

    applyClientsFilter();
};

window.changeClientsPageSize = function(val) {
    if (val === 'all') {
        clientsPageSize = 999999;
    } else {
        clientsPageSize = parseInt(val, 10) || 25;
    }
    clientsCurrentPage = 1;
    renderClientsTable();
};

window.goToClientsPage = function(page) {
    clientsCurrentPage = page;
    renderClientsTable();
};

function renderClientsTable() {
    const tableContainer = document.getElementById('clients-table-container');
    const countBadge = document.getElementById('clients-count-badge');
    const filterIndicator = document.getElementById('clients-filter-indicator');
    const paginationContainer = document.getElementById('clients-pagination-container');
    if (!tableContainer) return;

    const total = clientsFilteredData.length;
    const masterTotal = clientsMasterData.length;

    if (countBadge) {
        countBadge.innerHTML = `<i class='bx bx-check-circle'></i> ${total} ${total === 1 ? 'cliente encontrado' : 'clientes encontrados'}`;
    }

    if (filterIndicator) {
        if (total < masterTotal) {
            filterIndicator.textContent = `(Filtrado de um total de ${masterTotal} cadastrados)`;
        } else {
            filterIndicator.textContent = `(Base completa)`;
        }
    }

    if (total === 0) {
        tableContainer.innerHTML = `
            <div style="text-align: center; padding: 3rem 1.5rem; color: var(--text-secondary);">
                <i class='bx bx-search-alt' style="font-size: 3rem; color: rgba(255,255,255,0.2); margin-bottom: 0.75rem;"></i>
                <h3 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.35rem;">Nenhum cliente encontrado</h3>
                <p style="font-size: 0.85rem; max-width: 450px; margin: 0 auto 1.25rem auto;">Tente ajustar os filtros de CNPJ, Razão, Fantasia, Grupo ou Marca acima para localizar os registros desejados.</p>
                <button type="button" class="btn-client-clear" onclick="clearClientsFilter()" style="display: inline-flex;">
                    <i class='bx bx-reset'></i> Limpar Filtros
                </button>
            </div>
        `;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    // Calcular paginação
    const totalPages = Math.ceil(total / clientsPageSize);
    if (clientsCurrentPage > totalPages) clientsCurrentPage = totalPages;
    if (clientsCurrentPage < 1) clientsCurrentPage = 1;

    const startIndex = (clientsCurrentPage - 1) * clientsPageSize;
    const endIndex = Math.min(startIndex + clientsPageSize, total);
    const pageItems = clientsFilteredData.slice(startIndex, endIndex);

    // Tabela HTML
    let tableHtml = `
        <table class="clients-table">
            <thead>
                <tr>
                    <th style="width: 140px; white-space: nowrap;">CNPJ</th>
                    <th style="min-width: 180px;">Razão Social / Nome Fantasia</th>
                    <th style="width: 90px; white-space: nowrap;">Grupo</th>
                    <th style="width: 90px; white-space: nowrap;">Grupo Real</th>
                    <th style="width: 85px; white-space: nowrap; font-size: 0.72rem;">Cidade / UF</th>
                    <th style="text-align: center; width: 85px; white-space: nowrap;">Status</th>
                    <th style="width: 180px;">Marcas</th>
                    <th style="text-align: right; width: 85px; white-space: nowrap;">Ações</th>
                </tr>
            </thead>
            <tbody>
    `;

    pageItems.forEach((client, idx) => {
        const globalIdx = startIndex + idx;
        const clientStatus = window.getClientGeneralStatus(client);
        const statusBadge = window.renderClientStatusBadge(clientStatus);

        // Marcas que o cliente possui apenas com a cor simbolizando o status (SEM CÓDIGO JUNTO)
        const brandTags = [];
        CLIENT_BRAND_COLS.forEach(brand => {
            const bStatus = window.getClientBrandStatus(client, brand);
            if (bStatus === 'INATIVO') return;

            if (bStatus === 'ATIVO') {
                brandTags.push(`<span class="client-brand-mini-tag brand-status-ativo" title="${escapeHTML(brand)}: Ativo">${escapeHTML(brand)}</span>`);
            } else if (bStatus === 'NAO_FIDELIZADO') {
                brandTags.push(`<span class="client-brand-mini-tag brand-status-nao-fidelizado" title="${escapeHTML(brand)}: Não Fidelizado">${escapeHTML(brand)}</span>`);
            }
        });

        const brandsHtml = brandTags.length > 0
            ? brandTags.join('')
            : `<span style="color: rgba(255,255,255,0.3); font-size: 0.72rem;">-</span>`;

        const cidadeUf = [client['CIDADE'], client['ESTADO']].filter(Boolean).join(' / ') || '-';
        const fantasia = client['FANTASIA'] || '-';
        const razao = client['RAZAO SOCIAL'] || '-';
        const cnpjFormatted = client['CNPJ'] || '-';
        const grupo = client['GRUPO'] || '-';
        const grupoReal = client['GRUPO REAL'] || '-';

        tableHtml += `
            <tr onclick="openClientDetailModal(${globalIdx})">
                <td class="font-mono client-cnpj-cell" style="white-space: nowrap; font-weight: 600; color: var(--accent-color); font-size: 0.8rem;">
                    ${escapeHTML(cnpjFormatted)}
                </td>
                <td>
                    <div style="font-weight: 700; color: var(--text-primary); font-size: 0.84rem; margin-bottom: 2px;">
                        ${escapeHTML(fantasia)}
                    </div>
                    <div style="font-size: 0.74rem; color: var(--text-secondary); max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(razao)}">
                        ${escapeHTML(razao)}
                    </div>
                </td>
                <td style="color: var(--text-secondary); font-size: 0.78rem; white-space: nowrap;">${escapeHTML(grupo)}</td>
                <td style="color: var(--text-secondary); font-size: 0.78rem; white-space: nowrap;">${escapeHTML(grupoReal)}</td>
                <td style="white-space: nowrap; font-size: 0.70rem; font-weight: 400; color: var(--text-secondary);">${escapeHTML(cidadeUf)}</td>
                <td style="text-align: center; white-space: nowrap;">${statusBadge}</td>
                <td><div class="client-brands-container">${brandsHtml}</div></td>
                <td style="text-align: right;" onclick="event.stopPropagation()">
                    <div style="display: inline-flex; gap: 0.3rem; justify-content: flex-end;">
                        <button type="button" class="btn-table-action" onclick="openClientDetailModal(${globalIdx})" title="Ver ficha completa">
                            <i class='bx bx-show'></i>
                        </button>
                        <button type="button" class="btn-table-action" onclick="openEditClientByIndex(${globalIdx})" title="Editar dados da loja">
                            <i class='bx bx-edit'></i>
                        </button>
                        <button type="button" class="btn-table-action btn-table-task" onclick="createTaskForClient(${globalIdx})" title="Criar tarefa para este cliente">
                            <i class='bx bx-plus'></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tableHtml += `</tbody></table>`;
    tableContainer.innerHTML = tableHtml;

    // Renderizar paginação se houver mais de uma página
    if (paginationContainer) {
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
        } else {
            let pagHtml = `
                <button type="button" class="btn-page" ${clientsCurrentPage === 1 ? 'disabled' : ''} onclick="goToClientsPage(1)" title="Primeira Página">
                    <i class='bx bx-chevrons-left'></i>
                </button>
                <button type="button" class="btn-page" ${clientsCurrentPage === 1 ? 'disabled' : ''} onclick="goToClientsPage(${clientsCurrentPage - 1})" title="Página Anterior">
                    <i class='bx bx-chevron-left'></i>
                </button>
            `;

            // Páginas numéricas (janela de até 5 páginas)
            const maxVisible = 5;
            let startPage = Math.max(1, clientsCurrentPage - 2);
            let endPage = Math.min(totalPages, startPage + maxVisible - 1);
            if (endPage - startPage < maxVisible - 1) {
                startPage = Math.max(1, endPage - maxVisible + 1);
            }

            for (let p = startPage; p <= endPage; p++) {
                pagHtml += `
                    <button type="button" class="btn-page ${p === clientsCurrentPage ? 'active' : ''}" onclick="goToClientsPage(${p})">
                        ${p}
                    </button>
                `;
            }

            pagHtml += `
                <button type="button" class="btn-page" ${clientsCurrentPage === totalPages ? 'disabled' : ''} onclick="goToClientsPage(${clientsCurrentPage + 1})" title="Próxima Página">
                    <i class='bx bx-chevron-right'></i>
                </button>
                <button type="button" class="btn-page" ${clientsCurrentPage === totalPages ? 'disabled' : ''} onclick="goToClientsPage(${totalPages})" title="Última Página">
                    <i class='bx bx-chevrons-right'></i>
                </button>
                <span style="font-size: 0.8rem; color: var(--text-secondary); margin-left: 0.5rem;">
                    Página ${clientsCurrentPage} de ${totalPages} (${total} itens)
                </span>
            `;

            paginationContainer.innerHTML = pagHtml;
        }
    }
}

// --------------------------------------------------------------------------
// MODAL DETALHE DO CLIENTE
// --------------------------------------------------------------------------

window.openClientDetailModal = function(clientIndex) {
    const client = clientsFilteredData[clientIndex];
    if (!client) return;

    currentModalClient = client;

    // Header
    const fantasiaEl = document.getElementById('cdm-fantasia');
    const razaoEl = document.getElementById('cdm-razao');
    const statusBadgeEl = document.getElementById('cdm-status-badge');
    
    if (fantasiaEl) fantasiaEl.textContent = client['FANTASIA'] || client['RAZAO SOCIAL'] || 'Cliente';
    if (razaoEl) razaoEl.textContent = client['RAZAO SOCIAL'] || '-';

    const clientStatus = window.getClientGeneralStatus(client);
    if (statusBadgeEl) {
        let badgeClass = 'status-inativo';
        let badgeIcon = 'bx-store-alt';
        let badgeLabel = 'Inativa';
        if (clientStatus === 'ATIVO') {
            badgeClass = 'status-ativo';
            badgeIcon = 'bx-check-circle';
            badgeLabel = 'Ativa';
        } else if (clientStatus === 'NAO_FIDELIZADO') {
            badgeClass = 'status-nao-fidelizado';
            badgeIcon = 'bx-time-five';
            badgeLabel = 'Não Fidelizado';
        } else if (clientStatus === 'LOJA_FECHADA') {
            badgeClass = 'status-loja-fechada';
            badgeIcon = 'bx-store-alt';
            badgeLabel = 'Inativa';
        }
        statusBadgeEl.className = `client-status-badge ${badgeClass}`;
        statusBadgeEl.innerHTML = `<i class='bx ${badgeIcon}'></i> ${badgeLabel}`;
    }

    // Card 1: Identificação
    document.getElementById('cdm-cnpj').textContent = client['CNPJ'] || '-';
    document.getElementById('cdm-grupo').textContent = client['GRUPO'] || '-';
    document.getElementById('cdm-grupo-real').textContent = client['GRUPO REAL'] || '-';

    // Card 2: Endereço
    const ruaStr = client['RUA'] || '';
    const numStr = client['NUMERO'] ? `nº ${client['NUMERO']}` : '';
    const compStr = client['COMPLEMENTO'] || '';
    const bairroStr = client['BAIRRO'] || '';
    const cidadeStr = client['CIDADE'] || '';
    const estadoStr = client['ESTADO'] || '';
    const cepStr = client['CEP'] ? `CEP: ${client['CEP']}` : '';

    const logradouroFull = [ruaStr, numStr, compStr].filter(Boolean).join(', ');
    const cidadeUf = [cidadeStr, estadoStr].filter(Boolean).join(' / ') || '-';
    const structuredFull = [
        logradouroFull,
        bairroStr,
        cidadeStr ? (estadoStr ? `${cidadeStr}/${estadoStr}` : cidadeStr) : estadoStr,
        cepStr
    ].filter(Boolean).join(' - ');

    const rawCompleto = (client['ENDERECO COMPLETO'] || '').trim();

    // Se o rawCompleto for vazio, ou for apenas cidade/UF (e temos dados com rua/bairro), usar o estruturado completo!
    const isOnlyCity = !rawCompleto || 
        (cidadeStr && rawCompleto.toUpperCase() === cidadeStr.toUpperCase()) || 
        (cidadeStr && estadoStr && (rawCompleto.toUpperCase() === `${cidadeStr}/${estadoStr}`.toUpperCase() || rawCompleto.toUpperCase() === `${cidadeStr} / ${estadoStr}`.toUpperCase()));

    let enderecoCompleto = rawCompleto;
    if (isOnlyCity || (ruaStr && !rawCompleto.toUpperCase().includes(ruaStr.toUpperCase()))) {
        enderecoCompleto = structuredFull || rawCompleto || 'Endereço não informado';
    }

    const enderecoBox = document.getElementById('cdm-endereco-box');
    if (enderecoBox) enderecoBox.textContent = enderecoCompleto || 'Endereço não informado';

    // Detalhes extras do endereço
    const ruaEl = document.getElementById('cdm-rua');
    const ruaRow = document.getElementById('cdm-rua-row');
    if (ruaEl) ruaEl.textContent = logradouroFull || '-';
    if (ruaRow) ruaRow.style.display = logradouroFull ? 'flex' : 'none';

    const bairroEl = document.getElementById('cdm-bairro');
    const bairroRow = document.getElementById('cdm-bairro-row');
    if (bairroEl) bairroEl.textContent = bairroStr || '-';
    if (bairroRow) bairroRow.style.display = bairroStr ? 'flex' : 'none';

    const mapsLink = document.getElementById('cdm-maps-link');
    if (mapsLink) {
        if (enderecoCompleto) {
            mapsLink.style.display = 'inline-flex';
            mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`;
        } else {
            mapsLink.style.display = 'none';
        }
    }

    document.getElementById('cdm-cidade-uf').textContent = cidadeUf;
    document.getElementById('cdm-cep').textContent = client['CEP'] || '-';
    document.getElementById('cdm-status-endereco').textContent = client['ENDERECO?'] || '-';

    // Card 3: Contato & Proprietário
    document.getElementById('cdm-proprietario').textContent = client['PROPRIETARIO'] || '-';
    
    const tel = client['TELEFONE'] ? client['TELEFONE'].toString() : '';
    document.getElementById('cdm-telefone').textContent = tel || '-';

    const waLink = document.getElementById('cdm-whatsapp-link');
    if (waLink) {
        const digits = cleanDigits(tel);
        if (digits && digits.length >= 8) {
            waLink.style.display = 'inline-flex';
            waLink.href = `https://wa.me/55${digits}`;
        } else {
            waLink.style.display = 'none';
        }
    }

    document.getElementById('cdm-aniversario').textContent = client['ANIVERSARIO'] || '-';

    // Card 4: Marcas
    const brandsListContainer = document.getElementById('cdm-brands-list');
    if (brandsListContainer) {
        const brandBadges = [];
        CLIENT_BRAND_COLS.forEach(b => {
            const bStatus = window.getClientBrandStatus(client, b);
            if (bStatus === 'INATIVO') return;

            const val = client[b];
            const isCode = val && val !== 'SIM' && val !== 'ATIVO' && val !== '1' && !String(val).includes('FIDELIZAD') && !String(val).includes('FECHAD');
            const codeText = isCode ? `<span style="font-family: monospace; font-size: 0.75rem; background: rgba(0,0,0,0.3); padding: 1px 5px; border-radius: 4px; margin-left: 4px;">#${escapeHTML(val)}</span>` : '';

            if (bStatus === 'ATIVO') {
                brandBadges.push(`
                    <div class="cdm-brand-badge status-ativo" title="Comprando da marca">
                        <i class='bx bx-check-circle'></i>
                        <span><strong>${escapeHTML(b)}</strong> ${codeText}</span>
                    </div>
                `);
            } else if (bStatus === 'NAO_FIDELIZADO') {
                brandBadges.push(`
                    <div class="cdm-brand-badge status-nao-fidelizado" title="Já comprou, não compra mais atualmente">
                        <i class='bx bx-time-five'></i>
                        <span><strong>${escapeHTML(b)}</strong> (Não Fidelizado) ${codeText}</span>
                    </div>
                `);
            }
        });

        if (brandBadges.length === 0) {
            brandsListContainer.innerHTML = `<span style="color: var(--text-secondary); font-size: 0.85rem;">Nenhuma marca associada</span>`;
        } else {
            brandsListContainer.innerHTML = brandBadges.join('');
        }
    }

    // Botão Criar Tarefa
    const createTaskBtn = document.getElementById('cdm-create-task-btn');
    if (createTaskBtn) {
        createTaskBtn.onclick = () => createTaskForClient(clientIndex);
    }

    const modal = document.getElementById('client-detail-modal');
    if (modal) modal.classList.remove('hidden');
};

window.closeClientDetailModal = function() {
    const modal = document.getElementById('client-detail-modal');
    if (modal) modal.classList.add('hidden');
    currentModalClient = null;
};

window.createTaskForClient = function(clientIndex) {
    const client = clientsFilteredData[clientIndex] || currentModalClient;
    if (!client) return;

    closeClientDetailModal();

    // Abrir o modal de tarefas
    openTaskModal();

    // Preencher automaticamente os campos da tarefa
    const clientName = client['FANTASIA'] || client['RAZAO SOCIAL'] || 'Cliente';
    const titleInput = document.getElementById('task-title');
    if (titleInput) {
        titleInput.value = clientName;
    }

    const cidadeUf = [client['CIDADE'], client['ESTADO']].filter(Boolean).join('/');
    const prop = client['PROPRIETARIO'] ? `Proprietário: ${client['PROPRIETARIO']}` : '';
    const tel = client['TELEFONE'] ? `Tel: ${client['TELEFONE']}` : '';
    const details = [cidadeUf, prop, tel].filter(Boolean).join(' | ');

    const subtitleInput = document.getElementById('task-subtitle');
    if (subtitleInput) {
        subtitleInput.value = details ? `Atendimento: ${details}` : `Atendimento ao cliente ${clientName}`;
    }

    // Identificar se o cliente trabalha com uma marca específica
    const activeBrands = CLIENT_BRAND_COLS.filter(b => isClientBrandActive(client, b));
    if (activeBrands.length === 1) {
        const brandSelect = document.getElementById('task-brand');
        if (brandSelect) {
            brandSelect.value = activeBrands[0];
        }
    }

    window.showNotification(`Formulário de tarefa preenchido para "${clientName}"!`, 'success');
};

window.copyClientSummary = function() {
    if (!currentModalClient) return;
    const c = currentModalClient;
    const activeBrands = CLIENT_BRAND_COLS.filter(b => isClientBrandActive(c, b)).map(b => {
        const val = c[b];
        const isCode = val && val !== 'SIM' && val !== 'ATIVO' && val !== '1' && !String(val).includes('FIDELIZAD');
        return isCode ? `${b} (#${val})` : b;
    }).join(', ') || 'Nenhuma';
    const text = [
        `*CLIENTE: ${c['FANTASIA'] || c['RAZAO SOCIAL'] || '-'}*`,
        `Razão Social: ${c['RAZAO SOCIAL'] || '-'}`,
        `CNPJ: ${c['CNPJ'] || '-'}`,
        `Grupo: ${c['GRUPO'] || '-'} | Grupo Real: ${c['GRUPO REAL'] || '-'}`,
        `Endereço: ${c['ENDERECO COMPLETO'] || '-'}`,
        `Cidade: ${c['CIDADE'] || '-'}/${c['ESTADO'] || '-'} - CEP: ${c['CEP'] || '-'}`,
        `Proprietário: ${c['PROPRIETARIO'] || '-'} | Tel: ${c['TELEFONE'] || '-'}`,
        `Aniversário: ${c['ANIVERSARIO'] || '-'}`,
        `Marcas: ${activeBrands}`
    ].join('\n');

    copyToClipboard(text, 'Ficha resumida copiada com sucesso!');
};

window.copyToClipboard = function(text, successMsg = 'Copiado!') {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            window.showNotification(successMsg, 'success');
        }).catch(() => {
            fallbackCopy(text, successMsg);
        });
    } else {
        fallbackCopy(text, successMsg);
    }
};

function fallbackCopy(text, successMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        window.showNotification(successMsg, 'success');
    } catch (e) {
        window.showNotification('Erro ao copiar para área de transferência', 'error');
    }
    document.body.removeChild(ta);
}

// --------------------------------------------------------------------------
// EXPORTAÇÃO E IMPORTAÇÃO EXCEL (SheetJS)
// --------------------------------------------------------------------------

window.exportClientsToExcel = function() {
    if (!window.XLSX) {
        window.showNotification('Biblioteca Excel não carregada. Verifique sua conexão.', 'error');
        return;
    }

    const dataToExport = clientsFilteredData.length > 0 ? clientsFilteredData : clientsMasterData;
    if (dataToExport.length === 0) {
        window.showNotification('Nenhum dado para exportar.', 'error');
        return;
    }

    try {
        // Mapear para colunas limpas e ordenadas
        const exportRows = dataToExport.map(c => {
            const row = {
                'CNPJ': c['CNPJ'] || '',
                'RAZAO SOCIAL': c['RAZAO SOCIAL'] || '',
                'FANTASIA': c['FANTASIA'] || '',
                'CLIENTE ATIVO?': c['CLIENTE ATIVO?'] || '',
                'GRUPO': c['GRUPO'] || '',
                'GRUPO REAL': c['GRUPO REAL'] || '',
                'CIDADE': c['CIDADE'] || '',
                'ESTADO': c['ESTADO'] || '',
                'CEP': c['CEP'] || '',
                'ENDERECO COMPLETO': c['ENDERECO COMPLETO'] || '',
                'TELEFONE': c['TELEFONE'] || '',
                'PROPRIETARIO': c['PROPRIETARIO'] || '',
                'ANIVERSARIO': c['ANIVERSARIO'] || ''
            };

            CLIENT_BRAND_COLS.forEach(brand => {
                row[brand] = c[brand] || '';
            });

            return row;
        });

        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'CLIENTES');

        const now = new Date();
        const dateStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}`;
        XLSX.writeFile(wb, `CLIENTES_EMPRESA_${dateStr}.xlsx`);

        window.showNotification(`Exportação de ${exportRows.length} clientes concluída!`, 'success');
        if (window.logUserAction) window.logUserAction(`exportou ${exportRows.length} clientes para planilha Excel`);
    } catch (err) {
        console.error('Erro na exportação Excel:', err);
        window.showNotification('Erro ao gerar arquivo Excel.', 'error');
    }
};

window.handleUploadClientsExcel = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!window.XLSX) {
        window.showNotification('Biblioteca Excel não carregada.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            const sheetName = workbook.SheetNames.includes('LISTA') ? 'LISTA' : workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: null });

            if (!rawJson || rawJson.length === 0) {
                window.showNotification('A planilha importada está vazia ou ilegível.', 'error');
                return;
            }

            // Normalizar e validar linhas
            const parsedClients = rawJson.filter(row => {
                return (row['CNPJ'] || row['RAZAO SOCIAL'] || row['FANTASIA']);
            }).map(row => {
                const clientObj = {};
                Object.keys(row).forEach(k => {
                    const cleanKey = k.trim().toUpperCase();
                    let val = row[k];
                    // Formatar se for data Excel de aniversário
                    if (cleanKey === 'ANIVERSARIO' && typeof val === 'number') {
                        try {
                            const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
                            if (!isNaN(dateObj.getTime())) {
                                val = `${dateObj.getDate().toString().padStart(2,'0')}/${(dateObj.getMonth()+1).toString().padStart(2,'0')}/${dateObj.getFullYear()}`;
                            }
                        } catch (de) {}
                    }
                    clientObj[cleanKey] = val;
                });
                return clientObj;
            });

            if (parsedClients.length === 0) {
                window.showNotification('Nenhum registro válido de cliente encontrado na planilha.', 'error');
                return;
            }

            // Salvar no estado e localStorage
            clientsMasterData = parsedClients;
            await persistClientsData(`importou nova planilha com ${parsedClients.length} clientes`);

            window.showNotification(`Sucesso! ${parsedClients.length} clientes carregados da nova planilha!`, 'success');

            // Resetar input file
            event.target.value = '';
        } catch (err) {
            console.error('Erro ao ler planilha Excel:', err);
            window.showNotification('Erro ao processar o arquivo Excel: ' + err.message, 'error');
            event.target.value = '';
        }
    };

    reader.readAsArrayBuffer(file);
};

// --------------------------------------------------------------------------
// PERSISTÊNCIA CENTRALIZADA (LocalStorage + Firestore em Tempo Real)
// --------------------------------------------------------------------------

async function persistClientsData(actionMessage = 'atualizou a base de clientes') {
    // Sincronizar no escopo global
    window.clientsMasterData = clientsMasterData;

    // 1. Salvar no localStorage local imediatamente para resposta de 0 ms
    localStorage.setItem('empresa_clients_custom_data', JSON.stringify(clientsMasterData));

    // 2. Atualizar contadores e filtros na tela
    const sidebarBadge = document.getElementById('sidebar-clients-count');
    if (sidebarBadge) {
        sidebarBadge.textContent = clientsMasterData.length;
    }
    populateClientsDatalists();
    applyClientsFilter();

    // Atualizar módulo de Indicadores se estiver carregado
    if (typeof window.applyIndicatorsFilter === 'function') {
        try { window.applyIndicatorsFilter(); } catch (e) {}
    }
    if (typeof window.populateAllIndCMS === 'function') {
        try { window.populateAllIndCMS(); } catch (e) {}
    }

    // 3. Salvar no Firestore para sincronização em tempo real entre todos os usuários
    if (isFirebaseConnected && window.db) {
        try {
            await window.db.collection('settings').doc('clients').set({
                list: clientsMasterData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: localStorage.getItem('empresa_auth_user') || 'Usuário'
            }, { merge: true });
        } catch (err) {
            console.error('Erro ao sincronizar clientes no Firestore:', err);
        }
    }

    if (window.logUserAction) {
        window.logUserAction(actionMessage);
    }
}

// --------------------------------------------------------------------------
// ADIÇÃO E EDIÇÃO DE CLIENTES (Modal Form)
// --------------------------------------------------------------------------

window.openNewClientModal = function() {
    document.getElementById('cfm-modal-title').textContent = 'Novo Cliente';
    document.getElementById('cfm-modal-subtitle').textContent = 'Cadastrar nova loja na base de clientes';
    document.getElementById('cfm-header-icon').innerHTML = "<i class='bx bx-user-plus'></i>";
    document.getElementById('cfm-client-index').value = '';

    hideCnpjFeedback();
    const badge = document.getElementById('cfm-cnpj-badge');
    if (badge) badge.style.display = 'none';

    document.getElementById('cfm-status').value = 'ATIVO';
    document.getElementById('cfm-cnpj').value = '';
    document.getElementById('cfm-fantasia').value = '';
    document.getElementById('cfm-razao').value = '';
    document.getElementById('cfm-grupo').value = '';
    document.getElementById('cfm-grupo-real').value = '';

    document.getElementById('cfm-cep').value = '';
    document.getElementById('cfm-rua').value = '';
    document.getElementById('cfm-numero').value = '';
    document.getElementById('cfm-complemento').value = '';
    document.getElementById('cfm-bairro').value = '';
    document.getElementById('cfm-cidade').value = '';
    document.getElementById('cfm-estado').value = '';
    document.getElementById('cfm-endereco-completo').value = '';
    document.getElementById('cfm-endereco-status').value = 'REVISADO';

    document.getElementById('cfm-proprietario').value = '';
    document.getElementById('cfm-telefone').value = '';
    document.getElementById('cfm-aniversario').value = '';

    renderFormBrandToggles({});

    const deleteBtn = document.getElementById('cfm-delete-btn');
    if (deleteBtn) deleteBtn.style.display = 'none';

    const modal = document.getElementById('client-form-modal');
    if (modal) modal.classList.remove('hidden');
};

window.openClientFormForEdit = function(client, masterIndex) {
    if (!client) return;

    try {
        hideCnpjFeedback();
        const badge = document.getElementById('cfm-cnpj-badge');
        if (badge) badge.style.display = 'none';

        const safeStr = (v) => (v !== null && v !== undefined) ? String(v).trim() : '';
        const safeUpper = (v) => safeStr(v).toUpperCase();

        const titleEl = document.getElementById('cfm-modal-title');
        if (titleEl) titleEl.textContent = 'Editar Cliente';

        const subEl = document.getElementById('cfm-modal-subtitle');
        if (subEl) subEl.textContent = safeStr(client['FANTASIA']) || safeStr(client['RAZAO SOCIAL']) || 'Atualizar dados da loja';

        const iconEl = document.getElementById('cfm-header-icon');
        if (iconEl) iconEl.innerHTML = "<i class='bx bx-edit'></i>";

        const indexInput = document.getElementById('cfm-client-index');
        if (indexInput) indexInput.value = (masterIndex !== -1 && masterIndex !== undefined && masterIndex !== null) ? masterIndex : '';

        const statusEl = document.getElementById('cfm-status');
        if (statusEl) statusEl.value = window.getClientGeneralStatus(client);

        const cnpjEl = document.getElementById('cfm-cnpj');
        if (cnpjEl) cnpjEl.value = (typeof window.formatCNPJ === 'function') ? window.formatCNPJ(safeStr(client['CNPJ'])) : safeStr(client['CNPJ']);

        const fantasiaEl = document.getElementById('cfm-fantasia');
        if (fantasiaEl) fantasiaEl.value = safeUpper(client['FANTASIA']);

        const razaoEl = document.getElementById('cfm-razao');
        if (razaoEl) razaoEl.value = safeUpper(client['RAZAO SOCIAL']);

        const grupoEl = document.getElementById('cfm-grupo');
        if (grupoEl) grupoEl.value = safeUpper(client['GRUPO']);

        const grupoRealEl = document.getElementById('cfm-grupo-real');
        if (grupoRealEl) grupoRealEl.value = safeUpper(client['GRUPO REAL']);

        const cepEl = document.getElementById('cfm-cep');
        if (cepEl) cepEl.value = safeStr(client['CEP']);

        const ruaEl = document.getElementById('cfm-rua');
        if (ruaEl) ruaEl.value = safeUpper(client['RUA']);

        const numEl = document.getElementById('cfm-numero');
        if (numEl) numEl.value = safeStr(client['NUMERO']);

        const compEl = document.getElementById('cfm-complemento');
        if (compEl) compEl.value = safeStr(client['COMPLEMENTO']);

        const bairroEl = document.getElementById('cfm-bairro');
        if (bairroEl) bairroEl.value = safeStr(client['BAIRRO']);

        const cidadeEl = document.getElementById('cfm-cidade');
        if (cidadeEl) cidadeEl.value = safeStr(client['CIDADE']);

        const estadoEl = document.getElementById('cfm-estado');
        if (estadoEl) estadoEl.value = safeUpper(client['ESTADO']);

        // Se o ENDERECO COMPLETO salvo estiver vazio ou for apenas cidade/UF mas tivermos dados estruturados, compor o endereço completo!
        let endSaved = safeStr(client['ENDERECO COMPLETO']);
        const ruaS = safeStr(client['RUA']);
        const numS = safeStr(client['NUMERO']) ? `nº ${safeStr(client['NUMERO'])}` : '';
        const compS = safeStr(client['COMPLEMENTO']);
        const bS = safeStr(client['BAIRRO']);
        const cS = safeStr(client['CIDADE']);
        const uS = safeUpper(client['ESTADO']);
        const cepS = safeStr(client['CEP']) ? `CEP: ${safeStr(client['CEP'])}` : '';

        const logrS = [ruaS, numS, compS].filter(Boolean).join(', ');
        const structS = [logrS, bS, cS ? (uS ? `${cS}/${uS}` : cS) : uS, cepS].filter(Boolean).join(' - ');

        const isOnlyCityS = !endSaved || 
            (cS && endSaved.toUpperCase() === cS.toUpperCase()) || 
            (cS && uS && (endSaved.toUpperCase() === `${cS}/${uS}`.toUpperCase() || endSaved.toUpperCase() === `${cS} / ${uS}`.toUpperCase()));

        if ((isOnlyCityS && structS) || (ruaS && !endSaved.toUpperCase().includes(ruaS.toUpperCase()) && structS)) {
            endSaved = structS;
        }
        const endCompEl = document.getElementById('cfm-endereco-completo');
        if (endCompEl) endCompEl.value = endSaved;

        const endStatusEl = document.getElementById('cfm-endereco-status');
        if (endStatusEl) endStatusEl.value = safeStr(client['ENDERECO?']) || 'REVISADO';

        const propEl = document.getElementById('cfm-proprietario');
        if (propEl) propEl.value = safeStr(client['PROPRIETARIO']);

        const telEl = document.getElementById('cfm-telefone');
        if (telEl) telEl.value = (typeof window.formatTelefone === 'function') ? window.formatTelefone(safeStr(client['TELEFONE'])) : safeStr(client['TELEFONE']);

        const niverEl = document.getElementById('cfm-aniversario');
        if (niverEl) niverEl.value = (typeof window.formatAniversario === 'function') ? window.formatAniversario(safeStr(client['ANIVERSARIO'])) : safeStr(client['ANIVERSARIO']);

        renderFormBrandToggles(client);

        const deleteBtn = document.getElementById('cfm-delete-btn');
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';

        const modal = document.getElementById('client-form-modal');
        if (modal) modal.classList.remove('hidden');
    } catch (err) {
        console.error('Erro ao preparar formulário de edição de cliente:', err);
        const modal = document.getElementById('client-form-modal');
        if (modal) modal.classList.remove('hidden');
    }
};

window.openEditCurrentClientModal = function() {
    const clientToEdit = currentModalClient;
    if (!clientToEdit) {
        console.warn('openEditCurrentClientModal: nenhum cliente selecionado no modal de detalhes');
        return;
    }

    let masterIndex = clientsMasterData.indexOf(clientToEdit);
    if (masterIndex === -1 && clientToEdit['CNPJ']) {
        const cleanC = cleanDigits(clientToEdit['CNPJ']);
        masterIndex = clientsMasterData.findIndex(c => cleanDigits(c['CNPJ']) === cleanC);
    }
    if (masterIndex === -1 && clientToEdit['FANTASIA']) {
        const fUpper = String(clientToEdit['FANTASIA'] || '').trim().toUpperCase();
        masterIndex = clientsMasterData.findIndex(c => String(c['FANTASIA'] || '').trim().toUpperCase() === fUpper);
    }

    if (masterIndex === -1) {
        masterIndex = clientsMasterData.length;
        clientsMasterData.push(clientToEdit);
    }

    closeClientDetailModal();
    window.openClientFormForEdit(clientToEdit, masterIndex);
};

window.openEditClientByIndex = function(index) {
    let client = clientsFilteredData[index];
    let masterIndex = -1;
    if (client) {
        masterIndex = clientsMasterData.indexOf(client);
        if (masterIndex === -1 && client['CNPJ']) {
            masterIndex = clientsMasterData.findIndex(c => cleanDigits(c['CNPJ']) === cleanDigits(client['CNPJ']));
        }
    } else {
        client = clientsMasterData[index];
        masterIndex = index;
    }

    if (!client) {
        console.warn('openEditClientByIndex: cliente não encontrado no índice', index);
        return;
    }

    window.openClientFormForEdit(client, masterIndex !== -1 ? masterIndex : index);
};

function renderFormBrandToggles(clientData = {}) {
    const container = document.getElementById('cfm-brands-toggle-grid');
    if (!container) return;

    let html = '';
    CLIENT_BRAND_COLS.forEach(brand => {
        const bStatus = window.getClientBrandStatus(clientData, brand);

        // Obter código existente se houver
        const rawVal = clientData[brand];
        const isNotCode = !rawVal || rawVal === 'SIM' || rawVal === 'sim' || rawVal === 1 || rawVal === '1' || rawVal === 'null' || rawVal === 'ATIVO' || String(rawVal).includes('FIDELIZAD') || String(rawVal).includes('FECHAD');
        let codeVal = isNotCode ? '' : String(rawVal).trim();
        if (!codeVal && brand === 'NEW ERA' && clientData['CODIGO NEW ERA']) {
            codeVal = String(clientData['CODIGO NEW ERA']).trim();
        }
        if (!codeVal && brand === 'VANS' && clientData['CODIGO AREZZO']) {
            codeVal = String(clientData['CODIGO AREZZO']).trim();
        }

        const safeCode = (codeVal && codeVal !== 'null' && codeVal !== 'undefined') ? codeVal : '';

        let statusClass = 'status-inativo';
        if (bStatus === 'ATIVO') statusClass = 'status-ativo';
        else if (bStatus === 'NAO_FIDELIZADO') statusClass = 'status-nao-fidelizado';

        const selectClass = `select-${bStatus.toLowerCase().replace(/_/g, '-')}`;

        html += `
            <div class="cfm-brand-card ${statusClass}" data-brand="${escapeHTML(brand)}" data-status="${bStatus}">
                <div class="cfm-brand-card-top">
                    <span class="cfm-brand-title">${escapeHTML(brand)}</span>
                    <select class="cfm-brand-status-select ${selectClass}" 
                            data-brand="${escapeHTML(brand)}" 
                            onchange="onBrandStatusSelectChange('${escapeHTML(brand)}', this.value)">
                        <option value="ATIVO" ${bStatus === 'ATIVO' ? 'selected' : ''}>🟢 Ativo</option>
                        <option value="NAO_FIDELIZADO" ${bStatus === 'NAO_FIDELIZADO' ? 'selected' : ''}>🟠 Não Fidelizado</option>
                        <option value="INATIVO" ${bStatus === 'INATIVO' ? 'selected' : ''}>⚪ Inativo</option>
                    </select>
                </div>
                <div class="cfm-brand-card-bottom">
                    <div class="cfm-brand-code-box">
                        <i class='bx bx-hash'></i>
                        <input type="text" 
                            class="cfm-brand-code-input font-mono" 
                            data-brand="${escapeHTML(brand)}" 
                            placeholder="Código ${escapeHTML(brand)} (opcional)" 
                            value="${escapeHTML(safeCode)}" 
                            oninput="onBrandCodeInput('${escapeHTML(brand)}', this.value)"
                            autocomplete="off">
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

window.onBrandStatusSelectChange = function(brand, newStatus, syncGeneral = true) {
    const card = document.querySelector(`.cfm-brand-card[data-brand="${brand}"]`);
    if (!card) return;

    card.setAttribute('data-status', newStatus);
    card.classList.remove('status-ativo', 'status-nao-fidelizado', 'status-inativo', 'status-loja-fechada');

    const select = card.querySelector('.cfm-brand-status-select');
    if (select) {
        select.className = `cfm-brand-status-select select-${newStatus.toLowerCase().replace(/_/g, '-')}`;
    }

    if (newStatus === 'ATIVO') {
        card.classList.add('status-ativo');
    } else if (newStatus === 'NAO_FIDELIZADO') {
        card.classList.add('status-nao-fidelizado');
    } else {
        card.classList.add('status-inativo');
    }
};

window.setFormBrandStatus = function(brand, newStatus) {
    const card = document.querySelector(`.cfm-brand-card[data-brand="${brand}"]`);
    if (!card) return;
    const select = card.querySelector('.cfm-brand-status-select');
    if (select) {
        select.value = newStatus;
    }
    window.onBrandStatusSelectChange(brand, newStatus);
};

window.onBrandCodeInput = function(brand, value) {
    const card = document.querySelector(`.cfm-brand-card[data-brand="${brand}"]`);
    if (!card) return;
    const select = card.querySelector('.cfm-brand-status-select');
    const trimmed = (value || '').trim();
    // Se digitou código e estava inativo, ativa automaticamente na marca
    if (trimmed && select && select.value === 'INATIVO') {
        select.value = 'ATIVO';
        window.onBrandStatusSelectChange(brand, 'ATIVO');
    }
};

window.cycleFormBrandStatus = function(brand) {
    const card = document.querySelector(`.cfm-brand-card[data-brand="${brand}"]`);
    if (!card) return;
    const select = card.querySelector('.cfm-brand-status-select');
    if (!select) return;
    const current = select.value || 'INATIVO';
    const nextStatus = (current === 'INATIVO') ? 'ATIVO' : 'INATIVO';
    select.value = nextStatus;
    window.onBrandStatusSelectChange(brand, nextStatus);
};

window.toggleFormBrandCard = window.cycleFormBrandStatus;
window.onBrandCodeChanged = window.onBrandCodeInput;

window.onClientFormStatusChange = function(statusVal) {
    // Nenhuma ação nas marcas: o status geral da loja é independente e não altera o status das marcas
};

window.toggleFormBrandBtn = window.toggleFormBrandCard;

window.closeClientFormModal = function() {
    const modal = document.getElementById('client-form-modal');
    if (modal) modal.classList.add('hidden');
};

window.updateFormEnderecoCompleto = function() {
    const rua = document.getElementById('cfm-rua')?.value?.trim() || '';
    const num = document.getElementById('cfm-numero')?.value?.trim() || '';
    const comp = document.getElementById('cfm-complemento')?.value?.trim() || '';
    const bairro = document.getElementById('cfm-bairro')?.value?.trim() || '';
    const cidade = document.getElementById('cfm-cidade')?.value?.trim() || '';
    const estado = document.getElementById('cfm-estado')?.value?.trim()?.toUpperCase() || '';
    const cep = document.getElementById('cfm-cep')?.value?.trim() || '';

    let logradouro = rua;
    if (num) logradouro += (logradouro ? `, ${num}` : `nº ${num}`);
    if (comp) logradouro += (logradouro ? ` - ${comp}` : comp);

    const parts = [
        logradouro,
        bairro,
        cidade ? (estado ? `${cidade}/${estado}` : cidade) : estado,
        cep ? `CEP: ${cep}` : ''
    ].filter(Boolean);

    const endField = document.getElementById('cfm-endereco-completo');
    if (endField) {
        endField.value = parts.join(' - ');
    }
};

window.lookupCep = async function(cepVal) {
    const cleanCep = cleanDigits(cepVal);
    if (cleanCep.length !== 8) return;

    const loadingEl = document.getElementById('cfm-cep-loading');
    if (loadingEl) loadingEl.style.display = 'inline-flex';

    try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
            if (data.logradouro) document.getElementById('cfm-rua').value = data.logradouro.toUpperCase();
            if (data.bairro) document.getElementById('cfm-bairro').value = data.bairro.toUpperCase();
            if (data.localidade) document.getElementById('cfm-cidade').value = data.localidade.toUpperCase();
            if (data.uf) document.getElementById('cfm-estado').value = data.uf.toUpperCase();

            // Atualiza imediatamente o endereço completo
            window.updateFormEnderecoCompleto();

            window.showNotification('Endereço preenchido pelo CEP!', 'success');
        } else {
            window.showNotification('CEP não encontrado.', 'error');
        }
    } catch (e) {
        console.warn('Erro ao consultar ViaCEP:', e);
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
};

window.saveClientFormData = async function() {
    const statusVal = document.getElementById('cfm-status')?.value || 'ATIVO';
    const fantasiaVal = document.getElementById('cfm-fantasia')?.value?.trim()?.toUpperCase();
    if (!fantasiaVal) {
        window.showNotification('Informe o Nome Fantasia da loja.', 'error');
        document.getElementById('cfm-fantasia')?.focus();
        return;
    }

    const indexVal = document.getElementById('cfm-client-index')?.value;
    const isNew = (indexVal === '' || indexVal === null || indexVal === undefined);

    const cnpjVal = document.getElementById('cfm-cnpj')?.value?.trim()?.toUpperCase() || null;
    const razaoVal = document.getElementById('cfm-razao')?.value?.trim()?.toUpperCase() || null;
    const grupoVal = document.getElementById('cfm-grupo')?.value?.trim()?.toUpperCase() || null;
    const grupoRealVal = document.getElementById('cfm-grupo-real')?.value?.trim()?.toUpperCase() || null;

    const cepVal = document.getElementById('cfm-cep')?.value?.trim()?.toUpperCase() || null;
    const ruaVal = document.getElementById('cfm-rua')?.value?.trim()?.toUpperCase() || null;
    const numVal = document.getElementById('cfm-numero')?.value?.trim()?.toUpperCase() || null;
    const compVal = document.getElementById('cfm-complemento')?.value?.trim()?.toUpperCase() || null;
    const bairroVal = document.getElementById('cfm-bairro')?.value?.trim()?.toUpperCase() || null;
    const cidadeVal = document.getElementById('cfm-cidade')?.value?.trim()?.toUpperCase() || null;
    const estadoVal = document.getElementById('cfm-estado')?.value?.trim()?.toUpperCase() || null;
    let endCompletoVal = document.getElementById('cfm-endereco-completo')?.value?.trim()?.toUpperCase() || null;

    // Compor endereço estruturado com todos os detalhes disponíveis
    let logrComposto = ruaVal || '';
    if (numVal) logrComposto += (logrComposto ? `, ${numVal}` : `Nº ${numVal}`);
    if (compVal) logrComposto += (logrComposto ? ` - ${compVal}` : compVal);

    const structuredParts = [
        logrComposto,
        bairroVal,
        cidadeVal ? (estadoVal ? `${cidadeVal}/${estadoVal}` : cidadeVal) : estadoVal,
        cepVal ? `CEP: ${cepVal}` : ''
    ].filter(Boolean);
    const structuredFullEnd = structuredParts.join(' - ');

    const isCityOnly = !endCompletoVal || 
        (cidadeVal && endCompletoVal.toUpperCase() === cidadeVal.toUpperCase()) || 
        (cidadeVal && estadoVal && (endCompletoVal.toUpperCase() === `${cidadeVal}/${estadoVal}`.toUpperCase() || endCompletoVal.toUpperCase() === `${cidadeVal} / ${estadoVal}`.toUpperCase()));

    // Se estiver apenas com a cidade, ou se tiver rua que não estava presente no texto, atualizar para o completo
    if (isCityOnly || (ruaVal && !endCompletoVal.toUpperCase().includes(ruaVal.toUpperCase()))) {
        endCompletoVal = structuredFullEnd || endCompletoVal;
    }

    const endStatusVal = document.getElementById('cfm-endereco-status')?.value || 'REVISADO';

    const propVal = document.getElementById('cfm-proprietario')?.value?.trim()?.toUpperCase() || null;
    const rawTel = document.getElementById('cfm-telefone')?.value?.trim() || '';
    const telVal = (window.formatTelefone ? window.formatTelefone(rawTel) : rawTel) || null;
    const rawNiver = document.getElementById('cfm-aniversario')?.value?.trim() || '';
    const niverVal = (window.formatAniversario ? window.formatAniversario(rawNiver) : rawNiver) || null;

    // Obter marcas selecionadas e status
    const clientBrandsObj = {};
    CLIENT_BRAND_COLS.forEach(brand => {
        const card = document.querySelector(`.cfm-brand-card[data-brand="${brand}"]`);
        const statusSelect = card ? card.querySelector('.cfm-brand-status-select') : null;
        const status = statusSelect ? statusSelect.value : (card ? card.getAttribute('data-status') : 'INATIVO');
        const codeInput = card ? card.querySelector('.cfm-brand-code-input') : null;
        const code = codeInput ? codeInput.value.trim().toUpperCase() : '';

        // Salvar status específico
        clientBrandsObj[brand + '_STATUS'] = status;

        if (status === 'ATIVO') {
            clientBrandsObj[brand] = code || 'SIM';
        } else if (status === 'NAO_FIDELIZADO') {
            clientBrandsObj[brand] = code || 'NÃO FIDELIZADO';
        } else {
            clientBrandsObj[brand] = null;
            clientBrandsObj[brand + '_STATUS'] = 'INATIVO';
        }
    });

    const isLojaInativa = (statusVal === 'INATIVO' || statusVal === 'NAO' || statusVal === 'LOJA_FECHADA');

    const clientData = {
        'CLIENTE ATIVO?': isLojaInativa ? 'NAO' : 'SIM',
        'STATUS': isLojaInativa ? 'INATIVO' : 'ATIVO',
        'CNPJ': cnpjVal,
        'FANTASIA': fantasiaVal,
        'RAZAO SOCIAL': razaoVal,
        'GRUPO': grupoVal,
        'GRUPO REAL': grupoRealVal,
        'CEP': cepVal,
        'RUA': ruaVal,
        'NUMERO': numVal,
        'COMPLEMENTO': compVal,
        'BAIRRO': bairroVal,
        'CIDADE': cidadeVal,
        'ESTADO': estadoVal,
        'ENDERECO COMPLETO': endCompletoVal,
        'ENDERECO?': endStatusVal,
        'PROPRIETARIO': propVal,
        'TELEFONE': telVal,
        'ANIVERSARIO': niverVal,
        ...clientBrandsObj
    };

    if (isNew) {
        // Proteção contra duplicação: se o CNPJ informado já existir na base, atualiza o existente
        if (cnpjVal) {
            const cleanC = cleanDigits(cnpjVal);
            const dupIdx = clientsMasterData.findIndex(c => cleanDigits(c['CNPJ']) === cleanC);
            if (dupIdx !== -1) {
                clientsMasterData[dupIdx] = Object.assign({}, clientsMasterData[dupIdx], clientData);
                currentModalClient = clientsMasterData[dupIdx];
                await persistClientsData(`sincronizou e atualizou os dados do cliente "${fantasiaVal}"`);
                window.showNotification(`Cadastro de "${fantasiaVal}" sincronizado e atualizado com sucesso!`, 'success');
                closeClientFormModal();
                return;
            }
        }
        clientsMasterData.unshift(clientData);
        await persistClientsData(`adicionou o cliente "${fantasiaVal}"`);
        window.showNotification(`Cliente "${fantasiaVal}" cadastrado com sucesso!`, 'success');
    } else {
        const idx = parseInt(indexVal, 10);
        if (idx >= 0 && idx < clientsMasterData.length) {
            clientsMasterData[idx] = Object.assign({}, clientsMasterData[idx], clientData);
            currentModalClient = clientsMasterData[idx];
            await persistClientsData(`atualizou os dados do cliente "${fantasiaVal}"`);
            window.showNotification(`Dados de "${fantasiaVal}" atualizados com sucesso!`, 'success');
        }
    }

    closeClientFormModal();
};

window.deleteCurrentClient = async function() {
    const indexVal = document.getElementById('cfm-client-index')?.value;
    if (indexVal === '' || indexVal === null || indexVal === undefined) return;

    const idx = parseInt(indexVal, 10);
    const client = clientsMasterData[idx];
    if (!client) return;

    const name = client['FANTASIA'] || client['RAZAO SOCIAL'] || 'este cliente';
    if (!confirm(`Tem certeza que deseja remover o cliente "${name}" da base de dados?`)) {
        return;
    }

    clientsMasterData.splice(idx, 1);
    await persistClientsData(`excluiu o cliente "${name}"`);
    closeClientFormModal();
    closeClientDetailModal();
    window.showNotification(`Cliente "${name}" excluído.`, 'success');
};

/* ==========================================================================
   CONSULTA AUTOMÁTICA DE CNPJ NO CADASTRO DE CLIENTES
   Fontes: 1. Receita Federal (publica.cnpj.ws) | 2. Brasil API (contingência)
   ========================================================================== */

window.isValidCNPJ = function(cnpj) {
    if (!cnpj) return false;
    const clean = cnpj.toString().replace(/\D/g, '');
    if (clean.length !== 14) return false;
    
    // Elimina CNPJs com todos os dígitos iguais
    if (/^(\d)\1+$/.test(clean)) return false;

    // Validação do 1º dígito verificador
    let tamanho = 12;
    let numeros = clean.substring(0, tamanho);
    let digitos = clean.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
        if (pos < 2) pos = 9;
    }
    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0), 10)) return false;

    // Validação do 2º dígito verificador
    tamanho = 13;
    numeros = clean.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
        if (pos < 2) pos = 9;
    }
    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(1), 10)) return false;

    return true;
};

window.formatCNPJ = function(value) {
    if (!value) return '';
    let digits = value.toString().replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
};

window.formatTelefone = function(val) {
    if (!val) return '';
    const digits = val.toString().replace(/\D/g, '').slice(0, 11);
    if (digits.length > 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    } else if (digits.length > 6) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    } else if (digits.length > 2) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    } else if (digits.length > 0) {
        return digits;
    }
    return '';
};

window.formatAniversario = function(val) {
    if (!val) return '';
    const digits = val.toString().replace(/\D/g, '').slice(0, 8);
    if (digits.length > 4) {
        return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
        return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
};

function showCnpjFeedback(msg, type = 'info') {
    const el = document.getElementById('cfm-cnpj-feedback');
    if (!el) return;
    el.className = `cfm-cnpj-feedback ${type}`;
    let icon = "<i class='bx bx-info-circle' style='font-size: 1.15rem; flex-shrink: 0;'></i>";
    if (type === 'success') icon = "<i class='bx bx-check-circle' style='font-size: 1.15rem; flex-shrink: 0;'></i>";
    else if (type === 'warning') icon = "<i class='bx bx-error' style='font-size: 1.15rem; flex-shrink: 0;'></i>";
    else if (type === 'error') icon = "<i class='bx bx-x-circle' style='font-size: 1.15rem; flex-shrink: 0;'></i>";
    el.innerHTML = `${icon} <div>${msg}</div>`;
    el.style.display = 'flex';
}

function hideCnpjFeedback() {
    const el = document.getElementById('cfm-cnpj-feedback');
    if (el) {
        el.style.display = 'none';
        el.innerHTML = '';
    }
}

function normalizeCnpjResponse(data, source) {
    if (!data) return null;

    let res = {
        cnpj: '',
        razaoSocial: '',
        nomeFantasia: '',
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        municipio: '',
        uf: '',
        telefone: '',
        email: '',
        situacaoCadastral: '',
        statusAtivo: 'SIM',
        fonteConsulta: source
    };

    if (source === 'Receita Federal') {
        const est = data.estabelecimento || {};
        res.cnpj = est.cnpj || data.cnpj || '';
        res.razaoSocial = data.razao_social || '';
        res.nomeFantasia = est.nome_fantasia || data.nome_fantasia || '';
        res.cep = est.cep || '';

        const tipoLogr = (est.tipo_logradouro || '').trim();
        const logr = (est.logradouro || '').trim();
        res.logradouro = tipoLogr && !logr.toUpperCase().startsWith(tipoLogr.toUpperCase())
            ? `${tipoLogr} ${logr}`.trim()
            : logr || tipoLogr;

        res.numero = est.numero || '';
        res.complemento = est.complemento || '';
        res.bairro = est.bairro || '';
        res.municipio = est.cidade?.nome || '';
        res.uf = est.estado?.sigla || '';

        const ddd = est.ddd1 || '';
        const tel = est.telefone1 || '';
        if (ddd && tel) res.telefone = `(${ddd}) ${tel}`;
        else if (tel) res.telefone = tel;

        res.email = est.email || '';
        res.situacaoCadastral = est.situacao_cadastral || '';

        const sitUpper = res.situacaoCadastral.toUpperCase();
        if (sitUpper.includes('BAIXADA') || sitUpper.includes('INAPTA') || sitUpper.includes('SUSPENSA') || sitUpper.includes('NULA')) {
            res.statusAtivo = 'NAO';
        } else {
            res.statusAtivo = 'SIM';
        }
    } else {
        // Brasil API
        res.cnpj = data.cnpj || '';
        res.razaoSocial = data.razao_social || '';
        res.nomeFantasia = data.nome_fantasia || '';
        res.cep = data.cep || '';

        const tipoLogr = (data.descricao_tipo_de_logradouro || '').trim();
        const logr = (data.logradouro || '').trim();
        res.logradouro = tipoLogr && !logr.toUpperCase().startsWith(tipoLogr.toUpperCase())
            ? `${tipoLogr} ${logr}`.trim()
            : logr || tipoLogr;

        res.numero = data.numero || '';
        res.complemento = data.complemento || '';
        res.bairro = data.bairro || '';
        res.municipio = data.municipio || '';
        res.uf = data.uf || '';

        const telRaw = (data.ddd_telefone_1 || '').trim();
        if (telRaw) {
            const digits = telRaw.replace(/\D/g, '');
            if (digits.length === 10) {
                res.telefone = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
            } else if (digits.length === 11) {
                res.telefone = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
            } else {
                res.telefone = telRaw;
            }
        }

        res.email = data.email || '';
        res.situacaoCadastral = data.descricao_situacao_cadastral || (data.situacao_cadastral === 2 ? 'ATIVA' : '');

        const sitUpper = (res.situacaoCadastral || '').toUpperCase();
        if (sitUpper.includes('BAIXADA') || sitUpper.includes('INAPTA') || sitUpper.includes('SUSPENSA') || sitUpper.includes('NULA')) {
            res.statusAtivo = 'NAO';
        } else {
            res.statusAtivo = 'SIM';
        }
    }

    const cepClean = (res.cep || '').replace(/\D/g, '');
    if (cepClean.length === 8) {
        res.cep = `${cepClean.slice(0, 5)}-${cepClean.slice(5)}`;
    }

    // Normalizar todos os campos de texto para MAIÚSCULO
    for (let k in res) {
        if (typeof res[k] === 'string' && k !== 'fonteConsulta') {
            res[k] = res[k].toUpperCase().trim();
        }
    }

    return res;
}

window.lookupCnpjData = async function() {
    const cnpjInput = document.getElementById('cfm-cnpj');
    if (!cnpjInput) return;

    const rawVal = cnpjInput.value || '';
    const clean = cleanDigits(rawVal);

    if (!clean || clean.length !== 14 || !window.isValidCNPJ(clean)) {
        showCnpjFeedback('O CNPJ informado é inválido. Verifique os números e tente novamente.', 'error');
        window.showNotification('O CNPJ informado é inválido. Verifique os números e tente novamente.', 'error');
        cnpjInput.focus();
        return;
    }

    // Formata o campo de CNPJ visualmente
    cnpjInput.value = window.formatCNPJ(clean);

    // 1. Verificação de duplicidade na base atual de clientes
    const currentFormIdx = document.getElementById('cfm-client-index')?.value;
    const currentIdxInt = (currentFormIdx !== '' && currentFormIdx !== null && currentFormIdx !== undefined) ? parseInt(currentFormIdx, 10) : -1;

    const dupIndex = clientsMasterData.findIndex((c, idx) => {
        if (currentIdxInt >= 0 && idx === currentIdxInt) return false;
        return cleanDigits(c['CNPJ']) === clean;
    });

    let existingClient = null;
    let isSyncingExisting = false;

    if (dupIndex !== -1) {
        existingClient = clientsMasterData[dupIndex];
        isSyncingExisting = true;
        window._lastSyncOriginalClient = JSON.parse(JSON.stringify(existingClient));
        window._lastSyncDupIndex = dupIndex;

        // Se o formulário estava em modo "Novo Cliente", vincula ao cliente existente para evitar duplicações
        const indexInput = document.getElementById('cfm-client-index');
        if (indexInput) indexInput.value = dupIndex;

        const titleEl = document.getElementById('cfm-modal-title');
        const subEl = document.getElementById('cfm-modal-subtitle');
        const iconEl = document.getElementById('cfm-header-icon');
        const clientName = existingClient['FANTASIA'] || existingClient['RAZAO SOCIAL'] || 'Cliente sem nome';

        if (titleEl) titleEl.textContent = 'Editar Cliente (Sincronização)';
        if (subEl) subEl.textContent = `Sincronizando com o cadastro de "${clientName}"`;
        if (iconEl) iconEl.innerHTML = "<i class='bx bx-sync'></i>";

        // Carrega marcas e campos internos existentes para garantir que não sejam perdidos
        renderFormBrandToggles(existingClient);

        // Preserva campos internos
        if (existingClient['GRUPO'] && !document.getElementById('cfm-grupo').value) {
            document.getElementById('cfm-grupo').value = existingClient['GRUPO'];
        }
        if (existingClient['GRUPO REAL'] && !document.getElementById('cfm-grupo-real').value) {
            document.getElementById('cfm-grupo-real').value = existingClient['GRUPO REAL'];
        }
        if (existingClient['VANS'] && document.getElementById('cfm-cod-arezzo') && !document.getElementById('cfm-cod-arezzo').value) {
            document.getElementById('cfm-cod-arezzo').value = existingClient['VANS'];
        }
        if (existingClient['NEW ERA'] && document.getElementById('cfm-cod-new-era') && !document.getElementById('cfm-cod-new-era').value) {
            document.getElementById('cfm-cod-new-era').value = existingClient['NEW ERA'];
        }
        if (existingClient['PROPRIETARIO'] && !document.getElementById('cfm-proprietario').value) {
            document.getElementById('cfm-proprietario').value = existingClient['PROPRIETARIO'];
        }
        if (existingClient['ANIVERSARIO'] && !document.getElementById('cfm-aniversario').value) {
            document.getElementById('cfm-aniversario').value = window.formatAniversario ? window.formatAniversario(existingClient['ANIVERSARIO']) : existingClient['ANIVERSARIO'];
        }

        const deleteBtn = document.getElementById('cfm-delete-btn');
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    }

    // 2. Estado visual de carregamento no botão
    const btn = document.getElementById('cfm-btn-lookup-cnpj');
    const originalBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> <span>Consultando Receita Federal...</span>";
    }

    showCnpjFeedback('Consultando dados cadastrais oficiais...', 'info');

    let responseData = null;
    let sourceUsed = '';

    const fetchWithTimeout = async (url, timeoutMs = 7000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const resp = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            return resp;
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
    };

    // 3. Tentativa Fonte Primária: Receita Federal (publica.cnpj.ws)
    try {
        const resPrimary = await fetchWithTimeout(`https://publica.cnpj.ws/cnpj/${clean}`, 7000);
        if (resPrimary.ok) {
            const jsonPrimary = await resPrimary.json();
            if (jsonPrimary && (jsonPrimary.razao_social || jsonPrimary.estabelecimento)) {
                responseData = jsonPrimary;
                sourceUsed = 'Receita Federal';
            }
        }
    } catch (ePrimary) {
        console.warn('Fonte primária (Receita Federal) falhou ou timeout:', ePrimary);
    }

    // 4. Tentativa Fonte Secundária / Contingência: Brasil API
    if (!responseData) {
        showCnpjFeedback('Não foi possível consultar a fonte principal. Tentando a fonte alternativa (Brasil API)...', 'info');
        if (btn) {
            btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> <span>Consultando Brasil API...</span>";
        }
        try {
            const resSecondary = await fetchWithTimeout(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, 7000);
            if (resSecondary.ok) {
                const jsonSecondary = await resSecondary.json();
                if (jsonSecondary && (jsonSecondary.razao_social || jsonSecondary.cnpj)) {
                    responseData = jsonSecondary;
                    sourceUsed = 'Brasil API';
                }
            }
        } catch (eSecondary) {
            console.warn('Fonte secundária (Brasil API) falhou ou timeout:', eSecondary);
        }
    }

    // Restaurar botão
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml || "<i class='bx bx-search-alt-2'></i> <span>BUSCAR DADOS DO CNPJ</span>";
    }

    // 5. Se ambas falharem
    if (!responseData) {
        showCnpjFeedback('Não foi possível consultar os dados deste CNPJ no momento. Verifique sua conexão ou preencha manualmente.', 'error');
        window.showNotification('Não foi possível consultar os dados deste CNPJ no momento.', 'error');
        return;
    }

    // 6. Normalização e Preenchimento/Sincronização dos dados
    const norm = normalizeCnpjResponse(responseData, sourceUsed);
    if (!norm) {
        showCnpjFeedback('Estrutura de dados não reconhecida. Preencha os campos manualmente.', 'error');
        return;
    }

    // Se estamos sincronizando com um cliente existente na base
    if (isSyncingExisting && existingClient) {
        const clientName = existingClient['FANTASIA'] || existingClient['RAZAO SOCIAL'] || 'Cliente sem nome';
        const oldRazao = existingClient['RAZAO SOCIAL'] || '';
        const oldEnd = existingClient['ENDERECO COMPLETO'] || `${existingClient['CIDADE'] || ''}/${existingClient['ESTADO'] || ''}`;

        // 1. Razão Social: Atualiza com a Razão Social oficial
        if (norm.razaoSocial) document.getElementById('cfm-razao').value = norm.razaoSocial;

        // 2. Nome Fantasia: Se já existia nome comercial, preserva; caso contrário preenche
        const oldFantasia = existingClient['FANTASIA'] || '';
        if (oldFantasia) {
            document.getElementById('cfm-fantasia').value = oldFantasia;
        } else if (norm.nomeFantasia) {
            document.getElementById('cfm-fantasia').value = norm.nomeFantasia;
        } else if (norm.razaoSocial) {
            document.getElementById('cfm-fantasia').value = norm.razaoSocial;
        }

        // 3. Status Cadastral
        if (norm.statusAtivo === 'NAO') {
            document.getElementById('cfm-status').value = 'INATIVO';
        } else if (existingClient['CLIENTE ATIVO?']) {
            document.getElementById('cfm-status').value = (existingClient['CLIENTE ATIVO?'].toString().trim().toUpperCase() === 'NAO') ? 'INATIVO' : 'ATIVO';
        }

        // 4. Endereço oficial
        if (norm.cep) document.getElementById('cfm-cep').value = norm.cep;
        if (norm.logradouro) document.getElementById('cfm-rua').value = norm.logradouro;
        if (norm.numero) document.getElementById('cfm-numero').value = norm.numero;
        if (norm.complemento) document.getElementById('cfm-complemento').value = norm.complemento;
        if (norm.bairro) document.getElementById('cfm-bairro').value = norm.bairro;
        if (norm.municipio) document.getElementById('cfm-cidade').value = norm.municipio;
        if (norm.uf) document.getElementById('cfm-estado').value = norm.uf;

        window.updateFormEnderecoCompleto();

        // Badge de status no topo
        const badge = document.getElementById('cfm-cnpj-badge');
        if (badge) {
            badge.innerHTML = `<i class='bx bx-check-shield'></i> ${norm.fonteConsulta} (${norm.situacaoCadastral || 'ATIVA'})`;
            badge.style.display = 'inline-flex';
        }

        // Renderiza o card de sincronização visual interativo
        const feedbackEl = document.getElementById('cfm-cnpj-feedback');
        if (feedbackEl) {
            feedbackEl.className = 'cfm-cnpj-feedback success';
            feedbackEl.style.display = 'block';
            feedbackEl.innerHTML = `
                <div class="cfm-sync-card">
                    <div class="sync-card-header">
                        <div class="sync-card-title">
                            <i class='bx bx-git-merge' style="color: #818cf8; font-size: 1.15rem;"></i>
                            <span>Sincronização com Cadastro Existente Concluída</span>
                        </div>
                        <span class="sync-client-tag">Cliente: ${escapeHTML(clientName)}</span>
                    </div>
                    <div class="sync-card-desc">
                        Este CNPJ já pertence ao cliente <strong>"${escapeHTML(clientName)}"</strong> no sistema. Os dados cadastrais oficiais obtidos da <strong>${norm.fonteConsulta}</strong> foram mesclados e sincronizados com o formulário.
                        <div style="margin-top: 0.45rem; padding: 0.35rem 0.6rem; background: rgba(234,179,8,0.15); border: 1px solid rgba(234,179,8,0.3); border-radius: 6px; color: #fef08a; font-size: 0.8rem; display: flex; align-items: center; gap: 0.4rem;">
                            <i class='bx bx-info-circle' style="font-size: 1rem; color: #facc15;"></i>
                            <span>Clique em <strong>"Concluir e Salvar Vínculo Agora"</strong> para efetivar as alterações e sumir com a pendência no relatório.</span>
                        </div>
                    </div>
                    <div class="sync-card-badges">
                        <span class="sync-pill preserved" title="Marcas, códigos e grupos do cliente foram mantidos intactos">
                            <i class='bx bx-check-circle'></i> Marcas & Códigos Preservados
                        </span>
                        <span class="sync-pill updated" title="Razão social e endereço foram atualizados com os dados oficiais">
                            <i class='bx bx-refresh'></i> Razão Social & Endereço Sincronizados
                        </span>
                        <span class="sync-pill status" title="Situação cadastral na Receita Federal">
                            <i class='bx bx-shield-quarter'></i> Situação: ${norm.situacaoCadastral || 'ATIVA'}
                        </span>
                    </div>
                    <div class="sync-card-buttons">
                        <button type="button" class="btn-sync-save-now" onclick="window.saveClientFormData()" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 6px; padding: 0.45rem 0.85rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; box-shadow: 0 2px 6px rgba(16,185,129,0.35); transition: opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                            <i class='bx bx-check-double'></i> Concluir e Salvar Vínculo Agora
                        </button>
                        <button type="button" class="btn-sync-toggle-diff" onclick="window.toggleSyncDiffDetails()">
                            <i class='bx bx-list-check'></i> Ver O que Foi Sincronizado
                        </button>
                        <button type="button" class="btn-sync-revert" onclick="window.revertClientSync(${dupIndex})">
                            <i class='bx bx-undo'></i> Restaurar Cadastro Anterior
                        </button>
                    </div>
                    <div id="cfm-sync-diff-details" style="display: none; margin-top: 0.65rem; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 0.65rem;">
                        <table class="sync-diff-table">
                            <thead>
                                <tr>
                                    <th>Campo</th>
                                    <th>No Cadastro Anterior</th>
                                    <th>Sincronizado (${norm.fonteConsulta})</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>Razão Social</strong></td>
                                    <td class="diff-old">${escapeHTML(oldRazao || '-')}</td>
                                    <td class="diff-new">${escapeHTML(norm.razaoSocial || '-')}</td>
                                </tr>
                                <tr>
                                    <td><strong>Endereço</strong></td>
                                    <td class="diff-old">${escapeHTML(oldEnd || '-')}</td>
                                    <td class="diff-new">${escapeHTML(document.getElementById('cfm-endereco-completo').value || '-')}</td>
                                </tr>
                                <tr>
                                    <td><strong>Situação Cadastral</strong></td>
                                    <td class="diff-old">${escapeHTML(existingClient['CLIENTE ATIVO?'] || 'SIM')}</td>
                                    <td class="diff-new">${escapeHTML(norm.situacaoCadastral || 'ATIVA')} (${norm.statusAtivo === 'SIM' ? 'ATIVO' : 'INATIVO'})</td>
                                </tr>
                                <tr>
                                    <td><strong>Marcas & Códigos</strong></td>
                                    <td colspan="2" style="color: #a7f3d0; font-weight: 500;">
                                        <i class='bx bx-lock-alt'></i> Preservados: New Era (${existingClient['NEW ERA'] || '-'}), Vans (${existingClient['VANS'] || '-'}), Grupo (${existingClient['GRUPO'] || '-'})
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        window.showNotification(`Cadastro de "${clientName}" sincronizado com sucesso via ${norm.fonteConsulta}!`, 'success');
        return;
    }

    // Fluxo padrão para novo cliente inexistente
    if (norm.razaoSocial) document.getElementById('cfm-razao').value = norm.razaoSocial;
    if (norm.nomeFantasia) {
        document.getElementById('cfm-fantasia').value = norm.nomeFantasia;
    } else if (!document.getElementById('cfm-fantasia').value && norm.razaoSocial) {
        document.getElementById('cfm-fantasia').value = norm.razaoSocial;
    }

    if (norm.statusAtivo) document.getElementById('cfm-status').value = (norm.statusAtivo === 'NAO') ? 'INATIVO' : 'ATIVO';
    if (norm.cep) document.getElementById('cfm-cep').value = norm.cep;
    if (norm.logradouro) document.getElementById('cfm-rua').value = norm.logradouro;
    if (norm.numero) document.getElementById('cfm-numero').value = norm.numero;
    if (norm.complemento) document.getElementById('cfm-complemento').value = norm.complemento;
    if (norm.bairro) document.getElementById('cfm-bairro').value = norm.bairro;
    if (norm.municipio) document.getElementById('cfm-cidade').value = norm.municipio;
    if (norm.uf) document.getElementById('cfm-estado').value = norm.uf;

    // Atualiza composição de endereço completo
    window.updateFormEnderecoCompleto();

    // Badge de status no topo do modal
    const badge = document.getElementById('cfm-cnpj-badge');
    if (badge) {
        badge.innerHTML = `<i class='bx bx-check-shield'></i> ${norm.fonteConsulta} (${norm.situacaoCadastral || 'ATIVA'})`;
        badge.style.display = 'inline-flex';
    }

    showCnpjFeedback(`Dados cadastrais encontrados via <strong>${norm.fonteConsulta}</strong>. Situação: <strong>${norm.situacaoCadastral || 'ATIVA'}</strong>. Confira as informações antes de salvar.`, 'success');
    window.showNotification(`Dados cadastrais encontrados via ${norm.fonteConsulta}! Confira as informações antes de salvar.`, 'success');
};

window.revertClientSync = function(idx) {
    if (idx >= 0 && idx < clientsMasterData.length) {
        const client = window._lastSyncOriginalClient || clientsMasterData[idx];
        openEditClient(client, idx);
        showCnpjFeedback(`Cadastro restaurado para os dados originais de "${client['FANTASIA'] || client['RAZAO SOCIAL']}".`, 'info');
        window.showNotification('Dados originais do cliente restaurados.', 'info');
    }
};

window.toggleSyncDiffDetails = function() {
    const el = document.getElementById('cfm-sync-diff-details');
    if (el) {
        const isHidden = (el.style.display === 'none' || !el.style.display);
        el.style.display = isHidden ? 'block' : 'none';
    }
};

// Event listener para garantir MAIÚSCULAS ao digitar nos campos de cadastro e máscara de CNPJ/CEP
document.addEventListener('input', function(e) {
    const el = e.target;
    if (el && el.closest('#client-edit-form')) {
        // Máscara CNPJ em tempo real
        if (el.id === 'cfm-cnpj') {
            const raw = el.value;
            const formatted = window.formatCNPJ(raw);
            if (raw !== formatted && raw.length <= 18) {
                el.value = formatted;
            }
            return;
        }

        // Máscara CEP em tempo real
        if (el.id === 'cfm-cep') {
            let digits = el.value.replace(/\D/g, '').slice(0, 8);
            if (digits.length > 5) {
                el.value = `${digits.slice(0, 5)}-${digits.slice(5)}`;
            } else {
                el.value = digits;
            }
            return;
        }

        // Máscara Telefone em tempo real: (13) 3273-2560 ou (11) 98765-4321
        if (el.id === 'cfm-telefone') {
            const raw = el.value;
            const formatted = window.formatTelefone(raw);
            if (raw !== formatted && raw.length <= 15) {
                el.value = formatted;
            }
            return;
        }

        // Máscara Aniversário em tempo real: DD/MM/AAAA ou DD/MM
        if (el.id === 'cfm-aniversario') {
            const raw = el.value;
            const formatted = window.formatAniversario(raw);
            if (raw !== formatted && raw.length <= 10) {
                el.value = formatted;
            }
            return;
        }

        // Todos os outros campos de texto: forçar MAIÚSCULAS
        if (el.tagName === 'INPUT' && (el.type === 'text' || !el.type)) {
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const upper = el.value.toUpperCase();
            if (el.value !== upper) {
                el.value = upper;
                if (start !== null && end !== null) {
                    el.setSelectionRange(start, end);
                }
            }
        }
    }
});

// Ao sair do campo (focusout/blur), garante formatação completa
document.addEventListener('focusout', function(e) {
    const el = e.target;
    if (el && el.closest('#client-edit-form')) {
        if (el.id === 'cfm-telefone' && el.value) {
            el.value = window.formatTelefone(el.value);
        } else if (el.id === 'cfm-aniversario' && el.value) {
            el.value = window.formatAniversario(el.value);
        }
    }
});



