// src/campaigns/welcome.ts

import { BaseCampaignProcessor } from './processor';
import { CampaignTarget } from '../types/campaign';

interface WelcomeRow {
  customerId: string;
  name: string;
  phone: string;
  registrationDate: string;
}

export class WelcomeCampaignProcessor extends BaseCampaignProcessor {
  async process(): Promise<void> {
    console.log(`Starting welcome campaign processing for CNPJ ${this.cnpj}`);
    
    const query = `
      WITH TODAY AS (
        SELECT 
          DATETIME(CURRENT_TIMESTAMP(), 'America/Sao_Paulo') as brazil_time
      ),
      MessageHistory AS (
        SELECT 
          user_id,
          MAX(sent_at) as last_message_sent
        FROM \`${this.projectId}.CNPJ_${this.cnpj}_CAMPAIGN.message_history\`
        WHERE campaign_type = 'welcome'
        GROUP BY user_id
      )
      SELECT 
        CAST(c.id as STRING) as customerId,
        c.nome as name,
        c.telefone as phone,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%S.%EZ', c.dataCadastro) as registrationDate
      FROM \`${this.projectId}.CNPJ_${this.cnpj}_RAW.clientes\` c
      CROSS JOIN TODAY
      LEFT JOIN MessageHistory mh ON CAST(c.id as STRING) = mh.user_id
      WHERE 
        -- Customer registered yesterday (in Brazil timezone)
        DATE(TIMESTAMP_ADD(c.dataCadastro, INTERVAL -3 HOUR)) = 
          DATE_SUB(DATE(TODAY.brazil_time), INTERVAL 1 DAY)
        -- Haven't sent welcome message yet
        AND mh.user_id IS NULL
        -- Has valid phone number
        AND c.telefone IS NOT NULL
        AND LENGTH(REGEXP_REPLACE(c.telefone, r'[^0-9]', '')) >= 10;
    `;

    try {
      console.log('Executing BigQuery query for welcome targets');
      
      const [job] = await this.bigquery.createQueryJob({
        query,
        location: 'US',
        jobTimeoutMs: 60000
      });

      const [rows] = await job.getQueryResults();

      console.log(`Found ${rows.length} welcome targets`);

      if (rows.length === 0) {
        console.log('No welcome targets found for today');
        return;
      }

      const targets: CampaignTarget[] = rows.map((row: WelcomeRow) => ({
        customerId: row.customerId,
        name: row.name,
        phone: this.formatPhoneNumber(row.phone),
        campaignType: 'welcome',
        data: {
          registrationDate: row.registrationDate
        }
      }));

      console.log(`Saving ${targets.length} campaign targets to Firestore`);
      await this.saveCampaignTargets(targets);
      console.log('Successfully saved welcome campaign targets');

    } catch (error) {
      console.error('Error processing welcome campaign:', error);
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