// src/types/index.ts
import type { 
  Customer, 
  Transaction, 
  CampaignTarget 
} from './campaign';

// Generic status types
export type Status = 'pending' | 'running' | 'completed' | 'failed';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed';

// Config types
export interface Config {
  cnpj: string;
  status: 'pending' | 'provisioning' | 'provisioned' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

// Message types
export interface Message {
  userId: string;
  phone: string;
  content: string;
  status: MessageStatus;
  campaignType: CampaignTypes;
  sentAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

// Campaign types
export type CampaignTypes = 'birthday' | 'welcome' | 'reactivation' | 'loyalty';

export interface CampaignConfig {
  enabled: boolean;
  message: string;
  sendTime?: string; // HH:mm format
  coupon?: string;
  settings: Record<string, any>;
}

// Re-export campaign types
export type { 
  Customer, 
  Transaction, 
  CampaignTarget 
};

// Error types
export interface ProcessingError {
  code: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Utility types
export type DateString = string; // ISO 8601 format
export type TimeString = string; // HH:mm format
export type PhoneNumber = string; // E.164 format

// Response types
export interface ProcessingResult {
  success: boolean;
  error?: ProcessingError;
  metadata?: Record<string, any>;
}