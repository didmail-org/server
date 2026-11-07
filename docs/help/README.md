# Server help authoring

[English](en.md) is the source guide. Translate it into [简体中文](zh.md), [العربية](ar.md), [日本語](ja.md) and [Русский](ru.md) only after updating the English version.

Keep the Markdown in sync with the `didmailHelpMarkdown` fields in `blocklet/.aup/locales/*.json`. The native package test checks all five copies. Each language must keep the same ordered anchor IDs, code blocks, configuration names, error codes and template placeholders. Translate prose and interface labels; do not translate API identifiers or invent additional capabilities.

The supported Markdown vocabulary is a leading title, anchored level-two sections, paragraphs, ordered/unordered lists, bold text, inline code, and `text`/`sh` code fences. Links are restricted to this help page, section anchors and the existing admin routes. Raw HTML is escaped; `<a id="section-id"></a>` supplies a validated section ID and is not rendered as raw HTML.

Run `node --test tests/ui/help.test.mjs` from `server/`, then `pnpm build` and `node scripts/browser-help.mjs`. With the ARC preview running, the isolated browser check reads its public core stylesheet and covers each language, navigation, keyboard focus, light/dark themes and Arabic RTL without issuing business mutations.
