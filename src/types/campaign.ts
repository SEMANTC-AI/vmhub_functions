// src/types/campaign.ts

export interface Customer {
  id: string;
  nome: string;
  dataNascimento: string;
  cpf: string;
  telefone: string;
  email: string;
  genero: string;
  dataCadastro: string;
  primeiraCompra: string;
}

export interface Transaction {
  data: string;
  cpfCliente: string;
  nomeCliente: string;
  telefoneCliente: string;
  tipoPagamento: 'TEF' | 'QRCODE' | 'VOUCHER' | 'APP';
  status: string;
  valor: string;
  cupom: string | null;
}

export interface CampaignTarget {
  customerId: string;
  name: string;
  phone: string;
  campaignType: 'birthday' | 'welcome' | 'reactivation' | 'loyalty';
  data: {
    birthDate?: string;
    registrationDate?: string;
    lastPurchaseDate?: string;
    purchaseCount?: number;
    totalSpent?: number;
  };
}