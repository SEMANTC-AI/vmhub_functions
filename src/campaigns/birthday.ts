// src/campaigns/birthday.ts

import { BaseCampaignProcessor } from './processor';
import { CampaignTarget } from '../types/campaign';

interface BirthdayRow {
  customerId: string;
  name: string;
  phone: string;
  birthDate: { value: string } | string;
  registrationDate: { value: string } | string;
}

export class BirthdayCampaignProcessor extends BaseCampaignProcessor {
  async process(): Promise<void> {
    console.log(`Starting birthday campaign processing for CNPJ ${this.cnpj}`);
    
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
        WHERE campaign_type = 'birthday'
        GROUP BY user_id
      )
      SELECT 
        CAST(c.id as STRING) as customerId,
        c.nome as name,
        c.telefone as phone,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%S.%EZ', c.dataNascimento) as birthDate,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%S.%EZ', c.dataCadastro) as registrationDate
      FROM \`${this.projectId}.CNPJ_${this.cnpj}_RAW.clientes\` c
      CROSS JOIN TODAY
      LEFT JOIN MessageHistory mh ON CAST(c.id as STRING) = mh.user_id
      WHERE 
        EXTRACT(MONTH FROM c.dataNascimento) = EXTRACT(MONTH FROM TODAY.brazil_time)
        AND EXTRACT(DAY FROM c.dataNascimento) = EXTRACT(DAY FROM TODAY.brazil_time)
        AND (
          mh.last_message_sent IS NULL
          OR DATE(mh.last_message_sent, 'America/Sao_Paulo') < DATE(TODAY.brazil_time)
        )
        AND c.telefone IS NOT NULL
        AND LENGTH(REGEXP_REPLACE(c.telefone, r'[^0-9]', '')) >= 10;
    `;

    try {
      console.log('Executing BigQuery query for birthday targets');
      
      const [job] = await this.bigquery.createQueryJob({
        query,
        location: 'US',
        jobTimeoutMs: 60000
      });

      const [rows] = await job.getQueryResults();

      console.log(`Found ${rows.length} birthday targets`);

      if (rows.length === 0) {
        console.log('No birthday targets found for today');
        return;
      }

      const targets: CampaignTarget[] = rows.map((row: BirthdayRow) => ({
        customerId: row.customerId,
        name: row.name,
        phone: this.formatPhoneNumber(row.phone),
        campaignType: 'birthday',
        data: {
          birthDate: this.getDateValue(row.birthDate),
          registrationDate: this.getDateValue(row.registrationDate)
        }
      }));

      console.log(`Saving ${targets.length} campaign targets to Firestore`);
      await this.saveCampaignTargets(targets);
      console.log('Successfully saved birthday campaign targets');

    } catch (error) {
      console.error('Error processing birthday campaign:', error);
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

  private getDateValue(date: { value: string } | string): string {
    if (typeof date === 'string') {
      return date;
    }
    return date.value;
  }
}