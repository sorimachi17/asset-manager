const CACHE_NAME = 'asset-mgr-v17-group-table-fit';
const APP_SHELL = [
  './',
  './index.html',
  './csv-maker.html',
  './manifest.json',
  './sw-core.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png'
];

const MOBILE_FIT_CSS = String.raw`
@media (max-width:600px){
  #grpTable{width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important;}
  #grpTable .table-wrap{width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:hidden!important;}
  #grpTable .table-wrap > table{width:100%!important;max-width:100%!important;min-width:0!important;table-layout:fixed!important;font-size:11px!important;}
  #grpTable .table-wrap > table th,#grpTable .table-wrap > table td{min-width:0!important;padding-left:3px!important;padding-right:3px!important;overflow:hidden!important;text-overflow:ellipsis!important;}
  #grpTable .table-wrap > table th:nth-child(1),#grpTable .table-wrap > table td:nth-child(1){width:34%!important;text-align:left!important;}
  #grpTable .table-wrap > table th:nth-child(2),#grpTable .table-wrap > table td:nth-child(2){width:30%!important;}
  #grpTable .table-wrap > table th:nth-child(3),#grpTable .table-wrap > table td:nth-child(3){width:21%!important;}
  #grpTable .table-wrap > table th:nth-child(4),#grpTable .table-wrap > table td:nth-child(4){width:15%!important;}
  #grpTable .grp-summary-row td:first-child{white-space:nowrap!important;}
  #grpTable .grp-detail-row > td{width:100%!important;max-width:100%!important;padding-left:3px!important;padding-right:3px!important;overflow:hidden!important;}
  #grpTable .grp-detail-box{width:100%!important;max-width:100%!important;min-width:0!important;margin-left:0!important;padding:8px 2px 4px 5px!important;overflow-x:hidden!important;}
  #grpTable .grp-detail-table{width:100%!important;max-width:100%!important;min-width:0!important;table-layout:fixed!important;font-size:10px!important;}
  #grpTable .grp-detail-table th,#grpTable .grp-detail-table td{min-width:0!important;padding:5px 2px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
  #grpTable .grp-detail-table th:nth-child(1),#grpTable .grp-detail-table td:nth-child(1){width:32%!important;text-align:left!important;white-space:normal!important;overflow-wrap:anywhere!important;}
  #grpTable .grp-detail-table th:nth-child(2),#grpTable .grp-detail-table td:nth-child(2){width:27%!important;}
  #grpTable .grp-detail-table th:nth-child(3),#grpTable .grp-detail-table td:nth-child(3){width:17%!important;}
  #grpTable .grp-detail-table th:nth-child(4),#grpTable .grp-detail-table td:nth-child(4){width:24%!important;}
}
`;

let legacyUiPromise = null;
async function getLegacyUi(){
  if (legacyUiPromise) return legacyUiPromise;
  legacyUiPromise = (async()=>{
    let response = await caches.match('./sw-core.js');
    if (!response) response = await fetch('./sw-core.js',{cache:'no-store'});
    const source = await response.text();
    const cssMatch = source.match(/const MOBILE_UI_CSS = String\.raw`([\s\S]*?)`;\s*\n\s*const MOBILE_UI_SCRIPT/);
    const scriptMatch = source.match(/const MOBILE_UI_SCRIPT = String\.raw`([\s\S]*?)`;\s*\n\s*function injectMobileUi/);
    return {css: cssMatch ? cssMatch[1] : '', script: scriptMatch ? scriptMatch[1] : ''};
  })();
  return legacyUiPromise;
}

async function injectMobileUi(html){
  const legacy = await getLegacyUi();
  const css = legacy.css + '\n' + MOBILE_FIT_CSS;
  if (!html.includes('id="mobile-dashboard-ui-style"')) html = html.replace('</head>',`<style id="mobile-dashboard-ui-style">${css}</style></head>`);
  if (!html.includes('id="mobile-dashboard-ui-script"') && legacy.script) html = html.replace('</body>',`<script id="mobile-dashboard-ui-script">${legacy.script}</script></body>`);
  return html;
}

self.addEventListener('install',(event)=>{event.waitUntil(caches.open(CACHE_NAME).then((cache)=>cache.addAll(APP_SHELL)));self.skipWaiting();});
self.addEventListener('activate',(event)=>{event.waitUntil(caches.keys().then((keys)=>Promise.all(keys.filter((k)=>k!==CACHE_NAME).map((k)=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',(event)=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const isMainHtml=event.request.mode==='navigate'||url.pathname.endsWith('/')||url.pathname.endsWith('/index.html')||url.pathname==='/index.html';
  if(isMainHtml){
    event.respondWith((async()=>{
      let response=null;
      try{const network=await fetch(event.request,{cache:'no-store'});if(network&&network.status===200){response=network;const clone=network.clone();caches.open(CACHE_NAME).then((cache)=>cache.put(event.request,clone));}}catch(_){response=await caches.match(event.request);}
      if(!response)response=await caches.match('./index.html');
      if(!response)return fetch(event.request);
      const html=await injectMobileUi(await response.clone().text());
      const headers=new Headers(response.headers);headers.delete('content-length');
      return new Response(html,{status:response.status,statusText:response.statusText,headers});
    })());return;
  }
  event.respondWith(caches.match(event.request).then((cached)=>cached||fetch(event.request).then((res)=>{if(res&&res.status===200){const clone=res.clone();caches.open(CACHE_NAME).then((cache)=>cache.put(event.request,clone));}return res;})));
});