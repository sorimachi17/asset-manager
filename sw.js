const CACHE_NAME = 'asset-mgr-v5-mobile-dashboard-fixes';
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
    padding-bottom:calc(68px + env(safe-area-inset-bottom));
  }

  /* 上部ヘッダーは固定を解除し、iOS/PWAでもファイル入力が欠けないようにする */
  header{
    position:relative;
    top:auto;
    overflow:visible;
  }
  .toolbar{
    overflow:visible;
  }
  input[type="file"]{
    display:block;
    width:100%;
    min-height:44px;
    height:auto;
    padding:8px;
    line-height:1.4;
    overflow:visible;
    box-sizing:border-box;
  }

  /* アプリ風の下部固定タブ。推移はダッシュボードに統合したので非表示 */
  #tabNav{
    position:fixed;
    left:0;
    right:0;
    bottom:0;
    z-index:180;
    display:grid;
    grid-template-columns:repeat(4,minmax(0,1fr));
    gap:4px;
    margin:0;
    padding:7px 6px calc(7px + env(safe-area-inset-bottom));
    overflow:visible;
    background:rgba(17,17,17,.96);
    border-top:1px solid var(--line);
    backdrop-filter:saturate(130%) blur(12px);
    -webkit-backdrop-filter:saturate(130%) blur(12px);
  }
  #tabNav .tab-btn[data-tab="tabTrend"]{
    display:none;
  }
  #tabNav .tab-btn{
    min-width:0;
    width:100%;
    padding:8px 2px;
    border-radius:9px;
    font-size:10px;
    line-height:1.2;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
  }

  /* ダッシュボードでは推移セクションも同時に表示 */
  #tabDash.active ~ #tabTrend{display:contents;}

  /* 評価総額 → 円グラフ → 推移 → その他KPI → IPS */
  #tabDash.active > .kpi{display:contents;}
  #tabDash.active > .kpi > .card:first-child{order:1;}
  #tabDash.active > section:nth-of-type(3){order:2;}
  #tabDash.active ~ #tabTrend > section{order:3;}
  #tabDash.active > .kpi > #kpiPnlCard{order:4;}
  #tabDash.active > .kpi > #kpiRetCard{order:5;}
  #tabDash.active > section:nth-of-type(2){order:6;}
}
`;

const MOBILE_UI_SCRIPT = String.raw`
(() => {
  const isMobile = () => window.matchMedia('(max-width:600px)').matches;
  try {
    /* 含み損益の計算ロジックをカード内に明記 */
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
  if (url.origin !== self.location.origin) return; // let CDN scripts hit network directly

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    let response = cached || null;

    try {
      const network = await fetch(event.request);
      if (network && network.status === 200) {
        const clone = network.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        if (!response) response = network;
      }
    } catch (_) {
      // Offline: fall back to cached response below.
    }

    if (!response) return fetch(event.request);

    const isMainHtml =
      url.pathname.endsWith('/') ||
      url.pathname.endsWith('/index.html') ||
      url.pathname === '/index.html';

    if (isMainHtml) {
      const type = response.headers.get('content-type') || '';
      if (type.includes('text/html') || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
        const html = injectMobileUi(await response.clone().text());
        const headers = new Headers(response.headers);
        headers.delete('content-length');
        return new Response(html, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      }
    }

    return response;
  })());
});
