<script setup lang="ts">
import { onUnmounted, ref } from 'vue';
import { Check, ChevronRight, Copy, ExternalLink, RefreshCw, Trash2, Wrench } from 'lucide-vue-next';
import type { AppUpdateResult } from '../../../../main/services/app-updates';
import type { AppModel } from '../../composables/useTradingApp';
import appIcon from '../../../../../assets/brand/app-icon-128.png';

const props = defineProps<{ model: AppModel }>();
const emit = defineEmits<{ confirm: [action: 'reset' | 'delete'] }>();
const address = '0xC471515aa7B64832c0550814C230bEA1376cbbD3';
const copied = ref(false);
const checking = ref(false);
const update = ref<AppUpdateResult | null>(null);
let disposed = false;
async function checkUpdates() {
  if (checking.value) return;
  checking.value = true;
  update.value = null;
  try {
    if (!props.model.api) throw new Error('Desktop only');
    const result = await props.model.api.checkForUpdates();
    if (!disposed) update.value = result;
  } catch {
    if (!disposed) update.value = { state: 'unavailable', currentVersion: props.model.appVersion, message: '暂时无法检查更新，请稍后重试。' };
  } finally { if (!disposed) checking.value = false; }
}
let copyTimer: ReturnType<typeof setTimeout> | undefined;
async function copyAddress() {
  try {
    await navigator.clipboard.writeText(address);
    copied.value = true;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    props.model.formError = '复制失败，请手动选择并复制地址';
  }
}
onUnmounted(() => {
  disposed = true;
  if (copyTimer) clearTimeout(copyTimer);
});
</script>
<template>
  <div class="about-heading">
    <img class="about-app-icon" :src="appIcon" width="64" height="64" alt="" aria-hidden="true" />
    <h2>PositionScope · 仓位镜</h2>
    <p>Binance 只读持仓与 AI 研究</p>
  </div>
  <dl class="about-details">
    <div>
      <dt>版本号</dt>
      <dd>{{ model.appVersion ? `v${model.appVersion}` : '暂无' }}</dd>
    </div>
    <div>
      <dt>作者</dt>
      <dd>Wang</dd>
    </div>
  </dl>
  <section class="settings-section update-section">
    <h2>软件更新</h2>
    <button class="button secondary compact-button" :disabled="checking" :aria-busy="checking" @click="checkUpdates"><RefreshCw :size="15" />{{ checking ? '正在检查…' : '检查更新' }}</button>
    <p class="helper" role="status">{{ checking ? '正在读取官方发布信息…' : update?.message || '仅在点击时查询官方稳定版本。' }}</p>
    <button v-if="update?.state === 'available' && update.releaseUrl" class="button primary compact-button" @click="model.api?.openExternal(update.releaseUrl!)"><ExternalLink :size="15" />查看 {{ update.latestVersion }} 发布页</button>
    <p class="helper">更新包附带签名、公证记录与校验和。下载安装由你确认，不自动替换应用。</p>
  </section>
  <section class="settings-section">
    <h2>打赏支持</h2>
    <div class="donation-row">
      <div>
        <span class="small-text">ETH 主网地址</span
        ><code class="donation-address" :title="address">{{ address }}</code>
      </div>
      <button class="button secondary compact-button" @click="copyAddress">
        <Check v-if="copied" :size="14" /><Copy v-else :size="14" />{{ copied ? '已复制' : '复制' }}
      </button>
    </div>
    <p class="helper">感谢你的支持。</p>
  </section>
  <section class="settings-section">
    <h2>数据管理</h2>
    <p class="helper" role="status">{{ model.storageStatus.message }}</p>
    <p class="helper">加密文件依赖本机系统密钥，不能直接复制到另一台电脑解密。删除所有数据也会删除未能读取的加密配置。</p>
    <button class="settings-link" :disabled="!!model.saving" @click="emit('confirm', 'reset')">
      <Wrench :size="17" /><span>恢复默认设置</span
      ><ChevronRight :size="16" class="header-end" /></button
    ><button
      class="settings-link danger-text"
      :disabled="!!model.saving"
      @click="emit('confirm', 'delete')"
    >
      <Trash2 :size="17" /><span>删除所有数据</span><ChevronRight :size="16" class="header-end" />
    </button>
    <p class="helper">操作前会再次确认。</p>
  </section>
</template>
<style scoped>
.about-app-icon { display: block; margin: 0 auto 8px; }
</style>
