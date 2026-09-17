const xml2js = require('xml2js');
const util = require('./util');
const redis = require('./redis');
const logger = require('./logger');

const parseXml = util.promisify(xml2js.parseString);

const _transform = async function (body, config) {
  const rss = await parseXml(body);
  const channel = rss.rss && rss.rss.channel && rss.rss.channel[0];
  if (!channel) return body;
  if (config.titlePrefix) {
    channel.title = [config.titlePrefix + (channel.title ? channel.title[0] : '')];
  }
  let items = channel.item || [];
  if (config.include) {
    const re = new RegExp(config.include, 'i');
    items = items.filter(item => re.test(item.title ? item.title[0] : ''));
  }
  if (config.exclude) {
    const re = new RegExp(config.exclude, 'i');
    items = items.filter(item => !re.test(item.title ? item.title[0] : ''));
  }
  if (+config.maxItems > 0) {
    items = items.slice(0, +config.maxItems);
  }
  channel.item = items;
  const builder = new xml2js.Builder({ xmldec: { version: '1.0', encoding: 'utf-8' } });
  return builder.buildObject(rss);
};

exports.getRss = async function (config) {
  const cacheKey = `vertex:rssproxy:${config.token}`;
  const cache = await redis.get(cacheKey);
  if (cache) return cache;
  const headers = {};
  if (config.cookie) headers.cookie = config.cookie;
  if (config.userAgent) headers['user-agent'] = config.userAgent;
  const res = await util.requestPromise({
    url: config.url,
    method: 'GET',
    headers
  });
  let body = res.body;
  if (typeof body !== 'string') {
    body = Buffer.isBuffer(body) ? body.toString('utf-8') : (body + '');
  }
  const isHTML = body.indexOf('xml-viewer-style') !== -1;
  if (isHTML) {
    const match = body.match(/<rss[\s\S]*<\/rss>/);
    if (match) body = '<?xml version="1.0" encoding="utf-8"?>\n' + match[0];
  }
  if (config.include || config.exclude || +config.maxItems > 0 || config.titlePrefix) {
    try {
      body = await _transform(body, config);
    } catch (e) {
      logger.error('RSS 代理转换失败, 返回原始内容\n', e);
    }
  }
  const ttl = +config.ttl > 0 ? +config.ttl : 300;
  await redis.setWithExpire(cacheKey, body, ttl);
  return body;
};
