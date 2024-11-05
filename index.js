import dotenv from 'dotenv';
import express from 'express';
import { Resend } from 'resend';
import { Webhook } from 'svix';

dotenv.config();

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);
const webhookSecret = process.env.WEBHOOK_SECRET;

// Store batch email progress in memory for simplicity
const emailBatches = {}; // e.g., { batchId: { sentCount: 0, deliveredCount: 0, total: 20 } }

// Middleware to parse raw request body for webhook verification
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Endpoint to send batch emails
app.post('/send-batch-email', async (req, res) => {
  const { from, subject, html, recipients } = req.body;
  const messages = recipients.map((email) => ({
    from,
    to: [email],
    subject,
    html,
  }));
  
  // Initialize batch tracking
  const batchId = Date.now(); // Unique batch ID
  emailBatches[batchId] = {
    sentCount: 0,
    deliveredCount: 0,
    total: recipients.length,
  };

  try {
    await resend.batch.send(messages);
    res.status(200).send({ message: 'Batch email sent successfully', batchId });
  } catch (error) {
    res.status(500).send({ error: 'Error sending batch email', details: error.message });
  }
});

// Webhook endpoint to receive email events
app.post('/webhook', (req, res) => {
  try {
    const wh = new Webhook(webhookSecret);
    const payload = wh.verify(req.body.toString(), req.headers); // Verify signature

    const event = JSON.parse(payload);
    const { type, data } = event;

    // Determine which batch this email belongs to (assuming email_id is unique per batch)
    const batchId = Object.keys(emailBatches).find((id) => emailBatches[id].total > 0);
    if (!batchId) return res.status(404).send({ error: 'Batch not found' });

    const batch = emailBatches[batchId];

    switch (type) {
      case 'email.sent':
        batch.sentCount++;
        break;
      case 'email.delivered':
        batch.deliveredCount++;
        break;
      default:
        console.log(`Unhandled event type: ${type}`);
    }

    // Calculate progress
    const sentPercentage = (batch.sentCount / batch.total) * 100;
    const deliveredPercentage = (batch.deliveredCount / batch.total) * 100;

    console.log(`Progress - Sent: ${batch.sentCount}/${batch.total} (${sentPercentage.toFixed(2)}%)`);
    console.log(`Progress - Delivered: ${batch.deliveredCount}/${batch.total} (${deliveredPercentage.toFixed(2)}%)`);

    res.status(200).send({ message: 'Webhook received successfully' });
  } catch (error) {
    console.error('Webhook verification failed:', error.message);
    res.status(400).send({ error: 'Webhook verification failed' });
  }
});

// API endpoint to fetch current progress for a batch
app.get('/batch-progress/:batchId', (req, res) => {
  const { batchId } = req.params;
  const batch = emailBatches[batchId];
  
  if (!batch) {
    return res.status(404).send({ error: 'Batch not found' });
  }

  const sentPercentage = (batch.sentCount / batch.total) * 100;
  const deliveredPercentage = (batch.deliveredCount / batch.total) * 100;

  res.status(200).send({
    sentProgress: `${batch.sentCount}/${batch.total} (${sentPercentage.toFixed(2)}%)`,
    deliveredProgress: `${batch.deliveredCount}/${batch.total} (${deliveredPercentage.toFixed(2)}%)`,
  });
});

// Define the port (defaults to 3000)
const PORT = process.env.PORT || 80;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
