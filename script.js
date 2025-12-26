document.addEventListener('DOMContentLoaded', () => {
    const image = document.getElementById('camera-image');
    const slider = document.getElementById('frame-slider');
    const frameNumberDisplay = document.getElementById('frame-number');
    const loadingDisplay = document.getElementById('loading');
    const webcam = document.getElementById('webcam');
    const canvas = document.getElementById('output-canvas');
    const ctx = canvas.getContext('2d');

    const totalFrames = 240;
    const framePaths = [];
    let detector;
    let imagesLoaded = 0;

    // --- 1. Preload Images ---
    function preloadImages() {
        for (let i = 1; i <= totalFrames; i++) {
            const frame = String(i).padStart(4, '0');
            const path = `./frames/frame-${frame}.png`;
            framePaths.push(path);

            const img = new Image();
            img.src = path;
            img.onload = () => {
                imagesLoaded++;
                if (imagesLoaded === totalFrames) {
                    console.log('All frames loaded');
                    loadingDisplay.style.display = 'none';
                    image.style.display = 'block';
                    document.getElementById('controls').style.display = 'block';
                    main(); // Start hand tracking after images are loaded
                }
            };
        }
    }

    // --- 2. Frame Control Logic ---
    function updateFrame(frameNum) {
        const adjustedFrameNum = Math.max(1, Math.min(totalFrames, frameNum));
        image.src = framePaths[adjustedFrameNum - 1];
        slider.value = adjustedFrameNum;
        frameNumberDisplay.textContent = adjustedFrameNum;
    }

    slider.addEventListener('input', (e) => {
        updateFrame(parseInt(e.target.value, 10));
    });

    // --- 3. Hand Tracking and Gesture Recognition ---
    async function setupHandTracking() {
        // Set up MediaPipe Hands
        const model = handPoseDetection.SupportedModels.MediaPipeHands;
        const detectorConfig = {
            runtime: 'mediapipe',
            solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
            modelType: 'full'
        };
        detector = await handPoseDetection.createDetector(model, detectorConfig);
        console.log('Hand detector ready.');

        // Set up webcam
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        webcam.srcObject = stream;
        
        return new Promise((resolve) => {
            webcam.onloadedmetadata = () => {
                resolve(webcam);
            };
        });
    }

    function calculateHandOpenness(hand) {
        if (!hand || !hand.keypoints) return 0;
        
        // Landmarks for fingertips
        const fingertips = [
            hand.keypoints[4],  // Thumb
            hand.keypoints[8],  // Index
            hand.keypoints[12], // Middle
            hand.keypoints[16], // Ring
            hand.keypoints[20]  // Pinky
        ];

        // Landmark for the wrist (base of the palm)
        const wrist = hand.keypoints[0];

        // Calculate the average distance from fingertips to wrist
        let totalDistance = 0;
        for (const tip of fingertips) {
            const dx = tip.x - wrist.x;
            const dy = tip.y - wrist.y;
            totalDistance += Math.sqrt(dx * dx + dy * dy);
        }
        const avgDistance = totalDistance / fingertips.length;

        // Normalize the distance. These min/max values are empirical and might need tuning.
        const minOpenness = 60; // Approximate value for a fist
        const maxOpenness = 250; // Approximate value for an open palm
        let openness = (avgDistance - minOpenness) / (maxOpenness - minOpenness);
        
        // Clamp the value between 0 and 1
        openness = Math.max(0, Math.min(1, openness));
        
        return openness;
    }

    async function detectHands() {
        const hands = await detector.estimateHands(webcam, { flipHorizontal: true });

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (hands.length > 0) {
            // For simplicity, we only use the first detected hand
            const hand = hands[0];
            
            // Draw landmarks for debugging
            for (const keypoint of hand.keypoints) {
                ctx.fillStyle = 'red';
                ctx.beginPath();
                ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
                ctx.fill();
            }

            // Calculate openness and map to frame
            const openness = calculateHandOpenness(hand); // 0 (closed) to 1 (open)
            const targetFrame = Math.round(1 + openness * (totalFrames - 1));
            updateFrame(targetFrame);
        }
        
        requestAnimationFrame(detectHands);
    }

    async function main() {
        await setupHandTracking();
        webcam.play();
        detectHands();
    }

    // --- Initial Kick-off ---
    preloadImages();
});
