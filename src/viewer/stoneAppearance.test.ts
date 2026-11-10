import {describe,expect,it} from 'vitest';
import {STONE_APPEARANCES,STONE_APPEARANCE_IDS} from './stoneAppearance';
describe('stone-first optical previews',()=>{
  it('has four bounded material study presets with colour and IOR',()=>{
    expect(STONE_APPEARANCE_IDS).toEqual(['diamond','sapphire','ruby','emerald']);
    for(const appearance of STONE_APPEARANCE_IDS){
      const gem=STONE_APPEARANCES[appearance];
      expect(gem.ior).toBeGreaterThan(1);
      expect(gem.ior).toBeLessThan(3);
      expect(gem.absorptionDistance).toBeGreaterThan(0);
      expect(gem.dispersionScale).toBeGreaterThanOrEqual(0);
      expect(gem.transmittance).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(STONE_APPEARANCES.diamond.ior).toBeGreaterThan(STONE_APPEARANCES.sapphire.ior);
  });
});
