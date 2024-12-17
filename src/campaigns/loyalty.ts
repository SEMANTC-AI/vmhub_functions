// src/campaigns/loyalty.ts

import { BaseCampaignProcessor } from './processor';
import { CampaignTarget } from '../types/campaign';

interface LoyaltyRow {
  customerId: string;
  name: string;
  phone: string;
  purchaseCount: number;
  totalSpent: number;
  lastPurchaseDate: string;
}

export class LoyaltyCampaignProcessor extends BaseCampaignProcessor {
  async process(): Promise<void> {
    console.log(`Starting loyalty campaign processing for CNPJ ${this.cnpj}`);
    
    const query = `
      WITH TODAY AS (
        SELECT 
          DATETIME(CURRENT_TIMESTAMP(), 'America/Sao_Paulo') as brazil_time
      ),
      CustomerPurchases AS (
        SELECT 
          cpfCliente,
          COUNT(*) as purchase_count,
          SUM(valor) as total_spent,
          MAX(data) as last_purchase_date
        FROM \`${this.projectId}.CNPJ_${this.cnpj}_RAW.vendas\`
        WHERE 
          status = 'SUCESSO'
          AND DATE(data, 'America/Sao_Paulo') >= '2024-12-01'
          AND DATE(data, 'America/Sao_Paulo') <= CURRENT_DATE('America/Sao_Paulo')
        GROUP BY cpfCliente
      ),
      MessageHistory AS (
        SELECT 
          user_id,
          MAX(sent_at) as last_message_sent
        FROM \`${this.projectId}.CNPJ_${this.cnpj}_CAMPAIGN.message_history\`
        WHERE campaign_type = 'loyalty'
        GROUP BY user_id
      ),
      RecentVoucherUse AS (
        SELECT DISTINCT
          cpfCliente
        FROM \`${this.projectId}.CNPJ_${this.cnpj}_RAW.vendas\`
        WHERE 
          tipoPagamento = 'VOUCHER'
          AND status = 'SUCESSO'
          AND DATE(data, 'America/Sao_Paulo') >= DATE_SUB(
            CURRENT_DATE('America/Sao_Paulo'), 
            INTERVAL 30 DAY
          )
      )
      SELECT 
        CAST(c.id as STRING) as customerId,
        c.nome as name,
        c.telefone as phone,
        cp.purchase_count as purchaseCount,
        cp.total_spent as totalSpent,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%S.%EZ', cp.last_purchase_date) as lastPurchaseDate
      FROM \`${this.projectId}.CNPJ_${this.cnpj}_RAW.clientes\` c
      INNER JOIN CustomerPurchases cp ON c.cpf = cp.cpfCliente
      LEFT JOIN MessageHistory mh ON CAST(c.id as STRING) = mh.user_id
      LEFT JOIN RecentVoucherUse rv ON c.cpf = rv.cpfCliente
      WHERE 
        -- Must have at least 5 purchases since December 2024
        cp.purchase_count >= 5
        -- No loyalty message in the last 30 days
        AND (
          mh.last_message_sent IS NULL
          OR DATE(mh.last_message_sent, 'America/Sao_Paulo') < 
             DATE_SUB(CURRENT_DATE('America/Sao_Paulo'), INTERVAL 30 DAY)
        )
        -- Hasn't used a voucher recently
        AND rv.cpfCliente IS NULL
        -- Has valid phone number
        AND c.telefone IS NOT NULL
        AND LENGTH(REGEXP_REPLACE(c.telefone, r'[^0-9]', '')) >= 10
      ORDER BY cp.purchase_count DESC;
    `;

    try {
      console.log('Executing BigQuery query for loyalty targets');
      
      const [job] = await this.bigquery.createQueryJob({
        query,
        location: 'US',
        jobTimeoutMs: 60000
      });

      const [rows] = await job.getQueryResults();

      console.log(`Found ${rows.length} loyalty targets`);

      if (rows.length === 0) {
        console.log('No loyalty targets found');
        return;
      }

      const targets: CampaignTarget[] = rows.map((row: LoyaltyRow) => ({
        customerId: row.customerId,
        name: row.name,
        phone: this.formatPhoneNumber(row.phone),
        campaignType: 'loyalty',
        data: {
          purchaseCount: row.purchaseCount,
          totalSpent: row.totalSpent,
          lastPurchaseDate: row.lastPurchaseDate
        }
      }));

      console.log(`Saving ${targets.length} campaign targets to Firestore`);
      await this.saveCampaignTargets(targets);
      console.log('Successfully saved loyalty campaign targets');

    } catch (error) {
      console.error('Error processing loyalty campaign:', error);
      throw error;
    }
  }

  private formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 11) {
      return `55${cleaned}`;
    } else if (cleaned.length === 10) {
      return `559${cleaned}`;
    } else if (cleaned.length >= 12) {
      return cleaned;
    }
    
    throw new Error(`Invalid phone number format: ${phone}`);
  }
}