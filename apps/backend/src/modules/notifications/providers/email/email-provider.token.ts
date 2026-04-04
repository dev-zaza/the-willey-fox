export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export type EmailProviderType = 'smtp' | 'ses' | 'sendgrid' | 'console';
