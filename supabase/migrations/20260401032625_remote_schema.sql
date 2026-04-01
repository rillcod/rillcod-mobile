drop extension if exists "pg_net";

drop policy "Teachers can manage CBT exams" on "public"."cbt_exams";

drop policy "Allow public insert" on "public"."prospective_students";

CREATE INDEX idx_assignment_lesson_id ON public.assignments USING btree (lesson_id);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    year_prefix TEXT;
    seq_val INT;
BEGIN
    year_prefix := 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-';
    SELECT count(*) + 1 INTO seq_val FROM invoices WHERE invoice_number LIKE year_prefix || '%';
    NEW.invoice_number := year_prefix || LPAD(seq_val::text, 5, '0');
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    year_prefix TEXT;
    seq_val INT;
BEGIN
    year_prefix := 'RCP-' || TO_CHAR(NOW(), 'YYYY') || '-';
    SELECT count(*) + 1 INTO seq_val FROM receipts WHERE receipt_number LIKE year_prefix || '%';
    NEW.receipt_number := year_prefix || LPAD(seq_val::text, 6, '0');
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.portal_users WHERE id = auth.uid();
  RETURN v_role;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (SELECT school_id FROM public.portal_users WHERE id = auth.uid());
END; $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.portal_users (
    id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)   -- fallback: use email prefix as name
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;  -- admin-created rows already have full data

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (SELECT role = 'admin' FROM public.portal_users WHERE id = auth.uid());
END; $function$
;

CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (SELECT role IN ('admin', 'teacher', 'school') FROM public.portal_users WHERE id = auth.uid());
END; $function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_live_sessions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;


  create policy "Teachers can manage CBT exams"
  on "public"."cbt_exams"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.portal_users
  WHERE ((portal_users.id = auth.uid()) AND (portal_users.role = 'teacher'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.portal_users
  WHERE ((portal_users.id = auth.uid()) AND (portal_users.role = 'teacher'::text)))));



  create policy "Allow public insert"
  on "public"."prospective_students"
  as permissive
  for insert
  to anon, authenticated
with check (true);


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


  create policy "avatars_owner_delete"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "avatars_owner_insert"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "avatars_owner_update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "avatars_public_read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'avatars'::text));



  create policy "portfolio_images_owner_delete"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'portfolio-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "portfolio_images_owner_insert"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'portfolio-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "portfolio_images_owner_update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'portfolio-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "portfolio_images_public_read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'portfolio-images'::text));



