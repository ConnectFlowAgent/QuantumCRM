document.addEventListener('DOMContentLoaded', () => {
    // --- Autenticación Global (JWT Interceptor) ---
    const token = localStorage.getItem('quantum_token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    const originalFetch = window.fetch;
    window.fetch = async function() {
        let [resource, config] = arguments;
        if(typeof resource === 'string' && resource.startsWith('/api') && !resource.startsWith('/api/auth')) {
            if(!config) config = {};
            if(!config.headers) config.headers = {};
            config.headers['Authorization'] = `Bearer ${localStorage.getItem('quantum_token')}`;
        }
        const response = await originalFetch(resource, config);
        if(response.status === 401) {
            localStorage.removeItem('quantum_token');
            window.location.href = '/login.html';
        }
        return response;
    };
    
    // --- Navigation ---
    const navDashboard = document.getElementById('nav-dashboard');
    const navInbox = document.getElementById('nav-inbox');
    const navCampaigns = document.getElementById('nav-campaigns');
    const navLogs = document.getElementById('nav-logs');
    const navSettings = document.getElementById('nav-settings');
    const navItems = [navDashboard, navInbox, navCampaigns, navLogs, navSettings];

    const viewDashboard = document.getElementById('view-dashboard');
    const viewInbox = document.getElementById('view-inbox');
    const viewCampaigns = document.getElementById('view-campaigns');
    const viewLogs = document.getElementById('view-logs');
    const viewSettings = document.getElementById('view-settings');
    const views = [viewDashboard, viewInbox, viewCampaigns, viewLogs, viewSettings];

    const switchView = (activeNav, activeView) => {
        navItems.forEach(n => n.classList.remove('active'));
        if(activeNav) activeNav.classList.add('active');
        
        views.forEach(v => v.classList.remove('active-view'));
        // Pequeño retardo para animación
        setTimeout(() => {
            if(activeView) activeView.classList.add('active-view');
        }, 50);
    };

    navDashboard.addEventListener('click', () => switchView(navDashboard, viewDashboard));
    navInbox.addEventListener('click', () => {
        switchView(navInbox, viewInbox);
        loadLeads(); // Cargar inbox al entrar
    });
    navCampaigns.addEventListener('click', () => {
        switchView(navCampaigns, viewCampaigns);
        loadCampaigns();
    });
    navLogs.addEventListener('click', () => {
        switchView(navLogs, viewLogs);
        window.loadLogs();
    });
    navSettings.addEventListener('click', () => {
        switchView(navSettings, viewSettings);
        loadSettings();
    });

    // --- Dashboard logic ---
    const loadDashboardMetrics = async () => {
        try {
            const [tfrRes, convRes, billingRes] = await Promise.all([
                fetch('/api/analytics/tfr'),
                fetch('/api/analytics/conversion'),
                fetch('/api/analytics/billing')
            ]);
            
            const tfrData = await tfrRes.json();
            const convData = await convRes.json();
            const billingData = await billingRes.json();

            if (tfrData.success && tfrData.data) {
                document.getElementById('val-tfr').innerText = tfrData.data.avg_tfr_formatted 
                    ? tfrData.data.avg_tfr_formatted.split('.')[0] // Quitar milisegundos si vienen
                    : 'N/A';
            }
            
            if (convData.success && convData.data) {
                document.getElementById('val-conversion').innerText = `${convData.data.conversion_rate_percent}%`;
            }

            if (billingData.success && billingData.data) {
                document.getElementById('val-billing').innerText = `$${billingData.data.total_cost}`;
                const bd = billingData.data.breakdown;
                document.getElementById('val-billing-breakdown').innerText = 
                    `Entrada: ${bd.inbound_qty} | Bot: ${bd.bot_qty} | Plantillas: ${bd.template_qty}`;
            }
        } catch (err) {
            console.error('Error cargando métricas:', err);
        }
    };

    // --- Inbox Logic ---
    let currentSelectedLeadId = null;

    const loadLeads = async () => {
        const container = document.getElementById('leads-list-container');
        try {
            const res = await fetch('/api/leads');
            const result = await res.json();

            if (result.success) {
                container.innerHTML = '';
                
                if (result.data.length === 0) {
                    container.innerHTML = `<div class="empty-state">No hay leads todavía.</div>`;
                    return;
                }

                result.data.forEach(lead => {
                    const li = document.createElement('li');
                    li.className = 'lead-item';
                    
                    // Formatear status de visualización
                    let badgeClass = 'status-new';
                    if (lead.is_paused || lead.funnel_status === 'HANDOFF') badgeClass = 'status-handoff';
                    else if (lead.funnel_status === 'CLOSED_WON') badgeClass = 'status-closed_won';
                    else if (lead.funnel_status.includes('QUALIFY')) badgeClass = 'status-qualifying';

                    const statusTexto = lead.is_paused ? 'HANDOFF REQUERIDO' : lead.funnel_status;

                    li.innerHTML = `
                        <div class="lead-header">
                            <span class="lead-name">${lead.name || 'Desconocido'}</span>
                            <span class="status-badge ${badgeClass}">${statusTexto}</span>
                        </div>
                        <span class="lead-phone">${lead.phone_number}</span>
                    `;

                    li.addEventListener('click', () => {
                        // Limpiar estilos previos
                        document.querySelectorAll('.lead-item').forEach(el => el.classList.remove('active-lead'));
                        li.classList.add('active-lead');
                        
                        // Actualizar vista de chat
                        document.querySelector('#chat-header h3').innerText = lead.name || lead.phone_number;
                        const badge = document.querySelector('#chat-header .status-badge');
                        badge.style.display = 'inline-block';
                        badge.className = `status-badge ${badgeClass}`;
                        badge.innerText = statusTexto;

                        loadChatHistory(lead.id);
                    });

                    container.appendChild(li);
                });
            }
        } catch (err) {
            container.innerHTML = `<div class="empty-state">Error de conexión.</div>`;
            console.error(err);
        }
    };

    const loadChatHistory = async (leadId) => {
        currentSelectedLeadId = leadId;
        const container = document.getElementById('chat-history-container');
        container.innerHTML = `<div class="loading-state">Cargando historial...</div>`;

        try {
            const res = await fetch(`/api/conversations/${leadId}`);
            const result = await res.json();

            if (result.success) {
                container.innerHTML = '';
                
                if (result.data.length === 0) {
                    container.innerHTML = `<div class="empty-state">Sin mensajes registrados.</div>`;
                    return;
                }

                result.data.forEach(msg => {
                    const div = document.createElement('div');
                    const isOutbound = msg.direction === 'OUTBOUND';
                    div.className = `msg-bubble ${isOutbound ? 'msg-outbound' : 'msg-inbound'}`;
                    
                    const timeStr = new Date(msg.sent_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    
                    div.innerHTML = `
                        ${msg.content || '<em>[Media/Interactivos]</em>'}
                        <span class="msg-time">${timeStr}</span>
                    `;
                    container.appendChild(div);
                });

                // Auto-scroll al final
                container.scrollTop = container.scrollHeight;
            }
        } catch (err) {
            container.innerHTML = `<div class="empty-state">Error cargando chat.</div>`;
            console.error(err);
        }
    };

    // --- Campaigns Logic ---
    const loadCampaigns = async () => {
        const container = document.getElementById('campaigns-grid');
        container.innerHTML = `<div class="loading-state">Cargando plantillas...</div>`;
        
        try {
            const res = await fetch('/api/templates');
            const result = await res.json();
            
            if (result.success) {
                container.innerHTML = '';
                
                result.data.forEach(tpl => {
                    const card = document.createElement('div');
                    card.className = 'campaign-card glass';
                    
                    const timeStr = new Date(tpl.updated_at).toLocaleString();

                    card.innerHTML = `
                        <div class="campaign-header">
                            <h3>Nodo: ${tpl.node_name}</h3>
                            <p>Última act: ${timeStr}</p>
                        </div>
                        <textarea class="campaign-textarea" id="tpl-${tpl.node_name}">${tpl.content}</textarea>
                        <button class="btn-campaign-save" onclick="saveTemplate('${tpl.node_name}')">Guardar Copy</button>
                    `;
                    container.appendChild(card);
                });
            }
        } catch (err) {
            container.innerHTML = `<div class="empty-state">Error al cargar listado de copys.</div>`;
            console.error(err);
        }
    };

    // Hacer global la funcion de save para que el onclick funcione
    window.saveTemplate = async (nodeName) => {
        const val = document.getElementById(`tpl-${nodeName}`).value;
        const btn = document.querySelector(`button[onclick="saveTemplate('${nodeName}')"]`);
        btn.innerText = 'Guardando...';
        
        try {
            const res = await fetch(`/api/templates/${nodeName}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: val })
            });
            const result = await res.json();
            
            if (result.success) {
                btn.style.background = 'var(--success)';
                btn.innerText = '¡Guardado!';
                setTimeout(() => {
                    btn.style.background = '';
                    btn.innerText = 'Guardar Copy';
                }, 2000);
            } else {
                throw new Error("Failed");
            }
        } catch (err) {
            console.error(err);
            btn.style.background = 'var(--danger)';
            btn.innerText = 'Error';
        }
    };

    // --- Logs / Debug Logic ---
    window.loadLogs = async () => {
        const container = document.getElementById('logs-container');
        container.innerHTML = `<div class="loading-state" style="color:var(--success);">Obteniendo logs de la RAM (Redis)...</div>`;
        try {
            const res = await fetch('/api/logs');
            const result = await res.json();
            if (result.success) {
                container.innerHTML = '';
                if(result.data.length === 0) {
                    container.innerHTML = `<div style="color:var(--success);">[OK] Terminal vacía. Ningún evento reciente.</div>`;
                    return;
                }
                
                result.data.forEach(log => {
                    const row = document.createElement('div');
                    row.className = 'log-row';
                    
                    const time = new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
                    
                    let levelStr = log.level;
                    if(levelStr === 'ERROR') {
                        levelStr = `<span style="color:var(--danger)">[ERROR]</span>`;
                    } else if(levelStr === 'WARN') {
                        levelStr = `<span style="color:orange">[WARN]</span>`;
                    } else {
                        levelStr = `<span style="color:var(--primary)">[INFO]</span>`;
                    }

                    row.innerHTML = `<span style="color: #6c7293;">[${time}]</span> ${levelStr} <span>${log.message}</span>`;
                    container.appendChild(row);
                });
            }
        } catch (err) {
            container.innerHTML = `<div style="color:var(--danger)">[SYS_ERROR] No se pudo leer la terminal.</div>`;
        }
    };

    // --- Settings Logic ---
    const loadSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const result = await res.json();
            if (result.success && result.data) {
                document.getElementById('cfg-verify-token').value = result.data.whatsapp_verify_token || '';
                document.getElementById('cfg-access-token').value = result.data.whatsapp_access_token || '';
                document.getElementById('cfg-phone-id').value = result.data.phone_number_id || '';
                document.getElementById('cfg-smtp-host').value = result.data.smtp_host || '';
                document.getElementById('cfg-smtp-user').value = result.data.smtp_user || '';
                document.getElementById('cfg-smtp-pass').value = result.data.smtp_pass || '';
                document.getElementById('cfg-openai-key').value = result.data.openai_api_key || '';
                document.getElementById('cfg-openai-prompt').value = result.data.openai_system_prompt || '';
                document.getElementById('cfg-cost-inbound').value = result.data.cost_per_inbound || '0';
                document.getElementById('cfg-cost-bot').value = result.data.cost_per_bot_outbound || '0.005';
                document.getElementById('cfg-cost-template').value = result.data.cost_per_template_outbound || '0.04';
            }
        } catch (err) {
            console.error('Error cargando configuración:', err);
        }
    };

    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertBox = document.getElementById('settings-alert');
        alertBox.className = 'alert-message';
        alertBox.innerText = 'Guardando...';
        alertBox.style.display = 'block';

        const payload = {
            whatsapp_verify_token: document.getElementById('cfg-verify-token').value,
            whatsapp_access_token: document.getElementById('cfg-access-token').value,
            phone_number_id: document.getElementById('cfg-phone-id').value,
            smtp_host: document.getElementById('cfg-smtp-host').value,
            smtp_user: document.getElementById('cfg-smtp-user').value,
            smtp_pass: document.getElementById('cfg-smtp-pass').value,
            openai_api_key: document.getElementById('cfg-openai-key').value,
            openai_system_prompt: document.getElementById('cfg-openai-prompt').value,
            cost_per_inbound: document.getElementById('cfg-cost-inbound').value,
            cost_per_bot_outbound: document.getElementById('cfg-cost-bot').value,
            cost_per_template_outbound: document.getElementById('cfg-cost-template').value
        };

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            
            if (result.success) {
                alertBox.classList.add('alert-success');
                alertBox.innerText = 'Configuración guardada. Activa instantáneamente en la base de datos.';
            } else {
                throw new Error(result.message);
            }
        } catch (err) {
            alertBox.classList.add('alert-error');
            alertBox.innerText = 'Error guardando configuración.';
            console.error(err);
        }
        
        setTimeout(() => { alertBox.style.display = 'none'; }, 4000);
    });

    // Inicializar dashboard al arranque
    loadDashboardMetrics();
    
    // Opcional: Refresco de métricas cada 30 seg
    setInterval(loadDashboardMetrics, 30000);

    // --- WhatsApp Connect Panel ---

    // Helper: actualiza el badge de estado del panel
    const setWCStatus = (state, label) => {
        const badge = document.getElementById('wc-status-badge');
        const dot = document.getElementById('wc-status-dot');
        const labelEl = document.getElementById('wc-status-label');
        badge.className = 'wc-status-badge';
        if (state) badge.classList.add(`status-${state}`);
        if (labelEl) labelEl.textContent = label;
    };

    // Toggle visibilidad del token
    window.toggleVisibility = (inputId, btnId) => {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(btnId);
        if (!input) return;
        if (input.type === 'password') {
            input.type = 'text';
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
        } else {
            input.type = 'password';
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
        }
    };

    // Función principal: probar conexión WhatsApp
    window.testWhatsAppConnection = async () => {
        const accessToken = document.getElementById('wc-access-token').value.trim();
        const phoneId = document.getElementById('wc-phone-id').value.trim();
        const btn = document.getElementById('btn-connect-now');
        const resultBox = document.getElementById('wc-result-box');

        if (!accessToken || !phoneId) {
            resultBox.className = 'wc-result-box result-err';
            resultBox.style.display = 'block';
            resultBox.textContent = '⚠️ Ingresa el Access Token y el Phone Number ID antes de conectar.';
            setWCStatus('failed', 'Datos incompletos');
            return;
        }

        // Estado: verificando
        btn.disabled = true;
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Verificando...`;
        setWCStatus('checking', 'Verificando...');
        resultBox.className = 'wc-result-box';
        resultBox.style.display = 'none';

        try {
            const res = await fetch('/api/whatsapp/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone_number_id: phoneId, access_token: accessToken })
            });
            const data = await res.json();

            resultBox.style.display = 'block';
            if (data.success) {
                setWCStatus('connected', '● Conectado');
                resultBox.className = 'wc-result-box result-ok';
                const d = data.details;
                resultBox.innerHTML = `
                    <strong>${data.message}</strong><br>
                    <small>📞 Número: <b>${d.phone}</b> &nbsp;|&nbsp; 🏷️ Nombre: <b>${d.name}</b> &nbsp;|&nbsp; ⭐ Calidad: <b>${d.quality}</b></small>
                `;
                // Auto-rellenar los campos del formulario de configuración
                document.getElementById('cfg-access-token').value = accessToken;
                document.getElementById('cfg-phone-id').value = phoneId;
            } else {
                setWCStatus('failed', '✕ Error');
                resultBox.className = 'wc-result-box result-err';
                resultBox.textContent = data.message;
            }
        } catch (err) {
            setWCStatus('failed', '✕ Sin conexión');
            resultBox.className = 'wc-result-box result-err';
            resultBox.style.display = 'block';
            resultBox.textContent = '❌ Error de red. ¿Está el servidor corriendo?';
        }

        // Restaurar botón
        btn.disabled = false;
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Conectar Ahora`;
    };
});
