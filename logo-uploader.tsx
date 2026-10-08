"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setLogo } from "@/app/actions/parametres";

export function LogoUploader() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `logo-${Date.now()}.${ext}`;
      const { error: upErr } = await createClient().storage.from("branding").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const res = await setLogo(path);
      if (res?.error) throw new Error(res.error);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onChange} disabled={busy} className="block text-[15px] file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2" />
      {busy && <p className="text-[13px] text-ink-500 mt-1">Envoi…</p>}
      {error && <p className="text-[13px] text-danger-600 mt-1">{error}</p>}
    </div>
  );
}
