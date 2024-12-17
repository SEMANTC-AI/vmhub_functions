// src/index.ts

import * as functions from 'firebase-functions';
import { BirthdayCampaignProcessor } from './campaigns/birthday';
import { WelcomeCampaignProcessor } from './campaigns/welcome';
import { ReactivationCampaignProcessor } from './campaigns/reactivation';
import { LoyaltyCampaignProcessor } from './campaigns/loyalty';

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

      const userId = req.body.userId;
      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'userId is required in request body'
        });
        return;
      }

      console.log(`Starting birthday campaign trigger for user ${userId}`);

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

      const processor = new BirthdayCampaignProcessor(cnpj, userId);
      await processor.process();
      
      res.status(200).json({ 
        success: true,
        message: 'Birthday campaign processing completed',
        userId,
        cnpj
      });
    } catch (err: unknown) {
      console.error('Error processing birthday campaign:', err instanceof Error ? err.message : 'Unknown error');
      res.status(500).json({ 
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error occurred'
      });
    }
  });

export const triggerWelcomeCampaign = functions
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

      const userId = req.body.userId;
      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'userId is required in request body'
        });
        return;
      }

      console.log(`Starting welcome campaign trigger for user ${userId}`);

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

      const processor = new WelcomeCampaignProcessor(cnpj, userId);
      await processor.process();
      
      res.status(200).json({ 
        success: true,
        message: 'Welcome campaign processing completed',
        userId,
        cnpj
      });
    } catch (err: unknown) {
      console.error('Error processing welcome campaign:', err instanceof Error ? err.message : 'Unknown error');
      res.status(500).json({ 
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error occurred'
      });
    }
  });

export const triggerReactivationCampaign = functions
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

      const userId = req.body.userId;
      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'userId is required in request body'
        });
        return;
      }

      console.log(`Starting reactivation campaign trigger for user ${userId}`);

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

      const processor = new ReactivationCampaignProcessor(cnpj, userId);
      await processor.process();
      
      res.status(200).json({ 
        success: true,
        message: 'Reactivation campaign processing completed',
        userId,
        cnpj
      });
    } catch (err: unknown) {
      console.error('Error processing reactivation campaign:', err instanceof Error ? err.message : 'Unknown error');
      res.status(500).json({ 
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error occurred'
      });
    }
  });

export const triggerLoyaltyCampaign = functions
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

      const userId = req.body.userId;
      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'userId is required in request body'
        });
        return;
      }

      console.log(`Starting loyalty campaign trigger for user ${userId}`);

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

      const processor = new LoyaltyCampaignProcessor(cnpj, userId);
      await processor.process();
      
      res.status(200).json({ 
        success: true,
        message: 'Loyalty campaign processing completed',
        userId,
        cnpj
      });
    } catch (err: unknown) {
      console.error('Error processing loyalty campaign:', err instanceof Error ? err.message : 'Unknown error');
      res.status(500).json({ 
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error occurred'
      });
    }
  });