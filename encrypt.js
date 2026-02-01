import * as paillierBigint from 'paillier-bigint';

export const { publicKey, privateKey } = await paillierBigint.generateRandomKeys(512, true);

export function encrypt(x) {
  return publicKey.encrypt(x).toString()
}
