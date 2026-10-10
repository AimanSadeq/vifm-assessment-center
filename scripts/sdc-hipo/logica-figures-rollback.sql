-- Undo logica-figures-load.sql (generated; do not edit by hand).
-- Restores the text originals and retires the figure versions (kept, not
-- deleted, so any responses logged against them stay attributable).
BEGIN;
UPDATE psy_items SET status = 'retired' WHERE source = 'figure_v1';
UPDATE psy_items SET status = 'in_review' WHERE id IN ('1c5a49ec-aa6a-4f30-a663-60b00cc90c5d'::uuid, '9f631041-3fb6-463f-a979-39cec64cbd1b'::uuid, 'ef2960dc-a122-4321-9bdc-be21cbe6c4ca'::uuid, '5b06229e-46f7-42df-9e01-0cd37b3dd002'::uuid, 'cd15e7c9-9f40-4f43-9d44-d95945752a1a'::uuid, 'eed66f1e-c04c-4980-9ae9-31a78494b63d'::uuid, '5d6ea32f-dda6-4d01-9b30-f4e1b257f5ee'::uuid, '8fa1a761-4b01-4fc0-879e-fba14a6cc75a'::uuid, 'f1f8fe62-7e7d-4e20-9d5f-4bbe2614b334'::uuid, 'f9ec2980-6227-4aa9-8f7b-7d6eed3b29d2'::uuid, 'aa80f9a3-ed9b-467d-8c27-f0c75d1917bd'::uuid, '4c669428-bb9d-4e8e-87df-3108e97e4bbf'::uuid, '64e6a11d-6e1c-4a59-990a-719961bb8a2a'::uuid, 'b6c4aaf6-151d-4a2a-8659-63b586309d46'::uuid, '56ac4955-ba24-4dec-92c9-1c59ee0cf05d'::uuid, '043892e7-550d-412c-ae35-abe0e5a12ade'::uuid, 'a6129471-076a-4d64-9b9c-424c5ab93fc3'::uuid, '3c06a743-d58c-449c-a5a3-678b4ffc28b0'::uuid, '4f4c1ee7-03db-4f94-b8f2-2ca071e2eeb7'::uuid, '6f9ecd18-b72d-412d-9a83-b21f9e28fced'::uuid, '667bd222-2b8e-4348-8cfb-84ba4edaad60'::uuid) AND status = 'retired';
COMMIT;
