# T16 固定站点访客历史交接

集成复核更新（2026-10-22）：此文件记录分支交付时的实现边界。后续由主代理完成消息桥接、存储及已发布站点上的受控浏览器验收；最终通过项和公网限制以[主交接](T16-history-and-submission-readiness.md)为准。

## 交付

- 固定站点的“Check my figure”现在打开访客工作区，不再跳转到轮换的 tunnel origin。工作区从 `service-status/endpoint.json` 定时读取当前入口，仅接受 HTTPS 子域 `*.lhr.life` 或 `*.localhost.run`；endpoint 超过 6 小时或非 online 时显示离线状态，历史仍可访问。
- tunnel 页嵌在 iframe。父页只接受当前 iframe `contentWindow` 发来且 `event.origin` 完全等于当前白名单 tunnel origin 的消息；父页仅向该精确 origin 发送消息。访客工作区还限制在固定站点 `https://figure-relay.chicchair5.chatgpt.site` 使用。
- `rfe:ready` 握手后，父页可以发送 `rfe:restore-job` 或 `rfe:show-saved`。收到 `rfe:job-accepted` 后，只把本地随机记录 ID、job ID、capability 和时间短期放入 `localStorage`；读取时按 `createdAt` 执行 6 小时 TTL，过期后删除 capability 并提示未终结任务无法恢复。收到终态后将结果投影到 IndexedDB，并清除 capability。
- IndexedDB保存模型报告、A/B阅读记录、结构审计、重建图、限制与时间；递归排除上传图片、文件名字段。保留逐项报告正文供复看/下载，但不把关键点复制到历史 metadata 或搜索索引。浏览器存储只留 12 MiB 内报告；超大或畸形消息被拒绝保存。
- 历史支持关键词搜索、离线复看、JSON 下载、逐条移除和清空。若 tunnel 未就绪，稳定站点自己的查看器仍显示 reader A/B、评估、重建和保存时间。界面说明清理浏览器副本不会清除主机私有审计记录。
- `?workspace=1` 深链打开访客工作区；首页和案例入口保持可返回。

## 改动文件

- `src/app/page.tsx`
- `src/components/entry.module.css`
- `src/components/visitor-history.ts`
- `docs/handoffs/T16-stable-site-history.md`

## 验证

- `npm run typecheck`：通过。
- `npx eslint src/app/page.tsx src/components/visitor-history.ts`：通过，无警告。
- 尚未在当前独立任务中执行浏览器端端到端验证。集成方需验证 iframe CSP、消息白名单、跨 tunnel 恢复、完成保存、离线复看、下载/移除、原图字段排除及 capability 清理。
- T16 子页桥接口字段为 `job-accepted {jobId, capability, acceptedAt}`、`job-finished {jobId, capability, finishedAt, status, result?, error?}`；当前桥实现中 `jobId === capability`。稳定页仍容忍 capability 缺失时以 jobId恢复。

## 限制

- 访客历史仅属于当前浏览器和固定站点 origin。清除浏览器站点数据会移除报告副本。
- tunnel 轮换或主机停止时，已完成并保存的报告可离线查看；未完成任务最多 6 小时可用本地 capability 尝试恢复，6 小时后本地 capability 自动删除。服务端内存结果过期或主机重启后不能恢复，也不会自动重提。
- 本交接覆盖固定站 UI/浏览器存储，不代表本机历史搜索/API、子页安全头或最终生产发布已验收。
