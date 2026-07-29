const Storage = {
  KEY: 'heredograma_pessoas',
  CONFIG_KEY: 'heredograma_config',

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '[]');
    } catch { return []; }
  },

  save(pessoas) {
    localStorage.setItem(this.KEY, JSON.stringify(pessoas));
  },

  getById(id) {
    return this.getAll().find(p => p.id === id) || null;
  },

  add(pessoa) {
    const lista = this.getAll();
    pessoa.id = pessoa.id || 'p' + Date.now();
    lista.push(pessoa);
    this.save(lista);
    return pessoa;
  },

  update(pessoaAtualizada) {
    const lista = this.getAll().map(p =>
      p.id === pessoaAtualizada.id ? pessoaAtualizada : p
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

  // Vincula cônjuge bidirecionalmente
  vincularConjuge(idA, idB) {
    const lista = this.getAll();
    lista.forEach(p => {
      if (p.id === idA && !(p.conjuges || []).includes(idB)) {
        p.conjuges = [...(p.conjuges || []), idB];
      }
      if (p.id === idB && !(p.conjuges || []).includes(idA)) {
        p.conjuges = [...(p.conjuges || []), idA];
      }
    });
    this.save(lista);
  },

  // Vincula filho bidirecionalmente (filho recebe pai/mãe, pai/mãe recebe filho)
  vincularFilho(idPaiOuMae, idFilho, sexoPaiMae) {
    const lista = this.getAll();
    lista.forEach(p => {
      if (p.id === idPaiOuMae && !(p.filhos || []).includes(idFilho)) {
        p.filhos = [...(p.filhos || []), idFilho];
      }
      if (p.id === idFilho) {
        if (sexoPaiMae === 'M' && !p.pai) p.pai = idPaiOuMae;
        else if (sexoPaiMae === 'F' && !p.mae) p.mae = idPaiOuMae;
        else if (!sexoPaiMae) {
          if (!p.pai) p.pai = idPaiOuMae;
          else if (!p.mae) p.mae = idPaiOuMae;
        }
        if (!(p.filhos || []).includes(idFilho)) {
          // garante que o filho não lista a si mesmo
        }
      }
    });
    this.save(lista);
  },

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
    localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
  }
};
