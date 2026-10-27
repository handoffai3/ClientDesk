# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.16.1 create --template minimal --types ts --install npm ClientDesk
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## AI summaries

Summaries (messages, proofing feedback, project status) call any **OpenAI-compatible** chat-completions API, so you can use OpenAI, DeepSeek, Gemini's OpenAI-compatibility endpoint, or any gateway that speaks the same protocol. Set these in `.env`:

```sh
AI_BASE_URL=   # e.g. https://api.openai.com/v1 (the app calls {AI_BASE_URL}/chat/completions)
AI_API_KEY=
AI_MODEL=      # e.g. gpt-4o-mini, deepseek-chat
```

If any of the three is empty, the summarize endpoint returns `503 AI service not configured`. Each agency is limited to 10 summaries per hour (tracked in the `ai_usage` table; see `supabase/schema.sql`).

