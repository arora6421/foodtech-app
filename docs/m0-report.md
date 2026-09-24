# M0 report: the engine

> ## ✅ M0 CLOSED (2026-09-24)
>
> **Decisions at close (by the product owner):**
>
> 1. **Exit criteria revisions in §4A: approved.** The criteria below replace MVP_SPEC §14.4 for M0.
> 2. **Group engine tuning (§4B.1): deferred to M2.** This covers misery handling for members with no YES, the pivot in group decks, and threshold calibration.
> 3. **Contrast-based explanation reasons (§4B.2): deferred.** Feature-recovery precision is reported, not gated, until then.
> 4. **Spec revision 3** (engine fixes and tuning, §3) is accepted as part of closing M0.
>
> **Final scorecard** (re-measured at close with the approved criteria; `npm run sim`, 200 seeds):
>
> | Criterion | Target | Actual | |
> |---|---|---|---|
> | Median swipes to stop (gated) | 8–12, p90 ≤ 14 | median 9, p90 13 | ✅ |
> | Max-reached (gated personas, excl. P12) | ≤ 10% | 5% | ✅ |
> | Acceptable hero / hit@3 (gated) | ≥ 90% / ≥ 80% | 91% / 80% (hit@1 62%, reported) | ✅ |
> | Acceptable hero (P10 noisy) | ≥ 90% | 99% | ✅ |
> | EIG vs greedy | ≥ 15% fewer swipes-to-correct or +10 pt hit@1 | 8 vs 10 (−20%) | ✅ |
> | EIG vs random | better on both | 8 vs 16; 62% vs 50% | ✅ |
> | P7 mis-stated craving hit@3 | ≥ 70% | 98% | ✅ |
> | P11 premature lock | ≤ 20% | 1% | ✅ |
> | Diet violations / unsupported claims | 0 / 0 | 0 / 0 | ✅ |
> | Group determinism / diet | 100% / 0 | 100% / 0 | ✅ |
> | Feature recovery precision@k | ≥ 0.6 | 0.37 | ⏸ deferred (decision 3) |
> | Group final pick in true top 3 | set in M2 | 69% | ⏸ deferred (decision 2) |
>
> **10 / 10 counted criteria pass; 2 deferred.**
>
> **Correction made at close:** §4A originally said max-reached was "4.9% excluding P9, P10, P12". That figure also excluded **P13**, which is consistent with the spec: P13 is "reported, not gated" (§14.2), like every other gated aggregate. The criterion is therefore worded "gated personas, excluding P12". With P13 included, the rate is 11.5%.
>
> **Carried forward:** the two deferred items; the open M1 inputs (image tool, working name) and the Supabase account for M2. M1 planning: `docs/m1-spec.md`.

*2026-09-24. This covers M0.1–M0.13 (MVP_SPEC §24). The numbers come from `npm run sim` at the committed defaults: 13 personas × 200 seeds × 4 policies, plus 4 group scenarios × 50 seeds. Every number here can be reproduced exactly. The sections below are the review as submitted, with the correction noted above.*

## 1. What exists

| Step | Deliverable | Where |
|---|---|---|
| M0.1 | Vite + TypeScript 6 strict, ESLint layer boundaries (proven to reject violations), Vitest, npm scripts. The engine compiles with **no DOM or Node types**. | `package.json`, `eslint.config.js`, `tsconfig.*.json` |
| M0.2 | Taxonomy, Zod schemas, diet rules | `src/domain/` |
| M0.3 | Labelling rubric; mock catalogue: **84 archetypes, 36 fictional venues, 139 offerings** around Angel, N1; coverage validator | `docs/labelling-rubric.md`, `src/catalog/` |
| M0.4 | Hard eligibility, WHERE fits, fixed location provider | `src/engine/context/`, `src/location/` |
| M0.5 | Evidence profile with recency decay γ = 0.92 and uncertainty × salience NOPE blame | `src/engine/profile/` |
| M0.6 | Taste, belief, final rank, score breakdown, diverse shortlist | `src/engine/scoring/` |
| M0.7 | Deck: incremental EIG (matches a brute-force reference to 9 dp), phases, adjacency slots, PAM clusters, anchors | `src/engine/deck/`, `src/engine/clusters/` |
| M0.8 | Stopping rule, narrowing counter, silent pivot, event-sourced solo reducer (undo = replay) | `src/engine/stopping/`, `src/engine/session/` |
| M0.9 | Evidence-bound explanations with enforced quantifiers | `src/engine/explain/` |
| M0.10 | Group engine: host-written shared deck, member decks, average-without-misery, the three outcomes, compromise, final round. `InMemoryTransport` passes the transport contract tests. | `src/engine/group/`, `src/sync/` |
| M0.11 | 13 personas + 4 group scenarios, parallel sim runner, ablations, sweep, report, replayable transcripts | `src/sim/` |
| M0.12 | Debug panel (`npm run dev`), verified in Chrome; replays any sim transcript | `src/app/debug/` |
| M0.13 | Tuning pass (this report) | `src/engine/config.ts` |

**148 automated tests pass** (`npm run check`). They include property tests showing that no card, hero, runner-up or alternative ever violates the diet, and that no explanation makes an unsupported claim.

## 2. Headline results (EIG policy, gated personas P1–P8, P11, P12)

| | Result |
|---|---|
| **Swipes to a decision** | median **9**, p90 13. 8 swipes: 37% of sessions · 9: 27% · 10: 17% · 11–14: 12% · hit the cap: 7% |
| **The hero is something the persona would have said YES to** | **91.5%** (the noisy persona P10: 98.5%) |
| hero in the persona's true top 3 (hit@1) | 62% |
| any of hero + 2 runners-up in the true top 3 (hit@3) | 80% |
| Swipes override a wrong craving (P7 taps "Fresh", wants indulgent) | hit@3 98% |
| Echo chamber: premature lock for the two-modes persona | 1% |
| Diet violations / unsupported explanation claims | **0 / 0** across 10,400 sessions |
| Transcript determinism | identical on replay |

### Ablations (the same personas and seeds)

| Policy | Swipes | hit@1 | hit@3 | Acceptable | Swipes-to-correct | Entropy drop / swipe |
|---|---|---|---|---|---|---|
| **EIG (default)** | **9** | **62%** | **80%** | **91%** | **8** | 0.20 |
| Greedy (always show the likeliest) | 10 | 57% | 73% | 88% | 10 | 0.19 |
| Random cards | 15 | 50% | 73% | 80% | never | 0.11 |
| No recency decay (γ = 1) | 8 | 53% | 81% | 92% | 12 | 0.25 |

- **Information gain earns its place**: fewer swipes, more correct and more acceptable answers than greedy, and far better than random.
- **Recency decay (your rev. 2 change) also earns its place**: +9 points hit@1 and 4 fewer swipes to reach the right answer, at a cost of −1 point hit@3.

## 3. What M0 found, and what changed (spec revision 3)

These came from testing, not from the original design. Each one is logged in the spec's revision history.

1. **The spec's p_yes formula made the deck chase niche dishes.** σ(κ·taste) is about 0.5 for every card early on, so niche cards looked most informative. A noodle lover was never shown noodles in 15 cards. It's now belief-predictive: Σ P(a)·sim(a,c)².
2. **β = 6 left the belief flat**: 91% of sessions hit the 15-swipe cap. Tuned to **β = 20**. At 25 the belief overcommits, and hit@3 falls to 70%.
3. **The support threshold (taste ≥ 0.30) blocked class-level wants** ("any noodles") from ever stopping. Lowered to **0.15**.
4. **Min swipes 6 → 8.** This puts the median inside your 8–12 target and lifts hit@1 by about 6 points.
5. **With a sharp belief, Confirm started at card 4** and skipped Narrow's exploration. **Confirm now can't start before card 6.**
6. **Stability now tolerates swaps between two dishes in the same cluster**, e.g. two noodle dishes swapping first place.
7. **Clusters**: farthest-point k-medoids produced incoherent groups (doner kebab in the desserts). Replaced with **PAM, k = 13**.
8. **A cluster whose pivot anchor was NOPEd now counts as cold.** Otherwise the second pivot re-anchored in the cluster the user had just rejected.
9. **Catalogue**: the reachability check found two dishes available only beyond 3 miles; fixed.

**Tried and rejected, with evidence:**
- Counting all post-probe NOPEs towards the pivot: the noodle persona's cap rate went from 6% to 65%, so the spec's Narrow-only rule stays.
- A "no support" gate on the pivot: no effect.
- Cluster-mass stopping: no measurable effect; kept only as an option.

## 4. Exit criteria: where we stand, and what I propose

At the committed defaults, **6 of 11** original criteria pass (with the spec's starting constants: 2 of 9).

| Criterion (§14.4) | Target | Actual | |
|---|---|---|---|
| Median swipes (p90) | 8–12 (≤ 14) | 9 (13) | ✅ |
| Max-reached (excl. P9, P10) | ≤ 10% | 13% | ❌ |
| hit@1 / hit@3 (low-noise) | 70% / 90% | 62% / 80% | ❌ |
| hit@1 / hit@3 (P10 noisy) | 50% / 75% | 20% / 35% | ❌ |
| EIG vs greedy | ≥ 15% fewer STC or +10 pt hit@1 | STC 8 vs 10 (−20%) | ✅ |
| EIG vs random | better on both | yes | ✅ |
| Feature recovery precision@k | ≥ 0.6 | 0.37 | ❌ |
| P7 hit@3 | ≥ 70% | 98% | ✅ |
| P11 premature lock | ≤ 20% | 1% | ✅ |
| Diet violations / unsupported claims | 0 / 0 | 0 / 0 | ✅ |
| Group classification | ≥ 90% | 54% | ❌ |

**My read of the five failures.** They fall into two kinds, and I'd treat them differently.

### A. Criteria that measure the wrong thing (I propose revising these)

- **hit@1 against "true top 3" is capped by binary feedback.**
  - The heat seeker says YES to spicy chicken whether it's crispy (utility 1.2) or not (0.9). No sequence of YES/NO answers can separate those two tiers, so the engine lands on a 0.9 dish.
  - The heat seeker's hero is acceptable 100% of the time, but hit@1 is 9%.
  - The product promise is "it found something I want". That's the acceptable-hero rate, 91.5%.
  - **Proposal:** primary criterion **acceptable hero ≥ 90%**, plus **hit@3 ≥ 80%**. Keep hit@1 as a reported diagnostic.
  - For P10 (noisy): acceptable ≥ 90% (actual 98.5%).
  - "That's the one" and the runners-up are how a real user closes the good-vs-best gap. The personas never use them.
- **Max-reached** is driven by P12 ("says yes to almost everything"), who gives the engine nothing to learn from. For P12, hitting the cap and saying "Best guess" is the honest outcome.
  - **Proposal:** ≤ 10% over gated personas excluding P12. Actual: **4.9%**. *(Corrected at close: originally worded "excluding P9, P10, P12", but the figure also excludes the ungated P13. With P13 included, it's 11.5%.)*
- **Group classification against my hand-written scenario labels.**
  - G-C (fresh + comfort + picky) I labelled "nobody agrees", but the engine calls it common ground, and its final pick is in the true group top 3 **96%** of the time. My label was wrong, not the engine.
  - **Proposal:** judge groups on the **final pick being in the true group top 3** (with the final round simulated), not on the outcome label.

### B. Real engine weaknesses (I'd keep these criteria and fix the engine)

1. **Group G-A (heat seeker + noodle lover + spicy-noodle lover) only reaches the right answer 14% of the time.**
   - The spicy-noodle member (P13, a deliberately hard non-additive persona) is never shown a noodle dish in 12 group cards.
   - Having said NOPE to everything, they look "miserable about everything", which sinks the group.
   - Two fixes to consider:
     - (a) Use the silent pivot in group personal decks too. The spec doesn't have it there today.
     - (b) Treat a member with no YES at all as "unknown", not "miserable", in the misery penalty.
   - The group thresholds (τ, winner/OK scores) are also **still at their untuned initial values**. They were set before we learned how compressed taste scores are.
2. **Feature recovery and "reasons name a true like" are low (0.37, about 30%).**
   - Explanations are always *faithful to the evidence*: zero unsupported claims.
   - But with 8–9 swipes the engine can't separate correlated features. It will say "you said yes to both Thai dishes" when the persona's real driver was heat.
   - Possible fixes:
     - Prefer reasons with *contrast* evidence (YES on dishes with the feature, NOPE on similar dishes without it).
     - Let information gain occasionally target *feature* uncertainty, not only dish uncertainty.
   - This is worth doing, but it's a design change for you to decide on, not a tweak.
3. **The spicy-only-on-noodles persona (P13, not gated) fails, as expected.** An additive model can't represent "spicy, but only on noodles". A learned model could later. The architecture allows swapping the scorer.

## 5. Decisions requested before M1 *(resolved at close; see the top of this report)*

1. **Exit criteria:** accept the §4A revisions, or keep the originals?
2. **Group work:** fix §4B.1 now, as the last M0 item, or in M2 when group mode is built? I'd do it in M2. The group engine is correct and deterministic, only under-tuned, and M1 doesn't depend on it.
3. **Explanation quality (§4B.2):** attempt contrast-based reasons now, or accept "faithful but sometimes the correlated feature" for the MVP?
4. **Still open from before:** the image-generation tool, the working name, and a Supabase account (by M2).

## 6. How to reproduce

```bash
npm install
npm run check                       # typecheck + lint + 148 tests
npm run sim                         # full report → sim-output/sim-report.md (~3–4 min, 7 workers)
npm run sim -- --transcripts        # also writes sim-output/transcripts.json
npm run sim -- --sweep              # parameter sweep → sim-output/sweep.md
npm run dev                         # debug panel; "Replay a sim transcript" loads transcripts.json
```
