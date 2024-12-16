// src/campaigns/welcome.ts

import { BaseCampaignProcessor } from './processor';
import { CampaignTarget } from '../types/campaign';

export class WelcomeCampaignProcessor extends BaseCampaignProcessor {
  async process(): Promise<void> {
    const query = `
      WITH MessageHistory AS (
        SELECT 
          user_id,
          MAX(sent_at) as last_message_sent
        FROM \`${this.cnpj}_CAMPAIGN.message_history\`
        WHERE campaign_type = 'welcome'
        GROUP BY user_id
      )
      SELECT 
        c.id as customerId,
        c.nome as name,
        c.telefone as phone,
        c.dataCadastro as registrationDate
      FROM \`${this.cnpj}_RAW.clientes\` c
      LEFT JOIN MessageHistory mh ON c.id = mh.user_id
      WHERE 
        DATE(TIMESTAMP_ADD(c.dataCadastro, INTERVAL -3 HOUR)) = 
          DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
        AND mh.last_message_sent IS NULL
    `;

    const [rows] = await this.bigquery.query(query);

    const targets: CampaignTarget[] = rows.map(row => ({
      customerId: row.customerId,
      name: row.name,
      phone: row.phone,
      campaignType: 'welcome',
      data: {
        registrationDate: row.registrationDate
      }
    }));

    if (targets.length > 0) {
      await this.saveCampaignTargets(targets);
    }
  }
}