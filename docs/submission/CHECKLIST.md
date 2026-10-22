# 提交检查表（2026-10-22，未提交）

用途：把“材料已就绪”和“已发布/已提交”分开。本表不构成发布授权；push、部署、发帖、提交都需玉米明确许可。

## 已就绪

| 项 | 状态 | 位置 / 证据 |
|---|---|---|
| 可运行应用（生产构建） | 就绪 | typecheck/lint、19个测试文件125项（`npm test -- --maxWorkers=4`）、生产构建均通过；本地 `npm start` 于 127.0.0.1:3000 |
| 真实模型闭环 | 就绪 | 固定协议 8/12 完成，见 `docs/DELIVERY_VALIDATION.md` |
| 历史回放与深链接 | 就绪 | 24/24 检查通过（含 LIVE 筛选、全 ID 打开旧 baseline run）；`artifacts/validation/T10-history-browser-r2.json` |
| 浏览器证据 | 就绪 | 16/16 界面 + 24/24 历史/深链接 + 7/7 旧 coverage；0 unexpected console error（仅有 1 条故意请求不存在 ID 的预期 404） |
| 每次模型请求审计 | 就绪 | 受控 HTTP stub 两个 run、16/16：临时 500 重试、schema 修复、length 失败均分条落盘；`artifacts/validation/T10-audit-stub.json`（T08 被覆盖事件仍保留披露，见 `docs/handoffs/T10-review-boundaries.md`） |
| 检测覆盖与科学负例 | 就绪 | 11 个测试文件 75 项通过；T10 边界探针 18/18；真实数学运行离线回归 11/11；`artifacts/validation/T10-boundary-probes.json`、`T10-scientific-regression.json` |
| T09/T10 边界修复 | 就绪 | 语义不覆盖科学规则；双侧歧义不产生确定匹配；小量级 `1e-10` 对 `1e-12` 容差不被固定 epsilon 吞掉；B-only 面板与系列列入 unmatched；partial usage 标不完整 |
| 证据防覆盖 | 就绪 | 证据脚本支持 `--label`，默认拒绝覆盖同名文件；`scripts/lib/evidence.mjs`、`tests/evidence-guard.test.ts` |
| 真实运行经界面完成 | 就绪 | run `1792609657136-e85156a8`；`live-browser-math-*.png` |
| T16 固定公开入口与访客历史 | 有条件就绪 | 固定站v4已部署；访客history在production page上的受控集成验证12/12（stub worker；真实报告数据；保存、搜索、刷新、离线打开、删除、隐私检查）。真实live证据仍记录13次HTTP 502且无saved ID，所以真实隧道闭环未确认。见 `T16-visitor-history-resilience-v2.json`、`T16-visitor-history-e2e-v4.json` |
| T16 机主全量运行历史 | 就绪 | 本机API/UI按真实run ID检索并打开报告7/7；`T16-owner-history-e2e-v3.json` |
| Sponsor Tracks | 不勾选 | 当前代码未使用 Valency MCP Bond、Marimo 或 Adaption；不满足截图中对应赛道的使用条件 |
| 一页英文说明 | 就绪 | `docs/submission/WRITEUP.md`；A4 PDF 实测 1 页、内容 998/1020px（41505 bytes）；`artifacts/validation/T10-final2-writeup-one-page.pdf`、`.json`、`T10-final2-writeup-preview.png` |
| 视频脚本（2 分钟 / 4 分钟） | 草稿就绪 | `docs/submission/DEMO_SCRIPT.md` |
| 论文图来源与许可 | 就绪 | 应用内署名 + `docs/REAL_FIGURES.md`（CC BY 4.0） |
| 失败与限制披露 | 就绪 | 报告内 limitations、coverage、`docs/DELIVERY_VALIDATION.md` |

## 未完成 / 需玉米决策

| 项 | 阻塞原因 | 下一步 |
|---|---|---|
| 演示视频文件（平台选填） | 尚未录制 | 可用现有录屏准备演示；视频≤4分钟并放公开帖子中，不因缺ffmpeg阻塞必需提交 |
| 人工视觉复核 | 现仅有助手级检查，`visual_review` 仍为 `not_reviewed` | 玉米或独立人员看物理、材料重建 |
| 公开仓库 / push（必需） | 既有版本已推送；T16全量历史和访客历史新增代码仍只在本地，未push | 仓库：https://github.com/snowgoose1975/Research-Figure-Evaluator ；新push仍需符合AGENTS授权红线 |
| 公开社交帖子链接（必需） | 草稿已准备，尚未发布 | 核对公开账号和正文，授权后发布并保存链接 |
| Moment队伍条目、账号与规则确认（必需） | 活动入口已确认；项目48匿名访问仍为队伍私有条目，草稿字段不可见 | 登录正确账号，核对队伍归属、write-up、仓库/帖子链接及规则确认 |
| 公开发布/提交 | 红线操作 | 玉米明确授权后执行 |

## 截止与事实

- 截止：**2026-10-23 08:00（Asia/Shanghai）**，即10月22日19:00 CDT；不是北京时间10月22日19:00。Moment当前活动页明确显示 GMT+8 本地换算，且与Agenda一致。
- 当前入口：[Moment 本届活动页](https://scientificintelligence.org/campaigns/osi-hackathon-2026)。队伍的Moment条目提交需包含公开帖子、write-up、无需登录且含README的公开仓库、规则确认。
- 视频选填，若有则≤4分钟并放在帖子中；现有一页说明可作附件或write-up来源。单人队伍允许。
- 旧 Submission Guidelines（Sept 12、≤2 分钟、Google Form）与当届 Agenda 冲突，不能按旧页面执行，也不能假定旧表单是入口。

## 发布前最后一遍

1. 用 `npm run validate` 再跑一次，确认与提交快照一致。
2. 打开 `artifacts/validation/live-browser-math-result.png` 与两张论文原图，确认没有私图、密钥、内部地址入镜。
3. 通读 WRITEUP，确认每个数字都能在 `docs/DELIVERY_VALIDATION.md` 找到出处。
4. 视频/帖子中出现失败运行时不得剪掉或改述为成功。
5. 获得玉米对push、发帖、最终提交中所需具体操作的明确许可后，再操作；提交后核对平台的实际成功状态，不把材料就绪当作提交成功。
