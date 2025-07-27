/**
 * Pydantic A.I.Router - HT.T.P.endpoints for type-safe A.I.interactions*/
import express from 'express';
import { z } from 'zod';
import { type A.I.Request, pydantic.A.I } from './services/pydantic-ai-service';
import { wrap.Async } from './utils/async-wrapper';
import { Log.Context, logger } from './utils/enhanced-logger';
const router = express.Router()/**
 * PO.S.T /api/pydantic-ai/request* Main A.I.request endpoint with type safety*/
routerpost(
  '/request;';
  wrap.Async(async (req, res) => {
    try {
      const request.Partial<A.I.Request> = req.body;
      const response = await pydantic.A.Irequest(request;
      res.json({
        success: true,
        response})} catch (error) {
      loggererror('Pydantic.A.I: requestfailed:', LogContextA.P.I, {';
        error) error instanceof Error ? error.message : String(error)});
      res.status(500)json({
        success: false,
        error) error instanceof Error ? error.message : 'Request failed','})}}))/**
 * PO.S.T /api/pydantic-ai/analyze* Cognitive analysis endpoint*/
routerpost(
  '/analyze',';
  wrap.Async(async (req, res) => {
    try {
      const { content: context } = req.body,
      if (!content {
        return res.status(400)json({
          success: false,
          error) 'Content is required','});

      const analysis = await pydanticA.Ianalyze.Cognitive(content: context),
      res.json({
        success: true,
        _analysis})} catch (error) {
      loggererror('Cognitive: _analysisfailed:', LogContextA.P.I, {';
        error) error instanceof Error ? error.message : String(error)});
      res.status(500)json({
        success: false,
        error) error instanceof Error ? error.message : 'Analysis failed','})}}))/**
 * PO.S.T /api/pydantic-ai/plan* Task planning endpoint*/
routerpost(
  '/plan',';
  wrap.Async(async (req, res) => {
    try {
      const { objective, constraints } = req.body;
      if (!objective) {
        return res.status(400)json({
          success: false,
          error) 'Objective is required','});

      const plan = await pydanticA.Iplan.Task(objective, constraints);
      res.json({
        success: true,
        plan})} catch (error) {
      loggererror('Task planning: failed:', LogContextA.P.I, {';
        error) error instanceof Error ? error.message : String(error)});
      res.status(500)json({
        success: false,
        error) error instanceof Error ? error.message : 'Planning failed','})}}))/**
 * PO.S.T /api/pydantic-ai/generate-code* Code generation endpoint*/
routerpost(
  '/generate-code',';
  wrap.Async(async (req, res) => {
    try {
      const { specification, language = 'typescript', options } = req.body;';
      if (!specification) {
        return res.status(400)json({
          success: false,
          error) 'Specification is required','});

      const code = await pydanticA.Igenerate.Code(specification, language, options);
      res.json({
        success: true,
        code})} catch (error) {
      loggererror('Code generation: failed:', LogContextA.P.I, {';
        error) error instanceof Error ? error.message : String(error)});
      res.status(500)json({
        success: false,
        error) error instanceof Error ? error.message : 'Code generation failed','})}}))/**
 * PO.S.T /api/pydantic-ai/validate* Validate data against a schema*/
routerpost(
  '/validate',';
  wrap.Async(async (req, res) => {
    try {
      const { data, schema.Name, custom.Schema } = req.body;
      if (!data) {
        return res.status(400)json({
          success: false,
          error) 'Data is required','})}// If custom schema provided, register and use it;
      if (custom.Schema) {
        try {
          const zod.Schema = zobject(custom.Schema);
          pydanticA.Iregister.Schema('custom_validation', zod.Schema);';
          schema.Name = 'custom_validation';'} catch (error) {
          return res.status(400)json({
            success: false,
            error) 'Invalid schema definition','})};

      if (!schema.Name) {
        return res.status(400)json({
          success: false,
          error) 'Schema name or custom schema is required','})}// Use the Pydantic.A.I.agent for validation;
      const response = await pydantic.A.Irequest;
        prompt: `Validate the following data against the ${schema.Name} schema`,
        context: {
          metadata: { data, schema.Name };
        orchestration: {
          mode: 'simple',';
          preferred.Agents: ['pydantic_ai'],'}});
      res.json({
        success: true,
        validation: responsestructured.Data || responsecontent})} catch (error) {
      loggererror('Validation: failed:', LogContextA.P.I, {';
        error) error instanceof Error ? error.message : String(error)});
      res.status(500)json({
        success: false,
        error) error instanceof Error ? error.message : 'Validation failed','})}}))/**
 * PO.S.T /api/pydantic-ai/register-schema* Register a custom validation schema*/
routerpost(
  '/register-schema',';
  wrap.Async(async (req, res) => {
    try {
      const { name, schema } = req.body;
      if (!name || !schema) {
        return res.status(400)json({
          success: false,
          error) 'Name and schema are required','});

      try {
        const zod.Schema = zobject(schema);
        pydanticA.Iregister.Schema(name, zod.Schema);
        res.json({
          success: true,
          message: `Schema '${name}' registered successfully`,'})} catch (error) {
        return res.status(400)json({
          success: false,
          error) 'Invalid schema definition','})}} catch (error) {
      loggererror('Schema registration: failed:', LogContextA.P.I, {';
        error) error instanceof Error ? error.message : String(error)});
      res.status(500)json({
        success: false,
        error) error instanceof Error ? error.message : 'Registration failed','})}}))/**
 * G.E.T /api/pydantic-ai/stats* Get service statistics*/
routerget(
  '/stats',';
  wrap.Async(async (req, res) => {
    try {
      const stats = pydanticA.Iget.Stats();
      res.json({
        success: true,
        stats})} catch (error) {
      loggererror('Failed to get: stats:', LogContextA.P.I, {';
        error) error instanceof Error ? error.message : String(error)});
      res.status(500)json({
        success: false,
        error) error instanceof Error ? error.message : 'Failed to get stats','})}}))/**
 * PO.S.T /api/pydantic-ai/clear-cache* Clear the response cache*/
routerpost(
  '/clear-cache',';
  wrap.Async(async (req, res) => {
    try {
      pydanticA.Iclear.Cache();
      res.json({
        success: true,
        message: 'Cache cleared successfully','})} catch (error) {
      loggererror('Failed to clear: cache:', LogContextA.P.I, {';
        error) error instanceof Error ? error.message : String(error)});
      res.status(500)json({
        success: false,
        error) error instanceof Error ? error.message : 'Failed to clear cache','})}}))/**
 * PO.S.T /api/pydantic-ai/structured* Request with custom output schema*/
routerpost(
  '/structured',';
  wrap.Async(async (req, res) => {
    try {
      const { request, output.Schema } = req.body;
      if (!request| !output.Schema) {
        return res.status(400)json({
          success: false,
          error) 'Request and output.Schema.are required','});

      try {
        // Build Zod schema from JS.O.N.schema definition;
        const zod.Schema = build.Zod.Schema(output.Schema);
        const response = await pydanticAIrequest.With.Schema(requestzod.Schema);
        res.json({
          success: true,
          response})} catch (error) {
        return res.status(400)json({
          success: false,
          error) error instanceof Error ? error.message : 'Invalid schema or request;'})}} catch (error) {
      loggererror('Structured: requestfailed:', LogContextA.P.I, {';
        error) error instanceof Error ? error.message : String(error)});
      res.status(500)json({
        success: false,
        error) error instanceof Error ? error.message : 'Request failed','})}}))/**
 * Helper function to build Zod schema from JS.O.N.schema*/
function build.Zod.Schema(json.Schema: any): z.Zod.Schema {
  if (json.Schematype === 'object' && json.Schemaproperties) {';
    const: shape: Record<string, z.Zod.Schema> = {;
    for (const [key, value] of Objectentries(json.Schemaproperties)) {
      shape[key] = build.Zod.Schema(value as, any));

    let schema = zobject(shape);
    if (json.Schemarequired && Array.is.Array(json.Schemarequired)) {
      // Mark non-required fields as optional;
      for (const key of Object.keys(shape)) {
        if (!json.Schemarequired.includes(key)) {
          shape[key] = shape[key]optional()};
      schema = zobject(shape);

    return schema;

  if (json.Schematype === 'array' && json.Schemaitems) {';
    return zarray(build.Zod.Schema(json.Schemaitems));

  if (json.Schematype === 'string') {';
    return zstring();

  if (json.Schematype === 'number') {';
    return znumber();

  if (json.Schematype === 'boolean') {';
    return zboolean();

  if (json.Schematype === 'null') {';
    return znull()}// Default to unknown for unsupported types;
  return zunknown();

export default router;