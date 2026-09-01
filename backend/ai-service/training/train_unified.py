from ultralytics import YOLO

def main():
    # 1. Load the strongest compatible checkpoint (RDD2022)
    # This model already predicts the exactly matching 4 classes 
    # (Longitudinal, Transverse, Alligator, Pothole)
    model = YOLO("D:/LUMEN/lumen-backend/models/rdd2022_best.pt")
    
    # 2. Fine-tune on the unified dataset
    print("Starting fine-tuning on Combined_Road_Damage_Dataset...")
    results = model.train(
        data="D:/LUMEN/Combined_Road_Damage_Dataset/data.yaml",
        epochs=5, # Limit epochs to ensure reasonable completion time on unknown hardware
        patience=2,
        batch=4,
        imgsz=640,
        project="D:/LUMEN/runs",
        name="train_final_road_damage",
        device="", # Auto-detect GPU/CPU
        exist_ok=True
    )
    
    print("Training complete! Model saved to D:/LUMEN/runs/train_final_road_damage/weights/best.pt")

if __name__ == "__main__":
    main()
