import { FileHandler } from './modules/fileHandler.js';
import { ColorMatcher } from './modules/colorMatcher.js';
import { DataManager } from './modules/dataManager.js';
import { UIRenderer } from './modules/uiRenderer.js';
import { Utils } from './modules/utils.js';

class ColorComparatorApp {
    constructor() {
        this.fileHandler = new FileHandler();
        this.colorMatcher = new ColorMatcher();
        this.dataManager = new DataManager();
        this.uiRenderer = new UIRenderer(this);
        
        this.primaryData = [];
        this.secondaryData = [];
        this.comparisonResults = [];
        this.currentFilter = 'all';
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadHistory();
        this.uiRenderer.initCreatorTable();
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
        
        // Comparación inteligente estilo BUSCARV
        this.comparisonResults = this.colorMatcher.smartCompare(this.primaryData, this.secondaryData);
        
        // Actualizar estadísticas
        const stats = this.colorMatcher.getComparisonStats(this.comparisonResults);
        this.updateStats(stats);
        
        // Guardar en historial
        this.saveToHistory(stats);
        
        // Renderizar resultados
        this.filterResults();
        
        this.uiRenderer.showToast(`🔍 Comparación completada: ${stats.differences} diferencias encontradas`, 'info');
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
        
        // Filtrar por estado
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(item => item.status === this.currentFilter);
        }
        
        // Filtrar por búsqueda
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(item => {
                return item.name.toLowerCase().includes(searchTerm) ||
                       item.id.includes(searchTerm) ||
                       item.cmyk.some(v => v.toString().includes(searchTerm));
            });
        }
        
        this.uiRenderer.renderComparisonTable(filtered, this);
    }
    
    handleColorAction(action, item) {
        switch(action) {
            case 'replace':
                this.replaceColor(item);
                break;
            case 'edit':
                this.editColor(item);
                break;
            case 'delete':
                this.deleteColor(item);
                break;
        }
    }
    
    replaceColor(item) {
        const index = this.primaryData.findIndex(p => p.id === item.id);
        if (index !== -1) {
            this.primaryData[index] = { ...item };
            this.compareFiles();
            this.uiRenderer.showToast(`♻️ Color "${item.name}" actualizado`, 'success');
        }
    }
    
    editColor(item) {
        const newName = prompt('Editar nombre del color:', item.name);
        if (newName && newName.trim()) {
            item.name = newName.trim();
            this.replaceColor(item);
        }
    }
    
    deleteColor(item) {
        if (confirm(`¿Eliminar el color "${item.name}" de la referencia principal?`)) {
            const index = this.primaryData.findIndex(p => p.id === item.id);
            if (index !== -1) {
                this.primaryData.splice(index, 1);
                this.compareFiles();
                this.uiRenderer.showToast(`🗑️ Color "${item.name}" eliminado`, 'success');
            }
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
        a.download = `comparison_${new Date().toISOString().slice(0,19)}.txt`;
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
            results: this.comparisonResults.slice(0, 10) // Guardar solo los primeros 10 para no saturar
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
            
            document.getElementById('primaryFileInput').value = '';
            document.getElementById('secondaryFileInput').value = '';
            document.getElementById('primaryFileInfo').querySelector('.filename').textContent = 'Ningún archivo cargado';
            document.getElementById('secondaryFileInfo').querySelector('.filename').textContent = 'Ningún archivo cargado';
            document.getElementById('primaryCount').textContent = '0';
            document.getElementById('secondaryCount').textContent = '0';
            document.getElementById('searchInput').value = '';
            
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
        a.download = `color_data_${new Date().toISOString().slice(0,19)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.uiRenderer.showToast('✨ Archivo TXT generado exitosamente', 'success');
    }
    
    switchView(view) {
        // Actualizar botones
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === view) btn.classList.add('active');
        });
        
        // Actualizar paneles
        document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
        document.getElementById(`${view}View`).classList.add('active');
        
        // Recargar datos según vista
        if (view === 'history') {
            this.loadHistory();
        } else if (view === 'creator') {
            this.uiRenderer.initCreatorTable();
        }
    }
}

// Inicializar aplicación
const app = new ColorComparatorApp();