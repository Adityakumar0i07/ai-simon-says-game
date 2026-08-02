  const pads = {
  red: document.getElementById('red'),
  green: document.getElementById('green'),
  blue: document.getElementById('blue'),
  yellow: document.getElementById('yellow')
};

const statusTxt = document.getElementById('status');
const startBtn = document.getElementById('start-btn');
const pointer = document.getElementById('hand-pointer');
const videoElement = document.getElementById('webcam');

let sequence = [];
let playerSequence = [];
let level = 0;
let isPlayerTurn = false;
let cooldown = false;

// --- Web Speech API (Aggressive Voice Control) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true; // Fast & Realtime listening
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    if (!isPlayerTurn || cooldown) return;

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const spokenText = event.results[i][0].transcript.toLowerCase().trim();
      console.log("🎤 Hearing Sound:", spokenText);

      if (spokenText.includes('red') || spokenText.includes('read')) {
        handlePlayerInput('red');
        break;
      } else if (spokenText.includes('green')) {
        handlePlayerInput('green');
        break;
      } else if (spokenText.includes('blue') || spokenText.includes('blow')) {
        handlePlayerInput('blue');
        break;
      } else if (spokenText.includes('yellow') || spokenText.includes('yello')) {
        handlePlayerInput('yellow');
        break;
      }
    }
  };

  recognition.onerror = (err) => {
    // Ignore silent intervals silently
    if (err.error !== 'no-speech') {
      console.log("Mic Event:", err.error);
    }
  };

  recognition.onend = () => {
    if (isPlayerTurn) {
      try { recognition.start(); } catch (e) {}
    }
  };
}

// --- MediaPipe Hand Tracking Setup ---
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 400,
  height: 400
});

camera.start();

function onResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    pointer.style.display = 'block';
    const landmarks = results.multiHandLandmarks[0];
    
    const indexTip = landmarks[8];
    const x = (1 - indexTip.x) * 400; 
    const y = indexTip.y * 400;

    pointer.style.left = `${x}px`;
    pointer.style.top = `${y}px`;

    if (isPlayerTurn && !cooldown) {
      checkHover(x, y);
    }
  } else {
    pointer.style.display = 'none';
  }
}

function checkHover(x, y) {
  let hoveredPad = null;

  if (x >= 0 && x < 200 && y >= 0 && y < 200) hoveredPad = 'red';
  else if (x >= 200 && x <= 400 && y >= 0 && y < 200) hoveredPad = 'green';
  else if (x >= 0 && x < 200 && y >= 200 && y <= 400) hoveredPad = 'blue';
  else if (x >= 200 && x <= 400 && y >= 200 && y <= 400) hoveredPad = 'yellow';

  if (hoveredPad) {
    handlePlayerInput(hoveredPad);
  }
}

// --- Simon Says Logic ---
startBtn.addEventListener('click', startGame);

function startGame() {
  sequence = [];
  level = 0;
  cooldown = false;
  startBtn.style.display = 'none';

  if (recognition) {
    try { recognition.start(); } catch (e) {}
  }

  nextRound();
}

function nextRound() {
  playerSequence = [];
  level++;
  statusTxt.innerText = `Level ${level}: Watch Simon!`;
  isPlayerTurn = false;
  cooldown = false;

  const colors = ['red', 'green', 'blue', 'yellow'];
  const randomColor = colors[Math.floor(Math.random() * 4)];
  sequence.push(randomColor);

  playSequence();
}

function playSequence() {
  let i = 0;
  const interval = setInterval(() => {
    flashPad(sequence[i]);
    i++;
    if (i >= sequence.length) {
      clearInterval(interval);
      setTimeout(() => {
        statusTxt.innerText = `Level ${level}: Your turn! Move hand OR say color!`;
        isPlayerTurn = true;
        if (recognition) {
          try { recognition.start(); } catch (e) {}
        }
      }, 600);
    }
  }, 800);
}

function flashPad(color) {
  pads[color].classList.add('active');
  setTimeout(() => pads[color].classList.remove('active'), 400);
}

function handlePlayerInput(color) {
  if (cooldown) return; 
  cooldown = true; 

  flashPad(color);
  playerSequence.push(color);

  const currentStep = playerSequence.length - 1;

  if (playerSequence[currentStep] !== sequence[currentStep]) {
    statusTxt.innerText = `❌ Game Over! Reached Level ${level}`;
    startBtn.innerText = 'Play Again';
    startBtn.style.display = 'inline-block';
    isPlayerTurn = false;
    cooldown = false;
    return;
  }

  if (playerSequence.length === sequence.length) {
    isPlayerTurn = false;
    statusTxt.innerText = `Good job! Next round...`;
    setTimeout(nextRound, 1200);
  } else {
    setTimeout(() => { cooldown = false; }, 1200);
  }
}
