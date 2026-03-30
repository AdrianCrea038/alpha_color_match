// ============================================================
// EPS VIEW - Exportar colores pendientes a EPS
// Tipografía Arial Bold 16pt
// ============================================================

export class EPSView {
    constructor(app) {
        this.app = app;
        this.previewContainer = null;
        this.exportBtn = null;
        this.refreshBtn = null;
        
        this.init();
    }
    
    init() {
        this.previewContainer = document.getElementById('epsPreviewContainer');
        this.exportBtn = document.getElementById('exportEpsBtn');
        this.refreshBtn = document.getElementById('refreshEpsPreviewBtn');
        
        if (this.exportBtn) {
            this.exportBtn.onclick = () => this.exportEPS();
        }
        
        if (this.refreshBtn) {
            this.refreshBtn.onclick = () => this.renderPreview();
        }
        
        document.addEventListener('colorStatusChanged', () => {
            this.renderPreview();
        });
        
        this.renderPreview();
    }
    
    getPendingColorsFromCreator() {
        if (this.app && this.app.creatorView && this.app.creatorView.getPendingColors) {
            return this.app.creatorView.getPendingColors();
        }
        return [];
    }
    
    getPendingColorsSorted() {
        const pendingColors = this.getPendingColorsFromCreator();
        return [...pendingColors].sort((a, b) => a.lab.l - b.lab.l);
    }
    
    cmykToRgb(c, m, y, k) {
        const r = 255 * (1 - c / 100) * (1 - k / 100);
        const g = 255 * (1 - m / 100) * (1 - k / 100);
        const b = 255 * (1 - y / 100) * (1 - k / 100);
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }
    
    renderPreview() {
        if (!this.previewContainer) return;
        
        const colors = this.getPendingColorsSorted();
        const plotterValue = this.app && this.app.creatorView ? this.app.creatorView.getGlobalPlotter() : 14;
        
        if (colors.length === 0) {
            this.previewContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎨</div>
                    <p>No hay colores pendientes para mostrar</p>
                </div>
            `;
            return;
        }
        
        const boxSize = 100;
        const margin = 5;
        const maxCols = 5;
        
        this.previewContainer.style.display = 'flex';
        this.previewContainer.style.flexDirection = 'column';
        this.previewContainer.style.gap = `${margin}px`;
        
        const rows = [];
        for (let i = 0; i < colors.length; i += maxCols) {
            rows.push(colors.slice(i, i + maxCols));
        }
        
        this.previewContainer.innerHTML = rows.map(row => {
            return `
                <div style="display: flex; gap: ${margin}px; justify-content: flex-start;">
                    ${row.map(color => {
                        const rgb = this.cmykToRgb(color.cmyk.c, color.cmyk.m, color.cmyk.y, color.cmyk.k);
                        const spotName = `${color.name} ${color.nk}`.toUpperCase();
                        
                        return `
                            <div class="eps-preview-box" style="
                                width: ${boxSize}px;
                                height: ${boxSize}px;
                                background: ${rgb};
                                border: 1px solid #4b5563;
                                border-radius: 4px;
                                font-family: monospace;
                                font-size: 9px;
                                color: white;
                                text-shadow: 0 0 2px black;
                                overflow: hidden;
                                display: flex;
                                flex-direction: column;
                                justify-content: space-between;
                                padding: 4px;
                            ">
                                <div style="text-align: left;">Plotter: ${plotterValue}</div>
                                <div style="text-align: right;">
                                    C:${color.cmyk.c.toFixed(0)}<br>
                                    M:${color.cmyk.m.toFixed(0)}<br>
                                    Y:${color.cmyk.y.toFixed(0)}<br>
                                    K:${color.cmyk.k.toFixed(0)}
                                </div>
                                <div style="text-align: left;">${this.escapeHtml(spotName)}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }).join('');
        
        const statsDiv = document.getElementById('epsStats');
        if (statsDiv) {
            statsDiv.innerHTML = `
                <strong>📊 Resumen:</strong> ${colors.length} colores pendientes | Plotter: ${plotterValue}
            `;
        }
    }
    
    generateEPSContent() {
        const colors = this.getPendingColorsSorted();
        const plotterValue = this.app && this.app.creatorView ? this.app.creatorView.getGlobalPlotter() : 14;
        
        if (colors.length === 0) {
            return null;
        }
        
        const CM_TO_PT = 28.3465;
        const BOX_SIZE_CM = 10;
        const MARGIN_CM = 0.5;
        const SPACE_CM = 0.5;
        const MAX_COLS = 5;
        
        const boxSize = Math.round(BOX_SIZE_CM * CM_TO_PT);
        const margin = Math.round(MARGIN_CM * CM_TO_PT / 2);
        const space = Math.round(SPACE_CM * CM_TO_PT);
        
        const cols = Math.min(colors.length, MAX_COLS);
        const rows = Math.ceil(colors.length / MAX_COLS);
        
        const totalWidth = (margin * 2) + (cols * boxSize) + ((cols - 1) * space);
        const totalHeight = (margin * 2) + (rows * boxSize) + ((rows - 1) * space);
        
        let eps = `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 ${totalWidth} ${totalHeight}
%%DocumentCustomColors:`;
        
        for (let i = 0; i < colors.length; i++) {
            const color = colors[i];
            const spotName = `${color.name} ${color.nk}`.toUpperCase();
            eps += ` (${this.escapePS(spotName)})`;
        }
        
        eps += `\n`;
        
        for (let i = 0; i < colors.length; i++) {
            const color = colors[i];
            const spotName = `${color.name} ${color.nk}`.toUpperCase();
            const c = (color.cmyk.c / 100).toFixed(6);
            const m = (color.cmyk.m / 100).toFixed(6);
            const y = (color.cmyk.y / 100).toFixed(6);
            const k = (color.cmyk.k / 100).toFixed(6);
            
            eps += `%%CMYKCustomColor: ${c} ${m} ${y} ${k} (${this.escapePS(spotName)})\n`;
        }
        
        eps += `%%EndComments

%%BeginPageSetup
<< /PageSize [${totalWidth} ${totalHeight}] >> setpagedevice
%%EndPageSetup

`;
        
        for (let i = 0; i < colors.length; i++) {
            const color = colors[i];
            const spotName = `${color.name} ${color.nk}`.toUpperCase();
            const c = (color.cmyk.c / 100).toFixed(6);
            const m = (color.cmyk.m / 100).toFixed(6);
            const y = (color.cmyk.y / 100).toFixed(6);
            const k = (color.cmyk.k / 100).toFixed(6);
            
            eps += `/SpotColor${i} {
    [/Separation (${this.escapePS(spotName)}) /DeviceCMYK {
        ${c} ${m} ${y} ${k}
    } ] setcolorspace
} def

`;
        }
        
        for (let i = 0; i < colors.length; i++) {
            const color = colors[i];
            const col = i % MAX_COLS;
            const row = Math.floor(i / MAX_COLS);
            
            const x = margin + col * (boxSize + space);
            const y = totalHeight - margin - (row + 1) * boxSize - row * space;
            
            const spotName = `${color.name} ${color.nk}`.toUpperCase();
            const cInt = Math.round(color.cmyk.c);
            const mInt = Math.round(color.cmyk.m);
            const yInt = Math.round(color.cmyk.y);
            const kInt = Math.round(color.cmyk.k);
            
            eps += `% Color ${i + 1}: ${spotName}
SpotColor${i}

newpath
${x} ${y} moveto
${boxSize} 0 rlineto
0 ${boxSize} rlineto
${-boxSize} 0 rlineto
closepath
fill

0 0 0 1 setcmykcolor
/Arial-Bold findfont 16 scalefont setfont
${x + 5} ${y + boxSize - 16} moveto (Plotter: ${plotterValue}) show

/Arial-Bold findfont 14 scalefont setfont
${x + 5} ${y + boxSize - 36} moveto (C:${cInt} M:${mInt} Y:${yInt} K:${kInt}) show
${x + 5} ${y + 16} moveto (${this.escapePS(spotName)}) show

`;
        }
        
        eps += `showpage
%%EOF`;
        
        return eps;
    }
    
    exportEPS() {
        const epsContent = this.generateEPSContent();
        
        if (!epsContent) {
            alert('⚠️ No hay colores pendientes para exportar a EPS.');
            return;
        }
        
        console.log('📄 EPS generado con', this.getPendingColorsSorted().length, 'colores');
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const fileName = `alpha_colors_${timestamp}.eps`;
        
        const blob = new Blob([epsContent], { type: 'application/postscript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        
        alert(`✅ Archivo EPS exportado con ${this.getPendingColorsSorted().length} colores.`);
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    
    escapePS(str) {
        if (!str) return '';
        return str.replace(/[()\\]/g, '\\$&');
    }
    
    refreshPreview() {
        this.renderPreview();
    }
}