// index.js
require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const path = require('path');
const multer = require('multer'); // Middleware for handling file uploads
const pdf = require('pdf-parse'); // For parsing PDF files
const fs = require('fs').promises; // For asynchronous file system operations (e.g., deleting temporary files)
const cors = require('cors'); // Middleware for Cross-Origin Resource Sharing

// Azure REST client for AI Inference
const ModelClient = require('@azure-rest/ai-inference').default;
const { isUnexpected } = require('@azure-rest/ai-inference');
const { AzureKeyCredential } = require('@azure/core-auth');

const app = express();
const port = 3000;

// --- Multer Configuration for File Uploads ---
// Files will be temporarily stored in the 'uploads/' directory.
// This setup ensures the 'uploads' directory exists.
const upload = multer({
    dest: 'uploads/', // Temporary directory for storing uploaded files
    limits: { fileSize: 10 * 1024 * 1024 } // Limit file size to 10MB
});

// --- Azure OpenAI Client Setup ---
// Ensure your .env file has GEMINI_API_KEY set with your Azure OpenAI key.
const endpoint = "https://models.github.ai/inference"; // Your Azure OpenAI endpoint
const client = ModelClient(
    endpoint,
    new AzureKeyCredential(process.env.GEMINI_API_KEY), // Use the API key from environment variables
);

// --- Middleware Setup ---
app.use(cors()); // Enable CORS for all origins (important for local development, restrict in production)
app.use(express.json()); // Parses incoming requests with JSON payloads
app.use(express.static(path.join(__dirname, 'public'))); // Serves static files (like index.html, style.css, script.js) from the 'public' directory

// --- Route for Quiz Generation ---
app.post('/generate-quiz', async (req, res) => {
    const textInput = req.body.textInput;
    // Basic validation for text input
    if (!textInput || textInput.trim() === "") {
        return res.status(400).json({ error: 'Text input is required to generate a quiz.' });
    }

    // Define the prompt structure for the AI model
    const promptContent = `Based on the following text, generate a short quiz with a mix of at least 3-5 questions including Multiple Choice Questions (MCQ), True/False (TF), and Short Answer (SA). Format the output clearly like this:

MCQ: [Question text]
A. [Option 1]
B. [Option 2]
C. [Option 3]
D. [Option 4]
Answer: [Correct option letter, e.g., C]

TF: [Statement]
Answer: [True/False]

SA: [Question text]
Answer: [Short factual answer]

--- Text to create quiz from ---
${textInput}
--- End of Text ---`;

    try {
        // Make the API call to the Azure OpenAI chat completions endpoint
        const response = await client.path('/chat/completions').post({
            body: {
                model: "openai/gpt-4.1", // Specify the model to use
                temperature: 0.7, // Controls randomness: lower for more deterministic, higher for more creative
                top_p: 1, // Controls diversity via nucleus sampling
                messages: [
                    { role: "system", content: "You are a helpful assistant that generates quizzes. Always follow the specified output format for questions." },
                    { role: "user", content: promptContent }
                ]
            }
        });

        // Check for unexpected responses (e.g., HTTP errors) from the AI model
        if (isUnexpected(response)) {
            console.error('Unexpected response from AI model:', response.body);
            // Throw an error to be caught by the catch block below
            throw new Error(`AI model returned an unexpected status: ${response.status} - ${response.body.error ? response.body.error.message : 'Unknown error'}`);
        }

        // Extract the generated quiz text from the AI's response
        const quizText = response.body.choices[0].message.content;
        console.log('Raw AI Response:', quizText); // Log the raw response for debugging
        res.json({ quizText }); // Send the quiz text back to the frontend

    } catch (err) {
        // Handle errors during the AI model call
        console.error('Error calling AI model:', err);
        let errorMessage = 'Failed to generate quiz. An unknown error occurred.';

        if (err.statusCode === 429) {
            // Specific handling for rate limit errors
            errorMessage = 'Rate limit exceeded. Too many requests. Please try again later.';
            res.status(429).json({ error: errorMessage });
        } else if (err.message) {
            // General error message from the thrown error
            errorMessage = 'Failed to generate quiz: ' + err.message;
            res.status(500).json({ error: errorMessage });
        } else {
            // Fallback for unhandled errors
            res.status(500).json({ error: errorMessage });
        }
    }
});

// --- NEW: Route for Document Upload and Text Extraction ---
// 'document' is the field name that the frontend sends the file under (formData.append('document', file))
app.post('/upload-document', upload.single('document'), async (req, res) => {
    console.log("Received file upload request.");
    // Check if a file was actually uploaded
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const filePath = req.file.path; // Path to the temporarily stored file
    const originalname = req.file.originalname; // Original name of the uploaded file
    const fileExtension = originalname.split('.').pop().toLowerCase(); // Extract file extension

    let extractedText = '';

    try {
        // Process PDF files
        if (fileExtension === 'pdf') {
            const dataBuffer = await fs.readFile(filePath); // Read file content into a buffer
            const data = await pdf(dataBuffer); // Parse PDF to extract text
            extractedText = data.text;
            console.log(`Successfully extracted text from PDF: ${originalname}`);
        }
        // Process plain text files
        else if (fileExtension === 'txt') {
            extractedText = await fs.readFile(filePath, 'utf8'); // Read text file content as UTF-8
            console.log(`Successfully read text from TXT: ${originalname}`);
        }
        // Handle unsupported file types
        else {
            await fs.unlink(filePath); // Delete the unsupported temporary file
            return res.status(400).json({ error: 'Unsupported file type. Please upload a .txt or .pdf file.' });
        }

        // Clean up the temporary file after successful processing
        await fs.unlink(filePath);
        console.log(`Temporary file deleted: ${filePath}`);

        // Send the extracted text back to the frontend
        res.json({ textContent: extractedText, fileName: originalname });

    } catch (error) {
        // Handle errors during file processing (e.g., PDF parsing failure)
        console.error('Error processing file:', error);
        // Ensure temporary file is deleted even if processing fails
        try {
            await fs.unlink(filePath);
            console.log(`Temporary file deleted after error: ${filePath}`);
        } catch (unlinkError) {
            console.error('Error deleting temporary file (during error handling):', unlinkError);
        }
        res.status(500).json({ error: 'Failed to process document.' });
    }
});

// --- Start the Server ---
app.listen(port, () => {
    console.log(`AI QuizMaster server running at http://localhost:${port}`);
});
