/* ==========================================================================
   NEXUSFLOW - SISTEMA INTERNO DE ATENDIMENTO, DEMANDAS, CHAT & KPIS
   Motor JavaScript Modular - Conexão Flexível Front-end & Manus AI Engine
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const BACKEND_URL = isLocal 
    ? 'http://localhost:8081' 
    : (window.NEXUSFLOW_BACKEND_URL || window.location.origin);

  // ==========================================
  // ESTADO GLOBAL DA APLICAÇÃO (STATE)
  // ==========================================
  const state = {
    activeView: 'view-chat',
    activeContactId: 1,
    currentFilter: 'todos',
    searchQuery: '',
    theme: 'dark',
    backendConnected: false,
    activePreviewFile: null,

    // Lista de Contatos / Atendimentos
    contacts: [
      {
        id: 1,
        name: 'Carlos Construtora S.A.',
        phone: '+55 11 98765-4321',
        avatar: 'CC',
        unread: 2,
        time: '12:45',
        lastMsg: 'Envei a medição da obra em PDF. Consegue revisar?',
        company: 'Carlos Construtora',
        demandTitle: 'Aprovação de Medição de Obra',
        demandDesc: 'Revisão de contrato financeiro e medição da engenharia.',
        demandStatus: 'Em Andamento',
        priority: 'alta',
        assignedTo: 'Pedro Alves',
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
        demandStatus: 'A Fazer',
        priority: 'media',
        assignedTo: 'Pedro Alves',
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
        demandStatus: 'Concluído',
        priority: 'baixa',
        assignedTo: 'Gabriel Souza',
        isQueue: true
      },
      {
        id: 4,
        name: 'Lucas Engenharia',
        phone: '+55 41 98844-3322',
        avatar: 'LE',
        unread: 0,
        time: 'Ontem',
        lastMsg: 'Aguardando o retorno da equipe técnica.',
        company: 'Lucas Engenharia',
        demandTitle: 'Suporte Técnico Nível 2',
        demandDesc: 'Verificação de estabilidade do servidor.',
        demandStatus: 'Aguardando Cliente',
        priority: 'media',
        assignedTo: 'Lucas Silva',
        isQueue: true
      },
      {
        id: 5,
        name: 'Gabriel Souza',
        phone: '+55 19 99555-1122',
        avatar: 'GS',
        unread: 0,
        time: '23/07',
        lastMsg: 'Obrigado pelo atendimento rápido!',
        company: 'GS Consultoria',
        demandTitle: 'Treinamento da Equipe',
        demandDesc: 'Onboarding no sistema NexusFlow.',
        demandStatus: 'Concluído',
        priority: 'baixa',
        assignedTo: 'Pedro Alves',
        isQueue: false
      }
    ],

    // Histórico de Mensagens por Contato
    messages: {
      1: [
        { id: 101, type: 'incoming', sender: 'Carlos Construtora', text: 'Olá Pedro, boa tarde! Tudo bem?', time: '12:30' },
        { id: 102, type: 'outgoing', sender: 'Pedro Alves', text: 'Boa tarde, Carlos! Tudo ótimo por aqui. Como posso te ajudar hoje?', time: '12:32' },
        { id: 103, type: 'incoming', sender: 'Carlos Construtora', text: 'Envei a medição da obra em PDF. Consegue revisar para liberar a fatura?', time: '12:45', file: { id: 1001, name: 'Medicao_Engenharia_Julho.pdf', type: 'pdf', size: '2.4 MB', isPdf: true, content: 'Relatório Financeiro de Engenharia - Medição de Julho 2026' } },
        { id: 104, type: 'manus', sender: 'Manus AI Copilot', text: '💡 **Sugestão de Resposta**: "Olá Carlos! Já recebi a planilha e abri o card de demanda com prioridade ALTA no Kanban para análise do departamento financeiro."', time: '12:46' }
      ],
      2: [
        { id: 201, type: 'incoming', sender: 'Dra. Mariana Costa', text: 'O relatório financeiro de julho já foi emitido?', time: '11:20' }
      ],
      3: [
        { id: 301, type: 'incoming', sender: 'TechSolutions', text: 'Testamos a rota do webhook e funcionou 100%.', time: 'Ontem' },
        { id: 302, type: 'outgoing', sender: 'Pedro Alves', text: 'Excelente! Demanda concluída com sucesso.', time: 'Ontem' }
      ],
      4: [
        { id: 401, type: 'incoming', sender: 'Lucas Engenharia', text: 'Aguardando o retorno da equipe técnica.', time: 'Ontem' }
      ],
      5: [
        { id: 501, type: 'incoming', sender: 'Gabriel Souza', text: 'Obrigado pelo atendimento rápido!', time: '23/07' }
      ]
    },

    // Quadro Kanban de Demandas
    kanbanDemands: [
      { id: 'DEM-101', title: 'Revisão de Relatório Financeiro Q2', client: 'Dra. Mariana Costa', status: 'a-fazer', priority: 'media', agent: 'Pedro Alves', sla: '1h restante' },
      { id: 'DEM-102', title: 'Integração de Webhook com Manus API', client: 'TechSolutions Brasil', status: 'a-fazer', priority: 'alta', agent: 'Gabriel Souza', sla: '30 min restantes' },
      { id: 'DEM-103', title: 'Aprovação de Medição de Obra', client: 'Carlos Construtora S.A.', status: 'em-andamento', priority: 'alta', agent: 'Pedro Alves', sla: '15 min restantes' },
      { id: 'DEM-104', title: 'Atualização de Cadastro de Fornecedores', client: 'Empresa Alfa', status: 'em-andamento', priority: 'baixa', agent: 'Mariana Costa', sla: '4h restantes' },
      { id: 'DEM-105', title: 'Homologação do Servidor de Banco de Dados', client: 'Lucas Engenharia', status: 'aguardando', priority: 'media', agent: 'Lucas Silva', sla: '3h restantes' },
      { id: 'DEM-106', title: 'Configuração Inicial do Sistema Nexus', client: 'TechSolutions Brasil', status: 'concluido', priority: 'baixa', agent: 'Pedro Alves', sla: 'Concluído' },
      { id: 'DEM-107', title: 'Treinamento de Equipe em Suporte', client: 'Gabriel Souza', status: 'concluido', priority: 'baixa', agent: 'Pedro Alves', sla: 'Concluído' },
      { id: 'DEM-108', title: 'Emissão de Nota Fiscal de Serviços', client: 'Carlos Construtora S.A.', status: 'concluido', priority: 'media', agent: 'Mariana Costa', sla: 'Concluído' }
    ],

    // Central de Arquivos Real
    files: [
      { id: 1001, name: 'Medicao_Engenharia_Julho.pdf', type: 'PDF Document', size: '2.4 MB', date: 'Hoje às 12:45', icon: 'fa-file-pdf', color: '#f43f5e', isPdf: true, content: 'Relatório Financeiro de Engenharia - Medição de Julho 2026' },
      { id: 1002, name: 'Comprovante_Pagamento_Fatura.png', type: 'PNG Image', size: '850 KB', date: 'Hoje às 10:15', icon: 'fa-file-image', color: '#06b6d4', isImage: true, dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%231e293b"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2306b6d4" font-size="20" font-family="sans-serif">Comprovante de Fatura NexusFlow</text></svg>' },
      { id: 1003, name: 'Audio_Instrucao_Cliente.mp3', type: 'Áudio Gravado', size: '1.1 MB', date: 'Ontem às 16:30', icon: 'fa-file-audio', color: '#a855f7', isAudio: true },
      { id: 1004, name: 'Contrato_Prestacao_Servicos.docx', type: 'Word Document', size: '3.8 MB', date: '23/07/2026', icon: 'fa-file-word', color: '#3b82f6', isDoc: true, content: 'Contrato de Prestação de Serviços Tecnológicos NexusFlow' }
    ]
  };

  // ==========================================
  // CONEXÃO DE REDE E ENGINE MANUS AI
  // ==========================================
  async function checkBackendConnection() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'pedro@nexusflow.com', password: '123' })
      });
      if (res.ok) {
        state.backendConnected = true;
        updateBackendPill(true);
      } else {
        state.backendConnected = false;
        updateBackendPill(false);
      }
    } catch (err) {
      state.backendConnected = false;
      updateBackendPill(false);
    }
  }

  function updateBackendPill(isConnected) {
    const pill = document.getElementById('backend-connection-pill');
    if (!pill) return;
    if (isConnected) {
      pill.style.backgroundColor = 'rgba(139, 92, 246, 0.15)';
      pill.style.color = '#8b5cf6';
      pill.style.borderColor = 'rgba(139, 92, 246, 0.3)';
      pill.innerHTML = `<span class="status-dot" style="background-color: #8b5cf6; box-shadow: 0 0 8px #8b5cf6;"></span> Back-end API :8081 CONECTADO ⚡`;
    } else {
      pill.style.backgroundColor = 'rgba(244, 63, 94, 0.15)';
      pill.style.color = '#f43f5e';
      pill.innerHTML = `<span class="status-dot" style="background-color: #f43f5e;"></span> Back-end Desconectado`;
    }
  }

  // CHAMADA DE TRIAGEM MANUS AI
  async function callManusAiTriagem(contactObj) {
    try {
      const payload = {
        ticketId: contactObj.id,
        clientName: contactObj.name,
        demandTitle: contactObj.demandTitle,
        text: contactObj.lastMsg
      };

      const res = await fetch(`${BACKEND_URL}/api/v1/manus/triagem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        addManusLog(`[MANUS AI] Triagem concluída para ${contactObj.name}: Intenção ${data.intent}`);
        return data;
      }
    } catch (err) {
      console.warn('Erro ao chamar Manus AI:', err);
    }

    // Fallback inteligente caso a API esteja off
    return {
      suggestedReply: `Prezado(a) ${contactObj.name}, verificamos a sua solicitação em nossa fila de atendimento. A demanda "${contactObj.demandTitle}" está sob análise prioritária da nossa equipe.`
    };
  }

  // CHAMADA DE SÍNTESE OPERACIONAL MANUS AI
  async function callManusAiSintese() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/manus/sintese`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'summarize_queue' })
      });
      if (res.ok) {
        const data = await res.json();
        return data.summaryText;
      }
    } catch (err) {
      console.warn('Erro ao obter síntese:', err);
    }

    return `
      📌 **Síntese de Operações Gerada pelo Agente Manus AI**:
      
      • **Fila de Atendimento**: 5 conversas ativas (1 em estado crítico de SLA).
      • **Gargalo Identificado**: Cliente *Carlos Construtora S.A.* aguarda validação de planilha de medição de engenharia em PDF há 15 minutos.
      • **Sugestão de Ação Autônoma**: Notificar supervisor financeiro via WhatsApp e mover card DEM-103 para 'Em Andamento'.
      • **Desempenho da Equipe**: 96.4% de satisfação CSAT nas últimas 24 horas.
    `;
  }

  async function uploadFileToBackend(file) {
    try {
      const sizeStr = file.size > 1024 * 1024 
        ? `${(file.size / 1024 / 1024).toFixed(1)} MB` 
        : `${(file.size / 1024).toFixed(0)} KB`;

      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });

      const payload = {
        name: file.name,
        size: sizeStr,
        type: file.type || 'application/octet-stream',
        dataUrl: dataUrl
      };

      const res = await fetch(`${BACKEND_URL}/api/v1/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      return {
        id: result.file ? result.file.id : Date.now(),
        name: file.name,
        size: sizeStr,
        mimeType: file.type,
        dataUrl: dataUrl,
        isImage: file.type.startsWith('image/'),
        isPdf: file.type.includes('pdf'),
        isAudio: file.type.startsWith('audio/')
      };
    } catch (err) {
      return {
        id: Date.now(),
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        mimeType: file.type,
        isImage: file.type.startsWith('image/'),
        isPdf: file.type.includes('pdf'),
        isAudio: file.type.startsWith('audio/')
      };
    }
  }

  // ==========================================
  // ELEMENTOS DO DOM
  // ==========================================
  const navItems = document.querySelectorAll('.nav-item');
  const viewContainers = document.querySelectorAll('.view-container');
  const pageTitle = document.getElementById('current-view-title');
  const contactsListContainer = document.getElementById('contacts-list-container');
  const messagesContainer = document.getElementById('messages-container');
  const messageInput = document.getElementById('chat-message-input');
  const btnSendMessage = document.getElementById('btn-send-message');
  const btnTriggerUpload = document.getElementById('btn-trigger-upload');
  const fileUploadInput = document.getElementById('file-upload-input');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const contactSearch = document.getElementById('contact-search');
  const filterTabs = document.querySelectorAll('.filter-tab');
  const waWebhookLogs = document.getElementById('wa-webhook-logs');
  const manusAiLogs = document.getElementById('manus-ai-logs');

  // Modais
  const modalNewDemand = document.getElementById('modal-new-demand');
  const modalManusSummary = document.getElementById('modal-manus-summary');
  const modalFilePreview = document.getElementById('modal-file-preview');
  const modalQrCode = document.getElementById('modal-qr-code');

  // ==========================================
  // PREVIEW E DOWNLOAD DE ARQUIVOS
  // ==========================================
  function openFilePreviewModal(fileData) {
    state.activePreviewFile = fileData;
    document.getElementById('preview-filename').textContent = fileData.name;
    document.getElementById('preview-filesize').textContent = `Tamanho: ${fileData.size || '1.5 MB'}`;

    const mediaBox = document.getElementById('preview-media-box');
    mediaBox.innerHTML = '';

    if (fileData.isImage && fileData.dataUrl) {
      const img = document.createElement('img');
      img.src = fileData.dataUrl;
      img.alt = fileData.name;
      mediaBox.appendChild(img);
    } else if (fileData.isAudio) {
      mediaBox.innerHTML = `
        <div style="text-align: center; padding: 2rem; width: 100%;">
          <i class="fa-solid fa-file-audio" style="font-size: 4rem; color: var(--manus-purple); margin-bottom: 1rem;"></i>
          <h4 style="margin-bottom: 1rem;">${fileData.name}</h4>
          <audio controls autoplay style="width: 80%;">
            <source src="${fileData.dataUrl || '#'}" type="audio/mpeg">
            Seu navegador não suporta a execução de áudio.
          </audio>
        </div>
      `;
    } else {
      mediaBox.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-main);">
          <i class="fa-solid ${fileData.isPdf ? 'fa-file-pdf' : 'fa-file-lines'}" style="font-size: 4.5rem; color: ${fileData.color || 'var(--accent-cyan)'}; margin-bottom: 1rem;"></i>
          <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">${fileData.name}</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 400px; margin: 0 auto 1.5rem;">
            ${fileData.content || 'Documento pronto para leitura e validação de compliance.'}
          </p>
          <span class="demand-tag alta">Documento Autenticado NexusFlow</span>
        </div>
      `;
    }

    modalFilePreview.classList.add('active');
  }

  function triggerRealFileDownload(fileData) {
    if (!fileData) return;

    let blobUrl = fileData.dataUrl;

    if (!blobUrl) {
      const content = fileData.content || `Conteúdo do documento ${fileData.name} do sistema NexusFlow.`;
      const blob = new Blob([content], { type: fileData.mimeType || 'text/plain' });
      blobUrl = URL.createObjectURL(blob);
    }

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileData.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (document.getElementById('close-modal-preview')) {
    document.getElementById('close-modal-preview').addEventListener('click', () => {
      modalFilePreview.classList.remove('active');
    });
  }

  if (document.getElementById('btn-modal-download-file')) {
    document.getElementById('btn-modal-download-file').addEventListener('click', () => {
      if (state.activePreviewFile) triggerRealFileDownload(state.activePreviewFile);
    });
  }

  // NAVEGAÇÃO ENTRE VISÕES
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
      'view-chat': 'Atendimento & Central de Chat',
      'view-kanban': 'Quadro de Gerenciamento de Demandas',
      'view-kpi': 'Dashboard de KPIs & Analytics',
      'view-integrations': 'Integração WhatsApp Cloud API & Manus AI',
      'view-files': 'Central de Arquivos e Documentos'
    };
    pageTitle.textContent = titlesMap[viewId] || 'NexusFlow';

    if (viewId === 'view-kanban') renderKanban();
    if (viewId === 'view-kpi') renderCharts();
    if (viewId === 'view-files') renderFilesGrid();
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => switchView(item.getAttribute('data-view')));
  });

  function getFilteredContacts() {
    return state.contacts.filter(contact => {
      const matchesSearch = contact.name.toLowerCase().includes(state.searchQuery) || 
                            contact.company.toLowerCase().includes(state.searchQuery) || 
                            contact.phone.includes(state.searchQuery);
      
      if (state.currentFilter === 'minhas') {
        return matchesSearch && contact.assignedTo === 'Pedro Alves';
      }
      if (state.currentFilter === 'fila') {
        return matchesSearch && contact.isQueue;
      }
      return matchesSearch;
    });
  }

  function renderContactsList() {
    contactsListContainer.innerHTML = '';
    const filtered = getFilteredContacts();

    filtered.forEach(contact => {
      const card = document.createElement('div');
      card.className = `contact-card ${contact.id === state.activeContactId ? 'active' : ''}`;
      card.addEventListener('click', () => selectContact(contact.id));

      card.innerHTML = `
        <div class="contact-avatar-wrapper">
          <div class="contact-avatar">${contact.avatar}</div>
          <div class="whatsapp-badge"><i class="fa-brands fa-whatsapp"></i></div>
        </div>
        <div class="contact-details">
          <div class="contact-top-row">
            <span class="contact-name">${contact.name}</span>
            <span class="contact-time">${contact.time}</span>
          </div>
          <div class="contact-last-msg">${contact.lastMsg}</div>
          <div class="contact-tags">
            <span class="tag-badge ${contact.priority}">${contact.demandStatus}</span>
          </div>
        </div>
      `;
      contactsListContainer.appendChild(card);
    });
  }

  if (contactSearch) {
    contactSearch.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      renderContactsList();
    });
  }

  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentFilter = tab.getAttribute('data-filter');
      renderContactsList();
    });
  });

  function selectContact(contactId) {
    state.activeContactId = contactId;
    const contact = state.contacts.find(c => c.id === contactId);
    if (!contact) return;
    contact.unread = 0;

    document.getElementById('active-chat-avatar').textContent = contact.avatar;
    document.getElementById('active-chat-name').textContent = contact.name;
    document.getElementById('active-chat-phone').textContent = `${contact.phone} • Atendente: ${contact.assignedTo}`;
    document.getElementById('side-info-company').textContent = contact.company;
    document.getElementById('side-info-demand-title').textContent = contact.demandTitle;
    document.getElementById('side-info-demand-desc').textContent = contact.demandDesc;
    document.getElementById('side-info-demand-status').textContent = contact.demandStatus;

    renderContactsList();
    renderMessages();
  }

  function renderMessages() {
    messagesContainer.innerHTML = '';
    const msgList = state.messages[state.activeContactId] || [];

    msgList.forEach(msg => {
      const bubble = document.createElement('div');
      bubble.className = `message-bubble ${msg.type}`;

      let fileHtml = '';
      if (msg.file) {
        if (msg.file.isImage && msg.file.dataUrl) {
          fileHtml = `
            <div style="margin-bottom: 0.5rem; cursor: pointer; overflow: hidden; border-radius: var(--radius-md);" class="msg-image-clickable">
              <img src="${msg.file.dataUrl}" alt="${msg.file.name}" style="max-width: 100%; max-height: 220px; border-radius: var(--radius-md); object-fit: cover;">
            </div>
          `;
        } else {
          const iconClass = msg.file.isPdf ? 'fa-file-pdf' : (msg.file.isImage ? 'fa-file-image' : 'fa-file-lines');
          fileHtml = `
            <div class="file-attachment-card">
              <div class="file-icon"><i class="fa-solid ${iconClass}"></i></div>
              <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 0.82rem;">${msg.file.name}</div>
                <div style="font-size: 0.7rem; opacity: 0.7;">${msg.file.size} • Documento</div>
              </div>
              <div style="display: flex; gap: 0.3rem;">
                <button class="btn-icon btn-preview-file" style="width: 28px; height: 28px; font-size: 0.7rem;" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
                <button class="btn-icon btn-dl-file" style="width: 28px; height: 28px; font-size: 0.7rem;" title="Baixar"><i class="fa-solid fa-download"></i></button>
              </div>
            </div>
          `;
        }
      }

      let audioHtml = '';
      if (msg.isAudio) {
        audioHtml = `
          <div class="audio-player-box">
            <div class="audio-play-btn"><i class="fa-solid fa-play"></i></div>
            <div class="audio-waveform"></div>
            <span style="font-size: 0.7rem; color: var(--text-muted);">0:42</span>
          </div>
        `;
      }

      bubble.innerHTML = `
        <div class="message-content">
          ${msg.type === 'manus' ? '<div class="message-sender-tag" style="color: var(--manus-purple);"><i class="fa-solid fa-robot"></i> Manus AI Copilot</div>' : ''}
          ${fileHtml}
          ${audioHtml}
          <div>${msg.text}</div>
          <div class="message-meta">
            <span>${msg.time}</span>
            ${msg.type === 'outgoing' ? '<i class="fa-solid fa-check-double" style="color: var(--accent-cyan);"></i>' : ''}
          </div>
        </div>
      `;

      const btnPreview = bubble.querySelector('.btn-preview-file');
      if (btnPreview) btnPreview.addEventListener('click', () => openFilePreviewModal(msg.file));

      const btnDl = bubble.querySelector('.btn-dl-file');
      if (btnDl) btnDl.addEventListener('click', () => triggerRealFileDownload(msg.file));

      const imgClickable = bubble.querySelector('.msg-image-clickable');
      if (imgClickable) imgClickable.addEventListener('click', () => openFilePreviewModal(msg.file));

      messagesContainer.appendChild(bubble);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async function sendMessage(textOverride = null, fileData = null) {
    const text = textOverride || messageInput.value.trim();
    if (!text && !fileData) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newMsg = {
      id: Date.now(),
      type: 'outgoing',
      sender: 'Pedro Alves',
      text: text || (fileData ? `Arquivo anexado: ${fileData.name}` : ''),
      time: timeStr,
      file: fileData
    };

    if (!state.messages[state.activeContactId]) {
      state.messages[state.activeContactId] = [];
    }
    state.messages[state.activeContactId].push(newMsg);

    const contact = state.contacts.find(c => c.id === state.activeContactId);
    if (contact) {
      contact.lastMsg = text || (fileData ? fileData.name : 'Mídia');
      contact.time = timeStr;
    }

    messageInput.value = '';
    renderMessages();
    renderContactsList();
  }

  btnSendMessage.addEventListener('click', () => sendMessage());
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // UPLOAD E ARRASTAR/SOLTAR
  function handleFileSelected(file) {
    uploadFileToBackend(file).then(processedFile => {
      sendMessage('', processedFile);
      state.files.unshift({
        id: processedFile.id || Date.now(),
        name: processedFile.name,
        type: processedFile.mimeType || 'Documento',
        size: processedFile.size,
        date: 'Agora',
        icon: processedFile.isPdf ? 'fa-file-pdf' : (processedFile.isImage ? 'fa-file-image' : 'fa-file'),
        color: processedFile.isPdf ? '#f43f5e' : (processedFile.isImage ? '#06b6d4' : '#8b5cf6'),
        dataUrl: processedFile.dataUrl,
        isImage: processedFile.isImage,
        isPdf: processedFile.isPdf
      });
      renderFilesGrid();
    });
  }

  if (btnTriggerUpload) btnTriggerUpload.addEventListener('click', () => fileUploadInput.click());
  if (document.getElementById('chip-send-file')) document.getElementById('chip-send-file').addEventListener('click', () => fileUploadInput.click());
  if (document.getElementById('btn-upload-file-central')) document.getElementById('btn-upload-file-central').addEventListener('click', () => fileUploadInput.click());

  fileUploadInput.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(file => handleFileSelected(file));
  });

  [messagesContainer, messageInput].forEach(dropZone => {
    if (!dropZone) return;
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); messagesContainer.style.backgroundColor = 'rgba(139, 92, 246, 0.08)'; });
    dropZone.addEventListener('dragleave', () => { messagesContainer.style.backgroundColor = 'var(--bg-primary)'; });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      messagesContainer.style.backgroundColor = 'var(--bg-primary)';
      if (e.dataTransfer.files) Array.from(e.dataTransfer.files).forEach(file => handleFileSelected(file));
    });
  });

  // ==========================================
  // BOTÕES MANUS AI COPILOT
  // ==========================================
  const chipManusSuggest = document.getElementById('chip-manus-suggest');
  if (chipManusSuggest) {
    chipManusSuggest.addEventListener('click', async () => {
      const contact = state.contacts.find(c => c.id === state.activeContactId);
      if (!contact) return;
      
      const aiData = await callManusAiTriagem(contact);
      messageInput.value = `🤖 Manus AI: ${aiData.suggestedReply}`;
      messageInput.focus();
    });
  }

  const btnManusAutoReply = document.getElementById('btn-manus-auto-reply');
  if (btnManusAutoReply) {
    btnManusAutoReply.addEventListener('click', async () => {
      const contact = state.contacts.find(c => c.id === state.activeContactId);
      if (!contact) return;

      const aiData = await callManusAiTriagem(contact);
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      state.messages[state.activeContactId].push({
        id: Date.now(),
        type: 'manus',
        sender: 'Manus AI Copilot',
        text: `⚡ **Resposta Autônoma (Agente Manus)**: "${aiData.suggestedReply}"`,
        time: timeStr
      });

      renderMessages();
    });
  }

  async function openManusSummaryModal() {
    const summaryFormattedText = await callManusAiSintese();
    document.getElementById('manus-summary-text').innerHTML = summaryFormattedText.replace(/\n/g, '<br>');
    modalManusSummary.classList.add('active');
  }

  const btnTriggerManusSummary = document.getElementById('btn-trigger-manus-summary');
  if (btnTriggerManusSummary) btnTriggerManusSummary.addEventListener('click', openManusSummaryModal);

  const btnOpenManusAssistant = document.getElementById('btn-open-manus-assistant');
  if (btnOpenManusAssistant) btnOpenManusAssistant.addEventListener('click', openManusSummaryModal);

  if (document.getElementById('close-modal-manus')) document.getElementById('close-modal-manus').addEventListener('click', () => modalManusSummary.classList.remove('active'));
  if (document.getElementById('btn-close-manus-report')) document.getElementById('btn-close-manus-report').addEventListener('click', () => modalManusSummary.classList.remove('active'));

  // MODAL QR CODE REAL
  if (document.getElementById('btn-show-qr-modal')) {
    document.getElementById('btn-show-qr-modal').addEventListener('click', () => modalQrCode.classList.add('active'));
  }
  if (document.getElementById('close-modal-qr')) {
    document.getElementById('close-modal-qr').addEventListener('click', () => modalQrCode.classList.remove('active'));
  }

  // KANBAN REAL
  function renderKanban() {
    const columns = {
      'a-fazer': document.getElementById('col-a-fazer'),
      'em-andamento': document.getElementById('col-em-andamento'),
      'aguardando': document.getElementById('col-aguardando'),
      'concluido': document.getElementById('col-concluido')
    };

    Object.values(columns).forEach(col => { if (col) col.innerHTML = ''; });
    const counts = { 'a-fazer': 0, 'em-andamento': 0, 'aguardando': 0, 'concluido': 0 };

    state.kanbanDemands.forEach(card => {
      counts[card.status]++;
      const cardEl = document.createElement('div');
      cardEl.className = 'kanban-card';
      cardEl.draggable = true;
      cardEl.setAttribute('data-id', card.id);

      cardEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="demand-tag ${card.priority}">Prioridade ${card.priority.toUpperCase()}</span>
          <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-subtle);">${card.id}</span>
        </div>
        <div class="demand-title">${card.title}</div>
        <div style="font-size: 0.78rem; color: var(--text-muted);"><i class="fa-regular fa-building"></i> ${card.client}</div>
        <div class="demand-footer">
          <span><i class="fa-regular fa-user"></i> ${card.agent}</span>
          <span style="color: var(--accent-amber);"><i class="fa-regular fa-clock"></i> ${card.sla}</span>
        </div>
      `;

      cardEl.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.id);
        cardEl.classList.add('dragging');
      });

      cardEl.addEventListener('dragend', () => cardEl.classList.remove('dragging'));
      if (columns[card.status]) columns[card.status].appendChild(cardEl);
    });

    if (document.getElementById('count-a-fazer')) document.getElementById('count-a-fazer').textContent = counts['a-fazer'];
    if (document.getElementById('count-em-andamento')) document.getElementById('count-em-andamento').textContent = counts['em-andamento'];
    if (document.getElementById('count-aguardando')) document.getElementById('count-aguardando').textContent = counts['aguardando'];
    if (document.getElementById('count-concluido')) document.getElementById('count-concluido').textContent = counts['concluido'];

    document.querySelectorAll('.kanban-column').forEach(col => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.style.backgroundColor = 'var(--bg-tertiary)'; });
      col.addEventListener('dragleave', () => col.style.backgroundColor = 'var(--bg-secondary)');
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.style.backgroundColor = 'var(--bg-secondary)';
        const cardId = e.dataTransfer.getData('text/plain');
        const newStatus = col.getAttribute('data-status');

        const demand = state.kanbanDemands.find(d => d.id === cardId);
        if (demand && demand.status !== newStatus) {
          demand.status = newStatus;
          renderKanban();
        }
      });
    });
  }

  if (document.getElementById('btn-create-demand-modal')) document.getElementById('btn-create-demand-modal').addEventListener('click', () => modalNewDemand.classList.add('active'));
  if (document.getElementById('btn-quick-new-demand')) document.getElementById('btn-quick-new-demand').addEventListener('click', () => modalNewDemand.classList.add('active'));
  if (document.getElementById('close-modal-demand')) document.getElementById('close-modal-demand').addEventListener('click', () => modalNewDemand.classList.remove('active'));
  if (document.getElementById('btn-cancel-demand')) document.getElementById('btn-cancel-demand').addEventListener('click', () => modalNewDemand.classList.remove('active'));

  if (document.getElementById('btn-save-demand')) {
    document.getElementById('btn-save-demand').addEventListener('click', () => {
      const title = document.getElementById('demand-title-input').value.trim();
      const client = document.getElementById('demand-client-select').value;
      const priority = document.getElementById('demand-priority-select').value;

      if (!title) return;

      const newId = `DEM-${100 + state.kanbanDemands.length + 1}`;
      state.kanbanDemands.unshift({
        id: newId,
        title: title,
        client: client,
        status: 'a-fazer',
        priority: priority,
        agent: 'Pedro Alves',
        sla: priority === 'alta' ? '2h restantes' : '24h restantes'
      });

      document.getElementById('demand-title-input').value = '';
      modalNewDemand.classList.remove('active');
      renderKanban();
    });
  }

  // RENDERIZAÇÃO CENTRAL DE ARQUIVOS
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
          <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background-color: ${file.color || 'var(--accent-violet)'}20; color: ${file.color || 'var(--accent-violet)'}; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            <i class="fa-solid ${file.icon || 'fa-file'}"></i>
          </div>
          <div style="overflow: hidden;">
            <div style="font-weight: 700; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${file.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-subtle);">${file.size} • ${file.date}</div>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
          <button class="btn-secondary btn-view-file-grid" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;">Visualizar</button>
          <button class="btn-primary btn-dl-file-grid" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;"><i class="fa-solid fa-download"></i></button>
        </div>
      `;

      card.querySelector('.btn-view-file-grid').addEventListener('click', () => openFilePreviewModal(file));
      card.querySelector('.btn-dl-file-grid').addEventListener('click', () => triggerRealFileDownload(file));

      container.appendChild(card);
    });
  }

  // CHARTS.JS DASHBOARD
  let chartVolumeInstance = null;
  let chartAgentInstance = null;

  function renderCharts() {
    if (chartVolumeInstance) chartVolumeInstance.destroy();
    if (chartAgentInstance) chartAgentInstance.destroy();

    const ctxVolume = document.getElementById('chart-hourly-volume').getContext('2d');
    chartVolumeInstance = new Chart(ctxVolume, {
      type: 'line',
      data: {
        labels: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
        datasets: [
          {
            label: 'Atendimentos Recebidos',
            data: [12, 25, 45, 38, 20, 52, 60, 42],
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'Demandas Concluídas',
            data: [8, 20, 40, 35, 18, 48, 55, 39],
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.15)',
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });

    const ctxAgent = document.getElementById('chart-agent-performance').getContext('2d');
    chartAgentInstance = new Chart(ctxAgent, {
      type: 'bar',
      data: {
        labels: ['Pedro Alves', 'Mariana Costa', 'Lucas Silva', 'Gabriel Souza'],
        datasets: [{
          label: 'Chamados Concluídos',
          data: [58, 42, 35, 29],
          backgroundColor: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }

  function addManusLog(msg) {
    if (!manusAiLogs) return;
    const div = document.createElement('div');
    div.textContent = msg;
    manusAiLogs.appendChild(div);
    manusAiLogs.scrollTop = manusAiLogs.scrollHeight;
  }

  // TEMA (DARK/LIGHT)
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    themeToggleBtn.innerHTML = newTheme === 'dark' ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
  });

  // Inicialização Inicial
  renderContactsList();
  selectContact(1);
  checkBackendConnection();
});
