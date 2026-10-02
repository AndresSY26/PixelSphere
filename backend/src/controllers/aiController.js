import { autoTagImage, editImageWithPrompt } from '../services/geminiService.js';

export async function handleAutoTag(req, res) {
  try {
    const { photoDataUri, currentTags, currentDescription } = req.body;
    if (!photoDataUri) {
      return res.status(400).json({ error: 'photoDataUri es requerido.' });
    }

    const result = await autoTagImage(photoDataUri, currentTags, currentDescription);
    return res.json(result);
  } catch (error) {
    console.error('[AIController] Error en auto-tagging:', error);
    return res.status(500).json({ error: 'Error en procesamiento IA.', details: error.message });
  }
}

export async function handleGenerativeEdit(req, res) {
  try {
    const { photoDataUri, prompt } = req.body;
    if (!photoDataUri || !prompt) {
      return res.status(400).json({ error: 'photoDataUri y prompt son requeridos.' });
    }

    const result = await editImageWithPrompt(photoDataUri, prompt);
    return res.json(result);
  } catch (error) {
    console.error('[AIController] Error en generative edit:', error);
    return res.status(500).json({ error: 'Error en edición generativa.', details: error.message });
  }
}
