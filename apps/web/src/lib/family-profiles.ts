import { families, qrCodes, type QrCode } from '@/lib/api';
import { isQrLimitReached } from '@/lib/api-error';

export type FamilyProfileCategory = 'person' | 'pet';

export interface DraftFamilyProfile {
  name: string;
  relationship: string;
  category: FamilyProfileCategory;
}

export const FAMILY_PROFILE_LABELS: Record<FamilyProfileCategory, string> = {
  person: 'Person',
  pet: 'Pet',
};

export const ONBOARD_FAMILY_NAME_KEY = 'onboard_family_name';
export const ONBOARD_QR_PROFILES_KEY = 'onboard_qr_profiles';

export interface CreatedQrProfile {
  name: string;
  code: string;
}

export class FamilyProfileLimitError extends Error {
  created: QrCode[];

  constructor(created: QrCode[]) {
    super(
      created.length > 0
        ? `Created ${created.length} profile${created.length === 1 ? '' : 's'}. Your tag limit was reached before the rest could be added.`
        : 'Your tag limit was reached. Upgrade to add more QR profiles.',
    );
    this.name = 'FamilyProfileLimitError';
    this.created = created;
  }
}

/** Create a QR profile for each draft and attach it to the family. Kids/pets never get accounts. */
export async function createAndLinkFamilyProfiles(
  familyId: string,
  drafts: DraftFamilyProfile[],
): Promise<QrCode[]> {
  const created: QrCode[] = [];

  for (const draft of drafts) {
    try {
      const qr = await qrCodes.create({
        name: draft.name,
        label: draft.name,
        category: draft.category,
      });
      await families.addQrCode(familyId, qr.id);
      created.push(qr);
    } catch (err) {
      if (isQrLimitReached(err)) {
        throw new FamilyProfileLimitError(created);
      }
      throw err;
    }
  }

  return created;
}

export function toCreatedQrProfiles(qrs: QrCode[]): CreatedQrProfile[] {
  return qrs.map((qr) => ({ name: qr.name, code: qr.uniqueCode }));
}
