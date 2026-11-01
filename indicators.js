// indicators.js - Dashboard de Indicadores Comerciais (Power BI Style)
// Sistema KR Gestão de Marcas

(function() {
    'use strict';

    let billingMasterData = [];
    let billingFilteredData = [];
    let activeBrand = 'NEW ERA';
    let availableYears = [];
    let rankingDisplayLimit = 10;
    let currentDatasetType = localStorage.getItem('empresa_indicators_dataset_type') || 'extrato';
    let currentKpiDisplayMode = localStorage.getItem('empresa_indicators_kpi_mode') || 'both';
    if (!['both', 'values', 'pieces'].includes(currentKpiDisplayMode)) {
        currentKpiDisplayMode = 'both';
    }

    // Variáveis e instâncias do Confronto (A Entregar X Faturamento)
    let chartCompMonthlyInstance = null;
    let chartCompDailyInstance = null;
    let chartCompClassesInstance = null;
    let currentCompSubTab = 'cnpj';
    let currentCompSort = 'total_desc';
    let currentCompSearch = '';
    let compChartDisplayMode = 'values';
    let currentCompCnpjList = [];
    let currentCompMonthList = [];
    let currentCompDateList = [];
    let compExpandedCnpjs = new Set();
    let lastCompFilteredBilling = [];
    let lastCompFilteredExtrato = [];
    let currentCompProductList = [];
    let currentCompProductSearch = '';
    let currentCompProductSort = 'total_desc';
    let compProductSortCol = 'totalV';
    let compProductSortDir = 'desc';
    let compRankingDisplayLimit = 10;
    let compProductGroupMode = localStorage.getItem('empresa_comp_product_group_mode') || 'sku';

    window.setCompProductGroupMode = function(mode) {
        if (!['ref', 'sku'].includes(mode)) mode = 'sku';
        compProductGroupMode = mode;
        try { localStorage.setItem('empresa_comp_product_group_mode', mode); } catch(e) {}

        document.querySelectorAll('.btn-product-mode-pill').forEach(btn => {
            const isTarget = (btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf("'" + mode + "'") !== -1) || btn.id.indexOf(mode) !== -1;
            btn.classList.toggle('active', isTarget);
        });

        buildCompProductList(lastCompFilteredBilling, lastCompFilteredExtrato);
    };

    // Estado de Ordenação e Agrupamento das Tabelas de Confronto
    let compDateSortCol = 'date';
    let compDateSortDir = 'asc'; // 'asc' (crescente do mês/data) ou 'desc'
    let compDateGroupByMonth = true; // Por padrão agrupa pelo mês
    let compDateCollapsedMonths = new Set();
    let compMonthSortCol = 'key';
    let compMonthSortDir = 'asc'; // 'asc' (crescente do mês)
    let compCnpjSortCol = 'totalV';
    let compCnpjSortDir = 'desc';

    function getExtratoData() {
        const savedCustom = localStorage.getItem('empresa_extrato_new_era_custom');
        let parsed = null;
        if (savedCustom) {
            try { parsed = JSON.parse(savedCustom); } catch(e) {}
        }
        return (parsed && Array.isArray(parsed) && parsed.length > 0)
            ? parsed
            : (window.INITIAL_EXTRATO_PEDIDOS_NEW_ERA && Array.isArray(window.INITIAL_EXTRATO_PEDIDOS_NEW_ERA) ? [...window.INITIAL_EXTRATO_PEDIDOS_NEW_ERA] : []);
    }

    function getBillingData() {
        const savedCustom = localStorage.getItem('empresa_billing_new_era_custom');
        let parsed = null;
        if (savedCustom) {
            try {
                parsed = JSON.parse(savedCustom);
                if (Array.isArray(parsed) && parsed.length > 0 && !parsed[0].mod) {
                    localStorage.removeItem('empresa_billing_new_era_custom');
                    parsed = null;
                }
            } catch(e) {}
        }
        return (parsed && Array.isArray(parsed) && parsed.length > 0)
            ? parsed
            : (window.INITIAL_BILLING_NEW_ERA && Array.isArray(window.INITIAL_BILLING_NEW_ERA) ? [...window.INITIAL_BILLING_NEW_ERA] : []);
    }

    window.switchIndicatorsDataset = function(type) {
        if (!['billing', 'extrato', 'comparison'].includes(type)) type = 'extrato';
        currentDatasetType = type;
        localStorage.setItem('empresa_indicators_dataset_type', type);

        // Atualizar estado visual dos botões de seleção de dataset
        const btnExtrato = document.getElementById('btn-dataset-extrato');
        const btnBilling = document.getElementById('btn-dataset-billing');
        const btnComp = document.getElementById('btn-dataset-comparison');
        if (btnExtrato) {
            btnExtrato.style.background = type === 'extrato' ? 'var(--accent-color, #3b82f6)' : 'transparent';
            btnExtrato.style.color = type === 'extrato' ? '#ffffff' : 'var(--text-secondary)';
        }
        if (btnBilling) {
            btnBilling.style.background = type === 'billing' ? 'var(--accent-color, #3b82f6)' : 'transparent';
            btnBilling.style.color = type === 'billing' ? '#ffffff' : 'var(--text-secondary)';
        }
        if (btnComp) {
            btnComp.style.background = type === 'comparison' ? 'var(--accent-color, #3b82f6)' : 'transparent';
            btnComp.style.color = type === 'comparison' ? '#ffffff' : 'var(--text-secondary)';
        }

        // Alternar visibilidade das seções do dashboard
        const indChartsSec = document.getElementById('indicators-charts-section');
        const indRankSec = document.getElementById('indicators-rankings-section');
        const indAuditSec = document.getElementById('indicators-audit-section');
        const compChartsSec = document.getElementById('comparison-charts-section');
        const compTablesSec = document.getElementById('comparison-tables-section');
        const compProdSec = document.getElementById('comparison-products-section');

        if (type === 'comparison') {
            if (indChartsSec) indChartsSec.style.display = 'none';
            if (indRankSec) indRankSec.style.display = 'none';
            if (indAuditSec) indAuditSec.style.display = 'none';
            if (compChartsSec) compChartsSec.style.display = 'grid';
            if (compTablesSec) compTablesSec.style.display = 'block';
            if (compProdSec) compProdSec.style.display = 'block';
            billingMasterData = [...getBillingData(), ...getExtratoData()];
        } else {
            if (indChartsSec) indChartsSec.style.display = 'grid';
            if (indRankSec) indRankSec.style.display = 'block';
            if (compChartsSec) compChartsSec.style.display = 'none';
            if (compTablesSec) compTablesSec.style.display = 'none';
            if (compProdSec) compProdSec.style.display = 'none';

            if (type === 'extrato') {
                billingMasterData = getExtratoData();
            } else {
                billingMasterData = getBillingData();
            }
        }

        computeLatestReportDate();
        const def = getDefaultPeriod();
        const startInput = document.getElementById('filter-ind-start-date');
        const endInput = document.getElementById('filter-ind-end-date');
        if (startInput) startInput.value = def.start;
        if (endInput) endInput.value = def.end;

        const semList = document.getElementById('ind-cms-semester-list');
        if (semList) {
            semList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = true;
            });
            updateIndCMSLabel('semester');
        }

        populateAllIndCMS(false);
        applyIndicatorsFilter();
    };

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

        applyIndicatorsFilter();
    };

    let latestReportDate = '08/10/2026';

    function computeLatestReportDate() {
        if (currentDatasetType === 'comparison') {
            const extDate = localStorage.getItem('empresa_extrato_last_updated') || window.EXTRATO_LAST_UPDATED || '08/10/2026';
            const billDate = localStorage.getItem('empresa_billing_last_updated') || window.BILLING_LAST_UPDATED || '31/10/2026';
            latestReportDate = `${extDate} / ${billDate}`;
        } else if (currentDatasetType === 'extrato') {
            const saved = localStorage.getItem('empresa_extrato_last_updated');
            latestReportDate = saved || window.EXTRATO_LAST_UPDATED || '08/10/2026';
        } else {
            const saved = localStorage.getItem('empresa_billing_last_updated');
            latestReportDate = saved || window.BILLING_LAST_UPDATED || '31/10/2026';
        }
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
    let chartCommercialGroupInstance = null;
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
        // Ano completo como período padrão
        return { curYear, curSemester: 'all', start: `${curYear}-01-01`, end: `${curYear}-12-31` };
    }

    // Inicialização do Módulo de Indicadores
    
    // --------------------------------------------------------------------------
    // DRAG AND DROP & ORDEM PERSONALIZADA DOS CARDS DE KPIS
    // --------------------------------------------------------------------------
    const DEFAULT_KPI_ORDER = [
        'kpi-card-total',
        'kpi-card-pieces',
        'kpi-card-orders',
        'kpi-card-ticket',
        'kpi-card-clients',
        'kpi-card-groups',
        'kpi-card-month',
        'kpi-card-day'
    ];

    window.applyKpiCardsOrder = function() {
        const grid = document.querySelector('.indicators-kpis-grid');
        if (!grid) return;

        let savedOrder = null;
        try {
            const raw = localStorage.getItem('empresa_indicators_kpi_order');
            if (raw) savedOrder = JSON.parse(raw);
        } catch(e) {}

        const order = (Array.isArray(savedOrder) && savedOrder.length > 0) ? savedOrder : DEFAULT_KPI_ORDER;

        order.forEach(cardId => {
            const card = document.getElementById(cardId);
            if (card && card.parentElement === grid) {
                grid.appendChild(card);
            }
        });
    };

    window.resetKpiCardsOrder = function() {
        localStorage.removeItem('empresa_indicators_kpi_order');
        window.applyKpiCardsOrder();
        if (window.showNotification) {
            window.showNotification('Posição dos cards restaurada para o padrão!', 'info');
        }
    };

    let draggedKpiCard = null;

    function setupKpiCardsDragAndDrop() {
        const grid = document.querySelector('.indicators-kpis-grid');
        if (!grid) return;

        const cards = grid.querySelectorAll('.kpi-card');
        cards.forEach(card => {
            card.setAttribute('draggable', 'true');

            const header = card.querySelector('.kpi-header');
            if (header && !header.querySelector('.kpi-drag-handle')) {
                const handle = document.createElement('div');
                handle.className = 'kpi-drag-handle';
                handle.title = 'Clique e arraste para reposicionar este card';
                handle.innerHTML = `<i class='bx bx-dots-vertical-rounded'></i>`;
                header.insertBefore(handle, header.firstChild);
            }

            card.ondragstart = function(e) {
                draggedKpiCard = this;
                this.classList.add('kpi-dragging');
                e.dataTransfer.effectAllowed = 'move';
                try { e.dataTransfer.setData('text/plain', this.id); } catch(err) {}
            };

            card.ondragover = function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (draggedKpiCard && this !== draggedKpiCard) {
                    this.classList.add('kpi-drag-over');
                }
            };

            card.ondragleave = function(e) {
                this.classList.remove('kpi-drag-over');
            };

            card.ondrop = function(e) {
                e.preventDefault();
                this.classList.remove('kpi-drag-over');
                if (!draggedKpiCard || this === draggedKpiCard) return;

                const parentGrid = this.parentElement;
                if (!parentGrid) return;

                const rect = this.getBoundingClientRect();
                const isAfter = (e.clientX > rect.left + rect.width / 2);

                if (isAfter) {
                    parentGrid.insertBefore(draggedKpiCard, this.nextSibling);
                } else {
                    parentGrid.insertBefore(draggedKpiCard, this);
                }

                const newOrder = Array.from(parentGrid.querySelectorAll('.kpi-card')).map(c => c.id);
                localStorage.setItem('empresa_indicators_kpi_order', JSON.stringify(newOrder));

                if (window.showNotification) {
                    window.showNotification('Posição dos cards salva!', 'success');
                }
            };

            card.ondragend = function(e) {
                this.classList.remove('kpi-dragging');
                grid.querySelectorAll('.kpi-card').forEach(c => {
                    c.classList.remove('kpi-drag-over', 'kpi-dragging');
                });
                draggedKpiCard = null;
            };
        });
    }

    window.initIndicatorsModule = function() {
        const CURRENT_BILLING_VERSION = '20261031_extrato_v1';
        const savedVersion = localStorage.getItem('empresa_billing_version');
        if (savedVersion !== CURRENT_BILLING_VERSION) {
            localStorage.setItem('empresa_billing_version', CURRENT_BILLING_VERSION);
        }

        currentDatasetType = localStorage.getItem('empresa_indicators_dataset_type') || 'extrato';

        // Atualizar estado visual dos botões de seleção de dataset
        const btnExtrato = document.getElementById('btn-dataset-extrato');
        const btnBilling = document.getElementById('btn-dataset-billing');
        const btnComp = document.getElementById('btn-dataset-comparison');
        if (btnExtrato) {
            btnExtrato.style.background = currentDatasetType === 'extrato' ? 'var(--accent-color, #3b82f6)' : 'transparent';
            btnExtrato.style.color = currentDatasetType === 'extrato' ? '#ffffff' : 'var(--text-secondary)';
        }
        if (btnBilling) {
            btnBilling.style.background = currentDatasetType === 'billing' ? 'var(--accent-color, #3b82f6)' : 'transparent';
            btnBilling.style.color = currentDatasetType === 'billing' ? '#ffffff' : 'var(--text-secondary)';
        }
        if (btnComp) {
            btnComp.style.background = currentDatasetType === 'comparison' ? 'var(--accent-color, #3b82f6)' : 'transparent';
            btnComp.style.color = currentDatasetType === 'comparison' ? '#ffffff' : 'var(--text-secondary)';
        }

        const indChartsSec = document.getElementById('indicators-charts-section');
        const indRankSec = document.getElementById('indicators-rankings-section');
        const indAuditSec = document.getElementById('indicators-audit-section');
        const compChartsSec = document.getElementById('comparison-charts-section');
        const compTablesSec = document.getElementById('comparison-tables-section');
        const compProdSec = document.getElementById('comparison-products-section');

        if (currentDatasetType === 'comparison') {
            if (indChartsSec) indChartsSec.style.display = 'none';
            if (indRankSec) indRankSec.style.display = 'none';
            if (indAuditSec) indAuditSec.style.display = 'none';
            if (compChartsSec) compChartsSec.style.display = 'grid';
            if (compTablesSec) compTablesSec.style.display = 'block';
            if (compProdSec) compProdSec.style.display = 'block';
        } else {
            if (indChartsSec) indChartsSec.style.display = 'grid';
            if (indRankSec) indRankSec.style.display = 'block';
            if (compChartsSec) compChartsSec.style.display = 'none';
            if (compTablesSec) compTablesSec.style.display = 'none';
            if (compProdSec) compProdSec.style.display = 'none';
        }

        try {
            if (currentDatasetType === 'comparison') {
                billingMasterData = [...getBillingData(), ...getExtratoData()];
            } else if (currentDatasetType === 'extrato') {
                billingMasterData = getExtratoData();
            } else {
                billingMasterData = getBillingData();
            }
        } catch (e) {
            console.error('Erro ao carregar dados de indicadores:', e);
            billingMasterData = window.INITIAL_EXTRATO_PEDIDOS_NEW_ERA || window.INITIAL_BILLING_NEW_ERA || [];
        }

        computeLatestReportDate();

        const def = getDefaultPeriod();
        const startInput = document.getElementById('filter-ind-start-date');
        const endInput = document.getElementById('filter-ind-end-date');
        if (startInput) startInput.value = def.start;
        if (endInput) endInput.value = def.end;

        populateAllIndCMS(true);
        window.applyKpiCardsOrder();
        setupKpiCardsDragAndDrop();

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
                        localStorage.setItem('empresa_billing_new_era_custom', JSON.stringify(remote));
                        if (doc.data().lastUpdated) {
                            localStorage.setItem('empresa_billing_last_updated', doc.data().lastUpdated);
                        }
                        if (currentDatasetType === 'billing') {
                            billingMasterData = remote;
                            computeLatestReportDate();
                            populateAllIndCMS(false);
                            if (sessionStorage.getItem('last_active_tab') === 'indicators') {
                                applyIndicatorsFilter();
                            }
                        }
                    }
                }
            });

            window.db.collection('settings').doc('extrato_new_era').onSnapshot((doc) => {
                if (doc.exists && doc.data().list && Array.isArray(doc.data().list)) {
                    const remote = doc.data().list;
                    if (remote.length > 0) {
                        localStorage.setItem('empresa_extrato_new_era_custom', JSON.stringify(remote));
                        if (doc.data().lastUpdated) {
                            localStorage.setItem('empresa_extrato_last_updated', doc.data().lastUpdated);
                        }
                        if (currentDatasetType === 'extrato') {
                            billingMasterData = remote;
                            computeLatestReportDate();
                            populateAllIndCMS(false);
                            if (sessionStorage.getItem('last_active_tab') === 'indicators') {
                                applyIndicatorsFilter();
                            }
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
        const cleanQ = cleanDigits(q);
        const options = list.querySelectorAll('.ind-cms-option');
        options.forEach(opt => {
            const text = opt.textContent.toLowerCase();
            const cnpjs = (opt.getAttribute('data-cnpjs') || '').toLowerCase();
            const cleanCnpjs = cleanDigits(cnpjs);

            let matches = false;
            if (!q) {
                matches = true;
            } else if (text.includes(q)) {
                matches = true;
            } else if (cnpjs && cnpjs.includes(q)) {
                // Busca por CNPJ formatado com pontos, traços e barras
                matches = true;
            } else if (cleanQ && cleanCnpjs && cleanCnpjs.includes(cleanQ)) {
                // Busca por CNPJ digitando somente números
                matches = true;
            }

            opt.style.display = matches ? 'flex' : 'none';
        });
    };

    function syncDatesWithSelectedYears() {
        const selectedYears = getIndCMSSelectedValues('year');
        const startInput = document.getElementById('filter-ind-start-date');
        const endInput = document.getElementById('filter-ind-end-date');
        if (!startInput || !endInput) return;

        if (selectedYears.length > 0) {
            const yearNums = selectedYears.map(y => parseInt(y, 10)).filter(n => !isNaN(n));
            if (yearNums.length > 0) {
                const minYear = Math.min(...yearNums);
                const maxYear = Math.max(...yearNums);
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
                startInput.value = `${minYear}-${startMonthDay}`;
                endInput.value = `${maxYear}-${endMonthDay}`;
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
            // Ao selecionar ano(s), marca os dois semestres e expande para o ano todo
            const semList = document.getElementById('ind-cms-semester-list');
            if (semList) {
                semList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = true;
                });
                updateIndCMSLabel('semester');
            }
            syncDatesWithSelectedYears();
        } else if (dim === 'semester') {
            syncDatesWithSelectedYears();
        }
        applyIndicatorsFilter();
    };

    window.onIndCMSCheckboxChange = function(dim) {
        if (dim === 'year') {
            // Quando seleciona o ano (como 2027), deixa selecionado os 2 semestres e também o ano todo nas datas
            const semList = document.getElementById('ind-cms-semester-list');
            if (semList) {
                semList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = true;
                });
                updateIndCMSLabel('semester');
            }
            syncDatesWithSelectedYears();
        } else if (dim === 'semester') {
            syncDatesWithSelectedYears();
        }
        updateIndCMSLabel(dim);
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

        const isExtrato = (currentDatasetType === 'extrato');
        const defaultLabels = {
            'brand': 'Todas as Marcas',
            'year': 'Todos os Anos',
            'semester': 'Todos os Semestres',
            'client': 'Todos os Clientes',
            'group': 'Todos os Grupos',
            'group-real': 'Todos os Grupos Reais',
            'class': 'Todas as Divisões',
            'nf': isExtrato ? 'Todos os Pedidos' : 'Todas as NFs'
        };

        if (count === 0 || count === total) {
            labelEl.textContent = defaultLabels[dim] || 'Todos';
            labelEl.title = defaultLabels[dim] || 'Todos';
        } else if (count === 1) {
            const span = checkedCheckboxes[0].closest('label').querySelector('.ind-cms-option-label') || checkedCheckboxes[0].closest('label');
            const fullText = span.textContent.trim();
            labelEl.textContent = fullText;
            labelEl.title = fullText;
        } else {
            // Mais de 1 selecionado: exibe contagem limpa e elegante sem estourar o layout
            if (dim === 'client') {
                labelEl.innerHTML = `${count} lojas selecionadas <span class="ind-cms-badge">${count}</span>`;
            } else if (dim === 'nf') {
                const labelText = isExtrato ? `${count} pedidos` : `${count} NFs`;
                labelEl.innerHTML = `${labelText} <span class="ind-cms-badge">${count}</span>`;
            } else if (dim === 'year') {
                const yearVals = Array.from(checkedCheckboxes).map(c => c.value).sort();
                labelEl.textContent = yearVals.join(', ');
            } else if (dim === 'semester') {
                labelEl.textContent = 'Todos os Semestres';
            } else if (dim === 'group' || dim === 'group-real') {
                labelEl.innerHTML = `${count} grupos <span class="ind-cms-badge">${count}</span>`;
            } else if (dim === 'class') {
                labelEl.innerHTML = `${count} divisões <span class="ind-cms-badge">${count}</span>`;
            } else {
                labelEl.innerHTML = `${defaultLabels[dim] || 'Filtro'} <span class="ind-cms-badge">${count}</span>`;
            }
            labelEl.title = `${count} itens selecionados`;
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
        const semList = document.getElementById('ind-cms-semester-list');
        if (semList && isInitial) {
            semList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = true;
            });
        }
        updateIndCMSLabel('semester');

        // 3. MARCAS
        updateIndCMSLabel('brand');

        // 4. CLIENTES (Junção Fantasia - Razão Social com indexação de CNPJ para busca)
        const clientList = document.getElementById('ind-cms-client-list');
        if (clientList) {
            const clientInfoMap = new Map();
            const baseClients = getActiveClientsList();

            baseClients.forEach(c => {
                const fant = (c['FANTASIA'] || c['NOME FANTASIA'] || '').toString().trim();
                const raz = (c['RAZAO SOCIAL'] || c['RAZÃO SOCIAL'] || '').toString().trim();
                let comb = '';
                if (fant && raz && fant.toUpperCase() !== raz.toUpperCase()) {
                    comb = `${fant} - ${raz}`;
                } else {
                    comb = fant || raz;
                }
                if (!comb) return;

                if (!clientInfoMap.has(comb)) {
                    clientInfoMap.set(comb, { name: comb, cnpjs: new Set() });
                }
                const rawCnpj = (c['CNPJ'] || '').toString();
                const cleanC = cleanDigits(rawCnpj);
                if (cleanC) {
                    clientInfoMap.get(comb).cnpjs.add(cleanC);
                    clientInfoMap.get(comb).cnpjs.add(formatCNPJMask(cleanC.padStart(14, '0')));
                }
            });

            billingMasterData.forEach(item => {
                const comb = getClientCombinedName(item, clientsMap);
                if (comb && comb !== 'Cliente sem cadastro') {
                    if (!clientInfoMap.has(comb)) {
                        clientInfoMap.set(comb, { name: comb, cnpjs: new Set() });
                    }
                    if (item.c) {
                        const cleanC = cleanDigits(item.c);
                        if (cleanC) {
                            clientInfoMap.get(comb).cnpjs.add(cleanC);
                            clientInfoMap.get(comb).cnpjs.add(formatCNPJMask(cleanC.padStart(14, '0')));
                        }
                    }
                    const clientMatch = resolveClientForItem(item, clientsMap);
                    if (clientMatch && clientMatch['CNPJ']) {
                        const cleanC = cleanDigits(clientMatch['CNPJ']);
                        if (cleanC) {
                            clientInfoMap.get(comb).cnpjs.add(cleanC);
                            clientInfoMap.get(comb).cnpjs.add(formatCNPJMask(cleanC.padStart(14, '0')));
                        }
                    }
                }
            });

            const sortedClients = Array.from(clientInfoMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
            let clientHtml = '';
            sortedClients.forEach(c => {
                const cnpjsStr = Array.from(c.cnpjs).join(' ');
                clientHtml += `
                    <label class="ind-cms-option" title="${escapeHTML(c.name)}" data-cnpjs="${escapeHTML(cnpjsStr)}">
                        <input type="checkbox" value="${escapeHTML(c.name)}" onchange="onIndCMSCheckboxChange('client')">
                        <span class="ind-cms-option-label">${escapeHTML(c.name)}</span>
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

        // 8. NOTA FISCAL / PEDIDO
        const nfList = document.getElementById('ind-cms-nf-list');
        if (nfList) {
            const isExtrato = (currentDatasetType === 'extrato');
            
            // Atualizar cabeçalho do filtro de NF/Pedido
            const nfFilterTitle = document.getElementById('ind-filter-nf-label-title');
            if (nfFilterTitle) {
                nfFilterTitle.textContent = isExtrato ? 'Pedido' : 'Nota Fiscal';
            }
            const nfSearchInput = document.querySelector('#ind-cms-nf-dropdown .ind-cms-search-input');
            if (nfSearchInput) {
                nfSearchInput.placeholder = isExtrato ? 'Pesquisar pedido...' : 'Pesquisar número de NF...';
            }

            const nfsSet = new Set();
            billingMasterData.forEach(item => {
                if (item.nf && item.nf.trim()) {
                    nfsSet.add(item.nf.trim());
                }
            });
            const sortedNfs = Array.from(nfsSet).sort((a, b) => b.localeCompare(a));
            let nfHtml = '';
            sortedNfs.forEach(nf => {
                const optText = isExtrato ? escapeHTML(nf) : `NF ${escapeHTML(nf)}`;
                nfHtml += `
                    <label class="ind-cms-option font-mono" title="${optText}">
                        <input type="checkbox" value="${escapeHTML(nf)}" onchange="onIndCMSCheckboxChange('nf')">
                        <span class="ind-cms-option-label">${optText}</span>
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

        // Reset Semestre: marca ambos os semestres
        const semList = document.getElementById('ind-cms-semester-list');
        if (semList) {
            semList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = true;
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
            const neCod = (c['NEW ERA'] || c['CODIGO NEW ERA'] || '').toString().trim();
            if (neCod && neCod !== '-' && neCod !== 'None') {
                map.set(`NE_${neCod}`, c);
                const cleanNe = cleanDigits(neCod);
                if (cleanNe) map.set(`NE_${cleanNe}`, c);
            }
            const arezzoCod = (c['VANS'] || c['CODIGO AREZZO'] || '').toString().trim();
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
        const isComp = (currentDatasetType === 'comparison');
        const indChartsSec = document.getElementById('indicators-charts-section');
        const indRankSec = document.getElementById('indicators-rankings-section');
        const indAuditSec = document.getElementById('indicators-audit-section');
        const compChartsSec = document.getElementById('comparison-charts-section');
        const compTablesSec = document.getElementById('comparison-tables-section');
        const compProdSec = document.getElementById('comparison-products-section');

        if (indChartsSec) indChartsSec.style.display = isComp ? 'none' : 'grid';
        if (indRankSec) indRankSec.style.display = isComp ? 'none' : 'block';
        if (indAuditSec && isComp) indAuditSec.style.display = 'none';
        if (compChartsSec) compChartsSec.style.display = isComp ? 'grid' : 'none';
        if (compTablesSec) compTablesSec.style.display = isComp ? 'block' : 'none';
        if (compProdSec) compProdSec.style.display = isComp ? 'block' : 'none';
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

        function runItemFilter(item) {
            const itemGross = item.vg !== undefined ? item.vg : (item.v || 0);
            const itemNet = item.vn !== undefined ? item.vn : (item.v || 0);
            item.v = (metricVal === 'net') ? itemNet : itemGross;

            const dObj = parseDateBR(item.d);
            if (dObj) {
                const itemYear = dObj.getFullYear().toString();
                const itemMonth = dObj.getMonth() + 1;
                const itemSemester = itemMonth <= 6 ? '1' : '2';

                if (startObj && dObj < startObj) return false;
                if (endObj && dObj > endObj) return false;

                if (selectedYears.length > 0 && !selectedYears.includes(itemYear)) return false;
                if (selectedSemesters.length > 0 && !selectedSemesters.includes(itemSemester)) return false;
            } else if (selectedYears.length > 0 || startDateVal || endDateVal) {
                return false;
            }

            if (selectedBrands.length > 0 && !selectedBrands.includes('NEW ERA')) return false;

            const clientMatch = resolveClientForItem(item, clientsMap);
            const itemCombined = getClientCombinedName(item, clientsMap);

            if (selectedClients.length > 0 && !selectedClients.includes(itemCombined)) return false;

            const itemGrupo = (clientMatch && clientMatch['GRUPO']) ? clientMatch['GRUPO'].trim() : (item.g || item.r || 'Outros');
            if (selectedGroups.length > 0 && !selectedGroups.includes(itemGrupo)) return false;

            const itemGrupoReal = (clientMatch && (clientMatch['GRUPO REAL'] || clientMatch['GRUPO'])) 
                ? (clientMatch['GRUPO REAL'] || clientMatch['GRUPO']).trim() 
                : (item.gr || item.g || item.r || 'Outros');
            if (selectedGroupReals.length > 0 && !selectedGroupReals.includes(itemGrupoReal)) return false;

            const itemClass = (item.cl || 'Outros').trim();
            if (selectedClasses.length > 0 && !selectedClasses.includes(itemClass)) return false;

            const itemNf = (item.nf || '').trim();
            if (selectedNFs.length > 0 && !selectedNFs.includes(itemNf)) return false;

            return true;
        }

        const subtitleEl = document.getElementById('indicators-subtitle');
        const metricLabel = metricVal === 'net' ? 'Valor Líquido (Net)' : 'Valor Bruto (Gross)';

        if (currentDatasetType === 'comparison') {
            const rawBilling = getBillingData();
            const rawExtrato = getExtratoData();
            const bFiltered = rawBilling.filter(runItemFilter);
            const eFiltered = rawExtrato.filter(runItemFilter);

            lastCompFilteredBilling = bFiltered;
            lastCompFilteredExtrato = eFiltered;
            billingFilteredData = [...bFiltered, ...eFiltered];

            if (subtitleEl) {
                subtitleEl.innerHTML = `Confronto Comercial: Pedidos a Entregar vs Faturamento Realizado (${metricLabel}) &mdash; NEW ERA &nbsp;&bull;&nbsp; Base: CNPJ, Data e Mês &nbsp;&bull;&nbsp; Atualizado em: ${latestReportDate}`;
            }

            updateComparisonKpis(bFiltered, eFiltered, clientsMap, metricVal);
            renderComparisonCharts(bFiltered, eFiltered, clientsMap);
            renderComparisonConfrontation(bFiltered, eFiltered, clientsMap);
            window.applyKpiCardsOrder();
            setupKpiCardsDragAndDrop();
            return;
    
        }

        billingFilteredData = billingMasterData.filter(runItemFilter);

        // Atualizar subtítulo com indicação da métrica e data do último relatório atualizado
        if (subtitleEl) {
            if (currentDatasetType === 'extrato') {
                subtitleEl.innerHTML = `Extrato de Pedidos a Entregar (${metricLabel}) &mdash; NEW ERA &nbsp;&bull;&nbsp; Base: <strong>Data Entrega</strong> &nbsp;&bull;&nbsp; Atualizado em: ${latestReportDate}`;
            } else {
                subtitleEl.innerHTML = `Análise estratégica de vendas (${metricLabel}) &mdash; NEW ERA &nbsp;&bull;&nbsp; Atualizado em: ${latestReportDate}`;
            }
        }

        // Atualizar todas as seções do dashboard
        updateKpiCards(billingFilteredData, clientsMap, metricVal);
        renderCharts(billingFilteredData, clientsMap);
        renderRankings(billingFilteredData, clientsMap);
        renderAuditSection(billingFilteredData, clientsMap);
        window.applyKpiCardsOrder();
        setupKpiCardsDragAndDrop();
    };

    // --------------------------------------------------------------------------
    // 1. CARDS DE INDICADORES (KPIS)
    // --------------------------------------------------------------------------
    function adjustKpiTextFit() {
        const kpiValues = document.querySelectorAll('.indicators-kpis-grid .kpi-value');
        kpiValues.forEach(el => {
            const len = (el.textContent || '').trim().length;
            if (len >= 16) {
                el.classList.add('kpi-val-extra-long');
                el.classList.remove('kpi-val-long');
            } else if (len >= 13) {
                el.classList.add('kpi-val-long');
                el.classList.remove('kpi-val-extra-long');
            } else {
                el.classList.remove('kpi-val-long', 'kpi-val-extra-long');
            }
        });
    }

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

        const isExtrato = (currentDatasetType === 'extrato');
        const isPiecesOnly = (currentKpiDisplayMode === 'pieces');
        const isBoth = (currentKpiDisplayMode === 'both');

        // Contagem de pedidos únicos (número de pedidos na carteira)
        const uniqueOrdersSet = new Set();
        data.forEach(item => {
            if (item.nf) uniqueOrdersSet.add(item.nf);
        });
        const uniqueOrdersCount = uniqueOrdersSet.size || totalOrders;

        // Alternar visibilidade dos cards conforme o modo (Extrato/Booking vs Faturamento)
        const cardMonth = document.getElementById('kpi-card-month');
        const cardDay = document.getElementById('kpi-card-day');
        const cardPieces = document.getElementById('kpi-card-pieces');
        const cardOrders = document.getElementById('kpi-card-orders');

        if (cardMonth) cardMonth.style.display = isExtrato ? 'none' : '';
        if (cardDay) cardDay.style.display = isExtrato ? 'none' : '';
        if (cardPieces) {
            cardPieces.style.display = isExtrato ? '' : 'none';
            cardPieces.classList.remove('highlight-emerald', 'highlight-accent');
            cardPieces.classList.add('highlight-blue');
        }
        const cardTotKpi = document.getElementById('kpi-card-total');
        if (cardTotKpi) {
            if (isExtrato) {
                cardTotKpi.classList.remove('highlight-emerald', 'highlight-accent');
                cardTotKpi.classList.add('highlight-blue');
            } else {
                cardTotKpi.classList.remove('highlight-blue', 'highlight-accent');
                cardTotKpi.classList.add('highlight-emerald');
            }
        }
        if (cardOrders) cardOrders.style.display = isExtrato ? '' : 'none';

        // KPI 1: Booking Total / Faturamento Total
        const elTotalTitle = document.getElementById('kpi-total-title');
        const elTotalRev = document.getElementById('kpi-total-revenue');
        const elTotalSub = document.getElementById('kpi-total-sub');
        const elTotalOrders = document.getElementById('kpi-total-orders');

        if (elTotalTitle) {
            if (isExtrato) {
                elTotalTitle.textContent = isPiecesOnly ? 'Peças em Booking' : 'Booking Total';
            } else {
                elTotalTitle.textContent = isPiecesOnly ? 'Peças Faturadas' : 'Faturamento Total';
            }
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
            elTotalOrders.textContent = isExtrato
                ? `${numberFormatter.format(totalOrders)} itens em carteira`
                : `${numberFormatter.format(totalOrders)} lançamentos / notas`;
        }

        // Cards de Booking: Peças a Entregar e Pedidos em Carteira
        const elPiecesVal = document.getElementById('kpi-total-pieces-val');
        if (elPiecesVal) elPiecesVal.textContent = `${numberFormatter.format(totalPieces)} pçs`;
        const elOrdersVal = document.getElementById('kpi-unique-orders-val');
        if (elOrdersVal) elOrdersVal.textContent = numberFormatter.format(uniqueOrdersCount);

        // Se estiver em modo Faturamento, atualiza os KPIs mensais e diários
        if (!isExtrato) {
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
        }

        // KPI 4: Clientes Booking / Faturados
        const totalClients = activeClientsSet.size;
        const elClientsTitle = document.getElementById('kpi-clients-title');
        const elActiveClients = document.getElementById('kpi-active-clients');
        const elClientsCoverage = document.getElementById('kpi-clients-coverage');
        if (elClientsTitle) elClientsTitle.textContent = isExtrato ? 'Clientes Booking' : 'Clientes Faturados';
        if (elActiveClients) elActiveClients.textContent = numberFormatter.format(totalClients);
        if (elClientsCoverage) elClientsCoverage.textContent = isExtrato ? 'lojas com pedidos em carteira' : 'lojas com compras ativas';

        // KPI 5: Redes / Grupos
        const totalGroups = activeGroupsSet.size;
        const elGroupsTitle = document.getElementById('kpi-groups-title');
        const elActiveGroups = document.getElementById('kpi-active-groups');
        const elGroupsCoverage = document.getElementById('kpi-groups-coverage');
        if (elGroupsTitle) elGroupsTitle.textContent = 'Redes / Grupos';
        if (elActiveGroups) elActiveGroups.textContent = numberFormatter.format(totalGroups);
        if (elGroupsCoverage) elGroupsCoverage.textContent = isExtrato ? 'redes com pedidos programados' : 'redes corporativas';

        // KPI 6: Ticket Médio / Média de Peças
        const avgTicket = totalClients > 0 ? (totalRevenue / totalClients) : 0;
        const avgPieces = totalClients > 0 ? (totalPieces / totalClients) : 0;
        const elTicketTitle = document.getElementById('kpi-ticket-title');
        const elAvgTicket = document.getElementById('kpi-avg-ticket');
        const elTicketSub = document.getElementById('kpi-ticket-sub');
        const elTicketFooter = document.getElementById('kpi-ticket-footer');

        if (elTicketTitle) {
            if (isExtrato) {
                elTicketTitle.textContent = isPiecesOnly ? 'Média Peças / Cli' : 'Ticket Médio Booking';
            } else {
                elTicketTitle.textContent = isPiecesOnly ? 'Média Peças / Cli' : 'Ticket Médio';
            }
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
            if (isExtrato) {
                elTicketFooter.textContent = isPiecesOnly ? 'peças por cliente booking' : 'por cliente booking';
            } else {
                elTicketFooter.textContent = isPiecesOnly ? 'peças por cliente faturado' : 'por cliente faturado';
            }
        }

        adjustKpiTextFit();
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
    
        }

        const selectedYears = getIndCMSSelectedValues('year');
        const isExtrato = (currentDatasetType === 'extrato');

        // Atualizar títulos dos gráficos e seções conforme o modo (Extrato/Booking vs Faturamento)
        const elDailyTitle = document.getElementById('chart-daily-title-text');
        const elDailySub = document.getElementById('chart-daily-subtitle');
        if (elDailyTitle) elDailyTitle.textContent = isExtrato ? 'Planejamento Diário de Booking' : 'Evolução Diária do Faturamento';
        if (elDailySub) elDailySub.textContent = isExtrato ? 'Entregas programadas por dia com curva de tendência e pontos interativos' : 'Faturamento por dia com curva de tendência e pontos interativos';

        const elMonthlyTitle = document.getElementById('chart-monthly-title-text');
        const elMonthlySub = document.getElementById('chart-monthly-subtitle');
        if (elMonthlyTitle) elMonthlyTitle.textContent = isExtrato ? 'Planejamento Mensal' : 'Faturamento Mensal';
        if (elMonthlySub) elMonthlySub.textContent = isExtrato ? 'Previsão e comparativo de entregas programadas por mês (Booking)' : 'Comparativo de vendas por mês';

        const elGroupTitle = document.getElementById('chart-group-title-text');
        const elGroupSub = document.getElementById('chart-group-subtitle');
        if (elGroupTitle) elGroupTitle.textContent = isExtrato ? 'Planejamento por Grupo Real' : 'Faturamento por Grupo Real';
        if (elGroupSub) elGroupSub.textContent = isExtrato ? 'Distribuição do booking entre os principais grupos econômicos' : 'Distribuição entre os principais grupos econômicos';

        const elCommercialGroupTitle = document.getElementById('chart-commercial-group-title-text');
        const elCommercialGroupSub = document.getElementById('chart-commercial-group-subtitle');
        if (elCommercialGroupTitle) elCommercialGroupTitle.textContent = isExtrato ? 'Planejamento por Grupo' : 'Faturamento por Grupo';
        if (elCommercialGroupSub) elCommercialGroupSub.textContent = isExtrato ? 'Distribuição do booking por grupo comercial e bandeira' : 'Distribuição entre os grupos comerciais e bandeiras';

        const elCompMonthly = document.getElementById('comp-label-monthly');
        const elCompGroupReal = document.getElementById('comp-label-group-real');
        if (elCompMonthly) elCompMonthly.textContent = isExtrato ? 'Planejamento Mensal' : 'Faturamento Mensal';
        if (elCompGroupReal) elCompGroupReal.textContent = isExtrato ? 'Planejamento Grupo Real' : 'Grupo Real';

        const elRankingGeneralSub = document.getElementById('ranking-general-subtitle');
        if (elRankingGeneralSub) {
            elRankingGeneralSub.textContent = isExtrato 
                ? 'Maiores desempenhos em pedidos e planejamento de vendas no período' 
                : 'Maiores desempenhos em vendas no período selecionado';
        }
        const elRankingProductsSub = document.getElementById('ranking-products-subtitle');
        if (elRankingProductsSub) {
            elRankingProductsSub.textContent = isExtrato 
                ? 'Referências programadas, modelos, divisões e pedidos em carteira' 
                : 'Referências mais vendidas, modelos, divisões e maiores notas fiscais emitidas';
        }

        const elNfCardTitle = document.getElementById('ranking-nf-title-label');
        if (elNfCardTitle) elNfCardTitle.textContent = isExtrato ? 'Pedidos / Carteira' : 'Notas Fiscais';
        const elNfCardBadge = document.getElementById('ranking-nf-badge-label');
        if (elNfCardBadge) elNfCardBadge.textContent = isExtrato ? 'Booking' : 'Faturamento';

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

        // Gráfico 4: Faturamento por Grupo Comercial
        renderCommercialGroupChart(data, clientsMap);
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

        const isExtrato = (currentDatasetType === 'extrato');
        const countBadge = document.getElementById('chart-daily-count');
        if (countBadge) {
            countBadge.textContent = isExtrato ? `${sortedDays.length} datas programadas` : `${sortedDays.length} dias faturados`;
        }

        if (chartDailyInstance) {
            chartDailyInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        const dailyColor = isExtrato ? '#3b82f6' : '#10b981';
        const dailyRgb = isExtrato ? '59, 130, 246' : '16, 185, 129';
        gradient.addColorStop(0, `rgba(${dailyRgb}, 0.45)`);
        gradient.addColorStop(1, `rgba(${dailyRgb}, 0.02)`);

        chartDailyInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: isPiecesMode ? (isExtrato ? 'Volume Programado (Peças)' : 'Volume (Peças)') : (isExtrato ? 'Booking Programado (R$)' : 'Faturamento (R$)'),
                    data: values,
                    borderColor: dailyColor,
                    borderWidth: 2.5,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: dailyColor,
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
                                const prefix = isExtrato ? 'Booking: ' : 'Faturamento: ';
                                if (isPiecesMode) {
                                    return `Volume: ${numberFormatter.format(context.parsed.y)} pçs`;
                                } else if (isBoth) {
                                    const p = dailyPieces[dayKey] || 0;
                                    return `${prefix}${formatBRL(context.parsed.y)} (${numberFormatter.format(p)} pçs)`;
                                }
                                return `${prefix}${formatBRL(context.parsed.y)}`;
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

        const isExtrato = (currentDatasetType === 'extrato');
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
                    label: isPiecesMode ? (isExtrato ? 'Volume Mensal (Peças)' : 'Volume Mensal (Peças)') : (isExtrato ? 'Planejamento Mensal (R$)' : 'Faturamento Mensal (R$)'),
                    data: values,
                    backgroundColor: isExtrato ? 'rgba(59, 130, 246, 0.85)' : 'rgba(16, 185, 129, 0.85)',
                    hoverBackgroundColor: isExtrato ? '#3b82f6' : '#10b981',
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
                                const prefix = isExtrato ? 'Booking: ' : 'Faturamento: ';
                                if (isPiecesMode) {
                                    return `Volume: ${numberFormatter.format(context.parsed.y)} pçs`;
                                } else if (isBoth) {
                                    const p = monthlyPieces[mKey] || 0;
                                    return `${prefix}${formatBRL(context.parsed.y)} (${numberFormatter.format(p)} pçs)`;
                                }
                                return `${prefix}${formatBRL(context.parsed.y)}`;
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

        const isExtrato = (currentDatasetType === 'extrato');
        const ctx = canvas.getContext('2d');
        chartGroupInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: isPiecesMode ? 'Volume por Grupo (Peças)' : (isExtrato ? 'Planejamento por Grupo (R$)' : 'Faturamento por Grupo (R$)'),
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
                                const prefix = isExtrato ? 'Booking: ' : 'Faturamento: ';
                                if (isPiecesMode) {
                                    return `Volume: ${numberFormatter.format(context.parsed.x)} pçs`;
                                } else if (isBoth && groupPieces[gName] !== undefined) {
                                    return `${prefix}${formatBRL(context.parsed.x)} (${numberFormatter.format(groupPieces[gName])} pçs)`;
                                }
                                return `${prefix}${formatBRL(context.parsed.x)}`;
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

    function renderCommercialGroupChart(data, clientsMap) {
        const canvas = document.getElementById('chart-commercial-group-revenue');
        if (!canvas) return;

        const isPiecesMode = (currentKpiDisplayMode === 'pieces');
        const isBoth = (currentKpiDisplayMode === 'both');
        const groupVal = {};
        const groupPieces = {};

        data.forEach(item => {
            const clientMatch = resolveClientForItem(item, clientsMap);
            let grupo = (clientMatch && clientMatch['GRUPO']) 
                ? clientMatch['GRUPO'].trim() 
                : (item.g || item.r || 'Não Vinculado');

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

        if (chartCommercialGroupInstance) {
            chartCommercialGroupInstance.destroy();
        }

        const colors = [
            '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', 
            '#f59e0b', '#06b6d4', '#6366f1', '#64748b'
        ];

        const isExtrato = (currentDatasetType === 'extrato');
        const ctx = canvas.getContext('2d');
        chartCommercialGroupInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: isPiecesMode ? 'Volume por Grupo (Peças)' : (isExtrato ? 'Planejamento por Grupo (R$)' : 'Faturamento por Grupo (R$)'),
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
                                const prefix = isExtrato ? 'Booking: ' : 'Faturamento: ';
                                if (isPiecesMode) {
                                    return `Volume: ${numberFormatter.format(context.parsed.x)} pçs`;
                                } else if (isBoth && groupPieces[gName] !== undefined) {
                                    return `${prefix}${formatBRL(context.parsed.x)} (${numberFormatter.format(groupPieces[gName])} pçs)`;
                                }
                                return `${prefix}${formatBRL(context.parsed.x)}`;
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

    // Mapeamento de produtos com variantes conhecidas caso a planilha original não possua coluna COR
    const KNOWN_PRODUCT_COLORS = {
        '71042049': 'c013',
        '15169337': 'c002',
        'nev27bon117': 'c052'
    };

    // Helper para gerar URL da imagem do produto e lista de fallbacks exatos
    window.getProductImageUrls = function(productCode, colorVariant) {
        const cleanCode = (productCode || '').toString().trim().toLowerCase();
        let cleanColor = (colorVariant || '').toString().trim().toLowerCase();

        if (!cleanColor && cleanCode && KNOWN_PRODUCT_COLORS[cleanCode]) {
            cleanColor = KNOWN_PRODUCT_COLORS[cleanCode];
        }

        if (!cleanCode) {
            return { primaryUrl: '', fallbackUrl: '', fallbacks: [], hasColor: false };
        }

        const baseUrl = 'https://smarterappblob.blob.core.windows.net/public/1/image/padrao/';
        let primaryUrl = '';
        const fallbacks = [];

        if (cleanColor) {
            // Se tiver variante de cor: testa com cor e se não existir faz fallback para sem cor
            primaryUrl = `${baseUrl}${cleanCode}_${cleanColor}.webp`;
            fallbacks.push(`${baseUrl}${cleanCode}.webp`);
        } else {
            // Sem variante: testa o link exato do produto em minúsculo
            primaryUrl = `${baseUrl}${cleanCode}.webp`;
        }

        return {
            primaryUrl,
            fallbackUrl: fallbacks[0] || '',
            fallbacks,
            hasColor: !!cleanColor
        };
    };

    // Callback inteligente de erro com fila sequencial de fallbacks
    window.onRankingProductImgError = function(img) {
        let chain = [];
        const rawChain = img.getAttribute('data-fallbacks');
        if (rawChain) {
            chain = rawChain.split('|').map(s => s.trim()).filter(Boolean);
        } else {
            const single = img.getAttribute('data-fallback');
            if (single) chain.push(single);
        }

        if (chain.length > 0) {
            const nextUrl = chain.shift();
            img.setAttribute('data-fallbacks', chain.join('|'));
            img.src = nextUrl;
        } else {
            img.onerror = null;
            img.style.display = 'none';
            const placeholder = img.parentElement ? img.parentElement.querySelector('.ranking-product-thumb-placeholder') : null;
            if (placeholder) {
                placeholder.style.display = 'flex';
            }
        }
    };

    // Abrir modal de preview de imagem do produto
    window.openProductImageModal = function(code, color, name) {
        const modal = document.getElementById('product-image-modal');
        if (!modal) return;

        const titleEl = document.getElementById('pim-title');
        const subEl = document.getElementById('pim-subtitle');
        const imgEl = document.getElementById('pim-img');
        const placeholderEl = document.getElementById('pim-placeholder');
        const linkEl = document.getElementById('pim-external-link');

        if (titleEl) titleEl.textContent = name || code || 'Foto do Produto';
        
        const subParts = [];
        if (code) subParts.push(code);
        if (color) subParts.push(`Cor: ${color}`);
        if (subEl) subEl.textContent = subParts.join(' • ') || 'Produto New Era';

        const urls = getProductImageUrls(code, color);

        if (imgEl && placeholderEl) {
            if (urls.primaryUrl) {
                imgEl.style.display = 'block';
                placeholderEl.style.display = 'none';
                let modalFallbacks = [...(urls.fallbacks || [])];
                imgEl.onerror = function() {
                    if (modalFallbacks.length > 0) {
                        const next = modalFallbacks.shift();
                        imgEl.src = next;
                        if (linkEl) linkEl.href = next;
                    } else {
                        imgEl.onerror = null;
                        imgEl.style.display = 'none';
                        placeholderEl.style.display = 'flex';
                    }
                };
                imgEl.src = urls.primaryUrl;
                if (linkEl) {
                    linkEl.href = urls.primaryUrl;
                    linkEl.style.display = 'inline-flex';
                }
            } else {
                imgEl.style.display = 'none';
                placeholderEl.style.display = 'flex';
                if (linkEl) linkEl.style.display = 'none';
            }
        }

        modal.classList.remove('hidden');
    };

    // Renderizar thumbnail de produto na linha do ranking
    window.renderProductThumbHTML = function(item) {
        const urls = getProductImageUrls(item.code, item.cor);
        if (urls.primaryUrl) {
            const fallbacksAttr = urls.fallbacks && urls.fallbacks.length > 0 ? `data-fallbacks="${urls.fallbacks.join('|')}"` : '';
            return `
                <div class="ranking-product-thumb-container" onclick="openProductImageModal('${escapeHTML(item.code || '')}', '${escapeHTML(item.cor || '')}', '${escapeHTML(item.name || '')}')" title="Clique para ampliar foto">
                    <img 
                        class="ranking-product-thumb-img" 
                        src="${urls.primaryUrl}" 
                        alt="${escapeHTML(item.name || '')}" 
                        loading="lazy"
                        ${fallbacksAttr} 
                        onerror="onRankingProductImgError(this)"
                    />
                    <div class="ranking-product-thumb-placeholder" style="display: none;">
                        <i class='bx bx-image-alt'></i>
                    </div>
                </div>
            `;
        }
        return `
            <div class="ranking-product-thumb-container">
                <div class="ranking-product-thumb-placeholder" style="display: flex;">
                    <i class='bx bx-purchase-tag-alt'></i>
                </div>
            </div>
        `;
    };

    window.closeProductImageModal = function() {
        const modal = document.getElementById('product-image-modal');
        if (modal) modal.classList.add('hidden');
    };

    function renderRankingListHTML(items, totalRevenue, nameLabel, totalPieces = 0, isProduct = false) {
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

        let html = '';
        if (isProduct) {
            html += `
                <div class="ranking-table-col-header" style="display: flex; align-items: center; justify-content: space-between; padding: 0.35rem 0.5rem; font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 0.45rem;">
                    <div style="display: flex; align-items: center; gap: 0.45rem;">
                        <span style="width: 20px; text-align: center;">#</span>
                        <span style="width: 36px; text-align: center;">Foto</span>
                        <span>Produto / Referência</span>
                    </div>
                    <div style="text-align: right;">
                        <span>${isPiecesOnly ? 'Peças / %' : (isBoth ? `${(currentDatasetType === 'extrato' ? 'A Entregar' : 'Faturamento')} / Qtd / %` : `${(currentDatasetType === 'extrato' ? 'A Entregar' : 'Faturamento')} / %`)}</span>
                    </div>
                </div>
            `;
        }

        html += '<div class="ranking-items-list" style="max-height: 480px; overflow-y: auto; padding-right: 4px;">';
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
                            ${isProduct ? renderProductThumbHTML(item) : ''}
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
                        <div class="ranking-progress-fill ${(currentDatasetType === 'extrato' ? 'progress-extrato' : '')}" style="width: ${Math.min(pct * 2.5, 100)}%;"></div>
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
            const pCor = (item.cor || '').toString().trim().toLowerCase();
            const key = pCode || pDesc || 'Sem Referência';

            if (!prodTotals[key]) {
                prodTotals[key] = {
                    code: pCode,
                    desc: pDesc,
                    name: pDesc || pCode || 'Produto sem descrição',
                    colors: {},
                    q: 0,
                    v: 0
                };
            }
            prodTotals[key].v += (item.v || 0);
            prodTotals[key].q += (item.q || 0);
            if (pCor) {
                prodTotals[key].colors[pCor] = (prodTotals[key].colors[pCor] || 0) + (item.q || 1);
            }
        });

        const sorted = Object.values(prodTotals).sort((a, b) => {
            return currentKpiDisplayMode === 'pieces' ? (b.q - a.q) : (b.v - a.v);
        }).map(it => {
            const parts = [];
            let primaryCor = '';
            const colorEntries = Object.entries(it.colors || {});
            if (colorEntries.length > 0) {
                colorEntries.sort((a, b) => b[1] - a[1]);
                primaryCor = colorEntries[0][0];
            } else if (it.code && KNOWN_PRODUCT_COLORS[it.code]) {
                primaryCor = KNOWN_PRODUCT_COLORS[it.code];
            }
            it.cor = primaryCor;

            if (it.code) parts.push(it.code);
            if (it.cor) parts.push(`Cor: ${it.cor}`);
            it.sub = parts.join(' • ');
            return it;
        });

        container.innerHTML = renderRankingListHTML(sorted, totalRevenue, 'Produto', totalPieces, true);
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

        container.innerHTML = renderRankingListHTML(sorted, totalRevenue, 'Grupo Produto', totalPieces);
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

    // TOP NOTAS FISCAIS / PEDIDOS EM CARTEIRA
    function renderTopNFs(data, clientsMap, totalRevenue, totalPieces = 0) {
        const container = document.getElementById('ranking-nfs-container');
        if (!container) return;

        const isExtrato = (currentDatasetType === 'extrato');
        const defaultName = isExtrato ? 'Sem Número de Pedido' : 'Sem Número de NF';
        const prefixName = isExtrato ? 'Pedido ' : 'NF ';
        const titleTextEl = document.getElementById('ranking-nfs-title-text');
        const iconEl = document.getElementById('ranking-nfs-icon');
        const badgeEl = document.getElementById('ranking-nfs-badge');
        const prodSubEl = document.getElementById('products-ranking-subtitle');

        if (titleTextEl) {
            titleTextEl.textContent = isExtrato ? 'Pedidos' : 'Notas Fiscais';
        }
        if (iconEl) {
            iconEl.className = isExtrato ? 'bx bx-receipt' : 'bx bx-receipt';
        }
        if (badgeEl) {
            badgeEl.textContent = isExtrato ? 'A Entregar' : 'Faturamento';
            badgeEl.style.background = isExtrato ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)';
            badgeEl.style.color = isExtrato ? '#60a5fa' : '#34d399';
            badgeEl.style.borderColor = isExtrato ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)';
        }
        if (prodSubEl) {
            prodSubEl.textContent = isExtrato
                ? 'Referências mais vendidas, modelos, divisões e maiores pedidos em carteira'
                : 'Referências mais vendidas, modelos, divisões e maiores notas fiscais emitidas';
        }

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
                    name: nfNum ? `${prefixName}${nfNum}` : defaultName,
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
            if (it.fantasia && it.fantasia !== 'Cliente' && it.fantasia !== 'Cliente s/ Cadastro') parts.push(it.fantasia);
            it.sub = parts.join(' • ');
            return it;
        });

        const rankNameLabel = isExtrato ? 'Pedido' : 'Nota Fiscal';
        container.innerHTML = renderRankingListHTML(sorted, totalRevenue, rankNameLabel, totalPieces);
    }

    // --------------------------------------------------------------------------
    // 4. SEÇÃO DE AUDITORIA (CNPJs / CLIENTES NÃO VINCULADOS)
    // --------------------------------------------------------------------------
    function renderAuditSection(data, clientsMap) {
        const sectionEl = document.getElementById('indicators-audit-section');
        const countBadge = document.getElementById('audit-count-badge');
        const tableContainer = document.getElementById('audit-table-container');
        if (!sectionEl || !tableContainer) return;

        const isExtrato = (currentDatasetType === 'extrato');
        const captionEl = document.getElementById('audit-summary-caption');
        if (captionEl) {
            captionEl.textContent = isExtrato
                ? 'Alguns pedidos em booking foram identificados mas seus CNPJs ainda não constam na lista central de clientes.'
                : 'Alguns faturamentos foram contabilizados mas seus CNPJs ainda não constam na lista central de clientes.';
        }

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
    
        }

        sectionEl.style.display = 'block';
        if (countBadge) countBadge.textContent = `${unlinkedList.length} clientes pendentes`;

        const columnTitle = isExtrato ? 'Total em Booking' : 'Total Faturado';
        let tableHtml = `
            <table class="audit-table">
                <thead>
                    <tr>
                        <th>CNPJ</th>
                        <th style="width: 100px;">Cód. New Era</th>
                        <th>Nome Fantasia (Relatório)</th>
                        <th>Razão Social</th>
                        <th style="text-align: right;">${columnTitle}</th>
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
            
                }

                // Mapeamento dinâmico e inteligente das colunas
                const firstRow = rawJson[0];
                const keys = Object.keys(firstRow);
                const findKey = (name) => keys.find(k => k.toLowerCase().includes(name.toLowerCase()));

                const kCnpj = findKey('cnpj/cpf') || findKey('cnpj') || findKey('cpf');
                const kClifor = findKey('código (clifor)') || findKey('clifor') || findKey('código') || findKey('codigo');
                const kFantasia = findKey('nome fantasia') || findKey('fantasia') || findKey('cliente');
                const kRede = findKey('nome da rede') || findKey('rede');
                const kRazao = findKey('razão social') || findKey('razao social') || findKey('raz');
                const kCidade = findKey('cidade') || findKey('munic');
                
                // Prioridade: Data Entrega (Extrato de Pedidos) ou Emissão (Faturamento)
                const kData = findKey('data entrega') || findKey('entrega') || findKey('emiss') || findKey('data');
                
                // Prioridade: Qtde Entregar sobre Qtde genérica
                const kQtde = findKey('qtde entregar') || findKey('qtd entregar') || findKey('qtde') || findKey('qtd') || findKey('quantidade');
                
                // Prioridade: Valor Entregar sobre Valor / Gross genérico
                const kGross = findKey('valor entregar') || findKey('gross') || findKey('valor bruto') || findKey('valor');
                const kNet = findKey('net') || findKey('valor líquido') || findKey('valor liquido');
                
                // Pedido ou Nota Fiscal
                const kNota = findKey('pedido') || findKey('nota') || findKey('nf') || findKey('pedido cliente');
                
                const kAno = findKey('ano');
                const kMes = findKey('mês') || findKey('mes');
                
                // Prioriza o nome exato 'Produto' antes de 'Grupo Produto' ou 'Classe Produto'
                const kProd = keys.find(k => k.trim().toLowerCase() === 'produto') || findKey('referência') || findKey('referencia') || findKey('código produto') || findKey('produto');
                const kDesc = findKey('descri');
                const kCor = keys.find(k => k.trim().toLowerCase() === 'cor') 
                    || keys.find(k => k.trim().toLowerCase() === 'variante')
                    || findKey('código cor') 
                    || findKey('codigo cor') 
                    || findKey('cod cor') 
                    || findKey('código da cor')
                    || findKey('codigo da cor')
                    || findKey('variante cor') 
                    || findKey('cor produto');
                
                // Sub-grupo: aceita 'grupo produto' ou 'sub-grupo'
                const kSub = findKey('grupo produto') || findKey('grupo de produto') || findKey('sub-grupo') || findKey('subgrupo') || findKey('sub grupo');
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

                    // Data normalizada e extração automática de ano e mês
                    let emissStr = '';
                    let anoVal = 0;
                    let mesVal = 0;
                    const rawDate = kData ? row[kData] : null;
                    if (rawDate) {
                        if (typeof rawDate === 'number') {
                            const dObj = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
                            emissStr = `${dObj.getDate().toString().padStart(2,'0')}/${(dObj.getMonth()+1).toString().padStart(2,'0')}/${dObj.getFullYear()}`;
                            anoVal = dObj.getFullYear();
                            mesVal = dObj.getMonth() + 1;
                        } else {
                            const str = rawDate.toString().trim();
                            const datePart = str.split(' ')[0];
                            if (datePart.includes('/')) {
                                const p = datePart.split('/');
                                if (p.length === 3) {
                                    if (p[0].length === 4) {
                                        anoVal = parseInt(p[0], 10);
                                        mesVal = parseInt(p[1], 10);
                                        emissStr = `${p[2].padStart(2,'0')}/${p[1].padStart(2,'0')}/${p[0]}`;
                                    } else {
                                        anoVal = parseInt(p[2], 10);
                                        mesVal = parseInt(p[1], 10);
                                        emissStr = `${p[0].padStart(2,'0')}/${p[1].padStart(2,'0')}/${p[2]}`;
                                    }
                                }
                            } else if (datePart.includes('-')) {
                                const p = datePart.split('-');
                                if (p.length === 3) {
                                    if (p[0].length === 4) {
                                        anoVal = parseInt(p[0], 10);
                                        mesVal = parseInt(p[1], 10);
                                        emissStr = `${p[2].padStart(2,'0')}/${p[1].padStart(2,'0')}/${p[0]}`;
                                    }
                                }
                            } else {
                                emissStr = str.slice(0, 10);
                            }
                        }
                    }

                    if (kAno && row[kAno]) {
                        const pAno = parseInt(row[kAno], 10);
                        if (!isNaN(pAno) && pAno > 2000) anoVal = pAno;
                    }
                    if (kMes && row[kMes]) {
                        const pMes = parseInt(row[kMes], 10);
                        if (!isNaN(pMes) && pMes >= 1 && pMes <= 12) mesVal = pMes;
                    }

                    parsed.push({
                        cli: (kClifor && row[kClifor]) ? String(row[kClifor]).trim() : '',
                        c: cleanC,
                        f: (kFantasia && row[kFantasia]) ? String(row[kFantasia]).trim() : '',
                        r: (kRede && row[kRede]) ? String(row[kRede]).trim() : '',
                        z: (kRazao && row[kRazao]) ? String(row[kRazao]).trim() : '',
                        cid: (kCidade && row[kCidade]) ? String(row[kCidade]).trim() : '',
                        d: emissStr,
                        a: anoVal,
                        m: mesVal,
                        p: (kProd && row[kProd]) ? String(row[kProd]).trim() : '',
                        desc: (kDesc && row[kDesc]) ? String(row[kDesc]).trim() : '',
                        cor: (kCor && row[kCor]) ? String(row[kCor]).trim() : '',
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
                    window.showNotification('Nenhum registro de faturamento ou pedido válido encontrado.', 'error');
            
                }

                const isExtrato = !!(findKey('data entrega') || findKey('valor entregar') || findKey('qtde entregar'));
                currentDatasetType = isExtrato ? 'extrato' : 'billing';
                localStorage.setItem('empresa_indicators_dataset_type', currentDatasetType);

                // Capturar data do arquivo enviado (lastModified) formatada em DD/MM/AAAA
                const fileDateObj = file.lastModified ? new Date(file.lastModified) : new Date();
                const formattedFileDate = `${fileDateObj.getDate().toString().padStart(2, '0')}/${(fileDateObj.getMonth() + 1).toString().padStart(2, '0')}/${fileDateObj.getFullYear()}`;

                billingMasterData = parsed;
                if (isExtrato) {
                    localStorage.setItem('empresa_extrato_last_updated', formattedFileDate);
                    localStorage.setItem('empresa_extrato_new_era_custom', JSON.stringify(parsed));
                } else {
                    localStorage.setItem('empresa_billing_last_updated', formattedFileDate);
                    localStorage.setItem('empresa_billing_new_era_custom', JSON.stringify(parsed));
                }

                // Atualizar botões visuais
                const btnExtrato = document.getElementById('btn-dataset-extrato');
                const btnBilling = document.getElementById('btn-dataset-billing');
                if (btnExtrato && btnBilling) {
                    btnExtrato.style.background = isExtrato ? 'var(--accent-color, #3b82f6)' : 'transparent';
                    btnExtrato.style.color = isExtrato ? '#ffffff' : 'var(--text-secondary)';
                    btnBilling.style.background = !isExtrato ? 'var(--accent-color, #3b82f6)' : 'transparent';
                    btnBilling.style.color = !isExtrato ? '#ffffff' : 'var(--text-secondary)';
                }

                // Sincronizar Firestore se disponível
                if (window.db) {
                    try {
                        const docId = isExtrato ? 'extrato_new_era' : 'billing_new_era';
                        await window.db.collection('settings').doc(docId).set({
                            list: parsed,
                            lastUpdated: formattedFileDate,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                            updatedBy: localStorage.getItem('empresa_auth_user') || 'Usuário'
                        });
                    } catch(dbErr) {
                        console.warn('Erro ao salvar no Firestore:', dbErr);
                    }
                }

                computeLatestReportDate();
                const def = getDefaultPeriod();
                const startInput = document.getElementById('filter-ind-start-date');
                const endInput = document.getElementById('filter-ind-end-date');
                if (startInput) startInput.value = def.start;
                if (endInput) endInput.value = def.end;

                populateAllIndCMS(false);
                applyIndicatorsFilter();

                const successMsg = isExtrato
                    ? `Sucesso! Extrato de Pedidos carregado com ${parsed.length.toLocaleString('pt-BR')} itens a entregar!`
                    : `Sucesso! Planilha de Faturamento carregada com ${parsed.length.toLocaleString('pt-BR')} lançamentos!`;
                window.showNotification(successMsg, 'success');
                if (window.logUserAction) {
                    window.logUserAction(isExtrato ? `importou extrato de pedidos NEW ERA (${parsed.length} itens)` : `importou planilha de faturamento (${parsed.length} lançamentos)`);
                }

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
    
        }

        try {
            const isExtrato = (currentDatasetType === 'extrato');
            const clientsMap = buildClientsMap();
            const metricVal = document.getElementById('filter-ind-metric')?.value || 'gross';
            const metricHeader = metricVal === 'net' 
                ? (isExtrato ? 'Valor Booking Líquido (R$)' : 'Valor Considerado (Líquido)')
                : (isExtrato ? 'Valor Booking Bruto (R$)' : 'Valor Considerado (Bruto)');

            const exportRows = billingFilteredData.map(item => {
                const clientMatch = resolveClientForItem(item, clientsMap);
                const cnpj = item.c || (clientMatch && clientMatch['CNPJ']) || '';
                if (isExtrato) {
                    return {
                        'Código CLIFOR': item.cli || '',
                        'CNPJ': cnpj ? formatCNPJMask(cnpj) : '',
                        'Nome Fantasia': (clientMatch && (clientMatch['FANTASIA'] || clientMatch['NOME FANTASIA'])) || item.f || '',
                        'Razão Social': (clientMatch && (clientMatch['RAZAO SOCIAL'] || clientMatch['RAZÃO SOCIAL'])) || item.z || '',
                        'Grupo Real': (clientMatch && (clientMatch['GRUPO REAL'] || clientMatch['GRUPO'])) || item.gr || '',
                        'Grupo': (clientMatch && clientMatch['GRUPO']) || item.g || '',
                        'Rede': item.r || '',
                        'Data Entrega': item.d || '',
                        'Pedido': item.nf || '',
                        'Referência Produto': item.p || '',
                    'Cor / Variante': item.cor || '',
                        'Cor / Variante': item.cor || '',
                        'Descrição': item.desc || '',
                        'Sub-Grupo': item.sub || '',
                        'Classe Produto': item.cl || '',
                        [metricHeader]: item.v || 0,
                        'Valor Entregar (Bruto R$)': item.vg !== undefined ? item.vg : item.v,
                        'Valor Entregar (Líquido R$)': item.vn !== undefined ? item.vn : item.v,
                        'Qtde Entregar (Peças)': item.q || 0
                    };
                }
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
                    'Cor / Variante': item.cor || '',
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
            const sheetTitle = isExtrato ? 'EXTRATO_PEDIDOS' : 'FATURAMENTO';
            XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

            const now = new Date();
            const dateStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}`;
            const fileName = isExtrato ? `BOOKING_NEW_ERA_${dateStr}.xlsx` : `INDICADORES_NEW_ERA_${dateStr}.xlsx`;
            XLSX.writeFile(wb, fileName);

            window.showNotification('Relatório exportado com sucesso!', 'success');
            if (window.logUserAction) window.logUserAction(isExtrato ? 'exportou extrato de pedidos para Excel' : 'exportou relatório de indicadores para Excel');
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



    // ==========================================================================
    // MÓDULO COMPARATIVO: A ENTREGAR (BOOKING) X FATURAMENTO REALIZADO
    // Confrontação das Informações por CNPJ, Data de Entrega/Emissão e Mês
    // ==========================================================================

    function updateComparisonKpis(bData, eData, clientsMap, metricVal) {
        let fatTotal = 0;
        let fatPieces = 0;
        let extTotal = 0;
        let extPieces = 0;
        const cnpjsFat = new Set();
        const cnpjsExt = new Set();

        bData.forEach(item => {
            fatTotal += item.v || 0;
            fatPieces += item.q || 0;
            const cMatch = resolveClientForItem(item, clientsMap);
            const cnpj = item.c || (cMatch && cMatch['CNPJ']) || (item.cli ? `CLI_${item.cli}` : item.f);
            if (cnpj) cnpjsFat.add(cnpj);
        });

        eData.forEach(item => {
            extTotal += item.v || 0;
            extPieces += item.q || 0;
            const cMatch = resolveClientForItem(item, clientsMap);
            const cnpj = item.c || (cMatch && cMatch['CNPJ']) || (item.cli ? `CLI_${item.cli}` : item.f);
            if (cnpj) cnpjsExt.add(cnpj);
        });

        const grandTotal = fatTotal + extTotal;
        const grandPieces = fatPieces + extPieces;
        const pctFat = grandTotal > 0 ? (fatTotal / grandTotal * 100) : 0;
        const pctExt = grandTotal > 0 ? (extTotal / grandTotal * 100) : 0;

        const isPiecesOnly = (currentKpiDisplayMode === 'pieces');
        const isBoth = (currentKpiDisplayMode === 'both');

        // KPI 1: Faturamento Realizado
        const cardTotal = document.getElementById('kpi-card-total');
        if (cardTotal) {
            cardTotal.style.display = 'block';
            cardTotal.classList.remove('highlight-blue', 'highlight-accent');
            cardTotal.classList.add('highlight-emerald');
            const titleEl = document.getElementById('kpi-total-title');
            const revEl = document.getElementById('kpi-total-revenue');
            const subEl = document.getElementById('kpi-total-sub');
            const footEl = document.getElementById('kpi-total-footer');
            if (titleEl) titleEl.textContent = isPiecesOnly ? 'Faturamento Realizado (Peças)' : 'Faturamento Realizado';
            if (revEl) revEl.textContent = isPiecesOnly ? `${numberFormatter.format(fatPieces)} pçs` : formatBRL(fatTotal);
            if (subEl) {
                if (isBoth) {
                    subEl.style.display = 'inline-block';
                    subEl.textContent = `${numberFormatter.format(fatPieces)} peças`;
                } else {
                    subEl.style.display = 'none';
                }
            }
            if (footEl) footEl.textContent = 'vendas faturadas no período';
        }

        // KPI 2: A Entregar (Carteira)
        const cardPieces = document.getElementById('kpi-card-pieces');
        if (cardPieces) {
            cardPieces.style.display = 'block';
            cardPieces.classList.remove('highlight-emerald', 'highlight-accent');
            cardPieces.classList.add('highlight-blue');
            const titleEl = document.getElementById('kpi-pieces-title');
            const valEl = document.getElementById('kpi-total-pieces-val');
            const footEl = document.getElementById('kpi-pieces-footer');
            if (titleEl) titleEl.textContent = isPiecesOnly ? 'A Entregar (Peças)' : 'A Entregar (Carteira)';
            if (valEl) valEl.textContent = isPiecesOnly ? `${numberFormatter.format(extPieces)} pçs` : formatBRL(extTotal);
            if (footEl) footEl.textContent = isBoth ? `${numberFormatter.format(extPieces)} peças programadas` : (isPiecesOnly ? 'pedidos programados em carteira' : 'valor em carteira a entregar');
        }

        // KPI 3: Total Geral Previsto
        const cardOrders = document.getElementById('kpi-card-orders');
        if (cardOrders) {
            cardOrders.style.display = 'block';
            const titleEl = document.getElementById('kpi-orders-title');
            const valEl = document.getElementById('kpi-unique-orders-val');
            const footEl = document.getElementById('kpi-orders-footer');
            if (titleEl) titleEl.textContent = isPiecesOnly ? 'Total Geral Previsto (Peças)' : 'Total Geral Previsto';
            if (valEl) valEl.textContent = isPiecesOnly ? `${numberFormatter.format(grandPieces)} pçs` : formatBRL(grandTotal);
            if (footEl) footEl.textContent = isBoth ? `${numberFormatter.format(grandPieces)} peças consolidadas` : (isPiecesOnly ? 'volume consolidado faturado + carteira' : 'projeção consolidada de vendas');
        }

        // KPI 4: % Realizado vs Carteira
        const cardTicket = document.getElementById('kpi-card-ticket');
        if (cardTicket) {
            cardTicket.style.display = 'block';
            const titleEl = document.getElementById('kpi-ticket-title');
            const valEl = document.getElementById('kpi-avg-ticket');
            const subEl = document.getElementById('kpi-ticket-sub');
            const footEl = document.getElementById('kpi-ticket-footer');
            if (titleEl) titleEl.textContent = '% Realizado vs Carteira';
            if (valEl) valEl.textContent = `${pctFat.toFixed(1)}% faturado`;
            if (subEl) {
                subEl.style.display = 'inline-block';
                subEl.textContent = `${pctExt.toFixed(1)}% em carteira`;
            }
            if (footEl) footEl.textContent = 'conversão geral de vendas';
        }

        // KPI 5: Lojas Faturadas
        const cardClients = document.getElementById('kpi-card-clients');
        if (cardClients) {
            cardClients.style.display = 'block';
            const titleEl = document.getElementById('kpi-clients-title');
            const valEl = document.getElementById('kpi-active-clients');
            const footEl = document.getElementById('kpi-clients-coverage');
            if (titleEl) titleEl.textContent = 'Lojas Faturadas';
            if (valEl) valEl.textContent = cnpjsFat.size.toString();
            if (footEl) footEl.textContent = 'clientes com faturamento emitido';
        }

        // KPI 6: Lojas em Carteira
        const cardGroups = document.getElementById('kpi-card-groups');
        if (cardGroups) {
            cardGroups.style.display = 'block';
            const titleEl = document.getElementById('kpi-groups-title');
            const valEl = document.getElementById('kpi-active-groups');
            const footEl = document.getElementById('kpi-groups-coverage');
            if (titleEl) titleEl.textContent = 'Lojas em Carteira';
            if (valEl) valEl.textContent = cnpjsExt.size.toString();
            if (footEl) footEl.textContent = 'clientes com pedidos a entregar';
        }

        const cardMonth = document.getElementById('kpi-card-month');
        if (cardMonth) cardMonth.style.display = 'none';
        const cardDay = document.getElementById('kpi-card-day');
        if (cardDay) cardDay.style.display = 'none';

        adjustKpiTextFit();
    }

    window.setComparisonChartDisplayMode = function(mode) {
        compChartDisplayMode = mode;
        const btnVal = document.getElementById('btn-comp-chart-mode-val');
        const btnQty = document.getElementById('btn-comp-chart-mode-qty');
        if (btnVal) btnVal.classList.toggle('active', mode === 'values');
        if (btnQty) btnQty.classList.toggle('active', mode === 'pieces');

        const clientsMap = buildClientsMap();
        renderComparisonCharts(lastCompFilteredBilling, lastCompFilteredExtrato, clientsMap);
    };

    // Datalabels flutuantes sobre barras desativados a pedido do usuario: os totais consolidados sao exibidos na legenda
    const comparisonDataLabelsPlugin = {
        id: 'compDataLabels',
        afterDatasetsDraw() {}
    };

    function renderComparisonCharts(bData, eData, clientsMap) {
        if (!window.Chart) return;

        const isPieces = (compChartDisplayMode === 'pieces');

        // Totais consolidados para exibição nas legendas dos gráficos
        const totFatV = bData.reduce((acc, it) => acc + (it.v || 0), 0);
        const totFatQ = bData.reduce((acc, it) => acc + (it.q || 0), 0);
        const totExtV = eData.reduce((acc, it) => acc + (it.v || 0), 0);
        const totExtQ = eData.reduce((acc, it) => acc + (it.q || 0), 0);
        const totGrandV = totFatV + totExtV;
        const totGrandQ = totFatQ + totExtQ;

        const fatLegendLabel = isPieces ? `${totFatQ.toLocaleString('pt-BR')} pçs` : formatBRL(totFatV);
        const extLegendLabel = isPieces ? `${totExtQ.toLocaleString('pt-BR')} pçs` : formatBRL(totExtV);
        const grandLegendLabel = isPieces ? `${totGrandQ.toLocaleString('pt-BR')} pçs` : formatBRL(totGrandV);

        // 1. Confronto Mensal (Faturamento vs A Entregar)
        const ctxMonthly = document.getElementById('chart-comp-monthly')?.getContext('2d');
        if (ctxMonthly) {
            if (chartCompMonthlyInstance) chartCompMonthlyInstance.destroy();

            const monthMap = {};
            const parseMonthKey = (item) => {
                const dObj = parseDateBR(item.d);
                if (dObj) {
                    const y = dObj.getFullYear();
                    const m = (dObj.getMonth() + 1).toString().padStart(2, '0');
                    return `${y}-${m}`;
                }
                return null;
            };

            bData.forEach(item => {
                const k = parseMonthKey(item);
                if (!k) return;
                if (!monthMap[k]) monthMap[k] = { fatV: 0, fatQ: 0, extV: 0, extQ: 0 };
                monthMap[k].fatV += item.v || 0;
                monthMap[k].fatQ += item.q || 0;
            });

            eData.forEach(item => {
                const k = parseMonthKey(item);
                if (!k) return;
                if (!monthMap[k]) monthMap[k] = { fatV: 0, fatQ: 0, extV: 0, extQ: 0 };
                monthMap[k].extV += item.v || 0;
                monthMap[k].extQ += item.q || 0;
            });

            const sortedKeys = Object.keys(monthMap).sort();
            const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            const labels = sortedKeys.map(k => {
                const [y, m] = k.split('-');
                return `${monthNames[parseInt(m, 10) - 1]}/${y.substring(2)}`;
            });

            const isPieces = (compChartDisplayMode === 'pieces');
            const fatData = sortedKeys.map(k => isPieces ? monthMap[k].fatQ : monthMap[k].fatV);
            const extData = sortedKeys.map(k => isPieces ? monthMap[k].extQ : monthMap[k].extV);
            const totalData = sortedKeys.map(k => (isPieces ? monthMap[k].fatQ : monthMap[k].fatV) + (isPieces ? monthMap[k].extQ : monthMap[k].extV));

            chartCompMonthlyInstance = new Chart(ctxMonthly, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        {
                            label: `Faturamento Realizado (${fatLegendLabel})`,
                            data: fatData,
                            backgroundColor: 'rgba(16, 185, 129, 0.85)',
                            borderColor: '#10b981',
                            borderWidth: 1,
                            borderRadius: 4,
                            order: 2
                        },
                        {
                            label: `A Entregar (Carteira) (${extLegendLabel})`,
                            data: extData,
                            backgroundColor: 'rgba(59, 130, 246, 0.85)',
                            borderColor: '#3b82f6',
                            borderWidth: 1,
                            borderRadius: 4,
                            order: 3
                        },
                        {
                            label: `Total Consolidado (${grandLegendLabel})`,
                            data: totalData,
                            type: 'line',
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.12)',
                            borderWidth: 2,
                            tension: 0.3,
                            pointRadius: 4,
                            pointBackgroundColor: '#f59e0b',
                            order: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: { color: '#94a3b8', font: { size: 11, family: 'Inter' } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(ctx) {
                                    const val = ctx.parsed.y || 0;
                                    const formatted = isPieces ? `${val.toLocaleString('pt-BR')} pçs` : formatBRL(val);
                                    return ` ${ctx.dataset.label}: ${formatted}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: '#94a3b8', font: { size: 11 } }
                        },
                        y: {
                            grace: '15%',
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: {
                                color: '#94a3b8',
                                font: { size: 10 },
                                callback: val => isPieces ? val.toLocaleString('pt-BR') : 'R$ ' + (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val)
                            }
                        }
                    }
                },
                plugins: [comparisonDataLabelsPlugin]
            });
        }

        // 2. Evolução Diária do Confronto
        const ctxDaily = document.getElementById('chart-comp-daily')?.getContext('2d');
        if (ctxDaily) {
            if (chartCompDailyInstance) chartCompDailyInstance.destroy();

            const dateMap = {};
            bData.forEach(item => {
                if (!item.d) return;
                const dObj = parseDateBR(item.d);
                if (!dObj) return;
                const iso = dObj.toISOString().split('T')[0];
                if (!dateMap[iso]) dateMap[iso] = { label: item.d.split(' ')[0], fat: 0, ext: 0 };
                dateMap[iso].fat += isPieces ? (item.q || 0) : (item.v || 0);
            });
            eData.forEach(item => {
                if (!item.d) return;
                const dObj = parseDateBR(item.d);
                if (!dObj) return;
                const iso = dObj.toISOString().split('T')[0];
                if (!dateMap[iso]) dateMap[iso] = { label: item.d.split(' ')[0], fat: 0, ext: 0 };
                dateMap[iso].ext += isPieces ? (item.q || 0) : (item.v || 0);
            });

            const sortedDates = Object.keys(dateMap).sort();
            const labels = sortedDates.map(k => dateMap[k].label);
            const fatData = sortedDates.map(k => dateMap[k].fat);
            const extData = sortedDates.map(k => dateMap[k].ext);

            chartCompDailyInstance = new Chart(ctxDaily, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        {
                            label: `Faturamento do Dia (${fatLegendLabel})`,
                            data: fatData,
                            backgroundColor: 'rgba(16, 185, 129, 0.75)',
                            borderColor: '#10b981',
                            borderWidth: 1,
                            borderRadius: 3
                        },
                        {
                            label: `A Entregar no Dia (${extLegendLabel})`,
                            data: extData,
                            backgroundColor: 'rgba(59, 130, 246, 0.75)',
                            borderColor: '#3b82f6',
                            borderWidth: 1,
                            borderRadius: 3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: true, position: 'top', labels: { color: '#94a3b8', font: { size: 10 } } },
                        tooltip: {
                            callbacks: {
                                label: ctx => ` ${ctx.dataset.label}: ${isPieces ? `${(ctx.parsed.y || 0).toLocaleString('pt-BR')} pçs` : formatBRL(ctx.parsed.y || 0)}`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: '#94a3b8',
                                font: { size: 9 },
                                maxTicksLimit: 14
                            }
                        },
                        y: {
                            grace: '15%',
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: {
                                color: '#94a3b8',
                                font: { size: 9 },
                                callback: val => 'R$ ' + (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val)
                            }
                        }
                    }
                },
                plugins: [comparisonDataLabelsPlugin]
            });
        }

        // 3. Confronto por Divisão / Classe
        const ctxClasses = document.getElementById('chart-comp-classes')?.getContext('2d');
        if (ctxClasses) {
            if (chartCompClassesInstance) chartCompClassesInstance.destroy();

            const classMap = {};
            bData.forEach(item => {
                const cl = (item.cl || 'Outros').trim().toUpperCase();
                if (!classMap[cl]) classMap[cl] = { fat: 0, ext: 0 };
                classMap[cl].fat += isPieces ? (item.q || 0) : (item.v || 0);
            });
            eData.forEach(item => {
                const cl = (item.cl || 'Outros').trim().toUpperCase();
                if (!classMap[cl]) classMap[cl] = { fat: 0, ext: 0 };
                classMap[cl].ext += isPieces ? (item.q || 0) : (item.v || 0);
            });

            const labels = Object.keys(classMap).sort();
            const fatData = labels.map(cl => classMap[cl].fat);
            const extData = labels.map(cl => classMap[cl].ext);

            chartCompClassesInstance = new Chart(ctxClasses, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        {
                            label: `Faturamento Realizado (${fatLegendLabel})`,
                            data: fatData,
                            backgroundColor: 'rgba(16, 185, 129, 0.8)',
                            borderColor: '#10b981',
                            borderWidth: 1,
                            borderRadius: 4
                        },
                        {
                            label: `A Entregar (Carteira) (${extLegendLabel})`,
                            data: extData,
                            backgroundColor: 'rgba(59, 130, 246, 0.8)',
                            borderColor: '#3b82f6',
                            borderWidth: 1,
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'top', labels: { color: '#94a3b8', font: { size: 10 } } },
                        tooltip: {
                            callbacks: {
                                label: ctx => ` ${ctx.dataset.label}: ${isPieces ? `${(ctx.parsed.y || 0).toLocaleString('pt-BR')} pçs` : formatBRL(ctx.parsed.y || 0)}`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: '#94a3b8', font: { size: 10 } }
                        },
                        y: {
                            grace: '15%',
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: {
                                color: '#94a3b8',
                                font: { size: 9 },
                                callback: val => 'R$ ' + (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val)
                            }
                        }
                    }
                },
                plugins: [comparisonDataLabelsPlugin]
            });
        }
    }

    // --------------------------------------------------------------------------
    // CONFRONTAÇÃO ANALÍTICA (TABELAS DE CNPJ, MÊS E DATA)
    // --------------------------------------------------------------------------
    function renderComparisonConfrontation(bData, eData, clientsMap) {
        // 1. Agrupar por CNPJ
        const cnpjGroupMap = new Map();

        const processItemCnpj = (item, isBilling) => {
            const clientMatch = resolveClientForItem(item, clientsMap);
            const rawCnpj = item.c || (clientMatch && clientMatch['CNPJ']) || '';
            const cleanC = cleanDigits(rawCnpj);
            const key = cleanC || (item.cli ? `CLI_${item.cli}` : (item.f || 'DESCONHECIDO'));

            if (!cnpjGroupMap.has(key)) {
                const fant = (clientMatch && (clientMatch['FANTASIA'] || clientMatch['NOME FANTASIA'])) || item.f || '';
                const raz = (clientMatch && (clientMatch['RAZAO SOCIAL'] || clientMatch['RAZÃO SOCIAL'])) || item.z || '';
                const cid = (clientMatch && (clientMatch['CIDADE'] || clientMatch['MUNICÍPIO'])) || item.cid || '';
                const rede = (clientMatch && clientMatch['GRUPO']) || item.r || item.g || '';

                cnpjGroupMap.set(key, {
                    key,
                    cnpjClean: cleanC,
                    cnpjFormatted: cleanC ? formatCNPJMask(cleanC.padStart(14, '0')) : (item.cli ? `Cód ${item.cli}` : '-'),
                    fantasia: fant,
                    razao: raz,
                    cidade: cid,
                    rede: rede,
                    fatV: 0,
                    fatQ: 0,
                    extV: 0,
                    extQ: 0,
                    fatOrders: new Set(),
                    extOrders: new Set(),
                    fatItemsList: [],
                    extItemsList: []
                });
            }

            const rec = cnpjGroupMap.get(key);
            const v = item.v || 0;
            const q = item.q || 0;

            if (isBilling) {
                rec.fatV += v;
                rec.fatQ += q;
                if (item.nf) rec.fatOrders.add(item.nf);
                if (rec.fatItemsList.length < 50) rec.fatItemsList.push(item);
            } else {
                rec.extV += v;
                rec.extQ += q;
                if (item.nf) rec.extOrders.add(item.nf);
                if (rec.extItemsList.length < 50) rec.extItemsList.push(item);
            }
        };

        bData.forEach(it => processItemCnpj(it, true));
        eData.forEach(it => processItemCnpj(it, false));

        currentCompCnpjList = Array.from(cnpjGroupMap.values()).map(rec => {
            const totalV = rec.fatV + rec.extV;
            const totalQ = rec.fatQ + rec.extQ;
            const pctFat = totalV > 0 ? (rec.fatV / totalV * 100) : 0;
            const pctExt = totalV > 0 ? (rec.extV / totalV * 100) : 0;
            return {
                ...rec,
                totalV,
                totalQ,
                pctFat,
                pctExt
            };
        });

        // 2. Agrupar por Mês / Ano
        const monthGroupMap = new Map();
        const monthNamesFull = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        const processMonthItem = (item, isBilling) => {
            const dObj = parseDateBR(item.d);
            if (!dObj) return;
            const y = dObj.getFullYear();
            const m = dObj.getMonth() + 1;
            const k = `${y}-${m.toString().padStart(2, '0')}`;

            if (!monthGroupMap.has(k)) {
                monthGroupMap.set(k, {
                    key: k,
                    year: y,
                    monthNum: m,
                    label: `${monthNamesFull[m - 1]} / ${y}`,
                    fatV: 0,
                    fatQ: 0,
                    extV: 0,
                    extQ: 0,
                    fatClients: new Set(),
                    extClients: new Set()
                });
            }

            const rec = monthGroupMap.get(k);
            const v = item.v || 0;
            const q = item.q || 0;
            const clientMatch = resolveClientForItem(item, clientsMap);
            const clientKey = item.c || (clientMatch && clientMatch['CNPJ']) || item.cli || item.f;

            if (isBilling) {
                rec.fatV += v;
                rec.fatQ += q;
                if (clientKey) rec.fatClients.add(clientKey);
            } else {
                rec.extV += v;
                rec.extQ += q;
                if (clientKey) rec.extClients.add(clientKey);
            }
        };

        bData.forEach(it => processMonthItem(it, true));
        eData.forEach(it => processMonthItem(it, false));

        currentCompMonthList = Array.from(monthGroupMap.values()).map(rec => {
            const totalV = rec.fatV + rec.extV;
            const totalQ = rec.fatQ + rec.extQ;
            const pctFat = totalV > 0 ? (rec.fatV / totalV * 100) : 0;
            const pctExt = totalV > 0 ? (rec.extV / totalV * 100) : 0;
            return {
                ...rec,
                totalV,
                totalQ,
                pctFat,
                pctExt,
                fatStoresCount: rec.fatClients.size,
                extStoresCount: rec.extClients.size
            };
        }).sort((a, b) => a.key.localeCompare(b.key));

        // 3. Agrupar por Data
        const dateGroupMap = new Map();
        const weekDays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

        const processDateItem = (item, isBilling) => {
            if (!item.d) return;
            const dObj = parseDateBR(item.d);
            if (!dObj) return;
            const iso = dObj.toISOString().split('T')[0];

            if (!dateGroupMap.has(iso)) {
                const y = dObj.getFullYear();
                const m = dObj.getMonth() + 1;
                const mKey = `${y}-${m.toString().padStart(2, '0')}`;
                const mLabel = `${monthNamesFull[m - 1]} / ${y}`;

                dateGroupMap.set(iso, {
                    iso,
                    dateStr: item.d.split(' ')[0],
                    weekDay: weekDays[dObj.getDay()],
                    timestamp: dObj.getTime(),
                    monthKey: mKey,
                    monthLabel: mLabel,
                    monthNum: m,
                    year: y,
                    fatV: 0,
                    fatQ: 0,
                    extV: 0,
                    extQ: 0
                });
            }

            const rec = dateGroupMap.get(iso);
            if (isBilling) {
                rec.fatV += item.v || 0;
                rec.fatQ += item.q || 0;
            } else {
                rec.extV += item.v || 0;
                rec.extQ += item.q || 0;
            }
        };

        bData.forEach(it => processDateItem(it, true));
        eData.forEach(it => processDateItem(it, false));

        currentCompDateList = Array.from(dateGroupMap.values()).map(rec => {
            const totalV = rec.fatV + rec.extV;
            const totalQ = rec.fatQ + rec.extQ;
            let status = 'Faturado e Programado';
            if (rec.fatV > 0 && rec.extV === 0) status = 'Somente Faturado';
            else if (rec.extV > 0 && rec.fatV === 0) status = 'Somente Programado';
            return {
                ...rec,
                totalV,
                totalQ,
                status
            };
        }).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        // Deixar agrupado por mês e recolhido por padrão conforme solicitado
        compDateCollapsedMonths.clear();
        currentCompDateList.forEach(d => {
            if (d.monthKey) compDateCollapsedMonths.add(d.monthKey);
        });
        const lblExpand = document.getElementById('label-comp-date-expand-all');
        const iconExpand = document.getElementById('icon-comp-date-expand-all');
        if (lblExpand) lblExpand.textContent = 'Expandir Todos';
        if (iconExpand) iconExpand.className = 'bx bx-expand-vertical';

        // Atualizar badge de contagem
        const totalBadge = document.getElementById('comp-table-total-badge');
        if (totalBadge) {
            totalBadge.textContent = `${currentCompCnpjList.length} Lojas / CNPJs`;
        }

        renderCompCnpjTable();
        renderCompMonthTable();
        renderCompDateTable();
        buildCompProductList(bData, eData, clientsMap);
    }

    function buildCompProductList(bData, eData, clientsMap) {
        if (!bData) bData = lastCompFilteredBilling || [];
        if (!eData) eData = lastCompFilteredExtrato || [];
        if (!clientsMap) clientsMap = buildClientsMap();

        // Atualizar estado visual dos botoes de alternancia
        document.querySelectorAll('.btn-product-mode-pill').forEach(btn => {
            const isTarget = (btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf("'" + compProductGroupMode + "'") !== -1) || btn.id.indexOf(compProductGroupMode) !== -1;
            btn.classList.toggle('active', isTarget);
        });

        const productGroupMap = new Map();

        const processProductItem = (item, isBilling) => {
            const pCode = (item.p || '').trim();
            const pDesc = (item.desc || '').trim();
            const pCor = (item.cor || '').toString().trim().toUpperCase();
            const pCorNome = (item.corNome || '').toString().trim().toUpperCase();
            const pSub = (item.sub || 'Nao Definido').trim();
            const pClass = (item.cl || 'Nao Definido').trim();

            let key;
            if (compProductGroupMode === 'sku') {
                key = pCor ? `${pCode.toUpperCase()}__${pCor}` : (pCode.toUpperCase() || pDesc.toUpperCase() || 'SEM_REF');
            } else {
                key = pCode.toUpperCase() || pDesc.toUpperCase() || 'SEM_REF';
            }

            if (!productGroupMap.has(key)) {
                productGroupMap.set(key, {
                    key: key,
                    code: pCode,
                    cor: pCor,
                    corNome: pCorNome,
                    desc: pDesc || pCode || 'Produto sem descricao',
                    sub: pSub,
                    cl: pClass,
                    colors: {},
                    fatV: 0,
                    fatQ: 0,
                    extV: 0,
                    extQ: 0
                });
            }

            const rec = productGroupMap.get(key);
            const v = item.v || 0;
            const q = item.q || 0;

            if (pCor) {
                rec.colors[pCor] = (rec.colors[pCor] || 0) + (q || 1);
                if (!rec.cor) rec.cor = pCor;
            }
            if (pCorNome && !rec.corNome) rec.corNome = pCorNome;
            if ((!rec.sub || rec.sub === 'Nao Definido') && pSub && pSub !== 'Nao Definido') rec.sub = pSub;
            if ((!rec.cl || rec.cl === 'Nao Definido') && pClass && pClass !== 'Nao Definido') rec.cl = pClass;
            if ((!rec.desc || rec.desc === pCode) && pDesc) rec.desc = pDesc;

            if (isBilling) {
                rec.fatV += v;
                rec.fatQ += q;
            } else {
                rec.extV += v;
                rec.extQ += q;
            }
        };

        (bData || []).forEach(it => processProductItem(it, true));
        (eData || []).forEach(it => processProductItem(it, false));

        currentCompProductList = Array.from(productGroupMap.values()).map(rec => {
            const totalV = rec.fatV + rec.extV;
            const totalQ = rec.fatQ + rec.extQ;
            const pctFat = totalV > 0 ? (rec.fatV / totalV * 100) : 0;
            const pctExt = totalV > 0 ? (rec.extV / totalV * 100) : 0;

            if (compProductGroupMode === 'ref') {
                let primaryCor = '';
                const colorEntries = Object.entries(rec.colors || {});
                if (colorEntries.length > 0) {
                    colorEntries.sort((a, b) => b[1] - a[1]);
                    primaryCor = colorEntries[0][0];
                } else if (rec.code && KNOWN_PRODUCT_COLORS[rec.code.toLowerCase()]) {
                    primaryCor = KNOWN_PRODUCT_COLORS[rec.code.toLowerCase()];
                }
                rec.cor = primaryCor;
            }

            let status = 'Parcial';
            let statusClass = 'status-partial';
            if (rec.fatV > 0 && rec.extV === 0) {
                status = '100% Faturado';
                statusClass = 'status-billed';
            } else if (rec.fatV === 0 && rec.extV > 0) {
                status = '100% Carteira';
                statusClass = 'status-pending';
            }

            return {
                ...rec,
                totalV,
                totalQ,
                pctFat,
                pctExt,
                status,
                statusClass
            };
        });

        renderCompProductTable();
        updateCompProductKpis(currentCompProductList);
        renderCompProductRankings(currentCompProductList, bData, eData, clientsMap);
    }

    window.sortCompCnpjTable = function(col) {
        if (compCnpjSortCol === col) {
            compCnpjSortDir = (compCnpjSortDir === 'desc') ? 'asc' : 'desc';
        } else {
            compCnpjSortCol = col;
            compCnpjSortDir = ['cnpj', 'fantasia', 'rede'].includes(col) ? 'asc' : 'desc';
        }
        renderCompCnpjTable();
    };

    function renderCompCnpjTable() {
        const tbody = document.getElementById('comp-tbody-cnpj');
        if (!tbody) return;

        // Atualizar classes e ícones dos cabeçalhos
        const cnpjCols = ['cnpj', 'fantasia', 'rede', 'fatV', 'fatQ', 'extV', 'extQ', 'totalV', 'pctFat'];
        cnpjCols.forEach(c => {
            const th = document.getElementById(`th-cnpj-${c}`);
            if (th) {
                const icon = th.querySelector('.th-sort-icon i');
                if (c === compCnpjSortCol) {
                    th.classList.add('active-sort');
                    if (icon) icon.className = (compCnpjSortDir === 'desc') ? 'bx bx-sort-down' : 'bx bx-sort-up';
                } else {
                    th.classList.remove('active-sort');
                    if (icon) icon.className = 'bx bx-sort';
                }
            }
        });

        let filtered = [...currentCompCnpjList];

        // Filtro de busca de CNPJ e Nome
        if (currentCompSearch) {
            const qClean = cleanDigits(currentCompSearch);
            const qText = currentCompSearch.trim().toLowerCase();
            filtered = filtered.filter(row => {
                if (qClean && row.cnpjClean && row.cnpjClean.includes(qClean)) return true;
                if (row.fantasia && row.fantasia.toLowerCase().includes(qText)) return true;
                if (row.razao && row.razao.toLowerCase().includes(qText)) return true;
                if (row.cidade && row.cidade.toLowerCase().includes(qText)) return true;
                if (row.rede && row.rede.toLowerCase().includes(qText)) return true;
                return false;
            });
        }

        // Ordenação dinâmica por cabeçalho
        filtered.sort((a, b) => {
            let res = 0;
            if (compCnpjSortCol === 'cnpj') {
                res = (a.cnpjClean || '').localeCompare(b.cnpjClean || '');
            } else if (compCnpjSortCol === 'fantasia') {
                res = (a.fantasia || a.razao || '').localeCompare(b.fantasia || b.razao || '');
            } else if (compCnpjSortCol === 'rede') {
                res = (a.rede || a.cidade || '').localeCompare(b.rede || b.cidade || '');
            } else if (['fatV', 'fatQ', 'extV', 'extQ', 'totalV', 'pctFat'].includes(compCnpjSortCol)) {
                res = (b[compCnpjSortCol] || 0) - (a[compCnpjSortCol] || 0);
            } else {
                res = (b.totalV || 0) - (a.totalV || 0);
            }
            return (compCnpjSortDir === 'desc') ? res : -res;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        <i class='bx bx-search-alt' style="font-size: 2rem; display: block; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                        Nenhum CNPJ ou loja encontrado com os critérios de busca selecionados.
                    </td>
                </tr>
            `;
    
        }

        let html = '';
        filtered.forEach(row => {
            const isExpanded = compExpandedCnpjs.has(row.key);
            const clientTitle = row.fantasia || row.razao || 'Cliente sem nome';
            const clientSub = (row.razao && row.fantasia && row.razao.toUpperCase() !== row.fantasia.toUpperCase()) ? row.razao : '';
            const redeText = escapeHTML(row.rede || row.cidade || '-');

            html += `
                <tr class="comp-row" id="comp-row-${row.key}">
                    <td class="font-mono text-accent" style="font-weight: 600; font-size: 0.78rem;">${escapeHTML(row.cnpjFormatted)}</td>
                    <td>
                        <div style="font-weight: 600; color: var(--text-primary);">${escapeHTML(clientTitle)}</div>
                        ${clientSub ? `<div style="font-size: 0.72rem; color: var(--text-secondary);">${escapeHTML(clientSub)}</div>` : ''}
                    </td>
                    <td style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 500;">${redeText}</td>
                    <td style="text-align: right; font-weight: 600; color: #34d399;" class="font-mono">${formatBRL(row.fatV)}</td>
                    <td style="text-align: right; font-size: 0.78rem; color: #94a3b8;" class="font-mono">${row.fatQ.toLocaleString('pt-BR')}</td>
                    <td style="text-align: right; font-weight: 600; color: #60a5fa;" class="font-mono">${formatBRL(row.extV)}</td>
                    <td style="text-align: right; font-size: 0.78rem; color: #94a3b8;" class="font-mono">${row.extQ.toLocaleString('pt-BR')}</td>
                    <td style="text-align: right; font-weight: 700; color: #fbbf24;" class="font-mono">${formatBRL(row.totalV)}</td>
                    <td>
                        <div class="comp-progress-wrap">
                            <div class="comp-progress-bar">
                                <div class="comp-bar-fat" style="width: ${row.pctFat.toFixed(1)}%;" title="Faturado: ${row.pctFat.toFixed(1)}%"></div>
                                <div class="comp-bar-ext" style="width: ${row.pctExt.toFixed(1)}%;" title="A Entregar: ${row.pctExt.toFixed(1)}%"></div>
                            </div>
                            <div class="comp-progress-labels">
                                <span style="color: #34d399;">${row.pctFat.toFixed(0)}% Fat</span>
                                <span style="color: #60a5fa;">${row.pctExt.toFixed(0)}% Entr</span>
                            </div>
                        </div>
                    </td>
                    <td style="text-align: center;">
                        <button type="button" class="btn-comp-detail" onclick="toggleCompDetail('${row.key}')" title="Ver entregas e notas fiscais">
                            <i class='bx ${isExpanded ? 'bx-chevron-up' : 'bx-chevron-down'}'></i> ${isExpanded ? 'Ocultar' : 'Detalhar'}
                        </button>
                    </td>
                </tr>
            `;

            if (isExpanded) {
                html += `
                    <tr class="comp-detail-row" id="comp-detail-${row.key}">
                        <td colspan="10" style="padding: 0.75rem 1rem; background: rgba(15, 23, 42, 0.45);">
                            <div class="comp-detail-box">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <!-- Coluna 1: Pedidos a Entregar -->
                                    <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 6px; padding: 0.75rem;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                            <span style="font-weight: 600; color: #3b82f6; font-size: 0.8rem;">
                                                <i class='bx bx-package'></i> Pedidos em Carteira (${row.extItemsList.length} itens)
                                            </span>
                                            <span style="font-size: 0.75rem; color: #60a5fa;" class="font-mono">${formatBRL(row.extV)} | ${row.extQ.toLocaleString('pt-BR')} pçs</span>
                                        </div>
                                        <div style="max-height: 180px; overflow-y: auto;" class="custom-scrollbar">
                                            ${renderDetailItemsTable(row.extItemsList, 'Data Entrega', 'Pedido')}
                                        </div>
                                    </div>

                                    <!-- Coluna 2: Notas Faturadas -->
                                    <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 6px; padding: 0.75rem;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                            <span style="font-weight: 600; color: #10b981; font-size: 0.8rem;">
                                                <i class='bx bx-receipt'></i> Notas Faturadas (${row.fatItemsList.length} itens)
                                            </span>
                                            <span style="font-size: 0.75rem; color: #34d399;" class="font-mono">${formatBRL(row.fatV)} | ${row.fatQ.toLocaleString('pt-BR')} pçs</span>
                                        </div>
                                        <div style="max-height: 180px; overflow-y: auto;" class="custom-scrollbar">
                                            ${renderDetailItemsTable(row.fatItemsList, 'Data Emissão', 'NF')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            }
        });

        // Linha de Total Consolidado das lojas filtradas
        let sumFatV = 0, sumFatQ = 0, sumExtV = 0, sumExtQ = 0, sumTotalV = 0;
        filtered.forEach(row => {
            sumFatV += row.fatV || 0;
            sumFatQ += row.fatQ || 0;
            sumExtV += row.extV || 0;
            sumExtQ += row.extQ || 0;
            sumTotalV += row.totalV || 0;
        });
        const sumPctFat = sumTotalV > 0 ? (sumFatV / sumTotalV * 100) : 0;
        const sumPctExt = sumTotalV > 0 ? (sumExtV / sumTotalV * 100) : 0;

        tbody.innerHTML = html;

        const tfoot = document.getElementById('comp-tfoot-cnpj');
        if (tfoot) {
            tfoot.innerHTML = `
                <tr style="background: #0f172a; font-weight: 700; border-top: 2px solid rgba(255,255,255,0.2); position: sticky; bottom: 0; z-index: 3;">
                    <td style="color: var(--accent-color, #3b82f6); text-transform: uppercase; font-size: 0.72rem; white-space: nowrap;">TOTAL (${filtered.length} ${filtered.length === 1 ? 'loja' : 'lojas'})</td>
                    <td style="color: var(--text-secondary); font-size: 0.72rem; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Consolidado das lojas</td>
                    <td style="color: var(--text-secondary); font-size: 0.72rem;">-</td>
                    <td style="text-align: right; color: #34d399; font-size: 0.75rem; white-space: nowrap;" class="font-mono">${formatBRL(sumFatV)}</td>
                    <td style="text-align: right; color: #94a3b8; font-size: 0.74rem; white-space: nowrap;" class="font-mono">${sumFatQ.toLocaleString('pt-BR')}</td>
                    <td style="text-align: right; color: #60a5fa; font-size: 0.75rem; white-space: nowrap;" class="font-mono">${formatBRL(sumExtV)}</td>
                    <td style="text-align: right; color: #94a3b8; font-size: 0.74rem; white-space: nowrap;" class="font-mono">${sumExtQ.toLocaleString('pt-BR')}</td>
                    <td style="text-align: right; font-weight: 700; color: #fbbf24; font-size: 0.78rem; white-space: nowrap;" class="font-mono">${formatBRL(sumTotalV)}</td>
                    <td>
                        <div class="comp-progress-wrap">
                            <div class="comp-progress-bar">
                                <div class="comp-bar-fat" style="width: ${sumPctFat.toFixed(1)}%;"></div>
                                <div class="comp-bar-ext" style="width: ${sumPctExt.toFixed(1)}%;"></div>
                            </div>
                            <div class="comp-progress-labels">
                                <span style="color: #34d399;">${sumPctFat.toFixed(0)}% Fat</span>
                                <span style="color: #60a5fa;">${sumPctExt.toFixed(0)}% Entr</span>
                            </div>
                        </div>
                    </td>
                    <td style="text-align: center; color: var(--text-secondary); font-size: 0.70rem;">-</td>
                </tr>
            `;
        }
    }

    function renderDetailItemsTable(items, dateHeader, docHeader) {
        if (!items || items.length === 0) {
            return `<div style="font-size: 0.75rem; color: var(--text-secondary); text-align: center; padding: 1rem;">Nenhum registro para este cliente.</div>`;
        }
        let out = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.72rem; text-align: left;">
                <thead>
                    <tr style="color: var(--text-secondary); border-bottom: 1px solid rgba(255,255,255,0.08);">
                        <th style="padding: 3px 6px;">${docHeader}</th>
                        <th style="padding: 3px 6px;">${dateHeader}</th>
                        <th style="padding: 3px 6px;">Produto</th>
                        <th style="padding: 3px 6px; text-align: right;">Qtd</th>
                        <th style="padding: 3px 6px; text-align: right;">Valor</th>
                    </tr>
                </thead>
                <tbody>
        `;
        items.forEach(it => {
            const v = it.v || it.vg || 0;
            const q = it.q || 0;
            out += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <td style="padding: 3px 6px;" class="font-mono">${escapeHTML(it.nf || '-')}</td>
                    <td style="padding: 3px 6px;" class="font-mono">${escapeHTML(it.d ? it.d.split(' ')[0] : '-')}</td>
                    <td style="padding: 3px 6px; max-width: 130px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(it.desc || '')}">${escapeHTML(it.p || it.desc || '-')}</td>
                    <td style="padding: 3px 6px; text-align: right;" class="font-mono">${q}</td>
                    <td style="padding: 3px 6px; text-align: right; font-weight: 600;" class="font-mono">${formatBRL(v)}</td>
                </tr>
            `;
        });
        out += `</tbody></table>`;
        return out;
    }

    window.sortCompMonthTable = function(col) {
        if (compMonthSortCol === col) {
            compMonthSortDir = (compMonthSortDir === 'desc') ? 'asc' : 'desc';
        } else {
            compMonthSortCol = col;
            compMonthSortDir = (col === 'key') ? 'asc' : 'desc';
        }
        renderCompMonthTable();
    };

    function renderCompMonthTable() {
        const tbody = document.getElementById('comp-tbody-month');
        if (!tbody) return;

        // Atualizar classes e ícones dos cabeçalhos
        const monthCols = ['key', 'fatV', 'fatQ', 'extV', 'extQ', 'totalV', 'totalQ', 'fatStoresCount', 'extStoresCount'];
        monthCols.forEach(c => {
            const th = document.getElementById(`th-month-${c}`);
            if (th) {
                const icon = th.querySelector('.th-sort-icon i');
                if (c === compMonthSortCol) {
                    th.classList.add('active-sort');
                    if (icon) icon.className = (compMonthSortDir === 'desc') ? 'bx bx-sort-down' : 'bx bx-sort-up';
                } else {
                    th.classList.remove('active-sort');
                    if (icon) icon.className = 'bx bx-sort';
                }
            }
        });

        if (currentCompMonthList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhum dado mensal no período selecionado.</td></tr>`;
    
        }

        const sortedMonths = [...currentCompMonthList].sort((a, b) => {
            let res = 0;
            if (compMonthSortCol === 'key') {
                res = b.key.localeCompare(a.key);
            } else if (['fatV', 'fatQ', 'extV', 'extQ', 'totalV', 'totalQ', 'fatStoresCount', 'extStoresCount'].includes(compMonthSortCol)) {
                res = (b[compMonthSortCol] || 0) - (a[compMonthSortCol] || 0);
            } else {
                res = b.key.localeCompare(a.key);
            }
            return (compMonthSortDir === 'desc') ? res : -res;
        });

        let totFatV = 0, totFatQ = 0, totExtV = 0, totExtQ = 0, totGrandV = 0, totGrandQ = 0;
        let html = '';

        sortedMonths.forEach(m => {
            totFatV += m.fatV;
            totFatQ += m.fatQ;
            totExtV += m.extV;
            totExtQ += m.extQ;
            totGrandV += m.totalV;
            totGrandQ += m.totalQ;

            html += `
                <tr>
                    <td style="font-weight: 600; color: var(--text-primary);">${escapeHTML(m.label)}</td>
                    <td style="text-align: right; font-weight: 600; color: #34d399;" class="font-mono">${formatBRL(m.fatV)}</td>
                    <td style="text-align: right; font-size: 0.78rem; color: #94a3b8;" class="font-mono">${m.fatQ.toLocaleString('pt-BR')}</td>
                    <td style="text-align: right; font-weight: 600; color: #60a5fa;" class="font-mono">${formatBRL(m.extV)}</td>
                    <td style="text-align: right; font-size: 0.78rem; color: #94a3b8;" class="font-mono">${m.extQ.toLocaleString('pt-BR')}</td>
                    <td style="text-align: right; font-weight: 700; color: #fbbf24;" class="font-mono">${formatBRL(m.totalV)}</td>
                    <td style="text-align: right; font-size: 0.78rem; font-weight: 600; color: #f8fafc;" class="font-mono">${m.totalQ.toLocaleString('pt-BR')}</td>
                    <td>
                        <div class="comp-progress-wrap">
                            <div class="comp-progress-bar">
                                <div class="comp-bar-fat" style="width: ${m.pctFat.toFixed(1)}%;"></div>
                                <div class="comp-bar-ext" style="width: ${m.pctExt.toFixed(1)}%;"></div>
                            </div>
                            <div class="comp-progress-labels">
                                <span style="color: #34d399;">${m.pctFat.toFixed(0)}% Fat</span>
                                <span style="color: #60a5fa;">${m.pctExt.toFixed(0)}% Entr</span>
                            </div>
                        </div>
                    </td>
                    <td style="text-align: right; font-size: 0.78rem;" class="font-mono">${m.fatStoresCount} lojas</td>
                    <td style="text-align: right; font-size: 0.78rem;" class="font-mono">${m.extStoresCount} lojas</td>
                </tr>
            `;
        });

        const totalPctFat = totGrandV > 0 ? (totFatV / totGrandV * 100) : 0;
        const totalPctExt = totGrandV > 0 ? (totExtV / totGrandV * 100) : 0;

        tbody.innerHTML = html;

        const tfoot = document.getElementById('comp-tfoot-month');
        if (tfoot) {
            tfoot.innerHTML = `
                <tr style="background: #0f172a; font-weight: 700; border-top: 2px solid rgba(255,255,255,0.2); position: sticky; bottom: 0; z-index: 3;">
                    <td style="color: var(--accent-color, #3b82f6); text-transform: uppercase; font-size: 0.72rem; white-space: nowrap;">Total Consolidado</td>
                    <td style="text-align: right; color: #34d399; font-size: 0.75rem; white-space: nowrap;" class="font-mono">${formatBRL(totFatV)}</td>
                    <td style="text-align: right; color: #94a3b8; font-size: 0.74rem; white-space: nowrap;" class="font-mono">${totFatQ.toLocaleString('pt-BR')}</td>
                    <td style="text-align: right; color: #60a5fa; font-size: 0.75rem; white-space: nowrap;" class="font-mono">${formatBRL(totExtV)}</td>
                    <td style="text-align: right; color: #94a3b8; font-size: 0.74rem; white-space: nowrap;" class="font-mono">${totExtQ.toLocaleString('pt-BR')}</td>
                    <td style="text-align: right; color: #fbbf24; font-size: 0.78rem; white-space: nowrap;" class="font-mono">${formatBRL(totGrandV)}</td>
                    <td style="text-align: right; color: #ffffff; font-size: 0.74rem; white-space: nowrap;" class="font-mono">${totGrandQ.toLocaleString('pt-BR')}</td>
                    <td>
                        <div class="comp-progress-wrap">
                            <div class="comp-progress-bar">
                                <div class="comp-bar-fat" style="width: ${totalPctFat.toFixed(1)}%;"></div>
                                <div class="comp-bar-ext" style="width: ${totalPctExt.toFixed(1)}%;"></div>
                            </div>
                            <div class="comp-progress-labels">
                                <span style="color: #34d399;">${totalPctFat.toFixed(0)}%</span>
                                <span style="color: #60a5fa;">${totalPctExt.toFixed(0)}%</span>
                            </div>
                        </div>
                    </td>
                    <td style="text-align: right; font-size: 0.74rem;" class="font-mono">-</td>
                    <td style="text-align: right; font-size: 0.74rem;" class="font-mono">-</td>
                </tr>
            `;
        }
    }

    // Ordenação e Agrupamento da Tabela por Data
    window.sortCompDateTable = function(col) {
        if (compDateSortCol === col) {
            compDateSortDir = (compDateSortDir === 'desc') ? 'asc' : 'desc';
        } else {
            compDateSortCol = col;
            compDateSortDir = (col === 'weekday' || col === 'status' || col === 'date') ? 'asc' : 'desc';
        }
        renderCompDateTable();
    };

    window.toggleCompDateGrouping = function() {
        compDateGroupByMonth = !compDateGroupByMonth;
        const btn = document.getElementById('btn-comp-date-group-toggle');
        if (btn) {
            btn.classList.toggle('active', compDateGroupByMonth);
            btn.innerHTML = `<i class='bx ${compDateGroupByMonth ? 'bx-folder' : 'bx-list-ul'}'></i> ${compDateGroupByMonth ? 'Agrupado por M&ecirc;s' : 'Lista Corrida (Dias)'}`;
        }
        const btnExp = document.getElementById('btn-comp-date-expand-all');
        if (btnExp) {
            btnExp.style.display = compDateGroupByMonth ? 'inline-flex' : 'none';
        }
        renderCompDateTable();
    };

    window.toggleCompDateMonth = function(monthKey, event) {
        if (event) event.stopPropagation();
        if (compDateCollapsedMonths.has(monthKey)) {
            compDateCollapsedMonths.delete(monthKey);
        } else {
            compDateCollapsedMonths.add(monthKey);
        }
        renderCompDateTable();
    };

    window.toggleAllCompDateMonths = function() {
        const allMonthKeys = new Set();
        currentCompDateList.forEach(d => {
            if (d.monthKey) allMonthKeys.add(d.monthKey);
        });

        if (compDateCollapsedMonths.size === allMonthKeys.size) {
            compDateCollapsedMonths.clear();
        } else {
            allMonthKeys.forEach(k => compDateCollapsedMonths.add(k));
        }

        const label = document.getElementById('label-comp-date-expand-all');
        const icon = document.getElementById('icon-comp-date-expand-all');
        const isAllCollapsed = (allMonthKeys.size > 0 && compDateCollapsedMonths.size === allMonthKeys.size);
        if (label) label.textContent = isAllCollapsed ? 'Expandir Todos' : 'Recolher Todos';
        if (icon) icon.className = isAllCollapsed ? 'bx bx-expand-vertical' : 'bx bx-collapse-vertical';

        renderCompDateTable();
    };

    function renderCompDateTable() {
        const tbody = document.getElementById('comp-tbody-date');
        if (!tbody) return;

        // Atualizar classes e ícones dos cabeçalhos da tabela de datas
        const dateCols = ['date', 'weekday', 'fatV', 'fatQ', 'extV', 'extQ', 'totalV', 'status'];
        dateCols.forEach(col => {
            const th = document.getElementById(`th-date-${col}`);
            if (th) {
                const icon = th.querySelector('.th-sort-icon i');
                if (col === compDateSortCol) {
                    th.classList.add('active-sort');
                    if (icon) icon.className = (compDateSortDir === 'desc') ? 'bx bx-sort-down' : 'bx bx-sort-up';
                } else {
                    th.classList.remove('active-sort');
                    if (icon) icon.className = 'bx bx-sort';
                }
            }
        });

        if (currentCompDateList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);"><i class='bx bx-calendar-x' style="font-size: 2rem; display: block; margin-bottom: 0.5rem; opacity: 0.4;"></i>Nenhum lançamento no período selecionado.</td></tr>`;
            const summaryBadge = document.getElementById('comp-date-summary-badge');
            if (summaryBadge) summaryBadge.innerHTML = '0 meses &bull; 0 datas';
    
        }

        // 1. Agrupar os itens por mês
        const monthGroupsMap = new Map();
        const monthNamesFull = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        currentCompDateList.forEach(d => {
            let mKey = d.monthKey;
            let mLabel = d.monthLabel;
            if (!mKey) {
                const dObj = parseDateBR(d.dateStr);
                if (dObj) {
                    mKey = `${dObj.getFullYear()}-${(dObj.getMonth() + 1).toString().padStart(2, '0')}`;
                    mLabel = `${monthNamesFull[dObj.getMonth()]} / ${dObj.getFullYear()}`;
                    d.monthKey = mKey;
                    d.monthLabel = mLabel;
                } else {
                    mKey = 'OUTROS';
                    mLabel = 'Outras Datas';
                }
            }

            if (!monthGroupsMap.has(mKey)) {
                monthGroupsMap.set(mKey, {
                    monthKey: mKey,
                    monthLabel: mLabel,
                    days: [],
                    fatV: 0,
                    fatQ: 0,
                    extV: 0,
                    extQ: 0,
                    totalV: 0,
                    totalQ: 0,
                    latestTimestamp: 0
                });
            }

            const g = monthGroupsMap.get(mKey);
            g.days.push(d);
            g.fatV += d.fatV || 0;
            g.fatQ += d.fatQ || 0;
            g.extV += d.extV || 0;
            g.extQ += d.extQ || 0;
            g.totalV += d.totalV || 0;
            g.totalQ += d.totalQ || 0;
            if ((d.timestamp || 0) > g.latestTimestamp) {
                g.latestTimestamp = d.timestamp || 0;
            }
        });

        const monthGroups = Array.from(monthGroupsMap.values());

        // Atualizar contador do topo
        const summaryBadge = document.getElementById('comp-date-summary-badge');
        if (summaryBadge) {
            summaryBadge.innerHTML = `<span style="color: var(--accent-color, #3b82f6); font-weight: 600;">${monthGroups.length}</span> ${monthGroups.length === 1 ? "mês" : "meses"} &nbsp;&bull;&nbsp; <span style="color: #fbbf24; font-weight: 600;">${currentCompDateList.length}</span> ${currentCompDateList.length === 1 ? "data" : "datas"}`;
        }

        // Função comparadora para ordenar dias individuais
        const sortDaysFn = (a, b) => {
            let res = 0;
            if (compDateSortCol === 'date') {
                res = (b.timestamp || 0) - (a.timestamp || 0);
            } else if (compDateSortCol === 'weekday') {
                res = (a.weekDay || '').localeCompare(b.weekDay || '');
            } else if (compDateSortCol === 'fatV') {
                res = (b.fatV || 0) - (a.fatV || 0);
            } else if (compDateSortCol === 'fatQ') {
                res = (b.fatQ || 0) - (a.fatQ || 0);
            } else if (compDateSortCol === 'extV') {
                res = (b.extV || 0) - (a.extV || 0);
            } else if (compDateSortCol === 'extQ') {
                res = (b.extQ || 0) - (a.extQ || 0);
            } else if (compDateSortCol === 'totalV') {
                res = (b.totalV || 0) - (a.totalV || 0);
            } else if (compDateSortCol === 'status') {
                res = (a.status || '').localeCompare(b.status || '');
            }
            return (compDateSortDir === 'desc') ? res : -res;
        };

        let html = '';

        if (compDateGroupByMonth) {
            // Ordenar os grupos mensais
            monthGroups.sort((a, b) => {
                let res = 0;
                if (compDateSortCol === 'date') {
                    res = b.monthKey.localeCompare(a.monthKey);
                } else if (['fatV', 'fatQ', 'extV', 'extQ', 'totalV'].includes(compDateSortCol)) {
                    res = (b[compDateSortCol] || 0) - (a[compDateSortCol] || 0);
                } else {
                    res = b.monthKey.localeCompare(a.monthKey);
                }
                return (compDateSortDir === 'desc') ? res : -res;
            });

            // Para cada mês, ordena seus dias internos
            monthGroups.forEach(m => {
                m.days.sort(sortDaysFn);
                const isCollapsed = compDateCollapsedMonths.has(m.monthKey);

                // Determinar badge de status do mês
                let monthStatusBadge = '';
                if (m.fatV > 0 && m.extV > 0) {
                    monthStatusBadge = `<span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc; font-size: 0.72rem; padding: 2px 7px; border-radius: 4px;">Faturado & Programado</span>`;
                } else if (m.fatV > 0) {
                    monthStatusBadge = `<span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #93c5fd; font-size: 0.72rem; padding: 2px 7px; border-radius: 4px;">Somente Faturado</span>`;
                } else {
                    monthStatusBadge = `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #6ee7b7; font-size: 0.72rem; padding: 2px 7px; border-radius: 4px;">Somente Programado</span>`;
                }

                // Linha de Cabeçalho do Mês
                html += `
                    <tr class="comp-month-group-row" onclick="toggleCompDateMonth('${m.monthKey}')" title="Clique para expandir ou recolher os dias deste mês">
                        <td style="font-weight: 700; color: #ffffff; font-size: 0.85rem;">
                            <div style="display: flex; align-items: center; gap: 0.45rem;">
                                <i class='bx ${isCollapsed ? 'bx-chevron-right' : 'bx-chevron-down'}' style="font-size: 1.15rem; color: var(--accent-color, #3b82f6);"></i>
                                <i class='bx bx-calendar' style="color: #94a3b8; font-size: 0.95rem;"></i>
                                <span>${escapeHTML(m.monthLabel)}</span>
                            </div>
                        </td>
                        <td>
                            <span class="badge" style="background: rgba(255,255,255,0.08); color: #cbd5e1; font-size: 0.72rem; padding: 2px 7px; border-radius: 4px; font-weight: 500;">
                                ${m.days.length} ${m.days.length === 1 ? 'dia' : 'dias'}
                            </span>
                        </td>
                        <td style="text-align: right; font-weight: 700; color: #34d399;" class="font-mono">${formatBRL(m.fatV)}</td>
                        <td style="text-align: right; font-weight: 600; color: #94a3b8;" class="font-mono">${m.fatQ.toLocaleString('pt-BR')}</td>
                        <td style="text-align: right; font-weight: 700; color: #60a5fa;" class="font-mono">${formatBRL(m.extV)}</td>
                        <td style="text-align: right; font-weight: 600; color: #94a3b8;" class="font-mono">${m.extQ.toLocaleString('pt-BR')}</td>
                        <td style="text-align: right; font-weight: 800; color: #fbbf24; font-size: 0.88rem;" class="font-mono">${formatBRL(m.totalV)}</td>
                        <td style="text-align: center;">${monthStatusBadge}</td>
                    </tr>
                `;

                // Linhas de cada dia do mês (se não estiver recolhido)
                if (!isCollapsed) {
                    m.days.forEach(d => {
                        let statusBadge = '';
                        if (d.status === 'Faturado e Programado') {
                            statusBadge = `<span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; font-size: 0.68rem; padding: 2px 6px; border-radius: 4px;">Faturado & Programado</span>`;
                        } else if (d.status === 'Somente Faturado') {
                            statusBadge = `<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; font-size: 0.68rem; padding: 2px 6px; border-radius: 4px;">Somente Faturado</span>`;
                        } else {
                            statusBadge = `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 0.68rem; padding: 2px 6px; border-radius: 4px;">Somente Programado</span>`;
                        }

                        html += `
                            <tr class="comp-date-day-row">
                                <td style="padding-left: 1.8rem;">
                                    <i class='bx bx-subdirectory-right' style="color: #64748b; margin-right: 5px; font-size: 0.95rem; vertical-align: middle;"></i>
                                    <span class="font-mono text-accent" style="font-weight: 600; font-size: 0.8rem;">${escapeHTML(d.dateStr)}</span>
                                </td>
                                <td style="font-size: 0.78rem; color: var(--text-secondary);">${escapeHTML(d.weekDay)}</td>
                                <td style="text-align: right; font-weight: 600; color: #34d399;" class="font-mono">${formatBRL(d.fatV)}</td>
                                <td style="text-align: right; font-size: 0.78rem; color: #94a3b8;" class="font-mono">${d.fatQ.toLocaleString('pt-BR')}</td>
                                <td style="text-align: right; font-weight: 600; color: #60a5fa;" class="font-mono">${formatBRL(d.extV)}</td>
                                <td style="text-align: right; font-size: 0.78rem; color: #94a3b8;" class="font-mono">${d.extQ.toLocaleString('pt-BR')}</td>
                                <td style="text-align: right; font-weight: 700; color: #fbbf24;" class="font-mono">${formatBRL(d.totalV)}</td>
                                <td style="text-align: center;">${statusBadge}</td>
                            </tr>
                        `;
                    });
                }
            });
        } else {
            // Exibição em lista corrida contínua
            const sortedDays = [...currentCompDateList].sort(sortDaysFn);
            sortedDays.forEach(d => {
                let statusBadge = '';
                if (d.status === 'Faturado e Programado') {
                    statusBadge = `<span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; font-size: 0.68rem; padding: 2px 6px; border-radius: 4px;">Faturado & Programado</span>`;
                } else if (d.status === 'Somente Faturado') {
                    statusBadge = `<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; font-size: 0.68rem; padding: 2px 6px; border-radius: 4px;">Somente Faturado</span>`;
                } else {
                    statusBadge = `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 0.68rem; padding: 2px 6px; border-radius: 4px;">Somente Programado</span>`;
                }

                html += `
                    <tr>
                        <td class="font-mono text-accent" style="font-weight: 600;">${escapeHTML(d.dateStr)}</td>
                        <td style="font-size: 0.78rem; color: var(--text-secondary);">${escapeHTML(d.weekDay)}</td>
                        <td style="text-align: right; font-weight: 600; color: #34d399;" class="font-mono">${formatBRL(d.fatV)}</td>
                        <td style="text-align: right; font-size: 0.78rem; color: #94a3b8;" class="font-mono">${d.fatQ.toLocaleString('pt-BR')}</td>
                        <td style="text-align: right; font-weight: 600; color: #60a5fa;" class="font-mono">${formatBRL(d.extV)}</td>
                        <td style="text-align: right; font-size: 0.78rem; color: #94a3b8;" class="font-mono">${d.extQ.toLocaleString('pt-BR')}</td>
                        <td style="text-align: right; font-weight: 700; color: #fbbf24;" class="font-mono">${formatBRL(d.totalV)}</td>
                        <td style="text-align: center;">${statusBadge}</td>
                    </tr>
                `;
            });
        }

        // Linha de Total Consolidado da tabela de datas
        let sumDateFatV = 0, sumDateFatQ = 0, sumDateExtV = 0, sumDateExtQ = 0, sumDateTotalV = 0;
        currentCompDateList.forEach(d => {
            sumDateFatV += d.fatV || 0;
            sumDateFatQ += d.fatQ || 0;
            sumDateExtV += d.extV || 0;
            sumDateExtQ += d.extQ || 0;
            sumDateTotalV += d.totalV || 0;
        });

        html += `
            <tr style="background: rgba(30, 41, 59, 0.95); font-weight: 700; border-top: 2px solid rgba(255,255,255,0.18); position: sticky; bottom: 0; z-index: 2;">
                <td style="color: var(--accent-color, #3b82f6); text-transform: uppercase;">TOTAL CONSOLIDADO (${currentCompDateList.length} ${currentCompDateList.length === 1 ? 'data' : 'datas'})</td>
                <td style="color: var(--text-secondary); font-size: 0.78rem;">${monthGroups.length} ${monthGroups.length === 1 ? 'mês' : 'meses'}</td>
                <td style="text-align: right; color: #34d399;" class="font-mono">${formatBRL(sumDateFatV)}</td>
                <td style="text-align: right; color: #94a3b8;" class="font-mono">${sumDateFatQ.toLocaleString('pt-BR')}</td>
                <td style="text-align: right; color: #60a5fa;" class="font-mono">${formatBRL(sumDateExtV)}</td>
                <td style="text-align: right; color: #94a3b8;" class="font-mono">${sumDateExtQ.toLocaleString('pt-BR')}</td>
                <td style="text-align: right; font-weight: 800; color: #fbbf24; font-size: 0.88rem;" class="font-mono">${formatBRL(sumDateTotalV)}</td>
                <td style="text-align: center;">
                    <span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fcd34d; font-size: 0.72rem; padding: 2px 7px; border-radius: 4px;">Geral Consolidado</span>
                </td>
            </tr>
        `;

        tbody.innerHTML = html;
    }

    window.switchComparisonSubTab = function(tabName) {
        currentCompSubTab = tabName;
        const btnCnpj = document.getElementById('btn-subtab-cnpj');
        const btnMonth = document.getElementById('btn-subtab-month');
        const btnDate = document.getElementById('btn-subtab-date');

        if (btnCnpj) btnCnpj.classList.toggle('active', tabName === 'cnpj');
        if (btnMonth) btnMonth.classList.toggle('active', tabName === 'month');
        if (btnDate) btnDate.classList.toggle('active', tabName === 'date');
        const btnProduct = document.getElementById('btn-subtab-product');
        if (btnProduct) btnProduct.classList.toggle('active', tabName === 'product');

        const tabCnpj = document.getElementById('comp-tab-content-cnpj');
        const tabMonth = document.getElementById('comp-tab-content-month');
        const tabDate = document.getElementById('comp-tab-content-date');
        const tabProduct = document.getElementById('comp-tab-content-product');
        const controlsBar = document.getElementById('comp-controls-bar');

        if (tabCnpj) tabCnpj.style.display = (tabName === 'cnpj') ? 'block' : 'none';
        if (tabMonth) tabMonth.style.display = (tabName === 'month') ? 'block' : 'none';
        if (tabDate) tabDate.style.display = (tabName === 'date') ? 'block' : 'none';
        if (tabProduct) tabProduct.style.display = (tabName === 'product') ? 'block' : 'none';
        if (controlsBar) controlsBar.style.display = (tabName === 'cnpj') ? 'flex' : 'none';
    };

    window.onComparisonSearchInput = function(val) {
        currentCompSearch = val || '';
        renderCompCnpjTable();
    };

    window.onComparisonSortChange = function(sortVal) {
        currentCompSort = sortVal || 'total_desc';
        renderCompCnpjTable();
    };

    window.toggleCompDetail = function(cnpjKey) {
        if (compExpandedCnpjs.has(cnpjKey)) {
            compExpandedCnpjs.delete(cnpjKey);
        } else {
            compExpandedCnpjs.add(cnpjKey);
        }
        renderCompCnpjTable();
    };

    window.exportComparisonToExcel = function() {
        if (!window.XLSX) {
            window.showNotification('Biblioteca Excel não disponível.', 'error');
    
        }

        try {
            const wb = XLSX.utils.book_new();

            // 1. Aba Por CNPJ
            const cnpjExportRows = currentCompCnpjList.map(c => ({
                'CNPJ': c.cnpjFormatted,
                'Nome Fantasia': c.fantasia,
                'Razão Social': c.razao,
                'Cidade': c.cidade,
                'Rede / Grupo': c.rede,
                'Faturamento Realizado (R$)': c.fatV,
                'Peças Faturadas': c.fatQ,
                'A Entregar / Carteira (R$)': c.extV,
                'Peças A Entregar': c.extQ,
                'Total Geral Previsto (R$)': c.totalV,
                'Total Peças': c.totalQ,
                '% Faturado': +(c.pctFat.toFixed(2)),
                '% A Entregar': +(c.pctExt.toFixed(2))
            }));
            const wsCnpj = XLSX.utils.json_to_sheet(cnpjExportRows);
            XLSX.utils.book_append_sheet(wb, wsCnpj, 'Confronto por CNPJ');

            // 2. Aba Por Mês
            const monthExportRows = currentCompMonthList.map(m => ({
                'Mês / Ano': m.label,
                'Faturamento Realizado (R$)': m.fatV,
                'Peças Faturadas': m.fatQ,
                'A Entregar (R$)': m.extV,
                'Peças A Entregar': m.extQ,
                'Total Consolidado (R$)': m.totalV,
                'Total Peças': m.totalQ,
                '% Faturado': +(m.pctFat.toFixed(2)),
                '% A Entregar': +(m.pctExt.toFixed(2)),
                'Lojas Faturadas': m.fatStoresCount,
                'Lojas em Carteira': m.extStoresCount
            }));
            const wsMonth = XLSX.utils.json_to_sheet(monthExportRows);
            XLSX.utils.book_append_sheet(wb, wsMonth, 'Confronto Mensal');

            // 3. Aba Por Data
            const dateExportRows = currentCompDateList.map(d => ({
                'Data': d.dateStr,
                'Dia da Semana': d.weekDay,
                'Mês / Ano': d.monthLabel || '',
                'Faturamento no Dia (R$)': d.fatV,
                'Peças Faturadas': d.fatQ,
                'A Entregar no Dia (R$)': d.extV,
                'Peças A Entregar': d.extQ,
                'Total do Dia (R$)': d.totalV,
                'Status': d.status
            }));
            const wsDate = XLSX.utils.json_to_sheet(dateExportRows);
            XLSX.utils.book_append_sheet(wb, wsDate, 'Confronto Diário');

            // 4. Aba Por Produto (SKU)
            const prodExportRows = currentCompProductList.map(p => ({
                'Código / Referência': p.code,
                'Descrição': p.desc,
                'Cor': p.cor || '',
                'Sub-Grupo': p.sub,
                'Divisão / Classe': p.cl,
                'Faturamento Realizado (R$)': p.fatV,
                'Peças Faturadas': p.fatQ,
                'A Entregar (R$)': p.extV,
                'Peças A Entregar': p.extQ,
                'Total Previsto (R$)': p.totalV,
                'Total Peças': p.totalQ,
                '% Faturado': +(p.pctFat.toFixed(2)),
                '% A Entregar': +(p.pctExt.toFixed(2)),
                'Status': p.status
            }));
            const wsProd = XLSX.utils.json_to_sheet(prodExportRows);
            XLSX.utils.book_append_sheet(wb, wsProd, 'Confronto por Produto');

            const now = new Date();
            const dateSuffix = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}`;
            XLSX.writeFile(wb, `NEW_ERA_CONFRONTO_A_ENTREGAR_X_FATURAMENTO_${dateSuffix}.xlsx`);
            window.showNotification('Confronto exportado com sucesso para Excel!', 'success');
        } catch (err) {
            console.error('Erro ao exportar confronto para Excel:', err);
            window.showNotification('Erro ao exportar: ' + err.message, 'error');
        }
    };

    // ==========================================================================
    // 5. CONFRONTO: DESEMPENHO DE PRODUTOS & SUB-ABA DE PRODUTOS
    // ==========================================================================

    window.sortCompProductTable = function(col) {
        if (compProductSortCol === col) {
            compProductSortDir = (compProductSortDir === 'desc') ? 'asc' : 'desc';
        } else {
            compProductSortCol = col;
            compProductSortDir = ['code', 'desc', 'sub', 'cl', 'status'].includes(col) ? 'asc' : 'desc';
        }
        renderCompProductTable();
    };

    window.onComparisonProductSearchInput = function(val) {
        currentCompProductSearch = val || '';
        renderCompProductTable();
    };

    window.onComparisonProductSortChange = function(val) {
        currentCompProductSort = val || 'total_desc';
        if (val === 'total_desc') { compProductSortCol = 'totalV'; compProductSortDir = 'desc'; }
        else if (val === 'fat_desc') { compProductSortCol = 'fatV'; compProductSortDir = 'desc'; }
        else if (val === 'ext_desc') { compProductSortCol = 'extV'; compProductSortDir = 'desc'; }
        else if (val === 'qty_desc') { compProductSortCol = 'totalQ'; compProductSortDir = 'desc'; }
        else if (val === 'pct_fat_desc') { compProductSortCol = 'pctFat'; compProductSortDir = 'desc'; }
        else if (val === 'pct_ext_desc') { compProductSortCol = 'pctExt'; compProductSortDir = 'desc'; }
        else if (val === 'name_asc') { compProductSortCol = 'code'; compProductSortDir = 'asc'; }
        renderCompProductTable();
    };

    window.setCompRankingLimit = function(val) {
        compRankingDisplayLimit = (val === 'all') ? 'all' : parseInt(val, 10);
        renderCompProductRankings(currentCompProductList, lastCompFilteredBilling, lastCompFilteredExtrato, buildClientsMap());
    };

    function renderCompProductTable() {
        const tbody = document.getElementById('comp-tbody-product');
        const tfoot = document.getElementById('comp-tfoot-product');
        const badge = document.getElementById('comp-product-summary-badge');
        if (!tbody) return;

        // Atualizar headers visuais de ordenação
        document.querySelectorAll('#comp-table-product th.sortable').forEach(th => {
            th.classList.remove('active-sort');
            const icon = th.querySelector('.th-sort-icon i');
            if (icon) icon.className = 'bx bx-sort';
        });
        const activeTh = document.getElementById(`th-prod-${compProductSortCol}`);
        if (activeTh) {
            activeTh.classList.add('active-sort');
            const icon = activeTh.querySelector('.th-sort-icon i');
            if (icon) icon.className = (compProductSortDir === 'desc') ? 'bx bx-sort-down' : 'bx bx-sort-up';
        }

        let filtered = [...currentCompProductList];
        if (currentCompProductSearch) {
            const qText = currentCompProductSearch.trim().toLowerCase();
            filtered = filtered.filter(p => {
                return (p.code && p.code.toLowerCase().includes(qText)) ||
                       (p.desc && p.desc.toLowerCase().includes(qText)) ||
                       (p.sub && p.sub.toLowerCase().includes(qText)) ||
                       (p.cl && p.cl.toLowerCase().includes(qText)) ||
                       (p.cor && p.cor.toLowerCase().includes(qText)) || (p.corNome && p.corNome.toLowerCase().includes(qText));
            });
        }

        filtered.sort((a, b) => {
            let res = 0;
            if (['code', 'desc', 'sub', 'cl', 'status'].includes(compProductSortCol)) {
                res = (a[compProductSortCol] || '').localeCompare(b[compProductSortCol] || '');
            } else {
                res = (a[compProductSortCol] || 0) - (b[compProductSortCol] || 0);
            }
            return (compProductSortDir === 'desc') ? -res : res;
        });

        if (badge) {
            const fatCount = currentCompProductList.filter(p => p.fatV > 0).length;
            const extCount = currentCompProductList.filter(p => p.extV > 0).length;
            badge.textContent = `${filtered.length} Produtos (${fatCount} Fat • ${extCount} Carteira)`;
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary);">
                        <i class='bx bx-search-alt' style="font-size: 2.2rem; display: block; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                        Nenhum produto ou referência encontrado para a busca selecionada.
                    </td>
                </tr>
            `;
            if (tfoot) tfoot.innerHTML = '';
            return;
        }

        let sumFatV = 0, sumFatQ = 0, sumExtV = 0, sumExtQ = 0, sumTotalV = 0, sumTotalQ = 0;

        let rowsHtml = '';
        filtered.forEach(p => {
            sumFatV += p.fatV;
            sumFatQ += p.fatQ;
            sumExtV += p.extV;
            sumExtQ += p.extQ;
            sumTotalV += p.totalV;
            sumTotalQ += p.totalQ;

            const urls = getProductImageUrls(p.code, p.cor);
            const thumbHtml = urls.primaryUrl ? `
                <div class="ranking-product-thumb-container" onclick="openProductImageModal('${escapeHTML(p.code)}', '${escapeHTML(p.cor || '')}', '${escapeHTML(p.desc)}')" title="Clique para ampliar foto" style="width: 38px; height: 38px; margin: 0 auto;">
                    <img class="ranking-product-thumb-img" src="${urls.primaryUrl}" alt="${escapeHTML(p.desc)}" loading="lazy" ${urls.fallbacks && urls.fallbacks.length > 0 ? `data-fallbacks="${urls.fallbacks.join('|')}"` : ''} onerror="onRankingProductImgError(this)" />
                    <div class="ranking-product-thumb-placeholder" style="display: none;"><i class='bx bx-image-alt'></i></div>
                </div>
            ` : `
                <div class="ranking-product-thumb-container" style="width: 38px; height: 38px; margin: 0 auto;">
                    <div class="ranking-product-thumb-placeholder" style="display: flex;"><i class='bx bx-purchase-tag-alt'></i></div>
                </div>
            `;

            const refDisplay = p.code ? `<span style="font-weight: 700; color: #f8fafc; font-family: monospace;">${escapeHTML(p.code)}</span>` : '';
            const corDisplay = p.cor ? `<span style="font-size: 0.72rem; color: #818cf8; margin-left: 6px; font-weight: 600; background: rgba(99, 102, 241, 0.15); padding: 1px 6px; border-radius: 4px;">Cor: ${escapeHTML(p.cor)}${p.corNome ? ' (' + escapeHTML(p.corNome) + ')' : ''}</span>` : '';

            rowsHtml += `
                <tr class="comp-row">
                    <td style="text-align: center; vertical-align: middle; padding: 0.4rem;">${thumbHtml}</td>
                    <td>
                        <div style="display: flex; align-items: center; flex-wrap: wrap;">${refDisplay}${corDisplay}</div>
                        <div style="font-size: 0.74rem; color: var(--text-secondary); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHTML(p.desc)}">${escapeHTML(p.desc)}</div>
                    </td>
                    <td style="font-size: 0.78rem; color: #cbd5e1;">${escapeHTML(p.sub || '-')}</td>
                    <td style="font-size: 0.78rem; color: #94a3b8;"><span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">${escapeHTML(p.cl || '-')}</span></td>
                    <td style="text-align: right; font-weight: 600; color: #34d399;" class="font-mono">${formatBRL(p.fatV)}</td>
                    <td style="text-align: right; font-size: 0.78rem; color: #94a3b8;" class="font-mono">${p.fatQ.toLocaleString('pt-BR')}</td>
                    <td style="text-align: right; font-weight: 600; color: #60a5fa;" class="font-mono">${formatBRL(p.extV)}</td>
                    <td style="text-align: right; font-size: 0.78rem; color: #94a3b8;" class="font-mono">${p.extQ.toLocaleString('pt-BR')}</td>
                    <td style="text-align: right; font-weight: 700; color: #fbbf24;" class="font-mono">${formatBRL(p.totalV)}</td>
                    <td style="text-align: right; font-weight: 600; color: #f8fafc;" class="font-mono">${p.totalQ.toLocaleString('pt-BR')}</td>
                    <td>
                        <div class="comp-progress-wrap">
                            <div class="comp-progress-bar">
                                <div class="comp-bar-fat" style="width: ${p.pctFat.toFixed(1)}%;" title="Faturado: ${p.pctFat.toFixed(1)}%"></div>
                                <div class="comp-bar-ext" style="width: ${p.pctExt.toFixed(1)}%;" title="A Entregar: ${p.pctExt.toFixed(1)}%"></div>
                            </div>
                            <div class="comp-progress-labels">
                                <span style="color: #34d399;">${p.pctFat.toFixed(0)}% Fat</span>
                                <span style="color: #60a5fa;">${p.pctExt.toFixed(0)}% Entr</span>
                            </div>
                        </div>
                    </td>
                    <td style="text-align: center;">
                        <span class="comp-badge-status ${p.statusClass}">${escapeHTML(p.status)}</span>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = rowsHtml;

        if (tfoot) {
            const overallPctFat = sumTotalV > 0 ? (sumFatV / sumTotalV * 100) : 0;
            const overallPctExt = sumTotalV > 0 ? (sumExtV / sumTotalV * 100) : 0;
            tfoot.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: left; font-size: 0.84rem; text-transform: uppercase; letter-spacing: 0.5px;">
                        <i class='bx bx-calculator' style="color: #fbbf24; margin-right: 4px;"></i> TOTAL CONSOLIDADO (${filtered.length} PRODUTOS)
                    </td>
                    <td style="text-align: right; color: #34d399; font-size: 0.85rem;" class="font-mono">${formatBRL(sumFatV)}</td>
                    <td style="text-align: right; color: #94a3b8;" class="font-mono">${sumFatQ.toLocaleString('pt-BR')}</td>
                    <td style="text-align: right; color: #60a5fa; font-size: 0.85rem;" class="font-mono">${formatBRL(sumExtV)}</td>
                    <td style="text-align: right; color: #94a3b8;" class="font-mono">${sumExtQ.toLocaleString('pt-BR')}</td>
                    <td style="text-align: right; font-weight: 800; color: #fbbf24; font-size: 0.9rem;" class="font-mono">${formatBRL(sumTotalV)}</td>
                    <td style="text-align: right; font-weight: 700; color: #f8fafc;" class="font-mono">${sumTotalQ.toLocaleString('pt-BR')}</td>
                    <td>
                        <div class="comp-progress-wrap">
                            <div class="comp-progress-bar">
                                <div class="comp-bar-fat" style="width: ${overallPctFat.toFixed(1)}%;"></div>
                                <div class="comp-bar-ext" style="width: ${overallPctExt.toFixed(1)}%;"></div>
                            </div>
                            <div class="comp-progress-labels">
                                <span style="color: #34d399;">${overallPctFat.toFixed(0)}% Fat</span>
                                <span style="color: #60a5fa;">${overallPctExt.toFixed(0)}% Entr</span>
                            </div>
                        </div>
                    </td>
                    <td style="text-align: center;">
                        <span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fcd34d; font-size: 0.72rem; padding: 3px 8px; border-radius: 4px;">Consolidado</span>
                    </td>
                </tr>
            `;
        }
    }

    function updateCompProductKpis(productList) {
        const container = document.getElementById('comp-product-kpis-grid');
        if (!container) return;

        const totalSkus = productList.length;
        const skusFat = productList.filter(p => p.fatV > 0 || p.fatQ > 0).length;
        const skusExt = productList.filter(p => p.extV > 0 || p.extQ > 0).length;
        const skusCompleted = productList.filter(p => p.fatV > 0 && p.extV === 0).length;

        let totalFatQ = 0, totalExtQ = 0, totalFatV = 0, totalExtV = 0;
        productList.forEach(p => {
            totalFatQ += p.fatQ;
            totalExtQ += p.extQ;
            totalFatV += p.fatV;
            totalExtV += p.extV;
        });
        const totalPieces = totalFatQ + totalExtQ;
        const pctPiecesFat = totalPieces > 0 ? (totalFatQ / totalPieces * 100) : 0;
        const pctPiecesExt = totalPieces > 0 ? (totalExtQ / totalPieces * 100) : 0;
        const pctSkusFat = totalSkus > 0 ? (skusFat / totalSkus * 100) : 0;

        // Top Produto Faturado
        const sortedByFat = [...productList].sort((a, b) => b.fatV - a.fatV);
        const topFatProd = sortedByFat.length > 0 && sortedByFat[0].fatV > 0 ? sortedByFat[0] : null;

        // Top Produto a Entregar
        const sortedByExt = [...productList].sort((a, b) => b.extV - a.extV);
        const topExtProd = sortedByExt.length > 0 && sortedByExt[0].extV > 0 ? sortedByExt[0] : null;

        const renderHeroThumb = (p) => {
            if (!p) return '';
            const urls = getProductImageUrls(p.code, p.cor);
            if (urls.primaryUrl) {
                return `
                    <img class="comp-product-hero-thumb" src="${urls.primaryUrl}" alt="${escapeHTML(p.desc)}" onclick="openProductImageModal('${escapeHTML(p.code)}', '${escapeHTML(p.cor || '')}', '${escapeHTML(p.desc)}')" title="Clique para ampliar foto" ${urls.fallbacks && urls.fallbacks.length > 0 ? `data-fallbacks="${urls.fallbacks.join('|')}"` : ''} onerror="onRankingProductImgError(this)" />
                `;
            }
            return `<div class="comp-product-hero-placeholder"><i class='bx bx-purchase-tag-alt'></i></div>`;
        };

        const heroFatHtml = topFatProd ? `
            <div class="comp-product-hero-card">
                ${renderHeroThumb(topFatProd)}
                <div class="comp-product-hero-info">
                    <div class="comp-product-hero-code">${escapeHTML(topFatProd.code)} ${topFatProd.cor ? `<span style="font-size: 0.72rem; color: #34d399; font-weight: normal;">(${escapeHTML(topFatProd.cor)})</span>` : ''}</div>
                    <div class="comp-product-hero-desc" title="${escapeHTML(topFatProd.desc)}">${escapeHTML(topFatProd.desc)}</div>
                    <div class="comp-product-hero-val" style="color: #34d399;">
                        <span>${formatBRL(topFatProd.fatV)}</span>
                        <span style="font-size: 0.74rem; color: var(--text-secondary); font-weight: normal;">• ${topFatProd.fatQ.toLocaleString('pt-BR')} pçs</span>
                    </div>
                </div>
            </div>
        ` : `<div style="color: var(--text-secondary); font-size: 0.82rem; padding: 0.75rem 0;">Nenhum produto faturado no período.</div>`;

        const heroExtHtml = topExtProd ? `
            <div class="comp-product-hero-card">
                ${renderHeroThumb(topExtProd)}
                <div class="comp-product-hero-info">
                    <div class="comp-product-hero-code">${escapeHTML(topExtProd.code)} ${topExtProd.cor ? `<span style="font-size: 0.72rem; color: #60a5fa; font-weight: normal;">(${escapeHTML(topExtProd.cor)})</span>` : ''}</div>
                    <div class="comp-product-hero-desc" title="${escapeHTML(topExtProd.desc)}">${escapeHTML(topExtProd.desc)}</div>
                    <div class="comp-product-hero-val" style="color: #60a5fa;">
                        <span>${formatBRL(topExtProd.extV)}</span>
                        <span style="font-size: 0.74rem; color: var(--text-secondary); font-weight: normal;">• ${topExtProd.extQ.toLocaleString('pt-BR')} pçs</span>
                    </div>
                </div>
            </div>
        ` : `<div style="color: var(--text-secondary); font-size: 0.82rem; padding: 0.75rem 0;">Nenhum pedido em carteira no período.</div>`;

        container.innerHTML = `
            <!-- KPI 1: Mix de SKUs -->
            <div class="kpi-card highlight-purple">
                <div class="kpi-header">
                    <span class="kpi-title">Mix de SKUs (Referências)</span>
                    <div class="kpi-icon-badge"><i class='bx bx-barcode'></i></div>
                </div>
                <div class="kpi-value-container">
                    <div class="kpi-value font-mono">${totalSkus.toLocaleString('pt-BR')} SKUs</div>
                </div>
                <div class="kpi-footer" style="flex-direction: column; align-items: flex-start; gap: 0.35rem;">
                    <div style="font-size: 0.78rem; color: var(--text-secondary);">
                        <span style="color: #34d399; font-weight: 600;">${skusFat} faturados (${pctSkusFat.toFixed(0)}%)</span> &bull; 
                        <span style="color: #60a5fa; font-weight: 600;">${skusExt} em carteira</span>
                    </div>
                    <div style="font-size: 0.73rem; color: var(--text-secondary);">
                        ${skusCompleted} SKUs já 100% concluídos
                    </div>
                </div>
            </div>

            <!-- KPI 2: Volume Físico de Peças -->
            <div class="kpi-card highlight-amber">
                <div class="kpi-header">
                    <span class="kpi-title">Peças Programadas vs Faturadas</span>
                    <div class="kpi-icon-badge"><i class='bx bx-package'></i></div>
                </div>
                <div class="kpi-value-container">
                    <div class="kpi-value font-mono" style="font-size: 1.35rem;">${totalFatQ.toLocaleString('pt-BR')} <span style="font-size: 0.88rem; color: var(--text-secondary); font-weight: normal;">/ ${totalPieces.toLocaleString('pt-BR')} pçs</span></div>
                </div>
                <div class="kpi-footer" style="flex-direction: column; align-items: stretch; gap: 0.4rem;">
                    <div class="comp-progress-wrap" style="width: 100%;">
                        <div class="comp-progress-bar">
                            <div class="comp-bar-fat" style="width: ${pctPiecesFat.toFixed(1)}%;"></div>
                            <div class="comp-bar-ext" style="width: ${pctPiecesExt.toFixed(1)}%;"></div>
                        </div>
                        <div class="comp-progress-labels">
                            <span style="color: #34d399; font-weight: 600;">${pctPiecesFat.toFixed(1)}% Realizado</span>
                            <span style="color: #60a5fa; font-weight: 600;">${pctPiecesExt.toFixed(1)}% A Entregar</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- KPI 3: Top Produto Faturado -->
            <div class="kpi-card highlight-emerald">
                <div class="kpi-header">
                    <span class="kpi-title">Top Produto Faturado</span>
                    <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 0.68rem; padding: 2px 7px;">Líder Faturamento</span>
                </div>
                ${heroFatHtml}
            </div>

            <!-- KPI 4: Top Produto a Entregar -->
            <div class="kpi-card highlight-blue">
                <div class="kpi-header">
                    <span class="kpi-title">Top Produto a Entregar (Carteira)</span>
                    <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; font-size: 0.68rem; padding: 2px 7px;">Maior Demanda</span>
                </div>
                ${heroExtHtml}
            </div>
        `;
    }

    function renderCompProductRankings(productList, bData, eData, clientsMap) {
        const prodContainer = document.getElementById('comp-ranking-products-container');
        const subContainer = document.getElementById('comp-ranking-subgroups-container');
        const classContainer = document.getElementById('comp-ranking-classes-container');
        const ordersContainer = document.getElementById('comp-ranking-orders-container');

        const limit = (compRankingDisplayLimit === 'all') ? productList.length : compRankingDisplayLimit;

        // 1. Top Produtos no Confronto
        if (prodContainer) {
            const sorted = [...productList].sort((a, b) => b.totalV - a.totalV).slice(0, limit);
            if (sorted.length === 0) {
                prodContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary); font-size: 0.85rem;">Nenhum produto encontrado.</div>';
            } else {
                let html = '<div class="ranking-items-list" style="max-height: 480px; overflow-y: auto; padding-right: 4px;">';
                sorted.forEach((item, idx) => {
                    const pos = idx + 1;
                    const posBadgeClass = pos === 1 ? 'pos-1' : (pos === 2 ? 'pos-2' : (pos === 3 ? 'pos-3' : 'pos-other'));
                    const urls = getProductImageUrls(item.code, item.cor);
                    const thumbHtml = urls.primaryUrl ? `
                        <div class="ranking-product-thumb-container" onclick="openProductImageModal('${escapeHTML(item.code)}', '${escapeHTML(item.cor || '')}', '${escapeHTML(item.desc)}')" title="Clique para ampliar foto">
                            <img class="ranking-product-thumb-img" src="${urls.primaryUrl}" alt="${escapeHTML(item.desc)}" loading="lazy" ${urls.fallbacks && urls.fallbacks.length > 0 ? `data-fallbacks="${urls.fallbacks.join('|')}"` : ''} onerror="onRankingProductImgError(this)" />
                            <div class="ranking-product-thumb-placeholder" style="display: none;"><i class='bx bx-image-alt'></i></div>
                        </div>
                    ` : `
                        <div class="ranking-product-thumb-container"><div class="ranking-product-thumb-placeholder" style="display: flex;"><i class='bx bx-purchase-tag-alt'></i></div></div>
                    `;

                    html += `
                        <div class="ranking-row-item">
                            <div class="ranking-row-top">
                                <div class="ranking-item-left">
                                    <span class="ranking-pos-badge ${posBadgeClass}">${pos}º</span>
                                    ${thumbHtml}
                                    <div class="ranking-item-info">
                                        <span class="ranking-item-name" title="${escapeHTML(item.desc)}">${escapeHTML(item.desc)}</span>
                                        <span class="ranking-item-sub font-mono">${escapeHTML(item.code)}${item.cor ? ` &bull; Cor: ${escapeHTML(item.cor)}` : ''} &bull; ${escapeHTML(item.sub || '')}</span>
                                    </div>
                                </div>
                                <div class="ranking-item-right comp-rank-split-val">
                                    <span class="val-tot">${formatBRL(item.totalV)}</span>
                                    <div style="font-size: 0.72rem; display: flex; gap: 0.5rem;">
                                        <span class="val-fat">Fat: ${formatBRL(item.fatV)}</span>
                                        <span class="val-ext">Entr: ${formatBRL(item.extV)}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="comp-progress-wrap" style="margin-top: 5px;">
                                <div class="comp-progress-bar">
                                    <div class="comp-bar-fat" style="width: ${item.pctFat.toFixed(1)}%;"></div>
                                    <div class="comp-bar-ext" style="width: ${item.pctExt.toFixed(1)}%;"></div>
                                </div>
                                <div class="comp-progress-labels">
                                    <span style="color: #34d399; font-size: 0.68rem;">${item.pctFat.toFixed(0)}% Fat (${item.fatQ} pçs)</span>
                                    <span style="color: #60a5fa; font-size: 0.68rem;">${item.pctExt.toFixed(0)}% Entr (${item.extQ} pçs)</span>
                                </div>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
                prodContainer.innerHTML = html;
            }
        }

                // 2. Top Grupos de Produto (Consolidado direto de Faturamento e Extrato)
        if (subContainer) {
            const subMap = {};
            (bData || []).forEach(item => {
                const s = (item.sub || 'NÃ£o Definido').trim();
                if (!subMap[s]) subMap[s] = { name: s, fatV: 0, fatQ: 0, extV: 0, extQ: 0 };
                subMap[s].fatV += (item.v || 0);
                subMap[s].fatQ += (item.q || 0);
            });
            (eData || []).forEach(item => {
                const s = (item.sub || 'NÃ£o Definido').trim();
                if (!subMap[s]) subMap[s] = { name: s, fatV: 0, fatQ: 0, extV: 0, extQ: 0 };
                subMap[s].extV += (item.v || 0);
                subMap[s].extQ += (item.q || 0);
            });
            const subSorted = Object.values(subMap).map(s => {
                const totalV = s.fatV + s.extV;
                const totalQ = s.fatQ + s.extQ;
                const pctFat = totalV > 0 ? (s.fatV / totalV * 100) : 0;
                const pctExt = totalV > 0 ? (s.extV / totalV * 100) : 0;
                return { ...s, totalV, totalQ, pctFat, pctExt };
            }).sort((a, b) => b.totalV - a.totalV).slice(0, limit);

            let html = '<div class="ranking-items-list" style="max-height: 480px; overflow-y: auto; padding-right: 4px;">';
            subSorted.forEach((item, idx) => {
                const pos = idx + 1;
                const posBadgeClass = pos === 1 ? 'pos-1' : (pos === 2 ? 'pos-2' : (pos === 3 ? 'pos-3' : 'pos-other'));
                html += `
                    <div class="ranking-row-item">
                        <div class="ranking-row-top">
                            <div class="ranking-item-left">
                                <span class="ranking-pos-badge ${posBadgeClass}">${pos}º</span>
                                <div class="ranking-item-info">
                                    <span class="ranking-item-name">${escapeHTML(item.name)}</span>
                                    <span class="ranking-item-sub">${item.totalQ.toLocaleString('pt-BR')} peças previstas</span>
                                </div>
                            </div>
                            <div class="ranking-item-right comp-rank-split-val">
                                <span class="val-tot">${formatBRL(item.totalV)}</span>
                                <div style="font-size: 0.72rem; display: flex; gap: 0.5rem;">
                                    <span class="val-fat">Fat: ${formatBRL(item.fatV)}</span>
                                    <span class="val-ext">Entr: ${formatBRL(item.extV)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="comp-progress-wrap" style="margin-top: 5px;">
                            <div class="comp-progress-bar">
                                <div class="comp-bar-fat" style="width: ${item.pctFat.toFixed(1)}%;"></div>
                                <div class="comp-bar-ext" style="width: ${item.pctExt.toFixed(1)}%;"></div>
                            </div>
                            <div class="comp-progress-labels">
                                <span style="color: #34d399; font-size: 0.68rem;">${item.pctFat.toFixed(0)}% Fat (${item.fatQ} pçs)</span>
                                <span style="color: #60a5fa; font-size: 0.68rem;">${item.pctExt.toFixed(0)}% Entr (${item.extQ} pçs)</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            subContainer.innerHTML = html;
        }

                // 3. Top DivisÃ£o / Classe (Consolidado direto de Faturamento e Extrato)
        if (classContainer) {
            const classMap = {};
            (bData || []).forEach(item => {
                const c = (item.cl || 'Outros').trim();
                if (!classMap[c]) classMap[c] = { name: c, fatV: 0, fatQ: 0, extV: 0, extQ: 0 };
                classMap[c].fatV += (item.v || 0);
                classMap[c].fatQ += (item.q || 0);
            });
            (eData || []).forEach(item => {
                const c = (item.cl || 'Outros').trim();
                if (!classMap[c]) classMap[c] = { name: c, fatV: 0, fatQ: 0, extV: 0, extQ: 0 };
                classMap[c].extV += (item.v || 0);
                classMap[c].extQ += (item.q || 0);
            });
            const classSorted = Object.values(classMap).map(c => {
                const totalV = c.fatV + c.extV;
                const totalQ = c.fatQ + c.extQ;
                const pctFat = totalV > 0 ? (c.fatV / totalV * 100) : 0;
                const pctExt = totalV > 0 ? (c.extV / totalV * 100) : 0;
                return { ...c, totalV, totalQ, pctFat, pctExt };
            }).sort((a, b) => b.totalV - a.totalV).slice(0, limit);

            let html = '<div class="ranking-items-list" style="max-height: 480px; overflow-y: auto; padding-right: 4px;">';
            classSorted.forEach((item, idx) => {
                const pos = idx + 1;
                const posBadgeClass = pos === 1 ? 'pos-1' : (pos === 2 ? 'pos-2' : (pos === 3 ? 'pos-3' : 'pos-other'));
                html += `
                    <div class="ranking-row-item">
                        <div class="ranking-row-top">
                            <div class="ranking-item-left">
                                <span class="ranking-pos-badge ${posBadgeClass}">${pos}º</span>
                                <div class="ranking-item-info">
                                    <span class="ranking-item-name">${escapeHTML(item.name)}</span>
                                    <span class="ranking-item-sub">${item.totalQ.toLocaleString('pt-BR')} peças previstas</span>
                                </div>
                            </div>
                            <div class="ranking-item-right comp-rank-split-val">
                                <span class="val-tot">${formatBRL(item.totalV)}</span>
                                <div style="font-size: 0.72rem; display: flex; gap: 0.5rem;">
                                    <span class="val-fat">Fat: ${formatBRL(item.fatV)}</span>
                                    <span class="val-ext">Entr: ${formatBRL(item.extV)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="comp-progress-wrap" style="margin-top: 5px;">
                            <div class="comp-progress-bar">
                                <div class="comp-bar-fat" style="width: ${item.pctFat.toFixed(1)}%;"></div>
                                <div class="comp-bar-ext" style="width: ${item.pctExt.toFixed(1)}%;"></div>
                            </div>
                            <div class="comp-progress-labels">
                                <span style="color: #34d399; font-size: 0.68rem;">${item.pctFat.toFixed(0)}% Fat (${item.fatQ} pçs)</span>
                                <span style="color: #60a5fa; font-size: 0.68rem;">${item.pctExt.toFixed(0)}% Entr (${item.extQ} pçs)</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            classContainer.innerHTML = html;
        }

        // 4. Maiores Notas Fiscais (somente faturamento realizado)
        if (ordersContainer) {
            const nfsFatMap = {};
            bData.forEach(item => {
                const num = (item.nf || '').trim();
                const key = num ? `NF_${num}` : `NF_NO_${item.d}_${item.c || Math.random()}`;
                if (!nfsFatMap[key]) {
                    const cMatch = resolveClientForItem(item, clientsMap);
                    nfsFatMap[key] = {
                        name: num ? `NF ${num}` : 'NF s/ número',
                        date: item.d || '-',
                        client: (cMatch && (cMatch['FANTASIA'] || cMatch['NOME FANTASIA'])) || item.f || item.z || 'Cliente',
                        v: 0,
                        q: 0
                    };
                }
                nfsFatMap[key].v += (item.v || 0);
                nfsFatMap[key].q += (item.q || 0);
            });

            const allOrders = Object.values(nfsFatMap)
                .sort((a, b) => (currentKpiDisplayMode === 'pieces') ? (b.q - a.q) : (b.v - a.v))
                .slice(0, limit);

            if (allOrders.length === 0) {
                ordersContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary); font-size: 0.85rem;">Nenhuma nota fiscal encontrada no período.</div>';
            } else {
                let html = '<div class="ranking-items-list" style="max-height: 480px; overflow-y: auto; padding-right: 4px;">';
                allOrders.forEach((item, idx) => {
                    const pos = idx + 1;
                    const posBadgeClass = pos === 1 ? 'pos-1' : (pos === 2 ? 'pos-2' : (pos === 3 ? 'pos-3' : 'pos-other'));
                    html += `
                        <div class="ranking-row-item">
                            <div class="ranking-row-top">
                                <div class="ranking-item-left">
                                    <span class="ranking-pos-badge ${posBadgeClass}">${pos}º</span>
                                    <div class="ranking-item-info">
                                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                                            <span class="ranking-item-name">${escapeHTML(item.name)}</span>
                                        </div>
                                        <span class="ranking-item-sub">${escapeHTML(item.date)} &bull; ${escapeHTML(item.client)}</span>
                                    </div>
                                </div>
                                <div class="ranking-item-right" style="text-align: right;">
                                    <span class="ranking-item-value" style="color: #34d399;">${formatBRL(item.v)}</span>
                                    <span class="ranking-item-sub font-mono">${item.q.toLocaleString('pt-BR')} pçs</span>
                                </div>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
                ordersContainer.innerHTML = html;
            }
        }
    }
})();
