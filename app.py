import streamlit as st
import pandas as pd
import numpy as np
import json
import os
from sqlalchemy import create_engine
from google import genai
import firebase_admin
from firebase_admin import credentials, firestore
import docx
from pypdf import PdfReader
import plotly.express as px

    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@firebase/eslint-plugin-security-rules": "^0.0.2",
    "@google/genai": "^2.4.0",
    "@tailwindcss/vite": "^4.3.3",
    "@vitejs/plugin-react": "^6.1.1",
    "dotenv": "^17.2.3",
    "eslint": "^10.15.0",
    "express": "^4.21.2",
    "firebase": "^13.3.0",
    "lucide-react": "^0.546.0",
    "mammoth": "^1.13.0",
    "motion": "^12.23.24",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "recharts": "^3.10.1",
    "unpdf": "^2.1.0",
    "vite": "^8.3.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "autoprefixer": "^10.4.21",
    "esbuild": "^0.25.0",
    "tailwindcss": "^4.3.3",
    "tsx": "^4.21.0",
    "typescript": "^7.0.2",
    "@types/express": "^4.17.21"
  }
}
