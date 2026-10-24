# PositionScope · 仓位镜

macOS 菜单栏中的多交易所持仓监控与按需 AI 风险解读。

官网：https://positionscope.funagent.app/ 。当前为开发预览；发布产物以 Releases 为准。

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

仅配置只读交易所凭证。当前使用本地设置文件，尚未接入系统钥匙串；不会验证交易所 Key 的权限。AI 分析会发送计算后的风险汇总至用户选择的模型提供商，调用费用由提供商收取。

本地验证：`pnpm typecheck`、`pnpm test`、`pnpm build`；安装 Chromium 后 `pnpm test:ui`。设计见 [DESIGN.md](DESIGN.md)，评审与迭代见 [docs/product-quality.md](docs/product-quality.md)。

支持 Binance、Bybit、OKX、Hyperliquid 的现有只读适配器；资产总额沿用各适配器口径。AI 只解释线性 USDT/USD 仓位快照，不产生交易指令；缺少历史与强平价等信息时不生成绩效或强平指标。

产品/安装包名称改为 PositionScope，macOS App ID 与旧用户数据目录保留，以便升级。Mac 原生行为、真实账户/模型连通性和签名公证尚未完成实测，未签名 ZIP 仅用于开发预览。

---

以下保留原项目使用资料与作者信息；旧名称属于历史说明。

# Binance MenuBar - 币安合约持仓查看器

一个小巧的 macOS 菜单栏应用，专注于实时查看币安(Binance)的合约持仓信息。

## 预览

界面特点：
- 实时显示盈亏金额和百分比
- 颜色区分盈利/亏损（绿色/红色）
- 显示持仓方向（LONG/SHORT）
- 显示杠杆倍数
- 显示持仓价格和当前价格
- 紧凑布局，一目了然

## 功能特点

- 🔒 只读 API 权限，安全可靠
- 📊 专注显示合约持仓信息
- 💰 实时显示盈亏金额和百分比
- 🎨 盈亏颜色区分（绿色盈利/红色亏损）
- 🔄 自动定时刷新（30秒）
- ⚡️ 轻量级，常驻菜单栏
- 🌙 GitHub Dark 主题风格

## 界面说明

### 持仓卡片显示
每个持仓卡片包含：
- **币种名称**：如 BTC、ETH（去掉 USDT 后缀）
- **杠杆倍数**：显示使用的杠杆，如 10x
- **持仓方向**：LONG（做多）绿色标签 / SHORT（做空）红色标签
- **盈亏金额**：未实现盈亏（USDT），大字号显示
- **盈亏百分比**：基于入场价的收益率
- **持仓价格**：开仓时的平均价格
- **当前价格**：最新标记价格
- **持仓数量**：持有的币数量

### 颜色标识
- 左侧绿色竖线：盈利的持仓
- 左侧红色竖线：亏损的持仓
- 绿色数字：正收益
- 红色数字：负收益

## 技术栈

- **Electron** - 跨平台桌面应用框架
- **Vue 3** - 渐进式 JavaScript 框架（Composition API）
- **TypeScript** - 类型安全
- **Vite** - 快速的构建工具
- **Binance API** - 合约数据接口

## 安装和运行

### 1. 安装依赖
```bash
# 使用淘宝镜像加速 Electron 下载
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install
```

### 2. 开发模式（推荐）
```bash
# 方式一：完整开发模式（带热重载）
npm run dev

# 方式二：快捷启动脚本
./dev.sh
```

开发模式会：
- 启动 Vite 开发服务器（支持热重载）
- 自动等待 Vite 启动完成
- 启动 Electron 应用
- 自动打开 DevTools

### 3. 快速启动（不带热重载）
```bash
./start.sh
```

### 4. 构建生产版本
```bash
npm run build
npm start
```

## API 配置

### 创建 Binance API Key
1. 登录 [Binance](https://www.binance.com)
2. 进入「API Management」页面
3. 创建新的 API Key
4. ⚠️ **重要**: 只开启「Enable Reading」权限
5. 不要开启交易、提现等其他权限
6. 复制 API Key 和 Secret Key

### 在应用中配置
1. 点击菜单栏图标打开应用
2. 点击右上角设置按钮（⚙）
3. 输入 API Key 和 Secret Key
4. 点击保存

## 使用说明

### 窗口操作
- **显示/隐藏**：点击菜单栏图标
- **自动隐藏**：窗口失去焦点时自动隐藏
- **右键菜单**：在图标上右键可以刷新或退出

### 数据刷新
- **自动刷新**：每 30 秒自动更新
- **手动刷新**：点击刷新按钮（↻）
- **菜单刷新**：右键图标选择「刷新」

### 显示的数据
- 只显示有持仓的合约
- 多空持仓分别显示
- 实时计算未实现盈亏
- 自动计算盈亏百分比

## 安全说明

- ✅ API Key 只需要读取权限
- ✅ 不会执行任何交易操作
- ✅ API 凭证存储在本地
- ✅ 不会上传任何数据到第三方服务器
- 💡 建议定期更换 API Key
- 💡 如果不再使用，请删除 API Key

## 故障排除

### "Electron API 未加载" 错误
这个错误说明你没有通过 Electron 启动应用。

**解决方法**：
1. 确保运行 `npm run dev` 或 `./dev.sh`
2. 不要直接访问 `http://localhost:3000`
3. 等待 Electron 窗口自动打开

开发模式下：
- Vite 会在 `localhost:3000` 启动
- Electron 会等待 Vite 启动完成后自动打开窗口
- DevTools 会自动打开，方便调试

### 无法获取数据
1. 检查网络连接
2. 确认 API Key 是否正确
3. 确认 API Key 已开启读取权限
4. 检查 Binance API 状态：https://api.binance.com/api/v3/ping

### 数据不准确
1. 点击刷新按钮
2. 检查系统时间是否正确
3. 重启应用

### 窗口没有出现
1. 检查菜单栏是否有应用图标
2. 点击图标显示窗口
3. 如果还是没有，重启应用

## 项目结构

```
.
├── src/
│   ├── main/              # Electron 主进程
│   │   ├── main.ts        # 主进程入口
│   │   ├── preload.ts     # 预加载脚本
│   │   └── services/
│   │       └── binance.ts # Binance API 服务
│   └── renderer/          # Vue 渲染进程
│       ├── index.html
│       └── src/
│           ├── App.vue    # 主组件
│           ├── main.ts    # 渲染进程入口
│           └── style.css  # 样式文件
├── dist/                  # 编译输出目录
├── package.json
└── README.md
```

## 开发相关

### 构建脚本
- `npm run dev` - 开发模式（热重载）
- `npm run build` - 构建生产版本
- `npm run build:main` - 只构建主进程
- `npm run build:renderer` - 只构建渲染进程
- `npm run watch:main` - 监听主进程文件变化

### 使用淘宝镜像加速

如果 Electron 下载慢，请设置环境变量：
```bash
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
```

或查看 `INSTALL.md` 了解更多安装选项。

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 免责声明

本软件仅供学习和个人使用，不构成任何投资建议。使用本软件进行的任何交易决策，风险自负。

