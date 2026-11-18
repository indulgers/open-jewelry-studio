import {fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {DiyHome} from './DiyHome';

afterEach(() => {vi.unstubAllGlobals();vi.unstubAllEnvs();});

it('lets a visitor compare the published wearing illustration and original without leaving the featured ring', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json([{
    id: 'rose', name: '玫瑰戒指', revision: 'v1', featured: true,
    campaign: '/wearing.jpg', image: '/original.jpg',
  }])));
  render(<DiyHome/>);
  await screen.findByRole('heading', {name: /让心意/});
  fireEvent.click(screen.getByRole('button', {name: '原款图'}));
  expect(screen.getByRole('img', {name: '玫瑰戒指原款图'})).toHaveAttribute('src', '/original.jpg');
  expect(screen.getByRole('button', {name: '原款图'})).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', {name: '佩戴图'}));
  expect(within(screen.getByRole('region',{name:/让心意/})).getByRole('img', {name: '玫瑰戒指 AI 佩戴示意'})).toHaveAttribute('src', '/wearing.jpg');
});

it('shows the bundled rings in local development when nothing has been published', async () => {
  vi.stubEnv('DEV',true);
  vi.stubEnv('VITE_CLOUD_MODE','');
  vi.stubGlobal('fetch', vi.fn(async () => Response.json([])));
  render(<DiyHome/>);
  await screen.findByRole('heading', {name: /让心意/});
  expect(screen.getByRole('link',{name:'开始专属定制'})).toHaveAttribute('href','#/stonefirst/ring-02');
  fireEvent.click(screen.getByRole('button',{name:'原款图'}));
  expect(screen.getByRole('img',{name:'围钻戒指原款图'})).toHaveAttribute('src','/media/diy/ring-02.jpg');
});
