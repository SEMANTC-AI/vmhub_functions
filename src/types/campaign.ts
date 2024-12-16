// src/types/campaign.ts

export interface CampaignTarget {
  customerId: string;
  name: string;
  phone: string;
  campaignType: 'birthday' | 'welcome' | 'reactivation' | 'loyalty';
  data: {
    birthDate?: string;
    registrationDate?: string;
    lastPurchaseDate?: string;
    purchaseCount?: number;
    totalSpent?: number;
    [key: string]: any;
  };
}

export interface MessageHistory {
  sentAt: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
}

export type CampaignType = 'birthday' | 'welcome' | 'reactivation' | 'loyalty';

export interface ProcessingResult {
  success: boolean;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}