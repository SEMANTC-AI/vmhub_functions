// src/scheduled/campaign-processor.ts

import * as functions from 'firebase-functions';
import { db } from '../config/firebase';
import { BirthdayCampaignProcessor } from '../campaigns/birthday';
import { WelcomeCampaignProcessor } from '../campaigns/welcome';
import { ReactivationCampaignProcessor } from '../campaigns/reactivation';
import { LoyaltyCampaignProcessor } from '../campaigns/loyalty';

export const processCampaigns = async (
  context: functions.EventContext,
  data: any
) => {
  try {
    // Get all active CNPJs
    const configsSnapshot = await db.collectionGroup('tokens')
      .where('status', '==', 'provisioned')
      .get();

    for (const config of configsSnapshot.docs) {
      const cnpj = config.data().cnpj;
      
      try {
        // Process each campaign type
        const processors = [
          new BirthdayCampaignProcessor(cnpj),
          new WelcomeCampaignProcessor(cnpj),
          new ReactivationCampaignProcessor(cnpj),
          new LoyaltyCampaignProcessor(cnpj)
        ];

        await Promise.all(
          processors.map(async (processor) => {
            try {
              await processor.process();
              console.log(`Successfully processed ${processor.constructor.name} for CNPJ ${cnpj}`);
            } catch (error) {
              console.error(`Error processing ${processor.constructor.name} for CNPJ ${cnpj}:`, error);
            }
          })
        );
        
        console.log(`Completed all campaign processing for CNPJ ${cnpj}`);
      } catch (error) {
        console.error(`Error in campaign batch for CNPJ ${cnpj}:`, error);
      }
    }
  } catch (error) {
    console.error('Fatal error in campaign processor:', error);
    throw error;
  }
};

// Manual trigger endpoint
export const triggerCampaignProcessing = async (
  req: functions.https.Request,
  res: functions.Response
) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    await processCampaigns({} as functions.EventContext, {});
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Manual trigger error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};