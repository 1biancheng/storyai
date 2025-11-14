# PowerShell script to initialize chapters functionality
# Creates database table and directory structure

Write-Host "Initializing chapters functionality..." -ForegroundColor Cyan

# Create workspace directories
Write-Host "Creating workspace directories..." -ForegroundColor Yellow
$workspaceDir = "workspace\chapters"
$uploadsDir = "uploads"

if (-not (Test-Path $workspaceDir)) {
    New-Item -ItemType Directory -Path $workspaceDir -Force | Out-Null
    Write-Host "  Created: $workspaceDir" -ForegroundColor Green
} else {
    Write-Host "  Already exists: $workspaceDir" -ForegroundColor Gray
}

if (-not (Test-Path $uploadsDir)) {
    New-Item -ItemType Directory -Path $uploadsDir -Force | Out-Null
    Write-Host "  Created: $uploadsDir" -ForegroundColor Green
} else {
    Write-Host "  Already exists: $uploadsDir" -ForegroundColor Gray
}

# Database setup instructions
Write-Host "`nDatabase Setup:" -ForegroundColor Yellow
Write-Host "Run the following SQL migration file to create the chapters table:" -ForegroundColor White
Write-Host "  migrations\004_create_chapters_table.sql" -ForegroundColor Cyan
Write-Host "`nUsing psql:" -ForegroundColor White
Write-Host "  psql -U your_db_user -d story_ai -f migrations\004_create_chapters_table.sql" -ForegroundColor Gray

Write-Host "`nOr manually execute the SQL:" -ForegroundColor White
Write-Host @"
  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    chapter_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    word_count INTEGER DEFAULT 0,
    tags JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_project_chapter UNIQUE (project_id, chapter_number)
  );
  
  CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(project_id);
  CREATE INDEX IF NOT EXISTS idx_chapters_number ON chapters(project_id, chapter_number);
"@ -ForegroundColor Gray

Write-Host "`n✅ Initialization complete!" -ForegroundColor Green
Write-Host "No additional frontend dependencies required." -ForegroundColor Green
Write-Host "All components use existing libraries (marked, zustand, tailwindcss)." -ForegroundColor Green

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Run the database migration" -ForegroundColor White
Write-Host "2. Start the backend server: python backend\main.py" -ForegroundColor White
Write-Host "3. Start the frontend dev server: npm run dev" -ForegroundColor White
Write-Host "4. Access WritingSpaceV2 component in your project" -ForegroundColor White
# PowerShell script to initialize chapters functionality
# Creates database table and directory structure

Write-Host "Initializing chapters functionality..." -ForegroundColor Cyan

# Create workspace directories
Write-Host "Creating workspace directories..." -ForegroundColor Yellow
$workspaceDir = "workspace\chapters"
$uploadsDir = "uploads"

if (-not (Test-Path $workspaceDir)) {
    New-Item -ItemType Directory -Path $workspaceDir -Force | Out-Null
    Write-Host "  Created: $workspaceDir" -ForegroundColor Green
} else {
    Write-Host "  Already exists: $workspaceDir" -ForegroundColor Gray
}

if (-not (Test-Path $uploadsDir)) {
    New-Item -ItemType Directory -Path $uploadsDir -Force | Out-Null
    Write-Host "  Created: $uploadsDir" -ForegroundColor Green
} else {
    Write-Host "  Already exists: $uploadsDir" -ForegroundColor Gray
}

# Database setup instructions
Write-Host "`nDatabase Setup:" -ForegroundColor Yellow
Write-Host "Run the following SQL migration file to create the chapters table:" -ForegroundColor White
Write-Host "  migrations\004_create_chapters_table.sql" -ForegroundColor Cyan
Write-Host "`nUsing psql:" -ForegroundColor White
Write-Host "  psql -U your_db_user -d story_ai -f migrations\004_create_chapters_table.sql" -ForegroundColor Gray

Write-Host "`nOr manually execute the SQL:" -ForegroundColor White
Write-Host @"
  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    chapter_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    word_count INTEGER DEFAULT 0,
    tags JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_project_chapter UNIQUE (project_id, chapter_number)
  );
  
  CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(project_id);
  CREATE INDEX IF NOT EXISTS idx_chapters_number ON chapters(project_id, chapter_number);
"@ -ForegroundColor Gray

Write-Host "`n✅ Initialization complete!" -ForegroundColor Green
Write-Host "No additional frontend dependencies required." -ForegroundColor Green
Write-Host "All components use existing libraries (marked, zustand, tailwindcss)." -ForegroundColor Green

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Run the database migration" -ForegroundColor White
Write-Host "2. Start the backend server: python backend\main.py" -ForegroundColor White
Write-Host "3. Start the frontend dev server: npm run dev" -ForegroundColor White
Write-Host "4. Access WritingSpaceV2 component in your project" -ForegroundColor White
