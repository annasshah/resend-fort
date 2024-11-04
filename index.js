const express = require('express');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Initialize Resend with API key from .env file
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(express.json());

// Endpoint for sending email
app.post('/send-email', async (req, res) => {
    const { from, to, subject, html } = req.body;

    console.log('From address:', from);

    try {
        const data = await resend.emails.send({
            from,
            to: [to],
            subject,
            html
        });

        res.status(200).json({ message: 'Email sent', data });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: error.message });
    }
});

// Webhook endpoint to receive events from Resend
app.post('/webhook', (req, res) => {
    // Log the incoming webhook event for debugging purposes
    console.log('Webhook event received:', req.body);

    // Send a confirmation response back to Resend
    res.status(200).json({ message: 'Webhook received' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
