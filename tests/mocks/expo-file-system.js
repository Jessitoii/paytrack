export const documentDirectory = 'file:///mock/documents/';
export const EncodingType = { UTF8: 'utf8' };
export const getInfoAsync = async () => ({ exists: true, isDirectory: true });
export const makeDirectoryAsync = async () => {};
export const writeAsStringAsync = async () => {};
export const readAsStringAsync = async () => '';
export default {
  documentDirectory,
  EncodingType,
  getInfoAsync,
  makeDirectoryAsync,
  writeAsStringAsync,
  readAsStringAsync,
};
