# 官网公开一致性核验

在仓库根目录运行 `node scripts/audit-live-site.cjs`。需要 Node 22+ 和 curl；不需要安装依赖或登录。只读取仓库 website/release.json、robots.txt 和固定自有域名的公开内容，不读取应用配置、Key、账户、环境凭证文件或安装包。使用现有代理环境和 curl 的正常 UA；不改变代理或安全规则，不传认证头，不重试、不跟随重定向；禁用 curlrc，避免它添加额外请求/认证参数。

最多三个并发、六次 GET，每次连接预算5秒、curl总预算8秒，子进程10秒退出，正文最大512KiB/总输出最大1MiB。异常只输出固定类别，不保存/打印原始正文、cookie、其他响应头或代理错误。工具不是鉴权绕过器或下载器。

核验首页、下载页、方法页的精确 canonical、可索引头/meta 与首页 SoftwareApplication 版本。下载页与静态门禁共用检查规则，四个 DMG/ZIP 锚点的带引号 href 须和清单逐一匹配。额外安装包链接或重复属性判为不匹配，data-href 和注释中的 URL 不计入下载入口。robots 与仓库政策一致，sitemap 含全部七个 canonical 路由且无重复，公开 release.json 与已发布清单一致。覆盖项目生成的 HTML 格式及上述字段。

stdout为JSON，记录开始/结束时间、期望版本、逐资源检查及限制。全部匹配退出0；超时、HTTP非200、内容不匹配等退出1，参数错误退出2。transport-unverified表示此观察点未取得有效HTTP结果，不能称源站宕机。HTTP200也只有对应checks匹配才记通过；verified并非收录/排名、全球可用性、访问、激活或收入证明。

不把线上网络检查纳入PR必需门禁，以免网络波动污染源码CI；CI只运行注入合成reader的离线测试。每日人工/维护执行可将脱敏JSON保存到docs/ops/metrics，失败保留为未验证而非跳过测试或调整UA/代理。发布一致性静态检查及Mac安装器验签继续保留，工具不替代它们。
