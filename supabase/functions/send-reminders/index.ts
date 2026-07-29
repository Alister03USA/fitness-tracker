import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";

const supabase = createClient(supabaseUrl, serviceRoleKey);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function localParts(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function reminderMinutes(value: string) {
  const [hour, minute] = String(value || "00:00")
    .slice(0, 5)
    .split(":")
    .map(Number);
  return hour * 60 + minute;
}

function isReminderDue(reminder: any) {
  const timeZone = reminder.timezone || "UTC";
  const local = localParts(timeZone);
  const target = reminderMinutes(reminder.reminder_time);
  const delta = local.minutes - target;

  return {
    due: delta >= 0 && delta < 5,
    reminderDate: local.date,
  };
}

async function sendReminder(userId: string, reminderDate: string) {
  const { error: deliveryError } = await supabase
    .from("reminder_deliveries")
    .insert({ user_id: userId, reminder_date: reminderDate });

  if (deliveryError) return { sent: 0, skipped: true };

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error || !subscriptions?.length) return { sent: 0, skipped: false };

  const payload = JSON.stringify({
    title: "MoveCircle",
    body: "Time to log your meals and activity for today.",
    url: "/",
  });

  let sent = 0;
  await Promise.all(
    subscriptions.map(async (subscription: any) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
        );
        sent += 1;
      } catch (error) {
        const statusCode = (error as any)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", subscription.id);
        } else {
          console.error("Push send failed:", error);
        }
      }
    }),
  );

  return { sent, skipped: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return jsonResponse({
      error: "Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY Supabase secret.",
    });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const { data: reminders, error } = await supabase
    .from("reminder_settings")
    .select("user_id, reminder_time, timezone")
    .eq("enabled", true);

  if (error) {
    return jsonResponse({ error: error.message });
  }

  let due = 0;
  let sent = 0;
  let skipped = 0;

  for (const reminder of reminders || []) {
    const status = isReminderDue(reminder);
    if (!status.due) continue;

    due += 1;
    const result = await sendReminder(reminder.user_id, status.reminderDate);
    sent += result.sent;
    if (result.skipped) skipped += 1;
  }

  return jsonResponse({
    checked: reminders?.length || 0,
    due,
    sent,
    skipped,
  });
});
