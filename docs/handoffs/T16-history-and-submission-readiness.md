# T16 · 历史检索与提交就绪收尾

日期：2026-10-22
状态：T16固定站已发布；机主历史通过定向验证，访客历史UI与轮询恢复通过受控测试；真实公网访客保存闭环仍未确认。比赛尚未提交。

## 已交付

- 机主历史支持跨全部本地runs的摘要搜索、分页和总数，可按ID、状态、时间、模型、作者关键点、A/B抽取内容及报告内容搜索；点击摘要仍通过既有详情接口打开完整报告。列表不返回完整记忆、图像或私有磁盘路径。
- 9041控制台提供本机工作台链接。确认无运行/排队任务后重启了旧Next进程；此前旧进程返回5个Next静态chunk 500，导致本机界面无法hydrate。当前生产服务已加载本地工作树最新构建。
- 固定公开入口部署T16 v4：`https://figure-relay.chicchair5.chatgpt.site`。Sites version `appgver_132cff8c1f308191955a4fe9af33b429`；deployment `appgdep_6ad9f8794a188191aa8125da23af0606`。
- 访客报告在固定站点origin的IndexedDB保存，支持浏览器内搜索、离线打开、JSON下载、逐条删除与清空；不向服务器提供访客历史，不访问机主runs，不保存上传原图、文件名或临时能力ID至终态报告。
- 本机服务进程使用T16 `PUBLIC_FRAME_CSP`重启；临时隧道可能轮换。最后检查时公开发现文件为online，/status接受请求、active/waiting均为0，根页frame-ancestors允许固定站且没有X-Frame-Options冲突。无开机启动项。

## 验证

本节原始通过项来自T16交接前的完整验证。本轮第一次复验在默认沙箱遇到loopback EACCES；在允许本地测试的执行环境中，全量测试第一次有一个5秒并行超时，随后以4 workers复跑通过。typecheck、lint、125项测试与生产构建现均已通过。

```text
npm run typecheck                    pass
npm run lint                         pass
npm test -- --maxWorkers=4           19 files / 125 tests passed
npm run build                        pass
npx eslint scripts/t16-visitor-history-e2e.mjs scripts/t16-visitor-history-replay.mjs scripts/t16-owner-history-e2e.mjs
                                     pass
```

- 机主历史UI/API：7/7通过，搜索本次运行并打开完整报告；摘要不含assets或A/B全量memory。`artifacts/validation/T16-owner-history-e2e-v3.json` 与两张PNG。
- 访客浏览器桥接回放：10/10通过，使用本次已完成真实run的A/B/report/reconstruction产物，以受控消息注入访客history。验证搜索、刷新、断开隧道后离线打开、删除、原图字段排除及能力ID清理。**此为受控桥接重放，不是第二次真实提交，也不代表模型准确性。** `artifacts/validation/T16-visitor-history-replay-v1.json` 与两张PNG。
- 状态轮询恢复：5/5通过；stub依次返回两次502后返回完成报告，只POST一次、GET三次，无意外浏览器错误。`artifacts/validation/T16-poll-retry-smoke-v2.json` 与截图。未访问隧道、未运行模型。
- 已发布站点综合访客history：12/12通过，见`artifacts/validation/T16-visitor-history-resilience-v2.json`和两张截图。实际固定站页面加载真实表单，受控worker stub模拟2次502及后续完成；复用真实run的完整报告，验证一次POST、三次GET、IndexedDB保存/检索、刷新、隧道离线阅读、删除与不存原图/文件名。**该测试没有访问真实隧道worker或调用模型；是生产站点UI上的受控集成测试，不是实际公网传输证明。**
- 真实公网访客表单只提交一次公开材料图，运行完成：`1792674795248-f18f993e`，模型 `qwen3-vl:4b-instruct-16k`，提示词 `reader-0.2.3`。不计入原8/12固定协议统计。live证据还记录结果轮询中的13次HTTP 502，没有成功确认访客IndexedDB中保存了这次真实提交。
- live脚本曾使用`.historyList li`选择器（生产构建CSS Modules会哈希类名），该问题已修正；但失败不只来自选择器，隧道502也阻断了结果送达。没有再次调用模型。
- worker现对临时网络错误/502/503/504作有限状态GET重试，最多5次、不重复POST。受控HTTP stub浏览器测试5/5通过：两次模拟502后恢复，POST 1次、状态GET 3次，报告正常显示。见`T16-poll-retry-smoke-v2.json`。
- `T16-visitor-history-replay-v1.json`以该真实run报告做受控消息回放，10/10通过。综合站点E2E `T16-visitor-history-resilience-v2.json`另以HTTP stub验证生产站点中的表单→worker协议→报告→IndexedDB完整浏览器路径，12/12通过；worker endpoint被stub替代，不是真实隧道闭环。

## 限制与未完成

- 访客历史只属于当前浏览器与固定网站origin；换浏览器或清空站点数据后不会同步。未完成任务依赖短时内存队列和临时能力，服务重启后可能无法恢复，且不会自动重提。
- 真实公网访客“worker完成响应→浏览器IndexedDB保存”尚未在一次无故障live会话中确认。当前证据分别覆盖真实模型run、worker的502恢复逻辑、访客历史桥接UI和机主历史；不把这些独立证据合并成完整公网E2E。
- 本机免费模型与临时隧道没有SLA；电脑睡眠、网络断开或隧道轮换都可能暂停新分析。用户选择手动启动；未配置开机启动项。
- 人工视觉复核仍未完成；演示视频未录制（平台选填）。真实模型8/12和T15结论均未更改。
- 根仓库这些本地改动尚未push。比赛帖子和Moment队伍条目尚未发布/提交；规则确认及最终入口操作仍需玉米完成并明确授权。

## 下一步

1. 玉米或独立人员人工核对一次物理、材料或数学案例重建，并确认AI意见符合实际科学语境。
2. 用公开固定入口人工体验上传告知、同意、访客历史和控制台；保持只上传已发表公开图。
3. 核对比赛账号、帖子、write-up、公开仓库、规则确认；公开视频为选填。正式发帖或提交需单独遵守AGENTS红线授权。
4. 若要把根仓库代码同步GitHub，先完成本地变更复核，再单独确认push授权；当前未push。

用户希望20:00续办；没有创建系统计划任务或自动化，本轮由用户手动续接。
