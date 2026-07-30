/* ==========================================================================
   NEXUSFLOW - SISTEMA INTERNO DE ATENDIMENTO, DEMANDAS, CHAT & KPIS
   Motor UPA de Triagem de IA, Multi-Papéis e Integração Google Drive
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  const RENDER_PROD_URL = 'https://nexusflow-backend-u3ii.onrender.com';
  const BACKEND_URL = isLocal 
    ? 'http://localhost:8081' 
    : (window.NEXUSFLOW_BACKEND_URL || RENDER_PROD_URL);

  // ==========================================
  // ESTADO GLOBAL OPERACIONAL (STATE)
  // ==========================================
  let state = {
    activeView: 'view-chat',
    activeContactId: 1,
    currentFilter: 'todos',
    searchQuery: '',
    theme: 'dark',
    userRole: 'relacionamento', // relacionamento, execucao, atendimento
    backendConnected: false,
    activePreviewFile: null,

    contacts: [
      {
        id: 1,
        name: 'Carlos Construtora S.A.',
        phone: '+55 11 98765-4321',
        avatar: 'CC',
        unread: 2,
        time: '12:45',
        lastMsg: 'Envei a medição da obra em PDF. Consegue revisar com urgência?',
        company: 'Carlos Construtora S.A.',
        demandTitle: 'Aprovação de Medição de Obra',
        demandDesc: 'Revisão de contrato financeiro e medição de engenharia.',
        demandStatus: 'Relacionamento',
        priority: 'emergencia',
        assignedRelacionamento: 'Pedro Alves',
        assignedExecucao: 'Lucas Silva',
        assignedAtendimento: 'Mariana Costa',
        gdriveFolder: 'https://drive.google.com/drive/folders/carlos-construtora-001',
        isQueue: false
      },
      {
        id: 2,
        name: 'Dra. Mariana Costa',
        phone: '+55 21 99123-8877',
        avatar: 'MC',
        unread: 1,
        time: '11:20',
        lastMsg: 'O relatório financeiro de julho já foi emitido?',
        company: 'Advocacia Costa & Associados',
        demandTitle: 'Emissão de Relatório Financeiro',
        demandDesc: 'Solicitação de extrato detalhado do 2º trimestre.',
        demandStatus: 'Execucao',
        priority: 'alta',
        assignedRelacionamento: 'Pedro Alves',
        assignedExecucao: 'Gabriel Souza',
        assignedAtendimento: 'Mariana Costa',
        gdriveFolder: 'https://drive.google.com/drive/folders/advocacia-costa-002',
        isQueue: false
      },
      {
        id: 3,
        name: 'TechSolutions Brasil',
        phone: '+55 31 97766-5544',
        avatar: 'TS',
        unread: 0,
        time: 'Ontem',
        lastMsg: 'Tudo certo com a integração do webhook!',
        company: 'TechSolutions LTDA',
        demandTitle: 'Configuração de Webhook WhatsApp',
        demandDesc: 'Instalação de credenciais de produção.',
        demandStatus: 'Concluido',
        priority: 'baixa',
        assignedRelacionamento: 'Pedro Alves',
        assignedExecucao: 'Lucas Silva',
        assignedAtendimento: 'Mariana Costa',
        gdriveFolder: 'https://drive.google.com/drive/folders/techsolutions-003',
        isQueue: true
      }
    ],

    messages: {
      1: [
        { id: 101, type: 'incoming', sender: 'Carlos Construtora', text: 'Olá Pedro, boa tarde! Tudo bem?', time: '12:30' },
        { id: 102, type: 'outgoing', sender: 'Pedro Alves', text: 'Boa tarde, Carlos! Tudo ótimo por aqui. Como posso te ajudar hoje?', time: '12:32' },
        { id: 103, type: 'incoming', sender: 'Carlos Construtora', text: 'Envei a medição da obra em PDF. Consegue revisar para liberar a fatura?', time: '12:45', file: { id: 1001, name: 'Medicao_Engenharia_Julho.pdf', type: 'pdf', size: '2.4 MB', isPdf: true, content: 'Relatório Financeiro de Engenharia - Medição de Julho 2026' } },
        { id: 104, type: 'manus', sender: 'Manus AI Copilot', text: '🚨 **Triagem UPA de IA**: Demanda classificada como **EMERGÊNCIA (Vermelho)**. Complexidade Alta • SLA Sugerido: 15 minutos.', time: '12:46' }
      ],
      2: [
        { id: 201, type: 'incoming', sender: 'Dra. Mariana Costa', text: 'O relatório financeiro de julho já foi emitido?', time: '11:20' }
      ]
    },

    kanbanDemands: [
      {
        id: 'DEM-101',
        title: 'Aprovação de Medição de Obra',
        client: 'Carlos Construtora S.A.',
        stage: 'relacionamento',
        priority: 'emergencia',
        complexity: 'Alta',
        slaSuggested: '15 min restantes',
        relacionamentoAgent: 'Pedro Alves',
        execucaoAgent: 'Lucas Silva',
        atendimentoAgent: 'Mariana Costa',
        auditAlert: null
      },
      {
        id: 'DEM-102',
        title: 'Emissão de Relatório Financeiro Q2',
        client: 'Dra. Mariana Costa',
        stage: 'execucao',
        priority: 'alta',
        complexity: 'Média',
        slaSuggested: '1h restante',
        relacionamentoAgent: 'Pedro Alves',
        execucaoAgent: 'Gabriel Souza',
        atendimentoAgent: 'Mariana Costa',
        auditAlert: null
      },
      {
        id: 'DEM-103',
        title: 'Configuração de Webhook WhatsApp',
        client: 'TechSolutions Brasil',
        stage: 'concluido',
        priority: 'baixa',
        complexity: 'Baixa',
        slaSuggested: 'Concluído',
        relacionamentoAgent: 'Pedro Alves',
        execucaoAgent: 'Lucas Silva',
        atendimentoAgent: 'Mariana Costa',
        auditAlert: null
      }
    ],

    files: [
      { id: 'gfile-101', name: 'Medicao_Engenharia_Julho.pdf', client: 'Carlos Construtora S.A.', folder: 'Carlos Construtora S.A. / 2026 / Medições', size: '2.4 MB', status: 'Arquivado no Google Drive', icon: 'fa-file-pdf', color: '#f43f5e', isPdf: true }
    ]
  };

  // ==========================================
  // CONEXÃO COM O BACKEND E TRIAGEM UPA VIA IA
  // ==========================================
  async function fetchStateFromBackend() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/state`);
      if (res.ok) {
        const dbData = await res.json();
        if (dbData.contacts && dbData.contacts.length > 0) state.contacts = dbData.contacts;
        if (dbData.messages) state.messages = dbData.messages;
        if (dbData.kanbanDemands) state.kanbanDemands = dbData.kanbanDemands;
        if (dbData.gdriveFiles) state.files = dbData.gdriveFiles;

        renderContactsList();
        renderMessages();
        renderKanbanUPA();
        renderFilesGrid();
      }
    } catch (err) {}
  }

  async function checkBackendConnection() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/health`, { method: 'GET' });
      if (res.ok) {
        state.backendConnected = true;
        updateBackendPill(true);
        fetchStateFromBackend();
        return;
      }
    } catch (err) {}

    state.backendConnected = false;
    updateBackendPill(false);
  }

  function updateBackendPill(isConnected) {
    const pill = document.getElementById('backend-connection-pill');
    if (!pill) return;
    if (isConnected) {
      pill.style.backgroundColor = 'rgba(139, 92, 246, 0.15)';
      pill.style.color = '#8b5cf6';
      pill.style.borderColor = 'rgba(139, 92, 246, 0.3)';
      pill.innerHTML = `<span class="status-dot" style="background-color: #8b5cf6; box-shadow: 0 0 8px #8b5cf6;"></span> Back-end UPA :8081 CONECTADO ⚡`;
    } else {
      pill.style.backgroundColor = 'rgba(244, 63, 94, 0.15)';
      pill.style.color = '#f43f5e';
      pill.innerHTML = `<span class="status-dot" style="background-color: #f43f5e;"></span> Aguardando API UPA...`;
    }
  }

  checkBackendConnection();
  setInterval(checkBackendConnection, 5000);

  // TRIAGEM UPA DA IA (ANALISA COMPLEXIDADE, URGÊNCIA E SLA)
  async function triggerAiUpaTriage(contactObj) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/ai/triage-upa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: contactObj.lastMsg,
          demandTitle: contactObj.demandTitle,
          clientName: contactObj.name
        })
      });

      if (res.ok) {
        const data = await res.json();
        updateUpaWidgetUI(data.triage);
        fetchStateFromBackend();
        return data.triage;
      }
    } catch (err) {}

    // Fallback local caso a API esteja off
    const fallbackTriage = {
      priority: contactObj.priority || 'emergencia',
      priorityName: 'Emergência / Crítico (Vermelho)',
      complexity: 'Alta (Multi-departamentos)',
      slaText: '15 min (Imediato)',
      recommendedAction: 'Disparar imediatamente para o Analista de Execução.'
    };
    updateUpaWidgetUI(fallbackTriage);
    return fallbackTriage;
  }

  function updateUpaWidgetUI(triageData) {
    const display = document.getElementById('upa-triage-display');
    if (!display) return;

    display.innerHTML = `
      <div class="upa-badge ${triageData.priority}">
        <i class="fa-solid fa-hospital-user"></i>
        <span>SEVERIDADE: ${triageData.priorityName.toUpperCase()}</span>
      </div>
      <div style="font-size: 0.82rem; margin-top: 0.75rem; color: var(--text-muted);">
        <strong>Complexidade:</strong> ${triageData.complexity}<br>
        <strong>SLA Sugerido pela IA:</strong> ${triageData.slaText}
      </div>
      <div class="upa-action-box">
        <p style="font-size: 0.78rem; margin: 0; color: var(--text-main);">
          <strong>Ação Recomendada:</strong> ${triageData.recommendedAction}
        </p>
      </div>
      <button class="btn-primary" id="btn-dispatch-demand" style="width: 100%; margin-top: 0.75rem; font-size: 0.8rem;">
        <i class="fa-solid fa-share-from-square"></i> Disparar para Execução
      </button>
    `;

    document.getElementById('btn-dispatch-demand').addEventListener('click', () => {
      const contact = state.contacts.find(c => c.id === state.activeContactId);
      if (contact) dispatchDemandToExecucao(contact);
    });
  }

  // DISPARAR DEMANDA DO RELACIONAMENTO PARA A EXECUÇÃO
  async function dispatchDemandToExecucao(contactObj) {
    const targetDemand = state.kanbanDemands.find(d => d.client === contactObj.name);
    if (targetDemand) {
      try {
        await fetch(`${BACKEND_URL}/api/v1/demands/stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            demandId: targetDemand.id,
            nextStage: 'execucao',
            agentName: 'Lucas Silva'
          })
        });
      } catch (e) {}

      targetDemand.stage = 'execucao';
      renderKanbanUPA();

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      state.messages[contactObj.id].push({
        id: Date.now(),
        type: 'manus',
        sender: 'Manus AI Copilot',
        text: `🚀 **Demanda Disparada para Execução**: Card ${targetDemand.id} encaminhado para o Analista Lucas Silva com prioridade ${targetDemand.priority.toUpperCase()}.`,
        time: timeStr
      });
      renderMessages();
    }
  }

  // ==========================================
  // ELEMENTOS DO DOM & NAVEGAÇÃO
  // ==========================================
  const navItems = document.querySelectorAll('.nav-item');
  const viewContainers = document.querySelectorAll('.view-container');
  const pageTitle = document.getElementById('current-view-title');
  const contactsListContainer = document.getElementById('contacts-list-container');
  const messagesContainer = document.getElementById('messages-container');
  const messageInput = document.getElementById('chat-message-input');
  const btnSendMessage = document.getElementById('btn-send-message');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const roleSelect = document.getElementById('user-role-select');

  // Troca de Papéis do Usuário (Relacionamento, Execução, Atendimento)
  if (roleSelect) {
    roleSelect.addEventListener('change', (e) => {
      state.userRole = e.target.value;
      const display = document.getElementById('user-name-display');
      const roleDisplay = document.querySelector('.user-role');

      if (state.userRole === 'relacionamento') {
        if (display) display.textContent = 'Pedro Alves';
        if (roleDisplay) roleDisplay.textContent = 'Analista Relacionamento';
      } else if (state.userRole === 'execucao') {
        if (display) display.textContent = 'Lucas Silva';
        if (roleDisplay) roleDisplay.textContent = 'Analista Execução';
      } else {
        if (display) display.textContent = 'Mariana Costa';
        if (roleDisplay) roleDisplay.textContent = 'Analista Atendimento';
      }

      renderKanbanUPA();
    });
  }

  // PREVIEW E DOWNLOAD LIGHTBOX
  function openFilePreviewModal(fileData) {
    state.activePreviewFile = fileData;
    document.getElementById('preview-filename').textContent = fileData.name;
    document.getElementById('preview-filesize').textContent = `Tamanho: ${fileData.size || '1.5 MB'}`;

    const mediaBox = document.getElementById('preview-media-box');
    mediaBox.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-main);">
        <i class="fa-solid ${fileData.isPdf ? 'fa-file-pdf' : 'fa-file-lines'}" style="font-size: 4.5rem; color: ${fileData.color || 'var(--accent-cyan)'}; margin-bottom: 1rem;"></i>
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">${fileData.name}</h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 400px; margin: 0 auto 1.5rem;">
          Documento sincronizado na pasta do cliente no Google Drive.
        </p>
        <span class="demand-tag alta">Autenticado no Google Drive</span>
      </div>
    `;

    document.getElementById('modal-file-preview').classList.add('active');
  }

  if (document.getElementById('close-modal-preview')) {
    document.getElementById('close-modal-preview').addEventListener('click', () => {
      document.getElementById('modal-file-preview').classList.remove('active');
    });
  }

  function switchView(viewId) {
    state.activeView = viewId;

    navItems.forEach(item => {
      if (item.getAttribute('data-view') === viewId) item.classList.add('active');
      else item.classList.remove('active');
    });

    viewContainers.forEach(container => {
      if (container.id === viewId) container.classList.add('active');
      else container.classList.remove('active');
    });

    const titlesMap = {
      'view-chat': 'Atendimento WhatsApp & Triagem de Demandas',
      'view-kanban': 'Quadro UPA de Demandas & Pipeline Multi-Papéis',
      'view-kpi': 'Dashboard de KPIs & Condução SLA',
      'view-integrations': 'Integrações WhatsApp API & Manus AI Engine',
      'view-files': 'Pastas do Cliente no Google Drive'
    };
    pageTitle.textContent = titlesMap[viewId] || 'NexusFlow';

    if (viewId === 'view-kanban') renderKanbanUPA();
    if (viewId === 'view-kpi') renderCharts();
    if (viewId === 'view-files') renderFilesGrid();
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => switchView(item.getAttribute('data-view')));
  });

  function renderContactsList() {
    contactsListContainer.innerHTML = '';
    state.contacts.forEach(contact => {
      const card = document.createElement('div');
      card.className = `contact-card ${contact.id === state.activeContactId ? 'active' : ''}`;
      card.addEventListener('click', () => selectContact(contact.id));

      card.innerHTML = `
        <div class="contact-avatar-wrapper">
          <div class="contact-avatar">${contact.avatar || 'NF'}</div>
          <div class="whatsapp-badge"><i class="fa-brands fa-whatsapp"></i></div>
        </div>
        <div class="contact-details">
          <div class="contact-top-row">
            <span class="contact-name">${contact.name}</span>
            <span class="contact-time">${contact.time || '12:00'}</span>
          </div>
          <div class="contact-last-msg">${contact.lastMsg || 'Nova mensagem'}</div>
          <div class="contact-tags">
            <span class="demand-tag ${contact.priority || 'media'}">UPA: ${contact.priority ? contact.priority.toUpperCase() : 'MÉDIA'}</span>
          </div>
        </div>
      `;
      contactsListContainer.appendChild(card);
    });
  }

  function selectContact(contactId) {
    state.activeContactId = contactId;
    const contact = state.contacts.find(c => c.id === contactId);
    if (!contact) return;

    document.getElementById('active-chat-avatar').textContent = contact.avatar || 'NF';
    document.getElementById('active-chat-name').textContent = contact.name;
    document.getElementById('active-chat-phone').textContent = `${contact.phone} • Relacionamento: ${contact.assignedRelacionamento || 'Pedro Alves'}`;
    document.getElementById('side-info-company').textContent = contact.company || 'Empresa';
    document.getElementById('side-info-demand-title').textContent = contact.demandTitle || 'Atendimento Geral';

    renderContactsList();
    renderMessages();
    triggerAiUpaTriage(contact);
  }

  function renderMessages() {
    messagesContainer.innerHTML = '';
    const msgList = state.messages[state.activeContactId] || [];

    msgList.forEach(msg => {
      const bubble = document.createElement('div');
      bubble.className = `message-bubble ${msg.type}`;

      bubble.innerHTML = `
        <div class="message-content">
          ${msg.type === 'manus' ? '<div class="message-sender-tag" style="color: var(--manus-purple); font-weight: 700; margin-bottom: 0.3rem;"><i class="fa-solid fa-robot"></i> Manus AI Copilot</div>' : ''}
          <div>${msg.text}</div>
          <div class="message-meta" style="font-size: 0.7rem; color: var(--text-subtle); text-align: right; margin-top: 0.3rem;">
            <span>${msg.time || '12:00'}</span>
          </div>
        </div>
      `;
      messagesContainer.appendChild(bubble);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newMsg = {
      contactId: state.activeContactId,
      type: 'outgoing',
      sender: 'Pedro Alves',
      text: text,
      time: timeStr
    };

    if (!state.messages[state.activeContactId]) state.messages[state.activeContactId] = [];
    state.messages[state.activeContactId].push(newMsg);

    messageInput.value = '';
    renderMessages();

    // Envia ao backend
    fetch(`${BACKEND_URL}/api/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMsg)
    });
  }

  btnSendMessage.addEventListener('click', sendMessage);
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  if (document.getElementById('btn-trigger-ai-triage')) {
    document.getElementById('btn-trigger-ai-triage').addEventListener('click', () => {
      const contact = state.contacts.find(c => c.id === state.activeContactId);
      if (contact) triggerAiUpaTriage(contact);
    });
  }

  // ==========================================
  // RENDERIZAÇÃO DO KANBAN DE DEMANDAS UPA DE 5 COLUNAS
  // ==========================================
  function renderKanbanUPA() {
    const columns = {
      'relacionamento': document.getElementById('cards-relacionamento'),
      'execucao': document.getElementById('cards-execucao'),
      'auditoria': document.getElementById('cards-auditoria'),
      'atendimento': document.getElementById('cards-atendimento'),
      'concluido': document.getElementById('cards-concluido')
    };

    Object.values(columns).forEach(col => { if (col) col.innerHTML = ''; });
    const counts = { 'relacionamento': 0, 'execucao': 0, 'auditoria': 0, 'atendimento': 0, 'concluido': 0 };

    state.kanbanDemands.forEach(card => {
      counts[card.stage]++;
      const cardEl = document.createElement('div');
      cardEl.className = 'kanban-card-upa';
      cardEl.draggable = true;

      let auditHtml = '';
      if (card.auditAlert) {
        auditHtml = `
          <div class="audit-alert-widget">
            <strong>🤖 Validação IA:</strong> ${card.auditAlert.warnings.join(' ')}
          </div>
        `;
      }

      cardEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
          <span class="demand-tag ${card.priority}">UPA: ${card.priority.toUpperCase()}</span>
          <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-subtle);">${card.id}</span>
        </div>
        <div style="font-weight: 700; font-size: 0.88rem; margin-bottom: 0.3rem;">${card.title}</div>
        <div style="font-size: 0.78rem; color: var(--text-muted);"><i class="fa-regular fa-building"></i> ${card.client}</div>
        ${auditHtml}
        <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-subtle); margin-top: 0.65rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
          <span><i class="fa-regular fa-user"></i> ${card.relacionamentoAgent}</span>
          <span style="color: var(--upa-alta); font-weight: 600;"><i class="fa-regular fa-clock"></i> ${card.slaSuggested}</span>
        </div>
      `;

      if (columns[card.stage]) columns[card.stage].appendChild(cardEl);
    });

    if (document.getElementById('count-relacionamento')) document.getElementById('count-relacionamento').textContent = counts['relacionamento'];
    if (document.getElementById('count-execucao')) document.getElementById('count-execucao').textContent = counts['execucao'];
    if (document.getElementById('count-auditoria')) document.getElementById('count-auditoria').textContent = counts['auditoria'];
    if (document.getElementById('count-atendimento')) document.getElementById('count-atendimento').textContent = counts['atendimento'];
    if (document.getElementById('count-concluido')) document.getElementById('count-concluido').textContent = counts['concluido'];
  }

  // RENDERIZAÇÃO DO GOOGLE DRIVE
  function renderFilesGrid() {
    const container = document.getElementById('files-grid-container');
    if (!container) return;
    container.innerHTML = '';

    state.files.forEach(file => {
      const card = document.createElement('div');
      card.className = 'integration-card';
      card.style.padding = '1rem';

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: rgba(16, 185, 129, 0.15); color: #10b981; display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
            <i class="fa-brands fa-google-drive"></i>
          </div>
          <div style="overflow: hidden;">
            <div style="font-weight: 700; font-size: 0.88rem;">${file.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-subtle);">${file.folder} • ${file.size}</div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // CHARTS.JS DASHBOARD
  function renderCharts() {
    const ctxVolume = document.getElementById('chart-hourly-volume').getContext('2d');
    new Chart(ctxVolume, {
      type: 'line',
      data: {
        labels: ['Emergência (Vermelho)', 'Alta (Laranja)', 'Média (Amarelo)', 'Baixa (Verde)'],
        datasets: [{
          label: 'Demandas Triadas UPA',
          data: [18, 35, 42, 20],
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244, 63, 94, 0.15)',
          fill: true
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    const ctxAgent = document.getElementById('chart-agent-performance').getContext('2d');
    new Chart(ctxAgent, {
      type: 'bar',
      data: {
        labels: ['Pedro (Relacionamento)', 'Lucas (Execução)', 'Mariana (Atendimento)'],
        datasets: [{
          label: 'Demandas Processadas',
          data: [65, 58, 48],
          backgroundColor: ['#8b5cf6', '#3b82f6', '#10b981']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
  });

  renderContactsList();
  selectContact(1);
});
