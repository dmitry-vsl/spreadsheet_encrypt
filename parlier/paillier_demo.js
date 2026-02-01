const paillier = require('homomorphicjs');
const bn = require('jsbn');
const crypto = require('crypto');
const { execSync } = require('child_process');
const path = require('path');

// Generate a random BigInteger less than n for use as obfuscator
function randomBN(n) {
    const byteLen = Math.ceil(n.bitLength() / 8);
    let r;
    do {
        const buf = crypto.randomBytes(byteLen);
        r = new bn(buf.toString('hex'), 16);
    } while (r.compareTo(n) >= 0 || r.compareTo(bn.ONE) <= 0);
    return r;
}

const keypair = paillier.generate_paillier_keypair(1024);
const pub = keypair.public_key;
const priv = keypair.private_key;

const a = 42;
const b = 58;

const rA = randomBN(pub.n);
const rB = randomBN(pub.n);

const ctA = pub.raw_encrypt(String(a), rA);
const ctB = pub.raw_encrypt(String(b), rB);

console.log(`Plaintext a = ${a}`);
console.log(`Plaintext b = ${b}`);
console.log(`Expected sum = ${a + b}`);

const n = pub.toJSON().n;
const scriptPath = path.join(__dirname, 'sum_encrypted.py');
const pythonPath = path.join(__dirname, '..', '.venv', 'bin', 'python');

const cmd = `${pythonPath} ${scriptPath} ${n} ${ctA.toString()} ${ctB.toString()}`;
const result = execSync(cmd, { maxBuffer: 10 * 1024 * 1024 }).toString().trim();

const decrypted = priv.raw_decrypt(result);
console.log(`Decrypted sum = ${decrypted.toString()}`);
console.log(`Match: ${decrypted.toString() === String(a + b)}`);
