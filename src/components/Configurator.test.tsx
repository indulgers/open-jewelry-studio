import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useReducer, useState} from 'react';
import {describe, expect, it} from 'vitest';
import {configurationReducer,DEFAULT_CONFIGURATION} from '../configuration/configuration';
import {Configurator} from './Configurator';
import type {Quality} from '../viewer/quality';

function Harness({reference=false}:{reference?:boolean}={}){
  const [configuration,dispatch]=useReducer(configurationReducer,DEFAULT_CONFIGURATION);
  const [quality,onQualityChange]=useState<Quality>('standard');
  const [autoRotate,onAutoRotateChange]=useState(false);
  const [saved,setSaved]=useState('');
  return <><Configurator {...{configuration,dispatch,quality,onQualityChange,autoRotate,onAutoRotateChange}}
    reference={reference} onSave={()=>setSaved(JSON.stringify(configuration))} onResetView={()=>{}}/>
    <output aria-label="保存结果">{saved}</output></>;
}
describe('configuration panel',()=>{
  it('keeps fixed reference geometry honest while metal and saved DIY choices remain usable',async()=>{
    const user=userEvent.setup();render(<Harness reference/>);
    expect(screen.getByRole('radio',{name:'分叉戒臂'})).toBeDisabled();
    expect(screen.getByRole('radio',{name:'大'})).toBeDisabled();
    await user.click(screen.getByRole('radio',{name:'大'}));
    await user.click(screen.getByRole('radio',{name:'白金色'}));
    await user.click(screen.getByRole('button',{name:'保存到本机'}));
    expect(JSON.parse(screen.getByLabelText('保存结果').textContent!)).toMatchObject({stoneSize:'medium',metalFinish:'white'});
    expect(screen.getByText(/切换至.*参数化 DIY/)).toBeInTheDocument();
  });
  it('applies named choices and saves the actual chosen configuration',async()=>{
    const user=userEvent.setup();render(<Harness/>);
    await user.click(screen.getByRole('radio',{name:'玫瑰金色'}));
    await user.click(screen.getByRole('radio',{name:'分叉戒臂'}));
    await user.click(screen.getByRole('radio',{name:'大'}));
    expect(screen.getByRole('radio',{name:'玫瑰金色'})).toBeChecked();
    await user.click(screen.getByRole('button',{name:'保存到本机'}));
    expect(JSON.parse(screen.getByLabelText('保存结果').textContent!)).toEqual({schemaVersion:1,shankStyle:'split',metalFinish:'rose',stoneSize:'large'});
  });
  it('lets the user select quality and rotation without changing product fields',async()=>{
    const user=userEvent.setup();render(<Harness/>);
    await user.click(screen.getByRole('radio',{name:'高质量'}));
    expect(screen.getByRole('radio',{name:'高质量'})).toBeChecked();
    await user.click(screen.getByRole('checkbox',{name:'自动旋转'}));
    expect(screen.getByRole('checkbox',{name:'自动旋转'})).toBeChecked();
  });
});
