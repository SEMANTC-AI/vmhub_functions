# VMHub Campaign Processing System

## Overview
A Cloud Functions-based system that processes and manages WhatsApp marketing campaigns for laundromat businesses. The system supports multiple campaign types and handles user targeting based on specific criteria.

## Campaign Types

### 1. Birthday Campaign
- Targets customers whose birthday is today
- Considers Brazil timezone (UTC-3)
- Validates phone numbers
- Prevents duplicate messages within same day

### 2. Welcome Campaign
- Targets customers who registered yesterday
- One-time welcome message
- Validates phone numbers
- Prevents duplicate messages

### 3. Reactivation Campaign
- Targets inactive customers (90+ days without purchases)
- Excludes customers who received message in last 30 days
- Excludes customers who used vouchers recently
- Tracks days since last purchase

### 4. Loyalty Campaign
- Targets customers with 5+ purchases since December 2024
- Tracks total spend and purchase count
- Excludes recent voucher users
- Prevents duplicate messages within 30 days

## Architecture

### Components
```
├── Campaign Processors (Cloud Functions)
│   ├── Birthday Processor
│   ├── Welcome Processor
│   ├── Reactivation Processor
│   └── Loyalty Processor
│
├── Data Storage
│   ├── BigQuery (Raw & Campaign Data)
│   └── Firestore (Campaign Targets)
│
└── Scheduled Execution
    └── Cloud Scheduler
```

### Data Flow
1. Scheduler triggers campaign processing
2. System fetches active users from Firestore
3. For each user:
   - Queries relevant customer data from BigQuery
   - Identifies campaign targets
   - Creates campaign targets in Firestore
   - Tracks message history in BigQuery

## Database Structure

### BigQuery Tables
1. Raw Data (`CNPJ_XXXXX_RAW.clientes`)
   - Customer information
   - Transaction history

2. Campaign Data (`CNPJ_XXXXX_CAMPAIGN.message_history`)
   - Message tracking
   - Campaign performance

### Firestore Structure
```
users/
  ├── {userId}/
  │   ├── config/
  │   │   └── settings
  │   └── campaigns/
  │       ├── birthday/
  │       ├── welcome/
  │       ├── reactivation/
  │       └── loyalty/
  └── ...
```

## Setup & Deployment

1. Install dependencies:
```bash
npm install
```

2. Deploy functions:
```bash
firebase deploy --only functions
```

3. Configure scheduler:
```bash
gcloud scheduler jobs create http vmhub-campaign-processor \
  --schedule="30 6 * * *" \
  --time-zone="America/Sao_Paulo" \
  --uri="https://[region]-[project].cloudfunctions.net/triggerCampaignProcessing" \
  --http-method=POST
```

## Testing

Test individual campaigns:
```bash
# Birthday Campaign
curl -X POST https://[region]-[project].cloudfunctions.net/triggerBirthdayCampaign \
  -H "Content-Type: application/json" \
  -d '{"userId": "USER_ID"}'

# Welcome Campaign
curl -X POST https://[region]-[project].cloudfunctions.net/triggerWelcomeCampaign \
  -H "Content-Type: application/json" \
  -d '{"userId": "USER_ID"}'

# Process all campaigns
curl -X POST https://[region]-[project].cloudfunctions.net/triggerCampaignProcessing
```

## Recommendations for Multi-User Handling

### Current Approach
The system currently supports two execution modes:
1. Individual campaign triggers with userId parameter
2. Batch processing of all users via `triggerCampaignProcessing`

### Suggested Improvements

1. **Pub/Sub Based Processing**
```typescript
// 1. Master scheduler triggers user discovery
scheduledCampaignProcessor
  -> discovers active users
  -> publishes user IDs to Pub/Sub topic

// 2. Individual processors subscribe to topic
campaignProcessor
  -> processes single user
  -> handles retries
  -> reports status
```

2. **Queue-Based Processing**
- Implement Cloud Tasks queue
- Schedule user processing with delays
- Handle retries automatically
- Control concurrency

3. **Batching Strategy**
```typescript
// Process users in batches
async function processBatch(userIds: string[], batchSize: number) {
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    await Promise.all(
      batch.map(userId => processUser(userId))
    );
    await delay(1000); // Rate limiting
  }
}
```

4. **Error Handling & Monitoring**
- Implement dead-letter queues
- Track processing status per user
- Set up alerting for failures
- Implement retry with backoff

## Next Steps

1. Implement WhatsApp integration service
2. Add message templates management
3. Improve error handling and monitoring
4. Add campaign analytics
5. Implement user processing queue

## Environment Variables
```
GCLOUD_PROJECT=your-project-id
```

## Notes

- All timestamps use Brazil timezone (UTC-3)
- Phone numbers are formatted to E.164 format
- Campaign targets are cleaned up before each run
- Message history is preserved in BigQuery