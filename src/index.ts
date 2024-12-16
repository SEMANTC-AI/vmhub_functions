// src/index.ts

import * as functions from 'firebase-functions';
import { Request } from 'firebase-functions/v1/https';
import type { Response } from 'express';

// Import all campaign processors
import { processCampaigns, triggerCampaignProcessing } from './scheduled/campaign-processor';
import { onMessageSent, onMessageStatusUpdate } from './triggers/message-sent';

// Set runtime options
const runtimeOpts: functions.RuntimeOptions = {
  timeoutSeconds: 540, // 9 minutes
  memory: '1GB'
};

// Export scheduled functions
export const scheduledCampaignProcessor = functions
  .runWith(runtimeOpts)
  .pubsub
  .schedule('every 1 hours')
  .timeZone('America/Sao_Paulo')
  .onRun(async (context: functions.EventContext) => {
    try {
      await processCampaigns(context, {});
      console.log('Scheduled campaign processing completed successfully');
    } catch (error) {
      console.error('Error in scheduled campaign processing:', error);
      throw error;
    }
  });

// Export HTTP triggers
export const manualCampaignTrigger = functions
  .runWith(runtimeOpts)
  .https
  .onRequest(async (request: Request, response: Response) => {
    try {
      await triggerCampaignProcessing(request, response);
    } catch (error) {
      console.error('Error in manual campaign trigger:', error);
      response.status(500).json({ error: 'Internal server error' });
    }
  });

// Export Firestore triggers
export const messageSent = functions
  .runWith(runtimeOpts)
  .firestore
  .document('users/{cnpj}/campaigns/{campaignType}/messages/{messageId}')
  .onCreate(onMessageSent);

export const messageStatusUpdate = functions
  .runWith(runtimeOpts)
  .firestore
  .document('users/{cnpj}/campaigns/{campaignType}/messages/{messageId}')
  .onUpdate(onMessageStatusUpdate);

// Health check endpoint
export const healthCheck = functions.https.onRequest((request: Request, response: Response) => {
  response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    region: process.env.FUNCTION_REGION,
    version: process.env.K_REVISION
  });
});