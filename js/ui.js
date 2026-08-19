const UI = {
  secaoAtual: 'dashboard',

  init() {
    this.bindMenu();
    this.bindTema();
    this.bindImportExport();
    this.bindPesquisa();
    this.bindModal();
    this.bindDesfazer();
    this.atualizarDashboard();
    this.aplicarTema();
  },

  bindDesfazer() {
    // Ctrl+Z / Cmd+Z
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        this.desfazer();
      }
    });
    document.getElementById('btn-desfazer')?.addEventListener('click', () => this.desfazer());
  },

  desfazer() {
    const snap = Storage.desfazer();
    if (!snap) { this.toast('Nada para desfazer.', 'info'); return; }
    const d = new Date(snap.ts);
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    Cadastro.atualizarSelects();
    Cadastro.renderizarLista();
    this.atualizarDashboard();
    this.atualizarBotaoDesfazer();
    this.toast(`Restaurado para versão das ${hora} (${snap.pessoas.length} pessoas).`, 'sucesso');
  },

  atualizarBotaoDesfazer() {
    const btn = document.getElementById('btn-desfazer');
    if (!btn) return;
    const qtd = Storage.qtdHistorico();
    btn.disabled = qtd === 0;
    btn.title = qtd > 0 ? `Desfazer (${qtd} versões salvas)` : 'Nada para desfazer';
  },

  _fecharSidebar() {
    document.getElementById('sidebar').classList.remove('aberto');
    document.getElementById('sidebar-backdrop').classList.remove('ativo');
  },

  bindMenu() {
    const backdrop = document.getElementById('sidebar-backdrop');

    document.querySelectorAll('[data-secao]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navegarPara(btn.dataset.secao);
        this._fecharSidebar();
      });
    });

    document.getElementById('btn-menu-mobile')?.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      const abrindo = !sidebar.classList.contains('aberto');
      sidebar.classList.toggle('aberto', abrindo);
      backdrop.classList.toggle('ativo', abrindo);
    });

    backdrop?.addEventListener('click', () => this._fecharSidebar());
  },

  navegarPara(secao) {
    this.secaoAtual = secao;
    document.querySelectorAll('.secao').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('[data-secao]').forEach(b => b.classList.remove('ativo'));
    const el = document.getElementById('secao-' + secao);
    if (el) el.classList.remove('hidden');
    document.querySelectorAll(`[data-secao="${secao}"]`).forEach(b => b.classList.add('ativo'));
    if (secao === 'dashboard') this.atualizarDashboard();
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
      const E = Utils.escapeHtml;
      resultado.innerHTML = pessoas.length
        ? pessoas.map(p => {
            const inic = ((p.nome || '?')[0] || '?').toUpperCase();
            return `
            <div class="resultado-item" onclick="UI.verPerfil('${E(p.id)}')">
              <div class="ri-avatar ${p.sexo === 'M' ? 'masc' : p.sexo === 'F' ? 'fem' : 'indef'}">
                ${p.foto ? `<img src="${E(p.foto)}">` : E(inic)}
              </div>
              <div>
                <span class="ri-nome">${E(p.nome)} ${E(p.sobrenome || '')}</span>
                <small>${p.sexo === 'M' ? '♂' : p.sexo === 'F' ? '♀' : '◇'}
                  ${p.dataNascimento ? ' · ' + new Date(p.dataNascimento).getFullYear() : ''}
                  ${p.vivo === false ? ' · Falecido' : ' · Vivo'}
                  ${p.afetado ? ' · <strong style="color:var(--perigo)">Afetado</strong>' : ''}
                </small>
              </div>
            </div>`;
          }).join('')
        : '<p class="lista-vazia">Nenhum resultado.</p>';
    });
  },

  bindModal() {
    const modal = document.getElementById('modal-perfil');
    modal?.addEventListener('click', e => { if (e.target === modal) this.fecharModal(); });
    document.querySelector('.modal-fechar')?.addEventListener('click', () => this.fecharModal());
  },

  atualizarDashboard() {
    const pessoas = Storage.getAll();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('dash-total', pessoas.length);
    set('dash-homens', pessoas.filter(p => p.sexo === 'M').length);
    set('dash-mulheres', pessoas.filter(p => p.sexo === 'F').length);
    set('dash-afetados', pessoas.filter(p => p.afetado).length);
    set('dash-portadores', pessoas.filter(p => p.portador).length);
    set('dash-falecidos', pessoas.filter(p => p.vivo === false).length);

    const listaEl = document.getElementById('dash-recentes');
    if (listaEl) {
      const E = Utils.escapeHtml;
      const recentes = [...pessoas].reverse().slice(0, 8);
      listaEl.innerHTML = recentes.length
        ? recentes.map(p => {
            const corAv = p.sexo === 'M' ? 'masc' : p.sexo === 'F' ? 'fem' : 'indef';
            const inicial = ((p.nome || '?')[0] || '?').toUpperCase();
            const tags = [
              p.vivo === false ? '<span class="dash-tag falecido">Falecido</span>' : '<span class="dash-tag vivo">Vivo</span>',
              p.afetado  ? '<span class="dash-tag afetado">Afetado</span>'  : '',
              p.portador ? '<span class="dash-tag portador">Portador</span>' : '',
            ].filter(Boolean).join('');
            return `
            <div class="dash-item" onclick="UI.verPerfil('${E(p.id)}')">
              <div class="dash-item-avatar ${corAv}">
                ${p.foto ? `<img src="${E(p.foto)}" alt="${E(p.nome || '')}">` : `<span>${E(inicial)}</span>`}
              </div>
              <div class="dash-item-info">
                <strong>${E(p.nome)} ${E(p.sobrenome || '')}</strong>
                <div class="dash-item-tags">${tags}</div>
              </div>
              <span class="dash-item-seta">›</span>
            </div>`;
          }).join('')
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
    const E = Utils.escapeHtml;
    const inicial = ((pessoa.nome || '?')[0] || '?').toUpperCase();
    const eid = E(id);

    conteudo.innerHTML = `
      <!-- Header -->
      <div class="p2-header">
        <div class="p2-avatar ${corAvatar}">
          ${pessoa.foto ? `<img src="${E(pessoa.foto)}" alt="">` : `<span>${E(inicial)}</span>`}
        </div>
        <div class="p2-header-info">
          <h2>${E(pessoa.nome)} ${E(pessoa.sobrenome || '')}</h2>
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
          <button class="btn btn-outline btn-sm" onclick="Cadastro.editar('${eid}'); UI.fecharModal()">✏️ Editar</button>
          <button class="btn btn-perigo btn-sm" onclick="Cadastro.excluir('${eid}'); UI.fecharModal()">🗑️</button>
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
            <span>${E(pessoa.observacoes)}</span>
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
          const inicC = ((c.nome || '?')[0] || '?').toUpperCase();
          return `
          <div class="p2-rel-card">
            <div class="p2-rel-pessoa" onclick="UI.verPerfil('${E(c.id)}')">
              <div class="p2-rel-avatar ${corC}">
                ${c.foto ? `<img src="${E(c.foto)}">` : E(inicC)}
              </div>
              <div class="p2-rel-info">
                <strong>${E(c.nome)} ${E(c.sobrenome || '')}</strong>
                <small>${c.dataNascimento ? new Date(c.dataNascimento).getFullYear() : '?'} – ${c.vivo !== false ? 'Vivo(a)' : 'Falecido(a)'}</small>
              </div>
            </div>
            ${filhosDoConjuge.length ? `
            <div class="p2-filhos-lista">
              <span class="p2-sub-label">Filhos</span>
              ${filhosDoConjuge.map(f => {
                const inicF = ((f.nome || '?')[0] || '?').toUpperCase();
                return `
                <div class="p2-mini-card" onclick="UI.verPerfil('${E(f.id)}')">
                  <div class="p2-mini-avatar ${f.sexo === 'M' ? 'masc' : f.sexo === 'F' ? 'fem' : 'indef'}">
                    ${f.foto ? `<img src="${E(f.foto)}">` : E(inicF)}
                  </div>
                  <span>${E(f.nome)} ${E(f.sobrenome || '')}</span>
                </div>`;
              }).join('')}
            </div>` : ''}
          </div>`;
        }).join('')}

        ${(() => {
          const outros = filhos.filter(f => !conjuges.some(c =>
            (f.pai === id && f.mae === c.id) || (f.mae === id && f.pai === c.id)));
          if (!outros.length) return '';
          return `
          <div class="p2-rel-card">
            <span class="p2-sub-label">Outros filhos</span>
            ${outros.map(f => {
              const inicF = ((f.nome || '?')[0] || '?').toUpperCase();
              return `
              <div class="p2-mini-card" onclick="UI.verPerfil('${E(f.id)}')">
                <div class="p2-mini-avatar ${f.sexo === 'M' ? 'masc' : f.sexo === 'F' ? 'fem' : 'indef'}">
                  ${f.foto ? `<img src="${E(f.foto)}">` : E(inicF)}
                </div>
                <span>${E(f.nome)} ${E(f.sobrenome || '')}</span>
              </div>`;
            }).join('')}
          </div>`;
        })()}

        <button class="p2-btn-add" onclick="UI.mostrarSeletorRelacao('conjuge','${eid}')">
          + Acrescentar cônjuge
        </button>
        <button class="p2-btn-add" onclick="UI.mostrarSeletorRelacao('filho','${eid}')">
          + Acrescentar filho(a)
        </button>
      </div>

      <!-- Aba: Pais -->
      <div id="p2-tab-pais" class="p2-tab-content hidden">
        <div class="p2-pais-bloco">
          ${pai || mae ? `
          <div class="p2-pais-bracket">
            ${pai ? (() => {
              const iP = ((pai.nome || '?')[0] || '?').toUpperCase();
              return `
              <div class="p2-rel-pessoa" onclick="UI.verPerfil('${E(pai.id)}')">
                <div class="p2-rel-avatar masc">
                  ${pai.foto ? `<img src="${E(pai.foto)}">` : E(iP)}
                </div>
                <div class="p2-rel-info">
                  <strong>${E(pai.nome)} ${E(pai.sobrenome || '')}</strong>
                  <small>${pai.dataNascimento ? new Date(pai.dataNascimento).getFullYear() : '?'} – ${pai.vivo !== false ? 'Vivo(a)' : 'Falecido(a)'}</small>
                </div>
              </div>`;
            })() : '<div class="p2-pai-vazio">Pai desconhecido</div>'}
            ${mae ? (() => {
              const iM = ((mae.nome || '?')[0] || '?').toUpperCase();
              return `
              <div class="p2-rel-pessoa" onclick="UI.verPerfil('${E(mae.id)}')">
                <div class="p2-rel-avatar fem">
                  ${mae.foto ? `<img src="${E(mae.foto)}">` : E(iM)}
                </div>
                <div class="p2-rel-info">
                  <strong>${E(mae.nome)} ${E(mae.sobrenome || '')}</strong>
                  <small>${mae.dataNascimento ? new Date(mae.dataNascimento).getFullYear() : '?'} – ${mae.vivo !== false ? 'Vivo(a)' : 'Falecido(a)'}</small>
                </div>
              </div>`;
            })() : '<div class="p2-pai-vazio">Mãe desconhecida</div>'}
          </div>` : '<p class="lista-vazia">Pais não cadastrados</p>'}
        </div>

        ${irmaos.length ? `
        <div class="p2-irmaos">
          <span class="p2-sub-label">Irmãos (${irmaos.length})</span>
          ${irmaos.map(ir => {
            const iI = ((ir.nome || '?')[0] || '?').toUpperCase();
            return `
            <div class="p2-mini-card" onclick="UI.verPerfil('${E(ir.id)}')">
              <div class="p2-mini-avatar ${ir.sexo === 'M' ? 'masc' : ir.sexo === 'F' ? 'fem' : 'indef'}">
                ${ir.foto ? `<img src="${E(ir.foto)}">` : E(iI)}
              </div>
              <span>${E(ir.nome)} ${E(ir.sobrenome || '')}</span>
            </div>`;
          }).join('')}
        </div>` : ''}

        <button class="p2-btn-add" onclick="UI.mostrarSeletorRelacao('irmao','${eid}')">
          + Acrescentar irmão(ã)
        </button>
        <button class="p2-btn-add" onclick="Cadastro.editar('${eid}'); UI.fecharModal()">
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

    const E = Utils.escapeHtml;
    const etipo = E(tipo), eidRef = E(idReferencia);
    const overlay = document.createElement('div');
    overlay.id = 'modal-seletor';
    overlay.className = 'modal-seletor-overlay';
    overlay.innerHTML = `
      <div class="modal-seletor-box">
        <div class="ms-header">
          <span class="ms-titulo">${E(titulos[tipo] || 'Acrescentar')}</span>
          <button class="ms-fechar" onclick="document.getElementById('modal-seletor').remove()">✕</button>
        </div>
        <div class="ms-opcoes">
          <button class="ms-opcao" onclick="UI._seletorNovo('${etipo}','${eidRef}')">
            <span class="ms-icone">✏️</span>
            <div><strong>Novo cadastro</strong><small>Criar uma nova pessoa</small></div>
          </button>
          <button class="ms-opcao" onclick="UI._seletorVerLista('${etipo}','${eidRef}')">
            <span class="ms-icone">👥</span>
            <div><strong>Selecionar existente</strong><small>Vincular alguém já cadastrado</small></div>
          </button>
        </div>
        <div id="ms-lista-wrap" class="ms-lista-wrap hidden">
          <input type="text" id="ms-pesquisa" class="ms-pesquisa" placeholder="Buscar pessoa...">
          <div id="ms-lista" class="ms-lista"></div>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    // Bind da busca via listener em vez de inline (evita injeção via id)
    overlay.querySelector('#ms-pesquisa')?.addEventListener('input', ev => {
      this._seletorFiltrar(tipo, idReferencia, ev.target.value);
    });
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
    const E = Utils.escapeHtml;
    const etipo = E(tipo), eidRef = E(idReferencia);
    lista.innerHTML = pessoas.length
      ? pessoas.map(p => {
          const cor = p.sexo === 'M' ? 'masc' : p.sexo === 'F' ? 'fem' : 'indef';
          const inic = ((p.nome || '?')[0] || '?').toUpperCase();
          return `
          <div class="ms-pessoa-item">
            <div class="ms-pessoa-avatar ${cor}">
              ${p.foto ? `<img src="${E(p.foto)}">` : E(inic)}
            </div>
            <div class="ms-pessoa-info">
              <strong>${E(p.nome)} ${E(p.sobrenome || '')}</strong>
              <small>${p.dataNascimento ? new Date(p.dataNascimento).getFullYear() : '?'} · ${p.vivo !== false ? 'Vivo(a)' : 'Falecido(a)'}</small>
            </div>
            <button class="btn btn-primario btn-sm" onclick="UI._seletorVincular('${etipo}','${eidRef}','${E(p.id)}')">Vincular</button>
          </div>`;
        }).join('')
      : '<p class="lista-vazia">Nenhuma pessoa disponível.</p>';
  },

  _seletorVincular(tipo, idReferencia, idSelecionado) {
    const ref = Storage.getById(idReferencia);
    if (!ref) { this.toast('Referência inválida.', 'erro'); return; }

    if (tipo === 'conjuge') {
      if (idReferencia === idSelecionado) { this.toast('Não pode ser cônjuge de si mesmo.', 'erro'); return; }
      Storage.vincularConjuge(idReferencia, idSelecionado);
      this.toast('Cônjuge vinculado!', 'sucesso');
    } else if (tipo === 'filho') {
      // Sem sexo definido no responsável, pedir para escolher slot
      let slot = null;
      if (!ref.sexo) {
        const escolha = prompt('O responsável não tem sexo definido. Digite "pai" ou "mae" para vincular:', 'pai');
        if (escolha !== 'pai' && escolha !== 'mae') {
          this.toast('Vínculo cancelado.', 'info'); return;
        }
        slot = escolha;
      }
      const r = Storage.vincularFilho(idReferencia, idSelecionado, ref.sexo, slot);
      if (!r.ok) {
        const msg = r.erro === 'ciclo' ? 'Isso criaria um ciclo genealógico.'
                  : r.erro === 'sexo-obrigatorio' ? 'Defina o sexo do responsável primeiro.'
                  : 'Não foi possível vincular.';
        this.toast(msg, 'erro'); return;
      }
      this.toast('Filho(a) vinculado!', 'sucesso');
    } else if (tipo === 'irmao') {
      const selecionado = Storage.getById(idSelecionado);
      if (selecionado) {
        // Sem sobrescrever pai/mae já definidos do irmão
        const atualizado = { ...selecionado };
        if (!atualizado.pai && ref.pai) atualizado.pai = ref.pai;
        if (!atualizado.mae && ref.mae) atualizado.mae = ref.mae;
        // Validar ciclo antes de gravar
        const lista = Storage.getAll();
        const ciclo = (atualizado.pai && Storage._ehDescendente(atualizado.pai, idSelecionado, lista))
                   || (atualizado.mae && Storage._ehDescendente(atualizado.mae, idSelecionado, lista));
        if (ciclo) { this.toast('Isso criaria um ciclo genealógico.', 'erro'); return; }
        Storage.update(atualizado); // sincronizarRelacoes cuida do resto
        this.toast('Irmão(ã) vinculado!', 'sucesso');
      }
    }
    document.getElementById('modal-seletor')?.remove();
    Cadastro.atualizarSelects();
    Cadastro.renderizarLista();
    this.atualizarDashboard();
    this.verPerfil(idReferencia);
  },

  toast(msg, tipo = 'info', { acao, labelAcao } = {}) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    if (acao) {
      const span = document.createElement('span');
      span.textContent = msg + ' ';
      const btn = document.createElement('button');
      btn.className = 'toast-acao';
      btn.textContent = labelAcao || 'Desfazer';
      btn.addEventListener('click', () => { acao(); t.remove(); });
      t.appendChild(span);
      t.appendChild(btn);
    } else {
      t.textContent = msg;
    }
    container.appendChild(t);
    setTimeout(() => t.classList.add('visivel'), 10);
    const timer = setTimeout(() => { t.classList.remove('visivel'); setTimeout(() => t.remove(), 400); }, 5000);
    t.addEventListener('click', e => { if (e.target !== t) return; clearTimeout(timer); t.classList.remove('visivel'); setTimeout(() => t.remove(), 400); });
  }
};
