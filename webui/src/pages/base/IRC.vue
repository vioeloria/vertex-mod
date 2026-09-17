<template>
  <div style="font-size: 24px; font-weight: bold;">IRC 自动下载</div>
  <a-divider></a-divider>
  <div class="irc">
    <a-alert
      message="说明"
      type="info"
      style="margin-bottom: 12px; text-align: left;">
      <template #description>
        连接 PT 站 IRC 播报频道, 匹配到符合过滤器的种子后自动推送到下载器 (类似 autobrr)。
        <br>
        频道正则需包含标题与链接, 推荐使用命名分组: <code>(?&lt;title&gt;.*?)</code> / <code>(?&lt;link&gt;https://\S+)</code> / <code>(?&lt;url&gt;https://\S+)</code> / <code>(?&lt;size&gt;.*?)</code> / <code>(?&lt;id&gt;\d+)</code> / <code>(?&lt;hash&gt;[0-9a-f]{40})</code>。
        <br>
        多数站点播报只给详情页链接, 用「下载地址模板」拼出真实下载地址, 占位符: <code>{id}</code> <code>{rsskey}</code> <code>{passkey}</code> <code>{link}</code> <code>{title}</code>。
        例如 <code>https://www.torrentleech.org/rss/download/{id}/{rsskey}/test.torrent</code> 或 <code>https://pt.keepfrds.com/download.php?id={id}&amp;passkey={passkey}</code>。
      </template>
    </a-alert>
    <a-table
      :style="`font-size: ${isMobile() ? '12px': '14px'};`"
      :columns="columns"
      size="small"
      :data-source="ircList"
      :pagination="false"
      :scroll="{ x: 640 }"
    >
      <template #title>
        <span style="font-size: 16px; font-weight: bold;">IRC 任务列表</span>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'enable'">
          <a-switch @change="enableTask(record)" v-model:checked="record.enable" checked-children="启用" un-checked-children="禁用"/>
        </template>
        <template v-if="column.dataIndex === 'status'">
          <a-tag color="success" v-if="record.status">已连接</a-tag>
          <a-tag color="error" v-if="!record.status">未连接</a-tag>
        </template>
        <template v-if="column.dataIndex === 'channels'">
          {{ (record.channels || []).length }}
        </template>
        <template v-if="column.dataIndex === 'client'">
          {{ downloaders.filter(item => (record.clientArr || []).indexOf(item.id) !== -1).map(item => item.alias).join(' / ') }}
        </template>
        <template v-if="column.title === '操作'">
          <span>
            <a @click="previewIrc(record)">预览</a>
            <a-divider type="vertical" />
            <a @click="modifyClick(record)">编辑</a>
            <a-divider type="vertical" />
            <a @click="cloneClick(record)">克隆</a>
            <a-divider type="vertical" />
            <a-popover title="删除?" trigger="click" :overlayStyle="{ width: '84px', overflow: 'hidden' }">
              <template #content>
                <a-button type="primary" danger @click="deleteIrc(record)" size="small">删除</a-button>
              </template>
              <a style="color: red">删除</a>
            </a-popover>
          </span>
        </template>
      </template>
    </a-table>
    <a-divider></a-divider>
    <div style="font-size: 16px; font-weight: bold; padding-left: 8px;">新增 | 编辑 IRC 任务</div>
    <div style="text-align: left; ">
      <a-form
        labelAlign="right"
        :labelWrap="true"
        :model="irc"
        size="small"
        @finish="modifyIrc"
        :labelCol="{ span: 3 }"
        :wrapperCol="{ span: 21 }"
        autocomplete="off"
        :class="`container-form-${ isMobile() ? 'mobile' : 'pc' }`">
        <a-form-item
          label="别名"
          name="alias"
          extra="给 IRC 任务取一个好记的名字, 该名字也会作为辅种/自动下载的标签前缀"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-input size="small" v-model:value="irc.alias"/>
        </a-form-item>
        <a-form-item
          label="启用"
          name="enable"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-checkbox v-model:checked="irc.enable">启用</a-checkbox>
        </a-form-item>
        <a-form-item
          label="服务器"
          name="host"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-input size="small" v-model:value="irc.host" placeholder="irc.example.com"/>
        </a-form-item>
        <a-form-item
          label="端口"
          name="port"
          extra="SSL 端口一般为 6697">
          <a-input size="small" v-model:value="irc.port"/>
        </a-form-item>
        <a-form-item
          label="昵称"
          name="nick"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-input size="small" v-model:value="irc.nick"/>
        </a-form-item>
        <a-form-item
          label="用户名"
          name="user"
          extra="留空则与昵称相同">
          <a-input size="small" v-model:value="irc.user"/>
        </a-form-item>
        <a-form-item
          label="密码"
          name="password"
          extra="NickServ 密码, 没有可留空">
          <a-input size="small" v-model:value="irc.password"/>
        </a-form-item>
        <a-form-item
          label="SSL"
          name="secure"
          extra="是否使用 SSL 连接, 默认开启">
          <a-checkbox v-model:checked="irc.secure">启用 SSL</a-checkbox>
        </a-form-item>
        <a-form-item
          label="频道"
          name="channels"
          extra="播报频道配置, 可添加多个">
          <a-form-item-rest v-for="(channel, index) in irc.channels" :key="index">
            <div style="border: 1px solid #eee; border-radius: 4px; padding: 8px; margin-bottom: 8px;">
              <a-input size="small" v-model:value="channel.channel" placeholder="频道名, 如 #announce" style="margin-bottom: 6px;"/>
              <a-input size="small" v-model:value="channel.announcer" placeholder="播报者昵称, 如 Announce" style="margin-bottom: 6px;"/>
              <a-input size="small" v-model:value="channel.key" placeholder="频道密码(可选)" style="margin-bottom: 6px;"/>
              <a-input size="small" v-model:value="channel.welcomeText" placeholder="欢迎语(可选, 用于确认已进入频道)" style="margin-bottom: 6px;"/>
              <a-input size="small" v-model:value="channel.enterCommand" placeholder="进入指令(可选, 如 ENTER #channel user key)" style="margin-bottom: 6px;"/>
              <a-input size="small" v-model:value="channel.regexp" placeholder="播报正则, 如 Name:'(?<title>.*?)'.*?(?<link>https://\S+)" style="margin-bottom: 6px;"/>
              <a-input size="small" v-model:value="channel.idRegexp" placeholder="从链接提取ID的正则(可选, 如 /torrent/(\d+))" style="margin-bottom: 6px;"/>
              <a-input size="small" v-model:value="channel.downloadTemplate" placeholder="下载地址模板, 如 https://www.torrentleech.org/rss/download/{id}/{rsskey}/test.torrent" style="margin-bottom: 6px;"/>
              <a-input size="small" v-model:value="channel.rsskey" placeholder="rsskey (可选)" style="margin-bottom: 6px;"/>
              <a-input size="small" v-model:value="channel.passkey" placeholder="passkey (可选)" style="margin-bottom: 6px;"/>
              <a-button type="danger" size="small" style="margin-top: 6px;" @click="() => irc.channels = irc.channels.filter((i, idx) => idx !== index)">删除频道</a-button>
            </div>
          </a-form-item-rest>
          <a-button size="small" type="primary" @click="irc.channels.push({ channel: '', announcer: '', key: '', welcomeText: '', enterCommand: '', regexp: '', idRegexp: '', downloadTemplate: '', rsskey: '', passkey: '' })">添加频道</a-button>
        </a-form-item>
        <a-form-item
          label="拒绝规则"
          name="rejectRules"
          extra="命中任一拒绝规则则不推送 (来自「规则组件 - RSS 规则」)">
          <a-checkbox-group style="width: 100%;" v-model:value="irc.rejectRules">
            <a-row>
              <a-col v-for="rule of rssRules" :span="8" :key="rule.id">
                <a-checkbox v-model:value="rule.id">{{ rule.alias }}</a-checkbox>
              </a-col>
            </a-row>
          </a-checkbox-group>
        </a-form-item>
        <a-form-item
          label="选择规则"
          name="acceptRules"
          extra="需命中任一选择规则才推送, 不选则不限制 (来自「规则组件 - RSS 规则」)">
          <a-checkbox-group style="width: 100%;" v-model:value="irc.acceptRules">
            <a-row>
              <a-col v-for="rule of rssRules" :span="8" :key="rule.id">
                <a-checkbox v-model:value="rule.id">{{ rule.alias }}</a-checkbox>
              </a-col>
            </a-row>
          </a-checkbox-group>
        </a-form-item>
        <a-form-item
          label="过滤器"
          name="filters"
          extra="IRC 内联过滤器, 全部条件均满足时才会自动下载; 不添加则下载所有播报">
          <a-form-item-rest v-for="(filter, index) in irc.filters" :key="index">
            <a-input-group compact style="margin-bottom: 6px;">
              <a-input size="small" v-model:value="filter.key" placeholder="字段, 如 title/size/link/url" style="width: 28%;"/>
              <a-select size="small" v-model:value="filter.compareType" style="width: 26%;">
                <a-select-option value="equals">等于</a-select-option>
                <a-select-option value="bigger">大于</a-select-option>
                <a-select-option value="smaller">小于</a-select-option>
                <a-select-option value="contain">包含</a-select-option>
                <a-select-option value="includeIn">包含于</a-select-option>
                <a-select-option value="notContain">不包含</a-select-option>
                <a-select-option value="notIncludeIn">不包含于</a-select-option>
                <a-select-option value="regExp">正则匹配</a-select-option>
                <a-select-option value="notRegExp">正则不匹配</a-select-option>
              </a-select>
              <a-input size="small" v-model:value="filter.value" placeholder="值" style="width: 34%;"/>
              <a-button type="danger" size="small" style="width: 12%;" @click="() => irc.filters = irc.filters.filter((i, idx) => idx !== index)">删除</a-button>
            </a-input-group>
          </a-form-item-rest>
          <a-button size="small" type="primary" @click="irc.filters.push({ key: 'title', compareType: 'regExp', value: '' })">添加过滤器</a-button>
        </a-form-item>
        <a-form-item
          label="下载器"
          name="clientArr"
          extra="匹配到的种子按负载均衡推送到这些下载器"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-checkbox-group style="width: 100%;" v-model:value="irc.clientArr">
            <a-row>
              <a-col v-for="downloader of downloaders" :span="8" :key="downloader.id">
                <a-checkbox :disabled="!downloader.enable && !irc.clientArr.includes(downloader.id)" v-model:value="downloader.id">{{ downloader.alias }}</a-checkbox>
              </a-col>
            </a-row>
          </a-checkbox-group>
        </a-form-item>
        <a-form-item
          label="排序规则"
          name="clientSortBy"
          extra="负载均衡时按该字段选择下载器 (剩余空间为从大到小)">
          <a-select size="small" v-model:value="irc.clientSortBy">
            <a-select-option value="leechingCount">下载种子数量</a-select-option>
            <a-select-option value="uploadSpeed">当前上传速度</a-select-option>
            <a-select-option value="downloadSpeed">当前下载速度</a-select-option>
            <a-select-option value="freeSpaceOnDisk">当前剩余空间</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item
          label="下载器最高上传速度"
          name="maxClientUploadSpeed"
          extra="下载器上传速度高于此值时不选择, 留空或 0 不启用">
          <a-input size="small" v-model:value="irc.maxClientUploadSpeed"/>
        </a-form-item>
        <a-form-item
          label="下载器最高下载速度"
          name="maxClientDownloadSpeed"
          extra="下载器下载速度高于此值时不选择, 留空或 0 不启用">
          <a-input size="small" v-model:value="irc.maxClientDownloadSpeed"/>
        </a-form-item>
        <a-form-item
          label="下载器下载任务上限"
          name="maxClientDownloadCount"
          extra="下载器下载任务数高于此值时不选择, 留空或 0 不启用">
          <a-input size="small" v-model:value="irc.maxClientDownloadCount"/>
        </a-form-item>
        <a-form-item
          label="保存路径"
          name="savePath">
          <a-input size="small" v-model:value="irc.savePath"/>
        </a-form-item>
        <a-form-item
          label="分类"
          name="category">
          <a-input size="small" v-model:value="irc.category"/>
        </a-form-item>
        <a-form-item
          label="限制上传速度"
          name="uploadLimit"
          extra="0 为不限速">
          <a-input size="small" v-model:value="irc.uploadLimit">
            <template #addonAfter>
              <a-select size="small" v-model:value="irc.uploadLimitUnit" style="width: 120px">
                <a-select-option value="KiB">KiB/s</a-select-option>
                <a-select-option value="MiB">MiB/s</a-select-option>
                <a-select-option value="GiB">GiB/s</a-select-option>
              </a-select>
            </template>
          </a-input>
        </a-form-item>
        <a-form-item
          label="限制下载速度"
          name="downloadLimit"
          extra="0 为不限速">
          <a-input size="small" v-model:value="irc.downloadLimit">
            <template #addonAfter>
              <a-select size="small" v-model:value="irc.downloadLimitUnit" style="width: 120px">
                <a-select-option value="KiB">KiB/s</a-select-option>
                <a-select-option value="MiB">MiB/s</a-select-option>
                <a-select-option value="GiB">GiB/s</a-select-option>
              </a-select>
            </template>
          </a-input>
        </a-form-item>
        <a-form-item
          label="跳过校验"
          name="skipChecking"
          extra="添加种子时跳过校验, 直接开始">
          <a-checkbox v-model:checked="irc.skipChecking">跳过校验</a-checkbox>
        </a-form-item>
        <a-form-item
          label="推送种子文件"
          name="pushTorrentFile"
          extra="勾选后先下载种子文件再推送(适合需要 Cookie 的站点), 否则直接推送种子链接">
          <a-checkbox v-model:checked="irc.pushTorrentFile">推送种子文件</a-checkbox>
        </a-form-item>
        <a-form-item
          label="获取实际大小"
          name="checkSize"
          extra="推送前先下载种子文件并解析 bencode 得到真实文件大小, 用于过滤器中的 size 条件 (会多一次下载请求)">
          <a-checkbox v-model:checked="irc.checkSize">获取种子实际大小</a-checkbox>
        </a-form-item>
        <a-form-item
          label="添加时暂停"
          name="paused">
          <a-checkbox v-model:checked="irc.paused">添加种子时暂停</a-checkbox>
        </a-form-item>
        <a-form-item
          label="快速汇报"
          name="quickReannounce"
          extra="添加种子后 N 秒自动向 tracker 汇报一次, 尽快获得 peers; 0 关闭 (需开启「推送种子文件」或「获取实际大小」才能拿到真实 hash)">
          <a-input size="small" v-model:value="irc.quickReannounce"/>
        </a-form-item>
        <a-form-item
          label="标签"
          name="tag"
          extra="添加种子后打的标签, 完整标签为 别名_标签">
          <a-input size="small" v-model:value="irc.tag"/>
        </a-form-item>
        <a-form-item
          :wrapperCol="isMobile() ? { span:24 } : { span: 21, offset: 3 }">
          <a-button type="primary" html-type="submit" style="margin-top: 24px; margin-bottom: 48px;">应用 | 完成</a-button>
          <a-button style="margin-left: 12px; margin-top: 24px; margin-bottom: 48px;" @click="clearIrc()">清空</a-button>
          <a-button type="primary" style="margin-left: 12px; margin-top: 24px; margin-bottom: 48px;" :loading="testing" @click="testIrc()">测试连接并预览</a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
  <a-modal
    v-model:visible="previewVisible"
    title="IRC 连接测试 / 频道预览"
    width="1200px"
    :footer="null"
    @cancel="closePreview()">
    <div style="text-align: left; ">
      <a-alert type="info" style="margin-bottom: 12px;">
        <template #description>
          连接状态: <b>{{ previewData.status ? '已连接' : '未连接' }}</b>
          &nbsp;|&nbsp; 已加入频道: <b>{{ (previewData.joinedChannels || []).join(', ') || '无' }}</b>
          &nbsp;|&nbsp; 共 {{ (previewData.messages || []).length }} 条记录
        </template>
      </a-alert>
      <a-table
        :columns="messageColumns"
        size="small"
        :data-source="previewData.messages"
        :pagination="{ pageSize: 10 }"
        :scroll="{ x: 900 }"
        row-key="time">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'size'">
            {{ record.size ? $formatSize(record.size) : '-' }}
          </template>
          <template v-if="column.dataIndex === 'matched'">
            <a-tag :color="record.matched ? 'success' : 'default'">{{ record.matched ? '匹配' : '未匹配' }}</a-tag>
          </template>
          <template v-if="column.dataIndex === 'pushed'">
            <a-tag color="success" v-if="record.pushed">已推送</a-tag>
            <a-tag color="orange" v-else-if="record.parsed === false">原始消息</a-tag>
            <a-tag v-else>未推送</a-tag>
          </template>
        </template>
      </a-table>
    </div>
  </a-modal>
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
        title: '服务器',
        dataIndex: 'host',
        width: 30
      }, {
        title: '频道数',
        dataIndex: 'channels',
        width: 14
      }, {
        title: '下载器',
        dataIndex: 'client',
        width: 24
      }, {
        title: '状态',
        dataIndex: 'status',
        width: 14
      }, {
        title: '启用',
        dataIndex: 'enable',
        width: 14
      }, {
        title: '操作',
        width: 28
      }
    ];
    const messageColumns = [
      {
        title: '时间',
        dataIndex: 'time',
        width: 110
      }, {
        title: '频道',
        dataIndex: 'channel',
        width: 130
      }, {
        title: '标题 / 内容',
        dataIndex: 'title'
      }, {
        title: '大小',
        dataIndex: 'size',
        width: 90
      }, {
        title: '匹配',
        dataIndex: 'matched',
        width: 70
      }, {
        title: '备注',
        dataIndex: 'note',
        width: 150
      }, {
        title: '状态',
        dataIndex: 'pushed',
        width: 80
      }
    ];
    return {
      columns,
      messageColumns,
      ircList: [],
      downloaders: [],
      rssRules: [],
      irc: {},
      previewVisible: false,
      previewId: null,
      previewTimer: null,
      previewData: {
        status: false,
        joinedChannels: [],
        messages: []
      },
      testing: false,
      defaultIrc: {
        alias: '',
        enable: false,
        host: '',
        port: 6697,
        nick: '',
        user: '',
        password: '',
        secure: true,
        channels: [],
        filters: [],
        acceptRules: [],
        rejectRules: [],
        clientArr: [],
        clientSortBy: 'leechingCount',
        maxClientUploadSpeed: '',
        maxClientDownloadSpeed: '',
        maxClientDownloadCount: '',
        savePath: '',
        category: '',
        uploadLimit: '',
        uploadLimitUnit: 'KiB',
        downloadLimit: '',
        downloadLimitUnit: 'KiB',
        skipChecking: false,
        pushTorrentFile: false,
        checkSize: false,
        quickReannounce: 0,
        paused: false,
        tag: 'IRC'
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
    async listIrc () {
      try {
        const res = await this.$api().irc.list();
        this.ircList = res.data;
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    async listDownloader () {
      try {
        const res = await this.$api().downloader.list();
        this.downloaders = res.data.sort((a, b) => a.alias.localeCompare(b.alias));
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    async listRssRule () {
      try {
        const res = await this.$api().rssRule.list();
        this.rssRules = res.data.sort((a, b) => a.alias.localeCompare(b.alias));
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    async modifyIrc () {
      try {
        await this.$api().irc.modify({ ...this.irc });
        this.$message().success((this.irc.id ? '编辑' : '新增') + '成功, 列表正在刷新...');
        setTimeout(() => this.listIrc(), 1000);
        this.clearIrc();
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    async enableTask (record) {
      try {
        await this.$api().irc.modify({ ...record });
        this.$message().success('修改成功, 列表正在刷新...');
        setTimeout(() => this.listIrc(), 1000);
        this.clearIrc();
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    modifyClick (row) {
      this.irc = JSON.parse(JSON.stringify(row));
      this.irc.channels = this.irc.channels || [];
      this.irc.filters = this.irc.filters || [];
      this.irc.acceptRules = this.irc.acceptRules || [];
      this.irc.rejectRules = this.irc.rejectRules || [];
      this.irc.clientArr = this.irc.clientArr || (this.irc.client ? [this.irc.client] : []);
    },
    cloneClick (row) {
      this.irc = JSON.parse(JSON.stringify(row));
      this.irc.id = null;
      this.irc.alias = this.irc.alias + '-克隆';
    },
    async deleteIrc (row) {
      try {
        await this.$api().irc.delete(row.id);
        this.$message().success('删除成功, 列表正在刷新...');
        await this.listIrc();
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    clearIrc () {
      this.irc = JSON.parse(JSON.stringify(this.defaultIrc));
    },
    async testIrc () {
      this.testing = true;
      try {
        const res = await this.$api().irc.test({ ...this.irc, testSeconds: 20 });
        this.previewId = null;
        this.previewData = res.data;
        this.previewVisible = true;
      } catch (e) {
        this.$message().error(e.message);
      } finally {
        this.testing = false;
      }
    },
    async previewIrc (row) {
      this.previewId = row.id;
      this.previewData = { status: row.status, joinedChannels: [], messages: [] };
      this.previewVisible = true;
      await this.loadMessages();
      if (this.previewTimer) clearInterval(this.previewTimer);
      this.previewTimer = setInterval(() => this.loadMessages(), 3000);
    },
    async loadMessages () {
      if (!this.previewId) return;
      try {
        const res = await this.$api().irc.messages(this.previewId);
        this.previewData = res.data;
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    closePreview () {
      this.previewVisible = false;
      this.previewId = null;
      if (this.previewTimer) {
        clearInterval(this.previewTimer);
        this.previewTimer = null;
      }
    }
  },
  async mounted () {
    this.clearIrc();
    this.listDownloader();
    this.listRssRule();
    this.listIrc();
  },
  beforeUnmount () {
    if (this.previewTimer) clearInterval(this.previewTimer);
  }
};
</script>
<style scoped>
.irc {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
}
</style>
