/**
 * Pure TypeScript RFC 1951 Deflate / RFC 1950 zlib Inflate implementation.
 * Zero external dependencies. Zero Node.js built-ins.
 * 100% compatible with React Native, Expo Go, Web, and Node.
 */

// Extra bits and base values for length codes (symbols 257..285)
const LENGTH_EXTRA_BITS = [
  0, 0, 0, 0, 0, 0, 0, 0,
  1, 1, 1, 1, 2, 2, 2, 2,
  3, 3, 3, 3, 4, 4, 4, 4,
  5, 5, 5, 5, 0,
];

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10,
  11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115,
  131, 163, 195, 227, 258,
];

// Extra bits and base values for distance codes (symbols 0..29)
const DISTANCE_EXTRA_BITS = [
  0, 0, 0, 0, 1, 1, 2, 2,
  3, 3, 4, 4, 5, 5, 6, 6,
  7, 7, 8, 8, 9, 9, 10, 10,
  11, 11, 12, 12, 13, 13,
];

const DISTANCE_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13,
  17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073,
  4097, 6145, 8193, 12289, 16385, 24577,
];

// Order of code lengths for dynamic Huffman header
const CODE_LENGTH_ORDER = [
  16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
];

// Pre-built fixed Huffman code lengths
const FIXED_LITERAL_LENGTHS = new Uint8Array(288);
for (let i = 0; i <= 143; i++) FIXED_LITERAL_LENGTHS[i] = 8;
for (let i = 144; i <= 255; i++) FIXED_LITERAL_LENGTHS[i] = 9;
for (let i = 256; i <= 279; i++) FIXED_LITERAL_LENGTHS[i] = 7;
for (let i = 280; i <= 287; i++) FIXED_LITERAL_LENGTHS[i] = 8;

const FIXED_DISTANCE_LENGTHS = new Uint8Array(32);
for (let i = 0; i < 32; i++) FIXED_DISTANCE_LENGTHS[i] = 5;

/**
 * Fast BitStream reader over Uint8Array.
 */
class BitStream {
  public pos: number;
  private bitBuf = 0;
  private bitCount = 0;

  constructor(private readonly data: Uint8Array, startPos = 0) {
    this.pos = startPos;
  }

  readBits(n: number): number {
    while (this.bitCount < n) {
      if (this.pos >= this.data.length) {
        throw new Error('Unexpected end of stream while reading bits');
      }
      this.bitBuf |= this.data[this.pos++] << this.bitCount;
      this.bitCount += 8;
    }
    const val = this.bitBuf & ((1 << n) - 1);
    this.bitBuf >>>= n;
    this.bitCount -= n;
    return val;
  }

  alignToByte(): void {
    this.bitBuf = 0;
    this.bitCount = 0;
  }

  readUint16LE(): number {
    this.alignToByte();
    if (this.pos + 2 > this.data.length) {
      throw new Error('Unexpected end of stream while reading uint16');
    }
    const val = this.data[this.pos] | (this.data[this.pos + 1] << 8);
    this.pos += 2;
    return val;
  }

  readBytes(count: number): Uint8Array {
    this.alignToByte();
    if (this.pos + count > this.data.length) {
      throw new Error('Unexpected end of stream while reading bytes');
    }
    const slice = this.data.subarray(this.pos, this.pos + count);
    this.pos += count;
    return slice;
  }
}

/**
 * Huffman tree represented as a flat Int32Array.
 * Tree structure:
 *  - Node index `k`
 *  - Left child: `nodes[k * 2]`
 *  - Right child: `nodes[k * 2 + 1]`
 *  - If child < 0: leaf node containing symbol `-(child + 1)`
 *  - If child === 0: empty/unallocated
 */
class HuffmanTree {
  private nodes: Int32Array;
  private nextNode = 1;

  constructor(codeLengths: Uint8Array | number[]) {
    const maxLen = 16;
    const blCount = new Uint16Array(maxLen);
    const maxSymbol = codeLengths.length;

    for (let i = 0; i < maxSymbol; i++) {
      const len = codeLengths[i];
      if (len > 0 && len < maxLen) {
        blCount[len]++;
      }
    }

    const nextCode = new Uint16Array(maxLen);
    let code = 0;
    for (let bits = 1; bits < maxLen; bits++) {
      code = (code + blCount[bits - 1]) << 1;
      nextCode[bits] = code;
    }

    // Allocate sufficient tree nodes (max symbols * 4)
    this.nodes = new Int32Array(maxSymbol * 4);

    for (let sym = 0; sym < maxSymbol; sym++) {
      const len = codeLengths[sym];
      if (len === 0) continue;

      let c = nextCode[len]++;
      let node = 0;

      for (let bit = len - 1; bit >= 0; bit--) {
        const b = (c >>> bit) & 1;
        const childOffset = node * 2 + b;
        let child = this.nodes[childOffset];

        if (bit === 0) {
          // Leaf node
          this.nodes[childOffset] = -(sym + 1);
        } else {
          if (child === 0) {
            child = this.nextNode++;
            this.nodes[childOffset] = child;
          }
          node = child;
        }
      }
    }
  }

  decode(stream: BitStream): number {
    let node = 0;
    while (true) {
      const bit = stream.readBits(1);
      const child = this.nodes[node * 2 + bit];
      if (child < 0) {
        return -(child + 1);
      }
      if (child === 0) {
        throw new Error('Invalid Huffman code encountered during decode');
      }
      node = child;
    }
  }
}

const fixedLiteralTree = new HuffmanTree(FIXED_LITERAL_LENGTHS);
const fixedDistanceTree = new HuffmanTree(FIXED_DISTANCE_LENGTHS);

/**
 * Dynamic growing output byte buffer.
 */
class OutputBuffer {
  public data: Uint8Array;
  public length = 0;

  constructor(initialCapacity = 65536) {
    this.data = new Uint8Array(initialCapacity);
  }

  push(byte: number): void {
    if (this.length >= this.data.length) {
      this.grow(this.data.length * 2);
    }
    this.data[this.length++] = byte;
  }

  pushBytes(bytes: Uint8Array): void {
    if (this.length + bytes.length > this.data.length) {
      this.grow(Math.max(this.data.length * 2, this.length + bytes.length + 1024));
    }
    this.data.set(bytes, this.length);
    this.length += bytes.length;
  }

  copy(distance: number, count: number): void {
    if (this.length + count > this.data.length) {
      this.grow(Math.max(this.data.length * 2, this.length + count + 1024));
    }
    let src = this.length - distance;
    if (src < 0) {
      throw new Error(`Invalid back-reference distance ${distance} (buffer length ${this.length})`);
    }

    for (let i = 0; i < count; i++) {
      this.data[this.length++] = this.data[src++];
    }
  }

  private grow(newCap: number): void {
    const next = new Uint8Array(newCap);
    next.set(this.data.subarray(0, this.length));
    this.data = next;
  }

  toUint8Array(): Uint8Array {
    return this.data.subarray(0, this.length);
  }
}

/**
 * Pure TypeScript Deflate / zlib Inflate function.
 * Accepts compressed bytes and returns uncompressed bytes.
 */
export function pureInflate(input: Uint8Array): Uint8Array {
  if (input.length === 0) return new Uint8Array(0);

  let startPos = 0;

  // Check for zlib header (RFC 1950)
  if (input.length >= 2) {
    const cmf = input[0];
    const flg = input[1];
    // Check if compression method is deflate (8) and check valid header checksum
    if ((cmf & 0x0f) === 8 && (cmf * 256 + flg) % 31 === 0) {
      startPos = 2;
      // FDICT flag present
      if (flg & 0x20) {
        startPos += 4;
      }
    }
  }

  const stream = new BitStream(input, startPos);
  const out = new OutputBuffer(Math.max(input.length * 3, 4096));

  let isLastBlock = false;

  while (!isLastBlock) {
    isLastBlock = stream.readBits(1) === 1;
    const blockType = stream.readBits(2);

    if (blockType === 0) {
      // 00: Uncompressed block
      const len = stream.readUint16LE();
      const nlen = stream.readUint16LE();
      if ((len ^ 0xffff) !== nlen) {
        throw new Error('Invalid uncompressed block length checksum');
      }
      const rawBytes = stream.readBytes(len);
      out.pushBytes(rawBytes);
    } else if (blockType === 1) {
      // 01: Compressed with fixed Huffman codes
      decodeHuffmanBlock(stream, fixedLiteralTree, fixedDistanceTree, out);
    } else if (blockType === 2) {
      // 10: Compressed with dynamic Huffman codes
      const hlit = stream.readBits(5) + 257;
      const hdist = stream.readBits(5) + 1;
      const hclen = stream.readBits(4) + 4;

      const codeLengthLengths = new Uint8Array(19);
      for (let i = 0; i < hclen; i++) {
        codeLengthLengths[CODE_LENGTH_ORDER[i]] = stream.readBits(3);
      }

      const codeLengthTree = new HuffmanTree(codeLengthLengths);

      // Decode literal and distance code lengths
      const totalCodes = hlit + hdist;
      const litDistLengths = new Uint8Array(totalCodes);
      let index = 0;

      while (index < totalCodes) {
        const sym = codeLengthTree.decode(stream);
        if (sym < 16) {
          litDistLengths[index++] = sym;
        } else if (sym === 16) {
          // Copy previous 3-6 times
          if (index === 0) throw new Error('Repeat code with no previous length');
          const prev = litDistLengths[index - 1];
          const repeat = stream.readBits(2) + 3;
          for (let r = 0; r < repeat && index < totalCodes; r++) {
            litDistLengths[index++] = prev;
          }
        } else if (sym === 17) {
          // Repeat 0 for 3-10 times
          const repeat = stream.readBits(3) + 3;
          for (let r = 0; r < repeat && index < totalCodes; r++) {
            litDistLengths[index++] = 0;
          }
        } else if (sym === 18) {
          // Repeat 0 for 11-138 times
          const repeat = stream.readBits(7) + 11;
          for (let r = 0; r < repeat && index < totalCodes; r++) {
            litDistLengths[index++] = 0;
          }
        } else {
          throw new Error(`Invalid code length symbol ${sym}`);
        }
      }

      const litTree = new HuffmanTree(litDistLengths.subarray(0, hlit));
      const distTree = new HuffmanTree(litDistLengths.subarray(hlit, totalCodes));

      decodeHuffmanBlock(stream, litTree, distTree, out);
    } else {
      throw new Error(`Unsupported block type ${blockType}`);
    }
  }

  return out.toUint8Array();
}

function decodeHuffmanBlock(
  stream: BitStream,
  litTree: HuffmanTree,
  distTree: HuffmanTree,
  out: OutputBuffer
): void {
  while (true) {
    const sym = litTree.decode(stream);
    if (sym < 256) {
      out.push(sym);
    } else if (sym === 256) {
      // End of block
      break;
    } else {
      // Length symbol 257..285
      const lenIndex = sym - 257;
      if (lenIndex >= LENGTH_BASE.length) {
        throw new Error(`Invalid length symbol ${sym}`);
      }
      const extraBits = LENGTH_EXTRA_BITS[lenIndex];
      const length = LENGTH_BASE[lenIndex] + (extraBits > 0 ? stream.readBits(extraBits) : 0);

      // Decode distance
      const distSym = distTree.decode(stream);
      if (distSym >= DISTANCE_BASE.length) {
        throw new Error(`Invalid distance symbol ${distSym}`);
      }
      const distExtraBits = DISTANCE_EXTRA_BITS[distSym];
      const distance = DISTANCE_BASE[distSym] + (distExtraBits > 0 ? stream.readBits(distExtraBits) : 0);

      out.copy(distance, length);
    }
  }
}
