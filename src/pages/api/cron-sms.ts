import type { APIRoute } from 'astro';

const AIRTABLE_TOKEN = import.meta.env.AIRTABLE_TOKEN;
const SLICKTEXT_API_KEY = import.meta.env.SLICKTEXT_API_KEY;
const SLICKTEXT_USERNAME = import.meta.env.SLICKTEXT_USERNAME;
const CRON_SECRET = import.meta.env.CRON_SECRET;
const AIRTABLE_BASE = 'app0cpbQjtdZh1sHT';
const AIRTABLE_TABLE = 'tbluRGQFHiT1GySGo';

export const GET: APIRoute = async ({ request }) => {
  // Verify this is called by Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Find leads where:
    // - Email was sent 4+ hours ago
    // - Email NOT opened
    // - SMS NOT already sent
    // - Phone number exists
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    const filterFormula = encodeURIComponent(
      `AND(
        NOT({Email Opened}),
        NOT({SMS Sent}),
        {Email Sent At} <= "${fourHoursAgo}",
        {Phone} != ""
      )`
    );

    const searchRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}?filterByFormula=${filterFormula}&fields[]=Contact+Name&fields[]=Phone&fields[]=Email+Sent+At`,
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    );

    if (!searchRes.ok) {
      return new Response('Airtable query failed', { status: 500 });
    }

    const data = await searchRes.json();
    const records = data.records ?? [];

    const results = [];

    for (const record of records) {
      const name = record.fields['Contact Name'] ?? 'there';
      const phone = record.fields['Phone'];
      if (!phone) continue;

      // Clean phone to 10 digits (strip +1, spaces, dashes, parens)
      const cleanPhone = phone.replace(/\D/g, '').replace(/^1/, '');
      if (cleanPhone.length !== 10) continue;

      // Send SMS via SlickText
      const smsRes = await fetch('https://api.slicktext.com/v1/outbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${btoa(`${SLICKTEXT_USERNAME}:${SLICKTEXT_API_KEY}`)}`,
        },
        body: JSON.stringify({
          textword: 'REVAGENTIC',
          number: cleanPhone,
          message: `Hi ${name.split(' ')[0]}, Bill here from RevAgentic. Sent you a diagnostic link a few hours ago — takes 5 min and your revenue report follows same day: https://revagentic.ai/diagnostic`,
        }),
      });

      if (smsRes.ok) {
        // Mark SMS as sent in Airtable
        await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}/${record.id}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${AIRTABLE_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fields: { fldj4AdTDubOULCfn: true }, // SMS Sent
            }),
          }
        );
        results.push({ id: record.id, status: 'sent' });
      } else {
        const err = await smsRes.text();
        console.error(`SlickText error for ${record.id}:`, err);
        results.push({ id: record.id, status: 'failed', error: err });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('cron-sms error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
