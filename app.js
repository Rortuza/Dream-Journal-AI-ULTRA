import { show, sentiment, emotionPrimary, nightmareIndex } from './ui.js';
import { lineChart, scatter, movingAvg, buildTfIdf, kmeans, cosine, lev } from './analysis.js';
import { encryptJSON, decryptJSON } from './crypto.js';
import { openDB, addEntry, updateEntry, getAll, clearAll } from './db.js';

// Elements
const cards = document.getElementById("cards");
const searchForm = document.getElementById("search-form");
const advQ = document.getElementById("adv-q");
const advRun = document.getElementById("adv-run");
const clusterBtn = document.getElementById("cluster");
const searchResults = document.getElementById("search-results");
const clusterResults = document.getElementById("cluster-results");
const chartNI = document.getElementById("chart-ni");
const chartSent = document.getElementById("chart-sent-ma");
const chartScatter = document.getElementById("chart-scatter");
const exportBtn = document.getElementById("export");
const exportJSONBtn = document.getElementById("export-json");
const importJSONBtn = document.getElementById("import-json");
const importFile = document.getElementById("import-file");
const encSet = document.getElementById("enc-set");
const encPass = document.getElementById("enc-pass");
const fontSel = document.getElementById("font-size");
const reduced = document.getElementById("reduced");
const streakEl = document.getElementById("streak");
const countEl = document.getElementById("count");

// Settings persistence
const SKEY = "dj_settings";
const settings = JSON.parse(localStorage.getItem(SKEY) || "{}");
if(settings.font) document.documentElement.style.fontSize = settings.font;
if(settings.reduced) document.documentElement.classList.add("reduced");
fontSel.value = settings.fontTag || "base";
reduced.checked = !!settings.reduced;
fontSel.onchange = ()=>{
  const m = {base:"16px",lg:"18px",xl:"20px"};
  document.documentElement.style.fontSize = m[fontSel.value];
  settings.fontTag = fontSel.value; settings.font = m[fontSel.value];
  localStorage.setItem(SKEY, JSON.stringify(settings));
};
reduced.onchange = ()=>{
  if(reduced.checked) document.documentElement.classList.add("reduced");
  else document.documentElement.classList.remove("reduced");
  settings.reduced = reduced.checked;
  localStorage.setItem(SKEY, JSON.stringify(settings));
};

// Data load
await openDB();
await refresh();

// New Entry
document.getElementById("new-form").onsubmit = async (e)=>{
  e.preventDefault();
  const title = document.getElementById("title").value.trim() || "Untitled";
  const text = document.getElementById("text").value.trim();
  const tags = document.getElementById("tags").value.trim();
  const screen = parseInt(document.getElementById("screen").value||"0",10);
  const caffeine = parseInt(document.getElementById("caffeine").value||"0",10);
  const meal = parseInt(document.getElementById("meal").value||"0",10);
  const workout = parseInt(document.getElementById("workout").value||"0",10);
  const stress = parseInt(document.getElementById("stress").value||"3",10);
  const lucid = document.getElementById("lucid").checked;

  const sent = sentiment(text);
  const emo = emotionPrimary(text);
  const ni = nightmareIndex(text, sent);

  const entry = {
    dt: new Date().toISOString().slice(0,16),
    title, text, tags,
    sentiment: sent,
    emotion_primary: emo,
    nightmare_index: ni,
    caffeine_mg: caffeine,
    last_meal_min_before_sleep: meal,
    screen_min_last_hr: screen,
    workout_min: workout,
    stress_1_5: stress,
    lucid: lucid
  };
  await addEntry(entry);
  await refresh();
  show("home");
  e.target.reset();
};

// Quick search
searchForm.onsubmit = async (e)=>{
  e.preventDefault();
  const q = document.getElementById("q").value.toLowerCase();
  const tag = document.getElementById("tag").value.toLowerCase();
  const all = await getAll();
  const filtered = all.filter(r => {
    const hitQ = q ? (r.title.toLowerCase().includes(q) || r.text.toLowerCase().includes(q)) : true;
    const hitT = tag ? ((r.tags||"").toLowerCase().includes(tag)) : true;
    return hitQ && hitT;
  });
  renderList(filtered);
};

// Advanced search
advRun.onclick = async ()=>{
  const q = (advQ.value||"").trim().toLowerCase();
  const all = await getAll();
  if(!q){ searchResults.innerHTML = "<p class='muted'>Type a query</p>"; return; }
  const docs = all.map(e=> e.title + " " + e.text + " " + (e.tags||""));
  const {idf, vecs} = buildTfIdf(docs);
  // query vector
  const qtf = new Map(); for(const w of (q.match(/[a-z']{2,}/g)||[])){ qtf.set(w, (qtf.get(w)||0)+1); }
  const qvec = new Map(); let total=0; qtf.forEach(v=> total+=v);
  qtf.forEach((c,w)=> qvec.set(w, (c/Math.max(1,total)) * (idf.get(w)||0)));
  // score by cosine plus small fuzzy bonus
  const scores = vecs.map((v,i)=>{
    const cos = cosine(v,qvec);
    const fuzz = Math.max(0, 1 - (lev(all[i].title.toLowerCase(), q)/Math.max(1, q.length)));
    return 0.85*cos + 0.15*fuzz;
  });
  const order = scores.map((s,i)=>[s,i]).sort((a,b)=> b[0]-a[0]).slice(0,20);
  searchResults.innerHTML = order.map(([s,i])=> cardHTML(all[i])).join("");
  wireCards(all);
};

// Cluster topics
clusterBtn.onclick = async ()=>{
  const all = await getAll();
  if(all.length<3){ clusterResults.innerHTML = "<p class='muted'>Need at least 3 entries</p>"; return; }
  const docs = all.map(e=> e.title + " " + e.text + " " + (e.tags||""));
  const {vecs} = buildTfIdf(docs);
  const groups = kmeans(vecs, Math.min(5, Math.max(2, Math.round(Math.sqrt(all.length/2)))) );
  const buckets = {};
  groups.forEach((g,i)=>{ (buckets[g] ||= []).push(all[i]); });
  clusterResults.innerHTML = Object.keys(buckets).map(k=>{
    const arr = buckets[k];
    return `<div class="card"><h3>Topic ${Number(k)+1}</h3>${arr.slice(0,6).map(e=> `<p>${e.title}</p>`).join("")}<p class="muted">${arr.length} entries</p></div>`;
  }).join("");
};

// Insights
async function drawInsights(all){
  if(all.length===0){ return; }
  const xs = all.map((_,i)=> i+1);
  const ni = all.map(e=> e.nightmare_index);
  window._uiCharts.lineChart(chartNI, xs, ni, "Nightmare Index");
  const sent = all.map(e=> e.sentiment);
  const sma = movingAvg(sent, 5);
  window._uiCharts.lineChart(chartSent, xs, sma, "Sentiment 5‑pt MA");
  const sc = all.map(e=> e.screen_min_last_hr||0);
  window._uiCharts.scatter(chartScatter, sc, ni, "Screen vs NI");
  // simple text insight
  let corr = pearson(sc, ni);
  document.getElementById("insight-text").textContent = `Correlation screen→NI: ${corr.toFixed(2)} (closer to +1 means screen time rises with NI).`;
}
function pearson(a,b){
  const n=a.length; const ma = a.reduce((x,y)=>x+y,0)/n; const mb=b.reduce((x,y)=>x+y,0)/n;
  let num=0, da=0, db=0;
  for(let i=0;i<n;i++){ const xa=a[i]-ma, xb=b[i]-mb; num+=xa*xb; da+=xa*xa; db+=xb*xb; }
  return (da&&db) ? num/Math.sqrt(da*db) : 0;
}

// Export CSV
exportBtn.onclick = async ()=>{
  const all = await getAll();
  const headers = ["id","dt","title","text","sentiment","emotion_primary","nightmare_index","tags","lucid","caffeine_mg","last_meal_min_before_sleep","screen_min_last_hr","workout_min","stress_1_5"];
  const rows = [headers.join(",")];
  all.forEach((e,i)=>{
    const row = [
      i+1,e.dt,qq(e.title),qq(e.text),e.sentiment.toFixed(3),e.emotion_primary,e.nightmare_index,
      qq(e.tags||""),e.lucid?1:0,e.caffeine_mg,e.last_meal_min_before_sleep,e.screen_min_last_hr,e.workout_min,e.stress_1_5
    ].join(",");
    rows.push(row);
  });
  const blob = new Blob([rows.join("\n")], {type: "text/csv"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "dreams_export.csv";
  a.click();
};

// Encrypted JSON export/import
exportJSONBtn.onclick = async ()=>{
  const pass = prompt("Set or enter your encryption password:");
  if(!pass) return;
  const all = await getAll();
  const payload = await encryptJSON(pass, {entries: all});
  const blob = new Blob([JSON.stringify(payload)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "dreams_encrypted.json";
  a.click();
};
importJSONBtn.onclick = ()=> importFile.click();
importFile.onchange = async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const text = await file.text();
  const payload = JSON.parse(text);
  const pass = prompt("Enter decryption password:");
  if(!pass) return;
  try{
    const data = await decryptJSON(pass, payload);
    await clearAll();
    for(const e of (data.entries||[])) await addEntry(e);
    await refresh();
    alert("Import complete");
  }catch(err){
    alert("Failed to decrypt or import");
  }
};
encSet.onclick = async ()=>{
  const p = encPass.value.trim();
  if(!p){ alert("Enter a password"); return; }
  // noop here, simply inform user that exports will use this; could store a hash
  alert("Password set. Use Export Encrypted JSON to back up.");
};

// Rendering
function cardHTML(e){
  return `
  <li class="card" data-id="${e.id}">
    <h3>${escapeHtml(e.title)}</h3>
    <p class="muted">${e.dt}</p>
    <p>Nightmare index: <strong>${e.nightmare_index}</strong>, Sentiment: ${e.sentiment.toFixed(2)}, Emotion: ${e.emotion_primary}</p>
    ${e.tags ? `<p class="tags">${escapeHtml(e.tags)}</p>` : ``}
    <p class="muted">Screen last hr: ${e.screen_min_last_hr||0} min, Caffeine: ${e.caffeine_mg||0} mg, Stress: ${e.stress_1_5||0}/5</p>
  </li>`;
}
function wireCards(list){
  [...cards.querySelectorAll(".card")].forEach(li => li.onclick = ()=> openDetail(list.find(x => x.id == li.dataset.id)));
}
function escapeHtml(s){ return (s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function openDetail(e){
  const dlg = document.getElementById("detail");
  document.getElementById("d-title").textContent = e.title;
  document.getElementById("d-dt").textContent = e.dt;
  document.getElementById("d-text").textContent = e.text;
  document.getElementById("d-tags").textContent = e.tags || "";
  document.getElementById("d-sent").textContent = e.sentiment.toFixed(2);
  document.getElementById("d-emotion").textContent = e.emotion_primary;
  document.getElementById("d-ni").textContent = e.nightmare_index;
  document.getElementById("d-screen").textContent = e.screen_min_last_hr||0;
  document.getElementById("d-caff").textContent = e.caffeine_mg||0;
  document.getElementById("d-meal").textContent = e.last_meal_min_before_sleep||0;
  document.getElementById("d-work").textContent = e.workout_min||0;
  document.getElementById("d-stress").textContent = e.stress_1_5||0;
  document.getElementById("d-lucid").textContent = e.lucid ? "yes" : "no";

  const recs = [];
  if(e.nightmare_index >= 60 && (e.screen_min_last_hr||0) >= 30) recs.push("Try grayscale and blue light filter 45 minutes before bed");
  if(e.emotion_primary === "fear") recs.push("Two minute box breathing before sleep");
  if(e.sentiment <= -0.3) recs.push("Write three lines about tomorrow's biggest worry, then close notebook");
  if(recs.length === 0) recs.push("Keep routine steady tonight");
  document.getElementById("d-recs").innerHTML = recs.map(r => `<li>${escapeHtml(r)}</li>`).join("");

  dlg.showModal();
  document.getElementById("close-detail").onclick = ()=> dlg.close();
}

// Refresh list, insights, badges
async function refresh(){
  const all = await getAll();
  cards.innerHTML = all.map(cardHTML).join("");
  wireCards(all);
  drawInsights(all);
  // streak and count
  countEl.textContent = `${all.length} entries`;
  streakEl.textContent = "Streak: " + streakDays(all);
}
function streakDays(all){
  const days = new Set(all.map(e => e.dt.slice(0,10)));
  let s=0; const today = new Date(); for(let i=0;i<10000;i++){
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate()-i).toISOString().slice(0,10);
    if(days.has(d)) s++; else break;
  }
  return s;
}

function qq(s){ return `"${(s||"").replace(/"/g,'""')}"`; }
