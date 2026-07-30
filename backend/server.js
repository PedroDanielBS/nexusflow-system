// ==========================================================================
// NEXUSFLOW - BACK-END REST API SERVER
// Motor de Triagem Inteligente, Workflow Multi-Papéis & Google Drive Engine
// ==========================================================================

const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 8081;

// ============================================
// BANCO DE DADOS EM MEMÓRIA DO SERVIDOR
// ============================================
let db = {
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
      isQueue: true
    }
  ],

  messages: {
    1: [
      { id: 101, type: 'incoming', sender: 'Carlos Construtora', text: 'Olá Pedro, boa tarde! Tudo bem?', time: '12:30' },
      { id: 102, type: 'outgoing', sender: 'Pedro Alves', text: 'Boa tarde, Carlos! Tudo ótimo por aqui. Como posso te ajudar hoje?', time: '12:32' },
      { id: 103, type: 'incoming', sender: 'Carlos Construtora', text: 'Envei a medição da obra em PDF. Consegue revisar para liberar a fatura?', time: '12:45', file: { id: 1001, name: 'Medicao_Engenharia_Julho.pdf', type: 'pdf', size: '2.4 MB', isPdf: true } }
    ],
    2: [
      { id: 201, type: 'incoming', sender: 'Dra. Mariana Costa', text: 'O relatório financeiro de julho já foi emitido?', time: '11:20' }
    ]
  },

  // FILA DE DEMANDAS - Geradas pela IA automaticamente a partir das conversas
  demands: [
    {
      id: 'DEM-001',
      title: 'Revisão e Aprovação de Medição de Obra (PDF)',
      description: 'Cliente solicitou revisão da medição de engenharia em PDF para liberação de fatura.',
      clientName: 'Carlos Construtora S.A.',
      contactId: 1,
      stage: 'relacionamento', // relacionamento → execucao → auditoria-ia → atendimento → concluido
      priority: 'emergencia',   // emergencia, alta, media, baixa
      complexity: 'Alta (Multi-departamentos)',
      slaSuggested: '15 min',
      slaDeadline: null,
      assignedRelacionamento: 'Pedro Alves',
      assignedExecucao: null,
      assignedAtendimento: null,
      aiTriageNotes: 'Palavra-chave "urgência" detectada. Medição de obra requer validação financeira imediata.',
      aiAuditResult: null,
      gdriveArchived: false,
      createdAt: new Date().toISOString(),
      createdBy: 'ia-auto'  // 'ia-auto' = gerado pela IA, 'manual' = criado manualmente
    },
    {
      id: 'DEM-002',
      title: 'Emissão de Relatório Financeiro do 2º Trimestre',
      description: 'Cliente questionou se o relatório financeiro de julho já foi emitido.',
      clientName: 'Dra. Mariana Costa',
      contactId: 2,
      stage: 'execucao',
      priority: 'alta',
      complexity: 'Média (Financeiro)',
      slaSuggested: '1h',
      slaDeadline: null,
      assignedRelacionamento: 'Pedro Alves',
      assignedExecucao: 'Gabriel Souza',
      assignedAtendimento: null,
      aiTriageNotes: 'Solicitação financeira direta. Impacto contábil no trimestre.',
      aiAuditResult: null,
      gdriveArchived: false,
      createdAt: new Date().toISOString(),
      createdBy: 'ia-auto'
    }
  ],

  // Arquivos salvos/arquivados no Google Drive
  gdriveFiles: [
    { id: 'gf-001', name: 'Medicao_Engenharia_Julho.pdf', client: 'Carlos Construtora S.A.', folder: 'Carlos Construtora / 2026 / Medições', size: '2.4 MB', status: 'Pendente Arquivamento' }
  ]
};

// ============================================
// MOTOR DE TRIAGEM INTELIGENTE (IA)
// Lê o contexto da conversa e gera uma demanda
// ============================================
function iaReadConversationAndGenerateDemand(contactId) {
  const contact = db.contacts.find(c => c.id === Number(contactId));
  const msgs = db.messages[contactId] || [];

  if (!contact || msgs.length === 0) return null;

  // Concatena todo o texto da conversa para a IA "ler"
  const conversationText = msgs.map(m => m.text || '').join(' ').toLowerCase();
  const clientName = contact.name;

  // IA classifica prioridade e complexidade com base no contexto
  let priority, priorityLabel, complexity, slaSuggested, aiNotes, title, description;

  if (conversationText.includes('urgente') || conversationText.includes('urgência') || conversationText.includes('medição') || conversationText.includes('parado') || conversationText.includes('erro')) {
    priority = 'emergencia';
    priorityLabel = 'Emergência / Crítico';
    complexity = 'Alta (Multi-departamentos)';
    slaSuggested = '15 min';
    aiNotes = 'Contexto de urgência detectado na conversa. Solicitação requer ação imediata de múltiplos departamentos.';
  } else if (conversationText.includes('relatório') || conversationText.includes('financeiro') || conversationText.includes('fatura') || conversationText.includes('contrato')) {
    priority = 'alta';
    priorityLabel = 'Alta Prioridade';
    complexity = 'Média (Financeiro)';
    slaSuggested = '1h';
    aiNotes = 'Solicitação financeira identificada. Impacto direto no fluxo contábil.';
  } else if (conversationText.includes('dúvida') || conversationText.includes('suporte') || conversationText.includes('ajuda') || conversationText.includes('informação')) {
    priority = 'media';
    priorityLabel = 'Média Prioridade';
    complexity = 'Normal (Suporte)';
    slaSuggested = '4h';
    aiNotes = 'Dúvida ou suporte geral identificado.';
  } else {
    priority = 'baixa';
    priorityLabel = 'Baixa Prioridade';
    complexity = 'Baixa (Rotina)';
    slaSuggested = '24h';
    aiNotes = 'Solicitação de rotina sem indicadores de urgência.';
  }

  // Gera título e descrição com base na última mensagem
  const lastIncoming = msgs.filter(m => m.type === 'incoming').pop();
  title = lastIncoming ? lastIncoming.text.substring(0, 80) : 'Solicitação via WhatsApp';
  description = `Cliente ${clientName} solicitou via WhatsApp: "${lastIncoming ? lastIncoming.text : 'Nova conversa'}". Arquivos: ${msgs.filter(m => m.file).map(m => m.file.name).join(', ') || 'Nenhum'}`;

  // Cria o card de demanda automaticamente
  const newDemand = {
    id: `DEM-${String(db.demands.length + 1).padStart(3, '0')}`,
    title,
    description,
    clientName,
    contactId: Number(contactId),
    stage: 'relacionamento',
    priority,
    complexity,
    slaSuggested,
    slaDeadline: null,
    assignedRelacionamento: 'Pedro Alves',
    assignedExecucao: null,
    assignedAtendimento: null,
    aiTriageNotes: aiNotes,
    aiAuditResult: null,
    gdriveArchived: false,
    createdAt: new Date().toISOString(),
    createdBy: 'ia-auto'
  };

  db.demands.unshift(newDemand);

  return {
    demand: newDemand,
    triage: {
      priority,
      priorityLabel,
      complexity,
      slaSuggested,
      aiNotes
    }
  };
}

// ============================================
// MOTOR DE CLASSIFICAÇÃO DE PRIORIDADE (IA)
// Executado quando Relacionamento envia para Execução
// ============================================
function iaClassifyOnDispatch(demandId) {
  const demand = db.demands.find(d => d.id === demandId);
  if (!demand) return null;

  const msgs = db.messages[demand.contactId] || [];
  const conversationText = msgs.map(m => m.text || '').join(' ').toLowerCase();

  // Analisa fila de espera (quantas demandas estão na frente)
  const queueSize = db.demands.filter(d => d.stage === 'execucao').length;

  // Recalcula prioridade com informações atualizadas
  let recalcNotes = `Fila de execução atual: ${queueSize} demandas. `;

  if (demand.priority === 'emergencia') {
    recalcNotes += 'Prioridade máxima mantida — esta demanda deve ser atendida antes de todas as outras na fila.';
  } else if (queueSize >= 3) {
    recalcNotes += 'Fila congestionada. Considerar reclassificação de prioridade.';
  } else {
    recalcNotes += 'Fila normal. SLA dentro do prazo esperado.';
  }

  demand.aiTriageNotes = demand.aiTriageNotes + ' | Reanálise no despacho: ' + recalcNotes;

  return {
    demandId: demand.id,
    priority: demand.priority,
    complexity: demand.complexity,
    slaSuggested: demand.slaSuggested,
    queueSize,
    reclassificationNotes: recalcNotes
  };
}

// ============================================
// MOTOR DE AUDITORIA PRELIMINAR (IA)
// Compara o trabalho entregue com a solicitação original
// ============================================
function iaAuditDelivery(demandId, executionNotes) {
  const demand = db.demands.find(d => d.id === demandId);
  if (!demand) return null;

  const msgs = db.messages[demand.contactId] || [];
  const clientRequest = msgs.filter(m => m.type === 'incoming').map(m => m.text || '').join(' ').toLowerCase();
  const deliveryText = (executionNotes || '').toLowerCase();

  let warnings = [];
  let approved = true;

  // Verifica se o cliente pediu PDF e a entrega menciona PDF/anexo
  if (clientRequest.includes('pdf') && !deliveryText.includes('pdf') && !deliveryText.includes('anexo') && !deliveryText.includes('documento')) {
    warnings.push('Cliente solicitou documento PDF, mas a entrega não referencia o documento conferido.');
    approved = false;
  }

  // Verifica se o cliente pediu medição/valor e a entrega confirma
  if ((clientRequest.includes('medição') || clientRequest.includes('valor')) && !deliveryText.includes('valor') && !deliveryText.includes('aprovad')) {
    warnings.push('Solicitação menciona medição/valor financeiro, mas a entrega não contém confirmação de valor aprovado.');
    approved = false;
  }

  // Verifica se o cliente pediu relatório e a entrega referencia
  if (clientRequest.includes('relatório') && !deliveryText.includes('relatório') && !deliveryText.includes('relatorio') && !deliveryText.includes('emitido')) {
    warnings.push('Cliente solicitou relatório, mas a entrega não menciona a emissão do relatório.');
    approved = false;
  }

  const auditResult = {
    approved,
    score: approved ? '100% Compatível' : 'Divergência Encontrada',
    warnings: warnings.length > 0 ? warnings : ['Conferência de dados realizada com sucesso. Nenhuma divergência básica encontrada.'],
    recommendation: approved
      ? 'Encaminhar para o Analista de Atendimento para envio ao cliente.'
      : 'Devolver ao Analista de Relacionamento para correção antes do envio ao cliente.',
    timestamp: new Date().toISOString()
  };

  demand.aiAuditResult = auditResult;

  if (approved) {
    demand.stage = 'atendimento';
  } else {
    demand.stage = 'relacionamento'; // Devolve com alerta
  }

  return auditResult;
}

// ============================================
// MOTOR DE FECHAMENTO AUTOMÁTICO (IA)
// Identifica conclusão, marca como concluído e arquiva
// ============================================
function iaAutoCloseAndArchive(demandId) {
  const demand = db.demands.find(d => d.id === demandId);
  if (!demand) return null;

  demand.stage = 'concluido';
  demand.gdriveArchived = true;

  // Busca arquivos compartilhados na conversa e "arquiva" no Google Drive
  const msgs = db.messages[demand.contactId] || [];
  const sharedFiles = msgs.filter(m => m.file).map(m => m.file);

  sharedFiles.forEach(file => {
    const exists = db.gdriveFiles.find(gf => gf.name === file.name);
    if (!exists) {
      db.gdriveFiles.push({
        id: `gf-${Date.now()}`,
        name: file.name,
        client: demand.clientName,
        folder: `${demand.clientName} / 2026 / Documentos`,
        size: file.size || '1.0 MB',
        status: 'Arquivado no Google Drive'
      });
    }
  });

  return {
    demand,
    archivedFiles: sharedFiles.map(f => f.name),
    message: `Demanda ${demand.id} marcada como concluída. ${sharedFiles.length} arquivo(s) arquivado(s) na pasta do cliente no Google Drive.`
  };
}

// ============================================
// SERVIDOR HTTP
// ============================================
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // ── HEALTH CHECK ──
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/api/v1/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'online', system: 'NexusFlow Demand Triage Engine', port: PORT, timestamp: new Date().toISOString() }));
  }

  // ── ESTADO COMPLETO ──
  if (req.method === 'GET' && url.pathname === '/api/v1/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(db));
  }

  // ── IA: LER CONVERSA E GERAR DEMANDA AUTOMATICAMENTE ──
  if (req.method === 'POST' && url.pathname === '/api/v1/ai/generate-demand') {
    return parseBody(req, (body) => {
      const result = iaReadConversationAndGenerateDemand(body.contactId);
      if (!result) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Não foi possível gerar demanda — conversa vazia ou contato inexistente.' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...result }));
    });
  }

  // ── DESPACHAR: RELACIONAMENTO → EXECUÇÃO (IA reclassifica) ──
  if (req.method === 'POST' && url.pathname === '/api/v1/demands/dispatch') {
    return parseBody(req, (body) => {
      const demand = db.demands.find(d => d.id === body.demandId);
      if (!demand) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Demanda não encontrada' })); }

      demand.stage = 'execucao';
      demand.assignedExecucao = body.execucaoAgent || 'Lucas Silva';
      demand.slaDeadline = body.slaDeadline || demand.slaSuggested;

      const classification = iaClassifyOnDispatch(demand.id);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, demand, classification }));
    });
  }

  // ── EXECUÇÃO CONCLUÍDA → IA AUDITA ──
  if (req.method === 'POST' && url.pathname === '/api/v1/demands/finish-execution') {
    return parseBody(req, (body) => {
      const demand = db.demands.find(d => d.id === body.demandId);
      if (!demand) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Demanda não encontrada' })); }

      demand.stage = 'auditoria-ia';
      const auditResult = iaAuditDelivery(demand.id, body.executionNotes || '');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, demand, audit: auditResult }));
    });
  }

  // ── ATENDIMENTO ENVIA AO CLIENTE → IA FECHA E ARQUIVA ──
  if (req.method === 'POST' && url.pathname === '/api/v1/demands/close') {
    return parseBody(req, (body) => {
      const result = iaAutoCloseAndArchive(body.demandId);
      if (!result) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Demanda não encontrada' })); }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...result }));
    });
  }

  // ── MOVER DEMANDA MANUALMENTE ENTRE ETAPAS ──
  if (req.method === 'POST' && url.pathname === '/api/v1/demands/move') {
    return parseBody(req, (body) => {
      const demand = db.demands.find(d => d.id === body.demandId);
      if (!demand) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Demanda não encontrada' })); }

      demand.stage = body.nextStage;
      if (body.agent) {
        if (body.nextStage === 'execucao') demand.assignedExecucao = body.agent;
        if (body.nextStage === 'atendimento') demand.assignedAtendimento = body.agent;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, demand }));
    });
  }

  // ── CRIAR DEMANDA MANUALMENTE ──
  if (req.method === 'POST' && url.pathname === '/api/v1/demands/create') {
    return parseBody(req, (body) => {
      const newDemand = {
        id: `DEM-${String(db.demands.length + 1).padStart(3, '0')}`,
        title: body.title || 'Nova Demanda',
        description: body.description || '',
        clientName: body.clientName || 'Cliente',
        contactId: body.contactId || null,
        stage: 'relacionamento',
        priority: body.priority || 'media',
        complexity: body.complexity || 'Normal',
        slaSuggested: body.priority === 'emergencia' ? '15 min' : body.priority === 'alta' ? '1h' : body.priority === 'media' ? '4h' : '24h',
        slaDeadline: null,
        assignedRelacionamento: 'Pedro Alves',
        assignedExecucao: null,
        assignedAtendimento: null,
        aiTriageNotes: 'Demanda criada manualmente pelo analista.',
        aiAuditResult: null,
        gdriveArchived: false,
        createdAt: new Date().toISOString(),
        createdBy: 'manual'
      };

      db.demands.unshift(newDemand);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, demand: newDemand }));
    });
  }

  // ── NOVA MENSAGEM NO CHAT ──
  if (req.method === 'POST' && url.pathname === '/api/v1/messages') {
    return parseBody(req, (body) => {
      const cid = body.contactId;
      if (!db.messages[cid]) db.messages[cid] = [];
      db.messages[cid].push({
        id: Date.now(),
        type: body.type || 'outgoing',
        sender: body.sender || 'Pedro Alves',
        text: body.text || '',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        file: body.file || null
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
  }

  // ── SÍNTESE OPERACIONAL ──
  if (req.method === 'GET' && url.pathname === '/api/v1/ai/summary') {
    const totalDemands = db.demands.length;
    const byStage = {};
    db.demands.forEach(d => { byStage[d.stage] = (byStage[d.stage] || 0) + 1; });
    const emergencias = db.demands.filter(d => d.priority === 'emergencia' && d.stage !== 'concluido').length;
    const archived = db.gdriveFiles.filter(f => f.status.includes('Arquivado')).length;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      totalDemands,
      byStage,
      pendingEmergencias: emergencias,
      archivedFiles: archived,
      summary: `📊 ${totalDemands} demandas no sistema. ${emergencias} emergência(s) pendente(s). ${archived} arquivo(s) no Google Drive. Fila de execução: ${byStage['execucao'] || 0} demandas.`
    }));
  }

  // ── GOOGLE DRIVE: LISTAR ARQUIVOS ──
  if (req.method === 'GET' && url.pathname === '/api/v1/gdrive/files') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ files: db.gdriveFiles }));
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Rota não encontrada' }));
});

// Helper para parsear body JSON
function parseBody(req, callback) {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => {
    try { callback(JSON.parse(body || '{}')); }
    catch (err) { /* ignore parse errors */ callback({}); }
  });
}

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`NEXUSFLOW DEMAND TRIAGE ENGINE ON PORT ${PORT}`);
  console.log(`====================================================`);
});
