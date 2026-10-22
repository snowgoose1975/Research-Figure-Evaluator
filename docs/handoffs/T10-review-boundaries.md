# T10 边界收尾与证据防覆盖交接 · 2026-10-22

状态：T09 独立复验留下的 N1、N2 与防覆盖机制已实现并验证，等待 Codex 复核。本文只记录本轮实际改动、预期/实际结果、新证据和未完成项。

范围遵守：只修 N1/N2 与防覆盖；未重做 R01/R02/R05；未启动新的完整 4×3 真实模型实验；未修改旧运行、旧统计 `8/12`、标签级 `4/4`、`protocol-p022-4b16k10.json` 或 T08/T09 检查点；未删除文件；未修改 `.env`/密钥/CI；未安装全局依赖；未 push、部署、发布或提交比赛。新增证据使用 T10 独立命名。

## 总览

| 项 | 预期 | 实际 | 结果 |
|---|---|---|---|
| N1 小量级阈值 | `1e-10 A` 期望、`1e-12 A` 容差时，实际 y=0 必须 `contradicted` | 固定 `1e-9`/`1e-12` 绝对补偿移除，改为随操作数缩放的浮点表示容差；0 与 `1e-10` 不再相等 | 通过 |
| N2 B-only 图形 | A 无 plot、B 有面板/系列时，B 侧 unmatched 列表必须非空 | `auditPlots` 在任一侧有 plot 时执行；`unmatched_b_plots`/`unmatched_b_series` 均列出，Markdown 导出同步 | 通过 |
| 防覆盖 | 生成脚本不得静默覆盖同名证据；默认拒绝，重跑用新名字 | 共享 label/预检/`wx` 写入；T08/T09/T10 探针、回归、coverage、PDF 及 browser/API/live/protocol 脚本均受保护 | 通过 |

## N1：小量级阈值被固定 epsilon 吞掉

问题位置：`src/lib/evaluation/scientific.ts`。旧实现把固定 `1e-9` 加到偏差与范围比较，另有固定 `1e-12` 的零参考保护，导致 `1e-10 A` 与 0 的差被当作表示误差。

改动：

- 删除所有带单位的固定绝对补偿。
- 新增 `floatingPointAllowance(...values)`：以操作数绝对值之和乘 `Number.EPSILON * 8`，只吸收浮点表示误差。
- 偏差比较改为 `|value - expected| > value_tolerance + floatingPointAllowance(value, expected)`。
- 平坦性比较的浮点补偿改为 `floatingPointAllowance(...values)`；科学平坦性仍由显式 `flatness_tolerance` 与面板 y 轴跨度的 1% 判定。
- `numericParts` 的数字正则支持科学计数法，`1e-10` 作为一个数值参与 facts 比较。
- 保留门槛：值容差大于等于非零期望量级、平坦性容差覆盖整个 y 轴跨度、缺少 `tolerance_basis` 时仍返回 `uncertain`。

预期/实际：

| 反例 | 预期 | 实际 |
|---|---|---|
| `1e-10 A`、`1e-12 A` 容差、实际 0 | `contradicted` | `contradicted` |
| 同一量用 nA 表示（0.1 nA / 1e-3 nA 容差） | 判定不变：丢失 `contradicted`、保留 `retained` | 一致 |
| 期望 0、容差 `1e-12` | 零参考仍被检查；非零值可 `contradicted` | 通过 |
| facts 中 `1e-10` 变为 `1e-9` | 小量级科学计数法变化可检测 | 通过 |

回归：`tests/scientific.test.ts` 的 N1 用例；`T10-boundary-probes.json` 的 N1a–N1c。

## N2：B 新增图形漏报

问题位置：`src/lib/evaluation/scientific.ts`。旧 `auditScientific` 只在 A、B 都有 plot 时调用 `auditPlots`，否则用空数组作为 coverage，导致 B-only 面板不进入未匹配列表。

改动：

- `auditPlots` 在 `a.plots.length || b.plots.length` 时执行。
- A-only 继续写入 `unmatched_a_plots`/`unmatched_a_series`。
- B-only 写入 `unmatched_b_plots`/`unmatched_b_series`，每面板与其每个系列都有独立条目。
- 双侧都无 plot 时两套列表保持空，不制造伪差异。
- `unchecked` 在存在未匹配或歧义面板时加入 `Axis and series checks for unmatched or ambiguous panels`。
- Markdown 报告继续输出 `Unmatched B plots:` / `Unmatched B series:`；新增导出回归证明 B-only 内容可见。

预期/实际：

| 反例 | 预期 | 实际 |
|---|---|---|
| A 无 plot、B 一个面板一个系列 | B plots=1、B series=1、A 均为 0 | 通过 |
| A 一个面板系列、B 无 plot | A 列表=1，B 列表=0 | 通过 |
| A、B 都无 plot | 两侧列表均为 0 | 通过 |
| B-only coverage 导出 Markdown | 含 Unmatched B 行 | 通过 |

回归：`tests/scientific.test.ts` 的 A-only/B-only/both-empty 用例；`tests/report.test.ts` 的 B-only 导出用例；`T10-boundary-probes.json` 的 N2a–N2c。

## 防覆盖机制

新增 `scripts/lib/evidence.mjs`：

- `assertEvidenceLabel(label)`：只允许字母数字开头的 `[A-Za-z0-9._-]`，拒绝路径穿越。
- `evidenceLabel(base, argv)`：支持 `--label X` / `--label=X`；默认返回历史 base。
- `evidenceFile(label, suffix)`：统一写入 `artifacts/validation/<label><suffix>`。
- `assertNewEvidence(paths)`：在生成前检查全部目标，任一存在即 exit 1，列出冲突文件并提示换 label。
- `writeNewEvidence(file, contents)`：创建目录后以 `wx` 写入；`EEXIST` 也拒绝覆盖。

接入：

- `scripts/t08-audit-stub.ts`、`t08-scientific-regression.ts`、`t09-boundary-probes.ts`
- `scripts/t08-legacy-coverage.mjs`、`t09-legacy-coverage.mjs`、`t08-writeup-pdf.mjs`
- `scripts/browser-smoke.mjs`、`history-browser.mjs`、`smoke-api.mjs`
- `scripts/live-browser.mjs`、`protocol.mjs`、`live-run.mjs`

默认行为：历史输出名已存在时直接拒绝；重跑用新的 `--label`（或 PDF 的 `RFE_WRITEUP_PREFIX`、live 的 `RFE_LIVE_TAG`/`--out`）。`tests/evidence-guard.test.ts` 覆盖拒绝、合法新 label、路径穿越拒绝与 `wx` 预检。实测重复运行 `browser-smoke.mjs --label T10-browser-smoke` exit 1，并列出四个冲突文件。

## 验证命令与结果

```text
npm run validate
- tsc --noEmit：通过
- eslint：0 error / 0 warning
- vitest：11 files / 75 tests passed
- next build：生产构建成功（Next.js 16.4.2，webpack）

npx tsx scripts/t09-boundary-probes.ts --label T10-boundary-probes
pass: true；18/18 checks

npx tsx scripts/t08-scientific-regression.ts --label T10-scientific-regression
pass: true；11/11 checks

npx tsx scripts/t08-audit-stub.ts --label T10-audit-stub
pass: true；16/16 checks
controlled runs: 1792637451098-5e4ce025、1792637451876-c51c9626
（受控 HTTP stub，不是真实模型能力结果）
```

浏览器与导出（最终生产构建，`http://127.0.0.1:3000`）：

```text
node scripts/browser-smoke.mjs --label T10-browser-smoke
16/16；0 console error、0 page error、0 failed response
evidence: T10-browser-smoke-console.json、T10-browser-smoke-*.png

node scripts/history-browser.mjs --label T10-history-browser-r2
24/24；0 unexpected console error（1 条故意 404）
evidence: T10-history-browser-r2.json、T10-history-browser-r2-*.png

node scripts/t09-legacy-coverage.mjs --label T10-legacy-coverage-final
7/7；旧 run 无 undefined，Plot-axis / Series-shape 均 NOT EXECUTED
evidence: T10-legacy-coverage-final.json、T10-legacy-coverage-final.png

node scripts/smoke-api.mjs --label T10-api-smoke
PASS；12 条 scripted pipeline；published mock inference 被拒绝
evidence: T10-api-smoke.json

node scripts/t08-writeup-pdf.mjs --label T10-final2
1 page；content 998/1020px；41505 bytes；fits=true
evidence: T10-final2-writeup-one-page.pdf、.json、T10-final2-writeup-preview.png
```

## 新证据

- `artifacts/validation/T10-boundary-probes.json`：18 项，F1–F4 + N1a–N1c + N2a–N2c。
- `artifacts/validation/T10-scientific-regression.json`：真实数学 run `1792609657136-e85156a8` 的离线回归，11/11。
- `artifacts/validation/T10-audit-stub.json` 及两个 JSONL：受控 500/schema 修复/length 失败审计，16/16。
- `artifacts/validation/T10-browser-smoke-console.json`、截图与下载的 JSON/Markdown：16/16。
- `artifacts/validation/T10-history-browser-r2.json`、截图：24/24。
- `artifacts/validation/T10-legacy-coverage-final.json`、截图：7/7。
- `artifacts/validation/T10-api-smoke.json`：12 条 mock pipeline + published mock 拒绝。
- `artifacts/validation/T10-final2-writeup-one-page.pdf`、`.json`、预览图：最终一页说明。
- `tests/evidence-guard.test.ts`、`scripts/lib/evidence.mjs`：防覆盖单元/实现。

## 过程披露（不覆盖失败证据）

1. **历史检查首跑失败。** T10 开始时 `history-browser.mjs` 仍假设 run `1792609657136-e85156a8` 在最近 10 条历史中；新增运行后该 run 不在列表，检查在 `filter finds requested real run` 失败。失败结果保留在 `T10-history-browser.json` 和 `T10-history-browser-list.png`。脚本改为：过滤最近的 completed live run 验证 history 筛选，再用全 ID 表单打开旧 baseline run 验证报告与深链接；新 label `T10-history-browser-r2` 通过 24/24。不是产品回归，也不是把失败改成成功。
2. **一页说明两次超高。** 新增 N1/N2 句子后，PDF 两次测得 1032/1020px、2 页；失败文件 `T10-writeup-one-page.pdf`、`T10-final-writeup-one-page.pdf` 保留。最终把正文调整为 10pt / 1.35 行高，`T10-final2` 为 1 页、998/1020px、41505 bytes。
3. **T08 汇总覆盖事件仍有效。** T09 期间重跑旧 `t08-audit-stub.ts` 覆盖了 T08 汇总与复制 JSONL；原始私有 run 仍在，但原始 T08 汇总未保留。T10 的防覆盖机制防止同类事件再次发生，但不恢复已丢失文件，也不把当前 T08 文件冒充原始证据。

## 改动文件

产品代码：

- `src/lib/evaluation/scientific.ts`：N1 浮点容差、N2 单侧 plot 审计。
- `tests/scientific.test.ts`、`tests/report.test.ts`、`tests/evidence-guard.test.ts`。

证据工具与脚本：

- `scripts/lib/evidence.mjs`（新增）。
- `scripts/t08-audit-stub.ts`、`t08-scientific-regression.ts`、`t09-boundary-probes.ts`。
- `scripts/t08-legacy-coverage.mjs`、`t09-legacy-coverage.mjs`、`t08-writeup-pdf.mjs`。
- `scripts/browser-smoke.mjs`、`history-browser.mjs`、`smoke-api.mjs`、`live-browser.mjs`、`protocol.mjs`、`live-run.mjs`。

文档：

- `README.md`、`docs/HANDOFF.md`、`docs/DELIVERY_VALIDATION.md`、`docs/MASTER_PLAN.md`、`docs/submission/WRITEUP.md`、`docs/submission/CHECKLIST.md`。

## 未完成项

- 人工视觉复核仍未完成，`visual_review` 保持 `not_reviewed`。
- 视频未录制；比赛提交入口、账号、标签和时长仍需玉米在官方页面/Slack 核实。
- push、部署、发帖、比赛提交均未执行，需玉米明确授权。
- 产品层优先级 2–5（真实图修改对照、直接检查 vs 完整往返、文字旁路测试、界面/演示重组、扩样本）不在本轮范围；本轮只修 N1/N2 与防覆盖。
- T10 没有新的真实模型调用；固定协议 8/12、4/4 标签保留率和旧失败运行都保持原样。

## 给复验者的最小复现

1. N1：用 T09 检查点把 `expected_y` 改 `1e-10`、`value_tolerance`/`flatness_tolerance` 改 `1e-12`，构造 y=0 的 series，调用 `judgeScientific`，应为 `contradicted`；换算为 nA 后结论不变。
2. N2：对 A 使用 `plots=[]`、B 保留一个面板系列，调用 `auditScientific`，`unmatched_b_plots` 与 `unmatched_b_series` 应非空；导出 Markdown 应含 Unmatched B 行。
3. 防覆盖：运行任一受保护脚本且不换 label，第二次应 exit 1 并列出已有文件；换新 label 后可成功。
4. 全部不需要真实模型调用；受控 stub 只验证管线与审计，不代表模型准确率。
