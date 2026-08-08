import type { MetadataRoute } from "next";
import { eulogyTemplates } from "@/lib/eulogy-templates";
import {
  obituaryTemplates,
  TEMPLATE_UPDATED,
} from "@/lib/obituary-templates";
import { orderOfServiceTemplates } from "@/lib/order-of-service-templates";
import { RESOURCE_UPDATED, resourceGuides } from "@/lib/resources";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";
  const coreRoutes: MetadataRoute.Sitemap = [
    {
      url: origin,
      lastModified: RESOURCE_UPDATED,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${origin}/funeral-program-maker`,
      lastModified: RESOURCE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${origin}/obituary-writer`,
      lastModified: RESOURCE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${origin}/celebration-of-life-program`,
      lastModified: RESOURCE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${origin}/resources`,
      lastModified: RESOURCE_UPDATED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/obituary-templates`,
      lastModified: TEMPLATE_UPDATED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/order-of-service-templates`,
      lastModified: TEMPLATE_UPDATED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/eulogy-examples`,
      lastModified: TEMPLATE_UPDATED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/funeral-program-template-word`,
      lastModified: TEMPLATE_UPDATED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/funeral-pamphlet-template`,
      lastModified: TEMPLATE_UPDATED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/funeral-program-google-docs`,
      lastModified: TEMPLATE_UPDATED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/where-to-print-funeral-programs`,
      lastModified: TEMPLATE_UPDATED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/funeral-program-cost`,
      lastModified: TEMPLATE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${origin}/funeral-program-examples`,
      lastModified: TEMPLATE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${origin}/funeral-readings`,
      lastModified: TEMPLATE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${origin}/funeral-poem-copyright`,
      lastModified: TEMPLATE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${origin}/partners`,
      lastModified: RESOURCE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${origin}/privacy`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${origin}/terms`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  const resourceRoutes: MetadataRoute.Sitemap = resourceGuides.map(
    (resource) => ({
      url: `${origin}/resources/${resource.slug}`,
      lastModified: RESOURCE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    }),
  );

  const obituaryTemplateRoutes: MetadataRoute.Sitemap = obituaryTemplates.map(
    (template) => ({
      url: `${origin}/obituary-templates/${template.slug}`,
      lastModified: TEMPLATE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    }),
  );

  const serviceTemplateRoutes: MetadataRoute.Sitemap =
    orderOfServiceTemplates.map((template) => ({
      url: `${origin}/order-of-service-templates/${template.slug}`,
      lastModified: TEMPLATE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    }));

  const eulogyRoutes: MetadataRoute.Sitemap = eulogyTemplates.map(
    (template) => ({
      url: `${origin}/eulogy-examples/${template.slug}`,
      lastModified: TEMPLATE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    }),
  );

  // Word and PDF downloads rank in their own right, so they are listed too.
  const downloadRoutes: MetadataRoute.Sitemap = [
    `${origin}/api/word/bifold-funeral-program`,
    `${origin}/api/word/single-sheet-order-of-service`,
    `${origin}/api/printable/obituary-worksheet`,
    `${origin}/api/printable/funeral-program-planner`,
    ...orderOfServiceTemplates.map(
      (template) => `${origin}/api/word/order-of-service/${template.slug}`,
    ),
  ].map((url) => ({
    url,
    lastModified: TEMPLATE_UPDATED,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    ...coreRoutes,
    ...resourceRoutes,
    ...obituaryTemplateRoutes,
    ...serviceTemplateRoutes,
    ...eulogyRoutes,
    ...downloadRoutes,
  ];
}
