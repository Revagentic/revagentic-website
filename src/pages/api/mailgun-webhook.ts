import type { APIRoute } from 'astro';
import { createHmac } from 'crypto';

const MAILGUN_WEBHOOK_SIGNING_KEY = import.meta.env.MAILGUN_WEBHOOK_SIGNING_KEY;
const AIRTABLE_TOKEN = import.meta.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE = 'app0cpbQjtdZh1sHT';
const AIRTABLE_TABLE = 'tbluRGQFHiT1GySGo';

function verifyMailgunSignature(
  timestamp: string,
  token: string,
  signature: string
): boolean {
  const value = timestamp + token;
  const hmac = createHmac('sha256', MAILGUN_WEBHOOK_SIGNING_KEY)
    .update(value)
    .digest('hex');
  return hmac === signature;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { signature, 'event-data': eventData } = body;

    // Verify Mailgun signature
    if (
      MAILGUN_WEBHOOK_SIGNING_KEY &&
      !verifyMailgunSignature(
        signature?.timestamp,
        signature?.token,
        signature?.signature
      )
    ) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (eventData?.event !== 'opened') {
      return new Response('OK', { status: 200 });
    }

    const recipientEmail = eventData?.recipient;
    if (!recipientEmail) {
      return new Response('OK', { status: 200 });
    }

    // Find the Airtable record by email
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}?filterByFormula=${encodeURIComponent(`{Email}="${recipientEmail}"`)}&&sort[0][field]=Email+Sent+At&sort[0][direction]=desc&maxRecords=1`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    if (!searchRes.ok) return new Response('OK', { status: 200 });

    const searchData = await searchRes.json();
    const record = searchData.records?.[0];
    if (!record) return new Response('OK', { status: 200 });

    // Mark as opened
    await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}/${record.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: { fldmcWFdWHZJ8TR9E: true }, // Email Opened
        }),
      }
    );

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('mailgun-webhook error:', err);
    return new Response('OK', { status: 200 }); // Always 200 to Mailgun
  }
};
