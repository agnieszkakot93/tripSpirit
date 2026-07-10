---
date: 2026-07-09T21:28:00+02:00
researcher: Auto
git_commit: 376e05b9c15357e4a69320fdc0903e5f9e469497
branch: docs/add-foundation-to-repo
repository: tripSpirit
topic: "Dodawanie i usuwanie wycieczki"
tags: [research, codebase, trips, crud, trip-create-modal, trip-list-panel]
status: complete
last_updated: 2026-07-09
last_updated_by: Auto
---

# Research: Dodawanie i usuwanie wycieczki

**Date**: 2026-07-09T21:28:00+02:00  
**Researcher**: Auto  
**Git Commit**: `376e05b9c15357e4a69320fdc0903e5f9e469497`  
**Branch**: `docs/add-foundation-to-repo`  
**Repository**: tripSpirit

## Research Question

Jak działa dodawanie i usuwanie wycieczki w TripSprint AI — od UI przez API do bazy D1? Jakie są luki względem PRD i planów S-02 / S-04?

## Summary

**Dodawanie** jest w pełni podpięte: `TripCreateModal` → `POST /api/trips` → `validateTripBody` → `insertTrip` → redirect na `/trips/{id}` + `router.refresh()`. **Usuwanie** działa end-to-end wyłącznie z panelu bocznego (`trip-list-panel.tsx`) → `DELETE /api/trips/[tripId]` → `deleteTrip()` (hard delete w D1). Backend obu operacji jest poprawny i scope'owany per użytkownik. Główne rozjazdy: martwy kod (`trip-create-form.tsx`, `trip-actions.tsx`), usuwanie tylko z listy (nie ze strony szczegółów), ciche błędy przy nieudanym DELETE oraz nawigacja zawsze na `/trips` po usunięciu dowolnej wycieczki.

## Detailed Findings

### Dodawanie wycieczki (Create)

**Ścieżka użytkownika**

1. Zalogowany użytkownik klika „Create trip” (sidebar, empty state lub placeholder).
2. Otwiera się `TripCreateModal` z polami: destynacja (tekst), dni (select 1–14), budżet (9 presetów €300–€5000).
3. Submit → `POST /api/trips` z `{ destination, durationDays, budgetAmount }`.
4. API: sprawdzenie sesji → walidacja → `insertTrip` (UUID, `itineraryJson: null`).
5. Sukces: zamknięcie modala, `router.push(/trips/{id})`, `router.refresh()` (odświeża listę w sidebarze).

**Kluczowe pliki**

- UI: [`src/components/trip-create-modal.tsx`](https://github.com/agnieszkakot93/tripSpirit/blob/376e05b9c15357e4a69320fdc0903e5f9e469497/src/components/trip-create-modal.tsx) — submit (L24–57), redirect (L50–51)
- Triggery: [`src/components/layout/nav-sidebar.tsx`](https://github.com/agnieszkakot93/tripSpirit/blob/376e05b9c15357e4a69320fdc0903e5f9e469497/src/components/layout/nav-sidebar.tsx), [`src/components/empty-workspace.tsx`](https://github.com/agnieszkakot93/tripSpirit/blob/376e05b9c15357e4a69320fdc0903e5f9e469497/src/components/empty-workspace.tsx)
- API: [`src/app/api/trips/route.ts`](https://github.com/agnieszkakot93/tripSpirit/blob/376e05b9c15357e4a69320fdc0903e5f9e469497/src/app/api/trips/route.ts) — `POST` (L23–48)
- Walidacja: [`src/lib/trips/validation.ts`](https://github.com/agnieszkakot93/tripSpirit/blob/376e05b9c15357e4a69320fdc0903e5f9e469497/src/lib/trips/validation.ts) — destynacja 1–120 znaków, dni 1–14, budżet 1–50 000
- DB: [`src/lib/trips/queries.ts`](https://github.com/agnieszkakot93/tripSpirit/blob/376e05b9c15357e4a69320fdc0903e5f9e469497/src/lib/trips/queries.ts) — `insertTrip` (L44–65)

**Walidacja i błędy**

| Warunek | HTTP | Odpowiedź |
|---------|------|-----------|
| Brak sesji | 401 | `{ error: "Unauthorized" }` |
| Zły JSON | 400 | `{ error: "Invalid JSON body" }` |
| Walidacja | 400 | konkretny komunikat |
| Błąd DB | 500 | `{ error: "Internal error" }` |
| Sukces | 201 | pełny obiekt wycieczki |

Modal pokazuje błędy inline; brak specjalnej obsługi 401 (redirect do logowania).

**Luki vs FR-004**

- Budżet w UI ograniczony do 9 presetów; API akceptuje dowolny integer 1–50 000.
- `src/components/trip-create-form.tsx` — martwy kod (plan S-02 zakładał inline form, implementacja przeszła na modal).

### Usuwanie wycieczki (Delete)

**Ścieżka użytkownika**

1. Użytkownik na `/trips` lub `/trips/[tripId]` widzi listę w sidebarze.
2. Hover na karcie → przycisk ⋯ → „Delete”.
3. `window.confirm('Delete "{destination}"? This cannot be undone.')`.
4. `DELETE /api/trips/{id}` → hard delete wiersza `trips` (wraz z `itinerary_json`).
5. `router.push("/trips")` + `router.refresh()`.

**Kluczowe pliki**

- UI (jedyna żywa ścieżka): [`src/components/layout/trip-list-panel.tsx`](https://github.com/agnieszkakot93/tripSpirit/blob/376e05b9c15357e4a69320fdc0903e5f9e469497/src/components/layout/trip-list-panel.tsx) — `handleDelete` (L37–56)
- API: [`src/app/api/trips/[tripId]/route.ts`](https://github.com/agnieszkakot93/tripSpirit/blob/376e05b9c15357e4a69320fdc0903e5f9e469497/src/app/api/trips/[tripId]/route.ts) — `DELETE` (L70–93)
- DB: [`src/lib/trips/queries.ts`](https://github.com/agnieszkakot93/tripSpirit/blob/376e05b9c15357e4a69320fdc0903e5f9e469497/src/lib/trips/queries.ts) — `deleteTrip` (L86–96)
- Testy: [`src/lib/trips/queries.test.ts`](https://github.com/agnieszkakot93/tripSpirit/blob/376e05b9c15357e4a69320fdc0903e5f9e469497/src/lib/trips/queries.test.ts) — owner / wrong user / missing id (L214–239)

**Autoryzacja (warstwy)**

```
Layout (auth redirect) → API auth() → deleteTrip WHERE id AND userId
```

Brak dopasowania → 404 (bez ujawniania istnienia cudzej wycieczki).

**Zachowanie po usunięciu**

| Scenariusz | Efekt |
|------------|-------|
| Usunięcie otwartej wycieczki | Redirect `/trips` — poprawne (unika 404 na starym URL) |
| Usunięcie innej wycieczki podczas przeglądania A | **Bug UX**: i tak redirect na `/trips` zamiast zostać na `/trips/A` |
| Ostatnia wycieczka | `EmptyWorkspace` |
| Zostały inne | `WorkspacePlaceholder` |

**Martwy kod**

[`src/components/trip-actions.tsx`](https://github.com/agnieszkakot93/tripSpirit/blob/376e05b9c15357e4a69320fdc0903e5f9e469497/src/components/trip-actions.tsx) — plan S-04 przewidywał delete na stronie szczegółów; komponent nigdzie nie jest importowany. Ma lepszy confirm (wspomina itinerarium) i obsługę błędów API.

**Luki vs FR-008**

| Wymaganie | Status |
|-----------|--------|
| Użytkownik może usunąć wycieczkę | ✅ z listy bocznej |
| Hard delete, bez undo | ✅ |
| Potwierdzenie przed usunięciem | ✅ `window.confirm` |
| Informacja o utracie itinerarium | ❌ sidebar nie wspomina itinerarium |
| Delete ze strony szczegółów (plan S-04) | ❌ odwrócone — delete tylko z listy |
| Feedback przy błędzie API | ❌ `if (!res.ok) return` — cicho |

## Code References

- `src/components/trip-create-modal.tsx:24-57` — create submit + nawigacja
- `src/app/api/trips/route.ts:23-48` — POST handler
- `src/lib/trips/queries.ts:44-65` — insertTrip
- `src/components/layout/trip-list-panel.tsx:37-56` — delete z listy
- `src/app/api/trips/[tripId]/route.ts:70-93` — DELETE handler
- `src/lib/trips/queries.ts:86-96` — deleteTrip (owner-scoped)
- `src/components/trip-create-form.tsx` — martwy kod (create)
- `src/components/trip-actions.tsx` — martwy kod (edit + delete)

## Architecture Insights

- **Wzorzec**: cienkie handlery API + logika w `src/lib/trips/` (queries, validation).
- **Lista wycieczek**: SSR w `(protected)/layout.tsx` via `listTripsForUser`; `GET /api/trips` istnieje, ale UI go nie woła — odświeżanie przez `router.refresh()`.
- **Scope użytkownika**: każde zapytanie filtruje `eq(trips.userId, userId)`.
- **Itinerarium**: JSON w kolumnie `itinerary_json` tego samego wiersza — delete wycieczki usuwa też plan podróży atomowo.
- **Modal vs form**: S-02 zaplanował inline form; produkcja używa modala z presetami budżetu.

## Historical Context (from prior changes)

- [`context/changes/trip-creation-and-list/`](https://github.com/agnieszkakot93/tripSpirit/blob/376e05b9c15357e4a69320fdc0903e5f9e469497/context/changes/trip-creation-and-list/) — S-02, status `implemented`: create + list + open
- [`context/changes/trip-edit-and-delete/`](https://github.com/agnieszkakot93/tripSpirit/blob/376e05b9c15357e4a69320fdc0903e5f9e469497/context/changes/trip-edit-and-delete/) — S-04, status `implemented`: PATCH + DELETE (plan: delete na detail page)
- [`context/foundation/prd.md`](https://github.com/agnieszkakot93/tripSpirit/blob/376e05b9c15357e4a69320fdc0903e5f9e469497/context/foundation/prd.md) — FR-004 (create), FR-005 (list), FR-008 (delete, hard delete OK)
- [`context/foundation/roadmap.md`](https://github.com/agnieszkakot93/tripSpirit/blob/376e05b9c15357e4a69320fdc0903e5f9e469497/context/foundation/roadmap.md) — S-02 i S-04 nadal `proposed` (drift dokumentacji)

## Related Research

- Brak wcześniejszych `research.md` w `context/changes/` ani `context/archive/`.

## Open Questions

1. Czy podpiąć `TripActions` na stronie szczegółów, czy usunąć martwy kod i zostawić delete tylko w liście?
2. Czy naprawić nawigację po delete innej wycieczki (`router.push` tylko gdy `trip.id === activeId`)?
3. Czy rozszerzyć confirm o utratę itinerarium (jak w `trip-actions.tsx`)?
4. Czy dodać obsługę błędów DELETE w `trip-list-panel` (toast / inline error)?
