// src/campaigns/processor.ts

import { BigQuery } from '@google-cloud/bigquery';
import { CampaignTarget } from '../types/campaign';
import { db } from '../config/firebase';

export abstract class BaseCampaignProcessor {
  protected bigquery: BigQuery;
  protected cnpj: string;
  protected projectId: string;
  
  constructor(cnpj: string) {
    this.bigquery = new BigQuery();
    this.cnpj = cnpj;
    this.projectId = process.env.GCLOUD_PROJECT || '';
    
    if (!this.projectId) {
      throw new Error('GCLOUD_PROJECT environment variable not set');
    }
  }

  protected async saveCampaignTargets(targets: CampaignTarget[]): Promise<void> {
    console.log('Starting batch write to Firestore');
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
    console.log('Completed batch write to Firestore');
  }

  abstract process(): Promise<void>;
}