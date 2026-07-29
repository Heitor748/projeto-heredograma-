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
    // Remove a pessoa e limpa referências a ela
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
