/**
 * Executable channel universe.
 * Capability catalog (~25 types) is not the traffic pool.
 * This file is the pool: real listing, signup, and ping URLs the operator
 * can try autonomously (email+password, no captcha bypass).
 * Hunt keeps adding more; this seed is so it never starts from 13 URLs.
 */

import { createHash } from "node:crypto";
import type pg from "pg";

export const CHANNEL_DOORS = [
  "/submit",
  "/submit-product",
  "/submit-a-tool",
  "/submit-tool",
  "/add",
  "/add-product",
  "/add-tool",
  "/new",
  "/contribute",
  "/register",
  "/signup",
  "/sign-up",
  "/users/sign_up",
  "/account/register",
  "/join",
  "/contact",
] as const;

/** Real origins that take product listings, tool submits, or accounts. */
export const CHANNEL_ORIGINS: string[] = [
  // Launch / startup discovery
  "https://www.producthunt.com",
  "https://www.saashub.com",
  "https://futuretools.io",
  "https://www.launchingnext.com",
  "https://www.uneed.best",
  "https://www.tinylaunch.com",
  "https://betalist.com",
  "https://www.startupbase.io",
  "https://alternativeto.net",
  "https://firsto.co",
  "https://openalternative.co",
  "https://www.saashunt.com",
  "https://www.saashunter.com",
  "https://www.saasworthy.com",
  "https://www.indiehackers.com",
  "https://peerlist.io",
  "https://devhunt.org",
  "https://www.launchvault.io",
  "https://www.microlaunch.net",
  "https://pitchwall.co",
  "https://www.killerstartups.com",
  "https://startupbuffer.com",
  "https://www.startupranking.com",
  "https://www.f6s.com",
  "https://wellfound.com",
  "https://www.crunchbase.com",
  "https://www.sideprojectors.com",
  "https://www.betabound.com",
  "https://www.betapage.co",
  "https://www.startupstash.com",
  "https://www.startupblink.com",
  "https://www.eu-startups.com",
  "https://www.failory.com",
  "https://www.launching.pl",
  "https://www.awesomeindie.com",
  "https://www.startupli.st",
  "https://www.discuvver.com",
  "https://www.webwiki.com",
  "https://www.saasmag.com",
  "https://www.saastr.com",
  "https://www.g2.com",
  "https://www.capterra.com",
  "https://www.getapp.com",
  "https://www.softwareadvice.com",
  "https://www.trustpilot.com",
  "https://sourceforge.net",
  "https://slashdot.org",
  "https://www.slant.co",
  "https://www.goodfirms.co",
  "https://clutch.co",
  "https://www.sortlist.com",
  "https://www.designrush.com",
  "https://www.extract.co",
  "https://www.saashacker.com",
  "https://www.saascatalog.com",
  "https://www.saascrowd.com",
  "https://www.saascritics.com",
  "https://www.saashunt.io",
  "https://www.saasmaker.co",
  "https://www.siftery.com",
  "https://stackshare.io",
  "https://www.producthunt.com",
  "https://news.ycombinator.com",
  "https://lobste.rs",
  "https://www.reddit.com",
  // AI / tool directories
  "https://theresanaiforthat.com",
  "https://www.futurepedia.io",
  "https://www.toolify.ai",
  "https://aitoolslist.com",
  "https://topai.tools",
  "https://dang.ai",
  "https://easywithai.com",
  "https://www.insidr.ai",
  "https://www.toolsforhumans.ai",
  "https://ai-finder.net",
  "https://www.aitools.fyi",
  "https://www.toolscout.ai",
  "https://www.saasaitools.com",
  "https://www.futuretools.io",
  "https://www.supertools.therundown.ai",
  "https://www.openfuture.ai",
  "https://gptstore.ai",
  "https://www.aixploria.com",
  "https://www.toolpilot.ai",
  "https://www.toolsmart.ai",
  "https://www.aitoolsdirectory.com",
  "https://www.aitoolnet.com",
  "https://www.topai.tools",
  "https://www.laozhang.ai",
  "https://www.librai.re",
  "https://www.aitools.xyz",
  "https://www.toolbot.ai",
  "https://www.godofprompt.ai",
  "https://www.aifinder.io",
  "https://www.aitoolhunt.com",
  "https://www.saasai.tools",
  "https://www.toolify.tech",
  "https://www.aitoptools.com",
  "https://www.bestaitools.com",
  "https://www.awesome-ai-tools.com",
  "https://www.therundown.ai",
  "https://www.futureagi.com",
  "https://www.aitoolslist.io",
  "https://www.tooldirectory.ai",
  "https://www.aitoolcollection.com",
  "https://www.saasaihub.com",
  "https://www.toptools.ai",
  "https://www.airectory.com",
  "https://www.toolai.io",
  "https://www.findaitools.io",
  "https://www.aitoolguide.com",
  "https://www.startuphub.ai",
  "https://www.aitool.me",
  "https://www.saasgenius.com",
  "https://www.crozdesk.com",
  "https://www.trustradius.com",
  "https://www.softwaresuggest.com",
  "https://www.serchen.com",
  "https://www.saaslist.com",
  "https://www.saascms.com",
  "https://www.saasscout.com",
  "https://www.getworm.com",
  "https://www.saashacker.io",
  "https://www.launching.today",
  "https://www.launching.io",
  "https://www.launchinghub.com",
  "https://www.startuptracker.io",
  "https://www.startupblink.com",
  "https://www.startupgenome.com",
  "https://www.angel.co",
  "https://www.gust.com",
  "https://www.f6s.com",
  "https://www.startupinfo.com",
  "https://www.startup88.com",
  "https://www.betalist.com",
  "https://www.launchingnext.com",
  "https://www.producthunt.com",
  "https://www.makerlog.com",
  "https://www.makermag.com",
  "https://www.makerpad.co",
  "https://www.nocode.tech",
  "https://www.nocodelist.co",
  "https://www.nocode.founders",
  "https://www.indie.tools",
  "https://www.indietoolbox.com",
  "https://www.console.dev",
  "https://console.dev",
  "https://www.sidebar.io",
  "https://www.lapa.ninja",
  "https://www.godly.website",
  "https://land-book.com",
  "https://www.onepagelove.com",
  "https://www.siteinspire.com",
  "https://saaslandingpage.com",
  "https://www.landingfolio.com",
  "https://www.pages.xyz",
  "https://www.httpster.net",
  // Developer catalogs
  "https://github.com",
  "https://gitlab.com",
  "https://www.npmjs.com",
  "https://pypi.org",
  "https://packagist.org",
  "https://crates.io",
  "https://hub.docker.com",
  "https://www.producthunt.com",
  "https://dev.to",
  "https://hashnode.com",
  "https://medium.com",
  "https://substack.com",
  "https://www.beehiiv.com",
  "https://www.blogger.com",
  "https://wordpress.com",
  "https://www.tumblr.com",
  "https://www.producthunt.com",
  // Local / citation / web directories (free listing desks)
  "https://www.hotfrog.com",
  "https://www.brownbook.net",
  "https://www.cybo.com",
  "https://www.n49.com",
  "https://tupalo.com",
  "https://www.infobel.com",
  "https://www.yasabe.com",
  "https://www.ezlocal.com",
  "https://www.showmelocal.com",
  "https://www.citysquares.com",
  "https://www.iglobal.co",
  "https://www.opendi.us",
  "https://www.botw.org",
  "https://www.exactseek.com",
  "https://www.gigablast.com",
  "https://www.jayde.com",
  "https://www.cylex.us.com",
  "https://www.2findlocal.com",
  "https://www.fyple.com",
  "https://www.callupcontact.com",
  "https://www.lacartes.com",
  "https://www.finduslocal.com",
  "https://www.ibegin.com",
  "https://www.chamberofcommerce.com",
  "https://www.manta.com",
  "https://www.merchantcircle.com",
  "https://www.elocal.com",
  "https://www.golocal247.com",
  "https://www.superpages.com",
  "https://www.yellowbot.com",
  "https://www.spoke.com",
  "https://www.dmoztools.net",
  "https://www.directory.net",
  "https://www.businessseek.biz",
  "https://www.somuch.com",
  "https://www.incguide.com",
  "https://www.gmawebdirectory.com",
  "https://www.cipdirectory.com",
  "https://www.skaffe.com",
  "https://www.exactseek.com",
  "https://www.joeant.com",
  "https://www.gimpsy.com",
  "https://www.directoryworld.net",
  "https://www.gainweb.org",
  "https://www.siteswebdirectory.com",
  "https://www.webworldindex.com",
  "https://www.directoryfire.com",
  "https://www.directoryworld.net",
  "https://www.sugerido.com",
  "https://www.anzacdirectory.com",
  "https://www.ukinternetdirectory.net",
  "https://www.canadainternetdirectory.com",
  "https://www.australiawebdirectory.net",
  "https://www.indiawebdirectory.net",
  "https://www.freewebdirectory.org",
  "https://www.directorysitelist.com",
  "https://www.piseries.com",
  "https://www.alive-directory.com",
  "https://www.directoryspot.net",
  "https://www.sonicrun.com",
  "https://www.able2know.org",
  "https://www.blogarama.com",
  "https://www.allthedirectories.com",
  "https://www.feedage.com",
  "https://www.rssmicro.com",
  "https://www.feedspot.com",
  "https://blogsearchengine.org",
  "https://www.onlinetoolhub.com",
  "https://www.tooldirectory.org",
  "https://www.webresourcesdepot.com",
  "https://www.cssjuice.com",
  "https://www.smashingmagazine.com",
  "https://www.csswinner.com",
  "https://www.cssawards.net",
  "https://www.thefwa.com",
  "https://www.awwwards.com",
  "https://www.cssdesignawards.com",
  "https://www.siteinspire.com",
  "https://www.bestwebsitedirectory.com",
  "https://www.webwiki.com",
  "https://www.similartech.com",
  "https://builtwith.com",
  "https://www.wappalyzer.com",
  "https://www.producthunt.com",
  // Construction / contractor vertical
  "https://www.construction.com",
  "https://www.enr.com",
  "https://www.constructiondive.com",
  "https://www.forconstructionpros.com",
  "https://www.constructionexec.com",
  "https://www.agc.org",
  "https://www.contractor.com",
  "https://www.thebluebook.com",
  "https://www.constructionwire.com",
  "https://www.buildingconnected.com",
  "https://www.planhub.com",
  "https://www.buildingconnected.com",
  "https://www.constructconnect.com",
  "https://www.dodgeconstruction.com",
  "https://www.constructionjournal.com",
  "https://www.hfmag.com",
  "https://www.jlconline.com",
  "https://www.finehomebuilding.com",
  "https://www.proremodeler.com",
  "https://www.remodeling.hw.net",
  // Invoice / SMB / freelance
  "https://www.freelancermap.com",
  "https://www.upwork.com",
  "https://www.fiverr.com",
  "https://www.peopleperhour.com",
  "https://www.guru.com",
  "https://www.flexjobs.com",
  "https://www.remoteok.com",
  "https://weworkremotely.com",
  "https://www.workingnomads.com",
  "https://www.indiehackers.com",
  "https://news.ycombinator.com",
  "https://www.producthunt.com",
  "https://www.reddit.com",
  "https://www.quora.com",
  "https://stackoverflow.com",
  "https://www.producthunt.com",
];

/** Paths that are known listing desks (higher value than generic /submit). */
export const CHANNEL_SPECIFIC_URLS: string[] = [
  "https://www.saashub.com/services/submit",
  "https://futuretools.io/submit-a-tool",
  "https://firsto.co/sites/submit-product",
  "https://www.launchingnext.com/submit",
  "https://www.uneed.best/submit",
  "https://devhunt.org/tools/new",
  "https://www.tinylaunch.com/submit",
  "https://openalternative.co/submit",
  "https://www.saashunt.com/submit",
  "https://betalist.com/submit",
  "https://www.startupbase.io/submit",
  "https://alternativeto.net/add/",
  "https://www.producthunt.com/posts/new",
  "https://theresanaiforthat.com/submit/",
  "https://www.futurepedia.io/submit-tool",
  "https://www.toolify.ai/submit",
  "https://dang.ai/submit",
  "https://www.indiehackers.com/products/new",
  "https://peerlist.io/launches/new",
  "https://news.ycombinator.com/submit",
  "https://www.f6s.com/add-product-or-service",
  "https://www.g2.com/products/new",
  "https://www.capterra.com/vendors/sign-up",
  "https://sourceforge.net/register",
  "https://slashdot.org/submission",
  "https://www.slant.co/topics/new",
  "https://hashnode.com/onboard",
  "https://dev.to/enter",
  "https://medium.com/m/signin",
  "https://substack.com/signin",
  "https://www.feedspot.com/tosubmit",
  "https://www.blogarama.com/submit.php",
  "https://www.botw.org/submit.php",
  "https://www.exactseek.com/add-url.html",
  "https://www.gigablast.com/addurl",
  "https://www.hotfrog.com/add-business",
  "https://www.brownbook.net/add-listing",
  "https://www.cybo.com/add-business",
  "https://www.manta.com/claim",
  "https://www.chamberofcommerce.com/add-business",
  "https://www.merchantcircle.com/plus/join",
  "https://www.showmelocal.com/add-business.aspx",
  "https://www.citysquares.com/add",
  "https://www.n49.com/add",
  "https://tupalo.com/en/submit",
  "https://www.ezlocal.com/add",
  "https://www.yasabe.com/add-business",
  "https://www.infobel.com/en/worldwide",
  "https://www.2findlocal.com/AddBusiness.php",
  "https://www.fyple.com/add",
  "https://www.ibegin.com/businesses/add/",
  "https://www.lacartes.com/submit",
  "https://www.callupcontact.com/add",
  "https://www.elocal.com/add-business",
  "https://www.superpages.com/add",
  "https://www.yellowbot.com/add",
  "https://www.joeant.com/submit.php",
  "https://www.skaffe.com/submit.php",
  "https://www.alive-directory.com/submit.php",
  "https://www.directoryfire.com/submit.php",
  "https://www.gainweb.org/submit.php",
  "https://www.siteswebdirectory.com/submit.php",
  "https://www.webworldindex.com/submit.php",
  "https://www.somuch.com/add-url/",
  "https://www.businessseek.biz/add-url/",
  "https://www.incguide.com/submit.php",
  "https://www.onlinetoolhub.com/submit",
  "https://www.toolify.ai/submit-ai-tool",
  "https://aitoolslist.com/submit",
  "https://topai.tools/submit",
  "https://easywithai.com/submit-tool/",
  "https://www.insidr.ai/submit-tool/",
  "https://ai-finder.net/submit",
  "https://www.aitools.fyi/submit",
  "https://www.aixploria.com/en/add-ai/",
  "https://www.saasworthy.com/submit-product",
  "https://www.goodfirms.co/register-your-company",
  "https://clutch.co/profile/claim",
  "https://www.softwareadvice.com/vendors/",
  "https://www.getapp.com/vendor/",
  "https://www.trustradius.com/vendors/sign-up",
  "https://www.crozdesk.com/vendors/sign-up",
  "https://www.softwaresuggest.com/vendors",
  "https://www.startupranking.com/submit",
  "https://startupbuffer.com/submit",
  "https://www.killerstartups.com/submit",
  "https://www.startupstash.com/add-your-startup/",
  "https://www.sideprojectors.com/project/create",
  "https://www.betapage.co/submit",
  "https://www.betabound.com/submit",
  "https://www.microlaunch.net/submit",
  "https://pitchwall.co/submit",
  "https://www.launchvault.io/submit",
  "https://firsto.co/submit",
  "https://www.saashunter.com/submit",
  "https://www.saascrowd.com/submit",
  "https://www.getworm.com/submit",
  "https://www.console.dev/submit",
  "https://www.lapa.ninja/submit",
  "https://www.godly.website/submit",
  "https://land-book.com/submissions/new",
  "https://www.onepagelove.com/submit",
  "https://www.awwwards.com/submit/",
  "https://www.cssdesignawards.com/submit",
  "https://www.thefwa.com/submit",
  "https://saaslandingpage.com/submit",
  "https://www.landingfolio.com/submit",
  "https://www.feedspot.com/tosubmit",
  "https://www.rssmicro.com/submit.aspx",
  "https://www.blogarama.com/blogs/add",
];

export const PING_ENDPOINTS: string[] = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow",
  "https://yandex.com/indexnow",
  "http://rpc.pingomatic.com/",
  "https://pubsubhubbub.appspot.com/",
];

export const CHANNEL_DISCOVERY_QUERIES: string[] = [
  "submit your startup free directory",
  "submit your tool free listing",
  "add product saas directory submit",
  "submit AI tool free",
  "free software directory submit url",
  "add your company web directory",
  "submit blog rss directory",
  "indie hacker launch list submit",
  "beta list submit product",
  "alternative.to add product",
  "construction software directory submit",
  "contractor tools directory listing",
  "freelance tools directory submit",
  "no code directory submit product",
  "startup launch platform submit",
  "free citation directory add business",
  "submit url search engine free",
  "product launch directory 2026",
  "list your saas for free",
  "add your AI product directory",
];

export type UniverseSurface = {
  id: string;
  platform: string;
  url: string;
};

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function platformOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function surfaceId(url: string): string {
  const platform = platformOf(url);
  return `surf_${createHash("sha1").update(`${platform}|${url}`).digest("hex").slice(0, 16)}`;
}

export function expandChannelUniverse(): UniverseSurface[] {
  const seen = new Set<string>();
  const out: UniverseSurface[] = [];
  const add = (url: string) => {
    let normalized = url.trim();
    if (!normalized) return;
    if (/\s/.test(normalized)) return;
    if (!/^https?:\/\//i.test(normalized)) return;
    normalized = normalized.replace(/\/+$/, "") || normalized;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push({ id: surfaceId(normalized), platform: platformOf(normalized), url: normalized });
  };

  for (const origin of CHANNEL_ORIGINS) {
    const o = originOf(origin);
    if (!o) continue;
    add(o);
    for (const path of CHANNEL_DOORS) add(`${o}${path}`);
  }
  for (const url of CHANNEL_SPECIFIC_URLS) add(url);
  for (const url of PING_ENDPOINTS) add(url);
  return out;
}

export async function seedChannelUniverse(pool: pg.Pool): Promise<{ seeded: number; total: number }> {
  const all = expandChannelUniverse();
  const cur = await pool.query(`select query_index from ros_hunt_cursor where id='universe'`);
  const offset = Number(cur.rows[0]?.query_index ?? 0);
  if (offset >= all.length) return { seeded: 0, total: all.length };

  const chunk = all.slice(offset, offset + 180);
  let seeded = 0;
  for (let i = 0; i < chunk.length; i += 60) {
    const part = chunk.slice(i, i + 60);
    const values: string[] = [];
    const params: unknown[] = [];
    for (const s of part) {
      const n = params.length;
      values.push(`($${n + 1},$${n + 2},$${n + 3},null,null,'UNKNOWN_NEEDS_RESEARCH','cee_v46_universe', now())`);
      params.push(s.id, s.platform, s.url);
    }
    const r = await pool.query(
      `insert into ros_external_surfaces
         (surface_id, platform, url, automation_allowed, posting_allowed, policy_class, reason, updated_at)
       values ${values.join(",")}
       on conflict (surface_id) do nothing`,
      params,
    );
    seeded += r.rowCount ?? 0;
  }
  await pool.query(
    `insert into ros_hunt_cursor (id, query_index, pages_fetched, contacts_stored, last_engine, updated_at)
     values ('universe', $1, $2, 0, 'seed', now())
     on conflict (id) do update set
       query_index=$1,
       pages_fetched=ros_hunt_cursor.pages_fetched+$2,
       last_engine='seed',
       updated_at=now()`,
    [offset + chunk.length, seeded],
  );
  return { seeded, total: all.length };
}

export function nextChannelDiscoveryQueries(cursor: number, n = 4): { queries: string[]; nextCursor: number } {
  const queries: string[] = [];
  let i = cursor;
  for (let k = 0; k < n; k++) {
    queries.push(CHANNEL_DISCOVERY_QUERIES[i % CHANNEL_DISCOVERY_QUERIES.length]!);
    i += 1;
  }
  return { queries, nextCursor: i };
}
