// Heuristics, TF-IDF, fuzzy, clustering, charts

// sentiment/emotion similar to previous, extended lexicon
const BOOST = {"not":-0.5,"never":-0.5,"no":-0.2};
const POS = ["happy","laugh","love","kiss","win","sunny","peace","safe","calm","joy","excited","proud","gentle","warm"];
const NEG = ["fear","afraid","scared","chase","monster","die","doom","panic","scream","nightmare","angry","rage","yell","fight","furious","mad","cry","alone","loss","breakup","funeral","grief","tears","anxious","worry","stress"];
const EMO = {
  fear: ["fear","afraid","scared","chase","monster","die","doom","panic","scream","nightmare"],
  anger: ["angry","rage","yell","fight","furious","mad"],
  sad:   ["cry","alone","loss","breakup","funeral","grief","tears"],
  joy:   ["happy","laugh","love","kiss","win","sunny","peace","safe","calm","joy","excited","proud"]
};

function sentiment(text){
  const t = text.toLowerCase();
  const words = t.match(/[a-z']{2,}/g) || [];
  let score = 0;
  for(const w of words){
    if(POS.includes(w)) score += 1;
    if(NEG.includes(w)) score -= 1;
    if(BOOST[w]) score += BOOST[w];
  }
  return Math.max(-1, Math.min(1, score / Math.max(1, words.length/12)));
}
function emotionPrimary(text){
  const t = text.toLowerCase();
  const counts = Object.fromEntries(Object.keys(EMO).map(k=>[k,0]));
  for(const k in EMO) for(const w of EMO[k]) counts[k] += (t.split(w).length - 1);
  let kBest = "neutral", best = 0;
  for(const k in counts) if(counts[k] > best){ best = counts[k]; kBest = k; }
  return kBest;
}
function nightmareIndex(text, sent){
  const t = text;
  const fearHits = EMO.fear.reduce((acc,w)=>acc+(t.toLowerCase().split(w).length-1),0);
  const exclam = (t.match(/!/g)||[]).length;
  const caps = (t.match(/[A-Z]/g)||[]).length;
  const length = Math.max(t.length,1);
  const capsRatio = caps/length;
  const neg = Math.max(0, -sent);
  const raw = 40*neg + 10*fearHits + 5*exclam + 30*capsRatio;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// tokenize
function tokens(s){ return (s.toLowerCase().match(/[a-z']{2,}/g) || []).filter(w => w.length>2); }

// TF-IDF
function buildTfIdf(docs){
  const df = new Map();
  const tfs = docs.map(text => {
    const t = tokens(text);
    const tf = new Map();
    t.forEach(w => tf.set(w, (tf.get(w)||0) + 1));
    for(const w of new Set(t)) df.set(w, (df.get(w)||0) + 1);
    return tf;
  });
  const N = docs.length;
  const idf = new Map();
  for(const [w,dfv] of df) idf.set(w, Math.log((N+1)/(dfv+1)) + 1);
  const vecs = tfs.map(tf => {
    const v = new Map();
    for(const [w,c] of tf) v.set(w, (c/Math.max(1,sumMap(tf))) * (idf.get(w)||0));
    return v;
  });
  return {idf, vecs};
}
function sumMap(m){ let s=0; for(const v of m.values()) s+=v; return s; }
function cosine(a,b){
  let dot=0, na=0, nb=0;
  const keys = new Set([...a.keys(), ...b.keys()]);
  for(const k of keys){
    const x = a.get(k)||0, y = b.get(k)||0;
    dot += x*y; na += x*x; nb += y*y;
  }
  return (na && nb) ? dot/(Math.sqrt(na)*Math.sqrt(nb)) : 0;
}

// fuzzy search (Levenshtein distance)
function lev(a,b){
  const m=a.length, n=b.length;
  const dp=Array.from({length:m+1},()=>Array(n+1).fill(0));
  for(let i=0;i<=m;i++) dp[i][0]=i;
  for(let j=0;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++){
    for(let j=1;j<=n;j++){
      const cost = a[i-1]===b[j-1] ? 0 : 1;
      dp[i][j]=Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
    }
  }
  return dp[m][n];
}

// k-means clustering on TF-IDF vectors
function kmeans(vecs, k=3, iters=10){
  if(vecs.length===0) return [];
  // convert maps to dense dictionary space
  const vocab = new Map(); let idx=0;
  for(const v of vecs) for(const key of v.keys()) if(!vocab.has(key)) vocab.set(key, idx++);
  const dense = vecs.map(v => {
    const arr = new Float32Array(vocab.size);
    for(const [w,val] of v) arr[vocab.get(w)] = val;
    return arr;
  });
  // init centers randomly
  const centers = Array.from({length:k}, (_,i)=> dense[Math.floor(Math.random()*dense.length)].slice());
  const assign = new Array(dense.length).fill(0);
  function dist(a,b){ let s=0; for(let i=0;i<a.length;i++){ const d=a[i]-b[i]; s+=d*d; } return s; }
  for(let it=0; it<iters; it++){
    // assign
    for(let i=0;i<dense.length;i++){
      let best=0, bestd=Infinity;
      for(let c=0;c<k;c++){ const d=dist(dense[i], centers[c]); if(d<bestd){ bestd=d; best=c; } }
      assign[i]=best;
    }
    // recompute centers
    const sums = Array.from({length:k}, ()=> new Float32Array(vocab.size));
    const counts = Array(k).fill(0);
    for(let i=0;i<dense.length;i++){ const a=assign[i]; const v=dense[i]; counts[a]++; for(let j=0;j<v.length;j++) sums[a][j]+=v[j]; }
    for(let c=0;c<k;c++){ if(counts[c]){ for(let j=0;j<sums[c].length;j++) centers[c][j]=sums[c][j]/counts[c]; } }
  }
  return assign;
}

// charts: minimal canvas helpers
function lineChart(canvas, xs, ys, label){
  const ctx = canvas.getContext("2d");
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad=30;
  function xmap(i){ return pad + (W-2*pad)*i/Math.max(1,(xs.length-1)); }
  function ymap(v){ const t=(v-minY)/Math.max(1e-9,(maxY-minY||1)); return H-pad - (H-2*pad)*t; }
  ctx.strokeStyle = "#8892ff"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(xmap(0), ymap(ys[0])); for(let i=1;i<ys.length;i++) ctx.lineTo(xmap(i), ymap(ys[i])); ctx.stroke();
  ctx.fillStyle = "#555"; ctx.fillText(label, pad, 14);
}
function scatter(canvas, xs, ys, label){
  const ctx = canvas.getContext("2d");
  const W=canvas.width, H=canvas.height, pad=30;
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  function xm(v){ const t=(v-minX)/Math.max(1e-9,(maxX-minX||1)); return pad + (W-2*pad)*t; }
  function ym(v){ const t=(v-minY)/Math.max(1e-9,(maxY-minY||1)); return H-pad - (H-2*pad)*t; }
  const ctx2 = ctx;
  ctx2.clearRect(0,0,W,H);
  ctx2.fillStyle="#8892ff";
  for(let i=0;i<xs.length;i++){ ctx2.beginPath(); ctx2.arc(xm(xs[i]), ym(ys[i]), 3, 0, Math.PI*2); ctx2.fill(); }
  ctx2.fillStyle="#555"; ctx2.fillText(label, pad, 14);
}

// utils
function movingAvg(arr, n=5){
  const out=[];
  for(let i=0;i<arr.length;i++){
    const s = arr.slice(Math.max(0,i-n+1), i+1);
    out.push(s.reduce((a,b)=>a+b,0)/s.length);
  }
  return out;
}

export { sentiment, emotionPrimary, nightmareIndex, buildTfIdf, cosine, lev, kmeans, lineChart, scatter, movingAvg };
