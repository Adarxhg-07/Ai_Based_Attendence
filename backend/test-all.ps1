$base = "http://localhost:3000/api/v1"
$pass = 0
$fail = 0

function Test($name, $block) {
    try {
        $result = & $block
        Write-Host "[PASS] $name" -ForegroundColor Green
        $script:pass++
        return $result
    } catch {
        Write-Host "[FAIL] $name - $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++
        return $null
    }
}

# ============================================================
Write-Host "`n====== AUTH ======" -ForegroundColor Cyan
# ============================================================

$adminToken = Test "Admin login" {
    $body = @{ email = "admin@university.edu"; password = "admin123" } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -Body $body -ContentType "application/json"
    if (-not $r.success) { throw "Login failed" }
    return $r.data.tokens.accessToken
}
$adminHeaders = @{ Authorization = "Bearer $adminToken" }

$teacherToken = Test "Teacher login" {
    $body = @{ email = "teacher@university.edu"; password = "teacher123" } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -Body $body -ContentType "application/json"
    if (-not $r.success) { throw "Login failed" }
    return $r.data.tokens.accessToken
}
$teacherHeaders = @{ Authorization = "Bearer $teacherToken" }

Test "Get admin profile" {
    $r = Invoke-RestMethod -Uri "$base/auth/me" -Headers $adminHeaders
    if ($r.data.email -ne "admin@university.edu") { throw "Wrong profile" }
}

Test "Reject unauthenticated" {
    try {
        Invoke-RestMethod -Uri "$base/admin/students" -ErrorAction Stop
        throw "Should have been rejected"
    } catch {
        if ($_.Exception.Message -match "401") { return }
        if ($_.Exception.Message -match "Should have been rejected") { throw $_ }
        # Any other HTTP error means it was rejected
    }
}

# ============================================================
Write-Host "`n====== STUDENTS CRUD ======" -ForegroundColor Cyan
# ============================================================

$studentId = Test "Create student" {
    $body = @{
        registrationNumber = "2024-CS-TEST"
        firstName = "Test"
        lastName = "Student"
        email = "test.student@uni.edu"
    } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$base/admin/students" -Method POST -Body $body -ContentType "application/json" -Headers $adminHeaders
    if (-not $r.success) { throw "Create failed" }
    return $r.data.id
}

Test "List students" {
    $r = Invoke-RestMethod -Uri "$base/admin/students" -Headers $adminHeaders
    if ($r.data.pagination.totalItems -lt 1) { throw "No students found" }
}

Test "Get student by ID" {
    $r = Invoke-RestMethod -Uri "$base/admin/students/$studentId" -Headers $adminHeaders
    if ($r.data.firstName -ne "Test") { throw "Wrong student" }
}

Test "Update student" {
    $body = @{ firstName = "Updated" } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$base/admin/students/$studentId" -Method PUT -Body $body -ContentType "application/json" -Headers $adminHeaders
    if ($r.data.firstName -ne "Updated") { throw "Update failed" }
}

Test "Search students" {
    $r = Invoke-RestMethod -Uri "$base/admin/students?search=Updated" -Headers $adminHeaders
    if ($r.data.pagination.totalItems -lt 1) { throw "Search returned nothing" }
}

# ============================================================
Write-Host "`n====== TEACHERS CRUD ======" -ForegroundColor Cyan
# ============================================================

Test "List teachers" {
    $r = Invoke-RestMethod -Uri "$base/admin/teachers" -Headers $adminHeaders
    if ($r.data.pagination.totalItems -lt 1) { throw "No teachers found" }
}

$newTeacherId = Test "Create teacher" {
    $body = @{
        email = "new.teacher@uni.edu"
        firstName = "New"
        lastName = "Teacher"
    } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$base/admin/teachers" -Method POST -Body $body -ContentType "application/json" -Headers $adminHeaders
    if (-not $r.success) { throw "Create failed" }
    return $r.data.id
}

Test "Get teacher by ID" {
    $r = Invoke-RestMethod -Uri "$base/admin/teachers/$newTeacherId" -Headers $adminHeaders
    # findById returns Teacher with nested user, so firstName is at user.firstName
    if ($r.data.user.firstName -ne "New") { throw "Wrong teacher: $($r.data | ConvertTo-Json -Depth 2)" }
}

# ============================================================
Write-Host "`n====== COURSES CRUD ======" -ForegroundColor Cyan
# ============================================================

$courseId = Test "Create course" {
    $body = @{
        code = "CS401-TEST"
        name = "Test Course"
        creditHours = 3
    } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$base/admin/courses" -Method POST -Body $body -ContentType "application/json" -Headers $adminHeaders
    if (-not $r.success) { throw "Create failed" }
    return $r.data.id
}

Test "List courses" {
    $r = Invoke-RestMethod -Uri "$base/admin/courses" -Headers $adminHeaders
    if ($r.data.pagination.totalItems -lt 1) { throw "No courses found" }
}

Test "Get course by ID" {
    $r = Invoke-RestMethod -Uri "$base/admin/courses/$courseId" -Headers $adminHeaders
    if ($r.data.code -ne "CS401-TEST") { throw "Wrong course" }
}

Test "Update course" {
    $body = @{ name = "Updated Test Course" } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$base/admin/courses/$courseId" -Method PUT -Body $body -ContentType "application/json" -Headers $adminHeaders
    if ($r.data.name -ne "Updated Test Course") { throw "Update failed" }
}

# ============================================================
Write-Host "`n====== CLASSROOMS CRUD ======" -ForegroundColor Cyan
# ============================================================

$classroomId = Test "Create classroom" {
    $body = @{
        roomId = "TEST-LAB-01"
        name = "Test Laboratory"
        building = "Test Building"
        capacity = 50
    } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$base/admin/classrooms" -Method POST -Body $body -ContentType "application/json" -Headers $adminHeaders
    if (-not $r.success) { throw "Create failed" }
    return $r.data.id
}

Test "List classrooms" {
    $r = Invoke-RestMethod -Uri "$base/admin/classrooms" -Headers $adminHeaders
    if ($r.data.pagination.totalItems -lt 1) { throw "No classrooms found" }
}

Test "Get classroom by ID" {
    $r = Invoke-RestMethod -Uri "$base/admin/classrooms/$classroomId" -Headers $adminHeaders
    if ($r.data.roomId -ne "TEST-LAB-01") { throw "Wrong classroom" }
}

# ============================================================
Write-Host "`n====== TIMETABLES CRUD ======" -ForegroundColor Cyan
# ============================================================

Test "List timetables" {
    $r = Invoke-RestMethod -Uri "$base/admin/timetables" -Headers $adminHeaders
    if (-not $r.success) { throw "List failed" }
}

Test "Get weekly timetable" {
    $r = Invoke-RestMethod -Uri "$base/admin/timetables/weekly" -Headers $adminHeaders
    if (-not $r.success) { throw "Weekly view failed" }
}

# ============================================================
Write-Host "`n====== TEACHER ATTENDANCE ENDPOINTS ======" -ForegroundColor Cyan
# ============================================================

Test "Get today's schedule (teacher)" {
    $r = Invoke-RestMethod -Uri "$base/teacher/schedule/today" -Headers $teacherHeaders
    if (-not $r.success) { throw "Schedule failed" }
}

Test "Get weekly schedule (teacher)" {
    $r = Invoke-RestMethod -Uri "$base/teacher/schedule/weekly" -Headers $teacherHeaders
    if (-not $r.success) { throw "Weekly schedule failed" }
}

Test "Teacher cannot access admin endpoints" {
    try {
        Invoke-RestMethod -Uri "$base/admin/students" -Headers $teacherHeaders -ErrorAction Stop
        throw "Should have been rejected"
    } catch {
        if ($_.Exception.Message -match "403") { return }
        if ($_.Exception.Message -match "Should have been rejected") { throw $_ }
    }
}

# ============================================================
Write-Host "`n====== AUDIT LOGS ======" -ForegroundColor Cyan
# ============================================================

Test "Get audit logs (admin)" {
    $r = Invoke-RestMethod -Uri "$base/admin/logs/audit" -Headers $adminHeaders
    if (-not $r.success) { throw "Audit logs failed" }
}

Test "Get attendance logs (admin)" {
    $r = Invoke-RestMethod -Uri "$base/admin/logs/attendance" -Headers $adminHeaders
    if (-not $r.success) { throw "Attendance logs failed" }
}

Test "Teacher cannot access audit logs" {
    try {
        Invoke-RestMethod -Uri "$base/admin/logs/audit" -Headers $teacherHeaders -ErrorAction Stop
        throw "Should have been rejected"
    } catch {
        if ($_.Exception.Message -match "403") { return }
        if ($_.Exception.Message -match "Should have been rejected") { throw $_ }
    }
}

# ============================================================
Write-Host "`n====== CLEANUP ======" -ForegroundColor Cyan
# ============================================================

Test "Delete student (soft delete)" {
    $r = Invoke-RestMethod -Uri "$base/admin/students/$studentId" -Method DELETE -Headers $adminHeaders
    if (-not $r.success) { throw "Delete failed" }
}

Test "Delete course (soft delete)" {
    $r = Invoke-RestMethod -Uri "$base/admin/courses/$courseId" -Method DELETE -Headers $adminHeaders
    if (-not $r.success) { throw "Delete failed" }
}

Test "Delete classroom (soft delete)" {
    $r = Invoke-RestMethod -Uri "$base/admin/classrooms/$classroomId" -Method DELETE -Headers $adminHeaders
    if (-not $r.success) { throw "Delete failed" }
}

# ============================================================
Write-Host "`n==============================" -ForegroundColor Yellow
Write-Host "Results: $pass passed, $fail failed" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
Write-Host "==============================`n" -ForegroundColor Yellow
