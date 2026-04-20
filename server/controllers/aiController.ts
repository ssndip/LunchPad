import { Request, Response } from 'express';
import { settings } from '../config';

export const suggestRules = async (req: Request, res: Response) => {
  const { currentProfile, currentConfig, menuText } = req.body;
  const profile = currentProfile || currentConfig;
  const { aiApiKey, aiProvider } = settings;

  if (!aiApiKey) {
    return res.status(400).json({ error: "AI API Key not configured in settings." });
  }

  if (!profile || !menuText) {
    return res.status(400).json({ error: "Missing currentProfile/currentConfig or menuText." });
  }

  try {
    let result;
    if (aiProvider === 'openai') {
      result = await callOpenAI(aiApiKey, profile, menuText);
    } else if (aiProvider === 'gemini') {
      result = await callGemini(aiApiKey, profile, menuText);
    } else if (aiProvider === 'anthropic') {
      result = await callAnthropic(aiApiKey, profile, menuText);
    } else {
      return res.status(400).json({ error: "Unsupported AI provider." });
    }

    res.json(result);
  } catch (err: any) {
    console.error("[AI] Error generating rules:", err);
    res.status(500).json({ error: err.message || "Failed to generate rules from AI." });
  }
};

export const ocrImage = async (req: Request, res: Response) => {
  const { imageData } = req.body; // base64 string
  const { aiApiKey, aiProvider } = settings;

  if (!aiApiKey) {
    return res.status(400).json({ error: "AI API Key not configured in settings." });
  }

  if (!imageData) {
    return res.status(400).json({ error: "Missing image data." });
  }

  try {
    let text;
    if (aiProvider === 'openai') {
      text = await callOpenAIVision(aiApiKey, imageData);
    } else if (aiProvider === 'gemini') {
      text = await callGeminiVision(aiApiKey, imageData);
    } else if (aiProvider === 'anthropic') {
      text = await callAnthropicVision(aiApiKey, imageData);
    } else {
      return res.status(400).json({ error: "Unsupported AI provider for Vision." });
    }

    res.json({ text });
  } catch (err: any) {
    console.error("[AI] OCR Error:", err);
    res.status(500).json({ error: err.message || "Failed to OCR image." });
  }
};

async function getBestOpenAIModel(apiKey: string) {
  try {
    const resp = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await resp.json();
    if (!data.data) return 'gpt-4o';
    // Filter for gpt-4o or gpt-4 variants, prefer gpt-4o
    const models = data.data.map((m: any) => m.id);
    if (models.includes('gpt-4o')) return 'gpt-4o';
    if (models.includes('gpt-4o-mini')) return 'gpt-4o-mini';
    const anyGpt4 = models.find((m: string) => m.startsWith('gpt-4'));
    return anyGpt4 || 'gpt-4o';
  } catch {
    return 'gpt-4o';
  }
}

async function callOpenAI(apiKey: string, profile: any, menuText: string) {
  const prompt = constructPrompt(profile, menuText);
  const model = await getBestOpenAIModel(apiKey);
  console.log(`[OpenAI] Using model: ${model}`);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: 'You are a technical assistant specializing in regex-based text parsing. You only output valid JSON.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let error;
    try { error = JSON.parse(errorBody); } catch { error = { error: { message: errorBody } }; }
    throw new Error(`OpenAI Error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

async function callOpenAIVision(apiKey: string, base64Image: string) {
  const base64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  const model = await getBestOpenAIModel(apiKey);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            { text: `You are an OCR expert. Extract all text from this menu image. 

SPECIAL INSTRUCTIONS FOR WEEKLY MENUS:
- If the menu is a TABLE (e.g. Days as columns, Categories as rows), you MUST transcribe it into a vertical list grouped by day.
- Example format:
MONDAY
SOUPS
- Soup name 1.50€
MAINS
- Main name 3.00€

TUESDAY
SOUPS
...

- Maintain the structure as much as possible. 
- Support Cyrillic (Bulgarian). 
- If handwriting is present, transcribe it accurately. 
- Output ONLY the extracted text, no explanations.` },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64}` }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let error;
    try { error = JSON.parse(errorBody); } catch { error = { error: { message: errorBody } }; }
    throw new Error(`OpenAI Vision Error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export const listModels = async (req: Request, res: Response) => {
  const { aiApiKey } = settings;
  if (!aiApiKey) return res.status(400).json({ error: 'API Key is missing.' });

  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${aiApiKey}`);
    const data = await resp.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const testConnection = async (req: Request, res: Response) => {
  const { aiApiKey, aiProvider } = settings;
  if (!aiApiKey) return res.status(400).json({ error: 'API Key is missing.' });

  try {
    let result;
    if (aiProvider === 'openai') {
      const model = await getBestOpenAIModel(aiApiKey);
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: model, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 })
      });
      if (!resp.ok) throw new Error(await resp.text());
      result = `OpenAI Connected! (Model: ${model})`;
    } else if (aiProvider === 'gemini') {
      // DYNAMIC DISCOVERY: Fetch models first to see what's available for this key
      console.log(`[Gemini Discovery] Fetching models...`);
      const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${aiApiKey}`);
      const listData = await listResp.json();
      
      if (!listResp.ok) {
        throw new Error(`Gemini API Error: ${listData.error?.message || listResp.statusText}`);
      }

      if (!listData.models || listData.models.length === 0) {
        throw new Error('Gemini API returned no available models for this key.');
      }

      // Find first model that supports generateContent
      const bestModel = listData.models.find((m: any) => m.supportedGenerationMethods.includes('generateContent'));
      if (!bestModel) throw new Error('No models supporting generateContent found for this key.');

      console.log(`[Gemini Discovery] Selected: ${bestModel.name}`);

      const testResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/${bestModel.name}:generateContent?key=${aiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] })
      });
      
      if (!testResp.ok) throw new Error(await testResp.text());
      result = `Gemini Connected! (Auto-detected: ${bestModel.name.split('/').pop()})`;
    } else if (aiProvider === 'anthropic') {
      const model = await getBestAnthropicModel(aiApiKey);
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': aiApiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: model, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 })
      });
      if (!resp.ok) throw new Error(await resp.text());
      result = `Anthropic Connected! (Model: ${model})`;
    }
    res.json({ success: true, message: result });
  } catch (err: any) {
    console.error('[AI Test Error]', err.message);
    res.status(500).json({ error: err.message });
  }
};

async function getBestGeminiModel(apiKey: string) {
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await resp.json();
    if (!data.models) return 'models/gemini-1.5-flash';
    // Prefer 1.5 flash if available, otherwise first supported
    const flash = data.models.find((m: any) => m.name.includes('gemini-1.5-flash') && m.supportedGenerationMethods.includes('generateContent'));
    if (flash) return flash.name;
    const any = data.models.find((m: any) => m.supportedGenerationMethods.includes('generateContent'));
    return any ? any.name : 'models/gemini-1.5-flash';
  } catch {
    return 'models/gemini-1.5-flash';
  }
}

async function callGemini(apiKey: string, profile: any, menuText: string) {
  const prompt = constructPrompt(profile, menuText);
  const modelName = await getBestGeminiModel(apiKey);
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt + "\n\nIMPORTANT: Return ONLY a valid JSON object. No markdown, no prose." }]
      }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Gemini Error] Status: ${response.status}. Body: ${errorBody}`);
    let error;
    try { error = JSON.parse(errorBody); } catch { error = { error: { message: errorBody } }; }
    throw new Error(`Gemini Error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

async function callGeminiVision(apiKey: string, base64Image: string) {
  const base64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  const mimeType = base64Image.includes('data:') ? base64Image.split(';')[0].split(':')[1] : 'image/jpeg';
  const modelName = await getBestGeminiModel(apiKey);

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: `You are an OCR expert. Extract all text from this menu image. 

SPECIAL INSTRUCTIONS FOR WEEKLY MENUS:
- If the menu is a TABLE (e.g. Days as columns, Categories as rows), you MUST transcribe it into a vertical list grouped by day.
- Example format:
MONDAY
SOUPS
- Soup name 1.50€
MAINS
- Main name 3.00€

TUESDAY
SOUPS
...

- Maintain the structure as much as possible. 
- Support Cyrillic (Bulgarian). 
- If handwriting is present, transcribe it accurately. 
- Output ONLY the extracted text, no explanations.` },
          { inline_data: { mime_type: mimeType, data: base64 } }
        ]
      }]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Gemini Vision Error] Status: ${response.status}. Body: ${errorBody}`);
    let error;
    try { error = JSON.parse(errorBody); } catch { error = { error: { message: errorBody } }; }
    throw new Error(`Gemini Vision Error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    console.error("[Gemini Vision] Invalid response structure:", JSON.stringify(data));
    throw new Error("Gemini Vision returned an unexpected response structure.");
  }
  return data.candidates[0].content.parts[0].text;
}

async function getBestAnthropicModel(apiKey: string) {
  try {
    const resp = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });
    const data = await resp.json();
    if (!data.data) return 'claude-3-5-sonnet-20240620';
    
    const models = data.data.map((m: any) => m.id);
    // Prefer Sonnet 3.5, then regular Sonnet, then Haiku
    if (models.includes('claude-3-5-sonnet-20240620')) return 'claude-3-5-sonnet-20240620';
    const anySonnet = models.find((m: string) => m.includes('sonnet'));
    if (anySonnet) return anySonnet;
    const anyHaiku = models.find((m: string) => m.includes('haiku'));
    return anyHaiku || 'claude-3-5-sonnet-20240620';
  } catch {
    return 'claude-3-5-sonnet-20240620';
  }
}

async function callAnthropic(apiKey: string, profile: any, menuText: string) {
  const prompt = constructPrompt(profile, menuText);
  const model = await getBestAnthropicModel(apiKey);
  console.log(`[Anthropic] Using model: ${model}`);
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt + "\n\nIMPORTANT: Return ONLY a valid JSON object. No markdown, no prose." }]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let error;
    try { error = JSON.parse(errorBody); } catch { error = { error: { message: errorBody } }; }
    throw new Error(`Anthropic Error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const text = data.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Anthropic failed to return valid JSON");
  return JSON.parse(jsonMatch[0]);
}

async function callAnthropicVision(apiKey: string, base64Image: string) {
  const base64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  const mimeType = base64Image.includes('data:') ? base64Image.split(';')[0].split(':')[1] : 'image/jpeg';
  const model = await getBestAnthropicModel(apiKey);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `You are an OCR expert. Extract all text from this menu image. 

SPECIAL INSTRUCTIONS FOR WEEKLY MENUS:
- If the menu is a TABLE (e.g. Days as columns, Categories as rows), you MUST transcribe it into a vertical list grouped by day.
- Example format:
MONDAY
SOUPS
- Soup name 1.50€
MAINS
- Main name 3.00€

TUESDAY
SOUPS
...

- Maintain the structure as much as possible. 
- Support Cyrillic (Bulgarian). 
- If handwriting is present, transcribe it accurately. 
- Output ONLY the extracted text, no explanations.`,
            },
          ],
        },
      ],
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let error;
    try { error = JSON.parse(errorBody); } catch { error = { error: { message: errorBody } }; }
    throw new Error(`Anthropic Vision Error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

function constructPrompt(profile: any, menuText: string) {
  const systemCategories = profile?.systemCategories || [];
  const categoriesList = systemCategories.length > 0 ? `SYSTEM CATEGORIES (Prefer these for overrides):\n- ${systemCategories.join('\n- ')}` : '';

  return `
You are the AI configuration assistant for the LunchPad Canteen System.
Your task is to analyze a new menu format and suggest updates to the Parser Profile.

${categoriesList}

SUPPORT FOR WEEKLY MENUS:
- If the sample text contains multiple days (e.g., Monday, Tuesday, or dates like 21.04, 22.04), identify them.
- Suggest rules to ensure each day's items are grouped correctly.
- If days are headers, they should be treated as categories if appropriate.

Standard LunchPad Parsing Logic:
1. The parser looks for lines starting with '-' as menu items.
2. It expects prices in the format '1.23€' or '1,23 €'.
3. It detects categories from headers (lines without '-' that appear before a group of items).

CURRENT PROFILE (JSON):
${JSON.stringify(profile, null, 2)}

NEW MENU TEXT SAMPLE:
---
${menuText}
---

INSTRUCTIONS:
1. Analyze the sample menu text. Identify if any items or categories are failing to parse correctly.
2. CATEGORY MATCHING:
   - Carefully identify section headers in the text that represent food categories.
   - If a header doesn't match a standard name, suggest an 'itemCategoryOverrides' mapping to one of the SYSTEM CATEGORIES listed above.
   - Example: If you see "Varia" and it contains soups, suggest mapping those items to "Супи".
3. If bullets are missing from items, create regex rules in 'preprocessRules' to add them. 
4. If the menu is weekly, ensure days are identified as categories or headers.
5. Return a JSON object with the following structure (only include fields that need updates):
{
  "name": "Suggested Profile Name",
  "presets": [
    {
      "preprocessRules": [
        { "find": "regex_pattern", "replace": "replacement_string", "isRegex": true }
      ],
      "itemCategoryOverrides": { "Item Name": "Category Name" },
      "itemNameOverrides": { "Ugly Name": "Clean Name" }
    }
  ]
}

Only suggest necessary rules to make the sample menu parse correctly into items with prices. Support Bulgarian Cyrillic.
`;
}
