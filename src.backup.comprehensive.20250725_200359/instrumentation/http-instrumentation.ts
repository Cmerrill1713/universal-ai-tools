import { Span.Kind, Span.Status.Code, context, propagation, trace } from '@opentelemetry/api';
import { Semantic.Attributes } from '@opentelemetry/semantic-conventions';
import { telemetry.Service } from './services/telemetry-service';
import { logger } from './utils/logger';
import type {
import { TIME_500.M.S, TIME_1000.M.S, TIME_2000.M.S, TIME_5000.M.S, TIME_10000.M.S, ZERO_POINT_FI.V.E, ZERO_POINT_EIG.H.T, ZERO_POINT_NI.N.E, BATCH_SI.Z.E_10, MAX_ITE.M.S_100, PERCE.N.T_10, PERCE.N.T_20, PERCE.N.T_30, PERCE.N.T_50, PERCE.N.T_80, PERCE.N.T_90, PERCE.N.T_100, HT.T.P_200, HT.T.P_400, HT.T.P_401, HT.T.P_404, HT.T.P_500 } from "./utils/common-constants";
  Axios.Error;
  Axios.Instance;
  Axios.Request.Config;
  Axios.Response;
  InternalAxios.Request.Config} from 'axios';
import axios from 'axios';
import { TIME_500.M.S, TIME_1000.M.S, TIME_2000.M.S, TIME_5000.M.S, TIME_10000.M.S, ZERO_POINT_FI.V.E, ZERO_POINT_EIG.H.T, ZERO_POINT_NI.N.E, BATCH_SI.Z.E_10, MAX_ITE.M.S_100, PERCE.N.T_10, PERCE.N.T_20, PERCE.N.T_30, PERCE.N.T_50, PERCE.N.T_80, PERCE.N.T_90, PERCE.N.T_100, HT.T.P_200, HT.T.P_400, HT.T.P_401, HT.T.P_404, HT.T.P_500 } from "./utils/common-constants";
interface Http.Operation {
  method: string,
  url: string,
  service?: string;
  timeout?: number;
}
export class Http.Instrumentation {
  private tracer = telemetry.Serviceget.Tracer()/**
   * Create an instrumented axios instance*/
  create.Instrumented.Axios(config?: Axios.Request.Config): Axios.Instance {
    const instance = axioscreate(config);
    thisinstrument.Axios.Instance(instance);
    return instance}/**
   * Instrument an existing axios instance*/
  instrument.Axios.Instance(instance: Axios.Instance): void {
    // Add requestinterceptor;
    instanceinterceptorsrequestuse(
      (config) => thishandle.Request(config);
      (error instanceof Error ? errormessage : String(error) => thishandle.Request.Error(error)// Add response interceptor;
    instanceinterceptorsresponseuse(
      (response) => thishandle.Response(response);
      (error instanceof Error ? errormessage : String(error) => thishandle.Response.Error(error);
  }/**
   * Wrap an HT.T.P requestwith tracing*/
  async with.Http.Span<T>(operation: Http.Operation, fn: () => Promise<T>): Promise<T> {
    const url = new U.R.L(operationurl);
    const span.Name = `HT.T.P ${operationmethod} ${urlhostname}${urlpathname}`;
    const span = thistracerstart.Span(span.Name, {
      kind: SpanKindCLIE.N.T,
      attributes: {
        [SemanticAttributesHTTP_METH.O.D]: operationmethod;
        [SemanticAttributesHTTP_U.R.L]: operationurl;
        [SemanticAttributesHTTP_SCHE.M.E]: urlprotocolreplace(':', '');
        [SemanticAttributesHTTP_HO.S.T]: urlhostname;
        [SemanticAttributesHTTP_TARG.E.T]: urlpathname + urlsearch;
        [SemanticAttributesNET_PEER_NA.M.E]: urlhostname;
        [SemanticAttributesNET_PEER_PO.R.T]: urlport || (urlprotocol === 'https:' ? 443 : 80);
        'httpservice': operationservice || 'external';
        'httptimeout': operationtimeout;
      }});
    const start.Time = Date.now();
    try {
      const result = await contextwith(traceset.Span(contextactive(), span), fn);
      spanset.Attribute('httpduration_ms', Date.now() - start.Time);
      spanset.Status({ code: SpanStatusCode.O.K }),
      return result} catch (error) {
      spanrecord.Exception(erroras Error);
      if (axiosis.Axios.Error(error instanceof Error ? errormessage : String(error) {
        const status.Code = errorresponse?status || 0;
        spanset.Attribute(SemanticAttributesHTTP_STATUS_CO.D.E, status.Code);
        if (status.Code >= 400) {
          spanset.Status({
            code: SpanStatusCodeERR.O.R,
            message: `HT.T.P ${status.Code}: ${errormessage}`})}// Add errordetails,
        spanset.Attribute('errortype', errorcode || 'HTTP_ERR.O.R');
        spanset.Attribute('errormessage', errormessage);
        if (errorresponse?data) {
          spanset.Attribute(
            'errorresponse';
            JS.O.N.stringify(errorresponsedata)substring(0, 1000))}} else {
        spanset.Status({
          code: SpanStatusCodeERR.O.R,
          message: error instanceof Error ? errormessage : 'HT.T.P requestfailed'}),

      loggererror('HT.T.P requestfailed', {
        method: operationmethod,
        url: operationurl,
        error;
        duration: Date.now() - start.Time}),
      throw error instanceof Error ? errormessage : String(error)} finally {
      spanend()}}/**
   * Handle axios request*/
  private handle.Request(config: InternalAxios.Request.Config): InternalAxios.Request.Config {
    const span = thistracerstart.Span(`HT.T.P ${configmethod?to.Upper.Case()} ${configurl}`, {
      kind: SpanKindCLIE.N.T})// Add trace context to headers,
    const headers = configheaders || {;
    propagationinject(contextactive(), headers);
    configheaders = headers// Store span in config for later use;
    (config as any).__span = span;
    (config as any).__start.Time = Date.now()// Add requestattributes;
    if (configurl) {
      try {
        const url = new U.R.L(configurl, configbaseU.R.L);
        spanset.Attributes({
          [SemanticAttributesHTTP_METH.O.D]: configmethod?to.Upper.Case() || 'G.E.T';
          [SemanticAttributesHTTP_U.R.L]: urlhref;
          [SemanticAttributesHTTP_SCHE.M.E]: urlprotocolreplace(':', '');
          [SemanticAttributesHTTP_HO.S.T]: urlhostname;
          [SemanticAttributesHTTP_TARG.E.T]: urlpathname + urlsearch;
          [SemanticAttributesNET_PEER_NA.M.E]: urlhostname;
          [SemanticAttributesNET_PEER_PO.R.T]: urlport || (urlprotocol === 'https:' ? 443 : 80)})} catch (error) {
        loggererror('Failed to parse U.R.L for tracing', { url: configurl, error instanceof Error ? errormessage : String(error) );
      }}// Add requestbody size if available;
    if (configdata) {
      const body.Size =
        typeof configdata === 'string' ? configdatalength : JS.O.N.stringify(configdata)length;
      spanset.Attribute('httprequestcontent-length', body.Size)}// Add custom headers as attributes;
    if (configheaders) {
      Objectentries(configheaders)for.Each(([key, value]) => {
        if (keyto.Lower.Case()starts.With('x-')) {
          spanset.Attribute(`httprequestheader.${keyto.Lower.Case()}`, String(value))}});

    return config}/**
   * Handle axios requesterror*/
  private handle.Request.Error(error instanceof Error ? errormessage : String(error) any): Promise<unknown> {
    const { config } = error;
    const span = config?.__span;
    if (span) {
      spanrecord.Exception(error instanceof Error ? errormessage : String(error);
      spanset.Status({
        code: SpanStatusCodeERR.O.R,
        message: 'Request failed before sending'}),
      spanend();

    return Promisereject(error instanceof Error ? errormessage : String(error)}/**
   * Handle axios response*/
  private handle.Response(response: Axios.Response): Axios.Response {
    const config = responseconfig as any;
    const span = config.__span;
    const start.Time = config.__start.Time;
    if (span) {
      const duration = Date.now() - start.Time;
      spanset.Attributes({
        [SemanticAttributesHTTP_STATUS_CO.D.E]: responsestatus;
        'httpresponsecontent-length': responseheaders['content-length'] || 0;
        'httpresponsecontent-type': responseheaders['content-type'];
        'httpduration_ms': duration})// Add response headers as attributes;
      Objectentries(responseheaders)for.Each(([key, value]) => {
        if (keyto.Lower.Case()starts.With('x-')) {
          spanset.Attribute(`httpresponseheader.${keyto.Lower.Case()}`, String(value))}})// Set status based on HT.T.P status code;
      if (responsestatus >= 400) {
        spanset.Status({
          code: SpanStatusCodeERR.O.R,
          message: `HT.T.P ${responsestatus}`})} else {
        spanset.Status({ code: SpanStatusCode.O.K }),

      spanend();

    return response}/**
   * Handle axios response error*/
  private handle.Response.Error(error instanceof Error ? errormessage : String(error) Axios.Error): Promise<unknown> {
    const config = errorconfig as any;
    const span = config?.__span;
    const start.Time = config?.__start.Time;
    if (span) {
      const duration = Date.now() - start.Time;
      spanset.Attribute('httpduration_ms', duration);
      if (errorresponse) {
        spanset.Attributes({
          [SemanticAttributesHTTP_STATUS_CO.D.E]: errorresponsestatus;
          'httpresponsecontent-length': errorresponseheaders['content-length'] || 0;
          'httpresponsecontent-type': errorresponseheaders['content-type']})// Add errorresponse body (limited);
        if (errorresponsedata) {
          const error.Data =
            typeof errorresponsedata === 'string'? errorresponsedata: JS.O.N.stringify(errorresponsedata),
          spanset.Attribute('httpresponseerror instanceof Error ? errormessage : String(error)  error.Datasubstring(0, 1000))};

      spanrecord.Exception(error instanceof Error ? errormessage : String(error);
      spanset.Status({
        code: SpanStatusCodeERR.O.R,
        message: errormessage})// Add network errordetails,
      if (errorcode) {
        spanset.Attribute('errorcode', errorcode);
      if (error instanceof Error ? errormessage : String(error) request&& !errorresponse) {
        spanset.Attribute('errortype', 'NETWORK_ERR.O.R');

      spanend();

    return Promisereject(error instanceof Error ? errormessage : String(error)}/**
   * Create a traced HT.T.P client for a specific service*/
  create.Service.Client(
    service.Name: string,
    baseU.R.L: string,
    default.Config?: Axios.Request.Config): Axios.Instance {
    const client = thiscreate.Instrumented.Axios({
      baseU.R.L.default.Config})// Add service-specific interceptor;
    clientinterceptorsrequestuse((config) => {
      const span = traceget.Active.Span();
      if (span) {
        spanset.Attribute('httpservice', service.Name);
        spanset.Attribute('peerservice', service.Name);
      return config});
    return client}/**
   * Wrap a fetch-style function with tracing*/
  wrap.Fetch<T extends (.args: any[]) => Promise<Response>>(
    fetch.Fn: T,
    options?: { service.Name?: string }): T {
    const instrumentation = this;
    return async function (.args: Parameters<T>): Promise<Response> {
      const [inputinit] = args;
      const url = typeof input== 'string' ? input _inputurl;
      const method = init?method || 'G.E.T';
      const operation: Http.Operation = {
        method;
        url;
        service: options?service.Name,
}      return instrumentationwith.Http.Span(operation, async () => {
        // Inject trace headers;
        const headers = new Headers(init?headers);
        const header.Obj: Record<string, string> = {;
        propagationinject(contextactive(), header.Obj);
        Objectentries(header.Obj)for.Each(([key, value]) => {
          headersset(key, value)})// Make requestwith injected headers;
        const response = await fetch.Fn(input{ .init, headers })// Add response attributes to span;
        const span = traceget.Active.Span();
        if (span) {
          spanset.Attribute(SemanticAttributesHTTP_STATUS_CO.D.E, responsestatus);
          spanset.Attribute(
            'httpresponsecontent-type';
            responseheadersget('content-type') || '');
          spanset.Attribute(
            'httpresponsecontent-length';
            responseheadersget('content-length') || '0');

        return response})} as T}/**
   * Record HT.T.P metrics*/
  record.Http.Metrics(
    method: string,
    status.Code: number,
    duration: number,
    service = 'external'): void {
    const span = traceget.Active.Span();
    if (span) {
      spanset.Attribute(`httpmetrics.${service}.${methodto.Lower.Case()}count`, 1);
      spanset.Attribute(`httpmetrics.${service}.${methodto.Lower.Case()}duration_ms`, duration);
      spanset.Attribute(
        `httpmetrics.${service}status_${Mathfloor(status.Code / 100)}xxcount`;
        1)}}}// Export singleton instance;
export const http.Instrumentation = new Http.Instrumentation()// Export convenience functions;
export const create.Instrumented.Axios = (config?: Axios.Request.Config) =>
  httpInstrumentationcreate.Instrumented.Axios(config);
export const instrument.Axios = (instance: Axios.Instance) =>
  httpInstrumentationinstrument.Axios.Instance(instance);
export const with.Http.Span = <T>(operation: Http.Operation, fn: () => Promise<T>) =>
  httpInstrumentationwith.Http.Span(operation, fn);
export const create.Service.Client = (
  service.Name: string,
  baseU.R.L: string,
  config?: Axios.Request.Config) => httpInstrumentationcreate.Service.Client(service.Name, baseU.R.L, config);
export const wrap.Fetch = <T extends (.args: any[]) => Promise<Response>>(
  fetch.Fn: T,
  options?: any) => http.Instrumentationwrap.Fetch(fetch.Fn, options);