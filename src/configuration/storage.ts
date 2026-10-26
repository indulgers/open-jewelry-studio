import {DEFAULT_CONFIGURATION,parseConfiguration,type Configuration} from './configuration';
export const STORAGE_KEY='jewelry-demo.configuration.v1';
export function loadConfiguration(storage:Pick<Storage,'getItem'>):{configuration:Configuration;warning:string|null}{
  try{
    const raw=storage.getItem(STORAGE_KEY);
    if(raw===null)return {configuration:{...DEFAULT_CONFIGURATION},warning:null};
    const configuration=parseConfiguration(JSON.parse(raw));
    if(configuration)return {configuration,warning:null};
  }catch{/* Storage may be unavailable or malformed. */}
  return {configuration:{...DEFAULT_CONFIGURATION},warning:'未能恢复本机配置，已使用默认选项。'};
}
export function saveConfiguration(storage:Pick<Storage,'setItem'>,value:Configuration):{ok:boolean;warning:string|null}{
  try{storage.setItem(STORAGE_KEY,JSON.stringify(value));return {ok:true,warning:null};}
  catch{return {ok:false,warning:'浏览器未允许保存，请检查存储设置。'};}
}
