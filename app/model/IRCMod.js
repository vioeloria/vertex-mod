const fs = require('fs');
const path = require('path');
const IRC = require('../common/IRC');

const util = require('../libs/util');
const redis = require('../libs/redis');
class IRCMod {
  add (options) {
    const id = util.uuid.v4().split('-')[0];
    const set = { ...options };
    set.id = id;
    set.channels = set.channels || [];
    set.filters = set.filters || [];
    set.acceptRules = set.acceptRules || [];
    set.rejectRules = set.rejectRules || [];
    set.clientArr = set.clientArr || (set.client ? [set.client] : []);
    fs.writeFileSync(path.join(__dirname, '../data/irc', id + '.json'), JSON.stringify(set, null, 2));
    if (global.runningIRC[id]) global.runningIRC[id].destroy();
    if (set.enable) global.runningIRC[id] = new IRC(set);
    return '添加 IRC 成功';
  };

  delete (options) {
    fs.unlinkSync(path.join(__dirname, '../data/irc', options.id + '.json'));
    if (global.runningIRC[options.id]) global.runningIRC[options.id].destroy();
    return '删除 IRC 成功';
  };

  modify (options) {
    const set = { ...options };
    set.channels = set.channels || [];
    set.filters = set.filters || [];
    set.acceptRules = set.acceptRules || [];
    set.rejectRules = set.rejectRules || [];
    set.clientArr = set.clientArr || (set.client ? [set.client] : []);
    fs.writeFileSync(path.join(__dirname, '../data/irc', options.id + '.json'), JSON.stringify(set, null, 2));
    if (global.runningIRC[options.id]) global.runningIRC[options.id].destroy();
    if (set.enable) global.runningIRC[options.id] = new IRC(set);
    return '修改 IRC 成功';
  };

  list () {
    const ircList = util.listIRC();
    for (const irc of ircList) {
      irc.channels = irc.channels || [];
      irc.filters = irc.filters || [];
      irc.acceptRules = irc.acceptRules || [];
      irc.rejectRules = irc.rejectRules || [];
      irc.clientArr = irc.clientArr || (irc.client ? [irc.client] : []);
      irc.status = !!(global.runningIRC[irc.id] && global.runningIRC[irc.id].status);
    }
    return ircList;
  };

  async test (options) {
    const set = { ...options };
    set.id = 'test-' + util.uuid.v4().split('-')[0];
    set.enable = true;
    set.dryrun = true;
    const irc = new IRC(set);
    const seconds = Math.min(60, Math.max(5, +options.testSeconds || 20));
    await util.sleep(seconds * 1000);
    const result = {
      status: irc.status,
      joinedChannels: irc.joinedChannels,
      messages: irc.messages
    };
    irc.destroy();
    return result;
  };

  async messages (options) {
    const irc = global.runningIRC[options.id];
    if (irc) {
      return {
        status: irc.status,
        joinedChannels: irc.joinedChannels,
        messages: irc.messages
      };
    }
    const cache = await redis.get(`vertex:irc:msg:${options.id}`);
    return {
      status: false,
      joinedChannels: [],
      messages: cache ? JSON.parse(cache) : []
    };
  };
}

module.exports = IRCMod;
