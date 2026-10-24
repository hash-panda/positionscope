<script setup lang="ts">
import { onUnmounted, ref } from 'vue';
import { Check, ChevronRight, Copy, Trash2, Wrench } from 'lucide-vue-next';
import type { AppModel } from '../../composables/useTradingApp';

const props = defineProps<{ model: AppModel }>();
const emit = defineEmits<{ confirm: [action: 'reset' | 'delete'] }>();
const address = '0xC471515aa7B64832c0550814C230bEA1376cbbD3';
const copied = ref(false);
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
  if (copyTimer) clearTimeout(copyTimer);
});
</script>
<template>
  <div class="about-heading">
    <h2>PositionScope · 仓位镜</h2>
    <p>菜单栏持仓监控工具</p>
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
