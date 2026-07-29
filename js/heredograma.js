const Heredograma = {
  canvas: null,
  ctx: null,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  dragging: false,
  lastX: 0,
  lastY: 0,
  nodes: [],

  // Dimensões dos símbolos
  SIZE: 36,
  HGAP: 100,
  VGAP: 110,

  init() {
    this.canvas = document.getElementById('canvas-heredograma');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    this.bindEventos();
    this.renderizar();
  },

  resize() {
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight || 500;
  },

  bindEventos() {
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.scale = Math.min(3, Math.max(0.3, this.scale * delta));
      this.desenhar();
    }, { passive: false });

    this.canvas.addEventListener('mousedown', e => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });

    this.canvas.addEventListener('mousemove', e => {
      if (!this.dragging) return;
      this.offsetX += e.clientX - this.lastX;
      this.offsetY += e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.desenhar();
    });

    this.canvas.addEventListener('mouseup', () => { this.dragging = false; });
    this.canvas.addEventListener('mouseleave', () => { this.dragging = false; });

    // Touch
    this.canvas.addEventListener('touchstart', e => {
      this.dragging = true;
      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
    }, { passive: true });

    this.canvas.addEventListener('touchmove', e => {
      if (!this.dragging) return;
      this.offsetX += e.touches[0].clientX - this.lastX;
      this.offsetY += e.touches[0].clientY - this.lastY;
      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
      this.desenhar();
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => { this.dragging = false; });

    this.canvas.addEventListener('click', e => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - this.offsetX) / this.scale;
      const my = (e.clientY - rect.top - this.offsetY) / this.scale;
      const node = this.nodes.find(n => Math.abs(n.x - mx) < this.SIZE && Math.abs(n.y - my) < this.SIZE);
      if (node) UI.verPerfil(node.id);
    });

    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      this.scale = Math.min(3, this.scale * 1.2);
      this.desenhar();
    });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.scale = Math.max(0.3, this.scale * 0.8);
      this.desenhar();
    });
    document.getElementById('btn-centralizar-hg')?.addEventListener('click', () => this.centralizar());
    document.getElementById('btn-exportar-png')?.addEventListener('click', () => this.exportarPNG());

    window.addEventListener('resize', () => { this.resize(); this.desenhar(); });
  },

  renderizar() {
    this.calcularLayout();
    this.centralizar();
  },

  calcularLayout() {
    const pessoas = Storage.getAll();
    if (!pessoas.length) { this.nodes = []; this.desenhar(); return; }

    // Encontrar raízes (sem pais cadastrados)
    const temPai = new Set();
    pessoas.forEach(p => {
      if (p.pai) temPai.add(p.pai);
      if (p.mae) temPai.add(p.mae);
    });

    const raizes = pessoas.filter(p => !p.pai && !p.mae);
    if (!raizes.length) raizes.push(pessoas[0]);

    // Layout por geração (BFS)
    const geracoes = [];
    const visitados = new Set();
    const fila = [...raizes.map(r => ({ pessoa: r, gen: 0 }))];

    while (fila.length) {
      const { pessoa, gen } = fila.shift();
      if (visitados.has(pessoa.id)) continue;
      visitados.add(pessoa.id);

      if (!geracoes[gen]) geracoes[gen] = [];
      geracoes[gen].push(pessoa);

      (pessoa.filhos || []).forEach(fid => {
        const filho = pessoas.find(p => p.id === fid);
        if (filho && !visitados.has(filho.id)) fila.push({ pessoa: filho, gen: gen + 1 });
      });
    }

    // Adicionar pessoas não visitadas (sem ligação com raízes)
    pessoas.forEach(p => {
      if (!visitados.has(p.id)) {
        if (!geracoes[0]) geracoes[0] = [];
        geracoes[0].push(p);
      }
    });

    this.nodes = [];
    const larguraTotalPorGen = geracoes.map(g => g ? g.length * this.HGAP : 0);
    const maxLargura = Math.max(...larguraTotalPorGen);

    geracoes.forEach((gen, gi) => {
      if (!gen) return;
      const startX = (maxLargura - gen.length * this.HGAP) / 2 + this.HGAP / 2;
      gen.forEach((pessoa, pi) => {
        this.nodes.push({
          id: pessoa.id,
          pessoa,
          x: startX + pi * this.HGAP,
          y: gi * this.VGAP + this.SIZE,
        });
      });
    });
  },

  centralizar() {
    if (!this.nodes.length) {
      this.offsetX = this.canvas.width / 2;
      this.offsetY = 50;
      this.scale = 1;
      this.desenhar();
      return;
    }
    const xs = this.nodes.map(n => n.x);
    const ys = this.nodes.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const largura = maxX - minX + this.HGAP;
    const altura = maxY - minY + this.VGAP;
    this.scale = Math.min(
      this.canvas.width / (largura + 40),
      this.canvas.height / (altura + 40),
      1.5
    );
    this.offsetX = this.canvas.width / 2 - cx * this.scale;
    this.offsetY = this.canvas.height / 2 - cy * this.scale;
    this.desenhar();
  },

  desenhar() {
    const ctx = this.ctx;
    const isDark = document.documentElement.getAttribute('data-tema') === 'escuro';
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // Cores do tema
    const corLinha = isDark ? '#94a3b8' : '#475569';
    const corTexto = isDark ? '#e2e8f0' : '#1e293b';
    const corFundo = isDark ? '#1e293b' : '#ffffff';
    const corAfetado = isDark ? '#ef4444' : '#dc2626';
    const corPortador = isDark ? '#f97316' : '#ea580c';

    const nodeMap = {};
    this.nodes.forEach(n => { nodeMap[n.id] = n; });

    // 1. Desenhar linhas de casamento
    const casamentos = new Set();
    this.nodes.forEach(n => {
      (n.pessoa.conjuges || []).forEach(cid => {
        const chave = [n.id, cid].sort().join('-');
        if (casamentos.has(chave) || !nodeMap[cid]) return;
        casamentos.add(chave);
        const c = nodeMap[cid];
        ctx.beginPath();
        ctx.strokeStyle = corLinha;
        ctx.lineWidth = 2;
        ctx.moveTo(n.x, n.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();

        // Símbolo de casamento (||)
        const mx = (n.x + c.x) / 2, my = (n.y + c.y) / 2;
        ctx.beginPath();
        ctx.moveTo(mx - 4, my - 6); ctx.lineTo(mx - 4, my + 6);
        ctx.moveTo(mx + 4, my - 6); ctx.lineTo(mx + 4, my + 6);
        ctx.strokeStyle = isDark ? '#facc15' : '#ca8a04';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      });
    });

    // 2. Desenhar linhas filho → pais
    this.nodes.forEach(n => {
      const pai = n.pessoa.pai ? nodeMap[n.pessoa.pai] : null;
      const mae = n.pessoa.mae ? nodeMap[n.pessoa.mae] : null;

      if (pai || mae) {
        ctx.beginPath();
        ctx.strokeStyle = corLinha;
        ctx.lineWidth = 1.5;
        // Ponto de origem entre pais
        let origemX = n.x;
        if (pai && mae) origemX = (pai.x + mae.x) / 2;
        else if (pai) origemX = pai.x;
        else origemX = mae.x;
        const origemY = (pai || mae).y + this.SIZE + 4;

        ctx.moveTo(origemX, origemY);
        ctx.lineTo(origemX, n.y - this.SIZE - 4);
        ctx.lineTo(n.x, n.y - this.SIZE - 4);
        ctx.lineTo(n.x, n.y - this.SIZE);
        ctx.stroke();
      }
    });

    // 3. Desenhar símbolos
    this.nodes.forEach(n => {
      const { x, y, pessoa } = n;
      const s = this.SIZE;
      ctx.save();

      // Sombra suave
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;

      ctx.lineWidth = 2.5;

      let corBorda = isDark ? '#94a3b8' : '#475569';
      let corPreench = corFundo;

      if (pessoa.afetado) { corBorda = corAfetado; corPreench = corAfetado; }
      else if (pessoa.portador) { corBorda = corPortador; }

      ctx.strokeStyle = corBorda;
      ctx.fillStyle = corPreench;

      if (pessoa.sexo === 'M') {
        // Quadrado
        ctx.beginPath();
        ctx.rect(x - s / 2, y - s / 2, s, s);
        ctx.fill();
        ctx.stroke();

        if (pessoa.portador) {
          // Meio preenchido (triângulo inferior)
          ctx.fillStyle = corPortador;
          ctx.beginPath();
          ctx.moveTo(x - s / 2, y + s / 2);
          ctx.lineTo(x + s / 2, y + s / 2);
          ctx.lineTo(x, y);
          ctx.closePath();
          ctx.fill();
        }
      } else if (pessoa.sexo === 'F') {
        // Círculo
        ctx.beginPath();
        ctx.arc(x, y, s / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (pessoa.portador) {
          ctx.fillStyle = corPortador;
          ctx.beginPath();
          ctx.arc(x, y, s / 2, 0, Math.PI);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // Losango (sexo desconhecido)
        ctx.beginPath();
        ctx.moveTo(x, y - s / 2);
        ctx.lineTo(x + s / 2, y);
        ctx.lineTo(x, y + s / 2);
        ctx.lineTo(x - s / 2, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.shadowColor = 'transparent';

      // Traço diagonal se falecido
      if (!pessoa.vivo) {
        ctx.strokeStyle = isDark ? '#f87171' : '#b91c1c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - s / 2 - 5, y + s / 2 + 5);
        ctx.lineTo(x + s / 2 + 5, y - s / 2 - 5);
        ctx.stroke();
      }

      // Nome abaixo
      ctx.fillStyle = corTexto;
      ctx.font = `bold ${Math.max(9, 11 * this.scale > 1 ? 11 : 9)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(pessoa.nome, x, y + s / 2 + 14);
      if (pessoa.sobrenome) {
        ctx.font = `${Math.max(8, 9 * this.scale > 1 ? 9 : 8)}px system-ui, sans-serif`;
        ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
        ctx.fillText(pessoa.sobrenome, x, y + s / 2 + 25);
      }

      ctx.restore();
    });

    ctx.restore();

    if (!this.nodes.length) {
      ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Nenhum dado para exibir. Cadastre pessoas primeiro.', this.canvas.width / 2, this.canvas.height / 2);
    }
  },

  exportarPNG() {
    const link = document.createElement('a');
    link.download = 'heredograma.png';
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }
};
