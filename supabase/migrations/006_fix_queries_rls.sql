-- Fix missing RLS policies for queries table
-- This will allow users to see queries for conversations they have access to

-- Add RLS policies for queries table
create policy "Users can view queries for accessible conversations" on queries
  for select using (
    exists (
      select 1 from conversations c
      where c.id = queries.conversation_id
      and has_client_access(auth.uid(), c.client_id)
    )
  );

create policy "Users can create queries for accessible conversations" on queries
  for insert with check (
    exists (
      select 1 from conversations c
      where c.id = queries.conversation_id
      and has_client_access(auth.uid(), c.client_id)
    )
  );

create policy "Users can update queries for accessible conversations" on queries
  for update using (
    exists (
      select 1 from conversations c
      where c.id = queries.conversation_id
      and has_client_access(auth.uid(), c.client_id)
    )
  );

-- Super admins can see all queries
create policy "Super admins can manage all queries" on queries
  for all using (is_super_admin(auth.uid()));

-- Migration completed successfully
