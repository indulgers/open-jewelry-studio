import {fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {DiyHome} from './DiyHome';

afterEach(() => vi.unstubAllGlobals());

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
