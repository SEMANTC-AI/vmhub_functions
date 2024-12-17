// src/triggers/message-sent.ts
import * as functions from 'firebase-functions';
import { BigQuery } from '@google-cloud/bigquery';

// Runtime options
const runtimeOpts: functions.RuntimeOptions = {
  timeoutSeconds: 120,
  memory: '256MB'
};

// Custom error interfaces
interface BigQueryError extends Error {
  name: string;
  errors?: any[];
}

interface MessageData {
  userId: string;
  sentAt: FirebaseFirestore.Timestamp;
  status: string;
  content?: string;
  phone?: string;
}

export const onMessageSent = functions
  .runWith(runtimeOpts)
  .firestore
  .document('users/{cnpj}/campaigns/{campaignType}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const messageData = snap.data() as MessageData;
    const { cnpj, campaignType, messageId } = context.params;

    const bigquery = new BigQuery();
    const dataset = `${cnpj}_CAMPAIGN`;
    const table = 'message_history';

    try {
      // Validate required fields
      if (!messageData.userId || !messageData.sentAt || !messageData.status) {
        throw new Error('Missing required message fields');
      }

      // Prepare record for BigQuery
      const record = {
        user_id: messageData.userId,
        campaign_type: campaignType,
        sent_at: messageData.sentAt.toDate(),
        status: messageData.status,
        message_content: messageData.content || '',
        phone: messageData.phone || '',
        created_at: BigQuery.timestamp(new Date()),
        metadata: {
          messageId,
          source: 'cloud-function'
        }
      };

      // Insert into BigQuery
      await bigquery.dataset(dataset).table(table).insert([record]);

      console.log('Message history recorded successfully', {
        cnpj,
        campaignType,
        userId: messageData.userId,
        messageId
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('Error recording message history:', {
        errorMessage,
        cnpj,
        campaignType,
        messageId,
        userData: {
          userId: messageData.userId,
          status: messageData.status
        }
      });

      if (error instanceof Error && 'name' in error) {
        const bqError = error as BigQueryError;
        if (bqError.name === 'PartialFailureError') {
          console.error('BigQuery insertion partial failure:', bqError.errors);
        }
      }

      throw error;
    }
  });

export const onMessageStatusUpdate = functions
  .runWith(runtimeOpts)
  .firestore
  .document('users/{cnpj}/campaigns/{campaignType}/messages/{messageId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data() as MessageData;
    const afterData = change.after.data() as MessageData;
    const { cnpj, campaignType, messageId } = context.params;

    // Only process if status has changed
    if (beforeData.status === afterData.status) {
      return null;
    }

    const bigquery = new BigQuery();
    const dataset = `${cnpj}_CAMPAIGN`;
    const table = 'message_history';

    try {
      const record = {
        user_id: afterData.userId,
        campaign_type: campaignType,
        sent_at: afterData.sentAt.toDate(),
        status: afterData.status,
        previous_status: beforeData.status,
        message_content: afterData.content || '',
        phone: afterData.phone || '',
        updated_at: BigQuery.timestamp(new Date()),
        metadata: {
          messageId,
          source: 'status-update'
        }
      };

      await bigquery.dataset(dataset).table(table).insert([record]);

      console.log('Message status update recorded', {
        cnpj,
        campaignType,
        messageId,
        oldStatus: beforeData.status,
        newStatus: afterData.status
      });

      return null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('Error recording message status update:', {
        errorMessage,
        cnpj,
        campaignType,
        messageId
      });

      throw error;
    }
  });