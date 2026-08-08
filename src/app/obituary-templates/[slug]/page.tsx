import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GrowthPageView } from "@/components/growth-page-view";
import { ObituaryTemplatePage } from "@/components/obituary-template-page";
import {
  getObituaryTemplate,
  obituaryTemplates,
  TEMPLATE_UPDATED,
} from "@/lib/obituary-templates";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";

export function generateStaticParams() {
  return obituaryTemplates.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/obituary-templates/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const template = getObituaryTemplate(slug);
  if (!template) notFound();

  const canonical = `/obituary-templates/${template.slug}`;
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
      authors: ["TributeReady Editorial Team"],
    },
    twitter: {
      card: "summary_large_image",
      title: template.title,
      description: template.description,
    },
  };
}

export default async function ObituaryTemplateRoute({
  params,
}: PageProps<"/obituary-templates/[slug]">) {
  const { slug } = await params;
  const template = getObituaryTemplate(slug);
  if (!template) notFound();

  const url = `${SITE_URL}/obituary-templates/${template.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: template.title,
      description: template.description,
      datePublished: TEMPLATE_UPDATED,
      dateModified: TEMPLATE_UPDATED,
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
      isAccessibleForFree: true,
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: `How to write an obituary for a ${template.relationship}`,
      description: template.description,
      totalTime: "PT45M",
      step: [
        {
          "@type": "HowToStep",
          name: "Gather the facts",
          text: template.include.join("; "),
        },
        {
          "@type": "HowToStep",
          name: "Fill in the template",
          text: template.fillIn.join(" "),
        },
        {
          "@type": "HowToStep",
          name: "Check the wording",
          text: template.wording.lines.join(" "),
        },
        {
          "@type": "HowToStep",
          name: "Review before publishing",
          text: template.pitfalls.join("; "),
        },
      ],
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
          name: "Obituary templates",
          item: `${SITE_URL}/obituary-templates`,
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
      <GrowthPageView page="obituary_templates" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ObituaryTemplatePage template={template} />
    </>
  );
}
