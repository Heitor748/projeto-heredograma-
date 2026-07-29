const Arvore = {
  canvas: null,
  ctx: null,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  dragging: false,
  lastX: 0,
  lastY: 0,
  nodes: [],
  imagens: {},

  W: 120,
  H: 80,
  HGAP: 160,
  VGAP: 130,

  init() {
    this.canvas = document.getElementById('canvas-arvore');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    this.bindEventos();
    this.renderizar();
  },

  resize() {
    if (!this.canvas) return;
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth || window.innerWidth - 240;
    this.canvas.height = container.clientHeight || 520;
  },

  bindEventos() {
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.scale = Math.min(3, Math.max(0.2, this.scale * delta));
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

    this.canvas.addEventListener('click', e => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - this.offsetX) / this.scale;
      const my = (e.clientY - rect.top - this.offsetY) / this.scale;
      const node = this.nodes.find(n =>
        mx >= n.x - this.W / 2 && mx <= n.x + this.W / 2 &&
        my >= n.y - this.H / 2 && my <= n.y + this.H / 2
      );
      if (node) UI.verPerfil(node.id);
    });

    document.getElementById('btn-zoom-in-arv')?.addEventListener('click', () => {
      this.scale = Math.min(3, this.scale * 1.2); this.desenhar();
    });
    document.getElementById('btn-zoom-out-arv')?.addEventListener('click', () => {
      this.scale = Math.max(0.2, this.scale * 0.8); this.desenhar();
    });
    document.getElementById('btn-centralizar-arv')?.addEventListener('click', () => this.centralizar());
    document.getElementById('btn-exportar-png-arv')?.addEventListener('click', () => this.exportarPNG());

    window.addEventListener('resize', () => { this.resize(); this.desenhar(); });
  },

  renderizar() {
    this.calcularLayout();
    this.preCarregarImagens(() => {
      this.centralizar();
    });
  },

  calcularLayout() {
    const pessoas = Storage.getAll();
    if (!pessoas.length) { this.nodes = []; return; }

    const raizes = pessoas.filter(p => !p.pai && !p.mae);
    if (!raizes.length) raizes.push(pessoas[0]);

    const geracoes = [];
    const visitados = new Set();
    const fila = raizes.map(r => ({ pessoa: r, gen: 0 }));

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

    pessoas.forEach(p => {
      if (!visitados.has(p.id)) {
        if (!geracoes[0]) geracoes[0] = [];
        geracoes[0].push(p);
      }
    });

    this.nodes = [];
    const maxGen = geracoes.filter(Boolean).length;
    const maxPorGen = Math.max(...geracoes.filter(Boolean).map(g => g.length));

    geracoes.forEach((gen, gi) => {
      if (!gen) return;
      const totalW = gen.length * this.HGAP;
      const startX = -totalW / 2 + this.HGAP / 2;
      gen.forEach((pessoa, pi) => {
        this.nodes.push({
          id: pessoa.id,
          pessoa,
          x: startX + pi * this.HGAP,
          y: gi * this.VGAP,
        });
      });
    });
  },

  preCarregarImagens(callback) {
    const promises = this.nodes
      .filter(n => n.pessoa.foto)
      .map(n => new Promise(resolve => {
        if (this.imagens[n.id]) return resolve();
        const img = new Image();
        img.onload = () => { this.imagens[n.id] = img; resolve(); };
        img.onerror = resolve;
        img.src = n.pessoa.foto;
      }));
    Promise.all(promises).then(callback);
  },

  centralizar() {
    if (!this.nodes.length) {
      this.offsetX = this.canvas.width / 2;
      this.offsetY = 60;
      this.scale = 1;
      this.desenhar();
      return;
    }
    const xs = this.nodes.map(n => n.x);
    const ys = this.nodes.map(n => n.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const largura = Math.max(...xs) - Math.min(...xs) + this.HGAP;
    const altura = Math.max(...ys) - Math.min(...ys) + this.VGAP;
    this.scale = Math.min(
      this.canvas.width / (largura + 60),
      this.canvas.height / (altura + 80),
      1.2
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

    const corLinha = isDark ? '#64748b' : '#cbd5e1';
    const corCartao = isDark ? '#1e293b' : '#ffffff';
    const corBorda = isDark ? '#334155' : '#e2e8f0';
    const corTexto = isDark ? '#f1f5f9' : '#1e293b';
    const corSub = isDark ? '#94a3b8' : '#64748b';

    const nodeMap = {};
    this.nodes.forEach(n => { nodeMap[n.id] = n; });

    // Linhas
    const casamentos = new Set();
    this.nodes.forEach(n => {
      (n.pessoa.conjuges || []).forEach(cid => {
        const chave = [n.id, cid].sort().join('-');
        if (casamentos.has(chave) || !nodeMap[cid]) return;
        casamentos.add(chave);
        const c = nodeMap[cid];
        ctx.beginPath();
        ctx.setLineDash([6, 3]);
        ctx.strokeStyle = isDark ? '#facc15' : '#ca8a04';
        ctx.lineWidth = 1.5;
        ctx.moveTo(n.x, n.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    });

    this.nodes.forEach(n => {
      const pai = n.pessoa.pai ? nodeMap[n.pessoa.pai] : null;
      const mae = n.pessoa.mae ? nodeMap[n.pessoa.mae] : null;
      if (pai || mae) {
        let ox = n.x;
        if (pai && mae) ox = (pai.x + mae.x) / 2;
        else if (pai) ox = pai.x;
        else ox = mae.x;
        const oy = (pai || mae).y + this.H / 2 + 8;

        ctx.beginPath();
        ctx.strokeStyle = corLinha;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox, n.y - this.H / 2 - 8);
        ctx.lineTo(n.x, n.y - this.H / 2 - 8);
        ctx.lineTo(n.x, n.y - this.H / 2);
        ctx.stroke();
      }
    });

    // Cartões
    this.nodes.forEach(n => {
      const { x, y, pessoa } = n;
      const w = this.W, h = this.H;
      const r = 10;

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.12)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;

      // Fundo cartão
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h / 2, w, h, r);
      ctx.fillStyle = corCartao;
      ctx.fill();
      ctx.strokeStyle = pessoa.afetado ? '#ef4444' : pessoa.portador ? '#f97316' : corBorda;
      ctx.lineWidth = pessoa.afetado || pessoa.portador ? 2.5 : 1.5;
      ctx.stroke();

      ctx.shadowColor = 'transparent';

      // Foto ou avatar
      const avatarSize = 38;
      const ax = x - w / 2 + 6;
      const ay = y - avatarSize / 2;

      if (this.imagens[n.id]) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(this.imagens[n.id], ax, ay, avatarSize, avatarSize);
        ctx.restore();
      } else {
        const cor = pessoa.sexo === 'M'
          ? (isDark ? '#3b82f6' : '#2563eb')
          : pessoa.sexo === 'F'
          ? (isDark ? '#ec4899' : '#db2777')
          : (isDark ? '#8b5cf6' : '#7c3aed');
        ctx.beginPath();
        ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = cor;
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 16px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((pessoa.nome || '?')[0].toUpperCase(), ax + avatarSize / 2, ay + avatarSize / 2);
      }

      // Texto
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      const tx = ax + avatarSize + 8;
      const maxW = w - avatarSize - 22;

      ctx.fillStyle = corTexto;
      ctx.font = `bold 11px system-ui`;
      ctx.fillText(this.truncar(pessoa.nome, maxW, ctx), tx, y - 8);

      ctx.fillStyle = corSub;
      ctx.font = `10px system-ui`;
      ctx.fillText(this.truncar(pessoa.sobrenome || '', maxW, ctx), tx, y + 6);

      // Tags
      const tags = [];
      if (pessoa.afetado) tags.push({ txt: 'Afetado', cor: '#ef4444' });
      if (pessoa.portador) tags.push({ txt: 'Portador', cor: '#f97316' });
      if (!pessoa.vivo) tags.push({ txt: 'Falecido', cor: '#64748b' });

      let tagX = x - w / 2 + 6;
      tags.slice(0, 2).forEach(t => {
        ctx.fillStyle = t.cor;
        ctx.font = 'bold 8px system-ui';
        const tw = ctx.measureText(t.txt).width + 8;
        ctx.beginPath();
        ctx.roundRect(tagX, y + 14, tw, 13, 3);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(t.txt, tagX + 4, y + 23);
        tagX += tw + 4;
      });

      ctx.restore();
    });

    ctx.restore();

    if (!this.nodes.length) {
      ctx.fillStyle = document.documentElement.getAttribute('data-tema') === 'escuro' ? '#64748b' : '#94a3b8';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Nenhum dado para exibir. Cadastre pessoas primeiro.', this.canvas.width / 2, this.canvas.height / 2);
    }
  },

  truncar(texto, maxW, ctx) {
    if (!texto) return '';
    if (ctx.measureText(texto).width <= maxW) return texto;
    let t = texto;
    while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  },

  exportarPNG() {
    const link = document.createElement('a');
    link.download = 'arvore_genealogica.png';
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }
};
