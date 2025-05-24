// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = 3000;

// Initialize Gemini Generative AI client
// Make sure your .env file has GEMINI_API_KEY=YOUR_API_KEY
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// New route for AI quiz generation
app.post('/generate-quiz', async (req, res) => {
    const textInput = req.body.textInput;

    if (!textInput) {
        return res.status(400).json({ error: 'Text input is required.' });
    }

    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set in the .env file.');
        return res.status(500).json({ error: 'Server configuration error: API key missing.' });
    }

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        // This is the updated and detailed prompt for Gemini
        const prompt = `You are a helpful assistant that generates quizzes.
For Multiple Choice Questions (MCQ), format as:
MCQ: [Question Text]
A. [Option A]
B. [Option B]
C. [Option C]
D. [Option D]
Answer: [Correct Letter (A, B, C, D)]

For True/False Questions (TF), format as:
TF: [Statement]
Answer: [True/False]

For Short Answer Questions (SA), format as:
SA: [Question Text]
Answer: [Expected Answer]

Separate each question block with exactly two newline characters (i.e., press Enter twice).

Now, generate 2 Multiple Choice Questions, 1 True/False question, and 1 Short Answer question from the following text:

Text:
${textInput}

Quiz:`; // END OF PROMPT STRING

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const quizText = response.text();

        console.log('Raw AI Response (Gemini):', quizText);

        res.json({ quizText: quizText });

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        // Check for specific error details from Gemini
        if (error.response && error.response.status === 429) {
            res.status(429).json({ error: 'Gemini API Quota Exceeded. Please check your Google AI Studio billing/usage.' });
        } else {
            res.status(500).json({ error: 'Failed to generate quiz: ' + error.message });
        }
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});