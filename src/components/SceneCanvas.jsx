import React, { useEffect, useRef } from 'react';

const UNDERSEA_WALLPAPERS = [
  "https://static.vecteezy.com/system/resources/thumbnails/003/439/678/original/cartoon-background-underwater-sea-life-free-video.jpg"
];

function getRandomWallpaper() {
  return UNDERSEA_WALLPAPERS[Math.floor(Math.random() * UNDERSEA_WALLPAPERS.length)];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  return [s, v];
}

function isNearWhite(r, g, b) {
  // Option 1: All channels above 180
  if (r > 160 && g > 160 && b > 160) return true;
  // Option 2: Distance from white
  const dist = Math.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2);
  if (dist < 110) return true; // more aggressive threshold
  return false;
}

function processImage(image, callback) {
  const img = new window.Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      // Remove white and near-white pixels
      if (isNearWhite(r, g, b)) {
        data[i+3] = 0;
        continue;
      }
      // Remove only very light gray pixels (optional, for cleaner cutout)
      const [s, v] = rgbToHsv(r, g, b);
      if (s < 0.08 && v > 0.85) {
        data[i+3] = 0;
      }
      // Do NOT remove black/dark pixels!
    }
    ctx.putImageData(imageData, 0, 0);
    callback(canvas.toDataURL());
  };
  img.src = image;
}

// Helper to create a new animation state for an object
function createObjState(canvas, objW, objH) {
  const width = canvas.width;
  const height = canvas.height;
  const maxAngle = Math.PI / 4; // 45 degrees
  return {
    x: Math.random() * (width - objW),
    y: Math.random() * (height - objH),
    vx: (Math.random() - 0.5) * 3.5,
    vy: (Math.random() - 0.5) * 2.5,
    angle: (Math.random() - 0.5) * 2 * maxAngle,
    vAngle: (Math.random() - 0.5) * 0.01,
    initialized: true,
  };
}

const BUBBLE_SOUND = 'https://cdn.freesound.org/previews/193/193169_84709-lq.mp3';
const BOUNCE_SOUND = 'https://cdn.freesound.org/previews/329/329944_5622625-lq.mp3';

const SceneCanvas = ({ images = [], fillScreen, onProcessed, uploadedImage }) => {
  const canvasRef = useRef();
  const bgImgRef = useRef(null);
  const objImgRefs = useRef([]); // array of Image objects
  const animationRef = useRef();
  const objStates = useRef([]); // array of animation states
  const bubbleAudioRef = useRef();
  const bounceAudioRef = useRef();

  // Only load the background image once
  useEffect(() => {
    const bgImg = new window.Image();
    bgImg.crossOrigin = 'anonymous';
    bgImg.src = getRandomWallpaper();
    bgImg.onload = () => {
      bgImgRef.current = bgImg;
    };
  }, []);

  // If uploadedImage changes, process it and call onProcessed
  useEffect(() => {
    if (uploadedImage && onProcessed) {
      processImage(uploadedImage, onProcessed);
    }
    // eslint-disable-next-line
  }, [uploadedImage]);

  // When images array changes, create new Image objects and animation states for new images
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    // Only add new images
    if (images.length > objImgRefs.current.length) {
      for (let i = objImgRefs.current.length; i < images.length; i++) {
        const img = new window.Image();
        img.src = images[i];
        objImgRefs.current.push(img);
        // Use current canvas size for initial state
        const objW = Math.min(canvas.width, canvas.height) / 4;
        const objH = objW;
        objStates.current.push(createObjState(canvas, objW, objH));
      }
    }
  }, [images, fillScreen]);

  // Prepare bubble sound
  useEffect(() => {
    if (!bubbleAudioRef.current) {
      bubbleAudioRef.current = new window.Audio(BUBBLE_SOUND);
      bubbleAudioRef.current.volume = 0.5;
    }
  }, []);

  // Prepare bounce sound
  useEffect(() => {
    if (!bounceAudioRef.current) {
      bounceAudioRef.current = new window.Audio(BOUNCE_SOUND);
      bounceAudioRef.current.volume = 0.5;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let running = true;
    const maxAngle = Math.PI / 4; // 45 degrees

    function playBubble() {
      if (bubbleAudioRef.current) {
        // Clone the audio node to allow overlapping sounds
        const bubble = bubbleAudioRef.current.cloneNode();
        bubble.volume = bubbleAudioRef.current.volume;
        bubble.play().catch(() => {});
      }
    }
    function playBounce() {
      if (bounceAudioRef.current) {
        const bounce = bounceAudioRef.current.cloneNode();
        bounce.volume = bounceAudioRef.current.volume;
        bounce.play().catch(() => {});
      }
    }

    function animateObject(state, objW, objH) {
      const width = canvas.width;
      const height = canvas.height;
      // Add some random walk
      state.vx += (Math.random() - 0.5) * 0.09;
      state.vy += (Math.random() - 0.5) * 0.06;
      state.vAngle += (Math.random() - 0.5) * 0.0005;
      // Clamp speed
      state.vx = Math.max(-3, Math.min(3, state.vx));
      state.vy = Math.max(-2, Math.min(2, state.vy));
      state.vAngle = Math.max(-0.01, Math.min(0.01, state.vAngle));
      // Move
      state.x += state.vx;
      state.y += state.vy;
      state.angle += state.vAngle;
      // Clamp angle to +/- 45 degrees
      if (state.angle > maxAngle) {
        state.angle = maxAngle;
        state.vAngle *= -1;
      } else if (state.angle < -maxAngle) {
        state.angle = -maxAngle;
        state.vAngle *= -1;
      }
      // Bounce off edges
      let bouncedX = false;
      let bouncedY = false;
      if (state.x < 0 || state.x > width - objW) {
        state.vx *= -1;
        state.x = Math.max(0, Math.min(width - objW, state.x));
        bouncedX = true;
      }
      if (state.y < 0 || state.y > height - objH) {
        state.vy *= -1;
        state.y = Math.max(0, Math.min(height - objH, state.y));
        bouncedY = true;
      }
      if (bouncedX) playBounce();
      if (bouncedY) playBubble();
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (bgImgRef.current) {
        ctx.drawImage(bgImgRef.current, 0, 0, canvas.width, canvas.height);
      }
      const objW = Math.min(canvas.width, canvas.height) / 4;
      const objH = objW;
      for (let i = 0; i < objImgRefs.current.length; i++) {
        const img = objImgRefs.current[i];
        const state = objStates.current[i];
        if (!img || !state) continue;
        animateObject(state, objW, objH);
        const { x, y, angle } = state;
        ctx.save();
        ctx.translate(x + objW / 2, y + objH / 2);
        ctx.rotate(angle);
        ctx.drawImage(img, -objW / 2, -objH / 2, objW, objH);
        ctx.restore();
      }
      if (running) {
        animationRef.current = requestAnimationFrame(draw);
      }
    }

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [fillScreen, images]);

  // Responsive canvas size
  useEffect(() => {
    function resize() {
      if (fillScreen && canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    }
    if (fillScreen) {
      resize();
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }
  }, [fillScreen]);

  return (
    <canvas
      ref={canvasRef}
      width={fillScreen ? window.innerWidth : 500}
      height={fillScreen ? window.innerHeight : 400}
      style={{
        display: 'block',
        position: fillScreen ? 'fixed' : 'relative',
        top: 0,
        left: 0,
        width: fillScreen ? '100vw' : 500,
        height: fillScreen ? '100vh' : 400,
        zIndex: 1,
        background: '#222',
      }}
    />
  );
};

export default SceneCanvas; 