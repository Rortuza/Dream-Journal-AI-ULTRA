// IndexedDB with schema and migrations
const DB_NAME = "dreams_pro_db";
const DB_VER = 2; // bump to trigger migrations

let db;
function openDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if(e.oldVersion < 1){
        const store = d.createObjectStore("entries", { keyPath: "id", autoIncrement: true });
        store.createIndex("dt", "dt");
      }
      if(e.oldVersion < 2){
        // add a derived field 'words' to support faster search later
        try{ d.transaction("entries","readwrite").objectStore("entries"); }catch{}
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(); };
    req.onerror = e => reject(e);
  });
}

function addEntry(entry){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("entries","readwrite");
    tx.objectStore("entries").add(entry).onsuccess = ()=> resolve();
    tx.onerror = e => reject(e);
  });
}
function updateEntry(entry){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("entries","readwrite");
    tx.objectStore("entries").put(entry).onsuccess = ()=> resolve();
    tx.onerror = e => reject(e);
  });
}
function getAll(){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("entries","readonly");
    const req = tx.objectStore("entries").getAll();
    req.onsuccess = ()=> resolve(req.result.sort((a,b)=> b.dt.localeCompare(a.dt)));
    req.onerror = e => reject(e);
  });
}
function clearAll(){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("entries","readwrite");
    tx.objectStore("entries").clear().onsuccess = ()=> resolve();
    tx.onerror = e => reject(e);
  });
}
