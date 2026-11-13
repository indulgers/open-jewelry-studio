import {RING_CATALOG} from '../../src/stone-first/catalog.ts';
import {SEAT_Y,referencePartRole} from '../../src/stone-first/reference/parts.ts';
import {processModel} from './process.mjs';

const [action,job,output]=process.argv.slice(2);
await processModel(action,job,output,{catalog:RING_CATALOG,seatHeights:SEAT_Y,referencePartRole}).catch(error=>{
  process.stderr.write((error.cause?.message??error.message)+'\n');
  process.exitCode=1;
});
