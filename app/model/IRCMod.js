const fs = require('fs');
const path = require('path');
const IRC = require('../common/IRC');

const util = require('../libs/util');
class IRCMod {
  add (options) {
    const id = util.uuid.v4().split('-')[0];
    const set = { ...options };
    set.id = id;
    set.channels = set.channels || [];
    set.filters = set.filters || [];
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
      irc.status = !!(global.runningIRC[irc.id] && global.runningIRC[irc.id].status);
    }
    return ircList;
  };
}

module.exports = IRCMod;
