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
const tabDay = document.getElementById('tab-day');
const tabKanban = document.getElementById('tab-kanban');
const viewDay = document.getElementById('view-day');
const viewKanban = document.getElementById('view-kanban');
const viewBrand = document.getElementById('view-brand');

// Elementos da DOM - Tarefas e Header
const currentDayTitleEl = document.getElementById('current-day-title');
const currentDaySubtitleEl = document.getElementById('current-day-subtitle');
const deleteDayBtn = document.getElementById('delete-day-btn');
const tasksListEl = document.getElementById('tasks-list');
const openTaskModalBtn = document.getElementById('open-task-modal-btn');
const connectionStatusEl = document.getElementById('connection-status');
const settingsBtn = document.getElementById('settings-btn');
const kanbanBoard = document.getElementById('kanban-board');

// Elementos da DOM - Modais
const taskModal = document.getElementById('task-modal');
const settingsModal = document.getElementById('settings-modal');

const taskTitleInput = document.getElementById('task-title');
const taskDateInput = document.getElementById('task-date');
const taskPriorityInput = document.getElementById('task-priority');
const taskBrandSelect = document.getElementById('task-brand');
const taskAssigneesContainer = document.getElementById('task-assignees');
const taskCommentsInput = document.getElementById('task-comments');

// Inicialização
async function init() {
    updateConnectionStatus();
    
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
    
    settingsBtn.addEventListener('click', openSettingsModal);
    document.getElementById('close-settings-modal-btn').addEventListener('click', closeSettingsModal);
    document.getElementById('close-settings-footer-btn').addEventListener('click', closeSettingsModal);

    // Settings Add Buttons
    document.getElementById('add-brand-btn').addEventListener('click', addBrand);
    document.getElementById('add-assignee-btn').addEventListener('click', addAssignee);

    if (isFirebaseConnected) {
        await initializeDefaultSettings();
        setupGlobalListeners();
    }
    
    selectDate(formatDate(new Date()));
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
    tabDay.classList.remove('active');
    tabKanban.classList.remove('active');
    
    const navDayBtn = document.getElementById('nav-day-btn');
    const navBrandsBtn = document.getElementById('nav-brands-btn');
    if(navDayBtn) navDayBtn.classList.remove('active');
    if(navBrandsBtn) navBrandsBtn.classList.remove('active');
    
    viewDay.classList.remove('active');
    viewKanban.classList.remove('active');
    viewBrand.classList.remove('active');
    
    // Remover a classe active de todas as marcas do sidebar
    document.querySelectorAll('.sidebar-brand-item').forEach(el => el.classList.remove('active'));

    if(tab === 'day') {
        tabDay.classList.add('active');
        if(navDayBtn) navDayBtn.classList.add('active');
        viewDay.classList.add('active');
        currentViewBrand = null;
    } else if (tab === 'kanban') {
        tabKanban.classList.add('active');
        if(navBrandsBtn) navBrandsBtn.classList.add('active');
        viewKanban.classList.add('active');
        currentViewBrand = null;
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
    
    const assigneesSnap = await window.db.collection('settings').doc('assignees').get();
    if (!assigneesSnap.exists) {
        const defaultAssignees = ["Felipe", "Giovanni", "Kim"].sort();
        await window.db.collection('settings').doc('assignees').set({ list: defaultAssignees });
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
            if(currentViewBrand) renderBrandTasks();
        }
    });

    window.db.collection('settings').doc('assignees').onSnapshot((doc) => {
        if(doc.exists) {
            assignees = doc.data().list.sort();
            renderSettingsAssignees();
        }
    });

    window.db.collectionGroup('tasks').onSnapshot((snapshot) => {
        const allTasks = [];
        snapshot.forEach(doc => {
            const pathSegments = doc.ref.path.split('/');
            const dayId = pathSegments[1];
            allTasks.push({ id: doc.id, dayId: dayId, refPath: doc.ref.path, ...doc.data() });
        });
        window.allGlobalTasks = allTasks;
        renderKanban();
        renderCalendar(); // Re-renderiza para atualizar os ícones de prazos
        if(currentViewBrand) {
            renderBrandCalendar(); // Atualiza o calendário da marca (concluídas, riscadas, etc.)
            renderBrandTasks();    // Atualiza a lista de tarefas do dia selecionado
        }
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

function renderSettingsAssignees() {
    const listEl = document.getElementById('settings-assignees-list');
    listEl.innerHTML = '';
    assignees.forEach(a => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${a}</span> <button class="btn-delete-item" onclick="deleteAssignee('${a}')"><i class='bx bx-trash'></i></button>`;
        listEl.appendChild(li);
    });

    // Atualizar dropdowns de filtro global
    document.querySelectorAll('.assignee-filter-select').forEach(select => {
        const currentVal = select.value;
        select.innerHTML = '<option value="Todos">Todos os responsáveis</option>';
        assignees.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a;
            opt.textContent = a;
            select.appendChild(opt);
        });
        select.value = currentVal;
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

window.deleteBrand = async function(val) {
    brands = brands.filter(b => b !== val);
    await window.db.collection('settings').doc('brands').set({ list: brands });
    if(currentViewBrand === val) {
        switchTab('day'); // reset se deletar a marca atual
    }
}

async function addAssignee() {
    const input = document.getElementById('new-assignee-input');
    const val = input.value.trim();
    if(val && !assignees.includes(val)) {
        assignees.push(val);
        await window.db.collection('settings').doc('assignees').set({ list: assignees.sort() });
        input.value = '';
    }
}

window.deleteAssignee = async function(val) {
    assignees = assignees.filter(a => a !== val);
    await window.db.collection('settings').doc('assignees').set({ list: assignees });
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

    taskAssigneesContainer.innerHTML = '';
    assignees.forEach(a => {
        const id = `assignee-${a.replace(/\s+/g, '-')}`;
        const lbl = document.createElement('label');
        lbl.className = 'checkbox-label';
        lbl.innerHTML = `<input type="checkbox" value="${a}" id="${id}"> ${a}`;
        taskAssigneesContainer.appendChild(lbl);
    });
}

function openTaskModal(taskData = null, refPath = null) {
    if(!activeDateStr && !taskData) return;
    populateTaskFormOptions();
    
    const completionSection = document.getElementById('task-completion-section');
    const toggleBtn = document.getElementById('task-toggle-complete-btn');
    const toggleLabel = document.getElementById('task-toggle-complete-label');
    const completedAtLabel = document.getElementById('task-completed-at-label');
    const feedbackInput = document.getElementById('task-completion-feedback');

    if (taskData) {
        editingTaskRefPath = refPath;
        document.querySelector('#task-modal h2').textContent = "Editar Tarefa";
        document.getElementById('delete-task-modal-btn').style.display = 'flex';
        
        taskTitleInput.value = taskData.text || '';
        document.getElementById('task-subtitle').value = taskData.subtitle || '';
        taskDateInput.value = taskData.deadline || '';
        taskPriorityInput.value = taskData.priority || 'medium';
        taskBrandSelect.value = taskData.brand && taskData.brand !== "Sem Marca" ? taskData.brand : '';
        taskCommentsInput.value = taskData.comments || '';
        const rec = document.getElementById('task-recurrence');
        if(rec) { rec.value = 'none'; rec.disabled = true; } // Desabilita edição de recorrência para não duplicar na edição

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
        taskDateInput.value = ''; 
        taskPriorityInput.value = 'medium';
        taskCommentsInput.value = '';
        feedbackInput.value = '';
        const rec = document.getElementById('task-recurrence');
        if(rec) { rec.value = 'none'; rec.disabled = false; }
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

async function saveTask() {
    const title = taskTitleInput.value.trim();
    if(!title) {
        alert("O título da tarefa é obrigatório!");
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

    if (editingTaskRefPath) {
        const doc = await window.db.doc(editingTaskRefPath).get();
        const oldData = doc.data();

        // 1. Atualizar apenas os metadados dessa tarefa atual (o titulo etc)
        await window.db.doc(editingTaskRefPath).update({
            text: title,
            subtitle: document.getElementById('task-subtitle').value.trim(),
            priority: taskPriorityInput.value,
            brand: taskBrandSelect.value || "Sem Marca",
            assignees: selectedAssignees,
            comments: taskCommentsInput.value.trim(),
            deadline: taskDateInput.value,
            recurrenceRule: recurrence,
            recurrenceDays: selectedDays
        });

        // 2. Apagar tarefas pendentes futuras dessa mesma série
        if (oldData.seriesId) {
            const futureTasks = window.allGlobalTasks.filter(t => 
                t.seriesId === oldData.seriesId && 
                t.status === 'pending' && 
                t.dayId > activeDateStr // Só apaga as que vêm DEPOIS desta
            );
            
            for (const ft of futureTasks) {
                await window.db.doc(ft.refPath).delete();
            }
        }
        
        // 3. Gerar as novas futuras baseadas na regra (pulando o dia atual)
        if (recurrence !== 'none') {
            await generateRecurringTasks(
                activeDateStr, 
                recurrence, 
                selectedDays, 
                oldData.seriesId || ('series_' + Date.now()), 
                title, 
                document.getElementById('task-subtitle').value.trim(),
                taskPriorityInput.value,
                taskBrandSelect.value || "Sem Marca",
                selectedAssignees,
                taskCommentsInput.value.trim(),
                taskDateInput.value,
                true // isEditing = true (pula o próprio activeDateStr)
            );
        }

    } else {
        const seriesId = 'series_' + Date.now();
        await generateRecurringTasks(
            activeDateStr, 
            recurrence, 
            selectedDays, 
            seriesId, 
            title, 
            document.getElementById('task-subtitle').value.trim(),
            taskPriorityInput.value,
            taskBrandSelect.value || "Sem Marca",
            selectedAssignees,
            taskCommentsInput.value.trim(),
            taskDateInput.value,
            false
        );
    }

    closeTaskModal();
}

async function generateRecurringTasks(baseDateStr, recurrence, selectedDays, seriesId, text, subtitle, priority, brand, assignees, comments, deadline, skipFirst = false) {
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

    for (const dateStr of datesToCreate) {
        const newTask = {
            text, subtitle, status: 'pending', priority, brand, assignees, comments, 
            deadline, createdAt: new Date().getTime(),
            recurrenceRule: recurrence, recurrenceDays: selectedDays, seriesId
        };
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
    renderBrandCalendar();
    renderBrandTasks();
}

function renderBrandTasks() {
    const listEl = document.getElementById('brand-tasks-list');
    listEl.innerHTML = '';
    
    if(!window.allGlobalTasks) return;
    
    const brandTasks = window.allGlobalTasks.filter(t => {
        if(t.brand !== currentViewBrand) return false;
        if(t.dayId !== brandActiveDateStr && t.deadline !== brandActiveDateStr) return false;
        if(!showCompleted && t.status === 'completed') return false;
        if(currentAssigneeFilter !== "Todos" && (!t.assignees || !t.assignees.includes(currentAssigneeFilter))) return false;
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
    
    document.getElementById('brand-tasks-list-title').innerHTML = `<i class='bx bx-list-ul'></i> Anotações para ${formatDateBR(brandActiveDateStr)}`;

    if(brandTasks.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state" style="padding: 2rem 1rem; min-height: auto;">
                <i class='bx bx-check-double'></i>
                <p>Nenhuma anotação para esta marca no dia selecionado.</p>
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

    currentDayTitleEl.textContent = `${d} de ${monthNames[parseInt(m) - 1]} de ${y}`;
    currentDaySubtitleEl.textContent = getFriendlyDateString(dateStr);
    
    openTaskModalBtn.disabled = false;
    deleteDayBtn.style.display = 'block';

    listenToActiveDateTasks(dateStr);
}

function listenToActiveDateTasks(dateStr) {
    if (unsubscribeDayTasks) unsubscribeDayTasks();
    if (!isFirebaseConnected) return;

    unsubscribeDayTasks = window.db.collection(`days/${dateStr}/tasks`)
        .orderBy("createdAt")
        .onSnapshot((snapshot) => {
            localTasks = [];
            snapshot.forEach((doc) => {
                localTasks.push({ 
                    id: doc.id, 
                    refPath: `days/${dateStr}/tasks/${doc.id}`,
                    ...doc.data() 
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

    const currentDayTasks = [...localTasks];
    
    const deadlineTasks = [];
    if(window.allGlobalTasks) {
        window.allGlobalTasks.forEach(t => {
            if(t.deadline === activeDateStr && t.dayId !== activeDateStr && t.status === 'pending') {
                deadlineTasks.push(t);
            }
        });
    }

    if (currentDayTasks.length === 0 && deadlineTasks.length === 0) {
        tasksListEl.innerHTML = `
            <div class="empty-state">
                <i class='bx bx-check-double'></i>
                <p>Nenhuma anotação ou prazo para este dia.</p>
            </div>
        `;
        return;
    }

    if (deadlineTasks.length > 0) {
        const h = document.createElement('h3');
        h.style.cssText = "font-size: 0.9rem; color: var(--warning-color); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;";
        h.innerHTML = "<i class='bx bxs-bell-ring'></i> Prazos Vencendo Hoje";
        tasksListEl.appendChild(h);
        
        deadlineTasks.forEach(task => {
            tasksListEl.appendChild(createTaskDOM(task, task.dayId, false));
        });
    }

    if (currentDayTasks.length > 0) {
        const h = document.createElement('h3');
        h.style.cssText = "font-size: 0.9rem; color: var(--text-secondary); margin-top: 1.5rem; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;";
        h.innerHTML = "<i class='bx bx-calendar-star'></i> Tarefas Criadas Neste Dia";
        tasksListEl.appendChild(h);
        
        currentDayTasks.forEach(task => {
            tasksListEl.appendChild(createTaskDOM(task, activeDateStr, false));
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
        if (t.seriesId && t.status === 'pending') {
            return pendingSeriesMap[t.seriesId].id === t.id;
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

    const orderedKeys = [...brands, "Sem Marca"];
    
    orderedKeys.forEach(brand => {
        const columnTasks = grouped[brand];
        if(brand === "Sem Marca" && columnTasks.length === 0) return;

        // Contagem APENAS das tarefas pendentes, independentemente de estarem sendo exibidas ou não
        let countTasks = columnTasks.filter(t => t.status !== 'completed');
        if (currentAssigneeFilter !== "Todos") {
            countTasks = countTasks.filter(t => t.assignees && t.assignees.includes(currentAssigneeFilter));
        }
        const pendingCount = countTasks.length;

        let displayTasks = columnTasks;
        if (currentAssigneeFilter !== "Todos") {
            displayTasks = displayTasks.filter(t => t.assignees && t.assignees.includes(currentAssigneeFilter));
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
            <div class="kanban-col-footer">
                <button class="kanban-add-task-btn" onclick="openTaskModalForBrand('${brand}')"><i class='bx bx-plus'></i> Nova Tarefa</button>
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
        assigneesHtml = `<div class="task-assignees"><i class='bx bx-user'></i> ${task.assignees.join(', ')}</div>`;
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

window.deleteDay = async function() {
    if(!activeDateStr) return;
    if(confirm(`ATENÇÃO: Tem certeza que deseja excluir TODAS as tarefas de ${activeDateStr}?`)) {
        const tasksSnapshot = await window.db.collection(`days/${activeDateStr}/tasks`).get();
        const batch = window.db.batch();
        tasksSnapshot.forEach(doc => batch.delete(doc.ref));
        batch.delete(window.db.doc(`days/${activeDateStr}`));
        await batch.commit();
    }
}

// Start
init();
