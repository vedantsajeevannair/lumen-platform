import sys
import cv2
import json
import requests
from pathlib import Path

def generate_output():
    img_path = str(Path(__file__).resolve().parent / "test_image.jpg")
    output_dir = Path(__file__).resolve().parent / "test_outputs"
    output_dir.mkdir(exist_ok=True)
    out_path = str(output_dir / "road_damage_threshold_060_test.png")
    
    # Read the image
    img = cv2.imread(img_path)
    if img is None:
        print("Failed to read image")
        sys.exit(1)
        
    print("Sending API request to localhost:8000...")
    try:
        resp = requests.post("http://localhost:8000/detect/image", json={"url": img_path}, timeout=60)
        data = resp.json()
    except Exception as e:
        print("Failed to get API response. Ensure API server is running.", e)
        # fallback for testing
        print("Trying local test_production_integration.py approach...")
        from fastapi.testclient import TestClient
        from app import app
        client = TestClient(app)
        resp = client.post("/detect/image", json={"url": img_path})
        data = resp.json()

    print("API Response:", data)
    
    # Draw boxes
    for box in data.get("boundingBoxes", []):
        x1, y1, x2, y2 = int(box["xMin"]), int(box["yMin"]), int(box["xMax"]), int(box["yMax"])
        conf = box["confidence"]
        label = box["label"]
        sev = data.get("severity", 0.0)
        
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 0, 255), 2)
        text = f"{label} (Conf:{conf:.2f} Sev:{sev:.1f})"
        cv2.putText(img, text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
        
    cv2.imwrite(out_path, img)
    print(f"Annotated image saved to {out_path}")

if __name__ == "__main__":
    generate_output()
