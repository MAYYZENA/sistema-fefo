# 🔑 Como Obter o Token do Netlify

## Passo a Passo:

### 1. Acesse sua conta Netlify
- Vá para: https://app.netlify.com

### 2. Acesse as configurações do usuário
- Clique no seu **avatar/foto** no canto superior direito
- Selecione **"User settings"**

### 3. Crie um Personal Access Token
- No menu lateral, clique em **"Applications"**
- Role até a seção **"Personal access tokens"**
- Clique em **"New access token"**

### 4. Configure o token
- **Description:** `Deploy Sistema FEFO`
- **Expiration:** Escolha a validade (recomendo "Never" para uso contínuo)
- Clique em **"Generate token"**

### 5. Copie o token
- ⚠️ **IMPORTANTE:** O token só será mostrado UMA VEZ
- Copie e guarde em local seguro
- Exemplo: `nfp_1234567890abcdefghijklmnopqrstuvwxyz`

## 🚀 Como Usar o Token:

Depois de obter o token, execute no PowerShell:

```powershell
cd "c:\Users\casa\Desktop\sistema_fefo"
.\deploy-auto.ps1 -Token "SEU_TOKEN_AQUI"
```

### Exemplo:
```powershell
.\deploy-auto.ps1 -Token "nfp_1234567890abcdefghijklmnopqrstuvwxyz"
```

## ✅ O que acontece depois:

1. Script cria ZIP com todos os arquivos
2. Faz upload via API do Netlify
3. Seu site é atualizado automaticamente
4. URL permanece a mesma: https://remarkable-tanuki-2ab5a5.netlify.app

## 🔒 Segurança:

- **Nunca compartilhe** seu token com ninguém
- **Não comite** o token no Git
- Se comprometer o token, revogue-o no Netlify e crie um novo

## 💡 Dica:

Para evitar digitar o token toda vez, você pode salvá-lo em uma variável de ambiente:

```powershell
$env:NETLIFY_TOKEN = "seu_token_aqui"
.\deploy-auto.ps1 -Token $env:NETLIFY_TOKEN
```

---

**Precisa de ajuda?** 
- Documentação oficial: https://docs.netlify.com/api/get-started/
- Sua conta Netlify: https://app.netlify.com
