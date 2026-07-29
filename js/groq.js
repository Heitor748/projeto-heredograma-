const Groq = {
  apiKey: '',
  historico: [],
  modo: 'chat', // 'chat' ou 'gerar'

  init() {
    const cfg = Storage.getConfig();
    this.apiKey = cfg.groqApiKey || '';

    const keyInput = document.getElementById('groq-api-key');
    if (keyInput) {
      keyInput.value = this.apiKey;
      keyInput.addEventListener('change', e => {
        this.apiKey = e.target.value.trim();
        Storage.saveConfig({ ...Storage.getConfig(), groqApiKey: this.apiKey });
      });
    }

    document.getElementById('form-chat')?.addEventListener('submit', e => {
      e.preventDefault();
      this.enviarMensagem();
    });

    document.getElementById('btn-limpar-chat')?.addEventListener('click', () => this.limparChat());

    document.getElementById('btn-gerar-familia')?.addEventListener('click', () => this.alternarModo('gerar'));
    document.getElementById('btn-modo-chat')?.addEventListener('click', () => this.alternarModo('chat'));
  },

  alternarModo(modo) {
    this.modo = modo;
    const btnGerar = document.getElementById('btn-gerar-familia');
    const btnChat = document.getElementById('btn-modo-chat');
    const placeholder = document.getElementById('chat-input');
    const dica = document.getElementById('chat-dica');

    if (modo === 'gerar') {
      btnGerar?.classList.add('ativo');
      btnChat?.classList.remove('ativo');
      if (placeholder) placeholder.placeholder = 'Descreva a família... ex: "João é pai de Carlos e Ana. Carlos é casado com Lucia e tem filhos Lucas e Julia."';
      if (dica) dica.textContent = '🧬 Modo Geração: a IA irá criar as pessoas e montar a árvore automaticamente.';
    } else {
      btnChat?.classList.add('ativo');
      btnGerar?.classList.remove('ativo');
      if (placeholder) placeholder.placeholder = 'Pergunte sobre a árvore genealógica...';
      if (dica) dica.textContent = '💬 Modo Chat: faça perguntas sobre a família cadastrada.';
    }
  },

  async enviarMensagem() {
    const input = document.getElementById('chat-input');
    const msg = input?.value?.trim();
    if (!msg) return;

    if (!this.apiKey) {
      UI.toast('Configure a chave da API Groq nas Configurações.', 'erro');
      return;
    }

    this.adicionarMensagem(msg, 'usuario');
    input.value = '';

    if (this.modo === 'gerar') {
      await this.gerarFamilia(msg);
    } else {
      await this.responderPergunta(msg);
    }
  },

  async responderPergunta(msg) {
    const pessoas = Storage.getAll();
    const contexto = this.gerarContexto(pessoas);
    this.historico.push({ role: 'user', content: msg });
    const indicador = this.adicionarIndicador();

    try {
      const resposta = await this.chamarAPI([
        {
          role: 'system',
          content: `Você é um assistente especialista em genealogia e genética médica.
Analise os dados da família e responda perguntas sobre relacionamentos, hereditariedade e padrões genéticos.
Responda sempre em português brasileiro, de forma clara e didática.
Se perguntarem sobre montar a árvore ou adicionar pessoas, diga que podem usar o botão "Gerar Família" na interface.

DADOS DA FAMÍLIA:
${contexto || 'Nenhuma pessoa cadastrada ainda.'}`
        },
        ...this.historico
      ]);

      this.historico.push({ role: 'assistant', content: resposta });
      indicador.remove();
      this.adicionarMensagem(resposta, 'assistente');

    } catch (err) {
      indicador.remove();
      this.adicionarMensagem(`Erro: ${err.message}`, 'erro');
    }
  },

  async gerarFamilia(descricao) {
    const indicador = this.adicionarIndicador();

    const prompt = `Você é um sistema que extrai dados genealógicos de descrições em texto e retorna JSON estruturado.

A partir da descrição abaixo, extraia todas as pessoas e seus relacionamentos.

REGRAS IMPORTANTES:
- Gere IDs únicos simples: "p1", "p2", "p3", etc.
- sexo: "M" para masculino, "F" para feminino, "" para desconhecido
- conjuges: array de IDs dos cônjuges
- filhos: array de IDs dos filhos diretos
- pai: ID do pai (string ou null)
- mae: ID da mãe (string ou null)
- afetado: true se mencionar doença, condição, afetado
- portador: true se mencionar portador
- vivo: false se mencionar falecido, morto, faleceu
- dataNascimento: formato "YYYY-MM-DD" se mencionado, senão null
- Retorne APENAS o JSON, sem texto antes ou depois

FORMATO DE SAÍDA (JSON puro):
{
  "pessoas": [
    {
      "id": "p1",
      "nome": "Nome",
      "sobrenome": "Sobrenome",
      "sexo": "M",
      "dataNascimento": null,
      "vivo": true,
      "afetado": false,
      "portador": false,
      "pai": null,
      "mae": null,
      "conjuges": ["p2"],
      "filhos": ["p3"],
      "observacoes": "",
      "foto": null
    }
  ],
  "resumo": "Breve descrição do que foi criado"
}

DESCRIÇÃO:
${descricao}`;

    try {
      const resposta = await this.chamarAPI([
        { role: 'user', content: prompt }
      ], 'llama3-70b-8192');

      indicador.remove();

      // Extrair JSON da resposta
      let json;
      try {
        const match = resposta.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('JSON não encontrado na resposta');
        json = JSON.parse(match[0]);
      } catch {
        this.adicionarMensagem('Não consegui interpretar a descrição. Tente ser mais específico com os nomes e relações.', 'erro');
        return;
      }

      if (!json.pessoas || !json.pessoas.length) {
        this.adicionarMensagem('Não encontrei pessoas na descrição. Tente descrever como: "João é pai de Maria e Carlos."', 'erro');
        return;
      }

      // Verificar se já existem dados e perguntar
      const existentes = Storage.getAll();
      if (existentes.length > 0) {
        const confirmacao = confirm(
          `Já existem ${existentes.length} pessoa(s) cadastrada(s).\n\n` +
          `Deseja SUBSTITUIR tudo pelos novos dados ou ADICIONAR às pessoas existentes?\n\n` +
          `OK = Substituir | Cancelar = Adicionar`
        );
        if (confirmacao) {
          Storage.save(json.pessoas);
        } else {
          // Remapear IDs para evitar conflitos
          const offset = Date.now();
          const mapaIds = {};
          json.pessoas.forEach((p, i) => {
            const novoId = 'p' + (offset + i);
            mapaIds[p.id] = novoId;
            p.id = novoId;
          });
          json.pessoas.forEach(p => {
            p.pai = p.pai ? (mapaIds[p.pai] || p.pai) : null;
            p.mae = p.mae ? (mapaIds[p.mae] || p.mae) : null;
            p.conjuges = (p.conjuges || []).map(c => mapaIds[c] || c);
            p.filhos = (p.filhos || []).map(f => mapaIds[f] || f);
          });
          const todas = [...existentes, ...json.pessoas];
          Storage.save(todas);
        }
      } else {
        Storage.save(json.pessoas);
      }

      // Atualizar interface
      Cadastro.atualizarSelects();
      Cadastro.renderizarLista();
      UI.atualizarDashboard();

      const resumo = json.resumo || `${json.pessoas.length} pessoas criadas com sucesso.`;
      this.adicionarMensagem(
        `✅ **Família gerada!** ${resumo}\n\n` +
        `👥 ${json.pessoas.length} pessoas adicionadas:\n` +
        json.pessoas.map(p => `• ${p.nome} ${p.sobrenome || ''} (${p.sexo === 'M' ? '♂' : p.sexo === 'F' ? '♀' : '◇'}${p.afetado ? ' · Afetado' : ''}${p.portador ? ' · Portador' : ''})`).join('\n') +
        `\n\nAcesse **Árvore Genealógica** ou **Heredograma** para visualizar.`,
        'assistente'
      );

    } catch (err) {
      indicador.remove();
      this.adicionarMensagem(`Erro ao gerar família: ${err.message}`, 'erro');
    }
  },

  async chamarAPI(mensagens, modelo = 'llama3-8b-8192') {
    const resposta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelo,
        messages: mensagens,
        temperature: 0.3,
        max_tokens: 2048
      })
    });

    if (!resposta.ok) {
      const erro = await resposta.json();
      throw new Error(erro.error?.message || `Erro HTTP ${resposta.status}`);
    }

    const data = await resposta.json();
    return data.choices[0]?.message?.content || '';
  },

  gerarContexto(pessoas) {
    if (!pessoas.length) return '';
    return pessoas.map(p => {
      const pai = p.pai ? pessoas.find(x => x.id === p.pai) : null;
      const mae = p.mae ? pessoas.find(x => x.id === p.mae) : null;
      const conjuges = (p.conjuges || []).map(c => pessoas.find(x => x.id === c)).filter(Boolean);
      const filhos = (p.filhos || []).map(f => pessoas.find(x => x.id === f)).filter(Boolean);
      return [
        `${p.nome} ${p.sobrenome || ''} (${p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Feminino' : 'Indefinido'})`,
        p.vivo === false ? 'Falecido' : null,
        p.afetado ? 'Afetado' : null,
        p.portador ? 'Portador' : null,
        pai ? `Pai: ${pai.nome} ${pai.sobrenome || ''}` : null,
        mae ? `Mãe: ${mae.nome} ${mae.sobrenome || ''}` : null,
        conjuges.length ? `Cônjuge(s): ${conjuges.map(c => `${c.nome} ${c.sobrenome || ''}`).join(', ')}` : null,
        filhos.length ? `Filhos: ${filhos.map(f => `${f.nome} ${f.sobrenome || ''}`).join(', ')}` : null,
        p.observacoes ? `Obs: ${p.observacoes}` : null,
      ].filter(Boolean).join(' | ');
    }).join('\n');
  },

  limparChat() {
    this.historico = [];
    const chat = document.getElementById('chat-mensagens');
    if (chat) chat.innerHTML = `
      <p class="chat-bem-vindo">
        🤖 Chat reiniciado. Como posso ajudar?
      </p>`;
  },

  adicionarMensagem(texto, tipo) {
    const chat = document.getElementById('chat-mensagens');
    if (!chat) return null;
    const div = document.createElement('div');
    div.className = `chat-msg chat-msg-${tipo}`;
    div.innerHTML = texto
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
  },

  adicionarIndicador() {
    const chat = document.getElementById('chat-mensagens');
    const div = document.createElement('div');
    div.className = 'chat-msg chat-msg-assistente chat-digitando';
    div.innerHTML = '<span></span><span></span><span></span>';
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
  }
};
