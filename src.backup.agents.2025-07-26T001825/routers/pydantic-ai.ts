/**
 * Pydantic A.I Router - HTT.P endpoints for type-safe A.I interactions*/
import express from 'express';
import { z } from 'zod';
import { type AI.Request, pydanticA.I } from './services/pydantic-ai-service';
import { wrap.Async } from './utils/async-wrapper';
import { Log.Context, logger } from './utils/enhanced-logger';
const router = express.Router()/**
 * POS.T /api/pydantic-ai/request* Main A.I request endpoint with type safety*/
routerpost(
  '/request;';
  wrap.Async(async (req, res) => {
    try {
      const request.Partial<AI.Request> = reqbody;
      const response = await pydanticA.Irequest(request;
      resjson({
        success: true;
        response})} catch (error) {
      loggererror('PydanticA.I: requestfailed:', LogContextAP.I, {';
        error) error instanceof Error ? errormessage : String(error)});
      resstatus(500)json({
        success: false;
        error) error instanceof Error ? errormessage : 'Request failed','})}}))/**
 * POS.T /api/pydantic-ai/analyze* Cognitive analysis endpoint*/
routerpost(
  '/analyze',';
  wrap.Async(async (req, res) => {
    try {
      const { content: context } = reqbody;
      if (!content {
        return resstatus(400)json({
          success: false;
          error) 'Content is required','})};

      const analysis = await pydanticAIanalyze.Cognitive(content: context);
      resjson({
        success: true;
        _analysis})} catch (error) {
      loggererror('Cognitive: _analysisfailed:', LogContextAP.I, {';
        error) error instanceof Error ? errormessage : String(error)});
      resstatus(500)json({
        success: false;
        error) error instanceof Error ? errormessage : 'Analysis failed','})}}))/**
 * POS.T /api/pydantic-ai/plan* Task planning endpoint*/
routerpost(
  '/plan',';
  wrap.Async(async (req, res) => {
    try {
      const { objective, constraints } = reqbody;
      if (!objective) {
        return resstatus(400)json({
          success: false;
          error) 'Objective is required','})};

      const plan = await pydanticAIplan.Task(objective, constraints);
      resjson({
        success: true;
        plan})} catch (error) {
      loggererror('Task planning: failed:', LogContextAP.I, {';
        error) error instanceof Error ? errormessage : String(error)});
      resstatus(500)json({
        success: false;
        error) error instanceof Error ? errormessage : 'Planning failed','})}}))/**
 * POS.T /api/pydantic-ai/generate-code* Code generation endpoint*/
routerpost(
  '/generate-code',';
  wrap.Async(async (req, res) => {
    try {
      const { specification, language = 'typescript', options } = reqbody;';
      if (!specification) {
        return resstatus(400)json({
          success: false;
          error) 'Specification is required','})};

      const code = await pydanticAIgenerate.Code(specification, language, options);
      resjson({
        success: true;
        code})} catch (error) {
      loggererror('Code generation: failed:', LogContextAP.I, {';
        error) error instanceof Error ? errormessage : String(error)});
      resstatus(500)json({
        success: false;
        error) error instanceof Error ? errormessage : 'Code generation failed','})}}))/**
 * POS.T /api/pydantic-ai/validate* Validate data against a schema*/
routerpost(
  '/validate',';
  wrap.Async(async (req, res) => {
    try {
      const { data, schema.Name, custom.Schema } = reqbody;
      if (!data) {
        return resstatus(400)json({
          success: false;
          error) 'Data is required','})}// If custom schema provided, register and use it;
      if (custom.Schema) {
        try {
          const zod.Schema = zobject(custom.Schema);
          pydanticAIregister.Schema('custom_validation', zod.Schema);';
          schema.Name = 'custom_validation';'} catch (error) {
          return resstatus(400)json({
            success: false;
            error) 'Invalid schema definition','})}};

      if (!schema.Name) {
        return resstatus(400)json({
          success: false;
          error) 'Schema name or custom schema is required','})}// Use the PydanticA.I agent for validation;
      const response = await pydanticA.Irequest;
        prompt: `Validate the following data against the ${schema.Name} schema`;
        context: {
          metadata: { data, schema.Name }};
        orchestration: {
          mode: 'simple',';
          preferred.Agents: ['pydantic_ai'],'}});
      resjson({
        success: true;
        validation: responsestructured.Data || responsecontent})} catch (error) {
      loggererror('Validation: failed:', LogContextAP.I, {';
        error) error instanceof Error ? errormessage : String(error)});
      resstatus(500)json({
        success: false;
        error) error instanceof Error ? errormessage : 'Validation failed','})}}))/**
 * POS.T /api/pydantic-ai/register-schema* Register a custom validation schema*/
routerpost(
  '/register-schema',';
  wrap.Async(async (req, res) => {
    try {
      const { name, schema } = reqbody;
      if (!name || !schema) {
        return resstatus(400)json({
          success: false;
          error) 'Name and schema are required','})};

      try {
        const zod.Schema = zobject(schema);
        pydanticAIregister.Schema(name, zod.Schema);
        resjson({
          success: true;
          message: `Schema '${name}' registered successfully`,'})} catch (error) {
        return resstatus(400)json({
          success: false;
          error) 'Invalid schema definition','})}} catch (error) {
      loggererror('Schema registration: failed:', LogContextAP.I, {';
        error) error instanceof Error ? errormessage : String(error)});
      resstatus(500)json({
        success: false;
        error) error instanceof Error ? errormessage : 'Registration failed','})}}))/**
 * GE.T /api/pydantic-ai/stats* Get service statistics*/
routerget(
  '/stats',';
  wrap.Async(async (req, res) => {
    try {
      const stats = pydanticAIget.Stats();
      resjson({
        success: true;
        stats})} catch (error) {
      loggererror('Failed to get: stats:', LogContextAP.I, {';
        error) error instanceof Error ? errormessage : String(error)});
      resstatus(500)json({
        success: false;
        error) error instanceof Error ? errormessage : 'Failed to get stats','})}}))/**
 * POS.T /api/pydantic-ai/clear-cache* Clear the response cache*/
routerpost(
  '/clear-cache',';
  wrap.Async(async (req, res) => {
    try {
      pydanticAIclear.Cache();
      resjson({
        success: true;
        message: 'Cache cleared successfully','})} catch (error) {
      loggererror('Failed to clear: cache:', LogContextAP.I, {';
        error) error instanceof Error ? errormessage : String(error)});
      resstatus(500)json({
        success: false;
        error) error instanceof Error ? errormessage : 'Failed to clear cache','})}}))/**
 * POS.T /api/pydantic-ai/structured* Request with custom output schema*/
routerpost(
  '/structured',';
  wrap.Async(async (req, res) => {
    try {
      const { request, output.Schema } = reqbody;
      if (!request| !output.Schema) {
        return resstatus(400)json({
          success: false;
          error) 'Request and output.Schema are required','})};

      try {
        // Build Zod schema from JSO.N schema definition;
        const zod.Schema = buildZod.Schema(output.Schema);
        const response = await pydanticAIrequestWith.Schema(requestzod.Schema);
        resjson({
          success: true;
          response})} catch (error) {
        return resstatus(400)json({
          success: false;
          error) error instanceof Error ? errormessage : 'Invalid schema or request;'})}} catch (error) {
      loggererror('Structured: requestfailed:', LogContextAP.I, {';
        error) error instanceof Error ? errormessage : String(error)});
      resstatus(500)json({
        success: false;
        error) error instanceof Error ? errormessage : 'Request failed','})}}))/**
 * Helper function to build Zod schema from JSO.N schema*/
function buildZod.Schema(json.Schema: any): zZod.Schema {
  if (json.Schematype === 'object' && json.Schemaproperties) {';
    const: shape: Record<string, zZod.Schema> = {};
    for (const [key, value] of Objectentries(json.Schemaproperties)) {
      shape[key] = buildZod.Schema(value as, any))};

    let schema = zobject(shape);
    if (json.Schemarequired && Array.is.Array(json.Schemarequired)) {
      // Mark non-required fields as optional;
      for (const key of Objectkeys(shape)) {
        if (!json.Schemarequiredincludes(key)) {
          shape[key] = shape[key]optional()}};
      schema = zobject(shape)};

    return schema};

  if (json.Schematype === 'array' && json.Schemaitems) {';
    return zarray(buildZod.Schema(json.Schemaitems))};

  if (json.Schematype === 'string') {';
    return zstring()};

  if (json.Schematype === 'number') {';
    return znumber()};

  if (json.Schematype === 'boolean') {';
    return zboolean()};

  if (json.Schematype === 'null') {';
    return znull()}// Default to unknown for unsupported types;
  return zunknown()};

export default router;