
import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Applies a given style to an image using the Gemini API.
 * @param base64Image The base64 encoded string of the source image.
 * @param mimeType The MIME type of the source image (e.g., 'image/jpeg').
 * @param stylePrompt The text prompt describing the style to apply.
 * @returns A promise that resolves to the base64 encoded string of the generated image.
 */
export async function applyStyleToImage(
  base64Image: string,
  mimeType: string,
  stylePrompt: string
): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: stylePrompt,
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    // Find the image part in the response
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    
    // Check for text response if no image is found, it might contain an error or explanation
    const textResponse = response.text?.trim();
    if (textResponse) {
        throw new Error(`The model returned a text response instead of an image: "${textResponse}"`);
    }

    throw new Error('No image was generated. The model may not have been able to apply the style.');
  } catch (error) {
    console.error("Error applying style with Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate image: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the image.");
  }
}
