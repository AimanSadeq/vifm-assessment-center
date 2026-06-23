-- One-step removal of ALL Role Readiness SAMPLE data (the HR GM seed + its sample
-- candidate run). Everything seeded carries is_sample = true, so this removes the
-- sample and nothing real. Run in the Supabase SQL editor.
--
-- Deleting rr_role_configs cascades to rr_technical_areas, rr_technical_items,
-- rr_candidates, rr_section_results and bespoke_services (role_config_id). The
-- sample role_profile (1:1) is removed by its distinctive name (cascades
-- role_profile_competencies); job_families by is_sample.
begin;
  delete from rr_role_configs where is_sample = true;
  delete from bespoke_services where is_sample = true;
  delete from rr_candidates where is_sample = true;
  delete from role_profiles where name_en = 'HR General Manager (Sample)';
  delete from job_families where is_sample = true;
commit;
