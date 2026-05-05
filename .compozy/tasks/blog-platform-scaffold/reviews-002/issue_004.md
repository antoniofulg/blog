---
provider: manual
pr:
round: 2
round_created_at: 2026-05-05T15:48:56Z
status: resolved
file: app/routes/newsletter.tsx
line: 37
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: Newsletter form silently discards submissions — no server action, no feedback

## Review Comment

Both newsletter forms (`app/routes/newsletter.tsx:37` and `app/routes/index.tsx:248`) use:

```tsx
<form onSubmit={(e) => e.preventDefault()}>
```

Submitting the form does nothing: no server function is called, no toast or success message appears, no error is shown. The user fills in their name and email, clicks "Inscrever-se na Newsletter", and gets zero feedback. The button does not disable during submission, there is no loading state, and the form is not reset.

For the scaffold, this ships broken UI. The PRD explicitly excludes newsletter integration as a non-goal, but the routes and forms are present and linked from the navigation. Broken interactive features erode trust in the scaffold more than absent ones.

**Fix** (choose one):

1. **Remove the routes and navigation links** if newsletter integration is out of scope for the scaffold. Delete `app/routes/newsletter.tsx` and remove the newsletter section from `app/routes/index.tsx`.

2. **Add a visible placeholder state** that makes the unimplemented state explicit:
   ```tsx
   <form onSubmit={(e) => e.preventDefault()}>
     {/* ... inputs ... */}
     <button type="submit" disabled>
       Em breve
     </button>
   </form>
   ```

## Triage

- Decision: `valid`
- Notes: Confirmed. Both `newsletter.tsx:36` and `index.tsx:248` use `onSubmit={(e) => e.preventDefault()}` with no server action, no feedback, and no loading/disabled state. Fix applied: replaced the submit button with a `disabled` button labelled "Em breve" in both locations, with a TODO comment pointing to the integration needed. This makes the placeholder intent explicit rather than silently broken.
