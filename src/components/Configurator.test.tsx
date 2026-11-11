import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useReducer, useState} from 'react';
import {describe, expect, it} from 'vitest';
import {configurationReducer,DEFAULT_CONFIGURATION} from '../configuration/configuration';
import {Configurator} from './Configurator';
import type {Quality} from '../viewer/quality';

function Harness({hideStructure=false}:{hideStructure?:boolean}={}){
  const [configuration,dispatch]=useReducer(configurationReducer,DEFAULT_CONFIGURATION);
  const [quality,onQualityChange]=useState<Quality>('standard');
  const [autoRotate,onAutoRotateChange]=useState(false);
  return <><Configurator {...{configuration,dispatch,quality,onQualityChange,autoRotate,onAutoRotateChange}}
    hideStructure={hideStructure} onResetEditing={()=>dispatch({type:'reset'})} onResetView={()=>{}}/>
    <output aria-label="当前参数">{JSON.stringify(configuration)}</output></>;
}
describe('configuration panel',()=>{
  it('hides structure controls for fixed models and keeps the silver finish',async()=>{
    render(<Harness hideStructure/>);
    expect(screen.queryByRole('radio',{name:'分叉戒臂'})).not.toBeInTheDocument();
    expect(screen.queryByRole('radio',{name:'大'})).not.toBeInTheDocument();
    expect(screen.queryByRole('group',{name:/金属外观/})).not.toBeInTheDocument();
    expect(JSON.parse(screen.getByLabelText('当前参数').textContent!)).toMatchObject({stoneSize:'medium',metalFinish:'white'});
  });
  it('resets edited fields to defaults without a save entry',async()=>{
    const user=userEvent.setup();render(<Harness/>);
    await user.click(screen.getByRole('radio',{name:'分叉戒臂'}));
    await user.click(screen.getByRole('radio',{name:'大'}));
    expect(screen.queryByRole('button',{name:'保存到本机'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'重置编辑'}));
    expect(JSON.parse(screen.getByLabelText('当前参数').textContent!)).toEqual(DEFAULT_CONFIGURATION);
  });
  it('lets the user select quality and rotation without changing product fields',async()=>{
    const user=userEvent.setup();render(<Harness/>);
    await user.click(screen.getByRole('radio',{name:'高质量'}));
    expect(screen.getByRole('radio',{name:'高质量'})).toBeChecked();
    await user.click(screen.getByRole('checkbox',{name:'自动旋转'}));
    expect(screen.getByRole('checkbox',{name:'自动旋转'})).toBeChecked();
  });
});
