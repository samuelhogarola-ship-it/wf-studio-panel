begin;

drop policy if exists client_resource_objects_admin_read on storage.objects;
create policy client_resource_objects_admin_read on storage.objects
for select to authenticated
using (bucket_id = 'client-resources' and private.is_admin());

drop policy if exists client_resource_objects_own_read on storage.objects;
create policy client_resource_objects_own_read on storage.objects
for select to authenticated
using (
  bucket_id = 'client-resources'
  and (storage.foldername(name))[1] = private.current_portal_client_id()::text
);

commit;
