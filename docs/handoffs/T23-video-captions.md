# T23 · User-recorded video captions · 2026-10-23

玉米自行录制了238.666633秒、2560×1528/30fps、1条音轨的MP4（约493.8MB），要求字幕整理实际表达、去口吃而非逐字复述。

本机任务隔离环境使用现有uv/已安装Python3.12，局部安装imageio-ffmpeg0.6.0、faster-whisper1.2.1等；没有全局安装/系统设置改动。公开base.en模型在CPU本地转写，视频/音轨未发往第三方。中间件/模型/原始转写在忽略的runs/video-caption-20261023/scratch，不进Git。初次转写遇PyAV19解码参数不兼容，改用标准库读取已提取PCM数组后走Whisper支持的numpy输入路径，未跳过识别。

成品在忽略的artifacts/private/T23-video-caption：

- figure-relay-captioned.mp4：37条英文硬字幕，1920×1266/30fps H.264/AAC，238.666667秒，17698621 bytes。完整画面缩放并在底部增加黑边放字幕，不遮挡原网页；保留原声和时长，不剪口吃或画面。
- figure-relay.en.srt / .vtt / .ass：可另导入平台/编辑器。
- figure-relay-clean-script.txt：实际旁白的清晰英文整理，非逐字转录。
- validation.json、preview-14/140/209/233.png：成品全段解码通过、1音轨、时长差<0.15秒且<240秒，关键帧已检查；字幕含A/B解释、历史回放、主机接单/排队和GitHub说明。37条时间有序无重叠且不越界。

原MP4未写入/覆盖；私人视频、字幕全文和截图均未进公开仓库，未上传视频、发帖或提交比赛。提交检查表/帖子草稿/讲稿状态已同步“视频完成、待上传”。GitHub只同步这些非敏感状态文档。

发布参考：Bluesky官方账号2026-08-25公告现可传最长10分钟/300MB视频，当前成品符合该限制（https://bsky.app/profile/bsky.app/post/3mtwf7gxkwc2r）。仍须用户实际上传等待处理并发布，随后用未登录窗口核验最终帖子URL，再填比赛表单。
