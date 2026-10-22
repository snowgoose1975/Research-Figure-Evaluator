# T08 验收修复交接 · 2026-10-22

状态：R01–R05 已按 [DEEPSEEK_REPAIR_BRIEF](../DEEPSEEK_REPAIR_BRIEF.md) 实施完毕，等待 Codex 独立复验。本文只记录实际改动和证据；旧运行、旧统计、旧检查点和 `protocol-p022-4b16k10.json` 均未覆盖。

范围约束遵守情况：未引入数据库、队列、付费服务或新框架；schema 扩展为可选字段；未删除文件；未修改 `.env`/密钥/CI；未安装全局依赖；未 push、部署、发布或提交比赛；未启动新的完整 4×3 协议，也没有付费模型调用。

## 总览

| 项 | 状态 | 结论 |
|---|---|---|
| R01 历史回放 | done | 22/22 浏览器检查通过；真实 run 可由正常界面打开 |
| R02 默认配置与启动 | done | 干净进程默认 `qwen3-vl:4b-instruct-16k` / 10000；Modelfile 与文档一致 |
| R03 逐请求审计 | done | 受控 HTTP stub 两个 run、16/16；重试、修复、length 失败均落盘 |
| R04 检测覆盖与负例 | done（限定范围） | 6 个冻结 synthetic 负例；真实数学 run 离线回归 8/8；未覆盖项已明示 |
| R05 文稿与一页说明 | done（视频按原状态未录制） | 文案已更正；A4 PDF 实测 1 页 |

## R01：历史回放

改动：

- `src/app/page.tsx`：历史记录从固定 8 条改为可过滤列表 + 每次 10 条展开；增加按完整 run ID 打开；结果写入 `?run=<id>`，页面加载时自动恢复；失败记录显示阶段和错误；不依赖该 run 在最近 50 条内。
- `src/app/globals.css`：历史表、过滤/打开表单、移动布局样式。
- `src/lib/storage/index.ts`：持久化逐请求审计 JSONL；历史列表和单条读取沿用只读接口，未改存储格式。
- `scripts/history-browser.mjs`：真实 Edge 浏览器检查，包含真实运行、失败运行、不存在 ID、导出、深链接刷新和 390px。

验证命令与结果：

```text
node scripts/history-browser.mjs
exit 0；22/22 checks ok
```

证据：

- `artifacts/validation/T08-history-browser.json`
- `artifacts/validation/T08-history-list.png`
- `artifacts/validation/T08-history-real-run.png`
- `artifacts/validation/T08-history-failed.png`
- `artifacts/validation/T08-history-not-found.png`
- `artifacts/validation/T08-history-mobile.png`

说明：存在的运行通过 `GET /api/runs/:id` 打开，没有在脚本里替换 API 响应。唯一的控制台 404 来自故意请求不存在 ID 的步骤，已在 JSON 中按 `step: "missing run"` 标为预期；`unexpectedConsoleErrors` 为空。

## R02：默认配置、Modelfile、PowerShell 命令

改动：

- `src/lib/pipeline/config.ts`：仅本地默认分支改为 `qwen3-vl:4b-instruct-16k` 和 `maxOutputTokens=10000`；显式 `RFE_*`/`OPENAI_*` 覆盖仍优先；远程服务不会静默选本地模型。
- `scripts/Modelfile.qwen3-vl-4b-instruct-16k`：可审查的最终定义，`FROM qwen3-vl:4b-instruct`，`PARAMETER num_ctx 16384`。
- `README.md`、`docs/HANDOFF.md`、`docs/submission/DEMO_SCRIPT.md`：启动命令改为标准 PowerShell，移除 `printf` 和 POSIX 内联环境变量；默认无需设置环境变量。
- `tests/config.test.ts`：默认值、显式覆盖、远程不回退、非法输出上限回退。

验证命令与结果：

```text
npm run validate   # 含 tests/config.test.ts
exit 0

# 干净 shell，未设置 RFE_/OPENAI_ 变量
curl http://127.0.0.1:3000/api/status
{"configured":true,"model":"qwen3-vl:4b-instruct-16k","protocol":"chat",...}
```

说明：生产服务由未设置覆盖变量的新 shell 启动；`/api/status` 返回默认模型，支持“新 shell 默认配置正确”。未修改机器/用户持久环境变量。

## R03：每次模型请求、修复和失败审计

改动：

- `src/lib/model/index.ts`：每次 HTTP 尝试生成独立记录；临时错误重试、首次校验失败、语义修复和最终失败分别记录；每条记录在下一请求前通过 `onAttempt` 落盘；阶段 meta 累计已知 usage 和耗时，并用 `usage_complete` 标明是否完整。
- `src/lib/pipeline/index.ts`：在请求前建立审计上下文，失败时持久化，最终失败也保留。
- `src/lib/storage/index.ts`：写入 `runs/<run-id>/model-calls.jsonl`。
- `src/lib/schemas/index.ts`：可选 `attempts_detail`、`usage_complete`、`config_snapshot`；旧运行不补写。
- `tests/model-audit.test.ts`：schema 修复、语义修复、length、临时 500、未知 usage、无密钥落盘。
- `scripts/t08-audit-stub.ts`：真实 pipeline + 可控本地 HTTP server。

验证命令与结果：

```text
npx tsx scripts/t08-audit-stub.ts
exit 0；16/16 checks pass

primary run 1792629726115-43ba30b6
  5 次 HTTP 尝试：
  1. 500 temporary_service_error（usage=null，request_id=null）
  2. 200 schema_failed
  3. 200 semantic_passed（phase=repair）
  4. 200 Reader B success
  5. 200 judge success

length run 1792629726849-ace8a605
  1 次 HTTP 尝试，finish_reason=length，error_code=incomplete
  run status=failed，error.stage=reading_a
```

证据：

- `artifacts/validation/T08-audit-stub-v2.json`
- `artifacts/validation/T08-audit-stub-v2-primary-model-calls.jsonl`
- `artifacts/validation/T08-audit-stub-v2-length-model-calls.jsonl`
- 私有原始文件：`runs/1792629726115-43ba30b6/model-calls.jsonl`、`runs/1792629726849-ace8a605/model-calls.jsonl`

第一版受控 stub（只覆盖 schema 修复）保留未覆盖：`artifacts/validation/T08-audit-stub.json`、`T08-audit-stub-model-calls.jsonl`、run `1792629154544-bc6d1ac7`。

向后兼容验证：

```text
node scripts/t08-legacy-coverage.mjs
exit 0；6/6 checks ok
```

旧 coverage 缺少后加的 `matched_plots` 时，界面不出现 `undefined`，Markdown 回退为 `matched plots: 0`。证据：`artifacts/validation/T08-legacy-coverage.json`、`T08-legacy-coverage.png`。

## R04：检测覆盖与科学负例

改动：

- `src/lib/evaluation/scientific.ts`（新增）：确定性 facts 比对与 plot series 审计。
  - 关系方向反转；条件丢失；数值/阈值变化（按末位精度设容差）；轴单位/尺度变化；系列形状变化。
  - 标签不唯一、多个候选或匹配不清时返回 `uncertain`，不跨记忆对齐局部 ID。
  - 每条 finding 带证据 ID 和 `review_required: true`。
- `src/lib/evaluation/index.ts`：科学检查点优先走规则判定；`evaluate` 产出 `coverage` 和 `scientific_findings`。
- `src/lib/schemas/index.ts`：可选 `Keypoint.scientific`、`EvaluationCoverage`、`ScientificFinding`。
- `src/lib/pipeline/report.ts`：Markdown 增加 “Detection coverage”“Scientific findings”“Project-curated scientific checks”；旧报告显示 unavailable/legacy。
- `src/app/page.tsx`、`src/app/globals.css`：Detection coverage 面板、项目整理标记、confirmed/uncertain 与 REVIEW 标记。
- `data/fixtures/T08-scientific-cases.json`（冻结于 2026-10-22，`synthetic: true`）：6 个负例，覆盖方向反转、条件丢失、阈值/水平变化、轴单位/尺度、系列形状、重复标签歧义；含 1 个项目整理、非作者确认的 alpha 阈值/恒定性检查点。
- `tests/scientific.test.ts`、`tests/report.test.ts`：负例、唯一 ID、review 标记、覆盖说明、legacy 报告。
- `scripts/t08-scientific-regression.ts`：在真实已保存 run 上离线回归。

验证命令与结果：

```text
npm test
exit 0；10 files / 54 tests passed

npx tsx scripts/t08-scientific-regression.ts
exit 0；8/8 checks pass
```

真实回归 run：`1792609657136-e85156a8`（数学 metric）。实际结果：

- A facts 为空 → fact-by-fact comparison 明确为 `NOT EXECUTED`，不再把空列表当零变化。
- alpha 系列在 A 为平坦、在 B 为 `(0,1)→(3,0)`，产生 confirmed `series_shape_change`。
- B 把 `linear` 放进 x/y 轴 unit 字段，产生 4 条 confirmed `axis_unit_scale`（两个面板 × 两轴）。
- 项目整理检查点：A retained（在 0.05 容差内），B contradicted。
- 所有 findings 均 `review_required: true`。

证据：`artifacts/validation/T08-scientific-regression.json`。

明确限制：

- 负例是 synthetic 记忆的离线工程测试，不是新模型能力结果；没有执行允许的 1 次新完整 live run 和 3 次独立语义负例调用，因为现有真实 run 已提供回归材料，避免把工程测试混入模型成功率。
- 自动审计只覆盖显式 facts 和可唯一匹配的 plot series；未覆盖无标签节点/边、置信带、几何/相对位置和精确读数。这些都写入报告的 `unchecked`。
- `series_shape_change` 和轴单位变化是规则级 confirmed，不是人工科学结论；仍需复核。
- 旧 8/12、4/4 统计和旧检查点保持原样；新检查点不回流主链路。

## R05：文稿与一页说明

改动：

- `docs/submission/WRITEUP.md`：`pre-registered` → `fixed protocol`；基线限定为 8 个完成运行、4 个 A 失败无基线；明确检查点由项目整理并由协议脚本标记，未找到独立逐项人工确认记录；补充 0.2.1 回归与 0.2.2 语义澄清；写入 alpha 与轴单位发现、覆盖限制、逐请求审计；工程数字更新为 54 tests/10 files、22 history checks + 16 interface checks。
- `docs/submission/POST.md`：中英文均改为固定协议、标签级保留不等于保真、alpha 负例、覆盖范围。
- `docs/submission/DEMO_SCRIPT.md`：基线条件、alpha 检查、Detection coverage、默认启动命令。
- `docs/submission/CHECKLIST.md`：更新历史、审计、覆盖、PDF 状态和证据路径。
- `docs/DELIVERY_VALIDATION.md`、`docs/MASTER_PLAN.md`、`docs/HANDOFF.md`、`README.md`：当前状态、测试数字、启动方式、T08 证据索引。
- `scripts/t08-writeup-pdf.mjs`（新增）：Markdown → 打印 HTML → Edge `page.pdf`；同时测量可打印高度并生成预览图。

验证命令与结果：

```text
node scripts/t08-writeup-pdf.mjs
exit 0
Rendered artifacts/validation/T08-writeup-one-page.pdf: 1 page(s), 40804 bytes.
Layout: content 977px of 1020px printable height; fits=true.
```

证据：

- `artifacts/validation/T08-writeup-one-page.pdf`
- `artifacts/validation/T08-writeup-one-page.json`（页数、字节数、源文件 SHA-256、排版测量）
- `artifacts/validation/T08-writeup-preview.png`

说明：排版检查是程序化页数 + 可打印高度 + 助手级预览，不是独立人工排版验收。视频仍未录制；本机未安装 ffmpeg，也没有私自安装全局依赖。

## 最终验证

代码稳定后执行：

```text
npm run validate
exit 0
- tsc --noEmit：通过
- eslint：0 error / 0 warning
- vitest：10 files / 54 tests passed
- next build：生产构建成功
```

浏览器与证据脚本：

```text
node scripts/smoke-api.mjs          exit 0；12 scripted pipelines，published mock rejected
node scripts/browser-smoke.mjs      exit 0；16/16
node scripts/history-browser.mjs    exit 0；22/22
node scripts/t08-legacy-coverage.mjs exit 0；6/6
npx tsx scripts/t08-audit-stub.ts   exit 0；16/16
npx tsx scripts/t08-scientific-regression.ts exit 0；8/8
node scripts/t08-writeup-pdf.mjs    exit 0；1 page
```

## 改动文件

产品代码：

- `src/app/page.tsx`
- `src/app/globals.css`
- `src/lib/pipeline/config.ts`
- `src/lib/pipeline/index.ts`
- `src/lib/pipeline/report.ts`
- `src/lib/model/index.ts`
- `src/lib/storage/index.ts`
- `src/lib/schemas/index.ts`
- `src/lib/evaluation/index.ts`
- `src/lib/evaluation/scientific.ts`（新增）

测试与 fixture：

- `tests/config.test.ts`
- `tests/model-audit.test.ts`
- `tests/scientific.test.ts`（新增）
- `tests/report.test.ts`（新增）
- `data/fixtures/T08-scientific-cases.json`（新增）

脚本：

- `scripts/Modelfile.qwen3-vl-4b-instruct-16k`
- `scripts/history-browser.mjs`
- `scripts/t08-audit-stub.ts`（新增）
- `scripts/t08-legacy-coverage.mjs`（新增）
- `scripts/t08-scientific-regression.ts`（新增）
- `scripts/t08-writeup-pdf.mjs`（新增）

文档：

- `README.md`
- `docs/HANDOFF.md`
- `docs/DELIVERY_VALIDATION.md`
- `docs/MASTER_PLAN.md`
- `docs/IMPLEMENTATION.md`（审计/覆盖元数据约定）
- `docs/submission/WRITEUP.md`
- `docs/submission/POST.md`
- `docs/submission/DEMO_SCRIPT.md`
- `docs/submission/CHECKLIST.md`

## 剩余问题与下一步

1. Codex 独立复验：重点检查真实界面打开旧 run、干净进程配置、三类审计、负例判定、文稿事实。T08 自测通过不等于独立验收通过。
2. 人工视觉复核仍未完成：`visual_review` 保持 `not_reviewed`；需要玉米或独立人员查看物理、材料、数学重建。
3. 一页 PDF 需人工看一遍打印效果；程序化结果是 1 页、977/1020px。
4. 视频未录制；录制方式和是否安装工具需玉米决定。录制时必须保留失败运行和 run ID，回放要标注“回放”。
5. 比赛提交入口、账号、标签和视频时长上限仍需在官方 Slack/当届页面核实（旧页面与当届 Agenda 冲突）。
6. push、部署、发帖、提交仍需玉米明确授权；本轮没有执行这些动作。

## 证据边界

- 所有 T08 新产物使用 `T08-` 前缀；第一版 stub 证据保留，未被 v2 覆盖。
- 私有运行与 JSONL 位于 `runs/`，不进 git、不进入可分享 artifacts 的完整模型内容。
- 没有新的真实模型调用，因此本批不增加模型成功率样本，也不改变 8/12。
