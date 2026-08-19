// Utilitários compartilhados: escape de HTML e compressão de imagem.
const Utils = {
  // Escapa texto para inserção segura em innerHTML — impede XSS em nomes,
  // observações e qualquer campo digitado pelo usuário.
  escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // Reduz e comprime uma foto para caber no localStorage (5 MB total).
  // Fotos de iPhone chegam a 5 MB em base64; após esse resize ficam em 30–80 KB.
  // Retorna uma Promise<string> com data URL JPEG.
  comprimirImagem(file, { maxLado = 480, qualidade = 0.82 } = {}) {
    return new Promise((resolve, reject) => {
      if (!file) { reject(new Error('Arquivo inválido')); return; }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Formato de imagem não suportado'));
        img.onload = () => {
          try {
            const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
            const w = Math.round(img.width * escala);
            const h = Math.round(img.height * escala);
            const cnv = document.createElement('canvas');
            cnv.width = w; cnv.height = h;
            const ctx = cnv.getContext('2d');
            // Fundo branco: evita fotos PNG com transparência virarem pretas ao converter para JPEG
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            resolve(cnv.toDataURL('image/jpeg', qualidade));
          } catch (e) { reject(e); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  },

  // Verifica se localStorage está utilizável (Safari privado bloqueia).
  storageDisponivel() {
    try {
      const k = '__hd_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch { return false; }
  },
};
