# ArcBlock license clarification request

Status: maintained correspondence template based on the 2026-11-04 [distribution audit](../distribution-license-audit.md). The requested Chinese message is preserved below; engineering audit documentation remains in English. This template does not record delivery or a maintainer response, and does not change release decisions.

Subject: 请求核实 DIDMail 使用的 OCAP 包及 ARC 生成资源的许可与再分发材料

## Message

ArcBlock 团队你好，

本邮件由 AI 根据 DIDMail 已记录的源码、npm 包及构建产物审计证据整理；需要维护者确认的事项仍属待核实内容。

我们正在完成 [DIDMail Server](https://github.com/didmail-org/server) 的 Worker 和 Blocklet 构建产物许可审计。项目源码采用 Apache-2.0，构建产物尚未发布。根据 2026-11-04 的审计结果，想请你们协助提供以下版本对应的权威材料。

**1. `@ocap/util@1.30.24`——当前 Worker 发布阻塞**

我们已核实：

- 官方 npm tarball 通过 registry 声明的完整性校验。
- 包内 manifest 声明 `Apache-2.0`，但未发现独立 LICENSE 或 NOTICE。
- npm 记录的 `gitHead` 为 `e074a74510ab4386bc3cbff27003ae1f14548f39`。
- 包指向 `ArcBlock/blockchain`；仓库 API 和固定提交的原始许可文件地址，在我们当前访问条件下均返回 404。
- 官方文档介绍了该库，但未提供这个版本完整的许可、版权及嵌入代码 notice。
- 该版本确实向生产 Worker 输出贡献代码。

请协助提供：

- 明确适用于这个 npm 发行版本的完整许可正文及准确版权声明。
- 应随再分发产物保留的 NOTICE、attribution 和其他第三方声明；如果没有独立 NOTICE，请明确确认。
- 包内预打包、复制或嵌入代码的来源、版本及适用许可，或能够核实这些信息的官方源码／发行材料。
- 如仍适用 Apache-2.0，请确认该许可覆盖此发行版本及其随包代码，并说明有无额外分发要求。

材料可以是固定版本的官方链接、发行附件，或由具备授权权限的主体作出的书面确认。我们希望保留原始文本，而不是根据 SPDX 字段自行补写。

**2. ARC `2.0.0-beta.74 (49c9125c)` 生成资源——当前 Worker 和 Blocklet 共同阻塞**

该版本 ARC 导出的静态产物包含公共 widget/runtime 脚本，其中一个实际文件的 SHA-256 为：

```text
5a32d5b3e49f0833e03c16f43a73fb5b24160deb1a6eaa561f8a84f48ab1aff8
```

该脚本包含 masonry/widget runtime，由 ARC 生成，位于我们的 npm 编译依赖清单之外。我们检查的官方 CLI 安装包、资源目录及公开文档，尚未提供足以确认这些输出资源再分发条件的许可和完整 notices。

此外，生成页面引用：

```text
/aup-core.d26223e73064f873.css
```

Blocklet 依赖 ARC 主机提供它；独立 Worker 的正常构建尚未包含对应文件。

请协助提供：

- 适用于该 ARC 版本导出 JS、CSS 和模板资源的许可或输出物再分发条款，明确覆盖作为独立 Worker 静态资源和 Blocklet 包内容进行分发的场景。
- 这些资源应携带的版权、attribution、NOTICE，以及内嵌第三方代码的许可清单；若无额外要求，请明确说明。
- 上述核心 CSS 对应的官方原文件或可验证获取方式、内容哈希及离线分发条件。

这部分材料用于解除两个产物的 ARC 输出资源授权阻塞；CSS 文件及许可核实后，我们还需实际打包并验证独立 Worker 的资源完整性。

**3. 可一并澄清的事项，不作为当前新增阻塞**

- `@ocap/proto@1.30.24`、`@arcblock/ws@1.30.24` 的官方 npm 包也声明 Apache-2.0，但未发现独立许可文本，并指向上述暂不可访问的仓库。这两个版本没有进入当前 Worker 或 Blocklet 产物；如有对应的官方许可／NOTICE 材料，也希望一并补档。
- `@arcblock/validator@1.19.15` 的 manifest 声明 MIT，但官方 tarball 中的 LICENSE 是 ArcBlock Apache-2.0 notice。我们已保留该原文及完整 Apache 条款，希望你们确认该版本的准确适用许可及应保留的声明。

收到材料后，我们会补齐原始许可和 attribution、核对最终产物并重新审计。`@ocap/util` 的材料只解除 Worker 的对应依赖阻塞；Worker 另有独立的 `interface@1.2.1` 许可问题正在向其维护者核实。

供参考：

- [完整审计报告](https://github.com/didmail-org/server/blob/main/docs/distribution-license-audit.md)
- [官方 npm 版本、gitHead、tarball 及完整性证据](https://github.com/didmail-org/server/blob/main/docs/license-source-evidence.json)
- [实际构建产物及文件哈希](https://github.com/didmail-org/server/blob/main/docs/distribution-artifact-evidence.json)

感谢协助。
