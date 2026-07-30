/* ==========================================================================
   NEXUSFLOW - SISTEMA INTERNO DE ATENDIMENTO, DEMANDAS, CHAT & KPIS
   Motor de Triagem Inteligente, Multi-Papéis e Integração Google Drive
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const RENDER_PROD_URL = 'https://nexusflow-backend-u3ii.onrender.com';
  const BACKEND_URL = isLocal ? 'http://localhost:8081' : (window.NEXUSFLOW_BACKEND_URL || RENDER_PROD_URL);

  // ==========================================
  // ESTADO GLOBAL
  // ==========================================
  let state = {
    activeView: 'view-chat',
    activeContactId: 1,
    currentFilter: 'todos',
    searchQuery: '',
    theme: 'dark',
    userRole: 'relacionamento',
    backendConnected: false,

    contacts: [],
    messages: {},
    demands: [],
    gdriveFiles: []
  };

  // Dados fallback para quando o backend não responde
  const FALLBACK_DATA = {
    contacts: [
      { id: 1, name: 'Carlos Construtora S.A.', phone: '+55 11 98765-4321', avatar: 'CC', unread: 2, time: '12:45', lastMsg: 'Envei a medição da obra em PDF. Consegue revisar com urgência?', company: 'Carlos Construtora S.A.', isQueue: false },
      { id: 2, name: 'Dra. Mariana Costa', phone: '+55 21 99123-8877', avatar: 'MC', unread: 1, time: '11:20', lastMsg: 'O relatório financeiro de julho já foi emitido?', company: 'Advocacia Costa & Associados', isQueue: false },
      { id: 3, name: 'TechSolutions Brasil', phone: '+55 31 97766-5544', avatar: 'TS', unread: 0, time: 'Ontem', lastMsg: 'Tudo certo com a integração do webhook!', company: 'TechSolutions LTDA', isQueue: true }
    ],
    messages: {
      1: [
        { id: 101, type: 'incoming', sender: 'Carlos Construtora', text: 'Olá Pedro, boa tarde! Tudo bem?', time: '12:30' },
        { id: 102, type: 'outgoing', sender: 'Pedro Alves', text: 'Boa tarde, Carlos! Tudo ótimo. Como posso te ajudar?', time: '12:32' },
        { id: 103, type: 'incoming', sender: 'Carlos Construtora', text: 'Envei a medição da obra em PDF. Consegue revisar para liberar a fatura?', time: '12:45', file: { name: 'Medicao_Engenharia_Julho.pdf', size: '2.4 MB', isPdf: true } }
      ],
      2: [ { id: 201, type: 'incoming', sender: 'Dra. Mariana Costa', text: 'O relatório financeiro de julho já foi emitido?', time: '11:20' } ]
    },
    demands: [],
    gdriveFiles: []
  };

  // ==========================================
  // CONEXÃO COM BACKEND
  // ==========================================
  async function fetchState() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/state`);
      if (res.ok) {
        const data = await res.json();
        state.contacts = data.contacts || FALLBACK_DATA.contacts;
        state.messages = data.messages || FALLBACK_DATA.messages;
        state.demands = data.demands || [];
        state.gdriveFiles = data.gdriveFiles || [];
        renderAll();
      }
    } catch (e) {
      if (state.contacts.length === 0) {
        state.contacts = FALLBACK_DATA.contacts;
        state.messages = FALLBACK_DATA.messages;
        renderAll();
      }
    }
  }

  async function checkBackend() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/health`);
      if (res.ok) {
        state.backendConnected = true;
        updatePill(true);
        fetchState();
        return;
      }
    } catch (e) {}
    state.backendConnected = false;
    updatePill(false);
  }

  function updatePill(connected) {
    const pill = document.getElementById('backend-connection-pill');
    if (!pill) return;
    if (connected) {
      pill.style.cssText = 'background-color: rgba(139,92,246,0.15); color: #8b5cf6; border-color: rgba(139,92,246,0.3);';
      pill.innerHTML = '<span class="status-dot" style="background:#8b5cf6; box-shadow:0 0 8px #8b5cf6;"></span> Back-end API CONECTADO ⚡';
    } else {
      pill.style.cssText = 'background-color: rgba(244,63,94,0.15); color: #f43f5e;';
      pill.innerHTML = '<span class="status-dot" style="background:#f43f5e;"></span> Aguardando API...';
    }
  }

  checkBackend();
  setInterval(checkBackend, 6000);

  // ==========================================
  // ELEMENTOS DO DOM
  // ==========================================
  const navItems = document.querySelectorAll('.nav-item');
  const viewContainers = document.querySelectorAll('.view-container');
  const pageTitle = document.getElementById('current-view-title');
  const contactsListContainer = document.getElementById('contacts-list-container');
  const messagesContainer = document.getElementById('messages-container');
  const messageInput = document.getElementById('chat-message-input');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const roleSelect = document.getElementById('user-role-select');

  // ==========================================
  // NAVEGAÇÃO & PAPÉIS
  // ==========================================
  function switchView(viewId) {
    state.activeView = viewId;
    navItems.forEach(item => item.classList.toggle('active', item.getAttribute('data-view') === viewId));
    viewContainers.forEach(c => c.classList.toggle('active', c.id === viewId));

    const titles = {
      'view-chat': 'Atendimento WhatsApp & Chat',
      'view-kanban': 'Fila de Demandas & Pipeline',
      'view-kpi': 'Dashboard de KPIs & Métricas',
      'view-files': 'Google Drive & Arquivos',
      'view-integrations': 'Integrações WhatsApp & IA'
    };
    pageTitle.textContent = titles[viewId] || 'NexusFlow';
    if (viewId === 'view-kanban') renderDemandsPipeline();
    if (viewId === 'view-kpi') renderCharts();
    if (viewId === 'view-files') renderGdriveFiles();
  }

  navItems.forEach(item => item.addEventListener('click', () => switchView(item.getAttribute('data-view'))));

  if (roleSelect) {
    roleSelect.addEventListener('change', (e) => {
      state.userRole = e.target.value;
      const names = { relacionamento: 'Pedro Alves', execucao: 'Lucas Silva', atendimento: 'Mariana Costa' };
      const roles = { relacionamento: 'Analista Relacionamento', execucao: 'Analista Execução', atendimento: 'Analista Atendimento' };
      const el = document.getElementById('user-name-display');
      const rl = document.querySelector('.user-role');
      if (el) el.textContent = names[state.userRole];
      if (rl) rl.textContent = roles[state.userRole];
      renderDemandsPipeline();
    });
  }

  // ==========================================
  // CONTATOS & CHAT
  // ==========================================
  function renderContactsList() {
    contactsListContainer.innerHTML = '';
    const filtered = state.contacts.filter(c => {
      const q = state.searchQuery.toLowerCase();
      const match = c.name.toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q) || c.phone.includes(q);
      if (state.currentFilter === 'minhas') return match;
      if (state.currentFilter === 'fila') return match && c.isQueue;
      return match;
    });

    filtered.forEach(c => {
      const card = document.createElement('div');
      card.className = `contact-card ${c.id === state.activeContactId ? 'active' : ''}`;
      card.addEventListener('click', () => selectContact(c.id));

      // Verifica se tem demanda ativa para este contato
      const activeDemand = state.demands.find(d => d.contactId === c.id && d.stage !== 'concluido');
      const priorityBadge = activeDemand
        ? `<span class="demand-tag ${activeDemand.priority}">${activeDemand.priority.toUpperCase()}</span>`
        : '<span class="demand-tag baixa">SEM DEMANDA</span>';

      card.innerHTML = `
        <div class="contact-avatar-wrapper">
          <div class="contact-avatar">${c.avatar || 'NF'}</div>
          <div class="whatsapp-badge"><i class="fa-brands fa-whatsapp"></i></div>
        </div>
        <div class="contact-details">
          <div class="contact-top-row">
            <span class="contact-name">${c.name}</span>
            <span class="contact-time">${c.time || ''}</span>
          </div>
          <div class="contact-last-msg">${c.lastMsg || 'Sem mensagem'}</div>
          <div class="contact-tags">${priorityBadge}</div>
        </div>
      `;
      contactsListContainer.appendChild(card);
    });
  }

  function selectContact(id) {
    state.activeContactId = id;
    const c = state.contacts.find(x => x.id === id);
    if (!c) return;

    document.getElementById('active-chat-avatar').textContent = c.avatar || 'NF';
    document.getElementById('active-chat-name').textContent = c.name;
    document.getElementById('active-chat-phone').textContent = `${c.phone} • ${c.company || ''}`;
    document.getElementById('side-info-company').textContent = c.company || 'Empresa';

    // Atualiza widget de triagem com a demanda ativa deste contato
    const activeDemand = state.demands.find(d => d.contactId === id && d.stage !== 'concluido');
    updateTriageWidget(activeDemand);

    // Atualiza dados da demanda no painel lateral
    if (activeDemand) {
      document.getElementById('side-info-demand-title').textContent = activeDemand.title;
      const stageNames = { relacionamento: 'Relacionamento', execucao: 'Execução', 'auditoria-ia': 'Auditoria IA', atendimento: 'Atendimento', concluido: 'Concluído' };
      document.getElementById('side-info-demand-status').innerHTML = `<span class="demand-tag ${activeDemand.priority}">${stageNames[activeDemand.stage] || activeDemand.stage}</span>`;
    } else {
      document.getElementById('side-info-demand-title').textContent = 'Nenhuma demanda ativa';
      document.getElementById('side-info-demand-status').innerHTML = '<span class="demand-tag baixa">—</span>';
    }

    renderContactsList();
    renderMessages();
  }

  function updateTriageWidget(demand) {
    const display = document.getElementById('upa-triage-display');
    if (!display) return;

    if (!demand) {
      display.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--text-muted);">
          <i class="fa-solid fa-inbox" style="font-size: 2rem; margin-bottom: 0.75rem; opacity: 0.4;"></i>
          <p style="font-size: 0.82rem;">Nenhuma demanda ativa para este contato.</p>
          <p style="font-size: 0.75rem; margin-top: 0.5rem;">Clique em <strong>"Gerar Demanda via IA"</strong> para a IA analisar a conversa.</p>
        </div>
      `;
      return;
    }

    const priorityColors = { emergencia: '#f43f5e', alta: '#f97316', media: '#eab308', baixa: '#10b981' };
    const priorityLabels = { emergencia: 'EMERGÊNCIA / CRÍTICO', alta: 'ALTA PRIORIDADE', media: 'MÉDIA PRIORIDADE', baixa: 'BAIXA PRIORIDADE' };

    display.innerHTML = `
      <div class="upa-badge ${demand.priority}">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>${priorityLabels[demand.priority] || 'PRIORIDADE'}</span>
      </div>
      <div style="font-size: 0.82rem; margin-top: 0.75rem; color: var(--text-muted);">
        <strong>Complexidade:</strong> ${demand.complexity}<br>
        <strong>SLA Sugerido:</strong> ${demand.slaSuggested}<br>
        <strong>Criada por:</strong> ${demand.createdBy === 'ia-auto' ? '🤖 IA (automático)' : '👤 Manual'}
      </div>
      <div class="upa-action-box">
        <p style="font-size: 0.78rem; margin: 0; color: var(--text-main);">
          <strong>Análise da IA:</strong> ${demand.aiTriageNotes || 'Sem observações.'}
        </p>
      </div>
      ${demand.stage === 'relacionamento' ? `
        <button class="btn-primary btn-dispatch-to-exec" style="width: 100%; margin-top: 0.75rem; font-size: 0.8rem;">
          <i class="fa-solid fa-share-from-square"></i> Disparar para Execução
        </button>
      ` : ''}
      ${demand.aiAuditResult && !demand.aiAuditResult.approved ? `
        <div class="audit-alert-widget" style="margin-top: 0.75rem;">
          <strong>⚠️ Alerta da Auditoria IA:</strong><br>
          ${demand.aiAuditResult.warnings.join('<br>')}
        </div>
      ` : ''}
    `;

    const dispatchBtn = display.querySelector('.btn-dispatch-to-exec');
    if (dispatchBtn) {
      dispatchBtn.addEventListener('click', () => dispatchToExecucao(demand.id));
    }
  }

  function renderMessages() {
    messagesContainer.innerHTML = '';
    const msgs = state.messages[state.activeContactId] || [];

    msgs.forEach(msg => {
      const bubble = document.createElement('div');
      bubble.className = `message-bubble ${msg.type}`;

      let fileHtml = '';
      if (msg.file) {
        fileHtml = `
          <div class="file-attachment-card">
            <div class="file-icon"><i class="fa-solid ${msg.file.isPdf ? 'fa-file-pdf' : 'fa-file'}"></i></div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 0.82rem;">${msg.file.name}</div>
              <div style="font-size: 0.7rem; opacity: 0.7;">${msg.file.size || '1.0 MB'}</div>
            </div>
          </div>
        `;
      }

      bubble.innerHTML = `
        <div class="message-content">
          ${fileHtml}
          <div>${msg.text}</div>
          <div style="font-size: 0.7rem; color: var(--text-subtle); text-align: right; margin-top: 0.3rem;">
            ${msg.time || ''}
            ${msg.type === 'outgoing' ? '<i class="fa-solid fa-check-double" style="color: var(--accent-cyan); margin-left: 0.3rem;"></i>' : ''}
          </div>
        </div>
      `;
      messagesContainer.appendChild(bubble);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // ==========================================
  // ENVIAR MENSAGEM (CHAT PURO — SEM IA NO CHAT)
  // ==========================================
  async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newMsg = { contactId: state.activeContactId, type: 'outgoing', sender: 'Pedro Alves', text, time: timeStr };

    if (!state.messages[state.activeContactId]) state.messages[state.activeContactId] = [];
    state.messages[state.activeContactId].push(newMsg);
    messageInput.value = '';
    renderMessages();

    fetch(`${BACKEND_URL}/api/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMsg)
    }).catch(() => {});
  }

  document.getElementById('btn-send-message').addEventListener('click', sendMessage);
  messageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

  // ==========================================
  // IA: GERAR DEMANDA A PARTIR DA CONVERSA
  // (A IA lê o contexto e cria a demanda — não aparece no chat)
  // ==========================================
  async function iaGenerateDemand() {
    const contactId = state.activeContactId;

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/ai/generate-demand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId })
      });

      if (res.ok) {
        const data = await res.json();
        // Adiciona a demanda ao estado local
        state.demands.unshift(data.demand);
        // Atualiza o widget de triagem no painel lateral
        updateTriageWidget(data.demand);
        renderContactsList();
        renderDemandsPipeline();

        // Notificação visual sutil (não no chat!)
        showNotification(`🤖 IA gerou demanda: "${data.demand.title}" — Prioridade: ${data.triage.priorityLabel}`);
        return;
      }
    } catch (e) {}

    showNotification('❌ Não foi possível conectar com a IA. Verifique o backend.');
  }

  // Botões que acionam a IA para gerar demanda
  const btnAiTriage = document.getElementById('btn-trigger-ai-triage');
  if (btnAiTriage) btnAiTriage.addEventListener('click', iaGenerateDemand);

  const chipManus = document.getElementById('chip-manus-suggest');
  if (chipManus) chipManus.addEventListener('click', iaGenerateDemand);

  // ==========================================
  // DESPACHAR DEMANDA: RELACIONAMENTO → EXECUÇÃO
  // ==========================================
  async function dispatchToExecucao(demandId) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/demands/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demandId, execucaoAgent: 'Lucas Silva' })
      });
      if (res.ok) {
        const data = await res.json();
        const idx = state.demands.findIndex(d => d.id === demandId);
        if (idx >= 0) state.demands[idx] = data.demand;
        updateTriageWidget(data.demand);
        renderDemandsPipeline();
        showNotification(`✅ Demanda ${demandId} disparada para Execução (Lucas Silva)`);
      }
    } catch (e) {}
  }

  // ==========================================
  // CONCLUIR EXECUÇÃO → AUDITORIA IA
  // ==========================================
  async function finishExecution(demandId, executionNotes) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/demands/finish-execution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demandId, executionNotes })
      });
      if (res.ok) {
        const data = await res.json();
        const idx = state.demands.findIndex(d => d.id === demandId);
        if (idx >= 0) state.demands[idx] = data.demand;
        renderDemandsPipeline();

        if (data.audit.approved) {
          showNotification(`✅ Auditoria IA: Aprovado! Demanda encaminhada para Atendimento.`);
        } else {
          showNotification(`⚠️ Auditoria IA: Divergência encontrada! Devolvida ao Relacionamento.`);
        }
      }
    } catch (e) {}
  }

  // ==========================================
  // FECHAR DEMANDA → IA ARQUIVA AUTOMATICAMENTE
  // ==========================================
  async function closeDemand(demandId) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/demands/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demandId })
      });
      if (res.ok) {
        const data = await res.json();
        const idx = state.demands.findIndex(d => d.id === demandId);
        if (idx >= 0) state.demands[idx] = data.demand;
        state.gdriveFiles = data.demand ? [...state.gdriveFiles] : state.gdriveFiles;
        renderDemandsPipeline();
        renderGdriveFiles();
        showNotification(`📦 Demanda ${demandId} concluída e arquivos salvos no Google Drive!`);
      }
    } catch (e) {}
  }

  // ==========================================
  // PIPELINE DE DEMANDAS (5 COLUNAS)
  // ==========================================
  function renderDemandsPipeline() {
    const columns = {
      'relacionamento': document.getElementById('cards-relacionamento'),
      'execucao': document.getElementById('cards-execucao'),
      'auditoria-ia': document.getElementById('cards-auditoria'),
      'atendimento': document.getElementById('cards-atendimento'),
      'concluido': document.getElementById('cards-concluido')
    };

    Object.values(columns).forEach(col => { if (col) col.innerHTML = ''; });
    const counts = { 'relacionamento': 0, 'execucao': 0, 'auditoria-ia': 0, 'atendimento': 0, 'concluido': 0 };

    // Ordena por prioridade (emergencia primeiro)
    const priorityOrder = { emergencia: 0, alta: 1, media: 2, baixa: 3 };
    const sorted = [...state.demands].sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));

    sorted.forEach(d => {
      counts[d.stage] = (counts[d.stage] || 0) + 1;
      const col = columns[d.stage];
      if (!col) return;

      const card = document.createElement('div');
      card.className = 'kanban-card-upa';

      const createdByIcon = d.createdBy === 'ia-auto' ? '🤖' : '👤';

      // Botão de ação contextual por etapa
      let actionHtml = '';
      if (d.stage === 'relacionamento') {
        actionHtml = `<button class="btn-primary card-action-btn" data-action="dispatch" data-id="${d.id}" style="width:100%; margin-top:0.5rem; font-size:0.75rem;"><i class="fa-solid fa-share-from-square"></i> Enviar para Execução</button>`;
      } else if (d.stage === 'execucao') {
        actionHtml = `<button class="btn-primary card-action-btn" data-action="finish" data-id="${d.id}" style="width:100%; margin-top:0.5rem; font-size:0.75rem; background: linear-gradient(135deg, #3b82f6, #06b6d4);"><i class="fa-solid fa-check"></i> Finalizar Execução</button>`;
      } else if (d.stage === 'atendimento') {
        actionHtml = `<button class="btn-primary card-action-btn" data-action="close" data-id="${d.id}" style="width:100%; margin-top:0.5rem; font-size:0.75rem; background: linear-gradient(135deg, #10b981, #06b6d4);"><i class="fa-solid fa-paper-plane"></i> Enviar ao Cliente & Concluir</button>`;
      }

      // Alerta de auditoria (se houver)
      let auditHtml = '';
      if (d.aiAuditResult) {
        const auditColor = d.aiAuditResult.approved ? '#10b981' : '#f43f5e';
        auditHtml = `
          <div class="audit-alert-widget" style="border-left-color: ${auditColor};">
            <strong>${d.aiAuditResult.approved ? '✅ IA Aprovou' : '⚠️ IA: Divergência'}</strong><br>
            <span style="font-size: 0.72rem;">${d.aiAuditResult.warnings[0]}</span>
          </div>
        `;
      }

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
          <span class="demand-tag ${d.priority}">${d.priority.toUpperCase()}</span>
          <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-subtle);">${createdByIcon} ${d.id}</span>
        </div>
        <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.3rem; line-height: 1.3;">${d.title}</div>
        <div style="font-size: 0.78rem; color: var(--text-muted);"><i class="fa-regular fa-building"></i> ${d.clientName}</div>
        <div style="font-size: 0.72rem; color: var(--text-subtle); margin-top: 0.4rem;">
          <i class="fa-solid fa-brain" style="color: var(--manus-purple);"></i> ${d.aiTriageNotes ? d.aiTriageNotes.substring(0, 80) + '...' : 'Sem notas'}
        </div>
        ${auditHtml}
        <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-subtle); margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
          <span><i class="fa-regular fa-user"></i> ${d.assignedRelacionamento || '—'}</span>
          <span style="color: var(--upa-alta); font-weight: 600;"><i class="fa-regular fa-clock"></i> ${d.slaSuggested}</span>
        </div>
        ${actionHtml}
      `;

      col.appendChild(card);
    });

    // Atualiza contadores
    Object.keys(counts).forEach(stage => {
      const countKey = stage === 'auditoria-ia' ? 'auditoria' : stage;
      const el = document.getElementById(`count-${countKey}`);
      if (el) el.textContent = counts[stage] || 0;
    });

    // Event listeners dos botões de ação
    document.querySelectorAll('.card-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (action === 'dispatch') dispatchToExecucao(id);
        if (action === 'finish') finishExecution(id, 'Tarefa executada conforme solicitação do cliente.');
        if (action === 'close') closeDemand(id);
      });
    });
  }

  // ==========================================
  // GOOGLE DRIVE FILES
  // ==========================================
  function renderGdriveFiles() {
    const container = document.getElementById('files-grid-container');
    if (!container) return;
    container.innerHTML = '';

    state.gdriveFiles.forEach(file => {
      const card = document.createElement('div');
      card.className = 'integration-card';
      card.style.padding = '1rem';
      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: rgba(16,185,129,0.15); color: #10b981; display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
            <i class="fa-brands fa-google-drive"></i>
          </div>
          <div style="overflow: hidden;">
            <div style="font-weight: 700; font-size: 0.88rem;">${file.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-subtle);">${file.folder || ''} • ${file.size}</div>
            <div style="font-size: 0.7rem; color: #10b981; font-weight: 600; margin-top: 0.2rem;">${file.status}</div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    if (state.gdriveFiles.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Nenhum arquivo arquivado ainda. Conclua demandas para arquivar automaticamente.</p>';
    }
  }

  // ==========================================
  // CHARTS
  // ==========================================
  function renderCharts() {
    const ctx1 = document.getElementById('chart-hourly-volume');
    if (!ctx1) return;
    new Chart(ctx1.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Emergência', 'Alta', 'Média', 'Baixa'],
        datasets: [{ data: [
          state.demands.filter(d => d.priority === 'emergencia').length || 1,
          state.demands.filter(d => d.priority === 'alta').length || 2,
          state.demands.filter(d => d.priority === 'media').length || 3,
          state.demands.filter(d => d.priority === 'baixa').length || 1
        ], backgroundColor: ['#f43f5e', '#f97316', '#eab308', '#10b981'] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } } }
    });

    const ctx2 = document.getElementById('chart-agent-performance');
    if (!ctx2) return;
    new Chart(ctx2.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Pedro (Relacionamento)', 'Lucas (Execução)', 'Mariana (Atendimento)'],
        datasets: [{ label: 'Demandas Processadas', data: [65, 58, 48], backgroundColor: ['#8b5cf6', '#3b82f6', '#10b981'], borderRadius: 8 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } } }
    });
  }

  // ==========================================
  // NOTIFICAÇÃO VISUAL (TOAST)
  // ==========================================
  function showNotification(text) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed; bottom:24px; right:24px; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-main); padding:1rem 1.5rem; border-radius:12px; font-size:0.85rem; box-shadow:0 10px 30px rgba(0,0,0,0.5); z-index:9999; max-width:420px; animation: slideIn 0.3s ease;';
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
  }

  // ==========================================
  // SÍNTESE OPERACIONAL (MODAL)
  // ==========================================
  const btnSummary = document.getElementById('btn-trigger-manus-summary');
  if (btnSummary) {
    btnSummary.addEventListener('click', async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/ai/summary`);
        if (res.ok) {
          const data = await res.json();
          document.getElementById('manus-summary-text').innerHTML = data.summary.replace(/\n/g, '<br>');
        }
      } catch (e) {
        document.getElementById('manus-summary-text').textContent = 'Não foi possível conectar ao motor de IA.';
      }
      document.getElementById('modal-manus-summary').classList.add('active');
    });
  }

  if (document.getElementById('close-modal-manus')) document.getElementById('close-modal-manus').addEventListener('click', () => document.getElementById('modal-manus-summary').classList.remove('active'));
  if (document.getElementById('btn-close-manus-report')) document.getElementById('btn-close-manus-report').addEventListener('click', () => document.getElementById('modal-manus-summary').classList.remove('active'));

  // ==========================================
  // MODAL NOVA DEMANDA MANUAL
  // ==========================================
  if (document.getElementById('btn-quick-new-demand')) document.getElementById('btn-quick-new-demand').addEventListener('click', () => document.getElementById('modal-new-demand').classList.add('active'));
  if (document.getElementById('btn-create-demand-modal')) document.getElementById('btn-create-demand-modal').addEventListener('click', () => document.getElementById('modal-new-demand').classList.add('active'));
  if (document.getElementById('close-modal-demand')) document.getElementById('close-modal-demand').addEventListener('click', () => document.getElementById('modal-new-demand').classList.remove('active'));
  if (document.getElementById('btn-cancel-demand')) document.getElementById('btn-cancel-demand').addEventListener('click', () => document.getElementById('modal-new-demand').classList.remove('active'));

  if (document.getElementById('btn-save-demand')) {
    document.getElementById('btn-save-demand').addEventListener('click', async () => {
      const title = document.getElementById('demand-title-input').value.trim();
      const clientName = document.getElementById('demand-client-select').value;
      const priority = document.getElementById('demand-priority-select').value;
      if (!title) return;

      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/demands/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, clientName, priority })
        });
        if (res.ok) {
          const data = await res.json();
          state.demands.unshift(data.demand);
          renderDemandsPipeline();
          renderContactsList();
          showNotification(`👤 Demanda criada manualmente: "${title}"`);
        }
      } catch (e) {}

      document.getElementById('demand-title-input').value = '';
      document.getElementById('modal-new-demand').classList.remove('active');
    });
  }

  // SEARCH & FILTER
  const contactSearch = document.getElementById('contact-search');
  if (contactSearch) contactSearch.addEventListener('input', (e) => { state.searchQuery = e.target.value; renderContactsList(); });

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentFilter = tab.getAttribute('data-filter');
      renderContactsList();
    });
  });

  // THEME
  themeToggleBtn.addEventListener('click', () => {
    const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    themeToggleBtn.innerHTML = t === 'dark' ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
  });

  // FILE UPLOAD
  const fileInput = document.getElementById('file-upload-input');
  if (document.getElementById('btn-trigger-upload')) document.getElementById('btn-trigger-upload').addEventListener('click', () => fileInput.click());
  if (document.getElementById('chip-send-file')) document.getElementById('chip-send-file').addEventListener('click', () => fileInput.click());

  // RENDER ALL
  function renderAll() {
    renderContactsList();
    selectContact(state.activeContactId);
    renderDemandsPipeline();
  }

  // INIT
  fetchState();
});
