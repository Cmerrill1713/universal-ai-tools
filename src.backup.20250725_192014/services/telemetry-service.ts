/**
 * Enhanced Open.Telemetry Distributed Tracing Service*
 * Comprehensive telemetry service for Universal A.I Tools with:
 * - Distributed tracing across all services* - Metrics collection and export* - Custom span instrumentation* - Performance monitoring* - Error tracking and correlation* - Service mesh visibility* - Sweet Athena specific tracing*/

import { NodeSD.K } from '@opentelemetry/sdk-node';
import { getNodeAuto.Instrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResource.Attributes } from '@opentelemetry/semantic-conventions';
import { ConsoleMetric.Exporter, PeriodicExportingMetric.Reader } from '@opentelemetry/sdk-metrics';
import { Prometheus.Exporter } from '@opentelemetry/exporter-prometheus';
import type { Span.Processor } from '@opentelemetry/sdk-trace-base';
import {
  BatchSpan.Processor;
  ConsoleSpan.Exporter;
  SimpleSpan.Processor} from '@opentelemetry/sdk-trace-base';
import { Jaeger.Exporter } from '@opentelemetry/exporter-jaeger';
import { Zipkin.Exporter } from '@opentelemetry/exporter-zipkin';
import { OTLPTrace.Exporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetric.Exporter } from '@opentelemetry/exporter-metrics-otlp-http';
import type { Context, Span, Tracer } from '@opentelemetry/api';
import { Span.Kind, SpanStatus.Code, context, metrics, propagation, trace } from '@opentelemetry/api';
import { W3CTraceContext.Propagator } from '@opentelemetry/core';
import { W3CBaggage.Propagator } from '@opentelemetry/core';
import { Composite.Propagator } from '@opentelemetry/core';
import {
  AlwaysOn.Sampler;
  ParentBased.Sampler;
  TraceIdRatioBased.Sampler} from '@opentelemetry/sdk-trace-base';
import { DiagConsole.Logger, DiagLog.Level, diag } from '@opentelemetry/api';
import { Event.Emitter } from 'events';
import { Log.Context, logger } from './utils/enhanced-logger';
import { getTelemetry.Config } from './config/telemetry';
export interface TelemetryServiceOptions {
  service.Name?: string;
  service.Version?: string;
  environment?: string;
  enableConsole.Exporter?: boolean;
  enable.Jaeger?: boolean;
  enable.Zipkin?: boolean;
  enableOTL.P?: boolean;
  enable.Prometheus?: boolean;
  prometheus.Port?: number;
  sampling.Rate?: number;
  debug?: boolean;
  metrics.Interval?: number;
};

export interface CustomSpanData {
  name: string;
  attributes?: Record<string, unknown>
  span.Kind?: Span.Kind;
  parent.Span?: Span;
};

export interface TraceMetadata {
  trace.Id: string;
  span.Id: string;
  parentSpan.Id?: string;
  operation: string;
  duration: number;
  status: 'success' | 'error instanceof Error ? errormessage : String(error) | 'timeout';
  attributes: Record<string, unknown>
  timestamp: Date;
};

export interface PerformanceTrace {
  operation: string;
  component: string;
  duration: number;
  success: boolean;
  metadata: Record<string, unknown>
  trace.Id: string;
  timestamp: Date;
};

export class Telemetry.Service extends Event.Emitter {
  private sdk: NodeSD.K | null = null;
  private tracer: Tracer | null = null;
  private meter: any = null;
  private is.Initialized = false;
  private active.Spans: Map<string, Span> = new Map();
  private performance.Traces: Performance.Trace[] = [];
  private span.Processors: Span.Processor[] = [];
  private metric.Readers: any[] = [];
  constructor() {
    super()// Setup errorhandling;
    thison('error instanceof Error ? errormessage : String(error)  (error instanceof Error ? errormessage : String(error)=> {
      loggererror('Telemetry service error instanceof Error ? errormessage : String(error)  LogContextTELEMETR.Y, { error instanceof Error ? errormessage : String(error))})};

  async initialize(options: TelemetryService.Options = {}): Promise<void> {
    if (thisis.Initialized) {
      loggerwarn('Telemetry service already initialized', LogContextSYSTE.M);
      return};

    const config = getTelemetry.Config();
    const merged.Options = { .config, .options }// Enable debug logging if requested;
    if (merged.Optionsdebug) {
      diagset.Logger(new DiagConsole.Logger(), DiagLogLevelDEBU.G)};

    try {
      // Create resource with service information;
      const resource = Resourcedefault()merge(
        new Resource({
          [SemanticResourceAttributesSERVICE_NAM.E]:
            mergedOptionsservice.Name || 'universal-ai-tools';
          [SemanticResourceAttributesSERVICE_VERSIO.N]:
            mergedOptionsservice.Version || process.envnpm_package_version || '1.0.0';
          [SemanticResourceAttributesDEPLOYMENT_ENVIRONMEN.T]:
            merged.Optionsenvironment || process.envNODE_EN.V || 'development';
          'serviceinstanceid': process.envINSTANCE_I.D || `instance-${Date.now()}`;
          'servicenamespace': 'ai-tools'}))// Configure span processors;
      const span.Processors: Span.Processor[] = [];
      if (mergedOptionsenableConsole.Exporter) {
        span.Processorspush(new SimpleSpan.Processor(new ConsoleSpan.Exporter()))};

      if (mergedOptionsenable.Jaeger) {
        const jaeger.Exporter = new Jaeger.Exporter({
          endpoint: process.envJAEGER_ENDPOIN.T || 'http://localhost:14268/api/traces'});
        span.Processorspush(new BatchSpan.Processor(jaeger.Exporter))};

      if (mergedOptionsenable.Zipkin) {
        const zipkin.Exporter = new Zipkin.Exporter({
          url: process.envZIPKIN_ENDPOIN.T || 'http://localhost:9411/api/v2/spans'});
        span.Processorspush(new BatchSpan.Processor(zipkin.Exporter))};

      if (mergedOptionsenableOTL.P) {
        const otlp.Exporter = new OTLPTrace.Exporter({
          url: process.envOTEL_EXPORTER_OTLP_TRACES_ENDPOIN.T || 'http://localhost:4318/v1/traces';
          headers: process.envOTEL_EXPORTER_OTLP_HEADER.S? JSO.N.parse(process.envOTEL_EXPORTER_OTLP_HEADER.S): {
}});
        span.Processorspush(new BatchSpan.Processor(otlp.Exporter))}// Configure metrics;
      thismetric.Readers = [];
      if (mergedOptionsenable.Prometheus) {
        const prometheus.Exporter = new Prometheus.Exporter({
          port: mergedOptionsprometheus.Port || 9464;
          endpoint: '/metrics'});
        thismetric.Readerspush(
          new PeriodicExportingMetric.Reader({
            exporter: prometheus.Exporter;
            exportInterval.Millis: mergedOptionsmetrics.Interval || 15000}))};

      if (mergedOptionsenableConsole.Exporter) {
        thismetric.Readerspush(
          new PeriodicExportingMetric.Reader({
            exporter: new ConsoleMetric.Exporter();
            exportInterval.Millis: mergedOptionsmetrics.Interval || 10000}))};

      if (mergedOptionsenableOTL.P) {
        thismetric.Readerspush(
          new PeriodicExportingMetric.Reader({
            exporter: new OTLPMetric.Exporter({
              url:
                process.envOTEL_EXPORTER_OTLP_METRICS_ENDPOIN.T || 'http://localhost:4318/v1/metrics';
              headers: process.envOTEL_EXPORTER_OTLP_HEADER.S? JSO.N.parse(process.envOTEL_EXPORTER_OTLP_HEADER.S): {
}});
            exportInterval.Millis: mergedOptionsmetrics.Interval || 10000}))}// Configure sampler;
      const sampling.Rate = mergedOptionssampling.Rate ?? 1.0;
      const sampler =
        sampling.Rate === 1.0? new AlwaysOn.Sampler(): new ParentBased.Sampler({
              root: new TraceIdRatioBased.Sampler(sampling.Rate)})// Configure propagators;
      const propagators = new Composite.Propagator({
        propagators: [new W3CTraceContext.Propagator(), new W3CBaggage.Propagator()]});
      propagationsetGlobal.Propagator(propagators)// Store span processors for later use;
      thisspan.Processors = span.Processors// Create and configure SD.K;
      thissdk = new NodeSD.K({
        resource;
        span.Processors: thisspan.Processors as any;
        metric.Reader: thismetric.Readers[0] as any;
        sampler;
        instrumentations: [
          getNodeAuto.Instrumentations({
            '@opentelemetry/instrumentation-fs': {
              enabled: false, // Disable fs instrumentation to reduce noise};
            '@opentelemetry/instrumentation-http': {
              enabled: true;
              request.Hook: (span, request=> {
                if ('headers' in request{
                  spanset.Attributes({
                    'httprequestbodysize': requestheaders['content-length'] || 0;
                    'httpuser_agent': requestheaders['user-agent'] || '';
                    'aiservice': requestheaders['x-ai-service'] || 'unknown'})}};
              response.Hook: (span, response) => {
                if ('headers' in response) {
                  spanset.Attributes({
                    'httpresponsebodysize': responseheaders['content-length'] || 0;
                    'httpresponsecontent_type': responseheaders['content-type'] || ''})}}};
            '@opentelemetry/instrumentation-express': { enabled: true };
            '@opentelemetry/instrumentation-pg': { enabled: true };
            '@opentelemetry/instrumentation-redis': { enabled: true }})]})// Start the SD.K;
      await thissdkstart();
      thistracer = traceget.Tracer(
        mergedOptionsservice.Name || 'universal-ai-tools';
        mergedOptionsservice.Version || '1.0.0');
      thismeter = metricsget.Meter(
        mergedOptionsservice.Name || 'universal-ai-tools';
        mergedOptionsservice.Version || '1.0.0');
      thisis.Initialized = true;
      loggerinfo('Telemetry service initialized successfully', LogContextSYSTE.M, {
        service.Name: mergedOptionsservice.Name;
        environment: merged.Optionsenvironment;
        exporters: {
          console: mergedOptionsenableConsole.Exporter;
          jaeger: mergedOptionsenable.Jaeger;
          zipkin: mergedOptionsenable.Zipkin;
          otlp: mergedOptionsenableOTL.P;
        };
        sampling.Rate})} catch (error) {
      loggererror('Failed to initialize telemetry service', LogContextSYSTE.M, { error instanceof Error ? errormessage : String(error));
      throw error instanceof Error ? errormessage : String(error)}};

  async shutdown(): Promise<void> {
    if (thissdk) {
      try {
        await thissdkshutdown();
        thisis.Initialized = false;
        thistracer = null;
        thisactive.Spansclear();
        loggerinfo('Telemetry service shut down successfully', LogContextSYSTE.M)} catch (error) {
        loggererror('Error shutting down telemetry service', LogContextSYSTE.M, { error instanceof Error ? errormessage : String(error) );
      }}};

  get.Tracer(): Tracer {
    if (!thistracer) {
      throw new Error('Telemetry service not initialized')};
    return thistracer}// Custom span creation for A.I operations;
  startAI.Operation(operation.Name: string, attributes?: Record<string, unknown>): Span {
    const tracer = thisget.Tracer();
    const span = tracerstart.Span(operation.Name, {
      kind: SpanKindINTERNA.L;
      attributes: {
        'aioperationtype': operation.Name;
        'aitimestamp': new Date()toISO.String().attributes;
      }});
    thisactive.Spansset(operation.Name, span);
    return span};

  endAI.Operation(operation.Name: string, status?: { code: SpanStatus.Code, message?: string }): void {
    const span = thisactive.Spansget(operation.Name);
    if (span) {
      if (status) {
        spanset.Status(status)};
      spanend();
      thisactive.Spansdelete(operation.Name)}}// Baggage propagation helpers;
  set.Baggage(key: string, value: string): void {
    const baggage = propagationget.Baggage(contextactive()) || propagationcreate.Baggage();
    const updated.Baggage = baggageset.Entry(key, { value });
    propagationset.Baggage(contextactive(), updated.Baggage)};

  get.Baggage(key: string): string | undefined {
    const baggage = propagationget.Baggage(contextactive());
    return baggage?get.Entry(key)?value}// Context propagation helpers;
  extract.Context(headers: Record<string, string | string[] | undefined>): Context {
    return propagationextract(contextactive(), headers)};

  inject.Context(headers: Record<string, string>): void {
    propagationinject(contextactive(), headers)}// Utility method to run function with span;
  async with.Span<T>(
    span.Name: string;
    fn: (span: Span) => Promise<T>
    options?: {
      kind?: Span.Kind;
      attributes?: Record<string, unknown>}): Promise<T> {
    const tracer = thisget.Tracer();
    const span = tracerstart.Span(span.Name, {
      kind: options?kind || SpanKindINTERNA.L;
      attributes: options?attributes});
    try {
      const result = await contextwith(traceset.Span(contextactive(), span), () => fn(span));
      spanset.Status({ code: SpanStatusCodeO.K });
      return result} catch (error) {
      spanrecord.Exception(erroras Error);
      spanset.Status({
        code: SpanStatusCodeERRO.R;
        message: error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error)});
      throw error instanceof Error ? errormessage : String(error)} finally {
      spanend()}}// Add custom attributes to current span;
  addAttributesToCurrent.Span(attributes: Record<string, unknown>): void {
    const span = tracegetActive.Span();
    if (span) {
      Objectentries(attributes)for.Each(([key, value]) => {
        spanset.Attribute(key, value)})}}// Record an event in the current span;
  record.Event(name: string, attributes?: Record<string, unknown>): void {
    const span = tracegetActive.Span();
    if (span) {
      spanadd.Event(name, attributes)}}// Get current trace I.D;
  getCurrentTrace.Id(): string | undefined {
    const span = tracegetActive.Span();
    return span?span.Context()trace.Id}// Get current span I.D;
  getCurrentSpan.Id(): string | undefined {
    const span = tracegetActive.Span();
    return span?span.Context()span.Id}/**
   * Create a custom span for operation tracking*/
  create.Span(span.Data: CustomSpan.Data): Span | null {
    if (!thistracer) {
      return null};

    try {
      const { name, attributes = {}, span.Kind = SpanKindINTERNA.L, parent.Span } = span.Data;
      const span = parent.Span? thistracerstart.Span(name, { kind: span.Kind, parent: parent.Span }, contextactive()): thistracerstart.Span(name, { kind: span.Kind })// Add standard attributes;
      spanset.Attributes({
        'servicename': 'universal-ai-tools';
        'serviceversion': '1.0.0'.attributes})// Track active span;
      const span.Context = spanspan.Context();
      thisactive.Spansset(spanContextspan.Id, span);
      loggerdebug('Created custom span', LogContextTELEMETR.Y, {
        span_name: name;
        trace_id: spanContexttrace.Id;
        span_id: spanContextspan.Id;
        attributes});
      return span} catch (error) {
      loggererror('Failed to create custom span', LogContextTELEMETR.Y, {
        error;
        span_name: span.Dataname});
      return null}}/**
   * End a span with optional metadata*/
  end.Span(
    span: Span;
    metadata?: { success?: boolean; error instanceof Error ? errormessage : String(error)  Error, attributes?: Record<string, unknown> }): void {
    if (!span) return;
    try {
      const span.Context = spanspan.Context();
      if (metadata) {
        const { success = true, error instanceof Error ? errormessage : String(error) attributes = {} } = metadata// Set status;
        if (error instanceof Error ? errormessage : String(error){
          spanset.Status({ code: SpanStatusCodeERRO.R, message: errormessage });
          spanset.Attributes({
            error instanceof Error ? errormessage : String(error) true;
            'errorname': errorname;
            'errormessage': errormessage;
            'errorstack': errorstack})} else if (success) {
          spanset.Status({ code: SpanStatusCodeO.K })}// Add additional attributes;
        if (Objectkeys(attributes)length > 0) {
          spanset.Attributes(attributes)}};

      spanend();
      thisactive.Spansdelete(spanContextspan.Id);
      loggerdebug('Ended span', LogContextTELEMETR.Y, {
        trace_id: spanContexttrace.Id;
        span_id: spanContextspan.Id;
        success: !metadata?error})} catch (error) {
      loggererror('Failed to end span', LogContextTELEMETR.Y, { error instanceof Error ? errormessage : String(error) );
    }}/**
   * Trace an async operation*/
  async trace.Operation<T>(
    operation.Name: string;
    operation: (span: Span) => Promise<T>
    options?: {
      attributes?: Record<string, unknown>
      span.Kind?: Span.Kind;
      parent.Span?: Span;
    }): Promise<T> {
    const span = thiscreate.Span({
      name: operation.Name;
      attributes: options?attributes;
      span.Kind: options?span.Kind;
      parent.Span: options?parent.Span});
    if (!span) {
      // If span creation failed, still execute operation;
      return operation(null as any)};

    const start.Time = Date.now();
    try {
      const result = await operation(span);
      const duration = Date.now() - start.Time;
      thisrecordPerformance.Trace({
        operation: operation.Name;
        component: 'universal-ai-tools';
        duration;
        success: true;
        metadata: options?attributes || {
};
        trace.Id: spanspan.Context()trace.Id;
        timestamp: new Date()});
      thisend.Span(span, { success: true, attributes: { 'operationduration_ms': duration } });
      return result} catch (error) {
      const duration = Date.now() - start.Time;
      thisrecordPerformance.Trace({
        operation: operation.Name;
        component: 'universal-ai-tools';
        duration;
        success: false;
        metadata: { error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)};
        trace.Id: spanspan.Context()trace.Id;
        timestamp: new Date()});
      thisend.Span(span, {
        success: false;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? error instanceof Error ? errormessage : String(error) new Error(String(error instanceof Error ? errormessage : String(error);
        attributes: { 'operationduration_ms': duration }});
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Trace Sweet Athena specific operations*/
  async traceAthena.Operation<T>(
    operation.Type: string;
    personality.Mood: string;
    operation: (span: Span) => Promise<T>
    session.Id?: string): Promise<T> {
    return thistrace.Operation(`athena.${operation.Type}`, operation, {
      attributes: {
        'athenapersonality_mood': personality.Mood;
        'athenasession_id': session.Id || 'unknown';
        'athenaoperation_type': operation.Type;
        'aiservice': 'sweet-athena';
      };
      span.Kind: SpanKindSERVE.R})}/**
   * Trace database operations with enhanced metadata*/
  async traceDatabase.Operation<T>(
    table: string;
    operation: string;
    db.Operation: (span: Span) => Promise<T>
    query.Metadata?: Record<string, unknown>): Promise<T> {
    return thistrace.Operation(`db.${operation}`, db.Operation, {
      attributes: {
        'dbtable': table;
        'dboperation': operation;
        'dbsystem': 'postgresql'.query.Metadata;
      };
      span.Kind: SpanKindCLIEN.T})}/**
   * Get current trace context*/
  getCurrentTrace.Context(): { trace.Id: string, span.Id: string } | null {
    const active.Span = tracegetActive.Span();
    if (!active.Span) return null;
    const span.Context = activeSpanspan.Context();
    return {
      trace.Id: spanContexttrace.Id;
      span.Id: spanContextspan.Id;
    }}/**
   * Get performance traces*/
  getPerformance.Traces(limit = 100): Performance.Trace[] {
    return thisperformance.Tracesslice(-limit)}/**
   * Clear performance traces*/
  clearPerformance.Traces(): void {
    thisperformance.Traces = [];
  }/**
   * Get service metrics*/
  getService.Metrics(): {
    active.Spans: number;
    total.Traces: number;
    averageResponse.Time: number;
    error.Rate: number} {
    const total.Traces = thisperformance.Traceslength;
    const successful.Traces = thisperformance.Tracesfilter((t) => tsuccess)length;
    const averageResponse.Time =
      total.Traces > 0? thisperformance.Tracesreduce((sum, t) => sum + tduration, 0) / total.Traces: 0;
    const error.Rate = total.Traces > 0 ? ((total.Traces - successful.Traces) / total.Traces) * 100 : 0;
    return {
      active.Spans: thisactive.Spanssize;
      total.Traces;
      averageResponse.Time: Mathround(averageResponse.Time);
      error.Rate: Mathround(error.Rate * 100) / 100;
    }}/**
   * Record performance trace*/
  private recordPerformance.Trace(trace: Performance.Trace): void {
    thisperformance.Tracespush(trace)// Keep only last 1000 traces;
    if (thisperformance.Traceslength > 1000) {
      thisperformance.Traces = thisperformance.Tracesslice(-1000);
    };

    thisemit('performance.Trace', trace)}/**
   * Start performance monitoring*/
  startPerformance.Monitoring(): void {
    set.Interval(() => {
      const metrics = thisgetService.Metrics();
      loggerdebug('Telemetry performance metrics', LogContextTELEMETR.Y, metrics);
      thisemit('performance.Metrics', metrics)// Clean up old traces (older than 1 hour);
      const oneHour.Ago = new Date(Date.now() - 60 * 60 * 1000);
      thisperformance.Traces = thisperformance.Tracesfilter((t) => ttimestamp > oneHour.Ago)}, 60000)// Every minute}}// Export singleton instance;
export const telemetry.Service = new Telemetry.Service()// Export types and utilities;
export type { SpanStatus.Code, Span.Kind, Context };
export type { Span, Tracer };