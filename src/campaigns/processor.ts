// src/campaigns/processor.ts

import { BigQuery } from '@google-cloud/bigquery';
import { CampaignTarget } from '../types/campaign';
import { db } from '../config/firebase';
import * as admin from 'firebase-admin';

export abstract class BaseCampaignProcessor {
  protected bigquery: BigQuery;
  protected cnpj: string;
  protected projectId: string;
  protected userId: string;
  
  constructor(cnpj: string, userId: string) {
    this.bigquery = new BigQuery();
    this.cnpj = cnpj;
    this.userId = userId;
    this.projectId = process.env.GCLOUD_PROJECT || '';
    
    if (!this.projectId) {
      throw new Error('GCLOUD_PROJECT environment variable not set');
    }
  }

  protected async cleanupOldTargets(campaignType: string): Promise<void> {
    console.log(`Cleaning up old targets for campaign type: ${campaignType}`);
    
    try {
      const targetsRef = db
        .collection('users')
        .doc(this.userId)
        .collection('campaigns')
        .doc(campaignType)
        .collection('targets');

      // Get all targets
      const snapshot = await targetsRef.get();
      
      if (snapshot.empty) {
        console.log('No old targets to clean up');
        return;
      }

      // Delete in batches of 500 (Firestore limit)
      const batchSize = 500;
      let batch = db.batch();
      let operationCount = 0;
      let totalDeleted = 0;

      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        operationCount++;
        totalDeleted++;

        if (operationCount >= batchSize) {
          await batch.commit();
          batch = db.batch();
          operationCount = 0;
          console.log(`Deleted ${totalDeleted} targets so far`);
        }
      }

      // Commit any remaining deletes
      if (operationCount > 0) {
        await batch.commit();
      }

      console.log(`Cleanup completed. Total targets deleted: ${totalDeleted}`);
    } catch (error) {
      console.error('Error cleaning up old targets:', error);
      throw error;
    }
  }

  protected async saveCampaignTargets(targets: CampaignTarget[]): Promise<void> {
    try {
      // First cleanup old targets
      await this.cleanupOldTargets(targets[0].campaignType);

      // Then save new targets
      console.log(`Saving ${targets.length} new campaign targets`);
      const batch = db.batch();
      
      for (const target of targets) {
        const campaignRef = db
          .collection('users')
          .doc(this.userId)
          .collection('campaigns')
          .doc(target.campaignType)
          .collection('targets')
          .doc(target.customerId);

        batch.set(campaignRef, {
          ...target,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'pending',
          attempts: 0
        });
      }

      await batch.commit();
      console.log('Successfully saved new campaign targets');
    } catch (error) {
      console.error('Error saving campaign targets:', error);
      throw error;
    }
  }

  abstract process(): Promise<void>;
}