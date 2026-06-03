export const sendDiscordAlert = async (
  orderId: string,
  totalCents: number,
  email: string
) => {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title: "💰 New Order",
        color: 0x1a1a1a,
        fields: [
          { name: "Order ID", value: `\`${orderId}\``, inline: true },
          { name: "Total", value: `**$${(totalCents / 100).toFixed(2)}**`, inline: true },
          { name: "Customer", value: email, inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "Luveni · New Order" },
      }],
    }),
  });
};

export const sendReceiptEmail = async (
  orderId: string,
  email: string,
  totalCents: number
) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Luveni Orders <orders@luveni.com>",
      to: process.env.BUSINESS_EMAIL,
      subject: `New Order — $${(totalCents / 100).toFixed(2)}`,
      html: `
        <div style="font-family:monospace;max-width:480px;margin:0 auto;padding:32px;color:#111">
          <h2 style="font-size:14px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:24px">New Order Received</h2>
          <table style="width:100%;font-size:13px;border-collapse:collapse">
            <tr><td style="padding:8px 0;opacity:0.5;width:40%">ORDER ID</td><td>${orderId}</td></tr>
            <tr><td style="padding:8px 0;opacity:0.5">CUSTOMER</td><td>${email}</td></tr>
            <tr><td style="padding:8px 0;opacity:0.5">TOTAL</td><td style="font-weight:bold">$${(totalCents / 100).toFixed(2)}</td></tr>
            <tr><td style="padding:8px 0;opacity:0.5">TIME</td><td>${new Date().toLocaleString()}</td></tr>
          </table>
          <p style="margin-top:32px;font-size:12px;opacity:0.4">Luveni · Automated Order Notification</p>
        </div>
      `,
    }),
  });
};
