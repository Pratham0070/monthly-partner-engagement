// Shared dashboard script — everything-editable mode
// Edit Mode covers: all text in tables, KPIs, cards, lists, section heads, topbar titles,
// tile labels, footer disclaimers, source citations. Chart back-series + logo also editable.

const STORAGE_KEY = 'centricity_mpe_dashboard_v3';
const PAGE_KEY = (document.body.dataset.page || location.pathname.split('/').pop() || 'home').replace(/\W+/g,'_');
function pageStoreKey(){ return STORAGE_KEY + '::' + PAGE_KEY; }
const LOGO_KEY = STORAGE_KEY + '::__logo';

// =================== Edit marking ===================
function markEditableElements(){
  const skip = el => el.closest('.actions, a.back-btn, button, input, select, textarea, .chart-data-editor');
  const blockSel = 'table, tr, td, th, ul, ol, li, h1, h2, h3, h4, h5, h6, p, div, section, footer, header, form, button, input, select, textarea, canvas, img, svg, a';
  document.querySelectorAll('td, th, p, h1, h2, h3, h4, h5, h6, li, span, div, summary, label, caption, blockquote').forEach(el=>{
    if(skip(el)) return;
    if(el.querySelector(blockSel)) return;          // not a text leaf
    if(el.querySelector('[contenteditable]')) return; // already has editable child
    if(el.textContent.trim() === '') return;        // empty / decorative
    if(el.hasAttribute('contenteditable')) return;  // pre-marked
    el.setAttribute('contenteditable','false');
  });
}

function toggleEdit(){
  document.body.classList.toggle('view-mode');
  const editing = !document.body.classList.contains('view-mode');
  document.querySelectorAll('[contenteditable]').forEach(el=>{
    el.setAttribute('contenteditable', editing ? 'true' : 'false');
  });
  document.querySelectorAll('.edit-only').forEach(el=>{
    el.style.display = editing ? '' : 'none';
  });
  const btn = document.getElementById('editBtn');
  if(!btn) return;
  if(editing){ btn.textContent = '👁 View Mode'; btn.classList.add('active'); }
  else { btn.textContent = '✎ Edit Mode'; btn.classList.remove('active'); saveLocal(); }
}

// =================== Persistence ===================
function saveLocal(){
  const data = {};
  document.querySelectorAll('[contenteditable]').forEach((el,i)=>{ data['ce_'+i] = el.innerHTML; });
  document.querySelectorAll('canvas[data-series]').forEach(c=>{ data['chart_'+c.id] = c.dataset.series; });
  const m = document.getElementById('reportMonth');
  if(m) data['__month'] = m.value;
  try{ localStorage.setItem(pageStoreKey(), JSON.stringify(data)); }catch(e){}
  if(m){ try{ localStorage.setItem(STORAGE_KEY + '::__month', m.value); }catch(e){} }
  flashToast('Saved');
}

function loadLocal(){
  try{
    const raw = localStorage.getItem(pageStoreKey());
    if(raw){
      const data = JSON.parse(raw);
      document.querySelectorAll('[contenteditable]').forEach((el,i)=>{
        if(data['ce_'+i] !== undefined) el.innerHTML = data['ce_'+i];
      });
      document.querySelectorAll('canvas[data-series]').forEach(c=>{
        const saved = data['chart_'+c.id];
        if(saved) c.dataset.series = saved;
      });
    }
    const m = document.getElementById('reportMonth');
    const sharedMonth = localStorage.getItem(STORAGE_KEY + '::__month');
    if(m && sharedMonth) m.value = sharedMonth;
  }catch(e){}
}

function resetAll(){
  if(confirm('Reset all edits on this page to original values?')){
    localStorage.removeItem(pageStoreKey());
    location.reload();
  }
}

function flashToast(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#BD9568;color:#000;padding:10px 18px;font-family:Cambria;font-weight:bold;border-radius:2px;z-index:999;box-shadow:0 2px 8px rgba(0,0,0,0.2)';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 1500);
}

function syncMonthPill(){
  const m = document.getElementById('reportMonth');
  const pill = document.getElementById('monthPill');
  if(!m || !pill) return;
  const v = m.value;
  if(!v) return;
  const [y,mo] = v.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  pill.textContent = 'Reporting Month — ' + names[parseInt(mo)-1] + ' ' + y;
}

// =================== Charts (data-driven) — dark-theme, premium styling ===================
window._charts = {};

function _fmtIN(n){ try{ return Number(n).toLocaleString('en-IN'); }catch(e){ return n; } }

// Vertical gradient that adapts to the chart's plot area (gold for bars, soft fill for lines)
function _vGradient(stops){
  return (context)=>{
    const chart = context.chart;
    const area = chart && chart.chartArea;
    if(!area) return stops[0][1];
    const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
    stops.forEach(s=>g.addColorStop(s[0], s[1]));
    return g;
  };
}

const _CREAM = 'rgba(239,230,214,0.78)';
const _GRID  = 'rgba(239,230,214,0.07)';
const _tooltipBase = {
  backgroundColor:'#0B0907', borderColor:'rgba(189,149,104,0.55)', borderWidth:1,
  titleColor:'#EFE6D6', bodyColor:'#EFE6D6', padding:10, cornerRadius:3,
  titleFont:{family:'Cambria, Georgia, serif', size:12, weight:'700'},
  bodyFont:{family:'Cambria, Georgia, serif', size:12}
};

function _chartOptions(type, data){
  const isPie = type === 'doughnut' || type === 'pie';
  if(isPie){
    return {
      responsive:true, maintainAspectRatio:false, cutout:'62%', layout:{padding:8},
      animation:{duration:650, easing:'easeOutQuart'},
      plugins:{
        legend:{position:'right', labels:{color:'#EFE6D6', font:{family:'Cambria, Georgia, serif', size:12}, boxWidth:12, boxHeight:12, padding:14, usePointStyle:true, pointStyle:'rectRounded'}},
        tooltip:Object.assign({}, _tooltipBase, {displayColors:true, callbacks:{label:(c)=>{
          const arr = c.dataset.data || []; const tot = arr.reduce((a,b)=>a+(+b||0),0);
          const p = tot ? (c.parsed/tot*100) : 0;
          return '  ' + c.label + ' — ' + _fmtIN(c.parsed) + ' (' + p.toFixed(1) + '%)';
        }}})
      }
    };
  }
  const multi = (data.datasets || []).length > 1;
  return {
    responsive:true, maintainAspectRatio:false, layout:{padding:{top:6}},
    animation:{duration:650, easing:'easeOutQuart'},
    interaction:{mode:'index', intersect:false},
    plugins:{
      legend:{display:multi, labels:{color:'#EFE6D6', font:{family:'Cambria, Georgia, serif', size:11}, usePointStyle:true, pointStyle:'rectRounded'}},
      tooltip:Object.assign({}, _tooltipBase, {displayColors:false, callbacks:{label:(c)=>{
        const lbl = c.dataset.label ? c.dataset.label + ': ' : '';
        const v = (c.parsed && c.parsed.y != null) ? c.parsed.y : c.parsed;
        return '  ' + lbl + _fmtIN(v);
      }}})
    },
    scales:{
      x:{ grid:{display:false}, border:{display:false}, ticks:{color:_CREAM, font:{family:'Cambria, Georgia, serif', size:10}} },
      y:{ grid:{color:_GRID}, border:{display:false}, ticks:{color:_CREAM, font:{family:'Cambria, Georgia, serif', size:10}, callback:(v)=>_fmtIN(v)}, beginAtZero:false }
    }
  };
}

function _styleDatasets(type, data){
  const isPie = type === 'doughnut' || type === 'pie';
  (data.datasets || []).forEach(ds=>{
    if(isPie){
      if(Array.isArray(ds.backgroundColor)){
        ds.backgroundColor = ds.backgroundColor.map(col=>{
          const k = (''+col).toLowerCase().replace(/\s/g,'');
          return (k==='#000'||k==='#000000'||k==='black') ? '#8C8C8C' : col;  // keep dark slices visible
        });
      }
      ds.borderColor = '#0F0C0A'; ds.borderWidth = 3; ds.hoverOffset = 10; ds.hoverBorderColor = '#0F0C0A';
    } else if(type === 'bar'){
      ds.borderWidth = 0; ds.borderRadius = 6; ds.borderSkipped = false; ds.maxBarThickness = 38;
      ds.backgroundColor = _vGradient([[0,'#E7C79B'],[0.55,'#BD9568'],[1,'#8E6E44']]);
      ds.hoverBackgroundColor = _vGradient([[0,'#F0D6AE'],[1,'#A07E4E']]);
    } else { // line / area
      ds.tension = (ds.tension != null) ? ds.tension : 0.35;
      ds.borderColor = '#BD9568'; ds.borderWidth = 2;
      ds.pointBackgroundColor = '#BD9568'; ds.pointBorderColor = '#0F0C0A';
      ds.pointRadius = 3; ds.pointHoverRadius = 5; ds.fill = true;
      ds.backgroundColor = _vGradient([[0,'rgba(189,149,104,0.32)'],[1,'rgba(189,149,104,0.02)']]);
    }
  });
}

function initChart(canvasId){
  const c = document.getElementById(canvasId);
  if(!c || typeof Chart === 'undefined') return;
  const type = c.dataset.chartType || 'line';
  let data;
  try{ data = JSON.parse(c.dataset.series); }
  catch(e){ console.error('Bad chart data on '+canvasId, e); return; }
  if(window._charts[canvasId]) window._charts[canvasId].destroy();
  _styleDatasets(type, data);
  window._charts[canvasId] = new Chart(c, {type, data, options:_chartOptions(type, data)});
}

function initAllCharts(){
  if(typeof Chart !== 'undefined'){
    Chart.defaults.font.family = 'Cambria, Georgia, serif';
    Chart.defaults.color = _CREAM;
  }
  document.querySelectorAll('canvas[data-series]').forEach(c=>initChart(c.id));
}

function attachChartEditors(){
  document.querySelectorAll('canvas[data-series]').forEach(canvas=>{
    const wrap = canvas.closest('.chart-wrap');
    if(!wrap) return;
    if(wrap.parentElement.querySelector('[data-editor-for="'+canvas.id+'"]')) return;
    const editor = document.createElement('div');
    editor.className = 'chart-data-editor edit-only no-print';
    editor.dataset.editorFor = canvas.id;
    editor.style.cssText = 'margin-top:10px;display:none;background:#FAFAFA;border:1px dashed #BD9568;padding:10px;border-radius:2px';
    editor.innerHTML =
      '<div style="font-size:11px;font-weight:bold;color:#BD9568;letter-spacing:1px;margin-bottom:6px">✎ CHART DATA (edit JSON, then click Apply)</div>' +
      '<textarea style="width:100%;min-height:120px;font-family:Consolas,monospace;font-size:11px;padding:6px;border:1px solid #BD9568;background:#FFF8E7;color:#000"></textarea>' +
      '<button class="apply-chart" style="margin-top:6px;padding:5px 14px;background:#BD9568;color:#000;border:none;font-family:Cambria;cursor:pointer;font-weight:bold;letter-spacing:0.5px">Apply</button>' +
      ' <span style="font-size:10px;color:#777;margin-left:8px">Tip: edit numbers inside the "data" arrays; keep labels matching</span>';
    wrap.parentElement.insertBefore(editor, wrap.nextSibling);
    const textarea = editor.querySelector('textarea');
    const refresh = ()=>{
      try{ textarea.value = JSON.stringify(JSON.parse(canvas.dataset.series), null, 2); }
      catch(e){ textarea.value = canvas.dataset.series; }
    };
    refresh();
    editor.querySelector('.apply-chart').addEventListener('click', ()=>{
      try{
        const parsed = JSON.parse(textarea.value);
        canvas.dataset.series = JSON.stringify(parsed);
        initChart(canvas.id);
        flashToast('Chart updated');
      }catch(e){ alert('Invalid JSON: '+e.message); }
    });
  });
}

// =================== Logo replacement ===================
function applyStoredLogo(){
  try{
    const storedLogo = localStorage.getItem(LOGO_KEY);
    if(storedLogo){
      document.querySelectorAll('img.logo, img.logo-footer').forEach(img=>{ img.src = storedLogo; });
    }
  }catch(e){}
}

function attachLogoChanger(){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/svg+xml,image/webp,image/*';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', e=>{
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ()=>{
      try{ localStorage.setItem(LOGO_KEY, r.result); }
      catch(err){ alert('Image too large for browser storage. Try a smaller file (< 1 MB).'); return; }
      document.querySelectorAll('img.logo, img.logo-footer').forEach(img=>{ img.src = r.result; });
      flashToast('Logo updated');
    };
    r.readAsDataURL(f);
  });
  const btn = document.createElement('button');
  btn.className = 'edit-only no-print';
  btn.textContent = '🖼 Logo';
  btn.title = 'Replace Centricity logo (saved in browser)';
  btn.style.display = 'none';
  btn.onclick = ()=>input.click();
  const actions = document.querySelector('.topbar .actions');
  if(actions) actions.appendChild(btn);

  const reset = document.createElement('button');
  reset.className = 'edit-only no-print';
  reset.textContent = '↺ Logo';
  reset.title = 'Restore default logo';
  reset.style.display = 'none';
  reset.onclick = ()=>{
    if(confirm('Reset logo to default?')){
      localStorage.removeItem(LOGO_KEY);
      location.reload();
    }
  };
  if(actions) actions.appendChild(reset);
}

// =================== Suppress tile navigation in edit mode + smooth page transitions ===================
function blockTileClicksInEdit(){
  document.addEventListener('click', e=>{
    const a = e.target.closest('a.tile, a.back-btn, a.nav-btn, a.page-nav-btn');
    if(!a) return;

    // Edit mode → block navigation so tile/back text can be edited
    if(!document.body.classList.contains('view-mode')){
      e.preventDefault();
      return;
    }

    // Allow new-tab modifier clicks (Ctrl/Cmd/Shift) and middle-click to behave normally
    if(e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;

    const href = a.getAttribute('href');
    if(!href || href.startsWith('#') || /^https?:\/\//i.test(href) || href.startsWith('mailto:')) return;

    // Page transitions disabled — navigate immediately, no fade-out delay.
    return;
  });
}

// =================== Prev / Next navigation ===================
const PAGE_ORDER = [
  {file:'01-market-outlook.html',      title:'Market Outlook'},
  {file:'02-valuations.html',          title:'Valuations'},
  {file:'03-earnings.html',            title:'Earnings & Sensex'},
  {file:'04-mf-industry.html',         title:'MF Industry'},
  {file:'05-pms-industry.html',        title:'PMS Industry'},
  {file:'06-aif-industry.html',        title:'AIF Industry'},
  {file:'07-about-centricity.html',    title:'About Centricity'},
  {file:'08-sales-tools.html',         title:'Sales Tools'},
  {file:'09-focused-mutual-funds.html',title:'Focused MF'},
  {file:'10-focused-debt-pms.html',    title:'Debt PMS'},
  {file:'11-focused-equity-pms.html',  title:'Equity PMS'},
  {file:'12-cat2-debt-aifs.html',      title:'Cat II Debt AIF'},
  {file:'13-cat2-equity-aifs.html',    title:'Cat II Equity AIF'},
  {file:'14-cat3-equity-aifs.html',    title:'Cat III Equity AIF'},
  {file:'15-gift-city.html',           title:'GIFT City'},
  {file:'16-fds-bonds.html',           title:'FDs & Bonds'},
  {file:'17-unlisted-equity.html',     title:'Unlisted Equity'},
  {file:'18-unlisted-options.html',    title:'Unlisted Options'},
  {file:'20-drawdowns.html',           title:'Fund Drawdowns'},
  {file:'19-partner-quiz.html',        title:'Partner Quiz'}
];

function attachPrevNext(){
  const current = location.pathname.split('/').pop() || location.pathname;
  const idx = PAGE_ORDER.findIndex(p => current.endsWith(p.file));
  if(idx === -1) return;  // not a section page (e.g. home)

  // Build the bottom-of-page nav bar
  const nav = document.createElement('div');
  nav.className = 'page-nav no-print';

  const leftSlot = document.createElement('div');
  leftSlot.className = 'nav-slot nav-slot-left';
  if(idx > 0){
    const prev = PAGE_ORDER[idx - 1];
    const num = String(idx).padStart(2,'0');
    leftSlot.innerHTML =
      '<a class="page-nav-btn prev" href="' + prev.file + '">' +
        '<span class="nav-arrow">←</span>' +
        '<span class="nav-info">' +
          '<span class="nav-lbl">Previous</span>' +
          '<span class="nav-ttl">' + num + ' · ' + prev.title + '</span>' +
        '</span>' +
      '</a>';
  }

  const rightSlot = document.createElement('div');
  rightSlot.className = 'nav-slot nav-slot-right';
  if(idx < PAGE_ORDER.length - 1){
    const next = PAGE_ORDER[idx + 1];
    const num = String(idx + 2).padStart(2,'0');
    rightSlot.innerHTML =
      '<a class="page-nav-btn next" href="' + next.file + '">' +
        '<span class="nav-info">' +
          '<span class="nav-lbl">Next</span>' +
          '<span class="nav-ttl">' + num + ' · ' + next.title + '</span>' +
        '</span>' +
        '<span class="nav-arrow">→</span>' +
      '</a>';
  }

  nav.appendChild(leftSlot);
  nav.appendChild(rightSlot);

  // Insert immediately before the <footer>
  const footer = document.querySelector('footer');
  if(footer) footer.parentNode.insertBefore(nav, footer);
  else document.body.appendChild(nav);

  // Keyboard shortcuts: Alt+ArrowLeft / Alt+ArrowRight
  document.addEventListener('keydown', e=>{
    if(!e.altKey) return;
    if(e.key === 'ArrowRight' && idx < PAGE_ORDER.length - 1){ location.href = PAGE_ORDER[idx + 1].file; }
    if(e.key === 'ArrowLeft' && idx > 0){ location.href = PAGE_ORDER[idx - 1].file; }
  });
}

// =================== Edit-access gate ===================
// Edit Mode is only visible when the URL contains ?edit=1 (or ?edit=true).
// Partners visiting the plain URL see a clean, read-only dashboard.
function isEditAuthorized(){
  const params = new URLSearchParams(location.search);
  const v = (params.get('edit') || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function lockEditingForViewers(){
  if(isEditAuthorized()) return;

  // Hide every topbar button (Edit, Save, Reset, Print) and the month picker + its label
  document.querySelectorAll('.topbar button').forEach(btn=>{
    btn.style.display = 'none';
  });
  document.querySelectorAll('.topbar input[type="month"]').forEach(el=>{ el.style.display = 'none'; });
  document.querySelectorAll('.topbar .actions > span').forEach(s=>{
    if(s.textContent.trim().toLowerCase() === 'reporting month') s.style.display = 'none';
  });

  // Make every editable element truly read-only
  document.querySelectorAll('[contenteditable]').forEach(el=>{
    el.setAttribute('contenteditable', 'false');
  });

  // Disarm the editing functions in case anything still tries to call them
  window.toggleEdit = function(){};
  window.saveLocal  = function(){};
  window.resetAll   = function(){};
}

// =================== Product one-pager selector (pages 10-14, 18) ===================
// Replaces the old search + tick-to-view. Renders an always-visible list of product
// names; clicking a name toggles its one-pager card(s). Several may be open at once.
// No-op on pages without a .pms-nav block.
function initPmsNav(){
  const nav = document.querySelector('.pms-nav');
  if(!nav) return;
  const items = Array.from(nav.querySelectorAll('.pms-nav-item'));
  const cards = Array.from(document.querySelectorAll('.pms-card'));
  const empty = document.getElementById('pmsNoResults');

  function apply(){
    const open = new Set(items.filter(i=>i.classList.contains('active')).map(i=>i.dataset.name));
    cards.forEach(c=>{ c.classList.toggle('is-open', open.has(c.dataset.name)); });
    if(empty){
      if(open.size){ empty.style.display = 'none'; }
      else {
        empty.style.display = 'block';
        empty.textContent = '↑ Click a product name above to open its one-pager. You can open as many as you like.';
      }
    }
  }

  items.forEach(it=>{
    it.setAttribute('aria-pressed','false');
    it.addEventListener('click', ()=>{
      const on = it.classList.toggle('active');
      it.setAttribute('aria-pressed', on ? 'true' : 'false');
      apply();
    });
  });
  const clearBtn = nav.querySelector('.pms-nav-clear');
  if(clearBtn) clearBtn.addEventListener('click', ()=>{
    items.forEach(i=>{ i.classList.remove('active'); i.setAttribute('aria-pressed','false'); });
    apply();
  });
  apply(); // start with nothing open
}

// =================== Boot ===================
window.addEventListener('DOMContentLoaded', ()=>{
  applyStoredLogo();
  attachPrevNext();       // inject ← Prev / Next → buttons (skipped on home)
  attachChartEditors();   // before markEditableElements so the editor UI is skipped
  attachLogoChanger();    // adds 🖼 Logo + ↺ Logo buttons (hidden until edit mode)
  markEditableElements();
  loadLocal();            // restores edits + chart series from storage
  initAllCharts();        // render charts (data may have been replaced by loadLocal)
  blockTileClicksInEdit();
  initPmsNav();           // wire the product name-list → one-pager toggles
  syncMonthPill();
  const m = document.getElementById('reportMonth');
  if(m) m.addEventListener('change', ()=>{ syncMonthPill(); saveLocal(); });
  lockEditingForViewers(); // LAST — strips edit affordances unless ?edit=1
});

// Ctrl+S / Cmd+S to save while editing
document.addEventListener('keydown', (e)=>{
  if((e.ctrlKey || e.metaKey) && e.key === 's'){ e.preventDefault(); saveLocal(); }
});

// When the user navigates BACK via the browser (BFCache), clear the page-leaving class so the
// cached page doesn't appear stuck in its exit state.
window.addEventListener('pageshow', (e)=>{
  document.body.classList.remove('page-leaving');
  document.querySelectorAll('.tile-selected').forEach(t=>t.classList.remove('tile-selected'));
});
