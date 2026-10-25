# 安装脚本下载代理连接失败

用户反馈下载bootstrap脚本时curl连接127.0.0.1:7890失败，脚本未执行，因此不能视为安装失败或已卸载。当前会话仍无用户Mac控制入口。

增加显式 --direct，作用于安装脚本内部ZIP下载；bootstrap命令也需设置curl --disable --noproxy '*'。默认保留环境代理行为，不修改本机系统/终端/应用代理设置，不输出代理变量值。连接错误保留原curl退出码与可执行提示，不继续解包或替换应用。固定摘要、Bundle ID、签名、Gatekeeper和旧应用回退边界保持。

本地参数组合、非Mac早退、固定发布摘要及Bash语法检查通过。Mac CI使用故障loopback代理变量运行 --verify-only --direct；真实下载与验签结果以本PR的storage-macos检查为准。用户网络、替换安装、原生UI与权限弹窗仍未验证。
