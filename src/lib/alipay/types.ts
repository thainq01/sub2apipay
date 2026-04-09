/** Alipay web payment bizContent */
export interface AlipayTradePagePayBizContent {
  out_trade_no: string;
  product_code: 'FAST_INSTANT_TRADE_PAY';
  total_amount: string;
  subject: string;
  body?: string;
}

/** Alipay unified response structure */
export interface AlipayResponse {
  code: string;
  msg: string;
  sub_code?: string;
  sub_msg?: string;
}

/** alipay.trade.query response */
export interface AlipayTradeQueryResponse extends AlipayResponse {
  trade_no?: string;
  out_trade_no?: string;
  trade_status?: string; // WAIT_BUYER_PAY, TRADE_CLOSED, TRADE_SUCCESS, TRADE_FINISHED
  total_amount?: string;
  send_pay_date?: string;
}

/** alipay.trade.refund response */
export interface AlipayTradeRefundResponse extends AlipayResponse {
  trade_no?: string;
  out_trade_no?: string;
  refund_fee?: string;
  fund_change?: string; // Y/N
}

/** alipay.trade.close response */
export interface AlipayTradeCloseResponse extends AlipayResponse {
  trade_no?: string;
  out_trade_no?: string;
}

/** Async notification parameters */
export interface AlipayNotifyParams {
  notify_time: string;
  notify_type: string;
  notify_id: string;
  app_id: string;
  charset: string;
  version: string;
  sign_type: string;
  sign: string;
  trade_no: string;
  out_trade_no: string;
  trade_status: string;
  total_amount: string;
  receipt_amount?: string;
  buyer_pay_amount?: string;
  gmt_payment?: string;
  [key: string]: string | undefined;
}
