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

function addNameToLocalCatalog(name) {
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
    if (!validColorNamesLoaded) return true; 
    const validSet = getValidNamesSet();
    const normalized = normalizeSpaces(baseName).toUpperCase();
    if (validSet.size === 0 || ignoreCatalog) return true;
    return validSet.has(normalized);
}

export function isValidNK(nk) {
    if (!nk) return false;
    const cleanNk = nk.trim().toUpperCase();
    if (masterNksSet.size === 0) return true;
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
    await ensureValidColorCatalogLoaded();
    const invalidRecords = [];
    for (const record of records) {
        const cleanBase = (record.baseName || record.name || '').replace(/\s*\([^)]*\)/g, '').toUpperCase().trim();
        const cleanNk = (record.nk || '').trim().toUpperCase();
        if (cleanBase.includes('WHITE') || cleanBase.includes('10A')) continue;
        const isNameValid = isValidColorName(cleanBase);
        const isNkValid = isValidNK(cleanNk);
        if (!isNameValid || !isNkValid) {
            invalidRecords.push({ ...record, nameError: !isNameValid, nkError: !isNkValid, baseName: cleanBase, nk: cleanNk });
        }
    }
    if (invalidRecords.length === 0) return { records: records };
    return new Promise((resolve) => {
        createCorrectionModal(invalidRecords, type, (correctedRecords) => {
            const finalRecords = records.map(original => {
                const corrected = correctedRecords.find(c => c.id === original.id);
                return corrected ? corrected : original;
            });
            resolve({ records: finalRecords });
        });
    });
}

function createCorrectionModal(invalidRecords, type, onComplete) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.style.zIndex = '10001';
    const uniqueInvalidNks = [...new Set(invalidRecords.filter(r => r.nkError).map(r => r.nk))];
    const title = type === 'primary' ? 'Corrección Maestro' : 'Corrección Secundario';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px; width: 95%;">
            <div class="modal-header" style="background: #991b1b;"><h3 style="color: white;"><i class="fas fa-spell-check"></i> ${title}</h3></div>
            <div class="modal-body" style="display: flex; gap: 1rem;">
                <div style="flex: 2; max-height: 400px; overflow-y: auto;">
                    <table class="results-table">
                        <thead><tr><th>Línea</th><th>Nombre</th><th>Familia</th><th>OK</th></tr></thead>
                        <tbody id="correctionTableBody">
                            ${invalidRecords.map(rec => `
                                <tr data-id="${rec.id}">
                                    <td>${rec.id}</td>
                                    <td style="font-size:0.7rem;">${rec.name || rec.baseName}</td>
                                    <td style="position:relative;">
                                        <input type="text" class="name-input ${rec.nameError ? 'error-border' : ''}" value="${rec.baseName || rec.name}" style="width:100%;">
                                        <div class="suggestion-box" style="display:none; position:absolute; left:0; right:0; background:#1a1a2a; border:1px solid #00e5ff; z-index:100; max-height:100px; overflow-y:auto;"></div>
                                        <div class="family-selector" style="display:${rec.nameError ? 'block' : 'none'}; margin-top:5px;">
                                            <input type="text" class="family-filter-input" placeholder="Buscar familia..." style="width:100%; font-size:0.7rem;">
                                            <div class="family-suggestion-box" style="display:none; position:absolute; left:0; right:0; background:#111117; border:1px solid #eab308; z-index:101; max-height:100px; overflow-y:auto;"></div>
                                            <input type="hidden" class="selected-family-id" value="">
                                        </div>
                                    </td>
                                    <td><i class="fas fa-${rec.nameError ? 'exclamation-circle' : 'check-circle'}" style="color: ${rec.nameError ? '#ef4444' : '#10b981'};"></i></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div style="flex: 1; background: #111117; padding: 10px; border-radius: 5px;">
                    <h5 style="color: #9ca3af;">NKs Nuevos</h5>
                    ${uniqueInvalidNks.map(nk => `<div style="margin-bottom:5px;"><input type="checkbox" class="nk-checkbox" checked data-nk="${nk}"> <span style="color:#eab308; font-family:monospace;">${nk}</span></div>`).join('')}
                </div>
            </div>
            <div class="modal-buttons" style="padding: 1rem; border-top: 1px solid #2d3748;">
                <button class="btn btn-secondary cancel-modal">CANCELAR</button>
                <button class="btn btn-primary" id="btnApplyCorrections" style="background: #10b981;">APLICAR Y REGISTRAR EN DB</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const allValidNames = Array.from(getValidNamesSet());
    const groups = window.EQUIVALENCY_ROWS || [];

    modal.querySelectorAll('.name-input').forEach(input => {
        const row = input.closest('tr');
        const sugBox = row.querySelector('.suggestion-box');
        const famSelector = row.querySelector('.family-selector');
        const famInput = row.querySelector('.family-filter-input');
        const famSugBox = row.querySelector('.family-suggestion-box');
        const hiddenFamId = row.querySelector('.selected-family-id');

        input.oninput = () => {
            const val = input.value.trim().toUpperCase();
            if (!val) { sugBox.style.display = 'none'; return; }
            const matches = allValidNames.filter(n => n.includes(val)).slice(0, 5);
            if (matches.length > 0) {
                sugBox.style.display = 'block';
                sugBox.innerHTML = matches.map(m => `<div class="suggestion-item" style="padding:5px; cursor:pointer; color:white; border-bottom:1px solid #2d3748;">${m}</div>`).join('');
                sugBox.querySelectorAll('div').forEach(d => d.onclick = () => {
                    input.value = d.textContent; sugBox.style.display = 'none'; famSelector.style.display = 'none';
                    row.querySelector('.status-cell i').className = 'fas fa-check-circle';
                    row.querySelector('.status-cell i').style.color = '#10b981';
                });
            } else { sugBox.style.display = 'none'; famSelector.style.display = 'block'; }
        };

        famInput.oninput = () => {
            const val = famInput.value.trim().toUpperCase();
            if (!val) { famSugBox.style.display = 'none'; return; }
            const matches = groups.filter(g => g[0].toUpperCase().includes(val) || (g[1] && g[1].toUpperCase().includes(val))).slice(0, 5);
            famSugBox.style.display = 'block';
            let html = matches.map(g => `<div class="suggestion-item" data-id="${g[0]}" style="padding:5px; cursor:pointer; color:white; border-bottom:1px solid #2d3748;"><strong>${g[0]}</strong> - ${g[1]||''}</div>`).join('');
            html += `<div class="suggestion-item create-new" data-id="${val}" style="padding:5px; cursor:pointer; color:#00e5ff;">+ Crear: ${val}</div>`;
            famSugBox.innerHTML = html;
            famSugBox.querySelectorAll('.suggestion-item').forEach(d => d.onclick = () => {
                hiddenFamId.value = d.dataset.id; famInput.value = d.dataset.id; famSugBox.style.display = 'none';
                famInput.style.borderColor = '#10b981';
            });
        };
    });

    modal.querySelector('#btnApplyCorrections').onclick = async () => {
        const rows = modal.querySelectorAll('#correctionTableBody tr');
        const corrected = [];
        let allValid = true;
        const btn = modal.querySelector('#btnApplyCorrections');
        btn.disabled = true; btn.innerHTML = 'GUARDANDO...';

        for (const row of rows) {
            const id = row.dataset.id;
            const input = row.querySelector('.name-input');
            const hiddenFamId = row.querySelector('.selected-family-id');
            const newName = input.value.trim().toUpperCase();
            const selectedFam = hiddenFamId.value;
            const original = invalidRecords.find(r => String(r.id) === String(id));
            if (!original) continue;

            if (isValidColorName(newName)) {
                corrected.push({ ...original, baseName: newName, name: `${newName} ${original.nk || ''}`.trim(), nk: original.nk });
            } else if (newName && selectedFam) {
                // --- LÓGICA PARA TABLA CON ARRAY (grupo_id, colores) ---
                let success = false;
                let lastErr = '';

                    try {
                        // 1. Obtener el registro (sin usar .single() para evitar error 406)
                        const { data: results, error: fetchError } = await supabase
                            .from('equivalencias')
                            .select('colores')
                            .eq('grupo_id', selectedFam);

                        const existingRow = results && results.length > 0 ? results[0] : null;

                        if (existingRow) {
                            // 2. Si existe, añadir al array si no está ya
                            const updatedColores = Array.isArray(existingRow.colores) ? [...existingRow.colores] : [];
                            if (!updatedColores.includes(newName)) {
                                updatedColores.push(newName);
                                const { error: updateError } = await supabase
                                    .from('equivalencias')
                                    .update({ colores: updatedColores })
                                    .eq('grupo_id', selectedFam);
                                
                                if (!updateError) success = true;
                                else lastErr = updateError.message;
                            } else {
                                success = true; 
                            }
                        } else {
                            // 3. Si no existe, insertar nuevo registro
                            const { error: insertError } = await supabase
                                .from('equivalencias')
                                .insert({
                                    grupo_id: selectedFam,
                                    colores: [newName]
                                });
                            
                            if (!insertError) success = true;
                            else lastErr = insertError.message;
                        }
                    } catch (err) {
                    lastErr = err.message;
                }

                if (success) {
                    corrected.push({ ...original, baseName: newName, name: `${newName} ${original.nk || ''}`.trim(), nk: original.nk });
                    addNameToLocalCatalog(newName);
                } else {
                    alert(`Error en tabla 'equivalencias' [grupo_id, colores]: ${lastErr}`);
                    allValid = false;
                    break;
                }
            } else { allValid = false; input.classList.add('error-border'); }
        }
        if (allValid) {
            const nks = modal.querySelectorAll('.nk-checkbox:checked');
            for (const cb of nks) await addMasterNK(cb.dataset.nk);
            modal.remove(); onComplete(corrected);
        } else { btn.disabled = false; btn.innerHTML = 'REINTENTAR'; }
    };
    modal.querySelector('.cancel-modal').onclick = () => modal.remove();
}