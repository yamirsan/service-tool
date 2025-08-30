@echo off
echo Starting Service Tool Application...
echo.

echo Installing Python dependencies...
pip install -r requirements.txt

echo.
echo Creating/updating database with sample data...
python import_excel.py

echo.
echo Starting FastAPI backend server...
echo Backend will be available at http://localhost:8000
echo API documentation at http://localhost:8000/docs
echo.

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
