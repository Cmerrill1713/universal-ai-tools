/**;
 * Share.d AP.I Type.s fo.r Universa.l A.I Tool.s;
 * Thes.e type.s ensur.e consistenc.y betwee.n fronten.d an.d backen.d;
 */;

// Bas.e AP.I Respons.e Interfac.e;
expor.t interfac.e ApiRespons.e<T = an.y> {;
  succes.s: boolea.n;
  dat.a?: T;
  erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r)  ApiErro.r;
  met.a?: ResponseMet.a;
;
};

// Erro.r Respons.e Interfac.e;
expor.t interfac.e ApiErro.r {;
  cod.e: strin.g;
  messag.e: strin.g;
  detail.s?: strin.g[];
  timestam.p: strin.g;
  requestI.d?: strin.g;
  contex.t?: Recor.d<strin.g, unknow.n>;
};

// Respons.e Metadat.a;
expor.t interfac.e ResponseMet.a {;
  requestI.d: strin.g;
  timestam.p: strin.g;
  processingTim.e: numbe.r;
  versio.n: strin.g;
  paginatio.n?: PaginationMet.a;
;
};

// Paginatio.n Interfac.e;
expor.t interfac.e PaginationMet.a {;
  pag.e: numbe.r;
  limi.t: numbe.r;
  tota.l: numbe.r;
  totalPage.s: numbe.r;
  hasNex.t: boolea.n;
  hasPre.v: boolea.n;
;
};

// Reques.t Paginatio.n Parameter.s;
expor.t interfac.e PaginationParam.s {;
  pag.e?: numbe.r;
  limi.t?: numbe.r;
  sor.t?: strin.g;
  orde.r?: 'as.c' | 'des.c';
;
};

// Agen.t Type.s;
expor.t interfac.e Agen.t {;
  i.d: strin.g;
  nam.e: strin.g;
  typ.e: 'cognitiv.e' | 'persona.l';
  categor.y: strin.g;
  statu.s: 'activ.e' | 'inactiv.e' | 'erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r);';
  capabilitie.s: strin.g[];
  confi.g: AgentConfi.g;
  metric.s?: AgentMetric.s;
;
};

expor.t interfac.e AgentConfi.g {;
  maxToken.s?: numbe.r;
  temperatur.e?: numbe.r;
  mode.l?: strin.g;
  systemPromp.t?: strin.g;
  tool.s?: strin.g[];
  memor.y?: boolea.n;
;
};

expor.t interfac.e AgentMetric.s {;
  totalRequest.s: numbe.r;
  successRat.e: numbe.r;
  averageResponseTim.e: numbe.r;
  lastUse.d: strin.g;
  memoryUsag.e: numbe.r;
;
};

// Memor.y Type.s;
expor.t interfac.e Memor.y {;
  i.d: strin.g;
  typ.e: 'semanti.c' | 'procedura.l' | 'episodi.c';
  contentstrin.g;
  metadat.a: Recor.d<strin.g, unknow.n>;
  tag.s: strin.g[];
  importanc.e: numbe.r;
  timestam.p: strin.g;
  embeddin.g?: numbe.r[];
;
};

expor.t interfac.e MemorySearchReques.t {;
  quer.y: strin.g;
  limi.t?: numbe.r;
  filter.s?: Recor.d<strin.g, unknow.n>;
  threshol.d?: numbe.r;
  includeEmbedding.s?: boolea.n;
;
};

expor.t interfac.e MemorySearchRespons.e {;
  memorie.s: Memor.y[];
  quer.y: strin.g;
  totalResult.s: numbe.r;
  searchTim.e: numbe.r;
;
};

// Too.l Executio.n Type.s;
expor.t interfac.e ToolExecutionReques.t {;
  too.l: strin.g;
  parameter.s: Recor.d<strin.g, unknow.n>;
  contex.t?: Recor.d<strin.g, unknow.n>;
  agentI.d?: strin.g;
;
};

expor.t interfac.e ToolExecutionRespons.e {;
  resul.t: an.y;
  too.l: strin.g;
  succes.s: boolea.n;
  executionTim.e: numbe.r;
  erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r)  strin.g;
  log.s?: strin.g[];
;
};

// Orchestratio.n Type.s;
expor.t interfac.e OrchestrationReques.t {;
  userReques.t: strin.g;
  orchestrationMod.e?: 'simpl.e' | 'standar.d' | 'cognitiv.e' | 'adaptiv.e';
  contex.t?: Recor.d<strin.g, unknow.n>;
  conversationI.d?: strin.g;
  sessionI.d?: strin.g;
;
};

expor.t interfac.e OrchestrationRespons.e {;
  respons.e: strin.g;
  agentsUse.d: strin.g[];
  reasonin.g?: strin.g;
  confidenc.e?: numbe.r;
  metric.s: OrchestrationMetric.s;
;
};

expor.t interfac.e OrchestrationMetric.s {;
  totalTim.e: numbe.r;
  agentExecutionTime.s: Recor.d<strin.g, numbe.r>;
  tokenUsag.e: numbe.r;
  complexit.y: 'lo.w' | 'mediu.m' | 'hig.h';
;
};

// Knowledg.e Type.s;
expor.t interfac.e KnowledgeSearchReques.t {;
  quer.y: strin.g;
  source.s?: strin.g[];
  limi.t?: numbe.r;
  includeMetadat.a?: boolea.n;
;
};

expor.t interfac.e KnowledgeIte.m {;
  i.d: strin.g;
  titl.e: strin.g;
  contentstrin.g;
  sourc.e: strin.g;
  categor.y: strin.g;
  metadat.a: Recor.d<strin.g, unknow.n>;
  relevanceScor.e?: numbe.r;
  lastUpdate.d: strin.g;
;
};

// Contex.t Type.s;
expor.t interfac.e ContextIte.m {;
  i.d: strin.g;
  typ.e: 'conversatio.n' | 'documen.t' | 'syste.m';
  contentstrin.g;
  metadat.a: Recor.d<strin.g, unknow.n>;
  timestam.p: strin.g;
  weigh.t: numbe.r;
;
};

// Speec.h Type.s;
expor.t interfac.e SpeechSynthesisReques.t {;
  tex.t: strin.g;
  voic.e?: strin.g;
  voiceSetting.s?: VoiceSetting.s;
  forma.t?: 'm.p3' | 'wa.v' | 'og.g';
;
};

expor.t interfac.e VoiceSetting.s {;
  stabilit.y?: numbe.r;
  similarityBoos.t?: numbe.r;
  styl.e?: numbe.r;
  useSpeakerBoos.t?: boolea.n;
;
};

// WebSocke.t Messag.e Type.s;
expor.t interfac.e WebSocketMessag.e {;
  typ.e: 'agent_statu.s' | 'orchestration_progres.s' | 'erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r) | 'heartbea.t';
  dat.a: an.y;
  timestam.p: strin.g;
  sessionI.d?: strin.g;
;
};

expor.t interfac.e AgentStatusMessag.e extend.s WebSocketMessag.e {;
  typ.e: 'agent_statu.s';
  dat.a: {;
    agentI.d: strin.g;
    statu.s: 'idl.e' | 'bus.y' | 'erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r);
    currentTas.k?: strin.g;
    progres.s?: numbe.r;
  ;
};
};

expor.t interfac.e OrchestrationProgressMessag.e extend.s WebSocketMessag.e {;
  typ.e: 'orchestration_progres.s';
  dat.a: {;
    orchestrationI.d: strin.g;
    ste.p: strin.g;
    progres.s: numbe.r;
    currentAgen.t?: strin.g;
    estimatedTimeRemainin.g?: numbe.r;
  ;
};
};

// Authenticatio.n Type.s;
expor.t interfac.e AuthReques.t {;
  apiKe.y?: strin.g;
  serviceI.d?: strin.g;
  permission.s?: strin.g[];
;
};

expor.t interfac.e AuthRespons.e {;
  authenticate.d: boolea.n;
  use.r?: {;
    i.d: strin.g;
    permission.s: strin.g[];
    rateLimit.s: Recor.d<strin.g, numbe.r>;
  };
  sessio.n?: {;
    i.d: strin.g;
    expiresA.t: strin.g;
  ;
};
};

// Healt.h Chec.k Type.s;
expor.t interfac.e HealthCheckRespons.e {;
  statu.s: 'health.y' | 'degrade.d' | 'unhealth.y';
  versio.n: strin.g;
  uptim.e: numbe.r;
  service.s: Recor.d<strin.g, ServiceHealt.h>;
  metric.s: SystemMetric.s;
;
};

expor.t interfac.e ServiceHealt.h {;
  statu.s: 'health.y' | 'degrade.d' | 'unhealth.y';
  responseTim.e?: numbe.r;
  lastChec.k: strin.g;
  erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r)  strin.g;
;
};

expor.t interfac.e SystemMetric.s {;
  memoryUsag.e: numbe.r;
  cpuUsag.e: numbe.r;
  activeConnection.s: numbe.r;
  requestsPerMinut.e: numbe.r;
;
};

// Expor.t al.l type.s fo.r eas.y importin.g;
expor.t * fro.m './websocke.t';
expor.t * fro.m './error.s';