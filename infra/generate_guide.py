#!/usr/bin/env python3
"""Generates the 'How to Use & Run' PDF guide for the Reddit Clone microservices backend."""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Preformatted, Table, TableStyle,
    PageBreak, HRFlowable,
)

OUT = os.path.join(os.path.dirname(__file__), "..", "Reddit-Clone-Run-Guide.pdf")
OUT = os.path.abspath(OUT)

ORANGE = colors.HexColor("#FF4500")  # Reddit orange
DARK = colors.HexColor("#1A1A1B")
GREY = colors.HexColor("#6E7174")
CODE_BG = colors.HexColor("#F4F5F6")
LINE = colors.HexColor("#D8DBDD")

styles = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=17, textColor=DARK, spaceBefore=14, spaceAfter=6)
H2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=12.5, textColor=ORANGE, spaceBefore=10, spaceAfter=4)
BODY = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=10, leading=15, spaceAfter=6, textColor=DARK)
SMALL = ParagraphStyle("Small", parent=BODY, fontSize=9, textColor=GREY)
CODE = ParagraphStyle("Code", parent=styles["Code"], fontSize=8.5, leading=12, textColor=DARK)
CELL = ParagraphStyle("Cell", parent=BODY, fontSize=8.8, leading=12, spaceAfter=0)
CELLH = ParagraphStyle("CellH", parent=CELL, textColor=colors.white, fontName="Helvetica-Bold")
TITLE = ParagraphStyle("Title", parent=styles["Title"], fontSize=30, textColor=DARK, spaceAfter=6)
SUB = ParagraphStyle("Sub", parent=BODY, fontSize=12, textColor=GREY, alignment=TA_CENTER)


def code_block(text):
    """A shaded, padded code block."""
    t = Table([[Preformatted(text, CODE)]], colWidths=[165 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def table(headers, rows, col_widths):
    data = [[Paragraph(h, CELLH) for h in headers]]
    for r in rows:
        data.append([Paragraph(str(c), CELL) for c in r])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ORANGE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F8F9")]),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def rule():
    return HRFlowable(width="100%", thickness=0.6, color=LINE, spaceBefore=8, spaceAfter=8)


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GREY)
    canvas.drawString(20 * mm, 12 * mm, "Reddit Clone — Microservices Backend")
    canvas.drawRightString(190 * mm, 12 * mm, f"Page {doc.page}")
    canvas.setStrokeColor(LINE)
    canvas.line(20 * mm, 15 * mm, 190 * mm, 15 * mm)
    canvas.restoreState()


story = []

# ---------------- Cover ----------------
story.append(Spacer(1, 60 * mm))
story.append(Paragraph("Reddit Clone", TITLE))
story.append(Paragraph("Microservices Backend", ParagraphStyle("st", parent=TITLE, fontSize=18, textColor=ORANGE)))
story.append(Spacer(1, 8 * mm))
story.append(Paragraph("How to Use &amp; Run — Step-by-Step Guide", SUB))
story.append(Spacer(1, 4 * mm))
story.append(Paragraph("Node.js · TypeScript · Express · PostgreSQL · Redis · RabbitMQ · Docker Compose", SUB))
story.append(PageBreak())

# ---------------- 1. What you get ----------------
story.append(Paragraph("1. What you are running", H1))
story.append(Paragraph(
    "This is a Reddit-style social platform split into <b>eight microservices</b> behind a single "
    "<b>API Gateway</b>. Each service owns its own PostgreSQL database, services talk to each other "
    "asynchronously through <b>RabbitMQ</b> events, and the feed is ranked in <b>Redis</b>. "
    "Everything runs with one command via Docker Compose.", BODY))
story.append(Paragraph("The gateway is the only public entry point — all requests go to "
                       "<b>http://localhost:8080</b>.", BODY))
story.append(Spacer(1, 3))
story.append(table(
    ["Service", "Purpose", "Database"],
    [
        ["api-gateway", "Routing, JWT validation, rate limiting", "—"],
        ["auth-service", "Register / login / refresh, JWT issuance", "auth_db"],
        ["user-service", "Profiles &amp; karma", "user_db"],
        ["community-service", "Communities, join / leave", "community_db"],
        ["post-service", "Posts", "post_db"],
        ["comment-service", "Nested comments", "comment_db"],
        ["vote-service", "Up / down votes", "vote_db"],
        ["feed-service", "Hot &amp; top ranking", "Redis"],
        ["notification-service", "Event-based notifications", "notification_db"],
    ],
    [42 * mm, 90 * mm, 33 * mm],
))
story.append(rule())

# ---------------- 2. Prerequisites ----------------
story.append(Paragraph("2. Prerequisites", H1))
story.append(Paragraph(
    "You only need <b>Docker Desktop</b> (which includes Docker Compose v2). No local Node.js is required "
    "— every service builds and runs inside its own container.", BODY))
story.append(table(
    ["Requirement", "Notes"],
    [
        ["Docker 20+ &amp; Compose v2", "Use <font face='Courier'>docker compose</font> (space), not the old <font face='Courier'>docker-compose</font>."],
        ["Free ports", "8080 (API), 5432 (Postgres), 6379 (Redis), 5672 &amp; 15672 (RabbitMQ)."],
        ["~2 GB free RAM", "For the 9 app containers + 3 infrastructure containers."],
    ],
    [55 * mm, 110 * mm],
))
story.append(rule())

# ---------------- 3. Configure ----------------
story.append(Paragraph("3. Step 1 — Configure the environment", H1))
story.append(Paragraph("From the project root, copy the environment template to <font face='Courier'>.env</font>:", BODY))
story.append(code_block("# macOS / Linux\ncp .env.example .env\n\n# Windows PowerShell\nCopy-Item .env.example .env"))
story.append(Paragraph("The defaults work out of the box for local use. For anything beyond local testing, "
                       "change <b>JWT_SECRET</b> and the database / RabbitMQ passwords.", SMALL))
story.append(rule())

# ---------------- 4. Build & start ----------------
story.append(Paragraph("4. Step 2 — Build and start everything", H1))
story.append(code_block("docker compose up --build"))
story.append(Paragraph(
    "The first run downloads base images and compiles each service — give it a few minutes. The stack is "
    "ready when every service prints a line like <font face='Courier'>listening on :4001</font>. "
    "Postgres, Redis, and RabbitMQ have health checks, so the app services wait for them automatically.", BODY))
story.append(Paragraph("To run it in the background instead, use <font face='Courier'>docker compose up --build -d</font>.", SMALL))
story.append(rule())

# ---------------- 5. Verify ----------------
story.append(Paragraph("5. Step 3 — Verify it is running", H1))
story.append(code_block(
    'curl http://localhost:8080/health\n'
    '# {"status":"ok","service":"api-gateway"}'))
story.append(Paragraph(
    "You can also open the <b>RabbitMQ management UI</b> at <font face='Courier'>http://localhost:15672</font> "
    "(default login <font face='Courier'>reddit</font> / <font face='Courier'>reddit_pass</font>) to watch the "
    "<font face='Courier'>reddit.events</font> exchange and the per-service queues.", BODY))
story.append(PageBreak())

# ---------------- 6. Use the API ----------------
story.append(Paragraph("6. Step 4 — Use the API (full walkthrough)", H1))
story.append(Paragraph("Every call goes through the gateway at <b>http://localhost:8080</b>. "
                       "Protected endpoints need an <font face='Courier'>Authorization: Bearer &lt;token&gt;</font> header.", BODY))

story.append(Paragraph("6.1  Register a user", H2))
story.append(code_block(
    "curl -X POST http://localhost:8080/auth/register \\\n"
    "  -H 'Content-Type: application/json' \\\n"
    '  -d \'{"username":"alice","email":"alice@example.com","password":"password123"}\'\n\n'
    "# Response includes: user, accessToken, refreshToken\n"
    "# Behind the scenes: a profile is created and a 'welcome' notification is sent."))

story.append(Paragraph("6.2  Log in (later sessions)", H2))
story.append(code_block(
    "curl -X POST http://localhost:8080/auth/login \\\n"
    "  -H 'Content-Type: application/json' \\\n"
    '  -d \'{"identifier":"alice","password":"password123"}\'\n'
    "# 'identifier' accepts either the username or the email."))

story.append(Paragraph("6.3  Create a community", H2))
story.append(code_block(
    "curl -X POST http://localhost:8080/communities \\\n"
    "  -H 'Authorization: Bearer <accessToken>' \\\n"
    "  -H 'Content-Type: application/json' \\\n"
    '  -d \'{"name":"programming","description":"All things code"}\'\n'
    "# Returns the community id; the creator auto-joins."))

story.append(Paragraph("6.4  Create a post", H2))
story.append(code_block(
    "curl -X POST http://localhost:8080/posts \\\n"
    "  -H 'Authorization: Bearer <accessToken>' \\\n"
    "  -H 'Content-Type: application/json' \\\n"
    '  -d \'{"communityId":"<communityId>","title":"Hello world","body":"My first post"}\''))

story.append(Paragraph("6.5  Vote on the post", H2))
story.append(code_block(
    "curl -X POST http://localhost:8080/votes \\\n"
    "  -H 'Authorization: Bearer <accessToken>' \\\n"
    "  -H 'Content-Type: application/json' \\\n"
    '  -d \'{"targetType":"post","targetId":"<postId>","value":1}\'\n'
    "# value: 1 = upvote, -1 = downvote, 0 = remove vote"))

story.append(Paragraph("6.6  Read the feed and notifications", H2))
story.append(code_block(
    "# Hot feed (time-decayed ranking)\n"
    "curl http://localhost:8080/feed\n\n"
    "# Your notifications\n"
    "curl http://localhost:8080/notifications -H 'Authorization: Bearer <accessToken>'"))
story.append(Paragraph("See the README for the complete endpoint reference (comments, leaving communities, "
                       "vote scores, marking notifications read, and more).", SMALL))
story.append(PageBreak())

# ---------------- 7. Everyday commands ----------------
story.append(Paragraph("7. Everyday commands", H1))
story.append(table(
    ["Command", "What it does"],
    [
        ["docker compose up --build", "Build (if needed) and start the whole stack."],
        ["docker compose up -d", "Start in the background (detached)."],
        ["docker compose ps", "Show status of all containers."],
        ["docker compose logs -f auth-service", "Tail the logs of one service."],
        ["docker compose up -d --build post-service", "Rebuild and restart a single service."],
        ["docker compose down", "Stop and remove containers."],
        ["docker compose down -v", "Stop and also delete the Postgres data volume (full reset)."],
    ],
    [82 * mm, 83 * mm],
))
story.append(rule())

# ---------------- 8. Troubleshooting ----------------
story.append(Paragraph("8. Troubleshooting", H1))
story.append(table(
    ["Symptom", "Fix"],
    [
        ["502 Upstream service unavailable", "The target service is still starting. Wait for its 'listening on' log or check <font face='Courier'>docker compose logs &lt;svc&gt;</font>."],
        ["A service keeps restarting", "It could not reach Postgres / RabbitMQ on first boot. It recovers on the automatic restart."],
        ["Port already in use", "Another process holds 8080 / 5432 / 6379 / 5672. Stop it or change the port in <font face='Courier'>.env</font>."],
        ["Stale data after schema changes", "Run <font face='Courier'>docker compose down -v</font>, then <font face='Courier'>up --build</font>."],
        ["401 Authentication required", "Missing or expired token. Log in again, or call <font face='Courier'>/auth/refresh</font>."],
    ],
    [58 * mm, 107 * mm],
))
story.append(rule())

# ---------------- 9. How it fits together ----------------
story.append(Paragraph("9. How it fits together", H1))
story.append(Paragraph(
    "When you act on the platform, services publish events that other services react to. This keeps each "
    "service independent and the system responsive:", BODY))
story.append(table(
    ["Event", "Triggered by", "Reaction"],
    [
        ["user.created", "Registering", "Profile created · welcome notification"],
        ["post.created", "Creating a post", "Post indexed into the ranked feed"],
        ["comment.created", "Commenting", "The replied-to user is notified"],
        ["vote.created", "Voting", "Score, author karma, feed rank &amp; notification all update"],
    ],
    [42 * mm, 43 * mm, 80 * mm],
))
story.append(Spacer(1, 4))
story.append(Paragraph(
    "Feed ranking uses the decay formula <font face='Courier'>rank = score / (ageInHours + 2)^1.5</font>, "
    "recomputed in Redis every time a vote arrives.", SMALL))

doc = SimpleDocTemplate(
    OUT, pagesize=A4,
    leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=20 * mm,
    title="Reddit Clone — How to Use & Run", author="Reddit Clone Microservices",
)
doc.build(story, onFirstPage=lambda c, d: None, onLaterPages=footer)
print("Wrote", OUT)
