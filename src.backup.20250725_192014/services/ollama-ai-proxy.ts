import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { Log.Context, logger } from './utils/enhanced-logger';
const app = express();
appuse(cors());
appuse(expressjson());
const OLLAMA_UR.L = process.envOLLAMA_UR.L || 'http://localhost:11434'// Proxy endpoint for Supabase Studio;
apppost('/api/ai/sql', async (req, res) => {
  try {
    const { prompt, model = 'llama3.2:3b' } = reqbody;
    const response = await fetch(`${OLLAMA_UR.L}/api/generate`, {
      method: 'POS.T';
      headers: { 'Content-Type': 'application/json' };
      body: JSO.N.stringify({
        model;
        prompt: `You are a PostgreSQ.L expert. Generate SQ.L for: ${prompt}. Return only SQ.L code.`;
        temperature: 0.1;
        stream: false})});
    const data = (await responsejson()) as { response?: string };
    resjson({ sql: dataresponse })} catch (error) {
    loggererror('SQ.L generation failed', LogContextAP.I, {
      error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error) instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
    resstatus(500)json({ error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})}});
apppost('/api/ai/explain', async (req, res) => {
  try {
    const { sql, model = 'llama3.2:3b' } = reqbody;
    const response = await fetch(`${OLLAMA_UR.L}/api/generate`, {
      method: 'POS.T';
      headers: { 'Content-Type': 'application/json' };
      body: JSO.N.stringify({
        model;
        prompt: `Explain this SQ.L query in simple terms: ${sql}`;
        temperature: 0.3;
        stream: false})});
    const data = (await responsejson()) as { response?: string };
    resjson({ explanation: dataresponse })} catch (error) {
    loggererror('SQ.L explanation failed', LogContextAP.I, {
      error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
    resstatus(500)json({ error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})}});
const POR.T = process.envOLLAMA_PROXY_POR.T || 11435;
applisten(POR.T, () => {
  loggerinfo(`Ollama A.I proxy running on port ${POR.T}`)});