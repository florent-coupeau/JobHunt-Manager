-- ============================================================
-- Suivi Alternance v3 — schéma complet
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- ============================================================

-- ---------- Profils (1 ligne par compte, créée automatiquement) ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text,
  cree_le timestamptz not null default now()
);

-- ---------- Offres (fusion offres + candidatures : UN statut unique) ----------
create table public.offres (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null default 'manuel' check (source in ('linkedin', 'import_ia', 'manuel')),
  source_ref text,                       -- ex. "li-4426830737" : sert au dédoublonnage
  titre text not null,
  entreprise text not null default '',
  lieu text default '',
  lien text default '',
  description_resume text default '',
  domaine text default '',
  date_publication date,
  date_ajout date not null default current_date,
  statut text not null default 'nouvelle'
    check (statut in ('nouvelle', 'a_postuler', 'envoyee', 'entretien', 'acceptee', 'refusee', 'ecartee')),
  date_candidature date,
  date_relance_prevue date,
  notes text not null default '',
  historique jsonb not null default '[]'
);
create unique index offres_dedoublonnage on public.offres (user_id, source_ref) where source_ref is not null;
create index offres_par_utilisateur on public.offres (user_id);

-- ---------- Fiches entreprises ----------
create table public.entreprises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nom text not null,
  linkedin_url text default '',
  secteur text default '',
  taille text default '',
  description text default '',
  posts_recents jsonb not null default '[]',
  contacts jsonb not null default '[]',
  notes text not null default ''
);
create unique index entreprises_nom_unique on public.entreprises (user_id, lower(nom));

-- ---------- Critères de recherche (1 ligne par compte) ----------
create table public.criteres (
  user_id uuid primary key references auth.users (id) on delete cascade,
  domaines jsonb not null default '[]',      -- [{id, nom, postes[], mots_cles[]}]
  localisation jsonb not null default '{}',  -- {zone, teletravail, presentiel, hybride}
  contrats jsonb not null default '[]',
  exclusions jsonb not null default '[]',
  derniere_maj timestamptz not null default now()
);

-- ---------- Master CV (base exhaustive, 1 par compte) ----------
create table public.master_cv (
  user_id uuid primary key references auth.users (id) on delete cascade,
  contenu jsonb not null default '{}',
  maj_le timestamptz not null default now()
);

-- ---------- CV générés (un par offre ciblée) ----------
create table public.cv_generes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  offre_id uuid not null references public.offres (id) on delete cascade,
  contenu jsonb not null default '{}',
  cree_le timestamptz not null default now()
);
create index cv_generes_par_offre on public.cv_generes (user_id, offre_id);

-- ---------- Paramètres (fournisseur IA, avertissement LinkedIn, rate limit) ----------
create table public.parametres (
  user_id uuid primary key references auth.users (id) on delete cascade,
  fournisseur_ia text not null default 'gemini' check (fournisseur_ia in ('gemini', 'anthropic')),
  avertissement_linkedin_accepte_le timestamptz,
  recherches_jour int not null default 0,
  derniere_recherche date
);

-- ============================================================
-- Row Level Security : chaque utilisateur ne voit QUE ses lignes
-- ============================================================
alter table public.profiles    enable row level security;
alter table public.offres      enable row level security;
alter table public.entreprises enable row level security;
alter table public.criteres    enable row level security;
alter table public.master_cv   enable row level security;
alter table public.cv_generes  enable row level security;
alter table public.parametres  enable row level security;

-- profiles : la clé est id (pas user_id)
create policy "profil : lire le sien"     on public.profiles for select using (auth.uid() = id);
create policy "profil : modifier le sien" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Les 6 autres tables partagent les mêmes 4 règles sur user_id
do $$
declare t text;
begin
  foreach t in array array['offres', 'entreprises', 'criteres', 'master_cv', 'cv_generes', 'parametres'] loop
    execute format('create policy "lecture perso"      on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "insertion perso"    on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "modification perso" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "suppression perso"  on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ============================================================
-- À l'inscription : créer automatiquement profil + paramètres
-- ============================================================
create or replace function public.creer_profil()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, pseudo) values (new.id, split_part(new.email, '@', 1));
  insert into public.parametres (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.creer_profil();
