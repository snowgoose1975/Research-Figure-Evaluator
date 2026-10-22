# T09 边界修复交接 · 2026-10-22

状态：F1–F4 与覆盖说明已按 [T08 独立复验](../ACCEPTANCE_T08_REVIEW.md) 的边界修完，等待 Codex 独立复验。本文只记录本轮实际改动、预期/实际结果、新证据和未完成项。

范围遵守：未重做 R01/R02/R05；未启动新的 4×3 真实模型实验；未修改旧运行、旧统计 `8/12`、标签级 `4/4` 或 `protocol-p022-4b16k10.json`；未删除文件；未修改 `.env`/密钥/CI；未安装全局依赖；未 push、部署、发布或提交比赛。新增 T09 证据使用独立命名。

## 总览

| 项 | 预期 | 实际 | 结果 |
|---|---|---|---|
| F1 live 分支与科学规则冲突 | 规则 `contradicted` 不被 semantic `retained` 覆盖；规则 `uncertain` 不被变成确认 | 两者均保持规则结果，理由注明 semantic 未采用 | 通过 |
| F2 双侧面板匹配 | A/B 任一侧重复 key 时不得计为唯一匹配，不得产生 confirmed | A 重名、B 重名、双侧重名均为 `matched_plots=0`、`matched_series=0`、无 confirmed 形状差异 | 通过 |
| F3 阈值容差 | 0.05 的检查不能把 y=0 判为 retained；容差须有独立冻结依据 | 真实 A/B 均 `contradicted`；旧检查点与过宽容差均 `uncertain` | 通过 |
| F4 用量完整性 | 只有输入或只有 total 时 `usage_complete=false`，未知值不填 0 | 仅 `prompt_tokens`、仅 `total_tokens` 均为 false；输入+输出为 true | 通过 |
| 覆盖说明 | 轴检查与系列检查分开；列出几何/相对位置、置信带、未匹配 A/B 面板与系列 | 界面、Markdown、JSON coverage 均显示 | 通过 |

## F1：live 分支绕过科学规则

问题位置：`src/lib/evaluation/index.ts`。原 `evaluate` 在收到 semantic 时直接调用 `auditedJudgment`，没有先走 `judgeByRules`，所以 `keypoint.scientific` 的确定性检查只在无 semantic 的离线路径生效。

改动：

- 新增 `resolveJudgment(keypoint, memory, semantic?)`，A/B 两侧统一使用。
- `keypoint.scientific` 存在时，规则结果优先：
  - semantic 与规则同状态：返回带完整规则的判断；
  - semantic 不同：保留规则状态，并在 rationale 明示「semantic 报告了 X，但未采用，因为项目整理的确定性检查优先」。
- 普通关键点若规则已判 `contradicted`，semantic `retained` 也不能抹掉明确的反向抽取断言；只允许语义结果解决 `omitted`/`uncertain`。
- 当存在 scientific 关键点且传入 semantic 时，limitations 增加「Project-curated scientific checks are deterministic and are not overridden by semantic-judge results.」
- 没有伪造 `author_confirmed`：科学检查仍为 `method: "rule"`、`review_required: true`，rationale 明示 not author-confirmed。

预期/实际：

| 反例 | 预期 | 实际 |
|---|---|---|
| 同一数据，规则 B=`contradicted`，semantic B=`retained` | B 仍 `contradicted`，method=`rule` | 通过；rationale 含 precedence 说明 |
| 歧义匹配，规则 B=`uncertain`，semantic B=`retained` | B 仍 `uncertain` | 通过 |
| 普通方向反转，规则 `contradicted`，semantic `retained` | 仍 `contradicted` | 通过 |

回归：`tests/scientific.test.ts` 的三个 `deterministic constraints in the live semantic branch` 用例；`scripts/t09-boundary-probes.ts` 的 F1a/F1b。

## F2：歧义匹配被标为确定

问题位置：`src/lib/evaluation/scientific.ts`。原实现只检查 B 侧候选数，没有检查 A 侧同 key 面板是否唯一，也没有保证一对一。

改动：

- 新增 `group()`，按 `title`（空标题时用轴标签组合）对 A、B 面板分别分组。
- 只有 A 组恰好 1 个、B 组恰好 1 个时才匹配；否则：
  - A 重复：`unmatched_a_plots` 写入 `duplicate panel key in A; no unique correspondence`，A 系列进入 `unmatched_a_series`；
  - B 重复/缺失：`unmatched_a_plots` 明示 `duplicate panel key in B` 或 `no B panel match`；
  - B 中未匹配面板进入 `unmatched_b_plots`，其系列进入 `unmatched_b_series`。
- `matched_plots` 只统计唯一一对一面板；`matched_series` 只在唯一匹配面板内、系列标签唯一且至少两个点时增加。
- 重复系列标签仍产生 `uncertain`，不产生 confirmed；两侧重复时不进入轴/系列审计。
- coverage 新增 `axis_executed`、`series_executed` 与上述 unmatched 字段；`unchecked` 明确加入 `Geometry and relative position`、`Confidence bands and shaded ranges`，并在未执行时加入轴向/系列项和未匹配面板说明。

预期/实际：

| 反例 | 预期 | 实际 |
|---|---|---|
| A 有两个同名面板，B 一个 | `matched_plots=0`、`matched_series=0`，无 confirmed 形状差异，A 面板列入 unmatched | 通过（`Panel b (duplicate panel key in A; no unique correspondence)`） |
| A 一个，B 两个同名 | 同上，A 面板列入 unmatched，B 面板列入 unmatched B | 通过 |
| A、B 都重复 | 两侧都不匹配，无 confirmed，A/B unmatched 均列出 | 通过 |

回归：`tests/scientific.test.ts` 的三侧重名用例；`tests/report.test.ts` 的重复 A 面板 Markdown 用例；T09 probe F2a–F2c。

## F3：阈值容差过宽

问题位置：`data/fixtures/T08-scientific-cases.json` 与 `src/lib/evaluation/scientific.ts`。原检查点 `expected_y=0.05`、`value_tolerance=0.05`，y=0 与期望相差 100% 仍被判 retained；此外 `precisionTolerance` 从 JavaScript 数字字符串猜精度（整数默认 0.5），不是视觉误差依据。

改动：

- 删除 `precisionTolerance` 的字符串猜精度逻辑。fact 数值比较改用 `numericEqualityTolerance`，明确是数值表示相等容差，不是视觉精度。
- 系列平坦性固定为「该面板 y 轴跨度的 1%」（`PLOT_FLATNESS_FRACTION = 0.01`），并分别在 A/B 面板上计算。
- `judgeScientific` 增加三道门槛：
  1. 必须有 `tolerance_basis`（独立于 A/B 观测、在审计前冻结的依据）；缺失则 `uncertain`；
  2. `value_tolerance >= |expected_y|` 且 expected 非零时，零与期望水平不可区分，判 `uncertain`；
  3. `flatness_tolerance >= y 轴跨度` 时，平坦性不可区分，判 `uncertain`。
- 阈值正确性与水平性分开判断：先看 `range > flatness_tolerance`，再看所有采样点是否都偏离 `expected_y ± value_tolerance`；分别返回 `contradicted` 或 `partial`。
- 新增 `data/fixtures/T09-scientific-cases.json`（`T09-scientific-v2`，`supersedes: T08-scientific-v1`）：
  - `expected_y=0.05`；
  - `value_tolerance=0.005`（参考值的 10%）；
  - `flatness_tolerance=0.002`（0–1 轴跨度的 0.2%）；
  - `tolerance_basis` 明确来自源图刻度间距，且在审计前冻结；
  - `author_confirmed: false`、`source: "project_curated"`、`review_required: true`。
- T08 fixture 与 T08 regression JSON 保留不改；T09 回归输出独立命名。

预期/实际（真实数学 run `1792609657136-e85156a8`，不调用模型）：

| 反例 | 预期 | 实际 |
|---|---|---|
| 真实 A 把 `alpha=0.05` 采成 y=0 | `contradicted`，issue `value` | `contradicted`，issue `value` |
| 真实 B 记录 `(0,1)→(3,0)` | `contradicted` | `contradicted`，issue `value` |
| 旧检查点无 `tolerance_basis` | `uncertain` | `uncertain`，理由含 no independent tolerance basis |
| 把 T09 的 value tolerance 改回 0.05 | `uncertain`，不能确认保留 | `uncertain`，理由含 zero and expected level cannot be distinguished |
| T09 合成 A | `retained`（0.05 水平、平坦） | `retained` |
| T09 合成 B | `contradicted` | `contradicted` |

回归：`tests/scientific.test.ts` 的 project-curated 与 wide-tolerance 用例；`scripts/t08-scientific-regression.ts`（读取 T09 fixture，输出 `T09-scientific-regression.json`）**11/11**；T09 probe F3a–F3d。

## F4：用量完整性误标

问题位置：`src/lib/model/index.ts`。原 `aggregateMeta` 只在整份 `usage=null` 时标记不完整；`{prompt_tokens: 7}` 仍得到 `usage_complete=true`。

改动：

- 新增 `usageComplete()`：必须同时有 `prompt_tokens` + `completion_tokens`，或同时有 `input_tokens` + `output_tokens`；只有 total、只有输入、空对象、缺字段均为 false。
- `aggregateMeta` 对每次 attempt 检查；任一不完整则整阶段 `usage_complete=false`。
- 仍只累加已知字段；缺失字段不补 0。
- `combineModelMetas` 的 fallback 使用同一规则（优先 `meta.usage_complete ?? usageComplete(meta.usage)`）。

预期/实际（真实 `readOriginal` + 内存 HTTP stub，无网络、无密钥）：

| usage | 预期 complete | 实际 complete | usage 保留 |
|---|---|---|---|
| `{prompt_tokens: 7}` | false | false | `{prompt_tokens: 7}` |
| `{total_tokens: 12}` | false | false | `{total_tokens: 12}` |
| `{prompt_tokens: 7, completion_tokens: 3}` | true | true | 原样 |
| 无 usage | false | false | null |

回归：`tests/model-audit.test.ts` 新增 input-only、total-only 用例；T09 probe F4a–F4c。

## 覆盖说明

`EvaluationCoverage.plot_audit` 的可选扩展：

- `axis_executed`：是否执行面板轴单位/尺度检查；
- `series_executed`：是否执行系列形状检查；
- `unmatched_a_plots`、`unmatched_a_series`；
- `unmatched_b_plots`、`unmatched_b_series`；
- 旧 `matched_plots` 保留，缺省时报告用 `matched_series` 作为 legacy 回退。

`unchecked` 现在明确包括：

- `Geometry and relative position`
- `Confidence bands and shaded ranges`
- 未执行时的 `Axis units and scales`、`Series shapes`
- 有未匹配/歧义面板时的 `Axis and series checks for unmatched or ambiguous panels`

报告 Markdown 与界面把原来的合并行拆为：

- `Plot-axis audit: executed / NOT EXECUTED`
- `Series-shape audit: executed / NOT EXECUTED`

并列出 unmatched A/B 面板与 B 系列。T08 旧报告缺 `axis_executed`/`series_executed` 时按 `executed` 或 `matched_series > 0` 回退；不把「面板轴检查执行过」表述为「所有系列都检查过」。

## 验证命令与结果

```text
npm run typecheck
通过（tsc --noEmit 无输出）

npm run lint
通过（eslint 0 error / 0 warning）

npm test
10 files / 64 tests passed

npm run build
生产构建成功（Next.js 16.4.2，webpack）

npx tsx scripts/t08-scientific-regression.ts
pass: true；11/11 checks
evidence: artifacts/validation/T09-scientific-regression.json

npx tsx scripts/t09-boundary-probes.ts
pass: true；12/12 checks
evidence: artifacts/validation/T09-boundary-probes.json

npx tsx scripts/t08-audit-stub.ts
pass: true；16/16 checks
（注意下方“旧证据被覆盖”说明）

2026-10-22 10:09 最终快照（文档修改后、提交复验前重跑）：
npm run validate
通过：typecheck 无输出；eslint 0 error / 0 warning；10 files / 64 tests；生产构建成功
```

浏览器回归（新生产构建，`http://127.0.0.1:3000`）：

```text
node scripts/browser-smoke.mjs
16/16；0 console error、0 page error、0 failed response
evidence: artifacts/validation/browser-console.json

node scripts/history-browser.mjs
22/22；仅 1 条故意请求不存在 ID 的预期 404，unexpectedConsoleErrors=[]
evidence: artifacts/validation/T08-history-browser.json

node scripts/t09-legacy-coverage.mjs
7/7；旧 run 仍可打开，无 undefined，Plot-axis / Series-shape 均明确 NOT EXECUTED
evidence: artifacts/validation/T09-legacy-coverage.json、T09-legacy-coverage.png

最终重建后重跑 node scripts/t09-legacy-coverage.mjs
7/7；consoleErrors=[]

node scripts/smoke-api.mjs
PASS：12 条 scripted pipeline；published mock inference 被拒绝
```

## 新证据

- `artifacts/validation/T09-scientific-regression.json`：真实数学 run 的离线规则回归，11/11；记录真实 A/B 均 contradicted、T09 tolerance basis、coverage 分离与 alpha 形状差异。
- `artifacts/validation/T09-boundary-probes.json`：F1–F4 的 12 项独立探针；含 4 个核心反例（semantic retained 冲突、双侧重名、0 对 0.05、partial usage），全部 pass。
- `artifacts/validation/T09-legacy-coverage.json`、`.png`：新 UI 下的旧 run 兼容性，7/7。
- `artifacts/validation/T09-writeup-one-page.pdf/.json`、`T09-writeup-preview.png`：修订后的一页说明；Edge 实测 1 页、内容 1014/1020px、41219 bytes，源 SHA-256 记录在 JSON。
- 测试文件：`tests/scientific.test.ts`、`tests/report.test.ts`、`tests/model-audit.test.ts`。

## 旧证据与过程问题（必须披露）

1. **T08 audit 汇总被重新生成覆盖。** 为确认改动后审计仍通过，执行了已有的 `npx tsx scripts/t08-audit-stub.ts`。该脚本把输出硬编码到 `artifacts/validation/T08-audit-stub-v2.json` 及两个 `T08-audit-stub-v2-*.jsonl`，因此覆盖了 T08 原始汇总与复制出的 JSONL。当前文件中的 run 为 `1792634397291-60381724` 与 `1792634398032-6fb24c30`，不是 T08 原始的 `1792629726115-43ba30b6` 与 `1792629726849-ace8a605`。
   - 两个旧私有 run 目录仍存在，旧 `runs/<id>/model-calls.jsonl` 未被删除。
   - 原始 T08 汇总 JSON 与两个复制 JSONL 未被保留；不能把它当作原始 T08 证据。
   - 这是本轮的过程错误；没有用新结果冒充旧结果。当前 T08 文件只能读作“在改动后重新执行的同脚本结果”。
2. T08 fixture、`T08-scientific-regression.json`、旧运行和 8/12、4/4 统计均未改。T09 fixture 用 `supersedes` 记录替代关系，并保留修订理由。
3. `scripts/t08-legacy-coverage.mjs` 仍保留旧断言（合并的 `Plot-axis & series-shape audit`）。T09 UI 拆行后，该旧脚本不再适用于当前构建；未修改它以免再次覆盖 T08 证据。新增 `scripts/t09-legacy-coverage.mjs` 作为当前证据。

## 改动文件

产品代码：

- `src/lib/evaluation/index.ts`：`resolveJudgment`、科学规则优先、普通规则 contradiction 保护、limitations。
- `src/lib/evaluation/scientific.ts`：双侧唯一匹配、unmatched coverage、1% 平坦性容差、数值相等容差、tolerance basis/过宽容差门槛。
- `src/lib/model/index.ts`：`usageComplete`、严格 partial usage 汇总。
- `src/lib/schemas/index.ts`：可选 `tolerance_basis`、`axis_executed`、`series_executed`、unmatched A/B 字段。
- `src/lib/pipeline/report.ts`、`src/app/page.tsx`：Markdown/界面拆分轴与系列覆盖、列出未匹配项。
- `tests/scientific.test.ts`、`tests/report.test.ts`、`tests/model-audit.test.ts`。
- `data/fixtures/T09-scientific-cases.json`（新增）。
- `scripts/t08-scientific-regression.ts`（改读 T09 fixture、输出独立 T09 证据）。
- `scripts/t09-boundary-probes.ts`（新增）。
- `scripts/t09-legacy-coverage.mjs`（新增）。
- `scripts/t08-writeup-pdf.mjs`（支持 `RFE_WRITEUP_PREFIX`，默认 T09，避免覆盖 T08 PDF）。

## 未完成项

- 全量 `npm run validate` 最终快照已通过（2026-10-22 10:09）：10 文件 64 测试、lint/typecheck 干净、生产构建成功；最终构建上重跑 T09 旧 coverage 7/7、API smoke 12/12。
- 一页 PDF 已在 WRITEUP 更新后重新渲染：1 页、1014/1020px、41219 bytes；旧 T08 PDF 保持不动。
- 人工视觉复核仍未完成，`visual_review` 保持 `not_reviewed`。
- 视频未录制；比赛提交入口、账号、标签和时长仍需玉米在官方页面/Slack 核实。
- push、部署、发帖、比赛提交均未执行，需玉米明确授权。
- 产品层优先级 2–5（真实图修改对照、直接检查 vs 完整往返、文字旁路测试、界面/演示重组、扩样本）不在本轮范围；本轮只修 F1–F4 与覆盖说明。

## 给复验者的最小复现

1. F1：用 T09 检查点和 `neg-series-shape`，调用带 semantic retained 的 `evaluate`，看 B 仍为 `contradicted`、`method=rule`。
2. F2：给 A 或 B 增加同名 panel，调用 `auditScientific`，看 `matched_plots=0`、无 confirmed、unmatched 列表非空。
3. F3：用 T09 检查点跑真实 run `1792609657136-e85156a8` 的 A/B，看两者均 `contradicted`；把 tolerance 改回 0.05，看 `uncertain`。
4. F4：内存 HTTP stub 返回 `{prompt_tokens:7}` 或 `{total_tokens:12}`，看 `usage_complete=false` 且 usage 不被补零。

以上均不需要真实模型调用。
