# 接续交接 · 2026-10-22

## T16 历史功能收尾与续办入口（最新）

本机历史新增全量摘要搜索和分页，不再限于最近50条；公网访客报告存入当前固定站点origin的IndexedDB，支持搜索、刷新后回看、离线打开、下载和删除。访客历史不回传服务端，也不暴露机主runs。固定公开站已部署T16 v4：`https://figure-relay.chicchair5.chatgpt.site`（Sites version `appgver_132cff8c1f308191955a4fe9af33b429`，deployment `appgdep_6ad9f8794a188191aa8125da23af0606`）。项目实现与安全边界见 `docs/IMPLEMENTATION.md` T16节。

真实访客入口提交了一次公开材料图，完成run `1792674795248-f18f993e`（`qwen3-vl:4b-instruct-16k`、`reader-0.2.3`）；不并入原固定协议8/12。实际live浏览器证据 `T16-visitor-history-e2e-v4.json` 记录结果轮询中13次HTTP 502，且没有取得已保存记录ID；脚本还使用过CSS Modules会改名的类选择器，不能将失败单归因于选择器或宣称真实公网闭环。已增加状态GET有限重试。除5/5独立poll smoke外，又在已发布站点进行12/12综合受控浏览器验证：两次stub HTTP 502后恢复，只POST一次；用真实完成run报告验证访客IndexedDB保存、模型搜索、刷新、阻断隧道后的离线打开、删除、原图/文件名不入库及临时能力清理，见 `T16-visitor-history-resilience-v2.json` 和两张截图。此测试拦截并替代了隧道worker响应，没有真实模型请求或实际公网worker调用；因此验证了生产站点访客UI和存储行为，不等同于真实公网传输闭环。另有10/10桥接回放证据 `T16-visitor-history-replay-v1.json`。机主全量历史API与界面检索/打开该run 7/7通过，见 `T16-owner-history-e2e-v3.json`。

发现并修正本机Next进程仍引用旧构建、导致静态chunk返回500的问题；确认没有运行/排队任务后重启了项目网页进程。重启后机主历史浏览器检查通过。临时隧道地址会自动轮换；最后一次公开发现文件检查为online。刚才本机worker只读检查为`accepting=true, active=false, waiting=0, model_ready=true`，served HTML中的CSP允许固定站嵌入，且有限GET重试代码已加载。服务只在玉米手动启动时运行，没有创建开机启动项。

此前T16源代码完整检查为typecheck/lint/build通过、19个测试文件125项通过。本轮首次在受限环境遇到loopback EACCES，放开本地验证后全量测试第一次有一个并行超时；降至4 workers复跑后19个文件/125项全部通过，typecheck、lint分别通过，生产构建成功。综合访客浏览器验证12/12通过。访客记录只属于提交时使用的浏览器；清除站点数据或换浏览器不会同步。真人视觉复核仍待玉米或独立人员完成；演示视频仍未录制；根仓库改动未push；社交帖子与比赛条目未发布/提交。20:00自动续办并未被系统自动化，本轮由玉米手动续接。

## T15 证据优先修正（最新）

修复用户双向状态图中5/5假保留与A/B解释冒充读者原话。自由文本semantic建议没有独立规则支持时降为待核验，同时保存原建议、解释与可读引用；显式facts/作者结构化定向连接/数值科学检查仍可确定性核对。新增唯一标签图比较与重复标签拒配；机制位置保序布局，长边遮挡/双向重叠计入unsupported，不再默认为完整。网页分开真实A/B记录、裁判建议、图差异和覆盖范围，本地工作台/Markdown也同步；历史报告只标legacy，不改写。

完整validate为19文件124项，零lint警告，生产构建通过；最终浏览器18/18、零错误。两次固定开发真实运行完成：用户图104秒（仍读错，5项均待核验、图差异少2多1、6条绘图警告），公开材料30秒（4项待核验、图关系无变化）。仅证明新链路与证据显示，不能声称准确率提升或跨域可靠。用户私图/新报告都在runs私存；公开证据只含汇总及公开材料截图。reader-0.2.3 / renderer-0.2.2 / evidence-0.3.0，与旧8/12隔离。服务在开始前已paused，升级后保留暂停状态；从固定入口重新打开新检查，不看旧标签页结果。详见[T15交接](handoffs/T15-evidence-first.md)。

## T14 本机免费在线试用（历史）

固定网页已接入本机GPU试用，受限访客HTTP服务9040通过免费localhost.run隧道访问；控制页仅127.0.0.1:9041。单任务+3等待，每小时12次/滚动24小时100次自动恢复，低于1GB空闲RAM拒绝新任务，空闲卸载模型。暂停取消等待项，当前完成后释放；恢复不必关机。玉米选择手动启动，不创建启动项。双击`scripts/start-sharing.cmd`，说明见[LOCAL_HOSTING](LOCAL_HOSTING.md)。

域名实际发生同连接自动轮换；后台每20秒健康检查并仅向service-status专用分支发布公开地址/时间/online状态；原网站自动读取，main和私有记录不受更新器影响。Cloudflare隧道当前网络连接失败，未改系统网络；localhost.run有真实网络抖动，无SLA。首次公网材料图正式流水线完成，GET中断后领取同一任务结果，未重新提交/调用模型；证据T14-live-first-recovered.json。峰值显存6627MiB，最低空闲RAM289MiB与开发构建重叠，不能保证日常应用无影响。只允许公开图，私有审计保留本机，结果会话ID不公开。详见[T14交接](handoffs/T14-local-service.md)。

## T13 公开网页与图片交互（历史）

公开案例站已部署：https://figure-relay.chicchair5.chatgpt.site ，外网13/13检查，无console/page错误。图片支持Close image、Esc、遮罩退出、焦点恢复，手机点击修复。首页围绕作者预期→模拟阅读→修改；不把重建缺陷当作原图缺陷。线上仅历史案例，新图分析仍需本地运行。

完整validate通过：14文件94测试与生产构建；Python relay6项通过。免费GPU候选桥/上传包已准备，GPU未验证；HF创建Gradio被PRO门槛拒绝，用户截图也确认Gradio/Docker为Paid，当前路线阻断。首个新relay真实本地测试A阶段失败，保留证据，不混入旧8/12。实际发布ID、后续更新入口与待办见 [T13交接](handoffs/T13-publication.md)。公开网站发布已授权并执行；社交发帖/比赛提交未执行。

## T12 网页入口与界面（历史）

首页重整为真实案例与新图检查两个入口；工作台采用三步确认，大图/复核优先、技术记录收起；私有旧run深链接仍可用。公开v2案例投影去掉含糊的author_confirmed布尔值，明确仅由协议标记；保存原报告、单列当前离线规则审计，原私有run不改。静态包由白名单源码隔离构建，当前最终包 `artifacts/web-preview/T12-public-final/`，含HF静态Space元数据，未发布。

最终90项单测、类型/lint/生产构建通过；独立静态浏览器15/15、本地流程19/19、历史24/24、图片完整性与手机首页3/3。静态版无私有API调用，新图在线分析明确未接通。账号MarqueeMoon已通过插件识别，年龄超过30天，免费ZeroGPU仍需确认邮箱/平台资格并做Gradio适配；不能宣称已经上线或已获得GPU。详见 [T12交接](handoffs/T12-web-entry.md)。公开部署、发帖和比赛提交仍未执行。

## T11 公开源码与报告导读（历史）

玉米已明确授权 Git 推送，完整候选版已发布至 `snowgoose1975/Research-Figure-Evaluator` 的 `main`，首次完整交付 commit `0095caa`。修复 `.gitignore` 中 `runs/` 误忽略 `src/app/api/runs/` 的问题，改为 `/runs/`，四个 API 源码均已入库，私有运行未公开。

报告新增可展开复核导读和可读 A/B 引用，Markdown 同步包含；不改旧 run、评估结论、检查点或实验参数。最终 `npm run validate` 通过，12 files / 84 tests / 生产构建成功；浏览器 20/20，最终生产回放与手机展开布局 4/4，真实旧数学记录离线回归 11/11，临时报告副本的导读检查 4/4。真实模型统计仍为原 8/12；旧报告不自动补算新审计。证据与限制见 [T11 交接](handoffs/T11-publication-and-review.md)。

README 已补英文评审入口与无模型体验路径。社交发帖、部署和比赛提交仍未执行，未获得这些操作授权；公开源码不能等同于已参赛。

## T10 已通过独立定向复验（历史）

Codex独立重跑75项测试及生产构建、18项边界探针、默认拒绝覆盖和wx二次写入保护，均符合预期；N1/N2与防覆盖可关闭。验收记录见 [ACCEPTANCE_T10_REVIEW](ACCEPTANCE_T10_REVIEW.md)。下一步进入真实图修改对照与参赛成品准备，不再扩大工程修复清单。

比赛提交已复核：Moment活动页与官方Agenda均为10月22日19:00 CDT，即**北京时间10月23日08:00**，不是北京时间今天19:00。当前平台必需公开帖子、write-up、公开仓库含README、规则确认；视频选填≤4分钟，允许单人。入口与详情见 [COMPETITION](COMPETITION.md) 和 [提交检查表](submission/CHECKLIST.md)。Git push 已在 T11 获授权并执行；发帖、部署、最终提交仍未执行。

## T10 边界收尾与防覆盖（历史）

T09 复验遗留的 N1/N2 已修：`1e-10 A` 对 `1e-12 A` 容差的实际零值不再被判 retained；A 无 plot、B 有面板/系列时 `unmatched_b_plots`/`unmatched_b_series` 会列出；证据生成脚本使用独立 label、预检和拒绝覆盖写入。当前 `npm run validate` 为 11 个测试文件 75 项通过；T10 边界探针 18/18、科学回归 11/11、受控审计 16/16；最终构建浏览器 16/16 界面、24/24 历史/深链接、7/7 旧 coverage；一页 PDF 1 页、998/1020px。详见 [T10 交接](handoffs/T10-review-boundaries.md)。没有启动新的完整真实模型实验，旧运行与旧检查点未改动。

## T09 独立复验结论（历史）

Codex已独立重跑64项测试及生产构建，四个原始反例均已修复。剩余两项P2：固定绝对epsilon吞掉小量级阈值差异；A无plot而B有plot时未匹配B列表遗漏。另需给证据生成脚本加独立命名和禁止覆盖保护。具体证据与最小收尾范围见 [ACCEPTANCE_T09_REVIEW](ACCEPTANCE_T09_REVIEW.md)。上述两项及防覆盖已由 T10 处理；已通过修复保留，原始T08汇总被覆盖事件按下文披露处理。

## T09 边界修复（历史）

F1–F4 与覆盖说明已修：semantic retained 不再覆盖科学规则或明确反向断言；A/B 任一侧面板重名时不产生确定匹配；0.05 检查不再把 y=0 判 retained；只有输入或只有 total 的 usage 标为不完整。T09 独立证据为 `T09-boundary-probes.json`（12/12）与 `T09-scientific-regression.json`（11/11）。详见 [T09 交接](handoffs/T09-review-boundaries.md)。

必须披露：重跑既有 `t08-audit-stub.ts` 时，`T08-audit-stub-v2.json` 及两个复制 JSONL 被同脚本覆盖为新的受控 run；旧私有 run `1792629726115-43ba30b6`、`1792629726849-ace8a605` 仍在，但原始 T08 汇总 JSON 未保留。不要把当前文件当作原始 T08 证据。

## T08 独立复验（历史）

R01/R02/R05 通过；R03 主流程通过但 partial usage 有边界错误；R04 因 live 分支绕过规则、面板歧义匹配和阈值容差未通过。该结论由 T09/T10 修复，等待 Codex 复核；历史报告见 [ACCEPTANCE_T08_REVIEW](ACCEPTANCE_T08_REVIEW.md)。下文 T08“done”是执行方自测状态，不等于独立验收结论。

- 历史回放：列表、LIVE 筛选、深链接 `?run=`、按完整 ID 打开最近 50 条之外的运行、失败运行、分页、桌面与 390px 布局，22/22 通过；另有 6 项旧 coverage 兼容性检查。
- 默认配置：无环境变量时模型为 `qwen3-vl:4b-instruct-16k`、输出上限 10000；`scripts/Modelfile.*` 与 README/HANDOFF 命令一致。
- 审计：每次 HTTP 尝试一行 `runs/<run-id>/model-calls.jsonl`，含阶段、修复/首发、请求 ID、usage、finish_reason、HTTP 状态、校验与错误码；受控 stub 两个 run 覆盖临时 500 重试、schema 修复和 length 失败，16/16。
- 检测覆盖：报告与界面显示四类检查是否执行、未覆盖项与 `review_required`；6 个冻结 synthetic 负例覆盖方向反转、条件丢失、阈值变化、轴单位/尺度、系列形状、重复标签歧义。
- 文稿：WRITEUP/POST/DEMO_SCRIPT/CHECKLIST 已按实测更正；T09 一页 PDF 经 Edge 打印实测 1 页（内容 1014/1020px、41219 bytes），见 `artifacts/validation/T09-writeup-one-page.pdf` 与 `.json`；旧 T08 PDF 保留不动。

仍待外部输入：真人视觉复核、视频录制、push/发布/提交授权、官方提交入口确认。

## Codex 验收后的接续入口

2026-10-22 独立验收结论为“工程候选版有条件通过，最终成品暂不通过”。具体证据见 [ACCEPTANCE_REVIEW](ACCEPTANCE_REVIEW.md)，DeepSeek 下一批执行顺序、验收标准和返交格式见 [DEEPSEEK_REPAIR_BRIEF](DEEPSEEK_REPAIR_BRIEF.md)。先处理该任务单，再看下文历史候选版状态；不要将下文“已补齐”理解为所有问题已通过独立验收。

## 先读与边界

工作目录：`C:\Users\czc12\OneDrive - HKUST (Guangzhou)\Documents\ChatGPT\hackathon`。先读根目录 AGENTS.md 与 `docs/IMPLEMENTATION.md`，再读本文。本文记录实际状态；MASTER_PLAN、CONTRACTS、TASKS、VALIDATION 含早期规划。接口以 `src/lib/schemas/index.ts` 为准，实际证据以 `docs/DELIVERY_VALIDATION.md` 与 `artifacts/validation/` 为准。

已授权：实现、项目局部依赖、Ollama 模型下载、本地真实运行、准备比赛文字。未授权：删除文件、修改 .env/密钥/CI、数据库迁移、`git push`/`rebase`/`reset --hard`、全局安装/系统设置、公开发布/部署/发帖、比赛提交。密钥不进入代码、日志、报告或聊天。

## 当前状态

应用已实现并在生产模式本地运行：真实论文图与上传、3–5 条作者检查点、A/B 独立请求、确定性 SVG→PNG 重建、逐项评价、隔离直接检查基线、历史与同条件比较、JSON/Markdown 导出、响应式界面。

真实视觉模型闭环已打通，不再是被阻塞项：

- 固定协议模型 `qwen3-vl:4b-instruct-16k`（`num_ctx=16384`，`RFE_MAX_OUTPUT_TOKENS=10000`），提示词 `reader-0.2.2`，renderer `0.2.1`。
- 物理、材料、数学（metric 双面板）各 1 张真实 PLOS ONE 图按 3 次协议运行；数学网络图（holdout）无法完整提取，作为失败记录保留。完成 8/12，具体数字见 `docs/DELIVERY_VALIDATION.md`。
- 32k/14000 与 16k/8000 两种配置均实测过：前者在 8GB 显存上溢出到 CPU（8.4GB、33% CPU），单次约 20 分钟；后者物理出现输出截断。最终用 16k/10000。
- 8B instruct 仅作抽查：物理 1 次完成（3/4 检查点，漏 `d sin(ωt)`），随后一次尝试三次超时；本机显存不足，未作为协议模型。

## 视觉模型环境（本机特有）

Ollama 默认 4096 上下文放不下“图片 + 完整 JSON schema + 提取结果”。已创建派生模型：

- `qwen3-vl:4b-instruct-16k` / `-32k`（协议最终使用 16k + 输出 10000；32k/14000 在本机过慢）
- `qwen3-vl:8b-instruct-16k`

`ollama pull` 曾在 Cloudflare 层卡死（解析到 198.18.0.7）。已用 curl 按 registry manifest 下载 blob 到 `~/.ollama/models/blobs/`，写入 `~/.ollama/models/manifests/registry.ollama.ai/library/qwen3-vl/<tag>`，再用 `ollama list`、`ollama ps` 和 sha256 校验。Modelfile 位置 `runs/model-setup/`（已在忽略目录内）。这是网络适配，不是产品逻辑；不要改系统 DNS/代理或关闭安全检查。

启动示例（PowerShell；默认配置已正确，通常不需要环境变量）：

```powershell
npm start
```

如需显式覆盖：

```powershell
$env:RFE_MODEL="qwen3-vl:4b-instruct-16k"; $env:RFE_MAX_OUTPUT_TOKENS="10000"; npm start
```

## 提示词版本与已知结论

- `reader-0.2.0`：物理、材料 3/3 完成；数学 metric 0/3、网络 0/3，Reader A 报 `no_readable_content`。
- `reader-0.2.1`（试改“可读即完整”）：数学 metric 3/3，但材料 0/3（空完整记录）。已回退。
- `reader-0.2.2`（当前）：只澄清 `completeness=unsupported` 指图像不可读，不指图中统计结论不成立。数学 metric 与材料恢复完成；物理完成。
- 观察到模型会把 `unsupported` 当成“统计上不显著”，这是数学图失败的可疑根因；修复方式是语义澄清，不是放宽评分。

不要通过改标注、放宽完整性门槛或挑选成功重跑让结果好看。Reader A/B 的原始记忆与失败运行都保留。

## 文件地图

- `src/lib/schemas/index.ts`：schema 0.2.0 与 `PROMPT_VERSION`（0.2.2），唯一类型来源。
- `src/lib/prompts/index.ts`：reader/judge/direct 提示词与隔离规则。
- `src/lib/model/index.ts`：chat/responses 适配、JSON Schema、超时重试、有界语义修复（重复 ID、悬空引用、完整性与内容矛盾）。
- `src/lib/reconstruction/index.ts`：白名单投影、SVG/PNG、结构审计、轴名/单位去重；`visual_review` 默认 `not_reviewed`。
- `src/lib/evaluation/index.ts`：规则与语义判定的证据引用审计、阶段归因、可比性检查。
- `src/lib/pipeline/`、`storage/`：运行编排、图像归一化、持久化、状态。
- `src/lib/examples/published.ts`：4 张真实图（物理、材料、数学网络 holdout、数学 metric dev）。
- `scripts/live-run.mjs`、`scripts/protocol.mjs`、`scripts/live-browser.mjs`：真实运行、固定协议、浏览器真实运行证据。
- `scripts/probe-reader.ts`、`scripts/probe-pipeline.ts`：诊断真实模型行为，不写运行记录。
- `docs/handoffs/Txx-*.md`：早期模块执行记录。

## 接续优先级

1. T10 已补齐 N1/N2 与防覆盖：`npm run validate` 通过（11 文件 75 测试）；16 项界面 + 24 项历史/深链接 + 7 项旧 coverage 检查通过；T10 边界探针 18/18、真实运行离线回归 11/11；受控审计 16/16。一页 PDF 为 1 页、998/1020px。详情见 [T10 交接](handoffs/T10-review-boundaries.md)；T09 历史见 [T09 交接](handoffs/T09-review-boundaries.md)。当前 T08 审计汇总仍是 T09 期间重跑覆盖版，见上文披露。
2. 人工复核至少物理与材料各一次真实重建；当前只有助手级检查。应用内 `visual_review` 不应在未人工查看时改成 `passed`。
3. `docs/submission/WRITEUP.md` 与 `DEMO_SCRIPT.md` 已换为实测数字；视频未录制（本机无 ffmpeg，安装需授权）。
4. 比赛提交入口、视频时长、账号/标签仍需玉米在官方 Slack/当届页面核实；任何 push、发布、部署、提交先取得明确许可。

## 验证与启动

Node >=22.12，依赖已装在项目内。`npm run dev` 或 `npm run build && npm start` → http://127.0.0.1:3000。`npm run validate` 依次做类型、lint、单测、生产构建。

- 浏览器脚本：`node scripts/browser-smoke.mjs`（需要本机 Edge 和服务运行）。
- 真实运行：`node scripts/live-run.mjs <example-id> --baseline`。
- 固定协议：`node scripts/protocol.mjs --tag <tag> --attempts 3 --baseline`。

Windows 沙箱可能拒绝 Next/浏览器/Ollama 网络；不要把沙箱 EPERM 当应用 bug，也不要通过跳过检查绕过。

## Git / 未做事项

本地 unborn master、无远端，全部实现尚未提交。未 push、部署、发布或提交比赛。不要 `git clean/reset` 或删除原型、失败运行。准备可审查变更可以，任何 push 先问玉米。
