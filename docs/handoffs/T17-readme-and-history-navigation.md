# T17 — README 与访客历史入口

日期：2026-10-22

## 交付

- 将根目录 README 改写为面向评审者和新用户的英文项目说明，先介绍产品目标、操作流程和公开体验，再说明实测证据、限制、本地运行及项目文档。移除了内部任务编号、模型调参日志和对话式接续内容。
- 公开首页新增 `Saved checks` 导航按钮，直达访客工作区中保存在当前浏览器的检查记录。新增按钮仅在公开 demo build 中显示；小屏幕隐藏“View cases”以留出导航空间。
- 访客历史属于当前浏览器和站点 origin 的 IndexedDB；不会与账号、主机的本地历史或其他设备同步。

## 验证

- `npm run validate`：通过，typecheck、lint、19 个测试文件 / 125 项测试、生产构建均成功。
- `node scripts/build-public-demo.mjs --label T16-saved-checks-nav-v1`：成功，生成 `artifacts/web-preview/T16-saved-checks-nav-v1/`。
- Sites version 5 已部署到 https://figure-relay.chicchair5.chatgpt.site 。主页和新脚本 HTTP 200；脚本含 `Saved checks` 与 `Your figure checks`。
- 等待浏览器 hydration 后，Playwright 点击 `Saved checks` 并确认访客历史面板出现；无页面错误。初次检查早于 hydration，等待 `networkidle` 后复验通过。

## 发布记录与边界

- Sites 源码提交：`532edee9efef6a795ad15431308b7e2e1bed4258`
- Sites version：`appgver_2df185a2a1348191b142ce092821a85e`
- 部署：`appgdep_6ada1cc939508191a7787d6280c28926`
- 根 GitHub 仓库改动与本交接一并进入 `main`，提交记录可在仓库历史查看。
- 新的 Saved checks 入口访问浏览器本地已保存记录，不证明新的公网模型请求成功。实际 live worker 隧道曾出现 502，真实公网传输闭环仍待单独验证。
- 公开示例和新分析的可用性依赖主机在线并主动接单；不承诺持续在线。比赛帖子与最终比赛提交未执行。
