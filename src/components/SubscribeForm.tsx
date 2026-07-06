"use client";

import { FormEvent, useRef, useState } from "react";
import { useSubscription } from "./SubscriptionContext";

type SubscribeFormProps = {
  formId: string;
  inputId: string;
  odId: string;
  inputOdId: string;
  buttonOdId: string;
  noteOdId: string;
  placeholder: string;
  defaultNote: string;
};

export function SubscribeForm({
  inputId,
  odId,
  inputOdId,
  buttonOdId,
  noteOdId,
  placeholder,
  defaultNote
}: SubscribeFormProps) {
  const { buttonLabel, email, isSubmitting, note, noteState, submitEmail } = useSubscription();
  const [draft, setDraft] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const value = isDirty ? draft : email;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = await submitEmail(value);
    if (result === "invalid") {
      inputRef.current?.focus();
      return;
    }

    if (result === "error") return;

    setIsDirty(false);
    setDraft("");
  }

  const noteClassName =
    noteState === "success"
      ? "form-note is-success"
      : noteState === "error"
        ? "form-note is-error"
        : "form-note";

  return (
    <>
      <form
        className="email-form"
        data-subscribe-form
        data-od-id={odId}
        noValidate
        onSubmit={handleSubmit}
      >
        <label htmlFor={inputId}>邮箱地址</label>
        <input
          ref={inputRef}
          id={inputId}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={placeholder}
          data-od-id={inputOdId}
          required
          value={value}
          onChange={(event) => {
            setIsDirty(true);
            setDraft(event.target.value);
          }}
        />
        <button
          className="btn btn-primary"
          type="submit"
          data-od-id={buttonOdId}
          disabled={isSubmitting}
        >
          {buttonLabel}
        </button>
      </form>
      <p className={noteClassName} data-form-note data-od-id={noteOdId}>
        {note ?? defaultNote}
      </p>
    </>
  );
}
