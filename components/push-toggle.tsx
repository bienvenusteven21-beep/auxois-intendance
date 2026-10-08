"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription } from "@/app/actions/notifications";
import { Button } from "./ui/button";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Active ou désactive les notifications push sur l’appareil courant. */
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<"unsupported" | "loading" | "off" | "on" | "denied" | "unconfigured">("loading");
  const [error, setError] = useState<string | null>(null);
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      if (!publicKey) return setState("unconfigured");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("off");
      }
    })();
  }, [publicKey]);

  async function enable() {
    setError(null);
    setState("loading");
    try {
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState("denied");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey!) });
      const json = sub.toJSON();
      const res = await savePushSubscription({ endpoint: sub.endpoint, keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth } }, navigator.userAgent);
      if (res?.error) throw new Error(res.error);
      setState("on");
    } catch (e) {
      setError((e as Error).message);
      setState("off");
    }
  }

  async function disable() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
    } finally {
      setState("off");
    }
  }

  if (state === "unconfigured") return <p className="text-[14px] text-ink-500">{compact ? "" : "Les notifications push ne sont pas encore configurées (clés VAPID). Les notifications restent visibles dans l’application et par email."}</p>;
  if (state === "unsupported") return <p className="text-[14px] text-ink-500">Ce navigateur ne prend pas en charge les notifications. Sur iPhone, ajoutez d’abord l’application à l’écran d’accueil.</p>;
  if (state === "denied") return <p className="text-[14px] text-ink-500">Les notifications sont bloquées dans les réglages de votre navigateur.</p>;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-[15px] text-ink-700 flex-1 min-w-[200px]">
        {state === "on" ? "Les notifications sont activées sur cet appareil." : "Recevez une alerte dès qu’il se passe quelque chose."}
      </p>
      {state === "on" ? (
        <Button variant="secondary" size="md" icon="bell" onClick={disable}>
          Désactiver
        </Button>
      ) : (
        <Button variant="primary" size="md" icon="bell" onClick={enable} disabled={state === "loading"}>
          {state === "loading" ? "…" : "Activer les notifications"}
        </Button>
      )}
      {error && <p className="w-full text-[13px] text-danger-600">{error}</p>}
    </div>
  );
}
