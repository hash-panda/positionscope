# PositionScope · 仓位镜 标识

2026-10-25，主图使用内置image_gen生成，技术下采样与ICNS封装后用于应用；不是Electron、Binance或其他交易所标识。`app-icon.png`为1024×1024 RGBA主图；`app-icon.icns`包含16–1024像素及Retina项。`mark.svg`是与主图对应的简化矢量标记，菜单栏PNG为18/36像素黑色透明版（72/144dpi）。应用内与官网使用同一造型。

主图生成提示：

> Use case: logo-brand. Asset type: production macOS application icon for PositionScope, an independent read-only portfolio monitoring utility. Create ONE finished square app icon, 1024 by 1024, not a presentation sheet or device mockup. Design direction: a precise viewfinder that contains two comparable position bars. A dark ink (#171D24) macOS-style softly rounded square tile, filling about 88% of the square canvas with truly transparent exterior corners and margins. Center a single large, bold warm gold (#F4CA55) custom geometric mark: an open rounded-square focus frame with a distinctive gap at the upper right, enclosing two short, staggered horizontal rounded bars. The upper bar starts farther left and ends around the middle; the lower bar starts around the middle and ends farther right, so the pair is visually balanced, not an ascending profit chart. This is an optical instrument for seeing positions clearly, not a trading or money-making promise. Strong clean silhouette, few shapes, generous negative space, carefully aligned stroke weights, legible at tiny icon sizes. Contemporary premium macOS utility: predominantly flat, with restrained tactile edge lighting and a subtle soft tile shadow only. No text, no letters, no numbers, no sparkles, no coins, no dollar signs, no bull/bear imagery, no candlesticks, no arrows, no stock chart, no exchange logos or existing brand imitation. No glass orb, no gradients on the mark, no visual clutter. Exactly one icon centered on a transparent background; no surrounding labels or variants.

ICNS中的PNG来自同一主图等比下采样，Mac CI以iconutil解包并用真实Electron比较最大图像素、检查黑色透明Template及2x表示。签名前逐字节核对包内应用/菜单栏图标；验证结果进入Release JSON。维护时不得用默认Electron图标兜底。主图及变体随本仓库MIT声明提供。

依据：[Electron nativeImage](https://www.electronjs.org/docs/latest/api/native-image)、[electron-builder图标配置](https://www.electron.build/v26/docs/features/icons-and-images/)，并对照已安装26.18.0的macPackager实现。
