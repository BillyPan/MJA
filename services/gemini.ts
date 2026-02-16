
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getInstructorDialogue = async (instructorName: string, event: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `你現在是經典街機遊戲《麻雀學園》中的一位老師：${instructorName}。
      當發生以下事件時，請說一句具有角色特色且符合90年代街機風格的簡短台詞（繁體中文）：
      事件：${event}
      限制：15字以內。`,
      config: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
      }
    });
    return response.text || "加油喔，同學！";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "看招！";
  }
};
