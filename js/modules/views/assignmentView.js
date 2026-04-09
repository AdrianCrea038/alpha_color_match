// ============================================================
// ASSIGNMENT VIEW - Asignación de trabajo
// ============================================================

export class AssignmentView {
    constructor(app) {
        this.app = app;
        this.assignments = [];
        
        this.container = null;
        this.txtSelect = null;
        this.plotterSelect = null;
        this.userSelect = null;
        this.commentTextarea = null;
        this.assignBtn = null;
        this.clearBtn = null;
        this.historyList = null;
        
        this.loadFromLocalStorage();
        this.init();
    }
    
    init() {
        this.container = document.getElementById('assignmentView');
        if (!this.container) return;
        
        this.txtSelect = this.container.querySelector('#assignmentTxtSelect');
        this.plotterSelect = this.container.querySelector('#assignmentPlotterSelect');
        this.userSelect = this.container.querySelector('#assignmentUserSelect');
        this.commentTextarea = this.container.querySelector('#assignmentComment');
        this.assignBtn = this.container.querySelector('#assignWorkBtn');
        this.clearBtn = this.container.querySelector('#clearAssignmentBtn');
        this.historyList = this.container.querySelector('#assignmentHistoryList');
        
        if (this.assignBtn) {
            this.assignBtn.onclick = () => this.assignWork();
        }
        
        if (this.clearBtn) {
            this.clearBtn.onclick = () => this.clearForm();
        }
        
        this.updateTxtList();
        this.renderHistory();
        
        console.log('✅ AssignmentView inicializado');
    }
    
    loadFromLocalStorage() {
        const saved = localStorage.getItem('alphaColorMatchAssignments');
        if (saved) {
            try {
                this.assignments = JSON.parse(saved);
                console.log('📂 Asignaciones cargadas:', this.assignments.length);
            } catch(e) {
                console.error(e);
                this.assignments = [];
            }
        }
    }
    
    saveToLocalStorage() {
        localStorage.setItem('alphaColorMatchAssignments', JSON.stringify(this.assignments));
        console.log('💾 Asignaciones guardadas');
    }
    
    updateTxtList() {
        if (!this.txtSelect) return;
        
        const txts = this.app ? this.app.libraryTxts : [];
        
        this.txtSelect.innerHTML = '<option value="">-- Seleccionar archivo --</option>';
        
        if (txts.length === 0) {
            this.txtSelect.innerHTML = '<option value="">-- No hay archivos TXT disponibles --</option>';
            return;
        }
        
        const groupedByPlotter = new Map();
        
        for (const txt of txts) {
            const plotter = txt.plotter;
            if (!groupedByPlotter.has(plotter)) {
                groupedByPlotter.set(plotter, []);
            }
            groupedByPlotter.get(plotter).push(txt);
        }
        
        const sortedPlotters = Array.from(groupedByPlotter.keys()).sort((a, b) => a - b);
        
        for (const plotter of sortedPlotters) {
            const group = groupedByPlotter.get(plotter);
            const optgroup = document.createElement('optgroup');
            optgroup.label = `📁 Plotter ${plotter}`;
            
            for (const txt of group) {
                const option = document.createElement('option');
                option.value = JSON.stringify({ name: txt.name, plotter: txt.plotter, content: txt.content });
                const date = new Date(txt.uploadDate);
                option.textContent = `${txt.name} (${date.toLocaleDateString()})`;
                optgroup.appendChild(option);
            }
            
            this.txtSelect.appendChild(optgroup);
        }
    }
    
    assignWork() {
        if (!this.txtSelect || !this.plotterSelect || !this.userSelect) return;
        
        const txtValue = this.txtSelect.value;
        const plotter = this.plotterSelect.value;
        const user = this.userSelect.value;
        const comment = this.commentTextarea ? this.commentTextarea.value.trim() : '';
        
        if (!txtValue) {
            alert('⚠️ Debe seleccionar un archivo TXT.');
            return;
        }
        
        if (!plotter) {
            alert('⚠️ Debe seleccionar un plotter.');
            return;
        }
        
        if (!user) {
            alert('⚠️ Debe seleccionar un usuario.');
            return;
        }
        
        let txtData;
        try {
            txtData = JSON.parse(txtValue);
        } catch(e) {
            alert('❌ Error al procesar el archivo seleccionado.');
            return;
        }
        
        const newAssignment = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            fileName: txtData.name,
            plotter: parseInt(plotter),
            user: user,
            comment: comment,
            content: txtData.content
        };
        
        this.assignments.unshift(newAssignment);
        
        if (this.assignments.length > 50) {
            this.assignments = this.assignments.slice(0, 50);
        }
        
        this.saveToLocalStorage();
        this.renderHistory();
        this.clearForm();
        
        if (this.app && this.app.addToInbox) {
            this.app.addToInbox(
                txtData.name,
                txtData.content,
                `Asignado a ${user} para plotter ${plotter}. ${comment ? 'Motivo: ' + comment : ''}`,
                plotter,
                0
            );
        }
        
        alert(`✅ Trabajo asignado correctamente:\n📁 Archivo: ${txtData.name}\n🖨️ Plotter: ${plotter}\n👤 Usuario: ${user}`);
    }
    
    clearForm() {
        if (this.txtSelect) this.txtSelect.value = '';
        if (this.plotterSelect) this.plotterSelect.value = '';
        if (this.userSelect) this.userSelect.value = '';
        if (this.commentTextarea) this.commentTextarea.value = '';
    }
    
    renderHistory() {
        if (!this.historyList) return;
        
        if (this.assignments.length === 0) {
            this.historyList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <p>No hay asignaciones registradas</p>
                </div>
            `;
            return;
        }
        
        this.historyList.innerHTML = this.assignments.map(assignment => {
            const date = new Date(assignment.timestamp);
            const dateStr = date.toLocaleString();
            
            let userName = assignment.user;
            switch(assignment.user) {
                case 'usuario_admin': userName = '👤 Usuario Admin'; break;
                case 'produccion_1': userName = '🏭 Producción 1'; break;
                case 'produccion_2': userName = '🏭 Producción 2'; break;
                case 'calidad': userName = '✅ Calidad'; break;
                case 'desarrollo': userName = '🎨 Desarrollo'; break;
                case 'supervisor': userName = '👔 Supervisor'; break;
                default: userName = assignment.user;
            }
            
            return `
                <div class="assignment-item">
                    <div class="assignment-item-header">
                        <span class="assignment-date">📅 ${dateStr}</span>
                        <div>
                            <span class="assignment-badge plotter">🖨️ Plotter ${assignment.plotter}</span>
                            <span class="assignment-badge user">👤 ${userName}</span>
                        </div>
                    </div>
                    <div class="assignment-details">
                        <p><i class="fas fa-file-alt"></i> <span class="assignment-filename">${this.escapeHtml(assignment.fileName)}</span></p>
                        ${assignment.comment ? `<div class="assignment-comment"><i class="fas fa-comment"></i> ${this.escapeHtml(assignment.comment)}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}