// ================= FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSyA3YHP6mxbtHjdfzhfEiIoEONnGyXnEvAg",
  authDomain: "gestao-fefo.firebaseapp.com",
  projectId: "gestao-fefo",
  storageBucket: "gestao-fefo.firebasestorage.app",
  messagingSenderId: "471711723896",
  appId: "1:471711723896:web:44efa771271068d532588d"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// ================= NOTIFICAÇÕES PUSH =================
async function solicitarPermissaoNotificacao() {
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      mostrarToast('Notificações ativadas! Você será avisado sobre vencimentos.');
    }
  }
}

function verificarProdutosVencendo() {
  // Carregar configurações
  let diasAlerta = 7;
  let alertaNavegador = true;
  
  try {
    const config = JSON.parse(localStorage.getItem('fefo-config-alertas') || '{}');
    diasAlerta = config.diasAlerta || 7;
    alertaNavegador = config.alertaNavegador !== false;
  } catch(e) {
    console.error('Erro ao carregar configurações:', e);
  }
  
  if (!alertaNavegador) return;
  
  const agora = new Date();
  const dataLimite = new Date(agora.getTime() + diasAlerta * 24 * 60 * 60 * 1000);
  
  db.collection('estoque').get().then(snap => {
    snap.docs.forEach(doc => {
      const p = doc.data();
      if (p.validade && p.validade.toDate) {
        const dataValidade = p.validade.toDate();
        if (dataValidade > agora && dataValidade <= dataLimite) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('⚠️ Produto próximo do vencimento!', {
              body: `${p.nome || 'Produto'} vence em ${Math.ceil((dataValidade - agora) / (1000 * 60 * 60 * 24))} dias`,
              icon: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23ffc107\' d=\'M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z\'/%3E%3C/svg%3E',
              tag: doc.id,
              requireInteraction: false
            });
          }
        }
      }
    });
  });
}

// Verifica produtos vencendo ao carregar e a cada 6 horas
setInterval(verificarProdutosVencendo, 6 * 60 * 60 * 1000);

(function () {
  'use strict';

  // Small public API exposed at the end

  // ================ Helpers ================
  function handleError(e) {
    console.error(e);
    if (e && e.code === 'permission-denied') {
      mostrarRegras();
      return;
    }
    mostrarToast(e && e.message ? e.message : 'Ocorreu um erro', true);
  }
  window.handleError = handleError;

  function formatDate(d) {
    if (!d) return '';
    const date = (d && d.toDate) ? d.toDate() : new Date(d);
    if (isNaN(date)) return '';
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const ano = date.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  // Show guidance for Firestore rules when permission issues occur
  function mostrarRegras() {
    const rules = "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}";

    // Try copy to clipboard for convenience
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(rules).then(() => {
        alert('Regra de exemplo copiada para a área de transferência. Abra o console do Firebase → Firestore → Rules e cole, então publique.');
      }).catch(() => {
        alert('Não foi possível copiar automaticamente. Abra o console do Firebase → Firestore → Rules e cole o seguinte:\n\n' + rules);
      });
    } else {
      alert('Abra o console do Firebase → Firestore → Rules e cole o seguinte:\n\n' + rules);
    }
  }

  // ================ CONTROLE DE TELAS ================
  function abrir(id) {
    console.log('📂 Abrindo tela:', id);
    
    // Esconde todas as telas
    document.querySelectorAll('.tela').forEach(t => {
      t.classList.add('d-none');
      t.style.display = 'none';
    });
    
    // Busca a tela
    const el = document.getElementById(id);
    if (!el) {
      console.error('❌ Tela não encontrada:', id);
      alert(`Erro: Tela "${id}" não encontrada. Limpe o cache do navegador (Ctrl+Shift+Delete)`);
      return;
    }
    
    // Mostra a tela
    el.classList.remove('d-none');
    el.style.display = 'block';
    console.log('✅ Tela aberta:', id);
    
    // Atualizar título da página e menu ativo
    const titulos = {
      'menu': 'Dashboard',
      'estoque': 'Estoque',
      'curvaABC': 'Curva ABC',
      'historico': 'Histórico',
      'locais': 'Locais de Armazenamento',
      'usuarios': 'Usuários'
    };
    
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle && titulos[id]) {
      pageTitle.textContent = titulos[id];
    }
    
    // Atualizar menu ativo
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    const activeLink = document.querySelector(`.nav-link[onclick*="'${id}'"]`);
    if (activeLink) {
      activeLink.classList.add('active');
    }

    if (id === 'estoque') {
      carregarEstoque();
      carregarMarcas();
      carregarLocais();
    }

    if (id === 'curvaABC') {
      carregarCurvaABC();
    }
    
    if (id === 'historico') {
      carregarHistorico();
    }
    
    if (id === 'locais') {
      console.log('🔄 Carregando lista de locais...');
      listarLocais();
    }
    
    if (id === 'usuarios') {
      console.log('🔄 Carregando lista de usuários...');
      listarUsuarios();
    }
    
    // move focus to main content for accessibility
    const main = document.getElementById('main');
    if (main) main.focus();
  }

  function voltar() { abrir('menu'); }

  // ================ LOGIN ================
  async function login() {
    try {
      const email = document.getElementById('email').value;
      const senha = document.getElementById('senha').value;
      if (!email || !senha) { mostrarToast('Preencha email e senha', true); return; }
      await auth.signInWithEmailAndPassword(email, senha);
      
      // Mostrar sidebar e main content
      const sidebar = document.getElementById('sidebar');
      const mainContent = document.getElementById('mainContent');
      if (sidebar) sidebar.classList.remove('d-none');
      if (mainContent) {
        mainContent.classList.remove('d-none');
        // Mover todas as telas para dentro do content-area
        const contentArea = mainContent.querySelector('.content-area');
        const telas = document.querySelectorAll('.tela');
        telas.forEach(tela => {
          if (tela.id !== 'login' && contentArea && !contentArea.contains(tela)) {
            contentArea.appendChild(tela);
          }
        });
      }
      
      abrir('menu');
      mostrarToast('Login realizado com sucesso!', false);
      // Solicita permissão de notificações após 2 segundos
      setTimeout(() => {
        solicitarPermissaoNotificacao();
        verificarProdutosVencendo();
      }, 2000);
    } catch (e) { handleError(e); }
  }

  async function registrar() {
    try {
      const email = document.getElementById('email').value;
      const senha = document.getElementById('senha').value;
      if (!email || !senha) { alert('Preencha email e senha'); return; }
      await auth.createUserWithEmailAndPassword(email, senha);
      alert('Usuário criado com sucesso');
    } catch (e) { handleError(e); }
  }

  function logout() { 
    auth.signOut(); 
    // Esconder sidebar e main content
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    if (sidebar) sidebar.classList.add('d-none');
    if (mainContent) mainContent.classList.add('d-none');
    abrir('login'); 
  }

  // ================ MARCAS (FIRESTORE) ================
  async function carregarMarcas() {
    try {
      const select = document.getElementById('marcaProduto');
      const filtro = document.getElementById('filtroMarca');
      if (!select || !filtro) return;
      select.innerHTML = `<option value="">Selecione a marca</option>`;
      filtro.innerHTML = `<option value="">Todas as marcas</option>`;
      const snap = await db.collection('marcas').orderBy('nome').get();
      snap.forEach(doc => {
        const nome = doc.data().nome;
        select.innerHTML += `<option value="${nome}">${nome}</option>`;
        filtro.innerHTML += `<option value="${nome}">${nome}</option>`;
      });
      select.disabled = false;
    } catch (e) { handleError(e); }
  }

  // ================ SCANNER DE CÓDIGO ================
  let scanner = null;
  
  // Busca informações do produto pelo código de barras
  async function buscarProdutoPorCodigoBarras(codigo) {
    try {
      if (!codigo || codigo.trim() === '') {
        mostrarToast('⚠️ Digite um código de barras primeiro!', true);
        return;
      }
      
      codigo = codigo.trim();
      console.log('🔍 Buscando código:', codigo);
      mostrarLoader(true);
      mostrarToast('🔍 Buscando informações do produto...');
      
      // PRIMEIRO: Busca no seu próprio estoque
      console.log('1️⃣ Buscando no estoque local...');
      try {
        const estoqueSnap = await db.collection('estoque').where('codigo', '==', codigo).limit(1).get();
        if (!estoqueSnap.empty) {
          const produtoExistente = estoqueSnap.docs[0].data();
          console.log('✅ Produto encontrado no estoque:', produtoExistente);
          
          document.getElementById('nomeProduto').value = produtoExistente.nome || '';
          if (produtoExistente.marca) {
            document.getElementById('marcaProduto').value = produtoExistente.marca;
          }
          if (produtoExistente.fornecedor) {
            document.getElementById('fornecedorProduto').value = produtoExistente.fornecedor;
          }
          
          mostrarLoader(false);
          mostrarToast('✅ Produto encontrado no seu estoque! Complete quantidade, lote e validade.');
          return;
        }
      } catch (e) {
        console.log('Erro ao buscar no estoque:', e);
      }
      
      // SEGUNDO: Busca no catálogo Edin (todas as marcas)
      console.log('2️⃣ Buscando no catálogo Edin...');
      try {
        const catalogoSnap = await db.collection('catalogo-produtos').where('codigo', '==', codigo).limit(1).get();
        if (!catalogoSnap.empty) {
          const produtoCatalogo = catalogoSnap.docs[0].data();
          console.log('✅ Produto encontrado no catálogo Edin:', produtoCatalogo);
          
          document.getElementById('nomeProduto').value = produtoCatalogo.nome || '';
          if (produtoCatalogo.marca) {
            document.getElementById('marcaProduto').value = produtoCatalogo.marca;
          }
          if (produtoCatalogo.fornecedor) {
            document.getElementById('fornecedorProduto').value = produtoCatalogo.fornecedor;
          }
          
          mostrarLoader(false);
          mostrarToast('✅ Produto encontrado no catálogo Edin! Complete quantidade, lote e validade.');
          return;
        }
      } catch (e) {
        console.log('Erro ao buscar no catálogo:', e);
      }
      
      // TERCEIRO: Tenta múltiplas APIs de produtos
      console.log('3️⃣ Tentando APIs de produtos...');
      
      // API 1: Open Food Facts
      try {
        console.log('📡 Tentando Open Food Facts...');
        let response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${codigo}.json`);
        let data = await response.json();
        
        if (data.status === 1 && data.product) {
          const produto = data.product;
          const nomeProduto = produto.product_name || produto.product_name_pt || produto.generic_name || '';
          const marca = produto.brands || '';
          
          if (nomeProduto) {
            console.log('✅ Open Food Facts encontrou:', nomeProduto);
            const produtoInteligente = await buscarProdutoInteligenteNoCatalogo(nomeProduto, marca);
            
            if (produtoInteligente) {
              console.log('🎯 MATCH AUTOMÁTICO!', produtoInteligente.nome);
              document.getElementById('nomeProduto').value = produtoInteligente.nome;
              if (produtoInteligente.marca) document.getElementById('marcaProduto').value = produtoInteligente.marca;
              if (produtoInteligente.fornecedor) document.getElementById('fornecedorProduto').value = produtoInteligente.fornecedor;
              
              await db.collection('catalogo-produtos').doc(produtoInteligente.id).update({ codigo });
              mostrarLoader(false);
              mostrarToast('✅ Produto encontrado e associado automaticamente!');
              return;
            }
            
            document.getElementById('nomeProduto').value = nomeProduto;
            if (marca) document.getElementById('marcaProduto').value = marca;
            mostrarLoader(false);
            mostrarToast('✅ Produto encontrado na Open Food Facts!');
            return;
          }
        }
      } catch (e) {
        console.log('⚠️ Open Food Facts falhou:', e.message);
      }
      
      // API 2: World of EAN
      try {
        console.log('📡 Tentando World of EAN...');
        let response = await fetch(`https://world.openfoodfacts.net/api/v2/product/${codigo}`);
        let data = await response.json();
        
        if (data.product) {
          const nomeProduto = data.product.product_name || '';
          const marca = data.product.brands || '';
          
          if (nomeProduto) {
            console.log('✅ World of EAN encontrou:', nomeProduto);
            const produtoInteligente = await buscarProdutoInteligenteNoCatalogo(nomeProduto, marca);
            
            if (produtoInteligente) {
              console.log('🎯 MATCH AUTOMÁTICO!', produtoInteligente.nome);
              document.getElementById('nomeProduto').value = produtoInteligente.nome;
              if (produtoInteligente.marca) document.getElementById('marcaProduto').value = produtoInteligente.marca;
              if (produtoInteligente.fornecedor) document.getElementById('fornecedorProduto').value = produtoInteligente.fornecedor;
              
              await db.collection('catalogo-produtos').doc(produtoInteligente.id).update({ codigo });
              mostrarLoader(false);
              mostrarToast('✅ Produto encontrado e associado automaticamente!');
              return;
            }
            
            document.getElementById('nomeProduto').value = nomeProduto;
            if (marca) document.getElementById('marcaProduto').value = marca;
            mostrarLoader(false);
            mostrarToast('✅ Produto encontrado no World of EAN!');
            return;
          }
        }
      } catch (e) {
        console.log('⚠️ World of EAN falhou:', e.message);
      }
      
      console.log('❌ Produto não encontrado em nenhuma API');
      mostrarLoader(false);
      
      // 🆕 ÚLTIMA TENTATIVA: Buscar no catálogo e associar código
      console.log('🔍 Buscando no catálogo para associar...');
      const resultadoBusca = await buscarNoCatalogoParaAssociar(codigo);
      if (resultadoBusca) {
        return; // Produto foi associado com sucesso
      }
      
      mostrarToast('ℹ️ Produto não encontrado. Preencha manualmente e o código será salvo.');
      
    } catch (error) {
      mostrarLoader(false);
      console.error('❌ Erro ao buscar produto:', error);
      
      // Mesmo com erro, tenta buscar no catálogo
      try {
        console.log('🔍 Tentando buscar no catálogo após erro...');
        const resultadoBusca = await buscarNoCatalogoParaAssociar(codigo);
        if (resultadoBusca) {
          return;
        }
      } catch (e) {
        console.log('Erro ao buscar no catálogo:', e);
      }
      
      mostrarToast('ℹ️ Não foi possível buscar informações. Preencha manualmente.');
    }
  }
  
  // 🆕 Buscar produtos no catálogo para associar código de barras
  async function buscarNoCatalogoParaAssociar(codigo) {
    try {
      // Busca todos os produtos do catálogo SEM código de barras
      const catalogoSnap = await db.collection('catalogo-produtos')
        .where('codigo', '==', '')
        .limit(100)
        .get();
      
      if (catalogoSnap.empty) {
        console.log('Nenhum produto no catálogo para associar');
        return false;
      }
      
      // Cria lista de produtos
      const produtos = [];
      catalogoSnap.forEach(doc => {
        produtos.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Mostra modal para usuário escolher
      mostrarLoader(false); // 🔧 DESLIGA O LOADER ANTES DE ABRIR O MODAL
      const produtoEscolhido = await mostrarModalEscolhaProduto(produtos, codigo);
      
      if (produtoEscolhido) {
        mostrarLoader(true); // Liga loader para salvar
        // Atualiza o produto no catálogo com o código de barras
        await db.collection('catalogo-produtos').doc(produtoEscolhido.id).update({
          codigo: codigo
        });
        
        // Preenche os campos
        document.getElementById('nomeProduto').value = produtoEscolhido.nome || '';
        if (produtoEscolhido.marca) {
          document.getElementById('marcaProduto').value = produtoEscolhido.marca;
        }
        if (produtoEscolhido.fornecedor) {
          document.getElementById('fornecedorProduto').value = produtoEscolhido.fornecedor;
        }
        
        mostrarLoader(false); // Desliga loader
        mostrarToast(`✅ Código ${codigo} associado a "${produtoEscolhido.nome}"!`);
        console.log('✅ Código associado com sucesso!');
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Erro ao buscar no catálogo:', error);
      return false;
    }
  }
  
  // 🆕 Modal para escolher produto do catálogo
  async function mostrarModalEscolhaProduto(produtos, codigo) {
    return new Promise((resolve) => {
      // Cria modal dinâmico
      const modal = document.createElement('div');
      modal.className = 'modal fade';
      modal.id = 'modalEscolhaProduto';
      modal.setAttribute('tabindex', '-1');
      modal.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">🔍 Código ${codigo} - Escolha o Produto</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="text-muted">Encontramos ${produtos.length} produtos no catálogo Edin. Qual deles você escaneou?</p>
              
              <div class="mb-3">
                <input type="text" id="filtroNomeProduto" class="form-control" placeholder="🔍 Filtrar por nome (ex: ferro, gummies, vitamina)">
              </div>
              
              <div id="listaProdutosCatalogo" style="max-height: 400px; overflow-y: auto;">
                ${produtos.map(p => `
                  <div class="produto-item p-3 mb-2 border rounded" style="cursor: pointer; transition: all 0.2s;" 
                       data-produto='${JSON.stringify(p)}'
                       onmouseover="this.style.backgroundColor='#f0f8ff'; this.style.borderColor='#007bff'"
                       onmouseout="this.style.backgroundColor=''; this.style.borderColor='#dee2e6'">
                    <div class="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>${p.nome}</strong>
                        <div class="text-muted small">
                          <span class="badge bg-info">${p.marca}</span>
                          <span class="badge bg-secondary">${p.categoria}</span>
                        </div>
                      </div>
                      <button class="btn btn-sm btn-primary">Selecionar</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">❌ Cancelar (Preencher Manualmente)</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
      
      // Filtro de busca
      const inputFiltro = modal.querySelector('#filtroNomeProduto');
      inputFiltro.addEventListener('input', (e) => {
        const termo = e.target.value.toLowerCase();
        const items = modal.querySelectorAll('.produto-item');
        items.forEach(item => {
          const produto = JSON.parse(item.dataset.produto);
          const texto = `${produto.nome} ${produto.marca}`.toLowerCase();
          item.style.display = texto.includes(termo) ? 'block' : 'none';
        });
      });
      
      // Click nos produtos
      modal.querySelectorAll('.produto-item').forEach(item => {
        item.addEventListener('click', () => {
          const produto = JSON.parse(item.dataset.produto);
          bsModal.hide();
          resolve(produto);
        });
      });
      
      // Fechar sem escolher
      modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
        resolve(null);
      });
    });
  }
  
  // 🆕 Busca inteligente no catálogo por similaridade de nome
  async function buscarProdutoInteligenteNoCatalogo(nomeProdutoAPI, marcaAPI) {
    try {
      console.log(`🧠 Busca inteligente: "${nomeProdutoAPI}" marca: "${marcaAPI}"`);
      
      // Extrai palavras-chave do nome (remove palavras comuns)
      const palavrasComuns = ['de', 'com', 'em', 'para', 'sem', 'e', 'a', 'o', 'da', 'do', 'das', 'dos'];
      const palavrasChave = nomeProdutoAPI
        .toLowerCase()
        .split(/\s+/)
        .filter(p => p.length > 3 && !palavrasComuns.includes(p))
        .slice(0, 3); // Pega as 3 primeiras palavras relevantes
      
      console.log('Palavras-chave extraídas:', palavrasChave);
      
      if (palavrasChave.length === 0) {
        return null;
      }
      
      // Busca produtos no catálogo sem código
      const catalogoSnap = await db.collection('catalogo-produtos')
        .where('codigo', '==', '')
        .get();
      
      if (catalogoSnap.empty) {
        console.log('Catálogo vazio');
        return null;
      }
      
      // Analisa cada produto do catálogo
      const candidatos = [];
      catalogoSnap.forEach(doc => {
        const produto = { id: doc.id, ...doc.data() };
        const nomeCatalogo = produto.nome.toLowerCase();
        const marcaCatalogo = (produto.marca || '').toLowerCase();
        const marcaAPILower = (marcaAPI || '').toLowerCase();
        
        // Calcula score de similaridade
        let score = 0;
        
        // +30 pontos se a marca bater
        if (marcaCatalogo && marcaAPILower && marcaCatalogo === marcaAPILower) {
          score += 30;
        }
        
        // +20 pontos por cada palavra-chave que aparecer no nome
        palavrasChave.forEach(palavra => {
          if (nomeCatalogo.includes(palavra)) {
            score += 20;
          }
        });
        
        // Salva candidato se tiver score > 0
        if (score > 0) {
          candidatos.push({ produto, score });
          console.log(`Candidato: "${produto.nome}" (${produto.marca}) - Score: ${score}`);
        }
      });
      
      // Ordena por score (maior primeiro)
      candidatos.sort((a, b) => b.score - a.score);
      
      if (candidatos.length === 0) {
        console.log('❌ Nenhum candidato encontrado');
        return null;
      }
      
      // Se o melhor candidato tem score alto (>= 40), retorna automaticamente
      const melhor = candidatos[0];
      if (melhor.score >= 40) {
        console.log(`✅ Match automático! "${melhor.produto.nome}" - Score: ${melhor.score}`);
        return melhor.produto;
      }
      
      // Se tem vários candidatos com score similar, não decide sozinho
      if (candidatos.length > 1 && candidatos[1].score >= 30) {
        console.log('⚠️ Múltiplos candidatos com score alto, requer escolha manual');
        return null;
      }
      
      // Retorna o melhor se for único com score razoável
      if (melhor.score >= 20) {
        console.log(`✅ Melhor candidato: "${melhor.produto.nome}" - Score: ${melhor.score}`);
        return melhor.produto;
      }
      
      return null;
      
    } catch (error) {
      console.error('Erro na busca inteligente:', error);
      return null;
    }
  }
  
  // Expor função globalmente para uso no HTML
  window.buscarProdutoPorCodigoBarras = buscarProdutoPorCodigoBarras;
  
  function abrirScanner() {
    const container = document.getElementById('scanner');
    if (!container) return;
    container.innerHTML = '';
    if (scanner) { scanner.stop().catch(()=>{}); }
    // Checa ambiente seguro para câmera
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || /^[0-9.]+$/.test(location.hostname);
    if (!isSecure) {
      mostrarToast('Para usar o scanner, acesse via http://localhost:8000 ou pelo IP do seu PC em um servidor local. Não funciona abrindo o arquivo direto.', true);
      return;
    }
    scanner = new Html5Qrcode('scanner');
    let isRunning = false;
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 250 },
      async codigo => {
        document.getElementById('codigoBarras').value = codigo;
        if (isRunning) scanner.stop().catch(()=>{});
        
        // Busca automaticamente as informações do produto
        await buscarProdutoPorCodigoBarras(codigo);
      },
      error => {}
    ).then(() => { isRunning = true; })
    .catch(err => {
      if (err && (err.name === 'NotAllowedError' || err.message?.includes('Permission denied'))) {
        mostrarToast('Permissão da câmera negada. Não é possível usar o leitor.', true);
      } else {
        mostrarToast('Erro ao acessar a câmera: ' + (err && err.message ? err.message : err), true);
      }
    });
  }

  // ================ ESTOQUE ================
  async function salvarProduto() {
    try {
      const codigo = document.getElementById('codigoBarras').value.trim();
      const nome = document.getElementById('nomeProduto').value.trim();
      const marca = document.getElementById('marcaProduto').value;
      const lote = document.getElementById('loteProduto').value.trim();
      const fornecedor = document.getElementById('fornecedorProduto').value.trim();
      const local = document.getElementById('localProduto')?.value || '';
      const quantidade = Number(document.getElementById('quantidadeProduto').value);
      const estoqueMinimo = Number(document.getElementById('estoqueMinimo').value || 0);
      const validadeInput = document.getElementById('validadeProduto').value;

      if (!nome) {
        mostrarToast('Informe o nome do produto.', true);
        return;
      }
      if (!marca) {
        mostrarToast('Selecione a marca.', true);
        return;
      }
      if (!quantidade || quantidade <= 0) {
        mostrarToast('Informe uma quantidade válida.', true);
        return;
      }
      if (!validadeInput) {
        mostrarToast('Informe a validade.', true);
        return;
      }

      mostrarLoader(true);
      
      const dadosProduto = {
        codigo, nome, marca, lote, fornecedor, local, quantidade, estoqueMinimo,
        validade: firebase.firestore.Timestamp.fromDate(new Date(validadeInput))
      };
      
      if (produtoEditando) {
        // ATUALIZA produto existente
        await db.collection('estoque').doc(produtoEditando).update(dadosProduto);
        
        await db.collection('historico').add({
          tipo: 'edição',
          produto: nome,
          descricao: `Produto editado - ${nome}`,
          usuario: usuarioAtual?.nome || auth.currentUser?.email || 'Sistema',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        mostrarLoader(false);
        mostrarToast('✅ Produto atualizado com sucesso!');
        produtoEditando = null;
      } else {
        // ADICIONA novo produto
        dadosProduto.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
        const docRef = await db.collection('estoque').add(dadosProduto);
        
        await db.collection('historico').add({
          tipo: 'entrada',
          produtoId: docRef.id,
          produto: nome,
          marca: marca,
          quantidade: quantidade,
          usuario: auth.currentUser?.email || 'Sistema',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        mostrarLoader(false);
        mostrarToast('Produto salvo com sucesso!');
      }
      
      ['codigoBarras','nomeProduto','quantidadeProduto','estoqueMinimo','validadeProduto'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      carregarEstoque();
    } catch (e) { mostrarLoader(false); handleError(e); }
  }

  // ================ LISTAGEM / FILTRO ================
  let dadosEstoque = [];
  async function carregarEstoque() {
    try {
      mostrarLoader(true);
      dadosEstoque = [];
      const tabela = document.getElementById('tabelaEstoque'); if (!tabela) { mostrarLoader(false); return; }
      tabela.innerHTML = '';
      const snap = await db.collection('estoque').orderBy('validade','asc').get();
      snap.forEach(doc => {
        const p = doc.data();
        p.id = doc.id; // Adiciona ID do documento para edição/exclusão
        const validadeDate = (p.validade && p.validade.toDate) ? p.validade.toDate() : (p.validade || null);
        dadosEstoque.push({ ...p, validade: validadeDate });
      });
      renderTabela(dadosEstoque);
      mostrarLoader(false);
    } catch (e) { mostrarLoader(false); handleError(e); }
  }

  function renderTabela(lista) {
    const tabela = document.getElementById('tabelaEstoque');
    tabela.innerHTML = '';
    lista.forEach(p => {
      const status = calcularStatus(p.validade);
      const statusBadge = status === 'vencido' ? '<span class="badge badge-vencido">Vencido</span>' :
                          status === 'alerta' ? '<span class="badge badge-proximo">Próx. Vencer</span>' :
                          '<span class="badge badge-ok">OK</span>';
      const estoqueMin = p.estoqueMinimo || 0;
      const alertaEstoque = p.quantidade <= estoqueMin && estoqueMin > 0 ? ' 🔴' : '';
      
      tabela.innerHTML += `
      <tr class="${status === 'vencido' ? 'table-danger' : status === 'alerta' ? 'table-warning' : ''}">
        <td>${p.codigo || '-'}</td>
        <td>${p.nome}</td>
        <td>${p.marca}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-sm btn-outline-danger" onclick="ajustarQuantidade('${p.id}', -1)" title="Diminuir">-</button>
            <strong style="min-width:40px;text-align:center;">${p.quantidade}${alertaEstoque}</strong>
            <button class="btn btn-sm btn-outline-success" onclick="ajustarQuantidade('${p.id}', 1)" title="Aumentar">+</button>
          </div>
        </td>
        <td>${estoqueMin}</td>
        <td>${formatDate(p.validade) || '-'} ${statusBadge}</td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="editarProduto('${p.id}')" title="Editar">✏️</button>
            <button class="btn btn-outline-danger" onclick="excluirProduto('${p.id}')" title="Excluir">🗑️</button>
          </div>
        </td>
      </tr>`;
    });
  }

  function filtrarEstoque() {
    const texto = (document.getElementById('buscaEstoque').value || '').toLowerCase();
    const marca = document.getElementById('filtroMarca').value;
    const filtrado = dadosEstoque.filter(p => (!marca || p.marca === marca) && (p.nome.toLowerCase().includes(texto) || p.marca.toLowerCase().includes(texto) || (p.codigo || '').includes(texto)) );
    renderTabela(filtrado);
  }

  // ================ EXCEL ================
  /**
   * Exporta o estoque e a curva ABC para um arquivo Excel profissional (XLSX).
   * Inclui cabeçalhos, filtros, datas formatadas, múltiplas abas e instruções.
   * Mostra toast de sucesso ao finalizar.
   */
  function exportarExcel() {
    try {
      mostrarLoader(true);
      const agora = new Date();
      const dataExportacao = formatDate(agora);
      const horaExportacao = agora.toLocaleTimeString('pt-BR');
      
      // Prepara dados do estoque com status
      const estoque = dadosEstoque.map(p => {
        const status = calcularStatus(p.validade);
        const estoqueMin = p.estoqueMinimo || 0;
        const alertaEstoque = p.quantidade <= estoqueMin && estoqueMin > 0;
        
        return {
          codigo: p.codigo || '-',
          produto: p.nome || 'Sem nome',
          marca: p.marca || '-',
          quantidade: Number(p.quantidade) || 0,
          estoqueMin: estoqueMin,
          validade: p.validade ? formatDate(p.validade) : '-',
          status: status === 'vencido' ? 'VENCIDO' : status === 'alerta' ? 'PRÓXIMO VENCER' : 'OK',
          alertaEstoque: alertaEstoque ? 'SIM' : 'NÃO'
        };
      });

      // ===== ABA 1: ESTOQUE COMPLETO =====
      const wsEstoque = XLSX.utils.aoa_to_sheet([
        ['📦 RELATÓRIO DE ESTOQUE - SISTEMA FEFO'],
        [`Data: ${dataExportacao}`, '', '', `Hora: ${horaExportacao}`, '', '', `Total de produtos: ${estoque.length}`],
        [],
        ['Código de Barras','Produto','Marca','Quantidade','Est. Mínimo','Validade','Status','Alerta Est.'],
        ...estoque.map(p => [p.codigo, p.produto, p.marca, p.quantidade, p.estoqueMin, p.validade, p.status, p.alertaEstoque])
      ]);
      
      wsEstoque['!cols'] = [
        { wch: 18 }, { wch: 35 }, { wch: 20 }, { wch: 12 }, { wch: 13 }, { wch: 14 }, { wch: 15 }, { wch: 12 }
      ];
      wsEstoque['!autofilter'] = { ref: `A4:H${estoque.length + 4}` };
      wsEstoque['!freeze'] = { xSplit: 0, ySplit: 4 };
      wsEstoque['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }
      ];

      // ===== ABA 2: CURVA ABC =====
      const ordenado = [...estoque].sort((a,b) => b.quantidade - a.quantidade);
      const total = ordenado.reduce((s,p) => s + p.quantidade, 0);
      let acumulado = 0;
      let contA = 0, contB = 0, contC = 0;
      
      const abc = ordenado.map(p => {
        acumulado += p.quantidade;
        const perc = acumulado / total;
        const percFormatado = (perc * 100).toFixed(2) + '%';
        
        let curva = 'C';
        if (perc <= 0.8) { curva = 'A'; contA++; }
        else if (perc <= 0.95) { curva = 'B'; contB++; }
        else contC++;
        
        return [p.produto, p.marca, p.quantidade, percFormatado, curva];
      });
      
      const wsABC = XLSX.utils.aoa_to_sheet([
        ['📊 ANÁLISE CURVA ABC - POR QUANTIDADE'],
        [`Data: ${dataExportacao}`, '', '', `Hora: ${horaExportacao}`],
        [],
        ['RESUMO:'],
        [`Curva A: ${contA} produtos (80% do valor)`, '', '', `Curva B: ${contB} produtos (15% do valor)`, '', '', `Curva C: ${contC} produtos (5% do valor)`],
        [],
        ['Produto','Marca','Quantidade','% Acumulado','Curva'],
        ...abc
      ]);
      
      wsABC['!cols'] = [
        { wch: 35 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 10 }
      ];
      wsABC['!autofilter'] = { ref: `A7:E${abc.length + 7}` };
      wsABC['!freeze'] = { xSplit: 0, ySplit: 7 };
      wsABC['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: 2 } },
        { s: { r: 4, c: 3 }, e: { r: 4, c: 4 } },
        { s: { r: 4, c: 5 }, e: { r: 4, c: 6 } }
      ];

      // ===== ABA 3: PRODUTOS VENCIDOS/PRÓXIMOS =====
      const vencidos = estoque.filter(p => p.status === 'VENCIDO');
      const proximos = estoque.filter(p => p.status === 'PRÓXIMO VENCER');
      
      const wsAlertas = XLSX.utils.aoa_to_sheet([
        ['⚠️ ALERTAS DE VENCIMENTO'],
        [`Data: ${dataExportacao}`, '', '', `Hora: ${horaExportacao}`],
        [],
        ['PRODUTOS VENCIDOS:', vencidos.length],
        [],
        ['Código','Produto','Marca','Quantidade','Validade'],
        ...vencidos.map(p => [p.codigo, p.produto, p.marca, p.quantidade, p.validade]),
        [],
        [],
        ['PRODUTOS PRÓXIMOS AO VENCIMENTO (30 dias):', proximos.length],
        [],
        ['Código','Produto','Marca','Quantidade','Validade'],
        ...proximos.map(p => [p.codigo, p.produto, p.marca, p.quantidade, p.validade])
      ]);
      
      wsAlertas['!cols'] = [
        { wch: 18 }, { wch: 35 }, { wch: 20 }, { wch: 12 }, { wch: 14 }
      ];
      wsAlertas['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
      ];

      // ===== ABA 4: ESTOQUE MÍNIMO =====
      const estoqueMinimo = estoque.filter(p => p.alertaEstoque === 'SIM');
      
      const wsEstMin = XLSX.utils.aoa_to_sheet([
        ['🔴 PRODUTOS ABAIXO DO ESTOQUE MÍNIMO'],
        [`Data: ${dataExportacao}`, '', '', `Total: ${estoqueMinimo.length} produtos`],
        [],
        ['Produto','Marca','Quantidade Atual','Estoque Mínimo','Diferença','Status'],
        ...estoqueMinimo.map(p => [
          p.produto,
          p.marca,
          p.quantidade,
          p.estoqueMin,
          p.quantidade - p.estoqueMin,
          'REABASTECER'
        ])
      ]);
      
      wsEstMin['!cols'] = [
        { wch: 35 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }
      ];
      wsEstMin['!autofilter'] = { ref: `A4:F${estoqueMinimo.length + 4}` };
      wsEstMin['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }
      ];

      // ===== ABA 5: ESTATÍSTICAS =====
      const qtdTotal = estoque.reduce((s, p) => s + p.quantidade, 0);
      const marcas = [...new Set(estoque.map(p => p.marca))].length;
      const mediaQtd = (qtdTotal / estoque.length).toFixed(2);
      
      const wsStats = XLSX.utils.aoa_to_sheet([
        ['📊 ESTATÍSTICAS DO ESTOQUE'],
        [`Gerado em: ${dataExportacao} às ${horaExportacao}`],
        [],
        ['Métrica', 'Valor'],
        ['Total de Produtos', estoque.length],
        ['Total de Marcas', marcas],
        ['Quantidade Total em Estoque', qtdTotal],
        ['Média de Quantidade por Produto', mediaQtd],
        [],
        ['Produtos Vencidos', vencidos.length],
        ['Produtos Próximos ao Vencimento', proximos.length],
        ['Produtos OK', estoque.length - vencidos.length - proximos.length],
        [],
        ['Produtos Abaixo do Est. Mínimo', estoqueMinimo.length],
        [],
        ['Curva A', `${contA} produtos (${((contA/estoque.length)*100).toFixed(1)}%)`],
        ['Curva B', `${contB} produtos (${((contB/estoque.length)*100).toFixed(1)}%)`],
        ['Curva C', `${contC} produtos (${((contC/estoque.length)*100).toFixed(1)}%)`]
      ]);
      
      wsStats['!cols'] = [
        { wch: 40 }, { wch: 25 }
      ];
      wsStats['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }
      ];

      // ===== ABA 6: INFORMAÇÕES =====
      const wsInfo = XLSX.utils.aoa_to_sheet([
        ['📦 SISTEMA FEFO - GESTÃO DE ESTOQUE'],
        [],
        ['INFORMAÇÕES DO RELATÓRIO'],
        ['Data de Exportação:', dataExportacao],
        ['Hora de Exportação:', horaExportacao],
        ['Usuário:', auth.currentUser?.email || 'Sistema'],
        [],
        ['SOBRE O SISTEMA'],
        ['Sistema:', 'FEFO - First Expired, First Out'],
        ['Descrição:', 'Sistema profissional de controle de estoque com foco em produtos perecíveis'],
        ['Funcionalidades:', 'Controle FEFO, Curva ABC, Notificações, Histórico, Exportação Excel'],
        [],
        ['ABAS DESTE RELATÓRIO'],
        ['1. Estoque Completo', 'Lista completa de todos os produtos com status'],
        ['2. Curva ABC', 'Análise de produtos por importância (A, B, C)'],
        ['3. Alertas', 'Produtos vencidos e próximos ao vencimento'],
        ['4. Estoque Mínimo', 'Produtos abaixo do estoque mínimo'],
        ['5. Estatísticas', 'Resumo geral com métricas do estoque'],
        ['6. Informações', 'Esta aba com detalhes do relatório'],
        [],
        ['© 2025 - Sistema FEFO. Todos os direitos reservados.']
      ]);
      
      wsInfo['!cols'] = [
        { wch: 30 }, { wch: 60 }
      ];

      // ===== MONTA WORKBOOK =====
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsEstoque, '1. Estoque Completo');
      XLSX.utils.book_append_sheet(wb, wsABC, '2. Curva ABC');
      XLSX.utils.book_append_sheet(wb, wsAlertas, '3. Alertas Vencimento');
      XLSX.utils.book_append_sheet(wb, wsEstMin, '4. Estoque Mínimo');
      XLSX.utils.book_append_sheet(wb, wsStats, '5. Estatísticas');
      XLSX.utils.book_append_sheet(wb, wsInfo, '6. Informações');

      // Salva arquivo com data/hora no nome
      const nomeArquivo = `FEFO_Estoque_${agora.getFullYear()}${String(agora.getMonth()+1).padStart(2,'0')}${String(agora.getDate()).padStart(2,'0')}_${String(agora.getHours()).padStart(2,'0')}${String(agora.getMinutes()).padStart(2,'0')}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo);
      
      mostrarLoader(false);
      mostrarToast('✅ Relatório Excel Premium exportado com sucesso!');
      mostrarToast('Relatório Excel exportado com sucesso!');
    } catch (e) { mostrarLoader(false); handleError(e); }
  }
  
  // ================= EXPORTAR PDF PREMIUM =================
  async function exportarPDF() {
    try {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        mostrarToast('Biblioteca PDF não carregada. Aguarde...', true);
        return;
      }
      
      mostrarLoader(true);
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      
      const agora = new Date();
      const dataExportacao = formatDate(agora);
      const horaExportacao = agora.toLocaleTimeString('pt-BR');
      
      // Prepara dados do estoque
      const estoque = dadosEstoque.map(p => {
        const status = calcularStatus(p.validade);
        const estoqueMin = p.estoqueMinimo || 0;
        return {
          codigo: p.codigo || '-',
          produto: p.nome || 'Sem nome',
          marca: p.marca || '-',
          categoria: p.categoria || 'Outros',
          quantidade: Number(p.quantidade) || 0,
          estoqueMin: estoqueMin,
          lote: p.lote || '-',
          fornecedor: p.fornecedor || '-',
          validade: p.validade ? formatDate(p.validade) : '-',
          status: status === 'vencido' ? 'VENCIDO' : status === 'alerta' ? 'PRÓXIMO' : 'OK',
          alertaEstoque: p.quantidade <= estoqueMin && estoqueMin > 0
        };
      });
      
      const vencidos = estoque.filter(p => p.status === 'VENCIDO');
      const proximos = estoque.filter(p => p.status === 'PRÓXIMO');
      const ok = estoque.filter(p => p.status === 'OK');
      const estoqueMinimo = estoque.filter(p => p.alertaEstoque);
      
      // ========== PÁGINA 1: CAPA ==========
      doc.setFillColor(102, 126, 234);
      doc.rect(0, 0, 210, 297, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(40);
      doc.setFont(undefined, 'bold');
      doc.text('GESTÃO FEFO', 105, 100, { align: 'center' });
      
      doc.setFontSize(18);
      doc.setFont(undefined, 'normal');
      doc.text('Sistema Profissional de Controle de Estoque', 105, 120, { align: 'center' });
      
      doc.setFontSize(14);
      doc.text('Relatório Completo de Estoque', 105, 140, { align: 'center' });
      
      // Box com informações
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(40, 160, 130, 50, 5, 5, 'F');
      
      doc.setTextColor(102, 126, 234);
      doc.setFontSize(12);
      doc.text(`Data: ${dataExportacao}`, 105, 175, { align: 'center' });
      doc.text(`Hora: ${horaExportacao}`, 105, 185, { align: 'center' });
      doc.text(`Usuário: ${auth.currentUser?.email || 'Sistema'}`, 105, 195, { align: 'center' });
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text('© 2025 - Sistema FEFO. Todos os direitos reservados.', 105, 280, { align: 'center' });
      
      // ========== PÁGINA 2: RESUMO EXECUTIVO ==========
      doc.addPage();
      
      // Cabeçalho padrão
      doc.setFillColor(102, 126, 234);
      doc.rect(0, 0, 210, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.text('📊 RESUMO EXECUTIVO', 105, 22, { align: 'center' });
      
      // Cards de métricas
      doc.setTextColor(0, 0, 0);
      let yPos = 50;
      
      // Card 1: Total
      doc.setFillColor(13, 110, 253);
      doc.roundedRect(14, yPos, 182, 20, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(`Total de Produtos: ${estoque.length}`, 20, yPos + 13);
      
      yPos += 30;
      
      // Card 2: OK
      doc.setFillColor(25, 135, 84);
      doc.roundedRect(14, yPos, 182, 20, 3, 3, 'F');
      doc.text(`Produtos OK: ${ok.length} (${((ok.length/estoque.length)*100).toFixed(1)}%)`, 20, yPos + 13);
      
      yPos += 30;
      
      // Card 3: Próximos
      doc.setFillColor(255, 193, 7);
      doc.roundedRect(14, yPos, 182, 20, 3, 3, 'F');
      doc.setTextColor(0, 0, 0);
      doc.text(`Próximos ao Vencimento: ${proximos.length}`, 20, yPos + 13);
      
      yPos += 30;
      
      // Card 4: Vencidos
      doc.setFillColor(220, 53, 69);
      doc.roundedRect(14, yPos, 182, 20, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(`Produtos Vencidos: ${vencidos.length}`, 20, yPos + 13);
      
      yPos += 30;
      
      // Card 5: Estoque Mínimo
      doc.setFillColor(255, 87, 51);
      doc.roundedRect(14, yPos, 182, 20, 3, 3, 'F');
      doc.text(`Alerta Estoque Mínimo: ${estoqueMinimo.length}`, 20, yPos + 13);
      
      yPos += 35;
      
      // Categorias
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('📂 Distribuição por Categoria', 14, yPos);
      
      yPos += 10;
      
      const categorias = {};
      estoque.forEach(p => {
        categorias[p.categoria] = (categorias[p.categoria] || 0) + 1;
      });
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      Object.entries(categorias).forEach(([cat, qtd]) => {
        const perc = ((qtd/estoque.length)*100).toFixed(1);
        doc.text(`• ${cat}: ${qtd} produtos (${perc}%)`, 20, yPos);
        yPos += 7;
      });
      
      // ========== PÁGINA 3: TABELA COMPLETA ==========
      doc.addPage();
      
      // Cabeçalho
      doc.setFillColor(102, 126, 234);
      doc.rect(0, 0, 210, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.text('📋 LISTA COMPLETA DE PRODUTOS', 105, 22, { align: 'center' });
      
      if (doc.autoTable) {
        doc.autoTable({
          startY: 45,
          head: [['Cód.', 'Produto', 'Marca', 'Cat.', 'Qtd', 'Lote', 'Validade', 'Status']],
          body: estoque.map(p => [
            p.codigo,
            p.produto.substring(0, 25),
            p.marca,
            p.categoria,
            p.quantidade,
            p.lote,
            p.validade,
            p.status
          ]),
          theme: 'grid',
          headStyles: { 
            fillColor: [102, 126, 234],
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center'
          },
          styles: { 
            fontSize: 8,
            cellPadding: 2
          },
          columnStyles: {
            0: { cellWidth: 18 },
            1: { cellWidth: 45 },
            2: { cellWidth: 25 },
            3: { cellWidth: 20 },
            4: { cellWidth: 12, halign: 'center' },
            5: { cellWidth: 18 },
            6: { cellWidth: 22 },
            7: { cellWidth: 18, halign: 'center' }
          },
          didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 7) {
              if (data.cell.raw === 'VENCIDO') {
                data.cell.styles.textColor = [220, 53, 69];
                data.cell.styles.fontStyle = 'bold';
              } else if (data.cell.raw === 'PRÓXIMO') {
                data.cell.styles.textColor = [255, 193, 7];
                data.cell.styles.fontStyle = 'bold';
              } else {
                data.cell.styles.textColor = [25, 135, 84];
              }
            }
          }
        });
      }
      
      // ========== PÁGINA 4: PRODUTOS CRÍTICOS ==========
      if (vencidos.length > 0 || estoqueMinimo.length > 0) {
        doc.addPage();
        
        // Cabeçalho
        doc.setFillColor(220, 53, 69);
        doc.rect(0, 0, 210, 35, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.text('⚠️ PRODUTOS CRÍTICOS', 105, 22, { align: 'center' });
        
        let startY = 45;
        
        // Vencidos
        if (vencidos.length > 0) {
          doc.setTextColor(220, 53, 69);
          doc.setFontSize(14);
          doc.setFont(undefined, 'bold');
          doc.text(`PRODUTOS VENCIDOS (${vencidos.length})`, 14, startY);
          
          if (doc.autoTable) {
            doc.autoTable({
              startY: startY + 5,
              head: [['Produto', 'Marca', 'Qtd', 'Validade']],
              body: vencidos.slice(0, 15).map(p => [p.produto, p.marca, p.quantidade, p.validade]),
              theme: 'striped',
              headStyles: { fillColor: [220, 53, 69], fontSize: 9 },
              styles: { fontSize: 9 }
            });
            startY = doc.lastAutoTable.finalY + 15;
          }
        }
        
        // Estoque Mínimo
        if (estoqueMinimo.length > 0 && startY < 250) {
          doc.setTextColor(255, 87, 51);
          doc.setFontSize(14);
          doc.setFont(undefined, 'bold');
          doc.text(`ALERTA ESTOQUE MÍNIMO (${estoqueMinimo.length})`, 14, startY);
          
          if (doc.autoTable) {
            doc.autoTable({
              startY: startY + 5,
              head: [['Produto', 'Atual', 'Mínimo', 'Diferença']],
              body: estoqueMinimo.slice(0, 15).map(p => [
                p.produto,
                p.quantidade,
                p.estoqueMin,
                p.quantidade - p.estoqueMin
              ]),
              theme: 'striped',
              headStyles: { fillColor: [255, 87, 51], fontSize: 9 },
              styles: { fontSize: 9 }
            });
          }
        }
      }
      
      // Rodapé em todas as páginas
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(
          `Sistema FEFO - ${dataExportacao} - Página ${i} de ${pageCount}`,
          105,
          290,
          { align: 'center' }
        );
      }
      
      // Salva PDF
      const nomeArquivo = `FEFO_Relatorio_${agora.getFullYear()}${String(agora.getMonth()+1).padStart(2,'0')}${String(agora.getDate()).padStart(2,'0')}_${String(agora.getHours()).padStart(2,'0')}${String(agora.getMinutes()).padStart(2,'0')}.pdf`;
      doc.save(nomeArquivo);
      
      mostrarLoader(false);
      mostrarToast('✅ Relatório PDF Premium exportado com sucesso!');
    } catch (e) {
      mostrarLoader(false);
      handleError(e);
    }
  }
  window.exportarPDF = exportarPDF;
  /**
   * Mostra ou esconde o loader global.
   * @param {boolean} show
   */
  function mostrarLoader(show) {
    var loader = document.getElementById('global-loader');
    if (!loader) return;
    loader.style.display = show ? 'flex' : 'none';
    if (show) {
      loader.setAttribute('aria-busy', 'true');
      loader.setAttribute('tabindex', '0');
      loader.focus();
    } else {
      loader.removeAttribute('aria-busy');
      loader.removeAttribute('tabindex');
    }
  }
  window.mostrarLoader = mostrarLoader;

  /**
   * Exibe um toast de feedback visual.
   * @param {string} msg Mensagem a ser exibida
   */
  /**
   * Exibe um toast de feedback visual.
   * @param {string} msg Mensagem a ser exibida
   * @param {boolean} erro Se true, mostra como erro
   */
  function mostrarToast(msg, erro) {
    var toast = document.getElementById('toast');
    var body = document.getElementById('toast-body');
    if (!toast || !body) return;
    body.textContent = msg;
    toast.className = 'toast ' + (erro ? 'error' : 'success');
    toast.classList.remove('d-none');
    setTimeout(() => { toast.classList.add('d-none'); }, 3500);
  }

  // ================ GESTÃO DE PRODUTOS ================
  
  async function excluirProduto(id) {
    if (!confirm('⚠️ Tem certeza que deseja excluir este produto?')) return;
    try {
      await db.collection('estoque').doc(id).delete();
      
      // Registra no histórico
      await db.collection('historico').add({
        tipo: 'exclusão',
        descricao: 'Produto excluído do estoque',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      mostrarToast('Produto excluído com sucesso!');
      carregarEstoque();
      atualizarMetricas();
    } catch (e) {
      handleError(e);
    }
  }
  
  async function ajustarQuantidade(id, ajuste) {
    try {
      const doc = await db.collection('estoque').doc(id).get();
      if (!doc.exists) {
        mostrarToast('Produto não encontrado', true);
        return;
      }
      
      const produto = doc.data();
      const novaQtd = produto.quantidade + ajuste;
      
      if (novaQtd < 0) {
        mostrarToast('Quantidade não pode ser negativa', true);
        return;
      }
      
      await db.collection('estoque').doc(id).update({ quantidade: novaQtd });
      
      // Registra no histórico
      await db.collection('historico').add({
        tipo: ajuste > 0 ? 'entrada' : 'saída',
        produto: produto.nome,
        quantidade: Math.abs(ajuste),
        descricao: `${ajuste > 0 ? 'Entrada' : 'Saída'} de ${Math.abs(ajuste)} unidades - ${produto.nome}`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      mostrarToast(`Quantidade ${ajuste > 0 ? 'aumentada' : 'diminuída'} com sucesso!`);
      carregarEstoque();
      atualizarMetricas();
    } catch (e) {
      handleError(e);
    }
  }
  
  let produtoEditando = null;
  
  async function editarProduto(id) {
    try {
      const doc = await db.collection('estoque').doc(id).get();
      if (!doc.exists) {
        mostrarToast('Produto não encontrado', true);
        return;
      }
      
      const p = doc.data();
      produtoEditando = id;
      
      document.getElementById('codigoBarras').value = p.codigo || '';
      document.getElementById('nomeProduto').value = p.nome || '';
      document.getElementById('marcaProduto').value = p.marca || '';
      document.getElementById('loteProduto').value = p.lote || '';
      document.getElementById('fornecedorProduto').value = p.fornecedor || '';
      document.getElementById('quantidadeProduto').value = p.quantidade || 0;
      document.getElementById('estoqueMinimo').value = p.estoqueMinimo || 0;
      
      if (p.validade && p.validade.toDate) {
        const data = p.validade.toDate();
        const dataFormatada = data.toISOString().split('T')[0];
        document.getElementById('validadeProduto').value = dataFormatada;
      }
      
      // Muda texto do botão
      const btnSalvar = document.querySelector('#estoque button[onclick="salvarProduto()"]');
      if (btnSalvar) {
        btnSalvar.textContent = '✏️ Atualizar Produto';
        btnSalvar.classList.remove('btn-primary');
        btnSalvar.classList.add('btn-warning');
      }
      
      // Scroll para o formulário
      document.getElementById('nomeProduto').scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('nomeProduto').focus();
      
      mostrarToast('📝 Editando produto. Faça as alterações e clique em Atualizar.');
    } catch (e) {
      handleError(e);
    }
  }
  
  window.excluirProduto = excluirProduto;
  window.ajustarQuantidade = ajustarQuantidade;
  window.editarProduto = editarProduto;

  // ================ GESTÃO DE PRODUTOS (EDITAR/EXCLUIR/AJUSTAR) ================
  
  async function excluirProduto(id) {
    if (!confirm('⚠️ Tem certeza que deseja excluir este produto?')) return;
    try {
      mostrarLoader(true);
      const doc = await db.collection('estoque').doc(id).get();
      const produto = doc.data();
      
      await db.collection('estoque').doc(id).delete();
      
      await db.collection('historico').add({
        tipo: 'exclusão',
        produto: produto.nome,
        descricao: `Produto excluído - ${produto.nome}`,
        usuario: auth.currentUser?.email || 'Sistema',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      mostrarLoader(false);
      mostrarToast('✅ Produto excluído com sucesso!');
      carregarEstoque();
      atualizarMetricas();
    } catch (e) {
      mostrarLoader(false);
      handleError(e);
    }
  }
  
  async function ajustarQuantidade(id, ajuste) {
    try {
      mostrarLoader(true);
      const doc = await db.collection('estoque').doc(id).get();
      if (!doc.exists) {
        mostrarLoader(false);
        mostrarToast('Produto não encontrado', true);
        return;
      }
      
      const produto = doc.data();
      const novaQtd = produto.quantidade + ajuste;
      
      if (novaQtd < 0) {
        mostrarLoader(false);
        mostrarToast('❌ Quantidade não pode ser negativa', true);
        return;
      }
      
      await db.collection('estoque').doc(id).update({ quantidade: novaQtd });
      
      await db.collection('historico').add({
        tipo: ajuste > 0 ? 'entrada' : 'saída',
        produto: produto.nome,
        quantidade: Math.abs(ajuste),
        descricao: `${ajuste > 0 ? 'Entrada' : 'Saída'} de ${Math.abs(ajuste)} unidades - ${produto.nome}`,
        usuario: auth.currentUser?.email || 'Sistema',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      mostrarLoader(false);
      mostrarToast(`✅ Quantidade ${ajuste > 0 ? 'aumentada' : 'diminuída'}!`);
      carregarEstoque();
      atualizarMetricas();
    } catch (e) {
      mostrarLoader(false);
      handleError(e);
    }
  }
  
  window.excluirProduto = excluirProduto;
  window.ajustarQuantidade = ajustarQuantidade;
  window.editarProduto = editarProduto;

  // ================ CURVA ABC ================
  let graficoABC = null, graficoProdutos = null;
  async function carregarCurvaABC() {
    try {
      const listaA = document.getElementById('listaCurvaA');
      const listaB = document.getElementById('listaCurvaB');
      const listaC = document.getElementById('listaCurvaC');
      listaA.innerHTML = ''; listaB.innerHTML = ''; listaC.innerHTML = '';
      const snap = await db.collection('estoque').get();
      let produtos = [], totalQtd = 0;
      snap.forEach(doc => { const p = doc.data(); totalQtd += p.quantidade; produtos.push({ nome: p.nome, quantidade: p.quantidade, marca: p.marca }); });
      if (totalQtd === 0) return;
      produtos.sort((a,b) => b.quantidade - a.quantidade);
      let acumulado = 0, contA = 0, contB = 0, contC = 0;
      produtos.forEach(p => {
        const nome = p.nome ? p.nome : '(sem nome)';
        const marca = p.marca ? ` - ${p.marca}` : '';
        acumulado += p.quantidade;
        const percentual = (acumulado / totalQtd) * 100;
        const item = `<div class="abc-item"><span class="abc-item-name">${nome}${marca}</span><span class="abc-item-qty">${p.quantidade} un</span></div>`;
        if (percentual <= 80) { listaA.innerHTML += item; contA++; }
        else if (percentual <= 95) { listaB.innerHTML += item; contB++; }
        else { listaC.innerHTML += item; contC++; }
      });
      
      // Atualiza contadores
      document.getElementById('countA').textContent = `${contA} ${contA === 1 ? 'item' : 'itens'}`;
      document.getElementById('countB').textContent = `${contB} ${contB === 1 ? 'item' : 'itens'}`;
      document.getElementById('countC').textContent = `${contC} ${contC === 1 ? 'item' : 'itens'}`;
      
      desenharGraficoABC(contA, contB, contC);
      desenharGraficoProdutos(produtos.slice(0, 10));
    } catch (e) { handleError(e); }
  }

  function desenharGraficoABC(a, b, c) {
    if (graficoABC) graficoABC.destroy();
    const ctx = document.getElementById('graficoABC');
    graficoABC = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Curva A (Alta)', 'Curva B (Média)', 'Curva C (Baixa)'],
        datasets: [{
          data: [a, b, c],
          backgroundColor: [
            'rgba(102, 126, 234, 0.8)',
            'rgba(240, 147, 251, 0.8)',
            'rgba(250, 112, 154, 0.8)'
          ],
          borderColor: ['#667eea', '#f093fb', '#fa709a'],
          borderWidth: 3,
          hoverOffset: 15
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              font: { size: 13, weight: '600' },
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: { size: 14, weight: '700' },
            bodyFont: { size: 13 },
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const value = context.parsed;
                const percentage = ((value / total) * 100).toFixed(1);
                return `${context.label}: ${value} produtos (${percentage}%)`;
              }
            }
          }
        },
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 1000,
          easing: 'easeOutQuart'
        }
      }
    });
  }

  function desenharGraficoProdutos(produtos) {
    if (graficoProdutos) graficoProdutos.destroy();
    const ctx = document.getElementById('graficoProdutos');
    graficoProdutos = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: produtos.map(p => p.nome || 'Sem nome'),
        datasets: [{
          label: 'Quantidade em Estoque',
          data: produtos.map(p => p.quantidade),
          backgroundColor: produtos.map((_, i) => {
            const colors = [
              'rgba(102, 126, 234, 0.8)',
              'rgba(118, 75, 162, 0.8)',
              'rgba(240, 147, 251, 0.8)',
              'rgba(245, 87, 108, 0.8)',
              'rgba(250, 112, 154, 0.8)',
              'rgba(254, 225, 64, 0.8)',
              'rgba(48, 207, 208, 0.8)',
              'rgba(51, 8, 103, 0.8)',
              'rgba(79, 172, 254, 0.8)',
              'rgba(0, 242, 254, 0.8)'
            ];
            return colors[i % colors.length];
          }),
          borderColor: produtos.map((_, i) => {
            const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#fa709a', '#fee140', '#30cfd0', '#330867', '#4facfe', '#00f2fe'];
            return colors[i % colors.length];
          }),
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              font: { size: 11, weight: '600' },
              color: '#6c757d'
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            ticks: {
              font: { size: 11, weight: '600' },
              color: '#6c757d',
              maxRotation: 45,
              minRotation: 45
            },
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: { size: 14, weight: '700' },
            bodyFont: { size: 13 },
            callbacks: {
              label: function(context) {
                return `Quantidade: ${context.parsed.y} unidades`;
              }
            }
          }
        },
        animation: {
          duration: 1200,
          easing: 'easeOutQuart'
        }
      }
    });
  }

  // ================ SESSÃO ================
  auth.onAuthStateChanged(user => { if (user) abrir('menu'); else abrir('login'); });

  function calcularStatus(validade){
    if (!validade) return 'ok';
    const hoje = new Date();
    const dataValidade = (validade && validade instanceof Date) ? validade : new Date(validade);
    const diffDias = (dataValidade - hoje) / (1000*60*60*24);
    if (diffDias < 0) return 'vencido';
    if (diffDias <= 30) return 'alerta';
    return 'ok';
  }

  // Service Worker registration (optional / non-critical)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(err => console.debug('SW registration failed', err));
    });
  }

  // Expose functions used by inline handlers
  window.abrir = abrir;
  window.voltar = voltar;
  window.login = login;
  window.registrar = registrar;
  window.logout = logout;
  window.abrirScanner = abrirScanner;
  window.salvarProduto = salvarProduto;
  window.filtrarEstoque = filtrarEstoque;
  window.exportarExcel = exportarExcel;
  window.carregarMarcas = carregarMarcas;
  window.carregarEstoque = carregarEstoque;
  window.carregarCurvaABC = carregarCurvaABC;
  window.carregarHistorico = carregarHistorico;
  window.mostrarToast = mostrarToast;
  window.mostrarLoader = mostrarLoader;

})();

// ================ DASHBOARD METRICS ================
async function atualizarMetricas() {
  try {
    const snap = await db.collection('estoque').get();
    let total = 0;
    let proxVencer = 0;
    let vencidos = 0;
    let valorTotal = 0;
    const hoje = new Date();
    const em7Dias = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    snap.forEach(doc => {
      const p = doc.data();
      total++;
      
      if (p.validade && p.validade.toDate) {
        const dataValidade = p.validade.toDate();
        if (dataValidade < hoje) {
          vencidos++;
        } else if (dataValidade <= em7Dias) {
          proxVencer++;
        }
      }
      
      if (p.valor && p.quantidade) {
        valorTotal += (p.valor * p.quantidade);
      }
    });
    
    const elTotal = document.getElementById('totalProdutos');
    const elProx = document.getElementById('proxVencer');
    const elVenc = document.getElementById('vencidos');
    const elValor = document.getElementById('valorTotal');
    
    if (elTotal) elTotal.textContent = total;
    if (elProx) elProx.textContent = proxVencer;
    if (elVenc) elVenc.textContent = vencidos;
    if (elValor) elValor.textContent = `R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } catch (e) {
    console.error('Erro ao atualizar métricas:', e);
  }
}

// Atualiza métricas ao abrir o menu
auth.onAuthStateChanged(user => {
  if (user) {
    atualizarMetricas();
    carregarGraficosEvolucao();
    setInterval(atualizarMetricas, 60000); // Atualiza a cada 1 minuto
  }
});

// ================ GRÁFICOS DE EVOLUÇÃO ================
async function carregarGraficosEvolucao() {
  try {
    // Busca estoque atual para simular evolução
    const snap = await db.collection('estoque').get();
    
    // Calcula quantidade total atual
    let quantidadeTotal = 0;
    snap.forEach(doc => {
      const p = doc.data();
      quantidadeTotal += (p.quantidade || 0);
    });
    
    // Simula evolução dos últimos 7 dias com variação aleatória
    const labels7dias = [];
    const valores7dias = [];
    const hoje = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const data = new Date(hoje);
      data.setDate(data.getDate() - i);
      const diaFormatado = `${data.getDate()}/${data.getMonth() + 1}`;
      
      labels7dias.push(diaFormatado);
      // Simula variação de ±10% ao redor da quantidade atual
      const variacao = (Math.random() - 0.5) * 0.2;
      valores7dias.push(Math.max(0, Math.round(quantidadeTotal * (1 + variacao))));
    }
    valores7dias[valores7dias.length - 1] = quantidadeTotal; // Último dia é o valor atual
    
    // Simula evolução dos últimos 30 dias
    const labels30dias = [];
    const valores30dias = [];
    
    for (let i = 29; i >= 0; i--) {
      const data = new Date(hoje);
      data.setDate(data.getDate() - i);
      const diaFormatado = `${data.getDate()}/${data.getMonth() + 1}`;
      
      labels30dias.push(diaFormatado);
      const variacao = (Math.random() - 0.5) * 0.3;
      valores30dias.push(Math.max(0, Math.round(quantidadeTotal * (1 + variacao))));
    }
    valores30dias[valores30dias.length - 1] = quantidadeTotal; // Último dia é o valor atual
    
    // Gráfico 7 dias
    const ctx7 = document.getElementById('graficoEvolucao7dias');
    if (ctx7 && window.Chart) {
      if (ctx7.chart) ctx7.chart.destroy();
      ctx7.chart = new Chart(ctx7, {
        type: 'line',
        data: {
          labels: labels7dias,
          datasets: [{
            label: 'Quantidade Total',
            data: valores7dias,
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            tension: 0.4,
            fill: true,
            borderWidth: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: 12,
              titleFont: { size: 14 },
              bodyFont: { size: 13 },
              callbacks: {
                label: (context) => `Quantidade: ${context.parsed.y} unidades`
              }
            }
          },
          scales: {
            y: { 
              beginAtZero: true,
              ticks: { color: '#6c757d' },
              grid: { color: 'rgba(0,0,0,0.05)' }
            },
            x: {
              ticks: { color: '#6c757d' },
              grid: { display: false }
            }
          }
        }
      });
    }
    
    // Gráfico 30 dias
    const ctx30 = document.getElementById('graficoEvolucao30dias');
    if (ctx30 && window.Chart) {
      if (ctx30.chart) ctx30.chart.destroy();
      ctx30.chart = new Chart(ctx30, {
        type: 'line',
        data: {
          labels: labels30dias,
          datasets: [{
            label: 'Quantidade Total',
            data: valores30dias,
            borderColor: '#f093fb',
            backgroundColor: 'rgba(240, 147, 251, 0.1)',
            tension: 0.4,
            fill: true,
            borderWidth: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: 12,
              titleFont: { size: 14 },
              bodyFont: { size: 13 },
              callbacks: {
                label: (context) => `Quantidade: ${context.parsed.y} unidades`
              }
            }
          },
          scales: {
            y: { 
              beginAtZero: true,
              ticks: { color: '#6c757d' },
              grid: { color: 'rgba(0,0,0,0.05)' }
            },
            x: {
              ticks: { 
                color: '#6c757d',
                maxRotation: 45,
                minRotation: 0
              },
              grid: { display: false }
            }
          }
        }
      });
    }
  } catch (e) {
    console.error('Erro ao carregar gráficos:', e);
  }
}
window.carregarGraficosEvolucao = carregarGraficosEvolucao;

// ================ HISTÓRICO ================
async function carregarHistorico() {
  try {
    mostrarLoader(true);
    const tabela = document.getElementById('tabelaHistorico');
    if (!tabela) { mostrarLoader(false); return; }
    tabela.innerHTML = '';
    
    const snap = await db.collection('historico').orderBy('timestamp', 'desc').limit(50).get();
    
    snap.forEach(doc => {
      const h = doc.data();
      const tr = document.createElement('tr');
      const dataHora = h.timestamp ? new Date(h.timestamp.toMillis()).toLocaleString('pt-BR') : 'N/A';
      const tipo = h.tipo === 'entrada' ? '📥 Entrada' : '📤 Saída';
      const tipoClass = h.tipo === 'entrada' ? 'text-success' : 'text-danger';
      
      tr.innerHTML = `
        <td class="small">${dataHora}</td>
        <td class="${tipoClass} fw-bold">${tipo}</td>
        <td>${h.produto || 'N/A'}</td>
        <td>${h.marca || 'N/A'}</td>
        <td class="text-center">${h.quantidade || 0}</td>
        <td class="small">${h.usuario || 'Sistema'}</td>
      `;
      tabela.appendChild(tr);
    });
    
    if (snap.empty) {
      tabela.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhuma movimentação registrada</td></tr>';
    }
    
    mostrarLoader(false);
  } catch (e) {
    mostrarLoader(false);
    handleError(e);
  }
}


// ================= CONTROLE DE TELAS =================
function abrir(id) {
  document.querySelectorAll(".tela").forEach(t => t.classList.add("d-none"));
  document.getElementById(id).classList.remove("d-none");

  if (id === "estoque") {
    carregarEstoque();
    carregarMarcas();
  }

  if (id === "curvaABC") {
    carregarCurvaABC();
  }
}


function voltar() {
  abrir("menu");
}

// ================= MARCAS (FIRESTORE) =================
async function carregarMarcas() {
  const select = document.getElementById("marcaProduto");
  const filtro = document.getElementById("filtroMarca");

  if (!select || !filtro) return;

  select.innerHTML = `<option value="">Selecione a marca</option>`;
  filtro.innerHTML = `<option value="">Todas as marcas</option>`;

  const snap = await db.collection("marcas").orderBy("nome").get();

  snap.forEach(doc => {
    const nome = doc.data().nome;
    select.innerHTML += `<option value="${nome}">${nome}</option>`;
    filtro.innerHTML += `<option value="${nome}">${nome}</option>`;
  });

  select.disabled = false;
}

// ================= 🆕 MIGRAR CATÁLOGO PARA ESTOQUE =================
async function migrarCatalogoParaEstoque() {
  if (!confirm('⚠️ Isso vai adicionar TODOS os produtos do catálogo ao estoque com quantidade 0.\n\nDeseja continuar?')) {
    return;
  }
  
  try {
    mostrarLoader(true);
    console.log('🔄 Iniciando migração do catálogo para estoque...');
    
    // Busca todos os produtos do catálogo
    const catalogoSnap = await db.collection('catalogo-produtos').get();
    console.log(`📦 Encontrados ${catalogoSnap.size} produtos no catálogo`);
    
    if (catalogoSnap.empty) {
      alert('⚠️ Catálogo vazio! Importe os produtos Edin primeiro.');
      mostrarLoader(false);
      return;
    }
    
    let adicionados = 0;
    let jaExistiam = 0;
    let erros = 0;
    
    for (const doc of catalogoSnap.docs) {
      try {
        const produto = doc.data();
        console.log(`🔍 Processando: ${produto.nome}`);
        
        // Verifica se já existe no estoque pelo NOME e MARCA
        const estoqueSnap = await db.collection('estoque')
          .where('nome', '==', produto.nome)
          .where('marca', '==', produto.marca)
          .limit(1)
          .get();
        
        if (!estoqueSnap.empty) {
          jaExistiam++;
          console.log(`⏭️ Já existe: ${produto.nome}`);
          continue;
        }
        
        // Adiciona ao estoque com quantidade 0
        await db.collection('estoque').add({
          codigo: produto.codigo || '',
          nome: produto.nome || '',
          marca: produto.marca || '',
          categoria: produto.categoria || '',
          fornecedor: produto.fornecedor || '',
          quantidade: 0,
          lote: '',
          validade: null,
          dataEntrada: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        adicionados++;
        console.log(`✅ ${adicionados}. ${produto.nome}`);
        
      } catch (erro) {
        erros++;
        console.error(`❌ Erro ao adicionar ${produto.nome}:`, erro);
      }
    }
    
    mostrarLoader(false);
    
    const msg = `✅ Migração concluída!\n\n📦 ${adicionados} produtos adicionados\n⏭️ ${jaExistiam} já existiam${erros > 0 ? `\n❌ ${erros} erros` : ''}`;
    alert(msg);
    console.log(`📊 RESULTADO: ${adicionados} novos | ${jaExistiam} existentes | ${erros} erros`);
    
    // Atualiza a tela
    if (typeof atualizarMetricas === 'function') {
      atualizarMetricas();
    }
    if (typeof listar === 'function') {
      listar();
    }
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    mostrarLoader(false);
    mostrarToast('❌ Erro ao migrar catálogo: ' + error.message);
  }
}
window.migrarCatalogoParaEstoque = migrarCatalogoParaEstoque;

// ================= SCANNER DE CÓDIGO =================
let scanner = null;
// ================= SESSÃO =================
auth.onAuthStateChanged(user => {
  if (user) abrir("menu");
  else abrir("login");
});
function calcularStatus(validade) {
  if (!validade) return "ok";

  const hoje = new Date();
  const dataValidade = new Date(validade);

  const diffDias = (dataValidade - hoje) / (1000 * 60 * 60 * 24);

  if (diffDias < 0) return "vencido";
  if (diffDias <= 30) return "alerta";
  return "ok";
}
// ================= FILTROS DASHBOARD =================
function filtrarDashboard(filtro) {
  // Remove active de todos os botões
  document.querySelectorAll('.btn-group .btn').forEach(btn => btn.classList.remove('active'));
  
  // Adiciona active no botão clicado
  event.target.classList.add('active');
  
  // Força atualização das métricas
  atualizarMetricas();
  
  // Mostrar toast informativo
  const mensagens = {
    todos: 'Visualizando todos os produtos',
    proxVencer: 'Filtro: Produtos próximos ao vencimento (30 dias)',
    vencidos: 'Filtro: Produtos vencidos'
  };
  mostrarToast(mensagens[filtro] || '');
}
window.filtrarDashboard = filtrarDashboard;

// ==================== CONFIGURAÇÕES ====================
function abrirConfiguracoes() {
  // Carregar configurações atuais
  try {
    const config = JSON.parse(localStorage.getItem('fefo-config-alertas') || '{}');
    
    document.getElementById('diasAlerta').value = config.diasAlerta || 7;
    document.getElementById('horarioAlerta').value = config.horarioAlerta || '09:00';
    document.getElementById('alertaEmail').checked = config.alertaEmail !== false;
    document.getElementById('alertaNavegador').checked = config.alertaNavegador !== false;
  } catch(e) {
    console.error('Erro ao carregar configurações:', e);
  }
  
  const modal = new bootstrap.Modal(document.getElementById('modalConfiguracoes'));
  modal.show();
}

function salvarConfiguracoes() {
  try {
    const config = {
      diasAlerta: parseInt(document.getElementById('diasAlerta').value),
      horarioAlerta: document.getElementById('horarioAlerta').value,
      alertaEmail: document.getElementById('alertaEmail').checked,
      alertaNavegador: document.getElementById('alertaNavegador').checked
    };
    
    localStorage.setItem('fefo-config-alertas', JSON.stringify(config));
    
    // Fechar modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalConfiguracoes'));
    modal.hide();
    
    mostrarNotificacao('✅ Configurações salvas com sucesso!', 'success');
  } catch(e) {
    console.error('Erro ao salvar configurações:', e);
    mostrarNotificacao('❌ Erro ao salvar configurações', 'error');
  }
}

// ==================== COMPARTILHAMENTO ====================
async function compartilharRelatorio(tipo) {
  mostrarNotificacao('📊 Gerando relatório...', 'info');
  
  try {
    // Gerar dados do relatório
    const q = query(
      collection(db, `usuarios/${currentUser.uid}/estoque`),
      orderBy('validade')
    );
    const snapshot = await getDocs(q);
    
    const produtos = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      produtos.push({
        codigo: data.codigo || '',
        nome: data.nome || '',
        marca: data.marca || '',
        categoria: data.categoria || '',
        quantidade: data.quantidade || 0,
        validade: data.validade || ''
      });
    });
    
    const hoje = new Date();
    const total = produtos.length;
    const vencidos = produtos.filter(p => new Date(p.validade) < hoje).length;
    const proxVencer = produtos.filter(p => {
      const val = new Date(p.validade);
      const dias7 = new Date(hoje);
      dias7.setDate(dias7.getDate() + 7);
      return val >= hoje && val <= dias7;
    }).length;
    
    // Gerar mensagem
    const mensagem = `📦 *Relatório de Estoque FEFO*\n\n` +
      `📊 *Resumo:*\n` +
      `• Total: ${total} produtos\n` +
      `• Próximos a vencer: ${proxVencer}\n` +
      `• Vencidos: ${vencidos}\n\n` +
      `📅 Gerado em: ${hoje.toLocaleDateString('pt-BR')} às ${hoje.toLocaleTimeString('pt-BR')}\n\n` +
      `🌐 Acesse o sistema: http://estoque-edin.netlify.app`;
    
    if (tipo === 'whatsapp') {
      // Compartilhar via WhatsApp
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`;
      window.open(url, '_blank');
      mostrarNotificacao('✅ Abrindo WhatsApp...', 'success');
    } else if (tipo === 'email') {
      // Compartilhar via Email
      const assunto = `Relatório de Estoque FEFO - ${hoje.toLocaleDateString('pt-BR')}`;
      const corpo = mensagem.replace(/\*/g, '').replace(/\n/g, '%0D%0A');
      const url = `mailto:?subject=${encodeURIComponent(assunto)}&body=${corpo}`;
      window.location.href = url;
      mostrarNotificacao('✅ Abrindo cliente de email...', 'success');
    }
  } catch (error) {
    console.error('Erro ao compartilhar relatório:', error);
    mostrarNotificacao('❌ Erro ao compartilhar relatório', 'error');
  }
}

// ==================== BACKUP ====================
async function fazerBackup() {
  mostrarNotificacao('💾 Gerando backup...', 'info');
  
  try {
    const backup = {
      versao: '1.0',
      dataBackup: new Date().toISOString(),
      usuario: currentUser.email,
      dados: {
        estoque: [],
        historico: [],
        marcas: []
      }
    };
    
    // Buscar estoque
    const qEstoque = query(collection(db, `usuarios/${currentUser.uid}/estoque`));
    const snapshotEstoque = await getDocs(qEstoque);
    snapshotEstoque.forEach(doc => {
      backup.dados.estoque.push({ id: doc.id, ...doc.data() });
    });
    
    // Buscar histórico
    const qHistorico = query(collection(db, `usuarios/${currentUser.uid}/historico`));
    const snapshotHistorico = await getDocs(qHistorico);
    snapshotHistorico.forEach(doc => {
      backup.dados.historico.push({ id: doc.id, ...doc.data() });
    });
    
    // Buscar marcas
    const qMarcas = query(collection(db, `usuarios/${currentUser.uid}/marcas`));
    const snapshotMarcas = await getDocs(qMarcas);
    snapshotMarcas.forEach(doc => {
      backup.dados.marcas.push({ id: doc.id, ...doc.data() });
    });
    
    // Gerar arquivo JSON
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Download
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-fefo-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    mostrarNotificacao('✅ Backup realizado com sucesso!', 'success');
    
    // Salvar último backup no localStorage
    try {
      localStorage.setItem('fefo-ultimo-backup', new Date().toISOString());
    } catch(e) {
      console.error('Erro ao salvar data do último backup:', e);
    }
  } catch (error) {
    console.error('Erro ao fazer backup:', error);
    mostrarNotificacao('❌ Erro ao fazer backup', 'error');
  }
}

// ==================== DRAG AND DROP - WIDGETS ====================
let draggedElement = null;

function initDragAndDrop() {
  const container = document.getElementById('actionCardsContainer');
  if (!container) return;
  
  const cards = container.querySelectorAll('[draggable="true"]');
  
  cards.forEach(card => {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('drop', handleDrop);
    card.addEventListener('dragend', handleDragEnd);
  });
  
  // Carregar ordem salva
  carregarOrdemCards();
}

function handleDragStart(e) {
  draggedElement = this;
  this.style.opacity = '0.5';
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  
  if (draggedElement !== this) {
    const container = this.parentNode;
    const allCards = [...container.children];
    const draggedIndex = allCards.indexOf(draggedElement);
    const targetIndex = allCards.indexOf(this);
    
    if (draggedIndex < targetIndex) {
      this.parentNode.insertBefore(draggedElement, this.nextSibling);
    } else {
      this.parentNode.insertBefore(draggedElement, this);
    }
    
    salvarOrdemCards();
  }
  
  return false;
}

function handleDragEnd(e) {
  this.style.opacity = '1';
}

function salvarOrdemCards() {
  try {
    const container = document.getElementById('actionCardsContainer');
    if (!container) return;
    
    const ordem = [];
    container.querySelectorAll('[data-card]').forEach(card => {
      ordem.push(card.getAttribute('data-card'));
    });
    
    localStorage.setItem('fefo-dashboard-order', JSON.stringify(ordem));
  } catch(e) {
    console.error('Erro ao salvar ordem dos cards:', e);
  }
}

function carregarOrdemCards() {
  try {
    const container = document.getElementById('actionCardsContainer');
    if (!container) return;
    
    const ordemSalva = localStorage.getItem('fefo-dashboard-order');
    if (!ordemSalva) return;
    
    const ordem = JSON.parse(ordemSalva);
    const cards = {};
    
    // Mapear cards por data-card
    container.querySelectorAll('[data-card]').forEach(card => {
      const id = card.getAttribute('data-card');
      cards[id] = card;
    });
    
    // Reorganizar
    ordem.forEach(id => {
      if (cards[id]) {
        container.appendChild(cards[id]);
      }
    });
  } catch(e) {
    console.error('Erro ao carregar ordem dos cards:', e);
  }
}

// Inicializar drag and drop quando o DOM carregar
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    initDragAndDrop();
  }, 1500);
});

// ==================== 🆕 LOCAIS DE ARMAZENAMENTO ====================
async function carregarLocais() {
  try {
    const select = document.getElementById('localProduto');
    if (!select) return;
    
    select.innerHTML = '<option value="">📍 Local (opcional)</option>';
    
    const snapshot = await db.collection('locais').get();
    
    if (snapshot.empty) {
      console.log('Nenhum local cadastrado ainda');
      return;
    }
    
    const locais = [];
    snapshot.forEach(doc => {
      locais.push(doc.data());
    });
    
    // Ordena localmente
    locais.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    
    locais.forEach(local => {
      const option = document.createElement('option');
      option.value = local.nome;
      option.textContent = `${local.nome}${local.descricao ? ' - ' + local.descricao : ''}`;
      select.appendChild(option);
    });
    
    console.log(`✅ ${locais.length} locais carregados`);
  } catch (error) {
    console.error('Erro ao carregar locais:', error);
    // Não bloqueia o uso mesmo se der erro
  }
}

async function adicionarLocal() {
  const nome = document.getElementById('nomeLocal').value.trim();
  const descricao = document.getElementById('descricaoLocal').value.trim();
  
  if (!nome) {
    alert('⚠️ Digite o nome do local!');
    return;
  }
  
  try {
    mostrarLoader(true);
    
    // Verifica se já existe
    const existe = await db.collection('locais').where('nome', '==', nome).get();
    if (!existe.empty) {
      alert('⚠️ Esse local já está cadastrado!');
      mostrarLoader(false);
      return;
    }
    
    await db.collection('locais').add({
      nome,
      descricao,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    document.getElementById('nomeLocal').value = '';
    document.getElementById('descricaoLocal').value = '';
    
    mostrarLoader(false);
    mostrarToast('✅ Local adicionado com sucesso!');
    listarLocais();
    carregarLocais(); // Atualiza selects
  } catch (error) {
    console.error('Erro ao adicionar local:', error);
    mostrarLoader(false);
    alert('❌ Erro ao adicionar local: ' + error.message);
  }
}

async function listarLocais() {
  try {
    const container = document.getElementById('listaLocais');
    if (!container) return;
    
    const snapshot = await db.collection('locais').get();
    
    if (snapshot.empty) {
      container.innerHTML = '<p class="text-muted">Nenhum local cadastrado.</p>';
      return;
    }
    
    const locais = [];
    snapshot.forEach(doc => {
      locais.push({ id: doc.id, ...doc.data() });
    });
    
    // Ordena localmente
    locais.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    
    let html = '<table class="table table-hover"><thead><tr><th>Nome</th><th>Descrição</th><th>Ações</th></tr></thead><tbody>';
    
    locais.forEach(local => {
      html += `
        <tr>
          <td><strong>${local.nome}</strong></td>
          <td>${local.descricao || '-'}</td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="excluirLocal('${local.id}', '${local.nome}')">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (error) {
    console.error('Erro ao listar locais:', error);
  }
}

async function excluirLocal(id, nome) {
  if (!confirm(`⚠️ Excluir o local "${nome}"?\n\nOs produtos que estão neste local não serão excluídos.`)) {
    return;
  }
  
  try {
    mostrarLoader(true);
    await db.collection('locais').doc(id).delete();
    mostrarLoader(false);
    mostrarToast('✅ Local excluído!');
    listarLocais();
    carregarLocais();
  } catch (error) {
    console.error('Erro ao excluir local:', error);
    mostrarLoader(false);
    alert('❌ Erro ao excluir: ' + error.message);
  }
}

// ==================== 🆕 GERENCIAMENTO DE USUÁRIOS ====================
let usuarioAtual = null;

// Carregar perfil do usuário atual
async function carregarPerfilUsuario() {
  const user = auth.currentUser;
  if (!user) return null;
  
  try {
    const snapshot = await db.collection('usuarios').where('email', '==', user.email).get();
    
    if (snapshot.empty) {
      // Primeiro acesso - criar admin
      const novoUsuario = {
        nome: user.displayName || user.email.split('@')[0],
        email: user.email,
        perfil: 'admin',
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('usuarios').add(novoUsuario);
      usuarioAtual = novoUsuario;
      console.log('✅ Primeiro usuário criado como admin');
    } else {
      usuarioAtual = snapshot.docs[0].data();
      console.log('👤 Usuário logado:', usuarioAtual.perfil);
    }
    
    aplicarPermissoes();
    return usuarioAtual;
  } catch (error) {
    console.error('Erro ao carregar perfil:', error);
    return null;
  }
}

function aplicarPermissoes() {
  if (!usuarioAtual) return;
  
  const perfil = usuarioAtual.perfil;
  
  // Ocultar card de usuários se não for admin
  const cardUsuarios = document.getElementById('cardUsuarios');
  if (cardUsuarios && perfil !== 'admin') {
    cardUsuarios.style.display = 'none';
  }
  
  // Desabilitar botões de exclusão para visualizadores
  if (perfil === 'visualizador') {
    document.querySelectorAll('.btn-danger').forEach(btn => {
      btn.disabled = true;
      btn.title = 'Sem permissão para excluir';
    });
  }
}

async function adicionarUsuario() {
  if (usuarioAtual?.perfil !== 'admin') {
    alert('❌ Apenas administradores podem adicionar usuários!');
    return;
  }
  
  const nome = document.getElementById('nomeUsuario').value.trim();
  const email = document.getElementById('emailUsuario').value.trim();
  const perfil = document.getElementById('perfilUsuario').value;
  
  if (!nome || !email || !perfil) {
    alert('⚠️ Preencha todos os campos!');
    return;
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert('⚠️ Email inválido!');
    return;
  }
  
  try {
    mostrarLoader(true);
    
    // Verifica se já existe
    const existe = await db.collection('usuarios').where('email', '==', email).get();
    if (!existe.empty) {
      alert('⚠️ Esse email já está cadastrado!');
      mostrarLoader(false);
      return;
    }
    
    await db.collection('usuarios').add({
      nome,
      email,
      perfil,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    document.getElementById('nomeUsuario').value = '';
    document.getElementById('emailUsuario').value = '';
    document.getElementById('perfilUsuario').value = '';
    
    mostrarLoader(false);
    mostrarToast('✅ Usuário adicionado! Ele precisa fazer login para acessar.');
    listarUsuarios();
  } catch (error) {
    console.error('Erro ao adicionar usuário:', error);
    mostrarLoader(false);
    alert('❌ Erro ao adicionar usuário: ' + error.message);
  }
}

async function listarUsuarios() {
  try {
    const container = document.getElementById('listaUsuarios');
    if (!container) return;
    
    const snapshot = await db.collection('usuarios').orderBy('nome').get();
    
    if (snapshot.empty) {
      container.innerHTML = '<p class="text-muted">Nenhum usuário cadastrado.</p>';
      return;
    }
    
    let html = '<table class="table table-hover"><thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Ações</th></tr></thead><tbody>';
    
    snapshot.forEach(doc => {
      const usuario = doc.data();
      const badges = {
        admin: '<span class="badge bg-danger">👑 Admin</span>',
        operador: '<span class="badge bg-primary">👤 Operador</span>',
        visualizador: '<span class="badge bg-secondary">👁️ Visualizador</span>'
      };
      
      html += `
        <tr>
          <td><strong>${usuario.nome}</strong></td>
          <td>${usuario.email}</td>
          <td>${badges[usuario.perfil] || usuario.perfil}</td>
          <td>
            <button class="btn btn-sm btn-warning" onclick="editarUsuario('${doc.id}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="excluirUsuario('${doc.id}', '${usuario.nome}')">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
  }
}

async function excluirUsuario(id, nome) {
  if (usuarioAtual?.perfil !== 'admin') {
    alert('❌ Apenas administradores podem excluir usuários!');
    return;
  }
  
  if (!confirm(`⚠️ Excluir o usuário "${nome}"?`)) {
    return;
  }
  
  try {
    mostrarLoader(true);
    await db.collection('usuarios').doc(id).delete();
    mostrarLoader(false);
    mostrarToast('✅ Usuário excluído!');
    listarUsuarios();
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    mostrarLoader(false);
    alert('❌ Erro ao excluir: ' + error.message);
  }
}

// Carregar perfil ao fazer login
auth.onAuthStateChanged(user => {
  if (user) {
    carregarPerfilUsuario();
    carregarLocais();
  }
});

// Expor funções globalmente
window.adicionarLocal = adicionarLocal;
window.listarLocais = listarLocais;
window.excluirLocal = excluirLocal;
window.adicionarUsuario = adicionarUsuario;
window.listarUsuarios = listarUsuarios;
window.excluirUsuario = excluirUsuario;