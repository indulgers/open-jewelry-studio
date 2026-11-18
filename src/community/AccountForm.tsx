import {useState} from 'react';
import {communityRequest,errorText,type Account} from './client';

export function AccountForm({onSuccess,deferLocalAccountNotice=false}:{onSuccess:(account:Account)=>void;deferLocalAccountNotice?:boolean}){
  const [register,setRegister]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
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
    <label>账号名<input required name="name" autoComplete="username" minLength={3} maxLength={32}
      pattern="[a-zA-Z0-9_]{3,32}" title="3–32 位字母、数字或下划线"/></label>
    <label>密码<input required name="password" type="password" minLength={register?10:1} maxLength={128}
      autoComplete={register?'new-password':'current-password'}/></label>
    {register&&<small>账号名可用 3–32 位字母、数字或下划线。密码至少 10 位。</small>}
    {error&&<p role="alert">{error}</p>}
    <div className="community-actions"><button disabled={busy} className="shop-button">{register?'注册账号':'登录'}</button>
    <button type="button" className="shop-text-link" disabled={busy} onClick={()=>{setRegister(!register);setError('');}}>
      {register?'已有账号，去登录':'创建消费者账号'}</button></div>
  </form>;
}
