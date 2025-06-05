
require('dotenv').config(); 

const express = require('express');
const path = require('path');
const multer = require('multer'); 
const pdf = require('pdf-parse'); 
const fs = require('fs').promises; 
const cors = require('cors'); 


const ModelClient = require('@azure-rest/ai-inference').default;
const { isUnexpected } = require('@azure-rest/ai-inference');
const { AzureKeyCredential } = require('@azure/core-auth');

const app = express();
const port = 3000;


const upload = multer({
    dest: 'uploads/', 
    limits: { fileSize: 10 * 1024 * 1024 } 
});


const endpoint = "https://models.github.ai/inference";
const client = ModelClient(
    endpoint,
    new AzureKeyCredential(process.env.GEMINI_API_KEY), 
);


app.use(cors()); 
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); 

app.post('/generate-quiz', async (req, res) => {
    const textInput = req.body.textInput;
    
    if (!textInput || textInput.trim() === "") {
        return res.status(400).json({ error: 'Text input is required to generate a quiz.' });
    }

    
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
       
        const response = await client.path('/chat/completions').post({
            body: {
                model: "openai/gpt-4.1",
                temperature: 0.7, 
                top_p: 1, 
                messages: [
                    { role: "system", content: "You are a helpful assistant that generates quizzes. Always follow the specified output format for questions." },
                    { role: "user", content: promptContent }
                ]
            }
        });

        
        if (isUnexpected(response)) {
            console.error('Unexpected response from AI model:', response.body);
            
            throw new Error(`AI model returned an unexpected status: ${response.status} - ${response.body.error ? response.body.error.message : 'Unknown error'}`);
        }

        
        const quizText = response.body.choices[0].message.content;
        console.log('Raw AI Response:', quizText); 
        res.json({ quizText }); 

    } catch (err) {
        
        console.error('Error calling AI model:', err);
        let errorMessage = 'Failed to generate quiz. An unknown error occurred.';

        if (err.statusCode === 429) {
            
            errorMessage = 'Rate limit exceeded. Too many requests. Please try again later.';
            res.status(429).json({ error: errorMessage });
        } else if (err.message) {
           
            errorMessage = 'Failed to generate quiz: ' + err.message;
            res.status(500).json({ error: errorMessage });
        } else {
          
            res.status(500).json({ error: errorMessage });
        }
    }
});


app.post('/upload-document', upload.single('document'), async (req, res) => {
    console.log("Received file upload request.");
   
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const filePath = req.file.path; 
    const originalname = req.file.originalname; 
    const fileExtension = originalname.split('.').pop().toLowerCase(); 

    let extractedText = '';

    try {
       
        if (fileExtension === 'pdf') {
            const dataBuffer = await fs.readFile(filePath); 
            const data = await pdf(dataBuffer); 
            extractedText = data.text;
            console.log(`Successfully extracted text from PDF: ${originalname}`);
        }
        
        else if (fileExtension === 'txt') {
            extractedText = await fs.readFile(filePath, 'utf8'); 
            console.log(`Successfully read text from TXT: ${originalname}`);
        }
        
        else {
            await fs.unlink(filePath); 
            return res.status(400).json({ error: 'Unsupported file type. Please upload a .txt or .pdf file.' });
        }

        
        await fs.unlink(filePath);
        console.log(`Temporary file deleted: ${filePath}`);

        res.json({ textContent: extractedText, fileName: originalname });

    } catch (error) {
        
        console.error('Error processing file:', error);
       
        try {
            await fs.unlink(filePath);
            console.log(`Temporary file deleted after error: ${filePath}`);
        } catch (unlinkError) {
            console.error('Error deleting temporary file (during error handling):', unlinkError);
        }
        res.status(500).json({ error: 'Failed to process document.' });
    }
});


app.listen(port, () => {
    console.log(`AI QuizMaster server running at http://localhost:${port}`);
});
