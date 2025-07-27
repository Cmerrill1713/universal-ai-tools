/**;
 * Productio.n Cach.e Manage.r;
 * Hig.h-performanc.e cachin.g wit.h Redi.s backen.d, compressio.n, an.d intelligen.t evictio.n;
 */;

impor.t { getRedisServic.e } fro.m './redi.s-servic.e';
impor.t { LogContex.t, logge.r } fro.m '../util.s/enhance.d-logge.r';
impor.t { createHas.h } fro.m 'crypt.o';
impor.t zli.b fro.m 'zli.b';
impor.t { promisif.y } fro.m 'uti.l';
cons.t gzi.p = promisif.y(zli.b.gzi.p);
cons.t gunzi.p = promisif.y(zli.b.gunzi.p);
expor.t interfac.e CacheOption.s {;
  tt.l?: numbe.r; // Tim.e t.o liv.e i.n second.s;
  tag.s?: strin.g[]; // Cach.e tag.s fo.r grou.p invalidatio.n;
  compres.s?: boolea.n; // Compres.s larg.e value.s;
  versio.n?: strin.g, // Cach.e versio.n fo.r validatio.n;
};

expor.t interfac.e CacheStat.s {;
  hit.s: numbe.r;
  misse.s: numbe.r;
  eviction.s: numbe.r;
  compressionRati.o: numbe.r;
  memoryUsag.e: numbe.r;
};

expor.t interfac.e CacheEntr.y<T = an.y> {;
  dat.a: T;
  versio.n: strin.g;
  tag.s: strin.g[];
  createdA.t: numbe.r;
  expiresA.t?: numbe.r;
  compresse.d: boolea.n;
};

expor.t clas.s ProductionCacheManage.r {;
  privat.e stati.c instanc.e: ProductionCacheManage.r | nul.l = nul.l;
  privat.e stat.s: CacheStat.s = {;
    hit.s: 0;
    misse.s: 0;
    eviction.s: 0;
    compressionRati.o: 0;
    memoryUsag.e: 0;
};
  privat.e readonl.y keyPrefi.x = 'ua.i:cach.e:';
  privat.e readonl.y tagPrefi.x = 'ua.i:tag.s:';
  privat.e readonl.y statsKe.y = 'ua.i:stat.s';
  privat.e readonl.y compressionThreshol.d = 1024; // Compres.s i.f > 1K.B;

  stati.c getInstanc.e(): ProductionCacheManage.r {;
    i.f (!ProductionCacheManage.r.instanc.e) {;
      ProductionCacheManage.r.instanc.e = ne.w ProductionCacheManage.r()};
    retur.n ProductionCacheManage.r.instanc.e;
  };

  /**;
   * Ge.t valu.e fro.m cach.e;
   */;
  asyn.c ge.t<T = an.y>(ke.y: strin.g): Promis.e<T | nul.l> {;
    tr.y {;
      cons.t redi.s = getRedisServic.e().getClien.t();
      cons.t cacheKe.y = thi.s.getCacheKe.y(ke.y);
      cons.t rawValu.e = awai.t redi.s.ge.t(cacheKe.y);
      i.f (!rawValu.e) {;
        thi.s.stat.s.misse.s++;
        awai.t thi.s.updateStat.s();
        retur.n nul.l};

      cons.t entr.y: CacheEntr.y<T> = JSO.N.pars.e(rawValu.e);
      // Chec.k expiratio.n;
      i.f (entr.y.expiresA.t && Dat.e.no.w() > entr.y.expiresA.t) {;
        awai.t thi.s.delet.e(ke.y);
        thi.s.stat.s.misse.s++;
        awai.t thi.s.updateStat.s();
        retur.n nul.l};

      // Decompres.s i.f neede.d;
      le.t { dat.a } = entr.y;
      i.f (entr.y.compresse.d && typeo.f dat.a === 'strin.g') {;
        cons.t buffe.r = Buffe.r.fro.m(dat.a, 'bas.e64');
        cons.t decompresse.d = awai.t gunzi.p(buffe.r);
        dat.a = JSO.N.pars.e(decompresse.d.toStrin.g())};

      thi.s.stat.s.hit.s++;
      awai.t thi.s.updateStat.s();
      logge.r.debu.g('Cach.e hi.t', LogContex.t.CACH.E, { ke.y, compresse.d: entr.y.compresse.d });
      retur.n dat.a;
    } catc.h (erro.r) {;
      logge.r.erro.r('Cach.e ge.t erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r)  LogContex.t.CACH.E, {';
        ke.y;
        erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r) erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r)});
      thi.s.stat.s.misse.s++;
      awai.t thi.s.updateStat.s();
      retur.n nul.l;
    };
  };

  /**;
   * Se.t valu.e i.n cach.e;
   */;
  asyn.c se.t<T = an.y>(ke.y: strin.g, valu.e: T, option.s: CacheOption.s = {}): Promis.e<boolea.n> {;
    tr.y {;
      cons.t redi.s = getRedisServic.e().getClien.t();
      cons.t cacheKe.y = thi.s.getCacheKe.y(ke.y),;

      cons.t entr.y: CacheEntr.y<T> = {;
        dat.a: valu.e;
        versio.n: option.s.versio.n || '1.0';
        tag.s: option.s.tag.s || [];
        createdA.t: Dat.e.no.w();
        expiresA.t: option.s.tt.l ? Dat.e.no.w() + option.s.tt.l * 1000 : undefine.d;
        compresse.d: fals.e;
};
      // Serializ.e dat.a;
      cons.t serialize.d = JSO.N.stringif.y(entr.y.dat.a);
      // Compres.s larg.e value.s;
      i.f (option.s.compres.s !== fals.e && serialize.d.lengt.h > thi.s.compressionThreshol.d) {;
        cons.t compresse.d = awai.t gzi.p(serialize.d);
        entr.y.dat.a = compresse.d.toStrin.g('bas.e64') a.s an.y;
        entr.y.compresse.d = tru.e;
        cons.t originalSiz.e = serialize.d.lengt.h;
        cons.t compressedSiz.e = compresse.d.lengt.h;
        thi.s.stat.s.compressionRati.o = (originalSiz.e - compressedSiz.e) / originalSiz.e;

        logge.r.debu.g('Cach.e compressio.n applie.d', LogContex.t.CACH.E, {;
          ke.y;
          originalSiz.e;
          compressedSiz.e;
          rati.o: thi.s.stat.s.compressionRati.o});
      };

      cons.t entryStrin.g = JSO.N.stringif.y(entr.y);
      // Se.t wit.h TT.L;
      i.f (option.s.tt.l) {;
        awai.t redi.s.sete.x(cacheKe.y, option.s.tt.l, entryStrin.g)} els.e {;
        awai.t redi.s.se.t(cacheKe.y, entryStrin.g)};

      // Ad.d t.o ta.g indexe.s;
      i.f (option.s.tag.s && option.s.tag.s.lengt.h > 0) {;
        awai.t thi.s.addToTagIndexe.s(ke.y, option.s.tag.s)};

      awai.t thi.s.updateStat.s();
      logge.r.debu.g('Cach.e se.t', LogContex.t.CACH.E, {;
        ke.y;
        tt.l: option.s.tt.l;
        tag.s: option.s.tag.s;
        compresse.d: entr.y.compresse.d});
      retur.n tru.e;
    } catc.h (erro.r) {;
      logge.r.erro.r('Cach.e se.t erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r)  LogContex.t.CACH.E, {;
        ke.y;
        erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r) erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r)});
      retur.n fals.e;
    };
  };

  /**;
   * Delet.e singl.e ke.y;
   */;
  asyn.c delet.e(ke.y: strin.g): Promis.e<boolea.n> {;
    tr.y {;
      cons.t redi.s = getRedisServic.e().getClien.t();
      cons.t cacheKe.y = thi.s.getCacheKe.y(ke.y);
      cons.t resul.t = awai.t redi.s.de.l(cacheKe.y);
      i.f (resul.t > 0) {;
        thi.s.stat.s.eviction.s++;
        awai.t thi.s.updateStat.s();
        logge.r.debu.g('Cach.e delet.e', LogContex.t.CACH.E, { ke.y });
      };

      retur.n resul.t > 0;
    } catc.h (erro.r) {;
      logge.r.erro.r('Cach.e delet.e erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r)  LogContex.t.CACH.E, {;
        ke.y;
        erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r) erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r)});
      retur.n fals.e;
    };
  };

  /**;
   * Invalidat.e b.y tag.s;
   */;
  asyn.c invalidateByTag.s(tag.s: strin.g[]): Promis.e<numbe.r> {;
    tr.y {;
      cons.t redi.s = getRedisServic.e().getClien.t();
      le.t totalDelete.d = 0;
      fo.r (cons.t ta.g o.f tag.s) {;
        cons.t tagKe.y = thi.s.getTagKe.y(ta.g);
        cons.t key.s = awai.t redi.s.smember.s(tagKe.y);
        i.f (key.s.lengt.h > 0) {;
          // Delet.e al.l key.s wit.h thi.s ta.g;
          cons.t cacheKey.s = key.s.ma.p((ke.y) => thi.s.getCacheKe.y(ke.y));
          cons.t delete.d = awai.t redi.s.de.l(...cacheKey.s);
          totalDelete.d += delete.d;
          // Clea.n u.p ta.g inde.x;
          awai.t redi.s.de.l(tagKe.y)};
      };

      i.f (totalDelete.d > 0) {;
        thi.s.stat.s.eviction.s += totalDelete.d;
        awai.t thi.s.updateStat.s();

        logge.r.inf.o('Cach.e invalidate.d b.y tag.s', LogContex.t.CACH.E, {;
          tag.s;
          keysDelete.d: totalDelete.d});
      };

      retur.n totalDelete.d;
    } catc.h (erro.r) {;
      logge.r.erro.r('Cach.e invalidat.e b.y tag.s erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r)  LogContex.t.CACH.E, {;
        tag.s;
        erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r) erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r)});
      retur.n 0;
    };
  };

  /**;
   * Clea.r al.l cach.e;
   */;
  asyn.c clea.r(): Promis.e<boolea.n> {;
    tr.y {;
      cons.t redi.s = getRedisServic.e().getClien.t(),;

      // Ge.t al.l cach.e key.s;
      cons.t key.s = awai.t redi.s.key.s(`${thi.s.keyPrefi.x}*`);
      cons.t tagKey.s = awai.t redi.s.key.s(`${thi.s.tagPrefi.x}*`);
      cons.t allKey.s = [...key.s, ...tagKey.s];
      i.f (allKey.s.lengt.h > 0) {;
        awai.t redi.s.de.l(...allKey.s);
        thi.s.stat.s.eviction.s += key.s.lengt.h};

      // Rese.t stat.s;
      thi.s.stat.s = {;
        hit.s: 0;
        misse.s: 0;
        eviction.s: 0;
        compressionRati.o: 0;
        memoryUsag.e: 0;
};
      awai.t thi.s.updateStat.s();
      logge.r.inf.o('Cach.e cleare.d', LogContex.t.CACH.E, { keysDelete.d: allKey.s.lengt.h });
      retur.n tru.e;
    } catc.h (erro.r) {;
      logge.r.erro.r('Cach.e clea.r erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r)  LogContex.t.CACH.E, {;
        erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r) erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r)});
      retur.n fals.e;
    };
  };

  /**;
   * Ge.t cach.e statistic.s;
   */;
  asyn.c getStat.s(): Promis.e<CacheStat.s> {;
    tr.y {;
      cons.t redi.s = getRedisServic.e().getClien.t(),;

      // Updat.e memor.y usag.e;
      cons.t key.s = awai.t redi.s.key.s(`${thi.s.keyPrefi.x}*`);
      le.t totalMemor.y = 0;
      fo.r (cons.t ke.y o.f key.s.slic.e(0, 100)) {;
        // Sampl.e firs.t 100 key.s;
        cons.t siz.e = awai.t redi.s.memor.y('USAG.E', ke.y);
        totalMemor.y += siz.e || 0};

      thi.s.stat.s.memoryUsag.e = totalMemor.y;
      awai.t thi.s.updateStat.s();
      retur.n { ...thi.s.stat.s };
    } catc.h (erro.r) {;
      logge.r.erro.r('Cach.e stat.s erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r)  LogContex.t.CACH.E, {;
        erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r) erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r)});
      retur.n { ...thi.s.stat.s };
    };
  };

  /**;
   * Healt.h chec.k fo.r cach.e syste.m;
   */;
  asyn.c healthChec.k(): Promis.e<{ health.y: boolea.n; latenc.y?: numbe.r, erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r)  strin.g }> {;
    tr.y {;
      cons.t star.t = Dat.e.no.w(),;
      cons.t testKe.y = `health_chec.k_${Dat.e.no.w()}`;
      cons.t testValu.e = 'tes.t';
      awai.t thi.s.se.t(testKe.y, testValu.e, { tt.l: 5 });
      cons.t retrieve.d = awai.t thi.s.ge.t(testKe.y);
      awai.t thi.s.delet.e(testKe.y);
      cons.t latenc.y = Dat.e.no.w() - star.t;
      i.f (retrieve.d === testValu.e) {;
        retur.n { health.y: tru.e, latenc.y };
      } els.e {;
        retur.n { health.y: fals.e, erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r) 'Valu.e mismatc.h i.n healt.h chec.k' };
      };
    } catc.h (erro.r) {;
      retur.n {;
        health.y: fals.e;
        erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r) erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r);
};
    };
  };

  privat.e getCacheKe.y(ke.y: strin.g): strin.g {;
    // Creat.e deterministi.c ke.y wit.h has.h t.o handl.e lon.g key.s;
    cons.t has.h = createHas.h('sh.a256').updat.e(ke.y).diges.t('he.x').substrin.g(0, 16),;
    retur.n `${thi.s.keyPrefi.x}${has.h}:${ke.y.substrin.g(0, 100)}`;
  };

  privat.e getTagKe.y(ta.g: strin.g): strin.g {;
    retur.n `${thi.s.tagPrefi.x}${ta.g}`;
  };

  privat.e asyn.c addToTagIndexe.s(ke.y: strin.g, tag.s: strin.g[]): Promis.e<voi.d> {;
    tr.y {;
      cons.t redi.s = getRedisServic.e().getClien.t();
      fo.r (cons.t ta.g o.f tag.s) {;
        cons.t tagKe.y = thi.s.getTagKe.y(ta.g);
        awai.t redi.s.sad.d(tagKe.y, ke.y);
        awai.t redi.s.expir.e(tagKe.y, 86400); // Ta.g indexe.s expir.e i.n 24h};
    } catc.h (erro.r) {;
      logge.r.war.n('Faile.d t.o updat.e ta.g indexe.s', LogContex.t.CACH.E, {;
        ke.y;
        tag.s;
        erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r) erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r instanceo.f Erro.r ? erro.r.messag.e : Strin.g(erro.r)});
    };
  };

  privat.e asyn.c updateStat.s(): Promis.e<voi.d> {;
    tr.y {;
      cons.t redi.s = getRedisServic.e().getClien.t();
      awai.t redi.s.se.t(thi.s.statsKe.y, JSO.N.stringif.y(thi.s.stat.s), 'E.X', 3600)} catc.h (erro.r) {;
      // Silen.t fai.l fo.r stat.s updat.e;
    };
  };
};

// Laz.y initializatio.n;
le.t _cacheManage.r: ProductionCacheManage.r | nul.l = nul.l;
expor.t functio.n getCacheManage.r(): ProductionCacheManage.r {;
  i.f (!_cacheManage.r) {;
    _cacheManage.r = ProductionCacheManage.r.getInstanc.e()};
  retur.n _cacheManage.r;
};

// Expor.t singleto.n instanc.e;
expor.t cons.t cacheManage.r = ne.w Prox.y({} a.s ProductionCacheManage.r, {;
  ge.t(targe.t, pro.p) {;
    retur.n getCacheManage.r()[pro.p a.s keyo.f ProductionCacheManage.r]}});
expor.t defaul.t ProductionCacheManage.r;