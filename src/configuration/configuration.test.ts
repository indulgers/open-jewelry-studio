import { describe, expect, it } from 'vitest';
import { configurationReducer, DEFAULT_CONFIGURATION, parseConfiguration } from './configuration';
import { loadConfiguration, saveConfiguration, STORAGE_KEY } from './storage';

describe('configuration', () => {
  it('changes one choice without losing earlier selections', () => {
    const first = configurationReducer(DEFAULT_CONFIGURATION, {type:'set-shank', value:'split'});
    const second = configurationReducer(first, {type:'set-metal', value:'rose'});
    expect(second).toEqual({schemaVersion:1, shankStyle:'split', metalFinish:'rose', stoneSize:'medium'});
    expect(configurationReducer(second, {type:'reset'})).toEqual(DEFAULT_CONFIGURATION);
  });
  it.each([
    null, [], {}, {...{schemaVersion:1, shankStyle:'plain', metalFinish:'yellow', stoneSize:'medium'}, schemaVersion:8},
    {schemaVersion:1, shankStyle:'plain', metalFinish:'yellow', stoneSize:'enormous'},
  ])('rejects unsupported or damaged saved input %j', input => {
    expect(parseConfiguration(input)).toBeNull();
  });
  it('returns only approved fields from valid persisted input', () => {
    expect(parseConfiguration({...DEFAULT_CONFIGURATION, price:0, arbitrary:'ignored'})).toEqual(DEFAULT_CONFIGURATION);
  });
  it.each(['shankStyle','metalFinish','stoneSize'] as const)('rejects coerced arrays in %s',field=>{
    expect(parseConfiguration({...DEFAULT_CONFIGURATION,[field]:[DEFAULT_CONFIGURATION[field]]})).toBeNull();
  });
});

describe('local persistence', () => {
  it('restores a valid saved choice and uses the dedicated key', () => {
    const saved = {...DEFAULT_CONFIGURATION, metalFinish:'white'};
    const values = new Map<string,string>();
    const storage = {getItem:(key:string)=>values.get(key)??null, setItem:(key:string,value:string)=>{values.set(key,value);}};
    expect(saveConfiguration(storage, saved as typeof DEFAULT_CONFIGURATION).ok).toBe(true);
    expect(values.has(STORAGE_KEY)).toBe(true);
    expect(loadConfiguration(storage).configuration.metalFinish).toBe('white');
  });
  it('falls back for corrupt or unreadable data and explains recovery', () => {
    for (const storage of [
      {getItem:()=>'{broken'},
      {getItem:()=>{throw new Error('blocked');}},
      {getItem:()=>JSON.stringify({schemaVersion:999})},
    ]) {
      expect(loadConfiguration(storage).configuration).toEqual(DEFAULT_CONFIGURATION);
      expect(loadConfiguration(storage).warning).toBeTruthy();
    }
    expect(loadConfiguration({getItem:()=>null}).warning).toBeNull();
  });
  it('reports storage failure without crashing the configurator', () => {
    expect(saveConfiguration({setItem:()=>{throw new Error('quota');}}, DEFAULT_CONFIGURATION).ok).toBe(false);
  });
});
