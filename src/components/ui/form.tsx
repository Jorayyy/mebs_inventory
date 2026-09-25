"use client";

import * as React from "react";
import { useForm, type FieldValues, type UseFormProps, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/errors";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Action<TIn, TOut> = (input: TIn) => Promise<ActionResult<TOut>>;

export type FormActionOptions<TIn, TOut> = {
  onSuccess?: (data: TOut, values: TIn) => void | Promise<void>;
  successMessage?: string | ((data: TOut) => string);
  /** Values are merged into the payload before invoking the action. */
  extra?: () => Record<string, unknown>;
};

/**
 * Bridges react-hook-form with a server action returning `ActionResult`.
 * Applies server-side field errors back onto the matching form fields.
 */
export type FormSubmitHandler = (event?: React.BaseSyntheticEvent) => Promise<void>;

export function useFormAction<TIn extends FieldValues, TOut = unknown>(
  action: Action<TIn & Record<string, unknown>, TOut>,
  options: FormActionOptions<TIn, TOut> = {},
  rhfOptions?: UseFormProps<TIn>
): UseFormReturn<TIn> & {
  submitting: boolean;
  serverError: string | null;
  /** Bind directly to `<form onSubmit={submit}>`. */
  submit: FormSubmitHandler;
} {
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<TIn>({
    mode: "onSubmit",
    ...rhfOptions,
  });

  const submit = React.useCallback(
    async (values: TIn) => {
      setSubmitting(true);
      setServerError(null);
      try {
        const payload = { ...values, ...(options.extra?.() ?? {}) } as TIn & Record<string, unknown>;
        const result = await action(payload);

        if (!result.ok) {
          setServerError(result.error);
          if (result.fieldErrors) {
            for (const [field, messages] of Object.entries(result.fieldErrors)) {
              form.setError(field as never, { type: "server", message: messages[0] });
            }
          }
          toast.error(result.error, {
            description: `Reference: ${result.errorId}`,
          });
          return;
        }

        if (options.successMessage) {
          const msg =
            typeof options.successMessage === "function"
              ? options.successMessage(result.data)
              : options.successMessage;
          toast.success(msg);
        }
        await options.onSuccess?.(result.data, values);
      } catch (error) {
        const message =
          error instanceof Error ? "An unexpected error occurred." : "An unexpected error occurred.";
        setServerError(message);
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [action, options.successMessage]
  );

  return {
    ...form,
    submitting,
    serverError,
    submit: form.handleSubmit(submit),
  };
}

export function Field({
  label,
  htmlFor,
  error,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

export function FormError({ error, errorId }: { error?: string | null; errorId?: string }) {
  if (!error) return null;
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <p>{error}</p>
      {errorId && <p className="mt-1 text-xs opacity-70">Error ID: {errorId}</p>}
    </div>
  );
}
