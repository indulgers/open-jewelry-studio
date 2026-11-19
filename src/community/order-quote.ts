export const maxQuoteFen = 999_999_999;

export type OrderQuote = {
  amountFen: number;
  currency: 'CNY';
  version: string;
  issuedAt: string;
  description: string;
};

export type OrderStatus = '待人工核价' | '已受理' | '已报价' | '已下单' | '已关闭';
