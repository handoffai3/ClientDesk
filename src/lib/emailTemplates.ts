export function brandedEmail({
  agency_name,
  agency_logo_url,
  agency_primary_color,
  body_html,
  cta_text,
  cta_url,
}: {
  agency_name: string;
  agency_logo_url?: string | null;
  agency_primary_color?: string;
  body_html: string;
  cta_text?: string;
  cta_url?: string;
}): string {
  const color = agency_primary_color || '#7C3AED';

  const logoBlock = agency_logo_url
    ? `<tr><td align="center" style="padding: 32px 0 16px;">
        <img src="${agency_logo_url}" alt="${agency_name}" width="120" style="max-width:120px;height:auto;display:block;" />
      </td></tr>`
    : `<tr><td align="center" style="padding: 32px 0 16px;">
        <span style="font-size:24px;font-weight:700;color:${color};">${agency_name}</span>
      </td></tr>`;

  const ctaBlock =
    cta_text && cta_url
      ? `<tr><td align="center" style="padding: 24px 0 8px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="border-radius:8px;background-color:${color};">
                <a href="${cta_url}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${cta_text}</a>
              </td>
            </tr>
          </table>
        </td></tr>`
      : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${agency_name}</title>
  <!--[if mso]><style>table,td{font-family:Arial,sans-serif;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          ${logoBlock}
          <tr>
            <td style="padding:0 32px 24px;font-size:15px;line-height:1.6;color:#374151;">
              ${body_html}
            </td>
          </tr>
          ${ctaBlock}
          <tr>
            <td style="padding:24px 32px 32px;border-top:1px solid #e5e7eb;text-align:center;">
              <span style="font-size:12px;color:#9ca3af;">Sent via ${agency_name}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendBrandedEmail({
  to,
  subject,
  body_html,
  cta_text,
  cta_url,
  agency_id,
  agency_name,
  agency_logo_url,
  agency_primary_color,
  reply_to,
}: {
  to: string;
  subject: string;
  body_html: string;
  cta_text?: string;
  cta_url?: string;
  agency_id: string;
  agency_name: string;
  agency_logo_url?: string | null;
  agency_primary_color?: string;
  reply_to?: string;
}): Promise<void> {
  const html = brandedEmail({ agency_name, agency_logo_url, agency_primary_color, body_html, cta_text, cta_url });
  try {
    const { apiFetch } = await import('./apiFetch');
    await apiFetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html }),
    });
  } catch {
    // Email send is best-effort; don't block the UI flow
  }
}
