// @vitest-environment node
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {communityApi} from './community.ts';
import {communityRoot, putJson} from './community-account.ts';
import {localCommunityStore} from './community-store.ts';

it('only converts the buyer’s current studio price into one immutable unpaid order', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-quotes-'));
  try {
    const store = localCommunityStore(dir);
    const origin = 'http://localhost';
    const request = (path: string, body?: object, cookie = '', admin = false) =>
      communityApi(new Request(origin + '/api/model-admin/community/' + path, {
        method: body ? 'POST' : 'GET', headers: {origin, cookie, 'content-type': 'application/json'},
        body: body && JSON.stringify(body),
      }), path, store, admin);
    async function register(name: string) {
      const registered = await request('register', {name, password: 'isolated-test-password'});
      expect(registered.status).toBe(201);
      const cookie = registered.headers.get('set-cookie')!.split(';')[0];
      const {localProfileId} = await (await request('session', undefined, cookie)).json();
      return {cookie, owner: localProfileId};
    }
    const buyer = await register('buyer001'), other = await register('buyer002');
    const id = '7'.repeat(32), key = 'orders/' + buyer.owner + '/' + id + '.json';
    const initial = {id, owner: buyer.owner, workId: 'work', accountName: 'buyer001', title: '花环戒指',
      status: '待人工核价', createdAt: '2026-11-19T00:00:00Z'};
    await putJson(store, key, initial);
    const adminRoute = 'admin/orders/' + buyer.owner + '/' + id + '/';
    const quote = {expected: '已受理', expectedQuoteVersion: null, amountFen: 129099, description: ' 一枚银戒，含刻字和配送。 '};
    expect((await request(adminRoute + 'quote', quote, buyer.cookie)).status).toBe(401);
    expect((await request(adminRoute + 'quote', quote, '', true)).status).toBe(409);
    expect((await request(adminRoute + 'status', {expected: '待人工核价', status: '已受理'}, '', true)).status).toBe(200);
    for (const amountFen of [0, -2, 50.5, 100_000_001, '1290.99'])
      expect((await request(adminRoute + 'quote', {...quote, amountFen}, '', true)).status).toBe(422);
    for (const description of ['', '  ', '字'.repeat(501)])
      expect((await request(adminRoute + 'quote', {...quote, description}, '', true)).status).toBe(422);
    const issued = await request(adminRoute + 'quote', quote, '', true);
    expect(issued.status).toBe(200);
    const first = (await issued.json()).quote;
    expect(first).toMatchObject({amountFen: 129099, currency: 'CNY', description: quote.description.trim()});
    const revise = {...quote, expected: '已报价', expectedQuoteVersion: first.version, amountFen: 125050, description: '一枚银戒，含刻字，自提。'};
    const revisions = await Promise.all([request(adminRoute + 'quote', revise, '', true), request(adminRoute + 'quote', revise, '', true)]);
    expect(revisions.map(r => r.status).sort()).toEqual([200, 409]);
    const latest = (await revisions.find(r => r.ok)!.json()).quote;
    expect(latest.version).not.toEqual(first.version);
    expect((await request(adminRoute + 'status', {expected: '已报价', status: '已关闭', expectedQuoteVersion: first.version}, '', true)).status).toBe(409);
    const confirmRoute = 'orders/' + id + '/confirm';
    const confirm = {expectedAccount: 'buyer001', quoteVersion: latest.version, amountFen: 1};
    expect((await request(confirmRoute, confirm)).status).toBe(401);
    expect((await request(confirmRoute, confirm, other.cookie)).status).toBe(409);
    expect((await request(confirmRoute, {...confirm, expectedAccount: 'buyer002'}, other.cookie)).status).toBe(404);
    expect((await request(confirmRoute, {...confirm, quoteVersion: first.version}, buyer.cookie)).status).toBe(409);
    const confirmed = await Promise.all([request(confirmRoute, confirm, buyer.cookie), request(confirmRoute, confirm, buyer.cookie)]);
    expect(confirmed.map(r => r.status)).toEqual([200, 200]);
    const [one, two] = await Promise.all(confirmed.map(r => r.json()));
    expect(one).toEqual(two);
    expect(one).toMatchObject({id, status: '已下单', quote: latest, orderedAt: expect.any(String)});
    expect((await request(adminRoute + 'status', {expected: '已下单', status: '已关闭'}, '', true)).status).toBe(409);
    expect((await request(adminRoute + 'quote', {...revise, expected: '已下单', expectedQuoteVersion: latest.version}, '', true)).status).toBe(409);
    expect(await (await request('orders', undefined, buyer.cookie)).json()).toEqual([one]);
    expect(await (await request('orders', undefined, other.cookie)).json()).toEqual([]);
    expect(await store.list(communityRoot + 'orders/')).toHaveLength(1);
    const closedId = '8'.repeat(32);
    await putJson(store, 'orders/' + buyer.owner + '/' + closedId + '.json', {...initial, id: closedId, quote: latest, status: '已报价'});
    const closed = await request(adminRoute.replace(id, closedId) + 'status', {expected: '已报价', status: '已关闭', expectedQuoteVersion: latest.version}, '', true);
    expect(closed.status).toBe(200);
    expect((await request(confirmRoute.replace(id, closedId), confirm, buyer.cookie)).status).toBe(409);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

it('serves the public gallery with bounded reads and without a customer session lookup', async () => {
  const entries = Array.from({length: 25}, (_, i) => 'published/' + i + '.json');
  let inFlight = 0, peak = 0;
  const store = {
    ...localCommunityStore('/unused-test-directory'),
    async list() { return entries; },
    async get(key: string) {
      if (!entries.includes(key)) throw new Error('unexpected private read');
      peak = Math.max(peak, ++inFlight);
      await Promise.resolve();
      inFlight--;
      return Response.json({work: {id: key, createdAt: '2026-11-19'}});
    },
  };
  const req = new Request('http://localhost/api/model-admin/community/works', {headers: {cookie: 'xiangyan-customer=' + 'a'.repeat(64)}});
  const response = await communityApi(req, 'works', store, false);
  expect(response.status).toBe(200);
  expect(await response.json()).toHaveLength(25);
  expect(peak).toBeLessThanOrEqual(8);
});
