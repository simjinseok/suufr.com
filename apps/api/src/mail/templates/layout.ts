import type { MailMessage } from '../mail.service';

const APP_NAME = '스프';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[ch] as string));
}

/** 공통 레이아웃. 본문 단락과 강조 블록(코드)만 받는다. */
export function renderMail(params: {
  to: string;
  subject: string;
  title: string;
  paragraphs: string[];
  highlight?: string;
  footer?: string;
}): MailMessage {
  const footer = params.footer ?? '본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.';
  const paragraphsHtml = params.paragraphs.map(p => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#374151">${escapeHtml(p)}</p>`).join('');
  const highlightHtml = params.highlight
    ? `<p style="margin:20px 0;padding:16px;text-align:center;font-size:28px;letter-spacing:6px;font-weight:700;color:#111827;background:#f3f4f6;border-radius:12px">${escapeHtml(params.highlight)}</p>`
    : '';

  const html = `<!doctype html><html lang="ko"><body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb">
  <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#6d28d9">${APP_NAME}</p>
  <h1 style="margin:0 0 16px;font-size:20px;color:#111827">${escapeHtml(params.title)}</h1>
  ${paragraphsHtml}
  ${highlightHtml}
  <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#9ca3af">${escapeHtml(footer)}</p>
</div></body></html>`;

  const text = [
    `[${APP_NAME}] ${params.title}`,
    '',
    ...params.paragraphs,
    ...(params.highlight ? ['', params.highlight, ''] : []),
    footer,
  ].join('\n');

  return { to: params.to, subject: `[${APP_NAME}] ${params.subject}`, html, text };
}
