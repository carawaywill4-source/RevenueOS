import { BRAND } from "@/lib/brand";
export default function AppHome() {
  return (
    <main className="wrap">
      <h1>{BRAND.displayName} app</h1>
      <p>
        Entitlement activates after Stripe checkout webhook. This shell is the
        real product surface RevenueOS will optimize.
      </p>
      <form action="/api/rewrite" method="post">
        <label>Job description<textarea name="job" rows={6} style={{width:"100%"}} /></label>
        <label>Resume<textarea name="resume" rows={8} style={{width:"100%"}} /></label>
        <button className="btn" type="submit">Rewrite (requires paid credits)</button>
      </form>
    </main>
  );
}
