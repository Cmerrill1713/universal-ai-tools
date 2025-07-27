// Constants to fix magic number linting issues;
export const CONFIDENCE_THRESHOL.D.S = {
  L.O.W: 0.1,
  MODERA.T.E: 0.2,
  GO.O.D: 0.3,
  HI.G.H: 0.7,
  VERY_HI.G.H: 0.8,
  EXCELLE.N.T: 0.9,
  PERFE.C.T: 0.95} as const,
export const TIMEOU.T.S = {
  SHO.R.T: 1000,
  MEDI.U.M: 5000,
  LO.N.G: 10000,
  VERY_LO.N.G: 30000} as const,
export const LIMI.T.S = {
  SMA.L.L: 2,
  MEDI.U.M: 5,
  LAR.G.E: 10,
  VERY_LAR.G.E: 20,
  HU.G.E: 100} as const,
export const RETRY_COUN.T.S = {
  DEFAU.L.T: 3,
  AGGRESSI.V.E: 5,
  PATIE.N.T: 10} as const,