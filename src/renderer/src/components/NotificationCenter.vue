<template>
  <div class="notification-center">
    <!-- 首次展示提示 (大号，居中) -->
    <Transition name="spotlight">
      <div v-if="spotlightNotification" class="spotlight-notification" :class="`spotlight-${spotlightNotification.type}`">
        <div class="spotlight-content">
          <div class="spotlight-icon">
            <CheckCircle v-if="spotlightNotification.type === 'success'" :size="48" />
            <AlertTriangle v-else-if="spotlightNotification.type === 'warning'" :size="48" />
            <XCircle v-else-if="spotlightNotification.type === 'error'" :size="48" />
            <Info v-else :size="48" />
          </div>
          <div class="spotlight-body">
            <h3 v-if="spotlightNotification.title" class="spotlight-title">{{ spotlightNotification.title }}</h3>
            <p class="spotlight-message">{{ spotlightNotification.message }}</p>
            <button
              v-if="spotlightNotification.actionLabel"
              class="spotlight-action-btn"
              @click="handleSpotlightAction"
            >
              {{ spotlightNotification.actionLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Toast 通知 (自动消失) -->
    <TransitionGroup name="toast" tag="div" class="toast-container">
      <div
        v-for="notification in visibleToasts"
        :key="notification.id"
        :class="['toast', `toast-${notification.type}`]"
        @click="dismissToast(notification.id)"
      >
        <div class="toast-icon">
          <CheckCircle v-if="notification.type === 'success'" :size="20" />
          <AlertTriangle v-else-if="notification.type === 'warning'" :size="20" />
          <XCircle v-else-if="notification.type === 'error'" :size="20" />
          <Info v-else :size="20" />
        </div>
        <div class="toast-content">
          <div v-if="notification.title" class="toast-title">{{ notification.title }}</div>
          <div class="toast-message">{{ notification.message }}</div>
        </div>
        <button class="toast-close" @click.stop="dismissToast(notification.id)">
          <X :size="16" />
        </button>
      </div>
    </TransitionGroup>

    <!-- 通知中心按钮 -->
    <button
      v-if="allNotifications.length > 0"
      class="notification-bell"
      :class="{ 'has-unread': unreadCount > 0 }"
      @click="toggleCenter"
      title="通知中心"
    >
      <Bell :size="18" />
      <span v-if="unreadCount > 0" class="notification-badge">{{ unreadCount }}</span>
    </button>

    <!-- 通知中心面板 -->
    <Transition name="slide">
      <div v-if="showCenter" class="notification-panel">
        <div class="panel-header">
          <h3>通知中心</h3>
          <div class="panel-actions">
            <button v-if="allNotifications.length > 0" class="action-btn" @click="markAllAsRead">
              全部已读
            </button>
            <button v-if="allNotifications.length > 0" class="action-btn" @click="clearAll">
              清空
            </button>
            <button class="close-btn" @click="showCenter = false">
              <X :size="18" />
            </button>
          </div>
        </div>

        <div class="panel-body">
          <div v-if="allNotifications.length === 0" class="empty-state">
            <Bell :size="48" class="empty-icon" />
            <p>暂无通知</p>
          </div>

          <div v-else class="notification-list">
            <div
              v-for="notification in sortedNotifications"
              :key="notification.id"
              :class="['notification-item', { unread: !notification.read }]"
              @click="markAsRead(notification.id)"
            >
              <div class="notification-icon" :class="`icon-${notification.type}`">
                <CheckCircle v-if="notification.type === 'success'" :size="18" />
                <AlertTriangle v-else-if="notification.type === 'warning'" :size="18" />
                <XCircle v-else-if="notification.type === 'error'" :size="18" />
                <Info v-else :size="18" />
              </div>

              <div class="notification-body">
                <div v-if="notification.title" class="notification-title">
                  {{ notification.title }}
                </div>
                <div class="notification-message">{{ notification.message }}</div>
                <div class="notification-footer">
                  <div class="notification-time">{{ formatTime(notification.timestamp) }}</div>
                  <button
                    v-if="notification.actionLabel"
                    class="notification-action-btn"
                    @click.stop="handleNotificationAction(notification)"
                  >
                    {{ notification.actionLabel }}
                  </button>
                </div>
              </div>

              <button class="delete-btn" @click.stop="removeNotification(notification.id)">
                <X :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 点击外部关闭面板 -->
    <div v-if="showCenter" class="panel-overlay" @click="showCenter = false"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Bell, CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-vue-next';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  timestamp: number;
  read: boolean;
  persistent?: boolean; // 是否持久化（不自动消失）
  spotlight?: boolean; // 是否先显示聚光灯效果（居中大显示）
  actionLabel?: string; // 操作按钮文本（如"查看详情"）
  onAction?: () => void; // 点击操作时的回调
}

const allNotifications = ref<Notification[]>([]);
const visibleToasts = ref<Notification[]>([]);
const showCenter = ref(false);
const spotlightNotification = ref<Notification | null>(null); // 当前聚光灯通知
let spotlightTimer: NodeJS.Timeout | null = null;

const sortedNotifications = computed(() => {
  return [...allNotifications.value].sort((a, b) => b.timestamp - a.timestamp);
});

const unreadCount = computed(() => {
  return allNotifications.value.filter(n => !n.read).length;
});

// 添加通知
const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
  const id = `${Date.now()}-${Math.random()}`;
  const newNotification: Notification = {
    ...notification,
    id,
    timestamp: Date.now(),
    read: false,
  };

  // 添加到通知列表
  allNotifications.value.push(newNotification);

  // 如果需要聚光灯效果（明确指定 spotlight: true）
  if (notification.spotlight === true) {
    // 清除之前的聚光灯定时器
    if (spotlightTimer) {
      clearTimeout(spotlightTimer);
    }

    // 显示聚光灯通知
    spotlightNotification.value = newNotification;

    // 3秒后飞入到通知中心图标
    spotlightTimer = setTimeout(() => {
      const spotlightElement = document.querySelector('.spotlight-notification');
      const bellButton = document.querySelector('.notification-bell');

      if (spotlightElement && bellButton) {
        // 获取起始和结束位置
        const startRect = spotlightElement.getBoundingClientRect();
        const endRect = bellButton.getBoundingClientRect();

        // 创建一个飞行的克隆元素
        const flyingClone = spotlightElement.cloneNode(true) as HTMLElement;
        flyingClone.classList.add('flying-notification');
        document.body.appendChild(flyingClone);

        // 设置初始位置
        flyingClone.style.position = 'fixed';
        flyingClone.style.top = `${startRect.top}px`;
        flyingClone.style.left = `${startRect.left}px`;
        flyingClone.style.width = `${startRect.width}px`;
        flyingClone.style.height = `${startRect.height}px`;
        flyingClone.style.margin = '0';
        flyingClone.style.zIndex = '10002';

        // 触发飞入动画 - 飞向通知中心按钮
        requestAnimationFrame(() => {
          flyingClone.style.transition = 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
          flyingClone.style.top = `${endRect.top + endRect.height / 2}px`;
          flyingClone.style.left = `${endRect.left + endRect.width / 2}px`;
          flyingClone.style.transform = 'translate(-50%, -50%) scale(0.1)';
          flyingClone.style.opacity = '0';
        });

        // 动画结束后移除克隆
        setTimeout(() => {
          flyingClone.remove();

          // 添加通知图标的脉动效果
          if (bellButton) {
            bellButton.classList.add('notification-received');
            setTimeout(() => {
              bellButton.classList.remove('notification-received');
            }, 600);
          }
        }, 600);
      }

      // 清除聚光灯显示
      spotlightNotification.value = null;
    }, 3000);
  } else if (!notification.persistent) {
    // 普通Toast（无聚光灯效果，显示在右上角）
    // 只有非 persistent 的通知才显示为 Toast
    visibleToasts.value.push(newNotification);

    // 5秒后自动移除Toast
    setTimeout(() => {
      dismissToast(id);
    }, 5000);
  }
  // else: persistent 但不是 spotlight，静默添加到通知历史，不显示任何提示

  // 限制通知数量（最多保留100条）
  if (allNotifications.value.length > 100) {
    allNotifications.value = allNotifications.value.slice(-100);
  }

  return id;
};

// 关闭Toast
const dismissToast = (id: string) => {
  const index = visibleToasts.value.findIndex(n => n.id === id);
  if (index !== -1) {
    visibleToasts.value.splice(index, 1);
  }
};

// 标记为已读
const markAsRead = (id: string) => {
  const notification = allNotifications.value.find(n => n.id === id);
  if (notification) {
    notification.read = true;
  }
};

// 全部标记为已读
const markAllAsRead = () => {
  allNotifications.value.forEach(n => {
    n.read = true;
  });
};

// 移除通知
const removeNotification = (id: string) => {
  const index = allNotifications.value.findIndex(n => n.id === id);
  if (index !== -1) {
    allNotifications.value.splice(index, 1);
  }
};

// 清空所有通知
const clearAll = () => {
  allNotifications.value = [];
  visibleToasts.value = [];
  // 清空后自动关闭通知中心面板
  showCenter.value = false;
};

// 切换通知中心
const toggleCenter = () => {
  showCenter.value = !showCenter.value;
};

// 处理聚光灯通知的操作按钮点击
const handleSpotlightAction = () => {
  if (spotlightNotification.value?.onAction) {
    spotlightNotification.value.onAction();
    // 点击操作后，关闭聚光灯通知
    if (spotlightTimer) {
      clearTimeout(spotlightTimer);
    }
    spotlightNotification.value = null;
  }
};

// 处理通知列表中的操作按钮点击
const handleNotificationAction = (notification: Notification) => {
  if (notification.onAction) {
    notification.onAction();
    // 标记为已读
    notification.read = true;
    // 关闭通知中心面板
    showCenter.value = false;
  }
};

// 格式化时间
const formatTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;

  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 暴露方法给父组件
defineExpose({
  addNotification,
  clearAll,
});
</script>

<style scoped>
.notification-center {
  position: fixed;
  z-index: 10000;
}

/* ========== 聚光灯通知 (居中大显示) ========== */
.spotlight-notification {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10003;
  pointer-events: all;
}

.spotlight-content {
  background: var(--bg-primary);
  border-radius: 20px;
  padding: 40px 48px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  min-width: 400px;
  max-width: 500px;
  backdrop-filter: blur(20px);
}

.spotlight-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin-bottom: 8px;
  animation: spotlightPulse 2s ease-in-out infinite;
}

.spotlight-success .spotlight-icon {
  background: rgba(52, 199, 89, 0.15);
  color: var(--accent-green);
}

.spotlight-error .spotlight-icon {
  background: rgba(255, 59, 48, 0.15);
  color: var(--accent-red);
}

.spotlight-warning .spotlight-icon {
  background: rgba(255, 149, 0, 0.15);
  color: var(--accent-orange);
}

.spotlight-info .spotlight-icon {
  background: rgba(0, 122, 255, 0.15);
  color: var(--accent-blue);
}

@keyframes spotlightPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}

.spotlight-body {
  text-align: center;
  width: 100%;
}

.spotlight-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 12px 0;
  line-height: 1.3;
}

.spotlight-message {
  font-size: 16px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
  white-space: pre-line;
}

/* 聚光灯动画 */
.spotlight-enter-active {
  animation: spotlightIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.spotlight-leave-active {
  animation: spotlightOut 0.3s ease-out;
}

@keyframes spotlightIn {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes spotlightOut {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
}

/* 飞行中的通知克隆 */
.flying-notification {
  pointer-events: none;
}

/* ========== Toast 容器 ========== */
.toast-container {
  position: fixed;
  top: 60px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 10001;
  pointer-events: none;
}

/* Toast 样式 */
.toast {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 320px;
  max-width: 420px;
  padding: 14px 16px;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
  pointer-events: all;
  cursor: pointer;
  transition: all 0.2s;
}

.toast:hover {
  transform: translateX(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.08);
}

.toast-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-success .toast-icon {
  color: var(--accent-green);
}

.toast-error .toast-icon {
  color: var(--accent-red);
}

.toast-warning .toast-icon {
  color: var(--accent-orange);
}

.toast-info .toast-icon {
  color: var(--accent-blue);
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.toast-message {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  word-wrap: break-word;
}

.toast-close {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 2px;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.toast-close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* Toast 动画 */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100px) scale(0.9);
}

/* ========== 通知中心按钮 ========== */
.notification-bell {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--accent-blue);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
  transition: all 0.2s;
  z-index: 9999;
}

.notification-bell:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 122, 255, 0.4);
}

.notification-bell.has-unread {
  animation: pulse 2s infinite;
}

/* 通知接收动画 */
.notification-bell.notification-received {
  animation: notificationReceived 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes notificationReceived {
  0% {
    transform: scale(1);
  }
  25% {
    transform: scale(1.3);
  }
  50% {
    transform: scale(0.9);
  }
  75% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
  }
  50% {
    box-shadow: 0 4px 20px rgba(0, 122, 255, 0.5);
  }
}

.notification-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: var(--accent-red);
  color: white;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bg-primary);
}

/* ========== 通知中心面板 ========== */
.panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
  z-index: 9998;
}

.notification-panel {
  position: fixed;
  bottom: 80px;
  right: 20px;
  width: 380px;
  max-height: 500px;
  background: var(--bg-primary);
  border-radius: 16px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 9999;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.panel-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  padding: 4px 10px;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  padding: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-tertiary);
}

.empty-icon {
  opacity: 0.3;
  margin-bottom: 12px;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

/* ========== 通知列表 ========== */
.notification-list {
  display: flex;
  flex-direction: column;
}

.notification-item {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s;
}

.notification-item:hover {
  background: var(--bg-secondary);
}

.notification-item.unread {
  background: rgba(0, 122, 255, 0.05);
}

.notification-item.unread .notification-title {
  font-weight: 600;
}

.notification-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-success {
  background: rgba(52, 199, 89, 0.1);
  color: var(--accent-green);
}

.icon-error {
  background: rgba(255, 59, 48, 0.1);
  color: var(--accent-red);
}

.icon-warning {
  background: rgba(255, 149, 0, 0.1);
  color: var(--accent-orange);
}

.icon-info {
  background: rgba(0, 122, 255, 0.1);
  color: var(--accent-blue);
}

.notification-body {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.notification-message {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 6px;
  word-wrap: break-word;
}

.notification-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
}

.notification-time {
  font-size: 11px;
  color: var(--text-tertiary);
}

.notification-action-btn {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--accent-blue);
  background: rgba(0, 122, 255, 0.1);
  border: 1px solid rgba(0, 122, 255, 0.3);
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.notification-action-btn:hover {
  background: rgba(0, 122, 255, 0.2);
  border-color: rgba(0, 122, 255, 0.5);
}

.spotlight-action-btn {
  margin-top: 20px;
  padding: 12px 28px;
  font-size: 15px;
  font-weight: 600;
  color: white;
  background: var(--accent-blue);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
}

.spotlight-action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 122, 255, 0.4);
}

.spotlight-action-btn:active {
  transform: translateY(0);
}

.delete-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 4px;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.2s;
}

.notification-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* 面板滑入动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

/* 滚动条样式 */
.panel-body::-webkit-scrollbar {
  width: 6px;
}

.panel-body::-webkit-scrollbar-track {
  background: transparent;
}

.panel-body::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.panel-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}
</style>
