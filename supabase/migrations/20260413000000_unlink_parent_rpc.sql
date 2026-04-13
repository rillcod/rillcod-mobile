-- Migration: unlink_parent_from_student RPC
-- Part of Mobile-Web Parity Alignment

create or replace function public.unlink_parent_from_student(target_student_id uuid)
returns void as $$
begin
  update public.students
  set parent_email = null
  where id = target_student_id;
end;
$$ language plpgsql security definer;

-- Grant execution to authenticated users (admin/teacher)
grant execute on function public.unlink_parent_from_student(uuid) to authenticated;
grant execute on function public.unlink_parent_from_student(uuid) to service_role;
