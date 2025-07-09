import React, { useState, useCallback } from "react";
import ImageUploader from "./components/ImageUploader";
import SceneCanvas from "./components/SceneCanvas";
import "./App.css";

const BACKGROUNDS = [
    {
        label: "zee",
        url: "https://static.vecteezy.com/system/resources/thumbnails/003/439/678/original/cartoon-background-underwater-sea-life-free-video.jpg",
    },
    {
        label: "regenboog",
        url: "https://static.vecteezy.com/system/resources/previews/002/127/582/non_2x/comic-background-with-rainbow-vector.jpg",
    },
    { label: "bos", url: "/public/backgrounds/forest.jpg" },
    { label: "ruimte", url: "/public/backgrounds/space.jpg" },
    { label: "mikki", url: "/public/backgrounds/kamer-mikki.jpg" },
];

// Helper to generate a unique ID
function genUID() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function App() {
    const [uploadedImage, setUploadedImage] = useState(null);
    const [processedImages, setProcessedImages] = useState([]);
    const [background, setBackground] = useState(BACKGROUNDS[0].url);
    const [loading, setLoading] = useState(false);

    // Add new processed image to the array
    const handleProcessed = useCallback((dataUrl) => {
        if (dataUrl) {
            setProcessedImages((prev) => [...prev, { img: dataUrl, uid: genUID() }]);
            setLoading(false);
            setUploadedImage(null); // allow re-uploading the same image
        }
    }, []);

    // When a new image is uploaded, process it
    const handleImageSelected = (img) => {
        setUploadedImage(img); // triggers processing in SceneCanvas
        setLoading(true);
    };

    // Duplicate an image when requested by SceneCanvas, at a given position
    const handleDuplicate = useCallback((img, pos, stickers) => {
        setProcessedImages((prev) => [...prev, { img, pos, stickers, uid: genUID() }]);
    }, []);

    // Remove an image when requested by SceneCanvas (bin drop)
    const handleRemove = useCallback((uid) => {
        setProcessedImages((prev) => prev.filter((obj) => obj.uid !== uid));
    }, []);

    // Convert processedImages to the format SceneCanvas expects (array of image URLs)
    const imageUrls = processedImages.map((obj) => (typeof obj === "string" ? obj : obj.img));
    const uids = processedImages.map((obj) => (typeof obj === "object" && obj.uid ? obj.uid : genUID()));
    const stickersList = processedImages.map((obj) => (typeof obj === "object" && obj.stickers ? obj.stickers : []));

    return (
        <div style={{ width: "100vw", height: "100vh", margin: 0, padding: 0, overflow: "hidden", position: "relative" }}>
            {/* Loader overlay */}
            {loading && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100vw",
                        height: "100vh",
                        background: "rgba(255,255,255,0.7)",
                        zIndex: 100,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: loading ? "auto" : "none",
                    }}
                >
                    <div
                        style={{
                            width: 64,
                            height: 64,
                            border: "8px solid #b3e5fc",
                            borderTop: "8px solid #0077ff",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite",
                        }}
                    />
                    <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            canvas {
              will-change: transform;
              transform: translateZ(0);
            }
          `}</style>
                </div>
            )}
            <div
                style={{
                    position: "absolute",
                    top: 12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 20,
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    background: "linear-gradient(90deg, #e0f7fa 0%, #b2ebf2 100%)",
                    border: "2px solid #0077ff",
                    borderRadius: 12,
                    padding: "10px 24px",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                    color: "#003366",
                    fontSize: 18,
                    fontWeight: 500,
                }}
            >
                <span style={{ fontWeight: 600, color: "#0077ff" }}></span>
                {BACKGROUNDS.map((bg) => (
                    <button
                        key={bg.url}
                        style={{
                            border: background === bg.url ? "2px solid #0077ff" : "1px solid #90caf9",
                            borderRadius: 8,
                            padding: "6px 16px",
                            background: background === bg.url ? "#e3f2fd" : "#fff",
                            color: background === bg.url ? "#0077ff" : "#003366",
                            cursor: "pointer",
                            fontWeight: background === bg.url ? 700 : 500,
                            transition: "all 0.2s",
                            boxShadow: background === bg.url ? "0 2px 8px #90caf9" : "none",
                        }}
                        onClick={() => setBackground(bg.url)}
                    >
                        {bg.label}
                    </button>
                ))}
            </div>
            <div
                style={{
                    position: "absolute",
                    top: 64,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 10,
                    background: "linear-gradient(90deg, #fffde4 0%, #f1f8e9 100%)",
                    border: "2px solid #43a047",
                    borderRadius: 12,
                    padding: "10px 24px",
                    boxShadow: "0 4px 16px rgba(67,160,71,0.10)",
                    color: "#1b5e20",
                    fontWeight: 500,
                }}
            >
                <ImageUploader onImageSelected={handleImageSelected} onLoading={setLoading} />
            </div>
            <SceneCanvas
                images={imageUrls}
                fillScreen
                onProcessed={handleProcessed}
                uploadedImage={uploadedImage}
                background={background}
                onDuplicate={handleDuplicate}
                duplicatePositions={processedImages.map((obj) => (typeof obj === "string" ? undefined : obj.pos))}
                stickersList={stickersList}
                onRemove={handleRemove}
                uids={uids}
            />
        </div>
    );
}

export default App;
