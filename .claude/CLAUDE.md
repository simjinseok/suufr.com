# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

스프(Suufr) - 과외 일정 및 수업 관리 도구. 달 단위로 수업 횟수와 입금 내역을 관리할 수 있는 튜터링 관리 앱.

## Development Commands

```bash
# Development
pnpm dev              # Start Next.js dev server
pnpm build            # Production build
pnpm lint             # ESLint

# Database
pnpm db:start         # Start Docker PostgreSQL
pnpm db:stop          # Stop Docker PostgreSQL
pnpm db:reset         # Reset database (destroy volume)
pnpm prisma:generate  # Generate Prisma client
pnpm prisma:studio    # Open Prisma Studio
pnpm prisma:migrate   # Run migrations (dev)
pnpm prisma:deploy    # Deploy migrations (prod)
```

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **UI**: HeroUI v3 (beta), Tailwind CSS 4, Lucide icons
- **Forms**: React Hook Form + Zod
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: AWS Cognito OAuth (Arctic library)
- **Monitoring**: Sentry

## Tailwind CSS 4 Guidelines

This project uses **Tailwind CSS 4** with CSS-first configuration. Do NOT use v3 syntax.

**Configuration:**
- CSS-first setup via `@import "tailwindcss"` in globals.css
- Theme variables defined in `@theme {}` block
- No tailwind.config.ts file (not needed in v4)

**Color Usage:**
- Prefer defined colors (HeroUI semantic + Tailwind palette)
- HeroUI semantic: `accent`, `danger`, `warning`, `success`, `default`
- HeroUI soft variants: `bg-accent-soft`, `bg-danger-soft`, `bg-warning-soft`, `bg-success-soft`
- Tailwind palette: `gray`, `zinc`, `blue`, `green`, `purple`, `violet`, `indigo`, `red`, `amber`, `emerald`
- Arbitrary values (`bg-[#xxx]`) are acceptable when the design calls for a specific color not in the palette

**v3 → v4 Breaking Changes:**
| v3 (DO NOT USE) | v4 (USE THIS) |
|-----------------|---------------|
| `shadow-sm` | `shadow-xs` |
| `shadow-md` | `shadow-sm` |
| `rounded-sm` | `rounded-xs` |
| `blur-sm` | `blur-xs` |
| `ring-offset-*` | `inset-ring-*` |
| `bg-opacity-50` | `bg-black/50` |
| `decoration-slice` | `box-decoration-slice` |
| `flex-grow` | `grow` |
| `flex-shrink` | `shrink` |

**Renamed Utilities:**
- `overflow-ellipsis` → `text-ellipsis`
- `decoration-clone` → `box-decoration-clone`

## Architecture

```
app/
  (authenticated)/     # Protected routes (dashboard, students, payments, calendar, meetings)
  (student)/sl/        # Public shareable lesson view
  api/                 # API routes
  auth/                # OAuth handlers

actions/               # Server actions with Sentry instrumentation
components/            # React components by domain
utils/
  auth.ts              # JWT session from cookie
  prisma.ts            # Prisma client
schemas/               # Zod validation schemas
types/index.ts         # Core types (Student, Lesson, Payment, Meeting, etc.)
prisma/schema.prisma   # Database schema
```

## Key Patterns

**Server Actions**: All mutations use `Sentry.withServerActionInstrumentation` wrapper
```typescript
export async function updateStudent(prevState, formData) {
  return await Sentry.withServerActionInstrumentation('updateStudent', {...}, async () => {
    // validation, auth check, prisma operation, revalidatePath
  });
}
```

**Form State**: Use `React.useActionState` with react-hook-form
```typescript
const [state, formAction, isPending] = React.useActionState(serverAction, initialState);
const { control } = useForm({ values: state.fields });
```

**Modal Pattern** (HeroUI v3):
```typescript
<Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
  <Modal.Container>
    <Modal.Dialog>
      {({ close }) => <Content close={close} />}
    </Modal.Dialog>
  </Modal.Container>
</Modal.Backdrop>
```

**Soft Deletes**: All models use `deletedAt` field, queries filter `WHERE deletedAt IS NULL`

**User Isolation**: Every query includes `userId` check for multi-tenant data access

**Date Handling**: Use `@internationalized/date` with Korea timezone
```typescript
parseZonedDateTime(val).toDate()  // Parse with timezone
fromDate(date, getLocalTimeZone()) // Convert to ZonedDateTime
```

## Database Models

Core models: User, Student, Syllabus, Lesson, Payment, Meeting, Feedback, LessonShare

Students have status: pending | active | paused | leave (tracked via StudentStatusHistory)

## Environment Variables

Required: `POSTGRES_PRISMA_URL`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, `COGNITO_DOMAIN`, `COGNITO_REDIRECT_URI`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SENTRY_DSN`
