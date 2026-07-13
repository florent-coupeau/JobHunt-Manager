-- ============================================================
-- Suivi Alternance v3.4 — suppression de compte (RGPD)
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 001_schema.sql, 002_etiquettes.sql, 003_styles_cv.sql)
-- ============================================================

-- Supprime le compte de l'utilisateur connecté. La suppression de la ligne
-- auth.users cascade automatiquement sur toutes les tables (profiles, offres,
-- entreprises, criteres, master_cv, cv_generes, styles_cv, etiquettes,
-- parametres) grâce aux "on delete cascade" déjà posés dans 001/002/003.
create or replace function public.supprimer_mon_compte()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

-- Seul un utilisateur connecté peut appeler cette fonction (et auth.uid()
-- garantit qu'il ne peut supprimer que SON PROPRE compte).
grant execute on function public.supprimer_mon_compte() to authenticated;
