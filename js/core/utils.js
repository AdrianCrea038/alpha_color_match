// js/core/utils.js
export function normalizeSpaces(str) {
    if (!str) return '';
    return str.trim().replace(/\s+/g, ' ');
}

export function extractNK(fullName) {
    if (!fullName) return null;
    const normalized = normalizeSpaces(fullName);
    
    // 1. Prioridad: Buscar si existe algún NK de la base de datos (con sus errores pegados)
    const masterNks = (window.ALL_MASTER_NKS || []);
    const sortedMaster = [...masterNks].sort((a, b) => b.length - a.length);

    for (const master of sortedMaster) {
        const escaped = master.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Buscamos el NK rodeado de lo que sea, capturando paréntesis
        const pattern = new RegExp(`(${escaped}(?:\\s*\\([^)]*\\))*)`, 'i');
        const m = normalized.match(pattern);
        if (m) return m[1].trim();
    }

    // 2. Fallback Agresivo: Si no hay match en DB, buscar cualquier palabra que tenga números
    // Empezamos desde el final que es lo más común
    const words = normalized.split(/\s+/);
    for (let i = words.length - 1; i >= 0; i--) {
        const word = words[i];
        const wordUpper = word.toUpperCase();
        // Si empieza por NK o tiene números y al menos 3 caracteres, es nuestro NK
        if (wordUpper.startsWith('NK') || (/[0-9]/.test(word) && word.length >= 2)) {
            return word;
        }
    }
    
    return null;
}

export function extractBaseName(fullName) {
    if (!fullName) return '';
    const normalized = normalizeSpaces(fullName);
    
    // 1. Intentar encontrar el nombre oficial más largo primero
    const validNames = window.ALL_VALID_COLOR_NAMES || [];
    const sortedNames = [...validNames].sort((a, b) => b.length - a.length);
    
    for (const officialName of sortedNames) {
        if (normalized.toUpperCase().startsWith(officialName.toUpperCase())) {
            const remaining = normalized.substring(officialName.length).trim();
            if (!remaining) return officialName;
            const onlyParens = /^(\s*\([^)]*\))+$/.test(remaining);
            if (onlyParens) return officialName;
        }
    }

    // 2. Fallback: Simplemente quitar el NK encontrado de la cadena original
    const nk = extractNK(normalized);
    if (!nk) return normalized;
    
    const escapedNk = nk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?:^|\\s)${escapedNk}(?:\\s|$)`, 'gi');
    
    let base = normalized.replace(pattern, ' ').trim();
    return normalizeSpaces(base);
}

export function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function showNotification(title, message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'floating-notification';
    notification.innerHTML = `<div class="notification-content ${type}"><strong>${title}</strong><br><span>${message}</span></div>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2500);
}

export function validateAndFixCmykValue(value) {
    const str = String(value).trim();
    if (str === '') return 0;
    let fixed = str.replace(/\.+/g, '.');
    const parts = fixed.split('.');
    let integerPart = parts[0];
    let decimalPart = parts[1] || '';
    let intNum = parseInt(integerPart, 10);
    if (isNaN(intNum)) intNum = 0;
    if (intNum > 100) intNum = 100;
    if (intNum < 0) intNum = 0;
    if (decimalPart.length > 6) {
        decimalPart = decimalPart.substring(0, 6);
    } else if (decimalPart.length < 6) {
        decimalPart = decimalPart.padEnd(6, '0');
    }
    return parseFloat(`${intNum}.${decimalPart}`);
}