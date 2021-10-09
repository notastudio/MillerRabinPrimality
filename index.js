const BN = require("bn.js");

/**
 * A record class to hold the results of Miller-Rabin testing.
 */
class MillerRabinResult {
  /**
   * Constructs a result object from the given options
   * @param {MillerRabinResultOptions} options
   */
  constructor({n, probablePrime, witness=null} = {}) {
    this.n = n;
    this.probablePrime = probablePrime;
    this.witness = witness;
  }
}

/**
 * Produces a string of random bits with the specified length.
 * Mainly useful as input to BigNumber constructors that take digit strings of arbitrary length.
 * 
 * @param {number} numBits How many random bits to return.
 * @returns {string} A string of `numBits` random bits.
 */
function getRandomBitString(numBits) {
  let bits = "";
  while (bits.length < numBits) {
    bits += Math.random().toString(2).substring(2, 50);
  }
  return bits.substring(0, numBits);
}

/**
 * Runs Miller-Rabin primality tests on `n` using `rounds` different bases, to determine with high probability whether `n` is a prime number.
 * 
 * @param {number|BN} n A non-negative odd integer to be tested for primality.
 * @param {number} numRounds A positive integer specifying the number of bases to test against.
 * @returns {Promise<MillerRabinResult>} An object containing properties
 *   `n` (the input value, as a BigNumber),
 *   `probablePrime` (true if all the primality tests passed, false otherwise),
 *   `witness` (a BigNumber witness for the compositeness of `n`, or null if none was found)
 */
function testPrimality(n, numRounds=2) {
  return new Promise((resolve, reject) => {
    try {
      n = new BN(n);

      // Handle some small special cases
      if (n.ltn(2)) { // n = 0 or 1
        resolve(new MillerRabinResult({ n, probablePrime: false, witness: null }));
        return;
      } else if (n.ltn(4)) { // n = 2 or 3
        resolve(new MillerRabinResult({ n, probablePrime: true, witness: null }));
        return;
      }

      const nBits = n.bitLength();
      const nSub = n.subn(1);

      const r = nSub.zeroBits();                      // Multiplicity of prime factor 2 in the prime factorization of n-1
      const d = nSub.div(new BN("2").pow(new BN(r))); // The result of factoring out all powers of 2 from n-1

      let probablePrime = true;
      let witness = null;

      outer:
      for (let round = 0; round < numRounds; round++) {
        // Select a random base to test
        let base;
        do {
          base = new BN(getRandomBitString(nBits), 2);
        } while (!base.gtn(2) || !base.lt(nSub)); // The base must lie within [2, n-2]

        let x = base.pow(d).mod(n);
        if (x.eqn(1) || x.eq(nSub)) continue; // The test passed: base^d = +/-1 (mod n)

        // Perform the actual Miller-Rabin loop
        let i;
        for (i = 0; i < r; i++) {
          x = x.sqr().mod(n);
          if (x.eqn(1)) {
            probablePrime = false;  // The test failed: base^(d*2^j) = 1 (mod n) and thus cannot be -1 for any j
            witness = base;         // So this base is a witness to the guaranteed compositeness of n
            break outer;
          } else if (x.eq(nSub)) {
            // The test passed: base^(d*2^j) = -1 (mod n) for the current j
            // So n is a strong probable prime to this base (though n may still be composite)
            break;
          }
        }

        if (i === r) {
          probablePrime = false;
          witness = base;
          break;
        }
      }

      resolve(new MillerRabinResult({ n, probablePrime, witness }));

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { testPrimality };
