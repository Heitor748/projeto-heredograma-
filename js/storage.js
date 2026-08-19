const Storage = {
  KEY: 'heredograma_pessoas',
  CONFIG_KEY: 'heredograma_config',
  HISTORICO_KEY: 'heredograma_historico',
  MAX_HISTORICO: 15,

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '[]');
    } catch { return []; }
  },

  // Reconstrói filhos[] e conjuges[] a partir do canônico pai/mae/conjuges.
  // Também limpa referências órfãs (pai/mae/conjuge apontando para pessoa deletada).
  // Mantém pai/mae/conjuges/observacoes/foto/etc. inalterados na entrada.
  sincronizarRelacoes(pessoas) {
    const idsValidos = new Set(pessoas.map(p => p.id));

    // Copia rasa: não mutamos os objetos originais recebidos.
    const map = new Map();
    pessoas.forEach(p => {
      map.set(p.id, {
        ...p,
        pai: p.pai && idsValidos.has(p.pai) ? p.pai : null,
        mae: p.mae && idsValidos.has(p.mae) ? p.mae : null,
        conjuges: [],
        filhos: [],
      });
    });

    // Reconstrói cônjuges: união simétrica das duas listas originais.
    pessoas.forEach(p => {
      const meus = new Set([...(p.conjuges || [])]);
      pessoas.forEach(q => {
        if (q.id !== p.id && (q.conjuges || []).includes(p.id)) meus.add(q.id);
      });
      const alvo = map.get(p.id);
      alvo.conjuges = [...meus].filter(c => idsValidos.has(c) && c !== p.id);
    });

    // Reconstrói filhos: a partir de pai/mae de todos.
    pessoas.forEach(f => {
      if (f.pai && map.has(f.pai)) {
        const pai = map.get(f.pai);
        if (!pai.filhos.includes(f.id)) pai.filhos.push(f.id);
      }
      if (f.mae && map.has(f.mae)) {
        const mae = map.get(f.mae);
        if (!mae.filhos.includes(f.id)) mae.filhos.push(f.id);
      }
    });

    return pessoas.map(p => map.get(p.id));
  },

  // Salva dados normalizados e registra snapshot no histórico de desfazer.
  save(pessoas, { silencioso = false } = {}) {
    const normalizadas = this.sincronizarRelacoes(pessoas);

    if (!silencioso) {
      const atual = this.getAll();
      if (atual.length > 0) {
        try {
          const hist = this.getHistorico();
          // Snapshot sem fotos — fotos ocupam muito espaço para guardar 15 cópias
          const snap = { ts: Date.now(), pessoas: atual.map(({ foto, ...r }) => r) };
          hist.push(snap);
          if (hist.length > this.MAX_HISTORICO) hist.shift();
          localStorage.setItem(this.HISTORICO_KEY, JSON.stringify(hist));
        } catch { /* histórico descartado silenciosamente se não couber */ }
      }
    }

    try {
      localStorage.setItem(this.KEY, JSON.stringify(normalizadas));
      return { ok: true };
    } catch (e) {
      const cotaCheia = e && (e.name === 'QuotaExceededError'
        || e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
        || e.code === 22);
      if (cotaCheia) {
        // Tenta salvar sem fotos como último recurso
        try {
          const semFoto = normalizadas.map(({ foto, ...r }) => r);
          localStorage.setItem(this.KEY, JSON.stringify(semFoto));
          setTimeout(() => {
            if (typeof UI !== 'undefined') {
              UI.toast('Armazenamento cheio: dados salvos, mas fotos foram removidas.', 'aviso');
            }
          }, 0);
          return { ok: true, sem_fotos: true };
        } catch {
          setTimeout(() => {
            if (typeof UI !== 'undefined') {
              UI.toast('Não foi possível salvar: armazenamento do navegador está cheio.', 'erro');
            }
          }, 0);
          return { ok: false, erro: 'quota' };
        }
      }
      // Storage indisponível (Safari privado, etc.)
      setTimeout(() => {
        if (typeof UI !== 'undefined') {
          UI.toast('Este navegador não permite salvar dados. Verifique o modo privado.', 'erro');
        }
      }, 0);
      return { ok: false, erro: 'storage' };
    }
  },

  getById(id) {
    return this.getAll().find(p => p.id === id) || null;
  },

  // ID robusto: timestamp + random para não colidir em cadastros rápidos consecutivos
  _novoId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  add(pessoa) {
    const lista = this.getAll();
    pessoa.id = pessoa.id || this._novoId();
    lista.push(pessoa);
    this.save(lista);
    return pessoa;
  },

  update(pessoaAtualizada) {
    const lista = this.getAll().map(p =>
      p.id === pessoaAtualizada.id ? { ...p, ...pessoaAtualizada } : p
    );
    this.save(lista);
  },

  delete(id) {
    let lista = this.getAll().filter(p => p.id !== id);
    lista = lista.map(p => ({
      ...p,
      pai: p.pai === id ? null : p.pai,
      mae: p.mae === id ? null : p.mae,
      conjuges: (p.conjuges || []).filter(c => c !== id),
      filhos: (p.filhos || []).filter(f => f !== id),
    }));
    this.save(lista);
  },

  // ===== HISTÓRICO / DESFAZER =====

  getHistorico() {
    try {
      return JSON.parse(localStorage.getItem(this.HISTORICO_KEY) || '[]');
    } catch { return []; }
  },

  desfazer() {
    const hist = this.getHistorico();
    if (!hist.length) return null;
    const snapshot = hist.pop();
    try {
      localStorage.setItem(this.HISTORICO_KEY, JSON.stringify(hist));
      localStorage.setItem(this.KEY, JSON.stringify(this.sincronizarRelacoes(snapshot.pessoas)));
    } catch { /* desfazer falha silenciosa se storage cheio */ }
    return snapshot;
  },

  qtdHistorico() {
    return this.getHistorico().length;
  },

  // ===== RELACIONAMENTOS EXPLÍCITOS =====

  vincularConjuge(idA, idB) {
    if (!idA || !idB || idA === idB) return;
    const lista = this.getAll();
    let mudou = false;
    lista.forEach(p => {
      if (p.id === idA && !(p.conjuges || []).includes(idB)) {
        p.conjuges = [...(p.conjuges || []), idB]; mudou = true;
      }
      if (p.id === idB && !(p.conjuges || []).includes(idA)) {
        p.conjuges = [...(p.conjuges || []), idA]; mudou = true;
      }
    });
    if (mudou) this.save(lista);
  },

  // Define pai OU mãe do filho conforme o sexo do responsável.
  // Sem sexo definido, exige que o chamador escolha via `slot` ('pai'|'mae');
  // sem slot e sem sexo, aborta em vez de escolher arbitrariamente.
  vincularFilho(idResponsavel, idFilho, sexoResponsavel, slot = null) {
    if (!idResponsavel || !idFilho || idResponsavel === idFilho) return { ok: false, erro: 'ids' };
    const lista = this.getAll();
    const filho = lista.find(p => p.id === idFilho);
    if (!filho) return { ok: false, erro: 'filho-inexistente' };

    // Impede ciclo: responsável não pode ser descendente do filho
    if (this._ehDescendente(idResponsavel, idFilho, lista)) {
      return { ok: false, erro: 'ciclo' };
    }

    let campo = slot;
    if (!campo) {
      if (sexoResponsavel === 'M') campo = 'pai';
      else if (sexoResponsavel === 'F') campo = 'mae';
      else return { ok: false, erro: 'sexo-obrigatorio' };
    }

    filho[campo] = idResponsavel;
    this.save(lista);
    return { ok: true };
  },

  // True se `possivelDescendente` está na descendência de `raiz`.
  // Considera tanto filhos[] quanto pai/mae para funcionar mesmo antes da sincronização.
  _ehDescendente(possivelDescendente, raiz, lista) {
    const filhosDe = new Map(); // id → Set(idsDosFilhos)
    lista.forEach(p => filhosDe.set(p.id, new Set(p.filhos || [])));
    lista.forEach(x => {
      if (x.pai && filhosDe.has(x.pai)) filhosDe.get(x.pai).add(x.id);
      if (x.mae && filhosDe.has(x.mae)) filhosDe.get(x.mae).add(x.id);
    });
    const visitados = new Set();
    const stack = [raiz];
    while (stack.length) {
      const cur = stack.pop();
      if (visitados.has(cur)) continue;
      visitados.add(cur);
      const filhos = filhosDe.get(cur);
      if (!filhos) continue;
      for (const fid of filhos) {
        if (fid === possivelDescendente) return true;
        stack.push(fid);
      }
    }
    return false;
  },

  // ===== IMPORT / EXPORT =====

  exportJSON() {
    const data = { pessoas: this.getAll(), exportadoEm: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'heredograma_' + new Date().toLocaleDateString('pt-BR').replace(/\//g, '-') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result);
          const pessoas = data.pessoas || data;
          if (!Array.isArray(pessoas)) throw new Error('Formato inválido');
          this.save(pessoas);
          resolve(pessoas.length);
        } catch (err) { reject(err); }
      };
      reader.readAsText(file);
    });
  },

  getConfig() {
    try {
      return JSON.parse(localStorage.getItem(this.CONFIG_KEY) || '{}');
    } catch { return {}; }
  },

  saveConfig(config) {
    try { localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config)); }
    catch { /* config perdida se storage indisponível */ }
  },
};
