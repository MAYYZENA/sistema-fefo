# 🔐 Guia de Segurança - Firestore Rules

## ⚠️ IMPORTANTE: Deploy das Regras de Segurança

Para proteger seu sistema, você PRECISA fazer deploy das regras de segurança no Firebase.

## 📋 Passo a Passo

### Opção 1: Firebase Console (Mais Fácil)

1. **Acesse o Firebase Console:**
   - Vá em: https://console.firebase.google.com
   - Selecione seu projeto

2. **Abra o Firestore Database:**
   - Menu lateral → "Firestore Database"
   - Clique na aba "Regras" (Rules)

3. **Cole as Regras:**
   - Abra o arquivo `firestore.rules` deste projeto
   - Copie TODO o conteúdo
   - Cole no editor do Firebase Console

4. **Publique:**
   - Clique em "Publicar" (Publish)
   - Aguarde a confirmação

### Opção 2: Firebase CLI (Avançado)

```powershell
# Instalar Firebase CLI (apenas uma vez)
npm install -g firebase-tools

# Login no Firebase
firebase login

# Inicializar projeto (na pasta do sistema)
firebase init firestore

# Deploy das regras
firebase deploy --only firestore:rules
```

## 🛡️ O Que as Regras Protegem

### ✅ Proteções Implementadas

1. **Isolamento de Dados:**
   - Cada usuário só acessa seus próprios dados
   - Admin pode ver lista de usuários, mas não o estoque deles

2. **Dashboard Admin:**
   - Apenas usuários com `isAdmin: true` podem:
     - Ver lista completa de clientes
     - Alterar planos
     - Suspender contas

3. **Proteção de Campos Críticos:**
   - Usuários normais NÃO podem:
     - Alterar seu próprio campo `isAdmin`
     - Alterar seu próprio campo `plano`
   - Apenas admin pode alterar esses campos

4. **Privacidade:**
   - Admin não consegue acessar:
     - Estoque de outros usuários
     - Movimentações de outros usuários
     - Relatórios de outros usuários

### ❌ O Que NÃO Pode Acontecer (com as regras ativas)

- ❌ Usuário comum ver dados de outros usuários
- ❌ Usuário comum virar admin sozinho
- ❌ Usuário comum mudar seu próprio plano
- ❌ Usuário comum acessar dashboard admin
- ❌ Admin acessar estoque privado de clientes

## 🔍 Como Verificar se Está Funcionando

### Teste 1: Proteção do Dashboard

1. Crie uma conta de teste (sem isAdmin)
2. Tente acessar o Dashboard Admin
3. Deve aparecer: ❌ "Acesso negado!"

### Teste 2: Proteção de Planos

1. Abra o Console do navegador (F12)
2. Execute:
```javascript
db.collection('usuarios').doc(auth.currentUser.uid).update({
  plano: 'profissional',
  isAdmin: true
})
```
3. Deve retornar ERRO de permissão

### Teste 3: Isolamento de Dados

1. Faça login como Usuário A
2. Tente acessar dados do Usuário B:
```javascript
db.collection('usuarios').doc('UID_DO_USUARIO_B').get()
```
3. Deve retornar ERRO de permissão

## 📊 Logs de Auditoria

O sistema gera logs de auditoria no console quando:

- ✅ Admin acessa dashboard
- ✅ Admin altera plano de cliente
- ✅ Admin suspende conta
- ❌ Alguém tenta acessar sem permissão

**Exemplo de log:**
```
🔐 AUDITORIA: Admin alterou cliente
{
  clienteUid: "abc123",
  planoAntigo: "gratuito",
  planoNovo: "profissional",
  suspenso: false,
  adminUid: "xyz789",
  adminEmail: "admin@exemplo.com",
  timestamp: Date
}
```

## 🚨 Segurança Adicional Implementada

### No Código (app.js)

1. **Dupla verificação:**
```javascript
if (!empresaAtual?.isAdmin || empresaAtual.isAdmin !== true) {
  // Bloqueia acesso
}
```

2. **Proteção contra auto-gerenciamento:**
```javascript
if (uid === usuarioAtual?.uid) {
  // Admin não pode alterar sua própria conta
}
```

3. **Proteção contra gerenciar outros admins:**
```javascript
if (cliente.isAdmin) {
  // Admin não pode gerenciar outro admin
}
```

4. **Verificação de conta suspensa no login:**
```javascript
if (empresaAtual.status === 'suspenso') {
  await auth.signOut();
  // Bloqueia login
}
```

## 🎯 Resumo de Segurança

| Ação | Usuário Normal | Admin |
|------|----------------|-------|
| Ver próprios dados | ✅ Sim | ✅ Sim |
| Ver dados de outros | ❌ Não | ⚠️ Lista apenas (sem estoque) |
| Alterar próprio plano | ❌ Não | ✅ Sim |
| Virar admin sozinho | ❌ Não | - |
| Alterar plano de outros | ❌ Não | ✅ Sim |
| Suspender contas | ❌ Não | ✅ Sim |
| Ver dashboard admin | ❌ Não | ✅ Sim |
| Ver estoque de outros | ❌ Não | ❌ Não |

## 📞 Suporte

Se encontrar problemas de segurança:

1. Verifique se as regras estão publicadas
2. Faça logout e login novamente
3. Limpe o cache do navegador
4. Verifique o console por erros de permissão

---

**⚠️ ATENÇÃO:** Sem fazer deploy das regras, QUALQUER usuário poderá acessar TODOS os dados!
