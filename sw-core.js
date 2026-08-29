const CACHE_NAME = 'asset-mgr-v16-pnl-all-rows';
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
#grpDrillBar{display:flex;align-items:center;gap:8px;margin:6px 0 8px;min-height:34px;flex-wrap:nowrap;}
#grpDrillBack{padding:6px 10px;font-size:12px;visibility:hidden;pointer-events:none;flex:0 0 auto;}
#grpDrillBar.is-expanded #grpDrillBack{visibility:visible;pointer-events:auto;}
#grpDrillTitle{font-size:12px;color:var(--muted);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

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
  let expandedMembers = [];
  let basePie = null;
  let detailProgress = 0;
  let detailAnimFrame = 0;

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
      const shouldOpen = !!groupName && row.dataset.groupName === groupName;
      detail.style.display = shouldOpen ? '' : 'none';
      row.classList.toggle('is-open', shouldOpen);
      row.setAttribute('aria-expanded', String(shouldOpen));
    });
  }

  function setDrillBarState(isExpanded, groupName){
    const bar = ensureDrillBar();
    if (!bar) return;
    bar.classList.toggle('is-expanded', !!isExpanded);
    const title = document.getElementById('grpDrillTitle');
    if (title) title.textContent = isExpanded && groupName
      ? groupName + ' の比率を維持したまま内訳表示'
      : 'グループをタップすると内訳表示';
  }

  function ensureDrillBar(){
    const canvas = document.getElementById('grpPieCanvas');
    if (!canvas) return null;
    let bar = document.getElementById('grpDrillBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'grpDrillBar';
      bar.innerHTML = '<button id="grpDrillBack" class="btn-ghost" type="button">← 詳細化を解除</button><span id="grpDrillTitle">グループをタップすると内訳表示</span>';
      const wrap = canvas.closest('.chart-wrap');
      if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(bar, wrap);
      document.getElementById('grpDrillBack').addEventListener('click',collapseGroupDetail);
    }
    return bar;
  }

  function snapshotBasePie(){
    if (typeof grpPieChart === 'undefined' || !grpPieChart || !grpPieChart.data || !grpPieChart.data.datasets.length) return false;
    const labels = (grpPieChart.data.labels || []).map(String);
    const values = (grpPieChart.data.datasets[0].data || []).map(Number);
    const rawColors = grpPieChart.data.datasets[0].backgroundColor || [];
    const colors = Array.isArray(rawColors) ? rawColors.slice() : labels.map(() => rawColors);
    const legend = document.getElementById('grpPieLegend');
    basePie = { labels, values, colors, legendHtml: legend ? legend.innerHTML : '' };
    return true;
  }

  function renderExpandedLegend(){
    const legend = document.getElementById('grpPieLegend');
    if (!legend || !basePie) return;
    const total = basePie.values.reduce((s,v)=>s+v,0);
    const groupIndex = basePie.labels.indexOf(expandedGroup);
    const groupTotal = groupIndex >= 0 ? basePie.values[groupIndex] : 0;
    const memberTotal = expandedMembers.reduce((s,m)=>s+m.value,0);
    const pieces = [];

    basePie.labels.forEach((label,i) => {
      if (label !== expandedGroup) {
        pieces.push('<span class="legend-item"><span class="dot" style="background:'+basePie.colors[i]+'"></span>'+escapeHtml(label)+' '+(total?basePie.values[i]/total*100:0).toFixed(1)+'%</span>');
        return;
      }
      pieces.push('<span class="legend-item" style="font-weight:600"><span class="dot" style="background:'+basePie.colors[i]+';outline:2px solid rgba(255,255,255,.9);outline-offset:1px"></span>'+escapeHtml(label)+' '+(total?groupTotal/total*100:0).toFixed(1)+'%（詳細）</span>');
      expandedMembers.forEach((m) => {
        pieces.push('<span class="legend-item" style="padding-left:10px"><span class="dot" style="background:'+m.color+'"></span>↳ '+escapeHtml(m.name)+' '+(total?m.value/memberTotal*groupTotal/total*100:0).toFixed(1)+'%</span>');
      });
    });
    legend.innerHTML = pieces.join('');
  }

  function animateDetailIn(){
    if (detailAnimFrame) cancelAnimationFrame(detailAnimFrame);
    const chart = typeof grpPieChart !== 'undefined' ? grpPieChart : null;
    if (!chart) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      detailProgress = 1;
      chart.draw();
      return;
    }
    detailProgress = 0;
    const started = performance.now();
    const duration = 360;
    const tick = (now) => {
      const t = Math.min(1,(now-started)/duration);
      detailProgress = 1 - Math.pow(1-t,3);
      chart.draw();
      if (t < 1) detailAnimFrame = requestAnimationFrame(tick);
      else detailAnimFrame = 0;
    };
    detailAnimFrame = requestAnimationFrame(tick);
  }

  function expandGroupSlice(groupName, animate){
    try {
      if (typeof grpPieChart === 'undefined' || !grpPieChart) return;
      if (!basePie && !snapshotBasePie()) return;
      const groupIndex = basePie.labels.indexOf(groupName);
      if (groupIndex < 0) return;

      const selectedDate = getSelectedAnalDate();
      const names = groupMembers(groupName, selectedDate);
      if (!names.length || typeof amountOfNameAt !== 'function') return;
      const rawValues = names.map((name)=>amountOfNameAt(name, selectedDate));
      const rawTotal = rawValues.reduce((s,v)=>s+v,0);
      if (!rawTotal) return;
      const palette = typeof getPalette === 'function' ? getPalette(names.length) : names.map(()=>basePie.colors[groupIndex]);

      expandedGroup = groupName;
      expandedMembers = names.map((name,i)=>({name,value:rawValues[i],color:palette[i]}));
      openOnlyGroupRow(groupName);
      renderExpandedLegend();
      setDrillBarState(true, groupName);

      if (animate === false) {
        detailProgress = 1;
        grpPieChart.draw();
      } else {
        animateDetailIn();
      }
    } catch(err){ console.warn('partial group expansion failed',err); }
  }

  function collapseGroupDetail(){
    if (detailAnimFrame) cancelAnimationFrame(detailAnimFrame);
    detailAnimFrame = 0;
    expandedGroup = '';
    expandedMembers = [];
    detailProgress = 0;
    openOnlyGroupRow('');
    setDrillBarState(false, '');
    const legend = document.getElementById('grpPieLegend');
    if (legend && basePie) legend.innerHTML = basePie.legendHtml;
    if (typeof grpPieChart !== 'undefined' && grpPieChart) grpPieChart.draw();
  }

  function relativeChartPoint(event, chart){
    if (typeof Chart !== 'undefined' && Chart.helpers && typeof Chart.helpers.getRelativePosition === 'function') {
      try { return Chart.helpers.getRelativePosition(event, chart); } catch (_) {}
    }
    const rect = chart.canvas.getBoundingClientRect();
    return {
      x:(event.clientX-rect.left)*(chart.width/rect.width),
      y:(event.clientY-rect.top)*(chart.height/rect.height)
    };
  }

  function memberAtEvent(event, chart, groupIndex){
    if (!expandedMembers.length) return null;
    const arc = chart.getDatasetMeta(0).data[groupIndex];
    if (!arc) return null;
    const p = relativeChartPoint(event, chart);
    const dx = p.x-arc.x, dy = p.y-arc.y;
    const radius = Math.sqrt(dx*dx+dy*dy);
    if (radius < arc.innerRadius || radius > arc.outerRadius) return null;
    let angle = Math.atan2(dy,dx);
    const twoPi = Math.PI*2;
    while (angle < arc.startAngle) angle += twoPi;
    while (angle > arc.endAngle && angle-twoPi >= arc.startAngle) angle -= twoPi;
    if (angle < arc.startAngle || angle > arc.endAngle) return null;
    const ratio = (angle-arc.startAngle)/(arc.endAngle-arc.startAngle || 1);
    const total = expandedMembers.reduce((s,m)=>s+m.value,0);
    let acc = 0;
    for (const m of expandedMembers) {
      acc += m.value/total;
      if (ratio <= acc + 1e-9) return m;
    }
    return expandedMembers[expandedMembers.length-1] || null;
  }

  function openStockDetail(name){
    const links = Array.from(document.querySelectorAll('#tabAnal section:nth-of-type(1) .stock-link[data-name]'));
    const target = links.find((el)=>el.dataset.name===name);
    if (target) { target.click(); return; }
    if (typeof showStockChart === 'function') showStockChart(name);
  }

  const groupDetailOverlayPlugin = {
    id:'groupDetailOverlay',
    afterDatasetsDraw(chart){
      if (!expandedGroup || !expandedMembers.length || detailProgress <= 0 || !basePie || chart.canvas.id !== 'grpPieCanvas') return;
      const groupIndex = basePie.labels.indexOf(expandedGroup);
      if (groupIndex < 0) return;
      const arc = chart.getDatasetMeta(0).data[groupIndex];
      if (!arc) return;
      const x=arc.x, y=arc.y, inner=arc.innerRadius, outer=arc.outerRadius, start=arc.startAngle, end=arc.endAngle;
      const total = expandedMembers.reduce((s,m)=>s+m.value,0);
      if (!total) return;
      const ctx = chart.ctx;
      let cursor = start;

      ctx.save();
      expandedMembers.forEach((m,i)=>{
        const next = i===expandedMembers.length-1 ? end : cursor + (end-start)*(m.value/total);
        ctx.beginPath();
        ctx.arc(x,y,outer,cursor,next);
        ctx.arc(x,y,inner,next,cursor,true);
        ctx.closePath();
        ctx.globalAlpha = detailProgress * .94;
        ctx.fillStyle = m.color;
        ctx.fill();

        if (i > 0) {
          const lineOuter = inner + (outer-inner)*detailProgress;
          ctx.beginPath();
          ctx.moveTo(x+Math.cos(cursor)*inner,y+Math.sin(cursor)*inner);
          ctx.lineTo(x+Math.cos(cursor)*lineOuter,y+Math.sin(cursor)*lineOuter);
          ctx.globalAlpha = detailProgress * .9;
          ctx.strokeStyle = 'rgba(17,17,17,.95)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        cursor = next;
      });

      /* Thick outline around the whole selected group, not each member. */
      ctx.beginPath();
      ctx.arc(x,y,outer+1.5,start,end);
      ctx.lineTo(x+Math.cos(end)*(inner-1.5),y+Math.sin(end)*(inner-1.5));
      ctx.arc(x,y,Math.max(1,inner-1.5),end,start,true);
      ctx.closePath();
      ctx.globalAlpha = Math.min(1,.35+detailProgress*.65);
      ctx.strokeStyle = 'rgba(255,255,255,.96)';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }
  };

  try {
    if (typeof Chart !== 'undefined' && !Chart.__groupDetailOverlayRegistered) {
      Chart.register(groupDetailOverlayPlugin);
      Chart.__groupDetailOverlayRegistered = true;
    }

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

    function wireGroupPieClick(){
      const canvas = document.getElementById('grpPieCanvas');
      if (!canvas || canvas.dataset.groupPieClickBound === '1') return;
      canvas.dataset.groupPieClickBound = '1';
      canvas.style.cursor = 'pointer';
      canvas.addEventListener('click',(event)=>{
        if (typeof grpPieChart === 'undefined' || !grpPieChart || !basePie) return;
        const hits = grpPieChart.getElementsAtEventForMode(event,'nearest',{intersect:true},true);
        if (!hits.length) return;
        const groupIndex = hits[0].index;
        const groupName = basePie.labels[groupIndex];
        if (!groupName) return;

        if (expandedGroup === groupName) {
          collapseGroupDetail();
          return;
        }
        expandGroupSlice(groupName,true);
      });
    }

    if (typeof renderGroupPie === 'function' && !renderGroupPie.__overlayEnhanced) {
      const original = renderGroupPie;
      const enhanced = function(){
        const keepExpanded = expandedGroup;
        original();
        requestAnimationFrame(()=>{
          enhanceGroupTable();
          snapshotBasePie();
          wireGroupPieClick();
          ensureDrillBar();
          if (keepExpanded && basePie && basePie.labels.includes(keepExpanded)) {
            expandGroupSlice(keepExpanded,false);
          } else {
            expandedGroup = '';
            expandedMembers = [];
            detailProgress = 0;
            setDrillBarState(false, '');
          }
        });
      };
      enhanced.__overlayEnhanced = true;
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
    if (typeof activeTab !== 'undefined' && activeTab==='tabAnal') requestAnimationFrame(()=>{enhanceGroupTable();snapshotBasePie();wireGroupPieClick();ensureDrillBar();setDrillBarState(false,'');});
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
