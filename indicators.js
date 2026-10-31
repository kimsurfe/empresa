// indicators.js - Dashboard de Indicadores Comerciais (Power BI Style)
// Sistema KR Gestão de Marcas

(function() {
    'use strict';

    let billingMasterData = [];
    let billingFilteredData = [];
    let activeBrand = 'NEW ERA';
    let availableYears = [];
    let rankingDisplayLimit = 10;
    let currentKpiDisplayMode = localStorage.getItem('empresa_indicators_kpi_mode') || 'both';
    if (!['both', 'values', 'pieces'].includes(currentKpiDisplayMode)) {
        currentKpiDisplayMode = 'both';
    }

    window.onKpiDisplayModeChange = function(mode) {
        if (!['both', 'values', 'pieces'].includes(mode)) mode = 'both';
        currentKpiDisplayMode = mode;
        try {
            localStorage.setItem('empresa_indicators_kpi_mode', mode);
        } catch (e) {
            console.warn('Erro ao salvar empresa_indicators_kpi_mode:', e);
        }

        // Sincronizar select no filtro
        const sel = document.getElementById('filter-ind-kpi-mode');
        if (sel && sel.value !== mode) sel.value = mode;

        // Sincronizar botões rápidos de alternância
        document.querySelectorAll('.btn-kpi-mode').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Re-renderizar se houver dados filtrados
        if (billingFilteredData && billingFilteredData.length > 0) {
            const clientsMap = buildClientsMap();
            const metricSelect = document.getElementById('filter-ind-metric');
            const metricVal = metricSelect ? metricSelect.value : 'gross';
            updateKpiCards(billingFilteredData, clientsMap, metricVal);
            renderRankings(billingFilteredData, clientsMap);
            renderCharts(billingFilteredData, clientsMap);
        }
    };

    let latestReportDate = '31/10/2026';

    function computeLatestReportDate() {
        if (window.BILLING_LAST_UPDATED) {
            latestReportDate = window.BILLING_LAST_UPDATED;
            return;
        }
        let maxDate = null;
        let maxStr = '31/10/2026';
        if (billingMasterData && billingMasterData.length > 0) {
            billingMasterData.forEach(item => {
                if (item.d) {
                    const dObj = parseDateBR(item.d);
                    if (dObj && (!maxDate || dObj > maxDate)) {
                        maxDate = dObj;
                        maxStr = item.d.split(' ')[0];
                    }
                }
            });
        }
        latestReportDate = maxStr;
    }

    window.setRankingLimit = function(limit) {
        rankingDisplayLimit = (limit === 'all') ? 'all' : parseInt(limit, 10);
        const sel1 = document.getElementById('ranking-limit-select');
        const sel2 = document.getElementById('ranking-limit-select-products');
        if (sel1) sel1.value = limit;
        if (sel2) sel2.value = limit;
        if (billingFilteredData) {
            const clientsMap = buildClientsMap();
            renderRankings(billingFilteredData, clientsMap);
        }
    };

    // Instâncias de gráficos Chart.js
    let chartDailyInstance = null;
    let chartMonthlyInstance = null;
    let chartGroupInstance = null;
    let chartComparisonInstance = null;
    let currentComparisonMetric = 'monthly';

    // Utilitário de formatação de moeda brasileira R$
    const currencyFormatter = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const numberFormatter = new Intl.NumberFormat('pt-BR');

    window.formatBRL = function(val) {
        return currencyFormatter.format(val || 0);
    };

    function cleanDigits(str) {
        if (!str) return '';
        return str.toString().replace(/\D/g, '');
    }

    function parseDateBR(str) {
        if (!str) return null;
        // Espera DD/MM/AAAA ou DD/MM/AAAA HH:MM:SS
        const parts = str.split(' ')[0].split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            return new Date(year, month, day);
        }
        return null;
    }

    function formatDateISO(d) {
        if (!d || isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function getDefaultPeriod() {
        const now = new Date();
        const curYear = now.getFullYear().toString();
        const curSemester = now.getMonth() < 6 ? '1' : '2';
        const start = curSemester === '1' ? `${curYear}-01-01` : `${curYear}-07-01`;
        const end = curSemester === '1' ? `${curYear}-06-30` : `${curYear}-12-31`;
        return { curYear, curSemester, start, end };
    }

    // Inicialização do Módulo de Indicadores
    window.initIndicatorsModule = function() {
        const CURRENT_BILLING_VERSION = '20261031_cnpj_v3';
        const savedVersion = localStorage.getItem('empresa_billing_version');
        if (savedVersion !== CURRENT_BILLING_VERSION) {
            localStorage.removeItem('empresa_billing_new_era_custom');
            localStorage.setItem('empresa_billing_version', CURRENT_BILLING_VERSION);
        }

        try {
            const savedCustom = localStorage.getItem('empresa_billing_new_era_custom');
            if (savedCustom) {
                const parsed = JSON.parse(savedCustom);
                if (Array.isArray(parsed) && parsed.length >= 30000) {
                    billingMasterData = parsed;
                } else if (window.INITIAL_BILLING_NEW_ERA && Array.isArray(window.INITIAL_BILLING_NEW_ERA)) {
                    billingMasterData = [...window.INITIAL_BILLING_NEW_ERA];
                    localStorage.removeItem('empresa_billing_new_era_custom');
                } else {
                    billingMasterData = parsed;
                }
            } else if (window.INITIAL_BILLING_NEW_ERA && Array.isArray(window.INITIAL_BILLING_NEW_ERA)) {
                billingMasterData = [...window.INITIAL_BILLING_NEW_ERA];
            } else {
                billingMasterData = [];
            }
        } catch (e) {
            console.error('Erro ao carregar dados de faturamento:', e);
            billingMasterData = window.INITIAL_BILLING_NEW_ERA || [];
        }

        computeLatestReportDate();

        const def = getDefaultPeriod();
        const startInput = document.getElementById('filter-ind-start-date');
        const endInput = document.getElementById('filter-ind-end-date');
        if (startInput) startInput.value = def.start;
        if (endInput) endInput.value = def.end;

        populateAllIndCMS(true);

        // Sincronizar configuração de exibição dos KPIs (Valores / Peças / Os Dois)
        const kpiModeSelect = document.getElementById('filter-ind-kpi-mode');
        if (kpiModeSelect) kpiModeSelect.value = currentKpiDisplayMode;
        document.querySelectorAll('.btn-kpi-mode').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === currentKpiDisplayMode);
        });

        // Ouvinte do Firestore para sincronização em nuvem
        if (window.db) {
            window.db.collection('settings').doc('billing_new_era').onSnapshot((doc) => {
                if (doc.exists && doc.data().list && Array.isArray(doc.data().list)) {
                    const remote = doc.data().list;
                    if (remote.length > 0) {
                        billingMasterData = remote;
                        localStorage.setItem('empresa_billing_new_era_custom', JSON.stringify(billingMasterData));
                        populateAllIndCMS(false);
                        if (sessionStorage.getItem('last_active_tab') === 'indicators') {
                            applyIndicatorsFilter();
                        }
                    }
                }
            });
        }
    };

    // -------------------------------------------------------------
    // CONTROLES DE MULTI-SELECT (POWER BI STYLE)
    // -------------------------------------------------------------
    window.toggleIndCMS = function(containerId, event) {
        if (event) event.stopPropagation();
        const container = document.getElementById(containerId);
        if (!container) return;
        const dropdown = container.querySelector('.ind-cms-dropdown');
        if (!dropdown) return;

        const isHidden = dropdown.classList.contains('hidden');
        window.closeAllIndCMS();
        if (isHidden) {
            container.classList.add('active');
            dropdown.classList.remove('hidden');
            const searchInput = dropdown.querySelector('.ind-cms-search-input');
            if (searchInput) {
                searchInput.value = '';
                const dim = containerId.replace('ind-cms-', '');
                window.filterIndCMSOptions(dim, '');
                setTimeout(() => searchInput.focus(), 60);
            }
        }
    };

    window.closeAllIndCMS = function() {
        document.querySelectorAll('.ind-cms').forEach(c => {
            c.classList.remove('active');
        });
        document.querySelectorAll('.ind-cms-dropdown').forEach(d => {
            d.classList.add('hidden');
        });
    };

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.ind-cms')) {
            window.closeAllIndCMS();
        }
    });

    window.filterIndCMSOptions = function(dim, query) {
        const list = document.getElementById(`ind-cms-${dim}-list`);
        if (!list) return;
        const q = (query || '').toLowerCase().trim();
        const options = list.querySelectorAll('.ind-cms-option');
        options.forEach(opt => {
            const text = opt.textContent.toLowerCase();
            if (!q || text.includes(q)) {
                opt.style.display = 'flex';
            } else {
                opt.style.display = 'none';
            }
        });
    };

    function syncDatesWithSelectedYears() {
        const selectedYears = getIndCMSSelectedValues('year');
        const startInput = document.getElementById('filter-ind-start-date');
        const endInput = document.getElementById('filter-ind-end-date');
        if (!startInput || !endInput) return;

        if (selectedYears.length > 1) {
            const yearNums = selectedYears.map(y => parseInt(y, 10)).filter(n => !isNaN(n));
            if (yearNums.length > 0) {
                const minYear = Math.min(...yearNums);
                const maxYear = Math.max(...yearNums);
                startInput.value = `${minYear}-01-01`;
                endInput.value = `${maxYear}-12-31`;
            }
        } else if (selectedYears.length === 1) {
            const singleYear = parseInt(selectedYears[0], 10);
            if (!isNaN(singleYear)) {
                const selectedSemesters = getIndCMSSelectedValues('semester');
                let startMonthDay = '01-01';
                let endMonthDay = '12-31';
                if (selectedSemesters.length === 1) {
                    if (selectedSemesters[0] === '1') {
                        startMonthDay = '01-01';
                        endMonthDay = '06-30';
                    } else if (selectedSemesters[0] === '2') {
                        startMonthDay = '07-01';
                        endMonthDay = '12-31';
                    }
                }
                startInput.value = `${singleYear}-${startMonthDay}`;
                endInput.value = `${singleYear}-${endMonthDay}`;
            }
        }
    }

    window.indCMSSelectAll = function(dim, selectAll) {
        const list = document.getElementById(`ind-cms-${dim}-list`);
        if (!list) return;
        const checkboxes = list.querySelectorAll('input[type="checkbox"]:not(:disabled)');
        checkboxes.forEach(cb => {
            cb.checked = selectAll;
        });
        updateIndCMSLabel(dim);
        if (dim === 'year') {
            syncDatesWithSelectedYears();
        }
        applyIndicatorsFilter();
    };

    window.onIndCMSCheckboxChange = function(dim) {
        updateIndCMSLabel(dim);
        if (dim === 'year') {
            syncDatesWithSelectedYears();
        }
        applyIndicatorsFilter();
    };

    function getIndCMSSelectedValues(dim) {
        const list = document.getElementById(`ind-cms-${dim}-list`);
        if (!list) return [];
        const checkboxes = list.querySelectorAll('input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    function updateIndCMSLabel(dim) {
        const labelEl = document.getElementById(`ind-cms-${dim}-label`);
        const list = document.getElementById(`ind-cms-${dim}-list`);
        if (!labelEl || !list) return;

        const allCheckboxes = list.querySelectorAll('input[type="checkbox"]:not(:disabled)');
        const checkedCheckboxes = list.querySelectorAll('input[type="checkbox"]:checked');
        const count = checkedCheckboxes.length;
        const total = allCheckboxes.length;

        const defaultLabels = {
            'brand': 'Todas as Marcas',
            'year': 'Todos os Anos',
            'semester': 'Todos os Semestres',
            'client': 'Todos os Clientes',
            'group': 'Todos os Grupos',
            'group-real': 'Todos os Grupos Reais',
            'class': 'Todas as Divisões',
            'nf': 'Todas as NFs'
        };

        if (count === 0 || count === total) {
            labelEl.textContent = defaultLabels[dim] || 'Todos';
        } else if (count === 1) {
            const span = checkedCheckboxes[0].closest('label').querySelector('.ind-cms-option-label') || checkedCheckboxes[0].closest('label');
            labelEl.textContent = span.textContent.trim();
        } else if (count === 2) {
            const span1 = checkedCheckboxes[0].closest('label').querySelector('.ind-cms-option-label') || checkedCheckboxes[0].closest('label');
            const span2 = checkedCheckboxes[1].closest('label').querySelector('.ind-cms-option-label') || checkedCheckboxes[1].closest('label');
            labelEl.textContent = `${span1.textContent.trim()}, ${span2.textContent.trim()}`;
        } else {
            labelEl.innerHTML = `${defaultLabels[dim] || 'Filtro'} <span class="ind-cms-badge">${count}</span>`;
        }
    }

    // Retorna a junção de Razão Social e Nome Fantasia da base central da empresa
    function getClientCombinedName(item, clientsMap) {
        const clientMatch = resolveClientForItem(item, clientsMap);
        let fantasia = '';
        let razao = '';

        if (clientMatch) {
            fantasia = (clientMatch['FANTASIA'] || clientMatch['NOME FANTASIA'] || '').toString().trim();
            razao = (clientMatch['RAZAO SOCIAL'] || clientMatch['RAZÃO SOCIAL'] || '').toString().trim();
        }

        if (!fantasia && item.f) fantasia = item.f.trim();
        if (!razao && item.z) razao = item.z.trim();

        if (fantasia && razao && fantasia.toUpperCase() !== razao.toUpperCase()) {
            return `${fantasia} - ${razao}`;
        }
        return fantasia || razao || 'Cliente sem cadastro';
    }

    // Popula todas as listas de seleção múltipla
    function populateAllIndCMS(isInitial = false) {
        const def = getDefaultPeriod();
        const clientsMap = buildClientsMap();

        // 1. ANOS
        const yearList = document.getElementById('ind-cms-year-list');
        if (yearList) {
            const yearsSet = new Set();
            billingMasterData.forEach(item => {
                if (item.a) {
                    yearsSet.add(item.a.toString());
                } else if (item.d) {
                    const parts = item.d.split('/');
                    if (parts.length === 3) yearsSet.add(parts[2]);
                }
            });
            availableYears = Array.from(yearsSet).sort().reverse();
            let yearHtml = '';
            availableYears.forEach(y => {
                const isChecked = isInitial ? (y === def.curYear) : false;
                yearHtml += `
                    <label class="ind-cms-option">
                        <input type="checkbox" value="${y}" ${isChecked ? 'checked' : ''} onchange="onIndCMSCheckboxChange('year')">
                        <span class="ind-cms-option-label">${y}</span>
                    </label>
                `;
            });
            yearList.innerHTML = yearHtml;
            updateIndCMSLabel('year');
        }

        // 2. SEMESTRES
        updateIndCMSLabel('semester');

        // 3. MARCAS
        updateIndCMSLabel('brand');

        // 4. CLIENTES (Junção Fantasia - Razão Social)
        const clientList = document.getElementById('ind-cms-client-list');
        if (clientList) {
            const clientsSet = new Set();
            const baseClients = getActiveClientsList();

            baseClients.forEach(c => {
                const fant = (c['FANTASIA'] || c['NOME FANTASIA'] || '').toString().trim();
                const raz = (c['RAZAO SOCIAL'] || c['RAZÃO SOCIAL'] || '').toString().trim();
                if (fant && raz && fant.toUpperCase() !== raz.toUpperCase()) {
                    clientsSet.add(`${fant} - ${raz}`);
                } else if (fant || raz) {
                    clientsSet.add(fant || raz);
                }
            });

            billingMasterData.forEach(item => {
                const comb = getClientCombinedName(item, clientsMap);
                if (comb && comb !== 'Cliente sem cadastro') {
                    clientsSet.add(comb);
                }
            });

            const sortedClients = Array.from(clientsSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
            let clientHtml = '';
            sortedClients.forEach(c => {
                clientHtml += `
                    <label class="ind-cms-option" title="${escapeHTML(c)}">
                        <input type="checkbox" value="${escapeHTML(c)}" onchange="onIndCMSCheckboxChange('client')">
                        <span class="ind-cms-option-label">${escapeHTML(c)}</span>
                    </label>
                `;
            });
            clientList.innerHTML = clientHtml;
            updateIndCMSLabel('client');
        }

        // 5. GRUPO
        const groupList = document.getElementById('ind-cms-group-list');
        if (groupList) {
            const groupsSet = new Set();
            billingMasterData.forEach(item => {
                const clientMatch = resolveClientForItem(item, clientsMap);
                const g = (clientMatch && clientMatch['GRUPO']) ? clientMatch['GRUPO'].trim() : (item.g || item.r || '');
                if (g && g !== '-' && g !== 'None') groupsSet.add(g);
            });
            const sortedGroups = Array.from(groupsSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
            let groupHtml = '';
            sortedGroups.forEach(g => {
                groupHtml += `
                    <label class="ind-cms-option" title="${escapeHTML(g)}">
                        <input type="checkbox" value="${escapeHTML(g)}" onchange="onIndCMSCheckboxChange('group')">
                        <span class="ind-cms-option-label">${escapeHTML(g)}</span>
                    </label>
                `;
            });
            groupList.innerHTML = groupHtml;
            updateIndCMSLabel('group');
        }

        // 6. GRUPO REAL
        const groupRealList = document.getElementById('ind-cms-group-real-list');
        if (groupRealList) {
            const groupRealsSet = new Set();
            billingMasterData.forEach(item => {
                const clientMatch = resolveClientForItem(item, clientsMap);
                const gr = (clientMatch && (clientMatch['GRUPO REAL'] || clientMatch['GRUPO'])) 
                    ? (clientMatch['GRUPO REAL'] || clientMatch['GRUPO']).trim() 
                    : (item.gr || item.g || item.r || '');
                if (gr && gr !== '-' && gr !== 'None') groupRealsSet.add(gr);
            });
            const sortedGroupReals = Array.from(groupRealsSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
            let groupRealHtml = '';
            sortedGroupReals.forEach(gr => {
                groupRealHtml += `
                    <label class="ind-cms-option" title="${escapeHTML(gr)}">
                        <input type="checkbox" value="${escapeHTML(gr)}" onchange="onIndCMSCheckboxChange('group-real')">
                        <span class="ind-cms-option-label">${escapeHTML(gr)}</span>
                    </label>
                `;
            });
            groupRealList.innerHTML = groupRealHtml;
            updateIndCMSLabel('group-real');
        }

        // 7. DIVISÃO / CLASSE
        const classList = document.getElementById('ind-cms-class-list');
        if (classList) {
            const classesSet = new Set();
            billingMasterData.forEach(item => {
                if (item.cl && item.cl.trim() && item.cl !== '-' && item.cl !== 'None') {
                    classesSet.add(item.cl.trim());
                }
            });
            const sortedClasses = Array.from(classesSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
            let classHtml = '';
            sortedClasses.forEach(c => {
                classHtml += `
                    <label class="ind-cms-option" title="${escapeHTML(c)}">
                        <input type="checkbox" value="${escapeHTML(c)}" onchange="onIndCMSCheckboxChange('class')">
                        <span class="ind-cms-option-label">${escapeHTML(c)}</span>
                    </label>
                `;
            });
            classList.innerHTML = classHtml;
            updateIndCMSLabel('class');
        }

        // 8. NOTA FISCAL
        const nfList = document.getElementById('ind-cms-nf-list');
        if (nfList) {
            const nfsSet = new Set();
            billingMasterData.forEach(item => {
                if (item.nf && item.nf.trim()) {
                    nfsSet.add(item.nf.trim());
                }
            });
            const sortedNfs = Array.from(nfsSet).sort((a, b) => b.localeCompare(a));
            let nfHtml = '';
            sortedNfs.forEach(nf => {
                nfHtml += `
                    <label class="ind-cms-option font-mono" title="NF ${escapeHTML(nf)}">
                        <input type="checkbox" value="${escapeHTML(nf)}" onchange="onIndCMSCheckboxChange('nf')">
                        <span class="ind-cms-option-label">NF ${escapeHTML(nf)}</span>
                    </label>
                `;
            });
            nfList.innerHTML = nfHtml;
            updateIndCMSLabel('nf');
        }
    }

    // Chamado ao abrir a aba Indicadores
    window.renderIndicatorsView = function() {
        if (!billingMasterData || billingMasterData.length === 0) {
            window.initIndicatorsModule();
        }
        applyIndicatorsFilter();
    };

    // Mudança de Data Personalizada
    window.onIndicatorsCustomDateChange = function() {
        applyIndicatorsFilter();
    };

    // Limpar filtros (restaura para o padrão)
    window.clearIndicatorsFilter = function() {
        const metricSelect = document.getElementById('filter-ind-metric');
        const startInput = document.getElementById('filter-ind-start-date');
        const endInput = document.getElementById('filter-ind-end-date');
        const def = getDefaultPeriod();

        if (metricSelect) metricSelect.value = 'gross';
        if (startInput) startInput.value = def.start;
        if (endInput) endInput.value = def.end;

        // Reset Marca: NEW ERA checked
        const brandList = document.getElementById('ind-cms-brand-list');
        if (brandList) {
            brandList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = (cb.value === 'NEW ERA');
            });
            updateIndCMSLabel('brand');
        }

        // Reset Ano: curYear checked
        const yearList = document.getElementById('ind-cms-year-list');
        if (yearList) {
            yearList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = (cb.value === def.curYear);
            });
            updateIndCMSLabel('year');
        }

        // Reset Semestre: curSemester checked
        const semList = document.getElementById('ind-cms-semester-list');
        if (semList) {
            semList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = (cb.value === def.curSemester);
            });
            updateIndCMSLabel('semester');
        }

        // Reset demais multi-selects para todos desmarcados (significa TODOS)
        ['client', 'group', 'group-real', 'class', 'nf'].forEach(dim => {
            const list = document.getElementById(`ind-cms-${dim}-list`);
            if (list) {
                list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = false;
                });
                updateIndCMSLabel(dim);
            }
        });

        applyIndicatorsFilter();
    };

    // Obtém a lista atualizada de clientes (window -> localStorage -> INITIAL_CLIENTS_DATA)
    function getActiveClientsList() {
        if (window.clientsMasterData && Array.isArray(window.clientsMasterData) && window.clientsMasterData.length > 0) {
            return window.clientsMasterData;
        }
        try {
            const saved = localStorage.getItem('empresa_clients_custom_data');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    window.clientsMasterData = parsed;
                    return parsed;
                }
            }
        } catch (e) {
            console.error('Erro ao ler clientes do localStorage no módulo de indicadores:', e);
        }
        return window.INITIAL_CLIENTS_DATA || [];
    }

    // Cria mapa de clientes para cruzamento
    function buildClientsMap() {
        const map = new Map();
        const baseClients = getActiveClientsList();

        baseClients.forEach(c => {
            const rawCnpj = (c['CNPJ'] || '').toString();
            const cleanC = cleanDigits(rawCnpj);
            if (cleanC) {
                map.set(cleanC, c);
                map.set(cleanC.padStart(14, '0'), c);
            }
            const neCod = (c['CODIGO NEW ERA'] || '').toString().trim();
            if (neCod && neCod !== '-' && neCod !== 'None') {
                map.set(`NE_${neCod}`, c);
                const cleanNe = cleanDigits(neCod);
                if (cleanNe) map.set(`NE_${cleanNe}`, c);
            }
            const arezzoCod = (c['CODIGO AREZZO'] || '').toString().trim();
            if (arezzoCod && arezzoCod !== '-' && arezzoCod !== 'None') {
                map.set(`AR_${arezzoCod}`, c);
                const cleanAr = cleanDigits(arezzoCod);
                if (cleanAr) map.set(`AR_${cleanAr}`, c);
            }
            const fant = (c['FANTASIA'] || c['NOME FANTASIA'] || '').toString().trim().toUpperCase();
            if (fant) {
                map.set(`FANT_${fant}`, c);
            }
            const razao = (c['RAZAO SOCIAL'] || c['RAZÃO SOCIAL'] || '').toString().trim().toUpperCase();
            if (razao) {
                map.set(`RAZAO_${razao}`, c);
            }
        });
        return map;
    }

    function resolveClientForItem(item, clientsMap) {
        if (!clientsMap) return null;
        if (item.c) {
            const cleanC = cleanDigits(item.c);
            if (cleanC) {
                if (clientsMap.has(cleanC)) return clientsMap.get(cleanC);
                if (clientsMap.has(cleanC.padStart(14, '0'))) return clientsMap.get(cleanC.padStart(14, '0'));
            }
        }
        if (item.cli) {
            const cliStr = item.cli.toString().trim();
            if (clientsMap.has(`NE_${cliStr}`)) return clientsMap.get(`NE_${cliStr}`);
            const cleanCli = cleanDigits(cliStr);
            if (cleanCli && clientsMap.has(`NE_${cleanCli}`)) return clientsMap.get(`NE_${cleanCli}`);
        }
        const fantUpper = (item.f || '').trim().toUpperCase();
        if (fantUpper && clientsMap.has(`FANT_${fantUpper}`)) return clientsMap.get(`FANT_${fantUpper}`);
        const razaoUpper = (item.z || '').trim().toUpperCase();
        if (razaoUpper && clientsMap.has(`RAZAO_${razaoUpper}`)) return clientsMap.get(`RAZAO_${razaoUpper}`);
        return null;
    }

    // Aplicação dos Filtros e Atualização Completa da Tela
    window.applyIndicatorsFilter = function() {
        const selectedBrands = getIndCMSSelectedValues('brand');
        const selectedYears = getIndCMSSelectedValues('year');
        const selectedSemesters = getIndCMSSelectedValues('semester');
        const selectedClients = getIndCMSSelectedValues('client');
        const selectedGroups = getIndCMSSelectedValues('group');
        const selectedGroupReals = getIndCMSSelectedValues('group-real');
        const selectedClasses = getIndCMSSelectedValues('class');
        const selectedNFs = getIndCMSSelectedValues('nf');
        const metricVal = document.getElementById('filter-ind-metric')?.value || 'gross';
        const startDateVal = document.getElementById('filter-ind-start-date')?.value || '';
        const endDateVal = document.getElementById('filter-ind-end-date')?.value || '';

        const startObj = startDateVal ? new Date(`${startDateVal}T00:00:00`) : null;
        const endObj = endDateVal ? new Date(`${endDateVal}T23:59:59`) : null;

        const clientsMap = buildClientsMap();

        billingFilteredData = billingMasterData.filter(item => {
            // Normalizar valor financeiro baseado na métrica (Gross ou Net)
            const itemGross = item.vg !== undefined ? item.vg : (item.v || 0);
            const itemNet = item.vn !== undefined ? item.vn : (item.v || 0);
            item.v = (metricVal === 'net') ? itemNet : itemGross;

            // Data de emissão (venda/faturamento)
            const dObj = parseDateBR(item.d);
            if (dObj) {
                const itemYear = dObj.getFullYear().toString();
                const itemMonth = dObj.getMonth() + 1; // 1 a 12
                const itemSemester = itemMonth <= 6 ? '1' : '2';

                // Filtro por Data Inicial / Final (Período Personalizado)
                if (startObj && dObj < startObj) return false;
                if (endObj && dObj > endObj) return false;

                // Filtro de Anos (Multi-Select)
                if (selectedYears.length > 0 && !selectedYears.includes(itemYear)) {
                    return false;
                }

                // Filtro de Semestres (Multi-Select)
                if (selectedSemesters.length > 0 && !selectedSemesters.includes(itemSemester)) {
                    return false;
                }
            } else if (selectedYears.length > 0 || startDateVal || endDateVal) {
                return false;
            }

            // Filtro Marca (Multi-Select)
            if (selectedBrands.length > 0 && !selectedBrands.includes('NEW ERA')) {
                return false;
            }

            // Identificar cliente para filtros
            const clientMatch = resolveClientForItem(item, clientsMap);
            const itemCombined = getClientCombinedName(item, clientsMap);

            // 1. Filtro Razão Social / Nome Fantasia (Multi-Select)
            if (selectedClients.length > 0 && !selectedClients.includes(itemCombined)) {
                return false;
            }

            // 2. Filtro Grupo (Multi-Select)
            const itemGrupo = (clientMatch && clientMatch['GRUPO']) ? clientMatch['GRUPO'].trim() : (item.g || item.r || 'Outros');
            if (selectedGroups.length > 0 && !selectedGroups.includes(itemGrupo)) {
                return false;
            }

            // 3. Filtro Grupo Real (Multi-Select)
            const itemGrupoReal = (clientMatch && (clientMatch['GRUPO REAL'] || clientMatch['GRUPO'])) 
                ? (clientMatch['GRUPO REAL'] || clientMatch['GRUPO']).trim() 
                : (item.gr || item.g || item.r || 'Outros');
            if (selectedGroupReals.length > 0 && !selectedGroupReals.includes(itemGrupoReal)) {
                return false;
            }

            // 4. Filtro Divisão / Classe (Multi-Select)
            const itemClass = (item.cl || 'Outros').trim();
            if (selectedClasses.length > 0 && !selectedClasses.includes(itemClass)) {
                return false;
            }

            // 5. Filtro Nota Fiscal (Multi-Select)
            const itemNf = (item.nf || '').trim();
            if (selectedNFs.length > 0 && !selectedNFs.includes(itemNf)) {
                return false;
            }

            return true;
        });

        // Atualizar subtítulo com indicação da métrica e data do último relatório atualizado
        const subtitleEl = document.getElementById('indicators-subtitle');
        if (subtitleEl) {
            const metricLabel = metricVal === 'net' ? 'Faturamento Líquido (Net)' : 'Faturamento Bruto (Gross)';
            subtitleEl.textContent = `Análise estratégica de vendas (${metricLabel}) — NEW ERA • Atualizado em: ${latestReportDate}`;
        }

        // Atualizar todas as seções do dashboard
        updateKpiCards(billingFilteredData, clientsMap, metricVal);
        renderCharts(billingFilteredData, clientsMap);
        renderRankings(billingFilteredData, clientsMap);
        renderAuditSection(billingFilteredData, clientsMap);
    };

    // --------------------------------------------------------------------------
    // 1. CARDS DE INDICADORES (KPIS)
    // --------------------------------------------------------------------------
    function updateKpiCards(data, clientsMap, metricVal = 'gross') {
        let totalRevenue = 0;
        let totalPieces = 0;
        let totalOrders = 0;
        const activeClientsSet = new Set();
        const activeGroupsSet = new Set();
        const dailyRevenueMap = {};
        const dailyPiecesMap = {};
        const monthlyRevenueMap = {};
        const monthlyPiecesMap = {};

        data.forEach(item => {
            const v = item.v || 0;
            const q = item.q || 0;
            totalRevenue += v;
            totalPieces += q;
            totalOrders += 1;

            const clientMatch = resolveClientForItem(item, clientsMap);
            const clientKey = item.c || (clientMatch && clientMatch['CNPJ']) || (item.cli ? `CLI_${item.cli}` : item.f);
            if (clientKey) {
                activeClientsSet.add(clientKey);
            }

            // Determinar grupo
            const grupoReal = (clientMatch && (clientMatch['GRUPO REAL'] || clientMatch['GRUPO'])) 
                ? (clientMatch['GRUPO REAL'] || clientMatch['GRUPO']).trim() 
                : (item.gr || item.g || item.r || 'Outros');
            if (grupoReal) activeGroupsSet.add(grupoReal);

            // Mapeamento diário e mensal
            const dObj = parseDateBR(item.d);
            if (dObj) {
                const dayKey = formatDateISO(dObj);
                dailyRevenueMap[dayKey] = (dailyRevenueMap[dayKey] || 0) + v;
                dailyPiecesMap[dayKey] = (dailyPiecesMap[dayKey] || 0) + q;

                const mKey = `${dObj.getFullYear()}-${(dObj.getMonth()+1).toString().padStart(2, '0')}`;
                monthlyRevenueMap[mKey] = (monthlyRevenueMap[mKey] || 0) + v;
                monthlyPiecesMap[mKey] = (monthlyPiecesMap[mKey] || 0) + q;
            }
        });

        const isPiecesOnly = (currentKpiDisplayMode === 'pieces');
        const isBoth = (currentKpiDisplayMode === 'both');

        // KPI 1: Faturamento Total / Quantidade Total
        const elTotalTitle = document.getElementById('kpi-total-title');
        const elTotalRev = document.getElementById('kpi-total-revenue');
        const elTotalSub = document.getElementById('kpi-total-sub');
        const elTotalOrders = document.getElementById('kpi-total-orders');

        if (elTotalTitle) {
            elTotalTitle.textContent = isPiecesOnly ? 'Peças Faturadas' : 'Faturamento Total';
        }
        if (elTotalRev) {
            elTotalRev.textContent = isPiecesOnly 
                ? `${numberFormatter.format(totalPieces)} pçs` 
                : formatBRL(totalRevenue);
        }
        if (elTotalSub) {
            if (isBoth) {
                elTotalSub.innerHTML = `<i class='bx bx-package'></i> ${numberFormatter.format(totalPieces)} pçs`;
                elTotalSub.style.display = 'inline-flex';
            } else {
                elTotalSub.style.display = 'none';
            }
        }
        if (elTotalOrders) {
            elTotalOrders.textContent = `${numberFormatter.format(totalOrders)} lançamentos / notas`;
        }

        // KPI 2: Mês Atual / Último Mês
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}`;
        let monthRevenue = monthlyRevenueMap[currentMonthKey] || 0;
        let monthPieces = monthlyPiecesMap[currentMonthKey] || 0;
        let monthTitle = isPiecesOnly ? 'Peças no Mês' : 'Faturamento no Mês';
        let monthCaption = 'Mês atual';

        if (monthRevenue === 0 && Object.keys(monthlyRevenueMap).length > 0) {
            const sortedMonths = Object.keys(monthlyRevenueMap).sort().reverse();
            const lastMKey = sortedMonths[0];
            monthRevenue = monthlyRevenueMap[lastMKey] || 0;
            monthPieces = monthlyPiecesMap[lastMKey] || 0;
            const [y, m] = lastMKey.split('-');
            const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            const prefix = isPiecesOnly ? 'Peças' : 'Faturamento';
            monthTitle = `${prefix} (${monthNames[parseInt(m, 10)-1]}/${y})`;
            monthCaption = 'Último mês com faturamento';
        }

        const elMonthTitle = document.getElementById('kpi-month-title');
        const elMonthRev = document.getElementById('kpi-month-revenue');
        const elMonthSub = document.getElementById('kpi-month-sub');
        const elMonthCap = document.getElementById('kpi-month-caption');

        if (elMonthTitle) elMonthTitle.textContent = monthTitle;
        if (elMonthRev) {
            elMonthRev.textContent = isPiecesOnly 
                ? `${numberFormatter.format(monthPieces)} pçs` 
                : formatBRL(monthRevenue);
        }
        if (elMonthSub) {
            if (isBoth) {
                elMonthSub.innerHTML = `<i class='bx bx-package'></i> ${numberFormatter.format(monthPieces)} pçs`;
                elMonthSub.style.display = 'inline-flex';
            } else {
                elMonthSub.style.display = 'none';
            }
        }
        if (elMonthCap) elMonthCap.textContent = monthCaption;

        // KPI 3: Dia Atual / Último Dia
        const todayKey = formatDateISO(now);
        let dayRevenue = dailyRevenueMap[todayKey] || 0;
        let dayPieces = dailyPiecesMap[todayKey] || 0;
        let dayTitle = isPiecesOnly ? 'Peças do Dia' : 'Faturamento do Dia';
        let dayDateStr = 'Hoje';

        if (dayRevenue === 0 && Object.keys(dailyRevenueMap).length > 0) {
            const sortedDays = Object.keys(dailyRevenueMap).sort().reverse();
            const lastDayKey = sortedDays[0];
            dayRevenue = dailyRevenueMap[lastDayKey] || 0;
            dayPieces = dailyPiecesMap[lastDayKey] || 0;
            const parts = lastDayKey.split('-');
            dayTitle = isPiecesOnly ? 'Último Dia (Peças)' : 'Último Dia Faturado';
            dayDateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }

        const elDayTitle = document.getElementById('kpi-day-title');
        const elDayRev = document.getElementById('kpi-day-revenue');
        const elDaySub = document.getElementById('kpi-day-sub');
        const elDayDate = document.getElementById('kpi-day-date');

        if (elDayTitle) elDayTitle.textContent = dayTitle;
        if (elDayRev) {
            elDayRev.textContent = isPiecesOnly 
                ? `${numberFormatter.format(dayPieces)} pçs` 
                : formatBRL(dayRevenue);
        }
        if (elDaySub) {
            if (isBoth) {
                elDaySub.innerHTML = `<i class='bx bx-package'></i> ${numberFormatter.format(dayPieces)} pçs`;
                elDaySub.style.display = 'inline-flex';
            } else {
                elDaySub.style.display = 'none';
            }
        }
        if (elDayDate) elDayDate.textContent = dayDateStr;

        // KPI 4: Clientes Faturados
        const totalClients = activeClientsSet.size;
        const elActiveClients = document.getElementById('kpi-active-clients');
        if (elActiveClients) elActiveClients.textContent = numberFormatter.format(totalClients);

        // KPI 5: Redes / Grupos
        const totalGroups = activeGroupsSet.size;
        const elActiveGroups = document.getElementById('kpi-active-groups');
        if (elActiveGroups) elActiveGroups.textContent = numberFormatter.format(totalGroups);

        // KPI 6: Ticket Médio / Média de Peças
        const avgTicket = totalClients > 0 ? (totalRevenue / totalClients) : 0;
        const avgPieces = totalClients > 0 ? (totalPieces / totalClients) : 0;
        const elTicketTitle = document.getElementById('kpi-ticket-title');
        const elAvgTicket = document.getElementById('kpi-avg-ticket');
        const elTicketSub = document.getElementById('kpi-ticket-sub');
        const elTicketFooter = document.getElementById('kpi-ticket-footer');

        if (elTicketTitle) {
            elTicketTitle.textContent = isPiecesOnly ? 'Média Peças / Cli' : 'Ticket Médio';
        }
        if (elAvgTicket) {
            elAvgTicket.textContent = isPiecesOnly 
                ? `${numberFormatter.format(Math.round(avgPieces))} pçs` 
                : formatBRL(avgTicket);
        }
        if (elTicketSub) {
            if (isBoth) {
                elTicketSub.innerHTML = `<i class='bx bx-package'></i> ${numberFormatter.format(Math.round(avgPieces))} pçs / cli`;
                elTicketSub.style.display = 'inline-flex';
            } else {
                elTicketSub.style.display = 'none';
            }
        }
        if (elTicketFooter) {
            elTicketFooter.textContent = isPiecesOnly ? 'peças por cliente faturado' : 'por cliente faturado';
        }
    }

    // --------------------------------------------------------------------------
    // 2. GRÁFICOS POWER BI (Chart.js)
    // --------------------------------------------------------------------------
    const yearPalette = [
        { bg: 'rgba(99, 102, 241, 0.85)', hover: '#6366f1', border: '#4f46e5' },   // Indigo
        { bg: 'rgba(16, 185, 129, 0.85)', hover: '#10b981', border: '#059669' },  // Esmeralda
        { bg: 'rgba(245, 158, 11, 0.85)', hover: '#f59e0b', border: '#d97706' },  // Âmbar
        { bg: 'rgba(236, 72, 153, 0.85)', hover: '#ec4899', border: '#db2777' },  // Rosa
        { bg: 'rgba(139, 92, 246, 0.85)', hover: '#8b5cf6', border: '#7c3aed' },  // Roxo
        { bg: 'rgba(6, 182, 212, 0.85)',  hover: '#06b6d4', border: '#0891b2' },  // Ciano
        { bg: 'rgba(239, 68, 68, 0.85)',  hover: '#ef4444', border: '#dc2626' }   // Vermelho
    ];

    window.switchComparisonMetric = function(metric) {
        currentComparisonMetric = metric;
        document.querySelectorAll('.btn-comp-pill').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.metric === metric);
        });

        const selectedYears = getIndCMSSelectedValues('year');
        const clientsMap = buildClientsMap();
        renderComparisonSection(billingFilteredData, clientsMap, selectedYears, metric);
    };

    function renderComparisonSection(data, clientsMap, selectedYears, metric = 'monthly') {
        const panelEl = document.getElementById('indicators-comparison-panel');
        const canvas = document.getElementById('chart-comparison');
        if (!panelEl || !canvas) return;

        if (!selectedYears || selectedYears.length <= 1) {
            panelEl.style.display = 'none';
            if (chartComparisonInstance) {
                chartComparisonInstance.destroy();
                chartComparisonInstance = null;
            }
            return;
        }

        const isPiecesMode = (currentKpiDisplayMode === 'pieces');
        panelEl.style.display = 'flex';
        const sortedYears = Array.from(new Set(selectedYears)).sort();

        const badgeEl = document.getElementById('comparison-years-badge');
        if (badgeEl) {
            const unitLabel = isPiecesMode ? ' (Peças)' : ' (Valores)';
            badgeEl.textContent = `${sortedYears.join(' vs ')}${unitLabel}`;
        }

        let labels = [];
        const datasets = [];

        if (metric === 'monthly') {
            labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            sortedYears.forEach((y, idx) => {
                const monthSums = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
                data.forEach(item => {
                    const dObj = parseDateBR(item.d);
                    if (dObj && dObj.getFullYear().toString() === y) {
                        const m = dObj.getMonth();
                        monthSums[m] += isPiecesMode ? (item.q || 0) : (item.v || 0);
                    }
                });

                const color = yearPalette[idx % yearPalette.length];
                datasets.push({
                    label: `Ano ${y}`,
                    data: monthSums,
                    backgroundColor: color.bg,
                    hoverBackgroundColor: color.hover,
                    borderColor: color.border,
                    borderWidth: 1,
                    borderRadius: 4
                });
            });
        } else {
            // Outras 7 métricas: group-real, client, network, group, product, subgroup, class
            const entityTotals = {};
            data.forEach(item => {
                let key = '';
                if (metric === 'group-real') {
                    const clientMatch = resolveClientForItem(item, clientsMap);
                    key = (clientMatch && (clientMatch['GRUPO REAL'] || clientMatch['GRUPO']))
                        ? (clientMatch['GRUPO REAL'] || clientMatch['GRUPO']).trim()
                        : (item.gr || item.g || item.r || 'Outros');
                } else if (metric === 'client') {
                    key = getClientCombinedName(item, clientsMap);
                } else if (metric === 'network') {
                    const clientMatch = resolveClientForItem(item, clientsMap);
                    key = (clientMatch && clientMatch['GRUPO']) ? clientMatch['GRUPO'].trim() : (item.r || item.g || item.f || 'Outras');
                } else if (metric === 'group') {
                    const clientMatch = resolveClientForItem(item, clientsMap);
                    key = (clientMatch && clientMatch['GRUPO REAL']) ? clientMatch['GRUPO REAL'].trim() : (item.gr || item.r || 'Outros');
                } else if (metric === 'product') {
                    key = item.p ? `${item.p}` : 'Sem Referência';
                } else if (metric === 'subgroup') {
                    key = item.sub || 'DIVERSOS';
                } else if (metric === 'class') {
                    key = item.cl || 'OUTROS';
                }
                if (!key) key = 'Outros';
                entityTotals[key] = (entityTotals[key] || 0) + (isPiecesMode ? (item.q || 0) : (item.v || 0));
            });

            const limit = metric === 'class' ? 12 : 8;
            labels = Object.entries(entityTotals)
                .sort((a, b) => b[1] - a[1])
                .slice(0, limit)
                .map(e => e[0]);

            sortedYears.forEach((y, idx) => {
                const yearValues = labels.map(entity => {
                    let sum = 0;
                    data.forEach(item => {
                        const dObj = parseDateBR(item.d);
                        if (dObj && dObj.getFullYear().toString() === y) {
                            let itemKey = '';
                            if (metric === 'group-real') {
                                const clientMatch = resolveClientForItem(item, clientsMap);
                                itemKey = (clientMatch && (clientMatch['GRUPO REAL'] || clientMatch['GRUPO']))
                                    ? (clientMatch['GRUPO REAL'] || clientMatch['GRUPO']).trim()
                                    : (item.gr || item.g || item.r || 'Outros');
                            } else if (metric === 'client') {
                                itemKey = getClientCombinedName(item, clientsMap);
                            } else if (metric === 'network') {
                                const clientMatch = resolveClientForItem(item, clientsMap);
                                itemKey = (clientMatch && clientMatch['GRUPO']) ? clientMatch['GRUPO'].trim() : (item.r || item.g || item.f || 'Outras');
                            } else if (metric === 'group') {
                                const clientMatch = resolveClientForItem(item, clientsMap);
                                itemKey = (clientMatch && clientMatch['GRUPO REAL']) ? clientMatch['GRUPO REAL'].trim() : (item.gr || item.r || 'Outros');
                            } else if (metric === 'product') {
                                itemKey = item.p ? `${item.p}` : 'Sem Referência';
                            } else if (metric === 'subgroup') {
                                itemKey = item.sub || 'DIVERSOS';
                            } else if (metric === 'class') {
                                itemKey = item.cl || 'OUTROS';
                            }
                            if (!itemKey) itemKey = 'Outros';
                            if (itemKey === entity) sum += (isPiecesMode ? (item.q || 0) : (item.v || 0));
                        }
                    });
                    return Math.round(sum * 100) / 100;
                });

                const color = yearPalette[idx % yearPalette.length];
                datasets.push({
                    label: `Ano ${y}`,
                    data: yearValues,
                    backgroundColor: color.bg,
                    hoverBackgroundColor: color.hover,
                    borderColor: color.border,
                    borderWidth: 1,
                    borderRadius: 4
                });
            });
        }

        if (chartComparisonInstance) {
            chartComparisonInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        chartComparisonInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#e2e8f0',
                            font: { size: 12, weight: 600 },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 16
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: 'rgba(99, 102, 241, 0.4)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                const val = context.parsed.y;
                                const dsLabel = context.dataset.label || '';
                                const dsIdx = context.datasetIndex;
                                let diffStr = '';
                                if (dsIdx > 0) {
                                    const prevVal = context.chart.data.datasets[dsIdx - 1].data[context.dataIndex] || 0;
                                    if (prevVal > 0) {
                                        const pct = ((val - prevVal) / prevVal) * 100;
                                        const sign = pct >= 0 ? '+' : '';
                                        diffStr = ` (${sign}${pct.toFixed(1)}% vs ${context.chart.data.datasets[dsIdx - 1].label.replace('Ano ', '')})`;
                                    }
                                }
                                const valFormatted = isPiecesMode 
                                    ? `${numberFormatter.format(val)} pçs` 
                                    : formatBRL(val);
                                return `${dsLabel}: ${valFormatted}${diffStr}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 11 },
                            maxRotation: 25,
                            minRotation: 0,
                            callback: function(val, index) {
                                const label = this.getLabelForValue(val);
                                return (label && label.length > 22) ? label.slice(0, 20) + '...' : label;
                            }
                        }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.06)' },
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 11 },
                            callback: function(val) {
                                if (isPiecesMode) {
                                    if (val >= 1000000) return `${(val/1000000).toFixed(1)}M pçs`;
                                    if (val >= 1000) return `${(val/1000).toFixed(0)}k pçs`;
                                    return `${val} pçs`;
                                }
                                if (val >= 1000000) return `R$ ${(val/1000000).toFixed(1)}M`;
                                if (val >= 1000) return `R$ ${(val/1000).toFixed(0)}k`;
                                return `R$ ${val}`;
                            }
                        }
                    }
                }
            }
        });
    }

    function renderCharts(data, clientsMap) {
        if (!window.Chart) {
            console.warn('Chart.js ainda não carregado.');
            return;
        }

        const selectedYears = getIndCMSSelectedValues('year');

        // Se mais de 1 ano estiver selecionado, renderiza o gráfico comparativo
        if (selectedYears && selectedYears.length > 1) {
            renderComparisonSection(data, clientsMap, selectedYears, currentComparisonMetric);
        } else {
            const panelEl = document.getElementById('indicators-comparison-panel');
            if (panelEl) panelEl.style.display = 'none';
            if (chartComparisonInstance) {
                chartComparisonInstance.destroy();
                chartComparisonInstance = null;
            }
        }

        // Gráfico 1: Evolução Diária
        renderDailyChart(data);

        // Gráfico 2: Faturamento Mensal
        renderMonthlyChart(data);

        // Gráfico 3: Faturamento por Grupo Real
        renderGroupChart(data, clientsMap);
    }

    function renderDailyChart(data) {
        const canvas = document.getElementById('chart-daily-revenue');
        if (!canvas) return;

        const isPiecesMode = (currentKpiDisplayMode === 'pieces');
        const isBoth = (currentKpiDisplayMode === 'both');
        const dailyVal = {};
        const dailyPieces = {};

        data.forEach(item => {
            const dObj = parseDateBR(item.d);
            if (dObj) {
                const k = formatDateISO(dObj);
                dailyVal[k] = (dailyVal[k] || 0) + (item.v || 0);
                dailyPieces[k] = (dailyPieces[k] || 0) + (item.q || 0);
            }
        });

        const sortedDays = Object.keys(dailyVal).sort();
        const labels = sortedDays.map(dStr => {
            const [y, m, d] = dStr.split('-');
            return `${d}/${m}`;
        });
        const values = sortedDays.map(dStr => isPiecesMode ? dailyPieces[dStr] : dailyVal[dStr]);

        const countBadge = document.getElementById('chart-daily-count');
        if (countBadge) countBadge.textContent = `${sortedDays.length} dias faturados`;

        if (chartDailyInstance) {
            chartDailyInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.45)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.02)');

        chartDailyInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: isPiecesMode ? 'Volume (Peças)' : 'Faturamento (R$)',
                    data: values,
                    borderColor: '#6366f1',
                    borderWidth: 2.5,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: sortedDays.length > 50 ? 2 : 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: 'rgba(99, 102, 241, 0.4)',
                        borderWidth: 1,
                        padding: 10,
                        titleColor: '#f8fafc',
                        bodyColor: '#10b981',
                        bodyFont: { weight: 'bold', size: 13 },
                        callbacks: {
                            label: function(context) {
                                const dayKey = sortedDays[context.dataIndex];
                                if (isPiecesMode) {
                                    return `Volume: ${numberFormatter.format(context.parsed.y)} pçs`;
                                } else if (isBoth) {
                                    const p = dailyPieces[dayKey] || 0;
                                    return `Faturamento: ${formatBRL(context.parsed.y)} (${numberFormatter.format(p)} pçs)`;
                                }
                                return `Faturamento: ${formatBRL(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        ticks: { color: '#94a3b8', font: { size: 11 }, maxRotation: 45 }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.06)' },
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 11 },
                            callback: function(val) {
                                if (isPiecesMode) {
                                    if (val >= 1000) return `${(val/1000).toFixed(0)}k pçs`;
                                    return `${val} pçs`;
                                }
                                if (val >= 1000000) return `R$ ${(val/1000000).toFixed(1)}M`;
                                if (val >= 1000) return `R$ ${(val/1000).toFixed(0)}k`;
                                return `R$ ${val}`;
                            }
                        }
                    }
                }
            }
        });
    }

    function renderMonthlyChart(data) {
        const canvas = document.getElementById('chart-monthly-revenue');
        if (!canvas) return;

        const isPiecesMode = (currentKpiDisplayMode === 'pieces');
        const isBoth = (currentKpiDisplayMode === 'both');
        const monthlyVal = {};
        const monthlyPieces = {};

        data.forEach(item => {
            const dObj = parseDateBR(item.d);
            if (dObj) {
                const k = `${dObj.getFullYear()}-${(dObj.getMonth()+1).toString().padStart(2, '0')}`;
                monthlyVal[k] = (monthlyVal[k] || 0) + (item.v || 0);
                monthlyPieces[k] = (monthlyPieces[k] || 0) + (item.q || 0);
            }
        });

        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const sortedMonths = Object.keys(monthlyVal).sort();
        const labels = sortedMonths.map(mStr => {
            const [y, m] = mStr.split('-');
            return `${monthNames[parseInt(m, 10)-1]}/${y.slice(2)}`;
        });
        const values = sortedMonths.map(mStr => isPiecesMode ? monthlyPieces[mStr] : monthlyVal[mStr]);

        if (chartMonthlyInstance) {
            chartMonthlyInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        chartMonthlyInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: isPiecesMode ? 'Volume Mensal (Peças)' : 'Faturamento Mensal (R$)',
                    data: values,
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    hoverBackgroundColor: '#10b981',
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: 'rgba(16, 185, 129, 0.4)',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: function(context) {
                                const mKey = sortedMonths[context.dataIndex];
                                if (isPiecesMode) {
                                    return `Volume: ${numberFormatter.format(context.parsed.y)} pçs`;
                                } else if (isBoth) {
                                    const p = monthlyPieces[mKey] || 0;
                                    return `Faturamento: ${formatBRL(context.parsed.y)} (${numberFormatter.format(p)} pçs)`;
                                }
                                return `Faturamento: ${formatBRL(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8', font: { size: 11 } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.06)' },
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 11 },
                            callback: function(val) {
                                if (isPiecesMode) {
                                    if (val >= 1000) return `${(val/1000).toFixed(0)}k pçs`;
                                    return `${val} pçs`;
                                }
                                if (val >= 1000) return `R$ ${(val/1000).toFixed(0)}k`;
                                return `R$ ${val}`;
                            }
                        }
                    }
                }
            }
        });
    }

    function renderGroupChart(data, clientsMap) {
        const canvas = document.getElementById('chart-group-revenue');
        if (!canvas) return;

        const isPiecesMode = (currentKpiDisplayMode === 'pieces');
        const isBoth = (currentKpiDisplayMode === 'both');
        const groupVal = {};
        const groupPieces = {};

        data.forEach(item => {
            const clientMatch = resolveClientForItem(item, clientsMap);
            let grupo = (clientMatch && (clientMatch['GRUPO REAL'] || clientMatch['GRUPO'])) 
                ? (clientMatch['GRUPO REAL'] || clientMatch['GRUPO']).trim() 
                : (item.gr || item.g || item.r || 'Não Vinculado');

            if (!grupo) grupo = 'Não Vinculado';
            groupVal[grupo] = (groupVal[grupo] || 0) + (item.v || 0);
            groupPieces[grupo] = (groupPieces[grupo] || 0) + (item.q || 0);
        });

        // Top 7 grupos + "Outros"
        const sortedGroups = Object.entries(isPiecesMode ? groupPieces : groupVal).sort((a, b) => b[1] - a[1]);
        const topCount = 7;
        const topGroups = sortedGroups.slice(0, topCount);
        const otherGroups = sortedGroups.slice(topCount);

        const labels = topGroups.map(g => g[0]);
        const values = topGroups.map(g => g[1]);

        if (otherGroups.length > 0) {
            const otherSum = otherGroups.reduce((acc, curr) => acc + curr[1], 0);
            labels.push('Outros Grupos');
            values.push(otherSum);
        }

        if (chartGroupInstance) {
            chartGroupInstance.destroy();
        }

        const colors = [
            '#6366f1', '#10b981', '#f59e0b', '#ec4899', 
            '#8b5cf6', '#06b6d4', '#3b82f6', '#64748b'
        ];

        const ctx = canvas.getContext('2d');
        chartGroupInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: isPiecesMode ? 'Volume por Grupo (Peças)' : 'Faturamento por Grupo (R$)',
                    data: values,
                    backgroundColor: colors.slice(0, labels.length),
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: function(context) {
                                const gName = labels[context.dataIndex];
                                if (isPiecesMode) {
                                    return `Volume: ${numberFormatter.format(context.parsed.x)} pçs`;
                                } else if (isBoth && groupPieces[gName] !== undefined) {
                                    return `Faturamento: ${formatBRL(context.parsed.x)} (${numberFormatter.format(groupPieces[gName])} pçs)`;
                                }
                                return `Faturamento: ${formatBRL(context.parsed.x)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.06)' },
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 10 },
                            callback: function(val) {
                                if (isPiecesMode) {
                                    if (val >= 1000) return `${(val/1000).toFixed(0)}k pçs`;
                                    return `${val} pçs`;
                                }
                                if (val >= 1000) return `R$ ${(val/1000).toFixed(0)}k`;
                                return `R$ ${val}`;
                            }
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#f8fafc', font: { size: 11, weight: '500' } }
                    }
                }
            }
        });
    }

    // --------------------------------------------------------------------------
    // 3. RANKINGS COMERCIAIS TOP 10
    // --------------------------------------------------------------------------
    function renderRankings(data, clientsMap) {
        const totalRevenue = data.reduce((acc, curr) => acc + (curr.v || 0), 0);
        const totalPieces = data.reduce((acc, curr) => acc + (curr.q || 0), 0);

        renderTopClients(data, clientsMap, totalRevenue, totalPieces);
        renderTopNetworks(data, clientsMap, totalRevenue, totalPieces);
        renderTopGroups(data, clientsMap, totalRevenue, totalPieces);
        renderTopProducts(data, totalRevenue, totalPieces);
        renderTopSubGroups(data, totalRevenue, totalPieces);
        renderTopClasses(data, totalRevenue, totalPieces);
        renderTopNFs(data, clientsMap, totalRevenue, totalPieces);
    }

    function renderRankingListHTML(items, totalRevenue, nameLabel, totalPieces = 0) {
        if (!items || items.length === 0) {
            return `
                <div style="text-align: center; padding: 2rem 1rem; color: var(--text-secondary); font-size: 0.85rem;">
                    Nenhum dado encontrado para o período selecionado.
                </div>
            `;
        }

        const isPiecesOnly = (currentKpiDisplayMode === 'pieces');
        const isBoth = (currentKpiDisplayMode === 'both');
        const limit = (rankingDisplayLimit === 'all') ? items.length : rankingDisplayLimit;
        const displayedItems = items.slice(0, limit);

        let html = '<div class="ranking-items-list" style="max-height: 480px; overflow-y: auto; padding-right: 4px;">';
        displayedItems.forEach((item, idx) => {
            const pos = idx + 1;
            const itemQty = (item.q !== undefined ? item.q : item.totalQty) || 0;
            const itemVal = item.v || 0;

            let pct = 0;
            if (isPiecesOnly) {
                pct = totalPieces > 0 ? ((itemQty / totalPieces) * 100) : 0;
            } else {
                pct = totalRevenue > 0 ? ((itemVal / totalRevenue) * 100) : 0;
            }

            const posBadgeClass = pos === 1 ? 'pos-1' : (pos === 2 ? 'pos-2' : (pos === 3 ? 'pos-3' : 'pos-default'));

            // Bloco de valor / quantidade da direita
            let rightValueHTML = '';
            if (isPiecesOnly) {
                rightValueHTML = `<span class="ranking-item-value font-mono"><i class='bx bx-package' style="font-size:0.85em; opacity:0.8;"></i> ${numberFormatter.format(itemQty)} pçs</span>`;
            } else if (isBoth) {
                rightValueHTML = `
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                        <span class="ranking-item-value">${formatBRL(itemVal)}</span>
                        <span class="font-mono" style="color: #a5b4fc; font-size: 0.74rem; font-weight: 600;"><i class='bx bx-package' style="font-size:0.8em;"></i> ${numberFormatter.format(itemQty)} pçs</span>
                    </div>
                `;
            } else {
                rightValueHTML = `<span class="ranking-item-value">${formatBRL(itemVal)}</span>`;
            }

            html += `
                <div class="ranking-row-item">
                    <div class="ranking-row-top">
                        <div class="ranking-item-left">
                            <span class="ranking-pos-badge ${posBadgeClass}">${pos}º</span>
                            <div class="ranking-item-info">
                                <span class="ranking-item-name" title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</span>
                                ${item.sub ? `<span class="ranking-item-sub">${escapeHTML(item.sub)}</span>` : ''}
                            </div>
                        </div>
                        <div class="ranking-item-right">
                            ${rightValueHTML}
                            <span class="ranking-item-pct">${pct.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div class="ranking-progress-bar">
                        <div class="ranking-progress-fill" style="width: ${Math.min(pct * 2.5, 100)}%;"></div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        // Botões dinâmicos de expandir ou recolher
        if (rankingDisplayLimit !== 'all' && items.length > limit) {
            html += `
                <div style="text-align: center; padding-top: 0.6rem; margin-top: 0.4rem; border-top: 1px dashed rgba(255, 255, 255, 0.08);">
                    <button type="button" class="btn-ranking-toggle" onclick="setRankingLimit('all')">
                        <i class='bx bx-expand-vertical'></i> Mostrar todos (${items.length} registros)
                    </button>
                </div>
            `;
        } else if (rankingDisplayLimit === 'all' && items.length > 10) {
            html += `
                <div style="text-align: center; padding-top: 0.6rem; margin-top: 0.4rem; border-top: 1px dashed rgba(255, 255, 255, 0.08);">
                    <button type="button" class="btn-ranking-toggle" onclick="setRankingLimit(10)">
                        <i class='bx bx-collapse-vertical'></i> Recolher p/ Top 10
                    </button>
                </div>
            `;
        }

        return html;
    }

    function renderTopClients(data, clientsMap, totalRevenue, totalPieces = 0) {
        const container = document.getElementById('ranking-clients-container');
        if (!container) return;

        const clientTotals = {};
        data.forEach(item => {
            const clientMatch = resolveClientForItem(item, clientsMap);
            const cnpj = item.c || (clientMatch && clientMatch['CNPJ']) || '';
            const key = cnpj || (item.cli ? `CLI_${item.cli}` : (item.f || 'Cliente sem nome'));

            const fantasia = (clientMatch && (clientMatch['FANTASIA'] || clientMatch['NOME FANTASIA'])) 
                ? (clientMatch['FANTASIA'] || clientMatch['NOME FANTASIA']) 
                : (item.f || item.z || 'Cliente s/ Cadastro');

            const razao = (clientMatch && (clientMatch['RAZAO SOCIAL'] || clientMatch['RAZÃO SOCIAL'])) 
                ? (clientMatch['RAZAO SOCIAL'] || clientMatch['RAZÃO SOCIAL']) 
                : (item.z || '');

            const cidadeUf = (clientMatch && clientMatch['CIDADE'])
                ? `${clientMatch['CIDADE']}/${clientMatch['ESTADO'] || ''}`
                : (item.cid || (cnpj ? formatCNPJMask(cnpj) : (item.cli ? `Cód: ${item.cli}` : '')));

            const subParts = [];
            if (razao && razao.trim().toUpperCase() !== fantasia.trim().toUpperCase()) {
                subParts.push(razao.trim());
            }
            if (cidadeUf) subParts.push(cidadeUf);

            if (!clientTotals[key]) {
                clientTotals[key] = {
                    name: fantasia,
                    sub: subParts.join(' • '),
                    v: 0,
                    q: 0
                };
            }
            clientTotals[key].v += (item.v || 0);
            clientTotals[key].q += (item.q || 0);
        });

        const sorted = Object.values(clientTotals).sort((a, b) => {
            return currentKpiDisplayMode === 'pieces' ? (b.q - a.q) : (b.v - a.v);
        });
        container.innerHTML = renderRankingListHTML(sorted, totalRevenue, 'Cliente', totalPieces);
    }

    function renderTopNetworks(data, clientsMap, totalRevenue, totalPieces = 0) {
        const container = document.getElementById('ranking-networks-container');
        if (!container) return;

        const networkTotals = {};
        data.forEach(item => {
            const clientMatch = resolveClientForItem(item, clientsMap);
            // TOP 10 REDES: consolidado pelo campo GRUPO
            let grupo = (clientMatch && clientMatch['GRUPO']) 
                ? clientMatch['GRUPO'].trim() 
                : (item.g || item.r || item.f || 'Sem Grupo');

            if (!grupo || grupo === 'None' || grupo === '-') grupo = 'Sem Grupo';

            if (!networkTotals[grupo]) {
                networkTotals[grupo] = {
                    name: grupo,
                    sub: '',
                    v: 0,
                    q: 0,
                    count: 0
                };
            }
            networkTotals[grupo].v += (item.v || 0);
            networkTotals[grupo].q += (item.q || 0);
            networkTotals[grupo].count += 1;
        });

        const sorted = Object.values(networkTotals).sort((a, b) => {
            return currentKpiDisplayMode === 'pieces' ? (b.q - a.q) : (b.v - a.v);
        }).map(it => {
            it.sub = `${numberFormatter.format(it.count)} notas / lanç.`;
            return it;
        });

        container.innerHTML = renderRankingListHTML(sorted, totalRevenue, 'Rede (Grupo)', totalPieces);
    }

    function renderTopGroups(data, clientsMap, totalRevenue, totalPieces = 0) {
        const container = document.getElementById('ranking-groups-container');
        if (!container) return;

        const groupTotals = {};
        data.forEach(item => {
            const clientMatch = resolveClientForItem(item, clientsMap);
            // TOP 10 GRUPOS: consolidado pelo campo GRUPO REAL
            let grupoReal = (clientMatch && clientMatch['GRUPO REAL']) 
                ? clientMatch['GRUPO REAL'].trim() 
                : (item.gr || (clientMatch && clientMatch['GRUPO']) || item.g || item.r || 'Sem Grupo Real');

            if (!grupoReal || grupoReal === 'None' || grupoReal === '-') grupoReal = 'Sem Grupo Real';

            if (!groupTotals[grupoReal]) {
                groupTotals[grupoReal] = {
                    name: grupoReal,
                    sub: '',
                    v: 0,
                    q: 0,
                    count: 0
                };
            }
            groupTotals[grupoReal].v += (item.v || 0);
            groupTotals[grupoReal].q += (item.q || 0);
            groupTotals[grupoReal].count += 1;
        });

        const sorted = Object.values(groupTotals).sort((a, b) => {
            return currentKpiDisplayMode === 'pieces' ? (b.q - a.q) : (b.v - a.v);
        }).map(it => {
            it.sub = `${numberFormatter.format(it.count)} notas / lanç.`;
            return it;
        });

        container.innerHTML = renderRankingListHTML(sorted, totalRevenue, 'Grupo Real', totalPieces);
    }

    // TOP 10 PRODUTOS: referências mais vendidas
    function renderTopProducts(data, totalRevenue, totalPieces = 0) {
        const container = document.getElementById('ranking-products-container');
        if (!container) return;

        const prodTotals = {};
        data.forEach(item => {
            const pCode = (item.p || '').trim();
            const pDesc = (item.desc || '').trim();
            const key = pCode || pDesc || 'Sem Referência';

            if (!prodTotals[key]) {
                prodTotals[key] = {
                    code: pCode,
                    desc: pDesc,
                    name: pDesc || pCode || 'Produto sem descrição',
                    q: 0,
                    v: 0
                };
            }
            prodTotals[key].v += (item.v || 0);
            prodTotals[key].q += (item.q || 0);
        });

        const sorted = Object.values(prodTotals).sort((a, b) => {
            return currentKpiDisplayMode === 'pieces' ? (b.q - a.q) : (b.v - a.v);
        }).map(it => {
            const parts = [];
            if (it.code && it.desc) parts.push(`Ref: ${it.code}`);
            it.sub = parts.join(' • ');
            return it;
        });

        container.innerHTML = renderRankingListHTML(sorted, totalRevenue, 'Produto', totalPieces);
    }

    // TOP 10 SUB-GRUPOS: modelos e linhas mais vendidos
    function renderTopSubGroups(data, totalRevenue, totalPieces = 0) {
        const container = document.getElementById('ranking-subgroups-container');
        if (!container) return;

        const subTotals = {};
        data.forEach(item => {
            const subName = (item.sub || 'Não Definido').trim();
            if (!subTotals[subName]) {
                subTotals[subName] = {
                    name: subName,
                    q: 0,
                    totalCount: 0,
                    v: 0
                };
            }
            subTotals[subName].v += (item.v || 0);
            subTotals[subName].q += (item.q || 0);
            subTotals[subName].totalCount += 1;
        });

        const sorted = Object.values(subTotals).sort((a, b) => {
            return currentKpiDisplayMode === 'pieces' ? (b.q - a.q) : (b.v - a.v);
        }).map(it => {
            it.sub = `${numberFormatter.format(it.totalCount)} lançamentos`;
            return it;
        });

        container.innerHTML = renderRankingListHTML(sorted, totalRevenue, 'Sub-Grupo', totalPieces);
    }

    // TOP CLASSE PRODUTO: volume por divisão (Headwear, Apparel, etc.)
    function renderTopClasses(data, totalRevenue, totalPieces = 0) {
        const container = document.getElementById('ranking-classes-container');
        if (!container) return;

        const classTotals = {};
        data.forEach(item => {
            const className = (item.cl || 'Outros').trim();
            if (!classTotals[className]) {
                classTotals[className] = {
                    name: className,
                    q: 0,
                    v: 0
                };
            }
            classTotals[className].v += (item.v || 0);
            classTotals[className].q += (item.q || 0);
        });

        const sorted = Object.values(classTotals).sort((a, b) => {
            return currentKpiDisplayMode === 'pieces' ? (b.q - a.q) : (b.v - a.v);
        });

        container.innerHTML = renderRankingListHTML(sorted, totalRevenue, 'Classe Produto', totalPieces);
    }

    // TOP NOTAS FISCAIS: maiores notas emitidas (número da NF, valor, emissão e cliente)
    function renderTopNFs(data, clientsMap, totalRevenue, totalPieces = 0) {
        const container = document.getElementById('ranking-nfs-container');
        if (!container) return;

        const nfTotals = {};
        data.forEach(item => {
            const nfNum = (item.nf || '').trim();
            const key = nfNum || `S_NF_${item.d}_${item.c || item.cli || Math.random()}`;

            if (!nfTotals[key]) {
                const clientMatch = resolveClientForItem(item, clientsMap);
                const fantasia = (clientMatch && (clientMatch['FANTASIA'] || clientMatch['NOME FANTASIA'])) 
                    ? (clientMatch['FANTASIA'] || clientMatch['NOME FANTASIA']) 
                    : (item.f || item.z || 'Cliente');

                nfTotals[key] = {
                    name: nfNum ? `NF ${nfNum}` : 'Sem Número de NF',
                    date: item.d || '-',
                    fantasia: fantasia,
                    q: 0,
                    v: 0
                };
            }
            nfTotals[key].v += (item.v || 0);
            nfTotals[key].q += (item.q || 0);
            if ((!nfTotals[key].date || nfTotals[key].date === '-') && item.d) {
                nfTotals[key].date = item.d;
            }
        });

        const sorted = Object.values(nfTotals).sort((a, b) => {
            return currentKpiDisplayMode === 'pieces' ? (b.q - a.q) : (b.v - a.v);
        }).map(it => {
            const parts = [];
            if (it.date && it.date !== '-') parts.push(it.date);
            it.sub = parts.join(' • ');
            return it;
        });

        container.innerHTML = renderRankingListHTML(sorted, totalRevenue, 'Nota Fiscal', totalPieces);
    }

    // --------------------------------------------------------------------------
    // 4. SEÇÃO DE AUDITORIA (CNPJs / CLIENTES NÃO VINCULADOS)
    // --------------------------------------------------------------------------
    function renderAuditSection(data, clientsMap) {
        const sectionEl = document.getElementById('indicators-audit-section');
        const countBadge = document.getElementById('audit-count-badge');
        const tableContainer = document.getElementById('audit-table-container');
        if (!sectionEl || !tableContainer) return;

        const unlinkedMap = {};
        data.forEach(item => {
            const clientMatch = resolveClientForItem(item, clientsMap);
            if (!clientMatch) {
                const key = item.c || (item.cli ? `CLI_${item.cli}` : item.f);
                if (!unlinkedMap[key]) {
                    unlinkedMap[key] = {
                        cnpj: item.c || '',
                        clifor: item.cli || '',
                        fantasia: item.f || '-',
                        razao: item.z || '-',
                        cidade: item.cid || '-',
                        v: 0
                    };
                }
                unlinkedMap[key].v += (item.v || 0);
            }
        });

        const unlinkedList = Object.values(unlinkedMap).sort((a, b) => b.v - a.v);

        if (unlinkedList.length === 0) {
            sectionEl.style.display = 'none';
            return;
        }

        sectionEl.style.display = 'block';
        if (countBadge) countBadge.textContent = `${unlinkedList.length} clientes pendentes`;

        let tableHtml = `
            <table class="audit-table">
                <thead>
                    <tr>
                        <th>CNPJ</th>
                        <th style="width: 100px;">Cód. New Era</th>
                        <th>Nome Fantasia (Relatório)</th>
                        <th>Razão Social</th>
                        <th style="text-align: right;">Total Faturado</th>
                        <th style="text-align: center; width: 130px;">Ação</th>
                    </tr>
                </thead>
                <tbody>
        `;

        unlinkedList.forEach(u => {
            tableHtml += `
                <tr>
                    <td class="font-mono text-warning" style="font-weight: 600;">${formatCNPJMask(u.cnpj)}</td>
                    <td class="font-mono" style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHTML(u.clifor || '-')}</td>
                    <td style="font-weight: 600; color: var(--text-primary);">${escapeHTML(u.fantasia)}</td>
                    <td style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHTML(u.razao)}</td>
                    <td style="text-align: right; font-weight: 600; color: #10b981;">${formatBRL(u.v)}</td>
                    <td style="text-align: center;">
                        <button type="button" class="btn-audit-add" onclick="quickRegisterUnlinkedClient('${escapeHTML(u.cnpj)}', '${escapeHTML(u.fantasia)}', '${escapeHTML(u.razao)}', '${escapeHTML(u.cidade)}', '${escapeHTML(u.clifor)}')" title="Cadastrar este cliente na base central com busca automática de CNPJ">
                            <i class='bx bx-user-plus'></i> Cadastrar
                        </button>
                    </td>
                </tr>
            `;
        });

        tableHtml += `</tbody></table>`;
        tableContainer.innerHTML = tableHtml;
    }

    function formatCNPJMask(val) {
        if (!val || val.length !== 14) return val || '-';
        return val.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }

    window.toggleAuditDetails = function() {
        const body = document.getElementById('audit-details-body');
        const chevron = document.getElementById('audit-chevron');
        if (!body) return;

        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        if (chevron) {
            chevron.className = isHidden ? 'bx bx-chevron-up' : 'bx bx-chevron-down';
        }
    };

    window.quickRegisterUnlinkedClient = function(cnpj, fantasia, razao, cidade, clifor) {
        if (typeof openNewClientModal === 'function') {
            openNewClientModal();
            setTimeout(() => {
                const elCnpj = document.getElementById('cfm-cnpj');
                const elFantasia = document.getElementById('cfm-fantasia');
                const elRazao = document.getElementById('cfm-razao');
                const elCidade = document.getElementById('cfm-cidade');
                const elCodNe = document.getElementById('cfm-cod-new-era');
                if (elCnpj) elCnpj.value = window.formatCNPJ ? window.formatCNPJ(cnpj) : formatCNPJMask(cnpj);
                if (elFantasia) elFantasia.value = fantasia !== '-' ? fantasia.toUpperCase() : '';
                if (elRazao) elRazao.value = razao !== '-' ? razao.toUpperCase() : '';
                if (elCidade) elCidade.value = cidade !== '-' ? cidade.toUpperCase() : '';
                if (elCodNe && clifor) elCodNe.value = clifor.toUpperCase();

                // Ativa a marca NEW ERA por padrão
                const toggleBtn = document.querySelector('.cfm-brand-toggle-btn[data-brand="NEW ERA"]');
                if (toggleBtn && !toggleBtn.classList.contains('active')) {
                    toggleBtn.click();
                }

                // Dispara busca automática do CNPJ se for válido
                if (cnpj && cnpj.length === 14 && typeof window.lookupCnpjData === 'function') {
                    window.lookupCnpjData();
                }
            }, 120);
        }
    };

    // --------------------------------------------------------------------------
    // 5. IMPORTAÇÃO E EXPORTAÇÃO EXCEL
    // --------------------------------------------------------------------------
    window.handleUploadBillingExcel = function(event) {
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

                const sheetName = workbook.SheetNames.includes('DADOS') ? 'DADOS' : workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: null });

                if (!rawJson || rawJson.length === 0) {
                    window.showNotification('A planilha importada está vazia ou ilegível.', 'error');
                    return;
                }

                // Mapeamento dinâmico das colunas
                const firstRow = rawJson[0];
                const keys = Object.keys(firstRow);
                const findKey = (name) => keys.find(k => k.toLowerCase().includes(name.toLowerCase()));

                const kCnpj = findKey('cnpj');
                const kClifor = findKey('clifor') || findKey('código') || findKey('codigo');
                const kFantasia = findKey('nome fantasia') || findKey('fantasia') || findKey('cliente');
                const kRede = findKey('nome da rede') || findKey('rede');
                const kRazao = findKey('raz');
                const kCidade = findKey('cidade');
                const kEmissao = findKey('emiss');
                const kQtde = findKey('qtde');
                const kGross = findKey('gross') || findKey('valor');
                const kNet = findKey('net');
                const kNota = findKey('nota') || findKey('nf') || findKey('pedido');
                const kAno = findKey('ano');
                const kMes = findKey('mês') || findKey('mes');
                const kProd = findKey('produto');
                const kDesc = findKey('descri');
                const kSub = findKey('sub-grupo') || findKey('subgrupo') || findKey('sub grupo');
                const kClasse = findKey('classe produto') || findKey('classe') || findKey('divis');

                const parsed = [];
                rawJson.forEach(row => {
                    const rawGross = kGross ? row[kGross] : null;
                    const rawNet = kNet ? row[kNet] : null;
                    if ((rawGross === null || rawGross === undefined) && (rawNet === null || rawNet === undefined)) return;

                    let grossVal = 0;
                    if (rawGross !== null && rawGross !== undefined) {
                        try {
                            grossVal = parseFloat(String(rawGross).replace(',', '.'));
                        } catch(err) {
                            grossVal = Number(rawGross) || 0;
                        }
                    }

                    let netVal = 0;
                    if (rawNet !== null && rawNet !== undefined) {
                        try {
                            netVal = parseFloat(String(rawNet).replace(',', '.'));
                        } catch(err) {
                            netVal = Number(rawNet) || 0;
                        }
                    } else {
                        netVal = grossVal;
                    }

                    if (grossVal === 0 && netVal === 0) return;

                    const cleanC = kCnpj ? cleanDigits(row[kCnpj]).padStart(14, '0') : '';

                    // Data emissão
                    let emissStr = '';
                    const rawEmiss = kEmissao ? row[kEmissao] : null;
                    if (rawEmiss) {
                        if (typeof rawEmiss === 'number') {
                            const dObj = new Date(Math.round((rawEmiss - 25569) * 86400 * 1000));
                            emissStr = `${dObj.getDate().toString().padStart(2,'0')}/${(dObj.getMonth()+1).toString().padStart(2,'0')}/${dObj.getFullYear()}`;
                        } else {
                            emissStr = rawEmiss.toString().slice(0, 10);
                        }
                    }

                    parsed.push({
                        cli: (kClifor && row[kClifor]) ? String(row[kClifor]).trim() : '',
                        c: cleanC,
                        f: (kFantasia && row[kFantasia]) ? String(row[kFantasia]).trim() : '',
                        r: (kRede && row[kRede]) ? String(row[kRede]).trim() : '',
                        z: (kRazao && row[kRazao]) ? String(row[kRazao]).trim() : '',
                        cid: (kCidade && row[kCidade]) ? String(row[kCidade]).trim() : '',
                        d: emissStr,
                        a: kAno && row[kAno] ? parseInt(row[kAno], 10) : 0,
                        m: kMes && row[kMes] ? parseInt(row[kMes], 10) : 0,
                        p: (kProd && row[kProd]) ? String(row[kProd]).trim() : '',
                        desc: (kDesc && row[kDesc]) ? String(row[kDesc]).trim() : '',
                        sub: (kSub && row[kSub]) ? String(row[kSub]).trim() : '',
                        cl: (kClasse && row[kClasse]) ? String(row[kClasse]).trim() : '',
                        vg: Math.round(grossVal * 100) / 100,
                        vn: Math.round(netVal * 100) / 100,
                        v: Math.round(grossVal * 100) / 100,
                        q: (kQtde && row[kQtde]) ? (parseInt(row[kQtde], 10) || 0) : 0,
                        nf: (kNota && row[kNota]) ? String(row[kNota]).trim() : ''
                    });
                });

                if (parsed.length === 0) {
                    window.showNotification('Nenhum registro de faturamento válido encontrado.', 'error');
                    return;
                }

                billingMasterData = parsed;
                localStorage.setItem('empresa_billing_new_era_custom', JSON.stringify(parsed));

                // Sincronizar Firestore se disponível
                if (window.db) {
                    try {
                        await window.db.collection('settings').doc('billing_new_era').set({
                            list: parsed,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                            updatedBy: localStorage.getItem('empresa_auth_user') || 'Usuário'
                        });
                    } catch(dbErr) {
                        console.warn('Erro ao salvar no Firestore:', dbErr);
                    }
                }

                populateAllIndCMS(false);
                applyIndicatorsFilter();

                window.showNotification(`Sucesso! ${parsed.length} faturamentos carregados!`, 'success');
                if (window.logUserAction) window.logUserAction(`importou nova planilha de faturamento (${parsed.length} itens)`);

                event.target.value = '';
            } catch (err) {
                console.error('Erro ao ler planilha de faturamento:', err);
                window.showNotification('Erro ao processar planilha: ' + err.message, 'error');
                event.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    window.exportIndicatorsSummaryToExcel = function() {
        if (!window.XLSX) {
            window.showNotification('Biblioteca Excel não disponível.', 'error');
            return;
        }

        try {
            const clientsMap = buildClientsMap();
            const metricVal = document.getElementById('filter-ind-metric')?.value || 'gross';
            const metricHeader = metricVal === 'net' ? 'Valor Considerado (Líquido)' : 'Valor Considerado (Bruto)';
            const exportRows = billingFilteredData.map(item => {
                const clientMatch = resolveClientForItem(item, clientsMap);
                const cnpj = item.c || (clientMatch && clientMatch['CNPJ']) || '';
                return {
                    'Código CLIFOR': item.cli || '',
                    'CNPJ': cnpj ? formatCNPJMask(cnpj) : '',
                    'Nome Fantasia': (clientMatch && (clientMatch['FANTASIA'] || clientMatch['NOME FANTASIA'])) || item.f || '',
                    'Razão Social': (clientMatch && (clientMatch['RAZAO SOCIAL'] || clientMatch['RAZÃO SOCIAL'])) || item.z || '',
                    'Grupo Real': (clientMatch && (clientMatch['GRUPO REAL'] || clientMatch['GRUPO'])) || item.gr || '',
                    'Grupo': (clientMatch && clientMatch['GRUPO']) || item.g || '',
                    'Rede': item.r || '',
                    'Data Emissão': item.d || '',
                    'Nota Fiscal': item.nf || '',
                    'Referência Produto': item.p || '',
                    'Descrição': item.desc || '',
                    'Sub-Grupo': item.sub || '',
                    'Classe Produto': item.cl || '',
                    [metricHeader]: item.v || 0,
                    'Valor Gross (Bruto R$)': item.vg !== undefined ? item.vg : item.v,
                    'Valor Net (Líquido R$)': item.vn !== undefined ? item.vn : item.v,
                    'Quantidade': item.q || 0
                };
            });

            const ws = XLSX.utils.json_to_sheet(exportRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'FATURAMENTO');

            const now = new Date();
            const dateStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}`;
            XLSX.writeFile(wb, `INDICADORES_NEW_ERA_${dateStr}.xlsx`);

            window.showNotification('Relatório exportado com sucesso!', 'success');
            if (window.logUserAction) window.logUserAction('exportou relatório de indicadores para Excel');
        } catch (err) {
            console.error('Erro na exportação:', err);
            window.showNotification('Erro ao exportar relatório.', 'error');
        }
    };

    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return str.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

})();
