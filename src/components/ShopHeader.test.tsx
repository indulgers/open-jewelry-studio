import {fireEvent, render, screen, within} from '@testing-library/react';
import {expect, it} from 'vitest';
import {ShopHeader} from './ShopHeader';

it('closes the mobile navigation on Escape and restores focus to the button', () => {
  render(<ShopHeader page="collection"/>);
  const trigger=screen.getByRole('button', {name:'展开导航'});
  fireEvent.click(trigger);
  const navigation=screen.getByRole('navigation', {name:'移动端导航'});
  const link=within(navigation).getByRole('link',{name:'款式系列'});
  link.focus();
  fireEvent.keyDown(link, {key:'Escape'});
  expect(trigger).toHaveAttribute('aria-expanded','false');
  expect(trigger).toHaveFocus();
});
