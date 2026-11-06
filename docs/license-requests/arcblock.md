# ArcBlock license clarification request

Status: correspondence template aligned with the current native ARC
[distribution audit](../distribution-license-audit.md). Historical release
investigations remain evidence, not a maintainer reply or distribution grant.
The requested Chinese message is retained below.

Subject: 请求核实 DIDMail 原生 ARC 包中 OCAP 依赖及 ARC 生成资源的许可与再分发材料

## Message

ArcBlock 团队你好，

本邮件由 AI 根据 DIDMail 已记录的源码、npm 包及构建产物审计证据整理；需要维护者确认的事项仍属待核实内容。

我们正在完成 [DIDMail Server](https://github.com/didmail-org/server) 原生 ARC Blocklet 的分发许可审计。项目自有源码采用 Apache-2.0；这不替代第三方授权。独立 Workers 运行方式已经退役。当前原生依赖资产清单包含以下版本，其缺失许可材料仍阻止包发布。

**1. `@ocap/util@1.30.24` 与 `@ocap/proto@1.30.24`——当前原生包发布阻塞**

两个版本均已进入原生包的 vendor inventory，均缺少已收集的完整许可文本，不能沿用旧构建中“proto 不在产物内”的结论。现有调查记录为：

- 官方 npm metadata 声明 Apache-2.0，但包内未发现完整 LICENSE/NOTICE。
- util 的 npm `gitHead` 为 `e074a74510ab4386bc3cbff27003ae1f14548f39`；proto 为 `87990c8b5e215107fc587c1ced0d6b3e2cd2483e`。
- 包指向 `ArcBlock/blockchain`；历史调查中，仓库 API 和固定提交的原始许可文件在当时访问条件下返回 404。现有材料不足以证明具体版本的完整授权和嵌入代码来源。

请分别提供明确适用于这两个 npm 版本的完整原始许可、准确版权声明、应随再分发保留的 NOTICE/attribution，以及随包预打包、复制或嵌入代码的来源、版本和适用条款。若无独立 NOTICE 或额外分发要求，也请明确确认。材料可以是固定版本官方源码/发行附件，或具备授权权限主体的书面确认；我们不会根据 SPDX 字段自行补写授权。

**2. ARC `2.0.0-beta.74 (49c9125c)` 生成资源——当前原生包发布阻塞**

ARC 导出的 `.web-cache/` 包含公共 widget/runtime 脚本及模板资源，超出 npm 依赖清单本身。我们尚未收集到足以确认该版本输出代码再分发条件的完整许可及嵌入第三方 notices；ARC CLI 二进制本身不随 DIDMail 包分发。

请提供适用于该版本导出 JS、CSS 和模板的许可或输出物条款，明确覆盖它们随原生 Blocklet 包分发的场景，以及应保留的版权、attribution、NOTICE 和嵌入第三方依赖清单。

页面还引用由 ARC 主机提供的 `/__blocklet__.js` 与 `/aup-core.*.css`。如需离线复制这些资源，请提供官方可验证原文件、哈希和离线分发条件。我们尚未把历史某次缓存的资源哈希当作当前完整产物。每次构建的实际文件均依其 manifest 核验，并保留完整独立审计记录。

**3. 其他许可归属澄清**

- `@arcblock/validator@1.19.15` 的 metadata 声明 MIT，但官方 tarball 的 LICENSE 是 ArcBlock Apache-2.0 notice。我们保留了该原文及 Apache 条款，请确认具体版本的适用许可和声明。
- `@arcblock/ws@1.30.24` 的历史许可材料缺口仍可补档，但当前加载器使用包内适配器；不要把它与已进入原生清单的 proto 混为同一范围。

收到材料后，我们仍需核对原始授权、嵌入代码与最终产物，不能仅凭声明立即发布。`interface@1.2.1` 和 `utf8@3.0.0` 的文本缺口等独立门槛仍保留。

供参考：

- [当前分发审计与缺失材料](https://github.com/didmail-org/server/blob/main/docs/distribution-license-audit.md)
- [官方 npm 版本、gitHead、tarball 及完整性证据](https://github.com/didmail-org/server/blob/main/docs/license-source-evidence.json)
- [当前原生包依赖和许可证据](https://github.com/didmail-org/server/blob/main/docs/distribution-dependency-evidence.json)

感谢协助。
