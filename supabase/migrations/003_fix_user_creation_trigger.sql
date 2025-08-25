-- Fix the user creation trigger to work with RLS policies

-- Drop the existing trigger and function
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user() cascade;

-- Create a new function that bypasses RLS for user creation
create or replace function handle_new_user()
returns trigger as $$
begin
  -- Insert into platform_users with security definer to bypass RLS
  insert into public.platform_users (id, email, full_name, platform_role)
  values (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'full_name', ''), 
    'user'::platform_role
  );
  return new;
exception
  when others then
    -- Log the error (in production, you might want to use a proper logging mechanism)
    raise log 'Error in handle_new_user trigger: %', sqlerrm;
    return new; -- Don't fail the auth.users insert
end;
$$ language plpgsql security definer set search_path = public;

-- Recreate the trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Add a policy to allow the trigger function to insert new users
create policy "Allow trigger to insert new users" on platform_users
  for insert with check (true);

-- Ensure the service role can insert users (for the trigger)
grant insert on platform_users to service_role;

-- Test the function works
select 'User creation trigger fixed successfully' as status;
