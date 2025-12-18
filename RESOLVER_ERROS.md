# 🔧 Como Resolver os Erros

## ✅ Problema 1: FontAwesome 404 - RESOLVIDO

**Solução aplicada:**
- ✅ Deletado `vendor/fontawesome.min.css` local
- ✅ Usando apenas CDN online
- ✅ Sem mais erros 404

**O que fazer agora:**
1. **Limpe o cache do navegador:** `Ctrl + Shift + Delete`
2. Marque "Imagens e arquivos em cache"
3. Clique em "Limpar dados"
4. Recarregue a página: `F5`

---

## ⚠️ Problema 2: Firebase API Key - Recuperação de Senha

**Erro:**
```
auth/api-key-not-valid.-please-pass-a-valid-api-key.
```

**Causa:** 
A API Key está correta, mas o **Email/Password** e **recuperação de senha** precisam estar habilitados no Firebase Console.

### 📋 Passo a Passo para Resolver:

#### 1. Acesse o Firebase Console
https://console.firebase.google.com

#### 2. Selecione seu Projeto
- Clique em: **gestao-fefo**

#### 3. Vá em Authentication
- Menu lateral → **Authentication** (ícone de cadeado/pessoa)
- Clique na aba **Sign-in method**

#### 4. Habilite Email/Password
- Procure **"Email/Password"** na lista
- Se estiver desabilitado (cinza), clique nele
- Clique em **Enable** (Ativar)
- **Marque as duas opções:**
  - ✅ Email/Password
  - ✅ Email link (passwordless sign-in)
- Clique em **Save** (Salvar)

#### 5. Configure Templates de Email
- Na mesma tela de Authentication
- Clique na aba **Templates**
- Procure **"Password reset"** (Redefinição de senha)
- Clique no ícone de editar (lápis)
- Personalize o email (opcional):
  ```
  Título: Redefinir sua senha - Sistema FEFO
  
  Mensagem:
  Olá %DISPLAY_NAME%,
  
  Recebemos uma solicitação para redefinir a senha da sua conta.
  
  Para criar uma nova senha, clique no link abaixo:
  %LINK%
  
  Se você não solicitou isso, ignore este email.
  
  Equipe Sistema FEFO
  ```
- Clique em **Save**

#### 6. Configurar Domínios Autorizados
- Ainda em Authentication → **Settings**
- Vá em **Authorized domains**
- Certifique-se que está na lista:
  - ✅ `localhost` (para testes locais)
  - Adicione seu domínio quando fizer deploy

#### 7. Teste a Recuperação
1. Vá em: http://localhost/recuperar-senha.html (ou seu domínio local)
2. Digite um email cadastrado
3. Clique em "Enviar"
4. Verifique sua caixa de entrada (e spam!)

---

## 🎯 Checklist Final

- [ ] Limpei cache do navegador (Ctrl+Shift+Delete)
- [ ] Email/Password está habilitado no Firebase
- [ ] Template de email configurado
- [ ] localhost está nos domínios autorizados
- [ ] Testei recuperação com email real

---

## 🔍 Outros Erros Possíveis

### "auth/email-not-found"
**Normal!** Por segurança, não revelamos se o email existe.
A mensagem ao usuário será genérica: "Se este email estiver cadastrado..."

### "auth/too-many-requests"
**Bloqueio temporário** após muitas tentativas.
Aguarde alguns minutos.

### Email não chega
1. Verifique **spam/lixeira**
2. Aguarde até 5 minutos
3. Confira se o email está correto
4. Teste com Gmail primeiro (mais confiável)

---

## 📧 Para Deploy em Produção

Quando publicar o site:

1. **Adicione seu domínio no Firebase:**
   - Authentication → Settings → Authorized domains
   - Exemplo: `meusite.com.br`

2. **Configure Email Sender:**
   - Por padrão usa: `noreply@[SEU-PROJETO].firebaseapp.com`
   - Para personalizar, precisa do plano Blaze (pago)

3. **Atualize URLs de redirecionamento:**
   - No arquivo `recuperar-senha.html`, linha 230
   - Mude `window.location.origin` para seu domínio real

---

**✅ Depois de seguir os passos, o erro deve sumir!**
