const Cadastro = {
  pessoaEditando: null,

  init() {
    this.bindEventos();
    this.atualizarSelects();
    this.renderizarLista();
    this.bindSexoBtns();
  },

  bindEventos() {
    document.getElementById('form-pessoa').addEventListener('submit', e => {
      e.preventDefault();
      this.salvar();
    });
    document.getElementById('btn-limpar').addEventListener('click', () => this.limpar());
    document.getElementById('btn-excluir').addEventListener('click', () => {
      if (this.pessoaEditando) this.excluir(this.pessoaEditando.id);
    });
    document.getElementById('foto-input').addEventListener('change', e => {
      this.carregarFoto(e.target.files[0]);
    });
    document.getElementById('foto-area-click')?.addEventListener('click', () => {
      document.getElementById('foto-input').click();
    });
    document.getElementById('pesquisa-cadastro').addEventListener('input', e => {
      this.renderizarLista(e.target.value);
    });

    // Mostrar/ocultar data de falecimento
    document.getElementById('falecido')?.addEventListener('change', e => {
      const grupo = document.getElementById('grupo-data-falecimento');
      if (grupo) {
        grupo.classList.remove('hidden');
        grupo.style.display = e.target.checked ? 'flex' : 'none';
      }
    });
  },

  bindSexoBtns() {
    document.querySelectorAll('.sexo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sexo-btn').forEach(b => b.classList.remove('ativo'));
        btn.classList.add('ativo');
        document.getElementById('sexo-hidden').value = btn.dataset.valor;
        // Atualizar cor do avatar
        const preview = document.getElementById('foto-area-click');
        if (preview) {
          preview.className = preview.className.replace(/\b(masc|fem|indef)\b/g, '');
          const cor = btn.dataset.valor === 'M' ? 'masc' : btn.dataset.valor === 'F' ? 'fem' : 'indef';
          preview.classList.add(cor);
        }
      });
    });
  },

  getPessoaDoForm() {
    const get = id => document.getElementById(id)?.value?.trim() || '';
    const filhosSelecionados = Array.from(
      document.getElementById('filhos-select')?.selectedOptions || []
    ).map(o => o.value);
    const conjugesSelecionados = Array.from(
      document.getElementById('conjuges-select')?.selectedOptions || []
    ).map(o => o.value);
    return {
      id: this.pessoaEditando?.id || null,
      nome: get('nome'),
      sobrenome: get('sobrenome'),
      sexo: get('sexo-hidden'),
      dataNascimento: get('data-nascimento') || null,
      dataFalecimento: get('data-falecimento') || null,
      vivo: !document.getElementById('falecido')?.checked,
      afetado: document.getElementById('afetado')?.checked ?? false,
      portador: document.getElementById('portador')?.checked ?? false,
      pai: get('pai-select') || null,
      mae: get('mae-select') || null,
      conjuges: this.pessoaEditando ? (this.pessoaEditando.conjuges || []) : conjugesSelecionados,
      filhos:   this.pessoaEditando ? (this.pessoaEditando.filhos   || []) : filhosSelecionados,
      observacoes: get('observacoes'),
      foto: document.getElementById('foto-preview')?.src?.startsWith('data:')
        ? document.getElementById('foto-preview').src
        : (this.pessoaEditando?.foto || null),
    };
  },

  salvar() {
    const pessoa = this.getPessoaDoForm();
    if (!pessoa.nome) { UI.toast('Nome é obrigatório', 'erro'); return; }

    // Validação: pai/mãe não podem ser descendentes desta pessoa
    if (this.pessoaEditando) {
      const listaAtual = Storage.getAll();
      const virariaCiclo = campo => campo && Storage._ehDescendente(campo, this.pessoaEditando.id, listaAtual);
      if (virariaCiclo(pessoa.pai))  { UI.toast('O pai selecionado é descendente desta pessoa (ciclo).', 'erro'); return; }
      if (virariaCiclo(pessoa.mae))  { UI.toast('A mãe selecionada é descendente desta pessoa (ciclo).', 'erro'); return; }
    }

    let idFinal;
    if (this.pessoaEditando) {
      Storage.update(pessoa);
      idFinal = pessoa.id;
      UI.toast('Pessoa atualizada!', 'sucesso');
    } else {
      const salva = Storage.add(pessoa);
      idFinal = salva.id;

      // Aplicar relação pendente. Storage.save já sincroniza filhos[]/conjuges[]
      // bidirecionalmente a partir de pai/mae/conjuges — aqui só ajustamos os
      // campos canônicos que o form não configurou.
      if (this._relacaoPendente) {
        const { tipo, idReferencia } = this._relacaoPendente;
        const ref = Storage.getById(idReferencia);
        if (tipo === 'conjuge') {
          Storage.vincularConjuge(salva.id, idReferencia);
        } else if (tipo === 'irmao' && ref) {
          const atualizado = { ...Storage.getById(salva.id) };
          if (!atualizado.pai && ref.pai) atualizado.pai = ref.pai;
          if (!atualizado.mae && ref.mae) atualizado.mae = ref.mae;
          Storage.update(atualizado);
        }
        // tipo 'filho': pai-select/mae-select já estão preenchidos no form.
        this._relacaoPendente = null;
      }
      UI.toast('Pessoa cadastrada!', 'sucesso');
    }

    this.limpar();
    this.atualizarSelects();
    this.renderizarLista();
    UI.atualizarDashboard();
    UI.atualizarBotaoDesfazer();
  },

  editar(id) {
    const pessoa = Storage.getById(id);
    if (!pessoa) { UI.toast('Pessoa não encontrada.', 'erro'); return; }
    // Guardar cópia fresca para evitar sobrescrever com estado stale
    this.pessoaEditando = { ...pessoa };
    this.atualizarSelects(id);

    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
    set('nome', pessoa.nome);
    set('sobrenome', pessoa.sobrenome);
    set('data-nascimento', pessoa.dataNascimento);
    set('data-falecimento', pessoa.dataFalecimento);
    set('sexo-hidden', pessoa.sexo);
    set('pai-select', pessoa.pai);
    set('mae-select', pessoa.mae);
    set('observacoes', pessoa.observacoes);

    // Botões de sexo
    document.querySelectorAll('.sexo-btn').forEach(b => b.classList.remove('ativo'));
    const btnSexo = document.querySelector(`.sexo-btn[data-valor="${pessoa.sexo || ''}"]`);
    if (btnSexo) btnSexo.classList.add('ativo');

    // Atualizar cor da área de foto
    const fotoArea = document.getElementById('foto-area-click');
    if (fotoArea) {
      fotoArea.className = fotoArea.className.replace(/\b(masc|fem|indef)\b/g, '').trim();
      fotoArea.classList.add(pessoa.sexo === 'M' ? 'masc' : pessoa.sexo === 'F' ? 'fem' : 'indef');
    }

    // Checkboxes
    if (document.getElementById('falecido')) document.getElementById('falecido').checked = pessoa.vivo === false;
    if (document.getElementById('afetado')) document.getElementById('afetado').checked = !!pessoa.afetado;
    if (document.getElementById('portador')) document.getElementById('portador').checked = !!pessoa.portador;

    // Mostrar/ocultar campo de data de falecimento
    const grupoFalecimento = document.getElementById('grupo-data-falecimento');
    if (grupoFalecimento) {
      grupoFalecimento.classList.remove('hidden');
      grupoFalecimento.style.display = pessoa.vivo === false ? 'flex' : 'none';
    }

    // Multi-selects
    ['filhos-select', 'conjuges-select'].forEach(selId => {
      const campo = selId === 'filhos-select' ? pessoa.filhos : pessoa.conjuges;
      const sel = document.getElementById(selId);
      if (sel) Array.from(sel.options).forEach(o => { o.selected = (campo || []).includes(o.value); });
    });

    // Foto
    const preview = document.getElementById('foto-preview');
    if (preview) {
      if (pessoa.foto) {
        preview.src = pessoa.foto;
        preview.classList.remove('hidden');
        document.getElementById('foto-placeholder')?.classList.add('hidden');
      } else {
        preview.src = '';
        preview.classList.add('hidden');
        document.getElementById('foto-placeholder')?.classList.remove('hidden');
      }
    }

    document.getElementById('btn-excluir').classList.remove('hidden');
    document.getElementById('btn-salvar').textContent = 'Atualizar';
    document.getElementById('form-titulo').textContent = 'Editar Pessoa';
    UI.navegarPara('cadastro');
    document.getElementById('nome').focus();
  },

  // Abre form pré-configurado e salva relação bidirecional ao salvar
  novoComRelacao(tipo, idReferencia) {
    this.limpar();
    this._relacaoPendente = { tipo, idReferencia };
    UI.navegarPara('cadastro');
    const pessoa = Storage.getById(idReferencia);
    if (!pessoa) return;
    this.atualizarSelects(null);

    if (tipo === 'filho') {
      if (pessoa.sexo === 'M') { const el = document.getElementById('pai-select'); if (el) el.value = idReferencia; }
      else if (pessoa.sexo === 'F') { const el = document.getElementById('mae-select'); if (el) el.value = idReferencia; }
    } else if (tipo === 'irmao') {
      const pai = document.getElementById('pai-select');
      const mae = document.getElementById('mae-select');
      if (pai && pessoa.pai) pai.value = pessoa.pai;
      if (mae && pessoa.mae) mae.value = pessoa.mae;
    }
    // cônjuge: não pré-preenche campos, aplica depois do salvar
  },

  excluir(id) {
    const pessoa = Storage.getById(id);
    if (!pessoa) return;
    if (!confirm(`Excluir "${pessoa.nome} ${pessoa.sobrenome || ''}"?\n\nVocê poderá desfazer esta ação clicando em "Desfazer" na notificação que aparecerá.`)) return;
    Storage.delete(id);
    this.limpar();
    this.atualizarSelects();
    this.renderizarLista();
    UI.atualizarDashboard();
    UI.atualizarBotaoDesfazer();
    UI.toast(`"${pessoa.nome}" excluído(a).`, 'info', {
      acao: () => { UI.desfazer(); },
      labelAcao: '↩ Desfazer'
    });
  },

  limpar() {
    this.pessoaEditando = null;
    document.getElementById('form-pessoa').reset();
    document.getElementById('sexo-hidden').value = '';
    document.querySelectorAll('.sexo-btn').forEach(b => b.classList.remove('ativo'));
    document.querySelector('.sexo-btn[data-valor=""]')?.classList.add('ativo');

    const preview = document.getElementById('foto-preview');
    if (preview) { preview.src = ''; preview.classList.add('hidden'); }
    document.getElementById('foto-placeholder')?.classList.remove('hidden');

    const fotoArea = document.getElementById('foto-area-click');
    if (fotoArea) {
      fotoArea.className = fotoArea.className.replace(/\b(masc|fem|indef)\b/g, '').trim();
      fotoArea.classList.add('indef');
    }

    const gdf = document.getElementById('grupo-data-falecimento');
    if (gdf) { gdf.classList.remove('hidden'); gdf.style.display = 'none'; }
    document.getElementById('btn-excluir').classList.add('hidden');
    document.getElementById('btn-salvar').textContent = 'Salvar';
    document.getElementById('form-titulo').textContent = 'Nova Pessoa';
  },

  carregarFoto(file) {
    if (!file) return;
    Utils.comprimirImagem(file, { maxLado: 480, qualidade: 0.82 })
      .then(dataUrl => {
        const preview = document.getElementById('foto-preview');
        if (preview) { preview.src = dataUrl; preview.classList.remove('hidden'); }
        document.getElementById('foto-placeholder')?.classList.add('hidden');
      })
      .catch(() => {
        UI.toast('Não foi possível processar a foto. Tente outra imagem.', 'erro');
      });
  },

  atualizarSelects(excluirId = null) {
    const todas = Storage.getAll();
    // Ao editar, excluir a própria pessoa E seus descendentes das opções de pai/mãe
    // (evita ciclo: neto virar pai do avô).
    const idBloqueado = excluirId || this.pessoaEditando?.id;
    const bloqueados = new Set();
    if (idBloqueado) {
      bloqueados.add(idBloqueado);
      // BFS pelos descendentes usando pai/mae + filhos[]
      const filhosDe = new Map(todas.map(p => [p.id, new Set(p.filhos || [])]));
      todas.forEach(x => {
        if (x.pai && filhosDe.has(x.pai)) filhosDe.get(x.pai).add(x.id);
        if (x.mae && filhosDe.has(x.mae)) filhosDe.get(x.mae).add(x.id);
      });
      const fila = [idBloqueado];
      while (fila.length) {
        const cur = fila.shift();
        (filhosDe.get(cur) || new Set()).forEach(f => {
          if (!bloqueados.has(f)) { bloqueados.add(f); fila.push(f); }
        });
      }
    }
    const disponiveis = todas.filter(p => !bloqueados.has(p.id));
    const esc = Utils.escapeHtml;
    const opcoes = disponiveis.map(p =>
      `<option value="${esc(p.id)}">${esc(p.nome)} ${esc(p.sobrenome || '')}</option>`
    ).join('');
    const vazio = '<option value="">-- Nenhum --</option>';
    const semPessoas = '<option value="" disabled>Cadastre outras pessoas primeiro</option>';

    ['pai-select', 'mae-select'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = disponiveis.length ? vazio + opcoes : vazio + semPessoas;
    });
    ['filhos-select', 'conjuges-select'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = disponiveis.length ? opcoes : semPessoas;
    });
  },

  renderizarLista(filtro = '') {
    const lista = document.getElementById('lista-pessoas');
    if (!lista) return;
    let pessoas = Storage.getAll();
    if (filtro) {
      const f = filtro.toLowerCase();
      pessoas = pessoas.filter(p =>
        p.nome?.toLowerCase().includes(f) || p.sobrenome?.toLowerCase().includes(f)
      );
    }
    if (!pessoas.length) {
      lista.innerHTML = '<p class="lista-vazia">Nenhuma pessoa cadastrada.</p>';
      return;
    }
    const esc = Utils.escapeHtml;
    lista.innerHTML = pessoas.map(p => {
      const corAvatar = p.sexo === 'M' ? 'masc' : p.sexo === 'F' ? 'fem' : 'indef';
      const anoNasc = p.dataNascimento ? new Date(p.dataNascimento).getFullYear() : null;
      const inicial = ((p.nome || '?')[0] || '?').toUpperCase();
      return `
      <div class="card-pessoa2" onclick="UI.verPerfil('${esc(p.id)}')">
        <div class="cp2-avatar ${corAvatar}">
          ${p.foto ? `<img src="${esc(p.foto)}" alt="${esc(p.nome || '')}">` : `<span>${esc(inicial)}</span>`}
        </div>
        <div class="cp2-info">
          <strong>${esc(p.nome)} ${esc(p.sobrenome || '')}</strong>
          <small>
            ${anoNasc ? anoNasc + ' – ' : ''}${p.vivo !== false ? 'Vivo(a)' : 'Falecido(a)'}
            ${p.afetado ? ' · <span style="color:var(--perigo)">Afetado</span>' : ''}
            ${p.portador ? ' · <span style="color:var(--aviso)">Portador</span>' : ''}
          </small>
        </div>
        <div class="cp2-acoes" onclick="event.stopPropagation()">
          <button onclick="Cadastro.editar('${esc(p.id)}')" title="Editar">✏️</button>
          <button onclick="Cadastro.excluir('${esc(p.id)}')" title="Excluir">🗑️</button>
        </div>
      </div>`;
    }).join('');
  },

  formatarIdade(dataNasc, vivo) {
    if (!dataNasc) return '';
    const nasc = new Date(dataNasc);
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return vivo === false ? `† ${nasc.getFullYear()}` : `${idade} anos`;
  }
};
