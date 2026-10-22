# Delivery validation · 2026-10-22

T21（2026-10-23）访客交互增量：移除连接语法编辑器、0/N覆盖计数，多行普通语言输入；A/B摘要和引用优先，技术覆盖折叠，待核验/重建警告保留。最终受控浏览器17/17（含新旧报告回放/手机极小图关闭），旧结构化报告兼容6/6，真实公网iframe新表单检查通过，无新图提交或模型调用。模型协议/原8/12不变。worker空闲更新，接单恢复，Sites父页v7不改。证据T21-*，详情见`handoffs/T21-visitor-flow.md`。

T20当前增量：22文件143测试、typecheck/lint/build通过；独立A/B角色prompt reader-0.2.4，renderer-0.2.3去摘要、避让/分车道，evidence-0.3.1显式连接检查与重复边分离。受控访客UI6/6、本机浏览器19/19、已发布v7公网iframe检查通过。1次同图开发live完成123秒，A/B摘要不同，但模型仍存在箭头误读、facts为空、新重建1项unsupported；不代表准确率提高，也不改固定协议8/12。原私有A的离线重建旧6警告降0只证明特定几何修复，不是所有输入均无警告。新证据及限制见 `handoffs/T20-acceptance-fixes.md` 和 `T20-*.json`。下文为历史阶段记录。

T16增量（2026-10-22）：机主历史全量搜索/分页、9041工作台入口、访客origin内IndexedDB历史已部署至稳定站v4（version `appgver_132cff8c1f308191955a4fe9af33b429`）。全量owner history API/UI搜索并打开真实完成run 7/7；访客桥接回放10/10。综合访客浏览器测试在已发布站点进行，12/12通过：用真实run报告驱动UI，stub worker模拟2次HTTP 502后恢复，验证只POST一次、IndexedDB保存、搜索、刷新、断开worker后离线打开、删除、原图/文件名排除及能力ID清理，见`T16-visitor-history-resilience-v2.json`及两张截图。该测试使用真实production page与真实报告数据，但worker流量被stub拦截；没有真实模型调用或隧道请求，不作为实际公网传输证明。真实访客公网材料图只提交一次，run `1792674795248-f18f993e`完成，不计入固定协议8/12；live证据记录13次HTTP 502且没有保存记录ID，旧选择器也不兼容CSS Modules，因此worker到IndexedDB的真实闭环尚未由真实请求验收，失败证据`T16-visitor-history-e2e-v4.json`保留。新增有限状态GET重试的独立测试5/5通过，见`T16-poll-retry-smoke-v2.json`。本轮typecheck、lint、19个测试文件/125项（`--maxWorkers=4`）、生产构建全部通过；首次默认并行全测有一项5秒超时，降并行后通过。发现并重启了引用旧Next构建、静态chunk返回500的本机网页进程；此前无活动任务，重启后owner UI检查通过。最后一次隧道检查为online、frameable、accepting；地址可能轮换。访客历史仅当前浏览器本地存储，不提供服务端同步。

T15增量（最新）：124项/19测试文件、typecheck/lint/build通过；18项最终浏览器检查通过，真实A/B记录与裁判建议分离，实际引用/图差异/覆盖/手机弹窗均验证。固定两例开发运行完成（用户图104秒、公开材料30秒），reader-0.2.3 / renderer-0.2.2 / evidence-0.3.0；用户图仍有箭头读错，新策略不再将其5/5确认保留，保留裁判原建议和证据，5项待核验，A/B图比较少2多1，渲染6警告。公开材料4项也待核验，不将一致性等同正确。证据T15-live-v1.json及T15-browser-final.json；不更改旧8/12或原用户报告。此前浏览器v1是标题定位不一致的脚本失败，已保留，不当产品通过。自由文本蕴含验证和可靠读图未解决，不能用工程测试代替模型能力。详见T15交接。

T14增量：固定网页接入受限本机分析服务。正式流水线通过HTTPS接受一张公开材料图并完成；首次浏览器GET发生ECONNRESET，同任务恢复领取报告/重建，未重新提交或重跑，T14-live-first-recovered.json保留限制。显存峰值6627MiB，GPU外部观察96%、采样窗口75%；最低空闲RAM289MiB与开发构建重叠，不作隔离基准或日常流畅保证。暂停/恢复真实操作通过，空闲显存恢复约12MiB。免费临时隧道实际自动轮换，独立service-status公告分支和原网页发现当前地址；不能承诺SLA。最终validate 16文件104项、lint/typecheck/build通过；HTTP边界4项、队列6项均计入总数。新证据不混入旧8/12。用户选择手动启动，不添加系统启动项。T14首次完整浏览器验收因轮换过期域名中断，v2发现Close文本不一致与favicon404，失败证据均保留；最终状态见T14交接和后续v3证据。

T13增量（最新）：公开案例站 https://figure-relay.chicchair5.chatgpt.site 已成功部署。`T13-public-online.json`外网Edge13/13、无console/page错误；静态v3本地13/13，早期失败保留。图片关闭/手机交互和作者预期信息的首页目标已修。最终`npm run validate`：14文件94测试、typecheck/lint/build通过。首次沙箱构建EPERM，同命令完整复验通过。Python relay6项通过；HF候选入口只做语法检查。首次新relay真实本地测试A阶段失败，见`T13-local-relay-live.json`，不混入旧8/12。HF创建被PRO限制拒绝，用户截图确认Gradio/Docker均为Paid，线上新图推理未接通。发布版本、失败和待办见`handoffs/T13-publication.md`。

T12增量（最新）：重整首页/工作台，新增不依赖私有runs的4个真实案例白名单回放（含失败），完整披露12次固定协议。最终 `npm run validate`：13 files / 90 tests，typecheck/lint/build通过；`T12-public-final-browser.json` 15/15、`T12-local-browser-v1.json` 19/19、`T12-history-browser-v1.json` 24/24、`T12-final-visual.json` 3/3（图片无裁边、390px首页无横溢）。初版静态包曾缺favicon产生404，失败记录 `T12-public-browser-v1.json` 保留，最终包已补齐图标且无console/page错误。公开v2投影不声称作者确认；旧run/统计/检查点未改。只读包已经构建和验收，但尚未部署；免费在线新图推理仍未实现。

T11 增量（最新）：完整源码已获授权推送至公开仓库 main；修复忽略规则导致运行 API 漏提交的问题，新增不改写历史结论的报告复核导读。最终 `npm run validate`：12 files / 84 tests、lint/typecheck/build 通过；浏览器20/20、最终生产回放与展开手机布局4/4、真实数学离线回归11/11、真实记录临时副本导读4/4。新证据为 `T11-review-browser-console.json`、`T11-final-review.json`、`T11-scientific-regression.json`、`T11-real-review.json`。一页说明仅更新仓库已公开状态，新 PDF 与源哈希见 `T11-public-writeup-writeup-one-page.json`；其中75项工程测试数字描述此前T10验证，当前完整结果为84项。以下历史实测及固定协议8/12均保留，不混入新的离线/脚本检查。

状态：可运行候选版，含真实本地视觉模型闭环证据。物理、材料、数学（单图）各有一张真实论文图完成 A→重建→B；数学多面板网络图在固定协议下无法被本地读者完整提取，作为失败结果保留。教学脚本结果不计入模型能力。2026-10-22 的 T08 修复补齐了历史回放入口、默认配置一致性、逐请求审计、检测覆盖与科学负例，以及一页说明的 PDF 排版检查；T09 修复了语义结果覆盖科学规则、A/B 双侧面板歧义、过宽阈值容差与 partial usage 完整性四个边界；T10 修复了小量级阈值被固定 epsilon 吞掉、B-only 面板/系列漏报，并让证据生成脚本默认拒绝覆盖。旧运行、旧统计和旧检查点均未覆盖。

## 环境与模型

- 应用：Next.js 16.4.2，生产构建；`npm run validate` 见下文。
- 推理：Ollama 0.40.6，`http://127.0.0.1:11434/v1`，chat 协议，零 API 费用。
- 固定协议模型：`qwen3-vl:4b-instruct-16k`（Ollama 本地派生模型，`num_ctx=16384`），`RFE_MAX_OUTPUT_TOKENS=10000`。
- 对照配置：`qwen3-vl:4b-instruct-32k` / 14000 输出在 8GB 显存上溢出到 CPU（8.4GB、33% CPU），单次运行明显变慢，未继续；`qwen3-vl:8b-instruct-16k` 仅 1 次物理图抽查，第二次尝试三次超时，未作为协议模型。
- 提示词 `reader-0.2.2`，schema `0.2.0`，renderer `0.2.1`，引擎摘要见各运行记录。
- 图片由 Sharp 完整解码并重新编码为 PNG，不做缩放；A 仅接收原图像素，B 仅接收重建 PNG。

## 固定协议

每张已发布图独立运行 3 次：Reader A → 确定性 SVG/PNG 重建 → Reader B → 语义检查；完成的运行另加 1 次隔离的直接检查基线（原图 + 运行记录中标记确认的检查点）。全部结果保存，不重跑替换失败，不挑选成功样本。表中检查点由项目整理，并由协议脚本在运行记录中自动标记为 confirmed；未找到独立的人工逐项确认记录，因此不表述为作者或玉米已逐项确认，也不冒充作者原始意图。T08 新增的科学检查点单独标注为项目整理且未经玉米逐项确认，只用于离线回归，不改变本表 8/12 和 4/4。

| 图 | 学科 | 3 次完成 | Reader A 保留 | Reader B 保留 | 失败原因 |
|---|---|---|---|---|---|
| Nonlinear mechanical system | 物理 | 2/3 | 4/4（两次完成均如此） | 4/4 | 1 次 `incomplete`：输出超过 10000 token 上限 |
| Lattice topology to porous structure | 材料 | 3/3 | 4/4（每次） | 4/4 | — |
| Metric value and p-value vs rewiring | 数学 | 3/3 | 4/4（每次） | 4/4 | — |
| Network permutations and matrix analysis | 数学（holdout） | 0/3 | — | — | 3 次均在 Reader A `incomplete`：输出超过上限 |

总计 8/12 次完成。完成运行的耗时：物理 157–184 秒，材料 30–36 秒，数学 metric 57–73 秒；失败运行在 154–298 秒内显式停止。8 个完成主链路运行各有 1 次直接检查基线，约 7–10 秒；4 个 Reader A 失败运行没有执行基线。

完整逐次记录见 `artifacts/validation/protocol-p022-4b16k10.json`，单次证据见 `p022-4b16k10-<figure>-attemptN.json`。

## 提示词迭代（有边界的实测）

同一 4B instruct 模型、同一组图，只改 reader 提示词：

| 提示词 | 物理 | 材料 | 数学（metric） | 结论 |
|---|---|---|---|---|
| reader-0.2.0 | 3/3 完成，4/4 | 3/3 完成，4/4 | 0/3（Reader A `no_readable_content`） | 数学图稳定失败 |
| reader-0.2.1（加强“可读即完整”） | 3/3 完成 | 0/3（空完整记录） | 3/3 完成，4/4 | 材料回归，已回退 |
| reader-0.2.2（澄清 `unsupported` 只指图像不可读） | 2/3 完成，4/4 | 3/3 完成，4/4 | 3/3 完成，4/4 | 两个域恢复；物理出现 1 次输出截断 |

0.2.1 与 0.2.2 的差异不是评分口径，而是模型把 `completeness=unsupported` 误当作“图中的统计结论不成立”。0.2.2 只澄清字段语义，不放松完整性门槛。

## 重建的人工查看（助手级检查，不是人工验收）

应用内的 `visual_review` 仍为 `not_reviewed`。以下为助手对真实重建 PNG 的检查，不能替代作者或独立人工复核：

- 物理（4B，0.2.2）：14 个节点、15 条关系被重画，出现 4 个同名 `Ground` 节点；曲线、坐标轴与单位可读。`m₂→k₂→k₃` 之类链式连接与原图拓扑不一致，版式也不同；但 4 条检查点所断言的连接与标签仍可核对。
- 物理（8B 抽查）：更干净（单一 `ground`，9 条关系），但漏掉 `d sin(ωt)` 激励标签，导致 k3 在 A/B 均判 omitted；曲线可读。
- 材料（4B，0.2.2）：重建为三个带标签的方框与箭头，原图的晶格/孔隙几何完全丢失；检查点只断言标签与顺序，因此仍全部 retained。这是“检查点保留 ≠ 图像保真”的直接例子。
- 数学（metric，4B，0.2.2）：两面板、坐标轴、图例可读；原图的置信带（阴影）在 schema 中没有对应字段，重建只保留折线，而 A 的摘要仍提到阴影区域，形成“记忆提到、重建画不出”的缺口。A 把 `alpha=0.05` 采样为 `(0,0)→(3,0)`，B 再读为 `(0,1)→(3,0)`，而源图参考线约 0.05、重建实际画的是 y=0；旧检查点按标签仍判 k4 retained。T08 新增的项目整理阈值/恒定性检查在 A 上判 retained（0 与 0.05 的差在 0.05 容差内），在 B 上判 contradicted。T09 指出该 0.05 容差等于 100% 相对误差，已用源图刻度冻结 `value_tolerance=0.005`、`flatness_tolerance=0.002` 的 T09 检查点替代：真实 A/B 均判 `contradicted`。T08 检查点与回归 JSON 保留作历史证据，但不再作为当前口径。两者都只是规则级证据，必须人工复核。

这些损失记录在报告中，不修改模型原始记忆。

## 直接检查基线（隔离请求）

- 物理：4 条检查点中 3 条 retained；k1 被判 contradicted，理由是“k₂ 连接 m₂ 与右侧固定支撑”，但同一段理由又说“m₁ 与 m₂ 通过 k₂ 相连”，与检查点和原图都不一致。该输出属于待人工复核的基线错误，未回流主链路。
- 材料：4/4 retained，理由引用 A/B/C 标签与箭头顺序。
- 基线不参与 A→B 评分，也不作为真值；它用于说明“直接看原图 + 检查点”同样是模型判断。

## T08 验收修复证据（2026-10-22）

旧运行、旧快照、旧检查点与 `protocol-p022-4b16k10.json` 均未覆盖；以下产物使用 T08 独立命名。例外：受控审计汇总 `T08-audit-stub-v2.json` 在 T09 期间被同一脚本重跑覆盖，详见下节披露。没有启动新的完整 4×3 实时协议，没有付费调用。

| 项 | 结果 | 证据 |
|---|---|---|
| 历史回放与深链接 | 22/22 通过：列表、LIVE 筛选、真实运行、失败运行、不存在 ID、390px 布局、导出 JSON，且仅有故意请求不存在 ID 产生的 1 条预期 404 控制台记录 | `artifacts/validation/T08-history-browser.json`、`T08-history-*.png` |
| 旧运行向后兼容 | 缺少 `matched_plots` 的受控 run 仍可打开；界面无 `undefined`，Markdown 回退为 `matched plots: 0`；未执行项明确标为 NOT EXECUTED | `artifacts/validation/T08-legacy-coverage.json`、`T08-legacy-coverage.png` |
| 默认配置一致 | 无环境变量时 `/api/status` 报告 `qwen3-vl:4b-instruct-16k`；Modelfile 含 `num_ctx=16384`；默认输出上限 10000 | `tests/config.test.ts`、`README.md` 启动段 |
| 每次模型请求审计 | 受控本地 HTTP stub 两个 run、16/16：主 run 5 次尝试（500→schema 失败→修复成功→B→judge），length run 1 次尝试并显式失败；每次尝试写入 `model-calls.jsonl`；阶段元数据含 `attempts_detail`、`usage_complete`；无密钥/授权头/图像字节落盘。**注意：**该汇总和两个复制 JSONL 已被 T09 期间的同一脚本重跑覆盖，当前 run 为 `1792634397291-60381724`、`1792634398032-6fb24c30`；T08 旧私有 run `1792629726115-43ba30b6`、`1792629726849-ace8a605` 仍在，但原始 T08 汇总 JSON 未保留 | `artifacts/validation/T08-audit-stub-v2.json`、`T08-audit-stub-v2-primary-model-calls.jsonl`、`T08-audit-stub-v2-length-model-calls.jsonl` |
| 检测覆盖与负例 | 冻结 6 个 synthetic 负例（方向反转、条件丢失、阈值变化、轴单位/尺度、系列形状、重复标签歧义）；T09 增加双侧唯一匹配、无 basis/过宽容差、semantic 冲突与 partial usage 回归；该历史快照为 10 个测试文件 64 项通过（T10 当前为 11/75） | `data/fixtures/T08-scientific-cases.json`、`T09-scientific-cases.json`、`tests/scientific.test.ts`、`tests/report.test.ts`、`tests/model-audit.test.ts` |
| 真实运行离线回归（T08，历史） | run `1792609657136-e85156a8`：A facts 为空 → 逐项比对标为 NOT EXECUTED；alpha 平坦线在 B 中变为 (0,1)→(3,0)，判 confirmed `series_shape_change`；4 条轴单位字段变化判 confirmed；T08 项目整理检查点 A retained、B contradicted；8/8 检查通过。T09 已用独立容差依据将 A/B 均判 contradicted，见下节；此 T08 结果不再作为当前口径 | `artifacts/validation/T08-scientific-regression.json` |

审计契约是向后兼容的可选扩展：旧运行没有 `attempts_detail`、`usage_complete`、`config_snapshot`、`coverage` 或 `scientific_findings` 时，界面显示 legacy/unavailable，不补写旧记录。名义阶段数是 A/B/judge 三段；含临时重试、首次无效结果和语义修复时，实际 HTTP 请求数更多，报告以 `attempts_detail` 的实际请求为准。`npm run validate` 的实际数字见下表。

## T09 边界修复证据（2026-10-22，历史）

T09 只处理 Codex 复验的 F1–F4 与覆盖说明。没有重做 R01/R02/R05，没有启动新的 4×3 真实模型实验，没有修改旧运行或把新结果冒充旧结果。

| 项 | 结果 | 证据 |
|---|---|---|
| F1 科学规则优先于 semantic | 规则 `contradicted` 不会被 semantic `retained` 覆盖；规则 `uncertain` 不会被变成确认；普通反向断言同样优先 | `tests/scientific.test.ts`、`T09-boundary-probes.json` 的 F1a/F1b |
| F2 双侧唯一匹配 | A 重名、B 重名、双侧重名均 `matched_plots=0`、`matched_series=0`，无 confirmed 形状差异；未匹配项进入 coverage | `tests/scientific.test.ts`、`tests/report.test.ts`、`T09-boundary-probes.json` 的 F2a–F2c |
| F3 阈值容差 | 真实 A y=0 与 B `(0,1)→(3,0)` 均判 `contradicted`；无 basis、`value_tolerance >= expected`、`flatness_tolerance >= span` 均判 `uncertain` | `data/fixtures/T09-scientific-cases.json`、`T09-scientific-regression.json` 11/11、`T09-boundary-probes.json` 的 F3a–F3d |
| F4 usage 完整性 | 仅 `prompt_tokens` 或仅 `total_tokens` 均 `usage_complete=false`，不补零；输入+输出为 true | `tests/model-audit.test.ts`、`T09-boundary-probes.json` 的 F4a–F4c |
| 覆盖说明 | 轴检查与系列检查分开；显式列出几何/相对位置、置信带、未匹配 A/B 面板与系列 | 界面、Markdown、JSON coverage；`tests/report.test.ts` |

验证结果：

```text
npm run validate
- tsc --noEmit：通过
- eslint：0 error / 0 warning
- vitest：10 files / 64 tests passed
- next build：生产构建成功

npx tsx scripts/t08-scientific-regression.ts
pass: true；11/11 checks（真实数学 run 1792609657136-e85156a8，离线）

npx tsx scripts/t09-boundary-probes.ts
pass: true；12/12 checks（F1–F4，离线/内存 HTTP stub）

node scripts/t09-legacy-coverage.mjs
7/7；旧 run 无 undefined，Plot-axis / Series-shape 均 NOT EXECUTED
```

T09 的 12 项探针覆盖四个复验反例：带 semantic 的真实 `evaluate` 分支、A/B 双侧重名、0 对 0.05 阈值、partial usage；全部不需要真实模型。T09 回归输出与被替代的 T08 输出分开命名；T08 fixture、T08 regression JSON、旧运行和 8/12、4/4 统计保持原样。

**过程披露：** 重跑既有 `scripts/t08-audit-stub.ts` 时，其硬编码输出路径覆盖了 T08 的汇总 JSON 和两个复制 JSONL。当前这些文件对应新的受控 run `1792634397291-60381724`、`1792634398032-6fb24c30`；T08 旧私有 run `1792629726115-43ba30b6`、`1792629726849-ace8a605` 仍存在，但原始 T08 汇总 JSON 未保留。不要把当前 T08 文件读作原始 T08 证据。

## T10 边界收尾与证据防覆盖（2026-10-22）

T10 只处理 T09 独立复验留下的 N1、N2 与防覆盖机制。没有重做 R01/R02/R05，没有启动新的完整真实模型实验，没有改写旧运行、旧检查点或旧期望；受控 stub 只验证审计通路，不是模型能力结果。

| 项 | 结果 | 证据 |
|---|---|---|
| N1 小量级阈值 | 期望 `1e-10 A`、容差 `1e-12 A`、实际 y=0 判 `contradicted`；同一物理量的 nA 表示给出一致判定；零参考仍被检查；科学计数法 facts 可检测。固定 `1e-9` 与固定 `1e-12` 绝对补偿已移除，改为随操作数缩放的浮点表示容差 | `src/lib/evaluation/scientific.ts`、`tests/scientific.test.ts`、`T10-boundary-probes.json` N1a–N1c |
| N2 B-only 图形 | A 无 plot、B 有一个面板和系列时，`unmatched_b_plots` 与 `unmatched_b_series` 非空；A-only 与双空行为保持；Markdown 新增 Unmatched B 行 | `tests/scientific.test.ts`、`tests/report.test.ts`、`T10-boundary-probes.json` N2a–N2c |
| 证据防覆盖 | 共享 `scripts/lib/evidence.mjs` 提供 label 校验、目标预检和 `wx` 写入；T08/T09 探针、回归、legacy coverage、一页 PDF，以及 browser smoke、history、API smoke、live browser、protocol、live-run 均默认拒绝覆盖。重跑使用新 `--label`、新 `RFE_WRITEUP_PREFIX`、新 tag 或新 `--out` | `scripts/lib/evidence.mjs`、`tests/evidence-guard.test.ts`；默认重跑实测 exit 1 并列出冲突文件 |

验证结果：

```text
npm run validate
- tsc --noEmit：通过
- eslint：0 error / 0 warning
- vitest：11 files / 75 tests passed
- next build：生产构建成功

npx tsx scripts/t09-boundary-probes.ts --label T10-boundary-probes
pass: true；18/18 checks（F1–F4 + N1/N2）

npx tsx scripts/t08-scientific-regression.ts --label T10-scientific-regression
pass: true；11/11 checks（真实数学 run 1792609657136-e85156a8，离线）

npx tsx scripts/t08-audit-stub.ts --label T10-audit-stub
pass: true；16/16 checks；受控 run 1792637451098-5e4ce025、1792637451876-c51c9626

node scripts/browser-smoke.mjs --label T10-browser-smoke
16/16；0 console error、0 page error、0 failed response

node scripts/history-browser.mjs --label T10-history-browser-r2
24/24；仅 1 条故意请求不存在 ID 的预期 404

node scripts/t09-legacy-coverage.mjs --label T10-legacy-coverage-final
7/7；旧 run 无 undefined，Plot-axis / Series-shape 均 NOT EXECUTED

node scripts/smoke-api.mjs --label T10-api-smoke
PASS：12 条 scripted pipeline；published mock inference 被拒绝
```

T10 的 18 项探针新增 N1a–N1c 与 N2a–N2c；全部离线或使用内存 HTTP stub。`T10-boundary-probes.json`、`T10-scientific-regression.json`、`T10-audit-stub.json` 与旧 T08/T09 证据分开命名。浏览器检查使用最终生产构建；旧 `T08-legacy-coverage.mjs` 的合并行断言仍不适用于拆分后的 UI，保留为历史脚本。

**过程披露：** 第一次 T10 历史检查仍假设旧真实 run 在最近 10 条中，数据增长后该假设失效，检查在“filter finds requested real run”处失败；失败产物保留为 `T10-history-browser.json`（及截图）。脚本改为过滤最近的 completed live run，并用全 ID 打开旧 baseline run 后，以新 label `T10-history-browser-r2` 重跑 24/24。新增 WRITEUP 句子曾两次使一页说明达到 1032/1020px，失败 PDF 保留；最终以 10pt/1.35 行高重排为 1 页、998/1020px、41505 bytes。以上均未删除或覆盖旧证据。

## 构建与浏览器

| 检查 | 结果 |
|---|---|
| `npm run validate` | 通过：`eslint` 0 error / 0 warning、`tsc --noEmit` 无错误、11 个测试文件 75 项通过、`next build` 生产构建成功 |
| `node scripts/browser-smoke.mjs --label T10-browser-smoke` | 16/16 通过；桌面选择/确认/两次教学运行/导出/比较/390px 布局 |
| `node scripts/history-browser.mjs --label T10-history-browser-r2` | 24/24 通过；0 unexpected console error（1 条为故意请求不存在 ID 的预期 404） |
| `node scripts/t09-legacy-coverage.mjs --label T10-legacy-coverage-final` | 7/7 通过；旧 coverage 无 `undefined`，拆分后的 Plot-axis / Series-shape 均显示 NOT EXECUTED，Markdown 回退正确。旧 `t08-legacy-coverage.mjs` 的合并行断言已不适用于 T09 UI，保留为历史脚本 |
| 浏览器控制台 | `browser-smoke` 0 console error、0 page error、0 failed response；历史脚本仅 1 条故意请求不存在 ID 的预期 404；`src/app/icon.svg` 已消除 favicon 404 |
| 真实运行浏览器证据 | 通过界面发起真实运行 `1792609657136-e85156a8`（数学 metric）：2 个图像面板、4 行检查点、4 行基线，Live 与独立基线标签可见，全程无控制台错误 |
| `npm audit --omit=dev` | 0 个生产依赖漏洞；开发链仍有已知无补丁的 high |

## 未验证与限制

- 样本量小：每图 3 次、共 4 图，不能据此宣称跨领域泛化或优于直接检查。
- 同模型不同请求不构成统计独立；A、B 共享模型先验。
- 两个模型在实测中 `facts` 数组均为空；检查点证据来自节点、关系与曲线项。T08 起，报告会把“逐项事实比对未执行”和“节点/曲线差异未覆盖”明确写出；空 findings 不再被解释为零变化。旧报告没有 coverage 元数据时显示 legacy 警告。
- 标签级检查点保留不等于科学保真：旧 8/12 与 4/4 统计保持不变；新增规则级科学检查只覆盖显式匹配的 facts 与 plot series，未覆盖无标签节点、无标签边、置信带和精确读数。
- T08/T09/T10 的负例是 synthetic 记忆、保存的真实 run 记忆或内存 HTTP stub，不是新模型能力结果；最多允许的 1 次新完整 live run 与 3 次语义负例调用没有执行，因为现有真实 run 已能提供回归材料，避免把工程测试混入模型成功率。
- T10 的浮点表示容差只吸收数值表示误差，不代替科学容差；真实图中的读数、平滑曲线和未标注面板仍可能超出规则检查边界。
- 数学网络图（holdout）未被完整提取；这不是通过结果，也不被筛选掉。
- 8B 在本机 8GB VRAM / 16GB RAM 上部分层跑在 CPU，单次调用可超过 5 分钟并使适配器超时；因此不作为固定协议模型。
- 发布、部署、`git push`、比赛提交均未执行，需玉米明确授权。

## 证据索引

- `artifacts/validation/protocol-p022-4b16k10.json`：固定协议汇总（最终配置）。
- `artifacts/validation/p022-4b16k10-<figure>-attemptN.json`：每次运行的状态、耗时、阶段、检查点、基线与错误。
- `artifacts/validation/p022-4b32k-*`：32k/14000 配置的尝试（因溢出到 CPU、过慢而未继续），保留作对照。
- `artifacts/validation/p022-4b-*.json`：16k/8000 配置下的失败与成功记录（含输出截断），保留作对照。
- `artifacts/validation/final4b-*.json`、`v021-*.json`：reader-0.2.0 / 0.2.1 的对照实验。
- `artifacts/validation/live-browser-math.json`、`live-browser-math-setup.png`、`live-browser-math-result.png`：真实运行经浏览器界面完成的证据。
- `artifacts/validation/browser-console.json`、`browser-*.png`：16 项界面检查、控制台与截图证据。
- `artifacts/validation/T08-history-browser.json`、`T08-history-*.png`：22 项历史/深链接/移动布局检查。
- `artifacts/validation/T08-legacy-coverage.json`、`T08-legacy-coverage.png`：旧 coverage 兼容性与 Markdown 回退检查。
- `artifacts/validation/T08-writeup-one-page.pdf`、`T08-writeup-one-page.json`、`T08-writeup-preview.png`：T08 一页说明原件（历史）。
- `artifacts/validation/T09-writeup-one-page.pdf`、`T09-writeup-one-page.json`、`T09-writeup-preview.png`：T09 修订后的一页说明、页数/排版测量与预览图。
- `artifacts/validation/T08-audit-stub.json`、`T08-audit-stub-model-calls.jsonl`：第一版受控 stub（仅 schema 修复），保留作对照。
- `artifacts/validation/T08-audit-stub-v2.json`、`T08-audit-stub-v2-primary-model-calls.jsonl`、`T08-audit-stub-v2-length-model-calls.jsonl`：临时 500 重试、schema 修复、length 失败三类受控审计；**当前文件是 T09 期间重跑覆盖版，不是 T08 原始汇总**。
- `artifacts/validation/T08-scientific-regression.json`：T08 真实数学运行离线回归（历史，已被 T09 容差口径取代）。
- `data/fixtures/T08-scientific-cases.json`：冻结的 T08 synthetic 科学负例与项目整理检查点（历史）。
- `data/fixtures/T09-scientific-cases.json`：T09 独立容差依据的冻结检查点。
- `artifacts/validation/T09-scientific-regression.json`：真实数学运行上的 T09 离线科学审计回归（11/11）。
- `artifacts/validation/T09-boundary-probes.json`：F1–F4 的 12 项离线边界探针。
- `artifacts/validation/T09-legacy-coverage.json`、`T09-legacy-coverage.png`：T09 界面下旧 run 的兼容性检查（7/7）。
- `scripts/t09-boundary-probes.ts`、`scripts/t09-legacy-coverage.mjs`：T09 可复跑探针。
- `artifacts/validation/T10-boundary-probes.json`：F1–F4 + N1/N2 的 18 项离线探针。
- `artifacts/validation/T10-scientific-regression.json`：真实数学 run 的当前离线科学审计回归（11/11）。
- `artifacts/validation/T10-audit-stub.json`、`T10-audit-stub-primary-model-calls.jsonl`、`T10-audit-stub-length-model-calls.jsonl`：T10 受控审计（16/16；run `1792637451098-5e4ce025`、`1792637451876-c51c9626`）。
- `artifacts/validation/T10-browser-smoke-console.json`、`T10-browser-smoke-*.png`、`T10-browser-smoke-figure-relay-*.json/.md`：16/16 界面检查与导出。
- `artifacts/validation/T10-history-browser-r2.json`、`T10-history-browser-r2-*.png`：24/24 历史/深链接检查；`T10-history-browser.json` 是数据增长后失败并保留的首跑。
- `artifacts/validation/T10-legacy-coverage-final.json`、`.png`：最终构建上的旧 run 兼容性（7/7）；`T10-legacy-coverage.json/.png` 是同构建前一轮的独立副本。
- `artifacts/validation/T10-api-smoke.json`：12 条 scripted pipeline 与 published mock 拒绝检查。
- `artifacts/validation/T10-final2-writeup-one-page.pdf`、`.json`、`T10-final2-writeup-preview.png`：最终一页说明，1 页、998/1020px、41505 bytes；失败的 `T10-writeup-one-page.pdf` 与 `T10-final-writeup-one-page.pdf` 保留，不覆盖。
- `tests/evidence-guard.test.ts`、`scripts/lib/evidence.mjs`：证据 label 与防覆盖单元/实现。
- `runs/<run-id>/`：原图、A/B 记忆、SVG/PNG、基线、快照；不进 git。

本轮无 .env/密钥/全局安装/系统配置改动，无付费模型请求，无删除、推送或部署。
