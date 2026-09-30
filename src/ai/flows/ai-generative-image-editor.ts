'use server';
/**
 * @fileOverview An AI agent for generative image editing based on natural language prompts.
 *
 * - aiGenerativeImageEditor - A function that handles the generative image editing process.
 * - AiGenerativeImageEditorInput - The input type for the aiGenerativeImageEditor function.
 * - AiGenerativeImageEditorOutput - The return type for the aiGenerativeImageEditor function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiGenerativeImageEditorInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to be edited, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  prompt: z.string().describe('The natural language instruction for image editing.'),
});
export type AiGenerativeImageEditorInput = z.infer<typeof AiGenerativeImageEditorInputSchema>;

const AiGenerativeImageEditorOutputSchema = z.object({
  editedPhotoDataUri: z
    .string()
    .describe(
      "The edited photo, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AiGenerativeImageEditorOutput = z.infer<typeof AiGenerativeImageEditorOutputSchema>;

export async function aiGenerativeImageEditor(
  input: AiGenerativeImageEditorInput
): Promise<AiGenerativeImageEditorOutput> {
  return aiGenerativeImageEditorFlow(input);
}

const editImagePrompt = ai.definePrompt({
  name: 'editImagePrompt',
  input: {schema: AiGenerativeImageEditorInputSchema},
  output: {schema: AiGenerativeImageEditorOutputSchema},
  prompt: [
    {media: {url: '{{{photoDataUri}}}'}},
    {text: 'Edit the provided image according to the following instruction: {{{prompt}}}. Provide the edited image.'},
  ],
  model: 'googleai/gemini-2.5-flash-image',
  config: {
    responseModalities: ['TEXT', 'IMAGE'],
  },
});

const aiGenerativeImageEditorFlow = ai.defineFlow(
  {
    name: 'aiGenerativeImageEditorFlow',
    inputSchema: AiGenerativeImageEditorInputSchema,
    outputSchema: AiGenerativeImageEditorOutputSchema,
  },
  async input => {
    const response = await editImagePrompt(input);
    const photoUri = response.output?.editedPhotoDataUri || (response.output as any)?.media?.url;
    if (!photoUri) {
      throw new Error('No edited image was returned by the AI.');
    }
    return {editedPhotoDataUri: photoUri};
  }
);
