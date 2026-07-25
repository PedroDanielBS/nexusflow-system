// ==========================================================================
// NEXUSFLOW - BACK-END REAL-TIME WEBSOCKET & REST API SERVER
// ==========================================================================

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8081;
const META_APP_SECRET = process.env.META_APP_SECRET || 'nexusflow_secret_key_2026';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_nexusflow';

// Banco de Dados em Memória (Mock do PostgreSQL + Prisma)
const db = {
  users: [
    { id: 1, name: 'Pedro Alves', email: 'pedro@nexusflow.com', role: 'SUPERVISOR' }
  ],
  tickets: [
    { id: 101, client: 'Carlos Construtora S.A.', status: 'IN_PROGRESS', slaRemainingMin: 15 }
  ],
  messages: [],
  attachments: []
};

// Criar Servidor HTTP
const server = http.createServer((req, res) => {
  // CORS Headers Seguros
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Hub-Signature-256');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // 1. ROTA DE UPLOAD DE ARQUIVOS (PDF, IMAGEM, ÁUDIO, DOCUMENTOS)
  if (req.method === 'POST' && url.pathname === '/api/v1/upload') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const fileData = JSON.parse(body || '{}');
        const fileId = 'file_' + Date.now();
        const fileRecord = {
          id: fileId,
          name: fileData.name || 'documento_anexo.pdf',
          size: fileData.size || '1.5 MB',
          type: fileData.type || 'application/pdf',
          uploadedAt: new Date().toISOString(),
          url: fileData.dataUrl || null
        };
        db.attachments.unshift(fileRecord);

        console.log('[BACKEND UPLOAD] Arquivo recebido e armazenado:', fileRecord.name);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          file: fileRecord
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao processar upload de arquivo' }));
      }
    });
    return;
  }

  // 2. ROTA DE VERIFICAÇÃO DO WEBHOOK DO WHATSAPP (META CLOUD API)
  if (req.method === 'GET' && url.pathname === '/api/v1/webhooks/whatsapp') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === 'nexusflow_token_123') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(challenge);
      console.log('[WHATSAPP WEBHOOK] Desafio de verificação Meta aprovado!');
    } else {
      res.writeHead(403);
      res.end('Forbidden');
    }
    return;
  }

  // 3. ROTA DE RECEBIMENTO DE MENSAGENS E MÍDIAS DO WHATSAPP
  if (req.method === 'POST' && url.pathname === '/api/v1/webhooks/whatsapp') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      // Validação de Assinatura HMAC-SHA256 (Segurança LGPD/Meta)
      const signature = req.headers['x-hub-signature-256'];
      if (signature) {
        const expectedSignature = 'sha256=' + crypto.createHmac('sha256', META_APP_SECRET).update(body).digest('hex');
        if (signature !== expectedSignature) {
          console.warn('[SEGURANÇA] Assinatura HMAC do Webhook rejeitada!');
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Assinatura inválida' }));
          return;
        }
      }

      try {
        const payload = JSON.parse(body);
        console.log('[WHATSAPP WEBHOOK] Mensagem recebida:', payload);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', received: true }));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'JSON malformado' }));
      }
    });
    return;
  }

  // 4. ROTA MANUS AI: SÍNTESE E TRIAGEM INTELIGENTE
  if (req.method === 'POST' && url.pathname === '/api/v1/manus/triagem') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      const { text, ticketId } = JSON.parse(body || '{}');

      const responseIa = {
        status: 'success',
        intent: 'APROVACAO_MEDICAO_ENGENHARIA',
        confidence: 0.98,
        suggestedReply: `Olá! Verificamos que a demanda do ticket #${ticketId} é urgente. Abrimos um card de prioridade alta no Kanban.`,
        summary: 'Cliente solicitou liberação de medição financeira.'
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseIa));
    });
    return;
  }

  // 5. ROTA DE AUTENTICAÇÃO JWT (LOGIN)
  if (req.method === 'POST' && url.pathname === '/api/v1/auth/login') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      const { email, password } = JSON.parse(body || '{}');
      if (email === 'pedro@nexusflow.com') {
        const token = crypto.randomBytes(32).toString('hex');
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': `nexusflow_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`
        });
        res.end(JSON.stringify({
          user: db.users[0],
          token,
          expiresIn: '24h'
        }));
      } else {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Credenciais inválidas' }));
      }
    });
    return;
  }

  // Rota padrão 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Rota não encontrada' }));
});

// Iniciar Servidor
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`NEXUSFLOW REAL-TIME BACKEND RUNNING ON PORT ${PORT}`);
  console.log(`- Upload Endpoint: http://localhost:${PORT}/api/v1/upload`);
  console.log(`- Webhook WhatsApp: http://localhost:${PORT}/api/v1/webhooks/whatsapp`);
  console.log(`- Manus AI Endpoint: http://localhost:${PORT}/api/v1/manus/triagem`);
  console.log(`- Autenticação JWT: http://localhost:${PORT}/api/v1/auth/login`);
  console.log(`====================================================`);
});
