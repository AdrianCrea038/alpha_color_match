export class UIRenderer {
    constructor(app) {
        this.app = app;
        this.creatorRows = [];
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast';
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        toast.innerHTML = `${icons[type] || 'ℹ️'} ${message}`;
        container.appendChild(toast);
        
        setTimeout(() => toast.remove(), 3000);
    }
    
    renderComparisonTable(results, app) {
        const tbody = document.getElementById('tableBody');
        
        if (results.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <div class="empty-icon">🔍</div>
                        <p>No se encontraron resultados</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = results.map((item, idx) => {
            const statusClass = item.status === 'match' ? 'status-match' : 
                               (item.status === 'diff' ? 'status-diff' : 'status-missing');
            
            let statusText = '';
            
            if (item.status === 'match') {
                statusText = '✅ Coincidencia exacta';
            } else if (item.status === 'diff') {
                statusText = '⚠️ Valores diferentes';
            } else {
                statusText = '❌ NO ENCONTRADO';
            }
            
            const diffHighlight = item.status === 'diff' ? 'diff-highlight' : 
                                 (item.status === 'missing' ? 'missing-highlight' : '');
            
            let cmykDisplay = '';
            if (item.status === 'missing') {
                cmykDisplay = `
                    <div class="cmyk-comparison">
                        <div class="cmyk-secondary">
                            <strong>📁 Secundario:</strong><br>
                            C:${item.cmykSecondary[0].toFixed(1)} M:${item.cmykSecondary[1].toFixed(1)} Y:${item.cmykSecondary[2].toFixed(1)} K:${item.cmykSecondary[3].toFixed(1)}
                        </div>
                        <div class="cmyk-primary missing">
                            <strong>⚠️ No encontrado en archivo principal</strong>
                        </div>
                    </div>
                `;
            } else {
                cmykDisplay = `
                    <div class="cmyk-comparison">
                        <div class="cmyk-primary ${item.status === 'diff' ? 'diff-value' : ''}">
                            <strong>📁 Principal (Referencia):</strong><br>
                            C:${item.cmykPrimary[0].toFixed(1)} M:${item.cmykPrimary[1].toFixed(1)} Y:${item.cmykPrimary[2].toFixed(1)} K:${item.cmykPrimary[3].toFixed(1)}
                        </div>
                        <div class="cmyk-secondary ${item.status === 'diff' ? 'diff-value' : ''}">
                            <strong>🔄 Secundario (Comparar):</strong><br>
                            C:${item.cmykSecondary[0].toFixed(1)} M:${item.cmykSecondary[1].toFixed(1)} Y:${item.cmykSecondary[2].toFixed(1)} K:${item.cmykSecondary[3].toFixed(1)}
                        </div>
                    </div>
                `;
            }
            
            let labDisplay = '';
            if (item.status !== 'missing' && item.labPrimary && item.labSecondary) {
                labDisplay = `
                    <div class="lab-comparison">
                        <div class="lab-primary">
                            📁 L:${item.labPrimary[0].toFixed(1)} a:${item.labPrimary[1].toFixed(1)} b:${item.labPrimary[2].toFixed(1)}
                        </div>
                        <div class="lab-secondary">
                            🔄 L:${item.labSecondary[0].toFixed(1)} a:${item.labSecondary[1].toFixed(1)} b:${item.labSecondary[2].toFixed(1)}
                        </div>
                    </div>
                `;
            } else if (item.status === 'missing' && item.labSecondary) {
                labDisplay = `
                    <div class="lab-secondary">
                        🔄 L:${item.labSecondary[0].toFixed(1)} a:${item.labSecondary[1].toFixed(1)} b:${item.labSecondary[2].toFixed(1)}
                    </div>
                `;
            }
            
            const diffDetails = item.diffDetails ? 
                `<div class="diff-details">
                    📊 Diferencia: C:${item.diffDetails.cyan} | M:${item.diffDetails.magenta} | Y:${item.diffDetails.yellow} | K:${item.diffDetails.black}
                    <br>📈 Total: ${item.diffDetails.total}%
                </div>` : '';
            
            const message = item.message ? 
                `<div class="error-message">${item.message}</div>` : '';
            
            let actions = '';
            if (item.status === 'diff') {
                actions = `
                    <div class="action-buttons-cell">
                        <button class="small-btn btn-edit" onclick="window.app.handleColorAction('replace', ${JSON.stringify(item).replace(/"/g, '&quot;')})">
                            🔄 Reemplazar con valor secundario
                        </button>
                        <button class="small-btn" onclick="window.app.handleColorAction('keep', ${JSON.stringify(item).replace(/"/g, '&quot;')})">
                            💾 Mantener valor principal
                        </button>
                    </div>
                `;
            } else if (item.status === 'missing') {
                actions = `
                    <div class="action-buttons-cell">
                        <button class="small-btn btn-success" onclick="window.app.handleColorAction('add', ${JSON.stringify(item).replace(/"/g, '&quot;')})">
                            ➕ Agregar a referencia principal
                        </button>
                    </div>
                `;
            }
            
            return `
                <tr class="${diffHighlight}">
                    <td><strong>${item.id}</strong></td>
                    <td>
                        <strong>${item.name}</strong>
                        ${item.originalName && item.originalName !== item.name ? 
                            `<br><small style="color:#888;">Coincide con: ${item.originalName}</small>` : ''}
                    </td>
                    <td>${cmykDisplay}</td>
                    <td>${labDisplay}</td>
                    <td>
                        <span class="${statusClass}">${statusText}</span>
                        ${diffDetails}
                        ${message}
                        ${item.recommendation ? `<div class="recommendation">💡 ${item.recommendation}</div>` : ''}
                    </td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join('');
        
        window.app = app;
    }
    
    renderHistory(history) {
        const container = document.getElementById('historyList');
        
        if (history.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <p>No hay historial de comparaciones</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = history.map(item => `
            <div class="history-item">
                <div style="display: flex; justify-content: space-between;">
                    <strong>${new Date(item.date).toLocaleString()}</strong>
                    <span class="history-date">ID: ${item.id}</span>
                </div>
                <div style="margin-top: 0.5rem; font-size: 0.85rem;">
                    <div>📁 Principal: ${item.primaryFile}</div>
                    <div>🔄 Secundario: ${item.secondaryFile}</div>
                </div>
                <div class="history-stats">
                    <span>✅ Coincidencias: ${item.stats.matches}</span>
                    <span>⚠️ Diferencias: ${item.stats.differences}</span>
                    <span>❌ No encontrados: ${item.stats.missing}</span>
                </div>
            </div>
        `).join('');
    }
    
    initCreatorTable() {
        this.resetCreatorTable();
    }
    
    resetCreatorTable() {
        this.creatorRows = [this.createEmptyRow(1)];
        this.renderCreatorTable();
    }
    
    createEmptyRow(id) {
        return {
            id: id,
            name: '',
            cmyk: { c: 0, m: 0, y: 0, k: 0 },
            lab: { l: 0, a: 0, b: 0 }
        };
    }
    
    addCreatorRow() {
        const newId = this.creatorRows.length + 1;
        this.creatorRows.push(this.createEmptyRow(newId));
        this.renderCreatorTable();
    }
    
    renderCreatorTable() {
        const tbody = document.getElementById('creatorTableBody');
        const downloadBtn = document.getElementById('downloadTxtBtn');
        
        if (this.creatorRows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Agregue colores para comenzar</td></tr>';
            downloadBtn.disabled = true;
            return;
        }
        
        tbody.innerHTML = this.creatorRows.map((row, idx) => `
            <tr>
                <td>${row.id}</td>
                <td><input type="text" value="${row.name.replace(/"/g, '&quot;')}" placeholder="Nombre del color" data-field="name" data-idx="${idx}"></td>
                <td><input type="number" step="0.1" value="${row.cmyk.c}" data-field="cmyk_c" data-idx="${idx}"></td>
                <td><input type="number" step="0.1" value="${row.cmyk.m}" data-field="cmyk_m" data-idx="${idx}"></td>
                <td><input type="number" step="0.1" value="${row.cmyk.y}" data-field="cmyk_y" data-idx="${idx}"></td>
                <td><input type="number" step="0.1" value="${row.cmyk.k}" data-field="cmyk_k" data-idx="${idx}"></td>
                <td><input type="number" step="0.1" value="${row.lab.l}" data-field="lab_l" data-idx="${idx}"></td>
                <td><input type="number" step="0.1" value="${row.lab.a}" data-field="lab_a" data-idx="${idx}"></td>
                <td><input type="number" step="0.1" value="${row.lab.b}" data-field="lab_b" data-idx="${idx}"></td>
                <td><button class="small-btn btn-delete" onclick="window.app.uiRenderer.removeCreatorRow(${idx})">🗑️</button></td>
            </tr>
        `).join('');
        
        downloadBtn.disabled = false;
        this.attachCreatorEvents();
    }
    
    attachCreatorEvents() {
        const inputs = document.querySelectorAll('#creatorTableBody input');
        inputs.forEach(input => {
            input.removeEventListener('input', this.handleCreatorInput);
            input.addEventListener('input', (e) => this.handleCreatorInput(e));
        });
    }
    
    handleCreatorInput(e) {
        const idx = parseInt(e.target.dataset.idx);
        const field = e.target.dataset.field;
        const value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
        
        if (this.creatorRows[idx]) {
            if (field === 'name') {
                this.creatorRows[idx].name = value;
            } else if (field === 'cmyk_c') {
                this.creatorRows[idx].cmyk.c = value;
            } else if (field === 'cmyk_m') {
                this.creatorRows[idx].cmyk.m = value;
            } else if (field === 'cmyk_y') {
                this.creatorRows[idx].cmyk.y = value;
            } else if (field === 'cmyk_k') {
                this.creatorRows[idx].cmyk.k = value;
            } else if (field === 'lab_l') {
                this.creatorRows[idx].lab.l = value;
            } else if (field === 'lab_a') {
                this.creatorRows[idx].lab.a = value;
            } else if (field === 'lab_b') {
                this.creatorRows[idx].lab.b = value;
            }
        }
    }
    
    removeCreatorRow(idx) {
        this.creatorRows.splice(idx, 1);
        this.creatorRows.forEach((row, newIdx) => row.id = newIdx + 1);
        this.renderCreatorTable();
    }
    
    getCreatorData() {
        return this.creatorRows.filter(row => row.name.trim() !== '');
    }
}
