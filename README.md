# Frontend Preview (Bootstrap 5)

This folder contains a lightweight Bootstrap 5 single-page app that talks directly to the FormBuilder Copilot API exposed by the backend (see `../API`). It mirrors the experience described in `FormBuilderContext.xml`:

- **AI Chat pane** (left, ~30% width) – send instructions to `/api/chat`, inspect executed tools, and keep a running backlog of the conversation.
- **Preview pane** (right, ~70% width) – pulls `/api/forms/{tenantId}/{formId}/preview` so the rendered page is always driven by the latest server-persisted HTML.
- Renders raw **Bootstrap 5.3.3** HTML returned by the backend.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Layout skeleton, includes Bootstrap, and defines the chat + preview panes. |
| `styles.css` | Custom theming and utility classes for the panes, chat log, and preview renderer. |
| `app.js` | All client logic: API client, chat workflow, and preview rendering pipeline. |

## Running the UI

Any static file server will work. Example using the `serve` CLI (install globally if needed):

```bash
cd FrontEnd
npx serve -l 4173
```

Open the printed URL (e.g., `http://localhost:4173`) in a browser, point the **API Base URL** to wherever `FormBuilder.Api` is running (`http://localhost:5000` by default), and either:

1. Create a form by providing a tenant + form name, or
2. Enter an existing tenant/form pair and click **Load preview**.

Once a preview loads, start chatting with the copilot. After every successful `/api/chat` call the UI refreshes the preview so it always reflects the persisted HTML.

## Notes

- Validation messages returned by `/preview` appear beside the preview.
- Executed tool calls from the chat endpoint are surfaced inline so you can see exactly how the backend satisfied each request.
