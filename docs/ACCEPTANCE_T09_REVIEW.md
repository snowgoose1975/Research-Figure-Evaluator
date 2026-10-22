# T09 独立复验 · 2026-10-22

结论：F1–F4 的四个原始反例均已修复，T09有明确进展；扩展检查仍发现两项 P2 边界，因此不能把数值范围与双侧覆盖能力完整关闭。已通过部分保留，不退回整套修复。

本次未修改产品代码、旧运行或原自测产物，未调用真实模型、未发布。独立证据均使用 Codex-T09 前缀。

## 四个原始反例

| 项 | 本次独立结果 |
|---|---|
| F1 带 semantic 的科学规则优先 | 规则B=contradicted，semantic=retained，最终仍contradicted；原绕过已修复 |
| F2 A同名面板 | matched_plots=0，无confirmed；代码同时检查两侧分组，已有单测覆盖B重名和双侧重名 |
| F3 0与0.05 | 新检查点对真实A判contradicted；旧过宽容差判uncertain |
| F4 input-only usage | 保留prompt_tokens:7，usage_complete=false；未补输出0 |

证据：`artifacts/validation/Codex-T09-review-probes.json`，含被测代码SHA-256。

## 尚需修复的两项边界

### N1 · P2：固定绝对 epsilon 会吞掉小量级科学差异

位置：`src/lib/evaluation/scientific.ts:274,276`。

比较条件仍为 `abs(value-expected) > value_tolerance + 1e-9`。这个额外1e-9带有物理单位，可能远大于作者明确给出的容差。新tolerance_basis与宽容差门槛不能阻止它。

独立合法synthetic用例：

- 系列：Reference current，单位A，线性轴0到1e-9；
- 期望电流1e-10 A，明确值容差和平坦性容差均1e-12 A；
- 实际两点均为0；
- 当前判定：retained。

实际差异是值容差的100倍，且整个参考电流被丢失；它不能成为完整保留。该用例通过MemorySchema，不涉及真人数据、图片读数或模型调用。

同类量级依赖也存在于 `plotFlatnessTolerance` 的1e-9下限、`numericEqualityTolerance` 的max(1,...)，以及expected_y的固定1e-12零判门槛。这些数值常量不能兼任有单位的科学误差依据。

最小修复要求：区分明确科学容差与机器浮点误差；后者根据实际运算量级估算，不能增加固定有单位的宽容区间。补“同一物理量在不同单位/尺度表达下判定不变”的回归，覆盖小量级、0以及原0.05案例。不要只针对1e-10这个数字增加特判。

T09新0.005/0.002阈值与1%面板跨度目前属于固定启发式；tolerance_basis文字本身不等于实验校准。其效果仍属于后续产品验证范围，不据此宣称跨图类型的读数精度已成立。

### N2 · P2：A无plot、B新增plot时，未匹配B信息被清空

位置：`src/lib/evaluation/scientific.ts:199`。

只有A和B两边均有plot才进入auditPlots。否则fallback只整理A内容，unmatchedBPlots/unmatchedBSeries直接设为空。

独立用例：A有一条合法fact、没有plot；B有一个面板及一条系列。结果b_plots=1，但unmatched_b_plots=[]、unmatched_b_series=[]。这使双侧覆盖披露遗漏了全部新增B图形内容。

最小修复要求：在只有一侧有plot时分别列出该侧全部未匹配面板/系列；双方无plot则为空；无法对齐仍保持未执行/待复核，不能把新增项直接称作已证实幻觉。补A-only、B-only、both-empty三类回归。

## T08证据覆盖事件

披露与现存文件一致：当前T08-audit-stub-v2汇总引用的是1792634397291-60381724与1792634398032-6fb24c30；原始T08私有运行1792629726115-43ba30b6与1792629726849-ace8a605仍在。原汇总/复制JSONL的历史版本没有保留。

因此当前T08同名文件只能作为T09时点的复跑产物；旧私有日志仍能支持部分历史核查，不能据它们把重建的汇总冒充原文件。本次没有发现其他明确的未披露覆盖，但现存工作树不能证明所有历史文件从未变化。

防复发要求：`scripts/t08-audit-stub.ts:8–10,149–151`仍硬编码T08输出并直接覆盖，必须给生成脚本增加独立输出标签/路径与已有文件保护。默认创建应使用不覆盖模式；复跑使用新名字。该修复不需要删除、恢复或重写任何历史文件。若另行生成旧日志摘要，须明确标为后来派生，保留来源哈希。

## 独立验证

- `npm run validate` exit0：10文件64测试、类型、lint、生产构建通过。
- Edge只读9项通过：旧run深链接、轴/系列覆盖分行、几何/置信带未覆盖提示、无undefined、Markdown分行、390px无页面横向溢出、无未捕获页面错误。未重跑会覆盖T08/T09证据的现有脚本。
- T09一页说明的源哈希和字节数与记录一致；从实际PDF独立渲染，文字完整、未见裁切/重叠。新预览为`artifacts/validation/Codex-T09-writeup-page.png`。
- 原8/12、标签级4/4和真实运行未修改；本次反例不计入模型能力成功率。

## 下一批范围

只需收尾N1、N2和证据输出防覆盖，保留已经通过的F1/F2/F4修复；不再重跑整批真实模型实验，不引入新框架或扩大任务类型。完成这几项后，应进入PRODUCT_REVIEW提出的真实图修改对照与方法增益验证。

最终成品仍缺真实改图收益案例、往返与直接检查对照、文字旁路验证和视频。人工visual_review保持not_reviewed。推送、公开发布和比赛提交继续需要玉米授权。
