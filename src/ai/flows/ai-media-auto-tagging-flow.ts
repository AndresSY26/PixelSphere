'use server';
/**
 * @fileOverview An AI agent for automatically tagging and describing images.
 *
 * - aiMediaAutoTagging - A function that handles the AI media auto-tagging process.
 * - AiMediaAutoTaggingInput - The input type for the aiMediaAutoTagging function.
 * - AiMediaAutoTaggingOutput - The return type for the aiMediaAutoTagging function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiMediaAutoTaggingInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A photo as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    )
});
export type AiMediaAutoTaggingInput = z.infer<typeof AiMediaAutoTaggingInputSchema>;

const AiMediaAutoTaggingOutputSchema = z.object({
  tags: z
    .array(z.string())
    .describe(
      'A list of relevant tags for the image, each tag should be a single word or short phrase.'
    ),
  description: z.string().describe('A concise, brief sentence describing the image.')
});
export type AiMediaAutoTaggingOutput = z.infer<typeof AiMediaAutoTaggingOutputSchema>;

export async function aiMediaAutoTagging(
  input: AiMediaAutoTaggingInput
): Promise<AiMediaAutoTaggingOutput> {
  return aiMediaAutoTaggingFlow(input);
}

const aiMediaAutoTaggingPrompt = ai.definePrompt({
  name: 'aiMediaAutoTaggingPrompt',
  input: {schema: AiMediaAutoTaggingInputSchema},
  output: {schema: AiMediaAutoTaggingOutputSchema},
  prompt: `You are an expert image analysis AI. Your task is to analyze the provided image and generate a list of relevant tags and a concise description. The tags should be comma-separated and highly descriptive. The description should be a single, brief sentence.

Image: {{media url=imageDataUri}}`
});

const aiMediaAutoTaggingFlow = ai.defineFlow(
  {
    name: 'aiMediaAutoTaggingFlow',
    inputSchema: AiMediaAutoTaggingInputSchema,
    outputSchema: AiMediaAutoTaggingOutputSchema
  },
  async input => {
    const {output} = await aiMediaAutoTaggingPrompt(input);
    return output!;
  }
);
