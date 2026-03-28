// ============================================================
// CREATOR VIEW - Crear Nuevo Archivo TXT
// Tabla editable con campos para colores
// ============================================================

class CreatorView {
    constructor() {
        this.colors = [];
        this.nextId = 1;
        
        // Tabla de equivalencia para complementarios
        this.equivalencyTable = new Map([
            ["10F TM WHITE", "10A WHITE"],
            ["03S TM BLACK", "00A BLACK"],
            ["01P TM DK STEEL GREY", "01P DK STEEL GREY"],
            ["03T BLUE GREY", "01V WOLF GREY"],
            ["05X TM ANTHRACITE", "06F ANTHRACITE"],
            ["2AQ TM BROWN", "20Q DARK CINDER"],
            ["2DH TM MEDIUM OLIVE", "2DH MEDIUM OLIVE"],
            ["3EM TM KELLY GREEN", "31W CLASSIC GREEN"],
            ["31V TM DARK GREEN", "39Y GORGE GREEN"],
            ["43V TM NAVY", "41S COLLEGE NAVY"],
            ["44A TM TIDAL BLUE", "44A TIDAL BLUE"],
            ["45W TM BLUSTERY", "45W BLUSTERY"],
            ["4ES TM AERO BLUE", "4ES AERO BLUE"],
            ["49V TM ROYAL", "4EV GAME ROYAL"],
            ["4CV TM LIGHT BLUE", "4EY VALOR BLUE"],
            ["52V TM PURPLE", "56N FIELD PURPLE"],
            ["64V TM SCARLET", "65N UNIVERSITY RED"],
            ["67Y TM DARK MAROON", "66P DEEP MAROON"],
            ["6DR TM PINK FIRE II", "66Z PINK FIRE II"],
            ["69W TM CRIMSON", "69W TEAM CRIMSON"],
            ["69Y TM CARDINAL", "69X TEAM MAROON"],
            ["79Y TM BRIGHT GOLD", "79Q SUNDOWN"],
            ["79S TM YELLOW STRIKE", "79S YELLOW STRIKE"],
            ["79X TM VEGAS GOLD", "79W TEAM GOLD"],
            ["81F DESERT ORANGE", "81F DESERT ORANGE"],
            ["87F TM BRIGHT CERAMIC", "87F BRIGHT CERAMIC"],
            ["82U TM ORANGE", "89L TEAM ORANGE"],
            ["06H FLINT GREY", "06H FLINT GREY"],
            ["15A NATURAL", "15A NATURAL"],
            ["3EY PRO GREEN", "3EY PRO GREEN"],
            ["3HN ACTION GREEN", "3HN ACTION GREEN"],
            ["3GU HYPER TURQUOISE", "3GU HYPER TURQUOISE"],
            ["44U SIGNAL BLUE", "44U SIGNAL BLUE"],
            ["4KB DARK TURQUOISE", "4KB DARK TURQUOISE"],
            ["4LB GYM BLUE", "4LB GYM BLUE"],
            ["48Y ITALY BLUE", "48Y ITALY BLUE"],
            ["52M NEW ORCHID", "52M NEW ORCHID"],
            ["71R VOLT", "71R VOLT"],
            ["77C GOLD", "77C GOLD"],
            ["76I UNIVERSITY GOLD", "76I UNIVERSITY GOLD"],
            ["78H AMARILLO", "78H AMARILLO"],
            ["79V CLUB GOLD", "79V CLUB GOLD"],
            ["89M UNIVERSITY ORANGE", "89M UNIVERSITY ORANGE"],
            ["89N BRILLIANT ORANGE", "89N BRILLIANT ORANGE"],
            ["89Q ORANGE HORIZON", "89Q ORANGE HORIZON"]
        ]);
        
        this.init();
    }
    
    init() {
        this.tableBody = document.getElementById('creatorTableBody');
        this.downloadBtn = document.getElementById('downloadTxtBtn');
        this.addBtn = document.getElementById('addColorRowBtn');
        this.resetBtn = document.getElementById('resetCreatorBtn');
        
        if (this.tableBody) {
            this.resetTable();
            this.attachEvents();
        }
    }
    
    attachEvents() {
        if (this.addBtn) {
            this.addBtn.onclick = () => this.addColor();
        }
        
        if (this.resetBtn) {
            this.resetBtn.onclick = () => this.resetTable();
        }
        
        if (this.downloadBtn) {
            this.downloadBtn.onclick = () => this.download();
        }
    }
    
    normalizeName(name) {
        if (!name) return '';
        return name.toUpperCase().replace(/\s+/g, ' ').trim();
    }
    
    getComplementaryName(name) {
        const normalizedName = this.normalizeName(name);
        
        for (let [key, value] of this.equivalencyTable) {
            const normKey = this.normalizeName(key);
            const normValue = this.normalizeName(value);
            
            if (normKey === normalizedName) {
                return value;
            }
            if (normValue === normalizedName) {
                return key;
            }
        }
        return null;
    }
    
    addColor(parentColor = null, isComplementary = false, complementaryName = null) {
        const newId = this.nextId++;
        
        let newColor = {
            id: newId,
            name: '',
            nk: 'NK001',
            cmyk: { c: 0, m: 0, y: 0, k: 0 },
            lab: { l: 100, a: 0, b: 0 },
            isComplementary: isComplementary,
            parentId: parentColor ? parentColor.id : null
        };
        
        if (isComplementary && complementaryName) {
            newColor.name = complementaryName;
            if (parentColor) {
                newColor.nk = parentColor.nk;
                newColor.cmyk = { ...parentColor.cmyk };
                newColor.lab = { ...parentColor.lab };
            }
        }
        
        this.colors.push(newColor);
        this.renderTable();
        
        return newColor;
    }
    
    deleteColor(colorId) {
        this.colors = this.colors.filter(c => c.id !== colorId);
        this.colors = this.colors.filter(c => c.parentId !== colorId);
        this.renderTable();
    }
    
    updateColor(colorId, updates) {
        const color = this.colors.find(c => c.id === colorId);
        if (!color || color.isComplementary) return;
        
        Object.assign(color, updates);
        
        // Actualizar complementarios
        this.colors.forEach(c => {
            if (c.parentId === colorId) {
                c.cmyk = { ...color.cmyk };
                c.lab = { ...color.lab };
                c.nk = color.nk;
            }
        });
        
        this.renderTable();
    }
    
    renderTable() {
        if (!this.tableBody) return;
        
        if (this.colors.length === 0) {
            this.tableBody.innerHTML = '<tr><td colspan="11" class="empty-state">Agregue colores para comenzar</td></tr>';
            if (this.downloadBtn) this.downloadBtn.disabled = true;
            return;
        }
        
        this.tableBody.innerHTML = this.colors.map((color, index) => {
            const isComplementary = color.isComplementary;
            const rowClass = isComplementary ? 'complementary-row' : '';
            const disabledAttr = isComplementary ? 'disabled' : '';
            const lockIcon = isComplementary ? '<i class="fas fa-lock"></i>' : '';
            
            return `
                <tr class="${rowClass}" data-id="${color.id}">
                    <td class="row-number">${index + 1}</td>
                    <td>
                        <input type="text" 
                               class="color-name-input" 
                               value="${this.escapeHtml(color.name)}"
                               ${disabledAttr}
                               data-field="name"
                               data-id="${color.id}">
                        ${isComplementary ? '<span class="complementary-badge">(complementario)</span>' : ''}
                    </td>
                    <td>
                        <input type="text" 
                               class="nk-input" 
                               value="${this.escapeHtml(color.nk)}"
                               ${disabledAttr}
                               data-field="nk"
                               data-id="${color.id}">
                        ${isComplementary ? lockIcon : ''}
                    </td>
                    <td><input type="number" step="0.1" value="${color.cmyk.c}" ${disabledAttr} data-field="cmyk_c" data-id="${color.id}"></td>
                    <td><input type="number" step="0.1" value="${color.cmyk.m}" ${disabledAttr} data-field="cmyk_m" data-id="${color.id}"></td>
                    <td><input type="number" step="0.1" value="${color.cmyk.y}" ${disabledAttr} data-field="cmyk_y" data-id="${color.id}"></td>
                    <td><input type="number" step="0.1" value="${color.cmyk.k}" ${disabledAttr} data-field="cmyk_k" data-id="${color.id}"></td>
                    <td><input type="number" step="0.1" value="${color.lab.l}" ${disabledAttr} data-field="lab_l" data-id="${color.id}"></td>
                    <td><input type="number" step="0.1" value="${color.lab.a}" ${disabledAttr} data-field="lab_a" data-id="${color.id}"></td>
                    <td><input type="number" step="0.1" value="${color.lab.b}" ${disabledAttr} data-field="lab_b" data-id="${color.id}"></td>
                    <td class="actions-cell">
                        ${!isComplementary ? `
                            <button class="small-btn delete-btn" data-id="${color.id}" title="Eliminar color">
                                <i class="fas fa-trash"></i>
                            </button>
                            <button class="small-btn preview-btn" data-id="${color.id}" title="Vista previa">
                                <i class="fas fa-eye"></i>
                            </button>
                        ` : `
                            <button class="small-btn btn-locked" disabled title="Complementario automático">
                                <i class="fas fa-lock"></i>
                            </button>
                        `}
                    </td>
                </tr>
            `;
        }).join('');
        
        const hasValidData = this.colors.some(c => c.name.trim() !== '');
        if (this.downloadBtn) this.downloadBtn.disabled = !hasValidData;
        
        this.attachInputEvents();
        this.attachActionEvents();
    }
    
    attachInputEvents() {
        const inputs = this.tableBody.querySelectorAll('input');
        inputs.forEach(input => {
            input.removeEventListener('change', this.handleInputChange);
            input.addEventListener('change', (e) => this.handleInputChange(e));
        });
    }
    
    handleInputChange(e) {
        const input = e.target;
        const colorId = parseInt(input.dataset.id);
        const field = input.dataset.field;
        let value = input.value;
        
        const color = this.colors.find(c => c.id === colorId);
        if (!color || color.isComplementary) return;
        
        if (field === 'name') {
            const complementaryName = this.getComplementaryName(value);
            const existingComplementary = this.colors.find(c => c.parentId === colorId);
            
            if (complementaryName && !existingComplementary) {
                this.addColor(color, true, complementaryName);
            } else if (!complementaryName && existingComplementary) {
                this.colors = this.colors.filter(c => c.id !== existingComplementary.id);
            }
            
            color.name = value;
        } else if (field === 'nk') {
            color.nk = value;
            this.colors.forEach(c => {
                if (c.parentId === colorId) c.nk = value;
            });
        } else if (field === 'cmyk_c') {
            color.cmyk.c = parseFloat(value) || 0;
            this.updateComplementaryValues(colorId);
        } else if (field === 'cmyk_m') {
            color.cmyk.m = parseFloat(value) || 0;
            this.updateComplementaryValues(colorId);
        } else if (field === 'cmyk_y') {
            color.cmyk.y = parseFloat(value) || 0;
            this.updateComplementaryValues(colorId);
        } else if (field === 'cmyk_k') {
            color.cmyk.k = parseFloat(value) || 0;
            this.updateComplementaryValues(colorId);
        } else if (field === 'lab_l') {
            color.lab.l = parseFloat(value) || 0;
            this.updateComplementaryValues(colorId);
        } else if (field === 'lab_a') {
            color.lab.a = parseFloat(value) || 0;
            this.updateComplementaryValues(colorId);
        } else if (field === 'lab_b') {
            color.lab.b = parseFloat(value) || 0;
            this.updateComplementaryValues(colorId);
        }
        
        this.renderTable();
    }
    
    updateComplementaryValues(parentId) {
        const parent = this.colors.find(c => c.id === parentId);
        if (!parent) return;
        
        this.colors.forEach(c => {
            if (c.parentId === parentId) {
                c.cmyk = { ...parent.cmyk };
                c.lab = { ...parent.lab };
                c.nk = parent.nk;
            }
        });
    }
    
    attachActionEvents() {
        const deleteBtns = this.tableBody.querySelectorAll('.delete-btn');
        deleteBtns.forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const colorId = parseInt(btn.dataset.id);
                this.deleteColor(colorId);
            };
        });
        
        const previewBtns = this.tableBody.querySelectorAll('.preview-btn');
        previewBtns.forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const colorId = parseInt(btn.dataset.id);
                this.showPreview(colorId);
            };
        });
    }
    
    showPreview(colorId) {
        const color = this.colors.find(c => c.id === colorId);
        if (!color) return;
        
        const rgb = this.cmykToRgb(color.cmyk.c, color.cmyk.m, color.cmyk.y, color.cmyk.k);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header" style="background: #2d4ed6;">
                    <h3 style="color: white;">🎨 Vista previa</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body" style="text-align: center;">
                    <div style="width: 150px; height: 150px; background: ${rgb}; border-radius: 12px; margin: 0 auto 1rem; border: 2px solid #4b5563;"></div>
                    <h4>${color.name}</h4>
                    <p style="color: #9ca3af; margin-top: 0.5rem;">${color.nk}</p>
                    <div style="margin-top: 1rem; font-size: 0.8rem; font-family: monospace;">
                        <div>CMYK: ${color.cmyk.c.toFixed(1)} / ${color.cmyk.m.toFixed(1)} / ${color.cmyk.y.toFixed(1)} / ${color.cmyk.k.toFixed(1)}</div>
                        <div>LAB: ${color.lab.l.toFixed(1)} / ${color.lab.a.toFixed(1)} / ${color.lab.b.toFixed(1)}</div>
                    </div>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-primary close-modal">Cerrar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.close-modal').onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }
    
    cmykToRgb(c, m, y, k) {
        const r = 255 * (1 - c / 100) * (1 - k / 100);
        const g = 255 * (1 - m / 100) * (1 - k / 100);
        const b = 255 * (1 - y / 100) * (1 - k / 100);
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }
    
    resetTable() {
        this.colors = [];
        this.nextId = 1;
        this.addColor();
        this.renderTable();
    }
    
    getExportData() {
        const exportItems = [];
        
        for (const color of this.colors) {
            if (!color.isComplementary) {
                exportItems.push({
                    name: `${color.name} ${color.nk}`,
                    cmyk: [color.cmyk.c, color.cmyk.m, color.cmyk.y, color.cmyk.k],
                    lab: [color.lab.l, color.lab.a, color.lab.b]
                });
                
                const complementarios = this.colors.filter(c => c.parentId === color.id);
                for (const comp of complementarios) {
                    exportItems.push({
                        name: `${comp.name} ${comp.nk}`,
                        cmyk: [comp.cmyk.c, comp.cmyk.m, comp.cmyk.y, comp.cmyk.k],
                        lab: [comp.lab.l, comp.lab.a, comp.lab.b]
                    });
                }
            }
        }
        
        return exportItems;
    }
    
    generateCGATSContent(exportItems) {
        const today = new Date();
        const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
        
        let content = 'CGATS.17\n';
        content += 'ORIGINATOR\t"ALPHA COLOR MATCH"\n';
        content += 'FILE_DESCRIPTOR\t""\n';
        content += `CREATED\t"${dateStr}"\n`;
        content += 'NUMBER_OF_FIELDS\t9\n';
        content += 'BEGIN_DATA_FORMAT\n';
        content += 'SAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B\n';
        content += 'END_DATA_FORMAT\n';
        content += `NUMBER_OF_SETS\t${exportItems.length}\n`;
        content += 'BEGIN_DATA\n\n';
        
        exportItems.forEach((item, index) => {
            const counter = index + 1;
            content += `${counter}. "${item.name}" `;
            content += `${item.cmyk[0].toFixed(6)} ${item.cmyk[1].toFixed(6)} ${item.cmyk[2].toFixed(6)} ${item.cmyk[3].toFixed(6)} `;
            content += `${item.lab[0].toFixed(6)} ${item.lab[1].toFixed(6)} ${item.lab[2].toFixed(6)}\n`;
        });
        
        content += '\nEND_DATA\n';
        return content;
    }
    
    download() {
        const exportItems = this.getExportData();
        
        if (exportItems.length === 0) {
            alert('No hay datos para exportar');
            return;
        }
        
        const invalidColors = this.colors.filter(c => !c.name.trim() || !c.nk.trim());
        if (invalidColors.length > 0) {
            alert('⚠️ Todos los colores deben tener nombre y NK antes de exportar');
            return;
        }
        
        const content = this.generateCGATSContent(exportItems);
        const fileName = `color_creator_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        
        alert(`✅ Archivo exportado con ${exportItems.length} registros`);
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.creatorView = new CreatorView();
});