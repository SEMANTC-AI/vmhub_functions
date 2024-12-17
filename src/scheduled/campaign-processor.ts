// src/scheduled/campaign-processor.ts

import * as functions from 'firebase-functions';
import { db } from '../config/firebase';
import { BirthdayCampaignProcessor } from '../campaigns/birthday';
import { WelcomeCampaignProcessor } from '../campaigns/welcome';
import { ReactivationCampaignProcessor } from '../campaigns/reactivation';
import { LoyaltyCampaignProcessor } from '../campaigns/loyalty';

export const triggerCampaignProcessing = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB'
  })
  .https
  .onRequest(async (req: functions.https.Request, res: functions.Response) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
      }

      // Get userId from request body (sent by scheduler)
      const userId = req.body.userId;
      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'userId is required in request body'
        });
        return;
      }

      // Get user's CNPJ
      const configDoc = await db.collection('users')
        .doc(userId)
        .collection('config')
        .doc('settings')
        .get();

      if (!configDoc.exists) {
        res.status(404).json({
          success: false,
          error: `No configuration found for user ${userId}`
        });
        return;
      }

      const data = configDoc.data();
      const cnpj = data?.cnpj;

      if (!cnpj) {
        res.status(400).json({
          success: false,
          error: 'No CNPJ found in user configuration'
        });
        return;
      }

      // Process all campaigns for this user
      const processors = [
        new BirthdayCampaignProcessor(cnpj, userId),
        new WelcomeCampaignProcessor(cnpj, userId),
        new ReactivationCampaignProcessor(cnpj, userId),
        new LoyaltyCampaignProcessor(cnpj, userId)
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

      res.status(200).json({ 
        success: true,
        message: 'Campaign processing completed',
        userId,
        cnpj
      });

    } catch (error) {
      console.error('Error processing campaigns:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
