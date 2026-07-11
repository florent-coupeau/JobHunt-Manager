-- ============================================================
-- Suivi Alternance v3.5 — étiquettes personnalisées
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 001_schema.sql)
-- ============================================================

-- ---------- Étiquettes (tri personnel : « Urgent », « À étudier »…) ----------
create table public.etiquettes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nom text not null,
  couleur text not null default '#7c6ff0',
  ordre int not null default 0
);
create unique index etiquettes_nom_unique on public.etiquettes (user_id, lower(nom));

-- Chaque offre peut porter UNE étiquette. Supprimer une étiquette
-- ne supprime pas les offres : elles redeviennent « sans étiquette ».
alter table public.offres
  add column etiquette_id uuid references public.etiquettes (id) on delete set null;

-- ---------- Row Level Security (même pattern que 001_schema.sql) ----------
alter table public.etiquettes enable row level security;

create policy "lecture perso"      on public.etiquettes for select using (auth.uid() = user_id);
create policy "insertion perso"    on public.etiquettes for insert with check (auth.uid() = user_id);
create policy "modification perso" on public.etiquettes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "suppression perso"  on public.etiquettes for delete using (auth.uid() = user_id);
