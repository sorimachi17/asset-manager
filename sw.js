const CACHE_NAME = 'asset-mgr-v7-ios-bottom-nav';
const APP_SHELL = [
  './',
  './index.html',
  './csv-maker.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png'
];

const MOBILE_UI_CSS = String.raw`
@media (max-width:600px){
  body{
    padding-bottom:calc(78px + env(safe-area-inset-bottom))!important;
  }

  /* Important for iOS Safari/PWA: backdrop-filter on an ancestor can make
     position:fixed descendants behave as if fixed inside that ancestor. */
  header{
    position:static!important;
    top:auto!important;
    overflow:visible!important;
    backdrop-filter:none!important;
    -webkit-backdrop-filter:none!important;
  }
  header > .wrap{
    overflow:visible!important;
  }
  .toolbar{
    overflow:visible!important;
    align-items:stretch!important;
    position:relative!important;
    z-index:1!important;
  }

  /* File picker: keep the native control fully visible on iOS. */
  input[type="file"]{
    display:block!important;
    width:100%!important;
    min-height:48px!important;
    height:48px!important;
    margin:0!important;
    padding:6px 8px!important;
    font-size:14px!important;
    line-height:34px!important;
    overflow:visible!important;
    box-sizing:border-box!important;
  }
  input[type="file"]::file-selector-button,
  input[type="file"]::-webkit-file-upload-button{
    min-height:34px!important;
    height:34px!important;
    margin:0 8px 0 0!important;
    padding:6px 12px!important;
    line-height:20px!important;
    vertical-align:middle!important;
    border:0!important;
    border-radius:9px!important;
  }

  /* Bottom app navigation. Trend is integrated into Dashboard. */
  #tabNav{
    position:fixed!important;
    left:0!important;
    right:0!important;
    bottom:0!important;
    top:auto!important;
    z-index:9999!important;
    width:100vw!important;
    max-width:none!important;
    display:grid!important;
    grid-template-columns:repeat(4,minmax(0,1fr))!important;
    gap:4px!important;
    margin:0!important;
    padding:7px 6px calc(7px + env(safe-area-inset-bottom))!important;
    overflow:visible!important;
    background:rgba(17,17,17,.98)!important;
    border-top:1px solid var(--line)!important;
    border-bottom:0!important;
    box-shadow:0 -8px 24px rgba(0,0,0,.28)!important;
    backdrop-filter:blur(14px)!important;
    -webkit-backdrop-filter:blur(14px)!important;
  }
  #tabNav .tab-btn[data-tab="tabTrend"]{
    display:none!important;
  }
  #tabNav .tab-btn{
    min-width:0!important;
    width:100%!important;
    flex:none!important;
    padding:10px 2px!important;
    border-radius:10px!important;
    font-size:11px!important;
    line-height:1.2!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }

  /* Dashboard contains Trend too. */
  #tabDash.active ~ #tabTrend{display:contents!important;}

  /* Dashboard order: total -> pie -> trend -> P/L -> return -> IPS. */
  #tabDash.active > .kpi{display:contents!important;}
  #tabDash.active > .kpi > .card:first-child{order:1!important;}
  #tabDash.active > section:nth-of-type(3){order:2!important;}
  #tabDash.active ~ #tabTrend > section{order:3!important;}
  #tabDash.active > .kpi > #kpiPnlCard{order:4!important;}
  #tabDash.active > .kpi > #kpiRetCard{order:5!important;}
  #tabDash.active > section:nth-of-type(2){order:6!important;}
}
`;

const MOBILE_UI_SCRIPT = String.raw`
(() => {
  const isMobile = () => window.matchMedia('(max-width:600px)').matches;
  try {
    const pnlCard = document.getElementById('kpiPnlCard');
    if (pnlCard && !document.getElementById('pnlLogicNote')) {
      const note = document.createElement('div');
      note.id = 'pnlLogicNote';
      note.className = 'sub';
      note.style.marginTop = '8px';
      note.style.fontSize = '10px';
      note.style.lineHeight = '1.5';
      note.textContent = '計算: 各銘柄の「評価額 −（保有数量 × 取得単価）」を合算。損益率 = 総含み損益 ÷ 取得総額。Quantity / CostBasis がある銘柄のみ対象。';
      pnlCard.appendChild(note);
    }

    if (typeof TAB_RENDERERS !== 'undefined' && TAB_RENDERERS.tabDash) {
      const originalDashRenderer = TAB_RENDERERS.tabDash;
      if (!originalDashRenderer.__mobileDashboardEnhanced) {
        const enhancedDashRenderer = () => {
          originalDashRenderer();
          if (isMobile() && typeof drawLine === 'function') {
            requestAnimationFrame(() => drawLine());
          }
        };
        enhancedDashRenderer.__mobileDashboardEnhanced = true;
        TAB_RENDERERS.tabDash = enhancedDashRenderer;
      }
    }

    if (
      isMobile() &&
      typeof activeTab !== 'undefined' && activeTab === 'tabDash' &&
      typeof DATES !== 'undefined' && DATES.length &&
      typeof drawLine === 'function'
    ) {
      requestAnimationFrame(() => drawLine());
    }
  } catch (err) {
    console.warn('mobile dashboard enhancement failed', err);
  }
})();
`;

function injectMobileUi(html){
  if (!html.includes('id="mobile-dashboard-ui-style"')) {
    html = html.replace(
      '</head>',
      `<style id="mobile-dashboard-ui-style">${MOBILE_UI_CSS}</style></head>`
    );
  }
  if (!html.includes('id="mobile-dashboard-ui-script"')) {
    html = html.replace(
      '</body>',
      `<script id="mobile-dashboard-ui-script">${MOBILE_UI_SCRIPT}</script></body>`
    );
  }
  return html;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isMainHtml =
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname === '/index.html';

  if (isMainHtml) {
    event.respondWith((async () => {
      let response = null;
      try {
        const network = await fetch(event.request, { cache: 'no-store' });
        if (network && network.status === 200) {
          response = network;
          const clone = network.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
      } catch (_) {
        response = await caches.match(event.request);
      }
      if (!response) response = await caches.match('./index.html');
      if (!response) return fetch(event.request);

      const html = injectMobileUi(await response.clone().text());
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    })());
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      });
    })
  );
});
