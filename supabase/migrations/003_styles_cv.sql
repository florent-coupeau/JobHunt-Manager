-- ============================================================
-- Suivi Alternance v3.3.1 — styles de CV personnalisés (import Word)
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 001_schema.sql et 002_etiquettes.sql)
-- ============================================================

-- ---------- Styles de CV personnalisés (gabarit HTML issu d'un .docx importé) ----------
create table public.styles_cv (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nom text not null,
  gabarit_html text not null,
  cree_le timestamptz not null default now()
);
create unique index styles_cv_nom_unique on public.styles_cv (user_id, lower(nom));

-- Un CV généré doit savoir avec quel style il a été produit :
-- 'json' pour les 3 styles intégrés (même contenu, CSS différent) ;
-- l'id d'un style perso sinon (contenu propre à ce gabarit).
alter table public.cv_generes add column style text not null default 'json';

-- ---------- Row Level Security (même pattern que 002_etiquettes.sql) ----------
alter table public.styles_cv enable row level security;

create policy "lecture perso"      on public.styles_cv for select using (auth.uid() = user_id);
create policy "insertion perso"    on public.styles_cv for insert with check (auth.uid() = user_id);
create policy "modification perso" on public.styles_cv for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "suppression perso"  on public.styles_cv for delete using (auth.uid() = user_id);
