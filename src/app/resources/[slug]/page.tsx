import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourceGuide } from "@/components/resource-guide";
import { GrowthPageView } from "@/components/growth-page-view";
import {
  getResource,
  RESOURCE_UPDATED,
  resourceGuides,
} from "@/lib/resources";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";

export function generateStaticParams() {
  return resourceGuides.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/resources/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = getResource(slug);
  if (!guide) notFound();

  const canonical = `/resources/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical },
    authors: [{ name: "TributeReady Editorial Team", url: "/resources" }],
    category: "Memorial planning",
    openGraph: {
      title: guide.title,
      description: guide.description,
      url: canonical,
      siteName: "TributeReady",
      type: "article",
      publishedTime: RESOURCE_UPDATED,
      modifiedTime: RESOURCE_UPDATED,
      authors: ["TributeReady Editorial Team"],
    },
    twitter: {
      card: "summary_large_image",
      title: guide.title,
      description: guide.description,
    },
  };
}

export default async function ResourcePage({
  params,
}: PageProps<"/resources/[slug]">) {
  const { slug } = await params;
  const guide = getResource(slug);
  if (!guide) notFound();

  const url = `${SITE_URL}/resources/${guide.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.title,
      description: guide.description,
      datePublished: RESOURCE_UPDATED,
      dateModified: RESOURCE_UPDATED,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      author: {
        "@type": "Organization",
        name: "TributeReady Editorial Team",
        url: `${SITE_URL}/resources`,
      },
      publisher: {
        "@type": "Organization",
        name: "TributeReady",
        url: SITE_URL,
      },
      image: `${SITE_URL}/opengraph-image`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Resources",
          item: `${SITE_URL}/resources`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: guide.shortTitle,
          item: url,
        },
      ],
    },
  ];

  return (
    <>
      <GrowthPageView page="resources" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ResourceGuide guide={guide} />
    </>
  );
}
