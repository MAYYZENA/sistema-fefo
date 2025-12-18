// Sistema de Onboarding - Tour Guiado para Novos Usuários

let tourAtivo = false;
let passoAtual = 0;

const passosTour = [
  {
    elemento: '#secaoMenu',
    titulo: '👋 Bem-vindo ao Sistema FEFO!',
    texto: 'Sistema profissional de gestão de estoque com foco em controle de validade. Vamos fazer um tour rápido pelos principais recursos!',
    posicao: 'center'
  },
  {
    elemento: '.metric-card:first-child',
    titulo: '📊 Dashboard',
    texto: 'Aqui você visualiza as métricas principais do seu estoque: total de produtos, próximos a vencer, vencidos e espaço disponível.',
    posicao: 'bottom'
  },
  {
    elemento: '[onclick*="estoque"]',
    titulo: '📦 Gestão de Estoque',
    texto: 'Adicione, edite e gerencie seus produtos. Use o leitor de código de barras para agilizar o cadastro!',
    posicao: 'right'
  },
  {
    elemento: '[onclick*="curvaABC"]',
    titulo: '📈 Curva ABC FEFO',
    texto: 'Análise inteligente baseada em FEFO (First Expire, First Out). Prioriza produtos por urgência de validade + rotatividade.',
    posicao: 'right'
  },
  {
    elemento: '[onclick*="historico"]',
    titulo: '📜 Histórico',
    texto: 'Acompanhe todas as movimentações: entradas, saídas, ajustes e produtos vencidos.',
    posicao: 'right'
  },
  {
    elemento: '[onclick*="mostrarPerfil"]',
    titulo: '🏢 Perfil da Empresa',
    texto: 'Gerencie os dados da sua empresa, visualize seu plano atual e faça upgrade quando precisar de mais recursos.',
    posicao: 'right'
  },
  {
    elemento: '#planoBadge',
    titulo: '💳 Seu Plano',
    texto: `Você está no plano <strong>Gratuito</strong> com até 50 produtos. Upgrade para Básico (500) ou Profissional (ilimitado) quando precisar!`,
    posicao: 'bottom'
  },
  {
    elemento: '#secaoMenu',
    titulo: '🎉 Pronto para começar!',
    texto: 'Agora você conhece os principais recursos. Comece cadastrando seus produtos e aproveite todas as funcionalidades!',
    posicao: 'center'
  }
];

function iniciarTour() {
  if (tourAtivo) return;
  
  // Verificar se já fez o tour antes
  const tourConcluido = localStorage.getItem('tourConcluido');
  if (tourConcluido) {
    if (!confirm('Deseja refazer o tour guiado pelo sistema?')) {
      return;
    }
  }
  
  tourAtivo = true;
  passoAtual = 0;
  
  // Criar overlay e card do tour
  criarElementosTour();
  mostrarPasso(0);
}

function criarElementosTour() {
  // Remover tour anterior se existir
  const tourExistente = document.getElementById('tourOverlay');
  if (tourExistente) tourExistente.remove();
  
  // Criar overlay
  const overlay = document.createElement('div');
  overlay.id = 'tourOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    z-index: 9998;
    backdrop-filter: blur(2px);
  `;
  
  // Criar card do tour
  const card = document.createElement('div');
  card.id = 'tourCard';
  card.style.cssText = `
    position: fixed;
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    z-index: 9999;
    animation: slideIn 0.3s ease-out;
  `;
  
  // Adicionar estilo de animação
  if (!document.getElementById('tourStyles')) {
    const style = document.createElement('style');
    style.id = 'tourStyles';
    style.textContent = `
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .tour-highlight {
        position: relative;
        z-index: 10000 !important;
        box-shadow: 0 0 0 4px #1a73e8, 0 0 0 8px rgba(26, 115, 232, 0.3) !important;
        border-radius: 8px !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(overlay);
  document.body.appendChild(card);
  
  // Fechar ao clicar no overlay
  overlay.addEventListener('click', pularTour);
}

function mostrarPasso(index) {
  if (index >= passosTour.length) {
    finalizarTour();
    return;
  }
  
  const passo = passosTour[index];
  const card = document.getElementById('tourCard');
  const overlay = document.getElementById('tourOverlay');
  
  if (!card || !overlay) return;
  
  // Remover highlight anterior
  document.querySelectorAll('.tour-highlight').forEach(el => {
    el.classList.remove('tour-highlight');
  });
  
  // Adicionar highlight no elemento atual
  let elemento = null;
  if (passo.elemento !== '#secaoMenu') {
    elemento = document.querySelector(passo.elemento);
    if (elemento) {
      elemento.classList.add('tour-highlight');
    }
  }
  
  // Atualizar conteúdo do card
  card.innerHTML = `
    <div style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
        <h3 style="margin: 0; color: #1a73e8; font-size: 20px;">${passo.titulo}</h3>
        <button onclick="pularTour()" style="background: none; border: none; color: #999; cursor: pointer; font-size: 20px; padding: 0; width: 24px; height: 24px;">&times;</button>
      </div>
      <p style="color: #666; line-height: 1.6; margin: 0;">${passo.texto}</p>
    </div>
    
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div style="color: #999; font-size: 14px;">
        Passo ${index + 1} de ${passosTour.length}
      </div>
      <div style="display: flex; gap: 8px;">
        ${index > 0 ? `<button onclick="mostrarPasso(${index - 1})" class="btn-secondary" style="padding: 8px 16px;">← Anterior</button>` : ''}
        <button onclick="mostrarPasso(${index + 1})" class="btn-primary" style="padding: 8px 20px;">
          ${index === passosTour.length - 1 ? 'Finalizar ✓' : 'Próximo →'}
        </button>
      </div>
    </div>
    
    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
      <button onclick="pularTour()" style="background: none; border: none; color: #999; cursor: pointer; font-size: 13px; text-decoration: underline;">
        Pular tour
      </button>
    </div>
  `;
  
  // Posicionar card
  posicionarCard(card, elemento, passo.posicao);
  
  passoAtual = index;
}

function posicionarCard(card, elemento, posicao) {
  if (!elemento || posicao === 'center') {
    // Centralizar
    card.style.top = '50%';
    card.style.left = '50%';
    card.style.transform = 'translate(-50%, -50%)';
    return;
  }
  
  const rect = elemento.getBoundingClientRect();
  
  switch (posicao) {
    case 'bottom':
      card.style.top = `${rect.bottom + 20}px`;
      card.style.left = `${rect.left + (rect.width / 2)}px`;
      card.style.transform = 'translateX(-50%)';
      break;
      
    case 'right':
      card.style.top = `${rect.top}px`;
      card.style.left = `${rect.right + 20}px`;
      card.style.transform = 'none';
      break;
      
    case 'left':
      card.style.top = `${rect.top}px`;
      card.style.right = `${window.innerWidth - rect.left + 20}px`;
      card.style.left = 'auto';
      card.style.transform = 'none';
      break;
      
    case 'top':
      card.style.bottom = `${window.innerHeight - rect.top + 20}px`;
      card.style.left = `${rect.left + (rect.width / 2)}px`;
      card.style.top = 'auto';
      card.style.transform = 'translateX(-50%)';
      break;
  }
  
  // Garantir que o card não saia da tela
  setTimeout(() => {
    const cardRect = card.getBoundingClientRect();
    if (cardRect.right > window.innerWidth) {
      card.style.left = `${window.innerWidth - cardRect.width - 20}px`;
      card.style.transform = 'none';
    }
    if (cardRect.bottom > window.innerHeight) {
      card.style.top = `${window.innerHeight - cardRect.height - 20}px`;
    }
    if (cardRect.left < 0) {
      card.style.left = '20px';
      card.style.transform = 'none';
    }
    if (cardRect.top < 0) {
      card.style.top = '20px';
    }
  }, 10);
}

function finalizarTour() {
  tourAtivo = false;
  
  // Remover elementos do tour
  const overlay = document.getElementById('tourOverlay');
  const card = document.getElementById('tourCard');
  
  if (overlay) overlay.remove();
  if (card) card.remove();
  
  // Remover highlights
  document.querySelectorAll('.tour-highlight').forEach(el => {
    el.classList.remove('tour-highlight');
  });
  
  // Marcar tour como concluído
  localStorage.setItem('tourConcluido', 'true');
  
  mostrarToast('🎉 Tour concluído! Agora você está pronto para usar o sistema.', 'success');
}

function pularTour() {
  if (confirm('Deseja realmente pular o tour? Você pode refazê-lo depois no menu de configurações.')) {
    finalizarTour();
  }
}

function verificarPrimeiroAcesso() {
  const tourConcluido = localStorage.getItem('tourConcluido');
  
  if (!tourConcluido) {
    // Esperar 2 segundos após o login para iniciar o tour
    setTimeout(() => {
      if (confirm('👋 Primeira vez no sistema?\n\nQuer fazer um tour rápido pelos recursos principais?')) {
        iniciarTour();
      } else {
        localStorage.setItem('tourConcluido', 'true');
      }
    }, 2000);
  }
}

// Expor funções globalmente
window.iniciarTour = iniciarTour;
window.mostrarPasso = mostrarPasso;
window.pularTour = pularTour;
window.verificarPrimeiroAcesso = verificarPrimeiroAcesso;
