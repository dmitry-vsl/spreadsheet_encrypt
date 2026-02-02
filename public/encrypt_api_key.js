// Helpers
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64encode(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function b64decode(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveAesKeyFromPassphrase(passphrase, salt, iterations = 210_000) {
  const passphraseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    passphraseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt: returns a JSON string you can store/transmit
export async function encryptString(plaintext, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));  // 128-bit salt
  const iv = crypto.getRandomValues(new Uint8Array(12));    // 96-bit IV for GCM

  const key = await deriveAesKeyFromPassphrase(passphrase, salt);

  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );

  const payload = {
    v: 1,
    alg: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iter: 210000,
    salt: b64encode(salt),
    iv: b64encode(iv),
    ct: b64encode(new Uint8Array(ciphertextBuf)),
  };

  return JSON.stringify(payload);
}

// Decrypt: takes the JSON string produced above
export async function decryptString(encryptedJson, passphrase) {
  const payload = JSON.parse(encryptedJson);

  if (payload.v !== 1 || payload.alg !== "AES-GCM" || payload.kdf !== "PBKDF2-SHA256") {
    throw new Error("Unsupported payload format");
  }

  const salt = b64decode(payload.salt);
  const iv = b64decode(payload.iv);
  const ct = b64decode(payload.ct);

  const key = await deriveAesKeyFromPassphrase(passphrase, salt, payload.iter);

  const plaintextBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ct
  );

  return dec.decode(plaintextBuf);
}

// Example usage:
// (async () => {
//   const secret = await encryptString("hello browser crypto", "correct horse battery staple");
//   console.log("Encrypted:", secret);
// 
//   const back = await decryptString(secret, "correct horse battery staple");
//   console.log("Decrypted:", back);
// })();
