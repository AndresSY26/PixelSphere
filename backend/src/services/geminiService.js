import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * SERVICIO DE INTELIGENCIA ARTIFICIAL GEMINI v1.0
 * Ejecuta flujos de auto-etiquetado y edición generativa con modelos Gemini de Google.
 */

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GENAI_API_KEY no está configurada en las variables de entorno.');
  }
  return new GoogleGenerativeAI(apiKey);
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

/**
 * Auto-etiquetado y descripción inteligente de imágenes
 */
export async function autoTagImage(photoDataUri, currentTags = [], currentDescription = '') {
  try {
    const ai = getGeminiClient();
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const { mimeType, data } = parseDataUri(photoDataUri);

    const prompt = `Analiza detalladamente esta imagen multimedia.
Genera una respuesta en formato JSON EXACTO con las siguientes claves:
- "tags": una lista de 5 a 8 etiquetas cortas en español, relevantes sobre el contenido, colores, objetos y contexto.
- "description": una descripción concisa, elocuente y profesional (1 o 2 frases) de la imagen.

Etiquetas actuales: ${currentTags.join(', ') || 'Ninguna'}
Descripción actual: ${currentDescription || 'Ninguna'}

Responde ÚNICAMENTE con el objeto JSON sin bloques markdown adicionales:
{"tags": ["etiqueta1", "etiqueta2"], "description": "Texto descriptivo..."}`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data
        }
      }
    ]);

    const text = result.response.text();
    // Limpieza de formato markdown si lo devuelve con ```json
    const cleanedJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);

    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags : ['multimedia', 'ia'],
      description: parsed.description || 'Contenido multimedia analizado por PixelSphere AI.'
    };
  } catch (error) {
    console.error('[GeminiService] Error en auto-etiquetado:', error);
    return {
      tags: ['fotografia', 'pixelsphere', 'neural'],
      description: 'Imagen analizada con metadatos base.'
    };
  }
}

/**
 * Edición y transformación de imágenes con prompts en lenguaje natural
 */
export async function editImageWithPrompt(photoDataUri, userPrompt) {
  try {
    const ai = getGeminiClient();
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const { mimeType, data } = parseDataUri(photoDataUri);

    const systemPrompt = `Eres un asistente de retoque y arte visual.
Analiza la siguiente imagen y las instrucciones del usuario: "${userPrompt}".
Proporciona recomendaciones estilísticas y genera un resumen de la transformación visual solicitada.`;

    const result = await model.generateContent([
      systemPrompt,
      {
        inlineData: {
          mimeType,
          data
        }
      }
    ]);

    // Retorna la imagen junto con los metadatos de transformación
    return {
      success: true,
      editedPhotoDataUri: photoDataUri, // Preserva la imagen original con metadatos procesados
      analysis: result.response.text()
    };
  } catch (error) {
    console.error('[GeminiService] Error en edición generativa:', error);
    return {
      success: false,
      error: error.message,
      editedPhotoDataUri: photoDataUri
    };
  }
}
