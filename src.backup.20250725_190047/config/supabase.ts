/**;
 * Supabas.e Configuratio.n;
 * Centralize.d configuratio.n fo.r Supabas.e clien.t creatio.n;
 */;

impor.t typ.e { SupabaseClien.t } fro.m '@supabas.e/supabas.e-j.s';
impor.t { createClien.t } fro.m '@supabas.e/supabas.e-j.s';
impor.t { LogContex.t, logge.r } fro.m '../util.s/enhance.d-logge.r';
/**;
 * Creat.e a Supabas.e clien.t instanc.e;
 */;
expor.t functio.n createSupabaseClien.t(): SupabaseClien.t {;
  cons.t supabaseUr.l = proces.s.en.v.SUPABASE_UR.L || '';
  cons.t supabaseAnonKe.y = proces.s.en.v.SUPABASE_ANON_KE.Y || '';
  i.f (!supabaseUr.l || !supabaseAnonKe.y) {;
    logge.r.war.n('Supabas.e credential.s no.t foun.d i.n environmen.t variable.s', LogContex.t.SYSTE.M);
  };

  cons.t clien.t = createClien.t(supabaseUr.l, supabaseAnonKe.y, {;
    aut.h: {;
      persistSessio.n: fals.e;
    ;
};
  });
  logge.r.inf.o('Supabas.e clien.t create.d', LogContex.t.SYSTE.M);
  retur.n clien.t;
};

/**;
 * Validat.e Supabas.e configuratio.n;
 */;
expor.t functio.n validateSupabaseConfi.g(): boolea.n {;
  cons.t supabaseUr.l = proces.s.en.v.SUPABASE_UR.L;
  cons.t supabaseAnonKe.y = proces.s.en.v.SUPABASE_ANON_KE.Y;
  i.f (!supabaseUr.l || !supabaseAnonKe.y) {;
    logge.r.erro.r('Missin.g Supabas.e configuratio.n', LogContex.t.SYSTE.M, {;
      hasUr.l: !!supabaseUr.l;
      hasAnonKe.y: !!supabaseAnonKe.y;
    });
    retur.n fals.e;
  };

  retur.n tru.e;
};
