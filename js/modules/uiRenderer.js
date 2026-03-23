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
            const statusText = item.status === 'match' ? '✅ Coincidencia exacta' :
                              (item.status === 'diff' ? '⚠️ Valores diferentes' : '❌ No encontrado');
            
            const diffHighlight = item.status === 'diff' ? 'diff-highlight' : '';
            const diffDetails = item.diffDetails ? 
                `<div class="diff-details">Δ C:${item.diffDetails.c} M:${item.diffDetails.m} Y:${item.diffDetails.y} K:${item.diffDetails.k}</div>` : '';
            
            let actions = '';
            if (item.status === 'diff') {
                actions = `
                    <div class="action-buttons-cell">
                        <button class="small-btn btn-edit" onclick="window.app.handleColorAction('replace', ${JSON.stringify(item).replace(/"/g, '&quot;')})">Reemplazar</button>
                        <button class="small-btn" onclick="window.app.handleColorAction('edit', ${JSON.stringify(item).replace(/"/g, '&quot;')})">Editar</button>
                    </div>
                `;
            } else if (item.status === 'missing') {
                actions = `
                    <div class="action-buttons-cell">
                        <button class="small-btn btn-success" onclick="window.app.handleColorAction('add', ${JSON.stringify(item).replace(/"/g, '&quot;')})">Agregar</button>
                    </div>
                `;
            } else {
                actions = `
                    <div class="action-buttons-cell">
                        <button class="small-btn btn-delete" onclick="window.app.handleColorAction('delete', ${JSON.stringify(item).replace(/"/g, '&quot;')})">Eliminar</button>
                    </div>
                `;
            }
            
            return `
                <tr class="${diffHighlight}">
                    <td>${item.id}</td>
                    <td><strong>${item.name}</strong>${item.suggestedMatch ? `<br><small style="color:#888;">Sugerido: ${item.suggestedMatch}</small>` : ''}</td>
                    <td>C:${item.cmyk[0].toFixed(1)} M:${item.cmyk[1].toFixed(1)} Y:${item.cmyk[2].toFixed(1)} K:${item.cmyk[3].toFixed(1)}</td>
                    <td>L:${item.lab[0].toFixed(1)} a:${item.lab[1].toFixed(1)} b:${item.lab[2].toFixed(1)}</td>
                    <td>
                        <span class="${statusClass}">${statusText}</span>
                        ${diffDetails}
                    </td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join('');
        
        // Exponer app globalmente para los botones
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
                <td><button class="small-btn btn-delete" onclick="this.closest('tr').remove(); window.app.uiRenderer.removeCreatorRow(${idx})">🗑️</button></td>
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