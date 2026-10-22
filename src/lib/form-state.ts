/**
 * The result of a form's Server Action, shared by the action (server) and the
 * form (client). Messages are already translated by the action.
 */
export type FormState = {
  status: "idle" | "error" | "success";
  /** A message for the whole form, e.g. "Too many attempts". */
  message?: string;
  /** Messages for single fields, keyed by the input's name. */
  fieldErrors?: Record<string, string | undefined>;
  /** What the person typed (never passwords), so the form keeps it after an error. */
  values?: Record<string, string>;
  /** Extra data for a successful result, such as a link that was created. */
  data?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };
