import React, { useEffect, useRef } from "react";

const UNDERSEA_WALLPAPERS = [
    "https://static.vecteezy.com/system/resources/thumbnails/003/439/678/original/cartoon-background-underwater-sea-life-free-video.jpg",
];

function rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    let s,
        v = max;
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
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i],
                g = data[i + 1],
                b = data[i + 2];
            // Remove white and near-white pixels
            if (isNearWhite(r, g, b)) {
                data[i + 3] = 0;
                continue;
            }
            // Remove only very light gray pixels (optional, for cleaner cutout)
            const [s, v] = rgbToHsv(r, g, b);
            if (s < 0.08 && v > 0.85) {
                data[i + 3] = 0;
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
    return {
        x: Math.random() * (width - objW),
        y: Math.random() * (height - objH),
        vx: (Math.random() - 0.5) * 3.5,
        vy: (Math.random() - 0.5) * 2.5,
        angle: ((Math.random() - 0.5) * 2 * Math.PI) / 4, // 45 degrees
        vAngle: (Math.random() - 0.5) * 0.01,
        initialized: true,
        stickers: [], // array of { id, emoji, relX, relY, relAngle }
    };
}

const BUBBLE_SOUND = "https://cdn.freesound.org/previews/193/193169_84709-lq.mp3";
const BOUNCE_SOUND = "https://cdn.freesound.org/previews/329/329944_5622625-lq.mp3";
const DEFAULT_BACKGROUND =
    "https://static.vecteezy.com/system/resources/thumbnails/003/439/678/original/cartoon-background-underwater-sea-life-free-video.jpg";

const SceneCanvas = ({
    images = [],
    fillScreen,
    onProcessed,
    uploadedImage,
    background,
    onDuplicate,
    duplicatePositions = [],
    stickersList = [],
    onRemove,
    uids = [],
}) => {
    const canvasRef = useRef();
    const bgImgRef = useRef(null);
    const objImgRefs = useRef([]); // array of Image objects
    const animationRef = useRef();
    const objStates = useRef([]); // array of animation states
    const bubbleAudioRef = useRef();
    const bounceAudioRef = useRef();
    const draggingRef = useRef({ index: null, offsetX: 0, offsetY: 0 });
    const [draggedIndex, setDraggedIndex] = React.useState(null);
    // Track if a drag occurred to prevent duplicate on drag
    const dragHappenedRef = useRef(false);
    // Track if a dragged object overlaps the bin (for highlight)
    const [binHighlighted, setBinHighlighted] = React.useState(false);
    // Bin sound
    const BIN_SOUND = "https://cdn.freesound.org/previews/562/562029_7107243-lq.mp3";
    const binAudioRef = useRef();
    // Add state for failed sticker preview
    const [failedSticker, setFailedSticker] = React.useState(null); // { sticker, x, y }
    // Debug: Track last dropped sticker and its object
    const debugStickerRefs = useRef([]); // Array of { stickerId, objectUid }
    // Scene effects state
    const EFFECTS = [
        { id: "bubbles", label: "bellen", emoji: "🫧" },
        { id: "sparkles", label: "glitters", emoji: "✨" },
        { id: "confetti", label: "confetti", emoji: "🎉" },
        { id: "snow", label: "sneeuw", emoji: "❄️" },
        { id: "pooprain", label: "poep", emoji: "💩" },
    ];
    const [activeEffect, setActiveEffect] = React.useState(null); // effect id
    // Effect particles state
    const effectParticles = useRef([]); // array of {x, y, vx, vy, ...}
    // Sticker drag state (move this up)
    const [draggingSticker, setDraggingSticker] = React.useState(null); // { sticker, x, y }
    // Add a flag to freeze animation when dragging a sticker
    const freezeObjects = !!draggingSticker;

    // Load the selected background image when background changes
    useEffect(() => {
        const bgImg = new window.Image();
        bgImg.crossOrigin = "anonymous";
        bgImg.src = background || DEFAULT_BACKGROUND;
        bgImg.onload = () => {
            bgImgRef.current = bgImg;
        };
    }, [background]);

    // If uploadedImage changes, process it and call onProcessed
    useEffect(() => {
        if (uploadedImage && onProcessed) {
            processImage(uploadedImage, onProcessed);
        }
        // eslint-disable-next-line
    }, [uploadedImage]);

    // When images or uids array changes, synchronize objStates.current to match
    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        // Build a map from all known UIDs to their states using state.uid
        const uidToState = {};
        for (let i = 0; i < objStates.current.length; i++) {
            const state = objStates.current[i];
            if (state && state.uid) {
                uidToState[state.uid] = state;
            }
        }
        // Rebuild objStates.current in the order of uids/images
        const newStates = [];
        for (let i = 0; i < images.length; i++) {
            const uid = uids[i];
            let state = uidToState[uid];
            if (!state) {
                // New image, create state
                const objW = Math.min(canvas.width, canvas.height) / 4;
                const objH = objW;
                const pos = duplicatePositions[i];
                const stickers = stickersList[i] || [];
                if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
                    const maxAngle = Math.PI / 4;
                    state = {
                        x: pos.x,
                        y: pos.y,
                        vx: (Math.random() - 0.5) * 3.5,
                        vy: (Math.random() - 0.5) * 2.5,
                        angle: (Math.random() - 0.5) * 2 * maxAngle,
                        vAngle: (Math.random() - 0.5) * 0.01,
                        initialized: true,
                        stickers: JSON.parse(JSON.stringify(stickers)), // deep copy
                        uid,
                    };
                } else {
                    state = createObjState(canvas, objW, objH);
                    state.uid = uid;
                    state.stickers = JSON.parse(JSON.stringify(stickers)); // deep copy
                }
            }
            newStates.push(state);
        }
        objStates.current = newStates;
        // Also sync objImgRefs.current
        if (objImgRefs.current.length !== images.length) {
            objImgRefs.current = objImgRefs.current.slice(0, images.length);
            for (let i = objImgRefs.current.length; i < images.length; i++) {
                const img = new window.Image();
                img.src = images[i];
                objImgRefs.current.push(img);
            }
        }
    }, [images, uids, fillScreen, duplicatePositions, stickersList]);

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

    // Prepare bin sound
    useEffect(() => {
        if (!binAudioRef.current) {
            binAudioRef.current = new window.Audio(BIN_SOUND);
            binAudioRef.current.volume = 0.7;
        }
    }, []);

    // Helper to check if a point is inside a rotated rectangle
    function isPointInRotatedRect(px, py, obj) {
        const { x, y, angle, w, h } = obj;
        // Center of object
        const cx = x + w / 2;
        const cy = y + h / 2;
        // Translate point to object center
        const dx = px - cx;
        const dy = py - cy;
        // Rotate point by -angle
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;
        // Check if inside unrotated rect
        return Math.abs(rx) <= w / 2 && Math.abs(ry) <= h / 2;
    }

    // Bin icon (SVG path or emoji)
    const BIN_SIZE = 80;
    const BIN_MARGIN_X = 120;
    const BIN_MARGIN_Y = 120;
    const BIN_TOUCH_EXTRA = -40; // smaller area for less forgiving bin collision
    const BIN_ICON = "🗑️"; // You can replace with a custom SVG if desired

    // Check if a rectangle (object) overlaps the bin's circle
    function rectOverlapsBin(rect, canvas) {
        const bx = canvas.width - BIN_SIZE - BIN_MARGIN_X + BIN_SIZE / 2;
        const by = canvas.height - BIN_SIZE - BIN_MARGIN_Y + BIN_SIZE / 2;
        const r = BIN_SIZE / 2 + BIN_TOUCH_EXTRA;
        // Find closest point on rect to bin center
        const closestX = Math.max(rect.x, Math.min(bx, rect.x + rect.w));
        const closestY = Math.max(rect.y, Math.min(by, rect.y + rect.h));
        const dx = closestX - bx;
        const dy = closestY - by;
        return dx * dx + dy * dy <= r * r;
    }

    // Handle click/tap to duplicate
    useEffect(() => {
        if (!canvasRef.current || !onDuplicate) return;
        const canvas = canvasRef.current;
        function handleClick(e) {
            // Prevent duplicate if a drag just happened
            if (dragHappenedRef.current) {
                dragHappenedRef.current = false;
                return;
            }
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
            const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
            const px = x * scaleX;
            const py = y * scaleY;
            const objW = Math.min(canvas.width, canvas.height) / 4;
            const objH = objW;
            // Find topmost object under pointer
            for (let i = objStates.current.length - 1; i >= 0; i--) {
                const state = objStates.current[i];
                if (!state) continue;
                if (px >= state.x && px <= state.x + objW && py >= state.y && py <= state.y + objH) {
                    // Duplicate the image at this index, at the click/touch position, with stickers
                    onDuplicate &&
                        onDuplicate(
                            images[i],
                            { x: px - objW / 2, y: py - objH / 2 },
                            JSON.parse(JSON.stringify(state.stickers || []))
                        );
                    break;
                }
            }
        }
        canvas.addEventListener("click", handleClick, { passive: true });
        // Do NOT add handleClick to touchstart; touch is handled by drag logic
        return () => {
            canvas.removeEventListener("click", handleClick, { passive: true });
            // No need to remove touchstart
        };
    }, [images, onDuplicate]);

    // Drag and drop handlers
    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        let dragOffsetX = 0;
        let dragOffsetY = 0;
        let pointerDown = false;
        let startX = 0,
            startY = 0;
        function getPointerPos(e) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
            const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
            return { px: x * scaleX, py: y * scaleY };
        }
        function handleDown(e) {
            pointerDown = true;
            const { px, py } = getPointerPos(e);
            startX = px;
            startY = py;
            const objW = Math.min(canvas.width, canvas.height) / 4;
            const objH = objW;
            for (let i = objStates.current.length - 1; i >= 0; i--) {
                const state = objStates.current[i];
                if (!state) continue;
                if (isPointInRotatedRect(px, py, { x: state.x, y: state.y, angle: state.angle, w: objW, h: objH })) {
                    dragOffsetX = px - state.x;
                    dragOffsetY = py - state.y;
                    draggingRef.current = { index: i, offsetX: dragOffsetX, offsetY: dragOffsetY };
                    setDraggedIndex(i);
                    e.preventDefault();
                    break;
                }
            }
        }
        function handleMove(e) {
            if (!pointerDown) return;
            const { px, py } = getPointerPos(e);
            // If pointer moved more than a threshold, consider it a drag
            if (Math.abs(px - startX) > 5 || Math.abs(py - startY) > 5) {
                dragHappenedRef.current = true;
            }
            if (!draggingRef.current || draggingRef.current.index === null) return;
            const i = draggingRef.current.index;
            const state = objStates.current[i];
            if (!state) return;
            state.x = px - draggingRef.current.offsetX;
            state.y = py - draggingRef.current.offsetY;
            // Clamp to canvas
            const objW = Math.min(canvas.width, canvas.height) / 4;
            const objH = objW;
            state.x = Math.max(0, Math.min(canvas.width - objW, state.x));
            state.y = Math.max(0, Math.min(canvas.height - objH, state.y));
            e.preventDefault();
        }
        function handleUp() {
            pointerDown = false;
            // If an object was dragged, give it a new random velocity
            if (draggingRef.current && draggingRef.current.index !== null) {
                const i = draggingRef.current.index;
                const state = objStates.current[i];
                if (state) {
                    const objW = Math.min(canvas.width, canvas.height) / 4;
                    const objH = objW;
                    const rect = { x: state.x, y: state.y, w: objW, h: objH };
                    // Always check overlap with bin at drag end, regardless of pointer
                    if (rectOverlapsBin(rect, canvas)) {
                        // Play bin sound
                        if (binAudioRef.current) {
                            try {
                                binAudioRef.current.currentTime = 0;
                                binAudioRef.current.play();
                            } catch {
                                // ignore play errors (e.g., user gesture required)
                            }
                        }
                        if (typeof window !== "undefined" && typeof onRemove === "function" && uids && uids[i]) {
                            onRemove(uids[i]);
                            // Immediately sync local arrays to new images prop after removal
                            setTimeout(() => {
                                objImgRefs.current = objImgRefs.current.slice(0, images.length - 1);
                                objStates.current = objStates.current.slice(0, images.length - 1);
                            }, 0);
                        } else {
                            images.splice(i, 1);
                            objImgRefs.current.splice(i, 1);
                            objStates.current.splice(i, 1);
                            if (duplicatePositions && duplicatePositions.length > i) duplicatePositions.splice(i, 1);
                        }
                        setDraggedIndex(null);
                        draggingRef.current = { index: null, offsetX: 0, offsetY: 0 };
                        return;
                    }
                    // Assign new random velocity and angular velocity
                    state.vx = (Math.random() - 0.5) * 3.5;
                    state.vy = (Math.random() - 0.5) * 2.5;
                    state.vAngle = (Math.random() - 0.5) * 0.01;
                }
            }
            draggingRef.current = { index: null, offsetX: 0, offsetY: 0 };
            setDraggedIndex(null);
            // dragHappenedRef will be reset on next click
        }
        canvas.addEventListener("mousedown", handleDown, { passive: false });
        canvas.addEventListener("touchstart", handleDown, { passive: false });
        window.addEventListener("mousemove", handleMove, { passive: false });
        window.addEventListener("touchmove", handleMove, { passive: false });
        window.addEventListener("mouseup", handleUp, { passive: false });
        window.addEventListener("touchend", handleUp, { passive: false });
        return () => {
            canvas.removeEventListener("mousedown", handleDown, { passive: false });
            canvas.removeEventListener("touchstart", handleDown, { passive: false });
            window.removeEventListener("mousemove", handleMove, { passive: false });
            window.removeEventListener("touchmove", handleMove, { passive: false });
            window.removeEventListener("mouseup", handleUp, { passive: false });
            window.removeEventListener("touchend", handleUp, { passive: false });
        };
    }, [images, onRemove]);

    // Animate all objects (move, bounce off walls/menus, then handle collisions)
    // (Moved below animateObject for correct function order)

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        let running = true;

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
            // --- Menu bounds for collision ---
            // Sticker palette (bottom left)
            const stickerMenuRect = {
                x: 24,
                y: height - 32 - 72, // bottom: 32, height: ~72
                w: 200, // palette width
                h: 72, // palette height
            };
            // Effects menu (left, above sticker palette)
            const effectsMenuRect = {
                x: 24,
                y: height - 130,
                w: 320, // menu width (adjust as needed)
                h: 60, // menu height
            };
            // Bin (bottom right)
            // Backgrounds menu (top center)
            const bgMenuW = 420,
                bgMenuH = 56;
            const bgMenuRect = {
                x: width / 2 - bgMenuW / 2,
                y: 12,
                w: bgMenuW,
                h: bgMenuH,
            };
            // Upload button (top center, below backgrounds menu)
            const uploadBtnW = 340,
                uploadBtnH = 56;
            const uploadBtnRect = {
                x: width / 2 - uploadBtnW / 2,
                y: 64,
                w: uploadBtnW,
                h: uploadBtnH,
            };
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
            if (state.angle > Math.PI / 4) {
                state.angle = Math.PI / 4;
                state.vAngle *= -1;
            } else if (state.angle < -Math.PI / 4) {
                state.angle = -Math.PI / 4;
                state.vAngle *= -1;
            }
            // --- Bounce off canvas edges ---
            let bouncedX = false;
            let bouncedY = false;
            if (state.x < 0) {
                state.vx *= -1;
                state.x = 0;
                bouncedX = true;
            } else if (state.x > width - objW) {
                state.vx *= -1;
                state.x = width - objW;
                bouncedX = true;
            }
            if (state.y < 0) {
                state.vy *= -1;
                state.y = 0;
                bouncedY = true;
            } else if (state.y > height - objH) {
                state.vy *= -1;
                state.y = height - objH;
                bouncedY = true;
            }
            // --- Bounce off sticker palette ---
            if (
                state.x < stickerMenuRect.x + stickerMenuRect.w &&
                state.x + objW > stickerMenuRect.x &&
                state.y < stickerMenuRect.y + stickerMenuRect.h &&
                state.y + objH > stickerMenuRect.y
            ) {
                // Bounce horizontally
                if (state.x + objW / 2 < stickerMenuRect.x + stickerMenuRect.w / 2) {
                    state.x = stickerMenuRect.x - objW;
                } else {
                    state.x = stickerMenuRect.x + stickerMenuRect.w;
                }
                state.vx *= -1;
                bouncedX = true;
            }
            // --- Bounce off effects menu ---
            if (
                state.x < effectsMenuRect.x + effectsMenuRect.w &&
                state.x + objW > effectsMenuRect.x &&
                state.y < effectsMenuRect.y + effectsMenuRect.h &&
                state.y + objH > effectsMenuRect.y
            ) {
                if (state.y + objH / 2 < effectsMenuRect.y + effectsMenuRect.h / 2) {
                    state.y = effectsMenuRect.y - objH;
                } else {
                    state.y = effectsMenuRect.y + effectsMenuRect.h;
                }
                state.vy *= -1;
                bouncedY = true;
            }
            // --- Bounce off backgrounds menu ---
            if (
                state.x < bgMenuRect.x + bgMenuRect.w &&
                state.x + objW > bgMenuRect.x &&
                state.y < bgMenuRect.y + bgMenuRect.h &&
                state.y + objH > bgMenuRect.y
            ) {
                if (state.y + objH / 2 < bgMenuRect.y + bgMenuRect.h / 2) {
                    state.y = bgMenuRect.y - objH;
                } else {
                    state.y = bgMenuRect.y + bgMenuRect.h;
                }
                state.vy *= -1;
                bouncedY = true;
            }
            // --- Bounce off upload button ---
            if (
                state.x < uploadBtnRect.x + uploadBtnRect.w &&
                state.x + objW > uploadBtnRect.x &&
                state.y < uploadBtnRect.y + uploadBtnRect.h &&
                state.y + objH > uploadBtnRect.y
            ) {
                if (state.y + objH / 2 < uploadBtnRect.y + uploadBtnRect.h / 2) {
                    state.y = uploadBtnRect.y - objH;
                } else {
                    state.y = uploadBtnRect.y + uploadBtnRect.h;
                }
                state.vy *= -1;
                bouncedY = true;
            }
            if (bouncedX) playBounce();
            if (bouncedY) playBubble();
        }

        function animateAllObjects(objStatesArr, objW, objH) {
            // Move and bounce off walls/menus only
            for (let i = 0; i < objStatesArr.length; i++) {
                animateObject(objStatesArr[i], objW, objH);
            }
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (bgImgRef.current) {
                ctx.drawImage(bgImgRef.current, 0, 0, canvas.width, canvas.height);
            }
            // --- Scene Effects ---
            // Animate and draw effect particles
            if (activeEffect) {
                // Initialize particles if needed
                if (effectParticles.current.length === 0) {
                    const w = canvas.width,
                        h = canvas.height;
                    if (activeEffect === "bubbles") {
                        for (let i = 0; i < 18; i++) {
                            effectParticles.current.push({
                                x: Math.random() * w,
                                y: h + Math.random() * 100,
                                r: 12 + Math.random() * 16,
                                vy: -1.2 - Math.random() * 1.2,
                                alpha: 0.5 + Math.random() * 0.5,
                            });
                        }
                    } else if (activeEffect === "sparkles") {
                        for (let i = 0; i < 32; i++) {
                            effectParticles.current.push({
                                x: Math.random() * w,
                                y: Math.random() * h,
                                r: 6 + Math.random() * 8,
                                vy: -0.2 + Math.random() * 0.4,
                                vx: -0.2 + Math.random() * 0.4,
                                alpha: 0.7 + Math.random() * 0.3,
                                t: Math.random() * Math.PI * 2,
                            });
                        }
                    } else if (activeEffect === "confetti") {
                        for (let i = 0; i < 36; i++) {
                            effectParticles.current.push({
                                x: Math.random() * w,
                                y: -Math.random() * 100,
                                vy: 1.5 + Math.random() * 1.5,
                                vx: -1 + Math.random() * 2,
                                color: `hsl(${Math.floor(Math.random() * 360)},90%,60%)`,
                                size: 8 + Math.random() * 8,
                                angle: Math.random() * Math.PI * 2,
                                spin: -0.1 + Math.random() * 0.2,
                            });
                        }
                    } else if (activeEffect === "snow") {
                        for (let i = 0; i < 28; i++) {
                            effectParticles.current.push({
                                x: Math.random() * w,
                                y: -Math.random() * 100,
                                vy: 0.6 + Math.random() * 0.7,
                                vx: -0.3 + Math.random() * 0.6,
                                r: 7 + Math.random() * 7,
                                alpha: 0.7 + Math.random() * 0.3,
                            });
                        }
                    } else if (activeEffect === 'pooprain') {
                        // Poop rain: spawn falling 💩 emojis
                        for (let i = 0; i < 24; i++) {
                            effectParticles.current.push({
                                x: Math.random() * w,
                                y: Math.random() * -h,
                                vy: 2.2 + Math.random() * 2.2,
                                size: 32 + Math.random() * 24,
                                rot: Math.random() * Math.PI * 2,
                                vrot: (Math.random() - 0.5) * 0.04,
                                alpha: 0.92 + Math.random() * 0.08,
                            });
                        }
                    }
                }
                // Animate and draw particles
                if (activeEffect === "bubbles") {
                    for (const p of effectParticles.current) {
                        p.y += p.vy;
                        p.alpha -= 0.0015;
                        ctx.save();
                        ctx.globalAlpha = Math.max(0, p.alpha);
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
                        ctx.strokeStyle = "#b3e5fc";
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        ctx.restore();
                        if (p.y + p.r < 0 || p.alpha <= 0) {
                            p.x = Math.random() * canvas.width;
                            p.y = canvas.height + Math.random() * 100;
                            p.r = 12 + Math.random() * 16;
                            p.vy = -1.2 - Math.random() * 1.2;
                            p.alpha = 0.5 + Math.random() * 0.5;
                        }
                    }
                } else if (activeEffect === "sparkles") {
                    for (const p of effectParticles.current) {
                        p.x += p.vx;
                        p.y += p.vy;
                        p.t += 0.2;
                        ctx.save();
                        ctx.globalAlpha = Math.max(0, p.alpha * (0.7 + 0.3 * Math.sin(p.t)));
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.r * (0.7 + 0.3 * Math.abs(Math.sin(p.t))), 0, 2 * Math.PI);
                        ctx.fillStyle = "#fffde7";
                        ctx.shadowColor = "#fff9c4";
                        ctx.shadowBlur = 12;
                        ctx.fill();
                        ctx.restore();
                        if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
                            p.x = Math.random() * canvas.width;
                            p.y = Math.random() * canvas.height;
                            p.t = Math.random() * Math.PI * 2;
                        }
                    }
                } else if (activeEffect === "confetti") {
                    for (const p of effectParticles.current) {
                        p.x += p.vx;
                        p.y += p.vy;
                        p.angle += p.spin;
                        ctx.save();
                        ctx.translate(p.x, p.y);
                        ctx.rotate(p.angle);
                        ctx.fillStyle = p.color;
                        ctx.fillRect(-p.size / 2, -p.size / 6, p.size, p.size / 3);
                        ctx.restore();
                        if (p.y - p.size > canvas.height) {
                            p.x = Math.random() * canvas.width;
                            p.y = -Math.random() * 100;
                            p.vy = 1.5 + Math.random() * 1.5;
                            p.vx = -1 + Math.random() * 2;
                            p.angle = Math.random() * Math.PI * 2;
                        }
                    }
                } else if (activeEffect === "snow") {
                    for (const p of effectParticles.current) {
                        p.x += p.vx;
                        p.y += p.vy;
                        ctx.save();
                        ctx.globalAlpha = Math.max(0, p.alpha);
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
                        ctx.fillStyle = "#fff";
                        ctx.shadowColor = "#e3f2fd";
                        ctx.shadowBlur = 8;
                        ctx.fill();
                        ctx.restore();
                        if (p.y - p.r > canvas.height) {
                            p.x = Math.random() * canvas.width;
                            p.y = -Math.random() * 100;
                            p.vy = 0.6 + Math.random() * 0.7;
                            p.vx = -0.3 + Math.random() * 0.6;
                        }
                    }
                } else if (activeEffect === 'pooprain') {
                    ctx.save();
                    for (const p of effectParticles.current) {
                        p.y += p.vy;
                        p.rot += p.vrot;
                        if (p.y > canvas.height + 40) {
                            p.x = Math.random() * canvas.width;
                            p.y = Math.random() * -60;
                            p.vy = 2.2 + Math.random() * 2.2;
                            p.size = 32 + Math.random() * 24;
                            p.rot = Math.random() * Math.PI * 2;
                            p.vrot = (Math.random() - 0.5) * 0.04;
                            p.alpha = 0.92 + Math.random() * 0.08;
                        }
                        ctx.save();
                        ctx.globalAlpha = p.alpha;
                        ctx.translate(p.x, p.y);
                        ctx.rotate(p.rot);
                        ctx.font = `${p.size}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('💩', 0, 0);
                        ctx.restore();
                    }
                    ctx.restore();
                }
            }
            const objW = Math.min(canvas.width, canvas.height) / 4;
            const objH = objW;
            // Animate all objects (move, bounce, and handle collisions)
            if (!freezeObjects) {
                animateAllObjects(objStates.current, objW, objH);
            }
            // When freezeObjects is true, do NOT animate any object, including individually below
            let highlightBin = false;
            for (let i = 0; i < objImgRefs.current.length; i++) {
                const img = objImgRefs.current[i];
                const state = objStates.current[i];
                if (!img || !state) continue;
                // Do not animate any object if freezeObjects is true
                if (!freezeObjects && draggedIndex !== i) animateObject(state, objW, objH);
                const { x, y, angle, stickers = [], uid } = state;
                ctx.save();
                ctx.translate(x + objW / 2, y + objH / 2);
                ctx.rotate(angle);
                // Highlight and scale up if dragging
                if (draggedIndex === i) {
                    ctx.shadowColor = "#0077ff";
                    ctx.shadowBlur = 24;
                    ctx.globalAlpha = 0.85;
                    ctx.scale(1.2, 1.2);
                    // Check overlap for highlight
                    const rect = { x: state.x, y: state.y, w: objW, h: objH };
                    if (rectOverlapsBin(rect, canvas)) highlightBin = true;
                }
                ctx.drawImage(img, -objW / 2, -objH / 2, objW, objH);
                // Draw attached stickers
                for (const sticker of stickers) {
                    ctx.save();
                    ctx.translate(sticker.relX, sticker.relY);
                    ctx.rotate(sticker.relAngle || 0);
                    ctx.font = "36px sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.globalAlpha = 1;
                    ctx.fillText(sticker.emoji, 0, 0);
                    ctx.restore();
                    // Debug: Check if sticker is moving with the correct object
                    const debugRef = debugStickerRefs.current.find((ref) => ref.stickerId === sticker.id);
                    if (debugRef && debugRef.objectUid !== uid) {
                        console.warn("Sticker", sticker.id, "is not attached to the correct object!", {
                            sticker,
                            objectUid: uid,
                            expectedUid: debugRef.objectUid,
                        });
                    }
                }
                ctx.restore();
            }
            // Update bin highlight state (for accessibility, not strictly needed)
            if (binHighlighted !== highlightBin) setBinHighlighted(highlightBin);
            // Draw bin in bottom right
            ctx.save();
            ctx.font = `${BIN_SIZE - 8}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.globalAlpha = 0.92;
            const bx = canvas.width - BIN_SIZE - BIN_MARGIN_X + BIN_SIZE / 2;
            const by = canvas.height - BIN_SIZE - BIN_MARGIN_Y + BIN_SIZE / 2;
            ctx.beginPath();
            ctx.arc(bx, by, BIN_SIZE / 2 + 16, 0, 2 * Math.PI);
            ctx.fillStyle = highlightBin ? "#ffeb3b" : draggedIndex !== null ? "#fff8" : "#fff6";
            if (highlightBin) {
                ctx.shadowColor = "#ff9800";
                ctx.shadowBlur = 32;
            }
            ctx.fill();
            ctx.strokeStyle = "#888";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = "#333";
            ctx.fillText(BIN_ICON, bx, by + 4);
            ctx.restore();
            if (running) {
                animationRef.current = requestAnimationFrame(draw);
            }
        }

        animationRef.current = requestAnimationFrame(draw);

        return () => {
            running = false;
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [fillScreen, images, draggedIndex, binHighlighted, activeEffect, freezeObjects]);

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
            window.addEventListener("resize", resize);
            return () => window.removeEventListener("resize", resize);
        }
    }, [fillScreen]);

    // Responsive UI scaling
    const isMobile = typeof window !== "undefined" && window.innerWidth < 700;
    // Sizes for menus/buttons
    const btnFont = isMobile ? 14 : 22;
    const btnPad = isMobile ? "4px 8px" : "6px 16px";

    // Layout constants for menu alignment
    const stickerMenuHeight = isMobile ? 48 : 72;
    const effectsMenuGap = isMobile ? 8 : 16;
    const bottomMargin = isMobile ? 16 : 32;

    // Calculate menu positions so they never stack
    const stickerMenuBottom = bottomMargin;
    const effectsMenuBottom = stickerMenuBottom + stickerMenuHeight + effectsMenuGap;

    // Sticker palette (simple emoji for now)
    const STICKERS = [
        { id: "star", label: "Star", emoji: "⭐️" },
        { id: "heart", label: "Heart", emoji: "❤️" },
        { id: "hat", label: "Hat", emoji: "🎩" },
        { id: "glasses", label: "Glasses", emoji: "🕶️" },
        { id: "flower", label: "Flower", emoji: "🌸" },
        { id: "unicorn", label: "Unicorn", emoji: "🦄" },
        { id: "poop", label: "Poop", emoji: "💩" },
    ];
    const draggingStickerRef = useRef(null);
    // Handle sticker drag start
    function handleStickerMouseDown(sticker, e) {
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const dragObj = { sticker, x: clientX, y: clientY };
        draggingStickerRef.current = dragObj;
        setDraggingSticker(dragObj);
        window.addEventListener("mousemove", handleStickerMove, { passive: false });
        window.addEventListener("touchmove", handleStickerMove, { passive: false });
        window.addEventListener("mouseup", handleStickerUp, { passive: false });
        window.addEventListener("touchend", handleStickerUp, { passive: false });
    }
    function handleStickerMove(e) {
        if (!draggingStickerRef.current) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        draggingStickerRef.current.x = clientX;
        draggingStickerRef.current.y = clientY;
        setDraggingSticker({ ...draggingStickerRef.current }); // trigger re-render
        e.preventDefault();
    }
    function handleStickerUp() {
        // Only remove event listeners, do not clear draggingStickerRef or setDraggingSticker here
        window.removeEventListener("mousemove", handleStickerMove, { passive: false });
        window.removeEventListener("touchmove", handleStickerMove, { passive: false });
        window.removeEventListener("mouseup", handleStickerUp, { passive: false });
        window.removeEventListener("touchend", handleStickerUp, { passive: false });
    }

    // On sticker drop, attach to object if over one
    React.useEffect(() => {
        if (!draggingSticker) return;
        function handleStickerDrop() {
            if (!draggingStickerRef.current) return;
            const canvas = canvasRef.current;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const clientX = draggingStickerRef.current.x;
            const clientY = draggingStickerRef.current.y;
            const px = (clientX - rect.left) * scaleX;
            const py = (clientY - rect.top) * scaleY;
            const objW = Math.min(canvas.width, canvas.height) / 4;
            const objH = objW;
            let stuck = false;
            // Find topmost object under pointer, with a smaller margin
            const STICK_MARGIN = Math.max(objW, objH) * 0.12; // 12% margin around object (smaller, more precise)
            let topmostIndex = -1;
            // First, try to find the topmost object under the pointer (rotated bounding box)
            for (let i = objStates.current.length - 1; i >= 0; i--) {
                const state = objStates.current[i];
                if (!state) continue;
                const marginW = objW + 2 * STICK_MARGIN;
                const marginH = objH + 2 * STICK_MARGIN;
                if (
                    isPointInRotatedRect(px, py, {
                        x: state.x - STICK_MARGIN,
                        y: state.y - STICK_MARGIN,
                        angle: state.angle,
                        w: marginW,
                        h: marginH,
                    })
                ) {
                    topmostIndex = i;
                    break;
                }
            }
            // If not found, try to find a sticker under the pointer and attach to its object
            if (topmostIndex === -1) {
                outer: for (let i = objStates.current.length - 1; i >= 0; i--) {
                    const state = objStates.current[i];
                    if (!state || !state.stickers) continue;
                    for (const sticker of state.stickers) {
                        // Transform sticker relX/relY to global coordinates
                        const objW = Math.min(canvas.width, canvas.height) / 4;
                        const objH = objW;
                        const cx = state.x + objW / 2;
                        const cy = state.y + objH / 2;
                        const cos = Math.cos(state.angle);
                        const sin = Math.sin(state.angle);
                        const globalX = cx + sticker.relX * cos - sticker.relY * sin;
                        const globalY = cy + sticker.relX * sin + sticker.relY * cos;
                        // Check if pointer is near this sticker (radius 32px)
                        const dist = Math.sqrt((px - globalX) ** 2 + (py - globalY) ** 2);
                        if (dist < 32) {
                            topmostIndex = i;
                            break outer;
                        }
                    }
                }
            }
            if (topmostIndex !== -1) {
                const state = objStates.current[topmostIndex];
                const objW = Math.min(canvas.width, canvas.height) / 4;
                const objH = objW;
                const cx = state.x + objW / 2;
                const cy = state.y + objH / 2;
                const dx = px - cx;
                const dy = py - cy;
                const cos = Math.cos(-state.angle);
                const sin = Math.sin(-state.angle);
                let relX = dx * cos - dy * sin;
                let relY = dx * sin + dy * cos;
                const clampedRelX = Math.max(-objW / 2, Math.min(objW / 2, relX));
                const clampedRelY = Math.max(-objH / 2, Math.min(objH / 2, relY));
                state.stickers = state.stickers || [];
                const stickerObj = {
                    id: draggingSticker.sticker.id + "-" + Date.now() + "-" + Math.random().toString(36).slice(2),
                    emoji: draggingSticker.sticker.emoji,
                    relX: clampedRelX,
                    relY: clampedRelY,
                    relAngle: 0,
                };
                state.stickers.push(stickerObj);
                // Debug: Track which object this sticker was added to
                debugStickerRefs.current.push({ stickerId: stickerObj.id, objectUid: state.uid });
                stuck = true;
            }
            if (!stuck) {
                // Sticker did not stick to any object, show fade-out preview then remove
                setFailedSticker({ ...draggingSticker });
                setTimeout(() => setFailedSticker(null), 400);
            }
            setDraggingSticker(null);
            draggingStickerRef.current = null;
            window.removeEventListener("mouseup", handleStickerDrop, { passive: false });
            window.removeEventListener("touchend", handleStickerDrop, { passive: false });
        }
        window.addEventListener("mouseup", handleStickerDrop, { passive: false });
        window.addEventListener("touchend", handleStickerDrop, { passive: false });
        return () => {
            window.removeEventListener("mouseup", handleStickerDrop, { passive: false });
            window.removeEventListener("touchend", handleStickerDrop, { passive: false });
        };
    }, [draggingSticker]);

    // Ensure canvas always fits viewport and page never scrolls
    React.useEffect(() => {
        document.body.style.overflow = "hidden";
        document.body.style.margin = "0";
        document.body.style.padding = "0";
        return () => {
            document.body.style.overflow = "";
            document.body.style.margin = "";
            document.body.style.padding = "";
        };
    }, []);

    return (
        <div style={{ position: "relative", width: fillScreen ? "100vw" : 500, height: fillScreen ? "100vh" : 400 }}>
            <canvas
                ref={canvasRef}
                width={fillScreen ? window.innerWidth : 500}
                height={fillScreen ? window.innerHeight : 400}
                style={{
                    display: "block",
                    position: fillScreen ? "fixed" : "relative",
                    top: 0,
                    left: 0,
                    width: fillScreen ? "100vw" : 500,
                    height: fillScreen ? "100vh" : 400,
                    zIndex: 1,
                    background: "#222",
                }}
            />
            {/* Sticker palette UI */}
            <div
                style={{
                    position: "absolute",
                    left: 24,
                    bottom: stickerMenuBottom,
                    zIndex: 10,
                    display: "flex",
                    gap: isMobile ? 10 : 18,
                    background: "rgba(255,255,255,0.85)",
                    borderRadius: 18,
                    padding: isMobile ? "6px 10px" : "12px 20px",
                    boxShadow: "0 2px 12px #0002",
                    alignItems: "center",
                    userSelect: "none",
                }}
            >
                {STICKERS.map((sticker) => (
                    <span
                        key={sticker.id}
                        title={sticker.label}
                        style={{
                            fontSize: isMobile ? 24 : 36,
                            cursor: "grab",
                            filter:
                                draggingSticker && draggingSticker.sticker.id === sticker.id ? "brightness(0.7)" : "none",
                            transition: "filter 0.2s",
                        }}
                        onMouseDown={(e) => handleStickerMouseDown(sticker, e)}
                        onTouchStart={(e) => handleStickerMouseDown(sticker, e)}
                        role="button"
                        tabIndex={0}
                        aria-label={sticker.label}
                    >
                        {sticker.emoji}
                    </span>
                ))}
            </div>
            {/* Scene Effects Menu */}
            <div
                style={{
                    position: "absolute",
                    left: 24,
                    bottom: effectsMenuBottom,
                    zIndex: 20,
                    display: "flex",
                    flexDirection: "row",
                    gap: isMobile ? 6 : 12,
                    background: "linear-gradient(90deg, #e0f7fa 0%, #b2ebf2 100%)",
                    border: "2px solid #0077ff",
                    borderRadius: 12,
                    padding: isMobile ? "6px 10px" : "10px 24px",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                    alignItems: "center",
                    userSelect: "none",
                }}
            >
                {EFFECTS.map((effect) => (
                    <button
                        key={effect.id}
                        style={{
                            border: activeEffect === effect.id ? "2px solid #0077ff" : "1px solid #90caf9",
                            borderRadius: 8,
                            padding: btnPad,
                            background: activeEffect === effect.id ? "#e3f2fd" : "#fff",
                            color: activeEffect === effect.id ? "#0077ff" : "#003366",
                            cursor: "pointer",
                            fontWeight: activeEffect === effect.id ? 700 : 500,
                            fontSize: btnFont,
                            transition: "all 0.2s",
                            boxShadow: activeEffect === effect.id ? "0 2px 8px #90caf9" : "none",
                            outline: "none",
                            marginLeft: 0,
                        }}
                        onClick={() => {
                            setActiveEffect(activeEffect === effect.id ? null : effect.id);
                            effectParticles.current = [];
                        }}
                        aria-label={effect.label}
                    >
                        <span style={{ fontSize: isMobile ? 18 : 28, marginRight: isMobile ? 2 : 6 }}>{effect.emoji}</span>{" "}
                        {effect.label}
                    </button>
                ))}
            </div>
            {/* Dragging sticker preview */}
            {draggingSticker && (
                <div
                    style={{
                        position: "fixed",
                        left: draggingSticker.x - 24,
                        top: draggingSticker.y - 24,
                        pointerEvents: "none",
                        fontSize: 48,
                        zIndex: 1000,
                        opacity: 0.85,
                    }}
                >
                    {draggingSticker.sticker.emoji}
                </div>
            )}
            {/* Failed sticker fade-out preview */}
            {failedSticker && (
                <div
                    style={{
                        position: "fixed",
                        left: failedSticker.x - 24,
                        top: failedSticker.y - 24,
                        pointerEvents: "none",
                        fontSize: 48,
                        zIndex: 1000,
                        opacity: 0.85,
                        transition: "opacity 0.4s",
                        animation: "fadeSticker 0.4s linear",
                    }}
                >
                    {failedSticker.sticker.emoji}
                    <style>{`@keyframes fadeSticker { from { opacity: 0.85; } to { opacity: 0; } }`}</style>
                </div>
            )}
        </div>
    );
};

export default SceneCanvas;
