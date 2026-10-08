import { serviceClient } from '../_shared/auth.ts';
import { body, endpoint, HttpError, json, requiredString } from '../_shared/http.ts';
export const handler = endpoint(async req => {
  const input = await body(req);
  const setupKey = Deno.env.get('ADMIN_SETUP_KEY');
  if (!setupKey || input.setupKey !== setupKey) throw new HttpError(401, 'invalid_setup_key');
  const db = serviceClient();
  const { count, error } = await db.from('user_roles').select('*', { count: 'exact', head: true }).in('role', ['admin','super_admin']);
  if (error) throw error;
  if (count !== 0) throw new HttpError(403, 'already_initialized');
  const { data, error: createError } = await db.auth.admin.createUser({ email: requiredString(input.email, 'email', 320), password: requiredString(input.password, 'password', 256), email_confirm: true });
  if (createError || !data.user) throw new HttpError(400, 'invalid_admin_details');
  const { error: roleError } = await db.from('user_roles').insert({ user_id: data.user.id, role: 'super_admin' });
  if (roleError) {
    await db.auth.admin.deleteUser(data.user.id);
    throw roleError;
  }
  return json({ success: true });
});
if (import.meta.main) Deno.serve(handler);
