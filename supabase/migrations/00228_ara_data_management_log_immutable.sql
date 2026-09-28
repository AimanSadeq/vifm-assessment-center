-- 00228 - make the ARC data-management log append-only (AUDIT-IMMUTABLE-01).
--
-- ara_data_management_log records every erasure, anonymisation, hard delete,
-- sandbox purge and retention purge. Rows were written, but nothing stopped a
-- later UPDATE or DELETE from rewriting that history (admins hold full RLS on
-- the table, and the app writes with the service role). Compliance requires an
-- immutable audit trail, so:
--
--   * INSERT stays open (unchanged).
--   * UPDATE is refused, with ONE exception: the performed_by column may go
--     from a user id to NULL and nothing else may change. That is the
--     ON DELETE SET NULL from auth.users when a staff account is removed; the
--     entry itself survives, only the link to the deleted account goes.
--   * DELETE and TRUNCATE are refused. The log has no foreign keys to the rows
--     it describes, so no cascade ever needs to delete from it.
--
-- A superuser can still disable the trigger from the SQL editor; that is an
-- infrastructure-level action outside the application's reach, which is the
-- guarantee this migration is meant to give.

CREATE OR REPLACE FUNCTION ara_dmlog_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.performed_by IS NOT NULL
       AND NEW.performed_by IS NULL
       AND (to_jsonb(NEW) - 'performed_by') = (to_jsonb(OLD) - 'performed_by') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'ara_data_management_log rows are immutable'
      USING ERRCODE = '42501';
  END IF;
  RAISE EXCEPTION 'ara_data_management_log rows cannot be deleted'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS ara_dmlog_immutable_row ON ara_data_management_log;
CREATE TRIGGER ara_dmlog_immutable_row
  BEFORE UPDATE OR DELETE ON ara_data_management_log
  FOR EACH ROW EXECUTE FUNCTION ara_dmlog_immutable();

DROP TRIGGER IF EXISTS ara_dmlog_immutable_truncate ON ara_data_management_log;
CREATE TRIGGER ara_dmlog_immutable_truncate
  BEFORE TRUNCATE ON ara_data_management_log
  FOR EACH STATEMENT EXECUTE FUNCTION ara_dmlog_immutable();
