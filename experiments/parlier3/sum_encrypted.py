import sys
n = int(sys.argv[1])
c1 = int(sys.argv[2])
c2 = int(sys.argv[3])

keys = {
    "public_key": {
        "n": n,
        "g": n + 1,
    }
}

from lightphe import LightPHE
cs = LightPHE(algorithm_name="Paillier", keys=keys)
first = int(sys.argv[2])
second = int(sys.argv[3])

a = cs.create_ciphertext_obj(first)
b = cs.create_ciphertext_obj(second)
c = a + b
print(c.value)
