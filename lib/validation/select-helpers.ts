// Native `<select>` elements always submit a string value, even for a
// "None"/placeholder option (`value=""`) — never `undefined`. Zod schemas
// that model an optional relation as `z.string().uuid().optional()`
// (correct for the API/Service layer, which never receives an empty
// string — Document 7 §11) reject that empty string when the same schema
// backs a form's `zodResolver`, and the failure is invisible if the form
// doesn't render an error for that specific field — `handleSubmit` just
// never calls `onSubmit`.
//
// Fixed via React Hook Form's `register(name, { setValueAs })`, not a Zod
// `.preprocess()`/`.transform()` wrapper around the schema: those change
// the schema's inferred *input* type to `unknown`, which no longer matches
// `useForm<T>`'s single type parameter (RHF v7 ties the form's field-value
// type to both `defaultValues` and the validated output) — real errors,
// not pedantry, confirmed by trying it. `setValueAs` runs before
// validation, per field, keeping the schema and its inferred type
// untouched.
export function EMPTY_TO_UNDEFINED(value: unknown): string | undefined {
  return value === "" ? undefined : (value as string | undefined);
}
