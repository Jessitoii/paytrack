import nodeCrypto from 'crypto';

export function getRandomValues(typedArray) {
  if (!typedArray) throw new TypeError('Argument cannot be null or undefined');
  nodeCrypto.randomFillSync(typedArray);
  return typedArray;
}

export function getRandomBytes(byteCount) {
  return new Uint8Array(nodeCrypto.randomBytes(byteCount));
}

export default {
  getRandomValues,
  getRandomBytes,
};
