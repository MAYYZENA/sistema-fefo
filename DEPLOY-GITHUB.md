# 🚀 Deploy - GitHub Pages (100% GRATUITO!)

## Por que GitHub Pages?

✅ **100% GRATUITO** para sempre  
✅ Hospedagem ilimitada  
✅ HTTPS automático  
✅ Deploy com 1 comando  
✅ Sem limite de acessos  

## 📋 Passo a Passo Completo:

### 1️⃣ Criar conta no GitHub (se não tiver)
Acesse: https://github.com/signup

### 2️⃣ Criar repositório
1. Acesse: https://github.com/new
2. Nome: `sistema-fefo`
3. Visibilidade: **Público** (obrigatório para GitHub Pages gratuito)
4. Clique em **"Create repository"**

### 3️⃣ Fazer deploy

Execute no PowerShell (na pasta do projeto):

```powershell
.\deploy-github.ps1
```

Depois execute os comandos que aparecerem (substitua SEU_USUARIO):

```bash
git remote add origin https://github.com/SEU_USUARIO/sistema-fefo.git
git push -u origin main
```

### 4️⃣ Ativar GitHub Pages

1. No seu repositório do GitHub, vá em **Settings** (Configurações)
2. No menu lateral, clique em **Pages**
3. Em **Source**, selecione:
   - Branch: `main`
   - Folder: `/ (root)`
4. Clique em **Save**

### 5️⃣ Pronto! 🎉

Seu site estará disponível em:
```
https://SEU_USUARIO.github.io/sistema-fefo
```

Aguarde 2-3 minutos para o primeiro deploy.

---

## 🔄 Atualizações Futuras

Para atualizar o site depois de fazer mudanças:

```powershell
git add .
git commit -m "Atualização"
git push
```

Aguarde 1-2 minutos e as mudanças estarão online!

---

## 🆘 Problemas?

**Git não instalado?**
- Baixe em: https://git-scm.com/download/win
- Instale e reinicie o PowerShell

**Erro ao fazer push?**
- O GitHub pode pedir login na primeira vez
- Use seu email e senha do GitHub

**Site não carrega?**
- Aguarde alguns minutos
- Limpe o cache do navegador (Ctrl+F5)

---

## 📱 Atualizando o QR Code

Depois do deploy, edite o arquivo `index.html` na linha do QR Code e coloque sua URL:

```javascript
return "https://SEU_USUARIO.github.io/sistema-fefo";
```

Faça commit e push novamente!
