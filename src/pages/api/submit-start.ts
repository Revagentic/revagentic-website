import type { APIRoute } from 'astro';

const AIRTABLE_TOKEN = import.meta.env.AIRTABLE_TOKEN;
const MAILGUN_API_KEY = import.meta.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = import.meta.env.MAILGUN_DOMAIN;
const AIRTABLE_BASE = 'app0cpbQjtdZh1sHT';
const AIRTABLE_TABLE = 'tbluRGQFHiT1GySGo';

// Map the radio-button label to a midpoint number for the Airtable "Active Members" number field
const MEMBERS_MAP: Record<string, number> = {
  'Under 100': 50,
  '100-300': 200,
  '300-750': 525,
  '750-2000': 1375,
  '2000+': 2500,
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, email, phone, biz, members } = body;

    if (!name || !email || !biz) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const membersNum = members ? MEMBERS_MAP[members] ?? null : null;

    // 1. Save to Airtable
    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            fldGGKln510zIwbEL: name,
            fldI5kNvXERLJvdRj: email,
            ...(phone && { fld6fcrl4c8oSboZE: phone }),
            fld5DKwy8AIyOIruA: biz,
            ...(membersNum && { fldWvDe5TH8LYlXTf: membersNum }),
            fldwMJ5TAWxZkNOjG: today,
            fldw1Dq3xXG9Vhv8O: now,       // Email Sent At
            fldLbfPrtzq9UjnK4: 'New',      // Lead Status
          },
        }),
      }
    );

    if (!airtableRes.ok) {
      const err = await airtableRes.text();
      console.error('Airtable error:', err);
      return new Response(JSON.stringify({ error: 'Airtable save failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const airtableData = await airtableRes.json();
    const recordId = airtableData.id;

    // 2. Send Mailgun email with open tracking
    const emailBody = new URLSearchParams({
      from: 'Bill @ RevAgentic <bill@revagentic.ai>',
      to: email,
      subject: 'Your Revenue System Diagnostic is ready',
      'o:tracking': 'yes',
      'o:tracking-opens': 'yes',
      'h:X-Record-Id': recordId,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;color:#0a1628;">
          <p style="font-size:16px;">Hi ${name},</p>
          <p style="font-size:15px;line-height:1.7;color:#64748b;">
            Your Revenue System Diagnostic is ready. It takes about 5 minutes and gives us
            everything we need to build your personalized revenue report.
          </p>
          <p style="text-align:center;margin:32px 0;">
            <a href="https://revagentic.ai/diagnostic"
               style="background:#6d28d9;color:#fff;font-weight:700;font-size:15px;
                      padding:14px 32px;border-radius:8px;text-decoration:none;
                      display:inline-block;">
              Start your diagnostic →
            </a>
          </p>
          <p style="font-size:14px;color:#94a3b8;line-height:1.7;">
            We'll have your personalized revenue report back to you within 15–30 minutes
            of completion. Questions? Just reply to this email.
          </p>
          <p style="font-size:14px;color:#64748b;margin-top:32px;">
            — Bill<br>
            <span style="color:#94a3b8;">RevAgentic · revagentic.ai</span>
          </p>
        </div>
      `,
      text: `Hi ${name},\n\nYour Revenue System Diagnostic is ready — it takes about 5 minutes and gives us everything we need to build your personalized revenue report.\n\nStart here: https://revagentic.ai/diagnostic\n\nWe'll have your report back to you within 15–30 minutes of completion.\n\n— Bill\nRevAgentic`,
    });

    const mailgunRes = await fetch(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
        },
        body: emailBody,
      }
    );

    if (!mailgunRes.ok) {
      const err = await mailgunRes.text();
      console.error('Mailgun error:', err);
      // Don't fail the whole request — lead is saved, email failed
    } else {
      // Update Airtable: mark as Diagnostic Link Sent
      await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}/${recordId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: { fldLbfPrtzq9UjnK4: 'Diagnostic Link Sent' },
          }),
        }
      );
    }

    return new Response(JSON.stringify({ success: true, recordId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('submit-start error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
