import type { Lang } from '../shared/types.js';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface EmailMessage {
  to: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

export interface WaTemplateMessage {
  to: string;
  templateName: string;
  languageCode: string;
  parameters: string[];
}

export interface Channels {
  email(msg: EmailMessage, meta: Record<string, string>): Promise<void>;
  telegram(text: string, meta: Record<string, string>): Promise<void>;
  whatsapp(msg: WaTemplateMessage, meta: Record<string, string>): Promise<void>;
}

export type ChannelName = 'email' | 'telegram' | 'whatsapp_cloud';
export type Role = 'team' | 'customer';

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export type { Lang };
