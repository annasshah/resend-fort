import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { Resend } from 'resend';
import { Webhook } from 'svix';

dotenv.config();

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);
const webhookSecret = process.env.WEBHOOK_SECRET;

// Enable CORS for all origins
app.use(cors());

// Store batch email progress in memory
const emailBatches = {}; // e.g., { batchId: { sentCount: 0, deliveredCount: 0, total: 20, emailIds: [] } }

// Middleware to parse JSON and raw request bodies
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Endpoint to send batch emails
app.post('/send-batch-email', async (req, res) => {
  const { from, subject, html, recipients } = req.body;
  if (!from || !subject || !html || !recipients || !recipients.length) {
    return res.status(400).send({ error: 'Missing required fields' });
  }

  const messages = recipients.map((email) => ({
    from,
    to: [email],
    subject,
    html,
  }));
  
  const batchId = Date.now(); // Unique batch ID
  emailBatches[batchId] = {
    sentCount: 0,
    deliveredCount: 0,
    total: recipients.length,
    emailIds: []
  };

  try {
    // Send emails in batch and get a response
    const response = await resend.batch.send(messages);
    console.log('Batch send response:', response);

    // Assuming response includes email IDs, update tracking
    if (Array.isArray(response)) {
      response.forEach((result) => {
        if (result.email_id) {
          emailBatches[batchId].emailIds.push(result.email_id);
          console.log(`Stored email_id ${result.email_id} for batchId ${batchId}`);
        }
      });
    } else {
      console.error('Unexpected response format from resend.batch.send:', response);
    }

    res.status(200).send({ message: 'Batch email sent successfully', batchId });
  } catch (error) {
    console.error('Error sending batch email:', error);
    res.status(500).send({ error: 'Error sending batch email', details: error.message });
  }
});

// Webhook endpoint to receive email events with optional verification
app.post('/webhook', (req, res) => {
  try {
    // Optional: verify webhook signature with svix (only if webhookSecret is provided)
    if (webhookSecret) {
      const wh = new Webhook(webhookSecret);
      const payload = req.body.toString(); // Raw payload as string
      const headers = {
        'svix-id': req.headers['svix-id'],
        'svix-timestamp': req.headers['svix-timestamp'],
        'svix-signature': req.headers['svix-signature']
      };

      // Verify the payload and headers
      try {
        const verifiedEvent = wh.verify(payload, headers);
        console.log('Verified webhook event:', verifiedEvent);
      } catch (error) {
        console.error('Webhook verification failed:', error.message);
        return res.status(400).send({ error: 'Webhook verification failed' });
      }
    }

    // Parse the incoming payload
    const event = JSON.parse(req.body.toString());
    console.log('Received webhook event:', event);

    const { type, data } = event;

    if (!data || !data.email_id) {
      console.error('Missing email_id in webhook data');
      return res.status(400).send({ error: 'Invalid payload: Missing email_id' });
    }

    // Find the batch that includes this email_id
    const batchId = Object.keys(emailBatches).find((id) =>
      emailBatches[id].emailIds.includes(data.email_id)
    );

    if (!batchId) {
      console.error('Batch not found for email_id:', data.email_id);
      return res.status(404).send({ error: 'Batch not found for this email' });
    }

    const batch = emailBatches[batchId];

    // Update batch counts based on the event type
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

    // Calculate progress and log it
    const sentPercentage = (batch.sentCount / batch.total) * 100;
    const deliveredPercentage = (batch.deliveredCount / batch.total) * 100;

    console.log(`Progress - Sent: ${batch.sentCount}/${batch.total} (${sentPercentage.toFixed(2)}%)`);
    console.log(`Progress - Delivered: ${batch.deliveredCount}/${batch.total} (${deliveredPercentage.toFixed(2)}%)`);

    res.status(200).send({ message: 'Webhook received successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error.message);
    res.status(400).send({ error: 'Error processing webhook', details: error.message });
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

// Start the server
const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
