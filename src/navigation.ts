export const BEFORE_ROUTE_CHANGE='xiangyan:before-route-change';
export type RouteChangeEvent=CustomEvent<{oldURL:string;newURL:string}>;
