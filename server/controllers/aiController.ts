import { Request, Response } from 'express';
import { settings } from '../config';

export const suggestRules = async (req: Request, res: Response) => {
  const { currentProfile, menuText } = req.body;
  const { aiApiKey, aiProvider } = settings;

  if (!aiApiKey) {
    return res.status(400).json({ error: "AI API Key not configured in settings." });
  }

  if (!currentProfile || !menuText) {
    return res.status(400).json({ error: "Missing currentProfile or menuText." });
  }

  try {
    let result;
    if (aiProvider === 'openai') {
      result = await callOpenAI(aiApiKey, currentProfile, menuText);
    } else if (aiProvider === 'gemini') {
      result = await callGemini(aiApiKey, currentProfile, menuText);
    } else if (aiProvider === 'anthropic') {
      result = await callAnthropic(aiApiKey, currentProfile, menuText);
    } else {
      return res.status(400).json({ error: "Unsupported AI provider." });
    }

    res.json(result);
  } catch (err: any) {
    console.error("[AI] Error generating rules:", err);
    res.status(500).json({ error: err.message || "Failed to generate rules from AI." });
  }
};

async function callOpenAI(apiKey: string, profile: any, menuText: string) {
  const prompt = constructPrompt(profile, menuText);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a technical assistant specializing in regex-based text parsing. You only output valid JSON.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI Error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

async function callGemini(apiKey: string, profile: any, menuText: string) {
  const prompt = constructPrompt(profile, menuText);
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
    const error = await response.json();
    throw new Error(`Gemini Error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

async function callAnthropic(apiKey: string, profile: any, menuText: string) {
  const prompt = constructPrompt(profile, menuText);
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt + "\n\nIMPORTANT: Return ONLY a valid JSON object. No markdown, no prose." }]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Anthropic Error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  // Anthropic doesn't have a json mode in the same way, so we might need to strip markdown
  const text = data.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Anthropic failed to return valid JSON");
  return JSON.parse(jsonMatch[0]);
}

function constructPrompt(profile: any, menuText: string) {
  return `
You are the AI configuration assistant for the LunchPad Canteen System.
Your task is to analyze a new menu format and suggest updates to the Parser Profile.

Standard LunchPad Parsing Logic:
1. The parser looks for lines starting with '-' as menu items.
2. It expects prices in the format '1.23€' or '1,23 €'.
3. It detects categories from headers.

CURRENT PROFILE (JSON):
${JSON.stringify(profile, null, 2)}

NEW MENU TEXT SAMPLE:
---
${menuText}
---

INSTRUCTIONS:
1. Analyze the sample menu text. Identify if any items are failing to parse because of missing bullets or unusual formatting.
2. If bullets are missing, create regex rules in 'preprocessRules' to add them. 
3. If categories are being misdetected, add 'itemCategoryOverrides'.
4. If item names contain noise that should be removed, add 'preprocessRules'.
5. Return a JSON object with the following structure (only include fields that need updates):
{
  "name": "Suggested Profile Name",
  "presets": [
    {
      "preprocessRules": [
        { "find": "regex_pattern", "replace": "replacement_string", "isRegex": true }
      ],
      "itemCategoryOverrides": { "Item Name": "Correct Category" },
      "itemNameOverrides": { "Ugly Name": "Clean Name" }
    }
  ]
}

Only suggest necessary rules to make the sample menu parse correctly into items with prices.
`;
}
