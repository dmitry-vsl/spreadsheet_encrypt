import sys
from phe import paillier

n = int(sys.argv[1])
ct1 = int(sys.argv[2])
ct2 = int(sys.argv[3])

public_key = paillier.PaillierPublicKey(n)

enc1 = paillier.EncryptedNumber(public_key, ct1, 0)
enc2 = paillier.EncryptedNumber(public_key, ct2, 0)

enc_sum = enc1 + enc2

print(enc_sum.ciphertext(be_secure=False))
