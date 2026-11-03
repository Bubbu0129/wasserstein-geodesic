"use strict";

// Small, dependency-free GIF89a encoder. The global RGB332 palette avoids
// recalculating a palette for every frame. All frames use the same palette.
// The exported GIF contains the already-computed canvas animation, not a
// second numerical computation.

(function () {
  function word(n) { return [n & 255, (n >>> 8) & 255]; }

  function lzwEncode(indices) {
    const clear = 256, end = 257;
    let bits = 9, next = 258;
    let dictionary = new Map();
    let buffer = 0, bufferedBits = 0;
    const output = [];

    function emit(code) {
      buffer |= code << bufferedBits;
      bufferedBits += bits;
      while (bufferedBits >= 8) {
        output.push(buffer & 255);
        buffer >>>= 8;
        bufferedBits -= 8;
      }
    }

    emit(clear);
    if (indices.length) {
      let prefix = indices[0];
      for (let i = 1; i < indices.length; i++) {
        const nextPixel = indices[i];
        const key = (prefix << 8) | nextPixel;
        const match = dictionary.get(key);
        if (match !== undefined) {
          prefix = match;
          continue;
        }
        emit(prefix);
        if (next < 4096) {
          dictionary.set(key, next++);
          // The decoder adds dictionary entries one output-code later;
          // defer code-width growth to keep the two sides synchronized.
          if (next > (1 << bits) && bits < 12) bits++;
        } else {
          emit(clear);
          dictionary = new Map();
          bits = 9;
          next = 258;
        }
        prefix = nextPixel;
      }
      emit(prefix);
    }
    emit(end);
    if (bufferedBits) output.push(buffer & 255);
    return Uint8Array.from(output);
  }

  class GifEncoder {
    constructor(width, height) {
      if (!(Number.isInteger(width) && Number.isInteger(height)) ||
          width < 1 || height < 1 || width > 65535 || height > 65535) {
        throw new Error("Invalid GIF dimensions");
      }
      this.width = width;
      this.height = height;
      const palette = new Uint8Array(256 * 3);
      for (let i = 0; i < 256; i++) {
        palette[i * 3] = Math.round(((i >>> 5) & 7) * 255 / 7);
        palette[i * 3 + 1] = Math.round(((i >>> 2) & 7) * 255 / 7);
        palette[i * 3 + 2] = (i & 3) * 85;
      }
      this.parts = [
        Uint8Array.from([
          71, 73, 70, 56, 57, 97, // GIF89a
          ...word(width), ...word(height),
          0xF7, 255, 0,           // global table with 256 colors, white background
        ]),
        palette,
        Uint8Array.from([
          0x21, 0xFF, 0x0B,
          ..."NETSCAPE2.0".split("").map((ch) => ch.charCodeAt(0)),
          0x03, 0x01, 0x00, 0x00, 0x00, // loop forever
        ]),
      ];
    }

    addFrame(imageData, delayCentiseconds) {
      const rgba = imageData.data;
      if (imageData.width !== this.width || imageData.height !== this.height) {
        throw new Error("GIF frame dimensions do not match");
      }
      const indices = new Uint8Array(this.width * this.height);
      for (let i = 0, j = 0; j < indices.length; i += 4, j++) {
        indices[j] = (rgba[i] & 0xE0) |
          ((rgba[i + 1] & 0xE0) >>> 3) | (rgba[i + 2] >>> 6);
      }
      const delay = Math.max(1, Math.min(65535, Math.round(delayCentiseconds)));
      this.parts.push(Uint8Array.from([
        0x21, 0xF9, 0x04, 0x04, ...word(delay), 0, 0,
        0x2C, 0, 0, 0, 0, ...word(this.width), ...word(this.height), 0,
        8, // minimum LZW code size (256-color palette)
      ]));
      const compressed = lzwEncode(indices);
      for (let pos = 0; pos < compressed.length; pos += 255) {
        const chunk = compressed.subarray(pos, pos + 255);
        this.parts.push(Uint8Array.of(chunk.length), chunk);
      }
      this.parts.push(Uint8Array.of(0)); // end image sub-blocks
    }

    finish() {
      return new Blob([...this.parts, Uint8Array.of(0x3B)], { type: "image/gif" });
    }
  }

  window.GifEncoder = GifEncoder;
})();
