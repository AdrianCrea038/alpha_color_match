// js/modules/nameValidator.js
import { normalizeSpaces, escapeHtml } from '../core/utils.js';
import { addCustomValidColorName, getCustomValidColorNames } from '../core/supabaseClient.js';

let appInstance = null;
let validColorNamesLoaded = false;

export function setAppInstance(app) {
    appInstance = app;
}

function getValidNamesSet() {
    const names = window.ALL_VALID_COLOR_NAMES || [];
    return new Set(names.map(name => normalizeSpaces(name).toUpperCase()));
}

export function isValidColorName(baseName, fullName = '') {
    const textToTest = fullName || baseName;
    if (!textToTest) return false;
    
    // 1. Detección estricta de paréntesis en cualquier parte
    if (/\([^)]*\)/.test(textToTest)) {
        console.warn(`⚠️ Paréntesis detectados en: "${textToTest}"`);
        return false;
    }
    
    // 2. No permitir códigos NK pegados al nombre
    if (/\s+NK[A-Z0-9\-]+$/i.test(baseName.trim())) return false;
    
    const validSet = getValidNamesSet();
    const normalized = normalizeSpaces(baseName).toUpperCase();
    
    // Si no hay catálogo cargado, solo validamos formato (paréntesis)
    if (validSet.size === 0) return true;
    
    return validSet.has(normalized);
}

function addNameToLocalCatalog(name) {
    const normalized = normalizeSpaces(name || '').toUpperCase();
    if (!window.ALL_VALID_COLOR_NAMES) window.ALL_VALID_COLOR_NAMES = [];
    if (!window.ALL_VALID_COLOR_NAMES.includes(normalized)) {
        window.ALL_VALID_COLOR_NAMES.push(normalized);
        window.ALL_VALID_COLOR_NAMES.sort();
    }
}

async function ensureValidColorCatalogLoaded() {
    if (validColorNamesLoaded) return;
    validColorNamesLoaded = true;
    const customNames = await getCustomValidColorNames();
    for (const name of customNames) {
        addNameToLocalCatalog(name);
    }
}

function findAndCorrectInOtherArray(originalName, newBaseName, newFullName, currentFileType) {
    if (!appInstance) return;
    const otherArray = currentFileType === 'primary' ? appInstance.secondaryData : appInstance.primaryData;
    if (!otherArray || otherArray.length === 0) return;
    
    let corrected = false;
    for (let i = 0; i < otherArray.length; i++) {
        if (otherArray[i].name === originalName) {
            otherArray[i].baseName = newBaseName;
            otherArray[i].name = newFullName;
            corrected = true;
        }
    }
    
    if (corrected) {
        if (currentFileType === 'primary') {
            appInstance.renderDataList?.('secondary', appInstance.secondaryData);
        } else {
            appInstance.renderDataList?.('primary', appInstance.primaryData);
        }
        appInstance.saveCurrentState?.();
    }
}

function showCorrectionModal(colorData, index, totalInvalid, suggestedNk = '', existingRecords = []) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '10001';
        
        let selectedValue = '';
        const allNames = window.ALL_VALID_COLOR_NAMES || [];
        
        const renderSuggestions = (filterText) => {
            const suggestionsList = modal.querySelector('#suggestionsList');
            const cleanQuery = (filterText || '').replace(/\([^)]*\)/g, '').trim().toUpperCase();
            const filterLower = cleanQuery.toLowerCase();
            
            // Búsqueda inteligente: coincidencias por subcadena
            let matches = allNames.filter(name => {
                const nameUpper = name.toUpperCase();
                return nameUpper.includes(cleanQuery) || cleanQuery.includes(nameUpper);
            }).sort((a, b) => {
                // Prioridad: Que empiece por el texto buscado
                const aStarts = a.toUpperCase().startsWith(cleanQuery);
                const bStarts = b.toUpperCase().startsWith(cleanQuery);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                return a.length - b.length;
            }).slice(0, 10);
            
            if (matches.length === 0) {
                const escapedInput = escapeHtml(filterText.trim().toUpperCase());
                suggestionsList.innerHTML = `
                    <div style="padding: 0.8rem; color: #f87171; text-align: center; font-size: 0.85rem; background: rgba(248,113,113,0.05);">
                        ⚠️ No se encontró una coincidencia clara en el catálogo.
                    </div>
                    <div class="suggestion-item add-new-name" data-value="${escapedInput}" style="padding: 0.8rem 1rem; cursor: pointer; border-top: 1px solid rgba(255,255,255,0.1); color: #4ade80; font-weight: bold;">
                        ➕ REGISTRAR COMO NUEVO: "${escapedInput}"
                    </div>
                `;
            } else {
                const header = `<div style="padding: 0.5rem 1rem; font-size: 0.7rem; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid rgba(59,130,246,0.2); background: rgba(59,130,246,0.05);">Sugerencias del Sistema</div>`;
                
                suggestionsList.innerHTML = header + matches.map(name => `
                    <div class="suggestion-item" data-value="${escapeHtml(name)}" style="padding: 0.8rem 1rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); color: white; display: flex; justify-content: space-between; align-items: center;">
                        <span><i class="fas fa-magic" style="color: #3b82f6; margin-right: 8px;"></i> ${escapeHtml(name)}</span>
                        <small style="color: #6b7280; font-size: 0.7rem;">Click para aplicar</small>
                    </div>
                `).join('');
            }

            // Aplicar estilos y eventos
            const style = document.createElement('style');
            style.innerHTML = `
                .suggestion-item:hover { background: rgba(59, 130, 246, 0.4) !important; }
                .suggestion-item:active { transform: scale(0.98); }
            `;
            document.head.appendChild(style);

            suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
                item.onclick = () => {
                    selectedValue = item.dataset.value;
                    modal.querySelector('#searchInput').value = selectedValue;
                    suggestionsList.style.display = 'none';
                    validateForm();
                    window.showNotification('Sugerencia Aplicada', `Se ha seleccionado: ${selectedValue}`, 'info');
                };
            });
            
            suggestionsList.style.display = 'block';
        };
        
        const validateForm = () => {
            const applyBtn = modal.querySelector('.apply-correction');
            const reasonSelect = modal.querySelector('#correctionReason');
            const searchVal = modal.querySelector('#searchInput').value.trim();
            const nkVal = modal.querySelector('#manualNkInput').value.trim();
            const duplicateWarning = modal.querySelector('#duplicateWarning');
            
            const currentName = searchVal.toUpperCase();
            const currentNk = nkVal.toUpperCase();
            const newFullName = currentNk ? `${currentName} ${currentNk}` : currentName;
            
            const isDuplicate = existingRecords.some(r => {
                if (r._uid === colorData._uid) return false;
                const rClean = (r.name || '').replace(/\s*\([^)]*\)/g, '').toUpperCase().trim();
                const rNk = (r.nk || '').trim().toUpperCase();
                return (rNk ? `${rClean} ${rNk}` : rClean) === newFullName;
            });

            if (isDuplicate) {
                duplicateWarning.style.display = 'block';
                duplicateWarning.innerHTML = `⚠️ ¡ATENCIÓN! Este nombre ya existe en el archivo.<br><small>No se permiten duplicados. Por favor, corrija el nombre o NK.</small>`;
            } else {
                duplicateWarning.style.display = 'none';
            }
            
            const isValid = searchVal !== '' && nkVal !== '' && reasonSelect.value !== '' && !isDuplicate;
            applyBtn.disabled = !isValid;
            applyBtn.style.opacity = isValid ? '1' : '0.5';
            applyBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
        };
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 550px; border: 2px solid #ff007f;">
                <div class="modal-header" style="background: linear-gradient(90deg, #ff007f, #b45309);">
                    <h3 style="color: white; margin:0;"><i class="fas fa-edit"></i> Auditoría de Color (${index + 1}/${totalInvalid})</h3>
                    <button class="modal-close" style="color: white; background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body" style="padding: 1.5rem;">
                    <div id="duplicateWarning" style="display:none; background: rgba(244, 63, 94, 0.2); color: #f43f5e; padding: 0.8rem; border-radius: 0.5rem; margin-bottom: 1rem; border: 1px solid #f43f5e; font-weight: bold; text-align: center;"></div>
                    <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem; border-left: 4px solid #ff007f;">
                        <p style="margin:0 0 0.5rem;"><strong>Valor Original:</strong> <span style="color:#ff007f;">${escapeHtml(colorData.name)}</span></p>
                    </div>
                    <div class="form-group" style="margin-bottom: 1.2rem; position: relative;">
                        <label style="display:block; margin-bottom:0.4rem; color:#9ca3af; font-size: 0.85rem;">Nombre Correcto:</label>
                        <input type="text" id="searchInput" placeholder="Nombre oficial..." style="width:100%; padding:0.7rem; background:#0c0c12; border:1px solid #2d3748; border-radius:0.5rem; color:white;">
                        <div id="suggestionsList" style="max-height: 200px; overflow-y: auto; margin-top: 2px; border-radius: 0.5rem; background: #1f2937; border: 1px solid #3b82f6; display: none; position: absolute; z-index: 10000; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.6); color: white;"></div>
                    </div>
                    <div class="form-group" style="margin-bottom: 1.2rem;">
                        <label style="display:block; margin-bottom:0.4rem; color:#9ca3af; font-size: 0.85rem;">Código NK:</label>
                        <input type="text" id="manualNkInput" placeholder="NK123" style="width:100%; padding:0.7rem; background:#0c0c12; border:1px solid #2d3748; border-radius:0.5rem; color:#00e5ff; font-weight: bold;">
                    </div>
                    <div class="form-group">
                        <label style="display:block; margin-bottom:0.4rem; color:#9ca3af; font-size: 0.85rem;">Motivo:</label>
                        <select id="correctionReason" style="width:100%; padding:0.7rem; background:#0c0c12; border:1px solid #2d3748; border-radius:0.5rem; color:white;">
                            <option value="Mal escrito nombre" selected>Nombre mal escrito / Paréntesis</option>
                            <option value="Falta NK">Falta NK</option>
                            <option value="Limpieza de NK">Limpieza de NK en nombre</option>
                        </select>
                    </div>
                </div>
                <div class="modal-buttons" style="display: flex; gap: 1rem; justify-content: flex-end; padding: 1.5rem; background: rgba(0,0,0,0.2); border-top: 1px solid #2d3748;">
                    <button class="cancel-correction" style="padding: 0.7rem 1.2rem; cursor:pointer; background: transparent; color: white; border: 1px solid #4b5563; border-radius: 0.5rem;">Cancelar</button>
                    <button class="apply-correction" style="padding: 0.7rem 1.5rem; background:#ff007f; color: white; border: none; border-radius: 0.5rem; font-weight: bold;">APLICAR</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const searchInput = modal.querySelector('#searchInput');
        const manualNkInput = modal.querySelector('#manualNkInput');
        const applyBtn = modal.querySelector('.apply-correction');
        
        searchInput.value = colorData.baseName || '';
        manualNkInput.value = colorData.nk || suggestedNk || '';
        
        const updateAll = () => { renderSuggestions(searchInput.value); validateForm(); };
        searchInput.addEventListener('input', updateAll);
        manualNkInput.addEventListener('input', validateForm);
        modal.querySelector('#correctionReason').addEventListener('change', validateForm);
        
        // Ejecutar búsqueda inicial inmediatamente al abrir
        updateAll();

        modal.querySelector('.modal-close').onclick = () => { modal.remove(); resolve(null); };
        modal.querySelector('.cancel-correction').onclick = () => { modal.remove(); resolve(null); };
        applyBtn.onclick = async () => {
            const finalBase = (selectedValue || searchInput.value.trim()).toUpperCase();
            const finalNk = manualNkInput.value.trim().toUpperCase();
            const newFull = finalNk ? `${finalBase} ${finalNk}` : finalBase;

            modal.remove();
            resolve({ newBaseName: finalBase, newNk: finalNk, newFullName: newFull, reason: modal.querySelector('#correctionReason').value });
        };
    });
}

export async function validateAndCorrectRecords(records, fileType, onCorrectionApplied, suggestedNk = '', contextRecords = null) {
    await ensureValidColorCatalogLoaded();
    const correctedRecords = [...records];
    const correctionsNeeded = [];
    const duplicateContext = contextRecords || correctedRecords;
    
    // El Principal (Master) solo se detiene por errores técnicos (paréntesis, duplicados)
    // El Secundario se valida contra catálogo oficial
    const ignoreCatalog = (fileType === 'primary');
    
    for (let i = 0; i < correctedRecords.length; i++) {
        const record = correctedRecords[i];
        if (!isValidColorName(record.baseName, record.name, ignoreCatalog) || !record.nk) {
            correctionsNeeded.push({ record: record, index: i });
        }
    }
    
    if (correctionsNeeded.length === 0 && !contextRecords) return { records: correctedRecords, corrected: false };
    if (correctionsNeeded.length === 0 && contextRecords && records.length === 1) {
        correctionsNeeded.push({ record: records[0], index: 0 });
    }

    for (let idx = 0; idx < correctionsNeeded.length; idx++) {
        const { record, index } = correctionsNeeded[idx];
        const result = await showCorrectionModal(record, idx, correctionsNeeded.length, suggestedNk, duplicateContext);
        if (!result) return { records: [], corrected: false };
        
        correctedRecords[index].baseName = result.newBaseName;
        correctedRecords[index].name = result.newFullName;
        correctedRecords[index].nk = result.newNk;
        
        if (onCorrectionApplied) onCorrectionApplied(record.name, result.newFullName, result.reason);
        findAndCorrectInOtherArray(record.name, result.newBaseName, result.newFullName, fileType);
    }
    return { records: correctedRecords, corrected: true };
}