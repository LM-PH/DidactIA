// pedagogia.js - Base de datos completa de la NEM para DidactIA (Fase 6 - Secundaria - Todas las disciplinas)
const CONOCIMIENTO_NEM = {
    // CAMPO FORMATIVO: LENGUAJES
    "Español": {
        "PDAs": [
            "Expresa sensaciones, emociones, sentimientos e ideas sobre las personas y la comunidad de su entorno.",
            "Recupera información de diversas fuentes para elaborar textos de divulgación científica.",
            "Analiza las características del texto informativo y su función social.",
            "Crea textos literarios de distintos géneros sobre la importancia de la inclusión."
        ],
        "Ejes": ["Fomento a la Lectura", "Inclusión", "Interculturalidad Crítica"]
    },
    "Inglés": {
        "PDAs": [
            "Recupera estrategias auditivas y de lectura en inglés para comprender mensajes cotidianos.",
            "Lleva a cabo juegos de rol sobre situaciones de comunicación en lengua inglesa.",
            "Investiga y difunde en inglés información sobre manifestaciones culturales de México y el mundo.",
            "Emplea el idioma inglés para expresar ideas y opiniones sobre temas de interés general."
        ],
        "Ejes": ["Interculturalidad Crítica", "Inclusión"]
    },
    "Artes": {
        "PDAs": [
            "Explora elementos de los lenguajes artísticos para expresar rasgos de identidad personal y colectiva.",
            "Reinterpreta una manifestación artística y cultural de la comunidad mediante diversas técnicas.",
            "Usa los elementos de las artes en creaciones que promuevan la cultura de paz.",
            "Experimenta con formas, colores y sonidos para crear propuestas artísticas innovadoras."
        ],
        "Ejes": ["Artes y Experiencias Estéticas", "Pensamiento Crítico"]
    },

    // CAMPO FORMATIVO: SABERES Y PENSAMIENTO CIENTÍFICO
    "Matemáticas": {
        "PDAs": [
            "Resuelve problemas de proporcionalidad directa e inversa.",
            "Interpreta y comunica información mediante gráficas lineales y circulares.",
            "Extiende el significado de las operaciones con números enteros, fracciones y decimales.",
            "Resuelve ecuaciones lineales y sistemas de ecuaciones en contextos reales."
        ],
        "Ejes": ["Pensamiento Crítico", "Igualdad de Género"]
    },
    "Biología": {
        "PDAs": [
            "Explica la participación de los sistemas nervioso y endocrino en la coordinación de las funciones del cuerpo.",
            "Describe las características comunes de los seres vivos y su diversidad.",
            "Compara las causas de la pérdida de biodiversidad en el pasado y la actualidad.",
            "Analiza la importancia de los estilos de vida saludables en la prevención de enfermedades."
        ],
        "Ejes": ["Vida Saludable", "Pensamiento Crítico"]
    },
    "Física": {
        "PDAs": [
            "Indaga sobre los saberes externos y conocimientos científicos relacionados con la energía térmica.",
            "Describe las formas de producción de energía térmica y su aprovechamiento.",
            "Analiza las Leyes de Newton y su aplicación en actividades cotidianas.",
            "Interpreta la temperatura y el equilibrio térmico con base en el modelo de partículas."
        ],
        "Ejes": ["Pensamiento Crítico", "Inclusión"]
    },
    "Química": {
        "PDAs": [
            "Analiza la concentración de sustancias de una mezcla en productos de uso cotidiano.",
            "Explica las propiedades de las sustancias y su relación con el enlace químico.",
            "Interpreta la tabla periódica y su importancia en la ciencia y tecnología.",
            "Describe las reacciones químicas y su aplicación en la industria y el ambiente."
        ],
        "Ejes": ["Pensamiento Crítico", "Vida Saludable"]
    },

    // CAMPO FORMATIVO: ÉTICA, NATURALEZA Y SOCIEDADES
    "Geografía": {
        "PDAs": [
            "Comprende las relaciones entre la sociedad y la naturaleza en su localidad y el mundo.",
            "Analiza la distribución de las aguas continentales y oceánicas en la Tierra.",
            "Identifica las causas y consecuencias de los riesgos de desastre naturales y sociales.",
            "Examina el impacto de la globalización en la diversidad cultural."
        ],
        "Ejes": ["Interculturalidad Crítica", "Pensamiento Crítico"]
    },
    "Historia": {
        "PDAs": [
            "Explora la vida cotidiana de los pueblos antiguos de México y el mundo.",
            "Indaga sobre las causas y consecuencias de las invasiones extranjeras en México.",
            "Busca y analiza fuentes de información sobre la participación de las mujeres en la historia.",
            "Reflexiona sobre la construcción de la identidad nacional a través del tiempo."
        ],
        "Ejes": ["Interculturalidad Crítica", "Igualdad de Género"]
    },
    "Formación Cívica y Ética": {
        "PDAs": [
            "Promueve una cultura de paz y respeto a los derechos humanos en su comunidad.",
            "Valora la diversidad de grupos e identidades que integran la sociedad mexicana.",
            "Analiza las funciones de las leyes y las normas en la organización social.",
            "Propone acciones de participación ciudadana para mejorar su entorno escolar."
        ],
        "Ejes": ["Inclusión", "Interculturalidad Crítica", "Igualdad de Género"]
    },

    // CAMPO FORMATIVO: DE LO HUMANO Y LO COMUNITARIO
    "Tecnología": {
        "PDAs": [
            "Explora herramientas, máquinas e instrumentos como extensión corporal.",
            "Analiza los materiales y procesos técnicos para favorecer la sustentabilidad.",
            "Identifica los usos e implicaciones de la energía en los procesos técnicos.",
            "Diseña proyectos tecnológicos para resolver problemas de su comunidad."
        ],
        "Ejes": ["Pensamiento Crítico", "Vida Saludable"]
    },
    "Educación Física": {
        "PDAs": [
            "Pone a prueba sus capacidades, habilidades y destrezas motrices en diversas situaciones.",
            "Promueve estilos de vida activos y saludables a través de la actividad física.",
            "Valora el juego como una vía para la convivencia y el desarrollo social.",
            "Organiza torneos o eventos deportivos que fomenten la inclusión y el trabajo en equipo."
        ],
        "Ejes": ["Vida Saludable", "Inclusión"]
    },
    "Tutoría": {
        "PDAs": [
            "Reconoce sus potencialidades y fortalezas para construir su proyecto de vida.",
            "Desarrolla habilidades socioemocionales para el manejo de conflictos y la empatía.",
            "Analiza factores de riesgo y promueve la prevención de adicciones.",
            "Valora la importancia de la educación integral de la sexualidad en la adolescencia."
        ],
        "Ejes": ["Igualdad de Género", "Vida Saludable", "Inclusión"]
    },
    "Educación Socioemocional": {
        "PDAs": [
            "Identifica y regula sus emociones para mejorar el bienestar personal y colectivo.",
            "Practica la comunicación asertiva y la escucha activa en sus relaciones.",
            "Fortalece su autoestima y confianza ante retos cotidianos.",
            "Colabora activamente en proyectos de impacto social positivo."
        ],
        "Ejes": ["Vida Saludable", "Igualdad de Género"]
    }
};

const DESCRIPCIONES_EJES = {
    "Inclusión": "Reconocimiento de la diversidad como valor, eliminando barreras para el aprendizaje y participación.",
    "Pensamiento Crítico": "Capacidad de analizar, cuestionar y evaluar la realidad para construir juicios propios.",
    "Interculturalidad Crítica": "Diálogo de saberes entre diversas culturas basado en el respeto y la igualdad.",
    "Igualdad de Género": "Erradicación de estereotipos y fomento de la autonomía y respeto mutuo.",
    "Vida Saludable": "Integración de salud física, mental y social en relación con el medio ambiente.",
    "Apropiación de las culturas a través de la lectura y la escritura": "Uso de la lectura y escritura para el desarrollo de la identidad y el lenguaje.",
    "Artes y experiencias estéticas": "Valoración de la expresión artística para desarrollar sensibilidad y creatividad."
};

function obtenerContextoPorAsignatura(asignatura) {
    if (!asignatura) return null;
    const lowerAsignatura = asignatura.toLowerCase();
    
    // Mapeo de términos para mejorar la búsqueda
    const mapeo = {
        "formacion": "Formación Cívica y Ética",
        "civica": "Formación Cívica y Ética",
        "socioemocional": "Educación Socioemocional",
        "tutoria": "Tutoría",
        "fisica": "Física",
        "quimica": "Química",
        "biologia": "Biología",
        "español": "Español",
        "ingles": "Inglés",
        "artes": "Artes",
        "geografia": "Geografía",
        "historia": "Historia",
        "matematicas": "Matemáticas",
        "tecnologia": "Tecnología",
        "educacion fisica": "Educación Física"
    };

    for (let clave in mapeo) {
        if (lowerAsignatura.includes(clave)) {
            return CONOCIMIENTO_NEM[mapeo[clave]];
        }
    }
    
    for (let materia in CONOCIMIENTO_NEM) {
        if (lowerAsignatura.includes(materia.toLowerCase())) {
            return CONOCIMIENTO_NEM[materia];
        }
    }
    return null;
}

export { CONOCIMIENTO_NEM, DESCRIPCIONES_EJES, obtenerContextoPorAsignatura };
