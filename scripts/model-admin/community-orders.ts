import {randomUUID} from 'node:crypto';
import {maxQuoteFen, type OrderQuote, type OrderStatus} from '../../src/community/order-quote.ts';
import type {DesignBasis} from '../../src/community/design-basis.ts';
import type {CommunityStore} from './community-store.ts';
import {communityRoot, fail, getJson, putJson, reply} from './community-account.ts';

export type Order = {
  id: string;
  title: string;
  workId: string;
  owner: string;
  accountName: string;
  createdAt: string;
  status: OrderStatus;
  templateId?: string;
  revision?: string;
  design?: object;
  basis?: DesignBasis;
  quote?: OrderQuote;
  orderedAt?: string;
};

export function orderSummary(order: Order) {
  const {id, workId, title, status, createdAt, basis, templateId, quote, orderedAt} = order;
  return {id, workId, title, status, createdAt, basis, templateId, quote, orderedAt};
}

async function readOrder(store: CommunityStore, owner: string, receiptId: string) {
  if (![owner, receiptId].every(value => /^[a-f0-9]{32}$/.test(value))) return fail(404, '申请不存在。');
  const key = 'orders/' + owner + '/' + receiptId + '.json';
  const saved = await store.get(communityRoot + key);
  if (!saved) return fail(404, '申请不存在。');
  const etag = saved.headers.get('etag');
  if (!etag) return fail(503, '暂时无法核实订单版本，请稍后重试。');
  return {key, etag, order: await saved.json() as Order};
}

export async function manageOrder(store: CommunityStore, owner: string, receiptId: string, action: string, input: Record<string, unknown>) {
  const {key, order, etag} = await readOrder(store, owner, receiptId);
  const stale = () => fail(409, '申请或报价已更新，请刷新后重新查看。');
  let updated: Order;
  if (action === 'quote') {
    if (input.expected !== order.status || (order.status !== '已受理' && order.status !== '已报价')
      || input.expectedQuoteVersion !== (order.quote?.version ?? null)) return stale();
    const {amountFen, description} = input;
    if (typeof amountFen !== 'number' || !Number.isSafeInteger(amountFen) || amountFen <= 0 || amountFen > maxQuoteFen)
      return fail(422, '请输入有效的人民币报价，金额精确到分。');
    if (typeof description !== 'string' || !description.trim() || description.trim().length > 500)
      return fail(422, '请填写 1–500 字的报价说明。');
    const quote: OrderQuote = {amountFen, currency: 'CNY', description: description.trim(), version: randomUUID(), issuedAt: new Date().toISOString()};
    updated = {...order, status: '已报价', quote};
  } else {
    const status = input.status;
    if (status !== '已受理' && status !== '已关闭') return fail(422, '处理状态无效。');
    if (status === order.status) return reply(orderSummary(order));
    if (input.expected !== order.status || order.status === '已关闭' || order.status === '已下单') return stale();
    if (order.status === '已报价' && (status !== '已关闭' || input.expectedQuoteVersion !== order.quote?.version)) return stale();
    updated = {...order, status};
  }
  if (!await putJson(store, key, updated, {etag})) return stale();
  return reply(orderSummary(updated));
}

export async function confirmOrder(store: CommunityStore, owner: string, receiptId: string, input: Record<string, unknown>) {
  const {key, order, etag} = await readOrder(store, owner, receiptId);
  const version = input.quoteVersion;
  if (typeof version !== 'string' || !order.quote || version !== order.quote.version)
    return fail(409, '报价已变更，请查看最新金额和说明后确认。');
  if (order.status === '已下单') return reply(orderSummary(order));
  if (order.status !== '已报价') return fail(409, '当前申请无法下单，请刷新状态。');

  // The accepted amount and terms come from the exact stored studio quote.
  const updated: Order = {...order, status: '已下单', orderedAt: new Date().toISOString()};
  if (await putJson(store, key, updated, {etag})) return reply(orderSummary(updated));
  const winner = await getJson<Order>(store, key);
  if (winner?.status === '已下单' && winner.quote?.version === version) return reply(orderSummary(winner));
  return fail(409, '申请或报价已更新，请重新核对后确认。');
}
