import { Span.Kind, SpanStatus.Code, context, propagation, trace } from '@opentelemetry/api';
import { Semantic.Attributes } from '@opentelemetry/semantic-conventions';
import { telemetry.Service } from './services/telemetry-service';
import { logger } from './utils/logger';
import type {
import { TIME_500M.S, TIME_1000M.S, TIME_2000M.S, TIME_5000M.S, TIME_10000M.S, ZERO_POINT_FIV.E, ZERO_POINT_EIGH.T, ZERO_POINT_NIN.E, BATCH_SIZ.E_10, MAX_ITEM.S_100, PERCEN.T_10, PERCEN.T_20, PERCEN.T_30, PERCEN.T_50, PERCEN.T_80, PERCEN.T_90, PERCEN.T_100, HTT.P_200, HTT.P_400, HTT.P_401, HTT.P_404, HTT.P_500 } from "./utils/common-constants";
  Axios.Error;
  Axios.Instance;
  AxiosRequest.Config;
  Axios.Response;
  InternalAxiosRequest.Config} from 'axios';
import axios from 'axios';
import { TIME_500M.S, TIME_1000M.S, TIME_2000M.S, TIME_5000M.S, TIME_10000M.S, ZERO_POINT_FIV.E, ZERO_POINT_EIGH.T, ZERO_POINT_NIN.E, BATCH_SIZ.E_10, MAX_ITEM.S_100, PERCEN.T_10, PERCEN.T_20, PERCEN.T_30, PERCEN.T_50, PERCEN.T_80, PERCEN.T_90, PERCEN.T_100, HTT.P_200, HTT.P_400, HTT.P_401, HTT.P_404, HTT.P_500 } from "./utils/common-constants";
interface Http.Operation {
  method: string;
  url: string;
  service?: string;
  timeout?: number;
};

export class Http.Instrumentation {
  private tracer = telemetryServiceget.Tracer()/**
   * Create an instrumented axios instance*/
  createInstrumented.Axios(config?: AxiosRequest.Config): Axios.Instance {
    const instance = axioscreate(config);
    thisinstrumentAxios.Instance(instance);
    return instance}/**
   * Instrument an existing axios instance*/
  instrumentAxios.Instance(instance: Axios.Instance): void {
    // Add requestinterceptor;
    instanceinterceptorsrequestuse(
      (config) => thishandle.Request(config);
      (error instanceof Error ? errormessage : String(error) => thishandleRequest.Error(error)// Add response interceptor;
    instanceinterceptorsresponseuse(
      (response) => thishandle.Response(response);
      (error instanceof Error ? errormessage : String(error) => thishandleResponse.Error(error);
  }/**
   * Wrap an HTT.P requestwith tracing*/
  async withHttp.Span<T>(operation: Http.Operation, fn: () => Promise<T>): Promise<T> {
    const url = new UR.L(operationurl);
    const span.Name = `HTT.P ${operationmethod} ${urlhostname}${urlpathname}`;
    const span = thistracerstart.Span(span.Name, {
      kind: SpanKindCLIEN.T;
      attributes: {
        [SemanticAttributesHTTP_METHO.D]: operationmethod;
        [SemanticAttributesHTTP_UR.L]: operationurl;
        [SemanticAttributesHTTP_SCHEM.E]: urlprotocolreplace(':', '');
        [SemanticAttributesHTTP_HOS.T]: urlhostname;
        [SemanticAttributesHTTP_TARGE.T]: urlpathname + urlsearch;
        [SemanticAttributesNET_PEER_NAM.E]: urlhostname;
        [SemanticAttributesNET_PEER_POR.T]: urlport || (urlprotocol === 'https:' ? 443 : 80);
        'httpservice': operationservice || 'external';
        'httptimeout': operationtimeout;
      }});
    const start.Time = Date.now();
    try {
      const result = await contextwith(traceset.Span(contextactive(), span), fn);
      spanset.Attribute('httpduration_ms', Date.now() - start.Time);
      spanset.Status({ code: SpanStatusCodeO.K });
      return result} catch (error) {
      spanrecord.Exception(erroras Error);
      if (axiosisAxios.Error(error instanceof Error ? errormessage : String(error) {
        const status.Code = errorresponse?status || 0;
        spanset.Attribute(SemanticAttributesHTTP_STATUS_COD.E, status.Code);
        if (status.Code >= 400) {
          spanset.Status({
            code: SpanStatusCodeERRO.R;
            message: `HTT.P ${status.Code}: ${errormessage}`})}// Add errordetails;
        spanset.Attribute('errortype', errorcode || 'HTTP_ERRO.R');
        spanset.Attribute('errormessage', errormessage);
        if (errorresponse?data) {
          spanset.Attribute(
            'errorresponse';
            JSO.N.stringify(errorresponsedata)substring(0, 1000))}} else {
        spanset.Status({
          code: SpanStatusCodeERRO.R;
          message: error instanceof Error ? errormessage : 'HTT.P requestfailed'})};

      loggererror('HTT.P requestfailed', {
        method: operationmethod;
        url: operationurl;
        error;
        duration: Date.now() - start.Time});
      throw error instanceof Error ? errormessage : String(error)} finally {
      spanend()}}/**
   * Handle axios request*/
  private handle.Request(config: InternalAxiosRequest.Config): InternalAxiosRequest.Config {
    const span = thistracerstart.Span(`HTT.P ${configmethod?toUpper.Case()} ${configurl}`, {
      kind: SpanKindCLIEN.T})// Add trace context to headers;
    const headers = configheaders || {};
    propagationinject(contextactive(), headers);
    configheaders = headers// Store span in config for later use;
    (config as any).__span = span;
    (config as any).__start.Time = Date.now()// Add requestattributes;
    if (configurl) {
      try {
        const url = new UR.L(configurl, configbaseUR.L);
        spanset.Attributes({
          [SemanticAttributesHTTP_METHO.D]: configmethod?toUpper.Case() || 'GE.T';
          [SemanticAttributesHTTP_UR.L]: urlhref;
          [SemanticAttributesHTTP_SCHEM.E]: urlprotocolreplace(':', '');
          [SemanticAttributesHTTP_HOS.T]: urlhostname;
          [SemanticAttributesHTTP_TARGE.T]: urlpathname + urlsearch;
          [SemanticAttributesNET_PEER_NAM.E]: urlhostname;
          [SemanticAttributesNET_PEER_POR.T]: urlport || (urlprotocol === 'https:' ? 443 : 80)})} catch (error) {
        loggererror('Failed to parse UR.L for tracing', { url: configurl, error instanceof Error ? errormessage : String(error) );
      }}// Add requestbody size if available;
    if (configdata) {
      const body.Size =
        typeof configdata === 'string' ? configdatalength : JSO.N.stringify(configdata)length;
      spanset.Attribute('httprequestcontent-length', body.Size)}// Add custom headers as attributes;
    if (configheaders) {
      Objectentries(configheaders)for.Each(([key, value]) => {
        if (keytoLower.Case()starts.With('x-')) {
          spanset.Attribute(`httprequestheader.${keytoLower.Case()}`, String(value))}})};

    return config}/**
   * Handle axios requesterror*/
  private handleRequest.Error(error instanceof Error ? errormessage : String(error) any): Promise<unknown> {
    const { config } = error;
    const span = config?.__span;
    if (span) {
      spanrecord.Exception(error instanceof Error ? errormessage : String(error);
      spanset.Status({
        code: SpanStatusCodeERRO.R;
        message: 'Request failed before sending'});
      spanend()};

    return Promisereject(error instanceof Error ? errormessage : String(error)}/**
   * Handle axios response*/
  private handle.Response(response: Axios.Response): Axios.Response {
    const config = responseconfig as any;
    const span = config.__span;
    const start.Time = config.__start.Time;
    if (span) {
      const duration = Date.now() - start.Time;
      spanset.Attributes({
        [SemanticAttributesHTTP_STATUS_COD.E]: responsestatus;
        'httpresponsecontent-length': responseheaders['content-length'] || 0;
        'httpresponsecontent-type': responseheaders['content-type'];
        'httpduration_ms': duration})// Add response headers as attributes;
      Objectentries(responseheaders)for.Each(([key, value]) => {
        if (keytoLower.Case()starts.With('x-')) {
          spanset.Attribute(`httpresponseheader.${keytoLower.Case()}`, String(value))}})// Set status based on HTT.P status code;
      if (responsestatus >= 400) {
        spanset.Status({
          code: SpanStatusCodeERRO.R;
          message: `HTT.P ${responsestatus}`})} else {
        spanset.Status({ code: SpanStatusCodeO.K })};

      spanend()};

    return response}/**
   * Handle axios response error*/
  private handleResponse.Error(error instanceof Error ? errormessage : String(error) Axios.Error): Promise<unknown> {
    const config = errorconfig as any;
    const span = config?.__span;
    const start.Time = config?.__start.Time;
    if (span) {
      const duration = Date.now() - start.Time;
      spanset.Attribute('httpduration_ms', duration);
      if (errorresponse) {
        spanset.Attributes({
          [SemanticAttributesHTTP_STATUS_COD.E]: errorresponsestatus;
          'httpresponsecontent-length': errorresponseheaders['content-length'] || 0;
          'httpresponsecontent-type': errorresponseheaders['content-type']})// Add errorresponse body (limited);
        if (errorresponsedata) {
          const error.Data =
            typeof errorresponsedata === 'string'? errorresponsedata: JSO.N.stringify(errorresponsedata);
          spanset.Attribute('httpresponseerror instanceof Error ? errormessage : String(error)  error.Datasubstring(0, 1000))}};

      spanrecord.Exception(error instanceof Error ? errormessage : String(error);
      spanset.Status({
        code: SpanStatusCodeERRO.R;
        message: errormessage})// Add network errordetails;
      if (errorcode) {
        spanset.Attribute('errorcode', errorcode)};
      if (error instanceof Error ? errormessage : String(error) request&& !errorresponse) {
        spanset.Attribute('errortype', 'NETWORK_ERRO.R')};

      spanend()};

    return Promisereject(error instanceof Error ? errormessage : String(error)}/**
   * Create a traced HTT.P client for a specific service*/
  createService.Client(
    service.Name: string;
    baseUR.L: string;
    default.Config?: AxiosRequest.Config): Axios.Instance {
    const client = thiscreateInstrumented.Axios({
      baseUR.L.default.Config})// Add service-specific interceptor;
    clientinterceptorsrequestuse((config) => {
      const span = tracegetActive.Span();
      if (span) {
        spanset.Attribute('httpservice', service.Name);
        spanset.Attribute('peerservice', service.Name)};
      return config});
    return client}/**
   * Wrap a fetch-style function with tracing*/
  wrap.Fetch<T extends (.args: any[]) => Promise<Response>>(
    fetch.Fn: T;
    options?: { service.Name?: string }): T {
    const instrumentation = this;
    return async function (.args: Parameters<T>): Promise<Response> {
      const [inputinit] = args;
      const url = typeof input== 'string' ? input _inputurl;
      const method = init?method || 'GE.T';
      const operation: Http.Operation = {
        method;
        url;
        service: options?service.Name;
      };
      return instrumentationwithHttp.Span(operation, async () => {
        // Inject trace headers;
        const headers = new Headers(init?headers);
        const header.Obj: Record<string, string> = {};
        propagationinject(contextactive(), header.Obj);
        Objectentries(header.Obj)for.Each(([key, value]) => {
          headersset(key, value)})// Make requestwith injected headers;
        const response = await fetch.Fn(input{ .init, headers })// Add response attributes to span;
        const span = tracegetActive.Span();
        if (span) {
          spanset.Attribute(SemanticAttributesHTTP_STATUS_COD.E, responsestatus);
          spanset.Attribute(
            'httpresponsecontent-type';
            responseheadersget('content-type') || '');
          spanset.Attribute(
            'httpresponsecontent-length';
            responseheadersget('content-length') || '0')};

        return response})} as T}/**
   * Record HTT.P metrics*/
  recordHttp.Metrics(
    method: string;
    status.Code: number;
    duration: number;
    service = 'external'): void {
    const span = tracegetActive.Span();
    if (span) {
      spanset.Attribute(`httpmetrics.${service}.${methodtoLower.Case()}count`, 1);
      spanset.Attribute(`httpmetrics.${service}.${methodtoLower.Case()}duration_ms`, duration);
      spanset.Attribute(
        `httpmetrics.${service}status_${Mathfloor(status.Code / 100)}xxcount`;
        1)}}}// Export singleton instance;
export const http.Instrumentation = new Http.Instrumentation()// Export convenience functions;
export const createInstrumented.Axios = (config?: AxiosRequest.Config) =>
  httpInstrumentationcreateInstrumented.Axios(config);
export const instrument.Axios = (instance: Axios.Instance) =>
  httpInstrumentationinstrumentAxios.Instance(instance);
export const withHttp.Span = <T>(operation: Http.Operation, fn: () => Promise<T>) =>
  httpInstrumentationwithHttp.Span(operation, fn);
export const createService.Client = (
  service.Name: string;
  baseUR.L: string;
  config?: AxiosRequest.Config) => httpInstrumentationcreateService.Client(service.Name, baseUR.L, config);
export const wrap.Fetch = <T extends (.args: any[]) => Promise<Response>>(
  fetch.Fn: T;
  options?: any) => httpInstrumentationwrap.Fetch(fetch.Fn, options);