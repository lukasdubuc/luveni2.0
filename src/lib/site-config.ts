import { benefits as features, faqs, offer, site, testimonials } from "@/config/site";

export type FeatureItem = {
  title: string;
  body: string;
};

export type TestimonialItem = {
  quote: string;
  name: string;
  role: string;
};

export type FAQItem = {
  q: string;
  a: string;
};

export type SiteConfigMetadata = {
  features: FeatureItem[];
  testimonials: TestimonialItem[];
  faqs: FAQItem[];
  newsletter_title: string;
  newsletter_subtitle: string;
  newsletter_button_text: string;
  footer_description: string;
};

export type SiteConfig = {
  hero_headline: string;
  hero_subheadline: string;
  hero_cta: string;
  price_display: string;
  price_original: string;
  launch_pricing_active: boolean;
  guarantee_days: string;
  metadata: SiteConfigMetadata;
  id?: string;
  updated_at?: string;
};

export const SITE_CONFIG_METADATA_FALLBACK: SiteConfigMetadata = {
  features,
  testimonials,
  faqs,
  newsletter_title: "Not ready to buy? Get updates.",
  newsletter_subtitle: "One email when there's something genuinely worth your time.",
  newsletter_button_text: "Notify me",
  footer_description: `© ${new Date().getFullYear()} ${site.brand}. All rights reserved.`,
};

export const SITE_CONFIG_FALLBACK: SiteConfig = {
  hero_headline: site.tagline,
  hero_subheadline: offer.shortPitch,
  hero_cta: `Get instant access — ${offer.price}`,
  price_display: offer.price,
  price_original: offer.originalPrice,
  launch_pricing_active: true,
  guarantee_days: "30",
  metadata: SITE_CONFIG_METADATA_FALLBACK,
};

export function mergeSiteConfig(data: Partial<SiteConfig> & { metadata?: Partial<SiteConfigMetadata> | null }): SiteConfig {
  const rawMetadata: Partial<SiteConfigMetadata> = (data.metadata && typeof data.metadata === "object" ? data.metadata : {}) as Partial<SiteConfigMetadata>;
  const metadata: SiteConfigMetadata = {
    ...SITE_CONFIG_METADATA_FALLBACK,
    ...rawMetadata,
    features: Array.isArray(rawMetadata.features)
      ? rawMetadata.features.map((feature, index) => ({
          ...SITE_CONFIG_METADATA_FALLBACK.features[index],
          ...feature,
        }))
      : SITE_CONFIG_METADATA_FALLBACK.features,
    testimonials: Array.isArray(rawMetadata.testimonials)
      ? rawMetadata.testimonials.map((testimonial, index) => ({
          ...SITE_CONFIG_METADATA_FALLBACK.testimonials[index],
          ...testimonial,
        }))
      : SITE_CONFIG_METADATA_FALLBACK.testimonials,
    faqs: Array.isArray(rawMetadata.faqs)
      ? rawMetadata.faqs.map((faq, index) => ({
          ...SITE_CONFIG_METADATA_FALLBACK.faqs[index],
          ...faq,
        }))
      : SITE_CONFIG_METADATA_FALLBACK.faqs,
  };

  return {
    ...SITE_CONFIG_FALLBACK,
    ...data,
    metadata,
  };
}
