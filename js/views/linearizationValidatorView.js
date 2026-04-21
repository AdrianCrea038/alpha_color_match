// js/views/linearizationValidatorView.js
import { escapeHtml } from '../core/utils.js';
import { loadFile } from '../modules/fileLoader.js';

export class LinearizationValidatorView {
    constructor(app) {
        this.app = app;
        this.records = [];
        this.results = [];
        this.container = null;
        this.fileName = '';
        
        this.init();
    }

    init() {
        this.container = document.getElementById('linearizationValidatorView');
        if (!this.container) return;
        this.render();
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="palette-validator-container">
                <div class="palette-validator-header">
                    <h3><i class="fas fa-microscope"></i> Comprobación</h3>
                    <p style="font-size: 0.85rem; color: #9ca3af;">Auditoría de nombres duplicados, nomenclatura con paréntesis y consistencia de complementarios.</p>
                </div>

                <div class="upload-section" style="margin-bottom: 2rem;">
                    <div class="upload-card" style="max-width: 100%; width: 100%;">
                        <h3>📁 Cargar Archivo de Linearización (.txt)</h3>
                        <div class="upload-area">
                            <input type="file" id="linValidatorFileInput" accept=".txt" class="file-input">
                            <label for="linValidatorFileInput" class="file-label">Seleccionar archivo</label>
                            <div class="file-info" id="linValidatorFileInfo">
                                <span class="filename">Ningún archivo cargado</span>
                                <span class="record-count"></span>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="linResultsPanel" style="display: none;">
                    <div class="results-header" style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="color: #00e5ff; margin: 0;"><i class="fas fa-clipboard-check"></i> Resultados del Análisis</h4>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <div id="linStatsBadges" style="display: flex; gap: 0.5rem;"></div>
                            <button id="linResetBtn" class="btn-secondary" style="font-size: 0.75rem; padding: 0.4rem 0.8rem;"><i class="fas fa-sync-alt"></i> Nueva Validación</button>
                        </div>
                    </div>

                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="width: 50px;">#</th>
                                    <th>Nombre del Color</th>
                                    <th>NK</th>
                                    <th>CMYK (C/M/Y/K)</th>
                                    <th>Lab (L/a/b)</th>
                                    <th>Estado de Validación</th>
                                </tr>
                            </thead>
                            <tbody id="linResultsTableBody">
                            </tbody>
                        </table>
                    </div>
                </div>

                <div id="linEmptyState" class="empty-state" style="padding: 4rem 2rem;">
                    <div class="empty-icon" style="font-size: 3rem; margin-bottom: 1rem;">🔬</div>
                    <p>Cargue un archivo para iniciar la validación automática.</p>
                    <p style="font-size: 0.8rem; color: #6b7280; max-width: 500px; margin: 0 auto;">El sistema buscará nombres duplicados, errores de nomenclatura como "(2)" y verificará que los colores equivalentes tengan valores idénticos.</p>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const fileInput = this.container.querySelector('#linValidatorFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileLoad(e));
        }

        const resetBtn = this.container.querySelector('#linResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }
    }

    reset() {
        this.records = [];
        this.results = [];
        this.fileName = '';
        
        const fileInput = this.container.querySelector('#linValidatorFileInput');
        if (fileInput) fileInput.value = '';

        const resultsPanel = this.container.querySelector('#linResultsPanel');
        const emptyState = this.container.querySelector('#linEmptyState');
        const info = this.container.querySelector('#linValidatorFileInfo');

        if (resultsPanel) resultsPanel.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        if (info) {
            info.querySelector('.filename').textContent = 'Ningún archivo cargado';
            info.querySelector('.record-count').textContent = '';
        }
    }

    async handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            // Refrescar datos de la base de datos antes de validar
            if (this.app.developmentView && this.app.developmentView.loadEquivalencyGroups) {
                console.log('📡 Refrescando tabla de equivalencias desde Supabase...');
                await this.app.developmentView.loadEquivalencyGroups();
            }

            const { records, fileName } = await loadFile(file, true); // Pasar true para mantener duplicados
            this.records = records;
            this.fileName = fileName;
            this.updateFileInfo(fileName, records.length);
            this.performValidation();
        } catch (error) {
            console.error('Error cargando archivo:', error);
            alert('Error al cargar el archivo: ' + error);
        }
    }

    updateFileInfo(name, count) {
        const info = this.container.querySelector('#linValidatorFileInfo');
        if (info) {
            info.querySelector('.filename').textContent = name;
            info.querySelector('.record-count').textContent = `${count} registros`;
        }
    }

    performValidation() {
        const results = this.records.map(record => ({
            ...record,
            errors: []
        }));

        // 1. Duplicados de Nombre (Usando baseName para ignorar NKs)
        const nameCounts = {};
        this.records.forEach(r => {
            const name = (r.baseName || '').toUpperCase().trim();
            nameCounts[name] = (nameCounts[name] || 0) + 1;
        });

        // 2. Paréntesis (ej: "(2)", "(VERSIÓN)", "(COPIA)")
        const parenRegex = /\([^)]*\)/;

        // 3. Consistencia de Complementarios
        const groupsInFile = {};
        const equivalenceMap = window.EQUIVALENCE_MAP || new Map();

        results.forEach(record => {
            const bName = (record.baseName || '').trim();
            const bNameUpper = bName.toUpperCase();
            const fullName = (record.name || '').trim();

            // Error de duplicado
            if (nameCounts[bNameUpper] > 1) {
                record.errors.push({ type: 'duplicate', message: 'Nombre duplicado' });
            }

            // Error de paréntesis (Buscamos en el nombre completo por si se extrajo como NK)
            if (parenRegex.test(fullName)) {
                record.errors.push({ type: 'naming', message: 'Nomenclatura con paréntesis (...)' });
            }

            // 3. Validación contra Base de Datos (Existencia y Cápsula usando baseName)
            const equivalencyRows = window.EQUIVALENCY_ROWS || [];
            let foundInDb = false;
            let exactCasingMatch = false;
            let officialName = '';

            for (const row of equivalencyRows) {
                for (let i = 1; i < row.length; i++) {
                    const dbName = row[i];
                    if (dbName.toUpperCase() === bNameUpper) {
                        foundInDb = true;
                        officialName = dbName;
                        if (dbName === bName) {
                            exactCasingMatch = true;
                        }
                        break;
                    }
                }
                if (foundInDb) break;
            }

            if (!foundInDb) {
                record.errors.push({ type: 'naming', message: 'Nombre NO registrado en base de datos' });
            }

            // Agrupar para consistencia
            const eqData = equivalenceMap.get(bNameUpper);
            if (eqData) {
                if (!groupsInFile[eqData.groupId]) groupsInFile[eqData.groupId] = [];
                groupsInFile[eqData.groupId].push(record);
            }
        });

        // Validar consistencia dentro de cada grupo
        for (const groupId in groupsInFile) {
            const groupRecords = groupsInFile[groupId];
            if (groupRecords.length > 1) {
                const first = groupRecords[0];
                const firstCmyk = (first.cmyk || []).map(v => Number(v).toFixed(2)).join('|');
                const firstLab = (first.lab || []).map(v => Number(v).toFixed(2)).join('|');

                for (let i = 1; i < groupRecords.length; i++) {
                    const current = groupRecords[i];
                    const currentCmyk = (current.cmyk || []).map(v => Number(v).toFixed(2)).join('|');
                    const currentLab = (current.lab || []).map(v => Number(v).toFixed(2)).join('|');

                    if (firstCmyk !== currentCmyk || firstLab !== currentLab) {
                        // Marcar todos los del grupo con error de consistencia
                        groupRecords.forEach(r => {
                            if (!r.errors.some(e => e.type === 'consistency')) {
                                r.errors.push({ type: 'consistency', message: 'Inconsistencia en valores del grupo' });
                            }
                        });
                        break;
                    }
                }
            }
        }

        this.results = results;
        window.linValidatorView = this;
        this.renderResults();
    }

    async correctRecord(index) {
        const record = this.results[index];
        const { validateAndCorrectRecords } = await import('../modules/nameValidator.js');
        
        // Abrir el modal de corrección interactiva (el mismo que en el comparador)
        const result = await validateAndCorrectRecords([record], 'linearization', (oldN, newN, reason) => {
            console.log(`Corregido en Linearización: ${oldN} -> ${newN}`);
        });

        if (result.corrected && result.records.length > 0) {
            // Actualizar el registro original y re-validar todo el archivo
            this.records[index] = result.records[0];
            this.performValidation();
        }
    }

    renderResults() {
        const resultsPanel = this.container.querySelector('#linResultsPanel');
        const emptyState = this.container.querySelector('#linEmptyState');
        const tableBody = this.container.querySelector('#linResultsTableBody');
        const statsBadges = this.container.querySelector('#linStatsBadges');

        if (!tableBody || !resultsPanel || !emptyState) return;

        emptyState.style.display = 'none';
        resultsPanel.style.display = 'block';

        let duplicateCount = 0;
        let namingCount = 0;
        let consistencyCount = 0;

        tableBody.innerHTML = this.results.map((record, index) => {
            let statusHtml = '<span style="color: #4ade80;"><i class="fas fa-check-circle"></i> Válido</span>';
            let rowClass = '';

            if (record.errors.length > 0) {
                rowClass = 'error-row';
                const errorMessages = record.errors.map(e => {
                    let icon = 'fa-exclamation-triangle';
                    let color = '#fbbf24';
                    
                    if (e.type === 'duplicate') { 
                        duplicateCount++;
                        color = '#f87171'; icon = 'fa-copy'; 
                    } else if (e.type === 'naming') {
                        namingCount++;
                        color = '#fbbf24'; icon = 'fa-font';
                    } else if (e.type === 'consistency') {
                        consistencyCount++;
                        color = '#a78bfa'; icon = 'fa-layer-group';
                    }
                    
                    return `<div style="color: ${color}; font-size: 0.75rem; margin-bottom: 2px;"><i class="fas ${icon}"></i> ${e.message}</div>`;
                }).join('');
                statusHtml = `<div class="error-container">${errorMessages}</div>`;
            }

            const cmykStr = (record.cmyk || []).map(v => Number(v).toFixed(1)).join(' / ');
            const labStr = (record.lab || []).map(v => Number(v).toFixed(1)).join(' / ');

            return `
                <tr class="${rowClass}">
                    <td>${index + 1}</td>
                    <td style="font-weight: 500;">${escapeHtml(record.baseName)}</td>
                    <td><span class="nk-badge">${escapeHtml(record.nk || '-')}</span></td>
                    <td style="font-family: monospace;">${cmykStr}</td>
                    <td style="font-family: monospace;">${labStr}</td>
                    <td>${statusHtml}</td>
                    <td>
                        ${record.errors.length > 0 ? `
                            <button onclick="window.linValidatorView.correctRecord(${index})" style="padding: 4px 8px; background: #ff007f; color: white; border: none; border-radius: 4px; cursor: pointer; transition: all 0.2s;" title="Corregir">
                                <i class="fas fa-magic"></i>
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');

        // Stats Badges
        statsBadges.innerHTML = `
            ${duplicateCount > 0 ? `<span class="badge" style="background: rgba(248, 113, 113, 0.2); color: #f87171; border: 1px solid #f87171; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.7rem;">${duplicateCount} Duplicados</span>` : ''}
            ${namingCount > 0 ? `<span class="badge" style="background: rgba(251, 191, 36, 0.2); color: #fbbf24; border: 1px solid #fbbf24; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.7rem;">${namingCount} Nomenclatura</span>` : ''}
            ${consistencyCount > 0 ? `<span class="badge" style="background: rgba(167, 139, 250, 0.2); color: #a78bfa; border: 1px solid #a78bfa; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.7rem;">Inconsistencias</span>` : ''}
            ${(duplicateCount === 0 && namingCount === 0 && consistencyCount === 0) ? '<span class="badge" style="background: rgba(74, 222, 128, 0.2); color: #4ade80; border: 1px solid #4ade80; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.7rem;">Archivo Limpio</span>' : ''}
        `;
    }
}
