const CACHE_NAME = 'asset-mgr-v22-dashboard-pie-descending';
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
  #grpTable .grp-detail-table th:nth-child(1),#grpTable .grp-detail-table td:nth-child(1){width:31%!important;text-align:left!important;white-space:normal!important;overflow-wrap:anywhere!important;}
  #grpTable .grp-detail-table th:nth-child(2),#grpTable .grp-detail-table td:nth-child(2){width:25%!important;}
  #grpTable .grp-detail-table th:nth-child(3),#grpTable .grp-detail-table td:nth-child(3){width:16%!important;}
  #grpTable .grp-detail-table th:nth-child(4),#grpTable .grp-detail-table td:nth-child(4){width:28%!important;}
  #grpTable .grp-detail-table td:nth-child(4){white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:normal!important;word-break:normal!important;font-size:9px!important;line-height:1.25!important;}

  /* Expanded pie legend: make the selected parent and its children visually distinct. */
  #grpPieLegend:has(.legend-item[style*="font-weight:600"]){
    gap:5px!important;
    padding:8px!important;
    border:1px solid rgba(255,255,255,.10)!important;
    border-radius:12px!important;
    background:rgba(255,255,255,.018)!important;
  }
  #grpPieLegend:has(.legend-item[style*="font-weight:600"]) > .legend-item{
    transition:opacity .15s ease,background .15s ease,border-color .15s ease!important;
  }
  #grpPieLegend:has(.legend-item[style*="font-weight:600"]) > .legend-item:not([style*="font-weight:600"]):not([style*="padding-left:10px"]){
    opacity:.38!important;
  }
  #grpPieLegend .legend-item[style*="font-weight:600"]{
    flex-basis:100%!important;
    width:100%!important;
    margin:2px 0 1px!important;
    padding:7px 9px!important;
    border:1px solid rgba(255,255,255,.22)!important;
    border-radius:9px!important;
    background:rgba(255,255,255,.075)!important;
    color:var(--fg)!important;
    font-size:12px!important;
  }
  #grpPieLegend .legend-item[style*="font-weight:600"]::before{
    content:'選択中';
    flex:0 0 auto;
    margin-right:2px;
    padding:1px 5px;
    border-radius:999px;
    background:rgba(59,130,246,.20);
    border:1px solid rgba(96,165,250,.38);
    color:#bfdbfe;
    font-size:9px;
    font-weight:600;
    line-height:1.45;
  }
  #grpPieLegend .legend-item[style*="padding-left:10px"]{
    flex-basis:calc(100% - 14px)!important;
    width:calc(100% - 14px)!important;
    margin-left:14px!important;
    padding:5px 7px!important;
    border-left:2px solid rgba(147,197,253,.55)!important;
    border-radius:0 7px 7px 0!important;
    background:rgba(59,130,246,.055)!important;
    color:#dbeafe!important;
    font-size:11px!important;
    opacity:1!important;
  }
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