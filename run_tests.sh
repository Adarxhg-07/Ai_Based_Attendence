#!/bin/bash
# End-to-End Test Suite for Attendance System
cd "$(dirname "$0")"

PASS=0; FAIL=0; TOTAL=0
result() {
  TOTAL=$((TOTAL+1))
  if [ "$1" = "PASS" ]; then
    PASS=$((PASS+1))
    echo "  PASS  $2"
  else
    FAIL=$((FAIL+1))
    echo "  FAIL  $2 -- $3"
  fi
}

check_success() {
  python -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('success') else 1)" 2>/dev/null
}

echo "============================================"
echo "  E2E TEST SUITE - Attendance System"
echo "============================================"
echo ""

# ---- AUTH TESTS ----
echo "--- AUTH ---"

# Login admin
R=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@university.edu","password":"admin123"}')
ADMIN_TOKEN=$(echo "$R" | python -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null)
ADMIN_REFRESH=$(echo "$R" | python -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['refreshToken'])" 2>/dev/null)
[ -n "$ADMIN_TOKEN" ] && result "PASS" "Admin login" || result "FAIL" "Admin login" "rate limited or error"

# Login teacher
R=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@university.edu","password":"teacher123"}')
TEACHER_TOKEN=$(echo "$R" | python -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null)
[ -n "$TEACHER_TOKEN" ] && result "PASS" "Teacher login" || result "FAIL" "Teacher login"

# Login tester
R=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tester@university.edu","password":"tester123"}')
TESTER_TOKEN=$(echo "$R" | python -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null)
[ -n "$TESTER_TOKEN" ] && result "PASS" "Tester login" || result "FAIL" "Tester login"

# Wrong password
R=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@university.edu","password":"wrong"}')
echo "$R" | python -c "import sys,json; d=json.load(sys.stdin); exit(0 if not d.get('success') else 1)" 2>/dev/null \
  && result "PASS" "Wrong password rejected" || result "FAIL" "Wrong password rejected"

# Token refresh
R=$(curl -s -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$ADMIN_REFRESH\"}")
echo "$R" | check_success && result "PASS" "Token refresh" || result "FAIL" "Token refresh"

# No auth header
R=$(curl -s http://localhost:3000/api/v1/admin/students)
echo "$R" | python -c "import sys,json; d=json.load(sys.stdin); exit(0 if not d.get('success') else 1)" 2>/dev/null \
  && result "PASS" "Unauthenticated blocked" || result "FAIL" "Unauthenticated blocked"

# RBAC: teacher cant access admin
R=$(curl -s http://localhost:3000/api/v1/admin/students \
  -H "Authorization: Bearer $TEACHER_TOKEN")
echo "$R" | python -c "import sys,json; d=json.load(sys.stdin); exit(0 if not d.get('success') else 1)" 2>/dev/null \
  && result "PASS" "RBAC: teacher->admin blocked" || result "FAIL" "RBAC: teacher->admin blocked"

echo ""
echo "--- ADMIN APIs ---"

# Students
R=$(curl -s "http://localhost:3000/api/v1/admin/students?page=1&limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
COUNT=$(echo "$R" | python -c "import sys,json; d=json.load(sys.stdin); print(d['data']['pagination']['totalItems'])" 2>/dev/null)
[ "${COUNT:-0}" -gt 100 ] 2>/dev/null && result "PASS" "List students ($COUNT total)" || result "FAIL" "List students" "count=$COUNT"

# Teachers
R=$(curl -s "http://localhost:3000/api/v1/admin/teachers" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$R" | check_success && result "PASS" "List teachers" || result "FAIL" "List teachers"

# Courses
R=$(curl -s "http://localhost:3000/api/v1/admin/courses" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$R" | check_success && result "PASS" "List courses" || result "FAIL" "List courses"

# Classrooms
R=$(curl -s "http://localhost:3000/api/v1/admin/classrooms" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$R" | check_success && result "PASS" "List classrooms" || result "FAIL" "List classrooms"

# Timetables
R=$(curl -s "http://localhost:3000/api/v1/admin/timetables" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$R" | check_success && result "PASS" "List timetables" || result "FAIL" "List timetables"

# Audit logs
R=$(curl -s "http://localhost:3000/api/v1/admin/logs/audit" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$R" | check_success && result "PASS" "Audit logs" || result "FAIL" "Audit logs"

echo ""
echo "--- TEACHER APIs ---"

# Schedule
R=$(curl -s "http://localhost:3000/api/v1/teacher/schedule/weekly" \
  -H "Authorization: Bearer $TEACHER_TOKEN")
SCHED_COUNT=$(echo "$R" | python -c "import sys,json; d=json.load(sys.stdin); print(sum(len(v) for v in d.get('data',{}).values()))" 2>/dev/null)
[ "${SCHED_COUNT:-0}" -gt 0 ] 2>/dev/null \
  && result "PASS" "Teacher schedule ($SCHED_COUNT entries)" || result "FAIL" "Teacher schedule" "count=$SCHED_COUNT"

# Get schedule ID (first entry from any day)
SCHEDULE_ID=$(echo "$R" | python -c "
import sys,json
d=json.load(sys.stdin)
for day, entries in d.get('data',{}).items():
    if entries:
        print(entries[0]['id'])
        break
" 2>/dev/null)

# Start session (accepts new session or existing session for today)
R=$(curl -s -X POST "http://localhost:3000/api/v1/teacher/classes/$SCHEDULE_ID/attendance/start" \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json")
SESSION_ID=$(echo "$R" | python -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success'):
    print(d['data']['id'])
elif d.get('error',{}).get('code') == 'SESSION_EXISTS':
    print(d['error']['details']['existingSessionId'])
" 2>/dev/null)
[ -n "$SESSION_ID" ] && result "PASS" "Start attendance session" || result "FAIL" "Start attendance session" "$(echo "$R" | head -c 150)"

echo ""
echo "--- AI SERVICE ---"

# Health
R=$(curl -s http://localhost:8000/health)
echo "$R" | python -c "import sys,json; exit(0 if json.load(sys.stdin).get('modelLoaded') else 1)" 2>/dev/null \
  && result "PASS" "AI health (models loaded)" || result "FAIL" "AI health"

# Encodings count
R=$(curl -s http://localhost:8000/api/v1/encodings)
ENC_COUNT=$(echo "$R" | python -c "import sys,json; print(json.load(sys.stdin).get('totalStudents',0))" 2>/dev/null)
[ "${ENC_COUNT:-0}" -gt 100 ] 2>/dev/null \
  && result "PASS" "Encodings loaded ($ENC_COUNT students)" || result "FAIL" "Encodings" "count=$ENC_COUNT"

# Students metadata
R=$(curl -s http://localhost:8000/api/v1/encodings/students)
STU_COUNT=$(echo "$R" | python -c "import sys,json; print(json.load(sys.stdin).get('totalStudents',0))" 2>/dev/null)
[ "${STU_COUNT:-0}" -gt 100 ] 2>/dev/null \
  && result "PASS" "Student metadata ($STU_COUNT)" || result "FAIL" "Student metadata" "count=$STU_COUNT"

echo ""
echo "--- TESTER APIs ---"

# Tester list students
R=$(curl -s "http://localhost:3000/api/v1/testing/students" \
  -H "Authorization: Bearer $TESTER_TOKEN")
TST_COUNT=$(echo "$R" | python -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null)
[ "${TST_COUNT:-0}" -gt 0 ] 2>/dev/null \
  && result "PASS" "Tester: list students ($TST_COUNT)" || result "FAIL" "Tester: list students"

echo ""
echo "--- FACE RECOGNITION ---"

# Single face recognition test
TEST_IMG="Data received/2023011/IMG_6788 - Abdul Moiz.jpeg"
if [ -f "$TEST_IMG" ]; then
  R=$(curl -s -X POST "http://localhost:3000/api/v1/testing/recognize" \
    -H "Authorization: Bearer $TESTER_TOKEN" \
    -F "images=@$TEST_IMG" \
    --max-time 120)
  RECOGNIZED=$(echo "$R" | python -c "
import sys,json
d=json.load(sys.stdin)
results = d.get('data', [])
if results:
    rec = results[0].get('result',{}).get('recognizedStudents',[])
    print(len(rec))
else:
    print(0)
" 2>/dev/null)
  [ "${RECOGNIZED:-0}" -gt 0 ] 2>/dev/null \
    && result "PASS" "Face recognition ($RECOGNIZED faces)" || result "FAIL" "Face recognition" "recognized=$RECOGNIZED"
else
  result "FAIL" "Face recognition" "test image not found"
fi

echo ""
echo "--- EXCEL DOWNLOAD ---"

# Test Excel download via tester
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:3000/api/v1/testing/download-excel" \
  -H "Authorization: Bearer $TESTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"students":[{"name":"Test Student","registrationNumber":"2023011","status":"PRESENT","confidence":0.95,"matchMethod":"cosine"}],"title":"Test Sheet"}')
[ "$R" = "200" ] && result "PASS" "Excel download (HTTP $R)" || result "FAIL" "Excel download" "HTTP $R"

echo ""
echo "--- FRONTEND ---"

# HTML served
R=$(curl -s http://localhost:3001/)
echo "$R" | grep -q "<!doctype html>" && result "PASS" "Frontend serves HTML" || result "FAIL" "Frontend HTML"

# API proxy through frontend
R=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tester@university.edu","password":"tester123"}')
echo "$R" | check_success && result "PASS" "Frontend API proxy" || result "FAIL" "Frontend API proxy"

echo ""
echo "============================================"
if [ $FAIL -eq 0 ]; then
  echo "  ALL $TOTAL TESTS PASSED"
else
  echo "  $PASS/$TOTAL passed, $FAIL failed"
fi
echo "============================================"
