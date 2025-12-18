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
  
  if (!alertaNavegador || !auth.currentUser) return;
  
  const agora = new Date();
  const dataLimite = new Date(agora.getTime() + diasAlerta * 24 * 60 * 60 * 1000);
  
  getCollection('estoque').get().then(snap => {
    snap.docs.forEach(doc => {
      const p = doc.data();
      if (p.dataValidade && p.dataValidade.toDate) {
        const dataValidade = p.dataValidade.toDate();
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

// ================ VARIÁVEIS GLOBAIS ================
let usuarioAtual = null;
let empresaAtual = null;

// Controle de segurança do login
let tentativasLogin = 0;
let bloqueioLogin = false;
let tempoBloqueio = null;

// Timeout de sessão (30 minutos de inatividade)
let timeoutSessao = null;
const TEMPO_INATIVIDADE = 30 * 60 * 1000; // 30 minutos

// Seleção múltipla para bulk operations
let produtosSelecionados = new Set();
let modoSelecaoAtivo = false;

// Histórico de ações para undo
let historicoAcoes = [];
const MAX_HISTORICO = 50;

// Cache inteligente
const cache = {
  data: new Map(),
  tempos: new Map(),
  TTL: 5 * 60 * 1000, // 5 minutos
  
  set(key, value) {
    this.data.set(key, value);
    this.tempos.set(key, Date.now());
  },
  
  get(key) {
    const tempo = this.tempos.get(key);
    if (!tempo || Date.now() - tempo > this.TTL) {
      this.data.delete(key);
      this.tempos.delete(key);
      return null;
    }
    return this.data.get(key);
  },
  
  clear() {
    this.data.clear();
    this.tempos.clear();
  }
};

// ================ UTILITÁRIOS PROFISSIONAIS ================

// Sanitização contra XSS
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Debounce para otimizar buscas
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle para scroll e resize
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Retry automático para operações que falham
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
}

// Validação avançada de email
function isValidEmail(email) {
  const regex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return regex.test(email) && email.length <= 254;
}

// Validação de senha forte
function isStrongPassword(password) {
  if (password.length < 8) return { valid: false, message: 'Mínimo 8 caracteres' };
  if (!/[a-z]/.test(password)) return { valid: false, message: 'Precisa de letras minúsculas' };
  if (!/[A-Z]/.test(password)) return { valid: false, message: 'Precisa de letras maiúsculas' };
  if (!/\d/.test(password)) return { valid: false, message: 'Precisa de números' };
  if (password.length > 128) return { valid: false, message: 'Máximo 128 caracteres' };
  return { valid: true };
}

// Formatação de números com locale
function formatNumber(num) {
  return new Intl.NumberFormat('pt-BR').format(num);
}

// Formatação de moeda
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Compressão de dados para localStorage
function compressData(data) {
  return btoa(encodeURIComponent(JSON.stringify(data)));
}

function decompressData(compressed) {
  try {
    return JSON.parse(decodeURIComponent(atob(compressed)));
  } catch {
    return null;
  }
}

// Validador de CNPJ profissional
function isValidCNPJ(cnpj) {
  if (!cnpj) return false;
  
  // Remove caracteres não numéricos
  cnpj = cnpj.replace(/[^\d]/g, '');
  
  // Verifica tamanho
  if (cnpj.length !== 14) return false;
  
  // Verifica CNPJs inválidos conhecidos
  if (/^(\d)\1+$/.test(cnpj)) return false;
  
  // Valida dígitos verificadores
  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  let digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado != digitos.charAt(0)) return false;
  
  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  return resultado == digitos.charAt(1);
}

// Validador de telefone brasileiro
function isValidPhone(phone) {
  if (!phone) return false;
  
  // Remove caracteres não numéricos
  phone = phone.replace(/[^\d]/g, '');
  
  // Verifica se tem 10 ou 11 dígitos (com DDD)
  if (phone.length < 10 || phone.length > 11) return false;
  
  // Verifica se o DDD é válido (11-99)
  const ddd = parseInt(phone.substring(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  
  return true;
}

// Formatar CNPJ
function formatCNPJ(cnpj) {
  cnpj = cnpj.replace(/[^\d]/g, '');
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

// Formatar telefone
function formatPhone(phone) {
  phone = phone.replace(/[^\d]/g, '');
  if (phone.length === 11) {
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (phone.length === 10) {
    return phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
}

// Detector de conexão offline
let isOnline = navigator.onLine;
let offlineQueue = [];

window.addEventListener('online', async () => {
  isOnline = true;
  mostrarToast('✅ Conexão restaurada', 'success');
  
  // Processar fila offline
  if (offlineQueue.length > 0) {
    mostrarToast(`🔄 Sincronizando ${offlineQueue.length} operações...`, 'info');
    for (const operation of offlineQueue) {
      try {
        await operation();
      } catch (error) {
        console.error('Erro ao sincronizar:', error);
      }
    }
    offlineQueue = [];
    mostrarToast('✅ Sincronização concluída', 'success');
  }
});

window.addEventListener('offline', () => {
  isOnline = false;
  mostrarToast('⚠️ Sem conexão. Operações serão sincronizadas quando voltar online.', 'warning');
});

// Logger estruturado para debugging
const logger = {
  info(message, data = {}) {
    console.log(`ℹ️ [INFO] ${new Date().toISOString()} - ${message}`, data);
  },
  warn(message, data = {}) {
    console.warn(`⚠️ [WARN] ${new Date().toISOString()} - ${message}`, data);
  },
  error(message, error = {}) {
    console.error(`❌ [ERROR] ${new Date().toISOString()} - ${message}`, error);
    // Em produção, enviar para serviço de monitoramento
  },
  debug(message, data = {}) {
    if (window.location.hostname === 'localhost') {
      console.log(`🐛 [DEBUG] ${new Date().toISOString()} - ${message}`, data);
    }
  }
};

function resetarTimeoutSessao() {
  if (timeoutSessao) clearTimeout(timeoutSessao);
  if (auth.currentUser) {
    timeoutSessao = setTimeout(() => {
      mostrarToast('⏱️ Sessão expirada por inatividade. Faça login novamente.', 'warning');
      logout();
    }, TEMPO_INATIVIDADE);
  }
}

// Detectar atividade do usuário
if (typeof window !== 'undefined') {
  ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(evento => {
    document.addEventListener(evento, resetarTimeoutSessao, true);
  });
}

// Função auxiliar para obter caminho da coleção isolada por usuário
function getCollection(collectionName) {
  if (!auth.currentUser) {
    console.error('Usuário não autenticado');
    throw new Error('Usuário não autenticado');
  }
  return db.collection('usuarios').doc(auth.currentUser.uid).collection(collectionName);
}

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
  // Toggle sidebar (desktop e mobile)
  window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    if (sidebar && mainContent) {
      sidebar.classList.toggle('collapsed');
      mainContent.classList.toggle('sidebar-collapsed');
    }
  }

  // Fechar sidebar ao clicar fora (mobile)
  document.addEventListener('click', function(e) {
    const sidebar = document.getElementById('sidebar');
    const btnToggle = document.querySelector('.btn-toggle-sidebar');
    
    if (window.innerWidth <= 768 && sidebar && !sidebar.classList.contains('collapsed')) {
      if (!sidebar.contains(e.target) && !btnToggle?.contains(e.target)) {
        sidebar.classList.add('collapsed');
      }
    }
  });

  function abrir(id) {
    console.log('📂 Abrindo tela:', id);
    
    // Fechar sidebar em mobile após clicar no menu
    if (window.innerWidth <= 768) {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.add('collapsed');
    }
    
    // Esconde todas as telas (exceto login)
    document.querySelectorAll('.tela').forEach(t => {
      if (t.id !== 'login') {
        t.style.display = 'none';
      }
    });
    
    // Busca a tela
    const el = document.getElementById(id);
    if (!el) {
      console.error('❌ Tela não encontrada:', id);
      alert(`Erro: Tela "${id}" não encontrada. Limpe o cache do navegador (Ctrl+Shift+Delete)`);
      return;
    }
    
    // Mostra a tela
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
    // Verificar se está bloqueado
    if (bloqueioLogin) {
      const tempoRestante = Math.ceil((tempoBloqueio - Date.now()) / 1000);
      if (tempoRestante > 0) {
        mostrarToast(`🔒 Muitas tentativas. Aguarde ${tempoRestante}s`, 'error');
        return;
      } else {
        // Desbloqueio automático
        bloqueioLogin = false;
        tentativasLogin = 0;
      }
    }
    
    try {
      const email = sanitizeInput(document.getElementById('email').value);
      const senha = document.getElementById('senha').value;
      
      // Validações avançadas
      if (!email || !senha) { 
        mostrarToast('⚠️ Preencha email e senha', 'warning'); 
        return; 
      }
      
      // Validar formato de email com função profissional
      if (!isValidEmail(email)) {
        mostrarToast('⚠️ Email inválido. Verifique o formato.', 'warning');
        return;
      }
      
      // Verificar tamanho da senha
      if (senha.length < 6 || senha.length > 128) {
        mostrarToast('⚠️ Senha inválida', 'warning');
        return;
      }
      
      // Mostrar loading
      mostrarLoader(true);
      
      // Tentar login com retry automático
      const userCredential = await retryOperation(
        () => auth.signInWithEmailAndPassword(email, senha),
        2,
        1000
      );
      const user = userCredential.user;
      
      console.log('👤 UID do usuário:', user.uid);
      console.log('📧 Email do usuário:', user.email);
      
      // Carregar dados da empresa
      const empresaDoc = await db.collection('usuarios').doc(user.uid).get();
      console.log('📄 Documento existe?', empresaDoc.exists);
      
      if (empresaDoc.exists) {
        empresaAtual = empresaDoc.data();
        console.log('📦 Dados carregados do Firebase:', empresaAtual);
        
        // VERIFICAR SE CONTA ESTÁ SUSPENSA
        if (empresaAtual.status === 'suspenso') {
          console.error('🚫 Conta suspensa!');
          await auth.signOut();
          mostrarToast('⛔ Sua conta foi suspensa. Entre em contato com o suporte.', 'error');
          return;
        }
        
        usuarioAtual = {
          uid: user.uid,
          email: user.email,
          ...empresaAtual
        };
      } else {
        console.log('⚠️ Documento não existe! Criando novo...');
        // Primeira vez - criar perfil básico
        empresaAtual = {
          nomeEmpresa: email.split('@')[0],
          email: email,
          dataCriacao: firebase.firestore.FieldValue.serverTimestamp(),
          plano: 'gratuito',
          isAdmin: false  // Novo usuário não é admin por padrão
        };
        await db.collection('usuarios').doc(user.uid).set(empresaAtual);
        usuarioAtual = { uid: user.uid, email: user.email, ...empresaAtual };
        console.log('✅ Novo documento criado:', empresaAtual);
      }
      
      // Esconder login
      document.getElementById('login').style.display = 'none';
      
      // Mostrar sidebar e main content
      const sidebar = document.getElementById('sidebar');
      const mainContent = document.getElementById('mainContent');
      if (sidebar) sidebar.classList.remove('d-none');
      if (mainContent) mainContent.classList.remove('d-none');
      
      // Atualizar nome do usuário no header
      const userName = document.getElementById('userName');
      if (userName) userName.textContent = email;
      
      // Atualizar nome da empresa no header
      const nomeEmpresaEl = document.getElementById('nomeEmpresa');
      if (nomeEmpresaEl) nomeEmpresaEl.textContent = empresaAtual.nomeEmpresa || 'Minha Empresa';
      
      // Atualizar badge do plano no header
      atualizarBadgePlano();
      
      // Controlar visibilidade do menu admin
      const menuAdmin = document.getElementById('menuAdmin');
      if (menuAdmin) {
        if (empresaAtual.isAdmin === true) {
          // É admin - mostrar menu
          menuAdmin.classList.remove('d-none');
          menuAdmin.style.display = 'block';
        } else {
          // NÃO é admin - esconder menu
          menuAdmin.classList.add('d-none');
          menuAdmin.style.display = 'none';
        }
      }
      
      // Registrar log de auditoria - login bem-sucedido
      try {
        await db.collection('usuarios').doc(user.uid).collection('logs_auditoria').add({
          tipo: 'login',
          status: 'sucesso',
          email: user.email,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          userAgent: navigator.userAgent,
          plataforma: navigator.platform
        });
      } catch (logError) {
        console.error('Erro ao registrar log:', logError);
      }
      
      // Verificar se precisa fazer backup (30 dias)
      verificarBackupPendente();
      
      // Iniciar timeout de sessão
      resetarTimeoutSessao();
      
      abrir('menu');
      atualizarMetricas();
      mostrarToast('Login realizado com sucesso!', false);
      
      // Solicita permissão de notificações e verifica primeiro acesso
      setTimeout(() => {
        solicitarPermissaoNotificacao();
        verificarProdutosVencendo();
        
        // Verificar se é primeiro acesso para mostrar tour
        if (typeof verificarPrimeiroAcesso === 'function') {
          verificarPrimeiroAcesso();
        }
      }, 2000);
      
      // Resetar tentativas em caso de sucesso
      tentativasLogin = 0;
      mostrarLoader(false);
      
    } catch (e) { 
      mostrarLoader(false);
      tentativasLogin++;
      
      // Registrar log de auditoria - login falhou
      const emailTentativa = document.getElementById('email')?.value || 'desconhecido';
      await registrarLogAuditoria('login', 'falha', {
        email: emailTentativa,
        erro: e.code || 'erro_desconhecido'
      });
      
      // Mensagens de erro genéricas (segurança)
      if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
        mostrarToast('❌ Email ou senha incorretos', 'error');
      } else if (e.code === 'auth/invalid-email') {
        mostrarToast('❌ Email inválido', 'error');
      } else if (e.code === 'auth/user-disabled') {
        mostrarToast('❌ Conta desativada. Entre em contato com o suporte.', 'error');
      } else if (e.code === 'auth/too-many-requests') {
        bloqueioLogin = true;
        tempoBloqueio = Date.now() + 60000; // 1 minuto
        mostrarToast('🔒 Muitas tentativas. Tente novamente em 1 minuto.', 'error');
      } else if (e.code === 'auth/network-request-failed') {
        mostrarToast('❌ Erro de conexão. Verifique sua internet.', 'error');
      } else {
        console.error('Erro no login:', e);
        mostrarToast('❌ Erro ao fazer login. Tente novamente.', 'error');
      }
      
      // Bloquear após 5 tentativas
      if (tentativasLogin >= 5) {
        bloqueioLogin = true;
        tempoBloqueio = Date.now() + 300000; // 5 minutos
        mostrarToast('🔒 Muitas tentativas falhas. Conta bloqueada por 5 minutos.', 'error');
      }
    }
  }

  async function registrar() {
    try {
      const email = sanitizeInput(document.getElementById('emailRegistro').value);
      const senha = document.getElementById('senhaRegistro').value;
      const nomeEmpresa = sanitizeInput(document.getElementById('nomeEmpresa').value);
      
      // Validações profissionais
      if (!email || !senha || !nomeEmpresa) { 
        mostrarToast('⚠️ Preencha todos os campos obrigatórios', 'warning'); 
        return; 
      }
      
      // Validar formato de email com função profissional
      if (!isValidEmail(email)) {
        mostrarToast('⚠️ Email inválido. Verifique o formato.', 'warning');
        return;
      }
      
      // Validar senha forte
      const senhaValidacao = isStrongPassword(senha);
      if (!senhaValidacao.valid) {
        mostrarToast(`⚠️ ${senhaValidacao.message}`, 'warning');
        return;
      }
      
      if (nomeEmpresa.length < 3 || nomeEmpresa.length > 100) {
        mostrarToast('⚠️ Nome da empresa deve ter entre 3 e 100 caracteres', 'warning');
        return;
      }
      
      mostrarLoader(true);
      logger.info('Iniciando registro', { email });
      
      const userCredential = await retryOperation(
        () => auth.createUserWithEmailAndPassword(email, senha),
        2,
        1000
      );
      const user = userCredential.user;
      
      // Enviar email de verificação
      try {
        await user.sendEmailVerification({
          url: window.location.origin + '/index.html',
          handleCodeInApp: false
        });
        mostrarToast('✉️ Email de verificação enviado! Verifique sua caixa de entrada.', 'info');
      } catch (emailError) {
        console.error('Erro ao enviar email de verificação:', emailError);
        // Não bloqueia o registro se falhar
      }
      
      // Criar perfil da empresa
      await db.collection('usuarios').doc(user.uid).set({
        nomeEmpresa: nomeEmpresa,
        email: email,
        dataCriacao: firebase.firestore.FieldValue.serverTimestamp(),
        plano: 'gratuito',
        ativo: true
      });
      
      mostrarLoader(false);
      mostrarToast('✅ Conta criada com sucesso! Faça login para continuar.', 'success');
      
      // Limpar campos
      document.getElementById('emailRegistro').value = '';
      document.getElementById('senhaRegistro').value = '';
      document.getElementById('nomeEmpresa').value = '';
      
      // Voltar para login após 2 segundos
      setTimeout(() => voltarLogin(), 2000);
      
    } catch (e) { 
      mostrarLoader(false);
      console.error('Erro no registro:', e);
      
      if (e.code === 'auth/email-already-in-use') {
        mostrarToast('❌ Este e-mail já está cadastrado', 'error');
      } else if (e.code === 'auth/invalid-email') {
        mostrarToast('❌ E-mail inválido', 'error');
      } else if (e.code === 'auth/weak-password') {
        mostrarToast('❌ Senha muito fraca. Use no mínimo 8 caracteres.', 'error');
      } else if (e.code === 'auth/operation-not-allowed') {
        mostrarToast('❌ Registro desabilitado. Contate o administrador.', 'error');
      } else if (e.code === 'auth/network-request-failed') {
        mostrarToast('❌ Erro de conexão. Verifique sua internet.', 'error');
      } else {
        mostrarToast('❌ Erro ao criar conta. Tente novamente.', 'error');
      }
    }
  }
  
  function mostrarFormRegistro() {
    document.getElementById('formLogin').style.display = 'none';
    document.getElementById('formRegistro').style.display = 'block';
  }
  
  function voltarLogin() {
    document.getElementById('formLogin').style.display = 'block';
    document.getElementById('formRegistro').style.display = 'none';
  }
  
  // Verificar força da senha em tempo real
  function verificarForcaSenha() {
    const senha = document.getElementById('senhaRegistro').value;
    const indicador = document.getElementById('indicadorSenha');
    const texto = document.getElementById('textoSenha');
    const barras = [
      document.getElementById('barra1'),
      document.getElementById('barra2'),
      document.getElementById('barra3'),
      document.getElementById('barra4')
    ];
    
    // Elementos de requisitos
    const reqLength = document.getElementById('req-length');
    const reqLetter = document.getElementById('req-letter');
    const reqNumber = document.getElementById('req-number');
    
    if (!senha) {
      indicador.style.display = 'none';
      return;
    }
    
    indicador.style.display = 'block';
    
    // Verificar requisitos individuais
    const temComprimento = senha.length >= 8;
    const temLetra = /[a-zA-Z]/.test(senha);
    const temNumero = /\d/.test(senha);
    
    // Atualizar checkmarks
    if (reqLength) {
      const span = reqLength.querySelector('span');
      if (temComprimento) {
        span.textContent = '✓';
        span.style.color = '#16a34a';
        reqLength.style.color = '#16a34a';
      } else {
        span.textContent = '✗';
        span.style.color = '#dc2626';
        reqLength.style.color = '#6b7280';
      }
    }
    
    if (reqLetter) {
      const span = reqLetter.querySelector('span');
      if (temLetra) {
        span.textContent = '✓';
        span.style.color = '#16a34a';
        reqLetter.style.color = '#16a34a';
      } else {
        span.textContent = '✗';
        span.style.color = '#dc2626';
        reqLetter.style.color = '#6b7280';
      }
    }
    
    if (reqNumber) {
      const span = reqNumber.querySelector('span');
      if (temNumero) {
        span.textContent = '✓';
        span.style.color = '#16a34a';
        reqNumber.style.color = '#16a34a';
      } else {
        span.textContent = '✗';
        span.style.color = '#dc2626';
        reqNumber.style.color = '#6b7280';
      }
    }
    
    let forca = 0;
    let mensagem = '';
    let cor = '';
    
    // Critérios de força
    if (senha.length >= 8) forca++;
    if (senha.length >= 12) forca++;
    if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) forca++;
    if (/\d/.test(senha)) forca++;
    if (/[!@#$%^&*(),.?\":{}|<>]/.test(senha)) forca++;
    
    // Resetar barras
    barras.forEach(b => b.style.background = '#e0e0e0');
    
    if (forca <= 1) {
      mensagem = '❌ Senha muito fraca';
      cor = '#f44336';
      barras[0].style.background = cor;
    } else if (forca === 2) {
      mensagem = '⚠️ Senha fraca';
      cor = '#ff9800';
      barras[0].style.background = cor;
      barras[1].style.background = cor;
    } else if (forca === 3) {
      mensagem = '✓ Senha média';
      cor = '#ffc107';
      barras[0].style.background = cor;
      barras[1].style.background = cor;
      barras[2].style.background = cor;
    } else if (forca >= 4) {
      mensagem = '✅ Senha forte';
      cor = '#4caf50';
      barras.forEach(b => b.style.background = cor);
    }
    
    texto.textContent = mensagem;
    texto.style.color = cor;
  }
  
  window.mostrarFormRegistro = mostrarFormRegistro;
  window.voltarLogin = voltarLogin;
  window.verificarForcaSenha = verificarForcaSenha;

  function logout() { 
    auth.signOut();
    // Mostrar login
    document.getElementById('login').style.display = 'flex';
    // Esconder sidebar e main content
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    if (sidebar) sidebar.classList.add('d-none');
    if (mainContent) mainContent.classList.add('d-none');
  }

  // ================ MARCAS (FIRESTORE) ================
  async function carregarMarcas() {
    try {
      const datalist = document.getElementById('listaMarcas');
      const filtro = document.getElementById('filtroMarca');
      if (!datalist) return;
      
      datalist.innerHTML = '';
      if (filtro) filtro.innerHTML = `<option value="">Todas as marcas</option>`;
      
      const snap = await getCollection('marcas').orderBy('nome').get();
      snap.forEach(doc => {
        const nome = doc.data().nome;
        datalist.innerHTML += `<option value="${nome}">`;
        if (filtro) filtro.innerHTML += `<option value="${nome}">${nome}</option>`;
      });
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
        const estoqueSnap = await getCollection('estoque').where('codigo', '==', codigo).limit(1).get();
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
  
  // ================ LOGS DE AUDITORIA ================
  async function registrarLogAuditoria(tipo, status, dados = {}) {
    try {
      if (!auth.currentUser) return;
      
      const logData = {
        tipo: tipo, // 'login', 'registro', 'alteracao', 'exclusao'
        status: status, // 'sucesso', 'falha'
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userAgent: navigator.userAgent,
        plataforma: navigator.platform,
        ...dados
      };
      
      await db.collection('usuarios')
        .doc(auth.currentUser.uid)
        .collection('logs_auditoria')
        .add(logData);
        
    } catch (error) {
      console.error('Erro ao registrar log:', error);
      // Não bloqueia operação principal se log falhar
    }
  }
  
  // ================ BACKUP AUTOMÁTICO ================
  async function verificarBackupPendente() {
    try {
      if (!auth.currentUser) return;
      
      const empresaDoc = await db.collection('usuarios').doc(auth.currentUser.uid).get();
      const dados = empresaDoc.data();
      
      if (!dados.ultimoBackup) {
        // Primeiro acesso - definir data atual
        await db.collection('usuarios').doc(auth.currentUser.uid).update({
          ultimoBackup: firebase.firestore.FieldValue.serverTimestamp()
        });
        return;
      }
      
      const ultimoBackup = dados.ultimoBackup.toDate();
      const hoje = new Date();
      const diasDesdeBackup = Math.floor((hoje - ultimoBackup) / (1000 * 60 * 60 * 24));
      
      // Lembrar a cada 30 dias
      if (diasDesdeBackup >= 30) {
        setTimeout(() => {
          const confirmar = confirm(
            '💾 Lembrete de Backup!\n\n' +
            `Faz ${diasDesdeBackup} dias desde seu último backup.\n\n` +
            'Recomendamos exportar seus dados regularmente.\n\n' +
            'Deseja exportar agora?'
          );
          
          if (confirmar) {
            // Abrir tela de estoque e disparar exportação
            abrir('estoque');
            setTimeout(() => {
              if (typeof exportarExcel === 'function') {
                exportarExcel();
                // Atualizar data do último backup
                db.collection('usuarios').doc(auth.currentUser.uid).update({
                  ultimoBackup: firebase.firestore.FieldValue.serverTimestamp()
                });
              }
            }, 500);
          }
        }, 3000); // Mostrar após 3 segundos do login
      }
    } catch (error) {
      console.error('Erro ao verificar backup:', error);
    }
  }
  
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
      // Verificar limite do plano antes de adicionar
      if (!produtoEditando) {
        const limiteAtingido = await verificarLimitePlano();
        if (limiteAtingido) {
          return; // Função já mostra mensagem de erro
        }
      }
      
      // Capturar e sanitizar inputs
      const codigo = sanitizeInput(document.getElementById('codigoBarras').value);
      const nome = sanitizeInput(document.getElementById('nomeProduto').value);
      const marca = sanitizeInput(document.getElementById('marcaProduto').value);
      const lote = sanitizeInput(document.getElementById('loteProduto').value);
      const fornecedor = sanitizeInput(document.getElementById('fornecedorProduto').value);
      const local = sanitizeInput(document.getElementById('localProduto')?.value || '');
      const quantidade = Number(document.getElementById('quantidadeProduto').value);
      const estoqueMinimo = Number(document.getElementById('estoqueMinimo').value || 0);
      const validadeInput = document.getElementById('validadeProduto').value;

      // Validações completas
      if (!nome || nome.length < 2) {
        mostrarToast('⚠️ Nome do produto deve ter pelo menos 2 caracteres', 'warning');
        return;
      }
      
      if (nome.length > 100) {
        mostrarToast('⚠️ Nome muito longo (máximo 100 caracteres)', 'warning');
        return;
      }
      
      if (!marca) {
        mostrarToast('⚠️ Selecione a marca', 'warning');
        return;
      }
      
      if (!quantidade || quantidade <= 0 || quantidade > 1000000) {
        mostrarToast('⚠️ Quantidade inválida (1-1.000.000)', 'warning');
        return;
      }
      
      if (estoqueMinimo < 0 || estoqueMinimo > quantidade) {
        mostrarToast('⚠️ Estoque mínimo inválido', 'warning');
        return;
      }
      
      if (!validadeInput) {
        mostrarToast('⚠️ Informe a data de validade', 'warning');
        return;
      }
      
      // Validar data de validade
      const dataValidade = new Date(validadeInput);
      const hoje = new Date();
      const umAnoAtras = new Date();
      umAnoAtras.setFullYear(hoje.getFullYear() - 1);
      const dezAnosFrente = new Date();
      dezAnosFrente.setFullYear(hoje.getFullYear() + 10);
      
      if (dataValidade < umAnoAtras) {
        mostrarToast('⚠️ Data de validade muito antiga', 'warning');
        return;
      }
      
      if (dataValidade > dezAnosFrente) {
        mostrarToast('⚠️ Data de validade muito distante', 'warning');
        return;
      }

      mostrarLoader(true);
      
      const dadosProduto = {
        codigo, nome, marca, lote, fornecedor, local, quantidade, estoqueMinimo,
        validade: firebase.firestore.Timestamp.fromDate(new Date(validadeInput))
      };
      
      if (produtoEditando) {
        // ATUALIZA produto existente
        await getCollection('estoque').doc(produtoEditando).update(dadosProduto);
        
        await getCollection('historico').add({
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
        const docRef = await getCollection('estoque').add(dadosProduto);
        
        await getCollection('historico').add({
          tipo: 'entrada',
          produtoId: docRef.id,
          produto: nome,
          marca: marca,
          quantidade: quantidade,
          usuario: auth.currentUser?.email || 'Sistema',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Registrar analytics
        registrarAcao('adicionar', { produto: nome, quantidade });
        
        mostrarLoader(false);
        mostrarToast('Produto salvo com sucesso!');
      }
      
      ['codigoBarras','nomeProduto','quantidadeProduto','estoqueMinimo','validadeProduto'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      carregarEstoque();
    } catch (e) { mostrarLoader(false); handleError(e); }
  }

  // ================ LISTAGEM / FILTRO ================
  // Variável global para armazenar os dados do estoque
  window.dadosEstoque = [];
  
  async function carregarEstoque() {
    try {
      mostrarLoader(true);
      window.dadosEstoque = [];
      const tabela = document.getElementById('tabelaEstoque'); if (!tabela) { mostrarLoader(false); return; }
      tabela.innerHTML = '';
      const snap = await getCollection('estoque').orderBy('validade','asc').get();
      snap.forEach(doc => {
        const p = doc.data();
        p.id = doc.id; // Adiciona ID do documento para edição/exclusão
        const validadeDate = (p.validade && p.validade.toDate) ? p.validade.toDate() : (p.validade || null);
        window.dadosEstoque.push({ ...p, validade: validadeDate });
      });
      renderTabela(window.dadosEstoque);
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
      const selecionado = produtosSelecionados.has(p.id) ? 'checked' : '';
      const rowClass = produtosSelecionados.has(p.id) ? 'row-selected' : '';
      
      tabela.innerHTML += `
      <tr class="${rowClass} ${status === 'vencido' ? 'table-danger' : status === 'alerta' ? 'table-warning' : ''}" data-id="${p.id}">
        <td><input type="checkbox" class="form-check-input produto-checkbox" data-id="${p.id}" ${selecionado} onchange="toggleSelecaoProduto('${p.id}')"></td>
        <td>${sanitizeInput(p.codigo || '-')}</td>
        <td>${sanitizeInput(p.nome)}</td>
        <td>${sanitizeInput(p.marca)}</td>
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
    
    atualizarBarraSelecao();
  }

  // Filtrar estoque com debounce e cache - VERSÃO AVANÇADA
  const filtrarEstoqueDebounced = debounce(async function() {
    const texto = sanitizeInput(document.getElementById('buscaEstoque')?.value || '').toLowerCase();
    const marca = document.getElementById('filtroMarca')?.value || '';
    const status = document.getElementById('filtroStatus')?.value || '';
    
    // Verificar cache
    const cacheKey = `estoque_${texto}_${marca}_${status}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      renderTabela(cached);
      return;
    }
    
    // Busca inteligente com múltiplos filtros
    const filtrado = window.dadosEstoque.filter(p => {
      // Filtro de marca
      const matchMarca = !marca || p.marca === marca;
      
      // Filtro de status
      let matchStatus = true;
      if (status) {
        const produtoStatus = calcularStatus(p.validade);
        matchStatus = produtoStatus === status;
      }
      
      // Busca inteligente - verifica em nome, marca, código e lote
      let matchBusca = true;
      if (texto) {
        const nome = (p.nome || '').toLowerCase();
        const marcaProd = (p.marca || '').toLowerCase();
        const codigo = (p.codigo || '').toLowerCase();
        const lote = (p.lote || '').toLowerCase();
        const fornecedor = (p.fornecedor || '').toLowerCase();
        
        matchBusca = nome.includes(texto) || 
                    marcaProd.includes(texto) || 
                    codigo.includes(texto) ||
                    lote.includes(texto) ||
                    fornecedor.includes(texto);
      }
      
      return matchMarca && matchStatus && matchBusca;
    });
    
    // Salvar no cache
    cache.set(cacheKey, filtrado);
    renderTabela(filtrado);
    
    // Mostrar contador de resultados
    const total = window.dadosEstoque.length;
    if (filtrado.length < total) {
      mostrarToast(`🔍 ${filtrado.length} de ${total} produtos`, 'info');
    }
  }, 300);
  
  function filtrarEstoque() {
    filtrarEstoqueDebounced();
  }

  // ================ BULK OPERATIONS ================
  
  function toggleSelecaoProduto(id) {
    if (produtosSelecionados.has(id)) {
      produtosSelecionados.delete(id);
    } else {
      produtosSelecionados.add(id);
    }
    atualizarBarraSelecao();
    
    // Atualizar visual da linha
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) {
      row.classList.toggle('row-selected', produtosSelecionados.has(id));
    }
  }
  
  function selecionarTodos() {
    const checkboxes = document.querySelectorAll('.produto-checkbox');
    const todosSelecionados = produtosSelecionados.size === checkboxes.length;
    
    if (todosSelecionados) {
      produtosSelecionados.clear();
      checkboxes.forEach(cb => cb.checked = false);
    } else {
      checkboxes.forEach(cb => {
        const id = cb.dataset.id;
        produtosSelecionados.add(id);
        cb.checked = true;
      });
    }
    
    renderTabela(window.dadosEstoque);
  }
  window.selecionarTodos = selecionarTodos;
  
  function atualizarBarraSelecao() {
    const barra = document.getElementById('bulkActionBar');
    const contador = document.getElementById('selectionCount');
    
    if (!barra || !contador) return;
    
    if (produtosSelecionados.size > 0) {
      barra.classList.remove('d-none');
      contador.textContent = produtosSelecionados.size;
    } else {
      barra.classList.add('d-none');
    }
  }
  
  async function excluirSelecionados() {
    if (produtosSelecionados.size === 0) return;
    
    const confirmacao = confirm(`⚠️ Deseja excluir ${produtosSelecionados.size} produto(s) selecionado(s)?\n\nEsta ação não pode ser desfeita.`);
    if (!confirmacao) return;
    
    try {
      mostrarLoader(true);
      
      // Salvar para histórico de undo
      const produtosParaExcluir = window.dadosEstoque.filter(p => produtosSelecionados.has(p.id));
      adicionarHistorico('exclusaoMassa', produtosParaExcluir);
      
      // Excluir em lote
      const promises = Array.from(produtosSelecionados).map(id =>
        getCollection('estoque').doc(id).delete()
      );
      
      await Promise.all(promises);
      
      // Registrar auditoria
      await registrarLogAuditoria('exclusao_massa', {
        quantidade: produtosSelecionados.size,
        ids: Array.from(produtosSelecionados)
      });
      
      mostrarToast(`✅ ${produtosSelecionados.size} produto(s) excluído(s) com sucesso!`, 'success');
      
      produtosSelecionados.clear();
      await carregarEstoque();
      atualizarMetricas();
      
    } catch (error) {
      logger.error('Erro ao excluir produtos em massa', error);
      mostrarToast('❌ Erro ao excluir produtos. Tente novamente.', 'error');
    } finally {
      mostrarLoader(false);
    }
  }
  window.excluirSelecionados = excluirSelecionados;
  
  async function exportarSelecionados() {
    if (produtosSelecionados.size === 0) {
      mostrarToast('⚠️ Selecione produtos para exportar', 'warning');
      return;
    }
    
    try {
      mostrarLoader(true);
      
      const produtosExportar = window.dadosEstoque.filter(p => produtosSelecionados.has(p.id));
      
      const wb = XLSX.utils.book_new();
      
      const dados = produtosExportar.map(p => ({
        'Código': p.codigo || '',
        'Produto': p.nome,
        'Marca': p.marca,
        'Lote': p.lote || '',
        'Quantidade': p.quantidade,
        'Est. Mínimo': p.estoqueMinimo || 0,
        'Validade': formatDate(p.validade),
        'Status': calcularStatus(p.validade) === 'vencido' ? 'VENCIDO' : calcularStatus(p.validade) === 'alerta' ? 'PRÓXIMO' : 'OK'
      }));
      
      const ws = XLSX.utils.json_to_sheet(dados);
      ws['!cols'] = [
        { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
        { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'Selecionados');
      
      const nomeArquivo = `selecionados_${produtosSelecionados.size}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo, { compression: true });
      
      mostrarToast(`✅ ${produtosSelecionados.size} produto(s) exportado(s)!`, 'success');
      
      await registrarLogAuditoria('exportacao_selecionados', {
        quantidade: produtosSelecionados.size
      });
      
    } catch (error) {
      logger.error('Erro ao exportar selecionados', error);
      mostrarToast('❌ Erro ao exportar', 'error');
    } finally {
      mostrarLoader(false);
    }
  }
  window.exportarSelecionados = exportarSelecionados;
  
  function cancelarSelecao() {
    produtosSelecionados.clear();
    renderTabela(window.dadosEstoque);
  }
  window.cancelarSelecao = cancelarSelecao;
  
  // ================ IMPORTAÇÃO DE ARQUIVOS ================
  
  async function importarArquivo() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls, .csv';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        mostrarLoader(true);
        mostrarToast('📂 Lendo arquivo...', 'info');
        
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        if (jsonData.length === 0) {
          mostrarToast('⚠️ Arquivo vazio', 'warning');
          return;
        }
        
        // Validar e processar produtos
        const produtosValidos = [];
        const erros = [];
        
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const linha = i + 2; // +2 porque começa em 1 e tem cabeçalho
          
          // Extrair dados com nomes flexíveis
          const nome = row['Produto'] || row['Nome'] || row['produto'] || row['nome'];
          const marca = row['Marca'] || row['marca'];
          const codigo = row['Código'] || row['Codigo'] || row['codigo'] || row['Código de Barras'];
          const quantidade = Number(row['Quantidade'] || row['quantidade'] || row['Qtd'] || row['qtd']);
          const validade = row['Validade'] || row['validade'];
          const lote = row['Lote'] || row['lote'] || '';
          const fornecedor = row['Fornecedor'] || row['fornecedor'] || '';
          
          // Validar campos obrigatórios
          if (!nome) {
            erros.push(`Linha ${linha}: Nome do produto é obrigatório`);
            continue;
          }
          
          if (!marca) {
            erros.push(`Linha ${linha}: Marca é obrigatória`);
            continue;
          }
          
          if (!quantidade || quantidade <= 0) {
            erros.push(`Linha ${linha}: Quantidade inválida`);
            continue;
          }
          
          if (!validade) {
            erros.push(`Linha ${linha}: Validade é obrigatória`);
            continue;
          }
          
          // Processar data de validade
          let dataValidade;
          if (typeof validade === 'number') {
            // Excel date serial
            dataValidade = XLSX.SSF.parse_date_code(validade);
            dataValidade = new Date(dataValidade.y, dataValidade.m - 1, dataValidade.d);
          } else {
            dataValidade = new Date(validade);
          }
          
          if (isNaN(dataValidade.getTime())) {
            erros.push(`Linha ${linha}: Data de validade inválida`);
            continue;
          }
          
          produtosValidos.push({
            nome: sanitizeInput(nome),
            marca: sanitizeInput(marca),
            codigo: sanitizeInput(codigo || ''),
            quantidade,
            validade: dataValidade.toISOString().split('T')[0],
            lote: sanitizeInput(lote),
            fornecedor: sanitizeInput(fornecedor),
            dataCadastro: new Date().toISOString()
          });
        }
        
        // Mostrar preview e confirmar
        const confirmacao = confirm(
          `📄 Importação:\n\n` +
          `✅ Produtos válidos: ${produtosValidos.length}\n` +
          `❌ Erros: ${erros.length}\n\n` +
          (erros.length > 0 ? `Erros:\n${erros.slice(0, 5).join('\n')}${erros.length > 5 ? '\n...' : ''}\n\n` : '') +
          `Deseja importar os ${produtosValidos.length} produto(s) válido(s)?`
        );
        
        if (!confirmacao) {
          mostrarToast('❌ Importação cancelada', 'info');
          return;
        }
        
        // Importar produtos
        let importados = 0;
        for (const produto of produtosValidos) {
          try {
            await getCollection('estoque').add(produto);
            importados++;
          } catch (error) {
            logger.error('Erro ao importar produto', error);
          }
        }
        
        // Registrar auditoria
        await registrarLogAuditoria('importacao', {
          total: jsonData.length,
          validos: produtosValidos.length,
          importados,
          erros: erros.length
        });
        
        await carregarEstoque();
        atualizarMetricas();
        
        mostrarToast(
          `✅ ${importados} produto(s) importado(s) com sucesso!` +
          (erros.length > 0 ? ` (${erros.length} erro(s))` : ''),
          'success'
        );
        
      } catch (error) {
        logger.error('Erro ao importar arquivo', error);
        mostrarToast('❌ Erro ao importar arquivo: ' + error.message, 'error');
      } finally {
        mostrarLoader(false);
      }
    };
    
    input.click();
  }
  window.importarArquivo = importarArquivo;
  
  // ================ NOTIFICAÇÕES INTELIGENTES ================
  
  let notificacoesAtivas = [];
  let notificacoesLidas = new Set();
  
  // Verificar e criar notificações
  async function verificarNotificacoes() {
    if (!auth.currentUser) return;
    
    try {
      const snap = await getCollection('estoque').get();
      const novasNotificacoes = [];
      const hoje = new Date();
      const em3Dias = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000);
      const em7Dias = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      snap.forEach(doc => {
        const p = { id: doc.id, ...doc.data() };
        const validade = new Date(p.validade);
        const estoqueMin = p.estoqueMinimo || 0;
        
        // Notificação: Produto vencido
        if (validade < hoje) {
          novasNotificacoes.push({
            id: `vencido_${p.id}`,
            tipo: 'vencido',
            prioridade: 'alta',
            titulo: '❌ Produto Vencido',
            mensagem: `${p.nome} (${p.marca}) venceu em ${formatDate(p.validade)}`,
            produtoId: p.id,
            timestamp: Date.now(),
            acao: () => editarProduto(p.id)
          });
        }
        // Notificação: Vence em 3 dias (urgente)
        else if (validade <= em3Dias) {
          novasNotificacoes.push({
            id: `urgente_${p.id}`,
            tipo: 'urgente',
            prioridade: 'alta',
            titulo: '⚠️ Vencimento Urgente',
            mensagem: `${p.nome} vence em ${calcularDiasVencimento(p.validade)} dia(s)!`,
            produtoId: p.id,
            timestamp: Date.now(),
            acao: () => editarProduto(p.id)
          });
        }
        // Notificação: Vence em 7 dias
        else if (validade <= em7Dias) {
          novasNotificacoes.push({
            id: `alerta_${p.id}`,
            tipo: 'alerta',
            prioridade: 'media',
            titulo: '🚨 Atenção ao Vencimento',
            mensagem: `${p.nome} vence em ${calcularDiasVencimento(p.validade)} dia(s)`,
            produtoId: p.id,
            timestamp: Date.now(),
            acao: () => editarProduto(p.id)
          });
        }
        
        // Notificação: Estoque baixo
        if (estoqueMin > 0 && p.quantidade <= estoqueMin) {
          novasNotificacoes.push({
            id: `estoque_${p.id}`,
            tipo: 'estoque',
            prioridade: p.quantidade === 0 ? 'alta' : 'media',
            titulo: p.quantidade === 0 ? '🚫 Estoque Zerado' : '📦 Estoque Baixo',
            mensagem: `${p.nome}: ${p.quantidade} unidade(s) (mínimo: ${estoqueMin})`,
            produtoId: p.id,
            timestamp: Date.now(),
            acao: () => editarProduto(p.id)
          });
        }
      });
      
      // Filtrar notificações já lidas
      notificacoesAtivas = novasNotificacoes.filter(n => !notificacoesLidas.has(n.id));
      
      // Ordenar por prioridade e timestamp
      notificacoesAtivas.sort((a, b) => {
        const prioridadeValor = { alta: 3, media: 2, baixa: 1 };
        const prioA = prioridadeValor[a.prioridade] || 0;
        const prioB = prioridadeValor[b.prioridade] || 0;
        if (prioA !== prioB) return prioB - prioA;
        return b.timestamp - a.timestamp;
      });
      
      atualizarBadgeNotificacoes();
      
      // Auto-mostrar se houver notificações urgentes não lidas
      const urgentes = notificacoesAtivas.filter(n => n.prioridade === 'alta' && !notificacoesLidas.has(n.id));
      if (urgentes.length > 0 && document.getElementById('menu')?.classList.contains('tela-ativa')) {
        // Mostrar primeira notificação urgente como toast
        const primeira = urgentes[0];
        setTimeout(() => {
          mostrarToast(`${primeira.titulo}: ${primeira.mensagem}`, 'warning');
        }, 1000);
      }
      
    } catch (error) {
      logger.error('Erro ao verificar notificações', error);
    }
  }
  
  function atualizarBadgeNotificacoes() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    
    const naoLidas = notificacoesAtivas.filter(n => !notificacoesLidas.has(n.id)).length;
    
    if (naoLidas > 0) {
      badge.textContent = naoLidas > 99 ? '99+' : naoLidas;
      badge.classList.remove('d-none');
    } else {
      badge.classList.add('d-none');
    }
  }
  
  function mostrarCentroNotificacoes() {
    const html = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: flex-start; justify-content: flex-end; z-index: 9999; padding: 60px 20px 20px 20px;" onclick="if(event.target === this) this.remove()">
        <div style="background: var(--bg-card); border-radius: 12px; width: 100%; max-width: 420px; max-height: 80vh; overflow: hidden; box-shadow: var(--shadow-lg); display: flex; flex-direction: column;" onclick="event.stopPropagation()">
          
          <!-- Header -->
          <div style="padding: 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
            <h3 style="margin: 0; color: var(--text-primary); font-size: 18px; font-weight: 600;">
              🔔 Notificações
              <span style="margin-left: 8px; font-size: 14px; color: var(--text-secondary); font-weight: 400;">
                (${notificacoesAtivas.length})
              </span>
            </h3>
            <div style="display: flex; gap: 8px;">
              <button onclick="marcarTodasComoLidas()" class="btn btn-sm btn-outline-secondary" title="Marcar todas como lidas">
                ✓ Todas
              </button>
              <button onclick="this.closest('div[style*=\"position: fixed\"]').remove()" class="btn btn-sm btn-outline-secondary" title="Fechar">
                ✖
              </button>
            </div>
          </div>
          
          <!-- Lista de notificações -->
          <div style="flex: 1; overflow-y: auto; padding: 12px;">
            ${notificacoesAtivas.length === 0 ? `
              <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">🔔</div>
                <p style="margin: 0;">Nenhuma notificação</p>
              </div>
            ` : notificacoesAtivas.map(n => {
              const lida = notificacoesLidas.has(n.id);
              const corBorda = {
                'vencido': '#d93025',
                'urgente': '#f9ab00',
                'alerta': '#1967d2',
                'estoque': '#5f6368'
              }[n.tipo] || '#5f6368';
              
              return `
                <div style="
                  background: ${lida ? 'var(--bg-secondary)' : 'var(--bg-main)'};
                  border-left: 3px solid ${corBorda};
                  border-radius: 8px;
                  padding: 12px 16px;
                  margin-bottom: 8px;
                  cursor: pointer;
                  transition: all 0.2s;
                  opacity: ${lida ? '0.6' : '1'};
                " 
                onmouseover="this.style.transform='translateX(-4px)'; this.style.boxShadow='var(--shadow-sm)'"
                onmouseout="this.style.transform='translateX(0)'; this.style.boxShadow='none'"
                onclick="executarAcaoNotificacao('${n.id}')">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                    <strong style="color: var(--text-primary); font-size: 14px;">${n.titulo}</strong>
                    <button onclick="event.stopPropagation(); marcarComoLida('${n.id}')" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 0; font-size: 18px;" title="Marcar como lida">
                      ${lida ? '✓' : '×'}
                    </button>
                  </div>
                  <p style="margin: 0; color: var(--text-secondary); font-size: 13px; line-height: 1.4;">
                    ${n.mensagem}
                  </p>
                  <small style="color: var(--text-disabled); font-size: 11px; margin-top: 8px; display: block;">
                    ${formatarTempoRelativo(n.timestamp)}
                  </small>
                </div>
              `;
            }).join('')}
          </div>
          
          <!-- Footer -->
          <div style="padding: 12px 20px; border-top: 1px solid var(--border); background: var(--bg-secondary);">
            <small style="color: var(--text-secondary); display: flex; align-items: center; gap: 8px;">
              <span style="width: 8px; height: 8px; background: #1e8e3e; border-radius: 50%; display: inline-block;"></span>
              Atualização automática a cada 5 minutos
            </small>
          </div>
          
        </div>
      </div>
    `;
    
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container.firstElementChild);
  }
  window.mostrarCentroNotificacoes = mostrarCentroNotificacoes;
  
  function executarAcaoNotificacao(id) {
    const notif = notificacoesAtivas.find(n => n.id === id);
    if (notif && notif.acao) {
      marcarComoLida(id);
      // Fechar modal
      document.querySelector('div[style*="position: fixed"]')?.remove();
      // Executar ação
      notif.acao();
    }
  }
  window.executarAcaoNotificacao = executarAcaoNotificacao;
  
  function marcarComoLida(id) {
    notificacoesLidas.add(id);
    atualizarBadgeNotificacoes();
    // Salvar no localStorage
    try {
      localStorage.setItem('notificacoesLidas', JSON.stringify(Array.from(notificacoesLidas)));
    } catch (e) {}
    // Re-renderizar se modal estiver aberto
    if (document.querySelector('div[style*="position: fixed"]')) {
      document.querySelector('div[style*="position: fixed"]').remove();
      mostrarCentroNotificacoes();
    }
  }
  window.marcarComoLida = marcarComoLida;
  
  function marcarTodasComoLidas() {
    notificacoesAtivas.forEach(n => notificacoesLidas.add(n.id));
    atualizarBadgeNotificacoes();
    try {
      localStorage.setItem('notificacoesLidas', JSON.stringify(Array.from(notificacoesLidas)));
    } catch (e) {}
    document.querySelector('div[style*="position: fixed"]')?.remove();
    mostrarToast('✅ Todas as notificações marcadas como lidas', 'success');
  }
  window.marcarTodasComoLidas = marcarTodasComoLidas;
  
  function formatarTempoRelativo(timestamp) {
    const agora = Date.now();
    const diff = agora - timestamp;
    const minutos = Math.floor(diff / 60000);
    const horas = Math.floor(diff / 3600000);
    const dias = Math.floor(diff / 86400000);
    
    if (minutos < 1) return 'Agora';
    if (minutos < 60) return `${minutos} min atrás`;
    if (horas < 24) return `${horas} hora(s) atrás`;
    return `${dias} dia(s) atrás`;
  }
  
  // Carregar notificações lidas do localStorage
  try {
    const salvas = localStorage.getItem('notificacoesLidas');
    if (salvas) {
      notificacoesLidas = new Set(JSON.parse(salvas));
    }
  } catch (e) {}
  
  // Verificar notificações ao fazer login
  auth.onAuthStateChanged(user => {
    if (user) {
      setTimeout(() => verificarNotificacoes(), 2000);
      // Verificar a cada 5 minutos
      setInterval(verificarNotificacoes, 5 * 60 * 1000);
    }
  });
  
  // ================ HISTÓRICO E UNDO ================
  
  function adicionarHistorico(tipo, dados) {
    historicoAcoes.push({
      tipo,
      dados,
      timestamp: Date.now()
    });
    
    if (historicoAcoes.length > MAX_HISTORICO) {
      historicoAcoes.shift();
    }
  }
  
  async function desfazerUltimaAcao() {
    if (historicoAcoes.length === 0) {
      mostrarToast('⚠️ Nenhuma ação para desfazer', 'warning');
      return;
    }
    
    const ultimaAcao = historicoAcoes.pop();
    
    try {
      mostrarLoader(true);
      
      if (ultimaAcao.tipo === 'exclusaoMassa') {
        // Restaurar produtos excluídos
        for (const produto of ultimaAcao.dados) {
          await getCollection('estoque').doc(produto.id).set(produto);
        }
        mostrarToast(`✅ ${ultimaAcao.dados.length} produto(s) restaurado(s)!`, 'success');
      }
      
      await carregarEstoque();
      atualizarMetricas();
      
    } catch (error) {
      logger.error('Erro ao desfazer ação', error);
      mostrarToast('❌ Erro ao desfazer ação', 'error');
    } finally {
      mostrarLoader(false);
    }
  }
  window.desfazerUltimaAcao = desfazerUltimaAcao;

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
      const estoque = window.dadosEstoque.map(p => {
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
      const estoque = window.dadosEstoque.map(p => {
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
  // Sistema de notificações profissional
  const toastQueue = [];
  let processingToast = false;

  function mostrarToast(msg, tipo = 'success') {
    toastQueue.push({ msg, tipo });
    processToastQueue();
  }

  async function processToastQueue() {
    if (processingToast || toastQueue.length === 0) return;
    
    processingToast = true;
    const { msg, tipo } = toastQueue.shift();
    
    const toast = document.getElementById('toast');
    const body = document.getElementById('toast-body');
    
    if (!toast || !body) {
      processingToast = false;
      return;
    }
    
    // Mapear tipos para classes
    const tipoClass = {
      'success': 'success',
      'error': 'error',
      'warning': 'warning',
      'info': 'info'
    }[tipo] || 'success';
    
    // Determinar se é erro (compatibilidade com código antigo)
    const isError = tipo === 'error' || tipo === true;
    
    body.textContent = msg;
    toast.className = `toast ${isError ? 'error' : tipoClass}`;
    toast.classList.remove('d-none');
    
    // Auto-hide com duração baseada no tipo
    const duracao = tipo === 'error' ? 5000 : tipo === 'warning' ? 4000 : 3500;
    
    await new Promise(resolve => {
      setTimeout(() => {
        toast.classList.add('d-none');
        resolve();
      }, duracao);
    });
    
    processingToast = false;
    
    // Processar próximo toast na fila
    if (toastQueue.length > 0) {
      setTimeout(() => processToastQueue(), 300);
    }
  }

  // ================ GESTÃO DE PRODUTOS ================
  
  async function excluirProduto(id) {
    if (!confirm('⚠️ Tem certeza que deseja excluir este produto?')) return;
    try {
      await getCollection('estoque').doc(id).delete();
      
      // Registra no histórico
      await getCollection('historico').add({
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
      const doc = await getCollection('estoque').doc(id).get();
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
      
      await getCollection('estoque').doc(id).update({ quantidade: novaQtd });
      
      // Registra no histórico
      await getCollection('historico').add({
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
      const doc = await getCollection('estoque').doc(id).get();
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

  // ================ COMMAND PALETTE ================
  
  let commandPaletteAberta = false;
  
  const comandos = [
    { nome: '➕ Novo Produto', acao: () => { abrir('estoque'); document.getElementById('nomeProduto')?.focus(); }, tags: 'adicionar cadastrar criar novo produto' },
    { nome: '🔍 Buscar Produto', acao: () => { abrir('estoque'); document.getElementById('buscaEstoque')?.focus(); }, tags: 'pesquisar procurar buscar filtrar' },
    { nome: '📊 Ver Dashboard', acao: () => abrir('dashboard'), tags: 'painel métricas estatísticas visão geral' },
    { nome: '📦 Ver Estoque', acao: () => abrir('estoque'), tags: 'produtos lista inventário' },
    { nome: '📈 Ver Relatórios', acao: () => abrir('relatorios'), tags: 'reports análise dados' },
    { nome: '⚙️ Configurações', acao: () => abrir('configuracoes'), tags: 'ajustes preferências settings' },
    { nome: '📥 Importar Excel', acao: () => document.getElementById('fileImport')?.click(), tags: 'upload carregar csv xlsx' },
    { nome: '📤 Exportar Excel', acao: () => exportarExcel(), tags: 'download salvar backup' },
    { nome: '💾 Gerenciar Backups', acao: () => mostrarGerenciadorBackups(), tags: 'restaurar cópia segurança' },
    { nome: '🔔 Ver Notificações', acao: () => mostrarCentroNotificacoes(), tags: 'alertas avisos' },
    { nome: '🎨 Trocar Tema', acao: () => mostrarSeletorTemas(), tags: 'cores aparência visual modo escuro' },
    { nome: '📊 Analytics', acao: () => mostrarAnalytics(), tags: 'métricas estatísticas uso performance' },
    { nome: '⌨️ Atalhos de Teclado', acao: () => mostrarAjudaAtalhos(), tags: 'shortcuts teclas rápidas hotkeys' },
    { nome: '🔄 Atualizar Dados', acao: () => { carregarEstoque(); atualizarMetricas(); mostrarToast('🔄 Dados atualizados!', 'success'); }, tags: 'refresh reload sincronizar' },
    { nome: '🚪 Sair', acao: () => { if(confirm('Deseja realmente sair?')) logout(); }, tags: 'logout deslogar exit' }
  ];
  
  function mostrarCommandPalette() {
    if (commandPaletteAberta) return;
    commandPaletteAberta = true;
    
    const html = `
      <div id="commandPalette" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: flex-start; justify-content: center; z-index: 10000; padding-top: 100px; backdrop-filter: blur(4px);" onclick="if(event.target.id === 'commandPalette') fecharCommandPalette()">
        <div style="background: var(--bg-card); border-radius: 12px; width: 100%; max-width: 600px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; animation: slideDown 0.2s ease-out;" onclick="event.stopPropagation()">
          
          <div style="padding: 20px; border-bottom: 1px solid var(--border);">
            <div style="position: relative;">
              <i class="fas fa-search" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--text-secondary); font-size: 16px;"></i>
              <input 
                type="text" 
                id="commandPaletteInput" 
                placeholder="Digite um comando ou pesquise..." 
                autofocus
                oninput="filtrarComandos(this.value)"
                onkeydown="navegarComandos(event)"
                style="width: 100%; padding: 12px 16px 12px 48px; border: 2px solid var(--primary); border-radius: 8px; font-size: 15px; background: var(--bg-main); color: var(--text-primary); outline: none; font-family: inherit;"
              />
            </div>
          </div>
          
          <div id="commandList" style="max-height: 400px; overflow-y: auto;">
            ${comandos.map((cmd, idx) => `
              <div 
                class="command-item ${idx === 0 ? 'selected' : ''}" 
                data-index="${idx}"
                onclick="executarComando(${idx})"
                style="padding: 14px 20px; cursor: pointer; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; transition: all 0.15s;"
                onmouseover="selecionarComando(${idx})"
              >
                <span style="font-size: 24px;">${cmd.nome.split(' ')[0]}</span>
                <span style="flex: 1; font-size: 14px; font-weight: 500; color: var(--text-primary);">${cmd.nome.substring(cmd.nome.indexOf(' ') + 1)}</span>
                <kbd style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-size: 11px; color: var(--text-secondary); border: 1px solid var(--border);">Enter</kbd>
              </div>
            `).join('')}
          </div>
          
          <div style="padding: 12px 20px; background: var(--bg-secondary); border-top: 1px solid var(--border); display: flex; gap: 16px; font-size: 11px; color: var(--text-secondary);">
            <span><kbd>↑↓</kbd> Navegar</span>
            <span><kbd>Enter</kbd> Executar</span>
            <span><kbd>Esc</kbd> Fechar</span>
          </div>
          
        </div>
      </div>
      
      <style>
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .command-item.selected {
          background: var(--primary) !important;
          color: white !important;
        }
        
        .command-item.selected span {
          color: white !important;
        }
        
        .command-item.selected kbd {
          background: rgba(255,255,255,0.2) !important;
          color: white !important;
          border-color: rgba(255,255,255,0.3) !important;
        }
        
        .command-item:hover {
          background: var(--bg-secondary);
        }
        
        kbd {
          font-family: monospace;
          font-weight: 600;
        }
      </style>
    `;
    
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container.firstElementChild);
  }
  window.mostrarCommandPalette = mostrarCommandPalette;
  
  function fecharCommandPalette() {
    const palette = document.getElementById('commandPalette');
    if (palette) {
      palette.remove();
      commandPaletteAberta = false;
    }
  }
  window.fecharCommandPalette = fecharCommandPalette;
  
  let comandoSelecionado = 0;
  
  function filtrarComandos(busca) {
    const lista = document.getElementById('commandList');
    if (!lista) return;
    
    const termo = busca.toLowerCase();
    const comandosFiltrados = comandos.filter(cmd => 
      cmd.nome.toLowerCase().includes(termo) || 
      cmd.tags.toLowerCase().includes(termo)
    );
    
    if (comandosFiltrados.length === 0) {
      lista.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
          <i class="fas fa-search" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px;"></i>
          <p>Nenhum comando encontrado</p>
        </div>
      `;
      return;
    }
    
    comandoSelecionado = 0;
    lista.innerHTML = comandosFiltrados.map((cmd, idx) => {
      const cmdIndex = comandos.indexOf(cmd);
      return `
        <div 
          class="command-item ${idx === 0 ? 'selected' : ''}" 
          data-index="${cmdIndex}"
          onclick="executarComando(${cmdIndex})"
          style="padding: 14px 20px; cursor: pointer; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; transition: all 0.15s;"
          onmouseover="selecionarComando(${idx})"
        >
          <span style="font-size: 24px;">${cmd.nome.split(' ')[0]}</span>
          <span style="flex: 1; font-size: 14px; font-weight: 500; color: var(--text-primary);">${cmd.nome.substring(cmd.nome.indexOf(' ') + 1)}</span>
          <kbd style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-size: 11px; color: var(--text-secondary); border: 1px solid var(--border);">Enter</kbd>
        </div>
      `;
    }).join('');
  }
  window.filtrarComandos = filtrarComandos;
  
  function navegarComandos(event) {
    const lista = document.getElementById('commandList');
    if (!lista) return;
    
    const items = lista.querySelectorAll('.command-item');
    if (items.length === 0) return;
    
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      comandoSelecionado = Math.min(comandoSelecionado + 1, items.length - 1);
      atualizarSelecaoComando(items);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      comandoSelecionado = Math.max(comandoSelecionado - 1, 0);
      atualizarSelecaoComando(items);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const cmdIndex = parseInt(items[comandoSelecionado].dataset.index);
      executarComando(cmdIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      fecharCommandPalette();
    }
  }
  window.navegarComandos = navegarComandos;
  
  function selecionarComando(index) {
    comandoSelecionado = index;
    const items = document.querySelectorAll('.command-item');
    atualizarSelecaoComando(items);
  }
  window.selecionarComando = selecionarComando;
  
  function atualizarSelecaoComando(items) {
    items.forEach((item, idx) => {
      if (idx === comandoSelecionado) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('selected');
      }
    });
  }
  
  function executarComando(index) {
    const comando = comandos[index];
    if (comando && comando.acao) {
      fecharCommandPalette();
      setTimeout(() => {
        comando.acao();
        registrarAcao('comando', { nome: comando.nome });
      }, 100);
    }
  }
  window.executarComando = executarComando;

  // ================ GESTÃO DE PRODUTOS (EDITAR/EXCLUIR/AJUSTAR) ================
  
  async function excluirProduto(id) {
    if (!confirm('⚠️ Tem certeza que deseja excluir este produto?')) return;
    try {
      mostrarLoader(true);
      const doc = await getCollection('estoque').doc(id).get();
      const produto = doc.data();
      
      await getCollection('estoque').doc(id).delete();
      
      await getCollection('historico').add({
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
      const doc = await getCollection('estoque').doc(id).get();
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
      
      await getCollection('estoque').doc(id).update({ quantidade: novaQtd });
      
      await getCollection('historico').add({
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
  let graficoABC = null;
  
  // Variável global para armazenar produtos da curva ABC
  let produtosCurvaABC = [];
  
  async function carregarCurvaABC() {
    try {
      mostrarLoader(true);
      const tbody = document.getElementById('tabelaCurvaABCBody');
      tbody.innerHTML = '<tr><td colspan="4" class="text-center">Carregando...</td></tr>';
      
      const snap = await getCollection('estoque').get();
      const snapHistorico = await getCollection('historico').get();
      
      let produtos = [];
      let movimentacoes = {};
      
      // Contar movimentações por produto (últimos 90 dias)
      const hoje = new Date();
      const dias90Atras = new Date(hoje);
      dias90Atras.setDate(dias90Atras.getDate() - 90);
      
      snapHistorico.forEach(doc => {
        const h = doc.data();
        const dataMovimento = h.data ? h.data.toDate() : null;
        
        if (dataMovimento && dataMovimento >= dias90Atras) {
          const chave = `${h.nome}|${h.marca || ''}`;
          movimentacoes[chave] = (movimentacoes[chave] || 0) + 1;
        }
      });
      
      // Coletar produtos com data de validade e movimentação
      snap.forEach(doc => {
        const p = doc.data();
        const qtd = p.quantidade || 0;
        const validade = p.dataValidade ? p.dataValidade.toDate() : null;
        const chave = `${p.nome || 'Sem nome'}|${p.marca || ''}`;
        const rotatividade = movimentacoes[chave] || 0;
        
        // Calcular dias até vencimento
        let diasVencimento = 9999;
        if (validade) {
          const diff = validade.getTime() - hoje.getTime();
          diasVencimento = Math.ceil(diff / (1000 * 60 * 60 * 24));
        }
        
        produtos.push({
          id: doc.id,
          nome: p.nome || 'Sem nome',
          marca: p.marca || '',
          quantidade: qtd,
          validade: validade,
          diasVencimento: diasVencimento,
          rotatividade: rotatividade
        });
      });
      
      if (produtos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 40px;"><i class="fas fa-inbox" style="font-size: 48px; opacity: 0.3; display: block; margin-bottom: 16px;"></i>Nenhum produto no estoque</td></tr>';
        mostrarLoader(false);
        return;
      }
      
      // Calcular score para cada produto (FEFO + Fluxo)
      // Score = peso da urgência de validade + peso da rotatividade
      produtos.forEach(p => {
        // Score de urgência (0-100): produtos que vencem em breve = maior score
        let scoreUrgencia = 0;
        if (p.diasVencimento <= 30) {
          scoreUrgencia = 100; // Vence em até 30 dias = urgente
        } else if (p.diasVencimento <= 90) {
          scoreUrgencia = 70; // Vence em até 90 dias = atenção
        } else if (p.diasVencimento <= 180) {
          scoreUrgencia = 40; // Vence em até 6 meses = médio
        } else {
          scoreUrgencia = 10; // Validade longa = baixa urgência
        }
        
        // Score de rotatividade (0-100): produtos com mais movimentações = maior score
        const maxRotatividade = Math.max(...produtos.map(pr => pr.rotatividade));
        const scoreRotatividade = maxRotatividade > 0 
          ? (p.rotatividade / maxRotatividade) * 100 
          : 0;
        
        // Score final: 60% urgência + 40% rotatividade
        p.scoreFinal = (scoreUrgencia * 0.6) + (scoreRotatividade * 0.4);
      });
      
      // Ordenar por score final (maior score = maior prioridade)
      produtos.sort((a, b) => b.scoreFinal - a.scoreFinal);
      
      // Classificar em curvas A, B, C
      let countA = 0, countB = 0, countC = 0;
      const total = produtos.length;
      
      produtos.forEach((p, index) => {
        const percentual = ((index + 1) / total) * 100;
        
        // Curva A: Top 20% (produtos mais críticos)
        if (percentual <= 20) {
          p.curva = 'A';
          countA++;
        } 
        // Curva B: Próximos 30% (produtos de atenção média)
        else if (percentual <= 50) {
          p.curva = 'B';
          countB++;
        } 
        // Curva C: Restantes 50% (produtos menos críticos)
        else {
          p.curva = 'C';
          countC++;
        }
      });
      
      // Atualizar contadores
      document.getElementById('countA').textContent = countA;
      document.getElementById('countB').textContent = countB;
      document.getElementById('countC').textContent = countC;
      
      // Salvar globalmente para filtros
      produtosCurvaABC = produtos;
      
      // Preencher tabela
      tbody.innerHTML = '';
      produtos.forEach(p => {
        tbody.innerHTML += criarLinhaTabela(p);
      });
      
      // Desenhar gráfico
      desenharGraficoABC(countA, countB, countC, produtos);
      
      mostrarLoader(false);
    } catch (e) {
      handleError(e);
      mostrarLoader(false);
    }
  }

  function desenharGraficoABC(countA, countB, countC, produtos) {
    if (graficoABC) graficoABC.destroy();
    
    const ctx = document.getElementById('graficoABC');
    if (!ctx) return;
    
    graficoABC = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Curva A (Urgente)', 'Curva B (Atenção)', 'Curva C (OK)'],
        datasets: [{
          label: 'Quantidade de Produtos',
          data: [countA, countB, countC],
          backgroundColor: [
            'rgba(220, 38, 38, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(16, 185, 129, 0.8)'
          ],
          borderColor: [
            '#dc2626',
            '#f59e0b',
            '#10b981'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
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
                const total = countA + countB + countC;
                const percentage = ((context.parsed.y / total) * 100).toFixed(1);
                return `${context.parsed.y} produtos (${percentage}%)`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }

  // Funções auxiliares - expostas globalmente
  window.filtrarCurva = function(curva) {
    const tbody = document.getElementById('tabelaCurvaABCBody');
    const badge = document.getElementById('filtroAtivo');
    const busca = document.getElementById('buscaCurva');
    
    // Limpar busca
    if (busca) busca.value = '';
    
    if (curva === 'TODAS') {
      // Mostrar todos
      tbody.innerHTML = '';
      produtosCurvaABC.forEach(p => {
        tbody.innerHTML += criarLinhaTabela(p);
      });
      badge.textContent = 'Todas as classificações';
      badge.style.background = '#6b7280';
    } else {
      // Filtrar por curva
      const filtrados = produtosCurvaABC.filter(p => p.curva === curva);
      tbody.innerHTML = '';
      filtrados.forEach(p => {
        tbody.innerHTML += criarLinhaTabela(p);
      });
      
      const cores = { 'A': '#dc2626', 'B': '#f59e0b', 'C': '#10b981' };
      const labels = { 'A': 'URGENTE', 'B': 'ATENÇÃO', 'C': 'OK' };
      badge.textContent = `Curva ${curva} - ${labels[curva]}`;
      badge.style.background = cores[curva];
    }
  }

  // Buscar na tabela
  window.buscarNaCurva = function() {
    const busca = document.getElementById('buscaCurva').value.toLowerCase();
    const tbody = document.getElementById('tabelaCurvaABCBody');
    
    if (!busca) {
      // Se vazio, mostrar todos
      window.filtrarCurva('TODAS');
      return;
    }
    
    const filtrados = produtosCurvaABC.filter(p => {
      const nomeMarca = `${p.nome} ${p.marca}`.toLowerCase();
      return nomeMarca.includes(busca);
    });
    
    tbody.innerHTML = '';
    if (filtrados.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 24px; color: var(--text-secondary);">Nenhum produto encontrado</td></tr>';
    } else {
      filtrados.forEach(p => {
        tbody.innerHTML += criarLinhaTabela(p);
      });
    }
    
    const badge = document.getElementById('filtroAtivo');
    badge.textContent = `${filtrados.length} produto(s) encontrado(s)`;
    badge.style.background = '#1a73e8';
  }

  // Toggle gráfico
  window.toggleGrafico = function() {
    const card = document.getElementById('cardGraficoABC');
    if (card.style.display === 'none') {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  }

  // Criar linha da tabela com badges coloridos
  function criarLinhaTabela(p) {
    const cores = {
      'A': { bg: '#fee2e2', color: '#991b1b', badge: 'danger' },
      'B': { bg: '#fef3c7', color: '#92400e', badge: 'warning' },
      'C': { bg: '#d1fae5', color: '#065f46', badge: 'success' }
    };
    
    const estilo = cores[p.curva];
    
    // Formatar dias até vencimento
    let diasTexto = '-';
    let diasCor = estilo.color;
    if (p.diasVencimento < 9999) {
      if (p.diasVencimento < 0) {
        diasTexto = `<strong style="color: #dc2626;">VENCIDO</strong>`;
      } else if (p.diasVencimento === 0) {
        diasTexto = `<strong style="color: #dc2626;">HOJE</strong>`;
      } else if (p.diasVencimento <= 30) {
        diasTexto = `<strong style="color: #dc2626;">${p.diasVencimento}d</strong>`;
      } else if (p.diasVencimento <= 90) {
        diasTexto = `<strong style="color: #f59e0b;">${p.diasVencimento}d</strong>`;
      } else {
        diasTexto = `${p.diasVencimento}d`;
      }
    }
    
    // Formatar rotatividade
    let rotTexto = 'Baixa';
    if (p.rotatividade >= 10) {
      rotTexto = '<strong>Alta</strong>';
    } else if (p.rotatividade >= 5) {
      rotTexto = 'Média';
    }
    
    return `
      <tr style="background: ${estilo.bg};">
        <td>
          <span class="badge badge-${estilo.badge}" style="font-size: 14px; padding: 6px 12px;">
            ${p.curva}
          </span>
        </td>
        <td style="color: ${estilo.color}; font-weight: 500;">${p.nome}${p.marca ? ' - ' + p.marca : ''}</td>
        <td style="text-align: right; color: ${estilo.color}; font-weight: 600;">${p.quantidade}</td>
        <td style="text-align: center; color: ${diasCor};">${diasTexto}</td>
        <td style="text-align: center; color: ${estilo.color};">${rotTexto}</td>
      </tr>
    `;
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

  // ================ ATALHOS DE TECLADO ================
  document.addEventListener('keydown', (e) => {
    // Ignorar se estiver digitando em input/textarea (exceto atalhos com Ctrl/Cmd)
    const isTyping = ['INPUT', 'TEXTAREA'].includes(e.target.tagName);
    if (isTyping && !e.ctrlKey && !e.metaKey) return;
    
    // Ctrl/Cmd + P = Command Palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      if (auth.currentUser) {
        mostrarCommandPalette();
      }
    }
    
    // Ctrl/Cmd + K = Buscar produto
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (auth.currentUser && document.getElementById('estoque').classList.contains('tela-ativa')) {
        const inputBusca = document.getElementById('buscaEstoque');
        if (inputBusca) {
          inputBusca.focus();
          inputBusca.select();
          mostrarToast('💡 Digite para buscar produtos', 'info');
        }
      }
    }
    
    // Ctrl/Cmd + N = Novo produto
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      if (auth.currentUser && document.getElementById('estoque').classList.contains('tela-ativa')) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const primeiroCampo = document.getElementById('codigoBarras');
        if (primeiroCampo) primeiroCampo.focus();
        mostrarToast('💡 Novo produto - preencha os campos', 'info');
      }
    }
    
    // Ctrl/Cmd + Z = Desfazer última ação
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (auth.currentUser && historicoAcoes.length > 0) {
        desfazerUltimaAcao();
      }
    }
    
    // Ctrl/Cmd + A = Selecionar todos (na tela de estoque)
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      if (auth.currentUser && document.getElementById('estoque').classList.contains('tela-ativa')) {
        e.preventDefault();
        selecionarTodos();
      }
    }
    
    // Delete = Excluir selecionados
    if (e.key === 'Delete') {
      if (auth.currentUser && produtosSelecionados.size > 0) {
        e.preventDefault();
        excluirSelecionados();
      }
    }
    
    // Ctrl/Cmd + E = Exportar selecionados
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      if (auth.currentUser && produtosSelecionados.size > 0) {
        e.preventDefault();
        exportarSelecionados();
      }
    }
    
    // Ctrl/Cmd + H = Ajuda/Atalhos
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
      e.preventDefault();
      mostrarAjudaAtalhos();
    }
    
    // ESC = Fechar modals/limpar seleção
    if (e.key === 'Escape') {
      // Cancelar seleção se houver
      if (produtosSelecionados.size > 0) {
        cancelarSelecao();
        mostrarToast('Seleção cancelada', 'info');
      }
      
      // Fechar scanner se estiver aberto
      const scanner = document.getElementById('scanner');
      if (scanner && !scanner.classList.contains('d-none')) {
        scanner.classList.add('d-none');
      }
    }
  });
  
  // Modal de ajuda de atalhos
  function mostrarAjudaAtalhos() {
    const atalhos = `
      <div style="padding: 24px;">
        <h3 style="margin-bottom: 20px; color: var(--primary);">⌨️ Atalhos de Teclado</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px; font-size: 14px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <kbd style="padding: 4px 8px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 4px;">Ctrl/Cmd + K</kbd>
          </div>
          <div>Buscar produtos</div>
          
          <div style="display: flex; align-items: center; gap: 8px;">
            <kbd style="padding: 4px 8px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 4px;">Ctrl/Cmd + N</kbd>
          </div>
          <div>Novo produto</div>
          
          <div style="display: flex; align-items: center; gap: 8px;">
            <kbd style="padding: 4px 8px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 4px;">Ctrl/Cmd + A</kbd>
          </div>
          <div>Selecionar todos</div>
          
          <div style="display: flex; align-items: center; gap: 8px;">
            <kbd style="padding: 4px 8px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 4px;">Ctrl/Cmd + Z</kbd>
          </div>
          <div>Desfazer última ação</div>
          
          <div style="display: flex; align-items: center; gap: 8px;">
            <kbd style="padding: 4px 8px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 4px;">Ctrl/Cmd + E</kbd>
          </div>
          <div>Exportar selecionados</div>
          
          <div style="display: flex; align-items: center; gap: 8px;">
            <kbd style="padding: 4px 8px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 4px;">Delete</kbd>
          </div>
          <div>Excluir selecionados</div>
          
          <div style="display: flex; align-items: center; gap: 8px;">
            <kbd style="padding: 4px 8px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 4px;">ESC</kbd>
          </div>
          <div>Cancelar/Fechar</div>
          
          <div style="display: flex; align-items: center; gap: 8px;">
            <kbd style="padding: 4px 8px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 4px;">Ctrl/Cmd + H</kbd>
          </div>
          <div>Esta ajuda</div>
        </div>
        
        <div style="margin-top: 20px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
          <small style="color: var(--text-secondary);">
            💡 <strong>Dica:</strong> Use os atalhos para trabalhar mais rápido e aumentar sua produtividade!
          </small>
        </div>
        
        <button onclick="this.closest('.modal').remove()" class="btn btn-primary" style="margin-top: 20px; width: 100%;">
          Entendi
        </button>
      </div>
    `;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    modal.innerHTML = `<div style="background: var(--bg-card); border-radius: 12px; max-width: 600px; width: 90%; box-shadow: var(--shadow-lg);">${atalhos}</div>`;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }
  window.mostrarAjudaAtalhos = mostrarAjudaAtalhos;
  
  // ================ SISTEMA DE TEMAS ================
  
  const temas = {
    claro: {
      nome: 'Claro',
      emoji: '☀️',
      vars: {
        '--primary': '#1a73e8',
        '--bg-main': '#ffffff',
        '--bg-secondary': '#f8f9fa',
        '--bg-card': '#ffffff',
        '--text-primary': '#202124',
        '--text-secondary': '#5f6368',
        '--border': '#dadce0'
      }
    },
    escuro: {
      nome: 'Escuro',
      emoji: '🌙',
      vars: {
        '--primary': '#1a73e8',
        '--bg-main': '#1a1a1a',
        '--bg-secondary': '#121212',
        '--bg-card': '#1e1e1e',
        '--text-primary': '#e8eaed',
        '--text-secondary': '#9aa0a6',
        '--border': '#3c4043'
      }
    },
    azul: {
      nome: 'Azul Oceano',
      emoji: '🌊',
      vars: {
        '--primary': '#0277bd',
        '--bg-main': '#e1f5fe',
        '--bg-secondary': '#b3e5fc',
        '--bg-card': '#ffffff',
        '--text-primary': '#01579b',
        '--text-secondary': '#0277bd',
        '--border': '#81d4fa'
      }
    },
    roxo: {
      nome: 'Roxo Profundo',
      emoji: '🔮',
      vars: {
        '--primary': '#7b1fa2',
        '--bg-main': '#f3e5f5',
        '--bg-secondary': '#e1bee7',
        '--bg-card': '#ffffff',
        '--text-primary': '#4a148c',
        '--text-secondary': '#7b1fa2',
        '--border': '#ce93d8'
      }
    },
    verde: {
      nome: 'Verde Natureza',
      emoji: '🌿',
      vars: {
        '--primary': '#2e7d32',
        '--bg-main': '#e8f5e9',
        '--bg-secondary': '#c8e6c9',
        '--bg-card': '#ffffff',
        '--text-primary': '#1b5e20',
        '--text-secondary': '#2e7d32',
        '--border': '#a5d6a7'
      }
    },
    rosa: {
      nome: 'Rosa Suave',
      emoji: '🌸',
      vars: {
        '--primary': '#c2185b',
        '--bg-main': '#fce4ec',
        '--bg-secondary': '#f8bbd0',
        '--bg-card': '#ffffff',
        '--text-primary': '#880e4f',
        '--text-secondary': '#c2185b',
        '--border': '#f48fb1'
      }
    },
    escuroAzul: {
      nome: 'Escuro Azul',
      emoji: '🌌',
      vars: {
        '--primary': '#42a5f5',
        '--bg-main': '#0a1929',
        '--bg-secondary': '#071318',
        '--bg-card': '#0d1b2a',
        '--text-primary': '#e3f2fd',
        '--text-secondary': '#90caf9',
        '--border': '#1e3a5f'
      }
    },
    escuroRoxo: {
      nome: 'Escuro Roxo',
      emoji: '🌆',
      vars: {
        '--primary': '#ab47bc',
        '--bg-main': '#1a0a1f',
        '--bg-secondary': '#0f0814',
        '--bg-card': '#1f0a28',
        '--text-primary': '#f3e5f5',
        '--text-secondary': '#ce93d8',
        '--border': '#4a1458'
      }
    }
  };
  
  function aplicarTema(nomeTema) {
    const tema = temas[nomeTema];
    if (!tema) return;
    
    const root = document.documentElement;
    Object.entries(tema.vars).forEach(([prop, valor]) => {
      root.style.setProperty(prop, valor);
    });
    
    // Aplicar classe dark se necessário
    const temasEscuros = ['escuro', 'escuroAzul', 'escuroRoxo'];
    if (temasEscuros.includes(nomeTema)) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    
    // Salvar preferência
    try {
      localStorage.setItem('tema-preferido', nomeTema);
    } catch (e) {}
    
    // Atualizar ícone do botão
    const icone = document.getElementById('dark-icon');
    if (icone) icone.textContent = tema.emoji;
    
    mostrarToast(`🎨 Tema "${tema.nome}" aplicado!`, 'success');
  }
  window.aplicarTema = aplicarTema;
  
  function mostrarSeletorTemas() {
    const html = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;" onclick="if(event.target === this) this.remove()">
        <div style="background: var(--bg-card); border-radius: 16px; width: 100%; max-width: 600px; max-height: 80vh; overflow: hidden; box-shadow: var(--shadow-lg);" onclick="event.stopPropagation()">
          
          <div style="padding: 24px; border-bottom: 1px solid var(--border);">
            <h3 style="margin: 0; color: var(--text-primary); font-size: 20px; font-weight: 600;">
              🎨 Personalizar Tema
            </h3>
            <p style="margin: 8px 0 0 0; color: var(--text-secondary); font-size: 14px;">
              Escolha a aparência que mais combina com você
            </p>
          </div>
          
          <div style="padding: 20px; overflow-y: auto; max-height: calc(80vh - 140px);">
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px;">
              ${Object.entries(temas).map(([key, tema]) => `
                <button onclick="aplicarTema('${key}'); this.closest('div[style*=\\"position: fixed\\"]').remove();" 
                  style="
                    background: var(--bg-secondary);
                    border: 2px solid var(--border);
                    border-radius: 12px;
                    padding: 20px;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: center;
                  "
                  onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='var(--shadow-md)'; this.style.borderColor='var(--primary)'"
                  onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'; this.style.borderColor='var(--border)'">
                  <div style="font-size: 48px; margin-bottom: 12px;">${tema.emoji}</div>
                  <div style="font-weight: 600; color: var(--text-primary); font-size: 14px; margin-bottom: 8px;">
                    ${tema.nome}
                  </div>
                  <div style="display: flex; gap: 4px; justify-content: center;">
                    ${Object.values(tema.vars).slice(0, 4).map(cor => `
                      <div style="width: 20px; height: 20px; border-radius: 4px; background: ${cor}; border: 1px solid rgba(0,0,0,0.1);"></div>
                    `).join('')}
                  </div>
                </button>
              `).join('')}
            </div>
            
            <div style="margin-top: 24px; padding: 16px; background: var(--bg-secondary); border-radius: 8px;">
              <small style="color: var(--text-secondary); line-height: 1.6;">
                <strong>💡 Dica:</strong> Seu tema será salvo automaticamente e aplicado em todas as suas sessões.
              </small>
            </div>
          </div>
          
          <div style="padding: 16px 24px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end;">
            <button onclick="this.closest('div[style*=\\"position: fixed\\"]').remove()" class="btn btn-secondary">
              Fechar
            </button>
          </div>
          
        </div>
      </div>
    `;
    
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container.firstElementChild);
  }
  window.mostrarSeletorTemas = mostrarSeletorTemas;
  
  // Carregar tema salvo
  try {
    const temaSalvo = localStorage.getItem('tema-preferido');
    if (temaSalvo && temas[temaSalvo]) {
      aplicarTema(temaSalvo);
    }
  } catch (e) {}
  
  // Atualizar função toggleDarkMode para usar seletor
  window.toggleDarkMode = function() {
    mostrarSeletorTemas();
  };
  
  // ================ BACKUP AUTOMÁTICO ================
  
  let backupInterval = null;
  let backupConfig = {
    autoBackup: false,
    intervalo: 3600000, // 1 hora em ms
    maxBackups: 10,
    cloudProvider: null // 'drive', 'dropbox', 'local'
  };
  
  // Carregar config de backup
  try {
    const savedConfig = localStorage.getItem('backup-config');
    if (savedConfig) {
      backupConfig = { ...backupConfig, ...JSON.parse(savedConfig) };
    }
  } catch (e) {}
  
  function criarBackup(manual = false) {
    try {
      const timestamp = Date.now();
      const dataFormatada = new Date(timestamp).toLocaleString('pt-BR');
      
      const backup = {
        versao: '3.0',
        timestamp,
        dataFormatada,
        tipo: manual ? 'manual' : 'automatico',
        dados: {
          produtos: Array.from(produtos.values()),
          marcas: Array.from(marcas),
          categorias: Array.from(categorias),
          logs: logs.slice(-100), // Últimos 100 logs
          config: {
            diasParaAlerta: localStorage.getItem('dias-para-alerta'),
            modoVisao: localStorage.getItem('modo-visao'),
            tema: localStorage.getItem('tema-preferido')
          }
        },
        estatisticas: {
          totalProdutos: produtos.size,
          totalMarcas: marcas.size,
          totalCategorias: categorias.size,
          produtosVencidos: Array.from(produtos.values()).filter(p => p.diasRestantes < 0).length,
          produtosCriticos: Array.from(produtos.values()).filter(p => p.diasRestantes >= 0 && p.diasRestantes <= parseInt(localStorage.getItem('dias-para-alerta') || 7)).length
        }
      };
      
      const backupJson = JSON.stringify(backup, null, 2);
      const blob = new Blob([backupJson], { type: 'application/json' });
      
      // Salvar na memória (últimos N backups)
      salvarBackupNaMemoria(backup);
      
      // Download se manual
      if (manual) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FEFO_Backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        adicionarLog('backup', `Backup manual criado: ${backup.estatisticas.totalProdutos} produtos`);
        mostrarToast('💾 Backup criado com sucesso!', 'success');
      } else {
        adicionarLog('backup', `Backup automático: ${backup.estatisticas.totalProdutos} produtos`);
      }
      
      return backup;
      
    } catch (e) {
      console.error('Erro ao criar backup:', e);
      mostrarToast('⚠️ Erro ao criar backup', 'error');
      return null;
    }
  }
  
  function salvarBackupNaMemoria(backup) {
    try {
      const backupsKey = 'backups-automaticos';
      let backups = [];
      
      try {
        const saved = localStorage.getItem(backupsKey);
        if (saved) backups = JSON.parse(saved);
      } catch (e) {}
      
      // Adicionar novo backup
      backups.unshift({
        timestamp: backup.timestamp,
        dataFormatada: backup.dataFormatada,
        tipo: backup.tipo,
        totalProdutos: backup.estatisticas.totalProdutos,
        tamanho: JSON.stringify(backup).length
      });
      
      // Manter apenas os últimos N
      backups = backups.slice(0, backupConfig.maxBackups);
      
      localStorage.setItem(backupsKey, JSON.stringify(backups));
      localStorage.setItem(`backup-${backup.timestamp}`, JSON.stringify(backup));
      
      // Limpar backups antigos do storage
      limparBackupsAntigos(backups);
      
    } catch (e) {
      console.error('Erro ao salvar backup na memória:', e);
    }
  }
  
  function limparBackupsAntigos(backupsAtivos) {
    try {
      const timestampsAtivos = new Set(backupsAtivos.map(b => b.timestamp));
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('backup-')) {
          const timestamp = parseInt(key.replace('backup-', ''));
          if (!timestampsAtivos.has(timestamp)) {
            localStorage.removeItem(key);
          }
        }
      }
    } catch (e) {}
  }
  
  function restaurarBackup(timestamp) {
    try {
      const backupKey = `backup-${timestamp}`;
      const backupJson = localStorage.getItem(backupKey);
      
      if (!backupJson) {
        mostrarToast('⚠️ Backup não encontrado', 'error');
        return false;
      }
      
      const backup = JSON.parse(backupJson);
      
      // Confirmar restauração
      if (!confirm(`🔄 Restaurar backup de ${backup.dataFormatada}?\n\nIsto irá substituir todos os dados atuais.\n\n📊 Backup contém:\n• ${backup.estatisticas.totalProdutos} produtos\n• ${backup.dados.marcas.length} marcas\n• ${backup.dados.categorias.length} categorias`)) {
        return false;
      }
      
      // Criar backup dos dados atuais antes de restaurar
      criarBackup(true);
      
      // Restaurar dados
      produtos.clear();
      backup.dados.produtos.forEach(p => {
        produtos.set(p.id, p);
      });
      
      marcas = new Set(backup.dados.marcas);
      categorias = new Set(backup.dados.categorias);
      logs = backup.dados.logs || [];
      
      // Restaurar config
      if (backup.dados.config) {
        Object.entries(backup.dados.config).forEach(([key, value]) => {
          if (value !== null) localStorage.setItem(key, value);
        });
      }
      
      // Atualizar interface
      salvarNoLocalStorage();
      renderTabela();
      atualizarEstatisticas();
      atualizarGraficos();
      
      adicionarLog('backup', `Backup restaurado: ${backup.dataFormatada}`);
      mostrarToast('✅ Backup restaurado com sucesso!', 'success');
      
      return true;
      
    } catch (e) {
      console.error('Erro ao restaurar backup:', e);
      mostrarToast('⚠️ Erro ao restaurar backup', 'error');
      return false;
    }
  }
  
  function mostrarGerenciadorBackups() {
    try {
      const backupsJson = localStorage.getItem('backups-automaticos');
      const backups = backupsJson ? JSON.parse(backupsJson) : [];
      
      const html = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;" onclick="if(event.target === this) this.remove()">
          <div style="background: var(--bg-card); border-radius: 16px; width: 100%; max-width: 700px; max-height: 80vh; overflow: hidden; box-shadow: var(--shadow-lg);" onclick="event.stopPropagation()">
            
            <div style="padding: 24px; border-bottom: 1px solid var(--border);">
              <h3 style="margin: 0; color: var(--text-primary); font-size: 20px; font-weight: 600;">
                💾 Gerenciador de Backups
              </h3>
              <p style="margin: 8px 0 0 0; color: var(--text-secondary); font-size: 14px;">
                Proteja seus dados com backups automáticos
              </p>
            </div>
            
            <div style="padding: 20px; overflow-y: auto; max-height: calc(80vh - 220px);">
              
              <!-- Config de Backup Automático -->
              <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                  <div>
                    <strong style="color: var(--text-primary); display: block; margin-bottom: 4px;">⚙️ Backup Automático</strong>
                    <small style="color: var(--text-secondary);">Cria backups periodicamente</small>
                  </div>
                  <label style="position: relative; display: inline-block; width: 50px; height: 26px;">
                    <input type="checkbox" id="autoBackupToggle" ${backupConfig.autoBackup ? 'checked' : ''} 
                      onchange="window.toggleAutoBackup(this.checked)"
                      style="opacity: 0; width: 0; height: 0;">
                    <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 26px;"
                      onclick="const input = this.previousElementSibling; input.checked = !input.checked; input.onchange();">
                      <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; ${backupConfig.autoBackup ? 'transform: translateX(24px);' : ''}"></span>
                    </span>
                  </label>
                </div>
                
                <div style="display: flex; gap: 12px; align-items: center;">
                  <label style="flex: 1;">
                    <small style="color: var(--text-secondary); display: block; margin-bottom: 4px;">Intervalo</small>
                    <select id="intervaloBackup" onchange="window.atualizarConfigBackup()" 
                      style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-card); color: var(--text-primary);">
                      <option value="1800000" ${backupConfig.intervalo === 1800000 ? 'selected' : ''}>30 minutos</option>
                      <option value="3600000" ${backupConfig.intervalo === 3600000 ? 'selected' : ''}>1 hora</option>
                      <option value="7200000" ${backupConfig.intervalo === 7200000 ? 'selected' : ''}>2 horas</option>
                      <option value="14400000" ${backupConfig.intervalo === 14400000 ? 'selected' : ''}>4 horas</option>
                      <option value="28800000" ${backupConfig.intervalo === 28800000 ? 'selected' : ''}>8 horas</option>
                      <option value="86400000" ${backupConfig.intervalo === 86400000 ? 'selected' : ''}>24 horas</option>
                    </select>
                  </label>
                  
                  <label style="flex: 1;">
                    <small style="color: var(--text-secondary); display: block; margin-bottom: 4px;">Manter últimos</small>
                    <select id="maxBackups" onchange="window.atualizarConfigBackup()" 
                      style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-card); color: var(--text-primary);">
                      <option value="5" ${backupConfig.maxBackups === 5 ? 'selected' : ''}>5 backups</option>
                      <option value="10" ${backupConfig.maxBackups === 10 ? 'selected' : ''}>10 backups</option>
                      <option value="20" ${backupConfig.maxBackups === 20 ? 'selected' : ''}>20 backups</option>
                      <option value="50" ${backupConfig.maxBackups === 50 ? 'selected' : ''}>50 backups</option>
                    </select>
                  </label>
                </div>
              </div>
              
              <!-- Lista de Backups -->
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <strong style="color: var(--text-primary);">📋 Backups Disponíveis (${backups.length})</strong>
                  <button onclick="window.criarBackup(true); setTimeout(() => { this.closest('div[style*=\\'position: fixed\\']').remove(); window.mostrarGerenciadorBackups(); }, 500);" 
                    class="btn btn-primary btn-sm">
                    ➕ Criar Backup Manual
                  </button>
                </div>
                
                ${backups.length === 0 ? `
                  <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
                    <p>Nenhum backup ainda</p>
                    <small>Crie seu primeiro backup ou ative o backup automático</small>
                  </div>
                ` : `
                  <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${backups.map(backup => `
                      <div style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-size: 20px;">${backup.tipo === 'manual' ? '👤' : '🤖'}</span>
                            <strong style="color: var(--text-primary); font-size: 14px;">${backup.dataFormatada}</strong>
                            <span style="background: var(--primary); color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">
                              ${backup.tipo.toUpperCase()}
                            </span>
                          </div>
                          <div style="display: flex; gap: 16px; font-size: 12px; color: var(--text-secondary);">
                            <span>📦 ${backup.totalProdutos} produtos</span>
                            <span>💾 ${(backup.tamanho / 1024).toFixed(1)} KB</span>
                          </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                          <button onclick="if(window.restaurarBackup(${backup.timestamp})) { this.closest('div[style*=\\'position: fixed\\']').remove(); }" 
                            class="btn btn-sm btn-primary" title="Restaurar este backup">
                            🔄 Restaurar
                          </button>
                          <button onclick="window.baixarBackup(${backup.timestamp})" 
                            class="btn btn-sm btn-secondary" title="Baixar backup">
                            ⬇️
                          </button>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>
            </div>
            
            <div style="padding: 16px 24px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end;">
              <button onclick="this.closest('div[style*=\\'position: fixed\\']').remove()" class="btn btn-secondary">
                Fechar
              </button>
            </div>
            
          </div>
        </div>
      `;
      
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container.firstElementChild);
      
    } catch (e) {
      console.error('Erro ao mostrar gerenciador:', e);
      mostrarToast('⚠️ Erro ao abrir gerenciador', 'error');
    }
  }
  window.mostrarGerenciadorBackups = mostrarGerenciadorBackups;
  
  function toggleAutoBackup(ativo) {
    backupConfig.autoBackup = ativo;
    
    if (ativo) {
      // Iniciar backup automático
      if (backupInterval) clearInterval(backupInterval);
      
      backupInterval = setInterval(() => {
        criarBackup(false);
      }, backupConfig.intervalo);
      
      mostrarToast('✅ Backup automático ativado', 'success');
      adicionarLog('config', 'Backup automático ativado');
    } else {
      // Parar backup automático
      if (backupInterval) {
        clearInterval(backupInterval);
        backupInterval = null;
      }
      
      mostrarToast('⏸️ Backup automático desativado', 'info');
      adicionarLog('config', 'Backup automático desativado');
    }
    
    // Salvar config
    localStorage.setItem('backup-config', JSON.stringify(backupConfig));
  }
  window.toggleAutoBackup = toggleAutoBackup;
  
  function atualizarConfigBackup() {
    const intervalo = parseInt(document.getElementById('intervaloBackup')?.value || backupConfig.intervalo);
    const maxBackups = parseInt(document.getElementById('maxBackups')?.value || backupConfig.maxBackups);
    
    backupConfig.intervalo = intervalo;
    backupConfig.maxBackups = maxBackups;
    
    // Salvar
    localStorage.setItem('backup-config', JSON.stringify(backupConfig));
    
    // Reiniciar intervalo se ativo
    if (backupConfig.autoBackup) {
      if (backupInterval) clearInterval(backupInterval);
      backupInterval = setInterval(() => {
        criarBackup(false);
      }, backupConfig.intervalo);
    }
    
    mostrarToast('⚙️ Configurações atualizadas', 'success');
  }
  window.atualizarConfigBackup = atualizarConfigBackup;
  
  function baixarBackup(timestamp) {
    try {
      const backupJson = localStorage.getItem(`backup-${timestamp}`);
      if (!backupJson) {
        mostrarToast('⚠️ Backup não encontrado', 'error');
        return;
      }
      
      const backup = JSON.parse(backupJson);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FEFO_Backup_${backup.dataFormatada.replace(/[/:]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      mostrarToast('⬇️ Backup baixado!', 'success');
    } catch (e) {
      console.error('Erro ao baixar backup:', e);
      mostrarToast('⚠️ Erro ao baixar', 'error');
    }
  }
  window.baixarBackup = baixarBackup;
  window.criarBackup = criarBackup;
  window.restaurarBackup = restaurarBackup;
  
  // Iniciar backup automático se configurado
  if (backupConfig.autoBackup) {
    backupInterval = setInterval(() => {
      criarBackup(false);
    }, backupConfig.intervalo);
    console.log('✅ Backup automático iniciado');
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

// ================ DASHBOARD METRICS (fora da IIFE) ================
window.atualizarMetricas = async function() {
  try {
    const snap = await getCollection('estoque').get();
    let total = 0;
    let proxVencer = 0;
    let vencidos = 0;
    let valorTotal = 0;
    const hoje = new Date();
    const em7Dias = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    snap.forEach(doc => {
      const p = doc.data();
      total++;
      
      // Calcular valor (simulado - em produção usar preço real)
      valorTotal += (p.quantidade || 0) * 10; // R$ 10 por unidade (exemplo)
      
      if (p.dataValidade && p.dataValidade.toDate) {
        const dataValidade = p.dataValidade.toDate();
        if (dataValidade < hoje) {
          vencidos++;
        } else if (dataValidade <= em7Dias) {
          proxVencer++;
        }
      }
    });
    
    // Atualizar valores
    const elTotal = document.getElementById('totalProdutos');
    const elProx = document.getElementById('proxVencer');
    const elVenc = document.getElementById('vencidos');
    const elValor = document.getElementById('valorTotal');
    
    if (elTotal) elTotal.textContent = formatNumber(total);
    if (elProx) elProx.textContent = formatNumber(proxVencer);
    if (elVenc) elVenc.textContent = formatNumber(vencidos);
    if (elValor) elValor.textContent = formatCurrency(valorTotal);
    
    // Calcular tendências (simulado - em produção comparar com período anterior)
    const trendTotal = document.getElementById('trendTotal');
    const trendProx = document.getElementById('trendProx');
    const trendVenc = document.getElementById('trendVenc');
    const trendValor = document.getElementById('trendValor');
    
    // Simular variações aleatórias
    const varTotal = (Math.random() * 10 - 5).toFixed(1);
    const varProx = (Math.random() * 20 - 10).toFixed(1);
    const varVenc = (Math.random() * 15 - 7).toFixed(1);
    const varValor = (Math.random() * 8 - 4).toFixed(1);
    
    if (trendTotal) {
      trendTotal.textContent = (varTotal > 0 ? '↑' : varTotal < 0 ? '↓' : '→') + Math.abs(varTotal) + '%';
      trendTotal.className = 'stat-trend ' + (varTotal > 0 ? 'up' : varTotal < 0 ? 'down' : 'neutral');
    }
    
    if (trendProx) {
      trendProx.textContent = (varProx > 0 ? '↑' : varProx < 0 ? '↓' : '→') + Math.abs(varProx) + '%';
      trendProx.className = 'stat-trend ' + (varProx > 0 ? 'up' : varProx < 0 ? 'down' : 'neutral');
    }
    
    if (trendVenc) {
      trendVenc.textContent = (varVenc > 0 ? '↑' : varVenc < 0 ? '↓' : '→') + Math.abs(varVenc) + '%';
      trendVenc.className = 'stat-trend ' + (varVenc > 0 ? 'up' : varVenc < 0 ? 'down' : 'neutral');
    }
    
    if (trendValor) {
      trendValor.textContent = (varValor > 0 ? '↑' : varValor < 0 ? '↓' : '→') + Math.abs(varValor) + '%';
      trendValor.className = 'stat-trend ' + (varValor > 0 ? 'up' : varValor < 0 ? 'down' : 'neutral');
    }
    
    // Atualizar gráficos se estiverem carregados
    if (typeof inicializarGraficosDashboard === 'function' && document.getElementById('menu').style.display !== 'none') {
      await inicializarGraficosDashboard();
    }
    
  } catch (e) {
    logger.error('Erro ao atualizar métricas', e);
  }
}

// Átualiza métricas ao abrir o menu
auth.onAuthStateChanged(user => {
  if (user) {
    atualizarMetricas();
    carregarGraficosEvolucao();
    inicializarGraficosDashboard();
    setInterval(atualizarMetricas, 60000); // Atualiza a cada 1 minuto
  }
});

// ================ GRÁFICOS AVANÇADOS ================

let graficoEvolucao = null;
let graficoStatus = null;
let graficoTopProdutos = null;
let graficoMarcas = null;

async function inicializarGraficosDashboard() {
  try {
    await carregarGraficoEvolucao();
    await carregarGraficoStatus();
    await carregarGraficoTopProdutos();
    await carregarGraficoMarcas();
  } catch (error) {
    logger.error('Erro ao inicializar gráficos', error);
  }
}
window.inicializarGraficosDashboard = inicializarGraficosDashboard;

// Gráfico de Evolução do Estoque (Linha)
async function carregarGraficoEvolucao() {
  const ctx = document.getElementById('graficoEvolucao');
  if (!ctx) return;
  
  const periodo = Number(document.getElementById('periodoGrafico')?.value || 7);
  
  // Gerar labels de datas
  const labels = [];
  const hoje = new Date();
  for (let i = periodo - 1; i >= 0; i--) {
    const data = new Date(hoje);
    data.setDate(data.getDate() - i);
    labels.push(data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
  }
  
  // Dados simulados para demonstração
  const quantidadeBase = 120;
  const dados = [];
  for (let i = 0; i < periodo; i++) {
    const variacao = Math.floor(Math.random() * 20) - 10; // -10 a +10
    dados.push(Math.max(0, quantidadeBase + variacao * (periodo - i)));
  }
  
  if (graficoEvolucao) graficoEvolucao.destroy();
  
  graficoEvolucao = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Quantidade Total',
        data: dados,
        borderColor: 'rgb(26, 115, 232)',
        backgroundColor: 'rgba(26, 115, 232, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Quantidade: ${context.parsed.y.toLocaleString('pt-BR')} unidades`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => value.toLocaleString('pt-BR')
          }
        }
      }
    }
  });
}
window.atualizarGraficoEvolucao = carregarGraficoEvolucao;

// Gráfico de Status (Pizza)
async function carregarGraficoStatus() {
  const ctx = document.getElementById('graficoStatus');
  if (!ctx) return;
  
  // Dados simulados para demonstração
  const ok = 45;
  const proximo = 12;
  const vencido = 3;
  
  if (graficoStatus) graficoStatus.destroy();
  
  graficoStatus = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['✅ OK', '⚠️ Próximo', '❌ Vencido'],
      datasets: [{
        data: [ok, proximo, vencido],
        backgroundColor: [
          'rgb(30, 142, 62)',
          'rgb(249, 171, 0)',
          'rgb(217, 48, 37)'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 15, font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percent = ((value / total) * 100).toFixed(1);
              return `${label}: ${value} (${percent}%)`;
            }
          }
        }
      }
    }
  });
}

// Gráfico Top 5 Produtos (Barras Horizontais)
async function carregarGraficoTopProdutos() {
  const ctx = document.getElementById('graficoTopProdutos');
  if (!ctx) return;
  
  // Dados simulados para demonstração
  const top5 = [
    { nome: 'Produto A', quantidade: 50 },
    { nome: 'Produto B', quantidade: 35 },
    { nome: 'Produto C', quantidade: 28 },
    { nome: 'Produto D', quantidade: 22 },
    { nome: 'Produto E', quantidade: 18 }
  ];
  
  const labels = top5.map(p => p.nome);
  const dados = top5.map(p => p.quantidade);
  
  if (graficoTopProdutos) graficoTopProdutos.destroy();
  
  graficoTopProdutos = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Quantidade',
        data: dados,
        backgroundColor: [
          'rgba(26, 115, 232, 0.8)',
          'rgba(30, 142, 62, 0.8)',
          'rgba(249, 171, 0, 0.8)',
          'rgba(156, 39, 176, 0.8)',
          'rgba(0, 188, 212, 0.8)'
        ],
        borderWidth: 0
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Quantidade: ${context.parsed.x.toLocaleString('pt-BR')} unidades`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: (value) => value.toLocaleString('pt-BR')
          }
        }
      }
    }
  });
}

// Gráfico Distribuição por Marca (Pizza)
async function carregarGraficoMarcas() {
  const ctx = document.getElementById('graficoMarcas');
  if (!ctx) return;
  
  // Dados simulados para demonstração
  const marcasOrdenadas = [
    ['Marca A', 25],
    ['Marca B', 18],
    ['Marca C', 15],
    ['Marca D', 12],
    ['Marca E', 10]
  ];
  
  const labels = marcasOrdenadas.map(m => m[0]);
  const dados = marcasOrdenadas.map(m => m[1]);
  
  const cores = [
    'rgb(26, 115, 232)',
    'rgb(30, 142, 62)',
    'rgb(249, 171, 0)',
    'rgb(156, 39, 176)',
    'rgb(0, 188, 212)'
  ];
  
  if (graficoMarcas) graficoMarcas.destroy();
  
  graficoMarcas = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: dados,
        backgroundColor: cores.slice(0, dados.length),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 10, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percent = ((value / total) * 100).toFixed(1);
              return `${label}: ${value.toLocaleString('pt-BR')} (${percent}%)`;
            }
          }
        }
      }
    }
  });
}

// ================ GRÁFICOS DE EVOLUÇÃO ================
async function carregarGraficosEvolucao() {
  try {
    // Busca estoque atual para simular evolução
    const snap = await getCollection('estoque').get();
    
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
    
    const snap = await getCollection('historico').orderBy('timestamp', 'desc').limit(50).get();
    
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
  const datalist = document.getElementById("listaMarcas");
  const filtro = document.getElementById("filtroMarca");

  if (!datalist) return;

  datalist.innerHTML = '';
  if (filtro) filtro.innerHTML = `<option value="">Todas as marcas</option>`;

  const snap = await db.collection("marcas").orderBy("nome").get();

  snap.forEach(doc => {
    const nome = doc.data().nome;
    datalist.innerHTML += `<option value="${nome}">`;
    if (filtro) filtro.innerHTML += `<option value="${nome}">${nome}</option>`;
  });
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
        const estoqueSnap = await getCollection('estoque')
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
        await getCollection('estoque').add({
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

// ================= SESSÃO =================
auth.onAuthStateChanged(user => {
  if (user) abrir("menu");
  else abrir("login");
});

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
  mostrarToast('📊 Gerando relatório...', 'info');
  
  try {
    // Gerar dados do relatório
    const snapshot = await getCollection('estoque').get();
    
    const produtos = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      produtos.push({
        codigo: data.codigo || '',
        nome: data.nome || '',
        marca: data.marca || '',
        categoria: data.categoria || '',
        quantidade: data.quantidade || 0,
        validade: data.dataValidade ? data.dataValidade.toDate() : null
      });
    });
    
    const hoje = new Date();
    const total = produtos.length;
    const vencidos = produtos.filter(p => p.validade && p.validade < hoje).length;
    const proxVencer = produtos.filter(p => {
      if (!p.validade) return false;
      const dias7 = new Date(hoje);
      dias7.setDate(dias7.getDate() + 7);
      return p.validade >= hoje && p.validade <= dias7;
    }).length;
    
    // Gerar mensagem
    const mensagem = `📦 *Relatório de Estoque FEFO*\n\n` +
      `📊 *Resumo:*\n` +
      `• Total: ${total} produtos\n` +
      `• Próximos a vencer: ${proxVencer}\n` +
      `• Vencidos: ${vencidos}\n\n` +
      `📅 Gerado em: ${hoje.toLocaleDateString('pt-BR')} às ${hoje.toLocaleTimeString('pt-BR')}\n\n` +
      `🌐 Acesse o sistema: https://mayyzena.github.io/sistema-fefo`;
    
    if (tipo === 'whatsapp') {
      // Compartilhar via WhatsApp
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`;
      window.open(url, '_blank');
      mostrarToast('✅ Abrindo WhatsApp...', 'success');
    } else if (tipo === 'email') {
      // Compartilhar via Email
      const assunto = `Relatório de Estoque FEFO - ${hoje.toLocaleDateString('pt-BR')}`;
      const corpo = mensagem.replace(/\*/g, '').replace(/\n/g, '%0D%0A');
      const url = `mailto:?subject=${encodeURIComponent(assunto)}&body=${corpo}`;
      window.location.href = url;
      mostrarToast('✅ Abrindo cliente de email...', 'success');
    }
  } catch (error) {
    console.error('Erro ao compartilhar relatório:', error);
    mostrarToast('❌ Erro ao compartilhar relatório', 'error');
  }
}

window.compartilharRelatorio = compartilharRelatorio;

// ==================== BACKUP ====================
async function fazerBackup() {
  mostrarToast('💾 Gerando backup...', 'info');
  
  try {
    const backup = {
      versao: '1.0',
      dataBackup: new Date().toISOString(),
      usuario: usuarioAtual?.email || 'desconhecido',
      dados: {
        estoque: [],
        historico: [],
        locais: []
      }
    };
    
    // Buscar estoque
    const snapshotEstoque = await getCollection('estoque').get();
    snapshotEstoque.forEach(doc => {
      backup.dados.estoque.push({ id: doc.id, ...doc.data() });
    });
    
    // Buscar histórico
    const snapshotHistorico = await getCollection('historico').get();
    snapshotHistorico.forEach(doc => {
      backup.dados.historico.push({ id: doc.id, ...doc.data() });
    });
    
    // Buscar locais
    const snapshotLocais = await getCollection('locais').get();
    snapshotLocais.forEach(doc => {
      backup.dados.locais.push({ id: doc.id, ...doc.data() });
    });
    
    // Converter para JSON
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Download
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-fefo-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    mostrarToast('✅ Backup realizado com sucesso!', 'success');
    
    // Salvar último backup no localStorage
    try {
      localStorage.setItem('fefo-ultimo-backup', new Date().toISOString());
    } catch(e) {
      console.error('Erro ao salvar data do último backup:', e);
    }
  } catch (error) {
    console.error('Erro ao fazer backup:', error);
    mostrarToast('❌ Erro ao fazer backup', 'error');
  }
}

window.fazerBackup = fazerBackup;
window.solicitarPermissaoNotificacao = solicitarPermissaoNotificacao;

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
    
    const snapshot = await getCollection('locais').get();
    
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
    const existe = await getCollection('locais').where('nome', '==', nome).get();
    if (!existe.empty) {
      alert('⚠️ Esse local já está cadastrado!');
      mostrarLoader(false);
      return;
    }
    
    await getCollection('locais').add({
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
    
    const snapshot = await getCollection('locais').get();
    
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
    await getCollection('locais').doc(id).delete();
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

function editarUsuario(id) {
  alert('🛠️ Função de edição em desenvolvimento. Por enquanto, exclua e crie novamente.');
}

// Expor funções no escopo global
window.excluirUsuario = excluirUsuario;
window.editarUsuario = editarUsuario;

// Carregar perfil ao fazer login
auth.onAuthStateChanged(user => {
  if (user) {
    carregarPerfilUsuario();
    carregarLocais();
  }
});

// ==================== VERIFICAR LIMITE DO PLANO ====================
async function verificarLimitePlano() {
  try {
    const snapshot = await getCollection('estoque').get();
    const totalProdutos = snapshot.size;
    
    const plano = empresaAtual?.plano || 'gratuito';
    let limite = 50; // Gratuito = 50 produtos
    
    if (plano === 'basico') {
      limite = 500;
    } else if (plano === 'profissional') {
      limite = 999999; // Ilimitado
    }
    
    if (totalProdutos >= limite) {
      mostrarToast(`❌ Limite de ${limite} produtos atingido! Faça upgrade do seu plano.`, 'error');
      
      // Mostrar modal de upgrade
      setTimeout(() => {
        if (confirm(`Você atingiu o limite de ${limite} produtos do plano ${plano.toUpperCase()}.\n\nDeseja fazer upgrade?`)) {
          mostrarPerfil(); // Redireciona para tela de perfil/upgrade
        }
      }, 500);
      
      return true; // Limite atingido
    }
    
    // Avisar quando chegar a 90% do limite
    if (totalProdutos >= limite * 0.9) {
      mostrarToast(`⚠️ Atenção: ${totalProdutos}/${limite} produtos. Considere fazer upgrade!`, 'warning');
    }
    
    return false; // Não atingiu o limite
  } catch (error) {
    console.error('Erro ao verificar limite:', error);
    return false;
  }
}

// ==================== PERFIL DA EMPRESA ====================
function mostrarPerfil() {
  // Esconder todas as telas
  document.querySelectorAll('.tela').forEach(t => {
    if (t.id !== 'login') {
      t.style.display = 'none';
    }
  });
  
  // Buscar ou criar seção de perfil
  let secaoPerfil = document.getElementById('secaoPerfil');
  if (!secaoPerfil) {
    secaoPerfil = document.createElement('section');
    secaoPerfil.id = 'secaoPerfil';
    secaoPerfil.className = 'tela';
    secaoPerfil.style.display = 'none';
    const contentWrapper = document.querySelector('.content-wrapper');
    if (contentWrapper) {
      contentWrapper.appendChild(secaoPerfil);
    } else {
      console.error('Elemento content-wrapper não encontrado');
      return;
    }
  }
  
  // Mostrar seção de perfil
  secaoPerfil.style.display = 'block';
  
  // Atualizar título
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) pageTitle.textContent = 'Perfil da Empresa';
  
  // Renderizar conteúdo
  renderizarPerfil();
}

async function renderizarPerfil() {
  const secaoPerfil = document.getElementById('secaoPerfil');
  
  // Obter estatísticas de uso
  let totalProdutos = 0;
  try {
    const snapshot = await getCollection('estoque').get();
    totalProdutos = snapshot.size;
  } catch (error) {
    console.error('Erro ao carregar estatísticas:', error);
  }
  
  const plano = empresaAtual?.plano || 'gratuito';
  const nomeEmpresa = empresaAtual?.nomeEmpresa || 'Minha Empresa';
  const email = usuarioAtual?.email || '';
  const telefone = empresaAtual?.telefone || '';
  const endereco = empresaAtual?.endereco || '';
  const cnpj = empresaAtual?.cnpj || '';
  const responsavel = empresaAtual?.responsavel || '';
  
  let limite = 50;
  let nomePlano = '🆓 Gratuito';
  let corPlano = '#9e9e9e';
  
  if (plano === 'basico') {
    limite = 500;
    nomePlano = '💼 Básico';
    corPlano = '#2196F3';
  } else if (plano === 'profissional') {
    limite = 999999;
    nomePlano = '🏢 Profissional';
    corPlano = '#4CAF50';
  }
  
  const porcentagemUso = plano === 'profissional' ? 0 : Math.round((totalProdutos / limite) * 100);
  
  secaoPerfil.innerHTML = `
    <div class="header-secao">
      <h2>🏢 Perfil da Empresa</h2>
      <p style="color: #666; margin-top: 8px;">Gerencie as informações da sua empresa e configurações</p>
    </div>
    
    <div class="card" style="max-width: 900px; margin: 0 auto;">
      <!-- Informações da Empresa -->
      <div style="padding: 24px; border-bottom: 1px solid var(--border);">
        <h3 style="margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
          📋 Informações da Empresa
        </h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <label style="display: block; font-weight: 500; margin-bottom: 8px; color: var(--text-primary);">
              Nome da Empresa *
            </label>
            <input type="text" id="inputNomeEmpresa" value="${nomeEmpresa}" 
                   placeholder="Ex: Farmácia Central"
                   style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; background: var(--bg-main); color: var(--text-primary);">
          </div>
          
          <div>
            <label style="display: block; font-weight: 500; margin-bottom: 8px; color: var(--text-primary);">
              Responsável
            </label>
            <input type="text" id="inputResponsavel" value="${responsavel}" 
                   placeholder="Nome do responsável"
                   style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; background: var(--bg-main); color: var(--text-primary);">
          </div>
          
          <div>
            <label style="display: block; font-weight: 500; margin-bottom: 8px; color: var(--text-primary);">
              Email
            </label>
            <input type="email" value="${email}" disabled
                   style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; background: var(--bg-secondary); color: var(--text-disabled); cursor: not-allowed;">
            <small style="color: var(--text-secondary); font-size: 12px;">O email não pode ser alterado</small>
          </div>
          
          <div>
            <label style="display: block; font-weight: 500; margin-bottom: 8px; color: var(--text-primary);">
              Telefone
            </label>
            <input type="tel" id="inputTelefone" value="${telefone}" 
                   placeholder="(00) 00000-0000"
                   style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; background: var(--bg-main); color: var(--text-primary);">
          </div>
          
          <div>
            <label style="display: block; font-weight: 500; margin-bottom: 8px; color: var(--text-primary);">
              CNPJ/CPF
            </label>
            <input type="text" id="inputCnpj" value="${cnpj}" 
                   placeholder="00.000.000/0000-00"
                   style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; background: var(--bg-main); color: var(--text-primary);">
          </div>
          
          <div>
            <label style="display: block; font-weight: 500; margin-bottom: 8px; color: var(--text-primary);">
              Endereço Completo
            </label>
            <input type="text" id="inputEndereco" value="${endereco}" 
                   placeholder="Rua, número, bairro, cidade"
                   style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; background: var(--bg-main); color: var(--text-primary);">
          </div>
        </div>
        
        <button onclick="salvarPerfilEmpresa()" class="btn-primary" style="margin-top: 20px; padding: 12px 24px; font-weight: 600;">
          💾 Salvar Alterações
        </button>
      </div>
      
      <!-- Plano Atual -->
      <div style="padding: 24px; border-bottom: 1px solid var(--border);">
        <h3 style="margin-bottom: 16px; color: var(--text-primary);">💳 Plano Atual</h3>
        
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
          <div style="flex: 1; padding: 16px; background: linear-gradient(135deg, ${corPlano}15 0%, ${corPlano}05 100%); 
                      border-left: 4px solid ${corPlano}; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: 600; color: ${corPlano};">${nomePlano}</div>
            <div style="color: var(--text-secondary); margin-top: 4px;">
              ${plano === 'profissional' ? 'Produtos ilimitados' : `Até ${limite} produtos`}
            </div>
          </div>
        </div>
        
        ${plano !== 'profissional' ? `
          <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-weight: 500; color: var(--text-primary);">Uso do Plano</span>
              <span style="font-weight: 600; color: ${porcentagemUso >= 90 ? '#f44336' : porcentagemUso >= 70 ? '#ff9800' : '#4CAF50'};">
                ${totalProdutos} / ${limite} produtos (${porcentagemUso}%)
              </span>
            </div>
            <div style="height: 8px; background: var(--bg-secondary); border-radius: 4px; overflow: hidden;">
              <div style="height: 100%; width: ${porcentagemUso}%; background: ${porcentagemUso >= 90 ? '#f44336' : porcentagemUso >= 70 ? '#ff9800' : '#4CAF50'}; 
                          transition: width 0.3s;"></div>
            </div>
          </div>
        ` : ''}
        
        ${plano === 'gratuito' ? `
          <div style="padding: 16px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 16px;">
            <div style="font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">⭐ Faça upgrade e tenha:</div>
            <ul style="margin: 0; padding-left: 20px; line-height: 1.8; color: var(--text-secondary);">
              <li><strong>Plano Básico (R$ 29,90/mês):</strong> Até 500 produtos</li>
              <li><strong>Plano Profissional (R$ 79,90/mês):</strong> Produtos ilimitados + Suporte prioritário</li>
            </ul>
          </div>
          
          <button onclick="alert('Em breve! Sistema de pagamento será implementado.')" 
                  class="btn-primary" style="width: 100%;">
            🚀 Fazer Upgrade
          </button>
        ` : plano === 'basico' ? `
          <button onclick="alert('Em breve! Sistema de pagamento será implementado.')" 
                  class="btn-primary" style="width: 100%;">
            🚀 Upgrade para Profissional
          </button>
        ` : `
          <div style="text-align: center; padding: 16px; color: #4CAF50; font-weight: 500;">
            ✅ Você está no melhor plano disponível!
          </div>
        `}
      </div>
      
      <!-- Zona de Perigo -->
      <div style="padding: 24px;">
        <h3 style="margin-bottom: 16px; color: #f44336;">⚠️ Zona de Perigo</h3>
        
        <button onclick="confirmarExclusaoConta()" class="btn-danger" style="width: 100%;">
          🗑️ Excluir Conta e Todos os Dados
        </button>
        
        <p style="margin-top: 12px; color: var(--text-secondary); font-size: 12px; text-align: center;">
          Esta ação é irreversível. Todos os seus dados serão permanentemente excluídos.
        </p>
      </div>
    </div>
  `;
}

async function salvarPerfilEmpresa() {
  try {
    const novoNome = document.getElementById('inputNomeEmpresa').value.trim();
    const novoResponsavel = document.getElementById('inputResponsavel')?.value.trim() || '';
    const novoTelefone = document.getElementById('inputTelefone')?.value.trim() || '';
    const novoCnpj = document.getElementById('inputCnpj')?.value.trim() || '';
    const novoEndereco = document.getElementById('inputEndereco')?.value.trim() || '';
    
    if (!novoNome) {
      mostrarToast('❌ Nome da empresa não pode ficar vazio!', 'error');
      return;
    }
    
    mostrarLoader(true);
    
    // Atualizar no Firebase
    await db.collection('usuarios').doc(auth.currentUser.uid).update({
      nomeEmpresa: novoNome,
      responsavel: novoResponsavel,
      telefone: novoTelefone,
      cnpj: novoCnpj,
      endereco: novoEndereco,
      dataAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Atualizar variável global
    empresaAtual.nomeEmpresa = novoNome;
    empresaAtual.responsavel = novoResponsavel;
    empresaAtual.telefone = novoTelefone;
    empresaAtual.cnpj = novoCnpj;
    empresaAtual.endereco = novoEndereco;
    
    // Atualizar nome no header
    const nomeEmpresaEl = document.getElementById('nomeEmpresa');
    if (nomeEmpresaEl) nomeEmpresaEl.textContent = novoNome;
    
    mostrarLoader(false);
    mostrarToast('✅ Perfil atualizado com sucesso!', 'success');
    
  } catch (error) {
    mostrarLoader(false);
    console.error('Erro ao salvar perfil:', error);
    mostrarToast('❌ Erro ao salvar. Tente novamente.', 'error');
  }
}

function atualizarBadgePlano() {
  const badge = document.getElementById('planoBadge');
  if (!badge) return;
  
  const plano = empresaAtual?.plano || 'gratuito';
  
  if (plano === 'gratuito') {
    badge.textContent = '🆓 Gratuito';
    badge.style.background = '#e0e0e0';
    badge.style.color = '#424242';
  } else if (plano === 'basico') {
    badge.textContent = '💼 Básico';
    badge.style.background = '#E3F2FD';
    badge.style.color = '#1976D2';
  } else if (plano === 'profissional') {
    badge.textContent = '🏢 Profissional';
    badge.style.background = '#E8F5E9';
    badge.style.color = '#388E3C';
  }
}

function confirmarExclusaoConta() {
  const confirmacao = prompt('⚠️ ATENÇÃO! Esta ação é IRREVERSÍVEL.\n\nTodos os seus dados (produtos, histórico, configurações) serão PERMANENTEMENTE excluídos.\n\nDigite "EXCLUIR TUDO" para confirmar:');
  
  if (confirmacao === 'EXCLUIR TUDO') {
    excluirConta();
  } else if (confirmacao !== null) {
    mostrarToast('❌ Confirmação incorreta. Conta não foi excluída.', 'error');
  }
}

async function excluirConta() {
  try {
    mostrarToast('🗑️ Excluindo conta...', 'info');
    
    const uid = auth.currentUser.uid;
    
    // Excluir todas as coleções do usuário
    const colecoes = ['estoque', 'historico', 'locais', 'marcas'];
    
    for (const colecao of colecoes) {
      const snapshot = await db.collection('usuarios').doc(uid).collection(colecao).get();
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
    
    // Excluir perfil do usuário
    await db.collection('usuarios').doc(uid).delete();
    
    // Excluir conta do Firebase Auth
    await auth.currentUser.delete();
    
    mostrarToast('✅ Conta excluída com sucesso!', 'success');
    
    // Redirecionar para login
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    
  } catch (error) {
    console.error('Erro ao excluir conta:', error);
    
    if (error.code === 'auth/requires-recent-login') {
      mostrarToast('❌ Por segurança, faça login novamente antes de excluir a conta.', 'error');
      fazerLogout();
    } else {
      mostrarToast('❌ Erro ao excluir conta: ' + error.message, 'error');
    }
  }
}

window.mostrarPerfil = mostrarPerfil;
window.salvarPerfilEmpresa = salvarPerfilEmpresa;
window.confirmarExclusaoConta = confirmarExclusaoConta;

// ==================== DASHBOARD ADMIN ====================
function mostrarDashboardAdmin() {
  // Verificação de segurança rigorosa
  if (!empresaAtual?.isAdmin || empresaAtual.isAdmin !== true) {
    console.warn('🚫 Tentativa de acesso ao dashboard admin sem permissão!');
    mostrarToast('❌ Acesso negado! Apenas administradores.', 'error');
    abrir('produtos'); // Redirecionar para tela de produtos
    return;
  }
  
  // Log de acesso admin (auditoria)
  console.log('🛡️ Acesso ao dashboard admin:', empresaAtual.nomeEmpresa);
  
  // Esconder todas as telas
  document.querySelectorAll('.tela').forEach(t => {
    if (t.id !== 'login') {
      t.style.display = 'none';
    }
  });
  
  // Buscar ou criar seção admin
  let secaoAdmin = document.getElementById('secaoAdmin');
  if (!secaoAdmin) {
    secaoAdmin = document.createElement('section');
    secaoAdmin.id = 'secaoAdmin';
    secaoAdmin.className = 'tela';
    secaoAdmin.style.display = 'none';
    const contentWrapper = document.querySelector('.content-wrapper');
    if (contentWrapper) contentWrapper.appendChild(secaoAdmin);
  }
  
  // Mostrar seção admin
  secaoAdmin.style.display = 'block';
  
  // Atualizar título
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) pageTitle.textContent = 'Dashboard Admin';
  
  // Carregar dashboard
  carregarDashboardAdmin();
}

async function carregarDashboardAdmin() {
  // Dupla verificação de segurança
  if (!empresaAtual?.isAdmin || empresaAtual.isAdmin !== true) {
    console.error('🚫 Tentativa de carregar dashboard sem permissão!');
    mostrarToast('❌ Acesso negado!', 'error');
    abrir('produtos');
    return;
  }
  
  const secaoAdmin = document.getElementById('secaoAdmin');
  
  secaoAdmin.innerHTML = `
    <div class="header-secao">
      <h2>🛡️ Dashboard Administrativo</h2>
      <div style="font-size: 12px; color: #666; margin-top: 8px;">
        <i class="fas fa-shield-alt"></i> Modo Administrador - Acesso Restrito
      </div>
    </div>
    
    <div id="adminLoading" style="text-align: center; padding: 40px;">
      <div class="spinner"></div>
      <p>Carregando dados de todos os clientes...</p>
    </div>
    
    <div id="adminContent" style="display: none;"></div>
  `;
  
  try {
    // Carregar todos os usuários (apenas admin tem permissão)
    const snapshot = await db.collection('usuarios').get();
    const usuarios = [];
    
    for (const doc of snapshot.docs) {
      const dados = doc.data();
      
      // Contar produtos do usuário
      let totalProdutos = 0;
      try {
        const estoqueSnapshot = await db.collection('usuarios').doc(doc.id).collection('estoque').get();
        totalProdutos = estoqueSnapshot.size;
      } catch (e) {
        console.warn('Erro ao contar produtos:', e);
      }
      
      usuarios.push({
        uid: doc.id,
        nomeEmpresa: dados.nomeEmpresa || 'Sem nome',
        email: dados.email || 'Sem email',
        plano: dados.plano || 'gratuito',
        isAdmin: dados.isAdmin || false,
        dataCriacao: dados.dataCriacao?.toDate() || new Date(),
        totalProdutos: totalProdutos,
        ultimoAcesso: dados.ultimoAcesso?.toDate() || null,
        status: dados.status || 'ativo'
      });
    }
    
    // Ordenar por data de criação (mais recentes primeiro)
    usuarios.sort((a, b) => b.dataCriacao - a.dataCriacao);
    
    renderizarDashboardAdmin(usuarios);
    
  } catch (error) {
    console.error('Erro ao carregar dashboard admin:', error);
    secaoAdmin.innerHTML = `
      <div class="header-secao">
        <h2>🛡️ Dashboard Administrativo</h2>
      </div>
      <div style="text-align: center; padding: 40px; color: #f44336;">
        <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px;"></i>
        <p>❌ Erro ao carregar dados do dashboard</p>
      </div>
    `;
  }
}

function renderizarDashboardAdmin(usuarios) {
  const secaoAdmin = document.getElementById('secaoAdmin');
  
  // Calcular métricas
  const totalUsuarios = usuarios.length;
  const usuariosGratuito = usuarios.filter(u => u.plano === 'gratuito').length;
  const usuariosBasico = usuarios.filter(u => u.plano === 'basico').length;
  const usuariosProfissional = usuarios.filter(u => u.plano === 'profissional').length;
  const receitaMensal = (usuariosBasico * 29.90) + (usuariosProfissional * 79.90);
  const totalProdutos = usuarios.reduce((sum, u) => sum + u.totalProdutos, 0);
  
  document.getElementById('adminLoading').style.display = 'none';
  document.getElementById('adminContent').style.display = 'block';
  
  document.getElementById('adminContent').innerHTML = `
    <!-- Métricas Gerais -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
      <div class="card" style="padding: 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
        <div style="font-size: 36px; font-weight: 700; margin-bottom: 8px;">${totalUsuarios}</div>
        <div style="font-size: 14px; opacity: 0.9;">Total de Clientes</div>
      </div>
      
      <div class="card" style="padding: 20px; text-align: center; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white;">
        <div style="font-size: 36px; font-weight: 700; margin-bottom: 8px;">R$ ${receitaMensal.toFixed(2)}</div>
        <div style="font-size: 14px; opacity: 0.9;">Receita Mensal</div>
      </div>
      
      <div class="card" style="padding: 20px; text-align: center; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white;">
        <div style="font-size: 36px; font-weight: 700; margin-bottom: 8px;">${totalProdutos.toLocaleString()}</div>
        <div style="font-size: 14px; opacity: 0.9;">Produtos Cadastrados</div>
      </div>
      
      <div class="card" style="padding: 20px; text-align: center; background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); color: white;">
        <div style="font-size: 36px; font-weight: 700; margin-bottom: 8px;">${usuariosBasico + usuariosProfissional}</div>
        <div style="font-size: 14px; opacity: 0.9;">Clientes Pagantes</div>
      </div>
    </div>
    
    <!-- Distribuição de Planos -->
    <div class="card" style="padding: 24px; margin-bottom: 30px;">
      <h3 style="margin-bottom: 20px;">📊 Distribuição de Planos</h3>
      <div style="display: flex; gap: 20px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 200px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 50px; height: 50px; background: #9e9e9e; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">🆓</div>
            <div>
              <div style="font-size: 24px; font-weight: 600;">${usuariosGratuito}</div>
              <div style="color: #666; font-size: 14px;">Gratuito</div>
            </div>
          </div>
        </div>
        
        <div style="flex: 1; min-width: 200px; padding: 16px; background: #E3F2FD; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 50px; height: 50px; background: #2196F3; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">💼</div>
            <div>
              <div style="font-size: 24px; font-weight: 600;">${usuariosBasico}</div>
              <div style="color: #1565C0; font-size: 14px;">Básico (R$ 29,90)</div>
            </div>
          </div>
        </div>
        
        <div style="flex: 1; min-width: 200px; padding: 16px; background: #E8F5E9; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 50px; height: 50px; background: #4CAF50; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">🏢</div>
            <div>
              <div style="font-size: 24px; font-weight: 600;">${usuariosProfissional}</div>
              <div style="color: #2E7D32; font-size: 14px;">Profissional (R$ 79,90)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Filtros -->
    <div class="card" style="padding: 20px; margin-bottom: 20px;">
      <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
        <input type="text" id="filtroNome" placeholder="🔍 Buscar por nome ou email..." 
               style="flex: 1; min-width: 250px; padding: 10px; border: 1px solid #ddd; border-radius: 6px;"
               onkeyup="filtrarUsuariosAdmin()">
        
        <select id="filtroPlano" onchange="filtrarUsuariosAdmin()"
                style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">
          <option value="">Todos os planos</option>
          <option value="gratuito">🆓 Gratuito</option>
          <option value="basico">💼 Básico</option>
          <option value="profissional">🏢 Profissional</option>
        </select>
        
        <button onclick="carregarDashboardAdmin()" class="btn-secondary" style="padding: 10px 20px;">
          <i class="fas fa-sync-alt"></i> Atualizar
        </button>
      </div>
    </div>
    
    <!-- Lista de Usuários -->
    <div class="card" style="padding: 0; overflow: hidden;">
      <div style="padding: 20px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
        <h3 style="margin: 0;">👥 Clientes (${totalUsuarios})</h3>
      </div>
      
      <div style="overflow-x: auto;">
        <table id="tabelaUsuariosAdmin" style="width: 100%; border-collapse: collapse;">
          <thead style="background: #f9fafb;">
            <tr>
              <th style="padding: 12px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Empresa</th>
              <th style="padding: 12px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Email</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Plano</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Produtos</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Data Cadastro</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Ações</th>
            </tr>
          </thead>
          <tbody id="corpoTabelaUsuarios">
            ${usuarios.map(u => `
              <tr class="linha-usuario" data-nome="${u.nomeEmpresa.toLowerCase()}" data-email="${u.email.toLowerCase()}" data-plano="${u.plano}" style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 16px;">
                  <div style="font-weight: 600;">${u.nomeEmpresa}</div>
                  ${u.isAdmin ? '<span style="font-size: 11px; background: #fbbf24; color: #78350f; padding: 2px 6px; border-radius: 4px; font-weight: 600;">ADMIN</span>' : ''}
                </td>
                <td style="padding: 16px; color: #6b7280;">${u.email}</td>
                <td style="padding: 16px; text-align: center;">
                  ${u.plano === 'gratuito' ? '<span style="background: #e0e0e0; color: #424242; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">🆓 Gratuito</span>' : ''}
                  ${u.plano === 'basico' ? '<span style="background: #E3F2FD; color: #1565C0; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">💼 Básico</span>' : ''}
                  ${u.plano === 'profissional' ? '<span style="background: #E8F5E9; color: #2E7D32; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">🏢 Profissional</span>' : ''}
                </td>
                <td style="padding: 16px; text-align: center; font-weight: 600;">${u.totalProdutos}</td>
                <td style="padding: 16px; text-align: center; color: #6b7280; font-size: 13px;">${u.dataCriacao.toLocaleDateString('pt-BR')}</td>
                <td style="padding: 16px; text-align: center;">
                  <button onclick="gerenciarCliente('${u.uid}')" class="btn-primary" style="padding: 6px 12px; font-size: 13px;">
                    <i class="fas fa-cog"></i> Gerenciar
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function filtrarUsuariosAdmin() {
  const filtroNome = document.getElementById('filtroNome').value.toLowerCase();
  const filtroPlano = document.getElementById('filtroPlano').value;
  
  const linhas = document.querySelectorAll('.linha-usuario');
  
  linhas.forEach(linha => {
    const nome = linha.getAttribute('data-nome');
    const email = linha.getAttribute('data-email');
    const plano = linha.getAttribute('data-plano');
    
    const matchNome = !filtroNome || nome.includes(filtroNome) || email.includes(filtroNome);
    const matchPlano = !filtroPlano || plano === filtroPlano;
    
    if (matchNome && matchPlano) {
      linha.style.display = '';
    } else {
      linha.style.display = 'none';
    }
  });
}

async function gerenciarCliente(uid) {
  // Verificação de segurança
  if (!empresaAtual?.isAdmin || empresaAtual.isAdmin !== true) {
    mostrarToast('❌ Acesso negado!', 'error');
    return;
  }
  
  // Impedir que admin gerencie a si mesmo
  if (uid === usuarioAtual?.uid) {
    mostrarToast('⚠️ Você não pode gerenciar sua própria conta!', 'warning');
    return;
  }
  
  try {
    // Buscar dados atualizados do cliente
    const clienteDoc = await db.collection('usuarios').doc(uid).get();
    if (!clienteDoc.exists) {
      mostrarToast('❌ Cliente não encontrado!', 'error');
      return;
    }
    
    const cliente = clienteDoc.data();
    const nomeEmpresa = cliente.nomeEmpresa || 'Sem nome';
    const email = cliente.email || 'Sem email';
    const planoAtual = cliente.plano || 'gratuito';
    
    // Impedir gerenciar outros admins
    if (cliente.isAdmin) {
      mostrarToast('⚠️ Você não pode gerenciar outro administrador!', 'warning');
      return;
    }
    
    // Contar produtos
    let totalProdutos = 0;
    try {
      const estoqueSnapshot = await db.collection('usuarios').doc(uid).collection('estoque').get();
      totalProdutos = estoqueSnapshot.size;
    } catch (e) {
      console.warn('Aviso: Não foi possível contar produtos (privacidade)');
    }
    
    // Modal melhorado
    const modal = document.createElement('div');
    modal.id = 'modalGerenciarCliente';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 32px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <h2 style="margin: 0 0 24px 0; color: #1976d2;">
          <i class="fas fa-user-cog"></i> Gerenciar Cliente
        </h2>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <div style="margin-bottom: 12px;">
            <strong>Empresa:</strong> ${nomeEmpresa}
          </div>
          <div style="margin-bottom: 12px;">
            <strong>Email:</strong> ${email}
          </div>
          <div style="margin-bottom: 12px;">
            <strong>Produtos:</strong> ${totalProdutos || 'Privado'}
          </div>
          <div>
            <strong>Plano Atual:</strong> 
            <span style="background: ${planoAtual === 'profissional' ? '#4CAF50' : planoAtual === 'basico' ? '#2196F3' : '#9E9E9E'}; color: white; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600;">
              ${planoAtual.toUpperCase()}
            </span>
          </div>
        </div>
        
        <div style="margin-bottom: 24px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
            <i class="fas fa-crown"></i> Novo Plano:
          </label>
          <select id="selectNovoPlano" style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 15px; cursor: pointer;">
            <option value="gratuito" ${planoAtual === 'gratuito' ? 'selected' : ''}>🆓 Gratuito (50 produtos)</option>
            <option value="basico" ${planoAtual === 'basico' ? 'selected' : ''}>💼 Básico (500 produtos - R$ 29,90/mês)</option>
            <option value="profissional" ${planoAtual === 'profissional' ? 'selected' : ''}>🏢 Profissional (Ilimitado - R$ 79,90/mês)</option>
          </select>
        </div>
        
        <div style="margin-bottom: 24px;">
          <label style="display: flex; align-items: center; cursor: pointer; user-select: none;">
            <input type="checkbox" id="checkSuspenderConta" style="width: 18px; height: 18px; margin-right: 8px; cursor: pointer;">
            <span style="color: #d32f2f; font-weight: 600;">⚠️ Suspender conta do cliente</span>
          </label>
          <p style="margin: 8px 0 0 26px; font-size: 13px; color: #666;">Cliente não poderá fazer login enquanto suspenso</p>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button onclick="fecharModalGerenciar()" class="btn-secondary" style="padding: 12px 24px;">
            <i class="fas fa-times"></i> Cancelar
          </button>
          <button onclick="salvarAlteracoesCliente('${uid}', '${planoAtual}')" class="btn-primary" style="padding: 12px 24px;">
            <i class="fas fa-check"></i> Salvar Alterações
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        fecharModalGerenciar();
      }
    });
    
  } catch (error) {
    console.error('Erro ao gerenciar cliente:', error);
    mostrarToast('❌ Erro ao gerenciar cliente', 'error');
  }
}

window.fecharModalGerenciar = function() {
  const modal = document.getElementById('modalGerenciarCliente');
  if (modal) modal.remove();
}

window.salvarAlteracoesCliente = async function(uid, planoAntigo) {
  // Verificação de segurança
  if (!empresaAtual?.isAdmin || empresaAtual.isAdmin !== true) {
    mostrarToast('❌ Acesso negado!', 'error');
    fecharModalGerenciar();
    return;
  }
  
  try {
    const novoPlano = document.getElementById('selectNovoPlano').value;
    const suspender = document.getElementById('checkSuspenderConta').checked;
    
    const updates = {
      plano: novoPlano,
      status: suspender ? 'suspenso' : 'ativo',
      ultimaAlteracaoAdmin: firebase.firestore.FieldValue.serverTimestamp(),
      alteradoPor: empresaAtual.nomeEmpresa || usuarioAtual.email
    };
    
    // Atualizar no Firestore
    await db.collection('usuarios').doc(uid).update(updates);
    
    // Log de auditoria
    console.log('🔐 AUDITORIA: Admin alterou cliente', {
      clienteUid: uid,
      planoAntigo,
      planoNovo: novoPlano,
      suspenso: suspender,
      adminUid: usuarioAtual.uid,
      adminEmail: usuarioAtual.email,
      timestamp: new Date()
    });
    
    let mensagem = `✅ Cliente atualizado com sucesso!`;
    if (planoAntigo !== novoPlano) {
      mensagem += `\n📊 Plano: ${planoAntigo.toUpperCase()} → ${novoPlano.toUpperCase()}`;
    }
    if (suspender) {
      mensagem += `\n⚠️ Conta SUSPENSA`;
    }
    
    mostrarToast(mensagem, 'success');
    fecharModalGerenciar();
    
    // Recarregar dashboard
    setTimeout(() => carregarDashboardAdmin(), 500);
    
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    mostrarToast('❌ Erro ao atualizar cliente: ' + error.message, 'error');
  }
}

window.mostrarDashboardAdmin = mostrarDashboardAdmin;
window.filtrarUsuariosAdmin = filtrarUsuariosAdmin;
window.gerenciarCliente = gerenciarCliente;

// Expor funções globalmente
window.adicionarLocal = adicionarLocal;
window.listarLocais = listarLocais;
window.excluirLocal = excluirLocal;
window.adicionarUsuario = adicionarUsuario;
window.listarUsuarios = listarUsuarios;
window.excluirUsuario = excluirUsuario;

// ================ ANALYTICS AVANÇADO ================

let analyticsData = {
  visitasHoje: 0,
  acoesHoje: 0,
  tempoSessao: 0,
  inicioSessao: Date.now(),
  historicoAcoes: []
};

// Rastrear ações do usuário
function registrarAcao(tipo, detalhes = {}) {
  try {
    const acao = {
      tipo,
      detalhes,
      timestamp: Date.now(),
      usuario: auth.currentUser?.email || 'anonimo',
      pagina: document.querySelector('.sidebar-item.active')?.textContent?.trim() || 'Dashboard'
    };
    
    analyticsData.acoesHoje++;
    analyticsData.historicoAcoes.push(acao);
    
    // Manter apenas últimas 100 ações
    if (analyticsData.historicoAcoes.length > 100) {
      analyticsData.historicoAcoes = analyticsData.historicoAcoes.slice(-100);
    }
    
    // Salvar no localStorage
    localStorage.setItem('analytics-sessao', JSON.stringify(analyticsData));
    
    // Enviar para Firebase (opcional)
    if (auth.currentUser) {
      db.collection('analytics').add(acao).catch(() => {});
    }
  } catch (e) {}
}
window.registrarAcao = registrarAcao;

// Dashboard de Analytics
function mostrarAnalytics() {
  try {
    const tempoSessao = Math.floor((Date.now() - analyticsData.inicioSessao) / 60000); // minutos
    
    const ultimasAcoes = analyticsData.historicoAcoes.slice(-10).reverse();
    
    const acoesContadas = {};
    analyticsData.historicoAcoes.forEach(a => {
      acoesContadas[a.tipo] = (acoesContadas[a.tipo] || 0) + 1;
    });
    
    const topAcoes = Object.entries(acoesContadas)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    const html = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;" onclick="if(event.target === this) this.remove()">
        <div style="background: var(--bg-card); border-radius: 16px; width: 100%; max-width: 900px; max-height: 85vh; overflow: hidden; box-shadow: var(--shadow-lg);" onclick="event.stopPropagation()">
          
          <div style="padding: 24px; border-bottom: 1px solid var(--border); background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <h3 style="margin: 0; color: white; font-size: 24px; font-weight: 700;">
              📊 Analytics & Métricas
            </h3>
            <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
              Acompanhe o uso do sistema em tempo real
            </p>
          </div>
          
          <div style="padding: 24px; overflow-y: auto; max-height: calc(85vh - 180px);">
            
            <!-- Cards de Métricas -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
              
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px; color: white;">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">⏱️ Tempo de Sessão</div>
                <div style="font-size: 32px; font-weight: 700;">${tempoSessao}</div>
                <div style="font-size: 12px; opacity: 0.8;">minutos</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px; padding: 20px; color: white;">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">⚡ Ações Hoje</div>
                <div style="font-size: 32px; font-weight: 700;">${analyticsData.acoesHoje}</div>
                <div style="font-size: 12px; opacity: 0.8;">interações</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); border-radius: 12px; padding: 20px; color: white;">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">📈 Produtividade</div>
                <div style="font-size: 32px; font-weight: 700;">${tempoSessao > 0 ? Math.round(analyticsData.acoesHoje / (tempoSessao / 60)) : 0}</div>
                <div style="font-size: 12px; opacity: 0.8;">ações/hora</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); border-radius: 12px; padding: 20px; color: white;">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">💾 Produtos</div>
                <div style="font-size: 32px; font-weight: 700;">${produtos.size}</div>
                <div style="font-size: 12px; opacity: 0.8;">cadastrados</div>
              </div>
              
            </div>
            
            <!-- Top Ações -->
            <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
              <h4 style="margin: 0 0 16px 0; color: var(--text-primary); font-size: 16px; font-weight: 600;">
                🏆 Ações Mais Frequentes
              </h4>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${topAcoes.length === 0 ? `
                  <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 12px;">📊</div>
                    <p>Nenhuma ação registrada ainda</p>
                  </div>
                ` : topAcoes.map(([tipo, count], idx) => {
                  const porcentagem = Math.round((count / analyticsData.acoesHoje) * 100);
                  const cores = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#feca57'];
                  return `
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <div style="min-width: 32px; height: 32px; background: ${cores[idx]}; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 14px;">
                        ${idx + 1}
                      </div>
                      <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                          <strong style="color: var(--text-primary); font-size: 14px;">${tipo}</strong>
                          <span style="color: var(--text-secondary); font-size: 13px;">${count}x (${porcentagem}%)</span>
                        </div>
                        <div style="height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
                          <div style="height: 100%; background: ${cores[idx]}; width: ${porcentagem}%; transition: width 0.3s;"></div>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
            
            <!-- Histórico Recente -->
            <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px;">
              <h4 style="margin: 0 0 16px 0; color: var(--text-primary); font-size: 16px; font-weight: 600;">
                🕐 Últimas Atividades
              </h4>
              <div style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto;">
                ${ultimasAcoes.length === 0 ? `
                  <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                    <p>Nenhuma atividade recente</p>
                  </div>
                ` : ultimasAcoes.map(acao => {
                  const tempo = new Date(acao.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const icones = {
                    'adicionar': '➕',
                    'editar': '✏️',
                    'excluir': '🗑️',
                    'exportar': '📤',
                    'importar': '📥',
                    'buscar': '🔍',
                    'filtrar': '🔽',
                    'visualizar': '👁️',
                    'backup': '💾'
                  };
                  const icone = icones[acao.tipo] || '📌';
                  
                  return `
                    <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border);">
                      <div style="font-size: 20px;">${icone}</div>
                      <div style="flex: 1;">
                        <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${acao.tipo}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">${acao.pagina}</div>
                      </div>
                      <div style="font-size: 11px; color: var(--text-secondary); white-space: nowrap;">${tempo}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
            
          </div>
          
          <div style="padding: 16px 24px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary);">
            <button onclick="window.exportarAnalytics()" class="btn btn-secondary btn-sm">
              📥 Exportar Dados
            </button>
            <button onclick="this.closest('div[style*=\\'position: fixed\\']').remove()" class="btn btn-primary">
              Fechar
            </button>
          </div>
          
        </div>
      </div>
    `;
    
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container.firstElementChild);
    
  } catch (e) {
    console.error('Erro ao mostrar analytics:', e);
    mostrarToast('⚠️ Erro ao abrir analytics', 'error');
  }
}
window.mostrarAnalytics = mostrarAnalytics;

function exportarAnalytics() {
  try {
    const dados = {
      periodo: 'Sessão Atual',
      dataExportacao: new Date().toLocaleString('pt-BR'),
      metricas: {
        tempoSessao: Math.floor((Date.now() - analyticsData.inicioSessao) / 60000),
        acoesRealizadas: analyticsData.acoesHoje,
        produtividade: analyticsData.acoesHoje / ((Date.now() - analyticsData.inicioSessao) / 3600000)
      },
      historicoCompleto: analyticsData.historicoAcoes
    };
    
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Analytics_FEFO_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    mostrarToast('📊 Analytics exportado!', 'success');
    registrarAcao('exportar', { tipo: 'analytics' });
  } catch (e) {
    mostrarToast('⚠️ Erro ao exportar', 'error');
  }
}
window.exportarAnalytics = exportarAnalytics;

// Carregar analytics do localStorage
try {
  const saved = localStorage.getItem('analytics-sessao');
  if (saved) {
    const data = JSON.parse(saved);
    const hoje = new Date().toDateString();
    const ultimaSessao = new Date(data.inicioSessao).toDateString();
    
    if (hoje === ultimaSessao) {
      analyticsData = { ...analyticsData, ...data, inicioSessao: Date.now() };
    }
  }
} catch (e) {}

// Registrar visita
analyticsData.visitasHoje++;
localStorage.setItem('analytics-sessao', JSON.stringify(analyticsData));