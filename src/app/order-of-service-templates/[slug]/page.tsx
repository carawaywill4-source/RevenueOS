import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GrowthPageView } from "@/components/growth-page-view";
import { OrderOfServicePage } from "@/components/order-of-service-page";
import { TEMPLATE_UPDATED } from "@/lib/obituary-templates";
import {
  getOrderOfServiceTemplate,
  orderOfServiceTemplates,
} from "@/lib/order-of-service-templates";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";

export function generateStaticParams() {
  return orderOfServiceTemplates.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/order-of-service-templates/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const template = getOrderOfServiceTemplate(slug);
  if (!template) notFound();

  const canonical = `/order-of-service-templates/${template.slug}`;
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

export default async function OrderOfServiceRoute({
  params,
}: PageProps<"/order-of-service-templates/[slug]">) {
  const { slug } = await params;
  const template = getOrderOfServiceTemplate(slug);
  if (!template) notFound();

  const url = `${SITE_URL}/order-of-service-templates/${template.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: template.title,
      description: template.description,
      isAccessibleForFree: true,
      datePublished: TEMPLATE_UPDATED,
      dateModified: TEMPLATE_UPDATED,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      publisher: {
        "@type": "Organization",
        name: "TributeReady",
        url: SITE_URL,
      },
      step: template.steps.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.name,
        text: step.detail,
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
          name: "Order of service templates",
          item: `${SITE_URL}/order-of-service-templates`,
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
      <GrowthPageView page="order_of_service_templates" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <OrderOfServicePage template={template} />
    </>
  );
}
