import os
import shutil
from pathlib import Path

def setup_directories(base_path):
    base_path = Path(base_path)
    if base_path.exists():
        shutil.rmtree(base_path)
    
    for split in ['train', 'val', 'test']:
        (base_path / 'images' / split).mkdir(parents=True, exist_ok=True)
        (base_path / 'labels' / split).mkdir(parents=True, exist_ok=True)
    return base_path

def process_dataset(src_base, dest_base, prefix, label_mapping=None):
    src_base = Path(src_base)
    dest_base = Path(dest_base)
    
    for split in ['train', 'val', 'test']:
        src_img_dir = src_base / 'images' / split
        src_lbl_dir = src_base / 'labels' / split
        
        # Some datasets don't have 'test' split
        if not src_img_dir.exists():
            # try fallbacks e.g. src_base / split / 'images'
            src_img_dir = src_base / split / 'images'
            src_lbl_dir = src_base / split / 'labels'
            if not src_img_dir.exists():
                print(f"Skipping {split} for {src_base}, not found.")
                continue
                
        dest_img_dir = dest_base / 'images' / split
        dest_lbl_dir = dest_base / 'labels' / split
        
        print(f"Processing {src_base} split: {split}...")
        
        for img_path in src_img_dir.glob('*.*'):
            if img_path.suffix.lower() not in ['.jpg', '.jpeg', '.png']:
                continue
                
            new_name = f"{prefix}_{img_path.name}"
            dest_img = dest_img_dir / new_name
            shutil.copy2(img_path, dest_img)
            
            lbl_path = src_lbl_dir / (img_path.stem + '.txt')
            dest_lbl = dest_lbl_dir / (Path(new_name).stem + '.txt')
            
            if lbl_path.exists():
                with open(lbl_path, 'r') as f:
                    lines = f.readlines()
                
                new_lines = []
                for line in lines:
                    parts = line.strip().split()
                    if not parts: continue
                    class_id = int(parts[0])
                    
                    if label_mapping is not None:
                        if class_id in label_mapping:
                            class_id = label_mapping[class_id]
                        else:
                            continue # filter out unknown classes
                    
                    new_parts = [str(class_id)] + parts[1:]
                    new_lines.append(" ".join(new_parts) + "\n")
                
                with open(dest_lbl, 'w') as f:
                    f.writelines(new_lines)
            else:
                # Create empty label if not exists
                with open(dest_lbl, 'w') as f:
                    pass

def main():
    combined_dir = Path("D:/LUMEN/Combined_Road_Damage_Dataset")
    setup_directories(combined_dir)
    
    # 1. RDD2022 Dataset
    # Mapping: No change needed. 0: Longitudinal, 1: Transverse, 2: Alligator, 3: Pothole
    rdd2022_path = "D:/LUMEN/Ai-Service/Ai-Dataset/Road_Damage_Dataset"
    process_dataset(rdd2022_path, combined_dir, prefix="RDD")
    
    # 2. LUMEN Dataset
    # Original: 0: D40(Pothole), 1: D00(Long), 2: D10(Trans), 3: D20(Alli)
    # Target: 0: Long, 1: Trans, 2: Alli, 3: Pothole
    lumen_mapping = {
        0: 3, # Pothole
        1: 0, # Longitudinal
        2: 1, # Transverse
        3: 2  # Alligator
    }
    lumen_path = "D:/LUMEN/Ai-Service/Lumen-ai/dataset"
    process_dataset(lumen_path, combined_dir, prefix="LUMEN", label_mapping=lumen_mapping)
    
    # Write data.yaml
    yaml_content = f"""path: {combined_dir.absolute().as_posix()}
train: images/train
val: images/val
test: images/test

nc: 4
names: ['Longitudinal', 'Transverse', 'Alligator', 'Pothole']
"""
    with open(combined_dir / 'data.yaml', 'w') as f:
        f.write(yaml_content)

    print("Dataset combination complete!")

if __name__ == "__main__":
    main()
