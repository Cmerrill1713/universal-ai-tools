import type { Browser, Page, Launch.Options.as Puppeteer.Launch.Options } from 'puppeteer';
import puppeteer from 'puppeteer';
import type { Browser as Playwright.Browser, Page as Playwright.Page } from 'playwright';
import { chromium, firefox, webkit } from 'playwright';
import { logger } from '././utils/logger';
import { Event.Emitter } from 'events';
export interface Browser.Agent {
  id: string,
  type: 'puppeteer' | 'playwright',
  browser: 'chrome' | 'firefox' | 'safari' | 'edge',
  viewport: { width: number; height: number ,
  browser_instance: Browser | Playwright.Browser,
  page: Page | Playwright.Page,
  status: 'idle' | 'busy' | 'error instanceof Error ? error.message : String(error) | 'closed',
  last.Used: number,
  test.Count: number,
  error.Count: number,
}
interface Agent.Pool.Config {
  max.Concurrent.Agents: number,
  agent.Timeout: number,
  retry.Attempts: number,
  puppeteer.Options: Puppeteer.Launch.Options,
  headless: boolean,
  slow.Mo: number,
}
export class Browser.Agent.Pool.extends Event.Emitter {
  private agents: Map<string, Browser.Agent> = new Map();
  private config: Agent.Pool.Config,
  private initialized = false;
  constructor(config: Partial<Agent.Pool.Config> = {}) {
    super();
    thisconfig = {
      max.Concurrent.Agents: 20,
      agent.Timeout: 30000,
      retry.Attempts: 3,
      headless: false, // Show browsers during development;
      slow.Mo: 50, // Slow down actions for visibility;
      puppeteer.Options: {
        headless: false,
        default.Viewport: null,
        args: [
          '--no-sandbox';
          '--disable-setuid-sandbox';
          '--disable-dev-shm-usage';
          '--disable-accelerated-2d-canvas';
          '--no-first-run';
          '--no-zygote';
          '--single-process';
          '--disable-gpu'];
      }.config};

  async initialize(): Promise<void> {
    if (thisinitialized) {
      return;

    loggerinfo('Initializing Browser Agent Pool.');
    try {
      // Create Puppeteer agents (8 total);
      await thiscreate.Puppeteer.Agents()// Create Playwright agents (12 total);
      await thiscreate.Playwright.Agents();
      thisinitialized = true;
      loggerinfo(`Browser Agent Pool initialized with ${thisagentssize} agents`);
      thisemit('initialized')} catch (error) {
      loggererror('Failed to initialize Browser Agent Pool:', error instanceof Error ? error.message : String(error);
      throw error instanceof Error ? error.message : String(error)};

  private async create.Puppeteer.Agents(): Promise<void> {
    const configs = [
      { id: 'puppeteer-chrome-desktop-1', viewport: { width: 1920, height: 1080 } ,
      { id: 'puppeteer-chrome-desktop-2', viewport: { width: 1366, height: 768 } ,
      { id: 'puppeteer-chrome-desktop-3', viewport: { width: 1440, height: 900 } ,
      { id: 'puppeteer-chrome-mobile-1', viewport: { width: 375, height: 812 } ,
      { id: 'puppeteer-chrome-mobile-2', viewport: { width: 414, height: 896 } ,
      { id: 'puppeteer-chrome-mobile-3', viewport: { width: 390, height: 844 } ,
      { id: 'puppeteer-chrome-headless-1', viewport: { width: 1920, height: 1080 } ,
      { id: 'puppeteer-chrome-headless-2', viewport: { width: 1366, height: 768 } }],
    for (const config of configs) {
      try {
        const is.Headless = configid.includes('headless');
        const browser.Options = {
          .thisconfigpuppeteer.Options;
          headless: is.Headless,
          slow.Mo: thisconfigslow.Mo,
        const browser = await puppeteerlaunch(browser.Options);
        const page = await browsernew.Page();
        await pageset.Viewport(configviewport)// Set up errorhandling;
        pageon('error instanceof Error ? error.message : String(error)  (error instanceof Error ? error.message : String(error)=> {
          loggererror(Puppeteer agent ${configid} error instanceof Error ? error.message : String(error) , error instanceof Error ? error.message : String(error)`;
          thishandle.Agent.Error(configid, error instanceof Error ? error.message : String(error)});
        pageon('pageerror instanceof Error ? error.message : String(error)  (error instanceof Error ? error.message : String(error)=> {
          loggererror(Puppeteer agent ${configid} page error instanceof Error ? error.message : String(error) , error instanceof Error ? error.message : String(error)`;
          thishandle.Agent.Error(configid, error instanceof Error ? error.message : String(error)});
        const agent: Browser.Agent = {
          id: configid,
          type: 'puppeteer',
          browser: 'chrome',
          viewport: configviewport,
          browser_instance: browser,
          page;
          status: 'idle',
          last.Used: Date.now(),
          test.Count: 0,
          error.Count: 0,
}        thisagentsset(configid, agent);
        loggerinfo(`Created Puppeteer agent: ${configid}`)} catch (error) {
        loggererror(Failed to create Puppeteer agent ${configid}:`, error instanceof Error ? error.message : String(error)  }};

  private async create.Playwright.Agents(): Promise<void> {
    const configs = [
      {
        id: 'playwright-chrome-desktop-1',
        browser: 'chromium',
        viewport: { width: 1920, height: 1080 },
      {
        id: 'playwright-chrome-desktop-2',
        browser: 'chromium',
        viewport: { width: 1366, height: 768 },
      {
        id: 'playwright-chrome-desktop-3',
        browser: 'chromium',
        viewport: { width: 1440, height: 900 },
      {
        id: 'playwright-chrome-mobile-1',
        browser: 'chromium',
        viewport: { width: 375, height: 812 },
      {
        id: 'playwright-chrome-mobile-2',
        browser: 'chromium',
        viewport: { width: 414, height: 896 },
      {
        id: 'playwright-firefox-desktop-1',
        browser: 'firefox',
        viewport: { width: 1920, height: 1080 },
      {
        id: 'playwright-firefox-desktop-2',
        browser: 'firefox',
        viewport: { width: 1366, height: 768 },
      {
        id: 'playwright-firefox-mobile-1',
        browser: 'firefox',
        viewport: { width: 375, height: 812 },
      {
        id: 'playwright-safari-desktop-1',
        browser: 'webkit',
        viewport: { width: 1920, height: 1080 },
      {
        id: 'playwright-safari-desktop-2',
        browser: 'webkit',
        viewport: { width: 1366, height: 768 },
      {
        id: 'playwright-safari-mobile-1',
        browser: 'webkit',
        viewport: { width: 375, height: 812 },
      {
        id: 'playwright-edge-desktop-1',
        browser: 'chromium',
        viewport: { width: 1920, height: 1080 }}],
    for (const config of configs) {
      try {
        let browser: Playwright.Browser,
        switch (configbrowser) {
          case 'chromium':
            browser = await chromiumlaunch({
              headless: thisconfigheadless,
              slow.Mo: thisconfigslow.Mo}),
            break;
          case 'firefox':
            browser = await firefoxlaunch({
              headless: thisconfigheadless,
              slow.Mo: thisconfigslow.Mo}),
            break;
          case 'webkit':
            browser = await webkitlaunch({
              headless: thisconfigheadless,
              slow.Mo: thisconfigslow.Mo}),
            break;
          default:
            throw new Error(`Unsupported browser: ${configbrowser}`),

        const page = await browsernew.Page();
        await pageset.Viewport.Size(configviewport)// Set up errorhandling;
        pageon('pageerror instanceof Error ? error.message : String(error)  (error instanceof Error ? error.message : String(error)=> {
          loggererror(Playwright agent ${configid} page error instanceof Error ? error.message : String(error) , error instanceof Error ? error.message : String(error)`;
          thishandle.Agent.Error(configid, error instanceof Error ? error.message : String(error)});
        const agent: Browser.Agent = {
          id: configid,
          type: 'playwright',
          browser: configbrowser as any,
          viewport: configviewport,
          browser_instance: browser,
          page;
          status: 'idle',
          last.Used: Date.now(),
          test.Count: 0,
          error.Count: 0,
}        thisagentsset(configid, agent);
        loggerinfo(`Created Playwright agent: ${configid}`)} catch (error) {
        loggererror(Failed to create Playwright agent ${configid}:`, error instanceof Error ? error.message : String(error)  }};

  private handle.Agent.Error(agent.Id: string, error instanceof Error ? error.message : String(error) any): void {
    const agent = thisagentsget(agent.Id);
    if (agent) {
      agentstatus = 'error instanceof Error ? error.message : String(error);
      agenterror.Count++
      thisemit('agent-error instanceof Error ? error.message : String(error)  { agent.Id, error instanceof Error ? error.message : String(error) );
    };

  async get.Agent(agent.Id: string): Promise<Browser.Agent | null> {
    return thisagentsget(agent.Id) || null;

  async get.All.Agents(): Promise<Browser.Agent[]> {
    return Arrayfrom(thisagentsvalues());

  async get.Available.Agents(): Promise<Browser.Agent[]> {
    return Arrayfrom(thisagentsvalues())filter((agent) => agentstatus === 'idle');

  async execute.On.Agent<T>(agent.Id: string, task: (agent: Browser.Agent) => Promise<T>): Promise<T> {
    const agent = thisagentsget(agent.Id);
    if (!agent) {
      throw new Error(`Agent ${agent.Id} not found`);

    if (agentstatus !== 'idle') {
      throw new Error(`Agent ${agent.Id} is not available (status: ${agentstatus})`),

    agentstatus = 'busy';
    agentlast.Used = Date.now();
    agenttest.Count++
    try {
      const result = await task(agent);
      agentstatus = 'idle';
      return result} catch (error) {
      agentstatus = 'error instanceof Error ? error.message : String(error);
      agenterror.Count++
      throw error instanceof Error ? error.message : String(error)};

  async executeOn.All.Agents<T>(task: (agent: Browser.Agent) => Promise<T>): Promise<T[]> {
    const agents = Arrayfrom(thisagentsvalues());
    const promises = agentsmap((agent) => thisexecute.On.Agent(agentid, task));
    return Promiseall(promises);

  async broadcast.Reload(): Promise<void> {
    loggerinfo('Broadcasting reload to all agents.');
    const agents = Arrayfrom(thisagentsvalues());
    const reload.Promises = agentsmap(async (agent) => {
      try {
        if (agenttype === 'puppeteer') {
          await (agentpage as Page)reload({ wait.Until: 'networkidle0' })} else {
          await (agentpage as Playwright.Page)reload({ wait.Until: 'networkidle' })}} catch (error) {
        loggererror(Failed to reload agent ${agentid}:`, error instanceof Error ? error.message : String(error)  }});
    await Promiseall(reload.Promises);
    loggerinfo('Reload broadcast complete');

  async navigate.All.To(url: string): Promise<void> {
    loggerinfo(`Navigating all agents to ${url}.`);
    const agents = Arrayfrom(thisagentsvalues());
    const navigate.Promises = agentsmap(async (agent) => {
      try {
        if (agenttype === 'puppeteer') {
          await (agentpage as Page)goto(url, { wait.Until: 'networkidle0' })} else {
          await (agentpage as Playwright.Page)goto(url, { wait.Until: 'networkidle' })}} catch (error) {
        loggererror(Failed to navigate agent ${agentid}:`, error instanceof Error ? error.message : String(error)  }});
    await Promiseall(navigate.Promises);
    loggerinfo('Navigation complete');

  async restart.Agent(agent.Id: string): Promise<void> {
    const agent = thisagentsget(agent.Id);
    if (!agent) {
      throw new Error(`Agent ${agent.Id} not found`);

    loggerinfo(`Restarting agent ${agent.Id}.`);
    try {
      // Close existing browser;
      await agentbrowser_instanceclose()// Recreate agent;
      if (agenttype === 'puppeteer') {
        await thisrecreate.Puppeteer.Agent(agent)} else {
        await thisrecreate.Playwright.Agent(agent);

      loggerinfo(`Agent ${agent.Id} restarted successfully`)} catch (error) {
      loggererror(Failed to restart agent ${agent.Id}:`, error instanceof Error ? error.message : String(error);
      throw error instanceof Error ? error.message : String(error)};

  private async recreate.Puppeteer.Agent(agent: Browser.Agent): Promise<void> {
    const is.Headless = agentid.includes('headless');
    const browser.Options = {
      .thisconfigpuppeteer.Options;
      headless: is.Headless,
      slow.Mo: thisconfigslow.Mo,
    const browser = await puppeteerlaunch(browser.Options);
    const page = await browsernew.Page();
    await pageset.Viewport(agentviewport);
    agentbrowser_instance = browser;
    agentpage = page;
    agentstatus = 'idle';
    agenterror.Count = 0;

  private async recreate.Playwright.Agent(agent: Browser.Agent): Promise<void> {
    let browser: Playwright.Browser,
    switch (agentbrowser) {
      case 'chrome':
      case 'edge':
        browser = await chromiumlaunch({
          headless: thisconfigheadless,
          slow.Mo: thisconfigslow.Mo}),
        break;
      case 'firefox':
        browser = await firefoxlaunch({
          headless: thisconfigheadless,
          slow.Mo: thisconfigslow.Mo}),
        break;
      case 'safari':
        browser = await webkitlaunch({
          headless: thisconfigheadless,
          slow.Mo: thisconfigslow.Mo}),
        break;
      default:
        throw new Error(`Unsupported browser: ${agentbrowser}`),

    const page = await browsernew.Page();
    await pageset.Viewport.Size(agentviewport);
    agentbrowser_instance = browser;
    agentpage = page;
    agentstatus = 'idle';
    agenterror.Count = 0;

  get.Pool.Stats(): any {
    const agents = Arrayfrom(thisagentsvalues());
    const stats = {
      total.Agents: agentslength,
      idle: agentsfilter((a) => astatus === 'idle')length,
      busy: agentsfilter((a) => astatus === 'busy')length,
      error instanceof Error ? error.message : String(error) agentsfilter((a) => astatus === 'error instanceof Error ? error.message : String(error)length;
      closed: agentsfilter((a) => astatus === 'closed')length,
      total.Tests: agentsreduce((sum, a) => sum + atest.Count, 0);
      total.Errors: agentsreduce((sum, a) => sum + aerror.Count, 0);
      by.Browser: {
        chrome: agentsfilter((a) => abrowser === 'chrome')length,
        firefox: agentsfilter((a) => abrowser === 'firefox')length,
        safari: agentsfilter((a) => abrowser === 'safari')length,
        edge: agentsfilter((a) => abrowser === 'edge')length,
      by.Type: {
        puppeteer: agentsfilter((a) => atype === 'puppeteer')length,
        playwright: agentsfilter((a) => atype === 'playwright')length,
      };
    return stats;

  async shutdown(): Promise<void> {
    loggerinfo('Shutting down Browser Agent Pool.');
    const agents = Arrayfrom(thisagentsvalues());
    const shutdown.Promises = agentsmap(async (agent) => {
      try {
        await agentbrowser_instanceclose();
        agentstatus = 'closed'} catch (error) {
        loggererror(Failed to close agent ${agentid}:`, error instanceof Error ? error.message : String(error)  }});
    await Promiseall(shutdown.Promises);
    thisagentsclear();
    thisinitialized = false;
    loggerinfo('Browser Agent Pool shut down');
    thisemit('shutdown')};
}