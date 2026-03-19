import keyv from 'keyv';

const memkv = new keyv();

class KV {
  async get(key) {
    return await memkv.get(key);
  }
  async set(key, value) {
    const set = await memkv.set(key, value);
    return set === true;
  }
  async setTTL(key, value, ttl) {
    const set = await memkv.set(key, value, ttl);
    return set === true;
  }
}

export default new KV();