export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export type SmsProviderType = 'twilio' | 'vonage' | 'sns' | 'console';
