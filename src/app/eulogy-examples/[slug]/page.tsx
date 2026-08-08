import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EulogyPage } from "@/components/eulogy-page";
import { GrowthPageView } from "@/components/growth-page-view";
import {
  EULOGY_STRUCTURE,
  eulogyTemplates,
  getEulogyTemplate,
} from "@/lib/eulogy-templates";
import { TEMPLATE_UPDATED } from "@/lib/obituary-templates";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";

export function generateStaticParams() {
  return eulogyTemplates.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/eulogy-examples/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const template = getEulogyTemplate(slug);
  if (!template) notFound();

  const canonical = `/eulogy-examples/${template.slug}`;
  return {
    title: template.title,
    description: template.description,
    alternates: { canonical },
    authors: [{ name: "TributeReady Editorial Team", url: "/resources" }],
    category: "Memorial planning",
    openGraph: {
      title: template.title,
      description: template.description,
      url: canonical,
      siteName: "TributeReady",
      type: "article",
      publishedTime: TEMPLATE_UPDATED,
      modifiedTime: TEMPLATE_UPDATED,
    },
    twitter: {
      card: "summary_large_image",
      title: template.title,
      description: template.description,
    },
  };
}

export default async function EulogyRoute({
  params,
}: PageProps<"/eulogy-examples/[slug]">) {
  const { slug } = await params;
  const template = getEulogyTemplate(slug);
  if (!template) notFound();

  const url = `${SITE_URL}/eulogy-examples/${template.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: `How to write a eulogy for a ${template.relationship}`,
      description: template.description,
      isAccessibleForFree: true,
      totalTime: "PT2H",
      datePublished: TEMPLATE_UPDATED,
      dateModified: TEMPLATE_UPDATED,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      publisher: {
        "@type": "Organization",
        name: "TributeReady",
        url: SITE_URL,
      },
      step: EULOGY_STRUCTURE.map((part, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: part.part,
        text: part.detail,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: template.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: "Eulogy examples",
          item: `${SITE_URL}/eulogy-examples`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: template.shortTitle,
          item: url,
        },
      ],
    },
  ];

  return (
    <>
      <GrowthPageView page="eulogy_examples" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <EulogyPage template={template} />
    </>
  );
}
