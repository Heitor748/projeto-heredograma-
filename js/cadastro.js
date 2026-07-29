const Cadastro = {
  pessoaEditando: null,

  init() {
    this.bindEventos();
    this.atualizarSelects();
    this.renderizarLista();
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

    document.getElementById('pesquisa-cadastro').addEventListener('input', e => {
      this.renderizarLista(e.target.value);
    });

    // Atualiza selects ao clicar neles para garantir dados frescos
    ['pai-select', 'mae-select', 'conjuges-select', 'filhos-select'].forEach(id => {
      document.getElementById(id)?.addEventListener('focus', () => {
        const idEditando = this.pessoaEditando?.id || null;
        this.atualizarSelects(idEditando);
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
      sexo: get('sexo'),
      dataNascimento: get('data-nascimento'),
      vivo: document.getElementById('vivo')?.checked ?? true,
      afetado: document.getElementById('afetado')?.checked ?? false,
      portador: document.getElementById('portador')?.checked ?? false,
      pai: get('pai-select') || null,
      mae: get('mae-select') || null,
      conjuges: conjugesSelecionados,
      filhos: filhosSelecionados,
      observacoes: get('observacoes'),
      foto: document.getElementById('foto-preview')?.src?.startsWith('data:')
        ? document.getElementById('foto-preview').src
        : null,
    };
  },

  salvar() {
    const pessoa = this.getPessoaDoForm();
    if (!pessoa.nome) {
      UI.toast('Nome é obrigatório', 'erro');
      return;
    }

    if (this.pessoaEditando) {
      Storage.update(pessoa);
      UI.toast('Pessoa atualizada com sucesso!', 'sucesso');
    } else {
      Storage.add(pessoa);
      UI.toast('Pessoa cadastrada com sucesso!', 'sucesso');
    }

    this.limpar();
    this.atualizarSelects();
    this.renderizarLista();
    UI.atualizarDashboard();
  },

  editar(id) {
    const pessoa = Storage.getById(id);
    if (!pessoa) return;

    this.pessoaEditando = pessoa;
    this.atualizarSelects(id);

    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
    set('nome', pessoa.nome);
    set('sobrenome', pessoa.sobrenome);
    set('sexo', pessoa.sexo);
    set('data-nascimento', pessoa.dataNascimento);
    set('pai-select', pessoa.pai);
    set('mae-select', pessoa.mae);
    set('observacoes', pessoa.observacoes);

    document.getElementById('vivo').checked = pessoa.vivo !== false;
    document.getElementById('afetado').checked = !!pessoa.afetado;
    document.getElementById('portador').checked = !!pessoa.portador;

    // Selecionar múltiplos (filhos e cônjuges)
    ['filhos-select', 'conjuges-select'].forEach(selId => {
      const campo = selId === 'filhos-select' ? pessoa.filhos : pessoa.conjuges;
      const sel = document.getElementById(selId);
      if (sel) Array.from(sel.options).forEach(o => { o.selected = (campo || []).includes(o.value); });
    });

    if (pessoa.foto) {
      document.getElementById('foto-preview').src = pessoa.foto;
      document.getElementById('foto-preview').classList.remove('hidden');
    }

    document.getElementById('btn-excluir').classList.remove('hidden');
    document.getElementById('btn-salvar').textContent = 'Atualizar';
    document.getElementById('form-titulo').textContent = 'Editar Pessoa';

    UI.navegarPara('cadastro');
    document.getElementById('nome').focus();
  },

  excluir(id) {
    const pessoa = Storage.getById(id);
    if (!pessoa) return;
    if (!confirm(`Excluir "${pessoa.nome} ${pessoa.sobrenome}"? Esta ação não pode ser desfeita.`)) return;
    Storage.delete(id);
    this.limpar();
    this.atualizarSelects();
    this.renderizarLista();
    UI.atualizarDashboard();
    UI.toast('Pessoa excluída.', 'info');
  },

  limpar() {
    this.pessoaEditando = null;
    document.getElementById('form-pessoa').reset();
    const preview = document.getElementById('foto-preview');
    preview.src = '';
    preview.classList.add('hidden');
    document.getElementById('btn-excluir').classList.add('hidden');
    document.getElementById('btn-salvar').textContent = 'Salvar';
    document.getElementById('form-titulo').textContent = 'Nova Pessoa';
  },

  carregarFoto(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const preview = document.getElementById('foto-preview');
      preview.src = e.target.result;
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  },

  atualizarSelects(excluirId = null) {
    const pessoas = Storage.getAll().filter(p => p.id !== excluirId);
    const opcoes = pessoas
      .map(p => `<option value="${p.id}">${p.nome} ${p.sobrenome || ''}</option>`)
      .join('');
    const vazio = '<option value="">-- Nenhum --</option>';
    const semPessoas = '<option value="" disabled>Cadastre outras pessoas primeiro</option>';

    ['pai-select', 'mae-select'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = pessoas.length ? vazio + opcoes : vazio + semPessoas;
    });

    ['filhos-select', 'conjuges-select'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = pessoas.length ? opcoes : semPessoas;
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

    lista.innerHTML = pessoas.map(p => `
      <div class="card-pessoa" data-id="${p.id}">
        <div class="card-avatar">
          ${p.foto
            ? `<img src="${p.foto}" alt="${p.nome}">`
            : `<span class="avatar-letra">${(p.nome || '?')[0].toUpperCase()}</span>`
          }
        </div>
        <div class="card-info">
          <strong>${p.nome} ${p.sobrenome || ''}</strong>
          <small>${p.sexo === 'M' ? '♂ Masculino' : p.sexo === 'F' ? '♀ Feminino' : '◇ Indefinido'}
            ${p.dataNascimento ? ' · ' + this.formatarIdade(p.dataNascimento, p.vivo) : ''}
            ${p.afetado ? ' · <span class="tag tag-afetado">Afetado</span>' : ''}
            ${p.portador ? ' · <span class="tag tag-portador">Portador</span>' : ''}
            ${!p.vivo ? ' · <span class="tag tag-falecido">Falecido</span>' : ''}
          </small>
        </div>
        <div class="card-acoes">
          <button onclick="Cadastro.editar('${p.id}')" title="Editar">✏️</button>
          <button onclick="UI.verPerfil('${p.id}')" title="Ver perfil">👤</button>
          <button onclick="Cadastro.excluir('${p.id}')" title="Excluir">🗑️</button>
        </div>
      </div>
    `).join('');
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
