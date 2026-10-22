# T08 独立复验 · 2026-10-22

结论：R01、R02、R05 通过；R03 的主流程和失败审计通过，但用量完整性有一项边界错误；R04 不通过。工程功能已有实质修复，暂不接受“R01–R05 全部完成”的最终验收结论。

本次不修改产品代码、原运行、旧检查点或 T08 自测证据；未调用真实模型，未推送/发布。新证据使用 Codex-T08 前缀。

## 需要修复的发现

### F1 · P1：live 路径绕过科学规则，离线通过不代表集成通过

位置：`src/lib/evaluation/index.ts:89–90`；`src/lib/pipeline/index.ts` 的 live 分支固定传入 semantic。

`judgeByRules` 内确实先检查 keypoint.scientific，但 evaluate 在收到语义结果时直接调用 auditedJudgment，根本不进入该规则分支。因此语义模型只按标签回答 retained 时，明确的科学规则不会约束最终判断。

独立复现使用冻结的 neg-series-shape fixture 和带 scientific 字段的已确认检查点：直接 judgeScientific 对 B 得到 contradicted；给同一 evaluate 加上合法证据ID的 semantic retained 行，最终 B 变成 retained。未改图片、数值或科学条件。现有科学测试只调用不带 semantic 的 evaluate，没有覆盖真正的 live 分支。

修复门槛：明确并落实 scientific 检查的优先级；semantic 行不能静默覆盖确定性约束。增加带 semantic 的集成回归，包含模型 retained/规则 contradicted、模型 retained/规则 uncertain 两种冲突。确认来源仍要正确标示，不能为执行规则伪造 author_confirmed。

### F2 · P2：面板匹配只检查 B 唯一性，歧义被标为 confirmed

位置：`src/lib/evaluation/scientific.ts:109–114`。

plotKey 优先使用 title。每个 A 面板只检查 B 候选是否恰好1个，没有检查 A 中同 key 的面板是否唯一，也不保证一对一匹配。同名的多个 A 面板可以同时对应一个 B 面板，产生多条 confirmed，并把 matched_plots/matched_series 计成2。

独立复现：向 neg-series-shape 的 A 添加第二个同名面板，使用不同合法局部ID；B 仍只有一个面板。结果为 matched_plots=2、matched_series=2、两条 confirmed 形状变化。这样的对应关系无法唯一确定，违反“标签不唯一时 uncertain”的冻结约定。

修复门槛：对两侧候选共同检查唯一性和一对一性。无法建立对应时标 uncertain/未执行，不能计为确定匹配；缺失/未匹配的面板和系列也应进入覆盖说明。补 A 重名、B 重名、A/B 双重名三个边界。不要用局部ID代替语义匹配。

### F3 · P2：阈值用例以100%相对容差接受零，不能证明阈值保留

位置：`data/fixtures/T08-scientific-cases.json:279`；`src/lib/evaluation/scientific.ts:207–212`。

项目检查点 expected_y=0.05，却设 value_tolerance=0.05。实际 y=0 与期望相差整个阈值，规则仍返回 retained。真实回归因而将已知采错的 A 标为保留，同时测试脚本断言这种结果必须通过。

这不是算术实现与参数不一致，而是验收用例的科学口径过宽：它验证了平坦性变化，没有验证0.05阈值被正确恢复。R04 修复单要求不能用容差把阈值错误忽略。另一个一般化风险是 precisionTolerance 从 JavaScript 数字字符串猜精度，整数默认容差0.5；数值表示不能充当视觉估计误差的依据。

修复门槛：阈值正确性与水平性分开判断。可明确识别的0.05不能把0视为完整保留；若读数分辨率不足，应 uncertain/review。容差必须有独立依据，并先于结果冻结，不能为了维持原 A retained 而选择。保留旧 fixture/回归证据，新增版本记录修订理由；不要改旧8/12和标签级4/4。

### F4 · P2：部分 token usage 被标记为完整

位置：`src/lib/model/index.ts:139–154`，相关测试 `tests/model-audit.test.ts:91`。

aggregateMeta 只在整份 usage=null 时把 usage_complete 设为false。响应只提供 `{prompt_tokens:7}`、没有 completion/total，仍得到 usage_complete=true，界面可把仅输入 token 数当作完整用量。

独立内存 HTTP stub 已复现该结果。500 无 usage 的原自测确实被正确标为不完整，但没有覆盖“usage存在而字段不完整”的边界。

修复门槛：定义清楚完整性的单位，检查 chat/responses 必要的输入/输出字段或其他足以表示完整总量的字段。只累加已知值；缺失的部分标为未知。补 partial usage 测试，不把缺失值补0。

## R04 覆盖说明的补充缺口

`auditScientific.coverage.unchecked` 当前列出未标记节点/边、精确数字化、语义同义等，但没有显式列出几何/相对位置和置信带；其实现并未检查这些内容。执行过面板轴检查也不等于执行过所有系列检查。修复时让实际界面与 Markdown/JSON 精确说明这些范围，避免只有交接文字声明“已明示”。

## 已独立通过的检查

| 项目 | 本次结果与边界 |
|---|---|
| npm run validate | exit 0；类型、lint、10文件54测试、生产构建通过 |
| R01 正常浏览器入口 | Edge 13项独立只读检查通过：最近列表/展开/筛选、真实ID、两张图片实际加载、4行报告/4行基线、深链接刷新、legacy提示、失败阶段、较早保存ID、390px、无未捕获页面异常 |
| R02 | 本地默认 instruct-16k/10000 与 Modelfile 一致，显式覆盖保留，远程不会回退本地模型；PowerShell文档语法已修 |
| R03 主路径 | v2主run的5条JSONL与产物逐行一致，500/schema失败/repair/B/judge均有记录；length失败单独保留；reading_a已知usage和请求耗时合计正确；配置白名单未见密钥 |
| R05 主要事实 | fixed protocol、8次基线/4次未到基线、协议脚本标记与人工确认的区别、两个提示修订均已更正 |
| 一页PDF | WRITEUP源SHA-256与生成记录一致；Poppler直接确认1页A4；从实际PDF重新渲染并查看，文字完整、无裁切/重叠，页底仓库行可见 |

现存 T08 的22/22历史、16/16审计、8/8离线回归是自测证据。本次没有原样重跑这些会覆盖文件的脚本；独立反例表明它们尚未覆盖上述边界。54项通过不等于不存在这些错误。

## 独立证据

- `artifacts/validation/Codex-T08-review-probes.json`：F1–F4的观察结果与被测代码SHA-256，全部为离线数据或内存HTTP stub；无真实推理。
- `artifacts/validation/Codex-T08-writeup-page.png`：从实际一页PDF独立渲染的页面，未覆盖原预览。
- `artifacts/validation/T08-writeup-one-page.pdf`：复验的PDF原件，未更改。
- 本次终端记录：完整validate退出0；独立Edge检查13项通过。

## 给 DeepSeek 的下一批边界

仅修 F1–F4 和覆盖说明，不重新做 R01/R02/R05，不启动整批真实模型实验。先更新具体科学匹配/容差和usage完整性约定，再改代码。新增有实际反例的回归，不重写已有运行或旧预期来冒充先前通过。

以新增交接 `docs/handoffs/T09-review-boundaries.md` 返回改动、预期/实际结果、新证据和未完成项。实现稳定后跑受影响测试、完整验证及必要浏览器回归。Codex将复核带semantic的真实执行分支、双侧匹配唯一性、零阈值和partial usage四个反例。

视频尚未录制、visual_review仍not_reviewed、发布/推送/比赛提交未授权，这些状态保持不变。R01/R02/R05已经通过，不因新边界问题退回整套工作。
