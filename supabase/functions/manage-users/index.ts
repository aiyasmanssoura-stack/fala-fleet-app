// manage-users (18 Nov 2026): Admin only. Lists users, adds a user with a first password,
// changes a level, sets a new password, switches a user off or on. Uses the service key on the server only.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const ROLES = ["admin", "editor", "viewer", "amia_editor"];
const NAMES: Record<string, string> = { admin: "Admin", editor: "Editor", viewer: "Guest", amia_editor: "AMIA Project Editor" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: ures } = await admin.auth.getUser(token);
    const me = ures?.user;
    if (!me) return json(401, { error: "Please sign in again." });
    const { data: mine } = await admin.from("app_users").select("role,email").eq("id", me.id).maybeSingle();
    if (!mine || mine.role !== "admin") return json(403, { error: "Only an Admin can manage users." });

    const b = await req.json().catch(() => ({}));
    const log = async (summary: string, details: Record<string, unknown>) => {
      await admin.from("change_log").insert({ by_user: me.id, by_email: mine.email, kind: "user", summary, details });
    };

    if (b.action === "list") {
      const { data: rows, error } = await admin.from("app_users").select("id,email,role,created_at").order("email");
      if (error) return json(500, { error: error.message });
      const { data: au } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const banned: Record<string, boolean> = {};
      (au?.users || []).forEach((u: any) => { banned[u.id] = !!u.banned_until && new Date(u.banned_until) > new Date(); });
      return json(200, { users: (rows || []).map((r: any) => ({ ...r, off: !!banned[r.id], me: r.id === me.id })) });
    }

    if (b.action === "create") {
      const email = String(b.email || "").trim().toLowerCase();
      const password = String(b.password || "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: "Type a valid email." });
      if (!ROLES.includes(b.role)) return json(400, { error: "Choose a level." });
      if (password.length < 8) return json(400, { error: "The password needs at least 8 characters." });
      const { data: c, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (ce || !c?.user) return json(400, { error: ce?.message || "Could not create the user." });
      const { error: ie } = await admin.from("app_users").insert({ id: c.user.id, email, role: b.role });
      if (ie) { await admin.auth.admin.deleteUser(c.user.id); return json(400, { error: ie.message }); }
      await log(`User added: ${email} as ${NAMES[b.role]}`, { user: c.user.id, role: b.role });
      return json(200, { ok: true });
    }

    const id = String(b.id || "");
    const { data: tgt } = await admin.from("app_users").select("id,email,role").eq("id", id).maybeSingle();
    if (!tgt) return json(404, { error: "User not found." });

    if (b.action === "set_role") {
      if (!ROLES.includes(b.role)) return json(400, { error: "Choose a level." });
      if (id === me.id) return json(400, { error: "You cannot change your own level." });
      const { error } = await admin.from("app_users").update({ role: b.role }).eq("id", id);
      if (error) return json(400, { error: error.message });
      await log(`User level changed: ${tgt.email} from ${NAMES[tgt.role]} to ${NAMES[b.role]}`, { user: id, old: tgt.role, new: b.role });
      return json(200, { ok: true });
    }
    if (b.action === "set_password") {
      const password = String(b.password || "");
      if (password.length < 8) return json(400, { error: "The password needs at least 8 characters." });
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return json(400, { error: error.message });
      await log(`New password set for ${tgt.email}`, { user: id });
      return json(200, { ok: true });
    }
    if (b.action === "set_active") {
      if (id === me.id) return json(400, { error: "You cannot switch yourself off." });
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: b.active ? "none" : "876000h" });
      if (error) return json(400, { error: error.message });
      await log(`${tgt.email} switched ${b.active ? "on" : "off"}`, { user: id, active: !!b.active });
      return json(200, { ok: true });
    }
    return json(400, { error: "Unknown action." });
  } catch (e) {
    return json(500, { error: String((e as Error).message || e) });
  }
});
