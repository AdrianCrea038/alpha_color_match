export class DataManager {
    constructor() {
        this.storageKey = 'colormatch_history';
    }
    
    saveToHistory(item) {
        const history = this.getHistory();
        history.unshift(item);
        
        // Mantener solo los últimos 50 registros
        if (history.length > 50) history.pop();
        
        localStorage.setItem(this.storageKey, JSON.stringify(history));
    }
    
    getHistory() {
        const stored = localStorage.getItem(this.storageKey);
        return stored ? JSON.parse(stored) : [];
    }
    
    clearHistory() {
        localStorage.removeItem(this.storageKey);
    }
    
    saveReferenceData(data) {
        localStorage.setItem('colormatch_reference', JSON.stringify(data));
    }
    
    getReferenceData() {
        const stored = localStorage.getItem('colormatch_reference');
        return stored ? JSON.parse(stored) : [];
    }
}