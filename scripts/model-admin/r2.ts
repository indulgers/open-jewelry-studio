import {spawn} from 'node:child_process';

export function createR2(env: Record<string,string>) {
  const values = ['ACCOUNT_ID','BUCKET','ACCESS_KEY_ID','SECRET_ACCESS_KEY'].map(key => env['XIANGYAN_R2_'+key]);
  if (values.every(value => !value)) return;
  const [account,bucket,key,secret] = values;
  if (!/^[a-f0-9]{32}$/i.test(account??'') || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket??'') ||
      ![key,secret].every(value => /^[a-zA-Z0-9/+_=.-]+$/.test(value??''))) {
    throw new Error('R2 配置不完整，请检查账号、桶名和访问密钥。');
  }
  const endpoint = 'https://'+account+'.r2.cloudflarestorage.com/'+bucket;
  function request(object:string,file:string,upload:boolean){
    const url=endpoint+'/'+object.split('/').map(encodeURIComponent).join('/');
    const args=upload?['--upload-file',file,'--output','/dev/null']:['--max-filesize','33554432','--output',file];
    // Pass credentials through stdin so they stay out of process arguments and logs.
    return new Promise<void>((resolve,reject)=>{
      const curl=spawn('curl',['-q','--config','-','--silent','--fail','--max-time','60',
        '--aws-sigv4','aws:amz:auto:s3',...args,url],{stdio:['pipe','ignore','ignore']});
      curl.once('error',reject);
      curl.once('close',code=>code===0?resolve():reject(new Error('R2 访问失败。请检查权限和网络后重试。')));
      curl.stdin.on('error',reject);
      curl.stdin.end('user = "'+key+':'+secret+'"\n');
    });
  }
  return {put:(object:string,file:string)=>request(object,file,true),
    get:(object:string,file:string)=>request(object,file,false)};
}
