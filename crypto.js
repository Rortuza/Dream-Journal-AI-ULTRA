// Simple E2E encryption via WebCrypto AES-GCM
const ENC = {
  algo: { name: "AES-GCM", length: 256 },
  ivlen: 12,
  saltlen: 16
};

async function deriveKey(pass, salt){
  const enc = new TextEncoder();
  const keyMat = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    keyMat, ENC.algo, false, ["encrypt","decrypt"]
  );
}

async function encryptJSON(pass, obj){
  const salt = crypto.getRandomValues(new Uint8Array(ENC.saltlen));
  const iv = crypto.getRandomValues(new Uint8Array(ENC.ivlen));
  const key = await deriveKey(pass, salt);
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM", iv}, key, data));
  return { v:1, salt: btoa(String.fromCharCode(...salt)), iv: btoa(String.fromCharCode(...iv)), ct: btoa(String.fromCharCode(...ct)) };
}

async function decryptJSON(pass, payload){
  const salt = new Uint8Array(atob(payload.salt).split("").map(c=>c.charCodeAt(0)));
  const iv = new Uint8Array(atob(payload.iv).split("").map(c=>c.charCodeAt(0)));
  const ct = new Uint8Array(atob(payload.ct).split("").map(c=>c.charCodeAt(0)));
  const key = await deriveKey(pass, salt);
  const pt = await crypto.subtle.decrypt({name:"AES-GCM", iv}, key, ct);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(pt)));
}
