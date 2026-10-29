"""Render PNG previews of the poster & standee by re-drawing the same layout
with matplotlib. This is a sanity-check preview only; the .pptx files are the
real deliverables.
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle
from matplotlib.image import imread
from matplotlib.offsetbox import OffsetImage, AnnotationBbox
import matplotlib.patheffects as pe

HERE = os.path.dirname(os.path.abspath(__file__))
REPORT_ASSETS = os.path.join(os.path.dirname(HERE), "Report", "assets")

PLUM = "#2E1A47"
PLUM_MID = "#6B4E8C"
AMBER = "#F4A261"
SAGE = "#86A88E"
CREAM = "#FAF7F0"
CARD = "#FFFFFF"
TEXT = "#1E1E2E"
MUTED = "#5D5F76"
BORDER = "#E0DCD2"

TITLE = "SMART ATTENDANCE SYSTEM\nUSING FACIAL IMAGE RECOGNITION"

ABSTRACT = (
    "This project replaces manual classroom attendance with a single classroom "
    "photograph. A teacher uploads the image via a web dashboard; the system "
    "detects every face using MTCNN with a RetinaFace fallback, filters "
    "low-quality crops, embeds each face with FaceNet (512-d) followed by a "
    "learned 128-d projection head, and matches the embeddings against an "
    "enrollment store using minimum L2 distance with an SVM confirmation layer. "
    "The pipeline reaches 86% recognition on unseen classroom photos while "
    "processing each image in 1–5 seconds on commodity hardware."
)

OBJECTIVES = [
    "Eliminate roll call from classroom lectures.",
    "Reduce proxy / fraudulent attendance.",
    "Deliver auditable attendance records.",
    "Run on-premises with zero recurring cost.",
    "Preserve student privacy — no raw photos stored.",
]
APPLICATIONS = [
    "University lectures & tutorials.",
    "Examination hall attendance / ID verification.",
    "Event / workshop registration checks.",
    "Seminar & guest-lecture tracking.",
    "Faculty-level analytics on absenteeism.",
]
KEY_TOOLS = [
    "Python 3 — FastAPI, TensorFlow, OpenCV, scikit-learn",
    "FaceNet (keras_facenet), MTCNN, RetinaFace",
    "Custom projection head (triplet loss, 128-d)",
    "Node.js + Express + TypeScript + Prisma ORM",
    "React 18 + Vite + TypeScript (frontend)",
    "SQLite (dev), PostgreSQL-ready (production)",
    "Nginx + Let's Encrypt + systemd (deployment)",
]
RESULT_STATS = [("86%", "Recognition rate"),
                ("243", "Faces evaluated"),
                ("113", "Students enrolled"),
                ("1-5 s", "Per-photo latency")]
RESULT_NOTE = (
    "Evaluated on 14 unseen classroom photographs from the 2022 & 2023 batches. "
    "Nine of fourteen photos reached 100% recognition; remaining errors cluster "
    "on small / pose-extreme faces in dense groups, which the teacher-review UI "
    "flags for manual approval."
)
CONCLUSION = (
    "The Smart Attendance System demonstrates that a single classroom photograph, "
    "processed by an on-premises deep-learning pipeline, is a practical "
    "replacement for manual roll call. The design is privacy-respecting "
    "(no raw images stored), cost-free to operate (open-source stack on a "
    "free-tier VM), and ships with a teacher-review step that guards against "
    "residual recognition errors."
)
MEMBERS = [("Adarsh G", "CSE"),
           ("Karthik H", "CSE"),
           ("Brijesh Gowda N", "AI"),
           ("Jonathan S Anand", "AI")]

FLOWCHART_IMG = os.path.join(REPORT_ASSETS, "fig_pipeline.png")
SYSTEM_IMG = os.path.join(REPORT_ASSETS, "fig_architecture.png")
RESULTS_IMG = os.path.join(REPORT_ASSETS, "fig_accuracy.png")
RVCE_LOGO = os.path.join(REPORT_ASSETS, "rvce_logo.jpeg")


def pill(ax, x, y, w, h, text, fs=14, text_color=CARD, bg=PLUM, upper=True, fw="bold"):
    box = FancyBboxPatch((x, y - h), w, h, boxstyle="round,pad=0.01,rounding_size=0.08",
                         linewidth=0, facecolor=bg)
    ax.add_patch(box)
    t = text.upper() if upper else text
    ax.text(x + 0.1, y - h / 2, t, fontsize=fs, color=text_color,
            ha="left", va="center", fontweight=fw)


def card(ax, x, y, w, h):
    box = FancyBboxPatch((x, y - h), w, h, boxstyle="round,pad=0.01,rounding_size=0.04",
                         linewidth=0.6, edgecolor=BORDER, facecolor=CARD)
    ax.add_patch(box)


def draw_image_inside(ax, img_path, x, y, w, h):
    if not os.path.exists(img_path):
        return
    img = imread(img_path)
    ih, iw = img.shape[:2]
    img_aspect = iw / ih
    box_aspect = w / h
    if img_aspect > box_aspect:
        new_w = w * 0.95
        new_h = new_w / img_aspect
    else:
        new_h = h * 0.95
        new_w = new_h * img_aspect
    nx = x + (w - new_w) / 2
    ny = y - h + (h - new_h) / 2
    ax.imshow(img, extent=[nx, nx + new_w, ny, ny + new_h], aspect="auto", zorder=3)


def body_text(ax, x, y, w, h, text, fs=9, color=TEXT, align="left", justify=True):
    ax.text(x + 0.05, y - 0.05, text, fontsize=fs, color=color,
            ha="left" if align == "left" else align,
            va="top", wrap=True,
            fontfamily="DejaVu Sans",
            bbox=None,
            transform=ax.transData)


def wrap_text(s, width):
    """Simple word wrap by char count."""
    import textwrap
    return "\n".join(textwrap.wrap(s, width=width))


def bullets_sage(ax, x, y, w, h, items, fs=9, max_chars=55):
    lines = []
    for item in items:
        wrapped = wrap_text(f"▸ {item}", max_chars)
        lines.append(wrapped)
    ax.text(x + 0.05, y - 0.1, "\n\n".join(lines), fontsize=fs, color=TEXT,
            ha="left", va="top")


def stat_grid(ax, x, y, w, h, stats):
    cw = w / 2
    ch = h / 2
    for i, (num, label) in enumerate(stats):
        col = i % 2
        row = i // 2
        cx = x + col * cw
        cy = y - row * ch
        ax.text(cx + cw / 2, cy - ch * 0.45, num, fontsize=22, color=AMBER,
                ha="center", va="center", fontweight="bold",
                fontfamily="monospace")
        ax.text(cx + cw / 2, cy - ch * 0.8, label, fontsize=8, color=PLUM,
                ha="center", va="center", fontweight="bold")


def header_strip(ax, x, y, w, h):
    ax.add_patch(Rectangle((x, y - h), w, h, facecolor=CREAM, linewidth=0))
    # logo (right)
    if os.path.exists(RVCE_LOGO):
        img = imread(RVCE_LOGO)
        side = h * 0.85
        lx = x + w - side - 0.05
        ly = y - h + (h - side) / 2
        ax.imshow(img, extent=[lx, lx + side, ly, ly + side], aspect="auto", zorder=4)
    # text
    ax.text(x + 0.15, y - h / 2 + h * 0.15,
            "GHULAM ISHAQ KHAN INSTITUTE OF ENGINEERING SCIENCES AND TECHNOLOGY",
            fontsize=9, fontweight="bold", color=PLUM, ha="left", va="center")
    ax.text(x + 0.15, y - h / 2 - h * 0.2,
            "FACULTY OF ELECTRICAL ENGINEERING",
            fontsize=8, fontweight="bold", color=PLUM_MID, ha="left", va="center")


def title_band(ax, x, y, w, h, fs=22):
    ax.add_patch(FancyBboxPatch((x, y - h), w, h,
                                boxstyle="round,pad=0.01,rounding_size=0.04",
                                linewidth=0, facecolor=PLUM))
    ax.text(x + w / 2, y - h / 2, TITLE,
            fontsize=fs, color=CARD, fontweight="black",
            ha="center", va="center", linespacing=1.05)


def partners_strip(ax, x, y, w, h):
    ax.add_patch(FancyBboxPatch((x, y - h), w, h,
                                boxstyle="round,pad=0.01,rounding_size=0.02",
                                linewidth=0, facecolor=SAGE))
    ax.text(x + w / 2, y - h / 2,
            "Built at GIK Institute  •  Faculty of Electrical Engineering  •  "
            "Senior Design Project 2025-26",
            fontsize=9, color=CARD, fontweight="bold",
            ha="center", va="center")


def members_advisors(ax, x, y, w, h):
    left_w = w * 0.58
    gap = 0.1
    right_w = w - left_w - gap
    # left (plum)
    ax.add_patch(FancyBboxPatch((x, y - h), left_w, h,
                                boxstyle="round,pad=0.01,rounding_size=0.02",
                                linewidth=0, facecolor=PLUM))
    ax.text(x + 0.15, y - 0.15, "GROUP MEMBERS", fontsize=10, fontweight="bold",
            color=AMBER, ha="left", va="top")
    # names in 2x2
    nw = left_w / 2
    nh = (h - 0.45) / 2
    for i, (name, dept) in enumerate(MEMBERS):
        col = i % 2
        row = i // 2
        nx = x + 0.15 + col * nw
        ny = y - 0.50 - row * nh
        ax.text(nx, ny, name, fontsize=10, fontweight="bold", color=CARD,
                ha="left", va="top")
        ax.text(nx, ny - 0.22, dept, fontsize=8, color=SAGE,
                ha="left", va="top")
    # right (plum-mid)
    rx = x + left_w + gap
    ax.add_patch(FancyBboxPatch((rx, y - h), right_w, h,
                                boxstyle="round,pad=0.01,rounding_size=0.02",
                                linewidth=0, facecolor=PLUM_MID))
    ax.text(rx + 0.15, y - 0.15, "ADVISOR", fontsize=8, fontweight="bold",
            color=AMBER, ha="left", va="top")
    ax.text(rx + 0.15, y - 0.45, "Dr. Zaiwar Ali", fontsize=10, fontweight="bold",
            color=CARD, ha="left", va="top")
    ax.text(rx + 0.15, y - 0.80, "CO-ADVISOR", fontsize=8, fontweight="bold",
            color=AMBER, ha="left", va="top")
    ax.text(rx + 0.15, y - 1.10, "Dr. Arbab Abdur Rahim", fontsize=10,
            fontweight="bold", color=CARD, ha="left", va="top")


def render_poster():
    W, H = 23.4, 33.1
    fig, ax = plt.subplots(figsize=(W / 2, H / 2), dpi=100)
    ax.set_xlim(0, W)
    ax.set_ylim(0, H)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.add_patch(Rectangle((0, 0), W, H, facecolor=CREAM, linewidth=0))

    M = 0.5
    G = 0.3
    inner_w = W - 2 * M

    cy = H - M
    hs_h = 1.2
    header_strip(ax, M, cy, inner_w, hs_h)
    cy -= hs_h + 0.1

    tb_h = 1.6
    title_band(ax, M, cy, inner_w, tb_h, fs=24)
    cy -= tb_h + 0.25

    # Grid area
    bottom_reserved = 0.55 + 0.2 + 1.6 + 0.25  # partners + gap + members + gap
    grid_h = cy - M - bottom_reserved
    row_gap = 0.25
    total_gaps = 3 * row_gap
    usable = grid_h - total_gaps
    row1_h = usable * 0.28
    row2_h = usable * 0.19
    row3_h = usable * 0.25
    row4_h = usable - row1_h - row2_h - row3_h

    left_w = inner_w * 0.42
    right_w = inner_w - left_w - G
    lx = M
    rx = M + left_w + G
    hdr_h = 0.55

    # Row 1: Abstract + Pipeline
    pill(ax, lx, cy, left_w, hdr_h, "Abstract", fs=13)
    body_y = cy - hdr_h - 0.08
    body_h = row1_h - hdr_h - 0.08
    card(ax, lx, body_y, left_w, body_h)
    ax.text(lx + 0.3, body_y - 0.15, wrap_text(ABSTRACT, 50),
            fontsize=10, color=TEXT, ha="left", va="top", linespacing=1.3)
    pill(ax, rx, cy, right_w, hdr_h, "Recognition Pipeline", fs=13)
    card(ax, rx, body_y, right_w, body_h)
    draw_image_inside(ax, FLOWCHART_IMG, rx + 0.2, body_y - 0.15,
                      right_w - 0.4, body_h - 0.3)
    cy -= row1_h + row_gap

    # Row 2: Objectives + Applications
    pill(ax, lx, cy, left_w, hdr_h, "Objectives", fs=13)
    body_y = cy - hdr_h - 0.08
    body_h = row2_h - hdr_h - 0.08
    card(ax, lx, body_y, left_w, body_h)
    bullets_sage(ax, lx + 0.3, body_y - 0.15, left_w - 0.6, body_h - 0.3,
                 OBJECTIVES, fs=10, max_chars=48)
    pill(ax, rx, cy, right_w, hdr_h, "Applications", fs=13)
    card(ax, rx, body_y, right_w, body_h)
    bullets_sage(ax, rx + 0.3, body_y - 0.15, right_w - 0.6, body_h - 0.3,
                 APPLICATIONS, fs=10, max_chars=60)
    cy -= row2_h + row_gap

    # Row 3: Key Tools + Results
    pill(ax, lx, cy, left_w, hdr_h, "Key Tools", fs=13)
    body_y = cy - hdr_h - 0.08
    body_h = row3_h - hdr_h - 0.08
    card(ax, lx, body_y, left_w, body_h)
    bullets_sage(ax, lx + 0.3, body_y - 0.15, left_w - 0.6, body_h - 0.3,
                 KEY_TOOLS, fs=9, max_chars=55)
    pill(ax, rx, cy, right_w, hdr_h, "Results", fs=13)
    stats_h = body_h * 0.55
    card(ax, rx, body_y, right_w, stats_h)
    stat_grid(ax, rx, body_y, right_w, stats_h, RESULT_STATS)
    note_y = body_y - stats_h - 0.12
    note_h = body_h - stats_h - 0.12
    card(ax, rx, note_y, right_w, note_h)
    ax.text(rx + 0.25, note_y - 0.12, wrap_text(RESULT_NOTE, 52),
            fontsize=9, color=TEXT, ha="left", va="top", linespacing=1.3)
    cy -= row3_h + row_gap

    # Row 4: System + Conclusion
    pill(ax, lx, cy, left_w, hdr_h, "System Architecture", fs=13)
    body_y = cy - hdr_h - 0.08
    body_h = row4_h - hdr_h - 0.08
    card(ax, lx, body_y, left_w, body_h)
    draw_image_inside(ax, SYSTEM_IMG, lx + 0.2, body_y - 0.15,
                      left_w - 0.4, body_h - 0.3)
    pill(ax, rx, cy, right_w, hdr_h, "Conclusion", fs=13)
    card(ax, rx, body_y, right_w, body_h)
    ax.text(rx + 0.3, body_y - 0.2, wrap_text(CONCLUSION, 55),
            fontsize=10, color=TEXT, ha="left", va="top", linespacing=1.35)
    cy -= row4_h + 0.15

    # Partners strip
    partners_strip(ax, M, cy, inner_w, 0.55)
    cy -= 0.55 + 0.2

    # Members/advisors
    members_advisors(ax, M, cy, inner_w, 1.6)

    out = os.path.join(HERE, "FYP_Poster_preview.png")
    plt.savefig(out, dpi=100, bbox_inches="tight", pad_inches=0.1,
                facecolor=CREAM)
    plt.close()
    print(f"Poster preview: {out}")


def render_standee():
    W, H = 22.0, 55.0
    fig, ax = plt.subplots(figsize=(W / 2.8, H / 2.8), dpi=90)
    ax.set_xlim(0, W)
    ax.set_ylim(0, H)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.add_patch(Rectangle((0, 0), W, H, facecolor=CREAM, linewidth=0))

    M = 0.5
    G = 0.3
    inner_w = W - 2 * M
    col_w = (inner_w - G) / 2
    lx = M
    rx = M + col_w + G

    cy = H - M

    header_strip(ax, M, cy, inner_w, 1.15)
    cy -= 1.15 + 0.15

    # Title band — taller + smaller font for narrower standee
    title_band(ax, M, cy, inner_w, 3.2, fs=15)
    cy -= 3.2 + 0.3

    # Abstract
    pill(ax, M, cy, inner_w, 0.65, "Abstract", fs=14)
    cy -= 0.75
    card(ax, M, cy, inner_w, 4.8)
    ax.text(M + 0.35, cy - 0.25, wrap_text(ABSTRACT, 80),
            fontsize=10, color=TEXT, ha="left", va="top", linespacing=1.4)
    cy -= 4.8 + 0.4

    # Objectives + Flowchart
    pill(ax, lx, cy, col_w, 0.65, "Objectives", fs=13)
    pill(ax, rx, cy, col_w, 0.65, "Pipeline", fs=13)
    cy -= 0.75
    body_h = 5.5
    card(ax, lx, cy, col_w, body_h)
    bullets_sage(ax, lx + 0.3, cy - 0.25, col_w - 0.6, body_h - 0.5,
                 OBJECTIVES, fs=9, max_chars=38)
    card(ax, rx, cy, col_w, body_h)
    draw_image_inside(ax, FLOWCHART_IMG, rx + 0.2, cy - 0.2,
                      col_w - 0.4, body_h - 0.4)
    cy -= body_h + 0.4

    # Applications + Key Tools
    pill(ax, lx, cy, col_w, 0.65, "Applications", fs=13)
    pill(ax, rx, cy, col_w, 0.65, "Key Tools", fs=13)
    cy -= 0.75
    body_h = 4.85
    card(ax, lx, cy, col_w, body_h)
    bullets_sage(ax, lx + 0.3, cy - 0.25, col_w - 0.6, body_h - 0.5,
                 APPLICATIONS, fs=9, max_chars=38)
    card(ax, rx, cy, col_w, body_h)
    bullets_sage(ax, rx + 0.3, cy - 0.25, col_w - 0.6, body_h - 0.5,
                 KEY_TOOLS, fs=8, max_chars=42)
    cy -= body_h + 0.4

    # System
    pill(ax, M, cy, inner_w, 0.65, "System Architecture", fs=14)
    cy -= 0.75
    sys_h = 6.5
    card(ax, M, cy, inner_w, sys_h)
    draw_image_inside(ax, SYSTEM_IMG, M + 0.3, cy - 0.3,
                      inner_w - 0.6, sys_h - 0.6)
    cy -= sys_h + 0.4

    # Results
    pill(ax, M, cy, inner_w, 0.65, "Results", fs=14)
    cy -= 0.75
    results_h = 5.4
    stats_w = inner_w * 0.45
    stat_grid(ax, M, cy, stats_w, results_h, RESULT_STATS)
    chart_x = M + stats_w + 0.3
    chart_w = inner_w - stats_w - 0.3
    card(ax, chart_x, cy, chart_w, results_h)
    draw_image_inside(ax, RESULTS_IMG, chart_x + 0.2, cy - 0.2,
                      chart_w - 0.4, results_h - 0.4)
    cy -= results_h + 0.4

    # Conclusion
    pill(ax, M, cy, inner_w, 0.65, "Conclusion", fs=14)
    cy -= 0.75
    conc_h = 3.4
    card(ax, M, cy, inner_w, conc_h)
    ax.text(M + 0.35, cy - 0.3, wrap_text(CONCLUSION, 85),
            fontsize=10, color=TEXT, ha="left", va="top", linespacing=1.4)
    cy -= conc_h + 0.4

    # Partners strip
    partners_strip(ax, M, cy, inner_w, 0.65)
    cy -= 0.65 + 0.25

    # Members/advisors — use whatever height is left
    ma_h = max(1.4, cy - M)
    members_advisors(ax, M, cy, inner_w, ma_h)

    out = os.path.join(HERE, "FYP_Standee_preview.png")
    plt.savefig(out, dpi=90, bbox_inches="tight", pad_inches=0.1,
                facecolor=CREAM)
    plt.close()
    print(f"Standee preview: {out}")


if __name__ == "__main__":
    render_poster()
    render_standee()
