import { sentiment, emotionPrimary, nightmareIndex, buildTfIdf, cosine, lev, kmeans, lineChart, scatter, movingAvg } from './analysis.js';

// Theme
const THEME_KEY = "dj_theme";
function setTheme(t){ document.documentElement.setAttribute("data-theme", t); localStorage.setItem(THEME_KEY, t); }
function inferTheme(){ const prefers = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches; if(prefers) return "night"; const h=new Date().getHours(); return (h>=7 && h<=18) ? "day":"night"; }
function applyTheme(){ setTheme(localStorage.getItem(THEME_KEY) || inferTheme()); }
applyTheme();
document.getElementById("theme-toggle").onclick = ()=>{ const cur=document.documentElement.getAttribute("data-theme")||"day"; setTheme(cur==="night"?"day":"night"); };

// Quotes daily
const QUOTES = [
  "Small steps every day add up.","You do not have to be perfect to begin.","You have survived 100 percent of your worst days.","Progress, not perfection.",
  "One more rep, one more page, one more try.","Your future self is watching; make him proud.","Discipline is choosing what you want most over what you want now.",
  "Little by little becomes a lot.","Rest is productive when it keeps you consistent.","Win the morning, win the day.","The obstacle is the way.",
  "You are allowed to take up space.","Energy flows where attention goes.","Be where your feet are.","You do not need more time, you need more focus.",
  "Done is better than perfect.","Shrink the task, grow the action.","You are not behind; you are on your path.","Mood follows movement.",
  "One kind sentence to yourself changes the day.","Stack tiny wins.","You become what you repeat.","Start messy.","Hard today, easy tomorrow.",
  "Failure is data, not identity.","Breathe in patience, breathe out doubt.","Choose your hard.","Your pace is the right pace.","Consistency beats intensity.",
  "Show up for five minutes.","Momentum loves clarity.","Train your attention like a muscle.","Keep promises to yourself.","Less noise, more signal.",
  "Reps over rants.","You can restart as many times as needed.","Courage first, confidence later.","What you practice you become.","Protect your first hour.",
  "Strength is built on quiet choices.","Light is born at the edge of effort.","One degree better still boils water.","The day bends to your morning.",
  "Make it simple to start.","Gratitude is fuel, not a chore.","You do not need permission to be new.","Effort compounds like interest.",
  "Worry is imagination without action, act.","Tiny habits, giant results.","Process over outcome.","Sweat the system, not the goal.",
  "Let your actions answer your doubts.","The next right thing is enough.","No zero days.","Direction beats speed.",
  "Be kind to past you, work for future you.","Sharp body, soft heart, steady mind.","Today’s choices become tomorrow’s baseline.",
  "Water the plant daily.","Confidence is evidence collected over time.","It will not be easy, it will be worth it.","Your standard is your ceiling.",
  "Make hard things normal.","Simplicity scales, drama fails.","Do not negotiate with yourself in the morning.","Focus is a kindness to your brain.",
  "You are one decision away from a different day.","Brighten your inner voice.","Preparation is a love language to yourself.",
  "Win the setup, not the willpower.","Keep your world small, keep your work big.","The body keeps the promise the mind makes.",
  "Practice like a scientist, not a judge.","Routine is freedom in disguise.","Slow is smooth, smooth is fast.","What if it goes right",
  "Write the story you needed yesterday.","You have more in you than you think.","Soothe first, solve second.","Clarity creates courage.",
  "Let the reps carry you.","Doubt screams, progress whispers; listen for whispers.","Breathe, then begin.","Everything is figureoutable.",
  "Hard times make strong rhythms.","Be the thermostat, not the thermometer.","You move different when you believe.",
  "If it is not on the calendar, it is not real.","Start where your feet are warmest.","Ten deep breaths change chemistry.","Get curious, not furious.",
  "Your edge today is enough.","Make your bed, then your day.","Less scrolling, more strolling.","Protect your sleep like a secret weapon.",
  "You can do hard things kindly.","Let go, then go.","The light you want is inside the work.","Keep going until it feels weird to stop.",
  "You only need one brave minute.","Build a life that makes discipline easy.","Become the person your goals require.","Finish today a little prouder than you started.",
  "Show up for you, even quietly.","When in doubt, simplify the next step.","Strength grows in the pause between attempts.","Your kindness counts as progress.",
  "You are allowed to try again today.","Motion beats rumination.","Your effort today is training tomorrow’s ease.","Treat focus like a gift to yourself."
];
const QIDX="dj_q_idx", QTS="dj_q_ts";
function setQuote(i){ const el=document.getElementById("quote"); if(!el) return; const idx=((i%QUOTES.length)+QUOTES.length)%QUOTES.length; el.textContent=QUOTES[idx]; localStorage.setItem(QIDX,String(idx)); localStorage.setItem(QTS,String(Date.now())); }
function showQuote(){ const last=Number(localStorage.getItem(QTS)||0), idx=Number(localStorage.getItem(QIDX)||0); const day=24*60*60*1000; if(Date.now()-last>day) setQuote(idx+1); else setQuote(idx); }
document.addEventListener("DOMContentLoaded", showQuote);

// Voice to text (best effort)
const micBtn = document.getElementById("mic"), micStatus = document.getElementById("mic-status");
if(micBtn && "webkitSpeechRecognition" in window){
  const SR = new webkitSpeechRecognition(); SR.lang="en-US"; SR.interimResults=true;
  micBtn.onclick = ()=>{ SR.start(); micStatus.textContent="Listening..."; };
  SR.onresult = e =>{
    let s=""; for(let i=e.resultIndex;i<e.results.length;i++) s+= e.results[i][0].transcript + " ";
    document.getElementById("text").value += " " + s;
  };
  SR.onend = ()=> micStatus.textContent="Stopped";
}else if(micBtn){ micBtn.disabled=true; micStatus.textContent="Voice not supported in this browser"; }

// Templates
const tpl = {
  story: "I was in [place] with [people]. The first thing I remember is [event]. Then [conflict]. I felt [emotion]. It ended when [ending].",
  feelings: "Before sleep I felt [emotion] because [reason]. In the dream I felt [emotion2] when [moment]. I woke up feeling [after].",
  symbols: "Symbols I noticed: [symbol1], [symbol2]. Places: [place1], [place2]. These remind me of [memory].",
  lucid: "I realized I was dreaming when [clue]. I tried to [action]. What worked, what did not, what I would try next time."
};
document.querySelectorAll("[data-tpl]").forEach(b => b.onclick = ()=>{
  const k = b.getAttribute("data-tpl");
  document.getElementById("text").value += "\n\n" + (tpl[k] || "");
});

// Simple router wiring (elements are in index.html)
const view = id => document.getElementById(id);
const V = {
  landing: view("view-landing"),
  home: view("view-home"),
  new: view("view-new"),
  search: view("view-search"),
  insights: view("view-insights"),
  settings: view("view-settings"),
  about: view("view-about")
};
function show(which){
  Object.values(V).forEach(e => e.classList.add("hidden"));
  V[which].classList.remove("hidden");
  location.hash = "#/"+which;
}
function route(){ const h = location.hash.replace(/^#\//,""); if(V[h]) show(h); else show("landing"); }
window.addEventListener("hashchange", route);
route();
document.getElementById("title-link").onclick = ()=> show("landing");
document.getElementById("tab-landing").onclick = ()=> show("landing");
document.getElementById("tab-home").onclick = ()=> show("home");
document.getElementById("tab-new").onclick = ()=> show("new");
document.getElementById("tab-search").onclick = ()=> show("search");
document.getElementById("tab-insights").onclick = ()=> show("insights");
document.getElementById("tab-settings").onclick = ()=> show("settings");
document.getElementById("tab-about").onclick = ()=> show("about");
document.getElementById("cta-new").onclick = ()=> show("new");
document.getElementById("cta-entries").onclick = ()=> show("home");

// Charts helpers exposed
window._uiCharts = { lineChart, scatter, movingAvg };

export { show, sentiment, emotionPrimary, nightmareIndex };
