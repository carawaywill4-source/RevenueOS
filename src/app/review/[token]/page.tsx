import { Leaf } from "lucide-react";
import { notFound } from "next/navigation";
import { ReviewForm } from "@/components/review-form";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Share your verified experience",
  robots: { index: false, follow: false },
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();

  const { data: order } = await getSupabaseAdmin()
    .from("orders")
    .select("id")
    .eq("review_token", token)
    .eq("status", "fulfilled")
    .single();
  if (!order) notFound();

  return (
    <main className="botanical-glow soft-grid min-h-screen px-5 py-14 sm:px-8">
      <div className="paper-shadow mx-auto max-w-xl rounded-[2rem] border border-forest/10 bg-paper p-7 sm:p-10">
        <Leaf className="mx-auto text-sage" size={22} />
        <div className="mt-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gold">
            Verified customer feedback
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-forest">
            How did TributeReady serve you?
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-forest/55">
            Honest feedback of every rating helps other families decide and
            helps us improve. Please leave memorial names and details out.
          </p>
        </div>
        <ReviewForm reviewToken={token} />
      </div>
    </main>
  );
}
