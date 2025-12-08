<template>
  <div class="app" :class="{ 'dark-mode': isDarkMode }">
    <!-- Notification Center -->
    <NotificationCenter ref="notificationCenter" />

    <!-- Quit Confirmation Dialog -->
    <div v-if="showQuitConfirm" class="modal-overlay" @click="cancelQuit">
      <div class="modal-dialog" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">确认退出</h3>
        </div>
        <div class="modal-body">
          <p>确定要退出应用吗？</p>
        </div>
        <div class="modal-footer">
          <button class="modal-btn modal-btn-cancel" @click="cancelQuit">
            取消
          </button>
          <button class="modal-btn modal-btn-confirm" @click="confirmQuitApp">
            退出
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click="showDeleteConfirm = false">
      <div class="modal-dialog" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">⚠️ 确认删除所有数据</h3>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 12px; font-weight: 600; color: var(--accent-red);">此操作不可恢复！</p>
          <p style="margin-bottom: 8px;">将删除以下内容：</p>
          <ul style="margin-left: 20px; line-height: 1.8;">
            <li>API Key 和 API Secret</li>
            <li>所有设置选项</li>
            <li>持仓顺序</li>
            <li>代理配置</li>
          </ul>
        </div>
        <div class="modal-footer">
          <button class="modal-btn modal-btn-cancel" @click="showDeleteConfirm = false">
            取消
          </button>
          <button class="modal-btn modal-btn-confirm" @click="confirmDeleteAll">
            确认删除
          </button>
        </div>
      </div>
    </div>

    <!-- Health Analysis Dialog -->
    <div v-if="showHealthAnalysis && healthScore" class="modal-overlay" @click="showHealthAnalysis = false">
      <div class="health-dialog" @click.stop>
        <div class="health-header">
          <div class="health-title">
            <Sparkles :size="20" class="title-icon" />
            <h3>AI 持仓健康度分析</h3>
          </div>
          <button class="close-btn" @click="showHealthAnalysis = false">
            <X :size="20" />
          </button>
        </div>

        <div class="health-body">
          <!-- 总体评分 -->
          <div class="health-score-section">
            <div class="score-label">总体评分</div>
            <div class="score-circle" :class="getScoreClass(healthScore.overallScore)">
              <span class="score-value">{{ healthScore.overallScore }}</span>
              <span class="score-max">/100</span>
            </div>
          </div>

          <!-- 详细评分 -->
          <div class="health-metrics">
            <div class="metric-item">
              <span class="metric-label">分散度</span>
              <div class="metric-bar-container">
                <div class="metric-bar" :style="{ width: healthScore.diversification + '%' }"></div>
              </div>
              <span class="metric-value">{{ healthScore.diversification }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">杠杆合理性</span>
              <div class="metric-bar-container">
                <div class="metric-bar" :style="{ width: healthScore.leverage + '%' }"></div>
              </div>
              <span class="metric-value">{{ healthScore.leverage }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">风险敞口</span>
              <div class="metric-bar-container">
                <div class="metric-bar" :style="{ width: healthScore.riskExposure + '%' }"></div>
              </div>
              <span class="metric-value">{{ healthScore.riskExposure }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">盈亏比</span>
              <div class="metric-bar-container">
                <div class="metric-bar" :style="{ width: healthScore.profitabilityRatio + '%' }"></div>
              </div>
              <span class="metric-value">{{ healthScore.profitabilityRatio }}</span>
            </div>
          </div>

          <!-- 总结 -->
          <div v-if="healthScore.summary" class="health-summary">
            <h4 class="section-title">总结</h4>
            <p class="summary-text">{{ healthScore.summary }}</p>
          </div>

          <!-- 警告 -->
          <div v-if="healthScore.warnings && healthScore.warnings.length > 0" class="health-warnings">
            <h4 class="section-title">
              <AlertTriangle :size="16" class="section-icon" />
              风险警告
            </h4>
            <ul class="warnings-list">
              <li v-for="(warning, index) in healthScore.warnings" :key="index">{{ warning }}</li>
            </ul>
          </div>

          <!-- 建议 -->
          <div v-if="healthScore.suggestions && healthScore.suggestions.length > 0" class="health-suggestions">
            <h4 class="section-title">
              <Info :size="16" class="section-icon" />
              优化建议
            </h4>
            <ul class="suggestions-list">
              <li v-for="(suggestion, index) in healthScore.suggestions" :key="index">{{ suggestion }}</li>
            </ul>
          </div>
        </div>

        <div class="health-footer">
          <button class="modal-btn modal-btn-cancel" @click="showHealthAnalysis = false">
            关闭
          </button>
        </div>
      </div>
    </div>

    <!-- Settings Panel -->
    <div v-if="showSettings" class="settings-panel">
      <div class="settings-header">
        <button class="back-btn" @click="showSettings = false">
          <ChevronLeft :size="24" />
        </button>
        <h2 class="settings-title">设置</h2>
        <div class="header-actions">
          <button class="header-button" @click="minimizeWindow" title="最小化">
            <ChevronDown :size="18" />
          </button>
          <button class="quit-button-header" @click="showQuitConfirmDialog" title="退出应用">
            <Power :size="18" />
          </button>
        </div>
      </div>

      <div class="settings-content">
        <!-- API Configuration - Most Important -->
        <div class="settings-section">
          <div class="section-header">
            <Key :size="16" class="section-icon" />
            API 配置
          </div>

          <!-- Exchange Tabs -->
          <div class="exchange-tabs">
            <button
              v-for="exchange in availableExchanges"
              :key="exchange.type"
              :class="['tab-button', { active: activeExchangeTab === exchange.type }]"
              @click="activeExchangeTab = exchange.type"
            >
              <ExchangeLogo :exchange="exchange.type" size="small" />
              <span class="tab-label">{{ exchange.name }}</span>
            </button>
          </div>

          <!-- Tab Content -->
          <div class="tab-content">
            <!-- Binance -->
            <div v-if="activeExchangeTab === 'binance'" class="exchange-config">
              <div class="setting-item column">
                <label class="input-label">API Key</label>
                <input
                  v-model="exchangeCredentials.binance.apiKey"
                  type="text"
                  class="text-input"
                  placeholder="输入 Binance API Key"
                  @focus="handleSecretFocus('binance', 'apiKey')"
                  @blur="handleSecretBlur('binance', 'apiKey'); saveExchangeCredentials('binance')"
                />
              </div>
              <div class="setting-item column">
                <label class="input-label">API Secret</label>
                <input
                  v-model="exchangeCredentials.binance.apiSecret"
                  type="text"
                  class="text-input"
                  placeholder="输入 Binance API Secret"
                  @focus="handleSecretFocus('binance', 'apiSecret')"
                  @blur="handleSecretBlur('binance', 'apiSecret'); saveExchangeCredentials('binance')"
                />
              </div>
              <button
                v-if="realCredentials.binance.apiKey || realCredentials.binance.apiSecret"
                class="remove-credential-btn"
                @click="removeExchangeCredentials('binance')"
              >
                删除 Binance 凭证
              </button>
            </div>

            <!-- Bybit -->
            <div v-if="activeExchangeTab === 'bybit'" class="exchange-config">
              <div class="setting-item column">
                <label class="input-label">API Key</label>
                <input
                  v-model="exchangeCredentials.bybit.apiKey"
                  type="text"
                  class="text-input"
                  placeholder="输入 Bybit API Key"
                  @focus="handleSecretFocus('bybit', 'apiKey')"
                  @blur="handleSecretBlur('bybit', 'apiKey'); saveExchangeCredentials('bybit')"
                />
              </div>
              <div class="setting-item column">
                <label class="input-label">API Secret</label>
                <input
                  v-model="exchangeCredentials.bybit.apiSecret"
                  type="text"
                  class="text-input"
                  placeholder="输入 Bybit API Secret"
                  @focus="handleSecretFocus('bybit', 'apiSecret')"
                  @blur="handleSecretBlur('bybit', 'apiSecret'); saveExchangeCredentials('bybit')"
                />
              </div>
              <button
                v-if="realCredentials.bybit.apiKey || realCredentials.bybit.apiSecret"
                class="remove-credential-btn"
                @click="removeExchangeCredentials('bybit')"
              >
                删除 Bybit 凭证
              </button>
            </div>

            <!-- OKX -->
            <div v-if="activeExchangeTab === 'okx'" class="exchange-config">
              <div class="setting-item column">
                <label class="input-label">API Key</label>
                <input
                  v-model="exchangeCredentials.okx.apiKey"
                  type="text"
                  class="text-input"
                  placeholder="输入 OKX API Key"
                  @focus="handleSecretFocus('okx', 'apiKey')"
                  @blur="handleSecretBlur('okx', 'apiKey'); saveExchangeCredentials('okx')"
                />
              </div>
              <div class="setting-item column">
                <label class="input-label">API Secret</label>
                <input
                  v-model="exchangeCredentials.okx.apiSecret"
                  type="text"
                  class="text-input"
                  placeholder="输入 OKX API Secret"
                  @focus="handleSecretFocus('okx', 'apiSecret')"
                  @blur="handleSecretBlur('okx', 'apiSecret'); saveExchangeCredentials('okx')"
                />
              </div>
              <div class="setting-item column">
                <label class="input-label">Passphrase</label>
                <input
                  v-model="exchangeCredentials.okx.passphrase"
                  type="text"
                  class="text-input"
                  placeholder="输入 OKX Passphrase"
                  @focus="handleSecretFocus('okx', 'passphrase')"
                  @blur="handleSecretBlur('okx', 'passphrase'); saveExchangeCredentials('okx')"
                />
              </div>
              <button
                v-if="realCredentials.okx.apiKey || realCredentials.okx.apiSecret"
                class="remove-credential-btn"
                @click="removeExchangeCredentials('okx')"
              >
                删除 OKX 凭证
              </button>
            </div>

            <!-- Hyperliquid -->
            <div v-if="activeExchangeTab === 'hyperliquid'" class="exchange-config">
              <div class="setting-item column">
                <label class="input-label">API Key</label>
                <input
                  v-model="exchangeCredentials.hyperliquid.apiKey"
                  type="text"
                  class="text-input"
                  placeholder="输入 Hyperliquid API Key"
                  @focus="handleSecretFocus('hyperliquid', 'apiKey')"
                  @blur="handleSecretBlur('hyperliquid', 'apiKey'); saveExchangeCredentials('hyperliquid')"
                />
              </div>
              <div class="setting-item column">
                <label class="input-label">API Secret</label>
                <input
                  v-model="exchangeCredentials.hyperliquid.apiSecret"
                  type="text"
                  class="text-input"
                  placeholder="输入 Hyperliquid API Secret"
                  @focus="handleSecretFocus('hyperliquid', 'apiSecret')"
                  @blur="handleSecretBlur('hyperliquid', 'apiSecret'); saveExchangeCredentials('hyperliquid')"
                />
              </div>
              <button
                v-if="realCredentials.hyperliquid.apiKey || realCredentials.hyperliquid.apiSecret"
                class="remove-credential-btn"
                @click="removeExchangeCredentials('hyperliquid')"
              >
                删除 Hyperliquid 凭证
              </button>
            </div>
          </div>

          <div class="setting-notice">
            <AlertTriangle :size="16" class="notice-icon-svg" />
            <span>请确保 API Key 仅开启查询权限，不要开启交易权限</span>
          </div>
        </div>

        <!-- Display Settings - Frequently Used -->
        <div class="settings-section">
          <div class="section-header">
            <BarChart3 :size="16" class="section-icon" />
            显示设置
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <Hash :size="18" class="setting-icon-svg" />
              <span>菜单栏显示数量</span>
            </div>
            <select v-model="maxDisplayCount" class="select-input" @change="saveDisplaySettings">
              <option :value="1">1 个</option>
              <option :value="2">2 个</option>
            </select>
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <Clock :size="18" class="setting-icon-svg" />
              <span>刷新间隔</span>
            </div>
            <select v-model="refreshInterval" class="select-input" @change="saveDisplaySettings">
              <option :value="3">3 秒</option>
              <option :value="5">5 秒</option>
              <option :value="10">10 秒</option>
              <option :value="30">30 秒</option>
              <option :value="60">1 分钟</option>
            </select>
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <Eye :size="18" class="setting-icon-svg" />
              <span>隐藏金额</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="hideAmounts" @change="toggleAmountVisibility">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-notice">
            <Info :size="16" class="notice-icon-svg" />
            <span>在菜单栏显示持仓信息（币种 价格 收益 收益率）</span>
          </div>
        </div>

        <!-- Appearance -->
        <div class="settings-section">
          <div class="section-header">
            <Palette :size="16" class="section-icon" />
            外观
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <Moon :size="18" class="setting-icon-svg" />
              <span>深色模式</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="isDarkMode" @change="toggleTheme">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-item column">
            <div class="setting-label-row">
              <label class="input-label">窗口透明度</label>
              <span class="opacity-value">{{ Math.round(windowOpacity * 100) }}%</span>
            </div>
            <input
              type="range"
              v-model.number="windowOpacity"
              @input="updateWindowOpacity"
              min="0.3"
              max="1.0"
              step="0.05"
              class="opacity-slider"
            />
          </div>
        </div>

        <!-- System Settings -->
        <div class="settings-section">
          <div class="section-header">
            <Cpu :size="16" class="section-icon" />
            系统
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <Settings :size="18" class="setting-icon-svg" />
              <span>开机自动启动</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="autoLaunch" @change="toggleAutoLaunch">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-item column">
            <label class="input-label">网络代理（可选）</label>
            <input
              v-model="proxyUrl"
              type="text"
              class="text-input"
              placeholder="例如: http://127.0.0.1:7890"
              @blur="saveProxySettings"
            />
          </div>
          <div class="setting-notice">
            <Info :size="16" class="notice-icon-svg" />
            <span>留空则不使用代理。ClashX 默认端口为 7890</span>
          </div>
        </div>

        <!-- Developer Settings -->
        <!-- AI Settings -->
        <div class="settings-section">
          <div class="section-header">
            <Sparkles :size="16" class="section-icon" />
            AI 分析
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <Bot :size="18" class="setting-icon-svg" />
              <span>启用 AI 功能</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="aiEnabled" @change="toggleAI">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div v-if="aiEnabled" class="ai-settings-content">
            <div class="setting-item">
              <label class="input-label">
                <Cpu :size="14" class="label-icon" />
                默认 AI 模型
              </label>
              <select v-model="defaultAIProvider" @change="saveAISettings" class="input-field">
                <option value="anthropic">Claude (Anthropic)</option>
                <option value="openai">ChatGPT (OpenAI)</option>
                <option value="deepseek">DeepSeek</option>
                <option value="qwen">千问 (Qwen)</option>
                <option value="grok">Grok (xAI)</option>
                <option value="gemini">Gemini (Google)</option>
              </select>
            </div>

            <div class="setting-item">
              <div class="setting-label">
                <Key :size="18" class="setting-icon-svg" />
                <span>使用自定义 API Key</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="useCustomAIKeys" @change="saveAISettings">
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div v-if="useCustomAIKeys" class="ai-providers-config">
              <div class="setting-notice info-notice">
                <Info :size="16" class="notice-icon-svg" />
                <div class="notice-content">
                  <div>配置您的 API Key 以使用 AI 分析功能</div>
                  <div class="notice-links">
                    <span>获取 API Key：</span>
                    <a href="#" @click.prevent="openURL('https://console.anthropic.com/')">Anthropic</a> |
                    <a href="#" @click.prevent="openURL('https://platform.openai.com/api-keys')">OpenAI</a> |
                    <a href="#" @click.prevent="openURL('https://platform.deepseek.com/')">DeepSeek</a>
                  </div>
                </div>
              </div>

              <div class="provider-config" v-for="provider in aiProviders" :key="provider.id">
                <label class="input-label">
                  {{ provider.name }}
                </label>
                <input
                  v-model="aiAPIKeys[provider.id]"
                  type="password"
                  :placeholder="`输入 ${provider.name} API Key`"
                  class="input-field"
                  @blur="saveAISettings"
                />
              </div>
            </div>

            <div v-else class="setting-notice">
              <Info :size="16" class="notice-icon-svg" />
              <span>未配置任何 API Key，请启用"使用自定义 API Key"并配置</span>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="section-header">
            <Wrench :size="16" class="section-icon" />
            开发者
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <Settings :size="18" class="setting-icon-svg" />
              <span>调试模式</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="debugMode" @change="toggleDebugMode">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-notice">
            <Info :size="16" class="notice-icon-svg" />
            <span>开启后将显示开发者工具（DevTools）</span>
          </div>
        </div>

        <!-- About & Data Management -->
        <div class="settings-section">
          <div class="section-header">
            <CircleHelp :size="16" class="section-icon" />
            关于
          </div>
          <div class="setting-item column">
            <div class="about-info">
              <div class="about-row">
                <span class="about-label">应用名称</span>
                <span class="about-value">Trade Realtime View</span>
              </div>
              <div class="about-row">
                <span class="about-label">版本号</span>
                <span class="about-value">v{{ appVersion }}</span>
              </div>
              <div class="about-row">
                <span class="about-label">作者</span>
                <span class="about-value">Wang</span>
              </div>
            </div>
          </div>

          <!-- Donate Section -->
          <div class="setting-item column">
            <label class="input-label">
              <Star :size="14" class="label-icon" />
              打赏支持
            </label>
            <div class="donate-section">
              <div class="donate-address">
                <code class="eth-address">{{ ethAddress }}</code>
                <button class="copy-btn" @click="copyEthAddress" title="复制地址">
                  <span v-if="!copied">复制</span>
                  <span v-else>已复制 ✓</span>
                </button>
              </div>
              <div class="setting-notice">
                <Info :size="16" class="notice-icon-svg" />
                <span>ETH 主网地址，感谢您的支持</span>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="setting-item column">
            <label class="input-label">数据管理</label>
            <div class="action-buttons">
              <button class="action-button secondary" @click="handleResetToDefaults">
                恢复默认设置
              </button>
              <button class="action-button danger" @click="showDeleteConfirm = true">
                删除所有数据
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Panel -->
    <div v-else class="main-panel">
      <div class="main-header">
        <div class="header-left">
          <h1 class="app-title">持仓盈亏</h1>
          <span
            :class="[
              'total-pnl',
              totalPnL > 0 ? 'profit' : totalPnL < 0 ? 'loss' : 'neutral'
            ]"
          >
            {{ maskAmount((totalPnL >= 0 ? '+' : '') + formatNumber(totalPnL, 2) + ' USDT') }}
          </span>
        </div>
        <div class="header-actions">
          <template v-if="isEditMode">
            <button class="action-btn" @click="cancelEditMode" title="取消">
              <X :size="18" />
            </button>
            <button class="action-btn save-btn" @click="saveEditedOrder" title="保存">
              <Save :size="18" />
            </button>
          </template>
          <template v-else>
            <button
              v-if="aiEnabled && hasCredentials && futuresPositions.length > 0"
              class="action-btn ai-btn"
              @click="analyzeHealth"
              :disabled="analyzingHealth || loading"
              title="AI 分析"
            >
              <Sparkles :size="18" :class="{ 'rotating': analyzingHealth }" />
            </button>
            <button
              class="action-btn"
              @click="enterEditMode"
              :disabled="!hasCredentials || !futuresPositions.length"
              title="编辑顺序"
            >
              <Edit :size="18" />
            </button>
            <button
              class="action-btn"
              @click="fetchData"
              :disabled="!hasCredentials || loading"
              title="刷新"
            >
              <RefreshCw :size="18" :class="{ 'rotating': loading }" />
            </button>
            <button class="action-btn" @click="showSettings = true" title="设置">
              <Settings :size="18" />
            </button>
            <button class="action-btn" @click="minimizeWindow" title="最小化">
              <ChevronDown :size="18" />
            </button>
            <button class="action-btn quit-btn" @click="showQuitConfirmDialog" title="退出应用">
              <Power :size="18" />
            </button>
          </template>
        </div>
      </div>

      <div v-if="error" class="error-message">{{ error }}</div>

      <!-- Exchange Errors Banner -->
      <div v-if="exchangeErrors.length > 0 && !isEditMode" class="exchange-errors-banner">
        <div v-for="(exchangeError, index) in exchangeErrors" :key="index" class="exchange-error-item">
          <div class="error-header">
            <AlertTriangle :size="18" class="error-icon" />
            <h4 class="error-title">{{ exchangeError.exchange.toUpperCase() }} 连接失败</h4>
            <button class="close-error-btn" @click="exchangeErrors.splice(index, 1)" title="关闭">
              <X :size="16" />
            </button>
          </div>
          <div class="error-details">
            <p class="error-code">错误代码: {{ exchangeError.errorCode }}</p>
            <p class="error-suggestion">{{ exchangeError.suggestion }}</p>
          </div>
          <div class="error-actions">
            <button class="retry-btn" @click="retryAfterError">
              <RefreshCw :size="16" />
              重新连接
            </button>
            <button class="settings-btn" @click="showSettings = true">
              <Settings :size="16" />
              前往设置
            </button>
          </div>
        </div>
      </div>

      <div v-if="isEditMode" class="edit-mode-hint">
        <Info :size="14" class="hint-icon" />
        <span>使用上下箭头调整持仓顺序，完成后点击保存</span>
      </div>

      <div v-if="!hasCredentials" class="empty-state">
        <Settings :size="52" class="empty-icon-svg" />
        <div class="empty-title">未配置 API</div>
        <div class="empty-desc">请先在设置中配置您的交易所 API Key</div>
        <button class="primary-button" @click="showSettings = true">
          前往设置
        </button>
      </div>

      <div v-else-if="loading && !futuresPositions.length" class="loading-state">
        <div class="spinner"></div>
        <div class="loading-text">加载中...</div>
      </div>

      <div v-else class="positions-list">
        <!-- 账户资产整体容器 -->
        <div v-if="accountInfoList.length > 0 && !isEditMode" class="assets-wrapper">
          <!-- 总资产卡片 - 新设计 -->
          <div class="total-assets-card-new">
            <div class="total-card-header">
              <ExchangeLogo
                v-if="accountInfoList.length === 1"
                :exchange="accountInfoList[0].exchange"
                size="small"
                class="total-card-exchange-logo"
              />
              <span class="total-card-label">总资产</span>
              <button class="toggle-visibility-btn" @click="toggleAmountVisibility" title="隐藏/显示金额">
                <Eye v-if="!hideAmounts" :size="14" />
                <EyeOff v-else :size="14" />
              </button>
            </div>
            <div class="total-card-amount">
              {{ maskAmount(formatNumber(totalAssets.totalAssets, 2)) }}
              <span class="total-card-currency">USDT</span>
            </div>
            <div class="total-card-stats">
              <div class="stat-item">
                <span class="stat-label">现货账户</span>
                <span class="stat-value">
                  {{ maskAmount(formatNumber(totalAssets.spotTotalUSDT, 2)) }}
                </span>
              </div>
              <div class="stat-item">
                <span class="stat-label">合约账户</span>
                <span class="stat-value">
                  {{ maskAmount(formatNumber(totalAssets.totalMarginBalance, 2)) }}
                </span>
              </div>
              <div class="stat-item">
                <span class="stat-label">未实现盈亏</span>
                <span class="stat-value" :class="{
                  'profit': totalAssets.totalUnrealizedProfit > 0,
                  'loss': totalAssets.totalUnrealizedProfit < 0
                }">
                  {{ maskAmount((totalAssets.totalUnrealizedProfit >= 0 ? '+' : '') + formatNumber(totalAssets.totalUnrealizedProfit, 2)) }}
                </span>
              </div>
              <div class="stat-item">
                <span class="stat-label">可用余额</span>
                <span class="stat-value">
                  {{ maskAmount(formatNumber(totalAssets.availableBalance, 2)) }}
                </span>
              </div>
            </div>
          </div>

          <!-- 各交易所资产卡片 - 新设计 (只在多个交易所时显示) -->
          <div v-if="accountInfoList.length > 1" class="exchanges-grid">
            <div
              v-for="accountInfo in accountInfoList"
              :key="accountInfo.exchange"
              class="exchange-card-new"
            >
              <div class="exchange-card-top">
                <div class="exchange-identity">
                  <ExchangeLogo :exchange="accountInfo.exchange" size="medium" />
                  <span class="exchange-card-name">{{ ExchangeNames[accountInfo.exchange] }}</span>
                </div>
              </div>
              <div class="exchange-card-body">
                <div class="exchange-stat">
                  <span class="exchange-stat-label">总资产</span>
                  <span class="exchange-stat-value">
                    {{ maskAmount(formatNumber(accountInfo.totalAssets || accountInfo.totalMarginBalance, 2)) }}
                  </span>
                </div>
                <!-- OKX显示资金账户和交易账户 -->
                <template v-if="accountInfo.exchange === 'okx'">
                  <div class="exchange-stat">
                    <span class="exchange-stat-label">资金账户</span>
                    <span class="exchange-stat-value">
                      {{ maskAmount(formatNumber(accountInfo.fundingAccountUSDT || 0, 2)) }}
                    </span>
                  </div>
                  <div class="exchange-stat">
                    <span class="exchange-stat-label">交易账户</span>
                    <span class="exchange-stat-value">
                      {{ maskAmount(formatNumber(accountInfo.tradingAccountUSDT || 0, 2)) }}
                    </span>
                  </div>
                </template>
                <!-- 其他交易所显示现货和合约 -->
                <template v-else>
                  <div class="exchange-stat">
                    <span class="exchange-stat-label">现货</span>
                    <span class="exchange-stat-value">
                      {{ maskAmount(formatNumber(accountInfo.spotTotalUSDT || 0, 2)) }}
                    </span>
                  </div>
                  <div class="exchange-stat">
                    <span class="exchange-stat-label">合约</span>
                    <span class="exchange-stat-value">
                      {{ maskAmount(formatNumber(accountInfo.totalMarginBalance, 2)) }}
                    </span>
                  </div>
                </template>
                <div class="exchange-stat">
                  <span class="exchange-stat-label">PNL</span>
                  <span class="exchange-stat-value" :class="{
                    'profit': accountInfo.totalUnrealizedProfit > 0,
                    'loss': accountInfo.totalUnrealizedProfit < 0
                  }">
                    {{ maskAmount((accountInfo.totalUnrealizedProfit >= 0 ? '+' : '') + formatNumber(accountInfo.totalUnrealizedProfit, 2)) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 持仓列表区域 -->
        <div v-if="sortedPositions.length > 0" class="positions-section">
          <div class="positions-section-header">
            <span class="positions-section-title">持仓列表</span>
            <span class="positions-count">{{ sortedPositions.length }}</span>
          </div>
          <div
            v-for="(position, index) in sortedPositions"
            :key="position.symbol"
            class="position-card"
            :class="{
              'is-profit': !isEditMode && parseFloat(position.unRealizedProfit) > 0,
              'is-loss': !isEditMode && parseFloat(position.unRealizedProfit) < 0,
              'is-neutral': !isEditMode && parseFloat(position.unRealizedProfit) === 0,
              'edit-mode-card': isEditMode
            }"
          >
            <!-- 编辑模式：简化显示 -->
            <div v-if="isEditMode" class="edit-mode-content">
              <div class="edit-controls">
                <button
                  class="edit-control-btn"
                  @click="movePositionUp(index)"
                  :disabled="index === 0"
                  title="上移"
                >
                  <ChevronUp :size="18" />
                </button>
                <button
                  class="edit-control-btn"
                  @click="movePositionDown(index)"
                  :disabled="index === sortedPositions.length - 1"
                  title="下移"
                >
                  <ChevronDown :size="18" />
                </button>
              </div>
              <div class="edit-symbol-info">
                <span class="edit-symbol-name">{{ formatSymbol(position.symbol) }}</span>
                <span class="edit-tag">{{ position.leverage }}x</span>
                <span class="edit-tag" :class="parseFloat(position.positionAmt) > 0 ? 'long' : 'short'">
                  {{ parseFloat(position.positionAmt) > 0 ? '多' : '空' }}
                </span>
              </div>
            </div>

            <!-- 正常模式：完整显示 -->
            <template v-else>
              <div class="card-header">
                <div class="symbol-info">
                  <ExchangeLogo :exchange="position.exchange" size="small" />
                  <span class="symbol-name">{{ formatSymbol(position.symbol) }}</span>
                  <span class="tag tag-leverage">{{ position.leverage }}x</span>
                  <span class="tag tag-side" :class="parseFloat(position.positionAmt) > 0 ? 'long' : 'short'">
                    {{ parseFloat(position.positionAmt) > 0 ? '多' : '空' }}
                  </span>
                </div>
                <div class="pnl-info">
                  <span class="pnl-amount" :class="{
                    'text-green': parseFloat(position.unRealizedProfit) > 0,
                    'text-red': parseFloat(position.unRealizedProfit) < 0,
                    'text-gray': parseFloat(position.unRealizedProfit) === 0
                  }">
                    {{ maskAmount((parseFloat(position.unRealizedProfit) >= 0 ? '+' : '') + formatNumber(parseFloat(position.unRealizedProfit), 2) + ' USDT') }}
                  </span>
                  <span class="pnl-percent" :class="{
                    'text-green': parseFloat(position.unRealizedProfit) > 0,
                    'text-red': parseFloat(position.unRealizedProfit) < 0,
                    'text-gray': parseFloat(position.unRealizedProfit) === 0
                  }">
                    {{ getPnLPercent(position) }}%
                  </span>
                </div>
              </div>

              <div class="card-grid">
                <div class="data-item">
                  <span class="data-label">开仓价</span>
                  <span class="data-value">{{ formatPrice(position.entryPrice) }}</span>
                </div>
                <div class="data-item">
                  <span class="data-label">当前价</span>
                  <span class="data-value">{{ formatPrice(position.markPrice) }}</span>
                </div>
                <div class="data-item">
                  <span class="data-label">持仓量</span>
                  <span class="data-value">{{ formatPositionValue(position) }} <span class="unit">USDT</span></span>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div v-else class="empty-state">
          <Inbox :size="52" class="empty-icon-svg" />
          <div class="empty-title">暂无持仓</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, toRaw } from 'vue';
import {
  ChevronLeft,
  Moon,
  AlertTriangle,
  Info,
  Hash,
  Clock,
  RefreshCw,
  Settings,
  Power,
  ChevronUp,
  ChevronDown,
  Edit,
  Save,
  X,
  Eye,
  EyeOff,
  Key,
  BarChart3,
  Palette,
  Cpu,
  Wrench,
  CircleHelp,
  Star,
  Sparkles,
  Bot,
  Inbox
} from 'lucide-vue-next';
import ExchangeLogo from './components/ExchangeLogo.vue';
import NotificationCenter from './components/NotificationCenter.vue';

// 交易所类型
enum ExchangeType {
  BINANCE = 'binance',
  BYBIT = 'bybit',
  OKX = 'okx',
  HYPERLIQUID = 'hyperliquid',
}

// 交易所名称映射
const ExchangeNames: Record<ExchangeType, string> = {
  [ExchangeType.BINANCE]: '币安',
  [ExchangeType.BYBIT]: 'Bybit',
  [ExchangeType.OKX]: 'OKX',
  [ExchangeType.HYPERLIQUID]: 'Hyperliquid',
};

// 交易所颜色标识
const ExchangeColors: Record<ExchangeType, string> = {
  [ExchangeType.BINANCE]: '#F3BA2F',
  [ExchangeType.BYBIT]: '#F7A600',
  [ExchangeType.OKX]: '#000000',
  [ExchangeType.HYPERLIQUID]: '#00D4AA',
};

interface FuturesPosition {
  exchange: ExchangeType;
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  marginType: string;
  isolatedMargin: string;
  leverage: string;
}

interface AccountInfo {
  exchange: ExchangeType;
  totalWalletBalance: number;
  totalUnrealizedProfit: number;
  totalMarginBalance: number;
  availableBalance: number;
  maxWithdrawAmount: number;
  spotTotalUSDT?: number;          // 现货账户总资产（USDT价值）
  totalAssets?: number;            // 总资产（现货+合约，USDT价值）

  // OKX专用字段
  fundingAccountUSDT?: number;     // 资金账户（USDT价值）
  tradingAccountUSDT?: number;     // 交易账户（USDT价值）
}

// State
const showSettings = ref(false);
const apiKey = ref('');
const apiSecret = ref('');
const proxyUrl = ref('');
const isDarkMode = ref(false);
const maxDisplayCount = ref(2);
const refreshInterval = ref(5); // 默认5秒
const loading = ref(false);
const error = ref('');
const hasCredentials = ref(false);
const futuresPositions = ref<FuturesPosition[]>([]);
const accountInfoList = ref<AccountInfo[]>([]); // 账户信息列表（多个交易所）
const customPositionOrder = ref<string[]>([]); // 用户自定义的持仓顺序（symbol数组）
const showQuitConfirm = ref(false); // 显示退出确认对话框
const isEditMode = ref(false); // 是否处于编辑模式
const editingOrder = ref<string[]>([]); // 编辑中的临时顺序
const hideAmounts = ref(false); // 是否隐藏金额数字
const debugMode = ref(false); // 是否开启调试模式
const windowOpacity = ref(1.0); // 窗口透明度
const autoLaunch = ref(false); // 是否开机自动启动
const appVersion = ref('1.0.0'); // 应用版本号
const ethAddress = ref('0xC471515aa7B64832c0550814C230bEA1376cbbD3'); // ETH 打赏地址
const copied = ref(false); // 是否已复制地址

// AI 相关状态
const aiEnabled = ref(false); // AI功能是否启用
const defaultAIProvider = ref('anthropic'); // 默认AI提供商
const useCustomAIKeys = ref(false); // 是否使用自定义API Key
const aiAPIKeys = ref({
  openai: '',
  anthropic: '',
  deepseek: '',
  qwen: '',
  grok: '',
  gemini: ''
});
const aiProviders = [
  { id: 'openai', name: 'OpenAI (ChatGPT)' },
  { id: 'anthropic', name: 'Anthropic (Claude)' },
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'qwen', name: '千问 (Qwen)' },
  { id: 'grok', name: 'Grok (xAI)' },
  { id: 'gemini', name: 'Google Gemini' }
];
const showDeleteConfirm = ref(false); // 显示删除所有数据确认对话框

// AI 健康度分析相关
const showHealthAnalysis = ref(false); // 显示健康度分析对话框
const analyzingHealth = ref(false); // 是否正在分析中
const healthScore = ref<any>(null); // 健康度分析结果

// 错误处理相关
const exchangeErrors = ref<any[]>([]); // 交易所错误列表

// 通知中心引用
const notificationCenter = ref<any>(null);

let panelRefreshInterval: NodeJS.Timeout | null = null;

// 多交易所支持
const activeExchangeTab = ref<'binance' | 'bybit' | 'okx' | 'hyperliquid'>('binance');
const availableExchanges = [
  { type: 'binance' as const, name: 'Binance' },
  { type: 'bybit' as const, name: 'Bybit' },
  { type: 'okx' as const, name: 'OKX' },
  { type: 'hyperliquid' as const, name: 'Hyperliquid' },
];

const exchangeCredentials = ref({
  binance: { apiKey: '', apiSecret: '' },
  bybit: { apiKey: '', apiSecret: '' },
  okx: { apiKey: '', apiSecret: '', passphrase: '' },
  hyperliquid: { apiKey: '', apiSecret: '' },
});

// 用于跟踪哪些字段正在被编辑
const editingFields = ref({
  binance: { apiKey: false, apiSecret: false },
  bybit: { apiKey: false, apiSecret: false },
  okx: { apiKey: false, apiSecret: false, passphrase: false },
  hyperliquid: { apiKey: false, apiSecret: false },
});

// 真实的完整凭证（用于保存）
const realCredentials = ref({
  binance: { apiKey: '', apiSecret: '' },
  bybit: { apiKey: '', apiSecret: '' },
  okx: { apiKey: '', apiSecret: '', passphrase: '' },
  hyperliquid: { apiKey: '', apiSecret: '' },
});

// Computed
const totalPnL = computed(() => {
  return futuresPositions.value.reduce((sum, position) => {
    return sum + parseFloat(position.unRealizedProfit);
  }, 0);
});

// 计算所有交易所的总资产
const totalAssets = computed(() => {
  if (accountInfoList.value.length === 0) {
    return {
      totalAssets: 0,              // 总资产（现货+合约）
      totalMarginBalance: 0,       // 合约账户总资产
      spotTotalUSDT: 0,            // 现货账户总资产
      availableBalance: 0,
      totalUnrealizedProfit: 0,
    };
  }

  return accountInfoList.value.reduce(
    (acc, account) => ({
      totalAssets: acc.totalAssets + (account.totalAssets || 0),
      totalMarginBalance: acc.totalMarginBalance + account.totalMarginBalance,
      spotTotalUSDT: acc.spotTotalUSDT + (account.spotTotalUSDT || 0),
      availableBalance: acc.availableBalance + account.availableBalance,
      totalUnrealizedProfit: acc.totalUnrealizedProfit + account.totalUnrealizedProfit,
    }),
    { totalAssets: 0, totalMarginBalance: 0, spotTotalUSDT: 0, availableBalance: 0, totalUnrealizedProfit: 0 }
  );
});

// 按自定义顺序排序的持仓列表
const sortedPositions = computed(() => {
  // 在编辑模式下使用临时顺序，否则使用保存的顺序
  const orderToUse = isEditMode.value ? editingOrder.value : customPositionOrder.value;

  if (orderToUse.length === 0) {
    return futuresPositions.value;
  }

  // 按照顺序排序
  const ordered: FuturesPosition[] = [];
  const symbolMap = new Map<string, FuturesPosition>();

  futuresPositions.value.forEach(pos => {
    symbolMap.set(pos.symbol, pos);
  });

  // 先添加顺序中的持仓
  orderToUse.forEach(symbol => {
    const pos = symbolMap.get(symbol);
    if (pos) {
      ordered.push(pos);
      symbolMap.delete(symbol);
    }
  });

  // 再添加新的持仓（不在顺序中的）
  symbolMap.forEach(pos => {
    ordered.push(pos);
  });

  return ordered;
});

// Helper Functions
const formatSymbol = (symbol: string) => {
  return symbol.replace('USDT', '').replace('BUSD', '');
};

// 根据评分返回CSS类
const getScoreClass = (score: number) => {
  if (score >= 80) return 'score-excellent';
  if (score >= 60) return 'score-good';
  if (score >= 40) return 'score-fair';
  return 'score-poor';
};

// 格式化密钥显示（显示前4位和后4位，中间用****代替）
const maskSecret = (secret: string): string => {
  if (!secret || secret.length <= 8) {
    return secret;
  }
  const start = secret.substring(0, 4);
  const end = secret.substring(secret.length - 4);
  return `${start}****${end}`;
};

// 处理密钥输入框的focus事件
const handleSecretFocus = (
  exchange: 'binance' | 'bybit' | 'okx' | 'hyperliquid',
  field: string
) => {
  // 标记为正在编辑
  (editingFields.value[exchange] as any)[field] = true;
  // 显示真实值
  (exchangeCredentials.value[exchange] as any)[field] = (realCredentials.value[exchange] as any)[field];
};

// 处理密钥输入框的blur事件
const handleSecretBlur = (
  exchange: 'binance' | 'bybit' | 'okx' | 'hyperliquid',
  field: string
) => {
  // 保存真实值
  const realValue = (exchangeCredentials.value[exchange] as any)[field];
  (realCredentials.value[exchange] as any)[field] = realValue;

  // 标记为不在编辑
  (editingFields.value[exchange] as any)[field] = false;

  // 显示遮蔽值
  if (realValue) {
    (exchangeCredentials.value[exchange] as any)[field] = maskSecret(realValue);
  }
};

// 动态格式化价格 - 根据价格大小决定小数位数
const formatPrice = (priceStr: string) => {
  const price = parseFloat(priceStr);
  if (price >= 1000) return price.toFixed(2);      // 大于1000: 2位小数
  if (price >= 1) return price.toFixed(4);         // 1-1000: 4位小数
  if (price >= 0.01) return price.toFixed(6);      // 0.01-1: 6位小数
  return price.toFixed(8);                          // 小于0.01: 8位小数
};

// 格式化数字
const formatNumber = (num: number, decimals: number = 2) => {
  return num.toFixed(decimals);
};

// 隐藏金额（显示为星号）
const maskAmount = (amount: string) => {
  if (!hideAmounts.value) return amount;
  return '****';
};

// 切换金额显示/隐藏
const toggleAmountVisibility = async () => {
  hideAmounts.value = !hideAmounts.value;

  if ((window as any).electronAPI) {
    await (window as any).electronAPI.saveHideAmounts(hideAmounts.value);
  }
};

// 计算持仓价值（USDT）
const formatPositionValue = (position: FuturesPosition) => {
  const positionAmt = Math.abs(parseFloat(position.positionAmt));
  const markPrice = parseFloat(position.markPrice);
  const value = positionAmt * markPrice;
  return formatNumber(value, 2);
};

const getPnLPercent = (position: FuturesPosition) => {
  const entry = parseFloat(position.entryPrice);
  const mark = parseFloat(position.markPrice);
  const posAmt = parseFloat(position.positionAmt);

  const pnlPercent = posAmt > 0
    ? ((mark - entry) / entry) * 100
    : ((entry - mark) / entry) * 100;

  return (pnlPercent >= 0 ? '+' : '') + pnlPercent.toFixed(2);
};

const getPnLClass = (pnl: string) => {
  const value = parseFloat(pnl);
  return value >= 0 ? 'profit' : 'loss';
};

// 进入编辑模式
const enterEditMode = () => {
  // 初始化编辑顺序
  if (customPositionOrder.value.length > 0) {
    editingOrder.value = [...customPositionOrder.value];
  } else {
    editingOrder.value = sortedPositions.value.map(p => p.symbol);
  }
  isEditMode.value = true;
};

// 退出编辑模式（取消）
const cancelEditMode = () => {
  isEditMode.value = false;
  editingOrder.value = [];
};

// 保存编辑后的顺序
const saveEditedOrder = async () => {
  customPositionOrder.value = [...editingOrder.value];
  await savePositionOrder();
  isEditMode.value = false;
  editingOrder.value = [];
};

// 移动持仓上移（仅在编辑模式下）
const movePositionUp = (index: number) => {
  if (index === 0) return;

  // 交换位置
  const temp = editingOrder.value[index];
  editingOrder.value[index] = editingOrder.value[index - 1];
  editingOrder.value[index - 1] = temp;
};

// 移动持仓下移（仅在编辑模式下）
const movePositionDown = (index: number) => {
  if (index >= sortedPositions.value.length - 1) return;

  // 交换位置
  const temp = editingOrder.value[index];
  editingOrder.value[index] = editingOrder.value[index + 1];
  editingOrder.value[index + 1] = temp;
};

// 保存持仓顺序到本地存储
const savePositionOrder = async () => {
  if (!(window as any).electronAPI) {
    return;
  }

  try {
    // 确保传递的是纯数组，不包含响应式代理
    const orderArray = [...customPositionOrder.value];
    await (window as any).electronAPI.savePositionOrder(orderArray);
    console.log('[Position Order] Saved:', orderArray);
  } catch (err: any) {
    console.error('[Position Order] Failed to save:', err);
  }
};

// Theme
const toggleTheme = async () => {
  const theme = isDarkMode.value ? 'dark' : 'light';

  if ((window as any).electronAPI) {
    await (window as any).electronAPI.saveTheme(theme);
  }
};

// Debug Mode
const toggleDebugMode = async () => {
  if ((window as any).electronAPI) {
    await (window as any).electronAPI.saveDebugMode(debugMode.value);
  }
};

// ============ AI 相关函数 ============

/**
 * 加载AI设置
 */
const loadAISettings = async () => {
  if ((window as any).electronAPI && (window as any).electronAPI.getAISettings) {
    try {
      const settings = await (window as any).electronAPI.getAISettings();
      if (settings) {
        aiEnabled.value = settings.enabled || false;
        defaultAIProvider.value = settings.defaultProvider || 'anthropic';
        useCustomAIKeys.value = settings.useCustomKeys || false;

        // 加载各个provider的API key
        if (settings.credentials) {
          Object.keys(aiAPIKeys.value).forEach(provider => {
            const cred = settings.credentials[provider];
            if (cred && cred.apiKey) {
              (aiAPIKeys.value as any)[provider] = cred.apiKey;
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to load AI settings:', error);
    }
  }
};

/**
 * 保存AI设置
 */
const saveAISettings = async () => {
  if ((window as any).electronAPI && (window as any).electronAPI.saveAISettings) {
    try {
      const credentials: any = {};

      // 构建credentials对象
      Object.keys(aiAPIKeys.value).forEach(provider => {
        credentials[provider] = {
          provider,
          apiKey: (aiAPIKeys.value as any)[provider] || '',
        };
      });

      const settings = {
        enabled: aiEnabled.value,
        defaultProvider: defaultAIProvider.value,
        useCustomKeys: useCustomAIKeys.value,
        credentials,
      };

      await (window as any).electronAPI.saveAISettings(settings);
      console.log('AI settings saved');

      // 显示保存成功通知
      notificationCenter.value?.addNotification({
        type: 'success',
        title: 'AI 设置已保存',
        message: `已${aiEnabled.value ? '启用' : '禁用'} AI 功能`,
      });
    } catch (error) {
      console.error('Failed to save AI settings:', error);

      notificationCenter.value?.addNotification({
        type: 'error',
        title: 'AI 设置保存失败',
        message: '保存配置时发生错误，请重试',
        persistent: true,
      });
    }
  }
};

/**
 * 切换AI启用状态
 */
const toggleAI = async () => {
  await saveAISettings();
};

/**
 * 打开外部链接
 */
const openURL = (url: string) => {
  if ((window as any).electronAPI && (window as any).electronAPI.openExternal) {
    (window as any).electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank');
  }
};

/**
 * 执行AI健康度分析
 */
const analyzeHealth = async () => {
  if (!(window as any).electronAPI) {
    return;
  }

  // 检查是否有配置的 API Key
  const hasAnyAPIKey = Object.values(aiAPIKeys.value).some(key => key && key.trim() !== '');

  // 检查AI是否启用或是否有API Key
  if (!aiEnabled.value || !hasAnyAPIKey) {
    notificationCenter.value?.addNotification({
      type: 'info',
      title: 'AI 功能未配置',
      message: '请在设置中配置 AI 功能：\n\n1. 启用 AI 功能开关\n2. 选择 AI 模型（推荐 Claude 或 DeepSeek）\n3. 勾选"使用自定义 API Key"\n4. 输入对应的 API Key',
      persistent: true,
      spotlight: true, // 使用聚光灯效果（屏幕中间大显示）
    });
    showSettings.value = true; // 自动打开设置页面
    return;
  }

  try {
    analyzingHealth.value = true;
    error.value = '';

    // 将Vue响应式对象转换为纯JavaScript对象
    // 使用 toRaw() 获取响应式代理的原始对象
    const positions = toRaw(futuresPositions.value);

    // 构建汇总的账户信息（合并所有交易所的数据）
    const aggregatedAccountInfo = {
      exchange: 'ALL' as any, // 表示汇总所有交易所
      totalWalletBalance: totalAssets.value.totalMarginBalance,
      totalUnrealizedProfit: totalAssets.value.totalUnrealizedProfit,
      totalMarginBalance: totalAssets.value.totalMarginBalance,
      availableBalance: totalAssets.value.availableBalance,
      maxWithdrawAmount: totalAssets.value.availableBalance,
      spotTotalUSDT: totalAssets.value.spotTotalUSDT,
      totalAssets: totalAssets.value.totalAssets,
    };

    console.log('[AI] Sending analysis request:', {
      positionsCount: positions.length,
      accountInfo: aggregatedAccountInfo,
    });

    // 调用AI分析服务
    const result = await (window as any).electronAPI.aiAnalyzeHealth(
      positions,
      aggregatedAccountInfo,
      defaultAIProvider.value
    );

    if (result.success) {
      healthScore.value = result.data;
      showHealthAnalysis.value = true; // 直接打开分析弹框
      console.log('[AI] Health analysis completed:', result.data);

      // 不显示 Toast 通知，避免重复（已经打开了弹框）
      // 但保存到通知历史中，方便用户后续查看
      notificationCenter.value?.addNotification({
        type: 'success',
        title: 'AI 分析完成',
        message: `持仓健康度评分：${result.data.overallScore}/100\n${result.data.summary || ''}`,
        actionLabel: '查看详情',
        persistent: true, // 不自动显示为 Toast
        spotlight: false, // 不显示聚光灯
        onAction: () => {
          showHealthAnalysis.value = true;
        },
      });
    } else {
      console.error('[AI] Analysis failed:', result.error);

      // 根据错误类型显示不同的提示
      let errorMessage = result.error || '未知错误';
      let actionMessage = '';

      if (errorMessage.includes('not initialized') || errorMessage.includes('not configured')) {
        errorMessage = 'AI 服务未配置';
        actionMessage = '请在设置中配置 API Key';
      } else if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
        errorMessage = 'API 访问被拒绝 (403)';
        actionMessage = `可能的原因：
1. API Key 格式错误（Claude 需要 sk-ant-api03-xxx 格式）
2. API Key 无效或已过期
3. 账户余额不足或被限制
4. baseURL 配置错误（如使用了代理）

请检查您的 API Key 配置`;
      } else if (errorMessage.includes('API key') || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'API 认证失败 (401)';
        actionMessage = '请检查您的 API Key 是否正确';
      } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
        errorMessage = '网络请求超时';
        actionMessage = '请检查网络连接或稍后重试';
      }

      notificationCenter.value?.addNotification({
        type: 'error',
        title: 'AI 分析失败',
        message: `${errorMessage}${actionMessage ? '\n' + actionMessage : ''}`,
        persistent: true,
        spotlight: true, // 使用聚光灯效果
      });

      // 如果是配置问题，打开设置页面
      if (errorMessage.includes('未配置') || errorMessage.includes('认证失败')) {
        showSettings.value = true;
      }
    }
  } catch (err: any) {
    console.error('[AI] Analysis error:', err);

    notificationCenter.value?.addNotification({
      type: 'error',
      title: 'AI 分析出错',
      message: err.message || '执行分析时发生未知错误',
      persistent: true,
      spotlight: true,
    });
  } finally {
    analyzingHealth.value = false;
  }
};

// Window Opacity
const updateWindowOpacity = async () => {
  if ((window as any).electronAPI) {
    await (window as any).electronAPI.saveWindowOpacity(windowOpacity.value);
  }
};

// Auto Launch
const toggleAutoLaunch = async () => {
  if ((window as any).electronAPI) {
    await (window as any).electronAPI.saveAutoLaunch(autoLaunch.value);
  }
};

// Copy ETH Address
const copyEthAddress = async () => {
  try {
    await navigator.clipboard.writeText(ethAddress.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy address:', err);
  }
};

// Reset to Defaults
const handleResetToDefaults = async () => {
  if (!(window as any).electronAPI) {
    return;
  }

  try {
    await (window as any).electronAPI.resetToDefaults();

    // 重新加载所有设置
    const settings = await (window as any).electronAPI.getDisplaySettings();
    if (settings) {
      maxDisplayCount.value = settings.maxDisplayCount || 2;
      refreshInterval.value = settings.refreshInterval || 5;
    }

    const theme = await (window as any).electronAPI.getTheme();
    if (theme === 'dark') {
      isDarkMode.value = true;
    } else if (theme === 'light') {
      isDarkMode.value = false;
    }

    const savedHideAmounts = await (window as any).electronAPI.getHideAmounts();
    hideAmounts.value = savedHideAmounts;

    const savedDebugMode = await (window as any).electronAPI.getDebugMode();
    debugMode.value = savedDebugMode;

    const savedOpacity = await (window as any).electronAPI.getWindowOpacity();
    windowOpacity.value = savedOpacity;

    const savedAutoLaunch = await (window as any).electronAPI.getAutoLaunch();
    autoLaunch.value = savedAutoLaunch;

    console.log('[Settings] Reset to defaults completed');
  } catch (err: any) {
    error.value = '恢复默认设置失败: ' + err.message;
  }
};

// Confirm Delete All Data
const confirmDeleteAll = async () => {
  if (!(window as any).electronAPI) {
    return;
  }

  try {
    const result = await (window as any).electronAPI.deleteAllData();
    showDeleteConfirm.value = false;

    if (result.success) {
      // 清空所有本地状态
      apiKey.value = '';
      apiSecret.value = '';
      proxyUrl.value = '';
      hasCredentials.value = false;
      futuresPositions.value = [];
      accountInfoList.value = [];
      customPositionOrder.value = [];
      exchangeErrors.value = [];

      // 清空所有交易所的凭证显示
      exchangeCredentials.value = {
        binance: { apiKey: '', apiSecret: '' },
        bybit: { apiKey: '', apiSecret: '' },
        okx: { apiKey: '', apiSecret: '', passphrase: '' },
        hyperliquid: { apiKey: '', apiSecret: '' },
      };
      realCredentials.value = {
        binance: { apiKey: '', apiSecret: '' },
        bybit: { apiKey: '', apiSecret: '' },
        okx: { apiKey: '', apiSecret: '', passphrase: '' },
        hyperliquid: { apiKey: '', apiSecret: '' },
      };

      // 清空 localStorage 中的代理设置
      localStorage.removeItem('proxyUrl');

      console.log('[Settings] All data deleted successfully');

      // 显示成功通知
      notificationCenter.value?.addNotification({
        type: 'success',
        title: '数据已清空',
        message: '所有 API 凭证和设置已删除',
      });
    } else {
      throw new Error(result.error || '删除失败');
    }
  } catch (err: any) {
    error.value = '删除数据失败: ' + err.message;

    notificationCenter.value?.addNotification({
      type: 'error',
      title: '删除失败',
      message: err.message || '删除数据时发生错误',
      persistent: true,
    });
  }
};

const loadTheme = async () => {
  if (!(window as any).electronAPI) {
    // 如果没有 electronAPI，默认深色模式
    isDarkMode.value = true;
    return;
  }

  try {
    const savedTheme = await (window as any).electronAPI.getTheme();
    if (savedTheme === 'dark') {
      isDarkMode.value = true;
    } else if (savedTheme === 'light') {
      isDarkMode.value = false;
    } else if (savedTheme === 'auto') {
      // auto - 跟随系统
      isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      // 首次启动，没有保存的主题 - 默认深色模式
      isDarkMode.value = true;
    }
  } catch (err) {
    console.error('Failed to load theme:', err);
    // 出错时默认深色模式
    isDarkMode.value = true;
  }
};

// Settings
// 显示退出确认对话框
const showQuitConfirmDialog = () => {
  showQuitConfirm.value = true;
};

// 取消退出
const cancelQuit = () => {
  showQuitConfirm.value = false;
};

// 最小化窗口
const minimizeWindow = async () => {
  if ((window as any).electronAPI && (window as any).electronAPI.minimizeWindow) {
    await (window as any).electronAPI.minimizeWindow();
  }
};

// 确认退出应用
const confirmQuitApp = async () => {
  if (!(window as any).electronAPI) {
    return;
  }

  try {
    await (window as any).electronAPI.quitApp();
  } catch (err) {
    console.error('Failed to quit app:', err);
  }
};

// 保存 API 凭证 (旧版，向后兼容)
const saveApiCredentials = async () => {
  if (!apiKey.value || !apiSecret.value) {
    return; // 静默失败，用户还在输入
  }

  if (!(window as any).electronAPI) {
    return;
  }

  try {
    // 保存 API Keys 和代理地址
    await (window as any).electronAPI.saveApiKeys(apiKey.value, apiSecret.value, proxyUrl.value.trim());

    hasCredentials.value = true;
    error.value = '';

    // 重新启动面板刷新定时器
    startPanelRefresh();
    fetchData();

    console.log('[Settings] API credentials saved');
  } catch (err: any) {
    error.value = '保存 API 失败: ' + err.message;
  }
};

// 保存单个交易所的凭证
const saveExchangeCredentials = async (exchange: 'binance' | 'bybit' | 'okx' | 'hyperliquid') => {
  // 使用真实凭证进行保存
  const credentials = realCredentials.value[exchange];

  if (!credentials.apiKey || !credentials.apiSecret) {
    return; // 静默失败，用户还在输入
  }

  if (!(window as any).electronAPI) {
    return;
  }

  try {
    // 添加代理URL
    const credentialsWithProxy = {
      ...credentials,
      proxyUrl: proxyUrl.value.trim(),
    };

    await (window as any).electronAPI.saveExchangeCredentials(exchange, credentialsWithProxy);

    hasCredentials.value = true;
    error.value = '';

    // 重新启动面板刷新定时器
    startPanelRefresh();
    fetchData();

    console.log(`[Settings] ${exchange} credentials saved`);

    // 显示成功通知
    const exchangeNames: any = {
      'binance': 'Binance',
      'bybit': 'Bybit',
      'okx': 'OKX',
      'hyperliquid': 'Hyperliquid',
    };
    notificationCenter.value?.addNotification({
      type: 'success',
      title: 'API 凭证已保存',
      message: `${exchangeNames[exchange]} 的 API 凭证已成功保存`,
    });
  } catch (err: any) {
    error.value = `保存 ${exchange} API 失败: ${err.message}`;

    notificationCenter.value?.addNotification({
      type: 'error',
      title: 'API 保存失败',
      message: `保存 ${exchange.toUpperCase()} API 凭证时发生错误`,
      persistent: true,
    });
  }
};

// 删除单个交易所的凭证
const removeExchangeCredentials = async (exchange: 'binance' | 'bybit' | 'okx' | 'hyperliquid') => {
  if (!(window as any).electronAPI) {
    return;
  }

  try {
    await (window as any).electronAPI.removeExchangeCredentials(exchange);

    // 清空真实凭证和显示凭证
    if (exchange === 'okx') {
      realCredentials.value[exchange] = { apiKey: '', apiSecret: '', passphrase: '' };
      exchangeCredentials.value[exchange] = { apiKey: '', apiSecret: '', passphrase: '' };
    } else {
      (realCredentials.value[exchange] as any) = { apiKey: '', apiSecret: '' };
      (exchangeCredentials.value[exchange] as any) = { apiKey: '', apiSecret: '' };
    }

    // 刷新数据
    fetchData();

    console.log(`[Settings] ${exchange} credentials removed`);

    // 显示成功通知
    const exchangeNames: any = {
      'binance': 'Binance',
      'bybit': 'Bybit',
      'okx': 'OKX',
      'hyperliquid': 'Hyperliquid',
    };
    notificationCenter.value?.addNotification({
      type: 'success',
      title: '凭证已删除',
      message: `已删除 ${exchangeNames[exchange]} 的 API 凭证`,
    });
  } catch (err: any) {
    error.value = `删除 ${exchange} API 失败: ${err.message}`;

    notificationCenter.value?.addNotification({
      type: 'error',
      title: '删除失败',
      message: `删除 ${exchange.toUpperCase()} API 凭证时发生错误`,
      persistent: true,
    });
  }
};

// 保存代理设置
const saveProxySettings = async () => {
  if (!(window as any).electronAPI) {
    return;
  }

  try {
    const trimmedProxy = proxyUrl.value.trim();

    // 保存到 localStorage（前端记忆）
    if (trimmedProxy) {
      localStorage.setItem('proxyUrl', trimmedProxy);
    } else {
      localStorage.removeItem('proxyUrl');
    }

    // 保存到后端并应用到所有交易所
    if ((window as any).electronAPI.saveProxySettings) {
      const result = await (window as any).electronAPI.saveProxySettings(trimmedProxy);
      if (result.success) {
        console.log('[Proxy] Proxy settings saved and applied');

        // 显示成功通知
        notificationCenter.value?.addNotification({
          type: 'success',
          title: trimmedProxy ? '代理已设置' : '代理已清除',
          message: trimmedProxy
            ? `已应用代理：${trimmedProxy}`
            : '已清除代理配置，使用直连',
        });
      }
    } else {
      // 降级：如果没有专门的 API，用旧方法
      if (apiKey.value && apiSecret.value) {
        await (window as any).electronAPI.saveApiKeys(apiKey.value, apiSecret.value, trimmedProxy);
      }
    }

    console.log('[Settings] Proxy settings saved');
  } catch (err: any) {
    error.value = '保存代理失败: ' + err.message;

    notificationCenter.value?.addNotification({
      type: 'error',
      title: '代理设置失败',
      message: err.message || '保存代理配置时发生错误',
      persistent: true,
    });
  }
};

// 保存菜单栏显示设置
const saveDisplaySettings = async () => {
  if (!(window as any).electronAPI) {
    return;
  }

  try {
    // 保存菜单栏显示设置
    await (window as any).electronAPI.saveDisplaySettings({
      maxDisplayCount: maxDisplayCount.value,
      refreshInterval: refreshInterval.value
    });

    // 重新启动面板刷新定时器（使用新的刷新间隔）
    startPanelRefresh();

    console.log('[Settings] Display settings saved');
  } catch (err: any) {
    error.value = '保存显示设置失败: ' + err.message;
  }
};

const fetchData = async () => {
  if (!(window as any).electronAPI) {
    error.value = 'Electron API 未加载';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    // 并行获取持仓和账户信息
    const [futuresData, accountData] = await Promise.all([
      (window as any).electronAPI.getFuturesPositions(),
      (window as any).electronAPI.getFuturesAccountInfo(),
    ]);

    if (futuresData.error) {
      error.value = '合约数据获取失败: ' + futuresData.error;
    } else {
      futuresPositions.value = futuresData;
    }

    if (accountData.error) {
      console.error('账户信息获取失败:', accountData.error);
    } else {
      // accountData 现在是一个数组
      accountInfoList.value = Array.isArray(accountData) ? accountData : [];
    }
  } catch (err: any) {
    error.value = '数据获取失败: ' + err.message;
  } finally {
    loading.value = false;
  }
};

// 启动面板刷新定时器
const startPanelRefresh = () => {
  // 清除旧的定时器
  if (panelRefreshInterval) {
    clearInterval(panelRefreshInterval);
  }

  // 启动新的定时器
  panelRefreshInterval = setInterval(() => {
    if (hasCredentials.value && !showSettings.value) {
      fetchData();
    }
  }, refreshInterval.value * 1000); // 转换为毫秒

  console.log(`[Panel] Refresh interval set to ${refreshInterval.value} seconds`);
};

// 监听刷新间隔变化
watch(refreshInterval, () => {
  if (hasCredentials.value) {
    startPanelRefresh();
  }
});

// ============ 错误处理函数 ============

/**
 * 加载交易所错误状态
 */
const loadExchangeErrors = async () => {
  if (!(window as any).electronAPI) {
    return;
  }

  try {
    const errors = await (window as any).electronAPI.getExchangeErrors();
    if (errors && errors.length > 0) {
      exchangeErrors.value = errors;
      console.log('[Errors] Loaded exchange errors:', errors);
    }
  } catch (err) {
    console.error('[Errors] Failed to load exchange errors:', err);
  }
};

/**
 * 清除错误并重试
 */
const retryAfterError = async () => {
  if (!(window as any).electronAPI) {
    return;
  }

  try {
    const result = await (window as any).electronAPI.clearExchangeErrors();
    if (result.success) {
      // 清除前端错误横幅
      exchangeErrors.value = [];
      error.value = '';
      console.log('[Errors] Errors cleared, retrying...');

      notificationCenter.value?.addNotification({
        type: 'info',
        title: '正在重新连接',
        message: '已清除错误状态，正在尝试重新连接交易所...',
      });

      // 立即刷新数据
      await fetchData();

      // 等待一小段时间，确保后端有机会推送新的错误状态
      await new Promise(resolve => setTimeout(resolve, 500));

      // 再次检查是否有新错误
      const latestErrors = await (window as any).electronAPI.getExchangeErrors();

      // 如果没有新错误，说明重新连接成功
      if (!latestErrors || latestErrors.length === 0) {
        // 确保前端也没有错误横幅
        exchangeErrors.value = [];

        notificationCenter.value?.addNotification({
          type: 'success',
          title: '重新连接成功',
          message: '已成功连接到交易所，数据已更新',
        });
      } else {
        // 有新错误，更新错误横幅
        exchangeErrors.value = latestErrors;
      }
    } else {
      error.value = '清除错误失败: ' + (result.error || '未知错误');

      notificationCenter.value?.addNotification({
        type: 'error',
        title: '重新连接失败',
        message: result.error || '清除错误状态时发生未知错误',
        persistent: true,
      });
    }
  } catch (err: any) {
    error.value = '清除错误失败: ' + err.message;
    console.error('[Errors] Failed to clear errors:', err);

    notificationCenter.value?.addNotification({
      type: 'error',
      title: '重新连接出错',
      message: err.message || '尝试重新连接时发生错误',
      persistent: true,
    });
  }
};

onMounted(async () => {
  // 加载主题
  loadTheme();

  // 加载代理设置
  const savedProxy = localStorage.getItem('proxyUrl');
  if (savedProxy) {
    proxyUrl.value = savedProxy;
  }

  // 检查 electronAPI 是否可用
  if (!(window as any).electronAPI) {
    error.value = '请使用 Electron 启动应用（运行 pnpm dev 或 ./dev.sh）';
    return;
  }

  // 加载所有交易所的凭证
  try {
    const allCredentials = await (window as any).electronAPI.getAllExchangesCredentials();
    if (allCredentials) {
      // Binance
      if (allCredentials.binance) {
        realCredentials.value.binance = {
          apiKey: allCredentials.binance.apiKey || '',
          apiSecret: allCredentials.binance.apiSecret || '',
        };
        // 显示遮蔽值
        exchangeCredentials.value.binance = {
          apiKey: maskSecret(allCredentials.binance.apiKey || ''),
          apiSecret: maskSecret(allCredentials.binance.apiSecret || ''),
        };
      }

      // Bybit
      if (allCredentials.bybit) {
        realCredentials.value.bybit = {
          apiKey: allCredentials.bybit.apiKey || '',
          apiSecret: allCredentials.bybit.apiSecret || '',
        };
        exchangeCredentials.value.bybit = {
          apiKey: maskSecret(allCredentials.bybit.apiKey || ''),
          apiSecret: maskSecret(allCredentials.bybit.apiSecret || ''),
        };
      }

      // OKX
      if (allCredentials.okx) {
        realCredentials.value.okx = {
          apiKey: allCredentials.okx.apiKey || '',
          apiSecret: allCredentials.okx.apiSecret || '',
          passphrase: allCredentials.okx.passphrase || '',
        };
        exchangeCredentials.value.okx = {
          apiKey: maskSecret(allCredentials.okx.apiKey || ''),
          apiSecret: maskSecret(allCredentials.okx.apiSecret || ''),
          passphrase: maskSecret(allCredentials.okx.passphrase || ''),
        };
      }

      // Hyperliquid
      if (allCredentials.hyperliquid) {
        realCredentials.value.hyperliquid = {
          apiKey: allCredentials.hyperliquid.apiKey || '',
          apiSecret: allCredentials.hyperliquid.apiSecret || '',
        };
        exchangeCredentials.value.hyperliquid = {
          apiKey: maskSecret(allCredentials.hyperliquid.apiKey || ''),
          apiSecret: maskSecret(allCredentials.hyperliquid.apiSecret || ''),
        };
      }

      console.log('[Exchange Credentials] Loaded all exchanges');
    }
  } catch (err) {
    console.error('Failed to load exchange credentials:', err);
  }

  // 加载菜单栏显示设置
  try {
    const settings = await (window as any).electronAPI.getDisplaySettings();
    if (settings) {
      maxDisplayCount.value = settings.maxDisplayCount || 2;
      refreshInterval.value = settings.refreshInterval || 5;
    }
  } catch (err) {
    console.error('Failed to load display settings:', err);
  }

  // 加载金额隐藏设置
  try {
    const savedHideAmounts = await (window as any).electronAPI.getHideAmounts();
    hideAmounts.value = savedHideAmounts;
    console.log('[Hide Amounts] Loaded:', savedHideAmounts);
  } catch (err) {
    console.error('Failed to load hide amounts setting:', err);
  }

  // 加载调试模式设置
  try {
    const savedDebugMode = await (window as any).electronAPI.getDebugMode();
    debugMode.value = savedDebugMode;
    console.log('[Debug Mode] Loaded:', savedDebugMode);
  } catch (err) {
    console.error('Failed to load debug mode setting:', err);
  }

  // 加载窗口透明度设置
  try {
    const savedOpacity = await (window as any).electronAPI.getWindowOpacity();
    windowOpacity.value = savedOpacity;
    console.log('[Window Opacity] Loaded:', savedOpacity);
  } catch (err) {
    console.error('Failed to load window opacity setting:', err);
  }

  // 加载开机自动启动设置
  try {
    const savedAutoLaunch = await (window as any).electronAPI.getAutoLaunch();
    autoLaunch.value = savedAutoLaunch;
    console.log('[Auto Launch] Loaded:', savedAutoLaunch);
  } catch (err) {
    console.error('Failed to load auto-launch setting:', err);
  }

  // 加载应用版本
  try {
    const version = await (window as any).electronAPI.getAppVersion();
    appVersion.value = version;
    console.log('[App Version] Loaded:', version);
  } catch (err) {
    console.error('Failed to load app version:', err);
  }

  // 加载持仓顺序
  try {
    const savedOrder = await (window as any).electronAPI.getPositionOrder();
    if (savedOrder && savedOrder.length > 0) {
      customPositionOrder.value = savedOrder;
      console.log('[Position Order] Loaded:', savedOrder);
    }
  } catch (err) {
    console.error('Failed to load position order:', err);
  }

  // 加载AI设置
  try {
    await loadAISettings();
  } catch (err) {
    console.error('Failed to load AI settings:', err);
  }

  hasCredentials.value = await (window as any).electronAPI.hasCredentials();

  if (hasCredentials.value) {
    fetchData();
    // 启动面板刷新定时器
    startPanelRefresh();
  }

  // 监听刷新事件
  (window as any).electronAPI.onRefreshData(() => {
    fetchData();
  });

  // 加载错误状态
  try {
    await loadExchangeErrors();
  } catch (err) {
    console.error('Failed to load exchange errors:', err);
  }

  // 监听错误事件
  (window as any).electronAPI.onExchangeErrors((errors: any[]) => {
    exchangeErrors.value = errors;
    console.log('[Errors] Received errors from main process:', errors);
  });
});

// 组件卸载时清理定时器
onUnmounted(() => {
  if (panelRefreshInterval) {
    clearInterval(panelRefreshInterval);
  }
});
</script>

<style scoped>
/* CSS Variables - Light Mode */
.app {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f7;
  --bg-tertiary: #e8e8ed;
  --card-bg: #ffffff;
  --text-primary: #1d1d1f;
  --text-secondary: #86868b;
  --text-tertiary: #a1a1a6;
  --border-color: #d2d2d7;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --accent-blue: #007aff;
  --accent-green: #34c759;
  --accent-red: #ff3b30;
  --accent-orange: #ff9500;

  /* 盈利状态颜色 */
  --color-profit: #2da44e;
  --color-profit-glow: rgba(45, 164, 78, 0.2);
  --color-profit-text: #1e8449;
  --color-profit-border: rgba(45, 164, 78, 0.3);

  /* 亏损状态颜色 */
  --color-loss: #da3633;
  --color-loss-glow: rgba(218, 54, 51, 0.2);
  --color-loss-text: #c0392b;
  --color-loss-border: rgba(218, 54, 51, 0.3);

  /* 持平状态颜色 */
  --color-neutral: #7d8590;
  --color-neutral-glow: rgba(125, 133, 144, 0.15);
  --color-neutral-text: #86868b;
  --color-neutral-border: rgba(125, 133, 144, 0.3);
}

/* Dark Mode Variables */
.app.dark-mode {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  --card-bg: #161b22;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-tertiary: #636366;
  --border-color: #30363d;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --accent-blue: #0a84ff;
  --accent-green: #32d74b;
  --accent-red: #ff453a;
  --accent-orange: #ff9f0a;

  /* 盈利状态颜色 - 深色模式 */
  --color-profit: #2da44e;
  --color-profit-glow: rgba(45, 164, 78, 0.2);
  --color-profit-text: #3fb950;
  --color-profit-border: rgba(45, 164, 78, 0.3);

  /* 亏损状态颜色 - 深色模式 */
  --color-loss: #da3633;
  --color-loss-glow: rgba(218, 54, 51, 0.2);
  --color-loss-text: #f85149;
  --color-loss-border: rgba(218, 54, 51, 0.3);

  /* 持平状态颜色 - 深色模式 */
  --color-neutral: #7d8590;
  --color-neutral-glow: rgba(125, 133, 144, 0.15);
  --color-neutral-text: #c9d1d9;
  --color-neutral-border: rgba(125, 133, 144, 0.3);
}

/* Base Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
  width: 480px;
  height: 600px;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
  transition: background 0.3s ease, color 0.3s ease;
}

/* Settings Panel */
.settings-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  -webkit-app-region: drag; /* 使头部可拖拽 */
  min-height: 52px;
}

.back-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  color: var(--accent-blue);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  border-radius: 6px;
  -webkit-app-region: no-drag; /* 返回按钮可点击 */
}

.back-btn:hover {
  background: var(--bg-tertiary);
  opacity: 0.9;
}

.settings-title {
  font-size: 18px;
  font-weight: 600;
  flex: 1;
  margin-left: 4px;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.header-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.2s, color 0.2s;
  -webkit-app-region: no-drag;
}

.header-button:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.header-button:active {
  opacity: 0.7;
}

.quit-button-header {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  color: var(--accent-red);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.2s, opacity 0.2s;
  -webkit-app-region: no-drag;
}

.quit-button-header:hover {
  background: var(--bg-tertiary);
  opacity: 0.9;
}

.quit-button-header:active {
  opacity: 0.7;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.settings-section {
  margin-bottom: 20px;
}

.section-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.3px;
  margin-bottom: 12px;
  padding-left: 2px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-icon {
  color: var(--accent-blue);
  flex-shrink: 0;
}

.label-icon {
  color: var(--accent-orange);
  flex-shrink: 0;
}

.setting-item {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.setting-item:hover {
  border-color: var(--border-color);
}

.setting-item.column {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.setting-icon {
  font-size: 18px;
}

.setting-icon-svg {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.input-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Exchange Badge */
.exchange-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.exchange-badge.binance {
  background: rgba(243, 186, 47, 0.15);
  color: #F3BA2F;
}

.app.dark-mode .exchange-badge.binance {
  background: rgba(243, 186, 47, 0.2);
  color: #F3BA2F;
}

.exchange-badge.bybit {
  background: rgba(247, 166, 0, 0.15);
  color: #F7A600;
}

.app.dark-mode .exchange-badge.bybit {
  background: rgba(247, 166, 0, 0.2);
  color: #F7A600;
}

.exchange-badge.okx {
  background: rgba(0, 0, 0, 0.1);
  color: #000000;
}

.app.dark-mode .exchange-badge.okx {
  background: rgba(255, 255, 255, 0.15);
  color: #FFFFFF;
}

.exchange-badge.hyperliquid {
  background: rgba(0, 212, 170, 0.15);
  color: #00D4AA;
}

.app.dark-mode .exchange-badge.hyperliquid {
  background: rgba(0, 212, 170, 0.2);
  color: #00D4AA;
}

.text-input {
  background: var(--bg-primary);
  border: 1.5px solid var(--border-color);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  transition: all 0.2s;
}

.text-input:hover {
  border-color: var(--text-tertiary);
}

.text-input:focus {
  border-color: var(--accent-blue);
}

.app:not(.dark-mode) .text-input:focus {
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

.app.dark-mode .text-input:focus {
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.15);
}

.text-input::placeholder {
  color: var(--text-tertiary);
}

.select-input {
  background: var(--bg-primary);
  border: 1.5px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 100px;
}

.select-input:hover {
  border-color: var(--text-tertiary);
}

.select-input:focus {
  border-color: var(--accent-blue);
}

.app:not(.dark-mode) .select-input:focus {
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

.app.dark-mode .select-input:focus {
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.15);
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 51px;
  height: 31px;
  cursor: pointer;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-tertiary);
  transition: 0.3s;
  border-radius: 31px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 27px;
  width: 27px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

input:checked + .toggle-slider {
  background-color: var(--accent-green);
}

input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

.setting-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.opacity-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-blue);
}

.opacity-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-tertiary);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-blue);
  cursor: pointer;
  transition: all 0.2s;
}

.opacity-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.opacity-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-blue);
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.opacity-slider::-moz-range-thumb:hover {
  transform: scale(1.1);
}

.setting-notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg-secondary);
  border-radius: 10px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  border: 1px solid var(--border-color);
  margin-top: 4px;
}

.notice-icon {
  flex-shrink: 0;
  font-size: 16px;
}

.notice-icon-svg {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.info-notice {
  background: rgba(0, 122, 255, 0.05);
  border-color: rgba(0, 122, 255, 0.2);
}

.notice-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notice-links {
  font-size: 12px;
  color: var(--text-tertiary);
}

.notice-links a {
  color: var(--accent-blue);
  text-decoration: none;
  margin: 0 4px;
  transition: opacity 0.2s;
}

.notice-links a:hover {
  opacity: 0.7;
  text-decoration: underline;
}

/* Exchange Tabs */
.exchange-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.tab-button {
  background: var(--bg-secondary);
  border: 1.5px solid var(--border-color);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
}

.tab-button:hover {
  border-color: var(--text-tertiary);
  background: var(--bg-tertiary);
}

.tab-button.active {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
}

.tab-button.active .tab-label {
  color: white;
  font-weight: 600;
}

.tab-label {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
}

.tab-content {
  margin-bottom: 10px;
}

.exchange-config {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.remove-credential-btn {
  width: 100%;
  padding: 10px 16px;
  background: var(--bg-tertiary);
  border: 1.5px solid var(--accent-red);
  border-radius: 8px;
  color: var(--accent-red);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 6px;
}

.remove-credential-btn:hover {
  background: var(--accent-red);
  color: white;
}

.remove-credential-btn:active {
  transform: scale(0.98);
}

/* Main Panel */
.main-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  -webkit-app-region: drag; /* 使头部可拖拽 */
  min-height: 52px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.total-pnl {
  font-size: 14px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 6px;
}

.total-pnl.profit {
  background: rgba(45, 164, 78, 0.15);
  color: var(--color-profit-text);
}

.total-pnl.loss {
  background: rgba(218, 54, 51, 0.15);
  color: var(--color-loss-text);
}

.total-pnl.neutral {
  background: rgba(125, 133, 144, 0.15);
  color: var(--color-neutral-text);
}

.header-actions {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag; /* 按钮区域不可拖拽，保持可点击 */
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  -webkit-app-region: no-drag; /* 按钮可点击 */
}

.action-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
  border-color: var(--text-tertiary);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-btn {
  background-color: var(--accent-green);
  color: white;
  border-color: var(--accent-green);
}

.save-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.quit-btn {
  color: var(--accent-red);
}

.quit-btn:hover:not(:disabled) {
  background: var(--accent-red);
  color: white;
  border-color: var(--accent-red);
}

.rotating {
  display: inline-block;
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Error Message */
.error-message {
  margin: 12px 16px;
  padding: 12px 14px;
  background: rgba(218, 54, 51, 0.1);
  color: var(--color-loss-text);
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.6;
  border: 1px solid rgba(218, 54, 51, 0.2);
}

/* Edit Mode Hint */
.edit-mode-hint {
  margin: 12px 16px;
  padding: 12px 14px;
  background: rgba(0, 122, 255, 0.1);
  color: var(--accent-blue);
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.6;
  border: 1px solid rgba(0, 122, 255, 0.2);
  display: flex;
  align-items: center;
  gap: 8px;
}

.app.dark-mode .edit-mode-hint {
  background: rgba(10, 132, 255, 0.15);
  border-color: rgba(10, 132, 255, 0.25);
}

.hint-icon {
  flex-shrink: 0;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 32px;
  text-align: center;
}

.empty-icon {
  font-size: 52px;
  margin-bottom: 18px;
  opacity: 0.8;
}

.empty-icon-svg {
  color: var(--text-tertiary);
  opacity: 0.6;
  margin-bottom: 18px;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.empty-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.5;
}

.primary-button {
  padding: 11px 24px;
  background: var(--accent-blue);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.app:not(.dark-mode) .primary-button {
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.2);
}

.app.dark-mode .primary-button {
  box-shadow: 0 2px 8px rgba(10, 132, 255, 0.25);
}

.primary-button:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.app:not(.dark-mode) .primary-button:hover {
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
}

.app.dark-mode .primary-button:hover {
  box-shadow: 0 4px 12px rgba(10, 132, 255, 0.35);
}

.primary-button:active {
  transform: translateY(0);
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 32px;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-blue);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 18px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

/* Positions List */
.positions-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

/* ========== 账户信息区域 - 新设计 ========== */
/* 资产整体容器 */
.assets-wrapper {
  background: linear-gradient(135deg, rgba(25, 30, 40, 0.95) 0%, rgba(15, 20, 30, 0.98) 100%);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 12px 16px 16px 16px;
  margin-bottom: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.app:not(.dark-mode) .assets-wrapper {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(245, 247, 250, 0.98) 100%);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

/* 总资产卡片 - 新设计 */
.total-assets-card-new {
  background: transparent;
  padding: 0 0 10px;
  margin-bottom: 12px;
  border: none;
  box-shadow: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.app:not(.dark-mode) .total-assets-card-new {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.total-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.total-card-exchange-logo {
  opacity: 0.8;
}

.total-card-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  opacity: 0.7;
}

.toggle-visibility-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
  opacity: 0.6;
}

.toggle-visibility-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  opacity: 1;
}

.app.dark-mode .toggle-visibility-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

.total-card-amount {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  font-family: 'Roboto Mono', 'SF Mono', 'Monaco', 'Courier New', monospace;
  margin-bottom: 10px;
  line-height: 1.1;
  letter-spacing: -0.5px;
}

.total-card-currency {
  font-size: 16px;
  color: var(--text-secondary);
  font-weight: 600;
  margin-left: 8px;
  opacity: 0.8;
}

.total-card-stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 8px 10px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 10px;
  color: var(--text-secondary);
  font-weight: 500;
  opacity: 0.7;
}

.stat-value {
  font-size: 14px;
  color: var(--text-primary);
  font-family: 'Roboto Mono', 'SF Mono', 'Monaco', 'Courier New', monospace;
  font-weight: 600;
}

.stat-value.profit {
  color: var(--color-profit-text);
}

.stat-value.loss {
  color: var(--color-loss-text);
}

/* 交易所卡片网格 */
.exchanges-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding-top: 4px;
}

/* 交易所卡片 - 新设计 */
.exchange-card-new {
  background: rgba(40, 45, 55, 0.5);
  border-radius: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  transition: all 0.2s ease;
}

.app:not(.dark-mode) .exchange-card-new {
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.exchange-card-new:hover {
  background: rgba(50, 55, 65, 0.6);
  border-color: rgba(255, 255, 255, 0.08);
}

.app:not(.dark-mode) .exchange-card-new:hover {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.08);
}

.exchange-card-top {
  margin-bottom: 12px;
}

.exchange-identity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.exchange-card-name {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 600;
}

.exchange-card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.exchange-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.exchange-stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
  opacity: 0.7;
}

.exchange-stat-value {
  font-size: 13px;
  color: var(--text-primary);
  font-family: 'Roboto Mono', 'SF Mono', 'Monaco', 'Courier New', monospace;
  font-weight: 600;
}

.exchange-stat-value.profit {
  color: var(--color-profit-text);
}

.exchange-stat-value.loss {
  color: var(--color-loss-text);
}


/* ========== 持仓列表区域 ========== */
.positions-section {
  margin-top: 8px;
}

.positions-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 2px 12px 2px;
}

.positions-section-title {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 600;
  opacity: 0.9;
}

.positions-count {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 600;
  background: var(--bg-tertiary);
  padding: 3px 8px;
  border-radius: 10px;
  opacity: 0.8;
}

/* Edit Mode Indicator */
.app:has(.main-header .save-btn) .positions-list {
  background: var(--bg-secondary);
}

.position-card {
  background: var(--card-bg);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
  border: 1px solid var(--border-color);
  border-left: 3px solid transparent;
  transition: all 0.2s;
  position: relative;
}

/* Edit Mode Card */
.position-card.edit-mode-card {
  padding: 0;
  border-left-width: 1px;
  min-height: auto;
}

.edit-mode-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
}

.edit-controls {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.edit-control-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.edit-control-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.edit-control-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.edit-control-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.edit-symbol-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.edit-symbol-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.edit-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.edit-tag.long {
  background: rgba(45, 164, 78, 0.15);
  color: var(--color-profit-text);
}

.edit-tag.short {
  background: rgba(218, 54, 51, 0.15);
  color: var(--color-loss-text);
}

.position-card:last-child {
  margin-bottom: 0;
}

/* 盈利状态样式 */
.position-card.is-profit {
  border: 1px solid var(--color-profit-border);
  border-left: 3px solid var(--color-profit);
  box-shadow: inset 4px 0 15px -4px var(--color-profit-glow);
}

/* 亏损状态样式 */
.position-card.is-loss {
  border: 1px solid var(--color-loss-border);
  border-left: 3px solid var(--color-loss);
  box-shadow: inset 4px 0 15px -4px var(--color-loss-glow);
}

/* 持平状态样式 */
.position-card.is-neutral {
  border: 1px solid var(--color-neutral-border);
  border-left: 3px solid var(--color-neutral);
  box-shadow: inset 4px 0 15px -4px var(--color-neutral-glow);
}

/* 卡片头部样式 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
}

.symbol-info {
  display: flex;
  align-items: center;
  gap: 6px;
}


.symbol-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}

/* 标签通用样式 */
.tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.tag-leverage {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.tag-side {
  text-transform: uppercase;
}

.tag-side.long {
  background: rgba(45, 164, 78, 0.15);
  color: var(--color-profit-text);
}

.tag-side.short {
  background: rgba(218, 54, 51, 0.15);
  color: var(--color-loss-text);
}

/* 盈亏信息 */
.pnl-info {
  text-align: right;
}

.pnl-amount {
  font-size: 15px;
  font-weight: 700;
  display: block;
  margin-bottom: 2px;
}

.pnl-percent {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.9;
}

/* 颜色辅助类 */
.text-green {
  color: var(--color-profit-text);
}

.text-red {
  color: var(--color-loss-text);
}

.text-gray {
  color: var(--color-neutral-text);
}

/* 卡片数据网格 */
.card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px 10px;
}

.data-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
}

.data-label {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 400;
  white-space: nowrap;
}

.data-value {
  font-size: 13px;
  color: var(--text-primary);
  font-family: 'Roboto Mono', 'SF Mono', 'Monaco', 'Courier New', monospace;
  font-weight: 500;
}

.unit {
  font-size: 10px;
  color: var(--text-secondary);
  margin-left: 2px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

/* Modal Dialog */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20000; /* 高于通知中心 (10003) */
  backdrop-filter: blur(4px);
}

.modal-dialog {
  background: var(--bg-primary);
  border-radius: 14px;
  width: 320px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.modal-header {
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.modal-body {
  padding: 20px;
}

.modal-body p {
  margin: 0;
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.modal-footer {
  display: flex;
  gap: 10px;
  padding: 14px 20px 18px;
  border-top: 1px solid var(--border-color);
}

.modal-btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.modal-btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.modal-btn-cancel:hover {
  background: var(--bg-tertiary);
}

.modal-btn-confirm {
  background: var(--accent-red);
  color: white;
}

.modal-btn-confirm:hover {
  opacity: 0.9;
}

.modal-btn:active {
  transform: scale(0.98);
}

/* About Section */
.about-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.about-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-color);
}

.about-row:last-child {
  border-bottom: none;
}

.about-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.about-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 600;
}

/* Donation Section */
.donate-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.donate-address {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1.5px solid var(--border-color);
  border-radius: 8px;
  transition: all 0.2s;
}

.donate-address:hover {
  border-color: var(--text-tertiary);
}

.eth-address {
  flex: 1;
  font-size: 12px;
  font-family: 'Roboto Mono', 'SF Mono', 'Monaco', 'Courier New', monospace;
  color: var(--text-primary);
  background: transparent;
  padding: 0;
  overflow-x: auto;
  white-space: nowrap;
}

.copy-btn {
  padding: 6px 12px;
  background: var(--accent-blue);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.copy-btn:hover {
  opacity: 0.9;
}

.copy-btn:active {
  transform: scale(0.95);
}

/* Action Buttons */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.action-button {
  width: 100%;
  padding: 11px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  text-align: center;
}

.action-button.secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.action-button.secondary:hover {
  background: var(--bg-primary);
  border-color: var(--text-tertiary);
}

.action-button.danger {
  background: var(--accent-red);
  color: white;
}

.app:not(.dark-mode) .action-button.danger {
  box-shadow: 0 2px 8px rgba(255, 59, 48, 0.2);
}

.app.dark-mode .action-button.danger {
  box-shadow: 0 2px 8px rgba(255, 69, 58, 0.25);
}

.action-button.danger:hover {
  opacity: 0.9;
}

.app:not(.dark-mode) .action-button.danger:hover {
  box-shadow: 0 4px 12px rgba(255, 59, 48, 0.3);
}

.app.dark-mode .action-button.danger:hover {
  box-shadow: 0 4px 12px rgba(255, 69, 58, 0.35);
}

.action-button:active {
  transform: scale(0.98);
}

/* AI Analysis Button */
.ai-btn {
  background: linear-gradient(135deg, var(--accent-blue) 0%, #0066cc 100%);
  color: white;
  border-color: var(--accent-blue);
}

.ai-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.ai-btn:active:not(:disabled) {
  transform: translateY(0);
}

/* Health Analysis Dialog */
.health-dialog {
  background: var(--bg-primary);
  border-radius: 16px;
  width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border-color);
}

.health-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.health-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-icon {
  color: var(--accent-blue);
}

.health-title h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.health-body {
  padding: 24px;
}

/* Score Section */
.health-score-section {
  text-align: center;
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border-color);
}

.score-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
  margin-bottom: 12px;
}

.score-circle {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 6px solid;
  transition: all 0.3s;
}

.score-circle.score-excellent {
  border-color: var(--accent-green);
  background: rgba(52, 199, 89, 0.1);
}

.score-circle.score-good {
  border-color: var(--accent-blue);
  background: rgba(0, 122, 255, 0.1);
}

.score-circle.score-fair {
  border-color: var(--accent-orange);
  background: rgba(255, 149, 0, 0.1);
}

.score-circle.score-poor {
  border-color: var(--accent-red);
  background: rgba(255, 59, 48, 0.1);
}

.score-value {
  font-size: 36px;
  font-weight: 700;
  color: var(--text-primary);
  font-family: 'Roboto Mono', 'SF Mono', 'Monaco', monospace;
}

.score-max {
  font-size: 16px;
  color: var(--text-secondary);
  font-weight: 500;
}

/* Metrics */
.health-metrics {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.metric-item {
  display: grid;
  grid-template-columns: 100px 1fr 50px;
  gap: 12px;
  align-items: center;
}

.metric-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.metric-bar-container {
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.metric-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-blue), #0066cc);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.metric-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: right;
  font-family: 'Roboto Mono', 'SF Mono', 'Monaco', monospace;
}

/* Summary */
.health-summary {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 10px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-icon {
  flex-shrink: 0;
}

.summary-text {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

/* Warnings */
.health-warnings {
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(255, 59, 48, 0.05);
  border-radius: 10px;
  border: 1px solid rgba(255, 59, 48, 0.2);
}

.health-warnings .section-title {
  color: var(--accent-red);
}

.health-warnings .section-icon {
  color: var(--accent-red);
}

.warnings-list {
  margin: 0;
  padding-left: 20px;
  list-style: none;
}

.warnings-list li {
  position: relative;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.7;
  padding-left: 12px;
  margin-bottom: 8px;
}

.warnings-list li:last-child {
  margin-bottom: 0;
}

.warnings-list li::before {
  content: '⚠️';
  position: absolute;
  left: -8px;
  font-size: 12px;
}

/* Suggestions */
.health-suggestions {
  padding: 16px;
  background: rgba(0, 122, 255, 0.05);
  border-radius: 10px;
  border: 1px solid rgba(0, 122, 255, 0.2);
}

.health-suggestions .section-title {
  color: var(--accent-blue);
}

.health-suggestions .section-icon {
  color: var(--accent-blue);
}

.suggestions-list {
  margin: 0;
  padding-left: 20px;
  list-style: none;
}

.suggestions-list li {
  position: relative;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.7;
  padding-left: 12px;
  margin-bottom: 8px;
}

.suggestions-list li:last-child {
  margin-bottom: 0;
}

.suggestions-list li::before {
  content: '💡';
  position: absolute;
  left: -8px;
  font-size: 12px;
}

.health-footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

/* Exchange Errors Banner */
.exchange-errors-banner {
  margin: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.exchange-error-item {
  background: rgba(255, 59, 48, 0.08);
  border: 1.5px solid rgba(255, 59, 48, 0.3);
  border-left: 4px solid var(--accent-red);
  border-radius: 10px;
  padding: 14px 16px;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.app.dark-mode .exchange-error-item {
  background: rgba(255, 69, 58, 0.12);
  border-color: rgba(255, 69, 58, 0.35);
}

.error-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.error-icon {
  color: var(--accent-red);
  flex-shrink: 0;
}

.error-title {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: var(--accent-red);
  margin: 0;
}

.close-error-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-error-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  color: var(--text-primary);
}

.app.dark-mode .close-error-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.error-details {
  margin-bottom: 12px;
}

.error-code {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0 0 8px 0;
  font-family: 'Roboto Mono', 'SF Mono', 'Monaco', monospace;
}

.error-suggestion {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.6;
  margin: 0;
  white-space: pre-line;
}

.error-actions {
  display: flex;
  gap: 8px;
}

.retry-btn,
.settings-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.retry-btn {
  background: var(--accent-blue);
  color: white;
  flex: 1;
}

.retry-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.retry-btn:active {
  transform: translateY(0);
}

.settings-btn {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.settings-btn:hover {
  background: var(--bg-primary);
  border-color: var(--text-tertiary);
}

.settings-btn:active {
  transform: scale(0.98);
}
</style>
