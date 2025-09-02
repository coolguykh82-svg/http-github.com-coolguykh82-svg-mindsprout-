import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Treat this file as a module.
export {};

// Expose libraries to the window object for inline script access in HTML
declare global {
    interface Window {
        html2canvas: any;
        jspdf: { jsPDF: any };
    }
}

const inputSection = document.getElementById('input-section') as HTMLElement;
const loadingSection = document.getElementById('loading-section') as HTMLElement;
const resultSection = document.getElementById('result-section') as HTMLElement;
const errorMessageContainer = document.getElementById('error-message-container') as HTMLElement;

const analysisForm = document.getElementById('analysis-form') as HTMLFormElement;
const analyzeButton = document.getElementById('analyze-button') as HTMLButtonElement;
const loadingMessage = document.getElementById('loading-message') as HTMLParagraphElement;

const photoUploadLabel = document.querySelector('.photo-upload-label') as HTMLLabelElement;
const photoUpload = document.getElementById('photo-upload') as HTMLInputElement;
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;

const themeOptionsContainer = document.querySelector('.theme-options') as HTMLElement;
const themeOptions = document.querySelectorAll('.theme-option');

const themeContextGroup = document.getElementById('theme-context-group') as HTMLElement;
const themeContextLabel = document.getElementById('theme-context-label') as HTMLLabelElement;
const themeContextInput = document.getElementById('theme-context') as HTMLInputElement;

const childNameInput = document.getElementById('child-name') as HTMLInputElement;
const childAgeInput = document.getElementById('child-age') as HTMLInputElement;
const childTraitInput = document.getElementById('child-trait') as HTMLTextAreaElement;
const messageRecipientInput = document.getElementById('message-recipient') as HTMLInputElement;

const resultCard = document.getElementById('result-card') as HTMLElement;
const resultImage = document.getElementById('result-image') as HTMLImageElement;
const resultMessage = document.getElementById('result-message') as HTMLParagraphElement;
const resultMessageEdit = document.getElementById('result-message-edit') as HTMLTextAreaElement;

const saveImageButton = document.getElementById('save-image-button') as HTMLButtonElement;
const savePdfButton = document.getElementById('save-pdf-button') as HTMLButtonElement;
const copyTextButton = document.getElementById('copy-text-button') as HTMLButtonElement;
const editMessageButton = document.getElementById('edit-message-button') as HTMLButtonElement;
const restartButton = document.getElementById('restart-button') as HTMLButtonElement;

let uploadedFile: File | null = null;
let uploadedImageDataUrl: string | null = null;
let loadingInterval: number | null = null;
let selectedTheme: string = 'default';
let isEditing: boolean = false;

const loadingMessages = [
    "우리아이의 특별함을 찾고 있습니다...",
    "따뜻한 메시지를 만들고 있어요.",
    "사진 속 멋진 순간을 기억하고 있어요.",
    "잠재력의 씨앗을 발견하는 중이에요.",
];

function showErrorMessage(message: string | null) {
    if (message) {
        errorMessageContainer.innerHTML = message;
        errorMessageContainer.classList.remove('hidden');
    } else {
        errorMessageContainer.innerHTML = '';
        errorMessageContainer.classList.add('hidden');
    }
}

function setLoadingState(isLoading: boolean) {
    if (isLoading) {
        analyzeButton.disabled = true;
        inputSection.classList.add('hidden');
        loadingSection.classList.remove('hidden');
        resultSection.classList.add('hidden');

        let messageIndex = 0;
        loadingMessage.textContent = loadingMessages[messageIndex];
        loadingInterval = window.setInterval(() => {
            messageIndex = (messageIndex + 1) % loadingMessages.length;
            loadingMessage.textContent = loadingMessages[messageIndex];
        }, 2500);

    } else {
        analyzeButton.disabled = false;
        loadingSection.classList.add('hidden');
        if (loadingInterval) {
            clearInterval(loadingInterval);
            loadingInterval = null;
        }
    }
}

function resetApp() {
    analysisForm.reset();
    imagePreview.src = '#';
    imagePreview.classList.add('hidden');
    photoUploadLabel.classList.remove('has-image');
    uploadedFile = null;
    uploadedImageDataUrl = null;
    
    themeOptions.forEach(option => option.classList.remove('active'));
    document.querySelector('.theme-option[data-theme="default"]')?.classList.add('active');
    selectedTheme = 'default';

    themeContextGroup.classList.add('hidden');
    themeContextInput.value = '';

    // Reset editing state
    isEditing = false;
    resultMessage.classList.remove('hidden');
    resultMessageEdit.classList.add('hidden');
    const editButtonSpan = editMessageButton.querySelector('span');
    if (editButtonSpan) editButtonSpan.textContent = '내용 수정';
    [saveImageButton, savePdfButton, copyTextButton].forEach(btn => btn.disabled = false);

    resultSection.classList.add('hidden');
    inputSection.classList.remove('hidden');
    loadingSection.classList.add('hidden');
    showErrorMessage(null);
}

// Helper function to process raw text into displayable HTML
function processMessageText(rawText: string): string {
    let messageText = rawText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return messageText
        .trim()
        .split(/\n+/g)
        .filter(p => p)
        .join('<br><br>');
}

// Helper function to convert message HTML back to editable text
function messageHtmlToText(html: string): string {
    return html
        .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n\n') // Convert <br><br> to double newline
        .replace(/<strong>(.*?)<\/strong>/gi, '**$1**'); // Convert <strong> to markdown
}


photoUpload.addEventListener('change', () => {
    showErrorMessage(null);
    const file = photoUpload.files?.[0];

    const resetFileInput = () => {
        photoUpload.value = '';
        imagePreview.src = '#';
        imagePreview.classList.add('hidden');
        photoUploadLabel.classList.remove('has-image');
        uploadedFile = null;
        uploadedImageDataUrl = null;
    };

    if (!file) {
        return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
        showErrorMessage('이미지 파일은 10MB를 초과할 수 없습니다.');
        resetFileInput();
        return;
    }

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
        showErrorMessage('JPEG 또는 PNG 형식의 이미지만 업로드할 수 있습니다.');
        resetFileInput();
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const result = e.target?.result as string;
        imagePreview.src = result;
        imagePreview.classList.remove('hidden');
        photoUploadLabel.classList.add('has-image');
        uploadedFile = file;
        uploadedImageDataUrl = result;
    };
    reader.onerror = () => {
        showErrorMessage('파일을 읽는 중 오류가 발생했습니다.');
        resetFileInput();
    };
    reader.readAsDataURL(file);
});

themeOptionsContainer.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const themeButton = target.closest('.theme-option');
    if (!themeButton) return;

    themeOptions.forEach(option => option.classList.remove('active'));
    themeButton.classList.add('active');
    selectedTheme = themeButton.getAttribute('data-theme') || 'default';

    const themeContextRequired = ['cheer', 'comfort'];
    if (themeContextRequired.includes(selectedTheme)) {
        themeContextGroup.classList.remove('hidden');
        const themeDetails: { [key: string]: { label: string, placeholder: string } } = {
            'cheer': { label: '응원 주제', placeholder: '예: 오늘 축구 시합이 있어요' },
            'comfort': { label: '위로 주제', placeholder: '예: 친구랑 다퉜어요' },
        };
        themeContextLabel.textContent = themeDetails[selectedTheme].label;
        themeContextInput.placeholder = themeDetails[selectedTheme].placeholder;
    } else {
        themeContextGroup.classList.add('hidden');
    }
});

analysisForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!uploadedFile || !uploadedImageDataUrl) {
        showErrorMessage('아이의 사진을 먼저 업로드해주세요.');
        return;
    }

    setLoadingState(true);
    showErrorMessage(null);

    const childName = childNameInput.value;
    const childAge = childAgeInput.value;
    const childTrait = childTraitInput.value;
    const messageRecipient = messageRecipientInput.value;
    const themeContext = themeContextInput.value;

    const themePrompts: { [key: string]: string } = {
        default: '따뜻하고 희망적인 격려 메시지',
        cheer: `오늘의 특별한 일을 응원하는 메시지. 주제: ${themeContext || '오늘 하루'}`,
        comfort: `힘든 마음을 위로하고 다독여주는 메시지. 주제: ${themeContext || '속상한 마음'}`,
    };
    
    let recipientPerspectiveInstruction: string;
    let greetingInstruction: string;

    if (messageRecipient) {
        recipientPerspectiveInstruction = `${messageRecipient}에게 ${childName}에 대해 자랑하듯 이야기하는 형식으로 작성하세요. (예: "어머니, 우리 ${childName}이가요...")`;
        greetingInstruction = `메시지 시작 부분에 "${messageRecipient}께,"와 같이 받는 사람에게 보내는 인사말을 넣으세요.`;
    } else {
        recipientPerspectiveInstruction = `아이(${childName})에게 직접 말하는 형식으로 작성하세요.`;
        greetingInstruction = `메시지 시작 부분에 "사랑하는 ${childName}에게,"와 같이 아이에게 직접 보내는 인사말을 넣으세요.`;
    }

    const prompt = `
# 지시사항
당신은 MindSprout 앱의 AI입니다. 아이의 사진과 정보를 바탕으로, 아이의 잠재력을 발견하여 따뜻한 메시지를 작성하는 역할을 합니다. 아래의 규칙과 출력 예시를 엄격하게 따라서 응답을 생성해주세요.

# 아이 정보
*   이름: ${childName}
*   나이/학년: ${childAge}
*   특징: ${childTrait}

# 메시지 규칙
1.  **주제:** ${themePrompts[selectedTheme]}
2.  **사진 내용 반영:** 사진 속 아이의 모습(표정, 행동 등)을 구체적으로 언급하세요.
3.  **특징 반영:** 사용자가 적어준 아이의 특징을 긍정적으로 칭찬해주세요.
4.  **어조:** 매우 다정하고 따뜻한 어조를 사용하세요. 아이의 이름을 부를 때는 성을 제외하고 이름만 사용하여 친근하게 불러주세요. (예: '홍길동' -> '길동아')
5.  **형식:**
    *   메시지 수신자: ${recipientPerspectiveInstruction}
    *   인사말: ${greetingInstruction} 그리고 반드시 한 줄을 띄운 후 본문을 시작하세요.
    *   마무리: 메시지 끝은 항상 "MindSprout 드림"으로 마무리해주세요. 다른 서명이나 보내는 사람 이름은 절대 추가하지 마세요.
    *   문단: 자연스럽게 문단을 나눠주세요.
    *   강조: 가장 중요한 칭찬이나 격려 문구는 **별표 두 개**로 감싸주세요.

# 출력 예시
어머니께,

사진 속에서 블록으로 멋진 성을 만들며 환하게 웃는 서준이의 모습이 정말 사랑스러워요. 작은 손으로 하나하나 블록을 쌓아 올리는 모습에서 서준이의 놀라운 **집중력과 창의력**이 엿보이네요.

평소에도 블록 쌓기를 좋아한다는 서준이는, 자신이 상상하는 세계를 현실로 만들어내는 특별한 재능을 가졌어요. 이런 꾸준함과 열정은 앞으로 서준이가 어떤 꿈을 꾸든 훌륭한 밑거름이 될 거예요.

지금처럼 즐겁게 탐험하고, 상상하고, 만들어나가는 서준이가 되기를 응원합니다.

MindSprout 드림
    `;

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const base64Data = uploadedImageDataUrl.split(',')[1];
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: uploadedFile.type, data: base64Data } },
                    { text: prompt }
                ]
            }
        });

        const rawText = response.text;
        const messageHtml = processMessageText(rawText);
        
        resultMessage.innerHTML = messageHtml;
        resultImage.src = uploadedImageDataUrl;
        
        inputSection.classList.add('hidden');
        resultSection.classList.remove('hidden');

    } catch (error) {
        console.error("Error during AI analysis:", error);
        showErrorMessage("메시지를 생성하는 중 오류가 발생했습니다. 입력 내용을 확인하거나 잠시 후 다시 시도해주세요.");
        inputSection.classList.remove('hidden');
    } finally {
        setLoadingState(false);
    }
});

restartButton.addEventListener('click', resetApp);

copyTextButton.addEventListener('click', () => {
    // innerText preserves paragraph breaks better than textContent
    const textToCopy = (resultMessage as HTMLElement).innerText;
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            const buttonSpan = copyTextButton.querySelector('span');
            if (!buttonSpan) return;
            
            const originalText = buttonSpan.textContent;
            copyTextButton.disabled = true;
            buttonSpan.textContent = '복사 완료!';

            setTimeout(() => {
                buttonSpan.textContent = originalText;
                copyTextButton.disabled = false;
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy text: ', err);
            showErrorMessage('텍스트 복사에 실패했습니다.');
        });
});

editMessageButton.addEventListener('click', () => {
    const editButtonSpan = editMessageButton.querySelector('span');
    if (!editButtonSpan) return;

    const actionButtons = [saveImageButton, savePdfButton, copyTextButton];
    isEditing = !isEditing;

    if (isEditing) {
        // --- Enter Edit Mode ---
        editButtonSpan.textContent = '저장하기';
        actionButtons.forEach(btn => btn.disabled = true);
        
        const textToEdit = messageHtmlToText(resultMessage.innerHTML);
        resultMessageEdit.value = textToEdit;
        
        resultMessage.classList.add('hidden');
        resultMessageEdit.classList.remove('hidden');
        resultMessageEdit.focus();
        
        // Auto-resize textarea
        resultMessageEdit.style.height = 'auto';
        resultMessageEdit.style.height = `${resultMessageEdit.scrollHeight}px`;
    } else {
        // --- Save and Exit Edit Mode ---
        editButtonSpan.textContent = '내용 수정';
        actionButtons.forEach(btn => btn.disabled = false);

        const newText = resultMessageEdit.value;
        const newHtml = processMessageText(newText);
        resultMessage.innerHTML = newHtml;

        resultMessageEdit.classList.add('hidden');
        resultMessage.classList.remove('hidden');
    }
});

resultMessageEdit.addEventListener('input', () => {
    resultMessageEdit.style.height = 'auto';
    resultMessageEdit.style.height = `${resultMessageEdit.scrollHeight}px`;
});


saveImageButton.addEventListener('click', () => {
    window.html2canvas(resultCard, { scale: 2 }).then(canvas => { // Increase scale for better quality
        const link = document.createElement('a');
        link.download = `mindsprout-${childNameInput.value || 'result'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }).catch(err => {
        console.error('Failed to save image:', err);
        showErrorMessage('이미지 저장에 실패했습니다.');
    });
});

savePdfButton.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    window.html2canvas(resultCard, { scale: 2 }).then(canvas => { // Increase scale for better quality
        const imgData = canvas.toDataURL('image/png');
        const imgProps = { width: canvas.width, height: canvas.height };
        const pdf = new jsPDF({
            orientation: imgProps.width > imgProps.height ? 'l' : 'p',
            unit: 'px',
            format: [imgProps.width, imgProps.height]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, imgProps.width, imgProps.height);
        pdf.save(`mindsprout-${childNameInput.value || 'result'}.pdf`);
    }).catch(err => {
        console.error('Failed to save PDF:', err);
        showErrorMessage('PDF 저장에 실패했습니다.');
    });
});
