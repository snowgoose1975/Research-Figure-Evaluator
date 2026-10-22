# T16 本机历史检索 UI 交接

集成复核更新（2026-10-22）：此文件记录分支交付时的实现边界。后续由主代理完成API/UI浏览器验收；最终通过项和剩余限制以[主交接](T16-history-and-submission-readiness.md)为准。

## 改动

- `src/components/workbench.tsx`：移除只对最近 50 个 `RunSnapshot` 做前端过滤的历史列表；改为调用全量搜索接口 `GET /api/runs?history=1&q=&offset=&limit=20`，消费共享 `RunHistorySummary`。支持 250ms 输入防抖、取消过期请求、服务端总数、20 条分页、失败摘要、空态、错误重试、按完整 ID 打开原有运行详情。
- 比较器继续使用旧的最近 50 条 `runs` 快照，历史检索结果不会覆盖比较器数据。
- `src/app/globals.css`：为分页、总数和摘要副行增加样式。

## 验证

- `npm run typecheck`：通过。
- `npx eslint src/components/workbench.tsx`：通过。
- 一次并行整仓 `npm run lint` 仍报告 `src/app/page.tsx` 中其他 T16 工作分支的问题（同步 effect 状态更新及两个原生 `<a>` 导航错误）；本工作台文件的 hook 报错已修复，单文件 lint 复验通过。请集成人统一修复后再跑整体验证。
- 未添加镜像实现的 UI 单测；端到端历史数据/分页验收需由集成阶段针对服务端全量搜索接口完成。

## 限制

该组件只展示 API 返回的摘要字段，不读取历史图片、记忆、报告或私有路径。访客历史由另一分支文件实现，与本机历史搜索隔离。
