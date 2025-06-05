
const themeToggle = document.getElementById("themeToggle");
const body = document.body;

function setTheme(theme) {
    if (theme === "dark") {
        body.classList.remove("light-theme");
        themeToggle.textContent = "Switch to Light Theme";
        localStorage.setItem("theme", "dark");
    } else {
        body.classList.add("light-theme");
        themeToggle.textContent = "Switch to Dark Theme";
        localStorage.setItem("theme", "light");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
        setTheme(savedTheme);
    } else {
        
        setTheme("dark");
    }
});

themeToggle.addEventListener("click", () => {
    if (body.classList.contains("light-theme")) {
        setTheme("dark");
    } else {
        setTheme("light");
    }
});


const fileInput = document.getElementById('fileInput'); 
const fileNameDisplay = document.getElementById('fileNameDisplay'); 
const inputTextarea = document.getElementById('inputText');
const messageElement = document.getElementById('message'); 

if (fileInput) { 
    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) {
            fileNameDisplay.textContent = 'No file chosen';
            inputTextarea.value = '';
            return;
        }

        fileNameDisplay.textContent = `Selected: ${file.name}`;
        messageElement.textContent = `Uploading "${file.name}" and extracting text...`;
        inputTextarea.value = ''; 

        const formData = new FormData();
        formData.append('document', file); 

        try {
            const response = await fetch('/upload-document', { 
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                inputTextarea.value = data.textContent; 
                messageElement.textContent = `Text extracted from "${data.fileName}". Ready to generate quiz!`;
            } else {
                messageElement.textContent = `Error processing file: ${data.error}`;
                console.error('File upload error:', data.error);
            }
        } catch (error) {
            messageElement.textContent = 'Network error or server issue during file upload.';
            console.error('Fetch error during file upload:', error);
        }
    });
}



document
    .getElementById("generateQuizBtn")
    .addEventListener("click", async () => {
        const inputText = document.getElementById("inputText").value;
        const messageElement = document.getElementById("message");
        const questionsContainer =
            document.getElementById("questionsContainer");
        const exportSection = document.getElementById("exportSection");

       
        if (!inputText.trim()) {
            messageElement.textContent =
                "Please enter some text or upload a document to generate a quiz.";
            return;
        }

        messageElement.textContent = "Generating quiz... Please wait.";
        questionsContainer.innerHTML = "";
        exportSection.style.display = "none";

        try {
            const response = await fetch("/generate-quiz", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ textInput: inputText }),
            });

            const data = await response.json();

            if (response.ok) {
                messageElement.textContent =
                    "Quiz generated successfully! You can review and edit the questions below.";

                const rawQuizText = data.quizText;
                const questionBlocks = rawQuizText
                    .split("\n\n")
                    .filter((block) => block.trim() !== "");

                questionBlocks.forEach((block, index) => {
                    const questionId = `q-${Date.now()}-${index}`;
                    renderQuestionBlock(questionId, block, index + 1);
                });
            } else {
                const errorData = await response.json();
                messageElement.textContent = `Error: ${
                    errorData.error || "Failed to generate quiz. Please try again."
                }`;
                console.error("Server error response:", errorData);
            }
        } catch (error) {
            console.error("Network or client-side Error:", error);
            messageElement.textContent =
                "An unexpected error occurred. Please check your internet connection and try again.";
        }
    });


function renderQuestionBlock(id, blockContent, questionNumber) {
    const questionsContainer =
        document.getElementById("questionsContainer");
    const questionDiv = document.createElement("div");
    questionDiv.classList.add("question-block");
    questionDiv.setAttribute("data-question-id", id);
    questionDiv.setAttribute("data-question-block-content", blockContent);

    let questionText = "";
    let answerText = "";
    let typeLabel = "";
    let parsedOptions = [];

   
    if (blockContent.startsWith("MCQ:")) {
        const lines = blockContent.split("\n");
        questionText = lines[0].replace("MCQ: ", "").trim();
        const optionLines = lines.slice(1, lines.length - 1);

        optionLines.forEach((line) => {
            const trimmedLine = line.trim();
            const match = trimmedLine.match(/^([A-Z])\.\s*(?:[A-Z]\.\s*)?(.*)/);
            if (match) {
                const optionContent = match[2].trim();
                parsedOptions.push({ text: optionContent, is_correct: false });
            }
        });

        const rawAnswerLine = lines[lines.length - 1].replace("Answer: ", "").trim();
        answerText = rawAnswerLine;
        const answerLetter = rawAnswerLine.charAt(0);
        const answerIndex = answerLetter.charCodeAt(0) - 65;

        if (parsedOptions[answerIndex]) {
            parsedOptions[answerIndex].is_correct = true;
        }

        typeLabel = "MCQ";
    } else if (blockContent.startsWith("TF:")) {
        const parts = blockContent.split("\n");
        questionText = parts[0].replace("TF: ", "").trim();
        answerText = parts[1].replace("Answer: ", "").trim();
        typeLabel = "True/False";
    } else if (blockContent.startsWith("SA:")) {
        const parts = blockContent.split("\n");
        questionText = parts[0].replace("SA: ", "").trim();
        answerText = parts[1].replace("Answer: ", "").trim();
        typeLabel = "Short Answer";
    } else {
        questionText = `Could not parse: ${blockContent}`;
        typeLabel = "Unknown (Parse Error)";
        answerText = "N/A";
    }

    
    let displayHtml = `
            <div class="display-mode">
                <h4>Question ${questionNumber}: <span style="font-size: 0.8em; color: var(--text-color-hint);"> (Type: ${typeLabel})</span></h4>
                <p>${questionText}</p>
        `;
    if (typeLabel === "MCQ") {
        displayHtml += `<ul style="list-style-type: upper-alpha; margin-left: 20px;">`;
        if (parsedOptions.length > 0) {
            parsedOptions.forEach((opt, idx) => {
                const letter = String.fromCharCode(65 + idx);
                displayHtml += `<li>${letter}. ${opt.text} ${
                    opt.is_correct
                        ? '<span style="color: var(--text-color-answer);">(Correct)</span>'
                        : ""
                }</li>`;
            });
        }
        displayHtml += `</ul>`;
    }
    displayHtml += `<p style="font-weight: bold; color: var(--text-color-answer);">Answer: ${answerText}</p>
            <button class="edit-question-btn" data-question-id="${id}" data-type="${typeLabel}">Edit Question</button>
            </div>
        `;
    questionDiv.innerHTML = displayHtml;

    
    let editHtml = `
            <div class="edit-form" style="display: none;">
                <label>Question Text:</label>
                <textarea class="edit-question-text" rows="3">${questionText}</textarea>
        `;

    if (typeLabel === "MCQ") {
        editHtml += `<label>Options (select one as correct):</label>`;
        editHtml += `<div class="edit-options-container" data-question-id="${id}">`;
        if (parsedOptions.length > 0) {
            parsedOptions.forEach((opt, idx) => {
                editHtml += renderOptionInput(opt, idx, id);
            });
        } else {
            editHtml += renderOptionInput({ text: "", is_correct: false }, 0, id);
        }
        editHtml += `</div>`;
        editHtml += `<button type="button" class="add-option-btn" data-question-id="${id}">Add Option</button>`;
       
    } else {
        editHtml += `<label>Answer:</label>
                        <textarea class="edit-answer-text" rows="1">${answerText}</textarea>`;
    }

    editHtml += `
                <div class="action-buttons">
                    <button type="button" class="save-edited-question-btn" data-question-id="${id}" data-type="${typeLabel}">Save Changes</button>
                    <button type="button" class="cancel-edit-btn" data-question-id="${id}">Cancel</button>
                </div>
            </div>
        `;
    questionDiv.innerHTML += editHtml;

    questionsContainer.appendChild(questionDiv);

    const editButton = questionDiv.querySelector(".edit-question-btn");
    if (editButton) {
        editButton.addEventListener("click", () => {
            questionDiv.classList.add("edit-mode");
            questionDiv.querySelector(".edit-form").style.display = "flex";
        });
    }

    const cancelButton = questionDiv.querySelector(".cancel-edit-btn");
    if (cancelButton) {
        cancelButton.addEventListener("click", () => {
            questionDiv.classList.remove("edit-mode");
            questionDiv.querySelector(".edit-form").style.display = "none";
        });
    }

    const generateOptionsBtn =
        questionDiv.querySelector(`.generate-options-btn`);
    const addOptionBtn = questionDiv.querySelector(`.add-option-btn`);

    if (generateOptionsBtn) {
        generateOptionsBtn.addEventListener("click", async () => {
            const qId = generateOptionsBtn.dataset.questionId;
            const questionTextarea = questionDiv.querySelector(
                `.edit-question-text`
            );
            const optionsContainer = questionDiv.querySelector(
                `.edit-options-container[data-question-id="${qId}"]`
            );
            const loadingIndicator = questionDiv.querySelector(
                `#editLoadingIndicator-${qId}`
            );

            const editedQuestion = questionTextarea.value.trim();
            if (!editedQuestion) {
                alert("Please enter a question before generating options.");
                return;
            }

            loadingIndicator.style.display = "block";
            generateOptionsBtn.disabled = true;
            if (addOptionBtn) addOptionBtn.disabled = true;

            try {
                const response = await fetch("/api/generate_options", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ question_text: editedQuestion }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Failed to generate options");
                }

                const data = await response.json();
                renderOptionInputs(optionsContainer, data.options, qId);
            } catch (error) {
                console.error("Error generating options:", error);
                alert(`Error: ${error.message}`);
            } finally {
                loadingIndicator.style.display = "none";
                generateOptionsBtn.disabled = false;
                if (addOptionBtn) addOptionBtn.disabled = false;
            }
        });
    }

    if (addOptionBtn) {
        addOptionBtn.addEventListener("click", () => {
            const qId = addOptionBtn.dataset.questionId;
            const optionsContainer = questionDiv.querySelector(
                `.edit-options-container[data-question-id="${qId}"]`
            );
            const newIndex = optionsContainer.children.length;
            optionsContainer.innerHTML += renderOptionInput(
                { text: "", is_correct: false },
                newIndex,
                qId
            );
        });
    }

    questionDiv.addEventListener("click", (e) => {
        if (e.target.classList.contains("remove-option-btn")) {
            e.target.closest(".option-item").remove();
        }
    });

    const saveEditedQuestionBtn = questionDiv.querySelector(
        ".save-edited-question-btn"
    );
    if (saveEditedQuestionBtn) {
        saveEditedQuestionBtn.addEventListener("click", async () => {
            const qId = saveEditedQuestionBtn.dataset.questionId;
            const questionTextarea =
                questionDiv.querySelector(".edit-question-text");
            const editedQuestionText = questionTextarea.value.trim();
            const type = saveEditedQuestionBtn.dataset.type;

            let finalOptions = [];
            let finalAnswer = "";

            if (!editedQuestionText) {
                alert('Question text cannot be empty.');
                return;
            }

            if (type === "MCQ") {
                const optionItems = questionDiv.querySelectorAll(
                    '.edit-options-container .option-item'
                );
                let correctCount = 0;
                optionItems.forEach((item) => {
                    const textInput = item.querySelector(".option-text");
                    const radioBtn = item.querySelector('input[type="radio"]');
                    if (textInput.value.trim()) {
                        finalOptions.push({
                            text: textInput.value.trim(),
                            is_correct: radioBtn.checked,
                        });
                        if (radioBtn.checked) {
                            correctCount++;
                            
                            finalAnswer = String.fromCharCode(65 + finalOptions.length - 1); 
                        }
                    }
                });

                if (finalOptions.length < 2) {
                    alert("Please provide at least two options for MCQ questions.");
                    return;
                }
                if (correctCount === 0) {
                    alert("Please select one correct option for MCQ questions.");
                    return;
                }
                if (correctCount > 1) {
                    alert("Please select only one correct option for MCQ questions.");
                    return;
                }
            } else {
                const answerTextarea = questionDiv.querySelector(".edit-answer-text");
                finalAnswer = answerTextarea.value.trim();
                if (!finalAnswer) {
                    alert('Answer cannot be empty for True/False or Short Answer questions.');
                    return;
                }
            }

            const displayModeDiv = questionDiv.querySelector('.display-mode');
            let updatedDisplayHtml = `
                    <h4>Question ${questionNumber}: <span style="font-size: 0.8em; color: var(--text-color-hint);"> (Type: ${type})</span></h4>
                    <p>${editedQuestionText}</p>
                `;
            if (type === "MCQ") {
                updatedDisplayHtml += `<ul style="list-style-type: upper-alpha; margin-left: 20px;">`;
                finalOptions.forEach((opt, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    updatedDisplayHtml += `<li>${letter}. ${opt.text} ${opt.is_correct ? '<span style="color: var(--text-color-answer);">(Correct)</span>' : ''}</li>`;
                });
                updatedDisplayHtml += `</ul>`;
            }
            updatedDisplayHtml += `<p style="font-weight: bold; color: var(--text-color-answer);">Answer: ${finalAnswer}</p>
                    <button class="edit-question-btn" data-question-id="${qId}" data-type="${type}">Edit Question</button>
                `;
            displayModeDiv.innerHTML = updatedDisplayHtml;

            questionDiv.classList.remove('edit-mode');
            questionDiv.querySelector('.edit-form').style.display = 'none';
        });
    }
}

function renderOptionInput(option, index, questionId) {
    return `
            <div class="option-item">
                <input type="radio" name="correctOption-${questionId}" id="option-${questionId}-${index}" value="${index}" ${option.is_correct ? 'checked' : ''}>
                <label for="option-${questionId}-${index}">
                    <input type="text" class="option-text" value="${option.text}" placeholder="Option Text">
                </label>
                <button type="button" class="remove-option-btn">x</button>
            </div>
        `;
}


function renderOptionInputs(containerElement, optionsArray, questionId) {
    containerElement.innerHTML = '';
    optionsArray.forEach((option, index) => {
        containerElement.innerHTML += renderOptionInput(option, index, questionId);
    });
}


document.getElementById("clearAllBtn").addEventListener("click", () => {
    document.getElementById("inputText").value = "";
    document.getElementById("questionsContainer").innerHTML = "";
    document.getElementById("message").textContent = "";
    document.getElementById("exportSection").style.display = "none";
    document.getElementById("exportedQuizText").value = "";

    
    if (fileInput) {
        fileInput.value = '';
    }
    if (fileNameDisplay) {
        fileNameDisplay.textContent = 'No file chosen';
    }
});


document.getElementById("exportQuizBtn").addEventListener("click", () => {
    const questionsContainer =
        document.getElementById("questionsContainer");
    const exportSection = document.getElementById("exportSection");
    const exportedQuizText = document.getElementById("exportedQuizText");
    const messageElement = document.getElementById("message"); 

    if (questionsContainer.children.length === 0) {
        messageElement.textContent = "No quiz questions to export!"; 
        exportSection.style.display = "none";
        return;
    }

    let quizText = "--- AI QuizMaster Export ---\n\n"; 
    const questionBlocks = questionsContainer.querySelectorAll(".question-block");

    questionBlocks.forEach((qBlock, index) => {
        const type = qBlock.querySelector('.edit-question-btn').dataset.type;
        const questionText = qBlock.querySelector('.display-mode p').textContent;
        
        const answerParagraph = qBlock.querySelector('.display-mode p:last-of-type');
        let answerText = answerParagraph ? answerParagraph.textContent.replace('Answer: ', '') : '';


        quizText += `${type}: ${questionText}\n`;

        if (type === "MCQ") {
            const optionsList = qBlock.querySelector('.display-mode ul');
            if (optionsList) {
                Array.from(optionsList.children).forEach((li, optIndex) => {
                    const optionLetter = String.fromCharCode(65 + optIndex);
                    let optionContent = li.textContent.trim();
                    const correctSpan = li.querySelector('span[style*="color: var(--text-color-answer)"]');
                    if (correctSpan) {
                        optionContent = optionContent.replace(correctSpan.textContent, '').trim();
                    }
                    optionContent = optionContent.replace(/^[A-Z]\.\s*/, '');

                   
                    const isCorrectOption = answerText.startsWith(optionLetter);

                    if (isCorrectOption) {
                        quizText += `${optionLetter}. ${optionContent} [Correct]\n`;
                    } else {
                        quizText += `${optionLetter}. ${optionContent}\n`;
                    }
                });
            }
        }
        quizText += `Answer: ${answerText}\n\n`;
    });


    exportedQuizText.value = quizText.trim();
    exportSection.style.display = "block";
    exportedQuizText.select(); 
    exportedQuizText.focus();
    messageElement.textContent = "Quiz ready for export. Copy the text below!";
});


document
    .getElementById("copyExportedTextBtn")
    .addEventListener("click", () => {
        const exportedQuizText = document.getElementById("exportedQuizText");
        exportedQuizText.select();
        exportedQuizText.setSelectionRange(0, 99999); 

        if (navigator.clipboard && navigator.clipboard.writeText) {
            
            navigator.clipboard
                .writeText(exportedQuizText.value)
                .then(() => {
                    document.getElementById("message").textContent =
                        "Quiz text copied to clipboard!";
                })
                .catch((err) => {
                    console.error("Failed to copy text: ", err);
                    
                    document.execCommand("copy");
                    document.getElementById("message").textContent =
                        "Copy failed. Please manually copy the text.";
                });
        } else {
            
            document.execCommand("copy");
            document.getElementById("message").textContent =
                "Quiz text copied to clipboard! (Legacy method)";
        }
    });


document
    .getElementById("closeExportSectionBtn")
    .addEventListener("click", () => {
        document.getElementById("exportSection").style.display = "none";
        document.getElementById("message").textContent = "";
    });