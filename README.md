# Meu Orçamento

App de orçamento pelo método de **envelopes / base-zero** (estilo YNAB), em React + Vite,
com login e dados na nuvem via Supabase. Funciona como **PWA**: instala na tela inicial do
celular e abre como um app.

Cada pessoa que criar uma conta tem o **próprio orçamento, privado** — a segurança é
garantida pelo banco (Row Level Security), não só pelo app.

---

## O que eu (Hammed) preciso fazer — passo a passo

> As etapas que envolvem suas credenciais são suas: criar a conta no Supabase, rodar o SQL,
> colar as chaves e publicar. Nada disso é feito por terceiros.

### 1. Pré-requisito
Instale o **Node.js 18 ou superior** (https://nodejs.org).

### 2. Criar o projeto no Supabase
1. Acesse https://supabase.com e crie um projeto (plano gratuito serve).
2. Vá em **Project Settings → API** e copie dois valores:
   - **Project URL**
   - **anon public key** (a chave pública; *não* use a `service_role`).

### 3. Criar a tabela e a segurança
No Supabase, abra **SQL Editor**, cole todo o conteúdo de **`schema.sql`** e clique em **Run**.
Isso cria a tabela `budgets` e as regras de privacidade por usuário.

### 4. Ligar o login por e-mail
Em **Authentication → Providers**, confirme que **Email** está habilitado.
Para facilitar o primeiro acesso, em **Authentication → Sign In / Providers** você pode
desativar **"Confirm email"** (para um app só seu e da sua namorada, é tranquilo).

### 5. Rodar localmente
No terminal, dentro da pasta do projeto:

```bash
cp .env.example .env      # depois edite o .env com seus valores do passo 2
npm install
npm run dev
```

Abra o endereço que aparecer (algo como http://localhost:5173). Crie sua conta e teste.

### 6. Publicar (deixar no ar)
Gere a versão final:

```bash
npm run build
```

Isso cria a pasta **`dist`**. Para publicar, o caminho mais fácil:
- **Netlify Drop** (https://app.netlify.com/drop): arraste a pasta `dist`. *(Como o build
  já embute as variáveis, defina o `.env` antes do `npm run build`.)*
- Ou conecte o repositório no **Vercel/Netlify** e configure as variáveis
  `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no painel do serviço.

> Importante: o Supabase só aceita logins vindos de endereços autorizados. Em
> **Authentication → URL Configuration**, adicione a URL do site publicado em
> *Site URL* / *Redirect URLs*.

### 7. Instalar no celular
Abra a URL publicada no navegador do celular → menu → **"Adicionar à tela inicial"**.
Pronto: vira um ícone e abre em tela cheia, como um app.

---

## Como você e sua namorada usam juntos
Cada um cria a **própria conta** (e-mail + senha) dentro do app. Os orçamentos são
totalmente separados e privados — ninguém vê os dados do outro.

## Sobre a guarda dos dados
O orçamento inteiro de cada usuário é salvo como um **documento JSON** na tabela `budgets`
(uma linha por pessoa). É simples, rápido e privado. Se um dia você quiser relatórios
pesados feitos no próprio banco (SQL), dá para normalizar em tabelas depois — sem perder nada.

## O que ainda dá para evoluir
Metas por categoria, relatórios/gráficos históricos, e o tratamento mais fino de estouro no
cartão (separar gasto coberto de não coberto). Nada disso muda o formato dos dados — são
adições.
