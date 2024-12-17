// src/campaigns/reactivation.ts

import { BaseCampaignProcessor } from './processor';
import { CampaignTarget } from '../types/campaign';

interface ReactivationRow {
  customerId: string;
  name: string;
  phone: string;
  lastPurchaseDate: string;
  daysSinceLastPurchase: number;
}

export class ReactivationCampaignProcessor extends BaseCampaignProcessor {
  async process(): Promise<void> {
    console.log(`Starting reactivation campaign processing for CNPJ ${this.cnpj}`);
    
    const query = `
      WITH TODAY AS (
        SELECT 
          DATETIME(CURRENT_TIMESTAMP(), 'America/Sao_Paulo') as brazil_time
      ),
      LastPurchase AS (
        SELECT 
          cpfCliente,
          MAX(data) as last_purchase_date,
          DATE_DIFF(
            CURRENT_DATE('America/Sao_Paulo'),
            DATE(MAX(data), 'America/Sao_Paulo'),
            DAY
          ) as days_since_last_purchase
        FROM \`${this.projectId}.CNPJ_${this.cnpj}_RAW.vendas\`
        WHERE status = 'SUCESSO'
        GROUP BY cpfCliente
      ),
      MessageHistory AS (
        SELECT 
          user_id,
          MAX(sent_at) as last_message_sent
        FROM \`${this.projectId}.CNPJ_${this.cnpj}_CAMPAIGN.message_history\`
        WHERE campaign_type = 'reactivation'
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
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%S.%EZ', lp.last_purchase_date) as lastPurchaseDate,
        lp.days_since_last_purchase as daysSinceLastPurchase
      FROM \`${this.projectId}.CNPJ_${this.cnpj}_RAW.clientes\` c
      INNER JOIN LastPurchase lp ON c.cpf = lp.cpfCliente
      LEFT JOIN MessageHistory mh ON CAST(c.id as STRING) = mh.user_id
      LEFT JOIN RecentVoucherUse rv ON c.cpf = rv.cpfCliente
      WHERE 
        -- Inactive for 90+ days
        lp.days_since_last_purchase >= 90
        -- No recent reactivation message (within last 30 days)
        AND (
          mh.last_message_sent IS NULL
          OR DATE(mh.last_message_sent, 'America/Sao_Paulo') < 
             DATE_SUB(CURRENT_DATE('America/Sao_Paulo'), INTERVAL 30 DAY)
        )
        -- Hasn't used a voucher recently
        AND rv.cpfCliente IS NULL
        -- Has valid phone number
        AND c.telefone IS NOT NULL
        AND LENGTH(REGEXP_REPLACE(c.telefone, r'[^0-9]', '')) >= 10;
    `;

    try {
      console.log('Executing BigQuery query for reactivation targets');
      
      const [job] = await this.bigquery.createQueryJob({
        query,
        location: 'US',
        jobTimeoutMs: 60000
      });

      const [rows] = await job.getQueryResults();

      console.log(`Found ${rows.length} reactivation targets`);

      if (rows.length === 0) {
        console.log('No reactivation targets found');
        return;
      }

      const targets: CampaignTarget[] = rows.map((row: ReactivationRow) => ({
        customerId: row.customerId,
        name: row.name,
        phone: this.formatPhoneNumber(row.phone),
        campaignType: 'reactivation',
        data: {
          lastPurchaseDate: row.lastPurchaseDate,
          daysSinceLastPurchase: row.daysSinceLastPurchase
        }
      }));

      console.log(`Saving ${targets.length} campaign targets to Firestore`);
      await this.saveCampaignTargets(targets);
      console.log('Successfully saved reactivation campaign targets');

    } catch (error) {
      console.error('Error processing reactivation campaign:', error);
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