// TamyInvest — servidor Express
// Serve index.html + endpoint /api/alerts para receber alertas do Claude

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Chave de API para autenticar POSTs do agente Claude
// (defina ALERTS_API_KEY em Railway → Variables)
const API_KEY = process.env.ALERTS_API_KEY || 'tamyinvest2026';

app.use(express.json({ limit: '50kb' }));
app.use(express.static(__dirname));

// ── Armazenamento em memória (últimos 30 alertas) ──
let alertas = [];
let nextId = Date.now();

// ── POST /api/alerts  (uso exclusivo do agente Claude) ─────────────────────
app.post('/api/alerts', (req, res) => {
  const key = req.headers['x-api-key'] || req.query.key;
  if (key !== API_KEY) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }

  const { tipo, emoji, titulo, conteudo } = req.body;
  if (!titulo || !conteudo) {
    return res.status(400).json({ erro: 'Campos obrigatórios: titulo, conteudo' });
  }

  const alerta = {
    id: ++nextId,
    ts: new Date().toISOString(),
    tipo: tipo || 'info',          // pre-abertura | meio-pregao | fechamento | info
    emoji: emoji || '📊',
    titulo,
    conteudo,
  };

  alertas.unshift(alerta);
  if (alertas.length > 30) alertas.pop(); // mantém apenas os últimos 30

  console.log(`[${alerta.ts}] Alerta recebido: ${alerta.titulo}`);
  res.status(201).json({ ok: true, id: alerta.id });
});

// ── GET /api/alerts  (frontend faz poll a cada 30s) ────────────────────────
app.get('/api/alerts', (req, res) => {
  const since = parseInt(req.query.since) || 0;
  const novos = alertas.filter(a => a.id > since);
  res.json({
    alertas: novos,
    ultimoId: alertas[0]?.id || 0
  });
});

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Serve index.html para qualquer outra rota ───────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`TamyInvest rodando na porta ${PORT}`);
});
