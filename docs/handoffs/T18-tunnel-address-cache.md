# T18 — 临时隧道地址缓存故障

日期：2026-10-22

## 故障与定位

访客轮询返回 HTTP 502 / `no tunnel`，旧界面将连接错误与任务过期混在一起。主机正常接单，最新运行 `1792679901262-de6f77fd` 已完成。只读检查发现 GitHub raw 分支 URL 即使加时间查询参数仍返回 14:19 的旧地址；GitHub Contents API 返回 14:39 的当前地址，且当前隧道 `/status` 返回 200。故障发生在地址发现/结果传输，不能据此判模型失败。

## 修复

- 公开访客入口改用 GitHub Contents API 读取地址公告，保持原有 HTTPS 隧道域名白名单和公告时间校验。
- 缓存 3 分钟并合并并发查询，避免工作区每 30 秒刷新都消耗未认证 API 配额；接口失败不回退到已知可能陈旧的 raw 地址。
- 复用既有 pending 会话恢复同一任务，不自动重复提交图片。不重启 worker，以保留尚在领取窗口中的内存结果。
- 更新公开构建白名单，纳入地址发现模块。

## 验证与发布

- `npm run validate`：类型、lint、20 文件 / 127 项测试、生产构建全部通过。
- `node scripts/build-public-demo.mjs --label T18-current-endpoint-v1`：成功。
- Sites v6：源码 `80a270e99850ef594c40275098b6b7cb0eeb825b`，version `appgver_4a739f8a9c888191a72c765e8716b40b`，deployment `appgdep_6ada21df7d3c81918bdaa71c34f3700c`，发布成功。
- 真实浏览器访问已部署站点，iframe 载入当前隧道，`/status` 返回 200 / accepting=true，无页面错误；证据 `artifacts/validation/T18-live-endpoint-v1.json`。首次探针选择了平台辅助 iframe，改为按分析 iframe 的 title 唯一选择后通过。

## 限制

- 本次未调用模型、未访问用户会话能力 ID，也未验证用户标签页实际领取成功。已提醒用户在原标签页刷新，避免重复提交。
- 任务仍有既有 30 分钟领取期限；超时或 worker 重启后不能通过公开服务找回会话。磁盘运行结果保留。
- 免费隧道依然可能中断，GitHub API 存在共享 IP 未认证速率限制；接口不可用时显示主机不可达，浏览器中已保存历史仍可读取。
