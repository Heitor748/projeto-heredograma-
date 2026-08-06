const Arvore = {
  canvas: null, ctx: null,
  scale: 1, offsetX: 0, offsetY: 0,
  dragging: false, lastX: 0, lastY: 0,
  nodes: [], imagens: {}, _geracao: {},

  W: 130, H: 76,
  COUPLE_SEP: 150,  // gap entre cônjuges (centro a centro)
  FAMILY_GAP: 180,  // gap entre famílias
  VGAP: 140,

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
    const c = this.canvas.parentElement;
    const sidebarW = window.innerWidth > 680 ? 240 : 0;
    const dpr  = window.devicePixelRatio || 1;
    const cssW = c.clientWidth  || window.innerWidth - sidebarW;
    const cssH = c.clientHeight || Math.max(window.innerHeight - 200, 280);
    this._dpr  = dpr;
    this._cssW = cssW;
    this._cssH = cssH;
    this.canvas.width  = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width  = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
  },

  bindEventos() {
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.scale = Math.min(3, Math.max(0.2, this.scale * (e.deltaY > 0 ? 0.9 : 1.1)));
      this.desenhar();
    }, { passive: false });

    this.canvas.addEventListener('mousedown', e => { this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY; });
    this.canvas.addEventListener('mousemove', e => {
      if (!this.dragging) return;
      this.offsetX += e.clientX - this.lastX; this.offsetY += e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY; this.desenhar();
    });
    this.canvas.addEventListener('mouseup',    () => { this.dragging = false; });
    this.canvas.addEventListener('mouseleave', () => { this.dragging = false; });

    this.canvas.addEventListener('touchstart', e => {
      this.dragging = true; this.lastX = e.touches[0].clientX; this.lastY = e.touches[0].clientY;
    }, { passive: true });
    this.canvas.addEventListener('touchmove', e => {
      if (!this.dragging) return;
      this.offsetX += e.touches[0].clientX - this.lastX; this.offsetY += e.touches[0].clientY - this.lastY;
      this.lastX = e.touches[0].clientX; this.lastY = e.touches[0].clientY; this.desenhar();
    }, { passive: true });
    this.canvas.addEventListener('touchend', () => { this.dragging = false; });

    this.canvas.addEventListener('click', e => {
      const r = this.canvas.getBoundingClientRect();
      const mx = (e.clientX - r.left - this.offsetX) / this.scale;
      const my = (e.clientY - r.top  - this.offsetY) / this.scale;
      const n = this.nodes.find(n =>
        mx >= n.x - this.W/2 && mx <= n.x + this.W/2 &&
        my >= n.y - this.H/2 && my <= n.y + this.H/2
      );
      if (n) UI.verPerfil(n.id);
    });

    document.getElementById('btn-zoom-in-arv')?.addEventListener('click', () => { this.scale = Math.min(3, this.scale * 1.2); this.desenhar(); });
    document.getElementById('btn-zoom-out-arv')?.addEventListener('click', () => { this.scale = Math.max(0.2, this.scale * 0.8); this.desenhar(); });
    document.getElementById('btn-centralizar-arv')?.addEventListener('click', () => this.centralizar());
    document.getElementById('btn-exportar-png-arv')?.addEventListener('click', () => this.exportarPNG());
    document.getElementById('btn-imprimir-arv')?.addEventListener('click', () => this.imprimir());
    window.addEventListener('resize', () => { this.resize(); this.desenhar(); });
  },

  renderizar() {
    this.calcularLayout();
    this.preCarregarImagens(() => this.centralizar());
  },

  calcularLayout() {
    const pessoas = Storage.getAll();
    if (!pessoas.length) { this.nodes = []; this._geracao = {}; return; }

    const byId = {};
    pessoas.forEach(p => { byId[p.id] = p; });

    // Passo 1: geração via BFS
    const geracao = {};
    const raizes = pessoas.filter(p => !p.pai && !p.mae);
    if (!raizes.length) raizes.push(pessoas[0]);

    const fila = raizes.map(r => ({ id: r.id, g: 0 }));
    const visitados = new Set();

    while (fila.length) {
      const { id, g } = fila.shift();
      if (visitados.has(id)) continue;
      visitados.add(id);
      geracao[id] = geracao[id] !== undefined ? Math.max(geracao[id], g) : g;
      const p = byId[id];
      if (!p) continue;
      (p.conjuges || []).forEach(cid => {
        if (!visitados.has(cid)) {
          geracao[cid] = geracao[cid] !== undefined ? Math.max(geracao[cid], g) : g;
          fila.push({ id: cid, g });
        }
      });
      (p.filhos || []).forEach(fid => {
        const ng = g + 1;
        if (!visitados.has(fid)) {
          geracao[fid] = geracao[fid] !== undefined ? Math.max(geracao[fid], ng) : ng;
          fila.push({ id: fid, g: ng });
        }
      });
    }
    pessoas.forEach(p => { if (geracao[p.id] === undefined) geracao[p.id] = 0; });

    // Normalizar: cônjuges devem estar na mesma geração
    let normalizar = true;
    while (normalizar) {
      normalizar = false;
      pessoas.forEach(p => {
        (p.conjuges || []).forEach(cid => {
          if (geracao[cid] !== undefined && geracao[p.id] !== undefined) {
            const maxG = Math.max(geracao[p.id], geracao[cid]);
            if (geracao[p.id] < maxG) { geracao[p.id] = maxG; normalizar = true; }
            if (geracao[cid] < maxG) { geracao[cid] = maxG; normalizar = true; }
          }
        });
      });
    }
    // Garantir que filhos sejam sempre geração > geração dos pais
    normalizar = true;
    while (normalizar) {
      normalizar = false;
      pessoas.forEach(p => {
        const gPai = p.pai && geracao[p.pai] !== undefined ? geracao[p.pai] : -1;
        const gMae = p.mae && geracao[p.mae] !== undefined ? geracao[p.mae] : -1;
        const minEsp = Math.max(gPai, gMae) + 1;
        if ((gPai >= 0 || gMae >= 0) && geracao[p.id] < minEsp) {
          geracao[p.id] = minEsp; normalizar = true;
        }
      });
    }

    this._geracao = geracao;

    const maxG = Math.max(...Object.values(geracao));

    // Passo 2: agrupar cônjuges e posicionar X
    const xPos = {};
    for (let g = 0; g <= maxG; g++) {
      const membros = pessoas.filter(p => geracao[p.id] === g);
      const usados = new Set();
      const unidades = [];

      membros.forEach(p => {
        if (usados.has(p.id)) return;
        usados.add(p.id);
        const conj = (p.conjuges || [])
          .map(cid => byId[cid])
          .find(c => c && geracao[c.id] === g && !usados.has(c.id));
        if (conj) {
          usados.add(conj.id);
          // Convenção: homem (quadrado) à esquerda, mulher (círculo) à direita
          const par = (p.sexo === 'F' && conj.sexo !== 'F') ? [conj, p] : [p, conj];
          unidades.push(par);
        } else unidades.push([p]);
      });

      // Ordenar unidades pela posição X média dos pais (todos os membros com pais).
      // Casais de famílias diferentes ficam no centro entre as duas famílias.
      // Tiebreaker: solteiro (len=1) antes de casal (len=2) quando a chave empata.
      if (g > 0) {
        const parentXDe = p => {
          const xs = [];
          if (p.pai && xPos[p.pai] !== undefined) xs.push(xPos[p.pai]);
          if (p.mae && xPos[p.mae] !== undefined) xs.push(xPos[p.mae]);
          return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
        };
        const chaveUnidade = u => {
          const xs = [];
          u.forEach(p => { const x = parentXDe(p); if (x !== null) xs.push(x); });
          return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
        };
        unidades.sort((ua, ub) => {
          const xa = chaveUnidade(ua), xb = chaveUnidade(ub);
          if (xa === null && xb === null) return ua.length - ub.length;
          if (xa === null) return 1;
          if (xb === null) return -1;
          if (Math.abs(xa - xb) > 0.001) return xa - xb;
          return ua.length - ub.length;
        });
      }

      let x = 0;
      const local = {};
      unidades.forEach((u, i) => {
        if (i > 0) x += this.FAMILY_GAP;
        if (u.length === 2) {
          local[u[0].id] = x;
          local[u[1].id] = x + this.COUPLE_SEP;
          x += this.COUPLE_SEP;
        } else {
          local[u[0].id] = x;
        }
      });

      const shift = -x / 2;
      Object.entries(local).forEach(([id, px]) => { xPos[id] = px + shift; });
    }

    this.nodes = pessoas.map(p => ({
      id: p.id, pessoa: p,
      x: xPos[p.id] ?? 0,
      y: geracao[p.id] * this.VGAP,
    }));
  },

  preCarregarImagens(callback) {
    const promises = this.nodes
      .filter(n => n.pessoa.foto)
      .map(n => new Promise(res => {
        if (this.imagens[n.id]) return res();
        const img = new Image();
        img.onload  = () => { this.imagens[n.id] = img; res(); };
        img.onerror = res;
        img.src = n.pessoa.foto;
      }));
    Promise.all(promises).then(callback);
  },

  centralizar() {
    if (!this.canvas) return;
    const cssW = this._cssW || this.canvas.width;
    const cssH = this._cssH || this.canvas.height;
    if (!this.nodes.length) {
      this.offsetX = cssW / 2; this.offsetY = 60; this.scale = 1;
      this.desenhar(); return;
    }
    const xs = this.nodes.map(n => n.x), ys = this.nodes.map(n => n.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const larg = Math.max(...xs) - Math.min(...xs) + this.FAMILY_GAP + this.W;
    const alt  = Math.max(...ys) - Math.min(...ys) + this.VGAP + this.H;
    this.scale = Math.min(cssW / (larg + 80), cssH / (alt + 80), 1.3);
    this.offsetX = cssW / 2 - cx * this.scale;
    this.offsetY = cssH / 2 - cy * this.scale;
    this.desenhar();
  },

  desenhar() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const dpr  = this._dpr  || window.devicePixelRatio || 1;
    const cssW = this._cssW || this.canvas.width / dpr;
    const cssH = this._cssH || this.canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dark = document.documentElement.getAttribute('data-tema') === 'escuro';
    ctx.clearRect(0, 0, cssW, cssH);

    if (!this.nodes.length) {
      ctx.fillStyle = dark ? '#475569' : '#94a3b8';
      ctx.font = '15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Cadastre pessoas para visualizar a árvore.', cssW / 2, cssH / 2);
      return;
    }

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    const COR = {
      linha:     dark ? '#475569' : '#cbd5e1',
      casamento: dark ? '#fbbf24' : '#b45309',
      cartao:    dark ? '#1e293b' : '#ffffff',
      borda:     dark ? '#334155' : '#e2e8f0',
      texto:     dark ? '#f1f5f9' : '#1e293b',
      sub:       dark ? '#94a3b8' : '#64748b',
      label:     dark ? '#334155' : '#e2e8f0',
    };

    const nodeMap = {};
    this.nodes.forEach(n => { nodeMap[n.id] = n; });

    // ── 1. Rótulos de geração ──
    const algar = ['I','II','III','IV','V','VI','VII','VIII'];
    const xMin = Math.min(...this.nodes.map(n => n.x));
    const xLabel = xMin - this.W / 2 - 20;
    const geracoesUsadas = [...new Set(Object.values(this._geracao))].sort((a, b) => a - b);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.font = 'bold 13px system-ui';
    geracoesUsadas.forEach(g => {
      const y = this.nodes.find(n => this._geracao[n.id] === g)?.y;
      if (y === undefined) return;
      ctx.fillStyle = COR.label;
      ctx.fillText(algar[g] || `G${g+1}`, xLabel, y);
    });

    // ── 2. Linhas de casamento ──
    const casamentos = new Set();
    this.nodes.forEach(n => {
      (n.pessoa.conjuges || []).forEach(cid => {
        const chave = [n.id, cid].sort().join('-');
        if (casamentos.has(chave) || !nodeMap[cid]) return;
        casamentos.add(chave);
        const c = nodeMap[cid];
        const x1 = Math.min(n.x, c.x) + this.W / 2 + 2;
        const x2 = Math.max(n.x, c.x) - this.W / 2 - 2;
        const y  = (n.y + c.y) / 2;
        ctx.beginPath();
        ctx.setLineDash([6, 4]); ctx.strokeStyle = COR.casamento; ctx.lineWidth = 2;
        ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
        ctx.setLineDash([]);
        // coração no centro
        const mx = (x1 + x2) / 2;
        ctx.fillStyle = COR.casamento; ctx.font = '11px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('♥', mx, y);
      });
    });

    // ── 3. Linhas pais → filhos ──
    const familias = new Map();
    this.nodes.forEach(n => {
      const pai = n.pessoa.pai ? nodeMap[n.pessoa.pai] : null;
      const mae = n.pessoa.mae ? nodeMap[n.pessoa.mae] : null;
      if (!pai && !mae) return;
      const key = `${n.pessoa.pai||''}_${n.pessoa.mae||''}`;
      if (!familias.has(key)) familias.set(key, { pai, mae, filhos: [] });
      familias.get(key).filhos.push(n);
    });

    familias.forEach(({ pai, mae, filhos }) => {
      let origemX;
      if (pai && mae) origemX = (pai.x + mae.x) / 2;
      else origemX = (pai || mae).x;

      const origemY = (pai || mae).y + this.H / 2 + 4;
      const barY    = filhos[0].y - this.H / 2 - 20;

      ctx.beginPath();
      ctx.strokeStyle = COR.linha; ctx.lineWidth = 1.5; ctx.setLineDash([]);

      if (filhos.length === 1) {
        ctx.moveTo(origemX, origemY);
        ctx.lineTo(origemX, barY);
        ctx.lineTo(filhos[0].x, barY);
        ctx.lineTo(filhos[0].x, filhos[0].y - this.H / 2 - 2);
      } else {
        const xs = filhos.map(f => f.x);
        const xEsq = Math.min(origemX, ...xs);
        const xDir = Math.max(origemX, ...xs);
        ctx.moveTo(origemX, origemY);
        ctx.lineTo(origemX, barY);
        ctx.moveTo(xEsq, barY); ctx.lineTo(xDir, barY);
        filhos.forEach(f => {
          ctx.moveTo(f.x, barY);
          ctx.lineTo(f.x, f.y - this.H / 2 - 2);
        });
      }
      ctx.stroke();
    });

    // ── 4. Cartões ──
    this.nodes.forEach(n => {
      const { x, y, pessoa } = n;
      const w = this.W, h = this.H, r = 8;

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;

      // Fundo
      ctx.beginPath();
      ctx.roundRect(x - w/2, y - h/2, w, h, r);
      ctx.fillStyle = COR.cartao; ctx.fill();
      ctx.strokeStyle = pessoa.afetado ? '#ef4444' : pessoa.portador ? '#f97316' : COR.borda;
      ctx.lineWidth = pessoa.afetado || pessoa.portador ? 2.5 : 1.5;
      ctx.stroke();
      ctx.shadowColor = 'transparent';

      // Avatar
      const av = 36, ax = x - w/2 + 8, ay = y - av/2;
      const cor = pessoa.sexo === 'M' ? (dark ? '#3b82f6' : '#2563eb')
                : pessoa.sexo === 'F' ? (dark ? '#ec4899' : '#db2777')
                : (dark ? '#8b5cf6' : '#7c3aed');

      if (this.imagens[n.id]) {
        ctx.save();
        ctx.beginPath(); ctx.arc(ax + av/2, ay + av/2, av/2, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(this.imagens[n.id], ax, ay, av, av);
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(ax + av/2, ay + av/2, av/2, 0, Math.PI * 2);
        ctx.fillStyle = cor; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((pessoa.nome || '?')[0].toUpperCase(), ax + av/2, ay + av/2);
      }

      // Texto
      const tx = ax + av + 8, maxW = w - av - 24;
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      ctx.fillStyle = COR.texto; ctx.font = 'bold 11px system-ui';
      ctx.fillText(this.truncar(pessoa.nome || '', maxW, ctx), tx, y - 10);
      ctx.fillStyle = COR.sub; ctx.font = '10px system-ui';
      ctx.fillText(this.truncar(pessoa.sobrenome || '', maxW, ctx), tx, y + 4);

      // Ano de nascimento
      if (pessoa.dataNascimento) {
        ctx.font = '9px system-ui'; ctx.fillStyle = COR.sub;
        ctx.fillText(new Date(pessoa.dataNascimento).getFullYear(), tx, y + 17);
      }

      // Tags (falecido, afetado, portador)
      let tagX = x - w/2 + 6;
      const tags = [];
      if (pessoa.afetado)      tags.push({ t: 'Afetado',  c: '#ef4444' });
      if (pessoa.portador)     tags.push({ t: 'Portador', c: '#f97316' });
      if (pessoa.vivo === false) tags.push({ t: 'Falecido', c: '#64748b' });

      ctx.font = 'bold 8px system-ui';
      tags.slice(0, 2).forEach(({ t, c }) => {
        const tw = ctx.measureText(t).width + 8;
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.roundRect(tagX, y + h/2 - 15, tw, 12, 3); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(t, tagX + 4, y + h/2 - 6);
        tagX += tw + 3;
      });

      ctx.restore();
    });

    ctx.restore();
  },

  truncar(texto, maxW, ctx) {
    if (!texto || ctx.measureText(texto).width <= maxW) return texto;
    let t = texto;
    while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  },

  _canvasComFundo() {
    const temp = document.createElement('canvas');
    temp.width  = this.canvas.width;
    temp.height = this.canvas.height;
    const tCtx = temp.getContext('2d');
    tCtx.fillStyle = '#ffffff';
    tCtx.fillRect(0, 0, temp.width, temp.height);
    tCtx.drawImage(this.canvas, 0, 0);
    return temp;
  },

  exportarPNG() {
    const a = document.createElement('a');
    a.download = 'arvore_genealogica.png';
    a.href = this._canvasComFundo().toDataURL('image/png');
    a.click();
  },

  imprimir() {
    const dataUrl = this._canvasComFundo().toDataURL('image/png');
    const itensLegenda = [
      ['■','Afetado'],['□','Portador'],['—♥—','Cônjuges']
    ];
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para imprimir.'); return; }
    win.document.write(_htmlImpressao('🌳 Árvore Genealógica', dataUrl, itensLegenda));
    win.document.close();
  }
};
