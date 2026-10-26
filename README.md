# 磁盘清理（Disk Janitor）

DeepSeek Harness 的磁盘清理插件：看清 DSH 到底占了哪块盘，再一键清掉**可以再生**的缓存。

- **设置页**：设置 → 磁盘清理（`settings.section`，排在「插件」之后）
- **对话里**：直接对 Agent 说“看看 DSH 占了多少磁盘 / 清理一下缓存”，它调用 `disk_janitor` 工具
- **自动模式**：可选，只自动清理临时的 `dsh-*` 目录与图片预览缓存

## 清理项

全部是**可再生**的缓存，不碰会话、附件、插件与运行时：

| id | 内容 | 说明 |
| --- | --- | --- |
| `bash-runtime` | `$DSH_HOME/dsh-ops/bash-ipc/*` | Windows 沙箱 Bash 的解压副本。删除后下一次终端调用会重新解压（首次略慢），不影响任何数据。**通常最大的一块。** |
| `request-image-cache` | `$DSH_HOME/cache/attachments` | 为模型请求生成的图片副本，按需重建 |
| `projection-cache` | `$DSH_HOME/storages/session_projcache` | 会话视图的派生缓存，清理后首次打开会话稍慢 |
| `acl-backups` | `$DSH_HOME/dsh-ops/acl-backups` | 修复文件权限时留下的回滚记录 |
| `temp-scratch` | 系统临时目录里的 `dsh-*` | 只清理 6 小时前未改动过的 |
| `desktop-cache` | `%APPDATA%\@deepseek-ai\dsh-desktop\{Cache,GPUCache,…}` | Electron 渲染/着色器缓存，重启 DSH 后重建 |

扫描同时给出 `$DSH_HOME` 每个顶层目录的占用（插件、运行时、会话、附件……），所以“盘到底被谁吃了”一目了然。

> 会话日志、附件不在清理范围内：它们属于你的数据，请用会话列表里的删除操作处理。

## 安全设计

- 删除只作用于**六个固定缓存根目录内的条目**，路径全部由 Host 侧解析，客户端只能传类别 id，传不了路径。
- **只认 loopback**：路由会校验 `Host`，非 `127.0.0.1` / `localhost` / `::1` 的请求一律 403（防 DNS rebinding 借用浏览器访问本地端口）。
- 写操作要求 `Content-Type: application/json`，跨站表单/`text/plain` 简单请求被拒（CSRF 屏障）；带 `Sec-Fetch-Site: cross-site` 的请求直接 403。
- `?force=1` 的强制扫描 2 秒内只生效一次，避免本地进程刷接口把 CPU 打满。
- 自动清理默认**关闭**，且只能选 `temp-scratch` / `request-image-cache`。

## 配置

设置页改动会写入 `$DSH_HOME/dsh-disk-janitor.json`，也可手改：

```json
{
  "autoClean": { "enabled": false, "intervalHours": 6, "categories": ["temp-scratch", "request-image-cache"] }
}
```

## 实现

- Host：`index.js`（路由 + `disk_janitor` 工具 + 自动清理计时器）、`lib/janitor.js`（分类/测量/删除）、`lib/http.js`、`lib/settings.js`。只用 `node:` 内建模块，不 import 任何 DSH 包，升级后不会因为解析失败而挂掉。
- Client：`client.js`，纯 `window.__ModuleLoader__` 工厂 + `React.createElement`，主题变量全部带兜底值。
- 要求 DSH 0.2.x（`dsh.bundle.patch` + `dsh.client` 契约）。
