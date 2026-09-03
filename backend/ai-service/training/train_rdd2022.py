import os
import shutil
import json
import yaml
from pathlib import Path
from datetime import datetime
import torch
from ultralytics import YOLO

def check_gpu():
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        gpu_memory = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
        print(f"CUDA is available: {torch.version.cuda}")
        print(f"PyTorch version: {torch.__version__}")
        print(f"GPU: {gpu_name}")
        print(f"Memory: {gpu_memory:.2f} GB")
        return "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        print("Apple MPS backend is available.")
        return "mps"
    else:
        print("CUDA is unavailable. Falling back to CPU.")
        return "cpu"

def main():
    base_dir = Path(__file__).resolve().parent.parent
    
    # Configuration
    dataset_yaml = os.getenv("RDDR_DATASET_YAML", str(base_dir / ".." / "Ai-Dataset" / "Road_Damage_Dataset" / "data.yaml"))
    dataset_yaml = str(Path(dataset_yaml).resolve())
    base_model = os.getenv("RDDR_BASE_MODEL", str(base_dir / "models" / "yolo11n.pt"))
    epochs = int(os.getenv("RDDR_EPOCHS", "50"))
    img_size = int(os.getenv("RDDR_IMAGE_SIZE", "640"))
    batch_size = int(os.getenv("RDDR_BATCH_SIZE", "16"))
    patience = int(os.getenv("RDDR_PATIENCE", "0"))
    workers = int(os.getenv("RDDR_WORKERS", "4"))
    
    # Experiment path
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    experiment_name = f"rdd2022_train_{timestamp}"
    project_dir = base_dir / "runs"
    
    # Final models dir
    models_dir = base_dir / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Verify Dataset config exists
    if not Path(dataset_yaml).exists():
        raise FileNotFoundError(f"Dataset configuration not found at {dataset_yaml}")
        
    with open(dataset_yaml, 'r') as f:
        data_cfg = yaml.safe_load(f)
        
    classes = data_cfg.get('names', [])
    if isinstance(classes, dict):
        classes = [classes[i] for i in range(len(classes))]
    nc = int(data_cfg.get('nc', len(classes)))
    
    print(f"\n--- RDD2022 Training Pipeline ---")
    print(f"Dataset: {dataset_yaml}")
    print(f"Classes ({nc}): {classes}")
    print(f"Base Model: {base_model}")
    print(f"Epochs: {epochs}")
    print(f"Batch Size: {batch_size}")
    print(f"Image Size: {img_size}")
    
    device = os.getenv("AI_DEVICE", "auto")
    if device == "auto":
        device = check_gpu()
        
    # 2. Load model
    print(f"\nLoading base model {base_model}...")
    model = YOLO(base_model)
    
    # 3. Train
    print("\nStarting training...")
    try:
        results = model.train(
            data=dataset_yaml,
            epochs=epochs,
            imgsz=img_size,
            batch=batch_size,
            patience=patience,
            workers=workers,
            device=device,
            project=str(project_dir),
            name=experiment_name,
            exist_ok=True,
            # Augmentations suitable for road damage
            degrees=5.0,
            translate=0.1,
            scale=0.2,
            fliplr=0.5,
            hsv_h=0.015,
            hsv_s=0.7,
            hsv_v=0.4
        )
    except Exception as e:
        print(f"Training failed: {e}")
        return

    # 4. Save best model and metadata
    best_model_path = project_dir / experiment_name / "weights" / "best.pt"
    if best_model_path.exists():
        final_model_path = models_dir / "rdd2022_best.pt"
        shutil.copy2(best_model_path, final_model_path)
        print(f"\nSuccessfully copied best model to {final_model_path}")
        
        # Metadata
        metadata = {
            "model_name": "rdd2022",
            "model_version": "1.0.0",
            "base_model": Path(base_model).name,
            "dataset": "RDD2022",
            "dataset_images": 47420,
            "classes": classes,
            "training_date": datetime.now().isoformat(),
            "image_size": img_size,
            "experiment_dir": str(project_dir / experiment_name)
        }
        
        metadata_path = models_dir / "rdd2022_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=4)
        print(f"Metadata saved to {metadata_path}")
        
        # Generate simple report
        report_dir = base_dir / "dataset_tools" / "reports"
        report_dir.mkdir(parents=True, exist_ok=True)
        report_path = report_dir / "rdd2022_training_report.md"
        
        with open(report_path, 'w') as f:
            f.write("# RDD2022 Training Report\n\n")
            f.write(f"- **Dataset:** RDD2022\n")
            f.write(f"- **Training Date:** {metadata['training_date']}\n")
            f.write(f"- **Device:** {device}\n")
            f.write(f"- **Classes:** {classes}\n")
            f.write(f"- **Model Output:** `{final_model_path}`\n")
            f.write(f"- **Experiment Directory:** `{project_dir / experiment_name}`\n")
            f.write("\n*(Check the experiment directory for detailed evaluation curves, PR curves, and confusion matrix).*")
            
        print(f"Training report saved to {report_path}")
    else:
        print(f"WARNING: Best model not found at {best_model_path}")

if __name__ == "__main__":
    main()
