const Groq = {
  apiKey: '',
  historico: [],

  init() {
    const cfg = Storage.getConfig();
    this.apiKey = cfg.groqApiKey || '';

    document.getElementById('groq-api-key')?.addEventListener('change', e => {
      this.apiKey = e.target.value.trim();
      Storage.saveConfig({ ...Storage.getConfig(), groqApiKey: this.apiKey });
    });

    if (document.getElementById('groq-api-key')) {
      document.getElementById('groq-api-key').value = this.apiKey;
    }

    document.getElementById('form-chat')?.addEventListener('submit', e => {
      e.preventDefault();
      this.enviarMensagem();
    });

    document.getElementById('btn-limpar-chat')?.addEventListener('click', () => {
      this.historico = [];
      const chat = document.getElementById('chat-mensagens');
      if (chat) chat.innerHTML = '<p class="chat-bem-vindo">Olá! Pergunte sobre a árvore genealógica.</p>';
    });
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

    const pessoas = Storage.getAll();
    const contexto = this.gerarContexto(pessoas);

    this.historico.push({ role: 'user', content: msg });

    const indicador = this.adicionarIndicador();

    try {
      const resposta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192',
          messages: [
            {
              role: 'system',
              content: `Você é um assistente especialista em genealogia e genética.
Analise os dados da família e responda perguntas sobre relacionamentos, hereditariedade e árvore genealógica.
Responda sempre em português brasileiro, de forma clara e didática.

DADOS DA FAMÍLIA:
${contexto}`
            },
            ...this.historico
          ],
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (!resposta.ok) {
        const erro = await resposta.json();
        throw new Error(erro.error?.message || 'Erro na API');
      }

      const data = await resposta.json();
      const textoResposta = data.choices[0]?.message?.content || 'Sem resposta.';
      this.historico.push({ role: 'assistant', content: textoResposta });

      indicador.remove();
      this.adicionarMensagem(textoResposta, 'assistente');

    } catch (err) {
      indicador.remove();
      this.adicionarMensagem(`Erro: ${err.message}`, 'erro');
    }
  },

  gerarContexto(pessoas) {
    if (!pessoas.length) return 'Nenhuma pessoa cadastrada.';

    return pessoas.map(p => {
      const pai = p.pai ? pessoas.find(x => x.id === p.pai) : null;
      const mae = p.mae ? pessoas.find(x => x.id === p.mae) : null;
      const conjuges = (p.conjuges || []).map(c => pessoas.find(x => x.id === c)).filter(Boolean);
      const filhos = (p.filhos || []).map(f => pessoas.find(x => x.id === f)).filter(Boolean);

      return [
        `Nome: ${p.nome} ${p.sobrenome || ''}`,
        `Sexo: ${p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Feminino' : 'Indefinido'}`,
        p.dataNascimento ? `Nascimento: ${p.dataNascimento}` : null,
        `Status: ${p.vivo !== false ? 'Vivo' : 'Falecido'}`,
        p.afetado ? 'Condição: Afetado' : null,
        p.portador ? 'Condição: Portador' : null,
        pai ? `Pai: ${pai.nome} ${pai.sobrenome || ''}` : null,
        mae ? `Mãe: ${mae.nome} ${mae.sobrenome || ''}` : null,
        conjuges.length ? `Cônjuge(s): ${conjuges.map(c => `${c.nome} ${c.sobrenome || ''}`).join(', ')}` : null,
        filhos.length ? `Filhos: ${filhos.map(f => `${f.nome} ${f.sobrenome || ''}`).join(', ')}` : null,
        p.observacoes ? `Obs: ${p.observacoes}` : null,
      ].filter(Boolean).join(' | ');
    }).join('\n');
  },

  adicionarMensagem(texto, tipo) {
    const chat = document.getElementById('chat-mensagens');
    if (!chat) return null;

    const div = document.createElement('div');
    div.className = `chat-msg chat-msg-${tipo}`;

    // Formatar texto com quebras de linha e markdown básico
    const html = texto
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');

    div.innerHTML = html;
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
