# 实现合同 v0.2：跨领域科研图

## T20 已授权紧急修复（2026-10-22）

玉米确认立即解决核查发现的问题并要求A/B各自通用prompt。本批：reader-0.2.4（A原图/B重建图分别固定角色，均image-only、不读作者答案），renderer-0.2.3（不给B附加A摘要，避让箭头，保留真实可见标签/图示，不改A记忆），evidence-0.3.1。旧报告、旧8/12统计和公开历史回放不重写。仅1次用户图开发live验证，不因失败重复；只记录检查结果，不据单次运行宣称准确率改善。

可选作者原子连接检查：Keypoint新增`record_checks?: Claim[]`，最多12条，只支持flows_to/promotes/inhibits，qualifiers为空；作者显式填写`Source -> Target`或`Source | inhibits | Target`，每行一条，与原文一起确认。禁止从自由文本暗中推断标准答案，不将检查项送给A/B/绘图器。仅以唯一端点标签/alias精确规范化匹配提取图；重复标签、未知方向或双方方向并存均待核验。缺少显式边只标提取未记录，不证明原图缺箭头。多项按证据保守合并，输出逐项可读依据。

图审计将语义连接集合与重复记录分开：added/removed不按重复数量制造新连接；新增可选duplicate_edges_a/b（edge+count）和opposing_edges_a/b字段，仅报告记录层异常/双向候选，不能称原图科学错误。旧缺字段保持legacy。界面优先实际记录异常和明确检查结论，通用限制收起，模型自由文本建议保留为未核验而不伪装确定。

所有权：主代理schemas、A/B prompts/model、evaluation/index、主页面与owner UI/Markdown、集成和live；Luna renderer仅reconstruction及专用测试；Luna graph仅graph-audit及对应测试；Luna public仅adapters/local-service/public.html、server.ts及其专项测试。主代理先冻结类型；任何无法可靠验证项明确披露，不以文案代替能力。无数据库迁移、环境文件、全局安装或系统修改。

## T21 访客操作流程收敛（2026-10-23）

玉米明确要求移除访客表单的显式连接检查编辑器和结果顶部的0/N覆盖计数。访客流程固定为上传图片、用自然语言写3–5条预期信息、确认并提交、查看阅读对照。输入改为可换行说明框，连接检查不再由普通访客填写或在提交时解析；服务端仍兼容既有结构化检查，旧报告与判断不改写。结果保留真实A/B记录、待核验状态、重建缺口，图比较和执行覆盖收至默认折叠的技术检查详情，不再用覆盖比例充当用户结果。历史回放复用新访客展示，浏览器存储、权限和模型提示保持不变。本任务只改本机worker提供的访客HTML及相关验证脚本；固定Sites父页无需改源码或重新部署。验证包含纯文字提交、3–5条增删、只提交一次、技术信息可展开、新旧报告可查看、手机无横向溢出；受控测试不代表模型准确率改善。服务更新前确认无活动/排队任务，不取消用户运行。

## T22 提交材料现状核对（2026-10-23）

玉米要求公开仓库和write-up符合当前可提交版本。本批仅修正文档/提交素材：统一README与两份write-up的产品承诺、公开入口、普通文字输入、模型/渲染限制、旧协议与新版本区别；更新检查表、帖子草稿、用户自行录制的旁白。旧PDF/视频/运行/证据不覆盖，当前Markdown为表单正文来源，旧录屏仅作历史分镜参考。复核公开仓库main、无需登录的页面和关键链接；材料修改沿用已有push授权，发帖、视频上传和最终比赛提交仍不执行。文档编辑做链接/一致性/发布快照核验，不重复启动模型或无关全量测试。

## T16 历史检索与可提交用户路径（2026-10-22）

本机历史：修复列表只能筛选最近50项的问题。新增`GET /api/runs?history=1&q=<text>&offset=<n>&limit=<n>`，响应`{runs,total,offset,limit,has_more}`；关键词在服务端覆盖所有可读manifest，匹配ID、时间、模式、状态、示例/版本、模型、错误字段、作者关键点及A/B提取文本/图结构标签/报告项。limit默认20、最大50；offset非负整数；query最多120字符。只返回摘要（ID、时间、状态、示例/版本、模型、关键点数量、失败摘要），不返回图片、记忆、报告、请求审计或私有路径。旧`GET /api/runs`维持最近50完整快照，供现有比较/脚本使用；打开记录走原有单run API。9041控制页新增本机私有工作台入口，不能被公网访客访问。

访客历史：固定公开站点作为稳定UI和浏览器数据所有者；不再把访客重定向到不断变化的临时隧道origin。由固定站点嵌入当前HTTPS试用页，使用严格`postMessage`协议与子页交换数据。父页只接受来自当前iframe `contentWindow` 和精确临时origin的消息；子页仅接受精确公开站点origin的消息。访客提交后，pending/capability ID只存在固定origin的本地浏览器存储，结果终结后即删除capability，仅保存不含原图的报告、A/B抽取、重建图和时间到访客浏览器IndexedDB。可在固定站点跨隧道域名轮换搜索/打开自己保存的检查，并可清理本机副本；不给服务端增加访客历史列表，不向访客开放机主历史。

iframe只允许精确公开站点`https://figure-relay.chicchair5.chatgpt.site`嵌入；HTML frame-ancestors允许该origin并移除冲突的X-Frame-Options DENY。若主机服务重启使pending capability丢失，UI显示不可恢复，不重复提交；若报告已保存到浏览器则即使服务离线仍能查看。当前队列30分钟内存TTL仅作短期pending恢复，不再是已完成访客历史的唯一存储。访客同意文案必须说明报告保存在当前浏览器，提供清空操作；不将上传原图、文件名或用户关键点复制到父页历史元数据。

所有权：主代理拥有共享类型、磁盘搜索实现/API、服务端frame安全头与接口集成；Luna分别负责本机历史UI、稳定公开站点的浏览器历史/嵌入容器、访客页postMessage桥，各自限于互斥文件并交独立交接。禁止修改旧run内容/manifest、公开机主记录、增加数据库/迁移或把访客历史上传到主机历史API。验收覆盖：全量关键词命中第50项以外运行、分页/失败/空结果；游客结果重载后可检索、跨临时origin轮换可恢复、报告下载/移除本地记录；消息origin伪造被拒绝；原图不进入浏览器历史数据库。

## T15 玉米确认全面修正评估与阅读展示（2026-10-22）

针对用户双向状态图真实运行暴露的问题，按已讨论的“证据优先、实际A/B记录、机制布局”方向修复。禁止把工程通过等同模型正确。冻结：自由文本semantic判断若没有独立确定性支持，不得直接升级为retained；保留裁判原建议及引用，主状态uncertain，明确未验证，不伪造contradicted或omitted。确定性已匹配facts/显式科学检查优先，未知ID或空证据拒绝。此保守策略不是通用自然语言蕴含验证，界面必须说明自由文本支持仍依赖人工复核。

报告Judgment新增可选evidence_audit {requested_status,status:verified|unverified|invalid,reasons:string[],citations:{id,type,text}[]}；不修改模型输出schema。EvaluationReport新增可选graph_audit {executed,matched_nodes,unmatched_a_nodes,unmatched_b_nodes,unchanged_edges,removed_edges,added_edges,ambiguous_nodes,note}，边对象{source,target,kind,direction,line_style,evidence_status}。只按双方唯一规范化标签匹配节点，重复/缺失不确认差异；无原图标准答案，A/B差异不归因原图。

既有Keypoint.claim若明确指定flows_to/promotes/inhibits两端标签，且无facts替代记录时，允许唯一标签匹配后的定向边检查；含未检查条件、双向冲突或节点歧义返回uncertain。该规则只确认记录对应，不证明原图或科学真伪。重建中长边穿越节点或同端点多边的遮挡必须计入unsupported，不因仍输出了SVG就标完整。

本机服务结果新增reader_records:{a:MemoryRecord,b:MemoryRecord}，仅返回当前访客自身提取文本/结构、不返回原图/私有路径。界面分开实际提取记录、引用、评估器建议与确定性检查。旧报告若无新字段显示legacy/unverified，不重写原运行；T15离线复验单独保存在原私有run的新增审查文件，不公开用户图片或记录，除非另获许可。

所有权：主代理拥有schemas类型/evaluation/prompt/pipeline/服务executor/科学判例与集成；Luna graph只实现graph-audit.ts及对应测试，按上述冻结规则；Luna renderer只改reconstruction/index.ts与renderer专用新测试，所有有效semantic_position在机制/混合图也用于布局，保持箭头方向不变、避碰有警告，renderer版本升0.2.2；Luna UI只改local-service/public.html，围绕新增证据字段展示，保留上传/排队/关闭/暂停协议。其他本地/静态报告需标明历史判读，不静默改旧数据。真实新运行最多2次：用户图1次（若用户图仍在本机）、公开材料1次，全部保留失败，不混入原8/12，不因失败重跑补成功。先验冻结后执行，不付费、不新增系统项。

## T14 已授权本机持续服务（2026-10-22）

玉米确认本机承担推理，电脑开启期间持续接单，可独立暂停/恢复，不以关机作为停止方式。实现独立受限HTTP入口，而不是公开单用户Next工作台或Ollama。单任务，最多3个等待，滚动每小时最多12次、滚动24小时最多100次；公开PNG/JPEG不超过10MB/25MP，3–5条确认的作者信息。公网只有状态/提交/持随机会话能力ID获取自己的结果，无历史列表/任意文件/任意模型参数。管理端只监听回环独立端口，验证Origin；暂停立即拒绝新任务、取消等待项，当前项结束后卸载模型。暂停偏好保存在忽略的runs/service-control，不存密钥。

主代理负责架构、模型资源、HTTP边界、隧道和验收；Luna实现冻结接口的队列或独立HTML。复用正式本地pipeline（含既有schema/prompt/审计），在线试用新运行不计旧8/12，不能暗用mock。访客明确告知图像会由玉米本机处理并保留私有运行记录，只允许公开图；只向持会话ID的浏览器返回白名单报告/重建PNG，不回传旧历史或服务器路径。

无全局安装、环境文件、路由器/防火墙或系统启动项改动。先用项目内Cloudflare临时隧道验收，其URL重启会变化且无持续可用保证；稳定地址和开机启动需独立处理并如实说明。公开站仍保留案例入口，新分析入口只在真实联网验收后标记可用。

T14实际连接修正：Cloudflare当前网络连接失败，改用系统已有SSH连接localhost.run免费nokey入口。该服务会在同一连接中自动轮换域名。独立后台发现器每20秒读取隧道事件，仅在新URL经/status验证后，将不含私图/凭据的endpoint.json推送到本仓库专用service-status分支；原网页读取此公开地址文件，不把临时地址写死。使用既有Git凭据管理，不读取/复制token、不改全局配置；每小时最多12次公告更新，失败保留明确离线，不能承诺隧道SLA。分支只保存公开服务地址，不修改main源码或历史。

## T13 已授权发布、真实推理适配及产品目标纠正（2026-10-22）

玉米已明确授权适配与真实公开发布，免费优先约束继续有效。目标：帮助研究者检验其科研图能否传达预期信息，并据可核查的误读迹象改图；AI模拟读者与往返重建是手段，不测量真人理解，也不能把重建器缺陷归因于原图。入口和结果应围绕“预期信息→观察到的理解→需复核差异→修改与复验”，而不是把浏览往返实验当最终目的。

本轮同时修复图片打开无法退出：站内可访问dialog放大，明确关闭按钮、Esc、遮罩关闭，焦点恢复，绝不导航走页面或开原图新标签。主代理负责架构、发布与在线适配；Luna实施边界已冻结的UI。静态公开站与真实分析可独立发布，必须分别标记实际可用状态。HF连接不可用时可用已连接Sites发布相同审核后的静态站，不把替代托管当成已接通ZeroGPU。

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
