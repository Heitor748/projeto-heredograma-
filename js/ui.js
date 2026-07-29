const UI = {
  secaoAtual: 'dashboard',

  init() {
    this.bindMenu();
    this.bindTema();
    this.bindImportExport();
    this.bindPesquisa();
    this.atualizarDashboard();
    this.aplicarTema();
  },

  bindMenu() {
    document.querySelectorAll('[data-secao]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navegarPara(btn.dataset.secao);
        // Fechar menu mobile
        document.getElementById('sidebar').classList.remove('aberto');
      });
    });

    document.getElementById('btn-menu-mobile')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('aberto');
    });
  },

  navegarPara(secao) {
    this.secaoAtual = secao;

    document.querySelectorAll('.secao').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('[data-secao]').forEach(b => b.classList.remove('ativo'));

    const el = document.getElementById('secao-' + secao);
    if (el) el.classList.remove('hidden');

    document.querySelectorAll(`[data-secao="${secao}"]`).forEach(b => b.classList.add('ativo'));

    // Inicializar visualizações sob demanda
    if (secao === 'heredograma') setTimeout(() => Heredograma.renderizar(), 50);
    if (secao === 'arvore') setTimeout(() => Arvore.renderizar(), 50);
    if (secao === 'cadastro') Cadastro.atualizarSelects();
  },

  bindTema() {
    document.getElementById('btn-tema')?.addEventListener('click', () => {
      const atual = document.documentElement.getAttribute('data-tema');
      const novo = atual === 'escuro' ? 'claro' : 'escuro';
      document.documentElement.setAttribute('data-tema', novo);
      Storage.saveConfig({ ...Storage.getConfig(), tema: novo });
      this.atualizarIconeTema(novo);
      // Re-renderizar canvas com novo tema
      if (this.secaoAtual === 'heredograma') Heredograma.desenhar();
      if (this.secaoAtual === 'arvore') Arvore.desenhar();
    });
  },

  aplicarTema() {
    const cfg = Storage.getConfig();
    const tema = cfg.tema || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro');
    document.documentElement.setAttribute('data-tema', tema);
    this.atualizarIconeTema(tema);
  },

  atualizarIconeTema(tema) {
    const btn = document.getElementById('btn-tema');
    if (btn) btn.textContent = tema === 'escuro' ? '☀️' : '🌙';
  },

  bindImportExport() {
    document.getElementById('btn-exportar')?.addEventListener('click', () => Storage.exportJSON());

    document.getElementById('btn-importar')?.addEventListener('click', () => {
      document.getElementById('input-importar').click();
    });

    document.getElementById('input-importar')?.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const qtd = await Storage.importJSON(file);
        this.toast(`${qtd} pessoas importadas com sucesso!`, 'sucesso');
        Cadastro.atualizarSelects();
        Cadastro.renderizarLista();
        this.atualizarDashboard();
      } catch {
        this.toast('Erro ao importar arquivo. Verifique o formato.', 'erro');
      }
      e.target.value = '';
    });

    document.getElementById('btn-carregar-exemplo')?.addEventListener('click', async () => {
      try {
        const r = await fetch('data/exemplos.json');
        const data = await r.json();
        Storage.save(data.pessoas);
        this.toast('Dados de exemplo carregados!', 'sucesso');
        Cadastro.atualizarSelects();
        Cadastro.renderizarLista();
        this.atualizarDashboard();
      } catch {
        this.toast('Erro ao carregar exemplo.', 'erro');
      }
    });

    document.getElementById('btn-limpar-dados')?.addEventListener('click', () => {
      if (!confirm('Apagar TODOS os dados? Esta ação não pode ser desfeita.')) return;
      Storage.save([]);
      Cadastro.renderizarLista();
      this.atualizarDashboard();
      this.toast('Dados apagados.', 'info');
    });
  },

  bindPesquisa() {
    const input = document.getElementById('pesquisa-global');
    const resultado = document.getElementById('resultado-pesquisa');
    if (!input || !resultado) return;

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { resultado.innerHTML = ''; return; }
      const pessoas = Storage.getAll().filter(p =>
        p.nome?.toLowerCase().includes(q) || p.sobrenome?.toLowerCase().includes(q)
      );
      resultado.innerHTML = pessoas.length
        ? pessoas.map(p => `
            <div class="resultado-item" onclick="UI.verPerfil('${p.id}')">
              <span class="ri-nome">${p.nome} ${p.sobrenome || ''}</span>
              <small>${p.sexo === 'M' ? '♂' : p.sexo === 'F' ? '♀' : '◇'}
                ${p.afetado ? ' · Afetado' : ''}${p.portador ? ' · Portador' : ''}</small>
            </div>`).join('')
        : '<p class="lista-vazia">Nenhum resultado.</p>';
    });
  },

  atualizarDashboard() {
    const pessoas = Storage.getAll();
    const total = pessoas.length;
    const homens = pessoas.filter(p => p.sexo === 'M').length;
    const mulheres = pessoas.filter(p => p.sexo === 'F').length;
    const afetados = pessoas.filter(p => p.afetado).length;
    const portadores = pessoas.filter(p => p.portador).length;
    const falecidos = pessoas.filter(p => !p.vivo).length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('dash-total', total);
    set('dash-homens', homens);
    set('dash-mulheres', mulheres);
    set('dash-afetados', afetados);
    set('dash-portadores', portadores);
    set('dash-falecidos', falecidos);

    const recentes = [...pessoas].reverse().slice(0, 5);
    const listaEl = document.getElementById('dash-recentes');
    if (listaEl) {
      listaEl.innerHTML = recentes.length
        ? recentes.map(p => `
            <div class="dash-item" onclick="UI.verPerfil('${p.id}')">
              <span>${p.nome} ${p.sobrenome || ''}</span>
              <small>${p.sexo === 'M' ? '♂' : p.sexo === 'F' ? '♀' : '◇'}</small>
            </div>`).join('')
        : '<p class="lista-vazia">Nenhuma pessoa cadastrada.</p>';
    }
  },

  verPerfil(id) {
    const pessoa = Storage.getById(id);
    if (!pessoa) return;
    const todas = Storage.getAll();

    const resolver = ids => (ids || []).map(i => Storage.getById(i)).filter(Boolean).map(p => `
      <span class="link-perfil" onclick="UI.verPerfil('${p.id}')">${p.nome} ${p.sobrenome || ''}</span>`
    ).join(', ') || '—';

    const pai = pessoa.pai ? Storage.getById(pessoa.pai) : null;
    const mae = pessoa.mae ? Storage.getById(pessoa.mae) : null;

    // Irmãos
    const irmaos = todas.filter(p =>
      p.id !== id && (
        (pessoa.pai && p.pai === pessoa.pai) ||
        (pessoa.mae && p.mae === pessoa.mae)
      )
    );

    // Avós
    const avos = [];
    if (pai) {
      if (pai.pai) avos.push(Storage.getById(pai.pai));
      if (pai.mae) avos.push(Storage.getById(pai.mae));
    }
    if (mae) {
      if (mae.pai) avos.push(Storage.getById(mae.pai));
      if (mae.mae) avos.push(Storage.getById(mae.mae));
    }

    // Netos
    const netos = [];
    (pessoa.filhos || []).forEach(fid => {
      const filho = Storage.getById(fid);
      if (filho) (filho.filhos || []).forEach(nid => {
        const neto = Storage.getById(nid);
        if (neto) netos.push(neto);
      });
    });

    // Tios
    const tios = [];
    [pai, mae].forEach(progenitor => {
      if (!progenitor) return;
      const avoPai = progenitor.pai ? Storage.getById(progenitor.pai) : null;
      const avoMae = progenitor.mae ? Storage.getById(progenitor.mae) : null;
      [avoPai, avoMae].forEach(avo => {
        if (!avo) return;
        (avo.filhos || []).forEach(fid => {
          if (fid !== progenitor.id) {
            const tio = Storage.getById(fid);
            if (tio && !tios.find(t => t.id === tio.id)) tios.push(tio);
          }
        });
      });
    });

    const formatarLink = lista => lista.filter(Boolean).map(p =>
      `<span class="link-perfil" onclick="UI.verPerfil('${p.id}')">${p.nome} ${p.sobrenome || ''}</span>`
    ).join(', ') || '—';

    const modal = document.getElementById('modal-perfil');
    const conteudo = document.getElementById('modal-perfil-conteudo');
    conteudo.innerHTML = `
      <div class="perfil-header">
        <div class="perfil-avatar ${pessoa.sexo === 'M' ? 'masc' : pessoa.sexo === 'F' ? 'fem' : 'indef'}">
          ${pessoa.foto
            ? `<img src="${pessoa.foto}" alt="${pessoa.nome}">`
            : `<span>${(pessoa.nome || '?')[0].toUpperCase()}</span>`}
        </div>
        <div class="perfil-titulo">
          <h2>${pessoa.nome} ${pessoa.sobrenome || ''}</h2>
          <div class="perfil-tags">
            <span class="tag ${pessoa.sexo === 'M' ? 'tag-masc' : pessoa.sexo === 'F' ? 'tag-fem' : 'tag-indef'}">
              ${pessoa.sexo === 'M' ? '♂ Masculino' : pessoa.sexo === 'F' ? '♀ Feminino' : '◇ Indefinido'}
            </span>
            ${pessoa.afetado ? '<span class="tag tag-afetado">Afetado</span>' : ''}
            ${pessoa.portador ? '<span class="tag tag-portador">Portador</span>' : ''}
            ${!pessoa.vivo ? '<span class="tag tag-falecido">Falecido</span>' : '<span class="tag tag-vivo">Vivo</span>'}
          </div>
          ${pessoa.dataNascimento ? `<small>Nascimento: ${new Date(pessoa.dataNascimento).toLocaleDateString('pt-BR')}</small>` : ''}
        </div>
      </div>

      <div class="perfil-grid">
        <div class="perfil-bloco">
          <h4>Pais</h4>
          <p>Pai: ${pai ? `<span class="link-perfil" onclick="UI.verPerfil('${pai.id}')">${pai.nome} ${pai.sobrenome || ''}</span>` : '—'}</p>
          <p>Mãe: ${mae ? `<span class="link-perfil" onclick="UI.verPerfil('${mae.id}')">${mae.nome} ${mae.sobrenome || ''}</span>` : '—'}</p>
        </div>
        <div class="perfil-bloco">
          <h4>Cônjuge(s)</h4>
          <p>${resolver(pessoa.conjuges)}</p>
        </div>
        <div class="perfil-bloco">
          <h4>Filhos (${(pessoa.filhos || []).length})</h4>
          <p>${resolver(pessoa.filhos)}</p>
        </div>
        <div class="perfil-bloco">
          <h4>Irmãos (${irmaos.length})</h4>
          <p>${formatarLink(irmaos)}</p>
        </div>
        <div class="perfil-bloco">
          <h4>Avós (${avos.filter(Boolean).length})</h4>
          <p>${formatarLink(avos)}</p>
        </div>
        <div class="perfil-bloco">
          <h4>Netos (${netos.length})</h4>
          <p>${formatarLink(netos)}</p>
        </div>
        <div class="perfil-bloco">
          <h4>Tios (${tios.length})</h4>
          <p>${formatarLink(tios)}</p>
        </div>
        ${pessoa.observacoes ? `
        <div class="perfil-bloco perfil-bloco-full">
          <h4>Observações</h4>
          <p>${pessoa.observacoes}</p>
        </div>` : ''}
      </div>

      <div class="perfil-acoes">
        <button class="btn btn-primario" onclick="Cadastro.editar('${pessoa.id}'); UI.fecharModal()">✏️ Editar</button>
        <button class="btn btn-perigo" onclick="Cadastro.excluir('${pessoa.id}'); UI.fecharModal()">🗑️ Excluir</button>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('visivel');
  },

  fecharModal() {
    const modal = document.getElementById('modal-perfil');
    modal.classList.remove('visivel');
    modal.classList.add('hidden');
  },

  toast(msg, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.classList.add('visivel'), 10);
    setTimeout(() => {
      t.classList.remove('visivel');
      setTimeout(() => t.remove(), 400);
    }, 3500);
  }
};
