-- Complete database reset - drop everything
-- This will completely wipe the database clean

-- Drop all existing triggers first
drop trigger if exists on_auth_user_created on auth.users;

-- Drop all functions
drop function if exists handle_new_user() cascade;
drop function if exists get_user_platform_role() cascade;
drop function if exists is_super_admin() cascade;

-- Drop all tables (in dependency order to avoid foreign key issues)
drop table if exists evaluations cascade;
drop table if exists evaluation_policies cascade;
drop table if exists driver_behaviors cascade;
drop table if exists drivers cascade;
drop table if exists feedback cascade;
drop table if exists queries cascade;
drop table if exists conversations cascade;
drop table if exists embeddings cascade;
drop table if exists chunks cascade;
drop table if exists jobs cascade;
drop table if exists uploads cascade;
drop table if exists rooms cascade;
drop table if exists user_client_access cascade;
drop table if exists user_roles cascade;
drop table if exists platform_users cascade;
drop table if exists clients cascade;
drop table if exists admin_settings cascade;

-- Drop all custom types
drop type if exists platform_role cascade;
drop type if exists user_role cascade;
drop type if exists job_status cascade;
drop type if exists room_type cascade;

-- Drop any remaining sequences
drop sequence if exists platform_users_id_seq cascade;
drop sequence if exists clients_id_seq cascade;
drop sequence if exists rooms_id_seq cascade;
drop sequence if exists uploads_id_seq cascade;
drop sequence if exists jobs_id_seq cascade;
drop sequence if exists conversations_id_seq cascade;
drop sequence if exists admin_settings_id_seq cascade;

-- Drop any remaining views
drop view if exists user_permissions cascade;
drop view if exists client_summary cascade;

-- Drop any remaining indexes (PostgreSQL will auto-drop most, but just in case)
drop index if exists idx_platform_users_user_id;
drop index if exists idx_platform_users_email;
drop index if exists idx_user_client_access_user_id;
drop index if exists idx_user_client_access_client_id;
drop index if exists idx_rooms_client_id;
drop index if exists idx_uploads_client_id;
drop index if exists idx_uploads_room_id;
drop index if exists idx_jobs_upload_id;
drop index if exists idx_conversations_client_id;

-- Revoke any custom permissions
revoke all on schema public from authenticated;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;
revoke all on all functions in schema public from authenticated;

-- Reset to default permissions
grant usage on schema public to authenticated, anon;
grant all on schema public to postgres, service_role;

-- Database is now completely clean
select 'Database has been completely reset' as status;
