# T01 模型 HTTP 适配器交接

## 任务

- 分类：体力实现
- 合同版本：`docs/IMPLEMENTATION.md`，schema `0.2.0`，prompt `reader-0.2.0`
- 文件所有权：`src/lib/model/index.ts`、`tests/model.test.ts`、本文件

## 交付

- 实现 OpenAI-compatible Responses 与 chat-completions 两种显式 HTTP 协议；按 `protocol` 拼接端点，不做协议回退。
- 实现 `readOriginal`、`readReconstruction`、`judgeKeypoints`、`directCheck`，所有调用使用独立 user 请求。
- reader 请求只序列化输入图像和冻结 reader prompt；judge 才收到 K/A/B；direct baseline 收到原图与 K。
- 响应按 Zod JSON Schema 和应用 schema 校验；reader 另用 `MemorySchema` 检查引用、ID、bbox 与坐标语义。
- 408、429、5xx 与网络/超时最多总计 3 次尝试，带短退避。认证和其他 HTTP 错误不重试。错误消息不带服务器响应正文或密钥。
- 返回 request ID、模型、usage、latency、attempts 和 prompt 版本元数据。空 apiKey 时不发送 Authorization。

## 验证

- `npm test -- --run tests/model.test.ts`：5 项通过。
- `npx eslint src/lib/model/index.ts tests/model.test.ts`：无错误；已清除适配器和测试中的 `any`。
- `npm run typecheck`：未通过，错误均指向并发修改的 `src/app/page.tsx:122-123` 语法问题；模型适配器未报告类型错误。
- `git diff --check`：通过。
- 真实联网/API 验证：未执行；没有服务端配置或经授权的真实模型调用。

## 未解决问题与限制

- Responses 和 chat 的结构化输出依赖服务端兼容 OpenAI 的 JSON Schema 子集。兼容性需在选定本地服务与具体模型后做 smoke 验证；失败会显式返回错误，不回退为普通文本/演示。
- `ModelConfig.apiKey` 仍按冻结 schema 为必填字符串；本地无鉴权服务传空字符串即可。
- 无可清理临时文件。

## 下一步

- 集成人完成根工程后执行 `npm test`、`npm run typecheck`。
- 选定服务后由配置负责人做一次受控真实 smoke，并核对 usage/request ID 与服务实现兼容性。
