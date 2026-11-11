export type ShellMeasurement={volume:number;bounds:{min:number[];max:number[]}};
/** Only zero-volume, sub-0.01 mm CSG debris may be removed. A real detached
 * bead is orders of magnitude larger and MUST still block metal export.
 * Scene units are 0.1/mm; this is a numerical threshold, not a jeweler's tolerance. */
export function isNumericalShell({volume,bounds}:ShellMeasurement):boolean{
 const extent=bounds.max.map((v,i)=>v-bounds.min[i]);
 return Number.isFinite(volume)&&Math.abs(volume)<1e-14&&
   extent.length===3&&extent.every(v=>Number.isFinite(v)&&v>=0&&v<1e-3);
}
