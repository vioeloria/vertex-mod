const fs = require('fs');
const path = require('path');
const CryptoJS = require('crypto-js');
const util = require('../libs/util');

class RssProxyMod {
  _genToken (id, secret) {
    return CryptoJS.HmacSHA256(id, secret).toString();
  };

  add (options) {
    const id = util.uuid.v4().split('-')[0];
    const set = { ...options };
    set.id = id;
    if (set.secret) set.token = this._genToken(id, set.secret);
    fs.writeFileSync(path.join(__dirname, '../data/rssproxy', id + '.json'), JSON.stringify(set, null, 2));
    return set;
  };

  delete (options) {
    fs.unlinkSync(path.join(__dirname, '../data/rssproxy', options.id + '.json'));
    return '删除 RSS 代理成功';
  };

  modify (options) {
    const set = { ...options };
    if (set.secret) set.token = this._genToken(set.id, set.secret);
    fs.writeFileSync(path.join(__dirname, '../data/rssproxy', options.id + '.json'), JSON.stringify(set, null, 2));
    return set;
  };

  list () {
    return util.listRssProxy();
  };
}

module.exports = RssProxyMod;
