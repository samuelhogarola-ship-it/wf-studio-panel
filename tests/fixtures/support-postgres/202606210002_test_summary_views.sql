-- TEST ONLY: the historical hours→minutes migrations replace view column names
-- in ways CREATE OR REPLACE VIEW cannot perform on a pristine database.
-- The runner copies this into a disposable migration directory; applied history
-- and the final production view definitions remain untouched.
drop view public.pack_summary;
drop view public.client_summary;
