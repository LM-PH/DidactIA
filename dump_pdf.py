import sys
from pypdf import PdfReader

try:
    print("Reading PDF...")
    reader = PdfReader("Programa_Sintetico_Fase_6.pdf")
    text = ""
    for i, page in enumerate(reader.pages):
        text += page.extract_text() + "\n\n"
    
    with open("programa_sintetico.txt", "w", encoding="utf-8") as f:
        f.write(text)
    print("Success: Written to programa_sintetico.txt")
except Exception as e:
    print(f"Error: {e}")
