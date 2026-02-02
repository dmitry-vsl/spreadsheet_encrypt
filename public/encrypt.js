import * as paillierBigint from 'paillier-bigint';

export const { publicKey, privateKey } = await paillierBigint.generateRandomKeys(512, true);

console.log({publicKey, privateKey})

export function encrypt(x) {
  if (typeof x === 'number') {
    if (!Number.isInteger(x)) {
      throw new Error(`encrypt() requires an integer or bigint, got non-integer number: ${x}`);
    }
    x = BigInt(x);
  } else if (typeof x !== 'bigint') {
    throw new TypeError(`encrypt() requires a number (integer) or bigint, got ${typeof x}`);
  }
  const result = publicKey.encrypt(x)
  console.log('ecrypt', {plain: x, result})
  return result
}

export function decrypt(x) {
  const result = privateKey.decrypt(x)
  console.log('decrypt', {cipher: x, result})
  return result
}
