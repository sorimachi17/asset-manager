const CACHE_NAME = 'asset-mgr-v11-partial-group-expand';
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
/* Stock analysis: group pie first, holdings analysis second. */
#tabAnal.active > section:nth-of-type(2){order:1!important;}
#tabAnal.active > section:nth-of-type(1){order:2!important;}
#grpTable .grp-summary-row{cursor:pointer;}
#grpTable .grp-summary-row:hover td{background:rgba(255,255,255,.025);}
#grpTable .grp-summary-row td:first-child{font-weight:600;}
#grpTable .grp-accordion-arrow{display:inline-block;width:16px;color:var(--muted);transition:transform .15s ease;}
#grpTable .grp-summary-row.is-open .grp-accordion-arrow{transform:rotate(90deg);}
#grpTable .grp-detail-row > td{padding:0 6px 10px!important;background:rgba(255,255,255,.015);}
#grpTable .grp-detail-box{padding:8px 8px 4px;border-left:2px solid var(--line);margin-left:5px;overflow-x:auto;}
#grpTable .grp-detail-table{width:100%;min-width:470px;font-size:11px;}
#grpTable .grp-detail-table th,#grpTable .grp-detail-table td{padding:6px 5px;}
#grpDrillBar{display:none;align-items:center;gap:8px;margin:6px 0 8px;flex-wrap:wrap;}
#grpDrillBack{padding:6px 10px;font-size:12px;}
#grpDrillTitle{font-size:12px;color:var(--muted);}

@media (max-width:600px){
  body{padding-bottom:calc(78px + env(safe-area-inset-bottom))!important;}
  header{position:static!important;top:auto!important;overflow:visible!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}
  header > .wrap{overflow:visible!important;}
  .toolbar{overflow:visible!important;align-items:stretch!important;position:relative!important;z-index:1!important;}
  input[type="file"]{display:block!important;width:100%!important;min-height:48px!important;height:48px!important;margin:0!important;padding:6px 8px!important;font-size:14px!important;line-height:34px!important;overflow:visible!important;box-sizing:border-box!important;}
  input[type="file"]::file-selector-button,input[type="file"]::-webkit-file-upload-button{min-height:34px!important;height:34px!important;margin:0 8px 0 0!important;padding:6px 12px!important;line-height:20px!important;vertical-align:middle!important;border:0!important;border-radius:9px!important;}
  #tabNav{position:fixed!important;left:0!important;right:0!important;bottom:0!important;top:auto!important;z-index:9999!important;width:100vw!important;max-width:none!important;display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:4px!important;margin:0!important;padding:7px 6px calc(7px + env(safe-area-inset-bottom))!important;overflow:visible!important;background:rgba(17,17,17,.98)!important;border-top:1px solid var(--line)!important;border-bottom:0!important;box-shadow:0 -8px 24px rgba(0,0,0,.28)!important;backdrop-filter:blur(14px)!important;-webkit-backdrop-filter:blur(14px)!important;}
  #tabNav .tab-btn[data-tab="tabTrend"]{display:none!important;}
  #tabNav .tab-btn{min-width:0!important;width:100%!important;flex:none!important;padding:10px 2px!important;border-radius:10px!important;font-size:11px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
  #tabDash.active ~ #tabTrend{display:contents!important;}
  #tabDash.active > .kpi{display:contents!important;}
  #tabDash.active > .kpi > .card:first-child{order:1!important;}
  #tabDash.active > section:nth-of-type(3){order:2!important;}
  #tabDash.active ~ #tabTrend > section{order:3!important;}
  #tabDash.active > .kpi > #kpiPnlCard{order:4!important;}
  #tabDash.active > .kpi > #kpiRetCard{order:5!important;}
  #tabDash.active > section:nth-of-type(2){order:6!important;}
  #grpTable .grp-summary-row td{padding-top:10px;padding-bottom:10px;}
  #grpTable .grp-detail-box{padding-left:5px;padding-right:0;margin-left:0;}
}
`;

const MOBILE_UI_SCRIPT = String.raw`
(() => {
  const isMobile = () => window.matchMedia('(max-width:600px)').matches;
  let expandedGroup = '';
  let basePie = null;
  let pieSliceMeta = [];

  function getSelectedAnalDate(){
    if (typeof DATES === 'undefined' || !DATES.length) return '';
    const raw = (document.getElementById('analDate') || {}).value || DATES.at(-1);
    return typeof nearestOnOrBefore === 'function' ? (nearestOnOrBefore(raw) || DATES.at(-1)) : DATES.at(-1);
  }

  function groupMembers(groupName, selectedDate){
    if (typeof loadGroups !== 'function') return [];
    const groups = loadGroups();
    const dateMap = (typeof byDateName !== 'undefined' && byDateName.get(selectedDate)) || new Map();
    const assigned = new Set();
    groups.forEach((g) => (g.names || []).forEach((n) => assigned.add(n)));
    let names = [];
    if (groupName === '未分類') {
      names = Array.from(dateMap.entries()).filter(([name, amount]) => !assigned.has(name) && amount !== 0).map(([name]) => name);
    } else {
      const group = groups.find((g) => g.name === groupName);
      names = group ? (group.names || []).slice() : [];
    }
    if (typeof amountOfNameAt === 'function') {
      names = names.filter((name) => amountOfNameAt(name, selectedDate) !== 0).sort((a,b) => amountOfNameAt(b, selectedDate) - amountOfNameAt(a, selectedDate));
    }
    return names;
  }

  function enhanceGroupTable(){
    try {
      const host = document.getElementById('grpTable');
      if (!host || typeof DATES === 'undefined' || !DATES.length) return;
      const tbody = host.querySelector('tbody');
      if (!tbody || tbody.dataset.groupAccordionEnhanced === '1') return;
      tbody.dataset.groupAccordionEnhanced = '1';
      const rows = Array.from(tbody.children).filter((r) => r.tagName === 'TR');
      const selectedDate = getSelectedAnalDate();
      const totalValue = typeof sumAt === 'function' ? sumAt(selectedDate) : 0;

      rows.forEach((row) => {
        if (!row.cells || !row.cells.length) return;
        const groupName = row.cells[0].textContent.trim();
        const names = groupMembers(groupName, selectedDate);
        const groupTotal = typeof amountOfNameAt === 'function' ? names.reduce((s,n)=>s+amountOfNameAt(n, selectedDate),0) : 0;
        row.classList.add('grp-summary-row');
        row.dataset.groupName = groupName;
        row.setAttribute('role','button');
        row.setAttribute('tabindex','0');
        row.setAttribute('aria-expanded','false');
        const arrow = document.createElement('span');
        arrow.className = 'grp-accordion-arrow';
        arrow.textContent = '›';
        row.cells[0].insertBefore(arrow,row.cells[0].firstChild);

        const detailRow = document.createElement('tr');
        detailRow.className = 'grp-detail-row';
        detailRow.style.display = 'none';
        const memberRows = names.map((name) => {
          const amount = typeof amountOfNameAt === 'function' ? amountOfNameAt(name, selectedDate) : 0;
          const groupPct = groupTotal ? amount/groupTotal*100 : 0;
          const p = typeof pnlOfNameAt === 'function' ? pnlOfNameAt(name, selectedDate) : null;
          let pnlText = '—';
          if (p) pnlText = (p.pnl>=0?'+':'') + yen(p.pnl) + (p.pnlPct==null?'':' ('+(p.pnlPct>=0?'+':'')+p.pnlPct.toFixed(1)+'%)');
          return '<tr><td><span class="stock-link" data-name="'+escapeHtml(name)+'">'+escapeHtml(name)+'</span></td><td style="text-align:right">'+yen(amount)+'</td><td style="text-align:right">'+groupPct.toFixed(1)+'%</td><td class="'+(p?(p.pnl<0?'neg':'pos'):'')+'" style="text-align:right">'+pnlText+'</td></tr>';
        }).join('');
        detailRow.innerHTML = '<td colspan="'+row.cells.length+'"><div class="grp-detail-box"><div class="muted" style="font-size:10px;margin:0 0 4px">'+selectedDate+' 時点</div><table class="grp-detail-table"><thead><tr><th>銘柄</th><th style="text-align:right">評価額</th><th style="text-align:right">グループ比</th><th style="text-align:right">含み損益</th></tr></thead><tbody>'+(memberRows||'<tr><td colspan="4" class="muted">対象銘柄なし</td></tr>')+'</tbody></table>'+(totalValue?'<div class="muted" style="font-size:10px;margin-top:4px">グループ全体: '+yen(groupTotal)+' / 総資産の '+(groupTotal/totalValue*100).toFixed(1)+'%</div>':'')+'</div></td>';
        row.parentNode.insertBefore(detailRow,row.nextSibling);

        const toggle = () => {
          const open = detailRow.style.display !== 'none';
          detailRow.style.display = open ? 'none' : '';
          row.classList.toggle('is-open',!open);
          row.setAttribute('aria-expanded',String(!open));
        };
        row.addEventListener('click',toggle);
        row.addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
      });
    } catch(err){ console.warn('group table enhancement failed',err); }
  }

  function openOnlyGroupRow(groupName){
    const rows = Array.from(document.querySelectorAll('#grpTable .grp-summary-row'));
    rows.forEach((row) => {
      const detail = row.nextElementSibling;
      if (!detail || !detail.classList.contains('grp-detail-row')) return;
      const shouldOpen = row.dataset.groupName === groupName;
      detail.style.display = shouldOpen ? '' : 'none';
      row.classList.toggle('is-open', shouldOpen);
      row.setAttribute('aria-expanded', String(shouldOpen));
    });
  }

  function ensureDrillBar(){
    const canvas = document.getElementById('grpPieCanvas');
    if (!canvas) return null;
    let bar = document.getElementById('grpDrillBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'grpDrillBar';
      bar.innerHTML = '<button id="grpDrillBack" class="btn-ghost" type="button">← 詳細化を解除</button><span id="grpDrillTitle"></span>';
      const wrap = canvas.closest('.chart-wrap');
      if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(bar, wrap);
      document.getElementById('grpDrillBack').addEventListener('click',()=>{
        expandedGroup = '';
        if (typeof renderGroupPie === 'function') renderGroupPie();
      });
    }
    return bar;
  }

  function snapshotBasePie(){
    if (typeof grpPieChart === 'undefined' || !grpPieChart || !grpPieChart.data || !grpPieChart.data.datasets.length) return false;
    const labels = (grpPieChart.data.labels || []).map(String);
    const values = (grpPieChart.data.datasets[0].data || []).map(Number);
    const rawColors = grpPieChart.data.datasets[0].backgroundColor || [];
    const colors = Array.isArray(rawColors) ? rawColors.slice() : labels.map(() => rawColors);
    basePie = { labels, values, colors };
    pieSliceMeta = labels.map((label) => ({type:'group', group:label}));
    return true;
  }

  function renderExpandedLegend(labels, values, colors, metas){
    const legend = document.getElementById('grpPieLegend');
    if (!legend) return;
    const total = basePie ? basePie.values.reduce((s,v)=>s+v,0) : values.reduce((s,v)=>s+v,0);
    legend.innerHTML = labels.map((label,i) => {
      const meta = metas[i] || {};
      const display = meta.type === 'member' ? (escapeHtml(meta.group) + ' › ' + escapeHtml(meta.name)) : escapeHtml(label);
      return '<span class="legend-item"><span class="dot" style="background:'+colors[i]+'"></span>'+display+' '+(total?values[i]/total*100:0).toFixed(1)+'%</span>';
    }).join('');
  }

  function expandGroupSlice(groupName){
    try {
      if (typeof grpPieChart === 'undefined' || !grpPieChart) return;
      if (!basePie && !snapshotBasePie()) return;
      const groupIndex = basePie.labels.indexOf(groupName);
      if (groupIndex < 0) return;

      const selectedDate = getSelectedAnalDate();
      const names = groupMembers(groupName, selectedDate);
      if (!names.length || typeof amountOfNameAt !== 'function') return;
      const rawMemberValues = names.map((name)=>amountOfNameAt(name, selectedDate));
      const rawMemberTotal = rawMemberValues.reduce((s,v)=>s+v,0);
      if (!rawMemberTotal) return;

      const groupTotal = basePie.values[groupIndex];
      const scale = groupTotal / rawMemberTotal;
      const memberValues = rawMemberValues.map((v)=>v*scale);
      const memberColors = typeof getPalette === 'function' ? getPalette(names.length) : names.map(()=>basePie.colors[groupIndex]);

      const labels = [];
      const values = [];
      const colors = [];
      const metas = [];
      basePie.labels.forEach((label,i)=>{
        if (label !== groupName) {
          labels.push(label);
          values.push(basePie.values[i]);
          colors.push(basePie.colors[i]);
          metas.push({type:'group', group:label});
          return;
        }
        names.forEach((name,j)=>{
          labels.push(name);
          values.push(memberValues[j]);
          colors.push(memberColors[j]);
          metas.push({type:'member', group:groupName, name});
        });
      });

      expandedGroup = groupName;
      pieSliceMeta = metas;
      grpPieChart.data.labels = labels;
      grpPieChart.data.datasets[0].data = values;
      grpPieChart.data.datasets[0].backgroundColor = colors;
      grpPieChart.update();
      renderExpandedLegend(labels, values, colors, metas);
      openOnlyGroupRow(groupName);

      const bar = ensureDrillBar();
      if (bar) {
        bar.style.display = 'flex';
        const title = document.getElementById('grpDrillTitle');
        if (title) title.textContent = groupName + ' の部分だけ銘柄別に表示';
      }
    } catch(err){ console.warn('partial group expansion failed',err); }
  }

  function wireGroupPieClick(){
    try {
      const canvas = document.getElementById('grpPieCanvas');
      if (!canvas || canvas.dataset.groupPieClickBound === '1') return;
      canvas.dataset.groupPieClickBound = '1';
      canvas.style.cursor = 'pointer';
      canvas.addEventListener('click',(event)=>{
        if (typeof grpPieChart === 'undefined' || !grpPieChart) return;
        const hits = grpPieChart.getElementsAtEventForMode(event,'nearest',{intersect:true},true);
        if (!hits.length) return;
        const idx = hits[0].index;
        const meta = pieSliceMeta[idx];
        if (!meta) return;
        if (meta.type === 'member') {
          if (typeof showStockChart === 'function') showStockChart(meta.name);
          return;
        }
        expandGroupSlice(meta.group);
      });
    } catch(err){ console.warn('group pie click wiring failed',err); }
  }

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

    if (typeof renderGroupPie === 'function' && !renderGroupPie.__partialExpandEnhanced) {
      const original = renderGroupPie;
      const enhanced = function(){
        const keepExpanded = expandedGroup;
        original();
        requestAnimationFrame(()=>{
          enhanceGroupTable();
          snapshotBasePie();
          wireGroupPieClick();
          const bar = ensureDrillBar();
          if (keepExpanded && basePie && basePie.labels.includes(keepExpanded)) {
            expandGroupSlice(keepExpanded);
          } else {
            expandedGroup = '';
            if (bar) bar.style.display = 'none';
          }
        });
      };
      enhanced.__partialExpandEnhanced = true;
      renderGroupPie = enhanced;
    }

    if (typeof TAB_RENDERERS !== 'undefined' && TAB_RENDERERS.tabDash) {
      const originalDash = TAB_RENDERERS.tabDash;
      if (!originalDash.__mobileDashboardEnhanced) {
        const enhancedDash = ()=>{originalDash();if(isMobile()&&typeof drawLine==='function')requestAnimationFrame(()=>drawLine());};
        enhancedDash.__mobileDashboardEnhanced = true;
        TAB_RENDERERS.tabDash = enhancedDash;
      }
    }

    if (isMobile() && typeof activeTab !== 'undefined' && activeTab==='tabDash' && typeof DATES!=='undefined' && DATES.length && typeof drawLine==='function') requestAnimationFrame(()=>drawLine());
    if (typeof activeTab !== 'undefined' && activeTab==='tabAnal') requestAnimationFrame(()=>{enhanceGroupTable();snapshotBasePie();wireGroupPieClick();ensureDrillBar();});
  } catch(err){ console.warn('mobile dashboard enhancement failed',err); }
})();
`;

function injectMobileUi(html){
  if (!html.includes('id="mobile-dashboard-ui-style"')) html = html.replace('</head>',`<style id="mobile-dashboard-ui-style">${MOBILE_UI_CSS}</style></head>`);
  if (!html.includes('id="mobile-dashboard-ui-script"')) html = html.replace('</body>',`<script id="mobile-dashboard-ui-script">${MOBILE_UI_SCRIPT}</script></body>`);
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
      const html=injectMobileUi(await response.clone().text());
      const headers=new Headers(response.headers);headers.delete('content-length');
      return new Response(html,{status:response.status,statusText:response.statusText,headers});
    })());return;
  }
  event.respondWith(caches.match(event.request).then((cached)=>cached||fetch(event.request).then((res)=>{if(res&&res.status===200){const clone=res.clone();caches.open(CACHE_NAME).then((cache)=>cache.put(event.request,clone));}return res;})));
});
