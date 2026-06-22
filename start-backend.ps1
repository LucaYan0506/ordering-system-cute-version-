$ErrorActionPreference = "Stop"

$BackendDir = Join-Path $PSScriptRoot "backend"
$SitePackages = ".venv\Lib\site-packages"

Set-Location $BackendDir
if (Test-Path $SitePackages) {
    $env:PYTHONPATH = $SitePackages
}

python manage.py migrate
python manage.py seed_demo
python manage.py runserver 127.0.0.1:8000 --noreload
