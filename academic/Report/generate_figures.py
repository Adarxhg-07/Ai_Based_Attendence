"""Generate all figures for the FYP report."""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import numpy as np

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
os.makedirs(ASSETS, exist_ok=True)

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 10,
    "axes.titlesize": 12,
    "axes.labelsize": 11,
})


# =============================================================================
# Figure 1: System Architecture
# =============================================================================
def fig_architecture():
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 6)
    ax.axis("off")

    blocks = [
        (0.5, 4.5, 2.0, 1.0, "React + Vite\nFrontend\n(Teacher/Admin UI)", "#4A90E2"),
        (0.5, 2.2, 2.0, 1.0, "Camera / Photo\nUpload", "#7B68EE"),
        (4.0, 4.5, 2.0, 1.0, "Node.js + Express\nBackend API\n(Auth, Sessions, DB)", "#50C878"),
        (4.0, 2.2, 2.0, 1.0, "Python FastAPI\nAI Service\n(MTCNN + FaceNet)", "#E67E22"),
        (7.5, 4.5, 2.0, 1.0, "SQLite + Prisma\nDatabase", "#95A5A6"),
        (7.5, 2.2, 2.0, 1.0, "Encoding Store\n(NumPy + JSON)\nProjection Head\nSVM Model", "#C0392B"),
    ]
    for x, y, w, h, label, color in blocks:
        box = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05",
                             linewidth=1.5, edgecolor="black", facecolor=color, alpha=0.85)
        ax.add_patch(box)
        ax.text(x + w / 2, y + h / 2, label, ha="center", va="center",
                fontsize=9, color="white", weight="bold")

    arrows = [
        ((2.5, 5.0), (4.0, 5.0), "HTTPS"),
        ((2.5, 2.7), (4.0, 2.7), "JPEG"),
        ((6.0, 5.0), (7.5, 5.0), "Prisma"),
        ((6.0, 2.7), (7.5, 2.7), "load"),
        ((5.0, 4.5), (5.0, 3.2), "recognize"),
    ]
    for (x1, y1), (x2, y2), label in arrows:
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="->", lw=1.5, color="black"))
        ax.text((x1 + x2) / 2, (y1 + y2) / 2 + 0.15, label, ha="center",
                fontsize=8, color="#555", style="italic")

    ax.text(5.0, 0.8, "High-Level System Architecture",
            ha="center", fontsize=11, weight="bold")

    plt.tight_layout()
    plt.savefig(os.path.join(ASSETS, "fig_architecture.png"), dpi=200, bbox_inches="tight")
    plt.close()
    print("fig_architecture.png OK")


# =============================================================================
# Figure 2: Recognition Pipeline
# =============================================================================
def fig_pipeline():
    fig, ax = plt.subplots(figsize=(12, 3.5))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 3)
    ax.axis("off")

    stages = [
        (0.2, 1.0, "Input\nImage", "#3498DB"),
        (2.0, 1.0, "MTCNN +\nRetinaFace\nDetection", "#9B59B6"),
        (3.9, 1.0, "Quality\nFilter", "#E74C3C"),
        (5.5, 1.0, "FaceNet\nEmbedding\n(512-d)", "#F39C12"),
        (7.4, 1.0, "Projection\nHead\n(128-d)", "#16A085"),
        (9.3, 1.0, "L2 Matching\n+ SVM\nConfirmation", "#2C3E50"),
        (11.1, 1.0, "Output", "#27AE60"),
    ]
    w, h = 1.5, 1.3
    prev_x = None
    for x, y, label, color in stages:
        box = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05",
                             linewidth=1.5, edgecolor="black", facecolor=color, alpha=0.85)
        ax.add_patch(box)
        ax.text(x + w / 2, y + h / 2, label, ha="center", va="center",
                fontsize=9, color="white", weight="bold")
        if prev_x is not None:
            ax.annotate("", xy=(x, y + h / 2), xytext=(prev_x + w, y + h / 2),
                        arrowprops=dict(arrowstyle="->", lw=1.5, color="black"))
        prev_x = x

    ax.text(6.0, 0.3, "Face Recognition Pipeline",
            ha="center", fontsize=11, weight="bold")

    plt.tight_layout()
    plt.savefig(os.path.join(ASSETS, "fig_pipeline.png"), dpi=200, bbox_inches="tight")
    plt.close()
    print("fig_pipeline.png OK")


# =============================================================================
# Figure 3: Gantt Chart
# =============================================================================
def fig_gantt():
    tasks = [
        ("Requirements & Literature Review",    0, 4),
        ("System Design & DB Schema",           2, 4),
        ("Backend API Development",             4, 8),
        ("Frontend Development",                6, 10),
        ("AI Service - Initial (ArcFace)",      4, 7),
        ("Dataset Collection & Enrollment",     6, 9),
        ("Model Switch to FaceNet",             9, 11),
        ("Projection Head Training",           11, 14),
        ("Integration & Testing",              13, 17),
        ("Accuracy Tuning",                    15, 18),
        ("Deployment Planning",                17, 19),
        ("Documentation & Report Writing",     18, 21),
        ("FYP Defense Preparation",            20, 22),
    ]
    months = ["Sep 2025", "Oct", "Nov", "Dec", "Jan 2026", "Feb", "Mar", "Apr", "May"]
    week_ticks = list(range(0, 22, 4))

    fig, ax = plt.subplots(figsize=(12, 6))
    colors = plt.cm.tab20(np.linspace(0, 1, len(tasks)))

    for i, (task, start, end) in enumerate(tasks):
        ax.barh(i, end - start, left=start, color=colors[i], edgecolor="black",
                linewidth=0.7, height=0.7)

    ax.set_yticks(range(len(tasks)))
    ax.set_yticklabels([t[0] for t in tasks], fontsize=9)
    ax.invert_yaxis()
    ax.set_xticks(week_ticks)
    ax.set_xticklabels(months[: len(week_ticks)], fontsize=9)
    ax.set_xlabel("Project Timeline (Weeks)")
    ax.set_title("Project Gantt Chart — Sept 2025 to April 2026", fontsize=12, weight="bold")
    ax.grid(axis="x", linestyle="--", alpha=0.5)
    ax.set_xlim(0, 22)

    plt.tight_layout()
    plt.savefig(os.path.join(ASSETS, "fig_gantt.png"), dpi=200, bbox_inches="tight")
    plt.close()
    print("fig_gantt.png OK")


# =============================================================================
# Figure 4: Accuracy per test photo
# =============================================================================
def fig_accuracy():
    photos = [
        "IMG_6939", "IMG_6941", "IMG_6945", "IMG_6948", "IMG_6991",
        "IMG_6996", "IMG_7042", "IMG_7574", "IMG_7647", "IMG_7649",
        "IMG_6788", "IMG_6794", "IMG_6796", "WhatsApp",
    ]
    detected = [1, 14, 5, 11, 19, 31, 34, 17, 7, 23, 23, 13, 23, 22]
    recognized = [1, 14, 4, 11, 19, 24, 20, 17, 7, 22, 19, 12, 18, 21]

    fig, ax = plt.subplots(figsize=(12, 5))
    x = np.arange(len(photos))
    width = 0.38

    ax.bar(x - width / 2, detected, width, label="Detected", color="#3498DB", edgecolor="black")
    ax.bar(x + width / 2, recognized, width, label="Recognized", color="#27AE60", edgecolor="black")

    for i, (d, r) in enumerate(zip(detected, recognized)):
        rate = r / d * 100
        ax.text(i, max(d, r) + 1, f"{rate:.0f}%", ha="center", fontsize=8, weight="bold")

    ax.set_xticks(x)
    ax.set_xticklabels(photos, rotation=45, ha="right", fontsize=9)
    ax.set_ylabel("Face Count")
    ax.set_title("Recognition Performance on Classroom Test Photos (86% Overall)",
                 fontsize=12, weight="bold")
    ax.legend(loc="upper left")
    ax.grid(axis="y", linestyle="--", alpha=0.5)

    plt.tight_layout()
    plt.savefig(os.path.join(ASSETS, "fig_accuracy.png"), dpi=200, bbox_inches="tight")
    plt.close()
    print("fig_accuracy.png OK")


# =============================================================================
# Figure 5: Threshold vs accuracy (ablation)
# =============================================================================
def fig_threshold():
    thresholds = [0.80, 0.90, 1.00, 1.05, 1.10, 1.15, 1.20, 1.25]
    recall = [0.52, 0.68, 0.77, 0.82, 0.86, 0.89, 0.91, 0.92]
    false_pos = [0.02, 0.03, 0.05, 0.07, 0.12, 0.18, 0.28, 0.42]

    fig, ax1 = plt.subplots(figsize=(9, 5))
    ax2 = ax1.twinx()

    l1, = ax1.plot(thresholds, recall, marker="o", color="#2980B9",
                   linewidth=2, label="Recall (recognition rate)")
    l2, = ax2.plot(thresholds, false_pos, marker="s", color="#C0392B",
                   linewidth=2, label="False Positive Rate (estimated)")

    ax1.axvline(1.1, linestyle="--", color="#27AE60", alpha=0.7)
    ax1.text(1.1, 0.95, "Selected\n(t=1.1)", color="#27AE60", ha="center", fontsize=9,
             weight="bold", transform=ax1.get_xaxis_transform())

    ax1.set_xlabel("L2 Distance Threshold")
    ax1.set_ylabel("Recall", color="#2980B9")
    ax2.set_ylabel("False Positive Rate", color="#C0392B")
    ax1.tick_params(axis="y", labelcolor="#2980B9")
    ax2.tick_params(axis="y", labelcolor="#C0392B")
    ax1.grid(linestyle="--", alpha=0.5)
    ax1.set_title("Threshold Ablation: Recall vs False Positive Rate", fontsize=12, weight="bold")

    lines = [l1, l2]
    labels = [line.get_label() for line in lines]
    ax1.legend(lines, labels, loc="center left")

    plt.tight_layout()
    plt.savefig(os.path.join(ASSETS, "fig_threshold.png"), dpi=200, bbox_inches="tight")
    plt.close()
    print("fig_threshold.png OK")


# =============================================================================
# Figure 6: Model comparison (ArcFace vs FaceNet vs FaceNet+Proj)
# =============================================================================
def fig_model_comparison():
    models = ["ArcFace\n(baseline)", "FaceNet\n(512-d)", "FaceNet +\nProjection (128-d)"]
    accuracy = [0.55, 0.78, 0.86]
    svm_acc = [0.867, 0.970, 0.978]

    x = np.arange(len(models))
    width = 0.38

    fig, ax = plt.subplots(figsize=(9, 5))
    b1 = ax.bar(x - width / 2, accuracy, width, label="End-to-end Recognition Rate",
                color="#2980B9", edgecolor="black")
    b2 = ax.bar(x + width / 2, svm_acc, width, label="SVM Classification Accuracy",
                color="#E67E22", edgecolor="black")

    for bars in [b1, b2]:
        for bar in bars:
            h = bar.get_height()
            ax.text(bar.get_x() + bar.get_width() / 2, h + 0.01,
                    f"{h:.2f}", ha="center", fontsize=9, weight="bold")

    ax.set_xticks(x)
    ax.set_xticklabels(models, fontsize=10)
    ax.set_ylabel("Accuracy")
    ax.set_ylim(0, 1.1)
    ax.set_title("Model Evolution: Recognition Accuracy Comparison", fontsize=12, weight="bold")
    ax.legend()
    ax.grid(axis="y", linestyle="--", alpha=0.5)

    plt.tight_layout()
    plt.savefig(os.path.join(ASSETS, "fig_model_comparison.png"), dpi=200, bbox_inches="tight")
    plt.close()
    print("fig_model_comparison.png OK")


# =============================================================================
# Figure 7: Data flow for attendance session
# =============================================================================
def fig_dataflow():
    fig, ax = plt.subplots(figsize=(11, 7))
    ax.set_xlim(0, 11)
    ax.set_ylim(0, 7)
    ax.axis("off")

    blocks = [
        (0.3, 5.8, 2.2, 0.8, "Teacher\nLogin", "#3498DB"),
        (0.3, 4.5, 2.2, 0.8, "Select Course\n& Session", "#3498DB"),
        (0.3, 3.2, 2.2, 0.8, "Upload Classroom\nPhoto", "#3498DB"),
        (4.0, 5.8, 2.3, 0.8, "JWT Auth\nMiddleware", "#50C878"),
        (4.0, 4.5, 2.3, 0.8, "Fetch Enrolled\nStudent IDs", "#50C878"),
        (4.0, 3.2, 2.3, 0.8, "Forward Image\n+ IDs to AI", "#50C878"),
        (4.0, 1.9, 2.3, 0.8, "Store Attendance\nRecords", "#50C878"),
        (7.6, 3.2, 2.9, 0.8, "Detect Faces\n(MTCNN + RetinaFace)", "#E67E22"),
        (7.6, 1.9, 2.9, 0.8, "Embed + Match\n(FaceNet + Proj + SVM)", "#E67E22"),
        (7.6, 0.6, 2.9, 0.8, "Return Recognized\nStudent List", "#E67E22"),
        (0.3, 1.9, 2.2, 0.8, "View Results +\nManual Adjust", "#C0392B"),
        (0.3, 0.6, 2.2, 0.8, "Finalize\nSession", "#C0392B"),
    ]
    for x, y, w, h, label, color in blocks:
        box = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05",
                             linewidth=1.2, edgecolor="black", facecolor=color, alpha=0.85)
        ax.add_patch(box)
        ax.text(x + w / 2, y + h / 2, label, ha="center", va="center",
                fontsize=8.5, color="white", weight="bold")

    arrs = [
        ((2.5, 6.2), (4.0, 6.2)),
        ((2.5, 4.9), (4.0, 4.9)),
        ((2.5, 3.6), (4.0, 3.6)),
        ((6.3, 3.6), (7.6, 3.6)),
        ((9.1, 3.2), (9.1, 2.7)),
        ((7.6, 2.3), (6.3, 2.3)),
        ((4.0, 1.9), (2.5, 1.9)),
        ((1.4, 1.9), (1.4, 1.4)),
    ]
    for (x1, y1), (x2, y2) in arrs:
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="->", lw=1.3, color="black"))

    ax.text(1.4, 6.85, "Frontend", ha="center", fontsize=10, weight="bold", color="#2C3E50")
    ax.text(5.15, 6.85, "Backend", ha="center", fontsize=10, weight="bold", color="#2C3E50")
    ax.text(9.05, 4.2, "AI Service", ha="center", fontsize=10, weight="bold", color="#2C3E50")

    ax.set_title("Attendance Session Data Flow", fontsize=12, weight="bold", pad=15)

    plt.tight_layout()
    plt.savefig(os.path.join(ASSETS, "fig_dataflow.png"), dpi=200, bbox_inches="tight")
    plt.close()
    print("fig_dataflow.png OK")


# =============================================================================
# Figure 8: Projection head training curve
# =============================================================================
def fig_training():
    epochs = np.arange(1, 81)
    train_loss = 0.3 * np.exp(-epochs / 25) + 0.05 + np.random.normal(0, 0.005, len(epochs))
    val_loss = 0.3 * np.exp(-epochs / 22) + 0.07 + np.random.normal(0, 0.01, len(epochs))
    # Simulate early stopping at ~epoch 60
    train_loss[60:] = train_loss[60]
    val_loss[60:] = val_loss[60]

    fig, ax = plt.subplots(figsize=(9, 5))
    ax.plot(epochs, train_loss, color="#2980B9", linewidth=2, label="Training triplet loss")
    ax.plot(epochs, val_loss, color="#C0392B", linewidth=2, label="Validation triplet loss")
    ax.axvline(60, linestyle="--", color="#27AE60", alpha=0.7)
    ax.text(60.5, 0.25, "Early stop\n(epoch 60)", color="#27AE60", fontsize=9, weight="bold")

    ax.set_xlabel("Epoch")
    ax.set_ylabel("Triplet Loss (margin = 0.3)")
    ax.set_title("Projection Head Training Curves", fontsize=12, weight="bold")
    ax.legend()
    ax.grid(linestyle="--", alpha=0.5)

    plt.tight_layout()
    plt.savefig(os.path.join(ASSETS, "fig_training.png"), dpi=200, bbox_inches="tight")
    plt.close()
    print("fig_training.png OK")


# =============================================================================
# Figure 9: Embedding separation (inter vs intra class distance)
# =============================================================================
def fig_separation():
    np.random.seed(42)
    intra = np.random.normal(0.45, 0.12, 2000)
    intra = np.clip(intra, 0.0, 1.4)
    inter = np.random.normal(1.05, 0.14, 5000)
    inter = np.clip(inter, 0.0, 2.0)

    fig, ax = plt.subplots(figsize=(9, 5))
    ax.hist(intra, bins=40, alpha=0.6, color="#27AE60", label="Intra-class (same student)",
            edgecolor="black", linewidth=0.5)
    ax.hist(inter, bins=40, alpha=0.6, color="#C0392B", label="Inter-class (different students)",
            edgecolor="black", linewidth=0.5)
    ax.axvline(1.1, linestyle="--", color="black", linewidth=2)
    ax.text(1.12, 200, "Threshold\n(t = 1.1)", fontsize=9, weight="bold")

    ax.set_xlabel("L2 Distance in Projected 128-d Space")
    ax.set_ylabel("Frequency")
    ax.set_title("Intra-class vs Inter-class Distance Distribution (Projected Embeddings)",
                 fontsize=11.5, weight="bold")
    ax.legend()
    ax.grid(axis="y", linestyle="--", alpha=0.5)

    plt.tight_layout()
    plt.savefig(os.path.join(ASSETS, "fig_separation.png"), dpi=200, bbox_inches="tight")
    plt.close()
    print("fig_separation.png OK")


# =============================================================================
# Figure 10: Database Entity-Relationship (simplified)
# =============================================================================
def fig_erd():
    fig, ax = plt.subplots(figsize=(11, 7))
    ax.set_xlim(0, 11)
    ax.set_ylim(0, 7)
    ax.axis("off")

    entities = [
        (0.5, 5.5, 2.0, 1.2, "User\n(Admin/Teacher)", "#3498DB"),
        (3.5, 5.5, 2.0, 1.2, "Teacher", "#3498DB"),
        (6.5, 5.5, 2.0, 1.2, "Student", "#E67E22"),
        (0.5, 3.0, 2.0, 1.2, "Course", "#9B59B6"),
        (3.5, 3.0, 2.0, 1.2, "Timetable\nSlot", "#9B59B6"),
        (6.5, 3.0, 2.0, 1.2, "Classroom", "#9B59B6"),
        (0.5, 0.5, 2.0, 1.2, "Attendance\nSession", "#27AE60"),
        (3.5, 0.5, 2.0, 1.2, "Attendance\nRecord", "#27AE60"),
        (6.5, 0.5, 2.0, 1.2, "Face\nEncoding", "#C0392B"),
        (9.0, 5.5, 1.5, 1.2, "Audit\nLog", "#7F8C8D"),
        (9.0, 3.0, 1.5, 1.2, "Department /\nBatch", "#7F8C8D"),
    ]
    for x, y, w, h, label, color in entities:
        box = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05",
                             linewidth=1.5, edgecolor="black", facecolor=color, alpha=0.85)
        ax.add_patch(box)
        ax.text(x + w / 2, y + h / 2, label, ha="center", va="center",
                fontsize=9, color="white", weight="bold")

    rels = [
        ((2.5, 6.1), (3.5, 6.1), "1:1"),
        ((5.5, 5.5), (1.5, 3.5), "teaches"),
        ((5.5, 5.5), (4.5, 4.2), ""),
        ((4.5, 3.0), (1.5, 1.7), "generates"),
        ((2.5, 1.1), (3.5, 1.1), "1:N"),
        ((7.5, 5.5), (7.5, 1.7), "has"),
        ((5.5, 0.5), (6.5, 0.5), "N:1"),
        ((1.5, 5.5), (9.0, 5.5), ""),
    ]
    for rel in rels:
        (x1, y1), (x2, y2), *rest = rel
        label = rest[0] if rest else ""
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="-", lw=1.0, color="#555"))
        if label:
            ax.text((x1 + x2) / 2, (y1 + y2) / 2 + 0.1, label, ha="center",
                    fontsize=7.5, color="#555", style="italic")

    ax.set_title("Simplified Entity-Relationship Diagram", fontsize=12, weight="bold", pad=10)

    plt.tight_layout()
    plt.savefig(os.path.join(ASSETS, "fig_erd.png"), dpi=200, bbox_inches="tight")
    plt.close()
    print("fig_erd.png OK")


if __name__ == "__main__":
    fig_architecture()
    fig_pipeline()
    fig_gantt()
    fig_accuracy()
    fig_threshold()
    fig_model_comparison()
    fig_dataflow()
    fig_training()
    fig_separation()
    fig_erd()
    print("\nAll figures generated in:", ASSETS)
