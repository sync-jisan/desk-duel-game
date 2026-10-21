-- The sign-up trigger function only needs to run as a trigger on auth.users.
-- Remove direct API access (Security Advisor: "Public Can Execute SECURITY DEFINER Function").
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
