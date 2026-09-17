<template>
  <div style="font-size: 24px; font-weight: bold;">RSS 代理</div>
  <a-divider></a-divider>
  <div class="rss-proxy">
    <a-alert
      message="说明"
      type="info"
      style="margin-bottom: 12px; text-align: left;">
      <template #description>
        把源 RSS 通过本代理转发, 访问地址由「密钥」加密生成 (隐藏源地址中的 passkey), 可设置缓存时间与过滤规则, 方便其他脚本调用。
        <br>
        代理地址格式: <code>http://&lt;面板地址&gt;/rss/&lt;加密串&gt;.xml</code>
      </template>
    </a-alert>
    <a-table
      :style="`font-size: ${isMobile() ? '12px': '14px'};`"
      :columns="columns"
      size="small"
      :data-source="proxyList"
      :pagination="false"
      :scroll="{ x: 720 }"
    >
      <template #title>
        <span style="font-size: 16px; font-weight: bold;">RSS 代理列表</span>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'enable'">
          <a-switch @change="enableTask(record)" v-model:checked="record.enable" checked-children="启用" un-checked-children="禁用"/>
        </template>
        <template v-if="column.dataIndex === 'proxyUrl'">
          <a @click="copyUrl(record)">复制地址</a>
        </template>
        <template v-if="column.title === '操作'">
          <span>
            <a @click="modifyClick(record)">编辑</a>
            <a-divider type="vertical" />
            <a-popover title="删除?" trigger="click" :overlayStyle="{ width: '84px', overflow: 'hidden' }">
              <template #content>
                <a-button type="primary" danger @click="deleteProxy(record)" size="small">删除</a-button>
              </template>
              <a style="color: red">删除</a>
            </a-popover>
          </span>
        </template>
      </template>
    </a-table>
    <a-divider></a-divider>
    <div style="font-size: 16px; font-weight: bold; padding-left: 8px;">新增 | 编辑 RSS 代理</div>
    <div style="text-align: left; ">
      <a-form
        labelAlign="right"
        :labelWrap="true"
        :model="proxy"
        size="small"
        @finish="modifyProxy"
        :labelCol="{ span: 3 }"
        :wrapperCol="{ span: 21 }"
        autocomplete="off"
        :class="`container-form-${ isMobile() ? 'mobile' : 'pc' }`">
        <a-form-item
          label="别名"
          name="alias"
          extra="给代理取一个好记的名字"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-input size="small" v-model:value="proxy.alias"/>
        </a-form-item>
        <a-form-item
          label="启用"
          name="enable">
          <a-checkbox v-model:checked="proxy.enable">启用</a-checkbox>
        </a-form-item>
        <a-form-item
          label="源 RSS 地址"
          name="url"
          extra="需要代理的原始 RSS 链接, 可包含 passkey"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-input size="small" v-model:value="proxy.url"/>
        </a-form-item>
        <a-form-item
          label="密钥"
          name="secret"
          extra="用于生成加密访问路径, 修改后代理地址会变化"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-input size="small" v-model:value="proxy.secret"/>
        </a-form-item>
        <a-form-item
          label="缓存时间"
          name="ttl"
          extra="单位秒, 留空默认 300">
          <a-input size="small" v-model:value="proxy.ttl"/>
        </a-form-item>
        <a-form-item
          label="Cookie"
          name="cookie"
          extra="部分站点需要 Cookie 才能获取 RSS, 可留空">
          <a-input size="small" v-model:value="proxy.cookie"/>
        </a-form-item>
        <a-form-item
          label="User-Agent"
          name="userAgent"
          extra="可留空">
          <a-input size="small" v-model:value="proxy.userAgent"/>
        </a-form-item>
        <a-form-item
          label="包含关键词"
          name="include"
          extra="正则, 仅保留标题匹配的条目, 可留空">
          <a-input size="small" v-model:value="proxy.include"/>
        </a-form-item>
        <a-form-item
          label="排除关键词"
          name="exclude"
          extra="正则, 排除标题匹配的条目, 可留空">
          <a-input size="small" v-model:value="proxy.exclude"/>
        </a-form-item>
        <a-form-item
          label="最大条数"
          name="maxItems"
          extra="仅保留前 N 条, 0 或留空为不限制">
          <a-input size="small" v-model:value="proxy.maxItems"/>
        </a-form-item>
        <a-form-item
          label="标题前缀"
          name="titlePrefix"
          extra="为频道标题添加前缀, 可留空">
          <a-input size="small" v-model:value="proxy.titlePrefix"/>
        </a-form-item>
        <a-form-item
          v-if="proxy.token"
          label="代理地址"
          name="proxyUrl">
          <a-input-group compact>
            <a-input size="small" readonly :value="getProxyUrl(proxy)" style="width: calc(100% - 72px);"/>
            <a-button size="small" type="primary" style="width: 72px;" @click="copyUrl(proxy)">复制</a-button>
          </a-input-group>
        </a-form-item>
        <a-form-item
          :wrapperCol="isMobile() ? { span:24 } : { span: 21, offset: 3 }">
          <a-button type="primary" html-type="submit" style="margin-top: 24px; margin-bottom: 48px;">应用 | 完成</a-button>
          <a-button style="margin-left: 12px; margin-top: 24px; margin-bottom: 48px;" @click="clearProxy()">清空</a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
</template>
<script>
export default {
  data () {
    const columns = [
      {
        title: 'ID',
        dataIndex: 'id',
        width: 18,
        fixed: true
      }, {
        title: '别名',
        dataIndex: 'alias',
        sorter: (a, b) => a.alias.localeCompare(b.alias),
        defaultSortOrder: 'ascend',
        width: 24
      }, {
        title: '源地址',
        dataIndex: 'url',
        width: 60
      }, {
        title: '代理地址',
        dataIndex: 'proxyUrl',
        width: 20
      }, {
        title: '启用',
        dataIndex: 'enable',
        width: 14
      }, {
        title: '操作',
        width: 20
      }
    ];
    return {
      columns,
      proxyList: [],
      proxy: {},
      defaultProxy: {
        alias: '',
        enable: false,
        url: '',
        secret: '',
        ttl: 300,
        cookie: '',
        userAgent: '',
        include: '',
        exclude: '',
        maxItems: 0,
        titlePrefix: ''
      },
      loading: true
    };
  },
  methods: {
    isMobile () {
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        return true;
      } else {
        return false;
      }
    },
    getProxyUrl (record) {
      return window.location.origin + '/rss/' + record.token + '.xml';
    },
    copyText (text) {
      const input = document.createElement('textarea');
      input.value = text;
      input.style.position = 'fixed';
      input.style.top = '-1000px';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.focus();
      input.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (e) {
        ok = false;
      }
      document.body.removeChild(input);
      return ok;
    },
    async copyUrl (record) {
      const url = this.getProxyUrl(record);
      let ok = false;
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(url);
          ok = true;
        } catch (e) {
          ok = this.copyText(url);
        }
      } else {
        ok = this.copyText(url);
      }
      if (ok) {
        this.$message().success('已复制代理地址');
      } else {
        this.$message().warning('复制失败, 请手动复制: ' + url);
      }
    },
    async listProxy () {
      try {
        const res = await this.$api().rssProxy.list();
        this.proxyList = res.data;
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    async modifyProxy () {
      try {
        const res = await this.$api().rssProxy.modify({ ...this.proxy });
        this.$message().success((this.proxy.id ? '编辑' : '新增') + '成功, 代理地址已生成');
        if (res.data && res.data.token) {
          this.proxy = { ...res.data };
        }
        setTimeout(() => this.listProxy(), 1000);
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    async enableTask (record) {
      try {
        await this.$api().rssProxy.modify({ ...record });
        this.$message().success('修改成功, 列表正在刷新...');
        setTimeout(() => this.listProxy(), 1000);
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    modifyClick (row) {
      this.proxy = { ...row };
    },
    async deleteProxy (row) {
      try {
        await this.$api().rssProxy.delete(row.id);
        this.$message().success('删除成功, 列表正在刷新...');
        await this.listProxy();
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    clearProxy () {
      this.proxy = JSON.parse(JSON.stringify(this.defaultProxy));
    }
  },
  async mounted () {
    this.clearProxy();
    this.listProxy();
  }
};
</script>
<style scoped>
.rss-proxy {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
}
</style>
