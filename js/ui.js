const UI = {
  secaoAtual: 'dashboard',

  init() {
    this.bindMenu();
    this.bindTema();
    this.bindImportExport();
    this.bindPesquisa();
    this.bindModal();
    this.atualizarDashboard();
    this.aplicarTema();
  },

  bindMenu() {
    document.querySelectorAll('[data-secao]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navegarPara(btn.dataset.secao);
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
    if (secao === 'heredograma') setTimeout(() => { Heredograma.resize(); Heredograma.renderizar(); }, 50);
    if (secao === 'arvore') setTimeout(() => { Arvore.resize(); Arvore.renderizar(); }, 50);
    if (secao === 'cadastro') { Cadastro.atualizarSelects(); Cadastro.renderizarLista(); }
  },

  bindTema() {
    document.getElementById('btn-tema')?.addEventListener('click', () => {
      const atual = document.documentElement.getAttribute('data-tema');
      const novo = atual === 'escuro' ? 'claro' : 'escuro';
      document.documentElement.setAttribute('data-tema', novo);
      Storage.saveConfig({ ...Storage.getConfig(), tema: novo });
      this.atualizarIconeTema(novo);
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
    document.getElementById('btn-importar')?.addEventListener('click', () => document.getElementById('input-importar').click());
    document.getElementById('input-importar')?.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const qtd = await Storage.importJSON(file);
        this.toast(`${qtd} pessoas importadas!`, 'sucesso');
        Cadastro.atualizarSelects();
        Cadastro.renderizarLista();
        this.atualizarDashboard();
      } catch { this.toast('Erro ao importar. Verifique o formato.', 'erro'); }
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
      } catch { this.toast('Erro ao carregar exemplo.', 'erro'); }
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
              <div class="ri-avatar ${p.sexo === 'M' ? 'masc' : p.sexo === 'F' ? 'fem' : 'indef'}">
                ${p.foto ? `<img src="${p.foto}">` : (p.nome || '?')[0].toUpperCase()}
              </div>
              <div>
                <span class="ri-nome">${p.nome} ${p.sobrenome || ''}</span>
                <small>${p.sexo === 'M' ? '♂' : p.sexo === 'F' ? '♀' : '◇'}
                  ${p.dataNascimento ? ' · ' + new Date(p.dataNascimento).getFullYear() : ''}
                  ${!p.vivo ? ' · Falecido' : ' · Vivo'}
                  ${p.afetado ? ' · <strong style="color:var(--perigo)">Afetado</strong>' : ''}
                </small>
              </div>
            </div>`).join('')
        : '<p class="lista-vazia">Nenhum resultado.</p>';
    });
  },

  bindModal() {
    const modal = document.getElementById('modal-perfil');
    modal?.addEventListener('click', e => { if (e.target === modal) this.fecharModal(); });
    document.getElementById('modal-fechar')?.addEventListener('click', () => this.fecharModal());
  },

  atualizarDashboard() {
    const pessoas = Storage.getAll();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('dash-total', pessoas.length);
    set('dash-homens', pessoas.filter(p => p.sexo === 'M').length);
    set('dash-mulheres', pessoas.filter(p => p.sexo === 'F').length);
    set('dash-afetados', pessoas.filter(p => p.afetado).length);
    set('dash-portadores', pessoas.filter(p => p.portador).length);
    set('dash-falecidos', pessoas.filter(p => !p.vivo).length);

    const listaEl = document.getElementById('dash-recentes');
    if (listaEl) {
      const recentes = [...pessoas].reverse().slice(0, 5);
      listaEl.innerHTML = recentes.length
        ? recentes.map(p => `
            <div class="dash-item" onclick="UI.verPerfil('${p.id}')">
              <div class="dash-item-avatar ${p.sexo === 'M' ? 'masc' : p.sexo === 'F' ? 'fem' : 'indef'}">
                ${p.foto ? `<img src="${p.foto}">` : (p.nome || '?')[0].toUpperCase()}
              </div>
              <div>
                <strong>${p.nome} ${p.sobrenome || ''}</strong>
                <small>${!p.vivo ? 'Falecido' : 'Vivo'}${p.afetado ? ' · Afetado' : ''}${p.portador ? ' · Portador' : ''}</small>
              </div>
            </div>`).join('')
        : '<p class="lista-vazia">Nenhuma pessoa cadastrada.</p>';
    }
  },

  // ===== PERFIL COM ABAS =====
  verPerfil(id) {
    const pessoa = Storage.getById(id);
    if (!pessoa) return;

    const modal = document.getElementById('modal-perfil');
    const conteudo = document.getElementById('modal-perfil-conteudo');

    const todas = Storage.getAll();
    const pai = pessoa.pai ? Storage.getById(pessoa.pai) : null;
    const mae = pessoa.mae ? Storage.getById(pessoa.mae) : null;
    const conjuges = (pessoa.conjuges || []).map(c => Storage.getById(c)).filter(Boolean);
    const filhos = (pessoa.filhos || []).map(f => Storage.getById(f)).filter(Boolean);
    const irmaos = todas.filter(p =>
      p.id !== id && ((pessoa.pai && p.pai === pessoa.pai) || (pessoa.mae && p.mae === pessoa.mae))
    );

    const corAvatar = pessoa.sexo === 'M' ? 'masc' : pessoa.sexo === 'F' ? 'fem' : 'indef';
    const anoNasc = pessoa.dataNascimento ? new Date(pessoa.dataNascimento).getFullYear() : null;

    conteudo.innerHTML = `
      <!-- Header -->
      <div class="p2-header">
        <div class="p2-avatar ${corAvatar}">
          ${pessoa.foto ? `<img src="${pessoa.foto}" alt="">` : `<span>${(pessoa.nome || '?')[0].toUpperCase()}</span>`}
        </div>
        <div class="p2-header-info">
          <h2>${pessoa.nome} ${pessoa.sobrenome || ''}</h2>
          <p class="p2-datas">${anoNasc || '?'} – ${pessoa.vivo !== false ? 'Vivo(a)' : 'Falecido(a)'}</p>
          <div class="p2-tags">
            <span class="tag ${corAvatar === 'masc' ? 'tag-masc' : corAvatar === 'fem' ? 'tag-fem' : 'tag-indef'}">
              ${pessoa.sexo === 'M' ? '♂ Masculino' : pessoa.sexo === 'F' ? '♀ Feminino' : '◇ Indefinido'}
            </span>
            ${pessoa.afetado ? '<span class="tag tag-afetado">Afetado</span>' : ''}
            ${pessoa.portador ? '<span class="tag tag-portador">Portador</span>' : ''}
          </div>
        </div>
        <div class="p2-header-acoes">
          <button class="btn btn-outline btn-sm" onclick="Cadastro.editar('${id}'); UI.fecharModal()">✏️ Editar</button>
          <button class="btn btn-perigo btn-sm" onclick="Cadastro.excluir('${id}'); UI.fecharModal()">🗑️</button>
        </div>
      </div>

      <!-- Abas -->
      <div class="p2-tabs">
        <button class="p2-tab ativo" data-tab="detalhes">Detalhes</button>
        <button class="p2-tab" data-tab="conjuges">Cônjuges ${conjuges.length ? `(${conjuges.length})` : ''}</button>
        <button class="p2-tab" data-tab="pais">Pais</button>
      </div>

      <!-- Aba: Detalhes -->
      <div id="p2-tab-detalhes" class="p2-tab-content">
        <div class="p2-detalhe-grid">
          ${pessoa.dataNascimento ? `
          <div class="p2-detalhe-item">
            <span class="p2-label">Nascimento</span>
            <span>${new Date(pessoa.dataNascimento).toLocaleDateString('pt-BR')}</span>
          </div>` : ''}
          <div class="p2-detalhe-item">
            <span class="p2-label">Status</span>
            <span>${pessoa.vivo !== false ? '🟢 Vivo(a)' : '⚫ Falecido(a)'}</span>
          </div>
          ${pessoa.afetado ? `
          <div class="p2-detalhe-item">
            <span class="p2-label">Condição</span>
            <span style="color:var(--perigo)">🔴 Afetado(a)</span>
          </div>` : ''}
          ${pessoa.portador ? `
          <div class="p2-detalhe-item">
            <span class="p2-label">Condição</span>
            <span style="color:var(--aviso)">🟠 Portador(a)</span>
          </div>` : ''}
          ${pessoa.observacoes ? `
          <div class="p2-detalhe-item p2-detalhe-full">
            <span class="p2-label">Observações</span>
            <span>${pessoa.observacoes}</span>
          </div>` : ''}
        </div>
      </div>

      <!-- Aba: Cônjuges -->
      <div id="p2-tab-conjuges" class="p2-tab-content hidden">
        ${conjuges.map(c => {
          const filhosDoConjuge = filhos.filter(f =>
            (f.pai === id && f.mae === c.id) || (f.mae === id && f.pai === c.id)
          );
          const corC = c.sexo === 'M' ? 'masc' : c.sexo === 'F' ? 'fem' : 'indef';
          return `
          <div class="p2-rel-card">
            <div class="p2-rel-pessoa" onclick="UI.verPerfil('${c.id}')">
              <div class="p2-rel-avatar ${corC}">
                ${c.foto ? `<img src="${c.foto}">` : (c.nome || '?')[0].toUpperCase()}
              </div>
              <div class="p2-rel-info">
                <strong>${c.nome} ${c.sobrenome || ''}</strong>
                <small>${c.dataNascimento ? new Date(c.dataNascimento).getFullYear() : '?'} – ${c.vivo !== false ? 'Vivo(a)' : 'Falecido(a)'}</small>
              </div>
            </div>
            ${filhosDoConjuge.length ? `
            <div class="p2-filhos-lista">
              <span class="p2-sub-label">Filhos</span>
              ${filhosDoConjuge.map(f => `
                <div class="p2-mini-card" onclick="UI.verPerfil('${f.id}')">
                  <div class="p2-mini-avatar ${f.sexo === 'M' ? 'masc' : f.sexo === 'F' ? 'fem' : 'indef'}">
                    ${f.foto ? `<img src="${f.foto}">` : (f.nome || '?')[0].toUpperCase()}
                  </div>
                  <span>${f.nome} ${f.sobrenome || ''}</span>
                </div>`).join('')}
            </div>` : ''}
          </div>`;
        }).join('')}

        ${filhos.filter(f => {
          const temConjuge = conjuges.some(c =>
            (f.pai === id && f.mae === c.id) || (f.mae === id && f.pai === c.id)
          );
          return !temConjuge;
        }).length ? `
        <div class="p2-rel-card">
          <span class="p2-sub-label">Outros filhos</span>
          ${filhos.filter(f => {
            const temConjuge = conjuges.some(c =>
              (f.pai === id && f.mae === c.id) || (f.mae === id && f.pai === c.id)
            );
            return !temConjuge;
          }).map(f => `
            <div class="p2-mini-card" onclick="UI.verPerfil('${f.id}')">
              <div class="p2-mini-avatar ${f.sexo === 'M' ? 'masc' : f.sexo === 'F' ? 'fem' : 'indef'}">
                ${f.foto ? `<img src="${f.foto}">` : (f.nome || '?')[0].toUpperCase()}
              </div>
              <span>${f.nome} ${f.sobrenome || ''}</span>
            </div>`).join('')}
        </div>` : ''}

        <button class="p2-btn-add" onclick="UI.mostrarSeletorRelacao('conjuge','${id}')">
          + Acrescentar cônjuge
        </button>
        <button class="p2-btn-add" onclick="UI.mostrarSeletorRelacao('filho','${id}')">
          + Acrescentar filho(a)
        </button>
      </div>

      <!-- Aba: Pais -->
      <div id="p2-tab-pais" class="p2-tab-content hidden">
        <div class="p2-pais-bloco">
          ${pai || mae ? `
          <div class="p2-pais-bracket">
            ${pai ? `
            <div class="p2-rel-pessoa" onclick="UI.verPerfil('${pai.id}')">
              <div class="p2-rel-avatar masc">
                ${pai.foto ? `<img src="${pai.foto}">` : (pai.nome || '?')[0].toUpperCase()}
              </div>
              <div class="p2-rel-info">
                <strong>${pai.nome} ${pai.sobrenome || ''}</strong>
                <small>${pai.dataNascimento ? new Date(pai.dataNascimento).getFullYear() : '?'} – ${pai.vivo !== false ? 'Vivo(a)' : 'Falecido(a)'}</small>
              </div>
            </div>` : '<div class="p2-pai-vazio">Pai desconhecido</div>'}
            ${mae ? `
            <div class="p2-rel-pessoa" onclick="UI.verPerfil('${mae.id}')">
              <div class="p2-rel-avatar fem">
                ${mae.foto ? `<img src="${mae.foto}">` : (mae.nome || '?')[0].toUpperCase()}
              </div>
              <div class="p2-rel-info">
                <strong>${mae.nome} ${mae.sobrenome || ''}</strong>
                <small>${mae.dataNascimento ? new Date(mae.dataNascimento).getFullYear() : '?'} – ${mae.vivo !== false ? 'Vivo(a)' : 'Falecido(a)'}</small>
              </div>
            </div>` : '<div class="p2-pai-vazio">Mãe desconhecida</div>'}
          </div>` : '<p class="lista-vazia">Pais não cadastrados</p>'}
        </div>

        ${irmaos.length ? `
        <div class="p2-irmaos">
          <span class="p2-sub-label">Irmãos (${irmaos.length})</span>
          ${irmaos.map(ir => `
            <div class="p2-mini-card" onclick="UI.verPerfil('${ir.id}')">
              <div class="p2-mini-avatar ${ir.sexo === 'M' ? 'masc' : ir.sexo === 'F' ? 'fem' : 'indef'}">
                ${ir.foto ? `<img src="${ir.foto}">` : (ir.nome || '?')[0].toUpperCase()}
              </div>
              <span>${ir.nome} ${ir.sobrenome || ''}</span>
            </div>`).join('')}
        </div>` : ''}

        <button class="p2-btn-add" onclick="UI.mostrarSeletorRelacao('irmao','${id}')">
          + Acrescentar irmão(ã)
        </button>
        <button class="p2-btn-add" onclick="Cadastro.editar('${id}'); UI.fecharModal()">
          + Acrescentar pai ou mãe
        </button>
      </div>
    `;

    // Bind tabs
    conteudo.querySelectorAll('.p2-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        conteudo.querySelectorAll('.p2-tab').forEach(b => b.classList.remove('ativo'));
        conteudo.querySelectorAll('.p2-tab-content').forEach(t => t.classList.add('hidden'));
        btn.classList.add('ativo');
        conteudo.querySelector('#p2-tab-' + btn.dataset.tab)?.classList.remove('hidden');
      });
    });

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('visivel'), 10);
  },

  fecharModal() {
    const modal = document.getElementById('modal-perfil');
    modal.classList.remove('visivel');
    setTimeout(() => modal.classList.add('hidden'), 200);
  },

  // ===== SELETOR DE RELAÇÃO =====
  mostrarSeletorRelacao(tipo, idReferencia) {
    const titulos = { conjuge: 'Acrescentar cônjuge', filho: 'Acrescentar filho(a)', irmao: 'Acrescentar irmão(ã)' };
    document.getElementById('modal-seletor')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modal-seletor';
    overlay.className = 'modal-seletor-overlay';
    overlay.innerHTML = `
      <div class="modal-seletor-box">
        <div class="ms-header">
          <span class="ms-titulo">${titulos[tipo] || 'Acrescentar'}</span>
          <button class="ms-fechar" onclick="document.getElementById('modal-seletor').remove()">✕</button>
        </div>
        <div class="ms-opcoes">
          <button class="ms-opcao" onclick="UI._seletorNovo('${tipo}','${idReferencia}')">
            <span class="ms-icone">✏️</span>
            <div><strong>Novo cadastro</strong><small>Criar uma nova pessoa</small></div>
          </button>
          <button class="ms-opcao" onclick="UI._seletorVerLista('${tipo}','${idReferencia}')">
            <span class="ms-icone">👥</span>
            <div><strong>Selecionar existente</strong><small>Vincular alguém já cadastrado</small></div>
          </button>
        </div>
        <div id="ms-lista-wrap" class="ms-lista-wrap hidden">
          <input type="text" id="ms-pesquisa" class="ms-pesquisa" placeholder="Buscar pessoa..."
            oninput="UI._seletorFiltrar('${tipo}','${idReferencia}',this.value)">
          <div id="ms-lista" class="ms-lista"></div>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    setTimeout(() => overlay.classList.add('visivel'), 10);
  },

  _seletorNovo(tipo, idReferencia) {
    document.getElementById('modal-seletor')?.remove();
    this.fecharModal();
    Cadastro.novoComRelacao(tipo, idReferencia);
  },

  _seletorVerLista(tipo, idReferencia) {
    document.getElementById('ms-lista-wrap')?.classList.remove('hidden');
    this._seletorFiltrar(tipo, idReferencia, '');
    setTimeout(() => document.getElementById('ms-pesquisa')?.focus(), 50);
  },

  _seletorFiltrar(tipo, idReferencia, q) {
    const ref = Storage.getById(idReferencia);
    let pessoas = Storage.getAll().filter(p => p.id !== idReferencia);

    if (tipo === 'conjuge') {
      const jaConjuges = ref?.conjuges || [];
      pessoas = pessoas.filter(p => !jaConjuges.includes(p.id));
    } else if (tipo === 'filho') {
      const jaFilhos = ref?.filhos || [];
      pessoas = pessoas.filter(p => !jaFilhos.includes(p.id) && p.pai !== idReferencia && p.mae !== idReferencia);
    }

    if (q) {
      const lq = q.toLowerCase();
      pessoas = pessoas.filter(p => p.nome?.toLowerCase().includes(lq) || p.sobrenome?.toLowerCase().includes(lq));
    }

    const lista = document.getElementById('ms-lista');
    if (!lista) return;
    lista.innerHTML = pessoas.length
      ? pessoas.map(p => {
          const cor = p.sexo === 'M' ? 'masc' : p.sexo === 'F' ? 'fem' : 'indef';
          return `
          <div class="ms-pessoa-item">
            <div class="ms-pessoa-avatar ${cor}">
              ${p.foto ? `<img src="${p.foto}">` : (p.nome || '?')[0].toUpperCase()}
            </div>
            <div class="ms-pessoa-info">
              <strong>${p.nome} ${p.sobrenome || ''}</strong>
              <small>${p.dataNascimento ? new Date(p.dataNascimento).getFullYear() : '?'} · ${p.vivo !== false ? 'Vivo(a)' : 'Falecido(a)'}</small>
            </div>
            <button class="btn btn-primario btn-sm" onclick="UI._seletorVincular('${tipo}','${idReferencia}','${p.id}')">Vincular</button>
          </div>`;
        }).join('')
      : '<p class="lista-vazia">Nenhuma pessoa disponível.</p>';
  },

  _seletorVincular(tipo, idReferencia, idSelecionado) {
    const ref = Storage.getById(idReferencia);
    if (tipo === 'conjuge') {
      Storage.vincularConjuge(idReferencia, idSelecionado);
      this.toast('Cônjuge vinculado!', 'sucesso');
    } else if (tipo === 'filho') {
      Storage.vincularFilho(idReferencia, idSelecionado, ref?.sexo);
      this.toast('Filho(a) vinculado!', 'sucesso');
    } else if (tipo === 'irmao') {
      const selecionado = Storage.getById(idSelecionado);
      if (selecionado && ref) {
        const atualizado = { ...selecionado };
        if (!atualizado.pai && ref.pai) atualizado.pai = ref.pai;
        if (!atualizado.mae && ref.mae) atualizado.mae = ref.mae;
        Storage.update(atualizado);
        // Atualizar filhos nos pais
        if (atualizado.pai) {
          const pai = Storage.getById(atualizado.pai);
          if (pai && !(pai.filhos || []).includes(idSelecionado)) {
            Storage.update({ ...pai, filhos: [...(pai.filhos || []), idSelecionado] });
          }
        }
        if (atualizado.mae) {
          const mae = Storage.getById(atualizado.mae);
          if (mae && !(mae.filhos || []).includes(idSelecionado)) {
            Storage.update({ ...mae, filhos: [...(mae.filhos || []), idSelecionado] });
          }
        }
        this.toast('Irmão(ã) vinculado!', 'sucesso');
      }
    }
    document.getElementById('modal-seletor')?.remove();
    Cadastro.atualizarSelects();
    Cadastro.renderizarLista();
    this.atualizarDashboard();
    this.verPerfil(idReferencia);
  },

  toast(msg, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.classList.add('visivel'), 10);
    setTimeout(() => { t.classList.remove('visivel'); setTimeout(() => t.remove(), 400); }, 3500);
  }
};
