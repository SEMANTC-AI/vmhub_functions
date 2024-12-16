// src/campaigns/reactivation.ts

import { BaseCampaignProcessor } from './processor';
import { CampaignTarget } from '../types/campaign';

export class ReactivationCampaignProcessor extends BaseCampaignProcessor {
  async process(): Promise<void> {
    // only process after day 20 of the month
    const currentDay = new Date().getDate();
    if (currentDay < 20) return;

    const query = `
      WITH LastPurchase AS (
        SELECT 
          cpfCliente,
          MAX(data) as last_purchase_date
        FROM \`${this.cnpj}_RAW.vendas\`
        WHERE status = 'SUCESSO'
        GROUP BY cpfCliente
      ),
      MessageHistory AS (
        SELECT 
          user_id,
          MAX(sent_at) as last_message_sent
        FROM \`${this.cnpj}_CAMPAIGN.message_history\`
        WHERE campaign_type = 'reactivation'
        GROUP BY user_id
      ),
      VoucherUsage AS (
        SELECT DISTINCT
          cpfCliente
        FROM \`${this.cnpj}_RAW.vendas\`
        WHERE 
          cupom IS NOT NULL
          AND status = 'SUCESSO'
          AND DATE(TIMESTAMP_ADD(data, INTERVAL -3 HOUR)) >= 
            DATE_TRUNC(CURRENT_DATE(), MONTH)
      )
      SELECT 
        c.id as customerId,
        c.nome as name,
        c.telefone as phone,
        lp.last_purchase_date
      FROM \`${this.cnpj}_RAW.clientes\` c
      INNER JOIN LastPurchase lp ON c.cpf = lp.cpfCliente
      LEFT JOIN MessageHistory mh ON c.id = mh.user_id
      LEFT JOIN VoucherUsage vu ON c.cpf = vu.cpfCliente
      WHERE 
        DATE(TIMESTAMP_ADD(lp.last_purchase_date, INTERVAL -3 HOUR)) < 
          DATE_TRUNC(CURRENT_DATE(), MONTH)
        AND (
          mh.last_message_sent IS NULL
          OR DATE(mh.last_message_sent) < DATE_TRUNC(CURRENT_DATE(), MONTH)
        )
        AND vu.cpfCliente IS NULL
    `;

    const [rows] = await this.bigquery.query(query);

    const targets: CampaignTarget[] = rows.map(row => ({
      customerId: row.customerId,
      name: row.name,
      phone: row.phone,
      campaignType: 'reactivation',
      data: {
        lastPurchaseDate: row.last_purchase_date
      }
    }));

    if (targets.length > 0) {
      await this.saveCampaignTargets(targets);
    }
  }
}