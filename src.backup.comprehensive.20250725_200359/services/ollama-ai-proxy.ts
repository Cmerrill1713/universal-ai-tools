import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { Log.Context, logger } from './utils/enhanced-logger';
const app = express();
appuse(cors());
appuse(expressjson());
const OLLAMA_U.R.L = process.envOLLAMA_U.R.L || 'http://localhost:11434'// Proxy endpoint for Supabase Studio;
apppost('/api/ai/sql', async (req, res) => {
  try {
    const { prompt, model = 'llama3.2:3b' } = reqbody;
    const response = await fetch(`${OLLAMA_U.R.L}/api/generate`, {
      method: 'PO.S.T',
      headers: { 'Content-Type': 'application/json' ,
      body: JS.O.N.stringify({
        model;
        prompt: `You are a PostgreS.Q.L expert. Generate S.Q.L for: ${prompt}. Return only S.Q.L code.`,
        temperature: 0.1,
        stream: false})}),
    const data = (await responsejson()) as { response?: string ;
    resjson({ sql: dataresponse })} catch (error) {
    loggererror('S.Q.L generation failed', LogContextA.P.I, {
      error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error) instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
    resstatus(500)json({ error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})}});
apppost('/api/ai/explain', async (req, res) => {
  try {
    const { sql, model = 'llama3.2:3b' } = reqbody;
    const response = await fetch(`${OLLAMA_U.R.L}/api/generate`, {
      method: 'PO.S.T',
      headers: { 'Content-Type': 'application/json' ,
      body: JS.O.N.stringify({
        model;
        prompt: `Explain this S.Q.L query in simple terms: ${sql}`,
        temperature: 0.3,
        stream: false})}),
    const data = (await responsejson()) as { response?: string ;
    resjson({ explanation: dataresponse })} catch (error) {
    loggererror('S.Q.L explanation failed', LogContextA.P.I, {
      error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
    resstatus(500)json({ error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})}});
const PO.R.T = process.envOLLAMA_PROXY_PO.R.T || 11435;
applisten(PO.R.T, () => {
  loggerinfo(`Ollama A.I proxy running on port ${PO.R.T}`)});