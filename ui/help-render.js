import en from '../docs/help/en.md';
import zh from '../docs/help/zh.md';
import ja from '../docs/help/ja.md';
import ru from '../docs/help/ru.md';
import ar from '../docs/help/ar.md';
import { resolveLocale } from './locales.js';
import { renderHelp } from './help-view.js';

const guides = { en, zh, ja, ru, ar };
export function render(ctx = {}) {
  const locale = resolveLocale(ctx.props?.locale || ctx.locale);
  return renderHelp(guides[locale], locale);
}
