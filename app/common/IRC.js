/* eslint-disable no-control-regex */
const logger = require('../libs/logger');
const util = require('../libs/util');
const redis = require('../libs/redis');
const { Client } = require('matrix-org-irc');

const DEFAULT_REGEXP = 'TORRENT: (.*?) - (https://.*?) / (https://.*)';

class IRC {
  constructor (irc) {
    this.id = irc.id;
    this.alias = irc.alias;
    this.enable = irc.enable;
    this.host = irc.host;
    this.port = irc.port || 6697;
    this.nick = irc.nick;
    this.user = irc.user || irc.nick;
    this.password = irc.password;
    this.secure = irc.secure === undefined ? true : !!irc.secure;
    this.channels = irc.channels || [];
    this.filters = irc.filters || [];
    this.clientId = irc.client;
    this.savePath = irc.savePath;
    this.category = irc.category;
    this.uploadLimit = util.calSize(irc.uploadLimit, irc.uploadLimitUnit);
    this.downloadLimit = util.calSize(irc.downloadLimit, irc.downloadLimitUnit);
    this.skipChecking = !!irc.skipChecking;
    this.paused = !!irc.paused;
    this.tag = irc.tag || 'IRC';
    this.status = false;
    this.client = null;
    this.initIRC();
  }

  _parseSize (size) {
    if (size === undefined || size === null || size === '') return 0;
    if (typeof size === 'number') return size;
    const str = (size + '').trim();
    if (/^\d+$/.test(str)) return +str;
    const match = str.match(/([\d.]+)\s*([KMGT]?i?B)/i);
    if (!match) return 0;
    const map = {
      B: 1,
      KB: 1000,
      MB: 1000 ** 2,
      GB: 1000 ** 3,
      TB: 1000 ** 4,
      KIB: 1024,
      MIB: 1024 ** 2,
      GIB: 1024 ** 3,
      TIB: 1024 ** 4
    };
    return parseFloat(match[1]) * (map[match[2].toUpperCase()] || 1);
  }

  _fitConditions (torrent, conditions) {
    let fit = true;
    for (const condition of conditions) {
      let value;
      switch (condition.compareType) {
      case 'equals':
        fit = fit && (torrent[condition.key] === condition.value || torrent[condition.key] === +condition.value);
        break;
      case 'bigger':
        value = 1;
        condition.value.split('*').forEach(item => {
          value *= +item;
        });
        fit = fit && torrent[condition.key] > value;
        break;
      case 'smaller':
        value = 1;
        condition.value.split('*').forEach(item => {
          value *= +item;
        });
        fit = fit && torrent[condition.key] < value;
        break;
      case 'contain':
        fit = fit && condition.value.split(',').filter(item => (torrent[condition.key] + '').indexOf(item) !== -1).length !== 0;
        break;
      case 'includeIn':
        fit = fit && condition.value.split(',').indexOf(torrent[condition.key]) !== -1;
        break;
      case 'notContain':
        fit = fit && condition.value.split(',').filter(item => (torrent[condition.key] + '').indexOf(item) !== -1).length === 0;
        break;
      case 'notIncludeIn':
        fit = fit && condition.value.split(',').indexOf(torrent[condition.key]) === -1;
        break;
      case 'regExp':
        fit = fit && !!(torrent[condition.key] + '').match(new RegExp(condition.value, 'ig'));
        break;
      case 'notRegExp':
        fit = fit && !(torrent[condition.key] + '').match(new RegExp(condition.value, 'ig'));
        break;
      }
    }
    return fit;
  }

  _fitFilters (torrent) {
    if (!this.filters || this.filters.length === 0) return true;
    try {
      return this._fitConditions(torrent, this.filters);
    } catch (e) {
      logger.error('IRC', this.alias, '过滤器错误\n', e);
      return false;
    }
  }

  _parseAnnounce (channel, message) {
    const formatMessage = message
      .replace(/\x02\d{2}([^\d])/g, '$1')
      .replace(/\x03\d{2}([^\d])/g, '$1')
      .replace(/\x02/g, '')
      .replace(/\x03/g, '');
    let regRes;
    try {
      regRes = formatMessage.match(new RegExp(channel.regexp || DEFAULT_REGEXP));
    } catch (e) {
      logger.error('IRC', this.alias, '播报正则错误\n', e);
      return null;
    }
    if (!regRes) {
      logger.info('IRC', this.alias, '无法解析播报:', formatMessage);
      return null;
    }
    const groups = regRes.groups || {};
    const title = groups.title || regRes[1];
    const link = groups.link || regRes[2];
    const url = groups.url || regRes[3];
    if (!title || !url) return null;
    return {
      title,
      name: title,
      link: link || url,
      url,
      size: this._parseSize(groups.size),
      hash: groups.hash || ''
    };
  }

  async _push (torrent) {
    const client = global.runningClient[this.clientId];
    if (!client) {
      logger.error('IRC', this.alias, '下载器不存在:', this.clientId);
      return;
    }
    const dedupKey = `vertex:irc:${this.id}:${util.md5(torrent.title)}`;
    if (await redis.get(dedupKey)) {
      logger.debug('IRC', this.alias, '重复播报, 跳过:', torrent.title);
      return;
    }
    await redis.setWithExpire(dedupKey, '1', 3600 * 24);
    try {
      await client.addTorrent(torrent.url, torrent.hash, this.skipChecking, this.uploadLimit, this.downloadLimit, this.savePath, this.category, false, this.paused);
      if (torrent.hash) {
        await util.sleep(1000);
        try {
          await client.addTorrentTag(torrent.hash, `${this.alias}_${this.tag}`);
        } catch (e) {
          logger.error('IRC', this.alias, '打标签失败:', torrent.title, '\n', e);
        }
      }
      logger.info('IRC', this.alias, '添加种子成功:', torrent.title);
    } catch (e) {
      logger.error('IRC', this.alias, '添加种子失败:', torrent.title, '\n', e);
    }
  }

  async _handleTorrent (torrent) {
    if (!this._fitFilters(torrent)) {
      logger.debug('IRC', this.alias, '未匹配过滤器, 跳过:', torrent.title);
      return;
    }
    await this._push(torrent);
  }

  handleMessage (message) {
    if (message.command === 'NOTICE') {
      const notice = message.args[1] || '';
      if (message.nick === 'NickServ' && notice === 'please choose a different nick.') {
        this.client.say('NickServ', `IDENTIFY ${this.password}`);
      }
      if (message.nick === 'NickServ' && notice.indexOf('Password accepted') !== -1) {
        this._joinChannels();
      }
      return;
    }
    if (message.command !== 'PRIVMSG') return;
    const text = message.args[1];
    if (!text) return;
    const channel = this.channels.find(item => item.announcer === message.nick || item.channel === message.args[0]);
    if (!channel) return;
    if (channel.welcomeText && text === channel.welcomeText) {
      logger.info('IRC', this.alias, '已进入 Announce 频道:', channel.channel);
      return;
    }
    const torrent = this._parseAnnounce(channel, text);
    if (!torrent) return;
    this._handleTorrent(torrent).catch(e => logger.error('IRC', this.alias, '\n', e));
  }

  _joinChannels () {
    for (const channel of this.channels) {
      try {
        if (channel.enterCommand) {
          this.client.say(channel.announcer || channel.channel, channel.enterCommand);
        }
        if (channel.channel) {
          this.client.join(channel.channel, channel.key || undefined);
        }
      } catch (e) {
        logger.error('IRC', this.alias, '加入频道失败:', channel.channel, '\n', e);
      }
    }
  }

  initIRC () {
    try {
      this.client = new Client(this.host, this.nick, {
        userName: this.user || this.nick,
        realName: this.user || this.nick,
        port: this.port,
        secure: this.secure,
        selfSigned: true,
        retryDelay: 5000
      });
      this.client.on('registered', () => {
        this.status = true;
        logger.info('IRC', this.alias, '连接成功:', this.host);
        this._joinChannels();
      });
      this.client.on('raw', (message) => this.handleMessage(message));
      this.client.on('error', (error) => {
        this.status = false;
        logger.error('IRC', this.alias, '错误\n', error);
      });
      this.client.on('close', () => {
        this.status = false;
        logger.error('IRC', this.alias, '连接已断开');
      });
    } catch (e) {
      logger.error('IRC', this.alias, '初始化失败\n', e);
    }
  }

  destroy () {
    logger.info('销毁 IRC 实例:', this.alias);
    try {
      if (this.client) this.client.disconnect('bye');
    } catch (e) {
      logger.error(e);
    }
    delete global.runningIRC[this.id];
  }
}

module.exports = IRC;
