// Theme switching logic (unchanged)
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

    // --- Existing AI QuizMaster JavaScript below ---

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
                    "Please enter some text to generate a quiz.";
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

    // --- UPDATED: Function to render a single question block (display or edit mode) ---
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

        // --- Parse the question block content ---
        if (blockContent.startsWith("MCQ:")) {
            const lines = blockContent.split("\n");
            questionText = lines[0].replace("MCQ: ", "").trim();
            const optionLines = lines.slice(1, lines.length - 1);

            optionLines.forEach((line) => {
                const trimmedLine = line.trim();
                // Regex to capture the option letter (e.g., 'A'), then optionally a duplicate letter (e.g., 'A. '),
                // and finally the actual content.
                // Example: "A. A. implements" -> match[1]='A', match[2]=null, match[3]='A. implements'
                // Example: "A. implements" -> match[1]='A', match[2]=null, match[3]='implements'
                // Re-tested regex to be more specific for "A. A. option"
                const match = trimmedLine.match(/^([A-Z])\.\s*(?:[A-Z]\.\s*)?(.*)/);
                if (match) {
                    // match[1] is the first letter (e.g., 'A')
                    // match[2] is the actual option text, after any potential double letter.
                    const optionContent = match[2].trim();
                    parsedOptions.push({ text: optionContent, is_correct: false });
                }
            });

            const rawAnswerLine = lines[lines.length - 1].replace("Answer: ", "").trim();
            answerText = rawAnswerLine; // Store the full answer text, e.g., "C" or "C. Option Text"
            const answerLetter = rawAnswerLine.charAt(0); // Get the letter 'C'
            const answerIndex = answerLetter.charCodeAt(0) - 65; // Convert 'C' to 2 (0-indexed)

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

        // --- Display Mode HTML ---
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

        // --- Edit Mode HTML (hidden by default) ---
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
            // editHtml += `<button type="button" class="generate-options-btn" data-question-id="${id}">Generate New Options</button>`;
            // editHtml += `<div id="editLoadingIndicator-${id}" style="display: none;">Generating options...</div>`;
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

    // --- Helper function to render a single option input for MCQ editing ---
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

    // --- Helper function to render multiple option inputs (e.g., from AI generation) ---
    function renderOptionInputs(containerElement, optionsArray, questionId) {
        containerElement.innerHTML = '';
        optionsArray.forEach((option, index) => {
            containerElement.innerHTML += renderOptionInput(option, index, questionId);
        });
    }

    // --- Clear All Functionality ---
    document.getElementById("clearAllBtn").addEventListener("click", () => {
        document.getElementById("inputText").value = "";
        document.getElementById("questionsContainer").innerHTML = "";
        document.getElementById("message").textContent = "";
        document.getElementById("exportSection").style.display = "none";
        document.getElementById("exportedQuizText").value = "";
    });

    // --- Export Quiz Functionality ---
    document.getElementById("exportQuizBtn").addEventListener("click", () => {
        const questionsContainer =
            document.getElementById("questionsContainer");
        const exportSection = document.getElementById("exportSection");
        const exportedQuizText = document.getElementById("exportedQuizText");

        if (questionsContainer.children.length === 0) {
            alert("No quiz questions to export!");
            return;
        }

        let quizText = "";
        const questionBlocks = questionsContainer.querySelectorAll(".question-block");

        questionBlocks.forEach((qBlock, index) => {
            const type = qBlock.querySelector('.edit-question-btn').dataset.type;
            const questionText = qBlock.querySelector('.display-mode p').textContent;
            const answerText = qBlock.querySelector('.display-mode p:last-of-type').textContent.replace('Answer: ', '');

            quizText += `${type}: ${questionText}\n`;

            if (type === "MCQ") {
                const optionsList = qBlock.querySelector('.display-mode ul');
                if (optionsList) {
                    Array.from(optionsList.children).forEach((li, optIndex) => {
                        const optionLetter = String.fromCharCode(65 + optIndex);
                        // Access the text node that contains the option content,
                        // which should now be correctly formatted without the double letter due to renderQuestionBlock's fix.
                        // We still need to remove the (Correct) span's text if present.
                        let optionContent = li.textContent.trim();
                        const correctSpan = li.querySelector('span[style*="color: var(--text-color-answer)"]');
                        if (correctSpan) {
                            optionContent = optionContent.replace(correctSpan.textContent, '').trim();
                        }
                        // Also remove the single leading letter and dot, as it's added again below
                        optionContent = optionContent.replace(/^[A-Z]\.\s*/, '');


                        // Determine if this is the correct option based on the stored answerLetter
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
    });

    // --- Copy Exported Text Functionality ---
    document
        .getElementById("copyExportedTextBtn")
        .addEventListener("click", () => {
            const exportedQuizText = document.getElementById("exportedQuizText");
            exportedQuizText.select();
            exportedQuizText.setSelectionRange(0, 99999);
            document.execCommand("copy");
            alert("Quiz text copied to clipboard!");
        });

    // --- Close Export Section Functionality ---
    document
        .getElementById("closeExportSectionBtn")
        .addEventListener("click", () => {
            document.getElementById("exportSection").style.display = "none";
        });