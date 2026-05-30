// Lampstand — Open Scripture Study  (v1)
// All data is fetched from free public sources; uploaded files never leave the browser.

import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';

const API = 'https://bible.helloao.org/api';
const $ = s => document.querySelector(s);

// ---- canonical book list (USFM id -> name) ----
const BOOKS = [
  ['GEN','Genesis'],['EXO','Exodus'],['LEV','Leviticus'],['NUM','Numbers'],['DEU','Deuteronomy'],
  ['JOS','Joshua'],['JDG','Judges'],['RUT','Ruth'],['1SA','1 Samuel'],['2SA','2 Samuel'],
  ['1KI','1 Kings'],['2KI','2 Kings'],['1CH','1 Chronicles'],['2CH','2 Chronicles'],['EZR','Ezra'],
  ['NEH','Nehemiah'],['EST','Esther'],['JOB','Job'],['PSA','Psalms'],['PRO','Proverbs'],
  ['ECC','Ecclesiastes'],['SNG','Song of Solomon'],['ISA','Isaiah'],['JER','Jeremiah'],['LAM','Lamentations'],
  ['EZK','Ezekiel'],['DAN','Daniel'],['HOS','Hosea'],['JOL','Joel'],['AMO','Amos'],
  ['OBA','Obadiah'],['JON','Jonah'],['MIC','Micah'],['NAM','Nahum'],['HAB','Habakkuk'],
  ['ZEP','Zephaniah'],['HAG','Haggai'],['ZEC','Zechariah'],['MAL','Malachi'],['MAT','Matthew'],
  ['MRK','Mark'],['LUK','Luke'],['JHN','John'],['ACT','Acts'],['ROM','Romans'],
  ['1CO','1 Corinthians'],['2CO','2 Corinthians'],['GAL','Galatians'],['EPH','Ephesians'],['PHP','Philippians'],
  ['COL','Colossians'],['1TH','1 Thessalonians'],['2TH','2 Thessalonians'],['1TI','1 Timothy'],['2TI','2 Timothy'],
  ['TIT','Titus'],['PHM','Philemon'],['HEB','Hebrews'],['JAS','James'],['1PE','1 Peter'],
  ['2PE','2 Peter'],['1JN','1 John'],['2JN','2 John'],['3JN','3 John'],['JUD','Jude'],['REV','Revelation']
];
const BOOK_NAME = Object.fromEntries(BOOKS);

// ---- state ----
const state = {
  translation: 'BSB',
  book: 'GEN',
  chapter: 1,
  translations: [],
  commentaries: [],
  booksMeta: {},      // book id -> {numberOfChapters}
  crossRefs: null,    // vendored lookup
  activeCommentary: 'adam-clarke',
  selectedVerse: null,
};

// ---- IndexedDB for the personal library ----
const DB_NAME = 'lampstand-library', STORE = 'files', BSTORE = 'bibles';
function openDB(){
  return new Promise((res,rej)=>{
    const r = indexedDB.open(DB_NAME,2);
    r.onupgradeneeded = (e)=>{
      const db=r.result;
      if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(BSTORE)) db.createObjectStore(BSTORE,{keyPath:'id'});
    };
    r.onsuccess = ()=> res(r.result);
    r.onerror = ()=> rej(r.error);
  });
}
async function dbPut(rec){ const db=await openDB(); return new Promise((res,rej)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(rec);t.oncomplete=res;t.onerror=()=>rej(t.error);}); }
async function dbAll(){ const db=await openDB(); return new Promise((res,rej)=>{const t=db.transaction(STORE,'readonly');const rq=t.objectStore(STORE).getAll();rq.onsuccess=()=>res(rq.result);rq.onerror=()=>rej(rq.error);}); }
async function dbDel(id){ const db=await openDB(); return new Promise((res,rej)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).delete(id);t.oncomplete=res;t.onerror=()=>rej(t.error);}); }
let dbAvailable = true;

// ---- helpers ----
function toast(msg, ms=2600){ const t=$('#toast'); t.textContent=msg; t.hidden=false; clearTimeout(t._t); t._t=setTimeout(()=>t.hidden=true,ms); }
function refKey(b,c,v){ return `${b}.${c}.${v}`; }
function prettyRef(r){
  // "JHN.3.16" or "JHN.3.16-18" or "JHN.3.16-MAT.1.1"
  const [a,b] = r.split('-');
  const [bk,ch,vs] = a.split('.');
  let s = `${BOOK_NAME[bk]||bk} ${ch}:${vs}`;
  if(b){ const p=b.split('.'); s += p.length===3 ? `–${BOOK_NAME[p[0]]||p[0]} ${p[1]}:${p[2]}` : `–${b}`; }
  return s;
}

async function getJSON(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}

// ---- load catalogs + cross refs ----
async function init(){
  // theme
  const savedTheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = savedTheme;

  try{
    const [tr, cm] = await Promise.all([
      getJSON(`${API}/available_translations.json`),
      getJSON(`${API}/available_commentaries.json`)
    ]);
    state.translations = tr.translations || [];
    state.commentaries = cm.commentaries || [];
  }catch(e){ toast('Could not load the translation list. Check your connection.'); }

  // vendored cross-references (CC-BY, OpenBible.info)
  getJSON('cross_refs.json').then(d=>state.crossRefs=d).catch(()=>{ state.crossRefs={}; });

  await loadChapter();
  wireUI();
}

// ---- render a chapter ----
async function loadChapter(){
  const inner = $('#readerInner');
  inner.innerHTML = '<div class="placeholder">Loading…</div>';
  state.selectedVerse = null;
  renderContext();

  const tMeta = state.translations.find(t=>t.id===state.translation);
  document.querySelector('.reader').classList.toggle('reader-rtl', tMeta && tMeta.textDirection==='rtl');

  try{
    const data = await getJSON(`${API}/${state.translation}/${state.book}/${state.chapter}.json`);
    state.booksMeta[state.book] = {numberOfChapters: data.book.numberOfChapters};
    renderChapter(data);
    updateNavLabels(data);
  }catch(e){
    inner.innerHTML = `<div class="placeholder">Couldn't load this passage.<br><button class="chap-nav" id="retry" style="margin-top:14px">Retry</button></div>`;
    $('#retry').onclick = loadChapter;
  }
}

function renderChapter(data){
  const inner = $('#readerInner');
  const frag = document.createDocumentFragment();
  const h = document.createElement('h2'); h.className='chapter-title';
  h.textContent = `${data.book.commonName} ${data.chapter.number}`;
  frag.appendChild(h);
  const sub = document.createElement('p'); sub.className='chapter-sub';
  const tm = state.translations.find(t=>t.id===state.translation);
  sub.textContent = tm ? tm.englishName : state.translation;
  frag.appendChild(sub);

  const body = document.createElement('div'); body.className='chapter-body';
  for(const item of data.chapter.content){
    if(item.type==='heading'){
      const hd=document.createElement('h3'); hd.className='sec-heading';
      hd.textContent=(item.content||[]).join(' '); body.appendChild(hd);
    } else if(item.type==='line_break'){
      body.appendChild(document.createElement('br'));
    } else if(item.type==='verse'){
      const span=document.createElement('span'); span.className='verse'; span.dataset.v=item.number;
      const num=document.createElement('span'); num.className='vnum'; num.textContent=item.number;
      span.appendChild(num);
      const text = (item.content||[]).map(c=> typeof c==='string'?c:'').join(' ').trim();
      span.appendChild(document.createTextNode(' '+text+' '));
      span.onclick=()=>selectVerse(item.number, span);
      body.appendChild(span);
    }
  }
  frag.appendChild(body);
  inner.innerHTML=''; inner.appendChild(frag);
  inner.parentElement.scrollTop = 0;
  window.scrollTo(0,0);
}

function updateNavLabels(data){
  $('#bookLabel').textContent = data.book.commonName;
  $('#chapterLabel').textContent = data.chapter.number;
  $('#translationLabel').textContent = (state.translations.find(t=>t.id===state.translation)||{}).shortName || state.translation;
  const nCh = data.book.numberOfChapters;
  $('#prevChap').disabled = (state.chapter<=1 && bookIndex()===0);
  $('#nextChap').disabled = (state.chapter>=nCh && bookIndex()===BOOKS.length-1);
}
function bookIndex(){ return BOOKS.findIndex(b=>b[0]===state.book); }

// ---- verse selection -> cross refs + commentary ----
function selectVerse(num, el){
  document.querySelectorAll('.verse.selected').forEach(e=>e.classList.remove('selected'));
  el.classList.add('selected');
  state.selectedVerse = num;
  renderContext();
}

function renderContext(){
  const tab = document.querySelector('.ctab.active').dataset.tab;
  const body = $('#contextBody');
  if(!state.selectedVerse){
    body.innerHTML = '<p class="ctx-hint">Tap any verse to see its cross-references and commentary.</p>';
    return;
  }
  if(tab==='xref') renderXrefs(body);
  else renderCommentary(body);
}

function renderXrefs(body){
  const key = refKey(state.book, state.chapter, state.selectedVerse);
  const refs = (state.crossRefs && state.crossRefs[key]) || [];
  let html = `<p class="ctx-ref">${BOOK_NAME[state.book]} ${state.chapter}:${state.selectedVerse} · cross-references</p>`;
  if(!refs.length){ body.innerHTML = html + '<p class="empty-state">No cross-references for this verse.</p>'; return; }
  html += refs.map(r=>`<button class="xref-item" data-ref="${r}">${prettyRef(r)}<span class="xref-preview" data-preview="${r}">…</span></button>`).join('');
  body.innerHTML = html;
  body.querySelectorAll('.xref-item').forEach(btn=>{
    btn.onclick = ()=> goToRef(btn.dataset.ref);
  });
  // lazily load short previews
  refs.forEach(r=> loadPreview(r));
}

async function loadPreview(r){
  const [a]=r.split('-'); const [bk,ch,vs]=a.split('.');
  try{
    const data = await getJSON(`${API}/${state.translation}/${bk}/${ch}.json`);
    const v = data.chapter.content.find(c=>c.type==='verse' && c.number==+vs);
    if(v){
      const txt=(v.content||[]).map(c=>typeof c==='string'?c:'').join(' ').trim();
      const el=document.querySelector(`[data-preview="${r}"]`);
      if(el) el.textContent = txt.length>120 ? txt.slice(0,120)+'…' : txt;
    }
  }catch(e){/* preview is best-effort */}
}

function goToRef(r){
  const [a]=r.split('-'); const [bk,ch]=a.split('.');
  state.book=bk; state.chapter=+ch; loadChapter(); closeAll();
}

async function renderCommentary(body){
  const options = state.commentaries.map(c=>`<option value="${c.id}" ${c.id===state.activeCommentary?'selected':''}>${c.englishName}</option>`).join('');
  body.innerHTML = `<div class="comment-picker"><select id="commentSel">${options}</select></div><div id="commentText"><p class="empty-state">Loading commentary…</p></div>`;
  $('#commentSel').onchange = e=>{ state.activeCommentary=e.target.value; renderCommentary(body); };
  const ct = $('#commentText');
  try{
    const data = await getJSON(`${API}/c/${state.activeCommentary}/${state.book}/${state.chapter}.json`);
    const verse = (data.chapter.content||[]).find(c=>c.type==='verse' && c.number==state.selectedVerse);
    const cmName = (state.commentaries.find(c=>c.id===state.activeCommentary)||{}).englishName||'';
    if(verse){
      const text=(verse.content||[]).map(c=>typeof c==='string'?c:'').join(' ');
      ct.innerHTML = `<div class="commentary-text">${text.split(/\n+/).map(p=>`<p>${p}</p>`).join('')}</div><p class="commentary-credit">${cmName} · public domain</p>`;
    } else {
      ct.innerHTML = `<p class="empty-state">No commentary on this verse.</p>`;
    }
  }catch(e){
    ct.innerHTML = `<p class="empty-state">Commentary unavailable for this passage.</p>`;
  }
}

// ---- pickers ----
function openPicker(kind){
  const overlay=$('#pickerOverlay'), grid=$('#pickerGrid'), filter=$('#pickerFilter');
  $('#pickerTitle').textContent = kind==='book'?'Select a book':kind==='chapter'?'Select a chapter':'Select a translation';
  filter.value=''; filter.style.display = kind==='chapter'?'none':'block';
  grid.className = 'picker-grid '+(kind==='book'?'books':kind==='translation'?'translations':'');
  const build = (q='')=>{
    grid.innerHTML='';
    if(kind==='book'){
      BOOKS.filter(b=>b[1].toLowerCase().includes(q.toLowerCase())).forEach(([id,name])=>{
        const b=document.createElement('button'); b.className='pick'+(id===state.book?' active':''); b.textContent=name;
        b.onclick=()=>{ state.book=id; state.chapter=1; loadChapter(); closeAll(); };
        grid.appendChild(b);
      });
    } else if(kind==='chapter'){
      const n=(state.booksMeta[state.book]||{}).numberOfChapters||50;
      for(let i=1;i<=n;i++){ const b=document.createElement('button'); b.className='pick'+(i===state.chapter?' active':''); b.textContent=i;
        b.onclick=()=>{ state.chapter=i; loadChapter(); closeAll(); }; grid.appendChild(b); }
    } else {
      state.translations
        .filter(t=> (t.englishName+' '+t.name+' '+t.languageEnglishName).toLowerCase().includes(q.toLowerCase()))
        .forEach(t=>{
          const b=document.createElement('button'); b.className='pick trans'+(t.id===state.translation?' active':'');
          b.innerHTML=`<span>${t.englishName}</span><span class="tlang">${t.languageEnglishName} · ${t.shortName}</span>`;
          b.onclick=()=>{ state.translation=t.id; loadChapter(); closeAll(); };
          grid.appendChild(b);
        });
    }
  };
  build();
  filter.oninput = ()=> build(filter.value);
  show(overlay);
}

// ---- unified search (progressive) ----
const bibleCache = {}; // in-memory per session
async function getCompleteTranslation(tid){
  if(bibleCache[tid]) return bibleCache[tid];
  // try IndexedDB cache first
  if(dbAvailable){
    try{
      const db=await openDB();
      const rec=await new Promise((res,rej)=>{const t=db.transaction(BSTORE,'readonly');const rq=t.objectStore(BSTORE).get(tid);rq.onsuccess=()=>res(rq.result);rq.onerror=()=>rej(rq.error);});
      if(rec && rec.data){ bibleCache[tid]=rec.data; return rec.data; }
    }catch(e){/* fall through to network */}
  }
  const data = await getJSON(`${API}/${tid}/complete.json`);
  bibleCache[tid]=data;
  if(dbAvailable){ try{ const db=await openDB(); const t=db.transaction(BSTORE,'readwrite'); t.objectStore(BSTORE).put({id:tid,data}); }catch(e){/* cache best-effort */} }
  return data;
}
function searchBible(bible, q){
  const ql=q.toLowerCase(); const hits=[];
  for(const book of bible.books){
    const bname=book.commonName||BOOK_NAME[book.id]||book.id;
    for(const wrap of (book.chapters||[])){
      const ch=wrap.chapter||wrap;
      for(const item of (ch.content||[])){
        if(item.type!=='verse') continue;
        const text=(item.content||[]).map(c=>typeof c==='string'?c:'').join(' ').trim();
        if(text.toLowerCase().includes(ql)){
          hits.push({book:book.id,bookName:bname,chapter:ch.number,verse:item.number,text});
          if(hits.length>=200) return hits;
        }
      }
    }
  }
  return hits;
}
let searchSeq = 0;
async function runSearch(){
  const q = $('#searchInput').value.trim();
  if(!q){ return; }
  const seq = ++searchSeq;
  const out = $('#searchResults');
  out.innerHTML='';

  // 1) Local: personal PDFs (instant)
  const pdfHits = await searchLibrary(q);
  if(seq!==searchSeq) return;
  if(pdfHits.length){
    out.appendChild(groupTitle(`Your library (${pdfHits.length})`));
    pdfHits.slice(0,30).forEach(h=>{
      const el=resultItem(h.name+'  ·  p.'+h.page, h.snippet, q);
      out.appendChild(el);
    });
  }

  // 2) Scripture: search the complete translation (downloaded once, cached locally)
  const scrip = groupTitle('Scripture', true);
  out.appendChild(scrip);
  try{
    const bible = await getCompleteTranslation(state.translation);
    if(seq!==searchSeq) return;
    scrip.querySelector('.spin')?.remove();
    const hits = searchBible(bible, q).slice(0,60);
    if(!hits.length){ out.appendChild(emptyNote('No scripture matches.')); }
    hits.forEach(h=>{
      const el=resultItem(`${h.bookName} ${h.chapter}:${h.verse}`, h.text, q);
      el.onclick=()=>{ state.book=h.book; state.chapter=h.chapter; loadChapter(); closeAll(); };
      out.appendChild(el);
    });
  }catch(e){
    if(seq!==searchSeq) return;
    scrip.querySelector('.spin')?.remove();
    out.appendChild(emptyNote('Scripture search is unavailable right now.'));
  }

  if(!out.children.length) out.innerHTML='<p class="empty-state">No results found.</p>';
}

function groupTitle(label, spinning){
  const d=document.createElement('div'); d.className='result-group-title';
  d.innerHTML = label + (spinning?'<span class="spin"></span>':'');
  return d;
}
function emptyNote(t){ const d=document.createElement('p'); d.className='empty-state'; d.textContent=t; return d; }
function resultItem(ref, snippet, q){
  const d=document.createElement('div'); d.className='result-item';
  const re = new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig');
  const safe = (snippet||'').slice(0,240).replace(/</g,'&lt;');
  d.innerHTML=`<div class="result-ref">${ref}</div><div class="result-snippet">${safe.replace(re,'<mark>$1</mark>')}</div>`;
  return d;
}

// ---- library: parse + store + search ----
async function handleFiles(files){
  for(const file of files){
    if(file.type!=='application/pdf'){ toast('Only PDF files are supported in v1.'); continue; }
    const id='f_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
    const rec={id,name:file.name,size:file.size,pages:[],status:'parsing'};
    renderLibItem(rec,0);
    try{
      const buf=await file.arrayBuffer();
      const pdf=await pdfjsLib.getDocument({data:buf}).promise;
      const pages=[];
      for(let i=1;i<=pdf.numPages;i++){
        const page=await pdf.getPage(i);
        const tc=await page.getTextContent();
        const text=tc.items.map(it=>it.str).join(' ').replace(/\s+/g,' ').trim();
        pages.push(text);
        renderLibItem(rec, i/pdf.numPages);
      }
      rec.pages=pages;
      const totalText=pages.join('').trim();
      rec.status = totalText.length<20 ? 'no-text' : 'ready';
      if(dbAvailable){ try{ await dbPut(rec);}catch(e){ dbAvailable=false; toast('Stored for this session only (browser storage blocked).'); } }
      renderLibList();
    }catch(e){
      rec.status='error'; renderLibList(); toast('Could not parse '+file.name);
    }
  }
}

let LIB=[]; // in-memory mirror
async function loadLibrary(){
  try{ LIB=await dbAll(); }catch(e){ dbAvailable=false; LIB=[]; }
  renderLibList();
}
function renderLibList(){
  const list=$('#libList'); list.innerHTML='';
  if(!LIB.length){ list.innerHTML='<p class="empty-state">No files yet. Add a PDF to study it alongside scripture.</p>'; return; }
  LIB.forEach(rec=>{
    const div=document.createElement('div'); div.className='lib-item';
    const meta = rec.status==='no-text' ? `<div class="lib-item-meta warn">No selectable text — not searchable (scanned PDF).</div>`
      : rec.status==='ready' ? `<div class="lib-item-meta">${rec.pages.length} pages · searchable</div>`
      : rec.status==='error' ? `<div class="lib-item-meta warn">Failed to parse.</div>`
      : `<div class="lib-item-meta">Parsing…</div>`;
    div.innerHTML=`<div class="lib-item-info"><div class="lib-item-name">${rec.name.replace(/</g,'&lt;')}</div>${meta}</div><button class="lib-del" aria-label="Remove">✕</button>`;
    div.querySelector('.lib-del').onclick=async()=>{ if(dbAvailable){try{await dbDel(rec.id);}catch(e){}} LIB=LIB.filter(r=>r.id!==rec.id); renderLibList(); };
    list.appendChild(div);
  });
}
function renderLibItem(rec, prog){
  if(!LIB.find(r=>r.id===rec.id)) LIB.push(rec);
  renderLibList();
  const items=$('#libList').querySelectorAll('.lib-item');
  // append a progress bar to the last item if parsing
  if(rec.status==='parsing'){
    const last=items[LIB.findIndex(r=>r.id===rec.id)];
    if(last && !last.querySelector('.lib-progress')){
      const p=document.createElement('div'); p.className='lib-progress'; p.innerHTML='<span></span>'; last.querySelector('.lib-item-info').appendChild(p);
    }
    const bar=items[LIB.findIndex(r=>r.id===rec.id)]?.querySelector('.lib-progress span');
    if(bar) bar.style.width=Math.round(prog*100)+'%';
  }
}
async function searchLibrary(q){
  const ql=q.toLowerCase(); const hits=[];
  for(const rec of LIB){
    if(rec.status!=='ready') continue;
    rec.pages.forEach((text,idx)=>{
      const i=text.toLowerCase().indexOf(ql);
      if(i>=0){
        const start=Math.max(0,i-60);
        hits.push({name:rec.name, page:idx+1, snippet:'…'+text.slice(start,i+q.length+90)+'…'});
      }
    });
  }
  return hits;
}

// ---- overlay plumbing ----
function show(el){ el.hidden=false; }
function closeAll(){ document.querySelectorAll('.overlay').forEach(o=>o.hidden=true); }

function wireUI(){
  $('#bookBtn').onclick=()=>openPicker('book');
  $('#chapterBtn').onclick=()=>openPicker('chapter');
  $('#translationBtn').onclick=()=>openPicker('translation');
  $('#prevChap').onclick=()=>{ if(state.chapter>1){state.chapter--;} else { const i=bookIndex(); if(i>0){state.book=BOOKS[i-1][0]; state.chapter=99;} } loadChapter(); };
  $('#nextChap').onclick=()=>{ const n=(state.booksMeta[state.book]||{}).numberOfChapters||50; if(state.chapter<n){state.chapter++;} else { const i=bookIndex(); if(i<BOOKS.length-1){state.book=BOOKS[i+1][0]; state.chapter=1;} } loadChapter(); };

  document.querySelectorAll('.ctab').forEach(t=> t.onclick=()=>{ document.querySelectorAll('.ctab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); renderContext(); });

  $('#searchToggle').onclick=()=>{ show($('#searchOverlay')); setTimeout(()=>$('#searchInput').focus(),50); };
  $('#searchGo').onclick=runSearch;
  $('#searchInput').addEventListener('keydown',e=>{ if(e.key==='Enter') runSearch(); });

  $('#libraryToggle').onclick=()=>{ show($('#libraryOverlay')); loadLibrary(); };
  $('#fileInput').onchange=e=> handleFiles([...e.target.files]);

  $('#themeToggle').onclick=()=>{ const d=document.documentElement; d.dataset.theme = d.dataset.theme==='dark'?'light':'dark'; };

  document.querySelectorAll('[data-close]').forEach(b=> b.onclick=closeAll);
  document.querySelectorAll('.overlay').forEach(o=> o.addEventListener('click',e=>{ if(e.target===o) closeAll(); }));
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeAll(); });
}

init();
