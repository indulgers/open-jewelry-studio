import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {FitSession,useFitScope} from './FitSession';
import {FitProfileForm} from './FitProfileForm';
import {newDesignFit} from './profile';
import {communityRequest,CUSTOMER_SESSION_CHANGED} from '../../community/client';

function Preview(){return <output aria-label="预填">{newDesignFit(useFitScope()).ringSizeUS??'无'}</output>;}
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
it('isolates member, guest, and unverified sessions through registration, same-tab logout and other-tab login',async()=>{
  localStorage.setItem('xiangyan:local-fit-profile:v1',JSON.stringify({heightCm:167,ringSizeUS:7.5}));
  let account:{name:string}|null=null;
  let offline=false;
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    if(offline)throw Error('offline');
    if(url.endsWith('/register'))account={name:'Alice'};
    if(url.endsWith('/logout'))account=null;
    return Response.json({account,...(account?{localProfileId:(account.name==='Alice'?'a':'b').repeat(32)}:{})});
  }));
  render(<FitSession><FitProfileForm/><Preview/></FitSession>);
  expect(await screen.findByLabelText('身高（cm）')).toHaveValue(167);
  await act(async()=>{await communityRequest('register',{name:'Alice',password:'example-pass'});});
  await waitFor(()=>expect(screen.getByLabelText('身高（cm）')).toHaveValue(null));
  expect(screen.getByLabelText('预填')).toHaveTextContent('无');
  fireEvent.change(screen.getByLabelText('身高（cm）'),{target:{value:'171'}});
  fireEvent.change(screen.getByLabelText('常用圈号（美码）'),{target:{value:'6.25'}});
  fireEvent.click(screen.getByRole('button',{name:'保存佩戴资料'}));
  account={name:'Bob'};
  await act(async()=>{window.dispatchEvent(new StorageEvent('storage',{key:CUSTOMER_SESSION_CHANGED}));});
  expect(screen.getByLabelText('身高（cm）')).toHaveValue(null);
  expect(screen.getByLabelText('预填')).toHaveTextContent('无');
  offline=true;
  await act(async()=>{window.dispatchEvent(new Event('focus'));});
  expect(screen.getByLabelText('身高（cm）')).not.toBeVisible();
  expect(screen.getByLabelText('预填')).not.toBeVisible();
  offline=false;
  await act(async()=>{await communityRequest('logout',{});});
  expect(screen.getByLabelText('身高（cm）')).toHaveValue(167);
  expect(screen.getByLabelText('预填')).toHaveTextContent('7.5');
  account={name:'Alice'};
  await act(async()=>{window.dispatchEvent(new StorageEvent('storage',{key:CUSTOMER_SESSION_CHANGED}));});
  expect(screen.getByLabelText('身高（cm）')).toHaveValue(171);
  expect(screen.getByLabelText('预填')).toHaveTextContent('6.25');
});

it('ignores a former member response that arrives after another tab signed out',async()=>{
  let release:(value:Response)=>void=()=>{};
  const first=new Promise<Response>(resolve=>{release=resolve;});
  vi.stubGlobal('fetch',vi.fn().mockReturnValueOnce(first).mockImplementation(async()=>Response.json({account:null})));
  localStorage.setItem('xiangyan:local-fit-profile:v1',JSON.stringify({ringSizeUS:7}));
  render(<FitSession><Preview/></FitSession>);
  await act(async()=>{window.dispatchEvent(new StorageEvent('storage',{key:CUSTOMER_SESSION_CHANGED}));});
  expect(screen.getByLabelText('预填')).toHaveTextContent('7');
  await act(async()=>{release(Response.json({account:{name:'Previous'},localProfileId:'c'.repeat(32)}));});
  expect(screen.getByLabelText('预填')).toHaveTextContent('7');
});

it('keeps the mounted editing surface and pending input when the same session is rechecked',async()=>{
  let release:(response:Response)=>void=()=>{};
  const pending=new Promise<Response>(resolve=>{release=resolve;});
  const authenticated=()=>Response.json({account:{name:'alice'},localProfileId:'a'.repeat(32)});
  const fetchSession=vi.fn().mockImplementationOnce(async()=>authenticated()).mockReturnValueOnce(pending).mockRejectedValueOnce(Error('offline')).mockImplementationOnce(async()=>authenticated());
  vi.stubGlobal('fetch',fetchSession);
  render(<FitSession><label>未确认刻字<input/></label><canvas aria-label="戒指画布"/></FitSession>);
  const field=await screen.findByLabelText('未确认刻字');
  const canvas=screen.getByLabelText('戒指画布');
  fireEvent.change(field,{target:{value:'还在编辑'}});
  await act(async()=>{window.dispatchEvent(new Event('focus'));});
  expect(canvas.isConnected).toBe(true);
  expect(canvas).toBeVisible();
  expect(field).toHaveValue('还在编辑');
  await act(async()=>{document.dispatchEvent(new Event('visibilitychange'));});
  expect(fetchSession).toHaveBeenCalledTimes(2);
  await act(async()=>{release(authenticated());});
  expect(screen.getByLabelText('戒指画布')).toBe(canvas);
  expect(screen.getByLabelText('未确认刻字')).toHaveValue('还在编辑');
  await act(async()=>{window.dispatchEvent(new Event('focus'));});
  expect(canvas).not.toBeVisible();
  expect(screen.getByText('暂时无法确认账号，佩戴资料已锁定。')).toBeVisible();
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'重新读取'}));});
  expect(screen.getByLabelText('戒指画布')).toBe(canvas);
  expect(field).toBeVisible();expect(field).toHaveValue('还在编辑');
});

it('immediately covers the previous session if an account change interrupts a background check',async()=>{
  const account=(id:string)=>Response.json({account:{name:id},localProfileId:id.repeat(32)});
  let finishResume!:(response:Response)=>void;
  let finishSwitch!:(response:Response)=>void;
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(account('a'))
    .mockImplementationOnce(()=>new Promise(resolve=>{finishResume=resolve;}))
    .mockImplementationOnce(()=>new Promise(resolve=>{finishSwitch=resolve;})));
  render(<FitSession><Preview/></FitSession>);
  const previous=await screen.findByLabelText('预填');
  await act(async()=>{window.dispatchEvent(new Event('focus'));});
  expect(previous).toBeVisible();
  await act(async()=>{window.dispatchEvent(new StorageEvent('storage',{key:CUSTOMER_SESSION_CHANGED}));});
  expect(previous).not.toBeVisible();
  await act(async()=>{finishResume(account('a'));});
  expect(previous).not.toBeVisible();
  await act(async()=>{finishSwitch(account('b'));});
  expect(previous.isConnected).toBe(false);
  expect(screen.getByLabelText('预填')).toBeVisible();
});
