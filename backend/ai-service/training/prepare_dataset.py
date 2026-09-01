import os
from typing import Any
import shutil
import random
import yaml
from PIL import Image, ImageDraw
from utils import logger, SOURCE_DATASET_DIR, TARGET_DATASET_DIR, BASE_DIR
from merge_classes import merge_and_filter_dataset, load_source_classes
from validate_dataset import verify_dataset_integrity
from train_model import run_yolo_training, verify_training_outputs

def inspect_source_dataset() -> dict:
    """Step 1: Inspect the original dataset and compile metrics."""
    logger.info("Inspecting source dataset...")
    
    stats: dict[str, Any] = {
        'total_images': 0,
        'train_images': 0,
        'valid_images': 0,
        'test_images': 0,
        'total_labels': 0,
        'missing_labels': 0,
        'missing_images': 0,
        'duplicate_filenames': 0,
        'corrupted_files': 0,
        'num_classes': 0,
        'class_names': []
    }
    
    # Load class details
    try:
        stats['class_names'] = load_source_classes()
        stats['num_classes'] = len(stats['class_names'])
    except Exception as e:
        logger.warning(f"Could not load classes from data.yaml: {e}")
        
    splits = ['train', 'valid', 'test']
    all_filenames = {}
    
    for split in splits:
        img_dir = os.path.join(SOURCE_DATASET_DIR, split, "images")
        lbl_dir = os.path.join(SOURCE_DATASET_DIR, split, "labels")
        
        if not os.path.exists(img_dir):
            continue
            
        img_files = os.listdir(img_dir)
        lbl_files = os.listdir(lbl_dir) if os.path.exists(lbl_dir) else []
        
        img_bases = {os.path.splitext(f)[0]: f for f in img_files if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))}
        lbl_bases = {os.path.splitext(f)[0]: f for f in lbl_files if f.endswith('.txt')}
        
        # Counts
        count = len(img_bases)
        stats[f'{split}_images'] += count
        stats['total_images'] += count
        stats['total_labels'] += len(lbl_bases)
        
        # Track duplicate filenames across splits
        for base, f in img_bases.items():
            if f in all_filenames:
                stats['duplicate_filenames'] += 1
                all_filenames[f].append(split)
            else:
                all_filenames[f] = [split]
                
        # Match images and labels
        for base, f in img_bases.items():
            if base not in lbl_bases:
                stats['missing_labels'] += 1
                
            # Corruption check
            img_path = os.path.join(img_dir, f)
            try:
                with Image.open(img_path) as im:
                    im.verify()
            except Exception:
                stats['corrupted_files'] += 1
                
        for base, f in lbl_bases.items():
            img_found = False
            for ext in ['.jpg', '.jpeg', '.png', '.webp']:
                if os.path.exists(os.path.join(img_dir, base + ext)):
                    img_found = True
                    break
            if not img_found:
                stats['missing_images'] += 1
                
    # Save dataset_report.md
    os.makedirs(TARGET_DATASET_DIR, exist_ok=True)
    report_path = os.path.join(TARGET_DATASET_DIR, "dataset_report.md")
    
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("# LUMEN Original Dataset Inspection Report\n\n")
        f.write("## Dataset Summary\n")
        f.write(f"- **Annotation Format**: YOLO11 Bounding Box\n")
        f.write(f"- **Number of Classes**: {stats['num_classes']}\n")
        f.write(f"- **Class Names**: `{stats['class_names']}`\n\n")
        
        f.write("## Image Split Statistics\n")
        f.write(f"- **Total Images**: {stats['total_images']}\n")
        f.write(f"  - Train split: {stats['train_images']}\n")
        f.write(f"  - Validation split: {stats['valid_images']}\n")
        f.write(f"  - Test split: {stats['test_images']}\n")
        f.write(f"- **Total Label Files**: {stats['total_labels']}\n\n")
        
        f.write("## Data Quality Metrics\n")
        f.write(f"- **Missing labels**: {stats['missing_labels']}\n")
        f.write(f"- **Missing images**: {stats['missing_images']}\n")
        f.write(f"- **Duplicate filenames**: {stats['duplicate_filenames']}\n")
        f.write(f"- **Corrupted files**: {stats['corrupted_files']}\n")
        
    logger.info(f"Source inspection complete. Report saved to {report_path}")
    return stats

def generate_target_yaml():
    """Step 5: Write the new data.yaml config file."""
    logger.info("Generating target data.yaml configuration...")
    data_config = {
        'path': os.path.abspath(TARGET_DATASET_DIR).replace('\\', '/'),
        'train': 'images/train',
        'val': 'images/val',
        'nc': 1,
        'names': {
            0: 'garbage'
        }
    }
    
    yaml_path = os.path.join(TARGET_DATASET_DIR, "data.yaml")
    with open(yaml_path, 'w') as f:
        yaml.safe_dump(data_config, f, default_flow_style=False)
    logger.info(f"data.yaml generated at {yaml_path}")

def generate_preview_images():
    """Step 7: Render visual previews showing bounding boxes for validation."""
    logger.info("Generating dataset preview images...")
    dst_img_dir = os.path.join(TARGET_DATASET_DIR, "images", "val")
    dst_lbl_dir = os.path.join(TARGET_DATASET_DIR, "labels", "val")
    preview_dir = os.path.join(TARGET_DATASET_DIR, "preview")
    
    os.makedirs(preview_dir, exist_ok=True)
    
    val_files = [f for f in os.listdir(dst_img_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
    if not val_files:
        logger.warning("No validation images found. Preview generation skipped.")
        return
        
    sample_count = min(20, len(val_files))
    preview_samples = random.sample(val_files, sample_count)
    
    for filename in preview_samples:
        img_path = os.path.join(dst_img_dir, filename)
        lbl_path = os.path.join(dst_lbl_dir, os.path.splitext(filename)[0] + ".txt")
        
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
                            
                            # Convert to pixels
                            left = int((x_c - w / 2.0) * img_w)
                            top = int((y_c - h / 2.0) * img_h)
                            right = int((x_c + w / 2.0) * img_w)
                            bottom = int((y_c + h / 2.0) * img_h)
                            
                            # Draw box
                            draw.rectangle([left, top, right, bottom], outline="green", width=4)
                            draw.text((left + 5, top + 5), "garbage", fill="green")
                            
                im.save(os.path.join(preview_dir, filename))
        except Exception as e:
            logger.error(f"Failed to render preview for {filename}: {e}")
            
    logger.info(f"Visual previews generated in: {preview_dir}")

def generate_final_training_report(run_dir: str, verify_errors: list[str]):
    """Step 10: Compile the final training report."""
    report_path = os.path.join(run_dir, "training_report.md")
    logger.info(f"Writing final training report to {report_path}...")
    
    has_errors = len(verify_errors) > 0
    status = "SUCCESS" if not has_errors else "WARNING"
    
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("# LUMEN Model Training Report\n\n")
        f.write(f"## Status: {status}\n\n")
        f.write(f"Training run completed and stored under: `{run_dir}`\n\n")
        
        f.write("### Verified Output Files\n")
        f.write(f"- weights/best.pt: {'✓' if not any('best.pt' in e for e in verify_errors) else '✗'}\n")
        f.write(f"- weights/last.pt: {'✓' if not any('last.pt' in e for e in verify_errors) else '✗'}\n")
        f.write(f"- results.csv: {'✓' if not any('results.csv' in e for e in verify_errors) else '✗'}\n")
        f.write(f"- confusion_matrix.png: {'✓' if not any('confusion_matrix.png' in e for e in verify_errors) else '✗'}\n\n")
        
        if verify_errors:
            f.write("### Verification Errors & Warnings\n")
            for err in verify_errors:
                f.write(f"- {err}\n")
        else:
            f.write("### Verification Status\n")
            f.write("All required training metrics, charts, and weight files verified successfully.\n")
            
    logger.info("Training report generated.")

def main():
    print("=" * 60)
    print("        LUMEN GARBAGE DETECTION PIPELINE AUTOMATION")
    print("=" * 60)
    
    # Clean previous run inside TARGET_DATASET_DIR if exists to maintain clean slate
    if os.path.exists(TARGET_DATASET_DIR):
        logger.info(f"Cleaning previous dataset files in {TARGET_DATASET_DIR}...")
        for sub in ["images", "labels", "preview"]:
            sub_path = os.path.join(TARGET_DATASET_DIR, sub)
            if os.path.exists(sub_path):
                shutil.rmtree(sub_path)
                
    # Step 1: Inspect Dataset
    inspect_source_dataset()
    
    # Step 2 & 3 & 4: Validate, Filter & Merge into Garbage_Dataset
    merge_stats = merge_and_filter_dataset()
    
    # Save step 3 stats inside dataset_report.md
    report_path = os.path.join(TARGET_DATASET_DIR, "dataset_report.md")
    with open(report_path, 'a', encoding='utf-8') as f:
        f.write("\n## Class Filtering & Bounding Box Merge Statistics\n")
        f.write(f"- **Total source images parsed**: {merge_stats['total_source_images']}\n")
        f.write(f"- **Images removed (only unrelated classes present)**: {merge_stats['images_removed']}\n")
        f.write(f"- **Images kept**: {merge_stats['images_kept']}\n")
        f.write(f"- **Unrelated objects removed (filtered out)**: {merge_stats['objects_removed']}\n")
        f.write(f"- **Garbage objects retained**: {merge_stats['garbage_objects_retained']}\n")
        f.write(f"- **Corrupted labels skipped**: {merge_stats['skipped_corrupted_labels']}\n")
        f.write(f"- **Corrupted images skipped**: {merge_stats['skipped_corrupted_images']}\n")
        
    # Step 5: Generate data.yaml
    generate_target_yaml()
    
    # Step 6: Validate New Dataset & Generate validation_report.txt
    verify_dataset_integrity(TARGET_DATASET_DIR)
    
    # Step 7: Generate 20 preview images
    generate_preview_images()
    
    # Step 8 & 9: Train YOLO11 Nano
    run_dir = run_yolo_training()
    
    # Step 10: Verify training outputs
    valid, errors = verify_training_outputs(run_dir)
    generate_final_training_report(run_dir, errors)
    
    print("\nLUMEN Pipeline automation execution completed successfully!")

if __name__ == "__main__":
    main()
