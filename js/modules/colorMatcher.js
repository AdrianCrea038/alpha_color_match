/**
 * Módulo ColorMatcher - Comparación inteligente de colores
 * Versión mejorada: Solo comparación CMYK con ambas fórmulas visibles
 */

export class ColorMatcher {
    constructor() {
        this.tolerance = {
            cmyk: 5.0,
            euclidean: 8.0
        };
    }

    /**
     * Comparación inteligente - SOLO por valores CMYK
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
     * Construye índice de búsqueda optimizado
     */
    buildSearchIndex(primaryData) {
        const index = {
            byNormalizedName: new Map(),
            byId: new Map(),
            byCmykHash: new Map(),
            all: primaryData
        };
        
        for (const item of primaryData) {
            const normalizedName = this.normalizeName(item.name);
            index.byNormalizedName.set(normalizedName, item);
            index.byId.set(item.id, item);
            
            const cmykHash = this.getCmykHash(item.cmyk);
            if (!index.byCmykHash.has(cmykHash)) {
                index.byCmykHash.set(cmykHash, []);
            }
            index.byCmykHash.get(cmykHash).push(item);
        }
        
        return index;
    }
    
    /**
     * Compara un solo color - ENFOCADO EN CMYK
     */
    compareSingleColor(secondary, primaryIndex, primaryData) {
        const normalizedName = this.normalizeName(secondary.name);
        
        // Buscar coincidencia
        let match = primaryIndex.byNormalizedName.get(normalizedName);
        
        if (!match) {
            match = primaryIndex.byId.get(secondary.id);
        }
        
        if (!match) {
            match = this.fuzzySearchByCmyk(secondary.cmyk, primaryData);
        }
        
        if (match) {
            // Calcular diferencias CMYK
            const differences = this.compareCmykValues(match.cmyk, secondary.cmyk);
            const hasDifferences = differences.some(d => Math.abs(d) > 0.01);
            const diffPercentage = this.calculateDifferencePercentage(match.cmyk, secondary.cmyk);
            
            // Crear objeto con AMBAS fórmulas CMYK
            return {
                id: secondary.id,
                name: secondary.name,
                cmykPrimary: match.cmyk,      // CMYK del archivo principal
                cmykSecondary: secondary.cmyk, // CMYK del archivo secundario
                labPrimary: match.lab,
                labSecondary: secondary.lab,
                status: hasDifferences ? 'diff' : 'match',
                matchFound: true,
                matchType: this.getMatchType(match, secondary),
                differences: differences,
                diffPercentage: diffPercentage,
                originalName: match.name,
                diffDetails: this.getDetailedDiff(match.cmyk, secondary.cmyk),
                recommendation: this.getRecommendation(diffPercentage)
            };
        }
        
        // No se encontró ninguna coincidencia - INDICAR CLARAMENTE
        return {
            id: secondary.id,
            name: secondary.name,
            cmykSecondary: secondary.cmyk,
            labSecondary: secondary.lab,
            cmykPrimary: null,
            labPrimary: null,
            status: 'missing',
            matchFound: false,
            matchType: 'none',
            message: `❌ No se encontró el color "${secondary.name}" en el archivo principal`,
            recommendation: 'Agregar este color a la referencia principal'
        };
    }
    
    normalizeName(name) {
        if (!name) return '';
        return name.toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .replace(/nk\d+/gi, '')
            .trim();
    }
    
    getCmykHash(cmyk) {
        if (!cmyk || cmyk.length < 4) return '';
        const rounded = cmyk.map(v => Math.round(v / 5) * 5);
        return rounded.join(',');
    }
    
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
    
    compareCmykValues(cmyk1, cmyk2) {
        if (!cmyk1 || !cmyk2) return [0, 0, 0, 0];
        return cmyk1.map((val, idx) => {
            const diff = val - (cmyk2[idx] || 0);
            return parseFloat(diff.toFixed(4));
        });
    }
    
    calculateEuclideanDistance(arr1, arr2) {
        if (!arr1 || !arr2) return Infinity;
        const sum = arr1.reduce((acc, val, i) => {
            const diff = val - (arr2[i] || 0);
            return acc + diff * diff;
        }, 0);
        return Math.sqrt(sum);
    }
    
    calculateDifferencePercentage(cmyk1, cmyk2) {
        if (!cmyk1 || !cmyk2) return 100;
        const totalDiff = cmyk1.reduce((sum, val, i) => {
            return sum + Math.abs(val - (cmyk2[i] || 0));
        }, 0);
        const maxPossible = 400;
        return (totalDiff / maxPossible) * 100;
    }
    
    getDetailedDiff(cmyk1, cmyk2) {
        return {
            cyan: Math.abs(cmyk1[0] - cmyk2[0]).toFixed(2),
            magenta: Math.abs(cmyk1[1] - cmyk2[1]).toFixed(2),
            yellow: Math.abs(cmyk1[2] - cmyk2[2]).toFixed(2),
            black: Math.abs(cmyk1[3] - cmyk2[3]).toFixed(2),
            total: this.calculateDifferencePercentage(cmyk1, cmyk2).toFixed(2)
        };
    }
    
    getMatchType(match, secondary) {
        if (this.normalizeName(match.name) === this.normalizeName(secondary.name)) {
            return 'name_match';
        }
        if (match.id === secondary.id) {
            return 'id_match';
        }
        return 'cmyk_match';
    }
    
    getRecommendation(diffPercentage) {
        if (diffPercentage < 1) {
            return '✅ Coincidencia exacta - No requiere acción';
        } else if (diffPercentage < 5) {
            return '⚠️ Diferencia menor - Considere revisar si es intencional';
        } else if (diffPercentage < 15) {
            return '🔄 Diferencia moderada - Recomendamos actualizar';
        } else {
            return '❗ Diferencia significativa - Se recomienda reemplazar el valor';
        }
    }
    
    getComparisonStats(results) {
        const stats = {
            total: results.length,
            matches: 0,
            differences: 0,
            missing: 0,
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
        }
        
        stats.avgDifference = stats.differences > 0 ? 
            (totalDiff / stats.differences).toFixed(2) : 0;
        
        return stats;
    }
}
