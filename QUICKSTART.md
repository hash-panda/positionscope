# 快速开始

## 🚀 5 分钟上手

### 1️⃣ 安装依赖
```bash
# 使用淘宝镜像加速下载
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install
```

### 2️⃣ 启动应用
```bash
npm run dev
```

或者使用快捷脚本：
```bash
./dev.sh
```

### 3️⃣ 配置 API Key

1. 等待 Electron 窗口打开（会自动在菜单栏显示图标）
2. 点击菜单栏的应用图标
3. 点击右上角「设置」按钮（⚙）
4. 输入你的 Binance API Key 和 Secret
5. 点击「保存」

### 4️⃣ 查看持仓

保存成功后，应用会自动加载你的合约持仓信息！

---

## ⚠️ 常见问题

### "Electron API 未加载" 错误

**原因**：没有通过 Electron 启动应用

**解决**：
- ✅ 运行 `npm run dev` 或 `./dev.sh`
- ❌ 不要直接访问浏览器的 `http://localhost:3000`

### 如何获取 Binance API Key？

1. 登录 Binance
2. 账户 → API 管理
3. 创建 API Key
4. ⚠️ **只勾选「读取」权限**
5. 完成验证，复制 Key 和 Secret

### 窗口在哪里？

应用以菜单栏应用的形式运行：
- 查看 macOS 顶部菜单栏
- 找到应用图标（小图标）
- 点击图标显示/隐藏窗口

---

## 📝 开发模式说明

运行 `npm run dev` 后会发生什么：

1. **Vite 启动**：前端开发服务器在 `localhost:3000` 启动
2. **等待就绪**：自动检测 Vite 是否启动完成
3. **Electron 启动**：打开 Electron 窗口并加载应用
4. **DevTools 打开**：自动打开开发者工具，方便调试

### 热重载

- 修改 Vue 组件代码会自动刷新界面
- 修改主进程代码需要手动重启

### 关闭应用

在菜单栏图标上右键 → 选择「退出」

---

## 🎯 下一步

阅读完整文档：
- `README.md` - 详细功能说明
- `USAGE.md` - 完整使用指南
