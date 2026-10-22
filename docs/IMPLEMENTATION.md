# 实现合同 v0.2：跨领域科研图

## T12 用户已确认的产品界面调整（2026-10-22）

玉米已确认按“重整界面＋免安装真实案例体验”实施，在线算力免费优先，接受排队及慢推理。首页只保留查看真实案例与检查自己的图两个入口；配置分为图片、信息确认、开始检查；高级参数/基线/技术记录折叠，结果优先大图对照与复核清单。保留原模型、数据与评估协议。

公开案例来自冻结12次协议：每种图展示首次完成运行，网络图展示首次失败；完整12次结果索引同页披露，不能将精选回放当作全体统计。导出使用显式字段白名单，不复制私有运行目录；重建仅公开已许可论文图的模型产物，署名随图。新审计只作为单独标注的离线规则检查，保留原报告及统计。

所有权：主代理负责入口页、公开案例、数据导出、访问边界与托管方案；Luna 只负责 `src/components/workbench.tsx` 和 `src/app/globals.css` 的界面与交互重整。不动 schema、模型提示、科学规则或旧运行。不创建/修改环境文件或 CI；没有部署授权前只完成本地可审查成品。现有服务为单用户工作台，不能直接用于公开多用户上传。

2026-10-21：玉米已授权实现，主代理负责 T00/T04/T06，GPT-6 Luna 负责执行模块。本文取代 v0.1 中“只做机制流程图”的限制；历史文件保留以追溯，实际接口以 `src/lib/schemas/index.ts` 为唯一来源。

## 范围与可检验承诺

统一检查“作者指定的科学命题是否被恢复”，按图片内容选重建方式，而不是按学科硬编码：

- 原理/机制/流程：实体、连接方向、关系类型、条件、证据。
- 结构/几何：实体、邻接/包含/相对位置、对称/几何限定；位置只有承载科学含义时进入记忆，不复制原图像素。
- 分析图：轴/单位/线性或对数、系列/趋势、近似采样点；明确是概念重建，不是高精度图表数字化。
- 数学关系：公式/命题/适用条件作为显式事实，几何或曲线辅以图形重建。

所有类型共用 `facts`（subject、predicate、object、qualifiers、certainty）和出处引用；graph、plots、semantic positions 为可选的可视化表示。重建必须有可视化内容，并显示记忆中的事实/限定，不能用“支持任意科研图”的宣传代替验证。专业分子结构、显微图定量、精密晶体学和任意多面板暂未验证，不能声称支持精确重建。

## 冻结的模块边界

- 主代理：schema、prompt、evaluation、pipeline、storage、API、根配置和依赖、测试集语义/判例审核。
- Luna UI：`src/app/page.tsx`、`src/app/layout.tsx`、`src/app/globals.css`、`src/components/`；不动 API/schema/依赖。
- Luna renderer：`src/lib/reconstruction/`、对应测试；只按 schema/语义表实现，不自定字段。
- Luna model：`src/lib/model/`、对应测试；遵守主代理 prompt，提供 Responses 与 chat-completions 两种显式选择的 OpenAI-compatible HTTP 协议，无隐式降级。
- 空闲 Luna 后续执行 `src/lib/examples/`、`public/examples/`、样例 manifest 和验证材料；其标准答案配方须先由主代理批准。

## 实际类型概要

MemoryRecord：版本、title、domain、figure_type、summary、graph(nodes/relations/groups/conditions)、plots、facts、uncertainties、evidence、completeness。

Relation kind：promotes/inhibits/flows_to/associated_with/contains/adjacent_to/equals/unknown。Node 可有承载结构含义的 semantic_position；它不是原图 bbox。Plot 的轴有 label/unit/scale/min/max，series 有点列与显式近似状态。

Keypoint：id、text、可选结构化 claim、author_confirmed。3–5 条；原文不自动改写。可以直接确认作者原文，语义评估器单独处理，不把关键点送给 A/B。

RenderResult：svg（字符串）、png（Buffer）、width/height、rendered_item_ids、unsupported_item_ids、warnings、structural_audit、visual_review。pipeline 保存资产后向客户端只发资产 URL。

Model API：`readOriginal(input, config)`、`readReconstruction(input, config)`、`judgeKeypoints(input, config)`、`directCheck(input, config)`。ReaderImageInput 只含 base64 PNG/JPEG 与 mime；config 由服务端提供，绝不含用户关键点。judge 获得 K/A/B（不看原图补答案），direct baseline 独立获得原图+K。

## 运行与真实性

- `live`：真实视觉调用；`mock`：用户显式选择的脚本演示；`replay`：历史结果查看。缺 API 时 live 清楚报配置缺失，绝不自动转演示。
- `mock` 只验证产品交互，不作为模型准确性/泛化性实验。内置跨学科示例证明支持的数据表示和绘图覆盖，真实效果需 live 结果。
- 配置仅从服务端环境读取，当前不创建/修改 `.env` 或密钥。用户选定服务后再按其明确许可配置；不在聊天中索取密钥。
- 文件存储，单活动 run，实际输入隔离、运行审计与失败保留；完成 run 不覆盖。所有路径由注册资产白名单解析。
- 一份模型响应最多 96 实体、160 关系、80 事实、4 plots×6 series×96点；图片≤10MB、≤25M像素。超限报错，不截断。

## 审计与覆盖元数据（v0.2.1 兼容扩展）

以下字段均为可选扩展；旧运行缺少字段时按 `legacy/unavailable` 呈现，不回写旧 run。

- `ModelCallMeta.attempts_detail[]`：每次实际 HTTP 请求一条，含 `index`、`phase`（initial/repair）、`stage`、开始/结束时间、`duration_ms`、`request_id`、响应声明的 `model`、`usage`、`finish_reason`、`http_status`、`outcome`、`validation`、`error_code`。不得包含请求头、Authorization、API key、含凭据 URL 或图片 base64。
- `ModelCallMeta.usage_complete`：仅当该阶段每次请求都同时返回输入与输出 token（`prompt_tokens` + `completion_tokens`，或 `input_tokens` + `output_tokens`）时为 true；只有 total、只有输入、无 usage 或任一字段缺失均为 false。部分已知时只累加已知值并标 false，未知值不填 0。
- `RunSnapshot.config_snapshot`：非敏感配置快照（模型名、协议、超时、输出上限、base URL host、可取得的模型摘要与 num_ctx）。取不到 Ollama digest/num_ctx 时为 null，不猜测。
- `EvaluationReport.coverage`：说明事实逐项比对是否执行、A/B facts 数量、图关系/条件/坐标图审计是否执行、匹配的 plot/series 数、轴与系列检查是否分别执行、未匹配的 A/B 面板与系列、未覆盖项与原因。空差异列表不得解释为“没有变化”。
- `EvaluationReport.scientific_findings[]`：A→B 的确定性科学差异审计（关系方向反转、条件文本缺失、轴单位/尺度变化、坐标图未匹配等），带 confirmed/uncertain、证据 ID 与复核标记。面板按 title 或轴标签分组，只有 A/B 两侧各恰好一个同名面板才匹配；系列只在唯一匹配面板内按唯一标签匹配；任一侧重名、缺失或歧义均不产生确定匹配，进入 coverage 的 unmatched 列表。不跨记忆对齐局部 ID。
- `Keypoint.scientific`：坐标图参考线检查（系列标签、期望 y、值容差、水平性容差、期望单位/尺度、可选 `tolerance_basis`）。`tolerance_basis` 必须在审计前独立冻结；缺失、值容差大于等于非零期望量级、或平坦性容差覆盖整个 y 轴跨度时返回 `uncertain`，不得为了保留结果放大容差。数值比较只允许随操作数缩放的浮点表示补偿，不得加入固定带单位的 epsilon。只用于项目整理检查点，不改变旧检查点口径。
- 判定优先级：项目整理的 `scientific` 检查始终先走确定性规则；semantic 结果不得把规则 `contradicted` 改成 `retained`，也不得把规则 `uncertain` 改成确认。普通关键点的明确反向抽取断言同样优先于 semantic retained。

私有审计明细写入 `runs/<run-id>/model-calls.jsonl`，不进入可分享 artifacts。旧运行不补写。

## 示例与验证

更新：正式试验优先真实已发表科研图，规则见 `docs/REAL_FIGURES.md`。自绘 6 对仅用于工程正控/脚本教程，不作为真实泛化效果证据；实际论文图不预填脚本 A/B。首批真实图按物理、材料、数学各域独立验证，原始图片、许可和参考检查点可追溯。

主要验证：非因果关系不当因果、条件/不确定不丢、单位/尺度错误不判保留、几何/结构相对位置不混同、A/B ID 不直接对齐、renderer 输入不含原图、B 只有PNG、基线不回流、真实失败不伪成功、同配置版本对比。

## 工程命令

项目使用 Node/TypeScript，Next App Router，Zod，Resvg。局部依赖，禁止全局安装。根负责人固定 `dev`、`build`、`start`、`typecheck`、`lint`、`test`、`examples`、`validate` 脚本。首版不依赖当前不可用的系统 Python。
