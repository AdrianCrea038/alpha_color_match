import { escapeHtml, showNotification } from '../core/utils.js';
import { loadFile } from '../modules/fileLoader.js';
import { validateAndCorrectRecords } from '../modules/nameValidator.js';

export class LinearizationValidatorView {
    constructor(app) {
        this.app = app;
        this.records = [];
        this.results = [];
        this.container = null;
        this.fileName = '';
        
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
            <div class="palette-validator-container">
                <div class="palette-validator-header">
                    <h3><i class="fas fa-microscope"></i> Auditoría</h3>
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
                            <button id="btnExportLin" class="btn-primary" style="font-size: 0.75rem; padding: 0.4rem 1rem; background: #10b981; border: none; display:none;"><i class="fas fa-download"></i> Exportar Corregido</button>
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
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="linResultsTableBody">
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- SECCIÓN DE COMPARACIÓN ESTRICTA -->
                <div class="strict-comparison-section" style="margin-top: 3rem; border-top: 2px dashed rgba(0, 229, 255, 0.2); padding-top: 2rem;">
                    <div class="palette-validator-header" style="margin-bottom: 1.5rem;">
                        <h3 style="color: #ff007f;"><i class="fas fa-equals"></i> Comparación Estricta (Archivo vs Archivo)</h3>
                        <p style="font-size: 0.85rem; color: #9ca3af;">Verificación binaria: Ambos archivos deben ser EXACTAMENTE iguales en nombres, NK y valores.</p>
                    </div>

                    <div class="upload-section" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="upload-card">
                            <h3><i class="fas fa-file-invoice"></i> 1. Archivo Original (Base)</h3>
                            <div class="upload-area">
                                <input type="file" id="strictFileA" accept=".txt" class="file-input">
                                <label for="strictFileA" class="file-label">Archivo Base</label>
                                <div id="strictFileAInfo" class="file-info"><span class="filename">No cargado</span></div>
                            </div>
                        </div>
                        <div class="upload-card">
                            <h3><i class="fas fa-file-signature"></i> 2. Archivo a Validar</h3>
                            <div class="upload-area">
                                <input type="file" id="strictFileB" accept=".txt" class="file-input">
                                <label for="strictFileB" class="file-label">Archivo Nuevo</label>
                                <div id="strictFileBInfo" class="file-info"><span class="filename">No cargado</span></div>
                            </div>
                        </div>
                    </div>

                    <div style="text-align: center; margin-top: 1.5rem;">
                        <button id="btnRunStrictCompare" class="btn-primary" style="background: #ff007f; padding: 0.8rem 2rem; font-weight: bold; display: none;">
                            <i class="fas fa-bolt"></i> INICIAR COMPARACIÓN ESTRICTA
                        </button>
                    </div>

                    <div id="strictResultsPanel" style="display: none; margin-top: 2rem;">
                        <div class="results-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h4 style="color: #ff007f; margin: 0;"><i class="fas fa-list-check"></i> Informe de Diferencias Estrictas</h4>
                            <button id="btnResetStrict" class="btn-secondary" style="font-size: 0.75rem; padding: 0.4rem 0.8rem; background: rgba(255, 0, 127, 0.1); border-color: #ff007f; color: #ff007f;">
                                <i class="fas fa-sync-alt"></i> Nueva Comparación
                            </button>
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead style="background: rgba(255, 0, 127, 0.1);">
                                    <tr>
                                        <th style="width: 25%;">Archivo Base (Original)</th>
                                        <th style="width: 25%;">Archivo Nuevo (A Validar)</th>
                                        <th style="width: 35%;">Diferencias Encontradas</th>
                                        <th style="width: 15%; text-align: center;">Estado</th>
                                    </tr>
                                </thead>
                                <tbody id="strictResultsTableBody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div id="linEmptyState" class="empty-state" style="padding: 4rem 2rem;">
                    <div class="empty-icon" style="font-size: 3rem; margin-bottom: 1rem;">🔬</div>
                    <p>Cargue un archivo para iniciar la auditoría o use la sección de abajo para comparación estricta.</p>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // Auditoría normal
        const fileInput = this.container.querySelector('#linValidatorFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileLoad(e));
        }

        const resetBtn = this.container.querySelector('#linResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }

        const exportBtn = this.container.querySelector('#btnExportLin');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportCorrectedFile());
        }

        // Comparación Estricta
        const inputA = this.container.querySelector('#strictFileA');
        const inputB = this.container.querySelector('#strictFileB');
        const btnStrict = this.container.querySelector('#btnRunStrictCompare');

        inputA?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const { records } = await loadFile(file, true);
                this.strictRecordsA = records;
                const infoA = this.container.querySelector('#strictFileAInfo .filename');
                if (infoA) infoA.textContent = file.name;
                this.checkStrictReady();
            }
        });

        inputB?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const { records } = await loadFile(file, true);
                this.strictRecordsB = records;
                const infoB = this.container.querySelector('#strictFileBInfo .filename');
                if (infoB) infoB.textContent = file.name;
                this.checkStrictReady();
            }
        });

        btnStrict?.addEventListener('click', () => this.performStrictComparison());

        const btnResetStrict = this.container.querySelector('#btnResetStrict');
        if (btnResetStrict) {
            btnResetStrict.addEventListener('click', () => this.resetStrict());
        }
    }

    checkStrictReady() {
        const btn = this.container.querySelector('#btnRunStrictCompare');
        if (this.strictRecordsA && this.strictRecordsB) {
            btn.style.display = 'inline-block';
        }
    }

    performStrictComparison() {
        const tbody = this.container.querySelector('#strictResultsTableBody');
        const panel = this.container.querySelector('#strictResultsPanel');
        if (!tbody || !panel) return;

        tbody.innerHTML = '';
        panel.style.display = 'block';

        const mapA = new Map();
        this.strictRecordsA.forEach(r => {
            const key = r.name.toUpperCase().trim();
            if (!mapA.has(key)) mapA.set(key, r);
        });

        const mapB = new Map();
        this.strictRecordsB.forEach(r => {
            const key = r.name.toUpperCase().trim();
            if (!mapB.has(key)) mapB.set(key, r);
        });

        const allKeys = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).sort();
        let diffCount = 0;

        allKeys.forEach(key => {
            const recA = mapA.get(key);
            const recB = mapB.get(key);
            
            let diffs = [];
            let status = 'valid';
            let valA = recA ? `${recA.name} [NK: ${recA.nk || '-'}]` : '---';
            let valB = recB ? `${recB.name} [NK: ${recB.nk || '-'}]` : '---';

            if (recA && recB) {
                const nkA = (recA.nk || '').trim().toUpperCase();
                const nkB = (recB.nk || '').trim().toUpperCase();
                if (nkA !== nkB) diffs.push(`NK Diferente: "${nkA || '-'}" vs "${nkB || '-'}"`);

                const cmykA = (recA.cmyk || []).map(v => Number(v).toFixed(6));
                const cmykB = (recB.cmyk || []).map(v => Number(v).toFixed(6));
                if (cmykA.join('/') !== cmykB.join('/')) diffs.push(`CMYK Diferente`);

                const labA = (recA.lab || []).map(v => Number(v).toFixed(4));
                const labB = (recB.lab || []).map(v => Number(v).toFixed(4));
                if (labA.join('/') !== labB.join('/')) diffs.push(`LAB Diferente`);

                if (diffs.length > 0) { status = 'invalid'; diffCount++; }
            } else if (recA) {
                diffs.push('El color NO existe en el nuevo archivo');
                status = 'missing';
                diffCount++;
            } else {
                diffs.push('El color es NUEVO (no existe en la base)');
                status = 'additional';
                diffCount++;
            }
            this.addStrictRow(tbody, valA, valB, diffs, status);
        });

        if (diffCount === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #4ade80; padding: 3rem; font-size: 1.1rem;">✅ ¡ARCHIVOS IDÉNTICOS!</td></tr>`;
        }
    }

    addStrictRow(tbody, valA, valB, diffs, status) {
        const row = document.createElement('tr');
        let statusLabel = status === 'valid' ? 'IDÉNTICO' : (status === 'missing' ? 'FALTANTE' : (status === 'additional' ? 'ADICIONAL' : 'DIFERENTE'));
        let statusClass = status === 'valid' ? 'valid' : (status === 'additional' ? 'warning' : 'invalid');

        row.innerHTML = `
            <td style="font-size: 0.8rem; font-weight: 500;">${escapeHtml(valA)}</td>
            <td style="font-size: 0.8rem; font-weight: 500;">${escapeHtml(valB)}</td>
            <td style="font-size: 0.75rem; color: #f43f5e;">${diffs.join(', ')}</td>
            <td style="text-align: center;"><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        `;
        tbody.appendChild(row);
    }

    resetStrict() {
        this.strictRecordsA = null; this.strictRecordsB = null;
        this.container.querySelector('#strictFileA').value = '';
        this.container.querySelector('#strictFileB').value = '';
        this.container.querySelector('#strictFileAInfo .filename').textContent = 'No cargado';
        this.container.querySelector('#strictFileBInfo .filename').textContent = 'No cargado';
        this.container.querySelector('#btnRunStrictCompare').style.display = 'none';
        this.container.querySelector('#strictResultsPanel').style.display = 'none';
        this.container.querySelector('#strictResultsTableBody').innerHTML = '';
    }

    reset() {
        this.records = []; this.results = []; this.fileName = '';
        this.container.querySelector('#linValidatorFileInput').value = '';
        this.container.querySelector('#linResultsPanel').style.display = 'none';
        this.container.querySelector('#linEmptyState').style.display = 'block';
        const info = this.container.querySelector('#linValidatorFileInfo');
        info.querySelector('.filename').textContent = 'Ningún archivo cargado';
        info.querySelector('.record-count').textContent = '';
    }

    async handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const { getAllMasterNks } = await import('../core/supabaseClient.js');
            window.ALL_MASTER_NKS = await getAllMasterNks();
            
            const { records, fileName } = await loadFile(file, true);
            this.records = records.map((r, i) => ({ ...r, _uid: `rec_${Date.now()}_${i}` }));
            this.fileName = fileName;
            this.updateFileInfo(fileName, records.length);
            this.performValidation();
        } catch (error) {
            alert('Error: ' + error);
        }
    }

    updateFileInfo(name, count) {
        const info = this.container.querySelector('#linValidatorFileInfo');
        info.querySelector('.filename').textContent = name;
        info.querySelector('.record-count').textContent = `${count} registros`;
    }

    performValidation() {
        const results = this.records.map(record => ({ ...record, errors: [] }));
        const parenRegex = /\([^)]*\)/;
        const { extractBaseName } = window.utils || {};
        const cleanNameFn = (name) => {
            if (typeof extractBaseName === 'function') return extractBaseName(name).toUpperCase();
            return (name || '').replace(/\s*\([^)]*\)/g, '').toUpperCase().trim();
        };

        const masterNks = (window.ALL_MASTER_NKS || []).map(n => n.toUpperCase());
        const groups = {}; 

        results.forEach(record => {
            const bNameClean = cleanNameFn(record.name);
            const nkRaw = (record.nk || '').trim();
            const nkUpper = nkRaw.toUpperCase();
            const groupKey = `${bNameClean}|${nkUpper || 'SIN_NK'}`;
            
            if (!groups[groupKey]) groups[groupKey] = { key: groupKey, baseName: bNameClean, nk: nkUpper, records: [], hasErrors: false };
            groups[groupKey].records.push(record);

            if (!nkRaw) record.errors.push({ type: 'critical', message: 'NK Faltante' });
            else if (parenRegex.test(nkRaw) || !masterNks.includes(nkUpper)) record.errors.push({ type: 'naming', message: 'NK Inválido' });
            if (parenRegex.test(record.name)) record.errors.push({ type: 'naming', message: 'Nombre con paréntesis' });
            if (record.errors.length > 0) groups[groupKey].hasErrors = true;
        });

        Object.values(groups).forEach(group => {
            if (group.records.length > 1) {
                group.hasErrors = true;
                group.records.forEach(r => r.errors.push({ type: 'duplicate', message: 'Duplicado' }));
                const firstCmyk = (group.records[0].cmyk || []).map(v => Number(v).toFixed(2)).join('|');
                if (group.records.some(r => (r.cmyk || []).map(v => Number(v).toFixed(2)).join('|') !== firstCmyk)) {
                    group.records.forEach(r => r.errors.push({ type: 'consistency', message: 'CMYK inconsistente' }));
                }
            }
        });

        this.conflictGroups = Object.values(groups).sort((a, b) => b.hasErrors - a.hasErrors || a.baseName.localeCompare(b.baseName));
        this.renderResults();
    }

    renderResults() {
        const resultsPanel = this.container.querySelector('#linResultsPanel');
        const tableBody = this.container.querySelector('#linResultsTableBody');
        const statsBadges = this.container.querySelector('#linStatsBadges');
        const exportBtn = this.container.querySelector('#btnExportLin');

        this.container.querySelector('#linEmptyState').style.display = 'none';
        resultsPanel.style.display = 'block';
        if (exportBtn) exportBtn.style.display = 'inline-block';

        let errorGroupsCount = this.conflictGroups.filter(g => g.hasErrors).length;
        statsBadges.innerHTML = `<span class="badge" style="color: ${errorGroupsCount > 0 ? '#f43f5e' : '#4ade80'};">${errorGroupsCount > 0 ? '⚠️ ' + errorGroupsCount + ' Conflictos' : '✅ Limpio'}</span>`;

        tableBody.innerHTML = '';
        this.conflictGroups.forEach(group => {
            if (group.hasErrors) this.renderConflictCard(tableBody, group);
            else this.renderCleanRow(tableBody, group.records[0]);
        });
    }

    renderConflictCard(container, group) {
        const tr = document.createElement('tr');
        const itemsHtml = group.records.map((r, i) => `
            <div class="conflict-item" style="display: grid; grid-template-columns: 2fr 1fr 1fr; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); align-items: center;">
                <div style="font-size: 0.8rem;"><strong>${escapeHtml(r.name)}</strong></div>
                <div style="font-family: monospace; font-size: 0.75rem;">${(r.cmyk || []).map(v => Number(v).toFixed(1)).join('/')}</div>
                <div style="display: flex; gap: 4px; justify-content: flex-end;">
                    <button onclick="window.linValidatorView.applyDecision('${group.key}', '${r._uid}', 'keep')" class="btn-mini action-keep">💎 Usar</button>
                    <button onclick="window.linValidatorView.applyDecision('${group.key}', '${r._uid}', 'edit')" class="btn-mini action-edit"><i class="fas fa-edit"></i></button>
                    <button onclick="window.linValidatorView.applyDecision('${group.key}', '${r._uid}', 'delete')" class="btn-mini action-delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>`).join('');

        tr.innerHTML = `<td colspan="7" style="padding: 0;">
            <div class="conflict-card" style="border: 1px solid #f43f5e; margin: 5px; border-radius: 8px; overflow: hidden;">
                <div style="background: rgba(244, 63, 94, 0.1); padding: 5px 10px; font-weight: bold; font-size: 0.8rem;">📦 GRUPO: ${escapeHtml(group.baseName)} | NK: ${escapeHtml(group.nk)}</div>
                <div class="conflict-body">${itemsHtml}</div>
            </div></td>`;
        container.appendChild(tr);
    }

    renderCleanRow(container, record) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>—</td>
            <td style="color: #4ade80;">${escapeHtml(record.name)}</td>
            <td><span class="nk-badge">${escapeHtml(record.nk)}</span></td>
            <td style="font-family: monospace; font-size: 0.8rem;">${(record.cmyk || []).map(v => Number(v).toFixed(1)).join('/')}</td>
            <td style="font-family: monospace; font-size: 0.8rem;">${(record.lab || []).map(v => Number(v).toFixed(1)).join('/')}</td>
            <td>✅ Válido</td>
            <td><button onclick="window.linValidatorView.applyDecision(null, '${record._uid}', 'delete')" style="background:none; border:none; color:#f43f5e; cursor:pointer;"><i class="fas fa-trash"></i></button></td>
        `;
        container.appendChild(tr);
    }

    async applyDecision(groupKey, uid, action) {
        if (action === 'delete') {
            if (confirm(`¿Eliminar registro?`)) { this.records = this.records.filter(r => r._uid !== uid); this.performValidation(); }
        } else if (action === 'edit') {
            const idx = this.records.findIndex(r => r._uid === uid);
            if (idx !== -1) await this.correctRecord(idx);
        } else if (action === 'keep') {
            const group = this.conflictGroups.find(g => g.key === groupKey);
            const record = group.records.find(r => r._uid === uid);
            if (confirm(`¿Unificar grupo usando esta versión?`)) {
                const official = { ...record };
                official.name = group.baseName + (official.nk ? ` ${official.nk}` : '');
                const uids = group.records.map(r => r._uid);
                this.records = this.records.filter(r => !uids.includes(r._uid));
                this.records.push(official);
                this.performValidation();
            }
        }
    }

    async correctRecord(index) {
        const record = this.records[index];
        const { validateAndCorrectRecords } = await import('../modules/nameValidator.js');
        const result = await validateAndCorrectRecords([record], 'linearization', null, (this.records.find(r => r.nk)?.nk || ''));
        if (result.corrected && result.records.length > 0) { this.records[index] = { ...result.records[0], _uid: record._uid }; this.performValidation(); }
    }

    exportCorrectedFile() {
        if (this.records.length === 0) return;

        const today = new Date();
        const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
        
        // Formato CGATS.17 idéntico al de Comparación
        let content = 'CGATS.17\n';
        content += 'ORIGINATOR\t"ALPHA COLOR MATCH"\n';
        content += 'FILE_DESCRIPTOR\t""\n';
        content += `CREATED\t"${dateStr}"\n`;
        content += 'NUMBER_OF_FIELDS\t9\n';
        content += 'BEGIN_DATA_FORMAT\n';
        content += 'SAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B\n';
        content += 'END_DATA_FORMAT\n';
        content += `NUMBER_OF_SETS\t${this.records.length}\n`;
        content += 'BEGIN_DATA\n\n';

        this.records.forEach((item, index) => {
            const counter = index + 1;
            content += `${counter} "${item.name}" `;
            content += `${item.cmyk[0].toFixed(6)} ${item.cmyk[1].toFixed(6)} `;
            content += `${item.cmyk[2].toFixed(6)} ${item.cmyk[3].toFixed(6)} `;
            content += `${item.lab[0].toFixed(6)} ${item.lab[1].toFixed(6)} ${item.lab[2].toFixed(6)}\n`;
        });

        content += '\nEND_DATA\n';

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.fileName || 'linearizacion_corregida.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showNotification('Exportado (CGATS.17)', `Formato idéntico a Comparación: ${link.download}`, 'success');
    }
}
