/* ==========================================
   AI GESTURE SIMON SAYS GAME
   Voice + Hand Tracking + Auto Mic Restart
========================================== */

// ---------- HTML ELEMENTS ----------

const pads = {
    red: document.getElementById("red"),
    green: document.getElementById("green"),
    blue: document.getElementById("blue"),
    yellow: document.getElementById("yellow")
};

const statusTxt = document.getElementById("status");
const levelTxt = document.getElementById("level");
const startBtn = document.getElementById("start-btn");
const pointer = document.getElementById("hand-pointer");
const video = document.getElementById("webcam");
const board = document.querySelector(".game-container");


// ---------- GAME VARIABLES ----------

let sequence = [];
let playerSequence = [];
let level = 0;

let gameRunning = false;
let isPlayerTurn = false;
let cooldown = false;
let controlsEnabled = false;

let micRunning = false;
let micStarting = false;
let micBlocked = false;
let restartTimer = null;
let restartAttempts = 0;
let recognitionSessionId = 0;

let palmStartTime = null;
let gameStarting = false;

let hoveredColor = null;
let hoverStartTime = 0;
let handInputDone = false;


// ==========================================
// HELPER FUNCTIONS
// ==========================================

function updateStatus(message) {
    if (statusTxt) statusTxt.innerText = message;
}

function updateLevel() {
    if (levelTxt) levelTxt.innerText = "Level: " + level;
}


// ==========================================
// VOICE RECOGNITION
// ==========================================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let recognition = null;

function createRecognitionInstance() {
    const rec = new SpeechRecognition();
    const sessionId = ++recognitionSessionId;

    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = false;

    rec.onstart = () => {
        if (sessionId !== recognitionSessionId) return;

        micRunning = true;
        micStarting = false;
        restartAttempts = 0;

        console.log("Microphone ON");
    };

    rec.onresult = (event) => {
        if (sessionId !== recognitionSessionId) return;

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {
            if (!event.results[i].isFinal) continue;

            const spokenText =
                event.results[i][0].transcript
                    .toLowerCase()
                    .trim();

            if (!spokenText) continue;

            console.log("You said:", spokenText);

            handleVoiceCommand(spokenText);
        }
    };

    rec.onerror = (event) => {
        if (sessionId !== recognitionSessionId) return;

        console.log("Mic Error:", event.error);

        micRunning = false;
        micStarting = false;

        if (
            event.error === "not-allowed" ||
            event.error === "service-not-allowed"
        ) {
            clearTimeout(restartTimer);
            micBlocked = true;
            controlsEnabled = false;

            updateStatus("Please allow microphone permission!");

            if (startBtn) {
                startBtn.innerText = "Enable Mic & Controls";
            }

            return;
        }

        // Temporary errors like "no-speech", "network", "audio-capture", "aborted"
        // will be handled cleanly by onend.
    };

    rec.onend = () => {
        if (sessionId !== recognitionSessionId) return;

        micRunning = false;
        micStarting = false;

        console.log("Mic stopped");

        if (controlsEnabled && !micBlocked) {
            scheduleMicRestart();
        }
    };

    return rec;
}

if (SpeechRecognition) {
    recognition = createRecognitionInstance();
} else {
    updateStatus("Voice recognition requires Chrome or Edge.");
}


// ==========================================
// MICROPHONE AUTO RESTART
// ==========================================

function scheduleMicRestart(customDelay = null) {
    clearTimeout(restartTimer);

    if (!controlsEnabled || micBlocked) return;

    restartAttempts = Math.min(restartAttempts + 1, 6);
    const backoffDelay = Math.min(350 + (restartAttempts - 1) * 250, 1800);
    const delay = customDelay !== null ? customDelay : backoffDelay;

    restartTimer = setTimeout(() => {
        startMicrophone();
    }, delay);
}


function startMicrophone() {
    if (
        !SpeechRecognition ||
        !controlsEnabled ||
        micBlocked ||
        micRunning ||
        micStarting
    ) {
        return;
    }

    if (!recognition) {
        recognition = createRecognitionInstance();
    }

    try {
        micStarting = true;
        recognition.start();
    } catch (error) {
        micStarting = false;

        console.log("Mic start error:", error.message);

        // If recognition is stuck in an invalid state, recreate a clean instance
        if (error.name === "InvalidStateError") {
            recognition = createRecognitionInstance();
        }

        scheduleMicRestart(600);
    }
}


// ==========================================
// VOICE COLOUR DETECTION
// ==========================================

function detectColor(text) {

    const words = text
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/);

    const variations = {

        red: ["red", "rad", "redd", "rid"],

        green: [
            "green", "geen", "grean",
            "gren", "grin", "greeen"
        ],

        blue: [
            "blue", "blu", "bloo",
            "bulu", "bluu", "blew"
        ],

        yellow: [
            "yellow", "yallow", "yelo",
            "yello", "yelow", "yellu"
        ]
    };

    for (const word of words) {

        for (const color in variations) {

            if (variations[color].includes(word)) {
                return color;
            }
        }
    }

    return null;
}


// ==========================================
// VOICE COMMAND HANDLER
// ==========================================

function handleVoiceCommand(text) {

    // START COMMAND

    if (
        controlsEnabled &&
        !gameRunning &&
        /\b(start|begin|play)\b/.test(text)
    ) {

        startGame();
        return;
    }

    // COLOUR COMMAND

    if (!gameRunning || !isPlayerTurn || cooldown) {
        return;
    }

    const color = detectColor(text);

    if (color) {

        console.log("Voice detected:", color);

        handlePlayerInput(color);
    }
}


// ==========================================
// ENABLE CONTROLS BUTTON
// ==========================================

if (startBtn) {

    startBtn.addEventListener("click", () => {

        if (!controlsEnabled) {

            controlsEnabled = true;
            micBlocked = false;
            restartAttempts = 0;

            startBtn.innerText = "Start Game";

            updateStatus('Say "START" or click Start Game');

            startMicrophone();

        } else {

            startGame();
        }
    });
}


// ==========================================
// START GAME
// ==========================================

function startGame() {

    if (gameRunning || !controlsEnabled) return;

    clearTimeout(restartTimer);
    restartAttempts = 0;

    sequence = [];
    playerSequence = [];

    level = 0;

    gameRunning = true;
    isPlayerTurn = false;
    cooldown = false;

    hoveredColor = null;
    handInputDone = false;

    updateLevel();

    if (startBtn) {
        startBtn.innerText = "Game Running";
    }

    updateStatus("Get Ready!");

    startMicrophone();

    setTimeout(() => {
        nextRound();
    }, 800);
}


// ==========================================
// NEXT ROUND
// ==========================================

function nextRound() {

    if (!gameRunning) return;

    playerSequence = [];

    level++;

    updateLevel();

    isPlayerTurn = false;
    cooldown = false;

    hoveredColor = null;
    handInputDone = false;

    updateStatus("Level " + level + ": Watch Simon!");

    const colors = ["red", "green", "blue", "yellow"];

    const randomColor =
        colors[Math.floor(Math.random() * colors.length)];

    sequence.push(randomColor);

    playSequence();
}


// ==========================================
// PLAY SIMON SEQUENCE
// ==========================================

function playSequence() {

    let index = 0;

    const interval = setInterval(() => {

        if (!gameRunning) {
            clearInterval(interval);
            return;
        }

        flashPad(sequence[index]);

        index++;

        if (index >= sequence.length) {

            clearInterval(interval);

            setTimeout(() => {

                if (!gameRunning) return;

                isPlayerTurn = true;
                cooldown = false;

                hoveredColor = null;
                handInputDone = false;

                updateStatus("Your Turn! Speak or Move Finger");

            }, 700);
        }

    }, 900);
}


// ==========================================
// FLASH PAD
// ==========================================

function flashPad(color) {

    const pad = pads[color];

    if (!pad) return;

    pad.classList.add("active");

    setTimeout(() => {
        pad.classList.remove("active");
    }, 400);
}


// ==========================================
// PLAYER INPUT
// ==========================================

function handlePlayerInput(color) {

    if (!gameRunning || !isPlayerTurn || cooldown) {
        return;
    }

    if (!pads[color]) return;

    cooldown = true;

    flashPad(color);

    playerSequence.push(color);

    const currentStep = playerSequence.length - 1;

    // WRONG ANSWER

    if (playerSequence[currentStep] !== sequence[currentStep]) {

        gameOver();
        return;
    }

    // COMPLETE SEQUENCE

    if (playerSequence.length === sequence.length) {

        isPlayerTurn = false;

        updateStatus("Correct! Next Level...");

        setTimeout(() => {

            if (gameRunning) {
                nextRound();
            }

        }, 1200);

    } else {

        setTimeout(() => {
            cooldown = false;
        }, 450);
    }
}


// ==========================================
// GAME OVER
// ==========================================

function gameOver() {

    gameRunning = false;
    isPlayerTurn = false;
    cooldown = false;

    updateStatus("GAME OVER! Reached Level " + level);

    if (startBtn) {
        startBtn.innerText = "Play Again";
    }

    if (controlsEnabled && !micBlocked && !micRunning && !micStarting) {
        scheduleMicRestart(400);
    }

    console.log("Game Over. Level:", level);
}


// ==========================================
// MEDIAPIPE HAND TRACKING
// ==========================================

let hands = null;
let camera = null;

if (
    typeof Hands !== "undefined" &&
    typeof Camera !== "undefined" &&
    video &&
    board
) {

    hands = new Hands({

        locateFile: (file) => {
            return "https://cdn.jsdelivr.net/npm/@mediapipe/hands/" + file;
        }

    });

    hands.setOptions({

        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.65

    });

    hands.onResults(onResults);


    // CAMERA START

    camera = new Camera(video, {

        onFrame: async () => {
            await hands.send({ image: video });
        },

        width: 640,
        height: 480

    });

    camera.start().catch((error) => {

        console.log("Camera Error:", error);

        updateStatus("Please allow camera permission.");

    });

} else {

    console.log("MediaPipe libraries or game board not found.");

    updateStatus("Hand tracking libraries could not load.");
}


// ==========================================
// OPEN PALM DETECTION
// ==========================================

function isOpenPalm(hand) {

    const fingers = [
        [8, 6],
        [12, 10],
        [16, 14],
        [20, 18]
    ];

    return fingers.every(([tip, joint]) => {
        return hand[tip].y < hand[joint].y;
    });
}


// ==========================================
// HAND RESULTS
// ==========================================

function onResults(results) {

    const detectedHands =
        results.multiHandLandmarks || [];


    // FINGER POINTER

    if (detectedHands.length > 0) {

        const indexTip = detectedHands[0][8];

        const rect = board.getBoundingClientRect();

        const x = (1 - indexTip.x) * rect.width;
        const y = indexTip.y * rect.height;

        if (pointer) {

            pointer.style.display = "block";
            pointer.style.left = x + "px";
            pointer.style.top = y + "px";
        }

        // HAND INPUT

        if (gameRunning && isPlayerTurn && !cooldown) {
            checkHover(x, y, rect);
        }

    } else {

        if (pointer) {
            pointer.style.display = "none";
        }

        hoveredColor = null;
        handInputDone = false;
    }


    // TWO OPEN PALMS TO START

    if (
        controlsEnabled &&
        !gameRunning &&
        !gameStarting
    ) {

        const bothOpen =
            detectedHands.length === 2 &&
            detectedHands.every(isOpenPalm);

        if (bothOpen) {

            if (palmStartTime === null) {
                palmStartTime = Date.now();
            }

            const duration = Date.now() - palmStartTime;

            updateStatus(
                "Keep palms open: " +
                Math.min(100, Math.floor(duration / 15)) +
                "%"
            );

            if (duration >= 1500) {

                palmStartTime = null;
                gameStarting = true;

                startGame();

                setTimeout(() => {
                    gameStarting = false;
                }, 2000);
            }

        } else {

            palmStartTime = null;
        }
    }
}


// ==========================================
// HAND COLOUR SELECTION
// ==========================================

function checkHover(x, y, rect) {

    const middleX = rect.width / 2;
    const middleY = rect.height / 2;

    let color;

    if (x < middleX && y < middleY) {
        color = "red";
    }
    else if (x >= middleX && y < middleY) {
        color = "green";
    }
    else if (x < middleX && y >= middleY) {
        color = "blue";
    }
    else {
        color = "yellow";
    }

    // Only one input for each entry into a colour area.

    if (color !== hoveredColor) {

        hoveredColor = color;
        handInputDone = false;
    }

    if (!handInputDone) {

        handInputDone = true;

        handlePlayerInput(color);
    }
}


// ==========================================
// END OF GAME
// ==========================================

console.log("AI Gesture Simon Says loaded successfully!");
