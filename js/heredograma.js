const Heredograma = {
  canvas: null, ctx: null,
  scale: 1, offsetX: 0, offsetY: 0,
  dragging: false, lastX: 0, lastY: 0,
  nodes: [], _geracao: {},

  SIZE: 26,
  COUPLE_SEP: 68,   // distância horizontal entre cônjuges
  FAMILY_GAP: 110,  // gap entre famílias na mesma geração
  VGAP: 130,

  init() {
    this.canvas = document.getElementById('canvas-heredograma');
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

  _agendarDesenho() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = null; this.desenhar(); });
  },

  bindEventos() {
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.scale = Math.min(3, Math.max(0.2, this.scale * (e.deltaY > 0 ? 0.9 : 1.1)));
      this._agendarDesenho();
    }, { passive: false });

    this.canvas.addEventListener('mousedown', e => { this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY; });
    this.canvas.addEventListener('mousemove', e => {
      if (!this.dragging) return;
      this.offsetX += e.clientX - this.lastX; this.offsetY += e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY; this._agendarDesenho();
    });
    this.canvas.addEventListener('mouseup',    () => { this.dragging = false; });
    this.canvas.addEventListener('mouseleave', () => { this.dragging = false; });

    this.canvas.addEventListener('touchstart', e => {
      this.dragging = true; this.lastX = e.touches[0].clientX; this.lastY = e.touches[0].clientY;
    }, { passive: true });
    this.canvas.addEventListener('touchmove', e => {
      if (!this.dragging) return;
      e.preventDefault();
      this.offsetX += e.touches[0].clientX - this.lastX; this.offsetY += e.touches[0].clientY - this.lastY;
      this.lastX = e.touches[0].clientX; this.lastY = e.touches[0].clientY; this._agendarDesenho();
    }, { passive: false });
    this.canvas.addEventListener('touchend', () => { this.dragging = false; });

    this.canvas.addEventListener('click', e => {
      const r = this.canvas.getBoundingClientRect();
      const mx = (e.clientX - r.left - this.offsetX) / this.scale;
      const my = (e.clientY - r.top  - this.offsetY) / this.scale;
      const n = this.nodes.find(n => Math.abs(n.x - mx) < this.SIZE && Math.abs(n.y - my) < this.SIZE);
      if (n) UI.verPerfil(n.id);
    });

    document.getElementById('btn-zoom-in')?.addEventListener('click', () => { this.scale = Math.min(3, this.scale * 1.2); this.desenhar(); });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => { this.scale = Math.max(0.2, this.scale * 0.8); this.desenhar(); });
    document.getElementById('btn-centralizar-hg')?.addEventListener('click', () => this.centralizar());
    document.getElementById('btn-exportar-png')?.addEventListener('click', () => this.exportarPNG());
    document.getElementById('btn-imprimir-hg')?.addEventListener('click', () => this.imprimir());
    window.addEventListener('resize', () => { this.resize(); this.desenhar(); });
  },

  renderizar() { this.calcularLayout(); this.centralizar(); },

  calcularLayout() {
    const pessoas = Storage.getAll();
    if (!pessoas.length) { this.nodes = []; this._geracao = {}; this.desenhar(); return; }

    const byId = {};
    pessoas.forEach(p => { byId[p.id] = p; });

    // Passo 1: calcular geração via BFS
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
      // Cônjuges ficam na mesma geração
      (p.conjuges || []).forEach(cid => {
        if (!visitados.has(cid)) {
          geracao[cid] = geracao[cid] !== undefined ? Math.max(geracao[cid], g) : g;
          fila.push({ id: cid, g });
        }
      });
      // Filhos: geração + 1
      (p.filhos || []).forEach(fid => {
        const ng = g + 1;
        if (!visitados.has(fid)) {
          geracao[fid] = geracao[fid] !== undefined ? Math.max(geracao[fid], ng) : ng;
          fila.push({ id: fid, g: ng });
        }
      });
    }
    pessoas.forEach(p => { if (geracao[p.id] === undefined) geracao[p.id] = 0; });

    // Normalizar cônjuges (mesma geração) e filhos (> pais) num único loop
    // até estabilizar — evita que um cônjuge adicionado após o filho ser
    // promovido fique preso na geração antiga.
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

    // Passo 2: layout ancorado — cada unidade posicionada perto da média X
    // dos pais dos seus membros, empurrada para direita quando colidir.
    const xPos = {};
    for (let g = 0; g <= maxG; g++) {
      const membros = pessoas.filter(p => geracao[p.id] === g);
      const usados = new Set();
      const unidades = [];

      const ordemMembros = [...membros];
      ordemMembros.sort((a, b) => {
        const ka = (a.pai || '') + '_' + (a.mae || '');
        const kb = (b.pai || '') + '_' + (b.mae || '');
        return ka.localeCompare(kb);
      });

      for (const p of ordemMembros) {
        if (usados.has(p.id)) continue;
        usados.add(p.id);
        const conj = (p.conjuges || [])
          .map(cid => byId[cid])
          .find(c => c && geracao[c.id] === g && !usados.has(c.id));
        if (conj) {
          usados.add(conj.id);
          const par = (p.sexo === 'F' && conj.sexo !== 'F') ? [conj, p] : [p, conj];
          unidades.push({ membros: par });
        } else {
          unidades.push({ membros: [p] });
        }
      }

      unidades.forEach(u => {
        const xs = [];
        u.membros.forEach(p => {
          if (p.pai && xPos[p.pai] !== undefined) xs.push(xPos[p.pai]);
          if (p.mae && xPos[p.mae] !== undefined) xs.push(xPos[p.mae]);
        });
        u.ancora = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
        u.meia = u.membros.length === 2 ? this.COUPLE_SEP / 2 : 0;
      });

      unidades.sort((ua, ub) => {
        if (ua.ancora === null && ub.ancora === null) return 0;
        if (ua.ancora === null) return 1;
        if (ub.ancora === null) return -1;
        if (Math.abs(ua.ancora - ub.ancora) > 0.001) return ua.ancora - ub.ancora;
        return ua.membros.length - ub.membros.length;
      });

      let cursor = -Infinity;
      unidades.forEach(u => {
        const minCentro = cursor + this.FAMILY_GAP + u.meia;
        const ideal = u.ancora !== null ? u.ancora : (cursor === -Infinity ? 0 : minCentro);
        u.centro = Math.max(ideal, minCentro);
        cursor = u.centro + u.meia;
      });

      unidades.forEach(u => {
        if (u.membros.length === 2) {
          xPos[u.membros[0].id] = u.centro - this.COUPLE_SEP / 2;
          xPos[u.membros[1].id] = u.centro + this.COUPLE_SEP / 2;
        } else {
          xPos[u.membros[0].id] = u.centro;
        }
      });
    }

    // Centralização global mantendo alinhamento vertical entre gerações
    const todosX = Object.values(xPos);
    if (todosX.length) {
      const shift = -(Math.min(...todosX) + Math.max(...todosX)) / 2;
      Object.keys(xPos).forEach(id => { xPos[id] += shift; });
    }

    this.nodes = pessoas.map(p => ({
      id: p.id, pessoa: p,
      x: xPos[p.id] ?? 0,
      y: geracao[p.id] * this.VGAP + this.SIZE * 2.5,
    }));
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
    const larg = Math.max(...xs) - Math.min(...xs) + this.FAMILY_GAP * 2;
    const alt  = Math.max(...ys) - Math.min(...ys) + this.VGAP * 2;
    this.scale = Math.min(cssW / (larg + 60), cssH / (alt + 80), 1.4);
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
      ctx.fillText('Cadastre pessoas para visualizar o heredograma.', cssW / 2, cssH / 2);
      return;
    }

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    const COR = {
      linha:     dark ? '#64748b' : '#94a3b8',
      casamento: dark ? '#fbbf24' : '#b45309',
      texto:     dark ? '#e2e8f0' : '#1e293b',
      sub:       dark ? '#94a3b8' : '#64748b',
      fundo:     dark ? '#1e293b' : '#ffffff',
      afetado:   '#dc2626',
      portador:  '#ea580c',
      label:     dark ? '#334155' : '#cbd5e1',
    };

    const nodeMap = {};
    this.nodes.forEach(n => { nodeMap[n.id] = n; });
    const S = this.SIZE;

    // ── 1. Rótulos de geração (I, II, III…) ──
    const algar = ['I','II','III','IV','V','VI','VII','VIII'];
    const xMin = Math.min(...this.nodes.map(n => n.x));
    const xLabel = xMin - this.FAMILY_GAP * 0.6;
    const geracoesUsadas = [...new Set(Object.values(this._geracao))].sort((a, b) => a - b);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px system-ui';
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
        const x1 = Math.min(n.x, c.x) + S / 2 + 1;
        const x2 = Math.max(n.x, c.x) - S / 2 - 1;
        const y  = (n.y + c.y) / 2;
        // Linha horizontal entre cônjuges
        ctx.beginPath();
        ctx.strokeStyle = COR.casamento; ctx.lineWidth = 2;
        ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
        // Duplo traço central (símbolo de casamento)
        const mx = (x1 + x2) / 2;
        ctx.beginPath();
        ctx.moveTo(mx - 4, y - 7); ctx.lineTo(mx - 4, y + 7);
        ctx.moveTo(mx + 4, y - 7); ctx.lineTo(mx + 4, y + 7);
        ctx.lineWidth = 2.5; ctx.stroke();
      });
    });

    // ── 3. Linhas pais → filhos (ortogonais com barra de irmãos) ──
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

      const origemY = (pai || mae).y + S / 2 + 3;
      const barY    = filhos[0].y - S / 2 - 20; // barra de irmãos

      ctx.beginPath();
      ctx.strokeStyle = COR.linha; ctx.lineWidth = 1.5; ctx.setLineDash([]);

      if (filhos.length === 1) {
        // Filho único: linha em L
        const fx = filhos[0].x, fy = filhos[0].y - S / 2 - 2;
        ctx.moveTo(origemX, origemY);
        ctx.lineTo(origemX, barY);
        ctx.lineTo(fx, barY);
        ctx.lineTo(fx, fy);
      } else {
        // Vários filhos: drop + barra horizontal + ramos
        const xs = filhos.map(f => f.x);
        const xEsq = Math.min(origemX, ...xs);
        const xDir = Math.max(origemX, ...xs);
        ctx.moveTo(origemX, origemY);
        ctx.lineTo(origemX, barY);
        ctx.moveTo(xEsq, barY); ctx.lineTo(xDir, barY);
        filhos.forEach(f => {
          ctx.moveTo(f.x, barY);
          ctx.lineTo(f.x, f.y - S / 2 - 2);
        });
      }
      ctx.stroke();
    });

    // ── 4. Símbolos genéticos ──
    this.nodes.forEach(n => {
      const { x, y, pessoa } = n;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;

      let corBorda = dark ? '#94a3b8' : '#475569';
      let corPreench = COR.fundo;
      if (pessoa.afetado)  { corBorda = COR.afetado;  corPreench = COR.afetado; }
      else if (pessoa.portador) { corBorda = COR.portador; }

      ctx.strokeStyle = corBorda; ctx.fillStyle = corPreench; ctx.lineWidth = 2;

      if (pessoa.sexo === 'M') {
        ctx.beginPath(); ctx.rect(x - S/2, y - S/2, S, S); ctx.fill(); ctx.stroke();
        if (pessoa.portador) {
          ctx.fillStyle = COR.portador; ctx.beginPath();
          ctx.moveTo(x - S/2, y + S/2); ctx.lineTo(x + S/2, y + S/2); ctx.lineTo(x, y);
          ctx.closePath(); ctx.fill();
        }
      } else if (pessoa.sexo === 'F') {
        ctx.beginPath(); ctx.arc(x, y, S/2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (pessoa.portador) {
          ctx.fillStyle = COR.portador; ctx.beginPath();
          ctx.arc(x, y, S/2, 0, Math.PI); ctx.closePath(); ctx.fill();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(x, y - S/2); ctx.lineTo(x + S/2, y);
        ctx.lineTo(x, y + S/2); ctx.lineTo(x - S/2, y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }

      ctx.shadowColor = 'transparent';

      // Traço diagonal = falecido
      if (pessoa.vivo === false) {
        ctx.strokeStyle = dark ? '#f87171' : '#b91c1c'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - S/2 - 4, y + S/2 + 4);
        ctx.lineTo(x + S/2 + 4, y - S/2 - 4);
        ctx.stroke();
      }

      // Nome
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = COR.texto; ctx.font = `bold 10px system-ui`;
      ctx.fillText(pessoa.nome || '?', x, y + S/2 + 5);
      if (pessoa.sobrenome) {
        ctx.font = `9px system-ui`; ctx.fillStyle = COR.sub;
        ctx.fillText(pessoa.sobrenome, x, y + S/2 + 17);
      }

      ctx.restore();
    });

    ctx.restore();
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
    a.download = 'heredograma.png';
    a.href = this._canvasComFundo().toDataURL('image/png');
    a.click();
  },

  imprimir() {
    const dataUrl = this._canvasComFundo().toDataURL('image/png');
    const itensLegenda = [
      ['□','Masculino'],['○','Feminino'],['◇','Sexo indef.'],
      ['■','Afetado'],['◑','Portador'],['⊠','Falecido']
    ];
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para imprimir.'); return; }
    win.document.write(_htmlImpressao('🧬 Heredograma', dataUrl, itensLegenda));
    win.document.close();
  }
};
