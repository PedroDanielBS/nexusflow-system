// ==========================================================================
// NEXUSFLOW - BACK-END REAL-TIME WEBSOCKET & REST API SERVER
// Motor UPA de Triagem de IA, Workflow Multi-Papéis & Google Drive Engine
// ==========================================================================

const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 8081;

// Banco de Dados em Memória / Persistência do Fluxo Operacional UPA
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
      demandTitle: 'Aprovação de Medição de Obra',
      demandDesc: 'Revisão de contrato financeiro e medição de engenharia.',
      demandStatus: 'Relacionamento',
      priority: 'emergencia', // UPA: emergencia, alta, media, baixa
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
      stage: 'relacionamento', // relacionamento, execucao, auditoria, atendimento, concluido
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
  gdriveFiles: [
    { id: 'gfile-101', name: 'Medicao_Engenharia_Julho.pdf', client: 'Carlos Construtora S.A.', folder: 'Carlos Construtora S.A. / 2026 / Medições', size: '2.4 MB', status: 'Arquivado no Drive' },
    { id: 'gfile-102', name: 'Relatorio_Financeiro_Q2.pdf', client: 'Dra. Mariana Costa', folder: 'Advocacia Costa / Financeiro', size: '1.8 MB', status: 'Arquivado no Drive' }
  ]
};

// Motor de Triagem Estilo UPA (Pronto-Socorro Operacional)
function performUpaTriage(messageText, demandTitle) {
  const textLower = (messageText || '').toLowerCase() + ' ' + (demandTitle || '').toLowerCase();

  if (textLower.includes('urgente') || textLower.includes('medição') || textLower.includes('parado') || textLower.includes('erro crítico') || textLower.includes('emergência')) {
    return {
      priority: 'emergencia',
      priorityName: 'Emergência / Crítico (Vermelho)',
      color: '#f43f5e',
      complexity: 'Alta (Multi-departamentos)',
      slaMinutes: 15,
      slaText: '15 min (Imediato)',
      recommendedAction: 'Disparar imediatamente para o Analista de Execução de Engenharia.',
      summary: 'Demanda de altíssima prioridade detectada por palavras de impacto crítico.'
    };
  }

  if (textLower.includes('relatório') || textLower.includes('financeiro') || textLower.includes('fatura') || textLower.includes('contrato')) {
    return {
      priority: 'alta',
      priorityName: 'Alta Prioridade (Laranja)',
      color: '#f97316',
      complexity: 'Média (Financeiro)',
      slaMinutes: 60,
      slaText: '1h (Fila Prioritária)',
      recommendedAction: 'Encaminhar ao Analista de Execução Financeira.',
      summary: 'Demanda com impacto financeiro direto.'
    };
  }

  if (textLower.includes('dúvida') || textLower.includes('suporte') || textLower.includes('ajuda')) {
    return {
      priority: 'media',
      priorityName: 'Média Prioridade (Amarelo)',
      color: '#eab308',
      complexity: 'Normal',
      slaMinutes: 240,
      slaText: '4h (Fila Padrão)',
      recommendedAction: 'Atendimento de suporte padrão.',
      summary: 'Solicitação de dúvida ou suporte geral.'
    };
  }

  return {
    priority: 'baixa',
    priorityName: 'Baixa Prioridade (Verde)',
    color: '#10b981',
    complexity: 'Baixa (Rotina)',
    slaMinutes: 1440,
    slaText: '24h (Fila Informativa)',
    recommendedAction: 'Agendar para resposta de rotina.',
    summary: 'Solicitação de rotina cadastral.'
  };
}

// Motor de Auditoria Preliminar de Qualidade via IA
function auditExecutionDelivery(clientRequestText, executionResultText) {
  const reqLower = (clientRequestText || '').toLowerCase();
  const resLower = (executionResultText || '').toLowerCase();

  let warnings = [];
  let approved = true;

  if (reqLower.includes('pdf') && !resLower.includes('pdf') && !resLower.includes('anexo')) {
    warnings.push('O cliente solicitou revisão de documento em PDF, mas o resultado final não menciona o anexo conferido.');
    approved = false;
  }

  if (reqLower.includes('medição') && !resLower.includes('valor') && !resLower.includes('aprova')) {
    warnings.push('Falta a confirmação expressa do valor aprovado na medição.');
    approved = false;
  }

  return {
    approved,
    warnings: warnings.length > 0 ? warnings : ['Conferência de dados realizada com sucesso. Nenhum erro básico detectado.'],
    auditScore: approved ? '100% Compatível' : 'Divergência Encontrada',
    timestamp: new Date().toISOString()
  };
}

// Criar Servidor HTTP
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Hub-Signature-256');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // 1. HEALTH CHECK
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/api/v1/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      system: 'NexusFlow UPA Triage & Multi-Role Pipeline Engine',
      port: PORT,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 2. BUSCAR ESTADO OPERACIONAL (GET /api/v1/state)
  if (req.method === 'GET' && url.pathname === '/api/v1/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(db));
    return;
  }

  // 3. TRIAGEM UPA DA IA (POST /api/v1/ai/triage-upa)
  if (req.method === 'POST' && url.pathname === '/api/v1/ai/triage-upa') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { text, demandTitle, clientName } = JSON.parse(body || '{}');
        const triageResult = performUpaTriage(text, demandTitle);

        // Gera o card automático de demanda triada pela IA
        const newDemandId = `DEM-${100 + db.kanbanDemands.length + 1}`;
        const autoCard = {
          id: newDemandId,
          title: demandTitle || 'Atendimento Gerado via WhatsApp',
          client: clientName || 'Cliente WhatsApp',
          stage: 'relacionamento',
          priority: triageResult.priority,
          complexity: triageResult.complexity,
          slaSuggested: triageResult.slaText,
          relacionamentoAgent: 'Pedro Alves',
          execucaoAgent: 'Lucas Silva',
          atendimentoAgent: 'Mariana Costa',
          auditAlert: null
        };

        db.kanbanDemands.unshift(autoCard);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'success',
          triage: triageResult,
          createdDemand: autoCard,
          timestamp: new Date().toISOString()
        }));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Erro ao executar triagem UPA' }));
      }
    });
    return;
  }

  // 4. AUDITORIA PRELIMINAR DE QUALIDADE DA IA (POST /api/v1/ai/audit-delivery)
  if (req.method === 'POST' && url.pathname === '/api/v1/ai/audit-delivery') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { demandId, clientRequestText, executionResultText } = JSON.parse(body || '{}');
        const auditResult = auditExecutionDelivery(clientRequestText, executionResultText);

        const demand = db.kanbanDemands.find(d => d.id === demandId);
        if (demand) {
          demand.auditAlert = auditResult;
          if (!auditResult.approved) {
            demand.stage = 'relacionamento'; // Devolve para o Analista de Relacionamento em caso de divergência
          } else {
            demand.stage = 'atendimento'; // Avança para o Analista de Atendimento enviar ao cliente
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', audit: auditResult, updatedDemand: demand }));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Erro na auditoria da IA' }));
      }
    });
    return;
  }

  // 5. ARQUIVAMENTO AUTOMÁTICO NO GOOGLE DRIVE (POST /api/v1/gdrive/archive)
  if (req.method === 'POST' && url.pathname === '/api/v1/gdrive/archive') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { fileName, clientName, folderName, size } = JSON.parse(body || '{}');
        const archiveRecord = {
          id: `gfile-${Date.now()}`,
          name: fileName || 'Documento_Cliente.pdf',
          client: clientName || 'Cliente Geral',
          folder: folderName || `${clientName} / 2026 / Documentos`,
          size: size || '2.0 MB',
          status: 'Arquivado no Google Drive'
        };

        db.gdriveFiles.unshift(archiveRecord);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, archive: archiveRecord }));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Erro no arquivamento Google Drive' }));
      }
    });
    return;
  }

  // 6. AVANÇAR ETAPA DO WORKFLOW (POST /api/v1/demands/stage)
  if (req.method === 'POST' && url.pathname === '/api/v1/demands/stage') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { demandId, nextStage, agentName } = JSON.parse(body || '{}');
        const demand = db.kanbanDemands.find(d => d.id === demandId);
        if (demand) {
          demand.stage = nextStage;
          if (nextStage === 'execucao') demand.execucaoAgent = agentName || 'Lucas Silva';
          if (nextStage === 'atendimento') demand.atendimentoAgent = agentName || 'Mariana Costa';
          if (nextStage === 'concluido') demand.slaSuggested = 'Concluído';
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, demand }));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Erro ao mover etapa' }));
      }
    });
    return;
  }

  // 7. NOVA MENSAGEM
  if (req.method === 'POST' && url.pathname === '/api/v1/messages') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { contactId, type, sender, text, file } = JSON.parse(body || '{}');

        if (!db.messages[contactId]) db.messages[contactId] = [];
        db.messages[contactId].push({
          id: Date.now(),
          type: type || 'outgoing',
          sender: sender || 'Pedro Alves',
          text: text || '',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          file: file || null
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Erro ao salvar mensagem' }));
      }
    });
    return;
  }

  // 8. LOGIN JWT
  if (req.method === 'POST' && url.pathname === '/api/v1/auth/login') {
    const token = crypto.randomBytes(32).toString('hex');
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': `nexusflow_session=${token}; HttpOnly; Secure; SameSite=None; Path=/`
    });
    res.end(JSON.stringify({ user: { id: 1, name: 'Pedro Alves' }, token, expiresIn: '24h', authenticated: true }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Rota não encontrada' }));
});

// Iniciar Servidor
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`NEXUSFLOW UPA TRIAGE & MULTI-ROLE PIPELINE ON PORT ${PORT}`);
  console.log(`====================================================`);
});
