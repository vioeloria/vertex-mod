import { get, post } from '../util/axios';

export default {
  list: async () => {
    const url = '/api/rssProxy/list';
    return await get(url);
  },
  modify: async (proxy) => {
    const url = '/api/rssProxy/' + (proxy.id ? 'modify' : 'add');
    return await post(url, proxy);
  },
  delete: async (id) => {
    const url = '/api/rssProxy/delete';
    return await post(url, { id });
  }
};
