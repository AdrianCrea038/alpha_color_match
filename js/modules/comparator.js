// js/modules/comparator.js
import { getAllEquivalentNames, getGroupIdForColor } from '../core/constants.js';

function getNK(record) {
    return record.nk || (() => {
        const match = record.name.match(/\s+([A-Z0-9\-]+)$/i);
        if (match && /^[A-Z0-9\-]{3,}$/i.test(match[1])) return match[1];
        const words = record.name.trim().split(/\s+/);
        return words.length > 0 ? words[words.length - 1] : null;
    })();
}

export function compareFiles(primaryData, secondaryData, mode = 'fusion') {
    if (mode === 'ciclico') {
        return compareCiclico(primaryData, secondaryData);
    }

    const primaryByNK = new Map();
    const secondaryByNK = new Map();
    
    for (const color of primaryData) {
        const nk = getNK(color);
        if (nk) {
            if (!primaryByNK.has(nk)) primaryByNK.set(nk, []);
            primaryByNK.get(nk).push(color);
        }
    }
    
    for (const color of secondaryData) {
        const nk = getNK(color);
        if (nk) {
            if (!secondaryByNK.has(nk)) secondaryByNK.set(nk, []);
            secondaryByNK.get(nk).push(color);
        }
    }
    
    const results = [];
    const processedPrimary = new Set();
    const processedSecondary = new Set();
    const allNKs = new Set([...primaryByNK.keys(), ...secondaryByNK.keys()]);
    let groupCounter = 0;
    
    for (const nk of allNKs) {
        const primaryColors = primaryByNK.get(nk) || [];
        const secondaryColors = secondaryByNK.get(nk) || [];
        const groups = new Map();
        
        for (const pc of primaryColors) {
            const eqGroup = getAllEquivalentNames(pc.baseName);
            const groupKey = eqGroup[0];
            if (!groups.has(groupKey)) groups.set(groupKey, { primarios: [], secundarios: [], groupKey });
            groups.get(groupKey).primarios.push(pc);
        }
        
        for (const sc of secondaryColors) {
            const eqGroup = getAllEquivalentNames(sc.baseName);
            const groupKey = eqGroup[0];
            if (!groups.has(groupKey)) groups.set(groupKey, { primarios: [], secundarios: [], groupKey });
            groups.get(groupKey).secundarios.push(sc);
        }
        
        for (const [groupKey, group] of groups) {
            const { primarios, secundarios } = group;
            const groupId = `group_${nk}_${groupCounter++}`;
            const groupDisplayId = getGroupIdForColor(groupKey);
            
            if (primarios.length && secundarios.length) {
                for (const primary of primarios) {
                    for (const secondary of secundarios) {
                        let isExact = false;
                        
                        if (mode === 'simple') {
                            const isNameMatch = primary.baseName === secondary.baseName;
                            const isNkMatch = (primary.nk || '').trim().toUpperCase() === (secondary.nk || '').trim().toUpperCase();
                            const isCmykMatch = (primary.cmyk || []).every((val, idx) => Math.abs(val - (secondary.cmyk?.[idx] || 0)) < 0.01);
                            isExact = isNameMatch && isNkMatch && isCmykMatch;
                        } else {
                            isExact = primary.baseName === secondary.baseName;
                        }

                        results.push({
                            id: `primary_${primary.tempId || primary.id || Math.random()}`,
                            groupId,
                            groupDisplayId,
                            groupKey,
                            nk,
                            primaryData: { ...primary },
                            secondaryData: { ...secondary },
                            matchType: isExact ? 'exact' : 'equivalent',
                            isPending: false
                        });
                        processedPrimary.add(primary.tempId || primary.id);
                        processedSecondary.add(secondary.tempId || secondary.id);
                    }
                }
            } else if (primarios.length) {
                for (const primary of primarios) {
                    if (!processedPrimary.has(primary.tempId || primary.id)) {
                        results.push({
                            id: `pending_primary_${primary.tempId || primary.id || Math.random()}`,
                            groupId: null,
                            groupDisplayId,
                            groupKey,
                            nk,
                            primaryData: { ...primary },
                            secondaryData: null,
                            matchType: 'pending_primary',
                            isPending: true
                        });
                        processedPrimary.add(primary.tempId || primary.id);
                    }
                }
            } else if (secundarios.length) {
                for (const secondary of secundarios) {
                    if (!processedSecondary.has(secondary.tempId || secondary.id)) {
                        results.push({
                            id: `pending_secondary_${secondary.tempId || secondary.id || Math.random()}`,
                            groupId: null,
                            groupDisplayId,
                            groupKey,
                            nk,
                            primaryData: null,
                            secondaryData: { ...secondary },
                            matchType: 'pending_secondary',
                            isPending: true
                        });
                        processedSecondary.add(secondary.tempId || secondary.id);
                    }
                }
            }
        }
    }
    
    results.sort((a, b) => {
        const gc = (a.groupKey || '').localeCompare(b.groupKey || '');
        if (gc !== 0) return gc;
        const nc = a.nk.localeCompare(b.nk);
        if (nc !== 0) return nc;
        return (a.primaryData?.name || a.secondaryData?.name || '').localeCompare(b.primaryData?.name || b.secondaryData?.name || '');
    });
    
    return results;
}

function compareCiclico(primaryData, secondaryData) {
    const pMap = new Map();
    const sMap = new Map();
    const results = [];
    
    // Agrupar por firma única (Familia de Equivalentes + NK)
    primaryData.forEach(r => {
        const cleanBase = (r.baseName || r.name || '').replace(/\s*\([^)]*\)/g, '').toUpperCase().trim();
        const equivalents = getAllEquivalentNames(cleanBase);
        const groupKey = equivalents[0];
        const key = `${groupKey}|${(r.nk || '').trim().toUpperCase()}`;
        if (!pMap.has(key)) pMap.set(key, []);
        pMap.get(key).push(r);
    });

    secondaryData.forEach(r => {
        const cleanBase = (r.baseName || r.name || '').replace(/\s*\([^)]*\)/g, '').toUpperCase().trim();
        const equivalents = getAllEquivalentNames(cleanBase);
        const groupKey = equivalents[0];
        const key = `${groupKey}|${(r.nk || '').trim().toUpperCase()}`;
        if (!sMap.has(key)) sMap.set(key, []);
        sMap.get(key).push(r);
    });

    const allKeys = new Set([...pMap.keys(), ...sMap.keys()]);

    allKeys.forEach(key => {
        const pList = pMap.get(key) || [];
        const sList = sMap.get(key) || [];
        const max = Math.max(pList.length, sList.length);

        for (let i = 0; i < max; i++) {
            const p = pList[i];
            const s = sList[i];

            let type = 'exact';
            if (!p) type = 'additional_in_secondary';
            else if (!s) type = 'missing_in_secondary';
            else {
                // Si el nombre base es diferente pero están en el mismo grupo, es un "complementario"
                const isExactName = p.name.trim().toUpperCase() === s.name.trim().toUpperCase();
                const cmykMatch = p.cmyk.every((v, idx) => Math.abs(v - s.cmyk[idx]) < 0.0001);
                
                if (!isExactName || !cmykMatch) type = 'different';
            }

            results.push({
                matchType: type,
                primaryData: p,
                secondaryData: s,
                isDuplicate: (p && pList.length > 1) || (s && sList.length > 1)
            });
        }
    });

    return results;
}