import { redirect } from "next/navigation";
import { trySignIn } from "@/lib/auth";

async function submit(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const ok = await trySignIn(token);
  if (ok) redirect("/");
  redirect("/login?error=1");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="max-w-md mx-auto mt-16 p-8 rounded-xl border border-[--color-panel-border] bg-[--color-panel]">
      <h1 className="text-lg font-semibold mb-1">Owner sign in</h1>
      <p className="text-[--color-muted] text-sm mb-4">
        Paste the bearer token from <code>.env.local</code>.
      </p>
      <form action={submit} className="flex gap-2">
        <input
          className="flex-1 bg-[--color-bg] border border-[--color-panel-border] rounded px-3 py-2 text-sm"
          type="password"
          name="token"
          autoFocus
          placeholder="DASHBOARD_TOKEN"
        />
        <button
          className="px-3 py-2 rounded bg-[--color-accent] text-[--color-bg] text-sm font-medium"
          type="submit"
        >
          Enter
        </button>
      </form>
      {params.error ? (
        <p className="mt-3 text-sm text-[--color-danger]">Token rejected.</p>
      ) : null}
    </div>
  );
}
