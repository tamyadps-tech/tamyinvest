// TamyInvest Service Worker — notificações push em background
const CACHE = 'tamyinvest-v1';
const BRAPI_TOKEN = 'bn4FGjh6jDfKiR1owyDtuh';
const B3SA3_URL = `https://brapi.dev/api/quote/B3SA3?range=5d&interval=1d&token=${BRAPI_TOKEN}`;
const QUOTE_URL = `https://brapi.dev/api/quote/B3SA3?token=${BRAPI_TOKEN}`;

// Cache do app shell
self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Escuta mensagens da página principal
self.addEventListener('message', e => {
  if(e.data && e.data.type === 'AGENDAR_VERIFICACAO'){
    agendarVerificacao();
  }
});

// Verificação periódica via Background Sync (quando disponível)
// e via fetch manual a cada vez que a SW é ativada
async function verificarMaxima5D(){
  try {
    const [rCot, rHist] = await Promise.all([
      fetch(QUOTE_URL),
      fetch(B3SA3_URL)
    ]);
    const dCot  = await rCot.json();
    const dHist = await rHist.json();

    const cot  = (dCot.results||[])[0]?.regularMarketPrice;
    const hist = (dHist.results||[])[0]?.historicalDataPrice || [];
    const highs = hist.map(h => h.high).filter(Boolean);
    const max5d = highs.length ? Math.max(...highs) : null;

    if(!cot || !max5d) return;

    const naMaxima = ((max5d - cot) / max5d) < 0.01;
    if(!naMaxima) return;

    const PM = 16.89;
    const lucro = ((cot - PM) * 50).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});

    // Evita spam — só notifica 1x por hora
    const cache = await caches.open(CACHE);
    const cached = await cache.match('notif-last');
    if(cached){
      const ts = parseInt(await cached.text());
      if(Date.now() - ts < 60 * 60 * 1000) return;
    }
    await cache.put('notif-last', new Response(String(Date.now())));

    await self.registration.showNotification('🔔 B3SA3 na máxima dos últimos 5 dias!', {
      body: `Cotação R$${cot.toFixed(2)} · Lucro nas 50 cotas: R$${lucro}\nMomento de avaliar venda!`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'b3sa3-maxima',
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
      data: { url: '/' }
    });
  } catch(e) {
    // Sem internet ou erro — silencia
  }
}

// Agendamento via setInterval dentro do SW (funciona enquanto SW ativo)
let _timer = null;
function agendarVerificacao(){
  if(_timer) clearInterval(_timer);
  _timer = setInterval(verificarMaxima5D, 5 * 60 * 1000); // a cada 5 min
  verificarMaxima5D(); // roda imediatamente também
}

// Ao clicar na notificação — abre o app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(cs => {
      if(cs.length) return cs[0].focus();
      return clients.openWindow('/');
    })
  );
});

// Background sync (suporte em alguns navegadores)
self.addEventListener('sync', e => {
  if(e.tag === 'verificar-b3sa3') {
    e.waitUntil(verificarMaxima5D());
  }
});

// Periodic background sync (Chrome Android — mais confiável)
self.addEventListener('periodicsync', e => {
  if(e.tag === 'verificar-b3sa3') {
    e.waitUntil(verificarMaxima5D());
  }
});
