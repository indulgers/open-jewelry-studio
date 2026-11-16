import type {ReferenceDesign} from './reference/design';
import type {ReferenceAssets} from './reference/part-library';
import type {CatalogRing} from './catalog';

export type DesignInput={id:string;revision:string;expectedRevision:string|null;templateId:string;head:{id:string;revision:string};band:{id:string;revision:string};design:ReferenceDesign;thumbnail?:string};
export type ConfigurationCheck={revision:string;state:'manual'|'incomplete';issues:{field:string;message:string}[];quote:{amount:number;currency:'CNY';version:string;leadTime:string};purchasable:false};
export type SavedDesign=Omit<DesignInput,'expectedRevision'>&{savedAt:string;name:string;check:ConfigurationCheck;assets:{head:ReferenceAssets;band:ReferenceAssets};templates:{head:CatalogRing;band:CatalogRing}};
export type ReviewStatus='pending'|'needs-information'|'declined'|'quoted'|'confirmed';
export type LetteringReview={fontId:string;fontVersion:string;licenseEvidence:string;position:'inner-band';alignment:'left'|'center'|'right';direction:'forward'|'reverse';heightMm:number;minHeightMm:number;textWidthMm:number;areaWidthMm:number};
export type ProductionFile={id:string;name:string;sha256:string;size:number;uploadedAt:string};
export type FormalQuote={amount:number;currency:'CNY';validUntil:string;leadTime:string;productionRequirements:string;reviewer:string;lettering?:LetteringReview};
export type DesignRequest={id:string;design:SavedDesign;status:ReviewStatus;stateRevision:string;createdAt:string;updatedAt:string;note:string;productionFile?:ProductionFile;quote?:FormalQuote;confirmedAt?:string;history:{at:string;status:ReviewStatus;reviewer:string;note:string}[]};
