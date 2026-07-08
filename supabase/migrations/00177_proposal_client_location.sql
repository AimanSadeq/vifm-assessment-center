-- Adds optional client city + country to proposals, surfaced under the client
-- name on the proposal cover. Additive + idempotent. Code reads/writes both
-- columns tolerantly (independent column-peel), so an un-applied migration only
-- means the cover omits the location line - saves in every pricing mode still work.

alter table proposals
  add column if not exists client_city    text,
  add column if not exists client_country text;
