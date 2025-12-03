import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, GeminiAnalysisResponse } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- EXISTING ANALYSIS FUNCTION ---
export const analyzeChainData = async (transactions: Transaction[], context: 'native' | 'erc20'): Promise<GeminiAnalysisResponse> => {
  
  // Optimize payload size
  const minimalData = transactions.slice(0, 50).map(tx => ({
    t: tx.timestamp,
    f: tx.from.substring(0, 6),
    to: tx.to.substring(0, 6),
    v: tx.value,
    sym: tx.token,
    type: tx.type
  }));

  const contextPrompt = context === 'erc20' 
    ? "Focus on token accumulation patterns, dump risks, and high-frequency token swapping behavior."
    : "Focus on large value ETH transfers, gas usage patterns, and exchange deposits/withdrawals.";

  const prompt = `
    Analyze this blockchain transaction dataset (subset provided).
    Context: ${contextPrompt}
    
    Identify key actors based on volume and frequency.
    Return a JSON object with:
    1. "insights": Array of objects for key addresses with:
       - "address": string (reconstruct full address format if truncated or use 'Aggregated')
       - "tags": Array of strings (e.g., "Whale", "Sniper Bot", "Paper Hands", "Accumulator", "Exchange")
       - "riskScore": number (0-100)
       - "behaviorSummary": string (Short snappy description)
    2. "globalTrend": string (Overall market sentiment derived from this flow)
    
    Data: ${JSON.stringify(minimalData)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  address: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  riskScore: { type: Type.NUMBER },
                  behaviorSummary: { type: Type.STRING },
                }
              }
            },
            globalTrend: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text) as GeminiAnalysisResponse;

  } catch (error: any) {
    console.error("Gemini Analysis Failed:", error);
    return {
      insights: [
        {
          address: "0xNetwork_Error",
          tags: ["Error"],
          riskScore: 0,
          behaviorSummary: "Could not complete AI analysis. Please check API Key."
        }
      ],
      globalTrend: "Data unavailable"
    };
  }
};

// --- UPDATED CSV NORMALIZATION FUNCTION ---
export interface CsvMapping {
  fromIndex: number;
  toIndex: number;
  valueIndex: number;
  tokenIndex: number;
  timestampIndex: number;
  hashIndex: number;
  methodIndex: number;
  blockIndex: number;
  feeIndex: number;
  hasHeader: boolean;
  detectedType: 'native' | 'erc20' | 'mixed';
  confidenceReason: string;
}

export const normalizeCsvData = async (csvSnippet: string, userHint: 'native' | 'erc20' | 'mixed'): Promise<CsvMapping> => {
  const prompt = `
    Analyze this CSV snippet (first 5 lines) of blockchain data.
    User Hint: The user believes this data is related to "${userHint}".
    
    Task: Identify the column indices (0-based) for standard blockchain fields.
    If a column is missing, use -1.
    
    Required Fields:
    - fromIndex (Sender address)
    - toIndex (Receiver address)
    - valueIndex (Amount/Quantity)
    - tokenIndex (Token Symbol/Contract, e.g., USDT, ETH. If native chain data without token col, use -1)
    - timestampIndex (Date/Time)
    - hashIndex (Transaction Hash/ID)
    - methodIndex (Function name, e.g., Transfer, Swap. If missing, -1)
    - blockIndex (Block number)
    - feeIndex (Gas Fee/Txn Fee)
    - hasHeader (boolean, true if first row looks like headers)
    - detectedType (Enum: 'native', 'erc20', 'mixed') based on columns present (e.g., if Token Symbol exists, likely erc20 or mixed).
    - confidenceReason (string, brief explanation of why you mapped it this way)

    CSV Snippet:
    ${csvSnippet}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fromIndex: { type: Type.INTEGER },
            toIndex: { type: Type.INTEGER },
            valueIndex: { type: Type.INTEGER },
            tokenIndex: { type: Type.INTEGER },
            timestampIndex: { type: Type.INTEGER },
            hashIndex: { type: Type.INTEGER },
            methodIndex: { type: Type.INTEGER },
            blockIndex: { type: Type.INTEGER },
            feeIndex: { type: Type.INTEGER },
            hasHeader: { type: Type.BOOLEAN },
            detectedType: { type: Type.STRING, enum: ['native', 'erc20', 'mixed'] },
            confidenceReason: { type: Type.STRING },
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text) as CsvMapping;
  } catch (error) {
    console.error("CSV Normalization Failed", error);
    // Fallback default
    return {
      fromIndex: -1, toIndex: -1, valueIndex: -1, tokenIndex: -1, 
      timestampIndex: -1, hashIndex: -1, methodIndex: -1, blockIndex: -1, feeIndex: -1,
      hasHeader: true, detectedType: 'native', confidenceReason: 'AI Analysis Failed'
    };
  }
};