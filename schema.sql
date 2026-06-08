-- ============================================================
--  Meu Orçamento — schema do Supabase
--  Cole tudo isto no SQL Editor do Supabase e clique em "Run".
-- ============================================================

-- O orçamento inteiro de cada usuário é guardado como um documento JSON.
-- (accounts, groups, categories, assigned, transactions — exatamente o
--  formato que o app usa.)
create table if not exists public.budgets (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Liga a segurança por linha: sem as policies abaixo, ninguém acessa nada.
alter table public.budgets enable row level security;

-- Cada pessoa só pode LER o próprio orçamento.
create policy "ler o proprio orcamento" on public.budgets
  for select using (auth.uid() = user_id);

-- ...só pode CRIAR uma linha para si mesma.
create policy "inserir o proprio orcamento" on public.budgets
  for insert with check (auth.uid() = user_id);

-- ...só pode ATUALIZAR a própria linha.
create policy "atualizar o proprio orcamento" on public.budgets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ...só pode APAGAR a própria linha.
create policy "apagar o proprio orcamento" on public.budgets
  for delete using (auth.uid() = user_id);

-- Pronto. Você e sua namorada criam contas separadas no app e cada um
-- enxerga apenas o seu orçamento — o banco garante isso, não só o app.
