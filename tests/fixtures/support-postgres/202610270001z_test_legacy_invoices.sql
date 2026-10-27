insert into public.clients(id, name, company, email, status, project)
values
  ('10000000-0000-4000-8000-000000000001', 'Marisol', 'Gimnasio Nuevo Estilo, S.C.', 'marisol@example.test', 'active', 'wf-studio'),
  ('10000000-0000-4000-8000-000000000002', 'SuVilla', 'SuVilla SL', 'suvilla@example.test', 'active', 'wf-studio'),
  ('10000000-0000-4000-8000-000000000003', 'Miguel', 'Bionatura del Sur SL', 'miguel@example.test', 'active', 'wf-studio'),
  ('10000000-0000-4000-8000-000000000004', 'Archivo', 'Cliente histórico', 'archivo@example.test', 'active', 'wf-studio');

insert into public.invoices(
  id, client_id, number, concept, amount, payment_method, status, notes,
  issued_at, paid_at, recipient_kind, recipient_name, recipient_email, recipient_company
)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'WF-2026-001', 'Página web', 242, 'transfer', 'paid', null, '2026-07-20', '2026-07-20', 'registered', 'Marisol', 'marisol@example.test', E'Gimnasio Nuevo Estilo, S.C.\nCIF: J29227907'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'WF-2026-002', 'Propuesta web profesional', 786.50, 'transfer', 'paid', null, '2026-10-23', '2026-10-23', 'registered', 'SuVilla', 'suvilla@example.test', E'SuVilla SL\nCIF: B93154425'),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000004', 'WF-2025-010', 'Histórica borrador', 100, 'cash', 'draft', 'Mantener nota', '2025-01-10', null, 'registered', 'Archivo', 'archivo@example.test', E'Cliente histórico\nCIF: X0000001A\nCalle Uno'),
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000004', 'WF-2025-011', 'Histórica emitida', 110, 'card', 'issued', null, '2025-01-11', null, 'registered', 'Archivo', 'archivo@example.test', 'Cliente histórico'),
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000004', 'WF-2025-012', 'Histórica pagada', 120, 'transfer', 'paid', null, '2025-01-12', '2025-01-13', 'registered', 'Archivo', 'archivo@example.test', 'Cliente histórico'),
  ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000004', 'WF-2025-013', 'Histórica anulada', 130, 'transfer', 'void', null, '2025-01-13', null, 'registered', 'Archivo', 'archivo@example.test', 'Cliente histórico');
