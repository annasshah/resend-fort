const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(express.json());

// Endpoint for sending email
app.post('/send-email', async (req, res) => {
    const { to, subject, text } = req.body;

    try {
        const response = await axios.post('https://api.resend.com/emails', {
            from: 'test@notify.clinicsanmiguel.com',  // Replace with a verified 'from' email address
            to,
            subject,
            text
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        res.status(200).json({ message: 'Email sent', response: response.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
