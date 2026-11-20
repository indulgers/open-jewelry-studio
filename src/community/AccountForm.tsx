import {useState} from 'react';
import {communityRequest,errorText,type Account} from './client';

export function AccountForm({onSuccess,deferLocalAccountNotice=false,pageMode}:{onSuccess:(account:Account)=>void;deferLocalAccountNotice?:boolean;pageMode?:'register'|'login'}){
  const [localRegister,setRegister]=useState(false);
  const register=pageMode?pageMode==='register':localRegister;
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const nextMode=(mode:string)=>{
    const params=new URLSearchParams(window.location.hash.split('?')[1]);
    params.set('auth',mode);
    return '#/my-designs?'+params.toString();
  };
  return <form className="community-form" onSubmit={async event=>{
    event.preventDefault();
    if(busy)return;
    const data=new FormData(event.currentTarget);
    setBusy(true);setError('');
    try{
      const result=await communityRequest<{account:Account}>(register?'register':'login',
        {name:String(data.get('name')).trim(),password:data.get('password')},undefined,undefined,deferLocalAccountNotice);
      onSuccess(result.account);
    }catch(cause){setError(errorText(cause));}finally{setBusy(false);}
  }}>
    {pageMode&&<nav className="account-modes" aria-label="账号入口">
      <a href={nextMode('login')} aria-current={!register?'page':undefined}>登录</a>
      <a href={nextMode('register')} aria-current={register?'page':undefined}>注册账号</a>
    </nav>}
    <label>账号名<input required name="name" autoComplete="username" minLength={3} maxLength={32}
      pattern="[a-zA-Z0-9_]{3,32}" title="3–32 位字母、数字或下划线"/></label>
    <label>密码<input required name="password" type="password" minLength={register?10:1} maxLength={128}
      autoComplete={register?'new-password':'current-password'}/></label>
    {register&&<small>账号名可用 3–32 位字母、数字或下划线。密码至少 10 位。</small>}
    {error&&<p role="alert">{error}</p>}
    <div className="community-actions"><button disabled={busy} className="shop-button">{register?'注册账号':'登录'}</button>
    {!pageMode&&<button type="button" className="shop-text-link" disabled={busy} onClick={()=>{setRegister(!register);setError('');}}>
      {register?'已有账号，去登录':'创建消费者账号'}</button>}</div>
  </form>;
}

export function AccountPanel({mode,onSuccess}:{mode:'register'|'login';onSuccess?:(account:Account)=>void}){
  const pending=!onSuccess;
  return <section className="community-auth" inert={pending} aria-hidden={pending||undefined}>
    <h2>相言账户</h2><p>登录后可以保存设计、发布作品和查看报价。</p>
    <AccountForm key={mode} pageMode={mode} onSuccess={onSuccess??(()=>{})}/>
  </section>;
}
