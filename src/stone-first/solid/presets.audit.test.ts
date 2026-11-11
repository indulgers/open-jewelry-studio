import {it,expect} from 'vitest';
import {recipeDesign,RECIPES} from '../recipe';
import {fuseDesign} from './manifoldFusion';
it.each(RECIPES)('keeps the default $id connected without certifying manufacture',async recipe=>{
 const result=await fuseDesign(recipeDesign(recipe.id));
 try{
  expect(result.report.status).toBe('fused');
  expect(result.report.connectedComponents).toBe(1);
  expect(result.report.manufacturingPassed).toBe(false);
 }finally{result.dispose();}
},120000);
