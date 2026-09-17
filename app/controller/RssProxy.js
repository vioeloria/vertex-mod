const logger = require('../libs/logger');
const util = require('../libs/util');
const rssProxy = require('../libs/rssProxy');
const RssProxyMod = require('../model/RssProxyMod');

const rssProxyMod = new RssProxyMod();

class RssProxy {
  async add (req, res) {
    const options = req.body;
    try {
      const r = rssProxyMod.add(options);
      res.send({
        success: true,
        message: '添加 RSS 代理成功',
        data: r
      });
    } catch (e) {
      logger.error(e);
      res.send({
        success: false,
        message: e.message
      });
    }
  };

  async delete (req, res) {
    const options = req.body;
    try {
      const r = rssProxyMod.delete(options);
      res.send({
        success: true,
        message: r
      });
    } catch (e) {
      logger.error(e);
      res.send({
        success: false,
        message: e.message
      });
    }
  };

  async modify (req, res) {
    const options = req.body;
    try {
      const r = rssProxyMod.modify(options);
      res.send({
        success: true,
        message: '修改 RSS 代理成功',
        data: r
      });
    } catch (e) {
      logger.error(e);
      res.send({
        success: false,
        message: e.message
      });
    }
  };

  async list (req, res) {
    try {
      const r = rssProxyMod.list();
      res.send({
        success: true,
        data: r
      });
    } catch (e) {
      logger.error(e);
      res.send({
        success: false,
        message: e.message
      });
    }
  };

  async proxy (req, res) {
    const token = (req.params.token || '').replace(/\.xml$/i, '');
    const config = util.listRssProxy().filter(item => item.enable).find(item => item.token === token);
    if (!config) {
      res.status(404).set('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Not Found');
    }
    try {
      const xml = await rssProxy.getRss(config);
      res.set('Content-Type', 'application/rss+xml; charset=utf-8');
      res.send(xml);
    } catch (e) {
      logger.error('RSS 代理请求失败\n', e);
      res.status(500).set('Content-Type', 'text/plain; charset=utf-8');
      res.end(e.message);
    }
  };
}
module.exports = RssProxy;
