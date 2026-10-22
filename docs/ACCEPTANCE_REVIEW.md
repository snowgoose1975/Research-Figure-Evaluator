# 独立验收记录 · 2026-10-22

验收对象：DeepSeek 本轮候选版。结论：工程候选版有条件通过，最终比赛成品暂不通过。真实本地视觉链路已有证据，不能再称其为纯脚本原型；但可复现启动、历史回放、科学差异检测验证、调用审计和提交文稿仍有缺项。本次不修改产品代码，不覆盖既有运行和验证产物，不发起新的模型推理，不推送或发布。

## 发现（按处理优先级）

### 1. P1：已有真实结果无法从历史界面打开

`src/app/page.tsx:106` 将可打开的历史固定为 `runs.slice(0, 8)`，无分页、过滤、按 ID 打开或历史详情路由。API 虽返回最近 50 条（`src/lib/storage/index.ts:49`），界面没有入口访问第九条以后的结果。

独立 Edge 验证：历史按钮显示 8 条，LIVE 为 0；脚本指定真实 run `1792609657136-e85156a8` 在 API 数组索引 16。它仍在磁盘并可经 API 读取，但使用者无法按演示脚本从正常界面重新打开。应提供可搜索/分页的历史，或支持按 run ID 直接进入结果；不要删除教学运行来腾位置。

### 2. P2：默认启动和文档命令不能稳定复现实测配置

`src/lib/pipeline/config.ts:6,11` 的默认值仍是 `qwen3-vl:4b` 和 6000 输出；实测使用 `qwen3-vl:4b-instruct-16k` 和 10000。README 首段 `npm run dev` 不设置这两个值，会在新 shell 中使用另一套模型与输出配置。当前生产进程使用已设置的环境变量，所以本次 `/api/status` 的确 configured=true；这不证明默认启动正确。

`README.md:30` 在 PowerShell 代码块中使用 `printf`，标准 PowerShell 不提供该命令。`docs/submission/DEMO_SCRIPT.md:27` 使用 POSIX 临时环境变量语法，同样不能直接在本项目 PowerShell 执行。应提供项目内可审查的最终 Modelfile 及一致的 PowerShell 启动方式，或统一应用默认值；不需要修改 .env。

### 3. P2：已有 4/4 尚未验证科研信息损失的检测能力

`src/lib/evaluation/index.ts:81,100` 的 A→B 逐项差异和新增命题检测只遍历 `facts`。真实样例的 A/B facts 为空，因此相关结果为空；图节点、关系、曲线数值变化没有进入这两项检测。

可核实例子：run `1792609657136-e85156a8` 中，A 把标为 alpha=0.05 的线采样为 `(0,0)→(3,0)`，B 再读为 `(0,1)→(3,0)`；重建 PNG 实际画的是 y=0 的水平线。报告 k4 仍为 retained、observed_stage=none，summary.unresolved=0，A→B 差异为空。B 还把轴上的 scale 文案 linear 放进 unit 字段。以上变化没有形成针对性告警。

这里不能直接指控 k4 的 retained 是错判：其原文只断言“有一条标为 alpha=0.05 的参考线”，并未明确检验高度和水平性。问题在于现有检查点大多验证标签与顺序，无法据其 4/4 证明该工具能发现数值、几何或条件的关键损失。DELIVERY_VALIDATION 已诚实披露部分限制，披露本身不能替代有效负例验收。

在认定科学检查功能通过前，应增加预先冻结的、包含单位/阈值/方向/条件的科学检查点和明确错误对照，保留原检查点与旧结果；为无 facts 的记录明确显示相关差异检测未执行，而不是让空列表被理解为“没有变化”。跨图类型的比对或约束审计须有真实反例验证，不要靠调宽评分过关。

### 4. P2：语义修复的先前调用未进入运行审计

`src/lib/model/index.ts:175–195` 在第一次结构/语义校验失败后重新读图，最终只返回第二次 `call()` 的 meta。先前响应、错误、耗时、token 用量和请求 ID 未保存或累计。`repairs:1` 说明有第二次请求，但 `attempts` 和 usage 仍只描述最后一次。

真实浏览器 run 中 reading_a 阶段起止约 23.6 秒，meta.latency_ms=13608；reading_b 阶段约 23.0 秒，meta.latency_ms=13391，两者 repairs=1。整体运行约70秒的数字成立，但阶段耗时、总用量和“主链路三次调用”不完整。四个失败的存档没有原始 finish_reason/usage/响应，故只能独立核对到 Reader A incomplete；不能凭存档还原其所有内部调用。

建议持久化每次调用/修复的结果或安全错误元数据，累计耗时/usage，并保留实际配置与模型摘要。不要保存密钥。失败原始内容不得被自动公开。

### 5. P2：参赛文稿的部分事实表述超过现有证据

- `docs/submission/WRITEUP.md:15` 的 pre-registered 没有对应预注册记录；现有证据支持“固定协议”，应改用该词或提供事前登记证据。
- 同段及 `docs/DELIVERY_VALIDATION.md:25` 称每次都有独立基线；实际只有 8 个成功主链路运行有 baseline，4 个 Reader A 失败的 baseline=null。应明确条件。
- `docs/DELIVERY_VALIDATION.md:16` 称经玉米确认；`scripts/protocol.mjs:28` 实际自动设置 author_confirmed=true。本次未找到独立的玉米逐项确认记录。运行内该布尔值不能证明人工确认事件；在没有额外证据时应写“项目整理并由测试脚本确认的检查点”。默认 manifest 未确认是正确的，不应为美化声明而修改。
- “prompt revised once”遗漏中间 0.2.1 回归实验，应准确交代两个候选修订或说明采用版本。
- 一页说明目前是约580词 Markdown 草稿，尚无检查过分页的 PDF/DOCX；视频只有脚本，未有成片。这与交付中“草稿/未录制”状态一致，但不能作为最终比赛附件验收通过。

## 独立核实通过的内容

- 本轮重跑 `npm run validate`，exit 0：类型检查、ESLint、6 文件 29 测试、生产构建通过。
- 实时 `/api/status`：configured=true，模型 qwen3-vl:4b-instruct-16k，chat，本机 Ollama，无活动运行。
- 固定协议汇总引用 12 个不同 live run，模型、提示、引擎和 settings_digest 一致；8 个完成、4 个失败，与逐次文件和 manifest 相符。没有发现协议脚本复用旧 run 或将 mock 计入的证据。
- 8 个完成运行均有 A/B JSON、重建 PNG/SVG 和基线；8 个报告的 retained_a/retained_b 均为4。该结论是模型报告的计数，不是人工科学真值。
- 根据记录中的引擎、版本、模型和已知服务地址重算 maxOutputTokens=10000 的 settings_digest，与协议记录匹配。该核对支持所述输出配置；num_ctx 等模型内部配置仍没有随 run 完整冻结。
- 现存 browser-console.json 的16项均为通过且错误数组为空。本次另以 Edge 独立只读检查：4张真实图卡、历史入口、桌面无脚本异常、390px scrollWidth=clientWidth。没有再次发起教学或真实推理，因此不把这次检查说成重跑完整16项。
- 四张论文 PNG 的 SHA-256 与 manifest 一致。原始来源/许可链接可追溯；本轮未重新联网审核许可。

## 建议验收门槛

先修历史入口与可复现启动，补全调用审计并更正文稿；再用有意义的科研负例验证偏差检测，明确哪些检测未覆盖。最后将一页说明排版、录制可回放的真实演示。发布、推送、部署和比赛提交继续遵守玉米的授权红线。

该结论不要求新建账号、付费模型、扩大数据规模或重写整个应用。
