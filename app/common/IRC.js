/* eslint-disable no-control-regex */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bencode = require('bencode');
const moment = require('moment');
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
    this.clientArr = irc.clientArr || (irc.client ? [irc.client] : []);
    this.clientSortBy = irc.clientSortBy || 'leechingCount';
    this.maxClientUploadSpeed = util.calSize(irc.maxClientUploadSpeed, irc.maxClientUploadSpeedUnit);
    this.maxClientDownloadSpeed = util.calSize(irc.maxClientDownloadSpeed, irc.maxClientDownloadSpeedUnit);
    this.maxClientDownloadCount = +irc.maxClientDownloadCount;
    this.savePath = irc.savePath;
    this.category = irc.category;
    this.uploadLimit = util.calSize(irc.uploadLimit, irc.uploadLimitUnit);
    this.downloadLimit = util.calSize(irc.downloadLimit, irc.downloadLimitUnit);
    this.skipChecking = !!irc.skipChecking;
    this.paused = !!irc.paused;
    this.pushTorrentFile = !!irc.pushTorrentFile;
    this.tag = irc.tag || 'IRC';
    this.dryrun = !!irc.dryrun;
    this.status = false;
    this.client = null;
    this.joinedChannels = [];
    this.messages = [];
    redis.get(`vertex:irc:msg:${this.id}`).then(cache => {
      if (cache && this.messages.length === 0) {
        this.messages = JSON.parse(cache);
      }
    }).catch(() => {});
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

  _record (record) {
    this.messages.unshift(record);
    if (this.messages.length > 200) {
      this.messages.length = 200;
    }
    if (!this.dryrun) {
      redis.setWithExpire(`vertex:irc:msg:${this.id}`, JSON.stringify(this.messages), 3600 * 24 * 7)
        .catch(e => logger.error('IRC 记录保存失败\n', e));
    }
  }

  _extractId (channel, link, groups) {
    if (groups.id) return groups.id;
    if (channel.idRegexp) {
      try {
        const match = (link || '').match(new RegExp(channel.idRegexp));
        if (match) return match[1] || match[0];
      } catch (e) {
        logger.error('IRC', this.alias, 'ID 正则错误\n', e);
      }
    }
    const nums = (link || '').match(/\d+/g);
    return nums && nums.length ? nums[nums.length - 1] : '';
  }

  _buildUrl (channel, torrent) {
    if (!channel.downloadTemplate) return torrent.url;
    return channel.downloadTemplate
      .replace(/\{id\}/g, torrent.id || '')
      .replace(/\{rsskey\}/g, channel.rsskey || '')
      .replace(/\{passkey\}/g, channel.passkey || '')
      .replace(/\{link\}/g, torrent.link || '')
      .replace(/\{title\}/g, torrent.title || '');
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
    if (!regRes) return null;
    const groups = regRes.groups || {};
    const title = groups.title || regRes[1];
    const link = groups.link || groups.url || regRes[2] || regRes[3];
    const id = this._extractId(channel, link, groups);
    let url = groups.url || regRes[3];
    if (channel.downloadTemplate) {
      url = this._buildUrl(channel, { id, link, title });
    }
    if (!title || !url) return null;
    return {
      title,
      name: title,
      link: link || url,
      url,
      id,
      size: this._parseSize(groups.size),
      hash: groups.hash || ''
    };
  }

  async _downloadTorrent (url) {
    const res = await util.requestPromise({
      url,
      method: 'GET',
      encoding: null
    });
    const buffer = Buffer.from(res.body, 'utf-8');
    const torrent = bencode.decode(buffer);
    const fsHash = crypto.createHash('sha1');
    fsHash.update(bencode.encode(torrent.info));
    const digest = fsHash.digest();
    let hash = '';
    for (const v of digest) {
      hash += v < 16 ? '0' + v.toString(16) : v.toString(16);
    }
    const dir = path.join(__dirname, '../../torrents');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filepath = path.join(dir, hash + '.torrent');
    fs.writeFileSync(filepath, buffer);
    return { filepath, hash };
  }

  _pickClient () {
    const availableClients = this.clientArr
      .map(item => global.runningClient[item])
      .filter(item => {
        return !!item && !!item.status && !!item.maindata &&
          (!this.maxClientUploadSpeed || this.maxClientUploadSpeed > item.avgUploadSpeed) &&
          (!this.maxClientDownloadSpeed || this.maxClientDownloadSpeed > item.avgDownloadSpeed) &&
          (!this.maxClientDownloadCount || this.maxClientDownloadCount > item.maindata.leechingCount);
      });
    return availableClients
      .filter(item => {
        return (!item.maxDownloadSpeed || item.maxDownloadSpeed > item.avgDownloadSpeed) &&
          (!item.maxUploadSpeed || item.maxUploadSpeed > item.avgUploadSpeed) &&
          (!item.maxLeechNum || item.maxLeechNum > item.maindata.leechingCount) &&
          (!item.minFreeSpace || item.minFreeSpace < item.maindata.freeSpaceOnDisk);
      })
      .sort((a, b) => (this.clientSortBy === 'freeSpaceOnDisk' ? -1 : 1) *
        (a.maindata[this.clientSortBy] - b.maindata[this.clientSortBy])
      )[0] || availableClients[0];
  }

  async _push (torrent) {
    const client = this._pickClient();
    if (!client) {
      logger.error('IRC', this.alias, '无可用下载器');
      return false;
    }
    const dedupKey = `vertex:irc:added:${this.id}:${util.md5(torrent.title)}`;
    if (await redis.get(dedupKey)) {
      logger.debug('IRC', this.alias, '重复播报, 跳过:', torrent.title);
      return false;
    }
    await redis.setWithExpire(dedupKey, '1', 3600 * 24);
    try {
      let hash = torrent.hash;
      if (this.pushTorrentFile) {
        const res = await this._downloadTorrent(torrent.url);
        hash = res.hash;
        await client.addTorrentByTorrentFile(res.filepath, hash, this.skipChecking, this.uploadLimit, this.downloadLimit, this.savePath, this.category, false, this.paused);
      } else {
        await client.addTorrent(torrent.url, hash, this.skipChecking, this.uploadLimit, this.downloadLimit, this.savePath, this.category, false, this.paused);
      }
      if (hash) {
        await util.sleep(1000);
        try {
          await client.addTorrentTag(hash, `${this.alias}_${this.tag}`);
        } catch (e) {
          logger.error('IRC', this.alias, '打标签失败:', torrent.title, '\n', e);
        }
      }
      logger.info('IRC', this.alias, '添加种子成功:', torrent.title);
      return true;
    } catch (e) {
      logger.error('IRC', this.alias, '添加种子失败:', torrent.title, '\n', e);
      return false;
    }
  }

  async _handleTorrent (torrent, channel) {
    const matched = this._fitFilters(torrent);
    const record = {
      time: moment().format('MM-DD HH:mm:ss'),
      channel: channel.channel || '',
      nick: channel.announcer || '',
      title: torrent.title,
      size: torrent.size,
      link: torrent.link,
      url: torrent.url,
      matched,
      pushed: false
    };
    this._record(record);
    if (this.dryrun || !matched) return;
    record.pushed = await this._push(torrent);
  }

  _recordRaw (channel, message) {
    this._record({
      time: moment().format('MM-DD HH:mm:ss'),
      channel: channel.channel || '',
      nick: channel.announcer || '',
      title: message,
      size: 0,
      matched: false,
      parsed: false
    });
  }

  _processMessage (channel, text) {
    if (channel.welcomeText && text === channel.welcomeText) {
      logger.info('IRC', this.alias, '已进入 Announce 频道:', channel.channel);
      return;
    }
    const torrent = this._parseAnnounce(channel, text);
    if (!torrent) {
      this._recordRaw(channel, text);
      return;
    }
    this._handleTorrent(torrent, channel).catch(e => logger.error('IRC', this.alias, '\n', e));
  }

  handleMessage (message) {
    const text = message.args[1];
    if (message.command === 'NOTICE') {
      const notice = text || '';
      if (message.nick === 'NickServ' && notice === 'please choose a different nick.') {
        this.client.say('NickServ', `IDENTIFY ${this.password}`);
      }
      if (message.nick === 'NickServ' && notice.indexOf('Password accepted') !== -1) {
        this._joinChannels();
      }
      const noticeChannel = this.channels.find(item => item.announcer === message.nick);
      if (noticeChannel && notice) {
        this._processMessage(noticeChannel, notice);
      }
      return;
    }
    if (message.command !== 'PRIVMSG' || !text) return;
    const channel = this.channels.find(item => item.announcer === message.nick || item.channel === message.args[0]);
    if (!channel) return;
    this._processMessage(channel, text);
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
      this.client.on('invite', (channel) => {
        logger.info('IRC', this.alias, '收到邀请, 加入频道:', channel);
        this.client.join(channel);
      });
      this.client.on('join', (channel, nick) => {
        if (nick === this.client.nick && this.joinedChannels.indexOf(channel) === -1) {
          this.joinedChannels.push(channel);
          logger.info('IRC', this.alias, '已加入频道:', channel);
        }
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
