# 安装说明

## Electron 下载慢的问题

如果 `npm install` 或 `pnpm install` 在安装 Electron 时卡住很久，可能是因为：

1. Electron 文件较大（约90MB）
2. 国内网络下载 GitHub Releases 较慢

## 解决方案

### 方案 1：使用淘宝镜像（推荐）

```bash
# 设置 Electron 镜像
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"

# 然后重新安装
rm -rf node_modules package-lock.json
npm install
```

### 方案 2：使用 cnpm

```bash
# 安装 cnpm
npm install -g cnpm --registry=https://registry.npmmirror.com

# 使用 cnpm 安装依赖
cnpm install
```

### 方案 3：手动下载 Electron

如果上述方法都很慢，可以：

1. 先安装其他依赖（跳过 Electron）：
   ```bash
   npm install --ignore-scripts
   ```

2. 手动下载 Electron：
   - 从淘宝镜像下载：https://npmmirror.com/mirrors/electron/28.3.3/
   - 选择对应平台的文件（macOS 选择 `electron-v28.3.3-darwin-x64.zip`或 `electron-v28.3.3-darwin-arm64.zip`）

3. 解压到正确位置：
   ```bash
   # 解压到 node_modules/electron/dist/
   unzip electron-v28.3.3-darwin-*.zip -d node_modules/electron/dist/
   ```

## 当前安装状态

Electron 正在下载中，请耐心等待...

如果等待时间过长（超过 10 分钟），建议按 Ctrl+C 停止，然后使用上述方案之一重新安装。
