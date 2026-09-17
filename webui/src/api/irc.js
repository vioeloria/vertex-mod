import { get, post } from '../util/axios';

export default {
  list: async () => {
    const url = '/api/irc/list';
    return await get(url);
  },
  modify: async (irc) => {
    const url = '/api/irc/' + (irc.id ? 'modify' : 'add');
    return await post(url, irc);
  },
  delete: async (id) => {
    const url = '/api/irc/delete';
    return await post(url, { id });
  },
  test: async (irc) => {
    const url = '/api/irc/test';
    return await post(url, irc);
  },
  messages: async (id) => {
    const url = '/api/irc/messages?id=' + id + '&_=' + Math.random();
    return await get(url);
  }
};
