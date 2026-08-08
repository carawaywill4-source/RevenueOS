import { Leaf } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy, in plain language">
      <p>
        TributeReady is designed for sensitive family memories. We collect only
        the information needed to create, deliver, and support the memorial
        products you request.
      </p>
      <h2>What we process</h2>
      <p>
        This may include names, dates, memories, service details, photographs,
        contact information, and payment status. Card details are handled
        directly by Stripe and are not stored by TributeReady.
      </p>
      <h2>How assisted writing works</h2>
      <p>
        Text you submit may be sent to our contracted AI provider solely to
        create your requested draft. Production requests are configured not to
        be stored by that provider where supported. We do not sell memorial
        content or use private photographs for advertising.
      </p>
      <h2>Storage and deletion</h2>
      <p>
        Production source files are retained only long enough to generate,
        deliver, and support your collection, with deletion scheduled within 30
        days. The private memorial text and approved display image remain
        available through the private link unless you request removal or the
        service ends; we do not promise permanent hosting. Financial records
        may be retained where legally required.
      </p>
      <p>
        While you are creating a tribute, an expiring draft may be stored only
        in this browser so a refresh or canceled checkout does not erase your
        work. It expires after seven days, can be cleared from the builder, and
        is removed after a verified purchase. It is not a cloud backup.
      </p>
      <h2>Private service measurement</h2>
      <p>
        We record limited first-party events such as a page visit, builder step,
        checkout, delivery, or download so we can find technical problems and
        understand whether the service is useful. These events do not contain
        memorial writing, names, photographs, email addresses, card details, or
        IP addresses. Event records are scheduled for deletion after 90 days.
      </p>
      <p>
        So we can tell which resources genuinely help people, this browser also
        remembers how you first arrived—for example a search engine or a linking
        website, and any campaign labels in the address. That record holds no
        personal information, is never sold or shared for advertising, and is
        discarded after 30 days.
      </p>
      <h2>Your choices</h2>
      <p>
        You may request access, correction, or deletion by emailing{" "}
        <a href="mailto:privacy@tributeready.org">privacy@tributeready.org</a>.
        We will verify requests before acting to protect family information.
      </p>
    </LegalPage>
  );
}

function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-cream px-5 py-12 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="flex items-center gap-2 text-forest">
          <Leaf size={17} className="text-sage" />
          <span className="font-display text-2xl font-semibold">TributeReady</span>
        </Link>
        <article className="mt-12 rounded-[2rem] border border-forest/8 bg-paper p-7 paper-shadow sm:p-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">
            Last updated August 6, 2026
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-forest sm:text-6xl">
            {title}
          </h1>
          <div className="mt-8 space-y-5 text-sm leading-7 text-forest/60 [&_a]:font-semibold [&_a]:text-forest [&_h2]:pt-3 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-forest">
            {children}
          </div>
        </article>
      </div>
    </main>
  );
}
