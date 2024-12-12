// src/campaigns/birthday.ts

import { BaseCampaignProcessor } from './processor';
import { CampaignTarget } from '../types/campaign';

export class BirthdayCampaignProcessor extends BaseCampaignProcessor {
  async process(): Promise<void> {
    const query = `
      WITH MessageHistory AS (
        SELECT 
          user_id,
          MAX(sent_at) as last_message_sent
        FROM \`${this.cnpj}_CAMPAIGN.message_history\`
        WHERE campaign_type = 'birthday'
        GROUP BY user_id
      )
      SELECT 
        c.id as customerId,
        c.nome as name,
        c.telefone as phone,
        c.dataNascimento as birthDate,
        c.dataCadastro as registrationDate
      FROM \`${this.cnpj}_RAW.clientes\` c
      LEFT JOIN MessageHistory mh ON c.id = mh.user_id
      WHERE 
        -- Convert UTC to Brazil time (UTC-3)
        EXTRACT(MONTH FROM TIMESTAMP_ADD(c.dataNascimento, INTERVAL -3 HOUR)) = 
          EXTRACT(MONTH FROM CURRENT_TIMESTAMP())
        AND EXTRACT(DAY FROM TIMESTAMP_ADD(c.dataNascimento, INTERVAL -3 HOUR)) = 
          EXTRACT(DAY FROM CURRENT_TIMESTAMP())
        AND (
          mh.last_message_sent IS NULL
          OR EXTRACT(YEAR FROM mh.last_message_sent) < EXTRACT(YEAR FROM CURRENT_TIMESTAMP())
        )
    `;

    const [rows] = await this.bigquery.query(query);

    const targets: CampaignTarget[] = rows.map(row => ({
      customerId: row.customerId,
      name: row.name,
      phone: row.phone,
      campaignType: 'birthday',
      data: {
        birthDate: row.birthDate,
        registrationDate: row.registrationDate
      }
    }));

    if (targets.length > 0) {
      await this.saveCampaignTargets(targets);
    }
  }
}