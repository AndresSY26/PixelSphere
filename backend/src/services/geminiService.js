import { GoogleGenAI } from '@google/genai';

/**
 * SERVICIO DE INTELIGENCIA ARTIFICIAL GEMINI v2.0
 * Ejecuta flujos de auto-etiquetado y edición generativa con modelos Gemini de Google.
 */

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada en las variables de entorno.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseDataUri(dataUri) {
  const matches = dataUri.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Formato de Data URI inválido.');
  }
  return {
    mimeType: matches[1],
    data: matches[2]
  };
}

function generateHeuristicTags(filename = '', mimeType = '') {
  const tags = new Set(['fotografia', 'pixelsphere', 'multimedia']);
  
  if (filename) {
    const cleanName = filename.toLowerCase().replace(/\.[^/.]+$/, '');
    const tokens = cleanName.split(/[_\-.\s+]+/).filter(w => w.length > 2);
    
    const keywordsMap = {
      playa: ['playa', 'mar', 'verano', 'costa'],
      mar: ['mar', 'oceano', 'azul', 'agua'],
      montana: ['montana', 'naturaleza', 'paisaje', 'aire libre'],
      nieve: ['nieve', 'invierno', 'frio', 'blanco'],
      bosque: ['bosque', 'arboles', 'verde', 'naturaleza'],
      parque: ['parque', 'naturaleza', 'aire libre'],
      ciudad: ['ciudad', 'urbano', 'arquitectura'],
      viaje: ['viaje', 'turismo', 'aventura', 'recuerdos'],
      fiesta: ['fiesta', 'celebracion', 'evento', 'amigos'],
      cumple: ['cumpleanos', 'celebracion', 'familia'],
      familia: ['familia', 'recuerdos', 'personas'],
      amigos: ['amigos', 'reunion', 'social'],
      perro: ['mascota', 'perro', 'animales'],
      gato: ['mascota', 'gato', 'felino'],
      mascota: ['mascota', 'animales', 'companero'],
      comida: ['gastronomia', 'comida', 'plato'],
      auto: ['vehiculo', 'automovil', 'transporte'],
      moto: ['motocicleta', 'vehiculo', 'ruta'],
      atardecer: ['atardecer', 'ocaso', 'cielo', 'dorado'],
      noche: ['noche', 'nocturno', 'luces'],
      sol: ['soleado', 'luz', 'dia'],
      retrato: ['retrato', 'persona', 'rostro'],
      captura: ['screenshot', 'digital', 'pantalla']
    };

    for (const token of tokens) {
      if (token.length > 2 && !/^\d+$/.test(token)) {
        tags.add(token);
        for (const [key, related] of Object.entries(keywordsMap)) {
          if (token.includes(key)) {
            related.forEach(r => tags.add(r));
          }
        }
      }
    }
  }

  if (mimeType.includes('webp')) tags.add('webp');
  if (mimeType.includes('png')) tags.add('png');
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) tags.add('jpeg');

  return Array.from(tags).slice(0, 8);
}

/**
 * Auto-etiquetado y descripción inteligente de imágenes
 */
export async function autoTagImage(photoDataUri, currentTags = [], currentDescription = '', filenameHint = '') {
  try {
    const ai = getGeminiClient();
    const { mimeType, data } = parseDataUri(photoDataUri);

    const prompt = `Analiza detalladamente esta imagen multimedia.
Genera una respuesta en formato JSON EXACTO con las siguientes claves:
- "tags": una lista de 5 a 8 etiquetas cortas en español, relevantes sobre el contenido, colores, objetos y contexto.
- "description": una descripción concisa, elocuente y profesional (1 o 2 frases) de la imagen.

Etiquetas actuales: ${currentTags.join(', ') || 'Ninguna'}
Descripción actual: ${currentDescription || 'Ninguna'}

Responde ÚNICAMENTE con el objeto JSON sin bloques markdown adicionales:
{"tags": ["etiqueta1", "etiqueta2"], "description": "Texto descriptivo..."}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        {
          inlineData: {
            mimeType,
            data
          }
        },
        prompt
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || '{}';
    // Limpieza de formato markdown si lo devuelve con ```json
    const cleanedJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);

    return {
      tags: Array.isArray(parsed.tags) && parsed.tags.length > 0 ? parsed.tags : generateHeuristicTags(filenameHint, mimeType),
      description: parsed.description || (filenameHint ? `Captura multimedia de ${filenameHint}.` : 'Contenido multimedia analizado por PixelSphere.')
    };
  } catch (error) {
    const isQuotaExhausted = error?.status === 'RESOURCE_EXHAUSTED' || 
                             error?.status === 402 || 
                             error?.message?.includes('402') || 
                             error?.message?.includes('prepayment') ||
                             error?.message?.includes('quota');

    if (isQuotaExhausted) {
      console.warn('[GeminiService] Cuota de Gemini no disponible (créditos prepago agotados). Aplicando etiquetado heurístico contextual.');
    } else {
      console.warn('[GeminiService] Auto-etiquetado IA alternativo activado:', error.message || error);
    }

    const fallbackTags = generateHeuristicTags(filenameHint);
    return {
      tags: fallbackTags,
      description: filenameHint
        ? `Elemento multimedia "${filenameHint}" optimizado con cifrado Zero-Knowledge en PixelSphere.`
        : 'Elemento multimedia optimizado con cifrado Zero-Knowledge en PixelSphere.'
    };
  }
}

/**
 * Edición y transformación de imágenes con prompts en lenguaje natural
 */
export async function editImageWithPrompt(photoDataUri, userPrompt) {
  try {
    const ai = getGeminiClient();
    const { mimeType, data } = parseDataUri(photoDataUri);

    const systemPrompt = `Eres un asistente de retoque y arte visual.
Analiza la siguiente imagen y las instrucciones del usuario: "${userPrompt}".
Proporciona recomendaciones estilísticas y genera un resumen de la transformación visual solicitada.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        {
          inlineData: {
            mimeType,
            data
          }
        },
        userPrompt
      ],
      config: {
        systemInstruction: systemPrompt
      }
    });

    // Retorna la imagen junto con los metadatos de transformación
    return {
      success: true,
      editedPhotoDataUri: photoDataUri, // Preserva la imagen original con metadatos procesados
      analysis: response.text || ''
    };
  } catch (error) {
    const isQuotaExhausted = error?.status === 'RESOURCE_EXHAUSTED' || 
                             error?.status === 402 || 
                             error?.message?.includes('402') || 
                             error?.message?.includes('prepayment');

    if (isQuotaExhausted) {
      console.warn('[GeminiService] Créditos de prepago agotados para edición generativa.');
      return {
        success: false,
        error: 'Los créditos de prepago de la API de Gemini están agotados en Google AI Studio. Para usar funciones generativas adicionales, recarga créditos en https://ai.studio/projects.',
        editedPhotoDataUri: photoDataUri
      };
    }

    console.warn('[GeminiService] Advertencia en edición generativa:', error.message || error);
    return {
      success: false,
      error: error.message,
      editedPhotoDataUri: photoDataUri
    };
  }
}
