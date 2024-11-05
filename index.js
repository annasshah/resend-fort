import dotenv from 'dotenv';
import express from 'express';
import { Resend } from 'resend';

// Load environment variables from .env file
dotenv.config();

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(express.json());

// Endpoint to send batch emails
app.post('/send-batch-email', async (req, res) => {
  const { from, subject, html, recipients } = req.body; // Accept 'from', 'subject', 'html', and 'recipients' list

  // Construct messages array for each recipient
  const messages = recipients.map((email) => ({
    from,
    to: [email],
    subject,
    html,
  }));

  try {
    const response = await resend.batch.send(messages);
    res.status(200).send({ message: 'Batch email sent successfully', response });
  } catch (error) {
    res.status(500).send({ error: 'Error sending batch email', details: error.message });
  }
});

// Define the port (defaults to 3000)
const PORT = process.env.PORT || 80;

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
