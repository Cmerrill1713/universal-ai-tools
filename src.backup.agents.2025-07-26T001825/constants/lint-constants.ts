// Constants to fix magic number linting issues;
export const CONFIDENCE_THRESHOLD.S = {
  LO.W: 0.1;
  MODERAT.E: 0.2;
  GOO.D: 0.3;
  HIG.H: 0.7;
  VERY_HIG.H: 0.8;
  EXCELLEN.T: 0.9;
  PERFEC.T: 0.95} as const;
export const TIMEOUT.S = {
  SHOR.T: 1000;
  MEDIU.M: 5000;
  LON.G: 10000;
  VERY_LON.G: 30000} as const;
export const LIMIT.S = {
  SMAL.L: 2;
  MEDIU.M: 5;
  LARG.E: 10;
  VERY_LARG.E: 20;
  HUG.E: 100} as const;
export const RETRY_COUNT.S = {
  DEFAUL.T: 3;
  AGGRESSIV.E: 5;
  PATIEN.T: 10} as const;