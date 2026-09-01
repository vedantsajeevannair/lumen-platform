import os
import shutil
import random
import logging
import csv
import yaml
import numpy as np
from PIL import Image, ImageDraw
import cv2
from ultralytics import YOLO

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("dataset_build_and_train.log", mode='w'),
        logging.StreamHandler()
    ]
)

# Paths
BASE_DIR = r"d:\Ai-Service"
AI_DATASET_DIR = os.path.join(BASE_DIR, "Ai-Dataset")
WATER_DROPLETS_DIR = os.path.join(AI_DATASET_DIR, "water_droplets")
FLOODNET_DIR = os.path.join(AI_DATASET_DIR, "floodnet_img", "FloodNet Challenge - Track 1")

TARGET_DATASET_DIR = os.path.join(BASE_DIR, "Water_Hazard_Dataset")
IMAGES_TRAIN_DIR = os.path.join(TARGET_DATASET_DIR, "images", "train")
IMAGES_VAL_DIR = os.path.join(TARGET_DATASET_DIR, "images", "val")
LABELS_TRAIN_DIR = os.path.join(TARGET_DATASET_DIR, "labels", "train")
LABELS_VAL_DIR = os.path.join(TARGET_DATASET_DIR, "labels", "val")
PREVIEW_DIR = os.path.join(TARGET_DATASET_DIR, "preview")

MODELS_DIR = os.path.join(BASE_DIR, "Lumen-ai", "models")
YOLO_MODEL_SRC = os.path.join(BASE_DIR, "Lumen-ai", "yolo11n.pt")
YOLO_MODEL_DST = os.path.join(MODELS_DIR, "yolo11n.pt")


def setup_directories():
    """Create all target directories, clearing previous runs if existing."""
    logging.info("Setting up target directory structure...")
    
    # Clear previous output directories to prevent merging duplicates from multiple runs
    for sub in ["images", "labels", "preview"]:
        sub_path = os.path.join(TARGET_DATASET_DIR, sub)
        if os.path.exists(sub_path):
            logging.info(f"Clearing existing directory: {sub_path}")
            shutil.rmtree(sub_path)
            
    for path in [IMAGES_TRAIN_DIR, IMAGES_VAL_DIR, LABELS_TRAIN_DIR, LABELS_VAL_DIR, PREVIEW_DIR, MODELS_DIR]:
        os.makedirs(path, exist_ok=True)
    
    # Copy yolo11n.pt to models/ if needed
    if os.path.exists(YOLO_MODEL_SRC) and not os.path.exists(YOLO_MODEL_DST):
        logging.info(f"Copying {YOLO_MODEL_SRC} to {YOLO_MODEL_DST}...")
        shutil.copy2(YOLO_MODEL_SRC, YOLO_MODEL_DST)


def detect_annotation_format(dataset_path, name):
    """Detect the annotation format of a dataset."""
    logging.info(f"Detecting annotation format for {name} at {dataset_path}...")
    
    if not os.path.exists(dataset_path):
        logging.warning(f"Dataset path {dataset_path} does not exist.")
        return "Non-existent"

    # Check for YOLO Object Detection (contains data.yaml and folders with .txt labels)
    has_yaml = any(f.endswith('.yaml') or f.endswith('.yml') for f in os.listdir(dataset_path))
    if not has_yaml:
        # Check subdirs
        for root, dirs, files in os.walk(dataset_path):
            if any(f.endswith('.yaml') or f.endswith('.yml') for f in files):
                has_yaml = True
                break
                
    # Search for label files
    has_txt_labels = False
    for root, dirs, files in os.walk(dataset_path):
        if 'labels' in root.lower() and any(f.endswith('.txt') for f in files):
            has_txt_labels = True
            break

    if has_yaml or has_txt_labels:
        return "YOLO Object Detection"

    # Check for Semantic Segmentation (presence of masks or images labeled class-wise)
    has_masks = False
    for root, dirs, files in os.walk(dataset_path):
        if 'mask' in root.lower() and any(f.endswith('.png') or f.endswith('.jpg') for f in files):
            has_masks = True
            break
            
    if has_masks:
        return "Semantic Segmentation"

    # Check for Classification (folders structured as classes or class labels in CSV)
    # Check if there are no localization folders like labels or masks
    has_images = False
    for root, dirs, files in os.walk(dataset_path):
        if any(f.lower().endswith(('.png', '.jpg', '.jpeg')) for f in files):
            has_images = True
            break
            
    if has_images and not has_masks and not has_txt_labels:
        return "Classification Dataset"

    return "Unknown Format"


def validate_yolo_labels(label_path):
    """Validate YOLO label format: class_id and normalized coordinates [0, 1]."""
    valid_lines = []
    corrupted_count = 0
    
    with open(label_path, 'r') as f:
        lines = f.readlines()
        
    for line in lines:
        parts = line.strip().split()
        if len(parts) == 5:
            try:
                class_id = int(parts[0])
                coords = [float(x) for x in parts[1:]]
                # Check boundaries
                if all(0.0 <= c <= 1.0 for c in coords):
                    # Keep valid coordinates, force class_id to 0 for water_hazard
                    valid_lines.append(f"0 {' '.join(parts[1:])}\n")
                else:
                    logging.warning(f"Out of boundary coords in {label_path}: {line.strip()}")
                    corrupted_count += 1
            except ValueError:
                logging.warning(f"Invalid label values in {label_path}: {line.strip()}")
                corrupted_count += 1
        else:
            if line.strip():
                logging.warning(f"Invalid YOLO line format in {label_path}: {line.strip()}")
                corrupted_count += 1
                
    return valid_lines, corrupted_count


def process_water_pipes_dataset(src_dir):
    """Process YOLO formatted water pipes dataset."""
    logging.info("Processing Water Pipes dataset (water_droplets)...")
    images_processed = 0
    skipped_images = 0
    corrupted_annotations = 0
    generated_label_files = 0
    
    archive_train_img_dir = os.path.join(src_dir, "archive", "train", "images")
    archive_train_lbl_dir = os.path.join(src_dir, "archive", "train", "labels")
    
    if not os.path.exists(archive_train_img_dir):
        logging.error(f"Images folder {archive_train_img_dir} does not exist.")
        return [], 0, 0, 0, 0
        
    file_pairs = []
    
    for filename in os.listdir(archive_train_img_dir):
        if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            img_path = os.path.join(archive_train_img_dir, filename)
            base_name = os.path.splitext(filename)[0]
            lbl_filename = base_name + ".txt"
            lbl_path = os.path.join(archive_train_lbl_dir, lbl_filename)
            
            # Verify image is readable
            try:
                with Image.open(img_path) as temp_img:
                    temp_img.verify()
            except Exception as e:
                logging.warning(f"Corrupted image skipped: {img_path}. Error: {e}")
                skipped_images += 1
                continue
                
            # Check label
            if os.path.exists(lbl_path):
                valid_lines, corrupted = validate_yolo_labels(lbl_path)
                corrupted_annotations += corrupted
                
                file_pairs.append({
                    'img_path': img_path,
                    'filename': filename,
                    'label_lines': valid_lines,
                    'dataset_prefix': 'wp_'
                })
                images_processed += 1
                generated_label_files += 1
            else:
                logging.warning(f"Missing label file for image: {img_path}. Creating empty label file.")
                file_pairs.append({
                    'img_path': img_path,
                    'filename': filename,
                    'label_lines': [],
                    'dataset_prefix': 'wp_'
                })
                images_processed += 1
                generated_label_files += 1
                
    return file_pairs, images_processed, skipped_images, corrupted_annotations, generated_label_files


def extract_bboxes_from_mask(mask_path, target_classes):
    """Extract connected components for target classes from mask and return YOLO coordinates."""
    try:
        img = Image.open(mask_path)
        mask = np.array(img)
    except Exception as e:
        logging.error(f"Failed to open mask {mask_path}: {e}")
        return None, 1 # 1 corrupted annotation
        
    if len(mask.shape) == 3:
        mask = mask[:, :, 0]
        
    H, W = mask.shape
    
    # Create binary mask where pixels match any of the target classes
    binary_mask = np.zeros_like(mask, dtype=np.uint8)
    for c in target_classes:
        binary_mask[mask == c] = 255
        
    # Extract connected components
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary_mask)
    
    yolo_lines = []
    for label in range(1, num_labels):
        x = stats[label, cv2.CC_STAT_LEFT]
        y = stats[label, cv2.CC_STAT_TOP]
        w = stats[label, cv2.CC_STAT_WIDTH]
        h = stats[label, cv2.CC_STAT_HEIGHT]
        area = stats[label, cv2.CC_STAT_AREA]
        
        # Noise filter: ignore very small bounding boxes
        if area < 16 or w < 2 or h < 2:
            continue
            
        # Convert to normalized center_x, center_y, width, height
        x_center = (x + w / 2.0) / W
        y_center = (y + h / 2.0) / H
        norm_w = w / W
        norm_h = h / H
        
        # Verify coordinates are in range [0, 1]
        x_center = min(max(x_center, 0.0), 1.0)
        y_center = min(max(y_center, 0.0), 1.0)
        norm_w = min(max(norm_w, 0.0), 1.0)
        norm_h = min(max(norm_h, 0.0), 1.0)
        
        yolo_lines.append(f"0 {x_center:.6f} {y_center:.6f} {norm_w:.6f} {norm_h:.6f}\n")
        
    return yolo_lines, 0


def process_floodnet_dataset(src_dir):
    """Process semantic segmentation masks of FloodNet and extract bounding boxes."""
    logging.info("Processing FloodNet dataset (floodnet_img)...")
    images_processed = 0
    skipped_images = 0
    corrupted_annotations = 0
    generated_label_files = 0
    
    # FloodNet classes of interest: 1 (Building-flooded), 3 (Road-flooded), 5 (Water), 8 (Pool)
    target_classes = {1, 3, 5, 8}
    
    file_pairs = []
    
    subfolders = [
        ("Train/Labeled/Flooded/image", "Train/Labeled/Flooded/mask", "_lab.png"),
        ("Train/Labeled/Non-Flooded/image", "Train/Labeled/Non-Flooded/mask", "_lab.png")
    ]
    
    for img_sub, msk_sub, msk_suffix in subfolders:
        img_dir = os.path.join(src_dir, os.path.normpath(img_sub))
        msk_dir = os.path.join(src_dir, os.path.normpath(msk_sub))
        
        if not os.path.exists(img_dir):
            logging.warning(f"Directory {img_dir} does not exist. Skipping subfolder.")
            continue
            
        for filename in os.listdir(img_dir):
            if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                img_path = os.path.join(img_dir, filename)
                base_name = os.path.splitext(filename)[0]
                
                mask_filename = base_name + msk_suffix
                mask_path = os.path.join(msk_dir, mask_filename)
                
                if not os.path.exists(mask_path):
                    mask_path_alt = os.path.join(msk_dir, base_name + ".png")
                    if os.path.exists(mask_path_alt):
                        mask_path = mask_path_alt
                    else:
                        logging.warning(f"No mask found for image: {img_path}. Skipping.")
                        skipped_images += 1
                        continue
                
                # Verify image is readable
                try:
                    with Image.open(img_path) as temp_img:
                        temp_img.verify()
                except Exception as e:
                    logging.warning(f"Corrupted image skipped: {img_path}. Error: {e}")
                    skipped_images += 1
                    continue
                    
                # Extract bboxes
                label_lines, corrupted = extract_bboxes_from_mask(mask_path, target_classes)
                if label_lines is None:
                    corrupted_annotations += corrupted
                    skipped_images += 1
                    continue
                    
                file_pairs.append({
                    'img_path': img_path,
                    'filename': filename,
                    'label_lines': label_lines,
                    'dataset_prefix': 'fn_'
                })
                images_processed += 1
                generated_label_files += 1
                
    return file_pairs, images_processed, skipped_images, corrupted_annotations, generated_label_files


def copy_and_rename_file(src_path, dst_dir, base_name, prefix, ext, used_names):
    """Copy file to destination directory, resolving duplicates."""
    target_name = f"{prefix}{base_name}"
    final_name = f"{target_name}{ext}"
    
    idx = 1
    while final_name in used_names or os.path.exists(os.path.join(dst_dir, final_name)):
        final_name = f"{target_name}_{idx}{ext}"
        idx += 1
        
    used_names.add(final_name)
    dst_path = os.path.join(dst_dir, final_name)
    shutil.copy2(src_path, dst_path)
    return final_name


def split_and_save_dataset(all_pairs, split_ratio=0.8):
    """Split dataset and copy files to target train/val directories."""
    logging.info("Splitting dataset (80/20 train/val) and copying files...")
    
    random.seed(42)
    random.shuffle(all_pairs)
    
    split_idx = int(len(all_pairs) * split_ratio)
    train_pairs = all_pairs[:split_idx]
    val_pairs = all_pairs[split_idx:]
    
    used_img_names = set()
    
    # Write train
    for pair in train_pairs:
        img_src = pair['img_path']
        prefix = pair['dataset_prefix']
        base, ext = os.path.splitext(pair['filename'])
        
        # Copy image
        final_img_name = copy_and_rename_file(img_src, IMAGES_TRAIN_DIR, base, prefix, ext, used_img_names)
        
        # Write labels
        lbl_base = os.path.splitext(final_img_name)[0]
        final_lbl_name = f"{lbl_base}.txt"
        lbl_dst = os.path.join(LABELS_TRAIN_DIR, final_lbl_name)
        
        with open(lbl_dst, 'w') as f:
            f.writelines(pair['label_lines'])
            
    # Write val
    for pair in val_pairs:
        img_src = pair['img_path']
        prefix = pair['dataset_prefix']
        base, ext = os.path.splitext(pair['filename'])
        
        # Copy image
        final_img_name = copy_and_rename_file(img_src, IMAGES_VAL_DIR, base, prefix, ext, used_img_names)
        
        # Write labels
        lbl_base = os.path.splitext(final_img_name)[0]
        final_lbl_name = f"{lbl_base}.txt"
        lbl_dst = os.path.join(LABELS_VAL_DIR, final_lbl_name)
        
        with open(lbl_dst, 'w') as f:
            f.writelines(pair['label_lines'])
            
    logging.info(f"Dataset split complete: {len(train_pairs)} train, {len(val_pairs)} val images.")
    return len(train_pairs), len(val_pairs)


def validate_final_dataset():
    """Verify integrity of final dataset."""
    logging.info("Validating final dataset integrity...")
    errors = []
    
    splits = [
        (IMAGES_TRAIN_DIR, LABELS_TRAIN_DIR, "train"),
        (IMAGES_VAL_DIR, LABELS_VAL_DIR, "val")
    ]
    
    total_images = 0
    total_labels = 0
    total_boxes = 0
    corrupted_images = 0
    out_of_bounds_boxes = 0
    
    for img_dir, lbl_dir, split_name in splits:
        img_files = set(os.listdir(img_dir))
        lbl_files = set(os.listdir(lbl_dir))
        
        total_images += len(img_files)
        total_labels += len(lbl_files)
        
        # Check image has label
        for img_file in img_files:
            base = os.path.splitext(img_file)[0]
            lbl_file = base + ".txt"
            if lbl_file not in lbl_files:
                errors.append(f"Missing label file for image in {split_name}: {img_file}")
                
            # Verify image is readable
            img_path = os.path.join(img_dir, img_file)
            try:
                with Image.open(img_path) as im:
                    im.verify()
            except Exception as e:
                errors.append(f"Corrupted image in {split_name}: {img_path}. Error: {e}")
                corrupted_images += 1
                
        # Check label has image
        for lbl_file in lbl_files:
            base = os.path.splitext(lbl_file)[0]
            img_found = False
            for ext in ['.jpg', '.jpeg', '.png', '.JPG']:
                if (base + ext) in img_files:
                    img_found = True
                    break
            if not img_found:
                errors.append(f"Missing image file for label in {split_name}: {lbl_file}")
                
            # Check bounding box validity
            lbl_path = os.path.join(lbl_dir, lbl_file)
            with open(lbl_path, 'r') as f:
                for line in f:
                    parts = line.strip().split()
                    if parts:
                        total_boxes += 1
                        try:
                            class_id = int(parts[0])
                            coords = [float(x) for x in parts[1:]]
                            if len(coords) != 4 or not all(0.0 <= c <= 1.0 for c in coords):
                                out_of_bounds_boxes += 1
                                errors.append(f"Invalid bounding box in {lbl_file}: {line.strip()}")
                        except Exception:
                            out_of_bounds_boxes += 1
                            errors.append(f"Invalid label line format in {lbl_file}: {line.strip()}")

    # Check duplicates in splits
    train_imgs = set(os.listdir(IMAGES_TRAIN_DIR))
    val_imgs = set(os.listdir(IMAGES_VAL_DIR))
    duplicates = train_imgs.intersection(val_imgs)
    if duplicates:
        errors.append(f"Duplicate files exist in both train and val: {duplicates}")
        
    validation_status = "PASS" if not errors else "FAIL"
    
    val_report_path = os.path.join(TARGET_DATASET_DIR, "validation_report.txt")
    with open(val_report_path, 'w') as f:
        f.write("=== LUMEN Dataset Validation Report ===\n")
        f.write(f"Validation Status: {validation_status}\n\n")
        f.write(f"Total train images: {len(train_imgs)}\n")
        f.write(f"Total val images: {len(val_imgs)}\n")
        f.write(f"Total images: {total_images}\n")
        f.write(f"Total label files: {total_labels}\n")
        f.write(f"Total bounding boxes: {total_boxes}\n")
        f.write(f"Corrupted images found: {corrupted_images}\n")
        f.write(f"Out of bounds/invalid boxes found: {out_of_bounds_boxes}\n\n")
        if errors:
            f.write("Errors details:\n")
            for err in errors[:100]:
                f.write(f"- {err}\n")
            if len(errors) > 100:
                f.write(f"... and {len(errors)-100} more errors.\n")
        else:
            f.write("All checks passed successfully. Bounding box coordinates are valid and images are clean.\n")
            
    logging.info(f"Validation complete. Status: {validation_status}. Report saved to {val_report_path}")
    return validation_status, errors


def generate_data_yaml():
    """Generate YOLO data.yaml configuration file."""
    logging.info("Generating data.yaml configuration...")
    data_config = {
        'path': os.path.abspath(TARGET_DATASET_DIR).replace('\\', '/'),
        'train': 'images/train',
        'val': 'images/val',
        'nc': 1,
        'names': ['water_hazard']
    }
    
    yaml_path = os.path.join(TARGET_DATASET_DIR, "data.yaml")
    with open(yaml_path, 'w') as f:
        yaml.safe_dump(data_config, f, default_flow_style=False)
    logging.info(f"data.yaml generated at {yaml_path}")


def generate_preview_images():
    """Generate a preview folder with 20 random images showing YOLO bounding boxes."""
    logging.info("Generating preview images with drawn bounding boxes...")
    val_imgs = [f for f in os.listdir(IMAGES_VAL_DIR) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    if not val_imgs:
        logging.warning("No validation images found to generate preview.")
        return
        
    num_previews = min(20, len(val_imgs))
    preview_samples = random.sample(val_imgs, num_previews)
    
    for filename in preview_samples:
        img_path = os.path.join(IMAGES_VAL_DIR, filename)
        lbl_filename = os.path.splitext(filename)[0] + ".txt"
        lbl_path = os.path.join(LABELS_VAL_DIR, lbl_filename)
        
        if not os.path.exists(lbl_path):
            continue
            
        try:
            with Image.open(img_path) as im:
                img_w, img_h = im.size
                draw = ImageDraw.Draw(im)
                
                with open(lbl_path, 'r') as f:
                    for line in f:
                        parts = line.strip().split()
                        if len(parts) == 5:
                            x_c, y_c, w, h = [float(x) for x in parts[1:]]
                            
                            left = int((x_c - w / 2.0) * img_w)
                            top = int((y_c - h / 2.0) * img_h)
                            right = int((x_c + w / 2.0) * img_w)
                            bottom = int((y_c + h / 2.0) * img_h)
                            
                            draw.rectangle([left, top, right, bottom], outline="green", width=4)
                            draw.text((left + 5, top + 5), "water_hazard", fill="green")
                            
                preview_save_path = os.path.join(PREVIEW_DIR, filename)
                im.save(preview_save_path)
        except Exception as e:
            logging.error(f"Failed to generate preview for {filename}: {e}")
            
    logging.info(f"Generated {num_previews} preview images in {PREVIEW_DIR}")


def generate_conversion_report(wp_format, fn_format, wp_stats, fn_stats, warnings):
    """Generate dataset_report.md summarizing conversion results."""
    report_path = os.path.join(TARGET_DATASET_DIR, "dataset_report.md")
    logging.info(f"Generating dataset report at {report_path}...")
    
    with open(report_path, 'w') as f:
        f.write("# LUMEN Water Hazard Dataset Conversion Report\n\n")
        f.write("## Source Datasets Detected Formats\n")
        f.write(f"- **Water Pipes Dataset (`water_droplets`)**: {wp_format}\n")
        f.write(f"- **FloodNet Challenge Dataset (`floodnet_img`)**: {fn_format}\n\n")
        
        f.write("## Conversion Statistics\n\n")
        f.write("| Metric | Water Pipes (`water_droplets`) | FloodNet (`floodnet_img`) | Combined |\n")
        f.write("| --- | --- | --- | --- |\n")
        f.write(f"| **Converted Images** | {wp_stats['converted']} | {fn_stats['converted']} | {wp_stats['converted'] + fn_stats['converted']} |\n")
        f.write(f"| **Skipped Images** | {wp_stats['skipped']} | {fn_stats['skipped']} | {wp_stats['skipped'] + fn_stats['skipped']} |\n")
        f.write(f"| **Corrupted Annotations** | {wp_stats['corrupted']} | {fn_stats['corrupted']} | {wp_stats['corrupted'] + fn_stats['corrupted']} |\n")
        f.write(f"| **Generated Label Files** | {wp_stats['labels']} | {fn_stats['labels']} | {wp_stats['labels'] + fn_stats['labels']} |\n\n")
        
        if warnings:
            f.write("## Warnings and Errors Encountered\n")
            for w in warnings:
                f.write(f"- {w}\n")
        else:
            f.write("## Warnings and Errors Encountered\n")
            f.write("No major warnings or errors encountered. Conversion completed successfully.\n")


def get_next_run_version(runs_dir, base_name="water_hazard_v"):
    """Dynamically determine next version run folder to prevent overwriting."""
    idx = 1
    while True:
        run_name = f"{base_name}{idx}"
        target_path = os.path.join(runs_dir, run_name)
        if not os.path.exists(target_path):
            return run_name
        idx += 1


def train_yolo_model():
    """Train YOLO11n model using the generated dataset."""
    logging.info("Initializing YOLO11n model training...")
    
    if not os.path.exists(YOLO_MODEL_DST):
        logging.error(f"YOLO11n model weights not found at {YOLO_MODEL_DST}!")
        logging.info("Falling back to auto-downloading YOLO11n model...")
        model = YOLO("yolo11n.pt")
    else:
        logging.info(f"Loading model from {YOLO_MODEL_DST}...")
        model = YOLO(YOLO_MODEL_DST)
        
    runs_detect_dir = os.path.join(BASE_DIR, "Lumen-ai", "runs", "detect")
    next_run_name = get_next_run_version(runs_detect_dir)
    logging.info(f"Training outputs will be saved inside run: {next_run_name}")
    
    data_yaml_path = os.path.join(TARGET_DATASET_DIR, "data.yaml")
    
    # Launch training
    logging.info("Starting training process...")
    
    # Select device based on CUDA availability
    import torch
    if torch.cuda.is_available():
        device_param = '0'
        logging.info("CUDA is available. Setting device='0'")
    else:
        device_param = 'cpu'
        logging.info("CUDA is not available. Setting device='cpu'")
        
    try:
        logging.info(f"Attempting training with batch=4 and device={device_param} (epochs=35)...")
        results = model.train(
            data=data_yaml_path.replace('\\', '/'),
            epochs=35,
            imgsz=640,
            batch=4,
            device=device_param,
            project=os.path.join(BASE_DIR, "Lumen-ai", "runs", "detect").replace('\\', '/'),
            name=next_run_name,
            exist_ok=False
        )
    except Exception as e:
        logging.warning(f"Training with batch=4 and device={device_param} failed: {e}. Retrying with batch=2 and device={device_param}...")
        try:
            results = model.train(
                data=data_yaml_path.replace('\\', '/'),
                epochs=35,
                imgsz=640,
                batch=4,
                device=device_param,
                project=os.path.join(BASE_DIR, "Lumen-ai", "runs", "detect").replace('\\', '/'),
                name=next_run_name,
                exist_ok=False
            )
        except Exception as e2:
            logging.warning(f"Training with batch=2 and device={device_param} failed: {e2}. Falling back to CPU with batch=4...")
            try:
                results = model.train(
                    data=data_yaml_path.replace('\\', '/'),
                    epochs=35,
                    imgsz=640,
                    batch=4,
                    device='cpu',
                    project=os.path.join(BASE_DIR, "Lumen-ai", "runs", "detect").replace('\\', '/'),
                    name=next_run_name,
                    exist_ok=False
                )
            except Exception as e3:
                logging.warning(f"Training with CPU and batch=4 failed: {e3}. Trying CPU with batch=2...")
                results = model.train(
                    data=data_yaml_path.replace('\\', '/'),
                    epochs=35,
                    imgsz=640,
                    batch=2,
                    device='cpu',
                    project=os.path.join(BASE_DIR, "Lumen-ai", "runs", "detect").replace('\\', '/'),
                    name=next_run_name,
                    exist_ok=False
                )
    
    logging.info(f"Training completed successfully. Results saved in run folder {next_run_name}.")
    
    run_dir = os.path.join(runs_detect_dir, next_run_name)
    expected_files = [
        "weights/best.pt",
        "weights/last.pt",
        "results.csv",
        "confusion_matrix.png",
        "F1_curve.png",
        "PR_curve.png"
    ]
    
    logging.info("Checking output training files...")
    for f in expected_files:
        path = os.path.join(run_dir, f)
        if os.path.exists(path):
            logging.info(f"Training output verified: {f} exists at {path}")
        else:
            logging.warning(f"Expected training output missing: {f} (Checked path: {path})")


def main():
    warnings = []
    
    setup_directories()
    
    wp_format = detect_annotation_format(WATER_DROPLETS_DIR, "water_droplets")
    fn_format = detect_annotation_format(FLOODNET_DIR, "floodnet_img")
    
    logging.info(f"Format detected for Water Pipes: {wp_format}")
    logging.info(f"Format detected for FloodNet: {fn_format}")
    
    if wp_format == "Classification Dataset" or fn_format == "Classification Dataset":
        msg = "Error: One of the datasets is a classification dataset with no localization information. Stopping process as requested."
        logging.error(msg)
        warnings.append(msg)
        generate_conversion_report(wp_format, fn_format, {'converted': 0, 'skipped': 0, 'corrupted': 0, 'labels': 0}, {'converted': 0, 'skipped': 0, 'corrupted': 0, 'labels': 0}, warnings)
        return
        
    wp_pairs, wp_conv, wp_skip, wp_corr, wp_lbls = process_water_pipes_dataset(WATER_DROPLETS_DIR)
    wp_stats = {
        'converted': wp_conv,
        'skipped': wp_skip,
        'corrupted': wp_corr,
        'labels': wp_lbls
    }
    
    fn_pairs, fn_conv, fn_skip, fn_corr, fn_lbls = process_floodnet_dataset(FLOODNET_DIR)
    fn_stats = {
        'converted': fn_conv,
        'skipped': fn_skip,
        'corrupted': fn_corr,
        'labels': fn_lbls
    }
    
    all_pairs = wp_pairs + fn_pairs
    
    if not all_pairs:
        logging.error("No image-label pairs found across both datasets! Stopping.")
        return
        
    train_count, val_count = split_and_save_dataset(all_pairs, split_ratio=0.8)
    
    generate_data_yaml()
    generate_conversion_report(wp_format, fn_format, wp_stats, fn_stats, warnings)
    
    val_status, val_errors = validate_final_dataset()
    
    if val_status == "FAIL":
        logging.error("Final dataset validation failed. Check validation_report.txt for details.")
        
    generate_preview_images()
    
    train_yolo_model()
    
    logging.info("Water Hazard Dataset Builder & YOLO11n Trainer Pipeline finished successfully!")


if __name__ == "__main__":
    main()
