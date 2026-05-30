import { Request, Response } from 'express';
import { settings } from '../config';

export const suggestRules = async (req: Request, res: Response) => {
  console.log("[AI] Request Body:", JSON.stringify(req.body, null, 2));
  const { currentProfile, currentConfig, menuText, instructions, currentResult } = req.body;
  const profile = currentProfile || currentConfig;
  const { aiApiKey, aiProvider } = settings;

  if (!aiApiKey && aiProvider !== 'ollama') {
    return res.status(400).json({ error: "AI API Key not configured in settings." });
  }

  if (!profile || !menuText) {
    console.error("[AI] Validation Failed. Profile:", !!profile, "menuText:", !!menuText);
    return res.status(400).json({ error: "Missing currentProfile/currentConfig or menuText." });
  }

  try {
    let result;
    if (aiProvider === 'openai') {
      result = await callOpenAI(aiApiKey, profile, menuText, instructions, currentResult);
    } else if (aiProvider === 'gemini') {
      result = await callGemini(aiApiKey, profile, menuText, instructions, currentResult);
    } else if (aiProvider === 'anthropic') {
      result = await callAnthropic(aiApiKey, profile, menuText, instructions, currentResult);
    } else if (aiProvider === 'ollama') {
      result = await callOllama(profile, menuText, instructions, currentResult);
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

  if (!aiApiKey && aiProvider !== 'ollama') {
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
    } else if (aiProvider === 'ollama') {
      text = await callOllamaVision(imageData);
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

async function callOpenAI(apiKey: string, profile: any, menuText: string, instructions?: string, currentResult?: any) {
  const prompt = constructPrompt(profile, menuText, instructions, currentResult);
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
  if (!aiApiKey && aiProvider !== 'ollama') return res.status(400).json({ error: 'API Key is missing.' });

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
    } else if (aiProvider === 'ollama') {
      const endpoint = settings.aiEndpoint || 'http://localhost:11434';
      const model = settings.aiModel || 'llama3';
      const resp = await fetch(`${endpoint.replace(/\/$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model, prompt: 'Hello', max_tokens: 5, stream: false })
      });
      if (!resp.ok) throw new Error(await resp.text());
      result = `Ollama Connected! (Model: ${model})`;
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

async function callGemini(apiKey: string, profile: any, menuText: string, instructions?: string, currentResult?: any) {
  const prompt = constructPrompt(profile, menuText, instructions, currentResult);
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

async function callAnthropic(apiKey: string, profile: any, menuText: string, instructions?: string, currentResult?: any) {
  const prompt = constructPrompt(profile, menuText, instructions, currentResult);
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

function constructPrompt(profile: any, menuText: string, instructions?: string, currentResult?: any) {
  const systemCategories = profile?.systemCategories || [];
  const categoriesList = systemCategories.length > 0 ? `SYSTEM CATEGORIES (Prefer these for overrides):\n- ${systemCategories.join('\n- ')}` : '';

  const teachingSection = instructions ? `
USER TEACHING / INSTRUCTIONS:
---
${instructions}
---
` : '';

  const currentResultSection = currentResult ? `
CURRENT PARSE RESULT (What the parser currently sees):
---
${JSON.stringify(currentResult, null, 2)}
---
` : '';

  return `
You are the AI configuration assistant for the LunchPad Canteen System.
Your task is to analyze a menu format and suggest updates to the Parser Configuration.

${categoriesList}

${teachingSection}

${currentResultSection}

Standard LunchPad Parsing Logic (NATIVE CAPABILITIES):
1. Items: The parser natively recognizes lines starting with dashes (-), asterisks (*), bullets (•), or numbering (1., 2.).
2. Prices: It extracts Euro (€/e.), BGN (лв./лева), and dash-prices (e.g. "-1.70" at end of line).
3. Categories: Lines with a colon (:) or text without prices are natively treated as categories.
4. Inheritance: If a category header has a price (e.g. "Salads: 1.50€"), all items inside will inherit 1.50€ automatically.
5. Weight: Weight (гр/мл) is extracted as metadata and removed from the item name.

YOUR GOAL:
Generate \`preprocessRules\` (Regex find/replace) ONLY for structural issues the native parser cannot handle. 
DO NOT suggest rules for things mentioned in NATIVE CAPABILITIES unless the user explicitly asks for a change in that behavior.

Common Needs for Preprocess Rules:
1. Merging multi-line items into a single line.
2. Removing complex noise, decorative footers, or non-menu text.
3. Converting extremely weird item prefixes (e.g. "-->") to standard dashes ("- ").
4. Handling menus where categories are completely missing and need to be injected.

CURRENT CONFIG (JSON):
${JSON.stringify(profile, null, 2)}

MENU TEXT TO PARSE:
---
${menuText}
---

TASK:
1. Compare the MENU TEXT with the CURRENT PARSE RESULT.
2. Apply the USER TEACHING instructions.
3. Write \`preprocessRules\` to fix structural issues (like missing dashes or noise).
4. Return a JSON object with the following structure:
{
  "profileName": "A descriptive name for this parser snapshot",
  "categorySettings": {
    "mains": { "autoBox": true, "hasSideDish": true }
  },
  "suggestedConfig": {
    "sectionRules": [...],
    "preprocessing": [...],
    "entityPatterns": [...],
    "enrichment": [...]
  },
  "preset": {
    "name": "Format Rules",
    "preprocessRules": [
       { "find": "regex", "replace": "text", "isRegex": true }
    ],
    "itemCategoryOverrides": { "Item Name": "System Category" },
    "itemNameOverrides": { "Old Name": "New Name" }
  }
}

Only suggest necessary rules. Support Bulgarian Cyrillic.
`;
}

async function callOllama(profile: any, menuText: string, instructions?: string, currentResult?: any) {
  const prompt = constructPrompt(profile, menuText, instructions, currentResult);
  const endpoint = settings.aiEndpoint || 'http://localhost:11434';
  const model = settings.aiModel || 'llama3';
  
  console.log(`[Ollama] Connecting to: ${endpoint}/api/generate using model: ${model}`);
  
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      prompt: prompt + "\n\nIMPORTANT: Return ONLY a valid JSON object. No markdown, no prose.",
      format: 'json',
      stream: false
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Ollama Error: Status ${response.status}. ${errorBody}`);
  }

  const data = await response.json();
  const text = data.response;
  return JSON.parse(text);
}

async function callOllamaVision(base64Image: string) {
  const base64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  const endpoint = settings.aiEndpoint || 'http://localhost:11434';
  const model = settings.aiModel || 'llava';

  console.log(`[Ollama Vision] Connecting to: ${endpoint}/api/generate using model: ${model}`);

  const response = await fetch(`${endpoint.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      prompt: `You are an OCR expert. Extract all text from this menu image. 

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
      images: [base64],
      stream: false
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Ollama Vision Error: Status ${response.status}. ${errorBody}`);
  }

  const data = await response.json();
  return data.response;
}
