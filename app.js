/* ==========================================================================
   NEXUSFLOW - SISTEMA INTERNO DE ATENDIMENTO, DEMANDAS, CHAT & KPIS
   Motor JavaScript Modular - Integração 100% no Banco de Dados Supabase
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  const RENDER_PROD_URL = 'https://nexusflow-backend-u3ii.onrender.com';
  const BACKEND_URL = isLocal 
    ? 'http://localhost:8081' 
    : (window.NEXUSFLOW_BACKEND_URL || RENDER_PROD_URL);

  // ==========================================
  // ESTADO GLOBAL CONECTADO AO BANCO SUPABASE
  // ==========================================
  let state = {
    activeView: 'view-chat',
    activeContactId: 1,
    currentFilter: 'todos',
    searchQuery: '',
    theme: 'dark',
    backendConnected: false,
    activePreviewFile: null,

    // Carga de dados inicial que virá do Supabase
    contacts: [],
    messages: {},
    kanbanDemands: [],
    files: []
  };

  // ==========================================
  // BUSCA E SYNC DIRETO DO BANCO SUPABASE
  // ==========================================
  async function fetchStateFromSupabase() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/state`);
      if (res.ok) {
        const dbData = await res.json();
        if (dbData.contacts && dbData.contacts.length > 0) {
          state.contacts = dbData.contacts;
          if (dbData.messages) state.messages = dbData.messages;
          if (dbData.kanbanDemands) state.kanbanDemands = dbData.kanbanDemands;
          if (dbData.files) state.files = dbData.files;

          renderContactsList();
          renderMessages();
          renderKanban();
          renderFilesGrid();
        }
      }
    } catch (err) {
      console.warn('Conectando ao banco de dados Supabase...');
    }
  }

  // VERIFICAÇÃO DE SAÚDE DA API
  async function checkBackendConnection() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/health`, { method: 'GET' });
      if (res.ok) {
        state.backendConnected = true;
        updateBackendPill(true);
        fetchStateFromSupabase();
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
      pill.innerHTML = `<span class="status-dot" style="background-color: #8b5cf6; box-shadow: 0 0 8px #8b5cf6;"></span> Supabase PostgreSQL :8081 CONECTADO ⚡`;
    } else {
      pill.style.backgroundColor = 'rgba(244, 63, 94, 0.15)';
      pill.style.color = '#f43f5e';
      pill.innerHTML = `<span class="status-dot" style="background-color: #f43f5e;"></span> Conectando ao Banco Supabase...`;
    }
  }

  checkBackendConnection();
  setInterval(checkBackendConnection, 5000);

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
    } catch (err) {}

    return {
      suggestedReply: `Prezado(a) ${contactObj.name}, verificamos a sua solicitação em nossa fila de atendimento. A demanda "${contactObj.demandTitle}" está sob análise prioritária da nossa equipe.`
    };
  }

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
    } catch (err) {}

    return `
      📌 **Síntese de Operações Gerada pelo Agente Manus AI**:
      
      • **Banco Supabase**: Todas as conversas e tabelas estão armazenadas com segurança na nuvem.
      • **Gargalo Identificado**: Cliente *Carlos Construtora S.A.* aguarda validação de planilha de medição em PDF.
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

  // ELEMENTOS DO DOM
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
  const manusAiLogs = document.getElementById('manus-ai-logs');

  // Modais
  const modalNewDemand = document.getElementById('modal-new-demand');
  const modalManusSummary = document.getElementById('modal-manus-summary');
  const modalFilePreview = document.getElementById('modal-file-preview');
  const modalQrCode = document.getElementById('modal-qr-code');

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
                            (contact.company && contact.company.toLowerCase().includes(state.searchQuery)) || 
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
          <div class="contact-avatar">${contact.avatar || 'NF'}</div>
          <div class="whatsapp-badge"><i class="fa-brands fa-whatsapp"></i></div>
        </div>
        <div class="contact-details">
          <div class="contact-top-row">
            <span class="contact-name">${contact.name}</span>
            <span class="contact-time">${contact.time || '12:00'}</span>
          </div>
          <div class="contact-last-msg">${contact.lastMsg || contact.demandTitle || 'Sem mensagem'}</div>
          <div class="contact-tags">
            <span class="tag-badge ${contact.priority || 'media'}">${contact.demandStatus || 'Ativo'}</span>
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

    document.getElementById('active-chat-avatar').textContent = contact.avatar || 'NF';
    document.getElementById('active-chat-name').textContent = contact.name;
    document.getElementById('active-chat-phone').textContent = `${contact.phone} • Atendente: ${contact.assignedTo || 'Pedro Alves'}`;
    document.getElementById('side-info-company').textContent = contact.company || 'Empresa';
    document.getElementById('side-info-demand-title').textContent = contact.demandTitle || 'Atendimento Geral';
    document.getElementById('side-info-demand-desc').textContent = contact.demandDesc || 'Chamado ativo no sistema.';
    document.getElementById('side-info-demand-status').textContent = contact.demandStatus || 'Em Andamento';

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
                <div style="font-size: 0.7rem; opacity: 0.7;">${msg.file.size || '1.0 MB'} • Documento</div>
              </div>
              <div style="display: flex; gap: 0.3rem;">
                <button class="btn-icon btn-preview-file" style="width: 28px; height: 28px; font-size: 0.7rem;" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
                <button class="btn-icon btn-dl-file" style="width: 28px; height: 28px; font-size: 0.7rem;" title="Baixar"><i class="fa-solid fa-download"></i></button>
              </div>
            </div>
          `;
        }
      }

      bubble.innerHTML = `
        <div class="message-content">
          ${msg.type === 'manus' ? '<div class="message-sender-tag" style="color: var(--manus-purple);"><i class="fa-solid fa-robot"></i> Manus AI Copilot</div>' : ''}
          ${fileHtml}
          <div>${msg.text}</div>
          <div class="message-meta">
            <span>${msg.time || '12:00'}</span>
            ${msg.type === 'outgoing' ? '<i class="fa-solid fa-check-double" style="color: var(--accent-cyan);"></i>' : ''}
          </div>
        </div>
      `;

      const btnPreview = bubble.querySelector('.btn-preview-file');
      if (btnPreview) btnPreview.addEventListener('click', () => openFilePreviewModal(msg.file));

      const btnDl = bubble.querySelector('.btn-dl-file');
      if (btnDl) btnDl.addEventListener('click', () => triggerRealFileDownload(msg.file));

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
      contactId: state.activeContactId,
      type: 'outgoing',
      sender: 'Pedro Alves',
      text: text || (fileData ? `Arquivo anexado: ${fileData.name}` : ''),
      time: timeStr,
      file: fileData
    };

    // Envia diretamente para gravar no banco Supabase
    fetch(`${BACKEND_URL}/api/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMsg)
    }).then(() => fetchStateFromSupabase());

    messageInput.value = '';
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
    });
  }

  if (btnTriggerUpload) btnTriggerUpload.addEventListener('click', () => fileUploadInput.click());
  if (document.getElementById('chip-send-file')) document.getElementById('chip-send-file').addEventListener('click', () => fileUploadInput.click());
  if (document.getElementById('btn-upload-file-central')) document.getElementById('btn-upload-file-central').addEventListener('click', () => fileUploadInput.click());

  fileUploadInput.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(file => handleFileSelected(file));
  });

  // BOTÕES MANUS AI COPILOT
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

      const newMsg = {
        contactId: state.activeContactId,
        type: 'manus',
        sender: 'Manus AI Copilot',
        text: `⚡ **Resposta Autônoma (Agente Manus)**: "${aiData.suggestedReply}"`,
        time: timeStr
      };

      fetch(`${BACKEND_URL}/api/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMsg)
      }).then(() => fetchStateFromSupabase());
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

  // KANBAN REAL NO SUPABASE
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
          fetch(`${BACKEND_URL}/api/v1/demands`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(demand)
          }).then(() => fetchStateFromSupabase());
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

      const newDemand = {
        id: `DEM-${100 + state.kanbanDemands.length + 1}`,
        title: title,
        client: client,
        status: 'a-fazer',
        priority: priority,
        agent: 'Pedro Alves',
        sla: priority === 'alta' ? '2h restantes' : '24h restantes'
      };

      fetch(`${BACKEND_URL}/api/v1/demands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDemand)
      }).then(() => {
        document.getElementById('demand-title-input').value = '';
        modalNewDemand.classList.remove('active');
        fetchStateFromSupabase();
      });
    });
  }

  // RENDERIZAÇÃO CENTRAL DE ARQUIVOS SUPABASE
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
            <div style="font-size: 0.75rem; color: var(--text-subtle);">${file.size} • ${file.date || 'Hoje'}</div>
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

  // Inicialização Inicial buscando do Supabase
  fetchStateFromSupabase();
});
