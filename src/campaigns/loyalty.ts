// src/campaigns/loyalty.ts

import { BaseCampaignProcessor } from './processor';
import { CampaignTarget } from '../types/campaign';

export class LoyaltyCampaignProcessor extends BaseCampaignProcessor {
  async process(): Promise<void> {
    const query = `
      WITH CustomerPurchases AS (
        SELECT 
          cpfCliente,
          COUNT(*) as purchase_count,
          MAX(data) as last_purchase_date
        FROM \`${this.cnpj}_RAW.vendas\`
        WHERE 
          status = 'SUCESSO'
          AND DATE(TIMESTAMP_ADD(data, INTERVAL -3 HOUR)) >= 
            DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH)
        GROUP BY cpfCliente
      ),
      LastVoucherUsage AS (
        SELECT 
          cpfCliente,
          MAX(data) as last_voucher_date
        FROM \`${this.cnpj}_RAW.vendas\`
        WHERE 
          tipoPagamento = 'VOUCHER'
          AND status = 'SUCESSO'
        GROUP BY cpfCliente
      ),
      MessageHistory AS (
        SELECT 
          user_id,
          MAX(sent_at) as last_message_sent
        FROM \`${this.cnpj}_CAMPAIGN.message_history\`
        WHERE campaign_type = 'loyalty'
        GROUP BY user_id
      )
      SELECT 
        c.id as customerId,
        c.nome as name,
        c.telefone as phone,
        cp.purchase_count,
        cp.last_purchase_date,
        lvu.last_voucher_date
      FROM \`${this.cnpj}_RAW.clientes\` c
      INNER JOIN CustomerPurchases cp ON c.cpf = cp.cpfCliente
      LEFT JOIN LastVoucherUsage lvu ON c.cpf = lvu.cpfCliente
      LEFT JOIN MessageHistory mh ON c.id = mh.user_id
      WHERE 
        cp.purchase_count >= 10
        AND (
          lvu.last_voucher_date IS NULL
          OR DATE(TIMESTAMP_ADD(lvu.last_voucher_date, INTERVAL -3 HOUR)) <
            DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH)
        )
        AND (
          mh.last_message_sent IS NULL
          OR DATE(mh.last_message_sent) <
            DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH)
        )
    `;

    const [rows] = await this.bigquery.query(query);

    const targets: CampaignTarget[] = rows.map(row => ({
      customerId: row.customerId,
      name: row.name,
      phone: row.phone,
      campaignType: 'loyalty',
      data: {
        purchaseCount: row.purchase_count,
        lastPurchaseDate: row.last_purchase_date,
        lastVoucherDate: row.last_voucher_date
      }
    }));

    if (targets.length > 0) {
      await this.saveCampaignTargets(targets);
    }
  }
}