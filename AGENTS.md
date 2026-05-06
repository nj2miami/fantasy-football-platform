# Project Instructions

These instructions apply to all agent work in this repository.

- Do not start a dev server unless the user explicitly asks for one.
- Do not preserve backward compatibility by default. This is a new application, and requested changes are the live behavior unless the user says otherwise.
- Do not use `rg` in this project. Use PowerShell file and text search commands instead.
- At the end of any code, Supabase, or configuration changes, advise what needs to be pushed or deployed and provide copy/paste commands where possible, such as `supabase db push`, `supabase functions deploy <function-name>`, and the relevant app deploy command. Do not describe a table or migration as a function deploy target; deploy the actual Supabase function names that changed or depend on shared code.
