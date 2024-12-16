# VMHub Campaign Processing System

## Overview
The Campaign Processing System is a core component of VMHub that automatically identifies eligible customers and manages WhatsApp messaging campaigns for laundromat businesses. This system processes customer data from BigQuery datasets and creates campaign targets in Firestore, running on a scheduled basis to support multiple campaign types.

## System Architecture

### Core Components

1. **Base Processor**
   - Abstract class providing common functionality across all campaign types
   - Manages BigQuery connections and query execution
   - Handles batch writes to Firestore for efficiency
   - Implements error handling and retry logic
   - Manages resource cleanup

2. **Campaign-Specific Processors**
   - Specialized implementations for each campaign type
   - Custom targeting logic and eligibility criteria
   - Campaign-specific data processing
   - Message template management
   - Campaign types:
     - Birthday Campaigns
     - Welcome Messages
     - Reactivation Campaigns
     - Loyalty Programs

3. **Campaign Scheduler**
   - Runs on an hourly basis
   - Orchestrates execution of all campaign types
   - Handles multiple CNPJ processing
   - Manages execution order and dependencies

4. **Message Tracking System**
   - Records all message attempts in BigQuery
   - Updates message delivery statuses
   - Tracks campaign performance metrics
   - Manages message history

## Data Flow

1. **Initialization**
   - Scheduler trigger activates
   - System fetches list of active CNPJs
   - Validates configurations and permissions

2. **Campaign Processing**
   - For each CNPJ:
     1. Initialize campaign processors
     2. Query BigQuery for eligible targets
     3. Apply campaign-specific filters
     4. Create campaign targets in Firestore
     5. Track processing status

3. **Message Delivery**
   - WhatsApp integration service monitors Firestore
   - Sends messages to eligible targets
   - Updates message status in real-time
   - Records delivery confirmations

## Campaign Types

### 1. Birthday Campaign
**Purpose**: Send personalized birthday messages to customers

**Targeting Logic**:
```sql
SELECT 
    c.id,
    c.nome,
    c.telefone,
    c.dataNascimento
FROM 
    `{CNPJ}_RAW.clientes` c
LEFT JOIN 
    `{CNPJ}_CAMPAIGN.message_history` h
    ON c.id = h.user_id 
    AND h.campaign_type = 'BIRTHDAY'
    AND DATE(h.sent_at) = CURRENT_DATE()
WHERE 
    EXTRACT(MONTH FROM c.dataNascimento) = EXTRACT(MONTH FROM CURRENT_DATE())
    AND EXTRACT(DAY FROM c.dataNascimento) = EXTRACT(DAY FROM CURRENT_DATE())
    AND h.user_id IS NULL
```

**Key Features**:
- Timezone-aware processing (Brazil UTC-3)
- Once per year per customer
- Configurable sending time
- Optional birthday voucher inclusion

### 2. Welcome Campaign
**Purpose**: Engage new customers with a welcome message

**Targeting Logic**:
```sql
SELECT 
    c.id,
    c.nome,
    c.telefone,
    c.dataCadastro
FROM 
    `{CNPJ}_RAW.clientes` c
LEFT JOIN 
    `{CNPJ}_CAMPAIGN.message_history` h
    ON c.id = h.user_id 
    AND h.campaign_type = 'WELCOME'
WHERE 
    DATE(c.dataCadastro) = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
    AND h.user_id IS NULL
```

**Key Features**:
- One-time message per customer
- Sent one day after registration
- Welcome voucher integration
- New customer tracking

### 3. Reactivation Campaign
**Purpose**: Re-engage inactive customers

**Targeting Logic**:
```sql
WITH LastPurchase AS (
    SELECT 
        cpfCliente,
        MAX(data) as last_purchase_date
    FROM 
        `{CNPJ}_RAW.vendas`
    WHERE 
        status = 'COMPLETED'
    GROUP BY 
        cpfCliente
)

SELECT 
    c.id,
    c.nome,
    c.telefone
FROM 
    `{CNPJ}_RAW.clientes` c
JOIN 
    LastPurchase lp ON c.cpf = lp.cpfCliente
LEFT JOIN 
    `{CNPJ}_CAMPAIGN.message_history` h
    ON c.id = h.user_id 
    AND h.campaign_type = 'REACTIVATION'
    AND DATE(h.sent_at) >= DATE_TRUNC(CURRENT_DATE(), MONTH)
WHERE 
    DATE(lp.last_purchase_date) < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    AND EXTRACT(DAY FROM CURRENT_DATE()) >= 20
    AND h.user_id IS NULL
```

**Key Features**:
- Runs after 20th of each month
- Excludes recent voucher users
- Configurable inactivity threshold
- Progressive messaging strategy

### 4. Loyalty Campaign
**Purpose**: Reward and retain frequent customers

**Targeting Logic**:
```sql
WITH CustomerVisits AS (
    SELECT 
        cpfCliente,
        COUNT(*) as visit_count,
        SUM(valor) as total_spent
    FROM 
        `{CNPJ}_RAW.vendas`
    WHERE 
        status = 'COMPLETED'
        AND data >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH)
    GROUP BY 
        cpfCliente
)

SELECT 
    c.id,
    c.nome,
    c.telefone,
    cv.visit_count,
    cv.total_spent
FROM 
    `{CNPJ}_RAW.clientes` c
JOIN 
    CustomerVisits cv ON c.cpf = cv.cpfCliente
LEFT JOIN 
    `{CNPJ}_CAMPAIGN.message_history` h
    ON c.id = h.user_id 
    AND h.campaign_type = 'LOYALTY'
    AND DATE(h.sent_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH)
WHERE 
    cv.visit_count >= 10
    AND h.user_id IS NULL
```

**Key Features**:
- Minimum 10 visits in 3 months
- Excludes recent reward recipients
- Tiered rewards based on visit frequency
- Tracks redemption rates

## Database Schema

### BigQuery Tables

1. **Raw Customer Data** (`{CNPJ}_RAW.clientes`)
```sql
CREATE TABLE clientes (
    id STRING,
    nome STRING,
    dataNascimento TIMESTAMP,
    cpf STRING,
    telefone STRING,
    email STRING,
    genero STRING,
    dataCadastro TIMESTAMP,
    primeiraCompra TIMESTAMP
)
```

2. **Transaction Data** (`{CNPJ}_RAW.vendas`)
```sql
CREATE TABLE vendas (
    data TIMESTAMP,
    cpfCliente STRING,
    valor FLOAT64,
    status STRING,
    tipoPagamento STRING,
    cupom STRING
)
```

3. **Message History** (`{CNPJ}_CAMPAIGN.message_history`)
```sql
CREATE TABLE message_history (
    user_id STRING,
    campaign_type STRING,
    sent_at TIMESTAMP,
    status STRING,
    message_content STRING,
    phone STRING
)
```

### Firestore Structure

```typescript
interface CampaignTarget {
    customerId: string;
    name: string;
    phone: string;
    campaignType: 'BIRTHDAY' | 'WELCOME' | 'REACTIVATION' | 'LOYALTY';
    data: {
        [key: string]: any;  // Campaign-specific data
    };
    createdAt: Timestamp;
    status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
    attempts: number;
}

// Firestore path: users/{cnpj}/campaigns/{campaignType}/targets/{customerId}
```

## Error Handling

### Retry Strategy
1. **Message Delivery**
   - Maximum 3 attempts per target
   - Exponential backoff between attempts
   - Status tracking for each attempt

2. **Processing Errors**
   - Failed targets logged for review
   - Automatic retry on next schedule
   - Error notification system

### Error Types
1. **Recoverable Errors**
   - Network timeouts
   - Rate limiting
   - Temporary service unavailability

2. **Non-recoverable Errors**
   - Invalid phone numbers
   - Blocked numbers
   - Permanent delivery failures

## Performance Optimization

### Query Optimization
- Partitioned tables by date
- Materialized views for complex queries
- Indexed frequently queried fields

### Batch Processing
- Bulk writes to Firestore
- Batched BigQuery queries
- Chunked data processing

### Resource Management
- Connection pooling
- Memory usage monitoring
- Execution time limits

## Monitoring and Maintenance

### Key Metrics
1. **Campaign Performance**
   - Delivery rates
   - Open rates
   - Response rates
   - Conversion tracking

2. **System Health**
   - Processing times
   - Error rates
   - Resource utilization

### Alerting
- Processing failures
- High error rates
- Resource exhaustion
- Data freshness issues

## Development Guidelines

### Adding New Campaigns
1. Create new campaign processor class
2. Implement targeting logic
3. Add configuration UI
4. Update message templates
5. Add monitoring metrics

### Modifying Existing Campaigns
1. Update processor logic
2. Test with sample data
3. Deploy changes gradually
4. Monitor performance impact

## Security Considerations

### Data Protection
- Encrypted customer data
- Secure credential storage
- Access logging
- Regular security audits

### Access Control
- Role-based permissions
- Service account isolation
- Audit trail maintenance
- Least privilege principle