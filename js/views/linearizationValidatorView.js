// js/views/linearizationValidatorView.js
import { escapeHtml, showNotification, extractBaseName, extractNK } from '../core/utils.js';
import { loadFile, parseTxtContent } from '../modules/fileLoader.js';
import { validateAndCorrectRecords, isValidColorName } from '../modules/nameValidator.js';

export class LinearizationValidatorView {
    constructor(app) {
        this.app = app;
        this.records = [];
        this.masterRecords = [];
        this.comparisonResults = [];
        this.conflictGroups = [];
        this.container = null;
        this.fileName = '';
        this.activeFilter = null; // Filtro de error activo
        
        this.init();
        window.linValidatorView = this;
    }

    saveToCache() {
        try {
            const data = {
                records: this.records,
                masterRecords: this.masterRecords,
                comparisonResults: this.comparisonResults,
                fileName: this.fileName,
                activeFilter: this.activeFilter
            };
            const serialized = JSON.stringify(data);
            localStorage.setItem('lin_auditor_cache', serialized);
            console.log(`💾 Auditoría guardada (${(serialized.length / 1024).toFixed(1)} KB)`);
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                window.showNotification('Memoria llena', 'El archivo es demasiado grande para guardarse en caché.', 'warning');
            }
            console.error('Error al guardar en cache:', e);
        }
    }

    loadFromCache() {
        const cached = localStorage.getItem('lin_auditor_cache');
        if (!cached) return;

        try {
            const data = JSON.parse(cached);
            this.records = data.records || [];
            this.masterRecords = data.masterRecords || [];
            this.comparisonResults = data.comparisonResults || [];
            this.fileName = data.fileName || '';
            this.activeFilter = data.activeFilter || null;

            if (this.records.length > 0 || this.comparisonResults.length > 0) {
                // Esperar a que el DOM esté listo
                const checkInterval = setInterval(() => {
                    const tableBody = this.container?.querySelector('#linResultsTableBody');
                    if (tableBody) {
                        clearInterval(checkInterval);
                        if (this.comparisonResults.length > 0) {
                            this.renderComparisonResults();
                        } else {
                            this.renderResults();
                        }
                        if (this.fileName) {
                            const badge = this.container.querySelector('#linFileName1');
                            if (badge) badge.innerHTML = `<i class="fas fa-file-alt"></i> ${this.fileName} <span style="font-size: 0.6rem; opacity: 0.7;">(Recuperado)</span>`;
                        }
                    }
                }, 50);
                // Limpiar después de 2 segundos si algo falla
                setTimeout(() => clearInterval(checkInterval), 2000);
            }
        } catch (e) {
            console.error('Error cargando cache de auditoría:', e);
        }
    }

    init() {
        this.container = document.getElementById('linearizationValidatorView');
        if (!this.container) return;
        this.render();
        this.loadFromCache();
    }

    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <style>
                .row-success { background: rgba(16, 185, 129, 0.03); }
                .row-error-red { background: rgba(244, 63, 94, 0.15); border-left: 8px solid #f43f5e; }
                .row-error-pink { background: rgba(236, 72, 153, 0.15); border-left: 8px solid #ec4899; }
                .row-error-purple { background: rgba(139, 92, 246, 0.15); border-left: 8px solid #8b5cf6; }
                .row-error-orange { background: rgba(245, 158, 11, 0.15); border-left: 8px solid #f59e0b; }
                .row-error-yellow { background: rgba(234, 179, 8, 0.15); border-left: 8px solid #eab308; }
                .row-error-blue { background: rgba(59, 130, 246, 0.15); border-left: 8px solid #3b82f6; }
                
                .status-badge-solid {
                    padding: 4px 12px;
                    border-radius: 4px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                .status-badge-solid.valid { background: #10b981; color: #fff; }
                .status-badge-solid.red { background: #f43f5e; color: #fff; }
                .status-badge-solid.pink { background: #ec4899; color: #fff; }
                .status-badge-solid.purple { background: #8b5cf6; color: #fff; }
                .status-badge-solid.orange { background: #f59e0b; color: #000; }
                .status-badge-solid.yellow { background: #eab308; color: #000; }
                .status-badge-solid.blue { background: #3b82f6; color: #fff; }

                .mismatch-val {
                    color: #f43f5e;
                    font-weight: 900;
                    text-decoration: underline;
                    text-shadow: 0 0 5px rgba(244, 63, 94, 0.5);
                    background: rgba(244, 63, 94, 0.1);
                    padding: 0 2px;
                    border-radius: 2px;
                }
                
                .stat-badge-mini {
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    border: 1px solid transparent;
                    cursor: pointer;
                    transition: all 0.2s;
                    user-select: none;
                }
                .stat-badge-mini:hover { transform: translateY(-2px); filter: brightness(1.2); }
                .stat-badge-mini.active { border-width: 2px; box-shadow: 0 0 10px currentColor; }
                
                .stat-badge-mini.red { background: rgba(244, 63, 94, 0.1); border-color: #f43f5e; color: #f43f5e; }
                .stat-badge-mini.pink { background: rgba(236, 72, 153, 0.1); border-color: #ec4899; color: #ec4899; }
                .stat-badge-mini.purple { background: rgba(139, 92, 246, 0.1); border-color: #8b5cf6; color: #8b5cf6; }
                .stat-badge-mini.orange { background: rgba(245, 158, 11, 0.1); border-color: #f59e0b; color: #f59e0b; }
                .stat-badge-mini.yellow { background: rgba(234, 179, 8, 0.1); border-color: #eab308; color: #eab308; }
                .stat-badge-mini.blue { background: rgba(59, 130, 246, 0.1); border-color: #3b82f6; color: #3b82f6; }
            </style>
            <div id="singleAuditSection" class="lin-card audit-card" style="margin-top: 1rem; border: 1px solid rgba(255,255,255,0.05); background: rgba(30, 41, 59, 0.5);">
                <div class="lin-card-header" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 1rem;">
                    <div class="header-icon" style="background: rgba(16, 185, 129, 0.1); color: #10b981;"><i class="fas fa-file-shield"></i></div>
                    <div class="header-text">
                        <h3 style="margin:0; font-size: 1rem; color: #f1f5f9;">Validador Rápido de Archivo Único</h3>
                        <p style="margin:0; font-size: 0.75rem; color: #9ca3af;">Revisión de NKs y corrección de nombres sin comparar</p>
                    </div>
                    <div class="header-actions" style="margin-left: auto; display: flex; gap: 10px;">
                         <button id="linResetBtn" class="small-btn" style="background: transparent; border: 1px solid #4b5563; color: #9ca3af;"><i class="fas fa-undo"></i></button>
                         <button id="btnExportLin" class="small-btn btn-success" disabled><i class="fas fa-file-export"></i></button>
                    </div>
                </div>
                <div class="lin-card-body" style="padding: 1.5rem;">
                    <div class="premium-upload-zone" id="linUploadZone" style="padding: 1.5rem; border: 2px dashed rgba(16, 185, 129, 0.2);">
                        <input type="file" id="linValidatorFileInput" accept=".txt" class="hidden-input">
                        <label for="linValidatorFileInput" class="upload-label" style="cursor: pointer;">
                            <div class="upload-icon-wrapper" style="width: 40px; height: 40px; font-size: 1.2rem;">
                                <i class="fas fa-cloud-upload-alt"></i>
                            </div>
                            <div class="upload-text">
                                <span class="main-text" style="font-size: 0.9rem;">Cargar TXT para Auditar</span>
                                <span class="sub-text" style="font-size: 0.7rem;">Validación automática de nombres y NKs</span>
                            </div>
                        </label>
                    </div>
                    <div id="linFileName1" class="file-status-badge" style="margin-top: 1rem; background: rgba(15, 23, 42, 0.5);">
                        <i class="fas fa-info-circle"></i> Ningún archivo seleccionado
                    </div>
                </div>
            </div>

            <!-- RESULTADOS -->
            <div id="linResultsPanel" class="results-fade-panel" style="display: none;">
                <div class="results-header-bar">
                    <div class="results-title">
                        <i class="fas fa-list-check"></i> Hallazgos de la Auditoría
                    </div>
                    <div id="linStatsBadges" class="stats-badges"></div>
                </div>
                <div class="premium-table-wrapper">
                    <table class="premium-data-table">
                        <thead>
                            <tr>
                                <th>Archivo Base</th>
                                <th>Archivo Nuevo</th>
                                <th>Análisis de Diferencias</th>
                                <th class="text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody id="linResultsTableBody"></tbody>
                    </table>
                </div>
            </div>

            <div id="linEmptyState" class="lin-empty-state">
                <div class="empty-animation">
                    <i class="fas fa-clipboard-check"></i>
                </div>
                <h3>Listo para Auditar</h3>
                <p>Carga los archivos necesarios para iniciar el proceso de validación cíclica o individual.</p>
            </div>
        `;
        
        this.bindEvents();

        // RE-RENDERIZAR SI HAY DATOS EN CACHÉ
        if (this.records.length > 0 || this.comparisonResults.length > 0) {
            setTimeout(() => {
                if (this.comparisonResults.length > 0) {
                    this.renderComparisonResults();
                    // Restaurar nombres en modo cíclico
                    const mName = this.container.querySelector('#linMasterFileName');
                    const sName = this.container.querySelector('#linSecondaryFileName');
                    if (mName && this.masterRecords.length > 0) mName.textContent = "Cargado (Caché)";
                    if (sName && this.records.length > 0) sName.textContent = "Cargado (Caché)";
                } else {
                    this.renderResults();
                }
                if (this.fileName) {
                    const badge = this.container.querySelector('#linFileName1');
                    if (badge) badge.innerHTML = `<i class="fas fa-file-alt"></i> ${this.fileName} <span style="font-size: 0.6rem; opacity: 0.7;">(Recuperado)</span>`;
                }
            }, 50);
        }
    }

    bindEvents() {
        // CARGA INDIVIDUAL
        const fileInput = this.container.querySelector('#linValidatorFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileLoad(e));
        }

        const resetBtn = this.container.querySelector('#linResetBtn');
        if (resetBtn) {
            resetBtn.onclick = () => this.reset();
        }

        const exportBtn = this.container.querySelector('#btnExportLin');
        if (exportBtn) {
            exportBtn.onclick = () => this.exportCorrectedFile();
        }
    }

    async runStrictComparison() {
        if (!this.records.length || !this.masterRecords.length) {
            window.showNotification('Faltan archivos', 'Debe cargar ambos archivos para comparar.', 'warning');
            return;
        }
        
        const { compareFiles } = await import('../modules/comparator.js');
        this.comparisonResults = compareFiles(this.masterRecords, this.records, 'ciclico');
        this.renderComparisonResults();
        this.saveToCache();
    }

    renderComparisonResults() {
        const resultsPanel = this.container.querySelector('#linResultsPanel');
        const tableBody = this.container.querySelector('#linResultsTableBody');
        const statsBadges = this.container.querySelector('#linStatsBadges');

        if (this.container.querySelector('#linEmptyState')) {
            this.container.querySelector('#linEmptyState').style.display = 'none';
        }
        resultsPanel.style.display = 'block';

        // Ordenar resultados por NK para agrupar errores del mismo NK
        this.comparisonResults.sort((a, b) => {
            const nkA = (a.primaryData?.nk || a.secondaryData?.nk || '').toUpperCase();
            const nkB = (b.primaryData?.nk || b.secondaryData?.nk || '').toUpperCase();
            if (nkA !== nkB) return nkA.localeCompare(nkB);
            return (a.matchType === 'exact' ? 1 : -1) - (b.matchType === 'exact' ? 1 : -1);
        });

        const discrepancies = this.comparisonResults.filter(r => r.matchType !== 'exact' || r.isDuplicate);
        
        statsBadges.innerHTML = `
            <div class="stat-badge danger"><span>${discrepancies.length}</span> Alertas detectadas</div>
        `;

        tableBody.innerHTML = '';
        this.comparisonResults.forEach(res => {
            const tr = document.createElement('tr');
            const type = res.matchType;
            
            let rowClass = 'row-success';
            if (type === 'different' || type === 'missing_in_secondary' || type === 'additional_in_secondary' || res.isDuplicate) {
                rowClass = 'row-danger'; // Pintar de rojo si está mal
            }
            
            tr.className = rowClass;
            
            const p = res.primaryData;
            const s = res.secondaryData;
            
            const formatCmykWithDiff = (pData, sData, isPrimary) => {
                if (!pData || !sData) {
                    const data = pData || sData;
                    return (data.cmyk || []).map(v => Number(v).toFixed(4)).join(' / ');
                }
                
                return pData.cmyk.map((v, i) => {
                    const diff = Math.abs(v - sData.cmyk[i]) > 0.0001;
                    const val = Number(isPrimary ? pData.cmyk[i] : sData.cmyk[i]).toFixed(4);
                    return diff ? `<span style="color: #f43f5e; font-weight: bold;">${val}</span>` : val;
                }).join(' / ');
            };

            const formatInfo = (data, otherData, isPrimary) => {
                if (!data) return '<div class="empty-data">---</div>';
                const nk = data.nk || '---';
                const cmykHtml = formatCmykWithDiff(isPrimary ? data : otherData, isPrimary ? otherData : data, isPrimary);
                
                return `
                    <div class="color-info-cell" style="font-size: 0.75rem;">
                        <div class="color-name" style="font-weight: 500;">${escapeHtml(data.name)}</div>
                        <div class="color-meta">
                            <span class="nk-badge-mini">${nk}</span>
                            <span class="cmyk-text">[${cmykHtml}]</span>
                        </div>
                    </div>
                `;
            };

            let col3 = '';
            let status = '';
            let statusClass = '';

            if (type === 'exact' && !res.isDuplicate) {
                col3 = `<div class="diff-msg success"><i class="fas fa-check"></i> Sin diferencias</div>`;
                status = 'IDÉNTICO';
                statusClass = 'status-ok';
            } else if (type === 'different') {
                let diffs = [];
                if (p.name !== s.name) diffs.push(`<div class="diff-item" style="color: #f43f5e;"><i class="fas fa-font"></i> Nombre distinto</div>`);
                if (p.nk !== s.nk) diffs.push(`<div class="diff-item" style="color: #f43f5e;"><i class="fas fa-fingerprint"></i> NK distinto</div>`);
                
                const pCMYK = (p.cmyk || []).map(v => Number(v).toFixed(4)).join('/');
                const sCMYK = (s.cmyk || []).map(v => Number(v).toFixed(4)).join('/');
                if (pCMYK !== sCMYK) diffs.push(`<div class="diff-item danger" style="color: #f43f5e;"><i class="fas fa-palette"></i> CMYK Diferente</div>`);
                
                col3 = `<div class="diff-list">${diffs.join('')}</div>`;
                status = 'DIFERENTE';
                statusClass = 'status-err';
            } else if (type === 'missing_in_secondary') {
                col3 = `<div class="diff-msg danger" style="color: #f43f5e;"><i class="fas fa-times-circle"></i> FALTANTE en nuevo</div>`;
                status = 'ELIMINADO';
                statusClass = 'status-err';
            } else if (type === 'additional_in_secondary') {
                col3 = `<div class="diff-msg info" style="color: #3b82f6;"><i class="fas fa-plus-circle"></i> NUEVO (adicional)</div>`;
                status = 'ADICIONAL';
                statusClass = 'status-info';
            }

            if (res.isDuplicate) {
                col3 += `<div class="diff-msg warning" style="color: #f43f5e; font-weight:bold;"><i class="fas fa-copy"></i> DUPLICADO</div>`;
            }

            tr.innerHTML = `
                <td>${formatInfo(p, s, true)}</td>
                <td>${formatInfo(s, p, false)}</td>
                <td>${col3}</td>
                <td class="text-center"><span class="status-badge ${statusClass}">${status}</span></td>
            `;
            tableBody.appendChild(tr);
        });

        const exportBtn = this.container.querySelector('#btnExportLin');
        if (exportBtn) exportBtn.disabled = false;
    }


    async handleFileLoad(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const result = await loadFile(file, true);
            if (!result) return;

            this.fileName = result.fileName;
            this.records = result.records.map((r, i) => ({ 
                ...r, 
                _uid: r._uid || `lin_${Date.now()}_${i}` 
            }));
            
            this.container.querySelector('#linFileName1').textContent = this.fileName;
            await this.performValidation();
            this.saveToCache();
            
            window.showNotification('Archivo Cargado', 'Registros analizados para auditoría.', 'success');
        } catch (error) {
            console.error('Error:', error);
            window.showNotification('Error', 'No se pudo cargar el archivo.', 'error');
        }
    }

    async performValidation() {
        const groups = {}; 
        
        // 1. Obtener NK dominante para buscar en base de datos
        const nkCounts = {};
        this.records.forEach(r => { if (r.nk) nkCounts[r.nk] = (nkCounts[r.nk] || 0) + 1; });
        let dominantNk = Object.entries(nkCounts).sort((a,b) => b[1] - a[1])[0]?.[0];

        // 1.1 Si no hay NK en los registros, intentar extraerlo del nombre del archivo
        if (!dominantNk && this.fileName) {
            const { extractNK } = await import('../core/utils.js');
            dominantNk = extractNK(this.fileName);
            if (dominantNk) console.log(`%c📡 NK detectado desde el nombre del archivo: ${dominantNk}`, 'color: #8b5cf6; font-weight: bold;');
        }

        console.log(`%c🔍 Iniciando validación para NK Dominante: ${dominantNk || 'NINGUNO'}`, 'color: #3b82f6;');

        // 2. Intentar cargar el Maestro desde Supabase para comparar CMYK
        let masterRecordsMap = new Map();
        if (dominantNk) {
            try {
                console.log(`%c📡 Consultando base de datos para Maestro de ${dominantNk}...`, 'color: #3b82f6;');
                const { getActiveTxt } = await import('../core/supabaseClient.js');
                const masterData = await getActiveTxt(dominantNk, 1) || await getActiveTxt(dominantNk, 2) || await getActiveTxt(dominantNk, 3);
                
                if (masterData && masterData.contenido) {
                    const parsedMaster = parseTxtContent(masterData.contenido);
                    if (parsedMaster && parsedMaster.records) {
                        console.log(`%c✅ Maestro cargado con éxito: ${parsedMaster.records.length} colores.`, 'color: #10b981; font-weight: bold;');
                        parsedMaster.records.forEach(mr => {
                            masterRecordsMap.set(mr.name.trim().toUpperCase(), mr);
                        });
                    }
                } else {
                    console.warn(`⚠️ No se encontró ningún Maestro activo para ${dominantNk} en la base de datos.`);
                }
            } catch (dbError) {
                console.error('❌ Error al conectar con Supabase para obtener el Maestro:', dbError);
            }
        } else {
            console.warn('⚠️ No se pudo identificar un código NK para realizar la auditoría contra el Maestro.');
        }

        // 3. Agrupamiento primario por NK y por Grupos de Equivalencia (Scoped by NK)
        const eqGroupsInFile = {}; // "NK|groupId" -> records[]
        const eqMap = window.EQUIVALENCE_MAP || new Map();

        this.records.forEach(record => {
            const nk = (record.nk || '').trim().toUpperCase();
            if (!groups[nk]) groups[nk] = { nk, records: [] };
            groups[nk].records.push(record);

            // LIMPIEZA PROFUNDA: Obtener el nombre base real sin ruidos de prefijos o NKs
            const pureBaseName = extractBaseName(record.name).toUpperCase();
            record.pureBaseName = pureBaseName;

            // Buscar si pertenece a un grupo de equivalencia (complementarios)
            const eqData = eqMap.get(pureBaseName);
            if (eqData) {
                record.groupId = eqData.groupId;
                // La validación de complementarios es por Nombre + NK
                const eqKey = `${nk}|${record.groupId}`;
                if (!eqGroupsInFile[eqKey]) eqGroupsInFile[eqKey] = [];
                eqGroupsInFile[eqKey].push(record);
            }
        });

        // 3.1 Validar consistencia interna de complementarios (dentro del mismo NK)
        Object.values(eqGroupsInFile).forEach(groupRecords => {
            if (groupRecords.length > 1) {
                const firstCmyk = groupRecords[0].cmyk;
                const hasMismatch = groupRecords.some(r => 
                    !r.cmyk.every((v, i) => Math.abs(v - (firstCmyk[i] || 0)) < 0.0001)
                );
                if (hasMismatch) {
                    // Guardar el CMYK de referencia del grupo para el resaltado visual
                    groupRecords.forEach(r => {
                        r.complementaryDiscrepancy = true;
                        r.groupRefCmyk = firstCmyk;
                    });
                }
            }
        });

        // 4. Identificar errores detallados
        this.records.forEach(r => {
            const cleanBase = (r.baseName || r.name || '').replace(/\s*\([^)]*\)/g, '').toUpperCase().trim();
            const nk = (r.nk || '').trim().toUpperCase();
            
            // A. Duplicados
            const sameNkRecords = groups[nk].records;
            r.isDuplicate = sameNkRecords.filter(other => 
                other !== r && 
                other.name.trim().toUpperCase() === r.name.trim().toUpperCase()
            ).length > 0;

            // B. Mal escrito (Omitir minúsculas)
            r.hasLowercase = false;

            // C. No está en base de datos (Catálogo de Nombres)
            r.isInvalidName = !r.isManualValidated && !isValidColorName(r.baseName || cleanBase, r.name);

            // D. Paréntesis con número
            r.hasNumberedParentheses = /\(\d+\)/.test(r.name);

            // E. Falta NK
            r.isMissingNk = !r.nk;

            // F. Comparación de CMYK vs Maestro de la DB (Usando Equivalencias)
            r.cmykDiscrepancy = false;
            r.masterCmyk = null;
            
            const pureName = r.pureBaseName || r.name.trim().toUpperCase();
            
            // Intentar match directo primero
            let mRecord = masterRecordsMap.get(r.name.trim().toUpperCase()) || masterRecordsMap.get(pureName);
            
            // Si no hay match directo, buscar por complementarios (Equivalencias)
            if (!mRecord && r.groupId) {
                const eqData = eqMap.get(pureName);
                if (eqData && eqData.names) {
                    for (const altName of eqData.names) {
                        const altMatch = masterRecordsMap.get(altName.toUpperCase());
                        if (altMatch) {
                            mRecord = altMatch;
                            break;
                        }
                    }
                }
            }

            if (mRecord) {
                r.masterCmyk = mRecord.cmyk;
                const match = r.cmyk.every((v, i) => Math.abs(v - (mRecord.cmyk[i] || 0)) < 0.0001);
                if (!match) r.cmykDiscrepancy = true;
            }

            // H. Validación de Rango CMYK (No puede ser > 100)
            r.hasCmykRangeError = r.cmyk.some(v => v > 100);

            // G. Diferencia en Complementarios (interna del archivo)
            // r.complementaryDiscrepancy ya fue calculada arriba

            r.hasError = r.isDuplicate || r.isInvalidName || r.hasNumberedParentheses || r.isMissingNk || r.cmykDiscrepancy || r.complementaryDiscrepancy || r.hasCmykRangeError;
        });

        // 5. Ordenar: Primero por NK (para agrupar), luego errores arriba de su grupo
        this.records.sort((a, b) => {
            const nkA = (a.nk || 'ZZZ').toUpperCase();
            const nkB = (b.nk || 'ZZZ').toUpperCase();
            if (nkA !== nkB) return nkA.localeCompare(nkB);
            
            if (a.hasError !== b.hasError) return b.hasError - a.hasError;
            return a.name.localeCompare(b.name);
        });

        this.renderResults();
    }

    renderResults() {
        const resultsPanel = this.container.querySelector('#linResultsPanel');
        const tableBody = this.container.querySelector('#linResultsTableBody');
        const statsBadges = this.container.querySelector('#linStatsBadges');

        if (this.container.querySelector('#linEmptyState')) {
            this.container.querySelector('#linEmptyState').style.display = 'none';
        }
        resultsPanel.style.display = 'block';

        // 1. Preparar conteos para los filtros
        const counts = {
            dup: this.records.filter(r => r.isDuplicate).length,
            master: this.records.filter(r => r.cmykDiscrepancy).length,
            comp: this.records.filter(r => r.complementaryDiscrepancy).length,
            nom: this.records.filter(r => r.isInvalidName).length,
            paren: this.records.filter(r => r.hasNumberedParentheses).length,
            nk: this.records.filter(r => r.isMissingNk).length,
            range: this.records.filter(r => r.hasCmykRangeError).length
        };
        const errorCount = this.records.filter(r => r.hasError).length;

        // 2. Renderizar Badges de Estadísticas / Filtros
        if (statsBadges) {
            statsBadges.innerHTML = `
                <div class="stat-badge-mini ${!this.activeFilter ? 'active' : ''}" data-filter="all" style="background: rgba(255,255,255,0.05); border-color: #64748b; color: #e2e8f0;"><i class="fas fa-eye"></i> Ver Todos (${this.records.length})</div>
                ${counts.dup > 0 ? `<div class="stat-badge-mini red ${this.activeFilter === 'dup' ? 'active' : ''}" data-filter="dup"><i class="fas fa-copy"></i> ${counts.dup} Duplicados</div>` : ''}
                ${counts.range > 0 ? `<div class="stat-badge-mini red ${this.activeFilter === 'range' ? 'active' : ''}" data-filter="range"><i class="fas fa-exclamation-circle"></i> ${counts.range} CMYK > 100</div>` : ''}
                ${counts.master > 0 ? `<div class="stat-badge-mini pink ${this.activeFilter === 'master' ? 'active' : ''}" data-filter="master"><i class="fas fa-database"></i> ${counts.master} Dif. Maestro</div>` : ''}
                ${counts.comp > 0 ? `<div class="stat-badge-mini purple ${this.activeFilter === 'comp' ? 'active' : ''}" data-filter="comp"><i class="fas fa-project-diagram"></i> ${counts.comp} Dif. Comp.</div>` : ''}
                ${counts.nom > 0 ? `<div class="stat-badge-mini orange ${this.activeFilter === 'nom' ? 'active' : ''}" data-filter="nom"><i class="fas fa-book-dead"></i> ${counts.nom} Catálogo</div>` : ''}
                ${counts.paren > 0 ? `<div class="stat-badge-mini yellow ${this.activeFilter === 'paren' ? 'active' : ''}" data-filter="paren"><i class="fas fa-brackets-curly"></i> ${counts.paren} Nom. (X)</div>` : ''}
                ${counts.nk > 0 ? `<div class="stat-badge-mini blue ${this.activeFilter === 'nk' ? 'active' : ''}" data-filter="nk"><i class="fas fa-fingerprint"></i> ${counts.nk} Sin NK</div>` : ''}
                ${errorCount === 0 ? '<div class="stat-badge-mini" style="background: rgba(16, 185, 129, 0.1); border-color: #10b981; color: #10b981;"><i class="fas fa-check-circle"></i> Todo Correcto</div>' : ''}
            `;

            // Vincular eventos de filtrado
            statsBadges.querySelectorAll('.stat-badge-mini').forEach(badge => {
                badge.onclick = () => {
                    const filter = badge.dataset.filter;
                    this.activeFilter = (filter === 'all' || this.activeFilter === filter) ? null : filter;
                    this.renderResults();
                    this.saveToCache();
                };
            });
        }

        // 3. Filtrar registros a mostrar
        let recordsToDisplay = this.records;
        if (this.activeFilter) {
            recordsToDisplay = this.records.filter(r => {
                if (this.activeFilter === 'dup') return r.isDuplicate;
                if (this.activeFilter === 'master') return r.cmykDiscrepancy;
                if (this.activeFilter === 'comp') return r.complementaryDiscrepancy;
                if (this.activeFilter === 'nom') return r.isInvalidName;
                if (this.activeFilter === 'paren') return r.hasNumberedParentheses;
                if (this.activeFilter === 'nk') return r.isMissingNk;
                if (this.activeFilter === 'range') return r.hasCmykRangeError;
                return true;
            });
        }

        tableBody.innerHTML = '';

        // 4. Renderizar Filas
        recordsToDisplay.forEach((record, index) => {
            const tr = document.createElement('tr');
            
            const formatCmykWithMaster = (rec) => {
                if (!rec.cmyk) return '---';
                if (rec.masterCmyk) {
                    return rec.cmyk.map((v, i) => {
                        const diff = Math.abs(v - (rec.masterCmyk[i] || 0)) > 0.0001;
                        const val = Number(v).toFixed(6);
                        return diff ? `<span class="mismatch-val">${val}</span>` : val;
                    }).join(' / ');
                }
                if (rec.complementaryDiscrepancy && rec.groupRefCmyk) {
                    return rec.cmyk.map((v, i) => {
                        const diff = Math.abs(v - (rec.groupRefCmyk[i] || 0)) > 0.0001;
                        const val = Number(v).toFixed(6);
                        return diff ? `<span class="mismatch-val">${val}</span>` : val;
                    }).join(' / ');
                }
                return rec.cmyk.map(v => Number(v).toFixed(6)).join(' / ');
            };

            const cmykStr = formatCmykWithMaster(record);
            const labStr = (record.lab || []).map(v => Number(v).toFixed(1)).join(' / ');
            const nk = record.nk || '---';
            
            let statusHtml = '<div class="status-badge-solid valid"><i class="fas fa-check-circle"></i> Válido</div>';
            let rowColorClass = 'row-success';

            if (record.isDuplicate) { 
                statusHtml = '<div class="status-badge-solid red"><i class="fas fa-copy"></i> Duplicado</div>'; 
                rowColorClass = 'row-error-red';
            } else if (record.cmykDiscrepancy) {
                statusHtml = '<div class="status-badge-solid pink"><i class="fas fa-database"></i> Dif. Maestro</div>';
                rowColorClass = 'row-error-pink';
            } else if (record.hasCmykRangeError) {
                statusHtml = '<div class="status-badge-solid red"><i class="fas fa-exclamation-circle"></i> Rango > 100</div>';
                rowColorClass = 'row-error-red';
            } else if (record.complementaryDiscrepancy) {
                statusHtml = '<div class="status-badge-solid purple"><i class="fas fa-project-diagram"></i> Dif. Comp.</div>';
                rowColorClass = 'row-error-purple';
            } else if (record.isInvalidName) { 
                statusHtml = '<div class="status-badge-solid orange"><i class="fas fa-book-dead"></i> Catálogo</div>';
                rowColorClass = 'row-error-orange';
            } else if (record.hasNumberedParentheses) {
                statusHtml = '<div class="status-badge-solid yellow"><i class="fas fa-brackets-curly"></i> Nom. (X)</div>';
                rowColorClass = 'row-error-yellow';
            } else if (record.isMissingNk) { 
                statusHtml = '<div class="status-badge-solid blue"><i class="fas fa-fingerprint"></i> Sin NK</div>'; 
                rowColorClass = 'row-error-blue';
            }

            tr.className = rowColorClass;
            tr.innerHTML = `
                <td class="text-center" style="font-size: 0.75rem;">${record._originalIndex || index + 1}</td>
                <td><div class="color-name-main" style="font-size: 0.8rem; font-weight: 500;">${escapeHtml(record.name)}</div></td>
                <td class="text-center"><span class="nk-badge-mini" style="font-size: 0.7rem; padding: 2px 6px;">${nk}</span></td>
                <td class="text-center" style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #94a3b8;">${cmykStr}</td>
                <td class="text-center" style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #94a3b8;">${labStr}</td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding-right: 0.5rem;">
                        <div class="validation-status-text">${statusHtml}</div>
                        <div class="row-actions" style="display: flex; gap: 4px;">
                            ${record.isInvalidName ? `
                                <button class="btn-icon-action add-to-txt" data-uid="${record._uid}" title="Agregar al TXT" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid #10b981;"><i class="fas fa-plus"></i> AGREGAR</button>
                            ` : ''}
                            <button class="btn-icon-action edit" data-uid="${record._uid}" title="Editar Todo" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;"><i class="fas fa-pencil-alt"></i></button>
                            <button class="btn-icon-action delete" data-uid="${record._uid}" title="Eliminar" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // 5. Vincular eventos de acciones
        tableBody.querySelectorAll('.btn-icon-action.add-to-txt').forEach(btn => {
            btn.onclick = () => {
                const uid = btn.dataset.uid;
                const idx = this.records.findIndex(r => r._uid === uid);
                if (idx !== -1) {
                    this.records[idx].isManualValidated = true;
                    this.performValidation();
                    window.showNotification('Agregado', 'Color marcado como válido para este TXT.', 'success');
                }
            };
        });

        tableBody.querySelectorAll('.btn-icon-action.edit').forEach(btn => {
            btn.onclick = () => this.showManualEditModal(btn.dataset.uid);
        });

        tableBody.querySelectorAll('.btn-icon-action.delete').forEach(btn => {
            btn.onclick = () => {
                const uid = btn.dataset.uid;
                const idx = this.records.findIndex(r => r._uid === uid);
                if (idx === -1) return;
                
                if (confirm(`¿Seguro que desea ELIMINAR el color "${this.records[idx].name}" de este archivo?`)) {
                    this.records.splice(idx, 1);
                    this.performValidation();
                    window.showNotification('Eliminado', 'Registro eliminado del archivo.', 'info');
                }
            };
        });

        this.saveToCache();

        const exportBtn = this.container.querySelector('#btnExportLin');
        if (exportBtn) exportBtn.disabled = errorCount > 0;
    }

    async showManualEditModal(uid) {
        const idx = this.records.findIndex(r => r._uid === uid);
        if (idx === -1) return;
        const rec = this.records[idx];

        const isNameInCatalog = isValidColorName(rec.baseName || rec.name);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '10005';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px; background: #0f172a; border: 2px solid #334155; border-radius: 12px;">
                <div class="modal-header" style="background: #1e293b; border-bottom: 2px solid #3b82f6; padding: 1.2rem; border-radius: 12px 12px 0 0;">
                    <h3 style="color: white; margin: 0; font-size: 1.1rem;"><i class="fas fa-edit" style="color: #3b82f6; margin-right: 10px;"></i> Editar Registro</h3>
                </div>
                <div class="modal-body" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="display:block; color:#94a3b8; font-size:0.7rem; margin-bottom:5px; font-weight:800;">NOMBRE DEL COLOR</label>
                            <input type="text" id="edit_name" value="${escapeHtml(rec.name)}" style="width:100%; background:#0b0f1a; border:1px solid #334155; color:white; padding:10px; border-radius:6px; font-weight:bold;">
                        </div>
                        <div>
                            <label style="display:block; color:#94a3b8; font-size:0.7rem; margin-bottom:5px; font-weight:800;">CÓDIGO NK</label>
                            <input type="text" id="edit_nk" value="${escapeHtml(rec.nk || '')}" style="width:100%; background:#0b0f1a; border:1px solid #334155; color:#3b82f6; padding:10px; border-radius:6px; font-family:monospace; font-weight:900;">
                        </div>
                    </div>

                    <!-- SECCIÓN DE VALIDACIÓN RÁPIDA -->
                    <div style="background: rgba(30, 41, 59, 0.4); padding: 12px; border-radius: 8px; border: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 0.7rem; font-weight: 800; color: ${isNameInCatalog ? '#10b981' : '#f59e0b'};">
                            <i class="fas fa-${isNameInCatalog ? 'check-circle' : 'exclamation-triangle'}"></i> 
                            ${isNameInCatalog ? 'NOMBRE EN CATÁLOGO' : 'NOMBRE NO REGISTRADO'}
                        </span>
                        <label style="color: #3b82f6; font-size: 0.75rem; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="force_validate" ${rec.isManualValidated ? 'checked' : ''} style="width: 16px; height: 16px;"> 
                            Omitir error de catálogo
                        </label>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;">
                        <div><label style="font-size:0.6rem; color:#64748b;">C</label><input type="number" id="edit_c" value="${rec.cmyk[0]}" step="0.0001" style="width:100%; background:#0b0f1a; border:1px solid #334155; color:white; padding:8px; border-radius:4px;"></div>
                        <div><label style="font-size:0.6rem; color:#64748b;">M</label><input type="number" id="edit_m" value="${rec.cmyk[1]}" step="0.0001" style="width:100%; background:#0b0f1a; border:1px solid #334155; color:white; padding:8px; border-radius:4px;"></div>
                        <div><label style="font-size:0.6rem; color:#64748b;">Y</label><input type="number" id="edit_y" value="${rec.cmyk[2]}" step="0.0001" style="width:100%; background:#0b0f1a; border:1px solid #334155; color:white; padding:8px; border-radius:4px;"></div>
                        <div><label style="font-size:0.6rem; color:#64748b;">K</label><input type="number" id="edit_k" value="${rec.cmyk[3]}" step="0.0001" style="width:100%; background:#0b0f1a; border:1px solid #334155; color:white; padding:8px; border-radius:4px;"></div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
                        <div><label style="font-size:0.6rem; color:#64748b;">L*</label><input type="number" id="edit_l" value="${rec.lab[0]}" step="0.01" style="width:100%; background:#0b0f1a; border:1px solid #334155; color:white; padding:8px; border-radius:4px;"></div>
                        <div><label style="font-size:0.6rem; color:#64748b;">a*</label><input type="number" id="edit_a" value="${rec.lab[1]}" step="0.01" style="width:100%; background:#0b0f1a; border:1px solid #334155; color:white; padding:8px; border-radius:4px;"></div>
                        <div><label style="font-size:0.6rem; color:#64748b;">b*</label><input type="number" id="edit_b" value="${rec.lab[2]}" step="0.01" style="width:100%; background:#0b0f1a; border:1px solid #334155; color:white; padding:8px; border-radius:4px;"></div>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 1.2rem; background: #1e293b; display: flex; justify-content: flex-end; gap: 10px; border-radius: 0 0 12px 12px;">
                    <button id="cancel_edit" style="background:transparent; border:1px solid #475569; color:#94a3b8; padding:8px 20px; border-radius:6px; cursor:pointer;">CANCELAR</button>
                    <button id="save_edit" style="background:#3b82f6; border:none; color:white; padding:8px 25px; border-radius:6px; font-weight:bold; cursor:pointer;">GUARDAR CAMBIOS</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#cancel_edit').onclick = () => modal.remove();
        modal.querySelector('#save_edit').onclick = async () => {
            const newName = modal.querySelector('#edit_name').value.trim();
            const newNk = modal.querySelector('#edit_nk').value.trim().toUpperCase();
            const forceValidate = modal.querySelector('#force_validate').checked;

            this.records[idx] = {
                ...rec,
                name: newName,
                nk: newNk,
                baseName: extractBaseName(newName),
                isManualValidated: forceValidate,
                cmyk: [
                    parseFloat(modal.querySelector('#edit_c').value) || 0,
                    parseFloat(modal.querySelector('#edit_m').value) || 0,
                    parseFloat(modal.querySelector('#edit_y').value) || 0,
                    parseFloat(modal.querySelector('#edit_k').value) || 0
                ],
                lab: [
                    parseFloat(modal.querySelector('#edit_l').value) || 0,
                    parseFloat(modal.querySelector('#edit_a').value) || 0,
                    parseFloat(modal.querySelector('#edit_b').value) || 0
                ]
            };
            
            modal.remove();
            await this.performValidation();
            window.showNotification('Actualizado', 'Registro actualizado correctamente.', 'success');
        };
    }

    reset() {
        this.records = [];
        this.masterRecords = [];
        this.comparisonResults = [];
        this.fileName = '';
        this.activeFilter = null;
        localStorage.removeItem('lin_auditor_cache');
        this.render();
    }

    exportCorrectedFile() {
        if (!this.records.length && !this.comparisonResults.length) {
            window.showNotification('Sin datos', 'No hay registros auditados para exportar.', 'warning');
            return;
        }

        let exportItems = [];

        // Si hay resultados de comparación cíclica, exportar la fusión (preferir secundario si existe)
        if (this.comparisonResults.length > 0) {
            exportItems = this.comparisonResults.map(res => {
                const source = res.secondaryData || res.primaryData;
                return {
                    name: source.name,
                    cmyk: source.cmyk,
                    lab: source.lab
                };
            });
        } else {
            // Si es carga individual, exportar los registros auditados
            exportItems = this.records.map(r => ({
                name: r.name,
                cmyk: r.cmyk,
                lab: r.lab
            }));
        }

        if (exportItems.length === 0) return;

        // Generar contenido CGATS
        const today = new Date();
        const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
        let content = 'CGATS.17\nORIGINATOR\t"ALPHA COLOR MATCH"\nFILE_DESCRIPTOR\t""\n';
        content += `CREATED\t"${dateStr}"\nNUMBER_OF_FIELDS\t9\nBEGIN_DATA_FORMAT\nSAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B\nEND_DATA_FORMAT\n`;
        content += `NUMBER_OF_SETS\t${exportItems.length}\nBEGIN_DATA\n\n`;
        
        exportItems.forEach((item, index) => {
            content += `${index + 1} "${item.name}" ${item.cmyk[0].toFixed(6)} ${item.cmyk[1].toFixed(6)} ${item.cmyk[2].toFixed(6)} ${item.cmyk[3].toFixed(6)} ${item.lab[0].toFixed(6)} ${item.lab[1].toFixed(6)} ${item.lab[2].toFixed(6)}\n`;
        });
        content += '\nEND_DATA\n';

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        a.href = url;
        a.download = `audit_${this.fileName || 'file'}_${timestamp}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        window.showNotification('Éxito', `Exportados ${exportItems.length} registros auditados.`, 'success');
    }
}
