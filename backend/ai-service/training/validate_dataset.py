import os
from pathlib import Path
from PIL import Image

def validate_dataset(dataset_path):
    dataset_path = Path(dataset_path)
    print(f"Validating dataset at: {dataset_path}")
    
    issues = []
    
    for split in ['train', 'val', 'test']:
        img_dir = dataset_path / 'images' / split
        lbl_dir = dataset_path / 'labels' / split
        
        if not img_dir.exists():
            continue
            
        print(f"Checking {split}...")
        
        for img_path in img_dir.glob('*.*'):
            if img_path.suffix.lower() not in ['.jpg', '.jpeg', '.png']:
                continue
                
            # Check corresponding label
            lbl_path = lbl_dir / (img_path.stem + '.txt')
            if not lbl_path.exists():
                issues.append(f"Missing label for {img_path.name}")
                continue
                
            # Validate bounding boxes
            with open(lbl_path, 'r') as f:
                lines = f.readlines()
                
            for i, line in enumerate(lines):
                parts = line.strip().split()
                if not parts: continue
                if len(parts) != 5:
                    issues.append(f"Invalid format in {lbl_path.name} line {i+1}: expected 5 parts, got {len(parts)}")
                    continue
                    
                class_id = int(parts[0])
                if class_id < 0 or class_id > 3:
                    issues.append(f"Invalid class_id in {lbl_path.name}: {class_id}")
                    
                x, y, w, h = map(float, parts[1:])
                if x < 0 or x > 1 or y < 0 or y > 1 or w < 0 or w > 1 or h < 0 or h > 1:
                    issues.append(f"Out of bounds coordinates in {lbl_path.name}: {x}, {y}, {w}, {h}")
                if w == 0 or h == 0:
                    issues.append(f"Zero width/height box in {lbl_path.name}: {w}, {h}")
                    
    if issues:
        print(f"Found {len(issues)} issues. First 100:")
        for issue in issues[:100]:
            print(issue)
        return False
    else:
        print("Dataset validation passed with 0 issues!")
        return True

if __name__ == "__main__":
    validate_dataset("D:/LUMEN/Combined_Road_Damage_Dataset")
