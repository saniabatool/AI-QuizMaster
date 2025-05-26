// index.js
require('dotenv').config();

const express = require('express');
const path = require('path');

// ▼ Replace GoogleGenerativeAI with the Azure REST client:
const ModelClient = require('@azure-rest/ai-inference').default;
const { isUnexpected } = require('@azure-rest/ai-inference');
const { AzureKeyCredential } = require('@azure/core-auth');

const app = express();
const port = 3000;

// ▼ Use your existing env var name for the Azure key:
const endpoint = "https://models.github.ai/inference";
const client = ModelClient(
  endpoint,
  new AzureKeyCredential(process.env.GEMINI_API_KEY),
);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/generate-quiz', async (req, res) => {
  const textInput = req.body.textInput;
  if (!textInput) return res.status(400).json({ error: 'Text input is required.' });

  try {
    // ▼ Build your chat completion call:
    const response = await client.path('/chat/completions').post({
      body: {
        model: "openai/gpt-4.1",
        temperature: 1,
        top_p: 1,
        messages: [
          { role: "system", content: "You are a helpful assistant that generates quizzes." },
          { role: "user",   content:
            `For Multiple Choice Questions (MCQ), format as:
MCQ: [Question Text]
A. [Option A]
B. [Option B]
C. [Option C]
D. [Option D]
Answer: [Correct Letter]

For True/False (TF):
TF: [Statement]
Answer: [True/False]

For Short Answer (SA):
SA: [Question]
Answer: [Expected Answer]

Now generate 2 MCQs, 1 TF, 1 SA from:

${textInput}`
          }
        ]
      }
    });

    if (isUnexpected(response)) {
      throw response.body.error;
    }

    // ▼ Extract the generated text:
    const quizText = response.body.choices[0].message.content;
    console.log('Raw AI Response:', quizText);
    res.json({ quizText });

  } catch (err) {
    console.error('Error calling AI model:', err);
    if (err.statusCode === 429) {
      res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
    } else {
      res.status(500).json({ error: 'Failed to generate quiz: ' + err.message });
    }
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
