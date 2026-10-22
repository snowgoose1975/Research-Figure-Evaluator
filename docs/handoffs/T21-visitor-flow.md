# T21 · Simplify the visitor flow · 2026-10-23

## Delivered

玉米要求移除显式连接编辑器和0/N覆盖展示，已在`adapters/local-service/public.html`实施。流程为带编号的上传、3–5条普通语言说明、确认提交；说明框可换行，3条时不显示无效删除按钮。移除普通访客连接语法解析，不生成隐藏的结构化答案。服务端兼容旧record_checks，模型/判断/原运行均不变。

结果默认展示各自真实A/B摘要，提取明细可展开；引用默认展开（存在引用时），重复的规则说明和裁判解释折叠，明确待核验不代表图失败。移除0/N文本，不以别的分数代替；图审计、覆盖和模型版本在默认折叠的Technical checks and coverage中，JSON仍保留原字段。重建缺口仍在主结果提示，不掩盖失败。历史回放通过原postMessage分支使用同一展示。

首次受控手机验证发现极小图像令弹窗缩到关闭按钮以下，导致按钮不能点击；修复弹窗最小宽度、关闭按钮正常文档流/粘性定位，最终包含极小图关闭测试通过。首轮失败证据保留，不覆盖。

## Verification

- `npm run validate`：最终退出码0；typecheck、lint、22文件143测试和生产构建通过。
- `node scripts/t21-visitor-flow.mjs --label T21-visitor-flow-final`：17/17，0 page errors；纯文字单次提交、3–5条增删、主结果无覆盖比例、A/B摘要、技术折叠、重建警告、手机无溢出与关图、新检查重置、可信父页历史回放、新旧coverage均覆盖。全部controlled stub，0模型调用，不作为模型准确率证据。
- `node scripts/t20-ui-smoke.mjs --label T21-compatibility-ui-v1`：6/6，旧显式检查报告兼容；T20脚本已改用当前UI入口和展开技术详情。
- `node scripts/t20-site-smoke.mjs --label T21-deployed-visitor-v1`：真实公开站iframe加载新表单，0连接编辑器、3普通说明框、0page errors；无新图提交/模型调用，不称真实推理全链路测试。

证据均在`artifacts/validation/T21-*`；截图仅含合成受控输入，不含用户私图。

## Service and limits

更新前worker active=false、waiting=0；先暂停再复核空闲，验证监听进程为本项目server.ts后重启访客worker，随后恢复此前接单偏好。未取消运行；重启清空内存中的会话和限额计数，浏览器已保存报告和磁盘私有运行保留。最后本机与实际公网页面确认新HTML生效。仅worker界面更新，Sites父页源代码与v7部署未变；无需重部署静态站。用户需刷新已有标签页后看到新表单。

本轮只改交互和展示，不宣称小模型读图、自然语言核验或重建正确性提高；原固定协议8/12未更改。没有新增真实模型运行，未发社交帖或提交比赛。
