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

const brandCustomLogos = {
    "MORMAII": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y+mAAAARVBMVEVHcEwAAAANDg4PEBAODw8KCwwHCAkNDg4PDw8ICQkFBQUMDAwLDQ0MDQ0KCgoHBwcJCQkNDg4ODg4GBgYBAQEODg4NDg7OL+TmAAAAF3RSTlMAAy9SRAoROGrM8qEaJa7XvWCC5P55jAsXFrMAAADKSURBVHgB1RHFgQQxKB4Cceu/1GNeowXcRnBH/JsjlTb2Q+yU9g4CUnyqbIJcautjzvXwlGmFOTMQTqR017lWJ0uBYVmPoGkjS/vhXNujHE+V08EeE3fb94yKVnK+cboArRZzj9nY1tSJWfeB++poV5PCtjJH1xlnvZWqlxOxj1m14XqCvzWxPSdFJCU0J9Xi5kiR0xVwQgAGI+9KgIL5EJqavXz2P0ZPx4yI0UNHGEC5pHd/LwoGmZV3B+PE65gWnTHKyc+9i185f81WCtv3c3ikAAAAAElFTkSuQmCC",
    "STEP DEFEND": "https://raichu-uploads.s3.amazonaws.com/logo_step-defend_u3MTde.png",
    "VANS": "https://assets.vans.eu/image/upload/v1755503693/default.svg"
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
const viewDashboard = document.getElementById('view-dashboard');
const viewDay = document.getElementById('view-day');
const viewKanban = document.getElementById('view-kanban');
const viewBrand = document.getElementById('view-brand');

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

function checkUserRole() {
    const role = localStorage.getItem('empresa_auth_role');
    if (role === 'admin') {
        document.body.classList.add('is-admin');
    } else {
        document.body.classList.remove('is-admin');
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
    
    selectDate(formatDate(new Date()));
    switchTab('dashboard');
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
    if (tabDashboard) tabDashboard.classList.remove('active');
    tabDay.classList.remove('active');
    tabKanban.classList.remove('active');
    
    const navDashboardBtn = document.getElementById('nav-dashboard-btn');
    const navDayBtn = document.getElementById('nav-day-btn');
    const navBrandsBtn = document.getElementById('nav-brands-btn');
    if(navDashboardBtn) navDashboardBtn.classList.remove('active');
    if(navDayBtn) navDayBtn.classList.remove('active');
    if(navBrandsBtn) navBrandsBtn.classList.remove('active');
    
    if (viewDashboard) viewDashboard.classList.remove('active');
    viewDay.classList.remove('active');
    viewKanban.classList.remove('active');
    viewBrand.classList.remove('active');
    
    // Remover a classe active de todas as marcas do sidebar
    document.querySelectorAll('.sidebar-brand-item').forEach(el => el.classList.remove('active'));

    if (tab === 'dashboard') {
        if (tabDashboard) tabDashboard.classList.add('active');
        if (navDashboardBtn) navDashboardBtn.classList.add('active');
        if (viewDashboard) viewDashboard.classList.add('active');
        currentViewBrand = null;
        renderDashboard();
    } else if(tab === 'day') {
        tabDay.classList.add('active');
        if(navDayBtn) navDayBtn.classList.add('active');
        viewDay.classList.add('active');
        currentViewBrand = null;
    } else if (tab === 'kanban') {
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
        viewBrand.classList.add('active');
        if(navBrandsBtn) navBrandsBtn.classList.add('active');
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
            renderSettingsBrands();
            renderSidebarBrands();
            renderKanban(); 
            updateDashboardFilterBrands();
            if(currentViewBrand) renderBrandTasks();
            renderDashboard();
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
            
            // Regra de visualização: admin vê tudo, usuário comum vê apenas tarefas atribuídas a si
            let canView = false;
            if (isAdmin) {
                canView = true;
            } else if (taskAssignees.some(a => a.toLowerCase().trim() === loggedInEmail)) {
                canView = true;
            }

            if (canView) {
                const pathSegments = doc.ref.path.split('/');
                const dayId = pathSegments[1];
                allTasks.push({ id: doc.id, dayId: dayId, refPath: doc.ref.path, ...taskData });
            }
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
    brands.forEach(b => {
        const li = document.createElement('li');
        li.className = 'sidebar-brand-item';
        if(currentViewBrand === b && viewBrand.classList.contains('active')) {
            li.classList.add('active');
        }
        li.innerHTML = `<div style="display:flex; align-items:center; gap:0.5rem;">${getBrandLogoHTML(b, 18)} <span>${b}</span></div>`;
        li.onclick = () => selectBrandView(b);
        sidebarBrandsList.appendChild(li);
    });
}

function renderSettingsBrands() {
    const listEl = document.getElementById('settings-brands-list');
    listEl.innerHTML = '';
    brands.forEach(b => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${b}</span> <button class="btn-delete-item" onclick="deleteBrand('${b}')"><i class='bx bx-trash'></i></button>`;
        listEl.appendChild(li);
    });
}

async function addBrand() {
    const input = document.getElementById('new-brand-input');
    const val = input.value.trim().toUpperCase();
    if(val && !brands.includes(val)) {
        brands.push(val);
        await window.db.collection('settings').doc('brands').set({ list: brands.sort() });
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
    await window.db.collection('settings').doc('brands').set({ list: brands });
    if(currentViewBrand === val) {
        switchTab('day'); // reset se deletar a marca atual
    }
}

function openSettingsModal() { settingsModal.classList.remove('hidden'); }
function closeSettingsModal() { settingsModal.classList.add('hidden'); }

// ----------------------------------------------------
// TASK MODAL LOGIC (Criar e Editar)
// ----------------------------------------------------
function populateTaskFormOptions() {
    taskBrandSelect.innerHTML = '<option value="">Sem Marca</option>';
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
            closeTaskModal();
            window.location.reload();
        }
    }
});

document.getElementById('cancel-delete-series').addEventListener('click', () => {
    document.getElementById('delete-series-modal').classList.add('hidden');
});

document.getElementById('confirm-delete-only-this').addEventListener('click', async () => {
    if(!editingTaskRefPath) return;
    await window.db.doc(editingTaskRefPath).delete();
    document.getElementById('delete-series-modal').classList.add('hidden');
    closeTaskModal();
    window.location.reload();
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
    
    document.getElementById('delete-series-modal').classList.add('hidden');
    closeTaskModal();
    window.location.reload();
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
    const doc = await window.db.doc(refPath).get();
    if(doc.exists) {
        openTaskModal(doc.data(), refPath);
    }
}

let pendingTaskUpdateData = null;
let pendingOldTaskData = null;

async function updateSingleTaskPath(refPath, oldDate, newDate, updateData) {
    if (oldDate === newDate) {
        await window.db.doc(refPath).update(updateData);
    } else {
        // Deleta o antigo
        await window.db.doc(refPath).delete();
        
        // Adiciona o novo com o mesmo ID para integridade de links/referências
        const pathSegments = refPath.split('/');
        const taskId = pathSegments[3];
        await window.db.collection(`days/${newDate}/tasks`).doc(taskId).set(updateData);
        
        // Registrar atividade do dia
        if (!daysWithTasks.has(newDate)) {
            await window.db.collection("days").doc(newDate).set({ active: true }, { merge: true });
            daysWithTasks.add(newDate);
        }
    }
}

async function saveTask() {
    const title = taskTitleInput.value.trim();
    if(!title) {
        alert("O título da tarefa é obrigatório!");
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

    const statusVal = document.getElementById('task-status') ? document.getElementById('task-status').value : 'pending';

    const updateData = {
        text: title,
        subtitle: document.getElementById('task-subtitle').value.trim(),
        priority: taskPriorityInput.value,
        status: statusVal,
        brand: taskBrandSelect.value || "Sem Marca",
        assignees: selectedAssignees,
        comments: taskCommentsInput.value.trim(),
        startDate: startDate,
        deadline: deadline || startDate,
        recurrenceRule: recurrence,
        recurrenceDays: selectedDays
    };

    if (editingTaskRefPath) {
        const doc = await window.db.doc(editingTaskRefPath).get();
        const oldData = doc.data();
        
        if (statusVal === 'completed') {
            if (!oldData.completedAt) {
                updateData.completedAt = Date.now();
            } else {
                updateData.completedAt = oldData.completedAt;
            }
        } else {
            updateData.completedAt = firebase.firestore.FieldValue.delete();
        }

        // Se a tarefa pertencer a uma recorrência (seriesId ativo)
        if (oldData.seriesId) {
            pendingTaskUpdateData = updateData;
            pendingOldTaskData = { ...oldData, refPath: editingTaskRefPath };
            document.getElementById('save-series-modal').classList.remove('hidden');
            return;
        }

        // Caso contrário, é uma tarefa comum de data única
        await updateSingleTaskPath(editingTaskRefPath, oldData.dayId || oldData.startDate, startDate, updateData);

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
            taskBrandSelect.value || "Sem Marca",
            selectedAssignees,
            taskCommentsInput.value.trim(),
            deadline || startDate,
            false,
            statusVal
        );
    }

    closeTaskModal();
    window.location.reload();
}

// Confirmadores de Salvamento de Série Recorrente
document.getElementById('cancel-save-series').addEventListener('click', () => {
    document.getElementById('save-series-modal').classList.add('hidden');
    pendingTaskUpdateData = null;
    pendingOldTaskData = null;
});

document.getElementById('confirm-save-only-this').addEventListener('click', async () => {
    if (!pendingTaskUpdateData || !pendingOldTaskData) return;
    
    const oldStartDate = pendingOldTaskData.startDate || pendingOldTaskData.dayId;
    const newStartDate = pendingTaskUpdateData.startDate;
    const updateData = { ...pendingTaskUpdateData, seriesId: pendingOldTaskData.seriesId };
    
    await updateSingleTaskPath(pendingOldTaskData.refPath, oldStartDate, newStartDate, updateData);
    
    document.getElementById('save-series-modal').classList.add('hidden');
    closeTaskModal();
    window.location.reload();
});

document.getElementById('confirm-save-future-series').addEventListener('click', async () => {
    if (!pendingTaskUpdateData || !pendingOldTaskData) return;
    
    const oldStartDate = pendingOldTaskData.startDate || pendingOldTaskData.dayId;
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
    
    document.getElementById('save-series-modal').classList.add('hidden');
    closeTaskModal();
    window.location.reload();
});

document.getElementById('confirm-save-all-series').addEventListener('click', async () => {
    if (!pendingTaskUpdateData || !pendingOldTaskData) return;
    
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
    
    document.getElementById('save-series-modal').classList.add('hidden');
    closeTaskModal();
    window.location.reload();
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
        const newTask = {
            text, subtitle, status: currentStatus, priority, brand, assignees, comments, 
            startDate: dateStr,
            deadline: occurrenceDeadline, 
            createdAt: new Date().getTime(),
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
            if(!t.assignees || !t.assignees.some(a => assigneeFilters.includes(a))) return false;
        }
        
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
                
                let canView = false;
                if (isAdmin) {
                    canView = true;
                } else if (taskAssignees.some(a => a.toLowerCase().trim() === loggedInEmail)) {
                    canView = true;
                }

                if (canView) {
                    localTasks.push({ 
                        id: doc.id, 
                        refPath: `days/${dateStr}/tasks/${doc.id}`,
                        ...taskData 
                    });
                }
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

    const currentDayTasks = [...localTasks];
    
    const deadlineTasks = [];
    if(window.allGlobalTasks) {
        window.allGlobalTasks.forEach(t => {
            if(t.deadline === activeDateStr && t.dayId !== activeDateStr && t.status === 'pending') {
                deadlineTasks.push(t);
            }
        });
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

    const todayStr = formatDate(new Date());
    let delayedTasks = [];
    let monthTasks = [];
    
    if(window.allGlobalTasks && activeDateStr) {
        const [y, m] = activeDateStr.split('-');
        const prefix = `${y}-${m}-`;
        
        const uniqueMonthMap = new Map();
        const uniqueDelayedMap = new Map();
        
        window.allGlobalTasks.forEach(t => {
            if(t.status !== 'completed') {
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
            if(!t.assignees || !t.assignees.some(a => assigneeFilters.includes(a))) return false;
        }
        
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
    const icon = isCompleted ? '✅' : '⚠️';
    
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
                ${badgesHtml ? `<div class="task-badges">${badgesHtml}</div>` : ''}
                ${assigneesHtml}
                ${deadlineHtml}
                ${feedbackHtml}
            </div>
            <div class="kanban-actions">
                <button class="kanban-action-btn edit-btn" onclick="editTask('${refPath}')" title="Editar"><i class='bx bx-edit-alt'></i></button>
                <button class="kanban-action-btn finish-btn" onclick="promptCompleteTask('${refPath}', '${task.status}')">${isCompleted ? 'Desfazer ↺' : 'Concluir ✅'}</button>
            </div>
        `;
    } else {
        div.innerHTML = `
            <button class="task-status-btn" onclick="promptCompleteTask('${refPath}', '${task.status}')">${icon}</button>
            <div class="task-content-wrapper">
                <div class="task-title-row">
                    <div style="display: flex; flex-direction: column;">
                        <span class="task-title">${task.text}</span>
                        ${task.subtitle ? `<span class="task-subtitle" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">${task.subtitle}</span>` : ''}
                    </div>
                    <div class="task-actions-row">
                        <button class="task-action-btn" onclick="editTask('${refPath}')" title="Editar"><i class='bx bx-edit-alt'></i></button>
                        <button class="task-action-btn delete-btn" onclick="deleteTaskGlobal('${refPath}')" title="Excluir"><i class='bx bx-trash'></i></button>
                    </div>
                </div>
                ${badgesHtml ? `<div class="task-badges">${badgesHtml}</div>` : ''}
                ${assigneesHtml}
                ${deadlineHtml}
                ${commentsHtml}
                ${feedbackHtml}
            </div>
        `;
    }

    return div;
}

// ----------------------------------------------------
// ACTIONS GLOBAIS DE DELEÇÃO/STATUS E FEEDBACK DE CONCLUSÃO
// ----------------------------------------------------
let completingTaskRefPath = null;

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
    if(currentStatus === 'completed') {
        await window.db.doc(refPath).update({ status: 'pending', completedAt: firebase.firestore.FieldValue.delete() });
    } else {
        await window.db.doc(refPath).update({ status: 'completed', completedAt: Date.now() });
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
}

window.deleteTask = async function(taskId) {
    if(confirm("Tem certeza que deseja excluir esta tarefa?")) {
        await window.db.doc(`days/${activeDateStr}/tasks/${taskId}`).delete();
    }
}

window.deleteTaskGlobal = async function(refPath) {
    if(confirm("Tem certeza que deseja excluir esta tarefa?")) {
        await window.db.doc(refPath).delete();
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
            if (!t.assignees || !t.assignees.some(a => assigneeFilters.includes(a))) return false;
        }
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
    const overdueTasks = periodTasks.filter(isOverdue).sort((a,b) => {
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

                // Calcular dias de atraso e injetar badge de alerta
                const refDateStr = task.deadline || task.dayId;
                const [y, m, d] = refDateStr.split('-').map(Number);
                const refDate = new Date(y, m - 1, d);
                const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
                const diffTime = todayMidnight - refDate;
                const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

                const overdueBadge = document.createElement('span');
                overdueBadge.className = 'badge';
                overdueBadge.style.cssText = 'background: rgba(239, 68, 68, 0.15); color: var(--danger-color); font-weight: 600; margin-left: 0.5rem;';
                overdueBadge.innerHTML = `<i class='bx bx-alarm'></i> Vencida há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
                
                const badgesDiv = cardEl.querySelector('.task-badges');
                if(badgesDiv) badgesDiv.appendChild(overdueBadge);

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
                tasksList += `
                    <div class="timeline-task-item" style="font-size:0.78rem; display:${isExtra ? 'none' : 'flex'}; flex-direction:column; gap:2px; background:rgba(255,255,255,0.02); padding:0.4rem; border-radius:6px; border:1px solid rgba(255,255,255,0.03); cursor:pointer; margin-bottom: 0.4rem;" onclick="editTask('${t.refPath}')">
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                            <span style="font-weight:600; color:var(--text-primary);">${t.text}</span>
                            <span style="font-size:0.65rem; color:${badgeColor}; font-weight:700; text-transform:uppercase;">${priorityLabel}</span>
                        </div>
                        ${t.subtitle ? `<span style="font-size:0.72rem; color:var(--text-secondary);">${t.subtitle}</span>` : ''}
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
