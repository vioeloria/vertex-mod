<template>
  <div style="font-size: 24px; font-weight: bold;">RSS 任务</div>
  <a-divider></a-divider>
  <div class="rss">
    <a-table
      :style="`font-size: ${isMobile() ? '12px': '14px'};`"
      :columns="columns"
      size="small"
      :data-source="rssList"
      :pagination="false"
      :scroll="{ x: 640 }"
    >
      <template #title>
        <span style="font-size: 16px; font-weight: bold;">RSS 任务列表</span>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'enable'">
          <a-switch @change="enableTask(record)" v-model:checked="record.enable" checked-children="启用" un-checked-children="禁用"/>
        </template>
        <template v-if="column.dataIndex === 'clientArr'">
          {{ downloaders.filter(item => record.clientArr.indexOf(item.id) !== -1).map(item => item.alias).join(' / ') }}
        </template>
        <template v-if="column.dataIndex === 'pushNotify'">
          <a-tag color="success" v-if="record.pushNotify">启用</a-tag>
          <a-tag color="error" v-if="!record.pushNotify">禁用</a-tag>
        </template>
        <template v-if="column.title === '操作'">
          <span>
            <a @click="modifyClick(record)">编辑</a>
            <a-divider type="vertical" />
            <a @click="cloneClick(record)">克隆</a>
            <a-divider type="vertical" />
            <a-popover title="删除?" trigger="click" :overlayStyle="{ width: '84px', overflow: 'hidden' }">
              <template #content>
                <a-button type="primary" danger @click="deleteRss(record)" size="small">删除</a-button>
              </template>
              <a style="color: red">删除</a>
            </a-popover>
          </span>
        </template>
      </template>
    </a-table>
    <a-divider></a-divider>
    <div style="font-size: 16px; font-weight: bold; padding-left: 8px;">新增 | 编辑RSS 任务</div>
    <div style="text-align: left; ">
      <a-form
        labelAlign="right"
        :labelWrap="true"
        :model="rss"
        size="small"
        @finish="modifyRss"
        :labelCol="{ span: 3 }"
        :wrapperCol="{ span: 21 }"
        autocomplete="off"
        :class="`container-form-${ isMobile() ? 'mobile' : 'pc' }`">
        <a-form-item
          label="别名"
          name="alias"
          extra="给 RSS 任务取一个好记的名字"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-input size="small" v-model:value="rss.alias"/>
        </a-form-item>
        <a-form-item
          label="启用"
          name="enable"
          extra="选择是否启用 RSS 任务"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-checkbox v-model:checked="rss.enable">启用</a-checkbox>
        </a-form-item>
        <a-form-item
          label="下载器"
          name="clientArr"
          extra="选择下载器, 仅可选择已经启用的下载器"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-checkbox-group style="width: 100%;" v-model:value="rss.clientArr">
            <a-row>
              <a-col v-for="downloader of downloaders" :span="8" :key="downloader.id">
                <a-checkbox :disabled="!downloader.enable && !rss.clientArr.includes(downloader.id)" v-model:value="downloader.id">{{ downloader.alias }}</a-checkbox>
              </a-col>
            </a-row>
          </a-checkbox-group>
        </a-form-item>
        <a-form-item
          label="排序规则"
          name="clientSortBy"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-select size="small" v-model:value="rss.clientSortBy">
            <a-select-option value="leechingCount">下载种子数量</a-select-option>
            <a-select-option value="uploadSpeed">当前上传速度</a-select-option>
            <a-select-option value="downloadSpeed">当前下载速度</a-select-option>
            <a-select-option value="freeSpaceOnDisk">当前剩余空间</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item
          label="下载器最高上传速度"
          name="maxClientUploadSpeed"
          extra="下载器上传速度在此速度之上时, 不添加种子, 留空或 0 不启用">
          <a-input size="small" v-model:value="rss.maxClientUploadSpeed">
            <template #addonAfter>
              <a-select size="small" v-model:value="rss.maxClientUploadSpeedUnit" placeholder="选择单位" style="width: 120px">
                <a-select-option value="KiB">KiB/s</a-select-option>
                <a-select-option value="MiB">MiB/s</a-select-option>
                <a-select-option value="GiB">GiB/s</a-select-option>
              </a-select>
            </template>
          </a-input>
        </a-form-item>
        <a-form-item
          label="下载器最高下载速度"
          name="maxClientDownloadSpeed"
          extra="下载器下载速度在此速度之上时, 不添加种子, 留空或 0 不启用">
          <a-input size="small" v-model:value="rss.maxClientDownloadSpeed">
            <template #addonAfter>
              <a-select size="small" v-model:value="rss.maxClientDownloadSpeedUnit" placeholder="选择单位" style="width: 120px">
                <a-select-option value="KiB">KiB/s</a-select-option>
                <a-select-option value="MiB">MiB/s</a-select-option>
                <a-select-option value="GiB">GiB/s</a-select-option>
              </a-select>
            </template>
          </a-input>
        </a-form-item>
        <a-form-item
          label="下载器下载任务上限"
          name="maxClientDownloadCount"
          extra="下载器下载任务之上时, 不添加种子, 留空或 0 不启用">
          <a-input size="small" v-model:value="rss.maxClientDownloadCount">
          </a-input>
        </a-form-item>
        <a-form-item
          label="RSS 代理"
          name="rssProxy"
          extra="从已启用的 RSS 代理中选择, 自动把代理地址加入下方 RssUrl 列表, 统一走程序内部缓存, 避免频繁访问站点">
          <a-select size="small" v-model:value="rssProxyId" @change="useProxy">
            <a-select-option v-for="proxy of rssProxies" :key="proxy.id" :value="proxy.token">{{ proxy.alias }} - {{ proxy.url }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item
          label="RssUrl 列表"
          name="rssUrls"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-form-item-rest v-for="(item, index) in rss.rssUrls" :key="index">
            <a-input-group compact>
              <a-input size="small" v-model:value="rss.rssUrls[index]" style="width: calc(100% - 64px)"/>
              <a-button
                type="danger"
                size="small" @click="() => rss.rssUrls = rss.rssUrls.filter(i => i !== rss.rssUrls[index])"
                style="width: 64px;">删除</a-button>
            </a-input-group>
          </a-form-item-rest>
          <a-button
            size="small"
            type="primary"
            @click="rss.rssUrls.push('')"
            >
            新增
          </a-button>
        </a-form-item>
        <a-form-item
          label="抓取免费"
          name="scrapeFree"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-checkbox v-model:checked="rss.scrapeFree">抓取免费</a-checkbox>
        </a-form-item>
        <a-form-item
          label="排除 HR"
          name="scrapeHr"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-checkbox v-model:checked="rss.scrapeHr">排除 HR</a-checkbox>
        </a-form-item>
        <a-form-item
          label="Cookie"
          v-if="rss.scrapeHr || rss.scrapeFree"
          name="cookie"
          extra="Cookie, M-Team 为 api key"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-input size="small" v-model:value="rss.cookie"/>
        </a-form-item>
        <a-form-item
          label="Rss 周期"
          name="cron"
          extra="Rss Cron 表达式, 默认为 1 分钟更新一次"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-input size="small" v-model:value="rss.cron"/>
        </a-form-item>
        <a-form-item
          label="推送通知"
          name="pushNotify"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-checkbox v-model:checked="rss.pushNotify">启用</a-checkbox>
        </a-form-item>
        <a-form-item
          v-if="rss.pushNotify"
          label="通知方式"
          name="notify"
          extra="通知方式, 用于推送删种等信息, 在通知工具页面创建"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-select size="small" v-model:value="rss.notify">
            <a-select-option v-for="notification of notifications" v-model:value="notification.id" :key="notification.id">{{ notification.alias }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item
          label="限制上传速度"
          name="uploadLimit"
          extra="限制种子的上传速度, 0 为不限速"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-input size="small" v-model:value="rss.uploadLimit">
            <template #addonAfter>
              <a-select size="small" v-model:value="rss.uploadLimitUnit" placeholder="选择单位" style="width: 120px">
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
          extra="限制种子的下载速度, 0 为不限速"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-input size="small" v-model:value="rss.downloadLimit">
            <template #addonAfter>
              <a-select size="small" v-model:value="rss.downloadLimitUnit" placeholder="选择单位" style="width: 120px">
                <a-select-option value="KiB">KiB/s</a-select-option>
                <a-select-option value="MiB">MiB/s</a-select-option>
                <a-select-option value="GiB">GiB/s</a-select-option>
              </a-select>
            </template>
          </a-input>
        </a-form-item>
        <a-form-item
          label="保存路径"
          name="savePath"
          extra="推送种子至下载器时的保存路径">
          <a-input size="small" v-model:value="rss.savePath"/>
        </a-form-item>
        <a-form-item
          label="分类"
          name="category"
          extra="推送种子至下载器时的分类">
          <a-input size="small" v-model:value="rss.category"/>
        </a-form-item>
        <a-form-item
          label="每小时上限"
          name="addCountPerHour"
          extra="每小时向客户端推送种子数量上限, 留空为 999, 编辑 Rss 或重启后重置计数">
          <a-input size="small" v-model:value="rss.addCountPerHour"/>
        </a-form-item>
        <a-form-item
          label="添加种子时暂停"
          name="paused"
          extra="向下载器添加种子时暂停种子">
          <a-checkbox v-model:checked="rss.paused">添加种子时暂停</a-checkbox>
        </a-form-item>
        <a-form-item
          label="自动管理"
          name="autoTMM"
          extra="向下载器添加种子时启用种子的自动管理功能, 不了解请勿勾选">
          <a-checkbox v-model:checked="rss.autoTMM">自动管理</a-checkbox>
        </a-form-item>
        <a-form-item
          label="等待时间"
          name="sleepTime"
          extra="若在 Rss 时种子是非免费状态, 将在种子发布后的一段时间内重复抓取免费状态, 建议等待时间略小于 Rss 周期">
          <a-input size="small" v-model:value="rss.sleepTime"/>
        </a-form-item>
        <a-form-item
          label="最长休眠时间"
          name="maxSleepTime"
          extra="最长休眠时间, 若上次成功 RSS 在 N 秒以前, 则本次 RSS 拒绝所有种子, 建议为 3-5 倍于 Rss 周期, 单位为秒"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-input size="small" v-model:value="rss.maxSleepTime"/>
        </a-form-item>
        <a-form-item
          label="跳过大小相同种子"
          name="skipSameTorrent"
          extra="跳过所有下载器内存在大小相同种子的种子"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-checkbox v-model:checked="rss.skipSameTorrent">跳过大小相同种子</a-checkbox>
        </a-form-item>
        <a-form-item
          label="启用辅种"
          name="rssReseed"
          extra="其他 RSS 任务在某个下载器中已有同名种子且进度达标时, 自动将本任务种子辅种到该下载器并跳过校验直接做种">
          <a-checkbox v-model:checked="rss.rssReseed">启用辅种</a-checkbox>
        </a-form-item>
        <a-form-item
          v-if="rss.rssReseed"
          label="辅种进度阈值"
          name="reseedProgress"
          extra="下载器中同名种子达到该进度(%)后才会触发辅种, 默认 50">
          <a-input size="small" v-model:value="rss.reseedProgress"/>
        </a-form-item>
        <a-form-item
          v-if="rss.rssReseed"
          label="辅种匹配方式"
          name="reseedMatchType"
          extra="仅名称=名称完全一致; 仅大小=大小一致(跨站最实用); 名称归一化+大小=忽略大小写/标点/分组后缀再比名称且大小一致">
          <a-select size="small" v-model:value="rss.reseedMatchType">
            <a-select-option value="name">仅名称一致</a-select-option>
            <a-select-option value="size">仅大小一致</a-select-option>
            <a-select-option value="nameSize">名称归一化 + 大小</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item
          v-if="rss.rssReseed"
          label="辅种扫描周期"
          name="reseedCron"
          extra="独立辅种扫描的 Cron 表达式 (如 */10 * * * * = 每10分钟); 留空则跟随 RSS 周期。该扫描通过 RSS 缓存/代理读取, 不重复直接访问站点">
          <a-input size="small" v-model:value="rss.reseedCron" placeholder="留空则跟随 RSS 周期"/>
        </a-form-item>
        <a-form-item
          v-if="rss.rssReseed"
          label="辅种跳过校验"
          name="reseedSkipChecking"
          extra="辅种时跳过校验, 直接开始做种 (推荐开启)">
          <a-checkbox v-model:checked="rss.reseedSkipChecking">跳过校验</a-checkbox>
        </a-form-item>
        <a-form-item
          v-if="rss.rssReseed"
          label="仅辅种"
          name="onlyReseed"
          extra="仅进行辅种, 不推送 RSS 中的新种子">
          <a-checkbox v-model:checked="rss.onlyReseed">仅辅种</a-checkbox>
        </a-form-item>
        <a-form-item
          v-if="rss.rssReseed"
          label="辅种下载器"
          name="reseedClients"
          extra="仅在这些下载器中查找同名种子, 留空则在所有已启用下载器中查找">
          <a-checkbox-group style="width: 100%;" v-model:value="rss.reseedClients">
            <a-row>
              <a-col v-for="downloader of downloaders" :span="8" :key="downloader.id">
                <a-checkbox :disabled="!downloader.enable && !rss.reseedClients.includes(downloader.id)" v-model:value="downloader.id">{{ downloader.alias }}</a-checkbox>
              </a-col>
            </a-row>
          </a-checkbox-group>
        </a-form-item>
        <a-form-item
          label="推送种子文件"
          name="pushTorrentFile"
          extra="是否直接推送种子文件, 默认推送种子下载链接至下载器">
          <a-checkbox v-model:checked="rss.pushTorrentFile">推送种子文件</a-checkbox>
        </a-form-item>
        <a-form-item
          label="自定义正则替换"
          v-if="!rss.pushTorrentFile"
          name="useCustomRegex"
          extra="对种子下载链接进行自定义正则表达式替换, 仅在推送方式为推送种子下载链接时生效。不完全理解本功能请勿设置, 不恰当的配置可能导致你的账号被ban。">
          <a-checkbox v-model:checked="rss.useCustomRegex">使用自定义正则</a-checkbox>
        </a-form-item>
        <a-form-item
          label="正则表达式"
          v-if="(!rss.pushTorrentFile) && rss.useCustomRegex"
          name="regexStr"
          extra="格式: /pattern/flags"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-input size="small" v-model:value="rss.regexStr"/>
        </a-form-item>
        <a-form-item
          label="替换为"
          v-if="(!rss.pushTorrentFile) && rss.useCustomRegex"
          name="replaceStr"
          :rules="[{ required: true, message: '${label}不可为空! ' }]">
          <a-input size="small" v-model:value="rss.replaceStr"/>
        </a-form-item>
        <a-form-item
          label="拒绝规则"
          name="rejectRules"
          extra="拒绝规则, 种子状态符合其中一个时即触发拒绝种子操作">
          <a-checkbox-group style="width: 100%;" v-model:value="rss.rejectRules">
            <a-row>
              <a-col v-for="rssRule of rssRules" :span="8" :key="rssRule.id">
                <a-checkbox  v-model:value="rssRule.id">{{ rssRule.alias }}</a-checkbox>
              </a-col>
            </a-row>
          </a-checkbox-group>
        </a-form-item>
        <a-form-item
          label="选择规则"
          name="acceptRules"
          extra="选择规则, 种子状态符合其中一个时即触发添加种子操作">
          <a-checkbox-group style="width: 100%;" v-model:value="rss.acceptRules">
            <a-row>
              <a-col v-for="rssRule of rssRules" :span="8" :key="rssRule.id">
                <a-checkbox  v-model:value="rssRule.id">{{ rssRule.alias }}</a-checkbox>
              </a-col>
            </a-row>
          </a-checkbox-group>
        </a-form-item>
        <a-form-item
          :wrapperCol="isMobile() ? { span:24 } : { span: 21, offset: 3 }">
          <a-button type="primary" html-type="submit" style="margin-top: 24px; margin-bottom: 48px;">应用 | 完成</a-button>
          <a-button style="margin-left: 12px; margin-top: 24px; margin-bottom: 48px;" @click="clearRss()">清空</a-button>
          <a-button type="primary" style="margin-left: 12px; margin-top: 24px; margin-bottom: 48px;" @click="dryrun()">试运行</a-button>
          <a-button type="primary" danger style="margin-left: 12px; margin-top: 24px; margin-bottom: 48px;" :loading="reseedPreviewLoading" @click="reseedPreview()">辅种预览</a-button>
          <a-button style="margin-left: 12px; margin-top: 24px; margin-bottom: 48px;" @click="listReseed()">辅种记录</a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
  <a-modal
    v-model:visible="modalVisible"
    title="RSS 试运行"
    width="1440px"
    :footer="null">
    <div style="text-align: left; ">
      <a-alert message="注意事项" type="info" >
        <template #description>
          RSS 试运行仅判断是否符合 RSS 规则，不检测种子免费或 HR 状态。
          <br>
          RSS 链接: {{ rss.rssUrls[0] }}
        </template>
      </a-alert>
      <a-form
        labelAlign="right"
        :labelWrap="true"
        size="small"
        :labelCol="{ span: 6 }"
        :wrapperCol="{ span: 18 }"
        autocomplete="off">
        <a-form-item
          :wrapperCol="{ span:24 }">
          <a-table
            :style="`font-size: ${isMobile() ? '12px': '14px'};`"
            :columns="dryrunColumns"
            size="small"
            :data-source="dryrunResult"
            :pagination="false"
            :scroll="{ x: 960 }"
          >
            <template #title>
              <span style="font-size: 16px; font-weight: bold;">种子列表</span>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'size'">
                {{ $formatSize(record.size) }}
              </template>
            </template>
          </a-table>
        </a-form-item>
        <a-form-item
          :wrapperCol="isMobile() ? { span:24 } : { span: 6, offset: 18 }">
          <a-button @click="() => modalVisible = false">取消</a-button>
        </a-form-item>
      </a-form>
    </div>
  </a-modal>
  <a-modal
    v-model:visible="reseedPreviewVisible"
    title="辅种匹配预览"
    width="1200px"
    :footer="null">
    <div style="text-align: left; ">
      <a-alert message="说明" type="info" style="margin-bottom: 12px;">
        <template #description>
          阈值: {{ rss.reseedProgress || 50 }}% | 匹配方式: {{ reseedMatchTypeText }} | 已扫描: {{ reseedStats.clients }} 个下载器 / {{ reseedStats.torrents }} 个种子。
          展示 RSS 缓存内容与下载器的对比情况, 不会实际推送。橙色行「大小相同(名称不同)」表示可用「仅大小」匹配。
        </template>
      </a-alert>
      <a-table
        :columns="reseedColumns"
        size="small"
        :data-source="reseedRows"
        :pagination="{ pageSize: 10 }"
        :scroll="{ x: 900 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'size'">
            {{ $formatSize(record.size) }}
          </template>
          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === '✔ 可辅种' ? 'success' : (record.status === '大小相同(名称不同)' ? 'orange' : 'default')">{{ record.status }}</a-tag>
          </template>
        </template>
      </a-table>
    </div>
  </a-modal>
  <a-modal
    v-model:visible="reseedLogVisible"
    title="辅种记录"
    width="1100px"
    :footer="null">
    <div style="text-align: left; ">
      <a-table
        :columns="reseedLogColumns"
        size="small"
        :data-source="reseedLogList"
        :pagination="{ pageSize: 10 }"
        :scroll="{ x: 800 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'record_time'">
            {{ $moment(record.record_time * 1000).format('YYYY-MM-DD HH:mm:ss') }}
          </template>
          <template v-if="column.dataIndex === 'size'">
            {{ $formatSize(record.size) }}
          </template>
          <template v-if="column.dataIndex === 'record_type'">
            <a-tag :color="record.record_type === 1 ? 'success' : (record.record_type === 3 ? 'error' : 'default')">{{ record.record_type === 1 ? '成功' : (record.record_type === 3 ? '失败' : '拒绝') }}</a-tag>
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
        width: 20
      }, {
        title: '启用',
        dataIndex: 'enable',
        width: 15
      }, {
        title: '下载器',
        dataIndex: 'clientArr',
        width: 40
      }, {
        title: '推送消息',
        dataIndex: 'pushNotify',
        width: 20
      }, {
        title: '操作',
        width: 28
      }
    ];
    const dryrunColumns = [
      {
        title: '种子标题',
        dataIndex: 'name',
        width: 144
      }, {
        title: '种子大小',
        dataIndex: 'size',
        width: 14
      }, {
        title: '结果',
        dataIndex: 'status',
        width: 28
      }
    ];
    const reseedColumns = [
      {
        title: '种子名',
        dataIndex: 'name',
        width: 160
      }, {
        title: '大小',
        dataIndex: 'size',
        width: 14
      }, {
        title: '下载器',
        dataIndex: 'client',
        width: 24
      }, {
        title: '进度',
        dataIndex: 'progress',
        width: 16
      }, {
        title: '状态',
        dataIndex: 'status',
        width: 30
      }, {
        title: '结果',
        dataIndex: 'result',
        width: 30
      }
    ];
    const reseedLogColumns = [
      {
        title: '时间',
        dataIndex: 'record_time',
        width: 150
      }, {
        title: '种子名',
        dataIndex: 'name'
      }, {
        title: '大小',
        dataIndex: 'size',
        width: 100
      }, {
        title: '状态',
        dataIndex: 'record_type',
        width: 70
      }, {
        title: '备注',
        dataIndex: 'record_note',
        width: 120
      }
    ];
    return {
      columns,
      dryrunColumns,
      reseedColumns,
      reseedLogColumns,
      modalVisible: false,
      reseedPreviewVisible: false,
      reseedPreviewLoading: false,
      reseedPreviewList: [],
      reseedStats: { clients: 0, torrents: 0 },
      reseedLogVisible: false,
      reseedLogList: [],
      rssList: [],
      downloaders: [],
      notifications: [],
      rssRules: [],
      rssProxies: [],
      rssProxyId: '',
      rss: {},
      defaultRss: {
        clientArr: [],
        enable: false,
        scrapeFree: false,
        scrapeHr: false,
        rssReseed: false,
        autoReseed: false,
        onlyReseed: false,
        reseedProgress: 50,
        reseedSkipChecking: true,
        reseedMatchType: 'name',
        reseedCron: '',
        maxSleepTime: 600,
        skipSameTorrent: true,
        pushTorrentFile: true,
        cron: '* * * * *',
        addCountPerHour: '',
        pushNotify: false,
        acceptRules: [],
        rejectRules: [],
        reseedClients: [],
        rssUrls: ['']
      },
      loading: true,
      registCode: []
    };
  },
  computed: {
    reseedRows () {
      const rows = [];
      for (const item of this.reseedPreviewList || []) {
        if (item.candidates && item.candidates.length > 0) {
          for (const c of item.candidates) {
            rows.push({
              name: item.name,
              size: item.size,
              client: c.client,
              progress: c.progress + '%',
              status: c.status,
              result: item.result
            });
          }
        } else {
          rows.push({
            name: item.name,
            size: item.size,
            client: '-',
            progress: '-',
            status: '无同名种子',
            result: item.result
          });
        }
      }
      return rows;
    },
    reseedMatchTypeText () {
      const map = { name: '仅名称', size: '仅大小', nameSize: '名称(归一化)+大小' };
      return map[this.rss.reseedMatchType] || '仅名称';
    }
  },
  methods: {
    isMobile () {
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        return true;
      } else {
        return false;
      }
    },
    async listRss () {
      try {
        const res = await this.$api().rss.list();
        this.rssList = res.data;
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    async listNotification () {
      try {
        const res = await this.$api().notification.list();
        this.notifications = res.data.sort((a, b) => a.alias.localeCompare(b.alias));
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
    async listRssProxy () {
      try {
        const res = await this.$api().rssProxy.list();
        this.rssProxies = res.data.filter(item => item.enable && item.token);
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    useProxy (token) {
      if (!token) return;
      const url = window.location.origin + '/rss/' + token + '.xml';
      if (this.rss.rssUrls.indexOf(url) === -1) {
        this.rss.rssUrls.push(url);
      }
      this.rssProxyId = '';
      this.$message().success('已添加代理地址到 RSS 列表');
    },
    async listDownloader () {
      try {
        const res = await this.$api().downloader.list();
        this.downloaders = res.data.sort((a, b) => a.alias.localeCompare(b.alias));
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    async modifyRss () {
      try {
        await this.$api().rss.modify({ ...this.rss });
        this.$message().success((this.rss.id ? '编辑' : '新增') + '成功, 列表正在刷新...');
        setTimeout(() => this.listRss(), 1000);
        this.clearRss();
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    async dryrun () {
      try {
        const res = await this.$api().rss.dryrun({ ...this.rss });
        this.dryrunResult = res.data;
        this.modalVisible = true;
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    async reseedPreview () {
      this.reseedPreviewLoading = true;
      try {
        const res = await this.$api().rss.reseedPreview({ ...this.rss });
        this.reseedPreviewList = res.data.list || [];
        this.reseedStats = res.data.stats || { clients: 0, torrents: 0 };
        this.reseedPreviewVisible = true;
      } catch (e) {
        this.$message().error(e.message);
      } finally {
        this.reseedPreviewLoading = false;
      }
    },
    async listReseed () {
      try {
        const res = await this.$api().rss.listReseed();
        this.reseedLogList = res.data;
        this.reseedLogVisible = true;
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    async enableTask (record) {
      try {
        await this.$api().rss.modify({ ...record });
        this.$message().success('修改成功, 列表正在刷新...');
        setTimeout(() => this.listRss(), 1000);
        this.clearRss();
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    modifyClick (row) {
      this.rss = { ...row };
      this.fillReseedClients();
    },
    cloneClick (row) {
      this.rss = JSON.parse(JSON.stringify(row));
      this.rss.id = null;
      this.rss.alias = this.rss.alias + '-克隆';
      this.fillReseedClients();
    },
    fillReseedClients () {
      if (this.rss.rssReseed && this.downloaders.length > 0 && (!this.rss.reseedClients || this.rss.reseedClients.length === 0)) {
        this.rss.reseedClients = this.downloaders.filter(item => item.enable).map(item => item.id);
      }
    },
    async deleteRss (row) {
      try {
        await this.$api().rss.delete(row.id);
        this.$message().success('删除成功, 列表正在刷新...');
        await this.listRss();
      } catch (e) {
        this.$message().error(e.message);
      }
    },
    clearRss () {
      this.rss = {
        ...this.defaultRss,
        acceptRules: [],
        clientArr: [],
        rejectRules: [],
        reseedClients: [],
        rssUrls: ['']
      };
    }
  },
  watch: {
    'rss.rssReseed' () {
      this.fillReseedClients();
    }
  },
  async mounted () {
    this.clearRss();
    this.listNotification();
    this.listDownloader();
    this.listRssRule();
    this.listRssProxy();
    this.listRss();
  }
};
</script>
<style scoped>
.rss {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
}
</style>
