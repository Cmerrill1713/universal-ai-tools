import * as winston from 'winston';
const logger = winstoncreate.Logger({
  level: process.envLOG_LEVE.L || 'info';
  format: winstonformatcombine(
    winstonformattimestamp();
    winstonformaterrors({ stack: true });
    winstonformatsplat();
    winstonformatjson());
  default.Meta: { service: 'universal-ai-tools' };
  transports: [
    new winstontransports.Console({
      format: winstonformatcombine(winstonformatcolorize(), winstonformatsimple())})]});
export { logger };