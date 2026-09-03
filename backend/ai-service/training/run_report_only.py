import os
from train_model import verify_training_outputs
from prepare_dataset import generate_final_training_report

def main():
    run_dir = r"d:\Ai-Service\Lumen-ai\runs\detect\garbage_v4"
    if not os.path.exists(run_dir):
        print(f"Error: Directory {run_dir} does not exist.")
        return
        
    print(f"Verifying outputs and generating final report for {run_dir}...")
    valid, errors = verify_training_outputs(run_dir)
    generate_final_training_report(run_dir, errors)
    print("Report generated successfully! Check training_report.md inside your garbage_v4 run folder.")

if __name__ == "__main__":
    main()
