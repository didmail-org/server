import { render as nativeRender } from '../blocklet/.web/components/didmail-admin/render.js';
import { adminTranslator } from './admin-i18n.js';
export function render(ctx) { return nativeRender({...ctx, t: ctx.t || adminTranslator(ctx.props?.locale)}); }
