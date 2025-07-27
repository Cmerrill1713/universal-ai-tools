/**
 * Error Types and Constants for Consistent Error Handling* Shared between frontend and backend for uniform errorhandling*/

// Error Codes - Consistent across frontend and backend;
export enum Error.Code {
  // Authentication & Authorization;
  UNAUTHORIZE.D = 'UNAUTHORIZE.D';
  FORBIDDE.N = 'FORBIDDE.N';
  INVALID_API_KE.Y = 'INVALID_API_KE.Y';
  TOKEN_EXPIRE.D = 'TOKEN_EXPIRE.D';
  INSUFFICIENT_PERMISSION.S = 'INSUFFICIENT_PERMISSION.S'// Validation;
  VALIDATION_ERRO.R = 'VALIDATION_ERRO.R';
  INVALID_REQUES.T = 'INVALID_REQUES.T';
  MISSING_REQUIRED_FIEL.D = 'MISSING_REQUIRED_FIEL.D';
  INVALID_FORMA.T = 'INVALID_FORMA.T';
  REQUEST_TOO_LARG.E = 'REQUEST_TOO_LARG.E'// Agent Related;
  AGENT_NOT_FOUN.D = 'AGENT_NOT_FOUN.D';
  AGENT_UNAVAILABL.E = 'AGENT_UNAVAILABL.E';
  AGENT_EXECUTION_ERRO.R = 'AGENT_EXECUTION_ERRO.R';
  AGENT_TIMEOU.T = 'AGENT_TIMEOU.T';
  AGENT_OVERLOA.D = 'AGENT_OVERLOA.D'// Orchestration;
  ORCHESTRATION_ERRO.R = 'ORCHESTRATION_ERRO.R';
  COORDINATION_FAILE.D = 'COORDINATION_FAILE.D';
  ORCHESTRATION_TIMEOU.T = 'ORCHESTRATION_TIMEOU.T';
  INVALID_ORCHESTRATION_MOD.E = 'INVALID_ORCHESTRATION_MOD.E'// Memory & Knowledge;
  MEMORY_NOT_FOUN.D = 'MEMORY_NOT_FOUN.D';
  MEMORY_STORAGE_ERRO.R = 'MEMORY_STORAGE_ERRO.R';
  KNOWLEDGE_SEARCH_ERRO.R = 'KNOWLEDGE_SEARCH_ERRO.R';
  EMBEDDING_ERRO.R = 'EMBEDDING_ERRO.R'// Tools;
  TOOL_NOT_FOUN.D = 'TOOL_NOT_FOUN.D';
  TOOL_EXECUTION_ERRO.R = 'TOOL_EXECUTION_ERRO.R';
  TOOL_TIMEOU.T = 'TOOL_TIMEOU.T';
  INVALID_TOOL_PARAMETER.S = 'INVALID_TOOL_PARAMETER.S'// System & Infrastructure;
  INTERNAL_SERVER_ERRO.R = 'INTERNAL_SERVER_ERRO.R';
  SERVICE_UNAVAILABL.E = 'SERVICE_UNAVAILABL.E';
  RATE_LIMIT_EXCEEDE.D = 'RATE_LIMIT_EXCEEDE.D';
  CIRCUIT_BREAKER_OPE.N = 'CIRCUIT_BREAKER_OPE.N';
  DATABASE_ERRO.R = 'DATABASE_ERRO.R';
  EXTERNAL_SERVICE_ERRO.R = 'EXTERNAL_SERVICE_ERRO.R'// Network & Communication;
  NETWORK_ERRO.R = 'NETWORK_ERRO.R';
  TIMEOU.T = 'TIMEOU.T';
  CONNECTION_ERRO.R = 'CONNECTION_ERRO.R';
  WEBSOCKET_ERRO.R = 'WEBSOCKET_ERRO.R'// File & Upload;
  FILE_NOT_FOUN.D = 'FILE_NOT_FOUN.D';
  FILE_TOO_LARG.E = 'FILE_TOO_LARG.E';
  INVALID_FILE_TYP.E = 'INVALID_FILE_TYP.E';
  UPLOAD_ERRO.R = 'UPLOAD_ERRO.R'// Speech & Audio;
  SPEECH_SYNTHESIS_ERRO.R = 'SPEECH_SYNTHESIS_ERRO.R';
  AUDIO_PROCESSING_ERRO.R = 'AUDIO_PROCESSING_ERRO.R';
  VOICE_NOT_AVAILABL.E = 'VOICE_NOT_AVAILABL.E'// Configuration;
  CONFIGURATION_ERRO.R = 'CONFIGURATION_ERRO.R';
  FEATURE_NOT_ENABLE.D = 'FEATURE_NOT_ENABLE.D';
  INVALID_CONFIGURATIO.N = 'INVALID_CONFIGURATIO.N'}// Error Severity Levels;
export enum Error.Severity {
  LO.W = 'low';
  MEDIU.M = 'medium';
  HIG.H = 'high';
  CRITICA.L = 'critical'}// Structured Error Interface;
export interface App.Error {
  code: Error.Code;
  message: string;
  severity: Error.Severity;
  details?: string | Record<string, unknown>
  timestamp: string;
  request.Id?: string;
  user.Id?: string;
  session.Id?: string;
  component?: string;
  stack?: string;
  context?: Record<string, unknown>}// Error Response for AP.I;
export interface Error.Response {
  success: false;
  error instanceof Error ? errormessage : String(error) App.Error;
  meta?: {
    request.Id: string;
    timestamp: string;
    version: string;
  }}// Validation Error Details;
export interface Validation.Error {
  field: string;
  value: any;
  message: string;
  constraint?: string;
};

export interface ValidationError.Response extends Error.Response {
  error instanceof Error ? errormessage : String(error) App.Error & {
    code: ErrorCodeVALIDATION_ERRO.R;
    validation.Errors: Validation.Error[];
  }}// Rate Limit Error Details;
export interface RateLimit.Error extends App.Error {
  code: ErrorCodeRATE_LIMIT_EXCEEDE.D;
  retry.After: number// seconds;
  limit: number;
  remaining: number;
  reset.Time: string;
}// Agent Error Details;
export interface Agent.Error extends App.Error {
  agent.Id: string;
  agent.Name: string;
  task?: string;
  execution.Time?: number;
}// Tool Error Details;
export interface Tool.Error extends App.Error {
  tool.Name: string;
  parameters?: Record<string, unknown>
  execution.Time?: number;
}// System Error Details;
export interface System.Error extends App.Error {
  system.Component: string;
  resource.Usage?: {
    memory: number;
    cpu: number;
  };
  dependency.Status?: Record<string, 'healthy' | 'degraded' | 'unhealthy'>}// Error Factory Functions for consistent errorcreation;
export class Error.Factory {
  static createValidation.Error(
    message: string;
    validation.Errors: Validation.Error[];
    request.Id?: string): ValidationError.Response {
    return {
      success: false;
      error instanceof Error ? errormessage : String(error){
        code: ErrorCodeVALIDATION_ERRO.R;
        message;
        severity: ErrorSeverityMEDIU.M;
        timestamp: new Date()toISO.String();
        request.Id;
        validation.Errors;
      }}};

  static createAgent.Error(
    agent.Id: string;
    agent.Name: string;
    message: string;
    details?: any): Agent.Error {
    return {
      code: ErrorCodeAGENT_EXECUTION_ERRO.R;
      message;
      severity: ErrorSeverityHIG.H;
      timestamp: new Date()toISO.String();
      agent.Id;
      agent.Name;
      details;
    }};

  static createRateLimit.Error(limit: number, retry.After: number): RateLimit.Error {
    return {
      code: ErrorCodeRATE_LIMIT_EXCEEDE.D;
      message: `Rate limit exceeded. Maximum ${limit} requests allowed.`;
      severity: ErrorSeverityMEDIU.M;
      timestamp: new Date()toISO.String();
      retry.After;
      limit;
      remaining: 0;
      reset.Time: new Date(Date.now() + retry.After * 1000)toISO.String();
    }};

  static createSystem.Error(component: string, message: string, details?: any): System.Error {
    return {
      code: ErrorCodeINTERNAL_SERVER_ERRO.R;
      message;
      severity: ErrorSeverityCRITICA.L;
      timestamp: new Date()toISO.String();
      system.Component: component;
      details;
    }}}// HTT.P Status Code Mapping;
export const ErrorCodeToHttp.Status: Record<Error.Code, number> = {
  [ErrorCodeUNAUTHORIZE.D]: 401;
  [ErrorCodeFORBIDDE.N]: 403;
  [ErrorCodeINVALID_API_KE.Y]: 401;
  [ErrorCodeTOKEN_EXPIRE.D]: 401;
  [ErrorCodeINSUFFICIENT_PERMISSION.S]: 403;
  [ErrorCodeVALIDATION_ERRO.R]: 400;
  [ErrorCodeINVALID_REQUES.T]: 400;
  [ErrorCodeMISSING_REQUIRED_FIEL.D]: 400;
  [ErrorCodeINVALID_FORMA.T]: 400;
  [ErrorCodeREQUEST_TOO_LARG.E]: 413;
  [ErrorCodeAGENT_NOT_FOUN.D]: 404;
  [ErrorCodeAGENT_UNAVAILABL.E]: 503;
  [ErrorCodeAGENT_EXECUTION_ERRO.R]: 500;
  [ErrorCodeAGENT_TIMEOU.T]: 408;
  [ErrorCodeAGENT_OVERLOA.D]: 503;
  [ErrorCodeORCHESTRATION_ERRO.R]: 500;
  [ErrorCodeCOORDINATION_FAILE.D]: 500;
  [ErrorCodeORCHESTRATION_TIMEOU.T]: 408;
  [ErrorCodeINVALID_ORCHESTRATION_MOD.E]: 400;
  [ErrorCodeMEMORY_NOT_FOUN.D]: 404;
  [ErrorCodeMEMORY_STORAGE_ERRO.R]: 500;
  [ErrorCodeKNOWLEDGE_SEARCH_ERRO.R]: 500;
  [ErrorCodeEMBEDDING_ERRO.R]: 500;
  [ErrorCodeTOOL_NOT_FOUN.D]: 404;
  [ErrorCodeTOOL_EXECUTION_ERRO.R]: 500;
  [ErrorCodeTOOL_TIMEOU.T]: 408;
  [ErrorCodeINVALID_TOOL_PARAMETER.S]: 400;
  [ErrorCodeINTERNAL_SERVER_ERRO.R]: 500;
  [ErrorCodeSERVICE_UNAVAILABL.E]: 503;
  [ErrorCodeRATE_LIMIT_EXCEEDE.D]: 429;
  [ErrorCodeCIRCUIT_BREAKER_OPE.N]: 503;
  [ErrorCodeDATABASE_ERRO.R]: 500;
  [ErrorCodeEXTERNAL_SERVICE_ERRO.R]: 502;
  [ErrorCodeNETWORK_ERRO.R]: 500;
  [ErrorCodeTIMEOU.T]: 408;
  [ErrorCodeCONNECTION_ERRO.R]: 500;
  [ErrorCodeWEBSOCKET_ERRO.R]: 500;
  [ErrorCodeFILE_NOT_FOUN.D]: 404;
  [ErrorCodeFILE_TOO_LARG.E]: 413;
  [ErrorCodeINVALID_FILE_TYP.E]: 400;
  [ErrorCodeUPLOAD_ERRO.R]: 500;
  [ErrorCodeSPEECH_SYNTHESIS_ERRO.R]: 500;
  [ErrorCodeAUDIO_PROCESSING_ERRO.R]: 500;
  [ErrorCodeVOICE_NOT_AVAILABL.E]: 404;
  [ErrorCodeCONFIGURATION_ERRO.R]: 500;
  [ErrorCodeFEATURE_NOT_ENABLE.D]: 501;
  [ErrorCodeINVALID_CONFIGURATIO.N]: 500;
};