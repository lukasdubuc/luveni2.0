// Single source of truth for brand + offer copy.
// Swap these to re-skin the site for any niche — no other files need changes.

export const site = {
  brand: "Northwind",
  tagline: "A simple, modern way to get the result you actually want.",
  domain: "example.com",
  supportEmail: "hello@example.com",
  social: {
    twitter: "https://twitter.com/",
    instagram: "https://instagram.com/",
  },
};

export const offer = {
  name: "The Starter Package",
  shortPitch:
    "Everything you need to get started in one focused, no-fluff package.",
  // Display price (string). Real charge amount is in priceCents.
  price: "$49",
  priceCents: 4900,
  currency: "usd",
  originalPrice: "$129",
  badge: "Limited launch pricing",
  guarantee: "30-day money-back guarantee. No questions asked.",
  bullets: [
    "Instant digital delivery — access immediately after checkout",
    "Step-by-step onboarding so you never feel stuck",
    "Lifetime updates included with your purchase",
    "Friendly human support, usually replies within 24 hours",
  ],
};

export const benefits = [
  {
    title: "Built to actually ship",
    body: "Skip the analysis paralysis. Get a clear path from zero to result without 40 hours of research.",
  },
  {
    title: "Designed for real people",
    body: "No jargon, no fluff. Plain language, clear steps, and templates you can copy in minutes.",
  },
  {
    title: "Risk-free to try",
    body: "If it isn't right for you, we'll refund you within 30 days. You keep what you've learned.",
  },
];

export const testimonials = [
  {
    quote:
      "Honestly the clearest thing I've bought all year. I finished it in a weekend and got my first result the next week.",
    name: "Alex Rivera",
    role: "Early customer",
  },
  {
    quote:
      "I was skeptical, but the structure and the templates alone were worth more than the price. Easy recommend.",
    name: "Jordan Lee",
    role: "Early customer",
  },
  {
    quote:
      "Felt like having a coach in my pocket. No filler. Just the parts that actually move the needle.",
    name: "Sam Patel",
    role: "Early customer",
  },
];

export const faqs = [
  {
    q: "How do I get access after purchase?",
    a: "You'll receive an instant confirmation email with your access link. Most customers are inside within 60 seconds.",
  },
  {
    q: "What's your refund policy?",
    a: "Try it for 30 days. If it isn't for you, email us and we'll refund every cent — no forms, no questions.",
  },
  {
    q: "Is this a subscription?",
    a: "No. It's a one-time payment. You get lifetime access and all future updates included.",
  },
  {
    q: "Do you offer team or bulk pricing?",
    a: "Yes. Reach out via the contact page and we'll send over a custom quote.",
  },
  {
    q: "What if I need help?",
    a: "Email support is included. We typically reply within 24 hours, often much faster.",
  },
];
