# Road Damage Detection (RDD2022) Training Guide

## 1. Dataset Location & Structure
The RDD2022 dataset is located at `Ai-Dataset/Road_Damage_Dataset/`.
It contains 47,420 images and corresponding YOLO-format `.txt` labels across three splits:
- `train/` (32,628 images)
- `val/` (5,757 images)
- `test/` (9,035 images)

Classes defined in `data.yaml`:
1. `Longitudinal` (D00)
2. `Transverse` (D10)
3. `Alligator` (D20)
4. `Pothole` (D40)

## 2. Dataset Validation
Before training, it is highly recommended to validate the dataset for corrupted files, out-of-bounds coordinates, or missing annotations.
```bash
python dataset_tools/validate_rdd2022.py
```
This script outputs a detailed markdown report in `dataset_tools/reports/` and preview images in `dataset_tools/previews/rdd2022/`.

## 3. Training Requirements & GPU Setup
Ensure you have the Python dependencies installed (`torch`, `ultralytics`, `opencv-python`).
The training script will automatically detect and select the best compute device (`cuda` > `mps` > `cpu`).
To enforce a specific device, set the `AI_DEVICE` environment variable (e.g. `AI_DEVICE=cuda:0`).

## 4. Training Command
To train the YOLO11 Nano model on the RDD2022 dataset:
```bash
python training/train_rdd2022.py
```
This will:
- Load `models/yolo11n.pt` as the base model.
- Run training for 100 epochs by default.
- Export results to timestamped folders under `runs/`.
- Copy the final best weights to `models/rdd2022_best.pt`.
- Produce metadata in `models/rdd2022_metadata.json`.

**Configuration Environment Variables:**
- `RDDR_EPOCHS` (default: 100)
- `RDDR_IMAGE_SIZE` (default: 640)
- `RDDR_BATCH_SIZE` (default: 16)
- `AI_DEVICE` (default: auto)

## 5. Model Output & Evaluation
When training completes successfully, a summary report is written to `dataset_tools/reports/rdd2022_training_report.md`.
You can view detailed curves (PR, F1, Loss) and the confusion matrix inside your `runs/rdd2022_train_{timestamp}/` directory.

## 6. FastAPI Endpoint Integration
The trained model (`models/rdd2022_best.pt`) is integrated automatically into the LUMEN AI Service via the `/api/v1/detection/road-damage` endpoint. 

### Example API Request (cURL)
```bash
curl -X POST "http://localhost:8000/api/v1/detection/road-damage" \
     -H "accept: application/json" \
     -H "Content-Type: multipart/form-data" \
     -F "image=@sample_road.jpg"
```

### Example API Response
```json
{
  "success": true,
  "model": "rdd2022_best.pt",
  "model_version": "1.0.0",
  "inference_time_ms": 45.2,
  "detections": [
    {
      "class_id": 3,
      "class_name": "Pothole",
      "confidence": 0.89,
      "bbox": {
        "x1": 150.5,
        "y1": 200.2,
        "x2": 450.0,
        "y2": 520.1
      }
    }
  ]
}
```

## 7. Troubleshooting
- **Model weights not found:** Ensure you have completed the training process successfully and `models/rdd2022_best.pt` exists.
- **CUDA OOM Errors:** Lower the batch size by exporting `RDDR_BATCH_SIZE=8` (or lower) before running `train_rdd2022.py`.
- **Validation Script fails to find dataset:** Ensure the current working directory is the `Lumen-ai` root folder.
