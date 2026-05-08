# Project Instructions

These instructions apply to all agent work in this repository.

- Do not start a dev server unless the user explicitly asks for one.
- Do not preserve backward compatibility by default. This is a new application, and requested changes are the live behavior unless the user says otherwise.
- Do not use `rg` in this project. Use PowerShell file and text search commands instead.
- Ignore `node_modules` for future file and text searches.
- When the user says `push changes` or `commit and push`, review pending changes, summarize the intended commit, create an appropriate commit, and push the current branch to the connected GitHub repository.
- At the end of any code, Supabase, or configuration changes, advise only the applicable Supabase pushes or deploys and provide copy/paste commands where possible, such as `supabase db push` or `supabase functions deploy <function-name>`. Assume the user will handle GitHub commits, GitHub pushes, and Netlify deploys through their integrated workflow. Do not include Netlify deploy instructions. Do not describe a table or migration as a function deploy target; deploy the actual Supabase function names that changed or depend on shared code.
