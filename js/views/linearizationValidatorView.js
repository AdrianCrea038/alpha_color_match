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

    init() {
        this.container = document.getElementById('linearizationValidatorView');
        if (!this.container) return;
        this.render();
    }

    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <style>
                .row-success { background: rgba(16, 185, 129, 0.03); }
                .row-error-red { background: rgba(244, 63, 94, 0.08); border-left: 4px solid #f43f5e; }
                .row-error-pink { background: rgba(236, 72, 153, 0.08); border-left: 4px solid #ec4899; }
                .row-error-purple { background: rgba(139, 92, 246, 0.08); border-left: 4px solid #8b5cf6; }
                .row-error-orange { background: rgba(245, 158, 11, 0.08); border-left: 4px solid #f59e0b; }
                .row-error-yellow { background: rgba(234, 179, 8, 0.08); border-left: 4px solid #eab308; }
                .row-error-blue { background: rgba(59, 130, 246, 0.08); border-left: 4px solid #3b82f6; }
                
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
            <div class="view-header" style="margin-bottom: 2rem;">
                <div class="header-main">
                    <h2 class="premium-title"><i class="fas fa-microscope"></i> Auditoría de Linearización</h2>
                    <p class="subtitle">Validación estricta y comparación cíclica de archivos de color</p>
                </div>
                <div class="header-actions">
                    <button id="linResetBtn" class="premium-btn secondary"><i class="fas fa-undo"></i> Reiniciar</button>
                    <button id="btnExportLin" class="premium-btn primary" disabled><i class="fas fa-file-export"></i> Exportar Auditado</button>
                </div>
            </div>

            <div class="lin-dashboard-grid">
                <!-- CARGA INDIVIDUAL -->
                <div class="lin-card audit-card">
                    <div class="lin-card-header">
                        <div class="header-icon"><i class="fas fa-file-shield"></i></div>
                        <div class="header-text">
                            <h3>Carga Individual</h3>
                            <p>Corrección automática y validación de NKs</p>
                        </div>
                    </div>
                    <div class="lin-card-body">
                        <div class="premium-upload-zone" id="linUploadZone">
                            <input type="file" id="linValidatorFileInput" accept=".txt" class="hidden-input">
                            <label for="linValidatorFileInput" class="upload-label">
                                <div class="upload-icon-wrapper">
                                    <i class="fas fa-cloud-upload-alt"></i>
                                </div>
                                <div class="upload-text">
                                    <span class="main-text">Seleccionar archivo para Auditar</span>
                                    <span class="sub-text">Formatos aceptados: .txt</span>
                                </div>
                            </label>
                        </div>
                        <div id="linFileName1" class="file-status-badge">
                            <i class="fas fa-info-circle"></i> Ningún archivo seleccionado
                        </div>
                    </div>
                </div>

                <!-- SECCIÓN CÍCLICO -->
                <div class="lin-card cyclic-card">
                    <div class="lin-card-header">
                        <div class="header-icon" style="color: #fbbf24;"><i class="fas fa-sync-alt"></i></div>
                        <div class="header-text">
                            <h3>Comparación Cíclica</h3>
                            <p>Detección de diferencias entre Base y Nuevo</p>
                        </div>
                        <button id="btnRunLinCompare" class="compare-trigger-btn" title="Iniciar Comparación">
                            <i class="fas fa-bolt"></i>
                        </button>
                    </div>
                    <div class="lin-card-body">
                        <div class="cyclic-inputs">
                            <div class="mini-upload-group">
                                <label>Archivo Principal (Base)</label>
                                <input type="file" id="linMasterFileInput" accept=".txt" class="hidden-input">
                                <button onclick="document.getElementById('linMasterFileInput').click()" class="mini-upload-btn primary-border">
                                    <i class="fas fa-file-alt"></i> 
                                    <span id="linMasterFileName">Seleccionar Principal</span>
                                </button>
                            </div>
                            <div class="cyclic-divider">
                                <i class="fas fa-chevron-right"></i>
                            </div>
                            <div class="mini-upload-group">
                                <label>Archivo Secundario (Nuevo)</label>
                                <input type="file" id="linSecondaryFileInput" accept=".txt" class="hidden-input">
                                <button onclick="document.getElementById('linSecondaryFileInput').click()" class="mini-upload-btn secondary-border">
                                    <i class="fas fa-file-alt"></i>
                                    <span id="linSecondaryFileName">Seleccionar Secundario</span>
                                </button>
                            </div>
                        </div>
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
    }

    bindEvents() {
        // CARGA INDIVIDUAL
        const fileInput = this.container.querySelector('#linValidatorFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileLoad(e));
        }

        // CÍCLICO: PRINCIPAL
        const masterInput = this.container.querySelector('#linMasterFileInput');
        if (masterInput) {
            masterInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const result = await loadFile(file, true);
                    this.masterRecords = result.records;
                    this.container.querySelector('#linMasterFileName').textContent = file.name;
                    window.showNotification('Archivo Cargado', 'Principal cargado para comparación.', 'info');
                }
            });
        }

        // CÍCLICO: SECUNDARIO
        const secondaryInput = this.container.querySelector('#linSecondaryFileInput');
        if (secondaryInput) {
            secondaryInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const result = await loadFile(file, true);
                    this.records = result.records;
                    this.container.querySelector('#linSecondaryFileName').textContent = file.name;
                    window.showNotification('Archivo Cargado', 'Secundario cargado para comparación.', 'info');
                }
            });
        }

        const runCompareBtn = this.container.querySelector('#btnRunLinCompare');
        if (runCompareBtn) {
            runCompareBtn.onclick = () => this.runStrictComparison();
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
            // CARGA PURA: Cargamos el archivo sin correcciones automáticas para revisión previa
            const result = await loadFile(file, true);
            if (!result) return;

            this.fileName = result.fileName;
            this.records = result.records.map((r, i) => ({ 
                ...r, 
                _uid: r._uid || `lin_${Date.now()}_${i}` 
            }));
            
            this.container.querySelector('#linFileName1').textContent = this.fileName;
            await this.performValidation();
            
            window.showNotification('Auditoría Completada', 'Se ha verificado contra el Maestro de la base de datos.', 'success');
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
            r.isInvalidName = !isValidColorName(r.baseName || cleanBase, r.name);

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
                        return diff ? `<span style="color: #f43f5e; font-weight: bold;">${val}</span>` : val;
                    }).join(' / ');
                }
                if (rec.complementaryDiscrepancy && rec.groupRefCmyk) {
                    return rec.cmyk.map((v, i) => {
                        const diff = Math.abs(v - (rec.groupRefCmyk[i] || 0)) > 0.0001;
                        const val = Number(v).toFixed(6);
                        return diff ? `<span style="color: #f43f5e; font-weight: bold;">${val}</span>` : val;
                    }).join(' / ');
                }
                return rec.cmyk.map(v => Number(v).toFixed(6)).join(' / ');
            };

            const cmykStr = formatCmykWithMaster(record);
            const labStr = (record.lab || []).map(v => Number(v).toFixed(1)).join(' / ');
            const nk = record.nk || '---';
            
            let statusHtml = '<span style="color: #10b981; font-size: 0.75rem;"><i class="fas fa-check-circle"></i> Válido</span>';
            let rowColorClass = 'row-success';

            if (record.isDuplicate) { 
                statusHtml = '<span style="color: #f43f5e; font-size: 0.75rem;"><i class="fas fa-copy"></i> Duplicado</span>'; 
                rowColorClass = 'row-error-red';
            } else if (record.cmykDiscrepancy) {
                statusHtml = '<span style="color: #ec4899; font-size: 0.75rem;"><i class="fas fa-database"></i> Diferencia vs Maestro</span>';
                rowColorClass = 'row-error-pink';
            } else if (record.hasCmykRangeError) {
                statusHtml = '<span style="color: #f43f5e; font-size: 0.75rem;"><i class="fas fa-exclamation-circle"></i> Valor CMYK > 100</span>';
                rowColorClass = 'row-error-red';
            } else if (record.complementaryDiscrepancy) {
                statusHtml = '<span style="color: #8b5cf6; font-size: 0.75rem;"><i class="fas fa-project-diagram"></i> Diferencia en Complementarios</span>';
                rowColorClass = 'row-error-purple';
            } else if (record.isInvalidName) { 
                statusHtml = '<span style="color: #f59e0b; font-size: 0.75rem;"><i class="fas fa-book-dead"></i> No está en Catálogo</span>';
                rowColorClass = 'row-error-orange';
            } else if (record.hasNumberedParentheses) {
                statusHtml = '<span style="color: #eab308; font-size: 0.75rem;"><i class="fas fa-brackets-curly"></i> Nomenclatura (X)</span>';
                rowColorClass = 'row-error-yellow';
            } else if (record.isMissingNk) { 
                statusHtml = '<span style="color: #3b82f6; font-size: 0.75rem;"><i class="fas fa-fingerprint"></i> Falta código NK</span>'; 
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
                        <div class="row-actions">
                            ${record.hasError && !record.isDuplicate ? `<button class="btn-icon-action fix" data-uid="${record._uid}" title="Corregir"><i class="fas fa-magic"></i></button>` : ''}
                            ${record.isDuplicate ? `<button class="btn-icon-action delete" data-uid="${record._uid}" title="Eliminar"><i class="fas fa-trash"></i></button>` : ''}
                        </div>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // 5. Vincular eventos de acciones
        tableBody.querySelectorAll('.btn-icon-action.fix').forEach(btn => {
            btn.onclick = async () => {
                const uid = btn.dataset.uid;
                const idx = this.records.findIndex(r => r._uid === uid);
                if (idx === -1) return;
                const result = await validateAndCorrectRecords([this.records[idx]], 'Individual', null, '', this.records);
                if (result && result.corrected) {
                    this.records[idx] = result.records[0];
                    this.performValidation();
                    window.showNotification('Corregido', 'El registro ha sido actualizado.', 'success');
                }
            };
        });

        tableBody.querySelectorAll('.btn-icon-action.delete').forEach(btn => {
            btn.onclick = () => {
                const uid = btn.dataset.uid;
                const idx = this.records.findIndex(r => r._uid === uid);
                if (idx === -1) return;
                if (confirm('¿Seguro que desea eliminar este registro duplicado?')) {
                    this.records.splice(idx, 1);
                    this.performValidation();
                    window.showNotification('Eliminado', 'Registro eliminado correctamente.', 'info');
                }
            };
        });

        const exportBtn = this.container.querySelector('#btnExportLin');
        if (exportBtn) exportBtn.disabled = errorCount > 0;
    }

    reset() {
        this.records = [];
        this.masterRecords = [];
        this.comparisonResults = [];
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
