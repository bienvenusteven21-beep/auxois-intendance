import webpush from "web-push";
import { createAdminClient, hasServiceKey } from "@/lib/supabase/admin";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

let vapidReady = false;
function ensureVapid() {
  if (vapidReady || !pushConfigured()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:contact@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidReady = true;
}

interface PendingNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  link: string | null;
  send_push: boolean;
  send_email: boolean;
  users: { email: string | null; full_name: string; is_active: boolean } | null;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function sendEmail(to: string, subject: string, body: string, link: string | null, companyName: string) {
  const url = link ? `${APP_URL}${link.startsWith("/") ? "" : "/"}${link}` : APP_URL;
  const html = `
  <div style="font-family:Georgia,serif;background:#f7f3ea;padding:32px 16px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e3dbc9">
      <p style="margin:0 0 16px;color:#a67f45;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-family:Arial,sans-serif">${escapeHtml(companyName)}</p>
      <h1 style="margin:0 0 12px;font-size:22px;color:#173126">${escapeHtml(subject)}</h1>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3b4147;font-family:Arial,sans-serif">${escapeHtml(body).replace(/\n/g, "<br>")}</p>
      ${APP_URL ? `<a href="${url}" style="display:inline-block;background:#1f3f31;color:#f7f3ea;text-decoration:none;padding:14px 22px;border-radius:12px;font-family:Arial,sans-serif;font-size:15px">Ouvrir mon espace</a>` : ""}
    </div>
    <p style="text-align:center;color:#7c848c;font-size:12px;font-family:Arial,sans-serif;margin-top:16px">Vous recevez cet email car vous avez un espace ${escapeHtml(companyName)}.</p>
  </div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html, text: `${body}\n\n${url}` }),
  });
  if (!res.ok) throw new Error(`Email : ${res.status} ${await res.text()}`);
}

/**
 * Expédie (push + email) toutes les notifications créées en base et non encore
 * délivrées. Appelée après chaque action qui en crée, et par la tâche planifiée.
 */
export async function deliverPendingNotifications(limit = 100) {
  if (!hasServiceKey()) return { processed: 0, errors: 0 };
  const admin = createAdminClient();
  ensureVapid();

  const { data: settings } = await admin.from("settings").select("company_name").maybeSingle();
  const companyName = settings?.company_name ?? "Auxois Intendance";

  const { data: pending, error } = await admin
    .from("notifications")
    .select("id, user_id, title, body, link, send_push, send_email, users(email, full_name, is_active)")
    .is("delivered_at", null)
    .order("created_at", { ascending: true })
    .limit(limit)
    .returns<PendingNotification[]>();
  if (error || !pending?.length) return { processed: 0, errors: 0 };

  let errors = 0;
  for (const n of pending) {
    const problems: string[] = [];

    if (n.send_push && pushConfigured()) {
      const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", n.user_id);
      for (const s of subs ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: n.title, body: n.body, url: n.link ?? "/", tag: n.id }),
            { TTL: 60 * 60 * 24 },
          );
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await admin.from("push_subscriptions").delete().eq("id", s.id);
          } else {
            problems.push(`Push : ${(e as Error).message}`);
          }
        }
      }
    }

    if (n.send_email && emailConfigured() && n.users?.email && n.users.is_active) {
      try {
        await sendEmail(n.users.email, n.title, n.body, n.link, companyName);
      } catch (e) {
        problems.push((e as Error).message);
      }
    }

    if (problems.length) errors += 1;
    await admin
      .from("notifications")
      .update({ delivered_at: new Date().toISOString(), delivery_error: problems.length ? problems.join(" · ").slice(0, 500) : null })
      .eq("id", n.id);
  }
  return { processed: pending.length, errors };
}
