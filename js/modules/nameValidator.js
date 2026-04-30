import { normalizeSpaces, escapeHtml } from '../core/utils.js';
import { addCustomValidColorName, getCustomValidColorNames, getAllMasterNks, addMasterNk, getEquivalencyGroupsFromDB, supabase } from '../core/supabaseClient.js';
import { updateConstantsFromDB, getAllEquivalentNames, getGroupIdForColor } from '../core/constants.js';

// Hacer las funciones disponibles globalmente para otros módulos
window.getAllEquivalentNames = getAllEquivalentNames;
window.getGroupIdForColor = getGroupIdForColor;

let appInstance = null;
let validColorNamesLoaded = false;
let masterNksSet = new Set();

export function setAppInstance(app) {
    appInstance = app;
}

export function getValidNamesSet() {
    const names = window.ALL_VALID_COLOR_NAMES || [];
    return new Set(names.map(name => normalizeSpaces(name).toUpperCase()));
}

export function addNameToLocalCatalog(name) {
    const normalized = normalizeSpaces(name || '').toUpperCase();
    if (!window.ALL_VALID_COLOR_NAMES) window.ALL_VALID_COLOR_NAMES = [];
    if (!window.ALL_VALID_COLOR_NAMES.includes(normalized)) {
        window.ALL_VALID_COLOR_NAMES.push(normalized);
        window.ALL_VALID_COLOR_NAMES.sort();
    }
}

export async function ensureValidColorCatalogLoaded() {
    if (validColorNamesLoaded) return;
    const customNames = await getCustomValidColorNames();
    for (const name of customNames) addNameToLocalCatalog(name);
    const dbGroups = await getEquivalencyGroupsFromDB();
    if (dbGroups && dbGroups.length > 0) {
        updateConstantsFromDB(dbGroups);
        for (const group of dbGroups) {
            for (let i = 1; i < group.length; i++) {
                const colorName = group[i];
                if (colorName) addNameToLocalCatalog(colorName);
            }
        }
    }
    const masterNks = await getAllMasterNks();
    masterNksSet = new Set(masterNks.map(nk => nk.toUpperCase()));
    validColorNamesLoaded = true;
}

export function isValidColorName(baseName, fullName = '', ignoreCatalog = false) {
    if (!baseName) return false;
    if (ignoreCatalog) return true;
    
    // Si no se han cargado nombres válidos, no podemos validar positivamente
    if (!validColorNamesLoaded) {
        console.warn('⚠️ Catálogo de colores no cargado para validación.');
        return false; 
    }
    
    const validSet = getValidNamesSet();
    const normalized = normalizeSpaces(baseName).toUpperCase();
    
    // Si el set está vacío, es un error crítico de carga de datos
    if (validSet.size === 0) {
        console.error('❌ Catálogo de colores vacío. Bloqueando por seguridad.');
        return false;
    }
    
    return validSet.has(normalized);
}

export async function ensureValidNksLoaded() {
    const masterNks = await getAllMasterNks();
    masterNksSet = new Set(masterNks.map(nk => nk.toUpperCase()));
    return masterNksSet;
}

export function isValidNK(nk) {
    if (!nk) return false;
    const cleanNk = nk.trim().toUpperCase();
    return masterNksSet.has(cleanNk);
}

export async function addValidColorName(name) {
    const user = appInstance?.auth?.getCurrentUser()?.username || 'sistema';
    const result = await addCustomValidColorName(name, user);
    if (result.success) addNameToLocalCatalog(name);
    return result;
}

export async function addMasterNK(nkCode) {
    const user = appInstance?.auth?.getCurrentUser()?.username || 'sistema';
    const result = await addMasterNk(nkCode, user);
    if (result.success) masterNksSet.add(nkCode.trim().toUpperCase());
    return result;
}

export async function validateAndCorrectRecords(records, type = 'secondary', options = {}) {
    console.log(`%c🛡️ Auditoría Secuencial Iniciada (${type})...`, 'color: #ef4444; font-weight: bold;');
    
    await ensureValidColorCatalogLoaded();
    const masterNks = await getAllMasterNks();
    masterNksSet = new Set(masterNks.map(nk => nk.toUpperCase()));
    
    const dbRows = await getEquivalencyGroupsFromDB();
    window.ALL_VALID_COLOR_NAMES = [];
    dbRows.forEach(row => {
        if (Array.isArray(row)) {
            for (let i = 1; i < row.length; i++) {
                const name = row[i]?.toString().trim().toUpperCase();
                if (name && !window.ALL_VALID_COLOR_NAMES.includes(name)) {
                    window.ALL_VALID_COLOR_NAMES.push(name);
                }
            }
        }
    });
    validColorNamesLoaded = window.ALL_VALID_COLOR_NAMES.length > 0;

    const allAuditRecords = [];
    const seenRecords = new Map();

    for (const record of records) {
        let originalRawName = (record.name || '').trim().toUpperCase();
        let cleanNk = (record.nk || '').trim().toUpperCase();
        
        // Extracción de NK si no existe
        if (!cleanNk) {
            const nkMatch = originalRawName.match(/NK[A-Z0-9\-]+/i);
            if (nkMatch) cleanNk = nkMatch[0].toUpperCase();
        }

        let rawName = originalRawName;
        if (cleanNk) rawName = rawName.replace(cleanNk, '').trim();
        const cleanBase = rawName.replace(/\s*\([^)]*\)/g, '').trim();
        
        const isNameValid = isValidColorName(cleanBase);
        const isNkValid = isValidNK(cleanNk);
        const hasParentheses = /\(|\)/.test(originalRawName);
        
        const signature = `${cleanBase}|${cleanNk}`;
        const isDuplicate = seenRecords.has(signature);
        seenRecords.set(signature, true);

        const hasAnyError = !isNameValid || !isNkValid || hasParentheses || isDuplicate;
        
        if (hasAnyError) {
            allAuditRecords.push({ 
                ...record, 
                baseName: cleanBase, 
                nk: cleanNk,
                isDuplicate,
                nameError: !isNameValid,
                nkError: !isNkValid,
                hasParentheses
            });
        }
    }
    
    if (allAuditRecords.length === 0) {
        console.log('✅ Archivo impecable. Cargando...');
        return { records: records, correctionsApplied: 0 };
    }

    // PASO 1: CORREGIR NOMBRES
    const nameAudit = allAuditRecords.filter(r => r.nameError || r.hasParentheses);
    let currentRecords = allAuditRecords;

    if (nameAudit.length > 0) {
        const correctedNames = await new Promise(resolve => createCorrectionModal(nameAudit, 'names', resolve));
        if (!correctedNames) return { records: [], cancelled: true };
        currentRecords = allAuditRecords.map(orig => {
            const corr = correctedNames.find(c => c.id === orig.id);
            return corr ? { ...orig, ...corr, nameError: false, hasParentheses: false } : orig;
        });
    }

    // PASO 2: CORREGIR NKs
    const nkAudit = currentRecords.filter(r => r.nkError);
    if (nkAudit.length > 0) {
        const correctedNks = await new Promise(resolve => createCorrectionModal(nkAudit, 'nks', resolve));
        if (!correctedNks) return { records: [], cancelled: true };
        currentRecords = currentRecords.map(orig => {
            const corr = correctedNks.find(c => c.id === orig.id);
            return corr ? { ...orig, ...corr, nkError: false } : orig;
        });
    }

    const finalRecords = records.map(original => {
        const corrected = currentRecords.find(c => c.id === original.id);
        if (corrected) {
            return {
                ...original,
                name: `${corrected.baseName} ${corrected.nk}`.trim(),
                baseName: corrected.baseName,
                nk: corrected.nk
            };
        }
        return original;
    });

    return { records: finalRecords, correctionsApplied: currentRecords.length };
}

function createCorrectionModal(auditRecords, stepType, onComplete) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.style.zIndex = '10001';
    
    const isNameStep = stepType === 'names';
    const title = isNameStep ? 'PASO 1: VALIDAR NOMBRES DE COLOR' : 'PASO 2: VALIDAR CÓDIGOS NK';
    const subtitle = isNameStep ? 'Escribe el nombre y elige la sugerencia del catálogo.' : 'Escribe y selecciona el código NK oficial.';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px; width: 95%; background: #0f172a; border: 2px solid #334155; border-radius: 12px;">
            <div class="modal-header" style="background: #1e1e2e; border-bottom: 3px solid ${isNameStep ? '#f59e0b' : '#3b82f6'}; padding: 1.5rem 2rem; border-radius: 12px 12px 0 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div>
                        <h3 style="color: white; margin: 0; font-size: 1.5rem;"><i class="fas fa-${isNameStep ? 'palette' : 'barcode'}" style="color: ${isNameStep ? '#f59e0b' : '#3b82f6'};"></i> ${title}</h3>
                        <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 0.9rem;">${subtitle}</p>
                    </div>
                </div>
            </div>
            <div class="modal-body" style="padding: 2rem; overflow-y: auto; max-height: 60vh; background: #0b0f1a;">
                <table class="results-table" style="width: 100%; border-spacing: 0 10px; border-collapse: separate;">
                    <thead>
                        <tr style="color: #475569; font-size: 0.75rem; text-transform: uppercase; font-weight: 900;">
                            <th style="padding: 0 15px; width: 60px;">ID</th>
                            <th style="padding: 0 15px;">Dato Original</th>
                            <th style="padding: 0 15px;">${isNameStep ? 'Nombre del Color' : 'Código NK'}</th>
                            <th style="padding: 0 15px; text-align: center; width: 150px;">Estado</th>
                        </tr>
                    </thead>
                    <tbody id="correctionTableBody">
                        ${auditRecords.map(rec => `
                            <tr data-id="${rec.id}" class="audit-row" style="background: #1e293b; border-radius: 10px;">
                                <td style="text-align: center; font-weight: 900; color: #475569;">${rec.id}</td>
                                <td style="padding: 15px; color: #94a3b8; font-size: 0.8rem; font-family: monospace;">${rec.name}</td>
                                <td style="padding: 15px; position: relative;">
                                    ${isNameStep ? `
                                        <input type="text" class="name-input" placeholder="🔍 Escribe nombre..." value="${rec.baseName}" 
                                               style="width: 100%; background: #0b0f1a; color: white; border: 2px solid #ef4444; padding: 12px; border-radius: 8px; font-size: 1rem; font-weight: bold;">
                                        <div class="suggestion-box" style="display:none; position:absolute; left:0; right:0; background:#1e293b; border:2px solid #f59e0b; z-index:1000; max-height:200px; overflow-y:auto; border-radius: 0 0 8px 8px;"></div>
                                        <input type="hidden" class="selected-family-id" value="">
                                        <input type="hidden" class="nk-row-input" value="${rec.nk}">
                                    ` : `
                                        <input type="text" class="nk-row-input" placeholder="🔍 Escribe NK..." value="${rec.nk}" 
                                               style="width: 100%; background: #0b0f1a; color: #3b82f6; border: 2px solid #3b82f6; padding: 12px; border-radius: 8px; font-family: monospace; font-weight: 900; text-align: center; font-size: 1.2rem;">
                                        <div class="suggestion-box" style="display:none; position:absolute; left:0; right:0; background:#1e293b; border:2px solid #3b82f6; z-index:1000; max-height:200px; overflow-y:auto; border-radius: 0 0 8px 8px;"></div>
                                        <input type="hidden" class="name-input" value="${rec.baseName}">
                                    `}
                                </td>
                                <td style="padding: 15px; text-align: center;">
                                    <div class="status-indicator">
                                        <i class="fas fa-times-circle" style="color: #ef4444; font-size: 1.8rem;"></i>
                                        <span style="display:block; font-size: 0.7rem; font-weight: 900; color: #ef4444;">BLOQUEADO</span>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="modal-footer" style="background: #1e1e2e; border-top: 1px solid #334155; padding: 1.5rem 2.5rem; display: flex; justify-content: space-between; align-items: center; border-radius: 0 0 12px 12px;">
                <button class="cancel-modal" style="background: transparent; border: 1px solid #475569; color: #64748b; padding: 12px 25px; border-radius: 10px; cursor: pointer; font-size: 0.9rem;">CANCELAR</button>
                <button id="btnApplyCorrections" style="background: ${isNameStep ? '#f59e0b' : '#10b981'}; color: white; border: none; padding: 15px 40px; border-radius: 10px; cursor: pointer; font-weight: 900; font-size: 1rem;">
                    ${isNameStep ? 'SIGUIENTE: VALIDAR NK <i class="fas fa-chevron-right"></i>' : 'FINALIZAR Y CARGAR <i class="fas fa-check-double"></i>'}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const rows = Array.from(modal.querySelectorAll('#correctionTableBody tr'));
    
    const validateRow = (row) => {
        const input = isNameStep ? row.querySelector('.name-input') : row.querySelector('.nk-row-input');
        const val = input.value.trim().toUpperCase();
        const isValid = isNameStep ? isValidColorName(val) : isValidNK(val);
        
        const icon = row.querySelector('.status-indicator i');
        const text = row.querySelector('.status-indicator span');
        
        if (isValid) {
            icon.className = 'fas fa-check-circle'; icon.style.color = '#10b981';
            text.textContent = 'LISTO'; text.style.color = '#10b981';
            input.style.borderColor = '#10b981';
        } else {
            icon.className = 'fas fa-times-circle'; icon.style.color = '#ef4444';
            text.textContent = 'BLOQUEADO'; text.style.color = '#ef4444';
            input.style.borderColor = isNameStep ? '#ef4444' : '#3b82f6';
        }
    };

    rows.forEach(row => {
        const input = isNameStep ? row.querySelector('.name-input') : row.querySelector('.nk-row-input');
        const sugBox = row.querySelector('.suggestion-box');

        input.oninput = () => {
            const val = input.value.trim().toUpperCase();
            if (val.length < 2) { sugBox.style.display = 'none'; validateRow(row); return; }

            let matches = [];
            if (isNameStep) {
                const families = Array.isArray(window.EQUIVALENCY_ROWS) ? window.EQUIVALENCY_ROWS : [];
                const allColors = [];
                families.forEach(f => {
                    const groupId = f[0];
                    for (let i = 1; i < f.length; i++) {
                        if (f[i]) allColors.push({ name: f[i].toUpperCase(), group: groupId });
                    }
                });
                matches = allColors.filter(c => c.name.includes(val)).slice(0, 15);
            } else {
                matches = Array.from(masterNksSet).filter(nk => nk.includes(val)).slice(0, 10);
            }

            if (matches.length > 0) {
                sugBox.innerHTML = matches.map(m => {
                    const text = isNameStep ? `<strong>${m.name}</strong> <small style="color:#64748b;">(Grupo: ${m.group})</small>` : `<strong>${m}</strong>`;
                    const value = isNameStep ? m.name : m;
                    return `<div class="sug-item" data-value="${value}" style="padding:10px; cursor:pointer; color:white; border-bottom:1px solid #334155;">${text}</div>`;
                }).join('');
                sugBox.style.display = 'block';
                sugBox.querySelectorAll('.sug-item').forEach(item => {
                    item.onclick = () => {
                        input.value = item.dataset.value;
                        sugBox.style.display = 'none';
                        validateRow(row);
                    };
                });
            } else {
                sugBox.style.display = 'none';
            }
            validateRow(row);
        };
        input.onblur = () => setTimeout(() => sugBox.style.display = 'none', 200);
        validateRow(row);
    });

    modal.querySelector('#btnApplyCorrections').onclick = async () => {
        if (!rows.every(r => r.querySelector('.status-indicator span').textContent.trim() === 'LISTO')) {
            alert('Debes corregir todos los registros antes de continuar.');
            return;
        }

        const btn = modal.querySelector('#btnApplyCorrections');
        btn.disabled = true; btn.innerHTML = 'PROCESANDO...';

        if (!isNameStep) {
            const newNks = [...new Set(rows.map(r => r.querySelector('.nk-row-input').value.trim().toUpperCase()).filter(nk => !isValidNK(nk)))];
            if (newNks.length > 0 && confirm(`¿Registrar estos NKs como nuevos?\n${newNks.join(', ')}`)) {
                for (const nk of newNks) await addMasterNK(nk);
            }
        }

        const corrected = rows.map(row => ({
            id: row.dataset.id,
            baseName: row.querySelector('.name-input').value.trim().toUpperCase(),
            nk: row.querySelector('.nk-row-input').value.trim().toUpperCase()
        }));

        modal.remove();
        onComplete(corrected);
    };

    modal.querySelector('.cancel-modal').onclick = () => {
        if (confirm('¿Cancelar carga de archivo?')) { modal.remove(); onComplete(null); }
    };
}

export function revalidateRecord(name, nk) {
    let rawName = (name || '').toUpperCase().trim();
    rawName = rawName.replace(/\s+NK[A-Z0-9\-]+$/i, '').trim();
    const parts = rawName.split(/\s+/);
    if (parts.length > 1) {
        const lastPart = parts[parts.length - 1];
        if (/[0-9]/.test(lastPart) && lastPart.length >= 5) rawName = parts.slice(0, -1).join(' ');
    }
    const cleanBase = rawName.replace(/\s*\([^)]*\)/g, '').trim();
    const cleanNk = (nk || '').trim().toUpperCase();

    return {
        isNameValid: isValidColorName(cleanBase),
        isNkValid: isValidNK(cleanNk),
        cleanBase,
        cleanNk
    };
}