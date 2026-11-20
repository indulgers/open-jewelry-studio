import {afterEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {FitSession} from './FitSession';
import {FitProfileForm} from './FitProfileForm';
import {NecklaceGuide} from './FitGuide';
import {newDesignFit} from './profile';

afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
it('restores optional local measurements and copies only the chosen size into new designs',async()=>{
  vi.stubGlobal('fetch',async()=>Response.json({account:null}));
  const page=render(<FitSession><FitProfileForm/></FitSession>);
  fireEvent.change(await screen.findByLabelText('身高（cm）'),{target:{value:'166'}});
  fireEvent.change(screen.getByLabelText('体重（kg）'),{target:{value:'53.5'}});
  fireEvent.change(screen.getByLabelText('常用圈号（美码）'),{target:{value:'6.25'}});
  fireEvent.click(screen.getByRole('button',{name:'保存佩戴资料'}));
  expect(newDesignFit('guest')).toEqual({ringSizeUS:6.25});
  page.unmount();
  render(<FitSession><FitProfileForm/></FitSession>);
  expect(await screen.findByLabelText('身高（cm）')).toHaveValue(166);
  expect(screen.getByLabelText('体重（kg）')).toHaveValue(53.5);
  expect(screen.getByLabelText('常用圈号（美码）')).toHaveValue('6.25');
  fireEvent.click(screen.getByRole('button',{name:'清除本机资料'}));
  expect(newDesignFit('guest')).toEqual({});
  expect(screen.getByLabelText('身高（cm）')).toHaveValue(null);
});
it('shows the wearing length range with and without an extender',()=>{
  render(<NecklaceGuide/>);
  fireEvent.change(screen.getByLabelText('主链含扣（cm）'),{target:{value:'42'}});
  expect(screen.getByText(/42–47 cm/)).toBeVisible();
  fireEvent.change(screen.getByLabelText('延长链（cm）'),{target:{value:'0'}});
  expect(screen.getByText(/示例可调长度\s+42 cm/)).toBeVisible();
});
