import * as paillierBigint from 'paillier-bigint';

export const { publicKey, privateKey } = await paillierBigint.generateRandomKeys(512, true);

export function encrypt(x) {
  if (typeof x === 'number') {
    if (!Number.isInteger(x)) {
      throw new Error(`encrypt() requires an integer or bigint, got non-integer number: ${x}`);
    }
    x = BigInt(x);
  } else if (typeof x !== 'bigint') {
    throw new TypeError(`encrypt() requires a number (integer) or bigint, got ${typeof x}`);
  }
  return publicKey.encrypt(x).toString()
}
