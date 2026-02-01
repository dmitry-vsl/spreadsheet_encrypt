I want to use The Paillier cryptosystem. In node.js, i want to use 'paillier-bigint' npm module. In python, I want to use 'phe' module. The modules are already installed, do not install them. Create a node.js script, that
  - generates a public/private key
  - generates two integers and encrypts them
  - spawns a python process and passes two encrypted integers via cli args. In a python process, it imports lightphe and sums encrypted
  integers, and returns the encrypted result as an output.
  - then, in node.js, it gets an encrypted result, decrypts it, and checks that it equals to the sum of the unencrypted (plaintext) integers.
