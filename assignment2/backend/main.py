from pathlib import Path
from typing import Literal

import numpy as np 
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="GHCN-Daily Dashboard API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

#------------------Load and prepare the data once, at startup --------------------#
DATA = Path(__file)