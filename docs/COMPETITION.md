# 比赛核验记录

首次核验：2026-10-21；最新复核：2026-10-22，时区 Asia/Shanghai。证据分为「当届官方明确」「官网可能沿用旧文案」「尚未核实」。网页未来可能更新，提交前以主办方当届公告再核对。

## 2026-10-22：新提交平台已确认（当前优先）

已用实际 Edge 页面只读复核 [Moment 当届活动页](https://scientificintelligence.org/campaigns/osi-hackathon-2026) 和用户提供的 [项目48](https://scientificintelligence.org/projects/48)。匿名项目页只显示队伍私有条目的提示，不能据此核对该队未提交的草稿或字段。

活动页明确以美国中部夏令时 CDT 标注截止：2026-10-22 19:00。该页同时显示用户本地换算为 **2026-10-23 08:00 GMT+8**；服务端公开活动配置 `closesAt` 为 `2026-10-23T00:00:00.000Z`。与 [官方 Agenda](https://llmhackathon.github.io/agenda/) 一致。

**不是北京时间10月22日19:00。** CDT 为 UTC−5，北京为 UTC+8，相差13小时。

当前平台列出的提交必需项：

1. 公开可访问的社交媒体帖子链接，可用 X、LinkedIn、Bluesky、Instagram、Threads、YouTube 或其他公开平台。
2. 说明做了什么、学到什么的 write-up。
3. 无需登录可打开且含 README 的公开代码仓库。
4. 确认遵守活动规则。

视频是选填；有视频时放在公开帖子中，时长不超过4分钟。Agenda另建议最多一页说明，当前已准备一页PDF。平台明确允许一人队伍。公开仓库要求不等于已确认必须选择某一种开源许可证。

提交操作在队伍的Moment条目内完成，不能把“本地PDF准备好”或“发了帖子”当作已提交。账号登录、正确队伍归属、草稿字段和最终提交状态仍需在有权限的会话中核对；本轮没有登录、修改、发帖或提交。

当前公开评分维度为 impact、innovativeness、novelty、physical sciences and mathematics relevance，每项1–5；未据此推断额外权重。来源均为上方当届活动页。

附：横幅的 `/osi-hackathon-2026` 链接在本轮匿名访问返回404；使用上方 `/campaigns/osi-hackathon-2026` 的可用入口。

## 当届已核实

| 项目 | 结论 | 来源 |
|---|---|---|
| 名称与范围 | 第四届 Open Scientific Intelligence Hackathon；接纳物理科学、数学中的 LLM、agent、数据集、benchmark、模型及科研软件 | [官网](https://llmhackathon.github.io/) |
| 组织信息 | Luma host 是 Ben Blaiszik；官网标明 presented by Materials Discovery Research Institute | [Luma](https://luma.com/ku88xh92)、[官网](https://llmhackathon.github.io/) |
| 开始规则 | 2026-10-21，队伍自选当地开始时间；目前已进入开工日期 | [2026 Agenda](https://llmhackathon.github.io/agenda/) |
| 唯一统一截止 | 10 月 22 日 19:00 CDT（UTC−5）＝10 月 23 日 00:00 UTC＝**北京时间 10 月 23 日 08:00** | [2026 Agenda](https://llmhackathon.github.io/agenda/) |
| 当届提交描述 | 社交媒体帖子，可附最长 4 分钟 demo/presentation 和最多 1 页说明 | [2026 Agenda](https://llmhackathon.github.io/agenda/) |
| 更新渠道 | 主办方说明优先在 Slack 公布更新 | [2026 Agenda](https://llmhackathon.github.io/agenda/) |

## 官方页面冲突和未知

旧 [Submission Guidelines](https://llmhackathon.github.io/submission/) 仍写 Sept 12、视频不超过 2 分钟及 Google Form；与标明 2026 的 Agenda 冲突。**不能照旧日期执行，也不能据此确认旧表单就是本届入口。**

我们的处理：截止以当届 Agenda 与 Moment 一致的时间为准；Moment入口、公开仓库/帖子要求和允许单人已于10月22日核实。视频可以准备2分钟核心版与不超过4分钟完整版本，属于内部安排；视频为选填。队伍账户、权限与未明确的标签要求再按当前平台或官方Slack核对，公开发布/提交仍须玉米授权。

旧官网 FAQ 曾列 impact、innovativeness、scalability、材料/化学相关性；当前以Moment公开的四项评分为准，见本文件最新复核。团队理想规模3–10、无强制人数上限，且当前平台明确允许单人。

尚未查到当届明确说明：特定开源许可证；既有代码和预先构思的原创性边界；必须使用的模型、SDK、赞助商；详细评分权重。不要自行补成规则。独立一人参赛已明确允许，但仍需登录并处于正确队伍；公开仓库已明确要求。开发来源需如实交代。

## 往届作品给我们的实际启示

2024 官网名单是 LangSim、GlossaGen、PoreVoyant、Team Datalab；其中 GlossaGen 是科研术语/沟通工具。说明参赛成果不局限于直接做材料预测。[2024 项目页](https://llmhackathon.github.io/projects/)

2025 社区论文中，Alhaytham Eye 做二维定量图的数据提取评测；guillemot 通过读取衍射拟合图推进精修，并记录视觉误读限制；XAScribe 将谱学分析与写作相连。[主办方社区论文，§25、§26、§78](https://arxiv.org/html/2605.03205v1)

对本项目的启示属于我们的判断：把科研场景、可检查输出和实际基线做实；区分“提取定量数据”和“检查作者语义能否传达”两类任务。不能据这几项调研声称首创，也不能把不同任务的论文指标移作本项目成绩。

2025 [Awards 页面](https://llmhackathon.github.io/awards/) 在本次抓取中只有奖项标题，未获得具体获奖名单；不补写赢家，也不推测其代码链接。

## 对参赛方向的建议（非官方要求）

- 作品定位：物理科学/材料/化学研究中的图示沟通与验证软件。
- 开发时用抽象图隔离常识猜测；正式演示至少加入一张来源和语义经核对的材料/化学图，避免只演示通用 A/B/C 箭头。
- 展示证据：作者关键点、AI 记忆、重建图、逐项偏差、同配置修改前后结果及运行记录。
- 不把“两个 AI 对话”当创新说明；重点解释重建让作者多看到什么，以及在哪些地方会引入额外误差。

## 提交前由玉米核实的事项

1. 已完成全局注册，单人/团队身份符合本届要求。
2. Moment中正确的队伍/项目与编辑权限；公开帖子链接及未明确的标签要求。活动入口与视频上限已核实，不需重复猜旧表单。
3. 允许使用的已有代码、图稿权限；仓库必须公开且含README，具体许可证如未说明则不自行补成规则。
4. 审阅最终公开材料，并明确授权 push、部署、发帖和提交中所需的具体操作。

这些核验不妨碍先按当前范围开发，但最终提交不能靠猜。

## 本轮访问限制

用户引用了聊天 `01a159cc-8bcd-7370-8ef9-20392854280b`。当前工具目录没有 `read_thread`，因此本轮没有读取该聊天，也没有把聊天标题当成调研结论。已重新阅读用户完整附件并核验上述官方网页；后续如能读取历史，再对照补充。
