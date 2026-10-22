# T20 — 独立读者提示词与诊断修复

日期：2026-10-22。范围由玉米明确授权立即实施，接口先冻结于IMPLEMENTATION的T20节。

## 实际交付

- Reader A/B使用各自固定的通用角色提示词，共享视觉提取纪律但具有不同阅读任务；schema修复重试仍保持各自角色。版本 `reader-0.2.4`。
- Renderer使用中性标题，不将A的自由摘要绘入B输入PNG；保留真实标签、图示、公式和记录事实。反向/平行连接分车道，新增多次折线路由和标签避让，保留无法表达时的警告。版本 `0.2.3`。
- A/B图审计比较唯一连接集合，重复记录单列，双向记录作为复核候选，不伪装原图错误。旧重复B边不再被称为新连接。
- 作者可在每条检查点下显式输入最多12条连接：`Source -> Target`、`Source | promotes | Target`或`Source | inhibits | Target`。仅检查这些作者确认的原子连接，不推断自由文本答案，也不把检查点送给A/B/绘图器。缺失、反向、歧义有可读依据。版本 `evidence-0.3.1`。
- 访客报告先展示连接复核项，实际A/B记录、引用及去重限制可展开；恢复的历史使用持久化检查覆盖元数据。HTTP 502不再声称会话过期，404才报告会话不可恢复。
- WRITEUP.md现在是面向提交表单的正式正文；旧稿归档WRITEUP_20261022_PRE_T20.md。WRITEUP_FORM.md同步，不再写过期测试数。准备材料不等于实际比赛提交。

## 验证

- `npm run validate`：22个文件 / 143项全部通过；typecheck、lint、生产构建通过。
- `node scripts/t20-ui-smoke.mjs`：6/6受控浏览器检查，未调用模型。
- `node scripts/browser-smoke.mjs --label T20-owner-browser-v1`：19/19、无console/page错误。
- `node scripts/t20-site-smoke.mjs`：已发布站点实际载入新worker iframe，3个可选连接检查编辑器、无页面错误；未提交图片。
- 已有私有开发A记录的离线重建：摘要不在PNG内，最终无unsupported/警告；相同旧A/B记录的新图审计识别1组B重复记录、0条独有B新增连接、2条B缺失连接。新产物仅在私有scratch新增，原记录未改。

## 真实模型证据与未解决能力限制

仅执行1次相同用户图/原检查点的开发live：`1792682976529-29804c8a`，123秒完成，A/B摘要不同，使用上述新版本，未加入原固定协议8/12。审计摘要 `artifacts/validation/T20-live-summary-v1.json` 仅含非敏感运行与数量，不含用户图或内容。

这次4B模型仍漏读/反向解读部分箭头，A/B facts均为空；新提取图仍有1条无法避让的连接，明确标记unsupported和警告。提示词变化没有证明可靠读图或准确率提升，不能宣称所有模型错误消失。没有继续重跑挑选成功。自由文本建议继续未核验；显式连接检查覆盖的是作者输入的连接，不是任意自然语言全文或科学真实性。

## 发布与服务

公开站v7已部署：https://figure-relay.chicchair5.chatgpt.site 。源码 `078a5c55620a70b8a4bf08c77537791080ab97de`，version `appgver_9a4dc8ce7f6881919cfc535d5a65d9fa`，deployment `appgdep_6ada2ab97de881919974b9b0b3c1ab45`。

升级前确认无活动/排队任务，暂停后重启项目Next和worker；验证完成已恢复原接单状态，status为accepting=true。旧报告和固定统计未改，新提交才使用新协议。未修改.env、密钥、CI、系统配置或启动项；未发社交帖子或提交比赛。
