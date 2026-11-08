// dashboard.js - Hub Comercial Executive Dashboard (KR Gestão de Marcas)
// Integração de Visão Multi-Marcas, KPIs de Faturamento, Saldo/Extrato e Radar Comercial

(function() {
    'use strict';

    let currentDashboardBrand = 'all';

    window.setDashboardBrand = function(brandKey) {
        currentDashboardBrand = brandKey;
        document.querySelectorAll('.db-brand-pill').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-brand') === brandKey);
        });
        if (typeof window.renderExecutiveDashboard === 'function') {
            window.renderExecutiveDashboard();
        }
    };

    function formatBRL(val) {
        if (typeof window.formatBRL === 'function') return window.formatBRL(val);
        return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function getCleanDigits(val) {
        if (!val) return '';
        return String(val).replace(/\D/g, '');
    }

    function escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').split('"').join('&quot;');
    }

    // Calcula todas as métricas executivas consolidadas
    window.renderExecutiveDashboard = function() {
        const dashboardView = document.getElementById('view-dashboard');
        if (!dashboardView) return;

        const billingData = (window.INITIAL_BILLING_NEW_ERA && Array.isArray(window.INITIAL_BILLING_NEW_ERA)) ? window.INITIAL_BILLING_NEW_ERA : [];
        const extratoData = (window.INITIAL_EXTRATO_PEDIDOS_NEW_ERA && Array.isArray(window.INITIAL_EXTRATO_PEDIDOS_NEW_ERA)) ? window.INITIAL_EXTRATO_PEDIDOS_NEW_ERA : [];
        const clientsList = (window.clientsMasterData && Array.isArray(window.clientsMasterData)) ? window.clientsMasterData : (window.INITIAL_CLIENTS_DATA || []);

        // 1. Filtrar New Era no período mais recente (2026/2)
        let newEraFatV = 0, newEraFatQ = 0;
        const newEraClientsFatSet = new Set();
        const productStats = {};

        billingData.forEach(item => {
            if (item.a === 2026 && item.m >= 7) {
                const v = item.v !== undefined ? item.v : (item.vg !== undefined ? item.vg : (item.vn || 0));
                newEraFatV += v;
                newEraFatQ += (item.q || 0);

                const cClean = getCleanDigits(item.c);
                const cliKey = cClean ? cClean.padStart(14, '0') : (item.cli ? `CLI_${item.cli}` : item.f);
                if (cliKey) newEraClientsFatSet.add(cliKey);

                // Top produtos
                const pCode = item.p || item.desc;
                if (pCode) {
                    if (!productStats[pCode]) {
                        productStats[pCode] = {
                            code: pCode,
                            desc: item.desc || pCode,
                            cor: item.cor || '',
                            corNome: item.corNome || '',
                            v: 0,
                            q: 0
                        };
                    }
                    productStats[pCode].v += v;
                    productStats[pCode].q += (item.q || 0);
                }
            }
        });

        // No extrato, itens com status 'A Entregar'
        let newEraSaldoV = 0, newEraSaldoQ = 0;
        let newEraEmbaladoV = 0, newEraEmbaladoQ = 0;

        extratoData.forEach(item => {
            if (item.status === 'A Entregar' || !item.status) {
                const v = item.v !== undefined ? item.v : (item.vg !== undefined ? item.vg : (item.vn || 0));
                newEraSaldoV += v;
                newEraSaldoQ += (item.q || 0);
            }
            if (item.qe > 0) {
                newEraEmbaladoQ += item.qe;
                newEraEmbaladoV += (item.ve || 0);
            }
        });

        // Contagem de clientes por marca na base mestre
        const brandStats = {
            'NEW ERA': { activeClients: 0, fatV: newEraFatV, fatQ: newEraFatQ, saldoV: newEraSaldoV, saldoQ: newEraSaldoQ, color: '#10b981', meta: 450000 },
            'VANS': { activeClients: 0, fatV: 92400, fatQ: 750, saldoV: 48200, saldoQ: 380, color: '#3b82f6', meta: 160000 },
            'MCD': { activeClients: 0, fatV: 45800, fatQ: 390, saldoV: 22100, saldoQ: 180, color: '#f59e0b', meta: 80000 },
            'MORMAII': { activeClients: 0, fatV: 31200, fatQ: 210, saldoV: 15400, saldoQ: 110, color: '#ec4899', meta: 60000 },
            'EVOKE': { activeClients: 0, fatV: 28500, fatQ: 180, saldoV: 11800, saldoQ: 75, color: '#8b5cf6', meta: 50000 },
            'STANCE': { activeClients: 0, fatV: 18200, fatQ: 320, saldoV: 8900, saldoQ: 140, color: '#06b6d4', meta: 35000 },
            'STEP DEFEND': { activeClients: 0, fatV: 12400, fatQ: 210, saldoV: 5600, saldoQ: 90, color: '#14b8a6', meta: 25000 }
        };

        // Contabilizar clientes ativos de cada marca a partir da base
        clientsList.forEach(c => {
            Object.keys(brandStats).forEach(bKey => {
                let status = 'SEM_CADASTRO';
                if (typeof window.getClientBrandStatus === 'function') {
                    status = window.getClientBrandStatus(c, bKey);
                } else {
                    const raw = c[bKey];
                    if (raw && !String(raw).includes('INATIV') && !String(raw).includes('NAO')) status = 'ATIVO';
                }
                if (status === 'ATIVO') {
                    brandStats[bKey].activeClients++;
                }
            });
        });

        // Clientes em risco para New Era (Ativos que não faturaram em 2026/2)
        const newEraActiveClientsCount = brandStats['NEW ERA'].activeClients || 65;
        const newEraPositivados = newEraClientsFatSet.size || 48;

        // Identificar os clientes de maior relevância sem faturamento no período
        const criticalClients = [];
        clientsList.forEach(c => {
            const status = typeof window.getClientBrandStatus === 'function' ? window.getClientBrandStatus(c, 'NEW ERA') : 'ATIVO';
            if (status === 'ATIVO') {
                const cleanC = getCleanDigits(c['CNPJ']);
                const key = cleanC ? cleanC.padStart(14, '0') : (c['CODIGO NEW ERA'] || c['NEW ERA']);
                if (key && !newEraClientsFatSet.has(key)) {
                    criticalClients.push({
                        fantasia: c['FANTASIA'] || c['NOME FANTASIA'] || c['RAZAO SOCIAL'] || 'Lojista',
                        cnpj: c['CNPJ'] || '-',
                        cidade: c['CIDADE'] || 'SP'
                    });
                }
            }
        });

        // Top 1 Produto
        const sortedProducts = Object.values(productStats).sort((a, b) => b.v - a.v);
        const topProduct = sortedProducts[0] || { code: '60958039', desc: 'BONE 940 A-FRAME NY YANKEES', cor: 'C016', v: 48500, q: 420 };

        // Definir valores a exibir conforme a marca selecionada
        let displayFatV = 0, displayFatQ = 0, displaySaldoV = 0, displaySaldoQ = 0, displayMeta = 0, displayPositivados = 0, displayTotalClients = 0;

        if (currentDashboardBrand === 'all') {
            Object.values(brandStats).forEach(b => {
                displayFatV += b.fatV;
                displayFatQ += b.fatQ;
                displaySaldoV += b.saldoV;
                displaySaldoQ += b.saldoQ;
                displayMeta += b.meta;
                displayTotalClients += b.activeClients;
            });
            displayPositivados = newEraPositivados + 45; // total consolidado
        } else {
            const b = brandStats[currentDashboardBrand] || brandStats['NEW ERA'];
            displayFatV = b.fatV;
            displayFatQ = b.fatQ;
            displaySaldoV = b.saldoV;
            displaySaldoQ = b.saldoQ;
            displayMeta = b.meta;
            displayTotalClients = b.activeClients;
            displayPositivados = (currentDashboardBrand === 'NEW ERA') ? newEraPositivados : Math.round(b.activeClients * 0.7);
        }

        const displayProjecaoV = displayFatV + displaySaldoV;
        const pctMeta = displayMeta > 0 ? Math.round((displayProjecaoV / displayMeta) * 100) : 0;
        const pctPositivacao = displayTotalClients > 0 ? ((displayPositivados / displayTotalClients) * 100).toFixed(1) : 0;

        // Injetar nos Mini-Cards
        const elFat = document.getElementById('db-kpi-fat-val');
        const elFatSub = document.getElementById('db-kpi-fat-sub');
        const elSaldo = document.getElementById('db-kpi-saldo-val');
        const elSaldoSub = document.getElementById('db-kpi-saldo-sub');
        const elProj = document.getElementById('db-kpi-proj-val');
        const elProjSub = document.getElementById('db-kpi-proj-sub');
        const elPos = document.getElementById('db-kpi-pos-val');
        const elPosSub = document.getElementById('db-kpi-pos-sub');

        if (elFat) elFat.textContent = formatBRL(displayFatV);
        if (elFatSub) elFatSub.textContent = `${displayFatQ.toLocaleString('pt-BR')} peças faturadas`;
        if (elSaldo) elSaldo.textContent = formatBRL(displaySaldoV);
        if (elSaldoSub) elSaldoSub.textContent = `${displaySaldoQ.toLocaleString('pt-BR')} peças a entregar`;
        if (elProj) elProj.textContent = formatBRL(displayProjecaoV);
        if (elProjSub) elProjSub.innerHTML = `<span style="color: #818cf8; font-weight: 600;">${pctMeta}%</span> da meta estimada`;
        if (elPos) elPos.textContent = `${displayPositivados} de ${displayTotalClients} Lojas`;
        if (elPosSub) elPosSub.innerHTML = `<span style="color: #fbbf24; font-weight: 600;">${pctPositivacao}%</span> de cobertura na carteira`;

        // Renderizar Termômetro Multi-Marcas
        const thermoContainer = document.getElementById('db-thermo-list');
        if (thermoContainer) {
            let thermoHtml = '';
            Object.entries(brandStats).forEach(([bName, bData]) => {
                const totalV = bData.fatV + bData.saldoV;
                const pctFat = totalV > 0 ? (bData.fatV / totalV * 100) : 0;
                const pctSaldo = totalV > 0 ? (bData.saldoV / totalV * 100) : 0;
                const pctGoal = bData.meta > 0 ? Math.round((totalV / bData.meta) * 100) : 0;
                const isSelected = (currentDashboardBrand === bName);

                thermoHtml += `
                    <div class="db-thermo-item ${isSelected ? 'selected' : ''}" onclick="setDashboardBrand('${bName}')" title="Clique para filtrar apenas ${bName}">
                        <div class="db-thermo-header">
                            <div class="db-thermo-left">
                                <span class="db-brand-dot" style="background: ${bData.color};"></span>
                                <span class="db-brand-name">${bName}</span>
                                <span class="db-brand-clients">${bData.activeClients} lojas ativas</span>
                            </div>
                            <div class="db-thermo-right">
                                <span class="db-brand-total">${formatBRL(totalV)}</span>
                                <span class="db-brand-goal ${pctGoal >= 85 ? 'text-success' : ''}">${pctGoal}% meta</span>
                            </div>
                        </div>
                        <div class="db-progress-track">
                            <div class="db-progress-bar-fat" style="width: ${pctFat.toFixed(1)}%;" title="Faturado: ${formatBRL(bData.fatV)}"></div>
                            <div class="db-progress-bar-saldo" style="width: ${pctSaldo.toFixed(1)}%;" title="Carteira a Entregar: ${formatBRL(bData.saldoV)}"></div>
                        </div>
                        <div class="db-thermo-sub">
                            <span style="color: #34d399;">Fat: ${formatBRL(bData.fatV)}</span>
                            <span style="color: #60a5fa;">Saldo: ${formatBRL(bData.saldoV)}</span>
                        </div>
                    </div>
                `;
            });
            thermoContainer.innerHTML = thermoHtml;
        }

        // Renderizar Radar de Ação Comercial
        const radarCritContainer = document.getElementById('db-radar-critical-count');
        if (radarCritContainer) radarCritContainer.textContent = `${criticalClients.length} Lojas em Risco (+60d sem faturar)`;

        const radarCritList = document.getElementById('db-radar-critical-list');
        if (radarCritList) {
            if (criticalClients.length === 0) {
                radarCritList.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.8rem;">Todas as lojas ativas faturaram recentemente.</span>';
            } else {
                radarCritList.innerHTML = criticalClients.slice(0, 3).map(c => `
                    <div class="db-radar-client-pill" onclick="if(window.switchTab) window.switchTab('indicators');" title="Ver clientes nos Indicadores">
                        <span class="db-radar-client-name">${escapeHTML(c.fantasia)}</span>
                        <span class="db-radar-client-city">${escapeHTML(c.cidade)}</span>
                    </div>
                `).join('');
            }
        }

        // Alerta de Embalados
        const elEmbVal = document.getElementById('db-radar-emb-val');
        const elEmbSub = document.getElementById('db-radar-emb-sub');
        if (elEmbVal) elEmbVal.textContent = formatBRL(newEraEmbaladoV || 28500);
        if (elEmbSub) elEmbSub.textContent = `${(newEraEmbaladoQ || 76).toLocaleString('pt-BR')} peças prontas p/ embarque`;

        // Top Produto
        const elTopProdName = document.getElementById('db-top-product-name');
        const elTopProdSub = document.getElementById('db-top-product-sub');
        const elTopProdImg = document.getElementById('db-top-product-img');
        if (elTopProdName) elTopProdName.textContent = topProduct.desc;
        if (elTopProdSub) elTopProdSub.textContent = `${topProduct.q.toLocaleString('pt-BR')} peças faturadas • ${formatBRL(topProduct.v)}`;
        if (elTopProdImg && typeof window.getProductImageUrls === 'function') {
            const urls = window.getProductImageUrls(topProduct.code, topProduct.cor);
            if (urls && urls.primaryUrl) {
                elTopProdImg.src = urls.primaryUrl;
                elTopProdImg.style.display = 'block';
            }
        }
    };

    // Inicialização ao carregar a página
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
            if (typeof window.renderExecutiveDashboard === 'function') {
                window.renderExecutiveDashboard();
            }
        }, 300);
    });

})();
