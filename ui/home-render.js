import { render as nativeRender } from '../blocklet/.web/components/didmail-home/render.js';
import { messages } from './locales.js';
export function render(ctx = {}) { return nativeRender({...ctx, t: key => messages(ctx.props?.locale || ctx.locale)[key.replace(/^home\./, '')]}); }
