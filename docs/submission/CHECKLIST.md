# 提交检查表 · 2026-10-23

这是当前材料状态，不是提交成功凭据。仓库推送与网站发布已获授权；社交发帖、视频上传和最终比赛提交尚未执行。历史过程和旧验证留在各任务交接，不作为本表的当前状态。

## 可直接使用的材料

| 项目 | 当前状态 / 入口 |
|---|---|
| 公开仓库 | https://github.com/snowgoose1975/Research-Figure-Evaluator ，默认main，公开且含README；当前应用含T21简化界面 |
| 表单write-up | 复制本目录WRITEUP.md全文；WRITEUP_FORM.md与其逐字相同 |
| 网站 | https://figure-relay.chicchair5.chatgpt.site |
| 新图入口 | https://figure-relay.chicchair5.chatgpt.site/?workspace=1 ，仅主机在线接单时可分析 |
| 输入与结果 | PNG/JPEG、3–5条自然语言信息；不要求连接语法、不显示0/N覆盖比；A/B记录、引用、重建及折叠技术详情 |
| 访客历史 | 同浏览器、同站点IndexedDB；可搜索、打开、下载、移除，不跨设备同步 |
| 本地启动 | README中的npm ci / npm run dev；Ollama模型准备命令与Modelfile已入库 |
| 工程验证 | 最终应用快照npm run validate退出0：22文件143测试、typecheck/lint/build通过；T21受控访客17/17，旧结构化报告兼容6/6，实际公网iframe加载新表单通过 |
| 模型证据 | 旧固定reader-0.2.2协议8/12完成、4个A失败保留；不表示准确率，不混入reader-0.2.4开发运行 |
| 真实效果限制 | 箭头误读、同名节点匹配歧义、重建损失、自由文本判断未独立验证均披露；未证明相对直接检查的增益 |
| 来源与隐私 | 公开论文案例有来源/许可；私有runs与.env不纳入Git；上传仅限已公开且获准分享图片 |
| Sponsor Tracks | Valency / Marimo / Adaption均不选：当前未使用对应平台 |

## 仍需完成的提交操作

1. 视频已录好：T23英文字幕版3分58.7秒、37条字幕、约17.7MB，本机整段解码和关键帧检查通过，保留原音和完整时长。使用T23成品上传，尚无公开视频URL。旧T19仅作历史参考，不冒充新录屏。
2. 在选定平台发布公开可读帖子，参考POST.md，再用退出登录或无痕窗口打开最终帖子URL确认。平台名称本身不保证单条帖子无需登录可见。尚无真实帖子URL。
3. 在比赛表单粘贴WRITEUP.md，填写公开仓库和实际帖子URL，检查预览；视频如有放在帖子中。
4. 核对团队/账号、活动规则确认和所填内容，再由玉米提交。必须看见平台成功状态才记为已提交。

## 材料使用边界

- 当前Markdown是提交正文来源。旧T10 PDF只对应当时文稿，不能宣称与当前WRITEUP.md一致；本轮未重新生成PDF，也无需用旧PDF代替表单正文。
- 自动化截图/受控stub不代表模型正确；历史案例是回放，不是现场推理。视频中照实标注。
- 真人独立视觉复核仍未完成，visual_review保持not_reviewed。
- 用户表示计划提交后继续开机约两天，这是人工服务安排，不能写成部署SLA或全天候保证。
- 仓库当前没有项目软件许可证文件；材料称“public source repository”，不额外宣称已取得某种开源许可证。论文图许可独立保留，不据此推导代码许可。

## 截止来源

上次核验的当届活动页与Agenda截止为2026-10-22 19:00 CDT，即北京时间2026-10-23 08:00。参考 https://scientificintelligence.org/campaigns/osi-hackathon-2026 和 https://llmhackathon.github.io/agenda/ 。如临近提交出现调整，以登录后的当届表单/主办方公告为准；本次工具无法重新抓取Moment活动页，不把旧记录冒充本次实时确认。
