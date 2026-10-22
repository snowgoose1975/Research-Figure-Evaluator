# T16 访客历史消息桥

集成复核更新（2026-10-22）：此文件记录分支交付时的实现边界。后续由主代理完成有限轮询重试及已发布站点的受控集成验收；最终结论和限制以[主交接](T16-history-and-submission-readiness.md)为准。

## 交付

修改 `adapters/local-service/public.html`，为固定公开站点的嵌入页增加受限 `postMessage` 桥接。目标父站 origin 固定为 `https://figure-relay.chicchair5.chatgpt.site`。子页只处理 `event.source === window.parent` 且 `event.origin` 完全匹配的消息；发送时只用精确父站 origin 作为 `targetOrigin`。直接打开临时 tunnel 时没有父页，原有提交和查看结果流程照常工作。

支持父页消息：

- `rfe:restore-job`：验证 64 位十六进制 capability，然后只 GET 现有 `/jobs/<id>` 并恢复轮询；不会重新 POST 图片。
- `rfe:show-saved`：从父页传入的 `{jobId, createdAt, finishedAt, status, result?, error?}` 或直接 result 载荷渲染只读报告，不访问队列。显示“Return to saved checks”回到固定站的 `/?workspace=1` 访客历史工作区。

支持子页消息：

- 加载后发 `rfe:ready`。
- 服务接受一次提交后发 `rfe:job-accepted`，包括 `jobId`、同值 `capability` 和客户端 `acceptedAt`。
- completed / failed / cancelled 终态发一次 `rfe:job-finished`，包括 `jobId`、`capability`、终态获取时间 `finishedAt`、`status`，成功时只附当前 job 的 `result`，失败时附错误摘要。消息不含原图、文件名或上传字节。

访客同意文案说明：机主电脑会处理并保留私有运行；从固定入口使用时，结果副本保存在当前浏览器，可在那里查看或清理。没有增加服务端访客历史 API、自动 POST 重试或更改队列 TTL。

## 验证与限制

本任务未单独运行测试或生产构建；集成负责人需按 T16 集成验收检查父子消息、origin 伪造拒绝、暂停服务时的历史渲染和真实完成结果保存。恢复任务若服务重启或 30 分钟内存 TTL 到期，子页显示不可用并明确不会重提；成功历史副本仍由固定站点浏览器保存。

队列视图目前不提供原始 `submittedAt`。新任务 `acceptedAt` 由子页记录；恢复后的 `finishedAt` 是恢复后实际读取到终态的时间。父端应按 `jobId` 合并并保留已保存记录的原始 `createdAt`。
