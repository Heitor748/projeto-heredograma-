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

    if (this.pessoaEditando) {
      Storage.update(pessoa);
      UI.toast('Pessoa atualizada!', 'sucesso');
    } else {
      const salva = Storage.add(pessoa);
      // Aplicar relação pendente (cônjuge, filho, irmão)
      if (this._relacaoPendente) {
        const { tipo, idReferencia } = this._relacaoPendente;
        const ref = Storage.getById(idReferencia);
        if (tipo === 'conjuge') {
          Storage.vincularConjuge(salva.id, idReferencia);
        } else if (tipo === 'filho') {
          // Já foi configurado no pai/mae do form, garantir bidirecional
          const paiSelecionado = pessoa.pai;
          const maeSelecionada = pessoa.mae;
          if (paiSelecionado) {
            const lista = Storage.getAll();
            const paiObj = lista.find(p => p.id === paiSelecionado);
            if (paiObj && !(paiObj.filhos || []).includes(salva.id)) {
              paiObj.filhos = [...(paiObj.filhos || []), salva.id];
              Storage.update(paiObj);
            }
          }
          if (maeSelecionada) {
            const lista = Storage.getAll();
            const maeObj = lista.find(p => p.id === maeSelecionada);
            if (maeObj && !(maeObj.filhos || []).includes(salva.id)) {
              maeObj.filhos = [...(maeObj.filhos || []), salva.id];
              Storage.update(maeObj);
            }
          }
        } else if (tipo === 'irmao' && ref) {
          if (!salva.pai && ref.pai) { salva.pai = ref.pai; Storage.update(salva); }
          if (!salva.mae && ref.mae) { salva.mae = ref.mae; Storage.update(salva); }
          if (salva.pai) {
            const pai = Storage.getById(salva.pai);
            if (pai && !(pai.filhos || []).includes(salva.id))
              Storage.update({ ...pai, filhos: [...(pai.filhos || []), salva.id] });
          }
          if (salva.mae) {
            const mae = Storage.getById(salva.mae);
            if (mae && !(mae.filhos || []).includes(salva.id))
              Storage.update({ ...mae, filhos: [...(mae.filhos || []), salva.id] });
          }
        }
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
    if (!pessoa) return;
    this.pessoaEditando = pessoa;
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
    const reader = new FileReader();
    reader.onload = e => {
      const preview = document.getElementById('foto-preview');
      if (preview) { preview.src = e.target.result; preview.classList.remove('hidden'); }
      document.getElementById('foto-placeholder')?.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  },

  atualizarSelects(excluirId = null) {
    const pessoas = Storage.getAll().filter(p => p.id !== excluirId);
    const opcoes = pessoas.map(p =>
      `<option value="${p.id}">${p.nome} ${p.sobrenome || ''}</option>`
    ).join('');
    const vazio = '<option value="">-- Nenhum --</option>';
    const semPessoas = '<option value="" disabled>Cadastre outras pessoas primeiro</option>';

    ['pai-select', 'mae-select'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = pessoas.length ? vazio + opcoes : vazio + semPessoas;
    });
    ['filhos-select', 'conjuges-select'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = pessoas.length ? opcoes : semPessoas;
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
    lista.innerHTML = pessoas.map(p => {
      const corAvatar = p.sexo === 'M' ? 'masc' : p.sexo === 'F' ? 'fem' : 'indef';
      const anoNasc = p.dataNascimento ? new Date(p.dataNascimento).getFullYear() : null;
      return `
      <div class="card-pessoa2" onclick="UI.verPerfil('${p.id}')">
        <div class="cp2-avatar ${corAvatar}">
          ${p.foto ? `<img src="${p.foto}" alt="${p.nome}">` : `<span>${(p.nome || '?')[0].toUpperCase()}</span>`}
        </div>
        <div class="cp2-info">
          <strong>${p.nome} ${p.sobrenome || ''}</strong>
          <small>
            ${anoNasc ? anoNasc + ' – ' : ''}${p.vivo !== false ? 'Vivo(a)' : 'Falecido(a)'}
            ${p.afetado ? ' · <span style="color:var(--perigo)">Afetado</span>' : ''}
            ${p.portador ? ' · <span style="color:var(--aviso)">Portador</span>' : ''}
          </small>
        </div>
        <div class="cp2-acoes" onclick="event.stopPropagation()">
          <button onclick="Cadastro.editar('${p.id}')" title="Editar">✏️</button>
          <button onclick="Cadastro.excluir('${p.id}')" title="Excluir">🗑️</button>
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
