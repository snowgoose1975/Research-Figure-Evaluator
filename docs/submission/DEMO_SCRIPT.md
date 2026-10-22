# Video narration · user recording · 2026-10-23

玉米自行录屏和配音。以下约2分半至3分钟；方括号是操作提示，不念。没有启动自动录制。旧T19无声演示仍保留，但不是当前界面的新视频。最终录制文件/公开URL尚未收到。

## Script

[Show the homepage]

Hi, this is Figure Relay, a tool for exploring how AI readers interpret scientific figures.

When researchers create a figure, they already know what it is supposed to mean. But readers may interpret it differently, and the author may never notice that gap.

Figure Relay makes an AI reader’s interpretation visible, so authors can inspect what was captured, missed, or changed.

[Open Check my figure]

To use it, upload a figure and write three to five messages you want readers to understand. No special formatting is required.

[Explain the reading and reconstruction process]

Here is how it works.

Reader A sees only the original figure and saves structured notes about what it understands. The system then reconstructs a new image using only those notes.

Reader B sees only the reconstructed image, in a separate request.

Neither reader receives the author’s intended messages. We compare their saved readings with those messages afterward, so users can inspect possible misunderstandings and changes along the way.

A difference does not automatically mean the original figure is unclear—it could also come from the model or the reconstruction.

[Open a recorded case, showing its original, reconstruction, and report]

Here are recorded examples using figures from published research papers. These are historical runs, rather than live analyses.

You can compare the original figure with the reconstruction, inspect what each reader actually recorded, and review the evidence behind each assessment.

The goal is to support your review, rather than give your figure a single quality score.

[Show Saved checks]

For your own completed checks, reports are saved in this browser. You can reopen them through Saved checks without running the analysis again.

[Show the actual service status]

The online trial currently runs on my own computer using a small local vision-language model.

It can miss important details and make mistakes, especially with complex connections and layouts. Its results need human review.

I plan to keep the host online for about two days after submission. Please check the service status before uploading. Green means the service is currently accepting requests; processing may still take time or involve a queue.

[Show the GitHub repository]

The source code is public. You can run it locally and configure a supported model endpoint, including a more powerful model if you have access to one.

This is an early prototype. The next step is to test whether its feedback actually helps researchers improve their figures.

Thank you for watching.

## Recording checks

- Show recorded cases as historical replays. If showing a current result, identify it as a saved completed check; do not stage a success as live inference.
- Show the actual online/busy/offline state. Green is admission availability, not a completion guarantee.
- Avoid private desktop content, credentials, user images without publication permission, and internal audit details.
- Use the current WRITEUP.md for the submission form. Old PDFs and the T19 video have their own historical versions.
- No social publishing, video upload, or competition submission has been performed by this script preparation.
