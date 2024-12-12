// src/campaigns/processor.ts

import { BigQuery } from '@google-cloud/bigquery';
import { db } from '../config/firebase';
import { CampaignTarget } from '../types/campaign';

export abstract class BaseCampaignProcessor {
  protected bigquery: BigQuery;
  protected cnpj: string;
  
  constructor(cnpj: string) {
    this.bigquery = new BigQuery();
    this.cnpj = cnpj;
  }

  protected async saveCampaignTargets(targets: CampaignTarget[]) {
    const batch = db.batch();
    
    for (const target of targets) {
      const campaignRef = db
        .collection('users')
        .doc(this.cnpj)
        .collection('campaigns')
        .doc(target.campaignType)
        .collection('targets')
        .doc(target.customerId);

      batch.set(campaignRef, {
        ...target,
        createdAt: new Date(),
        status: 'pending',
        attempts: 0
      });
    }

    await batch.commit();
  }

  protected async getMessageHistory(campaignType: string, customerId: string) {
    const query = `
      SELECT 
        sentAt,
        status
      FROM \`${this.cnpj}_CAMPAIGN.message_history\`
      WHERE 
        campaign_type = @campaignType 
        AND user_id = @customerId
      ORDER BY sentAt DESC
      LIMIT 1
    `;

    const [rows] = await this.bigquery.query({
      query,
      params: {
        campaignType,
        customerId
      }
    });

    return rows[0] || null;
  }

  abstract process(): Promise<void>;
}