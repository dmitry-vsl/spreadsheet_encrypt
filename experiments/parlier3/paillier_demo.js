import * as paillierBigint from 'paillier-bigint';
import { spawn } from 'child_process';

const { publicKey, privateKey } = await paillierBigint.generateRandomKeys(512, true);

const a = 42n;
const b = 58n;

const encA = publicKey.encrypt(a);
const encB = publicKey.encrypt(b);

console.log(`Plaintext a = ${a}, b = ${b}`);
console.log(`Expected sum = ${a + b}`);

const python = spawn('python3', [
  'sum_encrypted.py',
  publicKey.n.toString(),
  encA.toString(),
  encB.toString(),
], { cwd: import.meta.dirname });

let stdout = '';
let stderr = '';
python.stdout.on('data', (data) => { stdout += data; });
python.stderr.on('data', (data) => { stderr += data; });

python.on('close', (code) => {
  if (code !== 0) {
    console.error('Python process failed:', stderr);
    process.exit(1);
  }

  const encSum = BigInt(stdout.trim());
  const decryptedSum = privateKey.decrypt(encSum);

  console.log(`Decrypted sum = ${decryptedSum}`);
  console.log(`Match: ${decryptedSum === a + b}`);
});
