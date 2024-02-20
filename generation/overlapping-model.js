"use strict";

/**
 *
 * @param {Uint8Array|Uint8ClampedArray} data The RGBA data of the source image
 * @param {int} dataWidth The width of the source image
 * @param {int} dataHeight The height of the source image
 * @param {int} N Size of the patterns
 * @param {int} width The width of the generation
 * @param {int} height The height of the generation
 * @param {boolean} periodicInput Whether the source image is to be considered as periodic / as a repeatable texture
 * @param {boolean} periodicOutput Whether the generation should be periodic / a repeatable texture
 * @param {int} symmetry Allowed symmetries from 1 (no symmetry) to 8 (all mirrored / rotated variations)
 * @param {int} [ground=0] Id of the specific pattern to use as the bottom of the generation ( see https://github.com/mxgmn/WaveFunctionCollapse/issues/3#issuecomment-250995366 )
 *
 * @constructor
 */
const OverlappingModel = function OverlappingModel (data, dataWidth, dataHeight, N, width, height, periodicInput, periodicOutput, symmetry, ground) {
  ground = ground || 0;

  this.N = N;
  this.outputWidth = width;
  this.outputHeight = height;
  this.outputArea = width * height;
  this.periodic = periodicOutput;

  this.initializedField = false;
  this.generationComplete = false;

  this.wave = null;
  this.compatible = null;
  this.weightLogWeights = null;
  this.sumOfWeights = 0;
  this.sumOfWeightLogWeights = 0;

  this.startingEntropy = 0;

  this.sumsOfOnes = null;
  this.sumsOfWeights = null;
  this.sumsOfWeightLogWeights = null;
  this.entropies = null;

  this.propagator = null;
  this.observed = null;
  this.distribution = null;

  this.stack = null;
  this.stackSize = 0;

  this.DX = [-1, 0, 1, 0];
  this.DY = [0, 1, 0, -1];
  this.opposite = [2, 3, 0, 1];

  const sample = new Array(dataWidth);
  for (let i = 0; i < dataWidth; i++) {
    sample[i] = new Array(dataHeight);
  }

  this.colors = [];
  const colorMap = {};

  for (let y = 0; y < dataHeight; y++) {
    for (let x = 0; x < dataWidth; x++) {
      const indexPixel = (y * dataWidth + x) * 4;
      const color = [data[indexPixel], data[indexPixel + 1], data[indexPixel + 2], data[indexPixel + 3]];
      const colorMapIndex = color.join('-');

      if (!colorMap.hasOwnProperty(colorMapIndex)) {
        colorMap[colorMapIndex] = this.colors.length;
        this.colors.push(color);
      }

      sample[x][y] = colorMap[colorMapIndex];
    }
  }

  const C = this.colors.length;
  const W = Math.pow(C, N * N);

  const pattern = function pattern (f) {
    let result = new Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        result[x + y * N] = f(x, y);
      }
    }

    return result;
  };

  const patternFromSample = function patternFromSample (x, y) {
    return pattern(function (dx, dy) {
      return sample[(x + dx) % dataWidth][(y + dy) % dataHeight];
    });
  };

  const rotate = function rotate (p) {
    return pattern(function (x, y) {
      return p[N - 1 - y + x * N];
    });
  };

  const reflect = function reflect (p) {
    return pattern(function (x, y) {
      return p[N - 1 - x + y * N];
    });
  };

  const index = function index (p) {
    let result = 0;
    let power = 1;

    for (let i = 0; i < p.length; i++) {
      result += p[p.length - 1 - i] * power;
      power *= C;
    }

    return result;
  };

  const patternFromIndex = function patternFromIndex (ind) {
    let residue = ind;
    let power = W;
    const result = new Array(N * N);

    for (let i = 0; i < result.length; i++) {
      power /= C;
      let count = 0;

      while (residue >= power) {
        residue -= power;
        count++;
      }

      result[i] = count;
    }

    return result;
  };

  const weights = {};
  const weightsKeys = []; // Object.keys won't preserve the order of creation, so we store them separately in an array

  for (let y = 0; y < (periodicInput ? dataHeight : dataHeight - N + 1); y++) {
    for (let x = 0; x < (periodicInput ? dataWidth : dataWidth - N + 1); x++) {
      const ps = new Array(8);
      ps[0] = patternFromSample(x, y);
      ps[1] = reflect(ps[0]);
      ps[2] = rotate(ps[0]);
      ps[3] = reflect(ps[2]);
      ps[4] = rotate(ps[2]);
      ps[5] = reflect(ps[4]);
      ps[6] = rotate(ps[4]);
      ps[7] = reflect(ps[6]);

      for (let k = 0; k < symmetry; k++) {
        const ind = index(ps[k]);

        if (!!weights[ind]) {
          weights[ind]++;
        } else {
          weightsKeys.push(ind);
          weights[ind] = 1;
        }
      }
    }
  }

  this.T = weightsKeys.length;
  this.ground = (ground + this.T) % this.T;
  this.patterns = new Array(this.T);
  this.weights = new Array(this.T);

  for (let i = 0; i < this.T; i++) {
    const w = parseInt(weightsKeys[i], 10);

    this.patterns[i] = patternFromIndex(w);
    this.weights[i] = weights[w]
  }

  const agrees = function agrees (p1, p2, dx, dy) {
    const xmin = dx < 0 ? 0 : dx;
    const xmax = dx < 0 ? dx + N : N;
    const ymin = dy < 0 ? 0 : dy;
    const ymax = dy < 0 ? dy + N : N;

    for (let y = ymin; y < ymax; y++) {
      for (let x = xmin; x < xmax; x++) {
        if (p1[x + N * y] != p2[x - dx + N * (y - dy)]) {
          return false;
        }
      }
    }

    return true;
  };

  this.propagator = new Array(4);

  for (let d = 0; d < 4; d++) {
    this.propagator[d] = new Array(this.T);
    for (let t = 0; t < this.T; t++) {
      const list = [];

      for (let t2 = 0; t2 < this.T; t2++) {
        if (agrees(this.patterns[t], this.patterns[t2], this.DX[d], this.DY[d])) {
          list.push(t2);
        }
      }

      this.propagator[d][t] = list;
    }
  }

  this.distribution = new Array(this.T);

  this.wave = new Array(this.outputArea);
  this.compatible = new Array(this.outputArea);

  for (let i = 0; i < this.outputArea; i++) {
    this.wave[i] = new Array(this.T);
    this.compatible[i] = new Array(this.T);

    for (let t = 0; t < this.T; t++) {
      this.compatible[i][t] = [0,0,0,0];
    }
  }

  this.weightLogWeights = new Array(this.T);
  this.sumOfWeights = 0;
  this.sumOfWeightLogWeights = 0;

  for (let t = 0; t < this.T; t++) {
    this.weightLogWeights[t] = this.weights[t] * Math.log(this.weights[t]);
    this.sumOfWeights += this.weights[t];
    this.sumOfWeightLogWeights += this.weightLogWeights[t];
  }

  this.startingEntropy = Math.log(this.sumOfWeights) - this.sumOfWeightLogWeights / this.sumOfWeights;

  this.sumsOfOnes = new Array(this.outputArea);
  this.sumsOfWeights = new Array(this.outputArea);
  this.sumsOfWeightLogWeights = new Array(this.outputArea);
  this.entropies = new Array(this.outputArea);

  this.stack = new Array(this.outputArea * this.T);
  this.stackSize = 0;
};


/**
 * @param {int} x
 * @param {int} y
 *
 * @returns {boolean}
 *
 * @protected
 */
OverlappingModel.prototype.onBoundary = function (x, y) {
  return !this.periodic && (x + this.N  > this.outputWidth || y + this.N > this.outputHeight || x < 0 || y < 0);
};

/**
 * Clear the internal state
 *
 * @protected
 */
OverlappingModel.prototype.clear = function () {
  for (let i = 0; i < this.outputArea; i++) {
    for (let t = 0; t < this.T; t++) {
      this.wave[i][t] = true;

      for (let d = 0; d < 4; d++) {
        this.compatible[i][t][d] = this.propagator[this.opposite[d]][t].length;
      }
    }

    this.sumsOfOnes[i] = this.weights.length;
    this.sumsOfWeights[i] = this.sumOfWeights;
    this.sumsOfWeightLogWeights[i] = this.sumOfWeightLogWeights;
    this.entropies[i] = this.startingEntropy;
  }

  this.initializedField = true;
  this.generationComplete = false;

  if (this.ground !== 0) {
    for (let x = 0; x < this.outputWidth; x++) {
      for (let t = 0; t < this.T; t++) {
        if (t !== this.ground) {
          this.ban(x + (this.outputHeight - 1) * this.outputWidth, t);
        }
      }

      for (let y = 0; y < this.outputHeight - 1; y++) {
        this.ban(x + y * this.outputWidth, this.ground);
      }
    }

    this.propagate();
  }
};

/**
 * Retrieve the RGBA data
 *
 * @param {Array|Uint8Array|Uint8ClampedArray} [array] Array to write the RGBA data into (must already be set to the correct size), if not set a new Uint8Array will be created and returned
 *
 * @returns {Array|Uint8Array|Uint8ClampedArray} RGBA data
 *
 * @public
 */
OverlappingModel.prototype.graphics = function (array) {
  array = array || new Uint8Array(this.outputArea * 4);

  if (this.isGenerationComplete()) {
    this.graphicsComplete(array);
  } else {
    this.graphicsIncomplete(array);
  }

  return array;
};

/**
 * Set the RGBA data for a complete generation in a given array
 *
 * @param {Array|Uint8Array|Uint8ClampedArray} array Array to write the RGBA data into
 *
 * @protected
 */
OverlappingModel.prototype.graphicsComplete = function (array) {
  for (let y = 0; y < this.outputHeight; y++) {
    const dy = y < this.outputHeight - this.N + 1 ? 0 : this.N - 1;
    for (let x = 0; x < this.outputWidth; x++) {
      const dx = x < this.outputWidth - this.N + 1 ? 0 : this.N - 1;

      const pixelIndex = (y * this.outputWidth + x) * 4;
      const color = this.colors[this.patterns[this.observed[x - dx + (y - dy) * this.outputWidth]][dx + dy * this.N]];

      array[pixelIndex] = color[0];
      array[pixelIndex + 1] = color[1];
      array[pixelIndex + 2] = color[2];
      array[pixelIndex + 3] = color[3];
    }
  }
};

/**
 * Set the RGBA data for an incomplete generation in a given array
 *
 * @param {Array|Uint8Array|Uint8ClampedArray} array Array to write the RGBA data into
 *
 * @protected
 */
OverlappingModel.prototype.graphicsIncomplete = function (array) {
  for (let i = 0; i < this.outputArea; i++) {
    const x = i % this.outputWidth;
    const y = i / this.outputWidth | 0;

    let contributors = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;

    for (let dy = 0; dy < this.N; dy++) {
      for (let dx = 0; dx < this.N; dx++) {
        let sx = x - dx;
        if (sx < 0) sx += this.outputWidth;

        let sy = y - dy;
        if (sy < 0) sy += this.outputHeight;

        if (this.onBoundary(sx, sy)) continue;

        const s = sx + sy * this.outputWidth;

        for (let t = 0; t < this.T; t++) {
          if (this.wave[s][t]) {
            contributors++;

            const color = this.colors[this.patterns[t][dx + dy * this.N]];

            r += color[0];
            g += color[1];
            b += color[2];
            a += color[3];
          }
        }
      }
    }

    const pixelIndex = i * 4;

    array[pixelIndex] = r / contributors;
    array[pixelIndex + 1] = g / contributors;
    array[pixelIndex + 2] = b / contributors;
    array[pixelIndex + 3] = a / contributors;
  }
};

/**
 *
 * @param {Function} rng Random number generator function
 *
 * @returns {*}
 *
 * @protected
 */
OverlappingModel.prototype.observe = function (rng) {

  let min = 1000;
  let argmin = -1;

  for (let i = 0; i < this.outputArea; i++) {
    if (this.onBoundary(i % this.outputWidth, i / this.outputWidth | 0)) continue;

    const amount = this.sumsOfOnes[i];

    if (amount === 0) return false;

    const entropy = this.entropies[i];

    if (amount > 1 && entropy <= min) {
      const noise = 0.000001 * rng();

      if (entropy + noise < min) {
        min = entropy + noise;
        argmin = i;
      }
    }
  }

  if (argmin === -1) {
    this.observed = new Array(this.outputArea);

    for (let i = 0; i < this.outputArea; i++) {
      for (let t = 0; t < this.T; t++) {
        if (this.wave[i][t]) {
          this.observed[i] = t;
          break;
        }
      }
    }

    return true;
  }

  for (let t = 0; t < this.T; t++) {
    this.distribution[t] = this.wave[argmin][t] ? this.weights[t] : 0;
  }
  const r = randomIndice(this.distribution, rng());

  const w = this.wave[argmin];
  for (let t = 0; t < this.T; t++) {
    if (w[t] !== (t === r)) this.ban(argmin, t);
  }

  return null;
};

/**
 * @protected
 */
OverlappingModel.prototype.propagate = function () {
  while (this.stackSize > 0) {
    const e1 = this.stack[this.stackSize - 1];
    this.stackSize--;

    const i1 = e1[0];
    const x1 = i1 % this.outputWidth;
    const y1 = i1 / this.outputWidth | 0;

    for (let d = 0; d < 4; d++) {
      const dx = this.DX[d];
      const dy = this.DY[d];

      let x2 = x1 + dx;
      let y2 = y1 + dy;

      if (this.onBoundary(x2, y2)) continue;

      if (x2 < 0) x2 += this.outputWidth;
      else if (x2 >= this.outputWidth) x2 -= this.outputWidth;
      if (y2 < 0) y2 += this.outputHeight;
      else if (y2 >= this.outputHeight) y2 -= this.outputHeight;

      const i2 = x2 + y2 * this.outputWidth;
      const p = this.propagator[d][e1[1]];
      const compat = this.compatible[i2];

      for (let l = 0; l < p.length; l++) {
        const t2 = p[l];
        const comp = compat[t2];
        comp[d]--;
        if (comp[d] == 0) this.ban(i2, t2);
      }
    }
  }
};

/**
 * Execute a single iteration
 *
 * @param {Function} rng Random number generator function
 *
 * @returns {boolean|null}
 *
 * @protected
 */
OverlappingModel.prototype.singleIteration = function (rng) {
  const result = this.observe(rng);

  if (result !== null) {
    this.generationComplete = result;

    return !!result;
  }

  this.propagate();

  return null;
};

/**
 * Execute a fixed number of iterations. Stop when the generation is successful or reaches a contradiction.
 *
 * @param {int} [iterations=0] Maximum number of iterations to execute (0 = infinite)
 * @param {Function|null} [rng=Math.random] Random number generator function
 *
 * @returns {boolean} Success
 *
 * @public
 */
OverlappingModel.prototype.iterate = function (iterations, rng) {
  if (!this.wave) this.initialize();

  if (!this.initializedField) {
    this.clear();
  }

  iterations = iterations || 0;
  rng = rng || Math.random;

  for (let i = 0; i < iterations || iterations === 0; i++) {
    const result = this.singleIteration(rng);

    if (result !== null) {
      return !!result;
    }
  }

  return true;
};

/**
 * Execute a complete new generation
 *
 * @param {Function|null} [rng=Math.random] Random number generator function
 *
 * @returns {boolean} Success
 *
 * @public
 */
OverlappingModel.prototype.generate = function (rng) {
  rng = rng || Math.random;

  if (!this.wave) this.initialize();

  this.clear();

  while(true) {
    const result = this.singleIteration(rng);

    if (result !== null) {
      return !!result;
    }
  }
};

/**
 * Check whether the previous generation completed successfully
 *
 * @returns {boolean}
 *
 * @public
 */
OverlappingModel.prototype.isGenerationComplete = function () {
  return this.generationComplete;
};

/**
 *
 * @param {int} i
 * @param {int} t
 *
 * @protected
 */
OverlappingModel.prototype.ban = function (i, t) {
  const comp = this.compatible[i][t];

  for (let d = 0; d < 4; d++) {
    comp[d] = 0;
  }

  this.wave[i][t] = false;

  this.stack[this.stackSize] = [i, t];
  this.stackSize++;

  this.sumsOfOnes[i] -= 1;
  this.sumsOfWeights[i] -= this.weights[t];
  this.sumsOfWeightLogWeights[i] -= this.weightLogWeights[t];

  const sum = this.sumsOfWeights[i];
  this.entropies[i] = Math.log(sum) - this.sumsOfWeightLogWeights[i] / sum;
};
