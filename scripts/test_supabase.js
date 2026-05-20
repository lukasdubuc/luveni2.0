import { createClient } from '@supabase/supabase-js';

(async () => {
  try {
    const fs = await import('fs');
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    // Try to load from .env if keys missing
    if ((!url || !serviceKey) && fs.existsSync('.env')) {
      const envRaw = fs.readFileSync('.env', 'utf8');
      envRaw.split(/\n+/).forEach(line => {
        const m = line.match(/^\s*([^=]+)=(.*)$/);
        if (m) {
          const k = m[1].trim();
          let v = m[2].trim();
          v = v.replace(/^"|"$/g, '');
          if (!process.env[k]) process.env[k] = v;
        }
      });
    }

    const finalUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    serviceKey = serviceKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const urlToUse = finalUrl;

    if (!urlToUse || !serviceKey) {
      console.error('Missing SUPABASE_URL or key in environment.');
      process.exit(2);
    }

    const supabase = createClient(urlToUse, serviceKey, { auth: { persistSession: false } });

    console.log('Inserting test product...');
    const slug = 'test-product-' + Date.now();
    const prod = {
      title: 'Automated Test Product',
      slug,
      description: 'Created by automated test script',
      price_cents: 1999,
      currency: 'usd',
      image_urls: ['https://via.placeholder.com/300'],
      is_published: false,
    };

    const insertRes = await supabase.from('products').insert([prod]).select('*').single();
    if (insertRes.error) {
      console.error('Insert error:', insertRes.error.message || insertRes.error);
      process.exit(3);
    }
    console.log('Insert succeeded:', insertRes.data.id);

    console.log('Fetching product...');
    const fetchRes = await supabase.from('products').select('*').eq('id', insertRes.data.id).single();
    if (fetchRes.error) {
      console.error('Fetch error:', fetchRes.error.message || fetchRes.error);
      process.exit(4);
    }
    console.log('Fetched product title:', fetchRes.data.title);
    console.log('Image URLs:', fetchRes.data.image_urls);

    console.log('Upserting site_config test change...');
    const siteUpsert = {
      id: 'main',
      hero_headline: 'Automated test headline ' + Date.now(),
      hero_subheadline: 'Automated subheadline',
      hero_cta: 'Test CTA',
      price_display: '$19',
      price_original: '$29',
      launch_pricing_active: false,
      guarantee_days: '14',
    };

    const upsertRes = await supabase.from('site_config').upsert([siteUpsert]);
    if (upsertRes.error) {
      console.error('Site upsert error:', upsertRes.error.message || upsertRes.error);
      process.exit(5);
    }
    console.log('Site upsert succeeded.');

    const siteFetch = await supabase.from('site_config').select('*').maybeSingle();
    if (siteFetch.error) {
      console.error('Site fetch error:', siteFetch.error.message || siteFetch.error);
      process.exit(6);
    }
    console.log('Site config headline:', siteFetch.data?.hero_headline);

    console.log('All tests completed successfully.');
    process.exit(0);
  } catch (e) {
    console.error('Unexpected error:', e.message || e);
    process.exit(99);
  }
})();
