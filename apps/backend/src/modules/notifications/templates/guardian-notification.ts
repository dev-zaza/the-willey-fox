// ─── Guardian Request (sent to QR owner) ────────────────────────────────────

function unsubscribeFooter(unsubscribeUrl?: string): string {
  if (!unsubscribeUrl) return '';
  return `
    <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px;">
      You're receiving this because you have an account with TheWileyfox.<br>
      <a href="${unsubscribeUrl}" style="color:#f97316;">Unsubscribe from email notifications</a>
    </p>
  `;
}

interface GuardianRequestData {
  requesterName: string;
  itemName: string;
  itemCategory: string;
  approvalUrl: string;
  unsubscribeUrl?: string;
}

export function buildGuardianRequestEmail(data: GuardianRequestData) {
  const subject = `TheWileyfox: ${data.requesterName} wants to be a guardian of "${data.itemName}"`;
  const body = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;">
      <div style="background:#ffffff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">New Guardian Request</h2>
        <p style="color:#374151;font-size:15px;margin:0 0 16px;">
          <strong>${data.requesterName}</strong> has requested to become a guardian of your
          ${data.itemCategory} <strong>"${data.itemName}"</strong>.
        </p>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">
          Guardians receive notifications when your item is found and can respond to finders on your behalf.
        </p>
        <div style="text-align:center;">
          <a href="${data.approvalUrl}" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">
            Review Request
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
          If you don't know this person, you can safely ignore this email.
        </p>
        ${unsubscribeFooter(data.unsubscribeUrl)}
      </div>
    </div>
  `.trim();
  return { subject, body };
}

export function buildGuardianRequestSms(data: GuardianRequestData) {
  const body = `TheWileyfox: ${data.requesterName} wants to guard "${data.itemName}". Review: ${data.approvalUrl}`;
  return { body: body.substring(0, 160) };
}

export function buildGuardianRequestPush(data: GuardianRequestData) {
  return {
    subject: 'New guardian request',
    body: `${data.requesterName} wants to be a guardian of "${data.itemName}". Tap to review.`,
  };
}

// ─── Guardian Approved (sent to the new guardian) ───────────────────────────

interface GuardianApprovedData {
  ownerName: string;
  itemName: string;
  itemCategory: string;
  itemUrl: string;
  unsubscribeUrl?: string;
}

export function buildGuardianApprovedEmail(data: GuardianApprovedData) {
  const subject = `TheWileyfox: You are now a guardian of "${data.itemName}"`;
  const body = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;">
      <div style="background:#ffffff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#2563eb;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px;color:#fff;">★</div>
        </div>
        <h2 style="margin:0 0 16px;font-size:20px;color:#111827;text-align:center;">You're now a guardian!</h2>
        <p style="color:#374151;font-size:15px;margin:0 0 24px;text-align:center;">
          <strong>${data.ownerName}</strong> approved your request to guard their
          ${data.itemCategory} <strong>"${data.itemName}"</strong>.
        </p>
        <div style="text-align:center;">
          <a href="${data.itemUrl}" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">
            View Item
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
          You'll receive alerts if this item is reported found. You can respond to finders on the owner's behalf.
        </p>
        ${unsubscribeFooter(data.unsubscribeUrl)}
      </div>
    </div>
  `.trim();
  return { subject, body };
}

export function buildGuardianApprovedSms(data: GuardianApprovedData) {
  const body = `TheWileyfox: ${data.ownerName} approved you as guardian of "${data.itemName}". View: ${data.itemUrl}`;
  return { body: body.substring(0, 160) };
}

export function buildGuardianApprovedPush(data: GuardianApprovedData) {
  return {
    subject: 'Guardian request approved',
    body: `${data.ownerName} approved you as guardian of "${data.itemName}". Tap to view.`,
  };
}

// ─── Guardian Removed (sent to the removed guardian) ────────────────────────

interface GuardianRemovedData {
  itemName: string;
  itemCategory: string;
  removedBy: string;
  unsubscribeUrl?: string;
}

export function buildGuardianRemovedEmail(data: GuardianRemovedData) {
  const subject = `TheWileyfox: You have been removed as guardian of "${data.itemName}"`;
  const body = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;">
      <div style="background:#ffffff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Guardian access removed</h2>
        <p style="color:#374151;font-size:15px;margin:0 0 16px;">
          You have been removed as a guardian of the ${data.itemCategory}
          <strong>"${data.itemName}"</strong> by <strong>${data.removedBy}</strong>.
        </p>
        <p style="color:#6b7280;font-size:14px;margin:0;">
          You will no longer receive notifications for this item.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
          If you believe this was done in error, please contact the item owner.
        </p>
        ${unsubscribeFooter(data.unsubscribeUrl)}
      </div>
    </div>
  `.trim();
  return { subject, body };
}

export function buildGuardianRemovedSms(data: GuardianRemovedData) {
  const body = `TheWileyfox: You've been removed as guardian of "${data.itemName}" by ${data.removedBy}.`;
  return { body: body.substring(0, 160) };
}

export function buildGuardianRemovedPush(data: GuardianRemovedData) {
  return {
    subject: 'Guardian access removed',
    body: `You are no longer a guardian of "${data.itemName}".`,
  };
}

// ─── Guardian Rejected (sent to the requester) ──────────────────────────────

interface GuardianRejectedData {
  itemName: string;
  itemCategory: string;
  unsubscribeUrl?: string;
}

export function buildGuardianRejectedEmail(data: GuardianRejectedData) {
  const subject = `TheWileyfox: Your guardian request for "${data.itemName}" was not approved`;
  const body = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;">
      <div style="background:#ffffff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Guardian Request Not Approved</h2>
        <p style="color:#374151;font-size:15px;margin:0 0 16px;">
          Your request to become a guardian of the ${data.itemCategory}
          <strong>"${data.itemName}"</strong> was not approved by the owner.
        </p>
        <p style="color:#6b7280;font-size:14px;margin:0;">
          You will not receive notifications for this item.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
          If you believe this was done in error, please contact the item owner directly.
        </p>
        ${unsubscribeFooter(data.unsubscribeUrl)}
      </div>
    </div>
  `.trim();
  return { subject, body };
}

export function buildGuardianRejectedPush(data: GuardianRejectedData) {
  return {
    subject: 'Guardian Request Declined',
    body: `Your request to guard "${data.itemName}" was not approved.`,
  };
}

// ─── Guardian Invite (sent to invited email) ─────────────────────────────────

interface GuardianInviteData {
  inviterName: string;
  itemName: string;
  itemCategory: string;
  acceptUrl: string;
  expiresAt: Date;
  unsubscribeUrl?: string;
}

export function buildGuardianInviteEmail(data: GuardianInviteData) {
  const subject = `TheWileyfox: ${data.inviterName} invited you to be a guardian of "${data.itemName}"`;
  const expiryStr = data.expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const body = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;">
      <div style="background:#ffffff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">You've been invited to be a guardian!</h2>
        <p style="color:#374151;font-size:15px;margin:0 0 16px;">
          <strong>${data.inviterName}</strong> has invited you to become a guardian of their
          ${data.itemCategory} <strong>"${data.itemName}"</strong>.
        </p>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">
          Guardians receive notifications when an item is found and can help coordinate its return.
          This invitation expires on <strong>${expiryStr}</strong>.
        </p>
        <div style="text-align:center;">
          <a href="${data.acceptUrl}" style="display:inline-block;padding:12px 28px;background:#f97316;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">
            Accept Invitation
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
          If you don't know ${data.inviterName}, you can safely ignore this email.
        </p>
        ${data.unsubscribeUrl ? unsubscribeFooter(data.unsubscribeUrl) : ''}
      </div>
    </div>
  `.trim();
  return { subject, body };
}
