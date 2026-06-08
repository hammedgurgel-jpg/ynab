import { supabase } from "./supabaseClient";

// Lê o orçamento do usuário logado. Retorna o objeto de dados ou null se ainda não existe.
export async function loadBudget() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("budgets")
    .select("data")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.data ?? null;
}

// Salva (cria ou atualiza) o orçamento inteiro do usuário logado.
export async function saveBudget(budget) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("budgets")
    .upsert({ user_id: user.id, data: budget, updated_at: new Date().toISOString() });
  if (error) throw error;
}
