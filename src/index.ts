// src/index.ts

import * as functions from 'firebase-functions';
import { BirthdayCampaignProcessor } from './campaigns/birthday';
import './config/firebase';
import { db } from './config/firebase';

export const triggerBirthdayCampaign = functions
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

      // get USER_ID from request body
      const userId = req.body.userId;
      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'userId is required in request body'
        });
        return;
      }

      console.log(`starting birthday campaign trigger for user ${userId}`);

      // get CNPJ from Firestore using USER_ID
      const configDoc = await db.collection('users')
        .doc(userId)
        .collection('config')
        .doc('settings')
        .get();

      if (!configDoc.exists) {
        res.status(404).json({
          success: false,
          error: `no configuration found for user ${userId}`
        });
        return;
      }

      const data = configDoc.data();
      const cnpj = data?.cnpj;

      if (!cnpj) {
        res.status(400).json({
          success: false,
          error: 'no CNPJ found in user configuration'
        });
        return;
      }

      const processor = new BirthdayCampaignProcessor(cnpj);
      await processor.process();
      
      res.status(200).json({ 
        success: true,
        message: 'birthday campaign processing completed',
        userId,
        cnpj
      });
    } catch (err: unknown) {
      console.error('error processing birthday campaign:', err instanceof Error ? err.message : 'Unknown error');
      res.status(500).json({ 
        success: false,
        error: err instanceof Error ? err.message : 'unknown error occurred'
      });
    }
  });