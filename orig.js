// Original-language study module (Greek NT + Hebrew OT, Strong's + morphology)
// Data vendored from OpenScriptures (Hebrew WLC, CC-BY 4.0), MorphGNT/SBLGNT,
// and Strong's lexicons (OpenScriptures, CC-BY-SA).

const OT_BOOKS = new Set(['GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER','LAM','EZK','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL']);

let LEXICON = null;
const origCache = {};   // book id -> word data

async function getOrigLexicon(){
  if(LEXICON) return LEXICON;
  LEXICON = await fetch('orig/lexicon.json').then(r=>r.json());
  return LEXICON;
}
async function getOrigBook(book){
  if(origCache[book]) return origCache[book];
  const isOT = OT_BOOKS.has(book);
  const path = isOT ? `orig/heb/${book}.json` : `orig/grk/${book}.json`;
  const r = await fetch(path);
  if(!r.ok) throw new Error('no data');
  const data = await r.json();
  origCache[book] = data;
  return data;
}
function origAvailable(book){
  // NT books have Greek; the 39 OT books have Hebrew. A few (e.g. deuterocanon) won't.
  return true; // both testaments covered; loader handles 404 gracefully
}

// ---- morphology decoding ----
const GK_POS = {noun:'noun',verb:'verb',adj:'adjective',article:'article',conj:'conjunction',prep:'preposition',pron:'pronoun','dem.pron':'demonstrative pronoun','rel.pron':'relative pronoun','int.pron':'interrogative pronoun',adverb:'adverb',particle:'particle',interj:'interjection'};
// Greek parse code (MorphGNT 'parse' field): positions vary; we decode common verbal/nominal tags
const GK = {
  tense:{P:'present',I:'imperfect',F:'future',A:'aorist',X:'perfect',Y:'pluperfect'},
  voice:{A:'active',M:'middle',P:'passive'},
  mood:{I:'indicative',D:'imperative',S:'subjunctive',O:'optative',N:'infinitive',P:'participle'},
  person:{'1':'1st','2':'2nd','3':'3rd'},
  case:{N:'nominative',G:'genitive',D:'dative',A:'accusative',V:'vocative'},
  number:{S:'singular',P:'plural'},
  gender:{M:'masculine',F:'feminine',N:'neuter'}
};
function decodeGreekParse(code){
  // code like "----NSF-" or "3AAI-S--"; 8 chars: person,tense,voice,mood,case,number,gender,degree
  if(!code) return '';
  const c=code.padEnd(8,'-');
  const out=[];
  if(c[0]!=='-') out.push(GK.person[c[0]]);
  if(c[1]!=='-') out.push(GK.tense[c[1]]);
  if(c[2]!=='-') out.push(GK.voice[c[2]]);
  if(c[3]!=='-') out.push(GK.mood[c[3]]);
  if(c[4]!=='-') out.push(GK.case[c[4]]);
  if(c[5]!=='-') out.push(GK.number[c[5]]);
  if(c[6]!=='-') out.push(GK.gender[c[6]]);
  return out.filter(Boolean).join(' · ');
}
// Hebrew (OSHB) morph code, e.g. "C/Vqw3ms" or "R" or "Ncmpc"
const HB = {
  pos:{H:'ה_',A:'adjective',C:'conjunction',D:'adverb',N:'noun',P:'pronoun',R:'preposition',S:'suffix',T:'particle',V:'verb'},
  stem:{q:'qal',N:'niphal',p:'piel',P:'pual',h:'hiphil',H:'hophal',t:'hithpael'},
  vtype:{p:'perfect',i:'imperfect',w:'wayyiqtol',h:'cohortative',j:'jussive',v:'imperative',r:'participle(act)',s:'participle(pass)',a:'infinitive(abs)',c:'infinitive(cstr)'},
  person:{'1':'1st','2':'2nd','3':'3rd'},
  gender:{m:'masc',f:'fem',b:'both',c:'common'},
  number:{s:'sing',p:'plur',d:'dual'},
  state:{a:'absolute',c:'construct',d:'determined'}
};
function decodeHebrewMorph(code){
  if(!code) return '';
  // strip language prefix already removed; segments separated by /
  const segs = code.split('/');
  const parts=[];
  for(const seg of segs){
    if(!seg) continue;
    const pos=HB.pos[seg[0]]||seg[0];
    if(seg[0]==='V'){ // verb: V + stem + type + person + gender + number
      const stem=HB.stem[seg[1]]||seg[1];
      const vt=HB.vtype[seg[2]]||seg[2];
      const extra=[];
      if(seg[3]) extra.push(HB.person[seg[3]]||'');
      if(seg[4]) extra.push(HB.gender[seg[4]]||'');
      if(seg[5]) extra.push(HB.number[seg[5]]||'');
      parts.push(`verb ${stem} ${vt} ${extra.filter(Boolean).join(' ')}`.trim());
    } else if(seg[0]==='N'){ // noun: N + type + gender + number + state
      const g=HB.gender[seg[2]]||''; const n=HB.number[seg[3]]||''; const st=HB.state[seg[4]]||'';
      parts.push(`noun ${g} ${n} ${st}`.trim());
    } else {
      parts.push(pos);
    }
  }
  return parts.filter(Boolean).join(' · ');
}

// ---- render the original-language list for the selected verse ----
async function renderOriginal(body, ctx){
  const {book, chapter, verse:selectedVerse, bookName} = ctx;
  const isOT = OT_BOOKS.has(book);
  body.innerHTML = `<p class="ctx-ref">${bookName} ${chapter}:${selectedVerse} · ${isOT?'Hebrew':'Greek'}</p><div id="origWords"><p class="empty-state">Loading original text…</p></div><div id="wordDetail"></div>`;
  const wrap = body.querySelector('#origWords');
  try{
    const [data, lex] = await Promise.all([getOrigBook(book), getOrigLexicon()]);
    const vs = data?.[chapter]?.[selectedVerse];
    if(!vs || !vs.length){ wrap.innerHTML='<p class="empty-state">No original-language data for this verse.</p>'; return; }
    const dir = isOT ? 'rtl' : 'ltr';
    wrap.innerHTML = `<div class="orig-text ${dir}" dir="${dir}">` +
      vs.map((w,i)=>`<span class="orig-word" data-i="${i}">${(w.w||'').replace(/</g,'&lt;')}</span>`).join(' ') +
      `</div>`;
    wrap.querySelectorAll('.orig-word').forEach(el=>{
      el.onclick=()=>{
        wrap.querySelectorAll('.orig-word').forEach(x=>x.classList.remove('sel'));
        el.classList.add('sel');
        showWordDetail(vs[+el.dataset.i], lex, isOT, body);
      };
    });
  }catch(e){
    wrap.innerHTML='<p class="empty-state">Original-language data unavailable for this book.</p>';
  }
}

function showWordDetail(w, lex, isOT, body){
  const det = body.querySelector('#wordDetail');
  const entry = w.s ? lex[w.s] : null;
  const morph = isOT ? decodeHebrewMorph(w.m) : decodeGreekParse(w.m);
  let html = `<div class="word-card">`;
  html += `<div class="word-orig ${isOT?'rtl':'ltr'}" dir="${isOT?'rtl':'ltr'}">${(w.w||'').replace(/</g,'&lt;')}</div>`;
  if(w.l && !isOT) html += `<div class="word-lemma">lemma: ${w.l}</div>`;
  if(entry){
    if(entry.translit) html += `<div class="word-translit">${entry.translit}</div>`;
    html += `<div class="word-strong">${w.s}</div>`;
    if(entry.def) html += `<div class="word-def">${entry.def}</div>`;
    if(entry.kjv) html += `<div class="word-kjv"><span>KJV renderings:</span> ${entry.kjv}</div>`;
  } else if(w.s){
    html += `<div class="word-strong">${w.s}</div>`;
  } else {
    html += `<div class="word-def" style="color:var(--ink-faint)">No Strong's entry (often a prefix or particle).</div>`;
  }
  if(morph) html += `<div class="word-morph"><span>Parsing:</span> ${morph}</div>`;
  html += `</div>`;
  det.innerHTML = html;
}

window.OrigLang = { renderOriginal, origAvailable, OT_BOOKS };
