function unsubscribeFooter(unsubscribeUrl?: string): string {
  if (!unsubscribeUrl) return '';
  return `
    <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px;">
      You're receiving this because you have an account with TheWileyfox.<br>
      <a href="${unsubscribeUrl}" style="color:#f97316;">Unsubscribe from email notifications</a>
    </p>
  `;
}

interface ReportNotificationData {
  itemName: string;
  itemCategory: string;
  locationAddress?: string;
  finderNotes?: string;
  reportTime: Date;
  portalUrl: string;
  unsubscribeUrl?: string;
}

export function buildEmailNotification(data: ReportNotificationData) {
  const subject = `TheWileyfox Alert: Someone found your ${data.itemCategory} "${data.itemName}"`;

  const locationRow = data.locationAddress
    ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Location</td><td style="padding:4px 0;font-size:14px;">${data.locationAddress}</td></tr>`
    : '';
  const notesRow = data.finderNotes
    ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;vertical-align:top;">Notes</td><td style="padding:4px 0;font-size:14px;">${data.finderNotes}</td></tr>`
    : '';

  const body = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;">
      <div style="background:#ffffff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#16a34a;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px;color:#fff;">✓</div>
        </div>
        <h2 style="margin:0 0 8px;font-size:22px;color:#111827;text-align:center;">Good news — item found!</h2>
        <p style="margin:0 0 24px;color:#6b7280;text-align:center;font-size:15px;">
          Someone has reported finding your ${data.itemCategory} <strong>"${data.itemName}"</strong>.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Time</td><td style="padding:4px 0;font-size:14px;">${data.reportTime.toLocaleString()}</td></tr>
          ${locationRow}
          ${notesRow}
        </table>
        <div style="text-align:center;">
          <a href="${data.portalUrl}" style="display:inline-block;padding:12px 28px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">
            View Details &amp; Respond
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
          You received this alert because you own or are a guardian of this TheWileyfox item.
        </p>
        ${unsubscribeFooter(data.unsubscribeUrl)}
      </div>
    </div>
  `.trim();

  return { subject, body };
}

export function buildSmsNotification(data: ReportNotificationData) {
  const location = data.locationAddress ? ` Location: ${data.locationAddress}.` : '';
  const body = `TheWileyfox Alert: Someone found "${data.itemName}"!${location} View: ${data.portalUrl}`;
  return { body: body.substring(0, 160) };
}

export function buildPushNotification(data: ReportNotificationData) {
  const subject = `"${data.itemName}" has been found!`;
  const body = data.locationAddress
    ? `Someone reported finding your ${data.itemCategory} near ${data.locationAddress}.`
    : `Someone reported finding your ${data.itemCategory}. Tap to view details.`;

  return { subject, body };
}
