/**
 * Módulo ColorMatcher - Comparación inteligente de colores estilo BUSCARV
 * Con más de 20 años de experiencia en sistemas de color, este módulo implementa
 * algoritmos profesionales de comparación y matching de colores
 */

export class ColorMatcher {
    constructor() {
        // Umbrales de tolerancia para comparaciones fuzzy
        this.tolerance = {
            cmyk: 5.0,      // Tolerancia para valores CMYK individuales
            euclidean: 8.0   // Tolerancia para distancia euclidiana
        };
    }

    /**
     * Comparación inteligente estilo BUSCARV
     * Busca coincidencias por múltiples criterios:
     * 1. Nombre normalizado
     * 2. ID correlativo
     * 3. Valores CMYK (fuzzy matching)
     * 4. Valores LAB (opcional)
     */
    smartCompare(primaryData, secondaryData) {
        const results = [];
        
        // Crear índice de búsqueda para datos primarios
        const primaryIndex = this.buildSearchIndex(primaryData);
        
        // Comparar cada registro secundario
        for (const secondary of secondaryData) {
            const comparison = this.compareSingleColor(secondary, primaryIndex, primaryData);
            results.push(comparison);
        }
        
        return results;
    }
    
    /**
     * Construye índice de búsqueda optimizado para datos primarios
     */
    buildSearchIndex(primaryData) {
        const index = {
            byNormalizedName: new Map(),
            byId: new Map(),
            byCmykHash: new Map(),
            all: primaryData
        };
        
        for (const item of primaryData) {
            // Índice por nombre normalizado
            const normalizedName = this.normalizeName(item.name);
            index.byNormalizedName.set(normalizedName, item);
            
            // Índice por ID
            index.byId.set(item.id, item);
            
            // Índice por hash CMYK (para búsqueda rápida)
            const cmykHash = this.getCmykHash(item.cmyk);
            if (!index.byCmykHash.has(cmykHash)) {
                index.byCmykHash.set(cmykHash, []);
            }
            index.byCmykHash.get(cmykHash).push(item);
        }
        
        return index;
    }
    
    /**
     * Compara un solo color contra el índice primario
     */
    compareSingleColor(secondary, primaryIndex, primaryData) {
        const normalizedName = this.normalizeName(secondary.name);
        
        // NIVEL 1: Búsqueda exacta por nombre normalizado
        let match = primaryIndex.byNormalizedName.get(normalizedName);
        
        // NIVEL 2: Búsqueda por ID
        if (!match) {
            match = primaryIndex.byId.get(secondary.id);
        }
        
        // NIVEL 3: Búsqueda fuzzy por valores CMYK
        if (!match) {
            match = this.fuzzySearchByCmyk(secondary.cmyk, primaryData);
        }
        
        // NIVEL 4: Búsqueda fuzzy por valores LAB
        if (!match && secondary.lab) {
            match = this.fuzzySearchByLab(secondary.lab, primaryData);
        }
        
        if (match) {
            // Calcular diferencias
            const differences = this.compareCmykValues(match.cmyk, secondary.cmyk);
            const hasDifferences = differences.some(d => Math.abs(d) > 0.01);
            const diffPercentage = this.calculateDifferencePercentage(match.cmyk, secondary.cmyk);
            
            if (hasDifferences) {
                return {
                    ...secondary,
                    status: 'diff',
                    matchFound: true,
                    matchType: this.getMatchType(match, secondary),
                    differences: differences,
                    diffPercentage: diffPercentage,
                    originalCMYK: match.cmyk,
                    originalLAB: match.lab,
                    originalName: match.name,
                    diffDetails: this.getDetailedDiff(match.cmyk, secondary.cmyk),
                    recommendation: this.getRecommendation(diffPercentage)
                };
            } else {
                return {
                    ...secondary,
                    status: 'match',
                    matchFound: true,
                    matchType: 'exact',
                    differences: [0, 0, 0, 0],
                    diffPercentage: 0
                };
            }
        }
        
        // No se encontró ninguna coincidencia
        return {
            ...secondary,
            status: 'missing',
            matchFound: false,
            matchType: 'none',
            recommendation: 'Agregar nuevo color a la referencia'
        };
    }
    
    /**
     * Normaliza el nombre del color para búsqueda insensible
     * Elimina caracteres especiales, convierte a minúsculas
     */
    normalizeName(name) {
        if (!name) return '';
        return name.toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .replace(/nk\d+/g, '') // Eliminar códigos NK para mejor matching
            .trim();
    }
    
    /**
     * Genera hash para valores CMYK (búsqueda rápida)
     */
    getCmykHash(cmyk) {
        if (!cmyk || cmyk.length < 4) return '';
        const rounded = cmyk.map(v => Math.round(v / 5) * 5);
        return rounded.join(',');
    }
    
    /**
     * Búsqueda fuzzy por valores CMYK
     * Calcula distancia euclidiana y encuentra el más cercano
     */
    fuzzySearchByCmyk(targetCmyk, dataset, threshold = 8.0) {
        let bestMatch = null;
        let smallestDistance = Infinity;
        
        for (const item of dataset) {
            if (!item.cmyk) continue;
            
            const distance = this.calculateEuclideanDistance(targetCmyk, item.cmyk);
            
            if (distance < smallestDistance && distance <= threshold) {
                smallestDistance = distance;
                bestMatch = item;
            }
        }
        
        return bestMatch;
    }
    
    /**
     * Búsqueda fuzzy por valores LAB
     */
    fuzzySearchByLab(targetLab, dataset, threshold = 15.0) {
        if (!targetLab || targetLab.length < 3) return null;
        
        let bestMatch = null;
        let smallestDistance = Infinity;
        
        for (const item of dataset) {
            if (!item.lab) continue;
            
            const distance = this.calculateEuclideanDistance(targetLab, item.lab);
            
            if (distance < smallestDistance && distance <= threshold) {
                smallestDistance = distance;
                bestMatch = item;
            }
        }
        
        return bestMatch;
    }
    
    /**
     * Compara dos valores CMYK y retorna las diferencias
     */
    compareCmykValues(cmyk1, cmyk2) {
        if (!cmyk1 || !cmyk2) return [0, 0, 0, 0];
        return cmyk1.map((val, idx) => {
            const diff = val - (cmyk2[idx] || 0);
            return parseFloat(diff.toFixed(4));
        });
    }
    
    /**
     * Calcula distancia euclidiana entre dos vectores CMYK
     */
    calculateEuclideanDistance(arr1, arr2) {
        if (!arr1 || !arr2) return Infinity;
        const sum = arr1.reduce((acc, val, i) => {
            const diff = val - (arr2[i] || 0);
            return acc + diff * diff;
        }, 0);
        return Math.sqrt(sum);
    }
    
    /**
     * Calcula el porcentaje de diferencia total
     */
    calculateDifferencePercentage(cmyk1, cmyk2) {
        if (!cmyk1 || !cmyk2) return 100;
        const totalDiff = cmyk1.reduce((sum, val, i) => {
            return sum + Math.abs(val - (cmyk2[i] || 0));
        }, 0);
        const maxPossible = 400; // 4 canales * 100%
        return (totalDiff / maxPossible) * 100;
    }
    
    /**
     * Obtiene detalles detallados de las diferencias
     */
    getDetailedDiff(cmyk1, cmyk2) {
        return {
            cyan: Math.abs(cmyk1[0] - cmyk2[0]).toFixed(2),
            magenta: Math.abs(cmyk1[1] - cmyk2[1]).toFixed(2),
            yellow: Math.abs(cmyk1[2] - cmyk2[2]).toFixed(2),
            black: Math.abs(cmyk1[3] - cmyk2[3]).toFixed(2),
            total: this.calculateDifferencePercentage(cmyk1, cmyk2).toFixed(2)
        };
    }
    
    /**
     * Determina el tipo de coincidencia encontrada
     */
    getMatchType(match, secondary) {
        if (this.normalizeName(match.name) === this.normalizeName(secondary.name)) {
            return 'name_match';
        }
        if (match.id === secondary.id) {
            return 'id_match';
        }
        if (this.calculateEuclideanDistance(match.cmyk, secondary.cmyk) < 3.0) {
            return 'cmyk_match';
        }
        if (match.lab && secondary.lab && 
            this.calculateEuclideanDistance(match.lab, secondary.lab) < 5.0) {
            return 'lab_match';
        }
        return 'fuzzy_match';
    }
    
    /**
     * Recomienda acción basada en el porcentaje de diferencia
     */
    getRecommendation(diffPercentage) {
        if (diffPercentage < 1) {
            return 'Coincidencia exacta - No requiere acción';
        } else if (diffPercentage < 5) {
            return 'Diferencia menor - Considere revisar si es intencional';
        } else if (diffPercentage < 15) {
            return 'Diferencia moderada - Recomendamos revisar y actualizar';
        } else {
            return 'Diferencia significativa - Se recomienda reemplazar el valor';
        }
    }
    
    /**
     * Obtiene estadísticas de la comparación
     */
    getComparisonStats(results) {
        const stats = {
            total: results.length,
            matches: 0,
            differences: 0,
            missing: 0,
            matchTypes: {
                name_match: 0,
                id_match: 0,
                cmyk_match: 0,
                lab_match: 0,
                fuzzy_match: 0
            },
            avgDifference: 0,
            maxDifference: 0
        };
        
        let totalDiff = 0;
        
        for (const result of results) {
            if (result.status === 'match') {
                stats.matches++;
            } else if (result.status === 'diff') {
                stats.differences++;
                if (result.diffPercentage) {
                    totalDiff += parseFloat(result.diffPercentage);
                    stats.maxDifference = Math.max(stats.maxDifference, parseFloat(result.diffPercentage));
                }
            } else if (result.status === 'missing') {
                stats.missing++;
            }
            
            if (result.matchType && stats.matchTypes[result.matchType] !== undefined) {
                stats.matchTypes[result.matchType]++;
            }
        }
        
        stats.avgDifference = stats.differences > 0 ? 
            (totalDiff / stats.differences).toFixed(2) : 0;
        
        return stats;
    }
    
    /**
     * Filtra resultados por criterios específicos
     */
    filterResults(results, filters) {
        let filtered = [...results];
        
        if (filters.status) {
            filtered = filtered.filter(r => r.status === filters.status);
        }
        
        if (filters.minDifference) {
            filtered = filtered.filter(r => 
                r.diffPercentage && parseFloat(r.diffPercentage) >= filters.minDifference
            );
        }
        
        if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            filtered = filtered.filter(r => 
                r.name.toLowerCase().includes(term) ||
                r.id.includes(term) ||
                (r.originalName && r.originalName.toLowerCase().includes(term))
            );
        }
        
        return filtered;
    }
    
    /**
     * Exporta resultados en formato estructurado
     */
    exportResults(results, format = 'json') {
        if (format === 'json') {
            return JSON.stringify({
                timestamp: new Date().toISOString(),
                total: results.length,
                stats: this.getComparisonStats(results),
                results: results
            }, null, 2);
        } else if (format === 'csv') {
            const headers = ['ID', 'Nombre', 'Status', 'Cian', 'Magenta', 'Yellow', 'Black', 'Diferencia%'];
            const rows = results.map(r => [
                r.id,
                `"${r.name}"`,
                r.status,
                r.cmyk[0].toFixed(2),
                r.cmyk[1].toFixed(2),
                r.cmyk[2].toFixed(2),
                r.cmyk[3].toFixed(2),
                r.diffPercentage || 'N/A'
            ]);
            return [headers, ...rows].map(row => row.join(',')).join('\n');
        }
        
        return null;
    }
    
    /**
     * Valida que los datos de color sean correctos
     */
    validateColorData(color) {
        const errors = [];
        
        if (!color.name || color.name.trim() === '') {
            errors.push('Nombre de color requerido');
        }
        
        if (!color.cmyk || color.cmyk.length !== 4) {
            errors.push('CMYK debe tener 4 valores');
        } else {
            const [c, m, y, k] = color.cmyk;
            if (c < 0 || c > 100) errors.push('Cian debe estar entre 0 y 100');
            if (m < 0 || m > 100) errors.push('Magenta debe estar entre 0 y 100');
            if (y < 0 || y > 100) errors.push('Yellow debe estar entre 0 y 100');
            if (k < 0 || k > 100) errors.push('Black debe estar entre 0 y 100');
        }
        
        if (color.lab && color.lab.length === 3) {
            const [l, a, b] = color.lab;
            if (l < 0 || l > 100) errors.push('L* debe estar entre 0 y 100');
            if (a < -128 || a > 127) errors.push('a* debe estar entre -128 y 127');
            if (b < -128 || b > 127) errors.push('b* debe estar entre -128 y 127');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Encuentra duplicados en un dataset
     */
    findDuplicates(data) {
        const seen = new Map();
        const duplicates = [];
        
        for (const item of data) {
            const normalizedName = this.normalizeName(item.name);
            if (seen.has(normalizedName)) {
                duplicates.push({
                    original: seen.get(normalizedName),
                    duplicate: item
                });
            } else {
                seen.set(normalizedName, item);
            }
        }
        
        return duplicates;
    }
}