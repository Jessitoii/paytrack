const store = {};
export const setItemAsync = async (k, v) => { store[k] = String(v); };
export const getItemAsync = async (k) => store[k] ?? null;
export const deleteItemAsync = async (k) => { delete store[k]; };
export default { setItemAsync, getItemAsync, deleteItemAsync };
