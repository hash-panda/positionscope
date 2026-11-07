<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Check, ChevronRight, Copy, Download, RotateCw, RefreshCw, Trash2, Wrench } from 'lucide-vue-next';
import type { UpdateState } from '../../../../main/services/update-install';
import type { AppModel } from '../../composables/useTradingApp';
import appIcon from '../../../../../assets/brand/app-icon-128.png';

const props = defineProps<{ model: AppModel }>();
const emit = defineEmits<{ confirm: [action: 'reset' | 'delete'] }>();
const address = '0xC471515aa7B64832c0550814C230bEA1376cbbD3';
const copied = ref(false);
const checking = ref(false);
const update = ref<UpdateState | null>(null);
const busy = computed(() => checking.value || ['checking', 'downloading', 'verifying'].includes(update.value?.state || ''));
let unsubscribe: (() => void) | undefined;
onMounted(async () => {
  let notified = false;
  unsubscribe = props.model.api?.onAppUpdateState?.(state => { notified = true; if (!disposed) update.value = state; });
  try { const state = await props.model.api?.getUpdateState?.(); if (!disposed && !notified && state) update.value = state; } catch { /* Explicit check remains available. */ }
});
async function downloadUpdate() {
  if (busy.value || update.value?.state !== 'available') return;
  checking.value = true;
  try { const state = await props.model.api?.downloadUpdate(); if (!disposed && state) update.value = state; }
  catch { if (!disposed) update.value = { state: 'unavailable', currentVersion: props.model.appVersion, message: '下载未完成，请检查网络后重试。' }; }
  finally { if (!disposed) checking.value = false; }
}
async function installUpdate() {
  try { if (await props.model.api?.installUpdate() === false && !disposed) await checkUpdates(); }
  catch { if (!disposed) update.value = { state: 'unavailable', currentVersion: props.model.appVersion, message: '未能重启更新，请退出后重新打开应用。' }; }
}
let disposed = false;
async function checkUpdates() {
  if (busy.value) return;
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
  unsubscribe?.();
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
    <button v-if="update?.state !== 'ready'" class="button secondary compact-button" :disabled="busy" :aria-busy="busy" @click="checkUpdates"><RefreshCw :size="15" />{{ update?.state === 'downloading' ? '正在下载…' : update?.state === 'verifying' ? '正在验证…' : checking || update?.state === 'checking' ? '正在检查…' : '检查更新' }}</button>
    <p class="helper" role="status">{{ update?.message || '仅在点击时查询官方稳定版本。' }}</p>
    <progress v-if="update?.state === 'downloading' || update?.state === 'verifying'" class="update-progress" :value="update.progress || 0" max="100" aria-label="更新包下载进度" />
    <p v-if="update?.state === 'downloading'" class="helper">{{ update.progress || 0 }}%</p>
    <button v-if="update?.state === 'available'" class="button primary compact-button" :disabled="busy" @click="downloadUpdate"><Download :size="15" />下载 {{ update.latestVersion }} 更新</button>
    <button v-if="update?.state === 'ready'" class="button primary compact-button" @click="installUpdate"><RotateCw :size="15" />重启更新</button>
    <p class="helper">下载前核对官方签名公证记录，下载后验证摘要与 macOS 签名。准备完成后，重启或下次退出时安装。关闭此页面不会中断下载。</p>
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
.update-progress { width: 100%; accent-color: var(--brand); margin-top: 10px; }
.about-app-icon { display: block; margin: 0 auto 8px; }
</style>
