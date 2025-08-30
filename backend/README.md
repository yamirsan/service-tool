# Service Tool Application

A comprehensive parts management system with Excel import, database storage, and web interface.

## Features

- Excel file import to SQLite database
- RESTful API backend with FastAPI
- React frontend with Tailwind CSS
- Parts search and filtering
- Pricing calculations
- Real-time data sync

## Database Structure

### Parts Table
- Part codes, descriptions, pricing, stock quantities
- MAP prices, net prices, and price differences
- Stock quantities and GR information

### Formulas Table
- Class-based pricing formulas
- Labor costs for different levels
- Exchange rates and final IQD pricing

### Users Table
- Staff authentication and access control

## Quick Start

### Option 1: Automated Setup (Recommended)
```bash
# Double-click this file to start everything automatically
start_app.bat
```

### Option 2: Manual Setup

#### Backend Setup
```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Initialize database with sample data
python import_excel.py

# 3. Start backend server
python main.py
```
Backend runs on: http://localhost:8000

#### Frontend Setup
```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install Node.js dependencies
npm install

# 3. Fix security vulnerabilities (recommended)
npm audit fix

# 4. Start React development server
npm start
```
Frontend runs on: http://localhost:3000

## Default Login
- **Username:** admin
- **Password:** admin123

## API Endpoints

- `GET /parts` - List all parts with filtering
- `GET /parts/{id}` - Get specific part
- `POST /parts` - Create new part
- `PUT /parts/{id}` - Update part
- `DELETE /parts/{id}` - Delete part
- `GET /formulas` - Get pricing formulas
- `POST /calculate-price` - Calculate final pricing
- `POST /upload-excel` - Sync Excel data
