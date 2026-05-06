// js/views/adminView.js
import { Auth, ALL_PERMISSIONS } from '../core/auth.js';
import { supabase } from '../core/supabaseClient.js';

export class AdminView {
    constructor(app, auth) {
        this.app = app;
        this.auth = auth;
        this.currentUser = null;
        window.adminView = this;
        
        // Mapeo de nombres amigables para permisos
        this.permissionNames = {
            comparator: 'Comparar Archivos',
            history: 'Bandeja de Entrada',
            paletteValidator: 'Validar Paletas',
            development: 'Sección Desarrollo',
            assignment: 'Asignación Órdenes',
            reports: 'Reportes de Prod.',
            dashboard: 'Dashboard General',
            backup: 'Gestión de Backups',
            admin: 'Panel Administrador',
            editCatalog: 'Editar Catálogos',
            linearization: 'Linealización'
        };

        this.init();
    }
    
    async init() {
        this.currentUser = this.auth.getCurrentUser();
        if (!this.currentUser || (!this.currentUser.isMaster && !this.currentUser.permissions?.includes('admin'))) {
            console.warn('⚠️ Usuario sin permisos de administrador');
            return;
        }
        this.render();
        this.attachEvents();
    }
    
    async render() {
        await this.renderUsers();
    }

    attachEvents() {
        const btnAdd = document.getElementById('btnAddUser');
        if (btnAdd) {
            btnAdd.onclick = () => this.showUserModal();
        }
    }

    async renderUsers() {
        const tableBody = document.getElementById('adminTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:3rem;"><i class="fas fa-spinner fa-spin fa-2x" style="color:#3b82f6;"></i><br><span style="margin-top:10px; display:block; color:#94a3b8;">Cargando usuarios...</span></td></tr>';
        
        try {
            const { data: users, error } = await supabase
                .from('usuarios')
                .select('*')
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            
            tableBody.innerHTML = users.map(user => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                    <td style="padding:1.2rem;">
                        <div style="font-weight:bold; color:white; font-size:1rem; display:flex; align-items:center; gap:8px;">
                            ${user.username}
                        </div>
                        <div style="font-size:0.7rem; color:#64748b; margin-top:4px;">ID: ${user.id}</div>
                    </td>
                    <td style="padding:1.2rem; text-align:center;">
                        <span style="background:${user.is_master ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(59,130,246,0.15)'}; 
                                     color:${user.is_master ? 'white' : '#3b82f6'}; 
                                     padding:5px 12px; border-radius:8px; font-size:0.7rem; font-weight:900; 
                                     border:1px solid ${user.is_master ? '#f59e0b' : 'rgba(59,130,246,0.3)'};">
                            <i class="fas ${user.is_master ? 'fa-crown' : 'fa-user'}"></i> ${user.is_master ? 'MASTER' : 'USUARIO'}
                        </span>
                    </td>
                    <td style="padding:1.2rem;">
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${user.is_master ? 
                                '<span style="background:rgba(245,158,11,0.1); color:#f59e0b; font-size:0.65rem; font-weight:700; padding:4px 10px; border-radius:6px; border:1px solid rgba(245,158,11,0.2);">ACCESO TOTAL</span>' : 
                                (user.permissions || [])
                                    .map(p => `<span style="font-size:0.65rem; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#94a3b8; padding:3px 8px; border-radius:5px;">${this.permissionNames[p] || p}</span>`)
                                    .join('') || '<span style="color:#475569; font-size:0.75rem; font-style:italic;">Sin permisos</span>'
                            }
                        </div>
                    </td>
                    <td style="padding:1.2rem; text-align:right;">
                        <div style="display:flex; gap:10px; justify-content:flex-end;">
                            <button onclick="window.adminView.showUserModal('${user.id}')" 
                                    style="background:rgba(59,130,246,0.1); border:1px solid #3b82f6; color:#3b82f6; width:36px; height:36px; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" 
                                    title="Editar" onmouseover="this.style.background='#3b82f6'; this.style.color='white';" onmouseout="this.style.background='rgba(59,130,246,0.1)'; this.style.color='#3b82f6';">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${!user.is_master ? `
                                <button onclick="window.adminView.deleteUser('${user.id}')" 
                                        style="background:rgba(239,68,68,0.1); border:1px solid #ef4444; color:#ef4444; width:36px; height:36px; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" 
                                        title="Eliminar" onmouseover="this.style.background='#ef4444'; this.style.color='white';" onmouseout="this.style.background='rgba(239,68,68,0.1)'; this.style.color='#ef4444';">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `).join('');
            
        } catch (err) {
            console.error('Error renderUsers:', err);
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#ef4444; padding:3rem;">Error al cargar usuarios.</td></tr>';
        }
    }

    async showUserModal(userId = null) {
        let user = { username: '', password: '', is_master: false, permissions: [] };
        
        if (userId) {
            const { data, error } = await supabase.from('usuarios').select('*').eq('id', userId).single();
            if (!error && data) {
                user = { ...data, permissions: data.permissions || [] };
            }
        }

        const isEditingMaster = user.is_master;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '10005';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 550px; width: 95%; background: #0f172a; border: 2px solid ${isEditingMaster ? '#f59e0b' : '#3b82f6'}; border-radius: 20px; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.8);">
                <div class="modal-header" style="background: ${isEditingMaster ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)'}; padding: 1.5rem; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="color: white; margin: 0; font-size: 1.3rem; display:flex; align-items:center; gap:10px;">
                        ${userId ? (isEditingMaster ? '<i class="fas fa-crown"></i> Perfil MASTER' : '<i class="fas fa-user-edit"></i> Editar Usuario') : '<i class="fas fa-user-plus"></i> Nuevo Usuario'}
                    </h3>
                    <button class="modal-close" style="background:transparent; border:none; color:white; font-size:1.5rem; cursor:pointer;">&times;</button>
                </div>
                
                <div class="modal-body" style="padding: 2rem;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:2rem;">
                        <div class="form-group">
                            <label style="display:block; color:#94a3b8; font-size:0.75rem; font-weight:bold; margin-bottom:8px; text-transform:uppercase;">Nombre de Usuario</label>
                            <input type="text" id="editUsername" value="${user.username}" ${userId ? 'disabled' : ''} 
                                   style="width:100%; background:#1e293b; border:1px solid #334155; color:white; padding:12px; border-radius:10px; box-sizing:border-box; font-weight:bold; ${userId ? 'opacity:0.6;' : ''}">
                        </div>
                        <div class="form-group">
                            <label style="display:block; color:#94a3b8; font-size:0.75rem; font-weight:bold; margin-bottom:8px; text-transform:uppercase;">
                                ${userId ? 'Contraseña Actual/Nueva' : 'Contraseña'}
                            </label>
                            <div style="position:relative;">
                                <input type="password" id="editPassword" value="${user.password || ''}" placeholder="${userId ? 'Dejar en blanco para no cambiar' : 'Mínimo 6 caracteres'}" 
                                       style="width:100%; background:#1e293b; border:1px solid #334155; color:white; padding:12px; padding-right:45px; border-radius:10px; box-sizing:border-box;">
                                <i class="fas fa-eye-slash toggle-password-btn" style="position:absolute; right:15px; top:14px; color:#64748b; cursor:pointer; font-size:1.1rem;" title="Ver/Ocultar Contraseña"></i>
                            </div>
                        </div>
                    </div>

                    <div style="margin-top:1rem;">
                        <h4 style="color:#3b82f6; font-size:0.85rem; font-weight:900; margin-bottom:1rem; display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-key"></i> PERMISOS DE ACCESO AL SISTEMA
                        </h4>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; background:rgba(30,41,59,0.5); padding:1.5rem; border-radius:15px; border:1px solid rgba(255,255,255,0.05);">
                            ${Object.entries(this.permissionNames).map(([key, label]) => `
                                <label style="display:flex; align-items:center; gap:10px; color:#e2e8f0; font-size:0.85rem; cursor:pointer; padding:5px; border-radius:5px; transition:all 0.2s;">
                                    <input type="checkbox" class="perm-check" value="${key}" ${user.permissions.includes(key) ? 'checked' : ''}>
                                    ${label}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <div class="modal-footer" style="padding:1.5rem 2rem; background:rgba(30,41,59,0.3); display:flex; gap:1rem; justify-content:flex-end; border-top:1px solid rgba(255,255,255,0.05);">
                    <button class="modal-cancel" style="background:transparent; border:1px solid #475569; color:#94a3b8; padding:10px 25px; border-radius:10px; cursor:pointer; font-weight:bold;">Cancelar</button>
                    <button id="btnSaveUser" style="background:${user.is_master ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)'}; border:none; padding:10px 30px; border-radius:10px; cursor:pointer; color:white; font-weight:bold; box-shadow:0 10px 15px -3px rgba(0,0,0,0.3);">${userId ? 'Guardar Cambios' : 'Crear Usuario'}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Toggle password visibility
        const passInput = modal.querySelector('#editPassword');
        const toggleBtn = modal.querySelector('.toggle-password-btn');
        toggleBtn.onclick = () => {
            const isPass = passInput.type === 'password';
            passInput.type = isPass ? 'text' : 'password';
            toggleBtn.classList.toggle('fa-eye', isPass);
            toggleBtn.classList.toggle('fa-eye-slash', !isPass);
        };

        modal.querySelector('.modal-close').onclick = () => modal.remove();
        modal.querySelector('.modal-cancel').onclick = () => modal.remove();
        
        modal.querySelector('#btnSaveUser').onclick = async () => {
            const username = document.getElementById('editUsername').value.trim();
            const password = document.getElementById('editPassword').value.trim();
            const isMaster = user.is_master; // Mantiene el estatus MASTER original sin permitir escalamiento
            const permissions = Array.from(modal.querySelectorAll('.perm-check:checked')).map(cb => cb.value);
            
            if (!username) { alert('El nombre es obligatorio.'); return; }
            
            const btn = modal.querySelector('#btnSaveUser');
            btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
            
            try {
                if (userId) {
                    const updateData = { username, permissions, is_master: isMaster };
                    if (password && password !== '********') updateData.password = password;
                    
                    const { error } = await supabase.from('usuarios').update(updateData).eq('id', userId);
                    if (error) throw error;
                } else {
                    if (!password) { alert('La contraseña es obligatoria.'); btn.disabled = false; return; }
                    const { error } = await supabase.from('usuarios').insert([{ username, password, permissions, is_master: isMaster }]);
                    if (error) throw error;
                }
                
                modal.remove();
                this.renderUsers();
                window.showNotification?.('Éxito', `Usuario ${username} actualizado correctamente.`, 'success');
            } catch (err) {
                alert('Error al guardar: ' + err.message);
                btn.disabled = false; btn.innerText = 'Guardar';
            }
        };
    }

    async deleteUser(userId) {
        if (!confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')) return;
        
        try {
            const { error } = await supabase.from('usuarios').delete().eq('id', userId);
            if (error) throw error;
            this.renderUsers();
            window.showNotification?.('Usuario Eliminado', 'El acceso ha sido revocado permanentemente.', 'info');
        } catch (err) {
            alert('Error al eliminar: ' + err.message);
        }
    }
}