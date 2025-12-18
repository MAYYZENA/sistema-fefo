# 📚 Guia de Administração - Sistema FEFO

## 🚀 Início Rápido para Administradores

### 1. Como criar o primeiro usuário Admin

Para tornar um usuário administrador do sistema:

1. **Acesse o Firebase Console:**
   - Vá para: https://console.firebase.google.com
   - Selecione seu projeto

2. **Navegue até Firestore Database:**
   - Menu lateral → Firestore Database

3. **Localize o usuário:**
   - Coleção: `usuarios`
   - Encontre o documento com o UID do usuário

4. **Adicione o campo admin:**
   ```
   Campo: isAdmin
   Tipo: boolean
   Valor: true
   ```

5. **Faça logout e login novamente** para ativar as permissões de admin

### 2. Acessando o Dashboard Admin

Após marcar seu usuário como admin:

1. Faça login no sistema
2. O menu **"Dashboard Admin"** aparecerá no menu lateral
3. Clique para acessar o painel administrativo

---

## 💼 Recursos do Dashboard Admin

### 📊 Métricas Gerais

O dashboard exibe em tempo real:

- **Total de Clientes:** Quantidade total de empresas cadastradas
- **Receita Mensal:** Cálculo automático baseado nos planos pagos
  - Básico: R$ 29,90/mês
  - Profissional: R$ 79,90/mês
- **Produtos Cadastrados:** Soma de todos os produtos de todos os clientes
- **Clientes Pagantes:** Contagem de planos Básico + Profissional

### 📈 Distribuição de Planos

Cards visuais mostrando:
- 🆓 Clientes no plano Gratuito (até 50 produtos)
- 💼 Clientes no plano Básico (até 500 produtos)
- 🏢 Clientes no plano Profissional (ilimitado)

### 👥 Lista de Clientes

Tabela completa com informações de cada cliente:
- Nome da empresa
- Email de cadastro
- Plano atual (com badge visual)
- Quantidade de produtos cadastrados
- Data de cadastro no sistema
- Badge "ADMIN" para usuários administradores

### 🔍 Filtros Disponíveis

- **Busca por nome ou email:** Campo de busca em tempo real
- **Filtro por plano:** Dropdown para filtrar por Gratuito/Básico/Profissional
- **Botão Atualizar:** Recarrega os dados do Firebase

---

## ⚙️ Gerenciamento de Clientes

### Alterar Plano de um Cliente

1. Na lista de clientes, clique em **"Gerenciar"**
2. Um prompt mostrará:
   - Nome da empresa
   - Email
   - Plano atual
   - Total de produtos
3. Digite o novo plano: `gratuito`, `basico` ou `profissional`
4. Confirme a alteração
5. O dashboard será atualizado automaticamente

### Limites por Plano

- **Gratuito:** 50 produtos máximo
- **Básico:** 500 produtos máximo
- **Profissional:** Produtos ilimitados

O sistema bloqueia automaticamente quando o limite é atingido.

---

## 💰 Modelo de Negócio

### Planos e Preços

| Plano | Preço Mensal | Limite de Produtos | Recursos |
|-------|--------------|-------------------|----------|
| 🆓 **Gratuito** | R$ 0,00 | 50 produtos | Recursos básicos |
| 💼 **Básico** | R$ 29,90 | 500 produtos | Todos os recursos |
| 🏢 **Profissional** | R$ 79,90 | Ilimitado | Todos + Suporte prioritário |

### Estratégia de Conversão

1. **Trial Gratuito:** 
   - Usuários começam no plano gratuito
   - 50 produtos é suficiente para testar o sistema
   
2. **Avisos Proativos:**
   - Alerta em 90% do limite (45/50 produtos)
   - Mensagem de upgrade ao atingir o limite
   
3. **Upgrade Suave:**
   - Botão de upgrade na tela de perfil
   - Comparação clara de benefícios

---

## 🔐 Segurança e Isolamento

### Multi-Tenancy

O sistema implementa isolamento completo de dados:

- Cada cliente tem seus próprios dados em `usuarios/{uid}/`
- Subcoleções isoladas:
  - `estoque`
  - `historico`
  - `locais`
  - `marcas`

### Coleções Compartilhadas

- `catalogo-produtos`: Base de produtos comum (apenas leitura)
- `usuarios`: Perfis e informações de planos

### Permissões de Admin

Administradores podem:
- ✅ Ver todos os clientes
- ✅ Alterar planos
- ✅ Ver métricas gerais
- ❌ **NÃO** podem acessar dados de estoque dos clientes (privacidade)

---

## 📈 Métricas de Sucesso

### KPIs Importantes

1. **Taxa de Conversão:**
   - % de usuários que passam de Gratuito → Básico
   - Meta: 10-15%

2. **Churn Rate:**
   - % de cancelamentos mensais
   - Meta: < 5%

3. **MRR (Monthly Recurring Revenue):**
   - Receita recorrente mensal
   - Calculada automaticamente no dashboard

4. **Produtos por Cliente:**
   - Média de produtos cadastrados
   - Indicador de engajamento

---

## 🛠️ Manutenção

### Backup de Dados

Clientes podem fazer backup individual:
- Menu → Configurações → Fazer Backup
- Exporta dados em JSON

### Suporte aos Clientes

Para clientes com plano Profissional:
- Resposta prioritária
- Treinamento personalizado
- Customizações sob demanda

---

## 🚀 Próximos Passos

### Implementações Futuras

1. **Sistema de Pagamento:**
   - Integração com Stripe/Pagar.me
   - Renovação automática
   - Faturas e recibos

2. **Dashboard Financeiro:**
   - Gráficos de receita
   - Previsões de MRR
   - Análise de churn

3. **Sistema de Tickets:**
   - Suporte via chat
   - Base de conhecimento
   - FAQ automatizado

4. **Notificações por Email:**
   - Boas-vindas
   - Lembretes de pagamento
   - Alertas de limite

---

## 📞 Suporte

Para dúvidas sobre administração do sistema:
- Email: suporte@sistema-fefo.com
- Documentação: https://docs.sistema-fefo.com

---

**Última atualização:** Dezembro 2025  
**Versão:** 1.0.0
