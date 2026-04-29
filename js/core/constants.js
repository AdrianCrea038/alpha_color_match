// js/core/constants.js

// Ahora la fuente de verdad es la BASE DE DATOS (Supabase).
// Estas listas se mantienen vacías y se llenan dinámicamente al iniciar la app.

export let EQUIVALENCY_ROWS = [];

export let ALL_VALID_COLOR_NAMES = [];

export let EQUIVALENCE_MAP = new Map();

export let MAIN_COLOR_NAMES = [];

/**
 * Función crítica para actualizar el catálogo desde la base de datos
 * @param {Array} dbGroups - Datos provenientes de la tabla equivalency_groups
 */
export function updateConstantsFromDB(dbGroups) {
    EQUIVALENCY_ROWS = dbGroups || [];
    
    // Reconstruir ALL_VALID_COLOR_NAMES
    const names = [];
    for (const row of EQUIVALENCY_ROWS) {
        for (let i = 1; i < row.length; i++) {
            names.push(row[i].toUpperCase());
        }
    }
    ALL_VALID_COLOR_NAMES = [...new Set(names)].sort();

    // Reconstruir EQUIVALENCE_MAP
    EQUIVALENCE_MAP = new Map();
    for (const row of EQUIVALENCY_ROWS) {
        const groupId = row[0];
        const namesInGroup = row.slice(1);
        for (const name of namesInGroup) {
            const key = name.toUpperCase();
            if (!EQUIVALENCE_MAP.has(key)) {
                EQUIVALENCE_MAP.set(key, { groupId, names: [...namesInGroup] });
            }
        }
    }

    // Reconstruir MAIN_COLOR_NAMES
    const mainNames = [];
    for (const row of EQUIVALENCY_ROWS) {
        if (row.length > 1) {
            mainNames.push(row[1]);
        }
    }
    MAIN_COLOR_NAMES = mainNames.sort();
    
    console.log('💎 Constantes del sistema actualizadas dinámicamente desde la base de datos.');
}

export function getAllEquivalentNames(baseName) {
    const key = (baseName || '').toUpperCase();
    const equiv = EQUIVALENCE_MAP.get(key);
    return equiv ? [...equiv.names] : [baseName];
}

export function getGroupIdForColor(baseName) {
    const key = (baseName || '').toUpperCase();
    const equiv = EQUIVALENCE_MAP.get(key);
    return equiv ? equiv.groupId : '';
}