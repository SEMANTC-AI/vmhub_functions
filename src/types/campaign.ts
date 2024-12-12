// src/types/campaign.ts

export interface BaseCampaign {
  enabled: boolean;
  message: string;
  coupon?: string;
}

export interface BirthdayCampaign extends BaseCampaign {
  type: 'birthday';
  settings: {
    sendTime: string;
  };
}

export interface WelcomeCampaign extends BaseCampaign {
  type: 'welcome';
  settings: {
    welcomeDelay: number;
    couponValidityDays: number;
  };
}

export interface ReactivationCampaign extends BaseCampaign {
  type: 'reactivation';
  settings: {
    inactiveDays: number;
    couponValidityDays: number;
  };
}

export interface LoyaltyCampaign extends BaseCampaign {
  type: 'loyalty';
  settings: {
    minimumPurchase: number;
    evaluationPeriod: number;
    vipDiscount: number;
    reminderFrequency: number;
    reminderMessage: string;
    maintenanceValue: number;
    renewalMessage: string;
  };
}

export interface MessageRecord {
  userId: string;
  campaignType: 'birthday' | 'welcome' | 'reactivation' | 'loyalty';
  sentAt: Date;
  status: 'sent' | 'failed';
  messageContent: string;
  phone: string;
}