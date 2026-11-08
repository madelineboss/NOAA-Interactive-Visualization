# U.S. Warming by Season and Region
An interactive dashboard built on NOAA's Global Historical Climatology Network - Daily (GHCN-Daily)

The project has two halves that run at the same time on your computer. 

#### Requirements
- fastapi
- uvicorn
- pandas
- python version 3.10 or newer | python3 --version
- node.js 20.19 or newer | node -v
- npm | npm -v

#### Backend
Open a terminal.
From the repo root:
```
cd assignment2/backend
source .venv/bin/activate   #Windows: .venv\Scripts\activate
pip install fastapi
pip install uvicorn
pip install pandas
uvicorn main:app --port 8000
```
You should see:
Loaded 112 stations, ... station-months
INFO:   Uvicorn running on http://127.0.0.1:8000

Leave this terminal running.

#### Frontend
Open a new (second) terminal.
From the root:
```
cd assignment2/frontend
npm install
npm run dev
```
Should give http://localhost:5173, if not follow the link it will provide to you.

#### Jupyter Notebook
It is not necessary to run the jupyter notebook. The data has already been collected and saved into csv files that are in the backend folder. It is just to show how the data was collected.
This is located at assignment2/Assignment2_data_prep.ipynb

#### Troubleshooting
If the page is blank, open the browser console and check for errors. 

If 'address already in use', another program is using the port. Stop that program, use 'lsof -i :8000' to identify what is using that port. 

If 'cant' reach backend' make sure that the backend is running with no console errors
