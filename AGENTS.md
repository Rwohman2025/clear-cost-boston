<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Pages read data only through `src/lib/api/queries.ts`, which wraps the `PricingApi` interface — so the mock can be swapped for the real backend in one place.
- Shared shapes live in `src/lib/models/types.ts` — it is the contract with the future backend.
- Mock data stays seeded/deterministic in `src/lib/mock/` — avoids SSR hydration mismatches.
- Pure calculations (stats, outliers) live in `src/lib/stats.ts` with tests — keeps logic testable outside React.
