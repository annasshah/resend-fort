import dotenv from 'dotenv';
dotenv.config();
import { Resend } from 'resend';

// Initialize the Resend client with your API key
const resend = new Resend(process.env.RESEND_API_KEY); // Replace with your actual API key

// Function to send batch emails
async function sendBatchEmails() {
  try {
    const response = await resend.batch.send([
      {
        from: 'Acme <study@notify.clinicsanmiguel.com>',
        to: ['raheelhussainco@gmail.com'], // Add recipients here
        subject: 'hello world',
        html: '<h1>it works!</h1>',
      },
      {
        from: 'Acme <study@notify.clinicsanmiguel.com>',
        to: ['raheelhussaincs@gmail.com'],
        subject: 'world hello',
        html: '<p>it works!</p>',
      },
    ]);

    console.log('Batch email sent successfully:', response);
  } catch (error) {
    console.error('Error sending batch email:', error);
  }
}

// Run the function to send the emails
sendBatchEmails();
