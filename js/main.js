import { FileHandler } from './modules/fileHandler.js';
import { ColorMatcher } from './modules/colorMatcher.js';
import { DataManager } from './modules/dataManager.js';
import { UIRenderer } from './modules/uiRenderer.js';

class AlphaColorMatch {
    constructor() {
        this.fileHandler = new FileHandler();
        this.colorMatcher = new ColorMatcher();
        this.dataManager = new DataManager();
        this.uiRenderer = new UIRenderer(this);
        
        this.primaryData = [];
        this.secondaryData = [];
        this.comparisonResults = [];
        this.currentFilter = 'all';
        this.actionHistory = []; // Historial de acciones para deshacer
        this.actionCounter = 0;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadHistory();
        this.uiRenderer.initCreatorTable();
        
        // Exponer métodos al window para los botones
        window.app = this;
        window.app.showReplaceConfirm = (colorId) => this.showReplaceConfirm(colorId);
        window.app.showKeepConfirm = (colorId) => this.showKeepConfirm(colorId);
        window.app.showAddConfirm = (colorId) => this.showAddConfirm(colorId);
        window.app.showUndoDialog = (colorId, actionType) => this.showUndoDialog(colorId, actionType);
        window.app.undoLastAction = (actionId) => this.undoLastAction(actionId);
    }
    
    bindEvents() {
        // Navegación
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(btn.dataset.view));
        });
        
        // Upload de archivos
        document.getElementById('primaryFileInput').addEventListener('change', (e) => this.loadPrimaryFile(e.target.files[0]));
        document.getElementById('secondaryFileInput').addEventListener('change', (e) => this.loadSecondaryFile(e.target.files[0]));
        
        // Botones principales
        document.getElementById('compareBtn').addEventListener('click', () => this.compareFiles());
        document.getElementById('exportResultsBtn').addEventListener('click', () => this.exportResults());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAll());
        document.getElementById('clearHistoryBtn')?.addEventListener('click', () => this.clearHistory());
        document.getElementById('downloadTxtBtn')?.addEventListener('click', () => this.downloadCreatorFile());
        document.getElementById('addColorRowBtn')?.addEventListener('click', () => this.uiRenderer.addCreatorRow());
        document.getElementById('resetCreatorBtn')?.addEventListener('click', () => this.uiRenderer.resetCreatorTable());
        
        // Búsqueda y filtros
        document.getElementById('searchInput').addEventListener('input', (e) => this.filterResults());
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.currentFilter = tab.dataset.filter;
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.filterResults();
            });
        });
    }
    
    async loadPrimaryFile(file) {
        if (!file) return;
        const data = await this.fileHandler.parseTxtFile(file);
        this.primaryData = data;
        this.updateFileInfo('primary', file.name, data.length);
        this.uiRenderer.showToast(`✅ Archivo principal cargado: ${data.length} colores`, 'success');
    }
    
    async loadSecondaryFile(file) {
        if (!file) return;
        const data = await this.fileHandler.parseTxtFile(file);
        this.secondaryData = data;
        this.updateFileInfo('secondary', file.name, data.length);
        this.uiRenderer.showToast(`✅ Archivo secundario cargado: ${data.length} colores`, 'success');
    }
    
    updateFileInfo(type, filename, count) {
        const infoDiv = document.getElementById(`${type}FileInfo`);
        if (infoDiv) {
            infoDiv.querySelector('.filename').textContent = filename;
            infoDiv.querySelector('.record-count').textContent = `${count} registro${count !== 1 ? 's' : ''}`;
        }
        
        if (type === 'primary') {
            document.getElementById('primaryCount').textContent = count;
        } else {
            document.getElementById('secondaryCount').textContent = count;
        }
    }
    
    compareFiles() {
        if (this.primaryData.length === 0) {
            this.uiRenderer.showToast('⚠️ Por favor, cargue el archivo principal primero', 'warning');
            return;
        }
        
        if (this.secondaryData.length === 0) {
            this.uiRenderer.showToast('⚠️ Por favor, cargue el archivo secundario para comparar', 'warning');
            return;
        }
        
        // Limpiar acciones previas al hacer nueva comparación
        this.actionHistory = [];
        this.actionCounter = 0;
        
        // Comparación inteligente - SOLO CMYK
        this.comparisonResults = this.colorMatcher.smartCompare(this.primaryData, this.secondaryData);
        
        // Actualizar estadísticas
        const stats = this.colorMatcher.getComparisonStats(this.comparisonResults);
        this.updateStats(stats);
        
        // Guardar en historial
        this.saveToHistory(stats);
        
        // Renderizar resultados
        this.filterResults();
        
        this.uiRenderer.showToast(`🔍 Comparación completada: ${stats.differences} diferencias encontradas, ${stats.missing} colores no encontrados`, 'info');
    }
    
    updateStats(stats) {
        document.getElementById('totalCount').textContent = stats.total;
        document.getElementById('matchCount').textContent = stats.matches;
        document.getElementById('diffCountDisplay').textContent = stats.differences;
        document.getElementById('missingCount').textContent = stats.missing;
        document.getElementById('diffCount').textContent = stats.differences;
    }
    
    filterResults() {
        let filtered = [...this.comparisonResults];
        
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(item => item.status === this.currentFilter);
        }
        
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(item => {
                return item.name.toLowerCase().includes(searchTerm) ||
                       item.id.includes(searchTerm) ||
                       (item.cmykPrimary && item.cmykPrimary.some(v => v.toString().includes(searchTerm))) ||
                       (item.cmykSecondary && item.cmykSecondary.some(v => v.toString().includes(searchTerm)));
            });
        }
        
        this.uiRenderer.renderComparisonTable(filtered, this);
    }
    
    // Mostrar confirmación para reemplazar
    showReplaceConfirm(colorId) {
        const color = this.comparisonResults.find(c => c.id === colorId);
        if (!color) return;
        
        this.uiRenderer.showReplaceConfirm(colorId, (reason) => {
            this.replaceColor(color, reason);
        });
    }
    
    // Mostrar confirmación para mantener
    showKeepConfirm(colorId) {
        const color = this.comparisonResults.find(c => c.id === colorId);
        if (!color) return;
        
        this.uiRenderer.showKeepConfirm(colorId, (reason) => {
            this.keepColor(color, reason);
        });
    }
    
    // Mostrar confirmación para agregar
    showAddConfirm(colorId) {
        const color = this.comparisonResults.find(c => c.id === colorId);
        if (!color) return;
        
        this.uiRenderer.showAddConfirm(colorId, color.name, (reason) => {
            this.addMissingColor(color, reason);
        });
    }
    
    // Mostrar diálogo para deshacer
    showUndoDialog(colorId, actionType) {
        this.uiRenderer.showUndoModal(colorId, actionType, (reason) => {
            this.undoAction(colorId, actionType, reason);
        });
    }
    
    // Reemplazar color
    replaceColor(item, reason = '') {
        const index = this.primaryData.findIndex(p => 
            p.id === item.id || 
            this.colorMatcher.normalizeName(p.name) === this.colorMatcher.normalizeName(item.name)
        );
        
        if (index !== -1) {
            // Guardar estado anterior para poder deshacer
            const previousState = {
                id: item.id,
                name: item.name,
                cmyk: [...this.primaryData[index].cmyk],
                lab: [...this.primaryData[index].lab]
            };
            
            // Guardar en historial de acciones
            const actionId = `action_${this.actionCounter++}`;
            this.actionHistory.push({
                id: actionId,
                type: 'replace',
                colorId: item.id,
                colorName: item.name,
                timestamp: new Date().toISOString(),
                previousState: previousState,
                reason: reason
            });
            
            // Actualizar datos
            this.primaryData[index] = {
                id: item.id,
                name: item.name,
                cmyk: [...item.cmykSecondary],
                lab: item.labSecondary ? [...item.labSecondary] : (item.labPrimary || [0, 0, 0])
            };
            
            // Marcar en resultados que se tomó acción
            const resultItem = this.comparisonResults.find(r => r.id === item.id);
            if (resultItem) {
                resultItem.actionTaken = 'replace';
            }
            
            this.compareFiles();
            
            // Guardar en historial de acciones del usuario
            this.saveActionToHistory('replace', item.id, item.name, reason);
            
            this.uiRenderer.showToast(`🔄 Color "${item.name}" reemplazado con valores del secundario. ID acción: ${actionId}`, 'success');
        }
    }
    
    // Mantener color actual (sin cambios)
    keepColor(item, reason = '') {
        // Guardar en historial de acciones
        const actionId = `action_${this.actionCounter++}`;
        this.actionHistory.push({
            id: actionId,
            type: 'keep',
            colorId: item.id,
            colorName: item.name,
            timestamp: new Date().toISOString(),
            previousState: null,
            reason: reason
        });
        
        // Marcar en resultados que se tomó acción
        const resultItem = this.comparisonResults.find(r => r.id === item.id);
        if (resultItem) {
            resultItem.actionTaken = 'keep';
        }
        
        this.filterResults(); // Solo refrescar la vista
        
        // Guardar en historial de acciones del usuario
        this.saveActionToHistory('keep', item.id, item.name, reason);
        
        this.uiRenderer.showToast(`💾 Valor principal mantenido para "${item.name}". Puedes deshacer si fue un error.`, 'undo');
    }
    
    // Agregar color faltante
    addMissingColor(item, reason = '') {
        const newColor = {
            id: item.id,
            name: item.name,
            cmyk: [...item.cmykSecondary],
            lab: item.labSecondary ? [...item.labSecondary] : [0, 0, 0]
        };
        
        // Guardar acción para deshacer
        const actionId = `action_${this.actionCounter++}`;
        this.actionHistory.push({
            id: actionId,
            type: 'add',
            colorId: item.id,
            colorName: item.name,
            timestamp: new Date().toISOString(),
            previousState: null,
            newColor: {...newColor},
            reason: reason
        });
        
        this.primaryData.push(newColor);
        
        // Marcar en resultados
        const resultItem = this.comparisonResults.find(r => r.id === item.id);
        if (resultItem) {
            resultItem.actionTaken = 'add';
        }
        
        this.compareFiles();
        
        // Guardar en historial
        this.saveActionToHistory('add', item.id, item.name, reason);
        
        this.uiRenderer.showToast(`✅ Color "${item.name}" agregado a la referencia principal. ID acción: ${actionId}`, 'success');
    }
    
    // Deshacer acción
    undoAction(colorId, actionType, reason = '') {
        const action = this.actionHistory.find(a => a.colorId === colorId && a.type === actionType);
        
        if (!action) {
            this.uiRenderer.showToast('❌ No se pudo deshacer la acción', 'error');
            return;
        }
        
        if (action.type === 'replace' && action.previousState) {
            // Restaurar estado anterior
            const index = this.primaryData.findIndex(p => p.id === colorId);
            if (index !== -1) {
                this.primaryData[index] = {
                    id: action.previousState.id,
                    name: action.previousState.name,
                    cmyk: [...action.previousState.cmyk],
                    lab: [...action.previousState.lab]
                };
            }
        } else if (action.type === 'keep') {
            // Para keep, no hay cambios que revertir en datos, solo en UI
            // Eliminar la marca de acción
            const resultItem = this.comparisonResults.find(r => r.id === colorId);
            if (resultItem) {
                delete resultItem.actionTaken;
            }
        } else if (action.type === 'add') {
            // Eliminar el color agregado
            const index = this.primaryData.findIndex(p => p.id === colorId);
            if (index !== -1) {
                this.primaryData.splice(index, 1);
            }
            const resultItem = this.comparisonResults.find(r => r.id === colorId);
            if (resultItem) {
                delete resultItem.actionTaken;
            }
        }
        
        // Eliminar acción del historial
        const actionIndex = this.actionHistory.findIndex(a => a.id === action.id);
        if (actionIndex !== -1) {
            this.actionHistory.splice(actionIndex, 1);
        }
        
        // Guardar en historial de deshacer
        this.saveActionToHistory('undo', colorId, action.colorName, `Se deshizo acción de ${actionType}. Motivo: ${reason}`);
        
        // Actualizar vista
        this.compareFiles();
        
        this.uiRenderer.showToast(`↩️ Se ha deshecho la acción de ${actionType === 'keep' ? 'mantener' : actionType === 'replace' ? 'reemplazar' : 'agregar'} para "${action.colorName}"`, 'success');
    }
    
    // Guardar acción en el historial persistente
    saveActionToHistory(actionType, colorId, colorName, reason) {
        const history = this.dataManager.getHistory();
        if (history.length > 0) {
            const lastHistory = history[0];
            if (!lastHistory.actionsLog) {
                lastHistory.actionsLog = [];
            }
            lastHistory.actionsLog.push({
                type: actionType,
                colorId: colorId,
                colorName: colorName,
                reason: reason,
                timestamp: new Date().toISOString()
            });
            this.dataManager.saveToHistory(lastHistory);
        }
    }
    
    exportResults() {
        if (this.comparisonResults.length === 0) {
            this.uiRenderer.showToast('No hay resultados para exportar', 'warning');
            return;
        }
        
        const content = this.fileHandler.generateExportContent(this.comparisonResults);
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alpha_comparison_${new Date().toISOString().slice(0,19)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.uiRenderer.showToast('📥 Resultados exportados exitosamente', 'success');
    }
    
    saveToHistory(stats) {
        const historyItem = {
            id: Date.now(),
            date: new Date().toISOString(),
            primaryFile: document.getElementById('primaryFileInfo').querySelector('.filename').textContent,
            secondaryFile: document.getElementById('secondaryFileInfo').querySelector('.filename').textContent,
            stats: { ...stats },
            actionsLog: [],
            results: this.comparisonResults.slice(0, 10)
        };
        
        this.dataManager.saveToHistory(historyItem);
        this.loadHistory();
    }
    
    loadHistory() {
        const history = this.dataManager.getHistory();
        this.uiRenderer.renderHistory(history);
    }
    
    clearHistory() {
        if (confirm('¿Eliminar todo el historial de comparaciones?')) {
            this.dataManager.clearHistory();
            this.loadHistory();
            this.uiRenderer.showToast('Historial limpiado', 'success');
        }
    }
    
    clearAll() {
        if (confirm('¿Limpiar todos los datos cargados?')) {
            this.primaryData = [];
            this.secondaryData = [];
            this.comparisonResults = [];
            this.currentFilter = 'all';
            this.actionHistory = [];
            
            document.getElementById('primaryFileInput').value = '';
            document.getElementById('secondaryFileInput').value = '';
            document.getElementById('primaryFileInfo').querySelector('.filename').textContent = 'Ningún archivo cargado';
            document.getElementById('secondaryFileInfo').querySelector('.filename').textContent = 'Ningún archivo cargado';
            document.getElementById('primaryCount').textContent = '0';
            document.getElementById('secondaryCount').textContent = '0';
            document.getElementById('searchInput').value = '';
            
            document.querySelectorAll('.filter-tab').forEach(tab => {
                if (tab.dataset.filter === 'all') {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });
            this.currentFilter = 'all';
            
            this.filterResults();
            this.uiRenderer.showToast('Todos los datos han sido limpiados', 'info');
        }
    }
    
    downloadCreatorFile() {
        const creatorData = this.uiRenderer.getCreatorData();
        if (creatorData.length === 0) {
            this.uiRenderer.showToast('No hay datos para exportar', 'warning');
            return;
        }
        
        const content = this.fileHandler.generateTxtFromData(creatorData);
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alpha_color_data_${new Date().toISOString().slice(0,19)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.uiRenderer.showToast('✨ Archivo TXT generado exitosamente', 'success');
    }
    
    switchView(view) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === view) btn.classList.add('active');
        });
        
        document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
        document.getElementById(`${view}View`).classList.add('active');
        
        if (view === 'history') {
            this.loadHistory();
        } else if (view === 'creator') {
            this.uiRenderer.initCreatorTable();
        }
    }
}

// Inicializar aplicación
const app = new AlphaColorMatch();
window.app = app;
