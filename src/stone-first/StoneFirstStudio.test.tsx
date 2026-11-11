import {fireEvent,render,screen} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import {StoneFirstStudio} from './StoneFirstStudio';
vi.mock('./StoneFirstStage',()=>({StoneFirstStage:()=> <div data-testid="stone-stage">3D render mounted</div>}));
describe('stone-first five-step editor',()=>{
 it('offers all five steps and editable settings with 3D viewer mounted',()=>{
  render(<StoneFirstStudio/>);
  expect(screen.getAllByRole('button',{name:/戒指结构原型|造型语言|参数化组合|宝石镶嵌|设计与工艺校验/})).toHaveLength(5);
  expect(screen.getByTestId('stone-stage')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/造型语言/}));
  expect(screen.getByRole('button',{name:/建筑结构/})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/参数化组合/}));
  expect(screen.getByText('模组重复')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/宝石镶嵌/}));
  expect(screen.getByRole('button',{name:'局部密镶'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'包镶'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/设计与工艺校验/}));
  expect(screen.getByText('工业 CAD 验证尚未完成')).toBeInTheDocument();
 });
});
