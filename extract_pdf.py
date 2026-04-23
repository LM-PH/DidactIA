import os
import time
import json
import google.generativeai as genai

apikey = "AIzaSyBZhMRtuZ8l1Q3c-4ckg2otdshkAYbZQQQ"
genai.configure(api_key=apikey)

print("Subiendo el PDF a la memoria de Gemini...")
sample_file = genai.upload_file(path="Programa_Sintetico_Fase_6.pdf",
                            display_name="Plan Sintetico Completo Fase 6")

print(f"Archivo subido: '{sample_file.display_name}'. Iniciando lectura y extracción (esto puede demorar un par de minutos)...")

model = genai.GenerativeModel(model_name="gemini-2.5-flash")

prompt = """
Eres un asistente encargado de construir una base de datos estricta. El archivo que se te entregó es el Programa Sintético Fase 6 oficial de educación secundaria.
Busca todas las disciplinas y extrae TODOS y cada uno de los "Contenidos" y "Procesos de Desarrollo de Aprendizaje (PDA)". 

DEBES extraer absolutamente todas las disciplinas y de cada disciplina, TODOS los contenidos completos.
Devuelve tu repuesta ÚNICAMENTE como un objeto JSON válido con la siguiente estructura (no añadas explicaciones ni markdown "```json"):

{
    "Español": [
        {
            "Contenido": "Texto del contenido 1...",
            "PDAs": [
                "Texto PDA 1...",
                "Texto PDA 2..."
            ]
        }
    ],
    "Matemáticas": [
        {
            "Contenido": "Texto del contenido...",
            "PDAs": [
                "Texto PDA 1..."
            ]
        }
    ]
}
Asegúrate de procesar TODAS las materias. Formato JSON puro.
"""

response = model.generate_content([sample_file, prompt], request_options={"timeout": 600})

output = response.text.strip()
if output.startswith("```json"):
    output = output[7:-3].strip()
elif output.startswith("```"):
    output = output[3:-3].strip()

# Validamos que sea JSON válido
try:
    data = json.loads(output)
    print("¡JSON construido correctamente con " + str(len(data.keys())) + " asignaturas encontradas!")
except Exception as e:
    print("Error parseando el JSON devuelto:", e)

with open("extracted_data.json", "w", encoding="utf-8") as f:
    f.write(output)

print("Lectura completada y guardada en extracted_data.json")
