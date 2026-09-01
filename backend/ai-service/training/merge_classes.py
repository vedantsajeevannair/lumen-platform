import os
import shutil
import yaml
from PIL import Image
from utils import logger, SOURCE_DATASET_DIR, TARGET_DATASET_DIR, is_garbage_class
from validate_dataset import validate_yolo_label_file

def load_source_classes() -> list[str]:
    """Load class names from the original dataset data.yaml."""
    yaml_path = os.path.join(SOURCE_DATASET_DIR, "data.yaml")
    if not os.path.exists(yaml_path):
        raise FileNotFoundError(f"Source data.yaml not found at {yaml_path}")
        
    with open(yaml_path, 'r') as f:
        data = yaml.safe_load(f)
        
    names = data.get('names', [])
    if isinstance(names, dict):
        # Handle dict format: {0: 'Glass', 1: 'Metal', ...}
        names = [names[k] for k in sorted(names.keys())]
    return names

def create_class_mapping(source_classes: list[str]) -> tuple[dict[int, int], list[str], list[str]]:
    """
    Build a mapping from original class IDs to new class IDs.
    - Garbage classes map to 0.
    - Unrelated classes map to -1 (indicating removal).
    """
    mapping = {}
    garbage_classes = []
    unrelated_classes = []
    
    for idx, cname in enumerate(source_classes):
        if is_garbage_class(cname):
            mapping[idx] = 0
            garbage_classes.append(cname)
        else:
            mapping[idx] = -1
            unrelated_classes.append(cname)
            
    return mapping, garbage_classes, unrelated_classes

def merge_and_filter_dataset() -> dict:
    """
    Inspect every split, filter unrelated classes, merge garbage classes to 0,
    and save the new dataset.
    """
    logger.info("Starting dataset merge and filter operation...")
    
    source_classes = load_source_classes()
    logger.info(f"Source classes: {source_classes}")
    
    class_mapping, garbage_list, unrelated_list = create_class_mapping(source_classes)
    logger.info(f"Identified garbage classes: {garbage_list}")
    logger.info(f"Identified unrelated classes: {unrelated_list}")
    
    stats = {
        'images_removed': 0,
        'images_kept': 0,
        'objects_removed': 0,
        'garbage_objects_retained': 0,
        'total_source_images': 0,
        'skipped_corrupted_labels': 0,
        'skipped_corrupted_images': 0
    }
    
    # Define mapping of source directories to target directories
    # Merge source valid/ and test/ into target val/
    splits_map = [
        ("train", "train"),
        ("valid", "val"),
        ("test", "val")
    ]
    
    # Track destination copied filenames to avoid duplicate operations/collisions
    used_dest_filenames = set()
    
    for src_split, dst_split in splits_map:
        src_img_dir = os.path.join(SOURCE_DATASET_DIR, src_split, "images")
        src_lbl_dir = os.path.join(SOURCE_DATASET_DIR, src_split, "labels")
        
        dst_img_dir = os.path.join(TARGET_DATASET_DIR, "images", dst_split)
        dst_lbl_dir = os.path.join(TARGET_DATASET_DIR, "labels", dst_split)
        
        # Ensure directories exist
        os.makedirs(dst_img_dir, exist_ok=True)
        os.makedirs(dst_lbl_dir, exist_ok=True)
        
        if not os.path.exists(src_img_dir):
            logger.warning(f"Source directory {src_img_dir} does not exist. Skipping.")
            continue
            
        for filename in os.listdir(src_img_dir):
            if not filename.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                continue
                
            stats['total_source_images'] += 1
            img_path = os.path.join(src_img_dir, filename)
            base_name = os.path.splitext(filename)[0]
            lbl_path = os.path.join(src_lbl_dir, base_name + ".txt")
            
            # Verify original image is valid/not corrupted
            try:
                with Image.open(img_path) as temp_img:
                    temp_img.verify()
            except Exception as e:
                logger.warning(f"Corrupted image skipped: {img_path}. Error: {e}")
                stats['skipped_corrupted_images'] += 1
                continue
                
            # Read and validate label file
            if not os.path.exists(lbl_path):
                logger.warning(f"Label missing for image {img_path}. Skipping.")
                stats['images_removed'] += 1
                continue
                
            is_valid, annotations, corrupted_count = validate_yolo_label_file(lbl_path)
            if corrupted_count > 0:
                logger.warning(f"Skipping image {img_path} due to corrupted labels.")
                stats['skipped_corrupted_labels'] += 1
                continue
                
            # Filter and merge annotations
            retained_lines = []
            img_has_garbage = False
            
            for ann in annotations:
                class_id = int(ann[0])
                coords = ann[1:]
                
                target_class = class_mapping.get(class_id, -1)
                if target_class == 0:
                    retained_lines.append(f"0 {' '.join(f'{x:.6f}' for x in coords)}\n")
                    stats['garbage_objects_retained'] += 1
                    img_has_garbage = True
                else:
                    stats['objects_removed'] += 1
            
            # Action based on class presence
            if not img_has_garbage:
                # Remove completely: do not copy image, do not generate label
                stats['images_removed'] += 1
            else:
                # Keep the image: copy it and write label file
                dst_img_path = os.path.join(dst_img_dir, filename)
                dst_lbl_path = os.path.join(dst_lbl_dir, base_name + ".txt")
                
                # Check for duplicate names (Roboflow unique names are normally unique, but let's be bulletproof)
                # If target path already exists, append suffix (dynamic renaming)
                idx = 1
                final_filename = filename
                final_base = base_name
                while final_filename in used_dest_filenames or os.path.exists(os.path.join(dst_img_dir, final_filename)):
                    final_base = f"{base_name}_{idx}"
                    final_filename = f"{final_base}{os.path.splitext(filename)[1]}"
                    idx += 1
                    
                used_dest_filenames.add(final_filename)
                
                # Copy image
                shutil.copy2(img_path, os.path.join(dst_img_dir, final_filename))
                
                # Write YOLO label
                with open(os.path.join(dst_lbl_dir, final_base + ".txt"), 'w') as f:
                    f.writelines(retained_lines)
                    
                stats['images_kept'] += 1
                
    logger.info("Dataset merging and class filtering complete.")
    logger.info(f"Stats: {stats}")
    return stats
