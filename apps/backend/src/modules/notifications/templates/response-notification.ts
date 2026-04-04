function unsubscribeFooter(unsubscribeUrl?: string): string {
  if (!unsubscribeUrl) return '';
  return `
    <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px;">
      You're receiving this because you have an account with TheWileyfox.<br>
      <a href="${unsubscribeUrl}" style="color:#f97316;">Unsubscribe from email notifications</a>
    </p>
  `;
}

interface ReportResponseData {
  itemName: string;
  itemCategory: string;
  guardianName: string;
  responseMessage: string;
  conversationUrl: string;
  unsubscribeUrl?: string;
}

export function buildReportResponseEmail(data: ReportResponseData) {
  const subject = `TheWileyfox: ${data.guardianName} responded about your found "${data.itemName}"`;
  const body = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;">
      <div style="background:#ffffff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Someone replied about your report</h2>
        <p style="color:#374151;font-size:15px;margin:0 0 8px;">
          <strong>${data.guardianName}</strong> responded about the
          ${data.itemCategory} <strong>"${data.itemName}"</strong> you found:
        </p>
        <blockquote style="margin:16px 0;padding:12px 16px;background:#f3f4f6;border-left:4px solid #2563eb;border-radius:0 6px 6px 0;color:#374151;font-size:15px;">
          ${data.responseMessage}
        </blockquote>
        <div style="text-align:center;margin-top:24px;">
          <a href="${data.conversationUrl}" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">
            View Conversation
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
          Thank you for helping return this item to its owner.
        </p>
        ${unsubscribeFooter(data.unsubscribeUrl)}
      </div>
    </div>
  `.trim();
  return { subject, body };
}

export function buildReportResponseSms(data: ReportResponseData) {
  const body = `TheWileyfox: ${data.guardianName} replied about "${data.itemName}": "${data.responseMessage.substring(0, 80)}..." View: ${data.conversationUrl}`;
  return { body: body.substring(0, 160) };
}
