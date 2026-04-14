<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/61a72980-c6fe-4e26-ab18-dcb8518c1b9e

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## 🤖 AI-Assisted Development

This project uses **@deepseek** as the local MCP bridge for AI-assisted coding. To iterate on this project:
- Utilize the `deepseek` MCP server for code generation and refactoring.
- Refer to [summary.md](docs/summary.md) for a comprehensive technical overview and context for AI models.
